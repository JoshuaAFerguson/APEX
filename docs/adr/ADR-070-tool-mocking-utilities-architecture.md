# ADR-070: Tool Mocking Utilities for Claude Agent SDK Integration - Technical Architecture

## Status
Approved

## Context

APEX orchestrates specialized AI agents through the Claude Agent SDK. Testing these integrations requires comprehensive tool mocking utilities that can:

1. Simulate tool execution without calling real implementations
2. Capture tool invocations for verification
3. Verify tool usage patterns in tests
4. Support both synchronous and asynchronous tool responses
5. Integrate seamlessly with the existing MockClaudeAgentSDK infrastructure

### Acceptance Criteria

- Test utilities exist to mock Claude Agent SDK tool calls and responses
- Helpers can simulate tool execution
- Helpers can capture tool invocations
- Helpers can verify tool usage patterns in tests

## Technical Design

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     Tool Mocking Utilities Architecture                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         MockClaudeAgentSDK                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │   │
│  │  │ Query Mocking   │  │ Tool Integration│  │ Streaming Support       │  │   │
│  │  │ - addResponse() │  │ - getToolReg()  │  │ - addStreamingEvents()  │  │   │
│  │  │ - addError()    │  │ - registerTool()│  │ - createAsyncIterator() │  │   │
│  │  │ - setDefault()  │  │ - registerTools │  │ - delay simulation      │  │   │
│  │  └────────┬────────┘  └────────┬────────┘  └─────────────────────────┘  │   │
│  │           │                    │                                         │   │
│  └───────────┼────────────────────┼─────────────────────────────────────────┘   │
│              │                    │                                             │
│              ▼                    ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                          MockToolRegistry                                  │ │
│  │                        (EventEmitter-based)                                │ │
│  │                                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐    │ │
│  │  │ Tool Storage    │  │ Execution Sim   │  │ Invocation Tracking    │    │ │
│  │  │                 │  │                 │  │                        │    │ │
│  │  │ Map<name,def>   │  │ simulateExec()  │  │ - getInvocations()     │    │ │
│  │  │ registerTool()  │  │ - delay support │  │ - getLastInvocation()  │    │ │
│  │  │ getTool()       │  │ - error inject  │  │ - getInvocationCount() │    │ │
│  │  │ hasTool()       │  │ - max invocs    │  │ - getToolStatistics()  │    │ │
│  │  └─────────────────┘  └─────────────────┘  └────────────────────────┘    │ │
│  │                                                                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐    │ │
│  │  │ Response Config │  │ Pattern Verify  │  │ Permission Checking    │    │ │
│  │  │                 │  │                 │  │                        │    │ │
│  │  │ queueResponses()│  │ wasToolCalled() │  │ setPermissionChecker() │    │ │
│  │  │ addResponses()  │  │ wasCalledWith() │  │ checkPermissions opt   │    │ │
│  │  │ responseSeq     │  │ verifyCallSeq() │  │ allow/deny simulation  │    │ │
│  │  │ dynamicHandler  │  │ verifyPatterns()│  │                        │    │ │
│  │  └─────────────────┘  │ expectToolCalls │  └────────────────────────┘    │ │
│  │                       └─────────────────┘                                  │ │
│  │                                                                            │ │
│  │  Events: tool:registered, tool:start, tool:complete, tool:error           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│              ▼                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                          MockToolBuilder                                   │ │
│  │                         (Fluent Builder API)                               │ │
│  │                                                                            │ │
│  │  new MockToolBuilder('Read')                                               │ │
│  │    .withDescription('Read file contents')                                  │ │
│  │    .withSchemaShape({ file_path: z.string() })                            │ │
│  │    .withTextResponse('file content')                                       │ │
│  │    .withDelay(100)                                                         │ │
│  │    .withErrorOn(3, new Error('Rate limit'))                                │ │
│  │    .build()                                                                │ │
│  │                                                                            │ │
│  │  Convenience Functions:                                                    │ │
│  │  - createMockTool(name) → builder                                         │ │
│  │  - createSimpleTextTool(name, text) → definition                          │ │
│  │  - createFailingTool(name, error) → definition                            │ │
│  │  - createSequenceTool(name, texts[]) → definition                         │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│              ▼                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                    Permission Revocation Simulator                         │ │
│  │                                                                            │ │
│  │  ┌────────────────────────┐  ┌─────────────────────┐                      │ │
│  │  │ InterruptibleStream    │  │ PartialResultTracker │                      │ │
│  │  │ Controller             │  │                     │                      │ │
│  │  │ - interrupted flag     │  │ - record(event)     │                      │ │
│  │  │ - interrupt(reason)    │  │ - getPartialText()  │                      │ │
│  │  │ - reset()              │  │ - getToolUseCalls() │                      │ │
│  │  └────────────────────────┘  └─────────────────────┘                      │ │
│  │                                                                            │ │
│  │  PermissionRevocationSimulator                                            │ │
│  │  - createInterruptibleStream(events, controller, tracker)                 │ │
│  │  - simulateRevocationDuringStream(config)                                 │ │
│  │  - Triggers: afterEvents, afterDelayMs, onToolUse                         │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Component Relationships

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            Component Integration Flow                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Test File                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │ import { MockClaudeAgentSDK, MockToolBuilder } from './mocks';         │    │
│   │ import { query } from '@anthropic-ai/claude-agent-sdk';                │    │
│   │                                                                        │    │
│   │ vi.mock('@anthropic-ai/claude-agent-sdk');                            │    │
│   │                                                                        │    │
│   │ const mockSDK = new MockClaudeAgentSDK();                              │    │
│   │ vi.mocked(query).mockImplementation(mockSDK.getQueryMock());          │    │
│   │                                                                        │    │
│   │ // Register mock tool                                                  │    │
│   │ const readTool = createMockTool('Read')                               │    │
│   │   .withTextResponse('file content')                                    │    │
│   │   .build();                                                            │    │
│   │ mockSDK.registerTool(readTool);                                       │    │
│   │                                                                        │    │
│   │ // Execute test                                                        │    │
│   │ const result = await query(agent, 'Read the file');                   │    │
│   │                                                                        │    │
│   │ // Verify tool usage                                                   │    │
│   │ const registry = mockSDK.getToolRegistry();                           │    │
│   │ expect(registry.wasToolCalled('Read')).toBe(true);                    │    │
│   │ expect(registry.getInvocationCount('Read')).toBe(1);                  │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│   Integration Points:                                                            │
│   ┌─────────────────────────┐     ┌─────────────────────────┐                   │
│   │ ApexOrchestrator        │────▶│ Claude Agent SDK        │                   │
│   │ - executeWorkflowStage()│     │ - query()               │                   │
│   │ - repairLoopHost()      │     │ - tool definitions      │                   │
│   │ - currentTaskTools      │     │ - hooks system          │                   │
│   └─────────────────────────┘     └─────────────────────────┘                   │
│              │                              │                                    │
│              ▼                              ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    Mock Utilities (Test Environment)                     │   │
│   │                                                                         │   │
│   │  vi.mock('@anthropic-ai/claude-agent-sdk', () => createMockModule())   │   │
│   │                                                                         │   │
│   │  MockClaudeAgentSDK                                                     │   │
│   │  ├── queryMock → async generator yielding mock responses               │   │
│   │  ├── toolMock → returns mock tool definitions                          │   │
│   │  └── toolRegistry → tracks all tool invocations                        │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3. Type System

