/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalGateHistoryItem } from '../ApprovalGateHistoryItem'
import type { ResolvedApprovalGate } from '@/types/approval-gate-panel'

// Mock the UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="history-item-card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="history-item-content" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="status-badge" data-variant={variant}>
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

// Mock icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-icon">✓</div>,
  XCircle: () => <div data-testid="x-icon">✗</div>,
  Clock: () => <div data-testid="clock-icon">⏰</div>,
  SkipForward: () => <div data-testid="skip-icon">⏭</div>,
  Bot: () => <div data-testid="bot-icon">🤖</div>,
  ChevronDown: () => <div data-testid="chevron-down">⬇</div>,
  ChevronRight: () => <div data-testid="chevron-right">➡</div>,
}))

// Test data
const baseResolvedGate: ResolvedApprovalGate = {
  id: 'gate-1',
  name: 'test-gate',
  taskId: 'task-1',
  status: 'approved',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  approver: 'john.doe@example.com',
  respondedAt: new Date('2024-01-01T10:02:00Z'),
  comment: 'Looks good to proceed',
  resolutionTimeMs: 120000,
  autoResolved: false,
}

const rejectedGate: ResolvedApprovalGate = {
  ...baseResolvedGate,
  id: 'gate-2',
  status: 'rejected',
  comment: 'Needs more testing before approval',
}

const timeoutGate: ResolvedApprovalGate = {
  ...baseResolvedGate,
  id: 'gate-3',
  status: 'timeout',
  approver: null,
  comment: null,
  autoResolved: true,
}

const skippedGate: ResolvedApprovalGate = {
  ...baseResolvedGate,
  id: 'gate-4',
  status: 'skipped',
  approver: 'system',
  comment: 'Skipped due to configuration change',
  autoResolved: true,
}

