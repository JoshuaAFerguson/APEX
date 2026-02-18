# Tool Assertion Helpers - Usage Examples

This document provides practical examples of how to use the tool assertion helpers for testing tool usage patterns in APEX.

## Quick Start

```typescript
import {
  expectToolCalled,
  expectToolCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCallRecord,
  type MockToolRegistry,
} from '../assertions';
```

## Basic Usage Examples

### 1. expectToolCalled - Verify a tool was called

```typescript
describe('File reading workflow', () => {
  it('should read configuration file', async () => {
    const mockRegistry = setupMockToolRegistry();

    // Execute your workflow...
    await executeWorkflow(mockRegistry);

    // Verify tools were called
    expectToolCalled(mockRegistry, 'Read');
    expectToolCalled(mockRegistry, 'Write');
  });
});
```

### 2. expectToolCalledWith - Verify parameters

```typescript
describe('File operations', () => {
  it('should write to correct file with correct content', async () => {
    const mockRegistry = setupMockToolRegistry();

    await processFile('/input.txt', mockRegistry);

    // Exact parameter match
    expectToolCalledWith(mockRegistry, 'Write', {
      file_path: '/output.txt',
      content: 'processed content'
    });

    // Partial parameter match
    expectToolCalledWith(mockRegistry, 'Read', {
      file_path: '/input.txt'
    }, { partial: true });

    // Custom validation
    expectToolCalledWith(mockRegistry, 'Bash', (params) => {
      return params.command.includes('git') && params.command.includes('add');
    });
  });
});
```

### 3. expectToolCallOrder - Verify execution sequence

```typescript
describe('Deployment workflow', () => {
  it('should follow correct deployment order', async () => {
    const mockRegistry = setupMockToolRegistry();

    await deployProject(mockRegistry);

    // Strict order (exact sequence)
    expectToolCallOrder(mockRegistry, ['Read', 'Build', 'Test', 'Deploy']);

    // Loose order (subsequence, other tools can be interspersed)
    expectToolCallOrder(mockRegistry, ['Build', 'Test', 'Deploy'], {
      strict: false
    });

    // Allow repeated tools
    expectToolCallOrder(mockRegistry, ['Read', 'Read', 'Write'], {
      allowRepeats: true
    });
  });
});
```

### 4. expectToolCallCount - Verify call frequency

```typescript
describe('Bulk processing', () => {
  it('should process all files', async () => {
    const mockRegistry = setupMockToolRegistry();

    await processMultipleFiles(['file1.txt', 'file2.txt'], mockRegistry);

    // Exact count
    expectToolCallCount(mockRegistry, 'Read', 2);

    // Minimum count
    expectToolCallCount(mockRegistry, 'Write', 1, { minimum: true });

    // Maximum count
    expectToolCallCount(mockRegistry, 'Bash', 5, { maximum: true });
  });
});
```

## Advanced Usage Patterns

### Testing Complex Workflows

```typescript
describe('Feature development workflow', () => {
  it('should execute complete development cycle', async () => {
    const mockRegistry = setupMockToolRegistry();

    await featureDevelopment('add-login-button', mockRegistry);

    // Verify all required tools were used
    expectToolCalled(mockRegistry, 'Read', 'Should read existing files');
    expectToolCalled(mockRegistry, 'Write', 'Should write new code');
    expectToolCalled(mockRegistry, 'Edit', 'Should modify existing files');
    expectToolCalled(mockRegistry, 'Bash', 'Should run tests');

    // Verify specific operations
    expectToolCalledWith(mockRegistry, 'Read', {
      file_path: '/src/components/LoginForm.tsx'
    });

    expectToolCalledWith(mockRegistry, 'Bash', (params) => {
      return params.command.includes('npm test');
    }, { message: 'Should run tests' });

    // Verify workflow order
    expectToolCallOrder(mockRegistry, [
      'Read',   // Read existing code
      'Edit',   // Modify components
      'Write',  // Write new files
      'Bash'    // Run tests
    ], { strict: false });

    // Verify reasonable call counts
    expectToolCallCount(mockRegistry, 'Read', 1, { minimum: true });
    expectToolCallCount(mockRegistry, 'Write', 10, { maximum: true });
    expectToolCallCount(mockRegistry, 'Bash', 3, { maximum: true });
  });
});
```

### Error Message Testing

```typescript
describe('Error scenarios', () => {
  it('should provide clear error messages', async () => {
    const mockRegistry = setupMockToolRegistry();

    // This will fail with a helpful error message
    try {
      expectToolCalled(mockRegistry, 'NonExistentTool');
    } catch (error) {
      expect(error.message).toContain('Available tools called:');
      expect(error.message).toContain('NonExistentTool');
    }

    // Test parameter mismatch errors
    mockRegistry.addCall('Write', { file_path: '/wrong.txt' });

    try {
      expectToolCalledWith(mockRegistry, 'Write', { file_path: '/expected.txt' });
    } catch (error) {
      expect(error.message).toContain('Exact match failed');
      expect(error.message).toContain('expected.txt');
      expect(error.message).toContain('wrong.txt');
    }
  });
});
```

### Working with Array-based Tool Calls

```typescript
describe('Array-based testing', () => {
  it('should work with direct arrays', async () => {
    const toolCalls: ToolCallRecord[] = [
      { toolName: 'Read', parameters: { file_path: '/test.txt' } },
      { toolName: 'Write', parameters: { file_path: '/output.txt', content: 'result' } },
    ];

    expectToolCalled(toolCalls, 'Read');
    expectToolCallOrder(toolCalls, ['Read', 'Write']);
    expectToolCallCount(toolCalls, 'Write', 1);
  });
});
```

## Integration with Jest/Vitest

These helpers are designed to work seamlessly with common test frameworks:

```typescript
// Jest/Vitest integration
import { describe, it, expect, beforeEach } from 'vitest';

describe('Tool usage tests', () => {
  let mockRegistry: MockToolRegistry;

  beforeEach(() => {
    mockRegistry = new MockToolRegistryImpl();
  });

  it('should use tools correctly', () => {
    // Test implementation...

    // These work with standard expect() and provide detailed error messages
    expectToolCalled(mockRegistry, 'Read');
    expectToolCalledWith(mockRegistry, 'Write', { content: 'test' });
  });
});
```

## Best Practices

1. **Use descriptive test names** that explain what tool behavior you're testing
2. **Combine multiple assertions** to verify complete workflows
3. **Use custom error messages** for business-critical tool sequences
4. **Test both success and failure paths** with different tool call patterns
5. **Leverage partial matching** when only certain parameters matter
6. **Use order verification** for workflow-dependent operations

## Common Patterns

### File Processing Pipeline
```typescript
// Read → Process → Write pattern
expectToolCallOrder(registry, ['Read', 'Write']);
expectToolCalledWith(registry, 'Read', { file_path: input });
expectToolCalledWith(registry, 'Write', { content: processedContent }, { partial: true });
```

### Git Workflow
```typescript
// File changes → Git operations pattern
expectToolCalled(registry, 'Write');
expectToolCalledWith(registry, 'Bash', (params) =>
  params.command.includes('git add')
);
expectToolCalledWith(registry, 'Bash', (params) =>
  params.command.includes('git commit')
);
```

### Search and Replace
```typescript
// Search → Edit → Verify pattern
expectToolCallOrder(registry, ['Grep', 'Edit', 'Read'], { strict: false });
expectToolCallCount(registry, 'Edit', 1, { minimum: true });
```