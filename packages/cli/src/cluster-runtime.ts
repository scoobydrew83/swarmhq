import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";
import {
  loadConfig,
  loadRuntimeSecrets,
  type HostKeyCheckingMode,
  type SwarmConfig,
  type SwarmNode,
} from "@swarm-cli/core";

const execFileAsync = promisify(execFile);

const SAFE_HOSTNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,252}$/;

function validateRemoteHostname(hostname: string): void {
  if (!SAFE_HOSTNAME_RE.test(hostname)) {
    throw new Error(`Unexpected hostname format from remote: ${JSON.stringify(hostname)}`);
  }
}

type NodeConnectivity = {
  node: SwarmNode;
  reachable: boolean;
  sshOk: boolean;
};

type LeaderDetails = {
  probeNode: SwarmNode;
  leaderNode: SwarmNode | null;
  leaderHostname: string;
  leaderIp: string;
  leaderServer: string;
};

type ServiceSummary = {
  name: string;
  replicas: string;
};

type NodeSummary = {
  hostname: string;
  status: string;
  availability: string;
  managerStatus: string;
};

type HealthReportPayload = {
  status: "healthy" | "warning" | "critical";
  configPath: string;
  clusterName: string;
  vip: string;
  connectivity: Array<{
    id: string;
    host: string;
    username: string;
    reachable: boolean;
    sshOk: boolean;
  }>;
  leader?: {
    hostname: string;
    ip: string;
    server: string;
  };
  vipHolder?: {
    id: string;
    host: string;
    username: string;
  };
  vipSynchronized?: boolean;
  nodes: NodeSummary[];
  services: ServiceSummary[];
  warnings: string[];
  errors: string[];
};

type HealthOutputMode = "summary" | "detailed" | "json";

type RuntimeContext = {
  config: SwarmConfig;
  configPath: string;
  hostnameCache: Map<string, string>;
  sshUserCache: Map<string, string>;
};

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildBashCommand(script: string): string {
  return `bash -lc ${shellEscape(script)}`;
}

function formatTable(lines: string[][]): string {
  if (!lines.length) {
    return "";
  }

  const widths = lines[0].map((_, index) => Math.max(...lines.map((line) => line[index].length)));
  return lines
    .map((line) => line.map((value, index) => value.padEnd(widths[index])).join("  ").trimEnd())
    .join("\n");
}

function readContext(configPath?: string): RuntimeContext {
  const loaded = loadConfig(configPath);
  return {
    config: loaded.config,
    configPath: loaded.path,
    hostnameCache: new Map<string, string>(),
    sshUserCache: new Map<string, string>(),
  };
}

function getServer(node: SwarmNode, username = node.username): string {
  return `${username}@${node.host}`;
}

function getResolvedServer(context: RuntimeContext, node: SwarmNode): string {
  return getServer(node, context.sshUserCache.get(node.id) ?? node.username);
}

function mapHostKeyChecking(mode: HostKeyCheckingMode): string {
  switch (mode) {
    case "strict":
      return "yes";
    case "insecure":
      return "no";
    default:
      return "accept-new";
  }
}

function buildSshArgs(
  context: RuntimeContext,
  node: SwarmNode,
  command: string,
  username = node.username,
): string[] {
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    `ConnectTimeout=10`,
    "-o",
    `StrictHostKeyChecking=${mapHostKeyChecking(context.config.ssh.strictHostKeyChecking)}`,
    "-p",
    String(context.config.ssh.port),
  ];

  if (context.config.ssh.strictHostKeyChecking === "insecure") {
    args.push("-o", "UserKnownHostsFile=/dev/null");
  }

  args.push(getServer(node, username), command);
  return args;
}

function extractExecError(error: unknown): string {
  if (error instanceof Error && "stderr" in error) {
    return String((error as { stderr?: string | Buffer }).stderr ?? error.message).trim() || error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

async function execSsh(context: RuntimeContext, node: SwarmNode, command: string): Promise<string> {
  const cachedUser = context.sshUserCache.get(node.id);
  const candidates = [
    ...(cachedUser ? [cachedUser] : []),
    node.username,
    "root",
  ].filter((value, index, array) => value.trim() && array.indexOf(value) === index);

  let lastError = `SSH command failed on ${node.host}`;

  for (const username of candidates) {
    try {
      const { stdout } = await execFileAsync("ssh", buildSshArgs(context, node, command, username), {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      context.sshUserCache.set(node.id, username);
      return stdout.trim();
    } catch (error) {
      lastError = extractExecError(error) || lastError;

      if (!/permission denied|publickey|authentication failed|too many authentication failures/i.test(lastError)) {
        throw new Error(lastError);
      }
    }
  }

  throw new Error(lastError);
}

async function tryExecSsh(context: RuntimeContext, node: SwarmNode, command: string): Promise<string | null> {
  try {
    return await execSsh(context, node, command);
  } catch {
    return null;
  }
}

function checkPort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function checkNodeConnectivity(context: RuntimeContext, node: SwarmNode): Promise<NodeConnectivity> {
  const reachable = await checkPort(node.host, context.config.ssh.port, 3000);
  if (!reachable) {
    return { node, reachable: false, sshOk: false };
  }

  const sshOk = (await tryExecSsh(context, node, "printf OK")) === "OK";
  return { node, reachable: true, sshOk };
}

async function getNodeHostname(context: RuntimeContext, node: SwarmNode): Promise<string | null> {
  const cached = context.hostnameCache.get(node.id);
  if (cached) {
    return cached;
  }

  const hostname = await tryExecSsh(context, node, "hostname");
  if (hostname?.trim()) {
    context.hostnameCache.set(node.id, hostname.trim());
    return hostname.trim();
  }

  return null;
}

async function findNodeByHostname(context: RuntimeContext, hostname: string): Promise<SwarmNode | null> {
  for (const node of context.config.nodes) {
    const remoteHostname = await getNodeHostname(context, node);
    if (remoteHostname === hostname) {
      return node;
    }
  }

  return null;
}

async function resolveLeader(context: RuntimeContext): Promise<LeaderDetails> {
  const candidates = [
    ...context.config.nodes.filter((node) => node.roles.includes("manager")),
    ...context.config.nodes.filter((node) => !node.roles.includes("manager")),
  ];

  for (const node of candidates) {
    const connectivity = await checkNodeConnectivity(context, node);
    if (!connectivity.sshOk) {
      continue;
    }

    const leaderList = await tryExecSsh(
      context,
      node,
      "docker node ls --filter role=manager --format '{{.Hostname}}\t{{.ManagerStatus}}'",
    );

    if (!leaderList) {
      continue;
    }

    const leaderLine = leaderList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /\bLeader\b/.test(line));

    if (!leaderLine) {
      continue;
    }

    const [leaderHostname] = leaderLine.split("\t");
    validateRemoteHostname(leaderHostname);
    const leaderIp =
      (await tryExecSsh(
        context,
        node,
        `docker node inspect ${shellEscape(leaderHostname)} --format '{{.Status.Addr}}'`,
      ))?.trim() ?? "";

    const leaderNode =
      context.config.nodes.find((entry) => entry.host === leaderIp) ??
      (await findNodeByHostname(context, leaderHostname));

    return {
      probeNode: node,
      leaderNode: leaderNode ?? null,
      leaderHostname,
      leaderIp,
      leaderServer: leaderNode ? getResolvedServer(context, leaderNode) : `${context.sshUserCache.get(node.id) ?? node.username}@${leaderIp || leaderHostname}`,
    };
  }

  throw new Error("No swarm leader found through the configured nodes.");
}

async function findVipHolder(context: RuntimeContext): Promise<SwarmNode | null> {
  const vip = context.config.vip.trim();

  for (const node of context.config.nodes) {
    const output = await tryExecSsh(context, node, `ip addr show | grep -w -- ${shellEscape(vip)}`);
    if (output) {
      return node;
    }
  }

  return null;
}

async function runLeaderDockerCommand(context: RuntimeContext, command: string): Promise<string> {
  const leader = await resolveLeader(context);
  const target = leader.leaderNode ?? leader.probeNode;
  return await execSsh(context, target, command);
}

async function getSwarmNodesSummary(context: RuntimeContext): Promise<NodeSummary[]> {
  const output = await runLeaderDockerCommand(
    context,
    "docker node ls --format '{{.Hostname}}\t{{.Status}}\t{{.Availability}}\t{{.ManagerStatus}}'",
  );

  if (!output.trim()) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hostname = "unknown", status = "unknown", availability = "unknown", managerStatus = ""] =
        line.split("\t");
      return { hostname, status, availability, managerStatus };
    });
}

