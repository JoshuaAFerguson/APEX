/**
 * Integration tests for orphaned task recovery functionality.
 *
 * This test suite verifies:
 * 1. Tasks in 'in-progress' status at restart are detected as orphaned
 * 2. Orphan detection respects staleness threshold
 * 3. Events 'orphan:detected' and 'orphan:recovered' are emitted correctly
 * 4. Different recovery policies work as expected
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { TaskStore } from './store';
import { ApexOrchestrator, OrphanDetectedEvent, OrphanRecoveredEvent } from './index';
import { DaemonRunner } from './runner';
import type { Task, TaskStatus, TaskPriority, TaskEffort, ApexConfig } from '@apexcli/core';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Default configuration for orphan recovery tests
 */
const DEFAULT_TEST_CONFIG: ApexConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      name: 'test-agent',
      description: 'Test agent for orphan recovery integration tests',
      prompt: 'You are a test agent for orphan recovery.',
    }
  },
  workflows: {
    'development': {
      name: 'Development Workflow',
      description: 'Standard development workflow for orphan recovery tests',
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

/**
 * Config with fail recovery policy
 */
const FAIL_POLICY_CONFIG: ApexConfig = {
  ...DEFAULT_TEST_CONFIG,
  daemon: {
    ...DEFAULT_TEST_CONFIG.daemon,
    orphanDetection: {
      ...DEFAULT_TEST_CONFIG.daemon.orphanDetection,
      recoveryPolicy: 'fail',
    }
  }
};

/**
 * Config with retry recovery policy
 */
const RETRY_POLICY_CONFIG: ApexConfig = {
  ...DEFAULT_TEST_CONFIG,
  daemon: {
    ...DEFAULT_TEST_CONFIG.daemon,
    orphanDetection: {
      ...DEFAULT_TEST_CONFIG.daemon.orphanDetection,
      recoveryPolicy: 'retry',
    }
  }
};

/**
 * Config with orphan detection disabled
 */
const DISABLED_ORPHAN_CONFIG: ApexConfig = {
  ...DEFAULT_TEST_CONFIG,
  daemon: {
    ...DEFAULT_TEST_CONFIG.daemon,
    orphanDetection: {
      ...DEFAULT_TEST_CONFIG.daemon.orphanDetection,
      enabled: false,
    }
  }
};

// ============================================================================
// Test Infrastructure
// ============================================================================

interface CreateTestTaskOptions {
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  effort?: TaskEffort;
  pauseReason?: string;
  lastUpdatedAgo?: number; // milliseconds ago
  subtaskIds?: string[];
  resumeAttempts?: number;
}

// Test variables
let testProjectPath: string;
let store: TaskStore;
let orchestrator: ApexOrchestrator;
let daemonRunner: DaemonRunner;

// Event capture for testing
let orphanDetectedEvents: OrphanDetectedEvent[];
let orphanRecoveredEvents: OrphanRecoveredEvent[];

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeEach(async () => {
  // Create unique test project directory
  testProjectPath = join(__dirname, 'test-data', `orphan-test-${Date.now()}-${Math.random()}`);
  mkdirSync(testProjectPath, { recursive: true });

  // Initialize store
  store = new TaskStore(testProjectPath);
  await store.initialize();

  // Initialize orchestrator
  orchestrator = new ApexOrchestrator({
    projectRoot: testProjectPath,
    dataDir: testProjectPath,
    logLevel: 'debug',
  });

  // Initialize daemon runner with orphan detection enabled
  daemonRunner = new DaemonRunner(
    store,
    orchestrator,
    DEFAULT_TEST_CONFIG,
    testProjectPath
  );

  // Setup event capture
  orphanDetectedEvents = [];
  orphanRecoveredEvents = [];

  orchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
    orphanDetectedEvents.push(event);
  });

  orchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
    orphanRecoveredEvents.push(event);
  });
});

