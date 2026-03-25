/**
 * Discord Embed Validation and Error Handling Test Suite
 *
 * Tests for Discord embed builders, error handling scenarios,
 * edge cases, and validation of Discord message formatting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscordService } from '../services/discord-service.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock Discord.js with detailed embed and error tracking
vi.mock('discord.js', () => {
  const createMockEmbed = () => {
    const embed = {
      title: null,
      description: null,
      color: null,
      fields: [],
      footer: null,
      timestamp: null,
      setTitle: vi.fn(function(title) { this.title = title; return this; }),
      setDescription: vi.fn(function(desc) { this.description = desc; return this; }),
      setColor: vi.fn(function(color) { this.color = color; return this; }),
      addFields: vi.fn(function(...fields) {
        this.fields.push(...fields.flat());
        return this;
      }),
      setFooter: vi.fn(function(footer) { this.footer = footer; return this; }),
      setTimestamp: vi.fn(function(timestamp) { this.timestamp = timestamp; return this; }),
      toJSON: vi.fn(function() {
        return {
          title: this.title,
          description: this.description,
          color: this.color,
          fields: this.fields,
          footer: this.footer,
          timestamp: this.timestamp,
        };
      }),
    };
    return embed;
  };

  const mockChannels = {
    'working-channel': {
      id: 'working-channel',
      isTextBased: () => true,
      send: vi.fn(() => Promise.resolve({ id: 'msg-123' })),
      isThread: () => false,
    },
    'error-channel': {
      id: 'error-channel',
      isTextBased: () => true,
      send: vi.fn(() => Promise.reject(new Error('Send failed'))),
      isThread: () => false,
    },
    'rate-limited-channel': {
      id: 'rate-limited-channel',
      isTextBased: () => true,
      send: vi.fn(() => {
        const error = new Error('Rate limited') as any;
        error.code = 50013;
        error.httpStatus = 429;
        return Promise.reject(error);
      }),
      isThread: () => false,
    },
  };

  return {
    Client: vi.fn(() => ({
      once: vi.fn(),
      on: vi.fn(),
      login: vi.fn(() => Promise.resolve()),
      destroy: vi.fn(),
      user: { tag: 'TestBot#1234', id: 'bot-123' },
      channels: {
        fetch: vi.fn((channelId) => {
          if (channelId === 'network-error') {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve(mockChannels[channelId] || null);
        }),
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
    EmbedBuilder: vi.fn(() => createMockEmbed()),
    ChannelType: {
      GuildText: 0,
    },
    REST: vi.fn(() => ({
      setToken: vi.fn(function() { return this; }),
      put: vi.fn(() => Promise.resolve()),
    })),
    Routes: {
      applicationCommands: vi.fn(() => '/commands'),
    },
  };
});

describe.skip('Discord Embeds and Error Handling', () => {
  let discordService: DiscordService;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;

  beforeEach(() => {
    mockOrchestrator = {
      createTask: vi.fn(() => Promise.resolve({
        id: 'task-embed-test',
        status: 'pending',
        description: 'Test task for embeds',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      })),
      getTask: vi.fn(),
      getCurrentTask: vi.fn(),
      cancelTask: vi.fn(() => Promise.resolve(true)),
      captureThought: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(async () => {
    if (discordService) {
      await discordService.stop();
    }
  });

  describe('Embed Builder Validation', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          useEmbeds: true,
          defaultChannelId: 'working-channel',
        },
        logger: mockLogger,
      });
    });

    it('should create properly formatted task creation embed', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', {
        description: 'Test embed creation task',
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      // Get the embed from the editReply call
      const editReplyCall = mockInteraction.editReply.mock.calls[0];
      expect(editReplyCall).toBeDefined();
      expect(editReplyCall[0]).toHaveProperty('embeds');

      const embed = editReplyCall[0].embeds[0];
      expect(embed.title).toBe('✅ Task Created');
      expect(embed.color).toBe(0x00ff00); // Green
      expect(embed.fields).toContainEqual(
        expect.objectContaining({
          name: 'Task ID',
          value: 'task-embed-test',
          inline: true,
        })
      );
      expect(embed.fields).toContainEqual(
        expect.objectContaining({
          name: 'Status',
          value: 'pending',
          inline: true,
        })
      );
    });

    it('should create status embed with proper formatting', async () => {
      await discordService.start();

      const mockTask = {
        id: 'status-task-123',
        status: 'running',
        description: 'Status test task',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T01:00:00.000Z',
      };
      mockOrchestrator.getCurrentTask = vi.fn(() => Promise.resolve(mockTask));

      const mockInteraction = createMockInteraction('status');
      await (discordService as any).handleSlashCommand(mockInteraction);

      const editReplyCall = mockInteraction.editReply.mock.calls[0];
      const embed = editReplyCall[0].embeds[0];

      expect(embed.title).toBe('📊 Task Status');
      expect(embed.color).toBe(0x007fff); // Blue for running
      expect(embed.fields).toContainEqual(
        expect.objectContaining({
          name: 'Description',
          value: 'Status test task',
          inline: false,
        })
      );
    });

    it('should create error embed with proper formatting', async () => {
      await discordService.start();

      // Mock createTask to throw an error
      mockOrchestrator.createTask = vi.fn(() => Promise.reject(new Error('Database connection failed')));

      const mockInteraction = createMockInteraction('run', {
        description: 'Task that will fail',
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      // Should have sent error embed
      const replyCall = mockInteraction.reply.mock.calls[0];
      expect(replyCall[0]).toHaveProperty('embeds');
      expect(replyCall[0].ephemeral).toBe(true);

      const embed = replyCall[0].embeds[0];
      expect(embed.title).toBe('❌ Error');
      expect(embed.color).toBe(0xff0000); // Red
      expect(embed.description).toContain('Database connection failed');
    });

    it('should handle very long descriptions by truncating appropriately', async () => {
      await discordService.start();

      const longDescription = 'A'.repeat(3000); // Exceeds Discord embed description limit
      mockOrchestrator.createTask = vi.fn(() => Promise.resolve({
        id: 'long-task',
        status: 'pending',
        description: longDescription,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      }));

      const mockInteraction = createMockInteraction('run', {
        description: longDescription,
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      const editReplyCall = mockInteraction.editReply.mock.calls[0];
      const embed = editReplyCall[0].embeds[0];

      // Should have truncated the description field
      const descriptionField = embed.fields.find(f => f.name === 'Description');
      expect(descriptionField.value.length).toBeLessThanOrEqual(1024); // Discord field value limit
      if (descriptionField.value.length === 1024) {
        expect(descriptionField.value).toMatch(/\.\.\.$/); // Should end with ellipsis
      }
    });

    it('should create help embed with all commands listed', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('help');
      await (discordService as any).handleSlashCommand(mockInteraction);

      const replyCall = mockInteraction.reply.mock.calls[0];
      expect(replyCall[0].ephemeral).toBe(true);

      const embed = replyCall[0].embeds[0];
      expect(embed.title).toBe('🤖 APEX Discord Bot');
      expect(embed.color).toBe(0x5865F2); // Discord blurple
      expect(embed.description).toContain('/apex run');
      expect(embed.description).toContain('/apex think');
      expect(embed.description).toContain('/apex status');
      expect(embed.description).toContain('/apex report');
      expect(embed.description).toContain('/apex cancel');
      expect(embed.description).toContain('/apex help');
    });

    it('should handle special characters and emojis in embed content', async () => {
      await discordService.start();

      const specialDescription = 'Task with 🚀 emojis & special chars: <@123> #channel';
      mockOrchestrator.createTask = vi.fn(() => Promise.resolve({
        id: 'special-task',
        status: 'pending',
        description: specialDescription,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      }));

      const mockInteraction = createMockInteraction('run', {
        description: specialDescription,
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      const editReplyCall = mockInteraction.editReply.mock.calls[0];
      const embed = editReplyCall[0].embeds[0];

      const descriptionField = embed.fields.find(f => f.name === 'Description');
      expect(descriptionField.value).toBe(specialDescription);
    });
  });

  describe('Error Handling Scenarios', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'working-channel',
        },
        logger: mockLogger,
      });
    });

    it('should handle Discord API send failures gracefully', async () => {
      await discordService.start();

      const task = {
        id: 'error-task',
        status: 'completed',
        description: 'Task that will cause send error',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Use error channel that fails to send
      const errorService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'error-channel',
        },
        logger: mockLogger,
      });

      await errorService.start();
      await (errorService as any).notifyTaskUpdate('Task completed!', task);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending notification to error-channel')
      );

      await errorService.stop();
    });

    it('should handle rate limiting errors with appropriate logging', async () => {
      await discordService.start();

      const task = {
        id: 'rate-limited-task',
        status: 'failed',
        description: 'Task that triggers rate limit',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const rateLimitedService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'rate-limited-channel',
        },
        logger: mockLogger,
      });

      await rateLimitedService.start();
      await (rateLimitedService as any).notifyTaskUpdate('Task failed!', task);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending notification to rate-limited-channel')
      );

      await rateLimitedService.stop();
    });

    it('should handle network errors during channel fetch', async () => {
      await discordService.start();

      const task = {
        id: 'network-error-task',
        status: 'paused',
        description: 'Task with network error',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      const networkErrorService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'network-error',
        },
        logger: mockLogger,
      });

      await networkErrorService.start();
      await (networkErrorService as any).notifyTaskUpdate('Task paused!', task);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending notification to network-error')
      );

      await networkErrorService.stop();
    });

    it('should handle malformed interaction data gracefully', async () => {
      await discordService.start();

      const malformedInteraction = {
        commandName: 'apex',
        options: {
          getSubcommand: vi.fn(() => 'run'),
          getString: vi.fn(() => null), // Missing required description
        },
        channelId: 'working-channel',
        user: { id: 'user-123', username: 'testuser' },
        reply: vi.fn(() => Promise.resolve({ id: 'msg-123' })),
        editReply: vi.fn(() => Promise.resolve({ id: 'msg-123' })),
        deferReply: vi.fn(() => Promise.resolve()),
        replied: false,
        deferred: false,
        isChatInputCommand: vi.fn(() => true),
      };

      await (discordService as any).handleSlashCommand(malformedInteraction);

      expect(malformedInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '❌ Error',
            }),
          ]),
          ephemeral: true,
        })
      );
    });

    it('should handle missing orchestrator methods gracefully', async () => {
      const brokenOrchestrator = {
        // Missing createTask method
        on: vi.fn(),
      } as any;

      const brokenService = new DiscordService({
        orchestrator: brokenOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
        },
        logger: mockLogger,
      });

      await brokenService.start();

      const mockInteraction = createMockInteraction('run', {
        description: 'Test task',
      });

      await (brokenService as any).handleSlashCommand(mockInteraction);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Discord command error')
      );

      await brokenService.stop();
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty configuration gracefully', () => {
      const emptyConfigService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {} as any,
        logger: mockLogger,
      });

      expect(emptyConfigService.isEnabled()).toBe(false);
    });

    it('should handle undefined logger gracefully', () => {
      const noLoggerService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
        },
        // No logger provided - should use console
      });

      expect(noLoggerService).toBeDefined();
      expect(noLoggerService.isEnabled()).toBe(true);
    });

    it('should validate task IDs in cancel command', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
        },
        logger: mockLogger,
      });

      await discordService.start();

      const mockInteraction = createMockInteraction('cancel', {
        task_id: '   ', // Whitespace only
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '❌ Error',
            }),
          ]),
        })
      );
    });

    it('should handle extremely long task IDs', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
        },
        logger: mockLogger,
      });

      await discordService.start();

      const longTaskId = 'task-' + 'a'.repeat(1000);
      mockOrchestrator.cancelTask = vi.fn(() => Promise.resolve(false)); // Task not found

      const mockInteraction = createMockInteraction('cancel', {
        task_id: longTaskId,
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.cancelTask).toHaveBeenCalledWith(longTaskId);
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle unicode and special characters in commands', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
        },
        logger: mockLogger,
      });

      await discordService.start();

      const unicodeContent = '思考 this idea: Add 🚀 emoji support with ñañá characters';
      const mockInteraction = createMockInteraction('think', {
        content: unicodeContent,
      });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockOrchestrator.captureThought).toHaveBeenCalledWith(unicodeContent);
    });
  });

  // Helper function to create mock interactions
  function createMockInteraction(subcommand: string, options: Record<string, string> = {}) {
    return {
      commandName: 'apex',
      options: {
        getSubcommand: vi.fn(() => subcommand),
        getString: vi.fn((name: string) => options[name] || null),
      },
      channelId: 'working-channel',
      guildId: 'guild-123',
      user: {
        id: 'user-123',
        username: 'testuser',
      },
      channel: {
        id: 'working-channel',
        type: 0, // GuildText
        isTextBased: () => true,
      },
      reply: vi.fn(() => Promise.resolve({ id: 'message-123' })),
      editReply: vi.fn(() => Promise.resolve({ id: 'message-123' })),
      followUp: vi.fn(() => Promise.resolve({ id: 'message-123' })),
      deferReply: vi.fn(() => Promise.resolve()),
      replied: false,
      deferred: false,
      isChatInputCommand: vi.fn(() => true),
    };
  }
});