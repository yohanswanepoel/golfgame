# Golf Game — Build Roadmap

Each phase below is scoped to be handed to a local model as a self-contained
task. Don't start a phase until the previous one's "Definition of Done" is
actually met and playable/testable — resist the urge to jump ahead, since
each phase assumes the previous one's interfaces are stable.

Related skill docs to load per phase are noted inline.

---

## Phase 0 — Project Scaffold
**Goal:** Empty Babylon.js project that runs, with a camera you can fly
around and Havok physics initialized (even if nothing uses it yet).

- Vite (or similar bundler) + Babylon.js + `@babylonjs/havok` installed
- Single scene, ArcRotateCamera, a ground plane, basic lighting
- Confirm Havok physics engine initializes without errors (drop a test
  sphere, watch it fall and settle)

**Load skill:** `project-structure.md`

**Definition of Done:** `npm run dev` shows a lit scene with a ball that
falls under gravity and stops on the ground.

---

## Phase 1 — Swing Mechanic (flat test plane only)
**Goal:** The core "feel" of the game — no terrain, no course, just a ball
on a flat plane you can hit.

- Three-stage swing meter (power → accuracy), see `golf-swing-physics.md`
- Club selection (start with just 3: Driver, 7-Iron, Putter)
- Ball launches with correct speed/angle/spin based on swing input
- Camera follows the ball in flight, settles behind it once it stops

**Load skill:** `golf-swing-physics.md`

**Definition of Done:** You can take a full swing, watch a believable
trajectory, and the ball rolls to a stop. Do this in isolation — don't
touch terrain yet. Tune it until it *feels* right before moving on.

---

## Phase 2 — Terrain & Surface Physics
**Goal:** Replace the flat plane with a real heightmap course, and make
surface type (fairway/rough/sand/green) actually change ball behavior.

- Heightmap-based ground mesh
- Surface zones (polygon or texture-mask based) with per-surface
  friction/restitution
- Slope affects roll direction (critical for putting)

**Load skill:** `terrain-and-surfaces.md`

**Definition of Done:** Ball rolls differently on rough vs. fairway vs.
green, and visibly curves when rolling across a slope.

---

## Phase 3 — Course Data & Loading
**Goal:** Formalize "a course" as data, not hardcoded scene setup, so the
same loader works for hand-built test courses and later, editor output.

- Implement the schema in `course-data-schema.md`
- Loader that takes a course JSON + heightmap and builds the Phase 2 scene
  from it
- Hand-author 1–2 test course JSON files to validate the loader

**Load skill:** `course-data-schema.md`

**Definition of Done:** You can swap between two different hand-authored
course files and both load correctly with correct tee/pin/hazard
placement.

---

## Phase 4 — Game Loop
**Goal:** Turn "hit ball around a course" into an actual game.

- Stroke counting, par, scorecard
- Out-of-bounds / water hazard rules (penalty strokes, re-drop)
- Hole completion (ball in cup) → advance to next hole
- Basic HUD (current club, stroke count, distance to pin)

**Definition of Done:** You can play a full 3-hole round start to finish
with correct scoring.

---

## Phase 5 — Course Editor
**Goal:** Build courses without hand-writing JSON.

- Terrain sculpt tool (raise/lower/smooth brush)
- Surface paint tool (fairway/rough/sand/green/water)
- Object placement (tee, pin, trees, bunkers)
- Export to the Phase 3 schema

**Load skill:** `course-editor-architecture.md`, `course-data-schema.md`

**Definition of Done:** You can build a playable hole entirely in the
editor, export it, and load+play it via the Phase 3 loader with no manual
JSON editing.

---

## Phase 6 — Polish
**Goal:** Everything that makes it feel like a finished game rather than
a tech demo.

- Camera modes (aim view, ball-follow, green-read top-down)
- Sound effects (swing, ball impact, splash, cup-in)
- Wind (affects ball flight, shown in HUD)
- Menu/course-select screen

**Definition of Done:** Subjective — but nothing should feel like a
placeholder anymore.

---

## Phase 7 — Save/Share (optional, do last)
- LocalStorage or file-based course save/load
- Export/import course JSON so courses can be shared as files
- Multiple saved rounds/scorecards

---

## General notes for working with a local model across phases

- Each phase should be its own conversation/context window where possible.
  Point the model at only the skill doc(s) relevant to that phase — don't
  dump all skills in at once, it dilutes focus.
- At the start of a new phase, paste in the actual current state of
  relevant files (not a summary) — local models are more reliable with
  ground truth than with your recollection of what exists.
- After each phase, write a short `PHASE_N_NOTES.md` of what was actually
  built and any deviations from the plan. Feed that back in at the start
  of the next phase so context isn't lost.
