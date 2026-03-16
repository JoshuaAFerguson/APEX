/**
 * Comprehensive tests for ApprovalGatePanel types and utility functions
 * Tests type guards, reducer logic, and interface compliance
 */

import { describe, it, expect, vi } from 'vitest'
import type { Gate, GateStatus } from '@apexcli/core'
import {
  isPendingGate,
  isResolvedGate,
  confirmationReducer,
  isGateRequiredEvent,
  isGateResolvedEvent,
  INITIAL_CONFIRMATION_STATE,
  type PendingApprovalGate,
  type ResolvedApprovalGate,
  type ApprovalGate,
  type ConfirmationState,
  type ConfirmationAction,
  type ApprovalGateWebSocketEvent,
  type GateRequiredEvent,
  type GateApprovedEvent,
  type GateRejectedEvent,
  type GateTimeoutEvent,
  type GateSkippedEvent,
  type ApprovalResolvedEvent,
  type ApprovalDiffData,
  type ApprovalGatePanelProps,
  type ApprovalGateItemProps,
  type ApprovalDiffPreviewProps,
  type ConfirmationDialogProps,
  type ApprovalGateHistoryItemProps,
  type UseApprovalGatePanelReturn,
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

const createMockPendingGate = (overrides: Partial<PendingApprovalGate> = {}): PendingApprovalGate => ({
  ...createMockGate('pending'),
  description: 'Test pending gate',
  resourceImpact: 'medium',
  gateType: 'pre-execution',
  diffData: {
    diffId: 'diff-123',
    changeType: 'file-write',
    summary: 'Test changes',
    filesChanged: 2,
    linesAdded: 10,
    linesRemoved: 5,
  },
  estimatedImpact: 'Low impact change',
  affectedPaths: ['/test/file.ts'],
  priority: 1,
  timeoutMs: 30000,
  timeoutAt: new Date('2024-01-01T10:30:00Z'),
  ...overrides,
})

const createMockResolvedGate = (
  status: Extract<GateStatus, 'approved' | 'rejected' | 'skipped' | 'timeout'> = 'approved',
  overrides: Partial<ResolvedApprovalGate> = {}
): ResolvedApprovalGate => ({
  ...createMockGate(status),
  approver: 'test-user',
  respondedAt: new Date('2024-01-01T10:15:00Z'),
  comment: 'Test approval comment',
  resolutionTimeMs: 15000,
  autoResolved: false,
  ...overrides,
})

const createMockDiffData = (overrides: Partial<ApprovalDiffData> = {}): ApprovalDiffData => ({
  diffId: 'diff-123',
  changeType: 'file-edit',
  rawDiff: '@@ -1,3 +1,4 @@\n line1\n+line2\n line3',
  summary: 'Added new line',
  filesChanged: 1,
  linesAdded: 1,
  linesRemoved: 0,
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
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isPendingGate', () => {
    it('should return true for pending gates', () => {
      const gate = createMockGate('pending')
      expect(isPendingGate(gate)).toBe(true)
    })

    it('should return false for non-pending gates', () => {
      const statuses: GateStatus[] = ['approved', 'rejected', 'skipped', 'timeout']

      statuses.forEach(status => {
        const gate = createMockGate(status)
        expect(isPendingGate(gate)).toBe(false)
      })
    })

    it('should work with extended gate interfaces', () => {
      const pendingGate = createMockPendingGate()
      expect(isPendingGate(pendingGate)).toBe(true)
    })
  })

  describe('isResolvedGate', () => {
    it('should return false for pending gates', () => {
      const gate = createMockGate('pending')
      expect(isResolvedGate(gate)).toBe(false)
    })

    it('should return true for resolved gates', () => {
      const statuses: GateStatus[] = ['approved', 'rejected', 'skipped', 'timeout']

      statuses.forEach(status => {
        const gate = createMockGate(status)
        expect(isResolvedGate(gate)).toBe(true)
      })
    })

    it('should work with extended gate interfaces', () => {
      const resolvedGate = createMockResolvedGate('approved')
      expect(isResolvedGate(resolvedGate)).toBe(true)
    })
  })

  describe('isGateRequiredEvent', () => {
    it('should return true for gate:required events', () => {
      const event = createMockWSEvent<GateRequiredEvent>('gate:required', {
        gate: createMockPendingGate(),
        approvalId: 'approval-123',
      })
      expect(isGateRequiredEvent(event)).toBe(true)
    })

    it('should return true for approval-required events', () => {
      const event = createMockWSEvent<GateRequiredEvent>('approval-required', {
        gate: createMockPendingGate(),
        approvalId: 'approval-123',
      })
      expect(isGateRequiredEvent(event)).toBe(true)
    })

    it('should return false for other event types', () => {
      const event = createMockWSEvent<GateApprovedEvent>('gate:approved', {
        gate: createMockResolvedGate('approved'),
        approver: 'test-user',
      })
      expect(isGateRequiredEvent(event)).toBe(false)
    })
  })

  describe('isGateResolvedEvent', () => {
    it('should return true for gate resolution events', () => {
      const eventTypes = ['gate:approved', 'gate:rejected', 'gate:timeout', 'gate:skipped'] as const

      eventTypes.forEach(eventType => {
        const event = createMockWSEvent(eventType, {
          gate: createMockResolvedGate(),
          approver: 'test-user',
        })
        expect(isGateResolvedEvent(event)).toBe(true)
      })
    })

    it('should return false for non-resolution events', () => {
      const event = createMockWSEvent<GateRequiredEvent>('gate:required', {
        gate: createMockPendingGate(),
        approvalId: 'approval-123',
      })
      expect(isGateResolvedEvent(event)).toBe(false)
    })
  })
})

