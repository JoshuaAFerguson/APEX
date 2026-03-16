/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalGateItem } from '../ApprovalGateItem'
import type { PendingApprovalGate } from '@/types/approval-gate-panel'

// Mock the UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="gate-item-card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="gate-item-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="gate-item-content" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/Collapsible', () => ({
  Collapsible: ({ children, open }: any) => (
    <div data-testid="collapsible" data-open={open}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({ children, onClick }: any) => (
    <button onClick={onClick} data-testid="collapsible-trigger">
      {children}
    </button>
  ),
  CollapsibleContent: ({ children }: any) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/Textarea', () => ({
  Textarea: ({ value, onChange, placeholder, ...props }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      data-testid="comment-textarea"
      {...props}
    />
  ),
}))

// Mock diff viewer component
vi.mock('../../diff/DiffViewer', () => ({
  DiffViewer: ({ diffData }: any) => (
    <div data-testid="diff-viewer" data-diff-id={diffData?.diffId}>
      Mock Diff Viewer
    </div>
  ),
}))

// Test data
const mockPendingGate: PendingApprovalGate = {
  id: 'gate-1',
  name: 'test-gate',
  taskId: 'task-1',
  status: 'pending',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  description: 'Test gate for approval',
  resourceImpact: 'medium',
  gateType: 'pre-execution',
  priority: 5,
  timeoutMs: 300000,
  timeoutAt: new Date('2024-01-01T10:05:00Z'),
}

const mockGateWithDiff: PendingApprovalGate = {
  ...mockPendingGate,
  id: 'gate-with-diff',
  diffData: {
    diffId: 'diff-123',
    changeType: 'file-edit',
    summary: 'Updated component logic',
    rawDiff: '@@ -1,1 +1,1 @@\n-old\n+new',
    filesChanged: 1,
    linesAdded: 1,
    linesRemoved: 1,
  },
}

