import { defineConfig } from "tsup";

export default defineConfig({
  entry: { bin: "src/bin.ts" },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  bundle: true,
  noExternal: ["@swarm-cli/core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
