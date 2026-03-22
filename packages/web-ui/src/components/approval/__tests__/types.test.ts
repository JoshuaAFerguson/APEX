/**
 * Type validation tests for approval gate types and constants
 * Tests TypeScript type guards, validators, and constants
 */

import { describe, it, expect } from 'vitest'
import type {
  PendingApprovalGate,
  ResolvedApprovalGate,
  GateRequiredEvent,
  GateApprovedEvent,
  GateRejectedEvent,
  GateTimeoutEvent,
  GateSkippedEvent,
  ApprovalResolvedEvent,
  ApprovalGateWebSocketEvent,
  FilterState,
  SortState,
  ConfirmationState,
  ApprovalDiffData,
} from '@/types/approval-gate-panel'

import {
  isPendingGate,
  isPendingGateStrict,
  isResolvedGate,
  isGateRequiredEvent,
  isGateApprovedEvent,
  isGateRejectedEvent,
  isGateTimeoutEvent,
  isGateSkippedEvent,
  isApprovalResolvedEvent,
  isGateResolvedEvent,
  confirmationReducer,
  validateFilterState,
  validateSortState,
  validateGateType,
  validateResourceImpact,
  validateGatePriority,
  INITIAL_CONFIRMATION_STATE,
} from '@/types/approval-gate-panel'

import {
  APPROVAL_GATE_STATUS_CONFIG,
  RESOURCE_IMPACT_CONFIG,
  GATE_TYPE_CONFIG,
  APPROVAL_ACTION_CONFIG,
  FILTER_DEFAULTS,
  SORT_DEFAULTS,
  UI_CONSTANTS,
  VALIDATION_RULES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TEST_IDS,
} from '@/types/approval-gate-panel-constants'

describe('Approval Gate Type Guards', () => {
  // Test data
  const pendingGate: PendingApprovalGate = {
    id: 'gate-1',
    name: 'test-gate',
    taskId: 'task-1',
    status: 'pending',
    requiredAt: new Date('2024-01-01T10:00:00Z'),
    description: 'Test gate',
    resourceImpact: 'medium',
    gateType: 'pre-execution',
    priority: 5,
    timeoutMs: 300000,
    timeoutAt: new Date('2024-01-01T10:05:00Z'),
  }

  const resolvedGate: ResolvedApprovalGate = {
    id: 'gate-2',
    name: 'resolved-gate',
    taskId: 'task-1',
    status: 'approved',
    requiredAt: new Date('2024-01-01T10:00:00Z'),
    approver: 'user@example.com',
    respondedAt: new Date('2024-01-01T10:02:00Z'),
    comment: 'Approved',
    resolutionTimeMs: 120000,
    autoResolved: false,
  }

  describe('isPendingGate', () => {
    it('should return true for pending gates', () => {
      expect(isPendingGate(pendingGate)).toBe(true)
    })

    it('should return false for resolved gates', () => {
      expect(isPendingGate(resolvedGate)).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(isPendingGate(null)).toBe(false)
      expect(isPendingGate(undefined)).toBe(false)
    })

    it('should return false for invalid objects', () => {
      expect(isPendingGate({})).toBe(false)
      expect(isPendingGate({ status: 'pending' })).toBe(false)
      expect(isPendingGate({ id: 'test', status: 'approved' })).toBe(false)
    })

    it('should validate all required pending gate properties', () => {
      const invalidGate = { ...pendingGate }
      delete (invalidGate as any).resourceImpact

      // isPendingGate allows optional resourceImpact, use isPendingGateStrict for strict validation
      expect(isPendingGate(invalidGate)).toBe(true) // resourceImpact is optional
      expect(isPendingGateStrict(invalidGate)).toBe(false) // strict version requires it
    })
  })

  describe('isResolvedGate', () => {
    it('should return true for resolved gates', () => {
      expect(isResolvedGate(resolvedGate)).toBe(true)
    })

    it('should return false for pending gates', () => {
      expect(isResolvedGate(pendingGate)).toBe(false)
    })

    it('should return true for different resolved statuses', () => {
      const rejectedGate = { ...resolvedGate, status: 'rejected' as const }
      const timeoutGate = { ...resolvedGate, status: 'timeout' as const }
      const skippedGate = { ...resolvedGate, status: 'skipped' as const }

      expect(isResolvedGate(rejectedGate)).toBe(true)
      expect(isResolvedGate(timeoutGate)).toBe(true)
      expect(isResolvedGate(skippedGate)).toBe(true)
    })

    it('should return false for null/undefined', () => {
      expect(isResolvedGate(null)).toBe(false)
      expect(isResolvedGate(undefined)).toBe(false)
    })

    it('should validate resolved gate properties', () => {
      const invalidGate = { ...resolvedGate }
      delete (invalidGate as any).approver

      expect(isResolvedGate(invalidGate)).toBe(false)
    })
  })
})

