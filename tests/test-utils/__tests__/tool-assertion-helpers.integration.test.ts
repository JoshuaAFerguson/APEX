/**
 * Integration tests for Tool Assertion Helpers
 *
 * This test suite demonstrates comprehensive usage patterns for the tool assertion
 * helpers, showing how they work together to provide robust testing of tool usage
 * in APEX applications.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  expectToolCalled,
  expectToolCalledWith,
  expectToolCallOrder,
  expectToolCallCount,
  type ToolCallRecord,
  type MockToolRegistry,
} from '../assertions';
import { MockToolsExecutor } from '../../../packages/core/src/test-utils/mock-tools-executor';
import { ToolInvocationRecorder } from '../../../packages/orchestrator/src/tool-invocation-recorder';
import type { ToolInvocation } from '@apexcli/core';

describe('Tool Assertion Helpers Integration Tests', () => {
  let mockRegistry: MockToolRegistry;
  let toolCalls: ToolCallRecord[];
  let executor: MockToolsExecutor;
  let recorder: ToolInvocationRecorder;

  beforeEach(() => {
    // Initialize mock tools executor
    executor = new MockToolsExecutor();
    recorder = new ToolInvocationRecorder();

    // Reset tool calls array
    toolCalls = [];

    // Create mock registry interface
    mockRegistry = {
      getInvocations: (toolName?: string) => {
        return toolName
          ? toolCalls.filter(call => call.toolName === toolName)
          : toolCalls;
      },
      getAllInvocations: () => [...toolCalls],
      reset: () => { toolCalls = []; }
    };
  });

  afterEach(() => {
    executor.reset();
    recorder.clear();
    toolCalls = [];
  });

  describe('Basic Tool Call Tracking and Assertions', () => {
    it('should track and assert tool calls from MockToolsExecutor', async () => {
      // Register default tools
      executor.registerTools([
        {
          name: 'Read',
          description: 'Read file contents',
          category: 'filesystem',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string' }
            },
            required: ['file_path']
          },
          execute: async (params) => {
            // Simulate tool call recording
            toolCalls.push({
              toolName: 'Read',
              parameters: params,
              timestamp: new Date(),
              success: true,
              result: { content: 'file content' }
            });
            return { success: true, content: [{ type: 'text', text: 'file content' }] };
          }
        },
        {
          name: 'Write',
          description: 'Write file contents',
          category: 'filesystem',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['file_path', 'content']
          },
          execute: async (params) => {
            // Simulate tool call recording
            toolCalls.push({
              toolName: 'Write',
              parameters: params,
              timestamp: new Date(),
              success: true,
              result: { success: true }
            });
            return { success: true, content: [{ type: 'text', text: 'file written' }] };
          }
        }
      ]);

      // Execute tools
      await executor.executeTool('Read', { file_path: '/test.txt' });
      await executor.executeTool('Write', { file_path: '/output.txt', content: 'test content' });

      // Test basic assertions
      expectToolCalled(toolCalls, 'Read');
      expectToolCalled(toolCalls, 'Write');

      // Test parameter assertions
      expectToolCalledWith(toolCalls, 'Read', { file_path: '/test.txt' });
      expectToolCalledWith(toolCalls, 'Write', {
        file_path: '/output.txt',
        content: 'test content'
      });

      // Test call counts
      expectToolCallCount(toolCalls, 'Read', 1);
      expectToolCallCount(toolCalls, 'Write', 1);

      // Test call order
      expectToolCallOrder(toolCalls, ['Read', 'Write']);
    });

    it('should work with ToolInvocationRecorder', () => {
      // Record tool invocations
      const invocations = [
        {
          id: 'inv-1',
          requestId: 'req-1',
          toolName: 'Glob',
          parameters: { pattern: '**/*.ts' },
          context: {
            taskId: 'task-1',
            agentName: 'developer',
            stageName: 'planning'
          }
        },
        {
          id: 'inv-2',
          requestId: 'req-2',
          toolName: 'Read',
          parameters: { file_path: '/src/index.ts' },
          context: {
            taskId: 'task-1',
            agentName: 'developer',
            stageName: 'implementation'
          }
        },
        {
          id: 'inv-3',
          requestId: 'req-3',
          toolName: 'Edit',
          parameters: {
            file_path: '/src/index.ts',
            old_string: 'old code',
            new_string: 'new code'
          },
          context: {
            taskId: 'task-1',
            agentName: 'developer',
            stageName: 'implementation'
          }
        }
      ];

      invocations.forEach((inv, index) => {
        recorder.recordInvocation(inv as ToolInvocation);

        // Convert to ToolCallRecord format for assertions
        toolCalls.push({
          toolName: inv.toolName,
          parameters: inv.parameters,
          callIndex: index,
          timestamp: new Date(),
          success: true
        });
      });

      // Test assertions with recorded data
      expectToolCalled(toolCalls, 'Glob');
      expectToolCalled(toolCalls, 'Read');
      expectToolCalled(toolCalls, 'Edit');

      expectToolCalledWith(toolCalls, 'Glob', { pattern: '**/*.ts' });
      expectToolCalledWith(toolCalls, 'Edit', { file_path: '/src/index.ts' }, { partial: true });

      expectToolCallOrder(toolCalls, ['Glob', 'Read', 'Edit']);
      expectToolCallCount(toolCalls, 'Read', 1);
    });
  });

  describe('Complex Workflow Assertions', () => {
    it('should assert multi-stage development workflow', async () => {
      // Simulate a complete development workflow
      const workflow = [
        // Planning stage
        { tool: 'Glob', params: { pattern: 'src/**/*.ts' } },
        { tool: 'Read', params: { file_path: 'src/config.ts' } },
        { tool: 'Grep', params: { pattern: 'export.*interface', type: 'ts' } },

        // Implementation stage
        { tool: 'Read', params: { file_path: 'src/feature.ts' } },
        { tool: 'Write', params: { file_path: 'src/new-feature.ts', content: 'implementation' } },
        { tool: 'Edit', params: { file_path: 'src/feature.ts', old_string: 'old', new_string: 'new' } },

        // Testing stage
        { tool: 'Write', params: { file_path: 'tests/feature.test.ts', content: 'tests' } },
        { tool: 'Bash', params: { command: 'npm test' } },

        // Documentation stage
        { tool: 'Read', params: { file_path: 'README.md' } },
        { tool: 'Edit', params: { file_path: 'README.md', old_string: 'old docs', new_string: 'updated docs' } }
      ];

      // Execute workflow steps and record calls
      for (const [index, step] of workflow.entries()) {
        toolCalls.push({
          toolName: step.tool,
          parameters: step.params,
          callIndex: index,
          timestamp: new Date(Date.now() + index * 1000),
          success: true,
          result: { success: true }
        });
      }

      // Assert workflow completion
      const expectedTools = ['Glob', 'Read', 'Grep', 'Write', 'Edit', 'Bash'];
      for (const toolName of expectedTools) {
        expectToolCalled(toolCalls, toolName);
      }

      // Assert specific tool usage counts
      expectToolCallCount(toolCalls, 'Read', 3); // config.ts, feature.ts, README.md
      expectToolCallCount(toolCalls, 'Write', 2); // new-feature.ts, test file
      expectToolCallCount(toolCalls, 'Edit', 2); // feature.ts, README.md

      // Assert workflow order (key tools should appear in sequence)
      expectToolCallOrder(toolCalls, ['Glob', 'Read', 'Write'], { strict: false });

      // Assert stage-specific patterns
      const planningTools = toolCalls.slice(0, 3);
      expectToolCallOrder(planningTools, ['Glob', 'Read', 'Grep']);

      // Assert file-specific operations
      expectToolCalledWith(toolCalls, 'Read', { file_path: 'src/config.ts' });
      expectToolCalledWith(toolCalls, 'Edit', { file_path: 'src/feature.ts' }, { partial: true });
      expectToolCalledWith(toolCalls, 'Bash', { command: 'npm test' });
    });

    it('should handle error scenarios and retries', () => {
      // Simulate error scenarios with retries
      const errorScenario = [
        // First attempt fails
        { tool: 'Read', params: { file_path: '/non-existent.txt' }, success: false },

        // Debugging attempts
        { tool: 'Glob', params: { pattern: '**/non-existent*' }, success: true },
        { tool: 'Bash', params: { command: 'ls -la' }, success: true },

        // Retry with correct path
        { tool: 'Read', params: { file_path: '/existing-file.txt' }, success: true },

        // Another failure
        { tool: 'Write', params: { file_path: '/read-only/file.txt', content: 'test' }, success: false },

        // Fix permissions and retry
        { tool: 'Bash', params: { command: 'chmod +w /read-only/' }, success: true },
        { tool: 'Write', params: { file_path: '/read-only/file.txt', content: 'test' }, success: true }
      ];

      errorScenario.forEach((step, index) => {
        toolCalls.push({
          toolName: step.tool,
          parameters: step.params,
          callIndex: index,
          timestamp: new Date(Date.now() + index * 1000),
          success: step.success,
          result: step.success ? { success: true } : { error: 'Operation failed' }
        });
      });

      // Assert all tools were attempted
      expectToolCalled(toolCalls, 'Read');
      expectToolCalled(toolCalls, 'Write');
      expectToolCalled(toolCalls, 'Bash');
      expectToolCalled(toolCalls, 'Glob');

      // Assert retry patterns
      expectToolCallCount(toolCalls, 'Read', 2); // Failed attempt + successful retry
      expectToolCallCount(toolCalls, 'Write', 2); // Failed attempt + successful retry

      // Assert debugging steps were taken
      expectToolCalledWith(toolCalls, 'Glob', { pattern: '**/non-existent*' });
      expectToolCalledWith(toolCalls, 'Bash', { command: 'ls -la' });
      expectToolCalledWith(toolCalls, 'Bash', { command: 'chmod +w /read-only/' });

      // Assert error recovery order
      const readOperations = toolCalls.filter(call => call.toolName === 'Read');
      expect(readOperations).toHaveLength(2);
      expect(readOperations[0].success).toBe(false);
      expect(readOperations[1].success).toBe(true);
    });

    it('should handle complex parameter validation scenarios', () => {
      // Setup complex tool calls with various parameter patterns
      const complexCalls = [
        {
          tool: 'ComplexTool',
          params: {
            config: {
              mode: 'production',
              features: ['feature1', 'feature2'],
              settings: { debug: false, verbose: true }
            },
            options: { timeout: 5000, retries: 3 }
          }
        },
        {
          tool: 'VariableTool',
          params: {
            action: 'process',
            targets: ['/file1.txt', '/file2.txt'],
            filters: { extension: '.txt', minSize: 1024 }
          }
        },
        {
          tool: 'ConditionalTool',
          params: {
            condition: 'if-modified-since',
            timestamp: '2024-01-01T00:00:00Z',
            fallback: 'create-new'
          }
        }
      ];

      complexCalls.forEach((call, index) => {
        toolCalls.push({
          toolName: call.tool,
          parameters: call.params,
          callIndex: index,
          timestamp: new Date(),
          success: true,
          result: { success: true }
        });
      });

      // Test partial parameter matching
      expectToolCalledWith(toolCalls, 'ComplexTool', {
        config: { mode: 'production' }
      }, { partial: true });

      expectToolCalledWith(toolCalls, 'VariableTool', {
        action: 'process',
        targets: ['/file1.txt', '/file2.txt']
      }, { partial: true });

      // Test custom validation function
      expectToolCalledWith(toolCalls, 'ConditionalTool', (params) => {
        return params.condition === 'if-modified-since' &&
               typeof params.timestamp === 'string' &&
               params.fallback === 'create-new';
      });

      // Test specific property existence
      expectToolCalledWith(toolCalls, 'ComplexTool', {
        options: { timeout: 5000 }
      }, { partial: true });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large numbers of tool calls efficiently', () => {
      const startTime = performance.now();

      // Generate large number of tool calls
      const toolTypes = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
      const largeBatch = 1000;

      for (let i = 0; i < largeBatch; i++) {
        const toolName = toolTypes[i % toolTypes.length];
        toolCalls.push({
          toolName,
          parameters: {
            file_path: `/file-${i}.txt`,
            index: i,
            batch: 'large-batch-test'
          },
          callIndex: i,
          timestamp: new Date(Date.now() + i),
          success: true,
          result: { success: true }
        });
      }

      const setupTime = performance.now() - startTime;

      // Test assertion performance
      const assertionStartTime = performance.now();

      // Basic assertions should be fast
      expectToolCalled(toolCalls, 'Read');
      expectToolCalled(toolCalls, 'Write');

      // Count assertions should handle large datasets
      expectToolCallCount(toolCalls, 'Read', Math.ceil(largeBatch / toolTypes.length));
      expectToolCallCount(toolCalls, 'Write', Math.ceil(largeBatch / toolTypes.length));

      // Parameter assertions should work with large datasets
      expectToolCalledWith(toolCalls, 'Read', { batch: 'large-batch-test' }, { partial: true });

      const assertionTime = performance.now() - assertionStartTime;

      // Verify performance is reasonable
      expect(setupTime).toBeLessThan(1000); // Setup should be under 1s
      expect(assertionTime).toBeLessThan(500); // Assertions should be under 0.5s

      // Verify all data is correctly processed
      expect(toolCalls).toHaveLength(largeBatch);

      const readCalls = toolCalls.filter(call => call.toolName === 'Read');
      expect(readCalls.length).toBeGreaterThan(100);
    });

    it('should handle complex ordering scenarios', () => {
      // Create interleaved tool calls that form complex patterns
      const patterns = [
        // Pattern 1: File processing cycle
        ['Read', 'Edit', 'Write'],
        // Pattern 2: Test cycle
        ['Write', 'Bash', 'Read'],
        // Pattern 3: Documentation cycle
        ['Glob', 'Read', 'Edit', 'Write']
      ];

      let callIndex = 0;
      patterns.forEach((pattern, patternIndex) => {
        pattern.forEach(toolName => {
          toolCalls.push({
            toolName,
            parameters: {
              pattern: patternIndex,
              file_path: `/pattern-${patternIndex}-file.txt`
            },
            callIndex: callIndex++,
            timestamp: new Date(Date.now() + callIndex * 100),
            success: true
          });
        });
      });

      // Test strict ordering within patterns
      expectToolCallOrder(toolCalls, ['Read', 'Edit', 'Write'], { strict: false });
      expectToolCallOrder(toolCalls, ['Write', 'Bash', 'Read'], { strict: false });
      expectToolCallOrder(toolCalls, ['Glob', 'Read', 'Edit', 'Write'], { strict: false });

      // Test overall workflow order
      const expectedOverallOrder = patterns.flat();
      expectToolCallOrder(toolCalls, expectedOverallOrder);

      // Test pattern-specific queries
      const pattern0Calls = toolCalls.filter(call =>
        call.parameters.pattern === 0
      );
      expectToolCallOrder(pattern0Calls, ['Read', 'Edit', 'Write']);

      const pattern1Calls = toolCalls.filter(call =>
        call.parameters.pattern === 1
      );
      expectToolCallOrder(pattern1Calls, ['Write', 'Bash', 'Read']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should provide clear error messages for assertion failures', () => {
      // Setup minimal tool calls
      toolCalls = [
        {
          toolName: 'Read',
          parameters: { file_path: '/test.txt' },
          timestamp: new Date(),
          success: true
        }
      ];

      // Test clear error for missing tool
      expect(() => {
        expectToolCalled(toolCalls, 'NonExistentTool');
      }).toThrow(/Expected tool 'NonExistentTool' to be called at least once/);

      // Test clear error for wrong parameters
      expect(() => {
        expectToolCalledWith(toolCalls, 'Read', { file_path: '/wrong.txt' });
      }).toThrow(/Expected tool 'Read' to be called with matching parameters/);

      // Test clear error for wrong count
      expect(() => {
        expectToolCallCount(toolCalls, 'Read', 5);
      }).toThrow(/Expected tool 'Read' to be called exactly 5 time\(s\), but it was called 1 time\(s\)/);

      // Test clear error for wrong order
      expect(() => {
        expectToolCallOrder(toolCalls, ['Write', 'Read']);
      }).toThrow(/Expected tools to be called in strict order.*but got/);
    });

    it('should handle empty tool call arrays gracefully', () => {
      const emptyToolCalls: ToolCallRecord[] = [];

      // All assertions should fail gracefully with empty arrays
      expect(() => {
        expectToolCalled(emptyToolCalls, 'AnyTool');
      }).toThrow(/Expected tool 'AnyTool' to be called at least once, but it was not called/);

      expect(() => {
        expectToolCallCount(emptyToolCalls, 'AnyTool', 1);
      }).toThrow(/Expected tool 'AnyTool' to be called exactly 1 time\(s\), but it was called 0 time\(s\)/);

      // Empty order should pass
      expectToolCallOrder(emptyToolCalls, []);
    });

    it('should handle concurrent and asynchronous tool execution', async () => {
      // Simulate concurrent tool execution
      const concurrentTasks = [
        { tool: 'Read', file: 'file1.txt', delay: 100 },
        { tool: 'Read', file: 'file2.txt', delay: 50 },
        { tool: 'Write', file: 'output1.txt', delay: 150 },
        { tool: 'Write', file: 'output2.txt', delay: 75 }
      ];

      const promises = concurrentTasks.map((task, index) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            toolCalls.push({
              toolName: task.tool,
              parameters: { file_path: task.file },
              callIndex: index,
              timestamp: new Date(),
              success: true,
              result: { success: true }
            });
            resolve();
          }, task.delay);
        });
      });

      await Promise.all(promises);

      // Verify all concurrent operations were recorded
      expectToolCallCount(toolCalls, 'Read', 2);
      expectToolCallCount(toolCalls, 'Write', 2);

      // Verify specific files were processed
      expectToolCalledWith(toolCalls, 'Read', { file_path: 'file1.txt' });
      expectToolCalledWith(toolCalls, 'Read', { file_path: 'file2.txt' });
      expectToolCalledWith(toolCalls, 'Write', { file_path: 'output1.txt' });
      expectToolCalledWith(toolCalls, 'Write', { file_path: 'output2.txt' });

      // Order may vary due to timing, so test non-strict ordering
      expectToolCallOrder(toolCalls, ['Read', 'Write'], { strict: false, allowRepeats: true });
    });
  });

  describe('Integration with Mock Registry', () => {
    it('should work seamlessly with MockToolRegistry interface', () => {
      // Add calls to the mock registry
      const registryCalls = [
        { tool: 'Glob', params: { pattern: '**/*.ts' } },
        { tool: 'Read', params: { file_path: 'src/index.ts' } },
        { tool: 'Read', params: { file_path: 'src/utils.ts' } },
        { tool: 'Write', params: { file_path: 'dist/bundle.js', content: 'bundled code' } }
      ];

      registryCalls.forEach((call, index) => {
        toolCalls.push({
          toolName: call.tool,
          parameters: call.params,
          callIndex: index,
          timestamp: new Date(),
          success: true
        });
      });

      // Test assertions using the MockToolRegistry interface
      expectToolCalled(mockRegistry, 'Glob');
      expectToolCalled(mockRegistry, 'Read');
      expectToolCalled(mockRegistry, 'Write');

      // Test specific invocation queries
      const readInvocations = mockRegistry.getInvocations('Read');
      expect(readInvocations).toHaveLength(2);

      const allInvocations = mockRegistry.getAllInvocations();
      expect(allInvocations).toHaveLength(4);

      // Test parameter assertions with registry
      expectToolCalledWith(mockRegistry, 'Read', { file_path: 'src/index.ts' });
      expectToolCalledWith(mockRegistry, 'Write', { file_path: 'dist/bundle.js' }, { partial: true });

      // Test count assertions with registry
      expectToolCallCount(mockRegistry, 'Read', 2);
      expectToolCallCount(mockRegistry, 'Write', 1);

      // Test reset functionality
      mockRegistry.reset();
      expect(mockRegistry.getAllInvocations()).toHaveLength(0);
    });

    it('should provide helpful context in error messages', () => {
      // Setup scenario with multiple tools
      toolCalls = [
        { toolName: 'Read', parameters: { file_path: '/a.txt' }, timestamp: new Date(), success: true },
        { toolName: 'Write', parameters: { file_path: '/b.txt', content: 'test' }, timestamp: new Date(), success: true },
        { toolName: 'Edit', parameters: { file_path: '/c.txt', old_string: 'old', new_string: 'new' }, timestamp: new Date(), success: true }
      ];

      // Test that error messages include available tools context
      expect(() => {
        expectToolCalled(toolCalls, 'MissingTool', 'Custom error message');
      }).toThrow(/Custom error message.*Available tools called.*Read, Write, Edit/);

      // Test parameter mismatch includes detailed information
      expect(() => {
        expectToolCalledWith(toolCalls, 'Read', { file_path: '/wrong.txt', extra: 'param' });
      }).toThrow(/Match attempts.*Exact match failed.*expected.*got/);

      // Test order mismatch provides actual vs expected
      expect(() => {
        expectToolCallOrder(toolCalls, ['Write', 'Read', 'Edit']);
      }).toThrow(/Expected tools to be called in strict order.*Write, Read, Edit.*but got.*Read, Write, Edit/);
    });
  });
});