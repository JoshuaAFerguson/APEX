/**
 * Comprehensive tests for ApprovalGatePanel validation functions and edge cases
 * Tests validation functions, strict type guards, and edge cases not covered in main tests
 */

import { describe, it, expect } from 'vitest'
import type { Gate, GateStatus } from '@apexcli/core'
import {
  isPendingGateStrict,
  validateFilterState,
  validateSortState,
  validateGateType,
  validateResourceImpact,
  validateGatePriority,
  isGateApprovedEvent,
  isGateRejectedEvent,
  isGateTimeoutEvent,
  isGateSkippedEvent,
  isApprovalResolvedEvent,
  type PendingApprovalGate,
  type FilterState,
  type SortState,
  type ApprovalGateWebSocketEvent,
  type GateApprovedEvent,
  type GateRejectedEvent,
  type GateTimeoutEvent,
  type GateSkippedEvent,
  type ApprovalResolvedEvent,
} from '../approval-gate-panel'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockGate = (status: GateStatus, overrides: Partial<Gate> = {}): Gate => ({
  id: 'test-gate-1',
  name: 'Test Gate',
  status,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  taskId: 'task-123',
  ...overrides,
})

const createMockWSEvent = <T extends ApprovalGateWebSocketEvent>(
  type: T['type'],
  data: T['data']
): T => ({
  type,
  taskId: 'task-123',
  timestamp: new Date('2024-01-01T10:00:00Z'),
  eventId: 'event-123',
  data,
}) as T

// ============================================================================
// Strict Type Guard Tests
// ============================================================================

