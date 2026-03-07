import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const DEFAULT_CONFIG = {
  providers: [
    {
      name: "vercel",
      type: "openai",
      api_key: "${AI_GATEWAY_API_KEY}",
      base_url: "https://ai-gateway.vercel.sh/v1",
      models: [
        "anthropic/claude-sonnet-4-6",
        "anthropic/claude-haiku-4-5",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/o1",
        "openai/o3-mini",
        "google/gemini-2.5-pro",
        "google/gemini-2.0-flash",
        "deepseek/deepseek-chat",
        "deepseek/deepseek-reasoner",
        "xai/grok-3-mini",
      ],
    },
    {
      name: "openai",
      type: "openai",
      api_key: "${OPENAI_API_KEY}",
      models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
    },
    {
      name: "anthropic",
      type: "anthropic",
      api_key: "${ANTHROPIC_API_KEY}",
      models: ["claude-sonnet-4-6", "claude-haiku-4-5"],
    },
    {
      name: "google",
      type: "google",
      api_key: "${GOOGLE_API_KEY}",
      models: ["gemini-2.0-flash", "gemini-2.5-pro"],
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
  const configPath = getConfigPath(configDir);
  if (!fs.existsSync(configPath)) {
    saveConfig(configDir, DEFAULT_CONFIG);
  }
}
