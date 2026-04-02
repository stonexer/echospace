<p align="center">
  <img src="assets/echospace-logo/echospace-logo.png" alt="EchoSpace" width="128" />
</p>

<h1 align="center">EchoSpace</h1>

<p align="center"><strong>The open-source, local-first prompt debugging workspace for LLM developers.</strong></p>

<p align="center">
  Debug, iterate, and manage your prompts across multiple LLM providers — all from your terminal.<br/>
  No cloud. No accounts. No lock-in.
</p>

---

## Why EchoSpace?

Prompt engineering is iterative, but most tools make you choose between a polished UI and full control over your data. EchoSpace gives you both: a browser-based workspace that runs entirely on your machine, stores conversations as plain files you can version-control, and works with any OpenAI-compatible provider out of the box.

- **Local-first** — all data stored as `.echo` files on disk, version-controlled alongside your code
- **Open source** — MIT-licensed, pluggable provider adapters, `${ENV_VAR}` substitution in config
- **CLI & library** — `npx echospace@alpha` to launch; core modules (`parseEcho`, `serializeEcho`, `smartParse`, provider registry) are importable as a library

---

## Features

- **Multi-provider streaming** — SSE streaming across all configured providers (OpenAI, Anthropic, Google, or any OpenAI-compatible gateway)
- **Universal `.echo` format** — NDJSON-based, human-readable conversation protocol designed for diffing and version control
- **Smart Paste** — auto-detects and converts conversation exports from major LLM platforms or raw text
- **Timeline & branching** — revert to any point in a conversation, fork branches, compare results
- **Tool use support** — first-class `tool_call` / `tool_result` message parts
- **Token counting** — tiktoken-based token estimation shown in real time
- **Image support** — inline images in messages via base64 or URL
- **Per-conversation model settings** — temperature, max_tokens, top_p, response_format, JSON schema, tools

---

## Hello World

Get your first conversation running in under a minute:

```bash
# 1. Install and initialize
npx echospace@alpha init

# 2. Launch the workspace
npx echospace@alpha
```

Open the UI in your browser, create a new conversation, and send your first message:

```
Hello, world!
```

EchoSpace will stream the response live and save the conversation as a `.echo` file in your project directory.

---

## Getting Started

### 1. Initialize

```bash
npx echospace@alpha init
```

The interactive setup wizard configures your provider and API key:

```
◆ Which LLM service do you use?
│ ○ OpenAI
│ ○ Anthropic (Claude)
│ ○ Google (Gemini)
│ ○ Vercel AI Gateway
│ ○ Custom Gateway (OpenAI-compatible)

◆ Enter your API Key:
│ sk-xxxxxxxx

✓ Config saved to ~/.echospace/config.yaml

◆ Install agent skills for your coding agent? (Claude Code, Codex, etc.)
│ ● Yes / ○ No

✓ Skills installed!
```

### 2. Launch

```bash
npx echospace@alpha
```

Or install globally:

```bash
pnpm add -g echospace@alpha
echospace ./my-project
```

EchoSpace will:

1. Create a `.echo/` workspace in your project directory
2. Start a local server and open the UI in your browser

```
  ██████████████
  ██          ██   EchoSpace v0.1.0
  ██  ██████  ██
  ██  ██  ██  ██   Workspace  /my-project/.echo
  ██  ██████  ██   URL        http://localhost:3240
  ██          ██
  ██████████████
```

### CLI Options

```
echospace [workdir] [options]

  [workdir]           Workspace directory (default: ".")
  -p, --port <port>   Port to serve on (default: auto-select 3240-3249)
  --no-open           Don't open browser automatically
```

### Agent Skills

| Skill | Description |
| --- | --- |
| `/echospace-export` | Convert conversation exports from major LLM platforms into `.echo` format |
| `/echospace-integrate` | Integrate a `.echo` export into your own app |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Tailwind CSS v4, Zustand, CodeMirror |
| Backend | Hono, Node.js |
| Build | Vite, tsup, TypeScript 5 |
| Testing | Vitest |
| Tokenization | tiktoken |
| Package manager | pnpm |

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

## Configuration

Run `npx echospace@alpha init` to create `~/.echospace/config.yaml`, or edit it manually:

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

  - name: vercel-ai-gateway
    type: openai
    api_key: xxxxxxxx
    base_url: https://ai-gateway.vercel.sh/v1
    models:
      - anthropic/claude-sonnet-4-6
      - openai/gpt-4.1
      - google/gemini-2.5-pro

  # Custom OpenAI-compatible gateway
  - name: custom
    type: openai          # or: anthropic, google
    api_key: xxxxxxxx
    base_url: https://my-proxy.example.com/v1
    models:
      - my-model-name
```

> **Tip:** `${ENV_VAR}` syntax is supported for API keys — values are resolved from your environment at runtime. `.env` files in your project directory are auto-loaded.

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (UI on :5173, API on :3240)
pnpm dev

# Other scripts
pnpm build        # Build for production
pnpm typecheck    # Type-check without emitting
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm test         # Run tests
```

---

## License

MIT
