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

function runDocker(args: string[], options: DockerOptions = {}, input?: string): string {
  const fullArgs = buildDockerArgs(args, options);

  try {
    return execFileSync("docker", fullArgs, {
      encoding: "utf8",
      input,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
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

export function listStacks(context?: string, asJson = false): string {
  const stacks = runDockerJsonLines(["stack", "ls", "--format", "{{json .}}"], { context });
  if (asJson) return JSON.stringify({ context: context ?? null, stacks }, null, 2);
  if (!stacks.length) return "No stacks were returned by Docker.";
  return formatTable([
    ["NAME", "SERVICES", "ORCHESTRATOR"],
    ...stacks.map((stack) => [stack.Name ?? "unknown", stack.Services ?? "-", stack.Orchestrator ?? "-"]),
  ]);
}

export function listStackTasks(options: { stackName: string; context?: string; asJson?: boolean }): string {
  if (!options.stackName.trim()) throw new Error("A stack name is required.");
  const tasks = runDockerJsonLines(["stack", "ps", options.stackName.trim(), "--format", "{{json .}}"], {
    context: options.context,
  });
  if (options.asJson) return JSON.stringify({ context: options.context ?? null, stackName: options.stackName, tasks }, null, 2);
  if (!tasks.length) return `No tasks were returned for stack ${options.stackName}.`;
  return formatTable([
    ["NAME", "IMAGE", "NODE", "DESIRED", "CURRENT STATE", "ERROR"],
    ...tasks.map((task) => [
      task.Name ?? "unknown",
      task.Image ?? "unknown",
      task.Node ?? "unknown",
      task.DesiredState ?? "unknown",
      task.CurrentState ?? "unknown",
      task.Error ?? "-",
    ]),
  ]);
}

export function listStackServices(options: { stackName: string; context?: string; asJson?: boolean }): string {
  if (!options.stackName.trim()) throw new Error("A stack name is required.");
  const services = runDockerJsonLines(["stack", "services", options.stackName.trim(), "--format", "{{json .}}"], {
    context: options.context,
  });
  if (options.asJson) return JSON.stringify({ context: options.context ?? null, stackName: options.stackName, services }, null, 2);
  if (!services.length) return `No services were returned for stack ${options.stackName}.`;
  return formatTable([
    ["NAME", "MODE", "REPLICAS", "IMAGE", "PORTS"],
    ...services.map((service) => [
      service.Name ?? "unknown",
      service.Mode ?? "unknown",
      service.Replicas ?? "unknown",
      service.Image ?? "unknown",
      service.Ports ?? "-",
    ]),
  ]);
}

export function deployStack(options: { filePath: string; stackName: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Stack deploy requires explicit confirmation.");
  if (!options.filePath.trim()) throw new Error("--file is required for stack deploy.");
  if (!options.stackName.trim()) throw new Error("--name is required for stack deploy.");
  return runDocker(["stack", "deploy", "--compose-file", options.filePath.trim(), options.stackName.trim()], {
    context: options.context,
  }) || `Stack ${options.stackName.trim()} deploy requested.`;
}

export function removeStack(options: { stackName: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Stack removal requires explicit confirmation.");
  if (!options.stackName.trim()) throw new Error("A stack name is required.");
  return runDocker(["stack", "rm", options.stackName.trim()], { context: options.context }) || `Stack ${options.stackName.trim()} removal requested.`;
}

export function listSecrets(context?: string, asJson = false): string {
  const secrets = runDockerJsonLines(["secret", "ls", "--format", "{{json .}}"], { context });
  if (asJson) return JSON.stringify({ context: context ?? null, secrets }, null, 2);
  if (!secrets.length) return "No secrets were returned by Docker.";
  return formatTable([
    ["ID", "NAME", "CREATED", "UPDATED"],
    ...secrets.map((secret) => [secret.ID ?? "-", secret.Name ?? "unknown", secret.CreatedAt ?? "-", secret.UpdatedAt ?? "-"]),
  ]);
}

export function inspectSecret(name: string, context?: string, asJson = false): string {
  if (!name.trim()) throw new Error("A secret name is required.");
  const secrets = JSON.parse(runDocker(["secret", "inspect", name.trim()], { context }) || "[]") as Array<Record<string, unknown>>;
  const secret = secrets[0];
  if (!secret) throw new Error(`Secret not found: ${name}`);
  if (asJson) return JSON.stringify({ context: context ?? null, secret }, null, 2);
  const spec = (secret.Spec ?? {}) as Record<string, unknown>;
  return [`ID: ${String(secret.ID ?? "-")}`, `Name: ${String(spec.Name ?? name)}`, `Created: ${String(secret.CreatedAt ?? "-")}`, `Updated: ${String(secret.UpdatedAt ?? "-")}`].join("\n");
}

export function createSecret(options: { name: string; filePath?: string; stdin?: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Secret creation requires explicit confirmation.");
  if (!options.name.trim()) throw new Error("--name is required for secret create.");
  if (options.stdin !== undefined) {
    return runDocker(["secret", "create", options.name.trim(), "-"], { context: options.context }, options.stdin) || `Secret ${options.name.trim()} created.`;
  }
  if (options.filePath?.trim()) {
    return runDocker(["secret", "create", options.name.trim(), options.filePath.trim()], { context: options.context }) || `Secret ${options.name.trim()} created.`;
  }
  throw new Error("Secret creation requires --file or --stdin.");
}

export function removeSecret(options: { name: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Secret removal requires explicit confirmation.");
  if (!options.name.trim()) throw new Error("A secret name is required.");
  return runDocker(["secret", "rm", options.name.trim()], { context: options.context }) || `Secret ${options.name.trim()} removed.`;
}

export function listConfigs(context?: string, asJson = false): string {
  const configs = runDockerJsonLines(["config", "ls", "--format", "{{json .}}"], { context });
  if (asJson) return JSON.stringify({ context: context ?? null, configs }, null, 2);
  if (!configs.length) return "No configs were returned by Docker.";
  return formatTable([
    ["ID", "NAME", "CREATED", "UPDATED"],
    ...configs.map((config) => [config.ID ?? "-", config.Name ?? "unknown", config.CreatedAt ?? "-", config.UpdatedAt ?? "-"]),
  ]);
}

export function inspectConfig(name: string, context?: string, asJson = false): string {
  if (!name.trim()) throw new Error("A config name is required.");
  const configs = JSON.parse(runDocker(["config", "inspect", name.trim()], { context }) || "[]") as Array<Record<string, unknown>>;
  const config = configs[0];
  if (!config) throw new Error(`Config not found: ${name}`);
  if (asJson) return JSON.stringify({ context: context ?? null, config }, null, 2);
  const spec = (config.Spec ?? {}) as Record<string, unknown>;
  return [`ID: ${String(config.ID ?? "-")}`, `Name: ${String(spec.Name ?? name)}`, `Created: ${String(config.CreatedAt ?? "-")}`, `Updated: ${String(config.UpdatedAt ?? "-")}`].join("\n");
}

export function createConfig(options: { name: string; filePath?: string; stdin?: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Config creation requires explicit confirmation.");
  if (!options.name.trim()) throw new Error("--name is required for configs create.");
  if (options.stdin !== undefined) {
    return runDocker(["config", "create", options.name.trim(), "-"], { context: options.context }, options.stdin) || `Config ${options.name.trim()} created.`;
  }
  if (options.filePath?.trim()) {
    return runDocker(["config", "create", options.name.trim(), options.filePath.trim()], { context: options.context }) || `Config ${options.name.trim()} created.`;
  }
  throw new Error("Config creation requires --file or --stdin.");
}

export function removeConfig(options: { name: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Config removal requires explicit confirmation.");
  if (!options.name.trim()) throw new Error("A config name is required.");
  return runDocker(["config", "rm", options.name.trim()], { context: options.context }) || `Config ${options.name.trim()} removed.`;
}

export function listNetworks(context?: string, asJson = false): string {
  const networks = runDockerJsonLines(["network", "ls", "--format", "{{json .}}"], { context });
  if (asJson) return JSON.stringify({ context: context ?? null, networks }, null, 2);
  if (!networks.length) return "No networks were returned by Docker.";
  return formatTable([
    ["ID", "NAME", "DRIVER", "SCOPE"],
    ...networks.map((network) => [network.ID ?? "-", network.Name ?? "unknown", network.Driver ?? "-", network.Scope ?? "-"]),
  ]);
}

export function inspectNetwork(name: string, context?: string, asJson = false): string {
  if (!name.trim()) throw new Error("A network name is required.");
  const networks = JSON.parse(runDocker(["network", "inspect", name.trim()], { context }) || "[]") as Array<Record<string, unknown>>;
  const network = networks[0];
  if (!network) throw new Error(`Network not found: ${name}`);
  if (asJson) return JSON.stringify({ context: context ?? null, network }, null, 2);
  return [`ID: ${String(network.Id ?? "-")}`, `Name: ${String(network.Name ?? name)}`, `Driver: ${String(network.Driver ?? "-")}`, `Scope: ${String(network.Scope ?? "-")}`].join("\n");
}

export function createNetwork(options: { name: string; driver?: string; attachable?: boolean; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Network creation requires explicit confirmation.");
  if (!options.name.trim()) throw new Error("--name is required for network create.");
  const args = ["network", "create", "--driver", options.driver?.trim() || "overlay"];
  if (options.attachable !== false) args.push("--attachable");
  args.push(options.name.trim());
  return runDocker(args, { context: options.context }) || `Network ${options.name.trim()} created.`;
}

export function removeNetwork(options: { name: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Network removal requires explicit confirmation.");
  if (!options.name.trim()) throw new Error("A network name is required.");
  return runDocker(["network", "rm", options.name.trim()], { context: options.context }) || `Network ${options.name.trim()} removed.`;
}

export function updateNodeLabel(options: { action: "add" | "rm"; target: string; key: string; value?: string; context?: string; confirm?: boolean }): string {
  if (!options.confirm) throw new Error("Node label updates require explicit confirmation.");
  if (!options.target.trim()) throw new Error("--target is required for node label updates.");
  if (!options.key.trim()) throw new Error("--key is required for node label updates.");
  const label = options.action === "add" && options.value?.trim() ? `${options.key.trim()}=${options.value.trim()}` : options.key.trim();
  const flag = options.action === "add" ? "--label-add" : "--label-rm";
  return runDocker(["node", "update", flag, label, options.target.trim()], { context: options.context }) || `Node ${options.target.trim()} label ${options.action} completed.`;
}

export function readServiceLogs(options: { serviceName: string; context?: string; since?: string; tail?: string; follow?: boolean }): string {
  if (!options.serviceName.trim()) throw new Error("A service name is required.");
  const args = ["service", "logs"];
  if (options.follow) args.push("--follow");
  if (options.since?.trim()) args.push("--since", options.since.trim());
  if (options.tail?.trim()) args.push("--tail", options.tail.trim());
  args.push(options.serviceName.trim());
  return runDocker(args, { context: options.context }) || `No logs were returned for ${options.serviceName.trim()}.`;
}