```typescript
// Core Types (tool-mock.types.ts)

/**
 * Content block types for tool responses (matches SDK types)
 */
type MockToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string } };

/**
 * Result of a mock tool execution
 */
interface MockToolResult {
  content: MockToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Record of a tool invocation for tracking and verification
 */
interface ToolInvocationRecord {
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
interface MockToolConfig {
  response?: MockToolResult;           // Static response
  handler?: MockToolHandler;           // Dynamic handler function
  responseSequence?: MockToolResult[]; // Cycle through responses
  delay?: number;                      // Delay in ms before returning
  errorOnCall?: Array<{                // Scheduled errors
    callNumber: number;
    error: Error;
  }>;
  maxInvocations?: number;             // Maximum allowed calls
}

/**
 * Context provided to mock tool handlers
 */
interface MockToolContext {
  toolName: string;
  callId: string;
  invocationCount: number;
  timestamp: Date;
}

/**
 * Definition of a mock tool
 */
interface MockToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  config: MockToolConfig;
}
```

### 4. MockToolRegistry Implementation

```typescript
/**
 * Central registry for mock tool management
 * Extends EventEmitter for event-driven testing
 */
class MockToolRegistry extends EventEmitter {
  private tools: Map<string, MockToolDefinition>;
  private invocations: ToolInvocationRecord[];
  private invocationCounts: Map<string, number>;
  private permissionChecker?: (tool: string, input: unknown) => Promise<'allow' | 'deny'>;

  // Tool Registration
  registerTool(name, description, schema, config): MockToolDefinition;
  registerToolWithResponses(name, description, schema, responses[]): void;
  getTool(name): MockToolDefinition | undefined;
  hasTool(name): boolean;
  getRegisteredToolNames(): string[];

  // Execution Simulation
  async simulateExecution(toolName, input, options?): Promise<MockToolResult>;
  // - Validates tool exists
  // - Checks max invocations
  // - Applies delays
  // - Handles scheduled errors
  // - Emits events (tool:start, tool:complete, tool:error)

  // Response Management
  queueResponses(toolName, responses[]): void;
  addResponses(toolName, responses[]): void;

  // Invocation Capture
  getInvocations(toolName?): ToolInvocationRecord[];
  getLastInvocation(toolName): ToolInvocationRecord | undefined;
  getInvocationCount(toolName): number;
  getToolStatistics(toolName): ToolUsageStatistics;
  clearInvocations(): void;

  // Usage Pattern Verification
  wasToolCalled(toolName): boolean;
  wasCalledWith(toolName, expectedInput | predicate): boolean;
  verifyCallSequence(expectedSequence[]): ToolCallVerificationResult;
  verifyCallPatterns(patterns[]): PatternMatchResult[];
  expectToolCalls(expectations[]): void; // Throws on failure

  // Permission Testing
  setPermissionChecker(checker): void;
  clearPermissionChecker(): void;

  // Reset
  reset(): void;
}
```

