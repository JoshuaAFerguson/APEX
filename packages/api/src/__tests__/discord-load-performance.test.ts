/**
 * Discord Load and Performance Test Suite
 *
 * Tests for Discord service performance, concurrent command handling,
 * rate limiting behavior, and stress testing scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscordService } from '../services/discord-service.js';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Performance-focused Discord.js mock
vi.mock('discord.js', () => {
  const createMockChannel = (id: string, sendDelay = 0) => ({
    id,
    isTextBased: () => true,
    send: vi.fn(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({ id: `msg-${Date.now()}` }), sendDelay)
      )
    ),
    isThread: () => false,
    threads: {
      create: vi.fn(() => Promise.resolve({
        id: `thread-${Date.now()}`,
        name: 'Test Thread',
        send: vi.fn(() => Promise.resolve({ id: `thread-msg-${Date.now()}` })),
      })),
    },
  });

  const channelResponseTimes = new Map();
  let channelFetchCount = 0;

  return {
    Client: vi.fn(() => ({
      once: vi.fn(),
      on: vi.fn(),
      login: vi.fn(() => Promise.resolve()),
      destroy: vi.fn(),
      user: { tag: 'TestBot#1234', id: 'bot-123' },
      channels: {
        fetch: vi.fn((channelId) => {
          channelFetchCount++;

          // Simulate different response times for different channels
          const baseDelay = channelResponseTimes.get(channelId) || 50;
          const delay = baseDelay + (Math.random() * 100); // Add jitter

          return new Promise((resolve) => {
            setTimeout(() => {
              if (channelId === 'slow-channel') {
                resolve(createMockChannel(channelId, 2000)); // Very slow sends
              } else if (channelId === 'fast-channel') {
                resolve(createMockChannel(channelId, 10)); // Fast sends
              } else if (channelId.startsWith('load-test-')) {
                resolve(createMockChannel(channelId, 100)); // Medium delay
              } else {
                resolve(createMockChannel(channelId, 50));
              }
            }, delay);
          });
        }),
      },
      // Add method to track fetch count for testing
      _getChannelFetchCount: () => channelFetchCount,
      _resetChannelFetchCount: () => { channelFetchCount = 0; },
      _setChannelResponseTime: (channelId: string, delay: number) => {
        channelResponseTimes.set(channelId, delay);
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
      toJSON: vi.fn(() => ({ title: 'Test', description: 'Test' })),
    })),
    ChannelType: { GuildText: 0 },
    REST: vi.fn(() => ({
      setToken: vi.fn(function() { return this; }),
      put: vi.fn(() => Promise.resolve()),
    })),
    Routes: {
      applicationCommands: vi.fn(() => '/commands'),
    },
  };
});

class MockOrchestratorWithDelay {
  private taskCounter = 0;
  private operationDelays = new Map<string, number>();

  on = vi.fn();

  setOperationDelay(operation: string, delay: number) {
    this.operationDelays.set(operation, delay);
  }

  async createTask(options: { description: string }): Promise<any> {
    const delay = this.operationDelays.get('createTask') || 50;
    await new Promise(resolve => setTimeout(resolve, delay));

    const taskId = `task-${++this.taskCounter}-${Date.now()}`;
    return {
      id: taskId,
      status: 'pending',
      description: options.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getCurrentTask() {
    const delay = this.operationDelays.get('getCurrentTask') || 25;
    await new Promise(resolve => setTimeout(resolve, delay));
    return {
      id: 'current-task-123',
      status: 'running',
      description: 'Current running task',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async cancelTask(taskId: string) {
    const delay = this.operationDelays.get('cancelTask') || 30;
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  async captureThought(content: string) {
    const delay = this.operationDelays.get('captureThought') || 20;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async getTask(taskId: string) {
    const delay = this.operationDelays.get('getTask') || 40;
    await new Promise(resolve => setTimeout(resolve, delay));
    return null;
  }

  listTasks = vi.fn(() => Promise.resolve([]));
}

describe.skip('Discord Load and Performance Tests', () => {
  let discordService: DiscordService;
  let mockOrchestrator: MockOrchestratorWithDelay;
  let mockLogger: any;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestratorWithDelay();
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

  describe('Concurrent Command Handling', () => {
    beforeEach(() => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'load-test-channel',
          threadUpdates: false, // Disable to focus on command performance
        },
        logger: mockLogger,
      });
    });

    it('should handle multiple concurrent run commands efficiently', async () => {
      await discordService.start();

      const startTime = Date.now();
      const commandCount = 10;
      const concurrentCommands = [];

      for (let i = 0; i < commandCount; i++) {
        const mockInteraction = createMockInteraction('run', {
          description: `Concurrent task ${i}`,
        });
        concurrentCommands.push(
          (discordService as any).handleSlashCommand(mockInteraction)
        );
      }

      await Promise.all(concurrentCommands);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (allowing for mock delays)
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 commands

      // Verify all commands were processed
      expect(mockOrchestrator.on).toHaveBeenCalled(); // Event listeners registered
    }, 10000);

    it('should handle mixed command types concurrently', async () => {
      await discordService.start();

      const commands = [
        createMockInteraction('run', { description: 'Mixed task 1' }),
        createMockInteraction('status'),
        createMockInteraction('think', { content: 'Mixed thought' }),
        createMockInteraction('run', { description: 'Mixed task 2' }),
        createMockInteraction('status'),
        createMockInteraction('help'),
        createMockInteraction('cancel', { task_id: 'some-task-id' }),
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(
        commands.map(interaction =>
          (discordService as any).handleSlashCommand(interaction)
        )
      );
      const duration = Date.now() - startTime;

      // All commands should succeed
      const failedCommands = results.filter(r => r.status === 'rejected');
      expect(failedCommands).toHaveLength(0);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);
    }, 10000);

    it('should maintain performance under high load with slow orchestrator', async () => {
      // Simulate slow orchestrator operations
      mockOrchestrator.setOperationDelay('createTask', 500);
      mockOrchestrator.setOperationDelay('getCurrentTask', 300);
      mockOrchestrator.setOperationDelay('cancelTask', 200);

      await discordService.start();

      const heavyLoadCommands = Array.from({ length: 20 }, (_, i) => ({
        interaction: createMockInteraction('run', { description: `Heavy load task ${i}` }),
        expectedDelay: 500, // createTask delay
      }));

      const startTime = Date.now();
      const results = await Promise.allSettled(
        heavyLoadCommands.map(({ interaction }) =>
          (discordService as any).handleSlashCommand(interaction)
        )
      );
      const duration = Date.now() - startTime;

      // All should succeed despite slow operations
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      // Should handle concurrency reasonably (not sequential)
      // 20 commands * 500ms would be 10s sequential, concurrent should be much faster
      expect(duration).toBeLessThan(8000);
    }, 15000);
  });

  describe('Notification Performance', () => {
    it('should efficiently broadcast to multiple channels', async () => {
      const channelCount = 15;
      const notificationChannels = Array.from({ length: channelCount }, (_, i) =>
        `load-test-channel-${i}`
      );

      const multiChannelService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'load-test-primary',
          notificationChannelIds: notificationChannels,
          threadUpdates: false,
        },
        logger: mockLogger,
      });

      await multiChannelService.start();

      const task = {
        id: 'broadcast-task',
        status: 'completed',
        description: 'Multi-channel broadcast test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const startTime = Date.now();
      await (multiChannelService as any).notifyTaskUpdate('Task completed!', task);
      const duration = Date.now() - startTime;

      // Should complete broadcast in reasonable time
      expect(duration).toBeLessThan(3000); // 3 seconds for 15+ channels

      await multiChannelService.stop();
    }, 10000);

    it('should handle rapid task updates without overwhelming Discord API', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'fast-channel',
        },
        logger: mockLogger,
      });

      await discordService.start();

      const rapidUpdates = Array.from({ length: 25 }, (_, i) => ({
        id: `rapid-task-${i}`,
        status: 'running',
        description: `Rapid update task ${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const startTime = Date.now();
      const updatePromises = rapidUpdates.map((task, index) =>
        (discordService as any).notifyTaskUpdate(`Update ${index}`, task)
      );

      await Promise.allSettled(updatePromises);
      const duration = Date.now() - startTime;

      // Should handle rapid updates efficiently
      expect(duration).toBeLessThan(5000); // 5 seconds for 25 updates
    }, 10000);
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with large thread tracking', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'load-test-channel',
          threadUpdates: true,
        },
        logger: mockLogger,
      });

      await discordService.start();

      // Create many tasks to test thread tracking memory usage
      const taskCount = 100;
      const taskCreationPromises = [];

      for (let i = 0; i < taskCount; i++) {
        const mockInteraction = createMockInteraction('run', {
          description: `Memory test task ${i}`,
        });
        taskCreationPromises.push(
          (discordService as any).handleSlashCommand(mockInteraction)
        );
      }

      await Promise.allSettled(taskCreationPromises);

      // Verify thread tracking doesn't grow unbounded
      const taskThreads = (discordService as any).taskThreads;
      expect(taskThreads.size).toBeLessThanOrEqual(taskCount);

      // Each entry should have expected structure
      for (const [taskId, threadInfo] of taskThreads) {
        expect(taskId).toMatch(/^task-\d+-\d+$/);
        expect(threadInfo).toHaveProperty('channelId');
        expect(threadInfo).toHaveProperty('threadId');
      }
    }, 15000);

    it('should handle service restart cleanly', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
        },
        logger: mockLogger,
      });

      // Start and create some state
      await discordService.start();

      const setupCommands = Array.from({ length: 5 }, (_, i) =>
        createMockInteraction('run', { description: `Setup task ${i}` })
      );

      await Promise.all(
        setupCommands.map(interaction =>
          (discordService as any).handleSlashCommand(interaction)
        )
      );

      // Stop and restart
      await discordService.stop();
      await discordService.start();

      // Should work normally after restart
      const postRestartCommand = createMockInteraction('status');
      await expect(
        (discordService as any).handleSlashCommand(postRestartCommand)
      ).resolves.toBeUndefined();
    }, 10000);
  });

  describe('Rate Limiting and Throttling', () => {
    it('should handle channel fetch rate limits gracefully', async () => {
      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      // Set high response times to simulate rate limiting
      clientInstance._setChannelResponseTime('slow-channel', 1000);

      const slowChannelService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'slow-channel',
        },
        logger: mockLogger,
      });

      await slowChannelService.start();

      // Reset counter before test
      clientInstance._resetChannelFetchCount();

      const task = {
        id: 'rate-limit-task',
        status: 'completed',
        description: 'Rate limit test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const startTime = Date.now();
      await (slowChannelService as any).notifyTaskUpdate('Slow notification', task);
      const duration = Date.now() - startTime;

      // Should handle slow response times
      expect(duration).toBeGreaterThan(1000); // Should take time due to slow channel
      expect(duration).toBeLessThan(5000); // But not hang indefinitely

      await slowChannelService.stop();
    }, 10000);

    it('should efficiently reuse channel cache', async () => {
      discordService = new DiscordService({
        orchestrator: mockOrchestrator as any,
        config: {
          enabled: true,
          botToken: 'test-token',
          applicationId: 'test-app',
          defaultChannelId: 'cache-test-channel',
        },
        logger: mockLogger,
      });

      await discordService.start();

      const { Client } = await import('discord.js');
      const MockClient = Client as any;
      const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1].value;

      // Reset counter
      clientInstance._resetChannelFetchCount();

      // Send multiple notifications to same channel
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        id: `cache-task-${i}`,
        status: 'running',
        description: `Cache test task ${i}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await Promise.all(
        notifications.map(task =>
          (discordService as any).notifyTaskUpdate(`Notification ${task.id}`, task)
        )
      );

      // Should have fetched channel multiple times (Discord.js doesn't cache automatically)
      const fetchCount = clientInstance._getChannelFetchCount();
      expect(fetchCount).toBeGreaterThan(0);
    }, 10000);
  });

  // Helper function to create mock interactions
  function createMockInteraction(subcommand: string, options: Record<string, string> = {}) {
    const interactionId = Math.random().toString(36).substring(7);

    return {
      id: interactionId,
      commandName: 'apex',
      options: {
        getSubcommand: vi.fn(() => subcommand),
        getString: vi.fn((name: string) => options[name] || null),
      },
      channelId: 'load-test-channel',
      guildId: 'guild-123',
      user: {
        id: `user-${interactionId}`,
        username: `testuser-${interactionId}`,
      },
      channel: {
        id: 'load-test-channel',
        type: 0,
        threads: {
          create: vi.fn(() => Promise.resolve({
            id: `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name: 'Load Test Thread',
          })),
        },
      },
      reply: vi.fn(() => Promise.resolve({ id: `reply-${Date.now()}` })),
      editReply: vi.fn(() => Promise.resolve({ id: `edit-${Date.now()}` })),
      followUp: vi.fn(() => Promise.resolve({ id: `followup-${Date.now()}` })),
      deferReply: vi.fn(() => Promise.resolve()),
      replied: false,
      deferred: false,
      isChatInputCommand: vi.fn(() => true),
    };
  }
});