afterEach(async () => {
  // Clean up daemon runner
  if (daemonRunner) {
    await daemonRunner.stop();
  }

  // Clean up store
  if (store) {
    store.close();
  }

  // Remove test directory
  if (testProjectPath) {
    rmSync(testProjectPath, { recursive: true, force: true });
  }

  // Clear event arrays
  orphanDetectedEvents = [];
  orphanRecoveredEvents = [];

  // Clear any mocks
  vi.clearAllMocks();
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a test task with specified options
 */
async function createTestTask(options: CreateTestTaskOptions = {}): Promise<string> {
  const {
    description = 'Test task',
    status = 'pending',
    priority = 'normal',
    effort = 'medium',
    pauseReason,
    lastUpdatedAgo = 0,
    subtaskIds = [],
    resumeAttempts = 0,
  } = options;

  const taskId = await store.createTask({
    description,
    priority,
    effort,
    workflow: 'development',
    subtaskIds,
    dependencies: [],
    tags: [],
  });

  // Update status if different from default
  if (status !== 'pending') {
    await store.updateTaskStatus(taskId, status, pauseReason);
  }

  // Simulate task being updated in the past
  if (lastUpdatedAgo > 0) {
    const pastTime = new Date(Date.now() - lastUpdatedAgo);
    await store.updateTask(taskId, { updatedAt: pastTime });
  }

  // Set resume attempts if needed
  if (resumeAttempts > 0) {
    await store.updateTask(taskId, { resumeAttempts });
  }

  return taskId;
}

/**
 * Creates an in-progress task that was last updated a specified time ago
 */
async function createInProgressTask(description = 'In-progress task', lastUpdatedAgo = 0): Promise<string> {
  return createTestTask({
    description,
    status: 'in-progress',
    lastUpdatedAgo,
  });
}

/**
 * Creates a pending task
 */
async function createPendingTask(description = 'Pending task'): Promise<string> {
  return createTestTask({
    description,
    status: 'pending',
  });
}

/**
 * Creates a completed task
 */
async function createCompletedTask(description = 'Completed task'): Promise<string> {
  return createTestTask({
    description,
    status: 'completed',
  });
}

/**
 * Simulates a daemon restart by creating new instances
 */
async function simulateDaemonRestart(): Promise<{
  newStore: TaskStore;
  newRunner: DaemonRunner;
  newOrchestrator: ApexOrchestrator;
}> {
  // Stop current instances
  await daemonRunner.stop();
  store.close();

  // Create new instances
  const newStore = new TaskStore(testProjectPath);
  await newStore.initialize();

  const newOrchestrator = new ApexOrchestrator({
    projectRoot: testProjectPath,
    dataDir: testProjectPath,
    logLevel: 'debug',
  });

  const newRunner = new DaemonRunner(
    newStore,
    newOrchestrator,
    DEFAULT_TEST_CONFIG,
    testProjectPath
  );

  // Setup event capture for new orchestrator
  newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
    orphanDetectedEvents.push(event);
  });

  newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
    orphanRecoveredEvents.push(event);
  });

  return {
    newStore,
    newRunner,
    newOrchestrator,
  };
}

/**
 * Verifies a task has the expected status
 */
async function verifyTaskStatus(taskId: string, expectedStatus: TaskStatus): Promise<Task> {
  const task = await store.getTask(taskId);
  expect(task).not.toBeNull();
  expect(task!.status).toBe(expectedStatus);
  return task!;
}

// ============================================================================
// Test Cases: Orphaned Task Detection
// ============================================================================

