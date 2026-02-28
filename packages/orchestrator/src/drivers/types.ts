import { ToolDefinition } from '@apexcli/core';

/**
 * Common message format for all drivers
 */
export interface DriverMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | DriverContentPart[];
}

/**
 * Support for multimodal content parts
 */
export type DriverContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: any; is_error?: boolean };

/**
 * Options for a driver streaming request
 */
export interface DriverRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  maxTurns?: number;
  tools?: ToolDefinition[];
  context?: any;
  cwd?: string;
  /** MCP server configurations to pass to the SDK */
  mcpServers?: Record<string, any>;
}

/**
 * Events emitted by the driver during streaming
 */
export type DriverEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; content: any; isError: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'status'; message: string }
  | { type: 'complete'; summary: string };

/**
 * Core interface for AI platform drivers
 */
export interface AiDriver {
  /**
   * Unique identifier for the provider (e.g., 'anthropic', 'openai-codex', 'gemini')
   */
  readonly providerId: string;

  /**
   * Initialize the driver, checking for valid session/auth
   */
  initialize(): Promise<void>;

  /**
   * Perform authentication (e.g., browser-based OAuth)
   */
  authenticate(): Promise<void>;

  /**
   * Main execution loop for agentic tasks.
   * Handles streaming responses and tool-call handoffs.
   */
  stream(request: DriverRequest): AsyncIterable<DriverEvent>;

  /**
   * Resolve a model alias (e.g. 'opus', 'sonnet') to a provider-specific model ID.
   */
  resolveModel(modelAlias: string): string;

  /**
   * Cleanup resources (e.g., close browser, disconnect sessions)
   */
  dispose(): Promise<void>;
}
