# ADR-035: Claude Agent SDK Mock Utilities for Testing

**Status**: Proposed
**Date**: 2025-01-10
**Author**: Architect Agent

## Context

The APEX codebase currently has over 70 test files that mock the `@anthropic-ai/claude-agent-sdk` module. Each test file independently defines its own mock implementation using `vi.mock()`, leading to:

1. **Code duplication**: Similar async generator patterns repeated across files
2. **Inconsistent mocking**: Different mock structures that may not accurately reflect SDK behavior
3. **Maintenance burden**: Changes to SDK interface require updates across many files
4. **Missing capabilities**: No standardized way to simulate streaming, errors, or complex scenarios

## Decision

Create a centralized `MockClaudeAgentSDK` class with supporting utilities in a dedicated test utilities module at `packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts`.

## Technical Design

### 1. Core Components

#### 1.1 MockClaudeAgentSDK Class

```typescript
/**
 * MockClaudeAgentSDK - Comprehensive mock for @anthropic-ai/claude-agent-sdk
 *
 * Provides configurable mocking for:
 * - query() function calls
 * - Streaming responses via async generators
 * - Error simulation
 * - Usage tracking
 */
export class MockClaudeAgentSDK {
  private queryResponses: MockQueryResponse[] = [];
  private queryCallHistory: QueryCallRecord[] = [];
  private defaultResponse: MockQueryResponse | null = null;

  /**
   * Configure a mock response for the next query() call
   */
  addResponse(response: MockQueryResponse): this;

  /**
   * Configure multiple responses in sequence
   */
  addResponses(responses: MockQueryResponse[]): this;

  /**
   * Set a default response used when queue is empty
   */
  setDefaultResponse(response: MockQueryResponse): this;

  /**
   * Configure an error to be thrown on next call
   */
  addError(error: Error | string): this;

  /**
   * Configure streaming events
   */
  addStreamingResponse(events: StreamingEvent[]): this;

  /**
   * Get the mock query function to use with vi.mock()
   */
  getQueryMock(): MockedFunction<typeof query>;

  /**
   * Get call history for assertions
   */
  getCallHistory(): QueryCallRecord[];

  /**
   * Reset all state
   */
  reset(): void;
}
```

#### 1.2 Type Definitions

```typescript
// Response types
export interface MockQueryResponse {
  requestId?: string;
  output?: MockOutput;
  usage?: MockUsage;
  content?: string;  // Simplified text-only response
}

export interface MockOutput {
  success?: boolean;
  messages?: MockMessage[];
}

export interface MockMessage {
  role: 'assistant' | 'user';
  content: ContentBlock[];
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface MockUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

// Streaming types
export interface StreamingEvent {
  type: 'assistant' | 'text' | 'thinking' | 'tool_use' | 'usage' | 'error';
  data: unknown;
  delay?: number;  // Optional delay in ms before yielding
}

// Call tracking
export interface QueryCallRecord {
  timestamp: Date;
  agent: SDKAgentDefinition;
  message: string;
  options?: QueryOptions;
}
```

#### 1.3 Builder Pattern for Complex Scenarios

```typescript
export class MockResponseBuilder {
  private response: MockQueryResponse = {};

  static create(): MockResponseBuilder;

  withText(text: string): this;
  withThinking(thinking: string): this;
  withToolUse(id: string, name: string, input: Record<string, unknown>): this;
  withUsage(input: number, output: number): this;
  withRequestId(id: string): this;
  asStreaming(): StreamingResponseBuilder;
  build(): MockQueryResponse;
}

export class StreamingResponseBuilder {
  private events: StreamingEvent[] = [];

  addTextChunk(text: string, delay?: number): this;
  addThinking(thinking: string, delay?: number): this;
  addToolUse(id: string, name: string, input: Record<string, unknown>, delay?: number): this;
  addUsage(input: number, output: number): this;
  addError(error: Error | string): this;
  build(): StreamingEvent[];
}
```

### 2. Implementation Details

#### 2.1 Async Generator Implementation

The core mock implements the SDK's async generator pattern:

```typescript
private createAsyncIterator(response: MockQueryResponse | StreamingEvent[]): AsyncIterable<unknown> {
  if (Array.isArray(response)) {
    // Streaming mode
    return this.createStreamingIterator(response);
  }

  // Single response mode
  return {
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: 'assistant',
        message: {
          content: response.output?.messages?.[0]?.content ?? [
            { type: 'text', text: response.content ?? 'Mock response' }
          ]
        }
      };
      if (response.usage) {
        yield { usage: response.usage };
      }
    }
  };
}

private createStreamingIterator(events: StreamingEvent[]): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        if (event.delay) {
          await new Promise(resolve => setTimeout(resolve, event.delay));
        }

        if (event.type === 'error') {
          throw event.data instanceof Error ? event.data : new Error(String(event.data));
        }

        yield event.data;
      }
    }
  };
}
```

#### 2.2 Error Simulation

Support for various error scenarios:

```typescript
export const MockErrors = {
  sessionLimit: () => new Error('Session limit reached: Context window utilization is 85%'),
  budgetExceeded: () => new Error('Task exceeded budget limit'),
  networkTimeout: () => new Error('Network timeout'),
  rateLimit: () => new Error('Rate limit exceeded'),
  invalidResponse: () => new Error('Invalid response format'),
  usageLimit: () => new Error('Usage limit reached: You have exhausted your monthly included credits'),
} as const;

// Usage
mockSDK.addError(MockErrors.sessionLimit());
```

