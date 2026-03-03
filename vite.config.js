import { defineConfig } from "vite";
import { resolve } from "node:path";
import { existsSync, cpSync } from "node:fs";

function copyRuntimeAssetsPlugin() {
  return {
    name: "copy-runtime-assets",
    writeBundle() {
      const src = resolve(__dirname, "assets");
      const dest = resolve(__dirname, "dist/assets");
      if (!existsSync(src)) return;
      cpSync(src, dest, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [copyRuntimeAssetsPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ko: resolve(__dirname, "ko/index.html"),
      },
    },
  },
});
