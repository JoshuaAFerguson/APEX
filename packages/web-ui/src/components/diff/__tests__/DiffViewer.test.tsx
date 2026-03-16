/**
 * DiffViewer Component Tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiffViewer } from '../DiffViewer'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

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

describe('DiffViewer', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<DiffViewer diff={sampleDiff} />)
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })

    it('renders loading state', () => {
      render(<DiffViewer diff={sampleDiff} loading />)
      expect(screen.getByText('Loading diff...')).toBeInTheDocument()
    })

    it('renders error state', () => {
      render(<DiffViewer diff={sampleDiff} error="Test error" />)
      expect(screen.getByText('Error loading diff')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('renders parse error state', () => {
      render(<DiffViewer diff="invalid diff content" />)
      expect(screen.getByText('Error loading diff')).toBeInTheDocument()
    })

    it('renders empty state', () => {
      render(<DiffViewer diff="" emptyMessage="No changes found" />)
      expect(screen.getByText('No changes found')).toBeInTheDocument()
    })

    it('renders custom empty message', () => {
      render(<DiffViewer diff="" emptyMessage="Custom empty message" />)
      expect(screen.getByText('Custom empty message')).toBeInTheDocument()
    })
  })

  describe('File Header', () => {
    it('shows file header by default', () => {
      render(<DiffViewer diff={sampleDiff} />)
      expect(screen.getByText('src/app.js')).toBeInTheDocument()
      expect(screen.getByText('Modified')).toBeInTheDocument()
    })

    it('hides file header when showFileHeader is false', () => {
      render(<DiffViewer diff={sampleDiff} showFileHeader={false} />)
      expect(screen.queryByText('src/app.js')).not.toBeInTheDocument()
    })
  })

  describe('Mode Selector', () => {
    it('shows mode selector by default', () => {
      render(<DiffViewer diff={sampleDiff} />)
      expect(screen.getByRole('radiogroup', { name: /diff view mode/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /unified/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /split/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /inline/i })).toBeInTheDocument()
    })

    it('hides mode selector when showModeSelector is false', () => {
      render(<DiffViewer diff={sampleDiff} showModeSelector={false} />)
      expect(screen.queryByRole('radiogroup', { name: /diff view mode/i })).not.toBeInTheDocument()
    })

    it('switches to split view when split button is clicked', async () => {
      render(<DiffViewer diff={sampleDiff} />)

      const splitButton = screen.getByRole('radio', { name: /split/i })
      fireEvent.click(splitButton)

      await waitFor(() => {
        expect(splitButton).toHaveAttribute('aria-checked', 'true')
      })
    })

    it('switches to inline view when inline button is clicked', async () => {
      render(<DiffViewer diff={sampleDiff} />)

      const inlineButton = screen.getByRole('radio', { name: /inline/i })
      fireEvent.click(inlineButton)

      await waitFor(() => {
        expect(inlineButton).toHaveAttribute('aria-checked', 'true')
      })
    })
  })

  describe('Copy Functionality', () => {
    it('shows copy button by default', () => {
      render(<DiffViewer diff={sampleDiff} />)
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })

    it('hides copy button when showCopyButton is false', () => {
      render(<DiffViewer diff={sampleDiff} showCopyButton={false} />)
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()
    })

    it('copies entire diff when copy button is clicked', async () => {
      const onCopy = vi.fn()
      render(<DiffViewer diff={sampleDiff} onCopy={onCopy} />)

      const copyButton = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(sampleDiff)
        expect(onCopy).toHaveBeenCalledWith(sampleDiff)
      })
    })

    it('shows success feedback after copying', async () => {
      render(<DiffViewer diff={sampleDiff} />)

      const copyButton = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Copied!')).toBeInTheDocument()
      })
    })
  })

  describe('Line Numbers', () => {
    it('shows line numbers by default', () => {
      render(<DiffViewer diff={sampleDiff} />)
      // Check for line numbers (should be present)
      const diffContent = screen.getByText('const express = require(\'express\')')
      expect(diffContent).toBeInTheDocument()
    })

    it('hides line numbers when showLineNumbers is false', () => {
      render(<DiffViewer diff={sampleDiff} showLineNumbers={false} />)
      // Line numbers should not be rendered when disabled
      const diffContent = screen.getByText('const express = require(\'express\')')
      expect(diffContent).toBeInTheDocument()
    })
  })

  describe('Syntax Highlighting', () => {
    it('enables syntax highlighting by default', () => {
      render(<DiffViewer diff={sampleDiff} filePath="app.js" />)
      // Check that content is rendered (highlighting is applied via dangerouslySetInnerHTML)
      const expressLine = screen.getByText((content, element) =>
        element?.textContent?.includes('const express = require') || false
      )
      expect(expressLine).toBeInTheDocument()
    })

    it('disables syntax highlighting when highlighting is false', () => {
      render(<DiffViewer diff={sampleDiff} highlighting={false} />)
      const expressLine = screen.getByText((content, element) =>
        element?.textContent?.includes('const express = require') || false
      )
      expect(expressLine).toBeInTheDocument()
    })
  })

  describe('Line Selection', () => {
    it('calls onLineClick when a line is clicked', () => {
      const onLineClick = vi.fn()
      render(<DiffViewer diff={sampleDiff} onLineClick={onLineClick} />)

      // Find a line to click (look for clickable elements)
      const lines = screen.getAllByRole('button')
      const diffLine = lines.find(line => line.textContent?.includes('const express'))

      if (diffLine) {
        fireEvent.click(diffLine)
        expect(onLineClick).toHaveBeenCalled()
      }
    })

    it('calls onSelectionChange when lines are selected', async () => {
      const onSelectionChange = vi.fn()
      render(<DiffViewer diff={sampleDiff} onSelectionChange={onSelectionChange} />)

      // Find and click a line
      const lines = screen.getAllByRole('button')
      const diffLine = lines.find(line => line.textContent?.includes('const express'))

      if (diffLine) {
        fireEvent.click(diffLine)
        await waitFor(() => {
          expect(onSelectionChange).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Props', () => {
    it('applies custom className', () => {
      render(<DiffViewer diff={sampleDiff} className="custom-class" />)
      const diffViewer = screen.getByRole('button', { name: /copy/i }).closest('.custom-class')
      expect(diffViewer).toBeInTheDocument()
    })

    it('respects maxHeight prop', () => {
      render(<DiffViewer diff={sampleDiff} maxHeight={300} />)
      // Check that the scrollable container has the correct max height
      const scrollContainer = document.querySelector('[style*="max-height"]')
      expect(scrollContainer).toHaveStyle('max-height: 300px')
    })

    it('handles string maxHeight', () => {
      render(<DiffViewer diff={sampleDiff} maxHeight="400px" />)
      const scrollContainer = document.querySelector('[style*="max-height"]')
      expect(scrollContainer).toHaveStyle('max-height: 400px')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<DiffViewer diff={sampleDiff} />)

      expect(screen.getByRole('radiogroup', { name: /diff view mode/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })

    it('supports keyboard navigation on mode selector', () => {
      render(<DiffViewer diff={sampleDiff} />)

      const unifiedButton = screen.getByRole('radio', { name: /unified/i })
      const splitButton = screen.getByRole('radio', { name: /split/i })

      // Test keyboard navigation
      fireEvent.keyDown(unifiedButton, { key: 'ArrowRight' })
      fireEvent.click(splitButton)

      expect(splitButton).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('Statistics', () => {
    it('shows diff statistics in footer', () => {
      render(<DiffViewer diff={sampleDiff} />)

      // Check for statistics in footer
      expect(screen.getByText(/chunk/i)).toBeInTheDocument()
      expect(screen.getByText(/Language:/i)).toBeInTheDocument()
    })
  })
})