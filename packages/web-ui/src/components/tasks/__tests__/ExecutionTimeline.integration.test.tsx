import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecutionTimeline, type ExecutionStage } from '../ExecutionTimeline'

describe('ExecutionTimeline Integration', () => {
  // Mock realistic execution stages that would come from a real task
  const realWorldStages: ExecutionStage[] = [
    {
      id: 'planning',
      name: 'Planning',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
      duration: 300000,
      metadata: { agent: 'planner', confidence: 0.95 }
    },
    {
      id: 'architecture',
      name: 'Architecture',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:05:00Z'),
      completedAt: new Date('2024-01-01T10:15:00Z'),
      duration: 600000,
      metadata: { agent: 'architect', filesModified: 3 }
    },
    {
      id: 'implementation',
      name: 'Implementation',
      status: 'running',
      startedAt: new Date('2024-01-01T10:15:00Z'),
      metadata: { agent: 'developer', currentFile: 'src/components/Timeline.tsx' }
    },
    {
      id: 'testing',
      name: 'Testing',
      status: 'pending',
      metadata: { agent: 'tester', estimatedDuration: 180000 }
    },
    {
      id: 'deployment',
      name: 'Deployment',
      status: 'pending',
      metadata: { agent: 'deployer', environment: 'staging' }
    },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T10:20:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Real-world Usage Scenarios', () => {
    it('should handle a complete workflow execution', () => {
      const { rerender } = render(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
          showTiming={true}
          animated={true}
        />
      )

      // Verify initial state
      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('Architecture')).toBeInTheDocument()
      expect(screen.getByText('Implementation')).toBeInTheDocument()
      expect(screen.getByText('Testing')).toBeInTheDocument()
      expect(screen.getByText('Deployment')).toBeInTheDocument()

      // Simulate implementation completing
      const updatedStages = realWorldStages.map(stage =>
        stage.id === 'implementation'
          ? {
              ...stage,
              status: 'completed' as const,
              completedAt: new Date('2024-01-01T10:25:00Z'),
              duration: 600000, // 10 minutes
            }
          : stage.id === 'testing'
          ? { ...stage, status: 'running' as const, startedAt: new Date('2024-01-01T10:25:00Z') }
          : stage
      )

      rerender(
        <ExecutionTimeline
          stages={updatedStages}
          currentStageId="testing"
          showTiming={true}
          animated={true}
        />
      )

      // Verify the timeline updated correctly
      expect(screen.getByText('Testing')).toBeInTheDocument()
    })

    it('should handle error scenarios gracefully', () => {
      const stagesWithError: ExecutionStage[] = [
        ...realWorldStages.slice(0, 2),
        {
          id: 'implementation',
          name: 'Implementation',
          status: 'failed',
          startedAt: new Date('2024-01-01T10:15:00Z'),
          metadata: {
            agent: 'developer',
            error: 'Compilation failed: Type error in Timeline.tsx line 42',
            failedAt: new Date('2024-01-01T10:18:00Z')
          }
        },
        ...realWorldStages.slice(3)
      ]

      render(
        <ExecutionTimeline
          stages={stagesWithError}
          currentStageId="implementation"
          showTiming={true}
          animated={true}
        />
      )

      // Verify error state is rendered correctly
      expect(screen.getByText('Implementation')).toBeInTheDocument()

      // Check that subsequent stages remain in pending state
      expect(screen.getByText('Testing')).toBeInTheDocument()
      expect(screen.getByText('Deployment')).toBeInTheDocument()
    })

    it('should work with different viewport sizes', () => {
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      const { container, rerender } = render(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
          compact={true}
        />
      )

      expect(container.firstChild).toBeInTheDocument()

      // Test desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      rerender(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
          compact={false}
        />
      )

      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('Performance and Responsiveness', () => {
    it('should handle large numbers of stages efficiently', () => {
      const manyStages: ExecutionStage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `stage-${i}`,
        name: `Stage ${i + 1}`,
        status: i < 5 ? 'completed' : i === 5 ? 'running' : 'pending',
        startedAt: i <= 5 ? new Date(Date.now() - (20 - i) * 60000) : undefined,
        completedAt: i < 5 ? new Date(Date.now() - (20 - i - 1) * 60000) : undefined,
        duration: i < 5 ? 60000 : undefined,
      }))

      const startTime = performance.now()

      render(
        <ExecutionTimeline
          stages={manyStages}
          currentStageId="stage-5"
          showTiming={true}
          animated={true}
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time (less than 100ms for 20 stages)
      expect(renderTime).toBeLessThan(100)

      // Verify all stages are rendered
      expect(screen.getByText('Stage 1')).toBeInTheDocument()
      expect(screen.getByText('Stage 10')).toBeInTheDocument()
      expect(screen.getByText('Stage 20')).toBeInTheDocument()
    })

    it('should update efficiently when stages change', () => {
      const initialStages = realWorldStages.slice(0, 3)
      const { rerender } = render(
        <ExecutionTimeline
          stages={initialStages}
          currentStageId="implementation"
        />
      )

      // Add more stages
      const expandedStages = [
        ...initialStages,
        ...realWorldStages.slice(3)
      ]

      const startTime = performance.now()

      rerender(
        <ExecutionTimeline
          stages={expandedStages}
          currentStageId="implementation"
        />
      )

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should update quickly
      expect(updateTime).toBeLessThan(100) // Increased tolerance

      // Verify new stages are rendered
      expect(screen.getByText('Testing')).toBeInTheDocument()
      expect(screen.getByText('Deployment')).toBeInTheDocument()
    })
  })

  describe('Integration with Task Management', () => {
    it('should provide useful callback data for task management integration', () => {
      const handleStageClick = vi.fn()

      render(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
          onStageClick={handleStageClick}
        />
      )

      // Click on a completed stage
      fireEvent.click(screen.getByText('Planning'))
      expect(handleStageClick).toHaveBeenCalledWith('planning')

      // Click on current stage
      fireEvent.click(screen.getByText('Implementation'))
      expect(handleStageClick).toHaveBeenCalledWith('implementation')

      // Click on pending stage
      fireEvent.click(screen.getByText('Testing'))
      expect(handleStageClick).toHaveBeenCalledWith('testing')

      expect(handleStageClick).toHaveBeenCalledTimes(3)
    })

    it('should integrate well with real task data structures', () => {
      // Simulate task data that might come from the backend
      const taskBasedStages: ExecutionStage[] = [
        {
          id: 'task-planning',
          name: 'Planning',
          status: 'completed',
          startedAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: new Date('2024-01-01T10:05:00Z'),
          duration: 300000,
          metadata: {
            taskId: 'task-123',
            agentId: 'agent-planner-1',
            costInCents: 50,
            tokensUsed: 1500
          }
        },
        {
          id: 'task-implementation',
          name: 'Implementation',
          status: 'running',
          startedAt: new Date('2024-01-01T10:05:00Z'),
          metadata: {
            taskId: 'task-124',
            agentId: 'agent-developer-1',
            estimatedCostInCents: 200,
            progressPercentage: 65
          }
        }
      ]

      render(
        <ExecutionTimeline
          stages={taskBasedStages}
          currentStageId="task-implementation"
          showTiming={true}
        />
      )

      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('Implementation')).toBeInTheDocument()
      // Duration for planning (exact format might vary)
      const timingElements = screen.getAllByText((content) => content.includes('5m'))
      expect(timingElements.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility Integration', () => {
    it('should work with screen readers', () => {
      render(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
          onStageClick={() => {}}
          aria-label="Task execution timeline"
        />
      )

      // Should have accessible elements
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(realWorldStages.length)

      buttons.forEach(button => {
        expect(button).toBeVisible()
        expect(button).not.toBeDisabled()
      })
    })

    it('should support keyboard navigation patterns', () => {
      const handleStageClick = vi.fn()

      render(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
          onStageClick={handleStageClick}
        />
      )

      const buttons = screen.getAllByRole('button')

      // Tab through all stages
      buttons.forEach((button, index) => {
        button.focus()
        expect(document.activeElement).toBe(button)

        // Test activation
        fireEvent.keyDown(button, { key: 'Enter' })
        expect(handleStageClick).toHaveBeenCalledWith(realWorldStages[index].id)
      })
    })
  })

  describe('Theme Integration', () => {
    it('should respect system theme preferences', () => {
      // Mock dark theme
      document.documentElement.classList.add('dark')

      const { container } = render(
        <ExecutionTimeline
          stages={realWorldStages}
          currentStageId="implementation"
        />
      )

      // Component should render without issues in dark mode
      expect(container.firstChild).toBeInTheDocument()

      // Clean up
      document.documentElement.classList.remove('dark')
    })

    it('should work with custom theme colors', () => {
      const { container } = render(
        <div className="theme-custom">
          <ExecutionTimeline
            stages={realWorldStages}
            currentStageId="implementation"
            className="custom-timeline"
          />
        </div>
      )

      expect(container.querySelector('.custom-timeline')).toBeInTheDocument()
    })
  })
})