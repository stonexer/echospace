import * as p from "@clack/prompts";
import { homedir } from "node:os";
import path from "node:path";
import { loadConfig, saveConfig } from "../server/services/config";

const CONFIG_DIR = path.join(homedir(), ".echospace");

interface Provider {
  name: string;
  type: string;
  api_key: string;
  base_url?: string;
  models: string[];
}

const PROVIDER_PRESETS: Record<
  string,
  { name: string; type: string; base_url?: string; models: string[] }
> = {
  openai: {
    name: "openai",
    type: "openai",
    models: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "o3",
      "o3-mini",
      "o4-mini",
    ],
  },
  anthropic: {
    name: "anthropic",
    type: "anthropic",
    models: ["claude-sonnet-4-6", "claude-haiku-4-5"],
  },
  google: {
    name: "google",
    type: "google",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  vercel: {
    name: "vercel-ai-gateway",
    type: "openai",
    base_url: "https://ai-gateway.vercel.sh/v1",
    models: [
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-haiku-4-5",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash",
    ],
  },
};

function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

export async function runInit() {
  p.intro("EchoSpace Setup");

  const service = await p.select({
    message: "Which LLM service do you use?",
    options: [
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic (Claude)" },
      { value: "google", label: "Google (Gemini)" },
      { value: "vercel", label: "Vercel AI Gateway" },
      { value: "custom", label: "Custom Gateway (OpenAI-compatible)" },
    ],
  });

  if (isCancel(service)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const apiKey = await p.password({
    message: "Enter your API Key:",
  });

  if (isCancel(apiKey)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  let provider: Provider;

  if (service === "custom") {
    const baseUrl = await p.text({
      message: "Base URL (e.g. https://my-proxy.example.com/v1):",
      validate: (v) => {
        if (!v.trim()) return "URL is required";
        try {
          new URL(v.trim());
        } catch {
          return "Invalid URL";
        }
      },
    });

    if (isCancel(baseUrl)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    const apiType = await p.select({
      message: "Compatible API type:",
      options: [
        { value: "openai", label: "OpenAI" },
        { value: "anthropic", label: "Anthropic" },
        { value: "google", label: "Google" },
      ],
    });

    if (isCancel(apiType)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    const modelsInput = await p.text({
      message: "Model names (comma-separated, or press enter to skip):",
      defaultValue: "",
    });

    if (isCancel(modelsInput)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    const models = modelsInput
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    provider = {
      name: "custom",
      type: apiType,
      api_key: apiKey,
      base_url: baseUrl.trim(),
      models,
    };
  } else {
    const preset = PROVIDER_PRESETS[service];
    provider = {
      ...preset,
      api_key: apiKey,
    };
  }

  // Load existing config and merge
  const config = loadConfig(CONFIG_DIR);
  const providers = (config.providers as Provider[]) ?? [];

  const existingIdx = providers.findIndex((existing) => {
    if (provider.base_url || existing.base_url) {
      return existing.type === provider.type && existing.base_url === provider.base_url;
    }
    return existing.type === provider.type;
  });
  if (existingIdx >= 0) {
    providers[existingIdx] = provider;
  } else {
    providers.push(provider);
  }

  config.providers = providers;
  saveConfig(CONFIG_DIR, config);

  const configPath = path.join(CONFIG_DIR, "config.yaml");
  p.log.success(`Config saved to ${configPath}`);
  p.outro("You're all set! Run `npx echospace` to start.");
}
