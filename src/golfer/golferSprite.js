import {
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  Texture,
  DynamicTexture,
  Mesh,
} from "@babylonjs/core";
import { SWING_STATE } from "../core/swing.js";

const FRAME_COUNT = 10;
// Frame order: stance, address, takeaway, mid-backswing, top, transition,
// downswing, impact, follow-through-1, finish
const STANCE = 0, ADDRESS = 1, TAKEAWAY = 2, BACKSWING_MID = 3, TOP = 4,
  TRANSITION = 5, DOWNSWING = 6, IMPACT = 7, FOLLOW1 = 8, FINISH = 9;

/** Placeholder art (and default sideOffset sign) is drawn right-handed. */
export const HANDEDNESS = { RIGHT: "right", LEFT: "left" };

/**
 * Draws a 10-frame stick-figure golfer spritesheet on a DynamicTexture.
 * Used as a placeholder when no real art has been supplied yet — swap in a
 * real spritesheetUrl later (same FRAME_COUNT / pose order) and nothing
 * else about the module needs to change.
 */
function createPlaceholderGolferTexture(scene, cellSize) {
  const texture = new DynamicTexture(
    "golferPlaceholderTex",
    { width: cellSize * FRAME_COUNT, height: cellSize },
    scene,
    true
  );
  texture.hasAlpha = true;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, cellSize * FRAME_COUNT, cellSize);

  // Arm/club pose per frame: angle of the upper arm from the shoulder, and
  // the club shaft angle continuing from the hands. Also a slight torso
  // lean and hip shift so the sequence reads as one continuous motion.
  const poses = [
    { arm: 1.90, club: 1.90, lean: 0.00, hipShift: 0 },  // stance
    { arm: 1.95, club: 1.85, lean: 0.01, hipShift: -1 }, // address / waggle
    { arm: 2.30, club: 1.60, lean: -0.03, hipShift: -2 }, // takeaway
    { arm: 2.90, club: 1.00, lean: -0.06, hipShift: -3 }, // mid-backswing
    { arm: 3.60, club: 0.20, lean: -0.08, hipShift: -4 }, // top of backswing
    { arm: 3.30, club: 0.60, lean: -0.05, hipShift: -2 }, // transition
    { arm: 2.40, club: 1.50, lean: -0.02, hipShift: 2 },  // downswing
    { arm: 1.50, club: 1.90, lean: 0.05, hipShift: 6 },   // impact
    { arm: 0.60, club: 1.30, lean: 0.08, hipShift: 5 },   // follow-through 1
    { arm: -0.30, club: -0.90, lean: 0.10, hipShift: 4 }, // finish
  ];

  poses.forEach((pose, i) => {
    const ox = i * cellSize;
    const cx = ox + cellSize / 2 + pose.hipShift;
    const groundY = cellSize * 0.92;
    const hipY = cellSize * 0.55;
    const shoulderY = cellSize * 0.3;
    const headY = cellSize * 0.18;

    ctx.strokeStyle = "#2c2c2a";
    ctx.fillStyle = "#2c2c2a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    // Legs (planted, slight lean carried through torso/hips)
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(ox + cellSize / 2 - 12, groundY);
    ctx.moveTo(cx, hipY);
    ctx.lineTo(ox + cellSize / 2 + 12, groundY);
    ctx.stroke();

    // Torso (leans forward/back slightly by pose)
    const shoulderX = cx + pose.lean * cellSize;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(shoulderX, headY, cellSize * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Arm
    const armLen = cellSize * 0.32;
    const bx = shoulderX + Math.cos(pose.arm) * armLen;
    const by = shoulderY + Math.sin(pose.arm) * armLen;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Club shaft continuing from the hands
    const clubLen = cellSize * 0.4;
    const cxEnd = bx + Math.cos(pose.club) * clubLen;
    const cyEnd = by + Math.sin(pose.club) * clubLen;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(cxEnd, cyEnd);
    ctx.stroke();
  });

  texture.update();
  return texture;
}

/**
 * Creates a flat sprite-plane golfer standing at address (to the SIDE of
 * the ball, not behind it in the camera's line of sight — the way a real
 * golfer stands). Rotates to face the aim direction; unlike a Babylon
 * Sprite/billboard it does not always face the camera, since your camera
 * orbits during aiming.
 *
 * Position is only ever set explicitly via updatePosition() — call this
 * at address/reset, NOT every frame off a moving ball, or the golfer will
 * appear to chase the ball down the fairway.
 *
 * @param {Scene} scene
 * @param {Vector3} teePosition   - ball rest position (e.g. TEE_POSITION)
 * @param {Object} opts
 * @param {string} opts.spriteSheetUrl   - optional real spritesheet (6 frames); omit for built-in placeholder
 * @param {number} opts.width            - plane width, meters (default 1.0)
 * @param {number} opts.height           - plane height, meters (default 1.8)
 * @param {number} opts.sideOffsetMeters - distance to stand beside the ball, perpendicular to aim (default 0.6)
 * @param {number} opts.depthOffsetMeters- small backward nudge along -aimDir for a natural stance (default 0.15)
 * @param {Object} opts.stateFrameMap    - override SWING_STATE -> frame index for non-swing states
 * @param {string} opts.handedness       - HANDEDNESS.RIGHT (default) or HANDEDNESS.LEFT. Mirrors the
 *                                          sprite horizontally and flips which side of the ball it
 *                                          addresses from — matches how the placeholder art is drawn.
 *                                          If you swap in a real spritesheet drawn left-handed, pass
 *                                          the matching default and flip only for the other case.
 * @returns {{
 *   mesh: Mesh,
 *   setFrame: (index: number) => void,
 *   faceDirection: (dir: Vector3) => void,
 *   updatePosition: (teePos: Vector3, aimDir: Vector3) => void,
 *   onSwingStateChange: (state: string) => void,
 *   setHandedness: (handedness: string) => void,
 *   getHandedness: () => string,
 *   dispose: () => void
 * }}
 */
