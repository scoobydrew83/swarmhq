import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getUiBuildDir } from "../server/ui-server.js";

describe("getUiBuildDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "swarmhq-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves ui-dist one level above the dist directory", () => {
    // Simulates installed npm package: <pkg>/dist/bin.js + <pkg>/ui-dist/
    const distDir = path.join(tmpDir, "dist");
    const uiDistDir = path.join(tmpDir, "ui-dist");
    fs.mkdirSync(distDir);
    fs.mkdirSync(uiDistDir);

    const result = getUiBuildDir(distDir);
    expect(result).toBe(uiDistDir);
  });

  it("falls back to ui/out two levels above dist for local dev", () => {
    // Simulates monorepo: packages/cli/dist/ + packages/ui/out/
    const distDir = path.join(tmpDir, "cli", "dist");
    const uiOutDir = path.join(tmpDir, "ui", "out");
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(uiOutDir, { recursive: true });

    const result = getUiBuildDir(distDir);
    expect(result).toBe(uiOutDir);
  });

  it("returns null when no candidate directories exist", () => {
    const distDir = path.join(tmpDir, "dist");
    fs.mkdirSync(distDir);

    const result = getUiBuildDir(distDir);
    expect(result).toBeNull();
  });

  it("prefers SWARM_UI_DIST env var when set to an existing directory", () => {
    const customDir = path.join(tmpDir, "custom-ui");
    fs.mkdirSync(customDir);
    const distDir = path.join(tmpDir, "dist");
    fs.mkdirSync(distDir);

    const original = process.env.SWARM_UI_DIST;
    process.env.SWARM_UI_DIST = customDir;
    try {
      const result = getUiBuildDir(distDir);
      expect(result).toBe(customDir);
    } finally {
      if (original === undefined) delete process.env.SWARM_UI_DIST;
      else process.env.SWARM_UI_DIST = original;
    }
  });
});
