import { anthropicAdapter } from "./anthropic";
import { googleAdapter } from "./google";
import { openaiAdapter } from "./openai";
import type { ProviderAdapter, ProviderRegistry } from "./types";

class DefaultProviderRegistry implements ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  get(type: string): ProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Unknown provider type: ${type}`);
    }
    return adapter;
  }

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }
}

export function createProviderRegistry(): ProviderRegistry {
  const registry = new DefaultProviderRegistry();
  registry.register(openaiAdapter);
  registry.register(anthropicAdapter);
  registry.register(googleAdapter);
  return registry;
}
