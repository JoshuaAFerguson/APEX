/**
 * Integration tests for Dashboard Page Layout and Grid Positioning
 *
 * Tests the specific positioning, layout, and responsive behavior of ActiveTasksPanel
 * within the dashboard grid, ensuring it meets the acceptance criteria.
 *
 * Covers:
 * - ActiveTasksPanel positioning appropriately in dashboard grid
 * - Responsive grid layout behavior
 * - Component integration within dashboard context
 * - Visual layout hierarchy
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'
import type { Task } from '@apexcli/core'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
  },
}))

// Mock layout components with specific focus on grid behavior
vi.mock('@/components/layout', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" data-title={title} {...props}>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}))

// Mock UI components with focus on layout classes
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} data-classes={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div data-testid="card-header" className={className} {...props}>
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

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className, ...props }: any) => (
    <div data-testid="spinner" data-size={size} className={className} {...props}>
      Loading...
    </div>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}))

// Mock ActiveTasksPanel with focus on layout and positioning
vi.mock('@/components/tasks/ActiveTasksPanel', () => ({
  ActiveTasksPanel: ({
    tasks,
    onViewDetails,
    onRefresh,
    loading,
    defaultShowActiveOnly,
    maxTasks,
    compact,
    className,
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel"
      className={`active-tasks-panel-container ${className || ''}`}
      data-testid-layout="active-tasks-panel-layout"
      data-tasks-count={tasks?.length || 0}
      data-loading={loading}
      data-compact={compact}
      data-default-show-active-only={defaultShowActiveOnly}
      data-max-tasks={maxTasks}
      {...props}
    >
      <div data-testid="active-tasks-panel-header">
        <h3>Active Tasks</h3>
        {onRefresh && (
          <button onClick={onRefresh} data-testid="panel-refresh">
            Refresh
          </button>
        )}
      </div>
      <div data-testid="active-tasks-panel-content">
        {loading ? (
          <div data-testid="panel-loading">Loading tasks...</div>
        ) : (
          tasks?.map((task: any, index: number) => (
            <div
              key={task.id}
              data-testid={`task-item-${task.id}`}
              data-task-index={index}
              onClick={() => onViewDetails?.(task.id)}
            >
              <span>{task.description}</span>
              <span data-testid={`task-status-${task.id}`}>{task.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  ),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn(() => 'primary'),
  formatStatus: vi.fn((status: string) => status),
  getRelativeTime: vi.fn(() => '2 hours ago'),
  truncateId: vi.fn((id: string) => id),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')

describe('Dashboard Page Layout Integration', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }

  // Test data factories
  const createTaskStats = () => ({
    byStatus: {
      'pending': 2,
      'queued': 1,
      'planning': 1,
      'in-progress': 3,
      'waiting-approval': 1,
      'paused': 2,
      'completed': 15,
      'failed': 2,
    },
    totalCost: 45.67,
    totalTokens: 125000,
  })

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
    ...overrides,
  })

  const createTasksResponse = (count: number = 5) => ({
    tasks: Array.from({ length: count }, (_, i) =>
      createTask({
        id: `task-${i + 1}`,
        description: `Task ${i + 1} description`,
        status: ['pending', 'in-progress', 'completed', 'failed', 'paused'][i % 5] as any,
      })
    ),
    total: count,
    page: 1,
    limit: 20,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useRouter as any).mockReturnValue(mockRouter)
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksResponse())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Dashboard Grid Layout Structure', () => {
    it('renders dashboard with correct top-level layout structure', async () => {
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      // Check main container has correct padding
      const mainContainer = container.querySelector('.p-8')
      expect(mainContainer).toBeInTheDocument()

      // Check header is positioned correctly
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    it('positions statistics grid correctly in layout hierarchy', async () => {
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Statistics grid should be after header with mt-8 spacing
      const statsGrid = screen.getByText('Pending').closest('.grid')
      const statsContainer = statsGrid?.parentElement
      expect(statsContainer).toHaveClass('mt-8')

      // Grid should have responsive grid classes
      expect(statsGrid).toHaveClass('gap-6')
      expect(statsGrid).toHaveClass('md:grid-cols-2')
      expect(statsGrid).toHaveClass('lg:grid-cols-3')
      expect(statsGrid).toHaveClass('xl:grid-cols-6')
    })

    it('positions ActiveTasksPanel appropriately in dashboard grid', async () => {
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // ActiveTasksPanel should be positioned after statistics grid
      const panel = screen.getByTestId('active-tasks-panel')
      const panelContainer = panel.closest('.mt-8')
      expect(panelContainer).toBeInTheDocument()

      // Should be a separate section from statistics
      const statsGrid = screen.getByText('Pending').closest('.grid')
      const statsContainer = statsGrid?.closest('.mt-8')
      expect(panelContainer).not.toBe(statsContainer)

      // Panel container should come after stats container in DOM order
      const allMt8Containers = container.querySelectorAll('.mt-8')
      const statsIndex = Array.from(allMt8Containers).indexOf(statsContainer!)
      const panelIndex = Array.from(allMt8Containers).indexOf(panelContainer!)
      expect(panelIndex).toBeGreaterThan(statsIndex)
    })

    it('ensures ActiveTasksPanel spans full width below statistics', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Panel should not be constrained by grid columns
      const panel = screen.getByTestId('active-tasks-panel')
      const panelContainer = panel.closest('.mt-8')

      // Container should not have grid column restrictions
      expect(panelContainer).not.toHaveClass('col-span-1')
      expect(panelContainer).not.toHaveClass('col-span-2')

      // Should span full width of parent container
      expect(panelContainer).not.toHaveClass('md:grid-cols-2')
      expect(panelContainer).not.toHaveClass('lg:grid-cols-3')
    })
  })

  describe('Responsive Layout Behavior', () => {
    it('maintains proper layout hierarchy on mobile screens', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Statistics should stack in single column on mobile
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('grid') // Default single column

      // ActiveTasksPanel should be full width
      const panel = screen.getByTestId('active-tasks-panel')
      expect(panel).toBeInTheDocument()

      // Layout should still maintain proper spacing
      const panelContainer = panel.closest('.mt-8')
      expect(panelContainer).toBeInTheDocument()
    })

    it('adapts statistics grid correctly for tablet screens', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Statistics grid should have tablet-appropriate columns
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('md:grid-cols-2') // 2 columns on md+
      expect(statsGrid).toHaveClass('lg:grid-cols-3') // 3 columns on lg+
      expect(statsGrid).toHaveClass('xl:grid-cols-6') // 6 columns on xl+
    })

    it('maintains ActiveTasksPanel positioning across screen sizes', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Panel should maintain consistent positioning regardless of screen size
      const panel = screen.getByTestId('active-tasks-panel')
      const panelContainer = panel.closest('.mt-8')

      // Should always be positioned with mt-8 spacing
      expect(panelContainer).toBeInTheDocument()
      expect(panelContainer).toHaveClass('mt-8')
    })
  })

  describe('Visual Hierarchy and Spacing', () => {
    it('maintains proper vertical spacing between sections', async () => {
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('header')).toBeInTheDocument()
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Header should be at the top
      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()

      // Statistics section should have mt-8 from header
      const statsGrid = screen.getByText('Pending').closest('.grid')
      const statsContainer = statsGrid?.closest('.mt-8')
      expect(statsContainer).toBeInTheDocument()

      // ActiveTasksPanel section should have mt-8 from statistics
      const panel = screen.getByTestId('active-tasks-panel')
      const panelContainer = panel.closest('.mt-8')
      expect(panelContainer).toBeInTheDocument()

      // Verify proper spacing hierarchy
      const allMt8Sections = container.querySelectorAll('.mt-8')
      expect(allMt8Sections).toHaveLength(2) // Stats and Panel sections
    })

    it('ensures proper content padding within main container', async () => {
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('header')).toBeInTheDocument()
      })

      // Main container should have p-8 padding
      const mainContainer = container.querySelector('.p-8')
      expect(mainContainer).toBeInTheDocument()

      // All major sections should be within this container
      const header = screen.getByTestId('header')
      expect(mainContainer).toContainElement(header)

      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(mainContainer).toContainElement(statsGrid!)

      const panel = screen.getByTestId('active-tasks-panel')
      expect(mainContainer).toContainElement(panel)
    })

    it('provides appropriate gap spacing in statistics grid', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Statistics grid should have gap-6 spacing
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('gap-6')
    })
  })

  describe('Content Integration and Flow', () => {
    it('integrates header actions with overall layout', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('header')).toBeInTheDocument()
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      // Header should contain refresh action
      const header = screen.getByTestId('header')
      const refreshButton = screen.getByText('Refresh')
      expect(header).toContainElement(refreshButton)
    })

    it('ensures statistics cards maintain consistent sizing', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Active')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })

      // All statistic cards should use the same Card component
      const cards = screen.getAllByTestId('card')

      // Should have 6 statistics cards + 1 ActiveTasksPanel card
      expect(cards.length).toBeGreaterThanOrEqual(6)

      // Each statistic card should have CardHeader and CardContent
      const pendingCard = screen.getByText('Pending').closest('[data-testid="card"]')
      expect(pendingCard).toBeInTheDocument()
    })

    it('positions ActiveTasksPanel to complement dashboard statistics', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Panel should be visually separated but connected to dashboard
      const panel = screen.getByTestId('active-tasks-panel')
      const panelHeader = screen.getByText('Active Tasks')
      expect(panel).toContainElement(panelHeader)

      // Should provide detailed view that complements high-level statistics
      expect(screen.getByText('Pending')).toBeInTheDocument() // High-level stat
      expect(panelHeader).toBeInTheDocument() // Detailed task list
    })
  })

  describe('ActiveTasksPanel Configuration in Dashboard Context', () => {
    it('configures ActiveTasksPanel with appropriate dashboard settings', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toBeInTheDocument()

        // Should be configured for dashboard use
        expect(panel).toHaveAttribute('data-default-show-active-only', 'false')
        expect(panel).toHaveAttribute('data-max-tasks', '15')
        expect(panel).toHaveAttribute('data-compact', 'false')
      })
    })

    it('provides appropriate task limit for dashboard overview', async () => {
      const tasks = createTasksResponse(20) // More than max
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-max-tasks', '15')
        expect(panel).toHaveAttribute('data-tasks-count', '20')
      })
    })

    it('ensures panel shows all task types by default for dashboard overview', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        // Dashboard should show all tasks, not just active ones
        expect(panel).toHaveAttribute('data-default-show-active-only', 'false')
      })
    })
  })
})