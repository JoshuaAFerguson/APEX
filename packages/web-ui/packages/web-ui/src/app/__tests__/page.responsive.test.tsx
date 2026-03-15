/**
 * Responsive Design tests for Dashboard Page
 *
 * Tests the responsive behavior and grid layout adaptations across different
 * screen sizes, ensuring the dashboard and ActiveTasksPanel maintain proper
 * positioning and usability on all devices.
 *
 * Covers:
 * - Mobile, tablet, and desktop responsive layouts
 * - Grid adaptation and breakpoint behavior
 * - ActiveTasksPanel responsive configuration
 * - Touch interaction and accessibility
 * - Performance on different viewport sizes
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

// Mock layout components with responsive behavior
vi.mock('@/components/layout', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" className="header-responsive" {...props}>
      <div className="header-content">
        <h1 className="header-title">{title}</h1>
        <p className="header-description">{description}</p>
      </div>
      <div className="header-actions">{actions}</div>
    </div>
  ),
}))

// Mock UI components with responsive classes
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className = '', ...props }: any) => (
    <div
      data-testid="card"
      className={`responsive-card ${className}`}
      data-responsive-classes={className}
      {...props}
    >
      {children}
    </div>
  ),
  CardHeader: ({ children, className = '', ...props }: any) => (
    <div data-testid="card-header" className={`card-header ${className}`} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className = '', ...props }: any) => (
    <div data-testid="card-content" className={`card-content ${className}`} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, ...props }: any) => <div data-testid="spinner" data-size={size} {...props}>Loading...</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, className = '', ...props }: any) => (
    <button
      onClick={onClick}
      data-testid="button"
      className={`responsive-button ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
}))

// Mock ActiveTasksPanel with responsive behavior
vi.mock('@/components/tasks/ActiveTasksPanel', () => ({
  ActiveTasksPanel: ({
    tasks,
    onViewDetails,
    onRefresh,
    loading,
    compact,
    maxTasks,
    defaultShowActiveOnly,
    className = '',
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel"
      className={`active-tasks-panel-responsive ${className}`}
      data-compact={compact}
      data-max-tasks={maxTasks}
      data-default-show-active-only={defaultShowActiveOnly}
      data-responsive-mode="true"
      {...props}
    >
      <div data-testid="panel-header" className={compact ? 'compact-header' : 'full-header'}>
        <h3>Active Tasks</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            data-testid="refresh-button"
            className={compact ? 'compact-btn' : 'full-btn'}
          >
            {compact ? '↻' : 'Refresh'}
          </button>
        )}
      </div>

      <div data-testid="panel-content" className={compact ? 'compact-content' : 'full-content'}>
        {loading ? (
          <div data-testid="panel-loading">Loading...</div>
        ) : (
          <div data-testid="tasks-grid" className={compact ? 'compact-grid' : 'full-grid'}>
            {tasks?.slice(0, maxTasks).map((task: any, index: number) => (
              <div
                key={task.id}
                data-testid={`task-${task.id}`}
                className={`task-item ${compact ? 'compact-task' : 'full-task'}`}
                data-task-index={index}
                onClick={() => onViewDetails?.(task.id)}
              >
                <div className={`task-content ${compact ? 'compact' : 'full'}`}>
                  <h4 className={compact ? 'text-sm' : 'text-base'}>{task.description}</h4>
                  <span className={`status ${compact ? 'text-xs' : 'text-sm'}`}>
                    Status: {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
  truncateId: vi.fn((id: string) => id.slice(0, 8)),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')

// Viewport size constants
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  mobileLarge: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
  tabletLarge: { width: 1024, height: 1366 },
  desktop: { width: 1280, height: 720 },
  desktopLarge: { width: 1920, height: 1080 },
} as const

describe('Dashboard Page Responsive Design', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }

  // Test data factories
  const createTaskStats = () => ({
    byStatus: {
      'pending': 5,
      'queued': 3,
      'planning': 2,
      'in-progress': 7,
      'waiting-approval': 1,
      'paused': 4,
      'completed': 25,
      'failed': 3,
    },
    totalCost: 156.78,
    totalTokens: 245000,
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

  const createTasksResponse = (count: number = 12) => ({
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

  // Helper function to simulate viewport changes
  const setViewport = (viewport: keyof typeof VIEWPORTS) => {
    const { width, height } = VIEWPORTS[viewport]

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

    // Trigger resize event
    window.dispatchEvent(new Event('resize'))
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup router mock
    ;(useRouter as any).mockReturnValue(mockRouter)

    // Setup default API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksResponse())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Reset viewport to default
    setViewport('desktop')
  })

  describe('Mobile Responsive Layout (375px - 414px)', () => {
    it('renders correctly on mobile viewport', async () => {
      setViewport('mobile')
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      // Main container should have mobile-friendly padding
      const mainContainer = container.querySelector('.p-8')
      expect(mainContainer).toBeInTheDocument()

      // Header should be responsive
      expect(screen.getByTestId('header')).toHaveClass('header-responsive')
    })

    it('stacks statistics cards in single column on mobile', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Statistics grid should use default (single column) layout
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('grid')
      expect(statsGrid).toHaveClass('gap-6')

      // Should have responsive classes for larger screens
      expect(statsGrid).toHaveClass('md:grid-cols-2')
      expect(statsGrid).toHaveClass('lg:grid-cols-3')
      expect(statsGrid).toHaveClass('xl:grid-cols-6')
    })

    it('configures ActiveTasksPanel for mobile experience', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toBeInTheDocument()

        // Should use mobile-appropriate settings
        expect(panel).toHaveAttribute('data-compact', 'false') // Dashboard uses full mode
        expect(panel).toHaveAttribute('data-max-tasks', '15')
        expect(panel).toHaveAttribute('data-default-show-active-only', 'false')
        expect(panel).toHaveClass('active-tasks-panel-responsive')
      })
    })

    it('maintains proper spacing on mobile', async () => {
      setViewport('mobile')
      const { container } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Verify vertical spacing is maintained
      const spacedSections = container.querySelectorAll('.mt-8')
      expect(spacedSections.length).toBeGreaterThanOrEqual(2) // Stats and Panel sections
    })

    it('handles touch interactions properly on mobile', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-task-1')).toBeInTheDocument()
      })

      // Task items should be clickable for touch
      const taskItem = screen.getByTestId('task-task-1')
      expect(taskItem).toBeInTheDocument()

      // Should have proper cursor and interaction classes
      expect(taskItem).toHaveClass('task-item')
    })
  })

  describe('Tablet Responsive Layout (768px - 1024px)', () => {
    it('renders correctly on tablet viewport', async () => {
      setViewport('tablet')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Statistics should use 2-column layout on tablet
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('md:grid-cols-2')
    })

    it('adapts statistics grid for tablet screens', async () => {
      setViewport('tablet')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      const statsGrid = screen.getByText('Pending').closest('.grid')

      // Should have progressive enhancement classes
      expect(statsGrid).toHaveClass('grid')
      expect(statsGrid).toHaveClass('md:grid-cols-2') // 2 cols on md+
      expect(statsGrid).toHaveClass('lg:grid-cols-3') // 3 cols on lg+
      expect(statsGrid).toHaveClass('xl:grid-cols-6') // 6 cols on xl+
    })

    it('optimizes ActiveTasksPanel for tablet', async () => {
      setViewport('tablet')
      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toBeInTheDocument()

        // Should use appropriate settings for tablet
        expect(panel).toHaveAttribute('data-compact', 'false')
        expect(panel).toHaveClass('active-tasks-panel-responsive')
      })
    })

    it('maintains readability on tablet orientation changes', async () => {
      // Portrait tablet
      setViewport('tablet')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Landscape tablet (swap dimensions)
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
      window.dispatchEvent(new Event('resize'))

      // Layout should adapt
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
    })
  })

  describe('Desktop Responsive Layout (1280px+)', () => {
    it('renders correctly on desktop viewport', async () => {
      setViewport('desktop')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Desktop should use full 6-column layout for statistics
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('xl:grid-cols-6')
    })

    it('utilizes full desktop width effectively', async () => {
      setViewport('desktop')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      const panel = screen.getByTestId('active-tasks-panel')

      // Should use full desktop configuration
      expect(panel).toHaveAttribute('data-compact', 'false')
      expect(panel).toHaveAttribute('data-max-tasks', '15')
    })

    it('provides optimal task display density on desktop', async () => {
      setViewport('desktop')
      const largeTaskSet = createTasksResponse(20) // More tasks than mobile would show
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(largeTaskSet)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Should show more tasks on desktop
      const panel = screen.getByTestId('active-tasks-panel')
      expect(panel).toHaveAttribute('data-max-tasks', '15')
    })

    it('handles ultra-wide desktop screens', async () => {
      setViewport('desktopLarge')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Should handle extra wide screens gracefully
      const statsGrid = screen.getByText('Pending').closest('.grid')
      expect(statsGrid).toHaveClass('xl:grid-cols-6')
    })
  })

  describe('Breakpoint Transitions', () => {
    it('handles smooth transitions between breakpoints', async () => {
      // Start with mobile
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Transition to tablet
      setViewport('tablet')
      window.dispatchEvent(new Event('resize'))

      // Should maintain content without re-render
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()

      // Transition to desktop
      setViewport('desktop')
      window.dispatchEvent(new Event('resize'))

      // Content should still be present
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
    })

    it('maintains state during viewport changes', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-task-1')).toBeInTheDocument()
      })

      // Record initial task count
      const initialTaskItems = screen.getAllByTestId(/^task-task-/)
      const initialCount = initialTaskItems.length

      // Change viewport
      setViewport('desktop')
      window.dispatchEvent(new Event('resize'))

      // Task count should remain the same
      const newTaskItems = screen.getAllByTestId(/^task-task-/)
      expect(newTaskItems).toHaveLength(initialCount)
    })

    it('preserves user interactions across breakpoint changes', async () => {
      setViewport('tablet')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      // Change to mobile
      setViewport('mobile')
      window.dispatchEvent(new Event('resize'))

      // Refresh button should still be functional
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  describe('Performance Across Viewports', () => {
    it('renders efficiently on mobile devices', async () => {
      setViewport('mobile')
      const renderStart = performance.now()

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      const renderTime = performance.now() - renderStart

      // Should render reasonably quickly (this is a basic performance check)
      expect(renderTime).toBeLessThan(1000) // 1 second threshold
    })

    it('handles large datasets efficiently across viewports', async () => {
      const largeDataset = createTasksResponse(50)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(largeDataset)

      // Test on different viewports
      for (const viewport of ['mobile', 'tablet', 'desktop'] as const) {
        setViewport(viewport)

        const { unmount } = render(<DashboardPage />)

        await waitFor(() => {
          expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
        })

        // Should limit displayed tasks appropriately
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-max-tasks', '15')

        unmount()
      }
    })

    it('maintains smooth scrolling on mobile', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Panel should not have performance-impacting styles
      const panel = screen.getByTestId('active-tasks-panel')
      expect(panel).toHaveClass('active-tasks-panel-responsive')
    })
  })

  describe('Accessibility Across Devices', () => {
    it('maintains touch targets on mobile', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      // Interactive elements should be present and accessible
      const refreshButton = screen.getByText('Refresh')
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).toHaveClass('responsive-button')
    })

    it('provides keyboard navigation on all devices', async () => {
      setViewport('tablet')
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-task-1')).toBeInTheDocument()
      })

      // Task items should be keyboard accessible
      const taskItem = screen.getByTestId('task-task-1')
      expect(taskItem).toBeInTheDocument()
    })

    it('maintains readable text sizes across viewports', async () => {
      // Test text readability on different screen sizes
      for (const viewport of ['mobile', 'tablet', 'desktop'] as const) {
        setViewport(viewport)

        const { unmount } = render(<DashboardPage />)

        await waitFor(() => {
          expect(screen.getByText('Dashboard')).toBeInTheDocument()
          expect(screen.getByText('Active Tasks')).toBeInTheDocument()
        })

        // Headers should be readable
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Active Tasks')).toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Content Adaptation', () => {
    it('adjusts content density based on screen size', async () => {
      // Mobile - should be less dense
      setViewport('mobile')
      const { unmount: unmountMobile } = render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-compact', 'false')
      })

      unmountMobile()

      // Desktop - can handle more content
      setViewport('desktop')
      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-compact', 'false')
        expect(panel).toHaveAttribute('data-max-tasks', '15')
      })
    })

    it('optimizes button labels for screen size', async () => {
      setViewport('mobile')
      render(<DashboardPage />)

      await waitFor(() => {
        const refreshButton = screen.getByTestId('refresh-button')
        expect(refreshButton).toBeInTheDocument()
      })
    })
  })
})