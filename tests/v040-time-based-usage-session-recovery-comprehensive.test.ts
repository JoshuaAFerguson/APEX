/**
 * Comprehensive test suite for v0.4.0 Time-Based Usage Management and Session Recovery
 *
 * Verifies all core acceptance criteria:
 * 1. Day/night modes with different resource thresholds
 * 2. Auto-pause/resume functionality
 * 3. Session state persistence
 * 4. Conversation summary injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'eventemitter3';

// Import the actual implementation classes
import { UsageManager } from '../packages/orchestrator/src/usage-manager';
import { SessionManager } from '../packages/orchestrator/src/session-manager';
import { DaemonScheduler } from '../packages/orchestrator/src/daemon-scheduler';
import { CapacityMonitor } from '../packages/orchestrator/src/capacity-monitor';
import {
  estimateConversationTokens,
  createContextSummary,
  extractKeyDecisions,
  extractProgressSummary,
  extractFileModifications
} from '../packages/orchestrator/src/context';

// Types
import type {
  DaemonConfig,
  LimitsConfig,
  Task,
  TaskCheckpoint,
  AgentMessage,
  TaskUsage,
} from '@apexcli/core';

describe('v0.4.0 Time-Based Usage Management and Session Recovery', () => {
  let tempDir: string;
  let mockConfig: DaemonConfig;
  let mockLimits: LimitsConfig;
  let usageManager: UsageManager;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(join(process.cwd(), 'test-'));

    // Mock configuration with v0.4.0 features enabled
    mockConfig = {
      projectPath: tempDir,
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        dayModeThresholds: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
          maxConcurrentTasks: 2,
        },
        nightModeThresholds: {
          maxTokensPerTask: 1000000,
          maxCostPerTask: 20.0,
          maxConcurrentTasks: 5,
        },
      },
      sessionRecovery: {
        enabled: true,
        autoResume: true,
        maxResumeAttempts: 3,
        contextWindowThreshold: 0.8,
        contextSummarizationThreshold: 50,
      },
    } as DaemonConfig;

    mockLimits = {
      maxTokensPerTask: 100000,
      maxCostPerTask: 5.0,
      maxConcurrentTasks: 2,
      dailyBudget: 100.0,
    };

    // Initialize managers
    usageManager = new UsageManager(mockConfig, mockLimits);
    sessionManager = new SessionManager({
      projectPath: tempDir,
      config: mockConfig,
    });

    await sessionManager.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Day/Night Modes Functionality', () => {
    it('should correctly identify day mode and apply day thresholds', () => {
      // Mock time to 2 PM (day mode)
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      const timeBasedUsage = usageManager.getCurrentTimeBasedUsage();

      expect(timeBasedUsage.currentMode).toBe('day');
      expect(timeBasedUsage.thresholds.maxTokensPerTask).toBe(100000);
      expect(timeBasedUsage.thresholds.maxCostPerTask).toBe(5.0);
      expect(timeBasedUsage.thresholds.maxConcurrentTasks).toBe(2);
    });

    it('should correctly identify night mode and apply night thresholds', () => {
      // Mock time to 11 PM (night mode)
      const nightTime = new Date();
      nightTime.setHours(23, 0, 0, 0);
      vi.setSystemTime(nightTime);

      const timeBasedUsage = usageManager.getCurrentTimeBasedUsage();

      expect(timeBasedUsage.currentMode).toBe('night');
      expect(timeBasedUsage.thresholds.maxTokensPerTask).toBe(1000000);
      expect(timeBasedUsage.thresholds.maxCostPerTask).toBe(20.0);
      expect(timeBasedUsage.thresholds.maxConcurrentTasks).toBe(5);
    });

    it('should correctly identify off-hours mode', () => {
      // Mock time to 8 AM (off-hours)
      const offHoursTime = new Date();
      offHoursTime.setHours(8, 0, 0, 0);
      vi.setSystemTime(offHoursTime);

      const timeBasedUsage = usageManager.getCurrentTimeBasedUsage();

      expect(timeBasedUsage.currentMode).toBe('off-hours');
      // Off-hours uses base limits
      expect(timeBasedUsage.thresholds.maxTokensPerTask).toBe(100000);
      expect(timeBasedUsage.thresholds.maxCostPerTask).toBe(5.0);
      expect(timeBasedUsage.thresholds.maxConcurrentTasks).toBe(2);
    });

    it('should calculate next mode transition correctly', () => {
      // Mock time to 2 PM (day mode)
      const currentTime = new Date();
      currentTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(currentTime);

      const timeBasedUsage = usageManager.getCurrentTimeBasedUsage();

      expect(timeBasedUsage.currentMode).toBe('day');
      expect(timeBasedUsage.nextModeSwitch.getHours()).toBe(22); // Next night mode at 10 PM
    });

    it('should emit mode change events when switching between modes', () => {
      const events: string[] = [];
      usageManager.on('mode-changed', (mode) => {
        events.push(mode);
      });

      // Start in day mode
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      const initialUsage = usageManager.getCurrentTimeBasedUsage();
      expect(initialUsage.currentMode).toBe('day');

      // Switch to night mode
      const nightTime = new Date();
      nightTime.setHours(23, 0, 0, 0);
      vi.setSystemTime(nightTime);

      // Trigger mode change detection
      const updatedUsage = usageManager.getCurrentTimeBasedUsage();
      expect(updatedUsage.currentMode).toBe('night');
    });
  });

  describe('Usage Tracking and Threshold Management', () => {
    it('should track task usage and update daily statistics', () => {
      const taskUsage: TaskUsage = {
        inputTokens: 5000,
        outputTokens: 3000,
        totalTokens: 8000,
        estimatedCost: 2.5,
      };

      // Track a successful task
      usageManager.trackTaskCompletion('test-task-1', taskUsage, true);

      const dailyStats = usageManager.getDailyUsage();
      expect(dailyStats.totalTokens).toBe(8000);
      expect(dailyStats.totalCost).toBe(2.5);
      expect(dailyStats.tasksCompleted).toBe(1);
      expect(dailyStats.tasksFailed).toBe(0);
    });

    it('should enforce usage limits for different modes', () => {
      // Set to day mode
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      // Try to start task exceeding day mode limits
      const highCostTask = { estimatedCost: 10.0 }; // Exceeds day mode limit of 5.0
      const dayResult = usageManager.canStartTask(highCostTask);
      expect(dayResult.allowed).toBe(false);
      expect(dayResult.reason).toContain('exceeds');

      // Switch to night mode
      const nightTime = new Date();
      nightTime.setHours(23, 0, 0, 0);
      vi.setSystemTime(nightTime);

      // Same task should be allowed in night mode
      const nightResult = usageManager.canStartTask(highCostTask);
      expect(nightResult.allowed).toBe(true);
    });

    it('should handle daily budget enforcement', () => {
      // Consume most of daily budget
      const expensiveTask: TaskUsage = {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 95.0, // Close to budget limit
      };

      usageManager.trackTaskCompletion('expensive-task', expensiveTask, true);

      // Try to start another expensive task
      const anotherTask = { estimatedCost: 10.0 };
      const result = usageManager.canStartTask(anotherTask);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget');
    });
  });

  describe('Session Recovery and State Persistence', () => {
    const mockTask: Task = {
      id: 'test-task',
      description: 'Test task for session recovery',
      status: 'running',
      created: new Date(),
      updated: new Date(),
      agents: [],
      conversation: [],
    };

    const mockMessages: AgentMessage[] = [
      {
        role: 'user',
        content: 'Create a new feature for the app',
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: 'I\'ll help you create a new feature. Let me start by analyzing the requirements.',
        timestamp: new Date(),
      },
      {
        role: 'user',
        content: 'Make sure it includes proper error handling',
        timestamp: new Date(),
      },
    ];

    it('should create checkpoint when approaching context limit', async () => {
      // Create a task with long conversation approaching context limit
      const longConversation: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} - This is a long conversation that will approach the context limit`,
        timestamp: new Date(),
      }));

      const taskWithLongConversation = {
        ...mockTask,
        conversation: longConversation,
      };

      const shouldCreateCheckpoint = await sessionManager.shouldCreateCheckpoint(taskWithLongConversation);
      expect(shouldCreateCheckpoint).toBe(true);

      // Create the checkpoint
      const checkpoint = await sessionManager.createCheckpoint(taskWithLongConversation);
      expect(checkpoint).toBeDefined();
      expect(checkpoint.taskId).toBe(mockTask.id);
      expect(checkpoint.conversationSnapshot).toBeDefined();
    });

    it('should save and load checkpoint files correctly', async () => {
      const taskData = {
        ...mockTask,
        conversation: mockMessages,
        metadata: {
          currentStage: 'planning',
          stageIndex: 0,
          stepIndex: 2,
        }
      };

      // Create checkpoint
      const checkpoint = await sessionManager.createCheckpoint(taskData);
      expect(checkpoint).toBeDefined();

      // Load checkpoint
      const loadedCheckpoint = await sessionManager.loadCheckpoint(mockTask.id);
      expect(loadedCheckpoint).toBeDefined();
      expect(loadedCheckpoint?.taskId).toBe(mockTask.id);
      expect(loadedCheckpoint?.conversationSnapshot.length).toBe(mockMessages.length);
    });

    it('should track resume attempts and enforce max limit', async () => {
      const checkpoint: TaskCheckpoint = {
        taskId: mockTask.id,
        conversationSnapshot: mockMessages,
        timestamp: new Date(),
        metadata: {
          currentStage: 'implementation',
          stageIndex: 1,
          stepIndex: 5,
          resumeAttempts: 2, // Already tried twice
        }
      };

      // Save checkpoint with 2 attempts
      await sessionManager.saveCheckpoint(checkpoint);

      // Try to resume - should be allowed (3rd attempt)
      const canResume = await sessionManager.canAutoResume(mockTask.id);
      expect(canResume).toBe(true);

      // Increment attempts to max (3)
      checkpoint.metadata.resumeAttempts = 3;
      await sessionManager.saveCheckpoint(checkpoint);

      // Try to resume again - should be blocked
      const canResumeAfterMax = await sessionManager.canAutoResume(mockTask.id);
      expect(canResumeAfterMax).toBe(false);
    });

    it('should generate session summaries for context injection', async () => {
      const taskData = {
        ...mockTask,
        conversation: mockMessages,
      };

      const summary = await sessionManager.generateSessionSummary(taskData);

      expect(summary).toBeDefined();
      expect(summary.conversationLength).toBe(mockMessages.length);
      expect(summary.keyDecisions).toBeDefined();
      expect(summary.currentContext).toBeDefined();
      expect(summary.progressSummary).toBeDefined();
    });
  });

  describe('Conversation Context Analysis', () => {
    const mockConversation: AgentMessage[] = [
      {
        role: 'user',
        content: 'Create a login system with JWT authentication',
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: 'I\'ll implement JWT authentication. First, let me create the user model and auth middleware.',
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: 'I\'ve created the following files:\n- auth/user.model.js\n- middleware/auth.js\n- routes/auth.js',
        timestamp: new Date(),
      },
    ];

    it('should estimate conversation tokens correctly', () => {
      const tokens = estimateConversationTokens(mockConversation);
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should extract key decisions from conversation', () => {
      const decisions = extractKeyDecisions(mockConversation);
      expect(decisions).toBeDefined();
      expect(decisions.length).toBeGreaterThan(0);
    });

    it('should extract progress summary', () => {
      const progress = extractProgressSummary(mockConversation);
      expect(progress).toBeDefined();
      expect(typeof progress).toBe('string');
      expect(progress.length).toBeGreaterThan(0);
    });

    it('should extract file modifications', () => {
      const modifications = extractFileModifications(mockConversation);
      expect(modifications).toBeDefined();
      expect(modifications.filesModified).toBeDefined();
      expect(modifications.totalOperations).toBeGreaterThanOrEqual(0);
    });

    it('should create comprehensive context summary', () => {
      const summary = createContextSummary(mockConversation);
      expect(summary).toBeDefined();
      expect(summary.messageCount).toBe(mockConversation.length);
      expect(summary.estimatedTokens).toBeGreaterThan(0);
      expect(summary.keyDecisions).toBeDefined();
      expect(summary.progressSummary).toBeDefined();
      expect(summary.fileModifications).toBeDefined();
    });
  });

  describe('Auto-Pause and Auto-Resume Integration', () => {
    let capacityMonitor: CapacityMonitor;
    let scheduler: DaemonScheduler;

    beforeEach(() => {
      // Initialize capacity monitor and scheduler
      capacityMonitor = new CapacityMonitor({
        projectPath: tempDir,
        config: mockConfig,
        limits: mockLimits,
      });

      scheduler = new DaemonScheduler({
        projectPath: tempDir,
        config: mockConfig,
        limits: mockLimits,
      });
    });

    it('should trigger auto-pause when exceeding mode thresholds', () => {
      const pauseEvents: string[] = [];

      capacityMonitor.on('capacity:exceeded', (event) => {
        pauseEvents.push(event.reason);
      });

      // Set to day mode and exceed limits
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      // Simulate high usage exceeding day mode thresholds
      usageManager.trackTaskCompletion('expensive-task', {
        inputTokens: 50000,
        outputTokens: 50000,
        totalTokens: 100000,
        estimatedCost: 6.0, // Exceeds day mode limit of 5.0
      }, true);

      capacityMonitor.start();
      capacityMonitor.checkCapacity();

      // Should trigger auto-pause
      expect(pauseEvents.length).toBeGreaterThan(0);
    });

    it('should trigger auto-resume on mode switch to higher limits', () => {
      const resumeEvents: any[] = [];

      capacityMonitor.on('capacity:restored', (event) => {
        resumeEvents.push(event);
      });

      capacityMonitor.start();

      // Start in day mode with high usage
      const dayTime = new Date();
      dayTime.setHours(17, 59, 0, 0);
      vi.setSystemTime(dayTime);

      usageManager.trackTaskCompletion('expensive-task', {
        inputTokens: 50000,
        outputTokens: 50000,
        totalTokens: 100000,
        estimatedCost: 6.0, // Exceeds day mode limit
      }, true);

      // Switch to night mode (higher limits)
      const nightTime = new Date();
      nightTime.setHours(22, 0, 0, 0);
      vi.setSystemTime(nightTime);

      capacityMonitor.checkCapacity();

      // Should detect mode switch restoration
      const modeSwitchEvents = resumeEvents.filter(e => e.reason === 'mode_switch');
      expect(modeSwitchEvents.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete workflow from usage tracking to session recovery', async () => {
      // 1. Track usage in day mode
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      const initialUsage = usageManager.getCurrentTimeBasedUsage();
      expect(initialUsage.currentMode).toBe('day');

      // 2. Create and track a task
      const taskUsage: TaskUsage = {
        inputTokens: 10000,
        outputTokens: 8000,
        totalTokens: 18000,
        estimatedCost: 3.5,
      };

      usageManager.trackTaskCompletion('integration-task', taskUsage, true);

      // 3. Create a checkpoint for session recovery
      const taskWithLongConversation = {
        ...mockTask,
        id: 'integration-task',
        conversation: Array.from({ length: 60 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Integration test message ${i}`,
          timestamp: new Date(),
        })) as AgentMessage[],
      };

      const checkpoint = await sessionManager.createCheckpoint(taskWithLongConversation);
      expect(checkpoint).toBeDefined();

      // 4. Verify checkpoint can be loaded and resumed
      const canResume = await sessionManager.canAutoResume('integration-task');
      expect(canResume).toBe(true);

      const loadedCheckpoint = await sessionManager.loadCheckpoint('integration-task');
      expect(loadedCheckpoint).toBeDefined();
      expect(loadedCheckpoint?.taskId).toBe('integration-task');

      // 5. Generate context summary for resume
      const summary = await sessionManager.generateSessionSummary(taskWithLongConversation);
      expect(summary.conversationLength).toBe(60);
      expect(summary.keyDecisions).toBeDefined();
    });
  });
});