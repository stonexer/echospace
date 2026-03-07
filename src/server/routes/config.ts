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
  app.get("/providers", async (c) => {
    const config = loadConfig(options.configDir);
    const providerList = (config.providers as Array<{ name: string; type: string; models: string[] }>) ?? [];
    const providers = providerList.map((p) => ({
      name: p.name,
      type: p.type,
      models: p.models ?? [],
    }));
    return c.json({ providers });
  });

  return app;
}