async function getServicesSummary(context: RuntimeContext): Promise<ServiceSummary[]> {
  const output = await runLeaderDockerCommand(
    context,
    "docker service ls --format '{{.Name}}\t{{.Replicas}}'",
  );

  if (!output.trim()) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [name = "unknown", replicas = "unknown"] = line.split("\t");
      return { name, replicas };
    });
}

async function getNodeRole(context: RuntimeContext, node: SwarmNode): Promise<string> {
  return (await tryExecSsh(context, node, "docker node inspect self --format '{{.Spec.Role}}'"))?.trim() || "unknown";
}

async function getDockerVersion(context: RuntimeContext, node: SwarmNode): Promise<string> {
  return (
    (await tryExecSsh(context, node, "docker version --format '{{.Server.Version}}'"))?.trim() || "unknown"
  );
}

async function getKeepalivedState(context: RuntimeContext, node: SwarmNode): Promise<string> {
  const runtime = (await tryExecSsh(
    context,
    node,
    `ip addr show | grep -w -- ${shellEscape(context.config.vip.trim())} >/dev/null && echo MASTER || true`,
  ))?.trim();

  if (runtime === "MASTER") {
    return "MASTER";
  }

  return (
    (await tryExecSsh(
      context,
      node,
      "awk '/^[[:space:]]*state[[:space:]]+/ {print $2; exit}' /etc/keepalived/keepalived.conf 2>/dev/null",
    ))?.trim() || "BACKUP"
  );
}

async function getKeepalivedPriority(context: RuntimeContext, node: SwarmNode): Promise<string> {
  return (
    (await tryExecSsh(
      context,
      node,
      "awk '/^[[:space:]]*priority[[:space:]]+/ {print $2; exit}' /etc/keepalived/keepalived.conf 2>/dev/null",
    ))?.trim() || "unknown"
  );
}

async function isKeepalivedActive(context: RuntimeContext, node: SwarmNode): Promise<boolean> {
  return (await tryExecSsh(context, node, "systemctl is-active keepalived"))?.trim() === "active";
}

async function hasVipOnNode(context: RuntimeContext, node: SwarmNode): Promise<boolean> {
  return Boolean(
    await tryExecSsh(context, node, `ip addr show | grep -w -- ${shellEscape(context.config.vip.trim())}`),
  );
}

function resolveNodeTarget(context: RuntimeContext, target: string): SwarmNode {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error("A target node is required.");
  }

  const direct =
    context.config.nodes.find((node) => node.id === trimmed) ??
    context.config.nodes.find((node) => node.host === trimmed);

  if (direct) {
    return direct;
  }

  const lower = trimmed.toLowerCase();
  const byHost = context.config.nodes.find((node) => node.id.toLowerCase() === lower || node.host.toLowerCase() === lower);
  if (byHost) {
    return byHost;
  }

  throw new Error(`Target node not found in config: ${trimmed}`);
}

function renderNodeConnectivity(results: NodeConnectivity[]): string[] {
  return results.map(({ node, reachable, sshOk }) => {
    if (!reachable) {
      return `${node.host.padEnd(15)}  ❌ ✗ Unreachable`;
    }

    if (!sshOk) {
      return `${node.host.padEnd(15)}  ⚠️  Online (SSH FAILED)`;
    }

    return `${node.host.padEnd(15)}  ✅ ✓ Online (SSH OK)`;
  });
}

function renderSwarmNodes(nodes: NodeSummary[]): string[] {
  if (!nodes.length) {
    return ["No swarm nodes were returned by the leader."];
  }

  return nodes.map((node) => {
    const managerDisplay = node.managerStatus
      ? node.managerStatus.includes("Leader")
        ? "👑 Leader"
        : `🏛️  ${node.managerStatus}`
      : "👷 Worker";

    return `${node.hostname.padEnd(15)}  ${node.status.padEnd(8)}  ${node.availability.padEnd(8)}  ${managerDisplay}`;
  });
}

