# ADR-095: Core Tool Mock Types and Interfaces for Claude Agent SDK

**Status**: Approved
**Date**: 2025-02-12
**Author**: Architect Agent
**Related**: ADR-094-tool-mocking-utilities-claude-agent-sdk.md

## Context

The acceptance criteria for this task require:
1. TypeScript interfaces exist for `MockTool`, `MockToolResponse`, `ToolInvocation`, and `MockToolExecutor`
2. Types align with Claude Agent SDK tool structures
3. Types are exported from a **new test utilities module**

### Existing Infrastructure Analysis

The orchestrator package already contains extensive mock infrastructure in `packages/orchestrator/src/__tests__/mocks/`:

| Existing Type | Purpose | Gap |
|---------------|---------|-----|
| `MockToolDefinition` | Tool definition with schema and config | Need to add `MockTool` as an alias with cleaner API |
| `MockToolResult` | Tool execution result with content | Need `MockToolResponse` as SDK-aligned alias |
| `ToolInvocationRecord` | Invocation tracking | Need `ToolInvocation` as cleaner interface |
| (none) | Tool executor contract | Need `MockToolExecutor` interface |

### Claude Agent SDK Tool Structure

Based on `@anthropic-ai/claude-agent-sdk`, tools follow this structure:

```typescript
// SDK tool() function signature
function tool<T extends ZodObject>(
  name: string,
  description: string,
  schema: T,
  handler: (input: z.infer<T>) => ToolResult | Promise<ToolResult>
): Tool;

// SDK ToolResult type
interface ToolResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } }
  >;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
```

## Decision

Create core tool mock types in a new file `packages/orchestrator/src/__tests__/mocks/tool-mock-core.types.ts` that:

1. Defines clean, SDK-aligned interfaces: `MockTool`, `MockToolResponse`, `ToolInvocation`, `MockToolExecutor`
2. Maintains compatibility with existing types through type aliases and extensions
3. Exports all types through the existing `mocks/index.ts` barrel file

## Technical Design

### 1. Core Type Definitions

```typescript
// packages/orchestrator/src/__tests__/mocks/tool-mock-core.types.ts

import type { z } from 'zod';

/**
 * Content types that can be returned from tool execution.
 * Aligns with Claude Agent SDK ToolResult content types.
 */
export type ToolContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } };

/**
 * Response from a mock tool execution.
 * Aligns with Claude Agent SDK ToolResult structure.
 */
export interface MockToolResponse {
  /** Content blocks returned by the tool */
  content: ToolContentBlock[];
  /** Optional structured data for programmatic access */
  structuredContent?: Record<string, unknown>;
  /** Whether this response represents an error condition */
  isError?: boolean;
}

/**
 * Record of a single tool invocation for tracking and verification.
 * Captures all data needed to verify tool usage patterns in tests.
 */
export interface ToolInvocation {
  /** Name of the tool that was invoked */
  toolName: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
  /** Unique identifier for this invocation */
  callId: string;
  /** When the tool was invoked */
  timestamp: Date;
  /** Duration of execution in milliseconds */
  duration?: number;
  /** Response from the tool (if successful) */
  response?: MockToolResponse;
  /** Error that occurred (if failed) */
  error?: Error;
}

/**
 * Definition of a mock tool for testing.
 * Provides all configuration needed to simulate tool behavior.
 */
export interface MockTool<TInput extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique name identifying this tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for validating tool input */
  inputSchema: z.ZodType<TInput>;
  /**
   * Handler function that processes input and returns a response.
   * Can be synchronous or asynchronous.
   */
  handler: (input: TInput, context: ToolExecutionContext) => MockToolResponse | Promise<MockToolResponse>;
}

/**
 * Context provided to tool handlers during execution.
 */
export interface ToolExecutionContext {
  /** Unique identifier for this execution */
  callId: string;
  /** Name of the tool being executed */
  toolName: string;
  /** How many times this tool has been invoked */
  invocationCount: number;
  /** Timestamp when execution started */
  timestamp: Date;
}

/**
 * Contract for components that can execute mock tools.
 * Enables dependency injection and testing of tool execution flows.
 */
export interface MockToolExecutor {
  /**
   * Execute a tool with the given input.
   * @param toolName - Name of the tool to execute
   * @param input - Input parameters for the tool
   * @returns The tool's response
   * @throws Error if tool not found or execution fails
   */
  execute(toolName: string, input: Record<string, unknown>): Promise<MockToolResponse>;

  /**
   * Check if a tool is registered and available for execution.
   * @param toolName - Name of the tool to check
   */
  hasToolAvailable(toolName: string): boolean;

  /**
   * Get all tool invocations, optionally filtered by tool name.
   * @param toolName - Optional tool name to filter by
   */
  getInvocations(toolName?: string): ToolInvocation[];

  /**
   * Get the most recent invocation for a tool.
   * @param toolName - Name of the tool
   */
  getLastInvocation(toolName: string): ToolInvocation | undefined;

  /**
   * Clear all recorded invocations.
   */
  clearInvocations(): void;
}

/**
 * Options for configuring mock tool behavior.
 */
export interface MockToolOptions {
  /** Fixed response to return for all invocations */
  response?: MockToolResponse;
  /** Sequence of responses to cycle through */
  responseSequence?: MockToolResponse[];
  /** Delay in milliseconds before returning */
  delay?: number;
  /** Schedule errors on specific invocation numbers */
  errorOnCall?: Array<{ callNumber: number; error: Error }>;
  /** Maximum number of invocations allowed before throwing */
  maxInvocations?: number;
}

/**
 * Result of verifying a sequence of tool calls.
 */
export interface ToolSequenceVerificationResult {
  /** Whether the verification passed */
  passed: boolean;
  /** Expected sequence of tool names */
  expected: string[];
  /** Actual sequence of tool names */
  actual: string[];
  /** Details of any mismatches found */
  mismatches: Array<{
    index: number;
    expected: string;
    actual: string | undefined;
  }>;
}

/**
 * Factory function type for creating mock tools with fluent API.
 */
export type MockToolFactory = <TInput extends Record<string, unknown>>(
  name: string
) => MockToolBuilder<TInput>;

/**
 * Builder interface for fluent mock tool construction.
 */
export interface MockToolBuilder<TInput extends Record<string, unknown>> {
  withDescription(description: string): MockToolBuilder<TInput>;
  withSchema(schema: z.ZodType<TInput>): MockToolBuilder<TInput>;
  withResponse(response: MockToolResponse): MockToolBuilder<TInput>;
  withHandler(
    handler: (input: TInput, context: ToolExecutionContext) => MockToolResponse | Promise<MockToolResponse>
  ): MockToolBuilder<TInput>;
  withOptions(options: MockToolOptions): MockToolBuilder<TInput>;
  build(): MockTool<TInput>;
}
```

