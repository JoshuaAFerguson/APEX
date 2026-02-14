/**
 * @fileoverview Comprehensive Tests for MockToolsExecutor
 *
 * This test suite validates the MockToolsExecutor class, which provides
 * a complete mock environment for testing Claude Agent SDK tool interactions.
 * Tests cover tool registration, execution, validation, event emission,
 * and comprehensive verification capabilities.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';

import {
  MockToolsExecutor,
  createDefaultMockTools,
  createMockToolsExecutor,
  type MockToolsExecutorConfig,
  type MockToolExecutionStats,
} from '../test-utils/mock-tools-executor';

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  MockToolInvocationEvent,
} from '../test-utils/mock-tool-types';

describe('MockToolsExecutor', () => {
  let executor: MockToolsExecutor;

  beforeEach(() => {
    executor = new MockToolsExecutor();
  });

  afterEach(() => {
    executor.reset();
  });

  describe('Construction and Configuration', () => {
    it('should create executor with default configuration', () => {
      const defaultExecutor = new MockToolsExecutor();
      expect(defaultExecutor).toBeInstanceOf(MockToolsExecutor);
      expect(defaultExecutor).toBeInstanceOf(EventEmitter);
    });

    it('should create executor with custom configuration', () => {
      const config: MockToolsExecutorConfig = {
        recordInvocations: false,
        emitEvents: false,
        defaultTimeout: 1000,
        validateParameters: false,
        validateResponses: false,
        maxConcurrentExecutions: 5,
        globalBehavior: {
          delay: 100,
          errorProbability: 0.1,
        },
      };

      const customExecutor = new MockToolsExecutor(config);
      expect(customExecutor).toBeInstanceOf(MockToolsExecutor);
    });

    it('should merge configuration with defaults', () => {
      const config: MockToolsExecutorConfig = {
        defaultTimeout: 2000,
        maxConcurrentExecutions: 3,
      };

      const executor = new MockToolsExecutor(config);
      expect(executor).toBeInstanceOf(MockToolsExecutor);
    });
  });

  describe('Tool Registration', () => {
    const mockTool: MockTool = {
      name: 'TestTool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' },
        },
        required: ['input'],
      },
      execute: async (params) => ({
        success: true,
        content: [{ type: 'text', text: `Hello ${params.input}` }],
      }),
    };

    it('should register a tool successfully', () => {
      executor.registerTool(mockTool);
      expect(executor.isToolRegistered('TestTool')).toBe(true);
    });

    it('should register multiple tools at once', () => {
      const tools: MockTool[] = [
        mockTool,
        {
          name: 'AnotherTool',
          description: 'Another test tool',
          parameters: { type: 'object', properties: {} },
          execute: async () => ({ success: true, content: [] }),
        },
      ];

      executor.registerTools(tools);
      expect(executor.isToolRegistered('TestTool')).toBe(true);
      expect(executor.isToolRegistered('AnotherTool')).toBe(true);

      const registeredNames = executor.getRegisteredToolNames();
      expect(registeredNames).toContain('TestTool');
      expect(registeredNames).toContain('AnotherTool');
    });

    it('should unregister a tool', () => {
      executor.registerTool(mockTool);
      expect(executor.isToolRegistered('TestTool')).toBe(true);

      const removed = executor.unregisterTool('TestTool');
      expect(removed).toBe(true);
      expect(executor.isToolRegistered('TestTool')).toBe(false);
    });

    it('should return false when unregistering non-existent tool', () => {
      const removed = executor.unregisterTool('NonExistentTool');
      expect(removed).toBe(false);
    });

    it('should enable and disable tools', () => {
      executor.registerTool(mockTool);

      const disabledResult = executor.setToolEnabled('TestTool', false);
      expect(disabledResult).toBe(true);

      const enabledResult = executor.setToolEnabled('TestTool', true);
      expect(enabledResult).toBe(true);

      const nonExistentResult = executor.setToolEnabled('NonExistent', true);
      expect(nonExistentResult).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      const mockTool: MockTool = {
        name: 'EchoTool',
        description: 'Echoes input',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Echo: ${params.message}` }],
        }),
      };
      executor.registerTool(mockTool);
    });

    it('should execute a tool successfully', async () => {
      const response = await executor.executeTool('EchoTool', { message: 'Hello World' });

      expect(response.success).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'Echo: Hello World',
      });
    });

    it('should throw error for unregistered tool', async () => {
      await expect(executor.executeTool('NonExistentTool', {})).rejects.toThrow(
        "Tool 'NonExistentTool' is not registered"
      );
    });

    it('should throw error for disabled tool', async () => {
      executor.setToolEnabled('EchoTool', false);

      await expect(executor.executeTool('EchoTool', { message: 'test' })).rejects.toThrow(
        "Tool 'EchoTool' is disabled"
      );
    });

    it('should execute tool with context information', async () => {
      const context = {
        taskId: 'task_123',
        agentName: 'developer',
        stageName: 'implementation',
        workingDirectory: '/test',
        requestId: 'req_456',
      };

      const response = await executor.executeTool('EchoTool', { message: 'test' }, context);

      expect(response.success).toBe(true);

      const invocations = executor.getInvocations('EchoTool');
      expect(invocations).toHaveLength(1);
      expect(invocations[0].context).toEqual(context);
    });

    it('should handle executor object with execute method', async () => {
      class CustomExecutor implements MockToolExecutor {
        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          return {
            success: true,
            content: [{ type: 'text', text: `Custom: ${params.input}` }],
          };
        }

        reset() {
          // Reset logic
        }
      }

      const tool: MockTool = {
        name: 'CustomTool',
        description: 'Tool with executor object',
        parameters: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
        },
        execute: new CustomExecutor(),
      };

      executor.registerTool(tool);
      const response = await executor.executeTool('CustomTool', { input: 'test' });

      expect(response.success).toBe(true);
      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'Custom: test',
      });
    });
  });

  describe('Static Responses and Response Sequences', () => {
    it('should return static response when configured', async () => {
      const staticResponse: MockToolResponse = {
        success: true,
        content: [{ type: 'text', text: 'Static response' }],
        metadata: { source: 'static' },
      };

      const tool: MockTool = {
        name: 'StaticTool',
        description: 'Tool with static response',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, content: [] }), // Should be ignored
        staticResponse,
      };

      executor.registerTool(tool);
      const response = await executor.executeTool('StaticTool', {});

      expect(response).toEqual(staticResponse);
    });

    it('should cycle through response sequence', async () => {
      const responses: MockToolResponse[] = [
        { success: true, content: [{ type: 'text', text: 'First' }] },
        { success: true, content: [{ type: 'text', text: 'Second' }] },
        { success: true, content: [{ type: 'text', text: 'Third' }] },
      ];

      const tool: MockTool = {
        name: 'SequenceTool',
        description: 'Tool with response sequence',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, content: [] }), // Should be ignored
        responseSequence: responses,
      };

      executor.registerTool(tool);

      // First execution
      let response = await executor.executeTool('SequenceTool', {});
      expect(response.content[0]).toEqual({ type: 'text', text: 'First' });

      // Second execution
      response = await executor.executeTool('SequenceTool', {});
      expect(response.content[0]).toEqual({ type: 'text', text: 'Second' });

      // Third execution
      response = await executor.executeTool('SequenceTool', {});
      expect(response.content[0]).toEqual({ type: 'text', text: 'Third' });

      // Should cycle back to first
      response = await executor.executeTool('SequenceTool', {});
      expect(response.content[0]).toEqual({ type: 'text', text: 'First' });
    });
  });

  describe('Behavior Configuration', () => {
    it('should apply response delay', async () => {
      const tool: MockTool = {
        name: 'DelayedTool',
        description: 'Tool with delay',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
        responseDelay: 100,
      };

      executor.registerTool(tool);

      const startTime = Date.now();
      await executor.executeTool('DelayedTool', {});
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should apply behavior delay over tool delay', async () => {
      const tool: MockTool = {
        name: 'DelayedTool',
        description: 'Tool with delay',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
        responseDelay: 50,
      };

      executor.registerTool(tool, { delay: 150 });

      const startTime = Date.now();
      await executor.executeTool('DelayedTool', {});
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(150);
    });

    it('should handle error probability', async () => {
      const tool: MockTool = {
        name: 'ErrorProbeTool',
        description: 'Tool with error probability',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };

      executor.registerTool(tool, {
        errorProbability: 1.0, // Always throw error
        errorToThrow: new Error('Test error'),
      });

      await expect(executor.executeTool('ErrorProbeTool', {})).rejects.toThrow('Test error');
    });

    it('should handle string error in error probability', async () => {
      const tool: MockTool = {
        name: 'StringErrorTool',
        description: 'Tool with string error',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };

      executor.registerTool(tool, {
        errorProbability: 1.0,
        errorToThrow: 'String error message',
      });

      await expect(executor.executeTool('StringErrorTool', {})).rejects.toThrow('String error message');
    });
  });

  describe('Parameter Validation', () => {
    beforeEach(() => {
      const tool: MockTool = {
        name: 'ValidatedTool',
        description: 'Tool with parameter validation',
        parameters: {
          type: 'object',
          properties: {
            requiredParam: { type: 'string' },
            optionalParam: { type: 'number' },
          },
          required: ['requiredParam'],
        },
        execute: async () => ({ success: true, content: [] }),
      };
      executor.registerTool(tool);
    });

    it('should validate parameters successfully', async () => {
      const response = await executor.executeTool('ValidatedTool', {
        requiredParam: 'test',
        optionalParam: 42,
      });

      expect(response.success).toBe(true);
    });

    it('should reject missing required parameters', async () => {
      await expect(executor.executeTool('ValidatedTool', {
        optionalParam: 42,
      })).rejects.toThrow('Parameter validation failed: Missing required parameter: requiredParam');
    });

    it('should reject invalid parameter types', async () => {
      await expect(executor.executeTool('ValidatedTool', {
        requiredParam: 'test',
        optionalParam: 'not a number',
      })).rejects.toThrow("Parameter validation failed: Invalid type for parameter 'optionalParam'");
    });

    it('should use custom validation when provided', async () => {
      const tool: MockTool = {
        name: 'CustomValidatedTool',
        description: 'Tool with custom validation',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
        validate: (params) => ({
          valid: params.customField === 'expected',
          errors: params.customField !== 'expected' ? ['Custom validation failed'] : undefined,
        }),
      };

      executor.registerTool(tool);

      await expect(executor.executeTool('CustomValidatedTool', {
        customField: 'unexpected',
      })).rejects.toThrow('Parameter validation failed: Custom validation failed');

      const response = await executor.executeTool('CustomValidatedTool', {
        customField: 'expected',
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Event Emission', () => {
    let events: MockToolInvocationEvent[];

    beforeEach(() => {
      events = [];
      executor.on('tool:event', (event) => {
        events.push(event);
      });

      const tool: MockTool = {
        name: 'EventTool',
        description: 'Tool for testing events',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };
      executor.registerTool(tool);
    });

    it('should emit tool invocation events', async () => {
      await executor.executeTool('EventTool', {});

      expect(events).toHaveLength(2); // invoked + completed

      const invokedEvent = events.find(e => e.type === 'tool:invoked');
      const completedEvent = events.find(e => e.type === 'tool:completed');

      expect(invokedEvent).toBeDefined();
      expect(invokedEvent!.toolName).toBe('EventTool');
      expect(invokedEvent!.invocation.parameters).toEqual({});

      expect(completedEvent).toBeDefined();
      expect(completedEvent!.toolName).toBe('EventTool');
      expect(completedEvent!.response).toBeDefined();
    });

    it('should emit error events when tool execution fails', async () => {
      const tool: MockTool = {
        name: 'ErrorTool',
        description: 'Tool that throws errors',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      };
      executor.registerTool(tool);

      await expect(executor.executeTool('ErrorTool', {})).rejects.toThrow('Tool execution failed');

      const errorEvent = events.find(e => e.type === 'tool:error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.toolName).toBe('ErrorTool');
      expect(errorEvent!.error).toBeDefined();
      expect(errorEvent!.error!.message).toBe('Tool execution failed');
    });
  });

  describe('Concurrent Execution', () => {
    it('should enforce maximum concurrent execution limits', async () => {
      const limitedExecutor = new MockToolsExecutor({ maxConcurrentExecutions: 2 });

      const tool: MockTool = {
        name: 'SlowTool',
        description: 'Slow executing tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true, content: [] };
        },
      };
      limitedExecutor.registerTool(tool);

      // Start two executions (should succeed)
      const exec1 = limitedExecutor.executeTool('SlowTool', {});
      const exec2 = limitedExecutor.executeTool('SlowTool', {});

      // Third execution should fail due to limit
      await expect(limitedExecutor.executeTool('SlowTool', {})).rejects.toThrow(
        'Maximum concurrent executions (2) reached'
      );

      // Wait for first two to complete
      await Promise.all([exec1, exec2]);
    });
  });

  describe('Invocation Tracking and Verification', () => {
    beforeEach(() => {
      const tool: MockTool = {
        name: 'TrackedTool',
        description: 'Tool for tracking invocations',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Processed ${params.id}` }],
        }),
      };
      executor.registerTool(tool);
    });

    it('should record tool invocations', async () => {
      await executor.executeTool('TrackedTool', { id: 'test1' });
      await executor.executeTool('TrackedTool', { id: 'test2' });

      const invocations = executor.getInvocations('TrackedTool');
      expect(invocations).toHaveLength(2);
      expect(invocations[0].parameters).toEqual({ id: 'test1' });
      expect(invocations[1].parameters).toEqual({ id: 'test2' });
    });

    it('should get last invocation', async () => {
      await executor.executeTool('TrackedTool', { id: 'first' });
      await executor.executeTool('TrackedTool', { id: 'last' });

      const lastInvocation = executor.getLastInvocation('TrackedTool');
      expect(lastInvocation).toBeDefined();
      expect(lastInvocation!.parameters).toEqual({ id: 'last' });
    });

    it('should return undefined for last invocation of non-existent tool', () => {
      const lastInvocation = executor.getLastInvocation('NonExistentTool');
      expect(lastInvocation).toBeUndefined();
    });

    it('should get all invocations across tools', async () => {
      const tool2: MockTool = {
        name: 'AnotherTool',
        description: 'Another tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };
      executor.registerTool(tool2);

      await executor.executeTool('TrackedTool', { id: 'test' });
      await executor.executeTool('AnotherTool', {});

      const allInvocations = executor.getInvocations();
      expect(allInvocations).toHaveLength(2);
      expect(allInvocations.map(inv => inv.toolName)).toEqual(['TrackedTool', 'AnotherTool']);
    });

    it('should clear invocations for specific tool', async () => {
      await executor.executeTool('TrackedTool', { id: 'test' });

      executor.clearInvocations('TrackedTool');

      const invocations = executor.getInvocations('TrackedTool');
      expect(invocations).toHaveLength(0);
    });

    it('should clear all invocations', async () => {
      const tool2: MockTool = {
        name: 'Tool2',
        description: 'Second tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };
      executor.registerTool(tool2);

      await executor.executeTool('TrackedTool', { id: 'test' });
      await executor.executeTool('Tool2', {});

      executor.clearInvocations();

      expect(executor.getInvocations('TrackedTool')).toHaveLength(0);
      expect(executor.getInvocations('Tool2')).toHaveLength(0);
      expect(executor.getInvocations()).toHaveLength(0);
    });
  });

  describe('Execution Statistics', () => {
    beforeEach(() => {
      const successTool: MockTool = {
        name: 'SuccessTool',
        description: 'Always succeeds',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };

      const failTool: MockTool = {
        name: 'FailTool',
        description: 'Always fails',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: false, content: [] }),
      };

      const errorTool: MockTool = {
        name: 'ErrorTool',
        description: 'Always throws errors',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Tool error');
        },
      };

      executor.registerTool(successTool);
      executor.registerTool(failTool);
      executor.registerTool(errorTool);
    });

    it('should generate comprehensive execution statistics', async () => {
      await executor.executeTool('SuccessTool', {});
      await executor.executeTool('SuccessTool', {});
      await executor.executeTool('FailTool', {});

      try {
        await executor.executeTool('ErrorTool', {});
      } catch (e) {
        // Expected error
      }

      const stats = executor.getStats();

      expect(stats.totalInvocations).toBe(4);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.errorExecutions).toBe(1);
      expect(stats.currentlyExecuting).toBe(0);

      expect(stats.perTool['SuccessTool'].invocations).toBe(2);
      expect(stats.perTool['SuccessTool'].successes).toBe(2);
      expect(stats.perTool['FailTool'].failures).toBe(1);
      expect(stats.perTool['ErrorTool'].errors).toBe(1);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset executor state completely', async () => {
      // Register tools and make invocations
      const tool: MockTool = {
        name: 'TestTool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [] }),
      };
      executor.registerTool(tool);
      await executor.executeTool('TestTool', {});

      // Verify state exists
      expect(executor.getInvocations()).toHaveLength(1);

      // Reset and verify clean state
      executor.reset();

      expect(executor.getInvocations()).toHaveLength(0);

      const stats = executor.getStats();
      expect(stats.totalInvocations).toBe(0);
    });

    it('should call reset on executor objects', async () => {
      const mockReset = vi.fn();

      class ResettableExecutor implements MockToolExecutor {
        async execute(): Promise<MockToolResponse> {
          return { success: true, content: [] };
        }

        reset = mockReset;
      }

      const tool: MockTool = {
        name: 'ResettableTool',
        description: 'Tool with resettable executor',
        parameters: { type: 'object', properties: {} },
        execute: new ResettableExecutor(),
      };

      executor.registerTool(tool);
      executor.reset();

      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('Tool Execution Handler', () => {
    it('should create bound tool execution handler', async () => {
      const tool: MockTool = {
        name: 'HandlerTool',
        description: 'Tool for testing handler',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ success: true, content: [{ type: 'text', text: 'Handler works' }] }),
      };
      executor.registerTool(tool);

      const handler = executor.createToolExecutionHandler();
      const response = await handler('HandlerTool', {});

      expect(response.success).toBe(true);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Handler works' });
    });
  });
});

describe('Factory Functions', () => {
  describe('createDefaultMockTools', () => {
    it('should create standard set of mock tools', () => {
      const tools = createDefaultMockTools();

      const expectedToolNames = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
      const actualToolNames = tools.map(tool => tool.name);

      expect(actualToolNames).toEqual(expect.arrayContaining(expectedToolNames));
      expect(tools).toHaveLength(6);

      // Verify each tool has required properties
      tools.forEach(tool => {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.parameters).toBeDefined();
        expect(tool.execute).toBeDefined();
      });
    });

    it('should create tools with correct categories', () => {
      const tools = createDefaultMockTools();

      const readTool = tools.find(t => t.name === 'Read');
      const bashTool = tools.find(t => t.name === 'Bash');
      const grepTool = tools.find(t => t.name === 'Grep');

      expect(readTool?.category).toBe('filesystem');
      expect(bashTool?.category).toBe('shell');
      expect(grepTool?.category).toBe('search');
    });

    it('should create functional mock tools', async () => {
      const tools = createDefaultMockTools();
      const executor = new MockToolsExecutor();
      executor.registerTools(tools);

      // Test Read tool
      const readResponse = await executor.executeTool('Read', { file_path: '/test.txt' });
      expect(readResponse.success).toBe(true);

      // Test Bash tool
      const bashResponse = await executor.executeTool('Bash', { command: 'echo test' });
      expect(bashResponse.success).toBe(true);
    });
  });

  describe('createMockToolsExecutor', () => {
    it('should create executor with default tools registered', () => {
      const executor = createMockToolsExecutor();

      const registeredTools = executor.getRegisteredToolNames();
      expect(registeredTools).toContain('Read');
      expect(registeredTools).toContain('Write');
      expect(registeredTools).toContain('Bash');
    });

    it('should create executor with custom configuration', () => {
      const config: MockToolsExecutorConfig = {
        defaultTimeout: 1000,
        maxConcurrentExecutions: 3,
      };

      const executor = createMockToolsExecutor(config);
      expect(executor).toBeInstanceOf(MockToolsExecutor);
    });
  });
});