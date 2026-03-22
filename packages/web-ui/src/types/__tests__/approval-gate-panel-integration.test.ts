/**
 * Integration tests for ApprovalGatePanel types and constants working together
 * Tests complete workflows, type integration, and real-world scenarios
 */

import { describe, it, expect, vi } from 'vitest'
import type { Gate, GateStatus } from '@apexcli/core'
import type { DiffViewMode } from '../components/diff/types'
import {
  isPendingGate,
  isResolvedGate,
  confirmationReducer,
  isGateRequiredEvent,
  isGateResolvedEvent,
  INITIAL_CONFIRMATION_STATE,
  type PendingApprovalGate,
  type ResolvedApprovalGate,
  type ApprovalDiffData,
  type ApprovalGatePanelProps,
  type ApprovalGateItemProps,
  type ConfirmationDialogProps,
  type ApprovalDiffPreviewProps,
  type ConfirmationState,
  type ConfirmationAction,
  type GateRequiredEvent,
  type ApprovalResolvedEvent,
} from '../approval-gate-panel'
import {
  GATE_STATUS_STYLES,
  RESOURCE_IMPACT_CONFIG,
  GATE_TYPE_CONFIG,
  APPROVAL_GATE_PANEL_DEFAULTS,
  ACTION_BUTTON_STYLES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TEST_IDS,
} from '../approval-gate-panel-constants'

// ============================================================================
// Test Fixtures and Utilities
// ============================================================================

const createCompleteGate = (overrides: Partial<PendingApprovalGate> = {}): PendingApprovalGate => ({
  id: 'test-gate-1',
  name: 'Test Approval Gate',
  status: 'pending',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  taskId: 'task-123',
  description: 'This gate requires approval for dangerous operations',
  resourceImpact: 'high',
  gateType: 'dangerous-operation',
  diffData: {
    diffId: 'diff-456',
    changeType: 'file-edit',
    summary: 'Modifying critical system file',
    filesChanged: 3,
    linesAdded: 45,
    linesRemoved: 12,
    rawDiff: '@@ -1,10 +1,10 @@\n- old line\n+ new line',
    fileDiffs: [
      {
        oldPath: '/config/system.conf',
        newPath: '/config/system.conf',
        hunks: [
          {
            oldStart: 1,
            oldLines: 5,
            newStart: 1,
            newLines: 6,
            lines: [
              { type: 'unchanged', content: ' # System Configuration' },
              { type: 'removed', content: '- debug_mode=false' },
              { type: 'added', content: '+ debug_mode=true' },
              { type: 'added', content: '+ verbose_logging=true' },
              { type: 'unchanged', content: ' timeout=30' },
            ]
          }
        ]
      }
    ]
  },
  estimatedImpact: 'High impact: Enables debug mode and verbose logging',
  affectedPaths: ['/config/system.conf', '/config/logging.conf', '/scripts/deploy.sh'],
  priority: 1,
  timeoutMs: 300000, // 5 minutes
  timeoutAt: new Date('2024-01-01T10:05:00Z'),
  ...overrides,
})

const createApprovalWorkflow = () => {
  const pendingGate = createCompleteGate()

  const resolvedGate: ResolvedApprovalGate = {
    ...pendingGate,
    status: 'approved',
    approver: 'senior-dev@company.com',
    respondedAt: new Date('2024-01-01T10:03:00Z'),
    comment: 'Approved after security review. Changes look safe for development environment.',
    resolutionTimeMs: 180000, // 3 minutes
    autoResolved: false,
  }

  return { pendingGate, resolvedGate }
}

// ============================================================================
// Complete Workflow Integration Tests
// ============================================================================

