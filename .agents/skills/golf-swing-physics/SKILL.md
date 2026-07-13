---
name: golf-swing-physics
description: Domain logic for the swing meter input system and resulting ball flight physics (power/accuracy clicks, launch velocity, Magnus-effect curve, landing/roll transitions, putting). Use this whenever implementing or modifying the swing mechanic, club stats, ball launch behavior, or ball flight/roll/curve, especially during Phase 1 of the roadmap. Also use when tuning swing "feel."
---

# Golf Swing & Ball Flight Physics


Domain logic for the swing input system and resulting ball flight.
This is the classic "Nicklaus/Leaderboard-style" three-click swing meter.
Assumes Babylon.js + Havok physics are already set up (see project-structure.md).

## 1. The Swing Meter (input model)

Three-stage click system, driven by a single timer/oscillator:

1. **Backswing (Power):** A bar fills 0→100% on a loop (or once, your
   choice). Player clicks to lock in **power %**.
2. **Downswing (Accuracy):** A marker sweeps back down toward a center
   "sweet spot" line. Player clicks again to lock in **accuracy offset**
   — how far from center, and which side (left = hook/pull, right =
   slice/push, for a right-handed swing).
3. Optionally, a **third click** for backspin/topspin bias (advanced —
   skip this for Phase 1, add later if desired).

Keep the meter's timing tunable via constants, not magic numbers baked
into the update loop — you WILL need to retune feel repeatedly.

```
swingResult = {
  power: 0.0–1.0,        // from click 1 timing
  accuracy: -1.0–1.0,    // from click 2 timing, 0 = perfect center
  spin: -1.0–1.0         // optional, from click 3
}
```

## 2. Translating Input → Launch Parameters

Each club defines base stats:

```js
const CLUBS = {
  driver:  { maxDistance: 230, launchAngle: 11, spinFactor: 1.0 },
  iron7:   { maxDistance: 140, launchAngle: 24, spinFactor: 0.7 },
  putter:  { maxDistance: 0,   launchAngle: 0,  spinFactor: 0 }, // handled separately, see below
};
```

Launch velocity magnitude:
```
speed = club.maxDistance * power * DISTANCE_TO_VELOCITY_CONST
```
(`DISTANCE_TO_VELOCITY_CONST` is a tuning constant you'll dial in
empirically by testing — don't try to derive it analytically, just
iterate until 100% power driver ≈ club.maxDistance yards in practice.)

Launch direction: start from the aim direction (camera/player-set), then
rotate by an angle derived from `accuracy`:
```
maxDeviationDegrees = 15 // tune this — how far off-center a bad swing can go
horizontalDeviation = accuracy * maxDeviationDegrees
```

Curve during flight (hook/slice) comes from applying a small sideways
force proportional to `accuracy` each physics tick while airborne — NOT
from just changing the initial launch angle. A ball that curves *during*
flight looks and feels far more like real golf than one that just
launches slightly off-line straight. See Section 4.

## 3. Applying to the Havok Rigid Body

On swing release:
```js
const velocity = direction.scale(speed);
velocity.y += Math.sin(degToRad(club.launchAngle)) * speed * VERTICAL_LAUNCH_SCALE;
ballBody.setLinearVelocity(velocity);
```

Don't forget to zero out any residual velocity/angular velocity on the
ball before a new swing — leftover state from the previous shot is a
common bug source.

## 4. Simplified Aerodynamics (Magnus effect)

Real ball flight curves because of backspin (lift) and sidespin (hook/
slice). You don't need a real aerodynamics simulator — approximate it:

Each physics tick while the ball is airborne, apply a small extra force:
```js
// backspin -> lift (keeps ball airborne longer, classic "high draw" feel)
const lift = up.scale(backspinAmount * LIFT_CONST * currentSpeed);

// sidespin -> curve
const curve = right.scale(accuracy * CURVE_CONST * currentSpeed);

ballBody.applyForce(lift.add(curve), ballBody.getPosition());
```
Tune `LIFT_CONST` and `CURVE_CONST` empirically — start near zero and
increase until the curve is visible but not cartoonish. This effect
should taper off as the ball loses speed, or you'll get physically
nonsensical late-flight curving.

## 5. Landing & Roll-out

Once the ball's vertical velocity crosses near-zero after a bounce (or
after N bounces), transition to "rolling" behavior:

- Apply surface-specific friction (see `terrain-and-surfaces.md`) —
  this is where fairway vs. rough vs. green differentiation actually
  shows up to the player.
- Once horizontal speed drops below a small threshold, snap velocity to
  zero and consider the shot "resolved" — this avoids Havok's default
  physics leaving the ball in a very slow, visually-imperceptible creep
  forever.

## 6. Putting is a separate, simpler system

Don't reuse the full swing meter for putting — it's a different feel.

- Power-only meter (no accuracy stage — direction comes from where the
  player aims, not from swing timing)
- No airborne phase at all — ball starts rolling immediately
- Slope reading matters far more here — pull the terrain gradient at the
  ball's position each tick and let it bend the roll (see
  `terrain-and-surfaces.md` §3)

## Tuning workflow

Build a "driving range" test scene (flat ground, no terrain complexity)
and a debug HUD showing exact velocity/spin values on each swing. Tune
constants there before ever testing on a real course — trying to tune
physics feel and terrain complexity at the same time will make it hard
to tell which variable caused a bad shot.
