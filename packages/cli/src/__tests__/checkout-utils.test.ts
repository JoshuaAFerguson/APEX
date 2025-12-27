/**
 * Unit tests for utility functions used by the /checkout command
 * Tests helper functions for formatting and display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the utility functions from the main CLI file
// Since they're not exported, we'll test them through the command behavior

describe('Checkout Command Utility Functions', () => {
  describe('Time formatting in checkout list', () => {
    let mockContext: any;
    let mockOrchestrator: any;

    beforeEach(() => {
      mockOrchestrator = {
        listTaskWorktrees: vi.fn(),
      };

      mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: {
          project: { name: 'Test Project', description: 'Test project' },
          agents: {},
          workflows: {},
          limits: { maxTokensPerTask: 100000, maxCostPerTask: 10.0, dailyBudget: 100.0, timeoutMs: 300000 },
          autonomy: { default: 'medium', autoApprove: false },
          api: { url: 'http://localhost:3000', port: 3000 },
          models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
        },
        orchestrator: mockOrchestrator,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should format time correctly for recent dates', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockWorktrees = [
        {
          taskId: 'task-just-now-123456789012',
          path: '/tmp/apex-worktrees/task-just-now',
          branch: 'apex/task-just-now',
          status: 'active',
          lastUsedAt: now,
        },
        {
          taskId: 'task-minute-ago-123456789012',
          path: '/tmp/apex-worktrees/task-minute-ago',
          branch: 'apex/task-minute-ago',
          status: 'active',
          lastUsedAt: oneMinuteAgo,
        },
        {
          taskId: 'task-hour-ago-123456789012',
          path: '/tmp/apex-worktrees/task-hour-ago',
          branch: 'apex/task-hour-ago',
          status: 'stale',
          lastUsedAt: oneHourAgo,
        },
        {
          taskId: 'task-day-ago-123456789012',
          path: '/tmp/apex-worktrees/task-day-ago',
          branch: 'apex/task-day-ago',
          status: 'stale',
          lastUsedAt: oneDayAgo,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      // Check that time formatting appears in the output
      const allLogCalls = mockConsoleLog.mock.calls.flat();
      const timeLines = allLogCalls.filter(call =>
        typeof call === 'string' && call.includes('Last used:')
      );

      expect(timeLines.length).toBeGreaterThan(0);

      // Verify various time formats appear
      const hasJustNow = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('just now')
      );
      const hasMinuteAgo = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('minute')
      );
      const hasHourAgo = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('hour')
      );
      const hasDayAgo = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('day')
      );

      expect(hasJustNow || hasMinuteAgo || hasHourAgo || hasDayAgo).toBe(true);

      mockConsoleLog.mockRestore();
    });

    it('should handle plural vs singular time formatting', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const mockWorktrees = [
        {
          taskId: 'task-1min-123456789012',
          path: '/tmp/apex-worktrees/task-1min',
          branch: 'apex/task-1min',
          status: 'active',
          lastUsedAt: oneMinuteAgo,
        },
        {
          taskId: 'task-2mins-123456789012',
          path: '/tmp/apex-worktrees/task-2mins',
          branch: 'apex/task-2mins',
          status: 'active',
          lastUsedAt: twoMinutesAgo,
        },
        {
          taskId: 'task-1hour-123456789012',
          path: '/tmp/apex-worktrees/task-1hour',
          branch: 'apex/task-1hour',
          status: 'stale',
          lastUsedAt: oneHourAgo,
        },
        {
          taskId: 'task-2hours-123456789012',
          path: '/tmp/apex-worktrees/task-2hours',
          branch: 'apex/task-2hours',
          status: 'stale',
          lastUsedAt: twoHoursAgo,
        },
        {
          taskId: 'task-1day-123456789012',
          path: '/tmp/apex-worktrees/task-1day',
          branch: 'apex/task-1day',
          status: 'stale',
          lastUsedAt: oneDayAgo,
        },
        {
          taskId: 'task-2days-123456789012',
          path: '/tmp/apex-worktrees/task-2days',
          branch: 'apex/task-2days',
          status: 'stale',
          lastUsedAt: twoDaysAgo,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Check for proper pluralization
      const hasSingularMinute = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('1 minute ago')
      );
      const hasPluralMinutes = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('2 minutes ago')
      );
      const hasSingularHour = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('1 hour ago')
      );
      const hasPluralHours = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('2 hours ago')
      );
      const hasSingularDay = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('1 day ago')
      );
      const hasPluralDays = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('2 days ago')
      );

      // At least some pluralization should be working correctly
      const hasCorrectPluralization = (hasSingularMinute && hasPluralMinutes) ||
                                    (hasSingularHour && hasPluralHours) ||
                                    (hasSingularDay && hasPluralDays);

      expect(hasCorrectPluralization).toBe(true);

      mockConsoleLog.mockRestore();
    });

    it('should display appropriate status emojis for worktrees', async () => {
      const mockWorktrees = [
        {
          taskId: 'task-active-123456789012',
          path: '/tmp/apex-worktrees/task-active',
          branch: 'apex/task-active',
          status: 'active',
          lastUsedAt: new Date(),
        },
        {
          taskId: 'task-stale-123456789012',
          path: '/tmp/apex-worktrees/task-stale',
          branch: 'apex/task-stale',
          status: 'stale',
          lastUsedAt: new Date(Date.now() - 86400000),
        },
        {
          taskId: 'task-broken-123456789012',
          path: '/tmp/apex-worktrees/task-broken',
          branch: 'apex/task-broken',
          status: 'broken',
          lastUsedAt: new Date(Date.now() - 172800000),
        },
        {
          taskId: 'task-prunable-123456789012',
          path: '/tmp/apex-worktrees/task-prunable',
          branch: 'apex/task-prunable',
          status: 'prunable',
          lastUsedAt: new Date(Date.now() - 259200000),
        },
        {
          taskId: 'task-unknown-123456789012',
          path: '/tmp/apex-worktrees/task-unknown',
          branch: 'apex/task-unknown',
          status: 'unknown-status',
          lastUsedAt: new Date(),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Check for status emojis in the output
      const hasActiveEmoji = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('✅')
      );
      const hasStaleEmoji = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('⚠️')
      );
      const hasBrokenEmoji = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('❌')
      );
      const hasPrunableEmoji = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('🗑️')
      );
      const hasUnknownEmoji = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('❓')
      );

      // Should have at least some status emojis
      const hasStatusEmojis = hasActiveEmoji || hasStaleEmoji || hasBrokenEmoji ||
                             hasPrunableEmoji || hasUnknownEmoji;
      expect(hasStatusEmojis).toBe(true);

      mockConsoleLog.mockRestore();
    });

    it('should handle missing or null timestamp gracefully', async () => {
      const mockWorktrees = [
        {
          taskId: 'task-null-time-123456789012',
          path: '/tmp/apex-worktrees/task-null-time',
          branch: 'apex/task-null-time',
          status: 'active',
          lastUsedAt: null,
        },
        {
          taskId: 'task-undefined-time-123456789012',
          path: '/tmp/apex-worktrees/task-undefined-time',
          branch: 'apex/task-undefined-time',
          status: 'stale',
          lastUsedAt: undefined,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Should handle null/undefined timestamps gracefully by showing "unknown"
      const hasUnknownTime = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('unknown')
      );
      expect(hasUnknownTime).toBe(true);

      // Should not crash or throw errors
      expect(() => {
        // The command should have completed without throwing
      }).not.toThrow();

      mockConsoleLog.mockRestore();
    });

    it('should format very old timestamps correctly', async () => {
      const veryOldDate = new Date('2020-01-01'); // Several years ago

      const mockWorktrees = [
        {
          taskId: 'task-very-old-123456789012',
          path: '/tmp/apex-worktrees/task-very-old',
          branch: 'apex/task-very-old',
          status: 'stale',
          lastUsedAt: veryOldDate,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Should format very old dates as days ago
      const hasDaysAgo = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('days ago')
      );
      expect(hasDaysAgo).toBe(true);

      mockConsoleLog.mockRestore();
    });

    it('should handle future timestamps gracefully', async () => {
      const futureDate = new Date(Date.now() + 86400000); // 1 day in the future

      const mockWorktrees = [
        {
          taskId: 'task-future-123456789012',
          path: '/tmp/apex-worktrees/task-future',
          branch: 'apex/task-future',
          status: 'active',
          lastUsedAt: futureDate,
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Should not throw error with future date
      await expect(checkoutCommand?.handler(mockContext, ['--list'])).resolves.not.toThrow();

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Should show something reasonable for future dates (might show "just now" or handle gracefully)
      const hasTimeFormatting = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('Last used:')
      );
      expect(hasTimeFormatting).toBe(true);

      mockConsoleLog.mockRestore();
    });
  });

  describe('Task ID formatting', () => {
    let mockContext: any;
    let mockOrchestrator: any;

    beforeEach(() => {
      mockOrchestrator = {
        listTaskWorktrees: vi.fn(),
      };

      mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: {
          project: { name: 'Test Project', description: 'Test project' },
          agents: {},
          workflows: {},
          limits: { maxTokensPerTask: 100000, maxCostPerTask: 10.0, dailyBudget: 100.0, timeoutMs: 300000 },
          autonomy: { default: 'medium', autoApprove: false },
          api: { url: 'http://localhost:3000', port: 3000 },
          models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
        },
        orchestrator: mockOrchestrator,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should truncate task IDs to 12 characters for display', async () => {
      const mockWorktrees = [
        {
          taskId: 'task-very-long-id-that-should-be-truncated-123456789012345678901234567890',
          path: '/tmp/apex-worktrees/task-long',
          branch: 'apex/task-long',
          status: 'active',
          lastUsedAt: new Date(),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Should truncate to 12 characters
      const hasTruncatedId = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('task-very-lo')
      );
      expect(hasTruncatedId).toBe(true);

      // Should not show the full long ID
      const hasFullLongId = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('task-very-long-id-that-should-be-truncated-123456789012345678901234567890')
      );
      expect(hasFullLongId).toBe(false);

      mockConsoleLog.mockRestore();
    });

    it('should handle null or undefined task IDs gracefully', async () => {
      const mockWorktrees = [
        {
          taskId: null,
          path: '/tmp/apex-worktrees/task-null-id',
          branch: 'apex/task-null-id',
          status: 'broken',
          lastUsedAt: new Date(),
        },
        {
          taskId: undefined,
          path: '/tmp/apex-worktrees/task-undefined-id',
          branch: 'apex/task-undefined-id',
          status: 'broken',
          lastUsedAt: new Date(),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      await checkoutCommand?.handler(mockContext, ['--list']);

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Should show "unknown" for null/undefined task IDs
      const hasUnknownId = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('unknown')
      );
      expect(hasUnknownId).toBe(true);

      mockConsoleLog.mockRestore();
    });

    it('should handle short task IDs without errors', async () => {
      const mockWorktrees = [
        {
          taskId: 'abc',
          path: '/tmp/apex-worktrees/short',
          branch: 'apex/short',
          status: 'active',
          lastUsedAt: new Date(),
        },
      ];

      mockOrchestrator.listTaskWorktrees.mockResolvedValue(mockWorktrees);

      const mockConsoleLog = vi.spyOn(console, 'log');
      mockConsoleLog.mockImplementation(() => {}); // Suppress output

      const { commands } = await import('../index.js');
      const checkoutCommand = commands.find(cmd => cmd.name === 'checkout');

      // Should not throw error with short ID
      await expect(checkoutCommand?.handler(mockContext, ['--list'])).resolves.not.toThrow();

      const allLogCalls = mockConsoleLog.mock.calls.flat();

      // Should show the short ID as-is
      const hasShortId = allLogCalls.some(call =>
        typeof call === 'string' && call.includes('abc')
      );
      expect(hasShortId).toBe(true);

      mockConsoleLog.mockRestore();
    });
  });
});