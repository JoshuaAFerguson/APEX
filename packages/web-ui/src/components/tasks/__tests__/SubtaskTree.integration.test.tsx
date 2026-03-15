/**
 * Integration tests for SubtaskTree component
 *
 * Tests the component's integration with:
 * - API client for fetching subtasks
 * - Complex tree building and data transformation
 * - Real-world scenarios with multiple task hierarchies
 * - Performance with large datasets
 * - Error recovery and retry mechanisms
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import type { Task, TaskStatus } from '@apexcli/core'
import { SubtaskTree } from '../SubtaskTree'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock API client
const mockGetSubtasks = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getSubtasks: mockGetSubtasks,
  },
}))

// Mock UI components with simpler implementations
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ status }: { status: string }) => (
    <span data-testid={`badge-${status}`}>{status}</span>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
  truncateId: (id: string, length: number = 8) =>
    id.length > length ? `${id.slice(0, length)}...` : id,
}))

vi.mock('lucide-react', () => ({
  ChevronRight: () => <div data-testid="chevron-right">▶</div>,
  ChevronDown: () => <div data-testid="chevron-down">▼</div>,
  RefreshCw: () => <div data-testid="refresh-icon">↻</div>,
}))

describe('SubtaskTree Integration Tests', () => {
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
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Default task description',
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
    subtaskIds: [],
    ...overrides,
  })

  describe('API Integration', () => {
    it('fetches and displays subtasks from API', async () => {
      const parentTask = createTask({
        id: 'parent-123',
        description: 'Parent task',
        subtaskIds: ['child-1', 'child-2'],
      })

      const childTask1 = createTask({
        id: 'child-1',
        description: 'First child task',
        parentTaskId: 'parent-123',
        status: 'completed',
      })

      const childTask2 = createTask({
        id: 'child-2',
        description: 'Second child task',
        parentTaskId: 'parent-123',
        status: 'in-progress',
      })

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'parent-123',
        subtasks: [parentTask, childTask1, childTask2],
        count: 3,
      })

      render(<SubtaskTree taskId="parent-123" />)

      // Should show loading initially
      expect(screen.getByTestId('spinner')).toBeInTheDocument()

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Parent task')).toBeInTheDocument()
      })

      expect(screen.getByText('First child task')).toBeInTheDocument()
      expect(screen.getByText('Second child task')).toBeInTheDocument()
      expect(screen.getByTestId('badge-completed')).toBeInTheDocument()
      expect(screen.getByTestId('badge-in-progress')).toBeInTheDocument()

      expect(mockGetSubtasks).toHaveBeenCalledWith('parent-123')
    })

    it('handles API errors gracefully with retry functionality', async () => {
      const networkError = new Error('Network connection failed')
      mockGetSubtasks.mockRejectedValueOnce(networkError)

      render(<SubtaskTree taskId="error-task" />)

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      })

      expect(screen.getByText('Retry')).toBeInTheDocument()

      // Mock successful retry
      const successData = {
        parentTaskId: 'error-task',
        subtasks: [createTask({ id: 'error-task', description: 'Recovered task' })],
        count: 1,
      }
      mockGetSubtasks.mockResolvedValueOnce(successData)

      // Click retry
      await user.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(screen.getByText('Recovered task')).toBeInTheDocument()
      })

      expect(mockGetSubtasks).toHaveBeenCalledTimes(2)
    })

    it('builds complex hierarchical tree from flat task list', async () => {
      // Create a 3-level deep hierarchy
      const rootTask = createTask({
        id: 'root',
        description: 'Root task',
        subtaskIds: ['level1-a', 'level1-b'],
      })

      const level1TaskA = createTask({
        id: 'level1-a',
        description: 'Level 1 Task A',
        parentTaskId: 'root',
        subtaskIds: ['level2-a1', 'level2-a2'],
      })

      const level1TaskB = createTask({
        id: 'level1-b',
        description: 'Level 1 Task B',
        parentTaskId: 'root',
        subtaskIds: ['level2-b1'],
      })

      const level2TaskA1 = createTask({
        id: 'level2-a1',
        description: 'Level 2 Task A1',
        parentTaskId: 'level1-a',
        subtaskIds: ['level3-a1-1'],
      })

      const level2TaskA2 = createTask({
        id: 'level2-a2',
        description: 'Level 2 Task A2',
        parentTaskId: 'level1-a',
      })

      const level2TaskB1 = createTask({
        id: 'level2-b1',
        description: 'Level 2 Task B1',
        parentTaskId: 'level1-b',
      })

      const level3TaskA1_1 = createTask({
        id: 'level3-a1-1',
        description: 'Level 3 Task A1-1',
        parentTaskId: 'level2-a1',
      })

      const allTasks = [
        rootTask,
        level1TaskA,
        level1TaskB,
        level2TaskA1,
        level2TaskA2,
        level2TaskB1,
        level3TaskA1_1,
      ]

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'root',
        subtasks: allTasks,
        count: allTasks.length,
      })

      render(<SubtaskTree taskId="root" />)

      await waitFor(() => {
        expect(screen.getByText('Root task')).toBeInTheDocument()
      })

      // Check all levels are rendered
      expect(screen.getByText('Level 1 Task A')).toBeInTheDocument()
      expect(screen.getByText('Level 1 Task B')).toBeInTheDocument()
      expect(screen.getByText('Level 2 Task A1')).toBeInTheDocument()
      expect(screen.getByText('Level 2 Task A2')).toBeInTheDocument()
      expect(screen.getByText('Level 2 Task B1')).toBeInTheDocument()
      expect(screen.getByText('Level 3 Task A1-1')).toBeInTheDocument()
    })

    it('handles missing or orphaned task relationships', async () => {
      const parentTask = createTask({
        id: 'parent',
        description: 'Parent task',
        subtaskIds: ['valid-child', 'missing-child'], // missing-child doesn't exist
      })

      const validChild = createTask({
        id: 'valid-child',
        description: 'Valid child task',
        parentTaskId: 'parent',
      })

      const orphanedTask = createTask({
        id: 'orphaned',
        description: 'Orphaned task',
        parentTaskId: 'nonexistent-parent', // Parent doesn't exist
      })

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'parent',
        subtasks: [parentTask, validChild, orphanedTask],
        count: 3,
      })

      render(<SubtaskTree taskId="parent" />)

      await waitFor(() => {
        expect(screen.getByText('Parent task')).toBeInTheDocument()
      })

      // Valid child should be rendered
      expect(screen.getByText('Valid child task')).toBeInTheDocument()

      // Orphaned task should still be rendered at root level
      expect(screen.getByText('Orphaned task')).toBeInTheDocument()

      // Missing child should not cause errors
      expect(screen.queryByText('missing-child')).not.toBeInTheDocument()
    })
  })

  describe('Complex Tree Operations', () => {
    it('handles expand/collapse operations in deep hierarchies', async () => {
      const deepTree = createTask({
        id: 'root',
        description: 'Root with deep children',
        subtaskIds: ['child1'],
      })

      const child1 = createTask({
        id: 'child1',
        description: 'Child 1',
        parentTaskId: 'root',
        subtaskIds: ['grandchild1'],
      })

      const grandchild1 = createTask({
        id: 'grandchild1',
        description: 'Grandchild 1',
        parentTaskId: 'child1',
        subtaskIds: ['greatgrandchild1'],
      })

      const greatgrandchild1 = createTask({
        id: 'greatgrandchild1',
        description: 'Great-grandchild 1',
        parentTaskId: 'grandchild1',
      })

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'root',
        subtasks: [deepTree, child1, grandchild1, greatgrandchild1],
        count: 4,
      })

      render(<SubtaskTree taskId="root" />)

      await waitFor(() => {
        expect(screen.getByText('Root with deep children')).toBeInTheDocument()
      })

      // All levels should be visible initially
      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Grandchild 1')).toBeInTheDocument()
      expect(screen.getByText('Great-grandchild 1')).toBeInTheDocument()

      // Collapse grandchild level
      const grandchildChevron = screen.getAllByTestId('chevron-down')[1] // Second chevron
      await user.click(grandchildChevron)

      // Great-grandchild should be hidden
      expect(screen.queryByText('Great-grandchild 1')).not.toBeInTheDocument()
      expect(screen.getByText('Grandchild 1')).toBeInTheDocument()

      // Collapse child level
      const childChevron = screen.getAllByTestId('chevron-down')[0]
      await user.click(childChevron)

      // Child and below should be hidden
      expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Grandchild 1')).not.toBeInTheDocument()
    })

    it('handles tasks with many children efficiently', async () => {
      // Create a task with 20 children to test performance
      const parentTask = createTask({
        id: 'parent-many-children',
        description: 'Parent with many children',
        subtaskIds: Array.from({ length: 20 }, (_, i) => `child-${i}`),
      })

      const children = Array.from({ length: 20 }, (_, i) =>
        createTask({
          id: `child-${i}`,
          description: `Child task ${i}`,
          parentTaskId: 'parent-many-children',
          status: i % 4 === 0 ? 'completed' : i % 4 === 1 ? 'failed' : i % 4 === 2 ? 'in-progress' : 'pending',
        })
      )

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'parent-many-children',
        subtasks: [parentTask, ...children],
        count: 21,
      })

      const startTime = performance.now()
      render(<SubtaskTree taskId="parent-many-children" />)

      await waitFor(() => {
        expect(screen.getByText('Parent with many children')).toBeInTheDocument()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Check that all children are rendered
      for (let i = 0; i < 20; i++) {
        expect(screen.getByText(`Child task ${i}`)).toBeInTheDocument()
      }

      // Performance check - should render within reasonable time (500ms)
      expect(renderTime).toBeLessThan(500)

      // Check that collapse shows count correctly
      await user.click(screen.getByTestId('chevron-down'))
      expect(screen.getByText('(20 subtasks)')).toBeInTheDocument()
    })

    it('respects maxDepth in complex hierarchies', async () => {
      // Create 5 levels deep but limit to 3
      const level0 = createTask({ id: 'l0', description: 'Level 0', subtaskIds: ['l1'] })
      const level1 = createTask({ id: 'l1', description: 'Level 1', parentTaskId: 'l0', subtaskIds: ['l2'] })
      const level2 = createTask({ id: 'l2', description: 'Level 2', parentTaskId: 'l1', subtaskIds: ['l3'] })
      const level3 = createTask({ id: 'l3', description: 'Level 3', parentTaskId: 'l2', subtaskIds: ['l4'] })
      const level4 = createTask({ id: 'l4', description: 'Level 4', parentTaskId: 'l3' })

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'l0',
        subtasks: [level0, level1, level2, level3, level4],
        count: 5,
      })

      render(<SubtaskTree taskId="l0" maxDepth={3} />)

      await waitFor(() => {
        expect(screen.getByText('Level 0')).toBeInTheDocument()
      })

      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Level 2')).toBeInTheDocument()
      expect(screen.getByText('Level 3')).toBeInTheDocument()
      expect(screen.queryByText('Level 4')).not.toBeInTheDocument()
      expect(screen.getByText('... 1 more subtasks (max depth reached)')).toBeInTheDocument()
    })
  })

  describe('Real-world Scenarios', () => {
    it('handles task workflow progression', async () => {
      const tasks = [
        createTask({
          id: 'workflow-root',
          description: 'Feature development workflow',
          subtaskIds: ['planning', 'implementation', 'testing', 'deployment'],
        }),
        createTask({
          id: 'planning',
          description: 'Planning phase',
          parentTaskId: 'workflow-root',
          status: 'completed',
          subtaskIds: ['requirements', 'design'],
        }),
        createTask({
          id: 'implementation',
          description: 'Implementation phase',
          parentTaskId: 'workflow-root',
          status: 'in-progress',
          subtaskIds: ['backend', 'frontend'],
        }),
        createTask({
          id: 'testing',
          description: 'Testing phase',
          parentTaskId: 'workflow-root',
          status: 'pending',
        }),
        createTask({
          id: 'deployment',
          description: 'Deployment phase',
          parentTaskId: 'workflow-root',
          status: 'pending',
        }),
        createTask({
          id: 'requirements',
          description: 'Gather requirements',
          parentTaskId: 'planning',
          status: 'completed',
        }),
        createTask({
          id: 'design',
          description: 'Create design docs',
          parentTaskId: 'planning',
          status: 'completed',
        }),
        createTask({
          id: 'backend',
          description: 'Backend implementation',
          parentTaskId: 'implementation',
          status: 'completed',
        }),
        createTask({
          id: 'frontend',
          description: 'Frontend implementation',
          parentTaskId: 'implementation',
          status: 'in-progress',
        }),
      ]

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'workflow-root',
        subtasks: tasks,
        count: tasks.length,
      })

      render(<SubtaskTree taskId="workflow-root" />)

      await waitFor(() => {
        expect(screen.getByText('Feature development workflow')).toBeInTheDocument()
      })

      // Check status progression
      expect(screen.getByTestId('badge-completed')).toBeInTheDocument() // Planning
      expect(screen.getByTestId('badge-in-progress')).toBeInTheDocument() // Implementation
      expect(screen.getAllByTestId('badge-pending')).toHaveLength(2) // Testing & Deployment

      // Navigate to an in-progress task
      await user.click(screen.getByText('Frontend implementation'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/frontend')
    })

    it('handles task dependencies and blocking scenarios', async () => {
      const tasks = [
        createTask({
          id: 'blocked-root',
          description: 'Blocked task tree',
          subtaskIds: ['dependency', 'blocked-task'],
        }),
        createTask({
          id: 'dependency',
          description: 'Required dependency task',
          parentTaskId: 'blocked-root',
          status: 'in-progress',
        }),
        createTask({
          id: 'blocked-task',
          description: 'Task waiting for dependency',
          parentTaskId: 'blocked-root',
          status: 'pending',
          dependsOn: ['dependency'],
        }),
      ]

      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'blocked-root',
        subtasks: tasks,
        count: tasks.length,
      })

      render(<SubtaskTree taskId="blocked-root" />)

      await waitFor(() => {
        expect(screen.getByText('Blocked task tree')).toBeInTheDocument()
      })

      expect(screen.getByText('Required dependency task')).toBeInTheDocument()
      expect(screen.getByText('Task waiting for dependency')).toBeInTheDocument()

      // Both tasks should be visible with correct statuses
      expect(screen.getByTestId('badge-in-progress')).toBeInTheDocument()
      expect(screen.getByTestId('badge-pending')).toBeInTheDocument()
    })
  })

  describe('Performance and Edge Cases', () => {
    it('handles empty subtask response gracefully', async () => {
      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'empty-task',
        subtasks: [],
        count: 0,
      })

      render(<SubtaskTree taskId="empty-task" />)

      await waitFor(() => {
        expect(screen.getByText('No subtasks found')).toBeInTheDocument()
      })

      expect(mockGetSubtasks).toHaveBeenCalledWith('empty-task')
    })

    it('handles malformed API response gracefully', async () => {
      mockGetSubtasks.mockResolvedValue({
        parentTaskId: 'malformed-task',
        subtasks: null, // Malformed data
        count: 0,
      })

      render(<SubtaskTree taskId="malformed-task" />)

      // Should not crash and show appropriate state
      await waitFor(() => {
        expect(screen.getByText('No subtasks found')).toBeInTheDocument()
      })
    })

    it('handles concurrent API calls correctly', async () => {
      let resolveFirst: (value: any) => void
      let resolveSecond: (value: any) => void

      const firstCall = new Promise((resolve) => {
        resolveFirst = resolve
      })

      const secondCall = new Promise((resolve) => {
        resolveSecond = resolve
      })

      mockGetSubtasks.mockReturnValueOnce(firstCall).mockReturnValueOnce(secondCall)

      const { rerender } = render(<SubtaskTree taskId="first-task" />)

      // Change to different task while first is loading
      rerender(<SubtaskTree taskId="second-task" />)

      // Resolve second call first
      resolveSecond!({
        parentTaskId: 'second-task',
        subtasks: [createTask({ id: 'second-task', description: 'Second task' })],
        count: 1,
      })

      await waitFor(() => {
        expect(screen.getByText('Second task')).toBeInTheDocument()
      })

      // Resolve first call (should be ignored)
      resolveFirst!({
        parentTaskId: 'first-task',
        subtasks: [createTask({ id: 'first-task', description: 'First task' })],
        count: 1,
      })

      // Should still show second task
      expect(screen.getByText('Second task')).toBeInTheDocument()
      expect(screen.queryByText('First task')).not.toBeInTheDocument()
    })
  })
})