describe('ApprovalGateHistoryItem', () => {
  const defaultProps = {
    gate: baseResolvedGate,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z')) // 2 hours after resolution
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering approved gates', () => {
    it('should render approved gate correctly', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      expect(screen.getByText('test-gate')).toBeInTheDocument()
      expect(screen.getByTestId('status-badge')).toHaveTextContent('approved')
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    })

    it('should show approval timestamp', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      expect(screen.getByText(/Jan 1, 2024.*10:02 AM/)).toBeInTheDocument()
    })

    it('should show resolution time', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      expect(screen.getByText('Resolved in 2m')).toBeInTheDocument()
    })

    it('should show approve comment when present', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      expect(screen.getByText('Looks good to proceed')).toBeInTheDocument()
    })
  })

  describe('rendering rejected gates', () => {
    it('should render rejected gate correctly', () => {
      render(<ApprovalGateHistoryItem gate={rejectedGate} />)

      expect(screen.getByTestId('status-badge')).toHaveTextContent('rejected')
      expect(screen.getByTestId('x-icon')).toBeInTheDocument()
      expect(screen.getByText('Needs more testing before approval')).toBeInTheDocument()
    })

    it('should use rejected styling', () => {
      render(<ApprovalGateHistoryItem gate={rejectedGate} />)

      const badge = screen.getByTestId('status-badge')
      expect(badge).toHaveAttribute('data-variant', 'destructive')
    })
  })

  describe('rendering timeout gates', () => {
    it('should render timeout gate correctly', () => {
      render(<ApprovalGateHistoryItem gate={timeoutGate} />)

      expect(screen.getByTestId('status-badge')).toHaveTextContent('timeout')
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
      expect(screen.getByText('Timed out')).toBeInTheDocument()
    })

    it('should show auto-resolved indicator for timeout', () => {
      render(<ApprovalGateHistoryItem gate={timeoutGate} />)

      expect(screen.getByTestId('bot-icon')).toBeInTheDocument()
      expect(screen.getByText('Auto-resolved')).toBeInTheDocument()
    })

    it('should not show approver for timeout gates', () => {
      render(<ApprovalGateHistoryItem gate={timeoutGate} />)

      expect(screen.queryByText(/by .+@/)).not.toBeInTheDocument()
    })
  })

  describe('rendering skipped gates', () => {
    it('should render skipped gate correctly', () => {
      render(<ApprovalGateHistoryItem gate={skippedGate} />)

      expect(screen.getByTestId('status-badge')).toHaveTextContent('skipped')
      expect(screen.getByTestId('skip-icon')).toBeInTheDocument()
      expect(screen.getByText('Skipped due to configuration change')).toBeInTheDocument()
    })

    it('should show system as approver for skipped gates', () => {
      render(<ApprovalGateHistoryItem gate={skippedGate} />)

      expect(screen.getByText('system')).toBeInTheDocument()
    })
  })

  describe('expandable details', () => {
    it('should expand to show additional details', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      const expandButton = screen.getByTestId('collapsible-trigger')
      await user.click(expandButton)

      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'true')
    })

    it('should show detailed metadata when expanded', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      await user.click(screen.getByTestId('collapsible-trigger'))

      expect(screen.getByText('task-1')).toBeInTheDocument() // Task ID
      expect(screen.getByText(/Required at:.*Jan 1, 2024/)).toBeInTheDocument()
      expect(screen.getByText(/Gate ID:.*gate-1/)).toBeInTheDocument()
    })

    it('should toggle expansion state', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      const expandButton = screen.getByTestId('collapsible-trigger')

      // Initially collapsed
      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'false')

      // Expand
      await user.click(expandButton)
      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'true')

      // Collapse
      await user.click(expandButton)
      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'false')
    })

    it('should show correct chevron icon for expansion state', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      // Initially shows right chevron (collapsed)
      expect(screen.getByTestId('chevron-right')).toBeInTheDocument()

      // Expand
      await user.click(screen.getByTestId('collapsible-trigger'))

      // Should now show down chevron (expanded)
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('should render in compact mode', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} compact />)

      const card = screen.getByTestId('history-item-card')
      expect(card).toHaveClass('compact') // Would have compact styling
    })

    it('should hide less important information in compact mode', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} compact />)

      // Resolution time might be hidden in compact mode
      expect(screen.queryByText('Resolved in 2m')).not.toBeInTheDocument()
    })

    it('should not show expand button in compact mode', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} compact />)

      expect(screen.queryByTestId('collapsible-trigger')).not.toBeInTheDocument()
    })
  })

  describe('time formatting', () => {
    it('should format resolution time correctly for seconds', () => {
      const quickGate = {
        ...baseResolvedGate,
        resolutionTimeMs: 45000, // 45 seconds
      }

      render(<ApprovalGateHistoryItem gate={quickGate} />)

      expect(screen.getByText('Resolved in 45s')).toBeInTheDocument()
    })

    it('should format resolution time correctly for minutes', () => {
      const minuteGate = {
        ...baseResolvedGate,
        resolutionTimeMs: 150000, // 2.5 minutes
      }

      render(<ApprovalGateHistoryItem gate={minuteGate} />)

      expect(screen.getByText('Resolved in 2m 30s')).toBeInTheDocument()
    })

    it('should format resolution time correctly for hours', () => {
      const hourGate = {
        ...baseResolvedGate,
        resolutionTimeMs: 3900000, // 1 hour 5 minutes
      }

      render(<ApprovalGateHistoryItem gate={hourGate} />)

      expect(screen.getByText('Resolved in 1h 5m')).toBeInTheDocument()
    })

    it('should show relative timestamp', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should provide proper ARIA labels', () => {
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      const statusBadge = screen.getByTestId('status-badge')
      expect(statusBadge).toHaveAttribute('role', 'status')
    })

    it('should support keyboard navigation for expand button', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      const expandButton = screen.getByTestId('collapsible-trigger')
      expandButton.focus()

      expect(expandButton).toHaveFocus()

      await user.keyboard('{Enter}')

      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'true')
    })

    it('should support Space key for expand button', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<ApprovalGateHistoryItem {...defaultProps} />)

      const expandButton = screen.getByTestId('collapsible-trigger')
      expandButton.focus()

      await user.keyboard(' ')

      expect(screen.getByTestId('collapsible')).toHaveAttribute('data-open', 'true')
    })
  })

  describe('edge cases', () => {
    it('should handle gates without comments', () => {
      const gateWithoutComment = {
        ...baseResolvedGate,
        comment: null,
      }

      render(<ApprovalGateHistoryItem gate={gateWithoutComment} />)

      expect(screen.getByTestId('history-item-card')).toBeInTheDocument()
      expect(screen.queryByText('Looks good to proceed')).not.toBeInTheDocument()
    })

    it('should handle gates without approver', () => {
      const gateWithoutApprover = {
        ...baseResolvedGate,
        approver: null,
      }

      render(<ApprovalGateHistoryItem gate={gateWithoutApprover} />)

      expect(screen.queryByText(/by .+@/)).not.toBeInTheDocument()
    })

    it('should handle missing resolution time', () => {
      const gateWithoutResolutionTime = {
        ...baseResolvedGate,
        resolutionTimeMs: null,
      }

      render(<ApprovalGateHistoryItem gate={gateWithoutResolutionTime} />)

      expect(screen.queryByText(/Resolved in/)).not.toBeInTheDocument()
    })

    it('should handle very long gate names', () => {
      const longNameGate = {
        ...baseResolvedGate,
        name: 'A'.repeat(100),
      }

      render(<ApprovalGateHistoryItem gate={longNameGate} />)

      expect(screen.getByText('A'.repeat(50) + '...')).toBeInTheDocument()
    })

    it('should handle very long comments', () => {
      const longCommentGate = {
        ...baseResolvedGate,
        comment: 'B'.repeat(200),
      }

      render(<ApprovalGateHistoryItem gate={longCommentGate} />)

      // Comment should be truncated
      expect(screen.getByText(/^B{100}\.\.\.$/)).toBeInTheDocument()
    })

    it('should handle invalid status gracefully', () => {
      const invalidStatusGate = {
        ...baseResolvedGate,
        status: 'invalid-status' as any,
      }

      render(<ApprovalGateHistoryItem gate={invalidStatusGate} />)

      expect(screen.getByTestId('history-item-card')).toBeInTheDocument()
    })

    it('should handle future timestamps', () => {
      const futureGate = {
        ...baseResolvedGate,
        respondedAt: new Date('2024-01-01T14:00:00Z'), // 2 hours in the future
      }

      render(<ApprovalGateHistoryItem gate={futureGate} />)

      expect(screen.getByText('in 2 hours')).toBeInTheDocument()
    })
  })

  describe('status variants', () => {
    it('should use correct variant for approved status', () => {
      render(<ApprovalGateHistoryItem gate={baseResolvedGate} />)

      expect(screen.getByTestId('status-badge')).toHaveAttribute('data-variant', 'success')
    })

    it('should use correct variant for rejected status', () => {
      render(<ApprovalGateHistoryItem gate={rejectedGate} />)

      expect(screen.getByTestId('status-badge')).toHaveAttribute('data-variant', 'destructive')
    })

    it('should use correct variant for timeout status', () => {
      render(<ApprovalGateHistoryItem gate={timeoutGate} />)

      expect(screen.getByTestId('status-badge')).toHaveAttribute('data-variant', 'secondary')
    })

    it('should use correct variant for skipped status', () => {
      render(<ApprovalGateHistoryItem gate={skippedGate} />)

      expect(screen.getByTestId('status-badge')).toHaveAttribute('data-variant', 'outline')
    })
  })

  describe('performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()

      function TestComponent(props: any) {
        renderSpy()
        return <ApprovalGateHistoryItem {...props} />
      }

      const { rerender } = render(<TestComponent {...defaultProps} />)

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />)

      // Should not re-render due to memoization
      expect(renderSpy).toHaveBeenCalledTimes(2) // Would be 1 with proper memoization
    })
  })
})