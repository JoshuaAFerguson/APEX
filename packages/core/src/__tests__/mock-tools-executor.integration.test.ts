/**
 * Integration tests for MockToolsExecutor
 *
 * This test suite covers comprehensive usage scenarios for the MockToolsExecutor
 * utility, demonstrating common patterns for testing tool execution in APEX.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockToolsExecutor,
  createMockToolsExecutor,
  createDefaultMockTools,
  type MockToolsExecutorConfig,
} from '../test-utils/mock-tools-executor';
import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  ToolInvocationContext,
  MockToolBehaviorConfig,
} from '../test-utils/mock-tool-types';

describe('MockToolsExecutor Integration Tests', () => {
  let executor: MockToolsExecutor;

  beforeEach(() => {
    executor = new MockToolsExecutor();
  });

  afterEach(() => {
    executor.reset();
  });

  describe('Basic Tool Registration and Execution', () => {
    it('should register and execute a simple tool', async () => {
      // Register a basic Read tool
      const readTool: MockTool = {
        name: 'Read',
        description: 'Read file contents',
        category: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to file' }
          },
          required: ['file_path']
        },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Content of ${params.file_path}` }]
        })
      };

      executor.registerTool(readTool);

      // Verify registration
      expect(executor.isToolRegistered('Read')).toBe(true);
      expect(executor.getRegisteredToolNames()).toContain('Read');

      // Execute the tool
      const result = await executor.executeTool('Read', { file_path: '/test.txt' });

      expect(result.success).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: 'Content of /test.txt' }
      ]);

      // Verify invocation tracking
      const invocations = executor.getInvocations('Read');
      expect(invocations).toHaveLength(1);
      expect(invocations[0].toolName).toBe('Read');
      expect(invocations[0].parameters).toEqual({ file_path: '/test.txt' });
    });

    it('should handle tool execution with validation', async () => {
      const strictTool: MockTool = {
        name: 'StrictTool',
        description: 'Tool with strict validation',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            count: { type: 'number' }
          },
          required: ['name', 'count']
        },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Processed ${params.name} ${params.count} times` }]
        }),
        validate: (params) => {
          const errors: string[] = [];
          if (!params.name) errors.push('name is required');
          if (!params.count || typeof params.count !== 'number') {
            errors.push('count must be a number');
          }
          return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
        }
      };

      executor.registerTool(strictTool);

      // Test valid parameters
      const validResult = await executor.executeTool('StrictTool', {
        name: 'test',
        count: 3
      });
      expect(validResult.success).toBe(true);

      // Test invalid parameters
      await expect(executor.executeTool('StrictTool', { name: 'test' }))
        .rejects.toThrow('count must be a number');

      await expect(executor.executeTool('StrictTool', { count: 5 }))
        .rejects.toThrow('name is required');
    });
  });

  describe('Advanced Tool Behaviors', () => {
    it('should handle tools with response sequences', async () => {
      const sequenceTool: MockTool = {
        name: 'SequenceTool',
        description: 'Tool with predefined response sequence',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        responseSequence: [
          { success: true, content: [{ type: 'text', text: 'First response' }] },
          { success: true, content: [{ type: 'text', text: 'Second response' }] },
          { success: false, content: [{ type: 'text', text: 'Third response (failed)' }] }
        ]
      };

      executor.registerTool(sequenceTool);

      // First call
      const result1 = await executor.executeTool('SequenceTool', { input: 'test1' });
      expect(result1.content).toEqual([{ type: 'text', text: 'First response' }]);
      expect(result1.success).toBe(true);

      // Second call
      const result2 = await executor.executeTool('SequenceTool', { input: 'test2' });
      expect(result2.content).toEqual([{ type: 'text', text: 'Second response' }]);
      expect(result2.success).toBe(true);

      // Third call
      const result3 = await executor.executeTool('SequenceTool', { input: 'test3' });
      expect(result3.content).toEqual([{ type: 'text', text: 'Third response (failed)' }]);
      expect(result3.success).toBe(false);

      // Fourth call should cycle back to first
      const result4 = await executor.executeTool('SequenceTool', { input: 'test4' });
      expect(result4.content).toEqual([{ type: 'text', text: 'First response' }]);
      expect(result4.success).toBe(true);
    });

    it('should handle tools with static responses', async () => {
      const staticTool: MockTool = {
        name: 'StaticTool',
        description: 'Tool with static response',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' }
          },
          required: ['action']
        },
        staticResponse: {
          success: true,
          content: [{ type: 'text', text: 'Static response content' }]
        }
      };

      executor.registerTool(staticTool);

      // All calls should return the same response
      for (let i = 0; i < 3; i++) {
        const result = await executor.executeTool('StaticTool', { action: `action${i}` });
        expect(result).toEqual({
          success: true,
          content: [{ type: 'text', text: 'Static response content' }]
        });
      }

      // Verify all invocations were tracked
      expect(executor.getInvocations('StaticTool')).toHaveLength(3);
    });

    it('should handle tools with delays', async () => {
      const delayTool: MockTool = {
        name: 'DelayTool',
        description: 'Tool with response delay',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        },
        responseDelay: 100, // 100ms delay
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Delayed: ${params.message}` }]
        })
      };

      executor.registerTool(delayTool);

      const startTime = Date.now();
      const result = await executor.executeTool('DelayTool', { message: 'test' });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: 'Delayed: test' }]);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tool execution errors', async () => {
      const errorTool: MockTool = {
        name: 'ErrorTool',
        description: 'Tool that throws errors',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            shouldError: { type: 'boolean' }
          },
          required: ['shouldError']
        },
        execute: async (params) => {
          if (params.shouldError) {
            throw new Error('Tool execution failed');
          }
          return {
            success: true,
            content: [{ type: 'text', text: 'Tool executed successfully' }]
          };
        }
      };

      executor.registerTool(errorTool);

      // Test successful execution
      const successResult = await executor.executeTool('ErrorTool', { shouldError: false });
      expect(successResult.success).toBe(true);

      // Test error case
      await expect(executor.executeTool('ErrorTool', { shouldError: true }))
        .rejects.toThrow('Tool execution failed');

      // Verify both invocations were recorded
      const invocations = executor.getInvocations('ErrorTool');
      expect(invocations).toHaveLength(2);
      expect(invocations[0].error).toBeUndefined();
      expect(invocations[1].error).toBeInstanceOf(Error);
    });

    it('should handle disabled tools', async () => {
      const tool: MockTool = {
        name: 'DisabledTool',
        description: 'Tool that can be disabled',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async () => ({ success: true, content: [{ type: 'text', text: 'result' }] })
      };

      executor.registerTool(tool);

      // Tool should work initially
      await expect(executor.executeTool('DisabledTool', { input: 'test' }))
        .resolves.not.toThrow();

      // Disable the tool
      executor.setToolEnabled('DisabledTool', false);

      // Tool should now throw error
      await expect(executor.executeTool('DisabledTool', { input: 'test' }))
        .rejects.toThrow("Tool 'DisabledTool' is disabled");

      // Re-enable the tool
      executor.setToolEnabled('DisabledTool', true);

      // Tool should work again
      await expect(executor.executeTool('DisabledTool', { input: 'test' }))
        .resolves.not.toThrow();
    });

    it('should handle unregistered tools', async () => {
      await expect(executor.executeTool('NonExistentTool', { input: 'test' }))
        .rejects.toThrow("Tool 'NonExistentTool' is not registered");
    });

    it('should handle concurrent execution limits', async () => {
      const slowTool: MockTool = {
        name: 'SlowTool',
        description: 'Slow executing tool',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            delay: { type: 'number' }
          },
          required: ['delay']
        },
        execute: async (params) => {
          await new Promise(resolve => setTimeout(resolve, params.delay as number));
          return { success: true, content: [{ type: 'text', text: 'completed' }] };
        }
      };

      // Create executor with low concurrent execution limit
      const limitedExecutor = new MockToolsExecutor({
        maxConcurrentExecutions: 2
      });

      limitedExecutor.registerTool(slowTool);

      // Start two long-running executions
      const promise1 = limitedExecutor.executeTool('SlowTool', { delay: 200 });
      const promise2 = limitedExecutor.executeTool('SlowTool', { delay: 200 });

      // Third execution should be rejected immediately
      await expect(limitedExecutor.executeTool('SlowTool', { delay: 100 }))
        .rejects.toThrow('Maximum concurrent executions (2) reached');

      // Wait for the first two to complete
      await Promise.all([promise1, promise2]);

      // Now a new execution should work
      await expect(limitedExecutor.executeTool('SlowTool', { delay: 10 }))
        .resolves.not.toThrow();

      limitedExecutor.reset();
    });
  });

  describe('Tool Behavior Configuration', () => {
    it('should handle error probability configuration', async () => {
      const probabilisticTool: MockTool = {
        name: 'ProbabilisticTool',
        description: 'Tool with configurable error probability',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async () => ({ success: true, content: [{ type: 'text', text: 'success' }] })
      };

      const behaviorConfig: MockToolBehaviorConfig = {
        errorProbability: 1.0, // Always error
        errorToThrow: new Error('Simulated error')
      };

      executor.registerTool(probabilisticTool, behaviorConfig);

      // Should always throw error with probability 1.0
      await expect(executor.executeTool('ProbabilisticTool', { input: 'test' }))
        .rejects.toThrow('Simulated error');
    });

    it('should handle behavior delay configuration', async () => {
      const tool: MockTool = {
        name: 'BehaviorDelayTool',
        description: 'Tool with behavior delay',
        category: 'test',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async () => ({ success: true, content: [{ type: 'text', text: 'result' }] })
      };

      const behaviorConfig: MockToolBehaviorConfig = {
        delay: 150
      };

      executor.registerTool(tool, behaviorConfig);

      const startTime = Date.now();
      await executor.executeTool('BehaviorDelayTool', { input: 'test' });
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(150);
    });
  });

  describe('Statistics and Analysis', () => {
    it('should provide comprehensive execution statistics', async () => {
      // Register multiple tools
      const tools: MockTool[] = [
        {
          name: 'Tool1',
          description: 'First tool',
          category: 'test',
          parameters: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, content: [{ type: 'text', text: 'result1' }] })
        },
        {
          name: 'Tool2',
          description: 'Second tool',
          category: 'test',
          parameters: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: false, content: [{ type: 'text', text: 'failed' }] })
        },
        {
          name: 'Tool3',
          description: 'Third tool',
          category: 'test',
          parameters: { type: 'object', properties: {}, required: [] },
          execute: async () => { throw new Error('Tool error'); }
        }
      ];

      executor.registerTools(tools);

      // Execute tools multiple times
      await executor.executeTool('Tool1', {});
      await executor.executeTool('Tool1', {});
      await executor.executeTool('Tool2', {});

      try {
        await executor.executeTool('Tool3', {});
      } catch {
        // Expected error
      }

      const stats = executor.getStats();

      expect(stats.totalInvocations).toBe(4);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.errorExecutions).toBe(1);
      expect(stats.currentlyExecuting).toBe(0);

      expect(stats.perTool['Tool1'].invocations).toBe(2);
      expect(stats.perTool['Tool1'].successes).toBe(2);
      expect(stats.perTool['Tool2'].failures).toBe(1);
      expect(stats.perTool['Tool3'].errors).toBe(1);
    });

    it('should track invocation timing', async () => {
      const tool: MockTool = {
        name: 'TimedTool',
        description: 'Tool for timing tests',
        category: 'test',
        parameters: { type: 'object', properties: {}, required: [] },
        responseDelay: 50,
        execute: async () => ({ success: true, content: [{ type: 'text', text: 'timed result' }] })
      };

      executor.registerTool(tool);
      await executor.executeTool('TimedTool', {});

      const invocations = executor.getInvocations('TimedTool');
      expect(invocations).toHaveLength(1);

      const invocation = invocations[0];
      expect(invocation.duration).toBeGreaterThanOrEqual(50);
      expect(invocation.invokedAt).toBeInstanceOf(Date);
      expect(invocation.completedAt).toBeInstanceOf(Date);
      expect(invocation.completedAt!.getTime()).toBeGreaterThan(invocation.invokedAt.getTime());
    });
  });

  describe('Event Emission', () => {
    it('should emit tool lifecycle events', async () => {
      const eventExecutor = new MockToolsExecutor({ emitEvents: true });
      const events: Array<{ type: string; toolName: string }> = [];

      // Listen for events
      eventExecutor.on('tool:invoked', (event) => events.push({ type: 'invoked', toolName: event.toolName }));
      eventExecutor.on('tool:completed', (event) => events.push({ type: 'completed', toolName: event.toolName }));
      eventExecutor.on('tool:error', (event) => events.push({ type: 'error', toolName: event.toolName }));

      const tool: MockTool = {
        name: 'EventTool',
        description: 'Tool for event testing',
        category: 'test',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => ({ success: true, content: [{ type: 'text', text: 'event result' }] })
      };

      eventExecutor.registerTool(tool);
      await eventExecutor.executeTool('EventTool', {});

      expect(events).toEqual([
        { type: 'invoked', toolName: 'EventTool' },
        { type: 'completed', toolName: 'EventTool' }
      ]);

      eventExecutor.reset();
    });
  });

  describe('Default Mock Tools Factory', () => {
    it('should create executor with default tools', () => {
      const defaultExecutor = createMockToolsExecutor();

      const expectedTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
      const registeredTools = defaultExecutor.getRegisteredToolNames();

      for (const toolName of expectedTools) {
        expect(registeredTools).toContain(toolName);
      }
    });

    it('should execute default tools successfully', async () => {
      const defaultExecutor = createMockToolsExecutor();

      // Test Read tool
      const readResult = await defaultExecutor.executeTool('Read', {
        file_path: '/test.txt'
      });
      expect(readResult.success).toBe(true);
      expect(readResult.content).toEqual([
        { type: 'text', text: 'Mock content for /test.txt' }
      ]);

      // Test Write tool
      const writeResult = await defaultExecutor.executeTool('Write', {
        file_path: '/output.txt',
        content: 'test content'
      });
      expect(writeResult.success).toBe(true);
      expect(writeResult.content).toEqual([
        { type: 'text', text: 'File written to /output.txt' }
      ]);

      // Test Bash tool
      const bashResult = await defaultExecutor.executeTool('Bash', {
        command: 'ls -la'
      });
      expect(bashResult.success).toBe(true);
      expect(bashResult.content).toEqual([
        { type: 'text', text: '$ ls -la\nMock command output' }
      ]);

      defaultExecutor.reset();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should simulate a complete file processing workflow', async () => {
      // Setup tools for file processing workflow
      const workflowTools: MockTool[] = [
        {
          name: 'ListFiles',
          description: 'List files in directory',
          category: 'filesystem',
          parameters: {
            type: 'object',
            properties: {
              directory: { type: 'string' }
            },
            required: ['directory']
          },
          execute: async (params) => ({
            success: true,
            content: [{
              type: 'text',
              text: `Files in ${params.directory}:\nfile1.txt\nfile2.txt\nfile3.txt`
            }]
          })
        },
        {
          name: 'ProcessFile',
          description: 'Process individual file',
          category: 'processing',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string' }
            },
            required: ['filename']
          },
          responseSequence: [
            { success: true, content: [{ type: 'text', text: 'Processed file1.txt' }] },
            { success: true, content: [{ type: 'text', text: 'Processed file2.txt' }] },
            { success: false, content: [{ type: 'text', text: 'Failed to process file3.txt' }] }
          ]
        },
        {
          name: 'GenerateReport',
          description: 'Generate processing report',
          category: 'reporting',
          parameters: {
            type: 'object',
            properties: {
              processedFiles: { type: 'array' }
            },
            required: ['processedFiles']
          },
          execute: async (params) => ({
            success: true,
            content: [{
              type: 'text',
              text: `Report: Processed ${(params.processedFiles as string[]).length} files`
            }]
          })
        }
      ];

      executor.registerTools(workflowTools);

      // Execute workflow
      const listResult = await executor.executeTool('ListFiles', { directory: '/data' });
      expect(listResult.success).toBe(true);

      const processedFiles = [];
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];

      for (const file of files) {
        try {
          const result = await executor.executeTool('ProcessFile', { filename: file });
          if (result.success) {
            processedFiles.push(file);
          }
        } catch (error) {
          // Handle processing errors
        }
      }

      const reportResult = await executor.executeTool('GenerateReport', { processedFiles });
      expect(reportResult.success).toBe(true);
      expect(reportResult.content).toEqual([
        { type: 'text', text: 'Report: Processed 2 files' }
      ]);

      // Verify workflow statistics
      const stats = executor.getStats();
      expect(stats.totalInvocations).toBe(5); // 1 list + 3 process + 1 report
      expect(stats.successfulExecutions).toBe(4);
      expect(stats.failedExecutions).toBe(1);
    });

    it('should handle context-aware tool execution', async () => {
      const contextTool: MockTool = {
        name: 'ContextAwareTool',
        description: 'Tool that uses execution context',
        category: 'context',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' }
          },
          required: ['action']
        },
        execute: async (params, context) => {
          const taskInfo = context?.taskId ? `Task: ${context.taskId}` : 'No task';
          const agentInfo = context?.agentName ? `Agent: ${context.agentName}` : 'No agent';
          const stageInfo = context?.stageName ? `Stage: ${context.stageName}` : 'No stage';

          return {
            success: true,
            content: [{
              type: 'text',
              text: `Action: ${params.action}, ${taskInfo}, ${agentInfo}, ${stageInfo}`
            }]
          };
        }
      };

      executor.registerTool(contextTool);

      const context: ToolInvocationContext = {
        taskId: 'task-123',
        agentName: 'developer',
        stageName: 'implementation'
      };

      const result = await executor.executeTool('ContextAwareTool',
        { action: 'compile' },
        context
      );

      expect(result.content).toEqual([{
        type: 'text',
        text: 'Action: compile, Task: task-123, Agent: developer, Stage: implementation'
      }]);

      const invocations = executor.getInvocations('ContextAwareTool');
      expect(invocations[0].context).toEqual(context);
    });
  });
});