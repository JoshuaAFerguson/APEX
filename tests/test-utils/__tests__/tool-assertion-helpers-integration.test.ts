/**
 * @fileoverview Integration test for tool assertion helpers
 *
 * This test verifies that the tool assertion helpers work correctly
 * with real-world testing scenarios and provide the expected functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  expectToolCalled,
  expectToolCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCallRecord,
} from '../assertions';

describe('Tool Assertion Helpers Integration', () => {
  let toolCalls: ToolCallRecord[];

  beforeEach(() => {
    toolCalls = [];
  });

  function simulateToolCall(toolName: string, parameters: Record<string, unknown>) {
    toolCalls.push({
      toolName,
      parameters,
      timestamp: new Date(),
      callIndex: toolCalls.length,
    });
  }

  it('should work together in a realistic development workflow', () => {
    // Simulate a typical development workflow

    // 1. Read configuration
    simulateToolCall('Read', { file_path: 'package.json' });

    // 2. Search for existing patterns
    simulateToolCall('Grep', {
      pattern: 'export.*function',
      glob: '**/*.ts'
    });

    // 3. Create new files
    simulateToolCall('Write', {
      file_path: 'src/new-feature.ts',
      content: 'export function newFeature() {\n  return "hello";\n}'
    });

    // 4. Edit existing files
    simulateToolCall('Edit', {
      file_path: 'src/index.ts',
      old_string: 'export {',
      new_string: 'export {\n  newFeature,'
    });

    // 5. Run tests
    simulateToolCall('Bash', {
      command: 'npm test',
      timeout: 30000
    });

    // 6. Run linting
    simulateToolCall('Bash', {
      command: 'npm run lint --fix'
    });

    // Now verify the workflow using our assertion helpers

    // Check that all expected tools were called
    expectToolCalled(toolCalls, 'Read');
    expectToolCalled(toolCalls, 'Grep');
    expectToolCalled(toolCalls, 'Write');
    expectToolCalled(toolCalls, 'Edit');
    expectToolCalled(toolCalls, 'Bash');

    // Check specific tool parameters
    expectToolCalledWith(toolCalls, 'Read', {
      file_path: 'package.json'
    });

    expectToolCalledWith(toolCalls, 'Grep', {
      pattern: 'export.*function'
    }, { partial: true });

    expectToolCalledWith(toolCalls, 'Write', {
      file_path: 'src/new-feature.ts'
    }, { partial: true });

    expectToolCalledWith(toolCalls, 'Bash', (params) => {
      return typeof params.command === 'string' && params.command.includes('npm test');
    });

    // Check workflow order
    expectToolCallOrder(toolCalls, [
      'Read',   // Read config first
      'Grep',   // Search existing code
      'Write',  // Create new files
      'Edit',   // Modify existing files
      'Bash'    // Run tools
    ]);

    // Check call counts
    expectToolCallCount(toolCalls, 'Read', 1);
    expectToolCallCount(toolCalls, 'Bash', 2);
    expectToolCallCount(toolCalls, 'Write', 1);
    expectToolCallCount(toolCalls, 'Edit', 1);
    expectToolCallCount(toolCalls, 'Grep', 1);

    // Additional validation with ranges
    expectToolCallCount(toolCalls, 'Bash', 1, { minimum: true });
    expectToolCallCount(toolCalls, 'Bash', 5, { maximum: true });
  });

  it('should provide helpful error messages for debugging', () => {
    simulateToolCall('Read', { file_path: '/wrong/path.txt' });
    simulateToolCall('Write', { file_path: '/output.txt', content: 'wrong content' });

    // Test that error messages are helpful
    expect(() => {
      expectToolCalled(toolCalls, 'NonExistentTool');
    }).toThrow(/Available tools called.*Read, Write/);

    expect(() => {
      expectToolCalledWith(toolCalls, 'Read', { file_path: '/expected/path.txt' });
    }).toThrow(/Exact match failed.*expected.*wrong/);

    expect(() => {
      expectToolCallOrder(toolCalls, ['Write', 'Read']);
    }).toThrow(/Expected tools to be called in strict order.*Write, Read.*Read, Write/);

    expect(() => {
      expectToolCallCount(toolCalls, 'Read', 5);
    }).toThrow(/exactly 5 time\(s\).*called 1 time\(s\)/);
  });

  it('should handle edge cases gracefully', () => {
    // Empty tool calls
    expect(() => {
      expectToolCallCount([], 'AnyTool', 0);
    }).not.toThrow();

    // Tool with no parameters
    simulateToolCall('SimpleTool', {});
    expectToolCalled(toolCalls, 'SimpleTool');
    expectToolCalledWith(toolCalls, 'SimpleTool', {});

    // Complex nested parameters
    simulateToolCall('ComplexTool', {
      config: {
        nested: { value: 42 },
        array: [1, 2, { key: 'value' }]
      },
      metadata: {
        timestamp: '2024-01-01T00:00:00Z',
        flags: ['debug', 'verbose']
      }
    });

    expectToolCalledWith(toolCalls, 'ComplexTool', {
      config: {
        nested: { value: 42 }
      }
    }, { partial: true });
  });

  it('should work with multiple calls to the same tool', () => {
    // Simulate reading multiple files
    simulateToolCall('Read', { file_path: 'file1.txt' });
    simulateToolCall('Read', { file_path: 'file2.txt' });
    simulateToolCall('Read', { file_path: 'file3.txt' });

    // Simulate writing multiple files
    simulateToolCall('Write', { file_path: 'output1.txt', content: 'content1' });
    simulateToolCall('Write', { file_path: 'output2.txt', content: 'content2' });

    expectToolCallCount(toolCalls, 'Read', 3);
    expectToolCallCount(toolCalls, 'Write', 2);

    // Check specific call by index
    expectToolCalledWith(toolCalls, 'Read', { file_path: 'file2.txt' }, { callIndex: 1 });

    // Check order with repeated tools
    expectToolCallOrder(toolCalls, ['Read', 'Read', 'Read', 'Write', 'Write'], {
      allowRepeats: true
    });

    // Check non-strict order
    expectToolCallOrder(toolCalls, ['Read', 'Write'], { strict: false });
  });

  it('should validate realistic code review workflow', () => {
    // Simulate a code review workflow

    // 1. Read the files to review
    simulateToolCall('Glob', { pattern: 'src/**/*.ts' });
    simulateToolCall('Read', { file_path: 'src/feature.ts' });
    simulateToolCall('Read', { file_path: 'src/feature.test.ts' });

    // 2. Search for potential issues
    simulateToolCall('Grep', {
      pattern: 'TODO|FIXME|XXX',
      glob: '**/*.ts'
    });

    // 3. Run tests to ensure functionality
    simulateToolCall('Bash', { command: 'npm test' });

    // 4. Check linting
    simulateToolCall('Bash', { command: 'npm run lint' });

    // 5. Check types
    simulateToolCall('Bash', { command: 'npm run typecheck' });

    // Verify the review workflow
    expectToolCallOrder(toolCalls, [
      'Glob',
      'Read',
      'Grep',
      'Bash'
    ], { strict: false });

    // Should read at least one file
    expectToolCallCount(toolCalls, 'Read', 1, { minimum: true });

    // Should run multiple checks
    expectToolCallCount(toolCalls, 'Bash', 2, { minimum: true });
    expectToolCallCount(toolCalls, 'Bash', 5, { maximum: true });

    // Check that test command was run
    expectToolCalledWith(toolCalls, 'Bash', (params) => {
      return params.command && params.command.includes('test');
    });

    // Check that linting was run
    expectToolCalledWith(toolCalls, 'Bash', (params) => {
      return params.command && params.command.includes('lint');
    });
  });
});