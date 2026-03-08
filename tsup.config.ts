import fs from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default defineConfig([
  // CLI entry
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: "esm",
    target: "node18",
    platform: "node",
    outDir: "dist",
    clean: false,
    // shebang is preserved from source by esbuild
    define: {
      "process.env.npm_package_version": JSON.stringify(pkg.version),
    },
    esbuildOptions(options) {
      options.alias = { "~": "./src" };
    },
  },
  // Core SDK
  {
    entry: [
      "src/core/echo/index.ts",
      "src/core/smart-paste/index.ts",
      "src/core/providers/index.ts",
    ],
    format: "esm",
    target: "node18",
    platform: "node",
    outDir: "dist/core",
    clean: false,
    dts: true,
    esbuildOptions(options) {
      options.alias = { "~": "./src" };
    },
  },
]);