### 5. MockToolBuilder Fluent API

```typescript
/**
 * Fluent builder for creating mock tool definitions
 */
class MockToolBuilder {
  constructor(name: string);

  // Configuration
  withDescription(description: string): this;
  withSchema(schema: z.ZodObject): this;
  withSchemaShape(shape: Record<string, z.ZodTypeAny>): this;

  // Response Configuration
  withResponse(response: MockToolResult): this;
  withTextResponse(text: string, isError?: boolean): this;
  withImageResponse(base64Data: string, mediaType: string): this;
  withResourceResponse(uri: string, mimeType?: string, text?: string): this;
  withMixedResponse(content: MockToolContent[], structured?: Record): this;
  withDynamicHandler(handler: MockToolHandler): this;
  withSequence(responses: MockToolResult[]): this;
  withTextSequence(texts: string[]): this;

  // Behavior Configuration
  withDelay(ms: number): this;
  withErrorOn(callNumber: number, error: Error): this;
  withErrorSchedule(schedule: Array<{callNumber, error}>): this;
  withMaxInvocations(max: number): this;
  alwaysThrow(error: Error): this;
  alwaysThrowWithMessage(message: string): this;
  withTimeout(timeoutMs: number): this;
  withRandomFailures(failureRate: number, error?: Error): this;
  withLogging(logger?: Function): this;

  // Build
  build(): MockToolDefinition;
  buildConfig(): MockToolConfig;
  clone(newName?: string): MockToolBuilder;
}

// Convenience Functions
function createMockTool(name: string): MockToolBuilder;
function createSimpleTextTool(name: string, text: string): MockToolDefinition;
function createFailingTool(name: string, error: Error): MockToolDefinition;
function createSequenceTool(name: string, texts: string[]): MockToolDefinition;
```

