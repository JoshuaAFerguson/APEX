/**
 * Type definitions for tool mocking utilities
 *
 * Provides comprehensive types for mocking Claude Agent SDK tool calls,
 * responses, and verification patterns in test suites.
 */

import type { z } from 'zod';

/**
 * Content block types for tool responses (matches SDK types)
 */
export type MockToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } };

/**
 * Result of a mock tool execution
 */
export interface MockToolResult {
  content: MockToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Record of a tool invocation for tracking and verification
 */
export interface ToolInvocationRecord {
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
  callId: string;
  result?: MockToolResult;
  error?: Error;
  duration?: number;
}

/**
 * Configuration for mock tool behavior
 */
export interface MockToolConfig {
  /** Static response to return */
  response?: MockToolResult;
  /** Dynamic handler function */
  handler?: MockToolHandler;
  /** Sequence of responses to cycle through */
  responseSequence?: MockToolResult[];
  /** Delay in ms before returning */
  delay?: number;
  /** Error to throw on specific call number */
  errorOnCall?: Array<{ callNumber: number; error: Error }>;
  /** Maximum number of invocations allowed */
  maxInvocations?: number;
}

/**
 * Handler function type for dynamic tool responses
 */
export type MockToolHandler = (
  args: Record<string, unknown>,
  context: MockToolContext
) => MockToolResult | Promise<MockToolResult>;

/**
 * Context provided to mock tool handlers
 */
export interface MockToolContext {
  toolName: string;
  callId: string;
  invocationCount: number;
  timestamp: Date;
}

/**
 * Definition of a mock tool
 */
export interface MockToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  config: MockToolConfig;
}

/**
 * Verification result for tool call sequence assertions
 */
export interface ToolCallVerificationResult {
  passed: boolean;
  expectedSequence: string[];
  actualSequence: string[];
  mismatches: Array<{
    index: number;
    expected: string;
    actual: string | undefined;
  }>;
}

/**
 * Expectation for tool call verification
 */
export interface ToolCallExpectation {
  toolName: string;
  input?: Record<string, unknown> | ((input: Record<string, unknown>) => boolean);
  times?: number | { min?: number; max?: number };
}

/**
 * Options for tool execution simulation
 */
export interface ToolExecutionOptions {
  /** Whether to check permissions before execution */
  checkPermissions?: boolean;
  /** Override delay configuration */
  delay?: number;
  /** Force specific error */
  forceError?: Error;
}

/**
 * Statistics for tool usage tracking
 */
export interface ToolUsageStatistics {
  totalInvocations: number;
  totalDuration: number;
  averageDuration: number;
  errorRate: number;
  lastInvocation?: Date;
  firstInvocation?: Date;
}

/**
 * Pattern matcher for tool call verification
 */
export type ToolCallPattern = {
  toolName: string | RegExp;
  input?: Record<string, unknown> | ((input: Record<string, unknown>) => boolean);
  order?: 'strict' | 'loose';
  times?: number | { min?: number; max?: number };
};

/**
 * Result of pattern matching verification
 */
export interface PatternMatchResult {
  passed: boolean;
  pattern: ToolCallPattern;
  matches: ToolInvocationRecord[];
  violations: Array<{
    type: 'missing' | 'extra' | 'out_of_order' | 'invalid_input';
    message: string;
    expected?: unknown;
    actual?: unknown;
  }>;
}