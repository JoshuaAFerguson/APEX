/**
 * Core Queue Recovery Tests
 *
 * This test suite verifies the essential queue recovery functionality:
 * 1. Basic orphan detection and recovery on daemon restart
 * 2. Event emission for orphan:detected and orphan:recovered
 * 3. Task state preservation and queue ordering
 *
 * This is a focused test suite to validate core functionality works.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { TaskStore } from './store';
import { ApexOrchestrator, OrphanDetectedEvent, OrphanRecoveredEvent } from './index';
import { DaemonRunner } from './runner';
import type {
  Task,
  TaskStatus,
  ApexConfig,
  AutonomyLevel
} from '@apexcli/core';

// ============================================================================
// Test Configuration
// ============================================================================

const CORE_TEST_CONFIG: ApexConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      name: 'test-agent',
      description: 'Test agent for core queue recovery',
      prompt: 'You are a test agent.',
    }
  },
  workflows: {
    'feature': {
      name: 'Feature Workflow',
      description: 'Test feature workflow',
      stages: [
        { name: 'planning', agent: 'test-agent', description: 'Plan the feature' },
        { name: 'implementation', agent: 'test-agent', description: 'Implement feature' },
        { name: 'testing', agent: 'test-agent', description: 'Test feature' }
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
// Core Queue Recovery Tests
// ============================================================================

describe('Core Queue Recovery Tests', () => {
  let testProjectPath: string;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;
  let daemonRunner: DaemonRunner;

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
      `core-queue-recovery-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );

    // Setup project structure
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.apex'), { recursive: true });

    // Write config file
    writeFileSync(
      join(testProjectPath, '.apex', 'config.yaml'),
      JSON.stringify(CORE_TEST_CONFIG, null, 2)
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
      config: CORE_TEST_CONFIG
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
    // Cleanup
    if (daemonRunner) {
      try {
        await daemonRunner.stop();
      } catch {
        // Ignore cleanup errors
      }
    }

    if (store) {
      try {
        store.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Remove test directory
    if (existsSync(testProjectPath)) {
      try {
        rmSync(testProjectPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function createBasicTask(
    description: string = 'Test task',
    status: TaskStatus = 'pending',
    lastUpdatedAgo?: number
  ): Promise<string> {
    const now = new Date();
    const updatedAt = lastUpdatedAgo
      ? new Date(now.getTime() - lastUpdatedAgo)
      : now;

    const task: Partial<Task> = {
      description,
      acceptanceCriteria: 'Task should work correctly',
      workflow: 'feature',
      autonomy: 'autonomous' as AutonomyLevel,
      status,
      priority: 'normal',
      effort: 'medium',
      projectPath: testProjectPath,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      currentStage: status === 'in-progress' ? 'implementation' : undefined,
      createdAt: now,
      updatedAt: updatedAt,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };

    const createdTask = await store.createTask(task as Task);

    // Update status if needed
    if (status === 'in-progress') {
      await store.updateTask(createdTask.id, {
        status: 'in-progress',
        currentStage: 'implementation',
        updatedAt: updatedAt
      });
    }

    return createdTask.id;
  }

  async function createOrphanedTask(
    description: string = 'Orphaned task'
  ): Promise<string> {
    // Create task that's 2 hours old (well over 1 hour threshold)
    return createBasicTask(description, 'in-progress', 2 * 60 * 60 * 1000);
  }

  async function createFreshTask(
    description: string = 'Fresh task'
  ): Promise<string> {
    // Create task that's 10 seconds old (well under 1 hour threshold)
    return createBasicTask(description, 'in-progress', 10000);
  }

  async function simulateDaemonRestart(): Promise<{
    newStore: TaskStore;
    newOrchestrator: ApexOrchestrator;
    newRunner: DaemonRunner;
  }> {
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
      config: CORE_TEST_CONFIG
    });

    return { newStore, newOrchestrator, newRunner };
  }

  async function waitForOrphanDetection(timeoutMs: number = 3000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (orphanDetectedEvents.length > 0) {
        return;
      }
    }
  }

  // ============================================================================
  // Test Cases
  // ============================================================================

  describe('Basic Orphan Detection', () => {
    it('should detect orphaned task on daemon startup', async () => {
      // Create orphaned task
      const orphanedTaskId = await createOrphanedTask('Test orphaned task');

      // Verify initial state
      const orphanedTask = await store.getTask(orphanedTaskId);
      expect(orphanedTask?.status).toBe('in-progress');

      // Simulate daemon restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Reset event tracking for new orchestrator
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

      // Verify orphan detection
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks[0].id).toBe(orphanedTaskId);
      expect(orphanDetectedEvents[0].reason).toBe('startup_check');

      // Verify orphan recovery
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].taskId).toBe(orphanedTaskId);
      expect(orphanRecoveredEvents[0].previousStatus).toBe('in-progress');
      expect(orphanRecoveredEvents[0].newStatus).toBe('pending');

      // Verify task was recovered
      const recoveredTask = await newStore.getTask(orphanedTaskId);
      expect(recoveredTask?.status).toBe('pending');

      await newRunner.stop();
      newStore.close();
    });

    it('should not detect fresh in-progress tasks as orphaned', async () => {
      // Create fresh in-progress task
      const freshTaskId = await createFreshTask('Fresh in-progress task');

      // Verify initial state
      const freshTask = await store.getTask(freshTaskId);
      expect(freshTask?.status).toBe('in-progress');

      // Simulate daemon restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Reset event tracking
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

      // Verify no orphan events
      expect(orphanDetectedEvents).toHaveLength(0);
      expect(orphanRecoveredEvents).toHaveLength(0);

      // Verify task remains in-progress
      const unchangedTask = await newStore.getTask(freshTaskId);
      expect(unchangedTask?.status).toBe('in-progress');

      await newRunner.stop();
      newStore.close();
    });

    it('should handle mixed orphaned and fresh tasks correctly', async () => {
      // Create mixed task scenario
      const orphanedTaskId = await createOrphanedTask('Orphaned task');
      const freshTaskId = await createFreshTask('Fresh task');
      const pendingTaskId = await createBasicTask('Pending task', 'pending');

      // Simulate daemon restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Reset event tracking
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
      expect(orphanDetectedEvents[0].tasks[0].id).toBe(orphanedTaskId);

      // Verify only orphaned task was recovered
      expect(orphanRecoveredEvents).toHaveLength(1);
      expect(orphanRecoveredEvents[0].taskId).toBe(orphanedTaskId);

      // Verify final states
      const orphanTask = await newStore.getTask(orphanedTaskId);
      const freshTask = await newStore.getTask(freshTaskId);
      const pendingTask = await newStore.getTask(pendingTaskId);

      expect(orphanTask?.status).toBe('pending');
      expect(freshTask?.status).toBe('in-progress');
      expect(pendingTask?.status).toBe('pending');

      await newRunner.stop();
      newStore.close();
    });
  });

  describe('Event Validation', () => {
    it('should emit complete event data for orphan detection', async () => {
      // Create orphaned task
      const orphanedTaskId = await createOrphanedTask('Event test task');

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Reset event tracking
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

      expect(detectionEvent.tasks).toHaveLength(1);
      expect(detectionEvent.reason).toBe('startup_check');
      expect(detectionEvent.stalenessThreshold).toBe(3600000);
      expect(detectionEvent.detectedAt).toBeInstanceOf(Date);

      // Verify task data in event
      const taskInEvent = detectionEvent.tasks[0];
      expect(taskInEvent.id).toBe(orphanedTaskId);
      expect(taskInEvent.status).toBe('in-progress');
      expect(taskInEvent.updatedAt).toBeInstanceOf(Date);

      // Verify recovery event structure
      expect(orphanRecoveredEvents).toHaveLength(1);
      const recoveryEvent = orphanRecoveredEvents[0];

      expect(recoveryEvent.taskId).toBe(orphanedTaskId);
      expect(recoveryEvent.previousStatus).toBe('in-progress');
      expect(recoveryEvent.newStatus).toBe('pending');
      expect(recoveryEvent.action).toBe('reset_pending');
      expect(recoveryEvent.message).toContain('orphaned');
      expect(recoveryEvent.timestamp).toBeInstanceOf(Date);

      await newRunner.stop();
      newStore.close();
    });

    it('should not emit events when no orphans are found', async () => {
      // Create only fresh and pending tasks
      await createFreshTask('Fresh task 1');
      await createBasicTask('Pending task', 'pending');
      await createBasicTask('Completed task', 'completed');

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Reset event tracking
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

  describe('Queue State Preservation', () => {
    it('should maintain task count and basic queue integrity after recovery', async () => {
      // Create diverse task set
      const orphanId1 = await createOrphanedTask('Orphan 1');
      const orphanId2 = await createOrphanedTask('Orphan 2');
      const freshId = await createFreshTask('Fresh task');
      const pendingId = await createBasicTask('Pending task', 'pending');

      // Get initial counts
      const initialTasks = await store.getAllTasks();
      expect(initialTasks).toHaveLength(4);

      const initialOrphans = initialTasks.filter(t =>
        t.status === 'in-progress' &&
        Date.now() - t.updatedAt.getTime() > 3600000
      );
      expect(initialOrphans).toHaveLength(2);

      // Simulate restart
      const { newStore, newOrchestrator, newRunner } = await simulateDaemonRestart();

      // Reset event tracking
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

      // Verify recovery
      expect(orphanDetectedEvents).toHaveLength(1);
      expect(orphanDetectedEvents[0].tasks).toHaveLength(2);
      expect(orphanRecoveredEvents).toHaveLength(2);

      // Get final counts
      const finalTasks = await newStore.getAllTasks();
      expect(finalTasks).toHaveLength(4); // Same total count

      const finalPending = finalTasks.filter(t => t.status === 'pending');
      const finalInProgress = finalTasks.filter(t => t.status === 'in-progress');

      expect(finalPending).toHaveLength(3); // 1 original + 2 recovered orphans
      expect(finalInProgress).toHaveLength(1); // 1 fresh task

      // Verify specific tasks
      const orphan1Final = await newStore.getTask(orphanId1);
      const orphan2Final = await newStore.getTask(orphanId2);
      const freshFinal = await newStore.getTask(freshId);
      const pendingFinal = await newStore.getTask(pendingId);

      expect(orphan1Final?.status).toBe('pending');
      expect(orphan2Final?.status).toBe('pending');
      expect(freshFinal?.status).toBe('in-progress');
      expect(pendingFinal?.status).toBe('pending');

      await newRunner.stop();
      newStore.close();
    });
  });
});