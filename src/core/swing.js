import { SWING, DISTANCE_TO_VELOCITY_CONST } from "./constants.js";
import { CLUBS, CLUB_KEYS } from "./clubs.js";

/**
 * Swing meter states.
 *
 * Flow: IDLE → POWER_FILL → POWER_LOCKED → SWING_COMPLETE
 *
 * IDLE             — waiting for player to start
 * POWER_FILL       — power bar fills; SPACE/click to lock
 * POWER_LOCKED     — power locked, accuracy marker sweeps; SPACE/click to lock
 * SWING_COMPLETE   — swing done; result delivered via onSwingComplete
 */
export const SWING_STATE = Object.freeze({
  IDLE: "idle",
  POWER_FILL: "power_fill",
  POWER_LOCKED: "power_locked",
  SWING_COMPLETE: "swing_complete",
});

/**
 * Swing meter — pure DOM overlay, no Babylon GUI dependency.
 *
 * Usage:
 *   const meter = createSwingMeter(scene, {
 *     onSwingComplete(result) { /* launch ball *\/ },
 *     onStateChange({ state }) { /* detach camera etc *\/ },
 *     getSelectedClubId: () => selectedClubId,
 *   });
 *   // then in your render loop:
 *   meter.update(dt);
 *   // on input:
 *   meter.nextStep();
 */
export class SwingMeter {
  constructor(scene, { onSwingComplete, onStateChange, getSelectedClubId } = {}) {
    this._scene = scene;
    this._onSwingComplete = onSwingComplete;
    this._onStateChange = onStateChange;
    this._getSelectedClubId = getSelectedClubId;

    this._state = SWING_STATE.IDLE;
    this._power = 0;
    this._accuracy = 0;
    this._aimAngle = 0;
    this._container = null;
    this._startTime = 0;
    this._clickHandler = null;

    this._createDOM();
  }

  /* ── DOM creation / removal ──────────────────────────────────────── */

  _createDOM() {
    const canvas = this._scene?.getEngine()?.getRenderingCanvas();
    const parent = canvas?.parentElement ?? document.body;

    // Outer container fills the canvas
    this._container = document.createElement("div");
    this._container.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;";

    // Inner panel holds the meter UI
    this._panel = document.createElement("div");
    this._panel.style.cssText =
      "position:absolute;bottom:20px;left:50%;transform:translateX(-50%);" +
      "background:rgba(0,0,0,.85);color:#fff;padding:16px 24px;border-radius:8px;" +
      "font-family:monospace;text-align:center;pointer-events:none;user-select:none;" +
      "min-width:220px;";

    // --- Instructions ---
    this._elInst = document.createElement("div");
    this._elInst.style.cssText = "margin-bottom:10px;font-size:14px;";
    this._panel.appendChild(this._elInst);

    // --- Power bar ---
    this._elPowerSec = document.createElement("div");
    this._elPowerSec.style.cssText = "margin-bottom:8px;display:none;";

    const pLbl = document.createElement("div");
    pLbl.textContent = "POWER";
    pLbl.style.cssText = "font-size:12px;margin-bottom:4px;";

    const pBar = document.createElement("div");
    pBar.style.cssText = "width:200px;height:20px;background:#333;border-radius:4px;overflow:hidden;";

    this._elPowerFill = document.createElement("div");
    this._elPowerFill.style.cssText =
      "width:0%;height:100%;background:linear-gradient(90deg,#4CAF50,#FFEB3B,#F44336);";

    pBar.appendChild(this._elPowerFill);
    this._elPowerSec.append(pLbl, pBar);
    this._panel.appendChild(this._elPowerSec);

    // --- Accuracy bar ---
    this._elAccSec = document.createElement("div");
    this._elAccSec.style.cssText = "margin-bottom:8px;display:none;";

    const aLbl = document.createElement("div");
    aLbl.textContent = "ACCURACY";
    aLbl.style.cssText = "font-size:12px;margin-bottom:4px;";

    const aBar = document.createElement("div");
    aBar.style.cssText = "width:200px;height:20px;background:#333;border-radius:4px;position:relative;";

    const sweetSpot = document.createElement("div");
    sweetSpot.style.cssText =
      "position:absolute;left:50%;top:0;width:2px;height:100%;background:rgba(255,255,255,.5);";

    this._elAccMarker = document.createElement("div");
    this._elAccMarker.style.cssText =
      "position:absolute;left:50%;top:0;width:12px;height:100%;background:#2196F3;border-radius:4px;transform:translateX(-50%);";

    aBar.append(sweetSpot, this._elAccMarker);
    this._elAccSec.append(aLbl, aBar);
    this._panel.appendChild(this._elAccSec);

    // --- Result text ---
    this._elResult = document.createElement("div");
    this._elResult.style.cssText = "font-size:12px;color:#aaa;min-height:16px;";
    this._panel.appendChild(this._elResult);

    this._container.appendChild(this._panel);
    parent.appendChild(this._container);

    // Click on the panel advances the swing (only during POWER_FILL / POWER_LOCKED)
    this._clickHandler = () => {
      if (
        this._state === SWING_STATE.POWER_FILL ||
        this._state === SWING_STATE.POWER_LOCKED
      ) {
        this.nextStep();
      }
    };
    this._panel.addEventListener("click", this._clickHandler);

    this._updateUI();
  }

  _removeDOM() {
    this._panel?.removeEventListener("click", this._clickHandler);
    this._container?.remove();
    this._container = null;
    this._panel = null;
  }

  /* ── UI refresh ──────────────────────────────────────────────────── */

