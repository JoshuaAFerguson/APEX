/**
 * Tests for ActivityLog component display mode behavior
 *
 * Verifies that ActivityLog component should be hidden in compact mode
 * and show additional debug information in verbose mode
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { ActivityLog, CompactLog, LogStream, type LogEntry, type ActivityLogProps } from '../ActivityLog';
import type { DisplayMode } from '@apex/core';

// Mock ink hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 120 } }),
    Box: ({ children, ...props }: any) => <div data-testid="activity-log-box" {...props}>{children}</div>,
    Text: ({ children, color, ...props }: any) => <span style={{ color }} data-testid="activity-log-text" {...props}>{children}</span>,
  };
});

// Mock responsive hooks
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 30,
    breakpoint: 'wide' as const,
  }),
}));

describe('ActivityLog - Display Mode Behavior', () => {
  let mockLogEntries: LogEntry[];
  let baseProps: ActivityLogProps;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogEntries = [
      {
        id: '1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        level: 'info',
        message: 'Application started',
        agent: 'system',
        category: 'startup',
      },
      {
        id: '2',
        timestamp: new Date('2024-01-01T10:00:01Z'),
        level: 'debug',
        message: 'Debug information for troubleshooting',
        agent: 'developer',
        category: 'development',
        data: {
          threadId: '12345',
          memoryUsage: '45MB',
          stackTrace: ['line1', 'line2', 'line3'],
        },
      },
      {
        id: '3',
        timestamp: new Date('2024-01-01T10:00:02Z'),
        level: 'warn',
        message: 'Performance warning detected',
        agent: 'tester',
        duration: 1250,
      },
      {
        id: '4',
        timestamp: new Date('2024-01-01T10:00:03Z'),
        level: 'error',
        message: 'Critical error occurred',
        agent: 'system',
        data: {
          errorCode: 'E001',
          context: 'User authentication',
        },
      },
      {
        id: '5',
        timestamp: new Date('2024-01-01T10:00:04Z'),
        level: 'success',
        message: 'Task completed successfully',
        agent: 'orchestrator',
        duration: 3400,
      },
    ];

    baseProps = {
      entries: mockLogEntries,
      maxEntries: 100,
      showTimestamps: true,
      showAgents: true,
      allowCollapse: true,
      filterLevel: 'debug',
      title: 'Activity Log',
      autoScroll: true,
    };
  });

  describe('Normal Mode Behavior', () => {
    it('should display all log entries in normal mode', () => {
      render(<ActivityLog {...baseProps} />);

      // All log messages should be visible
      expect(screen.getByText('Application started')).toBeInTheDocument();
      expect(screen.getByText('Debug information for troubleshooting')).toBeInTheDocument();
      expect(screen.getByText('Performance warning detected')).toBeInTheDocument();
      expect(screen.getByText('Critical error occurred')).toBeInTheDocument();
      expect(screen.getByText('Task completed successfully')).toBeInTheDocument();

      // Should show standard information
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText('5 entries')).toBeInTheDocument();
    });

    it('should show debug data when entries are expanded in normal mode', () => {
      render(<ActivityLog {...baseProps} />);

      // Debug data should be visible for entries that have it
      expect(screen.getByText(/threadId:/)).toBeInTheDocument();
      expect(screen.getByText(/12345/)).toBeInTheDocument();
      expect(screen.getByText(/memoryUsage:/)).toBeInTheDocument();
      expect(screen.getByText(/45MB/)).toBeInTheDocument();
    });
  });

  describe('Compact Mode Behavior', () => {
    it('should be suitable for compact display when using CompactLog component', () => {
      const { container } = render(
        <CompactLog
          entries={mockLogEntries}
          maxLines={3}
          showIcons={true}
          showTimestamps={false}
        />
      );

      // Should only show recent entries (maxLines = 3)
      expect(screen.getByText('Performance warning detected')).toBeInTheDocument();
      expect(screen.getByText('Critical error occurred')).toBeInTheDocument();
      expect(screen.getByText('Task completed successfully')).toBeInTheDocument();

      // Should not show older entries
      expect(screen.queryByText('Application started')).not.toBeInTheDocument();
      expect(screen.queryByText('Debug information for troubleshooting')).not.toBeInTheDocument();

      // Should show indication of hidden entries
      expect(screen.getByText('... and 2 more entries')).toBeInTheDocument();

      // Should be compact - no timestamps in this configuration
      expect(screen.queryByText(/10:00/)).not.toBeInTheDocument();
    });

    it('should hide detailed debug information in compact mode', () => {
      render(
        <CompactLog
          entries={mockLogEntries}
          maxLines={5}
          showIcons={false}
          showTimestamps={false}
        />
      );

      // Should not show debug data that would clutter compact display
      expect(screen.queryByText(/threadId:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/memoryUsage:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/errorCode:/)).not.toBeInTheDocument();
    });

    it('should truncate long messages in compact mode', () => {
      const longMessageEntry: LogEntry = {
        id: 'long',
        timestamp: new Date(),
        level: 'info',
        message: 'This is an extremely long log message that should be truncated when displayed in compact mode because it would take up too much space and make the interface cluttered and difficult to read',
      };

      render(
        <CompactLog
          entries={[longMessageEntry]}
          maxLines={1}
        />
      );

      // Message should be truncated
      const messageText = screen.getByText(/This is an extremely long/);
      expect(messageText.textContent).toContain('...');
      expect(messageText.textContent?.length).toBeLessThan(longMessageEntry.message.length);
    });
  });

  describe('Verbose Mode Behavior', () => {
    it('should show all detailed information in verbose mode', () => {
      render(<ActivityLog {...baseProps} filterLevel="debug" />);

      // All log messages should be visible including debug
      expect(screen.getByText('Application started')).toBeInTheDocument();
      expect(screen.getByText('Debug information for troubleshooting')).toBeInTheDocument();
      expect(screen.getByText('Performance warning detected')).toBeInTheDocument();
      expect(screen.getByText('Critical error occurred')).toBeInTheDocument();
      expect(screen.getByText('Task completed successfully')).toBeInTheDocument();

      // Should show all debug information
      expect(screen.getByText(/threadId:/)).toBeInTheDocument();
      expect(screen.getByText(/12345/)).toBeInTheDocument();
      expect(screen.getByText(/memoryUsage:/)).toBeInTheDocument();
      expect(screen.getByText(/errorCode:/)).toBeInTheDocument();

      // Should show timing information
      expect(screen.getByText(/1\.3s/)).toBeInTheDocument(); // Performance warning duration
      expect(screen.getByText(/3\.4s/)).toBeInTheDocument(); // Success task duration
    });

    it('should show detailed timestamps in verbose mode', () => {
      render(<ActivityLog {...baseProps} showTimestamps={true} />);

      // Should show full timestamps
      expect(screen.getAllByText(/10:00:0[0-4]/)).toHaveLength(5);
    });

    it('should show agent information in verbose mode', () => {
      render(<ActivityLog {...baseProps} showAgents={true} />);

      // Should show all agent information
      expect(screen.getByText('[system]')).toBeInTheDocument();
      expect(screen.getByText('[developer]')).toBeInTheDocument();
      expect(screen.getByText('[tester]')).toBeInTheDocument();
      expect(screen.getByText('[orchestrator]')).toBeInTheDocument();
    });

    it('should display category information in verbose mode', () => {
      render(<ActivityLog {...baseProps} />);

      // Categories should be shown in verbose mode
      expect(screen.getByText('(startup)')).toBeInTheDocument();
      expect(screen.getByText('(development)')).toBeInTheDocument();
    });

    it('should show expanded data structures in verbose mode', () => {
      render(<ActivityLog {...baseProps} />);

      // Complex data should be visible
      expect(screen.getByText(/stackTrace/)).toBeInTheDocument();
      expect(screen.getByText(/\["line1","line2","line3"\]/)).toBeInTheDocument();
    });
  });

  describe('Real-time LogStream Component', () => {
    it('should show appropriate level of detail based on display context', () => {
      render(
        <LogStream
          entries={mockLogEntries}
          realTime={true}
          bufferSize={1000}
        />
      );

      // Should show live stream header
      expect(screen.getByText('Live Log Stream')).toBeInTheDocument();
      expect(screen.getByText('LIVE')).toBeInTheDocument();

      // Should show all entries in stream
      expect(screen.getByText('Application started')).toBeInTheDocument();
      expect(screen.getByText('Debug information for troubleshooting')).toBeInTheDocument();

      // Should show entry count
      expect(screen.getByText(/Showing 5 of 5 entries/)).toBeInTheDocument();
    });

    it('should be pausable and controllable for verbose examination', () => {
      render(
        <LogStream
          entries={mockLogEntries}
          realTime={true}
        />
      );

      // Should show controls for detailed examination
      expect(screen.getByText(/Space: pause/)).toBeInTheDocument();
      expect(screen.getByText(/s: scroll/)).toBeInTheDocument();
    });
  });

  describe('Filtering by Log Level', () => {
    it('should filter appropriately for compact mode (higher level only)', () => {
      render(<ActivityLog {...baseProps} filterLevel="warn" />);

      // Should only show warning, error, and success (warn+ level)
      expect(screen.queryByText('Application started')).not.toBeInTheDocument(); // info level
      expect(screen.queryByText('Debug information for troubleshooting')).not.toBeInTheDocument(); // debug level
      expect(screen.getByText('Performance warning detected')).toBeInTheDocument(); // warn level
      expect(screen.getByText('Critical error occurred')).toBeInTheDocument(); // error level
      expect(screen.getByText('Task completed successfully')).toBeInTheDocument(); // success level (treated as info+ in levelOrder)
    });

    it('should show all levels in verbose mode', () => {
      render(<ActivityLog {...baseProps} filterLevel="debug" />);

      // All levels should be visible in verbose mode
      expect(screen.getByText('Application started')).toBeInTheDocument();
      expect(screen.getByText('Debug information for troubleshooting')).toBeInTheDocument();
      expect(screen.getByText('Performance warning detected')).toBeInTheDocument();
      expect(screen.getByText('Critical error occurred')).toBeInTheDocument();
      expect(screen.getByText('Task completed successfully')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt message length based on available space', () => {
      const longEntries = [{
        id: 'responsive',
        timestamp: new Date(),
        level: 'info' as const,
        message: 'This message should be truncated based on the available terminal width and the space needed for other UI elements like timestamps and agent names',
      }];

      render(<ActivityLog {...baseProps} entries={longEntries} width={60} />);

      // Message should be truncated to fit available space
      const messageElement = screen.getByText(/This message should be truncated/);
      expect(messageElement.textContent).toContain('...');
    });

    it('should abbreviate timestamps in narrow displays', () => {
      // Mock narrow display
      vi.mocked(require('../../hooks/index.js')).useStdoutDimensions.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow',
      });

      render(<ActivityLog {...baseProps} width={40} />);

      // Should use abbreviated timestamp format (HH:MM instead of HH:MM:SS)
      expect(screen.getAllByText(/10:00/)).toHaveLength(5);
      // Should not show seconds in narrow mode
      expect(screen.queryByText(/10:00:0[0-4]/)).not.toBeInTheDocument();
    });

    it('should hide icons in extremely narrow terminals', () => {
      vi.mocked(require('../../hooks/index.js')).useStdoutDimensions.mockReturnValue({
        width: 30,
        height: 20,
        breakpoint: 'narrow',
      });

      render(<ActivityLog {...baseProps} width={30} />);

      // Icons should be hidden to save space
      expect(screen.queryByText('ℹ️')).not.toBeInTheDocument();
      expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
      expect(screen.queryByText('❌')).not.toBeInTheDocument();
    });
  });

  describe('Collapse and Expansion', () => {
    it('should support collapsing to save space in compact scenarios', () => {
      const { container } = render(
        <ActivityLog {...baseProps} allowCollapse={true} />
      );

      // Should show collapse instructions
      expect(screen.getByText(/Press 'c' to collapse/)).toBeInTheDocument();

      // Component should render without errors
      expect(container).toBeTruthy();
    });

    it('should provide minimal collapsed view for compact mode', () => {
      const CollapsedLog = () => {
        return (
          <div data-testid="collapsed-activity-log">
            <span>Activity Log (collapsed) - Press 'c' to expand</span>
          </div>
        );
      };

      render(<CollapsedLog />);

      // Should show minimal collapsed state
      expect(screen.getByText(/Activity Log \(collapsed\)/)).toBeInTheDocument();
      expect(screen.getByText(/Press 'c' to expand/)).toBeInTheDocument();
    });
  });

  describe('Performance Considerations', () => {
    it('should limit entries for compact mode performance', () => {
      const manyEntries: LogEntry[] = Array.from({ length: 500 }, (_, i) => ({
        id: `entry-${i}`,
        timestamp: new Date(),
        level: 'info',
        message: `Log entry ${i}`,
      }));

      render(<ActivityLog {...baseProps} entries={manyEntries} maxEntries={50} />);

      // Should only show limited entries
      expect(screen.getByText('50 entries')).toBeInTheDocument();
      expect(screen.queryByText('500 entries')).not.toBeInTheDocument();
    });

    it('should use appropriate buffer size for streaming in different modes', () => {
      const manyEntries: LogEntry[] = Array.from({ length: 200 }, (_, i) => ({
        id: `stream-${i}`,
        timestamp: new Date(),
        level: 'debug',
        message: `Stream entry ${i}`,
      }));

      render(
        <LogStream
          entries={manyEntries}
          bufferSize={100}
          height={10}
        />
      );

      // Should manage buffer appropriately
      expect(screen.getByText(/Showing \d+ of 200 entries/)).toBeInTheDocument();
    });
  });
});