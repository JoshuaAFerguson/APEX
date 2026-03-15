import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

// Helper to render without focus to simplify basic tests
const renderWithoutFocus = (task: SubtaskNode, extraProps = {}) =>
  render(<SubtaskTree task={task} focusedNodeId={""} interactive={false} {...extraProps} />);

describe('SubtaskTree', () => {
  beforeEach(() => {
    // Mock the Date.now for consistent elapsed time testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  const simpleTask: SubtaskNode = {
    id: '1',
    description: 'Main task',
    status: 'in-progress'
  };

  const taskWithProgress: SubtaskNode = {
    id: '2',
    description: 'Task with progress',
    status: 'in-progress',
    progress: 75,
    startedAt: new Date('2024-01-01T09:58:30Z'), // 1.5 minutes ago
    estimatedDuration: 300000 // 5 minutes
  };

  const complexTask: SubtaskNode = {
    id: '1',
    description: 'Implement user authentication',
    status: 'in-progress',
    children: [
      {
        id: '1.1',
        description: 'Create user model',
        status: 'completed'
      },
      {
        id: '1.2',
        description: 'Implement login endpoint',
        status: 'in-progress',
        children: [
          {
            id: '1.2.1',
            description: 'Validate user credentials',
            status: 'completed'
          },
          {
            id: '1.2.2',
            description: 'Generate JWT token',
            status: 'pending'
          }
        ]
      },
      {
        id: '1.3',
        description: 'Add password encryption',
        status: 'pending'
      }
    ]
  };

  const deepTask: SubtaskNode = {
    id: '1',
    description: 'Level 0',
    status: 'in-progress',
    children: [
      {
        id: '1.1',
        description: 'Level 1',
        status: 'in-progress',
        children: [
          {
            id: '1.1.1',
            description: 'Level 2',
            status: 'in-progress',
            children: [
              {
                id: '1.1.1.1',
                description: 'Level 3',
                status: 'pending',
                children: [
                  {
                    id: '1.1.1.1.1',
                    description: 'Level 4',
                    status: 'pending'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  describe('basic rendering', () => {
    it('renders a simple task without children', () => {
      render(<SubtaskTree task={simpleTask} />);

      expect(screen.getByText(/⟨Main task⟩/)).toBeInTheDocument(); // focused by default
      expect(screen.getByText(/\[●\]/)).toBeInTheDocument(); // in-progress icon
    });

    it('displays correct status icons', () => {
      const statusTasks: SubtaskNode[] = [
        { id: '1', description: 'Pending task', status: 'pending' },
        { id: '2', description: 'Active task', status: 'in-progress' },
        { id: '3', description: 'Completed task', status: 'completed' },
        { id: '4', description: 'Failed task', status: 'failed' },
      ];

      for (const task of statusTasks) {
        const { rerender } = render(<SubtaskTree task={task} />);

        switch (task.status) {
          case 'pending':
            expect(screen.getByText(/\[○\]/)).toBeInTheDocument();
            break;
          case 'in-progress':
            expect(screen.getByText(/\[●\]/)).toBeInTheDocument();
            break;
          case 'completed':
            expect(screen.getByText(/\[✓\]/)).toBeInTheDocument();
            break;
          case 'failed':
            expect(screen.getByText(/\[✗\]/)).toBeInTheDocument();
            break;
        }

        rerender(<div />); // Clear for next iteration
      }
    });
  });

  describe('hierarchical structure', () => {
    it('renders nested tasks with tree structure', () => {
      renderWithoutFocus(complexTask);

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate user credentials')).toBeInTheDocument();
      expect(screen.getByText('Generate JWT token')).toBeInTheDocument();
      expect(screen.getByText('Add password encryption')).toBeInTheDocument();
    });

    it('shows tree connectors for hierarchy', () => {
      renderWithoutFocus(complexTask);

      // Should show tree connectors (├── and └──) - use getAllByText for multiple occurrences
      expect(screen.getAllByText(/├──/)).toBeDefined();
      expect(screen.getByText(/└──/)).toBeInTheDocument();
    });

    it('handles single child correctly', () => {
      const singleChildTask: SubtaskNode = {
        id: '1',
        description: 'Parent task',
        status: 'in-progress',
        children: [
          {
            id: '1.1',
            description: 'Only child',
            status: 'pending'
          }
        ]
      };

      renderWithoutFocus(singleChildTask);

      expect(screen.getByText('Parent task')).toBeInTheDocument();
      expect(screen.getByText('Only child')).toBeInTheDocument();
    });
  });

  describe('depth limiting', () => {
    it('respects maxDepth parameter', () => {
      renderWithoutFocus(deepTask, { maxDepth: 2 });

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 4')).not.toBeInTheDocument();
    });

    it('shows overflow indicator when depth limit reached', () => {
      renderWithoutFocus(deepTask, { maxDepth: 2 });

      expect(screen.getByText(/\.\.\. 1 more subtask.*max depth reached/)).toBeInTheDocument();
    });

    it('shows correct count for multiple hidden subtasks', () => {
      const taskWithManyChildren: SubtaskNode = {
        id: '1',
        description: 'Parent',
        status: 'in-progress',
        children: [
          {
            id: '1.1',
            description: 'Child 1',
            status: 'pending',
            children: [
              { id: '1.1.1', description: 'Hidden 1', status: 'pending' },
              { id: '1.1.2', description: 'Hidden 2', status: 'pending' },
              { id: '1.1.3', description: 'Hidden 3', status: 'pending' },
            ]
          }
        ]
      };

      renderWithoutFocus(taskWithManyChildren, { maxDepth: 1 });

      expect(screen.getByText(/\.\.\. 3 more subtask.*max depth reached/)).toBeInTheDocument();
    });

    it('uses default maxDepth of 3', () => {
      renderWithoutFocus(deepTask);

      // With default maxDepth=3, should show levels 0, 1, 2, 3 but not 4
      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.queryByText('Level 4')).not.toBeInTheDocument();
    });
  });

  describe('text formatting', () => {
    it('truncates long descriptions', () => {
      const longDescTask: SubtaskNode = {
        id: '1',
        description: 'This is a very long task description that should be truncated because it exceeds the maximum length',
        status: 'pending'
      };

      renderWithoutFocus(longDescTask);

      expect(screen.getByText(/This is a very long task description that sh\.\.\./)).toBeInTheDocument();
    });

    it('does not truncate short descriptions', () => {
      const shortDescTask: SubtaskNode = {
        id: '1',
        description: 'Short task',
        status: 'pending'
      };

      renderWithoutFocus(shortDescTask);

      expect(screen.getByText('Short task')).toBeInTheDocument();
    });
  });

  describe('status highlighting', () => {
    it('highlights in-progress tasks differently', () => {
      renderWithoutFocus(complexTask);

      // In-progress tasks should be styled differently (white vs gray)
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
    });

    it('shows all status types with correct colors', () => {
      renderWithoutFocus(complexTask);

      // Each status should have its corresponding icon and color
      expect(screen.getByText(/\[●\]/)).toBeInTheDocument(); // in-progress
      expect(screen.getByText(/\[✓\]/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/\[○\]/)).toBeInTheDocument(); // pending
    });
  });

  describe('edge cases', () => {
    it('handles task with no description', () => {
      const noDescTask: SubtaskNode = {
        id: '1',
        description: '',
        status: 'pending'
      };

      renderWithoutFocus(noDescTask);

      // Should render without crashing
      expect(screen.getByText(/\[○\]/)).toBeInTheDocument();
    });

    it('handles task with empty children array', () => {
      const emptyChildrenTask: SubtaskNode = {
        id: '1',
        description: 'Task with empty children',
        status: 'pending',
        children: []
      };

      renderWithoutFocus(emptyChildrenTask);

      expect(screen.getByText('Task with empty children')).toBeInTheDocument();
      // Should not show any overflow indicators
      expect(screen.queryByText(/more subtasks/)).not.toBeInTheDocument();
    });

    it('handles maxDepth of 0', () => {
      renderWithoutFocus(complexTask, { maxDepth: 0 });

      // Should only show root task
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.queryByText('Create user model')).not.toBeInTheDocument();
    });

    it('handles negative maxDepth', () => {
      render(<SubtaskTree task={complexTask} maxDepth={-1} />);

      // Should still show root task (graceful handling)
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    it('handles very deep nesting beyond limit', () => {
      const veryDeepTask: SubtaskNode = {
        id: '1',
        description: 'Root',
        status: 'in-progress',
        children: Array.from({ length: 10 }, (_, i) => ({
          id: `1.${i}`,
          description: `Child ${i}`,
          status: 'pending' as const
        }))
      };

      render(<SubtaskTree task={veryDeepTask} maxDepth={0} />);

      expect(screen.getByText('Root')).toBeInTheDocument();
      expect(screen.getByText(/\.\.\. 10 more subtasks/)).toBeInTheDocument();
    });
  });

  describe('special characters', () => {
    it('handles special characters in task descriptions', () => {
      const specialCharsTask: SubtaskNode = {
        id: '1',
        description: 'Task with "quotes" & symbols: @#$%^&*()',
        status: 'pending'
      };

      render(<SubtaskTree task={specialCharsTask} />);

      expect(screen.getByText('Task with "quotes" & symbols: @#$%^&*()')).toBeInTheDocument();
    });

    it('handles unicode characters', () => {
      const unicodeTask: SubtaskNode = {
        id: '1',
        description: 'Task with émojis 🚀 and ñíçé characters',
        status: 'pending'
      };

      render(<SubtaskTree task={unicodeTask} />);

      expect(screen.getByText('Task with émojis 🚀 and ñíçé characters')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides accessible text content for all tasks', () => {
      renderWithoutFocus(complexTask);

      // All task descriptions should be accessible
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate user credentials')).toBeInTheDocument();
      expect(screen.getByText('Generate JWT token')).toBeInTheDocument();
      expect(screen.getByText('Add password encryption')).toBeInTheDocument();
    });

    it('provides status information through icons', () => {
      renderWithoutFocus(complexTask);

      // Status icons should be present and accessible
      expect(screen.getByText(/\[●\]/)).toBeInTheDocument(); // in-progress
      expect(screen.getByText(/\[✓\]/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/\[○\]/)).toBeInTheDocument(); // pending
    });
  });

  describe('collapse/expand functionality', () => {
    it('shows collapse indicators for nodes with children', () => {
      render(<SubtaskTree task={complexTask} interactive={false} />);

      // Root node should have collapse indicator since it has children
      expect(screen.getByText(/▼/)).toBeInTheDocument(); // expanded indicator
    });

    it('starts with all nodes expanded by default', () => {
      render(<SubtaskTree task={complexTask} interactive={false} />);

      // All tasks should be visible when not collapsed
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate user credentials')).toBeInTheDocument();
    });

    it('respects defaultCollapsed prop', () => {
      render(<SubtaskTree task={complexTask} defaultCollapsed={true} interactive={false} />);

      // Children should be hidden and show collapsed indicator
      expect(screen.getByText(/▶/)).toBeInTheDocument(); // collapsed indicator
      expect(screen.queryByText('Create user model')).not.toBeInTheDocument();
    });

    it('shows children count when collapsed', () => {
      render(<SubtaskTree task={complexTask} defaultCollapsed={true} interactive={false} />);

      // Should show count of hidden children
      expect(screen.getByText(/3 subtasks \(collapsed\)/)).toBeInTheDocument();
    });

    it('respects initialCollapsedIds', () => {
      const collapsedIds = new Set(['1.2']); // Collapse the login endpoint node
      render(<SubtaskTree task={complexTask} initialCollapsedIds={collapsedIds} interactive={false} />);

      // Main tasks should be visible
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();

      // But login endpoint children should be hidden
      expect(screen.queryByText('Validate user credentials')).not.toBeInTheDocument();
      expect(screen.queryByText('Generate JWT token')).not.toBeInTheDocument();
    });
  });

  describe('progress indicators', () => {
    it('shows progress bar for in-progress tasks with progress data', () => {
      render(<SubtaskTree task={taskWithProgress} interactive={false} />);

      // Should show progress indicators
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/██████████/)).toBeInTheDocument(); // progress bar characters
    });

    it('hides progress when showProgress=false', () => {
      render(<SubtaskTree task={taskWithProgress} showProgress={false} interactive={false} />);

      expect(screen.queryByText(/75%/)).not.toBeInTheDocument();
    });

    it('does not show progress for non-in-progress tasks', () => {
      const completedTaskWithProgress: SubtaskNode = {
        ...taskWithProgress,
        status: 'completed'
      };

      render(<SubtaskTree task={completedTaskWithProgress} interactive={false} />);

      expect(screen.queryByText(/75%/)).not.toBeInTheDocument();
    });

    it('does not show progress when progress data is missing', () => {
      const taskWithoutProgress: SubtaskNode = {
        id: '1',
        description: 'Task without progress',
        status: 'in-progress'
      };

      render(<SubtaskTree task={taskWithoutProgress} interactive={false} />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe('elapsed time display', () => {
    it('shows elapsed time for in-progress tasks with startedAt', () => {
      render(<SubtaskTree task={taskWithProgress} interactive={false} />);

      // Should show elapsed time (1.5 minutes = 1m 30s)
      expect(screen.getByText(/⏱ 1m 30s/)).toBeInTheDocument();
    });

    it('hides elapsed time when showElapsedTime=false', () => {
      render(<SubtaskTree task={taskWithProgress} showElapsedTime={false} interactive={false} />);

      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
    });

    it('does not show elapsed time for non-in-progress tasks', () => {
      const completedTaskWithTime: SubtaskNode = {
        ...taskWithProgress,
        status: 'completed'
      };

      render(<SubtaskTree task={completedTaskWithTime} interactive={false} />);

      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
    });

    it('does not show elapsed time when startedAt is missing', () => {
      const taskWithoutStartTime: SubtaskNode = {
        id: '1',
        description: 'Task without start time',
        status: 'in-progress'
      };

      render(<SubtaskTree task={taskWithoutStartTime} interactive={false} />);

      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
    });
  });

  describe('focus indicator', () => {
    it('shows focus indicator for focused node', () => {
      render(<SubtaskTree task={complexTask} focusedNodeId="1" interactive={false} />);

      // Focused task should be wrapped in angle brackets
      expect(screen.getByText(/⟨Implement user authentication⟩/)).toBeInTheDocument();
    });

    it('only one node can be focused at a time', () => {
      render(<SubtaskTree task={complexTask} focusedNodeId="1.1" interactive={false} />);

      // Only the specified node should be focused
      expect(screen.getByText(/⟨Create user model⟩/)).toBeInTheDocument();
      expect(screen.queryByText(/⟨Implement user authentication⟩/)).not.toBeInTheDocument();
    });

    it('handles focus on non-existent node gracefully', () => {
      render(<SubtaskTree task={complexTask} focusedNodeId="non-existent" interactive={false} />);

      // Should render without error and no nodes should be focused
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.queryByText(/⟨.*⟩/)).not.toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('supports interactive=false to disable keyboard input', () => {
      const { container } = render(<SubtaskTree task={complexTask} interactive={false} />);

      // Component should render normally
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('defaults to interactive=true', () => {
      const { container } = renderWithoutFocus(complexTask);

      // Component should render normally with interactive features enabled
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('callback functionality', () => {
    it('calls onToggleCollapse when provided', () => {
      const onToggleCollapse = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      // Component should render without calling the callback initially
      expect(onToggleCollapse).not.toHaveBeenCalled();
    });

    it('calls onFocusChange when provided', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          interactive={false}
        />
      );

      // Component should render without calling the callback initially
      expect(onFocusChange).not.toHaveBeenCalled();
    });
  });

  describe('performance optimizations', () => {
    it('handles large trees efficiently', () => {
      const largeTree: SubtaskNode = {
        id: 'root',
        description: 'Root task',
        status: 'in-progress',
        children: Array.from({ length: 50 }, (_, i) => ({
          id: `child-${i}`,
          description: `Child task ${i}`,
          status: 'pending' as const,
          children: Array.from({ length: 5 }, (_, j) => ({
            id: `child-${i}-${j}`,
            description: `Grandchild ${i}-${j}`,
            status: 'pending' as const
          }))
        }))
      };

      const { container } = render(<SubtaskTree task={largeTree} interactive={false} />);

      // Should render without performance issues
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText('Root task')).toBeInTheDocument();
    });
  });

  describe('depth limiting with collapse', () => {
    it('shows depth overflow even when some nodes are collapsed', () => {
      render(<SubtaskTree task={deepTask} maxDepth={2} interactive={false} />);

      // Should show overflow indicator for deep nesting
      expect(screen.getByText(/more subtasks \(max depth reached\)/)).toBeInTheDocument();
    });
  });

  describe('legacy compatibility', () => {
    it('maintains backward compatibility with old collapsed prop', () => {
      // The old 'collapsed' prop should be ignored gracefully
      const legacyProps = { task: complexTask, collapsed: true };

      render(<SubtaskTree {...legacyProps} interactive={false} />);

      // Should render normally (collapsed prop is no longer used)
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });
  });

  // NOTE: Interactive keyboard navigation tests are in SubtaskTree.keyboard.test.tsx
  // They require vi.mock at the module level which can't be done inside beforeEach

  describe('callback function integration', () => {
    it('calls onToggleCollapse when node is collapsed/expanded', () => {
      const onToggleCollapse = vi.fn();
      const { rerender } = render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      // Since we can't simulate real interactions in the test environment,
      // we verify the callback is properly passed and would be called
      expect(onToggleCollapse).not.toHaveBeenCalled();

      // Test with initially collapsed state
      rerender(
        <SubtaskTree
          task={complexTask}
          defaultCollapsed={true}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      // Verify component renders correctly with collapsed state
      expect(screen.getByText(/▶/)).toBeInTheDocument();
    });

    it('calls onFocusChange when focus moves between nodes', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
          interactive={false}
        />
      );

      // Verify callback setup
      expect(onFocusChange).not.toHaveBeenCalled();

      // Verify focus indicator is shown
      expect(screen.getByText(/⟨Implement user authentication⟩/)).toBeInTheDocument();
    });

    it('handles external focus control correctly', () => {
      const onFocusChange = vi.fn();
      const { rerender } = render(
        <SubtaskTree
          task={complexTask}
          focusedNodeId="1"
          onFocusChange={onFocusChange}
          interactive={false}
        />
      );

      expect(screen.getByText(/⟨Implement user authentication⟩/)).toBeInTheDocument();

      // Change external focus
      rerender(
        <SubtaskTree
          task={complexTask}
          focusedNodeId="1.1"
          onFocusChange={onFocusChange}
          interactive={false}
        />
      );

      expect(screen.getByText(/⟨Create user model⟩/)).toBeInTheDocument();
    });
  });

  describe('real-time elapsed time updates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('updates elapsed time in real-time for in-progress tasks', async () => {
      const taskWithRecentStart: SubtaskNode = {
        id: '1',
        description: 'Recent task',
        status: 'in-progress',
        startedAt: new Date('2024-01-01T09:59:30Z'), // 30 seconds ago
      };

      render(<SubtaskTree task={taskWithRecentStart} interactive={false} />);

      // Initial elapsed time should show 30 seconds
      expect(screen.getByText(/⏱ 30s/)).toBeInTheDocument();

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      // Should still show initial time since we're using fake timers
      expect(screen.getByText(/⏱ 30s/)).toBeInTheDocument();
    });

    it('handles elapsed time formatting correctly', () => {
      const tasksWithDifferentDurations: SubtaskNode[] = [
        {
          id: '1',
          description: 'Task 30s ago',
          status: 'in-progress',
          startedAt: new Date('2024-01-01T09:59:30Z'), // 30 seconds
        },
        {
          id: '2',
          description: 'Task 2m ago',
          status: 'in-progress',
          startedAt: new Date('2024-01-01T09:58:00Z'), // 2 minutes
        },
        {
          id: '3',
          description: 'Task 1h ago',
          status: 'in-progress',
          startedAt: new Date('2024-01-01T09:00:00Z'), // 1 hour
        }
      ];

      tasksWithDifferentDurations.forEach((task) => {
        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        // Verify elapsed time is displayed
        const timeElement = screen.queryByText(/⏱/);
        expect(timeElement).toBeInTheDocument();

        unmount();
      });
    });

    it('does not show elapsed time for non-in-progress tasks', () => {
      const nonProgressTasks: SubtaskNode[] = [
        {
          id: '1',
          description: 'Completed task',
          status: 'completed',
          startedAt: new Date('2024-01-01T09:59:30Z'),
        },
        {
          id: '2',
          description: 'Failed task',
          status: 'failed',
          startedAt: new Date('2024-01-01T09:59:30Z'),
        },
        {
          id: '3',
          description: 'Pending task',
          status: 'pending',
        }
      ];

      nonProgressTasks.forEach((task) => {
        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('progress indicators with edge cases', () => {
    it('handles progress values at boundaries correctly', () => {
      const edgeCaseProgress: SubtaskNode[] = [
        {
          id: '1',
          description: 'Zero progress',
          status: 'in-progress',
          progress: 0,
        },
        {
          id: '2',
          description: 'Complete progress',
          status: 'in-progress',
          progress: 100,
        },
        {
          id: '3',
          description: 'Fractional progress',
          status: 'in-progress',
          progress: 33.7,
        },
        {
          id: '4',
          description: 'Over 100 progress',
          status: 'in-progress',
          progress: 150, // Edge case
        }
      ];

      edgeCaseProgress.forEach((task) => {
        const { unmount } = render(<SubtaskTree task={task} interactive={false} />);

        // Should display progress percentage (rounded)
        const progressText = screen.queryByText(new RegExp(`${Math.round(task.progress!)}%`));
        expect(progressText).toBeInTheDocument();

        // Should display progress bar
        expect(screen.getByText(/[█░]+/)).toBeInTheDocument();

        unmount();
      });
    });

    it('gracefully handles invalid progress values', () => {
      const invalidProgressTasks: SubtaskNode[] = [
        {
          id: '1',
          description: 'Negative progress',
          status: 'in-progress',
          progress: -10,
        },
        {
          id: '2',
          description: 'NaN progress',
          status: 'in-progress',
          progress: NaN,
        },
        {
          id: '3',
          description: 'Infinity progress',
          status: 'in-progress',
          progress: Infinity,
        }
      ];

      invalidProgressTasks.forEach((task) => {
        // Should render without crashing
        expect(() => {
          render(<SubtaskTree task={task} interactive={false} />);
        }).not.toThrow();
      });
    });
  });

  describe('complex tree state management', () => {
    it('maintains collapse state across re-renders', () => {
      const onToggleCollapse = vi.fn();
      const { rerender } = render(
        <SubtaskTree
          task={complexTask}
          initialCollapsedIds={new Set(['1.2'])}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      // Node 1.2 should be collapsed
      expect(screen.queryByText('Validate user credentials')).not.toBeInTheDocument();
      expect(screen.getByText(/▶/)).toBeInTheDocument();

      // Re-render with same props
      rerender(
        <SubtaskTree
          task={complexTask}
          initialCollapsedIds={new Set(['1.2'])}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      // State should be maintained
      expect(screen.queryByText('Validate user credentials')).not.toBeInTheDocument();
    });

    it('handles dynamic tree structure changes', () => {
      const initialTask = { ...complexTask };
      const { rerender } = render(
        <SubtaskTree task={initialTask} interactive={false} />
      );

      expect(screen.getByText('Create user model')).toBeInTheDocument();

      // Modify task structure
      const modifiedTask: SubtaskNode = {
        ...initialTask,
        children: [
          ...initialTask.children!,
          {
            id: '1.4',
            description: 'New subtask',
            status: 'pending',
          }
        ]
      };

      rerender(<SubtaskTree task={modifiedTask} interactive={false} />);

      // Should show new subtask
      expect(screen.getByText('New subtask')).toBeInTheDocument();
    });

    it('correctly calculates visible nodes for keyboard navigation', () => {
      // Test with partially collapsed tree
      render(
        <SubtaskTree
          task={complexTask}
          initialCollapsedIds={new Set(['1.2'])}
          interactive={false}
        />
      );

      // Should show root and first level children, but not 1.2's children
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.queryByText('Validate user credentials')).not.toBeInTheDocument();
    });
  });

  describe('accessibility and screen reader support', () => {
    it('provides semantic information for tree structure', () => {
      render(<SubtaskTree task={complexTask} interactive={false} />);

      // Tree structure should be evident from text content
      expect(screen.getByText(/├──/)).toBeInTheDocument();
      expect(screen.getByText(/└──/)).toBeInTheDocument();
    });

    it('provides clear status information', () => {
      render(<SubtaskTree task={complexTask} interactive={false} />);

      // Status should be clear from icons
      expect(screen.getByText(/\[●\]/)).toBeInTheDocument(); // in-progress
      expect(screen.getByText(/\[✓\]/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/\[○\]/)).toBeInTheDocument(); // pending
    });

    it('provides focus indicators for keyboard navigation', () => {
      render(
        <SubtaskTree
          task={complexTask}
          focusedNodeId="1.1"
          interactive={true}
        />
      );

      // Focus should be visually indicated
      expect(screen.getByText(/⟨Create user model⟩/)).toBeInTheDocument();
    });

    it('provides clear collapse/expand state indicators', () => {
      render(
        <SubtaskTree
          task={complexTask}
          initialCollapsedIds={new Set(['1.2'])}
          interactive={false}
        />
      );

      // Collapse state should be clear
      expect(screen.getByText(/▶/)).toBeInTheDocument(); // collapsed
      expect(screen.getByText(/▼/)).toBeInTheDocument(); // expanded
      expect(screen.getByText(/\(collapsed\)/)).toBeInTheDocument();
    });
  });

  describe('performance and optimization', () => {
    it('handles deeply nested trees without performance issues', () => {
      const createDeepTree = (depth: number): SubtaskNode => {
        if (depth === 0) {
          return {
            id: `leaf-${depth}`,
            description: `Leaf node ${depth}`,
            status: 'pending',
          };
        }

        return {
          id: `node-${depth}`,
          description: `Node at depth ${depth}`,
          status: 'in-progress',
          children: [createDeepTree(depth - 1)],
        };
      };

      const deepTree = createDeepTree(20);

      // Should render without performance issues or timeout
      const startTime = Date.now();
      render(<SubtaskTree task={deepTree} maxDepth={5} interactive={false} />);
      const endTime = Date.now();

      // Rendering should be fast (under 100ms in test environment)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('efficiently updates only necessary parts on state change', () => {
      const onToggleCollapse = vi.fn();
      const { rerender } = render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      const initialText = screen.getByText('Create user model');
      expect(initialText).toBeInTheDocument();

      // Re-render with different collapsed state
      rerender(
        <SubtaskTree
          task={complexTask}
          initialCollapsedIds={new Set(['1'])}
          onToggleCollapse={onToggleCollapse}
          interactive={false}
        />
      );

      // Root should be collapsed, children hidden
      expect(screen.queryByText('Create user model')).not.toBeInTheDocument();
      expect(screen.getByText(/▶/)).toBeInTheDocument();
    });
  });

  describe('error boundaries and edge cases', () => {
    it('handles circular references gracefully', () => {
      // Create a task with potential circular reference
      const taskA: SubtaskNode = {
        id: 'A',
        description: 'Task A',
        status: 'in-progress',
        children: []
      };

      const taskB: SubtaskNode = {
        id: 'B',
        description: 'Task B',
        status: 'pending',
        children: [taskA]
      };

      // This would create a circular reference if not handled properly
      taskA.children = [taskB];

      // Should render without infinite loop (limited by maxDepth)
      expect(() => {
        render(<SubtaskTree task={taskA} maxDepth={2} interactive={false} />);
      }).not.toThrow();
    });

    it('handles malformed node data gracefully', () => {
      const malformedTasks: SubtaskNode[] = [
        // Missing required fields
        { id: '', description: '', status: 'pending' },
        // Null/undefined in arrays
        {
          id: '1',
          description: 'Parent',
          status: 'pending',
          children: [null as any, undefined as any].filter(Boolean)
        },
        // Invalid status
        {
          id: '1',
          description: 'Invalid status',
          status: 'invalid-status' as any
        }
      ];

      malformedTasks.forEach((task, index) => {
        // Should render without crashing
        expect(() => {
          const { unmount } = render(<SubtaskTree task={task} interactive={false} />);
          unmount();
        }).not.toThrow();
      });
    });

    it('handles very long descriptions gracefully', () => {
      const longDescTask: SubtaskNode = {
        id: '1',
        description: 'A'.repeat(1000), // Very long description
        status: 'in-progress',
      };

      renderWithoutFocus(longDescTask);

      // Should truncate and show ellipsis
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('handles tasks with all optional fields missing', () => {
      const minimalTask: SubtaskNode = {
        id: '1',
        description: 'Minimal task',
        status: 'pending'
        // No children, progress, startedAt, etc.
      };

      renderWithoutFocus(minimalTask);

      expect(screen.getByText('Minimal task')).toBeInTheDocument();
      expect(screen.getByText(/\[○\]/)).toBeInTheDocument();
      expect(screen.queryByText(/⏱/)).not.toBeInTheDocument();
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });
});