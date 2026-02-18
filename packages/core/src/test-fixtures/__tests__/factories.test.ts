/**
 * @fileoverview Tests for fixture factories
 *
 * Tests the factory functions for creating task and tool fixtures
 */

import { describe, it, expect } from 'vitest';
import {
  createTask,
  createPendingTask,
  createRunningTask,
  createCompletedTask,
  createFailedTask,
  createPausedTask,
  createCancelledTask,
  createTaskWithWorkflow,
  createHighUsageTask,
  createTaskWithLogs,
  createTaskWithArtifacts,
  TaskPresets
} from '../factories/task-factory.js';
import type { Task, TaskStatus } from '../../types.js';

describe('Fixture Factories', () => {
  describe('createTask basic factory', () => {
    it('should create a task with default values', () => {
      const task = createTask();

      expect(task.id).toMatch(/^task-\d+-[a-z0-9]+$/);
      expect(task.description).toBe('Test task description');
      expect(task.workflow).toBe('feature');
      expect(task.autonomy).toBe('review-before-commit');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.effort).toBe('medium');
      expect(task.projectPath).toBe('/test/project');
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.resumeAttempts).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.usage).toBeDefined();
      expect(task.logs).toBeDefined();
      expect(task.artifacts).toBeDefined();
    });

    it('should accept overrides for any task property', () => {
      const task = createTask({
        description: 'Custom description',
        workflow: 'hotfix',
        priority: 'urgent',
        effort: 'large',
        projectPath: '/custom/path'
      });

      expect(task.description).toBe('Custom description');
      expect(task.workflow).toBe('hotfix');
      expect(task.priority).toBe('urgent');
      expect(task.effort).toBe('large');
      expect(task.projectPath).toBe('/custom/path');
      // Should preserve defaults for non-overridden properties
      expect(task.autonomy).toBe('review-before-commit');
      expect(task.status).toBe('pending');
    });

    it('should handle status-dependent timestamps', () => {
      const pendingTask = createTask({ status: 'pending' });
      expect(pendingTask.startedAt).toBeUndefined();
      expect(pendingTask.completedAt).toBeUndefined();

      const runningTask = createTask({ status: 'running' });
      expect(runningTask.startedAt).toBeDefined();
      expect(runningTask.completedAt).toBeUndefined();

      const completedTask = createTask({ status: 'completed' });
      expect(completedTask.startedAt).toBeDefined();
      expect(completedTask.completedAt).toBeDefined();

      const failedTask = createTask({ status: 'failed' });
      expect(failedTask.startedAt).toBeDefined();
      expect(failedTask.completedAt).toBeDefined();
      expect(failedTask.error).toBe('Test task failed');
    });

    it('should support factory options', () => {
      const taskWithoutData = createTask({}, {
        includeUsage: false,
        includeLogs: false,
        includeArtifacts: false
      });

      expect(taskWithoutData.usage).toBeUndefined();
      expect(taskWithoutData.logs).toEqual([]);
      expect(taskWithoutData.artifacts).toEqual([]);

      const taskWithStatusOption = createTask({}, { status: 'completed' });
      expect(taskWithStatusOption.status).toBe('completed');
      expect(taskWithStatusOption.completedAt).toBeDefined();
    });
  });

  describe('Status-specific factory functions', () => {
    it('should create pending task', () => {
      const task = createPendingTask();
      expect(task.status).toBe('pending');
      expect(task.startedAt).toBeUndefined();
      expect(task.completedAt).toBeUndefined();
    });

    it('should create running task', () => {
      const task = createRunningTask();
      expect(task.status).toBe('running');
      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeUndefined();
    });

    it('should create completed task', () => {
      const task = createCompletedTask();
      expect(task.status).toBe('completed');
      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
      expect(task.error).toBeUndefined();
    });

    it('should create failed task', () => {
      const task = createFailedTask();
      expect(task.status).toBe('failed');
      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
      expect(task.error).toBe('Task execution failed');
    });

    it('should create paused task', () => {
      const task = createPausedTask();
      expect(task.status).toBe('paused');
    });

    it('should create cancelled task', () => {
      const task = createCancelledTask();
      expect(task.status).toBe('cancelled');
    });

    it('should accept overrides in status-specific factories', () => {
      const task = createFailedTask({
        description: 'Custom failed task',
        error: 'Custom error message'
      });

      expect(task.status).toBe('failed');
      expect(task.description).toBe('Custom failed task');
      expect(task.error).toBe('Custom error message');
    });
  });

  describe('createTaskWithWorkflow', () => {
    it('should create task with specified workflow', () => {
      const featureTask = createTaskWithWorkflow('feature');
      expect(featureTask.workflow).toBe('feature');

      const hotfixTask = createTaskWithWorkflow('hotfix');
      expect(hotfixTask.workflow).toBe('hotfix');

      const bugfixTask = createTaskWithWorkflow('bugfix');
      expect(bugfixTask.workflow).toBe('bugfix');
    });

    it('should accept additional overrides', () => {
      const task = createTaskWithWorkflow('enhancement', {
        description: 'Enhanced feature',
        priority: 'high'
      });

      expect(task.workflow).toBe('enhancement');
      expect(task.description).toBe('Enhanced feature');
      expect(task.priority).toBe('high');
    });
  });

  describe('createHighUsageTask', () => {
    it('should create task with realistic usage data', () => {
      const task = createHighUsageTask();

      expect(task.usage).toBeDefined();
      expect(task.usage!.tokenUsage.inputTokens).toBe(50000);
      expect(task.usage!.tokenUsage.outputTokens).toBe(25000);
      expect(task.usage!.tokenUsage.cacheReadInputTokens).toBe(10000);
      expect(task.usage!.tokenUsage.cacheWriteInputTokens).toBe(5000);
      expect(task.usage!.costEstimate).toBe(15.50);

      // Check agent costs
      expect(task.usage!.agentCosts).toEqual({
        'planner': 2.50,
        'architect': 3.75,
        'developer': 6.25,
        'reviewer': 2.00,
        'tester': 1.00,
      });

      // Check stage costs
      expect(task.usage!.stageCosts).toEqual({
        'planning': 2.50,
        'architecture': 3.75,
        'implementation': 6.25,
        'review': 2.00,
        'testing': 1.00,
      });

      // Check tool costs
      expect(task.usage!.toolCosts).toEqual({
        'Read': 0.25,
        'Write': 0.50,
        'Bash': 1.25,
      });
    });

    it('should allow usage data to be overridden', () => {
      const task = createHighUsageTask({
        usage: {
          tokenUsage: {
            inputTokens: 100000,
            outputTokens: 50000,
            cacheReadInputTokens: 0,
            cacheWriteInputTokens: 0,
          },
          costEstimate: 25.00,
          agentCosts: { 'developer': 25.00 },
          stageCosts: { 'implementation': 25.00 },
          toolCosts: { 'Write': 25.00 },
        }
      });

      expect(task.usage!.tokenUsage.inputTokens).toBe(100000);
      expect(task.usage!.costEstimate).toBe(25.00);
    });
  });

  describe('createTaskWithLogs', () => {
    it('should create task with comprehensive log entries', () => {
      const task = createTaskWithLogs();

      expect(task.logs).toBeDefined();
      expect(task.logs.length).toBeGreaterThan(5);

      // Check log structure
      const firstLog = task.logs[0];
      expect(firstLog.level).toBe('info');
      expect(firstLog.message).toBe('Task created');
      expect(firstLog.timestamp).toBeInstanceOf(Date);
      expect(firstLog.source).toBe('orchestrator');

      // Check for different log levels
      const logLevels = task.logs.map(log => log.level);
      expect(logLevels).toContain('info');
      expect(logLevels).toContain('debug');
      expect(logLevels).toContain('warn');

      // Check for different sources
      const sources = task.logs.map(log => log.source);
      expect(sources).toContain('orchestrator');
      expect(sources).toContain('planner');
      expect(sources).toContain('architect');
      expect(sources).toContain('developer');

      // Check metadata presence
      const logsWithMetadata = task.logs.filter(log => log.metadata);
      expect(logsWithMetadata.length).toBeGreaterThan(0);
    });

    it('should have chronologically ordered logs', () => {
      const task = createTaskWithLogs();

      for (let i = 1; i < task.logs.length; i++) {
        const previousTime = task.logs[i - 1].timestamp.getTime();
        const currentTime = task.logs[i].timestamp.getTime();
        expect(currentTime).toBeGreaterThanOrEqual(previousTime);
      }
    });
  });

  describe('createTaskWithArtifacts', () => {
    it('should create task with multiple artifact types', () => {
      const task = createTaskWithArtifacts();

      expect(task.artifacts).toBeDefined();
      expect(task.artifacts.length).toBeGreaterThan(2);

      // Check artifact structure
      const firstArtifact = task.artifacts[0];
      expect(firstArtifact.type).toBeDefined();
      expect(firstArtifact.name).toBeDefined();
      expect(firstArtifact.path).toBeDefined();
      expect(firstArtifact.size).toBeGreaterThan(0);
      expect(firstArtifact.mimeType).toBeDefined();
      expect(firstArtifact.createdAt).toBeInstanceOf(Date);
      expect(firstArtifact.description).toBeDefined();

      // Check for different artifact types
      const artifactTypes = task.artifacts.map(artifact => artifact.type);
      expect(artifactTypes).toContain('file');
      expect(artifactTypes).toContain('diff');

      // Check for different MIME types
      const mimeTypes = task.artifacts.map(artifact => artifact.mimeType);
      expect(mimeTypes).toContain('text/markdown');
      expect(mimeTypes).toContain('text/javascript');
      expect(mimeTypes).toContain('text/plain');
    });

    it('should have chronologically ordered artifacts', () => {
      const task = createTaskWithArtifacts();

      for (let i = 1; i < task.artifacts.length; i++) {
        const previousTime = task.artifacts[i - 1].createdAt.getTime();
        const currentTime = task.artifacts[i].createdAt.getTime();
        expect(currentTime).toBeGreaterThanOrEqual(previousTime);
      }
    });
  });

  describe('TaskPresets', () => {
    describe('basic presets', () => {
      it('should have all basic status presets', () => {
        const statuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'paused', 'cancelled'];

        for (const status of statuses) {
          const task = TaskPresets.basic[status]();
          expect(task.status).toBe(status);
          expect(task).toMatchObject({
            id: expect.stringMatching(/^task-/),
            description: expect.any(String),
            workflow: expect.any(String),
          });
        }
      });
    });

    describe('workflow presets', () => {
      it('should have all workflow type presets', () => {
        const workflows = ['feature', 'hotfix', 'bugfix', 'enhancement', 'refactor'];

        for (const workflow of workflows) {
          const task = TaskPresets.workflows[workflow as keyof typeof TaskPresets.workflows]();
          expect(task.workflow).toBe(workflow);
        }
      });
    });

    describe('priority presets', () => {
      it('should have all priority level presets', () => {
        const priorities = ['low', 'normal', 'high', 'urgent'];

        for (const priority of priorities) {
          const task = TaskPresets.priorities[priority as keyof typeof TaskPresets.priorities]();
          expect(task.priority).toBe(priority);
        }
      });
    });

    describe('effort presets', () => {
      it('should have all effort level presets', () => {
        const efforts = ['minimal', 'small', 'medium', 'large', 'xlarge'];

        for (const effort of efforts) {
          const task = TaskPresets.efforts[effort as keyof typeof TaskPresets.efforts]();
          expect(task.effort).toBe(effort);
        }
      });
    });

    describe('enriched presets', () => {
      it('should create task with usage data', () => {
        const task = TaskPresets.enriched.withUsage();
        expect(task.usage).toBeDefined();
        expect(task.usage!.costEstimate).toBeGreaterThan(0);
      });

      it('should create task with logs', () => {
        const task = TaskPresets.enriched.withLogs();
        expect(task.logs.length).toBeGreaterThan(5);
      });

      it('should create task with artifacts', () => {
        const task = TaskPresets.enriched.withArtifacts();
        expect(task.artifacts.length).toBeGreaterThan(2);
      });

      it('should create complete task with all data', () => {
        const task = TaskPresets.enriched.complete();
        expect(task.usage).toBeDefined();
        expect(task.logs.length).toBeGreaterThan(0);
        expect(task.artifacts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Factory consistency', () => {
    it('should create unique IDs for each task', () => {
      const tasks = Array.from({ length: 10 }, () => createTask());
      const ids = tasks.map(task => task.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(tasks.length);
    });

    it('should maintain consistent timestamps across factory calls', () => {
      const task1 = createTask();
      const task2 = createTask();

      // Both tasks should have recent timestamps
      const now = Date.now();
      expect(task1.createdAt.getTime()).toBeLessThanOrEqual(now);
      expect(task2.createdAt.getTime()).toBeLessThanOrEqual(now);

      // Timestamps should be within a reasonable range (1 second)
      expect(now - task1.createdAt.getTime()).toBeLessThan(1000);
      expect(now - task2.createdAt.getTime()).toBeLessThan(1000);
    });

    it('should respect override priority over factory defaults', () => {
      const task = createCompletedTask({
        status: 'running' // Override should not be applied for status-specific factories
      });

      // Status-specific factory should maintain its intended status
      expect(task.status).toBe('completed');
      expect(task.completedAt).toBeDefined();
    });

    it('should handle nested object overrides properly', () => {
      const baseUsage = createHighUsageTask().usage!;

      const task = createHighUsageTask({
        usage: {
          ...baseUsage,
          costEstimate: 99.99,
          agentCosts: {
            ...baseUsage.agentCosts,
            'custom-agent': 50.00
          }
        }
      });

      expect(task.usage!.costEstimate).toBe(99.99);
      expect(task.usage!.agentCosts['planner']).toBe(2.50); // Original value preserved
      expect(task.usage!.agentCosts['custom-agent']).toBe(50.00); // New value added
    });
  });
});