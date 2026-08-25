import { defineConfig } from "vite";

export default defineConfig({
  // the .onnx files are big; don't let vite try to inline or transform them
  assetsInclude: ["**/*.onnx"],
  build: { chunkSizeWarningLimit: 1500 },
  // honour PORT when something else picks the port for us
  server: { port: Number(process.env.PORT) || 5173 },
});
