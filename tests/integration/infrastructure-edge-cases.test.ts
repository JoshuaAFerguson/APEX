/**
 * Integration Test Infrastructure Edge Cases and Error Paths
 *
 * This test file validates that the integration test infrastructure
 * handles edge cases, error conditions, and boundary conditions correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIntegrationTestEnvironment } from '../test-utils/integration-test-utilities';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTempDirectory,
  createTempFile,
  waitFor,
  retryWithBackoff,
  createMockEventEmitter,
  measureExecutionTime,
  PerformanceBenchmark,
} from '../test-utils/test-setup-teardown';
import {
  createAdvancedTaskMock,
  createAdvancedOrchestratorMock,
  createAgentExecutionMock,
  createWorkflowExecutionMock,
  mockRegistry,
} from '../test-utils/enhanced-mock-factories';
import type { IntegrationTestEnvironment } from '../test-utils/integration-test-utilities';

describe('Integration Infrastructure Edge Cases', () => {
  describe('Environment Creation Error Handling', () => {
    it('should handle invalid project configurations gracefully', async () => {
      // Test with empty project name
      const env1 = await createIntegrationTestEnvironment({
        projectName: '', // Empty project name
        language: 'typescript',
      });

      expect(env1).toBeDefined();
      expect(env1.testDir).toBeDefined();
      await env1.cleanup();

      // Test with invalid language
      const env2 = await createIntegrationTestEnvironment({
        projectName: 'test-invalid-lang',
        language: 'invalid-language' as any,
      });

      expect(env2).toBeDefined();
      await env2.cleanup();
    });

    it('should handle custom agents and workflows with invalid data', async () => {
      const env = await createIntegrationTestEnvironment({
        customAgents: [
          {
            name: '', // Empty agent name
            definition: {
              description: 'Agent with empty name',
              tools: [] as any, // Empty tools array
            },
          },
          {
            name: 'valid-agent',
            definition: {
              tools: ['NonExistentTool' as any], // Invalid tool
              model: 'invalid-model' as any, // Invalid model
            },
          },
        ],
        customWorkflows: [
          {
            name: '',
            definition: {
              stages: [], // Empty stages
            },
          },
          {
            name: 'invalid-workflow',
            definition: {
              stages: [
                {
                  name: '',
                  agent: 'non-existent-agent',
                  description: '',
                },
              ],
            },
          },
        ],
      });

      expect(env).toBeDefined();
      expect(env.agents).toBeDefined();
      expect(env.workflows).toBeDefined();

      await env.cleanup();
    });

    it('should handle isolation failures gracefully', async () => {
      // Test with all isolation options enabled
      const env = await createIntegrationTestEnvironment({
        projectName: 'isolation-test',
        isolation: {
          filesystem: true,
          network: true,
          environment: true,
        },
      });

      expect(env).toBeDefined();
      expect(env.testDir).toBeDefined();

      await env.cleanup();
    });
  });

  describe('Task Creation Edge Cases', () => {
    let environment: IntegrationTestEnvironment;

    beforeAll(async () => {
      environment = await createIntegrationTestEnvironment({
        projectName: 'task-edge-cases',
      });
    });

    afterAll(async () => {
      await environment.cleanup();
    });

    it('should handle invalid task configurations', () => {
      // Task with null/undefined values
      const task1 = environment.createTask({
        description: undefined as any,
        workflow: null as any,
        autonomy: 'invalid-autonomy' as any,
        priority: 'invalid-priority' as any,
        maxRetries: -1,
      });

      expect(task1.id).toBeDefined();
      // Should use defaults for invalid values

      // Task with extreme values
      const task2 = environment.createTask({
        description: 'A'.repeat(10000), // Very long description
        maxRetries: 999999,
        retryCount: 999999,
      });

      expect(task2.id).toBeDefined();
      expect(task2.description.length).toBe(10000);
    });

    it('should handle circular dependencies', () => {
      const task1 = environment.createTask({
        description: 'Task 1',
        dependsOn: ['task2'], // Depends on task2
      });

      const task2 = environment.createTask({
        description: 'Task 2',
        dependsOn: [task1.id], // Circular dependency
      });

      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      // The infrastructure should handle this gracefully
    });

    it('should handle tasks with very large data', () => {
      const largeTask = environment.createTask({
        description: 'Large task',
        logs: Array(1000).fill(null).map((_, i) => ({
          message: `Log entry ${i} with some longer content to test large data handling`,
          level: 'info' as const,
          timestamp: new Date(),
          stage: 'testing',
        })),
        artifacts: Array(100).fill(null).map((_, i) => ({
          name: `artifact-${i}.txt`,
          path: `/path/to/artifact-${i}.txt`,
          type: 'file',
          createdAt: new Date(),
          size: 1024 * i,
        })),
      });

      expect(largeTask).toBeDefined();
      expect(largeTask.logs.length).toBe(1000);
      expect(largeTask.artifacts.length).toBe(100);
    });
  });

  describe('Mock Factory Error Handling', () => {
    afterEach(() => {
      mockRegistry.cleanup();
    });

    it('should handle task mock with invalid options', () => {
      const taskMock = createAdvancedTaskMock(
        {
          id: null as any,
          description: undefined as any,
          status: 'invalid-status' as any,
        },
        {
          withEvents: true,
          withHistory: true,
          customBehaviors: {
            // Invalid custom behavior
            invalidMethod: 'not-a-function' as any,
          },
        }
      );

      expect(taskMock).toBeDefined();
      expect(taskMock.id).toBeDefined(); // Should generate a valid ID
    });

    it('should handle orchestrator mock with extreme configurations', () => {
      const orchestratorMock = createAdvancedOrchestratorMock({
        agentRegistry: {
          'null-agent': null as any,
          'undefined-agent': undefined as any,
        },
        workflowRegistry: {
          'empty-workflow': {} as any,
          'circular-workflow': {
            name: 'circular',
            stages: [
              { name: 'stage1', agent: 'stage2' as any },
              { name: 'stage2', agent: 'stage1' as any },
            ],
          } as any,
        },
        eventTracking: true,
        performanceMetrics: true,
      });

      expect(orchestratorMock).toBeDefined();
      expect(typeof orchestratorMock.createTask).toBe('function');

      // Test creating task with invalid data
      const createInvalidTask = async () => {
        return orchestratorMock.createTask({
          description: null as any,
          workflow: 'non-existent-workflow',
        });
      };

      expect(createInvalidTask()).resolves.toBeDefined();
    });

    it('should handle agent execution with timeout scenarios', async () => {
      const timeoutAgent = createAgentExecutionMock('timeout-agent', {
        behavior: 'custom',
        customBehavior: async () => {
          // Simulate very long execution
          await new Promise(resolve => setTimeout(resolve, 5000));
          return { success: true };
        },
      });

      // This should resolve quickly in test environment
      const execution = timeoutAgent.execute({ description: 'Timeout test' });

      // Test concurrent executions
      const concurrent = Promise.all([
        timeoutAgent.execute({ description: 'Concurrent 1' }),
        timeoutAgent.execute({ description: 'Concurrent 2' }),
        timeoutAgent.execute({ description: 'Concurrent 3' }),
      ]);

      expect(concurrent).resolves.toBeDefined();
      expect(execution).resolves.toBeDefined();
    });

    it('should handle workflow execution with random failures', async () => {
      const flakeyWorkflow = createWorkflowExecutionMock('flakey-workflow', {
        stages: [
          { name: 'stable', agent: 'stable-agent', successRate: 1.0 },
          { name: 'unstable', agent: 'unstable-agent', successRate: 0.1 }, // 10% success rate
          { name: 'very-unstable', agent: 'very-unstable-agent', successRate: 0.01 }, // 1% success rate
        ],
        withRollback: true,
      });

      // Execute multiple times to test random behavior
      const executions = [];
      for (let i = 0; i < 10; i++) {
        executions.push(
          flakeyWorkflow.execute(`task-${i}`, {}).catch(error => ({
            error: error.message,
            taskId: `task-${i}`,
          }))
        );
      }

      const results = await Promise.all(executions);
      expect(results).toBeDefined();
      expect(results.length).toBe(10);

      // At least some should fail due to low success rates
      const failures = results.filter(r => 'error' in r);
      expect(failures.length).toBeGreaterThan(0);

      const history = flakeyWorkflow.getExecutionHistory();
      expect(history.length).toBe(10);
    });

    it('should handle workflow with zero duration stages', async () => {
      const instantWorkflow = createWorkflowExecutionMock('instant-workflow', {
        stages: [
          { name: 'instant1', agent: 'agent1', duration: 0 },
          { name: 'instant2', agent: 'agent2', duration: 0 },
          { name: 'instant3', agent: 'agent3', duration: 0 },
        ],
        parallelExecution: true,
      });

      const result = await instantWorkflow.execute('instant-task', {});

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.stages.every(stage => stage.status === 'completed')).toBe(true);
    });
  });

  describe('Event System Edge Cases', () => {
    let environment: IntegrationTestEnvironment;

    beforeAll(async () => {
      environment = await createIntegrationTestEnvironment({
        projectName: 'event-edge-cases',
      });
    });

    afterAll(async () => {
      await environment.cleanup();
    });

    it('should handle event system with massive event volume', async () => {
      const events = environment.events;
      events.clearEvents();

      // Generate many events quickly
      for (let i = 0; i < 1000; i++) {
        events.emit('test:event', { index: i, data: `Event ${i}` });
      }

      const allEvents = events.getEvents();
      expect(allEvents.length).toBe(1000);

      const stats = events.getEventStats();
      expect(stats['test:event']).toBe(1000);
    });

    it('should handle waiting for events with timeouts', async () => {
      const events = environment.events;

      // Test timeout on event that never comes
      const timeoutPromise = events.waitForEvent('never:happens', 100);
      await expect(timeoutPromise).rejects.toThrow('Timeout waiting for event: never:happens');

      // Test waiting for multiple events with partial timeout
      const multiEventPromise = events.waitForEvents(['event1', 'event2', 'event3'], 200);

      // Only emit some of the events
      setTimeout(() => {
        events.emit('event1', { data: 'Event 1' });
        events.emit('event2', { data: 'Event 2' });
        // event3 never gets emitted
      }, 50);

      await expect(multiEventPromise).rejects.toThrow('Timeout waiting for events');
    });

    it('should handle rapid event subscribe/unsubscribe', () => {
      const mockEmitter = createMockEventEmitter();

      // Rapidly subscribe and unsubscribe to many events
      for (let i = 0; i < 100; i++) {
        const handler = () => { /* no-op */ };
        mockEmitter.on(`event${i}`, handler);
        mockEmitter.emit(`event${i}`, { index: i });
        mockEmitter.off(`event${i}`, handler);
      }

      const history = mockEmitter.getEventHistory();
      expect(history.length).toBe(100);

      mockEmitter.clearHistory();
      expect(mockEmitter.getEventHistory().length).toBe(0);
    });
  });

  describe('Permission System Edge Cases', () => {
    let environment: IntegrationTestEnvironment;

    beforeAll(async () => {
      environment = await createIntegrationTestEnvironment({
        enablePermissions: true,
      });
    });

    afterAll(async () => {
      await environment.cleanup();
    });

    it('should handle invalid permission operations', async () => {
      const { permissions } = environment;

      // Test with invalid tool names
      await expect(permissions.grantPermission('InvalidTool' as any, '/**')).resolves.not.toThrow();
      await expect(permissions.denyPermission('AnotherInvalidTool' as any)).resolves.not.toThrow();

      // Test with invalid scopes
      await expect(permissions.grantPermission('Read', '')).resolves.not.toThrow();
      await expect(permissions.grantPermission('Read', null as any)).resolves.not.toThrow();

      // Test with invalid permission levels
      await expect(permissions.grantPermission('Read', '/**', 'invalid-level' as any)).resolves.not.toThrow();
    });

    it('should handle rapid permission changes', async () => {
      const { permissions } = environment;

      // Rapidly grant and deny permissions
      for (let i = 0; i < 50; i++) {
        await permissions.grantPermission('Read', `/path/${i}/**`, 'allow-always');
        await permissions.denyPermission('Write', `/path/${i}/**`);
      }

      // Clear all permissions
      await permissions.clearPermissions();

      // The system should handle this without errors
      expect(true).toBe(true);
    });

    it('should handle permission workflows with invalid tools', async () => {
      const { permissions } = environment;

      // Test permission workflow with non-existent tools
      await expect(permissions.simulatePermissionWorkflow('NonExistentTool' as any, '/test/**'))
        .resolves.not.toThrow();
    });
  });

  describe('Utility Function Edge Cases', () => {
    it('should handle waitFor with edge case conditions', async () => {
      let counter = 0;

      // Test condition that throws errors initially
      const flakyCondition = () => {
        counter++;
        if (counter < 3) {
          throw new Error('Condition not ready');
        }
        return true;
      };

      const result = await waitFor(flakyCondition, {
        timeout: 1000,
        interval: 10,
      });

      expect(result).toBe(true);
      expect(counter).toBeGreaterThanOrEqual(3);
    });

    it('should handle retryWithBackoff with immediate success', async () => {
      let attempts = 0;
      const immediateSuccess = async () => {
        attempts++;
        return 'immediate-success';
      };

      const result = await retryWithBackoff(immediateSuccess);
      expect(result).toBe('immediate-success');
      expect(attempts).toBe(1);
    });

    it('should handle retryWithBackoff with zero delay', async () => {
      let attempts = 0;
      const eventualSuccess = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not ready yet');
        }
        return 'eventual-success';
      };

      const result = await retryWithBackoff(eventualSuccess, {
        maxRetries: 5,
        initialDelay: 0,
        maxDelay: 0,
      });

      expect(result).toBe('eventual-success');
      expect(attempts).toBe(3);
    });

    it('should handle measureExecutionTime with async functions', async () => {
      const asyncFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'execution-result';
      };

      const { result, executionTime } = await measureExecutionTime(asyncFunction);

      expect(result).toBe('execution-result');
      expect(executionTime).toBeGreaterThan(90);
      expect(executionTime).toBeLessThan(200);
    });

    it('should handle performance benchmark with many measurements', async () => {
      const benchmark = new PerformanceBenchmark();

      // Add many measurements
      for (let i = 0; i < 100; i++) {
        await benchmark.measure(`operation-${i % 10}`, async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return `result-${i}`;
        });
      }

      const results = benchmark.getResults();
      expect(results.length).toBe(100);

      // Test average calculation
      const avgTime = benchmark.getAverageTime('operation-0');
      expect(avgTime).toBeGreaterThan(0);

      benchmark.clear();
      expect(benchmark.getResults().length).toBe(0);
    });

    it('should handle createTempFile with edge case options', async () => {
      // Test with empty content
      const emptyFile = await createTempFile('', {
        extension: '',
        prefix: '',
      });

      expect(emptyFile).toBeDefined();
      expect(typeof emptyFile).toBe('string');

      // Test with very long content
      const longContent = 'A'.repeat(100000);
      const longFile = await createTempFile(longContent, {
        extension: '.large',
        prefix: 'large-file',
      });

      expect(longFile).toBeDefined();
      expect(longFile).toContain('.large');
    });

    it('should handle createTempDirectory with existing directory conflicts', async () => {
      // Create multiple temp directories with same prefix
      const dirs = await Promise.all([
        createTempDirectory('same-prefix'),
        createTempDirectory('same-prefix'),
        createTempDirectory('same-prefix'),
      ]);

      expect(dirs.length).toBe(3);
      expect(new Set(dirs).size).toBe(3); // All should be unique
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should handle cleanup failures gracefully', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'cleanup-failure-test',
      });

      // Simulate cleanup failure by corrupting the environment
      (env as any).testDir = '/non/existent/path/that/cannot/be/cleaned';

      // Cleanup should not throw even if it fails
      await expect(env.cleanup()).resolves.not.toThrow();
    });

    it('should handle double cleanup calls', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'double-cleanup-test',
      });

      // Call cleanup twice
      await env.cleanup();
      await expect(env.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup with active resources', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'active-resources-test',
        enableBrowser: false,
        enablePermissions: true,
      });

      // Create some active resources
      const task = env.createTask({ description: 'Active task' });
      env.events.emit('test:event', { data: 'active event' });

      // Mock some ongoing operations
      const longRunningPromise = new Promise(resolve => {
        setTimeout(resolve, 1000); // 1 second operation
      });

      // Cleanup should work even with active resources
      const cleanupPromise = env.cleanup();

      await Promise.all([cleanupPromise, longRunningPromise]);
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent environment creation', async () => {
      const envPromises = Array(5).fill(null).map((_, i) =>
        createIntegrationTestEnvironment({
          projectName: `concurrent-env-${i}`,
          mockClaudeAPI: true,
        })
      );

      const environments = await Promise.all(envPromises);

      expect(environments.length).toBe(5);
      environments.forEach(env => {
        expect(env.testDir).toBeDefined();
        expect(env.orchestrator).toBeDefined();
      });

      // Cleanup all environments
      await Promise.all(environments.map(env => env.cleanup()));
    });

    it('should handle concurrent task creation', async () => {
      const env = await createIntegrationTestEnvironment({
        projectName: 'concurrent-task-test',
      });

      const taskPromises = Array(20).fill(null).map((_, i) =>
        Promise.resolve(env.createTask({
          description: `Concurrent task ${i}`,
        }))
      );

      const tasks = await Promise.all(taskPromises);

      expect(tasks.length).toBe(20);
      expect(new Set(tasks.map(t => t.id)).size).toBe(20); // All IDs should be unique

      await env.cleanup();
    });

    it('should handle concurrent mock operations', async () => {
      const orchestratorMock = createAdvancedOrchestratorMock({
        performanceMetrics: true,
        eventTracking: true,
      });

      // Create many tasks concurrently
      const taskPromises = Array(50).fill(null).map((_, i) =>
        orchestratorMock.createTask({
          description: `Concurrent mock task ${i}`,
        })
      );

      const tasks = await Promise.all(taskPromises);

      expect(tasks.length).toBe(50);
      expect(orchestratorMock._getTaskCount()).toBe(50);

      const metrics = orchestratorMock.getMetrics();
      expect(metrics.tasksCreated).toBe(50);

      await orchestratorMock.cleanup();
    });
  });
});

