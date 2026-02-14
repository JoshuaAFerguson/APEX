# Tool Mocking Utilities for Claude Agent SDK Integration

This guide provides comprehensive documentation for testing Claude Agent SDK integrations using the tool mocking utilities provided in the APEX project.

## Overview

The tool mocking utilities enable you to:

- **Mock tool calls** - Simulate tool execution without actual file/system operations
- **Capture invocations** - Track what tools were called and with what parameters
- **Verify usage patterns** - Assert that tools were called in expected ways and orders
- **Simulate errors** - Test error handling and recovery scenarios
- **Control timing** - Add delays to simulate real-world tool execution times

## Quick Start

```typescript
import {
  createMockToolManager,
  setupCommonToolMocks,
  expectToolToBeCalled
} from '@apex/test-utils';

describe('My Agent Tests', () => {
  let mockManager: MockToolManager;

  beforeEach(() => {
    mockManager = createMockToolManager();
    setupCommonToolMocks(mockManager); // Read, Write, Edit, Bash, Glob, Grep
  });

  afterEach(() => {
    mockManager.cleanup();
  });

  it('should use Read tool to get file content', async () => {
    const queryMock = mockManager.setupSDKMock();

    await queryMock({
      agentDefinition: { name: 'test-agent' },
      prompt: 'Read the config file',
      tools: { Read: {} }
    });

    expectToolToBeCalled(mockManager, 'Read');
  });
});
```

## Core Components

### MockToolManager

The central class for managing tool mocks. Provides methods to:

- Register tool mocks with custom behavior
- Track tool invocations
- Verify call patterns
- Reset state between tests

```typescript
import { MockToolManager } from '@apex/test-utils';

const manager = new MockToolManager({
  trackCalls: true,           // Track all tool calls (default: true)
  defaultResponse: { ok: true }, // Default response for unmocked tools
  throwOnUnmocked: false      // Whether to throw on unmocked tools
});
```

### Tool Mock Configurations

#### Static Response

```typescript
manager.mockTool({
  toolName: 'Read',
  result: { content: 'Hello, World!' }
});
```

#### Dynamic Implementation

```typescript
manager.mockTool({
  toolName: 'Write',
  implementation: (params) => {
    const filePath = params.file_path as string;
    return { success: true, message: `Written to ${filePath}` };
  }
});
```

#### Error Simulation

```typescript
manager.mockTool({
  toolName: 'Read',
  error: new Error('File not found')
});
```

#### Delayed Response

```typescript
manager.mockTool({
  toolName: 'SlowTool',
  result: { data: 'response' },
  delay: 1000 // 1 second delay
});
```

## Advanced Patterns

### Custom File System Mock

```typescript
import { createMockFileSystem } from '@apex/test-utils/tool-mocking-examples.test';

const mockFs = createMockFileSystem({
  '/src/index.ts': 'export default function() {}',
  '/package.json': '{ "name": "test" }'
});

mockFs.mockFileSystemTools(manager);

// Now Read/Write/Glob tools work with the mock file system
```

### Workflow Verification

```typescript
import { expectToolCallOrder } from '@apex/test-utils';

// Verify tools were called in specific order
expectToolCallOrder(manager, ['Read', 'Edit', 'Write']);
```

### Parameter Verification

```typescript
import { expectToolToBeCalledWith } from '@apex/test-utils';

// Verify tool was called with specific parameters
expectToolToBeCalledWith(manager, 'Write', {
  file_path: '/src/output.ts',
  content: 'expected content'
});
```

### Call Count Assertions

```typescript
import { expectToolCallCount } from '@apex/test-utils';

// Verify exact number of calls
expectToolCallCount(manager, 'Read', 3);
```

## Utility Functions

### Pre-configured Mocks

```typescript
import {
  setupCommonToolMocks,     // Read, Write, Edit, Bash, Glob, Grep
  createFailingToolMock,    // Tool that always throws
  createDelayedToolMock,    // Tool with artificial delay
  createCustomToolMock      // Tool with custom implementation
} from '@apex/test-utils';

// Setup all common tools
setupCommonToolMocks(manager);

// Create specific mock types
manager.mockTool(createFailingToolMock('BadTool', new Error('Always fails')));
manager.mockTool(createDelayedToolMock('SlowTool', { result: 'done' }, 500));
manager.mockTool(createCustomToolMock('CustomTool', (params) => {
  // Custom logic here
  return { processed: params };
}));
```

### Full Module Mocking

```typescript
import { mockClaudeAgentSDK, restoreClaudeAgentSDK } from '@apex/test-utils';

// Mock the entire @anthropic-ai/claude-agent-sdk module
const sdkManager = mockClaudeAgentSDK();

// Now any imports of the SDK will use mocks
const { query } = await import('@anthropic-ai/claude-agent-sdk');

// Cleanup when done
sdkManager.cleanup();
restoreClaudeAgentSDK();
```

## Testing Patterns

### Basic Tool Usage

```typescript
it('should read configuration file', async () => {
  // Setup
  manager.mockTool({
    toolName: 'Read',
    implementation: (params) => {
      if (params.file_path === '/config.json') {
        return { content: '{"debug": true}' };
      }
      throw new Error('File not found');
    }
  });

  // Execute
  const queryMock = manager.setupSDKMock();
  await queryMock({
    agentDefinition: { name: 'config-agent' },
    prompt: 'Read the configuration',
    tools: { Read: {} }
  });

  // Verify
  expectToolToBeCalled(manager, 'Read');

  const readCall = manager.getLastCallFor('Read');
  expect(readCall?.result).toEqual({ content: '{"debug": true}' });
});
```

### Error Handling

