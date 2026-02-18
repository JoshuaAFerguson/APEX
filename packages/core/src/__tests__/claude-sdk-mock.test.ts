/**
 * @fileoverview Tests for Claude Agent SDK Tool Mocking Utilities
 *
 * This test suite validates the MockToolExecution class and related utilities
 * that provide comprehensive test support for mocking Claude Agent SDK tool
 * calls and responses. Tests cover tool mocking, response configuration,
 * invocation capture, and verification capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  MockToolExecution,
  MockToolScenarioBuilder,
  createMockToolExecution,
  createMockToolScenario,
  createFileSystemMockTools,
  createShellMockTools,
  createWebMockTools,
  createComprehensiveMockTools,
  type MockToolResponseConfig,
  type CapturedToolCall,
  type MockToolBehavior,
} from '../test-utils/claude-sdk-mock';

describe('MockToolExecution', () => {
  let mockExecution: MockToolExecution;

  beforeEach(() => {
    mockExecution = new MockToolExecution();
  });

  afterEach(() => {
    mockExecution.reset();
  });

  describe('Construction and Basic Setup', () => {
    it('should create instance successfully', () => {
      expect(mockExecution).toBeInstanceOf(MockToolExecution);
    });

    it('should start with empty captured calls', () => {
      expect(mockExecution.getCapturedCalls()).toHaveLength(0);
    });

    it('should start with zero call counts', () => {
      expect(mockExecution.getCallCount('AnyTool')).toBe(0);
      expect(mockExecution.getTotalCallCount()).toBe(0);
    });
  });

  describe('Tool Behavior Configuration', () => {
    it('should configure tool with success response', () => {
      const result = mockExecution.mockToolSuccess('TestTool', { result: 'success' });
      expect(result).toBe(mockExecution); // Should return this for chaining
    });

    it('should configure tool with failure response', () => {
      const result = mockExecution.mockToolFailure('TestTool', 'Tool failed');
      expect(result).toBe(mockExecution); // Should return this for chaining
    });

    it('should configure tool with delayed response', () => {
      const result = mockExecution.mockToolDelayed('TestTool', { data: 'delayed' }, 100);
      expect(result).toBe(mockExecution);
    });

    it('should configure tool with retry behavior', () => {
      const result = mockExecution.mockToolRetry('TestTool', 2, { final: 'success' });
      expect(result).toBe(mockExecution);
    });

    it('should configure tool with dynamic response generator', () => {
      const generator = (params: Record<string, unknown>) => ({
        success: true,
        output: { echo: params.input },
      });

      const result = mockExecution.mockToolDynamic('TestTool', generator);
      expect(result).toBe(mockExecution);
    });

    it('should configure generic tool behavior', () => {
      const behavior: MockToolBehavior = {
        response: { success: true, output: 'configured' },
        alwaysFails: false,
      };

      const result = mockExecution.mockTool('TestTool', behavior);
      expect(result).toBe(mockExecution);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool with default behavior (no configuration)', async () => {
      const execution = await mockExecution.executeTool('UnconfiguredTool', { input: 'test' });

      expect(execution.status).toBe('completed');
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({
        message: 'Tool UnconfiguredTool executed',
        parameters: { input: 'test' },
      });
      expect(execution.toolName).toBe('UnconfiguredTool');
      expect(execution.input).toEqual({ input: 'test' });
    });

    it('should execute tool with success configuration', async () => {
      mockExecution.mockToolSuccess('SuccessTool', { data: 'success result' }, { meta: 'data' });

      const execution = await mockExecution.executeTool('SuccessTool', { id: 123 });

      expect(execution.status).toBe('completed');
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({ data: 'success result' });
      expect(execution.metadata).toEqual({ meta: 'data' });
      expect(execution.error).toBeUndefined();
    });

    it('should execute tool with failure configuration', async () => {
      mockExecution.mockToolFailure('FailTool', 'Operation failed', { errorCode: 500 });

      const execution = await mockExecution.executeTool('FailTool', { attempt: 1 });

      expect(execution.status).toBe('failed');
      expect(execution.result.success).toBe(false);
      expect(execution.result.error).toBe('Operation failed');
      expect(execution.error).toBe('Operation failed');
      expect(execution.metadata).toEqual({ errorCode: 500 });
    });

    it('should execute tool with delay', async () => {
      mockExecution.mockToolDelayed('DelayTool', { processed: true }, 100);

      const startTime = Date.now();
      const execution = await mockExecution.executeTool('DelayTool', {});
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({ processed: true });
    });

    it('should handle retry behavior correctly', async () => {
      mockExecution.mockToolRetry('RetryTool', 2, { final: 'success' }, 'Temporary failure');

      // First call should fail
      let execution = await mockExecution.executeTool('RetryTool', { attempt: 1 });
      expect(execution.status).toBe('failed');
      expect(execution.result.error).toBe('Temporary failure');

      // Second call should also fail
      execution = await mockExecution.executeTool('RetryTool', { attempt: 2 });
      expect(execution.status).toBe('failed');
      expect(execution.result.error).toBe('Temporary failure');

      // Third call should succeed
      execution = await mockExecution.executeTool('RetryTool', { attempt: 3 });
      expect(execution.status).toBe('completed');
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({ final: 'success' });
    });

    it('should handle dynamic response generation', async () => {
      mockExecution.mockToolDynamic('DynamicTool', (params) => ({
        success: true,
        output: {
          reversed: String(params.input).split('').reverse().join(''),
          length: String(params.input).length,
        },
      }));

      const execution = await mockExecution.executeTool('DynamicTool', { input: 'hello' });

      expect(execution.status).toBe('completed');
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({
        reversed: 'olleh',
        length: 5,
      });
    });

    it('should handle async dynamic response generation', async () => {
      mockExecution.mockToolDynamic('AsyncDynamicTool', async (params) => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async work
        return {
          success: true,
          output: { processed: params.data },
        };
      });

      const execution = await mockExecution.executeTool('AsyncDynamicTool', { data: 'test' });

      expect(execution.status).toBe('completed');
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({ processed: 'test' });
    });

    it('should handle always-failing behavior', async () => {
      mockExecution.mockTool('AlwaysFailTool', { alwaysFails: true });

      const execution = await mockExecution.executeTool('AlwaysFailTool', {});

      expect(execution.status).toBe('failed');
      expect(execution.result.success).toBe(false);
      expect(execution.result.error).toBe('Tool AlwaysFailTool is configured to always fail');
    });

    it('should include execution context in results', async () => {
      const context = {
        agentName: 'developer',
        stageName: 'implementation',
        taskId: 'task-123',
      };

      const execution = await mockExecution.executeTool('ContextTool', { test: true }, context);

      expect(execution.agentName).toBe('developer');
      expect(execution.stageName).toBe('implementation');
      expect(execution.taskId).toBe('task-123');
    });

    it('should generate unique call IDs', async () => {
      const execution1 = await mockExecution.executeTool('Tool1', {});
      const execution2 = await mockExecution.executeTool('Tool2', {});

      expect(execution1.callId).toBeTruthy();
      expect(execution2.callId).toBeTruthy();
      expect(execution1.callId).not.toBe(execution2.callId);
    });

    it('should track execution duration', async () => {
      const execution = await mockExecution.executeTool('TimedTool', {});

      expect(execution.duration).toBeGreaterThanOrEqual(0);
      expect(execution.startTime).toBeInstanceOf(Date);
      expect(execution.endTime).toBeInstanceOf(Date);
      expect(execution.endTime.getTime()).toBeGreaterThanOrEqual(execution.startTime.getTime());
    });
  });

  describe('Call Capture and Verification', () => {
    beforeEach(async () => {
      // Execute some tools for testing
      await mockExecution.executeTool('Tool1', { param1: 'value1' });
      await mockExecution.executeTool('Tool2', { param2: 'value2' });
      await mockExecution.executeTool('Tool1', { param1: 'value3' });
    });

    it('should capture all tool calls', () => {
      const calls = mockExecution.getCapturedCalls();
      expect(calls).toHaveLength(3);

      expect(calls[0].toolName).toBe('Tool1');
      expect(calls[0].parameters).toEqual({ param1: 'value1' });
      expect(calls[1].toolName).toBe('Tool2');
      expect(calls[2].toolName).toBe('Tool1');
    });

    it('should capture calls with metadata', () => {
      const calls = mockExecution.getCapturedCalls();

      calls.forEach(call => {
        expect(call.callId).toBeTruthy();
        expect(call.calledAt).toBeInstanceOf(Date);
      });
    });

    it('should filter calls by tool name', () => {
      const tool1Calls = mockExecution.getCallsForTool('Tool1');
      const tool2Calls = mockExecution.getCallsForTool('Tool2');

      expect(tool1Calls).toHaveLength(2);
      expect(tool2Calls).toHaveLength(1);

      expect(tool1Calls.every(call => call.toolName === 'Tool1')).toBe(true);
      expect(tool2Calls.every(call => call.toolName === 'Tool2')).toBe(true);
    });

    it('should count tool calls correctly', () => {
      expect(mockExecution.getCallCount('Tool1')).toBe(2);
      expect(mockExecution.getCallCount('Tool2')).toBe(1);
      expect(mockExecution.getCallCount('NonExistentTool')).toBe(0);
      expect(mockExecution.getTotalCallCount()).toBe(3);
    });

    it('should check if tools were called', () => {
      expect(mockExecution.wasToolCalled('Tool1')).toBe(true);
      expect(mockExecution.wasToolCalled('Tool2')).toBe(true);
      expect(mockExecution.wasToolCalled('Tool3')).toBe(false);
    });

    it('should check if tools were called with specific parameters', () => {
      expect(mockExecution.wasToolCalledWith('Tool1', { param1: 'value1' })).toBe(true);
      expect(mockExecution.wasToolCalledWith('Tool1', { param1: 'value3' })).toBe(true);
      expect(mockExecution.wasToolCalledWith('Tool1', { param1: 'nonexistent' })).toBe(false);
      expect(mockExecution.wasToolCalledWith('Tool2', { param2: 'value2' })).toBe(true);
    });

    it('should check partial parameter matches', () => {
      await mockExecution.executeTool('ComplexTool', {
        a: 1,
        b: 2,
        c: { nested: 'value' },
      });

      expect(mockExecution.wasToolCalledWith('ComplexTool', { a: 1 })).toBe(true);
      expect(mockExecution.wasToolCalledWith('ComplexTool', { b: 2 })).toBe(true);
      expect(mockExecution.wasToolCalledWith('ComplexTool', { a: 1, b: 2 })).toBe(true);
      expect(mockExecution.wasToolCalledWith('ComplexTool', { a: 999 })).toBe(false);
    });

    it('should verify tools called in order', async () => {
      mockExecution.reset();

      await mockExecution.executeTool('First', {});
      await mockExecution.executeTool('Second', {});
      await mockExecution.executeTool('Third', {});
      await mockExecution.executeTool('Second', {}); // Second again

      expect(mockExecution.wereToolsCalledInOrder(['First', 'Second', 'Third'])).toBe(true);
      expect(mockExecution.wereToolsCalledInOrder(['First', 'Third'])).toBe(true); // Skipping Second is OK
      expect(mockExecution.wereToolsCalledInOrder(['Second', 'First'])).toBe(false); // Wrong order
      expect(mockExecution.wereToolsCalledInOrder(['First', 'Second', 'Third', 'Fourth'])).toBe(false); // Fourth never called
    });
  });

  describe('Assertions', () => {
    beforeEach(async () => {
      await mockExecution.executeTool('TestTool', { param: 'value' });
      await mockExecution.executeTool('TestTool', { param: 'value2' });
      await mockExecution.executeTool('OtherTool', { other: 'param' });
    });

    it('should assert tool called correct number of times', () => {
      expect(() => mockExecution.assertToolCalledTimes('TestTool', 2)).not.toThrow();
      expect(() => mockExecution.assertToolCalledTimes('OtherTool', 1)).not.toThrow();

      expect(() => mockExecution.assertToolCalledTimes('TestTool', 1)).toThrow(
        'Expected TestTool to be called 1 times, but was called 2 times'
      );
      expect(() => mockExecution.assertToolCalledTimes('NonExistent', 0)).not.toThrow();
    });

    it('should assert tool called with specific parameters', () => {
      expect(() => mockExecution.assertToolCalledWith('TestTool', { param: 'value' })).not.toThrow();
      expect(() => mockExecution.assertToolCalledWith('OtherTool', { other: 'param' })).not.toThrow();

      expect(() => mockExecution.assertToolCalledWith('TestTool', { param: 'wrong' })).toThrow(
        /Expected TestTool to be called with parameters/
      );
    });

    it('should assert tools called in order', async () => {
      mockExecution.reset();

      await mockExecution.executeTool('A', {});
      await mockExecution.executeTool('B', {});
      await mockExecution.executeTool('C', {});

      expect(() => mockExecution.assertToolsCalledInOrder(['A', 'B', 'C'])).not.toThrow();
      expect(() => mockExecution.assertToolsCalledInOrder(['A', 'C'])).not.toThrow(); // Partial order OK

      expect(() => mockExecution.assertToolsCalledInOrder(['B', 'A'])).toThrow(
        /Expected tools to be called in order/
      );
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      mockExecution.mockToolSuccess('Tool1', { data: 'test' });
      await mockExecution.executeTool('Tool1', { test: 'param' });
    });

    it('should reset all state', () => {
      expect(mockExecution.getCapturedCalls()).toHaveLength(1);

      mockExecution.reset();

      expect(mockExecution.getCapturedCalls()).toHaveLength(0);
      expect(mockExecution.getTotalCallCount()).toBe(0);
      expect(mockExecution.getCallCount('Tool1')).toBe(0);
    });

    it('should reset only captured calls', () => {
      mockExecution.resetCalls();

      expect(mockExecution.getCapturedCalls()).toHaveLength(0);
      expect(mockExecution.getTotalCallCount()).toBe(0);

      // Behaviors should still be configured
      expect(async () => {
        const execution = await mockExecution.executeTool('Tool1', {});
        return execution.result.output;
      }).not.toThrow();
    });

    it('should reset only behaviors', async () => {
      mockExecution.resetBehaviors();

      expect(mockExecution.getCapturedCalls()).toHaveLength(1); // Calls preserved

      // Behavior should be gone, should use default
      const execution = await mockExecution.executeTool('Tool1', {});
      expect(execution.result.output).toEqual({
        message: 'Tool Tool1 executed',
        parameters: {},
      });
    });
  });
});

describe('MockToolScenarioBuilder', () => {
  let builder: MockToolScenarioBuilder;

  beforeEach(() => {
    builder = new MockToolScenarioBuilder();
  });

  it('should build scenarios with chaining', () => {
    const mockExecution = builder
      .withSuccessTool('Read', { content: 'file data' })
      .withFailingTool('Write', 'Permission denied')
      .withRetryTool('Deploy', 2, { deployed: true })
      .withDelayedTool('Backup', { backed_up: true }, 500)
      .withDynamicTool('Process', (params) => ({
        success: true,
        output: { processed: params.input },
      }))
      .build();

    expect(mockExecution).toBeInstanceOf(MockToolExecution);
  });

  it('should create functional tools from builder', async () => {
    const mockExecution = builder
      .withSuccessTool('Echo', { echoed: 'hello' })
      .build();

    const execution = await mockExecution.executeTool('Echo', { input: 'hello' });

    expect(execution.result.success).toBe(true);
    expect(execution.result.output).toEqual({ echoed: 'hello' });
  });
});

describe('Factory Functions', () => {
  describe('createMockToolExecution', () => {
    it('should create new MockToolExecution instance', () => {
      const mockExecution = createMockToolExecution();
      expect(mockExecution).toBeInstanceOf(MockToolExecution);
    });
  });

  describe('createMockToolScenario', () => {
    it('should create new MockToolScenarioBuilder instance', () => {
      const builder = createMockToolScenario();
      expect(builder).toBeInstanceOf(MockToolScenarioBuilder);
    });
  });

  describe('createFileSystemMockTools', () => {
    it('should create mock execution with file system tools', async () => {
      const mockExecution = createFileSystemMockTools();

      // Test Read tool
      const readExecution = await mockExecution.executeTool('Read', { file_path: '/test.txt' });
      expect(readExecution.result.success).toBe(true);

      // Test Write tool
      const writeExecution = await mockExecution.executeTool('Write', { content: 'test data' });
      expect(writeExecution.result.success).toBe(true);

      // Test Edit tool
      const editExecution = await mockExecution.executeTool('Edit', { changes: 'test' });
      expect(editExecution.result.success).toBe(true);

      // Test Glob tool
      const globExecution = await mockExecution.executeTool('Glob', { pattern: '*.js' });
      expect(globExecution.result.success).toBe(true);

      // Test Grep tool
      const grepExecution = await mockExecution.executeTool('Grep', { pattern: 'test' });
      expect(grepExecution.result.success).toBe(true);
    });
  });

  describe('createShellMockTools', () => {
    it('should create mock execution with shell tools', async () => {
      const mockExecution = createShellMockTools();

      const bashExecution = await mockExecution.executeTool('Bash', { command: 'ls -la' });
      expect(bashExecution.result.success).toBe(true);
      expect(bashExecution.result.output).toEqual({
        stdout: 'command output',
        stderr: '',
        exitCode: 0,
      });
    });
  });

  describe('createWebMockTools', () => {
    it('should create mock execution with web tools', async () => {
      const mockExecution = createWebMockTools();

      // Test WebFetch tool
      const fetchExecution = await mockExecution.executeTool('WebFetch', { url: 'https://example.com' });
      expect(fetchExecution.result.success).toBe(true);
      expect(fetchExecution.result.output).toEqual({
        content: '<html><body>test</body></html>',
        statusCode: 200,
      });

      // Test WebSearch tool
      const searchExecution = await mockExecution.executeTool('WebSearch', { query: 'test query' });
      expect(searchExecution.result.success).toBe(true);
      expect(searchExecution.result.output).toEqual({
        results: [{ title: 'Test', url: 'https://example.com' }],
        totalResults: 1,
      });
    });
  });

  describe('createComprehensiveMockTools', () => {
    it('should create mock execution with all common tools', async () => {
      const mockExecution = createComprehensiveMockTools();

      const toolsToTest = ['Read', 'Write', 'Bash', 'WebFetch', 'TodoWrite', 'Browser'];

      for (const toolName of toolsToTest) {
        const execution = await mockExecution.executeTool(toolName, { test: 'param' });
        expect(execution.result.success).toBe(true);
      }
    });

    it('should have all expected tools available', () => {
      const mockExecution = createComprehensiveMockTools();

      expect(mockExecution.wasToolCalled('Read')).toBe(false); // Not called yet, but should be configurable
      expect(mockExecution.getCallCount('Write')).toBe(0);
    });
  });
});

describe('Integration Scenarios', () => {
  it('should handle complex workflow simulation', async () => {
    const mockExecution = createMockToolScenario()
      .withSuccessTool('Read', { content: 'const x = 1;' })
      .withDynamicTool('Edit', (params) => {
        const oldContent = 'const x = 1;';
        const newContent = oldContent.replace('1', '2');
        return { success: true, output: { content: newContent, changes: 1 } };
      })
      .withSuccessTool('Write', { written: true })
      .withDelayedTool('Test', { passed: true, tests: 5 }, 200)
      .build();

    // Simulate a typical development workflow
    let execution = await mockExecution.executeTool('Read', { file: 'test.js' });
    expect(execution.result.success).toBe(true);

    execution = await mockExecution.executeTool('Edit', { find: '1', replace: '2' });
    expect(execution.result.success).toBe(true);

    execution = await mockExecution.executeTool('Write', { content: 'const x = 2;' });
    expect(execution.result.success).toBe(true);

    const startTime = Date.now();
    execution = await mockExecution.executeTool('Test', { suite: 'unit' });
    const endTime = Date.now();

    expect(execution.result.success).toBe(true);
    expect(endTime - startTime).toBeGreaterThanOrEqual(200);

    // Verify the workflow
    mockExecution.assertToolsCalledInOrder(['Read', 'Edit', 'Write', 'Test']);
    expect(mockExecution.getTotalCallCount()).toBe(4);
  });

  it('should handle error recovery scenarios', async () => {
    const mockExecution = createMockToolScenario()
      .withRetryTool('DeployService', 3, { deployed: true }, 'Service temporarily unavailable')
      .withFailingTool('Rollback', 'Rollback failed - manual intervention required')
      .build();

    // Simulate deployment with retries
    let execution = await mockExecution.executeTool('DeployService', { version: 'v1.2.0' });
    expect(execution.result.success).toBe(false); // First attempt fails

    execution = await mockExecution.executeTool('DeployService', { version: 'v1.2.0' });
    expect(execution.result.success).toBe(false); // Second attempt fails

    execution = await mockExecution.executeTool('DeployService', { version: 'v1.2.0' });
    expect(execution.result.success).toBe(false); // Third attempt fails

    execution = await mockExecution.executeTool('DeployService', { version: 'v1.2.0' });
    expect(execution.result.success).toBe(true); // Fourth attempt succeeds

    // Verify retry behavior
    expect(mockExecution.getCallCount('DeployService')).toBe(4);

    // Test rollback failure
    execution = await mockExecution.executeTool('Rollback', { to_version: 'v1.1.0' });
    expect(execution.result.success).toBe(false);
    expect(execution.result.error).toBe('Rollback failed - manual intervention required');
  });
});