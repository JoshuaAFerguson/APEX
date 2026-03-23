/**
 * ChangelogEntry Component Tests
 *
 * Unit tests for the ChangelogEntry component functionality,
 * including rendering, interaction, and accessibility.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ChangelogEntry } from '../ChangelogEntry'
import type { ChangelogEntry as ChangelogEntryType } from '@/types/changelog'

// Mock the DiffViewer component to avoid complex dependencies
vi.mock('@/components/diff/DiffViewer', () => ({
  DiffViewer: ({ diff, filePath }: { diff: string; filePath: string }) => (
    <div data-testid="diff-viewer">
      Mock DiffViewer for {filePath}: {diff?.length || 0} characters
    </div>
  ),
}))

// Mock the ChangelogDiffPreview component
vi.mock('../ChangelogDiffPreview', () => ({
  ChangelogDiffPreview: ({ changes }: { changes: any[] }) => (
    <div data-testid="diff-preview">
      Diff preview with {changes.length} changes
    </div>
  ),
}))

describe('ChangelogEntry', () => {
  const mockEntry: ChangelogEntryType = {
    id: '1',
    title: 'Add user authentication system',
    description: 'Implement JWT-based authentication with login/logout functionality',
    timestamp: new Date('2024-03-20T10:00:00Z'),
    workflow: 'feature-development',
    status: 'completed',
    git: {
      branchName: 'feature/auth-system',
      prUrl: 'https://github.com/example/repo/pull/123',
    },
    changes: [
      {
        path: 'src/auth/AuthProvider.tsx',
        type: 'added',
        diff: '+import React from "react"\n+export const AuthProvider = () => {}',
        stats: { additions: 2, deletions: 0 },
      },
    ],
    stats: {
      filesModified: 1,
      linesAdded: 2,
      linesRemoved: 0,
    },
    taskId: '1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders entry with title and basic information', () => {
      render(<ChangelogEntry entry={mockEntry} />)

      expect(screen.getByText(mockEntry.title)).toBeInTheDocument()
      expect(screen.getByText(mockEntry.workflow)).toBeInTheDocument()
      expect(screen.getByText(mockEntry.status)).toBeInTheDocument()
    })

    it('displays git information when available', () => {
      render(<ChangelogEntry entry={mockEntry} />)

      expect(screen.getByText('feature/auth-system')).toBeInTheDocument()

      // Check for PR link button
      const prButton = screen.getByTitle('View Pull Request')
      expect(prButton).toBeInTheDocument()
    })

    it('shows change statistics', () => {
      render(<ChangelogEntry entry={mockEntry} />)

      expect(screen.getByText(/\+2.*1 file/)).toBeInTheDocument()
    })

    it('displays status-appropriate styling for completed status', () => {
      render(<ChangelogEntry entry={mockEntry} />)

      const statusBadge = screen.getByText('completed')
      expect(statusBadge).toBeInTheDocument()
    })

    it('displays status-appropriate styling for failed status', () => {
      const failedEntry = { ...mockEntry, status: 'failed' as const }
      render(<ChangelogEntry entry={failedEntry} />)

      const statusBadge = screen.getByText('failed')
      expect(statusBadge).toBeInTheDocument()
    })
  })

  describe('Expansion Functionality', () => {
    it('shows expand button when entry has changes', () => {
      render(<ChangelogEntry entry={mockEntry} showDiffToggle={true} />)

      const expandButton = screen.getByText(/Show changes/)
      expect(expandButton).toBeInTheDocument()
    })

    it('hides expand button when showDiffToggle is false', () => {
      render(<ChangelogEntry entry={mockEntry} showDiffToggle={false} />)

      const expandButton = screen.queryByText(/Show changes/)
      expect(expandButton).not.toBeInTheDocument()
    })

    it('toggles expansion when expand button is clicked', () => {
      render(<ChangelogEntry entry={mockEntry} showDiffToggle={true} />)

      const expandButton = screen.getByText(/Show changes/)
      fireEvent.click(expandButton)

      // Should show diff preview when expanded
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()

      // Button text should change
      expect(screen.getByText(/Hide changes/)).toBeInTheDocument()
    })

    it('uses controlled expansion state when provided', () => {
      const onToggle = vi.fn()
      render(
        <ChangelogEntry
          entry={mockEntry}
          isExpanded={true}
          onToggleExpand={onToggle}
          showDiffToggle={true}
        />
      )

      // Should show diff preview when controlled expanded
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()

      const toggleButton = screen.getByText(/Hide changes/)
      fireEvent.click(toggleButton)

      expect(onToggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('Interaction', () => {
    it('calls onClick when entry is clicked', () => {
      const onClick = vi.fn()
      render(<ChangelogEntry entry={mockEntry} onClick={onClick} />)

      const entryCard = screen.getByText(mockEntry.title).closest('div')
      fireEvent.click(entryCard!)

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when interactive elements are clicked', () => {
      const onClick = vi.fn()
      render(
        <ChangelogEntry
          entry={mockEntry}
          onClick={onClick}
          showDiffToggle={true}
        />
      )

      const expandButton = screen.getByText(/Show changes/)
      fireEvent.click(expandButton)

      expect(onClick).not.toHaveBeenCalled()
    })

    it('opens PR URL in new tab when PR button is clicked', () => {
      const originalOpen = window.open
      window.open = vi.fn()

      render(<ChangelogEntry entry={mockEntry} />)

      const prButton = screen.getByTitle('View Pull Request')
      fireEvent.click(prButton)

      expect(window.open).toHaveBeenCalledWith(mockEntry.git?.prUrl, '_blank')

      window.open = originalOpen
    })
  })

  describe('Edge Cases', () => {
    it('renders entry without git information', () => {
      const entryWithoutGit = { ...mockEntry, git: undefined }
      render(<ChangelogEntry entry={entryWithoutGit} />)

      expect(screen.getByText(mockEntry.title)).toBeInTheDocument()
      expect(screen.queryByTitle('View Pull Request')).not.toBeInTheDocument()
    })

    it('renders entry without changes', () => {
      const entryWithoutChanges = { ...mockEntry, changes: [] }
      render(<ChangelogEntry entry={entryWithoutChanges} showDiffToggle={true} />)

      expect(screen.queryByText(/Show changes/)).not.toBeInTheDocument()
    })

    it('handles compact mode', () => {
      render(<ChangelogEntry entry={mockEntry} compact={true} />)

      // Entry should still render but with compact styling
      expect(screen.getByText(mockEntry.title)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for status icons', () => {
      render(<ChangelogEntry entry={mockEntry} />)

      // Check for accessibility attributes
      const statusIcon = document.querySelector('[aria-label*="Task status:"]')
      expect(statusIcon).toBeInTheDocument()
    })

    it('has proper ARIA labels for expand button', () => {
      render(<ChangelogEntry entry={mockEntry} showDiffToggle={true} />)

      const expandButton = screen.getByLabelText(/Expand changelog entry/)
      expect(expandButton).toBeInTheDocument()
    })
  })
})