```typescript
it('should handle file read errors gracefully', async () => {
  // Setup failing tool
  manager.mockTool(createFailingToolMock('Read', new Error('Permission denied')));

  // Execute
  const queryMock = manager.setupSDKMock();
  await queryMock({
    agentDefinition: { name: 'error-agent' },
    prompt: 'Try to read protected file',
    tools: { Read: {} }
  });

  // Verify error was captured
  const readCall = manager.getLastCallFor('Read');
  expect(readCall?.error?.message).toBe('Permission denied');
});
```

### Multi-step Workflows

```typescript
it('should execute file modification workflow', async () => {
  // Setup file system
  const mockFs = createMockFileSystem({
    '/src/app.ts': 'const version = "1.0.0";'
  });
  mockFs.mockFileSystemTools(manager);

  // Execute workflow
  const queryMock = manager.setupSDKMock();
  await queryMock({
    agentDefinition: { name: 'workflow-agent' },
    prompt: 'Update version in app.ts to 1.1.0',
    tools: { Read: {}, Edit: {}, Write: {} }
  });

  // Verify workflow steps
  expectToolCallOrder(manager, ['Read', 'Edit', 'Write']);

  // Verify final file state
  const updatedContent = mockFs.getFileContent('/src/app.ts');
  expect(updatedContent).toContain('1.1.0');
});
```

### Performance Testing

```typescript
it('should complete workflow within time limit', async () => {
  // Setup tools with realistic delays
  manager.mockTools([
    createDelayedToolMock('Read', { content: 'data' }, 50),
    createDelayedToolMock('Process', { result: 'processed' }, 100),
    createDelayedToolMock('Write', { success: true }, 30)
  ]);

  const startTime = Date.now();

  const queryMock = manager.setupSDKMock();
  await queryMock({
    agentDefinition: { name: 'perf-agent' },
    prompt: 'Process data efficiently',
    tools: { Read: {}, Process: {}, Write: {} }
  });

  const totalTime = Date.now() - startTime;

  // Should complete in reasonable time (180ms + overhead)
  expect(totalTime).toBeLessThan(300);

  // Verify all tools were called
  expectToolCallCount(manager, 'Read', 1);
  expectToolCallCount(manager, 'Process', 1);
  expectToolCallCount(manager, 'Write', 1);
});
```

## Best Practices

### 1. Always Clean Up

```typescript
afterEach(() => {
  mockManager.cleanup();
  restoreClaudeAgentSDK(); // If using module mocking
});
```

### 2. Use Descriptive Mock Names

```typescript
// Good
manager.mockTool({
  toolName: 'Read',
  implementation: (params) => {
    // Clear behavior based on params
  }
});

// Better with context
const mockReadConfigFile = (content: string) => ({
  toolName: 'Read',
  implementation: (params) => {
    if (params.file_path?.includes('config')) {
      return { content };
    }
    throw new Error('File not found');
  }
});
```

### 3. Test Both Success and Failure Cases

```typescript
describe('File operations', () => {
  it('should read existing files successfully', async () => {
    // Test success case
  });

  it('should handle missing files gracefully', async () => {
    // Test error case with failing mock
  });
});
```

### 4. Verify Tool Usage Patterns

```typescript
// Don't just test that tools were called
expectToolToBeCalled(manager, 'Read');

// Verify they were called correctly
expectToolToBeCalledWith(manager, 'Read', {
  file_path: '/expected/path.ts'
});

// Verify correct workflow order
expectToolCallOrder(manager, ['Read', 'Validate', 'Write']);
```

### 5. Use Realistic Mock Data

```typescript
// Instead of simple strings
manager.mockTool({
  toolName: 'Read',
  result: { content: 'hello' }
});

// Use realistic file content
manager.mockTool({
  toolName: 'Read',
  result: {
    content: `import { Component } from 'react';

export default function App() {
  return <div>Hello, World!</div>;
}`
  }
});
```

## Integration with APEX Testing

The tool mocking utilities integrate seamlessly with APEX's testing infrastructure:

```typescript
import { createTestEnvironment } from '@apex/test-utils';

describe('APEX Integration Tests', () => {
  it('should work with APEX test environment', async () => {
    const env = await createTestEnvironment();
    const mockManager = createMockToolManager();

    // Setup mocks
    setupCommonToolMocks(mockManager);

    // Test your APEX integration
    // ...

    // Cleanup
    mockManager.cleanup();
    await env.cleanup.cleanup();
  });
});
```

## Troubleshooting

### Common Issues

1. **Tools not being called**
   - Verify the tool is registered in the query tools object
   - Check that the SDK mock is properly setup

2. **Verification failures**
   - Use `manager.getToolCalls()` to see all actual calls
   - Check tool names match exactly (case sensitive)

3. **Timing issues with delays**
   - Allow reasonable tolerance in timing assertions
   - Consider using fake timers for deterministic tests

4. **Memory leaks in tests**
   - Always call `cleanup()` in `afterEach`
   - Reset call history between tests if needed

### Debugging Tips

```typescript
// See all tool calls made
console.log('All calls:', manager.getToolCalls());

// See calls for specific tool
console.log('Read calls:', manager.getToolCallsFor('Read'));

// Check if tool was called
console.log('Was Read called?', manager.wasToolCalled('Read'));

// Get call statistics
console.log('Read call count:', manager.getToolCallCount('Read'));
```

## Examples Repository

For complete working examples, see:
- `tests/test-utils/tool-mocking-examples.test.ts` - Comprehensive examples
- `packages/orchestrator/src/__tests__/mocks/` - Advanced mock utilities
- Integration tests throughout the APEX codebase

This tool mocking system provides everything needed to thoroughly test Claude Agent SDK integrations with confidence and reliability.