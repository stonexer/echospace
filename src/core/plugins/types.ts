import type { EchoMessage } from "../echo/types";

/**
 * Render context passed to renderer plugins.
 */
export interface RenderContext {
  theme: "light" | "dark";
  isStreaming: boolean;
  isPeeking: boolean;
}

/**
 * A renderer plugin transforms an EchoMessage for display.
 */
export interface EchoRendererPlugin {
  name: string;
  version: string;

  /** Return true if this renderer should handle this message */
  match(message: EchoMessage): boolean;

  /**
   * Render the message. Returns an HTML string or a React element descriptor.
   * For V1, we return an HTML string that gets rendered via dangerouslySetInnerHTML
   * or a structured descriptor that the UI interprets.
   */
  render(
    message: EchoMessage,
    ctx: RenderContext,
  ): RendererOutput;
}

export type RendererOutput =
  | { type: "html"; html: string }
  | { type: "text"; text: string }
  | { type: "passthrough" }; // Use default rendering

/**
 * Plugin manifest file (echo-plugin.json).
 */
export interface PluginManifest {
  name: string;
  version: string;
  type: "renderer";
  entry: string; // relative path to the JS module
}