### 2. Type Compatibility Layer

To maintain backward compatibility with existing types:

```typescript
// packages/orchestrator/src/__tests__/mocks/tool-mock-core.types.ts (continued)

import type {
  MockToolResult,
  MockToolContent,
  ToolInvocationRecord,
  MockToolDefinition,
  MockToolConfig,
  MockToolHandler,
  MockToolContext,
} from './tool-mock.types';

// Re-export existing types for compatibility
export type {
  MockToolResult,
  MockToolContent,
  ToolInvocationRecord,
  MockToolDefinition,
  MockToolConfig,
  MockToolHandler,
  MockToolContext,
};

/**
 * Type guard to check if a value is a MockToolResponse
 */
export function isMockToolResponse(value: unknown): value is MockToolResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'content' in value &&
    Array.isArray((value as MockToolResponse).content)
  );
}

/**
 * Convert MockToolResult to MockToolResponse (they are compatible)
 */
export function toMockToolResponse(result: MockToolResult): MockToolResponse {
  return {
    content: result.content,
    structuredContent: result.structuredContent,
    isError: result.isError,
  };
}

/**
 * Convert ToolInvocationRecord to ToolInvocation
 */
export function toToolInvocation(record: ToolInvocationRecord): ToolInvocation {
  return {
    toolName: record.toolName,
    input: record.input,
    callId: record.callId,
    timestamp: record.timestamp,
    duration: record.duration,
    response: record.result ? toMockToolResponse(record.result) : undefined,
    error: record.error,
  };
}
```

### 3. Export Structure

Update `packages/orchestrator/src/__tests__/mocks/index.ts`:

```typescript
// Add to existing exports:

// Core Tool Mock Types (ADR-095)
export type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  ToolContentBlock,
  ToolExecutionContext,
  MockToolOptions,
  ToolSequenceVerificationResult,
  MockToolFactory,
  MockToolBuilder,
} from './tool-mock-core.types';

export {
  isMockToolResponse,
  toMockToolResponse,
  toToolInvocation,
} from './tool-mock-core.types';

// Re-export existing tool mock types for compatibility
export type {
  MockToolResult,
  MockToolContent,
  ToolInvocationRecord,
  MockToolDefinition,
  MockToolConfig,
  MockToolHandler,
  MockToolContext,
  ToolCallVerificationResult,
  ToolCallExpectation,
  ToolExecutionOptions,
  ToolUsageStatistics,
  ToolCallPattern,
  PatternMatchResult,
} from './tool-mock.types';
```