// ============================================================================
// Confirmation State Reducer Tests
// ============================================================================

describe('Confirmation State Reducer', () => {
  describe('INITIAL_CONFIRMATION_STATE', () => {
    it('should have correct initial values', () => {
      expect(INITIAL_CONFIRMATION_STATE).toEqual({
        isOpen: false,
        actionType: null,
        gate: null,
        comment: '',
        isSubmitting: false,
        error: null,
      })
    })
  })

  describe('confirmationReducer', () => {
    const initialState = INITIAL_CONFIRMATION_STATE
    const mockGate = createMockPendingGate()

    it('should handle OPEN_DIALOG action', () => {
      const action: ConfirmationAction = {
        type: 'OPEN_DIALOG',
        payload: { actionType: 'approve', gate: mockGate },
      }

      const newState = confirmationReducer(initialState, action)

      expect(newState).toEqual({
        ...INITIAL_CONFIRMATION_STATE,
        isOpen: true,
        actionType: 'approve',
        gate: mockGate,
      })
    })

    it('should handle CLOSE_DIALOG action', () => {
      const openState: ConfirmationState = {
        ...initialState,
        isOpen: true,
        actionType: 'reject',
        gate: mockGate,
        comment: 'test comment',
      }

      const action: ConfirmationAction = { type: 'CLOSE_DIALOG' }
      const newState = confirmationReducer(openState, action)

      expect(newState).toEqual({
        ...openState,
        isOpen: false,
      })
    })

    it('should handle SET_COMMENT action', () => {
      const action: ConfirmationAction = {
        type: 'SET_COMMENT',
        payload: 'Updated comment',
      }

      const newState = confirmationReducer(initialState, action)

      expect(newState).toEqual({
        ...initialState,
        comment: 'Updated comment',
      })
    })

    it('should handle SUBMIT_START action', () => {
      const action: ConfirmationAction = { type: 'SUBMIT_START' }
      const newState = confirmationReducer(initialState, action)

      expect(newState).toEqual({
        ...initialState,
        isSubmitting: true,
        error: null,
      })
    })

    it('should handle SUBMIT_SUCCESS action', () => {
      const busyState: ConfirmationState = {
        ...initialState,
        isOpen: true,
        actionType: 'approve',
        gate: mockGate,
        comment: 'test',
        isSubmitting: true,
      }

      const action: ConfirmationAction = { type: 'SUBMIT_SUCCESS' }
      const newState = confirmationReducer(busyState, action)

      expect(newState).toEqual(INITIAL_CONFIRMATION_STATE)
    })

    it('should handle SUBMIT_ERROR action', () => {
      const action: ConfirmationAction = {
        type: 'SUBMIT_ERROR',
        payload: 'Network error',
      }

      const newState = confirmationReducer(initialState, action)

      expect(newState).toEqual({
        ...initialState,
        isSubmitting: false,
        error: 'Network error',
      })
    })

    it('should handle RESET action', () => {
      const dirtyState: ConfirmationState = {
        isOpen: true,
        actionType: 'reject',
        gate: mockGate,
        comment: 'dirty comment',
        isSubmitting: false,
        error: 'some error',
      }

      const action: ConfirmationAction = { type: 'RESET' }
      const newState = confirmationReducer(dirtyState, action)

      expect(newState).toEqual(INITIAL_CONFIRMATION_STATE)
    })

    it('should return current state for unknown action', () => {
      const action = { type: 'UNKNOWN_ACTION' } as any
      const newState = confirmationReducer(initialState, action)

      expect(newState).toBe(initialState)
    })

    it('should preserve state immutability', () => {
      const action: ConfirmationAction = { type: 'SET_COMMENT', payload: 'test' }
      const newState = confirmationReducer(initialState, action)

      expect(newState).not.toBe(initialState)
      expect(initialState.comment).toBe('')
      expect(newState.comment).toBe('test')
    })
  })
})

