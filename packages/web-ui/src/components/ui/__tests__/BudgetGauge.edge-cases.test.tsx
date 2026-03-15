import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { BudgetGauge, BudgetGaugeMini } from '../BudgetGauge'

describe('BudgetGauge - Edge Cases and Error Handling', () => {
  describe('Numerical Edge Cases', () => {
    it('handles extremely small numbers', () => {
      render(
        <BudgetGauge
          currentSpend={0.001}
          budgetLimit={0.01}
          data-testid="tiny-numbers"
        />
      )

      expect(screen.getByText('10%')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument() // Should round to cents
      expect(screen.getByText('of $0.01')).toBeInTheDocument()
    })

    it('handles extremely large numbers', () => {
      const largeCurrent = 999999999999.99
      const largeBudget = 1000000000000

      render(
        <BudgetGauge
          currentSpend={largeCurrent}
          budgetLimit={largeBudget}
          data-testid="huge-numbers"
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('$999,999,999,999.99')).toBeInTheDocument()
    })

    it('handles floating point precision issues', () => {
      // Test cases that might cause floating point errors
      render(
        <BudgetGauge
          currentSpend={0.1 + 0.2} // 0.30000000000000004
          budgetLimit={0.6}
          data-testid="float-precision"
        />
      )

      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('handles zero values correctly', () => {
      const { rerender } = render(
        <BudgetGauge currentSpend={0} budgetLimit={1000} />
      )

      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument()
      expect(screen.getByText('Within budget')).toBeInTheDocument()

      rerender(<BudgetGauge currentSpend={500} budgetLimit={0} />)
      expect(screen.getByText('0%')).toBeInTheDocument() // Should default to 0% for zero budget
    })

    it('handles negative numbers appropriately', () => {
      render(
        <BudgetGauge
          currentSpend={-100}
          budgetLimit={1000}
          data-testid="negative-spend"
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument() // Should floor at 0%
      expect(screen.getByText('-$100.00')).toBeInTheDocument() // But show actual amount

      const { rerender } = render(
        <BudgetGauge
          currentSpend={500}
          budgetLimit={-1000}
          data-testid="negative-budget"
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument() // Should default to 0% for negative budget
    })

    it('handles NaN and Infinity values gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Test NaN currentSpend
      render(
        <BudgetGauge
          currentSpend={NaN}
          budgetLimit={1000}
          data-testid="nan-spend"
        />
      )
      expect(screen.getByText('0%')).toBeInTheDocument()

      // Test Infinity currentSpend
      const { rerender } = render(
        <BudgetGauge
          currentSpend={Infinity}
          budgetLimit={1000}
          data-testid="infinity-spend"
        />
      )
      expect(screen.getByText('100%')).toBeInTheDocument() // Should cap at 100%

      // Test Infinity budgetLimit
      rerender(
        <BudgetGauge
          currentSpend={1000}
          budgetLimit={Infinity}
          data-testid="infinity-budget"
        />
      )
      expect(screen.getByText('0%')).toBeInTheDocument() // 1000/Infinity = 0

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Threshold Edge Cases', () => {
    it('handles threshold boundaries precisely', () => {
      const { rerender } = render(
        <BudgetGauge
          currentSpend={749.99} // Just under 75%
          budgetLimit={1000}
          thresholds={{ warning: 75, danger: 90 }}
        />
      )

      expect(screen.getByText('Within budget')).toBeInTheDocument()

      rerender(
        <BudgetGauge
          currentSpend={750} // Exactly 75%
          budgetLimit={1000}
          thresholds={{ warning: 75, danger: 90 }}
        />
      )

      expect(screen.getByText('Approaching limit')).toBeInTheDocument()

      rerender(
        <BudgetGauge
          currentSpend={899.99} // Just under 90%
          budgetLimit={1000}
          thresholds={{ warning: 75, danger: 90 }}
        />
      )

      expect(screen.getByText('Approaching limit')).toBeInTheDocument()

      rerender(
        <BudgetGauge
          currentSpend={900} // Exactly 90%
          budgetLimit={1000}
          thresholds={{ warning: 75, danger: 90 }}
        />
      )

      expect(screen.getByText('Over budget')).toBeInTheDocument()
    })

    it('handles invalid threshold configurations', () => {
      // Warning threshold higher than danger threshold
      render(
        <BudgetGauge
          currentSpend={850}
          budgetLimit={1000}
          thresholds={{ warning: 95, danger: 80 }}
          data-testid="invalid-thresholds"
        />
      )

      // Should still function - this tests the component's robustness
      expect(screen.getByText('85%')).toBeInTheDocument()

      // Negative thresholds
      const { rerender } = render(
        <BudgetGauge
          currentSpend={500}
          budgetLimit={1000}
          thresholds={{ warning: -10, danger: -5 }}
        />
      )

      expect(screen.getByText('50%')).toBeInTheDocument()

      // Threshold values over 100%
      rerender(
        <BudgetGauge
          currentSpend={500}
          budgetLimit={1000}
          thresholds={{ warning: 150, danger: 200 }}
        />
      )

      expect(screen.getByText('Within budget')).toBeInTheDocument() // Should remain safe
    })
  })

  describe('Prop Validation and Error Boundaries', () => {
    it('handles missing required props gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // @ts-ignore - Testing runtime behavior with missing props
      expect(() => render(<BudgetGauge />)).not.toThrow()

      consoleErrorSpy.mockRestore()
    })

    it('handles malformed formatCurrency function', () => {
      const malformedFormatter = () => {
        throw new Error('Formatter error')
      }

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Component should not crash even with broken formatter
      expect(() => {
        render(
          <BudgetGauge
            currentSpend={750}
            budgetLimit={1000}
            formatCurrency={malformedFormatter}
          />
        )
      }).not.toThrow()

      consoleErrorSpy.mockRestore()
    })

    it('handles formatCurrency returning non-string values', () => {
      // @ts-ignore - Testing runtime behavior
      const invalidFormatter = () => null

      render(
        <BudgetGauge
          currentSpend={750}
          budgetLimit={1000}
          formatCurrency={invalidFormatter}
        />
      )

      // Should still render percentage
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  describe('SVG Rendering Edge Cases', () => {
    it('handles zero radius calculations', () => {
      // Simulate a scenario where calculations might result in zero radius
      const MockedBudgetGauge = (props: any) => {
        // Force a size configuration that might cause issues
        return <BudgetGauge {...props} size="sm" />
      }

      render(
        <MockedBudgetGauge
          currentSpend={750}
          budgetLimit={1000}
        />
      )

      const svg = screen.getByRole('img')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('width', '80')
    })

    it('handles extreme percentage values for arc rendering', () => {
      // Test with spending way over budget
      render(
        <BudgetGauge
          currentSpend={5000}
          budgetLimit={1000}
          data-testid="extreme-overspend"
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument() // Should cap display at 100%
      expect(screen.getByText('Over budget')).toBeInTheDocument()

      const svg = screen.getByRole('img')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('handles rapid prop changes without memory leaks', () => {
      const TestComponent = () => {
        const [counter, setCounter] = React.useState(0)

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCounter(c => c + 1)
          }, 1)

          return () => clearInterval(interval)
        }, [])

        return (
          <BudgetGauge
            currentSpend={counter % 1000}
            budgetLimit={1000}
          />
        )
      }

      const { unmount } = render(<TestComponent />)

      // Let it run for a bit
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should unmount cleanly
      expect(() => unmount()).not.toThrow()
    })

    it('handles component updates with deeply nested objects', () => {
      const complexThresholds = {
        warning: 75,
        danger: 90,
        // Add some extra nested data that might cause issues
        metadata: {
          created: new Date(),
          config: {
            nested: {
              deeply: {
                value: 'test'
              }
            }
          }
        }
      }

      const { rerender } = render(
        <BudgetGauge
          currentSpend={750}
          budgetLimit={1000}
          // @ts-ignore - Testing with extra properties
          thresholds={complexThresholds}
        />
      )

      expect(screen.getByText('75%')).toBeInTheDocument()

      // Should handle re-render with modified complex object
      rerender(
        <BudgetGauge
          currentSpend={800}
          budgetLimit={1000}
          // @ts-ignore
          thresholds={{
            ...complexThresholds,
            metadata: { ...complexThresholds.metadata, updated: new Date() }
          }}
        />
      )

      expect(screen.getByText('80%')).toBeInTheDocument()
    })
  })
})

describe('BudgetGaugeMini - Edge Cases and Error Handling', () => {
  describe('Compact Display Edge Cases', () => {
    it('handles very long currency strings in compact mode', () => {
      // Custom formatter that produces very long strings
      const verboseFormatter = (amount: number) =>
        `Exactly $${amount.toLocaleString()} United States Dollars`

      render(
        <BudgetGaugeMini
          currentSpend={1234567.89}
          budgetLimit={2000000}
          formatCurrency={verboseFormatter}
        />
      )

      // Should still render without layout issues
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('handles zero-width container gracefully', () => {
      const { container } = render(
        <div style={{ width: '0px', overflow: 'hidden' }}>
          <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
        </div>
      )

      // Component should render even in zero-width container
      expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument()
    })

    it('handles RTL (right-to-left) text direction', () => {
      const { container } = render(
        <div dir="rtl" lang="ar">
          <BudgetGaugeMini
            currentSpend={750}
            budgetLimit={1000}
            formatCurrency={(amount) => `${amount} ر.س`} // Arabic Riyal
          />
        </div>
      )

      const progressBar = container.querySelector('[role="progressbar"]')
      expect(progressBar).toBeInTheDocument()
      expect(screen.getByText(/750 ر\.س/)).toBeInTheDocument()
    })
  })

  describe('Progressive Web App Edge Cases', () => {
    it('handles offline scenarios gracefully', () => {
      // Simulate offline environment
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      render(
        <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()

      // Restore online status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
    })

    it('handles reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(
        <BudgetGaugeMini currentSpend={750} budgetLimit={1000} />
      )

      // Component should still render correctly
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('handles screen reader compatibility with complex values', () => {
      render(
        <BudgetGaugeMini
          currentSpend={123456.789}
          budgetLimit={987654.321}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label')

      const ariaLabel = progressBar.getAttribute('aria-label')
      expect(ariaLabel).toContain('12%') // Should round appropriately
    })

    it('maintains accessibility with custom themes', () => {
      const { container } = render(
        <div className="dark-theme high-contrast">
          <BudgetGaugeMini
            currentSpend={750}
            budgetLimit={1000}
            className="custom-budget-mini"
          />
        </div>
      )

      const progressBar = container.querySelector('[role="progressbar"]')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })
  })

  describe('Cross-Browser Edge Cases', () => {
    it('handles Safari-specific number formatting quirks', () => {
      // Mock Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
        configurable: true,
      })

      render(
        <BudgetGaugeMini
          currentSpend={1000.5}
          budgetLimit={2000.7}
        />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('handles Internet Explorer legacy compatibility', () => {
      // Mock IE-specific behavior
      const originalIntl = global.Intl
      // @ts-ignore
      global.Intl = undefined

      // Component should still work without Intl support
      render(
        <BudgetGaugeMini
          currentSpend={750}
          budgetLimit={1000}
        />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()

      // Restore Intl
      global.Intl = originalIntl
    })
  })
})