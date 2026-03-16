import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackAppService } from '../services/slack-app-service.js';
import { SlackInstallationStore } from '../services/slack-installation-store.js';
import type { SlackIntegrationConfigV2 } from '@apexcli/core';
import type { Installation, InstallationQuery } from '@slack/bolt';

// Mock Slack Bolt framework
const mockBoltApp = {
  command: vi.fn(),
  event: vi.fn(),
  start: vi.fn(),
  stop: vi.fn()
};

const mockExpressReceiver = {
  router: {
    get: vi.fn(),
    post: vi.fn(),
    all: vi.fn()
  },
  installer: {
    generateInstallUrl: vi.fn(),
    handleCallback: vi.fn()
  }
};

vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(function() {
    return mockBoltApp;
  }),
  ExpressReceiver: vi.fn().mockImplementation(function() {
    return mockExpressReceiver;
  }),
  LogLevel: { INFO: 'info', ERROR: 'error', DEBUG: 'debug' }
}));

// Mock WebClient with various API scenarios
const createMockWebClient = (overrides: any = {}) => ({
  chat: {
    postMessage: vi.fn().mockResolvedValue({ ok: true, ts: '1234567890.123' }),
    ...overrides.chat
  },
  views: {
    publish: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides.views
  },
  auth: {
    test: vi.fn().mockResolvedValue({ ok: true, team_id: 'T123' }),
    ...overrides.auth
  }
});

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(function() {
    return createMockWebClient();
  })
}));

vi.mock('../services/slack-installation-store.js');

/**
 * Slack OAuth Flow Edge Cases and Error Handling Tests
 *
 * Tests comprehensive error scenarios, edge cases, and resilience
 * of the Slack App OAuth implementation.
 */
