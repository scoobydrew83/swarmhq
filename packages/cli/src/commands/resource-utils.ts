import fs from "node:fs";

export function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

export function readPositional(args: string[], skip = 0): string | undefined {
  const valueFlags = new Set([
    "--config",
    "--context",
    "--file",
    "--name",
    "--target",
    "--key",
    "--value",
    "--driver",
    "--since",
    "--tail",
  ]);

  return args.find((arg, index) => {
    if (index < skip || arg.startsWith("--")) return false;
    return !valueFlags.has(args[index - 1] ?? "");
  });
}

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

export function readContentInput(args: string[]): Promise<{ filePath?: string; stdin?: string }> {
  const filePath = readFlag(args, "--file");
  if (args.includes("--stdin")) {
    return readStdin().then((stdin) => ({ stdin }));
  }
  if (filePath?.trim()) {
    fs.accessSync(filePath.trim(), fs.constants.R_OK);
    return Promise.resolve({ filePath: filePath.trim() });
  }
  return Promise.resolve({});
}
