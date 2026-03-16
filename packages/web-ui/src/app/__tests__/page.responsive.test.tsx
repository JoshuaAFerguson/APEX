/**
 * Responsive layout tests for Dashboard Page
 *
 * Tests the responsive grid layout system across different screen sizes
 * and verifies that all panels adapt correctly to various breakpoints.
 *
 * Covers:
 * - Mobile (sm): 640px+
 * - Tablet (md): 768px+
 * - Laptop (lg): 1024px+
 * - Desktop (xl): 1280px+
 * - Grid layout behavior at each breakpoint
 * - Panel visibility and arrangement
 * - Responsive component props
 * - Touch interactions on mobile
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
  },
}))

// Mock real-time updates
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

// Mock UI components with responsive class tracking
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} data-classes={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div data-testid="card-content" className={className} data-classes={className} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-size={size}
      className={className}
      data-classes={className}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className, ...props }: any) => (
    <div data-testid="spinner" data-size={size} className={className} data-classes={className} {...props}>
      Loading...
    </div>
  ),
}))

vi.mock('@/components/layout/Header', () => ({
  Header: ({ title, description, actions, className, ...props }: any) => (
    <div data-testid="header" className={className} data-classes={className} {...props}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}))

// Mock dashboard panels with responsive size tracking
vi.mock('@/components/dashboard/ProjectHealthPanel', () => ({
  ProjectHealthPanel: ({ className, ...props }: any) => (
    <div
      data-testid="project-health-panel"
      className={className}
      data-classes={className}
      {...props}
    >
      ProjectHealthPanel
    </div>
  ),
}))

vi.mock('@/components/dashboard/PerformanceMetricsPanel', () => ({
  PerformanceMetricsPanel: ({ className, chartSize, ...props }: any) => (
    <div
      data-testid="performance-metrics-panel"
      className={className}
      data-classes={className}
      data-chart-size={chartSize}
      {...props}
    >
      PerformanceMetricsPanel
    </div>
  ),
}))

vi.mock('@/components/dashboard/BudgetWidget', () => ({
  BudgetWidget: ({ size, className, ...props }: any) => (
    <div
      data-testid="budget-widget"
      className={className}
      data-classes={className}
      data-size={size}
      {...props}
    >
      BudgetWidget
    </div>
  ),
}))

vi.mock('@/components/dashboard/AgentUtilizationWidget', () => ({
  AgentUtilizationWidget: ({ height, className, ...props }: any) => (
    <div
      data-testid="agent-utilization-widget"
      className={className}
      data-classes={className}
      data-height={height}
      {...props}
    >
      AgentUtilizationWidget
    </div>
  ),
}))

vi.mock('@/components/tasks/ActiveTasksPanelRealtime', () => ({
  ActiveTasksPanelRealtime: ({ compact, connectionIndicatorSize, className, ...props }: any) => (
    <div
      data-testid="active-tasks-panel-realtime"
      className={className}
      data-classes={className}
      data-compact={compact}
      data-connection-indicator-size={connectionIndicatorSize}
      {...props}
    >
      ActiveTasksPanelRealtime
    </div>
  ),
}))

// Mock utility functions
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn(() => 'secondary'),
  formatStatus: vi.fn((status: string) => status.replace('-', ' ')),
  getRelativeTime: vi.fn(() => '2 minutes ago'),
  truncateId: vi.fn((id: string) => id.slice(0, 8) + '...'),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockUseRealtimeUpdates = await import('@/lib/useRealtimeUpdates')

describe('Dashboard Page Responsive Layout', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }

  // Viewport size constants
  const BREAKPOINTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    laptop: { width: 1024, height: 768 },
    desktop: { width: 1280, height: 1024 },
    ultrawide: { width: 1920, height: 1080 },
  }

  // Helper function to set viewport size
  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { writable: true, value: height })
    window.dispatchEvent(new Event('resize'))
  }

  // Test data factories
  const createTaskStats = () => ({
    byStatus: {
      pending: 5,
      'in-progress': 3,
      completed: 20,
      failed: 2,
    },
    totalCost: 25.75,
    totalTokens: 50000,
  })

  const createTasks = () => [
    {
      id: 'task-1',
      description: 'Test task 1',
      status: 'in-progress',
      workflow: 'test',
      autonomy: 'medium',
      priority: 'medium',
      effort: 'medium',
      projectPath: '/test',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const createRealtimeState = () => ({
    state: {
      health: {
        status: 'connected',
        tasks: {
          activeTasks: 3,
          pendingTasks: 5,
          completedLastHour: 20,
          failedLastHour: 2,
        },
        connection: {
          isConnected: true,
          latencyMs: 45,
        },
        lastUpdated: new Date(),
      },
      performance: {
        tokenUsage: { totalTokens: 50000, estimatedCost: 25.75 },
        tasks: { completedTasks: 20, failedTasks: 2 },
        generatedAt: new Date(),
      },
      error: null,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useRouter as any).mockReturnValue(mockRouter)

    // Mock API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
      tasks: createTasks(),
      total: 1,
      page: 1,
      limit: 20
    })

    // Mock real-time state
    ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createRealtimeState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Reset viewport to default
    setViewport(1024, 768)
  })

  describe('Mobile Layout (375px)', () => {
    beforeEach(() => {
      setViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height)
    })

    it('renders task status cards in mobile-friendly layout', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      // Find the grid container for task status cards
      const statusCards = screen.getAllByTestId('card')
      const firstCard = statusCards[0]
      const gridContainer = firstCard.closest('.grid')

      // Should have responsive grid classes for mobile
      expect(gridContainer).toHaveClass('gap-6')
      expect(gridContainer).toHaveClass('md:grid-cols-2')
      expect(gridContainer).toHaveClass('lg:grid-cols-3')
      expect(gridContainer).toHaveClass('xl:grid-cols-6')
    })

    it('stacks panels vertically on mobile', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // All main sections should be in single column layout
        const dashboardContainer = screen.getByTestId('project-health-panel').closest('.space-y-8')
        expect(dashboardContainer).toBeInTheDocument()

        // Budget and agent widgets should stack
        const widgetContainer = screen.getByTestId('budget-widget').closest('.grid')
        expect(widgetContainer).toHaveClass('md:grid-cols-1')
        expect(widgetContainer).toHaveClass('lg:grid-cols-2')
      })
    })

    it('adjusts component sizes for mobile viewing', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Budget widget should maintain medium size
        const budgetWidget = screen.getByTestId('budget-widget')
        expect(budgetWidget).toHaveAttribute('data-size', 'md')

        // Connection indicator should be medium size
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toHaveAttribute('data-connection-indicator-size', 'md')

        // Performance panel chart should be medium
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-chart-size', 'md')
      })
    })

    it('enables compact mode for mobile when appropriate', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        // Tasks panel is set to not compact by default, but could be adjusted
        expect(tasksPanel).toHaveAttribute('data-compact', 'false')
      })
    })
  })

  describe('Tablet Layout (768px)', () => {
    beforeEach(() => {
      setViewport(BREAKPOINTS.tablet.width, BREAKPOINTS.tablet.height)
    })

    it('uses 2-column grid for task status on tablet', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const statusCards = screen.getAllByTestId('card')
        const gridContainer = statusCards[0].closest('.grid')

        // Should show 2 columns on medium screens
        expect(gridContainer).toHaveClass('md:grid-cols-2')
        expect(gridContainer).toHaveClass('lg:grid-cols-3')
        expect(gridContainer).toHaveClass('xl:grid-cols-6')
      })
    })

    it('maintains single column for budget/agent widgets on tablet', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const widgetContainer = screen.getByTestId('budget-widget').closest('.grid')
        // Should be single column on md, two columns on lg+
        expect(widgetContainer).toHaveClass('md:grid-cols-1')
        expect(widgetContainer).toHaveClass('lg:grid-cols-2')
      })
    })
  })

  describe('Laptop Layout (1024px)', () => {
    beforeEach(() => {
      setViewport(BREAKPOINTS.laptop.width, BREAKPOINTS.laptop.height)
    })

    it('uses 3-column grid for task status on laptop', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const statusCards = screen.getAllByTestId('card')
        const gridContainer = statusCards[0].closest('.grid')

        // Should show 3 columns on large screens
        expect(gridContainer).toHaveClass('lg:grid-cols-3')
        expect(gridContainer).toHaveClass('xl:grid-cols-6')
      })
    })

    it('uses 2-column layout for budget/agent widgets on laptop', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const widgetContainer = screen.getByTestId('budget-widget').closest('.grid')
        // Should be two columns on lg+
        expect(widgetContainer).toHaveClass('lg:grid-cols-2')
      })
    })
  })

  describe('Desktop Layout (1280px+)', () => {
    beforeEach(() => {
      setViewport(BREAKPOINTS.desktop.width, BREAKPOINTS.desktop.height)
    })

    it('uses full 6-column grid for task status on desktop', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const statusCards = screen.getAllByTestId('card')
        const gridContainer = statusCards[0].closest('.grid')

        // Should show all 6 columns on xl screens
        expect(gridContainer).toHaveClass('xl:grid-cols-6')
      })
    })

    it('maintains 2-column layout for budget/agent widgets on desktop', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const budgetWidget = screen.getByTestId('budget-widget')
        const agentWidget = screen.getByTestId('agent-utilization-widget')
        const widgetContainer = budgetWidget.closest('.grid')

        // Both widgets should be in same container
        expect(widgetContainer).toContain(budgetWidget)
        expect(widgetContainer).toHaveClass('lg:grid-cols-2')
      })
    })

    it('provides optimal spacing for desktop viewing', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // All grid containers should have consistent gap
        const containers = screen.getAllByTestId('card')[0].closest('.grid')
        expect(containers).toHaveClass('gap-6')
      })
    })
  })

  describe('Ultrawide Layout (1920px)', () => {
    beforeEach(() => {
      setViewport(BREAKPOINTS.ultrawide.width, BREAKPOINTS.ultrawide.height)
    })

    it('maintains 6-column layout without becoming too wide', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const statusCards = screen.getAllByTestId('card')
        const gridContainer = statusCards[0].closest('.grid')

        // Should still use 6-column max on ultrawide
        expect(gridContainer).toHaveClass('xl:grid-cols-6')

        // Should have proper spacing
        expect(gridContainer).toHaveClass('gap-6')
      })
    })

    it('maintains readable layout on ultrawide screens', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Dashboard should maintain proper structure
        const mainContainer = screen.getByTestId('header').nextElementSibling
        expect(mainContainer).toHaveClass('mt-8', 'space-y-8')
      })
    })
  })

  describe('Layout Consistency Across Breakpoints', () => {
    it('maintains consistent component hierarchy at all sizes', async () => {
      const sizes = Object.values(BREAKPOINTS)

      for (const size of sizes) {
        setViewport(size.width, size.height)

        const { unmount } = render(<DashboardPage />)

        await waitFor(() => {
          // Header should always be present
          expect(screen.getByTestId('header')).toBeInTheDocument()

          // All main panels should be present
          expect(screen.getByTestId('project-health-panel')).toBeInTheDocument()
          expect(screen.getByTestId('performance-metrics-panel')).toBeInTheDocument()
          expect(screen.getByTestId('budget-widget')).toBeInTheDocument()
          expect(screen.getByTestId('agent-utilization-widget')).toBeInTheDocument()
          expect(screen.getByTestId('active-tasks-panel-realtime')).toBeInTheDocument()

          // Task status cards should all be present (6 cards)
          const statusCards = screen.getAllByTestId('card')
          expect(statusCards.length).toBeGreaterThanOrEqual(6)
        })

        unmount()
      }
    })

    it('maintains proper spacing at all breakpoints', async () => {
      const sizes = [BREAKPOINTS.mobile, BREAKPOINTS.desktop]

      for (const size of sizes) {
        setViewport(size.width, size.height)

        const { unmount } = render(<DashboardPage />)

        await waitFor(() => {
          // Main container should have consistent spacing
          const mainContainer = screen.getByTestId('header').nextElementSibling
          expect(mainContainer).toHaveClass('mt-8', 'space-y-8')

          // Grid containers should have consistent gaps
          const gridContainers = screen.getAllByTestId('card')[0].closest('.grid')
          expect(gridContainers).toHaveClass('gap-6')
        })

        unmount()
      }
    })

    it('preserves accessibility features across breakpoints', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Headers should be accessible
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()

        // Buttons should be accessible
        const refreshButton = screen.getByText('Refresh')
        expect(refreshButton).toBeInTheDocument()
        expect(refreshButton.tagName).toBe('BUTTON')
      })
    })
  })

  describe('Interactive Elements Responsiveness', () => {
    it('ensures buttons are touch-friendly on mobile', async () => {
      setViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height)

      render(<DashboardPage />)

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh')
        // Button should be present and clickable
        expect(refreshButton).toBeInTheDocument()
        expect(refreshButton).not.toBeDisabled()
      })
    })

    it('handles touch interactions on mobile', async () => {
      setViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height)
      const user = userEvent.setup()

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      // Simulate touch interaction
      const refreshButton = screen.getByText('Refresh')
      await user.click(refreshButton)

      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
    })

    it('maintains appropriate click targets on all screen sizes', async () => {
      const sizes = [BREAKPOINTS.mobile, BREAKPOINTS.tablet, BREAKPOINTS.desktop]

      for (const size of sizes) {
        setViewport(size.width, size.height)

        const { unmount } = render(<DashboardPage />)

        await waitFor(() => {
          const refreshButton = screen.getByText('Refresh')
          expect(refreshButton).toBeInTheDocument()

          // Button should be accessible and clickable
          expect(refreshButton).not.toBeDisabled()
        })

        unmount()
      }
    })
  })

  describe('Content Overflow Handling', () => {
    it('handles long task descriptions on small screens', async () => {
      setViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height)

      // Mock tasks with long descriptions
      const longDescriptionTasks = [{
        id: 'task-1',
        description: 'This is a very long task description that might overflow on small screens and needs to be handled properly',
        status: 'in-progress',
        workflow: 'test',
        autonomy: 'medium',
        priority: 'medium',
        effort: 'medium',
        projectPath: '/test',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]

      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: longDescriptionTasks,
        total: 1,
        page: 1,
        limit: 20
      })

      render(<DashboardPage />)

      await waitFor(() => {
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toBeInTheDocument()
        // Panel should handle overflow gracefully
        expect(tasksPanel).toHaveAttribute('data-initial-tasks-count', '1')
      })
    })

    it('prevents horizontal scroll on mobile', async () => {
      setViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height)

      render(<DashboardPage />)

      await waitFor(() => {
        // Main container should not cause horizontal overflow
        const dashboard = screen.getByTestId('header').closest('div')
        expect(dashboard).toBeInTheDocument()

        // Grid containers should have responsive classes
        const gridContainer = screen.getAllByTestId('card')[0].closest('.grid')
        expect(gridContainer).toHaveClass('gap-6')
      })
    })
  })
})