describe('Orphaned Task Detection', () => {
  it('should detect tasks in progress status at restart as orphaned when stale', async () => {
    // Create a stale in-progress task (2 hours old)
    const staleTaskId = await createInProgressTask(
      'Stale in-progress task',
      2 * 60 * 60 * 1000 // 2 hours ago
    );

    // Create a fresh in-progress task
    const freshTaskId = await createInProgressTask('Fresh in-progress task');

    // Create some other status tasks that should not be detected
    await createPendingTask('Pending task');
    await createCompletedTask('Completed task');

    // Verify initial state
    const staleTask = await verifyTaskStatus(staleTaskId, 'in-progress');
    const staleness = Date.now() - staleTask.updatedAt.getTime();
    expect(staleness).toBeGreaterThan(60 * 60 * 1000); // More than 1 hour

    // Simulate daemon restart and orphan detection
    const { newRunner } = await simulateDaemonRestart();
    await newRunner.start();

    // Wait a moment for orphan detection to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify only the stale task was detected as orphaned
    expect(orphanDetectedEvents).toHaveLength(1);
    expect(orphanDetectedEvents[0].tasks).toHaveLength(1);
    expect(orphanDetectedEvents[0].tasks[0].id).toBe(staleTaskId);
    expect(orphanDetectedEvents[0].reason).toBe('startup_check');
    expect(orphanDetectedEvents[0].stalenessThreshold).toBe(60 * 60 * 1000);

    await newRunner.stop();
  });

  it('should not detect fresh in-progress tasks as orphaned', async () => {
    // Create only fresh in-progress tasks
    await createInProgressTask('Fresh task 1');
    await createInProgressTask('Fresh task 2');

    // Simulate daemon restart and orphan detection
    const { newRunner } = await simulateDaemonRestart();
    await newRunner.start();

    // Wait a moment for orphan detection to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify no orphans detected
    expect(orphanDetectedEvents).toHaveLength(0);

    await newRunner.stop();
  });

  it('should respect staleness threshold configuration', async () => {
    // Create tasks with different staleness levels
    const recentTaskId = await createInProgressTask(
      'Recent task',
      30 * 60 * 1000 // 30 minutes ago
    );

    const mediumStaleTaskId = await createInProgressTask(
      'Medium stale task',
      90 * 60 * 1000 // 1.5 hours ago
    );

    const veryStaleTaskId = await createInProgressTask(
      'Very stale task',
      3 * 60 * 60 * 1000 // 3 hours ago
    );

    // Create new runner with 1-hour staleness threshold
    const { newStore, newOrchestrator } = await simulateDaemonRestart();
    const customRunner = new DaemonRunner(
      newStore,
      newOrchestrator,
      DEFAULT_TEST_CONFIG,
      testProjectPath
    );

    // Setup event capture
    newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
      orphanDetectedEvents.push(event);
    });

    await customRunner.start();

    // Wait for orphan detection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Only tasks older than 1 hour should be detected
    expect(orphanDetectedEvents).toHaveLength(1);
    expect(orphanDetectedEvents[0].tasks).toHaveLength(2);

    const detectedIds = orphanDetectedEvents[0].tasks.map(t => t.id);
    expect(detectedIds).toContain(mediumStaleTaskId);
    expect(detectedIds).toContain(veryStaleTaskId);
    expect(detectedIds).not.toContain(recentTaskId);

    await customRunner.stop();
  });
});

// ============================================================================
// Test Cases: Orphan Recovery Events
// ============================================================================