### 6. Usage Examples

#### Basic Tool Mocking

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockClaudeAgentSDK, createMockTool } from './mocks';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

vi.mock('@anthropic-ai/claude-agent-sdk');

describe('Tool Mocking Example', () => {
  let mockSDK: MockClaudeAgentSDK;

  beforeEach(() => {
    mockSDK = new MockClaudeAgentSDK();
    vi.mocked(query).mockImplementation(mockSDK.getQueryMock());
  });

  it('should simulate tool execution', async () => {
    // Arrange: Create and register mock tool
    const readTool = createMockTool('Read')
      .withDescription('Read file contents')
      .withSchemaShape({ file_path: z.string() })
      .withTextResponse('export const hello = "world";')
      .build();

    mockSDK.registerTool(readTool);
    mockSDK.addResponse({
      content: 'I will read the file',
      output: {
        messages: [{
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/src/index.ts' } }
          ]
        }]
      }
    });

    // Act: Execute query
    const result = query({ name: 'test', models: [], systemPrompt: '', tools: [] }, 'Read index.ts');
    for await (const _ of result) { }

    // Assert: Verify tool was called
    const registry = mockSDK.getToolRegistry();
    expect(registry.wasToolCalled('Read')).toBe(true);
    expect(registry.wasCalledWith('Read', { file_path: '/src/index.ts' })).toBe(true);
  });
});
```

#### Tool Sequence Verification

```typescript
it('should verify tool call sequence', async () => {
  // Setup multiple tools
  mockSDK.registerTools([
    createMockTool('Read').withTextResponse('content').build(),
    createMockTool('Write').withTextResponse('success').build(),
    createMockTool('Bash').withTextResponse('output').build(),
  ]);

  // Configure response with tool sequence
  mockSDK.addStreamingResponse([
    { type: 'tool_use', data: { message: { content: [
      { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a.ts' } }
    ]}}},
    { type: 'tool_use', data: { message: { content: [
      { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: '/a.ts', content: '...' } }
    ]}}},
    { type: 'tool_use', data: { message: { content: [
      { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'npm test' } }
    ]}}},
  ]);

  // Execute
  const result = query(agent, 'Update and test');
  for await (const _ of result) { }

  // Verify sequence
  const registry = mockSDK.getToolRegistry();
  const verification = registry.verifyCallSequence(['Read', 'Write', 'Bash']);
  expect(verification.passed).toBe(true);
});
```

#### Error Simulation

```typescript
it('should simulate tool errors', async () => {
  const flakeyTool = createMockTool('API')
    .withTextResponse('success')
    .withErrorOn(2, new Error('Network timeout'))
    .withErrorOn(4, new Error('Rate limit exceeded'))
    .build();

  mockSDK.registerTool(flakeyTool);

  const registry = mockSDK.getToolRegistry();

  // First call succeeds
  const result1 = await registry.simulateExecution('API', {});
  expect(result1.isError).toBeFalsy();

  // Second call fails
  await expect(registry.simulateExecution('API', {}))
    .rejects.toThrow('Network timeout');

  // Third call succeeds
  const result3 = await registry.simulateExecution('API', {});
  expect(result3.isError).toBeFalsy();

  // Fourth call fails
  await expect(registry.simulateExecution('API', {}))
    .rejects.toThrow('Rate limit exceeded');
});
```

#### Permission Testing

```typescript
it('should test permission revocation', async () => {
  const simulator = new PermissionRevocationSimulator();

  const events = new StreamingResponseBuilder()
    .addTextChunk('Starting analysis')
    .addToolUse('t1', 'Read', { file_path: '/etc/passwd' })
    .addTextChunk('Analyzing contents...')
    .addToolUse('t2', 'Write', { file_path: '/tmp/output.txt', content: '...' })
    .build();

  const { stream, tracker } = simulator.simulateRevocationDuringStream({
    events,
    revokeAfterEvents: 2,  // Revoke after Read tool
    revocationReason: 'Permission denied for sensitive file',
  });

  await expect(async () => {
    for await (const _ of stream) { }
  }).rejects.toThrow('Permission denied');

  expect(tracker.wasInterrupted).toBe(true);
  expect(tracker.eventCount).toBe(2);
  expect(tracker.getToolUseCalls()).toHaveLength(1);
  expect(tracker.getToolUseCalls()[0].name).toBe('Read');
});
```

### 7. Integration with Existing Infrastructure

#### Test Utils Integration

```typescript
// packages/orchestrator/src/test-utils/index.ts
export * from './db';

