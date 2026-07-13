# Golf Game — Starter (Phase 0)

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). You should
see a green ground plane and a white ball drop from above, bounce once
or twice, and settle. Drag with the mouse to orbit the camera, scroll to
zoom.

## What this is

This is the Phase 0 scaffold from `00-ROADMAP.md`: Babylon.js + Havok
physics wired up and verified working, with no game logic yet. It's the
foundation you (or your local model) build Phase 1 (the swing mechanic)
on top of.

## Phase 0 Definition of Done — checklist

- [ ] `npm run dev` runs without errors
- [ ] Ground and ball are visible
- [ ] Ball falls under gravity
- [ ] Ball collides with the ground and comes to rest (doesn't fall
      through, doesn't bounce forever)
- [ ] Camera can be orbited/zoomed with the mouse

If all of those hold, you're ready to move to Phase 1 — load
`skills/golf-swing-physics.md` and start building the swing meter on top
of `src/scenes/drivingRange.js`, using `scene.metadata.ball` /
`scene.metadata.ballAggregate` to apply launch velocity.

## Troubleshooting

- **Blank screen / console error about wasm**: Havok's physics engine
  loads a `.wasm` file at runtime. Make sure you're running via `npm run
  dev` (not opening `index.html` directly as a file — wasm fetch
  requires a real HTTP server, which Vite provides).
- **Ball falls through the ground**: check that `groundAggregate` is
  created *before* `ballAggregate` isn't actually required, but do
  confirm both aggregates were created without errors in the console —
  a common cause is the mesh not having geometry yet when the aggregate
  is built (shouldn't happen here since we build mesh then aggregate
  synchronously, but worth knowing for later custom terrain).
