import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { TaskStore } from './store.js';
import type { ApexConfig } from '@apex/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Max Resume Attempts - Performance Tests', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tmpDir: string;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'apex-perf-test-'));

    // Create .apex directory structure
    const apexDir = join(tmpDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    mockConfig = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      daemon: {
        sessionRecovery: {
          enabled: true,
          maxResumeAttempts: 3,
        },
      },
    };

    // Create minimal workflow and agent files
    const workflowContent = `
name: feature
description: Test workflow
stages:
  - name: planning
    agent: planner
    description: Planning stage
`;
    await writeFile(join(apexDir, 'workflows', 'feature.yaml'), workflowContent);

    const agentContent = `---
name: planner
description: Test planner
model: haiku
---
Test instructions
`;
    await writeFile(join(apexDir, 'agents', 'planner.md'), agentContent);

    orchestrator = new ApexOrchestrator({ projectPath: tmpDir });
    await orchestrator.initialize();
    store = (orchestrator as any).store;
  });

  afterEach(async () => {
    if (orchestrator) {
      await (orchestrator as any).shutdown?.();
    }
    if (tmpDir && existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('High-volume resume attempts', () => {
    it('should handle 100 tasks with resume attempts efficiently', async () => {
      const mockQuery = vi.mocked(query);

      // Mock to always fail and cause pauses
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Session limit reached');
        },
      } as unknown as ReturnType<typeof query>));

      const taskCount = 100;
      const tasks = [];

      // Create many tasks
      const createStart = performance.now();
      for (let i = 0; i < taskCount; i++) {
        const task = await orchestrator.createTask({
          description: `Performance test task ${i}`,
          workflow: 'feature',
        });

        // Set up for resume
        await store.updateTask(task.id, {
          status: 'paused',
          pauseReason: 'session_limit',
          pausedAt: new Date(),
          updatedAt: new Date(),
        });

        await store.createCheckpoint(task.id, {
          checkpointId: `perf-test-${i}`,
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        tasks.push(task);
      }
      const createEnd = performance.now();

      console.log(`Created ${taskCount} tasks in ${createEnd - createStart}ms`);

      // Resume all tasks multiple times
      const resumeStart = performance.now();

      for (const task of tasks) {
        // Resume until failure (should be 4 attempts: 1->2->3->4->fail)
        let attempts = 0;
        let canResume = true;

        while (canResume && attempts < 5) {
          canResume = await orchestrator.resumeTask(task.id);
          attempts++;
        }
      }

      const resumeEnd = performance.now();
      const totalResumeTime = resumeEnd - resumeStart;

      console.log(`Processed ${taskCount} tasks with resume attempts in ${totalResumeTime}ms`);

      // Performance expectations
      expect(totalResumeTime).toBeLessThan(10000); // Less than 10 seconds
      expect(createEnd - createStart).toBeLessThan(5000); // Less than 5 seconds to create

      // Verify all tasks failed with correct attempt counts
      for (const task of tasks) {
        const finalTask = await store.getTask(task.id);
        expect(finalTask?.status).toBe('failed');
        expect(finalTask?.resumeAttempts).toBe(4);
      }
    });

    it('should handle concurrent resume attempts on same task efficiently', async () => {
      const mockQuery = vi.mocked(query);

      // Mock with delay to simulate race conditions
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
          throw new Error('Test failure');
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Concurrent resume test',
        workflow: 'feature',
      });

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'concurrent-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      const concurrentCount = 50;
      const start = performance.now();

      // Launch many concurrent resume attempts
      const resumePromises = Array(concurrentCount).fill(null).map(() =>
        orchestrator.resumeTask(task.id).catch(() => false)
      );

      const results = await Promise.all(resumePromises);
      const end = performance.now();
      const duration = end - start;

      console.log(`${concurrentCount} concurrent resumes completed in ${duration}ms`);

      // Should complete in reasonable time despite contention
      expect(duration).toBeLessThan(5000); // Less than 5 seconds

      // Should have some failures due to max attempts
      const failures = results.filter(result => result === false);
      expect(failures.length).toBeGreaterThan(0);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
    });

    it('should maintain performance with large conversation histories', async () => {
      const mockQuery = vi.mocked(query);

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Session limit reached');
        },
      } as unknown as ReturnType<typeof query>));

      // Create very large conversation
      const largeConversation = [];
      for (let i = 0; i < 1000; i++) {
        largeConversation.push({
          type: 'user' as const,
          content: [{
            type: 'text' as const,
            text: `Long message ${i}: ${'x'.repeat(500)}` // ~500KB+ total
          }],
        });
      }

      const task = await orchestrator.createTask({
        description: 'Large conversation performance test',
        workflow: 'feature',
        conversation: largeConversation,
      });

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'session_limit',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      // Create checkpoint with large conversation state
      const checkpointStart = performance.now();
      await store.createCheckpoint(task.id, {
        checkpointId: 'large-conv-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: largeConversation,
        metadata: {},
      });
      const checkpointEnd = performance.now();

      console.log(`Checkpoint with large conversation saved in ${checkpointEnd - checkpointStart}ms`);

      const resumeStart = performance.now();

      // Resume multiple times
      let attempts = 0;
      let canResume = true;

      while (canResume && attempts < 5) {
        canResume = await orchestrator.resumeTask(task.id);
        attempts++;
      }

      const resumeEnd = performance.now();
      const resumeTime = resumeEnd - resumeStart;

      console.log(`Resume attempts with large conversation completed in ${resumeTime}ms`);

      // Should handle large data without significant performance degradation
      expect(checkpointEnd - checkpointStart).toBeLessThan(1000); // Less than 1 second
      expect(resumeTime).toBeLessThan(2000); // Less than 2 seconds total

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.resumeAttempts).toBe(4);
    });
  });

  describe('Memory usage under load', () => {
    it('should not leak memory during repeated resume attempts', async () => {
      const mockQuery = vi.mocked(query);

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Memory leak test failure');
        },
      } as unknown as ReturnType<typeof query>));

      const initialMemory = process.memoryUsage();

      // Create and process many tasks with resume attempts
      const batches = 10;
      const tasksPerBatch = 20;

      for (let batch = 0; batch < batches; batch++) {
        const batchTasks = [];

        // Create batch of tasks
        for (let i = 0; i < tasksPerBatch; i++) {
          const task = await orchestrator.createTask({
            description: `Memory test batch ${batch} task ${i}`,
            workflow: 'feature',
          });

          await store.updateTask(task.id, {
            status: 'paused',
            pauseReason: 'test',
            pausedAt: new Date(),
            updatedAt: new Date(),
          });

          await store.createCheckpoint(task.id, {
            checkpointId: `memory-test-${batch}-${i}`,
            stage: 'planning',
            stageIndex: 0,
            conversationState: [],
            metadata: {},
          });

          batchTasks.push(task);
        }

        // Process all tasks in batch
        for (const task of batchTasks) {
          let attempts = 0;
          let canResume = true;

          while (canResume && attempts < 5) {
            canResume = await orchestrator.resumeTask(task.id);
            attempts++;
          }
        }

        // Check memory usage periodically
        if (batch % 3 === 0) {
          const currentMemory = process.memoryUsage();
          const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;

          console.log(`After batch ${batch}: heap increase = ${Math.round(heapIncrease / 1024 / 1024)}MB`);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage();
      const totalHeapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Total heap increase: ${Math.round(totalHeapIncrease / 1024 / 1024)}MB`);

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(totalHeapIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Database performance under load', () => {
    it('should handle rapid database updates efficiently', async () => {
      const task = await orchestrator.createTask({
        description: 'DB performance test',
        workflow: 'feature',
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'db-perf-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      const updateCount = 1000;
      const start = performance.now();

      // Perform many rapid resume attempts counter updates
      for (let i = 0; i < updateCount; i++) {
        await store.updateTask(task.id, {
          resumeAttempts: i,
          updatedAt: new Date(),
        });
      }

      const end = performance.now();
      const duration = end - start;

      console.log(`${updateCount} database updates completed in ${duration}ms`);

      // Should handle updates efficiently
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      expect(duration / updateCount).toBeLessThan(10); // Less than 10ms per update on average

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.resumeAttempts).toBe(updateCount - 1);
    });

    it('should handle concurrent database operations without corruption', async () => {
      const tasks = [];

      // Create multiple tasks
      for (let i = 0; i < 20; i++) {
        const task = await orchestrator.createTask({
          description: `Concurrent DB test task ${i}`,
          workflow: 'feature',
        });

        await store.createCheckpoint(task.id, {
          checkpointId: `concurrent-db-${i}`,
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        tasks.push(task);
      }

      const start = performance.now();

      // Launch concurrent update operations
      const updatePromises = tasks.map(task =>
        Promise.all([
          store.updateTask(task.id, { resumeAttempts: 1, updatedAt: new Date() }),
          store.updateTask(task.id, { resumeAttempts: 2, updatedAt: new Date() }),
          store.updateTask(task.id, { resumeAttempts: 3, updatedAt: new Date() }),
        ])
      );

      await Promise.all(updatePromises);

      const end = performance.now();
      const duration = end - start;

      console.log(`Concurrent database operations completed in ${duration}ms`);

      // Should complete efficiently without deadlocks
      expect(duration).toBeLessThan(3000); // Less than 3 seconds

      // Verify data integrity - all tasks should have resumeAttempts = 3
      for (const task of tasks) {
        const finalTask = await store.getTask(task.id);
        expect(finalTask?.resumeAttempts).toBe(3);
        expect(finalTask?.updatedAt).toBeDefined();
      }
    });
  });

  describe('Scalability limits', () => {
    it('should handle maximum realistic resume attempts count', async () => {
      // Test with very high resume attempts to verify no integer overflow
      const task = await orchestrator.createTask({
        description: 'High resume attempts test',
        workflow: 'feature',
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'high-attempts-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      const highValue = 999999;

      const start = performance.now();

      // Set very high resume attempts value
      await store.updateTask(task.id, {
        resumeAttempts: highValue,
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      // Attempt resume (should fail due to high value > limit)
      const result = await orchestrator.resumeTask(task.id);

      const end = performance.now();
      const duration = end - start;

      console.log(`High value resume attempt handled in ${duration}ms`);

      // Should handle high values efficiently
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(result).toBe(false); // Should fail due to exceeding limit

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.resumeAttempts).toBe(highValue + 1);
      expect(finalTask?.status).toBe('failed');
    });

    it('should maintain performance with many concurrent orchestrators', async () => {
      // Test with multiple orchestrator instances (simulating multiple processes)
      const orchestratorCount = 5;
      const orchestrators: ApexOrchestrator[] = [];

      try {
        // Create multiple orchestrator instances
        for (let i = 0; i < orchestratorCount; i++) {
          const orch = new ApexOrchestrator({ projectPath: tmpDir });
          await orch.initialize();
          orchestrators.push(orch);
        }

        const start = performance.now();

        // Each orchestrator creates and processes tasks
        const taskPromises = orchestrators.map(async (orch, index) => {
          const task = await orch.createTask({
            description: `Multi-orchestrator test ${index}`,
            workflow: 'feature',
          });

          await (orch as any).store.updateTask(task.id, {
            status: 'paused',
            pauseReason: 'test',
            pausedAt: new Date(),
            updatedAt: new Date(),
          });

          await (orch as any).store.createCheckpoint(task.id, {
            checkpointId: `multi-orch-${index}`,
            stage: 'planning',
            stageIndex: 0,
            conversationState: [],
            metadata: {},
          });

          // Resume until failure
          let attempts = 0;
          let canResume = true;

          while (canResume && attempts < 5) {
            canResume = await orch.resumeTask(task.id);
            attempts++;
          }

          return { orchestrator: orch, taskId: task.id };
        });

        const results = await Promise.all(taskPromises);
        const end = performance.now();
        const duration = end - start;

        console.log(`${orchestratorCount} orchestrators processed tasks in ${duration}ms`);

        // Should handle multiple orchestrators efficiently
        expect(duration).toBeLessThan(10000); // Less than 10 seconds

        // Verify all tasks completed with proper state
        for (const { orchestrator: orch, taskId } of results) {
          const task = await (orch as any).store.getTask(taskId);
          expect(task?.status).toBe('failed');
          expect(task?.resumeAttempts).toBe(4);
        }

      } finally {
        // Cleanup orchestrators
        for (const orch of orchestrators) {
          await (orch as any).shutdown?.();
        }
      }
    });
  });
});