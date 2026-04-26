import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

// Import after mocking
const {
  listNodes,
  listServices,
  inspectService,
  getLeaderStatus,
  listTasks,
  listServiceTasks,
  listStacks,
  deployStack,
  createSecret,
  createConfig,
  listNetworks,
  updateNodeLabel,
  readServiceLogs,
} = await import("../docker-runtime.js");

function makeMockOutput(records: Record<string, string>[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n");
}

describe("docker-runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listNodes", () => {
    it("returns formatted table output", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([
          { Hostname: "manager-a", Status: "Ready", Availability: "Active", ManagerStatus: "Leader" },
          { Hostname: "worker-b", Status: "Ready", Availability: "Active", ManagerStatus: "" },
        ]),
      );

      const result = listNodes();
      expect(result).toContain("manager-a");
      expect(result).toContain("worker-b");
      expect(result).toContain("HOSTNAME");
    });

    it("returns JSON output when asJson is true", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([{ Hostname: "manager-a", Status: "Ready", Availability: "Active", ManagerStatus: "Leader" }]),
      );

      const result = listNodes(undefined, true);
      const parsed = JSON.parse(result) as { nodes: unknown[] };
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(parsed.nodes).toHaveLength(1);
    });

    it("returns empty message when docker returns no nodes", () => {
      mockExecFileSync.mockReturnValue("");
      const result = listNodes();
      expect(result).toContain("No swarm nodes");
    });

    it("passes --context to docker args when specified", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([{ Hostname: "n1", Status: "Ready", Availability: "Active", ManagerStatus: "" }]),
      );
      listNodes("mycontext");
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "docker",
        expect.arrayContaining(["--context", "mycontext"]),
        expect.anything(),
      );
    });

    it("throws when docker command fails", () => {
      const err = Object.assign(new Error("docker not running"), { stderr: Buffer.from("connection refused") });
      mockExecFileSync.mockImplementation(() => {
        throw err;
      });
      expect(() => listNodes()).toThrow("connection refused");
    });
  });

  describe("listServices", () => {
    it("returns formatted table output", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([
          { Name: "my-web", Mode: "replicated", Replicas: "3/3", Ports: "80:80" },
        ]),
      );
      const result = listServices();
      expect(result).toContain("my-web");
      expect(result).toContain("NAME");
    });

    it("returns JSON when asJson is true", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([{ Name: "svc", Mode: "replicated", Replicas: "1/1", Ports: "" }]),
      );
      const result = listServices(undefined, true);
      const parsed = JSON.parse(result) as { services: unknown[] };
      expect(Array.isArray(parsed.services)).toBe(true);
    });

    it("returns empty message when no services", () => {
      mockExecFileSync.mockReturnValue("");
      expect(listServices()).toContain("No swarm services");
    });
  });

  describe("inspectService", () => {
    it("returns human-readable service summary", () => {
      const serviceSpec = {
        Spec: {
          Name: "my-web",
          TaskTemplate: {
            ContainerSpec: { Image: "nginx:latest" },
            Placement: { Constraints: [] },
          },
          Mode: { Replicated: { Replicas: 3 } },
          EndpointSpec: { Ports: [] },
          UpdateConfig: { Order: "stop-first" },
        },
      };
      mockExecFileSync.mockReturnValue(JSON.stringify([serviceSpec]));
      const result = inspectService("my-web");
      expect(result).toContain("my-web");
      expect(result).toContain("nginx:latest");
      expect(result).toContain("stop-first");
    });

    it("throws when service name is empty", () => {
      expect(() => inspectService("")).toThrow("service name is required");
    });

    it("throws when service is not found", () => {
      mockExecFileSync.mockReturnValue("[]");
      expect(() => inspectService("missing-svc")).toThrow("Service not found");
    });

    it("returns JSON when asJson is true", () => {
      const serviceSpec = { Spec: { Name: "svc", TaskTemplate: { ContainerSpec: {}, Placement: {} }, Mode: {}, EndpointSpec: {}, UpdateConfig: {} } };
      mockExecFileSync.mockReturnValue(JSON.stringify([serviceSpec]));
      const result = inspectService("svc", undefined, true);
      const parsed = JSON.parse(result) as { service: unknown };
      expect(parsed.service).toBeDefined();
    });
  });

  describe("getLeaderStatus", () => {
    it("returns human-readable leader info", () => {
      const swarmInfo = { LocalNodeState: "active", ControlAvailable: true, Cluster: { ID: "abc123" } };
      mockExecFileSync
        .mockReturnValueOnce(JSON.stringify(swarmInfo))
        .mockReturnValueOnce(
          makeMockOutput([{ Hostname: "manager-a", ManagerStatus: "Leader" }]),
        );

      const result = getLeaderStatus();
      expect(result).toContain("manager-a");
      expect(result).toContain("Leader");
    });

    it("returns JSON when asJson is true", () => {
      mockExecFileSync
        .mockReturnValueOnce(JSON.stringify({ LocalNodeState: "active", Cluster: {} }))
        .mockReturnValueOnce(makeMockOutput([{ Hostname: "m1", ManagerStatus: "Leader" }]));

      const result = getLeaderStatus(undefined, true);
      const parsed = JSON.parse(result) as { swarm: unknown };
      expect(parsed.swarm).toBeDefined();
    });
  });

  describe("listServiceTasks", () => {
    it("throws when service name is empty", () => {
      expect(() => listServiceTasks({ serviceName: "" })).toThrow("service name is required");
    });

    it("returns formatted table", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([
          { Name: "task.1", Node: "manager-a", DesiredState: "Running", CurrentState: "Running", Error: "" },
        ]),
      );
      const result = listServiceTasks({ serviceName: "my-web" });
      expect(result).toContain("task.1");
    });

    it("returns JSON when asJson is true", () => {
      mockExecFileSync.mockReturnValue(
        makeMockOutput([{ Name: "t1", Node: "n1", DesiredState: "Running", CurrentState: "Running", Error: "" }]),
      );
      const result = listServiceTasks({ serviceName: "svc", asJson: true });
      const parsed = JSON.parse(result) as { tasks: unknown[] };
      expect(Array.isArray(parsed.tasks)).toBe(true);
    });
  });

  describe("listTasks (ps)", () => {
    it("returns table grouped by node", () => {
      mockExecFileSync
        .mockReturnValueOnce(makeMockOutput([{ Hostname: "n1" }]))
        .mockReturnValueOnce(
          makeMockOutput([{ Name: "task.1", Image: "nginx", CurrentState: "Running", Error: "" }]),
        );
      const result = listTasks({});
      expect(result).toContain("Node: n1");
    });

    it("returns JSON when asJson is true", () => {
      mockExecFileSync
        .mockReturnValueOnce(makeMockOutput([{ Hostname: "n1" }]))
        .mockReturnValueOnce(makeMockOutput([{ Name: "t1", Image: "img", CurrentState: "Running", Error: "" }]));
      const result = listTasks({ asJson: true });
      const parsed = JSON.parse(result) as { taskGroups: unknown[] };
      expect(Array.isArray(parsed.taskGroups)).toBe(true);
    });
  });

  describe("Phase 2 resources", () => {
    it("lists stacks with JSON-line formatting", () => {
      mockExecFileSync.mockReturnValue(makeMockOutput([{ Name: "apps", Services: "3", Orchestrator: "Swarm" }]));
      const result = listStacks();
      expect(result).toContain("apps");
      expect(mockExecFileSync).toHaveBeenCalledWith("docker", ["stack", "ls", "--format", "{{json .}}"], expect.anything());
    });

    it("deploys stacks only when confirmed", () => {
      expect(() => deployStack({ filePath: "compose.yml", stackName: "apps" })).toThrow("confirmation");
      mockExecFileSync.mockReturnValue("Creating service");
      deployStack({ filePath: "compose.yml", stackName: "apps", confirm: true });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "docker",
        ["stack", "deploy", "--compose-file", "compose.yml", "apps"],
        expect.anything(),
      );
    });

    it("pipes stdin content for secret creation without adding it to argv", () => {
      mockExecFileSync.mockReturnValue("secret-id");
      createSecret({ name: "api_token", stdin: "super-secret", confirm: true });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "docker",
        ["secret", "create", "api_token", "-"],
        expect.objectContaining({ input: "super-secret" }),
      );
    });

    it("pipes stdin content for config creation without adding it to argv", () => {
      mockExecFileSync.mockReturnValue("config-id");
      createConfig({ name: "app_conf", stdin: "password=secret", confirm: true });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "docker",
        ["config", "create", "app_conf", "-"],
        expect.objectContaining({ input: "password=secret" }),
      );
    });

    it("lists networks and updates node labels", () => {
      mockExecFileSync.mockReturnValueOnce(makeMockOutput([{ ID: "abc", Name: "app_net", Driver: "overlay", Scope: "swarm" }]));
      expect(listNetworks()).toContain("app_net");
      mockExecFileSync.mockReturnValueOnce("");
      updateNodeLabel({ action: "add", target: "worker-a", key: "zone", value: "east", confirm: true });
      expect(mockExecFileSync).toHaveBeenLastCalledWith(
        "docker",
        ["node", "update", "--label-add", "zone=east", "worker-a"],
        expect.anything(),
      );
    });

    it("builds service log args with follow filters", () => {
      mockExecFileSync.mockReturnValue("line 1");
      readServiceLogs({ serviceName: "web", follow: true, since: "1h", tail: "20" });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        "docker",
        ["service", "logs", "--follow", "--since", "1h", "--tail", "20", "web"],
        expect.anything(),
      );
    });
  });
});
