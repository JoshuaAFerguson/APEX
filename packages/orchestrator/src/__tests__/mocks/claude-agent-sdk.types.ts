/**
 * Type definitions for Claude Agent SDK mock utilities
 *
 * These types mirror the structure of the actual Claude Agent SDK
 * while providing simplified interfaces for testing purposes.
 */

// SDK imports to match actual types
import type {
  AgentDefinition as SDKAgentDefinition,
  QueryOptions
} from '@anthropic-ai/claude-agent-sdk';
import type { MockedFunction } from 'vitest';

// Content Block Types
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

// Message Types
export interface MockMessage {
  role: 'assistant' | 'user';
  content: ContentBlock[];
}

// Output Types
export interface MockOutput {
  success?: boolean;
  messages?: MockMessage[];
}

// Usage Types
export interface MockUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  input_tokens?: number;  // Alternative naming for SDK compatibility
  output_tokens?: number; // Alternative naming for SDK compatibility
}

// Response Types
export interface MockQueryResponse {
  requestId?: string;
  output?: MockOutput;
  usage?: MockUsage;
  content?: string;  // Simplified text-only response
}

// Response Options for delays and other configurations
export interface ResponseOptions {
  delay?: number;  // Delay in milliseconds before returning
}

// Dynamic Response Handler Type
export type DynamicResponseHandler = (
  agent: SDKAgentDefinition,
  message: string,
  options?: QueryOptions
) => MockQueryResponse | StreamingEvent[] | Error | null | Promise<MockQueryResponse | StreamingEvent[] | Error | null>;

// Streaming Event Types
export interface StreamingEvent {
  type: 'assistant' | 'text' | 'thinking' | 'tool_use' | 'usage' | 'error';
  data: unknown;
  delay?: number;  // Optional delay in ms before yielding
}

// Call Tracking Types
export interface QueryCallRecord {
  timestamp: Date;
  agent: SDKAgentDefinition;
  message: string;
  options?: QueryOptions;
}

// Hook Types (for testing hook functionality)
export interface MockHookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

// Query Function Type
export type MockQueryFunction = MockedFunction<typeof import('@anthropic-ai/claude-agent-sdk').query>;

// Common Error Types
export const MockErrors = {
  sessionLimit: () => new Error('Session limit reached: Context window utilization is 85%'),
  budgetExceeded: () => new Error('Task exceeded budget limit'),
  networkTimeout: () => new Error('Network timeout'),
  rateLimit: () => new Error('Rate limit exceeded'),
  invalidResponse: () => new Error('Invalid response format'),
  usageLimit: () => new Error('Usage limit reached: You have exhausted your monthly included credits'),
} as const;