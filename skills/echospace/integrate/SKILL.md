---
name: echospace:integrate
description: >-
  Integrate .echo export into your app so users can send conversations to
  EchoSpace for review and replay. Triggers: integrate echo, add echo export,
  echo format, echo integration, export to echospace, echo devtools,
  debug conversations, conversation export endpoint
---

# Echo Integration Skill

This skill helps you integrate **export-to-echo** or **copy-as-echo** functionality
into any project. The `.echo` format is an NDJSON-based conversation protocol
used by [EchoSpace](https://github.com/stonexer/echospace). Users export
conversations from your app as `.echo` files, then import them into their local
EchoSpace for review, replay, and continuation.

You are NOT working inside the echospace codebase. You are adding echo export
capability to an external project.

---

## 1. Format Specification

An `.echo` file is **NDJSON** (newline-delimited JSON). Each line is one JSON
object. Line 1 is always a **meta** record. All subsequent lines are **message**
records.

```jsonl
{"kind":"meta","v":1,"id":"conv_abc123","title":"My Chat","created_at":"2025-06-01T12:00:00Z","settings":{"provider":"openai","model":"gpt-4o"}}
{"kind":"message","id":"msg_1","role":"user","created_at":"2025-06-01T12:00:01Z","parts":[{"type":"text","text":"Hello"}]}
{"kind":"message","id":"msg_2","role":"assistant","created_at":"2025-06-01T12:00:02Z","parts":[{"type":"text","text":"Hi there!"}],"meta":{"model":"gpt-4o","usage":{"input_tokens":5,"output_tokens":4}}}
```

### Meta Record (line 1, required)

```ts
{
  kind: "meta";       // always "meta"
  v: 1;               // format version, always 1
  id: string;         // unique conversation ID
  title?: string;     // display title
  created_at: string; // ISO 8601 timestamp
  settings?: {        // optional model/provider settings
    provider?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    response_format?: "text" | "json_object" | "json_schema";
    tools?: Array<{ name: string; description?: string; parameters: object; strict?: boolean }>;
  };
}
```

### Message Record (line 2+)

```ts
{
  kind: "message";       // always "message"
  id: string;            // unique message ID
  role: "system" | "user" | "assistant" | "tool";
  created_at: string;    // ISO 8601 timestamp
  parts: EchoPart[];     // content parts (see below)
  meta?: {               // optional provider metadata
    provider?: string;
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    latency?: { duration?: number; ttft?: number };
  };
}
```

### Part Types

| Type          | Required Fields                  | Optional Fields            |
|---------------|----------------------------------|----------------------------|
| `text`        | `type: "text"`, `text`           | —                          |
| `thinking`    | `type: "thinking"`, `text`       | —                          |
| `tool_call`   | `type: "tool_call"`, `id`, `name`, `input` | —              |
| `tool_result` | `type: "tool_result"`, `tool_call_id`, `output` | `is_error`            |
| `image`       | `type: "image"`                  | `url`, `base64`, `media_type` |

Full TypeScript definitions are bundled in `references/types.ref.ts`.

---

## 2. Building NDJSON

Serialize by writing one `JSON.stringify()` per record, joined by `\n`:

```ts
function serializeEcho(meta: EchoMeta, messages: EchoMessage[]): string {
  return [meta, ...messages].map(r => JSON.stringify(r)).join("\n") + "\n";
}
```

This is the entire serialization logic. No library needed.

---

## 3. Pattern: Export as File Download (Browser)

```ts
function downloadEchoFile(meta: EchoMeta, messages: EchoMessage[]) {
  const ndjson = [meta, ...messages]
    .map(r => JSON.stringify(r))
    .join("\n") + "\n";

  const blob = new Blob([ndjson], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${meta.title || meta.id}.echo`;
  a.click();

  URL.revokeObjectURL(url);
}
```

### Filename Guidance

Recommended format: `YYYY-MM-DD-slug.echo` (e.g. `2025-06-01-my-chat.echo`).
Sanitize the conversation title to remove filesystem-unsafe characters:

```ts
function toSafeFilename(title: string, id: string, date?: Date): string {
  const d = (date ?? new Date()).toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = title
    .toLowerCase()
    .replace(/[\/\\:*?"<>|]/g, "") // strip unsafe chars
    .replace(/\s+/g, "-")          // spaces → hyphens
    .replace(/-+/g, "-")           // collapse consecutive hyphens
    .replace(/^-|-$/g, "")         // trim leading/trailing hyphens
    .slice(0, 80);                 // keep it reasonable
  return `${d}-${slug || id}.echo`;
}
```

---

## 4. Pattern: Copy as Echo Text (Clipboard)

```ts
async function copyAsEcho(meta: EchoMeta, messages: EchoMessage[]) {
  const ndjson = [meta, ...messages]
    .map(r => JSON.stringify(r))
    .join("\n") + "\n";

  await navigator.clipboard.writeText(ndjson);
}
```

---

## 5. Pattern: Save to File (Node.js / Server)

```ts
import { writeFileSync } from "fs";

function saveEchoFile(path: string, meta: EchoMeta, messages: EchoMessage[]) {
  const ndjson = [meta, ...messages]
    .map(r => JSON.stringify(r))
    .join("\n") + "\n";

  writeFileSync(path, ndjson, "utf-8");
}
```

---

## 6. Mapping Your Data to Echo Format

The key task is converting your app's conversation data into echo records.

**Don't forget the system prompt.** If your app uses a system prompt,
export it as the first message with `role: "system"`. EchoSpace uses
this to restore the full conversation context on import.

System prompts are typically stored on the backend and not exposed to
the frontend. For development/debugging, consider adding a **dev-only
API endpoint** (e.g. `GET /api/dev/conversations/:id/echo`) that
assembles the full echo file server-side — including the system prompt.
**Never expose this endpoint in production.**

Here is a typical mapping function:

```ts
interface YourMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  model?: string;
  tokenUsage?: { input: number; output: number };
}

function toEchoRecords(
  conversationId: string,
  title: string,
  messages: YourMessage[],
  provider?: string,
  model?: string,
  systemPrompt?: string,
) {
  const meta = {
    kind: "meta" as const,
    v: 1 as const,
    id: conversationId,
    title,
    created_at: new Date().toISOString(),
    settings: { provider, model },
  };

  const echoMessages = messages.map(msg => ({
    kind: "message" as const,
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system" | "tool",
    created_at: msg.createdAt.toISOString(),
    parts: [{ type: "text" as const, text: msg.content }],
    ...(msg.model || msg.tokenUsage
      ? {
          meta: {
            model: msg.model,
            usage: msg.tokenUsage
              ? { input_tokens: msg.tokenUsage.input, output_tokens: msg.tokenUsage.output }
              : undefined,
          },
        }
      : {}),
  }));

  // Prepend system prompt as the first message if provided
  if (systemPrompt) {
    echoMessages.unshift({
      kind: "message" as const,
      id: `${conversationId}_system`,
      role: "system" as const,
      created_at: meta.created_at,
      parts: [{ type: "text" as const, text: systemPrompt }],
    });
  }

  return { meta, messages: echoMessages };
}
```

### Tool Call Messages

If your app supports tool/function calling, map them to multi-part messages:

```ts
// Assistant message with a tool call
{
  kind: "message",
  id: "msg_3",
  role: "assistant",
  created_at: "2025-06-01T12:00:03Z",
  parts: [
    { type: "text", text: "Let me look that up." },
    { type: "tool_call", id: "call_1", name: "search", input: { query: "weather" } }
  ]
}

// Tool result message
{
  kind: "message",
  id: "msg_4",
  role: "tool",
  created_at: "2025-06-01T12:00:04Z",
  parts: [
    { type: "tool_result", tool_call_id: "call_1", output: { temperature: 22 } }
  ]
}
```

### Server-Side Export with System Prompt

If your system prompt lives on the backend, use a dev-only endpoint to
assemble the full `.echo` file:

```ts
// ⚠️ SECURITY: This endpoint exposes the system prompt.
// It MUST be restricted to development environments only.
// NEVER enable this in production.

app.get("/api/dev/conversations/:id/echo", (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).end();
  }

  const conv = getConversation(req.params.id);
  const { meta, messages } = toEchoRecords(
    conv.id,
    conv.title,
    conv.messages,
    conv.provider,
    conv.model,
    conv.systemPrompt, // include the system prompt
  );

  const ndjson = [meta, ...messages]
    .map(r => JSON.stringify(r))
    .join("\n") + "\n";

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${toSafeFilename(conv.title, conv.id)}"`,
  );
  res.send(ndjson);
});
```

---

## 7. Checklist

Before considering your implementation complete:

- [ ] Meta record has `kind: "meta"`, `v: 1`, `id`, and `created_at`
- [ ] Every message has `kind: "message"`, `id`, `role`, `created_at`, and `parts`
- [ ] Parts is always an array, even for single text content
- [ ] Used `.echo` file extension
- [ ] Used MIME type `application/x-ndjson` for downloads
- [ ] Each line is a single `JSON.stringify()` call (no pretty-printing)
- [ ] File ends with a trailing newline
- [ ] Called `URL.revokeObjectURL()` after browser downloads
- [ ] Timestamps are ISO 8601 strings
- [ ] Role is one of: `"system"`, `"user"`, `"assistant"`, `"tool"`
- [ ] System prompt (if any) exported as `role: "system"` first message
- [ ] Dev-only export endpoint (if used) is guarded by `NODE_ENV` check
- [ ] Filename uses safe characters only; recommended format `YYYY-MM-DD-slug.echo`
