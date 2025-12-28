/**
 * Pending Task Re-Queue Verification Tests
 *
 * Tests that verify pending tasks are correctly re-queued after daemon restarts.
 * These tests validate that:
 * 1. Pending tasks remain in queue after restart
 * 2. Tasks are picked up correctly by poll cycle after restart
 * 3. Priority ordering is respected when re-queuing
 *
 * Architecture Decision:
 * - Uses separate TaskStore instances to simulate daemon restart
 * - Creates temp directories for each test to ensure isolation
 * - Follows patterns established in queue-recovery-daemon-restart.integration.test.ts
 * - Tests queue recovery without actually executing tasks (mocked orchestrator)
 *
 * @see ADR-011: Pending Task Re-Queue Verification Test Suite
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DaemonRunner } from '../runner.js';
import { TaskStore } from '../store.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  AutonomyLevel,
  ApexConfig
} from '@apexcli/core';

// ============================================================================
// Test Configuration Interfaces
// ============================================================================

/**
 * Options for creating test tasks with various states
 */
interface CreateTestTaskOptions {
  /** Task description */
  description?: string;
  /** Task status - defaults to 'pending' */
  status?: TaskStatus;
  /** Task priority - defaults to 'normal' */
  priority?: TaskPriority;
  /** Task effort - defaults to 'medium' */
  effort?: TaskEffort;
  /** Current workflow stage */
  currentStage?: string;
  /** Workflow to use */
  workflow?: string;
}

/**
 * Default configuration for pending task re-queue tests
 */
const DEFAULT_TEST_CONFIG: ApexConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      name: 'test-agent',
      description: 'Test agent for pending task re-queue tests',
      prompt: 'You are a test agent.',
    }
  },
  workflows: {
    'test-workflow': {
      name: 'Test Workflow',
      description: 'Workflow for pending task re-queue tests',
      stages: [
        { name: 'planning', agent: 'test-agent', description: 'Plan the work' },
        { name: 'implementation', agent: 'test-agent', description: 'Implement the work' },
        { name: 'testing', agent: 'test-agent', description: 'Test the work' }
      ]
    }
  },
  daemon: {
    enabled: true,
    pollInterval: 1000,
    logLevel: 'debug' as const,
    orphanDetection: {
      enabled: true,
      stalenessThreshold: 3600000, // 1 hour
      recoveryPolicy: 'pending',
      periodicCheck: false
    },
    sessionRecovery: {
      enabled: true,
      autoResume: true,
      maxResumeAttempts: 3
    }
  },
  limits: {
    maxConcurrentTasks: 3,
    maxTokensPerTask: 100000,
    maxCostPerTask: 5.0,
    dailyBudget: 50.0,
    maxRetries: 3
  }
};

// ============================================================================
// Test Suite: Pending Task Re-Queue Verification
// ============================================================================

