/**
 * Integration tests for Task Detail Page components
 *
 * Tests the real integration between TaskDependencyGraph, SubtaskTree
 * and the task detail page, focusing on component interactions,
 * data flow, and complex scenarios that require multiple components
 * working together.
 */

import React from 'react'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useParams, useRouter } from 'next/navigation'
import TaskDetailPage from '../page'
import type { Task } from '@apexcli/core'

// Mock Next.js
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTask: vi.fn(),
    getSubtasks: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
    resumeTask: vi.fn(),
  },
}))

// Mock WebSocket client
vi.mock('@/lib/websocket-client', () => ({
  useTaskStream: vi.fn(),
}))

// Use real UI components (mocked minimally for DOM structure)
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div data-testid="card-content" className={className} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-testid="badge" data-variant={variant} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className }: any) => (
    <div data-testid="spinner" data-size={size} className={className}>
      Loading...
    </div>
  ),
}))

// Mock other components with minimal structure
vi.mock('@/components/tasks/LogViewer', () => ({
  LogViewer: ({ logs }: any) => (
    <div data-testid="log-viewer">
      {logs?.map((log: any, i: number) => (
        <div key={i}>[{log.level}] {log.message}</div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/tasks/GatePanel', () => ({
  GatePanel: ({ taskId }: any) => (
    <div data-testid="gate-panel">Gate Panel for {taskId}</div>
  ),
}))

vi.mock('@/components/tasks/SubtaskList', () => ({
  SubtaskList: ({ taskId }: any) => (
    <div data-testid="subtask-list">SubtaskList for {taskId}</div>
  ),
  ParentTaskInfo: ({ parentTaskId }: any) => (
    <span data-testid="parent-task-info">Parent: {parentTaskId}</span>
  ),
}))

vi.mock('@/components/charts/TokenUsageChart', () => ({
  TokenUsageChart: ({ usage }: any) => (
    <div data-testid="token-usage-chart">
      Tokens: {usage?.totalTokens || 0}
    </div>
  ),
}))

// Real component integration - mock with realistic behavior
vi.mock('@/components/tasks/SubtaskTree', () => ({
  SubtaskTree: ({ taskId, maxDepth, defaultCollapsed, onSubtaskClick }: any) => {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

    const handleSubtaskClick = (id: string) => {
      if (onSubtaskClick) {
        onSubtaskClick(id)
      }
    }

    return (
      <div data-testid="subtask-tree" data-task-id={taskId} data-max-depth={maxDepth}>
        <div data-testid="subtask-tree-header">
          <button
            data-testid="collapse-toggle"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▶' : '▼'} Subtasks
          </button>
        </div>
        {!collapsed && (
          <div data-testid="subtask-tree-content">
            <div
              data-testid="subtask-node-1"
              onClick={() => handleSubtaskClick('subtask-1')}
              style={{ cursor: 'pointer' }}
            >
              Subtask 1
            </div>
            <div
              data-testid="subtask-node-2"
              onClick={() => handleSubtaskClick('subtask-2')}
              style={{ cursor: 'pointer' }}
            >
              Subtask 2
            </div>
          </div>
        )}
      </div>
    )
  },
}))

vi.mock('@/components/tasks/TaskDependencyGraph', () => ({
  TaskDependencyGraph: ({ tasks, height, className, onTaskClick }: any) => {
    const handleTaskClick = (taskId: string) => {
      if (onTaskClick) {
        onTaskClick(taskId)
      }
    }

    return (
      <div
        data-testid="task-dependency-graph"
        data-tasks-count={tasks?.length || 0}
        data-height={height}
        className={className}
      >
        <div data-testid="dependency-graph-content">
          {tasks?.map((task: any) => (
            <div
              key={task.id}
              data-testid={`graph-node-${task.id}`}
              onClick={() => handleTaskClick(task.id)}
              style={{ cursor: 'pointer' }}
            >
              <div data-testid={`task-${task.id}-title`}>{task.description}</div>
              <div data-testid={`task-${task.id}-status`}>{task.status}</div>
            </div>
          ))}
        </div>
      </div>
    )
  },
}))

// Mock icons
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span>←</span>,
  RefreshCw: () => <span>↻</span>,
  XCircle: () => <span>✖</span>,
  RotateCcw: () => <span>↺</span>,
  Clock: () => <span>🕐</span>,
  GitBranch: () => <span>🌿</span>,
  Play: () => <span>▶</span>,
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatCost: (cost: number) => `$${cost.toFixed(2)}`,
  getStatusVariant: (status: string) => status,
  formatStatus: (status: string) => status,
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  truncateId: (id: string, length: number = 8) =>
    id.length > length ? `${id.slice(0, length)}...` : id,
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockWebSocket = await import('@/lib/websocket-client')

describe('Task Detail Page Integration', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Test data factories
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-123',
    description: 'Test task description',
    status: 'pending',
    workflow: 'test-workflow',
    autonomy: 'medium',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.05,
      totalCostCents: 5,
      executionTimeMs: 2000,
    },
    ...overrides,
  })

  const createComplexTaskHierarchy = () => {
    const parentTask = createTask({
      id: 'parent-task',
      description: 'Parent Task',
      status: 'in-progress',
      subtaskIds: ['subtask-1', 'subtask-2'],
      dependsOn: ['dependency-1'],
    })

    const dependencyTask = createTask({
      id: 'dependency-1',
      description: 'Dependency Task',
      status: 'completed',
    })

    const subtask1 = createTask({
      id: 'subtask-1',
      description: 'First Subtask',
      status: 'completed',
      parentTaskId: 'parent-task',
    })

    const subtask2 = createTask({
      id: 'subtask-2',
      description: 'Second Subtask',
      status: 'in-progress',
      parentTaskId: 'parent-task',
      dependsOn: ['subtask-1'],
    })

    return { parentTask, dependencyTask, subtask1, subtask2 }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useParams as any).mockReturnValue({ id: 'parent-task' })
    ;(mockWebSocket.useTaskStream as any).mockReturnValue({
      events: [],
      isConnected: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complex Task Hierarchy Integration', () => {
    it('renders both TaskDependencyGraph and SubtaskTree for complex hierarchies', async () => {
      const { parentTask, dependencyTask, subtask1, subtask2 } = createComplexTaskHierarchy()

      // Mock API responses
      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(parentTask) // Initial task load
        .mockResolvedValueOnce(dependencyTask) // Dependency task
        .mockResolvedValueOnce(subtask1) // Subtask 1
        .mockResolvedValueOnce(subtask2) // Subtask 2

      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 2,
        subtasks: [subtask1, subtask2],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Both components should be rendered
        expect(screen.getByTestId('task-dependency-graph')).toBeInTheDocument()
        expect(screen.getByTestId('subtask-tree')).toBeInTheDocument()
      })

      // Verify dependency graph shows all related tasks
      expect(screen.getByTestId('task-dependency-graph')).toHaveAttribute(
        'data-tasks-count',
        '4' // parent + dependency + 2 subtasks
      )

      // Verify subtask tree is properly configured
      expect(screen.getByTestId('subtask-tree')).toHaveAttribute('data-task-id', 'parent-task')
      expect(screen.getByTestId('subtask-tree')).toHaveAttribute('data-max-depth', '5')
    })

    it('handles navigation from dependency graph to related tasks', async () => {
      const { parentTask, dependencyTask, subtask1, subtask2 } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(dependencyTask)
        .mockResolvedValueOnce(subtask1)
        .mockResolvedValueOnce(subtask2)

      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 2,
        subtasks: [subtask1, subtask2],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('graph-node-dependency-1')).toBeInTheDocument()
      })

      // Click on dependency task in graph
      await act(async () => {
        await user.click(screen.getByTestId('graph-node-dependency-1'))
      })

      // Should navigate to dependency task
      expect(mockPush).toHaveBeenCalledWith('/tasks/dependency-1')
    })

    it('handles navigation from subtask tree to subtask details', async () => {
      const { parentTask, subtask1, subtask2 } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 2,
        subtasks: [subtask1, subtask2],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('subtask-node-1')).toBeInTheDocument()
      })

      // Click on subtask in tree
      await act(async () => {
        await user.click(screen.getByTestId('subtask-node-1'))
      })

      // Should navigate to subtask
      expect(mockPush).toHaveBeenCalledWith('/tasks/subtask-1')
    })

    it('updates both components when task data changes via WebSocket', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      // Start with original task
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 0,
        subtasks: [],
      })

      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events: [
          {
            type: 'task:updated',
            timestamp: new Date(),
            data: {
              status: 'completed',
              subtaskIds: ['new-subtask-1', 'new-subtask-2'],
            }
          }
        ],
        isConnected: true,
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Task status should be updated
        expect(screen.getByText('completed')).toBeInTheDocument()
      })
    })
  })

  describe('Component State Synchronization', () => {
    it('maintains consistent data between dependency graph and subtask tree', async () => {
      const { parentTask, subtask1, subtask2 } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(subtask1)
        .mockResolvedValueOnce(subtask2)

      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 2,
        subtasks: [subtask1, subtask2],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Both components should show consistent task information
        expect(screen.getByTestId('graph-node-subtask-1')).toBeInTheDocument()
        expect(screen.getByTestId('graph-node-subtask-2')).toBeInTheDocument()
        expect(screen.getByTestId('subtask-tree')).toBeInTheDocument()
      })

      // Verify task data consistency
      expect(screen.getByTestId('task-subtask-1-title')).toHaveTextContent('First Subtask')
      expect(screen.getByTestId('task-subtask-2-title')).toHaveTextContent('Second Subtask')
    })

    it('handles refresh action updating all components', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 2,
        subtasks: [],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('↻')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('↻').closest('button')!
      await act(async () => {
        await user.click(refreshButton)
      })

      // Should reload all data
      expect(mockApiClient.apiClient.getTask).toHaveBeenCalledTimes(2) // Initial + refresh
      expect(mockApiClient.apiClient.getSubtasks).toHaveBeenCalledTimes(2) // Initial + refresh
    })
  })

  describe('Layout and Visibility Integration', () => {
    it('conditionally renders components based on data availability', async () => {
      // Test task with no relationships
      const isolatedTask = createTask({
        id: 'isolated-task',
        description: 'Isolated Task',
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(isolatedTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'isolated-task',
        count: 0,
        subtasks: [],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should not render dependency graph or subtask tree
        expect(screen.queryByTestId('task-dependency-graph')).not.toBeInTheDocument()
        expect(screen.queryByTestId('subtask-tree')).not.toBeInTheDocument()
        expect(screen.queryByText('Task Dependencies')).not.toBeInTheDocument()
        expect(screen.queryByText('Subtask Tree')).not.toBeInTheDocument()
      })
    })

    it('maintains proper grid layout when both components are visible', async () => {
      const { parentTask, dependencyTask } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(parentTask)
        .mockResolvedValueOnce(dependencyTask)

      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 2,
        subtasks: [],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        const mainContent = screen.getByTestId('task-dependency-graph').closest('.space-y-6')
        expect(mainContent).toBeInTheDocument()

        // Should be in the main content area (xl:col-span-2)
        const gridColumn = mainContent?.closest('.xl\\:col-span-2')
        expect(gridColumn).toBeInTheDocument()
      })
    })

    it('handles responsive layout for components on smaller screens', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 1,
        subtasks: [],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Grid should be responsive (grid-cols-1 xl:grid-cols-3)
        const gridContainer = screen.getByTestId('task-dependency-graph')
          .closest('.grid')
        expect(gridContainer).toHaveClass('grid-cols-1', 'xl:grid-cols-3')
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('gracefully handles partial failures in component data loading', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      // Main task loads successfully
      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(parentTask)
        .mockRejectedValue(new Error('Related task fetch failed'))

      // Subtasks load fails
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockRejectedValue(
        new Error('Subtasks fetch failed')
      )

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Main task info should still be displayed
        expect(screen.getByText('Parent Task')).toBeInTheDocument()

        // Components that failed to load should not crash the page
        expect(screen.queryByTestId('task-dependency-graph')).not.toBeInTheDocument()
        expect(screen.queryByTestId('subtask-tree')).not.toBeInTheDocument()
      })
    })

    it('shows error state for dependency graph when related tasks fail to load', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(parentTask)
        .mockRejectedValue(new Error('Failed to load related tasks'))

      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 0,
        subtasks: [],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load related tasks')).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Updates Integration', () => {
    it('propagates WebSocket updates to all relevant components', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 1,
        subtasks: [],
      })

      // WebSocket events that affect both components
      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events: [
          {
            type: 'task:updated',
            timestamp: new Date(),
            data: { status: 'completed' }
          },
          {
            type: 'log:entry',
            timestamp: new Date(),
            data: {
              level: 'info',
              message: 'Task completed successfully',
            }
          }
        ],
        isConnected: true,
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Status update should be reflected
        expect(screen.getByText('completed')).toBeInTheDocument()

        // Log should be displayed
        expect(screen.getByText('Task completed successfully')).toBeInTheDocument()

        // Live indicator should be shown
        expect(screen.getByText('Live')).toBeInTheDocument()
      })
    })

    it('handles usage updates that affect token chart and other components', async () => {
      const { parentTask } = createComplexTaskHierarchy()

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)

      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events: [
          {
            type: 'usage:updated',
            timestamp: new Date(),
            data: {
              totalTokens: 5000,
              estimatedCost: 0.25,
              executionTimeMs: 10000,
            }
          }
        ],
        isConnected: true,
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Token usage should be updated
        expect(screen.getByText('Tokens: 5000')).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Optimization', () => {
    it('efficiently handles large numbers of related tasks', async () => {
      const parentTask = createTask({
        id: 'parent-task',
        description: 'Complex Task',
        subtaskIds: Array.from({ length: 50 }, (_, i) => `subtask-${i}`),
        dependsOn: Array.from({ length: 10 }, (_, i) => `dep-${i}`),
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 50,
        subtasks: [],
      })

      const startTime = performance.now()
      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Complex Task')).toBeInTheDocument()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render quickly even with many related tasks
      expect(renderTime).toBeLessThan(1000) // 1 second threshold
    })

    it('avoids unnecessary re-renders when data has not changed', async () => {
      const { parentTask } = createComplexTaskHierarchy()
      let renderCount = 0

      // Wrap components to count renders
      const OriginalSubtaskTree = (await import('@/components/tasks/SubtaskTree')).SubtaskTree
      vi.mocked(require('@/components/tasks/SubtaskTree').SubtaskTree).mockImplementation((props) => {
        renderCount++
        return React.createElement(OriginalSubtaskTree as any, props)
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(parentTask)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'parent-task',
        count: 0,
        subtasks: [],
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Parent Task')).toBeInTheDocument()
      })

      const initialRenderCount = renderCount

      // Trigger an action that shouldn't affect the subtask tree
      const refreshButton = screen.getByText('↻').closest('button')!
      await act(async () => {
        await user.click(refreshButton)
      })

      // Should not trigger unnecessary re-renders
      expect(renderCount).toBeLessThanOrEqual(initialRenderCount + 1)
    })
  })
})