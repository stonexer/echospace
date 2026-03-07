/**
 * Echo format types — the universal .echo message protocol.
 *
 * An .echo file is NDJSON (newline-delimited JSON).
 * Line 1 is always an EchoMeta record.
 * Subsequent lines are EchoMessage records.
 */

// ---------------------------------------------------------------------------
// Parts — the universal content unit
// ---------------------------------------------------------------------------

export interface TextPart {
  type: "text";
  text: string;
}

export interface ThinkingPart {
  type: "thinking";
  text: string;
}

export interface ToolCallPart {
  type: "tool_call";
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultPart {
  type: "tool_result";
  id: string;
  output: unknown;
  is_error?: boolean;
}

export interface ImagePart {
  type: "image";
  url?: string;
  base64?: string;
  media_type?: string;
}

export type EchoPart =
  | TextPart
  | ThinkingPart
  | ToolCallPart
  | ToolResultPart
  | ImagePart;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export interface EchoToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface EchoSettings {
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: "text" | "json_object" | "json_schema";
  json_schema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
  tools?: EchoToolDefinition[];
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type EchoRole = "system" | "user" | "assistant" | "tool";

export interface EchoMeta {
  kind: "meta";
  v: 1;
  id: string;
  title?: string;
  created_at: string;
  settings?: EchoSettings;
}

export interface EchoMessage {
  kind: "message";
  id: string;
  role: EchoRole;
  created_at: string;
  parts: EchoPart[];
  meta?: {
    provider?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    latency?: {
      duration?: number;
      ttft?: number;
    };
  };
}

export type EchoRecord = EchoMeta | EchoMessage;

// ---------------------------------------------------------------------------
// Parsed conversation (in-memory representation)
// ---------------------------------------------------------------------------

export interface EchoConversation {
  meta: EchoMeta;
  messages: EchoMessage[];
}
