// =============================================================================
// Constants — Swing timing, flight physics, and tuning parameters
// =============================================================================
// All tuning constants live here so they can be adjusted empirically without
// hunting through logic code.  Values are placeholders to be refined during
// playtesting.
// =============================================================================

/**
 * powerCycleTime       — seconds for the power bar to complete one full loop.
 * accuracyCycleTime    — seconds for the accuracy marker to sweep full range.
 */
export const SWING = {
  powerCycleTime: 1,
  accuracyCycleTime: 2,
  maxDeviationDegrees: 10,
  putterPowerScale: 0.1,
  liftConst: 0.02,
  curveConst: 0.015,
};

/** @type {{
 *   LIFT_CONST: number;
 *   CURVE_CONST: number;
 *   DISTANCE_TO_VELOCITY_CONST: number;
 *   STOP_VELOCITY_THRESHOLD: number;
 * }}
 *
 * LIFT_CONST                 — vertical lift force multiplier applied per
 *                              physics tick while the ball is airborne.
 *                              Start near zero, increase until the ball stays
 *                              airborne a realistic distance.
 *
 * CURVE_CONST                — horizontal curve (Magnus / sidespin) force
 *                              multiplier per tick while airborne.
 *
 * DISTANCE_TO_VELOCITY_CONST — scales "distance units" into initial launch
 *                              velocity.  Tune empirically so that 100 %
 *                              power driver ≈ maxDistance for the club.
 *
 * STOP_VELOCITY_THRESHOLD    — linear velocity below which rolling is
 *                              snapped to zero to prevent micro-creep.
 */
export const FLIGHT = {
  LIFT_CONST: 0.0001,
  CURVE_CONST: 0.015,
  DRAG_CONST: 0.01, // air resistance — quadratic drag opposing motion
  DISTANCE_TO_VELOCITY_CONST: 0.35,
  STOP_VELOCITY_THRESHOLD: 0.14, // how fast to stop 0.15
};

export const DISTANCE_TO_VELOCITY_CONST = FLIGHT.DISTANCE_TO_VELOCITY_CONST;

// ---- Club re-exports (from clubs.js) ----
import { CLUBS as CLUBS_ARRAY, CLUB_KEYS as CLUB_KEYS_ARRAY } from './clubs.js';
export const CLUBS = CLUBS_ARRAY;
export const CLUB_KEYS = CLUB_KEYS_ARRAY;
export const CLUBS_MAP = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

// ---- Physics constants ----
export const PHYSICS = {
  gravity: -9.81,
};

// ---- Ball definition ----
export const BALL = {
  diameterMeters: 0.12,
  mass: 0.045,
  restitution: 0.45,
  friction: 0.7,
  linearDamping: 0.37,
  angularDamping: 2, // slow rolling ball down by increasing this
};

// ---- Ground definition ----
//
// fairway: { friction: 0.35, restitution: 0.35 },
// restitution bounce
export const GROUND = {
  fairway: { friction: 0.4,  restitution: 0.6,  combine: "MULTIPLY" },
  green:   { friction: 0.55, restitution: 0.15, combine: "MULTIPLY" },
  rough:   { friction: 0.8,  restitution: 0.05, combine: "MULTIPLY" },
  bunker:  { friction: 1.0,  restitution: 0.0,  combine: "MULTIPLY" },
};
