# EchoSpace

**The open-source, local-first prompt debugging workspace for LLM developers.**

Debug, iterate, and manage your prompts across OpenAI, Anthropic, and Google — all from your terminal. No cloud, no accounts, no lock-in.

---

## Why EchoSpace?

### Local First

All data stored as `.echo` files on disk. No cloud, no accounts. Your prompts stay on your machine, version-controlled alongside your code.

### Open Source & Customizable

MIT-licensed. Pluggable provider adapters (OpenAI, Anthropic, Google). YAML-based config with `${ENV_VAR}` substitution.

### CLI & SDK

`npx echospace` to launch. Core TypeScript modules (`parseEcho`, `serializeEcho`, `smartParse`, provider registry) can be imported as a library for building your own tools.

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

### 1. Install skills

EchoSpace ships with agent skills that work with any coding agent — [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenAI Codex](https://openai.com/index/codex/), or any tool that supports the skills/SKILL.md convention.

**Claude Code:**

```bash
claude install-skill https://github.com/stonexer/echospace/tree/master/skills/echospace
```

**Other agents:** Copy the `skills/echospace/` directory into your project's skills folder.

### 2. Configure providers

Run the interactive setup wizard in your coding agent:

```
/echospace:init
```

This will guide you through selecting LLM providers (OpenAI, Anthropic, Google, Vercel AI Gateway) and entering API keys. The config is saved to `~/.echospace/config.yaml`.

### 3. Launch

```bash
npx echospace
```

Or install globally:

```bash
pnpm add -g echospace
echospace ./my-project
```

This will:

1. Create a `.echo/` workspace in your project directory
2. Start a local server and open the UI in your browser

```
  ╔══════════════════════════════════════╗
  ║           EchoSpace v0.1.0          ║
  ╠══════════════════════════════════════╣
  ║  Workspace: /my-project/.echo        ║
  ║  URL:       http://localhost:7788    ║
  ╚══════════════════════════════════════╝
```

### Available Skills

| Skill | Description |
|-------|-------------|
| `/echospace:init` | Interactive setup wizard — select providers, enter API keys, generate config |
| `/echospace:export` | Convert conversation files (OpenAI, Anthropic, Google, Helicone, raw text) into `.echo` format |
| `/echospace:integrate` | Integrate `.echo` export into your own app |

### CLI Options

```
echospace [workdir] [options]

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

On first launch, EchoSpace creates `~/.echospace/config.yaml`. Fill in the `api_key` for the providers you want to use — unconfigured providers are automatically ignored.

```yaml
providers:
  - name: openai
    type: openai
    api_key: sk-xxxxxxxx
    models:
      - gpt-4.1
      - gpt-4.1-mini
      - gpt-4.1-nano
      - gpt-4o
      - gpt-4o-mini
      - o3
      - o3-mini
      - o4-mini

  - name: anthropic
    type: anthropic
    api_key: sk-ant-xxxxxxxx
    models:
      - claude-sonnet-4-6
      - claude-haiku-4-5

  - name: google
    type: google
    api_key: AIza-xxxxxxxx
    models:
      - gemini-2.5-pro
      - gemini-2.5-flash
      - gemini-2.0-flash
```

> **Tip:** `${ENV_VAR}` syntax is also supported for API keys — they are resolved from your environment at runtime. `.env` files in your project directory are auto-loaded.

---

## SDK / Programmatic Usage

Core modules can be imported directly for building your own tooling:

```typescript
import { parseEcho, serializeEcho } from "echospace/core/echo";
import { smartParse, detectFormat } from "echospace/core/smart-paste";
import { createProviderRegistry } from "echospace/core/providers/registry";

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
