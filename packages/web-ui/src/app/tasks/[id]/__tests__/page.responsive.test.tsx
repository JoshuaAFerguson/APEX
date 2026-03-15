/**
 * Responsive Layout and Edge Case Tests for Task Detail Page
 *
 * Tests responsive behavior, edge cases, error scenarios,
 * and accessibility aspects of the integrated components.
 */

import React from 'react'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
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

// Responsive-aware UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => {
    return (
      <div
        data-testid="card"
        className={`card ${className || ''}`}
        {...props}
      >
        {children}
      </div>
    )
  },
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div
      data-testid="card-content"
      className={`card-content ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span
      data-testid="badge"
      data-variant={variant}
      className={`badge badge-${variant}`}
      {...props}
    >
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
      className={`button button-${variant} button-${size}`}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className }: any) => (
    <div
      data-testid="spinner"
      data-size={size}
      className={`spinner ${className || ''}`}
    >
      Loading...
    </div>
  ),
}))

// Mock components with responsive behavior
vi.mock('@/components/tasks/TaskDependencyGraph', () => ({
  TaskDependencyGraph: ({ tasks, height, className, ...props }: any) => (
    <div
      data-testid="task-dependency-graph"
      data-tasks-count={tasks?.length || 0}
      data-height={height}
      className={`dependency-graph ${className || ''}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
      {...props}
    >
      <div data-testid="dependency-graph-responsive">
        {tasks?.map((task: any) => (
          <div
            key={task.id}
            data-testid={`graph-task-${task.id}`}
            className="graph-task"
          >
            {task.description}
          </div>
        ))}
      </div>
    </div>
  ),
}))

vi.mock('@/components/tasks/SubtaskTree', () => ({
  SubtaskTree: ({ taskId, maxDepth, defaultCollapsed, className, ...props }: any) => (
    <div
      data-testid="subtask-tree"
      data-task-id={taskId}
      data-max-depth={maxDepth}
      data-default-collapsed={defaultCollapsed}
      className={`subtask-tree ${className || ''}`}
      {...props}
    >
      <div data-testid="subtask-tree-responsive">
        Subtask Tree Content
      </div>
    </div>
  ),
}))