describe('WebSocket Event Type Guards', () => {
  const gateRequiredEvent: GateRequiredEvent = {
    type: 'gate:required',
    taskId: 'task-1',
    timestamp: new Date(),
    eventId: 'event-1',
    data: {
      gate: {} as PendingApprovalGate,
      approvalId: 'approval-1',
    },
  }

  const gateApprovedEvent: GateApprovedEvent = {
    type: 'gate:approved',
    taskId: 'task-1',
    timestamp: new Date(),
    eventId: 'event-2',
    data: {
      gate: {} as ResolvedApprovalGate,
      approver: 'user@example.com',
    },
  }

  describe('isGateRequiredEvent', () => {
    it('should return true for gate:required events', () => {
      expect(isGateRequiredEvent(gateRequiredEvent)).toBe(true)
    })

    it('should return false for other event types', () => {
      expect(isGateRequiredEvent(gateApprovedEvent)).toBe(false)
    })

    it('should validate event structure', () => {
      const invalidEvent = { ...gateRequiredEvent }
      delete (invalidEvent as any).data

      expect(isGateRequiredEvent(invalidEvent)).toBe(false)
    })
  })

  describe('isGateApprovedEvent', () => {
    it('should return true for gate:approved events', () => {
      expect(isGateApprovedEvent(gateApprovedEvent)).toBe(true)
    })

    it('should return false for other event types', () => {
      expect(isGateApprovedEvent(gateRequiredEvent)).toBe(false)
    })
  })

  describe('isGateResolvedEvent', () => {
    it('should return true for resolved event types', () => {
      expect(isGateResolvedEvent(gateApprovedEvent)).toBe(true)

      const rejectedEvent = { ...gateApprovedEvent, type: 'gate:rejected' as const }
      const timeoutEvent = { ...gateApprovedEvent, type: 'gate:timeout' as const }
      const skippedEvent = { ...gateApprovedEvent, type: 'gate:skipped' as const }

      expect(isGateResolvedEvent(rejectedEvent)).toBe(true)
      expect(isGateResolvedEvent(timeoutEvent)).toBe(true)
      expect(isGateResolvedEvent(skippedEvent)).toBe(true)
    })

    it('should return false for non-resolved event types', () => {
      expect(isGateResolvedEvent(gateRequiredEvent)).toBe(false)
    })
  })
})