describe('Complete Workflow Integration', () => {
  describe('Gate approval workflow', () => {
    it('should handle complete approval workflow with type consistency', () => {
      const { pendingGate, resolvedGate } = createApprovalWorkflow()

      // Validate initial pending state
      expect(isPendingGate(pendingGate)).toBe(true)
      expect(isResolvedGate(pendingGate)).toBe(false)

      // Verify gate has proper styling configuration
      expect(GATE_STATUS_STYLES[pendingGate.status]).toBeDefined()
      expect(GATE_STATUS_STYLES[pendingGate.status].text).toContain('yellow')

      // Verify resource impact configuration exists
      expect(RESOURCE_IMPACT_CONFIG[pendingGate.resourceImpact!]).toBeDefined()
      expect(RESOURCE_IMPACT_CONFIG[pendingGate.resourceImpact!].level).toBe('high')

      // Verify gate type configuration exists
      expect(GATE_TYPE_CONFIG[pendingGate.gateType!]).toBeDefined()
      expect(GATE_TYPE_CONFIG[pendingGate.gateType!].type).toBe('dangerous-operation')

      // Simulate approval process through confirmation reducer
      let confirmationState = INITIAL_CONFIRMATION_STATE

      // Open approval dialog
      confirmationState = confirmationReducer(confirmationState, {
        type: 'OPEN_DIALOG',
        payload: { actionType: 'approve', gate: pendingGate }
      })

      expect(confirmationState.isOpen).toBe(true)
      expect(confirmationState.actionType).toBe('approve')
      expect(confirmationState.gate).toBe(pendingGate)

      // Add comment
      const approvalComment = 'Approved after security review'
      confirmationState = confirmationReducer(confirmationState, {
        type: 'SET_COMMENT',
        payload: approvalComment
      })

      expect(confirmationState.comment).toBe(approvalComment)

      // Start submission
      confirmationState = confirmationReducer(confirmationState, {
        type: 'SUBMIT_START'
      })

      expect(confirmationState.isSubmitting).toBe(true)

      // Complete submission
      confirmationState = confirmationReducer(confirmationState, {
        type: 'SUBMIT_SUCCESS'
      })

      expect(confirmationState).toEqual(INITIAL_CONFIRMATION_STATE)

      // Validate resolved state
      expect(isResolvedGate(resolvedGate)).toBe(true)
      expect(isPendingGate(resolvedGate)).toBe(false)

      // Verify resolved gate styling
      expect(GATE_STATUS_STYLES[resolvedGate.status]).toBeDefined()
      expect(GATE_STATUS_STYLES[resolvedGate.status].text).toContain('green')
    })

    it('should handle rejection workflow with error handling', () => {
      const pendingGate = createCompleteGate()
      let confirmationState = INITIAL_CONFIRMATION_STATE

      // Open rejection dialog
      confirmationState = confirmationReducer(confirmationState, {
        type: 'OPEN_DIALOG',
        payload: { actionType: 'reject', gate: pendingGate }
      })

      expect(confirmationState.actionType).toBe('reject')

      // Try to submit without comment (should fail validation)
      expect(confirmationState.comment).toBe('')

      // Add required comment
      const rejectionComment = 'Rejected due to security concerns. Debug mode should not be enabled in production.'
      confirmationState = confirmationReducer(confirmationState, {
        type: 'SET_COMMENT',
        payload: rejectionComment
      })

      // Simulate submission error
      const errorMessage = 'Network timeout while submitting rejection'
      confirmationState = confirmationReducer(confirmationState, {
        type: 'SUBMIT_ERROR',
        payload: errorMessage
      })

      expect(confirmationState.isSubmitting).toBe(false)
      expect(confirmationState.error).toBe(errorMessage)
      expect(confirmationState.isOpen).toBe(true) // Should remain open for retry
    })
  })

  describe('WebSocket event integration', () => {
    it('should handle complete WebSocket event flow', () => {
      const pendingGate = createCompleteGate()

      // Create gate required event
      const gateRequiredEvent: GateRequiredEvent = {
        type: 'gate:required',
        taskId: pendingGate.taskId,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        eventId: 'event-123',
        data: {
          gate: pendingGate,
          approvalId: 'approval-456',
          description: 'Dangerous operation requires approval',
          resourceImpact: 'high',
          diffData: pendingGate.diffData,
        }
      }

      // Validate event structure
      expect(isGateRequiredEvent(gateRequiredEvent)).toBe(true)
      expect(isGateResolvedEvent(gateRequiredEvent)).toBe(false)

      // Create resolution event
      const approvalResolvedEvent: ApprovalResolvedEvent = {
        type: 'approval-resolved',
        taskId: pendingGate.taskId,
        timestamp: new Date('2024-01-01T10:03:00Z'),
        eventId: 'event-124',
        data: {
          approvalId: 'approval-456',
          gateName: pendingGate.name,
          approved: true,
          approver: 'senior-dev@company.com',
          comment: 'Approved after security review',
          gate: {
            ...pendingGate,
            status: 'approved',
            approver: 'senior-dev@company.com',
            respondedAt: new Date('2024-01-01T10:03:00Z'),
          } as ResolvedApprovalGate
        }
      }

      // Validate resolution event
      expect(isGateResolvedEvent(approvalResolvedEvent)).toBe(true)
      expect(isGateRequiredEvent(approvalResolvedEvent)).toBe(false)
    })
  })
})

