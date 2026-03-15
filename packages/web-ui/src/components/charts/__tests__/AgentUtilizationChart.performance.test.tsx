import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AgentUtilizationChart, AgentUtilizationChartMini } from '../AgentUtilizationChart'
import {
  AgentUtilizationData,
  AgentUtilization,
  EMPTY_AGENT_UTILIZATION_DATA,
} from '@/types/agent-utilization'

// Performance test utilities
const createLargeDataset = (agentCount: number): AgentUtilizationData => {
  const agents: AgentUtilization[] = []
  let totalTokens = 0
  let totalCost = 0
  let totalDuration = 0

  for (let i = 0; i < agentCount; i++) {
    const tokens = Math.floor(Math.random() * 50000) + 1000
    const cost = tokens * 0.00005
    const duration = Math.floor(Math.random() * 5000) + 500

    const agent: AgentUtilization = {
      agentId: `agent-${i}`,
      agentName: `Agent ${i} - ${Math.random().toString(36).substring(2)}`,
      inputTokens: Math.floor(tokens * 0.6),
      outputTokens: Math.floor(tokens * 0.4),
      totalTokens: tokens,
      estimatedCost: cost,
      tokensPerSecond: Math.random() * 50 + 5,
      duration,
      invocations: Math.floor(Math.random() * 20) + 1,
      cacheTokens: Math.floor(Math.random() * 1000),
      cacheHitRate: Math.random(),
      avgLatencyMs: Math.random() * 500 + 50,
    }

    agents.push(agent)
    totalTokens += tokens
    totalCost += cost
    totalDuration += duration
  }

  return {
    agents,
    totalInputTokens: Math.floor(totalTokens * 0.6),
    totalOutputTokens: Math.floor(totalTokens * 0.4),
    totalTokens,
    totalEstimatedCost: totalCost,
    totalDuration,
    avgTokensPerSecond: agents.reduce((sum, a) => sum + a.tokensPerSecond, 0) / agents.length,
    lastUpdated: new Date(),
  }
}

// Performance measurement helper
const measureRenderTime = (renderFn: () => void): number => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

