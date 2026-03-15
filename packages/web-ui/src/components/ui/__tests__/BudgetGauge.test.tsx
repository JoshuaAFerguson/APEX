import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetGauge, BudgetGaugeMini, type BudgetGaugeProps } from '../BudgetGauge'

// Helper function to render BudgetGauge with default props
const renderBudgetGauge = (props: Partial<BudgetGaugeProps> = {}) => {
  const defaultProps: BudgetGaugeProps = {
    currentSpend: 750,
    budgetLimit: 1000,
    ...props,
  }
  return render(<BudgetGauge {...defaultProps} />)
}

describe('BudgetGauge', () => {
  describe('Rendering', () => {
    it('renders with basic props', () => {
      renderBudgetGauge()

      // Check if percentage is displayed
      expect(screen.getByText('75%')).toBeInTheDocument()

      // Check if amounts are displayed
      expect(screen.getByText('$750.00')).toBeInTheDocument()
      expect(screen.getByText('of $1,000.00')).toBeInTheDocument()
    })

    it('renders with custom label', () => {
      renderBudgetGauge({ label: 'Monthly Budget' })

      expect(screen.getByRole('heading', { name: 'Monthly Budget' })).toBeInTheDocument()
    })

    it('renders different sizes correctly', () => {
      const { rerender } = renderBudgetGauge({ size: 'sm', 'data-testid': 'gauge' })
      expect(screen.getByTestId('gauge')).toBeInTheDocument()

      rerender(<BudgetGauge currentSpend={750} budgetLimit={1000} size="lg" data-testid="gauge" />)
      expect(screen.getByTestId('gauge')).toBeInTheDocument()
    })

    it('hides percentage when showPercentage is false', () => {
      renderBudgetGauge({ showPercentage: false })

      expect(screen.queryByText('75%')).not.toBeInTheDocument()
    })

    it('hides amounts when showAmounts is false', () => {
      renderBudgetGauge({ showAmounts: false })

      expect(screen.queryByText('$750.00')).not.toBeInTheDocument()
      expect(screen.queryByText('of $1,000.00')).not.toBeInTheDocument()
    })
  })

  describe('Color States', () => {
    it('shows safe state for spending under 75%', () => {
      renderBudgetGauge({ currentSpend: 500, budgetLimit: 1000 })

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('Within budget')).toBeInTheDocument()
    })

    it('shows warning state for spending 75-89%', () => {
      renderBudgetGauge({ currentSpend: 800, budgetLimit: 1000 })

      expect(screen.getByText('80%')).toBeInTheDocument()
      expect(screen.getByText('Approaching limit')).toBeInTheDocument()
    })

    it('shows danger state for spending 90%+', () => {
      renderBudgetGauge({ currentSpend: 950, budgetLimit: 1000 })

      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('Over budget')).toBeInTheDocument()
    })

    it('shows danger state for spending over 100%', () => {
      renderBudgetGauge({ currentSpend: 1200, budgetLimit: 1000 })

      // Should cap display at 100%
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('Over budget')).toBeInTheDocument()
    })

    it('respects custom thresholds', () => {
      renderBudgetGauge({
        currentSpend: 800,
        budgetLimit: 1000,
        thresholds: { warning: 50, danger: 80 }
      })

      expect(screen.getByText('Over budget')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero budget limit', () => {
      renderBudgetGauge({ currentSpend: 100, budgetLimit: 0 })

      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getByText('Within budget')).toBeInTheDocument()
    })

    it('handles negative current spend', () => {
      renderBudgetGauge({ currentSpend: -100, budgetLimit: 1000 })

      expect(screen.getByText('0%')).toBeInTheDocument() // Should display 0% for negative values
      expect(screen.getByText('Within budget')).toBeInTheDocument()
    })

    it('handles very large numbers', () => {
      renderBudgetGauge({ currentSpend: 1000000, budgetLimit: 2000000 })

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('$1,000,000.00')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      renderBudgetGauge({ currentSpend: 750, budgetLimit: 1000 })

      // Check for progressbar role
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '75')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
      expect(progressbar).toHaveAttribute('aria-valuetext', '75 percent of budget used')
    })

    it('provides SVG accessibility', () => {
      renderBudgetGauge({ currentSpend: 750, budgetLimit: 1000 })

      const svgElement = screen.getByRole('img')
      expect(svgElement).toHaveAttribute('aria-label', 'Budget gauge: $750.00 spent of $1,000.00 budget (75%)')
    })

    it('marks status messages as alerts when appropriate', () => {
      renderBudgetGauge({ currentSpend: 950, budgetLimit: 1000 })

      const alertElement = screen.getByRole('alert')
      expect(alertElement).toHaveTextContent('Over budget')
    })

    it('has live region for dynamic updates', () => {
      renderBudgetGauge({ currentSpend: 750, budgetLimit: 1000 })

      const liveRegion = screen.getByRole('text')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })
  })

  describe('Custom Formatting', () => {
    it('uses custom currency formatter', () => {
      const customFormatter = (amount: number) => `€${amount.toFixed(0)}`

      renderBudgetGauge({
        currentSpend: 750,
        budgetLimit: 1000,
        formatCurrency: customFormatter
      })

      expect(screen.getByText('€750')).toBeInTheDocument()
      expect(screen.getByText('of €1000')).toBeInTheDocument()
    })
  })

  describe('SVG Rendering', () => {
    it('renders SVG with correct dimensions for different sizes', () => {
      const { rerender } = renderBudgetGauge({ size: 'sm' })
      let svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('width', '80')
      expect(svg).toHaveAttribute('height', '80')

      rerender(<BudgetGauge currentSpend={750} budgetLimit={1000} size="md" />)
      svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('width', '120')
      expect(svg).toHaveAttribute('height', '120')

      rerender(<BudgetGauge currentSpend={750} budgetLimit={1000} size="lg" />)
      svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('width', '160')
      expect(svg).toHaveAttribute('height', '160')
    })
  })
})