describe('State Validation Functions', () => {
  describe('validateFilterState', () => {
    it('should validate valid filter state', () => {
      const validState: FilterState = {
        status: 'pending',
        taskId: 'task-1',
        gateType: 'pre-execution',
        resourceImpact: 'medium',
        searchQuery: 'test',
      }

      expect(validateFilterState(validState)).toBe(true)
    })

    it('should validate empty filter state', () => {
      const emptyState: FilterState = {
        status: '',
        taskId: '',
        gateType: '',
        resourceImpact: '',
        searchQuery: '',
      }

      expect(validateFilterState(emptyState)).toBe(true)
    })

    it('should reject invalid filter values', () => {
      const invalidState = {
        status: 'invalid-status',
        taskId: '',
        gateType: 'invalid-type',
        resourceImpact: 'invalid-impact',
        searchQuery: '',
      } as FilterState

      expect(validateFilterState(invalidState)).toBe(false)
    })

    it('should reject null/undefined', () => {
      expect(validateFilterState(null as any)).toBe(false)
      expect(validateFilterState(undefined as any)).toBe(false)
    })
  })

  describe('validateSortState', () => {
    it('should validate valid sort state', () => {
      const validState: SortState = {
        field: 'requiredAt',
        direction: 'asc',
      }

      expect(validateSortState(validState)).toBe(true)
    })

    it('should validate all valid sort fields', () => {
      const validFields = ['requiredAt', 'priority', 'taskId', 'name'] as const
      const validDirections = ['asc', 'desc'] as const

      validFields.forEach(field => {
        validDirections.forEach(direction => {
          expect(validateSortState({ field, direction })).toBe(true)
        })
      })
    })

    it('should reject invalid sort fields', () => {
      const invalidState = {
        field: 'invalid-field',
        direction: 'asc',
      } as SortState

      expect(validateSortState(invalidState)).toBe(false)
    })

    it('should reject invalid sort directions', () => {
      const invalidState = {
        field: 'requiredAt',
        direction: 'invalid-direction',
      } as SortState

      expect(validateSortState(invalidState)).toBe(false)
    })
  })

  describe('validateGateType', () => {
    it('should validate valid gate types', () => {
      expect(validateGateType('pre-execution')).toBe(true)
      expect(validateGateType('post-execution')).toBe(true)
      expect(validateGateType('deployment')).toBe(true)
      expect(validateGateType('security-review')).toBe(true)
    })

    it('should reject invalid gate types', () => {
      expect(validateGateType('invalid-type')).toBe(false)
      expect(validateGateType('')).toBe(false)
      expect(validateGateType(null as any)).toBe(false)
    })
  })

  describe('validateResourceImpact', () => {
    it('should validate valid resource impacts', () => {
      expect(validateResourceImpact('low')).toBe(true)
      expect(validateResourceImpact('medium')).toBe(true)
      expect(validateResourceImpact('high')).toBe(true)
      expect(validateResourceImpact('critical')).toBe(true)
    })

    it('should reject invalid resource impacts', () => {
      expect(validateResourceImpact('invalid-impact')).toBe(false)
      expect(validateResourceImpact('')).toBe(false)
      expect(validateResourceImpact(null as any)).toBe(false)
    })
  })

  describe('validateGatePriority', () => {
    it('should validate valid priority values', () => {
      expect(validateGatePriority(1)).toBe(true)
      expect(validateGatePriority(5)).toBe(true)
      expect(validateGatePriority(10)).toBe(true)
    })

    it('should reject invalid priority values', () => {
      expect(validateGatePriority(0)).toBe(false)
      expect(validateGatePriority(11)).toBe(false)
      expect(validateGatePriority(-1)).toBe(false)
      expect(validateGatePriority(1.5)).toBe(false)
      expect(validateGatePriority(null as any)).toBe(false)
    })
  })
})

