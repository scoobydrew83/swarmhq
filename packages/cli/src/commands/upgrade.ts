import { spawnSync } from "child_process";
import { get } from "https";

declare const __VERSION__: string;
const CURRENT_VERSION = __VERSION__;
const NPM_PACKAGE = "swarmhq";

function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    get(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data) as { version?: string };
          if (!parsed.version) {
            reject(new Error("No version field in npm registry response"));
            return;
          }
          resolve(parsed.version);
        } catch {
          reject(new Error("Failed to parse npm registry response"));
        }
      });
    }).on("error", reject);
  });
}

function isNewer(latest: string, current: string): boolean {
  const toNumbers = (v: string) => v.split(".").map(Number);
  const [latestParts, currentParts] = [toNumbers(latest), toNumbers(current)];
  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

async function checkForUpdate(): Promise<{ current: string; latest: string; updateAvailable: boolean }> {
  const latest = await fetchLatestVersion();
  return { current: CURRENT_VERSION, latest, updateAvailable: isNewer(latest, CURRENT_VERSION) };
}

function applyUpdate(version: string): void {
  console.log(`Installing swarmhq@${version}...`);
  const result = spawnSync("npm", ["install", "-g", `${NPM_PACKAGE}@${version}`], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error("npm install failed — you may need to run with sudo or check permissions");
  }
  console.log(`\nUpgrade complete. Run 'swarmhq --version' to confirm.`);
}

function prompt(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data: string) => {
      const answer = data.trim().toLowerCase();
      resolve(answer === "y" || answer === "yes");
    });
  });
}

export async function runUpgradeCommand(args: string[]): Promise<void> {
  const checkOnly = args.includes("--check");
  const yes = args.includes("--yes");

  let info: { current: string; latest: string; updateAvailable: boolean };
  try {
    console.log("Checking npm registry for updates...");
    info = await checkForUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to check for updates: ${message}`);
  }

  console.log(`Current version : ${info.current}`);
  console.log(`Latest version  : ${info.latest}`);

  if (!info.updateAvailable) {
    console.log("You are already on the latest version.");
    return;
  }

  console.log(`\nUpdate available: ${info.current} → ${info.latest}`);

  if (checkOnly) {
    console.log("\nRun 'swarmhq upgrade --yes' to install.");
    return;
  }

  if (!yes) {
    const confirmed = await prompt(`\nInstall swarmhq@${info.latest}? [y/N] `);
    if (!confirmed) {
      console.log("Upgrade cancelled.");
      return;
    }
  }

  applyUpdate(info.latest);
}
