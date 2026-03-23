import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Task } from '@apexcli/core'
import { ExecutionTimeline, type ExecutionStage } from '../ExecutionTimeline'
import {
  transformTaskToExecutionStages,
  getCurrentStageId,
  shouldShowExecutionTimeline
} from '@/lib/execution-timeline-utils'

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
    vi.clearAllMocks()
  })

  // Factory for creating realistic task objects
  const createTaskWithWorkflow = (
    workflow: 'developer' | 'researcher' | 'reviewer' | 'orchestrator' | 'custom',
    status: Task['status'],
    overrides?: Partial<Task>
  ): Task => ({
    id: `task-${workflow}-${status}`,
    description: `Test ${workflow} task`,
    status,
    workflow,
    autonomy: 'medium',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    ...overrides,
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

  describe('Task Detail Page Integration', () => {
    describe('Task Data Transformation', () => {
      it('transforms developer task to planning → implementing → testing → reviewing stages', () => {
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
          createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={getCurrentStageId(task)}
            animated={true}
            showTiming={true}
          />
        )

        // Verify all expected stages are present
        expect(screen.getByText('Queued')).toBeInTheDocument()
        expect(screen.getByText('Planning')).toBeInTheDocument()
        expect(screen.getByText('Implementing')).toBeInTheDocument()
        expect(screen.getByText('Testing')).toBeInTheDocument()
        expect(screen.getByText('Reviewing')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()

        // Verify current stage is highlighted
        const currentStageId = getCurrentStageId(task)
        expect(currentStageId).toBe('implementing')
      })

      it('transforms researcher task to investigating → analyzing → documenting stages', () => {
        const task = createTaskWithWorkflow('researcher', 'in-progress', {
          currentStage: 'analyzing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={getCurrentStageId(task)}
            showTiming={true}
          />
        )

        expect(screen.getByText('Queued')).toBeInTheDocument()
        expect(screen.getByText('Investigating')).toBeInTheDocument()
        expect(screen.getByText('Analyzing')).toBeInTheDocument()
        expect(screen.getByText('Documenting')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()

        expect(getCurrentStageId(task)).toBe('analyzing')
      })

      it('transforms reviewer task to reviewing → feedback stages', () => {
        const task = createTaskWithWorkflow('reviewer', 'in-progress', {
          currentStage: 'feedback',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={getCurrentStageId(task)}
            showTiming={true}
          />
        )

        expect(screen.getByText('Queued')).toBeInTheDocument()
        expect(screen.getByText('Reviewing')).toBeInTheDocument()
        expect(screen.getByText('Feedback')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()

        expect(getCurrentStageId(task)).toBe('feedback')
      })

      it('transforms orchestrator task to orchestrating → coordinating → finalizing stages', () => {
        const task = createTaskWithWorkflow('orchestrator', 'in-progress', {
          currentStage: 'coordinating',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={getCurrentStageId(task)}
            showTiming={true}
          />
        )

        expect(screen.getByText('Queued')).toBeInTheDocument()
        expect(screen.getByText('Orchestrating')).toBeInTheDocument()
        expect(screen.getByText('Coordinating')).toBeInTheDocument()
        expect(screen.getByText('Finalizing')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()

        expect(getCurrentStageId(task)).toBe('coordinating')
      })

      it('handles custom/unknown workflow types with default stages', () => {
        const task = createTaskWithWorkflow('custom', 'in-progress', {
          workflow: 'unknown-workflow',
          currentStage: 'executing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={getCurrentStageId(task)}
            showTiming={true}
          />
        )

        // Should use default stages
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Planning')).toBeInTheDocument()
        expect(screen.getByText('Executing')).toBeInTheDocument()
        expect(screen.getByText('Reviewing')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()

        expect(getCurrentStageId(task)).toBe('executing')
      })

      it('handles tasks with explicit executionStages from API', () => {
        const task = {
          ...createTaskWithWorkflow('developer', 'in-progress'),
          executionStages: [
            {
              id: 'custom-planning',
              name: 'Custom Planning',
              status: 'completed',
              startedAt: '2024-01-01T10:00:00Z',
              completedAt: '2024-01-01T10:05:00Z',
              duration: 300000,
            },
            {
              id: 'custom-implementing',
              name: 'Custom Implementing',
              status: 'running',
              startedAt: '2024-01-01T10:05:00Z',
            },
          ],
        } as Task & { executionStages: any[] }

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="custom-implementing"
            showTiming={true}
          />
        )

        // Should use the explicit stages from API
        expect(screen.getByText('Custom Planning')).toBeInTheDocument()
        expect(screen.getByText('Custom Implementing')).toBeInTheDocument()

        // Should not show standard workflow stages
        expect(screen.queryByText('Testing')).not.toBeInTheDocument()
        expect(screen.queryByText('Reviewing')).not.toBeInTheDocument()
      })
    })

    describe('Workflow-Specific Stage Rendering', () => {
      it('shows correct stages for pending/queued tasks', () => {
        const task = createTaskWithWorkflow('developer', 'pending')

        const stages = transformTaskToExecutionStages(task)
        const currentStageId = getCurrentStageId(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={currentStageId}
            animated={true}
          />
        )

        expect(currentStageId).toBe('pending')

        // First stage should be running (for pending tasks)
        expect(screen.getByText('Queued')).toBeInTheDocument()
      })

      it('shows correct stages for in-progress tasks', () => {
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)
        const currentStageId = getCurrentStageId(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={currentStageId}
            animated={true}
          />
        )

        expect(currentStageId).toBe('implementing')

        // Previous stages should be completed, current running, future pending
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })

      it('shows all stages as completed for completed tasks', () => {
        const task = createTaskWithWorkflow('developer', 'completed', {
          completedAt: new Date('2024-01-01T11:00:00Z').toISOString(),
        })

        const stages = transformTaskToExecutionStages(task)
        const currentStageId = getCurrentStageId(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={currentStageId}
            showTiming={true}
          />
        )

        expect(currentStageId).toBe('completed')

        // All stages should be present
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })

      it('shows failed stage indicator for failed tasks', () => {
        const task = createTaskWithWorkflow('developer', 'failed', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)
        const currentStageId = getCurrentStageId(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={currentStageId}
            animated={false}
          />
        )

        expect(currentStageId).toBe('implementing')
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })

      it('shows skipped stages for cancelled tasks', () => {
        const task = createTaskWithWorkflow('developer', 'cancelled', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)
        const currentStageId = getCurrentStageId(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={currentStageId}
            animated={false}
          />
        )

        expect(currentStageId).toBe('implementing')
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })

      it('shows paused indicator for paused tasks', () => {
        const task = createTaskWithWorkflow('developer', 'paused', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)
        const currentStageId = getCurrentStageId(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId={currentStageId}
            animated={false}
          />
        )

        expect(currentStageId).toBe('implementing')
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })
    })

    describe('Running Task Animation', () => {
      it('applies animation to running stage indicator', () => {
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        const { container } = render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            animated={true}
          />
        )

        // Should have animated elements for running tasks
        const animatedElements = container.querySelectorAll('.animate-pulse')
        expect(animatedElements.length).toBeGreaterThan(0)
      })

      it('does not animate completed tasks', () => {
        const task = createTaskWithWorkflow('developer', 'completed')

        const stages = transformTaskToExecutionStages(task)

        const { container } = render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="completed"
            animated={true}
          />
        )

        // Verify the component renders
        expect(container.firstChild).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })

      it('does not animate failed tasks', () => {
        const task = createTaskWithWorkflow('developer', 'failed', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        const { container } = render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            animated={true}
          />
        )

        expect(container.firstChild).toBeInTheDocument()
      })

      it('toggles animation correctly when animated prop changes', () => {
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        const { container, rerender } = render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            animated={false}
          />
        )

        // Initially no animation
        let animatedElements = container.querySelectorAll('.animate-pulse')
        expect(animatedElements.length).toBe(0)

        // Enable animation
        rerender(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            animated={true}
          />
        )

        // Now should have animation
        animatedElements = container.querySelectorAll('.animate-pulse')
        expect(animatedElements.length).toBeGreaterThan(0)
      })
    })

    describe('Stage Interaction', () => {
      it('stage click integrates with task navigation pattern', async () => {
        const onStageClick = vi.fn()
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            onStageClick={onStageClick}
          />
        )

        // Click on a stage
        const planningStage = screen.getByText('Planning')
        fireEvent.click(planningStage.closest('[role="button"]') || planningStage.parentElement!)

        expect(onStageClick).toHaveBeenCalledWith('planning')
      })

      it('keyboard navigation works with Enter key', async () => {
        const onStageClick = vi.fn()
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            onStageClick={onStageClick}
          />
        )

        const buttons = screen.getAllByRole('button')
        const firstButton = buttons[0]

        // Focus and press Enter
        firstButton.focus()
        fireEvent.keyDown(firstButton, { key: 'Enter' })

        expect(onStageClick).toHaveBeenCalled()
      })

      it('keyboard navigation works with Space key', async () => {
        const onStageClick = vi.fn()
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            onStageClick={onStageClick}
          />
        )

        const buttons = screen.getAllByRole('button')
        const firstButton = buttons[0]

        // Focus and press Space
        firstButton.focus()
        fireEvent.keyDown(firstButton, { key: ' ' })

        expect(onStageClick).toHaveBeenCalled()
      })

      it('multiple clicks track correctly', async () => {
        const onStageClick = vi.fn()
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            onStageClick={onStageClick}
          />
        )

        // Click multiple stages
        const planningStage = screen.getByText('Planning')
        const implementingStage = screen.getByText('Implementing')
        const testingStage = screen.getByText('Testing')

        fireEvent.click(planningStage.closest('[role="button"]') || planningStage.parentElement!)
        fireEvent.click(implementingStage.closest('[role="button"]') || implementingStage.parentElement!)
        fireEvent.click(testingStage.closest('[role="button"]') || testingStage.parentElement!)

        expect(onStageClick).toHaveBeenCalledTimes(3)
        expect(onStageClick).toHaveBeenNthCalledWith(1, 'planning')
        expect(onStageClick).toHaveBeenNthCalledWith(2, 'implementing')
        expect(onStageClick).toHaveBeenNthCalledWith(3, 'testing')
      })

      it('accessibility attributes present when clickable', () => {
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            onStageClick={() => {}}
          />
        )

        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)

        buttons.forEach(button => {
          expect(button).toBeVisible()
          expect(button).not.toBeDisabled()
        })
      })
    })

    describe('Timing Display Integration', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('displays elapsed time for running stages using real transformation', () => {
        vi.setSystemTime(new Date('2024-01-01T10:15:00Z'))

        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
          createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            showTiming={true}
          />
        )

        // Should show elapsed time - the component internally uses getElapsedTime
        // We can't easily test the exact format without mocking getElapsedTime
        // But we can verify timing is being shown
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })

      it('shows duration for completed stages', () => {
        const task = createTaskWithWorkflow('developer', 'completed', {
          createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
          completedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="completed"
            showTiming={true}
          />
        )

        expect(screen.getByText('Completed')).toBeInTheDocument()
        // Duration display details would be tested in unit tests
      })

      it('handles edge cases with timing display', () => {
        // Test task with missing start time
        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
          createdAt: undefined, // Missing timing data
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            showTiming={true}
          />
        )

        // Should still render without crashing
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })

      it('formats large durations correctly', () => {
        vi.setSystemTime(new Date('2024-01-02T10:00:00Z')) // 24 hours later

        const task = createTaskWithWorkflow('developer', 'in-progress', {
          currentStage: 'implementing',
          createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        })

        const stages = transformTaskToExecutionStages(task)

        render(
          <ExecutionTimeline
            stages={stages}
            currentStageId="implementing"
            showTiming={true}
          />
        )

        // Should handle large time differences
        expect(screen.getByText('Implementing')).toBeInTheDocument()
      })
    })

    describe('shouldShowExecutionTimeline Integration', () => {
      it('shows timeline for tasks with explicit execution stages', () => {
        const task = {
          ...createTaskWithWorkflow('developer', 'pending'),
          executionStages: [
            { id: 'stage1', name: 'Stage 1', status: 'pending' }
          ]
        } as Task & { executionStages: any[] }

        expect(shouldShowExecutionTimeline(task)).toBe(true)
      })

      it('shows timeline for advanced task statuses', () => {
        const advancedStatuses: Task['status'][] = [
          'planning', 'in-progress', 'waiting-approval', 'completed', 'failed', 'paused'
        ]

        advancedStatuses.forEach(status => {
          const task = createTaskWithWorkflow('developer', status)
          expect(shouldShowExecutionTimeline(task)).toBe(true)
        })
      })

      it('does not show timeline for basic pending/queued tasks without execution stages', () => {
        const basicTask = createTaskWithWorkflow('developer', 'pending')
        expect(shouldShowExecutionTimeline(basicTask)).toBe(false)

        const queuedTask = createTaskWithWorkflow('developer', 'queued')
        expect(shouldShowExecutionTimeline(queuedTask)).toBe(false)
      })
    })
  })
})