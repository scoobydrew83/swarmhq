import { defineConfig } from "tsup";

export default defineConfig({
  entry: { bin: "src/bin.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  bundle: true,
  noExternal: ["@swarmhq/core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
