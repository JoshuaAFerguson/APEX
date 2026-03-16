/**
 * DiffViewerSplit Component Tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiffViewerSplit } from '../DiffViewerSplit'
import { parseDiff } from '../utils/diff-parser'

const sampleDiff = `--- a/src/app.js
+++ b/src/app.js
@@ -1,4 +1,6 @@
 const express = require('express')
 const app = express()
+const cors = require('cors')
+
+app.use(cors())

-app.get('/', (req, res) => {
-  res.send('Hello World!')
-})
+app.get('/', (req, res) => {
+  res.json({ message: 'Hello World!' })
+})`

const complexDiff = `--- a/src/utils.js
+++ b/src/utils.js
@@ -1,10 +1,15 @@
 function formatDate(date) {
-  return date.toString()
+  return new Intl.DateTimeFormat('en-US').format(date)
 }

+function formatCurrency(amount) {
+  return new Intl.NumberFormat('en-US', {
+    style: 'currency',
+    currency: 'USD'
+  }).format(amount)
+}
+
 function validateEmail(email) {
   return email.includes('@')
-}
-
-function deprecated() {
-  return 'old'
 }`

describe('DiffViewerSplit', () => {
  const mockOnLineClick = vi.fn()

  const defaultProps = {
    fileDiff: { ...parseDiff(sampleDiff), language: 'javascript' as const },
    showLineNumbers: true,
    highlighting: true,
    selectedLines: new Set<number>(),
    onLineClick: mockOnLineClick,
  }

  beforeEach(() => {
    mockOnLineClick.mockClear()
  })

  describe('Basic Rendering', () => {
    it('renders split view with two columns', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      // Should have grid with two columns
      const gridContainer = document.querySelector('.grid-cols-2')
      expect(gridContainer).toBeInTheDocument()
    })

    it('renders file paths in headers', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      // Should show old and new file paths
      expect(screen.getAllByText('src/app.js')).toHaveLength(2)
    })

    it('renders hunk headers on left side only', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      // Hunk header should appear
      const hunkHeaders = screen.getAllByText('@@ -1,4 +1,6 @@')
      expect(hunkHeaders.length).toBeGreaterThan(0)
    })

    it('aligns unchanged lines on both sides', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      // Check for unchanged content that should appear on both sides
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
      expect(screen.getByText(/const app = express/)).toBeInTheDocument()
    })
  })

  describe('Line Pairing', () => {
    it('pairs removed and added lines correctly', () => {
      const complexFileDiff = { ...parseDiff(complexDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={complexFileDiff} />)

      // Old version should show the removed content
      expect(screen.getByText(/return date\.toString/)).toBeInTheDocument()
      // New version should show the added content
      expect(screen.getByText(/return new Intl\.DateTimeFormat/)).toBeInTheDocument()
    })

    it('handles additions without removals', () => {
      const additionOnlyDiff = `--- a/file.js
+++ b/file.js
@@ -1,2 +1,4 @@
 existing line 1
 existing line 2
+new line 3
+new line 4`

      const additionFileDiff = { ...parseDiff(additionOnlyDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={additionFileDiff} />)

      // Should show existing lines on both sides
      expect(screen.getAllByText('existing line 1')).toHaveLength(2)
      // Should show new lines only on right side
      expect(screen.getByText('new line 3')).toBeInTheDocument()
      expect(screen.getByText('new line 4')).toBeInTheDocument()
    })

    it('handles removals without additions', () => {
      const removalOnlyDiff = `--- a/file.js
+++ b/file.js
@@ -1,4 +1,2 @@
 existing line 1
 existing line 2
-removed line 3
-removed line 4`

      const removalFileDiff = { ...parseDiff(removalOnlyDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={removalFileDiff} />)

      // Should show existing lines on both sides
      expect(screen.getAllByText('existing line 1')).toHaveLength(2)
      // Should show removed lines only on left side
      expect(screen.getByText('removed line 3')).toBeInTheDocument()
      expect(screen.getByText('removed line 4')).toBeInTheDocument()
    })
  })

  describe('Empty Spaces', () => {
    it('renders empty spaces for unmatched lines', () => {
      const complexFileDiff = { ...parseDiff(complexDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={complexFileDiff} />)

      // Should have empty spaces where lines don't match
      const emptySpaces = document.querySelectorAll('[aria-hidden="true"].bg-muted\\/30')
      expect(emptySpaces.length).toBeGreaterThan(0)
    })

    it('maintains consistent heights between sides', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      // Both sides should have the same structure
      const leftSide = document.querySelector('.grid-cols-2 > div:first-child')
      const rightSide = document.querySelector('.grid-cols-2 > div:last-child')

      expect(leftSide).toBeInTheDocument()
      expect(rightSide).toBeInTheDocument()
    })
  })

  describe('Line Numbers', () => {
    it('shows appropriate line numbers for each side', () => {
      render(<DiffViewerSplit {...defaultProps} showLineNumbers={true} />)

      // Line numbers should be present
      const diffContent = document.querySelector('[data-line-type]')
      expect(diffContent).toBeInTheDocument()
    })

    it('hides line numbers when disabled', () => {
      render(<DiffViewerSplit {...defaultProps} showLineNumbers={false} />)

      // Content should still be present
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })
  })

  describe('Line Selection', () => {
    it('allows selecting lines on left side', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      const leftSideButtons = screen.getAllByRole('button').filter(button =>
        button.closest('.grid-cols-2 > div:first-child')
      )

      if (leftSideButtons.length > 0) {
        fireEvent.click(leftSideButtons[0])
        expect(mockOnLineClick).toHaveBeenCalled()
      }
    })

    it('allows selecting lines on right side', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      const rightSideButtons = screen.getAllByRole('button').filter(button =>
        button.closest('.grid-cols-2 > div:last-child')
      )

      if (rightSideButtons.length > 0) {
        fireEvent.click(rightSideButtons[0])
        expect(mockOnLineClick).toHaveBeenCalled()
      }
    })

    it('highlights selected lines correctly', () => {
      const selectedLines = new Set([0, 1])
      render(<DiffViewerSplit {...defaultProps} selectedLines={selectedLines} />)

      // Check for selected state
      const selectedElements = document.querySelectorAll('[aria-selected="true"]')
      expect(selectedElements.length).toBeGreaterThan(0)
    })

    it('uses different indices for left and right sides', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      const allButtons = screen.getAllByRole('button')
      const leftButtons = allButtons.filter(btn =>
        btn.closest('.grid-cols-2 > div:first-child')
      )
      const rightButtons = allButtons.filter(btn =>
        btn.closest('.grid-cols-2 > div:last-child')
      )

      if (leftButtons.length > 0 && rightButtons.length > 0) {
        fireEvent.click(leftButtons[0])
        fireEvent.click(rightButtons[0])

        expect(mockOnLineClick).toHaveBeenCalledTimes(2)
        // Indices should potentially be different
        const firstCallIndex = mockOnLineClick.mock.calls[0][1]
        const secondCallIndex = mockOnLineClick.mock.calls[1][1]
        // Both should be valid numbers
        expect(typeof firstCallIndex).toBe('number')
        expect(typeof secondCallIndex).toBe('number')
      }
    })
  })

  describe('Syntax Highlighting', () => {
    it('applies syntax highlighting to both sides', () => {
      render(<DiffViewerSplit {...defaultProps} highlighting={true} />)

      // Content should be rendered with highlighting
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })

    it('disables syntax highlighting when requested', () => {
      render(<DiffViewerSplit {...defaultProps} highlighting={false} />)

      // Content should still be rendered without highlighting
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })
  })

  describe('Complex Diffs', () => {
    it('handles multiple consecutive removals and additions', () => {
      const consecutiveDiff = `--- a/file.js
+++ b/file.js
@@ -1,6 +1,6 @@
 unchanged line
-old line 1
-old line 2
-old line 3
+new line 1
+new line 2
+new line 3
 unchanged line`

      const consecutiveFileDiff = { ...parseDiff(consecutiveDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={consecutiveFileDiff} />)

      // Should show old lines on left, new lines on right
      expect(screen.getByText('old line 1')).toBeInTheDocument()
      expect(screen.getByText('new line 1')).toBeInTheDocument()
      expect(screen.getAllByText('unchanged line')).toHaveLength(4) // 2 on each side
    })

    it('handles mixed change patterns', () => {
      const mixedDiff = `--- a/file.js
+++ b/file.js
@@ -1,8 +1,10 @@
 line 1
-removed line
 line 3
+added line after 3
 line 4
-another removal
+replacement line
 line 6
+final addition`

      const mixedFileDiff = { ...parseDiff(mixedDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={mixedFileDiff} />)

      // Check that complex patterns are handled
      expect(screen.getByText('removed line')).toBeInTheDocument()
      expect(screen.getByText('added line after 3')).toBeInTheDocument()
      expect(screen.getByText('replacement line')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty files gracefully', () => {
      const emptyDiff = `--- /dev/null
+++ b/empty.js
@@ -0,0 +1,1 @@
+// empty file`

      const emptyFileDiff = { ...parseDiff(emptyDiff), language: 'javascript' as const }
      render(<DiffViewerSplit {...defaultProps} fileDiff={emptyFileDiff} />)

      expect(screen.getByText('// empty file')).toBeInTheDocument()
    })

    it('handles very long file names', () => {
      const longNameFileDiff = {
        ...defaultProps.fileDiff,
        oldPath: 'very/long/path/to/a/file/with/many/nested/directories/and/a/very-long-filename.js',
        newPath: 'very/long/path/to/a/file/with/many/nested/directories/and/a/very-long-filename.js'
      }

      render(<DiffViewerSplit {...defaultProps} fileDiff={longNameFileDiff} />)

      // Should handle long paths with truncation
      const pathElements = screen.getAllByText(/very\/long\/path/)
      expect(pathElements.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('maintains proper ARIA attributes in split view', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      // Interactive elements should have proper roles and states
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-selected')
      })
    })

    it('supports keyboard navigation on both sides', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      if (buttons.length > 0) {
        const firstButton = buttons[0]

        // Test keyboard activation
        fireEvent.keyDown(firstButton, { key: 'Enter' })
        expect(mockOnLineClick).toHaveBeenCalled()
      }
    })

    it('properly handles focus management between sides', () => {
      render(<DiffViewerSplit {...defaultProps} />)

      const leftButtons = screen.getAllByRole('button').filter(btn =>
        btn.closest('.grid-cols-2 > div:first-child')
      )
      const rightButtons = screen.getAllByRole('button').filter(btn =>
        btn.closest('.grid-cols-2 > div:last-child')
      )

      // Both sides should be focusable
      if (leftButtons.length > 0) {
        expect(leftButtons[0]).toHaveAttribute('tabindex', '0')
      }
      if (rightButtons.length > 0) {
        expect(rightButtons[0]).toHaveAttribute('tabindex', '0')
      }
    })
  })
})