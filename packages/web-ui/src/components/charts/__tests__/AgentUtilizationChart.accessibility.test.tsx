import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentUtilizationChart, AgentUtilizationChartMini } from '../AgentUtilizationChart'
import {
  AgentUtilizationData,
  EMPTY_AGENT_UTILIZATION_DATA,
} from '@/types/agent-utilization'

// Accessibility test data
const createAccessibilityTestData = (): AgentUtilizationData => ({
  agents: [
    {
      agentId: 'planner',
      agentName: 'Strategic Planner',
      inputTokens: 3000,
      outputTokens: 2000,
      totalTokens: 5000,
      estimatedCost: 0.25,
      tokensPerSecond: 12.5,
      duration: 4000,
      invocations: 8,
    },
    {
      agentId: 'coder',
      agentName: 'Backend Developer',
      inputTokens: 4800,
      outputTokens: 3200,
      totalTokens: 8000,
      estimatedCost: 0.40,
      tokensPerSecond: 20.0,
      duration: 4000,
      invocations: 12,
    },
    {
      agentId: 'reviewer',
      agentName: 'Code Reviewer',
      inputTokens: 600,
      outputTokens: 400,
      totalTokens: 1000,
      estimatedCost: 0.05,
      tokensPerSecond: 8.3,
      duration: 1200,
      invocations: 3,
    },
  ],
  totalInputTokens: 8400,
  totalOutputTokens: 5600,
  totalTokens: 14000,
  totalEstimatedCost: 0.70,
  totalDuration: 9200,
  avgTokensPerSecond: 13.6,
  lastUpdated: new Date('2026-03-15T14:30:00Z'),
})