  _updateUI() {
    if (!this._container) return;

    const showPower =
      this._state === SWING_STATE.POWER_FILL ||
      this._state === SWING_STATE.POWER_LOCKED;
    const showAcc = this._state === SWING_STATE.POWER_LOCKED;
    const isActive = showPower || showAcc;

    // Panel is interactive only during active states
    this._panel.style.pointerEvents = isActive ? "auto" : "none";

    this._elPowerSec.style.display = showPower ? "block" : "none";
    this._elAccSec.style.display = showAcc ? "block" : "none";

    if (this._state === SWING_STATE.POWER_FILL) {
      this._elInst.textContent = "Click or SPACE to lock power";
      this._elPowerFill.style.width = `${this._power * 100}%`;
      this._elResult.textContent = `Power: ${(this._power * 100).toFixed(0)}%`;
    } else if (this._state === SWING_STATE.POWER_LOCKED) {
      this._elInst.textContent = "Click or SPACE to lock accuracy";
      // Power bar stays at the locked value
      this._elPowerFill.style.width = `${this._power * 100}%`;
      // Accuracy marker sweeps
      const markerLeft = ((this._accuracy + 1) / 2) * 100;
      this._elAccMarker.style.left = `${Math.max(0, Math.min(100, markerLeft))}%`;
      this._elResult.textContent = `Accuracy: ${(this._accuracy * 100).toFixed(0)}%`;
    } else if (this._state === SWING_STATE.SWING_COMPLETE) {
      this._elInst.textContent = "Shot fired!";
      this._elResult.textContent =
        `Power: ${(this._power * 100).toFixed(0)}%  Accuracy: ${(this._accuracy * 100).toFixed(0)}%`;
    } else {
      // IDLE
      this._elInst.textContent = "Press SPACE to start swing";
      const club = this._getClub();
      this._elResult.textContent = `Club: ${club.displayName}`;
    }
  }

  /* ── State machine ───────────────────────────────────────────────── */

  nextStep() {
    const oldState = this._state;

    if (this._state === SWING_STATE.IDLE) {
      // Start the power phase
      this._state = SWING_STATE.POWER_FILL;
      this._startTime = performance.now();
    } else if (this._state === SWING_STATE.POWER_FILL) {
      // Lock power, start accuracy phase
      this._power = Math.max(0, Math.min(1, this._power));
      this._state = SWING_STATE.POWER_LOCKED;
      this._startTime = performance.now();
    } else if (this._state === SWING_STATE.POWER_LOCKED) {
      // Lock accuracy, fire
      this._accuracy = Math.max(-1, Math.min(1, this._accuracy));
      this._state = SWING_STATE.SWING_COMPLETE;
      const result = this._calculateResult();
      this._onSwingComplete?.(result);
      // Hide meter after a brief delay so player can see the result
      setTimeout(() => this._removeDOM(), 1500);
    }

    // Notify state change (only when actually changed)
    if (this._state !== oldState) {
      this._onStateChange?.({ state: this._state });
    }
  }

  /** Animation loop — called every frame from the Babylon scene loop. */
  update(dt) {
    // dt is unused; DOM animation uses performance.now()
    // Kept for API compatibility with Babylon onBeforeRenderObservable

    if (this._state === SWING_STATE.POWER_FILL) {
      const elapsed = (performance.now() - this._startTime) / 1000;
      const progress = (elapsed % SWING.powerCycleTime) / SWING.powerCycleTime;
      this._power = progress;
    } else if (this._state === SWING_STATE.POWER_LOCKED) {
      const elapsed = (performance.now() - this._startTime) / 1000;
      const progress = (elapsed % SWING.accuracyCycleTime) / SWING.accuracyCycleTime;
      this._accuracy = progress * 2 - 1; // maps 0→1 to -1→1
    }

    this._updateUI();
  }

  /* ── Result calculation ──────────────────────────────────────────── */

  _getClub() {
    const key = this._getSelectedClubId?.() ?? "driver";
    return CLUBS.find((c) => c.id === key) || CLUBS[0];
  }

  _calculateResult() {
    const club = this._getClub();
    const speed = club.maxDistance * this._power * DISTANCE_TO_VELOCITY_CONST;
    const horizontalDeviation = this._accuracy * SWING.maxDeviationDegrees;

    if (club.id === "putter") {
      return {
        power: this._power,
        accuracy: 0,
        club: this._getSelectedClubId?.() ?? "putter",
        aimAngle: this._aimAngle,
        launchParams: {
          speed:
            club.maxDistance *
            this._power *
            DISTANCE_TO_VELOCITY_CONST *
            SWING.putterPowerScale,
          launchAngle: 0,
          horizontalDeviation: 0,
          spinFactor: 0,
        },
      };
    }

    return {
      power: this._power,
      accuracy: this._accuracy,
      club: this._getSelectedClubId?.() ?? club.id,
      aimAngle: this._aimAngle,
      launchParams: {
        speed,
        launchAngle: club.launchAngleDeg,
        horizontalDeviation,
        spinFactor: club.spinFactor,
        lift: SWING.liftConst,
        curve: SWING.curveConst * Math.abs(this._accuracy),
      },
    };
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  getState() {
    return this._state;
  }
  getPower() {
    return this._power;
  }
  getAccuracy() {
    return this._accuracy;
  }
  getAimAngle() {
    return this._aimAngle;
  }
  setAimAngle(a) {
    this._aimAngle = a;
  }

  reset() {
    const oldState = this._state;
    this._removeDOM();
    this._state = SWING_STATE.IDLE;
    this._power = 0;
    this._accuracy = 0;
    this._startTime = 0;
    this._createDOM();
    if (oldState !== this._state) {
      this._onStateChange?.({ state: this._state });
    }
  }
}

/**
 * Factory: create a swing meter tied to a Babylon scene.
 * The meter renders as a DOM overlay (no Babylon GUI dependency).
 */
export function createSwingMeter(scene, options) {
  return new SwingMeter(scene, options);
}
