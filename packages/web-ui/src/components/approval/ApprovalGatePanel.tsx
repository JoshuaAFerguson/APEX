'use client'

import { useState, useMemo, useReducer, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useApprovalGateWebSocket } from './hooks/useApprovalGateWebSocket'
import { ApprovalGatePanelHeader } from './ApprovalGatePanelHeader'
import { ApprovalGateItem } from './ApprovalGateItem'
import { ApprovalGateHistoryItem } from './ApprovalGateHistoryItem'
import { ApprovalConfirmationDialog } from './ApprovalConfirmationDialog'
import { confirmationReducer, INITIAL_CONFIRMATION_STATE } from '@/types/approval-gate-panel'
import {
  APPROVAL_GATE_PANEL_DEFAULTS,
  GATE_STATUS_STYLES,
  LAYOUT_SPACING,
  ARIA_LABELS,
  TEST_IDS,
  ERROR_MESSAGES,
} from '@/types/approval-gate-panel-constants'
import type {
  ApprovalGatePanelProps,
  PendingApprovalGate,
  ResolvedApprovalGate,
  ConfirmationAction,
} from '@/types/approval-gate-panel'
import { CheckCircle, History, AlertTriangle, Loader2 } from 'lucide-react'

/**
 * Filter and sort state for the panel
 */
interface FilterState {
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'timeout' | 'skipped'
  taskId: string | null
  gateType: PendingApprovalGate['gateType'] | null
  resourceImpact: PendingApprovalGate['resourceImpact'] | null
  searchQuery: string
}

interface SortState {
  field: 'requiredAt' | 'priority' | 'taskId' | 'name'
  direction: 'asc' | 'desc'
}

/**
 * Main ApprovalGatePanel component
 *
 * Provides comprehensive approval gate management with:
 * - Real-time WebSocket updates
 * - Pending gates list with approval/rejection actions
 * - Collapsible history section for resolved gates
 * - Filter and sort capabilities
 * - Connection status indicator
 * - Loading and error state handling
 */