describe('Orphan Recovery Events', () => {
  it('should emit orphan:detected event with correct payload', async () => {
    // Create multiple stale in-progress tasks
    const task1Id = await createInProgressTask(
      'Stale task 1',
      2 * 60 * 60 * 1000 // 2 hours ago
    );

    const task2Id = await createInProgressTask(
      'Stale task 2',
      3 * 60 * 60 * 1000 // 3 hours ago
    );

    // Simulate restart and detection
    const { newRunner } = await simulateDaemonRestart();
    await newRunner.start();

    // Wait for orphan detection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify event payload
    expect(orphanDetectedEvents).toHaveLength(1);
    const event = orphanDetectedEvents[0];

    expect(event.tasks).toHaveLength(2);
    expect(event.tasks.map(t => t.id)).toEqual(expect.arrayContaining([task1Id, task2Id]));
    expect(event.detectedAt).toBeInstanceOf(Date);
    expect(event.reason).toBe('startup_check');
    expect(event.stalenessThreshold).toBe(60 * 60 * 1000);

    // Verify task objects have full context
    event.tasks.forEach(task => {
      expect(task.id).toBeDefined();
      expect(task.description).toBeDefined();
      expect(task.status).toBe('in-progress');
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    await newRunner.stop();
  });

  it('should emit orphan:recovered events with pending policy', async () => {
    // Create stale in-progress task
    const staleTaskId = await createInProgressTask(
      'Stale task for recovery',
      2 * 60 * 60 * 1000 // 2 hours ago
    );

    // Simulate restart with pending recovery policy
    const { newStore, newOrchestrator } = await simulateDaemonRestart();
    const recoveryRunner = new DaemonRunner(
      newStore,
      newOrchestrator,
      DEFAULT_TEST_CONFIG,
      testProjectPath
    );

    // Setup event capture
    newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
      orphanDetectedEvents.push(event);
    });

    newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
      orphanRecoveredEvents.push(event);
    });

    await recoveryRunner.start();

    // Wait for recovery to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify recovery event
    expect(orphanRecoveredEvents).toHaveLength(1);
    const recoveryEvent = orphanRecoveredEvents[0];

    expect(recoveryEvent.taskId).toBe(staleTaskId);
    expect(recoveryEvent.previousStatus).toBe('in-progress');
    expect(recoveryEvent.newStatus).toBe('pending');
    expect(recoveryEvent.action).toBe('reset_pending');
    expect(recoveryEvent.message).toContain('Task reset to pending: was orphaned');
    expect(recoveryEvent.timestamp).toBeInstanceOf(Date);

    // Verify task status was actually updated
    const recoveredTask = await newStore.getTask(staleTaskId);
    expect(recoveredTask?.status).toBe('pending');

    await recoveryRunner.stop();
  });

  it('should emit orphan:recovered events with fail policy', async () => {
    // Create stale in-progress task
    const staleTaskId = await createInProgressTask(
      'Stale task for failing',
      2 * 60 * 60 * 1000 // 2 hours ago
    );

    // Simulate restart with fail recovery policy
    const { newStore, newOrchestrator } = await simulateDaemonRestart();
    const failRunner = new DaemonRunner(
      newStore,
      newOrchestrator,
      FAIL_POLICY_CONFIG,
      testProjectPath
    );

    // Setup event capture
    newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
      orphanRecoveredEvents.push(event);
    });

    await failRunner.start();

    // Wait for recovery to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify recovery event
    expect(orphanRecoveredEvents).toHaveLength(1);
    const recoveryEvent = orphanRecoveredEvents[0];

    expect(recoveryEvent.taskId).toBe(staleTaskId);
    expect(recoveryEvent.previousStatus).toBe('in-progress');
    expect(recoveryEvent.newStatus).toBe('failed');
    expect(recoveryEvent.action).toBe('marked_failed');
    expect(recoveryEvent.message).toContain('Task marked as failed: orphaned');

    // Verify task status was actually updated
    const recoveredTask = await newStore.getTask(staleTaskId);
    expect(recoveredTask?.status).toBe('failed');

    await failRunner.stop();
  });

  it('should emit orphan:recovered events with retry policy', async () => {
    // Create stale in-progress task
    const staleTaskId = await createInProgressTask(
      'Stale task for retry',
      2 * 60 * 60 * 1000 // 2 hours ago
    );

    // Simulate restart with retry recovery policy
    const { newStore, newOrchestrator } = await simulateDaemonRestart();
    const retryRunner = new DaemonRunner(
      newStore,
      newOrchestrator,
      RETRY_POLICY_CONFIG,
      testProjectPath
    );

    // Setup event capture
    newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
      orphanRecoveredEvents.push(event);
    });

    await retryRunner.start();

    // Wait for recovery to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify recovery event
    expect(orphanRecoveredEvents).toHaveLength(1);
    const recoveryEvent = orphanRecoveredEvents[0];

    expect(recoveryEvent.taskId).toBe(staleTaskId);
    expect(recoveryEvent.previousStatus).toBe('in-progress');
    expect(recoveryEvent.newStatus).toBe('pending');
    expect(recoveryEvent.action).toBe('retry');
    expect(recoveryEvent.message).toContain('Task queued for retry: was orphaned');

    // Verify task status was updated and retry count incremented
    const recoveredTask = await newStore.getTask(staleTaskId);
    expect(recoveredTask?.status).toBe('pending');
    expect(recoveredTask?.retryCount).toBe(1);

    await retryRunner.stop();
  });
});

