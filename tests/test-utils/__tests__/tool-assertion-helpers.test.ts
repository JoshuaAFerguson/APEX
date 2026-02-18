/**
 * @fileoverview Comprehensive test suite for tool assertion helpers
 *
 * Tests all the tool assertion helpers (expectToolCalled, expectToolCalledWith,
 * expectToolCallOrder, expectToolCallCount) to ensure they work correctly
 * and provide clear error messages.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  expectToolCalled,
  expectToolCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCallRecord,
  type MockToolRegistry,
} from '../assertions';

// Mock tool registry implementation for testing
class TestMockToolRegistry implements MockToolRegistry {
  private calls: ToolCallRecord[] = [];

  addCall(toolName: string, parameters: Record<string, unknown>, options?: {
    timestamp?: Date;
    callIndex?: number;
    success?: boolean;
    result?: any;
  }): void {
    this.calls.push({
      toolName,
      parameters,
      timestamp: options?.timestamp || new Date(),
      callIndex: options?.callIndex ?? this.calls.length,
      success: options?.success ?? true,
      result: options?.result,
    });
  }

  getInvocations(toolName?: string): ToolCallRecord[] {
    if (toolName) {
      return this.calls.filter(call => call.toolName === toolName);
    }
    return this.calls;
  }

  getAllInvocations(): ToolCallRecord[] {
    return this.calls;
  }

  reset(): void {
    this.calls = [];
  }
}

describe('Tool Assertion Helpers', () => {
  let mockRegistry: TestMockToolRegistry;

  beforeEach(() => {
    mockRegistry = new TestMockToolRegistry();
  });

  describe('expectToolCalled', () => {
    it('should pass when tool was called', () => {
      mockRegistry.addCall('Read', { file_path: '/test.txt' });

      expect(() => {
        expectToolCalled(mockRegistry, 'Read');
      }).not.toThrow();
    });

    it('should fail when tool was not called', () => {
      expect(() => {
        expectToolCalled(mockRegistry, 'Read');
      }).toThrow("Expected tool 'Read' to be called at least once, but it was not called");
    });

    it('should provide helpful error message listing available tools', () => {
      mockRegistry.addCall('Write', { file_path: '/test.txt', content: 'test' });
      mockRegistry.addCall('Bash', { command: 'ls' });

      expect(() => {
        expectToolCalled(mockRegistry, 'Read');
      }).toThrow(/Available tools called: \[Write, Bash\]/);
    });

    it('should work with custom error message', () => {
      expect(() => {
        expectToolCalled(mockRegistry, 'Read', 'File should have been read');
      }).toThrow('File should have been read');
    });

    it('should work with array of tool calls', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: { file_path: '/test.txt' } }
      ];

      expect(() => {
        expectToolCalled(calls, 'Read');
      }).not.toThrow();

      expect(() => {
        expectToolCalled(calls, 'Write');
      }).toThrow();
    });
  });

  describe('expectToolCalledWith', () => {
    it('should pass with exact parameter match', () => {
      mockRegistry.addCall('Read', { file_path: '/test.txt' });

      expect(() => {
        expectToolCalledWith(mockRegistry, 'Read', { file_path: '/test.txt' });
      }).not.toThrow();
    });

    it('should fail with incorrect parameters', () => {
      mockRegistry.addCall('Read', { file_path: '/test.txt' });

      expect(() => {
        expectToolCalledWith(mockRegistry, 'Read', { file_path: '/other.txt' });
      }).toThrow(/Exact match failed/);
    });

    it('should support partial parameter matching', () => {
      mockRegistry.addCall('Write', {
        file_path: '/test.txt',
        content: 'hello world',
        encoding: 'utf8'
      });

      expect(() => {
        expectToolCalledWith(
          mockRegistry,
          'Write',
          { file_path: '/test.txt', content: 'hello world' },
          { partial: true }
        );
      }).not.toThrow();
    });

    it('should fail partial match when required parameter is missing', () => {
      mockRegistry.addCall('Write', { file_path: '/test.txt' });

      expect(() => {
        expectToolCalledWith(
          mockRegistry,
          'Write',
          { file_path: '/test.txt', content: 'hello' },
          { partial: true }
        );
      }).toThrow(/missing keys: content/);
    });

    it('should support custom validation function', () => {
      mockRegistry.addCall('Bash', { command: 'git status', timeout: 5000 });

      expect(() => {
        expectToolCalledWith(mockRegistry, 'Bash', (params) => {
          return typeof params.command === 'string' &&
                 params.command.includes('git');
        });
      }).not.toThrow();

      expect(() => {
        expectToolCalledWith(mockRegistry, 'Bash', (params) => {
          return typeof params.command === 'string' &&
                 params.command.includes('npm');
        });
      }).toThrow(/failed custom validation/);
    });

    it('should check specific call index', () => {
      mockRegistry.addCall('Read', { file_path: '/first.txt' });
      mockRegistry.addCall('Read', { file_path: '/second.txt' });

      expect(() => {
        expectToolCalledWith(
          mockRegistry,
          'Read',
          { file_path: '/second.txt' },
          { callIndex: 1 }
        );
      }).not.toThrow();

      expect(() => {
        expectToolCalledWith(
          mockRegistry,
          'Read',
          { file_path: '/second.txt' },
          { callIndex: 0 }
        );
      }).toThrow(/Exact match failed/);
    });

    it('should fail when call index is out of bounds', () => {
      mockRegistry.addCall('Read', { file_path: '/test.txt' });

      expect(() => {
        expectToolCalledWith(
          mockRegistry,
          'Read',
          { file_path: '/test.txt' },
          { callIndex: 5 }
        );
      }).toThrow(/only 1 calls were made/);
    });

    it('should handle complex nested objects', () => {
      mockRegistry.addCall('ComplexTool', {
        config: {
          nested: { value: 42 },
          array: [1, 2, 3]
        },
        flags: ['verbose', 'debug']
      });

      expect(() => {
        expectToolCalledWith(mockRegistry, 'ComplexTool', {
          config: {
            nested: { value: 42 },
            array: [1, 2, 3]
          },
          flags: ['verbose', 'debug']
        });
      }).not.toThrow();
    });
  });

  describe('expectToolCallOrder', () => {
    it('should pass with correct strict order', () => {
      mockRegistry.addCall('Read', { file_path: '/config.txt' }, { callIndex: 0 });
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'result' }, { callIndex: 1 });
      mockRegistry.addCall('Bash', { command: 'git add .' }, { callIndex: 2 });

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Read', 'Write', 'Bash']);
      }).not.toThrow();
    });

    it('should fail with incorrect order', () => {
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'result' }, { callIndex: 0 });
      mockRegistry.addCall('Read', { file_path: '/config.txt' }, { callIndex: 1 });

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Read', 'Write']);
      }).toThrow(/Expected tools to be called in strict order.*but got/);
    });

    it('should support non-strict order (subsequence)', () => {
      mockRegistry.addCall('Read', { file_path: '/config.txt' }, { callIndex: 0 });
      mockRegistry.addCall('Grep', { pattern: 'test' }, { callIndex: 1 });
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'result' }, { callIndex: 2 });
      mockRegistry.addCall('Bash', { command: 'git add .' }, { callIndex: 3 });

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Read', 'Write', 'Bash'], { strict: false });
      }).not.toThrow();
    });

    it('should fail non-strict order when subsequence not found', () => {
      mockRegistry.addCall('Read', { file_path: '/config.txt' }, { callIndex: 0 });
      mockRegistry.addCall('Bash', { command: 'git add .' }, { callIndex: 1 });

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Read', 'Write', 'Bash'], { strict: false });
      }).toThrow(/Missing:.*Write/);
    });

    it('should handle repeated tools with allowRepeats option', () => {
      mockRegistry.addCall('Read', { file_path: '/file1.txt' }, { callIndex: 0 });
      mockRegistry.addCall('Read', { file_path: '/file2.txt' }, { callIndex: 1 });
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'result' }, { callIndex: 2 });

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Read', 'Read', 'Write'], { allowRepeats: true });
      }).not.toThrow();
    });

    it('should handle empty expected order', () => {
      mockRegistry.addCall('Read', { file_path: '/test.txt' });

      expect(() => {
        expectToolCallOrder(mockRegistry, []);
      }).not.toThrow();
    });

    it('should sort by timestamp when callIndex not available', () => {
      const now = new Date();
      mockRegistry.addCall('Read', { file_path: '/test.txt' }, {
        timestamp: new Date(now.getTime() + 1000)
      });
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'result' }, {
        timestamp: new Date(now.getTime() + 2000)
      });

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Read', 'Write']);
      }).not.toThrow();
    });
  });

  describe('expectToolCallCount', () => {
    it('should pass with exact count', () => {
      mockRegistry.addCall('Read', { file_path: '/file1.txt' });
      mockRegistry.addCall('Read', { file_path: '/file2.txt' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Read', 2);
      }).not.toThrow();
    });

    it('should fail with wrong count', () => {
      mockRegistry.addCall('Read', { file_path: '/test.txt' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Read', 2);
      }).toThrow(/Expected tool 'Read' to be called exactly 2 time\(s\), but it was called 1 time\(s\)/);
    });

    it('should support minimum count check', () => {
      mockRegistry.addCall('Write', { file_path: '/file1.txt', content: 'test1' });
      mockRegistry.addCall('Write', { file_path: '/file2.txt', content: 'test2' });
      mockRegistry.addCall('Write', { file_path: '/file3.txt', content: 'test3' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Write', 2, { minimum: true });
      }).not.toThrow();
    });

    it('should fail minimum count check', () => {
      mockRegistry.addCall('Write', { file_path: '/test.txt', content: 'test' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Write', 3, { minimum: true });
      }).toThrow(/at least 3 time\(s\)/);
    });

    it('should support maximum count check', () => {
      mockRegistry.addCall('Bash', { command: 'ls' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Bash', 3, { maximum: true });
      }).not.toThrow();
    });

    it('should fail maximum count check', () => {
      mockRegistry.addCall('Bash', { command: 'ls' });
      mockRegistry.addCall('Bash', { command: 'pwd' });
      mockRegistry.addCall('Bash', { command: 'date' });
      mockRegistry.addCall('Bash', { command: 'whoami' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Bash', 2, { maximum: true });
      }).toThrow(/at most 2 time\(s\).*called 4 time\(s\)/);
    });

    it('should show call details in error message', () => {
      mockRegistry.addCall('Read', { file_path: '/file1.txt' });
      mockRegistry.addCall('Read', { file_path: '/file2.txt' });

      expect(() => {
        expectToolCallCount(mockRegistry, 'Read', 1);
      }).toThrow(/Actual calls:.*file1\.txt.*file2\.txt/s);
    });

    it('should reject both minimum and maximum options', () => {
      expect(() => {
        expectToolCallCount(mockRegistry, 'Read', 2, { minimum: true, maximum: true });
      }).toThrow(/Cannot specify both minimum and maximum options/);
    });

    it('should handle zero calls', () => {
      expect(() => {
        expectToolCallCount(mockRegistry, 'NonExistent', 0);
      }).not.toThrow();

      expect(() => {
        expectToolCallCount(mockRegistry, 'NonExistent', 1);
      }).toThrow(/called 0 time\(s\)/);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex workflow verification', () => {
      // Simulate a file processing workflow
      mockRegistry.addCall('Read', { file_path: '/input.txt' }, { callIndex: 0 });
      mockRegistry.addCall('Grep', { pattern: 'TODO', path: '/input.txt' }, { callIndex: 1 });
      mockRegistry.addCall('Write', { file_path: '/todos.txt', content: 'Found TODOs...' }, { callIndex: 2 });
      mockRegistry.addCall('Read', { file_path: '/template.txt' }, { callIndex: 3 });
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'Final output...' }, { callIndex: 4 });
      mockRegistry.addCall('Bash', { command: 'git add output.txt' }, { callIndex: 5 });

      // Verify the workflow
      expect(() => {
        // Check that all necessary tools were called
        expectToolCalled(mockRegistry, 'Read');
        expectToolCalled(mockRegistry, 'Grep');
        expectToolCalled(mockRegistry, 'Write');
        expectToolCalled(mockRegistry, 'Bash');

        // Check specific calls
        expectToolCalledWith(mockRegistry, 'Grep', { pattern: 'TODO' }, { partial: true });
        expectToolCalledWith(mockRegistry, 'Bash', (params) =>
          typeof params.command === 'string' && params.command.includes('git')
        );

        // Check order
        expectToolCallOrder(mockRegistry, ['Read', 'Grep', 'Write'], { strict: false });

        // Check counts
        expectToolCallCount(mockRegistry, 'Read', 2);
        expectToolCallCount(mockRegistry, 'Write', 2);
        expectToolCallCount(mockRegistry, 'Bash', 1, { maximum: true });
      }).not.toThrow();
    });

    it('should work with array-based tool calls', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: { file_path: '/test.txt' } },
        { toolName: 'Write', parameters: { file_path: '/output.txt', content: 'test' } },
      ];

      expect(() => {
        expectToolCalled(calls, 'Read');
        expectToolCalledWith(calls, 'Write', { content: 'test' }, { partial: true });
        expectToolCallOrder(calls, ['Read', 'Write']);
        expectToolCallCount(calls, 'Read', 1);
      }).not.toThrow();
    });

    it('should provide clear error messages for complex failures', () => {
      mockRegistry.addCall('Read', { file_path: '/wrong.txt' });
      mockRegistry.addCall('Write', { file_path: '/output.txt', content: 'wrong content' });

      // Test multiple assertion failures
      expect(() => {
        expectToolCalledWith(mockRegistry, 'Read', { file_path: '/expected.txt' });
      }).toThrow(/Exact match failed.*expected.*expected\.txt.*got.*wrong\.txt/);

      expect(() => {
        expectToolCallOrder(mockRegistry, ['Write', 'Read']);
      }).toThrow(/Expected tools to be called in strict order.*Write, Read.*but got.*Read, Write/);

      expect(() => {
        expectToolCallCount(mockRegistry, 'Bash', 1);
      }).toThrow(/Expected tool 'Bash' to be called exactly 1 time\(s\), but it was called 0 time\(s\)/);
    });
  });

  describe('Edge cases', () => {
    it('should handle tools with no parameters', () => {
      mockRegistry.addCall('SimpleTool', {});

      expect(() => {
        expectToolCalled(mockRegistry, 'SimpleTool');
        expectToolCalledWith(mockRegistry, 'SimpleTool', {});
        expectToolCallCount(mockRegistry, 'SimpleTool', 1);
      }).not.toThrow();
    });

    it('should handle undefined and null parameter values', () => {
      mockRegistry.addCall('NullTool', { value: null, undef: undefined });

      expect(() => {
        expectToolCalledWith(mockRegistry, 'NullTool', { value: null });
      }).not.toThrow();

      expect(() => {
        expectToolCalledWith(mockRegistry, 'NullTool', { value: null, undef: undefined });
      }).not.toThrow();
    });

    it('should handle very long parameter lists', () => {
      const manyParams: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        manyParams[`param${i}`] = `value${i}`;
      }

      mockRegistry.addCall('ManyParamsTool', manyParams);

      expect(() => {
        expectToolCalledWith(mockRegistry, 'ManyParamsTool', { param50: 'value50' }, { partial: true });
      }).not.toThrow();
    });

    it('should handle tools called many times', () => {
      for (let i = 0; i < 1000; i++) {
        mockRegistry.addCall('FrequentTool', { index: i });
      }

      expect(() => {
        expectToolCallCount(mockRegistry, 'FrequentTool', 1000);
        expectToolCallCount(mockRegistry, 'FrequentTool', 500, { minimum: true });
      }).not.toThrow();
    });
  });
});