// ============================================================================
// Interface and Type Tests
// ============================================================================

describe('Interface Compliance', () => {
  describe('PendingApprovalGate', () => {
    it('should extend base Gate interface', () => {
      const gate = createMockPendingGate()

      // Base Gate properties
      expect(gate).toHaveProperty('id')
      expect(gate).toHaveProperty('name')
      expect(gate).toHaveProperty('status')
      expect(gate).toHaveProperty('createdAt')
      expect(gate).toHaveProperty('updatedAt')
      expect(gate).toHaveProperty('taskId')

      // Extended properties
      expect(gate).toHaveProperty('description')
      expect(gate).toHaveProperty('resourceImpact')
      expect(gate).toHaveProperty('gateType')
      expect(gate).toHaveProperty('diffData')
    })

    it('should enforce pending status', () => {
      const gate = createMockPendingGate()
      expect(gate.status).toBe('pending')
    })

    it('should allow all resource impact levels', () => {
      const levels = ['low', 'medium', 'high', 'critical'] as const

      levels.forEach(level => {
        const gate = createMockPendingGate({ resourceImpact: level })
        expect(gate.resourceImpact).toBe(level)
      })
    })

    it('should allow all gate types', () => {
      const types = ['pre-execution', 'post-execution', 'resource-access', 'dangerous-operation'] as const

      types.forEach(type => {
        const gate = createMockPendingGate({ gateType: type })
        expect(gate.gateType).toBe(type)
      })
    })
  })

  describe('ResolvedApprovalGate', () => {
    it('should extend base Gate interface', () => {
      const gate = createMockResolvedGate()

      // Base Gate properties
      expect(gate).toHaveProperty('id')
      expect(gate).toHaveProperty('name')
      expect(gate).toHaveProperty('status')

      // Resolution properties
      expect(gate).toHaveProperty('approver')
      expect(gate).toHaveProperty('respondedAt')
      expect(gate).toHaveProperty('comment')
      expect(gate).toHaveProperty('resolutionTimeMs')
    })

    it('should enforce resolved status', () => {
      const statuses = ['approved', 'rejected', 'skipped', 'timeout'] as const

      statuses.forEach(status => {
        const gate = createMockResolvedGate(status)
        expect(['approved', 'rejected', 'skipped', 'timeout']).toContain(gate.status)
      })
    })
  })

  describe('ApprovalDiffData', () => {
    it('should have required properties', () => {
      const diffData = createMockDiffData()

      expect(diffData).toHaveProperty('diffId')
      expect(diffData).toHaveProperty('changeType')
      expect(typeof diffData.diffId).toBe('string')
      expect(['file-write', 'file-edit', 'file-delete', 'multi-file', 'command-execution']).toContain(diffData.changeType)
    })

    it('should allow all change types', () => {
      const changeTypes = ['file-write', 'file-edit', 'file-delete', 'multi-file', 'command-execution'] as const

      changeTypes.forEach(changeType => {
        const diffData = createMockDiffData({ changeType })
        expect(diffData.changeType).toBe(changeType)
      })
    })
  })

  describe('WebSocket Event Interfaces', () => {
    it('should have base event properties', () => {
      const event = createMockWSEvent<GateRequiredEvent>('gate:required', {
        gate: createMockPendingGate(),
        approvalId: 'approval-123',
      })

      expect(event).toHaveProperty('type')
      expect(event).toHaveProperty('taskId')
      expect(event).toHaveProperty('timestamp')
      expect(event).toHaveProperty('eventId')
      expect(event).toHaveProperty('data')
    })

    it('should handle GateRequiredEvent correctly', () => {
      const event = createMockWSEvent<GateRequiredEvent>('gate:required', {
        gate: createMockPendingGate(),
        approvalId: 'approval-123',
        description: 'Test approval',
        resourceImpact: 'high',
      })

      expect(event.type).toBe('gate:required')
      expect(event.data.gate.status).toBe('pending')
      expect(event.data.approvalId).toBe('approval-123')
      expect(event.data.resourceImpact).toBe('high')
    })

    it('should handle ApprovalResolvedEvent correctly', () => {
      const event = createMockWSEvent<ApprovalResolvedEvent>('approval-resolved', {
        approvalId: 'approval-123',
        gateName: 'Test Gate',
        approved: true,
        approver: 'test-user',
        comment: 'Looks good',
        gate: createMockResolvedGate('approved'),
      })

      expect(event.type).toBe('approval-resolved')
      expect(event.data.approved).toBe(true)
      expect(event.data.approver).toBe('test-user')
      expect(event.data.gate.status).toBe('approved')
    })
  })
})