export function ApprovalGatePanel({
  taskId,
  pendingGates: initialPendingGates = [],
  resolvedGates: initialResolvedGates = [],
  approver,
  useRealTimeUpdates = true,
  autoConnect = true,
  showConnectionIndicator = true,
  onGateAction,
  onActionSuccess,
  onActionError,
  onGateReceived,
  onGateResolved,
  readOnly = false,
  showHistory = APPROVAL_GATE_PANEL_DEFAULTS.showHistory,
  maxHistoryItems = APPROVAL_GATE_PANEL_DEFAULTS.maxHistoryItems,
  showDiffPreview = APPROVAL_GATE_PANEL_DEFAULTS.showDiffPreview,
  diffViewMode = APPROVAL_GATE_PANEL_DEFAULTS.diffViewMode,
  requireConfirmation = APPROVAL_GATE_PANEL_DEFAULTS.requireConfirmation,
  compact = false,
  loading: externalLoading = false,
  error: externalError = null,
  className,
}: ApprovalGatePanelProps) {
  // State management
  const [filterState, setFilterState] = useState<FilterState>({
    status: 'all',
    taskId: null,
    gateType: null,
    resourceImpact: null,
    searchQuery: '',
  })

  const [sortState, setSortState] = useState<SortState>({
    field: 'requiredAt',
    direction: 'desc',
  })

  const [historyExpanded, setHistoryExpanded] = useState(!compact)
  const [confirmationState, confirmationDispatch] = useReducer(
    confirmationReducer,
    INITIAL_CONFIRMATION_STATE
  )

  // WebSocket integration
  const {
    pendingGates: wsPendingGates,
    resolvedGates: wsResolvedGates,
    isConnected,
    connectionStatus,
    isLoading: wsLoading,
    error: wsError,
    approveGate,
    rejectGate,
    refresh,
    onGateReceived: registerGateReceived,
    onGateResolved: registerGateResolved,
  } = useApprovalGateWebSocket({
    taskId,
    autoConnect: useRealTimeUpdates && autoConnect,
    initialPendingGates,
    initialResolvedGates,
  })

  // Use WebSocket data if real-time updates are enabled, otherwise use props
  const pendingGates = useRealTimeUpdates ? wsPendingGates : initialPendingGates
  const resolvedGates = useRealTimeUpdates ? wsResolvedGates : initialResolvedGates
  const isLoading = useRealTimeUpdates ? wsLoading : externalLoading
  const error = useRealTimeUpdates ? wsError : externalError

  // Register external callbacks
  useEffect(() => {
    if (onGateReceived) {
      registerGateReceived(onGateReceived)
    }
    if (onGateResolved) {
      registerGateResolved(onGateResolved)
    }
  }, [onGateReceived, onGateResolved, registerGateReceived, registerGateResolved])

  /**
   * Filter and sort pending gates
   */
  const filteredAndSortedPendingGates = useMemo(() => {
    let filtered = [...pendingGates]

    // Apply filters
    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase()
      filtered = filtered.filter(
        gate =>
          gate.name.toLowerCase().includes(query) ||
          gate.description?.toLowerCase().includes(query) ||
          gate.taskId.toLowerCase().includes(query)
      )
    }

    if (filterState.taskId) {
      filtered = filtered.filter(gate => gate.taskId === filterState.taskId)
    }

    if (filterState.gateType) {
      filtered = filtered.filter(gate => gate.gateType === filterState.gateType)
    }

    if (filterState.resourceImpact) {
      filtered = filtered.filter(gate => gate.resourceImpact === filterState.resourceImpact)
    }

    // Sort gates
    return filtered.sort((a, b) => {
      const direction = sortState.direction === 'asc' ? 1 : -1

      switch (sortState.field) {
        case 'priority':
          return ((b.priority || 0) - (a.priority || 0)) * direction
        case 'taskId':
          return a.taskId.localeCompare(b.taskId) * direction
        case 'name':
          return a.name.localeCompare(b.name) * direction
        case 'requiredAt':
        default:
          return (new Date(b.requiredAt).getTime() - new Date(a.requiredAt).getTime()) * direction
      }
    })
  }, [pendingGates, filterState, sortState])

  /**
   * Filter and sort resolved gates
   */
  const filteredAndSortedResolvedGates = useMemo(() => {
    let filtered = [...resolvedGates]

    // Apply filters
    if (filterState.status !== 'all' && filterState.status !== 'pending') {
      filtered = filtered.filter(gate => gate.status === filterState.status)
    }

    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase()
      filtered = filtered.filter(
        gate =>
          gate.name.toLowerCase().includes(query) ||
          gate.taskId.toLowerCase().includes(query) ||
          gate.approver.toLowerCase().includes(query)
      )
    }

    if (filterState.taskId) {
      filtered = filtered.filter(gate => gate.taskId === filterState.taskId)
    }

    // Sort by most recent first by default
    filtered.sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime())

    // Limit to maxHistoryItems
    return filtered.slice(0, maxHistoryItems)
  }, [resolvedGates, filterState, maxHistoryItems])

  /**
   * Handle gate approval
   */
  const handleApprove = useCallback(
    async (gate: PendingApprovalGate, comment?: string) => {
      try {
        if (requireConfirmation) {
          confirmationDispatch({
            type: 'OPEN_DIALOG',
            payload: { actionType: 'approve', gate },
          })
          return
        }

        // Direct approval without confirmation
        await approveGate(gate.id, comment)
        onGateAction?.(gate, 'approve', comment)
        onActionSuccess?.(gate, 'approve')
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to approve gate')
        onActionError?.(gate, 'approve', error)
      }
    },
    [requireConfirmation, approveGate, onGateAction, onActionSuccess, onActionError]
  )

  /**
   * Handle gate rejection
   */
  const handleReject = useCallback(
    async (gate: PendingApprovalGate, comment?: string) => {
      try {
        if (requireConfirmation) {
          confirmationDispatch({
            type: 'OPEN_DIALOG',
            payload: { actionType: 'reject', gate },
          })
          return
        }

        // Direct rejection without confirmation
        if (!comment) {
          throw new Error('Comment is required for rejection')
        }
        await rejectGate(gate.id, comment)
        onGateAction?.(gate, 'reject', comment)
        onActionSuccess?.(gate, 'reject')
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to reject gate')
        onActionError?.(gate, 'reject', error)
      }
    },
    [requireConfirmation, rejectGate, onGateAction, onActionSuccess, onActionError]
  )

  /**
   * Handle confirmation dialog submit
   */
  const handleConfirmationSubmit = async () => {
    if (!confirmationState.gate) return

    try {
      confirmationDispatch({ type: 'SUBMIT_START' })

      if (confirmationState.actionType === 'approve') {
        await approveGate(confirmationState.gate.id, confirmationState.comment || undefined)
        onGateAction?.(confirmationState.gate, 'approve', confirmationState.comment || undefined)
        onActionSuccess?.(confirmationState.gate, 'approve')
      } else if (confirmationState.actionType === 'reject') {
        if (!confirmationState.comment.trim()) {
          throw new Error('Comment is required for rejection')
        }
        await rejectGate(confirmationState.gate.id, confirmationState.comment)
        onGateAction?.(confirmationState.gate, 'reject', confirmationState.comment)
        onActionSuccess?.(confirmationState.gate, 'reject')
      }

      confirmationDispatch({ type: 'SUBMIT_SUCCESS' })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit action')
      confirmationDispatch({ type: 'SUBMIT_ERROR', payload: error.message })
      onActionError?.(confirmationState.gate, confirmationState.actionType || 'approve', error)
    }
  }

  const displayError = error || externalError
  const displayLoading = isLoading || externalLoading

  return (
    <div className={cn('space-y-4', className)} data-testid={TEST_IDS.panel}>
      {/* Header with filters and connection indicator */}
      <ApprovalGatePanelHeader
        pendingCount={filteredAndSortedPendingGates.length}
        connectionStatus={useRealTimeUpdates ? connectionStatus : 'disconnected'}
        showConnectionIndicator={showConnectionIndicator && useRealTimeUpdates}
        filterState={filterState}
        sortState={sortState}
        onFilterChange={setFilterState}
        onSortChange={setSortState}
        onRefresh={refresh}
        compact={compact}
      />

      {/* Error display */}
      {displayError && (
        <Card className="border-red-500/50 bg-red-500/5">
          <div className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-400">Error</p>
              <p className="text-sm text-red-300">
                {displayError instanceof Error ? displayError.message : String(displayError)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading indicator */}
      {displayLoading && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <div className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-400">Loading approval gates...</p>
          </div>
        </Card>
      )}

      {/* Pending gates section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3" aria-label={ARIA_LABELS.pendingSection}>
          Pending Approvals
          {filteredAndSortedPendingGates.length > 0 && (
            <span className="ml-2 text-sm font-normal text-foreground-secondary">
              ({filteredAndSortedPendingGates.length})
            </span>
          )}
        </h2>

        {/* Pending gates list */}
        <div className={cn('space-y-3', compact && 'space-y-2')} data-testid={TEST_IDS.pendingList}>
          {filteredAndSortedPendingGates.length > 0 ? (
            filteredAndSortedPendingGates.map(gate => (
              <ApprovalGateItem
                key={gate.id}
                gate={gate}
                onApprove={comment => handleApprove(gate, comment)}
                onReject={comment => handleReject(gate, comment)}
                readOnly={readOnly}
                showDiffPreview={showDiffPreview}
                diffViewMode={diffViewMode}
                compact={compact}
                isLoading={confirmationState.gate?.id === gate.id && confirmationState.isSubmitting}
                loadingAction={
                  confirmationState.gate?.id === gate.id ? confirmationState.actionType : null
                }
              />
            ))
          ) : (
            <Card className={cn('border-dashed border-2', GATE_STATUS_STYLES.approved.border)}>
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Pending Approvals</h3>
                <p className="text-sm text-foreground-secondary max-w-sm mx-auto">
                  All gates have been resolved. New gates requiring approval will appear here.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* History section */}
      {showHistory && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground" aria-label={ARIA_LABELS.historySection}>
              History
              {filteredAndSortedResolvedGates.length > 0 && (
                <span className="ml-2 text-sm font-normal text-foreground-secondary">
                  ({filteredAndSortedResolvedGates.length})
                </span>
              )}
            </h2>
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
              aria-label={historyExpanded ? ARIA_LABELS.collapseButton : ARIA_LABELS.expandButton}
            >
              {historyExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {historyExpanded && (
            <div className={cn('space-y-2', compact && 'space-y-1')} data-testid={TEST_IDS.historyList}>
              {filteredAndSortedResolvedGates.length > 0 ? (
                filteredAndSortedResolvedGates.map(gate => (
                  <ApprovalGateHistoryItem
                    key={gate.id}
                    gate={gate}
                    showDetails={!compact}
                    compact={compact}
                  />
                ))
              ) : (
                <Card className="border-dashed border-2 border-border">
                  <div className="p-6 text-center">
                    <History className="w-8 h-8 text-foreground-secondary mx-auto mb-2" />
                    <p className="text-sm text-foreground-secondary">No resolved gates yet</p>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation dialog */}
      {requireConfirmation && (
        <ApprovalConfirmationDialog
          isOpen={confirmationState.isOpen}
          actionType={confirmationState.actionType!}
          gate={confirmationState.gate!}
          comment={confirmationState.comment}
          isSubmitting={confirmationState.isSubmitting}
          error={confirmationState.error}
          onCommentChange={comment =>
            confirmationDispatch({ type: 'SET_COMMENT', payload: comment })
          }
          onConfirm={handleConfirmationSubmit}
          onCancel={() => confirmationDispatch({ type: 'CLOSE_DIALOG' })}
        />
      )}
    </div>
  )
}