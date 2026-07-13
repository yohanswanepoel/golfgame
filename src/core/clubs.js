// =============================================================================
// Club Definitions — Launch parameters for each club
// =============================================================================
// Each club defines base stats that modulate how the ball launches.
// Values are placeholders to be refined during playtesting.
// =============================================================================

/**
 * @typedef {Object} ClubDef
 * @property {string} id — unique club identifier (e.g. "driver").
 * @property {string} displayName — human-readable name shown in HUD / UI.
 * @property {number} launchVelocityMultiplier — base velocity multiplier for
 *   launches.  Scaled by swing power and DISTANCE_TO_VELOCITY_CONST.
 * @property {number} launchAngleDeg — launch angle in degrees.  Putter is 0
 *   (never airborne).
 * @property {number} spinFactor — factor applied to backspin.  Higher = more
 *   lift / curve response.
 * @property {boolean} isAirborneCapable — true if the club can launch the
 *   ball into the air.  Putter is false.
 */

/** @type {ClubDef[]} */
export const CLUBS = [
  {
    id: "driver",
    displayName: "Driver",
    maxDistance: 550, // 270 meters
    maxBackspin: 90,
    spinFactor: 2.5,
    launchVelocityMultiplier: 1.5,
    launchAngleDeg: 11,
    isAirborneCapable: true,
  },
  {
    id: "wood3",
    displayName: "3-Wood",
    maxDistance: 480,  // 240 meters
    maxBackspin: 98,
    spinFactor: 2.9,
    launchVelocityMultiplier: 1.36,
    launchAngleDeg: 13,
    isAirborneCapable: true,
  },
  {
    id: "wood5",
    displayName: "5-Wood",
    maxDistance: 425,  // 220 meters
    maxBackspin: 107,
    spinFactor: 3.3,
    launchVelocityMultiplier: 1.22,
    launchAngleDeg: 15,
    isAirborneCapable: true,
  },
  {
    id: "iron4",
    displayName: "4-Iron",
    maxDistance: 370,  // 195 meters
    maxBackspin: 115,
    spinFactor: 3.8,
    launchVelocityMultiplier: 1.08,
    launchAngleDeg: 18,
    isAirborneCapable: true,
  },
  {
    id: "iron5",
    displayName: "5-Iron",
    maxDistance: 340,  // 185 meters
    maxBackspin: 123,
    spinFactor: 4.2,
    launchVelocityMultiplier: 0.93,
    launchAngleDeg: 20,
    isAirborneCapable: true,
  },
  {
    id: "iron6",
    displayName: "6-Iron",
    maxDistance: 305,  // 170 meters
    maxBackspin: 132,
    spinFactor: 4.6,
    launchVelocityMultiplier: 0.79,
    launchAngleDeg: 22,
    isAirborneCapable: true,
  },
  {
    id: "iron7",
    displayName: "7-Iron",
    maxDistance: 270,  // 155 meters
    maxBackspin: 140,
    spinFactor: 5.0,
    launchVelocityMultiplier: 0.65,
    launchAngleDeg: 24,
    isAirborneCapable: true,
  },
  {
    id: "iron8",
    displayName: "8-Iron",
    maxDistance: 245,  // 140 meters
    maxBackspin: 148,
    spinFactor: 5.4,
    launchVelocityMultiplier: 0.55,
    launchAngleDeg: 27,
    isAirborneCapable: true,
  },
  {
    id: "iron9",
    displayName: "9-Iron",
    maxDistance: 215,  // 125 meters
    maxBackspin: 157,
    spinFactor: 5.8,
    launchVelocityMultiplier: 0.48,
    launchAngleDeg: 30,
    isAirborneCapable: true,
  },
  {
    id: "wedgeP",
    displayName: "Pitching Wedge",
    maxDistance: 205,  // 110 meters
    maxBackspin: 165,
    spinFactor: 6.3,
    launchVelocityMultiplier: 0.40,
    launchAngleDeg: 34,
    isAirborneCapable: true,
  },
  {
    id: "wedgeS",
    displayName: "Sand Wedge",
    maxDistance: 170,  // 85 meters
    maxBackspin: 175,
    spinFactor: 6.7,
    launchVelocityMultiplier: 0.32,
    launchAngleDeg: 40,
    isAirborneCapable: true,
  },
  {
    id: "putter",
    displayName: "Putter",
    maxDistance: 600, // 30 meters
    launchVelocityMultiplier: 0.12,
    launchAngleDeg: 0,
    spinFactor: 0,
    isAirborneCapable: false,
  },
];

export const CLUB_KEYS = CLUBS.map((c) => c.id);

/**
 * Look up a club definition by id.
 * @param {string} id
 * @returns {ClubDef}
 */
export function getClubById(id) {
  const club = CLUBS.find((c) => c.id === id);
  if (!club) {
    throw new Error(`Unknown club: ${id}`);
  }
  return club;
}
