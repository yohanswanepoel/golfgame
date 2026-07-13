// =============================================================================
// Ball Launch System — Swing result → Havok velocity + flight physics
// =============================================================================
// Handles:
//   • Computing launch velocity from swing result + club stats + aim direction
//   • Magnus-effect lift / curve during airborne phase
//   • Putter special-case (ground roll only, no airborne phase)
//   • Landing detection → transition to rolling
//   • Velocity snap-to-zero when the ball has stopped
// =============================================================================

import { Vector3 } from "@babylonjs/core";
import { FLIGHT, BALL, PHYSICS } from "./constants.js";
import { getClubById } from "./clubs.js";


/**
 * Ball launcher state — tracks flight phase so the driving-range scene
 * can call updateAirborne() / updateStopped() each frame.
 */
export class BallLauncher {
  /**
   * @param {number} [stopThreshold] — override FLIGHT.STOP_VELOCITY_THRESHOLD
   */
  constructor(stopThreshold) {
    /** @type {'airborne'|'rolled'|null} */
    this._phase = null;
    /** @type {Vector3|null} */
    this._launchPos = null;
    /** @type {number} — backspin magnitude (for Magnus lift) */
    this._backspinMagnitude = 0;
    /** @type {number} — sidespin magnitude (for Magnus curve) */
    this._sidespinMagnitude = 0;
    /** @type {number} — sidespin sign: +1 = slice (curve right), -1 = hook (curve left) */
    this._sidespinSign = 0;
    this._stopThreshold = stopThreshold ?? FLIGHT.STOP_VELOCITY_THRESHOLD;
    /** @type {string|null} — club id used for this shot */
    this._shotClub = null;
  }

  /* ── Public getters ───────────────────────────────────────────────── */

  /** Phase: 'airborne', 'rolled', or null */
  get phase() {
    return this._phase;
  }

  /** True if the ball is currently airborne. */
  get isAirborne() {
    return this._phase === "airborne";
  }

  /** Launch position in world space (set on launch). */
  get launchPosition() {
    return this._launchPos;
  }

  /** Club id used for the current shot (set on launch). */
  get shotClub() {
    return this._shotClub;
  }

  /** Backspin magnitude from the current shot. */
  get backspin() {
    return this._backspinMagnitude;
  }

  /** Sidespin magnitude from the current shot. */
  get sidespin() {
    return this._sidespinMagnitude;
  }

  /**
   * Launch the ball — called when the swing meter fires onSwingComplete.
   *
   * @param {object} result — from swingMeter._calculateResult()
   * @param {import("@babylonjs/core").Mesh} ball — the ball mesh
   * @param {any} ballBody — Havok physics body (from PhysicsAggregate)
   * @param {Vector3} aimDirection — unit vector the camera is facing
   *   (projected onto the XZ plane; the base direction for the shot)
   */
  launch(result, ball, ballBody, aimDirection) {
    const { launchParams } = result;
    const club = getClubById(result.club);

    // Zero any residual state first
    ballBody.setAngularVelocity(new Vector3(0, 0, 0));
    ballBody.setLinearVelocity(new Vector3(0, 0, 0));

    // ---- Compute launch velocity vector ----
    const { speed, launchAngle, horizontalDeviation } = launchParams;
    const launchAngleRad = (launchAngle * Math.PI) / 180;

    // Horizontal aim direction rotated by the accuracy deviation
    const deviationRad = (horizontalDeviation * Math.PI) / 180;
    const cosD = Math.cos(deviationRad);
    const sinD = Math.sin(deviationRad);
    // Rotate aimDirection by deviationRad around the Y axis
    const horizDir = new Vector3(
      aimDirection.x * cosD - aimDirection.z * sinD,
      0,
      aimDirection.x * sinD + aimDirection.z * cosD,
    );
    horizDir.normalize();

    // Horizontal speed = speed * cos(launchAngle)
    // Vertical speed = speed * sin(launchAngle)
    const horizSpeed = speed * Math.cos(launchAngleRad);
    const vertSpeed = speed * Math.sin(launchAngleRad);

    const velocity = new Vector3(
      horizDir.x * horizSpeed,
      vertSpeed,
      horizDir.z * horizSpeed,
    );

    ballBody.setLinearVelocity(velocity);

    // ---- Spin magnitude (for Magnus effect) ----
    // Backspin: proportional to speed * spinFactor (always positive → backspin)
    // this._backspinMagnitude = speed * club.spinFactor;
    const MAX_BACKSPIN = 120; // tune to taste, rpm-equivalent in your unit system
    //this._backspinMagnitude = Math.min(Math.sqrt(speed) * club.spinFactor, MAX_BACKSPIN);
    this._backspinMagnitude = Math.min(
        Math.sqrt(speed) * club.spinFactor,
        club.maxBackspin ?? FLIGHT.MAX_BACKSPIN_DEFAULT, // fallback if a club doesn't define one
      );
    //this._backspinMagnitude = Math.sqrt(speed) * club.spinFactor;
    // Sidespin magnitude: proportional to accuracy deviation and speed
    this._sidespinMagnitude =
      Math.abs(horizontalDeviation / 90) * speed * club.spinFactor;
    // Sidespin sign: positive = slice (curve right), negative = hook (curve left)
    this._sidespinSign = horizontalDeviation >= 0 ? 1 : -1;

    // ---- Phase tracking ----
    this._shotClub = club.id;
    this._launchPos = ball.position.clone();
    this._phase = "airborne";

    return this;
  }

