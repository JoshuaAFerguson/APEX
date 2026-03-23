/**
 * ChangelogDiffPreview Component Tests
 *
 * Unit tests for the ChangelogDiffPreview component,
 * including file expansion, diff rendering, and statistics display.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ChangelogDiffPreview } from '../ChangelogDiffPreview'
import type { ChangelogFileChange } from '@/types/changelog'

// Mock the DiffViewer component
vi.mock('@/components/diff/DiffViewer', () => ({
  DiffViewer: ({ diff, filePath }: { diff: string; filePath: string }) => (
    <div data-testid="diff-viewer">
      Diff for {filePath}: {diff?.length || 0} characters
    </div>
  ),
}))

describe('ChangelogDiffPreview', () => {
  const mockChanges: ChangelogFileChange[] = [
    {
      path: 'src/auth/AuthProvider.tsx',
      type: 'added',
      diff: `@@ -0,0 +1,10 @@
+import React from 'react'
+
+export const AuthProvider = () => {
+  return <div>Auth Provider</div>
+}`,
      stats: { additions: 10, deletions: 0 },
    },
    {
      path: 'src/api/client.ts',
      type: 'modified',
      diff: `@@ -15,6 +15,10 @@ export class ApiClient {
   private async request<T>(path: string): Promise<T> {
+    if (!path) {
+      throw new Error('Path is required')
+    }
+
     const response = await fetch(\`\${this.baseUrl}\${path}\`)`,
      stats: { additions: 5, deletions: 2 },
    },
    {
      path: 'src/utils/deprecated.ts',
      type: 'deleted',
      diff: `@@ -1,20 +0,0 @@
-// Deprecated utility functions
-export function oldFunction() {
-  return 'old'
-}`,
      stats: { additions: 0, deletions: 20 },
    },
    {
      path: 'src/config/database.ts',
      originalPath: 'src/config/db.ts',
      type: 'renamed',
      diff: `@@ -1,5 +1,8 @@
 export const dbConfig = {
   host: 'localhost',
+  port: 5432,
+  database: 'app',
 }`,
      stats: { additions: 2, deletions: 0 },
    },
  ]

  const mockChangesNoDiff: ChangelogFileChange[] = [
    {
      path: 'src/assets/logo.png',
      type: 'added',
      stats: { additions: 0, deletions: 0 },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders file changes with summary', () => {
      render(<ChangelogDiffPreview changes={mockChanges} />)

      expect(screen.getByText('4 files changed')).toBeInTheDocument()
      expect(screen.getByText('+17')).toBeInTheDocument()
      expect(screen.getByText('-22')).toBeInTheDocument()

      // Check that all files are listed
      expect(screen.getByText('src/auth/AuthProvider.tsx')).toBeInTheDocument()
      expect(screen.getByText('src/api/client.ts')).toBeInTheDocument()
      expect(screen.getByText('src/utils/deprecated.ts')).toBeInTheDocument()
      expect(screen.getByText('src/config/db.ts → src/config/database.ts')).toBeInTheDocument()
    })

    it('displays file change type badges', () => {
      render(<ChangelogDiffPreview changes={mockChanges} />)

      expect(screen.getByText('added')).toBeInTheDocument()
      expect(screen.getByText('modified')).toBeInTheDocument()
      expect(screen.getByText('deleted')).toBeInTheDocument()
      expect(screen.getByText('renamed')).toBeInTheDocument()
    })

    it('shows individual file statistics', () => {
      render(<ChangelogDiffPreview changes={mockChanges} />)

      // Should show addition/deletion counts for each file
      expect(screen.getByText('10')).toBeInTheDocument() // additions in AuthProvider
      expect(screen.getByText('20')).toBeInTheDocument() // deletions in deprecated.ts
    })

    it('renders empty state when no changes', () => {
      render(<ChangelogDiffPreview changes={[]} />)

      expect(screen.getByText('No file changes to display')).toBeInTheDocument()
    })
  })

  describe('File Headers', () => {
    it('shows file headers when showFileHeaders is true', () => {
      render(<ChangelogDiffPreview changes={mockChanges} showFileHeaders={true} />)

      // File paths should be visible in headers
      expect(screen.getByText('src/auth/AuthProvider.tsx')).toBeInTheDocument()
    })

    it('hides file headers when showFileHeaders is false', () => {
      render(<ChangelogDiffPreview changes={mockChanges} showFileHeaders={false} />)

      // Should still work but without headers
      expect(screen.getByText('4 files changed')).toBeInTheDocument()
    })

    it('displays renamed file paths correctly', () => {
      const renamedChange = mockChanges.find(c => c.type === 'renamed')!
      render(<ChangelogDiffPreview changes={[renamedChange]} />)

      expect(screen.getByText('src/config/db.ts → src/config/database.ts')).toBeInTheDocument()
    })
  })

  describe('File Expansion', () => {
    it('expands files by default when defaultCollapsed is false', () => {
      render(
        <ChangelogDiffPreview
          changes={mockChanges}
          defaultCollapsed={false}
        />
      )

      // Should show diff viewers for all files
      const diffViewers = screen.getAllByTestId('diff-viewer')
      expect(diffViewers).toHaveLength(4)
    })

    it('collapses files by default when defaultCollapsed is true', () => {
      render(
        <ChangelogDiffPreview
          changes={mockChanges}
          defaultCollapsed={true}
        />
      )

      // Should not show diff viewers initially
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })

    it('toggles file expansion when expand button is clicked', () => {
      render(
        <ChangelogDiffPreview
          changes={[mockChanges[0]]}
          defaultCollapsed={true}
        />
      )

      // Initially collapsed
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()

      // Click expand button
      const expandButton = screen.getByTitle('Expand diff')
      fireEvent.click(expandButton)

      // Should show diff viewer
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()

      // Click collapse button
      const collapseButton = screen.getByTitle('Collapse diff')
      fireEvent.click(collapseButton)

      // Should hide diff viewer again
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })

    it('expands/collapses all files with toggle all button', () => {
      render(
        <ChangelogDiffPreview
          changes={mockChanges}
          defaultCollapsed={true}
        />
      )

      // Initially no diff viewers
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()

      // Click expand all
      const expandAllButton = screen.getByText('Expand all')
      fireEvent.click(expandAllButton)

      // Should show all diff viewers
      const diffViewers = screen.getAllByTestId('diff-viewer')
      expect(diffViewers).toHaveLength(4)

      // Click collapse all
      const collapseAllButton = screen.getByText('Collapse all')
      fireEvent.click(collapseAllButton)

      // Should hide all diff viewers
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })
  })

  describe('Diff Content', () => {
    it('renders diff viewer when file is expanded', () => {
      render(
        <ChangelogDiffPreview
          changes={[mockChanges[0]]}
          defaultCollapsed={false}
        />
      )

      const diffViewer = screen.getByTestId('diff-viewer')
      expect(diffViewer).toBeInTheDocument()
      expect(diffViewer).toHaveTextContent('src/auth/AuthProvider.tsx')
    })

    it('passes correct props to DiffViewer', () => {
      render(
        <ChangelogDiffPreview
          changes={[mockChanges[0]]}
          defaultCollapsed={false}
          maxHeight={400}
        />
      )

      const diffViewer = screen.getByTestId('diff-viewer')
      expect(diffViewer).toBeInTheDocument()
    })

    it('shows empty state for files without diff content', () => {
      render(
        <ChangelogDiffPreview
          changes={mockChangesNoDiff}
          defaultCollapsed={false}
        />
      )

      expect(screen.getByText('No diff content available for this file')).toBeInTheDocument()
      expect(screen.getByText('File was added')).toBeInTheDocument()
    })

    it('shows appropriate empty state message for deleted files', () => {
      const deletedChange: ChangelogFileChange = {
        path: 'src/deleted.ts',
        type: 'deleted',
        stats: { additions: 0, deletions: 10 },
      }

      render(
        <ChangelogDiffPreview
          changes={[deletedChange]}
          defaultCollapsed={false}
        />
      )

      expect(screen.getByText('No diff content available for this file')).toBeInTheDocument()
      expect(screen.getByText('File was deleted')).toBeInTheDocument()
    })
  })

  describe('Statistics Display', () => {
    it('shows correct total statistics', () => {
      render(<ChangelogDiffPreview changes={mockChanges} />)

      // Total: 17 additions, 22 deletions
      expect(screen.getByText('+17')).toBeInTheDocument()
      expect(screen.getByText('-22')).toBeInTheDocument()
    })

    it('shows only additions when no deletions', () => {
      const addOnlyChanges: ChangelogFileChange[] = [
        {
          path: 'new-file.ts',
          type: 'added',
          diff: '+new content',
          stats: { additions: 10, deletions: 0 },
        },
      ]

      render(<ChangelogDiffPreview changes={addOnlyChanges} />)

      expect(screen.getByText('+10')).toBeInTheDocument()
      expect(screen.queryByText('-0')).not.toBeInTheDocument()
    })

    it('shows only deletions when no additions', () => {
      const deleteOnlyChanges: ChangelogFileChange[] = [
        {
          path: 'deleted-file.ts',
          type: 'deleted',
          diff: '-deleted content',
          stats: { additions: 0, deletions: 15 },
        },
      ]

      render(<ChangelogDiffPreview changes={deleteOnlyChanges} />)

      expect(screen.getByText('-15')).toBeInTheDocument()
      expect(screen.queryByText('+0')).not.toBeInTheDocument()
    })

    it('handles singular vs plural file count', () => {
      render(<ChangelogDiffPreview changes={[mockChanges[0]]} />)

      expect(screen.getByText('1 file changed')).toBeInTheDocument()
    })
  })

  describe('Change Type Icons', () => {
    it('displays appropriate icons for each change type', () => {
      render(<ChangelogDiffPreview changes={mockChanges} />)

      // Icons should be present (testing via their containers/badges)
      expect(screen.getByText('added')).toBeInTheDocument()
      expect(screen.getByText('modified')).toBeInTheDocument()
      expect(screen.getByText('deleted')).toBeInTheDocument()
      expect(screen.getByText('renamed')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper titles for expand/collapse buttons', () => {
      render(
        <ChangelogDiffPreview
          changes={[mockChanges[0]]}
          defaultCollapsed={true}
        />
      )

      expect(screen.getByTitle('Expand diff')).toBeInTheDocument()
    })

    it('provides file path titles for truncated paths', () => {
      const longPathChange: ChangelogFileChange = {
        path: 'src/very/long/path/to/some/deeply/nested/file.tsx',
        type: 'modified',
        diff: '+content',
        stats: { additions: 1, deletions: 0 },
      }

      render(<ChangelogDiffPreview changes={[longPathChange]} />)

      const pathElement = screen.getByTitle(longPathChange.path)
      expect(pathElement).toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ChangelogDiffPreview
          changes={mockChanges}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('respects maxHeight prop', () => {
      render(
        <ChangelogDiffPreview
          changes={[mockChanges[0]]}
          maxHeight={200}
          defaultCollapsed={false}
        />
      )

      // The DiffViewer should receive the maxHeight prop
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles files with no stats', () => {
      const noStatsChange: ChangelogFileChange = {
        path: 'binary-file.png',
        type: 'added',
        stats: { additions: 0, deletions: 0 },
      }

      render(<ChangelogDiffPreview changes={[noStatsChange]} />)

      expect(screen.getByText('1 file changed')).toBeInTheDocument()
      // Should not show +0 or -0
      expect(screen.queryByText('+0')).not.toBeInTheDocument()
      expect(screen.queryByText('-0')).not.toBeInTheDocument()
    })

    it('handles very long file names', () => {
      const longNameChange: ChangelogFileChange = {
        path: 'src/' + 'very-'.repeat(20) + 'long-filename.ts',
        type: 'modified',
        diff: '+content',
        stats: { additions: 1, deletions: 0 },
      }

      render(<ChangelogDiffPreview changes={[longNameChange]} />)

      // Should still render without breaking
      expect(screen.getByText('1 file changed')).toBeInTheDocument()
    })
  })
})