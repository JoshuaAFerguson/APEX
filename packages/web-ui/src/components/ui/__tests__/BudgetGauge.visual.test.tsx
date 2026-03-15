import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetGauge, BudgetGaugeMini } from '../BudgetGauge'

describe('BudgetGauge - Visual Rendering Tests', () => {
  let mockGetBoundingClientRect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Mock getBoundingClientRect to simulate different container sizes
    mockGetBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('SVG Arc Rendering', () => {
    it('renders correct SVG structure for different sizes', () => {
      const sizes = [
        { size: 'sm' as const, expectedWidth: 80, expectedStrokeWidth: 6 },
        { size: 'md' as const, expectedWidth: 120, expectedStrokeWidth: 8 },
        { size: 'lg' as const, expectedWidth: 160, expectedStrokeWidth: 10 },
      ]

      sizes.forEach(({ size, expectedWidth, expectedStrokeWidth }) => {
        const { container } = render(
          <div data-testid={`test-container-${size}`}>
            <BudgetGauge
              currentSpend={750}
              budgetLimit={1000}
              size={size}
              data-testid={`gauge-${size}`}
            />
          </div>
        )

        const svg = container.querySelector('svg[role="img"]')
        expect(svg).toHaveAttribute('width', expectedWidth.toString())
        expect(svg).toHaveAttribute('height', expectedWidth.toString())

        // Check stroke width on circle elements
        const circles = container.querySelectorAll('circle')
        circles.forEach(circle => {
          expect(circle).toHaveAttribute('stroke-width', expectedStrokeWidth.toString())
        })
      })
    })

    it('calculates correct arc geometry', () => {
      const { container } = render(
        <BudgetGauge currentSpend={750} budgetLimit={1000} size="md" />
      )

      const svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('viewBox', '0 0 120 120')

      const circles = container.querySelectorAll('circle')
      expect(circles).toHaveLength(2) // Background and progress arcs

      // Verify circle positioning (center should be 60 for md size)
      circles.forEach(circle => {
        expect(circle).toHaveAttribute('cx', '60')
        expect(circle).toHaveAttribute('cy', '60')
      })
    })

    it('renders proper stroke-dasharray for arc effect', () => {
      const { container } = render(
        <BudgetGauge currentSpend={500} budgetLimit={1000} size="md" />
      )

      const circles = container.querySelectorAll('circle')
      const backgroundArc = circles[0]
      const progressArc = circles[1]

      // Both arcs should have stroke-dasharray for the arc effect
      expect(backgroundArc).toHaveAttribute('stroke-dasharray')
      expect(progressArc).toHaveAttribute('stroke-dasharray')

      // Progress arc should have stroke-dashoffset for animation
      expect(progressArc).toHaveAttribute('stroke-dashoffset')
    })

    it('applies correct rotation for arc start position', () => {
      const { container } = render(
        <BudgetGauge currentSpend={750} budgetLimit={1000} />
      )

      const svg = screen.getByRole('img')
      expect(svg).toHaveClass('-rotate-135')
    })
  })

  describe('Color State Visual Validation', () => {
    it('applies correct color classes for each state', () => {
      const testCases = [
        {
          currentSpend: 500,
          budgetLimit: 1000,
          expectedColorClass: 'stroke-green-500',
          state: 'safe'
        },
        {
          currentSpend: 800,
          budgetLimit: 1000,
          expectedColorClass: 'stroke-yellow-500',
          state: 'warning'
        },
        {
          currentSpend: 950,
          budgetLimit: 1000,
          expectedColorClass: 'stroke-red-500',
          state: 'danger'
        },
      ]

      testCases.forEach(({ currentSpend, budgetLimit, expectedColorClass, state }) => {
        const { container } = render(
          <BudgetGauge
            currentSpend={currentSpend}
            budgetLimit={budgetLimit}
            data-testid={`gauge-${state}`}
          />
        )

        const progressCircle = container.querySelectorAll('circle')[1]
        expect(progressCircle).toHaveClass(expectedColorClass)
      })
    })

    it('maintains visual consistency across re-renders', () => {
      let currentSpend = 500
      const { container, rerender } = render(
        <BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />
      )

      // Initial safe state
      let progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle).toHaveClass('stroke-green-500')

      // Update to warning state
      currentSpend = 800
      rerender(<BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />)
      progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle).toHaveClass('stroke-yellow-500')

      // Update to danger state
      currentSpend = 950
      rerender(<BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />)
      progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle).toHaveClass('stroke-red-500')
    })
  })

  describe('Center Content Layout', () => {
    it('positions center content correctly', () => {
      const { container } = render(
        <BudgetGauge
          currentSpend={750}
          budgetLimit={1000}
          showPercentage={true}
          showAmounts={true}
        />
      )

      const centerContent = container.querySelector('.absolute.inset-0')
      expect(centerContent).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center')

      // Check percentage display
      const percentageDisplay = centerContent?.querySelector('[role="text"]')
      expect(percentageDisplay).toHaveClass('font-bold', 'leading-tight')
      expect(percentageDisplay).toHaveAttribute('aria-live', 'polite')

      // Check amounts display
      const amountsDisplay = centerContent?.querySelector('.text-center.leading-tight')
      expect(amountsDisplay).toBeInTheDocument()
    })

    it('adjusts font sizes for different gauge sizes', () => {
      const sizes = [
        { size: 'sm' as const, expectedFontSize: '1rem' },
        { size: 'md' as const, expectedFontSize: '1.25rem' },
        { size: 'lg' as const, expectedFontSize: '1.5rem' },
      ]

      sizes.forEach(({ size, expectedFontSize }) => {
        const { container } = render(
          <BudgetGauge
            currentSpend={750}
            budgetLimit={1000}
            size={size}
            showPercentage={true}
          />
        )

        const percentageElement = container.querySelector('[role="text"]')
        expect(percentageElement).toHaveStyle({ fontSize: expectedFontSize })
      })
    })
  })

  describe('Responsive Layout Validation', () => {
    it('adapts to container constraints', () => {
      // Simulate narrow container
      mockGetBoundingClientRect.mockReturnValue({
        width: 100,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })

      const { container } = render(
        <div style={{ width: '100px', height: '200px' }}>
          <BudgetGauge currentSpend={750} budgetLimit={1000} size="sm" />
        </div>
      )

      const gauge = container.querySelector('[class*="flex"][class*="flex-col"]')
      expect(gauge).toHaveClass('items-center')
    })

    it('maintains aspect ratio across different screen sizes', () => {
      const screenSizes = [
        { width: 320, height: 568 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 }, // Desktop
      ]

      screenSizes.forEach(({ width, height }) => {
        mockGetBoundingClientRect.mockReturnValue({
          width,
          height,
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          x: 0,
          y: 0,
          toJSON: () => ({})
        })

        const { container } = render(
          <BudgetGauge currentSpend={750} budgetLimit={1000} size="md" />
        )

        const svg = screen.getByRole('img')
        const svgWidth = svg.getAttribute('width')
        const svgHeight = svg.getAttribute('height')

        expect(svgWidth).toBe(svgHeight) // Should maintain 1:1 aspect ratio
      })
    })
  })

  describe('Animation and Transition Validation', () => {
    it('applies transition classes to progress arc', () => {
      const { container } = render(
        <BudgetGauge currentSpend={750} budgetLimit={1000} />
      )

      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle).toHaveClass(
        'transition-all',
        'duration-700',
        'ease-out'
      )
    })

    it('preserves transition smoothness during state changes', () => {
      const { container, rerender } = render(
        <BudgetGauge currentSpend={500} budgetLimit={1000} />
      )

      let progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle).toHaveClass('transition-all')

      // Change to warning state
      rerender(<BudgetGauge currentSpend={800} budgetLimit={1000} />)
      progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle).toHaveClass('transition-all') // Should maintain transition
    })
  })

  describe('Text Content Visual Validation', () => {
    it('renders status indicators with appropriate styling', () => {
      const testCases = [
        {
          currentSpend: 500,
          budgetLimit: 1000,
          expectedText: 'Within budget',
          shouldHaveAlert: false
        },
        {
          currentSpend: 800,
          budgetLimit: 1000,
          expectedText: 'Approaching limit',
          shouldHaveAlert: true
        },
        {
          currentSpend: 950,
          budgetLimit: 1000,
          expectedText: 'Over budget',
          shouldHaveAlert: true
        },
      ]

      testCases.forEach(({ currentSpend, budgetLimit, expectedText, shouldHaveAlert }, index) => {
        const { container } = render(
          <div data-testid={`status-test-${index}`}>
            <BudgetGauge currentSpend={currentSpend} budgetLimit={budgetLimit} />
          </div>
        )

        const statusText = container.querySelector(`[data-testid="status-test-${index}"] span`)
        expect(statusText).toHaveTextContent(expectedText)

        if (shouldHaveAlert) {
          expect(statusText).toHaveAttribute('role', 'alert')
        }
      })
    })

    it('maintains text readability across color states', () => {
      const testCases = [
        { currentSpend: 500, expectedTextClass: 'text-green-600' },
        { currentSpend: 800, expectedTextClass: 'text-yellow-600' },
        { currentSpend: 950, expectedTextClass: 'text-red-600' },
      ]

      testCases.forEach(({ currentSpend, expectedTextClass }) => {
        const { container } = render(
          <BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />
        )

        const percentageElement = container.querySelector('[role="text"]')
        expect(percentageElement).toHaveClass(expectedTextClass)
      })
    })
  })
})

