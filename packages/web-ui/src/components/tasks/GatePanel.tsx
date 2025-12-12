'use client'

import { useState } from 'react'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ShieldCheck, ShieldX, AlertTriangle, MessageSquare } from 'lucide-react'

interface GatePanelProps {
  taskId: string
  gateName?: string
  onApproved?: () => void
  onRejected?: () => void
  className?: string
}

export function GatePanel({
  taskId,
  gateName = 'review',
  onApproved,
  onRejected,
  className,
}: GatePanelProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)

  const handleApprove = async () => {
    try {
      setLoading('approve')
      setError(null)
      await apiClient.approveGate(taskId, gateName, {
        approver: 'user', // In a real app, this would be the authenticated user
        comment: comment || undefined,
      })
      onApproved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve gate')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    try {
      setLoading('reject')
      setError(null)
      await apiClient.rejectGate(taskId, gateName, {
        approver: 'user',
        comment: comment || 'Rejected by user',
      })
      onRejected?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject gate')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className={cn('border-yellow-500/50 bg-yellow-500/5', className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Approval Required</h2>
            <p className="text-sm text-foreground-secondary">
              This task is waiting for your approval to continue.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-foreground-secondary">
            Review the changes and decide whether to approve or reject this gate.
            The task will continue execution upon approval, or be marked as failed if rejected.
          </p>

          {/* Comment toggle */}
          <button
            onClick={() => setShowComment(!showComment)}
            className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground"
          >
            <MessageSquare className="w-4 h-4" />
            {showComment ? 'Hide comment' : 'Add a comment (optional)'}
          </button>

          {/* Comment input */}
          {showComment && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your feedback or notes..."
              className="w-full px-3 py-2 text-sm bg-background-tertiary rounded-md border border-border focus:border-apex-500 focus:outline-none resize-none"
              rows={3}
            />
          )}

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="gap-3">
        <Button
          variant="danger"
          onClick={handleReject}
          disabled={loading !== null}
          className="flex-1"
        >
          {loading === 'reject' ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <ShieldX className="w-4 h-4 mr-2" />
          )}
          Reject
        </Button>
        <Button
          variant="primary"
          onClick={handleApprove}
          disabled={loading !== null}
          className="flex-1"
        >
          {loading === 'approve' ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <ShieldCheck className="w-4 h-4 mr-2" />
          )}
          Approve
        </Button>
      </CardFooter>
    </Card>
  )
}