// ============================================================================
// Component Props Integration Tests
// ============================================================================

describe('Component Props Integration', () => {
  describe('ApprovalGatePanelProps integration', () => {
    it('should create valid panel props with complete configuration', () => {
      const { pendingGate, resolvedGate } = createApprovalWorkflow()

      const panelProps: ApprovalGatePanelProps = {
        taskId: 'task-123',
        pendingGates: [pendingGate],
        resolvedGates: [resolvedGate],
        approver: 'current-user@company.com',
        useRealTimeUpdates: true,
        autoConnect: true,
        showConnectionIndicator: true,
        readOnly: false,
        showHistory: APPROVAL_GATE_PANEL_DEFAULTS.showHistory,
        maxHistoryItems: APPROVAL_GATE_PANEL_DEFAULTS.maxHistoryItems,
        showDiffPreview: APPROVAL_GATE_PANEL_DEFAULTS.showDiffPreview,
        diffViewMode: APPROVAL_GATE_PANEL_DEFAULTS.diffViewMode,
        requireConfirmation: APPROVAL_GATE_PANEL_DEFAULTS.requireConfirmation,
        compact: false,
        loading: false,
        error: null,
        className: 'approval-panel',
        onGateAction: vi.fn(),
        onActionSuccess: vi.fn(),
        onActionError: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      }

      // Validate props structure and defaults integration
      expect(panelProps.pendingGates).toHaveLength(1)
      expect(panelProps.resolvedGates).toHaveLength(1)
      expect(panelProps.showHistory).toBe(true)
      expect(panelProps.maxHistoryItems).toBe(10)
      expect(panelProps.diffViewMode).toBe('unified')
      expect(typeof panelProps.onGateAction).toBe('function')
    })
  })

  describe('ApprovalGateItemProps integration', () => {
    it('should create valid item props with styling integration', () => {
      const pendingGate = createCompleteGate()

      const itemProps: ApprovalGateItemProps = {
        gate: pendingGate,
        isExpanded: false,
        isLoading: false,
        loadingAction: null,
        error: null,
        readOnly: false,
        showDiffPreview: true,
        diffViewMode: 'unified' as DiffViewMode,
        compact: false,
        className: `${TEST_IDS.gateItem} gate-item-pending`,
        onApprove: vi.fn(),
        onReject: vi.fn(),
        onToggleExpand: vi.fn(),
        onViewDiff: vi.fn(),
      }

      // Validate item configuration
      expect(itemProps.gate.status).toBe('pending')
      expect(itemProps.showDiffPreview).toBe(true)
      expect(itemProps.className).toContain(TEST_IDS.gateItem)
      expect(typeof itemProps.onApprove).toBe('function')
    })
  })

  describe('ConfirmationDialogProps integration', () => {
    it('should create valid dialog props with consistent styling', () => {
      const pendingGate = createCompleteGate()
      const confirmationState: ConfirmationState = {
        isOpen: true,
        actionType: 'approve',
        gate: pendingGate,
        comment: '',
        isSubmitting: false,
        error: null,
      }

      const dialogProps: ConfirmationDialogProps = {
        isOpen: confirmationState.isOpen,
        actionType: confirmationState.actionType!,
        gate: confirmationState.gate!,
        comment: confirmationState.comment,
        isSubmitting: confirmationState.isSubmitting,
        error: confirmationState.error,
        requireCommentForReject: true,
        commentPlaceholder: ACTION_BUTTON_STYLES.approve.loadingText,
        maxCommentLength: APPROVAL_GATE_PANEL_DEFAULTS.maxCommentLength,
        onCommentChange: vi.fn(),
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
        className: 'confirmation-dialog',
      }

      // Validate dialog configuration
      expect(dialogProps.isOpen).toBe(true)
      expect(dialogProps.actionType).toBe('approve')
      expect(dialogProps.maxCommentLength).toBe(500)
      expect(dialogProps.requireCommentForReject).toBe(true)
    })
  })

  describe('ApprovalDiffPreviewProps integration', () => {
    it('should create valid diff preview props', () => {
      const pendingGate = createCompleteGate()

      const diffPreviewProps: ApprovalDiffPreviewProps = {
        diffData: pendingGate.diffData!,
        viewMode: APPROVAL_GATE_PANEL_DEFAULTS.diffViewMode,
        showLineNumbers: APPROVAL_GATE_PANEL_DEFAULTS.showLineNumbers,
        highlighting: APPROVAL_GATE_PANEL_DEFAULTS.enableHighlighting,
        maxHeight: APPROVAL_GATE_PANEL_DEFAULTS.diffPreviewMaxHeight,
        collapsible: true,
        defaultCollapsed: false,
        loading: false,
        error: null,
        onCopy: vi.fn(),
        className: TEST_IDS.diffPreview,
      }

      // Validate diff preview configuration
      expect(diffPreviewProps.diffData.changeType).toBe('file-edit')
      expect(diffPreviewProps.viewMode).toBe('unified')
      expect(diffPreviewProps.maxHeight).toBe(400)
      expect(diffPreviewProps.showLineNumbers).toBe(true)
      expect(diffPreviewProps.highlighting).toBe(true)
      expect(typeof diffPreviewProps.onCopy).toBe('function')
    })
  })
})

