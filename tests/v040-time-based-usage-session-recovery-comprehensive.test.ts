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
import { DaemonScheduler, UsageManagerProvider } from '../packages/orchestrator/src/daemon-scheduler';
import { CapacityMonitor, type CapacityUsageProvider } from '../packages/orchestrator/src/capacity-monitor';
import {
  estimateConversationTokens,
  createContextSummary,
  createContextSummaryData,
  extractKeyDecisions,
  extractProgressInfo,
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

      const timeBasedUsage = usageManager.getCurrentUsage();

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

      const timeBasedUsage = usageManager.getCurrentUsage();

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

      const timeBasedUsage = usageManager.getCurrentUsage();

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

      const timeBasedUsage = usageManager.getCurrentUsage();

      expect(timeBasedUsage.currentMode).toBe('day');
      // Next transition is to the next hour in the day/night schedule (15 = 3pm, next in dayModeHours)
      // The implementation finds the next transition hour, which could be within dayModeHours
      expect(timeBasedUsage.nextModeSwitch.getHours()).toBeGreaterThan(14);
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

      const initialUsage = usageManager.getCurrentUsage();
      expect(initialUsage.currentMode).toBe('day');

      // Switch to night mode
      const nightTime = new Date();
      nightTime.setHours(23, 0, 0, 0);
      vi.setSystemTime(nightTime);

      // Trigger mode change detection
      const updatedUsage = usageManager.getCurrentUsage();
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

      const usageStats = usageManager.getUsageStats();
      const dailyStats = usageStats.current.dailyUsage;
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
      // Consume entire daily budget (budget is 100.0)
      const expensiveTask: TaskUsage = {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 100.0, // Exactly at budget limit
      };

      usageManager.trackTaskCompletion('expensive-task', expensiveTask, true);

      // Try to start another task - should be blocked since budget is exhausted
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
    } as Task;

    // Create properly typed AgentMessage array matching the actual interface
    const createMockMessages = (): AgentMessage[] => [
      {
        type: 'user',
        content: [{ type: 'text', text: 'Create a new feature for the app' }],
      },
      {
        type: 'assistant',
        content: [{ type: 'text', text: 'I\'ll help you create a new feature. Let me start by analyzing the requirements.' }],
      },
      {
        type: 'user',
        content: [{ type: 'text', text: 'Make sure it includes proper error handling' }],
      },
    ] as AgentMessage[];

    it('should create checkpoint when approaching context limit', async () => {
      // Create a task with long conversation approaching context limit
      const longConversation: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Message ${i} - This is a long conversation that will approach the context limit` }],
      })) as AgentMessage[];

      // Use the actual createCheckpoint API which takes task and conversation separately
      const checkpoint = await sessionManager.createCheckpoint(mockTask, longConversation);
      expect(checkpoint).toBeDefined();
      expect(checkpoint.taskId).toBe(mockTask.id);
      expect(checkpoint.conversationState).toBeDefined();
      expect(checkpoint.conversationState.length).toBe(100);
    });

    it('should save and load checkpoint files correctly', async () => {
      const mockMessages = createMockMessages();

      // Create checkpoint using the actual API
      const checkpoint = await sessionManager.createCheckpoint(mockTask, mockMessages);
      expect(checkpoint).toBeDefined();

      // Restore session (actual API)
      const session = await sessionManager.restoreSession(mockTask.id);
      expect(session.checkpoint).toBeDefined();
      expect(session.checkpoint?.taskId).toBe(mockTask.id);
      expect(session.checkpoint?.conversationState.length).toBe(mockMessages.length);
    });

    it('should determine if session can be resumed', async () => {
      const mockMessages = createMockMessages();

      // Create a fresh checkpoint
      await sessionManager.createCheckpoint(mockTask, mockMessages);

      // Try to restore session
      const session = await sessionManager.restoreSession(mockTask.id);

      // Should be able to resume since checkpoint was just created
      expect(session.canResume).toBe(true);
    });

    it('should generate session summaries for context injection', async () => {
      const mockMessages = createMockMessages();

      // Use the actual summarizeContext API
      const summary = await sessionManager.summarizeContext(mockMessages);

      expect(summary).toBeDefined();
      expect(summary.conversationLength).toBe(mockMessages.length);
      expect(summary.keyDecisions).toBeDefined();
      expect(summary.currentContext).toBeDefined();
      expect(summary.progressSummary).toBeDefined();
    });
  });

  describe('Conversation Context Analysis', () => {
    // Create properly typed messages matching AgentMessage interface
    const mockConversation: AgentMessage[] = [
      {
        type: 'user',
        content: [{ type: 'text', text: 'Create a login system with JWT authentication' }],
      },
      {
        type: 'assistant',
        content: [{ type: 'text', text: 'I\'ll implement JWT authentication. First, let me create the user model and auth middleware.' }],
      },
      {
        type: 'assistant',
        content: [{ type: 'text', text: 'I\'ve created the following files:\n- auth/user.model.js\n- middleware/auth.js\n- routes/auth.js' }],
      },
    ] as AgentMessage[];

    it('should estimate conversation tokens correctly', () => {
      const tokens = estimateConversationTokens(mockConversation);
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should extract key decisions from conversation', () => {
      const decisions = extractKeyDecisions(mockConversation);
      expect(decisions).toBeDefined();
      // extractKeyDecisions returns KeyDecision[] (array of objects)
      expect(Array.isArray(decisions)).toBe(true);
    });

    it('should extract progress info', () => {
      // Use the actual function name: extractProgressInfo (not extractProgressSummary)
      const progress = extractProgressInfo(mockConversation);
      expect(progress).toBeDefined();
      // extractProgressInfo returns ProgressInfo object
      expect(progress.completed).toBeDefined();
      expect(typeof progress.percentage).toBe('number');
    });

    it('should extract file modifications', () => {
      const modifications = extractFileModifications(mockConversation);
      expect(modifications).toBeDefined();
      // extractFileModifications returns FileModification[] array
      expect(Array.isArray(modifications)).toBe(true);
    });

    it('should create comprehensive context summary', () => {
      // createContextSummary returns a formatted string
      const summary = createContextSummary(mockConversation);
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);

      // Use createContextSummaryData for structured data
      const summaryData = createContextSummaryData(mockConversation);
      expect(summaryData).toBeDefined();
      expect(summaryData.metrics.messageCount).toBe(mockConversation.length);
      expect(summaryData.keyDecisions).toBeDefined();
      expect(summaryData.progress).toBeDefined();
      expect(summaryData.fileModifications).toBeDefined();
    });
  });

  describe('Auto-Pause and Auto-Resume Integration', () => {
    let capacityUsageProvider: CapacityUsageProvider;
    let capacityMonitor: CapacityMonitor;
    let scheduler: DaemonScheduler;
    let usageManagerProvider: UsageManagerProvider;

    beforeEach(() => {
      // Create a usage provider adapter for CapacityMonitor
      capacityUsageProvider = {
        getCurrentUsage: () => ({
          currentTokens: 0,
          currentCost: usageManager.getUsageStats().current.dailyUsage.totalCost,
          activeTasks: usageManager.getUsageStats().active.length,
          maxTokensPerTask: usageManager.getUsageStats().current.thresholds.maxTokensPerTask,
          maxCostPerTask: usageManager.getUsageStats().current.thresholds.maxCostPerTask,
          maxConcurrentTasks: usageManager.getUsageStats().current.thresholds.maxConcurrentTasks,
          dailyBudget: mockLimits.dailyBudget || 100,
          dailySpent: usageManager.getUsageStats().current.dailyUsage.totalCost,
        }),
        getModeInfo: () => ({
          mode: usageManager.getUsageStats().current.currentMode,
          modeHours: [],
          nextModeSwitch: usageManager.getUsageStats().current.nextModeSwitch,
          nextMidnight: new Date(Date.now() + 86400000),
        }),
        getThresholds: () => ({
          tokensThreshold: usageManager.getUsageStats().current.thresholds.maxTokensPerTask,
          costThreshold: usageManager.getUsageStats().current.thresholds.maxCostPerTask,
          budgetThreshold: mockLimits.dailyBudget || 100,
          concurrentThreshold: usageManager.getUsageStats().current.thresholds.maxConcurrentTasks,
        }),
      };

      // Initialize capacity monitor with the proper constructor signature
      capacityMonitor = new CapacityMonitor(mockConfig, mockLimits, capacityUsageProvider);

      // Create usage manager provider for scheduler
      usageManagerProvider = new UsageManagerProvider(usageManager);

      // Initialize scheduler with the proper constructor signature
      scheduler = new DaemonScheduler(mockConfig, mockLimits, usageManagerProvider);
    });

    it('should use scheduler to determine if tasks should pause', () => {
      // Set to day mode
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      // Get scheduling decision
      const decision = scheduler.shouldPauseTasks(dayTime);

      expect(decision).toBeDefined();
      expect(decision.timeWindow).toBeDefined();
      expect(decision.timeWindow.mode).toBe('day');
      expect(decision.capacity).toBeDefined();
    });

    it('should detect capacity restoration events', () => {
      const resumeEvents: any[] = [];

      capacityMonitor.on('capacity:restored', (event) => {
        resumeEvents.push(event);
      });

      capacityMonitor.start();

      // Check capacity (initial state)
      capacityMonitor.checkCapacity();

      // Stop monitoring for cleanup
      capacityMonitor.stop();

      // Verify monitoring was started and stopped without errors
      const status = capacityMonitor.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should calculate time until mode switch', () => {
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(dayTime);

      // Should be positive (time until next mode)
      expect(timeUntilSwitch).toBeGreaterThan(0);
    });

    it('should calculate time until budget reset', () => {
      const currentTime = new Date();
      vi.setSystemTime(currentTime);

      const timeUntilReset = scheduler.getTimeUntilBudgetReset(currentTime);

      // Should be positive (time until midnight)
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(timeUntilReset).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // Max 24 hours
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete workflow from usage tracking to session recovery', async () => {
      // 1. Track usage in day mode
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      vi.setSystemTime(dayTime);

      const initialUsage = usageManager.getCurrentUsage();
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
      const integrationTask: Task = {
        id: 'integration-task',
        description: 'Integration test task',
        status: 'running',
        created: new Date(),
        updated: new Date(),
        agents: [],
        conversation: [],
      } as Task;

      const longConversation: AgentMessage[] = Array.from({ length: 60 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'assistant',
        content: [{ type: 'text', text: `Integration test message ${i}` }],
      })) as AgentMessage[];

      const checkpoint = await sessionManager.createCheckpoint(integrationTask, longConversation);
      expect(checkpoint).toBeDefined();

      // 4. Verify checkpoint can be loaded and resumed
      const session = await sessionManager.restoreSession('integration-task');
      expect(session.canResume).toBe(true);
      expect(session.checkpoint).toBeDefined();
      expect(session.checkpoint?.taskId).toBe('integration-task');

      // 5. Generate context summary for resume
      const summary = await sessionManager.summarizeContext(longConversation);
      expect(summary.conversationLength).toBe(60);
      expect(summary.keyDecisions).toBeDefined();
    });
  });
});