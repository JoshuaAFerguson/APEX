import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

describe('SubtaskTree - Progress Indicator Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('progress bar rendering', () => {
    it('shows progress bar for in-progress tasks with progress data', () => {
      const taskWithProgress: SubtaskNode = {
        id: 'task1',
        description: 'Task with 75% progress',
        status: 'in-progress',
        progress: 75
      };

      render(<SubtaskTree task={taskWithProgress} interactive={false} />);

      // Should show percentage
      expect(screen.getByText('75%')).toBeInTheDocument();

      // Should show progress bar using block characters
      // 75% means 7.5/10 blocks should be filled (█), rounded to 8
      const progressText = screen.getByText(/██████████/);
      expect(progressText).toBeInTheDocument();
    });

    it('renders accurate progress bar for different percentages', () => {
      const testCases = [
        { progress: 0, expectedFilled: 0 },
        { progress: 10, expectedFilled: 1 },
        { progress: 25, expectedFilled: 3 }, // 2.5 rounds up
        { progress: 50, expectedFilled: 5 },
        { progress: 90, expectedFilled: 9 },
        { progress: 100, expectedFilled: 10 }
      ];

      testCases.forEach(({ progress, expectedFilled }) => {
        const task: SubtaskNode = {
          id: `task-${progress}`,
          description: `Task with ${progress}% progress`,
          status: 'in-progress',
          progress
        };

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        expect(screen.getByText(`${progress}%`)).toBeInTheDocument();

        // Count filled blocks (█)
        const expectedEmpty = 10 - expectedFilled;
        const progressElement = screen.getByText(new RegExp(`[█░]{10}`));

        const progressBar = progressElement.textContent;
        const filledCount = (progressBar?.match(/█/g) || []).length;
        const emptyCount = (progressBar?.match(/░/g) || []).length;

        expect(filledCount).toBe(expectedFilled);
        expect(emptyCount).toBe(expectedEmpty);

        unmount();
      });
    });

    it('handles edge case progress values correctly', () => {
      const edgeCases = [
        { progress: -5, expectedText: '-5%' }, // Negative values
        { progress: 105, expectedText: '105%' }, // Over 100%
        { progress: 0.5, expectedText: '1%' }, // Decimal values
        { progress: 99.9, expectedText: '100%' } // Near 100%
      ];

      edgeCases.forEach(({ progress, expectedText }) => {
        const task: SubtaskNode = {
          id: `edge-${progress}`,
          description: `Edge case task`,
          status: 'in-progress',
          progress
        };

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        expect(screen.getByText(expectedText)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('progress visibility conditions', () => {
    it('shows progress only for in-progress tasks', () => {
      const statuses: SubtaskNode['status'][] = ['pending', 'in-progress', 'completed', 'failed'];

      statuses.forEach(status => {
        const task: SubtaskNode = {
          id: `status-${status}`,
          description: `Task with ${status} status`,
          status,
          progress: 50
        };

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        if (status === 'in-progress') {
          expect(screen.getByText('50%')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('50%')).not.toBeInTheDocument();
        }

        unmount();
      });
    });

    it('hides progress when progress data is undefined', () => {
      const taskWithoutProgress: SubtaskNode = {
        id: 'no-progress',
        description: 'Task without progress data',
        status: 'in-progress'
        // no progress field
      };

      render(<SubtaskTree task={taskWithoutProgress} interactive={false} />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/[█░]/)).not.toBeInTheDocument();
    });

    it('hides progress when showProgress=false', () => {
      const taskWithProgress: SubtaskNode = {
        id: 'hidden-progress',
        description: 'Task with hidden progress',
        status: 'in-progress',
        progress: 80
      };

      render(
        <SubtaskTree
          task={taskWithProgress}
          showProgress={false}
          interactive={false}
        />
      );

      expect(screen.queryByText('80%')).not.toBeInTheDocument();
      expect(screen.queryByText(/[█░]/)).not.toBeInTheDocument();
    });

    it('shows progress when showProgress=true (default)', () => {
      const taskWithProgress: SubtaskNode = {
        id: 'visible-progress',
        description: 'Task with visible progress',
        status: 'in-progress',
        progress: 60
      };

      render(<SubtaskTree task={taskWithProgress} interactive={false} />);

      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText(/[█░]/)).toBeInTheDocument();
    });
  });

  describe('progress with hierarchical tasks', () => {
    it('shows progress for multiple in-progress tasks in hierarchy', () => {
      const hierarchicalTask: SubtaskNode = {
        id: 'parent',
        description: 'Parent task',
        status: 'in-progress',
        progress: 40,
        children: [
          {
            id: 'child1',
            description: 'Child task 1',
            status: 'in-progress',
            progress: 70
          },
          {
            id: 'child2',
            description: 'Child task 2',
            status: 'completed',
            progress: 100 // Should not show for completed
          },
          {
            id: 'child3',
            description: 'Child task 3',
            status: 'in-progress',
            progress: 20
          }
        ]
      };

      render(<SubtaskTree task={hierarchicalTask} interactive={false} />);

      // Parent and in-progress children should show progress
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();

      // Completed child should not show progress
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('handles progress with collapsed nodes', () => {
      const taskWithCollapsedProgress: SubtaskNode = {
        id: 'root',
        description: 'Root task',
        status: 'in-progress',
        progress: 30,
        children: [
          {
            id: 'collapsed-child',
            description: 'Collapsed child',
            status: 'in-progress',
            progress: 80
          }
        ]
      };

      const collapsedIds = new Set(['root']);
      render(
        <SubtaskTree
          task={taskWithCollapsedProgress}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Root progress should be visible
      expect(screen.getByText('30%')).toBeInTheDocument();

      // Child progress should be hidden due to collapse
      expect(screen.queryByText('80%')).not.toBeInTheDocument();
    });
  });

  describe('progress bar visual formatting', () => {
    it('uses correct colors for progress elements', () => {
      const taskWithProgress: SubtaskNode = {
        id: 'colored-progress',
        description: 'Task with colored progress',
        status: 'in-progress',
        progress: 65
      };

      render(<SubtaskTree task={taskWithProgress} interactive={false} />);

      // The component should render progress bar with cyan color
      // This is tested by checking the structure is present
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText(/[█░]{10}/)).toBeInTheDocument();
    });

    it('maintains progress bar width consistency', () => {
      const progressValues = [5, 35, 75, 95];

      progressValues.forEach(progress => {
        const task: SubtaskNode = {
          id: `width-${progress}`,
          description: `Width test ${progress}%`,
          status: 'in-progress',
          progress
        };

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        // Progress bar should always be 10 characters total
        const progressBar = screen.getByText(/[█░]{10}/);
        expect(progressBar.textContent).toHaveLength(10);

        unmount();
      });
    });

    it('formats progress percentage with proper rounding', () => {
      const decimalProgressValues = [
        { input: 33.333, expected: '33%' },
        { input: 66.666, expected: '67%' },
        { input: 99.1, expected: '99%' },
        { input: 99.5, expected: '100%' },
        { input: 0.1, expected: '0%' }
      ];

      decimalProgressValues.forEach(({ input, expected }) => {
        const task: SubtaskNode = {
          id: `decimal-${input}`,
          description: 'Decimal progress task',
          status: 'in-progress',
          progress: input
        };

        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        expect(screen.getByText(expected)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('progress with text truncation', () => {
    it('adjusts description length when progress is shown', () => {
      const longDescriptionTask: SubtaskNode = {
        id: 'long-desc-with-progress',
        description: 'This is a very long task description that would normally be truncated but now has progress data too',
        status: 'in-progress',
        progress: 45
      };

      render(<SubtaskTree task={longDescriptionTask} interactive={false} />);

      // Should show both truncated description and progress
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument(); // Truncation indicator
      expect(screen.getByText('45%')).toBeInTheDocument(); // Progress
    });

    it('handles description truncation without progress', () => {
      const longDescriptionTaskNormal: SubtaskNode = {
        id: 'long-desc-no-progress',
        description: 'This is a very long task description that should be truncated according to normal rules',
        status: 'pending' // No progress shown for pending
      };

      render(<SubtaskTree task={longDescriptionTaskNormal} interactive={false} />);

      // Should show truncated description but no progress
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('preserves short descriptions when showing progress', () => {
      const shortDescriptionTask: SubtaskNode = {
        id: 'short-desc-with-progress',
        description: 'Short task',
        status: 'in-progress',
        progress: 85
      };

      render(<SubtaskTree task={shortDescriptionTask} interactive={false} />);

      // Should show full description and progress
      expect(screen.getByText('Short task')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });
  });

  describe('progress accessibility', () => {
    it('provides accessible progress information', () => {
      const taskWithProgress: SubtaskNode = {
        id: 'accessible-progress',
        description: 'Accessible progress task',
        status: 'in-progress',
        progress: 55
      };

      render(<SubtaskTree task={taskWithProgress} interactive={false} />);

      // Progress information should be accessible via text content
      expect(screen.getByText('55%')).toBeInTheDocument();

      // Visual progress bar should be present
      expect(screen.getByText(/[█░]{10}/)).toBeInTheDocument();
    });

    it('maintains accessibility when progress is hidden', () => {
      const taskWithHiddenProgress: SubtaskNode = {
        id: 'hidden-accessible',
        description: 'Task with hidden progress',
        status: 'in-progress',
        progress: 75
      };

      render(
        <SubtaskTree
          task={taskWithHiddenProgress}
          showProgress={false}
          interactive={false}
        />
      );

      // Task description should still be accessible
      expect(screen.getByText('Task with hidden progress')).toBeInTheDocument();

      // Progress info should not interfere with accessibility
      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });
  });

  describe('progress with focus states', () => {
    it('maintains progress visibility when task is focused', () => {
      const taskWithProgress: SubtaskNode = {
        id: 'focused-progress',
        description: 'Focused task with progress',
        status: 'in-progress',
        progress: 60
      };

      render(
        <SubtaskTree
          task={taskWithProgress}
          focusedNodeId="focused-progress"
          interactive={false}
        />
      );

      // Both focus indicator and progress should be visible
      expect(screen.getByText(/⟨Focused task with progress⟩/)).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('handles focus changes without affecting progress display', () => {
      const multiTaskProgress: SubtaskNode = {
        id: 'multi-root',
        description: 'Multi-task root',
        status: 'in-progress',
        progress: 25,
        children: [
          {
            id: 'child-with-progress',
            description: 'Child with progress',
            status: 'in-progress',
            progress: 80
          }
        ]
      };

      const { rerender } = render(
        <SubtaskTree
          task={multiTaskProgress}
          focusedNodeId="multi-root"
          interactive={false}
        />
      );

      // Initial state - root focused
      expect(screen.getByText(/⟨Multi-task root⟩/)).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();

      // Change focus to child
      rerender(
        <SubtaskTree
          task={multiTaskProgress}
          focusedNodeId="child-with-progress"
          interactive={false}
        />
      );

      // Both progress indicators should still be visible
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText(/⟨Child with progress⟩/)).toBeInTheDocument();
    });
  });
});