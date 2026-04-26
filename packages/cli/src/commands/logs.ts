import { spawn } from "node:child_process";
import { buildClusterServiceLogsInvocation } from "../cluster-runtime.js";
import { readFlag, readPositional } from "./resource-utils.js";

function buildDockerLogsArgs(options: {
  context?: string;
  serviceName: string;
  since?: string;
  tail?: string;
  follow?: boolean;
}): string[] {
  const args = [];
  if (options.context?.trim()) {
    args.push("--context", options.context.trim());
  }
  args.push("service", "logs");
  if (options.follow) args.push("--follow");
  if (options.since?.trim()) args.push("--since", options.since.trim());
  if (options.tail?.trim()) args.push("--tail", options.tail.trim());
  args.push(options.serviceName.trim());
  return args;
}

async function runStreamingProcess(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
      }
    });

    process.once("SIGTERM", () => {
      child.kill("SIGTERM");
    });
    process.once("SIGINT", () => {
      child.kill("SIGINT");
    });
  });
}

export async function runLogsCommand(args: string[]): Promise<void> {
  const context = readFlag(args, "--context");
  const configPath = readFlag(args, "--config");
  const serviceName = readFlag(args, "--name") ?? readPositional(args) ?? "";
  const since = readFlag(args, "--since");
  const tail = readFlag(args, "--tail");
  const follow = args.includes("--follow");

  if (!serviceName.trim()) {
    throw new Error("A service name is required.");
  }

  if (context) {
    await runStreamingProcess("docker", buildDockerLogsArgs({ context, serviceName, since, tail, follow }));
    return;
  }

  const invocation = await buildClusterServiceLogsInvocation({ configPath, serviceName, since, tail, follow });
  await runStreamingProcess(invocation.command, invocation.args);
}
