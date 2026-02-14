/**
 * @fileoverview Comprehensive Integration Tests for Tool Mocking Utilities
 *
 * This test suite provides additional comprehensive test coverage for the Claude Agent SDK
 * tool mocking utilities, focusing on advanced scenarios, edge cases, and integration
 * testing that complements the existing core test suites.
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
  MockToolInvocationEvent,
} from '../test-utils/mock-tool-types';

describe('Tool Mocking Utilities - Comprehensive Integration Tests', () => {
  describe('Cross-System Integration Tests', () => {
    let mockExecution: MockToolExecution;
    let mockExecutor: MockToolsExecutor;

    beforeEach(() => {
      mockExecution = createMockToolExecution();
      mockExecutor = createMockToolsExecutor();
    });

    afterEach(() => {
      mockExecution.reset();
      mockExecutor.reset();
    });

    it('should integrate MockToolExecution with MockToolsExecutor', async () => {
      // Set up MockToolExecution with specific behaviors
      mockExecution
        .mockToolSuccess('Read', { content: 'file data' })
        .mockToolSuccess('Write', { written: true });

      // Simulate workflow using MockToolsExecutor
      const readResponse = await mockExecutor.executeTool('Read', { file_path: '/test.txt' });
      const writeResponse = await mockExecutor.executeTool('Write', {
        file_path: '/output.txt',
        content: 'processed data'
      });

      expect(readResponse.success).toBe(true);
      expect(writeResponse.success).toBe(true);

      // Verify both systems tracked the operations
      const executorInvocations = mockExecutor.getInvocations();
      expect(executorInvocations).toHaveLength(2);
    });

    it('should handle complex multi-agent workflow simulation', async () => {
      // Configure different agent behaviors
      const plannerMock = createMockToolScenario()
        .withSuccessTool('Read', { content: 'requirements.txt' })
        .withDynamicTool('Plan', (params) => ({
          success: true,
          output: { steps: ['analyze', 'design', 'implement', 'test'], task: params.task }
        }))
        .build();

      const developerMock = createMockToolScenario()
        .withSuccessTool('Edit', { changes: 5, file: 'src/main.js' })
        .withRetryTool('Build', 2, { success: true }, 'Build failed')
        .build();

      const testerMock = createMockToolScenario()
        .withDelayedTool('Test', { passed: 10, failed: 0 }, 500)
        .build();

      // Simulate planner phase
      let execution = await plannerMock.executeTool('Read', { file: 'requirements.txt' });
      expect(execution.result.success).toBe(true);

      execution = await plannerMock.executeTool('Plan', { task: 'implement feature' });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.steps).toHaveLength(4);

      // Simulate developer phase
      execution = await developerMock.executeTool('Edit', { file: 'src/main.js' });
      expect(execution.result.success).toBe(true);

      // Build should fail twice, then succeed
      execution = await developerMock.executeTool('Build', {});
      expect(execution.result.success).toBe(false);

      execution = await developerMock.executeTool('Build', {});
      expect(execution.result.success).toBe(false);

      execution = await developerMock.executeTool('Build', {});
      expect(execution.result.success).toBe(true);

      // Simulate tester phase with delay
      const startTime = Date.now();
      execution = await testerMock.executeTool('Test', { suite: 'all' });
      const endTime = Date.now();

      expect(execution.result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(500);

      // Verify workflow sequence across all mocks
      plannerMock.assertToolsCalledInOrder(['Read', 'Plan']);
      developerMock.assertToolsCalledInOrder(['Edit', 'Build']);
      expect(plannerMock.getTotalCallCount() + developerMock.getTotalCallCount() + testerMock.getTotalCallCount()).toBe(6);
    });

    it('should handle real-world deployment pipeline simulation', async () => {
      const deploymentPipeline = createMockToolScenario()
        .withSuccessTool('Read', { content: 'deployment config' })
        .withDynamicTool('ValidateConfig', (params) => {
          const isValid = params.environment === 'production';
          return {
            success: isValid,
            output: isValid ? { valid: true } : undefined,
            error: isValid ? undefined : 'Invalid environment configuration'
          };
        })
        .withRetryTool('Deploy', 3, { deployed: true, url: 'https://app.prod.com' }, 'Deployment service busy')
        .withDelayedTool('HealthCheck', { status: 'healthy', checks: 5 }, 2000)
        .withFailingTool('Rollback', 'Rollback not implemented')
        .build();

      // Step 1: Read configuration
      let execution = await deploymentPipeline.executeTool('Read', { file: 'deploy.yaml' });
      expect(execution.result.success).toBe(true);

      // Step 2: Validate configuration (should fail for staging)
      execution = await deploymentPipeline.executeTool('ValidateConfig', { environment: 'staging' });
      expect(execution.result.success).toBe(false);

      // Step 3: Validate configuration (should succeed for production)
      execution = await deploymentPipeline.executeTool('ValidateConfig', { environment: 'production' });
      expect(execution.result.success).toBe(true);

      // Step 4: Deploy with retries (should fail twice, then succeed)
      const deployAttempts = [];
      for (let i = 0; i < 4; i++) {
        execution = await deploymentPipeline.executeTool('Deploy', { version: 'v2.1.0' });
        deployAttempts.push(execution.result.success);
      }
      expect(deployAttempts).toEqual([false, false, false, true]);

      // Step 5: Health check with delay
      const healthStartTime = Date.now();
      execution = await deploymentPipeline.executeTool('HealthCheck', { endpoint: '/health' });
      const healthEndTime = Date.now();

      expect(execution.result.success).toBe(true);
      expect(execution.result.output.status).toBe('healthy');
      expect(healthEndTime - healthStartTime).toBeGreaterThanOrEqual(2000);

      // Verify complete workflow
      deploymentPipeline.assertToolsCalledInOrder(['Read', 'ValidateConfig', 'Deploy', 'HealthCheck']);
      expect(deploymentPipeline.getCallCount('Deploy')).toBe(4);
      expect(deploymentPipeline.getCallCount('ValidateConfig')).toBe(2);
    });
  });

  describe('Advanced Error Handling and Recovery', () => {
    let mockExecution: MockToolExecution;

    beforeEach(() => {
      mockExecution = createMockToolExecution();
    });

    afterEach(() => {
      mockExecution.reset();
    });

    it('should handle nested error scenarios with recovery', async () => {
      // Configure cascading failure and recovery
      mockExecution
        .mockToolRetry('DatabaseConnect', 3, { connected: true }, 'Connection timeout')
        .mockToolDynamic('DatabaseQuery', (params) => {
          if (params.query?.includes('DROP')) {
            return { success: false, error: 'Dangerous query blocked' };
          }
          return { success: true, output: { rows: 10, data: 'query result' } };
        })
        .mockToolRetry('DatabaseCommit', 2, { committed: true }, 'Transaction conflict');

      // Simulate database operation workflow
      // Step 1: Connect with retries
      let execution = await mockExecution.executeTool('DatabaseConnect', { host: 'db.prod.com' });
      expect(execution.result.success).toBe(false); // First attempt fails

      execution = await mockExecution.executeTool('DatabaseConnect', { host: 'db.prod.com' });
      expect(execution.result.success).toBe(false); // Second attempt fails

      execution = await mockExecution.executeTool('DatabaseConnect', { host: 'db.prod.com' });
      expect(execution.result.success).toBe(false); // Third attempt fails

      execution = await mockExecution.executeTool('DatabaseConnect', { host: 'db.prod.com' });
      expect(execution.result.success).toBe(true); // Fourth attempt succeeds

      // Step 2: Dangerous query should be blocked
      execution = await mockExecution.executeTool('DatabaseQuery', { query: 'DROP TABLE users' });
      expect(execution.result.success).toBe(false);
      expect(execution.result.error).toBe('Dangerous query blocked');

      // Step 3: Safe query should succeed
      execution = await mockExecution.executeTool('DatabaseQuery', { query: 'SELECT * FROM products' });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.rows).toBe(10);

      // Step 4: Commit with retry
      execution = await mockExecution.executeTool('DatabaseCommit', {});
      expect(execution.result.success).toBe(false); // First commit fails

      execution = await mockExecution.executeTool('DatabaseCommit', {});
      expect(execution.result.success).toBe(false); // Second commit fails

      execution = await mockExecution.executeTool('DatabaseCommit', {});
      expect(execution.result.success).toBe(true); // Third commit succeeds

      // Verify the complete error and recovery sequence
      expect(mockExecution.getCallCount('DatabaseConnect')).toBe(4);
      expect(mockExecution.getCallCount('DatabaseQuery')).toBe(2);
      expect(mockExecution.getCallCount('DatabaseCommit')).toBe(3);
    });

    it('should handle async error propagation', async () => {
      mockExecution.mockToolDynamic('AsyncProcess', async (params) => {
        await new Promise(resolve => setTimeout(resolve, 100));

        if (params.shouldFail) {
          throw new Error('Async operation failed');
        }

        return { success: true, output: { processed: params.data } };
      });

      // Test successful async operation
      let execution = await mockExecution.executeTool('AsyncProcess', { data: 'test', shouldFail: false });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.processed).toBe('test');

      // Test async operation that throws error
      execution = await mockExecution.executeTool('AsyncProcess', { data: 'fail-test', shouldFail: true });
      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('Async operation failed');
    });
  });

  describe('Performance and Concurrency Testing', () => {
    let mockExecutor: MockToolsExecutor;

    beforeEach(() => {
      mockExecutor = new MockToolsExecutor({
        maxConcurrentExecutions: 3,
        defaultTimeout: 5000
      });
    });

    afterEach(() => {
      mockExecutor.reset();
    });

    it('should handle high-concurrency tool execution', async () => {
      const concurrentTool: MockTool = {
        name: 'ConcurrentTool',
        description: 'Tool for testing concurrency',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } }
        },
        execute: async (params) => {
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
          return {
            success: true,
            content: [{ type: 'text', text: `Processed ${params.id}` }]
          };
        }
      };

      mockExecutor.registerTool(concurrentTool);

      // Start multiple concurrent executions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          mockExecutor.executeTool('ConcurrentTool', { id: `task-${i}` })
            .catch(error => ({ error: error.message, id: `task-${i}` }))
        );
      }

      const results = await Promise.all(promises);

      // Some should succeed (within concurrency limit), others should fail
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.some(f => f.error.includes('Maximum concurrent executions'))).toBe(true);
    });

    it('should track execution timing accurately', async () => {
      const timedTool: MockTool = {
        name: 'TimedTool',
        description: 'Tool with precise timing',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return { success: true, content: [] };
        }
      };

      mockExecutor.registerTool(timedTool);

      const start = Date.now();
      await mockExecutor.executeTool('TimedTool', {});
      const end = Date.now();

      const invocations = mockExecutor.getInvocations('TimedTool');
      expect(invocations).toHaveLength(1);

      const invocation = invocations[0];
      expect(invocation.duration).toBeGreaterThanOrEqual(300);
      expect(invocation.duration).toBeLessThan(end - start + 50); // Allow some margin
    });

    it('should provide accurate execution statistics', async () => {
      const tools = createDefaultMockTools();
      mockExecutor.registerTools(tools);

      // Execute various tools with different outcomes
      await mockExecutor.executeTool('Read', { file_path: '/test.txt' });
      await mockExecutor.executeTool('Write', { file_path: '/out.txt', content: 'data' });

      const errorTool: MockTool = {
        name: 'ErrorTool',
        description: 'Tool that throws errors',
        parameters: { type: 'object', properties: {} },
        execute: async () => { throw new Error('Test error'); }
      };
      mockExecutor.registerTool(errorTool);

      try {
        await mockExecutor.executeTool('ErrorTool', {});
      } catch (e) {
        // Expected error
      }

      const stats = mockExecutor.getStats();

      expect(stats.totalInvocations).toBe(3);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.errorExecutions).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);

      expect(stats.perTool['Read']).toBeDefined();
      expect(stats.perTool['Read'].successes).toBe(1);
      expect(stats.perTool['ErrorTool'].errors).toBe(1);
    });
  });

  describe('Complex Response Generation', () => {
    let mockExecution: MockToolExecution;

    beforeEach(() => {
      mockExecution = createMockToolExecution();
    });

    afterEach(() => {
      mockExecution.reset();
    });

    it('should handle complex dynamic response patterns', async () => {
      let callCount = 0;

      mockExecution.mockToolDynamic('StatefulTool', (params) => {
        callCount++;

        // Different behavior based on call count and parameters
        if (callCount === 1) {
          return { success: true, output: { status: 'initializing', step: 1 } };
        } else if (callCount === 2) {
          return { success: true, output: { status: 'processing', step: 2, data: params.input } };
        } else if (callCount === 3) {
          return { success: true, output: { status: 'completed', step: 3, result: `processed-${params.input}` } };
        } else {
          return { success: false, error: 'Too many calls' };
        }
      });

      // Test the stateful progression
      let execution = await mockExecution.executeTool('StatefulTool', { input: 'test-data' });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.status).toBe('initializing');

      execution = await mockExecution.executeTool('StatefulTool', { input: 'test-data' });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.status).toBe('processing');

      execution = await mockExecution.executeTool('StatefulTool', { input: 'test-data' });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.status).toBe('completed');
      expect(execution.result.output.result).toBe('processed-test-data');

      execution = await mockExecution.executeTool('StatefulTool', { input: 'test-data' });
      expect(execution.result.success).toBe(false);
      expect(execution.result.error).toBe('Too many calls');
    });

    it('should handle conditional response generation', async () => {
      mockExecution.mockToolDynamic('ConditionalTool', (params) => {
        const { mode, data, threshold = 10 } = params;

        if (mode === 'validate') {
          return {
            success: data && data.length > 0,
            output: data && data.length > 0 ? { valid: true } : undefined,
            error: data && data.length > 0 ? undefined : 'No data provided'
          };
        }

        if (mode === 'process') {
          const processedCount = Array.isArray(data) ? data.length : 0;
          return {
            success: processedCount >= threshold,
            output: {
              processed: processedCount,
              threshold,
              meetsThreshold: processedCount >= threshold
            },
            error: processedCount < threshold ? `Insufficient data: ${processedCount} < ${threshold}` : undefined
          };
        }

        if (mode === 'analyze') {
          const analysisResult = Array.isArray(data)
            ? {
                count: data.length,
                types: [...new Set(data.map(item => typeof item))],
                sample: data.slice(0, 3)
              }
            : { error: 'Data must be an array' };

          return {
            success: !('error' in analysisResult),
            output: analysisResult,
            error: 'error' in analysisResult ? analysisResult.error : undefined
          };
        }

        return { success: false, error: `Unknown mode: ${mode}` };
      });

      // Test validation mode
      let execution = await mockExecution.executeTool('ConditionalTool', { mode: 'validate', data: [] });
      expect(execution.result.success).toBe(false);
      expect(execution.result.error).toBe('No data provided');

      execution = await mockExecution.executeTool('ConditionalTool', { mode: 'validate', data: ['item'] });
      expect(execution.result.success).toBe(true);

      // Test processing mode
      execution = await mockExecution.executeTool('ConditionalTool', {
        mode: 'process',
        data: [1, 2, 3],
        threshold: 5
      });
      expect(execution.result.success).toBe(false);
      expect(execution.result.output.meetsThreshold).toBe(false);

      execution = await mockExecution.executeTool('ConditionalTool', {
        mode: 'process',
        data: [1, 2, 3, 4, 5, 6],
        threshold: 5
      });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.meetsThreshold).toBe(true);

      // Test analysis mode
      execution = await mockExecution.executeTool('ConditionalTool', {
        mode: 'analyze',
        data: [1, 'text', true, 2, 'more']
      });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.count).toBe(5);
      expect(execution.result.output.types).toContain('number');
      expect(execution.result.output.types).toContain('string');
      expect(execution.result.output.types).toContain('boolean');
    });
  });

  describe('Memory and State Management', () => {
    it('should handle large number of invocations without memory leaks', async () => {
      const mockExecutor = new MockToolsExecutor();
      const tool: MockTool = {
        name: 'HighVolumeTool',
        description: 'Tool for high volume testing',
        parameters: { type: 'object', properties: { id: { type: 'number' } } },
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Processed ${params.id}` }]
        })
      };

      mockExecutor.registerTool(tool);

      // Execute many times to test memory management
      for (let i = 0; i < 1500; i++) {
        await mockExecutor.executeTool('HighVolumeTool', { id: i });
      }

      const invocations = mockExecutor.getInvocations('HighVolumeTool');

      // Should limit stored invocations to prevent memory leaks
      // Based on implementation, it limits to 1000 invocations
      expect(invocations.length).toBeLessThanOrEqual(1000);

      const stats = mockExecutor.getStats();
      expect(stats.totalInvocations).toBe(1500);

      mockExecutor.reset();
    });

    it('should properly reset state across different reset methods', async () => {
      const mockExecution = createMockToolExecution();

      // Configure some behaviors and execute tools
      mockExecution
        .mockToolSuccess('Tool1', { data: 'test1' })
        .mockToolRetry('Tool2', 2, { data: 'test2' });

      await mockExecution.executeTool('Tool1', { param: 'value1' });
      await mockExecution.executeTool('Tool2', { param: 'value2' });
      await mockExecution.executeTool('Tool2', { param: 'value2' }); // Should fail
      await mockExecution.executeTool('Tool2', { param: 'value2' }); // Should succeed

      // Verify state exists
      expect(mockExecution.getCapturedCalls()).toHaveLength(4);
      expect(mockExecution.getCallCount('Tool1')).toBe(1);
      expect(mockExecution.getCallCount('Tool2')).toBe(3);

      // Test resetCalls
      mockExecution.resetCalls();
      expect(mockExecution.getCapturedCalls()).toHaveLength(0);
      expect(mockExecution.getCallCount('Tool1')).toBe(0);

      // Behaviors should still work
      const execution = await mockExecution.executeTool('Tool1', {});
      expect(execution.result.success).toBe(true);
      expect(execution.result.output.data).toBe('test1');

      // Test resetBehaviors
      mockExecution.resetBehaviors();

      // Should use default behavior now
      const execution2 = await mockExecution.executeTool('Tool1', { test: 'param' });
      expect(execution2.result.output.message).toContain('Tool Tool1 executed');

      // Test full reset
      mockExecution.reset();
      expect(mockExecution.getCapturedCalls()).toHaveLength(0);
    });
  });

  describe('Factory Function Integration', () => {
    it('should create integrated mock environments', async () => {
      // Test filesystem-specific environment
      const fsMocks = createFileSystemMockTools();

      await fsMocks.executeTool('Read', { file_path: '/test.js' });
      await fsMocks.executeTool('Edit', { file_path: '/test.js', old: 'old', new: 'new' });
      await fsMocks.executeTool('Write', { file_path: '/test.js', content: 'new content' });

      fsMocks.assertToolsCalledInOrder(['Read', 'Edit', 'Write']);

      // Test web-specific environment
      const webMocks = createWebMockTools();

      await webMocks.executeTool('WebFetch', { url: 'https://api.example.com' });
      await webMocks.executeTool('WebSearch', { query: 'test search' });

      expect(webMocks.getCallCount('WebFetch')).toBe(1);
      expect(webMocks.getCallCount('WebSearch')).toBe(1);

      // Test comprehensive environment
      const comprehensive = createComprehensiveMockTools();

      // Should have all common tools available
      const tools = ['Read', 'Write', 'Bash', 'WebFetch', 'TodoWrite', 'Browser'];

      for (const tool of tools) {
        await comprehensive.executeTool(tool, { test: 'data' });
      }

      expect(comprehensive.getTotalCallCount()).toBe(6);
    });
  });
});