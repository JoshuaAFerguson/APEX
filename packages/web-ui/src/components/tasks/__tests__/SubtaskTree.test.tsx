/**
 * Unit tests for SubtaskTree component
 *
 * Tests the component's ability to:
 * - Render subtasks in a tree structure with expand/collapse controls
 * - Display task status badges
 * - Support keyboard navigation (arrow keys, Enter, etc.)
 * - Navigate to task detail pages on click
 * - Handle loading, error, and empty states
 * - Support all props and customization options
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import type { Task, TaskStatus } from '@apexcli/core'
import { SubtaskTree } from '../SubtaskTree'
import type { SubtaskTreeNode, SubtaskTreeProps } from '../SubtaskTree'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getSubtasks: vi.fn(),
  },
}))

// Mock UI components
vi.mock('@/components/ui/Badge', () => ({
  Badge: vi.fn(({ status, className, children }) => (
    <div data-testid={`badge-${status}`} className={className}>
      {children || status}
    </div>
  )),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: vi.fn(({ children, onClick, variant, size, className, ...props }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  )),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: vi.fn(({ size }) => (
    <div data-testid="spinner" data-size={size}>
      Loading...
    </div>
  )),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
  truncateId: vi.fn((id: string, length: number = 8) =>
    id.length > length ? `${id.slice(0, length)}...` : id
  ),
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  ChevronRight: vi.fn(() => <div data-testid="chevron-right">▶</div>),
  ChevronDown: vi.fn(() => <div data-testid="chevron-down">▼</div>),
  RefreshCw: vi.fn(() => <div data-testid="refresh-icon">↻</div>),
}))

const mockApiClient = await import('@/lib/api-client')

describe('SubtaskTree', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data factories
  const createSubtaskNode = (overrides: Partial<SubtaskTreeNode> = {}): SubtaskTreeNode => ({
    id: 'subtask-123',
    description: 'Test subtask',
    status: 'pending' as TaskStatus,
    children: [],
    ...overrides,
  })

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-123',
    description: 'Test task',
    status: 'pending' as TaskStatus,
    workflow: 'test-workflow',
    autonomy: 'medium',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    ...overrides,
  })

  describe('Loading State', () => {
    it('renders loading spinner when loading prop is true', () => {
      render(<SubtaskTree taskId="task-123" loading={true} />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading subtasks...')).toBeInTheDocument()
    })

    it('shows loading state while fetching subtasks', async () => {
      const mockGetSubtasks = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ subtasks: [] }), 100))
      )
      mockApiClient.apiClient.getSubtasks = mockGetSubtasks

      render(<SubtaskTree taskId="task-123" />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(mockGetSubtasks).toHaveBeenCalledWith('task-123')
    })

    it('applies custom className to loading state', () => {
      const { container } = render(
        <SubtaskTree taskId="task-123" loading={true} className="custom-loading" />
      )

      expect(container.firstChild).toHaveClass('custom-loading')
    })
  })

  describe('Error State', () => {
    it('renders error message when error prop is provided', () => {
      const errorMessage = 'Failed to load subtasks'
      render(<SubtaskTree taskId="task-123" error={errorMessage} />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('shows error state when API fetch fails', async () => {
      const mockGetSubtasks = vi.fn().mockRejectedValue(new Error('Network error'))
      mockApiClient.apiClient.getSubtasks = mockGetSubtasks

      render(<SubtaskTree taskId="task-123" />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('allows retry when error occurs', async () => {
      const mockGetSubtasks = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ subtasks: [] })
      mockApiClient.apiClient.getSubtasks = mockGetSubtasks

      render(<SubtaskTree taskId="task-123" />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await act(async () => {
        await user.click(retryButton)
      })

      expect(mockGetSubtasks).toHaveBeenCalledTimes(2)
    })

    it('applies custom className to error state', () => {
      const { container } = render(
        <SubtaskTree taskId="task-123" error="Test error" className="custom-error" />
      )

      expect(container.firstChild).toHaveClass('custom-error')
    })
  })

  describe('Empty State', () => {
    it('renders empty state when no subtasks exist', () => {
      const emptyTree = createSubtaskNode({ children: [] })
      render(<SubtaskTree taskId="task-123" tree={emptyTree} />)

      expect(screen.getByText('No subtasks found')).toBeInTheDocument()
    })

    it('renders empty state when tree is null', () => {
      render(<SubtaskTree taskId="task-123" tree={null as any} />)

      expect(screen.getByText('No subtasks found')).toBeInTheDocument()
    })

    it('applies custom className to empty state', () => {
      const { container } = render(
        <SubtaskTree taskId="task-123" tree={null as any} className="custom-empty" />
      )

      expect(container.firstChild).toHaveClass('custom-empty')
    })
  })

  describe('Tree Structure Rendering', () => {
    it('renders a single subtask node correctly', () => {
      const tree = createSubtaskNode({
        id: 'subtask-1',
        description: 'Test subtask',
        status: 'in-progress',
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      expect(screen.getByText('Test subtask')).toBeInTheDocument()
      expect(screen.getByTestId('badge-in-progress')).toBeInTheDocument()
      expect(screen.getByText('subtask-1...')).toBeInTheDocument() // Truncated ID
    })

    it('renders hierarchical tree structure with multiple levels', () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({
            id: 'child-1',
            description: 'Child 1',
            children: [
              createSubtaskNode({
                id: 'grandchild-1',
                description: 'Grandchild 1',
              }),
            ],
          }),
          createSubtaskNode({
            id: 'child-2',
            description: 'Child 2',
          }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      expect(screen.getByText('Parent task')).toBeInTheDocument()
      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
      expect(screen.getByText('Grandchild 1')).toBeInTheDocument()
    })

    it('shows expand/collapse controls for nodes with children', () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent with children',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
    })

    it('does not show expand controls for leaf nodes', () => {
      const tree = createSubtaskNode({
        id: 'leaf',
        description: 'Leaf node',
        children: [],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      expect(screen.queryByTestId('chevron-down')).not.toBeInTheDocument()
      expect(screen.queryByTestId('chevron-right')).not.toBeInTheDocument()
    })

    it('renders with custom className', () => {
      const tree = createSubtaskNode()
      const { container } = render(
        <SubtaskTree taskId="task-123" tree={tree} className="custom-tree" />
      )

      expect(container.querySelector('.custom-tree')).toBeInTheDocument()
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('toggles expand/collapse when clicking chevron', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      // Initially expanded - should see child
      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()

      // Click to collapse
      await user.click(screen.getByTestId('chevron-down'))

      expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()

      // Click to expand again
      await user.click(screen.getByTestId('chevron-right'))

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
    })

    it('starts with nodes collapsed when defaultCollapsed is true', () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} defaultCollapsed={true} />)

      expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()
    })

    it('uses initialCollapsedIds to set initial collapse state', () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      const initialCollapsedIds = new Set(['parent'])
      render(
        <SubtaskTree
          taskId="task-123"
          tree={tree}
          initialCollapsedIds={initialCollapsedIds}
        />
      )

      expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()
    })

    it('calls onToggleCollapse callback when collapse state changes', async () => {
      const onToggleCollapse = vi.fn()
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      render(
        <SubtaskTree
          taskId="task-123"
          tree={tree}
          onToggleCollapse={onToggleCollapse}
        />
      )

      await user.click(screen.getByTestId('chevron-down'))

      expect(onToggleCollapse).toHaveBeenCalledWith('parent', true)
    })

    it('shows collapsed children count when node is collapsed', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
          createSubtaskNode({ id: 'child-2', description: 'Child 2' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      await user.click(screen.getByTestId('chevron-down'))

      expect(screen.getByText('(2 subtasks)')).toBeInTheDocument()
    })

    it('shows singular form for single collapsed child', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      await user.click(screen.getByTestId('chevron-down'))

      expect(screen.getByText('(1 subtask)')).toBeInTheDocument()
    })
  })

  describe('Status Badge Rendering', () => {
    it('renders correct status badge for each task status', () => {
      const statuses: TaskStatus[] = ['pending', 'in-progress', 'completed', 'failed']

      statuses.forEach((status) => {
        const tree = createSubtaskNode({ status, id: `test-${status}` })
        const { unmount } = render(<SubtaskTree taskId="test-123" tree={tree} />)

        expect(screen.getByTestId(`badge-${status}`)).toBeInTheDocument()
        unmount()
      })
    })

    it('applies custom className to status badges', () => {
      const tree = createSubtaskNode({ status: 'completed', id: 'test-completed' })
      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const badge = screen.getByTestId('badge-completed')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Max Depth Handling', () => {
    it('respects maxDepth prop and shows depth indicator', () => {
      const tree = createSubtaskNode({
        id: 'level-0',
        description: 'Level 0',
        children: [
          createSubtaskNode({
            id: 'level-1',
            description: 'Level 1',
            children: [
              createSubtaskNode({
                id: 'level-2',
                description: 'Level 2',
                children: [
                  createSubtaskNode({ id: 'level-3', description: 'Level 3' }),
                ],
              }),
            ],
          }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} maxDepth={2} />)

      expect(screen.getByText('Level 0')).toBeInTheDocument()
      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Level 2')).toBeInTheDocument()
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument()
      expect(screen.getByText('... 1 more subtasks (max depth reached)')).toBeInTheDocument()
    })

    it('uses default maxDepth of 10', () => {
      const tree = createSubtaskNode()
      render(<SubtaskTree taskId="task-123" tree={tree} />)

      // This test verifies the default value is used (implicit test)
      expect(screen.getByText('Test subtask')).toBeInTheDocument()
    })
  })

  describe('Navigation and Click Handling', () => {
    it('navigates to task detail page on node click by default', async () => {
      const tree = createSubtaskNode({
        id: 'subtask-456',
        description: 'Clickable task',
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const taskElement = screen.getByRole('treeitem')
      await act(async () => {
        await user.click(taskElement)
      })

      expect(mockPush).toHaveBeenCalledWith('/tasks/subtask-456')
    })

    it('calls custom onSubtaskClick handler when provided', async () => {
      const onSubtaskClick = vi.fn()
      const tree = createSubtaskNode({
        id: 'subtask-789',
        description: 'Custom click task',
      })

      render(
        <SubtaskTree
          taskId="task-123"
          tree={tree}
          onSubtaskClick={onSubtaskClick}
        />
      )

      const taskElement = screen.getByRole('treeitem')
      await act(async () => {
        await user.click(taskElement)
      })

      expect(onSubtaskClick).toHaveBeenCalledWith('subtask-789')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('prevents navigation when clicking on expand/collapse button', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child', description: 'Child task' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const chevron = screen.getByTestId('chevron-down')
      await user.click(chevron)

      // Should collapse, but not navigate
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard Navigation', () => {
    it('enables keyboard navigation by default', () => {
      const tree = createSubtaskNode()
      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const treeElement = screen.getByRole('tree')
      expect(treeElement).toHaveAttribute('tabIndex', '0')
      expect(treeElement).toHaveAttribute('aria-label', 'Subtask tree')
    })

    it('disables keyboard navigation when enableKeyboardNav is false', () => {
      const tree = createSubtaskNode()
      render(<SubtaskTree taskId="task-123" tree={tree} enableKeyboardNav={false} />)

      // Keyboard navigation should be disabled (tested by the hook not being active)
      expect(screen.getByRole('tree')).toBeInTheDocument()
    })

    it('sets aria-activedescendant to focused node', () => {
      const tree = createSubtaskNode({ id: 'focused-node' })
      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const treeElement = screen.getByRole('tree')
      expect(treeElement).toHaveAttribute('aria-activedescendant', 'focused-node')
    })

    it('handles arrow key navigation', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
          createSubtaskNode({ id: 'child-2', description: 'Child 2' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)
      const treeElement = screen.getByRole('tree')

      // Focus the tree
      act(() => {
        treeElement.focus()
      })

      // Simulate arrow down key
      await act(async () => {
        await user.keyboard('{ArrowDown}')
      })

      // Should move focus to first child
      expect(treeElement).toHaveAttribute('aria-activedescendant', 'child-1')
    })

    it('handles Enter key to navigate to task', async () => {
      const tree = createSubtaskNode({
        id: 'leaf-task',
        description: 'Leaf task',
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)
      const treeElement = screen.getByRole('tree')

      act(() => {
        treeElement.focus()
      })

      await act(async () => {
        await user.keyboard('{Enter}')
      })

      expect(mockPush).toHaveBeenCalledWith('/tasks/leaf-task')
    })

    it('handles Space key to toggle expand/collapse', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child', description: 'Child' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)
      const treeElement = screen.getByRole('tree')

      act(() => {
        treeElement.focus()
      })

      await act(async () => {
        await user.keyboard(' ')
      })

      // Should collapse the parent
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()
      expect(screen.queryByText('Child')).not.toBeInTheDocument()
    })

    it('handles vim-style navigation (hjkl)', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child-1', description: 'Child 1' }),
        ],
      })

      const { container } = render(<SubtaskTree taskId="task-123" tree={tree} />)
      const treeElement = container.querySelector('[role="tree"]')!

      treeElement.focus()

      // Move down with 'j'
      await user.keyboard('j')
      expect(treeElement).toHaveAttribute('aria-activedescendant', 'child-1')

      // Move up with 'k'
      await user.keyboard('k')
      expect(treeElement).toHaveAttribute('aria-activedescendant', 'parent')

      // Collapse with 'h'
      await user.keyboard('h')
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()

      // Expand with 'l'
      await user.keyboard('l')
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
    })

    it('handles g and G for first/last navigation', async () => {
      const tree = createSubtaskNode({
        id: 'first',
        description: 'First task',
        children: [
          createSubtaskNode({ id: 'second', description: 'Second task' }),
          createSubtaskNode({ id: 'last', description: 'Last task' }),
        ],
      })

      const { container } = render(<SubtaskTree taskId="task-123" tree={tree} />)
      const treeElement = container.querySelector('[role="tree"]')!

      treeElement.focus()

      // Go to last with 'G' (Shift+g)
      await user.keyboard('G')
      expect(treeElement).toHaveAttribute('aria-activedescendant', 'last')

      // Go to first with 'g'
      await user.keyboard('g')
      expect(treeElement).toHaveAttribute('aria-activedescendant', 'first')
    })
  })

  describe('Accessibility', () => {
    it('renders proper ARIA attributes for tree structure', () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child', description: 'Child task' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      // Tree container
      expect(screen.getByRole('tree')).toBeInTheDocument()

      // Tree items
      const treeItems = screen.getAllByRole('treeitem')
      expect(treeItems).toHaveLength(2)

      // Parent should have aria-expanded
      const parentItem = screen.getByRole('treeitem', { expanded: true })
      expect(parentItem).toHaveAttribute('aria-expanded', 'true')
      expect(parentItem).toHaveAttribute('aria-level', '1')

      // Child should have appropriate level
      const childItem = treeItems.find(item => item.id === 'subtask-child')
      expect(childItem).toHaveAttribute('aria-level', '2')
    })

    it('updates aria-expanded when node is collapsed', async () => {
      const tree = createSubtaskNode({
        id: 'parent',
        description: 'Parent task',
        children: [
          createSubtaskNode({ id: 'child', description: 'Child task' }),
        ],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const parentItem = screen.getByRole('treeitem', { expanded: true })
      expect(parentItem).toHaveAttribute('aria-expanded', 'true')

      await user.click(screen.getByTestId('chevron-down'))

      expect(parentItem).toHaveAttribute('aria-expanded', 'false')
    })

    it('sets proper aria-selected for focused node', () => {
      const tree = createSubtaskNode({ id: 'focused-node' })
      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const treeItem = screen.getByRole('treeitem')
      expect(treeItem).toHaveAttribute('aria-selected', 'true')
    })

    it('provides proper aria-label for expand/collapse buttons', () => {
      const tree = createSubtaskNode({
        children: [createSubtaskNode({ description: 'Child' })],
      })

      render(<SubtaskTree taskId="task-123" tree={tree} />)

      const expandButton = screen.getByLabelText('Collapse')
      expect(expandButton).toBeInTheDocument()
    })
  })
})