// ============================================================================
// Test Cases: Recovery Integration
// ============================================================================

describe('Orphan Recovery Integration', () => {
  it('should handle multiple orphaned tasks with mixed recovery outcomes', async () => {
    // Create multiple stale tasks
    const task1Id = await createInProgressTask('Task 1', 2 * 60 * 60 * 1000);
    const task2Id = await createInProgressTask('Task 2', 3 * 60 * 60 * 1000);
    const task3Id = await createInProgressTask('Task 3', 4 * 60 * 60 * 1000);

    // Simulate restart
    const { newRunner } = await simulateDaemonRestart();
    await newRunner.start();

    // Wait for all recoveries to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify all tasks detected and recovered
    expect(orphanDetectedEvents).toHaveLength(1);
    expect(orphanDetectedEvents[0].tasks).toHaveLength(3);

    expect(orphanRecoveredEvents).toHaveLength(3);

    // Verify each task was recovered to pending status
    const task1 = await store.getTask(task1Id);
    const task2 = await store.getTask(task2Id);
    const task3 = await store.getTask(task3Id);

    expect(task1?.status).toBe('pending');
    expect(task2?.status).toBe('pending');
    expect(task3?.status).toBe('pending');

    await newRunner.stop();
  });

  it('should not detect currently running tasks as orphaned', async () => {
    // Create a stale task
    const staleTaskId = await createInProgressTask('Stale task', 2 * 60 * 60 * 1000);

    // Simulate restart and manually mark one task as currently running
    const { newRunner } = await simulateDaemonRestart();

    // Access private runningTasks set to simulate active execution
    // This tests the filtering logic that prevents actively running tasks from being recovered
    const runningTasksSet = (newRunner as any).runningTasks;
    runningTasksSet.add(staleTaskId);

    await newRunner.start();

    // Wait for orphan detection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Task should not be detected as orphaned because it's marked as running
    expect(orphanDetectedEvents).toHaveLength(0);
    expect(orphanRecoveredEvents).toHaveLength(0);

    await newRunner.stop();
  });

  it('should handle orphan detection when disabled in config', async () => {
    // Create stale tasks
    await createInProgressTask('Stale task 1', 2 * 60 * 60 * 1000);
    await createInProgressTask('Stale task 2', 3 * 60 * 60 * 1000);

    // Simulate restart with orphan detection disabled
    const { newStore, newOrchestrator } = await simulateDaemonRestart();
    const disabledRunner = new DaemonRunner(
      newStore,
      newOrchestrator,
      DISABLED_ORPHAN_CONFIG,
      testProjectPath
    );

    // Setup event capture
    newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
      orphanDetectedEvents.push(event);
    });

    await disabledRunner.start();

    // Wait for potential detection
    await new Promise(resolve => setTimeout(resolve, 100));

    // No orphan detection should occur
    expect(orphanDetectedEvents).toHaveLength(0);
    expect(orphanRecoveredEvents).toHaveLength(0);

    await disabledRunner.stop();
  });
});