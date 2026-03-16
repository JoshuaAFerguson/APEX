/**
 * Teams Integration Test Suite for @apexcli/api Package
 *
 * Integration tests for Teams service with orchestrator events, conversation
 * tracking, notification delivery, and end-to-end command workflows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamsService } from '../packages/api/src/services/teams-service.js';
import { TeamsMessagingExtension } from '../packages/api/src/services/teams-messaging-extension.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Bot Framework SDK
vi.mock('botbuilder', () => ({
  CloudAdapter: vi.fn(() => ({
    process: vi.fn(),
    onTurnError: null,
    continueConversationAsync: vi.fn((appId, reference, callback) => {
      // Mock successful conversation continuation
      const mockContext = {
        sendActivity: vi.fn(),
      };
      return callback(mockContext);
    }),
  })),
  ConfigurationBotFrameworkAuthentication: vi.fn(),
  ActivityHandler: vi.fn(),
  TurnContext: {
    getConversationReference: vi.fn(() => ({
      conversation: { id: 'test-conv' },
      user: { id: 'user-123' },
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
    })),
  },
  MessageFactory: {
    text: vi.fn((text) => ({ type: 'message', text })),
    attachment: vi.fn((attachment) => ({ type: 'message', attachments: [attachment] })),
  },
  CardFactory: {
    adaptiveCard: vi.fn((card) => ({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: card
    })),
  },
  ActivityTypes: { Message: 'message' },
  ActionTypes: { Submit: 'Action.Submit' },
}));

describe('Teams Integration', () => {
  let teamsService: TeamsService;
  let messagingExtension: TeamsMessagingExtension;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;
  let eventCallbacks: Map<string, Function>;

  // Sample data for integration testing
  const mockTask = {
    id: 'task-integration-123',
    description: 'Integration test task',
    status: 'in-progress',
    workflow: 'development',
    priority: 'high',
    effort: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Track event callbacks for testing
    eventCallbacks = new Map();

    // Mock orchestrator with event handling
    mockOrchestrator = {
      createTask: vi.fn(() => Promise.resolve({ ...mockTask })),
      getTask: vi.fn(() => Promise.resolve(mockTask)),
      getCurrentTask: vi.fn(() => Promise.resolve(mockTask)),
      listTasks: vi.fn(() => Promise.resolve([mockTask])),
      cancelTask: vi.fn(() => Promise.resolve(true)),
      captureThought: vi.fn(() => Promise.resolve({
        id: 'thought-integration-123',
        content: 'Integration test thought',
        createdAt: new Date(),
      })),
      on: vi.fn((event, callback) => {
        eventCallbacks.set(event, callback);
      }),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create service instances
    teamsService = new TeamsService({
      orchestrator: mockOrchestrator,
      config: {
        enabled: true,
        appId: 'test-app-id',
        appPassword: 'test-password',
        useAdaptiveCards: true,
        threadUpdates: true,
      },
      logger: mockLogger,
    });

    messagingExtension = new TeamsMessagingExtension(mockOrchestrator);
  });

  afterEach(async () => {
    if (teamsService) {
      await teamsService.stop();
    }
  });

  describe('Service Integration', () => {
    it('should start Teams service and register orchestrator events', async () => {
      await teamsService.start();

      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:stage-changed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:paused', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:failed', expect.any(Function));

      expect(teamsService.getAdapter()).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting Teams Bot Framework integration...');
    });

    it('should not start when disabled', async () => {
      const disabledService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: { enabled: false },
        logger: mockLogger,
      });

      await disabledService.start();

      expect(mockOrchestrator.on).not.toHaveBeenCalled();
      expect(disabledService.getAdapter()).toBeUndefined();

      await disabledService.stop();
    });

    it('should integrate with messaging extension', () => {
      expect(messagingExtension).toBeInstanceOf(TeamsMessagingExtension);

      // Both services should use the same orchestrator
      const teamsOrchestrator = (teamsService as any).orchestrator;
      const extensionOrchestrator = (messagingExtension as any).orchestrator;
      expect(teamsOrchestrator).toBe(extensionOrchestrator);
    });
  });

  describe('End-to-End Command Workflows', () => {
    let mockContext: any;

    beforeEach(async () => {
      mockContext = {
        activity: {
          text: '',
          id: 'activity-integration-123',
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

      await teamsService.start();
    });

    it('should handle complete run command workflow', async () => {
      // Step 1: User sends run command
      mockContext.activity.text = 'run Create integration test feature';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      // Verify task creation
      expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
        description: 'Create integration test feature',
      });

      // Verify response sent to user
      expect(mockContext.sendActivity).toHaveBeenCalled();

      // Verify conversation reference stored for updates
      const taskConversations = (teamsService as any).taskConversations;
      expect(taskConversations.has('task-integration-123')).toBe(true);

      // Step 2: Simulate task started event
      const taskStartedCallback = eventCallbacks.get('task:started');
      expect(taskStartedCallback).toBeDefined();

      await taskStartedCallback(mockTask);

      // Verify notification was attempted
      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalled();
    });

    it('should handle complete status command workflow', async () => {
      mockContext.activity.text = 'status';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      // Verify all status queries were made
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ status: 'in-progress', limit: 5 });
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ status: 'pending', limit: 5 });
      expect(mockOrchestrator.listTasks).toHaveBeenCalledWith({ status: 'paused', limit: 5 });

      // Verify response with adaptive card
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.any(Array)
        })
      );
    });

    it('should handle complete think command workflow', async () => {
      mockContext.activity.text = 'think We should refactor the authentication module';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      // Verify thought capture
      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith('We should refactor the authentication module');

      // Verify response
      expect(mockContext.sendActivity).toHaveBeenCalled();
    });

    it('should handle complete cancel workflow', async () => {
      mockContext.activity.text = 'cancel task-integration-123';

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      // Verify cancellation
      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-integration-123');

      // Verify success response
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Task task-integration-123 cancelled successfully.'
        })
      );
    });

    it('should handle messaging extension query to action workflow', async () => {
      // Step 1: Handle search query
      const query = {
        parameters: [{ value: 'integration' }],
      };

      const queryResult = await messagingExtension.handleQuery(mockContext, query);

      // Verify search results
      expect(queryResult.composeExtension.type).toBe('result');
      expect(queryResult.composeExtension.attachments.length).toBeGreaterThan(0);

      // Step 2: Handle card action from search result
      const cardData = {
        action: 'report',
        taskId: 'task-integration-123',
      };

      const actionResult = await messagingExtension.handleCardAction(mockContext, cardData);

      // Verify task report
      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('task-integration-123');
      expect(actionResult.task.type).toBe('continue');
      expect(actionResult.task.value.title).toBe('Task Report - task-integration-123');
    });
  });

  describe('Orchestrator Event Handling', () => {
    beforeEach(async () => {
      await teamsService.start();

      // Simulate a task with stored conversation reference
      const taskConversations = (teamsService as any).taskConversations;
      taskConversations.set('task-integration-123', {
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        conversationReference: {
          conversation: { id: 'conv-123' },
          user: { id: 'user-123' },
          serviceUrl: 'https://smba.trafficmanager.net/teams/',
        },
        activityId: 'activity-123',
      });
    });

    it('should handle task:started event', async () => {
      const callback = eventCallbacks.get('task:started');
      expect(callback).toBeDefined();

      await callback(mockTask);

      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalledWith(
        'test-app-id',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle task:stage-changed event', async () => {
      const callback = eventCallbacks.get('task:stage-changed');
      expect(callback).toBeDefined();

      await callback(mockTask, 'implementation');

      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalled();
    });

    it('should handle task:paused event', async () => {
      const callback = eventCallbacks.get('task:paused');
      expect(callback).toBeDefined();

      await callback(mockTask, 'User intervention required');

      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalled();
    });

    it('should handle task:completed event', async () => {
      const callback = eventCallbacks.get('task:completed');
      expect(callback).toBeDefined();

      await callback(mockTask);

      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalled();
    });

    it('should handle task:failed event', async () => {
      const callback = eventCallbacks.get('task:failed');
      expect(callback).toBeDefined();

      const error = new Error('Task execution failed');
      await callback(mockTask, error);

      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalled();
    });

    it('should handle events for tasks without stored conversations', async () => {
      const callback = eventCallbacks.get('task:started');
      const taskWithoutConversation = { ...mockTask, id: 'task-no-conversation' };

      // Should not throw error
      await expect(callback(taskWithoutConversation)).resolves.not.toThrow();

      // Should not attempt to send notification
      const adapter = teamsService.getAdapter();
      adapter.continueConversationAsync.mockClear();
      await callback(taskWithoutConversation);
      expect(adapter.continueConversationAsync).not.toHaveBeenCalled();
    });

    it('should handle notification failures gracefully', async () => {
      const adapter = teamsService.getAdapter();
      adapter.continueConversationAsync.mockRejectedValueOnce(new Error('Network error'));

      const callback = eventCallbacks.get('task:started');
      await callback(mockTask);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send task update: Network error');
    });
  });

  describe('Conversation Tracking', () => {
    beforeEach(async () => {
      await teamsService.start();
    });

    it('should track conversations for thread updates', async () => {
      const mockContext = {
        activity: {
          text: 'run Create tracked task',
          id: 'activity-tracked',
          from: { id: 'user-tracked', name: 'Tracked User' },
          conversation: { id: 'conv-tracked' },
          serviceUrl: 'https://teams.tracked.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      const taskConversations = (teamsService as any).taskConversations;
      const storedConversation = taskConversations.get('task-integration-123');

      expect(storedConversation).toBeDefined();
      expect(storedConversation.serviceUrl).toBe('https://teams.tracked.com');
      expect(storedConversation.conversationReference).toBeDefined();
      expect(storedConversation.activityId).toBe('activity-tracked');
    });

    it('should not track conversations when thread updates disabled', async () => {
      const noThreadService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          threadUpdates: false,
        },
        logger: mockLogger,
      });

      await noThreadService.start();

      const mockContext = {
        activity: {
          text: 'run Create untracked task',
          id: 'activity-untracked',
          from: { id: 'user-untracked' },
          conversation: { id: 'conv-untracked' },
          serviceUrl: 'https://teams.untracked.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (noThreadService as any).handleMessage;
      await handleMessage.call(noThreadService, mockContext);

      const taskConversations = (noThreadService as any).taskConversations;
      expect(taskConversations.has('task-integration-123')).toBe(false);

      await noThreadService.stop();
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      await teamsService.start();
    });

    it('should handle orchestrator errors in commands', async () => {
      mockOrchestrator.createTask.mockRejectedValueOnce(new Error('Database connection failed'));

      const mockContext = {
        activity: {
          text: 'run Create failing task',
          id: 'activity-error',
          from: { id: 'user-error' },
          conversation: { id: 'conv-error' },
          serviceUrl: 'https://teams.error.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Teams command failed: Database connection failed');
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Command failed. Check server logs for details.'
        })
      );
    });

    it('should handle messaging extension errors', async () => {
      mockOrchestrator.listTasks.mockRejectedValueOnce(new Error('Search service unavailable'));

      const query = {
        parameters: [{ value: 'test' }],
      };

      const result = await messagingExtension.handleQuery(mockContext, query);

      // Should return empty results on error
      expect(result.composeExtension.attachments).toHaveLength(0);
    });

    it('should handle adapter process errors', async () => {
      const adapter = teamsService.getAdapter();
      const mockReq = {};
      const mockRes = {
        status: vi.fn(() => ({
          send: vi.fn(),
        })),
      };

      adapter.process.mockRejectedValueOnce(new Error('Process failed'));

      // Should not throw
      await expect(teamsService.processActivity(mockReq, mockRes)).resolves.not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should integrate different configuration options', async () => {
      const customConfigService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'custom-app-id',
          appPassword: 'custom-password',
          tenantId: 'custom-tenant',
          oauthConnectionName: 'custom-oauth',
          defaultTeamId: 'team-custom',
          defaultChannelId: 'channel-custom',
          useAdaptiveCards: false, // Test text responses
          threadUpdates: false,   // Test without tracking
          serviceUrl: 'https://custom.teams.com',
        },
        logger: mockLogger,
      });

      expect(customConfigService.isEnabled()).toBe(true);

      await customConfigService.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting Teams Bot Framework integration...');

      await customConfigService.stop();
    });

    it('should handle missing configuration gracefully', async () => {
      const minimalService = new TeamsService({
        orchestrator: mockOrchestrator,
        env: {},
        logger: mockLogger,
      });

      expect(minimalService.isEnabled()).toBe(false);

      await minimalService.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Teams integration disabled or missing credentials.');

      await minimalService.stop();
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(async () => {
      await teamsService.start();
    });

    it('should handle multiple concurrent commands', async () => {
      const commands = [
        'run Task 1',
        'run Task 2',
        'run Task 3',
        'status',
        'think Great idea',
      ];

      const mockContexts = commands.map((text, index) => ({
        activity: {
          text,
          id: `activity-${index}`,
          from: { id: `user-${index}` },
          conversation: { id: `conv-${index}` },
          serviceUrl: 'https://teams.concurrent.com',
        },
        sendActivity: vi.fn(),
      }));

      const handleMessage = (teamsService as any).handleMessage;
      const promises = mockContexts.map(context =>
        handleMessage.call(teamsService, context)
      );

      await Promise.all(promises);

      // Verify all commands were processed
      mockContexts.forEach(context => {
        expect(context.sendActivity).toHaveBeenCalled();
      });
    });

    it('should handle multiple concurrent orchestrator events', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        ...mockTask,
        id: `task-concurrent-${i}`,
      }));

      // Store conversation references for all tasks
      const taskConversations = (teamsService as any).taskConversations;
      tasks.forEach(task => {
        taskConversations.set(task.id, {
          serviceUrl: 'https://teams.concurrent.com',
          conversationReference: {
            conversation: { id: `conv-${task.id}` },
          },
        });
      });

      const callback = eventCallbacks.get('task:started');
      const promises = tasks.map(task => callback(task));

      await Promise.all(promises);

      const adapter = teamsService.getAdapter();
      expect(adapter.continueConversationAsync).toHaveBeenCalledTimes(tasks.length);
    });
  });
});