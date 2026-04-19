import { buildRemoteHealthReport } from "../cluster-runtime.js";

export async function runHealthCommand(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const detailed = args.includes("--detailed");
  const configFlagIndex = args.indexOf("--config");
  const explicitPath = configFlagIndex >= 0 ? args[configFlagIndex + 1] : undefined;

  console.log(
    await buildRemoteHealthReport({
      configPath: explicitPath,
      mode: json ? "json" : detailed ? "detailed" : "summary",
    }),
  );
}
