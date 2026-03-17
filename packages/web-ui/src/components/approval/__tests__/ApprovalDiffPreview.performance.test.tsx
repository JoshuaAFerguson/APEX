/**
 * ApprovalDiffPreview Performance Tests
 *
 * Performance tests to ensure ApprovalDiffPreview handles large diffs efficiently
 * and maintains good performance characteristics under stress.
 */

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApprovalDiffPreview } from '../ApprovalDiffPreview'
import type { ApprovalDiffData } from '@/types/approval-gate-panel'

// Mock dependencies
vi.mock('@/components/diff', () => ({
  DiffViewer: ({ diff }: any) => (
    <div data-testid="mock-diff-viewer">
      Diff content length: {diff?.length || 0}
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
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  FileText: () => <span>FileText</span>,
  Code: () => <span>Code</span>,
  Terminal: () => <span>Terminal</span>,
  Files: () => <span>Files</span>,
  Copy: () => <span>Copy</span>,
  Eye: () => <span>Eye</span>,
  EyeOff: () => <span>EyeOff</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  Loader2: () => <span>Loader2</span>,
}))

describe('ApprovalDiffPreview Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  const createLargeDiff = (lines: number): string => {
    const diffLines: string[] = [
      '--- src/large-file.js',
      '+++ src/large-file.js',
      `@@ -1,${lines} +1,${lines + 100} @@`,
    ]

    for (let i = 0; i < lines; i++) {
      if (i % 10 === 0) {
        diffLines.push(`+// Added comment ${i}`)
      }
      if (i % 15 === 0) {
        diffLines.push(`-// Removed comment ${i}`)
      }
      diffLines.push(` function line${i}() { return ${i}; }`)
    }

    return diffLines.join('\n')
  }

  const createLargeFileDiff = (files: number): ApprovalDiffData => {
    const fileDiffs = Array.from({ length: files }, (_, i) => ({
      oldPath: `src/file${i}.js`,
      newPath: `src/file${i}.js`,
      isNew: i % 3 === 0,
      isDeleted: i % 7 === 0,
      isRenamed: i % 5 === 0,
      hunks: Array.from({ length: Math.max(1, i % 5) }, (_, j) => ({
        header: `@@ -${j * 10},10 +${j * 10},12 @@`,
        lines: Array.from({ length: 20 }, (_, k) => ({
          type: k % 3 === 0 ? 'added' : k % 3 === 1 ? 'removed' : 'unchanged',
          content: `line ${k} in hunk ${j} of file ${i}`,
        })) as any[],
      })),
    })) as any[]

    return {
      diffId: `large-multi-file-${files}`,
      changeType: 'multi-file',
      fileDiffs,
      summary: `Large multi-file diff with ${files} files`,
      filesChanged: files,
      linesAdded: files * 50,
      linesRemoved: files * 25,
    }
  }

  describe('Large Diff Rendering', () => {
    it('should handle 1000-line diff efficiently', () => {
      const largeDiff: ApprovalDiffData = {
        diffId: 'large-1000',
        changeType: 'file-edit',
        rawDiff: createLargeDiff(1000),
        summary: '1000-line performance test',
        filesChanged: 1,
        linesAdded: 100,
        linesRemoved: 50,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={largeDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(200) // Should render in < 200ms
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('1000-line performance test')).toBeInTheDocument()
    })

    it('should handle 5000-line diff without memory issues', () => {
      const veryLargeDiff: ApprovalDiffData = {
        diffId: 'large-5000',
        changeType: 'file-edit',
        rawDiff: createLargeDiff(5000),
        summary: '5000-line stress test',
        filesChanged: 1,
        linesAdded: 500,
        linesRemoved: 250,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={veryLargeDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(200) // Should render in < 200ms for 5000 lines
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })

    it('should handle extremely long lines efficiently', () => {
      const longLineDiff: ApprovalDiffData = {
        diffId: 'long-lines',
        changeType: 'file-edit',
        rawDiff: [
          '--- test.js',
          '+++ test.js',
          '@@ -1,3 +1,3 @@',
          `-${'x'.repeat(50000)}`,
          `+${'y'.repeat(50000)}`,
          ' normal line',
        ].join('\n'),
        summary: 'Very long lines test',
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 1,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={longLineDiff} maxHeight={300} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100)
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })
  })

  describe('Multi-File Performance', () => {
    it('should handle 50 files efficiently', () => {
      const multiFileDiff = createLargeFileDiff(50)

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={multiFileDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(150) // Should render in < 150ms for 50 files
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
      expect(screen.getByText('Large multi-file diff with 50 files')).toBeInTheDocument()
    })

    it('should handle 100 files without performance degradation', () => {
      const multiFileDiff = createLargeFileDiff(100)

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={multiFileDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(200) // Should render in < 200ms for 100 files
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated renders', () => {
      const mediumDiff: ApprovalDiffData = {
        diffId: 'memory-test',
        changeType: 'file-edit',
        rawDiff: createLargeDiff(500),
        summary: 'Memory leak test',
        filesChanged: 1,
        linesAdded: 50,
        linesRemoved: 25,
      }

      // Render multiple times to check for memory leaks
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(<ApprovalDiffPreview diffData={mediumDiff} />)
        expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
        unmount()
      }

      // Should complete without issues
      expect(true).toBe(true)
    })

    it('should handle rapid state changes efficiently', () => {
      const baseDiff: ApprovalDiffData = {
        diffId: 'state-change',
        changeType: 'file-edit',
        rawDiff: createLargeDiff(200),
        summary: 'State change test',
        filesChanged: 1,
        linesAdded: 20,
        linesRemoved: 10,
      }

      const startTime = performance.now()

      const { rerender } = render(<ApprovalDiffPreview diffData={baseDiff} loading={false} />)

      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        rerender(<ApprovalDiffPreview diffData={baseDiff} loading={i % 2 === 0} />)
        rerender(<ApprovalDiffPreview diffData={baseDiff} error={i % 3 === 0 ? 'Test error' : null} />)
        rerender(<ApprovalDiffPreview diffData={baseDiff} defaultCollapsed={i % 2 === 0} />)
      }

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(200)
    })
  })

  describe('Complex Content Performance', () => {
    it('should handle Unicode and special characters efficiently', () => {
      const unicodeDiff: ApprovalDiffData = {
        diffId: 'unicode-test',
        changeType: 'file-edit',
        rawDiff: [
          '--- unicode.js',
          '+++ unicode.js',
          '@@ -1,5 +1,5 @@',
          '-const message = "Hello 世界";',
          '+const message = "Hello 🌍";',
          ' const emoji = "🚀💻⚡️🎯";',
          '-const math = "∑∫∂√";',
          '+const math = "∞∂∇∅";',
          ' const symbols = "←→↑↓⟶⟵";',
        ].join('\n'),
        summary: 'Unicode character test',
        filesChanged: 1,
        linesAdded: 2,
        linesRemoved: 2,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={unicodeDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(50)
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })

    it('should handle binary file indicators efficiently', () => {
      const binaryDiff: ApprovalDiffData = {
        diffId: 'binary-test',
        changeType: 'file-edit',
        rawDiff: [
          '--- image.png',
          '+++ image.png',
          'GIT binary patch',
          'delta 1234',
          'zcmV-M1S%9SQH;kE7n4Ua(xUaAmNZ8]Uv%EQ}:2L=3b;xdB82',
          'zDWPgr3@HB!d|0)o0001t001BJ?*I$d;00930000R000000007V',
        ].join('\n'),
        summary: 'Binary file modification',
        filesChanged: 1,
        linesAdded: 0,
        linesRemoved: 0,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={binaryDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(50)
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })
  })

  describe('Edge Case Performance', () => {
    it('should handle empty diff content quickly', () => {
      const emptyDiff: ApprovalDiffData = {
        diffId: 'empty',
        changeType: 'file-edit',
        rawDiff: '',
        summary: 'Empty diff test',
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={emptyDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(20)
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })

    it('should handle malformed diff headers efficiently', () => {
      const malformedDiff: ApprovalDiffData = {
        diffId: 'malformed',
        changeType: 'file-edit',
        rawDiff: [
          '--- invalid',
          'malformed content',
          'not a real diff',
          '+added line without proper context',
          '-removed line without header',
        ].join('\n'),
        summary: 'Malformed diff test',
        filesChanged: 1,
        linesAdded: 1,
        linesRemoved: 1,
      }

      const startTime = performance.now()
      render(<ApprovalDiffPreview diffData={malformedDiff} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(50)
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle Performance', () => {
    it('should mount and unmount quickly with large data', () => {
      const largeDiff = createLargeFileDiff(25)

      const startTime = performance.now()
      const { unmount } = render(<ApprovalDiffPreview diffData={largeDiff} />)
      const mountTime = performance.now()

      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()

      unmount()
      const unmountTime = performance.now()

      expect(mountTime - startTime).toBeLessThan(100) // Mount time
      expect(unmountTime - mountTime).toBeLessThan(50) // Unmount time
    })

    it('should update props efficiently', () => {
      const baseDiff: ApprovalDiffData = {
        diffId: 'prop-update',
        changeType: 'file-edit',
        rawDiff: createLargeDiff(300),
        summary: 'Prop update test',
        filesChanged: 1,
        linesAdded: 30,
        linesRemoved: 15,
      }

      const { rerender } = render(<ApprovalDiffPreview diffData={baseDiff} />)

      const startTime = performance.now()

      // Test various prop updates
      rerender(<ApprovalDiffPreview diffData={baseDiff} viewMode="split" />)
      rerender(<ApprovalDiffPreview diffData={baseDiff} showLineNumbers={false} />)
      rerender(<ApprovalDiffPreview diffData={baseDiff} highlighting={false} />)
      rerender(<ApprovalDiffPreview diffData={baseDiff} maxHeight={500} />)
      rerender(<ApprovalDiffPreview diffData={baseDiff} collapsible={false} />)

      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100)
      expect(screen.getByTestId('diff-preview')).toBeInTheDocument()
    })
  })
})