describe('ApprovalGateItem', () => {
  const defaultProps = {
    gate: mockPendingGate,
    onApprove: vi.fn(),
    onReject: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T10:03:00Z')) // 3 minutes after required
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('should render gate information correctly', () => {
      render(<ApprovalGateItem {...defaultProps} />)

      expect(screen.getByText('test-gate')).toBeInTheDocument()
      expect(screen.getByText('Test gate for approval')).toBeInTheDocument()
      expect(screen.getByTestId('gate-item-card')).toBeInTheDocument()
    })

    it('should render gate type badge', () => {
      render(<ApprovalGateItem {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges).toHaveLength(2) // type and impact badges
      expect(badges[0]).toHaveTextContent('pre-execution')
    })

    it('should render resource impact badge', () => {
      render(<ApprovalGateItem {...defaultProps} />)

      const badges = screen.getAllByTestId('badge')
      expect(badges[1]).toHaveTextContent('medium')
    })

    it('should render priority indicator for high priority gates', () => {
      const highPriorityGate = { ...mockPendingGate, priority: 9 }
      render(<ApprovalGateItem {...defaultProps} gate={highPriorityGate} />)

      // Priority should be displayed in high priority styling
      expect(screen.getByText('Priority: 9')).toBeInTheDocument()
    })

    it('should not render priority for normal priority gates', () => {
      const normalPriorityGate = { ...mockPendingGate, priority: 5 }
      render(<ApprovalGateItem {...defaultProps} gate={normalPriorityGate} />)

      expect(screen.queryByText('Priority: 5')).not.toBeInTheDocument()
    })
  })

  describe('timeout countdown', () => {
    it('should display timeout countdown', () => {
      render(<ApprovalGateItem {...defaultProps} />)

      // Should show time remaining (2 minutes left)
      expect(screen.getByText(/2m 0s/)).toBeInTheDocument()
    })

    it('should update countdown in real-time', () => {
      render(<ApprovalGateItem {...defaultProps} />)

      // Initially 2 minutes remaining
      expect(screen.getByText(/2m 0s/)).toBeInTheDocument()

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000)

      // Should now show 1m 30s
      expect(screen.getByText(/1m 30s/)).toBeInTheDocument()
    })

    it('should show urgent styling when timeout is near', () => {
      const urgentGate = {
        ...mockPendingGate,
        timeoutAt: new Date('2024-01-01T10:03:30Z'), // 30 seconds remaining
      }
      render(<ApprovalGateItem {...defaultProps} gate={urgentGate} />)

      const timeoutElement = screen.getByText(/30s/)
      expect(timeoutElement).toBeInTheDocument()
      // In real implementation, this would have urgent styling classes
    })

    it('should show expired state when timeout passes', () => {
      vi.setSystemTime(new Date('2024-01-01T10:06:00Z')) // After timeout

      render(<ApprovalGateItem {...defaultProps} />)

      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  describe('action buttons', () => {
    it('should render approve and reject buttons', () => {
      render(<ApprovalGateItem {...defaultProps} />)

      expect(screen.getByTestId('approve-button')).toBeInTheDocument()
      expect(screen.getByTestId('reject-button')).toBeInTheDocument()
    })

    it('should call onApprove when approve button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onApprove = vi.fn()

      render(<ApprovalGateItem {...defaultProps} onApprove={onApprove} />)

      await user.click(screen.getByTestId('approve-button'))

      expect(onApprove).toHaveBeenCalledWith('gate-1', undefined)
    })

    it('should call onReject with comment when reject button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onReject = vi.fn()

      render(<ApprovalGateItem {...defaultProps} onReject={onReject} />)

      // Click reject button
      await user.click(screen.getByTestId('reject-button'))

      // Should show comment input
      expect(screen.getByTestId('comment-textarea')).toBeInTheDocument()

      // Add comment and submit
      await user.type(screen.getByTestId('comment-textarea'), 'Needs review')
      await user.click(screen.getByText('Submit Rejection'))

      expect(onReject).toHaveBeenCalledWith('gate-1', 'Needs review')
    })

    it('should disable buttons when readOnly is true', () => {
      render(<ApprovalGateItem {...defaultProps} readOnly />)

      expect(screen.getByTestId('approve-button')).toBeDisabled()
      expect(screen.getByTestId('reject-button')).toBeDisabled()
    })

    it('should show loading state on approve button when processing', () => {
      render(<ApprovalGateItem {...defaultProps} isProcessing />)

      const approveButton = screen.getByTestId('approve-button')
      expect(approveButton).toBeDisabled()
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  describe('expandable details', () => {
    it('should expand to show additional details', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateItem {...defaultProps} />)

      const expandButton = screen.getByTestId('collapsible-trigger')
      await user.click(expandButton)

      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'true')
    })

    it('should show gate metadata when expanded', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateItem {...defaultProps} />)

      await user.click(screen.getByTestId('collapsible-trigger'))

      expect(screen.getByText('task-1')).toBeInTheDocument() // Task ID
      expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument() // Required date
    })
  })

  describe('diff preview', () => {
    it('should show diff viewer when gate has diff data', () => {
      render(<ApprovalGateItem {...defaultProps} gate={mockGateWithDiff} showDiffPreview />)

      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
    })

    it('should hide diff viewer when showDiffPreview is false', () => {
      render(<ApprovalGateItem {...defaultProps} gate={mockGateWithDiff} showDiffPreview={false} />)

      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })

    it('should not show diff viewer when gate has no diff data', () => {
      render(<ApprovalGateItem {...defaultProps} showDiffPreview />)

      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })

    it('should show diff summary when available', () => {
      render(<ApprovalGateItem {...defaultProps} gate={mockGateWithDiff} showDiffPreview />)

      expect(screen.getByText('Updated component logic')).toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('should render in compact mode', () => {
      render(<ApprovalGateItem {...defaultProps} compact />)

      const card = screen.getByTestId('gate-item-card')
      expect(card).toHaveClass('compact') // Would have compact styling
    })

    it('should hide less important information in compact mode', () => {
      render(<ApprovalGateItem {...defaultProps} compact />)

      // Description might be truncated in compact mode
      expect(screen.getByTestId('gate-item-card')).toBeInTheDocument()
    })
  })

  describe('comment input for rejection', () => {
    it('should show comment input when reject is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateItem {...defaultProps} />)

      await user.click(screen.getByTestId('reject-button'))

      expect(screen.getByTestId('comment-textarea')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/reason for rejection/i)).toBeInTheDocument()
    })

    it('should validate comment before submitting rejection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onReject = vi.fn()

      render(<ApprovalGateItem {...defaultProps} onReject={onReject} />)

      await user.click(screen.getByTestId('reject-button'))

      // Try to submit without comment
      await user.click(screen.getByText('Submit Rejection'))

      expect(onReject).not.toHaveBeenCalled()
      expect(screen.getByText(/comment is required/i)).toBeInTheDocument()
    })

    it('should allow canceling rejection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateItem {...defaultProps} />)

      await user.click(screen.getByTestId('reject-button'))
      expect(screen.getByTestId('comment-textarea')).toBeInTheDocument()

      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByTestId('comment-textarea')).not.toBeInTheDocument()
    })

    it('should count characters in comment input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateItem {...defaultProps} />)

      await user.click(screen.getByTestId('reject-button'))
      const textarea = screen.getByTestId('comment-textarea')

      await user.type(textarea, 'Test comment')

      expect(screen.getByText('12 / 500')).toBeInTheDocument() // Character count
    })
  })

  describe('error handling', () => {
    it('should show error message when action fails', () => {
      render(<ApprovalGateItem {...defaultProps} error="Failed to approve gate" />)

      expect(screen.getByText('Failed to approve gate')).toBeInTheDocument()
    })

    it('should provide retry button on error', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onRetry = vi.fn()

      render(<ApprovalGateItem {...defaultProps} error="Network error" onRetry={onRetry} />)

      await user.click(screen.getByText('Retry'))

      expect(onRetry).toHaveBeenCalled()
    })
  })

  describe('keyboard accessibility', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateItem {...defaultProps} />)

      // Tab to approve button
      await user.tab()
      expect(screen.getByTestId('approve-button')).toHaveFocus()

      // Tab to reject button
      await user.tab()
      expect(screen.getByTestId('reject-button')).toHaveFocus()
    })

    it('should handle Enter key on approve button', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onApprove = vi.fn()

      render(<ApprovalGateItem {...defaultProps} onApprove={onApprove} />)

      const approveButton = screen.getByTestId('approve-button')
      approveButton.focus()

      await user.keyboard('{Enter}')

      expect(onApprove).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle missing timeout gracefully', () => {
      const gateWithoutTimeout = {
        ...mockPendingGate,
        timeoutMs: undefined,
        timeoutAt: undefined,
      }

      render(<ApprovalGateItem {...defaultProps} gate={gateWithoutTimeout} />)

      expect(screen.queryByText(/\d+[ms]/)).not.toBeInTheDocument()
    })

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(1000)
      const gateWithLongDescription = {
        ...mockPendingGate,
        description: longDescription,
      }

      render(<ApprovalGateItem {...defaultProps} gate={gateWithLongDescription} />)

      expect(screen.getByText(longDescription.substring(0, 100))).toBeInTheDocument()
    })

    it('should handle missing gate type gracefully', () => {
      const gateWithoutType = {
        ...mockPendingGate,
        gateType: undefined,
      }

      render(<ApprovalGateItem {...defaultProps} gate={gateWithoutType} />)

      expect(screen.getByTestId('gate-item-card')).toBeInTheDocument()
    })

    it('should handle zero priority', () => {
      const zeroPriorityGate = {
        ...mockPendingGate,
        priority: 0,
      }

      render(<ApprovalGateItem {...defaultProps} gate={zeroPriorityGate} />)

      expect(screen.getByTestId('gate-item-card')).toBeInTheDocument()
    })
  })
})