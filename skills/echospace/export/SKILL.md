---
name: echospace:export
description: >-
  Convert conversation files (OpenAI, Anthropic, Google, Vercel/Helicone, raw
  text) into .echo format. Triggers: echo export, convert to echo, json to echo,
  helicone to echo, openai to echo, anthropic to echo, convert conversation
---

# Echo Export Skill

Convert any conversation file into `.echo` NDJSON format for use with EchoSpace.

## Usage

```
/echo-export <file-or-glob>
```

Examples:
- `/echo-export helicone.json`
- `/echo-export exports/*.json`
- `/echo-export .` (convert all supported files in current directory)

## Supported Input Formats

| Format | Detection |
|--------|-----------|
| OpenAI | `messages[]` with `role` + `content`, or `{ messages: [...] }` |
| Anthropic | `content[]` with type blocks, or `{ system, messages }` |
| Google Gemini | `{ contents: [{ parts }] }` |
| Vercel AI / Helicone | `{ request: { prompt: [...] }, response: { ... } }` |
| Raw text | Lines starting with `User:` / `Assistant:` / `System:` |
| Echo (NDJSON) | Already `.echo` — skip or rewrite |

## Procedure

1. **Resolve input files.** If the argument is a glob or directory, expand it. Filter to `.json`, `.jsonl`, `.txt`, and `.echo` files.

2. **For each file:**
   a. Read the file content.
   b. Detect the format using these rules (in order):
      - Try `JSON.parse()`. If it succeeds:
        - Has `request.prompt` array → **Vercel**
        - Has `request.messages` array → **OpenAI** (Helicone wrapper)
        - Is array with `role` + `content` objects → **OpenAI**
        - Has `messages` array → **OpenAI**
        - Has `content` array with `type: "text"` blocks → **Anthropic**
        - Has `contents` array with `parts` → **Google**
      - If JSON parse fails, try NDJSON: parse first line, check for `kind: "meta"` or `kind: "message"` → **Echo**
      - Check for `User:` / `Assistant:` / `System:` line patterns → **Raw text**
      - Otherwise → **Unknown** (skip with warning)

   c. Parse the messages according to the detected format:

      **OpenAI:**
      - Unwrap Helicone `{ request, response }` wrapper if present
      - Map `role` directly (`system`, `user`, `assistant`, `tool`)
      - String `content` → single text part; array `content` → map `text` and `image_url` blocks
      - `reasoning_content` string → prepend as `thinking` part
      - `tool_calls[]` → `tool_call` parts (`function.name`, `function.arguments`)
      - `role: "tool"` with `tool_call_id` → `tool_result` part
      - Append response choices/messages as additional messages

      **Anthropic:**
      - Extract top-level `system` field as first `role: "system"` message
      - Map content blocks: `text` → text, `thinking` → thinking, `tool_use` → tool_call, `tool_result` → tool_result, `image` (base64) → image

      **Google Gemini:**
      - `systemInstruction.parts` → system message
      - `role: "model"` → `assistant`
      - `functionCall` → tool_call, `functionResponse` → tool_result

      **Vercel AI SDK:**
      - Part type mapping: `tool-call` → `tool_call` (`toolCallId` → `id`, `toolName` → `name`), `tool-result` → `tool_result` (unwrap `{ type: "json", value }` wrappers), `reasoning` → `thinking`
      - Append response choices as final assistant message with model/usage metadata

      **Raw text:**
      - Split on `User:` / `Human:` / `Assistant:` / `System:` line prefixes
      - Each section becomes a message with a single text part

   d. Build the echo conversation:
      ```
      meta: { kind: "meta", v: 1, id: <nanoid>, title: <filename without extension>, created_at: <now> }
      messages: <parsed messages, each with kind: "message">
      ```

   e. Serialize to NDJSON: one `JSON.stringify()` per record, joined by `\n`, trailing newline.

   f. Write to `<original-name>.echo` in the same directory (e.g., `helicone.json` → `helicone.echo`). If the output file already exists, warn the user before overwriting.

3. **Report results.** Print a summary: how many files converted, any skipped files, output paths.

## Output Format

The `.echo` file is NDJSON. Line 1 is always the meta record. Subsequent lines are message records.

```jsonl
{"kind":"meta","v":1,"id":"abc123","title":"My Chat","created_at":"2025-06-01T12:00:00Z"}
{"kind":"message","id":"msg_1","role":"user","created_at":"2025-06-01T12:00:01Z","parts":[{"type":"text","text":"Hello"}]}
{"kind":"message","id":"msg_2","role":"assistant","created_at":"2025-06-01T12:00:02Z","parts":[{"type":"text","text":"Hi!"}]}
```

## Important Notes

- Generate unique IDs with `nanoid(8)` for any missing `id` fields
- Always use ISO 8601 timestamps for `created_at`
- The `parts` field is always an array, even for single text content
- Do NOT pretty-print JSON lines — each line must be a single compact JSON object
- File ends with a trailing newline
- When the input is already `.echo` format, skip it (no need to re-convert)
