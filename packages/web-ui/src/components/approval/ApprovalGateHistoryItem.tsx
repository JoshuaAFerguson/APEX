'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  GATE_STATUS_STYLES,
  GATE_STATUS_LABELS,
  GATE_STATUS_ICONS,
  LAYOUT_SPACING,
} from '@/types/approval-gate-panel-constants'
import type { ApprovalGateHistoryItemProps } from '@/types/approval-gate-panel'
import { cn } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Timer,
} from 'lucide-react'

/**
 * Icon mapping for gate statuses
 */
const STATUS_ICON_MAP = {
  approved: CheckCircle,
  rejected: XCircle,
  skipped: MinusCircle,
  timeout: Clock,
} as const

/**
 * History item component for resolved approval gates
 *
 * Displays resolved gate information including:
 * - Gate name and status with appropriate styling
 * - Approver and resolution timestamp
 * - Comment (if provided)
 * - Resolution time
 * - Compact mode for space-efficient display
 */
export function ApprovalGateHistoryItem({
  gate,
  showDetails = true,
  compact = false,
  className,
}: ApprovalGateHistoryItemProps) {
  /**
   * Calculate resolution time display
   */
  const resolutionTimeInfo = useMemo(() => {
    if (!gate.resolutionTimeMs) return null

    const seconds = Math.floor(gate.resolutionTimeMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }, [gate.resolutionTimeMs])

  /**
   * Format timestamp for display
   */
  const formattedTimestamp = useMemo(() => {
    const date = new Date(gate.respondedAt)
    if (compact) {
      return date.toLocaleDateString()
    }
    return date.toLocaleString()
  }, [gate.respondedAt, compact])

  const statusStyles = GATE_STATUS_STYLES[gate.status]
  const StatusIcon = STATUS_ICON_MAP[gate.status as keyof typeof STATUS_ICON_MAP] || CheckCircle

  return (
    <Card
      className={cn(
        'border transition-colors',
        statusStyles.border,
        statusStyles.bg,
        compact ? 'hover:bg-opacity-80' : 'hover:bg-opacity-70',
        className
      )}
    >
      <CardContent className={cn(
        compact ? LAYOUT_SPACING.compactItemPadding : LAYOUT_SPACING.itemPadding
      )}>
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className={cn(
            'p-1.5 rounded-md flex-shrink-0',
            statusStyles.bg
          )}>
            <StatusIcon className={cn(
              'w-4 h-4',
              statusStyles.icon
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className={cn(
                  'font-medium text-foreground truncate',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {gate.name}
                </h4>
                {gate.taskId && (
                  <p className="text-xs text-foreground-secondary truncate">
                    Task: {gate.taskId}
                  </p>
                )}
              </div>

              {/* Status badge */}
              <Badge
                variant={gate.status === 'approved' ? 'success' : gate.status === 'rejected' ? 'error' : 'default'}
                className={cn('text-xs', compact && 'px-2 py-0')}
              >
                {GATE_STATUS_LABELS[gate.status]}
              </Badge>
            </div>

            {/* Details row */}
            <div className="flex items-center flex-wrap gap-3 text-xs text-foreground-secondary">
              {/* Approver */}
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{gate.approver}</span>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formattedTimestamp}</span>
              </div>

              {/* Resolution time */}
              {resolutionTimeInfo && (
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  <span>Resolved in {resolutionTimeInfo}</span>
                </div>
              )}

              {/* Auto-resolved indicator */}
              {gate.autoResolved && (
                <Badge variant="default" className="text-xs px-1.5 py-0">
                  Auto
                </Badge>
              )}
            </div>

            {/* Comment */}
            {showDetails && gate.comment && (
              <div className="mt-3 p-2 bg-background-tertiary rounded-md">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3 h-3 text-foreground-secondary mt-0.5 flex-shrink-0" />
                  <p className={cn(
                    'text-foreground-secondary',
                    compact ? 'text-xs' : 'text-sm'
                  )}>
                    {gate.comment}
                  </p>
                </div>
              </div>
            )}

            {/* Resolution reason (for skipped/timeout) */}
            {showDetails && gate.resolutionReason && gate.status !== 'approved' && gate.status !== 'rejected' && (
              <div className="mt-2">
                <p className={cn(
                  'text-foreground-secondary italic',
                  compact ? 'text-xs' : 'text-sm'
                )}>
                  Reason: {gate.resolutionReason}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}