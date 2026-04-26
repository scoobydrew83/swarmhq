import { describe, it, expect } from "vitest";
import { buildCliInvocation } from "../command-bridge.js";

describe("buildCliInvocation", () => {
  describe("health.report", () => {
    it("builds basic health args", () => {
      const result = buildCliInvocation({ commandId: "health.report" });
      expect(result.args).toEqual(["health"]);
    });

    it("appends --json for json format", () => {
      const result = buildCliInvocation({
        commandId: "health.report",
        values: { format: "json" },
      });
      expect(result.args).toContain("--json");
    });

    it("appends --detailed for detailed format", () => {
      const result = buildCliInvocation({
        commandId: "health.report",
        values: { format: "detailed" },
      });
      expect(result.args).toContain("--detailed");
    });

    it("appends --config when configPath is set", () => {
      const result = buildCliInvocation({
        commandId: "health.report",
        values: { configPath: "/path/to/config.json" },
      });
      expect(result.args).toContain("--config");
      expect(result.args).toContain("/path/to/config.json");
    });

    it("sets displayCommand string", () => {
      const result = buildCliInvocation({ commandId: "health.report" });
      expect(result.displayCommand).toBe("swarmhq health");
    });
  });

  describe("config.show", () => {
    it("builds config show args", () => {
      const result = buildCliInvocation({ commandId: "config.show" });
      expect(result.args).toEqual(["config", "show"]);
    });

    it("appends --json flag", () => {
      const result = buildCliInvocation({
        commandId: "config.show",
        values: { format: "json" },
      });
      expect(result.args).toContain("--json");
    });
  });

  describe("config.path", () => {
    it("builds config path args", () => {
      const result = buildCliInvocation({ commandId: "config.path" });
      expect(result.args).toEqual(["config", "path"]);
    });
  });

  describe("config.init", () => {
    it("builds config init args", () => {
      const result = buildCliInvocation({ commandId: "config.init" });
      expect(result.args[0]).toBe("config");
      expect(result.args[1]).toBe("init");
    });

    it("appends --force flag when set", () => {
      const result = buildCliInvocation({
        commandId: "config.init",
        values: { force: true },
      });
      expect(result.args).toContain("--force");
    });

    it("appends --hide-ips flag when set", () => {
      const result = buildCliInvocation({
        commandId: "config.init",
        values: { hideIps: true },
      });
      expect(result.args).toContain("--hide-ips");
    });
  });

  describe("operations.nodes", () => {
    it("builds nodes args", () => {
      const result = buildCliInvocation({ commandId: "operations.nodes" });
      expect(result.args[0]).toBe("nodes");
    });

    it("appends --context when set", () => {
      const result = buildCliInvocation({
        commandId: "operations.nodes",
        values: { context: "production" },
      });
      expect(result.args).toContain("--context");
      expect(result.args).toContain("production");
    });
  });

  describe("maintenance.reboot-node", () => {
    it("builds reboot node args", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.reboot-node",
        values: { target: "manager-a" },
      });
      expect(result.args).toContain("reboot");
      expect(result.args).toContain("node");
      expect(result.args).toContain("--target");
      expect(result.args).toContain("manager-a");
    });

    it("appends --yes when confirm is true", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.reboot-node",
        values: { confirm: true },
      });
      expect(result.args).toContain("--yes");
    });

    it("appends --force when set", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.reboot-node",
        values: { force: true },
      });
      expect(result.args).toContain("--force");
    });

    it("appends --no-restore when noRestore is true", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.reboot-node",
        values: { noRestore: true },
      });
      expect(result.args).toContain("--no-restore");
    });
  });

  describe("maintenance.update-node", () => {
    it("builds update node args", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.update-node",
        values: { target: "manager-a" },
      });
      expect(result.args).toContain("update");
      expect(result.args).toContain("node");
    });

    it("appends --os for os mode", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.update-node",
        values: { mode: "os" },
      });
      expect(result.args).toContain("--os");
    });

    it("appends --docker for docker mode", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.update-node",
        values: { mode: "docker" },
      });
      expect(result.args).toContain("--docker");
    });

    it("appends --skip-reboot when set", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.update-node",
        values: { skipReboot: true },
      });
      expect(result.args).toContain("--skip-reboot");
    });
  });

  describe("maintenance.leader-switch", () => {
    it("builds leader switch args", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.leader-switch",
        values: { target: "manager-b" },
      });
      expect(result.args).toContain("leader");
      expect(result.args).toContain("switch");
      expect(result.args).toContain("--target");
      expect(result.args).toContain("manager-b");
    });

    it("appends --vip-only when set", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.leader-switch",
        values: { vipOnly: true },
      });
      expect(result.args).toContain("--vip-only");
    });

    it("appends --swarm-only when set", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.leader-switch",
        values: { swarmOnly: true },
      });
      expect(result.args).toContain("--swarm-only");
    });
  });

  describe("security.redaction-preview", () => {
    it("builds redact args with config source", () => {
      const result = buildCliInvocation({
        commandId: "security.redaction-preview",
        values: { source: "config" },
      });
      expect(result.args).toContain("redact");
      expect(result.args).toContain("--source");
      expect(result.args).toContain("config");
    });

    it("includes stdin for custom source", () => {
      const result = buildCliInvocation({
        commandId: "security.redaction-preview",
        values: { source: "custom", customText: "tskey-abc123" },
      });
      expect(result.args).toContain("--stdin");
      expect(result.stdin).toBe("tskey-abc123");
    });
  });

  describe("Phase 2 resource mappings", () => {
    it("maps stack deploy with confirmation", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.stack-deploy",
        values: { filePath: "compose.yml", stackName: "apps", confirm: true },
      });
      expect(result.args).toEqual(["stack", "deploy", "--file", "compose.yml", "--name", "apps", "--yes"]);
    });

    it("maps logs follow with filters", () => {
      const result = buildCliInvocation({
        commandId: "operations.logs",
        values: { serviceName: "web", follow: true, since: "1h", tail: "50" },
      });
      expect(result.args).toEqual(["logs", "--name", "web", "--follow", "--since", "1h", "--tail", "50"]);
    });

    it("maps node label add", () => {
      const result = buildCliInvocation({
        commandId: "maintenance.node-label-add",
        values: { nodeId: "worker-a", labelKey: "zone", labelValue: "east", confirm: true },
      });
      expect(result.args).toEqual([
        "nodes",
        "label",
        "add",
        "--target",
        "worker-a",
        "--key",
        "zone",
        "--value",
        "east",
        "--yes",
      ]);
    });

    it("sends secret textarea content through stdin without leaking it into displayCommand", () => {
      const result = buildCliInvocation({
        commandId: "security.secret-create",
        values: {
          name: "api_token",
          contentSource: "stdin",
          stdinContent: "super-secret-value",
          confirm: true,
        },
      });
      expect(result.args).toEqual(["secret", "create", "--name", "api_token", "--stdin", "--yes"]);
      expect(result.stdin).toBe("super-secret-value");
      expect(result.displayCommand).not.toContain("super-secret-value");
    });

    it("maps Docker config create to the plural configs command", () => {
      const result = buildCliInvocation({
        commandId: "security.config-create",
        values: { name: "app_conf", contentSource: "file", filePath: "app.conf", confirm: true },
      });
      expect(result.args).toEqual(["configs", "create", "--name", "app_conf", "--file", "app.conf", "--yes"]);
    });
  });

  describe("error handling", () => {
    it("throws for unknown command id", () => {
      expect(() =>
        buildCliInvocation({ commandId: "nonexistent.command" }),
      ).toThrowError(/No CLI bridge is defined/);
    });
  });
});
