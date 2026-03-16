import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackAppService } from '../services/slack-app-service.js';
import { SlackInstallationStore } from '../services/slack-installation-store.js';
import type { SlackIntegrationConfigV2 } from '@apexcli/core';

// Mock Bolt framework
const mockBoltApp = {
  command: vi.fn(),
  event: vi.fn(),
  start: vi.fn()
};

const mockExpressReceiver = {
  router: {
    get: vi.fn(),
    post: vi.fn(),
    all: vi.fn()
  }
};

vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(function() {
    return mockBoltApp;
  }),
  ExpressReceiver: vi.fn().mockImplementation(function() {
    return mockExpressReceiver;
  }),
  LogLevel: { INFO: 'info' }
}));

// Mock WebClient
const mockWebClient = {
  chat: {
    postMessage: vi.fn().mockResolvedValue({
      ok: true,
      ts: '1234567890.123'
    })
  },
  views: {
    publish: vi.fn().mockResolvedValue({ ok: true })
  }
};

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function() {
    return mockWebClient;
  })
}));

// Mock SlackInstallationStore
vi.mock('../services/slack-installation-store.js');

// Mock slack-service for parseSlackCommandText
vi.mock('../services/slack-service.js', () => ({
  parseSlackCommandText: vi.fn((text: string) => {
    const parts = text.split(' ');
    const command = parts[0] || 'help';
    const args = parts.slice(1).join(' ');
    return { command, args };
  })
}));

