import { resolve } from "path";
import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import zipPack from "vite-plugin-zip-pack";

export default defineConfig({
  plugins: [
    svelte({
      preprocess: vitePreprocess(),
    }),
    viteStaticCopy({
      targets: [
        { src: "./plugin.json", dest: "./" },
        { src: "./README.md", dest: "./" },
        { src: "./preview.png", dest: "./" },
        { src: "./icon.png", dest: "./" },
        { src: "./i18n", dest: "./" },
      ],
    }),
    zipPack({
      inDir: './dist',
      outDir: './',
      outFileName: 'package.zip'
    })
  ],
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["siyuan"],
      output: {
        entryFileNames: "index.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        },
      },
    },
  },
});
