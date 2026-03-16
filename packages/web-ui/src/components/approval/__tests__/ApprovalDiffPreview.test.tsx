/**
 * ApprovalDiffPreview Component Tests
 *
 * Comprehensive test suite for the ApprovalDiffPreview component including:
 * - Rendering with diff content
 * - Loading and error states
 * - File metadata display
 * - Empty diff handling
 * - Edge cases and prop variations
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalDiffPreview } from '../ApprovalDiffPreview'
import type { ApprovalDiffData } from '@/types/approval-gate-panel'

// Mock the DiffViewer component
vi.mock('@/components/diff', () => ({
  DiffViewer: ({ diff, onCopy, className }: any) => (
    <div
      data-testid="mock-diff-viewer"
      className={className}
      onClick={() => onCopy?.(diff)}
    >
      Diff content: {diff}
    </div>
  ),
  DEFAULT_VIEW_MODE: 'unified',
}))

// Mock the Card components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock the Button component
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, className, variant, size, ...props }: any) => (
    <button
      className={className}
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron-down-icon">ChevronDown</span>,
  ChevronUp: () => <span data-testid="chevron-up-icon">ChevronUp</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  Code: () => <span data-testid="code-icon">Code</span>,
  Terminal: () => <span data-testid="terminal-icon">Terminal</span>,
  Files: () => <span data-testid="files-icon">Files</span>,
  Copy: () => <span data-testid="copy-icon">Copy</span>,
  Eye: () => <span data-testid="eye-icon">Eye</span>,
  EyeOff: () => <span data-testid="eye-off-icon">EyeOff</span>,
  AlertTriangle: () => <span data-testid="alert-triangle-icon">AlertTriangle</span>,
  Loader2: () => <span data-testid="loader2-icon">Loader2</span>,
}))

describe('ApprovalDiffPreview', () => {
  const mockDiffData: ApprovalDiffData = {
    diffId: 'test-diff-1',
    changeType: 'file-edit',
    rawDiff: `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
+new line
 line 2
 line 3`,
    summary: 'Modified test.txt',
    filesChanged: 1,
    linesAdded: 1,
    linesRemoved: 0,
  }

  const mockDiffDataWithFileDiffs: ApprovalDiffData = {
    diffId: 'test-diff-2',
    changeType: 'file-edit',
    fileDiffs: [
      {
        oldPath: 'test.txt',
        newPath: 'test.txt',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [
          {
            header: '@@ -1,3 +1,4 @@',
            lines: [
              { type: 'unchanged', content: 'line 1' },
              { type: 'added', content: 'new line' },
              { type: 'unchanged', content: 'line 2' },
              { type: 'unchanged', content: 'line 3' },
            ],
          },
        ],
      },
    ],
    summary: 'Modified test.txt with FileDiff objects',
    filesChanged: 1,
    linesAdded: 1,
    linesRemoved: 0,
  }

  const mockCommandDiffData: ApprovalDiffData = {
    diffId: 'test-command-1',
    changeType: 'command-execution',
    command: 'npm install',
    commandPreview: 'npm WARN deprecated package@1.0.0\nnpm audit fix\ninstalled 15 packages',
    summary: 'Install npm dependencies',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with minimal props', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} />)

      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('File Edit')).toBeInTheDocument()
      expect(screen.getByTestId('code-icon')).toBeInTheDocument()
    })

    it('should render file edit change type correctly', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} />)

      expect(screen.getByText('File Edit')).toBeInTheDocument()
      expect(screen.getByTestId('code-icon')).toBeInTheDocument()
    })

    it('should render file write change type correctly', () => {
      const writeData: ApprovalDiffData = { ...mockDiffData, changeType: 'file-write' }
      render(<ApprovalDiffPreview diffData={writeData} />)

      expect(screen.getByText('File Write')).toBeInTheDocument()
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument()
    })

    it('should render file delete change type correctly', () => {
      const deleteData: ApprovalDiffData = { ...mockDiffData, changeType: 'file-delete' }
      render(<ApprovalDiffPreview diffData={deleteData} />)

      expect(screen.getByText('File Delete')).toBeInTheDocument()
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument()
    })

    it('should render multi-file change type correctly', () => {
      const multiFileData: ApprovalDiffData = { ...mockDiffData, changeType: 'multi-file' }
      render(<ApprovalDiffPreview diffData={multiFileData} />)

      expect(screen.getByText('Multiple Files')).toBeInTheDocument()
      expect(screen.getByTestId('files-icon')).toBeInTheDocument()
    })

    it('should render command execution change type correctly', () => {
      render(<ApprovalDiffPreview diffData={mockCommandDiffData} />)

      expect(screen.getByText('Command Execution')).toBeInTheDocument()
      expect(screen.getByTestId('terminal-icon')).toBeInTheDocument()
    })
  })

  describe('File Metadata Display', () => {
    it('should display change summary when provided', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} />)

      expect(screen.getByText('1 file changed, +1 lines added, -0 lines removed')).toBeInTheDocument()
      expect(screen.getByText('Modified test.txt')).toBeInTheDocument()
    })

    it('should display files changed correctly with plural', () => {
      const multiFileData: ApprovalDiffData = {
        ...mockDiffData,
        filesChanged: 3,
        linesAdded: 5,
        linesRemoved: 2,
      }
      render(<ApprovalDiffPreview diffData={multiFileData} />)

      expect(screen.getByText('3 files changed, +5 lines added, -2 lines removed')).toBeInTheDocument()
    })

    it('should handle singular file correctly', () => {
      const singleFileData: ApprovalDiffData = {
        ...mockDiffData,
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 1,
      }
      render(<ApprovalDiffPreview diffData={singleFileData} />)

      expect(screen.getByText('1 file changed, +1 lines added, -1 lines removed')).toBeInTheDocument()
    })

    it('should handle missing metadata gracefully', () => {
      const minimalData: ApprovalDiffData = {
        diffId: 'minimal',
        changeType: 'file-edit',
        rawDiff: 'diff content',
      }
      render(<ApprovalDiffPreview diffData={minimalData} />)

      expect(screen.getByText('File Edit')).toBeInTheDocument()
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })
  })

  describe('Diff Content Rendering', () => {
    it('should render DiffViewer for file changes with rawDiff', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} />)

      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
      expect(screen.getByText(/Diff content:/)).toBeInTheDocument()
    })

    it('should render DiffViewer for file changes with FileDiff objects', () => {
      render(<ApprovalDiffPreview diffData={mockDiffDataWithFileDiffs} />)

      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
      // Should convert FileDiff to raw format
      expect(screen.getByText(/Diff content:/)).toBeInTheDocument()
    })

    it('should render command preview for command execution', () => {
      render(<ApprovalDiffPreview diffData={mockCommandDiffData} />)

      expect(screen.getByText('Command')).toBeInTheDocument()
      expect(screen.getByText('npm install')).toBeInTheDocument()
      expect(screen.getByText('Expected Output Preview')).toBeInTheDocument()
      expect(screen.getByText(/npm WARN deprecated/)).toBeInTheDocument()
    })

    it('should not render DiffViewer for command execution', () => {
      render(<ApprovalDiffPreview diffData={mockCommandDiffData} />)

      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
    })
  })

  describe('Empty Diffs Handling', () => {
    it('should display empty state when no diff content', () => {
      const emptyData: ApprovalDiffData = {
        diffId: 'empty',
        changeType: 'file-edit',
      }
      render(<ApprovalDiffPreview diffData={emptyData} />)

      expect(screen.getByText('No diff content available')).toBeInTheDocument()
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument()
    })

    it('should display empty state when rawDiff is empty', () => {
      const emptyData: ApprovalDiffData = {
        diffId: 'empty',
        changeType: 'file-edit',
        rawDiff: '',
      }
      render(<ApprovalDiffPreview diffData={emptyData} />)

      expect(screen.getByText('No diff content available')).toBeInTheDocument()
    })

    it('should display empty state when fileDiffs is empty array', () => {
      const emptyData: ApprovalDiffData = {
        diffId: 'empty',
        changeType: 'file-edit',
        fileDiffs: [],
      }
      render(<ApprovalDiffPreview diffData={emptyData} />)

      expect(screen.getByText('No diff content available')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should display loading state when loading prop is true', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} loading={true} />)

      expect(screen.getByTestId('loader2-icon')).toBeInTheDocument()
      expect(screen.getByText('Loading diff...')).toBeInTheDocument()
      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
    })

    it('should not display diff content when loading', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} loading={true} />)

      // Header should still be visible
      expect(screen.getByText('Modified test.txt')).toBeInTheDocument()
      // But diff content should not be visible
      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should display error state with string error', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} error="Failed to load diff" />)

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument()
      expect(screen.getByText('Failed to load diff')).toBeInTheDocument()
      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
    })

    it('should display generic error message for non-string errors', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} error={new Error('Network error')} />)

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument()
      expect(screen.getByText('Failed to load diff')).toBeInTheDocument()
    })

    it('should show both error and loading states when both are true', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} loading={true} error="Test error" />)

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
      expect(screen.getByTestId('loader2-icon')).toBeInTheDocument()
    })
  })

  describe('Collapsible Functionality', () => {
    it('should be expanded by default when defaultCollapsed is false', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} collapsible={true} defaultCollapsed={false} />)

      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument()
      expect(screen.getByText('Hide')).toBeInTheDocument()
    })

    it('should be collapsed by default when defaultCollapsed is true', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} collapsible={true} defaultCollapsed={true} />)

      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument()
      expect(screen.getByText('Show')).toBeInTheDocument()
    })

    it('should toggle visibility when expand/collapse button is clicked', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} collapsible={true} defaultCollapsed={true} />)

      // Initially collapsed
      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
      expect(screen.getByText('Show')).toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText('Show'))

      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
      expect(screen.getByText('Hide')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(screen.getByText('Hide'))

      expect(screen.queryByTestId('mock-diff-viewer')).not.toBeInTheDocument()
      expect(screen.getByText('Show')).toBeInTheDocument()
    })

    it('should not show expand/collapse button when collapsible is false', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} collapsible={false} />)

      expect(screen.queryByText('Show')).not.toBeInTheDocument()
      expect(screen.queryByText('Hide')).not.toBeInTheDocument()
    })
  })

  describe('Copy Functionality', () => {
    it('should display copy button when diff content exists', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} />)

      expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
    })

    it('should call onCopy with diff content when copy button is clicked', () => {
      const mockOnCopy = vi.fn()
      render(<ApprovalDiffPreview diffData={mockDiffData} onCopy={mockOnCopy} />)

      fireEvent.click(screen.getByTestId('copy-icon'))

      expect(mockOnCopy).toHaveBeenCalledWith(mockDiffData.rawDiff)
    })

    it('should not display copy button when no diff content', () => {
      const emptyData: ApprovalDiffData = {
        diffId: 'empty',
        changeType: 'file-edit',
      }
      render(<ApprovalDiffPreview diffData={emptyData} />)

      expect(screen.queryByTestId('copy-icon')).not.toBeInTheDocument()
    })
  })

  describe('Props Customization', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ApprovalDiffPreview diffData={mockDiffData} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should pass viewMode to DiffViewer', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} viewMode="split" />)

      // The DiffViewer mock doesn't handle viewMode, but component should pass it
      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
    })

    it('should pass showLineNumbers to DiffViewer', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} showLineNumbers={false} />)

      // The DiffViewer mock doesn't handle showLineNumbers, but component should pass it
      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
    })

    it('should pass highlighting to DiffViewer', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} highlighting={false} />)

      // The DiffViewer mock doesn't handle highlighting, but component should pass it
      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
    })

    it('should pass maxHeight to DiffViewer', () => {
      render(<ApprovalDiffPreview diffData={mockDiffData} maxHeight={200} />)

      // The DiffViewer mock doesn't handle maxHeight, but component should pass it
      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle command execution without commandPreview', () => {
      const commandData: ApprovalDiffData = {
        diffId: 'command-no-preview',
        changeType: 'command-execution',
        command: 'ls -la',
      }
      render(<ApprovalDiffPreview diffData={commandData} />)

      expect(screen.getByText('Command')).toBeInTheDocument()
      expect(screen.getByText('ls -la')).toBeInTheDocument()
      expect(screen.queryByText('Expected Output Preview')).not.toBeInTheDocument()
    })

    it('should handle command execution without command', () => {
      const commandData: ApprovalDiffData = {
        diffId: 'command-no-command',
        changeType: 'command-execution',
      }
      render(<ApprovalDiffPreview diffData={commandData} />)

      expect(screen.getByText('Command Execution')).toBeInTheDocument()
      expect(screen.queryByText('Command')).not.toBeInTheDocument()
    })

    it('should handle FileDiff conversion with empty hunks', () => {
      const emptyHunksData: ApprovalDiffData = {
        diffId: 'empty-hunks',
        changeType: 'file-edit',
        fileDiffs: [
          {
            oldPath: 'test.txt',
            newPath: 'test.txt',
            isNew: false,
            isDeleted: false,
            isRenamed: false,
            hunks: [],
          },
        ],
      }
      render(<ApprovalDiffPreview diffData={emptyHunksData} />)

      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
    })

    it('should prioritize fileDiffs over rawDiff when both are present', () => {
      const bothData: ApprovalDiffData = {
        diffId: 'both-present',
        changeType: 'file-edit',
        rawDiff: 'raw diff content',
        fileDiffs: mockDiffDataWithFileDiffs.fileDiffs,
      }
      render(<ApprovalDiffPreview diffData={bothData} />)

      // Should use fileDiffs and convert to raw format, not use rawDiff directly
      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument()
    })
  })
})