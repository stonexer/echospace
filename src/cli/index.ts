#!/usr/bin/env node
import { Command } from "commander";
import getPort, { portNumbers } from "get-port";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import open from "open";
import { ensureConfig } from "../server/services/config";
import { startServer } from "../server/index";
import { runInit } from "./init";

const VERSION = process.env.npm_package_version ?? "0.0.0";

const CONFIG_DIR = path.join(homedir(), ".echospace");

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
  .name("echospace")
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
      : await getPort({ port: portNumbers(3240, 3249) });

    const url = `http://localhost:${port}`;
    const lines = [
      `回 EchoSpace v${VERSION}`,
      `Workspace: ${workspaceDir}`,
      `URL:       ${url}`,
    ];
    // Count display width (CJK/fullwidth = 2 columns)
    const dw = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x7f ? 2 : 1), 0);
    const w = Math.max(...lines.map(dw)) + 4;
    const top = `  ╔${"═".repeat(w)}╗`;
    const mid = `  ╠${"═".repeat(w)}╣`;
    const bot = `  ╚${"═".repeat(w)}╝`;
    const pad = (s: string) => `  ║  ${s}${" ".repeat(w - 2 - dw(s))}║`;
    const center = (s: string) => {
      const sw = dw(s);
      const left = Math.floor((w - sw) / 2);
      return `  ║${" ".repeat(left)}${s}${" ".repeat(w - left - sw)}║`;
    };
    console.log(`
${top}
${center(lines[0])}
${mid}
${pad(lines[1])}
${pad(lines[2])}
${bot}
`);

    const isDev = process.env.NODE_ENV !== "production" && import.meta.url.includes("/src/");
    startServer({ port, workspaceDir, configDir: CONFIG_DIR, dev: isDev });

    if (options.open) {
      await open(`http://localhost:${port}`);
    }

    // Graceful shutdown
    const shutdown = () => {
      console.log("\nShutting down EchoSpace...");
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program
  .command("init")
  .description("Interactive setup for LLM provider configuration")
  .action(runInit);

program.parse();