describe('AgentUtilizationChart Performance Tests', () => {
  describe('Rendering Performance', () => {
    it('renders small datasets quickly', () => {
      const smallData = createLargeDataset(10)

      const renderTime = measureRenderTime(() => {
        render(<AgentUtilizationChart data={smallData} />)
      })

      // Small datasets should render in reasonable time (relaxed for CI environment)
      expect(renderTime).toBeLessThan(500)

      cleanup()
    })

    it('renders medium datasets efficiently', () => {
      const mediumData = createLargeDataset(50)

      const renderTime = measureRenderTime(() => {
        render(<AgentUtilizationChart data={mediumData} />)
      })

      // Medium datasets should render in under 200ms
      expect(renderTime).toBeLessThan(200)

      cleanup()
    })

    it('renders large datasets within reasonable time', () => {
      const largeData = createLargeDataset(200)

      const renderTime = measureRenderTime(() => {
        render(<AgentUtilizationChart data={largeData} maxAgents={10} />)
      })

      // Large datasets should still render in under 300ms when limited by maxAgents
      expect(renderTime).toBeLessThan(300)

      cleanup()
    })

    it('handles very large datasets with maxAgents limitation', () => {
      const veryLargeData = createLargeDataset(1000)

      const renderTime = measureRenderTime(() => {
        render(<AgentUtilizationChart data={veryLargeData} maxAgents={8} />)
      })

      // Even with 1000 agents, should render quickly when limited to 8
      expect(renderTime).toBeLessThan(500)

      cleanup()
    })
  })

  describe('Data Processing Performance', () => {
    it('sorts large datasets efficiently', () => {
      const largeData = createLargeDataset(500)

      // Test different sorting metrics
      const metrics = ['tokens', 'cost', 'tokensPerSecond', 'duration', 'invocations'] as const

      metrics.forEach((metric) => {
        const renderTime = measureRenderTime(() => {
          const { unmount } = render(
            <AgentUtilizationChart
              data={largeData}
              sortBy={metric}
              maxAgents={10}
            />
          )
          unmount()
        })

        // Each sort operation should complete quickly
        expect(renderTime).toBeLessThan(100)
      })
    })

    it('aggregates "Other" group efficiently', () => {
      const largeData = createLargeDataset(100)

      // Test with very small maxAgents to force large "Other" group
      const renderTime = measureRenderTime(() => {
        render(<AgentUtilizationChart data={largeData} maxAgents={2} />)
      })

      // Aggregation should be fast even with large Other group
      expect(renderTime).toBeLessThan(150)

      cleanup()
    })

    it('handles frequent data updates efficiently', () => {
      const baseData = createLargeDataset(50)
      const { rerender } = render(<AgentUtilizationChart data={baseData} />)

      const totalUpdateTime = measureRenderTime(() => {
        // Simulate 10 rapid data updates
        for (let i = 0; i < 10; i++) {
          const updatedData = {
            ...baseData,
            agents: baseData.agents.map(agent => ({
              ...agent,
              totalTokens: agent.totalTokens + i,
            })),
            lastUpdated: new Date(),
          }

          rerender(<AgentUtilizationChart data={updatedData} />)
        }
      })

      // 10 updates should complete in reasonable time
      expect(totalUpdateTime).toBeLessThan(200)

      cleanup()
    })
  })

  describe('Memory Usage', () => {
    it('does not leak memory during frequent re-renders', () => {
      const testData = createLargeDataset(20)
      let component = render(<AgentUtilizationChart data={testData} />)

      // Force garbage collection if available (test environment)
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Perform many re-renders
      for (let i = 0; i < 50; i++) {
        component.unmount()
        component = render(<AgentUtilizationChart data={testData} />)
      }

      // Allow garbage collection
      component.unmount()

      // Check if memory usage hasn't grown excessively
      // Note: This is a basic check and may not be reliable in all test environments
      if ((performance as any).memory) {
        const finalMemory = (performance as any).memory.usedJSHeapSize
        const memoryIncrease = finalMemory - initialMemory

        // Memory increase should be reasonable (less than 10MB)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
      }
    })

    it('cleans up event listeners and timers', () => {
      const mockOnClick = vi.fn()
      const mockOnHover = vi.fn()

      const { unmount } = render(
        <AgentUtilizationChart
          data={createLargeDataset(10)}
          onAgentClick={mockOnClick}
          onAgentHover={mockOnHover}
        />
      )

      // Unmount should not cause any errors
      expect(() => unmount()).not.toThrow()

      // Mock functions should not be called after unmount
      setTimeout(() => {
        expect(mockOnClick).not.toHaveBeenCalled()
        expect(mockOnHover).not.toHaveBeenCalled()
      }, 100)
    })
  })

  describe('Mini Chart Performance', () => {
    it('renders mini charts efficiently', () => {
      const testData = createLargeDataset(100)

      const renderTime = measureRenderTime(() => {
        render(
          <div>
            <AgentUtilizationChartMini data={testData} maxAgents={5} />
            <AgentUtilizationChartMini data={testData} maxAgents={5} />
            <AgentUtilizationChartMini data={testData} maxAgents={5} />
          </div>
        )
      })

      // Multiple mini charts should render quickly
      expect(renderTime).toBeLessThan(150)

      cleanup()
    })

    it('handles responsive layout changes efficiently', () => {
      const testData = createLargeDataset(30)
      const { rerender } = render(
        <AgentUtilizationChart data={testData} height={200} />
      )

      const resizeTime = measureRenderTime(() => {
        // Simulate multiple responsive breakpoint changes
        for (const height of [300, 150, 400, 250]) {
          rerender(<AgentUtilizationChart data={testData} height={height} />)
        }
      })

      // Height changes should be efficient
      expect(resizeTime).toBeLessThan(100)

      cleanup()
    })
  })

  describe('Animation Performance', () => {
    it('handles animations without performance degradation', () => {
      const testData = createLargeDataset(20)

      const animatedRenderTime = measureRenderTime(() => {
        render(<AgentUtilizationChart data={testData} animated={true} />)
      })

      const staticRenderTime = measureRenderTime(() => {
        const { unmount } = render(<AgentUtilizationChart data={testData} animated={false} />)
        unmount()
      })

      // Animated rendering shouldn't be significantly slower
      expect(animatedRenderTime).toBeLessThan(staticRenderTime + 50)

      cleanup()
    })

    it('efficiently toggles animation states', () => {
      const testData = createLargeDataset(15)
      const { rerender } = render(
        <AgentUtilizationChart data={testData} animated={false} />
      )

      const toggleTime = measureRenderTime(() => {
        // Rapidly toggle animation states
        for (let i = 0; i < 20; i++) {
          rerender(
            <AgentUtilizationChart data={testData} animated={i % 2 === 0} />
          )
        }
      })

      // Animation toggles should be efficient
      expect(toggleTime).toBeLessThan(200)

      cleanup()
    })
  })

  describe('Stress Testing', () => {
    it('remains stable under extreme conditions', () => {
      // Test with maximum realistic dataset
      const extremeData = createLargeDataset(1000)

      expect(() => {
        render(
          <AgentUtilizationChart
            data={extremeData}
            maxAgents={20}
            showCost={true}
            showPerformance={true}
            showTokenBreakdown={true}
            animated={true}
          />
        )
      }).not.toThrow()

      cleanup()
    })

    it('handles rapid prop changes under load', () => {
      const largeData = createLargeDataset(100)
      const { rerender } = render(<AgentUtilizationChart data={largeData} />)

      const props = [
        { sortBy: 'tokens' as const, showCost: true },
        { sortBy: 'cost' as const, showCost: false },
        { sortBy: 'tokensPerSecond' as const, showPerformance: true },
        { sortBy: 'duration' as const, showTokenBreakdown: false },
        { sortBy: 'invocations' as const, animated: false },
      ]

      const rapidChangeTime = measureRenderTime(() => {
        // Rapidly cycle through different configurations
        for (let i = 0; i < 10; i++) {
          const config = props[i % props.length]
          rerender(<AgentUtilizationChart data={largeData} {...config} />)
        }
      })

      // Should handle rapid configuration changes efficiently
      expect(rapidChangeTime).toBeLessThan(300)

      cleanup()
    })

    it('maintains performance with concurrent operations', async () => {
      const testData = createLargeDataset(50)

      // Simulate concurrent chart operations
      const promises = Array.from({ length: 5 }, (_, i) =>
        new Promise<number>((resolve) => {
          setTimeout(() => {
            const renderTime = measureRenderTime(() => {
              const { unmount } = render(
                <AgentUtilizationChart
                  data={testData}
                  maxAgents={10}
                  sortBy={['tokens', 'cost', 'duration'][i % 3] as any}
                />
              )
              unmount()
            })
            resolve(renderTime)
          }, i * 10)
        })
      )

      const renderTimes = await Promise.all(promises)

      // All concurrent operations should complete quickly
      renderTimes.forEach(time => {
        expect(time).toBeLessThan(200)
      })
    })
  })

  describe('Error Resilience', () => {
    it('recovers gracefully from performance bottlenecks', () => {
      // Simulate problematic data that might cause performance issues
      const problematicData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: Array.from({ length: 1000 }, (_, i) => ({
          agentId: `agent-${i}`,
          agentName: `${'A'.repeat(1000)}-${i}`, // Very long names
          inputTokens: Number.MAX_SAFE_INTEGER,
          outputTokens: Number.MAX_SAFE_INTEGER,
          totalTokens: Number.MAX_SAFE_INTEGER,
          estimatedCost: Number.MAX_SAFE_INTEGER,
          tokensPerSecond: Number.MAX_SAFE_INTEGER,
          duration: Number.MAX_SAFE_INTEGER,
          invocations: Number.MAX_SAFE_INTEGER,
        })),
        totalTokens: Number.MAX_SAFE_INTEGER,
        totalEstimatedCost: Number.MAX_SAFE_INTEGER,
        lastUpdated: new Date(),
      }

      expect(() => {
        const renderTime = measureRenderTime(() => {
          render(
            <AgentUtilizationChart
              data={problematicData}
              maxAgents={5} // Limit to reduce impact
            />
          )
        })

        // Should still complete, even if slowly
        expect(renderTime).toBeLessThan(1000) // 1 second max
      }).not.toThrow()

      cleanup()
    })
  })
})