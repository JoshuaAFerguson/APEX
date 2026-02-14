# Claude Agent SDK Test Utilities

Comprehensive mocking utilities for testing APEX components that integrate with the Claude Agent SDK.

## Overview

This package provides a complete suite of testing utilities designed to make it easy to test code that uses the Claude Agent SDK. The utilities support:

- **Tool Execution Mocking**: Mock any tool and simulate its responses
- **SDK Query Mocking**: Mock the Claude Agent SDK `query()` function with realistic responses
- **Streaming Support**: Test streaming workflows with timing and progressive responses
- **Call Verification**: Track and verify tool invocations and usage patterns
- **Common Patterns**: Pre-built test scenarios for typical workflows

## Quick Start

### Basic Setup

```typescript
import { setupTestEnvironment } from '@apex/orchestrator/__tests__/mocks';

describe('My Tests', () => {
  const { helper, mockSDK, toolRegistry } = setupTestEnvironment();

  it('should test file operations', async () => {
    // Setup file system tools in one line
    helper.setupFileSystemTools();

    // Setup a realistic workflow
    helper.setupToolWorkflow([
      { toolName: 'Read', input: { file_path: 'app.ts' } },
      { toolName: 'Write', input: { file_path: 'app.ts', content: 'new content' } }
    ]);

    // Execute and verify
    const agent = helper.getAgent();
    const result = query(agent, 'Update the app file');
    // ... test execution

    helper.assertToolsExecuted([
      { toolName: 'Read', expectedCalls: 1, shouldSucceed: true },
      { toolName: 'Write', expectedCalls: 1, shouldSucceed: true }
    ]);
  });
});
```

## Core Components

### 1. TestHelper Class

The main utility class that provides high-level methods for common testing scenarios:

```typescript
const helper = createTestHelper();

// Setup common tools
helper.setupFileSystemTools();
helper.setupReadTool([
  { path: '/test.txt', content: 'file content' }
]);

// Setup workflows
helper.setupSuccessWorkflow('Task completed');
helper.setupErrorScenario(new Error('Something failed'));
helper.setupStreamingWorkflow([
  { type: 'thinking', content: 'Processing...', delay: 100 },
  { type: 'text', content: 'Done!', delay: 200 }
]);

// Assertions
helper.assertToolsExecuted([
  { toolName: 'Read', expectedCalls: 1, shouldSucceed: true }
]);
helper.assertCallSequence(['Read', 'Write']);
```

### 2. MockClaudeAgentSDK

Comprehensive mock for the Claude Agent SDK with support for:

```typescript
const mockSDK = new MockClaudeAgentSDK();

// Configure responses
mockSDK
  .addResponse({ content: 'First response' })
  .addError('Something went wrong')
  .addResponse({ content: 'Recovery successful' });

// Streaming responses
mockSDK.addStreamingResponse([
  { type: 'text', data: 'Chunk 1', delay: 100 },
  { type: 'text', data: 'Chunk 2', delay: 200 }
]);

// Verify calls
const history = mockSDK.getCallHistory();
expect(history).toHaveLength(2);
```

### 3. MockToolRegistry

Centralized tool management with execution simulation:

```typescript
const registry = new MockToolRegistry();

// Register tools
registry.registerTool('Read', 'Read files', z.object({
  file_path: z.string()
}), {
  response: { content: [{ type: 'text', text: 'file content' }] }
});

// Execute and verify
await registry.simulateExecution('Read', { file_path: '/test.txt' });
expect(registry.wasToolCalled('Read')).toBe(true);
expect(registry.getInvocationCount('Read')).toBe(1);
```

### 4. Test Patterns

Pre-built common scenarios:

```typescript
import { TestPatterns } from '@apex/orchestrator/__tests__/mocks';

// Apply complete patterns
TestPatterns.fileOperations.setup(mockSDK);
TestPatterns.errorRecovery.setup(mockSDK);
TestPatterns.streamingProgress.setup(mockSDK);
```

## Advanced Features

### Dynamic Tool Responses

Create tools that respond differently based on input:

```typescript
const readTool = createMockTool('Read')
  .withDynamicHandler((args) => {
    const filePath = args.file_path as string;
    if (filePath.endsWith('.json')) {
      return { content: [{ type: 'text', text: '{"data": "json"}' }] };
    }
    return { content: [{ type: 'text', text: 'text content' }] };
  })
  .build();
```

### Error Simulation

Test error conditions and recovery:

```typescript
const tool = createMockTool('FlakeTool')
  .withTextResponse('Success')
  .withErrorOn(3, new Error('Third call fails'))
  .withRandomFailures(0.2, new Error('Random failure'))
  .build();
```

### Timing and Performance Testing

Test streaming and timing behavior:

```typescript
helper.setupStreamingWorkflow([
  { type: 'thinking', content: 'Starting...', delay: 100 },
  { type: 'text', content: 'Progress 50%', delay: 500 },
  { type: 'text', content: 'Complete!', delay: 200 }
]);

const startTime = Date.now();
// ... execute workflow
const duration = Date.now() - startTime;
expect(duration).toBeGreaterThanOrEqual(800);
```

### Complex Workflow Verification

Verify intricate tool interaction patterns:

