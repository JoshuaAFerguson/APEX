/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApprovalGateItem } from '../ApprovalGateItem'
import type { PendingApprovalGate } from '@/types/approval-gate-panel'

// Mock the UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="gate-item-card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="gate-item-content" {...props}>
      {children}
    </div>
  ),
  CardFooter: ({ children, ...props }: any) => (
    <div data-testid="gate-item-footer" {...props}>
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

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className }: any) => (
    <span data-testid="spinner" data-size={size} className={className}>
      Loading...
    </span>
  ),
}))

// Mock ApprovalDiffPreview component
vi.mock('../ApprovalDiffPreview', () => ({
  ApprovalDiffPreview: ({ diffData, viewMode }: any) => (
    <div data-testid="approval-diff-preview" data-diff-id={diffData?.diffId}>
      Mock Diff Preview
    </div>
  ),
}))

describe('ApprovalGateItem - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'))

    // Mock console.warn to suppress act() warnings during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Extreme timeout scenarios', () => {
    it('should handle timeout that already expired when component mounts', () => {
      const expiredGate: PendingApprovalGate = {
        id: 'expired-gate',
        name: 'Already Expired Gate',
        taskId: 'expired-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:30:00Z'),
        timeoutMs: 60000,
        timeoutAt: new Date('2024-01-01T09:31:00Z'), // 29 minutes ago
      }

      render(<ApprovalGateItem gate={expiredGate} />)

      expect(screen.getByText('Expired')).toBeInTheDocument()
    })

    it('should handle very short timeout (< 1 second)', () => {
      vi.setSystemTime(new Date('2024-01-01T10:00:00.500Z')) // Set to 500ms

      const shortTimeoutGate: PendingApprovalGate = {
        id: 'short-timeout-gate',
        name: 'Short Timeout Gate',
        taskId: 'short-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:59:59Z'),
        timeoutMs: 1000,
        timeoutAt: new Date('2024-01-01T10:00:01Z'), // 500ms from current time
      }

      render(<ApprovalGateItem gate={shortTimeoutGate} />)

      expect(screen.getByText('0s')).toBeInTheDocument()

      // Advance past expiration
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(screen.getByText('Expired')).toBeInTheDocument()
    })

    it('should handle very long timeout (hours)', () => {
      const longTimeoutGate: PendingApprovalGate = {
        id: 'long-timeout-gate',
        name: 'Long Timeout Gate',
        taskId: 'long-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T08:00:00Z'),
        timeoutMs: 7200000, // 2 hours
        timeoutAt: new Date('2024-01-01T12:00:00Z'), // 2 hours from current time
      }

      render(<ApprovalGateItem gate={longTimeoutGate} />)

      expect(screen.getByText('120m 0s')).toBeInTheDocument()
    })

    it('should handle timeout update when timeoutAt changes', () => {
      const initialGate: PendingApprovalGate = {
        id: 'update-timeout-gate',
        name: 'Update Timeout Gate',
        taskId: 'update-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:58:00Z'),
        timeoutMs: 120000,
        timeoutAt: new Date('2024-01-01T10:02:00Z'), // 2 minutes
      }

      const { rerender } = render(<ApprovalGateItem gate={initialGate} />)

      expect(screen.getByText('2m 0s')).toBeInTheDocument()

      // Update timeout to 5 minutes
      const updatedGate: PendingApprovalGate = {
        ...initialGate,
        timeoutMs: 300000,
        timeoutAt: new Date('2024-01-01T10:05:00Z'), // 5 minutes
      }

      rerender(<ApprovalGateItem gate={updatedGate} />)

      expect(screen.getByText('5m 0s')).toBeInTheDocument()
    })
  })

  describe('Comment validation edge cases', () => {
    it('should handle maximum character limit (500 chars)', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} isExpanded />)

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      const commentInput = screen.getByTestId('comment-input')
      const maxLengthComment = 'A'.repeat(500)

      await act(async () => {
        await user.type(commentInput, maxLengthComment)
      })

      expect(screen.getByText('500 / 500 characters')).toBeInTheDocument()

      // Should not accept more characters
      await act(async () => {
        await user.type(commentInput, 'B')
      })

      expect((commentInput as HTMLTextAreaElement).value).toBe(maxLengthComment)
    })

    it('should handle comment with only whitespace', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onReject = vi.fn()
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} onReject={onReject} isExpanded />)

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      const commentInput = screen.getByTestId('comment-input')

      // Type whitespace only
      await act(async () => {
        await user.type(commentInput, '   \n\t   ')
      })

      // Try to submit
      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      // Should not call onReject because comment is effectively empty
      expect(onReject).not.toHaveBeenCalled()
      expect(screen.getByTestId('comment-input')).toBeInTheDocument()
    })

    it('should handle special characters and Unicode in comments', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onReject = vi.fn()
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} onReject={onReject} isExpanded />)

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      const commentInput = screen.getByTestId('comment-input')
      const specialComment = '🚨 Security issue: SQL injection vulnerability in $ 💀'

      await act(async () => {
        await user.type(commentInput, specialComment)
      })

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      expect(onReject).toHaveBeenCalledWith(specialComment)
    })

    it('should handle rapid comment input changes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} isExpanded />)

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      const commentInput = screen.getByTestId('comment-input')

      // Type rapidly
      await act(async () => {
        await user.type(commentInput, 'First comment')
      })

      expect(screen.getByText('13 / 500 characters')).toBeInTheDocument()

      // Clear and type new comment
      await act(async () => {
        await user.clear(commentInput)
        await user.type(commentInput, 'Second comment longer')
      })

      expect(screen.getByText('22 / 500 characters')).toBeInTheDocument()
    })
  })

  describe('Resource impact and priority edge cases', () => {
    it('should handle undefined resource impact and priority', () => {
      const gateWithoutImpact: PendingApprovalGate = {
        id: 'no-impact-gate',
        name: 'Gate Without Impact',
        taskId: 'no-impact-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
      }

      render(<ApprovalGateItem gate={gateWithoutImpact} />)

      expect(screen.getByText('Gate Without Impact')).toBeInTheDocument()
      // Check that no impact or priority badges are displayed
      const badges = screen.queryAllByTestId('badge')
      expect(badges.some(badge => badge.textContent?.includes('Impact'))).toBe(false)
      expect(badges.some(badge => badge.textContent?.includes('Priority'))).toBe(false)
    })

    it('should handle negative priority', () => {
      const negativeGate: PendingApprovalGate = {
        id: 'negative-priority-gate',
        name: 'Negative Priority Gate',
        taskId: 'negative-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        priority: -1,
      }

      render(<ApprovalGateItem gate={negativeGate} />)

      expect(screen.getByText('Priority -1')).toBeInTheDocument()
    })

    it('should handle extremely high priority', () => {
      const extremeGate: PendingApprovalGate = {
        id: 'extreme-priority-gate',
        name: 'Extreme Priority Gate',
        taskId: 'extreme-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        priority: 999,
      }

      render(<ApprovalGateItem gate={extremeGate} />)

      expect(screen.getByText('Priority 999')).toBeInTheDocument()
    })
  })

  describe('Async error scenarios', () => {
    it('should handle approval callback throwing error', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onApprove = vi.fn().mockRejectedValue(new Error('Network timeout'))
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} onApprove={onApprove} />)

      await act(async () => {
        await user.click(screen.getByTestId('approve-button'))
      })

      // Component should handle error gracefully
      expect(onApprove).toHaveBeenCalled()
    })

    it('should handle rejection callback throwing error', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onReject = vi.fn().mockRejectedValue(new Error('Server error'))
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} onReject={onReject} isExpanded />)

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      const commentInput = screen.getByTestId('comment-input')
      await act(async () => {
        await user.type(commentInput, 'Rejection reason')
      })

      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      // Component should handle error gracefully
      expect(onReject).toHaveBeenCalledWith('Rejection reason')
    })
  })

  describe('Rapid state changes', () => {
    it('should handle rapid expand/collapse operations', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onToggleExpand = vi.fn()
      const gate = mockGate()

      render(<ApprovalGateItem gate={gate} onToggleExpand={onToggleExpand} />)

      const expandButton = screen.getByLabelText('Expand gate details')

      // Rapid clicks
      await act(async () => {
        await user.click(expandButton)
        await user.click(expandButton)
        await user.click(expandButton)
        await user.click(expandButton)
      })

      // Should have been called multiple times
      expect(onToggleExpand).toHaveBeenCalledTimes(4)
    })

    it('should handle component unmounting during timer updates', () => {
      const gate: PendingApprovalGate = {
        id: 'unmount-gate',
        name: 'Unmount Test Gate',
        taskId: 'unmount-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:59:00Z'),
        timeoutAt: new Date('2024-01-01T10:01:00Z'),
      }

      const { unmount } = render(<ApprovalGateItem gate={gate} />)

      expect(screen.getByText('1m 0s')).toBeInTheDocument()

      // Unmount component
      unmount()

      // Advance timers - should not cause errors
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // No errors should occur
    })
  })

  describe('Affected paths edge cases', () => {
    it('should handle empty affected paths array', () => {
      const gateWithEmptyPaths: PendingApprovalGate = {
        id: 'empty-paths-gate',
        name: 'Empty Paths Gate',
        taskId: 'empty-paths-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        affectedPaths: [],
      }

      render(<ApprovalGateItem gate={gateWithEmptyPaths} isExpanded />)

      expect(screen.queryByText('Affected Paths')).not.toBeInTheDocument()
    })

    it('should handle very long file paths', () => {
      const longPath = '/very/deep/nested/directory/structure/with/many/levels/and/a/really/long/filename/that/exceeds/normal/length/expectations/component.tsx'

      const gateWithLongPaths: PendingApprovalGate = {
        id: 'long-paths-gate',
        name: 'Long Paths Gate',
        taskId: 'long-paths-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        affectedPaths: [longPath],
      }

      render(<ApprovalGateItem gate={gateWithLongPaths} isExpanded />)

      expect(screen.getByText('Affected Paths (1)')).toBeInTheDocument()
      expect(screen.getByText(longPath)).toBeInTheDocument()
    })

    it('should handle exactly 3 affected paths (boundary case)', () => {
      const gateWith3Paths: PendingApprovalGate = {
        id: 'three-paths-gate',
        name: 'Three Paths Gate',
        taskId: 'three-paths-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        affectedPaths: [
          '/src/component1.tsx',
          '/src/component2.tsx',
          '/src/component3.tsx',
        ],
      }

      render(<ApprovalGateItem gate={gateWith3Paths} isExpanded />)

      expect(screen.getByText('Affected Paths (3)')).toBeInTheDocument()
      expect(screen.getByText('/src/component1.tsx')).toBeInTheDocument()
      expect(screen.getByText('/src/component2.tsx')).toBeInTheDocument()
      expect(screen.getByText('/src/component3.tsx')).toBeInTheDocument()
      expect(screen.queryByText(/\+ \d+ more files/)).not.toBeInTheDocument()
    })
  })
})

function mockGate(): PendingApprovalGate {
  return {
    id: 'edge-case-gate',
    name: 'Edge Case Test Gate',
    taskId: 'edge-case-task',
    status: 'pending',
    requiredAt: new Date('2024-01-01T09:55:00Z'),
    description: 'Gate for testing edge cases',
  }
}