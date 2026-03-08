import { Hono } from "hono";
import { loadConfig, saveConfig } from "../services/config";

interface ConfigRouteOptions {
  configDir: string;
  workspaceDir: string;
}

export function configRoutes(options: ConfigRouteOptions) {
  const app = new Hono();

  // Get current config
  app.get("/", async (c) => {
    const config = loadConfig(options.configDir);
    return c.json(config);
  });

  // Update config
  app.put("/", async (c) => {
    const body = await c.req.json();
    saveConfig(options.configDir, body);
    return c.json({ ok: true });
  });

  // List available providers and their models
  // Only returns providers whose api_key resolves to a non-empty value.
  app.get("/providers", async (c) => {
    const config = loadConfig(options.configDir);
    const providerList = (config.providers as Array<{ name: string; type: string; api_key?: string; models: string[] }>) ?? [];
    const providers = providerList
      .filter((p) => {
        if (p.api_key == null) return true; // no key field = no key required
        const resolved = p.api_key.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
        return resolved.length > 0;
      })
      .map((p) => ({
        name: p.name,
        type: p.type,
        models: p.models ?? [],
      }));
    return c.json({ providers });
  });

  return app;
}
