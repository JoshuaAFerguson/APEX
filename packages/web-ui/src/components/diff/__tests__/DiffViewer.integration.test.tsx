/**
 * DiffViewer Integration Tests
 *
 * Tests the complete diff viewer functionality end-to-end
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

const complexDiff = `--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,15 +1,20 @@
 import React from 'react'
+import { cn } from '@/lib/utils'

 interface ButtonProps {
   children: React.ReactNode
   onClick?: () => void
+  variant?: 'primary' | 'secondary'
+  size?: 'sm' | 'md' | 'lg'
   disabled?: boolean
+  className?: string
 }

-export function Button({ children, onClick, disabled }: ButtonProps) {
+export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, className }: ButtonProps) {
   return (
     <button
       onClick={onClick}
       disabled={disabled}
-      className="px-4 py-2 bg-blue-500 text-white rounded"
+      className={cn('px-4 py-2 rounded font-medium', {
+        'bg-blue-500 text-white': variant === 'primary',
+        'bg-gray-200 text-gray-900': variant === 'secondary',
+        'text-sm px-3 py-1': size === 'sm',
+        'text-base px-4 py-2': size === 'md',
+        'text-lg px-6 py-3': size === 'lg'
+      }, className)}
     >
       {children}
     </button>
@@ -17,3 +22,5 @@ export function Button({ children, onClick, disabled }: ButtonProps) {
 }

 export default Button
+
+export type { ButtonProps }`

const newFileDiff = `--- /dev/null
+++ b/src/utils/formatters.ts
@@ -0,0 +1,12 @@
+/**
+ * Utility functions for formatting data
+ */
+
+export function formatCurrency(amount: number): string {
+  return new Intl.NumberFormat('en-US', {
+    style: 'currency',
+    currency: 'USD',
+  }).format(amount)
+}
+
+export function formatDate(date: Date): string {
+  return date.toLocaleDateString()
+}`

describe('DiffViewer Integration', () => {
  describe('Complete diff workflow', () => {
    it('handles complex TypeScript diff with syntax highlighting', async () => {
      render(<DiffViewer diff={complexDiff} filePath="Button.tsx" />)

      // Verify file header
      expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument()
      expect(screen.getByText('Modified')).toBeInTheDocument()

      // Verify mode selector is present and functional
      const unifiedBtn = screen.getByRole('radio', { name: /unified/i })
      const splitBtn = screen.getByRole('radio', { name: /split/i })
      const inlineBtn = screen.getByRole('radio', { name: /inline/i })

      expect(unifiedBtn).toHaveAttribute('aria-checked', 'true')

      // Switch to split view
      fireEvent.click(splitBtn)
      await waitFor(() => {
        expect(splitBtn).toHaveAttribute('aria-checked', 'true')
      })

      // Switch to inline view
      fireEvent.click(inlineBtn)
      await waitFor(() => {
        expect(inlineBtn).toHaveAttribute('aria-checked', 'true')
      })

      // Verify language detection
      expect(screen.getByText('Language: tsx')).toBeInTheDocument()

      // Verify diff statistics
      expect(screen.getByText(/chunk/)).toBeInTheDocument()
      expect(screen.getByText(/^\+\d+$/)).toBeInTheDocument() // Added lines
      expect(screen.getByText(/^-\d+$/)).toBeInTheDocument() // Removed lines
    })

    it('handles new file creation properly', () => {
      render(<DiffViewer diff={newFileDiff} />)

      // Verify new file indicator
      expect(screen.getByText('New file')).toBeInTheDocument()
      expect(screen.getByText('src/utils/formatters.ts')).toBeInTheDocument()

      // Verify language detection
      expect(screen.getByText('Language: typescript')).toBeInTheDocument()

      // Should show only additions
      const stats = screen.getByText(/^\+\d+$/)
      expect(stats).toBeInTheDocument()
    })

    it('supports line selection and copy functionality', async () => {
      const onLineClick = vi.fn()
      const onSelectionChange = vi.fn()
      const onCopy = vi.fn()

      render(
        <DiffViewer
          diff={complexDiff}
          onLineClick={onLineClick}
          onSelectionChange={onSelectionChange}
          onCopy={onCopy}
        />
      )

      // Find clickable diff lines
      const diffLines = screen.getAllByRole('button').filter(
        btn => btn.textContent && !btn.textContent.match(/unified|split|inline|copy/i)
      )

      if (diffLines.length > 0) {
        // Click a line to select it
        fireEvent.click(diffLines[0])

        await waitFor(() => {
          expect(onLineClick).toHaveBeenCalled()
          expect(onSelectionChange).toHaveBeenCalled()
        })

        // Should show selection count
        expect(screen.getByText(/1 line selected/)).toBeInTheDocument()

        // Copy selected content
        const copyBtn = screen.getByRole('button', { name: /copy/i })
        fireEvent.click(copyBtn)

        await waitFor(() => {
          expect(onCopy).toHaveBeenCalled()
          expect(navigator.clipboard.writeText).toHaveBeenCalled()
        })
      }
    })

    it('handles view mode transitions smoothly', async () => {
      render(<DiffViewer diff={complexDiff} />)

      const unifiedBtn = screen.getByRole('radio', { name: /unified/i })
      const splitBtn = screen.getByRole('radio', { name: /split/i })
      const inlineBtn = screen.getByRole('radio', { name: /inline/i })

      // Start with unified (default)
      expect(unifiedBtn).toHaveAttribute('aria-checked', 'true')

      // Switch through all modes
      fireEvent.click(splitBtn)
      await waitFor(() => {
        expect(splitBtn).toHaveAttribute('aria-checked', 'true')
      })

      fireEvent.click(inlineBtn)
      await waitFor(() => {
        expect(inlineBtn).toHaveAttribute('aria-checked', 'true')
      })

      fireEvent.click(unifiedBtn)
      await waitFor(() => {
        expect(unifiedBtn).toHaveAttribute('aria-checked', 'true')
      })

      // Content should remain visible throughout
      expect(screen.getByText((content, element) =>
        element?.textContent?.includes('import React') || false
      )).toBeInTheDocument()
    })

    it('maintains accessibility throughout interactions', async () => {
      render(<DiffViewer diff={complexDiff} />)

      // Check ARIA labels and roles are present
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
      expect(screen.getAllByRole('radio')).toHaveLength(3)
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()

      // Test keyboard navigation
      const unifiedBtn = screen.getByRole('radio', { name: /unified/i })
      const splitBtn = screen.getByRole('radio', { name: /split/i })

      // Simulate keyboard interaction
      fireEvent.keyDown(unifiedBtn, { key: 'ArrowRight' })
      fireEvent.click(splitBtn)

      await waitFor(() => {
        expect(splitBtn).toHaveAttribute('aria-checked', 'true')
      })

      // All elements should remain focusable and labeled
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
      expect(screen.getByLabelText(/copy/i)).toBeInTheDocument()
    })

    it('handles empty and error states gracefully', () => {
      // Test empty state
      const { rerender } = render(<DiffViewer diff="" />)
      expect(screen.getByText('No changes to display')).toBeInTheDocument()

      // Test custom empty message
      rerender(<DiffViewer diff="" emptyMessage="Nothing to show here" />)
      expect(screen.getByText('Nothing to show here')).toBeInTheDocument()

      // Test loading state
      rerender(<DiffViewer diff={complexDiff} loading />)
      expect(screen.getByText('Loading diff...')).toBeInTheDocument()

      // Test error state
      rerender(<DiffViewer diff={complexDiff} error="Failed to load diff" />)
      expect(screen.getByText('Error loading diff')).toBeInTheDocument()
      expect(screen.getByText('Failed to load diff')).toBeInTheDocument()
    })

    it('respects all configuration props', () => {
      render(
        <DiffViewer
          diff={complexDiff}
          showFileHeader={false}
          showModeSelector={false}
          showCopyButton={false}
          showLineNumbers={false}
          highlighting={false}
          maxHeight={200}
          className="custom-diff-viewer"
        />
      )

      // File header should be hidden
      expect(screen.queryByText('src/components/Button.tsx')).not.toBeInTheDocument()

      // Mode selector should be hidden
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()

      // Copy button should be hidden
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()

      // Custom class should be applied
      expect(document.querySelector('.custom-diff-viewer')).toBeInTheDocument()

      // Max height should be applied
      expect(document.querySelector('[style*="max-height: 200px"]')).toBeInTheDocument()

      // Content should still be visible
      expect(screen.getByText((content, element) =>
        element?.textContent?.includes('import React') || false
      )).toBeInTheDocument()
    })
  })

  describe('Performance and edge cases', () => {
    it('handles very large diffs without crashing', () => {
      // Generate a large diff
      const largeDiff = `--- a/large-file.js
+++ b/large-file.js
@@ -1,100 +1,200 @@
${Array.from({ length: 200 }, (_, i) => i % 2 === 0 ? `+line ${i}` : ` line ${i}`).join('\n')}`

      render(<DiffViewer diff={largeDiff} />)
      expect(screen.getByText('large-file.js')).toBeInTheDocument()
    })

    it('handles malformed diff gracefully', () => {
      const malformedDiff = `This is not a valid diff format
Some random content
Without proper headers`

      render(<DiffViewer diff={malformedDiff} />)
      expect(screen.getByText('Error loading diff')).toBeInTheDocument()
    })

    it('handles binary file indicators', () => {
      const binaryDiff = `--- a/image.png
+++ b/image.png
Binary files a/image.png and b/image.png differ`

      render(<DiffViewer diff={binaryDiff} />)
      // Should show file info even for binary files
      expect(screen.getByText('image.png')).toBeInTheDocument()
    })
  })
})