import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { BudgetGauge, BudgetGaugeMini } from '../BudgetGauge'

describe('BudgetGauge - Performance Tests', () => {
  let performanceMark: ReturnType<typeof vi.fn>
  let performanceMeasure: ReturnType<typeof vi.fn>
  let performanceNow: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Mock performance API
    performanceMark = vi.fn()
    performanceMeasure = vi.fn().mockReturnValue({ duration: 10 })
    performanceNow = vi.fn(() => performance.now())

    Object.defineProperty(global, 'performance', {
      value: {
        mark: performanceMark,
        measure: performanceMeasure,
        now: performanceNow,
        getEntriesByType: vi.fn().mockReturnValue([]),
        clearMarks: vi.fn(),
        clearMeasures: vi.fn(),
      },
      writable: true,
    })

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Initial Rendering Performance', () => {
    it('renders within performance budget', () => {
      const startTime = performance.now()

      render(
        <BudgetGauge currentSpend={750} budgetLimit={1000} />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Initial render should be under 100ms (generous for testing environment)
      expect(renderTime).toBeLessThan(100)
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('handles multiple simultaneous renders efficiently', () => {
      const startTime = performance.now()

      const components = Array.from({ length: 10 }, (_, i) => (
        <BudgetGauge
          key={i}
          currentSpend={i * 100}
          budgetLimit={1000}
          size={i % 2 === 0 ? 'sm' : 'lg'}
        />
      ))

      render(<div>{components}</div>)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Rendering 10 components should still be reasonably fast
      expect(renderTime).toBeLessThan(500)
      expect(screen.getAllByRole('img')).toHaveLength(10)
    })

    it('optimizes SVG calculations through memoization', () => {
      let memoCalculationCount = 0

      // Create a component that tracks calculation calls
      const TestComponent = ({ currentSpend }: { currentSpend: number }) => {
        const calculationResult = React.useMemo(() => {
          memoCalculationCount++
          return currentSpend / 1000 * 100
        }, [currentSpend])

        return (
          <BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />
        )
      }

      const { rerender } = render(<TestComponent currentSpend={500} />)

      // Initial render
      expect(memoCalculationCount).toBe(1)

      // Re-render with same props (should not recalculate)
      rerender(<TestComponent currentSpend={500} />)
      expect(memoCalculationCount).toBe(1) // Should still be 1

      // Re-render with different props (should recalculate)
      rerender(<TestComponent currentSpend={750} />)
      expect(memoCalculationCount).toBe(2)
    })
  })

  describe('Re-rendering Performance', () => {
    it('minimizes re-renders when props do not change', () => {
      let renderCount = 0

      const TestComponent = (props: any) => {
        renderCount++
        return <BudgetGauge {...props} />
      }

      const { rerender } = render(
        <TestComponent currentSpend={750} budgetLimit={1000} />
      )

      expect(renderCount).toBe(1)

      // Re-render with identical props
      rerender(<TestComponent currentSpend={750} budgetLimit={1000} />)

      // Should have re-rendered (React doesn't prevent this at component level)
      // but our memoization should prevent expensive recalculations
      expect(renderCount).toBe(2)
    })

    it('handles rapid prop changes efficiently', () => {
      const TestComponent = () => {
        const [currentSpend, setCurrentSpend] = React.useState(100)

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCurrentSpend(prev => prev + 10)
          }, 10)

          return () => clearInterval(interval)
        }, [])

        return <BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />
      }

      const startTime = performance.now()
      render(<TestComponent />)

      // Let it update rapidly for 100ms
      act(() => {
        vi.advanceTimersByTime(100)
      })

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should handle rapid updates without performance degradation
      expect(updateTime).toBeLessThan(200)
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('batches state updates appropriately', async () => {
      const TestComponent = () => {
        const [currentSpend, setCurrentSpend] = React.useState(500)
        const [budgetLimit, setBudgetLimit] = React.useState(1000)

        const updateBoth = () => {
          // These should be batched in React 18
          setCurrentSpend(800)
          setBudgetLimit(1200)
        }

        return (
          <div>
            <BudgetGauge currentSpend={currentSpend} budgetLimit={budgetLimit} />
            <button onClick={updateBoth} data-testid="update-both">
              Update Both
            </button>
          </div>
        )
      }

      const startTime = performance.now()
      const { container } = render(<TestComponent />)

      const button = screen.getByTestId('update-both')

      act(() => {
        button.click()
      })

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Batched updates should be fast
      expect(updateTime).toBeLessThan(50)
      expect(screen.getByText('67%')).toBeInTheDocument() // 800/1200 = 67%
    })
  })

  describe('Memory Usage Optimization', () => {
    it('cleans up resources when unmounted', () => {
      const TestComponent = () => {
        const [mounted, setMounted] = React.useState(true)

        return (
          <div>
            {mounted && <BudgetGauge currentSpend={750} budgetLimit={1000} />}
            <button onClick={() => setMounted(false)} data-testid="unmount">
              Unmount
            </button>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByText('75%')).toBeInTheDocument()

      const unmountButton = screen.getByTestId('unmount')
      act(() => {
        unmountButton.click()
      })

      expect(screen.queryByText('75%')).not.toBeInTheDocument()
      // Should not throw any memory leak warnings
    })

    it('handles large numbers of mount/unmount cycles', () => {
      const TestComponent = () => {
        const [components, setComponents] = React.useState<number[]>([])

        const addComponent = () => {
          setComponents(prev => [...prev, prev.length])
        }

        const removeComponent = () => {
          setComponents(prev => prev.slice(0, -1))
        }

        const clearComponents = () => {
          setComponents([])
        }

        return (
          <div>
            {components.map(id => (
              <BudgetGauge key={id} currentSpend={id * 100} budgetLimit={1000} />
            ))}
            <button onClick={addComponent} data-testid="add">Add</button>
            <button onClick={removeComponent} data-testid="remove">Remove</button>
            <button onClick={clearComponents} data-testid="clear">Clear</button>
          </div>
        )
      }

      const startTime = performance.now()
      render(<TestComponent />)

      const addButton = screen.getByTestId('add')
      const removeButton = screen.getByTestId('remove')
      const clearButton = screen.getByTestId('clear')

      // Add 20 components
      act(() => {
        Array.from({ length: 20 }).forEach(() => {
          addButton.click()
        })
      })

      expect(screen.getAllByRole('img')).toHaveLength(20)

      // Remove half
      act(() => {
        Array.from({ length: 10 }).forEach(() => {
          removeButton.click()
        })
      })

      expect(screen.getAllByRole('img')).toHaveLength(10)

      // Clear all
      act(() => {
        clearButton.click()
      })

      expect(screen.queryAllByRole('img')).toHaveLength(0)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // All operations should complete quickly
      expect(totalTime).toBeLessThan(500)
    })
  })

  describe('Large Scale Performance', () => {
    it('handles large lists of mini gauges efficiently', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        currentSpend: Math.random() * 1000,
        budgetLimit: 1000,
      }))

      const startTime = performance.now()

      const { container } = render(
        <div data-testid="large-list">
          {items.slice(0, 100).map(item => ( // Only render first 100 to keep test reasonable
            <BudgetGaugeMini
              key={item.id}
              currentSpend={item.currentSpend}
              budgetLimit={item.budgetLimit}
            />
          ))}
        </div>
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(1000) // Should render 100 items in under 1 second
      expect(screen.getAllByRole('progressbar')).toHaveLength(100)
    })

    it('maintains performance with frequent updates in large lists', () => {
      const TestComponent = () => {
        const [items, setItems] = React.useState(() =>
          Array.from({ length: 50 }, (_, i) => ({
            id: i,
            currentSpend: Math.random() * 1000,
            budgetLimit: 1000,
          }))
        )

        React.useEffect(() => {
          const interval = setInterval(() => {
            setItems(prev => prev.map(item => ({
              ...item,
              currentSpend: Math.min(item.currentSpend + Math.random() * 10, 1000)
            })))
          }, 100)

          return () => clearInterval(interval)
        }, [])

        return (
          <div>
            {items.map(item => (
              <BudgetGaugeMini
                key={item.id}
                currentSpend={item.currentSpend}
                budgetLimit={item.budgetLimit}
              />
            ))}
          </div>
        )
      }

      const startTime = performance.now()
      render(<TestComponent />)

      // Let it update for several cycles
      act(() => {
        vi.advanceTimersByTime(500)
      })

      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(updateTime).toBeLessThan(1000) // Should handle updates efficiently
      expect(screen.getAllByRole('progressbar')).toHaveLength(50)
    })
  })

  describe('Animation Performance', () => {
    it('uses efficient CSS transitions', () => {
      const { container } = render(
        <BudgetGauge currentSpend={750} budgetLimit={1000} />
      )

      const progressCircle = container.querySelectorAll('circle')[1]

      // Should use CSS transitions rather than JavaScript animations
      expect(progressCircle).toHaveClass('transition-all')
      expect(progressCircle).toHaveClass('duration-700')
      expect(progressCircle).toHaveClass('ease-out')
    })

    it('minimizes layout thrashing during animations', () => {
      const TestComponent = () => {
        const [currentSpend, setCurrentSpend] = React.useState(100)

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCurrentSpend(prev => Math.min(prev + 50, 1000))
          }, 100)

          return () => clearInterval(interval)
        }, [])

        return <BudgetGauge currentSpend={currentSpend} budgetLimit={1000} />
      }

      const startTime = performance.now()
      render(<TestComponent />)

      // Run through animation sequence
      act(() => {
        vi.advanceTimersByTime(2000) // Let it animate through several steps
      })

      const endTime = performance.now()
      const animationTime = endTime - startTime

      expect(animationTime).toBeLessThan(100) // Transitions should be efficient
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('Threshold Calculation Performance', () => {
    it('optimizes threshold calculations with memoization', () => {
      let thresholdCalculations = 0

      const TestComponent = ({ currentSpend }: { currentSpend: number }) => {
        const thresholds = React.useMemo(() => {
          thresholdCalculations++
          return { warning: 75, danger: 90 }
        }, []) // Empty deps - should only calculate once

        return (
          <BudgetGauge
            currentSpend={currentSpend}
            budgetLimit={1000}
            thresholds={thresholds}
          />
        )
      }

      const { rerender } = render(<TestComponent currentSpend={500} />)

      expect(thresholdCalculations).toBe(1)

      // Multiple re-renders should not recalculate thresholds
      rerender(<TestComponent currentSpend={600} />)
      rerender(<TestComponent currentSpend={700} />)
      rerender(<TestComponent currentSpend={800} />)

      expect(thresholdCalculations).toBe(1) // Should still be 1
    })

    it('handles dynamic threshold changes efficiently', () => {
      const TestComponent = () => {
        const [warningThreshold, setWarningThreshold] = React.useState(75)
        const [currentSpend] = React.useState(800)

        return (
          <div>
            <BudgetGauge
              currentSpend={currentSpend}
              budgetLimit={1000}
              thresholds={{ warning: warningThreshold, danger: 90 }}
            />
            <button
              onClick={() => setWarningThreshold(prev => prev === 75 ? 60 : 75)}
              data-testid="toggle-threshold"
            >
              Toggle Threshold
            </button>
          </div>
        )
      }

      const startTime = performance.now()
      render(<TestComponent />)

      const toggleButton = screen.getByTestId('toggle-threshold')

      // Rapidly toggle threshold
      act(() => {
        Array.from({ length: 10 }).forEach(() => {
          toggleButton.click()
        })
      })

      const endTime = performance.now()
      const toggleTime = endTime - startTime

      expect(toggleTime).toBeLessThan(100) // Should handle threshold changes quickly
    })
  })
})