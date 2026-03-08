import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chatRoutes } from "./routes/chat";
import { fileRoutes } from "./routes/files";
import { configRoutes } from "./routes/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "../client");

export function createServer(options: {
  workspaceDir: string;
  configDir: string;
}) {
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use("*", cors());

  // API routes
  app.route("/api/files", fileRoutes(options));
  app.route("/api/chat", chatRoutes(options));
  app.route("/api/config", configRoutes(options));

  // Static files (Vite build output) — use absolute path so global installs work
  app.use("/*", serveStatic({ root: clientDir }));

  // SPA fallback
  app.get("*", serveStatic({ root: clientDir, path: "index.html" }));

  return app;
}

export function startServer(options: {
  port: number;
  workspaceDir: string;
  configDir: string;
}) {
  const app = createServer(options);

  serve(
    { fetch: app.fetch, port: options.port },
    (info) => {
      console.log(`Echo Space running at http://localhost:${info.port}`);
    },
  );

  return app;
}
