import { Engine } from "@babylonjs/core";
import { createDrivingRangeScene } from "./scenes/drivingRange.js";

const canvas = document.getElementById("renderCanvas");
const engine = new Engine(canvas, true);

async function main() {
  const scene = await createDrivingRangeScene(engine, canvas);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });

  // Global keyboard listener — fires regardless of which element has focus
  window.addEventListener("keydown", (e) => {
    const swingMeter = scene.metadata?.swingMeter;
    if (!swingMeter) return;

    const state = swingMeter.getState();

    // Spacebar — advance swing meter (also handled by scene observable)
    if (e.code === "Space") {
      e.preventDefault();
      e.stopPropagation();
      if (
        state === "idle" ||
        state === "power_fill" ||
        state === "power_locked"
      ) {
        swingMeter.nextStep();
      }
      return;
    }

    // Arrow keys — adjust aim (only when swing is IDLE)
    if (state === "idle") {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        scene.metadata.camera.alpha -= 0.01;
        swingMeter.setAimAngle(swingMeter.getAimAngle() - 0.01);
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        scene.metadata.camera.alpha += 0.01;
        swingMeter.setAimAngle(swingMeter.getAimAngle() + 0.01);
      }



      // Number keys — select club
      if (e.code === "Digit1") {
        scene.metadata.selectedClubId = "driver";
        scene.metadata.updateClubButtons?.();
      }
      if (e.code === "Digit2") {
        scene.metadata.selectedClubId = "iron7";
        scene.metadata.updateClubButtons?.();
      }
      if (e.code === "Digit3") {
        scene.metadata.selectedClubId = "putter";
        scene.metadata.updateClubButtons?.();
      }
    }

    // R — reset ball
    if (e.code === "KeyR") {
      e.preventDefault();
      scene.metadata.resetBall();
    }
  });
}

main().catch((err) => {
  // If Havok fails to initialize (e.g. wasm blocked, CORS issue), this is
  // where you'll see it — check the browser console.
  console.error("Failed to start scene:", err);
});
