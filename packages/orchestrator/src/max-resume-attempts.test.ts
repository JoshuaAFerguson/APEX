import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { TaskStore } from './store.js';
import type { ApexConfig, Task, TaskStatus } from '@apex/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('Max Resume Attempts - Infinite Loop Prevention', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tmpDir: string;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    // Create temporary directory for testing
    tmpDir = await mkdtemp(join(tmpdir(), 'apex-test-'));

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
          maxResumeAttempts: 3, // Use default value of 3 for tests
        },
      },
    };

    // Initialize orchestrator with mock config
    orchestrator = new ApexOrchestrator(tmpDir, mockConfig);
    await orchestrator.init();
    store = (orchestrator as any).store;
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tmpDir && existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Resume attempts increment', () => {
    it('should increment resumeAttempts counter on each resumeTask call', async () => {
      // Create a task
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      // Create a checkpoint to enable resume
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Mock the workflow loading to avoid file system dependencies
      const mockLoadWorkflow = vi.fn().mockResolvedValue({
        name: 'test-workflow',
        description: 'Test workflow',
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Plan the task',
            maxRetries: 2,
          },
        ],
      });

      // Mock the workflow module
      vi.doMock('@apex/core', async () => {
        const actual = await vi.importActual('@apex/core');
        return {
          ...actual,
          loadWorkflow: mockLoadWorkflow,
        };
      });

      // Get initial task state
      let currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(0);

      // First resume - should increment to 1
      try {
        await orchestrator.resumeTask(task.id);
      } catch {
        // Ignore execution errors, we're just testing the counter
      }

      currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(1);

      // Second resume - should increment to 2
      try {
        await orchestrator.resumeTask(task.id);
      } catch {
        // Ignore execution errors, we're just testing the counter
      }

      currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(2);

      // Third resume - should increment to 3
      try {
        await orchestrator.resumeTask(task.id);
      } catch {
        // Ignore execution errors, we're just testing the counter
      }

      currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(3);
    });

    it('should persist resumeAttempts counter in database', async () => {
      // Create a task
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      // Create a checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Update resumeAttempts directly via store
      await store.updateTask(task.id, {
        resumeAttempts: 2,
        updatedAt: new Date(),
      });

      // Verify it's persisted
      const retrievedTask = await store.getTask(task.id);
      expect(retrievedTask?.resumeAttempts).toBe(2);
    });
  });

  describe('Max attempts check', () => {
    it('should fail task when resume attempts exceed maxResumeAttempts', async () => {
      // Create a task
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      // Set resumeAttempts to just under the limit
      await store.updateTask(task.id, {
        resumeAttempts: 3, // At the limit
        updatedAt: new Date(),
      });

      // Create a checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Mock task:failed event
      const failedEventSpy = vi.fn();
      orchestrator.on('task:failed', failedEventSpy);

      // Attempt to resume - this should exceed the limit (4 > 3)
      const result = await orchestrator.resumeTask(task.id);

      // Should return false (failed)
      expect(result).toBe(false);

      // Task should be marked as failed
      const failedTask = await store.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.resumeAttempts).toBe(4);

      // Should emit task:failed event
      expect(failedEventSpy).toHaveBeenCalledOnce();

      // Check error message
      expect(failedTask?.error).toContain('Maximum resume attempts exceeded (4/3)');
      expect(failedTask?.error).toContain('Breaking the task into smaller subtasks');
    });

    it('should include descriptive error message with remediation steps', async () => {
      // Create a task with resumeAttempts at the limit
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      await store.updateTask(task.id, {
        resumeAttempts: 3,
        updatedAt: new Date(),
      });

      // Create a checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      await orchestrator.resumeTask(task.id);

      const failedTask = await store.getTask(task.id);
      const errorMessage = failedTask?.error || '';

      expect(errorMessage).toContain('Maximum resume attempts exceeded (4/3)');
      expect(errorMessage).toContain('Breaking the task into smaller subtasks');
      expect(errorMessage).toContain('Increasing maxResumeAttempts in daemon.sessionRecovery config');
      expect(errorMessage).toContain('Manually investigating the root cause of repeated pauses');
    });

    it('should log error with proper metadata', async () => {
      // Create a task at the limit
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      await store.updateTask(task.id, {
        resumeAttempts: 3,
        updatedAt: new Date(),
      });

      // Create checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      await orchestrator.resumeTask(task.id);

      // Get logs
      const logs = await store.getLogs(task.id);
      const errorLog = logs.find(log => log.level === 'error' && log.message.includes('Maximum resume attempts exceeded'));

      expect(errorLog).toBeDefined();
      expect(errorLog?.metadata).toEqual({
        resumeAttempts: 4,
        maxResumeAttempts: 3,
        failureReason: 'max_resume_attempts_exceeded',
      });
    });
  });

  describe('Counter reset on completion', () => {
    it('should reset resumeAttempts to 0 when task status becomes completed', async () => {
      // Create a task with some resume attempts
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      // Set resumeAttempts to a non-zero value
      await store.updateTask(task.id, {
        resumeAttempts: 2,
        updatedAt: new Date(),
      });

      // Verify it's set
      let currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(2);

      // Complete the task
      await orchestrator.updateTaskStatus(task.id, 'completed');

      // Verify resumeAttempts is reset to 0
      currentTask = await store.getTask(task.id);
      expect(currentTask?.resumeAttempts).toBe(0);
      expect(currentTask?.status).toBe('completed');
    });

    it('should NOT reset resumeAttempts when task fails', async () => {
      // Create a task with some resume attempts
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      await store.updateTask(task.id, {
        resumeAttempts: 2,
        updatedAt: new Date(),
      });

      // Fail the task
      await orchestrator.updateTaskStatus(task.id, 'failed', 'Some error');

      // Verify resumeAttempts is NOT reset
      const failedTask = await store.getTask(task.id);
      expect(failedTask?.resumeAttempts).toBe(2);
      expect(failedTask?.status).toBe('failed');
    });
  });

  describe('resumePausedTask pre-check', () => {
    it('should check limits before clearing pause fields in resumePausedTask', async () => {
      // Create a paused task at the limit
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      await store.updateTask(task.id, {
        status: 'paused',
        resumeAttempts: 3, // At limit
        pausedAt: new Date(),
        pauseReason: 'test pause',
        updatedAt: new Date(),
      });

      // Attempt to resume paused task - should fail pre-check
      const result = await orchestrator.resumePausedTask(task.id);

      expect(result).toBe(false);

      // Task should be failed, not cleared of pause fields
      const failedTask = await store.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.resumeAttempts).toBe(4);
    });

    it('should allow resumePausedTask when under the limit', async () => {
      // Create a paused task under the limit
      const task = await store.createTask({
        description: 'Test task',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      await store.updateTask(task.id, {
        status: 'paused',
        resumeAttempts: 1, // Under limit
        pausedAt: new Date(),
        pauseReason: 'test pause',
        updatedAt: new Date(),
      });

      // Create a checkpoint to enable resume
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Mock workflow loading to prevent execution errors
      vi.doMock('@apex/core', async () => {
        const actual = await vi.importActual('@apex/core');
        return {
          ...actual,
          loadWorkflow: vi.fn().mockResolvedValue({
            name: 'test-workflow',
            description: 'Test workflow',
            stages: [{
              name: 'planning',
              agent: 'planner',
              description: 'Plan the task',
              maxRetries: 2,
            }],
          }),
        };
      });

      // Should clear pause fields and attempt resume
      try {
        await orchestrator.resumePausedTask(task.id);
      } catch {
        // Ignore execution errors, just checking the pause fields were cleared
      }

      const resumedTask = await store.getTask(task.id);
      // Pause fields should be cleared
      expect(resumedTask?.pausedAt).toBeUndefined();
      expect(resumedTask?.pauseReason).toBeUndefined();
    });
  });

  describe('Configuration handling', () => {
    it('should use default maxResumeAttempts = 3 when not configured', async () => {
      // Create orchestrator without sessionRecovery config
      const configWithoutSessionRecovery: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const tempOrchestrator = new ApexOrchestrator(tmpDir + '-no-config', configWithoutSessionRecovery);
      await tempOrchestrator.init();

      try {
        const task = await (tempOrchestrator as any).store.createTask({
          description: 'Test task',
          workflow: 'test-workflow',
          autonomy: 'manual',
          priority: 'normal',
          projectPath: tmpDir,
        });

        // Set to exactly 3 attempts
        await (tempOrchestrator as any).store.updateTask(task.id, {
          resumeAttempts: 3,
          updatedAt: new Date(),
        });

        // Create checkpoint
        await (tempOrchestrator as any).store.createCheckpoint(task.id, {
          checkpointId: 'checkpoint-1',
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        // Should fail on 4th attempt (default limit is 3)
        const result = await tempOrchestrator.resumeTask(task.id);
        expect(result).toBe(false);

        const failedTask = await (tempOrchestrator as any).store.getTask(task.id);
        expect(failedTask?.status).toBe('failed');
      } finally {
        await tempOrchestrator.shutdown();
      }
    });

    it('should respect custom maxResumeAttempts configuration', async () => {
      // Create orchestrator with custom maxResumeAttempts
      const customConfig: ApexConfig = {
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
            maxResumeAttempts: 5, // Custom limit
          },
        },
      };

      const tempDir2 = await mkdtemp(join(tmpdir(), 'apex-test-custom-'));
      const customOrchestrator = new ApexOrchestrator(tempDir2, customConfig);
      await customOrchestrator.init();

      try {
        const task = await (customOrchestrator as any).store.createTask({
          description: 'Test task',
          workflow: 'test-workflow',
          autonomy: 'manual',
          priority: 'normal',
          projectPath: tempDir2,
        });

        // Set to custom limit
        await (customOrchestrator as any).store.updateTask(task.id, {
          resumeAttempts: 5,
          updatedAt: new Date(),
        });

        // Create checkpoint
        await (customOrchestrator as any).store.createCheckpoint(task.id, {
          checkpointId: 'checkpoint-1',
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        // Should fail on 6th attempt (custom limit is 5)
        const result = await customOrchestrator.resumeTask(task.id);
        expect(result).toBe(false);

        const failedTask = await (customOrchestrator as any).store.getTask(task.id);
        expect(failedTask?.status).toBe('failed');
        expect(failedTask?.error).toContain('Maximum resume attempts exceeded (6/5)');
      } finally {
        await customOrchestrator.shutdown();
        await rm(tempDir2, { recursive: true, force: true });
      }
    });
  });

  describe('Integration tests', () => {
    it('should prevent infinite resume loops in a full cycle scenario', async () => {
      // Create a task
      const task = await store.createTask({
        description: 'Test infinite loop prevention',
        workflow: 'test-workflow',
        autonomy: 'manual',
        priority: 'normal',
        projectPath: tmpDir,
      });

      // Create a checkpoint
      await store.createCheckpoint(task.id, {
        checkpointId: 'checkpoint-1',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Mock workflow to prevent actual execution
      vi.doMock('@apex/core', async () => {
        const actual = await vi.importActual('@apex/core');
        return {
          ...actual,
          loadWorkflow: vi.fn().mockResolvedValue({
            name: 'test-workflow',
            description: 'Test workflow',
            stages: [{
              name: 'planning',
              agent: 'planner',
              description: 'Plan the task',
              maxRetries: 2,
            }],
          }),
        };
      });

      // Simulate multiple resume attempts
      let attemptCount = 0;
      let lastResult = true;

      while (lastResult && attemptCount < 10) { // Safety limit to prevent real infinite loop
        try {
          lastResult = await orchestrator.resumeTask(task.id);
          attemptCount++;
        } catch {
          break;
        }
      }

      // Should have stopped due to max resume attempts
      expect(lastResult).toBe(false);
      expect(attemptCount).toBe(4); // 1st, 2nd, 3rd attempts succeed, 4th fails

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.resumeAttempts).toBe(4);
      expect(finalTask?.error).toContain('Maximum resume attempts exceeded');
    });
  });
});