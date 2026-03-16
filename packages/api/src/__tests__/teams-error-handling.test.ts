/**
 * Teams Error Handling and Edge Cases Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for error scenarios, edge cases, security considerations,
 * and fault tolerance in the Teams integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamsService, parseTeamsCommandText } from '../packages/api/src/services/teams-service.js';
import { TeamsMessagingExtension } from '../packages/api/src/services/teams-messaging-extension.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Bot Framework SDK with error scenarios
vi.mock('botbuilder', () => ({
  CloudAdapter: vi.fn(() => ({
    process: vi.fn(),
    onTurnError: null,
    continueConversationAsync: vi.fn(),
  })),
  ConfigurationBotFrameworkAuthentication: vi.fn(() => {
    throw new Error('Authentication failed');
  }),
  ActivityHandler: vi.fn(),
  TurnContext: {
    getConversationReference: vi.fn(() => ({ conversation: { id: 'test-conv' } })),
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

describe('Teams Error Handling and Edge Cases', () => {
  let teamsService: TeamsService;
  let messagingExtension: TeamsMessagingExtension;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;

  beforeEach(() => {
    mockOrchestrator = {
      createTask: vi.fn(),
      getTask: vi.fn(),
      getCurrentTask: vi.fn(),
      listTasks: vi.fn(),
      cancelTask: vi.fn(),
      captureThought: vi.fn(),
      on: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(async () => {
    if (teamsService) {
      await teamsService.stop();
    }
  });

  describe('Service Initialization Errors', () => {
    it('should handle CloudAdapter initialization failure', async () => {
      const { CloudAdapter } = await import('botbuilder');
      vi.mocked(CloudAdapter).mockImplementationOnce(() => {
        throw new Error('Failed to initialize CloudAdapter');
      });

      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      await expect(teamsService.start()).rejects.toThrow('Failed to initialize CloudAdapter');
    });

    it('should handle authentication configuration errors', async () => {
      // ConfigurationBotFrameworkAuthentication is mocked to throw in beforeEach
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      await expect(teamsService.start()).rejects.toThrow('Authentication failed');
    });

    it('should handle null orchestrator gracefully', () => {
      expect(() => new TeamsService({
        orchestrator: null as any,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      })).toThrow();
    });

    it('should handle undefined configuration properties', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: undefined,
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(false);
    });
  });

  describe('Command Parsing Edge Cases', () => {
    it('should handle extremely long command text', () => {
      const longCommand = 'run ' + 'a'.repeat(10000);
      const result = parseTeamsCommandText(longCommand);

      expect(result.command).toBe('run');
      expect(result.args).toHaveLength(10000);
    });

    it('should handle command with only special characters', () => {
      const specialCommand = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = parseTeamsCommandText(specialCommand);

      expect(result.command).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?');
      expect(result.args).toBe('');
    });

    it('should handle malformed mention tags', () => {
      const malformedMentions = [
        '<at>User</at> run task',
        '<at>User run task',
        'at>User</at> run task',
        '<at></at> run task',
        '<at>User<at> run task',
        '<<at>>User<</at>> run task',
      ];

      malformedMentions.forEach(text => {
        const result = parseTeamsCommandText(text);
        expect(result).toBeDefined();
        expect(typeof result.command).toBe('string');
      });
    });

    it('should handle Unicode and emoji in commands', () => {
      const unicodeCommand = 'run 创建任务 with émojis 🚀🎉 and symbols ©®™';
      const result = parseTeamsCommandText(unicodeCommand);

      expect(result.command).toBe('run');
      expect(result.args).toBe('创建任务 with émojis 🚀🎉 and symbols ©®™');
    });

    it('should handle null and undefined input', () => {
      const nullResult = parseTeamsCommandText(null as any);
      const undefinedResult = parseTeamsCommandText(undefined as any);

      expect(nullResult.command).toBe('help');
      expect(undefinedResult.command).toBe('help');
    });

    it('should handle commands with excessive whitespace', () => {
      const excessiveWhitespace = '   \t\n  run   \t\n  task   description   \t\n  ';
      const result = parseTeamsCommandText(excessiveWhitespace);

      expect(result.command).toBe('run');
      expect(result.args).toBe('task description');
    });
  });

  describe('Orchestrator Error Scenarios', () => {
    beforeEach(() => {
      // Reset mocks to not throw by default
      const { ConfigurationBotFrameworkAuthentication } = vi.mocked(await import('botbuilder'));
      ConfigurationBotFrameworkAuthentication.mockImplementation(() => ({} as any));

      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          useAdaptiveCards: false,
        },
        logger: mockLogger,
      });

      messagingExtension = new TeamsMessagingExtension(mockOrchestrator);
    });

    it('should handle orchestrator timeout errors', async () => {
      mockOrchestrator.createTask.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timed out')), 100)
        )
      );

      const mockContext = {
        activity: {
          text: 'run Create task that times out',
          from: { id: 'user-123' },
          conversation: { id: 'conv-123' },
          serviceUrl: 'https://teams.example.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (teamsService as any).handleMessage;
      await handleMessage.call(teamsService, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Teams command failed: Operation timed out');
      expect(mockContext.sendActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Command failed. Check server logs for details.'
        })
      );
    });

    it('should handle orchestrator returning invalid data', async () => {
      mockOrchestrator.createTask.mockResolvedValue(null);

      const mockContext = {
        activity: {
          text: 'run Create invalid task',
          from: { id: 'user-123' },
          conversation: { id: 'conv-123' },
          serviceUrl: 'https://teams.example.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (teamsService as any).handleMessage;

      // Should not crash even with null response
      await expect(handleMessage.call(teamsService, mockContext)).resolves.not.toThrow();
    });

    it('should handle orchestrator connection failures', async () => {
      mockOrchestrator.listTasks.mockRejectedValue(new Error('Connection refused'));

      const query = {
        parameters: [{ value: 'test' }],
      };

      const result = await messagingExtension.handleQuery({} as any, query);

      expect(result.composeExtension.attachments).toHaveLength(0);
    });

    it('should handle orchestrator returning malformed task data', async () => {
      const malformedTask = {
        id: null,
        description: undefined,
        status: 123,
        workflow: {},
        priority: [],
      };

      mockOrchestrator.createTask.mockResolvedValue(malformedTask as any);

      const mockContext = {
        activity: {
          text: 'run Create malformed task',
          from: { id: 'user-123' },
          conversation: { id: 'conv-123' },
          serviceUrl: 'https://teams.example.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (teamsService as any).handleMessage;

      // Should not crash with malformed data
      await expect(handleMessage.call(teamsService, mockContext)).resolves.not.toThrow();
    });
  });

  describe('Network and Communication Errors', () => {
    beforeEach(async () => {
      // Reset mocks to not throw by default
      const { ConfigurationBotFrameworkAuthentication } = vi.mocked(await import('botbuilder'));
      ConfigurationBotFrameworkAuthentication.mockImplementation(() => ({} as any));

      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      await teamsService.start();
    });

    it('should handle Teams API communication failures', async () => {
      const adapter = teamsService.getAdapter();
      adapter.continueConversationAsync.mockRejectedValue(new Error('Teams API unavailable'));

      // Store a conversation reference
      const taskConversations = (teamsService as any).taskConversations;
      taskConversations.set('task-123', {
        serviceUrl: 'https://teams.example.com',
        conversationReference: { conversation: { id: 'conv-123' } },
      });

      const notifyTaskUpdate = (teamsService as any).notifyTaskUpdate;
      await notifyTaskUpdate.call(teamsService, { id: 'task-123' }, 'Test update');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send task update: Teams API unavailable');
    });

    it('should handle context sendActivity failures', async () => {
      const mockContext = {
        activity: {
          text: 'help',
          from: { id: 'user-123' },
          conversation: { id: 'conv-123' },
          serviceUrl: 'https://teams.example.com',
        },
        sendActivity: vi.fn().mockRejectedValue(new Error('Send failed')),
      };

      const handleMessage = (teamsService as any).handleMessage;

      // Should not throw even if sendActivity fails
      await expect(handleMessage.call(teamsService, mockContext)).resolves.not.toThrow();
    });

    it('should handle processActivity with invalid request/response objects', async () => {
      const invalidReq = null;
      const invalidRes = undefined;

      await teamsService.processActivity(invalidReq, invalidRes);

      // Should handle gracefully by checking adapter state
      expect(true).toBe(true); // Test completed without throwing
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(async () => {
      const { ConfigurationBotFrameworkAuthentication } = vi.mocked(await import('botbuilder'));
      ConfigurationBotFrameworkAuthentication.mockImplementation(() => ({} as any));

      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      await teamsService.start();
    });

    it('should handle excessive conversation storage', async () => {
      const taskConversations = (teamsService as any).taskConversations;

      // Simulate storing many conversations
      for (let i = 0; i < 10000; i++) {
        taskConversations.set(`task-${i}`, {
          serviceUrl: 'https://teams.example.com',
          conversationReference: { conversation: { id: `conv-${i}` } },
        });
      }

      expect(taskConversations.size).toBe(10000);

      // Service should still function normally
      const mockContext = {
        activity: {
          text: 'status',
          from: { id: 'user-memory-test' },
          conversation: { id: 'conv-memory-test' },
          serviceUrl: 'https://teams.example.com',
        },
        sendActivity: vi.fn(),
      };

      const handleMessage = (teamsService as any).handleMessage;
      await expect(handleMessage.call(teamsService, mockContext)).resolves.not.toThrow();
    });

    it('should handle memory cleanup on service stop', async () => {
      const taskConversations = (teamsService as any).taskConversations;
      taskConversations.set('task-cleanup-test', {
        serviceUrl: 'https://teams.example.com',
        conversationReference: { conversation: { id: 'conv-cleanup' } },
      });

      await teamsService.stop();

      // Service should be in stopped state
      expect(teamsService.getAdapter()).toBeUndefined();
    });
  });

  describe('Security and Input Validation', () => {
    beforeEach(() => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      messagingExtension = new TeamsMessagingExtension(mockOrchestrator);
    });

    it('should handle potential XSS in command text', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        'run <svg onload=alert(1)>',
        'think <iframe src="javascript:alert(1)">',
      ];

      xssAttempts.forEach(text => {
        const result = parseTeamsCommandText(text);
        expect(result).toBeDefined();
        expect(typeof result.command).toBe('string');
        expect(typeof result.args).toBe('string');
      });
    });

    it('should handle potential SQL injection in search queries', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE tasks; --",
        "1' OR '1'='1",
        "1'; EXEC xp_cmdshell('dir'); --",
        "task'; UPDATE tasks SET status='hacked' WHERE id='task-1'; --",
      ];

      for (const injection of sqlInjectionAttempts) {
        const query = {
          parameters: [{ value: injection }],
        };

        const result = await messagingExtension.handleQuery({} as any, query);
        expect(result.composeExtension).toBeDefined();
        // Should not crash or execute malicious queries
      }
    });

    it('should handle excessively large input payloads', async () => {
      const largePayload = 'x'.repeat(1000000); // 1MB of text

      const result = parseTeamsCommandText(`run ${largePayload}`);
      expect(result.command).toBe('run');
      expect(result.args).toHaveLength(1000000);

      // Should handle large payloads without crashing
      const query = {
        parameters: [{ value: largePayload }],
      };

      await expect(messagingExtension.handleQuery({} as any, query)).resolves.not.toThrow();
    });

    it('should validate configuration parameters', () => {
      const invalidConfigs = [
        { appId: '', appPassword: 'valid' },
        { appId: 'valid', appPassword: '' },
        { appId: null, appPassword: 'valid' },
        { appId: 'valid', appPassword: null },
        { appId: 123, appPassword: 456 }, // Non-string types
      ];

      invalidConfigs.forEach(config => {
        const service = new TeamsService({
          orchestrator: mockOrchestrator,
          config: config as any,
          logger: mockLogger,
        });

        // Should not enable with invalid config
        expect(service.isEnabled()).toBe(false);
      });
    });

    it('should handle circular references in task data', () => {
      const circularTask: any = {
        id: 'task-circular',
        description: 'Circular reference test',
        status: 'in-progress',
      };
      circularTask.self = circularTask; // Create circular reference

      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;

      // Should not crash with circular references
      expect(() => buildTaskCreatedCard.call(teamsService, circularTask, 'user-123')).not.toThrow();
    });
  });

  describe('Adaptive Card Edge Cases', () => {
    beforeEach(() => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
          useAdaptiveCards: true,
        },
        logger: mockLogger,
      });
    });

    it('should handle task with missing or null properties', () => {
      const incompleteTask = {
        id: 'incomplete-task',
        description: null,
        status: undefined,
        workflow: '',
        priority: null,
        effort: undefined,
        createdAt: null,
        updatedAt: undefined,
      };

      const buildTaskReportCard = (teamsService as any).buildTaskReportCard;
      const card = buildTaskReportCard.call(teamsService, incompleteTask);

      expect(card).toBeDefined();
      expect(card.content.body).toBeDefined();
    });

    it('should handle extremely long task descriptions in cards', () => {
      const longDescription = 'This is an extremely long task description that goes on and on '.repeat(100);
      const taskWithLongDescription = {
        id: 'long-desc-task',
        description: longDescription,
        status: 'in-progress',
        workflow: 'test',
        priority: 'normal',
      };

      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, taskWithLongDescription, 'user-123');

      expect(card).toBeDefined();
      expect(card.content.body.some((block: any) => block.text === longDescription)).toBe(true);
    });

    it('should handle special characters in card content', () => {
      const specialCharsTask = {
        id: 'special-chars-task',
        description: 'Task with "quotes" & <tags> and symbols: ©®™ émojis 🚀',
        status: 'in-progress',
        workflow: 'special',
        priority: 'high',
      };

      const buildTaskCreatedCard = (teamsService as any).buildTaskCreatedCard;
      const card = buildTaskCreatedCard.call(teamsService, specialCharsTask, 'user-123');

      expect(card).toBeDefined();
      const descriptionBlock = card.content.body.find((block: any) =>
        block.text === specialCharsTask.description
      );
      expect(descriptionBlock).toBeDefined();
    });

    it('should handle empty or null task arrays in status card', () => {
      const buildStatusCard = (teamsService as any).buildStatusCard;

      // Test with null arrays
      expect(() => buildStatusCard.call(teamsService, null, null, null)).not.toThrow();

      // Test with undefined arrays
      expect(() => buildStatusCard.call(teamsService, undefined, undefined, undefined)).not.toThrow();

      // Test with mixed null/empty arrays
      expect(() => buildStatusCard.call(teamsService, [], null, undefined)).not.toThrow();
    });
  });

  describe('Environment and Configuration Edge Cases', () => {
    it('should handle missing environment variables gracefully', () => {
      const emptyEnv = {};
      const service = new TeamsService({
        orchestrator: mockOrchestrator,
        env: emptyEnv,
        logger: mockLogger,
      });

      expect(service.isEnabled()).toBe(false);
    });

    it('should handle corrupted environment variables', () => {
      const corruptedEnv = {
        TEAMS_APP_ID: null,
        TEAMS_APP_PASSWORD: undefined,
        TEAMS_TENANT_ID: 123,
        TEAMS_OAUTH_CONNECTION_NAME: {},
        TEAMS_DEFAULT_TEAM_ID: [],
        TEAMS_DEFAULT_CHANNEL_ID: Symbol('test'),
        TEAMS_SERVICE_URL: new Date(),
      };

      const service = new TeamsService({
        orchestrator: mockOrchestrator,
        env: corruptedEnv as any,
        logger: mockLogger,
      });

      expect(service.isEnabled()).toBe(false);
    });

    it('should handle process.env being unavailable', () => {
      const originalProcessEnv = process.env;
      delete (global as any).process;

      const service = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      expect(service.isEnabled()).toBe(true);

      // Restore process.env
      (global as any).process = { env: originalProcessEnv };
    });
  });

  describe('Messaging Extension Error Recovery', () => {
    beforeEach(() => {
      messagingExtension = new TeamsMessagingExtension(mockOrchestrator);
    });

    it('should handle query with malformed parameters', async () => {
      const malformedQueries = [
        { parameters: null },
        { parameters: undefined },
        { parameters: 'not-an-array' },
        { parameters: [null] },
        { parameters: [{ value: null }] },
        { parameters: [{ notValue: 'test' }] },
      ];

      for (const query of malformedQueries) {
        const result = await messagingExtension.handleQuery({} as any, query as any);
        expect(result.composeExtension).toBeDefined();
        expect(Array.isArray(result.composeExtension.attachments)).toBe(true);
      }
    });

    it('should handle action with malformed data', async () => {
      const malformedActions = [
        { commandId: null, data: {} },
        { commandId: undefined, data: null },
        { commandId: 'createTask', data: null },
        { commandId: 'createTask', data: 'not-an-object' },
        { commandId: 'createTask', data: [] },
      ];

      for (const action of malformedActions) {
        const result = await messagingExtension.handleAction({} as any, action as any);
        expect(result.task).toBeDefined();
        expect(result.task.type).toBeDefined();
      }
    });

    it('should handle card actions with missing data', async () => {
      const invalidCardData = [
        null,
        undefined,
        'not-an-object',
        [],
        { notAction: 'test' },
        { action: null },
        { action: undefined },
      ];

      for (const cardData of invalidCardData) {
        const result = await messagingExtension.handleCardAction({} as any, cardData as any);
        expect(result.task).toBeDefined();
        expect(result.task.type).toBe('message');
        expect(result.task.value).toContain('❌');
      }
    });
  });
});