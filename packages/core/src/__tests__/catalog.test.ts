import { describe, it, expect } from "vitest";
import { COMMAND_CATALOG } from "../catalog.js";

describe("COMMAND_CATALOG", () => {
  it("has required top-level fields", () => {
    expect(COMMAND_CATALOG.appName).toBeTruthy();
    expect(Array.isArray(COMMAND_CATALOG.groups)).toBe(true);
    expect(Array.isArray(COMMAND_CATALOG.commands)).toBe(true);
  });

  it("has at least 20 commands", () => {
    expect(COMMAND_CATALOG.commands.length).toBeGreaterThanOrEqual(20);
  });

  it("every command has id, label, groupId, options array", () => {
    for (const cmd of COMMAND_CATALOG.commands) {
      expect(typeof cmd.id).toBe("string");
      expect(typeof cmd.label).toBe("string");
      expect(typeof cmd.groupId).toBe("string");
      expect(Array.isArray(cmd.options)).toBe(true);
    }
  });

  it("command ids are unique", () => {
    const ids = COMMAND_CATALOG.commands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
