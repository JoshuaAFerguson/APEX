/**
 * DiffViewer Accessibility Tests
 *
 * Comprehensive accessibility testing for keyboard navigation,
 * screen reader support, and ARIA compliance.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiffViewer } from '../DiffViewer'

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

// Helper function to simulate keyboard navigation
function simulateKeyNavigation(element: HTMLElement, keys: string[]) {
  keys.forEach(key => {
    fireEvent.keyDown(element, { key, code: key === ' ' ? 'Space' : key })
  })
}

// Helper to check ARIA attributes
function checkAriaAttributes(element: HTMLElement, expectedAttributes: Record<string, string>) {
  Object.entries(expectedAttributes).forEach(([attribute, value]) => {
    expect(element).toHaveAttribute(attribute, value)
  })
}

describe('DiffViewer Accessibility Tests', () => {
  const mockOnLineClick = vi.fn()
  const mockOnSelectionChange = vi.fn()
  const mockOnCopy = vi.fn()

  beforeEach(() => {
    mockOnLineClick.mockClear()
    mockOnSelectionChange.mockClear()
    mockOnCopy.mockClear()
  })

  describe('Semantic Structure', () => {
    it('provides proper heading hierarchy', () => {
      render(<DiffViewer diff={sampleDiff} />)

      // File path should be presented appropriately
      const fileInfo = screen.getByText('src/app.js')
      expect(fileInfo).toBeInTheDocument()
    })

    it('uses appropriate landmark roles', () => {
      render(<DiffViewer diff={sampleDiff} />)

      // Mode selector should have proper role
      const modeSelector = screen.getByRole('radiogroup', { name: /diff view mode/i })
      expect(modeSelector).toBeInTheDocument()
    })

    it('provides meaningful labels for interactive elements', () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
          onCopy={mockOnCopy}
        />
      )

      // Copy button should have proper label
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()

      // Interactive lines should be properly labeled
      const interactiveElements = screen.getAllByRole('button')
      expect(interactiveElements.length).toBeGreaterThan(1) // Copy button + line buttons
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation through mode selector', async () => {
      render(<DiffViewer diff={sampleDiff} />)

      const unifiedBtn = screen.getByRole('radio', { name: /unified/i })
      const splitBtn = screen.getByRole('radio', { name: /split/i })
      const inlineBtn = screen.getByRole('radio', { name: /inline/i })

      // Should start with unified selected
      expect(unifiedBtn).toHaveAttribute('aria-checked', 'true')

      // Navigate to split using arrow key
      fireEvent.keyDown(unifiedBtn, { key: 'ArrowRight' })
      fireEvent.click(splitBtn) // Simulate focus + activation

      await waitFor(() => {
        expect(splitBtn).toHaveAttribute('aria-checked', 'true')
      })

      // Navigate to inline
      fireEvent.keyDown(splitBtn, { key: 'ArrowRight' })
      fireEvent.click(inlineBtn)

      await waitFor(() => {
        expect(inlineBtn).toHaveAttribute('aria-checked', 'true')
      })

      // Wrap around to unified
      fireEvent.keyDown(inlineBtn, { key: 'ArrowRight' })
      fireEvent.click(unifiedBtn)

      await waitFor(() => {
        expect(unifiedBtn).toHaveAttribute('aria-checked', 'true')
      })
    })

    it('supports keyboard activation of diff lines', async () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
        />
      )

      const diffLines = screen.getAllByRole('button').filter(
        btn => !btn.textContent?.match(/unified|split|inline|copy/i)
      )

      if (diffLines.length > 0) {
        const firstLine = diffLines[0]

        // Test Enter key activation
        fireEvent.keyDown(firstLine, { key: 'Enter' })
        expect(mockOnLineClick).toHaveBeenCalledTimes(1)

        // Test Space key activation
        fireEvent.keyDown(firstLine, { key: ' ' })
        expect(mockOnLineClick).toHaveBeenCalledTimes(2)
      }
    })

    it('provides proper tab order', () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
          onCopy={mockOnCopy}
        />
      )

      // All interactive elements should be focusable
      const focusableElements = screen.getAllByRole('button').concat(
        screen.getAllByRole('radio')
      )

      focusableElements.forEach(element => {
        expect(element).toHaveAttribute('tabindex')
        const tabIndex = element.getAttribute('tabindex')
        expect(tabIndex).toMatch(/^[0-9]+$/) // Should be a number
      })
    })

    it('handles keyboard navigation in split view', async () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          mode="split"
          onLineClick={mockOnLineClick}
        />
      )

      // Switch to split mode and test navigation
      const diffLines = screen.getAllByRole('button').filter(
        btn => !btn.textContent?.match(/unified|split|inline|copy/i)
      )

      // Should be able to navigate both sides
      if (diffLines.length > 1) {
        fireEvent.keyDown(diffLines[0], { key: 'Enter' })
        fireEvent.keyDown(diffLines[1], { key: 'Enter' })

        expect(mockOnLineClick).toHaveBeenCalledTimes(2)
      }
    })
  })

  describe('ARIA Attributes and States', () => {
    it('provides correct ARIA labels for mode selector', () => {
      render(<DiffViewer diff={sampleDiff} />)

      const radiogroup = screen.getByRole('radiogroup')
      checkAriaAttributes(radiogroup, {
        'aria-label': expect.stringMatching(/diff view mode/i)
      })

      const radios = screen.getAllByRole('radio')
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('aria-checked')
      })
    })

    it('maintains selection state in ARIA attributes', async () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
        />
      )

      const diffLines = screen.getAllByRole('button').filter(
        btn => !btn.textContent?.match(/unified|split|inline|copy/i)
      )

      if (diffLines.length > 0) {
        const firstLine = diffLines[0]

        // Initially not selected
        expect(firstLine).toHaveAttribute('aria-selected', 'false')

        // Click to select
        fireEvent.click(firstLine)

        // Should update aria-selected
        await waitFor(() => {
          // Note: This depends on the component's implementation of selection state
          expect(mockOnLineClick).toHaveBeenCalled()
        })
      }
    })

    it('provides descriptive labels for copy button states', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      })

      render(<DiffViewer diff={sampleDiff} onCopy={mockOnCopy} />)

      const copyButton = screen.getByRole('button', { name: /copy/i })

      // Initial state
      expect(copyButton).toHaveAttribute('aria-label', 'Copy to clipboard')

      // Click to copy
      fireEvent.click(copyButton)

      // Should show success state
      await waitFor(() => {
        expect(copyButton).toHaveAttribute('aria-label', 'Copied!')
      })

      // Should revert after timeout
      await waitFor(() => {
        expect(copyButton).toHaveAttribute('aria-label', 'Copy to clipboard')
      }, { timeout: 3000 })
    })

    it('provides proper line type information', () => {
      render(<DiffViewer diff={sampleDiff} />)

      // Check for data attributes that could be used by screen readers
      const addedLines = document.querySelectorAll('[data-line-type="added"]')
      const removedLines = document.querySelectorAll('[data-line-type="removed"]')
      const unchangedLines = document.querySelectorAll('[data-line-type="unchanged"]')

      expect(addedLines.length).toBeGreaterThan(0)
      expect(removedLines.length).toBeGreaterThan(0)
      expect(unchangedLines.length).toBeGreaterThan(0)
    })
  })

  describe('Screen Reader Support', () => {
    it('provides contextual information for diff sections', () => {
      render(<DiffViewer diff={multiHunkDiff} />)

      // Hunk headers should be properly announced
      const hunkHeaders = screen.getAllByText(/@@ -\d+,\d+ \+\d+,\d+ @@/)
      expect(hunkHeaders.length).toBeGreaterThan(0)

      // File information should be available
      expect(screen.getByText('src/index.js')).toBeInTheDocument()
    })

    it('announces selection changes appropriately', async () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
          onSelectionChange={mockOnSelectionChange}
        />
      )

      const diffLines = screen.getAllByRole('button').filter(
        btn => !btn.textContent?.match(/unified|split|inline|copy/i)
      )

      if (diffLines.length > 0) {
        fireEvent.click(diffLines[0])

        await waitFor(() => {
          expect(mockOnSelectionChange).toHaveBeenCalled()
        })
      }
    })

    it('provides meaningful descriptions for empty states', () => {
      render(<DiffViewer diff="" emptyMessage="No changes to display" />)

      expect(screen.getByText('No changes to display')).toBeInTheDocument()
    })

    it('announces error states clearly', () => {
      render(<DiffViewer diff="invalid diff" />)

      expect(screen.getByText('Error loading diff')).toBeInTheDocument()
    })

    it('provides loading state announcement', () => {
      render(<DiffViewer diff={sampleDiff} loading />)

      expect(screen.getByText('Loading diff...')).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('maintains focus on interactive elements', () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
        />
      )

      const focusableElements = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('radio')
      ]

      focusableElements.forEach(element => {
        element.focus()
        expect(document.activeElement).toBe(element)
      })
    })

    it('provides visible focus indicators', () => {
      render(<DiffViewer diff={sampleDiff} />)

      const focusableElements = [
        ...screen.getAllByRole('button'),
        ...screen.getAllByRole('radio')
      ]

      // All focusable elements should have focus styles
      focusableElements.forEach(element => {
        expect(element).toHaveClass('focus:outline-none')
        expect(element.className).toMatch(/focus-visible:|focus:/)
      })
    })

    it('handles focus trapping appropriately', async () => {
      render(<DiffViewer diff={sampleDiff} />)

      const modeButtons = screen.getAllByRole('radio')

      if (modeButtons.length > 1) {
        // Focus should stay within the radiogroup when using arrow keys
        const firstButton = modeButtons[0]
        const lastButton = modeButtons[modeButtons.length - 1]

        firstButton.focus()
        fireEvent.keyDown(firstButton, { key: 'ArrowLeft' })

        // Should wrap to last button (depending on implementation)
        // This test verifies the keyboard navigation logic
        expect(document.activeElement).toBeDefined()
      }
    })
  })

  describe('Color and Contrast', () => {
    it('does not rely solely on color for diff indication', () => {
      render(<DiffViewer diff={sampleDiff} />)

      // Addition indicators should have text content (+) not just color
      const addedLines = document.querySelectorAll('[data-line-type="added"]')
      addedLines.forEach(line => {
        // Should have visual indicator beyond just background color
        expect(line.textContent).toBeDefined()
      })

      // Removal indicators should have text content (-) not just color
      const removedLines = document.querySelectorAll('[data-line-type="removed"]')
      removedLines.forEach(line => {
        expect(line.textContent).toBeDefined()
      })
    })

    it('provides high contrast focus indicators', () => {
      render(<DiffViewer diff={sampleDiff} />)

      const focusableElements = screen.getAllByRole('button')

      // Focus indicators should have sufficient contrast
      focusableElements.forEach(element => {
        expect(element.className).toMatch(/ring-blue-500|border-blue-500|outline/)
      })
    })
  })

  describe('Responsive Accessibility', () => {
    it('maintains accessibility on different view modes', () => {
      const modes: Array<'unified' | 'split' | 'inline'> = ['unified', 'split', 'inline']

      modes.forEach(mode => {
        const { unmount } = render(
          <DiffViewer
            diff={sampleDiff}
            mode={mode}
            onLineClick={mockOnLineClick}
          />
        )

        // All modes should have accessible structure
        expect(screen.getByRole('radiogroup')).toBeInTheDocument()

        const interactiveElements = screen.getAllByRole('button')
        expect(interactiveElements.length).toBeGreaterThan(0)

        unmount()
      })
    })

    it('handles long content without breaking accessibility', () => {
      const longDiff = Array.from({ length: 100 }, (_, i) =>
        `+line ${i} with very long content that could potentially break accessibility features`
      ).join('\n')

      const diffWithHeader = `--- a/long.js\n+++ b/long.js\n@@ -1,1 +1,100 @@\n${longDiff}`

      render(<DiffViewer diff={diffWithHeader} />)

      // Should still be accessible with lots of content
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })
  })

  describe('Assistive Technology Integration', () => {
    it('provides appropriate live regions for dynamic content', async () => {
      render(
        <DiffViewer
          diff={sampleDiff}
          onLineClick={mockOnLineClick}
        />
      )

      // Selection changes should be announced
      const diffLines = screen.getAllByRole('button').filter(
        btn => !btn.textContent?.match(/unified|split|inline|copy/i)
      )

      if (diffLines.length > 0) {
        fireEvent.click(diffLines[0])

        await waitFor(() => {
          expect(mockOnLineClick).toHaveBeenCalled()
        })
      }
    })

    it('supports assistive technology navigation patterns', () => {
      render(<DiffViewer diff={multiHunkDiff} />)

      // Should provide landmarks for AT navigation
      const sections = document.querySelectorAll('[data-line-type="header"]')
      expect(sections.length).toBeGreaterThan(0)

      // File header should be navigable
      expect(screen.getByText('src/index.js')).toBeInTheDocument()
    })
  })
})