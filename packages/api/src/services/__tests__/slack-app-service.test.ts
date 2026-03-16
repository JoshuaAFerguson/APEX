import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackAppService } from '../slack-app-service.js';
import { SlackInstallationStore } from '../slack-installation-store.js';
import type { SlackIntegrationConfigV2 } from '@apexcli/core';

// Mock dependencies
vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(() => ({
    command: vi.fn(),
    event: vi.fn(),
  })),
  ExpressReceiver: vi.fn().mockImplementation(() => ({
    router: vi.fn()
  })),
  LogLevel: { INFO: 'info' }
}));

vi.mock('../slack-installation-store.js');
vi.mock('../slack-service.js', () => ({
  parseSlackCommandText: vi.fn()
}));

const mockOrchestrator = {
  createTask: vi.fn().mockResolvedValue({
    id: 'task-123',
    description: 'Test task',
    status: 'pending'
  }),
  getActiveTasks: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue(null),
  cancelTask: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  getStore: vi.fn().mockReturnValue({
    getDatabase: vi.fn().mockReturnValue({})
  })
};

const mockDatabase = {
  prepare: vi.fn().mockReturnValue({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
  })
};

describe('SlackAppService', () => {
  let service: SlackAppService;
  let mockLogger: any;
  let config: SlackIntegrationConfigV2;

  beforeEach(() => {
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
        scopes: ['commands', 'chat:write'],
        userScopes: []
      }
    };

    service = new SlackAppService({
      orchestrator: mockOrchestrator as any,
      config,
      getDatabase: () => mockDatabase as any,
      logger: mockLogger
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOAuthEnabled', () => {
    it('should return true when OAuth is properly configured', () => {
      expect(service.isOAuthEnabled()).toBe(true);
    });

    it('should return false when OAuth is missing clientId', () => {
      const serviceNoClientId = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: {
          ...config,
          oauth: {
            ...config.oauth!,
            clientId: undefined
          }
        },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      expect(serviceNoClientId.isOAuthEnabled()).toBe(false);
    });

    it('should return false when OAuth is missing clientSecret', () => {
      const serviceNoSecret = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: {
          ...config,
          oauth: {
            ...config.oauth!,
            clientSecret: undefined
          }
        },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      expect(serviceNoSecret.isOAuthEnabled()).toBe(false);
    });

    it('should return false when OAuth is missing signingSecret', () => {
      const serviceNoSigning = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: {
          ...config,
          oauth: {
            ...config.oauth!,
            signingSecret: undefined
          }
        },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      expect(serviceNoSigning.isOAuthEnabled()).toBe(false);
    });

    it('should return false when integration is disabled', () => {
      const serviceDisabled = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: {
          ...config,
          enabled: false
        },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      expect(serviceDisabled.isOAuthEnabled()).toBe(false);
    });
  });

  describe('isSocketModeEnabled', () => {
    it('should return true when Socket Mode is configured', () => {
      const socketConfig: SlackIntegrationConfigV2 = {
        enabled: true,
        mode: 'socket',
        appToken: 'xapp-test-token',
        botToken: 'xoxb-test-token'
      };

      const socketService = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: socketConfig,
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      expect(socketService.isSocketModeEnabled()).toBe(true);
    });

    it('should return false when mode is not socket', () => {
      expect(service.isSocketModeEnabled()).toBe(false);
    });

    it('should return false when missing appToken', () => {
      const socketConfig: SlackIntegrationConfigV2 = {
        enabled: true,
        mode: 'socket',
        botToken: 'xoxb-test-token'
        // appToken missing
      };

      const socketService = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: socketConfig,
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      expect(socketService.isSocketModeEnabled()).toBe(false);
    });
  });

  describe('start', () => {
    it('should not start when integration is disabled', async () => {
      const disabledService = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: { enabled: false },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      await disabledService.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Slack integration disabled.');
    });

    it('should warn when integration is enabled but not configured', async () => {
      const misconfiguredService = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: { enabled: true }, // No OAuth or Socket Mode config
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      await misconfiguredService.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slack integration enabled but not configured properly.'
      );
    });

    it('should start OAuth mode when properly configured', async () => {
      await service.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting Slack App with OAuth support...');
      expect(mockLogger.info).toHaveBeenCalledWith('Slack OAuth App initialized.');
    });
  });

  describe('sendToWorkspace', () => {
    it('should send message to workspace when installation exists', async () => {
      const mockInstallation = {
        teamId: 'T123',
        botToken: 'xoxb-test-token'
      };

      // Mock SlackInstallationStore
      const mockStore = {
        getByTeamId: vi.fn().mockResolvedValue(mockInstallation)
      };
      (service as any).installationStore = mockStore;

      // Mock WebClient
      const mockWebClient = {
        chat: {
          postMessage: vi.fn().mockResolvedValue({ ok: true })
        }
      };

      // Mock WebClient constructor
      const MockWebClient = vi.fn().mockImplementation(() => mockWebClient);
      vi.doMock('@slack/web-api', () => ({ WebClient: MockWebClient }));

      const message = {
        text: 'Test message',
        blocks: []
      };

      await service.sendToWorkspace('T123', '#general', message);

      expect(mockStore.getByTeamId).toHaveBeenCalledWith('T123');
    });

    it('should warn when installation not found', async () => {
      const mockStore = {
        getByTeamId: vi.fn().mockResolvedValue(null)
      };
      (service as any).installationStore = mockStore;

      const message = {
        text: 'Test message'
      };

      await service.sendToWorkspace('T123', '#general', message);

      expect(mockLogger.warn).toHaveBeenCalledWith('No installation found for team T123');
    });
  });

  describe('broadcastToAll', () => {
    it('should broadcast to all active installations', async () => {
      const mockInstallations = [
        {
          teamId: 'T123',
          botToken: 'xoxb-test-token-1',
          defaultChannelId: '#general'
        },
        {
          teamId: 'T456',
          botToken: 'xoxb-test-token-2',
          defaultChannelId: '#apex'
        }
      ];

      const mockStore = {
        getAllInstallations: vi.fn().mockResolvedValue(mockInstallations)
      };
      (service as any).installationStore = mockStore;

      // Mock the sendToWorkspace method
      service.sendToWorkspace = vi.fn().mockResolvedValue(undefined);

      const message = {
        text: 'Broadcast message'
      };

      await service.broadcastToAll(message);

      expect(service.sendToWorkspace).toHaveBeenCalledTimes(2);
      expect(service.sendToWorkspace).toHaveBeenCalledWith('T123', '#general', message);
      expect(service.sendToWorkspace).toHaveBeenCalledWith('T456', '#apex', message);
    });

    it('should use channel override when provided', async () => {
      const mockInstallations = [
        {
          teamId: 'T123',
          botToken: 'xoxb-test-token-1',
          defaultChannelId: '#general'
        }
      ];

      const mockStore = {
        getAllInstallations: vi.fn().mockResolvedValue(mockInstallations)
      };
      (service as any).installationStore = mockStore;

      service.sendToWorkspace = vi.fn().mockResolvedValue(undefined);

      const message = {
        text: 'Broadcast message'
      };

      await service.broadcastToAll(message, '#override');

      expect(service.sendToWorkspace).toHaveBeenCalledWith('T123', '#override', message);
    });
  });

  describe('getInstallations', () => {
    it('should return all installations from store', async () => {
      const mockInstallations = [
        { teamId: 'T123', teamName: 'Team 1' },
        { teamId: 'T456', teamName: 'Team 2' }
      ];

      const mockStore = {
        getAllInstallations: vi.fn().mockResolvedValue(mockInstallations)
      };
      (service as any).installationStore = mockStore;

      const result = await service.getInstallations();

      expect(result).toBe(mockInstallations);
      expect(mockStore.getAllInstallations).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should log stop message', async () => {
      await service.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Slack App stopped.');
    });
  });

  describe('getRouter', () => {
    it('should return receiver router when available', () => {
      const mockRouter = { use: vi.fn() };
      (service as any).receiver = { router: mockRouter };

      const router = service.getRouter();

      expect(router).toBe(mockRouter);
    });

    it('should return undefined when receiver not available', () => {
      (service as any).receiver = undefined;

      const router = service.getRouter();

      expect(router).toBeUndefined();
    });
  });

  describe('config resolution', () => {
    it('should resolve config from environment variables', () => {
      const env = {
        SLACK_CLIENT_ID: 'env-client-id',
        SLACK_CLIENT_SECRET: 'env-client-secret',
        SLACK_SIGNING_SECRET: 'env-signing-secret',
        SLACK_DEFAULT_CHANNEL: '#env-channel'
      };

      const serviceWithEnv = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        getDatabase: () => mockDatabase as any,
        logger: mockLogger,
        env
      });

      expect(serviceWithEnv.isOAuthEnabled()).toBe(true);
    });

    it('should prioritize provided config over environment', () => {
      const env = {
        SLACK_CLIENT_ID: 'env-client-id'
      };

      const serviceWithConfigOverride = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: false, // Override environment
          oauth: {
            clientId: 'config-client-id' // Override environment
          }
        },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger,
        env
      });

      expect(serviceWithConfigOverride.isOAuthEnabled()).toBe(false);
    });

    it('should set default scopes when none provided', () => {
      const serviceWithDefaults = new SlackAppService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          oauth: {
            clientId: 'test-id',
            clientSecret: 'test-secret',
            signingSecret: 'test-signing'
            // No scopes provided
          }
        },
        getDatabase: () => mockDatabase as any,
        logger: mockLogger
      });

      // Access the resolved config to check defaults
      const resolvedConfig = (serviceWithDefaults as any).config;
      expect(resolvedConfig.oauth.scopes).toEqual([
        'commands',
        'chat:write',
        'channels:read',
        'users:read',
        'team:read'
      ]);
      expect(resolvedConfig.oauth.userScopes).toEqual([]);
    });
  });
});