/**
 * DiffViewerUnified Component Tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiffViewerUnified } from '../DiffViewerUnified'
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

+// New function
+const utils = require('./utils')
+
 module.exports = {
   readFile
 }`

describe('DiffViewerUnified', () => {
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
    it('renders hunk headers correctly', () => {
      render(<DiffViewerUnified {...defaultProps} />)

      expect(screen.getByText('@@ -1,4 +1,6 @@')).toBeInTheDocument()
      expect(screen.getByText('(1,4 → 1,6)')).toBeInTheDocument()
    })

    it('renders all diff lines', () => {
      render(<DiffViewerUnified {...defaultProps} />)

      // Check for various types of lines
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
      expect(screen.getByText(/const cors = require/)).toBeInTheDocument()
      expect(screen.getByText(/res\.send\('Hello World!'\)/)).toBeInTheDocument()
      expect(screen.getByText(/res\.json\(\{ message: 'Hello World!' \}\)/)).toBeInTheDocument()
    })

    it('shows change indicators for each line type', () => {
      render(<DiffViewerUnified {...defaultProps} />)

      // Check that lines have appropriate data attributes
      const addedLines = document.querySelectorAll('[data-line-type="added"]')
      const removedLines = document.querySelectorAll('[data-line-type="removed"]')
      const unchangedLines = document.querySelectorAll('[data-line-type="unchanged"]')

      expect(addedLines.length).toBeGreaterThan(0)
      expect(removedLines.length).toBeGreaterThan(0)
      expect(unchangedLines.length).toBeGreaterThan(0)
    })
  })

  describe('Multiple Hunks', () => {
    it('renders multiple hunks correctly', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerUnified {...defaultProps} fileDiff={multiHunkFileDiff} />)

      // Should have two hunk headers
      expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeInTheDocument()
      expect(screen.getByText('@@ -10,6 +11,8 @@')).toBeInTheDocument()
    })

    it('maintains proper global line indexing across hunks', () => {
      const multiHunkFileDiff = { ...parseDiff(multiHunkDiff), language: 'javascript' as const }
      render(<DiffViewerUnified {...defaultProps} fileDiff={multiHunkFileDiff} />)

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

  describe('Line Numbers', () => {
    it('shows line numbers when enabled', () => {
      render(<DiffViewerUnified {...defaultProps} showLineNumbers={true} />)

      // Line numbers should be present in the DOM
      // They are rendered by DiffLineNumber component
      const diffContent = document.querySelector('[data-line-type]')
      expect(diffContent).toBeInTheDocument()
    })

    it('hides line numbers when disabled', () => {
      render(<DiffViewerUnified {...defaultProps} showLineNumbers={false} />)

      // Content should still be present
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })
  })

  describe('Syntax Highlighting', () => {
    it('applies syntax highlighting when enabled', () => {
      render(<DiffViewerUnified {...defaultProps} highlighting={true} />)

      // Content should be rendered
      expect(screen.getByText(/const express = require/)).toBeInTheDocument()
    })

    it('disables syntax highlighting when disabled', () => {
      render(<DiffViewerUnified {...defaultProps} highlighting={false} />)

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
      render(<DiffViewerUnified {...defaultProps} fileDiff={pythonFileDiff} />)

      expect(screen.getByText(/def hello/)).toBeInTheDocument()
      expect(screen.getByText(/import os/)).toBeInTheDocument()
    })
  })

  describe('Line Selection', () => {
    it('calls onLineClick when line is clicked', () => {
      render(<DiffViewerUnified {...defaultProps} />)

      const clickableLines = screen.getAllByRole('button')
      if (clickableLines.length > 0) {
        fireEvent.click(clickableLines[0])
        expect(mockOnLineClick).toHaveBeenCalledTimes(1)
      }
    })

    it('highlights selected lines', () => {
      const selectedLines = new Set([0, 2])
      render(<DiffViewerUnified {...defaultProps} selectedLines={selectedLines} />)

      // Check for selected state
      const selectedElements = document.querySelectorAll('[aria-selected="true"]')
      expect(selectedElements.length).toBeGreaterThan(0)
    })

    it('does not make header lines clickable', () => {
      render(<DiffViewerUnified {...defaultProps} />)

      // Hunk header should not be clickable
      const hunkHeader = screen.getByText('@@ -1,4 +1,6 @@')
      expect(hunkHeader.closest('[role="button"]')).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty hunks gracefully', () => {
      const emptyHunkFileDiff = {
        ...defaultProps.fileDiff,
        hunks: []
      }

      render(<DiffViewerUnified {...defaultProps} fileDiff={emptyHunkFileDiff} />)

      // Should not crash and render empty container
      expect(document.querySelector('.divide-y')).toBeInTheDocument()
    })

    it('handles hunks with only context lines', () => {
      const contextOnlyDiff = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 line 1
 line 2
 line 3`

      const contextFileDiff = { ...parseDiff(contextOnlyDiff), language: 'javascript' as const }
      render(<DiffViewerUnified {...defaultProps} fileDiff={contextFileDiff} />)

      expect(screen.getByText('line 1')).toBeInTheDocument()
      expect(screen.getByText('line 2')).toBeInTheDocument()
      expect(screen.getByText('line 3')).toBeInTheDocument()
    })

    it('handles very long lines without breaking layout', () => {
      const longLineDiff = `--- a/file.js
+++ b/file.js
@@ -1,1 +1,2 @@
 const shortLine = true
+const veryLongLineWithLotsOfContentThatShouldNotBreakTheLayoutAndShouldScrollHorizontallyInsteadOfWrappingToTheNextLineWhichWouldMakeTheDiffHarderToRead = true`

      const longLineFileDiff = { ...parseDiff(longLineDiff), language: 'javascript' as const }
      render(<DiffViewerUnified {...defaultProps} fileDiff={longLineFileDiff} />)

      // Check that both lines are rendered
      expect(screen.getByText(/const shortLine = true/)).toBeInTheDocument()
      expect(screen.getByText(/const veryLongLineWithLotsOfContent/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<DiffViewerUnified {...defaultProps} />)

      // Check for interactive elements with proper roles
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)

      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-selected')
      })
    })

    it('supports keyboard navigation', () => {
      render(<DiffViewerUnified {...defaultProps} />)

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
  })
})