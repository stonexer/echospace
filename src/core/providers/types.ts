import type { EchoMessage, EchoPart, EchoSettings } from "../echo/types";

/**
 * Provider configuration from config.yaml.
 */
export interface ProviderConfig {
  name: string;
  type: "openai" | "anthropic" | "google";
  api_key?: string;
  base_url?: string;
  models: string[];
}

/**
 * Provider adapter — normalizes LLM APIs to/from .echo format.
 */
export interface ProviderAdapter {
  type: string;

  /** Convert .echo messages + settings → provider-specific request body */
  buildRequest(
    messages: EchoMessage[],
    settings: EchoSettings,
    config: ProviderConfig,
  ): { url: string; headers: Record<string, string>; body: unknown };

  /** Parse a single SSE data chunk into EchoPart[] */
  parseChunk(chunk: string): EchoPart[];

  /** Extract the "done" signal from a chunk */
  isDone(chunk: string): boolean;
}

/**
 * Registry of all available adapters.
 */
export interface ProviderRegistry {
  get(type: string): ProviderAdapter;
  register(adapter: ProviderAdapter): void;
}
