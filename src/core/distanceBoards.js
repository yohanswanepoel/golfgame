import {
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  DynamicTexture,
} from "@babylonjs/core";

/**
 * Spawns paired distance marker boards down both sides of the fairway.
 *
 * Each board is a thin vertical plane with a DynamicTexture showing the
 * distance (e.g. "100m"). Boards are static (no physics aggregate needed
 * unless you want the ball to be able to bounce off them).
 *
 * @param {Scene} scene
 * @param {Object} opts
 * @param {number} opts.interval        - distance between boards, meters (default 25)
 * @param {number} opts.maxDistance     - furthest board distance, meters (default 200)
 * @param {number} opts.fairwayHalfWidth- distance from center line to boards, meters (default 12)
 * @param {number} opts.boardWidth      - board width, meters (default 1.5)
 * @param {number} opts.boardHeight     - board height, meters (default 1)
 * @param {number} opts.postHeight      - height of the support post below the board (default 0.6)
 * @returns {{ boards: Mesh[], dispose: () => void }}
 */
export function createDistanceBoards(scene, opts = {}) {
  const {
    interval = 25,
    maxDistance = 200,
    fairwayHalfWidth = 12,
    boardWidth = 1.5,
    boardHeight = 1,
    postHeight = 0.6,
  } = opts;

  const boards = [];
  const boardCount = Math.floor(maxDistance / interval);

  // Shared post material (boards each get their own textured material
  // since the label text differs)
  const postMat = new StandardMaterial("boardPostMat", scene);
  postMat.diffuseColor = new Color3(0.35, 0.25, 0.15);

  for (let i = 1; i <= boardCount; i++) {
    const distance = i * interval;

    [-1, 1].forEach((side) => {
      const x = side * fairwayHalfWidth;

      // --- Post (small box holding the board up off the ground) ---
      const post = MeshBuilder.CreateBox(
        `boardPost_${distance}_${side}`,
        { width: 0.15, height: postHeight, depth: 0.15 },
        scene
      );
      post.position = new Vector3(x, postHeight / 2, distance);
      post.material = postMat;

      // --- Board face (plane with dynamic texture label) ---
      const board = MeshBuilder.CreatePlane(
        `board_${distance}_${side}`,
        { width: boardWidth, height: boardHeight },
        scene
      );
      board.position = new Vector3(x, postHeight + boardHeight / 2, distance);
      // Face the tee (down the -Z direction toward the golfer).
      // Rotating 180° on Y flips which way the plane faces, but it also
      // mirrors the texture (UVs don't re-wind on rotation) — the
      // negative X scale cancels that mirroring so the text reads correctly.
      board.rotation.y = Math.PI;
      board.scaling.x = -1;

      const texRes = 256;
      const boardTex = new DynamicTexture(
        `boardTex_${distance}_${side}`,
        { width: texRes, height: texRes },
        scene,
        true
      );
      const ctx = boardTex.getContext();
      ctx.fillStyle = "#f4f1e8";
      ctx.fillRect(0, 0, texRes, texRes);
      ctx.strokeStyle = "#2c2c2a";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, texRes - 8, texRes - 8);
      ctx.fillStyle = "#1d1d1b";
      ctx.font = "bold 72px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${distance}m`, texRes / 2, texRes / 2);
      boardTex.update();

      const boardMat = new StandardMaterial(`boardMat_${distance}_${side}`, scene);
      boardMat.diffuseTexture = boardTex;
      boardMat.specularColor = new Color3(0, 0, 0);
      boardMat.backFaceCulling = false;
      board.material = boardMat;

      boards.push(post, board);
    });
  }

  function dispose() {
    boards.forEach((mesh) => mesh.dispose());
    postMat.dispose();
  }

  return { boards, dispose };
}