describe('BudgetGaugeMini - Visual Rendering Tests', () => {
  describe('Progress Bar Rendering', () => {
    it('renders correct progress bar structure', () => {
      const { container } = render(
        <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
      )

      // Check for progress bar container
      const progressContainer = container.querySelector('.h-2.rounded-full.overflow-hidden')
      expect(progressContainer).toBeInTheDocument()
      expect(progressContainer).toHaveClass('bg-background-tertiary')

      // Check for progress bar fill
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveClass('h-full', 'transition-all', 'duration-500')
    })

    it('sets correct width for progress visualization', () => {
      const testCases = [
        { currentSpend: 250, budgetLimit: 1000, expectedWidth: '25%' },
        { currentSpend: 500, budgetLimit: 1000, expectedWidth: '50%' },
        { currentSpend: 750, budgetLimit: 1000, expectedWidth: '75%' },
        { currentSpend: 1000, budgetLimit: 1000, expectedWidth: '100%' },
        { currentSpend: 1250, budgetLimit: 1000, expectedWidth: '100%' }, // Should cap at 100%
      ]

      testCases.forEach(({ currentSpend, budgetLimit, expectedWidth }, index) => {
        const { container } = render(
          <div data-testid={`mini-width-test-${index}`}>
            <BudgetGaugeMini currentSpend={currentSpend} budgetLimit={budgetLimit} />
          </div>
        )

        const progressBar = container.querySelector(`[data-testid="mini-width-test-${index}"] [role="progressbar"]`)
        expect(progressBar).toHaveStyle({ width: expectedWidth })
      })
    })

    it('applies correct color states to progress bar', () => {
      const colorStates = [
        { currentSpend: 500, expectedClass: 'bg-green-500' },
        { currentSpend: 800, expectedClass: 'bg-yellow-500' },
        { currentSpend: 950, expectedClass: 'bg-red-500' },
      ]

      colorStates.forEach(({ currentSpend, expectedClass }, index) => {
        const { container } = render(
          <div data-testid={`mini-color-test-${index}`}>
            <BudgetGaugeMini currentSpend={currentSpend} budgetLimit={1000} />
          </div>
        )

        const progressBar = container.querySelector(`[data-testid="mini-color-test-${index}"] [role="progressbar"]`)
        expect(progressBar).toHaveClass(expectedClass)
      })
    })
  })

  describe('Compact Text Display', () => {
    it('displays compact currency format correctly', () => {
      render(
        <BudgetGaugeMini currentSpend={1250} budgetLimit={2000} />
      )

      // Should use compact notation for mini component
      expect(screen.getByText('$1.3K / $2.0K')).toBeInTheDocument()
    })

    it('handles very large numbers with compact formatting', () => {
      render(
        <BudgetGaugeMini currentSpend={1500000} budgetLimit={2000000} />
      )

      expect(screen.getByText('$1.5M / $2.0M')).toBeInTheDocument()
    })

    it('maintains text layout in constrained spaces', () => {
      const { container } = render(
        <div style={{ width: '200px' }}>
          <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
        </div>
      )

      const textElement = container.querySelector('.text-xs.text-foreground-secondary')
      expect(textElement).toHaveClass('whitespace-nowrap')
    })
  })

  describe('Layout Flexibility', () => {
    it('maintains proper spacing and alignment', () => {
      const { container } = render(
        <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
      )

      const containerElement = container.firstChild
      expect(containerElement).toHaveClass('flex', 'items-center', 'gap-2')
    })

    it('handles custom class names properly', () => {
      const { container } = render(
        <BudgetGaugeMini
          currentSpend={750}
          budgetLimit={1000}
          className="custom-mini-budget"
        />
      )

      const containerElement = container.firstChild
      expect(containerElement).toHaveClass('custom-mini-budget')
    })
  })

  describe('Visual Consistency', () => {
    it('maintains visual consistency between instances', () => {
      const { container } = render(
        <div>
          <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
          <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
          <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
        </div>
      )

      const progressBars = screen.getAllByRole('progressbar')
      progressBars.forEach(bar => {
        expect(bar).toHaveAttribute('aria-valuenow', '75')
        expect(bar).toHaveClass('bg-yellow-500') // 75% should be warning state
        expect(bar).toHaveStyle({ width: '75%' })
      })
    })

    it('scales appropriately in grid layouts', () => {
      const { container } = render(
        <div className="grid grid-cols-3 gap-4">
          <BudgetGaugeMini currentSpend={250} budgetLimit={1000} />
          <BudgetGaugeMini currentSpend={500} budgetLimit={1000} />
          <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
        </div>
      )

      const progressBars = screen.getAllByRole('progressbar')
      expect(progressBars).toHaveLength(3)

      // Each should maintain its flex-1 class for proper grid behavior
      progressBars.forEach(bar => {
        const progressContainer = bar.parentElement
        expect(progressContainer).toHaveClass('flex-1')
      })
    })
  })
})