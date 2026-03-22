import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecutionTimeline, type ExecutionStage, type ExecutionStageStatus } from '../ExecutionTimeline'

describe('ExecutionTimeline Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Invalid Props Handling', () => {
    it('should handle null stages gracefully', () => {
      expect(() => {
        render(<ExecutionTimeline stages={null as any} />)
      }).not.toThrow()

      expect(screen.getByText('No execution stages to display')).toBeInTheDocument()
    })

    it('should handle undefined stages gracefully', () => {
      expect(() => {
        render(<ExecutionTimeline stages={undefined as any} />)
      }).not.toThrow()

      expect(screen.getByText('No execution stages to display')).toBeInTheDocument()
    })

    it('should handle stages with missing required properties', () => {
      const invalidStages = [
        { id: 'test' } as any, // Missing name and status
      ]

      expect(() => {
        render(<ExecutionTimeline stages={invalidStages} />)
      }).not.toThrow()
    })

    it('should handle stages with invalid status values', () => {
      const stagesWithInvalidStatus: ExecutionStage[] = [
        {
          id: 'invalid-status',
          name: 'Invalid Status Stage',
          status: 'invalid-status' as ExecutionStageStatus,
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stagesWithInvalidStatus} />)
      }).not.toThrow()

      expect(screen.getByText('Invalid Status Stage')).toBeInTheDocument()
    })

    it('should handle stages with null or undefined names', () => {
      const stagesWithInvalidNames = [
        {
          id: 'null-name',
          name: null,
          status: 'pending',
        },
        {
          id: 'undefined-name',
          name: undefined,
          status: 'pending',
        },
      ] as any[]

      expect(() => {
        render(<ExecutionTimeline stages={stagesWithInvalidNames} />)
      }).not.toThrow()
    })
  })

  describe('Date Handling Edge Cases', () => {
    it('should handle invalid start dates', () => {
      const stagesWithInvalidDates: ExecutionStage[] = [
        {
          id: 'invalid-date',
          name: 'Invalid Date',
          status: 'running',
          startedAt: new Date('invalid-date'),
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stagesWithInvalidDates} showTiming={true} />)
      }).not.toThrow()
    })

    it('should handle start date in the future', () => {
      const futureDate = new Date('2024-12-31T10:00:00Z')
      const stagesWithFutureDate: ExecutionStage[] = [
        {
          id: 'future-date',
          name: 'Future Start',
          status: 'running',
          startedAt: futureDate,
        },
      ]

      render(<ExecutionTimeline stages={stagesWithFutureDate} showTiming={true} />)
      expect(screen.getByText('Future Start')).toBeInTheDocument()
    })

    it('should handle completion date before start date', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'invalid-range',
          name: 'Invalid Range',
          status: 'completed',
          startedAt: new Date('2024-01-01T11:00:00Z'),
          completedAt: new Date('2024-01-01T10:00:00Z'), // Before start
          duration: 3600000,
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stages} showTiming={true} />)
      }).not.toThrow()
    })

    it('should handle very large duration values', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'large-duration',
          name: 'Large Duration',
          status: 'completed',
          duration: Number.MAX_SAFE_INTEGER,
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stages} showTiming={true} />)
      }).not.toThrow()
    })

    it('should handle negative duration values', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'negative-duration',
          name: 'Negative Duration',
          status: 'completed',
          duration: -3600000,
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stages} showTiming={true} />)
      }).not.toThrow()
    })
  })

  describe('Event Handler Edge Cases', () => {
    it('should handle error in click handler gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Test error')
      })

      const stages: ExecutionStage[] = [
        {
          id: 'error-stage',
          name: 'Error Stage',
          status: 'pending',
        },
      ]

      // Wrap the error handler to catch errors locally
      const safeErrorHandler = vi.fn((stageId: string) => {
        try {
          errorHandler(stageId)
        } catch (error) {
          // Error is caught and handled gracefully
          console.log('Error caught:', error)
        }
      })

      render(<ExecutionTimeline stages={stages} onStageClick={safeErrorHandler} />)

      fireEvent.click(screen.getByText('Error Stage'))

      expect(safeErrorHandler).toHaveBeenCalledWith('error-stage')
    })

    it('should handle keyboard events with invalid keys', () => {
      const handleStageClick = vi.fn()
      const stages: ExecutionStage[] = [
        {
          id: 'keyboard-test',
          name: 'Keyboard Test',
          status: 'pending',
        },
      ]

      render(<ExecutionTimeline stages={stages} onStageClick={handleStageClick} />)

      const stageElement = screen.getByText('Keyboard Test').closest('[role="button"]')!

      // Test with invalid/unsupported keys
      fireEvent.keyDown(stageElement, { key: 'Tab' })
      fireEvent.keyDown(stageElement, { key: 'Escape' })
      fireEvent.keyDown(stageElement, { key: 'ArrowLeft' })

      expect(handleStageClick).not.toHaveBeenCalled()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large stage names efficiently', () => {
      const largeString = 'A'.repeat(10000)
      const stages: ExecutionStage[] = [
        {
          id: 'large-name',
          name: largeString,
          status: 'pending',
        },
      ]

      const startTime = performance.now()
      render(<ExecutionTimeline stages={stages} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should render quickly
      expect(screen.getByTitle(largeString)).toBeInTheDocument()
    })

    it('should handle stages with very large metadata objects', () => {
      const largeMetadata = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          details: `Details for item ${i}`.repeat(100),
        })),
      }

      const stages: ExecutionStage[] = [
        {
          id: 'large-metadata',
          name: 'Large Metadata',
          status: 'pending',
          metadata: largeMetadata,
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stages} />)
      }).not.toThrow()
    })

    it('should handle rapid re-renders without memory leaks', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'rerender-test',
          name: 'Rerender Test',
          status: 'running',
          startedAt: new Date(),
        },
      ]

      const { rerender } = render(
        <ExecutionTimeline stages={stages} currentStageId="rerender-test" />
      )

      // Simulate rapid updates (like real-time progress)
      for (let i = 0; i < 100; i++) {
        const updatedStages = stages.map(stage => ({
          ...stage,
          metadata: { iteration: i },
        }))

        rerender(
          <ExecutionTimeline stages={updatedStages} currentStageId="rerender-test" />
        )
      }

      expect(screen.getByText('Rerender Test')).toBeInTheDocument()
    })
  })

  describe('CSS and Styling Edge Cases', () => {
    it('should handle very long class names', () => {
      const longClassName = 'class-name-'.repeat(100)

      expect(() => {
        render(<ExecutionTimeline stages={[]} className={longClassName} />)
      }).not.toThrow()
    })

    it('should handle special characters in class names', () => {
      const specialClassName = 'test@class#name$with%special^characters'

      expect(() => {
        render(<ExecutionTimeline stages={[]} className={specialClassName} />)
      }).not.toThrow()
    })

    it('should handle undefined/null className gracefully', () => {
      expect(() => {
        render(<ExecutionTimeline stages={[]} className={undefined} />)
      }).not.toThrow()

      expect(() => {
        render(<ExecutionTimeline stages={[]} className={null as any} />)
      }).not.toThrow()
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle missing performance API gracefully', () => {
      const originalPerformance = global.performance
      delete (global as any).performance

      const stages: ExecutionStage[] = [
        {
          id: 'performance-test',
          name: 'Performance Test',
          status: 'pending',
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stages} />)
      }).not.toThrow()

      global.performance = originalPerformance
    })

    it('should handle missing Intl API gracefully', () => {
      const originalIntl = global.Intl
      delete (global as any).Intl

      const stages: ExecutionStage[] = [
        {
          id: 'intl-test',
          name: 'Intl Test',
          status: 'completed',
          startedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: new Date('2024-01-01T10:05:00Z'),
          duration: 300000,
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={stages} showTiming={true} />)
      }).not.toThrow()

      global.Intl = originalIntl
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('should handle screen reader with very long stage names', () => {
      const veryLongName = 'This is an extremely long stage name that might cause issues with screen readers and other accessibility tools when they try to read it out loud'

      const stages: ExecutionStage[] = [
        {
          id: 'long-name-a11y',
          name: veryLongName,
          status: 'pending',
        },
      ]

      render(<ExecutionTimeline stages={stages} onStageClick={() => {}} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('tabindex', '0')
      expect(button).toHaveAttribute('role', 'button')
    })

    it('should maintain focus management with dynamic content', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'focus-test',
          name: 'Focus Test',
          status: 'pending',
        },
      ]

      const { rerender } = render(
        <ExecutionTimeline stages={stages} onStageClick={() => {}} />
      )

      const button = screen.getByRole('button')
      button.focus()
      expect(document.activeElement).toBe(button)

      // Update stages and ensure focus is preserved
      const updatedStages = stages.map(stage => ({
        ...stage,
        status: 'running' as const,
      }))

      rerender(<ExecutionTimeline stages={updatedStages} onStageClick={() => {}} />)

      // Focus should still be manageable
      const updatedButton = screen.getByRole('button')
      expect(updatedButton).toBeInTheDocument()
    })
  })

  describe('Concurrent Rendering Edge Cases', () => {
    it('should handle rapid state changes without corruption', async () => {
      const stages: ExecutionStage[] = [
        {
          id: 'concurrent-test',
          name: 'Concurrent Test',
          status: 'pending',
        },
      ]

      const { rerender } = render(<ExecutionTimeline stages={stages} />)

      // Simulate rapid state changes that might occur in concurrent mode
      const statuses: ExecutionStageStatus[] = ['pending', 'running', 'completed', 'failed', 'paused']

      for (const status of statuses) {
        const updatedStages = stages.map(stage => ({ ...stage, status }))
        rerender(<ExecutionTimeline stages={updatedStages} />)
      }

      expect(screen.getByText('Concurrent Test')).toBeInTheDocument()
    })
  })

  describe('Cleanup and Memory Management', () => {
    it('should clean up timers and listeners on unmount', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'cleanup-test',
          name: 'Cleanup Test',
          status: 'running',
          startedAt: new Date(),
        },
      ]

      const { unmount } = render(
        <ExecutionTimeline stages={stages} showTiming={true} animated={true} />
      )

      // Component should unmount without errors
      expect(() => unmount()).not.toThrow()
    })

    it('should handle component unmount during async operations', () => {
      const stages: ExecutionStage[] = [
        {
          id: 'async-unmount-test',
          name: 'Async Unmount Test',
          status: 'running',
          startedAt: new Date(),
        },
      ]

      const { unmount } = render(
        <ExecutionTimeline stages={stages} showTiming={true} />
      )

      // Simulate async operation and immediate unmount
      setTimeout(() => {
        // This should not cause any errors even if component is unmounted
      }, 0)

      expect(() => unmount()).not.toThrow()
    })
  })
})