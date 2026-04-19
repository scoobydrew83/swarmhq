import { execFileSync } from "node:child_process";

type DockerOptions = {
  context?: string;
};

type JsonRecord = Record<string, string>;

function buildDockerArgs(args: string[], options: DockerOptions): string[] {
  if (options.context?.trim()) {
    return ["--context", options.context.trim(), ...args];
  }

  return args;
}

function runDocker(args: string[], options: DockerOptions = {}): string {
  const fullArgs = buildDockerArgs(args, options);

  try {
    return execFileSync("docker", fullArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const message =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr?: Buffer | string }).stderr ?? error.message).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(message || "Docker command failed");
  }
}

function runDockerJsonLines(args: string[], options: DockerOptions = {}): JsonRecord[] {
  const output = runDocker(args, options);
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonRecord);
}

function formatTable(lines: string[][]): string {
  const widths = lines[0].map((_, index) => Math.max(...lines.map((line) => line[index].length)));
  return lines
    .map((line) => line.map((value, index) => value.padEnd(widths[index])).join("  ").trimEnd())
    .join("\n");
}

export function listNodes(context?: string, asJson = false): string {
  const nodes = runDockerJsonLines(["node", "ls", "--format", "{{json .}}"], { context });

  if (asJson) {
    return JSON.stringify({ context: context ?? null, nodes }, null, 2);
  }

  if (!nodes.length) {
    return "No swarm nodes were returned by Docker.";
  }

  const rows = [
    ["HOSTNAME", "STATUS", "AVAILABILITY", "MANAGER"],
    ...nodes.map((node) => [
      node.Hostname ?? "unknown",
      node.Status ?? "unknown",
      node.Availability ?? "unknown",
      node.ManagerStatus ?? "-",
    ]),
  ];

  return formatTable(rows);
}

export function listServices(context?: string, asJson = false): string {
  const services = runDockerJsonLines(["service", "ls", "--format", "{{json .}}"], { context });

  if (asJson) {
    return JSON.stringify({ context: context ?? null, services }, null, 2);
  }

  if (!services.length) {
    return "No swarm services were returned by Docker.";
  }

  const rows = [
    ["NAME", "MODE", "REPLICAS", "PORTS"],
    ...services.map((service) => [
      service.Name ?? "unknown",
      service.Mode ?? "unknown",
      service.Replicas ?? "unknown",
      service.Ports ?? "-",
    ]),
  ];

  return formatTable(rows);
}

export function inspectService(name: string, context?: string, asJson = false): string {
  if (!name.trim()) {
    throw new Error("A service name is required.");
  }

  const services = JSON.parse(runDocker(["service", "inspect", name.trim()], { context }) || "[]") as Array<
    Record<string, unknown>
  >;
  const service = services[0];

  if (!service) {
    throw new Error(`Service not found: ${name}`);
  }

  if (asJson) {
    return JSON.stringify({ context: context ?? null, service }, null, 2);
  }

  const spec = (service.Spec ?? {}) as Record<string, unknown>;
  const taskTemplate = (spec.TaskTemplate ?? {}) as Record<string, unknown>;
  const containerSpec = (taskTemplate.ContainerSpec ?? {}) as Record<string, unknown>;
  const placement = (taskTemplate.Placement ?? {}) as Record<string, unknown>;
  const endpointSpec = (spec.EndpointSpec ?? {}) as Record<string, unknown>;
  const mode = (spec.Mode ?? {}) as Record<string, unknown>;
  const replicated = (mode.Replicated ?? {}) as Record<string, unknown>;
  const updateConfig = (spec.UpdateConfig ?? {}) as Record<string, unknown>;
  const constraints = Array.isArray(placement.Constraints)
    ? placement.Constraints.map((item) => String(item))
    : [];
  const ports = Array.isArray(endpointSpec.Ports)
    ? endpointSpec.Ports.map((item) => JSON.stringify(item)).join(", ")
    : "none";

  return [
    `Name: ${String(spec.Name ?? name)}`,
    `Image: ${String(containerSpec.Image ?? "unknown")}`,
    `Mode: ${mode.Global ? "global" : `replicated (${String(replicated.Replicas ?? "unknown")})`}`,
    `Ports: ${ports}`,
    `Update Strategy: ${String(updateConfig.Order ?? "default")}`,
    `Constraints: ${constraints.length ? constraints.join(", ") : "none"}`,
  ].join("\n");
}

