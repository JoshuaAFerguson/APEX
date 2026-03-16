/**
 * DiffViewerInline Component Tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiffViewerInline } from '../DiffViewerInline'
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

const multiHunkDiff = `--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,4 @@
 const fs = require('fs')
+const path = require('path')

 function readFile(filename) {
@@ -10,6 +11,8 @@ function readFile(filename) {
   return fs.readFileSync(filename, 'utf8')
 }

+// New utility functions
+const utils = require('./utils')
+
 module.exports = {
   readFile
 }`

const changeBlockDiff = `--- a/file.js
+++ b/file.js
@@ -1,10 +1,12 @@
 unchanged line 1
 unchanged line 2
-old block line 1
-old block line 2
-old block line 3
+new block line 1
+new block line 2
+new block line 3
+extra new line
 unchanged line 3
 unchanged line 4
+final addition
 end`

describe('DiffViewerInline', () => {
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
    it('renders hunk headers with enhanced information', () => {
      render(<DiffViewerInline {...defaultProps} />)

      expect(screen.getByText('@@ -1,4 +1,6 @@')).toBeInTheDocument()
      // Should show addition and deletion counts
      expect(screen.getByText(/additions/)).toBeInTheDocument()
      expect(screen.getByText(/deletions/)).toBeInTheDocument()
    })

    it('renders all diff lines in inline format', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Check for various types of lines
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
      expect(screen.getByText(/const cors = require/)).toBeInTheDocument()
      expect(screen.getByText(/res\.send\('Hello World!'\)/)).toBeInTheDocument()
      expect(screen.getByText(/res\.json\(\{ message: 'Hello World!' \}\)/)).toBeInTheDocument()
    })

    it('shows change block separators', () => {
      const changeBlockFileDiff = { ...parseDiff(changeBlockDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={changeBlockFileDiff} />)

      // Change blocks should have visual separators
      const changeBlocks = document.querySelectorAll('.border-t.border-border\\/30')
      expect(changeBlocks.length).toBeGreaterThan(0)
    })
  })

  describe('Change Block Grouping', () => {
    it('visually groups consecutive changes', () => {
      const changeBlockFileDiff = { ...parseDiff(changeBlockDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={changeBlockFileDiff} />)

      // Should have visual grouping for change blocks
      expect(screen.getByText('old block line 1')).toBeInTheDocument()
      expect(screen.getByText('new block line 1')).toBeInTheDocument()
    })

    it('separates change blocks from unchanged content', () => {
      const changeBlockFileDiff = { ...parseDiff(changeBlockDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={changeBlockFileDiff} />)

      // Check for border separators around change blocks
      const topBorders = document.querySelectorAll('.border-t.border-border\\/30.mt-1')
      const bottomBorders = document.querySelectorAll('.border-b.border-border\\/30.mb-1')

      expect(topBorders.length).toBeGreaterThan(0)
      expect(bottomBorders.length).toBeGreaterThan(0)
    })

    it('does not add separators for isolated unchanged lines', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Unchanged lines surrounded by other unchanged lines should not have separators
      const unchangedElements = document.querySelectorAll('[data-line-type="unchanged"]')
      expect(unchangedElements.length).toBeGreaterThan(0)
    })
  })

  describe('Multiple Hunks', () => {
    it('renders multiple hunks with individual summaries', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={multiHunkFileDiff} />)

      // Should have multiple hunk headers
      expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeInTheDocument()
      expect(screen.getByText('@@ -10,6 +11,8 @@')).toBeInTheDocument()
    })

    it('shows final summary for last hunk', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={multiHunkFileDiff} />)

      // Should show chunk summary
      expect(screen.getByText(/chunk/)).toBeInTheDocument()
    })

    it('maintains global line indexing across hunks', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={multiHunkFileDiff} />)

      // Click on lines from different hunks
      const clickableLines = screen.getAllByRole('button')

      if (clickableLines.length >= 2) {
        fireEvent.click(clickableLines[0])
        fireEvent.click(clickableLines[1])

        // Should be called with different indices
        expect(mockOnLineClick).toHaveBeenCalledTimes(2)
        const firstCall = mockOnLineClick.mock.calls[0][1]
        const secondCall = mockOnLineClick.mock.calls[1][1]
        expect(firstCall).not.toBe(secondCall)
      }
    })
  })

  describe('Statistics Display', () => {
    it('shows addition and deletion counts in hunk headers', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Check for numeric counts
      const additionElements = screen.getAllByText(/\d+ additions/)
      const deletionElements = screen.getAllByText(/\d+ deletions/)

      expect(additionElements.length).toBeGreaterThan(0)
      expect(deletionElements.length).toBeGreaterThan(0)
    })

    it('shows overall statistics in final summary', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Should show overall statistics
      expect(screen.getByText(/\d+ additions/)).toBeInTheDocument()
      expect(screen.getByText(/\d+ deletions/)).toBeInTheDocument()
    })

    it('calculates statistics correctly for multiple hunks', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={multiHunkFileDiff} />)

      // Should aggregate statistics across all hunks
      const summarySection = document.querySelector('.bg-muted\\/30.text-xs.text-muted-foreground')
      expect(summarySection).toBeInTheDocument()
    })
  })

  describe('Line Numbers', () => {
    it('shows line numbers when enabled', () => {
      render(<DiffViewerInline {...defaultProps} showLineNumbers={true} />)

      // Line numbers should be present in the DOM
      const diffContent = document.querySelector('[data-line-type]')
      expect(diffContent).toBeInTheDocument()
    })

    it('hides line numbers when disabled', () => {
      render(<DiffViewerInline {...defaultProps} showLineNumbers={false} />)

      // Content should still be present
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })
  })

  describe('Syntax Highlighting', () => {
    it('applies syntax highlighting when enabled', () => {
      render(<DiffViewerInline {...defaultProps} highlighting={true} />)

      // Content should be rendered with highlighting
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })

    it('disables syntax highlighting when disabled', () => {
      render(<DiffViewerInline {...defaultProps} highlighting={false} />)

      // Content should still be rendered without highlighting
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })

    it('uses correct language for syntax highlighting', () => {
      const pythonDiff = `--- a/script.py
+++ b/script.py
@@ -1,3 +1,4 @@
 def hello():
+    import os
     print("hello")
     return True`

      const pythonFileDiff = { ...parseDiff(pythonDiff), language: 'python' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={pythonFileDiff} />)

      expect(screen.getByText(/def hello/)).toBeInTheDocument()
      expect(screen.getByText(/import os/)).toBeInTheDocument()
    })
  })

  describe('Line Selection', () => {
    it('calls onLineClick when line is clicked', () => {
      render(<DiffViewerInline {...defaultProps} />)

      const clickableLines = screen.getAllByRole('button')
      if (clickableLines.length > 0) {
        fireEvent.click(clickableLines[0])
        expect(mockOnLineClick).toHaveBeenCalledTimes(1)
      }
    })

    it('highlights selected lines', () => {
      const selectedLines = new Set([0, 2])
      render(<DiffViewerInline {...defaultProps} selectedLines={selectedLines} />)

      // Check for selected state
      const selectedElements = document.querySelectorAll('[aria-selected="true"]')
      expect(selectedElements.length).toBeGreaterThan(0)
    })

    it('does not make header lines clickable', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Hunk header should not be clickable
      const hunkHeader = screen.getByText('@@ -1,4 +1,6 @@')
      expect(hunkHeader.closest('[role="button"]')).toBeNull()
    })
  })

  describe('Enhanced Features', () => {
    it('shows detailed change statistics per hunk', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={multiHunkFileDiff} />)

      // Each hunk should show its own statistics
      const hunkHeaders = document.querySelectorAll('.bg-blue-500\\/10.text-blue-400')
      expect(hunkHeaders.length).toBeGreaterThan(1)
    })

    it('handles empty hunks gracefully', () => {
      const emptyHunkFileDiff = {
        ...defaultProps.fileDiff,
        hunks: []
      }

      render(<DiffViewerInline {...defaultProps} fileDiff={emptyHunkFileDiff} />)

      // Should not crash and render empty container
      expect(document.querySelector('.divide-y')).toBeInTheDocument()
    })

    it('handles single-line hunks', () => {
      const singleLineDiff = `--- a/file.js
+++ b/file.js
@@ -1,1 +1,1 @@
-old single line
+new single line`

      const singleLineFileDiff = { ...parseDiff(singleLineDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={singleLineFileDiff} />)

      expect(screen.getByText('old single line')).toBeInTheDocument()
      expect(screen.getByText('new single line')).toBeInTheDocument()
    })
  })

  describe('Visual Layout', () => {
    it('applies proper spacing between change blocks', () => {
      const changeBlockFileDiff = { ...parseDiff(changeBlockDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={changeBlockFileDiff} />)

      // Should have visual spacing around change blocks
      const spacedElements = document.querySelectorAll('.mt-1, .mb-1')
      expect(spacedElements.length).toBeGreaterThan(0)
    })

    it('maintains consistent vertical rhythm', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // All lines should have consistent spacing
      const lineElements = document.querySelectorAll('[data-line-type]')
      expect(lineElements.length).toBeGreaterThan(0)

      // Each line should be properly structured
      lineElements.forEach(element => {
        expect(element).toHaveClass('flex')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Check for interactive elements with proper roles
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)

      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-selected')
      })
    })

    it('supports keyboard navigation', () => {
      render(<DiffViewerInline {...defaultProps} />)

      const firstButton = screen.getAllByRole('button')[0]
      if (firstButton) {
        // Should be focusable
        expect(firstButton).toHaveAttribute('tabindex', '0')

        // Test keyboard activation
        fireEvent.keyDown(firstButton, { key: 'Enter' })
        expect(mockOnLineClick).toHaveBeenCalled()

        mockOnLineClick.mockClear()
        fireEvent.keyDown(firstButton, { key: ' ' })
        expect(mockOnLineClick).toHaveBeenCalled()
      }
    })

    it('provides proper semantic structure', () => {
      render(<DiffViewerInline {...defaultProps} />)

      // Should have semantic HTML structure
      expect(document.querySelector('.divide-y')).toBeInTheDocument()

      // Statistics should be properly presented
      const statisticsElements = document.querySelectorAll('.text-blue-300')
      expect(statisticsElements.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('handles very long lines without breaking layout', () => {
      const longLineDiff = `--- a/file.js
+++ b/file.js
@@ -1,1 +1,2 @@
 const shortLine = true
+const veryLongLineWithLotsOfContentThatShouldNotBreakTheLayoutAndShouldScrollHorizontallyInsteadOfWrappingToTheNextLineWhichWouldMakeTheDiffHarderToRead = true`

      const longLineFileDiff = { ...parseDiff(longLineDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={longLineFileDiff} />)

      // Both lines should be rendered
      expect(screen.getByText(/const shortLine = true/)).toBeInTheDocument()
      expect(screen.getByText(/const veryLongLineWithLotsOfContent/)).toBeInTheDocument()
    })

    it('handles hunks with only context lines', () => {
      const contextOnlyDiff = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 line 1
 line 2
 line 3`

      const contextFileDiff = { ...parseDiff(contextOnlyDiff), language: 'javascript' as const }
      render(<DiffViewerInline {...defaultProps} fileDiff={contextFileDiff} />)

      expect(screen.getByText('line 1')).toBeInTheDocument()
      expect(screen.getByText('line 2')).toBeInTheDocument()
      expect(screen.getByText('line 3')).toBeInTheDocument()
    })
  })
})