import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumSource = "node_modules/cesium/Build/Cesium";
// Cesium loads these at runtime relative to CESIUM_BASE_URL.
const cesiumBaseUrl = "cesium";
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map((dir) => ({
        src: `${cesiumSource}/${dir}`,
        dest: cesiumBaseUrl,
        rename: { stripBase: 4 }, // strips `node_modules/cesium/Build/Cesium/`
      })),
    }),
  ],
  build: {
    chunkSizeWarningLimit: 6000,
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify(`${base}${cesiumBaseUrl}`),
  },
});
