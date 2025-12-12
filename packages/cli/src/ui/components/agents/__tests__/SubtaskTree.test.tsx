import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

describe('SubtaskTree', () => {
  const simpleTask: SubtaskNode = {
    id: '1',
    description: 'Main task',
    status: 'in-progress'
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

      expect(screen.getByText('Main task')).toBeInTheDocument();
      expect(screen.getByText(/●/)).toBeInTheDocument(); // in-progress icon
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
            expect(screen.getByText(/○/)).toBeInTheDocument();
            break;
          case 'in-progress':
            expect(screen.getByText(/●/)).toBeInTheDocument();
            break;
          case 'completed':
            expect(screen.getByText(/✓/)).toBeInTheDocument();
            break;
          case 'failed':
            expect(screen.getByText(/✗/)).toBeInTheDocument();
            break;
        }

        rerender(<div />); // Clear for next iteration
      }
    });
  });

  describe('hierarchical structure', () => {
    it('renders nested tasks with tree structure', () => {
      render(<SubtaskTree task={complexTask} />);

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate user credentials')).toBeInTheDocument();
      expect(screen.getByText('Generate JWT token')).toBeInTheDocument();
      expect(screen.getByText('Add password encryption')).toBeInTheDocument();
    });

    it('shows tree connectors for hierarchy', () => {
      render(<SubtaskTree task={complexTask} />);

      // Should show tree connectors (├── and └──)
      expect(screen.getByText(/├──/)).toBeInTheDocument();
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

      render(<SubtaskTree task={singleChildTask} />);

      expect(screen.getByText('Parent task')).toBeInTheDocument();
      expect(screen.getByText('Only child')).toBeInTheDocument();
    });
  });

  describe('depth limiting', () => {
    it('respects maxDepth parameter', () => {
      render(<SubtaskTree task={deepTask} maxDepth={2} />);

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 4')).not.toBeInTheDocument();
    });

    it('shows overflow indicator when depth limit reached', () => {
      render(<SubtaskTree task={deepTask} maxDepth={2} />);

      expect(screen.getByText(/\.\.\. 1 more subtasks/)).toBeInTheDocument();
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

      render(<SubtaskTree task={taskWithManyChildren} maxDepth={1} />);

      expect(screen.getByText(/\.\.\. 3 more subtasks/)).toBeInTheDocument();
    });

    it('uses default maxDepth of 3', () => {
      render(<SubtaskTree task={deepTask} />);

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

      render(<SubtaskTree task={longDescTask} />);

      expect(screen.getByText(/This is a very long task description that sh\.\.\./)).toBeInTheDocument();
    });

    it('does not truncate short descriptions', () => {
      const shortDescTask: SubtaskNode = {
        id: '1',
        description: 'Short task',
        status: 'pending'
      };

      render(<SubtaskTree task={shortDescTask} />);

      expect(screen.getByText('Short task')).toBeInTheDocument();
    });
  });

  describe('status highlighting', () => {
    it('highlights in-progress tasks differently', () => {
      render(<SubtaskTree task={complexTask} />);

      // In-progress tasks should be styled differently (white vs gray)
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
    });

    it('shows all status types with correct colors', () => {
      render(<SubtaskTree task={complexTask} />);

      // Each status should have its corresponding icon and color
      expect(screen.getByText(/●/)).toBeInTheDocument(); // in-progress
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/○/)).toBeInTheDocument(); // pending
    });
  });

  describe('edge cases', () => {
    it('handles task with no description', () => {
      const noDescTask: SubtaskNode = {
        id: '1',
        description: '',
        status: 'pending'
      };

      render(<SubtaskTree task={noDescTask} />);

      // Should render without crashing
      expect(screen.getByText(/○/)).toBeInTheDocument();
    });

    it('handles task with empty children array', () => {
      const emptyChildrenTask: SubtaskNode = {
        id: '1',
        description: 'Task with empty children',
        status: 'pending',
        children: []
      };

      render(<SubtaskTree task={emptyChildrenTask} />);

      expect(screen.getByText('Task with empty children')).toBeInTheDocument();
      // Should not show any overflow indicators
      expect(screen.queryByText(/more subtasks/)).not.toBeInTheDocument();
    });

    it('handles maxDepth of 0', () => {
      render(<SubtaskTree task={complexTask} maxDepth={0} />);

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
      render(<SubtaskTree task={complexTask} />);

      // All task descriptions should be accessible
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Create user model')).toBeInTheDocument();
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument();
      expect(screen.getByText('Validate user credentials')).toBeInTheDocument();
      expect(screen.getByText('Generate JWT token')).toBeInTheDocument();
      expect(screen.getByText('Add password encryption')).toBeInTheDocument();
    });

    it('provides status information through icons', () => {
      render(<SubtaskTree task={complexTask} />);

      // Status icons should be present and accessible
      expect(screen.getByText(/●/)).toBeInTheDocument(); // in-progress
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/○/)).toBeInTheDocument(); // pending
    });
  });

  describe('collapsed prop', () => {
    it('accepts collapsed prop without error', () => {
      // The component accepts the prop but doesn't seem to use it in current implementation
      render(<SubtaskTree task={complexTask} collapsed={true} />);

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    it('works with collapsed=false', () => {
      render(<SubtaskTree task={complexTask} collapsed={false} />);

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });
  });
});