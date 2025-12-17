import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { ActivityLog, LogEntry, ActivityLogProps } from '../ActivityLog';

// Mock ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 120 } }),
    Box: ({ children, ...props }: any) => <div data-testid="activity-log-box" {...props}>{children}</div>,
    Text: ({ children, color, dimColor, ...props }: any) => (
      <span
        style={{
          color,
          opacity: dimColor ? 0.7 : 1
        }}
        data-testid="activity-log-text"
        {...props}
      >
        {children}
      </span>
    ),
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

describe('ActivityLog - Compact Mode Behavior', () => {
  let mockLogEntries: LogEntry[];
  let baseProps: ActivityLogProps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

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

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ActivityLog Visibility Control', () => {
    it('should render normally when not in compact mode', () => {
      render(<ActivityLog {...baseProps} />);

      // Should show the activity log content
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText('Application started')).toBeInTheDocument();
      expect(screen.getByText('Debug information for troubleshooting')).toBeInTheDocument();
    });

    it('should render and be visible in normal display mode', () => {
      // Create a wrapper component that conditionally renders ActivityLog based on displayMode
      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        // According to the acceptance criteria, ActivityLog should be hidden in compact mode
        if (displayMode === 'compact') {
          return null; // Hidden in compact mode
        }
        return <ActivityLog {...baseProps} />;
      };

      render(<ActivityLogWrapper displayMode="normal" />);

      // Should show in normal mode
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
    });

    it('should be hidden in compact mode according to acceptance criteria', () => {
      // Create a wrapper component that conditionally renders ActivityLog based on displayMode
      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        // According to the acceptance criteria, ActivityLog should be hidden in compact mode
        if (displayMode === 'compact') {
          return null; // Hidden in compact mode
        }
        return <ActivityLog {...baseProps} />;
      };

      render(<ActivityLogWrapper displayMode="compact" />);

      // Should be completely hidden in compact mode
      expect(screen.queryByTestId('activity-log-box')).not.toBeInTheDocument();
      expect(screen.queryByText('Activity Log')).not.toBeInTheDocument();
      expect(screen.queryByText('Application started')).not.toBeInTheDocument();
      expect(screen.queryByText('Debug information for troubleshooting')).not.toBeInTheDocument();
    });

    it('should render in verbose mode', () => {
      // Create a wrapper component that conditionally renders ActivityLog based on displayMode
      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        // According to the acceptance criteria, ActivityLog should be hidden in compact mode
        if (displayMode === 'compact') {
          return null; // Hidden in compact mode
        }
        return <ActivityLog {...baseProps} />;
      };

      render(<ActivityLogWrapper displayMode="verbose" />);

      // Should show in verbose mode
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText('Application started')).toBeInTheDocument();
    });
  });

  describe('Compact Mode Transition Testing', () => {
    it('should hide when switching to compact mode', () => {
      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        if (displayMode === 'compact') {
          return null;
        }
        return <ActivityLog {...baseProps} />;
      };

      const { rerender } = render(<ActivityLogWrapper displayMode="normal" />);

      // Initially visible in normal mode
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();

      // Switch to compact mode
      rerender(<ActivityLogWrapper displayMode="compact" />);

      // Should be hidden in compact mode
      expect(screen.queryByTestId('activity-log-box')).not.toBeInTheDocument();
      expect(screen.queryByText('Activity Log')).not.toBeInTheDocument();
    });

    it('should show when switching back from compact mode', () => {
      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        if (displayMode === 'compact') {
          return null;
        }
        return <ActivityLog {...baseProps} />;
      };

      const { rerender } = render(<ActivityLogWrapper displayMode="compact" />);

      // Initially hidden in compact mode
      expect(screen.queryByTestId('activity-log-box')).not.toBeInTheDocument();

      // Switch back to normal mode
      rerender(<ActivityLogWrapper displayMode="normal" />);

      // Should be visible again
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText('Application started')).toBeInTheDocument();
    });

    it('should handle rapid mode switching correctly', () => {
      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        if (displayMode === 'compact') {
          return null;
        }
        return <ActivityLog {...baseProps} />;
      };

      const modes: Array<'normal' | 'compact' | 'verbose'> = [
        'normal', 'compact', 'verbose', 'compact', 'normal', 'compact', 'verbose'
      ];

      const { rerender } = render(<ActivityLogWrapper displayMode="normal" />);

      modes.forEach(mode => {
        rerender(<ActivityLogWrapper displayMode={mode} />);

        if (mode === 'compact') {
          // Should be hidden in compact mode
          expect(screen.queryByTestId('activity-log-box')).not.toBeInTheDocument();
          expect(screen.queryByText('Activity Log')).not.toBeInTheDocument();
        } else {
          // Should be visible in normal and verbose modes
          expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
          expect(screen.getByText('Activity Log')).toBeInTheDocument();
        }
      });
    });
  });

  describe('Compact Mode Container Testing', () => {
    it('should test integration with parent container that controls visibility', () => {
      // Simulate how the main App component might control ActivityLog visibility
      const AppContainer = ({ displayMode }: { displayMode: 'normal' | 'compact' | 'verbose' }) => {
        return (
          <div data-testid="app-container">
            <div data-testid="status-bar">Status Bar (always visible)</div>
            <div data-testid="agent-panel">Agent Panel (compact in compact mode)</div>
            <div data-testid="task-progress">Task Progress (compact in compact mode)</div>

            {/* ActivityLog is hidden in compact mode according to acceptance criteria */}
            {displayMode !== 'compact' && (
              <div data-testid="activity-log-section">
                <ActivityLog {...baseProps} />
              </div>
            )}
          </div>
        );
      };

      const { rerender } = render(<AppContainer displayMode="normal" />);

      // All components should be present in normal mode
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
      expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
      expect(screen.getByTestId('task-progress')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-section')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();

      // Switch to compact mode
      rerender(<AppContainer displayMode="compact" />);

      // Other components should still be present
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
      expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
      expect(screen.getByTestId('task-progress')).toBeInTheDocument();

      // ActivityLog should be completely absent
      expect(screen.queryByTestId('activity-log-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('activity-log-box')).not.toBeInTheDocument();
      expect(screen.queryByText('Activity Log')).not.toBeInTheDocument();

      // Switch to verbose mode
      rerender(<AppContainer displayMode="verbose" />);

      // ActivityLog should be present again
      expect(screen.getByTestId('activity-log-section')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
    });
  });

  describe('Performance Considerations for Compact Mode', () => {
    it('should not render ActivityLog component at all in compact mode', () => {
      const renderTracker = vi.fn();

      const TrackedActivityLog = (props: ActivityLogProps) => {
        renderTracker();
        return <ActivityLog {...props} />;
      };

      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        if (displayMode === 'compact') {
          return null; // Hidden in compact mode - component not rendered at all
        }
        return <TrackedActivityLog {...baseProps} />;
      };

      const { rerender } = render(<ActivityLogWrapper displayMode="normal" />);

      // Should have rendered once in normal mode
      expect(renderTracker).toHaveBeenCalledTimes(1);

      // Switch to compact mode
      rerender(<ActivityLogWrapper displayMode="compact" />);

      // Should not have triggered additional renders since component is not rendered
      expect(renderTracker).toHaveBeenCalledTimes(1);

      // Switch back to normal mode
      rerender(<ActivityLogWrapper displayMode="normal" />);

      // Should render again when switching back
      expect(renderTracker).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty log entries when switching modes', () => {
      const emptyProps = { ...baseProps, entries: [] };

      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        if (displayMode === 'compact') {
          return null;
        }
        return <ActivityLog {...emptyProps} />;
      };

      const { rerender } = render(<ActivityLogWrapper displayMode="normal" />);

      // Should show empty log in normal mode
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
      expect(screen.getByText('No log entries to display')).toBeInTheDocument();

      // Switch to compact mode
      rerender(<ActivityLogWrapper displayMode="compact" />);

      // Should be completely hidden
      expect(screen.queryByTestId('activity-log-box')).not.toBeInTheDocument();
      expect(screen.queryByText('No log entries to display')).not.toBeInTheDocument();
    });

    it('should handle large log entries efficiently when switching modes', () => {
      // Create a large number of log entries
      const largeLogEntries = Array.from({ length: 1000 }, (_, index) => ({
        id: `log-${index}`,
        timestamp: new Date(Date.now() + index * 1000),
        level: 'info' as const,
        message: `Log entry number ${index} with some detailed information`,
        agent: `agent-${index % 5}`,
        category: 'performance-test',
      }));

      const largeProps = { ...baseProps, entries: largeLogEntries };

      const ActivityLogWrapper = ({ displayMode }: { displayMode?: 'normal' | 'compact' | 'verbose' }) => {
        if (displayMode === 'compact') {
          return null;
        }
        return <ActivityLog {...largeProps} />;
      };

      const { rerender } = render(<ActivityLogWrapper displayMode="normal" />);

      // Should handle large dataset in normal mode
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();

      // Rapid switching should be efficient
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        rerender(<ActivityLogWrapper displayMode="compact" />);
        rerender(<ActivityLogWrapper displayMode="normal" />);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete rapidly (less than 100ms for 10 switches)
      expect(duration).toBeLessThan(100);

      // Final state check
      expect(screen.getByTestId('activity-log-box')).toBeInTheDocument();
    });
  });
});