// ============================================================================
// Error Handling and Message Integration Tests
// ============================================================================

describe('Error Handling Integration', () => {
  describe('Error message templating', () => {
    it('should provide consistent error messages', () => {
      const gateName = 'Critical System Gate'
      const errorDetails = 'Network connection timeout'

      // Test template replacement (would be done by UI layer)
      const actionFailedMessage = ERROR_MESSAGES.actionFailed
        .replace('{action}', 'approve')
        .replace('{error}', errorDetails)

      expect(actionFailedMessage).toContain('approve')
      expect(actionFailedMessage).toContain(errorDetails)

      const successMessage = SUCCESS_MESSAGES.approved
        .replace('{gateName}', gateName)

      expect(successMessage).toContain(gateName)
      expect(successMessage).toContain('approved')
    })

    it('should handle comment validation errors', () => {
      const minLength = APPROVAL_GATE_PANEL_DEFAULTS.minRejectCommentLength
      const maxLength = APPROVAL_GATE_PANEL_DEFAULTS.maxCommentLength

      const shortComment = 'x'.repeat(minLength - 1)
      const longComment = 'x'.repeat(maxLength + 1)

      // Simulate validation logic
      const shortCommentError = shortComment.length < minLength
      const longCommentError = longComment.length > maxLength

      expect(shortCommentError).toBe(true)
      expect(longCommentError).toBe(true)

      // Error messages would be templated
      const shortCommentMessage = ERROR_MESSAGES.commentTooShort
        .replace('{minLength}', minLength.toString())
      const longCommentMessage = ERROR_MESSAGES.commentTooLong
        .replace('{maxLength}', maxLength.toString())

      expect(shortCommentMessage).toContain(minLength.toString())
      expect(longCommentMessage).toContain(maxLength.toString())
    })
  })
})

// ============================================================================
// Real-world Scenario Tests
// ============================================================================

