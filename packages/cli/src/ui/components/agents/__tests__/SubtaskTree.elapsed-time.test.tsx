import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

// Mock the useElapsedTime hook
const mockUseElapsedTime = vi.fn();
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

describe('SubtaskTree - Elapsed Time Display Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
    mockUseElapsedTime.mockClear();
    mockUseElapsedTime.mockReturnValue('0s'); // Default return
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('basic elapsed time display', () => {
    it('shows elapsed time for in-progress tasks with startedAt', () => {
      const taskWithStartTime: SubtaskNode = {
        id: 'task-with-time',
        description: 'Task with start time',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:58:30Z') // 1.5 minutes ago
      };

      mockUseElapsedTime.mockReturnValue('1m 30s');

      render(<SubtaskTree task={taskWithStartTime} interactive={false} />);

      // Should show elapsed time with clock icon
      expect(screen.getByText(/⏱ 1m 30s/)).toBeInTheDocument();

      // Should call useElapsedTime with correct parameters
      expect(mockUseElapsedTime).toHaveBeenCalledWith(
        taskWithStartTime.startedAt,
        1000
      );
    });

    it('hides elapsed time when showElapsedTime=false', () => {
      const taskWithStartTime: SubtaskNode = {
        id: 'hidden-time',
        description: 'Task with hidden time',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:55:00Z')
      };

      mockUseElapsedTime.mockReturnValue('5m');

      render(
        <SubtaskTree
          task={taskWithStartTime}
          showElapsedTime={false}
          interactive={false}
        />
      );

      // Should not show elapsed time
      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
      expect(screen.queryByText(/5m/)).not.toBeInTheDocument();
    });

    it('shows elapsed time when showElapsedTime=true (default)', () => {
      const taskWithStartTime: SubtaskNode = {
        id: 'default-time',
        description: 'Task with default time display',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:57:00Z')
      };

      mockUseElapsedTime.mockReturnValue('3m');

      render(<SubtaskTree task={taskWithStartTime} interactive={false} />);

      expect(screen.getByText(/⏱ 3m/)).toBeInTheDocument();
    });
  });

  describe('elapsed time visibility conditions', () => {
    it('shows elapsed time only for in-progress tasks', () => {
      const statuses: SubtaskNode['status'][] = ['pending', 'in-progress', 'completed', 'failed'];

      statuses.forEach(status => {
        const task: SubtaskNode = {
          id: `status-${status}`,
          description: `Task with ${status} status`,
          status,
          startedAt: new Date('2024-01-01T09:55:00Z')
        };

        mockUseElapsedTime.mockReturnValue('5m');

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        if (status === 'in-progress') {
          expect(screen.getByText(/⏱ 5m/)).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
        }

        unmount();
      });
    });

    it('hides elapsed time when startedAt is null', () => {
      const taskWithoutStartTime: SubtaskNode = {
        id: 'no-start-time',
        description: 'Task without start time',
        status: 'in-progress'
        // no startedAt field
      };

      render(<SubtaskTree task={taskWithoutStartTime} interactive={false} />);

      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();

      // useElapsedTime should be called with null
      expect(mockUseElapsedTime).toHaveBeenCalledWith(undefined, 1000);
    });

    it('hides elapsed time when startedAt is undefined', () => {
      const taskWithUndefinedTime: SubtaskNode = {
        id: 'undefined-time',
        description: 'Task with undefined time',
        status: 'in-progress',
        startedAt: undefined
      };

      render(<SubtaskTree task={taskWithUndefinedTime} interactive={false} />);

      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledWith(undefined, 1000);
    });
  });

  describe('elapsed time formatting variations', () => {
    it('displays different time format variations correctly', () => {
      const timeFormats = [
        { mockReturn: '1s', description: 'Very short time' },
        { mockReturn: '30s', description: 'Seconds only' },
        { mockReturn: '2m', description: 'Minutes only' },
        { mockReturn: '2m 45s', description: 'Minutes and seconds' },
        { mockReturn: '1h 30m', description: 'Hours and minutes' },
        { mockReturn: '1h 30m 45s', description: 'Hours, minutes, and seconds' },
        { mockReturn: '2d 5h', description: 'Days and hours' },
        { mockReturn: '1w 3d', description: 'Weeks and days' }
      ];

      timeFormats.forEach(({ mockReturn, description }) => {
        const task: SubtaskNode = {
          id: `time-${mockReturn.replace(/\s/g, '-')}`,
          description: description,
          status: 'in-progress',
          startedAt: new Date('2024-01-01T09:00:00Z')
        };

        mockUseElapsedTime.mockReturnValue(mockReturn);

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        expect(screen.getByText(`⏱ ${mockReturn}`)).toBeInTheDocument();

        unmount();
      });
    });

    it('handles edge case time formats', () => {
      const edgeCases = [
        { mockReturn: '0s', description: 'Zero time' },
        { mockReturn: '', description: 'Empty time string' },
        { mockReturn: '∞', description: 'Infinite time indicator' },
        { mockReturn: '???', description: 'Unknown time format' }
      ];

      edgeCases.forEach(({ mockReturn, description }) => {
        const task: SubtaskNode = {
          id: `edge-${mockReturn || 'empty'}`,
          description: description,
          status: 'in-progress',
          startedAt: new Date('2024-01-01T09:00:00Z')
        };

        mockUseElapsedTime.mockReturnValue(mockReturn);

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        if (mockReturn) {
          expect(screen.getByText(`⏱ ${mockReturn}`)).toBeInTheDocument();
        } else {
          // Empty string should still show the clock icon
          expect(screen.getByText(/⏱/)).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('elapsed time with hierarchical tasks', () => {
    it('shows elapsed time for multiple in-progress tasks in hierarchy', () => {
      const hierarchicalTask: SubtaskNode = {
        id: 'parent',
        description: 'Parent task',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:30:00Z'),
        children: [
          {
            id: 'child1',
            description: 'Child task 1',
            status: 'in-progress',
            startedAt: new Date('2024-01-01T09:45:00Z')
          },
          {
            id: 'child2',
            description: 'Child task 2',
            status: 'completed',
            startedAt: new Date('2024-01-01T09:40:00Z') // Should not show for completed
          },
          {
            id: 'child3',
            description: 'Child task 3',
            status: 'in-progress',
            startedAt: new Date('2024-01-01T09:50:00Z')
          }
        ]
      };

      // Mock different return values for each call
      mockUseElapsedTime
        .mockReturnValueOnce('30m')    // Parent
        .mockReturnValueOnce('15m')    // Child 1
        .mockReturnValueOnce('10m');   // Child 3 (child 2 won't call since it's completed)

      render(<SubtaskTree task={hierarchicalTask} interactive={false} />);

      // Parent and in-progress children should show elapsed time
      expect(screen.getByText('⏱ 30m')).toBeInTheDocument();
      expect(screen.getByText('⏱ 15m')).toBeInTheDocument();
      expect(screen.getByText('⏱ 10m')).toBeInTheDocument();

      // Should be called for in-progress tasks only
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
    });

    it('handles elapsed time with collapsed nodes', () => {
      const taskWithCollapsedTime: SubtaskNode = {
        id: 'root',
        description: 'Root task',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:30:00Z'),
        children: [
          {
            id: 'collapsed-child',
            description: 'Collapsed child',
            status: 'in-progress',
            startedAt: new Date('2024-01-01T09:40:00Z')
          }
        ]
      };

      const collapsedIds = new Set(['root']);
      mockUseElapsedTime.mockReturnValue('30m');

      render(
        <SubtaskTree
          task={taskWithCollapsedTime}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Root elapsed time should be visible
      expect(screen.getByText('⏱ 30m')).toBeInTheDocument();

      // Child elapsed time should be hidden due to collapse
      // useElapsedTime should only be called once for the root
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(1);
    });
  });

  describe('elapsed time with progress indicators', () => {
    it('shows both elapsed time and progress when both are available', () => {
      const taskWithBoth: SubtaskNode = {
        id: 'both-indicators',
        description: 'Task with both indicators',
        status: 'in-progress',
        progress: 75,
        startedAt: new Date('2024-01-01T09:45:00Z')
      };

      mockUseElapsedTime.mockReturnValue('15m 30s');

      render(<SubtaskTree task={taskWithBoth} interactive={false} />);

      // Should show both progress and elapsed time
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText(/[█░]{10}/)).toBeInTheDocument(); // Progress bar
      expect(screen.getByText('⏱ 15m 30s')).toBeInTheDocument();
    });

    it('handles selective display of progress and elapsed time', () => {
      const taskWithBoth: SubtaskNode = {
        id: 'selective-display',
        description: 'Task with selective display',
        status: 'in-progress',
        progress: 60,
        startedAt: new Date('2024-01-01T09:50:00Z')
      };

      mockUseElapsedTime.mockReturnValue('10m');

      // Test showing progress only
      const { rerender } = render(
        <SubtaskTree
          task={taskWithBoth}
          showProgress={true}
          showElapsedTime={false}
          interactive={false}
        />
      );

      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.queryByText('⏱')).not.toBeInTheDocument();

      // Test showing elapsed time only
      rerender(
        <SubtaskTree
          task={taskWithBoth}
          showProgress={false}
          showElapsedTime={true}
          interactive={false}
        />
      );

      expect(screen.queryByText('60%')).not.toBeInTheDocument();
      expect(screen.getByText('⏱ 10m')).toBeInTheDocument();

      // Test hiding both
      rerender(
        <SubtaskTree
          task={taskWithBoth}
          showProgress={false}
          showElapsedTime={false}
          interactive={false}
        />
      );

      expect(screen.queryByText('60%')).not.toBeInTheDocument();
      expect(screen.queryByText('⏱')).not.toBeInTheDocument();
    });
  });

  describe('elapsed time with text truncation', () => {
    it('adjusts description length when elapsed time is shown', () => {
      const longDescriptionTask: SubtaskNode = {
        id: 'long-desc-with-time',
        description: 'This is a very long task description that would normally be truncated but now has elapsed time too',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:30:00Z')
      };

      mockUseElapsedTime.mockReturnValue('30m');

      render(<SubtaskTree task={longDescriptionTask} interactive={false} />);

      // Should show both truncated description and elapsed time
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument(); // Truncation indicator
      expect(screen.getByText('⏱ 30m')).toBeInTheDocument(); // Elapsed time
    });

    it('handles both progress and elapsed time with long descriptions', () => {
      const complexTask: SubtaskNode = {
        id: 'complex-long-desc',
        description: 'This is an extremely long task description that needs to be truncated when showing both progress and elapsed time indicators',
        status: 'in-progress',
        progress: 85,
        startedAt: new Date('2024-01-01T09:15:00Z')
      };

      mockUseElapsedTime.mockReturnValue('45m');

      render(<SubtaskTree task={complexTask} interactive={false} />);

      // Should show all three: truncated description, progress, and elapsed time
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('⏱ 45m')).toBeInTheDocument();
    });
  });

  describe('elapsed time real-time updates', () => {
    it('calls useElapsedTime with correct update interval', () => {
      const taskWithStartTime: SubtaskNode = {
        id: 'update-interval',
        description: 'Task with update interval',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:55:00Z')
      };

      mockUseElapsedTime.mockReturnValue('5m');

      render(<SubtaskTree task={taskWithStartTime} interactive={false} />);

      // Should call useElapsedTime with 1000ms interval
      expect(mockUseElapsedTime).toHaveBeenCalledWith(
        taskWithStartTime.startedAt,
        1000
      );
    });

    it('handles time updates correctly', () => {
      const taskWithStartTime: SubtaskNode = {
        id: 'time-updates',
        description: 'Task with time updates',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:58:00Z')
      };

      // Start with initial time
      mockUseElapsedTime.mockReturnValue('2m');

      const { rerender } = render(<SubtaskTree task={taskWithStartTime} interactive={false} />);

      expect(screen.getByText('⏱ 2m')).toBeInTheDocument();

      // Simulate time update
      mockUseElapsedTime.mockReturnValue('2m 30s');

      rerender(<SubtaskTree task={taskWithStartTime} interactive={false} />);

      expect(screen.getByText('⏱ 2m 30s')).toBeInTheDocument();
    });
  });

  describe('elapsed time accessibility', () => {
    it('provides accessible elapsed time information', () => {
      const taskWithTime: SubtaskNode = {
        id: 'accessible-time',
        description: 'Accessible time task',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:40:00Z')
      };

      mockUseElapsedTime.mockReturnValue('20m');

      render(<SubtaskTree task={taskWithTime} interactive={false} />);

      // Elapsed time should be accessible with clear text and icon
      expect(screen.getByText('⏱ 20m')).toBeInTheDocument();
    });

    it('maintains accessibility when elapsed time is hidden', () => {
      const taskWithHiddenTime: SubtaskNode = {
        id: 'hidden-accessible-time',
        description: 'Task with hidden elapsed time',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:30:00Z')
      };

      mockUseElapsedTime.mockReturnValue('30m');

      render(
        <SubtaskTree
          task={taskWithHiddenTime}
          showElapsedTime={false}
          interactive={false}
        />
      );

      // Task description should still be accessible
      expect(screen.getByText('Task with hidden elapsed time')).toBeInTheDocument();

      // Time info should not interfere with accessibility
      expect(screen.queryByText('⏱')).not.toBeInTheDocument();
    });
  });

  describe('elapsed time edge cases with dates', () => {
    it('handles future startedAt dates gracefully', () => {
      const taskWithFutureTime: SubtaskNode = {
        id: 'future-time',
        description: 'Task with future start time',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T11:00:00Z') // 1 hour in the future
      };

      mockUseElapsedTime.mockReturnValue('-1h'); // Hook might return negative time

      render(<SubtaskTree task={taskWithFutureTime} interactive={false} />);

      expect(screen.getByText('⏱ -1h')).toBeInTheDocument();
    });

    it('handles invalid date objects', () => {
      const taskWithInvalidDate: SubtaskNode = {
        id: 'invalid-date',
        description: 'Task with invalid date',
        status: 'in-progress',
        startedAt: new Date('invalid-date-string')
      };

      mockUseElapsedTime.mockReturnValue('???');

      render(<SubtaskTree task={taskWithInvalidDate} interactive={false} />);

      // Should handle gracefully without crashing
      expect(screen.getByText('Task with invalid date')).toBeInTheDocument();

      // useElapsedTime should be called even with invalid date
      expect(mockUseElapsedTime).toHaveBeenCalledWith(
        taskWithInvalidDate.startedAt,
        1000
      );
    });

    it('handles very old start dates', () => {
      const taskWithOldDate: SubtaskNode = {
        id: 'old-date',
        description: 'Task with very old start date',
        status: 'in-progress',
        startedAt: new Date('2023-01-01T10:00:00Z') // 1 year ago
      };

      mockUseElapsedTime.mockReturnValue('1y');

      render(<SubtaskTree task={taskWithOldDate} interactive={false} />);

      expect(screen.getByText('⏱ 1y')).toBeInTheDocument();
    });
  });
});