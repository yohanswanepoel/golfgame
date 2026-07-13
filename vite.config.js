import { defineConfig } from "vite";

export default defineConfig({
  // Havok ships as a wasm module loaded at runtime via a URL fetch.
  // Excluding it from Vite's dependency pre-bundling avoids the wasm
  // binary getting mangled/duplicated by esbuild's optimizer.
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