### 4. File Structure

```
packages/orchestrator/src/__tests__/mocks/
├── index.ts                      # Barrel file (update with new exports)
├── claude-agent-sdk.ts           # MockClaudeAgentSDK class
├── claude-agent-sdk.types.ts     # SDK mock types
├── tool-mock.types.ts            # Existing tool mock types (keep as-is)
├── tool-mock-core.types.ts       # NEW: Core types per acceptance criteria
├── tool-mock-registry.ts         # (future: implementation)
├── tool-mock-builder.ts          # (future: implementation)
└── permission-revocation.ts      # Permission revocation utilities
```

### 5. Type Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Core Types (ADR-095)                                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │    MockTool     │  │ MockToolResponse │  │  ToolInvocation  │       │
│  │  - name         │  │  - content       │  │  - toolName      │       │
│  │  - description  │  │  - structured... │  │  - input         │       │
│  │  - inputSchema  │  │  - isError       │  │  - callId        │       │
│  │  - handler      │  └──────────────────┘  │  - timestamp     │       │
│  └─────────────────┘           ↑            │  - response      │       │
│                                │            │  - error         │       │
│                       ┌────────┴────────┐   └──────────────────┘       │
│                       │ ToolContentBlock│            ↑                  │
│                       │  text | image   │            │                  │
│                       │  | resource     │   ┌───────┴────────┐         │
│                       └─────────────────┘   │MockToolExecutor│         │
│                                             │  - execute()   │         │
│                                             │  - getInvoc... │         │
│                                             │  - clearInvoc..│         │
│                                             └────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Compatible with
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    Existing Types (tool-mock.types.ts)                   │
│  ┌───────────────────┐  ┌────────────────┐  ┌───────────────────────┐  │
│  │MockToolDefinition │  │ MockToolResult │  │ToolInvocationRecord   │  │
│  │  - name           │  │  - content     │  │  - toolName           │  │
│  │  - description    │  │  - structured  │  │  - input              │  │
│  │  - schema         │  │  - isError     │  │  - callId             │  │
│  │  - config         │  └────────────────┘  │  - result             │  │
│  └───────────────────┘                      │  - error              │  │
│                                             └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria Mapping

| Acceptance Criteria | Implementation |
|---------------------|----------------|
| TypeScript interfaces exist for `MockTool` | `MockTool<TInput>` interface with generic type support |
| TypeScript interfaces exist for `MockToolResponse` | `MockToolResponse` interface aligned with SDK ToolResult |
| TypeScript interfaces exist for `ToolInvocation` | `ToolInvocation` interface for tracking calls |
| TypeScript interfaces exist for `MockToolExecutor` | `MockToolExecutor` interface defining executor contract |
| Types align with Claude Agent SDK tool structures | `ToolContentBlock`, `MockToolResponse` mirror SDK types |
| Types exported from new test utilities module | `tool-mock-core.types.ts` with exports in `index.ts` |

## Implementation Plan

| Step | Task | File |
|------|------|------|
| 1 | Create core types file | `tool-mock-core.types.ts` |
| 2 | Update barrel exports | `mocks/index.ts` |
| 3 | Add type conversion helpers | `tool-mock-core.types.ts` |
| 4 | Write unit tests for types | `tool-mock-core.types.test.ts` |
| 5 | Verify build passes | `npm run build` |
| 6 | Verify tests pass | `npm run test` |

## Consequences

### Positive

- **Clean API**: New types provide cleaner, more intuitive interfaces
- **SDK Alignment**: Types closely mirror Claude Agent SDK structures
- **Backward Compatible**: Existing types remain functional
- **Type Safety**: Generic support enables strong typing
- **Testability**: `MockToolExecutor` interface enables DI and mocking

### Negative

- **Type Duplication**: Some overlap with existing types (mitigated by re-exports)
- **Learning Curve**: Developers need to understand both old and new types

### Neutral

- **Gradual Migration**: Teams can adopt new types incrementally
- **Documentation Needed**: JSDoc comments provide inline guidance

## References

- ADR-094: Tool Mocking Utilities for Claude Agent SDK Integration
- ADR-035: Claude Agent SDK Mock Utilities
- Claude Agent SDK `tool()` function documentation
- packages/orchestrator/src/__tests__/mocks/tool-mock.types.ts