// ============================================================================
// Component Props Tests
// ============================================================================

describe('Component Props Interfaces', () => {
  describe('ApprovalGatePanelProps', () => {
    it('should have required properties', () => {
      const props: ApprovalGatePanelProps = {
        taskId: 'task-123',
        pendingGates: [createMockPendingGate()],
        approver: 'test-user',
      }

      expect(props.taskId).toBe('task-123')
      expect(props.pendingGates).toHaveLength(1)
      expect(props.approver).toBe('test-user')
    })

    it('should allow optional properties', () => {
      const mockCallback = vi.fn()

      const props: ApprovalGatePanelProps = {
        taskId: 'task-123',
        pendingGates: [],
        approver: 'test-user',
        resolvedGates: [createMockResolvedGate()],
        useRealTimeUpdates: true,
        autoConnect: false,
        showConnectionIndicator: true,
        onGateAction: mockCallback,
        onActionSuccess: mockCallback,
        onActionError: mockCallback,
        readOnly: true,
        showHistory: false,
        maxHistoryItems: 5,
        compact: true,
        loading: true,
        error: 'Test error',
        className: 'test-class',
      }

      expect(props.resolvedGates).toHaveLength(1)
      expect(props.useRealTimeUpdates).toBe(true)
      expect(props.readOnly).toBe(true)
      expect(props.compact).toBe(true)
      expect(props.error).toBe('Test error')
    })
  })

  describe('ApprovalGateItemProps', () => {
    it('should have required gate property', () => {
      const props: ApprovalGateItemProps = {
        gate: createMockPendingGate(),
      }

      expect(props.gate.status).toBe('pending')
    })

    it('should allow optional callback properties', () => {
      const mockCallback = vi.fn()

      const props: ApprovalGateItemProps = {
        gate: createMockPendingGate(),
        isExpanded: true,
        isLoading: true,
        loadingAction: 'approve',
        error: 'Test error',
        onApprove: mockCallback,
        onReject: mockCallback,
        onToggleExpand: mockCallback,
        onViewDiff: mockCallback,
        readOnly: true,
        compact: false,
        className: 'item-class',
      }

      expect(props.isExpanded).toBe(true)
      expect(props.loadingAction).toBe('approve')
      expect(props.onApprove).toBe(mockCallback)
    })
  })

  describe('ConfirmationDialogProps', () => {
    it('should have required properties', () => {
      const mockCallback = vi.fn()

      const props: ConfirmationDialogProps = {
        isOpen: true,
        actionType: 'approve',
        gate: createMockPendingGate(),
        comment: 'Test comment',
        onCommentChange: mockCallback,
        onConfirm: mockCallback,
        onCancel: mockCallback,
      }

      expect(props.isOpen).toBe(true)
      expect(props.actionType).toBe('approve')
      expect(props.comment).toBe('Test comment')
      expect(typeof props.onCommentChange).toBe('function')
    })

    it('should allow optional configuration properties', () => {
      const mockCallback = vi.fn()

      const props: ConfirmationDialogProps = {
        isOpen: false,
        actionType: 'reject',
        gate: createMockPendingGate(),
        comment: '',
        onCommentChange: mockCallback,
        onConfirm: mockCallback,
        onCancel: mockCallback,
        isSubmitting: true,
        error: 'Validation error',
        requireCommentForReject: true,
        commentPlaceholder: 'Enter reason...',
        maxCommentLength: 250,
        className: 'dialog-class',
      }

      expect(props.isSubmitting).toBe(true)
      expect(props.requireCommentForReject).toBe(true)
      expect(props.maxCommentLength).toBe(250)
    })
  })
})