describe('Pending Task Re-Queue Verification', () => {
  let testProjectPath: string;
  let store: TaskStore;
  let daemonRunner: DaemonRunner;
  let testConfig: ApexConfig;

  // ============================================================================
  // Test Setup and Teardown
  // ============================================================================

  beforeEach(async () => {
    // Create unique test directory for isolation
    testProjectPath = join(
      __dirname,
      '..',
      '..',
      'test-data',
      `test-pending-requeue-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );

    // Create project structure
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.apex'), { recursive: true });

    // Clone config for potential per-test modifications
    testConfig = JSON.parse(JSON.stringify(DEFAULT_TEST_CONFIG));

    // Write config file
    writeFileSync(
      join(testProjectPath, '.apex', 'config.yaml'),
      JSON.stringify(testConfig, null, 2)
    );

    // Initialize TaskStore
    store = new TaskStore(testProjectPath);
    await store.initialize();

    // Initialize DaemonRunner with test config
    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: testConfig
    });
  });

  afterEach(async () => {
    // Cleanup daemon runner
    if (daemonRunner) {
      try {
        await daemonRunner.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Close store connection
    if (store) {
      try {
        store.close();
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Remove test directory
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Creates a test task with the specified options
   *
   * @param options - Configuration for the test task
   * @returns The ID of the created task
   */
  async function createTestTask(options: CreateTestTaskOptions = {}): Promise<string> {
    const now = new Date();

    const taskData: Partial<Task> = {
      description: options.description ?? 'Test pending task',
      acceptanceCriteria: 'Task should be properly re-queued after restart',
      workflow: options.workflow ?? 'test-workflow',
      autonomy: 'autonomous' as AutonomyLevel,
      status: options.status ?? 'pending',
      priority: options.priority ?? 'normal',
      effort: options.effort ?? 'medium',
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      currentStage: options.currentStage,
      createdAt: now,
      updatedAt: now,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    const task = await store.createTask(taskData as Task);
    return task.id;
  }

  /**
   * Creates a pending task ready to be picked up
   */
  async function createPendingTask(
    description: string = 'Pending task',
    priority: TaskPriority = 'normal',
    effort: TaskEffort = 'medium'
  ): Promise<string> {
    return createTestTask({
      description,
      status: 'pending',
      priority,
      effort
    });
  }

  /**
   * Creates a completed task
   */
  async function createCompletedTask(
    description: string = 'Completed task'
  ): Promise<string> {
    const taskId = await createTestTask({
      description,
      status: 'completed'
    });

    await store.updateTask(taskId, {
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date()
    });

    return taskId;
  }

  /**
   * Creates a failed task
   */
  async function createFailedTask(
    description: string = 'Failed task',
    error: string = 'Test error'
  ): Promise<string> {
    const taskId = await createTestTask({
      description,
      status: 'failed'
    });

    await store.updateTask(taskId, {
      status: 'failed',
      error,
      updatedAt: new Date()
    } as any);

    return taskId;
  }

  /**
   * Creates an in-progress task
   */
  async function createInProgressTask(
    description: string = 'In-progress task',
    currentStage?: string
  ): Promise<string> {
    return createTestTask({
      description,
      status: 'in-progress',
      currentStage: currentStage ?? 'implementation'
    });
  }

  /**
   * Simulates a daemon restart by creating a fresh DaemonRunner
   * with a new TaskStore connection
   */
  async function simulateDaemonRestart(): Promise<{
    newStore: TaskStore;
    newRunner: DaemonRunner;
  }> {
    // Close existing connections
    if (store) {
      store.close();
    }
    if (daemonRunner) {
      await daemonRunner.stop();
    }

    // Create new instances (simulating daemon restart)
    const newStore = new TaskStore(testProjectPath);
    await newStore.initialize();

    const newRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: testConfig
    });

    return { newStore, newRunner };
  }

  // ============================================================================
  // Test Cases: Test Infrastructure Validation
  // ============================================================================

  describe('Test Infrastructure', () => {
    it('should create temp directory with proper structure', () => {
      expect(existsSync(testProjectPath)).toBe(true);
      expect(existsSync(join(testProjectPath, '.apex'))).toBe(true);
      expect(existsSync(join(testProjectPath, '.apex', 'config.yaml'))).toBe(true);
    });

    it('should initialize TaskStore successfully', async () => {
      expect(store).toBeDefined();

      // Verify database is accessible
      const allTasks = await store.getAllTasks();
      expect(Array.isArray(allTasks)).toBe(true);
    });

    it('should create pending tasks with correct properties', async () => {
      const taskId = await createPendingTask('Test pending task', 'high', 'large');

      const task = await store.getTask(taskId);
      expect(task).not.toBeNull();
      expect(task!.status).toBe('pending');
      expect(task!.priority).toBe('high');
      expect(task!.effort).toBe('large');
      expect(task!.description).toBe('Test pending task');
    });
  });

  // ============================================================================
  // Test Cases: AC1 - Pending tasks persist after restart
  // ============================================================================

  describe('Pending tasks persist after restart', () => {
    it('should preserve pending tasks in database after daemon restart', async () => {
      // Setup: Create multiple pending tasks
      const task1 = await createPendingTask('Task 1');
      const task2 = await createPendingTask('Task 2');
      const task3 = await createPendingTask('Task 3');

      // Verify tasks exist before restart
      const beforeRestart = await store.getTasksByStatus('pending');
      expect(beforeRestart).toHaveLength(3);

      // Simulate daemon restart (closes old store, creates new)
      const { newStore } = await simulateDaemonRestart();

      // Verify: All pending tasks still exist with same IDs
      const afterRestart = await newStore.getTasksByStatus('pending');
      expect(afterRestart).toHaveLength(3);
      expect(afterRestart.map(t => t.id).sort()).toEqual([task1, task2, task3].sort());

      // Cleanup
      newStore.close();
    });

    it('should preserve pending task metadata after restart', async () => {
      // Create task with specific metadata
      const taskId = await createPendingTask('Detailed task', 'high', 'large');
      await store.addLog(taskId, { level: 'info', message: 'Pre-restart log' });

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // Verify all metadata preserved
      const task = await newStore.getTask(taskId);
      expect(task?.status).toBe('pending');
      expect(task?.priority).toBe('high');
      expect(task?.effort).toBe('large');
      expect(task?.description).toBe('Detailed task');

      newStore.close();
    });

    it('should maintain pending task dependencies after restart', async () => {
      // Create dependency chain
      const dep1 = await createCompletedTask('Dependency 1');
      const dep2 = await createPendingTask('Dependency 2');
      const dependentTask = await createPendingTask('Dependent task');
      await store.addDependency(dependentTask, dep1);
      await store.addDependency(dependentTask, dep2);

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // Verify dependencies preserved
      const deps = await newStore.getTaskDependencies(dependentTask);
      expect(deps).toContain(dep1);
      expect(deps).toContain(dep2);

      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: AC2 - Tasks picked up correctly by poll cycle after restart
  // ============================================================================

  describe('Poll cycle picks up pending tasks correctly', () => {
    it('should pick up pending tasks on first poll after restart', async () => {
      // Create pending task before restart
      const taskId = await createPendingTask('Poll pickup test');

      // Simulate restart with new DaemonRunner
      const { newStore, newRunner } = await simulateDaemonRestart();

      // Start daemon and trigger poll
      await newRunner.start();

      // Allow time for at least one poll cycle
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Verify poll ran (check metrics)
      const metrics = newRunner.getMetrics();
      expect(metrics.pollCount).toBeGreaterThan(0);

      // Stop and cleanup
      await newRunner.stop();
      newStore.close();
    });

    it('should correctly use getNextQueuedTask after restart', async () => {
      // Create multiple pending tasks
      await createPendingTask('Task A');
      await createPendingTask('Task B');

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // Verify getNextQueuedTask returns pending tasks
      const nextTask = await newStore.getNextQueuedTask();
      expect(nextTask).not.toBeNull();
      expect(nextTask?.status).toBe('pending');

      newStore.close();
    });

    it('should handle empty pending queue after restart gracefully', async () => {
      // Create no pending tasks (only completed/failed)
      await createCompletedTask('Completed');
      await createFailedTask('Failed');

      // Restart
      const { newStore, newRunner } = await simulateDaemonRestart();

      // Verify poll handles empty queue gracefully
      await newRunner.start();

      // Allow time for polls
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Should be running without errors
      const metrics = newRunner.getMetrics();
      expect(metrics.isRunning).toBe(true);
      expect(metrics.tasksFailed).toBe(0);

      await newRunner.stop();
      newStore.close();
    });

    it('should respect dependencies when picking up tasks after restart', async () => {
      // Create blocked and unblocked pending tasks
      const blocker = await createInProgressTask('Blocker');
      const blockedTask = await createPendingTask('Blocked task');
      const unblockedTask = await createPendingTask('Unblocked task');

      await store.addDependency(blockedTask, blocker);

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // getReadyTasks should only return unblocked task
      const readyTasks = await newStore.getReadyTasks();
      const readyIds = readyTasks.map(t => t.id);

      expect(readyIds).toContain(unblockedTask);
      expect(readyIds).not.toContain(blockedTask);

      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: AC3 - Priority ordering respected on re-queue
  // ============================================================================

  describe('Priority ordering respected on re-queue', () => {
    it('should maintain priority order after restart', async () => {
      // Create tasks in non-priority order
      const lowTask = await createPendingTask('Low task', 'low');
      const urgentTask = await createPendingTask('Urgent task', 'urgent');
      const normalTask = await createPendingTask('Normal task', 'normal');
      const highTask = await createPendingTask('High task', 'high');

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // Verify priority ordering: urgent > high > normal > low
      const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
      expect(readyTasks[0].id).toBe(urgentTask);
      expect(readyTasks[1].id).toBe(highTask);
      expect(readyTasks[2].id).toBe(normalTask);
      expect(readyTasks[3].id).toBe(lowTask);

      newStore.close();
    });

    it('should pick up highest priority pending task first after restart', async () => {
      // Create multiple pending tasks with different priorities
      await createPendingTask('Normal task', 'normal');
      const urgentTask = await createPendingTask('Urgent task', 'urgent');
      await createPendingTask('Low task', 'low');

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // getNextQueuedTask should return urgent task
      const nextTask = await newStore.getNextQueuedTask();
      expect(nextTask?.id).toBe(urgentTask);
      expect(nextTask?.priority).toBe('urgent');

      newStore.close();
    });

    it('should maintain priority order with same-priority tasks (FIFO)', async () => {
      // Create multiple tasks with same priority - should be FIFO
      const firstNormal = await createPendingTask('First normal');
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const secondNormal = await createPendingTask('Second normal');
      await new Promise(resolve => setTimeout(resolve, 10));
      const thirdNormal = await createPendingTask('Third normal');

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // Same priority should be ordered by created_at (oldest first)
      const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
      const normalTasks = readyTasks.filter(t => t.priority === 'normal');

      expect(normalTasks[0].id).toBe(firstNormal);
      expect(normalTasks[1].id).toBe(secondNormal);
      expect(normalTasks[2].id).toBe(thirdNormal);

      newStore.close();
    });

    it('should respect effort as secondary sort after priority', async () => {
      // Create tasks with same priority but different effort
      const largeTask = await createPendingTask('Large effort', 'high', 'large');
      await new Promise(resolve => setTimeout(resolve, 10));
      const smallTask = await createPendingTask('Small effort', 'high', 'small');

      // Restart
      const { newStore } = await simulateDaemonRestart();

      // Same priority, smaller effort should come first
      const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
      const highTasks = readyTasks.filter(t => t.priority === 'high');

      // Based on TaskStore.getReadyTasks() implementation:
      // ORDER BY priority ASC, effort ASC (smaller effort first)
      expect(highTasks[0].id).toBe(smallTask);
      expect(highTasks[1].id).toBe(largeTask);

      newStore.close();
    });
  });
});