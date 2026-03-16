'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ApprovalDiffPreview } from './ApprovalDiffPreview'
import {
  GATE_STATUS_STYLES,
  GATE_TYPE_CONFIG,
  RESOURCE_IMPACT_CONFIG,
  ACTION_BUTTON_STYLES,
  LAYOUT_SPACING,
  ARIA_LABELS,
  TEST_IDS,
  APPROVAL_GATE_PANEL_DEFAULTS,
} from '@/types/approval-gate-panel-constants'
import type {
  ApprovalGateItemProps,
  PendingApprovalGate,
} from '@/types/approval-gate-panel'
import type { DiffViewMode } from '@/components/diff/types'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldX,
  Eye,
  FileText,
  Calendar,
  Target,
  Zap,
} from 'lucide-react'

/**
 * Individual approval gate item component
 *
 * Displays a pending gate with:
 * - Gate header with type, priority, and resource impact indicators
 * - Gate details including description and timeout countdown
 * - Expandable diff preview (if available)
 * - Action buttons for approve/reject
 * - Loading and error states
 */
export function ApprovalGateItem({
  gate,
  isExpanded = false,
  isLoading = false,
  loadingAction = null,
  error = null,
  onApprove,
  onReject,
  onToggleExpand,
  onViewDiff,
  readOnly = false,
  showDiffPreview = APPROVAL_GATE_PANEL_DEFAULTS.showDiffPreview,
  diffViewMode = APPROVAL_GATE_PANEL_DEFAULTS.diffViewMode,
  compact = false,
  className,
}: ApprovalGateItemProps) {
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [internalExpanded, setInternalExpanded] = useState(isExpanded)

  const expanded = isExpanded !== undefined ? isExpanded : internalExpanded

  // Sync external isExpanded prop to internal state
  useEffect(() => {
    if (isExpanded !== undefined) {
      setInternalExpanded(isExpanded)
    }
  }, [isExpanded])

  // Get configuration for gate type and resource impact
  const gateTypeConfig = gate.gateType ? GATE_TYPE_CONFIG[gate.gateType] : null
  const resourceImpactConfig = gate.resourceImpact
    ? RESOURCE_IMPACT_CONFIG[gate.resourceImpact]
    : null

  /**
   * Calculate timeout status with live updates
   */
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Update time every second for live countdown
  useEffect(() => {
    if (!gate.timeoutAt) return

    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [gate.timeoutAt])

  const timeoutInfo = useMemo(() => {
    if (!gate.timeoutAt) return null

    const timeoutTime = new Date(gate.timeoutAt).getTime()
    const remainingMs = timeoutTime - currentTime

    if (remainingMs <= 0) {
      return {
        status: 'expired' as const,
        label: 'Expired',
        className: 'text-red-500',
      }
    }

    const remainingMinutes = Math.floor(remainingMs / 60000)
    const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)
    const isUrgent = remainingMs < APPROVAL_GATE_PANEL_DEFAULTS.timeoutWarningThreshold

    return {
      status: isUrgent ? 'urgent' : 'normal' as const,
      label: remainingMinutes > 0
        ? `${remainingMinutes}m ${remainingSeconds}s`
        : `${remainingSeconds}s`,
      className: isUrgent ? 'text-orange-500' : 'text-foreground-secondary',
    }
  }, [gate.timeoutAt, currentTime])

  /**
   * Handle expand/collapse toggle
   */
  const handleToggle = () => {
    const newExpanded = !expanded
    setInternalExpanded(newExpanded)
    onToggleExpand?.()
  }

  /**
   * Handle approve action
   */
  const handleApprove = async () => {
    try {
      await onApprove?.(comment || undefined)
      setComment('')
      setShowComment(false)
    } catch (err) {
      // Error handling is done by parent component
    }
  }

  /**
   * Handle reject action
   */
  const handleReject = async () => {
    if (!comment.trim()) {
      // Show comment input if not already visible
      setShowComment(true)
      return
    }

    try {
      await onReject?.(comment)
      setComment('')
      setShowComment(false)
    } catch (err) {
      // Error handling is done by parent component
    }
  }

  const isApproveLoading = isLoading && loadingAction === 'approve'
  const isRejectLoading = isLoading && loadingAction === 'reject'

  return (
    <Card
      className={cn(
        'border transition-all duration-200',
        GATE_STATUS_STYLES.pending.border,
        GATE_STATUS_STYLES.pending.bg,
        expanded && 'ring-2 ring-yellow-500/20',
        className
      )}
      data-testid={TEST_IDS.gateItem}
    >
      {/* Header */}
      <CardContent className={cn(LAYOUT_SPACING.itemPadding, compact && LAYOUT_SPACING.compactItemPadding, 'pb-0')}>
        <div className="flex items-start justify-between gap-4">
          {/* Gate info */}
          <div className="flex-1 min-w-0">
            {/* Title and type */}
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                'p-1.5 rounded-md',
                GATE_STATUS_STYLES.pending.bg
              )}>
                <AlertTriangle className={cn(
                  'w-4 h-4',
                  GATE_STATUS_STYLES.pending.icon
                )} />
              </div>
              <div className="flex-1">
                <h3 className={cn(
                  'font-semibold text-foreground',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {gate.name}
                </h3>
                {gate.taskId && (
                  <p className="text-xs text-foreground-secondary truncate">
                    Task: {gate.taskId}
                  </p>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Gate type badge */}
              {gateTypeConfig && (
                <Badge variant="default" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  {gateTypeConfig.label}
                </Badge>
              )}

              {/* Resource impact badge */}
              {resourceImpactConfig && (
                <Badge
                  variant={resourceImpactConfig.level === 'critical' ? 'error' : 'warning'}
                  className="text-xs"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {resourceImpactConfig.label}
                </Badge>
              )}

              {/* Priority badge */}
              {gate.priority !== undefined && (
                <Badge
                  variant={gate.priority > 5 ? 'error' : 'info'}
                  className="text-xs"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Priority {gate.priority}
                </Badge>
              )}

              {/* Timeout badge */}
              {timeoutInfo && (
                <Badge
                  variant={timeoutInfo.status === 'expired' ? 'error' : timeoutInfo.status === 'urgent' ? 'warning' : 'default'}
                  className="text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {timeoutInfo.label}
                </Badge>
              )}
            </div>

            {/* Description */}
            {gate.description && (
              <p className={cn(
                'text-foreground-secondary',
                compact ? 'text-xs' : 'text-sm'
              )}>
                {gate.description}
              </p>
            )}
          </div>

          {/* Expand/collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="px-2 py-1 h-auto"
            aria-label={expanded ? ARIA_LABELS.collapseButton : ARIA_LABELS.expandButton}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Additional details */}
            {(gate.estimatedImpact || gate.affectedPaths) && (
              <div className="bg-background-tertiary rounded-md p-3 space-y-2">
                {gate.estimatedImpact && (
                  <div>
                    <p className="text-xs font-medium text-foreground-secondary mb-1">
                      Estimated Impact
                    </p>
                    <p className="text-sm text-foreground">{gate.estimatedImpact}</p>
                  </div>
                )}

                {gate.affectedPaths && gate.affectedPaths.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-foreground-secondary mb-1">
                      Affected Paths ({gate.affectedPaths.length})
                    </p>
                    <div className="space-y-1">
                      {gate.affectedPaths.slice(0, 3).map((path, index) => (
                        <p key={index} className="text-xs text-foreground-secondary font-mono">
                          {path}
                        </p>
                      ))}
                      {gate.affectedPaths.length > 3 && (
                        <p className="text-xs text-foreground-secondary">
                          + {gate.affectedPaths.length - 3} more files
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Diff preview */}
            {showDiffPreview && gate.diffData && (
              <ApprovalDiffPreview
                diffData={gate.diffData}
                viewMode={diffViewMode}
                collapsible
                defaultCollapsed={compact}
                maxHeight={APPROVAL_GATE_PANEL_DEFAULTS.diffPreviewMaxHeight}
              />
            )}

            {/* Error display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {/* Comment section */}
            {(showComment || comment) && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground-secondary">
                  Comment {!showComment && '(optional)'}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your feedback or notes..."
                  className="w-full px-3 py-2 text-sm bg-background-tertiary rounded-md border border-border focus:border-apex-500 focus:outline-none resize-none"
                  rows={3}
                  maxLength={APPROVAL_GATE_PANEL_DEFAULTS.maxCommentLength}
                  data-testid={TEST_IDS.commentInput}
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-foreground-secondary">
                    {comment.length} / {APPROVAL_GATE_PANEL_DEFAULTS.maxCommentLength} characters
                  </p>
                  {showComment && !comment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowComment(false)}
                      className="text-xs px-2 py-1 h-auto"
                    >
                      Hide
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Actions */}
      {!readOnly && (
        <CardFooter className={cn(
          'gap-3 pt-4',
          compact ? 'px-3 pb-3' : 'px-4 pb-4'
        )}>
          {/* Show comment button */}
          {!expanded && !showComment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComment(true)}
              className="px-3"
            >
              <Eye className="w-4 h-4 mr-2" />
              Add comment
            </Button>
          )}

          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="danger"
              size={compact ? 'sm' : 'md'}
              onClick={handleReject}
              disabled={isLoading}
              className="flex-1 sm:flex-initial"
              data-testid={TEST_IDS.rejectButton}
            >
              {isRejectLoading ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <ShieldX className="w-4 h-4 mr-2" />
              )}
              {ACTION_BUTTON_STYLES.reject.loadingText && isRejectLoading
                ? 'Rejecting...'
                : 'Reject'}
            </Button>

            <Button
              variant="primary"
              size={compact ? 'sm' : 'md'}
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 sm:flex-initial"
              data-testid={TEST_IDS.approveButton}
            >
              {isApproveLoading ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              {ACTION_BUTTON_STYLES.approve.loadingText && isApproveLoading
                ? 'Approving...'
                : 'Approve'}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}