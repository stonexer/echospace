import { Hono } from "hono";
import { stream } from "hono/streaming";
import { createProviderRegistry } from "../../core/providers";
import type { ProviderConfig } from "../../core/providers/types";
import { loadConfig } from "../services/config";

interface ChatRouteOptions {
  configDir: string;
  workspaceDir: string;
}

export function chatRoutes(options: ChatRouteOptions) {
  const app = new Hono();
  const registry = createProviderRegistry();

  // Stream chat completion
  app.post("/completions", async (c) => {
    const body = await c.req.json();
    const { messages, settings, provider: providerName } = body;

    // Load config to find provider
    const config = loadConfig(options.configDir);
    const providerList = (config.providers as ProviderConfig[]) ?? [];
    const providerConfig = providerList.find(
      (p) => p.name === providerName,
    );

    if (!providerConfig) {
      return c.json(
        { error: `Provider "${providerName}" not found in config` },
        400,
      );
    }

    // Resolve env vars in api_key
    const resolvedConfig = {
      ...providerConfig,
      api_key: resolveEnvVar(providerConfig.api_key),
    };

    const adapter = registry.get(resolvedConfig.type);
    const { url, headers, body: requestBody } = adapter.buildRequest(
      messages,
      settings,
      resolvedConfig,
    );

    // Proxy the streaming request
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return c.json(
          {
            error: `Provider returned ${response.status}: ${errorText}`,
          },
          response.status as 400,
        );
      }

      // Stream SSE back to client
      return stream(c, async (s) => {
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === ":") continue;

            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              const parts = adapter.parseChunk(data);

              if (parts.length > 0) {
                await s.write(
                  `data: ${JSON.stringify({ parts })}\n\n`,
                );
              }

              if (adapter.isDone(data)) {
                await s.write("data: [DONE]\n\n");
                return;
              }
            }
          }
        }

        await s.write("data: [DONE]\n\n");
      });
    } catch (err) {
      return c.json(
        { error: `Request failed: ${(err as Error).message}` },
        500,
      );
    }
  });

  return app;
}

/**
 * Resolve ${ENV_VAR} references in a string.
 */
function resolveEnvVar(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
}