describe('Performance and Stress Testing', () => {
  it('should handle large-scale task creation performance', async () => {
    const env = await createIntegrationTestEnvironment({
      projectName: 'performance-test',
    });

    const { result: tasks, executionTime } = await measureExecutionTime(async () => {
      return Array(1000).fill(null).map((_, i) => env.createTask({
        description: `Performance test task ${i}`,
      }));
    });

    expect(tasks.length).toBe(1000);
    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    console.log(`Created 1000 tasks in ${executionTime.toFixed(2)}ms`);

    await env.cleanup();
  });

  it('should handle large-scale mock operations', async () => {
    const benchmark = new PerformanceBenchmark();

    await benchmark.measure('orchestrator-creation', async () => {
      const mocks = Array(100).fill(null).map((_, i) =>
        createAdvancedOrchestratorMock({
          performanceMetrics: true,
        })
      );

      // Cleanup mocks
      await Promise.all(mocks.map(mock => mock.cleanup()));
    });

    await benchmark.measure('task-mock-creation', async () => {
      Array(1000).fill(null).forEach((_, i) => {
        createAdvancedTaskMock({
          description: `Performance task ${i}`,
        }, {
          withEvents: true,
          withHistory: true,
          withMetrics: true,
        });
      });
    });

    const results = benchmark.getResults();
    expect(results.length).toBe(2);

    console.log('Performance Results:');
    results.forEach(result => {
      console.log(`  ${result.name}: ${result.time.toFixed(2)}ms`);
    });
  });

  it('should handle stress test with many environments', async () => {
    const envCount = 10;
    const { result: environments, executionTime } = await measureExecutionTime(async () => {
      const envPromises = Array(envCount).fill(null).map((_, i) =>
        createIntegrationTestEnvironment({
          projectName: `stress-env-${i}`,
          enableBrowser: false,
          mockClaudeAPI: true,
        })
      );

      return Promise.all(envPromises);
    });

    expect(environments.length).toBe(envCount);
    console.log(`Created ${envCount} environments in ${executionTime.toFixed(2)}ms`);

    // Cleanup all environments
    const { executionTime: cleanupTime } = await measureExecutionTime(async () => {
      await Promise.all(environments.map(env => env.cleanup()));
    });

    console.log(`Cleaned up ${envCount} environments in ${cleanupTime.toFixed(2)}ms`);

    expect(cleanupTime).toBeLessThan(10000); // Should complete within 10 seconds
  });
});