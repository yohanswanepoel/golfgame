import {
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  MeshBuilder,
  Vector3,
  Color3,
  Quaternion,
  StandardMaterial,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  LinesMesh,
  PhysicsMaterialCombineMode,
} from "@babylonjs/core";

import { createDistanceBoards } from "../core/distanceBoards.js";
import { createTeeArea } from "../core/teeArea.js";
import { createGolferSprite, HANDEDNESS } from "../golfer/golferSprite.js";

import {
  AdvancedDynamicTexture,
  StackPanel,
  Button,
  TextBlock,
} from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";

// DOM HUD element refs (accessed lazily per-frame)
const domHud = {
  get club() { return document.getElementById("hud-club"); },
  get distance() { return document.getElementById("hud-distance"); },
  get shots() { return document.getElementById("hud-shots"); },
  get aim() { return document.getElementById("hud-aim"); },
};
import {
  PHYSICS, BALL, GROUND, CLUBS, CLUB_KEYS, SWING, CLUBS_MAP,
} from "../core/constants.js";
import { createSwingMeter, SWING_STATE } from "../core/swing.js";
import { createBallLauncher } from "../core/ballLaunch.js";

/**
 * Builds the Phase 1 driving-range scene: flat ground, ball, swing meter,
 * camera follow, and debug HUD.
 */