export function listServiceTasks(options: {
  serviceName: string;
  context?: string;
  all?: boolean;
  asJson?: boolean;
}): string {
  if (!options.serviceName.trim()) {
    throw new Error("A service name is required.");
  }

  const args = ["service", "ps", options.serviceName.trim(), "--format", "{{json .}}"];
  if (!options.all) {
    args.splice(2, 0, "--filter", "desired-state=running");
  }

  const tasks = runDockerJsonLines(args, { context: options.context });

  if (options.asJson) {
    return JSON.stringify(
      {
        context: options.context ?? null,
        serviceName: options.serviceName,
        all: Boolean(options.all),
        tasks,
      },
      null,
      2,
    );
  }

  if (!tasks.length) {
    return `No tasks were returned for service ${options.serviceName}.`;
  }

  const rows = [
    ["NAME", "NODE", "DESIRED", "CURRENT STATE", "ERROR"],
    ...tasks.map((task) => [
      task.Name ?? "unknown",
      task.Node ?? "unknown",
      task.DesiredState ?? "unknown",
      task.CurrentState ?? "unknown",
      task.Error ?? "-",
    ]),
  ];

  return formatTable(rows);
}

export function getLeaderStatus(context?: string, asJson = false): string {
  const swarm = JSON.parse(
    runDocker(["info", "--format", "{{json .Swarm}}"], { context }) || "{}",
  ) as Record<string, unknown>;
  const cluster = (swarm.Cluster ?? {}) as Record<string, unknown>;
  const nodes = runDockerJsonLines(["node", "ls", "--format", "{{json .}}"], { context });
  const leader = nodes.find((node) => (node.ManagerStatus ?? "").includes("Leader"));

  if (asJson) {
    return JSON.stringify({ context: context ?? null, swarm, leader, managers: nodes }, null, 2);
  }

  const lines = [
    `Cluster ID: ${String(cluster.ID ?? "unknown")}`,
    `Local State: ${String(swarm.LocalNodeState ?? "unknown")}`,
    `Control Available: ${String(swarm.ControlAvailable ?? "unknown")}`,
    `Leader: ${leader?.Hostname ?? "unknown"}${leader?.ManagerStatus ? ` (${leader.ManagerStatus})` : ""}`,
    `Managers: ${nodes.length}`,
  ];

  return lines.join("\n");
}

export function listTasks(options: {
  context?: string;
  node?: string;
  all?: boolean;
  asJson?: boolean;
}): string {
  const targets = options.node?.trim()
    ? [options.node.trim()]
    : runDockerJsonLines(["node", "ls", "--format", "{{json .}}"], {
        context: options.context,
      }).map((node) => node.Hostname ?? "unknown");

  const taskGroups = targets.map((target) => {
    const args = ["node", "ps", target, "--format", "{{json .}}"];
    if (!options.all) {
      args.splice(2, 0, "--filter", "desired-state=running");
    }

    return {
      node: target,
      tasks: runDockerJsonLines(args, { context: options.context }),
    };
  });

  if (options.asJson) {
    return JSON.stringify(
      {
        context: options.context ?? null,
        node: options.node ?? null,
        all: Boolean(options.all),
        taskGroups,
      },
      null,
      2,
    );
  }

  if (!taskGroups.some((group) => group.tasks.length)) {
    return "No tasks were returned by Docker.";
  }

  return taskGroups
    .map((group) => {
      const rows = [
        ["NAME", "IMAGE", "CURRENT STATE", "ERROR"],
        ...group.tasks.map((task) => [
          task.Name ?? "unknown",
          task.Image ?? "unknown",
          task.CurrentState ?? "unknown",
          task.Error ?? "-",
        ]),
      ];

      return [`Node: ${group.node}`, formatTable(rows)].join("\n");
    })
    .join("\n\n");
}