function renderServices(services: ServiceSummary[]): string[] {
  if (!services.length) {
    return ["No services running"];
  }

  const rows = services.map((service) => [service.name, service.replicas]);
  const nameWidth = Math.max(...rows.map(([name]) => name.length), 8);
  return rows.map(([name, replicas]) => `${name.padEnd(nameWidth)}  ${replicas}`);
}

export async function buildRemoteHealthReport(options: {
  configPath?: string;
  mode?: HealthOutputMode;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const mode: HealthOutputMode = options.asJson ? "json" : options.mode ?? "summary";
  const connectivity = await Promise.all(context.config.nodes.map((node) => checkNodeConnectivity(context, node)));
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const result of connectivity) {
    if (!result.reachable) {
      errors.push(`${result.node.host} is unreachable on SSH port ${context.config.ssh.port}.`);
    } else if (!result.sshOk) {
      warnings.push(`${result.node.host} is reachable but SSH authentication failed.`);
    }
  }

  let leader: LeaderDetails | null = null;
  let swarmNodes: NodeSummary[] = [];
  let services: ServiceSummary[] = [];

  try {
    leader = await resolveLeader(context);
    swarmNodes = await getSwarmNodesSummary(context);
    services = await getServicesSummary(context);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  let vipHolder: SwarmNode | null = null;
  try {
    vipHolder = await findVipHolder(context);
    if (!vipHolder) {
      errors.push(`No VIP holder was found for ${context.config.vip}.`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const vipSynchronized = Boolean(vipHolder && leader && vipHolder.host === leader.leaderIp);
  if (vipHolder && leader && !vipSynchronized) {
    warnings.push(`VIP holder ${vipHolder.host} differs from swarm leader ${leader.leaderIp}.`);
  }

  const status = errors.length ? "critical" : warnings.length ? "warning" : "healthy";

  if (mode === "json") {
    const payload: HealthReportPayload = {
      status,
      configPath: context.configPath,
      clusterName: context.config.clusterName,
      vip: context.config.vip,
      connectivity: connectivity.map((result) => ({
        id: result.node.id,
        host: result.node.host,
        username: result.node.username,
        reachable: result.reachable,
        sshOk: result.sshOk,
      })),
      leader: leader
        ? {
            hostname: leader.leaderHostname,
            ip: leader.leaderIp,
            server: leader.leaderServer,
          }
        : undefined,
      vipHolder: vipHolder
        ? {
            id: vipHolder.id,
            host: vipHolder.host,
            username: vipHolder.username,
          }
        : undefined,
      vipSynchronized: leader && vipHolder ? vipSynchronized : undefined,
      nodes: swarmNodes,
      services,
      warnings,
      errors,
    };

    return JSON.stringify(payload, null, 2);
  }

  const lines = [
    "",
    "=== Docker Swarm Health Check ===",
    "",
    "",
    "━━━ Node Connectivity ━━━",
    ...renderNodeConnectivity(connectivity),
    "",
    "",
    "━━━ Swarm Status ━━━",
  ];

  if (leader) {
    lines.push(`✅ Leader: ${leader.leaderIp || leader.leaderHostname}`);
    lines.push("");
    lines.push("=== Docker Swarm Status ===");
    lines.push("");
    lines.push(`[${new Date().toLocaleTimeString("en-US", { hour12: false })}] Swarm Leader: ${leader.leaderServer}`);
    lines.push("");
    lines.push("");
    lines.push("━━━ Swarm Nodes ━━━");
    lines.push(...renderSwarmNodes(swarmNodes));
    lines.push("");
    lines.push("");
    lines.push("━━━ Services ━━━");
    lines.push(...renderServices(services));
  } else {
    lines.push("❌ No swarm leader found!");
  }

  if (mode === "detailed") {
    const sshReadyNodes = connectivity.filter((result) => result.sshOk).map((result) => result.node);

    lines.push("");
    lines.push("");
    lines.push("━━━ Node Details ━━━");

    if (!sshReadyNodes.length) {
      lines.push("No nodes are currently available over SSH.");
    } else {
      for (const node of sshReadyNodes) {
        const hostname = (await getNodeHostname(context, node)) ?? node.id;
        const role = await getNodeRole(context, node);
        const dockerVersion = await getDockerVersion(context, node);
        lines.push(`${node.host} (${hostname})`);
        lines.push(`  Role: ${role}`);
        lines.push(`  Docker: ${dockerVersion}`);
        lines.push("");
      }

      if (lines[lines.length - 1] === "") {
        lines.pop();
      }
    }

    lines.push("");
    lines.push("");
    lines.push("━━━ Keepalived Status ━━━");

    if (!sshReadyNodes.length) {
      lines.push("No keepalived data available without SSH connectivity.");
    } else {
      for (const node of sshReadyNodes) {
        const state = await getKeepalivedState(context, node);
        const priority = await getKeepalivedPriority(context, node);
        const active = await isKeepalivedActive(context, node);
        const hasVip = await hasVipOnNode(context, node);
        lines.push(
          `${node.host.padEnd(15)}  ${active ? "active" : "inactive"}  ${state.padEnd(6)}  Priority: ${priority}  ${hasVip ? "VIP active" : "standby"}`,
        );
      }
    }
  }

  lines.push("");
  lines.push("");
  lines.push("━━━ Keepalived VIP ━━━");

  if (vipHolder) {
    lines.push(`✅ VIP holder: ${vipHolder.host}`);
    if (leader) {
      lines.push(vipSynchronized ? "✅ VIP synchronized with swarm leader" : `⚠️  VIP differs from leader (${leader.leaderIp})`);
    }
  } else {
    lines.push("❌ No VIP holder found!");
  }

  lines.push("");

  if (status === "critical") {
    lines.push("❌ Health check FAILED - critical issues detected");
  } else if (status === "warning") {
    lines.push("⚠️  Health check PASSED with warnings");
  } else {
    lines.push("✅ Health check PASSED - all systems operational");
  }

  return lines.join("\n");
}

async function runRemoteJsonLines(context: RuntimeContext, command: string): Promise<Array<Record<string, string>>> {
  const output = await runLeaderDockerCommand(context, command);
  if (!output.trim()) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, string>);
}

export async function listClusterNodes(options: {
  configPath?: string;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const nodes = await runRemoteJsonLines(context, "docker node ls --format '{{json .}}'");

  if (options.asJson) {
    return JSON.stringify({ configPath: context.configPath, nodes }, null, 2);
  }

  if (!nodes.length) {
    return "No swarm nodes were returned by the leader.";
  }

  const rows = [
    ["HOSTNAME", "STATUS", "AVAILABILITY", "MANAGER"],
    ...nodes.map((node) => [
      node.Hostname ?? "unknown",
      node.Status ?? "unknown",
      node.Availability ?? "unknown",
      node.ManagerStatus ?? "worker",
    ]),
  ];

  return formatTable(rows);
}

export async function listClusterServices(options: {
  configPath?: string;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const services = await runRemoteJsonLines(context, "docker service ls --format '{{json .}}'");

  if (options.asJson) {
    return JSON.stringify({ configPath: context.configPath, services }, null, 2);
  }

  if (!services.length) {
    return "No swarm services were returned by the leader.";
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

export async function inspectClusterService(options: {
  configPath?: string;
  serviceName: string;
  asJson?: boolean;
}): Promise<string> {
  if (!options.serviceName.trim()) {
    throw new Error("A service name is required.");
  }

  const context = readContext(options.configPath);
  const output = await runLeaderDockerCommand(
    context,
    `docker service inspect ${shellEscape(options.serviceName.trim())}`,
  );
  const services = JSON.parse(output || "[]") as Array<Record<string, unknown>>;
  const service = services[0];

  if (!service) {
    throw new Error(`Service not found: ${options.serviceName}`);
  }

  if (options.asJson) {
    return JSON.stringify({ configPath: context.configPath, service }, null, 2);
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
    `Name: ${String(spec.Name ?? options.serviceName)}`,
    `Image: ${String(containerSpec.Image ?? "unknown")}`,
    `Mode: ${mode.Global ? "global" : `replicated (${String(replicated.Replicas ?? "unknown")})`}`,
    `Ports: ${ports}`,
    `Update Strategy: ${String(updateConfig.Order ?? "default")}`,
    `Constraints: ${constraints.length ? constraints.join(", ") : "none"}`,
  ].join("\n");
}

export async function listClusterServiceTasks(options: {
  configPath?: string;
  serviceName: string;
  all?: boolean;
  asJson?: boolean;
}): Promise<string> {
  if (!options.serviceName.trim()) {
    throw new Error("A service name is required.");
  }

  const context = readContext(options.configPath);
  const command = options.all
    ? `docker service ps ${shellEscape(options.serviceName.trim())} --format '{{json .}}'`
    : `docker service ps --filter desired-state=running ${shellEscape(options.serviceName.trim())} --format '{{json .}}'`;
  const tasks = await runRemoteJsonLines(context, command);

  if (options.asJson) {
    return JSON.stringify(
      {
        configPath: context.configPath,
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

export async function getClusterLeaderStatus(options: {
  configPath?: string;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const leader = await resolveLeader(context);
  const nodes = await runRemoteJsonLines(context, "docker node ls --format '{{json .}}'");

  if (options.asJson) {
    return JSON.stringify(
      {
        configPath: context.configPath,
        leader: {
          hostname: leader.leaderHostname,
          ip: leader.leaderIp,
          server: leader.leaderServer,
        },
        managers: nodes,
      },
      null,
      2,
    );
  }

  return [
    `Config: ${context.configPath}`,
    `Leader: ${leader.leaderHostname}${leader.leaderIp ? ` (${leader.leaderIp})` : ""}`,
    `Leader SSH: ${leader.leaderServer}`,
    `Managers: ${nodes.length}`,
  ].join("\n");
}

export async function listClusterTasks(options: {
  configPath?: string;
  node?: string;
  all?: boolean;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  if (options.node?.trim()) {
    resolveNodeTarget(context, options.node.trim());
  }
  const targets = options.node?.trim()
    ? [options.node.trim()]
    : (await runRemoteJsonLines(context, "docker node ls --format '{{json .}}'")).map(
        (node) => node.Hostname ?? "unknown",
      );

  const taskGroups = await Promise.all(
    targets.map(async (target) => {
      const command = options.all
        ? `docker node ps ${shellEscape(target)} --format '{{json .}}'`
        : `docker node ps --filter desired-state=running ${shellEscape(target)} --format '{{json .}}'`;

      return {
        node: target,
        tasks: await runRemoteJsonLines(context, command),
      };
    }),
  );

  if (options.asJson) {
    return JSON.stringify(
      {
        configPath: context.configPath,
        node: options.node ?? null,
        all: Boolean(options.all),
        taskGroups,
      },
      null,
      2,
    );
  }

  if (!taskGroups.some((group) => group.tasks.length)) {
    return "No tasks were returned by the leader.";
  }

  return taskGroups
    .map((group) => {
      const rows = [
        ["NAME", "IMAGE", "DESIRED", "CURRENT STATE", "ERROR"],
        ...group.tasks.map((task) => [
          task.Name ?? "unknown",
          task.Image ?? "unknown",
          task.DesiredState ?? "unknown",
          task.CurrentState ?? "unknown",
          task.Error ?? "-",
        ]),
      ];

      return [`Node: ${group.node}`, formatTable(rows)].join("\n");
    })
    .join("\n\n");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(
  check: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

async function updateKeepalivedForTarget(context: RuntimeContext, targetNode: SwarmNode): Promise<void> {
  const secrets = loadRuntimeSecrets();
  const password = process.env[context.config.keepalived.authPassEnv] ?? secrets.vrrpPassword;

  if (!password?.trim()) {
    throw new Error(`Missing VRRP password in ${context.config.keepalived.authPassEnv}.`);
  }
  if (/[\r\n]/.test(password)) {
    throw new Error("VRRP password must not contain newline characters.");
  }

  for (const node of context.config.nodes) {
    const priority = node.id === targetNode.id ? 150 : 100;
    const state = node.id === targetNode.id ? "MASTER" : "BACKUP";
    const iface = node.keepalived?.interface?.trim() || context.config.keepalived.interface;
    const remoteConfig = [
      "# /etc/keepalived/keepalived.conf",
      "",
      `vrrp_instance ${context.config.keepalived.routerId || "VI_1"} {`,
      `    state ${state}`,
      `    interface ${iface}`,
      `    virtual_router_id ${context.config.keepalived.virtualRouterId}`,
      `    priority ${priority}`,
      `    advert_int ${context.config.keepalived.advertisementInterval}`,
      "",
      "    authentication {",
      "        auth_type PASS",
      `        auth_pass ${password}`,
      "    }",
      "",
      "    virtual_ipaddress {",
      `        ${context.config.vip}`,
      "    }",
      "}",
      "",
    ].join("\n");

    await execSsh(
      context,
      node,
      `cat > /etc/keepalived/keepalived.conf <<'EOF'\n${remoteConfig}\nEOF\nsystemctl restart keepalived`,
    );
  }

  await sleep(5000);
}

export async function switchClusterLeader(options: {
  configPath?: string;
  target: string;
  vipOnly?: boolean;
  swarmOnly?: boolean;
  strictTarget?: boolean;
  confirm?: boolean;
}): Promise<string> {
  if (!options.confirm) {
    throw new Error("Leader switch requires explicit confirmation.");
  }

  const context = readContext(options.configPath);
  const targetNode = resolveNodeTarget(context, options.target);
  const targetHostname = (await getNodeHostname(context, targetNode)) ?? targetNode.id;
  const targetRole = await getNodeRole(context, targetNode);

  if (targetRole !== "manager") {
    throw new Error(`Target node ${targetHostname} is not a swarm manager.`);
  }

  const lines = [`Switch target: ${targetHostname} (${targetNode.host})`];

  if (!options.swarmOnly) {
    await updateKeepalivedForTarget(context, targetNode);
    lines.push(`VIP moved toward ${targetNode.host}.`);
  }

  if (!options.vipOnly) {
    const currentLeader = await resolveLeader(context);
    if (currentLeader.leaderHostname === targetHostname) {
      lines.push("Target is already the swarm leader.");
    } else if (options.strictTarget) {
      const managers = (
        await execSsh(
          context,
          targetNode,
          "docker node ls --filter role=manager --format '{{.Hostname}}'",
        )
      )
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => entry !== targetHostname);

      managers.forEach(validateRemoteHostname);

      const demoted: string[] = [];
      try {
        for (const hostname of managers) {
          await execSsh(context, targetNode, `docker node demote ${shellEscape(hostname)}`);
          demoted.push(hostname);
        }

        const becameLeader = await waitForCondition(async () => {
          const nextLeader = await resolveLeader(context);
          return nextLeader.leaderHostname === targetHostname;
        }, 30_000, 2_000);

        for (const hostname of demoted) {
          await execSsh(context, targetNode, `docker node promote ${shellEscape(hostname)}`);
        }

        lines.push(
          becameLeader
            ? `Swarm leadership moved to ${targetHostname}.`
            : `Target ${targetHostname} did not become leader before timeout.`,
        );
      } catch (error) {
        for (const hostname of demoted) {
          await tryExecSsh(context, targetNode, `docker node promote ${shellEscape(hostname)}`);
        }
        throw error;
      }
    } else {
      await execSsh(context, targetNode, `docker node demote ${shellEscape(currentLeader.leaderHostname)}`);
      await sleep(10_000);
      const nextLeader = await resolveLeader(context);
      await execSsh(context, targetNode, `docker node promote ${shellEscape(currentLeader.leaderHostname)}`);
      lines.push(`Previous leader was ${currentLeader.leaderHostname}.`);
      lines.push(`New leader is ${nextLeader.leaderHostname}.`);
    }
  }

  const finalLeader = await resolveLeader(context);
  const vipHolder = await findVipHolder(context);
  lines.push(`Final leader: ${finalLeader.leaderHostname} (${finalLeader.leaderIp})`);
  lines.push(`VIP holder: ${vipHolder?.host ?? "unknown"}`);
  return lines.join("\n");
}

export async function listRebootTargets(options: {
  configPath?: string;
}): Promise<string> {
  const context = readContext(options.configPath);
  const leader = await resolveLeader(context).catch(() => null);
  const lines: string[] = [];

  for (const [index, node] of context.config.nodes.entries()) {
    const reachable = await checkPort(node.host, context.config.ssh.port, 3000);
    if (!reachable) {
      lines.push(`${index + 1}. ${node.id.padEnd(15)} ${node.host.padEnd(15)} ❌ Offline`);
      continue;
    }

    const hostname = (await getNodeHostname(context, node)) ?? node.id;
    const role = await getNodeRole(context, node);
    const icon =
      leader?.leaderHostname === hostname ? "👑 Leader" : role === "manager" ? "🏛️  Manager" : "👷 Worker";
    lines.push(`${index + 1}. ${hostname.padEnd(15)} ${node.host.padEnd(15)} ${icon}`);
  }

  return lines.join("\n");
}

export async function getRebootStatus(options: {
  configPath?: string;
  target: string;
}): Promise<string> {
  const context = readContext(options.configPath);
  const node = resolveNodeTarget(context, options.target);
  const hostname = (await getNodeHostname(context, node)) ?? node.id;
  const lines = [`Reboot Status: ${hostname} (${node.host})`];

  const reachable = await checkPort(node.host, context.config.ssh.port, 3000);
  if (!reachable) {
    lines.push("Reachability: offline");
    return lines.join("\n");
  }

  lines.push("Reachability: online");
  lines.push(`SSH: ${(await tryExecSsh(context, node, "printf OK")) === "OK" ? "ok" : "failed"}`);
  lines.push(
    `Docker: ${((await tryExecSsh(context, node, "systemctl is-active docker"))?.trim() ?? "unknown")}`,
  );
  lines.push(
    `Swarm: ${((await tryExecSsh(context, node, "docker info --format '{{.Swarm.LocalNodeState}}'"))?.trim() ?? "unknown")}`,
  );
  lines.push(
    `Availability: ${((await tryExecSsh(context, node, "docker node inspect self --format '{{.Spec.Availability}}'"))?.trim() ?? "unknown")}`,
  );
  return lines.join("\n");
}

export async function rebootClusterNode(options: {
  configPath?: string;
  target: string;
  drainWait?: number;
  bootWait?: number;
  force?: boolean;
  noRestore?: boolean;
  confirm?: boolean;
}): Promise<string> {
  if (!options.confirm) {
    throw new Error("Node reboot requires explicit confirmation.");
  }

  const context = readContext(options.configPath);
  const node = resolveNodeTarget(context, options.target);
  const hostname = (await getNodeHostname(context, node)) ?? node.id;
  const leader = await resolveLeader(context);
  const leaderTarget = leader.leaderNode ?? leader.probeNode;
  const drainWait = options.drainWait ?? 30;
  const bootWait = options.bootWait ?? 300;
  const lines = [`Reboot target: ${hostname} (${node.host})`];

  if (!options.force) {
    await execSsh(
      context,
      leaderTarget,
      `docker node update --availability drain ${shellEscape(hostname)}`,
    );
    lines.push(`Node drained: ${hostname}`);
    await sleep(drainWait * 1000);
  } else {
    lines.push("Drain skipped (--force).");
  }

  await tryExecSsh(
    context,
    node,
    "nohup sh -c 'sleep 2 && reboot' >/dev/null 2>&1 &",
  );
  lines.push("Reboot command sent.");

  await waitForCondition(
    async () => !(await checkPort(node.host, context.config.ssh.port, 2000)),
    30_000,
    2_000,
  );

  const online = await waitForCondition(
    async () => (await tryExecSsh(context, node, "printf OK")) === "OK",
    bootWait * 1000,
    5_000,
  );

  if (!online) {
    throw new Error(`Node ${hostname} did not return within ${bootWait} seconds.`);
  }

  lines.push("Node came back online.");

  await waitForCondition(
    async () => (await tryExecSsh(context, node, "systemctl is-active docker"))?.trim() === "active",
    120_000,
    5_000,
  );

  if (!options.noRestore) {
    await execSsh(
      context,
      leaderTarget,
      `docker node update --availability active ${shellEscape(hostname)}`,
    );
    lines.push("Node restored to active availability.");
  } else {
    lines.push("Restore skipped (--no-restore).");
  }

  lines.push(
    `Swarm state: ${((await tryExecSsh(context, node, "docker info --format '{{.Swarm.LocalNodeState}}'"))?.trim() ?? "unknown")}`,
  );

  return lines.join("\n");
}

type NodeUpdateMode = "all" | "os" | "docker";

type NodeUpdateSummary = {
  id: string;
  host: string;
  hostname: string;
  role: string;
  osVersion: string;
  kernel: string;
  dockerVersion: string;
  packageUpdates: number | null;
  dockerCandidate: string | null;
  rebootRequired: boolean;
  reachable: boolean;
  sshOk: boolean;
};

type ServiceUpdateSummary = {
  serviceName: string;
  sourceImage: string;
  currentDigest: string | null;
  latestDigest: string | null;
  updateAvailable: boolean;
};

type ContainerUpdateSummary = {
  node: string;
  containerName: string;
  image: string;
  updatePath: string;
  updateAvailable: boolean;
  detail: string;
};

async function detectOsType(context: RuntimeContext, node: SwarmNode): Promise<string> {
  return ((await tryExecSsh(context, node, "awk -F= '/^ID=/{gsub(/\"/,\"\",$2); print $2; exit}' /etc/os-release"))?.trim() ||
    "unknown");
}

async function getNodeVersionSummary(context: RuntimeContext, node: SwarmNode): Promise<NodeUpdateSummary> {
  const reachable = await checkPort(node.host, context.config.ssh.port, 3000);
  const hostname = (await getNodeHostname(context, node)) ?? node.id;
  const sshOk = reachable && (await tryExecSsh(context, node, "printf OK")) === "OK";

  if (!sshOk) {
    return {
      id: node.id,
      host: node.host,
      hostname,
      role: "unknown",
      osVersion: "unknown",
      kernel: "unknown",
      dockerVersion: "unknown",
      packageUpdates: null,
      dockerCandidate: null,
      rebootRequired: false,
      reachable,
      sshOk: false,
    };
  }

  const role = await getNodeRole(context, node);
  const osVersion =
    ((await tryExecSsh(context, node, "awk -F= '/^PRETTY_NAME=/{gsub(/\"/,\"\",$2); print $2; exit}' /etc/os-release"))?.trim() ||
      "unknown");
  const kernel = ((await tryExecSsh(context, node, "uname -r"))?.trim() || "unknown");
  const dockerVersion =
    ((await tryExecSsh(context, node, "docker --version 2>/dev/null | awk '{print $3}' | tr -d ','"))?.trim() ||
      "unknown");
  const osType = await detectOsType(context, node);

  let packageUpdates: number | null = null;
  let dockerCandidate: string | null = null;
  if (osType === "ubuntu" || osType === "debian") {
    packageUpdates = Number(
      (
        (await tryExecSsh(
          context,
          node,
          "bash -lc \"apt-get update >/dev/null 2>&1 && apt list --upgradable 2>/dev/null | tail -n +2 | grep -c / || true\"",
        )) ?? "0"
      ).trim(),
    );
    dockerCandidate =
      ((await tryExecSsh(
        context,
        node,
        "bash -lc \"apt-cache policy docker-ce 2>/dev/null | awk '/Candidate:/ {print $2; exit}'\"",
      ))?.trim() || null);
  }

  const rebootRequired =
    Boolean(await tryExecSsh(context, node, "test -f /var/run/reboot-required && echo yes || true")) ||
    Boolean(
      (await tryExecSsh(
        context,
        node,
        "bash -lc 'command -v needs-restarting >/dev/null 2>&1 && needs-restarting -r >/dev/null 2>&1 || true; test $? -ne 0 && echo yes || true'",
      ))?.trim(),
    );

  return {
    id: node.id,
    host: node.host,
    hostname,
    role,
    osVersion,
    kernel,
    dockerVersion,
    packageUpdates: Number.isFinite(packageUpdates) ? packageUpdates : null,
    dockerCandidate,
    rebootRequired,
    reachable,
    sshOk,
  };
}

function renderNodeUpdateSummaries(summaries: NodeUpdateSummary[]): string {
  const rows = [
    ["NODE", "HOST", "ROLE", "DOCKER", "PKG UPDATES", "DOCKER CANDIDATE", "REBOOT"],
    ...summaries.map((summary) => [
      summary.hostname,
      summary.host,
      summary.role,
      summary.dockerVersion,
      summary.packageUpdates === null ? "n/a" : String(summary.packageUpdates),
      summary.dockerCandidate ?? "-",
      summary.rebootRequired ? "yes" : "no",
    ]),
  ];

  return formatTable(rows);
}

export async function checkClusterNodeUpdates(options: {
  configPath?: string;
  target?: string;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const targets = options.target ? [resolveNodeTarget(context, options.target)] : context.config.nodes;
  const summaries = await Promise.all(targets.map((node) => getNodeVersionSummary(context, node)));

  if (options.asJson) {
    return JSON.stringify({ configPath: context.configPath, nodes: summaries }, null, 2);
  }

  return renderNodeUpdateSummaries(summaries);
}

async function runOsUpdate(context: RuntimeContext, node: SwarmNode): Promise<void> {
  const osType = await detectOsType(context, node);
  if (osType === "ubuntu" || osType === "debian") {
    await execSsh(
      context,
      node,
      "bash -lc 'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold && DEBIAN_FRONTEND=noninteractive apt-get autoremove -y'",
    );
    return;
  }

  throw new Error(`Unsupported OS update flow for ${osType}.`);
}

async function runDockerUpdate(context: RuntimeContext, node: SwarmNode): Promise<void> {
  const osType = await detectOsType(context, node);
  if (osType === "ubuntu" || osType === "debian") {
    await execSsh(
      context,
      node,
      "bash -lc 'DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade docker.io containerd'",
    );
    await execSsh(context, node, "systemctl restart docker");
    return;
  }

  throw new Error(`Unsupported Docker update flow for ${osType}.`);
}

export async function updateClusterNode(options: {
  configPath?: string;
  target: string;
  mode?: NodeUpdateMode;
  skipReboot?: boolean;
  confirm?: boolean;
}): Promise<string> {
  if (!options.confirm) {
    throw new Error("Node update requires explicit confirmation.");
  }

  const context = readContext(options.configPath);
  const node = resolveNodeTarget(context, options.target);
  const mode = options.mode ?? "all";
  const before = await getNodeVersionSummary(context, node);
  const lines = [`Update target: ${before.hostname} (${before.host})`, `Mode: ${mode}`];

  if (mode === "all" || mode === "os") {
    await runOsUpdate(context, node);
    lines.push("OS packages updated.");
  }

  if (mode === "all" || mode === "docker") {
    await runDockerUpdate(context, node);
    lines.push("Docker packages updated.");
  }

  const after = await getNodeVersionSummary(context, node);
  lines.push(`Docker version: ${before.dockerVersion} -> ${after.dockerVersion}`);
  lines.push(`Package updates remaining: ${after.packageUpdates ?? "n/a"}`);

  if (after.rebootRequired && !options.skipReboot) {
    lines.push("Reboot required. Starting controlled reboot flow.");
    lines.push(
      await rebootClusterNode({
        configPath: context.configPath,
        target: node.id,
        confirm: true,
      }),
    );
  } else if (after.rebootRequired) {
    lines.push("Reboot still required, but skipped by option.");
  } else {
    lines.push("No reboot required.");
  }

  return lines.join("\n");
}

export async function updateAllClusterNodes(options: {
  configPath?: string;
  mode?: NodeUpdateMode;
  skipReboot?: boolean;
  confirm?: boolean;
  exclude?: string[];
}): Promise<string> {
  if (!options.confirm) {
    throw new Error("Bulk node update requires explicit confirmation.");
  }

  const context = readContext(options.configPath);
  const exclude = new Set((options.exclude ?? []).map((entry) => entry.trim()).filter(Boolean));
  const targets = context.config.nodes.filter(
    (node) => !exclude.has(node.id) && !exclude.has(node.host),
  );
  const lines = [`Updating ${targets.length} node(s)`, `Mode: ${options.mode ?? "all"}`];

  for (const node of targets) {
    lines.push("");
    lines.push(await updateClusterNode({
      configPath: context.configPath,
      target: node.id,
      mode: options.mode,
      skipReboot: options.skipReboot,
      confirm: true,
    }));
  }

  return lines.join("\n");
}

async function inspectAllServices(context: RuntimeContext): Promise<Array<Record<string, unknown>>> {
  const output = await runLeaderDockerCommand(
    context,
    "bash -lc 'ids=$(docker service ls -q); if [ -n \"$ids\" ]; then docker service inspect $ids; else echo [] ; fi'",
  );
  return JSON.parse(output || "[]") as Array<Record<string, unknown>>;
}

function extractImageSourceFromService(service: Record<string, unknown>): string {
  const spec = (service.Spec ?? {}) as Record<string, unknown>;
  const labels = (spec.Labels ?? {}) as Record<string, unknown>;
  const taskTemplate = (spec.TaskTemplate ?? {}) as Record<string, unknown>;
  const containerSpec = (taskTemplate.ContainerSpec ?? {}) as Record<string, unknown>;
  return String(labels["com.docker.stack.image"] ?? containerSpec.Image ?? "").split("@")[0];
}

function extractCurrentDigestFromService(service: Record<string, unknown>): string | null {
  const spec = (service.Spec ?? {}) as Record<string, unknown>;
  const taskTemplate = (spec.TaskTemplate ?? {}) as Record<string, unknown>;
  const containerSpec = (taskTemplate.ContainerSpec ?? {}) as Record<string, unknown>;
  const image = String(containerSpec.Image ?? "");
  return image.includes("@sha256:") ? image.slice(image.indexOf("@") + 1) : null;
}

async function pullLatestImageDigest(
  context: RuntimeContext,
  image: string,
  digestCache: Map<string, string | null>,
): Promise<string | null> {
  if (digestCache.has(image)) {
    return digestCache.get(image) ?? null;
  }

  try {
    const output = await runLeaderDockerCommand(
      context,
      buildBashCommand(
        `docker pull ${shellEscape(image)} >/tmp/swarm-cli-pull.log 2>&1 && docker image inspect ${shellEscape(image)} --format "{{index .RepoDigests 0}}" 2>/dev/null | head -1`,
      ),
    );
    const digest = output.includes("@") ? output.trim().split("@").pop() ?? null : null;
    digestCache.set(image, digest);
    return digest;
  } catch {
    digestCache.set(image, null);
    return null;
  }
}

export async function scanServiceImageUpdates(options: {
  configPath?: string;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const services = await inspectAllServices(context);
  const digestCache = new Map<string, string | null>();
  const summaries: ServiceUpdateSummary[] = [];

  for (const service of services) {
    const spec = (service.Spec ?? {}) as Record<string, unknown>;
    const serviceName = String(spec.Name ?? "unknown");
    const sourceImage = extractImageSourceFromService(service);
    const currentDigest = extractCurrentDigestFromService(service);
    const latestDigest = sourceImage ? await pullLatestImageDigest(context, sourceImage, digestCache) : null;
    summaries.push({
      serviceName,
      sourceImage,
      currentDigest,
      latestDigest,
      updateAvailable: Boolean(currentDigest && latestDigest && currentDigest !== latestDigest),
    });
  }

  if (options.asJson) {
    return JSON.stringify({ configPath: context.configPath, services: summaries }, null, 2);
  }

  const rows = [
    ["SERVICE", "IMAGE", "CURRENT", "LATEST", "UPDATE"],
    ...summaries.map((summary) => [
      summary.serviceName,
      summary.sourceImage || "unknown",
      summary.currentDigest?.slice(0, 12) ?? "-",
      summary.latestDigest?.slice(0, 12) ?? "-",
      summary.updateAvailable ? "yes" : "no",
    ]),
  ];
  return formatTable(rows);
}

export async function updateServiceImage(options: {
  configPath?: string;
  serviceName: string;
  confirm?: boolean;
}): Promise<string> {
  if (!options.confirm) {
    throw new Error("Service update requires explicit confirmation.");
  }

  const context = readContext(options.configPath);
  const services = await inspectAllServices(context);
  const service = services.find((entry) => {
    const spec = (entry.Spec ?? {}) as Record<string, unknown>;
    return String(spec.Name ?? "") === options.serviceName;
  });

  if (!service) {
    throw new Error(`Service not found: ${options.serviceName}`);
  }

  const image = extractImageSourceFromService(service);
  if (!image) {
    throw new Error(`Could not determine image source for ${options.serviceName}.`);
  }

  await runLeaderDockerCommand(
    context,
    buildBashCommand(
      `docker pull ${shellEscape(image)} >/tmp/swarm-cli-service-update.log 2>&1 && docker service update --image ${shellEscape(image)} ${shellEscape(options.serviceName)}`,
    ),
  );

  const latestDigest = await pullLatestImageDigest(context, image, new Map());
  return [`Service updated: ${options.serviceName}`, `Image: ${image}`, `Latest digest: ${latestDigest ?? "unknown"}`].join("\n");
}

async function listRunningContainers(context: RuntimeContext): Promise<Array<Record<string, string>>> {
  const containers: Array<Record<string, string>> = [];
  for (const node of context.config.nodes) {
    const output = await tryExecSsh(context, node, "docker ps --format '{{json .}}'");
    if (!output?.trim()) {
      continue;
    }

    for (const line of output.split(/\r?\n/).filter(Boolean)) {
      containers.push({
        ...(JSON.parse(line) as Record<string, string>),
        __nodeHost: node.host,
        __nodeId: node.id,
      });
    }
  }
  return containers;
}

function parseLabelMap(labelText: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of labelText.split(",")) {
    const index = entry.indexOf("=");
    if (index <= 0) continue;
    map[entry.slice(0, index)] = entry.slice(index + 1);
  }
  return map;
}

export async function scanContainerImageUpdates(options: {
  configPath?: string;
  asJson?: boolean;
}): Promise<string> {
  const context = readContext(options.configPath);
  const containers = await listRunningContainers(context);
  const serviceScans = JSON.parse(
    await scanServiceImageUpdates({ configPath: context.configPath, asJson: true }),
  ) as { services: ServiceUpdateSummary[] };
  const serviceMap = new Map(serviceScans.services.map((entry) => [entry.serviceName, entry]));

  const summaries: ContainerUpdateSummary[] = containers.map((container) => {
    const labels = parseLabelMap(container.Labels ?? "");
    const serviceName = labels["com.docker.swarm.service.name"];
    if (serviceName && serviceMap.has(serviceName)) {
      const service = serviceMap.get(serviceName)!;
      return {
        node: container.__nodeId ?? container.__nodeHost ?? "unknown",
        containerName: container.Names ?? container.ID ?? "unknown",
        image: container.Image ?? "unknown",
        updatePath: `service:${serviceName}`,
        updateAvailable: service.updateAvailable,
        detail: service.updateAvailable ? "Update via swarm service rollout." : "Already current.",
      };
    }

    const composeProject = labels["com.docker.compose.project"];
    const composeService = labels["com.docker.compose.service"];
    if (composeProject && composeService) {
      return {
        node: container.__nodeId ?? container.__nodeHost ?? "unknown",
        containerName: container.Names ?? container.ID ?? "unknown",
        image: container.Image ?? "unknown",
        updatePath: `compose:${composeProject}/${composeService}`,
        updateAvailable: false,
        detail: "Compose-managed container scanning is not yet implemented.",
      };
    }

    return {
      node: container.__nodeId ?? container.__nodeHost ?? "unknown",
      containerName: container.Names ?? container.ID ?? "unknown",
      image: container.Image ?? "unknown",
      updatePath: "unsupported",
      updateAvailable: false,
      detail: "Standalone container update path is not implemented.",
    };
  });

  if (options.asJson) {
    return JSON.stringify({ configPath: context.configPath, containers: summaries }, null, 2);
  }

  const rows = [
    ["NODE", "CONTAINER", "IMAGE", "UPDATE PATH", "UPDATE", "DETAIL"],
    ...summaries.map((summary) => [
      summary.node,
      summary.containerName,
      summary.image,
      summary.updatePath,
      summary.updateAvailable ? "yes" : "no",
      summary.detail,
    ]),
  ];
  return formatTable(rows);
}

export async function updateContainerImage(options: {
  configPath?: string;
  containerName: string;
  confirm?: boolean;
}): Promise<string> {
  if (!options.confirm) {
    throw new Error("Container update requires explicit confirmation.");
  }

  const context = readContext(options.configPath);
  const containers = await listRunningContainers(context);
  const target = containers.find(
    (container) =>
      container.Names === options.containerName ||
      container.ID === options.containerName,
  );

  if (!target) {
    throw new Error(`Container not found: ${options.containerName}`);
  }

  const labels = parseLabelMap(target.Labels ?? "");
  const serviceName = labels["com.docker.swarm.service.name"];
  if (serviceName) {
    return await updateServiceImage({
      configPath: context.configPath,
      serviceName,
      confirm: true,
    });
  }

  throw new Error("Container update is only supported for swarm service tasks right now.");
}
