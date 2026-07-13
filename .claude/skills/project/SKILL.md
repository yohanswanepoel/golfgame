---
name: Project Structure & Conventions
description:
Baseline conventions to keep a local model consistent across separate
sessions/phases. Load this at the start of every phase, alongside
whichever domain skill doc is relevant.
---
## Folder layout

```
/src
  /core
    swing.js          // swing meter + input -> launch params (golf-swing-physics.md)
    ballPhysics.js     // Havok body setup, flight/roll state machine
    surfaces.js        // surface lookup + physics properties (terrain-and-surfaces.md)
  /course
    schema.js          // types/validation for course-data-schema.md
    loader.js           // course JSON + heightmap -> Babylon scene
    terrain.js          // heightmap -> mesh + physics collider
  /editor
    editorState.js      // active tool, brush size, undo stack
    tools/
      sculpt.js
      paint.js
      place.js
    export.js           // in-memory hole -> schema JSON + PNG
  /game
    gameLoop.js          // strokes, scoring, hole progression
    hud.js
  /scenes
    drivingRange.js      // Phase 1 flat test scene
    main.js
  main.js                // entry point, mode switch (play vs editor)

/data
  /courses
    course-01/
      course.json
      /holes
        hole-01.json
      /heightmaps
        hole-01.png

/assets
  /models      // gltf trees, flags, club/ball models
  /sounds
  /textures
```

## Conventions

- **No framework-magic state management.** This project doesn't need
  Redux/Zustand-style tooling — plain JS modules with exported functions
  and a small number of explicit state objects (editorState, gameState)
  are enough at this scale, and are much easier for a local model to
  reason about without extra abstraction to learn.
- **Pure functions for anything testable.** Surface lookup, slope
  calculation, schema validation — write these as pure functions taking
  explicit inputs, not methods reaching into scene globals. Makes it
  possible to unit-test physics math without spinning up Babylon at all.
- **Constants live in one place.** All tuning constants (friction
  values, swing meter timings, curve constants) belong in a single
  `constants.js` per module area, not scattered as magic numbers inline
  — you will be retuning these constantly, especially in Phase 1 and 2.
- **Keep `/core` physics code Babylon-agnostic where possible.** Pass in
  plain position/velocity vectors rather than Babylon Mesh objects
  directly, where practical. Not a hard rule, but it keeps physics logic
  testable and easier for a model to reason about in isolation.

## Session handoff notes

When starting a new session/context window with your local model:
1. Paste the actual current contents of the files you're about to touch
   — not a summary of what they do.
2. State which Phase (from `00-ROADMAP.md`) you're working on and paste
   only the skill doc(s) relevant to that phase.
3. If continuing mid-phase, paste the most recent `PHASE_N_NOTES.md` so
   the model knows what's already been tried/decided.
4. Ask the model to flag if a request would require changing the schema
   in `course-data-schema.md` — schema changes should be a deliberate,
   visible decision, not something that happens incidentally while
   fixing an unrelated bug.