  /**
   * Launch as a putter — purely horizontal, never airborne.
   *
   * @param {object} result — from swingMeter._calculateResult() (putter mode)
   * @param {import("@babylonjs/core").Mesh} ball
   * @param {any} ballBody — Havok physics body
   * @param {Vector3} aimDirection — unit vector along the XZ plane
   */
  launchPutter(result, ball, ballBody, aimDirection) {
    const { launchParams } = result;
    const club = getClubById(result.club);
    const speed = launchParams.speed;

    // Zero any residual state
    ballBody.setAngularVelocity(new Vector3(0, 0, 0));
    ballBody.setLinearVelocity(new Vector3(0, 0, 0));

    // Purely horizontal velocity — no vertical component
    aimDirection.normalize();
    const velocity = new Vector3(
      aimDirection.x * speed,
      0,
      aimDirection.z * speed,
    );

    ballBody.setLinearVelocity(velocity);

    // Putter: no spin, no airborne phase
    this._backspinMagnitude = 0;
    this._sidespinMagnitude = 0;
    this._sidespinSign = 0;
    this._shotClub = club.id;
    this._launchPos = ball.position.clone();
    this._phase = "rolled";

    return this;
  }

  /**
   * Per-frame update while the ball is airborne.
   * Applies Magnus-effect lift/curve forces and detects landing.
   *
   * @param {number} dt — delta time in milliseconds
   * @param {import("@babylonjs/core").Mesh} ball
   * @param {any} ballBody — Havok physics body
   * @returns {{ landed: boolean }}
   */
  updateAirborne(dt, ball, ballBody) {
    if (this._phase !== "airborne") return { landed: false };

    const dT = dt / 1000; // convert ms → s

    // ---- Current velocity ----
    const vel = ballBody.getLinearVelocity();
    const currentSpeed = vel.length();

    // Skip aerodynamic forces if the ball is barely moving
    if (currentSpeed > 0.01) {
      // ---- Lift (Magnus effect from backspin) ----
      // Lift acts upward, proportional to current speed and backspin
      const liftMag = this._backspinMagnitude * FLIGHT.LIFT_CONST * currentSpeed * dT;
      const maxLift = PHYSICS.gravity * BALL.mass * 0.9 * dT; // never exceed 90% of gravity's pull
      const clampedLiftMag = Math.min(liftMag, Math.abs(maxLift));
      const liftForce = new Vector3(0, 1, 0).scale(clampedLiftMag);
      ballBody.applyForce(liftForce, ball.position);

      // ---- Curve (Magnus effect from sidespin) ----
      // Curve acts horizontally, perpendicular to the direction of travel.
      // For a right-handed golfer:
      //   positive accuracy = slice/push → curve to the right
      //   negative accuracy = hook/pull → curve to the left
      // The perpendicular to horizontal velocity is (-vz, 0, vx).
      //   For travel in +Z, (-vz, 0, vx) = (-positive, 0, 0) = -X (left).
      //   We multiply by _sidespinSign to flip direction for slice/hook.
      const curveMag = this._sidespinMagnitude * FLIGHT.CURVE_CONST * currentSpeed * dT;
      const curveStrength = curveMag;

      // ---- Debug logging (every 30 frames) ----
      if (!this._frameCount) this._frameCount = 0;
      this._frameCount++;
      if (this._frameCount % 30 === 0) {
        const totalForce = liftMag + curveMag;
        const horizSpd = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        // console.log(
        //   `[BallFlight] spd=${currentSpeed.toFixed(1)} m/s (horiz=${horizSpd.toFixed(1)}) ` +
        //   `| lift=${liftMag.toFixed(4)} curve=${curveMag.toFixed(4)} total=${totalForce.toFixed(4)} ` +
        //   `| liftConst=${FLIGHT.LIFT_CONST} curveConst=${FLIGHT.CURVE_CONST} ` +
        //   `| backspin=${this._backspinMagnitude.toFixed(1)} sidespin=${this._sidespinMagnitude.toFixed(1)} ` +
        //   `| pos=(${ball.position.x.toFixed(1)},${ball.position.y.toFixed(2)},${ball.position.z.toFixed(1)})`,
        // );
      }
      const horizVelX = vel.x;
      const horizVelZ = vel.z;
      const horizLen =
        Math.sqrt(horizVelX * horizVelX + horizVelZ * horizVelZ);
      if (horizLen > 0.001) {
        // Perpendicular to horizontal velocity
        const curveDir = new Vector3(
          -horizVelZ / horizLen,
          0,
          horizVelX / horizLen,
        );
        // Flip sign based on slice (right) vs hook (left)
        const curveForce = curveDir.scale(curveStrength * this._sidespinSign);
        ballBody.applyForce(curveForce, ball.position);
      }

      // ---- Drag (air resistance) ----
      // Quadratic drag opposing the direction of motion.
      // F_drag = -v̂ * DRAG_CONST * speed² = -v * DRAG_CONST * speed
      const dragMag = FLIGHT.DRAG_CONST * currentSpeed * currentSpeed * dT;
      const dragForce = vel.scale(-dragMag / currentSpeed);
      ballBody.applyForce(dragForce, ball.position);
    }

    // ---- Landing detection ----
    // The ball lands when it's near the ground (y ≈ radius) and descending.
    const ballY = ball.position.y;
    const ballRadius = BALL.diameterMeters / 2;
    const groundY = ballRadius; // ground is at y=0, ball centre at y=radius

    if (vel.y < -0.05 && ballY <= groundY + 0.01) {
      this._phase = "rolled";
      // Snap ball to ground
      ball.position.y = groundY;
      // Remove vertical velocity on impact
      ballBody.setLinearVelocity(new Vector3(vel.x, 0, vel.z));
      return { landed: true };
    }

    return { landed: false };
  }

