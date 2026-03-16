'use client'

import React, { useEffect, useRef } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  CONFIRMATION_DIALOG_DEFAULTS,
  ACTION_BUTTON_STYLES,
  GATE_STATUS_STYLES,
  ARIA_LABELS,
  TEST_IDS,
  KEYBOARD_SHORTCUTS,
} from '@/types/approval-gate-panel-constants'
import type { ConfirmationDialogProps } from '@/types/approval-gate-panel'
import { cn } from '@/lib/utils'
import {
  ShieldCheck,
  ShieldX,
  X,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'

/**
 * Confirmation dialog component for gate approval/rejection actions
 *
 * Features:
 * - Modal overlay with focus trap
 * - Action-specific messaging and styling
 * - Comment input with validation
 * - Loading states and error handling
 * - Keyboard shortcuts (Enter to confirm, Escape to cancel)
 * - Accessibility support
 */
export function ApprovalConfirmationDialog({
  isOpen,
  actionType,
  gate,
  comment,
  isSubmitting = false,
  error = null,
  requireCommentForReject = CONFIRMATION_DIALOG_DEFAULTS.requireCommentForReject,
  commentPlaceholder,
  maxCommentLength = CONFIRMATION_DIALOG_DEFAULTS.maxCommentLength,
  onCommentChange,
  onConfirm,
  onCancel,
  className,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // Get default placeholders based on action type
  const defaultPlaceholder = actionType === 'approve'
    ? CONFIRMATION_DIALOG_DEFAULTS.approvePlaceholder
    : CONFIRMATION_DIALOG_DEFAULTS.rejectPlaceholder

  const finalPlaceholder = commentPlaceholder || defaultPlaceholder

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case KEYBOARD_SHORTCUTS.submit:
          e.preventDefault()
          if (!isSubmitting && (!requireCommentForReject || actionType === 'approve' || comment.trim())) {
            onConfirm()
          }
          break

        case KEYBOARD_SHORTCUTS.cancel:
          e.preventDefault()
          if (!isSubmitting) {
            onCancel()
          }
          break

        default:
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, actionType, comment, requireCommentForReject, onConfirm, onCancel])

  /**
   * Focus management
   */
  useEffect(() => {
    if (isOpen && !isSubmitting) {
      // Focus comment input for reject, confirm button for approve
      const focusTarget = actionType === 'reject' && requireCommentForReject
        ? commentInputRef.current
        : confirmButtonRef.current

      if (focusTarget) {
        // Delay focus to ensure dialog is fully rendered
        setTimeout(() => focusTarget.focus(), 100)
      }
    }
  }, [isOpen, isSubmitting, actionType, requireCommentForReject])

  /**
   * Focus trap within dialog
   */
  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [isOpen])

  // Check if action can be submitted
  const canSubmit = !isSubmitting && (
    actionType === 'approve' ||
    !requireCommentForReject ||
    comment.trim().length > 0
  )

  const isCommentRequired = actionType === 'reject' && requireCommentForReject
  const isCommentTooLong = comment.length > maxCommentLength

  if (!isOpen || !gate) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        {/* Dialog */}
        <div
          ref={dialogRef}
          className={cn(
            'w-full max-w-md bg-background border rounded-lg shadow-xl',
            className
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
          data-testid={TEST_IDS.confirmationDialog}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                actionType === 'approve'
                  ? ACTION_BUTTON_STYLES.approve.bg + ' bg-opacity-20'
                  : ACTION_BUTTON_STYLES.reject.bg + ' bg-opacity-20'
              )}>
                {actionType === 'approve' ? (
                  <ShieldCheck className={cn(
                    'w-5 h-5',
                    actionType === 'approve' ? 'text-green-500' : 'text-red-500'
                  )} />
                ) : (
                  <ShieldX className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div>
                <h2 id="dialog-title" className="text-lg font-semibold text-foreground">
                  {actionType === 'approve' ? 'Approve Gate' : 'Reject Gate'}
                </h2>
                <p className="text-sm text-foreground-secondary">
                  {gate.name}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-2 py-2"
              aria-label={ARIA_LABELS.closeDialogButton}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <CardContent className="p-4 space-y-4">
            {/* Confirmation message */}
            <div id="dialog-description" className="space-y-2">
              <p className="text-sm text-foreground">
                Are you sure you want to{' '}
                <strong className={cn(
                  actionType === 'approve' ? 'text-green-600' : 'text-red-600'
                )}>
                  {actionType}
                </strong>{' '}
                this gate?
              </p>

              {'description' in gate && (gate as any).description && (
                <p className="text-sm text-foreground-secondary">
                  {(gate as any).description}
                </p>
              )}

              {actionType === 'reject' && (
                <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-md">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-orange-600">
                    Rejecting this gate will halt the task execution. This action cannot be undone.
                  </p>
                </div>
              )}
            </div>

            {/* Comment input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground-secondary">
                <MessageSquare className="w-4 h-4" />
                Comment
                {isCommentRequired && (
                  <span className="text-red-500">*</span>
                )}
                {!isCommentRequired && (
                  <span className="text-xs font-normal">(optional)</span>
                )}
              </label>

              <textarea
                ref={commentInputRef}
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder={finalPlaceholder}
                className={cn(
                  'w-full px-3 py-2 text-sm bg-background-tertiary rounded-md border transition-colors focus:outline-none resize-none',
                  isCommentTooLong
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border focus:border-apex-500'
                )}
                rows={3}
                maxLength={maxCommentLength}
                disabled={isSubmitting}
                aria-label={ARIA_LABELS.commentInput}
                data-testid={TEST_IDS.commentInput}
              />

              <div className="flex justify-between items-center">
                <div className="text-xs text-foreground-secondary">
                  {isCommentRequired && !comment.trim() && (
                    <span className="text-red-500">Comment is required for rejection</span>
                  )}
                  {isCommentTooLong && (
                    <span className="text-red-500">Comment is too long</span>
                  )}
                </div>
                <span className={cn(
                  'text-xs',
                  isCommentTooLong ? 'text-red-500' : 'text-foreground-secondary'
                )}>
                  {comment.length} / {maxCommentLength}
                </span>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}
          </CardContent>

          {/* Footer */}
          <CardFooter className="p-4 pt-0 flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
              data-testid={TEST_IDS.cancelButton}
            >
              {CONFIRMATION_DIALOG_DEFAULTS.cancelButtonText}
            </Button>

            <Button
              ref={confirmButtonRef}
              variant={actionType === 'approve' ? 'primary' : 'danger'}
              onClick={onConfirm}
              disabled={!canSubmit || isCommentTooLong}
              className="min-w-[100px]"
              data-testid={TEST_IDS.confirmButton}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {actionType === 'approve' ? 'Approving...' : 'Rejecting...'}
                </>
              ) : (
                <>
                  {actionType === 'approve' ? (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  ) : (
                    <ShieldX className="w-4 h-4 mr-2" />
                  )}
                  {actionType === 'approve'
                    ? CONFIRMATION_DIALOG_DEFAULTS.approveButtonText
                    : CONFIRMATION_DIALOG_DEFAULTS.rejectButtonText
                  }
                </>
              )}
            </Button>
          </CardFooter>
        </div>
      </div>
    </>
  )
}