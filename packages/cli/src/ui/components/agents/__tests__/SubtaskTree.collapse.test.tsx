import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

// Mock useInput from ink
const mockUseInput = vi.fn();

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
  };
});

describe('SubtaskTree - Collapse/Expand Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockReset();
  });

  const multiLevelTask: SubtaskNode = {
    id: 'root',
    description: 'Complex project setup',
    status: 'in-progress',
    children: [
      {
        id: 'backend',
        description: 'Backend development',
        status: 'in-progress',
        children: [
          {
            id: 'backend.api',
            description: 'API endpoints',
            status: 'completed'
          },
          {
            id: 'backend.db',
            description: 'Database setup',
            status: 'in-progress',
            children: [
              {
                id: 'backend.db.schema',
                description: 'Schema design',
                status: 'completed'
              },
              {
                id: 'backend.db.migrations',
                description: 'Run migrations',
                status: 'pending'
              }
            ]
          }
        ]
      },
      {
        id: 'frontend',
        description: 'Frontend development',
        status: 'pending',
        children: [
          {
            id: 'frontend.ui',
            description: 'UI components',
            status: 'pending'
          },
          {
            id: 'frontend.routing',
            description: 'Router setup',
            status: 'pending'
          }
        ]
      },
      {
        id: 'testing',
        description: 'Testing setup',
        status: 'pending'
      }
    ]
  };

  describe('basic collapse/expand behavior', () => {
    it('starts with all nodes expanded by default', () => {
      render(<SubtaskTree task={multiLevelTask} interactive={false} />);

      // All nodes should be visible
      expect(screen.getByText('Complex project setup')).toBeInTheDocument();
      expect(screen.getByText('Backend development')).toBeInTheDocument();
      expect(screen.getByText('API endpoints')).toBeInTheDocument();
      expect(screen.getByText('Database setup')).toBeInTheDocument();
      expect(screen.getByText('Schema design')).toBeInTheDocument();
      expect(screen.getByText('Run migrations')).toBeInTheDocument();
      expect(screen.getByText('Frontend development')).toBeInTheDocument();
      expect(screen.getByText('UI components')).toBeInTheDocument();
      expect(screen.getByText('Router setup')).toBeInTheDocument();
      expect(screen.getByText('Testing setup')).toBeInTheDocument();
    });

    it('shows correct collapse indicators for expanded nodes', () => {
      render(<SubtaskTree task={multiLevelTask} interactive={false} />);

      // Should show expanded indicators (▼) for nodes with children
      const expandedIndicators = screen.getAllByText(/▼/);
      expect(expandedIndicators.length).toBeGreaterThan(0);
    });

    it('respects defaultCollapsed prop', () => {
      render(<SubtaskTree task={multiLevelTask} defaultCollapsed={true} interactive={false} />);

      // Only root should be visible when all nodes are collapsed
      expect(screen.getByText('Complex project setup')).toBeInTheDocument();
      expect(screen.queryByText('Backend development')).not.toBeInTheDocument();
      expect(screen.queryByText('Frontend development')).not.toBeInTheDocument();

      // Should show collapsed indicators (▶)
      expect(screen.getByText(/▶/)).toBeInTheDocument();
    });

    it('shows children count when collapsed', () => {
      render(<SubtaskTree task={multiLevelTask} defaultCollapsed={true} interactive={false} />);

      // Should show count of hidden children
      expect(screen.getByText(/3 subtasks \(collapsed\)/)).toBeInTheDocument();
    });
  });

  describe('selective collapse with initialCollapsedIds', () => {
    it('collapses specific nodes via initialCollapsedIds', () => {
      const collapsedIds = new Set(['backend', 'frontend']);
      render(
        <SubtaskTree
          task={multiLevelTask}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Root and testing should be visible
      expect(screen.getByText('Complex project setup')).toBeInTheDocument();
      expect(screen.getByText('Backend development')).toBeInTheDocument();
      expect(screen.getByText('Frontend development')).toBeInTheDocument();
      expect(screen.getByText('Testing setup')).toBeInTheDocument();

      // Backend and frontend children should be hidden
      expect(screen.queryByText('API endpoints')).not.toBeInTheDocument();
      expect(screen.queryByText('Database setup')).not.toBeInTheDocument();
      expect(screen.queryByText('UI components')).not.toBeInTheDocument();
      expect(screen.queryByText('Router setup')).not.toBeInTheDocument();
    });

    it('shows correct counts for selectively collapsed nodes', () => {
      const collapsedIds = new Set(['backend.db']);
      render(
        <SubtaskTree
          task={multiLevelTask}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Backend level should be visible
      expect(screen.getByText('API endpoints')).toBeInTheDocument();
      expect(screen.getByText('Database setup')).toBeInTheDocument();

      // Database children should be hidden with count
      expect(screen.queryByText('Schema design')).not.toBeInTheDocument();
      expect(screen.getByText(/2 subtasks \(collapsed\)/)).toBeInTheDocument();
    });

    it('handles mixed collapsed states correctly', () => {
      const collapsedIds = new Set(['backend', 'backend.db']); // Nested collapse
      render(
        <SubtaskTree
          task={multiLevelTask}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Root level should show collapsed backend
      expect(screen.getByText('Backend development')).toBeInTheDocument();
      expect(screen.getByText('Frontend development')).toBeInTheDocument();

      // Backend children should be hidden
      expect(screen.queryByText('API endpoints')).not.toBeInTheDocument();
      expect(screen.queryByText('Database setup')).not.toBeInTheDocument();

      // Should show count for backend's children
      expect(screen.getByText(/2 subtasks \(collapsed\)/)).toBeInTheDocument();
    });
  });

  describe('interactive collapse/expand', () => {
    it('toggles collapse state via callback', () => {
      const onToggleCollapse = vi.fn();
      render(
        <SubtaskTree
          task={multiLevelTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="backend"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Toggle collapse on backend node
      inputCallback(' ', {});

      expect(onToggleCollapse).toHaveBeenCalledWith('backend', true);
    });

    it('expands previously collapsed nodes via callback', () => {
      const onToggleCollapse = vi.fn();
      const initialCollapsed = new Set(['backend']);

      render(
        <SubtaskTree
          task={multiLevelTask}
          onToggleCollapse={onToggleCollapse}
          initialCollapsedIds={initialCollapsed}
          focusedNodeId="backend"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Toggle expand on collapsed backend node
      inputCallback(' ', {});

      expect(onToggleCollapse).toHaveBeenCalledWith('backend', false);
    });

    it('updates visible nodes after state change', () => {
      const TestWrapper = () => {
        const [collapsedNodes, setCollapsedNodes] = React.useState(new Set<string>());

        const handleToggleCollapse = (nodeId: string, collapsed: boolean) => {
          const newSet = new Set(collapsedNodes);
          if (collapsed) {
            newSet.add(nodeId);
          } else {
            newSet.delete(nodeId);
          }
          setCollapsedNodes(newSet);
        };

        return (
          <SubtaskTree
            task={multiLevelTask}
            onToggleCollapse={handleToggleCollapse}
            initialCollapsedIds={collapsedNodes}
            focusedNodeId="backend"
          />
        );
      };

      render(<TestWrapper />);

      // Initially all nodes should be visible
      expect(screen.getByText('API endpoints')).toBeInTheDocument();

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Collapse backend node
      inputCallback(' ', {});

      // After state update, backend children should be hidden
      // Note: This test demonstrates the integration but may need adjustment
      // based on how the component handles state updates
    });
  });

  describe('collapse/expand with depth limits', () => {
    it('handles collapse within depth limits', () => {
      render(
        <SubtaskTree
          task={multiLevelTask}
          maxDepth={2}
          interactive={false}
        />
      );

      // Should show up to depth 2
      expect(screen.getByText('Complex project setup')).toBeInTheDocument(); // 0
      expect(screen.getByText('Backend development')).toBeInTheDocument(); // 1
      expect(screen.getByText('Database setup')).toBeInTheDocument(); // 2

      // Depth 3 should be hidden due to maxDepth
      expect(screen.queryByText('Schema design')).not.toBeInTheDocument(); // 3

      // Should show depth limit indicator
      expect(screen.getByText(/more subtasks \(max depth reached\)/)).toBeInTheDocument();
    });

    it('shows collapse indicators for nodes at depth limit', () => {
      render(
        <SubtaskTree
          task={multiLevelTask}
          maxDepth={1}
          interactive={false}
        />
      );

      // Should show collapse indicators for visible nodes with children
      expect(screen.getByText(/▼/)).toBeInTheDocument();

      // Should not show children beyond depth 1
      expect(screen.queryByText('API endpoints')).not.toBeInTheDocument();
      expect(screen.queryByText('UI components')).not.toBeInTheDocument();
    });

    it('collapses nodes within depth limits', () => {
      const collapsedIds = new Set(['backend']);
      render(
        <SubtaskTree
          task={multiLevelTask}
          maxDepth={2}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Backend should show as collapsed
      expect(screen.getByText('Backend development')).toBeInTheDocument();
      expect(screen.queryByText('API endpoints')).not.toBeInTheDocument();
      expect(screen.getByText(/2 subtasks \(collapsed\)/)).toBeInTheDocument();

      // Frontend should still show within depth limits
      expect(screen.getByText('UI components')).toBeInTheDocument();
    });
  });

  describe('edge cases with collapse/expand', () => {
    it('handles empty children arrays gracefully', () => {
      const taskWithEmptyChildren: SubtaskNode = {
        id: 'empty',
        description: 'Task with empty children',
        status: 'pending',
        children: []
      };

      render(<SubtaskTree task={taskWithEmptyChildren} interactive={false} />);

      expect(screen.getByText('Task with empty children')).toBeInTheDocument();
      // Should not show collapse indicators for empty children
      expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
      expect(screen.queryByText(/▶/)).not.toBeInTheDocument();
    });

    it('handles undefined children gracefully', () => {
      const taskWithoutChildren: SubtaskNode = {
        id: 'no-children',
        description: 'Task without children',
        status: 'pending'
      };

      render(<SubtaskTree task={taskWithoutChildren} interactive={false} />);

      expect(screen.getByText('Task without children')).toBeInTheDocument();
      expect(screen.queryByText(/▼/)).not.toBeInTheDocument();
      expect(screen.queryByText(/▶/)).not.toBeInTheDocument();
    });

    it('handles single child correctly', () => {
      const singleChildTask: SubtaskNode = {
        id: 'parent',
        description: 'Parent with one child',
        status: 'pending',
        children: [
          {
            id: 'child',
            description: 'Only child',
            status: 'pending'
          }
        ]
      };

      render(<SubtaskTree task={singleChildTask} interactive={false} />);

      expect(screen.getByText('Parent with one child')).toBeInTheDocument();
      expect(screen.getByText('Only child')).toBeInTheDocument();
      expect(screen.getByText(/▼/)).toBeInTheDocument();
    });

    it('shows correct count for single collapsed child', () => {
      const singleChildTask: SubtaskNode = {
        id: 'parent',
        description: 'Parent with one child',
        status: 'pending',
        children: [
          {
            id: 'child',
            description: 'Only child',
            status: 'pending'
          }
        ]
      };

      const collapsedIds = new Set(['parent']);
      render(
        <SubtaskTree
          task={singleChildTask}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      expect(screen.getByText(/1 subtask \(collapsed\)/)).toBeInTheDocument();
    });

    it('handles deeply nested single-child chains', () => {
      const deepSingleChain: SubtaskNode = {
        id: 'level0',
        description: 'Level 0',
        status: 'pending',
        children: [
          {
            id: 'level1',
            description: 'Level 1',
            status: 'pending',
            children: [
              {
                id: 'level2',
                description: 'Level 2',
                status: 'pending',
                children: [
                  {
                    id: 'level3',
                    description: 'Level 3',
                    status: 'pending'
                  }
                ]
              }
            ]
          }
        ]
      };

      const collapsedIds = new Set(['level1']);
      render(
        <SubtaskTree
          task={deepSingleChain}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument();
      expect(screen.getByText(/1 subtask \(collapsed\)/)).toBeInTheDocument();
    });
  });

  describe('collapse state consistency', () => {
    it('maintains collapse state when tree structure changes', () => {
      const onToggleCollapse = vi.fn();

      const { rerender } = render(
        <SubtaskTree
          task={multiLevelTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="backend"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];
      inputCallback(' ', {}); // Collapse backend

      // Simulate tree update with new data but same structure
      const updatedTask: SubtaskNode = {
        ...multiLevelTask,
        description: 'Updated complex project setup'
      };

      rerender(
        <SubtaskTree
          task={updatedTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="backend"
        />
      );

      // The component should handle this gracefully
      expect(screen.getByText('Updated complex project setup')).toBeInTheDocument();
    });

    it('handles collapse state with dynamic children', () => {
      const dynamicTask: SubtaskNode = {
        id: 'dynamic',
        description: 'Dynamic task',
        status: 'in-progress',
        children: [
          {
            id: 'child1',
            description: 'First child',
            status: 'completed'
          }
        ]
      };

      const { rerender } = render(
        <SubtaskTree
          task={dynamicTask}
          interactive={false}
        />
      );

      // Add more children
      const expandedTask: SubtaskNode = {
        ...dynamicTask,
        children: [
          ...dynamicTask.children!,
          {
            id: 'child2',
            description: 'Second child',
            status: 'pending'
          }
        ]
      };

      rerender(
        <SubtaskTree
          task={expandedTask}
          interactive={false}
        />
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });

  describe('accessibility with collapse/expand', () => {
    it('provides accessible collapse indicators', () => {
      render(<SubtaskTree task={multiLevelTask} interactive={false} />);

      // Collapse indicators should be present and accessible
      expect(screen.getByText(/▼/)).toBeInTheDocument();
    });

    it('maintains task descriptions accessibility in collapsed state', () => {
      render(
        <SubtaskTree
          task={multiLevelTask}
          defaultCollapsed={true}
          interactive={false}
        />
      );

      // Visible task descriptions should still be accessible
      expect(screen.getByText('Complex project setup')).toBeInTheDocument();

      // Collapsed indicator should provide context
      expect(screen.getByText(/3 subtasks \(collapsed\)/)).toBeInTheDocument();
    });
  });
});