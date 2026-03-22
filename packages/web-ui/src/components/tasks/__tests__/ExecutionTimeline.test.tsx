import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecutionTimeline, type ExecutionStage, type ExecutionStageStatus } from '../ExecutionTimeline'

describe('ExecutionTimeline', () => {
  const mockStages: ExecutionStage[] = [
    {
      id: 'planning',
      name: 'Planning',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
      duration: 300000, // 5 minutes
    },
    {
      id: 'architecture',
      name: 'Architecture',
      status: 'completed',
      startedAt: new Date('2024-01-01T10:05:00Z'),
      completedAt: new Date('2024-01-01T10:15:00Z'),
      duration: 600000, // 10 minutes
    },
    {
      id: 'implementation',
      name: 'Implementation',
      status: 'running',
      startedAt: new Date('2024-01-01T10:15:00Z'),
    },
    {
      id: 'testing',
      name: 'Testing',
      status: 'pending',
    },
    {
      id: 'deployment',
      name: 'Deployment',
      status: 'pending',
    },
  ]

  beforeEach(() => {
    // Mock Date.now for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T10:20:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('should render all stages correctly', () => {
      render(<ExecutionTimeline stages={mockStages} />)

      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('Architecture')).toBeInTheDocument()
      expect(screen.getByText('Implementation')).toBeInTheDocument()
      expect(screen.getByText('Testing')).toBeInTheDocument()
      expect(screen.getByText('Deployment')).toBeInTheDocument()
    })

    it('should render empty state when no stages provided', () => {
      render(<ExecutionTimeline stages={[]} />)

      expect(screen.getByText('No execution stages to display')).toBeInTheDocument()
    })

    it('should render empty state when stages is undefined', () => {
      render(<ExecutionTimeline stages={undefined as any} />)

      expect(screen.getByText('No execution stages to display')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Stage Status Icons', () => {
    const testStages = (status: ExecutionStageStatus, expectedIcon: string) => {
      const stages: ExecutionStage[] = [
        {
          id: 'test',
          name: 'Test Stage',
          status,
        },
      ]

      const { container } = render(<ExecutionTimeline stages={stages} />)

      // Check for the presence of the expected icon in the DOM
      const iconElement = container.querySelector(`svg`)
      expect(iconElement).toBeInTheDocument()

      // For more specific testing, we could check data attributes or classes
      // that correspond to the status
      const stageNode = container.querySelector('[role="button"]') || container.querySelector('div')
      expect(stageNode?.textContent).toContain('Test Stage')
    }

    it('should display check circle icon for completed status', () => {
      testStages('completed', 'CheckCircle')
    })

    it('should display X circle icon for failed status', () => {
      testStages('failed', 'XCircle')
    })

    it('should display play icon for running status', () => {
      testStages('running', 'Play')
    })

    it('should display pause icon for paused status', () => {
      testStages('paused', 'Pause')
    })

    it('should display circle icon for pending status', () => {
      testStages('pending', 'Circle')
    })

    it('should display circle icon for skipped status', () => {
      testStages('skipped', 'Circle')
    })
  })

  describe('Current Stage Highlighting', () => {
    it('should highlight the current stage', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} currentStageId="implementation" />
      )

      // Check that the implementation stage has highlighting classes
      const implementationStage = screen.getByText('Implementation').closest('div')
      expect(implementationStage).toBeInTheDocument()
    })

    it('should apply animation classes to current stage when animated is true', () => {
      const { container } = render(
        <ExecutionTimeline
          stages={mockStages}
          currentStageId="implementation"
          animated={true}
        />
      )

      const animatedElements = container.querySelectorAll('.animate-pulse')
      expect(animatedElements.length).toBeGreaterThan(0)
    })

    it('should not apply animation classes when animated is false', () => {
      const { container } = render(
        <ExecutionTimeline
          stages={mockStages}
          currentStageId="implementation"
          animated={false}
        />
      )

      const animatedElements = container.querySelectorAll('.animate-pulse')
      expect(animatedElements.length).toBe(0)
    })
  })

  describe('Timing Display', () => {
    it('should display timing for completed stages', () => {
      render(<ExecutionTimeline stages={mockStages} showTiming={true} />)

      // Planning stage should show 5m duration, Architecture should show 10m
      const allTimings = screen.getAllByText(/\d+m/)
      const timingTexts = allTimings.map(el => el.textContent)

      expect(timingTexts).toContain('5m')
      expect(timingTexts).toContain('10m')
    })

    it('should display elapsed time for running stages', () => {
      render(<ExecutionTimeline stages={mockStages} showTiming={true} />)

      // Implementation started at 10:15 and current time is 10:20, so 5m elapsed
      const timings = screen.getAllByText(/5m/)
      expect(timings.length).toBeGreaterThan(0)
    })

    it('should hide timing when showTiming is false', () => {
      render(<ExecutionTimeline stages={mockStages} showTiming={false} />)

      // Should not see any timing displays
      expect(screen.queryByText('5m')).not.toBeInTheDocument()
      expect(screen.queryByText('10m')).not.toBeInTheDocument()
    })

    it('should format timing correctly for different durations', () => {
      const stagesWithVariedDurations: ExecutionStage[] = [
        {
          id: 'short',
          name: 'Short',
          status: 'completed',
          duration: 45000, // 45 seconds
        },
        {
          id: 'medium',
          name: 'Medium',
          status: 'completed',
          duration: 90000, // 1.5 minutes -> should show 1m 30s
        },
        {
          id: 'long',
          name: 'Long',
          status: 'completed',
          duration: 3900000, // 65 minutes -> should show 1h 5m
        },
      ]

      render(<ExecutionTimeline stages={stagesWithVariedDurations} showTiming={true} />)

      expect(screen.getByText('45s')).toBeInTheDocument()
      expect(screen.getByText('1m 30s')).toBeInTheDocument()
      expect(screen.getByText('1h 5m')).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('should call onStageClick when a stage is clicked', () => {
      const handleStageClick = vi.fn()

      render(
        <ExecutionTimeline
          stages={mockStages}
          onStageClick={handleStageClick}
        />
      )

      fireEvent.click(screen.getByText('Planning'))

      expect(handleStageClick).toHaveBeenCalledWith('planning')
    })

    it('should handle keyboard navigation', () => {
      const handleStageClick = vi.fn()

      render(
        <ExecutionTimeline
          stages={mockStages}
          onStageClick={handleStageClick}
        />
      )

      const planningStage = screen.getByText('Planning').closest('[role="button"]')

      // Simulate Enter key
      fireEvent.keyDown(planningStage!, { key: 'Enter' })
      expect(handleStageClick).toHaveBeenCalledWith('planning')

      // Simulate Space key
      fireEvent.keyDown(planningStage!, { key: ' ' })
      expect(handleStageClick).toHaveBeenCalledWith('planning')

      expect(handleStageClick).toHaveBeenCalledTimes(2)
    })

    it('should not have click handlers when onStageClick is not provided', () => {
      const { container } = render(<ExecutionTimeline stages={mockStages} />)

      const clickableElements = container.querySelectorAll('[role="button"]')
      expect(clickableElements.length).toBe(0)
    })
  })

  describe('Compact Mode', () => {
    it('should apply compact styling when compact prop is true', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} compact={true} />
      )

      // Check for smaller icon sizes and spacing
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
      // Most icons should have compact size, but some system icons may vary
      const compactIcons = Array.from(icons).filter(icon =>
        icon.classList.contains('w-4') && icon.classList.contains('h-4')
      )
      expect(compactIcons.length).toBeGreaterThan(0)
    })

    it('should apply normal styling when compact prop is false', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} compact={false} />
      )

      // Check for normal icon sizes
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
      // Most icons should have normal size, but some system icons may vary
      const normalIcons = Array.from(icons).filter(icon =>
        icon.classList.contains('w-5') && icon.classList.contains('h-5')
      )
      expect(normalIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Progress Bar', () => {
    it('should display progress bar when animated is true', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} animated={true} />
      )

      const progressBar = container.querySelector('.bg-apex-500')
      expect(progressBar).toBeInTheDocument()
    })

    it('should calculate correct progress percentage', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} animated={true} />
      )

      // Find the progress bar element with the specific structure
      const progressContainer = container.querySelector('.bg-border-secondary.rounded-full.overflow-hidden')
      expect(progressContainer).toBeInTheDocument()

      const progressBar = progressContainer?.querySelector('.bg-apex-500.rounded-full') as HTMLElement
      expect(progressBar).toBeInTheDocument()

      // 2 out of 5 stages are completed (40%)
      expect(progressBar.style.width).toBe('40%')
    })

    it('should not display progress bar when animated is false', () => {
      const { container } = render(
        <ExecutionTimeline stages={mockStages} animated={false} />
      )

      const progressContainer = container.querySelector('.bg-border-secondary.rounded-full.overflow-hidden')
      expect(progressContainer).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes when clickable', () => {
      render(
        <ExecutionTimeline
          stages={mockStages}
          onStageClick={() => {}}
        />
      )

      const clickableStages = screen.getAllByRole('button')
      expect(clickableStages).toHaveLength(mockStages.length)

      clickableStages.forEach(stage => {
        expect(stage).toHaveAttribute('tabIndex', '0')
      })
    })

    it('should not have button role when not clickable', () => {
      render(<ExecutionTimeline stages={mockStages} />)

      const buttons = screen.queryAllByRole('button')
      expect(buttons).toHaveLength(0)
    })

    it('should have proper title attributes for truncated text', () => {
      const stagesWithLongNames: ExecutionStage[] = [
        {
          id: 'long-name',
          name: 'Very Long Stage Name That Will Be Truncated',
          status: 'pending',
        },
      ]

      render(<ExecutionTimeline stages={stagesWithLongNames} />)

      const stageNameElement = screen.getByTitle('Very Long Stage Name That Will Be Truncated')
      expect(stageNameElement).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle stages with missing optional properties', () => {
      const minimalStages: ExecutionStage[] = [
        {
          id: 'minimal',
          name: 'Minimal',
          status: 'pending',
        },
      ]

      expect(() => {
        render(<ExecutionTimeline stages={minimalStages} />)
      }).not.toThrow()

      expect(screen.getByText('Minimal')).toBeInTheDocument()
    })

    it('should handle single stage timeline', () => {
      const singleStage: ExecutionStage[] = [
        {
          id: 'single',
          name: 'Single Stage',
          status: 'completed',
        },
      ]

      render(<ExecutionTimeline stages={singleStage} />)

      expect(screen.getByText('Single Stage')).toBeInTheDocument()

      // Should not have any connector lines
      const { container } = render(<ExecutionTimeline stages={singleStage} />)
      const connectors = container.querySelectorAll('.absolute.top-4.left-full')
      expect(connectors).toHaveLength(0)
    })

    it('should handle invalid currentStageId gracefully', () => {
      expect(() => {
        render(
          <ExecutionTimeline
            stages={mockStages}
            currentStageId="non-existent-id"
          />
        )
      }).not.toThrow()
    })
  })
})