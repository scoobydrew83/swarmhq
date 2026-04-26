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

  it("all command groups and picklist references are valid", () => {
    const groups = new Set(COMMAND_CATALOG.groups.map((g) => g.id));
    const picklists = new Set(COMMAND_CATALOG.picklists.map((p) => p.id));

    for (const cmd of COMMAND_CATALOG.commands) {
      expect(groups.has(cmd.groupId)).toBe(true);
      for (const option of cmd.options) {
        if (option.picklistId) {
          expect(picklists.has(option.picklistId)).toBe(true);
        }
      }
    }
  });

  it("Phase 2 write commands require confirmation options", () => {
    const writeCommandIds = [
      "maintenance.stack-deploy",
      "maintenance.stack-remove",
      "maintenance.network-create",
      "maintenance.network-remove",
      "maintenance.node-label-add",
      "maintenance.node-label-remove",
      "security.secret-create",
      "security.secret-remove",
      "security.config-create",
      "security.config-remove",
    ];

    for (const id of writeCommandIds) {
      const command = COMMAND_CATALOG.commands.find((c) => c.id === id);
      expect(command, id).toBeDefined();
      expect(command?.options.some((option) => option.id === "confirm" && option.kind === "checkbox")).toBe(true);
    }
  });

  it("secret and config create commands use textarea content fields", () => {
    for (const id of ["security.secret-create", "security.config-create"]) {
      const command = COMMAND_CATALOG.commands.find((c) => c.id === id);
      expect(command?.options.some((option) => option.id === "stdinContent" && option.kind === "textarea")).toBe(true);
      expect(command?.options.some((option) => option.id === "contentSource" && option.picklistId === "content-source")).toBe(true);
    }
  });
});
