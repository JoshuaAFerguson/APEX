/**
 * Comprehensive tests for tool assertion helpers
 * Tests expectToolCalled, expectToolCalledWith, expectToolCallOrder, expectToolCallCount
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  expectToolCalled,
  expectToolCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCallRecord,
  type MockToolRegistry,
} from '../assertions.js';

describe('Tool Assertion Helpers', () => {
  let mockCalls: ToolCallRecord[];
  let mockRegistry: MockToolRegistry;

  beforeEach(() => {
    mockCalls = [];
    mockRegistry = {
      getInvocations: (toolName?: string) =>
        toolName ? mockCalls.filter(call => call.toolName === toolName) : mockCalls,
      getAllInvocations: () => [...mockCalls],
      reset: () => { mockCalls.length = 0; }
    };
  });

  describe('expectToolCalled', () => {
    it('should pass when tool was called at least once', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: { file_path: '/test.txt' } },
        { toolName: 'Write', parameters: { file_path: '/output.txt', content: 'test' } }
      ];

      expect(() => expectToolCalled(calls, 'Read')).not.toThrow();
      expect(() => expectToolCalled(calls, 'Write')).not.toThrow();
    });

    it('should fail when tool was not called', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: { file_path: '/test.txt' } }
      ];

      expect(() => expectToolCalled(calls, 'Write')).toThrow(
        "Expected tool 'Write' to be called at least once, but it was not called"
      );
    });

    it('should include available tools in error message', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: {} },
        { toolName: 'Bash', parameters: {} },
        { toolName: 'Read', parameters: {} } // duplicate
      ];

      expect(() => expectToolCalled(calls, 'Write')).toThrow(
        "Expected tool 'Write' to be called at least once, but it was not called. Available tools called: [Read, Bash]"
      );
    });

    it('should work with MockToolRegistry', () => {
      mockCalls.push({ toolName: 'Grep', parameters: { pattern: 'test' } });

      expect(() => expectToolCalled(mockRegistry, 'Grep')).not.toThrow();
      expect(() => expectToolCalled(mockRegistry, 'Read')).toThrow();
    });

    it('should accept custom error message', () => {
      const calls: ToolCallRecord[] = [];

      expect(() => expectToolCalled(calls, 'Read', 'File should have been read')).toThrow(
        'File should have been read. Available tools called: []'
      );
    });

    it('should handle empty tool calls array', () => {
      const calls: ToolCallRecord[] = [];

      expect(() => expectToolCalled(calls, 'Read')).toThrow(
        "Expected tool 'Read' to be called at least once, but it was not called. Available tools called: []"
      );
    });
  });

  describe('expectToolCalledWith', () => {
    describe('exact parameter matching', () => {
      it('should pass when parameters match exactly', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Read',
            parameters: { file_path: '/test.txt', limit: 100 }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', {
          file_path: '/test.txt',
          limit: 100
        })).not.toThrow();
      });

      it('should fail when parameters do not match', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Read',
            parameters: { file_path: '/test.txt', limit: 100 }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', {
          file_path: '/different.txt',
          limit: 100
        })).toThrow(/Exact match failed/);
      });

      it('should fail when parameter is missing', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Write',
            parameters: { file_path: '/test.txt' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Write', {
          file_path: '/test.txt',
          content: 'test'
        })).toThrow(/Exact match failed/);
      });

      it('should fail when extra parameters exist', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Read',
            parameters: { file_path: '/test.txt', limit: 100, offset: 0 }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', {
          file_path: '/test.txt',
          limit: 100
        })).toThrow(/Exact match failed/);
      });
    });

    describe('partial parameter matching', () => {
      it('should pass when subset of parameters match', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Bash',
            parameters: {
              command: 'git status',
              description: 'Check git status',
              timeout: 5000
            }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Bash', {
          command: 'git status'
        }, { partial: true })).not.toThrow();
      });

      it('should fail when required parameter is missing', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Bash',
            parameters: { description: 'Test command' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Bash', {
          command: 'git status'
        }, { partial: true })).toThrow(/Partial match failed.*missing keys: command/);
      });

      it('should fail when parameter value is wrong', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Write',
            parameters: { file_path: '/test.txt', content: 'wrong content' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Write', {
          content: 'expected content'
        }, { partial: true })).toThrow(/Partial match failed.*wrong values/);
      });

      it('should handle multiple missing keys and wrong values', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Read',
            parameters: { file_path: '/wrong.txt' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', {
          file_path: '/test.txt',
          limit: 100,
          offset: 0
        }, { partial: true })).toThrow(/Partial match failed/);
      });
    });

    describe('custom validation function', () => {
      it('should pass when validation function returns true', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Bash',
            parameters: { command: 'git commit -m "fix: update tests"' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Bash', (params) => {
          return typeof params.command === 'string' && params.command.includes('git');
        })).not.toThrow();
      });

      it('should fail when validation function returns false', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Bash',
            parameters: { command: 'npm test' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Bash', (params) => {
          return typeof params.command === 'string' && params.command.includes('git');
        })).toThrow(/failed custom validation/);
      });

      it('should handle validation function errors', () => {
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Read',
            parameters: { file_path: '/test.txt' }
          }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', (params) => {
          // This will throw an error
          return (params as any).nonexistent.property === 'value';
        })).toThrow(/Error comparing parameters/);
      });
    });

    describe('call index specification', () => {
      it('should check specific call index', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: { file_path: '/first.txt' } },
          { toolName: 'Read', parameters: { file_path: '/second.txt' } },
          { toolName: 'Read', parameters: { file_path: '/third.txt' } }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', {
          file_path: '/second.txt'
        }, { callIndex: 1 })).not.toThrow();

        expect(() => expectToolCalledWith(calls, 'Read', {
          file_path: '/first.txt'
        }, { callIndex: 1 })).toThrow();
      });

      it('should fail when call index is out of bounds', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: { file_path: '/test.txt' } }
        ];

        expect(() => expectToolCalledWith(calls, 'Read', {}, {
          callIndex: 5
        })).toThrow(/Expected tool 'Read' to have been called at index 5, but only 1 calls were made/);
      });
    });

    it('should work with MockToolRegistry', () => {
      mockCalls.push({
        toolName: 'Write',
        parameters: { file_path: '/test.txt', content: 'test content' }
      });

      expect(() => expectToolCalledWith(mockRegistry, 'Write', {
        file_path: '/test.txt'
      }, { partial: true })).not.toThrow();
    });

    it('should accept custom error message', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: { file_path: '/wrong.txt' } }
      ];

      expect(() => expectToolCalledWith(calls, 'Read', {
        file_path: '/test.txt'
      }, {
        message: 'Expected to read correct file'
      })).toThrow('Expected to read correct file');
    });
  });

  describe('expectToolCallOrder', () => {
    describe('strict mode (default)', () => {
      it('should pass when tools are called in exact order', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: {}, callIndex: 0 },
          { toolName: 'Edit', parameters: {}, callIndex: 1 },
          { toolName: 'Write', parameters: {}, callIndex: 2 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Edit', 'Write'])).not.toThrow();
      });

      it('should pass when expected order is a prefix of actual sequence', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: {}, callIndex: 0 },
          { toolName: 'Edit', parameters: {}, callIndex: 1 },
          { toolName: 'Write', parameters: {}, callIndex: 2 },
          { toolName: 'Bash', parameters: {}, callIndex: 3 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Edit'])).not.toThrow();
      });

      it('should fail when order is wrong', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Write', parameters: {}, callIndex: 0 },
          { toolName: 'Read', parameters: {}, callIndex: 1 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Write'])).toThrow(
          /Expected tools to be called in strict order: \[Read, Write\], but got: \[Write, Read\]/
        );
      });

      it('should handle consecutive duplicates by default', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: {}, callIndex: 0 },
          { toolName: 'Read', parameters: {}, callIndex: 1 },
          { toolName: 'Write', parameters: {}, callIndex: 2 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Write'])).not.toThrow();
      });

      it('should respect allowRepeats option', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: {}, callIndex: 0 },
          { toolName: 'Read', parameters: {}, callIndex: 1 },
          { toolName: 'Write', parameters: {}, callIndex: 2 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Read', 'Write'], {
          allowRepeats: true
        })).not.toThrow();

        expect(() => expectToolCallOrder(calls, ['Read', 'Read', 'Write'])).not.toThrow(); // duplicates removed
      });
    });

    describe('non-strict mode', () => {
      it('should pass when tools appear in order with others interspersed', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Bash', parameters: {}, callIndex: 0 },
          { toolName: 'Read', parameters: {}, callIndex: 1 },
          { toolName: 'Grep', parameters: {}, callIndex: 2 },
          { toolName: 'Edit', parameters: {}, callIndex: 3 },
          { toolName: 'Write', parameters: {}, callIndex: 4 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Edit', 'Write'], {
          strict: false
        })).not.toThrow();
      });

      it('should fail when expected tool is missing from sequence', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: {}, callIndex: 0 },
          { toolName: 'Write', parameters: {}, callIndex: 1 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Edit', 'Write'], {
          strict: false
        })).toThrow(/Expected tool call order.*Missing: \[Edit\]/);
      });

      it('should fail when tools appear in wrong order', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Write', parameters: {}, callIndex: 0 },
          { toolName: 'Read', parameters: {}, callIndex: 1 }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Write'], {
          strict: false
        })).toThrow(/Expected tool call order.*Missing: \[Write\]/);
      });
    });

    describe('timestamp-based ordering', () => {
      it('should sort by timestamp when callIndex is not available', () => {
        const now = new Date();
        const calls: ToolCallRecord[] = [
          {
            toolName: 'Write',
            parameters: {},
            timestamp: new Date(now.getTime() + 1000)
          },
          {
            toolName: 'Read',
            parameters: {},
            timestamp: now
          }
        ];

        expect(() => expectToolCallOrder(calls, ['Read', 'Write'])).not.toThrow();
      });
    });

    it('should work with MockToolRegistry', () => {
      mockCalls.push(
        { toolName: 'Read', parameters: {}, callIndex: 0 },
        { toolName: 'Write', parameters: {}, callIndex: 1 }
      );

      expect(() => expectToolCallOrder(mockRegistry, ['Read', 'Write'])).not.toThrow();
    });

    it('should accept custom error message', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Write', parameters: {}, callIndex: 0 },
        { toolName: 'Read', parameters: {}, callIndex: 1 }
      ];

      expect(() => expectToolCallOrder(calls, ['Read', 'Write'], {
        message: 'File operations should happen in correct sequence'
      })).toThrow('File operations should happen in correct sequence');
    });

    it('should handle empty expected order', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: {}, callIndex: 0 }
      ];

      expect(() => expectToolCallOrder(calls, [])).not.toThrow();
    });
  });

  describe('expectToolCallCount', () => {
    describe('exact count', () => {
      it('should pass when call count matches exactly', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: { file_path: '/test1.txt' } },
          { toolName: 'Read', parameters: { file_path: '/test2.txt' } },
          { toolName: 'Write', parameters: { file_path: '/output.txt' } }
        ];

        expect(() => expectToolCallCount(calls, 'Read', 2)).not.toThrow();
        expect(() => expectToolCallCount(calls, 'Write', 1)).not.toThrow();
      });

      it('should fail when count is too low', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: { file_path: '/test.txt' } }
        ];

        expect(() => expectToolCallCount(calls, 'Read', 2)).toThrow(
          "Expected tool 'Read' to be called exactly 2 time(s), but it was called 1 time(s)"
        );
      });

      it('should fail when count is too high', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: { file_path: '/test1.txt' } },
          { toolName: 'Read', parameters: { file_path: '/test2.txt' } },
          { toolName: 'Read', parameters: { file_path: '/test3.txt' } }
        ];

        expect(() => expectToolCallCount(calls, 'Read', 2)).toThrow(
          "Expected tool 'Read' to be called exactly 2 time(s), but it was called 3 time(s)"
        );
      });

      it('should fail when tool was not called at all', () => {
        const calls: ToolCallRecord[] = [];

        expect(() => expectToolCallCount(calls, 'Read', 1)).toThrow(
          "Expected tool 'Read' to be called exactly 1 time(s), but it was called 0 time(s)"
        );
      });
    });

    describe('minimum count', () => {
      it('should pass when count is at least minimum', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Grep', parameters: { pattern: 'test1' } },
          { toolName: 'Grep', parameters: { pattern: 'test2' } },
          { toolName: 'Grep', parameters: { pattern: 'test3' } }
        ];

        expect(() => expectToolCallCount(calls, 'Grep', 2, { minimum: true })).not.toThrow();
        expect(() => expectToolCallCount(calls, 'Grep', 3, { minimum: true })).not.toThrow();
      });

      it('should fail when count is below minimum', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Write', parameters: { file_path: '/test.txt' } }
        ];

        expect(() => expectToolCallCount(calls, 'Write', 3, { minimum: true })).toThrow(
          "Expected tool 'Write' to be called at least 3 time(s), but it was called 1 time(s)"
        );
      });
    });

    describe('maximum count', () => {
      it('should pass when count is at most maximum', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Bash', parameters: { command: 'git status' } },
          { toolName: 'Bash', parameters: { command: 'git add .' } }
        ];

        expect(() => expectToolCallCount(calls, 'Bash', 3, { maximum: true })).not.toThrow();
        expect(() => expectToolCallCount(calls, 'Bash', 2, { maximum: true })).not.toThrow();
      });

      it('should fail when count exceeds maximum', () => {
        const calls: ToolCallRecord[] = [
          { toolName: 'Read', parameters: { file_path: '/test1.txt' } },
          { toolName: 'Read', parameters: { file_path: '/test2.txt' } },
          { toolName: 'Read', parameters: { file_path: '/test3.txt' } }
        ];

        expect(() => expectToolCallCount(calls, 'Read', 2, { maximum: true })).toThrow(
          "Expected tool 'Read' to be called at most 2 time(s), but it was called 3 time(s)"
        );
      });
    });

    it('should include call details in error message', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Write', parameters: { file_path: '/test1.txt', content: 'content1' } },
        { toolName: 'Write', parameters: { file_path: '/test2.txt', content: 'content2' } }
      ];

      expect(() => expectToolCallCount(calls, 'Write', 1)).toThrow(
        /Expected tool 'Write' to be called exactly 1 time\(s\), but it was called 2 time\(s\).*Actual calls:.*file_path.*test1\.txt.*file_path.*test2\.txt/s
      );
    });

    it('should work with MockToolRegistry', () => {
      mockCalls.push(
        { toolName: 'Edit', parameters: { file_path: '/test.txt' } },
        { toolName: 'Edit', parameters: { file_path: '/test.txt' } }
      );

      expect(() => expectToolCallCount(mockRegistry, 'Edit', 2)).not.toThrow();
    });

    it('should accept custom error message', () => {
      const calls: ToolCallRecord[] = [];

      expect(() => expectToolCallCount(calls, 'Read', 1, {
        message: 'Configuration file should be read'
      })).toThrow('Configuration file should be read');
    });

    it('should reject conflicting options', () => {
      const calls: ToolCallRecord[] = [];

      expect(() => expectToolCallCount(calls, 'Read', 1, {
        minimum: true,
        maximum: true
      })).toThrow('Cannot specify both minimum and maximum options');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle tools with special characters in names', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'custom-tool', parameters: {} },
        { toolName: 'namespace:tool', parameters: {} }
      ];

      expect(() => expectToolCalled(calls, 'custom-tool')).not.toThrow();
      expect(() => expectToolCalled(calls, 'namespace:tool')).not.toThrow();
    });

    it('should handle empty parameters', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'SimpleCommand', parameters: {} }
      ];

      expect(() => expectToolCalledWith(calls, 'SimpleCommand', {})).not.toThrow();
    });

    it('should handle complex nested parameters', () => {
      const calls: ToolCallRecord[] = [
        {
          toolName: 'ComplexTool',
          parameters: {
            config: {
              nested: {
                value: 'test',
                array: [1, 2, 3]
              }
            },
            options: ['a', 'b']
          }
        }
      ];

      expect(() => expectToolCalledWith(calls, 'ComplexTool', {
        config: {
          nested: {
            value: 'test',
            array: [1, 2, 3]
          }
        }
      }, { partial: true })).not.toThrow();
    });

    it('should handle null and undefined parameter values', () => {
      const calls: ToolCallRecord[] = [
        {
          toolName: 'SpecialValues',
          parameters: {
            nullValue: null,
            undefinedValue: undefined,
            falseValue: false,
            zeroValue: 0,
            emptyString: ''
          }
        }
      ];

      expect(() => expectToolCalledWith(calls, 'SpecialValues', {
        nullValue: null,
        falseValue: false,
        zeroValue: 0,
        emptyString: ''
      }, { partial: true })).not.toThrow();
    });

    it('should handle very large call lists efficiently', () => {
      const calls: ToolCallRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        toolName: i % 2 === 0 ? 'EvenTool' : 'OddTool',
        parameters: { index: i }
      }));

      // This should complete without timeout
      expect(() => expectToolCallCount(calls, 'EvenTool', 500)).not.toThrow();
      expect(() => expectToolCallCount(calls, 'OddTool', 500)).not.toThrow();
    });

    it('should handle circular references in parameters gracefully', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const calls: ToolCallRecord[] = [
        { toolName: 'CircularTool', parameters: { circular: circularObj } }
      ];

      // This should not crash, even with circular references
      expect(() => expectToolCalledWith(calls, 'CircularTool', (params) => {
        return params.circular && typeof params.circular === 'object';
      })).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should work together to test a complete workflow', () => {
      const workflowCalls: ToolCallRecord[] = [
        { toolName: 'Read', parameters: { file_path: '/config.json' }, callIndex: 0 },
        { toolName: 'Read', parameters: { file_path: '/input.txt' }, callIndex: 1 },
        { toolName: 'Grep', parameters: { pattern: 'error', file: '/input.txt' }, callIndex: 2 },
        { toolName: 'Edit', parameters: { file_path: '/input.txt', old_string: 'old', new_string: 'new' }, callIndex: 3 },
        { toolName: 'Write', parameters: { file_path: '/output.txt', content: 'processed data' }, callIndex: 4 },
        { toolName: 'Bash', parameters: { command: 'git add .' }, callIndex: 5 },
        { toolName: 'Bash', parameters: { command: 'git commit -m "process data"' }, callIndex: 6 }
      ];

      // Test that all expected tools were called
      expect(() => expectToolCalled(workflowCalls, 'Read')).not.toThrow();
      expect(() => expectToolCalled(workflowCalls, 'Edit')).not.toThrow();
      expect(() => expectToolCalled(workflowCalls, 'Write')).not.toThrow();

      // Test call counts
      expect(() => expectToolCallCount(workflowCalls, 'Read', 2)).not.toThrow();
      expect(() => expectToolCallCount(workflowCalls, 'Bash', 2)).not.toThrow();
      expect(() => expectToolCallCount(workflowCalls, 'Grep', 1)).not.toThrow();

      // Test call order
      expect(() => expectToolCallOrder(workflowCalls, ['Read', 'Grep', 'Edit', 'Write', 'Bash'])).not.toThrow();

      // Test specific parameters
      expect(() => expectToolCalledWith(workflowCalls, 'Read', {
        file_path: '/config.json'
      }, { callIndex: 0 })).not.toThrow();

      expect(() => expectToolCalledWith(workflowCalls, 'Bash', (params) => {
        return typeof params.command === 'string' && params.command.includes('git');
      })).not.toThrow();

      // Test partial matching
      expect(() => expectToolCalledWith(workflowCalls, 'Edit', {
        file_path: '/input.txt'
      }, { partial: true })).not.toThrow();
    });

    it('should provide clear error messages for complex failures', () => {
      const calls: ToolCallRecord[] = [
        { toolName: 'Write', parameters: { file_path: '/wrong.txt' } }
      ];

      // Multiple assertion failures should provide comprehensive error information
      let errorMessage = '';
      try {
        expectToolCallOrder(calls, ['Read', 'Write']);
      } catch (error) {
        errorMessage = (error as Error).message;
      }

      expect(errorMessage).toContain('strict order');
      expect(errorMessage).toContain('[Read, Write]');
      expect(errorMessage).toContain('[Write]');
    });
  });

  describe('MockToolRegistry integration', () => {
    it('should properly track and query tool invocations', () => {
      // Simulate a series of tool calls
      mockCalls.push(
        { toolName: 'Read', parameters: { file_path: '/a.txt' }, timestamp: new Date() },
        { toolName: 'Grep', parameters: { pattern: 'test' }, timestamp: new Date() },
        { toolName: 'Read', parameters: { file_path: '/b.txt' }, timestamp: new Date() },
        { toolName: 'Write', parameters: { file_path: '/c.txt' }, timestamp: new Date() }
      );

      // Test registry methods
      expect(mockRegistry.getAllInvocations()).toHaveLength(4);
      expect(mockRegistry.getInvocations('Read')).toHaveLength(2);
      expect(mockRegistry.getInvocations('Grep')).toHaveLength(1);
      expect(mockRegistry.getInvocations('NonExistent')).toHaveLength(0);

      // Test assertions work with registry
      expect(() => expectToolCalled(mockRegistry, 'Read')).not.toThrow();
      expect(() => expectToolCallCount(mockRegistry, 'Read', 2)).not.toThrow();

      // Test reset functionality
      mockRegistry.reset();
      expect(mockRegistry.getAllInvocations()).toHaveLength(0);
      expect(() => expectToolCalled(mockRegistry, 'Read')).toThrow();
    });
  });
});