#### 2.3 Integration with Vitest

Factory function for easy Vitest integration:

```typescript
/**
 * Create a mock module for vi.mock()
 */
export function createMockModule(mockSDK: MockClaudeAgentSDK) {
  return {
    query: mockSDK.getQueryMock(),
    // Also mock other SDK exports
    createSdkMcpServer: vi.fn(),
    tool: vi.fn(),
  };
}

/**
 * Helper to setup mock in test file
 */
export function setupMockSDK(): MockClaudeAgentSDK {
  const mockSDK = new MockClaudeAgentSDK();

  vi.mock('@anthropic-ai/claude-agent-sdk', () => createMockModule(mockSDK));

  return mockSDK;
}
```

### 3. File Structure

```
packages/orchestrator/src/__tests__/
├── mocks/
│   ├── index.ts                    # Re-exports all mocks
│   ├── claude-agent-sdk.ts         # MockClaudeAgentSDK implementation
│   ├── claude-agent-sdk.types.ts   # Type definitions
│   └── claude-agent-sdk.test.ts    # Tests for the mock itself
```

### 4. Usage Examples

#### 4.1 Simple Text Response

```typescript
import { MockClaudeAgentSDK, MockResponseBuilder } from '../mocks';

describe('MyTest', () => {
  let mockSDK: MockClaudeAgentSDK;

  beforeEach(() => {
    mockSDK = new MockClaudeAgentSDK();
    vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
      query: mockSDK.getQueryMock(),
    }));
  });

  it('should handle response', async () => {
    mockSDK.addResponse({ content: 'Hello, world!' });

    // Execute test...

    expect(mockSDK.getCallHistory()).toHaveLength(1);
  });
});
```

#### 4.2 Streaming with Thinking Content

```typescript
it('should stream thinking content', async () => {
  mockSDK.addStreamingResponse([
    {
      type: 'assistant',
      data: {
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Analyzing the problem...' },
            { type: 'text', text: 'Here is my solution.' }
          ]
        }
      }
    },
    {
      type: 'usage',
      data: { usage: { input_tokens: 100, output_tokens: 50 } }
    }
  ]);

  // Execute test...
});
```

#### 4.3 Simulating Errors

```typescript
it('should handle session limit errors', async () => {
  mockSDK.addError(MockErrors.sessionLimit());

  await expect(orchestrator.executeTask(taskId)).rejects.toThrow('Session limit');
});
```

#### 4.4 Sequential Responses

```typescript
it('should handle multi-stage workflow', async () => {
  mockSDK
    .addResponse({ content: 'Planning complete' })
    .addResponse({ content: 'Implementation complete' })
    .addResponse({ content: 'Testing complete' });

  await orchestrator.executeTask(taskId);

  expect(mockSDK.getCallHistory()).toHaveLength(3);
});
```

#### 4.5 Complex Tool Usage

```typescript
it('should simulate tool calls', async () => {
  const response = MockResponseBuilder.create()
    .withThinking('I need to read a file')
    .withToolUse('tool_123', 'Read', { file_path: '/src/index.ts' })
    .withUsage(200, 100)
    .build();

  mockSDK.addResponse(response);

  // Execute test...
});
```

### 5. Hook Type Support

The mock also supports testing hook-related functionality:

```typescript
export interface MockHookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export function createMockHookInput(toolName: string, toolInput: Record<string, unknown>): MockHookInput {
  return { tool_name: toolName, tool_input: toolInput };
}
```

### 6. Migration Strategy

For existing tests, migration can be gradual:

1. **Phase 1**: Create the mock utilities module
2. **Phase 2**: Write tests for the mock utilities themselves
3. **Phase 3**: Update new tests to use the utilities
4. **Phase 4**: Optionally migrate existing tests during refactoring

Tests using the existing `vi.mock()` pattern will continue to work unchanged.

## Acceptance Criteria Mapping

| Acceptance Criteria | Implementation |
|---------------------|----------------|
| MockClaudeAgentSDK class exists | `MockClaudeAgentSDK` class in `claude-agent-sdk.ts` |
| Supports configuring mock responses for query() calls | `addResponse()`, `addResponses()`, `setDefaultResponse()` |
| Supports simulating streaming events | `addStreamingResponse()`, `StreamingResponseBuilder` |
| Supports simulating errors/failures | `addError()`, `MockErrors` constants |
| Test file demonstrates mock SDK usage | `claude-agent-sdk.test.ts` with comprehensive examples |

## Consequences

### Positive

- **Consistency**: All tests use the same mock structure
- **Maintainability**: SDK changes only require updates in one place
- **Discoverability**: Clear API for configuring mock behavior
- **Type Safety**: Full TypeScript support for mock configuration
- **Flexibility**: Supports simple and complex test scenarios

### Negative

- **Learning Curve**: Developers need to learn the mock API
- **Initial Effort**: Time investment to create comprehensive utilities
- **Potential Overhead**: More abstraction than simple inline mocks

### Neutral

- **Existing Tests**: Continue to work without changes
- **Gradual Adoption**: No forced migration required

## References

- Existing test patterns in `packages/orchestrator/src/__tests__/`
- Claude Agent SDK types from `@anthropic-ai/claude-agent-sdk`
- Vitest mocking documentation