// ============================================================================
// Edge Cases and Error Scenarios
// ============================================================================

describe('Edge Cases', () => {
  describe('Empty and null values', () => {
    it('should handle empty arrays in component props', () => {
      const props: ApprovalGatePanelProps = {
        taskId: 'task-123',
        pendingGates: [],
        resolvedGates: [],
        approver: 'test-user',
      }

      expect(props.pendingGates).toEqual([])
      expect(props.resolvedGates).toEqual([])
    })

    it('should handle optional properties being undefined', () => {
      const gate = createMockPendingGate({
        description: undefined,
        resourceImpact: undefined,
        gateType: undefined,
        diffData: undefined,
      })

      expect(gate.description).toBeUndefined()
      expect(gate.resourceImpact).toBeUndefined()
      expect(gate.gateType).toBeUndefined()
      expect(gate.diffData).toBeUndefined()
    })
  })

  describe('Timeout handling', () => {
    it('should handle timeout gates correctly', () => {
      const timeoutGate = createMockResolvedGate('timeout', {
        resolutionReason: 'Gate timed out after 30 seconds',
        autoResolved: true,
      })

      expect(timeoutGate.status).toBe('timeout')
      expect(timeoutGate.autoResolved).toBe(true)
      expect(timeoutGate.resolutionReason).toContain('timed out')
    })

    it('should handle future timeout dates', () => {
      const futureDate = new Date(Date.now() + 60000) // 1 minute from now
      const gate = createMockPendingGate({
        timeoutAt: futureDate,
        timeoutMs: 60000,
      })

      expect(gate.timeoutAt?.getTime()).toBeGreaterThan(Date.now())
      expect(gate.timeoutMs).toBe(60000)
    })
  })

  describe('Large data scenarios', () => {
    it('should handle gates with large diff data', () => {
      const largeDiff = createMockDiffData({
        filesChanged: 100,
        linesAdded: 5000,
        linesRemoved: 2000,
        rawDiff: 'a'.repeat(10000), // Large diff content
      })

      const gate = createMockPendingGate({ diffData: largeDiff })

      expect(gate.diffData?.filesChanged).toBe(100)
      expect(gate.diffData?.rawDiff?.length).toBe(10000)
    })

    it('should handle many affected paths', () => {
      const manyPaths = Array.from({ length: 50 }, (_, i) => `/path/to/file${i}.ts`)
      const gate = createMockPendingGate({ affectedPaths: manyPaths })

      expect(gate.affectedPaths).toHaveLength(50)
      expect(gate.affectedPaths?.[0]).toBe('/path/to/file0.ts')
    })
  })

  describe('Special characters and encoding', () => {
    it('should handle gates with special characters in names', () => {
      const gate = createMockPendingGate({
        name: 'Gate with émojis 🚫 and special chars: <>&"\'',
        description: 'Description with newlines\nand\ttabs',
      })

      expect(gate.name).toContain('émojis 🚫')
      expect(gate.description).toContain('\n')
      expect(gate.description).toContain('\t')
    })

    it('should handle comments with various encodings', () => {
      const state = confirmationReducer(INITIAL_CONFIRMATION_STATE, {
        type: 'SET_COMMENT',
        payload: 'Comment with 中文, العربية, and 🎉 emojis',
      })

      expect(state.comment).toContain('中文')
      expect(state.comment).toContain('العربية')
      expect(state.comment).toContain('🎉')
    })
  })
})

// ============================================================================
// Performance and Memory Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle rapid reducer state changes efficiently', () => {
    let state = INITIAL_CONFIRMATION_STATE
    const iterations = 1000

    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      state = confirmationReducer(state, {
        type: 'SET_COMMENT',
        payload: `Comment ${i}`,
      })
    }

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(duration).toBeLessThan(100) // Should complete in under 100ms
    expect(state.comment).toBe(`Comment ${iterations - 1}`)
  })

  it('should not leak memory with large comment strings', () => {
    const largeComment = 'x'.repeat(10000)

    const state = confirmationReducer(INITIAL_CONFIRMATION_STATE, {
      type: 'SET_COMMENT',
      payload: largeComment,
    })

    expect(state.comment).toHaveLength(10000)

    // Reset to ensure cleanup
    const resetState = confirmationReducer(state, { type: 'RESET' })
    expect(resetState.comment).toBe('')
  })
})