describe('Slack OAuth Flow Integration', () => {
  let service: SlackAppService;
  let mockOrchestrator: any;
  let mockDatabase: any;
  let mockLogger: any;
  let config: SlackIntegrationConfigV2;

  beforeEach(() => {
    mockOrchestrator = {
      createTask: vi.fn().mockResolvedValue({
        id: 'task-123',
        description: 'Test task',
        status: 'pending',
        workflow: 'development'
      }),
      getActiveTasks: vi.fn().mockResolvedValue([]),
      getTask: vi.fn().mockResolvedValue({
        id: 'task-123',
        description: 'Test task',
        status: 'running'
      }),
      cancelTask: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getStore: vi.fn().mockReturnValue({
        getDatabase: vi.fn().mockReturnValue({})
      })
    };

    mockDatabase = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([])
      })
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    config = {
      enabled: true,
      mode: 'http',
      oauth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        signingSecret: 'test-signing-secret',
        stateSecret: 'test-state-secret',
        scopes: ['commands', 'chat:write', 'channels:read'],
        userScopes: [],
        redirectUri: 'https://test.com/slack/oauth_redirect'
      },
      defaultChannel: '#apex',
      threadUpdates: true,
      useBlocks: true
    };

    service = new SlackAppService({
      orchestrator: mockOrchestrator,
      config,
      getDatabase: () => mockDatabase,
      logger: mockLogger
    });

    // Mock installation store methods
    const mockInstallationStore = new SlackInstallationStore({
      getDatabase: () => mockDatabase,
      logger: mockLogger
    });

    mockInstallationStore.storeInstallation = vi.fn().mockResolvedValue(undefined);
    mockInstallationStore.fetchInstallation = vi.fn().mockResolvedValue({
      team: { id: 'T123', name: 'Test Team' },
      bot: { userId: 'U123', token: 'xoxb-test-token', scopes: ['commands'] }
    });
    mockInstallationStore.deleteInstallation = vi.fn().mockResolvedValue(undefined);
    mockInstallationStore.getAllInstallations = vi.fn().mockResolvedValue([]);
    mockInstallationStore.getByTeamId = vi.fn().mockResolvedValue({
      teamId: 'T123',
      teamName: 'Test Team',
      botToken: 'xoxb-test-token',
      botScopes: ['commands', 'chat:write'],
      isActive: true,
      installedAt: new Date(),
      botUserId: 'U123',
      installedByUserId: 'U456'
    });

    (service as any).installationStore = mockInstallationStore;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OAuth Configuration', () => {
    it('should properly configure ExpressReceiver with OAuth settings', async () => {
      const { ExpressReceiver } = await import('@slack/bolt');

      await service.start();

      expect(ExpressReceiver).toHaveBeenCalledWith({
        signingSecret: 'test-signing-secret',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        stateSecret: 'test-state-secret',
        scopes: ['commands', 'chat:write', 'channels:read'],
        installationStore: expect.any(Object),
        installerOptions: {
          redirectUriPath: '/slack/oauth_redirect',
          stateVerification: true,
          userScopes: []
        }
      });
    });

    it('should register Bolt app with ExpressReceiver', async () => {
      const { App } = await import('@slack/bolt');

      await service.start();

      expect(App).toHaveBeenCalledWith({
        receiver: mockExpressReceiver,
        logLevel: 'info'
      });
    });

    it('should register slash command handler', async () => {
      await service.start();

      expect(mockBoltApp.command).toHaveBeenCalledWith('/apex', expect.any(Function));
    });

    it('should register event handlers', async () => {
      await service.start();

      expect(mockBoltApp.event).toHaveBeenCalledWith('app_home_opened', expect.any(Function));
      expect(mockBoltApp.event).toHaveBeenCalledWith('app_uninstalled', expect.any(Function));
    });
  });

  describe('Slash Command Handling', () => {
    it('should handle /apex run command', async () => {
      await service.start();

      // Get the registered command handler
      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      expect(commandHandler).toBeDefined();

      // Mock command context
      const mockCommand = {
        channel_id: 'C123',
        channel_name: 'general',
        user_id: 'U456',
        team_id: 'T123',
        response_url: 'https://hooks.slack.com/commands/123',
        text: 'run "Build a new feature"'
      };

      const mockAck = vi.fn();
      const mockRespond = vi.fn();

      await commandHandler({
        command: mockCommand,
        ack: mockAck,
        respond: mockRespond,
        client: mockWebClient
      });

      expect(mockAck).toHaveBeenCalled();
      expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
        description: 'Build a new feature'
      });
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should handle /apex status command', async () => {
      await service.start();

      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      const mockCommand = {
        channel_id: 'C123',
        user_id: 'U456',
        team_id: 'T123',
        text: 'status'
      };

      await commandHandler({
        command: mockCommand,
        ack: vi.fn(),
        respond: vi.fn(),
        client: mockWebClient
      });

      expect(mockOrchestrator.getActiveTasks).toHaveBeenCalled();
      expect(mockWebClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should handle /apex think command', async () => {
      await service.start();

      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      const mockCommand = {
        channel_id: 'C123',
        user_id: 'U456',
        team_id: 'T123',
        text: 'think "Analyze performance"'
      };

      await commandHandler({
        command: mockCommand,
        ack: vi.fn(),
        respond: vi.fn(),
        client: mockWebClient
      });

      expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
        description: 'Analyze performance',
        workflow: 'thinking'
      });
    });

    it('should handle command errors gracefully', async () => {
      await service.start();

      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      // Mock orchestrator to throw error
      mockOrchestrator.createTask.mockRejectedValueOnce(new Error('Task creation failed'));

      const mockCommand = {
        channel_id: 'C123',
        user_id: 'U456',
        team_id: 'T123',
        text: 'run "Failing task"'
      };

      const mockRespond = vi.fn();

      await commandHandler({
        command: mockCommand,
        ack: vi.fn(),
        respond: mockRespond,
        client: mockWebClient
      });

      expect(mockRespond).toHaveBeenCalledWith({
        text: 'Command failed. Check server logs for details.',
        response_type: 'ephemeral'
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Slack command failed: Task creation failed'
      );
    });
  });

  describe('Event Handling', () => {
    it('should handle app_home_opened event', async () => {
      await service.start();

      const eventHandler = mockBoltApp.event.mock.calls.find(
        call => call[0] === 'app_home_opened'
      )?.[1];

      expect(eventHandler).toBeDefined();

      const mockEvent = {
        user: 'U456',
        type: 'app_home_opened'
      };

      await eventHandler({
        event: mockEvent,
        client: mockWebClient
      });

      expect(mockWebClient.views.publish).toHaveBeenCalledWith({
        user_id: 'U456',
        view: expect.objectContaining({
          type: 'home',
          blocks: expect.arrayContaining([
            expect.objectContaining({
              type: 'section',
              text: expect.objectContaining({
                text: expect.stringContaining('Welcome to APEX!')
              })
            })
          ])
        })
      });
    });

    it('should handle app_uninstalled event', async () => {
      await service.start();

      const eventHandler = mockBoltApp.event.mock.calls.find(
        call => call[0] === 'app_uninstalled'
      )?.[1];

      const mockEvent = {
        type: 'app_uninstalled'
      };

      const mockContext = {
        teamId: 'T123',
        enterpriseId: 'E123'
      };

      await eventHandler({
        event: mockEvent,
        context: mockContext
      });

      const mockInstallationStore = (service as any).installationStore;
      expect(mockInstallationStore.deleteInstallation).toHaveBeenCalledWith({
        teamId: 'T123',
        enterpriseId: 'E123'
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Slack app uninstalled from team T123'
      );
    });
  });

  describe('Router Integration', () => {
    it('should provide router for mounting routes', async () => {
      await service.start();

      const router = service.getRouter();

      expect(router).toBe(mockExpressReceiver.router);
    });

    it('should return undefined router when not started', () => {
      const router = service.getRouter();

      expect(router).toBeUndefined();
    });
  });

  describe('Installation Management', () => {
    it('should retrieve all installations', async () => {
      const mockInstallations = [
        { teamId: 'T123', teamName: 'Team 1' },
        { teamId: 'T456', teamName: 'Team 2' }
      ];

      const mockInstallationStore = (service as any).installationStore;
      mockInstallationStore.getAllInstallations.mockResolvedValueOnce(mockInstallations);

      const result = await service.getInstallations();

      expect(result).toBe(mockInstallations);
    });

    it('should send message to specific workspace', async () => {
      await service.sendToWorkspace('T123', '#general', {
        text: 'Test message',
        blocks: []
      });

      const mockInstallationStore = (service as any).installationStore;
      expect(mockInstallationStore.getByTeamId).toHaveBeenCalledWith('T123');
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: '#general',
        text: 'Test message',
        blocks: []
      });
    });

    it('should broadcast to all workspaces', async () => {
      const mockInstallations = [
        {
          teamId: 'T123',
          botToken: 'token-1',
          defaultChannelId: '#general'
        },
        {
          teamId: 'T456',
          botToken: 'token-2',
          defaultChannelId: '#apex'
        }
      ];

      const mockInstallationStore = (service as any).installationStore;
      mockInstallationStore.getAllInstallations.mockResolvedValueOnce(mockInstallations);
      mockInstallationStore.getByTeamId
        .mockResolvedValueOnce(mockInstallations[0])
        .mockResolvedValueOnce(mockInstallations[1]);

      await service.broadcastToAll({ text: 'Broadcast message' });

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Orchestrator Event Integration', () => {
    it('should register orchestrator event handlers', async () => {
      await service.start();

      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:stage-changed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:paused', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });
  });
});