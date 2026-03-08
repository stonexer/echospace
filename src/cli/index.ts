#!/usr/bin/env node
import { Command } from "commander";
import getPort, { portNumbers } from "get-port";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import open from "open";
import { ensureConfig } from "../server/services/config";
import { startServer } from "../server/index";

const VERSION = process.env.npm_package_version ?? "0.0.0";

const CONFIG_DIR = path.join(homedir(), ".echo-space");

/** Load .env file into process.env (simple key=value parser) */
function loadEnvFile(dir: string) {
  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const program = new Command();

program
  .name("echo-space")
  .description("The best open-source local prompt debugging tool")
  .version(VERSION)
  .argument("[workdir]", "Workspace directory", ".")
  .option("-p, --port <port>", "Port to serve on")
  .option("--no-open", "Don't open browser automatically")
  .action(async (workdir: string, options: { port?: string; open: boolean }) => {
    const baseDir = path.resolve(process.cwd(), workdir);
    const workspaceDir = path.join(baseDir, ".echo");

    // Load .env from base dir and project root
    loadEnvFile(baseDir);
    loadEnvFile(process.cwd());

    // Ensure .echo workspace directory exists
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    // Ensure config dir
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    ensureConfig(CONFIG_DIR);

    // Find available port
    const port = options.port
      ? parseInt(options.port, 10)
      : await getPort({ port: portNumbers(7788, 7799) });

    console.log(`
  ╔══════════════════════════════════════╗
  ║           Echo Space v${VERSION.padEnd(12)}║
  ╠══════════════════════════════════════╣
  ║  Workspace: ${workspaceDir.padEnd(24)}║
  ║  URL:       http://localhost:${String(port).padEnd(8)}║
  ╚══════════════════════════════════════╝
`);

    const isDev = process.env.NODE_ENV !== "production" && import.meta.url.includes("/src/");
    startServer({ port, workspaceDir, configDir: CONFIG_DIR, dev: isDev });

    if (options.open) {
      await open(`http://localhost:${port}`);
    }

    // Graceful shutdown
    const shutdown = () => {
      console.log("\nShutting down Echo Space...");
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program.parse();