describe('Strict Type Guards', () => {
  describe('isPendingGateStrict', () => {
    it('should return true for valid pending gates with all required fields', () => {
      const gate = {
        ...createMockGate('pending'),
        resourceImpact: 'high',
        gateType: 'dangerous-operation',
      } as PendingApprovalGate

      expect(isPendingGateStrict(gate)).toBe(true)
    })

    it('should return false for pending gates without resourceImpact', () => {
      const gate = {
        ...createMockGate('pending'),
        gateType: 'dangerous-operation',
        // resourceImpact is undefined
      }

      expect(isPendingGateStrict(gate)).toBe(false)
    })

    it('should return false for pending gates without gateType', () => {
      const gate = {
        ...createMockGate('pending'),
        resourceImpact: 'high',
        // gateType is undefined
      }

      expect(isPendingGateStrict(gate)).toBe(false)
    })

    it('should return false for pending gates with invalid resourceImpact', () => {
      const gate = {
        ...createMockGate('pending'),
        resourceImpact: 'invalid-impact',
        gateType: 'dangerous-operation',
      }

      expect(isPendingGateStrict(gate)).toBe(false)
    })

    it('should return false for pending gates with invalid gateType', () => {
      const gate = {
        ...createMockGate('pending'),
        resourceImpact: 'high',
        gateType: 'invalid-type',
      }

      expect(isPendingGateStrict(gate)).toBe(false)
    })

    it('should return false for non-pending gates even with required fields', () => {
      const gate = {
        ...createMockGate('approved'),
        resourceImpact: 'high',
        gateType: 'dangerous-operation',
      }

      expect(isPendingGateStrict(gate)).toBe(false)
    })

    it('should return false for null/undefined input', () => {
      expect(isPendingGateStrict(null)).toBe(false)
      expect(isPendingGateStrict(undefined)).toBe(false)
    })

    it('should return false for non-object input', () => {
      expect(isPendingGateStrict('string')).toBe(false)
      expect(isPendingGateStrict(123)).toBe(false)
      expect(isPendingGateStrict(true)).toBe(false)
    })

    it('should validate all resource impact levels', () => {
      const resourceImpacts = ['low', 'medium', 'high', 'critical'] as const

      resourceImpacts.forEach(impact => {
        const gate = {
          ...createMockGate('pending'),
          resourceImpact: impact,
          gateType: 'dangerous-operation',
        }

        expect(isPendingGateStrict(gate)).toBe(true)
      })
    })

    it('should validate all gate types', () => {
      const gateTypes = [
        'pre-execution',
        'post-execution',
        'resource-access',
        'dangerous-operation',
        'deployment',
        'security-review'
      ] as const

      gateTypes.forEach(type => {
        const gate = {
          ...createMockGate('pending'),
          resourceImpact: 'high',
          gateType: type,
        }

        expect(isPendingGateStrict(gate)).toBe(true)
      })
    })
  })
})

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('Validation Functions', () => {
  describe('validateFilterState', () => {
    it('should return true for valid filter state', () => {
      const validState: FilterState = {
        status: 'pending',
        taskId: 'task-123',
        gateType: 'pre-execution',
        resourceImpact: 'high',
        searchQuery: 'test query',
      }

      expect(validateFilterState(validState)).toBe(true)
    })

    it('should return true for filter state with empty values', () => {
      const emptyState: FilterState = {
        status: '',
        taskId: '',
        gateType: '',
        resourceImpact: '',
        searchQuery: '',
      }

      expect(validateFilterState(emptyState)).toBe(true)
    })

    it('should return false for null/undefined input', () => {
      expect(validateFilterState(null)).toBe(false)
      expect(validateFilterState(undefined)).toBe(false)
    })

    it('should return false for non-object input', () => {
      expect(validateFilterState('string')).toBe(false)
      expect(validateFilterState(123)).toBe(false)
      expect(validateFilterState([])).toBe(false)
    })

    it('should return false for missing required properties', () => {
      const incompleteState = {
        status: 'pending',
        // missing taskId, gateType, resourceImpact, searchQuery
      }

      expect(validateFilterState(incompleteState)).toBe(false)
    })

    it('should return false for invalid status values', () => {
      const invalidState = {
        status: 'invalid-status',
        taskId: 'task-123',
        gateType: 'pre-execution',
        resourceImpact: 'high',
        searchQuery: '',
      }

      expect(validateFilterState(invalidState)).toBe(false)
    })

    it('should return false for invalid gate type values', () => {
      const invalidState = {
        status: 'pending',
        taskId: 'task-123',
        gateType: 'invalid-gate-type',
        resourceImpact: 'high',
        searchQuery: '',
      }

      expect(validateFilterState(invalidState)).toBe(false)
    })

    it('should return false for invalid resource impact values', () => {
      const invalidState = {
        status: 'pending',
        taskId: 'task-123',
        gateType: 'pre-execution',
        resourceImpact: 'invalid-impact',
        searchQuery: '',
      }

      expect(validateFilterState(invalidState)).toBe(false)
    })

    it('should return false for non-string properties', () => {
      const invalidState = {
        status: 'pending',
        taskId: 123, // should be string
        gateType: 'pre-execution',
        resourceImpact: 'high',
        searchQuery: '',
      }

      expect(validateFilterState(invalidState)).toBe(false)
    })

    it('should validate all possible status values', () => {
      const validStatuses = ['pending', 'approved', 'rejected', 'skipped', 'timeout', '']

      validStatuses.forEach(status => {
        const state = {
          status,
          taskId: 'task-123',
          gateType: '',
          resourceImpact: '',
          searchQuery: '',
        }

        expect(validateFilterState(state)).toBe(true)
      })
    })
  })

  describe('validateSortState', () => {
    it('should return true for valid sort state', () => {
      const validState: SortState = {
        field: 'requiredAt',
        direction: 'desc',
      }

      expect(validateSortState(validState)).toBe(true)
    })

    it('should return false for null/undefined input', () => {
      expect(validateSortState(null)).toBe(false)
      expect(validateSortState(undefined)).toBe(false)
    })

    it('should return false for non-object input', () => {
      expect(validateSortState('string')).toBe(false)
      expect(validateSortState(123)).toBe(false)
    })

    it('should return false for invalid field values', () => {
      const invalidState = {
        field: 'invalid-field',
        direction: 'asc',
      }

      expect(validateSortState(invalidState)).toBe(false)
    })

    it('should return false for invalid direction values', () => {
      const invalidState = {
        field: 'requiredAt',
        direction: 'invalid-direction',
      }

      expect(validateSortState(invalidState)).toBe(false)
    })

    it('should return false for missing properties', () => {
      const incompleteState = {
        field: 'requiredAt',
        // missing direction
      }

      expect(validateSortState(incompleteState)).toBe(false)
    })

    it('should validate all possible field values', () => {
      const validFields = ['requiredAt', 'priority', 'taskId', 'name']

      validFields.forEach(field => {
        const state = {
          field,
          direction: 'asc',
        }

        expect(validateSortState(state)).toBe(true)
      })
    })

    it('should validate all possible direction values', () => {
      const validDirections = ['asc', 'desc']

      validDirections.forEach(direction => {
        const state = {
          field: 'requiredAt',
          direction,
        }

        expect(validateSortState(state)).toBe(true)
      })
    })
  })

  describe('validateGateType', () => {
    it('should return true for valid gate types', () => {
      const validTypes = [
        'pre-execution',
        'post-execution',
        'resource-access',
        'dangerous-operation',
        'deployment',
        'security-review'
      ]

      validTypes.forEach(type => {
        expect(validateGateType(type)).toBe(true)
      })
    })

    it('should return false for invalid gate types', () => {
      expect(validateGateType('invalid-type')).toBe(false)
      expect(validateGateType('')).toBe(false)
    })

    it('should return false for non-string input', () => {
      expect(validateGateType(null)).toBe(false)
      expect(validateGateType(undefined)).toBe(false)
      expect(validateGateType(123)).toBe(false)
      expect(validateGateType({})).toBe(false)
      expect(validateGateType([])).toBe(false)
    })
  })

  describe('validateResourceImpact', () => {
    it('should return true for valid resource impacts', () => {
      const validImpacts = ['low', 'medium', 'high', 'critical']

      validImpacts.forEach(impact => {
        expect(validateResourceImpact(impact)).toBe(true)
      })
    })

    it('should return false for invalid resource impacts', () => {
      expect(validateResourceImpact('invalid-impact')).toBe(false)
      expect(validateResourceImpact('')).toBe(false)
    })

    it('should return false for non-string input', () => {
      expect(validateResourceImpact(null)).toBe(false)
      expect(validateResourceImpact(undefined)).toBe(false)
      expect(validateResourceImpact(123)).toBe(false)
      expect(validateResourceImpact({})).toBe(false)
      expect(validateResourceImpact([])).toBe(false)
    })
  })

  describe('validateGatePriority', () => {
    it('should return true for valid priorities', () => {
      for (let priority = 1; priority <= 10; priority++) {
        expect(validateGatePriority(priority)).toBe(true)
      }
    })

    it('should return false for priorities out of range', () => {
      expect(validateGatePriority(0)).toBe(false)
      expect(validateGatePriority(11)).toBe(false)
      expect(validateGatePriority(-1)).toBe(false)
      expect(validateGatePriority(100)).toBe(false)
    })

    it('should return false for non-integer numbers', () => {
      expect(validateGatePriority(5.5)).toBe(false)
      expect(validateGatePriority(Math.PI)).toBe(false)
      expect(validateGatePriority(1.1)).toBe(false)
    })

    it('should return false for non-number input', () => {
      expect(validateGatePriority('5')).toBe(false)
      expect(validateGatePriority(null)).toBe(false)
      expect(validateGatePriority(undefined)).toBe(false)
      expect(validateGatePriority({})).toBe(false)
      expect(validateGatePriority([])).toBe(false)
    })

    it('should return false for special number values', () => {
      expect(validateGatePriority(NaN)).toBe(false)
      expect(validateGatePriority(Infinity)).toBe(false)
      expect(validateGatePriority(-Infinity)).toBe(false)
    })
  })
})

