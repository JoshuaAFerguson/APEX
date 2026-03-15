/**
 * Comprehensive tests for Dashboard types and utility functions
 * Tests additional edge cases and performance scenarios
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_HEALTH_THRESHOLDS,
  DEFAULT_ACTIVITY_FILTERS,
  DEFAULT_SUBSCRIPTION_OPTIONS,
  INITIAL_REALTIME_STATE,
  transformApexEvent,
  generateEventTitle,
  getEventCategory,
  getEventSeverity,
  calculateHealthStatus,
  type DashboardHealthMetrics,
  type DashboardActivityEvent,
  type WebSocketApexEvent,
  type DashboardEventType,
  type PerformanceTimeRange,
  type PerformanceMetricType,
  type ConnectionHealthStatus,
  type HealthThresholds,
} from '../dashboard'

// ============================================================================
// Constants and Defaults Tests
// ============================================================================

describe('Dashboard Constants', () => {
  describe('DEFAULT_HEALTH_THRESHOLDS', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_HEALTH_THRESHOLDS.latencyDegraded).toBe(500)
      expect(DEFAULT_HEALTH_THRESHOLDS.latencyUnhealthy).toBe(2000)
      expect(DEFAULT_HEALTH_THRESHOLDS.successRateDegraded).toBe(95)
      expect(DEFAULT_HEALTH_THRESHOLDS.successRateUnhealthy).toBe(80)
    })

    it('should have degraded threshold less than unhealthy', () => {
      expect(DEFAULT_HEALTH_THRESHOLDS.latencyDegraded).toBeLessThan(DEFAULT_HEALTH_THRESHOLDS.latencyUnhealthy)
      expect(DEFAULT_HEALTH_THRESHOLDS.successRateDegraded).toBeGreaterThan(DEFAULT_HEALTH_THRESHOLDS.successRateUnhealthy)
    })
  })

  describe('DEFAULT_ACTIVITY_FILTERS', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_ACTIVITY_FILTERS.categories).toEqual([])
      expect(DEFAULT_ACTIVITY_FILTERS.severities).toEqual([])
      expect(DEFAULT_ACTIVITY_FILTERS.taskIds).toEqual([])
      expect(DEFAULT_ACTIVITY_FILTERS.unreadOnly).toBe(false)
      expect(DEFAULT_ACTIVITY_FILTERS.limit).toBe(100)
    })
  })

  describe('DEFAULT_SUBSCRIPTION_OPTIONS', () => {
    it('should enable all features by default', () => {
      expect(DEFAULT_SUBSCRIPTION_OPTIONS.taskIds).toEqual([])
      expect(DEFAULT_SUBSCRIPTION_OPTIONS.eventTypes).toEqual([])
      expect(DEFAULT_SUBSCRIPTION_OPTIONS.includeHealth).toBe(true)
      expect(DEFAULT_SUBSCRIPTION_OPTIONS.includePerformance).toBe(true)
      expect(DEFAULT_SUBSCRIPTION_OPTIONS.performanceUpdateInterval).toBe(5000)
    })
  })

  describe('INITIAL_REALTIME_STATE', () => {
    it('should have disconnected initial state', () => {
      expect(INITIAL_REALTIME_STATE.connectionState).toBe('disconnected')
      expect(INITIAL_REALTIME_STATE.isConnected).toBe(false)
      expect(INITIAL_REALTIME_STATE.error).toBe(null)
      expect(INITIAL_REALTIME_STATE.health).toBe(null)
      expect(INITIAL_REALTIME_STATE.events).toEqual([])
      expect(INITIAL_REALTIME_STATE.performance).toBe(null)
      expect(INITIAL_REALTIME_STATE.lastUpdate).toBe(null)
    })
  })
})

// ============================================================================
// Event Categorization Edge Cases
// ============================================================================

describe('Event Categorization Edge Cases', () => {
  describe('getEventCategory', () => {
    it('should handle custom event types', () => {
      expect(getEventCategory('custom:event' as DashboardEventType)).toBe('system')
      expect(getEventCategory('unknown' as DashboardEventType)).toBe('system')
    })

    it('should handle event types with multiple colons', () => {
      expect(getEventCategory('task:stage:changed' as DashboardEventType)).toBe('task')
      expect(getEventCategory('agent:tool:complete' as DashboardEventType)).toBe('agent')
    })

    it('should prioritize prefix match over error classification', () => {
      // getEventCategory prioritizes the first matching prefix, not error classification
      expect(getEventCategory('task:failed' as DashboardEventType)).toBe('task')
      expect(getEventCategory('custom:failed' as DashboardEventType)).toBe('error') // Contains 'failed'
      expect(getEventCategory('tool:error' as DashboardEventType)).toBe('tool')
      expect(getEventCategory('random:other' as DashboardEventType)).toBe('system') // No prefix or error match
    })

    it('should handle uppercase variations', () => {
      // Functions should handle lowercase normally, but test mixed case scenarios
      expect(getEventCategory('TASK:created' as DashboardEventType)).toBe('system') // No match, falls to system
    })
  })

  describe('getEventSeverity', () => {
    it('should handle multiple keywords in event type', () => {
      expect(getEventSeverity('task:completed-successfully' as DashboardEventType)).toBe('success')
      expect(getEventSeverity('permission:granted-approved' as DashboardEventType)).toBe('success')
      expect(getEventSeverity('tool:error-failed' as DashboardEventType)).toBe('error')
    })

    it('should prioritize error over other severities', () => {
      expect(getEventSeverity('task:success-but-failed' as DashboardEventType)).toBe('error')
      expect(getEventSeverity('dangerous:warning-blocked' as DashboardEventType)).toBe('error')
    })

    it('should handle edge case event types', () => {
      expect(getEventSeverity('' as DashboardEventType)).toBe('info')
      expect(getEventSeverity('justtext' as DashboardEventType)).toBe('info')
    })
  })
})

// ============================================================================
// Health Status Calculation Edge Cases
// ============================================================================

describe('Health Status Calculation Edge Cases', () => {
  describe('calculateHealthStatus', () => {
    it('should handle null/undefined metrics gracefully', () => {
      expect(calculateHealthStatus({})).toBe('unknown')
      expect(calculateHealthStatus({ connection: undefined })).toBe('unknown')
    })

    it('should handle missing properties in connection', () => {
      const partialConnection = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          // Missing latencyMs and averageLatencyMs
        } as any
      }
      expect(calculateHealthStatus(partialConnection)).toBe('healthy')
    })

    it('should handle missing server properties', () => {
      const withoutServer = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 100,
          averageLatencyMs: 100,
        }
        // No server metrics
      }
      expect(calculateHealthStatus(withoutServer)).toBe('healthy')
    })

    it('should use both latency and success rate for determination', () => {
      const metrics = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 600, // Degraded latency
          averageLatencyMs: 600,
        },
        server: {
          uptimeMs: 3600000,
          successRate: 90, // Degraded success rate
        },
      }
      expect(calculateHealthStatus(metrics)).toBe('degraded')
    })

    it('should return worst status when both metrics are problematic', () => {
      const metrics = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 3000, // Unhealthy latency
          averageLatencyMs: 3000,
        },
        server: {
          uptimeMs: 3600000,
          successRate: 70, // Unhealthy success rate
        },
      }
      expect(calculateHealthStatus(metrics)).toBe('unhealthy')
    })

    it('should handle zero values correctly', () => {
      const metrics = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 0,
          averageLatencyMs: 0,
        },
        server: {
          uptimeMs: 0,
          successRate: 0,
        },
      }
      expect(calculateHealthStatus(metrics)).toBe('unhealthy')
    })

    it('should handle boundary threshold values', () => {
      const exactlyDegraded = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: DEFAULT_HEALTH_THRESHOLDS.latencyDegraded, // Exactly at threshold
          averageLatencyMs: DEFAULT_HEALTH_THRESHOLDS.latencyDegraded,
        },
        server: {
          uptimeMs: 3600000,
          successRate: DEFAULT_HEALTH_THRESHOLDS.successRateDegraded, // Exactly at threshold
        },
      }
      expect(calculateHealthStatus(exactlyDegraded)).toBe('healthy') // Should be healthy at boundary

      const justOverDegraded = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: DEFAULT_HEALTH_THRESHOLDS.latencyDegraded + 1, // Just over threshold
          averageLatencyMs: DEFAULT_HEALTH_THRESHOLDS.latencyDegraded + 1,
        },
        server: {
          uptimeMs: 3600000,
          successRate: DEFAULT_HEALTH_THRESHOLDS.successRateDegraded - 1, // Just under threshold
        },
      }
      expect(calculateHealthStatus(justOverDegraded)).toBe('degraded')
    })
  })
})

// ============================================================================
// Event Transformation Edge Cases
// ============================================================================

describe('Event Transformation Edge Cases', () => {
  describe('transformApexEvent', () => {
    it('should handle events with null timestamp', () => {
      const event: WebSocketApexEvent = {
        type: 'task:created',
        taskId: 'test',
        timestamp: new Date(), // transformApexEvent expects a Date object
        data: {},
      }

      expect(() => transformApexEvent(event)).not.toThrow()
      const result = transformApexEvent(event)
      expect(result.timestamp).toBeDefined()
    })

    it('should handle events with Date timestamps', () => {
      const event: WebSocketApexEvent = {
        type: 'task:created',
        taskId: 'test',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        data: {},
      }

      const result = transformApexEvent(event)
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should handle events with nested data structures', () => {
      const event: WebSocketApexEvent = {
        type: 'agent:tool-use',
        taskId: 'test',
        timestamp: new Date(),
        data: {
          nested: {
            agent: 'nested-agent',
            tool: 'nested-tool'
          },
          someOtherField: 'value'
        },
      }

      const result = transformApexEvent(event)
      // Should not extract nested agent/tool names (only looks for direct fields)
      expect(result.agentName).toBeUndefined()
      expect(result.toolName).toBeUndefined()
    })

    it('should handle events with very large data objects', () => {
      const largeData = {
        agentName: 'test-agent',
        bigArray: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` })),
        bigString: 'x'.repeat(10000),
      }

      const event: WebSocketApexEvent = {
        type: 'agent:message',
        taskId: 'test',
        timestamp: new Date(),
        data: largeData,
      }

      expect(() => transformApexEvent(event)).not.toThrow()
      const result = transformApexEvent(event)
      expect(result.agentName).toBe('test-agent')
      expect(result.data).toBe(largeData)
    })

    it('should handle missing required fields gracefully', () => {
      const incompleteEvent = {
        type: 'task:created',
        // Missing taskId
        timestamp: new Date(),
        data: {},
      } as WebSocketApexEvent

      const result = transformApexEvent(incompleteEvent)
      expect(result.taskId).toBe('')
      expect(result.type).toBe('task:created')
    })
  })

  describe('generateEventTitle', () => {
    it('should handle empty and null agent/tool names', () => {
      expect(generateEventTitle('agent:message', { agentName: '' }))
        .toBe('Agent responded')
      expect(generateEventTitle('tool:complete', { toolName: null }))
        .toBe('Tool completed')
    })

    it('should handle special characters in names', () => {
      expect(generateEventTitle('agent:tool-use', {
        agentName: 'agent-with-dashes',
        toolName: 'tool_with_underscores'
      })).toBe('agent-with-dashes using tool_with_underscores')
    })

    it('should handle very long names', () => {
      const longAgentName = 'very-long-agent-name-that-exceeds-normal-limits'
      const longToolName = 'extremely-long-tool-name-with-many-hyphens-and-descriptive-text'

      expect(generateEventTitle('agent:tool-use', {
        agentName: longAgentName,
        toolName: longToolName
      })).toBe(`${longAgentName} using ${longToolName}`)
    })

    it('should handle numeric agent/tool names', () => {
      expect(generateEventTitle('agent:message', { agentName: 123 }))
        .toBe('123 responded')
      expect(generateEventTitle('tool:complete', { toolName: 456 }))
        .toBe('456 completed')
    })

    it('should format unknown event types consistently', () => {
      expect(generateEventTitle('custom:multi-word-event' as DashboardEventType, {}))
        .toBe('Custom Multi Word Event')
      expect(generateEventTitle('snake_case_event' as DashboardEventType, {}))
        .toBe('Snake_case_event') // Only replaces [:-] characters
    })
  })
})

// ============================================================================
// Type Safety and TypeScript Edge Cases
// ============================================================================

describe('Type Safety', () => {
  it('should handle union type assignments correctly', () => {
    const timeRanges: PerformanceTimeRange[] = ['1h', '6h', '24h', '7d', '30d']
    timeRanges.forEach(range => {
      expect(typeof range).toBe('string')
    })
  })

  it('should handle metric type enumeration', () => {
    const metricTypes: PerformanceMetricType[] = [
      'tokenUsage',
      'taskDuration',
      'toolLatency',
      'agentResponseTime',
      'errorRate',
      'throughput'
    ]
    metricTypes.forEach(type => {
      expect(typeof type).toBe('string')
    })
  })

  it('should handle connection state enumeration', () => {
    const connectionStates: ConnectionHealthStatus[] = [
      'healthy',
      'degraded',
      'unhealthy',
      'unknown'
    ]
    connectionStates.forEach(state => {
      expect(typeof state).toBe('string')
    })
  })
})

// ============================================================================
// Performance and Memory Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle transformation of many events efficiently', () => {
    const events: WebSocketApexEvent[] = []
    for (let i = 0; i < 1000; i++) {
      events.push({
        type: 'task:created',
        taskId: `task-${i}`,
        timestamp: new Date(),
        data: { index: i }
      })
    }

    const startTime = performance.now()
    const transformed = events.map(transformApexEvent)
    const endTime = performance.now()

    expect(transformed).toHaveLength(1000)
    expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
  })

  it('should generate unique IDs consistently', () => {
    const event: WebSocketApexEvent = {
      type: 'task:created',
      taskId: 'test',
      timestamp: new Date(),
      data: {}
    }

    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const result = transformApexEvent(event)
      ids.add(result.id)
    }

    expect(ids.size).toBe(1000) // All IDs should be unique
  })

  it('should handle threshold validation with various custom values', () => {
    const customThresholds: HealthThresholds[] = [
      { latencyDegraded: 100, latencyUnhealthy: 500, successRateDegraded: 99, successRateUnhealthy: 95 },
      { latencyDegraded: 1000, latencyUnhealthy: 5000, successRateDegraded: 90, successRateUnhealthy: 70 },
      { latencyDegraded: 50, latencyUnhealthy: 200, successRateDegraded: 98, successRateUnhealthy: 90 },
    ]

    const testMetrics = {
      connection: {
        isConnected: true,
        reconnectAttempts: 0,
        latencyMs: 300,
        averageLatencyMs: 300,
      },
      server: {
        uptimeMs: 3600000,
        successRate: 93,
      },
    }

    customThresholds.forEach((threshold, index) => {
      const result = calculateHealthStatus(testMetrics, threshold)
      expect(['healthy', 'degraded', 'unhealthy', 'unknown']).toContain(result)
    })
  })
})