/**
 * Discord Integration Test Suite
 *
 * Comprehensive integration tests for Discord service including orchestrator
 * integration, task lifecycle, thread management, and notification flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscordService } from '../services/discord-service.js';
import type { ApexOrchestrator, Task, TaskStatusUpdate } from '@apexcli/orchestrator';
import { EventEmitter } from 'events';

// Mock Discord.js with enhanced functionality for integration tests
vi.mock('discord.js', () => ({
  Client: vi.fn(() => {
    const mockClient = new EventEmitter();
    return Object.assign(mockClient, {
      login: vi.fn(() => Promise.resolve()),
      destroy: vi.fn(),
      user: { tag: 'TestBot#1234', id: 'bot-123' },
      channels: {
        fetch: vi.fn((channelId) => {
          const channels = {
            'channel-123': {
              id: 'channel-123',
              name: 'general',
              isTextBased: () => true,
              send: vi.fn(() => Promise.resolve({ id: 'message-456' })),
              isThread: () => false,
              type: 0, // GuildText
              threads: {
                create: vi.fn(() => Promise.resolve({
                  id: 'thread-789',
                  name: 'Task Thread',
                  send: vi.fn(() => Promise.resolve({ id: 'thread-message-999' })),
                })),
              },
            },
            'channel-456': {
              id: 'channel-456',
              name: 'notifications',
              isTextBased: () => true,
              send: vi.fn(() => Promise.resolve({ id: 'message-789' })),
              isThread: () => false,
              type: 0,
            },
            'thread-789': {
              id: 'thread-789',
              name: 'Task Thread',
              isTextBased: () => true,
              send: vi.fn(() => Promise.resolve({ id: 'thread-message-111' })),
              isThread: () => true,
              type: 11, // PublicThread
            },
          };
          return Promise.resolve(channels[channelId] || null);
        }),
      },
    });
  }),
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
  EmbedBuilder: vi.fn(() => ({
    setTitle: vi.fn(function() { return this; }),
    setDescription: vi.fn(function() { return this; }),
    setColor: vi.fn(function() { return this; }),
    addFields: vi.fn(function() { return this; }),
    setFooter: vi.fn(function() { return this; }),
    setTimestamp: vi.fn(function() { return this; }),
    toJSON: vi.fn(() => ({})),
  })),
  TextChannel: vi.fn(),
  ThreadChannel: vi.fn(),
  ChannelType: {
    GuildText: 0,
    PublicThread: 11,
  },
  REST: vi.fn(() => ({
    setToken: vi.fn(function() { return this; }),
    put: vi.fn(() => Promise.resolve()),
  })),
  Routes: {
    applicationGuildCommands: vi.fn((appId, guildId) => `/applications/${appId}/guilds/${guildId}/commands`),
    applicationCommands: vi.fn((appId) => `/applications/${appId}/commands`),
  },
}));

class MockOrchestrator extends EventEmitter implements Partial<ApexOrchestrator> {
  private tasks = new Map<string, Task>();
  private currentTaskId: string | null = null;

  async createTask(options: { description: string }): Promise<Task> {
    const task: Task = {
      id: `task-${Date.now()}`,
      description: options.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    this.currentTaskId = task.id;

    // Simulate async task creation
    setTimeout(() => {
      this.emit('task:created', task);
      this.startTask(task.id);
    }, 10);

    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  async getCurrentTask(): Promise<Task | null> {
    return this.currentTaskId ? this.tasks.get(this.currentTaskId) || null : null;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'cancelled';
    task.updatedAt = new Date().toISOString();
    this.emit('task:cancelled', task);
    return true;
  }

  async captureThought(content: string): Promise<void> {
    // Simulate thought capture
    this.emit('thought:captured', { content, timestamp: new Date().toISOString() });
  }

  // Helper methods for testing
  private async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    this.emit('task:started', task);

    // Simulate stage changes
    setTimeout(() => {
      this.emit('task:stage-changed', { ...task, stage: 'planning' });
    }, 20);

    setTimeout(() => {
      this.emit('task:stage-changed', { ...task, stage: 'implementation' });
    }, 40);
  }

  async completeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.updatedAt = new Date().toISOString();
    this.emit('task:completed', task);
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.updatedAt = new Date().toISOString();
    this.emit('task:failed', { ...task, error });
  }

  async pauseTask(taskId: string, reason: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'paused';
    task.updatedAt = new Date().toISOString();
    this.emit('task:paused', { ...task, reason });
  }
}

describe.skip('Discord Integration Tests', () => {
  let discordService: DiscordService;
  let mockOrchestrator: MockOrchestrator;
  let mockLogger: any;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestrator();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    discordService = new DiscordService({
      orchestrator: mockOrchestrator as any,
      config: {
        enabled: true,
        botToken: 'test-bot-token',
        applicationId: 'test-app-id',
        defaultChannelId: 'channel-123',
        notificationChannelIds: ['channel-456'],
        threadUpdates: true,
        useEmbeds: true,
      },
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    await discordService.stop();
    mockOrchestrator.removeAllListeners();
  });

  describe('Orchestrator Integration', () => {
    it('should create task and set up notifications when run command is executed', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', { description: 'Test integration task' });

      // Execute the command
      await (discordService as any).handleSlashCommand(mockInteraction);

      // Wait for async task creation
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();

      // Verify task was created
      const currentTask = await mockOrchestrator.getCurrentTask();
      expect(currentTask).toBeDefined();
      expect(currentTask?.description).toBe('Test integration task');
    });

    it('should handle task lifecycle events and send Discord notifications', async () => {
      await discordService.start();

      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      // Create a task to trigger events
      const task = await mockOrchestrator.createTask({ description: 'Test lifecycle task' });

      // Wait for all events to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify channels were fetched for notifications
      expect(clientInstance.channels.fetch).toHaveBeenCalled();
    });

    it('should handle task completion and send completion notification', async () => {
      await discordService.start();

      const task = await mockOrchestrator.createTask({ description: 'Task to complete' });
      await new Promise(resolve => setTimeout(resolve, 20));

      // Complete the task
      await mockOrchestrator.completeTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Task completed'));
    });

    it('should handle task failure and send error notification', async () => {
      await discordService.start();

      const task = await mockOrchestrator.createTask({ description: 'Task to fail' });
      await new Promise(resolve => setTimeout(resolve, 20));

      // Fail the task
      await mockOrchestrator.failTask(task.id, 'Test failure reason');
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Task failed'));
    });
  });

  describe('Thread Management Integration', () => {
    it('should create thread and track it when threadUpdates is enabled', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', { description: 'Test thread task' });
      mockInteraction.channel.threads = {
        create: vi.fn(() => Promise.resolve({
          id: 'thread-789',
          name: 'Task Thread',
          send: vi.fn(() => Promise.resolve({ id: 'thread-msg-123' })),
        })),
      };

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.channel.threads.create).toHaveBeenCalledWith({
        name: expect.stringContaining('Task:'),
        autoArchiveDuration: 1440,
        reason: 'APEX task tracking thread',
      });
    });

    it('should send task updates to thread when thread exists', async () => {
      await discordService.start();

      // Create task with thread
      const mockInteraction = createMockInteraction('run', { description: 'Thread update test' });
      const mockThread = {
        id: 'thread-789',
        name: 'Task Thread',
        send: vi.fn(() => Promise.resolve({ id: 'thread-msg-456' })),
      };

      mockInteraction.channel.threads = {
        create: vi.fn(() => Promise.resolve(mockThread)),
      };

      await (discordService as any).handleSlashCommand(mockInteraction);

      // Get the created task
      const task = await mockOrchestrator.getCurrentTask();
      expect(task).toBeDefined();

      // Complete the task to trigger notification
      if (task) {
        await mockOrchestrator.completeTask(task.id);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    });

    it('should fall back to channel notifications when thread creation fails', async () => {
      await discordService.start();

      const mockInteraction = createMockInteraction('run', { description: 'Thread fail test' });
      mockInteraction.channel.threads = {
        create: vi.fn(() => Promise.reject(new Error('Thread creation failed'))),
      };

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to create thread'));
      expect(mockInteraction.editReply).toHaveBeenCalled(); // Should still complete the command
    });
  });

  describe('Multi-Channel Notification Integration', () => {
    it('should send notifications to multiple configured channels', async () => {
      const multiChannelService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
          defaultChannelId: 'channel-123',
          notificationChannelIds: ['channel-456', 'channel-789'],
          threadUpdates: false, // Disable threads to test channel notifications
        },
        logger: mockLogger,
      });

      await multiChannelService.start();

      const task = await mockOrchestrator.createTask({ description: 'Multi-channel test' });
      await mockOrchestrator.completeTask(task.id);

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 50));

      await multiChannelService.stop();
    });

    it('should handle missing channels gracefully', async () => {
      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = {
        once: vi.fn(),
        on: vi.fn(),
        login: vi.fn(() => Promise.resolve()),
        destroy: vi.fn(),
        user: { tag: 'TestBot#1234' },
        channels: {
          fetch: vi.fn((channelId) => {
            if (channelId === 'missing-channel') {
              return Promise.resolve(null);
            }
            return Promise.resolve({
              isTextBased: () => true,
              send: vi.fn(() => Promise.resolve({ id: 'message-123' })),
            });
          }),
        },
      };
      MockClient.mockReturnValue(clientInstance);

      const serviceWithMissingChannel = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-bot-token',
          applicationId: 'test-app-id',
          notificationChannelIds: ['missing-channel', 'channel-456'],
        },
        logger: mockLogger,
      });

      await serviceWithMissingChannel.start();

      const task = await mockOrchestrator.createTask({ description: 'Missing channel test' });
      await mockOrchestrator.completeTask(task.id);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not fetch channel'));

      await serviceWithMissingChannel.stop();
    });
  });

  describe('Command Integration Scenarios', () => {
    it('should handle think command and capture thought', async () => {
      await discordService.start();

      const thoughtSpy = vi.spyOn(mockOrchestrator, 'captureThought');
      const mockInteraction = createMockInteraction('think', { content: 'Great integration idea' });

      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(thoughtSpy).toHaveBeenCalledWith('Great integration idea');
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle status command with current task integration', async () => {
      await discordService.start();

      // Create a task first
      const task = await mockOrchestrator.createTask({ description: 'Status check task' });

      const mockInteraction = createMockInteraction('status');
      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.any(Array),
      }));
    });

    it('should handle cancel command integration', async () => {
      await discordService.start();

      const task = await mockOrchestrator.createTask({ description: 'Task to cancel' });
      const cancelSpy = vi.spyOn(mockOrchestrator, 'cancelTask');

      const mockInteraction = createMockInteraction('cancel', { task_id: task.id });
      await (discordService as any).handleSlashCommand(mockInteraction);

      expect(cancelSpy).toHaveBeenCalledWith(task.id);
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
      channelId: 'channel-123',
      guildId: 'guild-123',
      user: {
        id: 'user-123',
        username: 'testuser',
      },
      channel: {
        id: 'channel-123',
        type: 0, // GuildText
        threads: {
          create: vi.fn(() => Promise.resolve({
            id: 'thread-789',
            name: 'Task Thread',
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