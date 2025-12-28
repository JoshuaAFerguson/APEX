/**
 * Comprehensive Queue Recovery Integration Tests
 *
 * This test suite verifies the complete end-to-end queue recovery functionality:
 * 1. Orphan detection and recovery on daemon restart
 * 2. Task queue persistence and ordering preservation
 * 3. Event emission for orphan:detected and orphan:recovered
 * 4. Integration with DaemonRunner startup checks
 * 5. Various recovery policies and configurations
 * 6. Parent-subtask relationship preservation
 * 7. Priority-based recovery ordering
 *
 * @see ADR-007-max-resume-attempts-infinite-loop-prevention.md
 * @see ADR-003-priority-based-parent-task-auto-resume.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { TaskStore } from './store';
import { ApexOrchestrator, OrphanDetectedEvent, OrphanRecoveredEvent } from './index';
import { DaemonRunner } from './runner';
import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  ApexConfig,
  AutonomyLevel
} from '@apexcli/core';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Base configuration for queue recovery integration tests
 */
const BASE_TEST_CONFIG: ApexConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      name: 'test-agent',
      description: 'Test agent for queue recovery integration',
      prompt: 'You are a test agent for queue recovery testing.',
    }
  },
  workflows: {
    'feature': {
      name: 'Feature Workflow',
      description: 'Standard feature development workflow',
      stages: [
        { name: 'planning', agent: 'test-agent', description: 'Plan the feature' },
        { name: 'architecture', agent: 'test-agent', description: 'Design architecture' },
        { name: 'implementation', agent: 'test-agent', description: 'Implement feature' },
        { name: 'testing', agent: 'test-agent', description: 'Test feature' },
        { name: 'review', agent: 'test-agent', description: 'Code review' }
      ]
    },
    'bugfix': {
      name: 'Bug Fix Workflow',
      description: 'Workflow for bug fixes',
      stages: [
        { name: 'investigation', agent: 'test-agent', description: 'Investigate the bug' },
        { name: 'fix', agent: 'test-agent', description: 'Implement fix' },
        { name: 'testing', agent: 'test-agent', description: 'Test the fix' }
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
    maxConcurrentTasks: 5,
    maxTokensPerTask: 100000,
    maxCostPerTask: 5.0,
    dailyBudget: 50.0,
    maxRetries: 3
  }
};

/**
 * Configuration variations for different test scenarios
 */
const CONFIG_VARIANTS = {
  // Orphan detection disabled
  orphanDisabled: {
    ...BASE_TEST_CONFIG,
    daemon: {
      ...BASE_TEST_CONFIG.daemon,
      orphanDetection: {
        ...BASE_TEST_CONFIG.daemon.orphanDetection,
        enabled: false
      }
    }
  },

  // Fail recovery policy
  failPolicy: {
    ...BASE_TEST_CONFIG,
    daemon: {
      ...BASE_TEST_CONFIG.daemon,
      orphanDetection: {
        ...BASE_TEST_CONFIG.daemon.orphanDetection,
        recoveryPolicy: 'fail' as const
      }
    }
  },

  // Retry recovery policy
  retryPolicy: {
    ...BASE_TEST_CONFIG,
    daemon: {
      ...BASE_TEST_CONFIG.daemon,
      orphanDetection: {
        ...BASE_TEST_CONFIG.daemon.orphanDetection,
        recoveryPolicy: 'retry' as const
      }
    }
  },

  // Shorter staleness threshold for testing
  shortStaleThreshold: {
    ...BASE_TEST_CONFIG,
    daemon: {
      ...BASE_TEST_CONFIG.daemon,
      orphanDetection: {
        ...BASE_TEST_CONFIG.daemon.orphanDetection,
        stalenessThreshold: 30000 // 30 seconds
      }
    }
  },

  // Periodic orphan detection enabled
  periodicOrphanCheck: {
    ...BASE_TEST_CONFIG,
    daemon: {
      ...BASE_TEST_CONFIG.daemon,
      orphanDetection: {
        ...BASE_TEST_CONFIG.daemon.orphanDetection,
        periodicCheck: true,
        periodicCheckInterval: 5000 // 5 seconds for testing
      }
    }
  }
};

// ============================================================================
// Test Infrastructure
// ============================================================================

describe('Queue Recovery Full Integration Tests', () => {
  let testProjectPath: string;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;
  let daemonRunner: DaemonRunner;
  let testConfig: ApexConfig;

  // Event tracking
  let orphanDetectedEvents: OrphanDetectedEvent[] = [];
  let orphanRecoveredEvents: OrphanRecoveredEvent[] = [];

  beforeEach(async () => {
    // Create unique test directory
    testProjectPath = join(
      __dirname,
      '..',
      '..',
      'test-data',
      `queue-recovery-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );

    // Setup project structure
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.apex'), { recursive: true });

    // Use base config as default
    testConfig = JSON.parse(JSON.stringify(BASE_TEST_CONFIG));

    // Write config file
    writeFileSync(
      join(testProjectPath, '.apex', 'config.yaml'),
      JSON.stringify(testConfig, null, 2)
    );

    // Initialize components
    store = new TaskStore(testProjectPath);
    await store.initialize();

    orchestrator = new ApexOrchestrator({ projectPath: testProjectPath });
    await orchestrator.initialize();

    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config: testConfig
    });

    // Reset event tracking
    orphanDetectedEvents = [];
    orphanRecoveredEvents = [];

    // Set up event listeners
    orchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
      orphanDetectedEvents.push(event);
    });

    orchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
      orphanRecoveredEvents.push(event);
    });
  });

  afterEach(async () => {
    // Cleanup daemon
    if (daemonRunner) {
      try {
        await daemonRunner.stop();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Close store
    if (store) {
      try {
        store.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Remove test directory
    try {
      rmSync(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Creates a test task with specified options
   */
  async function createTestTask(options: {
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    effort?: TaskEffort;
    workflow?: string;
    currentStage?: string;
    lastUpdatedAgo?: number;
    pauseReason?: string;
    pausedAt?: Date;
    resumeAfter?: Date;
    parentTaskId?: string;
    subtaskIds?: string[];
    retryCount?: number;
  } = {}): Promise<string> {
    const now = new Date();
    const updatedAt = options.lastUpdatedAgo
      ? new Date(now.getTime() - options.lastUpdatedAgo)
      : now;

    const task: Partial<Task> = {
      description: options.description || 'Test task for queue recovery',
      acceptanceCriteria: 'Task should be properly recovered',
      workflow: options.workflow || 'feature',
      autonomy: 'autonomous' as AutonomyLevel,
      status: options.status || 'pending',
      priority: options.priority || 'normal',
      effort: options.effort || 'medium',
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: options.retryCount || 0,
      maxRetries: 3,
      resumeAttempts: 0,
      currentStage: options.currentStage,
      parentTaskId: options.parentTaskId,
      subtaskIds: options.subtaskIds || [],
      createdAt: now,
      updatedAt: updatedAt,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    // Add status-specific fields
    if (options.status === 'paused' && options.pauseReason) {
      task.pausedAt = options.pausedAt || now;
      task.pauseReason = options.pauseReason;
      task.resumeAfter = options.resumeAfter;
    }

    const createdTask = await store.createTask(task as Task);

    // Update with status-specific changes if needed
    if (options.status === 'paused' && options.pauseReason) {
      await store.updateTask(createdTask.id, {
        status: 'paused',
        pausedAt: options.pausedAt || now,
        pauseReason: options.pauseReason,
        resumeAfter: options.resumeAfter,
        updatedAt: updatedAt
      });
    } else if (options.status === 'in-progress') {
      await store.updateTask(createdTask.id, {
        status: 'in-progress',
        currentStage: options.currentStage || 'implementation',
        updatedAt: updatedAt
      });
    }

    return createdTask.id;
  }

  /**
   * Creates an orphaned in-progress task (stale)
   */
  async function createOrphanedTask(
    description: string = 'Orphaned task',
    staleHours: number = 2,
    currentStage: string = 'implementation'
  ): Promise<string> {
    return createTestTask({
      description,
      status: 'in-progress',
      currentStage,
      lastUpdatedAgo: staleHours * 60 * 60 * 1000 // Convert hours to milliseconds
    });
  }

  /**
   * Creates a fresh in-progress task (not orphaned)
   */
  async function createFreshInProgressTask(
    description: string = 'Fresh in-progress task',
    currentStage: string = 'testing'
  ): Promise<string> {
    return createTestTask({
      description,
      status: 'in-progress',
      currentStage,
      lastUpdatedAgo: 10000 // 10 seconds ago
    });
  }

  /**
   * Creates a paused task ready for resumption
   */
  async function createPausedTask(
    pauseReason: string,
    description: string = 'Paused task',
    readyForResume: boolean = true
  ): Promise<string> {
    const resumeAfter = readyForResume
      ? new Date(Date.now() - 60000) // 1 minute ago (ready)
      : new Date(Date.now() + 3600000); // 1 hour in future (not ready)

    return createTestTask({
      description,
      status: 'paused',
      pauseReason,
      pausedAt: new Date(Date.now() - 1800000), // 30 minutes ago
      resumeAfter
    });
  }

  /**
   * Creates a parent task with subtasks
   */
  async function createParentTaskWithSubtasks(
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

    // Create parent task
    const parentId = await createTestTask({
      description: 'Parent task with subtasks',
      status: parentStatus,
      priority: 'high',
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
   * Simulates daemon restart by creating fresh instances
   */
  async function simulateDaemonRestart(
    config: ApexConfig = testConfig
  ): Promise<{ newStore: TaskStore; newOrchestrator: ApexOrchestrator; newRunner: DaemonRunner }> {
    // Close existing instances
    if (daemonRunner) {
      await daemonRunner.stop();
    }
    if (store) {
      store.close();
    }

    // Create fresh instances
    const newStore = new TaskStore(testProjectPath);
    await newStore.initialize();

    const newOrchestrator = new ApexOrchestrator({ projectPath: testProjectPath });
    await newOrchestrator.initialize();

    const newRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 1000,
      logToStdout: false,
      config
    });

    // Update config file if changed
    if (config !== testConfig) {
      writeFileSync(
        join(testProjectPath, '.apex', 'config.yaml'),
        JSON.stringify(config, null, 2)
      );
    }

    return { newStore, newOrchestrator, newRunner };
  }

  /**
   * Waits for orphan detection to complete
   */
  async function waitForOrphanDetection(timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (orphanDetectedEvents.length > 0) {
        return;
      }
    }
  }

  // ============================================================================
  // Test Cases: Basic Queue Recovery
  // ============================================================================

  describe('Basic Queue Recovery', () => {
    it('should detect and recover orphaned tasks on startup', async () => {
      // Create orphaned and fresh tasks
      const orphanedTaskId = await createOrphanedTask('Old orphaned task', 2);
      const freshTaskId = await createFreshInProgressTask('Fresh task');
      const pendingTaskId = await createTestTask({
        description: 'Pending task',
        status: 'pending'
      });

      // Verify initial state
      const orphanedTask = await store.getTask(orphanedTaskId);
      expect(orphanedTask?.status).toBe('in-progress');

      // Simulate daemon restart and enable event tracking
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Set up event listeners on new orchestrator
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon (triggers orphan detection)
      await newRunner.start();

      // Wait for orphan detection
      await waitForOrphanDetection();

      // Verify orphan detection event
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks[0].id).toBe(orphanedTaskId);
      expect(orphanDetectedEvents[0].reason).toBe('startup_check');
      expect(orphanDetectedEvents[0].stalenessThreshold).toBe(3600000);

      // Verify orphan recovery event
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].taskId).toBe(orphanedTaskId);
      expect(orphanRecoveredEvents[0].previousStatus).toBe('in-progress');
      expect(orphanRecoveredEvents[0].newStatus).toBe('pending');
      expect(orphanRecoveredEvents[0].action).toBe('reset_pending');

      // Verify task status was updated
      const recoveredTask = await newStore.getTask(orphanedTaskId);
      expect(recoveredTask?.status).toBe('pending');

      // Verify fresh task was not affected
      const freshTask = await newStore.getTask(freshTaskId);
      expect(freshTask?.status).toBe('in-progress');

      // Verify pending task was not affected
      const pendingTask = await newStore.getTask(pendingTaskId);
      expect(pendingTask?.status).toBe('pending');

      await newRunner.stop();
      newStore.close();
    });

    it('should preserve task queue ordering after orphan recovery', async () => {
      // Create tasks with specific creation order and priorities
      const urgentOrphanId = await createTestTask({
        description: 'Urgent orphaned task',
        status: 'in-progress',
        priority: 'urgent',
        lastUpdatedAgo: 2 * 60 * 60 * 1000, // 2 hours old
        currentStage: 'implementation'
      });

      const normalPendingId = await createTestTask({
        description: 'Normal pending task',
        status: 'pending',
        priority: 'normal'
      });

      const highOrphanId = await createTestTask({
        description: 'High priority orphaned task',
        status: 'in-progress',
        priority: 'high',
        lastUpdatedAgo: 3 * 60 * 60 * 1000, // 3 hours old
        currentStage: 'testing'
      });

      // Simulate daemon restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Set up event tracking
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify both orphans were detected
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(2);
      const detectedIds = orphanDetectedEvents[0].tasks.map(t => t.id);
      expect(detectedIds).toContain(urgentOrphanId);
      expect(detectedIds).toContain(highOrphanId);

      // Verify both were recovered
      expect(orphanRecoveredEvents).toHaveLength(2);

      // Verify queue ordering is maintained (priority-based)
      const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
      expect(readyTasks).toHaveLength(3);
      expect(readyTasks[0].priority).toBe('urgent');
      expect(readyTasks[1].priority).toBe('high');
      expect(readyTasks[2].priority).toBe('normal');

      await newRunner.stop();
      newStore.close();
    });

    it('should handle mixed task states correctly during recovery', async () => {
      // Create comprehensive task mix
      const orphanTaskId = await createOrphanedTask('Orphaned implementation task', 2, 'implementation');
      const pausedTaskId = await createPausedTask('capacity', 'Capacity paused task', true);
      const freshInProgressId = await createFreshInProgressTask('Fresh development task', 'development');
      const pendingTaskId = await createTestTask({ description: 'Normal pending task', status: 'pending' });
      const completedTaskId = await createTestTask({ description: 'Completed task', status: 'completed' });

      // Update completed task properly
      await store.updateTaskStatus(completedTaskId, 'completed', undefined, undefined);

      // Create parent with subtasks
      const { parentId, subtaskIds } = await createParentTaskWithSubtasks(2, 'paused', 'capacity');

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify only orphaned task was detected
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks[0].id).toBe(orphanTaskId);

      // Verify only orphaned task was recovered
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].taskId).toBe(orphanTaskId);

      // Verify final task states
      const orphanRecovered = await newStore.getTask(orphanTaskId);
      expect(orphanRecovered?.status).toBe('pending');

      const pausedTask = await newStore.getTask(pausedTaskId);
      expect(pausedTask?.status).toBe('paused');

      const freshTask = await newStore.getTask(freshInProgressId);
      expect(freshTask?.status).toBe('in-progress');

      const pendingTask = await newStore.getTask(pendingTaskId);
      expect(pendingTask?.status).toBe('pending');

      const completedTask = await newStore.getTask(completedTaskId);
      expect(completedTask?.status).toBe('completed');

      // Verify parent-subtask relationships preserved
      const parentTask = await newStore.getTask(parentId);
      expect(parentTask?.status).toBe('paused');
      expect(parentTask?.subtaskIds).toHaveLength(2);

      for (const subtaskId of subtaskIds) {
        const subtask = await newStore.getTask(subtaskId);
        expect(subtask?.parentTaskId).toBe(parentId);
        expect(subtask?.status).toBe('pending');
      }

      await newRunner.stop();
      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: Recovery Policy Variants
  // ============================================================================

  describe('Recovery Policy Variants', () => {
    it('should mark orphaned tasks as failed with fail recovery policy', async () => {
      // Create orphaned task
      const orphanTaskId = await createOrphanedTask('Task to be marked failed', 3, 'testing');

      // Restart with fail policy
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart(CONFIG_VARIANTS.failPolicy);

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify detection
      expect(orphanDetectedEvents).toHaveLength(1);

      // Verify recovery with fail action
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].taskId).toBe(orphanTaskId);
      expect(orphanRecoveredEvents[0].previousStatus).toBe('in-progress');
      expect(orphanRecoveredEvents[0].newStatus).toBe('failed');
      expect(orphanRecoveredEvents[0].action).toBe('marked_failed');

      // Verify task was marked as failed
      const failedTask = await newStore.getTask(orphanTaskId);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toContain('orphaned');

      await newRunner.stop();
      newStore.close();
    });

    it('should retry orphaned tasks with retry recovery policy', async () => {
      // Create orphaned task with some retry count
      const orphanTaskId = await createTestTask({
        description: 'Task to be retried',
        status: 'in-progress',
        lastUpdatedAgo: 2 * 60 * 60 * 1000, // 2 hours old
        retryCount: 1
      });

      // Restart with retry policy
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart(CONFIG_VARIANTS.retryPolicy);

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify detection and recovery
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].action).toBe('retry');

      // Verify task was reset to pending with incremented retry count
      const retriedTask = await newStore.getTask(orphanTaskId);
      expect(retriedTask?.status).toBe('pending');
      expect(retriedTask?.retryCount).toBe(2); // Should be incremented

      await newRunner.stop();
      newStore.close();
    });

    it('should not perform orphan detection when disabled in config', async () => {
      // Create orphaned task
      const orphanTaskId = await createOrphanedTask('Should not be detected', 5);

      // Restart with orphan detection disabled
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart(CONFIG_VARIANTS.orphanDisabled);

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();

      // Wait a bit to ensure no detection occurs
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify no events were emitted
      expect(orphanDetectedEvents).toHaveLength(0);
      expect(orphanRecoveredEvents).toHaveLength(0);

      // Verify task remains in-progress
      const unchangedTask = await newStore.getTask(orphanTaskId);
      expect(unchangedTask?.status).toBe('in-progress');

      await newRunner.stop();
      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: Complex Recovery Scenarios
  // ============================================================================

  describe('Complex Recovery Scenarios', () => {
    it('should handle orphan recovery with different staleness thresholds', async () => {
      // Create tasks with different ages
      const veryStaleTaskId = await createOrphanedTask('Very stale task', 3); // 3 hours old
      const moderatelyStaleTaskId = await createOrphanedTask('Moderately stale task', 1); // 1 hour old
      const recentTaskId = await createOrphanedTask('Recent task', 0.01); // ~36 seconds old

      // Use short staleness threshold (30 seconds)
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart(CONFIG_VARIANTS.shortStaleThreshold);

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // With 30 second threshold, all three should be detected as orphaned
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(3);
      expect(orphanDetectedEvents[0].stalenessThreshold).toBe(30000);

      // Verify all were recovered
      expect(orphanRecoveredEvents).toHaveLength(3);

      const detectedIds = orphanDetectedEvents[0].tasks.map(t => t.id);
      expect(detectedIds).toContain(veryStaleTaskId);
      expect(detectedIds).toContain(moderatelyStaleTaskId);
      expect(detectedIds).toContain(recentTaskId);

      await newRunner.stop();
      newStore.close();
    });

    it('should handle orphan detection for parent tasks with subtasks', async () => {
      // Create orphaned parent task
      const { parentId, subtaskIds } = await createParentTaskWithSubtasks(2, 'in-progress');

      // Make parent task stale
      await store.updateTask(parentId, {
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'in-progress',
        currentStage: 'implementation'
      });

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify parent was detected as orphaned
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks[0].id).toBe(parentId);

      // Verify parent was recovered
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].taskId).toBe(parentId);

      // Verify parent-subtask relationships were preserved
      const recoveredParent = await newStore.getTask(parentId);
      expect(recoveredParent?.status).toBe('pending');
      expect(recoveredParent?.subtaskIds).toEqual(subtaskIds);

      for (const subtaskId of subtaskIds) {
        const subtask = await newStore.getTask(subtaskId);
        expect(subtask?.parentTaskId).toBe(parentId);
        expect(subtask?.status).toBe('pending'); // Should remain unchanged
      }

      await newRunner.stop();
      newStore.close();
    });

    it('should handle multiple orphaned tasks across different workflows', async () => {
      // Create orphaned tasks in different workflows
      const featureOrphanId = await createTestTask({
        description: 'Orphaned feature task',
        status: 'in-progress',
        workflow: 'feature',
        currentStage: 'implementation',
        lastUpdatedAgo: 2 * 60 * 60 * 1000 // 2 hours old
      });

      const bugfixOrphanId = await createTestTask({
        description: 'Orphaned bugfix task',
        status: 'in-progress',
        workflow: 'bugfix',
        currentStage: 'investigation',
        lastUpdatedAgo: 3 * 60 * 60 * 1000 // 3 hours old
      });

      // Create some non-orphaned tasks
      const freshFeatureId = await createTestTask({
        description: 'Fresh feature task',
        status: 'in-progress',
        workflow: 'feature',
        currentStage: 'testing'
      });

      const pendingBugfixId = await createTestTask({
        description: 'Pending bugfix',
        status: 'pending',
        workflow: 'bugfix'
      });

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify both orphaned tasks were detected
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(2);

      const detectedIds = orphanDetectedEvents[0].tasks.map(t => t.id);
      expect(detectedIds).toContain(featureOrphanId);
      expect(detectedIds).toContain(bugfixOrphanId);

      // Verify both were recovered
      expect(orphanRecoveredEvents).toHaveLength(2);

      const featureTask = await newStore.getTask(featureOrphanId);
      const bugfixTask = await newStore.getTask(bugfixOrphanId);
      const freshTask = await newStore.getTask(freshFeatureId);
      const pendingTask = await newStore.getTask(pendingBugfixId);

      expect(featureTask?.status).toBe('pending');
      expect(bugfixTask?.status).toBe('pending');
      expect(freshTask?.status).toBe('in-progress');
      expect(pendingTask?.status).toBe('pending');

      await newRunner.stop();
      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: Event Integration
  // ============================================================================

  describe('Event Integration', () => {
    it('should emit comprehensive orphan detection events', async () => {
      // Create multiple orphaned tasks
      const orphan1Id = await createOrphanedTask('Orphan 1', 2, 'planning');
      const orphan2Id = await createOrphanedTask('Orphan 2', 4, 'implementation');
      const orphan3Id = await createOrphanedTask('Orphan 3', 1.5, 'testing');

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify detection event structure
      expect(orphanDetectedEvents).toHaveLength(1);
      const detectionEvent = orphanDetectedEvents[0];

      expect(detectionEvent.tasks).toHaveLength(3);
      expect(detectionEvent.reason).toBe('startup_check');
      expect(detectionEvent.stalenessThreshold).toBe(3600000);
      expect(detectionEvent.detectedAt).toBeInstanceOf(Date);

      // Verify all tasks in event have required fields
      for (const task of detectionEvent.tasks) {
        expect(task.id).toBeDefined();
        expect(task.status).toBe('in-progress');
        expect(task.currentStage).toBeDefined();
        expect(task.updatedAt).toBeInstanceOf(Date);
      }

      // Verify recovery events
      expect(orphanRecoveredEvents).toHaveLength(3);

      for (const recoveryEvent of orphanRecoveredEvents) {
        expect(recoveryEvent.taskId).toBeDefined();
        expect(recoveryEvent.previousStatus).toBe('in-progress');
        expect(recoveryEvent.newStatus).toBe('pending');
        expect(recoveryEvent.action).toBe('reset_pending');
        expect(recoveryEvent.message).toContain('orphaned');
        expect(recoveryEvent.timestamp).toBeInstanceOf(Date);
      }

      await newRunner.stop();
      newStore.close();
    });

    it('should not emit events when no orphans are detected', async () => {
      // Create only fresh tasks
      await createFreshInProgressTask('Fresh task 1');
      await createTestTask({ description: 'Pending task', status: 'pending' });
      await createTestTask({ description: 'Completed task', status: 'completed' });

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await newRunner.start();

      // Wait to ensure no events are emitted
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify no events
      expect(orphanDetectedEvents).toHaveLength(0);
      expect(orphanRecoveredEvents).toHaveLength(0);

      await newRunner.stop();
      newStore.close();
    });
  });

  // ============================================================================
  // Test Cases: Integration Validation
  // ============================================================================

  describe('Full Integration Validation', () => {
    it('should handle complete restart scenario with comprehensive task mix', async () => {
      // Create comprehensive task scenario
      const tasks = await Promise.all([
        // Orphaned tasks (should be recovered)
        createOrphanedTask('Orphaned high priority task', 3, 'implementation'),
        createOrphanedTask('Orphaned normal task', 2, 'testing'),

        // Fresh in-progress tasks (should remain unchanged)
        createFreshInProgressTask('Fresh implementation task', 'implementation'),

        // Paused tasks (should remain unchanged but ready for resume)
        createPausedTask('capacity', 'Capacity paused task', true),
        createPausedTask('budget', 'Budget paused task', false), // Not ready for resume

        // Regular pending tasks (should remain unchanged)
        createTestTask({ description: 'High priority pending', status: 'pending', priority: 'high' }),
        createTestTask({ description: 'Normal pending task', status: 'pending', priority: 'normal' }),

        // Completed tasks (should remain unchanged)
        createTestTask({ description: 'Completed task 1', status: 'completed' }),
      ]);

      // Create parent task with subtasks
      const { parentId, subtaskIds } = await createParentTaskWithSubtasks(3, 'paused', 'capacity');

      // Get initial stats
      const initialTasks = await store.getAllTasks();
      const initialCounts = {
        total: initialTasks.length,
        orphaned: initialTasks.filter(t => t.status === 'in-progress' &&
                   Date.now() - t.updatedAt.getTime() > 3600000).length,
        pending: initialTasks.filter(t => t.status === 'pending').length,
        paused: initialTasks.filter(t => t.status === 'paused').length,
        completed: initialTasks.filter(t => t.status === 'completed').length
      };

      // Simulate complete daemon restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Track events
      orphanDetectedEvents = [];
      orphanRecoveredEvents = [];

      newOrchestrator.on('orphan:detected', (event: OrphanDetectedEvent) => {
        orphanDetectedEvents.push(event);
      });

      newOrchestrator.on('orphan:recovered', (event: OrphanRecoveredEvent) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon (triggers recovery)
      await newRunner.start();
      await waitForOrphanDetection();

      // Verify recovery events
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(initialCounts.orphaned);
      expect(orphanRecoveredEvents).toHaveLength(initialCounts.orphaned);

      // Get final stats
      const finalTasks = await newStore.getAllTasks();
      const finalCounts = {
        total: finalTasks.length,
        pending: finalTasks.filter(t => t.status === 'pending').length,
        inProgress: finalTasks.filter(t => t.status === 'in-progress').length,
        paused: finalTasks.filter(t => t.status === 'paused').length,
        completed: finalTasks.filter(t => t.status === 'completed').length
      };

      // Verify task counts
      expect(finalCounts.total).toBe(initialCounts.total);
      expect(finalCounts.pending).toBe(initialCounts.pending + initialCounts.orphaned);
      expect(finalCounts.paused).toBe(initialCounts.paused);
      expect(finalCounts.completed).toBe(initialCounts.completed);

      // Verify queue integrity
      const readyTasks = await newStore.getReadyTasks({ orderByPriority: true });
      expect(readyTasks.length).toBeGreaterThanOrEqual(2); // At least recovered + pending

      const pausedTasksForResume = await newStore.getPausedTasksForResume();
      expect(pausedTasksForResume.length).toBeGreaterThanOrEqual(1); // At least the capacity paused task

      // Verify parent-subtask relationships
      const parentTask = await newStore.getTask(parentId);
      expect(parentTask?.subtaskIds).toHaveLength(3);

      for (const subtaskId of subtaskIds) {
        const subtask = await newStore.getTask(subtaskId);
        expect(subtask?.parentTaskId).toBe(parentId);
      }

      await newRunner.stop();
      newStore.close();
    });
  });
});