// ============================================================================
// Additional WebSocket Event Type Guard Tests
// ============================================================================

describe('WebSocket Event Type Guards', () => {
  describe('isGateApprovedEvent', () => {
    it('should return true for gate:approved events', () => {
      const event = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockGate('approved') as any,
        approver: 'test-user',
        comment: 'Approved',
      })

      expect(isGateApprovedEvent(event)).toBe(true)
    })

    it('should return false for other event types', () => {
      const otherEvents = [
        'gate:rejected',
        'gate:timeout',
        'gate:skipped',
        'gate:required',
        'approval-resolved'
      ] as const

      otherEvents.forEach(eventType => {
        const event = createMockWSEvent(eventType, {
          gate: createMockGate('approved') as any,
          approver: 'test-user',
        } as any)

        expect(isGateApprovedEvent(event)).toBe(false)
      })
    })

    it('should return false for null/undefined input', () => {
      expect(isGateApprovedEvent(null as any)).toBe(false)
      expect(isGateApprovedEvent(undefined as any)).toBe(false)
    })

    it('should return false for non-object input', () => {
      expect(isGateApprovedEvent('string' as any)).toBe(false)
      expect(isGateApprovedEvent(123 as any)).toBe(false)
    })

    it('should return false for events without data property', () => {
      const eventWithoutData = {
        type: 'gate:approved',
        taskId: 'task-123',
        timestamp: new Date(),
        eventId: 'event-123',
        // missing data property
      }

      expect(isGateApprovedEvent(eventWithoutData as any)).toBe(false)
    })
  })

  describe('isGateRejectedEvent', () => {
    it('should return true for gate:rejected events', () => {
      const event = createMockWSEvent<GateRejectedEvent>('gate:rejected', {
        gate: createMockGate('rejected') as any,
        approver: 'test-user',
        comment: 'Rejected due to security concerns',
      })

      expect(isGateRejectedEvent(event)).toBe(true)
    })

    it('should return false for non-rejected events', () => {
      const event = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockGate('approved') as any,
        approver: 'test-user',
      })

      expect(isGateRejectedEvent(event)).toBe(false)
    })

    it('should return false for invalid input', () => {
      expect(isGateRejectedEvent(null as any)).toBe(false)
      expect(isGateRejectedEvent('string' as any)).toBe(false)
    })
  })

  describe('isGateTimeoutEvent', () => {
    it('should return true for gate:timeout events', () => {
      const event = createMockWSEvent<GateTimeoutEvent>('gate:timeout', {
        gate: createMockGate('timeout') as any,
        timeoutMs: 30000,
      })

      expect(isGateTimeoutEvent(event)).toBe(true)
    })

    it('should return false for non-timeout events', () => {
      const event = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockGate('approved') as any,
        approver: 'test-user',
      })

      expect(isGateTimeoutEvent(event)).toBe(false)
    })

    it('should return false for invalid input', () => {
      expect(isGateTimeoutEvent(null as any)).toBe(false)
      expect(isGateTimeoutEvent({} as any)).toBe(false)
    })
  })

  describe('isGateSkippedEvent', () => {
    it('should return true for gate:skipped events', () => {
      const event = createMockWSEvent<GateSkippedEvent>('gate:skipped', {
        gate: createMockGate('skipped') as any,
        reason: 'Skipped by administrator',
      })

      expect(isGateSkippedEvent(event)).toBe(true)
    })

    it('should return false for non-skipped events', () => {
      const event = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockGate('approved') as any,
        approver: 'test-user',
      })

      expect(isGateSkippedEvent(event)).toBe(false)
    })

    it('should return false for invalid input', () => {
      expect(isGateSkippedEvent(null as any)).toBe(false)
      expect(isGateSkippedEvent('invalid' as any)).toBe(false)
    })
  })

  describe('isApprovalResolvedEvent', () => {
    it('should return true for approval-resolved events', () => {
      const event = createMockWSEvent<ApprovalResolvedEvent>('approval-resolved', {
        approvalId: 'approval-123',
        gateName: 'Test Gate',
        approved: true,
        approver: 'test-user',
        comment: 'Looks good',
        gate: createMockGate('approved') as any,
      })

      expect(isApprovalResolvedEvent(event)).toBe(true)
    })

    it('should return false for non-approval-resolved events', () => {
      const event = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockGate('approved') as any,
        approver: 'test-user',
      })

      expect(isApprovalResolvedEvent(event)).toBe(false)
    })

    it('should return false for invalid input', () => {
      expect(isApprovalResolvedEvent(null as any)).toBe(false)
      expect(isApprovalResolvedEvent(123 as any)).toBe(false)
    })
  })
})