describe('BudgetGaugeMini', () => {
  const renderMini = (props: Parameters<typeof BudgetGaugeMini>[0]) => {
    return render(<BudgetGaugeMini {...props} />)
  }

  describe('Rendering', () => {
    it('renders with basic props', () => {
      renderMini({ currentSpend: 750, budgetLimit: 1000 })

      // Check for progress bar
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '75')

      // Check for compact currency format
      expect(screen.getByText('$750.0 / $1.0K')).toBeInTheDocument()
    })

    it('shows correct color state', () => {
      renderMini({ currentSpend: 950, budgetLimit: 1000 })

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveClass('bg-red-500')
    })

    it('respects custom thresholds', () => {
      renderMini({
        currentSpend: 600,
        budgetLimit: 1000,
        thresholds: { warning: 50, danger: 60 }
      })

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveClass('bg-red-500') // Should be danger state
    })

    it('uses custom currency formatter', () => {
      const customFormatter = (amount: number) => `€${amount}`

      renderMini({
        currentSpend: 750,
        budgetLimit: 1000,
        formatCurrency: customFormatter
      })

      expect(screen.getByText('€750 / €1000')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero budget limit', () => {
      renderMini({ currentSpend: 100, budgetLimit: 0 })

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '0')
      expect(progressbar).toHaveClass('bg-green-500') // Safe state
    })

    it('caps percentage at 100%', () => {
      renderMini({ currentSpend: 1200, budgetLimit: 1000 })

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '100')

      const progressDiv = progressbar
      expect(progressDiv).toHaveStyle({ width: '100%' })
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA attributes', () => {
      renderMini({ currentSpend: 750, budgetLimit: 1000 })

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '75')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
      expect(progressbar).toHaveAttribute('aria-label', '75% of budget used')
    })
  })
})