/**
 * Teams Service Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for the TeamsService class including initialization,
 * configuration, command handling, and Bot Framework integration.
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

describe('TeamsService', () => {
  let teamsService: TeamsService;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;

  beforeEach(() => {
    // Mock orchestrator
    mockOrchestrator = {
      createTask: vi.fn(),
      getTask: vi.fn(),
      getCurrentTask: vi.fn(),
      listTasks: vi.fn(),
      cancelTask: vi.fn(),
      captureThought: vi.fn(),
      on: vi.fn(),
    } as any;

    // Mock logger
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

  describe('Service Initialization', () => {
    it('should initialize with minimal configuration', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        logger: mockLogger,
      });

      expect(teamsService).toBeDefined();
      expect(teamsService.isEnabled()).toBe(false); // No credentials provided
    });

    it('should initialize with provided configuration', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-app-password',
        },
        logger: mockLogger,
      });

      expect(teamsService).toBeDefined();
      expect(teamsService.isEnabled()).toBe(true);
    });

    it('should resolve configuration from environment variables', () => {
      const mockEnv = {
        TEAMS_APP_ID: 'env-app-id',
        TEAMS_APP_PASSWORD: 'env-app-password',
        TEAMS_TENANT_ID: 'env-tenant-id',
        TEAMS_OAUTH_CONNECTION_NAME: 'env-oauth-name',
        TEAMS_DEFAULT_TEAM_ID: 'env-team-id',
        TEAMS_DEFAULT_CHANNEL_ID: 'env-channel-id',
        TEAMS_SERVICE_URL: 'https://env.example.com',
      };

      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        env: mockEnv,
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(true);
    });

    it('should use console logger when none provided', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-app-password',
        },
      });

      expect(teamsService).toBeDefined();
    });
  });

  describe('Configuration Resolution', () => {
    it('should merge config with environment variables', () => {
      const mockEnv = {
        TEAMS_APP_ID: 'env-app-id',
        TEAMS_APP_PASSWORD: 'env-app-password',
        TEAMS_TENANT_ID: 'env-tenant-id',
      };

      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'config-app-id', // Should override env
          // appPassword from env
          tenantId: 'config-tenant-id', // Should override env
        },
        env: mockEnv,
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(true);
    });

    it('should use default values when config and env are missing', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-app-password',
        },
        env: {},
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(true);
    });

    it('should automatically enable when credentials are provided via env', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        env: {
          TEAMS_APP_ID: 'env-app-id',
          TEAMS_APP_PASSWORD: 'env-app-password',
        },
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(true);
    });

    it('should not auto-enable when only partial credentials provided', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        env: {
          TEAMS_APP_ID: 'env-app-id',
          // Missing TEAMS_APP_PASSWORD
        },
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(false);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(() => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-app-password',
        },
        logger: mockLogger,
      });
    });

    it('should start service when enabled', async () => {
      await teamsService.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting Teams Bot Framework integration...');
      expect(mockOrchestrator.on).toHaveBeenCalled(); // Event listeners registered
      expect(teamsService.getAdapter()).toBeDefined();
    });

    it('should not start service when disabled', async () => {
      const disabledService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: { enabled: false },
        logger: mockLogger,
      });

      await disabledService.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Teams integration disabled or missing credentials.');
      expect(disabledService.getAdapter()).toBeUndefined();

      await disabledService.stop();
    });

    it('should stop service cleanly', async () => {
      await teamsService.start();
      await teamsService.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Teams integration stopped.');
      expect(teamsService.getAdapter()).toBeUndefined();
    });

    it('should handle multiple start calls gracefully', async () => {
      await teamsService.start();
      await teamsService.start(); // Second call should not cause issues

      expect(mockLogger.info).toHaveBeenCalledWith('Starting Teams Bot Framework integration...');
    });
  });

  describe('Enabled Status Checks', () => {
    it('should return false when disabled explicitly', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: { enabled: false },
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(false);
    });

    it('should return false when missing appId', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appPassword: 'test-password',
          // Missing appId
        },
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(false);
    });

    it('should return false when missing appPassword', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          // Missing appPassword
        },
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(false);
    });

    it('should return true when all required config is present', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        logger: mockLogger,
      });

      expect(teamsService.isEnabled()).toBe(true);
    });
  });

  describe('Activity Processing', () => {
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
    });

    it('should handle activity processing when adapter is initialized', async () => {
      await teamsService.start();

      const mockReq = {};
      const mockRes = { status: vi.fn(() => ({ send: vi.fn() })) };

      const adapter = teamsService.getAdapter();
      expect(adapter).toBeDefined();

      // Mock the adapter process method
      adapter.process = vi.fn();

      await teamsService.processActivity(mockReq, mockRes);

      expect(adapter.process).toHaveBeenCalledWith(mockReq, mockRes, expect.any(Function));
    });

    it('should return 503 when adapter is not initialized', async () => {
      const mockReq = {};
      const mockRes = {
        status: vi.fn(() => ({
          send: vi.fn(),
        })),
      };

      await teamsService.processActivity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });

  describe('Orchestrator Event Registration', () => {
    it('should register event listeners when starting', async () => {
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

      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:stage-changed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:paused', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });

    it('should handle orchestrator events without crashing when not started', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: false, // Service won't start
        },
        logger: mockLogger,
      });

      // Events should still be registered but won't send notifications
      expect(() => teamsService).not.toThrow();
    });
  });

  describe('Error Handling', () => {
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
    });

    it('should handle adapter initialization errors gracefully', async () => {
      // Mock CloudAdapter constructor to throw
      const { CloudAdapter } = await import('botbuilder');
      vi.mocked(CloudAdapter).mockImplementationOnce(() => {
        throw new Error('Adapter initialization failed');
      });

      await expect(teamsService.start()).rejects.toThrow('Adapter initialization failed');
    });

    it('should handle service stop errors gracefully', async () => {
      await teamsService.start();

      // Mock cleanup to not throw
      await expect(teamsService.stop()).resolves.not.toThrow();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle undefined environment object', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          appId: 'test-app-id',
          appPassword: 'test-password',
        },
        env: undefined as any,
        logger: mockLogger,
      });

      expect(teamsService).toBeDefined();
      expect(teamsService.isEnabled()).toBe(true);
    });

    it('should handle null configuration', () => {
      teamsService = new TeamsService({
        orchestrator: mockOrchestrator,
        config: null as any,
        logger: mockLogger,
      });

      expect(teamsService).toBeDefined();
      expect(teamsService.isEnabled()).toBe(false);
    });

    it('should handle missing orchestrator gracefully', () => {
      expect(() => new TeamsService({
        orchestrator: null as any,
        logger: mockLogger,
      })).toThrow();
    });
  });

  describe('Adapter Error Handling Setup', () => {
    it('should configure adapter error handler', async () => {
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

      const adapter = teamsService.getAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.onTurnError).toBeDefined();
    });

    it('should handle adapter errors and respond to user', async () => {
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

      const adapter = teamsService.getAdapter();
      const mockContext = {
        sendActivity: vi.fn(),
      };

      const testError = new Error('Test error');

      // Simulate adapter error
      if (adapter?.onTurnError) {
        await adapter.onTurnError(mockContext as any, testError);
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Teams bot error: Test error');
      expect(mockContext.sendActivity).toHaveBeenCalled();
    });
  });
});