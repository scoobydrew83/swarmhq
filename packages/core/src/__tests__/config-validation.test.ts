import { describe, it, expect } from "vitest";
import { validateConfig, loadConfig } from "../config.js";
import { ConfigError } from "../errors.js";
import type { SwarmConfig } from "../types.js";

function validConfig(): SwarmConfig {
  return {
    version: 1,
    clusterName: "test-cluster",
    vip: "10.0.0.1",
    nodes: [
      {
        id: "manager-a",
        host: "10.0.0.11",
        username: "admin",
        roles: ["manager"],
      },
    ],
    keepalived: {
      enabled: true,
      interface: "eth0",
      routerId: "TESTCLUSTER",
      virtualRouterId: 51,
      advertisementInterval: 1,
    },
    ssh: {
      port: 22,
      strictHostKeyChecking: "accept-new",
    },
    redaction: {
      hideIps: false,
      storeCommandHistory: false,
    },
  };
}

describe("validateConfig", () => {
  it("accepts a valid config without throwing", () => {
    expect(() => validateConfig(validConfig())).not.toThrow();
  });

  it("throws ConfigError for unsupported version", () => {
    const config = { ...validConfig(), version: 2 } as unknown as SwarmConfig;
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/Unsupported config version/);
  });

  it("throws ConfigError when clusterName is empty", () => {
    const config = { ...validConfig(), clusterName: "   " };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/clusterName/);
  });

  it("throws ConfigError when vip is empty", () => {
    const config = { ...validConfig(), vip: "" };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/vip/);
  });

  it("throws ConfigError when nodes array is empty", () => {
    const config = { ...validConfig(), nodes: [] };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/At least one node/);
  });

  it("throws ConfigError when node id is empty", () => {
    const config = validConfig();
    config.nodes[0] = { ...config.nodes[0], id: "" };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/id.*required/i);
  });

  it("throws ConfigError when node host is empty", () => {
    const config = validConfig();
    config.nodes[0] = { ...config.nodes[0], host: "" };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/host.*required/i);
  });

  it("throws ConfigError when node username is empty", () => {
    const config = validConfig();
    config.nodes[0] = { ...config.nodes[0], username: "  " };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/username.*required/i);
  });

  it("throws ConfigError when no manager node exists", () => {
    const config = validConfig();
    config.nodes[0] = { ...config.nodes[0], roles: ["worker"] };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/manager/);
  });

  it("throws ConfigError when SSH port is out of range", () => {
    const config = { ...validConfig(), ssh: { port: 0, strictHostKeyChecking: "accept-new" as const } };
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/ssh\.port/);
  });

  it("throws ConfigError when keepalived virtualRouterId is out of range", () => {
    const config = validConfig();
    config.keepalived.virtualRouterId = 300;
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/virtualRouterId/);
  });

  it("throws ConfigError when keepalived advertisementInterval is less than 1", () => {
    const config = validConfig();
    config.keepalived.advertisementInterval = 0;
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/advertisementInterval/);
  });

  it("throws ConfigError when keepalived interface is empty", () => {
    const config = validConfig();
    config.keepalived.interface = "";
    expect(() => validateConfig(config)).toThrow(ConfigError);
    expect(() => validateConfig(config)).toThrow(/keepalived\.interface/);
  });

  it("accepts multiple nodes including workers", () => {
    const config = validConfig();
    config.nodes.push({ id: "worker-a", host: "10.0.0.12", username: "admin", roles: ["worker"] });
    expect(() => validateConfig(config)).not.toThrow();
  });

  it("ConfigError has exitCode 2", () => {
    const config = { ...validConfig(), clusterName: "" };
    try {
      validateConfig(config);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).exitCode).toBe(2);
    }
  });
});

describe("loadConfig", () => {
  it("throws ConfigError for a non-existent path", () => {
    expect(() => loadConfig("/nonexistent/path/config.json")).toThrow(ConfigError);
    expect(() => loadConfig("/nonexistent/path/config.json")).toThrow(/Config file not found/);
  });
});
