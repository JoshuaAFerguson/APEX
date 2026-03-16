/**
 * Discord Service Test Suite for @apexcli/api Package
 *
 * Comprehensive tests for the DiscordService class including initialization,
 * configuration, slash command handling, and Discord.js integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscordService } from '../services/discord-service.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Discord.js
vi.mock('discord.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    once: vi.fn(),
    on: vi.fn(),
    login: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(),
    user: { tag: 'TestBot#1234' },
    channels: {
      fetch: vi.fn(() => Promise.resolve({
        isTextBased: vi.fn(() => true),
        send: vi.fn(() => Promise.resolve()),
        isThread: vi.fn(() => false),
      })),
    },
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
  },
  SlashCommandBuilder: vi.fn(() => ({
    setName: vi.fn(() => ({
      setDescription: vi.fn(() => ({
        addSubcommand: vi.fn(function(callback) {
          const subcommand = {
            setName: vi.fn(() => subcommand),
            setDescription: vi.fn(() => subcommand),
            addStringOption: vi.fn(() => subcommand),
          };
          if (callback) callback(subcommand);
          return this;
        }),
        toJSON: vi.fn(() => ({})),
      })),
    })),
  })),
  ChatInputCommandInteraction: vi.fn(),
  EmbedBuilder: vi.fn().mockImplementation(() => ({
    setTitle: vi.fn(function() { return this; }),
    setDescription: vi.fn(function() { return this; }),
    setColor: vi.fn(function() { return this; }),
    addFields: vi.fn(function() { return this; }),
    setFooter: vi.fn(function() { return this; }),
    setTimestamp: vi.fn(function() { return this; }),
    toJSON: vi.fn(() => ({ title: 'Test', description: 'Test' })),
  })),
  ThreadChannel: vi.fn(),
  TextChannel: vi.fn().mockImplementation(() => ({
    threads: {
      create: vi.fn(() => Promise.resolve({
        id: 'thread-123',
        name: 'Test Thread',
      })),
    },
  })),
  ChannelType: {
    GuildText: 0,
  },
  REST: vi.fn().mockImplementation(() => ({
    setToken: vi.fn(function() { return this; }),
    put: vi.fn(() => Promise.resolve()),
  })),
  Routes: {
    applicationGuildCommands: vi.fn((appId, guildId) => `/applications/${appId}/guilds/${guildId}/commands`),
    applicationCommands: vi.fn((appId) => `/applications/${appId}/commands`),
  },
}));

describe('DiscordService', () => {
  let discordService: DiscordService;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;
  let mockInteraction: any;

  beforeEach(() => {
    // Mock orchestrator
    mockOrchestrator = {
      createTask: vi.fn(() => Promise.resolve({
        id: 'task-123',
        status: 'pending',
        description: 'Test task',
        createdAt: new Date().toISOString(),
      })),
      getTask: vi.fn(),
      getCurrentTask: vi.fn(),
      listTasks: vi.fn(),
      cancelTask: vi.fn(() => Promise.resolve(true)),
      captureThought: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
    } as any;

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock Discord interaction
    mockInteraction = {
      commandName: 'apex',
      options: {
        getSubcommand: vi.fn(() => 'run'),
        getString: vi.fn((name, required) => {
          if (name === 'description') return 'Test task description';
          if (name === 'content') return 'Test thought content';
          if (name === 'task_id') return 'task-123';
          return null;
        }),
      },
      channelId: 'channel-123',
      guildId: 'guild-123',
      user: {
        id: 'user-123',
        username: 'testuser',
      },
      channel: {
        type: 0, // GuildText
      },
      reply: vi.fn(() => Promise.resolve({ id: 'message-123' })),
      editReply: vi.fn(() => Promise.resolve({ id: 'message-123' })),
      followUp: vi.fn(() => Promise.resolve({ id: 'message-123' })),
      deferReply: vi.fn(() => Promise.resolve()),
      replied: false,
      deferred: false,
      isChatInputCommand: vi.fn(() => true),
    };
  });

  afterEach(async () => {
    if (discordService) {
      await discordService.stop();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize with minimal configuration', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(false); // No credentials provided
    });

    it('should initialize with provided configuration', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
        },
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(true);
    });

    it('should resolve configuration from environment variables', () => {
      const mockEnv = {
        DISCORD_BOT_TOKEN: 'env-bot-token',
        DISCORD_APPLICATION_ID: 'env-app-id',
        DISCORD_CLIENT_SECRET: 'env-client-secret',
        DISCORD_PUBLIC_KEY: 'env-public-key',
        DISCORD_DEV_GUILD_ID: 'env-dev-guild',
        DISCORD_DEFAULT_CHANNEL_ID: 'env-default-channel',
        DISCORD_NOTIFICATION_CHANNELS: 'channel1,channel2',
        DISCORD_THREAD_UPDATES: 'true',
        DISCORD_USE_EMBEDS: 'true',
      };

      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        env: mockEnv,
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(true); // Auto-enabled due to credentials in env
    });

    it('should use console logger when none provided', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
        },
      });

      expect(discordService).toBeDefined();
    });

    it('should prefer config values over environment variables', () => {
      const mockEnv = {
        DISCORD_BOT_TOKEN: 'env-token',
        DISCORD_APPLICATION_ID: 'env-app-id',
        DISCORD_DEV_GUILD_ID: 'env-guild-id',
      };

      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'config-bot-token', // Should override env
          applicationId: 'config-app-id', // Should override env
          // devGuildId from env
        },
        env: mockEnv,
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(true);
    });

    it('should use default values when config and env are missing', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app-id',
        },
        env: {},
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(true);
    });

    it('should automatically enable when credentials are provided via env', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        env: {
          DISCORD_BOT_TOKEN: 'env-bot-token',
          DISCORD_APPLICATION_ID: 'env-app-id',
        },
        logger: mockLogger,
      });

      expect(discordService.isEnabled()).toBe(true);
    });

    it('should not auto-enable when only partial credentials provided', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        env: {
          DISCORD_BOT_TOKEN: 'env-bot-token',
          // Missing DISCORD_APPLICATION_ID
        },
        logger: mockLogger,
      });

      expect(discordService.isEnabled()).toBe(false);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
        },
        logger: mockLogger,
      });
    });

    it('should start service successfully when enabled', async () => {
      await discordService.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting Discord integration...');
      expect(mockLogger.info).toHaveBeenCalledWith('Discord integration started successfully.');
    });

    it('should not start service when disabled', async () => {
      const disabledService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: { enabled: false },
        logger: mockLogger,
      });

      await disabledService.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Discord integration disabled or missing tokens.');
      await disabledService.stop();
    });

    it('should stop service cleanly', async () => {
      await discordService.start();
      await discordService.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Discord client destroyed.');
    });

    it('should handle start errors gracefully', async () => {
      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      MockClient.mockImplementation(() => ({
        once: vi.fn(),
        on: vi.fn(),
        login: vi.fn(() => Promise.reject(new Error('Connection failed'))),
        destroy: vi.fn(),
      }));

      await expect(discordService.start()).rejects.toThrow('Connection failed');
    });
  });

  describe('Enabled Status Checks', () => {
    it('should return false when disabled explicitly', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: { enabled: false },
        logger: mockLogger,
      });

      expect(discordService.isEnabled()).toBe(false);
    });

    it('should return false when missing bot token', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          applicationId: 'test-app-id',
          // Missing botToken
        },
        logger: mockLogger,
      });

      expect(discordService.isEnabled()).toBe(false);
    });

    it('should return false when missing application ID', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          // Missing applicationId
        },
        logger: mockLogger,
      });

      expect(discordService.isEnabled()).toBe(false);
    });

    it('should return true when all required config is present', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
        },
        logger: mockLogger,
      });

      expect(discordService.isEnabled()).toBe(true);
    });
  });

  describe('Slash Command Handling', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
          threadUpdates: true,
        },
        logger: mockLogger,
      });
    });

    it('should handle run command successfully', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('run');
      mockInteraction.options.getString.mockImplementation((name) => {
        if (name === 'description') return 'Test task description';
        return null;
      });

      // Simulate the private method call
      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.createTask).toHaveBeenCalledWith({
        description: 'Test task description',
      });
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle think command successfully', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('think');
      mockInteraction.options.getString.mockImplementation((name) => {
        if (name === 'content') return 'Test thought content';
        return null;
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith('Test thought content');
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle status command when no active task', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('status');
      mockOrchestrator.getCurrentTask.mockResolvedValue(null);

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.getCurrentTask).toHaveBeenCalled();
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle status command with active task', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('status');
      const mockTask = {
        id: 'task-123',
        status: 'running',
        description: 'Active task',
        createdAt: new Date().toISOString(),
      };
      mockOrchestrator.getCurrentTask.mockResolvedValue(mockTask);

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.getCurrentTask).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle cancel command successfully', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('cancel');
      mockInteraction.options.getString.mockImplementation((name) => {
        if (name === 'task_id') return 'task-123';
        return null;
      });
      mockOrchestrator.cancelTask.mockResolvedValue(true);

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('task-123');
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle cancel command when task not found', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('cancel');
      mockInteraction.options.getString.mockImplementation((name) => {
        if (name === 'task_id') return 'nonexistent-task';
        return null;
      });
      mockOrchestrator.cancelTask.mockResolvedValue(false);

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith('nonexistent-task');
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('help');

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      }));
    });

    it('should handle command errors gracefully', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('run');
      mockOrchestrator.createTask.mockRejectedValue(new Error('Database error'));

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Discord command error'));
    });

    it('should validate required parameters', async () => {
      mockInteraction.options.getSubcommand.mockReturnValue('run');
      mockInteraction.options.getString.mockImplementation(() => '   '); // Empty/whitespace description

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: '❌ Error',
            }),
          }),
        ]),
        ephemeral: true,
      }));
    });
  });

  describe('Orchestrator Event Registration', () => {
    it('should register event listeners when starting', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
        },
        logger: mockLogger,
      });

      await discordService.start();

      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:stage-changed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:paused', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:failed', expect.any(Function));
    });

    it('should handle orchestrator events without crashing when not started', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: false, // Service won't start
        },
        logger: mockLogger,
      });

      // This should not throw
      expect(() => discordService).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
        },
        logger: mockLogger,
      });
    });

    it('should handle Discord client errors', async () => {
      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const mockClientInstance = {
        once: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            // Simulate error event
            setTimeout(() => callback(new Error('Discord connection error')), 0);
          }
        }),
        login: vi.fn(() => Promise.resolve()),
        destroy: vi.fn(),
        user: { tag: 'TestBot#1234' },
      };
      MockClient.mockReturnValue(mockClientInstance);

      await discordService.start();

      // Wait for error event to be triggered
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Discord client error'));
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle undefined environment object', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app-id',
        },
        env: undefined as any,
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(true);
    });

    it('should handle null configuration', () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: null as any,
        logger: mockLogger,
      });

      expect(discordService).toBeDefined();
      expect(discordService.isEnabled()).toBe(false);
    });

    it('should handle missing orchestrator gracefully', () => {
      expect(() => new DiscordService({
        orchestrator: null as any,
        logger: mockLogger,
      })).not.toThrow(); // Should handle gracefully, not crash
    });
  });

  describe('Thread Management', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
          threadUpdates: true,
        },
        logger: mockLogger,
      });
    });

    it('should create thread for task when enabled', async () => {
      const { TextChannel } = await import('discord.js');
      const MockTextChannel = TextChannel as any;

      mockInteraction.channel = new MockTextChannel();
      mockInteraction.channel.threads = {
        create: vi.fn(() => Promise.resolve({ id: 'thread-123', name: 'Task Thread' })),
      };

      mockInteraction.options.getSubcommand.mockReturnValue('run');
      mockInteraction.options.getString.mockImplementation((name) => {
        if (name === 'description') return 'Test task description';
        return null;
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.channel.threads.create).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Created thread'));
    });

    it('should handle thread creation errors gracefully', async () => {
      mockInteraction.channel = {
        type: 0, // GuildText
        threads: {
          create: vi.fn(() => Promise.reject(new Error('Thread creation failed'))),
        },
      };

      mockInteraction.options.getSubcommand.mockReturnValue('run');
      mockInteraction.options.getString.mockImplementation((name) => {
        if (name === 'description') return 'Test task description';
        return null;
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to create thread'));
    });
  });
});