describe('Slack OAuth Flow Edge Cases', () => {
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
      getTask: vi.fn().mockResolvedValue(null),
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
      error: vi.fn(),
      debug: vi.fn()
    };

    config = {
      enabled: true,
      mode: 'http',
      oauth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        signingSecret: 'test-signing-secret',
        stateSecret: 'test-state-secret',
        scopes: ['commands', 'chat:write'],
        userScopes: [],
        redirectUri: 'https://test.com/slack/oauth_redirect'
      }
    };

    service = new SlackAppService({
      orchestrator: mockOrchestrator,
      config,
      getDatabase: () => mockDatabase,
      logger: mockLogger
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing optional OAuth parameters', async () => {
      const minimalConfig: SlackIntegrationConfigV2 = {
        enabled: true,
        mode: 'http',
        oauth: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          signingSecret: 'test-signing-secret'
          // Missing stateSecret, scopes, userScopes, redirectUri
        }
      };

      const minimalService = new SlackAppService({
        orchestrator: mockOrchestrator,
        config: minimalConfig,
        getDatabase: () => mockDatabase,
        logger: mockLogger
      });

      expect(minimalService.isOAuthEnabled()).toBe(true);
      await minimalService.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting Slack App with OAuth support...');
    });

    it('should handle empty scopes array', async () => {
      const configWithEmptyScopes = {
        ...config,
        oauth: {
          ...config.oauth!,
          scopes: [],
          userScopes: []
        }
      };

      const serviceEmptyScopes = new SlackAppService({
        orchestrator: mockOrchestrator,
        config: configWithEmptyScopes,
        getDatabase: () => mockDatabase,
        logger: mockLogger
      });

      await serviceEmptyScopes.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Slack OAuth App initialized.');
    });

    it('should handle undefined config gracefully', async () => {
      const serviceNoConfig = new SlackAppService({
        orchestrator: mockOrchestrator,
        // No config provided
        getDatabase: () => mockDatabase,
        logger: mockLogger
      });

      expect(serviceNoConfig.isOAuthEnabled()).toBe(false);
      await serviceNoConfig.start();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slack integration enabled but not configured properly.'
      );
    });

    it('should resolve configuration from environment variables with missing values', () => {
      const partialEnv = {
        SLACK_CLIENT_ID: 'env-client-id',
        // Missing SLACK_CLIENT_SECRET and SLACK_SIGNING_SECRET
        SLACK_DEFAULT_CHANNEL: '#general'
      };

      const servicePartialEnv = new SlackAppService({
        orchestrator: mockOrchestrator,
        getDatabase: () => mockDatabase,
        logger: mockLogger,
        env: partialEnv
      });

      expect(servicePartialEnv.isOAuthEnabled()).toBe(false);
    });
  });

  describe('Installation Store Error Handling', () => {
    it('should handle installation store failures gracefully', async () => {
      const mockInstallationStore = {
        storeInstallation: vi.fn().mockRejectedValue(new Error('Database error')),
        fetchInstallation: vi.fn().mockRejectedValue(new Error('Fetch error')),
        deleteInstallation: vi.fn().mockResolvedValue(undefined),
        getAllInstallations: vi.fn().mockRejectedValue(new Error('Query error')),
        getByTeamId: vi.fn().mockRejectedValue(new Error('Team lookup error'))
      };

      (service as any).installationStore = mockInstallationStore;

      // Test installation retrieval failure
      const installations = await service.getInstallations();
      expect(installations).toEqual([]); // Should return empty array on error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get installations')
      );
    });

    it('should handle sendToWorkspace with missing installation', async () => {
      const mockInstallationStore = {
        getByTeamId: vi.fn().mockResolvedValue(null)
      };

      (service as any).installationStore = mockInstallationStore;

      await service.sendToWorkspace('T123', '#general', { text: 'Test message' });

      expect(mockLogger.warn).toHaveBeenCalledWith('No installation found for team T123');
    });

    it('should handle sendToWorkspace with installation store error', async () => {
      const mockInstallationStore = {
        getByTeamId: vi.fn().mockRejectedValue(new Error('Store error'))
      };

      (service as any).installationStore = mockInstallationStore;

      await service.sendToWorkspace('T123', '#general', { text: 'Test message' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send message to workspace T123')
      );
    });
  });

  describe('Slack API Error Handling', () => {
    it('should handle Slack API rate limiting', async () => {
      const mockWebClient = createMockWebClient({
        chat: {
          postMessage: vi.fn().mockRejectedValue({
            code: 'rate_limited',
            message: 'Rate limit exceeded',
            data: { retry_after: 60 }
          })
        }
      });

      // Mock WebClient to return rate limited client
      vi.mocked(require('@slack/web-api').WebClient).mockImplementation(() => mockWebClient);

      const mockInstallationStore = {
        getByTeamId: vi.fn().mockResolvedValue({
          teamId: 'T123',
          botToken: 'xoxb-test-token'
        })
      };

      (service as any).installationStore = mockInstallationStore;

      await service.sendToWorkspace('T123', '#general', { text: 'Test message' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send message to workspace T123')
      );
    });

    it('should handle invalid auth token', async () => {
      const mockWebClient = createMockWebClient({
        chat: {
          postMessage: vi.fn().mockRejectedValue({
            code: 'invalid_auth',
            message: 'Invalid token'
          })
        }
      });

      vi.mocked(require('@slack/web-api').WebClient).mockImplementation(() => mockWebClient);

      const mockInstallationStore = {
        getByTeamId: vi.fn().mockResolvedValue({
          teamId: 'T123',
          botToken: 'xoxb-invalid-token'
        })
      };

      (service as any).installationStore = mockInstallationStore;

      await service.sendToWorkspace('T123', '#general', { text: 'Test message' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send message to workspace T123')
      );
    });

    it('should handle channel not found errors', async () => {
      const mockWebClient = createMockWebClient({
        chat: {
          postMessage: vi.fn().mockRejectedValue({
            code: 'channel_not_found',
            message: 'Channel not found'
          })
        }
      });

      vi.mocked(require('@slack/web-api').WebClient).mockImplementation(() => mockWebClient);

      const mockInstallationStore = {
        getByTeamId: vi.fn().mockResolvedValue({
          teamId: 'T123',
          botToken: 'xoxb-test-token'
        })
      };

      (service as any).installationStore = mockInstallationStore;

      await service.sendToWorkspace('T123', '#nonexistent', { text: 'Test message' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send message to workspace T123')
      );
    });

    it('should handle network errors gracefully', async () => {
      const mockWebClient = createMockWebClient({
        chat: {
          postMessage: vi.fn().mockRejectedValue(new Error('Network timeout'))
        }
      });

      vi.mocked(require('@slack/web-api').WebClient).mockImplementation(() => mockWebClient);

      const mockInstallationStore = {
        getByTeamId: vi.fn().mockResolvedValue({
          teamId: 'T123',
          botToken: 'xoxb-test-token'
        })
      };

      (service as any).installationStore = mockInstallationStore;

      await service.sendToWorkspace('T123', '#general', { text: 'Test message' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Network timeout')
      );
    });
  });

  describe('Command Handling Edge Cases', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should handle malformed command text', async () => {
      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      const malformedCommands = [
        { text: '' }, // Empty command
        { text: '   ' }, // Whitespace only
        { text: 'run' }, // Missing quotes
        { text: 'run "unclosed quote' }, // Unclosed quote
        { text: 'unknown-command "test"' }, // Unknown command
        { text: 'run "' + 'x'.repeat(10000) + '"' } // Extremely long command
      ];

      for (const cmd of malformedCommands) {
        const mockCommand = {
          channel_id: 'C123',
          user_id: 'U456',
          team_id: 'T123',
          text: cmd.text
        };

        const mockRespond = vi.fn();

        await commandHandler({
          command: mockCommand,
          ack: vi.fn(),
          respond: mockRespond,
          client: createMockWebClient()
        });

        // Should acknowledge all commands even if malformed
        expect(mockRespond).toHaveBeenCalled();
      }
    });

    it('should handle orchestrator task creation failures', async () => {
      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      // Mock orchestrator to fail
      mockOrchestrator.createTask.mockRejectedValueOnce(new Error('Task creation failed'));
      mockOrchestrator.getActiveTasks.mockRejectedValueOnce(new Error('Status retrieval failed'));
      mockOrchestrator.cancelTask.mockRejectedValueOnce(new Error('Cancellation failed'));

      const commands = [
        { text: 'run "Test task"', expectError: 'Task creation failed' },
        { text: 'status', expectError: 'Status retrieval failed' },
        { text: 'cancel task-123', expectError: 'Cancellation failed' }
      ];

      for (const cmd of commands) {
        const mockCommand = {
          channel_id: 'C123',
          user_id: 'U456',
          team_id: 'T123',
          text: cmd.text
        };

        const mockRespond = vi.fn();

        await commandHandler({
          command: mockCommand,
          ack: vi.fn(),
          respond: mockRespond,
          client: createMockWebClient()
        });

        expect(mockRespond).toHaveBeenCalledWith({
          text: 'Command failed. Check server logs for details.',
          response_type: 'ephemeral'
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(cmd.expectError)
        );
      }
    });

    it('should handle WebClient failures in command responses', async () => {
      const commandHandler = mockBoltApp.command.mock.calls.find(
        call => call[0] === '/apex'
      )?.[1];

      const mockWebClient = createMockWebClient({
        chat: {
          postMessage: vi.fn().mockRejectedValue(new Error('API Error'))
        }
      });

      const mockCommand = {
        channel_id: 'C123',
        user_id: 'U456',
        team_id: 'T123',
        text: 'run "Test task"'
      };

      const mockRespond = vi.fn();

      await commandHandler({
        command: mockCommand,
        ack: vi.fn(),
        respond: mockRespond,
        client: mockWebClient
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('API Error')
      );
    });
  });

  describe('Event Handling Edge Cases', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should handle app_home_opened with WebClient failure', async () => {
      const eventHandler = mockBoltApp.event.mock.calls.find(
        call => call[0] === 'app_home_opened'
      )?.[1];

      const mockWebClient = createMockWebClient({
        views: {
          publish: vi.fn().mockRejectedValue(new Error('Views API error'))
        }
      });

      const mockEvent = {
        user: 'U456',
        type: 'app_home_opened'
      };

      await eventHandler({
        event: mockEvent,
        client: mockWebClient
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Views API error')
      );
    });

    it('should handle app_uninstalled with store failure', async () => {
      const eventHandler = mockBoltApp.event.mock.calls.find(
        call => call[0] === 'app_uninstalled'
      )?.[1];

      const mockInstallationStore = {
        deleteInstallation: vi.fn().mockRejectedValue(new Error('Store deletion failed'))
      };

      (service as any).installationStore = mockInstallationStore;

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

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Store deletion failed')
      );
    });

    it('should handle missing context in app_uninstalled', async () => {
      const eventHandler = mockBoltApp.event.mock.calls.find(
        call => call[0] === 'app_uninstalled'
      )?.[1];

      const mockEvent = {
        type: 'app_uninstalled'
      };

      // Missing context
      await eventHandler({
        event: mockEvent,
        context: {}
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing teamId in app_uninstalled context')
      );
    });
  });

  describe('Broadcasting Edge Cases', () => {
    it('should handle partial broadcast failures', async () => {
      const mockInstallations = [
        { teamId: 'T123', botToken: 'token1', defaultChannelId: '#general' },
        { teamId: 'T456', botToken: 'token2', defaultChannelId: '#apex' },
        { teamId: 'T789', botToken: 'token3', defaultChannelId: '#test' }
      ];

      const mockInstallationStore = {
        getAllInstallations: vi.fn().mockResolvedValue(mockInstallations),
        getByTeamId: vi.fn()
          .mockResolvedValueOnce(mockInstallations[0]) // Success
          .mockResolvedValueOnce(null) // Missing installation
          .mockRejectedValueOnce(new Error('Database error')) // Store error
      };

      (service as any).installationStore = mockInstallationStore;

      // Mock WebClient to succeed for first team
      const mockWebClient = createMockWebClient();
      vi.mocked(require('@slack/web-api').WebClient).mockImplementation(() => mockWebClient);

      await service.broadcastToAll({ text: 'Broadcast message' });

      // Should attempt all teams despite failures
      expect(mockInstallationStore.getByTeamId).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith('No installation found for team T456');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send message to workspace T789')
      );
    });

    it('should handle empty installations list', async () => {
      const mockInstallationStore = {
        getAllInstallations: vi.fn().mockResolvedValue([])
      };

      (service as any).installationStore = mockInstallationStore;

      await service.broadcastToAll({ text: 'Broadcast message' });

      expect(mockLogger.info).toHaveBeenCalledWith('No installations found for broadcast');
    });
  });

  describe('Resource Management', () => {
    it('should handle stop gracefully even without proper initialization', async () => {
      const uninitializedService = new SlackAppService({
        orchestrator: mockOrchestrator,
        config: { enabled: false },
        getDatabase: () => mockDatabase,
        logger: mockLogger
      });

      await uninitializedService.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Slack App stopped.');
    });

    it('should handle multiple start calls', async () => {
      await service.start();
      await service.start(); // Second start call

      // Should not create multiple Bolt apps
      expect(mockLogger.info).toHaveBeenCalledWith('Slack OAuth App initialized.');
    });

    it('should handle router access before initialization', () => {
      const uninitializedService = new SlackAppService({
        orchestrator: mockOrchestrator,
        config,
        getDatabase: () => mockDatabase,
        logger: mockLogger
      });

      const router = uninitializedService.getRouter();
      expect(router).toBeUndefined();
    });
  });
});