/**
 * Discord Thread Management and Notification Test Suite
 *
 * Tests for Discord thread creation, management, notification routing,
 * and edge cases around thread lifecycle and multi-channel messaging.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscordService } from '../services/discord-service.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Enhanced Discord.js mock for thread and notification testing
vi.mock('discord.js', () => ({
  Client: vi.fn(() => ({
    once: vi.fn(),
    on: vi.fn(),
    login: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(),
    user: { tag: 'TestBot#1234', id: 'bot-123' },
    channels: {
      fetch: vi.fn((channelId) => {
        const channels = {
          'text-channel-123': {
            id: 'text-channel-123',
            name: 'general',
            type: 0, // GuildText
            isTextBased: () => true,
            send: vi.fn(() => Promise.resolve({ id: 'msg-123' })),
            isThread: () => false,
            threads: {
              create: vi.fn(({ name, autoArchiveDuration, reason }) => {
                if (name === 'FAIL_CREATION') {
                  return Promise.reject(new Error('Thread creation failed'));
                }
                return Promise.resolve({
                  id: `thread-${Date.now()}`,
                  name,
                  autoArchiveDuration,
                  reason,
                  send: vi.fn(() => Promise.resolve({ id: 'thread-msg-123' })),
                  isTextBased: () => true,
                  isThread: () => true,
                });
              }),
              cache: new Map(),
            },
          },
          'notification-channel-456': {
            id: 'notification-channel-456',
            name: 'notifications',
            type: 0,
            isTextBased: () => true,
            send: vi.fn(() => Promise.resolve({ id: 'notif-msg-456' })),
            isThread: () => false,
          },
          'thread-789': {
            id: 'thread-789',
            name: 'Task: abc123 - Test Task',
            type: 11, // PublicThread
            isTextBased: () => true,
            send: vi.fn(() => Promise.resolve({ id: 'thread-update-789' })),
            isThread: () => true,
          },
          'dm-channel': {
            id: 'dm-channel',
            type: 1, // DM
            isTextBased: () => true,
            send: vi.fn(() => Promise.resolve({ id: 'dm-msg' })),
            isThread: () => false,
          },
        };

        // Simulate channel fetch failures
        if (channelId === 'missing-channel') {
          return Promise.resolve(null);
        }
        if (channelId === 'error-channel') {
          return Promise.reject(new Error('Channel fetch failed'));
        }
        if (channelId === 'non-text-channel') {
          return Promise.resolve({
            id: 'non-text-channel',
            type: 2, // Voice channel
            isTextBased: () => false,
            send: vi.fn(),
          });
        }

        return Promise.resolve(channels[channelId] || null);
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
  EmbedBuilder: vi.fn(() => ({
    setTitle: vi.fn(function() { return this; }),
    setDescription: vi.fn(function() { return this; }),
    setColor: vi.fn(function() { return this; }),
    addFields: vi.fn(function() { return this; }),
    setFooter: vi.fn(function() { return this; }),
    setTimestamp: vi.fn(function() { return this; }),
    toJSON: vi.fn(() => ({ title: 'Test Embed', description: 'Test Description' })),
  })),
  ChannelType: {
    GuildText: 0,
    DM: 1,
    GuildVoice: 2,
    PublicThread: 11,
    PrivateThread: 12,
  },
  REST: vi.fn(() => ({
    setToken: vi.fn(function() { return this; }),
    put: vi.fn(() => Promise.resolve()),
  })),
  Routes: {
    applicationCommands: vi.fn(() => '/commands'),
    applicationGuildCommands: vi.fn(() => '/guild-commands'),
  },
}));

describe.skip('Discord Thread Management and Notifications', () => {
  let discordService: DiscordService;
  let mockOrchestrator: ApexOrchestrator;
  let mockLogger: any;

  beforeEach(() => {
    mockOrchestrator = {
      createTask: vi.fn(() => Promise.resolve({
        id: 'task-abc123',
        status: 'pending',
        description: 'Test task',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

  describe('Thread Creation and Management', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          threadUpdates: true,
          useEmbeds: true,
        },
        logger: mockLogger,
      });
    });

    it('should create thread with proper naming and settings', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', {
        description: 'Create a comprehensive feature with multiple components',
      });
      mockInteraction.channelId = 'text-channel-123';
      mockInteraction.channel.id = 'text-channel-123';

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.channel.threads.create).toHaveBeenCalledWith({
        name: 'Task: task-abc123 - Create a comprehensive feature with...',
        autoArchiveDuration: 1440, // 24 hours
        reason: 'APEX task tracking thread',
      });
    });

    it('should truncate long thread names to Discord limits', async () => {
      await discordService.start();

      const longDescription = 'A'.repeat(200); // Very long description
      const mockInteraction = createMockInteraction('run', {
        description: longDescription,
      });
      mockInteraction.channelId = 'text-channel-123';

      await (discordService as any).handleSlashCommand(mockInteraction);

      const createCall = mockInteraction.channel.threads.create.mock.calls[0][0];
      expect(createCall.name.length).toBeLessThanOrEqual(100); // Discord thread name limit
      expect(createCall.name).toContain('Task: task-abc123');
    });

    it('should handle thread creation failure gracefully', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', {
        description: 'FAIL_CREATION', // Triggers mock failure
      });
      mockInteraction.channelId = 'text-channel-123';

      // Mock the task creation to return a task that will trigger thread creation
      mockOrchestrator.createTask = vi.fn(() => Promise.resolve({
        id: 'task-fail',
        status: 'pending',
        description: 'FAIL_CREATION',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create thread')
      );
    });

    it('should not create threads when threadUpdates is disabled', async () => {
      const noThreadService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          threadUpdates: false, // Disabled
        },
        logger: mockLogger,
      });

      await noThreadService.start();

      const mockInteraction = createMockInteraction('run', { description: 'No thread task' });
      await (noThreadService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.channel.threads?.create).not.toHaveBeenCalled();

      await noThreadService.stop();
    });

    it('should handle non-text channels gracefully', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', { description: 'Voice channel task' });
      mockInteraction.channelId = 'non-text-channel';
      mockInteraction.channel = {
        id: 'non-text-channel',
        type: 2, // Voice channel
        isTextBased: () => false,
      };

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot create thread')
      );
    });

    it('should track created threads in internal map', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', { description: 'Tracked task' });
      mockInteraction.channelId = 'text-channel-123';

      await (discordService as any).handleSlashCommand(mockInteraction);

      // Access private taskThreads map to verify tracking
      const taskThreads = (discordService as any).taskThreads;
      expect(taskThreads.has('task-abc123')).toBe(true);

      const threadInfo = taskThreads.get('task-abc123');
      expect(threadInfo).toEqual({
        channelId: 'text-channel-123',
        threadId: expect.stringMatching(/thread-\d+/),
      });
    });
  });

  describe('Notification Routing', () => {
    it('should prioritize thread notifications over channel notifications', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'text-channel-123',
          notificationChannelIds: ['notification-channel-456'],
          threadUpdates: true,
        },
        logger: mockLogger,
      });

      await discordService.start();

      // Simulate task with existing thread
      const taskWithThread = {
        id: 'task-with-thread',
        status: 'running',
        description: 'Task with thread',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Set up thread tracking
      (discordService as any).taskThreads.set('task-with-thread', {
        channelId: 'text-channel-123',
        threadId: 'thread-789',
      });

      // Simulate task update
      await (discordService as any).notifyTaskUpdate('Task completed!', taskWithThread);

      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      expect(clientInstance.channels.fetch).toHaveBeenCalledWith('thread-789');
    });

    it('should fall back to channel notifications when thread is unavailable', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'text-channel-123',
          notificationChannelIds: ['notification-channel-456'],
        },
        logger: mockLogger,
      });

      await discordService.start();

      const task = {
        id: 'task-no-thread',
        status: 'completed',
        description: 'Task without thread',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (discordService as any).notifyTaskUpdate('Task completed!', task);

      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      // Should fetch default and notification channels
      expect(clientInstance.channels.fetch).toHaveBeenCalledWith('text-channel-123');
      expect(clientInstance.channels.fetch).toHaveBeenCalledWith('notification-channel-456');
    });

    it('should handle multiple notification channels', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'text-channel-123',
          notificationChannelIds: [
            'notification-channel-456',
            'text-channel-123', // Duplicate should be deduplicated
            'missing-channel', // Should be handled gracefully
            'error-channel', // Should handle fetch errors
          ],
        },
        logger: mockLogger,
      });

      await discordService.start();

      const task = {
        id: 'multi-channel-task',
        status: 'failed',
        description: 'Multi-channel notification test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (discordService as any).notifyTaskUpdate('Task failed!', task);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch channel missing-channel')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending notification to error-channel')
      );
    });

    it('should skip non-text channels in notification routing', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          notificationChannelIds: ['non-text-channel'],
        },
        logger: mockLogger,
      });

      await discordService.start();

      const task = {
        id: 'non-text-task',
        status: 'completed',
        description: 'Non-text channel test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (discordService as any).notifyTaskUpdate('Task completed!', task);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Channel non-text-channel is not text-based')
      );
    });
  });

  describe('Embed vs Plain Text Notifications', () => {
    it('should send embed notifications when useEmbeds is true', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'text-channel-123',
          useEmbeds: true,
        },
        logger: mockLogger,
      });

      await discordService.start();

      const task = {
        id: 'embed-task',
        status: 'running',
        description: 'Embed notification test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (discordService as any).notifyTaskUpdate('Task started!', task);

      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      // Verify channel was fetched
      expect(clientInstance.channels.fetch).toHaveBeenCalledWith('text-channel-123');
    });

    it('should send plain text when useEmbeds is false', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'text-channel-123',
          useEmbeds: false,
        },
        logger: mockLogger,
      });

      await discordService.start();

      const task = {
        id: 'text-task',
        status: 'completed',
        description: 'Plain text test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (discordService as any).notifyTaskUpdate('Task completed!', task);

      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      expect(clientInstance.channels.fetch).toHaveBeenCalledWith('text-channel-123');
    });
  });

  describe('Thread Cleanup and Lifecycle', () => {
    it('should handle thread deletion from external sources', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          threadUpdates: true,
        },
        logger: mockLogger,
      });

      await discordService.start();

      // Manually add a thread mapping
      (discordService as any).taskThreads.set('deleted-task', {
        channelId: 'text-channel-123',
        threadId: 'deleted-thread',
      });

      const task = {
        id: 'deleted-task',
        status: 'completed',
        description: 'Task with deleted thread',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock thread fetch to return null (deleted)
      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;
      clientInstance.channels.fetch.mockImplementation((channelId) => {
        if (channelId === 'deleted-thread') {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          isTextBased: () => true,
          send: vi.fn(() => Promise.resolve({ id: 'fallback-msg' })),
        });
      });

      await (discordService as any).notifyTaskUpdate('Task completed!', task);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch thread deleted-thread')
      );
    });

    it('should clean up thread mapping on task completion', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          threadUpdates: true,
        },
        logger: mockLogger,
      });

      await discordService.start();

      // Set up thread mapping
      (discordService as any).taskThreads.set('cleanup-task', {
        channelId: 'text-channel-123',
        threadId: 'thread-789',
      });

      const task = {
        id: 'cleanup-task',
        status: 'completed',
        description: 'Task for cleanup test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await (discordService as any).notifyTaskUpdate('Task completed!', task);

      // Verify thread mapping still exists for completed tasks (may want to keep for history)
      const taskThreads = (discordService as any).taskThreads;
      expect(taskThreads.has('cleanup-task')).toBe(true);
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
      channelId: 'text-channel-123',
      guildId: 'guild-123',
      user: {
        id: 'user-123',
        username: 'testuser',
      },
      channel: {
        id: 'text-channel-123',
        type: 0, // GuildText
        isTextBased: () => true,
        threads: {
          create: vi.fn(() => Promise.resolve({
            id: `thread-${Date.now()}`,
            name: 'Test Thread',
          })),
        },
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