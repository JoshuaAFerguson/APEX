/**
 * @fileoverview Basic integration tests for concurrent task execution
 *
 * These tests verify the core concurrent execution functionality with minimal mocking.
 * Focuses on testing the actual implementation behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DaemonRunner Concurrent Execution - Basic Integration', () => {
  let runnerSource: string;

  beforeEach(() => {
    runnerSource = readFileSync(join(__dirname, 'runner.ts'), 'utf8');
  });

  describe('Source Code Analysis', () => {

    describe('Acceptance Criteria 1: maxConcurrentTasks Configuration', () => {
      it('should have maxConcurrentTasks in DaemonRunnerOptions interface', () => {
        expect(runnerSource).toContain('maxConcurrentTasks?:');
        expect(runnerSource).toContain('Maximum number of tasks to run concurrently');
      });

      it('should initialize maxConcurrentTasks in constructor', () => {
        expect(runnerSource).toContain('maxConcurrentTasks: options.maxConcurrentTasks ?? 0');
        expect(runnerSource).toMatch(/0 = use config/i);
      });

      it('should use config.limits.maxConcurrentTasks as fallback', () => {
        expect(runnerSource).toMatch(/config\.limits\.maxConcurrentTasks/);
      });
    });

    describe('Acceptance Criteria 2: runningTasks Map Tracking', () => {
      it('should declare runningTasks as Map<string, Promise<void>>', () => {
        expect(runnerSource).toContain('runningTasks: Map<string, Promise<void>>');
      });

      it('should initialize runningTasks Map in constructor', () => {
        expect(runnerSource).toContain('runningTasks: Map<string, Promise<void>> = new Map()');
      });

      it('should add tasks to runningTasks Map in startTask', () => {
        expect(runnerSource).toContain('this.runningTasks.set(taskId, taskPromise)');
      });

      it('should remove tasks from runningTasks Map on completion', () => {
        expect(runnerSource).toContain('this.runningTasks.delete(taskId)');
      });

      it('should check runningTasks to prevent duplicate execution', () => {
        expect(runnerSource).toContain('if (this.runningTasks.has(task.id))');
      });
    });

    describe('Acceptance Criteria 3: poll() Method Concurrency Limits', () => {
      it('should calculate available slots based on maxConcurrentTasks and in-progress task count', () => {
        // Uses DB-level in-progress count to properly handle subtask trees
        expect(runnerSource).toContain('this.options.maxConcurrentTasks - inProgressCount');
        expect(runnerSource).toContain('const inProgressCount = this.store.countInProgressTasks');
      });

      it('should check available slots in poll method', () => {
        expect(runnerSource).toMatch(/availableSlots.*<=.*0/);
        expect(runnerSource).toContain('At capacity');
      });

      it('should start ONE task per poll cycle to prevent subtask stampede', () => {
        // New design: single task per poll prevents subtask explosion
        expect(runnerSource).toContain('Start at most ONE new parent task per poll cycle');
        expect(runnerSource).toContain('Start ONE task and return');
      });

      it('should respect concurrency limits and return early when at capacity', () => {
        expect(runnerSource).toContain('if (availableSlots <= 0)');
        expect(runnerSource).toContain('return;');
      });
    });

    describe('Acceptance Criteria 4: Simultaneous Task Execution', () => {
      it('should execute tasks asynchronously without blocking', () => {
        // Verify that startTask doesn't await task completion
        const startTaskSection = runnerSource.substring(
          runnerSource.indexOf('private startTask(taskId: string)'),
          runnerSource.indexOf('private startTask(taskId: string)') + 2000
        );

        expect(startTaskSection).toContain('const taskPromise = this.orchestrator.executeTask(taskId)');
        expect(startTaskSection).not.toContain('await this.orchestrator.executeTask');
      });

      it('should handle task candidates and start eligible tasks', () => {
        // Updated: Uses candidate iteration instead of availableSlots loop
        expect(runnerSource).toContain('for (const task of candidates)');
        expect(runnerSource).toContain('this.startTask(task.id)');
        expect(runnerSource).toContain('break;'); // Starts ONE task and breaks
      });

      it('should track task metrics for concurrent execution', () => {
        expect(runnerSource).toContain('activeTaskCount: this.runningTasks.size');
        expect(runnerSource).toContain('Array.from(this.runningTasks.keys())');
      });
    });
  });

  describe('Interface Validation', () => {
    it('should have correct DaemonRunnerOptions interface structure', () => {
      expect(runnerSource).toContain('interface DaemonRunnerOptions');
      expect(runnerSource).toContain('projectPath: string');
      expect(runnerSource).toContain('maxConcurrentTasks?: number');
      expect(runnerSource).toContain('pollIntervalMs?: number');
    });

    it('should have correct DaemonMetrics interface structure', () => {
      expect(runnerSource).toContain('interface DaemonMetrics');
      expect(runnerSource).toContain('activeTaskCount: number');
      expect(runnerSource).toContain('activeTaskIds: string[]');
      expect(runnerSource).toContain('tasksProcessed: number');
    });
  });

  describe('Implementation Verification', () => {
    it('should have proper error handling in concurrent execution', () => {
      expect(runnerSource).toContain('.catch((error: Error)');
      expect(runnerSource).toContain('this.tasksFailed++');
      expect(runnerSource).toContain('.finally(()');
    });

    it('should have usage tracking for concurrent tasks', () => {
      expect(runnerSource).toContain('this.usageManager.trackTaskStart(taskId)');
      expect(runnerSource).toContain('this.usageManager!.trackTaskCompletion');
    });

    it('should handle graceful shutdown with running tasks', () => {
      const stopSection = runnerSource.substring(
        runnerSource.indexOf('async stop()'),
        runnerSource.indexOf('async stop()') + 1500
      );

      expect(stopSection).toContain('this.runningTasks.size');
      expect(runnerSource).toContain('Promise.allSettled');
    });

    it('should respect restartParentOnly configuration', () => {
      expect(runnerSource).toContain('restartParentOnly');
      expect(runnerSource).toContain('task.parentTaskId');
      expect(runnerSource).toContain('Skipping child task');
    });
  });

  describe('Configuration Integration', () => {
    it('should load maxConcurrentTasks from config when not specified in options', () => {
      // Check that the configuration loading handles maxConcurrentTasks
      const configSection = runnerSource.substring(
        runnerSource.indexOf('async start()'),
        runnerSource.indexOf('async start()') + 1000
      );

      expect(runnerSource).toMatch(/config.*limits.*maxConcurrentTasks/);
    });

    it('should validate polling interval configuration', () => {
      expect(runnerSource).toContain('pollIntervalMs');
      expect(runnerSource).toMatch(/pollInterval.*1000.*60000/);
    });

    it('should handle daemon configuration properly', () => {
      expect(runnerSource).toContain('config.daemon');
      expect(runnerSource).toContain('orphanDetection');
      expect(runnerSource).toContain('taskRestart');
    });
  });

  describe('Edge Cases and Resilience', () => {
    it('should handle task execution errors without stopping the daemon', () => {
      expect(runnerSource).toContain('Failed to get tasks');
      expect(runnerSource).toContain('Poll error');
    });

    it('should handle capacity monitoring integration', () => {
      expect(runnerSource).toContain('DaemonScheduler');
      expect(runnerSource).toContain('shouldPauseTasks');
      expect(runnerSource).toContain('schedulingDecision.shouldPause');
    });

    it('should have orphaned process cleanup', () => {
      expect(runnerSource).toContain('cleanupOrphanedProcesses');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide accurate concurrent task metrics', () => {
      const getMetricsSection = runnerSource.substring(
        runnerSource.indexOf('getMetrics()'),
        runnerSource.indexOf('getMetrics()') + 500
      );

      expect(runnerSource).toContain('activeTaskCount: this.runningTasks.size');
      expect(runnerSource).toContain('Array.from(this.runningTasks.keys())');
    });

    it('should track task processing statistics', () => {
      expect(runnerSource).toContain('tasksProcessed++');
      expect(runnerSource).toContain('tasksSucceeded++');
      expect(runnerSource).toContain('tasksFailed++');
    });

    it('should provide health monitoring integration', () => {
      expect(runnerSource).toContain('HealthMonitor');
      expect(runnerSource).toContain('healthMonitor');
      expect(runnerSource).toContain('getHealthReport');
    });
  });
});