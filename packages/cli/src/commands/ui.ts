import { startUiServer } from "../server/ui-server.js";

export async function runUiCommand(args: string[]): Promise<void> {
  const configFlagIndex = args.indexOf("--config");
  const explicitPath = configFlagIndex >= 0 ? args[configFlagIndex + 1] : undefined;
  const openBrowser = !args.includes("--no-open");

  await startUiServer({
    configPath: explicitPath,
    openBrowser,
  });
}
