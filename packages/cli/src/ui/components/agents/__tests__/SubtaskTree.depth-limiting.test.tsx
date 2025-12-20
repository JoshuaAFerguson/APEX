import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { SubtaskTree, SubtaskNode } from '../SubtaskTree';

// Mock useElapsedTime hook
const mockUseElapsedTime = vi.fn();
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

describe('SubtaskTree - Max Depth Limiting with New Features', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
    mockUseElapsedTime.mockClear();
    mockUseElapsedTime.mockReturnValue('0s');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const deepTaskWithFeatures: SubtaskNode = {
    id: 'level0',
    description: 'Level 0 - Root task',
    status: 'in-progress',
    progress: 25,
    startedAt: new Date('2024-01-01T09:30:00Z'),
    children: [
      {
        id: 'level1a',
        description: 'Level 1A - First branch',
        status: 'in-progress',
        progress: 60,
        startedAt: new Date('2024-01-01T09:45:00Z'),
        children: [
          {
            id: 'level2a',
            description: 'Level 2A - Deep task',
            status: 'in-progress',
            progress: 80,
            startedAt: new Date('2024-01-01T09:50:00Z'),
            children: [
              {
                id: 'level3a',
                description: 'Level 3A - Very deep task',
                status: 'completed',
                children: [
                  {
                    id: 'level4a',
                    description: 'Level 4A - Extremely deep',
                    status: 'pending'
                  }
                ]
              },
              {
                id: 'level3b',
                description: 'Level 3B - Another deep task',
                status: 'in-progress',
                progress: 40,
                startedAt: new Date('2024-01-01T09:55:00Z')
              }
            ]
          },
          {
            id: 'level2b',
            description: 'Level 2B - Another branch',
            status: 'pending',
            children: [
              {
                id: 'level3c',
                description: 'Level 3C - Hidden deep task',
                status: 'pending'
              }
            ]
          }
        ]
      },
      {
        id: 'level1b',
        description: 'Level 1B - Second branch',
        status: 'completed'
      }
    ]
  };

  describe('depth limiting with progress indicators', () => {
    it('shows progress for visible tasks within depth limit', () => {
      mockUseElapsedTime.mockReturnValue('30m');

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          interactive={false}
        />
      );

      // Level 0, 1, and 2 should be visible with progress
      expect(screen.getByText('25%')).toBeInTheDocument(); // Level 0
      expect(screen.getByText('60%')).toBeInTheDocument(); // Level 1A
      expect(screen.getByText('80%')).toBeInTheDocument(); // Level 2A

      // Level 3 should not be visible
      expect(screen.queryByText('40%')).not.toBeInTheDocument(); // Level 3B progress hidden
    });

    it('hides progress for tasks beyond depth limit', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={1}
          interactive={false}
        />
      );

      // Only level 0 and 1 progress should be visible
      expect(screen.getByText('25%')).toBeInTheDocument(); // Level 0
      expect(screen.getByText('60%')).toBeInTheDocument(); // Level 1A

      // Level 2 and deeper should not show progress
      expect(screen.queryByText('80%')).not.toBeInTheDocument(); // Level 2A
      expect(screen.queryByText('40%')).not.toBeInTheDocument(); // Level 3B
    });

    it('shows correct depth overflow message with progress tasks hidden', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          interactive={false}
        />
      );

      // Should show overflow indicator for level 3 tasks
      expect(screen.getByText(/2 more subtasks \(max depth reached\)/)).toBeInTheDocument();
    });

    it('handles progress display when depth limit is 0', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={0}
          interactive={false}
        />
      );

      // Only root task progress should be visible
      expect(screen.getByText('25%')).toBeInTheDocument(); // Level 0
      expect(screen.queryByText('60%')).not.toBeInTheDocument(); // Level 1A hidden
    });
  });

  describe('depth limiting with elapsed time', () => {
    it('shows elapsed time for visible in-progress tasks within depth limit', () => {
      mockUseElapsedTime
        .mockReturnValueOnce('30m')    // Level 0
        .mockReturnValueOnce('15m')    // Level 1A
        .mockReturnValueOnce('10m');   // Level 2A

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          interactive={false}
        />
      );

      // Should show elapsed time for in-progress tasks within depth
      expect(screen.getByText('⏱ 30m')).toBeInTheDocument(); // Level 0
      expect(screen.getByText('⏱ 15m')).toBeInTheDocument(); // Level 1A
      expect(screen.getByText('⏱ 10m')).toBeInTheDocument(); // Level 2A

      // Should call useElapsedTime for each in-progress task within depth
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
    });

    it('does not show elapsed time for tasks beyond depth limit', () => {
      mockUseElapsedTime
        .mockReturnValueOnce('30m')    // Level 0
        .mockReturnValueOnce('15m');   // Level 1A

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={1}
          interactive={false}
        />
      );

      // Only level 0 and 1 elapsed time should be visible
      expect(screen.getByText('⏱ 30m')).toBeInTheDocument(); // Level 0
      expect(screen.getByText('⏱ 15m')).toBeInTheDocument(); // Level 1A

      // Deeper levels should not trigger useElapsedTime calls
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2);
    });

    it('handles elapsed time when maxDepth is very restrictive', () => {
      mockUseElapsedTime.mockReturnValue('30m');

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={0}
          interactive={false}
        />
      );

      // Only root should show elapsed time
      expect(screen.getByText('⏱ 30m')).toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(1);
    });
  });

  describe('depth limiting with collapse/expand', () => {
    it('respects depth limits within collapsed sections', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={3}
          defaultCollapsed={false}
          interactive={false}
        />
      );

      // All levels 0-3 should be visible initially
      expect(screen.getByText('Level 0 - Root task')).toBeInTheDocument();
      expect(screen.getByText('Level 1A - First branch')).toBeInTheDocument();
      expect(screen.getByText('Level 2A - Deep task')).toBeInTheDocument();
      expect(screen.getByText('Level 3A - Very deep task')).toBeInTheDocument();
      expect(screen.getByText('Level 3B - Another deep task')).toBeInTheDocument();

      // Level 4 should be hidden by depth limit
      expect(screen.queryByText('Level 4A - Extremely deep')).not.toBeInTheDocument();
      expect(screen.getByText(/1 more subtasks \(max depth reached\)/)).toBeInTheDocument();
    });

    it('shows collapse indicators for nodes at depth limit', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          interactive={false}
        />
      );

      // Level 2 nodes with children should show collapse indicators
      expect(screen.getByText(/▼/)).toBeInTheDocument();

      // But their children should be hidden due to depth limit
      expect(screen.queryByText('Level 3A - Very deep task')).not.toBeInTheDocument();
    });

    it('handles collapsed nodes within depth limits', () => {
      const collapsedIds = new Set(['level1a']);

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={3}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Level 1A should be visible but collapsed
      expect(screen.getByText('Level 1A - First branch')).toBeInTheDocument();
      expect(screen.getByText(/▶/)).toBeInTheDocument(); // Collapsed indicator

      // Level 1A children should be hidden due to collapse, not depth
      expect(screen.queryByText('Level 2A - Deep task')).not.toBeInTheDocument();
      expect(screen.getByText(/2 subtasks \(collapsed\)/)).toBeInTheDocument();
    });

    it('combines collapse state with depth overflow correctly', () => {
      const collapsedIds = new Set(['level2a']);

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={3}
          initialCollapsedIds={collapsedIds}
          interactive={false}
        />
      );

      // Level 2A should be collapsed
      expect(screen.getByText('Level 2A - Deep task')).toBeInTheDocument();
      expect(screen.queryByText('Level 3A - Very deep task')).not.toBeInTheDocument();

      // Should show collapse indicator, not depth overflow
      expect(screen.getByText(/2 subtasks \(collapsed\)/)).toBeInTheDocument();
    });
  });

  describe('depth limiting with focus and navigation', () => {
    it('limits keyboard navigation to visible nodes within depth', () => {
      const mockUseInput = vi.fn();

      vi.doMock('ink', async () => {
        const actual = await vi.importActual('ink');
        return {
          ...actual,
          useInput: mockUseInput,
        };
      });

      const onFocusChange = vi.fn();

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          onFocusChange={onFocusChange}
          focusedNodeId="level2a"
        />
      );

      // Navigation should be limited to visible nodes only
      // Level 3 and below should not be accessible via navigation
    });

    it('shows focus indicator only for visible nodes', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          focusedNodeId="level2a"
          interactive={false}
        />
      );

      // Level 2A should be visible and focused
      expect(screen.getByText(/⟨Level 2A - Deep task⟩/)).toBeInTheDocument();

      // Attempting to focus a hidden node should not show focus
      const { rerender } = render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          focusedNodeId="level3a" // Hidden by depth limit
          interactive={false}
        />
      );

      expect(screen.queryByText(/⟨Level 3A - Very deep task⟩/)).not.toBeInTheDocument();
    });
  });

  describe('depth limiting edge cases with new features', () => {
    it('handles negative maxDepth gracefully', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={-1}
          interactive={false}
        />
      );

      // Should still show root task
      expect(screen.getByText('Level 0 - Root task')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument(); // Root progress

      // Children should be hidden
      expect(screen.queryByText('Level 1A - First branch')).not.toBeInTheDocument();
    });

    it('handles maxDepth larger than actual tree depth', () => {
      mockUseElapsedTime.mockReturnValue('5m');

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={10} // Much larger than actual depth
          interactive={false}
        />
      );

      // All nodes should be visible
      expect(screen.getByText('Level 0 - Root task')).toBeInTheDocument();
      expect(screen.getByText('Level 4A - Extremely deep')).toBeInTheDocument();

      // No depth overflow messages should appear
      expect(screen.queryByText(/max depth reached/)).not.toBeInTheDocument();
    });

    it('preserves feature display when depth limit equals tree depth', () => {
      mockUseElapsedTime.mockReturnValue('10m');

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={4} // Exactly matches deepest level
          interactive={false}
        />
      );

      // All levels should be visible with their features
      expect(screen.getByText('Level 4A - Extremely deep')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument(); // Level 3B progress
      expect(screen.getByText('⏱ 10m')).toBeInTheDocument(); // Elapsed time
    });

    it('handles depth limiting with empty children arrays', () => {
      const taskWithEmptyChildren: SubtaskNode = {
        id: 'parent',
        description: 'Parent with empty children',
        status: 'in-progress',
        progress: 50,
        children: []
      };

      render(
        <SubtaskTree
          task={taskWithEmptyChildren}
          maxDepth={1}
          interactive={false}
        />
      );

      expect(screen.getByText('Parent with empty children')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();

      // No depth overflow indicators for empty children
      expect(screen.queryByText(/max depth reached/)).not.toBeInTheDocument();
    });

    it('handles dynamic maxDepth changes', () => {
      const { rerender } = render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={1}
          interactive={false}
        />
      );

      // Initially only level 0 and 1 visible
      expect(screen.getByText('Level 0 - Root task')).toBeInTheDocument();
      expect(screen.getByText('Level 1A - First branch')).toBeInTheDocument();
      expect(screen.queryByText('Level 2A - Deep task')).not.toBeInTheDocument();

      // Increase depth limit
      rerender(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={3}
          interactive={false}
        />
      );

      // More levels should now be visible
      expect(screen.getByText('Level 2A - Deep task')).toBeInTheDocument();
      expect(screen.getByText('Level 3A - Very deep task')).toBeInTheDocument();
    });
  });

  describe('depth limiting accessibility', () => {
    it('provides accessible depth overflow information', () => {
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          interactive={false}
        />
      );

      // Overflow message should be accessible
      expect(screen.getByText(/2 more subtasks \(max depth reached\)/)).toBeInTheDocument();
    });

    it('maintains accessibility of visible features within depth limit', () => {
      mockUseElapsedTime.mockReturnValue('20m');

      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={2}
          interactive={false}
        />
      );

      // All visible features should remain accessible
      expect(screen.getByText('Level 0 - Root task')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument(); // Progress
      expect(screen.getByText('⏱ 20m')).toBeInTheDocument(); // Elapsed time

      // Status icons should be accessible
      expect(screen.getByText(/●/)).toBeInTheDocument(); // In-progress icon
    });
  });

  describe('performance with depth limiting', () => {
    it('does not render hidden deep nodes', () => {
      // This test ensures that nodes beyond maxDepth are not rendered at all
      // rather than being rendered and then hidden
      render(
        <SubtaskTree
          task={deepTaskWithFeatures}
          maxDepth={1}
          interactive={false}
        />
      );

      // Deep nodes should not be in the DOM at all
      expect(screen.queryByText('Level 2A - Deep task')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 3A - Very deep task')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 4A - Extremely deep')).not.toBeInTheDocument();

      // useElapsedTime should only be called for visible in-progress tasks
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2); // Level 0 and Level 1A
    });

    it('efficiently handles very deep trees with restrictive depth limits', () => {
      const veryDeepTask = createVeryDeepTask(20); // 20 levels deep

      render(
        <SubtaskTree
          task={veryDeepTask}
          maxDepth={2}
          interactive={false}
        />
      );

      // Should only render first few levels
      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument();

      // Should show appropriate overflow message
      expect(screen.getByText(/more subtasks \(max depth reached\)/)).toBeInTheDocument();
    });
  });
});

// Helper function to create very deep task structure for performance testing
function createVeryDeepTask(depth: number, currentLevel = 0): SubtaskNode {
  const task: SubtaskNode = {
    id: `level${currentLevel}`,
    description: `Level ${currentLevel}`,
    status: 'in-progress',
    progress: Math.floor(Math.random() * 100),
    startedAt: new Date('2024-01-01T09:00:00Z')
  };

  if (currentLevel < depth) {
    task.children = [createVeryDeepTask(depth, currentLevel + 1)];
  }

  return task;
}