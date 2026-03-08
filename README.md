# Echo Space

**The open-source, local-first prompt debugging workspace for LLM developers.**

Debug, iterate, and manage your prompts across OpenAI, Anthropic, and Google — all from your terminal. No cloud, no accounts, no lock-in.

---

## Why Echo Space?

### Local First

All data stored as `.echo` files on disk. No cloud, no accounts. Your prompts stay on your machine, version-controlled alongside your code.

### Open Source & Customizable

MIT-licensed. Pluggable provider adapters (OpenAI, Anthropic, Google). YAML-based config with `${ENV_VAR}` substitution.

### CLI & SDK

`npx echo-space` to launch. Core TypeScript modules (`parseEcho`, `serializeEcho`, `smartParse`, provider registry) can be imported as a library for building your own tools.

---

## Features

- **Multi-provider streaming** — OpenAI, Anthropic, Google Gemini with SSE streaming
- **Universal `.echo` format** — NDJSON-based, human-readable conversation protocol
- **Smart Paste** — auto-detects and converts conversations from ChatGPT, Claude, Gemini, or raw text
- **Timeline / history with branching** — revert to any point in a conversation
- **Tool use support** — `tool_call` / `tool_result` parts
- **Token counting** — tiktoken-based token estimation
- **Image support** — inline images in messages (base64 or URL)
- **Per-conversation model settings** — temperature, max_tokens, top_p, response_format, JSON schema, tools

---

## Quick Start

```bash
npx echo-space
```

Or install globally:

```bash
pnpm add -g echo-space
echo-space ./my-project
```

This will:

1. Create a `.echo/` workspace in your project directory
2. Generate a default config at `~/.echo-space/config.yaml`
3. Start a local server and open the UI in your browser

```
  ╔══════════════════════════════════════╗
  ║           Echo Space v0.1.0          ║
  ╠══════════════════════════════════════╣
  ║  Workspace: /my-project/.echo        ║
  ║  URL:       http://localhost:7788    ║
  ╚══════════════════════════════════════╝
```

### CLI Options

```
echo-space [workdir] [options]

  [workdir]           Workspace directory (default: ".")
  -p, --port <port>   Port to serve on (default: auto-select 7788-7799)
  --no-open           Don't open browser automatically
```

---

## The `.echo` Format

`.echo` files use NDJSON (Newline-Delimited JSON). Line 1 is always the conversation metadata, followed by one line per message.

```jsonl
{"kind":"meta","v":1,"id":"abc123","title":"Weather chat","created_at":"2025-01-01T00:00:00Z","settings":{"provider":"openai","model":"gpt-4o","temperature":0.7}}
{"kind":"message","id":"m_01","role":"user","created_at":"2025-01-01T00:00:01Z","parts":[{"type":"text","text":"What's the weather in Tokyo?"}]}
{"kind":"message","id":"m_02","role":"assistant","created_at":"2025-01-01T00:00:02Z","parts":[{"type":"text","text":"Currently 23°C and sunny in Tokyo."}],"meta":{"model":"gpt-4o","usage":{"input_tokens":12,"output_tokens":15}}}
```

Each message can contain multiple part types: `text`, `thinking`, `tool_call`, `tool_result`, `image`.

---

## Architecture

```
┌─────────┐       ┌──────────────┐       ┌──────────────────┐
│  CLI    │──────▶│  Hono Server │──────▶│ Provider Adapters│
│ (Commander)     │  (localhost)  │       │ ┌──────────────┐ │
└─────────┘       │              │       │ │   OpenAI      │ │──▶ LLM APIs
                  │  /api/*      │       │ │   Anthropic   │ │
┌─────────┐       │              │       │ │   Google      │ │
│ React UI│◀─────▶│  Static files│       │ └──────────────┘ │
│ (browser)│      └──────────────┘       └──────────────────┘
└─────────┘
```

**Tech stack:** React 19 · Hono · Zustand · Tailwind CSS 4 · Vite · CodeMirror · tiktoken

---

## Configuration

On first launch, Echo Space creates `~/.echo-space/config.yaml`:

```yaml
providers:
  - name: openai
    type: openai
    api_key: ${OPENAI_API_KEY}
    models:
      - gpt-4o
      - gpt-4o-mini
      - o1
      - o3-mini

  - name: anthropic
    type: anthropic
    api_key: ${ANTHROPIC_API_KEY}
    models:
      - claude-sonnet-4-6
      - claude-haiku-4-5

  - name: google
    type: google
    api_key: ${GOOGLE_API_KEY}
    models:
      - gemini-2.0-flash
      - gemini-2.5-pro
```

- **`${ENV_VAR}`** syntax is resolved from your environment at runtime
- `.env` files in your project directory are auto-loaded

---

## SDK / Programmatic Usage

Core modules can be imported directly for building your own tooling:

```typescript
import { parseEcho, serializeEcho } from "echo-space/core/echo";
import { smartParse, detectFormat } from "echo-space/core/smart-paste";
import { createProviderRegistry } from "echo-space/core/providers/registry";

// Parse a .echo file
const conversation = parseEcho(fileContents);
console.log(conversation.meta.title);
console.log(conversation.messages.length);

// Detect and convert from other formats
const format = detectFormat(clipboardText); // "openai" | "anthropic" | "google" | "raw" | ...
const messages = smartParse(clipboardText);

// Create a provider registry
const registry = createProviderRegistry();
const adapter = registry.get("openai");
```

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (UI on :5173, API on :7788)
pnpm dev

# Other scripts
pnpm build        # Build for production
pnpm typecheck    # Type-check without emitting
pnpm lint         # ESLint
pnpm format       # Prettier
```

---

## License

MIT
