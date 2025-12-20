import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SessionManager } from './session-manager';
import {
  Task,
  TaskCheckpoint,
  TaskSessionData,
  AgentMessage,
  DaemonConfig,
  TaskStatus,
} from '@apexcli/core';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;
  let mockTask: Task;
  let mockConversationHistory: AgentMessage[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectPath = '/test/project';
    mockConfig = {
      sessionRecovery: {
        enabled: true,
        autoResume: true,
        contextSummarizationThreshold: 50,
      },
    };

    sessionManager = new SessionManager({
      projectPath: mockProjectPath,
      config: mockConfig,
    });

    mockTask = {
      id: 'test-task-123',
      title: 'Test Task',
      description: 'A test task',
      status: 'running' as TaskStatus,
      currentStage: 'implementation',
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.05,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockConversationHistory = [
      {
        type: 'user',
        timestamp: new Date(),
        content: [{ type: 'text', text: 'Start implementation' }],
      },
      {
        type: 'assistant',
        timestamp: new Date(),
        content: [{ type: 'text', text: 'I have decided to implement feature X' }],
      },
      {
        type: 'assistant',
        timestamp: new Date(),
        content: [{ type: 'text', text: 'Implementation completed successfully' }],
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should create checkpoint directory', async () => {
      await sessionManager.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        join(mockProjectPath, '.apex', 'checkpoints'),
        { recursive: true }
      );
    });
  });

  describe('createCheckpoint', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should create a checkpoint with correct structure', async () => {
      const checkpoint = await sessionManager.createCheckpoint(
        mockTask,
        mockConversationHistory
      );

      expect(checkpoint).toMatchObject({
        taskId: 'test-task-123',
        stage: 'implementation',
        conversationState: mockConversationHistory,
        metadata: {
          status: 'running',
          usage: mockTask.usage,
        },
      });

      expect(checkpoint.checkpointId).toMatch(/test-task-123-\d+/);
      expect(checkpoint.createdAt).toBeInstanceOf(Date);
    });

    it('should save checkpoint to file', async () => {
      const checkpoint = await sessionManager.createCheckpoint(
        mockTask,
        mockConversationHistory
      );

      const expectedPath = join(
        mockProjectPath,
        '.apex',
        'checkpoints',
        `${checkpoint.checkpointId}.json`
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining(checkpoint.taskId),
        'utf-8'
      );
    });

    it('should include stage state when provided', async () => {
      const stageState = { currentStep: 'testing', progress: 0.5 };

      const checkpoint = await sessionManager.createCheckpoint(
        mockTask,
        mockConversationHistory,
        stageState
      );

      expect(checkpoint.metadata?.stageState).toEqual(stageState);
    });
  });

  describe('restoreSession', () => {
    it('should restore session with valid checkpoint', async () => {
      const mockCheckpoint: TaskCheckpoint = {
        taskId: 'test-task-123',
        checkpointId: 'test-task-123-1234567890',
        stage: 'implementation',
        stageIndex: 0,
        conversationState: mockConversationHistory,
        metadata: {
          status: 'running',
          usage: mockTask.usage,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date(),
      };

      const mockSessionData: TaskSessionData = {
        lastCheckpoint: new Date(),
        contextSummary: 'Current context summary',
        conversationHistory: mockConversationHistory,
        stageState: {},
        resumePoint: {
          stage: 'implementation',
          stepIndex: 0,
          metadata: { progressSummary: 'In progress' },
        },
      };

      // Mock file operations
      vi.mocked(fs.readdir).mockResolvedValue([
        'test-task-123-1234567890.json',
        'other-file.json',
      ] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockCheckpoint))
        .mockResolvedValueOnce(JSON.stringify(mockSessionData));

      const result = await sessionManager.restoreSession('test-task-123');

      expect(result.canResume).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.sessionData).toBeDefined();
    });

    it('should return null when no checkpoint exists', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const result = await sessionManager.restoreSession('nonexistent-task');

      expect(result.checkpoint).toBeNull();
      expect(result.sessionData).toBeNull();
      expect(result.canResume).toBe(false);
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

      const result = await sessionManager.restoreSession('test-task-123');

      expect(result.checkpoint).toBeNull();
      expect(result.sessionData).toBeNull();
      expect(result.canResume).toBe(false);
    });
  });

  describe('autoResumeTask', () => {
    it('should resume task when auto-resume is enabled', async () => {
      const validCheckpoint: TaskCheckpoint = {
        taskId: 'test-task-123',
        checkpointId: 'test-task-123-1234567890',
        stage: 'implementation',
        stageIndex: 0,
        conversationState: mockConversationHistory,
        metadata: { stageState: { currentStep: 'testing' } },
        createdAt: new Date(Date.now() - 1000), // 1 second ago
      };

      vi.mocked(fs.readdir).mockResolvedValue(['test-task-123-1234567890.json'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validCheckpoint))
        .mockResolvedValueOnce(JSON.stringify({
          lastCheckpoint: new Date(),
          contextSummary: 'Summary',
          conversationHistory: mockConversationHistory,
          stageState: {},
          resumePoint: { stage: 'implementation', stepIndex: 0 },
        }));

      const result = await sessionManager.autoResumeTask(mockTask);

      expect(result.resumed).toBe(true);
      expect(result.resumePoint).toBeDefined();
      expect(result.resumePoint?.stage).toBe('implementation');
      expect(result.resumePoint?.conversationHistory).toEqual(mockConversationHistory);
    });

    it('should not resume when auto-resume is disabled', async () => {
      mockConfig.sessionRecovery!.autoResume = false;
      sessionManager = new SessionManager({
        projectPath: mockProjectPath,
        config: mockConfig,
      });

      const result = await sessionManager.autoResumeTask(mockTask);

      expect(result.resumed).toBe(false);
      expect(result.resumePoint).toBeUndefined();
    });
  });

  describe('summarizeContext', () => {
    it('should not summarize when conversation is below threshold', async () => {
      const shortConversation = mockConversationHistory.slice(0, 2);

      const summary = await sessionManager.summarizeContext(shortConversation);

      expect(summary.conversationLength).toBe(2);
      expect(summary.currentContext).toBe('Conversation is within normal length');
      expect(summary.progressSummary).toBe('No summarization needed');
    });

    it('should summarize when conversation exceeds threshold', async () => {
      // Create long conversation
      const longConversation = Array.from({ length: 60 }, (_, i) => ({
        type: 'assistant' as const,
        timestamp: new Date(),
        content: [{ type: 'text' as const, text: `Message ${i}: decided to proceed with approach ${i}` }],
      }));

      const summary = await sessionManager.summarizeContext(longConversation);

      expect(summary.conversationLength).toBe(60);
      expect(summary.keyDecisions.length).toBeGreaterThan(0);
      expect(summary.currentContext).toContain('Message');
      expect(summary.progressSummary).toContain('60 messages');
    });

    it('should extract key decisions correctly', async () => {
      const conversationWithDecisions: AgentMessage[] = [
        {
          type: 'assistant',
          timestamp: new Date(),
          content: [{ type: 'text', text: 'I have decided to use React for this project' }],
        },
        {
          type: 'assistant',
          timestamp: new Date(),
          content: [{ type: 'text', text: 'Implementation completed with TypeScript' }],
        },
        {
          type: 'assistant',
          timestamp: new Date(),
          content: [{ type: 'text', text: 'Regular message without keywords' }],
        },
      ];

      // Extend to exceed threshold
      const extendedConversation = [
        ...Array.from({ length: 50 }, () => conversationWithDecisions[2]),
        ...conversationWithDecisions,
      ];

      const summary = await sessionManager.summarizeContext(extendedConversation);

      expect(summary.keyDecisions.length).toBeGreaterThan(0);
      expect(summary.keyDecisions.some(d => d.includes('decided'))).toBe(true);
      expect(summary.keyDecisions.some(d => d.includes('completed'))).toBe(true);
    });
  });

  describe('cleanupCheckpoints', () => {
    it('should remove old checkpoint files', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      vi.mocked(fs.readdir).mockResolvedValue([
        'old-checkpoint.json',
        'recent-checkpoint.json',
        'not-checkpoint.txt',
      ] as any);

      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ mtime: oldDate } as any)
        .mockResolvedValueOnce({ mtime: recentDate } as any)
        .mockResolvedValueOnce({ mtime: oldDate } as any);

      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await sessionManager.cleanupCheckpoints();

      expect(fs.unlink).toHaveBeenCalledWith(
        join(mockProjectPath, '.apex', 'checkpoints', 'old-checkpoint.json')
      );
      expect(fs.unlink).not.toHaveBeenCalledWith(
        join(mockProjectPath, '.apex', 'checkpoints', 'recent-checkpoint.json')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Directory not found'));

      await expect(sessionManager.cleanupCheckpoints()).resolves.toBeUndefined();
    });
  });

  describe('getCheckpointStats', () => {
    it('should return correct statistics', async () => {
      const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const newDate = new Date();

      vi.mocked(fs.readdir).mockResolvedValue([
        'task1-123.json',
        'task1-456.json',
        'task2-789.json',
        'not-checkpoint.txt',
      ] as any);

      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ mtime: oldDate, size: 1024 } as any)
        .mockResolvedValueOnce({ mtime: newDate, size: 2048 } as any)
        .mockResolvedValueOnce({ mtime: newDate, size: 512 } as any)
        .mockResolvedValueOnce({ mtime: newDate, size: 256 } as any);

      const stats = await sessionManager.getCheckpointStats();

      expect(stats.totalCheckpoints).toBe(3);
      expect(stats.checkpointsByTask).toEqual({
        task1: 2,
        task2: 1,
      });
      expect(stats.oldestCheckpoint).toEqual(oldDate);
      expect(stats.newestCheckpoint).toEqual(newDate);
      expect(stats.diskUsage).toBe(3584); // 1024 + 2048 + 512
    });

    it('should handle stats errors gracefully', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Access denied'));

      const stats = await sessionManager.getCheckpointStats();

      expect(stats).toEqual({
        totalCheckpoints: 0,
        checkpointsByTask: {},
        diskUsage: 0,
      });
    });
  });

  describe('canResumeTask', () => {
    let validCheckpoint: TaskCheckpoint;

    beforeEach(() => {
      validCheckpoint = {
        taskId: 'test-task-123',
        checkpointId: 'test-task-123-1234567890',
        stage: 'implementation',
        stageIndex: 0,
        conversationState: mockConversationHistory,
        metadata: {},
        createdAt: new Date(Date.now() - 1000), // 1 second ago
      };
    });

    it('should allow resume for valid recent checkpoint', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['test-task-123-1234567890.json'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validCheckpoint))
        .mockResolvedValueOnce(JSON.stringify({
          lastCheckpoint: new Date(),
          resumePoint: { stage: 'implementation', stepIndex: 0 },
        }));

      const result = await sessionManager.restoreSession('test-task-123');

      expect(result.canResume).toBe(true);
    });

    it('should reject resume for old checkpoint', async () => {
      validCheckpoint.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      vi.mocked(fs.readdir).mockResolvedValue(['test-task-123-1234567890.json'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validCheckpoint))
        .mockResolvedValueOnce(JSON.stringify({
          lastCheckpoint: new Date(),
          resumePoint: { stage: 'implementation', stepIndex: 0 },
        }));

      const result = await sessionManager.restoreSession('test-task-123');

      expect(result.canResume).toBe(false);
    });

    it('should reject resume when session recovery is disabled', async () => {
      mockConfig.sessionRecovery!.enabled = false;
      sessionManager = new SessionManager({
        projectPath: mockProjectPath,
        config: mockConfig,
      });

      vi.mocked(fs.readdir).mockResolvedValue(['test-task-123-1234567890.json'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validCheckpoint))
        .mockResolvedValueOnce(JSON.stringify({
          lastCheckpoint: new Date(),
          resumePoint: { stage: 'implementation', stepIndex: 0 },
        }));

      const result = await sessionManager.restoreSession('test-task-123');

      expect(result.canResume).toBe(false);
    });

    it('should reject resume when conversation state is empty', async () => {
      validCheckpoint.conversationState = [];

      vi.mocked(fs.readdir).mockResolvedValue(['test-task-123-1234567890.json'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validCheckpoint))
        .mockResolvedValueOnce(JSON.stringify({
          lastCheckpoint: new Date(),
          resumePoint: { stage: 'implementation', stepIndex: 0 },
        }));

      const result = await sessionManager.restoreSession('test-task-123');

      expect(result.canResume).toBe(false);
    });
  });
});