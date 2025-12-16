import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

// Mock useInput from ink to simulate keyboard interactions
const mockUseInput = vi.fn();

// Mock the ink module
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
  };
});

describe('SubtaskTree - Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

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

  describe('arrow key navigation', () => {
    it('navigates down with down arrow key', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
        />
      );

      // Get the useInput callback that was registered
      const inputCallback = mockUseInput.mock.calls[0]?.[0];
      expect(inputCallback).toBeDefined();

      // Simulate down arrow key press
      inputCallback('', { downArrow: true });

      expect(onFocusChange).toHaveBeenCalledWith('1.1');
    });

    it('navigates up with up arrow key', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Simulate up arrow key press
      inputCallback('', { upArrow: true });

      expect(onFocusChange).toHaveBeenCalledWith('1');
    });

    it('respects navigation boundaries at start', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1" // Already at first node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Try to navigate up from first node
      inputCallback('', { upArrow: true });

      expect(onFocusChange).not.toHaveBeenCalled();
    });

    it('respects navigation boundaries at end', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.3" // Last visible node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Try to navigate down from last node
      inputCallback('', { downArrow: true });

      expect(onFocusChange).not.toHaveBeenCalled();
    });
  });

  describe('vim-style navigation', () => {
    it('navigates with j (down) and k (up)', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test 'j' for down
      inputCallback('j', {});
      expect(onFocusChange).toHaveBeenCalledWith('1.1');

      // Reset mock
      onFocusChange.mockClear();

      // Update to next focused state for 'k' test
      const { rerender } = render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.1"
        />
      );

      const inputCallbackK = mockUseInput.mock.calls[1]?.[0];

      // Test 'k' for up
      inputCallbackK('k', {});
      expect(onFocusChange).toHaveBeenCalledWith('1');
    });

    it('handles h (left) for collapse/parent navigation', () => {
      const onToggleCollapse = vi.fn();
      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test 'h' on expanded parent - should collapse
      inputCallback('h', {});
      expect(onToggleCollapse).toHaveBeenCalledWith('1', true);
    });

    it('handles l (right) for expand/child navigation', () => {
      const onToggleCollapse = vi.fn();
      const onFocusChange = vi.fn();

      // Start with collapsed node
      const initialCollapsedIds = new Set(['1']);
      render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
          initialCollapsedIds={initialCollapsedIds}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test 'l' on collapsed parent - should expand
      inputCallback('l', {});
      expect(onToggleCollapse).toHaveBeenCalledWith('1', false);
    });
  });

  describe('space and enter key interactions', () => {
    it('toggles collapse state with space key', () => {
      const onToggleCollapse = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test space key on expandable node
      inputCallback(' ', {});
      expect(onToggleCollapse).toHaveBeenCalledWith('1', true);
    });

    it('toggles collapse state with enter key', () => {
      const onToggleCollapse = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="1"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test enter key on expandable node
      inputCallback('', { return: true });
      expect(onToggleCollapse).toHaveBeenCalledWith('1', true);
    });

    it('ignores space/enter on nodes without children', () => {
      const onToggleCollapse = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onToggleCollapse={onToggleCollapse}
          focusedNodeId="1.1" // Leaf node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test space key on leaf node - should not trigger collapse
      inputCallback(' ', {});
      expect(onToggleCollapse).not.toHaveBeenCalled();

      // Test enter key on leaf node - should not trigger collapse
      inputCallback('', { return: true });
      expect(onToggleCollapse).not.toHaveBeenCalled();
    });
  });

  describe('home and end key navigation', () => {
    it('navigates to first node with home key', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.2.1" // Start somewhere in middle
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test home key
      inputCallback('', { home: true });
      expect(onFocusChange).toHaveBeenCalledWith('1');
    });

    it('navigates to last visible node with end key', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1" // Start at first node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Test end key
      inputCallback('', { end: true });
      expect(onFocusChange).toHaveBeenCalledWith('1.3'); // Last visible node
    });
  });

  describe('navigation with collapsed nodes', () => {
    it('skips over collapsed children when navigating', () => {
      const onFocusChange = vi.fn();
      const initialCollapsedIds = new Set(['1.2']); // Collapse login endpoint

      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.2"
          initialCollapsedIds={initialCollapsedIds}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate down from collapsed node should skip its children
      inputCallback('', { downArrow: true });
      expect(onFocusChange).toHaveBeenCalledWith('1.3'); // Skip to next sibling
    });

    it('includes newly expanded nodes in navigation', () => {
      const onFocusChange = vi.fn();

      // Start with all nodes collapsed
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
          defaultCollapsed={true}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Initially, down navigation should not find children
      inputCallback('', { downArrow: true });
      expect(onFocusChange).not.toHaveBeenCalled(); // No visible children
    });
  });

  describe('parent navigation edge cases', () => {
    it('finds correct parent when navigating from deep child', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.2.1" // Deep child node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate left (h) should find parent
      inputCallback('h', {});
      expect(onFocusChange).toHaveBeenCalledWith('1.2'); // Direct parent
    });

    it('handles root node parent navigation gracefully', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1" // Root node
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // First collapse the root node
      inputCallback('h', {}); // This should collapse

      // Clear previous calls
      onFocusChange.mockClear();

      // Try to navigate to parent (which doesn't exist)
      inputCallback('h', {});
      expect(onFocusChange).not.toHaveBeenCalled(); // Should not move
    });
  });

  describe('interactive mode control', () => {
    it('disables keyboard input when interactive=false', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
          interactive={false}
        />
      );

      // useInput should be called with isActive: false
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: false }
      );
    });

    it('enables keyboard input when interactive=true (default)', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
        />
      );

      // useInput should be called with isActive: true
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });
  });

  describe('focus state management', () => {
    it('handles external focus control', () => {
      const onFocusChange = vi.fn();
      const { rerender } = render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1"
        />
      );

      // Change focus externally
      rerender(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.2"
        />
      );

      // Component should reflect external focus change
      expect(screen.getByText(/⟨Implement login endpoint⟩/)).toBeInTheDocument();
    });

    it('manages internal focus when not externally controlled', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          // No focusedNodeId prop - should use internal focus
        />
      );

      // Should start with root node focused internally
      expect(screen.getByText(/⟨Implement user authentication⟩/)).toBeInTheDocument();
    });
  });

  describe('keyboard interaction with invalid focus', () => {
    it('handles invalid focused node gracefully', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="non-existent-id"
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Try to navigate with invalid focused node
      inputCallback('', { downArrow: true });

      // Should not crash and not call focus change
      expect(onFocusChange).not.toHaveBeenCalled();
    });

    it('handles null focused node', () => {
      const onFocusChange = vi.fn();
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId={null as any} // Simulate null focus
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Try to navigate with null focus
      inputCallback('', { downArrow: true });

      // Should not crash and not call focus change
      expect(onFocusChange).not.toHaveBeenCalled();
    });
  });

  describe('complex navigation scenarios', () => {
    it('handles navigation through mixed expanded/collapsed tree', () => {
      const onFocusChange = vi.fn();
      const partiallyCollapsed = new Set(['1.2']); // Only collapse login endpoint

      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.1"
          initialCollapsedIds={partiallyCollapsed}
        />
      );

      const inputCallback = mockUseInput.mock.calls[0]?.[0];

      // Navigate down - should skip collapsed 1.2 children and go to 1.2 itself
      inputCallback('', { downArrow: true });
      expect(onFocusChange).toHaveBeenCalledWith('1.2');

      // Clear and continue navigation
      onFocusChange.mockClear();

      // Update focus for next test
      render(
        <SubtaskTree
          task={complexTask}
          onFocusChange={onFocusChange}
          focusedNodeId="1.2"
          initialCollapsedIds={partiallyCollapsed}
        />
      );

      const inputCallback2 = mockUseInput.mock.calls[2]?.[0];

      // Navigate down from collapsed node - should go to next sibling
      inputCallback2('', { downArrow: true });
      expect(onFocusChange).toHaveBeenCalledWith('1.3');
    });
  });
});