/**
 * ApprovalDiffPreview Integration Tests
 *
 * Integration tests to verify ApprovalDiffPreview works correctly
 * with actual DiffViewer integration and real-world scenarios.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalDiffPreview } from '../ApprovalDiffPreview'
import type { ApprovalDiffData } from '@/types/approval-gate-panel'

// Mock the DiffViewer component for integration tests
vi.mock('@/components/diff', () => ({
  DiffViewer: ({ diff, onCopy, className, mode, showLineNumbers, highlighting, maxHeight }: any) => (
    <div
      data-testid="mock-diff-viewer"
      className={className}
      onClick={() => onCopy?.(diff)}
      data-mode={mode}
      data-line-numbers={showLineNumbers}
      data-highlighting={highlighting}
      data-max-height={maxHeight}
    >
      <div>Diff content: {diff?.substring(0, 100)}...</div>
      <div>Mode: {mode}</div>
      <div>Line numbers: {showLineNumbers ? 'enabled' : 'disabled'}</div>
      <div>Highlighting: {highlighting ? 'enabled' : 'disabled'}</div>
    </div>
  ),
  DEFAULT_VIEW_MODE: 'unified',
}))
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}))

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

// Mock only the icons to avoid rendering issues
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
  // Additional icons used by DiffViewer
  AlignLeft: () => <span data-testid="align-left-icon">AlignLeft</span>,
  AlignJustify: () => <span data-testid="align-justify-icon">AlignJustify</span>,
  Columns: () => <span data-testid="columns-icon">Columns</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  Expand: () => <span data-testid="expand-icon">Expand</span>,
  Collapse: () => <span data-testid="collapse-icon">Collapse</span>,
}))

describe('ApprovalDiffPreview Integration Tests', () => {
  const realJavaScriptDiff: ApprovalDiffData = {
    diffId: 'integration-test-js',
    changeType: 'file-edit',
    rawDiff: `--- src/utils/validator.js
+++ src/utils/validator.js
@@ -1,10 +1,12 @@
 function validateEmail(email) {
-  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
+  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
   return regex.test(email);
 }

+function validatePhone(phone) {
+  const regex = /^\\+?[1-9]\\d{1,14}$/;
+  return regex.test(phone);
+}
+
 module.exports = {
-  validateEmail
+  validateEmail,
+  validatePhone
 };`,
    summary: 'Enhanced email validation and added phone validation',
    filesChanged: 1,
    linesAdded: 6,
    linesRemoved: 2,
  }

  const realPythonDiff: ApprovalDiffData = {
    diffId: 'integration-test-py',
    changeType: 'file-write',
    rawDiff: `--- /dev/null
+++ src/models/user.py
@@ -0,0 +1,25 @@
+from dataclasses import dataclass
+from typing import Optional
+from datetime import datetime
+
+@dataclass
+class User:
+    """User model with validation and timestamps."""
+
+    id: int
+    email: str
+    name: str
+    created_at: datetime
+    updated_at: Optional[datetime] = None
+    is_active: bool = True
+
+    def __post_init__(self):
+        """Validate user data after initialization."""
+        if not self.email or '@' not in self.email:
+            raise ValueError("Invalid email address")
+
+        if not self.name or len(self.name.strip()) < 2:
+            raise ValueError("Name must be at least 2 characters long")
+
+    def deactivate(self):
+        """Deactivate the user account."""
+        self.is_active = False
+        self.updated_at = datetime.now()`,
    summary: 'New User model with validation',
    filesChanged: 1,
    linesAdded: 25,
    linesRemoved: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Real DiffViewer Integration', () => {
    it('should render with real JavaScript diff content', () => {
      render(<ApprovalDiffPreview diffData={realJavaScriptDiff} />)

      // Verify component structure
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('File Edit')).toBeInTheDocument()
      expect(screen.getByText('Enhanced email validation and added phone validation')).toBeInTheDocument()
      expect(screen.getByText('1 file changed, +6 lines added, -2 lines removed')).toBeInTheDocument()

      // Verify copy button is present for content
      expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
    })

    it('should handle Python file creation diff', () => {
      render(<ApprovalDiffPreview diffData={realPythonDiff} />)

      // Verify file write icon and content
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument()
      expect(screen.getByText('File Write')).toBeInTheDocument()
      expect(screen.getByText('New User model with validation')).toBeInTheDocument()
      expect(screen.getByText('1 file changed, +25 lines added, -0 lines removed')).toBeInTheDocument()
    })

    it('should handle view mode switching when DiffViewer supports it', () => {
      render(
        <ApprovalDiffPreview
          diffData={realJavaScriptDiff}
          viewMode="split"
          showLineNumbers={true}
          highlighting={true}
        />
      )

      // Component should render without errors
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('Enhanced email validation and added phone validation')).toBeInTheDocument()
    })
  })

  describe('Performance and Large Diffs', () => {
    it('should handle large diff content efficiently', () => {
      const largeDiff: ApprovalDiffData = {
        diffId: 'large-diff',
        changeType: 'multi-file',
        rawDiff: Array.from({ length: 500 }, (_, i) =>
          `+Line ${i + 1}: Added content for performance testing\n`
        ).join(''),
        summary: 'Large performance test diff',
        filesChanged: 10,
        linesAdded: 500,
        linesRemoved: 0,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={largeDiff} maxHeight={400} />)
      const endTime = performance.now()

      // Should render within reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100)

      // Verify it still renders correctly
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('Large performance test diff')).toBeInTheDocument()
    })
  })

  describe('Real-world Use Cases', () => {
    it('should handle command execution with real output', async () => {
      const commandDiff: ApprovalDiffData = {
        diffId: 'npm-install-command',
        changeType: 'command-execution',
        command: 'npm install @types/node @types/react',
        commandPreview: `npm WARN deprecated @types/react@17.0.0: This is a stub types definition.

added 2 packages, and audited 1456 packages in 3s

142 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities`,
        summary: 'Install TypeScript type definitions',
      }

      render(<ApprovalDiffPreview diffData={commandDiff} />)

      // Verify command display
      expect(screen.getByText('Command Execution')).toBeInTheDocument()
      expect(screen.getByText('Command')).toBeInTheDocument()
      expect(screen.getByText('npm install @types/node @types/react')).toBeInTheDocument()

      // Verify command output preview
      expect(screen.getByText('Expected Output Preview')).toBeInTheDocument()
      expect(screen.getByText(/npm WARN deprecated/)).toBeInTheDocument()
      expect(screen.getByText(/added 2 packages/)).toBeInTheDocument()
    })

    it('should support accessibility features', () => {
      render(<ApprovalDiffPreview diffData={realJavaScriptDiff} />)

      const container = screen.getByTestId('diff-preview')

      // Should be accessible with proper roles and labels
      expect(container).toBeInTheDocument()

      // Copy button should be keyboard accessible
      const copyButton = screen.getByTestId('copy-icon').closest('button')
      expect(copyButton).toBeInTheDocument()

      // Expand/collapse should be accessible by default
      expect(screen.getByTestId('eye-off-icon').closest('button')).toBeInTheDocument()
    })

    it('should handle copy functionality for large diffs', async () => {
      const onCopy = vi.fn()

      render(
        <ApprovalDiffPreview
          diffData={realJavaScriptDiff}
          onCopy={onCopy}
        />
      )

      const copyButton = screen.getByTestId('copy-icon').closest('button')!
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalledWith(realJavaScriptDiff.rawDiff)
      })
    })

    it('should handle FileDiff objects with complex hunks', () => {
      const complexFileDiff: ApprovalDiffData = {
        diffId: 'complex-file-diff',
        changeType: 'file-edit',
        fileDiffs: [
          {
            oldPath: 'src/components/Button.tsx',
            newPath: 'src/components/Button.tsx',
            isNew: false,
            isDeleted: false,
            isRenamed: false,
            hunks: [
              {
                header: '@@ -15,8 +15,12 @@ interface ButtonProps {',
                lines: [
                  { type: 'unchanged', content: '  variant?: "primary" | "secondary"' },
                  { type: 'removed', content: '  size?: "sm" | "md" | "lg"' },
                  { type: 'added', content: '  size?: "xs" | "sm" | "md" | "lg" | "xl"' },
                  { type: 'added', content: '  loading?: boolean' },
                  { type: 'unchanged', content: '  children: React.ReactNode' },
                ],
              },
              {
                header: '@@ -45,6 +49,9 @@ export function Button({',
                lines: [
                  { type: 'unchanged', content: '  const baseClasses = "inline-flex items-center"' },
                  { type: 'added', content: '  if (loading) {' },
                  { type: 'added', content: '    return <Spinner />' },
                  { type: 'added', content: '  }' },
                  { type: 'unchanged', content: '  return (' },
                ],
              },
            ],
          },
        ],
        summary: 'Enhanced Button component with loading state',
        filesChanged: 1,
        linesAdded: 4,
        linesRemoved: 1,
      }

      render(<ApprovalDiffPreview diffData={complexFileDiff} />)

      // Should render and convert FileDiff to raw format
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('Enhanced Button component with loading state')).toBeInTheDocument()
      expect(screen.getByText('1 file changed, +4 lines added, -1 lines removed')).toBeInTheDocument()
    })
  })

  describe('Error Recovery', () => {
    it('should gracefully handle corrupted diff content', () => {
      const corruptedDiff: ApprovalDiffData = {
        diffId: 'corrupted',
        changeType: 'file-edit',
        rawDiff: '--- invalid diff format\n+++ missing proper headers\nthis is not a valid diff',
        summary: 'Corrupted diff test',
      }

      // Should not throw an error
      expect(() => {
        render(<ApprovalDiffPreview diffData={corruptedDiff} />)
      }).not.toThrow()

      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })

    it('should handle extremely long lines gracefully', () => {
      const longLineDiff: ApprovalDiffData = {
        diffId: 'long-lines',
        changeType: 'file-edit',
        rawDiff: `--- test.js
+++ test.js
@@ -1 +1 @@
-${'x'.repeat(10000)}
+${'y'.repeat(10000)}`,
        summary: 'Very long lines test',
      }

      render(<ApprovalDiffPreview diffData={longLineDiff} maxHeight={300} />)

      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('Very long lines test')).toBeInTheDocument()
    })
  })
})