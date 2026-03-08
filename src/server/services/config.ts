import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const DEFAULT_CONFIG = {
  providers: [
    {
      name: "openai",
      type: "openai",
      api_key: "",
      models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o3", "o3-mini", "o4-mini"],
    },
    {
      name: "anthropic",
      type: "anthropic",
      api_key: "",
      models: ["claude-sonnet-4-6", "claude-haiku-4-5"],
    },
    {
      name: "google",
      type: "google",
      api_key: "",
      models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
    },
  ],
};

export function getConfigPath(configDir: string): string {
  return path.join(configDir, "config.yaml");
}

export function loadConfig(configDir: string): Record<string, unknown> {
  const configPath = getConfigPath(configDir);

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return (yaml.load(raw) as Record<string, unknown>) ?? DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(
  configDir: string,
  config: Record<string, unknown>,
): void {
  const configPath = getConfigPath(configDir);
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, yaml.dump(config), "utf-8");
}

export function ensureConfig(configDir: string): void {
  // One-time migration: .echo-space → .echospace
  const oldDir = configDir.replace(/\.echospace$/, ".echo-space");
  if (
    oldDir !== configDir &&
    fs.existsSync(oldDir) &&
    !fs.existsSync(configDir)
  ) {
    fs.renameSync(oldDir, configDir);
  }

  const configPath = getConfigPath(configDir);
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configDir, { recursive: true });
    const header = [
      "# EchoSpace configuration",
      "# Fill in the api_key for the providers you need. Unconfigured providers are ignored.",
      "# Run /echospace:init for interactive setup.",
      "",
    ].join("\n");
    fs.writeFileSync(configPath, header + yaml.dump(DEFAULT_CONFIG), "utf-8");
  }
}
