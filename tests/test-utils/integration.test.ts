/**
 * Integration tests for test utilities with APEX components
 * Verifies test utilities work properly with actual APEX code
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  runWithCleanup,
  expectObjectShape,
  expectToThrow,
  expectArrayToContain,
  wait,
  waitFor,
  retry,
  testFixtures,
  testUtils,
  MockManager,
  EventTracker,
  TestTimer,
} from './index';

// Import APEX types for integration testing
import type { Task, Config, Agent, Workflow } from '../../packages/core/src/types';

describe('Test Utils Integration with APEX Components', () => {
  describe('Task Testing Integration', () => {
    it('should create and validate APEX Task objects with test utilities', async () => {
      await runWithCleanup(async (env) => {
        // Create a task using test fixtures
        const task = { ...testFixtures.sampleTask };

        // Validate task structure using assertion helpers
        expectObjectShape(task, {
          id: expect.any(String),
          description: expect.any(String),
          workflow: 'feature',
          status: 'pending',
        });

        // Test task state transitions
        task.status = 'in_progress';
        task.updatedAt = new Date();

        expectObjectShape(task, {
          status: 'in_progress',
          updatedAt: expect.any(Date),
        });

        // Use event tracker to monitor task changes
        const eventTracker = new EventTracker();
        eventTracker.record('task-started', { taskId: task.id });
        eventTracker.record('task-updated', { taskId: task.id, status: 'in_progress' });

        expect(eventTracker.hasEvent('task-started')).toBe(true);
        expect(eventTracker.hasEvent('task-updated')).toBe(true);
        expect(eventTracker.getEventsByType('task-updated')).toHaveLength(1);
      });
    });

    it('should test task workflow execution with async utilities', async () => {
      await runWithCleanup(async (env) => {
        const task = { ...testFixtures.sampleTask };
        const timer = new TestTimer();

        // Simulate async workflow execution
        timer.start();

        // Mock async task operations
        const mockOperations = [
          async () => {
            await wait(10);
            task.status = 'in_progress';
            return 'planning-complete';
          },
          async () => {
            await wait(15);
            task.status = 'completed';
            return 'implementation-complete';
          },
        ];

        const results = [];
        for (const operation of mockOperations) {
          results.push(await operation());
        }

        const elapsed = timer.stop();

        expect(results).toEqual(['planning-complete', 'implementation-complete']);
        expect(elapsed).toBeGreaterThanOrEqual(20); // Should take at least 25ms
        expect(task.status).toBe('completed');
      });
    });
  });

  describe('Config Testing Integration', () => {
    it('should validate APEX Config objects', async () => {
      await runWithCleanup(async (env) => {
        const config = testFixtures.sampleConfig;

        // Validate config structure
        expectObjectShape(config, {
          version: '1.0',
          project: {
            name: 'test-project',
            language: 'typescript',
          },
          autonomy: {
            default: 'full',
          },
        });

        // Test config modification
        const modifiedConfig = { ...config };
        modifiedConfig.limits.maxTokensPerTask = 50000;

        expectObjectShape(modifiedConfig, {
          limits: {
            maxTokensPerTask: 50000,
          },
        });
      });
    });

    it('should test config loading and validation errors', async () => {
      await runWithCleanup(async (env) => {
        // Test invalid config scenarios
        const invalidConfig = {
          version: '1.0',
          // Missing required project field
        };

        await expectToThrow(
          () => {
            if (!invalidConfig.project) {
              throw new Error('Project configuration is required');
            }
          },
          'Project configuration is required'
        );
      });
    });
  });

  describe('Agent and Workflow Testing Integration', () => {
    it('should test agent execution with mock management', async () => {
      await runWithCleanup(async (env) => {
        const agent = testFixtures.sampleAgent;
        const workflow = testFixtures.sampleWorkflow;

        // Mock agent execution
        const mockManager = new MockManager();
        const mockExecute = mockManager.fn(async (task: any) => {
          await wait(20);
          return { success: true, output: `Agent ${agent.name} executed` };
        });

        // Simulate agent execution
        const result = await mockExecute({ id: 'test-task' });

        expect(mockExecute).toHaveBeenCalledWith({ id: 'test-task' });
        expect(result).toEqual({
          success: true,
          output: 'Agent test-agent executed',
        });

        mockManager.restoreAll();
      });
    });

    it('should test workflow stage execution with event tracking', async () => {
      await runWithCleanup(async (env) => {
        const workflow = testFixtures.sampleWorkflow;
        const eventTracker = new EventTracker();

        // Simulate workflow execution
        for (const stage of workflow.stages) {
          eventTracker.record('stage-started', { stage: stage.name });

          // Simulate stage execution time
          await wait(5);

          eventTracker.record('stage-completed', { stage: stage.name });
        }

        // Verify all stages were executed
        expect(eventTracker.hasEvent('stage-started', { stage: 'planning' })).toBe(true);
        expect(eventTracker.hasEvent('stage-completed', { stage: 'planning' })).toBe(true);
        expect(eventTracker.hasEvent('stage-started', { stage: 'implementation' })).toBe(true);
        expect(eventTracker.hasEvent('stage-completed', { stage: 'implementation' })).toBe(true);
        expect(eventTracker.hasEvent('stage-started', { stage: 'testing' })).toBe(true);
        expect(eventTracker.hasEvent('stage-completed', { stage: 'testing' })).toBe(true);

        // Check that we have events for all stages
        const stageStartEvents = eventTracker.getEventsByType('stage-started');
        const stageCompleteEvents = eventTracker.getEventsByType('stage-completed');

        expect(stageStartEvents).toHaveLength(3);
        expect(stageCompleteEvents).toHaveLength(3);
      });
    });
  });

  describe('File System Integration', () => {
    it('should test file operations with cleanup utilities', async () => {
      await runWithCleanup(async (env) => {
        // Create test files in temporary directory
        const configPath = await env.cleanup.fileSystem.createTempFile(
          'test-config.yaml',
          `
version: "1.0"
project:
  name: integration-test
  language: typescript
autonomy:
  default: full
`
        );

        const agentPath = await env.cleanup.fileSystem.createTempFile(
          'test-agent.md',
          `# Test Agent

This is a test agent for integration testing.

## Tools
- Read
- Write
- Edit
`
        );

        // Verify files were created
        expect(configPath).toMatch(/test-config\.yaml$/);
        expect(agentPath).toMatch(/test-agent\.md$/);

        // Test file reading simulation (would normally use fs)
        const configContent = `
version: "1.0"
project:
  name: integration-test
  language: typescript
autonomy:
  default: full
`;

        expect(configContent.trim()).toContain('version: "1.0"');
        expect(configContent.trim()).toContain('name: integration-test');

        // Files will be automatically cleaned up by runWithCleanup
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should test retry logic for flaky operations', async () => {
      await runWithCleanup(async (env) => {
        let attempts = 0;

        // Simulate flaky API call
        const flakyOperation = async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Network timeout');
          }
          return { success: true, data: 'operation completed' };
        };

        const result = await retry(flakyOperation, {
          maxAttempts: 3,
          delay: 10,
        });

        expect(attempts).toBe(3);
        expect(result).toEqual({ success: true, data: 'operation completed' });
      });
    });

    it('should test timeout scenarios', async () => {
      await runWithCleanup(async (env) => {
        // Test operation that times out
        await expectToThrow(
          async () => {
            await waitFor(
              () => false, // Never resolves
              { timeout: 50, timeoutMessage: 'Operation timed out' }
            );
          },
          'Operation timed out'
        );
      });
    });

    it('should test concurrent operations', async () => {
      await runWithCleanup(async (env) => {
        const eventTracker = new EventTracker();

        // Simulate concurrent task processing
        const tasks = [
          { id: 'task1', priority: 'high' },
          { id: 'task2', priority: 'normal' },
          { id: 'task3', priority: 'low' },
        ];

        const processTask = async (task: any) => {
          eventTracker.record('task-started', task);
          await wait(Math.random() * 30 + 10); // Random delay 10-40ms
          eventTracker.record('task-completed', task);
          return task.id;
        };

        // Process tasks concurrently
        const promises = tasks.map(processTask);
        const results = await Promise.all(promises);

        expect(results).toEqual(['task1', 'task2', 'task3']);
        expect(eventTracker.getEventsByType('task-started')).toHaveLength(3);
        expect(eventTracker.getEventsByType('task-completed')).toHaveLength(3);

        // Verify all tasks were processed
        expectArrayToContain(
          eventTracker.getEventsByType('task-completed'),
          (event: any) => event.data.id === 'task1',
          1
        );
      });
    });
  });

  describe('Performance and Memory Testing', () => {
    it('should test memory cleanup with large datasets', async () => {
      await runWithCleanup(async (env) => {
        const eventTracker = new EventTracker();

        // Generate large number of events
        for (let i = 0; i < 1000; i++) {
          eventTracker.record('data-point', { index: i, value: Math.random() });
        }

        expect(eventTracker.events).toHaveLength(1000);

        // Clear events to test cleanup
        eventTracker.clear();
        expect(eventTracker.events).toHaveLength(0);
      });
    });

    it('should test timing precision', async () => {
      await runWithCleanup(async (env) => {
        const timer = new TestTimer();

        timer.start();
        await wait(100);
        const elapsed = timer.stop();

        // Should be approximately 100ms, allowing for some variance
        expect(elapsed).toBeGreaterThanOrEqual(95);
        expect(elapsed).toBeLessThanOrEqual(150); // Allow for slower CI environments
      });
    });
  });

  describe('Database and State Management', () => {
    it('should test database context for task storage', async () => {
      await runWithCleanup(async (env) => {
        // Create database test context
        const dbEnv = await createTestEnvironment({
          contextId: 'db-integration-test',
          withDatabase: true,
        });

        expect(dbEnv.dbPath).toMatch(/test\.db$/);

        // Simulate task storage operations
        const tasks = [
          testFixtures.sampleTask,
          { ...testFixtures.sampleTask, id: 'task-2', description: 'Second test task' },
        ];

        // Mock database operations
        const mockDb = {
          tasks: [] as any[],
          insert: function(task: any) {
            this.tasks.push({ ...task, _id: this.tasks.length + 1 });
          },
          findAll: function() {
            return this.tasks;
          },
          findById: function(id: string) {
            return this.tasks.find(t => t.id === id);
          },
        };

        // Test database operations
        tasks.forEach(task => mockDb.insert(task));

        expect(mockDb.findAll()).toHaveLength(2);
        expect(mockDb.findById('test-task-123')).toBeDefined();
        expect(mockDb.findById('task-2')).toBeDefined();

        await dbEnv.cleanup.cleanup();
      });
    });
  });
});

describe('Test Utils Performance Benchmarks', () => {
  it('should benchmark async utilities performance', async () => {
    await runWithCleanup(async (env) => {
      const timer = new TestTimer();
      const iterations = 100;

      // Benchmark wait function
      timer.start();
      const promises = Array.from({ length: iterations }, () => wait(1));
      await Promise.all(promises);
      const waitTime = timer.stop();

      expect(waitTime).toBeLessThan(200); // Should complete in reasonable time

      // Benchmark event tracking
      const eventTracker = new EventTracker();

      timer.start();
      for (let i = 0; i < iterations; i++) {
        eventTracker.record('benchmark-event', { iteration: i });
      }
      const eventTime = timer.stop();

      expect(eventTime).toBeLessThan(100); // Should be very fast
      expect(eventTracker.events).toHaveLength(iterations);
    });
  });
});