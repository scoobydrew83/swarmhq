import { describe, it, expect } from "vitest";
import { resolveConfigPath, createConfigBuilderDefaults } from "../config.js";

describe("resolveConfigPath", () => {
  it("returns a string path", () => {
    const p = resolveConfigPath();
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(0);
  });
});

describe("createConfigBuilderDefaults", () => {
  it("returns defaults object when no config exists", () => {
    const defaults = createConfigBuilderDefaults();
    expect(defaults).toBeDefined();
    expect(typeof defaults).toBe("object");
    expect(typeof defaults.hasExistingConfig).toBe("boolean");
    expect(defaults.input).toBeDefined();
  });
});
