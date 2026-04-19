import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  COMMAND_CATALOG,
  createConfigBuilderDefaults,
  loadConfigIfPresent,
  resolveConfigPath,
  resolveEnvPath,
  saveConfigBuilderInput,
  type ConfigBuilderInput,
  type ActivityEntry,
  type CommandExecutionRequest,
} from "@swarmhq/core";
import { buildCliInvocation, runCliRequest } from "../command-bridge.js";
import { buildRemoteHealthReport } from "../cluster-runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const activityLog: ActivityEntry[] = [];
const activityClients = new Set<http.ServerResponse>();

type StartUiServerOptions = {
  configPath?: string;
  openBrowser?: boolean;
};

function getMimeType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function getUiBuildDir(): string | null {
  const candidates = [
    process.env.SWARM_UI_DIST,
    path.resolve(__dirname, "../../ui-dist"),
    path.resolve(__dirname, "../../../ui/out"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";

  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  child.unref();
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res: http.ServerResponse, statusCode: number, body: string): void {
  res.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function isAuthorized(req: http.IncomingMessage, token: string): boolean {
  return req.headers["x-swarm-session"] === token;
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function pushActivity(activity: ActivityEntry): void {
  activityLog.unshift(activity);
  if (activityLog.length > 30) {
    activityLog.length = 30;
  }
  broadcastActivity({
    type: "activity",
    activity,
  });
}

function updateActivity(updatedEntry: ActivityEntry): void {
  const index = activityLog.findIndex((entry) => entry.id === updatedEntry.id);
  if (index >= 0) {
    activityLog[index] = updatedEntry;
  } else {
    pushActivity(updatedEntry);
    return;
  }

  broadcastActivity({
    type: "activity",
    activity: updatedEntry,
  });
}

function broadcastActivity(payload: {
  type: "snapshot";
  activities: ActivityEntry[];
} | {
  type: "activity";
  activity: ActivityEntry;
} | {
  type: "heartbeat";
}): void {
  const chunk = `${JSON.stringify(payload)}\n`;

  for (const client of activityClients) {
    try {
      client.write(chunk);
    } catch {
      activityClients.delete(client);
    }
  }
}

function attachActivityStream(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  res.write(`${JSON.stringify({ type: "snapshot", activities: activityLog })}\n`);
  activityClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`${JSON.stringify({ type: "heartbeat" })}\n`);
    } catch {
      clearInterval(heartbeat);
      activityClients.delete(res);
    }
  }, 15_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    activityClients.delete(res);
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("close", cleanup);
}

function resolveUiFile(uiBuildDir: string, pathname: string): string {
  const safeRoot = path.resolve(uiBuildDir);
  const normalizedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidates = [
    normalizedPath,
    `${normalizedPath}.html`,
    path.join(normalizedPath, "index.html"),
  ]
    .map((candidate) => path.resolve(uiBuildDir, candidate))
    .filter((candidate) => candidate.startsWith(safeRoot));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return path.resolve(uiBuildDir, "index.html");
}

export async function startUiServer(options: StartUiServerOptions = {}): Promise<void> {
  const resolvedConfigPath = resolveConfigPath(options.configPath);
  const initial = loadConfigIfPresent(options.configPath);
  const token = randomUUID();
  const uiBuildDir = getUiBuildDir();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/api/session") {
      sendJson(res, 200, {
        token,
        appName: COMMAND_CATALOG.appName,
      });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      if (!isAuthorized(req, token)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (url.pathname === "/api/meta") {
        sendJson(res, 200, COMMAND_CATALOG);
        return;
      }

      if (url.pathname === "/api/config") {
        const current = loadConfigIfPresent(options.configPath);
        if (!current) {
          sendJson(res, 404, { error: `Config file not found at ${resolvedConfigPath}` });
          return;
        }
        sendJson(res, 200, { config: current.config, configPath: current.path });
        return;
      }

      if (url.pathname === "/api/health") {
        void (async () => {
          try {
            const current = loadConfigIfPresent(options.configPath);
            if (!current) {
              sendJson(res, 404, { error: `Config file not found at ${resolvedConfigPath}` });
              return;
            }

            const report = JSON.parse(
              await buildRemoteHealthReport({
                configPath: current.path,
                asJson: true,
              }),
            ) as {
              clusterName: string;
              vip: string;
              connectivity: Array<unknown>;
              warnings?: string[];
              errors?: string[];
            };

            sendJson(res, 200, {
              snapshot: {
                generatedAt: new Date().toISOString(),
                clusterName: report.clusterName,
                vip: report.vip,
                nodeCount: report.connectivity.length,
                warnings: [...(report.errors ?? []), ...(report.warnings ?? [])],
              },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Internal server error";
            sendJson(res, 500, { error: message });
          }
        })();
        return;
      }

      if (url.pathname === "/api/activity") {
        sendJson(res, 200, { activities: activityLog });
        return;
      }

      if (url.pathname === "/api/events") {
        attachActivityStream(req, res);
        return;
      }

      if (url.pathname === "/api/setup/defaults") {
        const defaults = createConfigBuilderDefaults(options.configPath);
        const hasVrrpPassword = Boolean(defaults.input.vrrpPassword?.trim());
        const hasTailscaleAuthKey = Boolean(defaults.input.tailscaleAuthKey?.trim());
        const { vrrpPassword: _vp, tailscaleAuthKey: _tk, ...safeInput } = defaults.input;
        sendJson(res, 200, {
          defaults: {
            hasExistingConfig: defaults.hasExistingConfig,
            hasVrrpPassword,
            hasTailscaleAuthKey,
            input: {
              ...safeInput,
              configPath: initial?.path ?? resolvedConfigPath,
              envPath: resolveEnvPath(options.configPath),
            },
          },
        });
        return;
      }

      if (url.pathname === "/api/setup/save" && req.method === "POST") {
        void (async () => {
          try {
            const requestBody = await readRequestBody(req);
            const parsed = JSON.parse(requestBody || "{}") as {
              input: ConfigBuilderInput;
              overwrite?: boolean;
            };

            const result = saveConfigBuilderInput(parsed.input, {
              overwrite: parsed.overwrite !== false,
            });
            sendJson(res, 200, { result });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Bad request";
            sendJson(res, 400, { error: message });
          }
        })();
        return;
      }

      if (url.pathname === "/api/commands/execute" && req.method === "POST") {
        void (async () => {
          try {
            const requestBody = await readRequestBody(req);
            const parsed = JSON.parse(requestBody || "{}") as CommandExecutionRequest;
            const values = { ...(parsed.values ?? {}) };
            if (options.configPath && !values.configPath) {
              values.configPath = options.configPath;
            }
            const invocation = buildCliInvocation({
              ...parsed,
              values,
            });
            const commandDefinition = COMMAND_CATALOG.commands.find(
              (command) => command.id === parsed.commandId,
            );

            if (!commandDefinition) {
              sendJson(res, 404, { error: `Unknown command: ${parsed.commandId}` });
              return;
            }

            const startedAt = new Date().toISOString();
            const baseActivity: ActivityEntry = {
              id: randomUUID(),
              commandId: commandDefinition.id,
              label: commandDefinition.label,
              status: "pending",
              summary: `Running ${commandDefinition.label}...`,
              startedAt,
              values,
              commandLine: invocation.displayCommand,
            };
            pushActivity(baseActivity);
            let liveOutput = "";

            try {
              const result = await runCliRequest(
                {
                  ...parsed,
                  values,
                },
                {
                  onStdout: (chunk) => {
                    liveOutput = `${liveOutput}${chunk}`;
                    updateActivity({
                      ...baseActivity,
                      status: "pending",
                      summary: `Running ${commandDefinition.label}...`,
                      output: liveOutput.trim(),
                      commandLine: invocation.displayCommand,
                    });
                  },
                  onStderr: (chunk) => {
                    liveOutput = `${liveOutput}${chunk}`;
                    updateActivity({
                      ...baseActivity,
                      status: "pending",
                      summary: `Running ${commandDefinition.label}...`,
                      output: liveOutput.trim(),
                      commandLine: invocation.displayCommand,
                    });
                  },
                },
              );
              const finishedActivity: ActivityEntry = {
                ...baseActivity,
                status: "success",
                summary: result.summary,
                finishedAt: new Date().toISOString(),
                output: result.output,
                commandLine: result.commandLine,
              };
              updateActivity(finishedActivity);
              sendJson(res, 200, { result, activity: finishedActivity });
            } catch (commandError) {
              const message =
                commandError instanceof Error ? commandError.message : "Command execution failed";
              const failedActivity: ActivityEntry = {
                ...baseActivity,
                status: "error",
                summary: message,
                finishedAt: new Date().toISOString(),
                output: liveOutput.trim() || message,
                commandLine: invocation.displayCommand,
              };
              updateActivity(failedActivity);
              sendJson(res, 500, { error: message, activity: failedActivity });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Bad request";
            sendJson(res, 400, { error: message });
          }
        })();
        return;
      }

      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (!uiBuildDir) {
      sendText(
        res,
        200,
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>swarmhq ui</title>
    <style>
      body { font-family: sans-serif; margin: 40px; background: #f7f7f2; color: #172119; }
      main { max-width: 720px; }
      code { background: #e8ece4; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <main>
      <h1>swarmhq ui</h1>
      <p>The local API server is running, but exported UI assets were not found.</p>
      <p>Build the UI with <code>npm run build -w @swarmhq/ui</code> and then copy it with <code>npm run bundle:ui -w swarmhq</code>.</p>
      <p>Config path: <code>${initial?.path ?? resolvedConfigPath}</code></p>
    </main>
  </body>
</html>`,
      );
      return;
    }

    const filePath = resolveUiFile(uiBuildDir, url.pathname);

    res.writeHead(200, { "content-type": getMimeType(filePath) });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine server address");
  }

  const url = `http://127.0.0.1:${address.port}`;
  console.log(`UI available at ${url}`);
  console.log(`Session token issued for localhost API requests.`);

  if (options.openBrowser !== false && process.env.SWARM_UI_OPEN !== "false") {
    openBrowser(url);
  }
}