  /**
   * Per-frame update for the rolled phase.
   * Stops the ball when speed drops below threshold.
   *
   * @param {import("@babylonjs/core").Mesh} ball
   * @param {any} ballBody — Havok physics body
   * @returns {{ stopped: boolean }}
   */
   updateStopped(ball, ballBody, dt) {
     if (this._phase !== "rolled") return { stopped: false };

     const dT = dt / 1000; // ms → s
     const vel = ballBody.getLinearVelocity();
     const horizSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

     if (horizSpeed < this._stopThreshold) {
       ballBody.setLinearVelocity(new Vector3(0, 0, 0));
       ballBody.setAngularVelocity(new Vector3(0, 0, 0));
       ball.position.y = BALL.diameterMeters / 2;
       this._phase = null;
       return { stopped: true };
     }

     // Explicit deceleration — independent of Havok contact/friction reliability
     const decel = FLIGHT.ROLL_DECEL * dT;
     const newSpeed = Math.max(0, horizSpeed - decel);
     const scale = horizSpeed > 0 ? newSpeed / horizSpeed : 0;
     ballBody.setLinearVelocity(new Vector3(vel.x * scale, vel.y, vel.z * scale));

     return { stopped: false };
   }

  /**
   * Called when the ball is reset — clears all flight state.
   */
  reset() {
    this._phase = null;
    this._launchPos = null;
    this._backspinMagnitude = 0;
    this._sidespinMagnitude = 0;
    this._sidespinSign = 0;
  }

  /* ── Debug / inspection helpers ------------------------------------ */

  /** Get current speed from the ball body. */
  getCurrentSpeed(ballBody) {
    const vel = ballBody.getLinearVelocity();
    return vel ? vel.length() : 0;
  }

  /**
   * Distance traveled from launch position (projected onto XZ plane).
   */
  distanceTraveled(currentPos) {
    if (!this._launchPos) return 0;
    const dx = currentPos.x - this._launchPos.x;
    const dz = currentPos.z - this._launchPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}

/**
 * Factory: creates a BallLauncher instance.
 */
export function createBallLauncher(stopThreshold) {
  return new BallLauncher(stopThreshold);
}
