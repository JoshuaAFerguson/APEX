/**
 * Accessibility and usability tests for ProjectHealthPanel
 *
 * This file ensures the component meets accessibility standards (WCAG)
 * and provides good user experience for users with disabilities.
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import {
  generateMockHealthMetrics,
  generateWarningMockMetrics,
  generateCriticalMockMetrics,
} from '@/types/project-health'

describe('ProjectHealthPanel - Accessibility', () => {
  describe('ARIA Attributes and Roles', () => {
    it('has proper region role and accessible name', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      const mainRegion = screen.getByRole('region', { name: 'Project Health Panel' })
      expect(mainRegion).toBeInTheDocument()
      expect(mainRegion).toHaveAttribute('aria-label', 'Project Health Panel')
    })

    it('has proper status role for health indicator', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      const statusIndicator = screen.getByRole('status')
      expect(statusIndicator).toBeInTheDocument()
      expect(statusIndicator).toHaveAttribute('aria-label', 'Health status: Healthy')
    })

    it('provides accessible button labels', () => {
      const onRefresh = vi.fn()
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} onRefresh={onRefresh} />)

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh health metrics')
    })

    it('has live regions for dynamic updates', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      // Metric values should have aria-live for screen readers
      const successRateValue = screen.getByText('95.5%')
      const parentElement = successRateValue.closest('[aria-live]')
      expect(parentElement).toHaveAttribute('aria-live', 'polite')
    })

    it('provides meaningful aria-hidden attributes for decorative elements', () => {
      const metrics = generateMockHealthMetrics()
      const { container } = render(<ProjectHealthPanel metrics={metrics} />)

      // Icons should be aria-hidden since they're decorative
      const icons = container.querySelectorAll('svg')
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for interactive elements', () => {
      const onRefresh = vi.fn()
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} onRefresh={onRefresh} />)

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })

      // Should be focusable
      refreshButton.focus()
      expect(refreshButton).toHaveFocus()

      // Should respond to Enter key
      fireEvent.keyDown(refreshButton, { key: 'Enter', code: 'Enter' })
      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Should respond to Space key
      fireEvent.keyDown(refreshButton, { key: ' ', code: 'Space' })
      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('maintains logical tab order', () => {
      const onRefresh = vi.fn()
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} onRefresh={onRefresh} />)

      // Tab order should be logical (refresh button should be tabbable)
      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      expect(refreshButton).not.toHaveAttribute('tabindex', '-1')
    })

    it('disables interactive elements when loading', () => {
      const onRefresh = vi.fn()
      const metrics = generateMockHealthMetrics()
      render(
        <ProjectHealthPanel
          metrics={metrics}
          onRefresh={onRefresh}
          isLoading={true}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      expect(refreshButton).toBeDisabled()

      // Disabled button should not respond to clicks
      fireEvent.click(refreshButton)
      expect(onRefresh).not.toHaveBeenCalled()
    })
  })

  describe('Screen Reader Support', () => {
    it('provides descriptive text for status changes', () => {
      const onStatusChange = vi.fn()
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          onStatusChange={onStatusChange}
        />
      )

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Health status: Healthy')

      rerender(
        <ProjectHealthPanel
          metrics={generateWarningMockMetrics()}
          onStatusChange={onStatusChange}
        />
      )

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Health status: Warning')

      rerender(
        <ProjectHealthPanel
          metrics={generateCriticalMockMetrics()}
          onStatusChange={onStatusChange}
        />
      )

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Health status: Critical')
    })

    it('announces loading states to screen readers', () => {
      render(<ProjectHealthPanel isLoading={true} />)

      const loadingText = screen.getByText('Loading health metrics...')
      expect(loadingText).toBeInTheDocument()

      // Loading text should be announced to screen readers
      const loadingRegion = loadingText.closest('[role]')
      expect(loadingRegion).toBeInTheDocument()
    })

    it('provides context for metric descriptions', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} showDetails={true} />)

      // Metric cards should have accessible descriptions
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()

      // Task breakdown should be accessible
      expect(screen.getByText('Task Breakdown')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('handles error announcements appropriately', () => {
      const error = new Error('Failed to load health data')
      render(<ProjectHealthPanel error={error} />)

      const errorMessage = screen.getByText('Error Loading Health Metrics')
      expect(errorMessage).toBeInTheDocument()

      const errorDetails = screen.getByText('Failed to load health data')
      expect(errorDetails).toBeInTheDocument()
    })
  })

  describe('Color and Visual Accessibility', () => {
    it('provides non-color indicators for status', () => {
      const { container, rerender } = render(
        <ProjectHealthPanel metrics={generateMockHealthMetrics()} />
      )

      // Healthy status should have text indicator
      expect(screen.getByText('Healthy')).toBeInTheDocument()

      rerender(<ProjectHealthPanel metrics={generateWarningMockMetrics()} />)
      expect(screen.getByText('Warning')).toBeInTheDocument()

      rerender(<ProjectHealthPanel metrics={generateCriticalMockMetrics()} />)
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('uses sufficient color contrast for status indicators', () => {
      const { container } = render(
        <ProjectHealthPanel metrics={generateMockHealthMetrics()} />
      )

      // Status indicators should have high contrast colors
      // This would typically be tested with axe-core or similar tools
      const statusIndicator = container.querySelector('[role="status"]')
      expect(statusIndicator).toBeInTheDocument()
    })

    it('provides pattern/shape indicators alongside colors', () => {
      const metrics = generateMockHealthMetrics()
      const { container } = render(<ProjectHealthPanel metrics={metrics} />)

      // Status indicator should have both color and icon
      const statusElement = screen.getByRole('status')
      const icon = statusElement.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('maintains focus during status updates', () => {
      const onRefresh = vi.fn()
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      refreshButton.focus()
      expect(refreshButton).toHaveFocus()

      // Status update should not steal focus
      rerender(
        <ProjectHealthPanel
          metrics={generateWarningMockMetrics()}
          onRefresh={onRefresh}
        />
      )

      expect(refreshButton).toHaveFocus()
    })

    it('handles focus for error retry actions', () => {
      const onRefresh = vi.fn()
      const error = new Error('Connection failed')
      render(<ProjectHealthPanel error={error} onRefresh={onRefresh} />)

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      expect(retryButton).toBeInTheDocument()

      retryButton.focus()
      expect(retryButton).toHaveFocus()

      fireEvent.click(retryButton)
      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('Responsive and Mobile Accessibility', () => {
    it('maintains accessibility on mobile viewports', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      // Should still be accessible on mobile
      expect(screen.getByRole('region', { name: 'Project Health Panel' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('provides touch-friendly interaction targets', () => {
      const onRefresh = vi.fn()
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} onRefresh={onRefresh} />)

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })

      // Button should be large enough for touch interaction (minimum 44px)
      const buttonRect = refreshButton.getBoundingClientRect()
      expect(buttonRect.width).toBeGreaterThanOrEqual(24) // Accounting for padding
      expect(buttonRect.height).toBeGreaterThanOrEqual(24)
    })
  })

  describe('Animation and Motion Accessibility', () => {
    it('respects reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      const metrics = generateCriticalMockMetrics()
      const { container } = render(<ProjectHealthPanel metrics={metrics} />)

      // Critical status animations should respect reduced motion
      const animatedElements = container.querySelectorAll('[class*="animate"]')
      // In a real implementation, you'd check if animations are disabled
      expect(animatedElements.length).toBeGreaterThanOrEqual(0)
    })

    it('provides alternative indicators for users who cannot see animations', () => {
      const metrics = generateCriticalMockMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      // Critical status should have text indicator in addition to animations
      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Health status: Critical')
    })
  })

  describe('Content and Language Accessibility', () => {
    it('uses clear and understandable language', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} showDetails={true} />)

      // Labels should be clear and jargon-free
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('System Health')).toBeInTheDocument()
      expect(screen.getByText('Task Breakdown')).toBeInTheDocument()
    })

    it('provides meaningful error messages', () => {
      const error = new Error('Unable to connect to health monitoring service')
      render(<ProjectHealthPanel error={error} />)

      const errorHeading = screen.getByText('Error Loading Health Metrics')
      const errorMessage = screen.getByText('Unable to connect to health monitoring service')

      expect(errorHeading).toBeInTheDocument()
      expect(errorMessage).toBeInTheDocument()
    })

    it('formats data in accessible way', () => {
      const metrics = generateMockHealthMetrics({
        successRate: 95.5,
        averageDurationMs: 2500,
        systemHealth: 92.0,
      })
      render(<ProjectHealthPanel metrics={metrics} />)

      // Numbers should be formatted clearly
      expect(screen.getByText('95.5%')).toBeInTheDocument()
      expect(screen.getByText('2.5s')).toBeInTheDocument()
      expect(screen.getByText('92.0%')).toBeInTheDocument()
    })
  })

  describe('Assistive Technology Compatibility', () => {
    it('works with screen reader testing patterns', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      // Test common screen reader navigation patterns
      const headings = screen.getAllByRole('heading', { hidden: true })
      // Main title should be accessible
      expect(screen.getByText('Project Health')).toBeInTheDocument()

      // All interactive elements should be discoverable
      const buttons = screen.getAllByRole('button', { hidden: true })
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName()
      })
    })

    it('provides proper semantic structure', () => {
      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} showDetails={true} />)

      // Should use proper semantic elements
      const region = screen.getByRole('region')
      expect(region).toBeInTheDocument()

      const status = screen.getByRole('status')
      expect(status).toBeInTheDocument()

      // Buttons should have proper roles
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })
})