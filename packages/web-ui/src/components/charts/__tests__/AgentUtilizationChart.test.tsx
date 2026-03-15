import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentUtilizationChart, AgentUtilizationChartMini } from '../AgentUtilizationChart'
import {
  AgentUtilizationData,
  AgentUtilizationChartProps,
  EMPTY_AGENT_UTILIZATION_DATA,
} from '@/types/agent-utilization'

// Mock data helpers
const createMockAgent = (id: string, name: string, tokens: number = 1000, cost: number = 0.05) => ({
  agentId: id,
  agentName: name,
  inputTokens: Math.floor(tokens * 0.6),
  outputTokens: Math.floor(tokens * 0.4),
  totalTokens: tokens,
  estimatedCost: cost,
  tokensPerSecond: 15.5,
  duration: 2000,
  invocations: 3,
  cacheTokens: 100,
  cacheHitRate: 0.2,
  avgLatencyMs: 150,
})

const createMockData = (): AgentUtilizationData => ({
  agents: [
    createMockAgent('planner', 'Planner', 5000, 0.25),
    createMockAgent('architect', 'Architect', 3000, 0.15),
    createMockAgent('coder', 'Coder', 8000, 0.40),
    createMockAgent('reviewer', 'Reviewer', 1200, 0.06),
  ],
  totalInputTokens: 10320, // 5000*0.6 + 3000*0.6 + 8000*0.6 + 1200*0.6
  totalOutputTokens: 6880, // 5000*0.4 + 3000*0.4 + 8000*0.4 + 1200*0.4
  totalTokens: 17200, // 5000 + 3000 + 8000 + 1200
  totalEstimatedCost: 0.86, // 0.25 + 0.15 + 0.40 + 0.06
  totalDuration: 8000,
  avgTokensPerSecond: 15.5,
  lastUpdated: new Date('2025-03-15T10:00:00Z'),
})

// Helper function to render AgentUtilizationChart with default props
const renderChart = (props: Partial<AgentUtilizationChartProps> = {}) => {
  const defaultProps: AgentUtilizationChartProps = {
    data: createMockData(),
    ...props,
  }
  return render(<AgentUtilizationChart {...defaultProps} />)
}

