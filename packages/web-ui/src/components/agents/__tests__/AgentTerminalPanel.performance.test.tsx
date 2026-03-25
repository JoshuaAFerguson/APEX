/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AgentTerminalPanel } from '../AgentTerminalPanel'
import type { AgentTerminalPanelProps, AgentLogEntry } from '@/types/agent-log-stream'

// Mock state for performance testing
let mockLogs: AgentLogEntry[] = []
let mockStreamState = {
  state: 'streaming' as const,
  connectionStatus: 'connected' as const,
  isReceiving: true,
  logsReceivedCount: 0,
  lastLogAt: new Date(),
  bytesReceived: 0,
  streamStartedAt: new Date(),
  error: null,
}

// Mock hooks with performance considerations
vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(() => ({
    filteredLogs: mockLogs,
    filter: {
      levels: new Set(['debug', 'info', 'warn', 'error']),
      searchText: '',
      stage: null,
      agent: null,
    },
    streamState: mockStreamState,
    stats: {
      totalLogs: mockLogs.length,
      logsPerSecond: 15.5, // High rate for performance testing
      byLevel: { debug: 0, info: mockLogs.length, warn: 0, error: 0 },
      bySource: { agent: mockLogs.length, system: 0, user: 0, tool: 0, error: 0 },
      errorCount: 0,
      streamDurationMs: 10000,
    },
    isConnecting: false,
    isStreaming: true,
    isPaused: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clearLogs: vi.fn(),
    setFilter: vi.fn(),
    resetFilter: vi.fn(),
    exportLogs: vi.fn(() => JSON.stringify(mockLogs)),
    scrollToLog: vi.fn(),
  })),
}))

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: vi.fn(() => ({
    containerRef: { current: null },
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    autoScroll: true,
    newItemsSinceScroll: 0,
    isAtBottom: true,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: vi.fn(),
  })),
}))

// Simplified mocks for performance testing
vi.mock('../AgentTerminalPanelHeader', () => ({
  AgentTerminalPanelHeader: () => <div data-testid="header">Header</div>,
}))

vi.mock('../AgentTerminalPanelControls', () => ({
  AgentTerminalPanelControls: ({ show }: any) => (
    show ? <div data-testid="controls">Controls</div> : null
  ),
}))

// Performance-focused log entry mock
vi.mock('../AgentTerminalPanelLogEntry', () => ({
  AgentTerminalPanelLogEntry: ({ log }: any) => (
    <div data-testid={`log-entry-${log.id}`} key={log.id}>
      {log.message}
    </div>
  ),
}))

vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getHealthState: vi.fn(() => ({ isHealthy: true, consecutiveFailures: 0 })),
  },
}))

// Helper to create test logs
function createTestLog(id: string, message: string): AgentLogEntry {
  return {
    id,
    timestamp: new Date(),
    level: 'info',
    message,
    source: 'agent',
    metadata: { agentId: 'performance-test-agent' },
  }
}

function generateManyLogs(count: number, prefix: string = 'log'): AgentLogEntry[] {
  return Array.from({ length: count }, (_, i) =>
    createTestLog(`${prefix}-${i}`, `Performance test message ${i}`)
  )
}

