# Skill: Course Editor Architecture

The editor is a separate mode/app within the same project — it manipulates
the same data model defined in `course-data-schema.md`, and should reuse
the Phase 3 loader for previewing, rather than maintaining a second
parallel rendering path.

## 1. Tool modes

Structure the editor as a set of discrete, mutually exclusive tool
modes, each with its own input handler:

- **Sculpt** — raise/lower/smooth terrain with a brush
- **Paint** — assign surface type (fairway/rough/sand/green/water) to
  regions
- **Place** — drop objects (tee, pin, trees, bunker lips) at a click
  position
- **Select/Edit** — pick an existing surface polygon or object to
  move/resize/delete it

Keep tool state (active mode, brush size, selected surface type, etc.)
in one central editor-state object, not scattered across components —
this matters a lot once you add undo/redo (§3).

## 2. Sculpt tool — working with the heightmap

The heightmap is your source of truth (the PNG described in
`course-data-schema.md`), not the rendered mesh. The sculpt tool should:

1. Raycast from the mouse into the terrain mesh to find the (x, z)
   position and which heightmap pixel(s) that corresponds to.
2. Modify a working copy of the heightmap pixel data (a `Uint8Array` or
   similar) within the brush radius, using a falloff curve (e.g.
   smoothstep) so the brush edge isn't a hard cliff.
3. Regenerate the visual mesh AND the physics collider from the updated
   heightmap. Do this on every brush stroke *release*, not every mouse-
   move tick — regenerating a physics collider every frame while
   dragging will tank performance. During the drag itself, you can get
   away with only updating the visual mesh (physics can lag behind by a
   moment) or even just a cheap vertex-shader-based preview.

## 3. Undo/redo

Use a command pattern: every edit action (a sculpt stroke, a surface
paint, an object placement/move/delete) becomes a command object with
`apply()` and `undo()`. Push these onto an undo stack as they happen.

For sculpt strokes specifically, store a diff (before/after heightmap
patch within the brush's bounding box) rather than the whole heightmap —
whole-heightmap snapshots per undo step will bloat memory fast on a
256×256+ map.

```js
class SculptCommand {
  constructor(region, beforePatch, afterPatch) { ... }
  apply()  { writePatch(this.region, this.afterPatch); }
  undo()   { writePatch(this.region, this.beforePatch); }
}
```

## 4. Surface paint tool

Two viable approaches — pick one, don't mix:

- **Polygon-based** (matches the schema in `course-data-schema.md`
  directly): player draws/edits polygon vertices to define surface
  regions. More precise, easier to export cleanly, but fiddlier UI to
  build (vertex dragging, snapping).
- **Texture-mask-based**: player paints on a texture (like the sculpt
  brush but painting a surface-type ID instead of height), then you
  convert the mask to polygons on export via a contour-tracing step.
  Easier/more satisfying to use, but the mask→polygon conversion is
  extra work.

Given your stated priority (ease of course creation over precision),
**texture-mask painting is probably the better fit** — it feels like
painting, which is intuitive, and you can defer the polygon conversion
complexity to export-time rather than fighting vertex-editing UI during
Phase 5. Flag this as a decision to revisit if precision problems show
up later (e.g., messy bunker edges).

## 5. Object placement

Simple: click a position while "Place" tool + object type is active →
raycast to terrain → append an entry to `hole.objects` (or set
`hole.tee`/`hole.pin` if placing those special single-instance markers).
Selecting an already-placed object should highlight it and expose
position/rotation/scale fields for fine adjustment — dragging alone is
rarely precise enough for tee/pin placement.

## 6. Export

Export = serialize current in-memory hole state to the schema in
`course-data-schema.md`, then:
1. Write the heightmap working copy out as a PNG.
2. Run texture-mask → polygon conversion if using that approach (§4).
3. Run `validateCourse()` (defined in the schema doc) before writing the
   JSON — catch malformed exports at editor-time, not game-load-time.

## 7. Preview/playtest loop

Add a "Playtest" button that takes the current in-memory (unsaved) hole
state, feeds it directly into the Phase 3 game loader without a save/
reload round-trip, and drops the player in to play it immediately. This
tight iterate→playtest loop matters more for course-design quality than
almost any other editor feature — prioritize building this early in
Phase 5, not last.
