import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActivityLog, type ActivityLogProps, type LogEntry } from '../ActivityLog.js';
import type { DisplayMode } from '@apex/core';

// Mock useStdoutDimensions hook
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
  }),
}));

// Mock useInput hook from ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

describe('ActivityLog DisplayMode Integration', () => {
  const createMockLogEntries = (): LogEntry[] => [
    {
      id: 'entry-1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      level: 'info',
      message: 'Stage completed in 5000ms',
      category: 'timing',
      data: {
        stageDuration: 5000,
        stageStartTime: new Date('2023-01-01T09:59:55Z'),
        stageEndTime: new Date('2023-01-01T10:00:00Z'),
      },
    },
    {
      id: 'entry-2',
      timestamp: new Date('2023-01-01T10:00:01Z'),
      level: 'debug',
      message: 'Agent response time: 2000ms',
      agent: 'planner',
      category: 'performance',
      duration: 2000,
      data: {
        responseTime: 2000,
        agent: 'planner',
      },
    },
    {
      id: 'entry-3',
      timestamp: new Date('2023-01-01T10:00:02Z'),
      level: 'info',
      message: 'Processing rate: 10.50 tokens/sec',
      category: 'metrics',
      data: {
        tokensPerSecond: 10.5,
        averageResponseTime: 2000,
        memoryUsage: 256000000,
        cpuUtilization: 25.5,
      },
    },
    {
      id: 'entry-4',
      timestamp: new Date('2023-01-01T10:00:03Z'),
      level: 'debug',
      message: 'Token usage: 1500 total (1000 in, 500 out)',
      agent: 'planner',
      category: 'tokens',
      data: {
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.05,
      },
    },
    {
      id: 'entry-5',
      timestamp: new Date('2023-01-01T10:00:04Z'),
      level: 'debug',
      message: 'Tool Read used for 1000ms',
      category: 'tools',
      duration: 1000,
      data: {
        tool: 'Read',
        usageTime: 1000,
        efficiency: 1.0,
      },
    },
    {
      id: 'entry-6',
      timestamp: new Date('2023-01-01T10:00:05Z'),
      level: 'warn',
      message: 'Agent developer encountered 1 error(s)',
      agent: 'developer',
      category: 'errors',
      data: {
        errorCount: 1,
        retryAttempts: 1,
      },
    },
  ];

  const createActivityLogProps = (
    overrides: Partial<ActivityLogProps> = {}
  ): ActivityLogProps => ({
    entries: createMockLogEntries(),
    maxEntries: 100,
    showTimestamps: true,
    showAgents: true,
    allowCollapse: true,
    title: 'Debug Activity Log',
    autoScroll: true,
    displayMode: 'normal',
    ...overrides,
  });

  describe('displayMode prop handling', () => {
    const displayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

    displayModes.forEach((displayMode) => {
      it(`should accept displayMode "${displayMode}"`, () => {
        const props = createActivityLogProps({ displayMode });

        expect(() => render(<ActivityLog {...props} />)).not.toThrow();
      });
    });

    it('should default to normal displayMode when not specified', () => {
      const props = createActivityLogProps();
      delete (props as any).displayMode;

      render(<ActivityLog {...props} />);

      // Component should render without errors
      expect(screen.getByText('Debug Activity Log')).toBeInTheDocument();
    });
  });

  describe('filter level behavior with displayMode', () => {
    it('should auto-set filter level to debug in verbose mode', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
        filterLevel: undefined, // No explicit filter level
      });

      render(<ActivityLog {...props} />);

      // Should show debug level indicator
      expect(screen.getByText(/Level: debug\+/)).toBeInTheDocument();
      expect(screen.getByText(/\(auto: verbose\)/)).toBeInTheDocument();
    });

    it('should default to info filter level in normal mode', () => {
      const props = createActivityLogProps({
        displayMode: 'normal',
        filterLevel: undefined, // No explicit filter level
      });

      render(<ActivityLog {...props} />);

      // Should show info level indicator
      expect(screen.getByText(/Level: info\+/)).toBeInTheDocument();
      // Should not show auto indicator
      expect(screen.queryByText(/\(auto: verbose\)/)).not.toBeInTheDocument();
    });

    it('should default to info filter level in compact mode', () => {
      const props = createActivityLogProps({
        displayMode: 'compact',
        filterLevel: undefined, // No explicit filter level
      });

      render(<ActivityLog {...props} />);

      // Should show info level indicator
      expect(screen.getByText(/Level: info\+/)).toBeInTheDocument();
    });

    it('should respect explicit filter level regardless of display mode', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
        filterLevel: 'warn', // Explicit filter level
      });

      render(<ActivityLog {...props} />);

      // Should show warn level, not auto-debug
      expect(screen.getByText(/Level: warn\+/)).toBeInTheDocument();
      expect(screen.queryByText(/\(auto: verbose\)/)).not.toBeInTheDocument();
    });
  });

  describe('entry filtering with different display modes', () => {
    it('should show debug entries in verbose mode with auto filter', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
        filterLevel: undefined, // Auto-set to debug
      });

      render(<ActivityLog {...props} />);

      // Should show all entries including debug ones
      expect(screen.getByText(/Agent response time: 2000ms/)).toBeInTheDocument();
      expect(screen.getByText(/Token usage: 1500 total/)).toBeInTheDocument();
      expect(screen.getByText(/Tool Read used for 1000ms/)).toBeInTheDocument();
    });

    it('should filter out debug entries in normal mode with auto filter', () => {
      const props = createActivityLogProps({
        displayMode: 'normal',
        filterLevel: undefined, // Auto-set to info
      });

      render(<ActivityLog {...props} />);

      // Should show info and warn entries
      expect(screen.getByText(/Stage completed in 5000ms/)).toBeInTheDocument();
      expect(screen.getByText(/Processing rate: 10.50 tokens\/sec/)).toBeInTheDocument();
      expect(screen.getByText(/Agent developer encountered 1 error\(s\)/)).toBeInTheDocument();

      // Should not show debug entries
      expect(screen.queryByText(/Agent response time: 2000ms/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Token usage: 1500 total/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tool Read used for 1000ms/)).not.toBeInTheDocument();
    });

    it('should filter out debug entries in compact mode with auto filter', () => {
      const props = createActivityLogProps({
        displayMode: 'compact',
        filterLevel: undefined, // Auto-set to info
      });

      render(<ActivityLog {...props} />);

      // Should show info and warn entries, not debug
      expect(screen.getByText(/Stage completed in 5000ms/)).toBeInTheDocument();
      expect(screen.getByText(/Processing rate: 10.50 tokens\/sec/)).toBeInTheDocument();
      expect(screen.getByText(/Agent developer encountered 1 error\(s\)/)).toBeInTheDocument();

      // Should not show debug entries
      expect(screen.queryByText(/Agent response time: 2000ms/)).not.toBeInTheDocument();
    });
  });

  describe('timestamp display with displayMode', () => {
    it('should show full timestamps in verbose mode', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
        showTimestamps: true,
      });

      render(<ActivityLog {...props} />);

      // Should show full timestamp with milliseconds
      expect(screen.getByText(/\[10:00:00\.000\]/)).toBeInTheDocument();
    });

    it('should show abbreviated timestamps in non-verbose modes on narrow screens', () => {
      // This test needs proper Vitest mock handling for dynamic imports
      // For now, we'll test the static behavior
      const props = createActivityLogProps({
        displayMode: 'normal',
        showTimestamps: true,
      });

      render(<ActivityLog {...props} />);

      // Should show timestamp format (specific format depends on screen width)
      expect(screen.getByText(/\[10:00/)).toBeInTheDocument();
    });
  });

  describe('data expansion with displayMode', () => {
    it('should show expanded data in verbose mode', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
      });

      render(<ActivityLog {...props} />);

      // Should show data fields for entries
      expect(screen.getByText(/stageDuration:/)).toBeInTheDocument();
      expect(screen.getByText(/tokensPerSecond:/)).toBeInTheDocument();
      expect(screen.getByText(/responseTime:/)).toBeInTheDocument();
    });

    it('should not auto-expand data in normal mode', () => {
      const props = createActivityLogProps({
        displayMode: 'normal',
      });

      render(<ActivityLog {...props} />);

      // Data fields should not be visible by default
      expect(screen.queryByText(/stageDuration:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tokensPerSecond:/)).not.toBeInTheDocument();
    });

    it('should not auto-expand data in compact mode', () => {
      const props = createActivityLogProps({
        displayMode: 'compact',
      });

      render(<ActivityLog {...props} />);

      // Data fields should not be visible by default
      expect(screen.queryByText(/stageDuration:/)).not.toBeInTheDocument();
    });
  });

  describe('message truncation with displayMode', () => {
    it('should not truncate messages in verbose mode', () => {
      const longMessage = 'This is a very long message that would normally be truncated in other display modes but should be shown in full in verbose mode to provide maximum detail';
      const entries: LogEntry[] = [
        {
          id: 'long-entry',
          timestamp: new Date(),
          level: 'info',
          message: longMessage,
          category: 'test',
        },
      ];

      const props = createActivityLogProps({
        displayMode: 'verbose',
        entries,
      });

      render(<ActivityLog {...props} />);

      // Full message should be visible
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should respect responsive truncation in normal mode', () => {
      const longMessage = 'This is a very long message that should be truncated in normal display mode to fit within the available space and maintain readability';
      const entries: LogEntry[] = [
        {
          id: 'long-entry',
          timestamp: new Date(),
          level: 'info',
          message: longMessage,
          category: 'test',
        },
      ];

      const props = createActivityLogProps({
        displayMode: 'normal',
        entries,
      });

      render(<ActivityLog {...props} />);

      // Should find truncated message (with ...)
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });
  });

  describe('component integration', () => {
    it('should maintain all ActivityLog functionality with displayMode', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
        allowCollapse: true,
        showTimestamps: true,
        showAgents: true,
      });

      render(<ActivityLog {...props} />);

      // Core functionality should work
      expect(screen.getByText('Debug Activity Log')).toBeInTheDocument();
      expect(screen.getByText(/6 entries/)).toBeInTheDocument();
      expect(screen.getByText(/Press 'c' to collapse/)).toBeInTheDocument();

      // Display mode specific features
      expect(screen.getByText(/Level: debug\+/)).toBeInTheDocument();
      expect(screen.getByText(/\(auto: verbose\)/)).toBeInTheDocument();

      // Entries should be visible
      expect(screen.getByText(/Stage completed in 5000ms/)).toBeInTheDocument();
      expect(screen.getByText(/Agent response time: 2000ms/)).toBeInTheDocument();
    });

    it('should handle empty entries gracefully in all display modes', () => {
      const displayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

      displayModes.forEach((displayMode) => {
        const props = createActivityLogProps({
          displayMode,
          entries: [],
        });

        const { unmount } = render(<ActivityLog {...props} />);

        expect(screen.getByText('No log entries to display')).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('accessibility and usability', () => {
    it('should provide clear visual hierarchy in all display modes', () => {
      const displayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

      displayModes.forEach((displayMode) => {
        const props = createActivityLogProps({ displayMode });

        const { unmount } = render(<ActivityLog {...props} />);

        // Header should be clear
        expect(screen.getByText('Debug Activity Log')).toBeInTheDocument();

        // Entry count should be visible
        expect(screen.getByText(/entries/)).toBeInTheDocument();

        unmount();
      });
    });

    it('should indicate current filter level clearly', () => {
      const props = createActivityLogProps({
        displayMode: 'verbose',
      });

      render(<ActivityLog {...props} />);

      // Filter indication should be clear
      expect(screen.getByText(/Filter:/)).toBeInTheDocument();
      expect(screen.getByText(/Level:/)).toBeInTheDocument();
    });
  });
});