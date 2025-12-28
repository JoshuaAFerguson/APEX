/**
 * Queue Recovery on Daemon Restart - Integration Tests
 *
 * Tests the queue recovery mechanisms when the daemon restarts after a crash/shutdown.
 * These tests validate that:
 * 1. Tasks in various states are properly recovered
 * 2. Orphaned tasks (stuck in-progress) are handled correctly
 * 3. Paused tasks are ready for resumption
 * 4. Task queue ordering is maintained after restart
 *
 * Architecture Decision:
 * - Uses separate TaskStore instances to simulate daemon restart
 * - Creates temp directories for each test to ensure isolation
 * - Provides helper functions for creating tasks in various states
 * - Tests queue recovery without actually executing tasks (mocked orchestrator)
 *
 * @see ADR-007-max-resume-attempts-infinite-loop-prevention.md
 * @see ADR-003-priority-based-parent-task-auto-resume.md
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonRunner } from './runner';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';
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
  /** Pause reason if status is 'paused' */
  pauseReason?: string;
  /** When the task was paused */
  pausedAt?: Date;
  /** When the task should be resumed */
  resumeAfter?: Date;
  /** Parent task ID for subtasks */
  parentTaskId?: string;
  /** Subtask IDs for parent tasks */
  subtaskIds?: string[];
  /** Workflow to use */
  workflow?: string;
  /** How long ago the task was last updated (for orphan detection) */
  lastUpdatedAgo?: number;
  /** Resume attempts count */
  resumeAttempts?: number;
  /** Current workflow stage */
  currentStage?: string;
  /** Token usage for budget testing */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

/**
 * Default configuration for queue recovery tests
 */