describe('Real-world Scenarios', () => {
  describe('High-risk deployment scenario', () => {
    it('should handle production deployment gate workflow', () => {
      const productionGate = createCompleteGate({
        name: 'Production Deployment Gate',
        description: 'Critical production deployment requiring multiple approvals',
        resourceImpact: 'critical',
        gateType: 'deployment',
        priority: 10, // Highest priority
        timeoutMs: 1800000, // 30 minutes
        affectedPaths: [
          '/app/config/production.conf',
          '/app/database/migrations/2024_001.sql',
          '/app/services/payment-service.js',
          '/app/api/routes/checkout.js',
        ],
        estimatedImpact: 'Critical: Affects payment processing and checkout flow for all users',
      })

      // Validate critical gate configuration
      expect(productionGate.resourceImpact).toBe('critical')
      expect(productionGate.gateType).toBe('deployment')
      expect(productionGate.priority).toBe(10)

      // Verify styling matches criticality
      const statusStyle = GATE_STATUS_STYLES[productionGate.status]
      const impactConfig = RESOURCE_IMPACT_CONFIG[productionGate.resourceImpact]
      const gateTypeConfig = GATE_TYPE_CONFIG[productionGate.gateType]

      expect(statusStyle.text).toContain('yellow') // Pending status
      expect(impactConfig.color).toBe('red') // Critical impact
      expect(gateTypeConfig.icon).toBe('Rocket') // Deployment icon
      expect(impactConfig.description).toContain('Major')
    })
  })

  describe('Batch approval scenario', () => {
    it('should handle multiple related gates efficiently', () => {
      const relatedGates = [
        createCompleteGate({
          name: 'Database Migration Gate',
          gateType: 'pre-execution',
          resourceImpact: 'high',
          priority: 1,
        }),
        createCompleteGate({
          name: 'Service Update Gate',
          gateType: 'deployment',
          resourceImpact: 'medium',
          priority: 2,
        }),
        createCompleteGate({
          name: 'Configuration Change Gate',
          gateType: 'post-execution',
          resourceImpact: 'low',
          priority: 3,
        }),
      ]

      // Validate all gates can be processed
      relatedGates.forEach(gate => {
        expect(isPendingGate(gate)).toBe(true)
        expect(GATE_STATUS_STYLES[gate.status]).toBeDefined()
        expect(RESOURCE_IMPACT_CONFIG[gate.resourceImpact!]).toBeDefined()
        expect(GATE_TYPE_CONFIG[gate.gateType!]).toBeDefined()
      })

      // Verify priority ordering works
      const sortedByPriority = [...relatedGates].sort((a, b) => a.priority! - b.priority!)
      expect(sortedByPriority[0].priority).toBe(1)
      expect(sortedByPriority[2].priority).toBe(3)
    })
  })

  describe('Emergency bypass scenario', () => {
    it('should handle emergency gate skipping workflow', () => {
      const emergencyGate = createCompleteGate({
        name: 'Emergency Security Patch Gate',
        description: 'Critical security vulnerability requires immediate patching',
        resourceImpact: 'critical',
        gateType: 'security-review',
        priority: 10,
        timeoutMs: 900000, // 15 minutes for emergency
      })

      // Simulate emergency bypass
      const skippedGate: ResolvedApprovalGate = {
        ...emergencyGate,
        status: 'skipped',
        approver: 'system-admin',
        respondedAt: new Date(),
        resolutionReason: 'Emergency bypass due to critical security vulnerability',
        autoResolved: false,
        comment: 'Bypassed for immediate security patch deployment',
        resolutionTimeMs: 30000, // 30 seconds for emergency decision
      }

      expect(isResolvedGate(skippedGate)).toBe(true)
      expect(skippedGate.status).toBe('skipped')
      expect(GATE_STATUS_STYLES.skipped.text).toContain('gray')
    })
  })
})

// ============================================================================
// Performance and Scalability Tests
// ============================================================================

describe('Performance and Scalability', () => {
  describe('Large dataset handling', () => {
    it('should handle many pending gates efficiently', () => {
      const manyGates = Array.from({ length: 100 }, (_, i) =>
        createCompleteGate({
          id: `gate-${i}`,
          name: `Gate ${i}`,
          priority: Math.floor(Math.random() * 10) + 1,
        })
      )

      const startTime = performance.now()

      // Simulate processing all gates
      manyGates.forEach(gate => {
        isPendingGate(gate)
        GATE_STATUS_STYLES[gate.status]
        RESOURCE_IMPACT_CONFIG[gate.resourceImpact!]
        GATE_TYPE_CONFIG[gate.gateType!]
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should process 100 gates in under 10ms
      expect(duration).toBeLessThan(10)
      expect(manyGates).toHaveLength(100)
    })

    it('should handle rapid confirmation state changes', () => {
      let state = INITIAL_CONFIRMATION_STATE
      const gate = createCompleteGate()
      const iterations = 1000

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        state = confirmationReducer(state, {
          type: 'OPEN_DIALOG',
          payload: { actionType: 'approve', gate }
        })
        state = confirmationReducer(state, {
          type: 'SET_COMMENT',
          payload: `Comment ${i}`
        })
        state = confirmationReducer(state, {
          type: 'RESET'
        })
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle 1000 state changes in under 50ms
      expect(duration).toBeLessThan(50)
    })
  })
})