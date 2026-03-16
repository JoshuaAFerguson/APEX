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
  ApprovalDiffPreview: ({ diffData, viewMode, collapsible }: any) => (
    <div data-testid="approval-diff-preview" data-diff-id={diffData?.diffId} data-view-mode={viewMode}>
      {diffData?.summary && <span data-testid="diff-summary">{diffData.summary}</span>}
      Mock Diff Preview - {diffData?.filesChanged || 0} files changed
    </div>
  ),
}))

describe('ApprovalGateItem - Integration Tests', () => {
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

  describe('Real-time timeout updates', () => {
    it('should update timeout countdown every second', async () => {
      const gate: PendingApprovalGate = {
        id: 'timeout-gate',
        name: 'Timeout Test Gate',
        taskId: 'task-timeout',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:58:00Z'),
        timeoutMs: 120000, // 2 minutes
        timeoutAt: new Date('2024-01-01T10:02:00Z'), // 2 minutes from current time
      }

      render(<ApprovalGateItem gate={gate} />)

      // Should initially show 2m 0s
      expect(screen.getByText('2m 0s')).toBeInTheDocument()

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // Should now show 1m 30s
      expect(screen.getByText('1m 30s')).toBeInTheDocument()

      // Advance time to near expiration (10 seconds remaining)
      act(() => {
        vi.advanceTimersByTime(80000) // Total 110 seconds passed
      })

      // Should show urgent styling and 10s remaining
      expect(screen.getByText('10s')).toBeInTheDocument()

      // Advance past expiration
      act(() => {
        vi.advanceTimersByTime(15000) // Total 125 seconds passed
      })

      // Should show expired
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })

    it('should handle very fast countdown transitions', async () => {
      const gate: PendingApprovalGate = {
        id: 'fast-timeout-gate',
        name: 'Fast Timeout Gate',
        taskId: 'task-fast',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:59:50Z'),
        timeoutMs: 15000, // 15 seconds
        timeoutAt: new Date('2024-01-01T10:00:15Z'), // 15 seconds from current time
      }

      render(<ApprovalGateItem gate={gate} />)

      // Should initially show 15s
      expect(screen.getByText('15s')).toBeInTheDocument()

      // Advance 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Should show 5s
      expect(screen.getByText('5s')).toBeInTheDocument()

      // Advance past expiration
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // Should show expired
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  describe('Complex approval/rejection workflows', () => {
    it('should handle full approval workflow with comment', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onApprove = vi.fn().mockResolvedValue(undefined)

      const gate: PendingApprovalGate = {
        id: 'approval-workflow-gate',
        name: 'Approval Workflow Gate',
        taskId: 'task-approval',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        description: 'Gate for testing approval workflow',
      }

      render(<ApprovalGateItem gate={gate} onApprove={onApprove} />)

      // Look for "Add comment" button in footer (only visible when not expanded)
      await act(async () => {
        await user.click(screen.getByText('Add comment'))
      })

      // Add optional comment
      const commentInput = screen.getByTestId('comment-input')
      await act(async () => {
        await user.type(commentInput, 'Looks good to proceed')
      })

      // Approve with comment
      await act(async () => {
        await user.click(screen.getByTestId('approve-button'))
      })

      expect(onApprove).toHaveBeenCalledWith('Looks good to proceed')
    })

    it('should handle full rejection workflow with required comment', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onReject = vi.fn().mockResolvedValue(undefined)

      const gate: PendingApprovalGate = {
        id: 'rejection-workflow-gate',
        name: 'Rejection Workflow Gate',
        taskId: 'task-rejection',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        description: 'Gate for testing rejection workflow',
      }

      render(<ApprovalGateItem gate={gate} onReject={onReject} isExpanded />)

      // First click on reject should show comment input
      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      expect(screen.getByTestId('comment-input')).toBeInTheDocument()

      // Second click without comment should not submit
      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      expect(onReject).not.toHaveBeenCalled()

      // Add required comment
      const commentInput = screen.getByTestId('comment-input')
      await act(async () => {
        await user.type(commentInput, 'Security concerns detected')
      })

      // Now rejection should work
      await act(async () => {
        await user.click(screen.getByTestId('reject-button'))
      })

      expect(onReject).toHaveBeenCalledWith('Security concerns detected')
    })
  })

  describe('Diff preview integration', () => {
    it('should show diff preview for gates with diff data', async () => {
      const gate: PendingApprovalGate = {
        id: 'diff-gate',
        name: 'Gate with Diff',
        taskId: 'task-diff',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        diffData: {
          diffId: 'diff-123',
          changeType: 'file-edit',
          summary: 'Updated authentication logic',
          rawDiff: '@@ -10,5 +10,5 @@\n-old code\n+new code',
          filesChanged: 3,
          linesAdded: 15,
          linesRemoved: 8,
        },
      }

      render(<ApprovalGateItem gate={gate} showDiffPreview isExpanded />)

      expect(screen.getByTestId('approval-diff-preview')).toBeInTheDocument()
      expect(screen.getByText('Updated authentication logic')).toBeInTheDocument()
      expect(screen.getByText('Mock Diff Preview - 3 files changed')).toBeInTheDocument()
    })

    it('should handle different view modes for diff preview', async () => {
      const gate: PendingApprovalGate = {
        id: 'diff-mode-gate',
        name: 'Gate with Different Modes',
        taskId: 'task-diff-mode',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:55:00Z'),
        diffData: {
          diffId: 'diff-456',
          changeType: 'command-execution',
          summary: 'Package installation changes',
          rawDiff: 'mock diff content',
          filesChanged: 1,
          linesAdded: 5,
          linesRemoved: 2,
        },
      }

      render(<ApprovalGateItem gate={gate} showDiffPreview diffViewMode="split" isExpanded />)

      const diffPreview = screen.getByTestId('approval-diff-preview')
      expect(diffPreview).toHaveAttribute('data-view-mode', 'split')
    })
  })

  describe('Loading states and error handling', () => {
    it('should show loading states during async operations', async () => {
      const gate = mockGate()

      // Test approve loading state
      const { rerender } = render(
        <ApprovalGateItem gate={gate} isLoading loadingAction="approve" />
      )

      expect(screen.getByText('Approving...')).toBeInTheDocument()
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByTestId('approve-button')).toBeDisabled()
      expect(screen.getByTestId('reject-button')).toBeDisabled()

      // Test reject loading state
      rerender(
        <ApprovalGateItem gate={gate} isLoading loadingAction="reject" />
      )

      expect(screen.getByText('Rejecting...')).toBeInTheDocument()
      expect(screen.getByTestId('approve-button')).toBeDisabled()
      expect(screen.getByTestId('reject-button')).toBeDisabled()
    })

    it('should display error messages properly', async () => {
      const gate = mockGate()
      render(<ApprovalGateItem gate={gate} error="Network connection failed" isExpanded />)

      expect(screen.getByText('Network connection failed')).toBeInTheDocument()
    })
  })

  describe('Accessibility and keyboard navigation', () => {
    it('should support full keyboard workflow', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onApprove = vi.fn()
      const onReject = vi.fn()

      render(<ApprovalGateItem gate={mockGate()} onApprove={onApprove} onReject={onReject} />)

      // Tab through elements and activate
      await act(async () => {
        await user.tab() // Focus expand button
      })

      expect(screen.getByLabelText('Expand gate details')).toHaveFocus()

      // Activate expand with Enter
      await act(async () => {
        await user.keyboard('{Enter}')
      })

      // Tab to add comment button
      await act(async () => {
        await user.tab()
      })

      expect(screen.getByText('Add comment')).toHaveFocus()

      // Continue tabbing to action buttons
      await act(async () => {
        await user.tab() // Reject button
      })

      expect(screen.getByTestId('reject-button')).toHaveFocus()

      await act(async () => {
        await user.tab() // Approve button
      })

      expect(screen.getByTestId('approve-button')).toHaveFocus()

      // Activate approve with Enter
      await act(async () => {
        await user.keyboard('{Enter}')
      })

      expect(onApprove).toHaveBeenCalled()
    })
  })

  describe('Complex gate configurations', () => {
    it('should render high-priority gates with all badges', async () => {
      const complexGate: PendingApprovalGate = {
        id: 'complex-gate',
        name: 'Complex High Priority Gate',
        taskId: 'complex-task-123',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:45:00Z'),
        description: 'This is a very complex gate with multiple configuration options and detailed metadata',
        resourceImpact: 'critical',
        gateType: 'dangerous-operation',
        priority: 10,
        timeoutMs: 600000, // 10 minutes
        timeoutAt: new Date('2024-01-01T10:10:00Z'),
        estimatedImpact: 'High-risk operation affecting production systems',
        affectedPaths: [
          '/src/critical/auth.ts',
          '/src/critical/database.ts',
          '/src/critical/payment.ts',
          '/src/critical/security.ts',
          '/src/critical/logging.ts',
        ],
      }

      render(<ApprovalGateItem gate={complexGate} isExpanded />)

      // Check all badges are present
      expect(screen.getByText('Dangerous Operation Gate')).toBeInTheDocument()
      expect(screen.getByText('Critical Impact')).toBeInTheDocument()
      expect(screen.getByText('Priority 10')).toBeInTheDocument()
      expect(screen.getByText('10m 0s')).toBeInTheDocument()

      // Check expanded details
      expect(screen.getByText('High-risk operation affecting production systems')).toBeInTheDocument()
      expect(screen.getByText('Affected Paths (5)')).toBeInTheDocument()
      expect(screen.getByText('/src/critical/auth.ts')).toBeInTheDocument()
      expect(screen.getByText('/src/critical/database.ts')).toBeInTheDocument()
      expect(screen.getByText('/src/critical/payment.ts')).toBeInTheDocument()
      expect(screen.getByText('+ 2 more files')).toBeInTheDocument()
    })

    it('should handle minimal gate configuration gracefully', async () => {
      const minimalGate: PendingApprovalGate = {
        id: 'minimal-gate',
        name: 'Minimal Gate',
        taskId: 'minimal-task',
        status: 'pending',
        requiredAt: new Date('2024-01-01T09:58:00Z'),
      }

      render(<ApprovalGateItem gate={minimalGate} />)

      expect(screen.getByText('Minimal Gate')).toBeInTheDocument()
      expect(screen.getByText('Task: minimal-task')).toBeInTheDocument()

      // Should not show optional badges/sections when data is missing
      expect(screen.queryByText(/Impact$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Priority/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\d+[ms]/)).not.toBeInTheDocument()
    })
  })
})

function mockGate(): PendingApprovalGate {
  return {
    id: 'test-gate-123',
    name: 'Test Gate',
    taskId: 'test-task-456',
    status: 'pending',
    requiredAt: new Date('2024-01-01T09:55:00Z'),
    description: 'Test gate description',
    resourceImpact: 'medium',
    gateType: 'pre-execution',
    priority: 5,
  }
}