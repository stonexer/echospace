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
  dev?: boolean;
}) {
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use("*", cors());

  // API routes
  app.route("/api/files", fileRoutes(options));
  app.route("/api/chat", chatRoutes(options));
  app.route("/api/config", configRoutes(options));

  if (options.dev) {
    // Dev mode: proxy non-API requests to Vite dev server
    const viteUrl = "http://localhost:5173";
    app.all("*", async (c) => {
      const url = new URL(c.req.url);
      const target = `${viteUrl}${url.pathname}${url.search}`;
      const res = await fetch(target, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: c.req.method === "GET" || c.req.method === "HEAD" ? undefined : c.req.raw.body,
        // @ts-expect-error -- Node fetch supports duplex for streaming bodies
        duplex: "half",
      });
      return new Response(res.body, {
        status: res.status,
        headers: res.headers,
      });
    });
  } else {
    // Production: serve static files from Vite build output
    app.use("/*", serveStatic({ root: clientDir }));
    // SPA fallback
    app.get("*", serveStatic({ root: clientDir, path: "index.html" }));
  }

  return app;
}

export function startServer(options: {
  port: number;
  workspaceDir: string;
  configDir: string;
  dev?: boolean;
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
