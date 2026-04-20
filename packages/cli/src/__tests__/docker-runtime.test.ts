import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

// Import after mocking
const { listNodes, listServices, inspectService, getLeaderStatus, listTasks, listServiceTasks } = await import(
  "../docker-runtime.js"
);

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
});