export function createGolferSprite(scene, teePosition, opts = {}) {
  const {
    spriteSheetUrl = null,
    width = 1.0,
    height = 1.8,
    sideOffsetMeters = 0.6,
    depthOffsetMeters = 0.15,
    handedness = HANDEDNESS.RIGHT,
    stateFrameMap = {
      [SWING_STATE.IDLE]: STANCE,
      [SWING_STATE.POWER_FILL]: BACKSWING_MID,
      [SWING_STATE.POWER_LOCKED]: TOP,
    },
  } = opts;

  let currentHandedness = handedness;

  const golfer = MeshBuilder.CreatePlane("golfer", { width, height }, scene);
  golfer.billboardMode = Mesh.BILLBOARDMODE_NONE; // manual rotation, not camera-facing
  // The placeholder art is drawn left-handed at baseline (no mirror).
  // RIGHT is the one that needs flipping.
  golfer.scaling.x = currentHandedness === HANDEDNESS.RIGHT ? -1 : 1;

  const cellSize = 256;
  const texture = spriteSheetUrl
    ? new Texture(spriteSheetUrl, scene)
    : createPlaceholderGolferTexture(scene, cellSize);
  texture.hasAlpha = true;
  texture.uScale = 1 / FRAME_COUNT;

  const mat = new StandardMaterial("golferMat", scene);
  mat.diffuseTexture = texture;
  mat.useAlphaFromDiffuseTexture = true;
  mat.backFaceCulling = false;
  mat.specularColor = new Color3(0, 0, 0);
  mat.emissiveColor = new Color3(1, 1, 1); // reads flat/consistent regardless of scene lighting
  golfer.material = mat;

  function setFrame(index) {
    texture.uOffset = index / FRAME_COUNT;
  }
  setFrame(STANCE);

  function faceDirection(dir) {
    golfer.rotation.y = Math.atan2(dir.x, dir.z);
  }
  faceDirection(new Vector3(0, 0, 1));

  // Only call this at address (ball resting on the tee) — never per-frame
  // off a flying/rolling ball's position, or the golfer will chase it.
  function updatePosition(teePos, aimDir) {
    const rightDir = Vector3.Cross(Vector3.Up(), aimDir).normalize();
    // Left-handed golfers (baseline art) address from one side; right-handed
    // (mirrored) address from the other.
    const sideSign = currentHandedness === HANDEDNESS.RIGHT ? -1 : 1;
    golfer.position.x = teePos.x + rightDir.x * sideOffsetMeters * sideSign - aimDir.x * depthOffsetMeters;
    golfer.position.z = teePos.z + rightDir.z * sideOffsetMeters * sideSign - aimDir.z * depthOffsetMeters;
    golfer.position.y = height / 2;
    faceDirection(aimDir);
  }

  function setHandedness(next) {
    currentHandedness = next;
    golfer.scaling.x = currentHandedness === HANDEDNESS.RIGHT ? -1 : 1;
    // Reposition immediately using the golfer's current facing as the aim direction.
    const currentAim = new Vector3(Math.sin(golfer.rotation.y), 0, Math.cos(golfer.rotation.y));
    updatePosition(teePosition, currentAim);
  }

  function getHandedness() {
    return currentHandedness;
  }

  let sequenceTimeouts = [];
  function clearSequence() {
    sequenceTimeouts.forEach(clearTimeout);
    sequenceTimeouts = [];
  }

  /**
   * Drives the sprite off the swing meter's state machine. IDLE / POWER_FILL /
   * POWER_LOCKED map to single held frames. SWING_COMPLETE plays the full
   * transition -> downswing -> impact -> follow-through -> finish sequence
   * rather than jumping straight to one frame, so all ten frames get used.
   */
  function onSwingStateChange(state) {
    clearSequence();
    if (state === SWING_STATE.SWING_COMPLETE) {
      setFrame(TRANSITION);
      sequenceTimeouts.push(setTimeout(() => setFrame(DOWNSWING), 60));
      sequenceTimeouts.push(setTimeout(() => setFrame(IMPACT), 130));
      sequenceTimeouts.push(setTimeout(() => setFrame(FOLLOW1), 220));
      sequenceTimeouts.push(setTimeout(() => setFrame(FINISH), 320));
      return;
    }
    const frame = stateFrameMap[state];
    if (frame !== undefined) setFrame(frame);
  }

  function dispose() {
    clearSequence();
    golfer.dispose();
    mat.dispose();
    texture.dispose();
  }

  return {
    mesh: golfer,
    setFrame,
    faceDirection,
    updatePosition,
    onSwingStateChange,
    setHandedness,
    getHandedness,
    dispose,
  };
}