```typescript
verifyToolInteractionPattern(toolRegistry, {
  description: 'Development workflow',
  sequence: ['Glob', 'Read', 'Write', 'Bash', 'GitCommit'],
  expectations: [
    {
      tool: 'Read',
      input: { file_path: '/src/app.ts' },
      shouldSucceed: true
    },
    {
      tool: 'Write',
      input: (input) => input.content.includes('updated'),
      output: /Successfully wrote/
    }
  ]
});
```

## Testing Patterns

### File System Operations

```typescript
describe('File Operations', () => {
  it('should handle read/write workflow', async () => {
    const { helper } = setupTestEnvironment();

    helper.setupFileSystemTools();
    helper.setupReadTool([
      { path: '/src/app.ts', content: 'original content' }
    ]);

    // Test workflow that reads and writes files
    helper.setupToolWorkflow([
      { toolName: 'Read', input: { file_path: '/src/app.ts' } },
      { toolName: 'Write', input: { file_path: '/src/app.ts', content: 'updated' } }
    ]);

    const result = await executeWorkflow();

    helper.assertToolsExecuted([
      { toolName: 'Read', expectedCalls: 1, shouldSucceed: true },
      { toolName: 'Write', expectedCalls: 1, shouldSucceed: true }
    ]);
  });
});
```

### Error Recovery Testing

```typescript
describe('Error Handling', () => {
  it('should recover from failures', async () => {
    const helper = createTestHelper();

    helper.setupErrorScenario(new Error('Initial failure'), 1);
    // First call succeeds, second fails, then uses default success

    // Test error and recovery
    const firstResult = await executeQuery(); // Success
    await expect(executeQuery()).rejects.toThrow('Initial failure');
    const thirdResult = await executeQuery(); // Success (default)

    expect(helper.getExecutionSummary().errors).toBe(1);
  });
});
```

### Multi-Agent Workflows

```typescript
describe('Multi-Agent Collaboration', () => {
  it('should coordinate multiple agents', async () => {
    const helper = createTestHelper();

    const planner = helper.createTestAgent('planner', ['Glob', 'Read']);
    const developer = helper.createTestAgent('developer', ['Write']);
    const tester = helper.createTestAgent('tester', ['Bash']);

    // Setup sequential responses
    mockSDK
      .addResponse({ content: 'Planning complete' })
      .addResponse({ content: 'Development complete' })
      .addResponse({ content: 'Testing complete' });

    await helper.simulateWorkflow([
      { agent: planner, message: 'Plan the feature' },
      { agent: developer, message: 'Implement the feature' },
      { agent: tester, message: 'Test the feature' }
    ]);

    helper.assertSDKCallHistory({
      totalCalls: 3,
      agents: ['planner', 'developer', 'tester']
    });
  });
});
```

## Utilities Reference

### TestHelper Methods

| Method | Description |
|--------|-------------|
| `setupFileSystemTools()` | Setup Read, Write, Glob, Grep tools |
| `setupReadTool(files)` | Configure Read tool with file content |
| `setupSuccessWorkflow(msg)` | Simple success response |
| `setupToolWorkflow(steps)` | Multi-step tool workflow |
| `setupStreamingWorkflow(events)` | Streaming with delays |
| `setupErrorScenario(error, after)` | Error after N successful calls |
| `assertToolsExecuted(expectations)` | Verify tool execution patterns |
| `assertCallSequence(sequence)` | Verify call order |
| `assertSDKCallHistory(expectations)` | Verify SDK interactions |
| `getExecutionSummary()` | Get comprehensive statistics |

### MockToolRegistry Methods

| Method | Description |
|--------|-------------|
| `registerTool(name, desc, schema, config)` | Register a mock tool |
| `simulateExecution(name, input, options)` | Execute a tool |
| `getInvocations(toolName?)` | Get execution records |
| `wasToolCalled(name)` | Check if tool was called |
| `verifyCallSequence(sequence)` | Verify execution order |
| `expectToolCalls(expectations)` | Assert expectations |

### Builder Patterns

```typescript
// Response Builder
const response = MockResponseBuilder.create()
  .withThinking('Processing...')
  .withToolUse('read_1', 'Read', { file_path: '/test.txt' })
  .withText('Complete!')
  .withUsage(100, 50)
  .build();

// Tool Builder
const tool = createMockTool('CustomTool')
  .withTextResponse('Success')
  .withDelay(100)
  .withErrorOn(3, new Error('Third call fails'))
  .build();

// Streaming Builder
const streaming = new StreamingResponseBuilder()
  .addThinking('Starting...', 100)
  .addTextChunk('Progress...', 200)
  .addUsage(150, 75)
  .build();
```

## Best Practices

1. **Use setupTestEnvironment()** for consistent test setup
2. **Leverage pre-built patterns** for common scenarios
3. **Test both success and failure paths** using error scenarios
4. **Verify tool execution order** with assertCallSequence()
5. **Use streaming tests** for realistic timing verification
6. **Mock at the appropriate level** - tool level vs SDK level
7. **Clean up between tests** with helper.reset()

## Examples

See the test files for comprehensive examples:
- `test-helpers.demo.test.ts` - Simple usage examples
- `test-helpers.integration.test.ts` - Advanced integration scenarios
- `test-utilities-demo.test.ts` - Original SDK mock examples

## Integration with Existing Tests

The new utilities are fully compatible with existing mock infrastructure and can be gradually adopted in existing test suites.