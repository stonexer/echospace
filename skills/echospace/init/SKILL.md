---
name: echospace:init
description: >-
  Initialize echospace configuration. Guide users to select LLM providers,
  enter API keys, and generate ~/.echospace/config.yaml.
  Triggers: echo init, setup echospace, initialize, configure, configure providers
---

# Echo Init Skill

Guide users through echospace initialization — select providers, enter API keys, generate `~/.echospace/config.yaml`.

## Usage

```
/echospace:init
```

## Procedure

### 1. Check existing configuration

Read `~/.echospace/config.yaml` (if it exists). Identify already-configured providers — those with a non-empty `api_key` that is not a `${...}` placeholder.

If a config exists, show the current status:
- List configured provider names
- Show masked API keys (e.g. `sk-****xxxx`, last 4 characters only)

### 2. Ask which providers to configure

Use AskUserQuestion with multiSelect mode. Options:

| Option | Description |
|--------|-------------|
| OpenAI | GPT-4.1, GPT-4o, o3, o4-mini, etc. |
| Anthropic | Claude Sonnet 4.6, Claude Haiku 4.5 |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash, etc. |
| Vercel AI Gateway | Unified gateway supporting multiple providers (requires Vercel AI Gateway API Key) |

If a provider is already configured, mark it as "(configured)" in the option description.

### 3. Collect API keys

For each selected provider, use AskUserQuestion to ask for the API key.

- If the provider already has a key, show the masked version and ask whether to update it
- Tell the user where to get an API key:
  - OpenAI: https://platform.openai.com/api-keys
  - Anthropic: https://console.anthropic.com/settings/keys
  - Google: https://aistudio.google.com/apikey
  - Vercel: Vercel Dashboard → AI Gateway

### 4. Write config file

Write the configuration to `~/.echospace/config.yaml`.

**Config structure** (only includes selected providers):

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
```

**Key rules:**
- Write API keys as plaintext — do **not** use `${VAR}` references
- Use the default model lists below:

| Provider | Models |
|----------|--------|
| openai | gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini, o3, o3-mini, o4-mini |
| anthropic | claude-sonnet-4-6, claude-haiku-4-5 |
| google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash |
| vercel | anthropic/claude-sonnet-4-6, anthropic/claude-haiku-4-5, openai/gpt-4.1, openai/gpt-4.1-mini, openai/gpt-4.1-nano, openai/gpt-4o, openai/gpt-4o-mini, openai/o3, openai/o3-mini, openai/o4-mini, google/gemini-2.5-pro, google/gemini-2.5-flash, google/gemini-2.0-flash, deepseek/deepseek-chat, deepseek/deepseek-reasoner, xai/grok-3-mini |

- Vercel provider requires an additional `base_url: https://ai-gateway.vercel.sh/v1`
- Preserve any existing providers that the user did not select (do not delete them)
- Use the Write tool to write YAML content directly

### 5. Show completion summary

Output a summary like:

```
Configuration complete!

Configured providers:
  - OpenAI (8 models)
  - Anthropic (2 models)

Config file: ~/.echospace/config.yaml

To start echospace:
  npx echospace          # global
  pnpm dev               # development

Tip: You can edit ~/.echospace/config.yaml anytime, or re-run /echospace:init.
```

## Important Notes

- All configuration is written to `~/.echospace/config.yaml` — `.env` is for development only
- API keys are stored as plaintext, not as environment variable references
- Config file uses YAML format
- Providers without a valid API key are automatically filtered out at runtime and won't appear in the UI
