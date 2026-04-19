# Bundle CLI with tsup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `tsc`-only compilation in `packages/cli` with a tsup bundle that inlines `@swarm-cli/core`, producing a single self-contained `dist/bin.js` that works when installed from npm without any sibling workspace packages.

**Architecture:** tsup wraps esbuild to compile and bundle the CLI entry point (`src/bin.ts`) into a single ESM file. `@swarm-cli/core` (resolved via the workspace symlink from its compiled `dist/`) is inlined into the bundle. All `node:*` built-ins are externalized. The `#!/usr/bin/env node` shebang is injected via tsup's `banner` option.

**Tech Stack:** tsup 8.x, esbuild (transitive), Node 20+, ESM

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `packages/cli/package.json` | Replace build script, move core to devDependencies, add tsup devDep |
| Create | `packages/cli/tsup.config.ts` | tsup bundle configuration |
| Modify | `packages/core/package.json` | Add `"private": false` explicitly (no change needed — already publishable; document only) |
| Modify | `.github/workflows/ci.yml` | No change needed — `npm run build` already calls core first |

---

## Task 1: Add tsup to CLI package

**Files:**
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Add tsup as a dev dependency**

```bash
npm install -D tsup --workspace=swarm-cli
```

Expected: `packages/cli/package.json` now has `"tsup"` in `devDependencies`.

- [ ] **Step 2: Move @swarm-cli/core to devDependencies**

In `packages/cli/package.json`, change:

```json
"dependencies": {},
"devDependencies": {
  "@swarm-cli/core": "0.1.0",
  "tsup": "^8.x.x"
}
```

The exact tsup version will be whatever `npm install` resolved. `@swarm-cli/core` moves out of `dependencies` entirely — it will be inlined by the bundler.

- [ ] **Step 3: Verify package.json is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/cli/package.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add packages/cli/package.json package-lock.json
git commit -m "build(cli): add tsup, move core to devDependencies"
```

---

## Task 2: Create tsup config

**Files:**
- Create: `packages/cli/tsup.config.ts`

- [ ] **Step 1: Create the tsup config**

Create `packages/cli/tsup.config.ts` with this content:

```typescript
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
```

**Why each option:**
- `noExternal: ["@swarm-cli/core"]` — forces tsup to inline core rather than leave it as a runtime import
- `banner.js` — injects the shebang so the binary is directly executable
- `dts: false` — CLI binaries don't need type declarations
- `splitting: false` — single output file is correct for a CLI binary

- [ ] **Step 2: Update the build script in packages/cli/package.json**

Change the `"build"` script from:
```json
"build": "tsc -p tsconfig.json"
```
to:
```json
"build": "tsup"
```

Keep the `"typecheck"` script unchanged — `tsc --noEmit` still validates types without producing output.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/tsup.config.ts packages/cli/package.json
git commit -m "build(cli): add tsup config to bundle core into binary"
```

---

## Task 3: Build and verify the bundle

**Files:**
- No file changes — this task validates the output

- [ ] **Step 1: Build core first (required — tsup resolves core from its compiled dist)**

```bash
npm run build -w @swarm-cli/core
```

Expected: `packages/core/dist/` populated with `.js` and `.d.ts` files. No errors.

- [ ] **Step 2: Build the CLI with tsup**

```bash
npm run build -w swarm-cli
```

Expected output (tsup summary):
```
CLI   dist/bin.js   ~XXX KB
```

No errors. A single `dist/bin.js` file is created.

- [ ] **Step 3: Verify the shebang is present**

```bash
head -1 packages/cli/dist/bin.js
```

Expected: `#!/usr/bin/env node`

- [ ] **Step 4: Verify @swarm-cli/core is NOT a runtime import**

```bash
grep "from.*@swarm-cli/core" packages/cli/dist/bin.js
```

Expected: **no output** (core is inlined — the import string should not appear).

- [ ] **Step 5: Verify the binary runs**

```bash
node packages/cli/dist/bin.js --help
```

Expected: The swarm-cli help text prints without errors.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/dist/bin.js
git commit -m "build(cli): verify bundled output runs correctly"
```

> Note: If `dist/` is in `.gitignore`, skip the `git add dist/bin.js` — the binary won't be committed and that's fine. The CI build produces it fresh on each run.

---

## Task 4: Verify full monorepo build still works

**Files:**
- No file changes — integration check

- [ ] **Step 1: Clean all dist directories**

```bash
rm -rf packages/core/dist packages/cli/dist packages/ui/.next packages/ui/out
```

- [ ] **Step 2: Run the full monorepo build from root**

```bash
npm run build
```

Expected: All four stages complete in order (core → cli → ui → bundle:ui) with no errors.

- [ ] **Step 3: Confirm ui-dist is populated in CLI**

```bash
ls packages/cli/ui-dist/ | head -5
```

Expected: Static Next.js asset files listed (HTML, JS chunks, etc.).

- [ ] **Step 4: Run typecheck across all packages**

```bash
npm run typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 5: Do a publish dry-run to confirm what goes to npm**

```bash
cd packages/cli && npm publish --dry-run
```

Expected output includes `dist/bin.js` and `ui-dist/` files. Should NOT include `@swarm-cli/core` as a dependency in the published package manifest (since it's now in devDependencies).

- [ ] **Step 6: Commit**

```bash
git add -p   # stage any lockfile or config changes
git commit -m "build(cli): confirm full monorepo build and publish dry-run pass"
```

---

## Checklist

- [ ] `@swarm-cli/core` is not in `dependencies` of the published package
- [ ] `dist/bin.js` starts with `#!/usr/bin/env node`
- [ ] `node packages/cli/dist/bin.js --help` works
- [ ] `npm publish --dry-run` from `packages/cli` shows correct files
- [ ] `npm run build` from root still succeeds end-to-end
- [ ] `npm run typecheck` passes
