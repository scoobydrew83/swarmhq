import { executeCommand } from "../command-runtime.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => resolve(buffer));
    process.stdin.on("error", reject);
  });
}

export async function runRedactCommand(args: string[]): Promise<void> {
  const sourceIndex = args.indexOf("--source");
  const configIndex = args.indexOf("--config");
  const customIndex = args.indexOf("--custom-text");
  const source = sourceIndex >= 0 ? args[sourceIndex + 1] ?? "config" : "config";
  const configPath = configIndex >= 0 ? args[configIndex + 1] : "";
  const customText =
    args.includes("--stdin")
      ? await readStdin()
      : customIndex >= 0
        ? args[customIndex + 1] ?? ""
        : "";

  console.log(
    executeCommand({
      commandId: "security.redaction-preview",
      values: {
        source,
        configPath,
        customText,
        hideIps: args.includes("--hide-ips"),
      },
    }).output,
  );
}