// Extended to include tool mocks via __tests__/mocks/index.ts
// which exports all mock utilities
```

#### Database Test Integration

```typescript
import { createTestDatabase, cleanupTestDatabase } from './test-utils/db';
import { MockClaudeAgentSDK, createMockTool } from './__tests__/mocks';

describe('Orchestrator Integration', () => {
  let testDb: TestDatabaseContext;
  let mockSDK: MockClaudeAgentSDK;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    mockSDK = new MockClaudeAgentSDK();
  });

  afterEach(() => {
    cleanupTestDatabase(testDb);
    mockSDK.reset();
  });

  // Integration tests using both database and tool mocking
});
```

### 8. File Structure

```
packages/orchestrator/src/
├── __tests__/
│   └── mocks/
│       ├── index.ts                      # Central exports
│       ├── claude-agent-sdk.ts           # MockClaudeAgentSDK class
│       ├── claude-agent-sdk.types.ts     # SDK mock type definitions
│       ├── claude-agent-sdk.test.ts      # Tests for SDK mock
│       ├── tool-mock-registry.ts         # MockToolRegistry class
│       ├── tool-mock-builder.ts          # MockToolBuilder class
│       ├── tool-mock.types.ts            # Tool mock type definitions
│       ├── permission-revocation.ts      # Permission simulation
│       ├── permission-revocation.types.ts
│       └── test-utilities-demo.test.ts   # Usage demonstrations
└── test-utils/
    ├── index.ts                          # Database utilities export
    └── db.ts                             # SQLite test database helpers
```

## Decision

The existing tool mocking infrastructure in `packages/orchestrator/src/__tests__/mocks/` already provides comprehensive utilities that satisfy all acceptance criteria:

1. **MockClaudeAgentSDK** - Mocks the Claude Agent SDK `query()` function with full async generator support
2. **MockToolRegistry** - Centralized tool management with execution simulation, invocation tracking, and pattern verification
3. **MockToolBuilder** - Fluent API for creating mock tool definitions
4. **PermissionRevocationSimulator** - Simulates mid-stream permission changes

### Existing Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| MockClaudeAgentSDK | ✅ Complete | `__tests__/mocks/claude-agent-sdk.ts` |
| MockToolRegistry | ✅ Complete | `__tests__/mocks/tool-mock-registry.ts` |
| MockToolBuilder | ✅ Complete | `__tests__/mocks/tool-mock-builder.ts` |
| Type Definitions | ✅ Complete | `__tests__/mocks/*.types.ts` |
| Permission Testing | ✅ Complete | `__tests__/mocks/permission-revocation.ts` |
| Test Examples | ✅ Complete | `__tests__/mocks/*.test.ts` |

## Consequences

### Positive
- Comprehensive tool mocking without external dependencies
- Fluent builder API for readable test setup
- Event-driven architecture enables flexible test assertions
- Full invocation tracking for detailed verification
- Support for streaming responses with timing simulation
- Permission revocation testing for security scenarios

### Negative
- Learning curve for new developers to understand the mock utilities
- Mock behavior must be kept in sync with SDK changes

### Mitigations
- Comprehensive test files serve as documentation
- Type definitions ensure compile-time correctness
- `test-utilities-demo.test.ts` provides practical examples

## References

- Claude Agent SDK documentation
- Vitest mocking documentation
- EventEmitter3 library
- Zod schema validation library