export async function createDrivingRangeScene(engine, canvas) {
  const scene = new Scene(engine);

  // ---- Camera ----
  // Camera starts behind the ball, looking toward +Z (down the fairway).
  // alpha controls horizontal rotation (aim), beta controls elevation.
  //
  const INITIAL_CAMERA_ALPHA = -Math.PI / 2;
  const INITIAL_CAMERA_BETA = Math.PI / 2.4;
  const INITIAL_CAMERA_RADIUS = 8;

  const camera = new ArcRotateCamera(
    "camera",
    INITIAL_CAMERA_ALPHA,
    INITIAL_CAMERA_BETA,
    INITIAL_CAMERA_RADIUS,
    new Vector3(0, 0.5, 0),
    scene
  );

  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 40;
  camera.wheelPrecision = 30;
  camera.keysDown.push(39);  // right arrow for rotate
  camera.keysUp.push(37);    // left arrow

  // ---- Light ----
  const light = new HemisphericLight("light", new Vector3(0, 1, 0.3), scene);
  light.intensity = 0.9;

  // ---- Physics ----
  const havokInstance = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havokInstance);
  scene.enablePhysics(new Vector3(0, PHYSICS.gravity, 0), havokPlugin);

  // ---- Ground (use a thin box so Havok gets a well-formed collision volume) ----
  const ground = MeshBuilder.CreateBox(
    "ground",
    { width: 120, height: 0.1, depth: 800 },
    scene
  );
  ground.position.y = -0.05; // top surface sits at Y=0

  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.22, 0.5, 0.22);
  ground.material = groundMat;

  const groundAggregate = new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    { mass: 0, },
    scene
  );

  // Force MULTIPLY combine so this surface's friction actually matters
  // against the ball's friction, instead of Havok picking the min of the two
  groundAggregate.shape.material = {
    friction: GROUND.fairway.friction,
    restitution: GROUND.fairway.restitution,
    frictionCombine: PhysicsMaterialCombineMode.MULTIPLY,
    restitutionCombine: PhysicsMaterialCombineMode.MAXIMUM,
  };

  const TEE_POSITION = new Vector3(0, BALL.diameterMeters / 2, 0);

   // adds the mat + peg
  createTeeArea(scene, TEE_POSITION, {
    ballRadius: BALL.diameterMeters / 2,
  });

  const golfer = createGolferSprite(scene, TEE_POSITION, {
    handedness: HANDEDNESS.RIGHT, // or HANDEDNESS.LEFT
  });

  // ---- Ball (drops from above on first load, resets to tee spot) ----
  const ball = MeshBuilder.CreateSphere(
    "ball",
    { diameter: BALL.diameterMeters, segments: 16 },
    scene
  );
  ball.position = new Vector3(TEE_POSITION.x, 1, TEE_POSITION.z);
  //ball.position = new Vector3(0, BALL.diameterMeters / 2 + 0.001, 0); // resting on the green

  const ballMat = new StandardMaterial("ballMat", scene);
  ballMat.diffuseColor = new Color3(1, 1, 1);
  ballMat.specularColor = new Color3(0.3, 0.3, 0.3);
  ball.material = ballMat;

  // Disable gravity on the ball so it stays frozen at the tee spot.
  // Havok v2 does not reliably honour startAsleep — bodies get
  // collision resolution on creation even when "asleep", which pushes
  // the ball upward because it sits at Y=0.022 above a ground whose
  // collision shape extends slightly past Y=0.
  const ballAggregate = new PhysicsAggregate(
    ball,
    PhysicsShapeType.SPHERE,
    { mass: BALL.mass, friction: BALL.friction, restitution: BALL.restitution },
    scene
  );
  // Damping — this is what actually stops the endless rolling
  ballAggregate.body.setLinearDamping(BALL.linearDamping);
  ballAggregate.body.setAngularDamping(BALL.angularDamping);

  ballAggregate.shape.material = {
    friction: BALL.friction,
    restitution: BALL.restitution,
    frictionCombine: PhysicsMaterialCombineMode.MULTIPLY,
    restitutionCombine: PhysicsMaterialCombineMode.MAXIMUM,
  };
  //ballAggregate.body.setGravityFactor(0);
  const { boards } = createDistanceBoards(scene, {
    interval: 25,
    maxDistance: 300,      // bump toward 300+ since your ground depth is 600
    fairwayHalfWidth: 12,  // match this to your ground's `width: 80` — half is 40, so pull boards in from the true edge
  });

  // ---- Aim indicator line ----
  const AIM_LINE_LENGTH = 10;
  const aimLine = MeshBuilder.CreateLines(
    "aimLine",
    { points: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)] },
    scene
  );
  aimLine.color = new Color3(1, 1, 0.2);
  aimLine.visibility = 0.7;

  function updateAimLine() {
    const forward = camera.getDirection(new Vector3(0, 0, 1));
    forward.y = 0;
    forward.normalize();
    const bx = ball.position.x;
    const bz = ball.position.z;
    aimLine.points = [
      new Vector3(bx, 0, bz),
      new Vector3(bx + forward.x * AIM_LINE_LENGTH, 0, bz + forward.z * AIM_LINE_LENGTH),
    ];
  }

  // ---- State ----
  let selectedClubId = "driver";
  let shotCount = 0;
  let distanceTraveled = 0;

  const CAMERA_FOLLOW_DELAY_SECONDS = 1; // tune to taste
  let followDelayTimer = 0;

  // ---- Ball Launcher (Phase 1 Task 3) ----
  const ballLauncher = createBallLauncher();

  // ---- Swing Meter ----
  const swingMeter = createSwingMeter(scene, {
    onSwingComplete(result) {
      // console.log("[Phase 1] Swing result:", result);
      // Re-enable gravity so the ball flies and falls
      // ballAggregate.body.setGravityFactor(1);
      followDelayTimer = CAMERA_FOLLOW_DELAY_SECONDS;

      // Compute aim direction from camera (projected onto XZ plane)
      const aimDir = camera.getDirection(new Vector3(0, 0, 1));
      aimDir.y = 0;
      aimDir.normalize();

      // Launch the ball using the appropriate method
      if (result.club === "putter") {
        ballLauncher.launchPutter(result, ball, ballAggregate.body, aimDir);
      } else {
        ballLauncher.launch(result, ball, ballAggregate.body, aimDir);
      }
    },
    onStateChange({ state }) {
      // Camera behavior: detach when swing starts (lock aim), re-attach when reset.
      if (state === SWING_STATE.POWER_FILL ||
          state === SWING_STATE.POWER_LOCKED ||
          state === SWING_STATE.SWING_COMPLETE) {
        camera.detachControl(canvas);
      }
      if (state === SWING_STATE.IDLE) {
        camera.attachControl(canvas, true);
      }
      golfer.onSwingStateChange(state);
    },
    getSelectedClubId: () => selectedClubId,
  });

  // ---- Club Selection UI (top-left) ----
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
  gui.verticalAlignment = 0; // TOP
  gui.horizontalOffset = 0;

  const clubPanel = new StackPanel();
  clubPanel.horizontalAlignment = 0; // LEFT
  clubPanel.verticalAlignment = 0; // TOP
  clubPanel.top = "10px";
  clubPanel.width = "200px";
  gui.addControl(clubPanel);

  const title = new TextBlock();
  title.text = "Club:";
  title.height = "30px";
  title.color = "white";
  title.fontSize = 16;
  clubPanel.addControl(title);

  const clubButtons = {};
  CLUB_KEYS.forEach((key) => {
    const club = CLUBS_MAP[key];
    const btn = Button.CreateSimpleButton(key, club.displayName);
    btn.width = "100%";
    btn.height = "34px";
    btn.color = "white";
    btn.hoverColor = new Color3(0.5, 0.5, 0.5);
    btn.cornerRadius = 6;
    btn.thickness = 2;
    btn.paddingBottom = "2px";
    btn.margin = "4px 0";

    btn.updateMaterialOnSubsequentSynchronousUpdates = () => {
      btn.background = key === selectedClubId ? Color3.White().toString() : "transparent";
      btn.foreground = key === selectedClubId ? "black" : "white";
      btn.thickness = key === selectedClubId ? 3 : 2;
    };
    btn.onPointerDownObservable.add(() => {
      // Only allow club change when swing is IDLE (ball at rest, no swing in progress)
      if (swingMeter.getState() !== SWING_STATE.IDLE) return;
      selectedClubId = key;
      clubButtons[key].updateMaterialOnSubsequentSynchronousUpdates?.();
      CLUB_KEYS.forEach((k) => {
        if (k !== key) clubButtons[k].updateMaterialOnSubsequentSynchronousUpdates?.();
      });
    });

    clubButtons[key] = btn;
    clubPanel.addControl(btn);
  });

  // ---- Reset Button ----
  const resetPanel = new StackPanel();
  resetPanel.horizontalAlignment = 0;
  resetPanel.verticalAlignment = 0;
  resetPanel.top = "220px";
  resetPanel.width = "200px";
  gui.addControl(resetPanel);

  const resetBtn = Button.CreateSimpleButton("reset", "Reset Ball (R)");
  resetBtn.width = "100%";
  resetBtn.height = "34px";
  resetBtn.color = "white";
  resetBtn.cornerRadius = 6;
  resetBtn.margin = "8px 0";
  resetBtn.thickness = 2;
  resetBtn.paddingBottom = "2px";
  resetPanel.addControl(resetBtn);

  const resetBtn2 = Button.CreateSimpleButton("reset2", "[Space] → swing  |  [←→] aim  |  [1-3] club");
  resetBtn2.width = "100%";
  resetBtn2.height = "34px";
  resetBtn2.color = "#aaa";
  resetBtn2.isHitTestVisible = false;
  resetBtn2.cornerRadius = 6;
  resetBtn2.margin = "4px 0";
  resetBtn2.thickness = 0;
  resetPanel.addControl(resetBtn2);

  function resetBall() {
    ballLauncher.reset();

    // Zero velocities first
    ballAggregate.body.setLinearVelocity(Vector3.Zero());
    ballAggregate.body.setAngularVelocity(Vector3.Zero());

    // Allow the physics body to pick up a manual transform change
    ballAggregate.body.disablePreStep = false;

    ball.position.copyFrom(TEE_POSITION);
    ball.rotationQuaternion = Quaternion.Identity();

    // Re-enable the perf optimization after the next physics step
    scene.onAfterPhysicsObservable.addOnce(() => {
      ballAggregate.body.disablePreStep = true;
    });

    camera.target = new Vector3(TEE_POSITION.x, 0.5, TEE_POSITION.z);

  // Reset camera orientation, not just target — otherwise it keeps
    // whatever alpha it drifted to while following the last shot.
    camera.alpha = INITIAL_CAMERA_ALPHA;
    camera.beta = INITIAL_CAMERA_BETA;
    camera.radius = INITIAL_CAMERA_RADIUS;
    camera.target = new Vector3(TEE_POSITION.x, 0.5, TEE_POSITION.z);


    swingMeter.reset();
  }

  resetBtn.onPointerDownObservable.add(() => resetBall());

  // ---- Keyboard Handler ----
  scene.onKeyboardObservable.add((kbInfo) => {
    if (kbInfo.type === 0 /* KEYDOWN */) {
      // Spacebar → advance swing meter
      if (kbInfo.value === "Space") {
        kbInfo.event.preventDefault();
        swingMeter.nextStep();
      }
      // Arrow keys → adjust aim (only when swing is IDLE)
      if (kbInfo.value === "ArrowLeft" && swingMeter.getState() === SWING_STATE.IDLE) {
        camera.alpha -= 0.05;
        swingMeter.setAimAngle(swingMeter.getAimAngle() - 0.05);
      }
      if (kbInfo.value === "ArrowRight" && swingMeter.getState() === SWING_STATE.IDLE) {
        camera.alpha += 0.05;
        swingMeter.setAimAngle(swingMeter.getAimAngle() + 0.05);
      }
      // Number keys → select club (only when swing is IDLE)
      if (swingMeter.getState() === SWING_STATE.IDLE) {
        if (kbInfo.value === "Digit1") { selectedClubId = "driver"; updateClubButtons(); }
        if (kbInfo.value === "Digit2") { selectedClubId = "iron7";   updateClubButtons(); }
        if (kbInfo.value === "Digit3") { selectedClubId = "putter";  updateClubButtons(); }
      }
    }
    if (kbInfo.type === 1 /* KEYUP */) {
      if (kbInfo.value === "KeyR") resetBall();
    }
  });

  function updateClubButtons() {
    CLUB_KEYS.forEach((k) => {
      clubButtons[k].updateMaterialOnSubsequentSynchronousUpdates?.();
    });
  }

  // ---- Per-frame updates ----
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

    if (followDelayTimer > 0) followDelayTimer -= dt;

    // Update swing meter animation
    swingMeter.update(dt);

    // ---- Compute aim direction ----
    const forward = camera.getDirection(new Vector3(0, 0, 1));
    forward.y = 0;
    forward.normalize();
    // golfer position
    if (swingMeter.getState() === SWING_STATE.IDLE && !ballLauncher.isAirborne) {
        golfer.updatePosition(TEE_POSITION, forward); // stays put, only tracks aim changes
    }

    const aimAngleDeg = Math.atan2(forward.x, forward.z) * (180 / Math.PI);

    // ---- Update aim line (visible only when idle) ----
    if (swingMeter.getState() === SWING_STATE.IDLE && !ballLauncher.isAirborne) {
      updateAimLine();
      aimLine.visibility = 0.7;
    } else {
      aimLine.visibility = 0;
    }

    // ---- Ball launcher per-frame updates (Phase 1 Task 3) ----
    const speed = ballAggregate.body.getLinearVelocity()?.length() ?? 0;
    let shotStopped = false;

    // ---- Debug: log distance + speed each frame ----
    if (shotCount > 0 || ballLauncher.isAirborne) {
      const d = ballLauncher.distanceTraveled(ball.position);
      if (Math.abs(d - distanceTraveled) > 0.001) {
        console.log(`[Shot] spd=${speed.toFixed(1)} m/s | dist=${d.toFixed(1)}m | h=${ball.position.y.toFixed(2)}m | phase=${ballLauncher.phase}`);
      }
      distanceTraveled = d;
    }

    if (ballLauncher.isAirborne) {
      // Apply Magnus-effect forces and detect landing
      const { landed } = ballLauncher.updateAirborne(
        engine.getDeltaTime(),
        ball,
        ballAggregate.body,
      );
      if (landed) {
        // First frame of ground contact — count the shot
        shotCount++;
      }
    } else if (ballLauncher.phase === "rolled") {
      // Ball is rolling on the ground — check for stop
      // const { stopped } = ballLauncher.updateStopped(ball, ballAggregate.body);
      const { stopped } = ballLauncher.updateStopped(ball, ballAggregate.body, engine.getDeltaTime());
      shotStopped = stopped;
    } else if (ballLauncher.phase === null && shotCount > 0) {
      // Ball fully stopped after a shot (transitioned from rolled → null)
      // No action needed — state already updated by updateStopped
    }

    // Distance from launch position (projected onto XZ plane)
    distanceTraveled = ballLauncher.distanceTraveled(ball.position);

    // ---- Update DOM HUD ----
    const club = CLUBS_MAP[selectedClubId];
    if (domHud.club) domHud.club.textContent = club.displayName;
    if (domHud.distance) {
      domHud.distance.textContent = shotCount > 0
        ? `${distanceTraveled.toFixed(1)}m travelled`
        : "—";
    }
    if (domHud.shots) domHud.shots.textContent = `Shots: ${shotCount}`;
    if (domHud.aim) domHud.aim.textContent = `Aim: ${aimAngleDeg.toFixed(0)}°`;

    // ---- Camera follow (follow while ball is airborne or just landed) ----
    if (followDelayTimer <= 0 && (ballLauncher.isAirborne || (speed > 0.5 && !shotStopped))) {
      const currentTarget = camera.target;
      const ballWorldPos = ball.position;
      const lerpSpeed = 5 * dt;
      camera.target = Vector3.Lerp(currentTarget, ballWorldPos, lerpSpeed);
    }
  });

  // ---- Expose for debugging & later phases ----
  scene.metadata = {
    ball, ballAggregate, ground, selectedClubId, resetBall, swingMeter, camera,
    updateClubButtons, aimLine, shotCount: () => shotCount, getDistanceTraveled: () => distanceTraveled,
    ballLauncher,
  };

  return scene;
}