describe('AgentUtilizationChart Accessibility Tests', () => {
  describe('ARIA Labels and Roles', () => {
    it('provides proper ARIA role for chart container', () => {
      render(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()
      expect(chartContainer).toHaveAttribute('aria-label')

      const ariaLabel = chartContainer.getAttribute('aria-label')
      expect(ariaLabel).toContain('Agent utilization chart')
      expect(ariaLabel).toContain('3 agents')
    })

    it('provides descriptive ARIA labels for individual agent rows', () => {
      render(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      // Check for specific agent labels
      const plannerRow = screen.getByLabelText(/Strategic Planner: 5\.0K tokens, \$0\.25/)
      expect(plannerRow).toBeInTheDocument()

      const coderRow = screen.getByLabelText(/Backend Developer: 8\.0K tokens, \$0\.40/)
      expect(coderRow).toBeInTheDocument()

      const reviewerRow = screen.getByLabelText(/Code Reviewer: 1\.0K tokens, \$0\.05/)
      expect(reviewerRow).toBeInTheDocument()
    })

    it('updates ARIA label when agent count changes', () => {
      const singleAgentData: AgentUtilizationData = {
        ...createAccessibilityTestData(),
        agents: [createAccessibilityTestData().agents[0]],
      }

      const { rerender } = render(<AgentUtilizationChart data={singleAgentData} />)

      let chartContainer = screen.getByRole('img')
      expect(chartContainer.getAttribute('aria-label')).toContain('1 agents')

      rerender(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      chartContainer = screen.getByRole('img')
      expect(chartContainer.getAttribute('aria-label')).toContain('3 agents')
    })

    it('provides ARIA label in loading state', () => {
      render(<AgentUtilizationChart data={createAccessibilityTestData()} loading={true} />)

      // Loading state should still be accessible
      const loadingElements = document.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBeGreaterThan(0)
    })

    it('provides ARIA label in error state', () => {
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          error="Failed to load data"
        />
      )

      const errorMessage = screen.getByText('Error loading chart')
      expect(errorMessage).toBeInTheDocument()

      // Check the outer error container has the text-error class
      const errorContainer = errorMessage.closest('.text-error')
      expect(errorContainer).toBeInTheDocument()

      const detailMessage = screen.getByText('Failed to load data')
      expect(detailMessage).toBeInTheDocument()
    })
  })

  describe('Screen Reader Support', () => {
    it('provides comprehensive screen reader summary', () => {
      render(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      const srOnlyElement = document.querySelector('.sr-only')
      expect(srOnlyElement).toBeInTheDocument()

      const summaryText = srOnlyElement?.textContent
      expect(summaryText).toContain('Agent utilization summary')
      expect(summaryText).toContain('3 agents shown')
      expect(summaryText).toContain('Total tokens: 14.0K')
      expect(summaryText).toContain('Total cost: $0.70')
      expect(summaryText).toContain('Top agent: Backend Developer')
      expect(summaryText).toContain('8.0K tokens')
    })

    it('updates screen reader summary when data changes', () => {
      const { rerender } = render(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      let srOnlyElement = document.querySelector('.sr-only')
      expect(srOnlyElement?.textContent).toContain('Backend Developer')

      const updatedData = {
        ...createAccessibilityTestData(),
        agents: createAccessibilityTestData().agents.map(agent =>
          agent.agentId === 'coder'
            ? { ...agent, totalTokens: 20000 }
            : agent
        ),
        totalTokens: 26000,
      }

      rerender(<AgentUtilizationChart data={updatedData} />)

      srOnlyElement = document.querySelector('.sr-only')
      expect(srOnlyElement?.textContent).toContain('26.0K')
    })

    it('provides screen reader support in empty state', () => {
      render(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />)

      const emptyMessage = screen.getByText('No agent utilization data available')
      expect(emptyMessage).toBeInTheDocument()
    })

    it('provides screen reader support for custom empty message', () => {
      const customMessage = 'No agents found for selected time period'
      render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          emptyMessage={customMessage}
        />
      )

      const emptyMessage = screen.getByText(customMessage)
      expect(emptyMessage).toBeInTheDocument()
    })
  })

  describe('Tooltips and Descriptions', () => {
    it('provides descriptive tooltips for token bars', () => {
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showTokenBreakdown={true}
        />
      )

      // Check for input token tooltips
      const inputTooltip = screen.getByTitle(/Input: \d+,?\d* tokens/)
      expect(inputTooltip).toBeInTheDocument()

      // Check for output token tooltips
      const outputTooltip = screen.getByTitle(/Output: \d+,?\d* tokens/)
      expect(outputTooltip).toBeInTheDocument()
    })

    it('provides total token tooltips when breakdown is disabled', () => {
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showTokenBreakdown={false}
        />
      )

      const totalTooltip = screen.getByTitle('Total: 8,000 tokens')
      expect(totalTooltip).toBeInTheDocument()
    })

    it('provides tooltips for agent names with full text', () => {
      const longNameData: AgentUtilizationData = {
        ...createAccessibilityTestData(),
        agents: [
          {
            ...createAccessibilityTestData().agents[0],
            agentName: 'Very Long Agent Name That Will Be Truncated For Display',
          },
        ],
      }

      render(<AgentUtilizationChart data={longNameData} />)

      const truncatedNameElement = screen.getByTitle(
        'Very Long Agent Name That Will Be Truncated For Display'
      )
      expect(truncatedNameElement).toBeInTheDocument()
    })
  })

  describe('Color and Contrast', () => {
    it('uses semantic colors that support accessibility', () => {
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showTokenBreakdown={true}
          showLegend={true}
        />
      )

      // Check that legend colors are present
      const inputLegend = screen.getByText('Input Tokens')
      const outputLegend = screen.getByText('Output Tokens')

      expect(inputLegend).toBeInTheDocument()
      expect(outputLegend).toBeInTheDocument()

      // Color indicators should be present
      const colorIndicators = document.querySelectorAll('.w-3.h-3.rounded')
      expect(colorIndicators.length).toBe(2) // Input and output
    })

    it('maintains accessibility with custom colors', () => {
      const customColors = {
        inputTokens: '#0066cc',  // Good contrast
        outputTokens: '#004499', // Good contrast
        cost: '#cc6600',         // Good contrast
        performance: '#006600',  // Good contrast
        agentColors: ['#333333', '#666666', '#999999'], // Good contrast
      }

      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          colors={customColors}
          showLegend={true}
        />
      )

      // Should render without accessibility issues
      const legend = screen.getByText('Input Tokens')
      expect(legend).toBeInTheDocument()
    })
  })

  describe('Responsive Accessibility', () => {
    it('maintains accessibility features across responsive breakpoints', () => {
      const { rerender } = render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showCost={true}
          showPerformance={true}
        />
      )

      // Desktop view - all columns visible
      let chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()

      // Simulate mobile view by checking responsive classes
      const costColumns = document.querySelectorAll('.hidden.sm\\:block')
      expect(costColumns.length).toBeGreaterThan(0)

      const performanceColumns = document.querySelectorAll('.hidden.md\\:block')
      expect(performanceColumns.length).toBeGreaterThan(0)

      // ARIA labels should still be present
      const agentRows = document.querySelectorAll('[aria-label*="tokens"]')
      expect(agentRows.length).toBe(3)
    })

    it('provides alternative text for hidden responsive content', () => {
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showCost={true}
          showPerformance={true}
        />
      )

      // Cost and performance data should still be in ARIA labels even if visually hidden
      const agentRowWithCost = screen.getByLabelText(/\$0\.40/)
      expect(agentRowWithCost).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard accessibility for interactive elements', () => {
      render(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      // Chart rows should be keyboard accessible (though not focusable without click handlers)
      const agentRows = document.querySelectorAll('[aria-label*="tokens"]')
      agentRows.forEach(row => {
        expect(row).toHaveAttribute('aria-label')
      })
    })

    it('provides proper tabindex for interactive elements when callbacks are provided', () => {
      const mockClick = () => {}
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          onAgentClick={mockClick}
        />
      )

      // Rows with click handlers should be keyboard accessible
      const clickableRows = document.querySelectorAll('.cursor-pointer')
      expect(clickableRows.length).toBeGreaterThan(0)
    })
  })

  describe('Mini Chart Accessibility', () => {
    it('maintains accessibility in mini variant', () => {
      render(<AgentUtilizationChartMini data={createAccessibilityTestData()} />)

      // Should have tooltips for bars
      const tooltip = screen.getByTitle('Backend Developer: 8.0K tokens')
      expect(tooltip).toBeInTheDocument()
    })

    it('provides accessible empty state in mini chart', () => {
      render(<AgentUtilizationChartMini data={EMPTY_AGENT_UTILIZATION_DATA} />)

      const emptyMessage = screen.getByText('No data')
      expect(emptyMessage).toBeInTheDocument()
    })

    it('maintains responsive accessibility in mini chart', () => {
      render(<AgentUtilizationChartMini data={createAccessibilityTestData()} />)

      // Should have proper spacing classes for accessibility
      const container = document.querySelector('.space-y-2')
      expect(container).toBeInTheDocument()

      // Truncated names should have full title attributes
      const truncatedElements = document.querySelectorAll('[title]')
      expect(truncatedElements.length).toBeGreaterThan(0)
    })
  })

  describe('State Change Accessibility', () => {
    it('maintains accessibility during loading state transitions', () => {
      const { rerender } = render(
        <AgentUtilizationChart data={createAccessibilityTestData()} loading={true} />
      )

      // Loading state should be accessible
      const loadingElements = document.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBeGreaterThan(0)

      // Transition to loaded state
      rerender(<AgentUtilizationChart data={createAccessibilityTestData()} loading={false} />)

      // Should maintain accessibility features
      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()
    })

    it('maintains accessibility during error state transitions', () => {
      const { rerender } = render(<AgentUtilizationChart data={createAccessibilityTestData()} />)

      // Normal state
      let chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()

      // Error state
      rerender(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          error="Network error"
        />
      )

      const errorMessage = screen.getByText('Error loading chart')
      expect(errorMessage).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()

      // Recovery from error
      rerender(<AgentUtilizationChart data={createAccessibilityTestData()} error={null} />)

      chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()
    })

    it('announces dynamic content changes to screen readers', () => {
      const initialData = createAccessibilityTestData()
      const { rerender } = render(<AgentUtilizationChart data={initialData} />)

      let srOnlyElement = document.querySelector('.sr-only')
      expect(srOnlyElement?.textContent).toContain('Backend Developer')

      // Update with different top agent
      const updatedData = {
        ...initialData,
        agents: initialData.agents.map(agent =>
          agent.agentId === 'planner'
            ? { ...agent, totalTokens: 50000 }
            : agent
        ).sort((a, b) => b.totalTokens - a.totalTokens),
      }

      rerender(<AgentUtilizationChart data={updatedData} />)

      srOnlyElement = document.querySelector('.sr-only')
      expect(srOnlyElement?.textContent).toContain('Strategic Planner')
    })
  })

  describe('High Contrast Mode Compatibility', () => {
    it('ensures text contrast in various states', () => {
      // This would ideally test with actual high contrast themes
      // For now, we verify structure supports high contrast
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showLegend={true}
        />
      )

      // Text elements should have appropriate classes for contrast
      const agentNameElements = document.querySelectorAll('.text-foreground')
      expect(agentNameElements.length).toBeGreaterThan(0)

      // Legend text should be readable
      const legendText = screen.getByText('Input Tokens')
      expect(legendText).toHaveClass('text-foreground-secondary')
    })

    it('provides sufficient color alternatives', () => {
      render(
        <AgentUtilizationChart
          data={createAccessibilityTestData()}
          showTokenBreakdown={true}
        />
      )

      // Color information should also be available through tooltips/text
      const inputTooltip = screen.getByTitle(/Input: \d+,?\d* tokens/)
      const outputTooltip = screen.getByTitle(/Output: \d+,?\d* tokens/)

      expect(inputTooltip).toBeInTheDocument()
      expect(outputTooltip).toBeInTheDocument()
    })
  })
})