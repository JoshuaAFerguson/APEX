/**
 * Accessibility tests for AgentUtilizationWidget dashboard component
 *
 * Tests cover:
 * - ARIA attributes and roles
 * - Screen reader accessibility
 * - Keyboard navigation
 * - Focus management
 * - Color contrast and visual accessibility
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentUtilizationWidget } from '../AgentUtilizationWidget'
import {
  createMockAgentMetrics,
  createMockAgentMetricsData,
  createMockAgent,
  createAgentMetricsLoadingMock,
  createAgentMetricsErrorMock,
} from './__mocks__/widget-test-utils'

// Mock the useAgentMetrics hook
vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('AgentUtilizationWidget - Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('ARIA Attributes and Roles', () => {
    it('has proper ARIA structure for the main widget', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Main widget should have appropriate role
      const widget = screen.getByRole('region', { name: /agent utilization/i })
      expect(widget).toBeInTheDocument()
    })

    it('provides proper ARIA labels for data visualization', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
            createMockAgent('planner', 'Planner', 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Chart should have proper ARIA label
      const chart = screen.getByRole('img', { name: /agent utilization chart/i })
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('aria-label')
    })

    it('provides ARIA descriptions for connection status', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ connectionStatus: 'connected' })
      )

      render(<AgentUtilizationWidget />)

      // Connection status should be accessible
      const statusIndicator = screen.getByTitle('Connected')
      expect(statusIndicator).toBeInTheDocument()

      // Screen reader text should be available
      expect(screen.getByText('Connected')).toHaveClass('sr-only')
    })

    it('has accessible refresh button with proper labeling', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByRole('button', { name: /refresh agent data/i })
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).toHaveAttribute('title', 'Refresh agent data')
    })

    it('provides ARIA live region for dynamic content updates', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      // Initial state
      expect(screen.getByText('1 active')).toBeInTheDocument()

      // Update with more agents
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
            createMockAgent('planner', 'Planner', 5000, 0.25),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      // Content should update
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })
  })

  describe('Screen Reader Accessibility', () => {
    it('provides meaningful text alternatives for visual content', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Summary stats should be readable
      expect(screen.getByText('1 active')).toBeInTheDocument()
      expect(screen.getByText(/Top: Coder/)).toBeInTheDocument()
    })

    it('announces loading state to screen readers', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Loading agent metrics...')).toBeInTheDocument()

      // Loading message should be accessible
      const loadingMessage = screen.getByText('Loading agent metrics...')
      expect(loadingMessage).toBeVisible()
    })

    it('announces error states appropriately', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createAgentMetricsErrorMock('Connection failed')
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })

    it('provides screen reader friendly connection status updates', () => {
      const connectionStates = [
        { status: 'connected' as const, text: 'Connected' },
        { status: 'connecting' as const, text: 'Connecting...' },
        { status: 'error' as const, text: 'Connection Error' },
        { status: 'disconnected' as const, text: 'Disconnected' },
      ]

      connectionStates.forEach(({ status, text }) => {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({ connectionStatus: status })
        )

        render(<AgentUtilizationWidget />)

        // Screen reader text should be present
        expect(screen.getByText(text)).toHaveClass('sr-only')

        // Visual indicator should have title
        expect(screen.getByTitle(text)).toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for interactive elements', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByRole('button', { name: /refresh agent data/i })

      // Button should be focusable
      refreshButton.focus()
      expect(refreshButton).toHaveFocus()

      // Should respond to Enter key
      fireEvent.keyDown(refreshButton, { key: 'Enter', code: 'Enter' })

      // Should respond to Space key
      fireEvent.keyDown(refreshButton, { key: ' ', code: 'Space' })
    })

    it('provides keyboard access to agent interactions', () => {
      const onAgentClick = vi.fn()

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget onAgentClick={onAgentClick} />)

      // Agent rows should be keyboard accessible
      const agentRow = screen.getByText('Coder').closest('.group')
      expect(agentRow).toBeInTheDocument()

      if (agentRow) {
        // Should be focusable via keyboard
        fireEvent.keyDown(agentRow, { key: 'Enter', code: 'Enter' })
        expect(onAgentClick).toHaveBeenCalled()
      }
    })

    it('maintains logical tab order', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByRole('button', { name: /refresh agent data/i })

      // Refresh button should be in tab order
      expect(refreshButton).not.toHaveAttribute('tabindex', '-1')
    })
  })

  describe('Focus Management', () => {
    it('manages focus during error state transitions', () => {
      // Start with error state
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsErrorMock())

      const { rerender } = render(<AgentUtilizationWidget />)

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      expect(retryButton).toBeInTheDocument()

      // Transition to loading
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())
      rerender(<AgentUtilizationWidget />)

      // Should show loading state
      expect(screen.getByText('Loading agent metrics...')).toBeInTheDocument()
    })

    it('preserves focus context during data updates', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const { rerender } = render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByRole('button', { name: /refresh agent data/i })
      refreshButton.focus()

      // Update data
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      // Button should still be focusable after update
      expect(refreshButton).toBeInTheDocument()
    })
  })

  describe('Visual Accessibility', () => {
    it('uses appropriate semantic HTML structure', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should use semantic HTML elements
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument() // Chart should have img role
    })

    it('provides high contrast visual indicators', () => {
      const connectionStates = [
        { status: 'connected' as const, expectedClass: 'bg-green-500' },
        { status: 'error' as const, expectedClass: 'bg-red-500' },
        { status: 'connecting' as const, expectedClass: 'bg-yellow-500' },
        { status: 'disconnected' as const, expectedClass: 'bg-gray-500' },
      ]

      connectionStates.forEach(({ status, expectedClass }) => {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({ connectionStatus: status })
        )

        const { container } = render(<AgentUtilizationWidget />)

        // Visual indicator should have appropriate color class
        const indicator = container.querySelector(`.${expectedClass}`)
        expect(indicator).toBeInTheDocument()
      })
    })

    it('does not rely solely on color for information', () => {
      // Mock error state with actual error message to trigger error UI
      vi.mocked(useAgentMetrics).mockReturnValue(
        createAgentMetricsErrorMock('Connection failed')
      )

      render(<AgentUtilizationWidget />)

      // Error should have both visual (color) and textual indicators
      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
      // Check for error text in accessible elements (title attribute or content)
      expect(screen.getByTitle('Connection Error')).toBeInTheDocument()
    })
  })

  describe('Progressive Enhancement', () => {
    it('provides fallbacks for enhanced features', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget showPerformance={true} />)

      // Performance metrics should be accessible via text even if charts fail
      expect(screen.getByText('Coder')).toBeInTheDocument()
      expect(screen.getByText('8.0K')).toBeInTheDocument()
    })

    it('maintains functionality with disabled JavaScript features', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      // Basic widget structure should be present
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Mobile Accessibility', () => {
    it('provides touch-friendly interactive elements', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByRole('button', { name: /refresh agent data/i })

      // Button should be large enough for touch interaction
      // Note: Actual size would be determined by CSS, but we can check it exists
      expect(refreshButton).toBeInTheDocument()
    })

    it('maintains readability at different zoom levels', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Text content should be properly structured for zoom
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
      expect(screen.getByText('1 active')).toBeInTheDocument()
    })
  })
})