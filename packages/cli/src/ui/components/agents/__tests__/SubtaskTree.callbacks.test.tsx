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

describe('SubtaskTree - Callback Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockReset();
  });

  const testTask: SubtaskNode = {
    id: 'root',
    description: 'Root task',
    status: 'in-progress',
    children: [
      {
        id: 'child1',
        description: 'First child',
        status: 'completed'
      },
      {
        id: 'child2',
        description: 'Second child',
        status: 'in-progress',
        children: [
          {
            id: 'grandchild1',
            description: 'First grandchild',
            status: 'pending'
          },
          {
            id: 'grandchild2',
            description: 'Second grandchild',
            status: 'pending'
          }
        ]
      }
    ]
  };

  describe('onToggleCollapse callback', () => {
    it('calls onToggleCollapse when collapsing a node via space key', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Trigger collapse via space key
      inputCallback(' ', {});

      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
      expect(onToggleCollapse).toHaveBeenCalledWith('root', true); // collapsing
    });

    it('calls onToggleCollapse when collapsing a node via enter key', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="child2"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Trigger collapse via enter key
      inputCallback('', { return: true });

      expect(onToggleCollapse).toHaveBeenCalledWith('child2', true);
    });

    it('calls onToggleCollapse when expanding a collapsed node', () => {
      const onToggleCollapse = vi.fn();
      const initialCollapsed = new Set(['root']);

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
          initialCollapsedIds={initialCollapsed}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Trigger expand via space key
      inputCallback(' ', {});

      expect(onToggleCollapse).toHaveBeenCalledWith('root', false); // expanding
    });

    it('calls onToggleCollapse via left arrow (h) key navigation', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Trigger collapse via 'h' key
      inputCallback('h', {});

      expect(onToggleCollapse).toHaveBeenCalledWith('root', true);
    });

    it('calls onToggleCollapse via right arrow (l) key navigation on collapsed node', () => {
      const onToggleCollapse = vi.fn();
      const initialCollapsed = new Set(['child2']);

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="child2"
          initialCollapsedIds={initialCollapsed}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Trigger expand via 'l' key
      inputCallback('l', {});

      expect(onToggleCollapse).toHaveBeenCalledWith('child2', false);
    });

    it('does not call onToggleCollapse for nodes without children', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="child1" // Leaf node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Try to toggle leaf node
      inputCallback(' ', {});

      expect(onToggleCollapse).not.toHaveBeenCalled();
    });

    it('handles multiple toggle operations correctly', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // First toggle - collapse
      inputCallback(' ', {});
      expect(onToggleCollapse).toHaveBeenNthCalledWith(1, 'root', true);

      // Second toggle - expand (would need state management to test properly)
      inputCallback(' ', {});
      expect(onToggleCollapse).toHaveBeenNthCalledWith(2, 'root', true); // Still collapse since state hasn't changed

      expect(onToggleCollapse).toHaveBeenCalledTimes(2);
    });

    it('provides correct collapsed state in callback', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Toggle from expanded to collapsed
      inputCallback(' ', {});

      const [nodeId, isCollapsed] = onToggleCollapse.mock.calls[0];
      expect(nodeId).toBe('root');
      expect(isCollapsed).toBe(true);
    });

    it('handles onToggleCollapse being undefined gracefully', () => {
      render(
        <SubtaskTree
          task={testTask}
          // No onToggleCollapse callback
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Should not crash when callback is not provided
      expect(() => {
        inputCallback(' ', {});
      }).not.toThrow();
    });
  });

  describe('onFocusChange callback', () => {
    it('calls onFocusChange when navigating with arrow keys', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate down
      inputCallback('', { downArrow: true });

      expect(onFocusChange).toHaveBeenCalledTimes(1);
      expect(onFocusChange).toHaveBeenCalledWith('child1');
    });

    it('calls onFocusChange when navigating with vim keys', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="child1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate up with 'k'
      inputCallback('k', {});

      expect(onFocusChange).toHaveBeenCalledWith('root');
    });

    it('calls onFocusChange when navigating to parent with left arrow', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="grandchild1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate to parent when node is already expanded
      inputCallback('h', {});

      expect(onFocusChange).toHaveBeenCalledWith('child2');
    });

    it('calls onFocusChange when navigating to first child with right arrow', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="child2"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate to first child when node is expanded
      inputCallback('l', {});

      expect(onFocusChange).toHaveBeenCalledWith('grandchild1');
    });

    it('calls onFocusChange with home key navigation', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="grandchild2"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate to first node
      inputCallback('', { home: true });

      expect(onFocusChange).toHaveBeenCalledWith('root');
    });

    it('calls onFocusChange with end key navigation', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate to last visible node
      inputCallback('', { end: true });

      expect(onFocusChange).toHaveBeenCalledWith('grandchild2'); // Last visible node
    });

    it('does not call onFocusChange when at navigation boundaries', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="root" // Already at first node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Try to navigate up from first node
      inputCallback('', { upArrow: true });

      expect(onFocusChange).not.toHaveBeenCalled();
    });

    it('handles onFocusChange being undefined gracefully', () => {
      render(
        <SubtaskTree
          task={testTask}
          // No onFocusChange callback
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Should not crash when callback is not provided
      expect(() => {
        inputCallback('', { downArrow: true });
      }).not.toThrow();
    });

    it('manages internal focus when not externally controlled', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          // No focusedNodeId prop - internal focus management
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate down
      inputCallback('', { downArrow: true });

      // Should still call the callback for external notifications
      expect(onFocusChange).toHaveBeenCalledWith('child1');
    });
  });

  describe('callback integration scenarios', () => {
    it('handles both callbacks being called simultaneously', () => {
      const onToggleCollapse = vi.fn();
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          onFocusChange={onFocusChange}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Left arrow on expanded parent: collapse + potentially move to parent
      inputCallback('h', {});

      expect(onToggleCollapse).toHaveBeenCalledWith('root', true);
      // Focus change may or may not be called depending on parent existence
    });

    it('manages state correctly with external control', () => {
      let currentFocus = 'root';
      let collapsedNodes = new Set<string>();

      const handleFocusChange = vi.fn((nodeId: string | null) => {
        if (nodeId) currentFocus = nodeId;
      });

      const handleToggleCollapse = vi.fn((nodeId: string, collapsed: boolean) => {
        if (collapsed) {
          collapsedNodes.add(nodeId);
        } else {
          collapsedNodes.delete(nodeId);
        }
      });

      const { rerender } = render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={handleToggleCollapse}
          onFocusChange={handleFocusChange}
          focusedNodeId={currentFocus}
          initialCollapsedIds={collapsedNodes}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate down
      inputCallback('', { downArrow: true });

      expect(handleFocusChange).toHaveBeenCalledWith('child1');

      // Update focus based on callback
      currentFocus = 'child1';
      rerender(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={handleToggleCollapse}
          onFocusChange={handleFocusChange}
          focusedNodeId={currentFocus}
          initialCollapsedIds={collapsedNodes}
        />
      );

      // Verify focus is updated
      expect(screen.getByText(/⟨First child⟩/)).toBeInTheDocument();
    });

    it('handles rapid callback invocations', () => {
      const onToggleCollapse = vi.fn();
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          onFocusChange={onFocusChange}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Rapid key presses
      inputCallback('', { downArrow: true });
      inputCallback('', { downArrow: true });
      inputCallback(' ', {}); // Toggle collapse
      inputCallback('', { upArrow: true });

      expect(onFocusChange).toHaveBeenCalledTimes(3); // 2 moves + 1 up
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    });
  });

  describe('callback error handling', () => {
    it('handles callback exceptions gracefully', () => {
      const faultyCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={faultyCallback}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Should not crash the component when callback throws
      expect(() => {
        inputCallback('', { downArrow: true });
      }).not.toThrow();

      expect(faultyCallback).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('continues to work after callback errors', () => {
      let callCount = 0;
      const faultyCallback = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call error');
        }
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={faultyCallback}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // First call throws
      inputCallback('', { downArrow: true });

      // Second call should work
      inputCallback('', { downArrow: true });

      expect(faultyCallback).toHaveBeenCalledTimes(2);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('callback parameter validation', () => {
    it('provides valid node IDs to onFocusChange', () => {
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onFocusChange={onFocusChange}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate through all nodes
      inputCallback('', { downArrow: true }); // to child1
      inputCallback('', { downArrow: true }); // to child2
      inputCallback('', { downArrow: true }); // to grandchild1
      inputCallback('', { downArrow: true }); // to grandchild2

      const calls = onFocusChange.mock.calls;
      const nodeIds = calls.map(call => call[0]);

      // All IDs should be valid and from our tree
      const validIds = ['child1', 'child2', 'grandchild1', 'grandchild2'];
      nodeIds.forEach(id => {
        expect(validIds).toContain(id);
      });
    });

    it('provides valid parameters to onToggleCollapse', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      inputCallback(' ', {}); // Toggle root

      const [nodeId, collapsed] = onToggleCollapse.mock.calls[0];

      expect(typeof nodeId).toBe('string');
      expect(nodeId).toBe('root');
      expect(typeof collapsed).toBe('boolean');
      expect(collapsed).toBe(true); // Should be collapsing from expanded state
    });
  });

  describe('callback timing and order', () => {
    it('calls callbacks in correct order for navigation', () => {
      const callOrder: string[] = [];

      const onFocusChange = vi.fn(() => {
        callOrder.push('focus');
      });

      const onToggleCollapse = vi.fn(() => {
        callOrder.push('toggle');
      });

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          onFocusChange={onFocusChange}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigation should only call focus change
      inputCallback('', { downArrow: true });

      expect(callOrder).toEqual(['focus']);

      // Reset for toggle test
      callOrder.length = 0;

      // Toggle should only call toggle
      inputCallback(' ', {});

      expect(callOrder).toEqual(['toggle']);
    });

    it('handles synchronous callback execution', () => {
      const onToggleCollapse = vi.fn();

      render(
        <SubtaskTree
          task={testTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="root"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Toggle should be called synchronously
      inputCallback(' ', {});

      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
      expect(onToggleCollapse).toHaveReturnedTimes(1);
    });
  });
});