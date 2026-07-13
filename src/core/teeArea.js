import {
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
} from "@babylonjs/core";

/**
 * Creates a visible tee-off area: a flush mat patch the ball rests on, plus
 * a small flat marker ring at the exact tee spot. Purely cosmetic (no
 * physics aggregate) — the ball's own physics body still rests on your
 * `ground` mesh, this just gives the player something to look at.
 *
 * IMPORTANT: everything here is sized well BELOW the ball's radius so
 * nothing pokes up into it. A golf ball is tiny (~2cm radius) — a mat or
 * marker taller than that will visually swallow the ball even though the
 * ball's physics position is unaffected.
 *
 * @param {Scene} scene
 * @param {Vector3} teePosition   - world position the ball rests at (e.g. TEE_POSITION)
 * @param {Object} opts
 * @param {number} opts.matWidth      - tee mat width, meters (default 3)
 * @param {number} opts.matDepth      - tee mat depth, meters (default 2)
 * @param {number} opts.matThickness  - tee mat thickness, meters (default 0.01 = 1cm)
 * @param {number} opts.ballRadius    - pass BALL.diameterMeters / 2 so the marker
 *                                      auto-clamps below the ball's resting height
 * @returns {{ mat: Mesh, marker: Mesh, dispose: () => void }}
 */
export function createTeeArea(scene, teePosition, opts = {}) {
  const {
    matWidth = 3,
    matDepth = 2,
    matThickness = 0.01,
    ballRadius = 0.02,
  } = opts;

  // Keep the mat top well under the ball's resting center height so the
  // ball always reads as sitting ON the mat, never inside it.
  const safeMatThickness = Math.min(matThickness, ballRadius * 0.6);

  // --- Tee mat: thin box sunk half into the ground, top just barely proud ---
  const mat = MeshBuilder.CreateBox(
    "teeMat",
    { width: matWidth, height: safeMatThickness, depth: matDepth },
    scene
  );
  mat.position = new Vector3(
    teePosition.x,
    -safeMatThickness / 2 + 0.001, // top sits ~1mm above the fairway, bottom embedded in ground
    teePosition.z
  );

  const matMaterial = new StandardMaterial("teeMatMat", scene);
  matMaterial.diffuseColor = new Color3(0.15, 0.45, 0.18); // slightly darker/richer green than fairway
  matMaterial.specularColor = new Color3(0.05, 0.05, 0.05);
  mat.material = matMaterial;

  // --- Marker: a flat disc (not a raised peg) at the exact ball rest spot ---
  const markerThickness = safeMatThickness * 0.5;
  const marker = MeshBuilder.CreateCylinder(
    "teeMarker",
    { diameter: ballRadius * 1.8, height: markerThickness, tessellation: 24 },
    scene
  );
  marker.position = new Vector3(
    teePosition.x,
    mat.position.y + safeMatThickness / 2 + markerThickness / 2 - 0.0005,
    teePosition.z
  );

  const markerMaterial = new StandardMaterial("teeMarkerMat", scene);
  markerMaterial.diffuseColor = new Color3(0.9, 0.85, 0.7); // pale marker color
  marker.material = markerMaterial;

  function dispose() {
    mat.dispose();
    marker.dispose();
    matMaterial.dispose();
    markerMaterial.dispose();
  }

  return { mat, marker, dispose };
}
