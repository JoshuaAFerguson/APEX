import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator, TasksAutoResumedEvent, Task, TaskStatus, TaskPriority } from './index';
import { TaskStore } from './store';
import { DaemonRunner } from './runner';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TasksAutoResumedEvent Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;
  let daemonRunner: DaemonRunner;

  beforeEach(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-auto-resume-test-'));

    // Create .apex directory structure
    const apexDir = path.join(testDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

    // Create test config
    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  language: typescript
  framework: node

daemon:
  mode: autonomous
  pollInterval: 1000

limits:
  maxConcurrentTasks: 2
  tokenUsage:
    maxPerTask: 10000
    maxPerHour: 100000
`);

    // Create test workflow
    await fs.writeFile(path.join(apexDir, 'workflows', 'test-workflow.yaml'), `
name: test-workflow
description: Test workflow for auto-resume
stages:
  - name: test
    agent: test-agent
`);

    // Create test agent
    await fs.writeFile(path.join(apexDir, 'agents', 'test-agent.md'), `---
name: test-agent
description: Test agent for auto-resume
tools: []
---

You are a test agent.
`);

    // Initialize orchestrator and store
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
    store = orchestrator['store'];

    // Initialize daemon runner
    daemonRunner = new DaemonRunner(
      orchestrator,
      { pollIntervalMs: 100, enableLogging: false },
      process.stdout
    );
  });

  afterEach(async () => {
    try {
      await daemonRunner.stop();
    } catch {
      // Ignore cleanup errors
    }

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Enhanced Event Emission', () => {
    it('should emit TasksAutoResumedEvent with resumeReason and contextSummary', async () => {
      let capturedEvent: TasksAutoResumedEvent | null = null;

      await daemonRunner.start();

      // Listen for the enhanced auto-resumed event
      orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
        capturedEvent = event;
      });

      // Create multiple paused tasks with different contexts
      const tasks = [
        {
          description: 'Implement user authentication system',
          acceptanceCriteria: 'Users can login and logout securely',
          pauseReason: 'budget',
        },
        {
          description: 'Fix critical bug in payment processing',
          acceptanceCriteria: 'Payments process without errors',
          pauseReason: 'capacity',
        },
        {
          description: 'Update documentation for API endpoints',
          acceptanceCriteria: 'All endpoints are documented',
          pauseReason: 'usage_limit',
        },
      ];

      const taskIds: string[] = [];

      for (const taskInfo of tasks) {
        const taskData: Partial<Task> = {
          description: taskInfo.description,
          acceptanceCriteria: taskInfo.acceptanceCriteria,
          workflow: 'test-workflow',
          autonomy: 'autonomous',
          status: 'paused' as TaskStatus,
          priority: 'normal' as TaskPriority,
          projectPath: testDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
          },
        };

        const taskId = await store.createTask(taskData as Task);
        taskIds.push(taskId);

        // Mark as paused with specific reason
        await store.updateTask(taskId, {
          status: 'paused',
          pausedAt: new Date(),
          pauseReason: taskInfo.pauseReason,
          updatedAt: new Date(),
        });
      }

      // Mock resumePausedTask to simulate partial success
      const mockResumePausedTask = vi.spyOn(orchestrator, 'resumePausedTask')
        .mockImplementation(async (taskId: string) => {
          // Simulate failure for the third task
          if (taskId === taskIds[2]) {
            throw new Error('Documentation task requires manual review');
          }
          return true;
        });

      // Trigger capacity restored event manually
      const mockCapacityEvent = {
        reason: 'mode_switch' as const,
        timestamp: new Date(),
        previousUsage: { tokens: 5000, cost: 0.01, tasks: 2 },
        currentUsage: { tokens: 2000, cost: 0.005, tasks: 1 },
        modeInfo: { currentMode: 'night', modeStartTime: new Date(), isActiveHours: false },
      };

      // Use internal method to trigger the event
      await (daemonRunner as any).handleCapacityRestored(mockCapacityEvent);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event was captured
      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent).toBeDefined();

      if (capturedEvent) {
        // Verify basic event structure
        expect(capturedEvent.reason).toBe('mode_switch');
        expect(capturedEvent.totalTasks).toBe(3);
        expect(capturedEvent.resumedCount).toBe(2);
        expect(capturedEvent.errors).toHaveLength(1);
        expect(capturedEvent.timestamp).toBeInstanceOf(Date);

        // Verify enhanced fields are present
        expect(capturedEvent.resumeReason).toBeDefined();
        expect(capturedEvent.resumeReason).toBeTruthy();
        expect(typeof capturedEvent.resumeReason).toBe('string');

        expect(capturedEvent.contextSummary).toBeDefined();
        expect(capturedEvent.contextSummary).toBeTruthy();
        expect(typeof capturedEvent.contextSummary).toBe('string');

        // Verify resumeReason contains relevant information
        expect(capturedEvent.resumeReason).toContain('mode_switch');

        // Verify contextSummary contains task information
        expect(capturedEvent.contextSummary).toContain('2'); // resumed count
        expect(capturedEvent.contextSummary).toContain('3'); // total tasks

        // Verify error is captured correctly
        expect(capturedEvent.errors[0].taskId).toBe(taskIds[2]);
        expect(capturedEvent.errors[0].error).toContain('Documentation task requires manual review');
      }

      expect(mockResumePausedTask).toHaveBeenCalledTimes(3);
      await daemonRunner.stop();
    });

    it('should generate contextSummary based on task descriptions', async () => {
      let capturedEvent: TasksAutoResumedEvent | null = null;

      await daemonRunner.start();

      orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
        capturedEvent = event;
      });

      // Create tasks with descriptive names
      const taskDescriptions = [
        'Feature: Add real-time chat functionality',
        'Bug Fix: Resolve memory leak in data processing',
        'Refactor: Optimize database query performance',
        'Documentation: Update API integration guide',
      ];

      const taskIds: string[] = [];

      for (const description of taskDescriptions) {
        const taskData: Partial<Task> = {
          description,
          workflow: 'test-workflow',
          autonomy: 'autonomous',
          status: 'paused' as TaskStatus,
          priority: 'normal' as TaskPriority,
          projectPath: testDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
          },
        };

        const taskId = await store.createTask(taskData as Task);
        taskIds.push(taskId);

        await store.updateTask(taskId, {
          status: 'paused',
          pausedAt: new Date(),
          pauseReason: 'budget',
          updatedAt: new Date(),
        });
      }

      // Mock all resumes to succeed
      vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Trigger budget reset event
      const mockCapacityEvent = {
        reason: 'budget_reset' as const,
        timestamp: new Date(),
        previousUsage: { tokens: 0, cost: 0, tasks: 0 },
        currentUsage: { tokens: 0, cost: 0, tasks: 0 },
        modeInfo: { currentMode: 'day', modeStartTime: new Date(), isActiveHours: true },
      };

      await (daemonRunner as any).handleCapacityRestored(mockCapacityEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(capturedEvent).not.toBeNull();

      if (capturedEvent) {
        // Verify that contextSummary reflects the task types
        const summary = capturedEvent.contextSummary!;

        // Should mention the different types of tasks
        const hasFeature = summary.toLowerCase().includes('feature') || summary.toLowerCase().includes('chat');
        const hasBugFix = summary.toLowerCase().includes('bug') || summary.toLowerCase().includes('memory');
        const hasRefactor = summary.toLowerCase().includes('refactor') || summary.toLowerCase().includes('optimize');
        const hasDocumentation = summary.toLowerCase().includes('documentation') || summary.toLowerCase().includes('api');

        // At least some task types should be mentioned
        const mentionedTypes = [hasFeature, hasBugFix, hasRefactor, hasDocumentation].filter(Boolean).length;
        expect(mentionedTypes).toBeGreaterThan(0);

        // Summary should indicate success
        expect(summary).toMatch(/(\d+|all|successfully)/i);
      }

      await daemonRunner.stop();
    });

    it('should handle empty task list gracefully', async () => {
      let capturedEvent: TasksAutoResumedEvent | null = null;

      await daemonRunner.start();

      orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
        capturedEvent = event;
      });

      // Trigger capacity event with no paused tasks
      const mockCapacityEvent = {
        reason: 'capacity_dropped' as const,
        timestamp: new Date(),
        previousUsage: { tokens: 10000, cost: 0.02, tasks: 3 },
        currentUsage: { tokens: 5000, cost: 0.01, tasks: 2 },
        modeInfo: { currentMode: 'day', modeStartTime: new Date(), isActiveHours: true },
      };

      await (daemonRunner as any).handleCapacityRestored(mockCapacityEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not emit event when there are no tasks to resume
      expect(capturedEvent).toBeNull();

      await daemonRunner.stop();
    });

    it('should provide detailed resumeReason for different capacity events', async () => {
      const capturedEvents: TasksAutoResumedEvent[] = [];

      await daemonRunner.start();

      orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
        capturedEvents.push(event);
      });

      // Create a single paused task for each test scenario
      const createPausedTask = async (pauseReason: string) => {
        const taskData: Partial<Task> = {
          description: 'Test task',
          workflow: 'test-workflow',
          autonomy: 'autonomous',
          status: 'paused' as TaskStatus,
          priority: 'normal' as TaskPriority,
          projectPath: testDir,
          branchName: 'test-branch',
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
          },
        };

        const taskId = await store.createTask(taskData as Task);
        await store.updateTask(taskId, {
          status: 'paused',
          pausedAt: new Date(),
          pauseReason,
          updatedAt: new Date(),
        });

        return taskId;
      };

      // Mock successful resumes
      vi.spyOn(orchestrator, 'resumePausedTask').mockResolvedValue(true);

      // Test different capacity event types
      const eventTypes = [
        {
          reason: 'budget_reset' as const,
          description: 'Budget reset at midnight',
        },
        {
          reason: 'mode_switch' as const,
          description: 'Mode switch from day to night',
        },
        {
          reason: 'capacity_dropped' as const,
          description: 'System load decreased',
        },
        {
          reason: 'usage_limit' as const,
          description: 'Usage limits restored',
        },
      ];

      for (const eventType of eventTypes) {
        // Create fresh task for each event
        await createPausedTask('budget');

        const mockEvent = {
          reason: eventType.reason,
          timestamp: new Date(),
          previousUsage: { tokens: 8000, cost: 0.016, tasks: 2 },
          currentUsage: { tokens: 2000, cost: 0.004, tasks: 1 },
          modeInfo: { currentMode: 'night', modeStartTime: new Date(), isActiveHours: false },
        };

        await (daemonRunner as any).handleCapacityRestored(mockEvent);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Verify we got events for each type
      expect(capturedEvents).toHaveLength(eventTypes.length);

      for (let i = 0; i < eventTypes.length; i++) {
        const event = capturedEvents[i];
        const expectedReason = eventTypes[i].reason;

        expect(event.reason).toBe(expectedReason);
        expect(event.resumeReason).toBeDefined();
        expect(event.resumeReason).toBeTruthy();

        // Verify resumeReason is contextually appropriate
        const reason = event.resumeReason!.toLowerCase();

        switch (expectedReason) {
          case 'budget_reset':
            expect(reason).toMatch(/(budget|reset|midnight|limit)/);
            break;
          case 'mode_switch':
            expect(reason).toMatch(/(mode|switch|night|day)/);
            break;
          case 'capacity_dropped':
            expect(reason).toMatch(/(capacity|load|decreased|available)/);
            break;
          case 'usage_limit':
            expect(reason).toMatch(/(usage|limit|restored|quota)/);
            break;
        }
      }

      await daemonRunner.stop();
    });
  });

  describe('Error Handling in Enhanced Events', () => {
    it('should include error details in contextSummary when tasks fail to resume', async () => {
      let capturedEvent: TasksAutoResumedEvent | null = null;

      await daemonRunner.start();

      orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
        capturedEvent = event;
      });

      // Create tasks that will fail to resume
      const taskData: Partial<Task> = {
        description: 'Critical system task requiring special permissions',
        workflow: 'test-workflow',
        autonomy: 'autonomous',
        status: 'paused' as TaskStatus,
        priority: 'urgent' as TaskPriority,
        projectPath: testDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
      };

      const taskId = await store.createTask(taskData as Task);
      await store.updateTask(taskId, {
        status: 'paused',
        pausedAt: new Date(),
        pauseReason: 'capacity',
        updatedAt: new Date(),
      });

      // Mock resume to fail with specific error
      vi.spyOn(orchestrator, 'resumePausedTask')
        .mockRejectedValue(new Error('Insufficient security clearance for system task'));

      const mockCapacityEvent = {
        reason: 'capacity_restored' as const,
        timestamp: new Date(),
        previousUsage: { tokens: 15000, cost: 0.03, tasks: 3 },
        currentUsage: { tokens: 8000, cost: 0.016, tasks: 2 },
        modeInfo: { currentMode: 'day', modeStartTime: new Date(), isActiveHours: true },
      };

      await (daemonRunner as any).handleCapacityRestored(mockCapacityEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(capturedEvent).not.toBeNull();

      if (capturedEvent) {
        expect(capturedEvent.resumedCount).toBe(0);
        expect(capturedEvent.errors).toHaveLength(1);
        expect(capturedEvent.errors[0].error).toContain('Insufficient security clearance');

        // contextSummary should mention the failure
        expect(capturedEvent.contextSummary).toBeDefined();
        const summary = capturedEvent.contextSummary!.toLowerCase();
        expect(summary).toMatch(/(failed|error|unable|security)/);
      }

      await daemonRunner.stop();
    });
  });
});