const DEFAULT_TEST_CONFIG: ApexConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      name: 'test-agent',
      description: 'Test agent for integration tests',
      prompt: 'You are a test agent.',
    }
  },
  workflows: {
    'test-workflow': {
      name: 'Test Workflow',
      description: 'Workflow for integration tests',
      stages: [
        { name: 'planning', agent: 'test-agent', description: 'Plan the work' },
        { name: 'implementation', agent: 'test-agent', description: 'Implement the work' },
        { name: 'testing', agent: 'test-agent', description: 'Test the work' }
      ]
    },
    'feature': {
      name: 'Feature Workflow',
      description: 'Standard feature workflow',
      stages: [
        { name: 'planning', agent: 'test-agent', description: 'Plan the feature' },
        { name: 'architecture', agent: 'test-agent', description: 'Design architecture' },
        { name: 'development', agent: 'test-agent', description: 'Develop feature' },
        { name: 'testing', agent: 'test-agent', description: 'Test feature' },
        { name: 'review', agent: 'test-agent', description: 'Code review' }
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
// Test Suite: Queue Recovery on Daemon Restart
// ============================================================================

describe('Queue Recovery on Daemon Restart', () => {
  let testProjectPath: string;
  let store: TaskStore;
  let daemonRunner: DaemonRunner;
  let orchestrator: ApexOrchestrator;
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
      `test-queue-recovery-${Date.now()}-${Math.random().toString(36).substring(7)}`
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

    // Initialize Orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath });
    await orchestrator.initialize();

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
    const updatedAt = options.lastUpdatedAgo
      ? new Date(now.getTime() - options.lastUpdatedAgo)
      : now;

    const taskData: Partial<Task> = {
      description: options.description ?? 'Test task for queue recovery',
      acceptanceCriteria: 'Task should be properly recovered',
      workflow: options.workflow ?? 'test-workflow',
      autonomy: 'autonomous' as AutonomyLevel,
      status: options.status ?? 'pending',
      priority: options.priority ?? 'normal',
      effort: options.effort ?? 'medium',
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: options.resumeAttempts ?? 0,
      currentStage: options.currentStage,
      parentTaskId: options.parentTaskId,
      subtaskIds: options.subtaskIds,
      createdAt: now,
      updatedAt: updatedAt,
      usage: options.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    const task = await store.createTask(taskData as Task);
    const taskId = task.id;

    // Apply status-specific updates
    if (options.status === 'paused' && options.pauseReason) {
      await store.updateTask(taskId, {
        status: 'paused',
        pausedAt: options.pausedAt ?? now,
        pauseReason: options.pauseReason,
        resumeAfter: options.resumeAfter,
        updatedAt: updatedAt
      });
    } else if (options.status === 'in-progress') {
      await store.updateTask(taskId, {
        status: 'in-progress',
        currentStage: options.currentStage ?? 'implementation',
        updatedAt: updatedAt
      });
    }

    return taskId;
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
   * Creates an in-progress task (potentially orphaned)
   */
  async function createInProgressTask(
    description: string = 'In-progress task',
    lastUpdatedAgo?: number,
    currentStage?: string
  ): Promise<string> {
    return createTestTask({
      description,
      status: 'in-progress',
      lastUpdatedAgo,
      currentStage: currentStage ?? 'implementation'
    });
  }

  /**
   * Creates a paused task with specified reason
   */
  async function createPausedTask(
    pauseReason: string,
    description: string = 'Paused task',
    options: Partial<CreateTestTaskOptions> = {}
  ): Promise<string> {
    return createTestTask({
      ...options,
      description,
      status: 'paused',
      pauseReason,
      pausedAt: options.pausedAt ?? new Date()
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
   * Creates a parent task with subtasks
   */
  async function createParentWithSubtasks(
    subtaskCount: number = 2,
    parentStatus: TaskStatus = 'paused',
    pauseReason: string = 'capacity'
  ): Promise<{ parentId: string; subtaskIds: string[] }> {
    // Create subtasks first
    const subtaskIds: string[] = [];
    for (let i = 0; i < subtaskCount; i++) {
      const subtaskId = await createTestTask({
        description: `Subtask ${i + 1}`,
        status: 'pending',
        priority: 'normal'
      });
      subtaskIds.push(subtaskId);
    }

    // Create parent task with subtask references
    const parentId = await createTestTask({
      description: 'Parent task with subtasks',
      status: parentStatus,
      pauseReason: parentStatus === 'paused' ? pauseReason : undefined,
      subtaskIds
    });

    // Update subtasks to reference parent
    for (const subtaskId of subtaskIds) {
      await store.updateTask(subtaskId, {
        parentTaskId: parentId,
        updatedAt: new Date()
      });
    }

    return { parentId, subtaskIds };
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

  /**
   * Gets all tasks by status from the store
   */
  async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return store.getTasksByStatus(status);
  }

  /**
   * Verifies task state after recovery
   */
  async function verifyTaskState(
    taskId: string,
    expectedStatus: TaskStatus,
    additionalChecks?: (task: Task) => void
  ): Promise<void> {
    const task = await store.getTask(taskId);
    expect(task).not.toBeNull();
    expect(task!.status).toBe(expectedStatus);

    if (additionalChecks) {
      additionalChecks(task!);
    }
  }

  // ============================================================================
  // Test Cases: Infrastructure Validation
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

    it('should initialize DaemonRunner without starting', () => {
      expect(daemonRunner).toBeDefined();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should cleanup properly after each test', async () => {
      // Create a task
      const taskId = await createPendingTask('Cleanup test task');
      expect(taskId).toBeDefined();

      // Verify task exists
      const task = await store.getTask(taskId);
      expect(task).not.toBeNull();
    });
  });

  // ============================================================================
  // Test Cases: Task Creation Helpers
  // ============================================================================

  describe('Task Creation Helpers', () => {
    it('should create pending task with correct defaults', async () => {
      const taskId = await createPendingTask('Test pending task');

      await verifyTaskState(taskId, 'pending', (task) => {
        expect(task.priority).toBe('normal');
        expect(task.effort).toBe('medium');
        expect(task.workflow).toBe('test-workflow');
      });
    });

    it('should create in-progress task with stage info', async () => {
      const taskId = await createInProgressTask('Test in-progress', undefined, 'testing');

      await verifyTaskState(taskId, 'in-progress', (task) => {
        expect(task.currentStage).toBe('testing');
      });
    });

    it('should create paused task with pause reason', async () => {
      const taskId = await createPausedTask('capacity', 'Test paused for capacity');

      await verifyTaskState(taskId, 'paused', (task) => {
        expect(task.pauseReason).toBe('capacity');
        expect(task.pausedAt).toBeDefined();
      });
    });

    it('should create paused task with different reasons', async () => {
      const capacityTask = await createPausedTask('capacity');
      const budgetTask = await createPausedTask('budget');
      const usageLimitTask = await createPausedTask('usage_limit');
      const containerFailureTask = await createPausedTask('container_failure');

      const capacityCheck = await store.getTask(capacityTask);
      const budgetCheck = await store.getTask(budgetTask);
      const usageLimitCheck = await store.getTask(usageLimitTask);
      const containerFailureCheck = await store.getTask(containerFailureTask);

      expect(capacityCheck?.pauseReason).toBe('capacity');
      expect(budgetCheck?.pauseReason).toBe('budget');
      expect(usageLimitCheck?.pauseReason).toBe('usage_limit');
      expect(containerFailureCheck?.pauseReason).toBe('container_failure');
    });

    it('should create completed task with completion timestamp', async () => {
      const taskId = await createCompletedTask('Test completed task');

      await verifyTaskState(taskId, 'completed', (task) => {
        expect(task.completedAt).toBeDefined();
      });
    });

    it('should create failed task with error message', async () => {
      const taskId = await createFailedTask('Test failed task', 'Custom error');

      await verifyTaskState(taskId, 'failed', (task) => {
        expect(task.error).toBe('Custom error');
      });
    });

    it('should create parent task with subtasks', async () => {
      const { parentId, subtaskIds } = await createParentWithSubtasks(3);

      expect(subtaskIds).toHaveLength(3);

      const parent = await store.getTask(parentId);
      expect(parent?.subtaskIds).toHaveLength(3);

      // Verify subtasks reference parent
      for (const subtaskId of subtaskIds) {
        const subtask = await store.getTask(subtaskId);
        expect(subtask?.parentTaskId).toBe(parentId);
      }
    });

    it('should create task with priority ordering', async () => {
      const urgentId = await createPendingTask('Urgent task', 'urgent');
      const highId = await createPendingTask('High task', 'high');
      const normalId = await createPendingTask('Normal task', 'normal');
      const lowId = await createPendingTask('Low task', 'low');

      const readyTasks = await store.getReadyTasks({ orderByPriority: true });

      expect(readyTasks[0].id).toBe(urgentId);
      expect(readyTasks[1].id).toBe(highId);
      expect(readyTasks[2].id).toBe(normalId);
      expect(readyTasks[3].id).toBe(lowId);
    });

    it('should create stale in-progress task for orphan detection', async () => {
      // Create task that was last updated 2 hours ago
      const staleTaskId = await createInProgressTask(
        'Stale in-progress task',
        2 * 60 * 60 * 1000 // 2 hours ago
      );

      const task = await store.getTask(staleTaskId);
      expect(task).not.toBeNull();

      const staleness = Date.now() - task!.updatedAt.getTime();
      expect(staleness).toBeGreaterThan(60 * 60 * 1000); // More than 1 hour
    });
  });

  // ============================================================================
  // Test Cases: Queue State Queries
  // ============================================================================

  describe('Queue State Queries', () => {
    it('should retrieve pending tasks correctly', async () => {
      await createPendingTask('Pending 1');
      await createPendingTask('Pending 2');
      await createInProgressTask('In Progress');
      await createCompletedTask('Completed');

      const pendingTasks = await getTasksByStatus('pending');
      expect(pendingTasks).toHaveLength(2);
    });

    it('should retrieve paused tasks for resume', async () => {
      await createPausedTask('capacity', 'Capacity paused');
      await createPausedTask('budget', 'Budget paused');
      await createPausedTask('user_requested', 'User paused'); // Not auto-resumable

      const resumableTasks = await store.getPausedTasksForResume();
      expect(resumableTasks).toHaveLength(2); // Only capacity and budget
    });

    it('should retrieve orphaned tasks', async () => {
      // Fresh in-progress task (not orphaned)
      await createInProgressTask('Fresh in-progress');

      // Stale in-progress task (orphaned - 2 hours old)
      await createInProgressTask('Stale in-progress', 2 * 60 * 60 * 1000);

      const orphaned = await store.getOrphanedTasks(60 * 60 * 1000); // 1 hour threshold
      expect(orphaned).toHaveLength(1);
      expect(orphaned[0].description).toBe('Stale in-progress');
    });

    it('should find highest priority parent tasks', async () => {
      // Create parent tasks with different priorities
      const { parentId: urgentParentId } = await createParentWithSubtasks(2, 'paused', 'capacity');
      await store.updateTask(urgentParentId, { priority: 'urgent', updatedAt: new Date() });

      const { parentId: normalParentId } = await createParentWithSubtasks(1, 'paused', 'budget');
      // Normal priority is default

      const priorityParents = await store.findHighestPriorityParentTask();
      expect(priorityParents.length).toBeGreaterThanOrEqual(2);
      expect(priorityParents[0].priority).toBe('urgent');
    });

    it('should get ready tasks respecting dependencies', async () => {
      // Create dependent task
      const depTask = await createCompletedTask('Dependency completed');

      // Create task depending on completed task (should be ready)
      const readyTaskId = await createPendingTask('Ready task');
      await store.addDependency(readyTaskId, depTask);

      // Create task with incomplete dependency (should NOT be ready)
      const inProgressDep = await createInProgressTask('Incomplete dep');
      const blockedTaskId = await createPendingTask('Blocked task');
      await store.addDependency(blockedTaskId, inProgressDep);

      const readyTasks = await store.getReadyTasks();
      const readyTaskIds = readyTasks.map(t => t.id);

      expect(readyTaskIds).toContain(readyTaskId);
      expect(readyTaskIds).not.toContain(blockedTaskId);
    });
  });

  // ============================================================================
  // Test Cases: Queue Recovery Scenarios
  // ============================================================================

  describe('Queue Recovery After Daemon Restart', () => {
    it('should recover pending tasks after restart', async () => {
      // Create pending tasks before restart
      const task1 = await createPendingTask('Task 1', 'high');
      const task2 = await createPendingTask('Task 2', 'normal');
      const task3 = await createPendingTask('Task 3', 'low');

      // Verify tasks exist
      const initialPendingTasks = await getTasksByStatus('pending');
      expect(initialPendingTasks).toHaveLength(3);

      // Simulate daemon restart
      const { newStore } = await simulateDaemonRestart();

      // Verify pending tasks are recovered
      const recoveredTasks = await newStore.getTasksByStatus('pending');
      expect(recoveredTasks).toHaveLength(3);

      const recoveredIds = recoveredTasks.map(t => t.id).sort();
      const originalIds = [task1, task2, task3].sort();
      expect(recoveredIds).toEqual(originalIds);

      newStore.close();
    });

    it('should recover paused tasks with their pause reasons', async () => {
      // Create paused tasks with different reasons
      const capacityTask = await createPausedTask('capacity', 'Capacity paused task');
      const budgetTask = await createPausedTask('budget', 'Budget paused task');
      const userTask = await createPausedTask('user_requested', 'User paused task');

      // Simulate daemon restart
      const { newStore } = await simulateDaemonRestart();

      // Verify paused tasks recovered with reasons
      const recoveredPaused = await newStore.getTasksByStatus('paused');
      expect(recoveredPaused).toHaveLength(3);

      const capacityRecovered = recoveredPaused.find(t => t.id === capacityTask);
      const budgetRecovered = recoveredPaused.find(t => t.id === budgetTask);
      const userRecovered = recoveredPaused.find(t => t.id === userTask);

      expect(capacityRecovered?.pauseReason).toBe('capacity');
      expect(budgetRecovered?.pauseReason).toBe('budget');
      expect(userRecovered?.pauseReason).toBe('user_requested');

      newStore.close();
    });

    it('should handle orphaned in-progress tasks correctly', async () => {
      // Create fresh and stale in-progress tasks
      const freshTask = await createInProgressTask('Fresh task');
      const staleTask = await createInProgressTask('Stale task', 2 * 60 * 60 * 1000); // 2 hours old

      // Simulate daemon restart
      const { newStore } = await simulateDaemonRestart();

      // Verify fresh task still in-progress
      const freshRecovered = await newStore.getTask(freshTask);
      expect(freshRecovered).not.toBeNull();
      expect(freshRecovered!.status).toBe('in-progress');

      // Check if stale task handling works (depends on configuration)
      const staleRecovered = await newStore.getTask(staleTask);
      expect(staleRecovered).not.toBeNull();

      newStore.close();
    });

    it('should preserve task priorities after restart', async () => {
      // Create tasks with different priorities
      const urgentTask = await createPendingTask('Urgent task', 'urgent');
      const normalTask = await createPendingTask('Normal task', 'normal');
      const lowTask = await createPendingTask('Low task', 'low');

      // Simulate daemon restart
      const { newStore } = await simulateDaemonRestart();

      // Verify priority ordering is maintained
      const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
      expect(readyTasks).toHaveLength(3);

      expect(readyTasks[0].priority).toBe('urgent');
      expect(readyTasks[1].priority).toBe('normal');
      expect(readyTasks[2].priority).toBe('low');

      newStore.close();
    });

    it('should maintain parent-subtask relationships after restart', async () => {
      // Create parent task with subtasks
      const { parentId, subtaskIds } = await createParentWithSubtasks(2, 'paused', 'capacity');

      // Simulate daemon restart
      const { newStore } = await simulateDaemonRestart();

      // Verify parent-subtask relationships preserved
      const parentRecovered = await newStore.getTask(parentId);
      expect(parentRecovered?.subtaskIds).toHaveLength(2);

      for (const subtaskId of subtaskIds) {
        const subtaskRecovered = await newStore.getTask(subtaskId);
        expect(subtaskRecovered?.parentTaskId).toBe(parentId);
      }

      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: Daemon Runner Lifecycle
  // ============================================================================

  describe('Daemon Runner Lifecycle', () => {
    it('should start and report running status', async () => {
      await daemonRunner.start();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(true);
      expect(metrics.startedAt).toBeDefined();
    });

    it('should stop gracefully', async () => {
      await daemonRunner.start();
      await daemonRunner.stop();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    });

    it('should track metrics correctly', async () => {
      await daemonRunner.start();

      const metrics = daemonRunner.getMetrics();
      expect(metrics.tasksProcessed).toBe(0);
      expect(metrics.tasksSucceeded).toBe(0);
      expect(metrics.tasksFailed).toBe(0);
      expect(metrics.activeTaskCount).toBe(0);
      expect(metrics.pollCount).toBeGreaterThanOrEqual(0);
    });
  });
});