// ============================================================================
// Edge Cases and Stress Tests
// ============================================================================

describe('Edge Cases and Stress Tests', () => {
  describe('Large data handling', () => {
    it('should handle validation with extremely large strings', () => {
      const largeString = 'x'.repeat(100000)

      const filterState = {
        status: '',
        taskId: largeString,
        gateType: '',
        resourceImpact: '',
        searchQuery: largeString,
      }

      // Should still validate correctly even with large strings
      expect(validateFilterState(filterState)).toBe(true)
    })

    it('should handle validation with unicode and special characters', () => {
      const unicodeString = '🎉 Test with émojis and 中文 characters'

      const filterState = {
        status: '',
        taskId: unicodeString,
        gateType: '',
        resourceImpact: '',
        searchQuery: unicodeString,
      }

      expect(validateFilterState(filterState)).toBe(true)
    })
  })

  describe('Malformed input handling', () => {
    it('should handle circular references in objects', () => {
      const circularObj: any = { status: 'pending' }
      circularObj.self = circularObj

      expect(validateFilterState(circularObj)).toBe(false)
    })

    it('should handle objects with prototype pollution attempts', () => {
      const maliciousObj = {
        status: 'pending',
        taskId: 'task-123',
        gateType: '',
        resourceImpact: '',
        searchQuery: '',
        '__proto__': { malicious: 'payload' }
      }

      // Should validate based on expected properties only
      expect(validateFilterState(maliciousObj)).toBe(true)
    })

    it('should handle deeply nested objects', () => {
      const deepObj = {
        status: { deeply: { nested: 'pending' } },
        taskId: 'task-123',
        gateType: '',
        resourceImpact: '',
        searchQuery: '',
      }

      expect(validateFilterState(deepObj)).toBe(false)
    })
  })

  describe('Performance with rapid validations', () => {
    it('should handle rapid consecutive validations efficiently', () => {
      const iterations = 10000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        validateGateType('pre-execution')
        validateResourceImpact('high')
        validateGatePriority(5)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete 10,000 validations in under 100ms
      expect(duration).toBeLessThan(100)
    })

    it('should handle bulk event type checking efficiently', () => {
      const mockEvent = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockGate('approved') as any,
        approver: 'test-user',
      })

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        isGateApprovedEvent(mockEvent)
        isGateRejectedEvent(mockEvent)
        isGateTimeoutEvent(mockEvent)
        isGateSkippedEvent(mockEvent)
        isApprovalResolvedEvent(mockEvent)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete 5,000 type checks in under 50ms
      expect(duration).toBeLessThan(50)
    })
  })
})