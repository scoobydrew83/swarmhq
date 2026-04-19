import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceDir = path.resolve(__dirname, "../../ui/out");
const targetDir = path.resolve(__dirname, "../ui-dist");

if (!fs.existsSync(sourceDir)) {
  console.warn(`UI export not found at ${sourceDir}. Run "npm run build -w @swarm-cli/ui" first.`);
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
console.log(`Copied UI assets to ${targetDir}`);
