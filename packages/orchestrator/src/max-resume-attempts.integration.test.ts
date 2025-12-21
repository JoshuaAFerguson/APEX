import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { TaskStore } from './store.js';
import type { ApexConfig, AgentDefinition, WorkflowDefinition } from '@apex/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Max Resume Attempts - Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tmpDir: string;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    // Create temporary directory for testing
    tmpDir = await mkdtemp(join(tmpdir(), 'apex-integration-test-'));

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

    // Create test workflow file
    const workflowContent = `
name: feature
description: Standard feature development workflow
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement the feature
`;
    await writeFile(join(apexDir, 'workflows', 'feature.yaml'), workflowContent);

    // Create test agent files
    const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: haiku
---
You are a planning agent that creates implementation plans.
`;
    await writeFile(join(apexDir, 'agents', 'planner.md'), plannerContent);

    const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: haiku
---
You are a developer agent that implements code changes.
`;
    await writeFile(join(apexDir, 'agents', 'developer.md'), developerContent);

    // Initialize orchestrator
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

  describe('Real workflow execution with resume attempts', () => {
    it('should track resume attempts during actual workflow execution failures', async () => {
      let callCount = 0;
      const mockQuery = vi.mocked(query);

      // Mock query to simulate repeated session limit errors
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          if (callCount <= 3) {
            // Simulate session limit error that causes checkpoint save and pause
            yield {
              type: 'error',
              error: new Error('Session limit reached: Context window utilization is 85%')
            };
            throw new Error('Session limit reached: Context window utilization is 85%');
          } else {
            // Eventually succeed
            yield { type: 'text', content: 'Task completed successfully' };
          }
        },
      } as unknown as ReturnType<typeof query>));

      // Create a task
      const task = await orchestrator.createTask({
        description: 'Add user authentication feature',
        workflow: 'feature',
      });

      expect(task.resumeAttempts).toBe(0);

      // Execute task - should fail and create checkpoint
      try {
        await orchestrator.executeTask(task.id);
      } catch (error) {
        // Expected to fail due to session limit
        expect((error as Error).message).toContain('Session limit reached');
      }

      // Verify task is paused with checkpoint
      let currentTask = await store.getTask(task.id);
      expect(currentTask?.status).toBe('paused');
      expect(currentTask?.pauseReason).toBe('session_limit');

      // Resume task multiple times until it hits the limit
      for (let i = 1; i <= 3; i++) {
        const resumeResult = await orchestrator.resumeTask(task.id);

        currentTask = await store.getTask(task.id);

        if (i < 3) {
          // First two resumes should increment counter but still fail
          expect(currentTask?.resumeAttempts).toBe(i);
          expect(currentTask?.status).toBe('paused');
        } else {
          // Third resume should fail due to max attempts exceeded
          expect(resumeResult).toBe(false);
          expect(currentTask?.resumeAttempts).toBe(4);
          expect(currentTask?.status).toBe('failed');
          expect(currentTask?.error).toContain('Maximum resume attempts exceeded (4/3)');
        }
      }

      // Verify final state
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.resumeAttempts).toBe(4);
      expect(finalTask?.error).toContain('Breaking the task into smaller subtasks');
    });

    it('should reset resume counter when task completes successfully after retries', async () => {
      let callCount = 0;
      const mockQuery = vi.mocked(query);

      // Mock query to fail twice, then succeed
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          if (callCount <= 2) {
            // First two calls simulate session limit
            throw new Error('Session limit reached: Context window utilization is 85%');
          } else {
            // Third call succeeds
            yield { type: 'text', content: 'Planning completed successfully' };
            yield { type: 'text', content: 'Implementation completed successfully' };
          }
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Simple feature task',
        workflow: 'feature',
      });

      // Execute and fail first time
      try {
        await orchestrator.executeTask(task.id);
      } catch {
        // Expected to fail
      }

      // Resume first time - should fail again
      await orchestrator.resumeTask(task.id);

      // Check counter is incremented
      let currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(1);

      // Resume second time - should succeed
      const resumeResult = await orchestrator.resumeTask(task.id);
      expect(resumeResult).toBe(true);

      // Verify task completed and counter reset
      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('completed');
      expect(finalTask?.resumeAttempts).toBe(0); // Should be reset on completion
    });
  });

  describe('Daemon integration', () => {
    it('should respect max resume attempts when daemon auto-resumes tasks', async () => {
      const mockQuery = vi.mocked(query);

      // Always fail to simulate persistent issue
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Session limit reached: Context window utilization is 90%');
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Daemon resume test',
        workflow: 'feature',
      });

      // Set task to be paused with resumeAfter date in the past
      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'session_limit',
        pausedAt: new Date(),
        resumeAfter: new Date(Date.now() - 1000), // 1 second ago
        resumeAttempts: 2, // Close to limit
        updatedAt: new Date(),
      });

      // Create checkpoint to enable resume
      await store.createCheckpoint(task.id, {
        checkpointId: 'auto-resume-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: { pauseReason: 'session_limit' },
      });

      // Start daemon with short poll interval
      await orchestrator.startTaskRunner({ pollIntervalMs: 50 });

      // Wait for daemon to process
      await new Promise(resolve => setTimeout(resolve, 200));

      // Stop daemon
      orchestrator.stopTaskRunner();

      // Verify task was failed due to max attempts
      const processedTask = await store.getTask(task.id);
      expect(processedTask?.status).toBe('failed');
      expect(processedTask?.resumeAttempts).toBe(3);
      expect(processedTask?.error).toContain('Maximum resume attempts exceeded');
    });
  });

  describe('Concurrent resume attempts', () => {
    it('should handle concurrent resume attempts safely', async () => {
      const mockQuery = vi.mocked(query);

      // Mock to simulate quick failures
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Rate limit exceeded');
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Concurrent resume test',
        workflow: 'feature',
      });

      // Create checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'concurrent-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Set task as paused
      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'rate_limit',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      // Launch multiple concurrent resume attempts
      const resumePromises = Array(5).fill(null).map(() =>
        orchestrator.resumeTask(task.id).catch(() => false)
      );

      const results = await Promise.all(resumePromises);

      // At least one should fail due to max attempts
      expect(results.some(result => result === false)).toBe(true);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.resumeAttempts).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Subtask resume attempts', () => {
    it('should track resume attempts independently for subtasks', async () => {
      const mockQuery = vi.mocked(query);

      // Mock to fail consistently
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Session limit reached');
        },
      } as unknown as ReturnType<typeof query>));

      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task with subtasks',
        workflow: 'feature',
      });

      // Decompose into subtasks
      const subtasks = await orchestrator.decomposeTask(parentTask.id, [
        { description: 'Subtask 1' },
        { description: 'Subtask 2' },
      ]);

      // Each subtask should have independent resume tracking
      for (const subtask of subtasks) {
        // Create checkpoint for each subtask
        await store.createCheckpoint(subtask.id, {
          checkpointId: `checkpoint-${subtask.id}`,
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        // Set as paused
        await store.updateTask(subtask.id, {
          status: 'paused',
          pauseReason: 'session_limit',
          pausedAt: new Date(),
          updatedAt: new Date(),
        });

        // Resume multiple times until failure
        let resumeCount = 0;
        let canResume = true;

        while (canResume && resumeCount < 5) {
          canResume = await orchestrator.resumeTask(subtask.id);
          resumeCount++;
        }

        // Each subtask should fail independently at max attempts
        const finalSubtask = await store.getTask(subtask.id);
        expect(finalSubtask?.status).toBe('failed');
        expect(finalSubtask?.resumeAttempts).toBe(4);
      }
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle maxResumeAttempts = 0 (no retries allowed)', async () => {
      // Create orchestrator with no retries allowed
      const zeroRetriesConfig: ApexConfig = {
        ...mockConfig,
        daemon: {
          sessionRecovery: {
            enabled: true,
            maxResumeAttempts: 0,
          },
        },
      };

      const zeroRetriesDir = await mkdtemp(join(tmpdir(), 'apex-zero-retries-'));

      try {
        // Set up zero-retries environment
        const apexDir = join(zeroRetriesDir, '.apex');
        await mkdir(apexDir, { recursive: true });
        await mkdir(join(apexDir, 'agents'), { recursive: true });
        await mkdir(join(apexDir, 'workflows'), { recursive: true });

        // Copy workflow and agent files
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

        const zeroRetriesOrchestrator = new ApexOrchestrator({ projectPath: zeroRetriesDir });
        await zeroRetriesOrchestrator.initialize();

        const task = await zeroRetriesOrchestrator.createTask({
          description: 'Zero retries test',
          workflow: 'feature',
        });

        // Create checkpoint to enable resume
        await (zeroRetriesOrchestrator as any).store.createCheckpoint(task.id, {
          checkpointId: 'zero-retries-test',
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        // Set as paused
        await (zeroRetriesOrchestrator as any).store.updateTask(task.id, {
          status: 'paused',
          pauseReason: 'test',
          pausedAt: new Date(),
          updatedAt: new Date(),
        });

        // First resume attempt should fail immediately
        const result = await zeroRetriesOrchestrator.resumeTask(task.id);
        expect(result).toBe(false);

        const finalTask = await (zeroRetriesOrchestrator as any).store.getTask(task.id);
        expect(finalTask?.status).toBe('failed');
        expect(finalTask?.resumeAttempts).toBe(1);
        expect(finalTask?.error).toContain('Maximum resume attempts exceeded (1/0)');

        await (zeroRetriesOrchestrator as any).shutdown?.();
      } finally {
        await rm(zeroRetriesDir, { recursive: true, force: true });
      }
    });

    it('should handle very high maxResumeAttempts values', async () => {
      // Create orchestrator with high retry limit
      const highRetriesConfig: ApexConfig = {
        ...mockConfig,
        daemon: {
          sessionRecovery: {
            enabled: true,
            maxResumeAttempts: 1000,
          },
        },
      };

      const highRetriesDir = await mkdtemp(join(tmpdir(), 'apex-high-retries-'));

      try {
        // Set up environment
        const apexDir = join(highRetriesDir, '.apex');
        await mkdir(apexDir, { recursive: true });
        await mkdir(join(apexDir, 'agents'), { recursive: true });
        await mkdir(join(apexDir, 'workflows'), { recursive: true });

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

        const highRetriesOrchestrator = new ApexOrchestrator({ projectPath: highRetriesDir });
        await highRetriesOrchestrator.initialize();

        const task = await highRetriesOrchestrator.createTask({
          description: 'High retries test',
          workflow: 'feature',
        });

        // Set resume attempts to 999 (just under limit)
        await (highRetriesOrchestrator as any).store.updateTask(task.id, {
          resumeAttempts: 999,
          status: 'paused',
          pauseReason: 'test',
          pausedAt: new Date(),
          updatedAt: new Date(),
        });

        // Create checkpoint
        await (highRetriesOrchestrator as any).store.createCheckpoint(task.id, {
          checkpointId: 'high-retries-test',
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        // Should still allow one more resume
        const result = await highRetriesOrchestrator.resumeTask(task.id);
        expect(result).toBe(false); // Fails due to execution, not limits

        // But should increment properly
        const finalTask = await (highRetriesOrchestrator as any).store.getTask(task.id);
        expect(finalTask?.resumeAttempts).toBe(1000);
        expect(finalTask?.status).toBe('failed');
        expect(finalTask?.error).toContain('Maximum resume attempts exceeded (1000/1000)');

        await (highRetriesOrchestrator as any).shutdown?.();
      } finally {
        await rm(highRetriesDir, { recursive: true, force: true });
      }
    });
  });

  describe('Performance under load', () => {
    it('should handle many resume attempts efficiently', async () => {
      const start = performance.now();

      const task = await orchestrator.createTask({
        description: 'Performance test task',
        workflow: 'feature',
      });

      // Set up for rapid resume attempts
      await store.createCheckpoint(task.id, {
        checkpointId: 'perf-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      // Attempt rapid resumes until limit
      let attempts = 0;
      let canResume = true;

      while (canResume && attempts < 10) {
        canResume = await orchestrator.resumeTask(task.id);
        attempts++;
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      expect(attempts).toBe(4); // 3 successful + 1 failed

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.resumeAttempts).toBe(4);
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle database errors gracefully during resume attempt tracking', async () => {
      const task = await orchestrator.createTask({
        description: 'Database error test',
        workflow: 'feature',
      });

      // Create checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'db-error-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Mock database error on updateTask
      const originalUpdateTask = store.updateTask;
      let errorCount = 0;

      vi.spyOn(store, 'updateTask').mockImplementation(async (taskId, updates) => {
        errorCount++;
        if (errorCount === 1 && updates.resumeAttempts !== undefined) {
          throw new Error('Database connection lost');
        }
        return originalUpdateTask.call(store, taskId, updates);
      });

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      // Resume should handle database error gracefully
      const result = await orchestrator.resumeTask(task.id);

      // Should fail due to database error, but not crash
      expect(result).toBe(false);

      // Task should remain in paused state since update failed
      const taskAfterError = await store.getTask(task.id);
      expect(taskAfterError?.status).toBe('paused');
    });
  });
});