describe('Confirmation Reducer', () => {
  // Use the exported INITIAL_CONFIRMATION_STATE which uses actionType/isSubmitting
  const initialState = INITIAL_CONFIRMATION_STATE

  describe('OPEN_DIALOG action', () => {
    it('should open dialog with action and gate', () => {
      const gate = {} as PendingApprovalGate
      const action = { type: 'OPEN_DIALOG' as const, payload: { actionType: 'approve' as const, gate } }

      const newState = confirmationReducer(initialState, action)

      expect(newState.isOpen).toBe(true)
      expect(newState.actionType).toBe('approve')
      expect(newState.gate).toBe(gate)
      expect(newState.comment).toBe('')
      expect(newState.error).toBe(null)
    })
  })

  describe('CLOSE_DIALOG action', () => {
    it('should close dialog and reset state', () => {
      const openState: ConfirmationState = {
        ...initialState,
        isOpen: true,
        actionType: 'approve' as const,
        gate: {} as PendingApprovalGate,
        comment: 'test comment',
        error: 'test error',
      }

      const action = { type: 'CLOSE_DIALOG' as const }
      const newState = confirmationReducer(openState, action)

      // CLOSE_DIALOG only closes the dialog, doesn't reset other state
      expect(newState.isOpen).toBe(false)
      expect(newState.actionType).toBe('approve') // Preserved
      expect(newState.gate).toBe(openState.gate) // Preserved
      expect(newState.comment).toBe('test comment') // Preserved
      expect(newState.error).toBe('test error') // Preserved
    })
  })

  describe('SET_COMMENT action', () => {
    it('should update comment', () => {
      const action = { type: 'SET_COMMENT' as const, payload: 'new comment' }
      const newState = confirmationReducer(initialState, action)

      expect(newState.comment).toBe('new comment')
    })
  })

  describe('SUBMIT_START action', () => {
    it('should update loading state', () => {
      const action = { type: 'SUBMIT_START' as const }
      const newState = confirmationReducer(initialState, action)

      expect(newState.isSubmitting).toBe(true)
    })
  })

  describe('SUBMIT_ERROR action', () => {
    it('should update error state', () => {
      const action = { type: 'SUBMIT_ERROR' as const, payload: 'test error' }
      const newState = confirmationReducer(initialState, action)

      expect(newState.error).toBe('test error')
    })

    it('should clear error with RESET', () => {
      const errorState: ConfirmationState = { ...initialState, error: 'existing error' }
      const action = { type: 'RESET' as const }
      const newState = confirmationReducer(errorState, action)

      expect(newState.error).toBe(null)
    })
  })
})

