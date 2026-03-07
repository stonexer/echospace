import { Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import { parseEcho, serializeEcho } from "../../core/echo";
import { parseHistory, serializeEvent } from "../../core/history";

interface FileRouteOptions {
  workspaceDir: string;
}

export function fileRoutes(options: FileRouteOptions) {
  const app = new Hono();

  // List all .echo files in workspace
  app.get("/", async (c) => {
    try {
      const entries = await fs.readdir(options.workspaceDir, {
        withFileTypes: true,
        recursive: false,
      });

      const files = await Promise.all(
        entries
          .filter((e) => e.isFile() && e.name.endsWith(".echo"))
          .map(async (e) => {
            const filePath = path.join(options.workspaceDir, e.name);
            const stat = await fs.stat(filePath);
            return {
              name: e.name,
              path: filePath,
              modified_at: stat.mtime.toISOString(),
              size: stat.size,
            };
          }),
      );

      // Sort by modified time, newest first
      files.sort(
        (a, b) =>
          new Date(b.modified_at).getTime() -
          new Date(a.modified_at).getTime(),
      );

      return c.json({ files });
    } catch (err) {
      return c.json({ files: [] });
    }
  });

  // Read a single .echo file
  app.get("/:filename", async (c) => {
    const filename = c.req.param("filename");
    const filePath = path.join(options.workspaceDir, filename);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const conversation = parseEcho(raw);
      return c.json({ conversation, raw });
    } catch (err) {
      return c.json(
        { error: `Failed to read ${filename}: ${(err as Error).message}` },
        404,
      );
    }
  });

  // Write/update a .echo file
  app.put("/:filename", async (c) => {
    const filename = c.req.param("filename");
    const filePath = path.join(options.workspaceDir, filename);
    const body = await c.req.json();

    try {
      const content = body.raw ?? serializeEcho(body.conversation);
      await fs.writeFile(filePath, content, "utf-8");
      return c.json({ ok: true });
    } catch (err) {
      return c.json(
        { error: `Failed to write ${filename}: ${(err as Error).message}` },
        500,
      );
    }
  });

  // Create a new .echo file
  app.post("/", async (c) => {
    const body = await c.req.json();
    const filename = body.filename as string;
    const filePath = path.join(options.workspaceDir, filename);

    try {
      await fs.access(filePath);
      return c.json({ error: `${filename} already exists` }, 409);
    } catch {
      // File doesn't exist — good
    }

    try {
      const content = body.raw ?? serializeEcho(body.conversation);
      await fs.writeFile(filePath, content, "utf-8");
      return c.json({ ok: true, path: filePath });
    } catch (err) {
      return c.json(
        { error: `Failed to create ${filename}: ${(err as Error).message}` },
        500,
      );
    }
  });

  // Delete a .echo file
  app.delete("/:filename", async (c) => {
    const filename = c.req.param("filename");
    const filePath = path.join(options.workspaceDir, filename);

    try {
      await fs.unlink(filePath);
      // Also remove history sidecar if it exists
      const historyPath = filePath + "-history";
      try {
        await fs.unlink(historyPath);
      } catch {
        // No history file — that's fine
      }
      return c.json({ ok: true });
    } catch (err) {
      return c.json(
        { error: `Failed to delete ${filename}: ${(err as Error).message}` },
        500,
      );
    }
  });

  // --- History routes ---

  // Get history for a file
  app.get("/:filename/history", async (c) => {
    const filename = c.req.param("filename");
    const historyPath = path.join(
      options.workspaceDir,
      filename + "-history",
    );

    try {
      const raw = await fs.readFile(historyPath, "utf-8");
      const history = parseHistory(raw);
      return c.json({ events: history.events });
    } catch {
      return c.json({ events: [] });
    }
  });

  // Append a history event
  app.post("/:filename/history", async (c) => {
    const filename = c.req.param("filename");
    const historyPath = path.join(
      options.workspaceDir,
      filename + "-history",
    );
    const event = await c.req.json();

    try {
      const line = serializeEvent(event);
      await fs.appendFile(historyPath, line, "utf-8");
      return c.json({ ok: true });
    } catch (err) {
      return c.json(
        { error: `Failed to append history: ${(err as Error).message}` },
        500,
      );
    }
  });

  return app;
}
