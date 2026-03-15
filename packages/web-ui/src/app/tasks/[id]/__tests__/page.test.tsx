/**
 * Unit tests for Task Detail Page (/tasks/[id]/page.tsx)
 *
 * Tests the integration of TaskDependencyGraph and SubtaskTree components
 * into the task detail page with proper layout, data fetching, error handling,
 * and responsive design.
 *
 * Covers:
 * - Component integration and prop passing
 * - Data fetching and state management
 * - Error states and edge cases
 * - Responsive layout behavior
 * - WebSocket real-time updates
 * - Task action handling (cancel, retry, resume)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useParams, useRouter } from 'next/navigation'
import TaskDetailPage from '../page'
import type { Task } from '@apexcli/core'

// Mock Next.js router and params
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}))

// Mock API client with all required methods
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

// Mock UI components to avoid dependency issues
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
  Spinner: ({ size, className, ...props }: any) => (
    <div data-testid="spinner" data-size={size} className={className} {...props}>
      Loading...
    </div>
  ),
}))

// Mock task components
vi.mock('@/components/tasks/LogViewer', () => ({
  LogViewer: ({ logs, maxHeight, ...props }: any) => (
    <div data-testid="log-viewer" data-logs-count={logs?.length || 0} data-max-height={maxHeight} {...props}>
      {logs?.map((log: any, i: number) => (
        <div key={i} data-testid={`log-entry-${i}`}>
          [{log.level}] {log.message}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/tasks/GatePanel', () => ({
  GatePanel: ({ taskId, onApproved, onRejected, ...props }: any) => (
    <div data-testid="gate-panel" data-task-id={taskId} {...props}>
      <button data-testid="approve-button" onClick={() => onApproved?.()}>
        Approve
      </button>
      <button data-testid="reject-button" onClick={() => onRejected?.()}>
        Reject
      </button>
    </div>
  ),
}))

vi.mock('@/components/tasks/SubtaskList', () => ({
  SubtaskList: ({ taskId, ...props }: any) => (
    <div data-testid="subtask-list" data-task-id={taskId} {...props}>
      Subtask List Component
    </div>
  ),
  ParentTaskInfo: ({ parentTaskId, ...props }: any) => (
    <span data-testid="parent-task-info" data-parent-id={parentTaskId} {...props}>
      Parent: {parentTaskId}
    </span>
  ),
}))

// Mock the main components being tested
vi.mock('@/components/tasks/SubtaskTree', () => ({
  SubtaskTree: ({ taskId, maxDepth, defaultCollapsed, ...props }: any) => (
    <div
      data-testid="subtask-tree"
      data-task-id={taskId}
      data-max-depth={maxDepth}
      data-default-collapsed={defaultCollapsed}
      {...props}
    >
      SubtaskTree Component
    </div>
  ),
}))

vi.mock('@/components/tasks/TaskDependencyGraph', () => ({
  TaskDependencyGraph: ({ tasks, height, className, ...props }: any) => (
    <div
      data-testid="task-dependency-graph"
      data-tasks-count={tasks?.length || 0}
      data-height={height}
      className={className}
      {...props}
    >
      TaskDependencyGraph Component
      {tasks?.map((task: any) => (
        <div key={task.id} data-testid={`graph-task-${task.id}`}>
          {task.description}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/charts/TokenUsageChart', () => ({
  TokenUsageChart: ({ usage, ...props }: any) => (
    <div data-testid="token-usage-chart" data-total-tokens={usage?.totalTokens || 0} {...props}>
      Token Usage Chart
    </div>
  ),
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <div data-testid="chevron-left">←</div>,
  RefreshCw: () => <div data-testid="refresh-icon">↻</div>,
  XCircle: () => <div data-testid="x-circle-icon">✖</div>,
  RotateCcw: () => <div data-testid="rotate-ccw-icon">↺</div>,
  Clock: () => <div data-testid="clock-icon">🕐</div>,
  GitBranch: () => <div data-testid="git-branch-icon">🌿</div>,
  Play: () => <div data-testid="play-icon">▶</div>,
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn((status: string) => {
    const variants: Record<string, string> = {
      'pending': 'secondary',
      'in-progress': 'primary',
      'completed': 'success',
      'failed': 'danger',
      'cancelled': 'secondary',
    }
    return variants[status] || 'secondary'
  }),
  formatStatus: vi.fn((status: string) => status.replace('-', ' ')),
  formatDate: vi.fn((date: string) => new Date(date).toLocaleDateString()),
  truncateId: vi.fn((id: string, length: number = 8) =>
    id.length > length ? `${id.slice(0, length)}...` : id
  ),
}))

// Mock Next Link component
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockWebSocket = await import('@/lib/websocket-client')

describe('Task Detail Page', () => {
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

  const createTaskWithRelationships = (overrides: Partial<Task> = {}): Task => ({
    ...createTask(),
    dependsOn: ['dependency-task-1'],
    blockedBy: ['blocking-task-1'],
    parentTaskId: 'parent-task-1',
    subtaskIds: ['subtask-1', 'subtask-2'],
    ...overrides,
  })

  const createSubtasksResponse = (count: number = 2) => ({
    parentTaskId: 'task-123',
    count,
    subtasks: Array.from({ length: count }, (_, i) =>
      createTask({
        id: `subtask-${i + 1}`,
        description: `Subtask ${i + 1}`,
        status: i === 0 ? 'pending' : 'completed',
        parentTaskId: 'task-123'
      })
    ),
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useParams as any).mockReturnValue({ id: 'task-123' })
    ;(mockWebSocket.useTaskStream as any).mockReturnValue({
      events: [],
      isConnected: false,
    })

    // Default API responses
    vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(createTask())
    vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue(createSubtasksResponse())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
    vi.mocked(mockApiClient.apiClient.resumeTask).mockResolvedValue({ ok: true, message: 'Task resumed' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Loading', () => {
    it('shows loading spinner while fetching task data', async () => {
      // Make API call hang to test loading state
      vi.mocked(mockApiClient.apiClient.getTask).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<TaskDetailPage />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })

    it('loads task and subtasks on mount', async () => {
      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      expect(mockApiClient.apiClient.getTask).toHaveBeenCalledWith('task-123')
      expect(mockApiClient.apiClient.getSubtasks).toHaveBeenCalledWith('task-123')
    })

    it('displays task information after loading', async () => {
      const task = createTask({
        description: 'Implement user authentication',
        status: 'in-progress',
        workflow: 'feature-workflow',
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Implement user authentication')).toBeInTheDocument()
        expect(screen.getByText('feature-workflow')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message when task fetch fails', async () => {
      const errorMessage = 'Task not found'
      vi.mocked(mockApiClient.apiClient.getTask).mockRejectedValue(new Error(errorMessage))

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('allows retry when task fetch fails', async () => {
      vi.mocked(mockApiClient.apiClient.getTask)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createTask())

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      await waitFor(() => {
        expect(mockApiClient.apiClient.getTask).toHaveBeenCalledTimes(2)
        expect(screen.queryByText('Network error')).not.toBeInTheDocument()
      })
    })

    it('displays task not found message when task is null', async () => {
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(null as any)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Task not found')).toBeInTheDocument()
      })
    })
  })

  describe('TaskDependencyGraph Integration', () => {
    it('renders TaskDependencyGraph when task has related tasks', async () => {
      const mainTask = createTaskWithRelationships()
      const relatedTasks = [
        createTask({ id: 'dependency-task-1', description: 'Dependency task' }),
        createTask({ id: 'blocking-task-1', description: 'Blocking task' }),
        createTask({ id: 'parent-task-1', description: 'Parent task' }),
        createTask({ id: 'subtask-1', description: 'Child task 1' }),
        createTask({ id: 'subtask-2', description: 'Child task 2' }),
      ]

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(mainTask)

      // Mock successful fetches for related tasks
      relatedTasks.forEach((task) => {
        vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValueOnce(task)
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-dependency-graph')).toBeInTheDocument()
      })

      // Should include main task + related tasks
      expect(screen.getByTestId('task-dependency-graph')).toHaveAttribute(
        'data-tasks-count',
        '6' // 1 main + 5 related
      )

      // Check that it's rendered in a card
      expect(screen.getByText('Task Dependencies')).toBeInTheDocument()
    })

    it('passes correct props to TaskDependencyGraph', async () => {
      const task = createTaskWithRelationships()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const graph = screen.getByTestId('task-dependency-graph')
        expect(graph).toHaveAttribute('data-height', '300')
        expect(graph).toHaveClass('border-0')
      })
    })

    it('handles related task fetch failures gracefully', async () => {
      const task = createTaskWithRelationships()
      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(task)
        .mockRejectedValue(new Error('Related task not found'))

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should still render the dependency graph with just the main task
        expect(screen.getByTestId('task-dependency-graph')).toBeInTheDocument()
        expect(screen.getByTestId('task-dependency-graph')).toHaveAttribute(
          'data-tasks-count',
          '1' // Only main task
        )
      })
    })

    it('does not render TaskDependencyGraph when no related tasks exist', async () => {
      const task = createTask() // No related tasks
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('task-dependency-graph')).not.toBeInTheDocument()
        expect(screen.queryByText('Task Dependencies')).not.toBeInTheDocument()
      })
    })

    it('shows loading state for dependencies', async () => {
      const task = createTaskWithRelationships()
      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(task)
        .mockImplementation(() => new Promise(() => {})) // Hang related task fetches

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Task Dependencies')).toBeInTheDocument()
        expect(screen.getByTestId('spinner')).toBeInTheDocument()
      })
    })

    it('shows error message for dependencies fetch failure', async () => {
      const task = createTaskWithRelationships()
      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(task)
        .mockRejectedValue(new Error('Failed to load related tasks'))

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load related tasks')).toBeInTheDocument()
      })
    })
  })

  describe('SubtaskTree Integration', () => {
    it('renders SubtaskTree when task has subtasks', async () => {
      const task = createTask()
      const subtasksResponse = createSubtasksResponse(3)

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue(subtasksResponse)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('subtask-tree')).toBeInTheDocument()
        expect(screen.getByText('Subtask Tree')).toBeInTheDocument()
      })
    })

    it('passes correct props to SubtaskTree', async () => {
      const task = createTask({ id: 'task-456' })
      const subtasksResponse = createSubtasksResponse(2)

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue(subtasksResponse)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const subtaskTree = screen.getByTestId('subtask-tree')
        expect(subtaskTree).toHaveAttribute('data-task-id', 'task-456')
        expect(subtaskTree).toHaveAttribute('data-max-depth', '5')
        expect(subtaskTree).toHaveAttribute('data-default-collapsed', 'false')
      })
    })

    it('does not render SubtaskTree when no subtasks exist', async () => {
      const task = createTask()
      const subtasksResponse = createSubtasksResponse(0)

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue(subtasksResponse)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('subtask-tree')).not.toBeInTheDocument()
        expect(screen.queryByText('Subtask Tree')).not.toBeInTheDocument()
      })
    })

    it('still renders legacy SubtaskList for compatibility', async () => {
      const task = createTask()
      const subtasksResponse = createSubtasksResponse(2)

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue(subtasksResponse)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('subtask-list')).toBeInTheDocument()
      })
    })

    it('handles subtasks fetch failure gracefully', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockRejectedValue(new Error('Subtasks fetch failed'))

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should not crash, and subtask components should not be rendered
        expect(screen.queryByTestId('subtask-tree')).not.toBeInTheDocument()
        expect(screen.queryByTestId('subtask-list')).not.toBeInTheDocument()
      })
    })
  })

  describe('Layout and Responsive Design', () => {
    it('renders with proper grid layout structure', async () => {
      const task = createTaskWithRelationships()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const container = screen.getByText('Test task description').closest('.grid')
        expect(container).toHaveClass('grid-cols-1', 'xl:grid-cols-3')
      })
    })

    it('places main content in correct grid column', async () => {
      const task = createTaskWithRelationships()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Main content should be in xl:col-span-2
        const mainContent = screen.getByTestId('task-dependency-graph').closest('.xl\\:col-span-2')
        expect(mainContent).toBeInTheDocument()
      })
    })

    it('renders sidebar components correctly', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
        expect(screen.getByText('Details')).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Updates', () => {
    it('connects to WebSocket stream for real-time updates', async () => {
      render(<TaskDetailPage />)

      expect(mockWebSocket.useTaskStream).toHaveBeenCalledWith('task-123')
    })

    it('shows live indicator when WebSocket is connected', async () => {
      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events: [],
        isConnected: true,
      })

      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument()
      })
    })

    it('processes task update events', async () => {
      const updatedTask = createTask({ status: 'completed' })

      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events: [
          {
            type: 'task:updated',
            timestamp: new Date(),
            data: { status: 'completed' }
          }
        ],
        isConnected: true,
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(createTask())

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Status should be updated via WebSocket event
        expect(screen.getByText('completed')).toBeInTheDocument()
      })
    })

    it('processes log entry events', async () => {
      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events: [
          {
            type: 'log:entry',
            timestamp: new Date(),
            data: {
              level: 'info',
              message: 'Task started processing',
              agent: 'test-agent'
            }
          }
        ],
        isConnected: true,
      })

      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('log-viewer')).toBeInTheDocument()
        expect(screen.getByText('Task started processing')).toBeInTheDocument()
      })
    })
  })

  describe('Task Actions', () => {
    it('handles cancel action for running tasks', async () => {
      const task = createTask({ status: 'in-progress' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel')
        expect(cancelButton).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('Cancel')
      await act(async () => {
        await user.click(cancelButton)
      })

      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('task-123')
    })

    it('handles retry action for failed tasks', async () => {
      const task = createTask({ status: 'failed' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const retryButton = screen.getByText('Retry')
        expect(retryButton).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      expect(mockApiClient.apiClient.retryTask).toHaveBeenCalledWith('task-123')
    })

    it('handles resume action for paused tasks', async () => {
      const task = createTask({ status: 'paused' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const resumeButton = screen.getByText('Resume')
        expect(resumeButton).toBeInTheDocument()
      })

      const resumeButton = screen.getByText('Resume')
      await act(async () => {
        await user.click(resumeButton)
      })

      expect(mockApiClient.apiClient.resumeTask).toHaveBeenCalledWith('task-123')
    })

    it('shows loading state during action execution', async () => {
      const task = createTask({ status: 'in-progress' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.cancelTask).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('Cancel')
      await act(async () => {
        await user.click(cancelButton)
      })

      expect(cancelButton).toBeDisabled()
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })

    it('shows correct action buttons based on task status', async () => {
      // Test different statuses
      const testCases = [
        { status: 'in-progress', expectedActions: ['Cancel', 'Restart'] },
        { status: 'failed', expectedActions: ['Retry'] },
        { status: 'paused', expectedActions: ['Resume'] },
        { status: 'completed', expectedActions: [] },
      ]

      for (const testCase of testCases) {
        const task = createTask({ status: testCase.status as any })
        vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

        const { unmount } = render(<TaskDetailPage />)

        await waitFor(() => {
          testCase.expectedActions.forEach(action => {
            expect(screen.getByText(action)).toBeInTheDocument()
          })
        })

        unmount()
      }
    })
  })

  describe('Approval Gate Integration', () => {
    it('renders GatePanel for tasks waiting approval', async () => {
      const task = createTask({ status: 'waiting-approval' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-panel')).toBeInTheDocument()
        expect(screen.getByTestId('gate-panel')).toHaveAttribute('data-task-id', 'task-123')
      })
    })

    it('does not render GatePanel for other statuses', async () => {
      const task = createTask({ status: 'in-progress' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('gate-panel')).not.toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('renders back to tasks link', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const backLink = screen.getByText('Back to Tasks').closest('a')
        expect(backLink).toHaveAttribute('href', '/tasks')
      })
    })

    it('shows parent task info when task has parent', async () => {
      const task = createTask({ parentTaskId: 'parent-123' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('parent-task-info')).toBeInTheDocument()
        expect(screen.getByTestId('parent-task-info')).toHaveAttribute('data-parent-id', 'parent-123')
      })
    })
  })

  describe('Component Props and Data Flow', () => {
    it('passes correct task data to all components', async () => {
      const task = createTask({
        id: 'test-task-456',
        usage: {
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          estimatedCost: 0.15,
          totalCostCents: 15,
          executionTimeMs: 5000,
        }
      })

      const subtasksResponse = createSubtasksResponse(2)

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue(subtasksResponse)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Check SubtaskTree props
        expect(screen.getByTestId('subtask-tree')).toHaveAttribute('data-task-id', 'test-task-456')

        // Check TokenUsageChart props
        expect(screen.getByTestId('token-usage-chart')).toHaveAttribute('data-total-tokens', '3000')

        // Check SubtaskList props
        expect(screen.getByTestId('subtask-list')).toHaveAttribute('data-task-id', 'test-task-456')
      })
    })

    it('refreshes all data when refresh button is clicked', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
      })

      const refreshButton = screen.getByTestId('refresh-icon').closest('button')!
      await act(async () => {
        await user.click(refreshButton)
      })

      // Should call APIs again
      expect(mockApiClient.apiClient.getTask).toHaveBeenCalledTimes(2)
      expect(mockApiClient.apiClient.getSubtasks).toHaveBeenCalledTimes(2)
    })
  })
})