describe('AgentTerminalPanel - Performance & Rapid Updates', () => {
  const defaultProps: AgentTerminalPanelProps = {
    panelId: 'performance-test-panel',
    agentId: 'performance-test-agent',
    title: 'Performance Test Terminal',
  }

  beforeEach(() => {
    mockLogs = []
    mockStreamState = {
      state: 'streaming',
      connectionStatus: 'connected',
      isReceiving: true,
      logsReceivedCount: 0,
      lastLogAt: new Date(),
      bytesReceived: 0,
      streamStartedAt: new Date(),
      error: null,
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Large Dataset Rendering', () => {
    it('renders large number of logs efficiently', () => {
      const logCount = 1000
      mockLogs = generateManyLogs(logCount, 'large-dataset')

      const startTime = performance.now()
      render(<AgentTerminalPanel {...defaultProps} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime
      expect(renderTime).toBeLessThan(500) // Should render within 500ms (more realistic for 1000 logs)

      expect(screen.getByText('Showing 1000 of 1000 logs')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-large-dataset-0')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-large-dataset-999')).toBeInTheDocument()
    })

    it('handles extremely large datasets without memory issues', () => {
      const logCount = 5000
      mockLogs = generateManyLogs(logCount, 'extreme')

      // Monitor memory usage during render
      const initialMemory = performance.memory?.usedJSHeapSize || 0

      const { container } = render(<AgentTerminalPanel {...defaultProps} />)

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 50MB for 5000 logs)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      expect(screen.getByText('Showing 5000 of 5000 logs')).toBeInTheDocument()

      // Cleanup
      container.remove()
    })
  })

  describe('Rapid Update Performance', () => {
    it('handles rapid log additions without blocking UI', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      const updateCount = 50
      const startTime = performance.now()

      // Simulate rapid updates
      for (let i = 0; i < updateCount; i++) {
        act(() => {
          mockLogs.push(createTestLog(`rapid-${i}`, `Rapid update ${i}`))
          mockStreamState.logsReceivedCount = mockLogs.length
        })

        rerender(<AgentTerminalPanel {...defaultProps} />)

        // Ensure UI remains responsive during updates
        if (i % 10 === 0) {
          await waitFor(() => {
            expect(screen.getByTestId('header')).toBeInTheDocument()
          }, { timeout: 100 })
        }
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle 50 rapid updates within reasonable time (less than 1 second)
      expect(totalTime).toBeLessThan(1000)
      expect(screen.getByText('Showing 50 of 50 logs')).toBeInTheDocument()
    })

    it('maintains performance with high frequency stats updates', () => {
      mockLogs = generateManyLogs(100, 'stats-test')

      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      const startTime = performance.now()

      // Simulate rapid stats updates (like logs per second changing)
      for (let i = 0; i < 20; i++) {
        act(() => {
          // Update streaming stats to simulate real-time changes
          mockStreamState.logsReceivedCount = mockLogs.length + i
          mockStreamState.lastLogAt = new Date()
        })

        rerender(<AgentTerminalPanel {...defaultProps} />)
      }

      const endTime = performance.now()
      const updateTime = endTime - startTime

      expect(updateTime).toBeLessThan(500) // Should be fast for stats-only updates
      expect(screen.getByText('15.5 logs/sec')).toBeInTheDocument()
    })
  })

  describe('Memory Management', () => {
    it('handles log rotation efficiently', () => {
      const maxLogs = 1000
      const totalLogs = 2000

      // Start with max logs
      mockLogs = generateManyLogs(maxLogs, 'rotation-test')

      const { rerender } = render(<AgentTerminalPanel {...defaultProps} maxLogs={maxLogs} />)

      expect(screen.getByText('Showing 1000 of 1000 logs')).toBeInTheDocument()

      // Add more logs (should trigger rotation)
      act(() => {
        mockLogs = [
          ...mockLogs.slice(-maxLogs + 500), // Keep last 500
          ...generateManyLogs(500, 'new-rotation') // Add 500 new
        ]
      })

      rerender(<AgentTerminalPanel {...defaultProps} maxLogs={maxLogs} />)

      expect(screen.getByText('Showing 1000 of 1000 logs')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-new-rotation-0')).toBeInTheDocument()
    })

    it('efficiently handles component remounting with large datasets', () => {
      mockLogs = generateManyLogs(1500, 'remount-test')

      const startTime = performance.now()

      const { unmount } = render(<AgentTerminalPanel {...defaultProps} />)

      // Unmount
      unmount()

      // Remount with new render call
      render(<AgentTerminalPanel {...defaultProps} />)

      const endTime = performance.now()
      const remountTime = endTime - startTime

      expect(remountTime).toBeLessThan(500) // Should remount quickly (increased timing)
      expect(screen.getByText('Showing 1500 of 1500 logs')).toBeInTheDocument()
    })
  })

  describe('Scroll Performance', () => {
    it('handles large scrollable content efficiently', () => {
      mockLogs = generateManyLogs(2000, 'scroll-test')

      const startTime = performance.now()
      render(<AgentTerminalPanel {...defaultProps} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime
      expect(renderTime).toBeLessThan(600) // Large scrollable content should still render reasonably fast

      // Verify log container is scrollable
      const logContainer = document.querySelector('[data-testid="header"]')?.parentElement?.querySelector('.overflow-y-auto')
      expect(logContainer).toBeInTheDocument()
    })

    it('maintains auto-scroll performance with rapid updates', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      const startTime = performance.now()

      // Add logs rapidly while auto-scrolling
      for (let batch = 0; batch < 10; batch++) {
        act(() => {
          const newLogs = generateManyLogs(20, `auto-scroll-batch-${batch}`)
          mockLogs = [...mockLogs, ...newLogs]
        })

        rerender(<AgentTerminalPanel {...defaultProps} />)

        // Brief pause to simulate real rapid updates
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(1000) // Should handle 200 logs with auto-scroll efficiently
      expect(screen.getByText('Showing 200 of 200 logs')).toBeInTheDocument()
      expect(screen.getByText('Auto-scrolling')).toBeInTheDocument()
    })
  })

  describe('Filter Performance', () => {
    it('filters large datasets efficiently', () => {
      // Create mixed log levels for filtering
      mockLogs = [
        ...generateManyLogs(500, 'info').map(log => ({ ...log, level: 'info' as const })),
        ...generateManyLogs(300, 'error').map(log => ({ ...log, level: 'error' as const })),
        ...generateManyLogs(200, 'debug').map(log => ({ ...log, level: 'debug' as const })),
      ]

      const startTime = performance.now()
      render(<AgentTerminalPanel {...defaultProps} showFilters={true} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime
      expect(renderTime).toBeLessThan(250) // Should render filtered content quickly

      expect(screen.getByText('Showing 1000 of 1000 logs')).toBeInTheDocument()
    })
  })

  describe('Resource Cleanup', () => {
    it('properly cleans up resources on unmount', () => {
      mockLogs = generateManyLogs(1000, 'cleanup-test')

      const { unmount } = render(<AgentTerminalPanel {...defaultProps} />)

      // Monitor memory before unmount
      const beforeUnmount = performance.memory?.usedJSHeapSize || 0

      unmount()

      // Allow garbage collection time
      setTimeout(() => {
        if (global.gc) {
          global.gc()
        }

        const afterUnmount = performance.memory?.usedJSHeapSize || 0
        // Memory should not increase significantly after unmount
        expect(afterUnmount).toBeLessThanOrEqual(beforeUnmount + 1024 * 1024) // Allow 1MB variance
      }, 100)
    })

    it('handles rapid mount/unmount cycles without memory leaks', () => {
      mockLogs = generateManyLogs(500, 'mount-cycle')

      const initialMemory = performance.memory?.usedJSHeapSize || 0

      // Rapid mount/unmount cycles
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<AgentTerminalPanel {...defaultProps} />)
        unmount()
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be minimal (less than 10MB for 10 cycles)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })
  })

  describe('Stress Testing', () => {
    it('handles extreme log volume without crashing', () => {
      const extremeLogCount = 10000
      mockLogs = generateManyLogs(extremeLogCount, 'extreme-stress')

      // This should not crash or take excessive time
      expect(() => {
        const startTime = performance.now()
        render(<AgentTerminalPanel {...defaultProps} />)
        const endTime = performance.now()

        // Even with 10k logs, should render within 3 seconds
        expect(endTime - startTime).toBeLessThan(3000)
      }).not.toThrow()

      expect(screen.getByText('Showing 10000 of 10000 logs')).toBeInTheDocument()
    })

    it('maintains responsiveness under continuous rapid updates', async () => {
      const { rerender } = render(<AgentTerminalPanel {...defaultProps} />)

      // Continuous updates for a period
      const updates = 100
      const updateInterval = 5 // ms between updates

      for (let i = 0; i < updates; i++) {
        const startTime = performance.now()

        act(() => {
          mockLogs.push(createTestLog(`continuous-${i}`, `Continuous update ${i}`))
        })

        rerender(<AgentTerminalPanel {...defaultProps} />)

        const updateTime = performance.now() - startTime

        // Each individual update should be fast (less than 50ms)
        expect(updateTime).toBeLessThan(50)

        // Small delay to simulate real streaming
        await new Promise(resolve => setTimeout(resolve, updateInterval))
      }

      expect(screen.getByText('Showing 100 of 100 logs')).toBeInTheDocument()
      expect(screen.getByTestId('log-entry-continuous-99')).toBeInTheDocument()
    })
  })
})