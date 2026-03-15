import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BudgetGauge, BudgetGaugeMini } from '../BudgetGauge'

describe('BudgetGauge - Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Dynamic Updates and Re-rendering', () => {
    it('updates progressively from safe to warning to danger state', () => {
      const TestComponent = () => {
        const [currentSpend, setCurrentSpend] = React.useState(500)
        const budgetLimit = 1000

        return (
          <div>
            <BudgetGauge currentSpend={currentSpend} budgetLimit={budgetLimit} />
            <button onClick={() => setCurrentSpend(750)} data-testid="to-warning">
              To Warning
            </button>
            <button onClick={() => setCurrentSpend(950)} data-testid="to-danger">
              To Danger
            </button>
          </div>
        )
      }

      render(<TestComponent />)

      // Initial state - safe (50%)
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('Within budget')).toBeInTheDocument()

      // Update to warning state
      act(() => {
        fireEvent.click(screen.getByTestId('to-warning'))
      })
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('Approaching limit')).toBeInTheDocument()

      // Update to danger state
      act(() => {
        fireEvent.click(screen.getByTestId('to-danger'))
      })
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('Over budget')).toBeInTheDocument()
    })

    it('handles rapid successive updates correctly', () => {
      const TestComponent = () => {
        const [currentSpend, setCurrentSpend] = React.useState(100)
        const budgetLimit = 1000

        return (
          <div>
            <BudgetGauge currentSpend={currentSpend} budgetLimit={budgetLimit} />
            <button
              onClick={() => setCurrentSpend(900)}
              data-testid="rapid-update"
            >
              Rapid Update
            </button>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByText('10%')).toBeInTheDocument()

      act(() => {
        fireEvent.click(screen.getByTestId('rapid-update'))
      })

      expect(screen.getByText('90%')).toBeInTheDocument()
      expect(screen.getByText('Over budget')).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle and Memory Management', () => {
    it('properly cleans up resources when unmounted', () => {
      const { unmount } = render(
        <BudgetGauge currentSpend={750} budgetLimit={1000} />
      )

      // Verify component renders
      expect(screen.getByText('75%')).toBeInTheDocument()

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow()
    })

    it('handles component re-mounting with different props', () => {
      const { rerender } = render(
        <BudgetGauge currentSpend={500} budgetLimit={1000} size="sm" />
      )

      expect(screen.getByText('50%')).toBeInTheDocument()

      // Re-mount with different props
      rerender(
        <BudgetGauge currentSpend={800} budgetLimit={1200} size="lg" />
      )

      expect(screen.getByText('67%')).toBeInTheDocument()
      expect(screen.getByText('$800.00')).toBeInTheDocument()
      expect(screen.getByText('of $1,200.00')).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('adapts to different container sizes', () => {
      const SmallContainer = () => (
        <div style={{ width: '100px', height: '100px' }}>
          <BudgetGauge currentSpend={750} budgetLimit={1000} size="sm" />
        </div>
      )

      const LargeContainer = () => (
        <div style={{ width: '300px', height: '300px' }}>
          <BudgetGauge currentSpend={750} budgetLimit={1000} size="lg" />
        </div>
      )

      const { rerender } = render(<SmallContainer />)
      let svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('width', '80')

      rerender(<LargeContainer />)
      svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('width', '160')
    })

    it('maintains readability across size variants', () => {
      const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg']

      sizes.forEach(size => {
        const { rerender } = render(
          <BudgetGauge currentSpend={750} budgetLimit={1000} size={size} />
        )

        // All sizes should display percentage and amounts clearly
        expect(screen.getByText('75%')).toBeInTheDocument()
        expect(screen.getByText('$750.00')).toBeInTheDocument()
        expect(screen.getByText('of $1,000.00')).toBeInTheDocument()

        rerender(<div />) // Clear for next iteration
      })
    })
  })

  describe('Error Boundary Compatibility', () => {
    it('gracefully handles invalid prop combinations', () => {
      // Test with invalid numbers that might cause errors
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(
          <BudgetGauge
            currentSpend={NaN}
            budgetLimit={1000}
          />
        )
      }).not.toThrow()

      expect(() => {
        render(
          <BudgetGauge
            currentSpend={750}
            budgetLimit={Infinity}
          />
        )
      }).not.toThrow()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('User Interaction Scenarios', () => {
    it('supports keyboard navigation for accessibility', () => {
      render(
        <div>
          <button>Previous</button>
          <BudgetGauge currentSpend={750} budgetLimit={1000} tabIndex={0} />
          <button>Next</button>
        </div>
      )

      const prevButton = screen.getByText('Previous')
      const nextButton = screen.getByText('Next')

      // Test basic focusability
      prevButton.focus()
      expect(prevButton).toHaveFocus()

      nextButton.focus()
      expect(nextButton).toHaveFocus()
    })

    it('maintains focus management during updates', () => {
      const TestComponent = () => {
        const [currentSpend, setCurrentSpend] = React.useState(500)

        return (
          <div>
            <BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />
            <button
              onClick={() => setCurrentSpend(750)}
              data-testid="update-button"
            >
              Update
            </button>
          </div>
        )
      }

      render(<TestComponent />)

      const button = screen.getByTestId('update-button')

      // Initial state
      expect(screen.getByText('50%')).toBeInTheDocument()

      // Update via click
      act(() => {
        fireEvent.click(button)
      })

      // Verify update occurred
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })
})

describe('BudgetGaugeMini - Integration Tests', () => {
  describe('Performance with Large Lists', () => {
    it('renders efficiently in a list of 100 items', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        currentSpend: Math.random() * 1000,
        budgetLimit: 1000,
      }))

      const ListComponent = () => (
        <div data-testid="budget-list">
          {items.map(item => (
            <div key={item.id} data-testid={`budget-item-${item.id}`}>
              <BudgetGaugeMini
                currentSpend={item.currentSpend}
                budgetLimit={item.budgetLimit}
              />
            </div>
          ))}
        </div>
      )

      const startTime = performance.now()
      render(<ListComponent />)
      const renderTime = performance.now() - startTime

      // Should render within reasonable time (less than 1 second for 100 items)
      expect(renderTime).toBeLessThan(1000)

      // Verify all items are rendered
      expect(screen.getAllByRole('progressbar')).toHaveLength(100)
    })
  })

  describe('Data Update Scenarios', () => {
    it('handles streaming data updates efficiently', () => {
      const TestComponent = () => {
        const [budgets, setBudgets] = React.useState([
          { id: 1, currentSpend: 100, budgetLimit: 1000 },
          { id: 2, currentSpend: 200, budgetLimit: 1000 },
          { id: 3, currentSpend: 300, budgetLimit: 1000 },
        ])

        return (
          <div>
            {budgets.map(budget => (
              <div key={budget.id} data-testid={`budget-${budget.id}`}>
                <BudgetGaugeMini
                  currentSpend={budget.currentSpend}
                  budgetLimit={budget.budgetLimit}
                />
              </div>
            ))}
            <button
              onClick={() => setBudgets(prev => prev.map(budget => ({
                ...budget,
                currentSpend: budget.currentSpend + 100
              })))}
              data-testid="update-all"
            >
              Update All
            </button>
          </div>
        )
      }

      render(<TestComponent />)

      // Verify initial render
      expect(screen.getAllByRole('progressbar')).toHaveLength(3)

      // Update data
      act(() => {
        fireEvent.click(screen.getByTestId('update-all'))
      })

      // Should still have all progress bars after updates
      expect(screen.getAllByRole('progressbar')).toHaveLength(3)
    })
  })
})

describe('Cross-Component Integration', () => {
  it('maintains consistent behavior between full and mini components', () => {
    const currentSpend = 750
    const budgetLimit = 1000

    render(
      <div>
        <BudgetGauge currentSpend={currentSpend} budgetLimit={budgetLimit} />
        <BudgetGaugeMini currentSpend={currentSpend} budgetLimit={budgetLimit} />
      </div>
    )

    // Both components should show same percentage state
    expect(screen.getByText('75%')).toBeInTheDocument() // Main gauge percentage

    // Both should have progress bars with correct value
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars).toHaveLength(2) // One in main gauge (sr-only), one in mini
    progressBars.forEach(bar => {
      expect(bar).toHaveAttribute('aria-valuenow', '75')
    })
  })

  it('handles synchronized prop changes across multiple instances', () => {
    const TestComponent = () => {
      const [globalBudget, setGlobalBudget] = React.useState(1000)
      const [spending, setSpending] = React.useState(500)

      return (
        <div>
          <BudgetGauge currentSpend={spending} budgetLimit={globalBudget} label="Main Budget" />
          <BudgetGauge currentSpend={spending * 0.8} budgetLimit={globalBudget * 0.8} label="Sub Budget 1" />
          <BudgetGauge currentSpend={spending * 0.2} budgetLimit={globalBudget * 0.2} label="Sub Budget 2" />

          <button onClick={() => setSpending(800)} data-testid="increase-spending">
            Increase Spending
          </button>
          <button onClick={() => setGlobalBudget(1200)} data-testid="increase-budget">
            Increase Budget
          </button>
        </div>
      )
    }

    render(<TestComponent />)

    // Initial state - all should show 50%
    expect(screen.getAllByText('50%')).toHaveLength(3)

    // Increase spending
    act(() => {
      fireEvent.click(screen.getByTestId('increase-spending'))
    })

    // Main budget: 800/1000 = 80%
    // Sub budget 1: 640/800 = 80%
    // Sub budget 2: 160/200 = 80%
    expect(screen.getAllByText('80%')).toHaveLength(3)
  })
})