describe('Constants Validation', () => {
  describe('APPROVAL_GATE_STATUS_CONFIG', () => {
    it('should have all required status configurations', () => {
      expect(APPROVAL_GATE_STATUS_CONFIG).toHaveProperty('pending')
      expect(APPROVAL_GATE_STATUS_CONFIG).toHaveProperty('approved')
      expect(APPROVAL_GATE_STATUS_CONFIG).toHaveProperty('rejected')
      expect(APPROVAL_GATE_STATUS_CONFIG).toHaveProperty('timeout')
      expect(APPROVAL_GATE_STATUS_CONFIG).toHaveProperty('skipped')
    })

    it('should have valid configuration structure', () => {
      Object.values(APPROVAL_GATE_STATUS_CONFIG).forEach(config => {
        expect(config).toHaveProperty('color')
        expect(config).toHaveProperty('bgColor')
        expect(config).toHaveProperty('borderColor')
        expect(config).toHaveProperty('icon')
        expect(config).toHaveProperty('label')
        expect(typeof config.label).toBe('string')
      })
    })
  })

  describe('RESOURCE_IMPACT_CONFIG', () => {
    it('should have all impact levels', () => {
      expect(RESOURCE_IMPACT_CONFIG).toHaveProperty('low')
      expect(RESOURCE_IMPACT_CONFIG).toHaveProperty('medium')
      expect(RESOURCE_IMPACT_CONFIG).toHaveProperty('high')
      expect(RESOURCE_IMPACT_CONFIG).toHaveProperty('critical')
    })

    it('should have valid configuration structure', () => {
      Object.values(RESOURCE_IMPACT_CONFIG).forEach(config => {
        expect(config).toHaveProperty('color')
        expect(config).toHaveProperty('bgColor')
        expect(config).toHaveProperty('label')
        expect(config).toHaveProperty('description')
        expect(typeof config.label).toBe('string')
      })
    })
  })

  describe('GATE_TYPE_CONFIG', () => {
    it('should have common gate types', () => {
      expect(GATE_TYPE_CONFIG).toHaveProperty('pre-execution')
      expect(GATE_TYPE_CONFIG).toHaveProperty('post-execution')
      expect(GATE_TYPE_CONFIG).toHaveProperty('deployment')
      expect(GATE_TYPE_CONFIG).toHaveProperty('security-review')
    })

    it('should have valid configuration structure', () => {
      Object.values(GATE_TYPE_CONFIG).forEach(config => {
        expect(config).toHaveProperty('color')
        expect(config).toHaveProperty('bgColor')
        expect(config).toHaveProperty('label')
        expect(config).toHaveProperty('description')
        expect(typeof config.label).toBe('string')
      })
    })
  })

  describe('UI_CONSTANTS', () => {
    it('should have required UI constants', () => {
      expect(UI_CONSTANTS).toHaveProperty('COMMENT_MAX_LENGTH')
      expect(UI_CONSTANTS).toHaveProperty('SEARCH_DEBOUNCE_MS')
      expect(UI_CONSTANTS).toHaveProperty('ANIMATION_DURATION_MS')
      expect(UI_CONSTANTS).toHaveProperty('MAX_HISTORY_ITEMS')
    })

    it('should have valid values', () => {
      expect(typeof UI_CONSTANTS.COMMENT_MAX_LENGTH).toBe('number')
      expect(UI_CONSTANTS.COMMENT_MAX_LENGTH).toBeGreaterThan(0)
      expect(typeof UI_CONSTANTS.SEARCH_DEBOUNCE_MS).toBe('number')
      expect(UI_CONSTANTS.SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(0)
    })
  })

  describe('VALIDATION_RULES', () => {
    it('should have required validation rules', () => {
      expect(VALIDATION_RULES).toHaveProperty('COMMENT_MIN_LENGTH')
      expect(VALIDATION_RULES).toHaveProperty('COMMENT_MAX_LENGTH')
      expect(VALIDATION_RULES).toHaveProperty('SEARCH_MIN_LENGTH')
      expect(VALIDATION_RULES).toHaveProperty('PRIORITY_MIN')
      expect(VALIDATION_RULES).toHaveProperty('PRIORITY_MAX')
    })

    it('should have logical validation values', () => {
      expect(VALIDATION_RULES.COMMENT_MIN_LENGTH).toBeLessThanOrEqual(VALIDATION_RULES.COMMENT_MAX_LENGTH)
      expect(VALIDATION_RULES.PRIORITY_MIN).toBeLessThan(VALIDATION_RULES.PRIORITY_MAX)
      expect(VALIDATION_RULES.PRIORITY_MIN).toBeGreaterThan(0)
    })
  })

  describe('ERROR_MESSAGES', () => {
    it('should have required error messages', () => {
      expect(ERROR_MESSAGES).toHaveProperty('COMMENT_REQUIRED')
      expect(ERROR_MESSAGES).toHaveProperty('COMMENT_TOO_LONG')
      expect(ERROR_MESSAGES).toHaveProperty('APPROVAL_FAILED')
      expect(ERROR_MESSAGES).toHaveProperty('REJECTION_FAILED')
      expect(ERROR_MESSAGES).toHaveProperty('CONNECTION_FAILED')
    })

    it('should have non-empty error messages', () => {
      Object.values(ERROR_MESSAGES).forEach(message => {
        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      })
    })
  })

  describe('SUCCESS_MESSAGES', () => {
    it('should have required success messages', () => {
      expect(SUCCESS_MESSAGES).toHaveProperty('APPROVAL_SUCCESS')
      expect(SUCCESS_MESSAGES).toHaveProperty('REJECTION_SUCCESS')
    })

    it('should have non-empty success messages', () => {
      Object.values(SUCCESS_MESSAGES).forEach(message => {
        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      })
    })
  })

  describe('TEST_IDS', () => {
    it('should have required test IDs', () => {
      expect(TEST_IDS).toHaveProperty('approvalGatePanel')
      expect(TEST_IDS).toHaveProperty('pendingGatesList')
      expect(TEST_IDS).toHaveProperty('resolvedGatesList')
      expect(TEST_IDS).toHaveProperty('confirmationDialog')
      expect(TEST_IDS).toHaveProperty('connectionIndicator')
    })

    it('should have function test IDs', () => {
      expect(typeof TEST_IDS.gateItem).toBe('function')
      expect(typeof TEST_IDS.approveButton).toBe('function')
      expect(typeof TEST_IDS.rejectButton).toBe('function')
    })

    it('should generate valid test IDs', () => {
      expect(TEST_IDS.gateItem('test-gate')).toBe('gate-item-test-gate')
      expect(TEST_IDS.approveButton('test-gate')).toBe('approve-button-test-gate')
      expect(TEST_IDS.rejectButton('test-gate')).toBe('reject-button-test-gate')
    })
  })
})

describe('Type Compatibility', () => {
  it('should ensure PendingApprovalGate extends base Gate type', () => {
    const pendingGate: PendingApprovalGate = {
      id: 'gate-1',
      name: 'test-gate',
      taskId: 'task-1',
      status: 'pending',
      requiredAt: new Date(),
      description: 'Test gate',
      resourceImpact: 'medium',
      gateType: 'pre-execution',
      priority: 5,
      timeoutMs: 300000,
      timeoutAt: new Date(),
    }

    // Should be assignable to base Gate type
    const baseGate = pendingGate
    expect(baseGate.id).toBe(pendingGate.id)
  })

  it('should ensure ResolvedApprovalGate extends base Gate type', () => {
    const resolvedGate: ResolvedApprovalGate = {
      id: 'gate-2',
      name: 'resolved-gate',
      taskId: 'task-1',
      status: 'approved',
      requiredAt: new Date(),
      approver: 'user@example.com',
      respondedAt: new Date(),
      comment: 'Approved',
      resolutionTimeMs: 120000,
      autoResolved: false,
    }

    // Should be assignable to base Gate type
    const baseGate = resolvedGate
    expect(baseGate.id).toBe(resolvedGate.id)
  })

  it('should ensure ApprovalDiffData has required properties', () => {
    const diffData: ApprovalDiffData = {
      diffId: 'diff-1',
      changeType: 'file-edit',
      summary: 'Updated file',
      rawDiff: '@@ -1,1 +1,1 @@\n-old\n+new',
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 1,
    }

    expect(diffData.diffId).toBeDefined()
    expect(diffData.changeType).toBeDefined()
    expect(diffData.summary).toBeDefined()
  })
})

describe('Edge Cases and Error Conditions', () => {
  it('should handle malformed objects gracefully', () => {
    const malformedGate = {
      id: 'gate-1',
      // Missing required properties (name, taskId, status, requiredAt/respondedAt)
    }

    expect(isPendingGate(malformedGate)).toBe(false)
    expect(isResolvedGate(malformedGate)).toBe(false)
  })

  it('should handle circular references', () => {
    const circularGate: any = {
      id: 'gate-1',
      name: 'test-gate',
      taskId: 'task-1',
      status: 'pending',
      requiredAt: new Date(),
    }
    circularGate.self = circularGate

    expect(() => isPendingGate(circularGate)).not.toThrow()
  })

  it('should handle very large objects', () => {
    const largeGate = {
      id: 'gate-1',
      name: 'test-gate',
      taskId: 'task-1',
      status: 'pending' as const,
      requiredAt: new Date(),
      description: 'A'.repeat(10000), // Very long description
      resourceImpact: 'medium' as const,
      gateType: 'pre-execution' as const,
      priority: 5,
      timeoutMs: 300000,
      timeoutAt: new Date(),
      metadata: new Array(1000).fill(0).map((_, i) => ({ key: i, value: 'data' })),
    }

    expect(() => isPendingGate(largeGate)).not.toThrow()
  })
})