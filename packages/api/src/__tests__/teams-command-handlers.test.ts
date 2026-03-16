/**
 * Teams Command Handlers Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for Teams bot command handlers including run, think,
 * status, report, cancel, and help commands with various scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamsService } from '../services/teams-service.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Bot Framework SDK
vi.mock('botbuilder', () => ({
  CloudAdapter: vi.fn(() => ({
    process: vi.fn(),
    onTurnError: null,
    continueConversationAsync: vi.fn(),
  })),
  ConfigurationBotFrameworkAuthentication: vi.fn(),
  ActivityHandler: vi.fn(),
  TurnContext: {
    getConversationReference: vi.fn(() => ({ conversation: { id: 'test-conv' } })),
  },
  MessageFactory: {
    text: vi.fn((text) => ({ type: 'message', text })),
    attachment: vi.fn((attachment) => ({ type: 'message', attachments: [attachment] })),
  },
  CardFactory: {
    adaptiveCard: vi.fn((card) => ({ contentType: 'application/vnd.microsoft.card.adaptive', content: card })),
  },
  ActivityTypes: { Message: 'message' },
  ActionTypes: { Submit: 'Action.Submit' },
}));

describe('Teams Command Handlers', () => {
  let teamsService: TeamsService;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;
  let mockContext: any;

  beforeEach(() => {
    // Mock orchestrator with realistic responses
    mockOrchestrator = {
      createTask: vi.fn(() => Promise.resolve({
        id: 'task-123',
        description: 'Test task',
        status: 'pending',
        workflow: 'default',
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      getTask: vi.fn(),
      getCurrentTask: vi.fn(),
      listTasks: vi.fn(() => Promise.resolve([])),
      cancelTask: vi.fn(() => Promise.resolve(true)),
      captureThought: vi.fn(() => Promise.resolve({
        id: 'thought-456',
        content: 'Test thought',
        createdAt: new Date(),
      })),
      on: vi.fn(),
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock Turn Context
    mockContext = {
      activity: {
        text: '',
        id: 'activity-123',
        from: { id: 'user-123', name: 'Test User' },
        conversation: { id: 'conv-123' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        channelData: {
          team: { id: 'team-123' },
          channel: { id: 'channel-123' },
        },
      },
      sendActivity: vi.fn(),
    };

    // Create service instance
    teamsService = new TeamsService({
      orchestrator: mockOrchestrator,
      config: {
        enabled: true,
        appId: 'test-app-id',
        appPassword: 'test-password',
        useAdaptiveCards: false, // Use simple text for easier testing
        threadUpdates: true,
      },
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    if (teamsService) {
      await teamsService.stop();
    }
  });

  describe('Run Command Handler', () => {
    it('should create task when description is provided', async () => {
      mockContext.activity.text = 'run Create a new feature';

      // Access private method through reflection for testing
      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
        description: 'Create a new feature'
      });
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Task created: task-123 - Test task'
        })
      );
    });

    it('should handle empty description with usage message', async () => {
      mockContext.activity.text = 'run';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.createTask).not.toHaveBeenCalled();
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Usage: @APEX run "task description"'
        })
      );
    });

    it('should create task with adaptive cards when enabled', async () => {
      const cardService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          useAdaptiveCards: true,
        },
        logger: mockLogger,
      });

      mockContext.activity.text = 'run Create task with card';

      const handleMessage = (cardService as any).handleMessage;
      await handleMessage.call(cardService, mockContext);

      expect(mockOrchestrator.createTask).toHaveBeenCalled();
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.any(Array)
        })
      );

      await cardService.stop();
    });

    it('should store conversation reference for thread updates', async () => {
      mockContext.activity.text = 'run Create tracked task';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      // Verify task conversations map is updated
      const taskConversations = (teamsService as any).taskConversations;
      expect(taskConversations.has('task-123')).toBe(true);
    });

    it('should handle bot mention in command', async () => {
      mockContext.activity.text = '<at>APEX</at> run Create mentioned task';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
        description: 'Create mentioned task'
      });
    });
  });

  describe('Think Command Handler', () => {
    it('should capture thought when content is provided', async () => {
      mockContext.activity.text = 'think This is a great idea';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith('This is a great idea');
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Thought captured: thought-456'
        })
      );
    });

    it('should handle empty thought with usage message', async () => {
      mockContext.activity.text = 'think';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.captureThought).not.toHaveBeenCalled();
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Usage: @APEX think "idea"'
        })
      );
    });

    it('should capture thought with adaptive card when enabled', async () => {
      const cardService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          useAdaptiveCards: true,
        },
        logger: mockLogger,
      });

      mockContext.activity.text = 'think Idea with card';

      const handleMessage = (cardService as any).handleMessage;
      await handleMessage.call(cardService, mockContext);

      expect(mockOrchestrator.captureThought).toHaveBeenCalled();
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.any(Array)
        })
      );

      await cardService.stop();
    });
  });

  describe('Status Command Handler', () => {
    beforeEach(() => {
      // Mock task lists
      mockOrchestrator.listTasks.mockImplementation(({ status }) => {
        const mockTasks = [
          { id: 'task-1', description: 'Active task', status: 'in-progress' },
          { id: 'task-2', description: 'Pending task', status: 'pending' },
          { id: 'task-3', description: 'Paused task', status: 'paused' },
        ];

        return Promise.resolve(mockTasks.filter(t => t.status === status));
      });
    });

    it('should display task status summary', async () => {
      mockContext.activity.text = 'status';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.listTasks).toHaveBeenCalledTimes(3);
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ status: 'in-progress', limit: 5 });
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ status: 'pending', limit: 5 });
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ status: 'paused', limit: 5 });

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Active Tasks')
        })
      );
    });

    it('should display status with adaptive card when enabled', async () => {
      const cardService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          useAdaptiveCards: true,
        },
        logger: mockLogger,
      });

      mockContext.activity.text = 'status';

      const handleMessage = (cardService as any).handleMessage;
      await handleMessage.call(cardService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.any(Array)
        })
      );

      await cardService.stop();
    });

    it('should handle empty task lists', async () => {
      mockOrchestrator.listTasks.mockResolvedValue([]);

      mockContext.activity.text = 'status';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('(0)')
        })
      );
    });
  });

  describe('Report Command Handler', () => {
    const mockTask = {
      id: 'task-123',
      description: 'Test task for report',
      status: 'in-progress',
      workflow: 'development',
      priority: 'high',
      effort: 'large',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockOrchestrator.getTask.mockResolvedValue(mockTask);
      mockOrchestrator.getCurrentTask.mockResolvedValue(mockTask);
    });

    it('should display report for specific task ID', async () => {
      mockContext.activity.text = 'report task-123';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-123');
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Task Report: task-123')
        })
      );
    });

    it('should display report for current task when no ID provided', async () => {
      mockContext.activity.text = 'report';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.getCurrentTask).toHaveBeenCalled();
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Task Report')
        })
      );
    });

    it('should handle task not found', async () => {
      mockOrchestrator.getTask.mockResolvedValue(null);

      mockContext.activity.text = 'report nonexistent-task';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Task not found. Provide a task ID or ensure a task is active.'
        })
      );
    });

    it('should handle no current task found', async () => {
      mockOrchestrator.getCurrentTask.mockResolvedValue(null);

      mockContext.activity.text = 'report';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Task not found. Provide a task ID or ensure a task is active.'
        })
      );
    });

    it('should display report with adaptive card when enabled', async () => {
      const cardService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          useAdaptiveCards: true,
        },
        logger: mockLogger,
      });

      mockContext.activity.text = 'report task-123';

      const handleMessage = (cardService as any).handleMessage;
      await handleMessage.call(cardService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.any(Array)
        })
      );

      await cardService.stop();
    });
  });

  describe('Cancel Command Handler', () => {
    it('should cancel task when task ID is provided', async () => {
      mockContext.activity.text = 'cancel task-123';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-123');
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Task task-123 cancelled successfully.'
        })
      );
    });

    it('should handle missing task ID with usage message', async () => {
      mockContext.activity.text = 'cancel';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockOrchestrator.cancelTask).not.toHaveBeenCalled();
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Usage: @APEX cancel <taskId>'
        })
      );
    });

    it('should handle cancel failure', async () => {
      mockOrchestrator.cancelTask.mockResolvedValue(false);

      mockContext.activity.text = 'cancel task-123';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Unable to cancel task task-123'
        })
      );
    });
  });

  describe('Help Command Handler', () => {
    it('should display help message for help command', async () => {
      mockContext.activity.text = 'help';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('APEX Teams Commands')
        })
      );
    });

    it('should display help message for unknown command', async () => {
      mockContext.activity.text = 'unknowncommand';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('APEX Teams Commands')
        })
      );
    });

    it('should display help message for empty text', async () => {
      mockContext.activity.text = '';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('APEX Teams Commands')
        })
      );
    });

    it('should include all command descriptions in help', async () => {
      mockContext.activity.text = 'help';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      const helpCall = mockContext.sendActivity.mock.calls[0][0];
      expect(helpCall.text).toContain('run');
      expect(helpCall.text).toContain('think');
      expect(helpCall.text).toContain('status');
      expect(helpCall.text).toContain('report');
      expect(helpCall.text).toContain('cancel');
      expect(helpCall.text).toContain('help');
    });
  });

  describe('Command Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.createTask.mockRejectedValue(new Error('Orchestrator error'));

      mockContext.activity.text = 'run Create failing task';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Teams command failed: Orchestrator error');
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Command failed. Check server logs for details.'
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockOrchestrator.createTask.mockRejectedValue('String error');

      mockContext.activity.text = 'run Create failing task';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Teams command failed: String error');
    });

    it('should handle context send activity errors', async () => {
      mockContext.sendActivity.mockRejectedValue(new Error('Send failed'));

      mockContext.activity.text = 'help';

      const handleMessage = (teamsService as any).handleMessage;

      // Should not throw even if sendActivity fails
      await expect(handleMessage.call(teamsService, mockContext)).resolves.not.toThrow();
    });
  });

  describe('Command Context Extraction', () => {
    it('should extract command context correctly', async () => {
      mockContext.activity.text = 'status';
      mockContext.activity.id = 'activity-456';
      mockContext.activity.from = { id: 'user-789', name: 'Jane Doe' };
      mockContext.activity.conversation = { id: 'conv-456' };
      mockContext.activity.serviceUrl = 'https://teams.example.com';
      mockContext.activity.channelData = {
        team: { id: 'team-789' },
        channel: { id: 'channel-789' },
      };

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      // Verify the extracted context would be correct (indirectly through successful execution)
      expect(mockOrchestrator.listTasks).toHaveBeenCalled();
    });

    it('should handle missing channel data gracefully', async () => {
      mockContext.activity.channelData = undefined;
      mockContext.activity.text = 'help';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockContext.sendActivity).toHaveBeenCalled();
    });

    it('should handle missing activity properties', async () => {
      mockContext.activity.from = undefined;
      mockContext.activity.text = 'help';

      const handleMessage = (teamsService as any).handleMessage;

      // Should not crash even with missing properties
      await expect(handleMessage.call(teamsService, mockContext)).resolves.not.toThrow();
    });
  });
});