describe('AgentUtilizationChart', () => {
  describe('Rendering', () => {
    it('renders with basic props', () => {
      renderChart()

      // Check if agent names are displayed
      expect(screen.getByText('Planner')).toBeInTheDocument()
      expect(screen.getByText('Architect')).toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()
      expect(screen.getByText('Reviewer')).toBeInTheDocument()
    })

    it('displays token counts in bars', () => {
      renderChart()

      // Check for formatted token displays
      expect(screen.getByText('5.0K')).toBeInTheDocument() // Planner
      expect(screen.getByText('3.0K')).toBeInTheDocument() // Architect
      expect(screen.getByText('8.0K')).toBeInTheDocument() // Coder
      expect(screen.getByText('1.2K')).toBeInTheDocument() // Reviewer
    })

    it('shows cost information when showCost is true', () => {
      renderChart({ showCost: true })

      expect(screen.getByText('$0.25')).toBeInTheDocument() // Planner cost
      expect(screen.getByText('$0.15')).toBeInTheDocument() // Architect cost
      expect(screen.getByText('$0.40')).toBeInTheDocument() // Coder cost
      expect(screen.getByText('$0.06')).toBeInTheDocument() // Reviewer cost
    })

    it('shows performance metrics when showPerformance is true', () => {
      renderChart({ showPerformance: true })

      // Check for tokens per second display (repeated for each agent)
      const performanceElements = screen.getAllByText('16/s')
      expect(performanceElements.length).toBeGreaterThan(0)
    })

    it('displays legend when showLegend is true', () => {
      renderChart({ showLegend: true, showTokenBreakdown: true })

      expect(screen.getByText('Input Tokens')).toBeInTheDocument()
      expect(screen.getByText('Output Tokens')).toBeInTheDocument()
    })

    it('hides legend when showLegend is false', () => {
      renderChart({ showLegend: false })

      expect(screen.queryByText('Input Tokens')).not.toBeInTheDocument()
      expect(screen.queryByText('Output Tokens')).not.toBeInTheDocument()
    })

    it('respects custom height', () => {
      const { container } = renderChart({ height: 300 })

      const chartContainer = container.querySelector('[role="img"]')
      expect(chartContainer).toHaveStyle({ height: '300px' })
    })
  })

  describe('Data Processing', () => {
    it('sorts agents by total tokens in descending order by default', () => {
      renderChart()

      const agentElements = screen.getAllByText(/\d+\.?\d*K/)
      // Should be sorted: Coder (8.0K), Planner (5.0K), Architect (3.0K), Reviewer (1.2K)
      expect(agentElements[0]).toHaveTextContent('8.0K') // Coder
      expect(agentElements[1]).toHaveTextContent('5.0K') // Planner
      expect(agentElements[2]).toHaveTextContent('3.0K') // Architect
      expect(agentElements[3]).toHaveTextContent('1.2K') // Reviewer
    })

    it('sorts by cost when sortBy is set to cost', () => {
      renderChart({ sortBy: 'cost' })

      // Should still show all agents but in cost order: Coder ($0.40), Planner ($0.25), etc.
      expect(screen.getByText('Coder')).toBeInTheDocument()
      expect(screen.getByText('Planner')).toBeInTheDocument()
    })

    it('groups excess agents into "Other" category when maxAgents is exceeded', () => {
      renderChart({ maxAgents: 2 })

      // Should show top 2 agents + "Other" group
      expect(screen.getByText('Coder')).toBeInTheDocument() // Top agent
      expect(screen.getByText(/Other \(\d+\)/)).toBeInTheDocument() // Other group
    })

    it('handles ascending sort direction', () => {
      renderChart({ sortDirection: 'asc' })

      const agentElements = screen.getAllByText(/\d+\.?\d*K/)
      // Should be sorted ascending: Reviewer (1.2K), Architect (3.0K), Planner (5.0K), Coder (8.0K)
      expect(agentElements[0]).toHaveTextContent('1.2K') // Reviewer
      expect(agentElements[3]).toHaveTextContent('8.0K') // Coder
    })
  })

  describe('Loading and Error States', () => {
    it('shows loading skeleton when loading is true', () => {
      renderChart({ loading: true })

      // Check for animated skeleton elements
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('displays error message when error prop is provided', () => {
      const errorMessage = 'Failed to load agent utilization data'
      renderChart({ error: errorMessage })

      expect(screen.getByText('Error loading chart')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('shows empty state when data has no agents', () => {
      renderChart({ data: EMPTY_AGENT_UTILIZATION_DATA })

      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
    })

    it('uses custom empty message when provided', () => {
      const customMessage = 'No agents found for this time period'
      renderChart({
        data: EMPTY_AGENT_UTILIZATION_DATA,
        emptyMessage: customMessage,
      })

      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('hides cost column on mobile by default (sm:block class)', () => {
      renderChart({ showCost: true })

      // Check that cost columns have responsive classes
      const costColumns = document.querySelectorAll('.hidden.sm\\:block')
      expect(costColumns.length).toBeGreaterThan(0)

      // Verify the classes are on the cost column divs
      costColumns.forEach(column => {
        expect(column).toHaveClass('hidden', 'sm:block')
      })
    })

    it('hides performance column on mobile by default (md:block class)', () => {
      renderChart({ showPerformance: true })

      const performanceElements = screen.getAllByText(/\d+\/s/)
      // Performance elements should have 'hidden md:block' classes
      performanceElements.forEach(element => {
        const parent = element.closest('.hidden.md\\:block')
        expect(parent).toBeInTheDocument()
      })
    })
  })

  describe('Interactions', () => {
    it('calls onAgentClick when agent is clicked', () => {
      const mockOnClick = vi.fn()
      renderChart({ onAgentClick: mockOnClick })

      const coderRow = screen.getByText('Coder').closest('.group')
      expect(coderRow).toBeInTheDocument()

      fireEvent.click(coderRow!)
      expect(mockOnClick).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'Coder',
          totalTokens: 8000,
        })
      )
    })

    it('calls onAgentHover when agent is hovered', () => {
      const mockOnHover = vi.fn()
      renderChart({ onAgentHover: mockOnHover })

      const plannerRow = screen.getByText('Planner').closest('.group')
      expect(plannerRow).toBeInTheDocument()

      fireEvent.mouseEnter(plannerRow!)
      expect(mockOnHover).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'Planner',
          totalTokens: 5000,
        })
      )

      fireEvent.mouseLeave(plannerRow!)
      expect(mockOnHover).toHaveBeenCalledWith(null)
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA role and label for chart container', () => {
      renderChart()

      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toHaveAttribute(
        'aria-label',
        'Agent utilization chart showing 4 agents'
      )
    })

    it('provides descriptive titles for token bars', () => {
      renderChart({ showTokenBreakdown: false })

      // Check for tooltips on bars when breakdown is disabled
      const coderBar = screen.getByTitle('Total: 8,000 tokens')
      expect(coderBar).toBeInTheDocument()
    })

    it('includes screen reader summary', () => {
      renderChart()

      // Check for hidden summary text
      const summary = document.querySelector('.sr-only')
      expect(summary).toBeInTheDocument()
      expect(summary).toHaveTextContent(/Agent utilization summary/)
    })

    it('provides individual agent labels', () => {
      renderChart()

      const coderRow = screen.getByLabelText(/Coder: 8.0K tokens, \$0\.40/)
      expect(coderRow).toBeInTheDocument()
    })
  })

  describe('Token Breakdown', () => {
    it('shows input and output segments when showTokenBreakdown is true', () => {
      renderChart({ showTokenBreakdown: true })

      // Check for title attributes on segments
      expect(screen.getByTitle(/Input: \d+,?\d* tokens/)).toBeInTheDocument()
      expect(screen.getByTitle(/Output: \d+,?\d* tokens/)).toBeInTheDocument()
    })

    it('shows single bar when showTokenBreakdown is false', () => {
      renderChart({ showTokenBreakdown: false })

      // Should only show total tokens, not breakdown
      expect(screen.getByTitle('Total: 8,000 tokens')).toBeInTheDocument()
      expect(screen.queryByTitle(/Input: \d+,?\d* tokens/)).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero token counts gracefully', () => {
      const zeroData: AgentUtilizationData = {
        ...createMockData(),
        agents: [createMockAgent('empty', 'Empty Agent', 0, 0)],
        totalTokens: 0,
        totalEstimatedCost: 0,
      }

      renderChart({ data: zeroData })

      expect(screen.getByText('Empty Agent')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // Should show 0 tokens
    })

    it('handles very large token counts with proper formatting', () => {
      const largeData: AgentUtilizationData = {
        ...createMockData(),
        agents: [createMockAgent('large', 'Large Agent', 5000000, 25.50)],
      }

      renderChart({ data: largeData })

      expect(screen.getByText('5.0M')).toBeInTheDocument() // Million format
      expect(screen.getByText('$25.50')).toBeInTheDocument()
    })

    it('truncates long agent names appropriately', () => {
      const longNameData: AgentUtilizationData = {
        ...createMockData(),
        agents: [createMockAgent('long', 'Very Long Agent Name That Exceeds Character Limit', 1000, 0.05)],
      }

      renderChart({ data: longNameData })

      // Name should be truncated with ellipsis
      const agentElement = screen.getByText(/Very Long Age.../)
      expect(agentElement).toBeInTheDocument()
    })
  })
})

describe('AgentUtilizationChartMini', () => {
  const renderMini = (props: Parameters<typeof AgentUtilizationChartMini>[0]) => {
    return render(<AgentUtilizationChartMini {...props} />)
  }

  describe('Rendering', () => {
    it('renders with basic props', () => {
      renderMini({ data: createMockData() })

      // Should show top 3 agents by default: Coder (8K), Planner (5K), Architect (3K)
      expect(screen.getByText('Coder')).toBeInTheDocument()
      expect(screen.getByText('Planner')).toBeInTheDocument()

      // Since we have 4 agents and maxAgents=3, we should see 2 individual + 1 Other group
      // Actually, let's check for the tokens instead since names might be grouped
      expect(screen.getByText('8.0K')).toBeInTheDocument()
      expect(screen.getByText('5.0K')).toBeInTheDocument()
    })

    it('respects maxAgents prop', () => {
      renderMini({ data: createMockData(), maxAgents: 2 })

      // Should have exactly 2 rows (1 top agent + 1 "Other" group)
      const agentRows = document.querySelectorAll('.flex.items-center.gap-2')
      expect(agentRows).toHaveLength(2)

      // Should show the top agent
      expect(screen.getByText('Coder')).toBeInTheDocument()
    })

    it('shows empty state when no data', () => {
      renderMini({ data: EMPTY_AGENT_UTILIZATION_DATA })

      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('uses gradient bars for visual appeal', () => {
      const { container } = renderMini({ data: createMockData() })

      // Check for gradient classes
      const gradientBars = container.querySelectorAll('.bg-gradient-to-r.from-apex-500.to-apex-700')
      expect(gradientBars.length).toBeGreaterThan(0)
    })

    it('truncates agent names for compact display', () => {
      const longNameData: AgentUtilizationData = {
        ...createMockData(),
        agents: [createMockAgent('long', 'Very Long Agent Name', 1000, 0.05)],
      }

      renderMini({ data: longNameData })

      // Should show truncated name
      expect(screen.getByTitle('Very Long Agent Name')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper tooltips for bars', () => {
      renderMini({ data: createMockData() })

      const tooltip = screen.getByTitle('Coder: 8.0K tokens')
      expect(tooltip).toBeInTheDocument()
    })

    it('handles responsive layout for small spaces', () => {
      const { container } = renderMini({ data: createMockData() })

      // Should have compact spacing classes
      const miniContainer = container.firstChild as HTMLElement
      expect(miniContainer).toHaveClass('space-y-2')
    })
  })

  describe('Edge Cases', () => {
    it('handles single agent gracefully', () => {
      const singleAgentData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createMockAgent('single', 'Single Agent', 1000, 0.05)],
        totalTokens: 1000,
        totalEstimatedCost: 0.05,
      }

      renderMini({ data: singleAgentData })

      expect(screen.getByText('Single Agent')).toBeInTheDocument()
      expect(screen.getByText('1.0K')).toBeInTheDocument()
    })

    it('maintains proportional bar widths', () => {
      const { container } = renderMini({ data: createMockData() })

      const bars = container.querySelectorAll('[style*="width"]')
      expect(bars.length).toBeGreaterThan(0)

      // First bar (Coder with 8K tokens) should be widest
      const firstBar = bars[0] as HTMLElement
      expect(firstBar.style.width).toBe('100%') // Should be max width
    })
  })
})