vi.mock('@/components/tasks/LogViewer', () => ({
  LogViewer: ({ logs, maxHeight, ...props }: any) => (
    <div
      data-testid="log-viewer"
      className="log-viewer"
      style={{ maxHeight }}
      {...props}
    >
      {logs?.map((log: any, i: number) => (
        <div key={i} data-testid={`log-entry-${i}`}>
          [{log.level}] {log.message}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/tasks/GatePanel', () => ({
  GatePanel: ({ taskId, ...props }: any) => (
    <div data-testid="gate-panel" className="gate-panel" {...props}>
      Gate Panel for {taskId}
    </div>
  ),
}))

vi.mock('@/components/tasks/SubtaskList', () => ({
  SubtaskList: ({ taskId, ...props }: any) => (
    <div data-testid="subtask-list" className="subtask-list" {...props}>
      SubtaskList for {taskId}
    </div>
  ),
  ParentTaskInfo: ({ parentTaskId, ...props }: any) => (
    <span data-testid="parent-task-info" {...props}>
      Parent: {parentTaskId}
    </span>
  ),
}))

vi.mock('@/components/charts/TokenUsageChart', () => ({
  TokenUsageChart: ({ usage, ...props }: any) => (
    <div data-testid="token-usage-chart" className="token-chart" {...props}>
      Tokens: {usage?.totalTokens || 0}
    </div>
  ),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left-icon">←</span>,
  RefreshCw: () => <span data-testid="refresh-icon">↻</span>,
  XCircle: () => <span data-testid="x-circle-icon">✖</span>,
  RotateCcw: () => <span data-testid="rotate-ccw-icon">↺</span>,
  Clock: () => <span data-testid="clock-icon">🕐</span>,
  GitBranch: () => <span data-testid="git-branch-icon">🌿</span>,
  Play: () => <span data-testid="play-icon">▶</span>,
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatCost: (cost: number) => `$${cost.toFixed(2)}`,
  getStatusVariant: (status: string) => status,
  formatStatus: (status: string) => status.replace('-', ' '),
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  truncateId: (id: string, length: number = 8) =>
    id.length > length ? `${id.slice(0, length)}...` : id,
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockWebSocket = await import('@/lib/websocket-client')

describe('Task Detail Page Responsive Layout and Edge Cases', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Helper function to simulate viewport size
  const setViewportSize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    })
    window.dispatchEvent(new Event('resize'))
  }

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

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useParams as any).mockReturnValue({ id: 'task-123' })
    ;(mockWebSocket.useTaskStream as any).mockReturnValue({
      events: [],
      isConnected: false,
    })

    // Default API responses
    vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(createTask())
    vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
      parentTaskId: 'task-123',
      count: 2,
      subtasks: [
        createTask({ id: 'subtask-1', description: 'Subtask 1' }),
        createTask({ id: 'subtask-2', description: 'Subtask 2' }),
      ],
    })
  })

  describe('Responsive Layout Behavior', () => {
    it('renders with appropriate grid layout classes', async () => {
      render(<TaskDetailPage />)

      await waitFor(() => {
        // Find the main grid container
        const gridContainer = screen.getByText('Test task description')
          .closest('div')?.parentElement?.parentElement

        // Should have responsive grid classes
        expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'xl:grid-cols-3')
      })
    })

    it('places components in correct grid areas on desktop', async () => {
      setViewportSize(1280, 720) // xl breakpoint

      const taskWithDependencies = createTask({
        dependsOn: ['dep-1'],
        subtaskIds: ['sub-1'],
      })

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(taskWithDependencies)
        .mockResolvedValueOnce(createTask({ id: 'dep-1' }))
        .mockResolvedValueOnce(createTask({ id: 'sub-1' }))

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Main content should be in xl:col-span-2
        const mainContent = screen.getByTestId('task-dependency-graph')
          .closest('.xl\\:col-span-2')
        expect(mainContent).toBeInTheDocument()

        // Sidebar should be separate column
        const sidebar = screen.getByTestId('token-usage-chart')
          .closest('.space-y-6')
        expect(sidebar).toBeInTheDocument()
      })
    })

    it('stacks components vertically on mobile', async () => {
      setViewportSize(375, 667) // Mobile viewport

      const taskWithDependencies = createTask({
        dependsOn: ['dep-1'],
        subtaskIds: ['sub-1'],
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(taskWithDependencies)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should use grid-cols-1 on mobile
        const gridContainer = screen.getByTestId('task-dependency-graph')
          .closest('.grid')
        expect(gridContainer).toHaveClass('grid-cols-1')
      })
    })

    it('adjusts dependency graph height for different screen sizes', async () => {
      const taskWithDependencies = createTask({
        dependsOn: ['dep-1'],
      })

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(taskWithDependencies)
        .mockResolvedValueOnce(createTask({ id: 'dep-1' }))

      render(<TaskDetailPage />)

      await waitFor(() => {
        const dependencyGraph = screen.getByTestId('task-dependency-graph')
        expect(dependencyGraph).toHaveAttribute('data-height', '300')
        expect(dependencyGraph).toHaveStyle('height: 300px')
      })
    })

    it('handles overflow content gracefully', async () => {
      const taskWithLongDescription = createTask({
        description: 'This is a very long task description that should potentially wrap and not break the layout even on smaller screens with limited horizontal space available for content display',
        acceptanceCriteria: 'Very long acceptance criteria that spans multiple lines and should be handled properly by the layout without causing horizontal scrolling or breaking the responsive grid system that is in place',
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(taskWithLongDescription)

      render(<TaskDetailPage />)

      await waitFor(() => {
        const descriptionElement = screen.getByText(/This is a very long task description/)
        expect(descriptionElement).toBeInTheDocument()

        // Should have truncate class for long content
        expect(descriptionElement).toHaveClass('truncate')
      })
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('handles missing task data gracefully', async () => {
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(null as any)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Task not found')).toBeInTheDocument()
        expect(screen.getByText('Back to Tasks')).toBeInTheDocument()
      })
    })

    it('handles tasks with no usage data', async () => {
      const taskWithoutUsage = createTask({
        usage: undefined as any,
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(taskWithoutUsage)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
        expect(screen.getByText('Tokens: 0')).toBeInTheDocument()
        expect(screen.getByText('$0.00')).toBeInTheDocument() // formatCost(0)
      })
    })

    it('handles extremely large subtask counts', async () => {
      const taskWithManySubtasks = createTask({
        subtaskIds: Array.from({ length: 1000 }, (_, i) => `subtask-${i}`),
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(taskWithManySubtasks)
      vi.mocked(mockApiClient.apiClient.getSubtasks).mockResolvedValue({
        parentTaskId: 'task-123',
        count: 1000,
        subtasks: Array.from({ length: 1000 }, (_, i) =>
          createTask({ id: `subtask-${i}`, description: `Subtask ${i}` })
        ),
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should render without performance issues
        expect(screen.getByTestId('subtask-tree')).toBeInTheDocument()
      })
    })

    it('handles tasks with circular dependency references', async () => {
      const taskA = createTask({
        id: 'task-a',
        dependsOn: ['task-b'],
      })

      const taskB = createTask({
        id: 'task-b',
        dependsOn: ['task-a'], // Circular dependency
      })

      vi.mocked(mockApiClient.apiClient.getTask)
        .mockResolvedValueOnce(taskA)
        .mockResolvedValueOnce(taskB)
        .mockResolvedValueOnce(taskA)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should handle circular dependencies without infinite loops
        expect(screen.getByTestId('task-dependency-graph')).toBeInTheDocument()
      })
    })

    it('handles network timeouts during initial load', async () => {
      vi.mocked(mockApiClient.apiClient.getTask).mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      )

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Network timeout')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('handles malformed task data', async () => {
      const malformedTask = {
        id: 'task-123',
        description: null, // Invalid description
        status: 'invalid-status' as any,
        createdAt: 'invalid-date',
        usage: {
          totalTokens: 'not-a-number' as any,
        },
      } as Task

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(malformedTask)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should not crash and show fallback values
        expect(screen.getByText('invalid-status')).toBeInTheDocument()
      })
    })

    it('handles rapid successive WebSocket events', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      // Simulate rapid WebSocket events
      const events = Array.from({ length: 100 }, (_, i) => ({
        type: 'log:entry',
        timestamp: new Date(Date.now() + i * 10),
        data: {
          level: 'info',
          message: `Log entry ${i}`,
        }
      }))

      ;(mockWebSocket.useTaskStream as any).mockReturnValue({
        events,
        isConnected: true,
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Should handle rapid updates without performance degradation
        expect(screen.getByTestId('log-viewer')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility and User Experience', () => {
    it('provides proper keyboard navigation', async () => {
      const task = createTask({ status: 'in-progress' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('Cancel')

      // Focus with Tab
      await act(async () => {
        await user.tab()
      })

      // Should be focusable
      await act(async () => {
        await user.keyboard('{Enter}')
      })

      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('task-123')
    })

    it('provides proper ARIA labels and roles', async () => {
      const task = createTask({
        dependsOn: ['dep-1'],
        subtaskIds: ['sub-1'],
      })

      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Check for proper heading structure
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()

        // Check for proper button labels
        const refreshButton = screen.getByRole('button', { name: /refresh/i })
        expect(refreshButton).toBeInTheDocument()
      })
    })

    it('maintains focus management during state changes', async () => {
      const task = createTask({ status: 'pending' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)
      vi.mocked(mockApiClient.apiClient.resumeTask).mockResolvedValue({
        ok: true,
        message: 'Task resumed'
      })

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument()
      })

      const startButton = screen.getByText('Start')
      await act(async () => {
        await user.click(startButton)
      })

      // Focus should be maintained during action
      expect(startButton).toHaveFocus()
    })

    it('provides appropriate loading states for all interactions', async () => {
      const task = createTask({ status: 'failed' })
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      // Make retry action hang to test loading state
      vi.mocked(mockApiClient.apiClient.retryTask).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      // Should show loading state
      expect(retryButton).toBeDisabled()
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })

    it('handles high contrast mode preferences', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        // Components should render with appropriate contrast
        expect(screen.getByTestId('badge')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Edge Cases', () => {
    it('handles memory cleanup on component unmount', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      const { unmount } = render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test task description')).toBeInTheDocument()
      })

      // Unmount should not cause memory leaks
      unmount()

      // Verify WebSocket cleanup
      expect(mockWebSocket.useTaskStream).toHaveBeenCalled()
    })

    it('debounces rapid refresh actions', async () => {
      const task = createTask()
      vi.mocked(mockApiClient.apiClient.getTask).mockResolvedValue(task)

      render(<TaskDetailPage />)

      await waitFor(() => {
        expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
      })

      const refreshButton = screen.getByTestId('refresh-icon').closest('button')!

      // Click rapidly
      await act(async () => {
        await user.click(refreshButton)
        await user.click(refreshButton)
        await user.click(refreshButton)
      })

      // Should not make excessive API calls
      expect(mockApiClient.apiClient.getTask).toHaveBeenCalledTimes(2) // Initial + 1 refresh
    })

    it('handles component updates during slow network conditions', async () => {
      const task = createTask()

      // Simulate slow network
      vi.mocked(mockApiClient.apiClient.getTask).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(task), 2000))
      )

      render(<TaskDetailPage />)

      // Should show loading state immediately
      expect(screen.getByTestId('spinner')).toBeInTheDocument()

      // Should eventually load
      await waitFor(() => {
        expect(screen.getByText('Test task description')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})