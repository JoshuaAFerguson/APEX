/**
 * DiffViewer Performance Tests
 *
 * Tests performance characteristics with large diffs, memory usage,
 * and rendering optimization.
 */

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DiffViewer } from '../DiffViewer'

// Generate large diff for testing
function generateLargeDiff(lines: number): string {
  const header = `--- a/large-file.js
+++ b/large-file.js
@@ -1,${Math.floor(lines / 2)} +1,${lines} @@`

  const diffLines = Array.from({ length: lines }, (_, i) => {
    const type = i % 3 === 0 ? '+' : i % 3 === 1 ? '-' : ' '
    return `${type}line ${i} - ${type === '+' ? 'added' : type === '-' ? 'removed' : 'unchanged'} content with some text to make it realistic`
  }).join('\n')

  return `${header}\n${diffLines}`
}

// Generate complex diff with multiple hunks
function generateComplexDiff(hunks: number, linesPerHunk: number): string {
  const hunksArray = Array.from({ length: hunks }, (_, hunkIndex) => {
    const startLine = hunkIndex * linesPerHunk + 1
    const header = `@@ -${startLine},${linesPerHunk} +${startLine},${linesPerHunk + 2} @@`

    const lines = Array.from({ length: linesPerHunk }, (_, lineIndex) => {
      const type = lineIndex % 4 === 0 ? '+' : lineIndex % 4 === 1 ? '-' : ' '
      return `${type}hunk ${hunkIndex} line ${lineIndex}`
    }).join('\n')

    return `${header}\n${lines}`
  }).join('\n\n')

  return `--- a/complex-file.js\n+++ b/complex-file.js\n${hunksArray}`
}

// Performance measurement helper
function measureRenderTime(renderFn: () => void): number {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Memory usage measurement (approximate)
function measureMemoryUsage(): number {
  if ('memory' in performance && performance.memory) {
    return performance.memory.usedJSHeapSize / 1024 / 1024 // MB
  }
  return 0
}

describe('DiffViewer Performance Tests', () => {
  beforeEach(() => {
    // Ensure clean state
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Large Diff Handling', () => {
    it('renders small diffs efficiently (< 50ms)', () => {
      const smallDiff = generateLargeDiff(100)

      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={smallDiff} />)
      })

      expect(renderTime).toBeLessThan(50)
    })

    it('handles medium diffs within acceptable time limits (< 200ms)', () => {
      const mediumDiff = generateLargeDiff(500)

      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={mediumDiff} />)
      })

      expect(renderTime).toBeLessThan(200)
    })

    it('handles large diffs without performance degradation (< 500ms)', () => {
      const largeDiff = generateLargeDiff(1000)

      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={largeDiff} />)
      })

      expect(renderTime).toBeLessThan(500)
    })

    it('handles very large diffs gracefully (< 1000ms)', () => {
      const veryLargeDiff = generateLargeDiff(2000)

      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={veryLargeDiff} />)
      })

      expect(renderTime).toBeLessThan(1000)
      // Should still render content
      expect(screen.getByText(/large-file\.js/)).toBeInTheDocument()
    })
  })

  describe('Complex Diff Structures', () => {
    it('handles multiple hunks efficiently', () => {
      const complexDiff = generateComplexDiff(10, 50)

      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={complexDiff} />)
      })

      expect(renderTime).toBeLessThan(300)
    })

    it('handles many small hunks vs few large hunks', () => {
      const manySmallHunks = generateComplexDiff(50, 10)
      const fewLargeHunks = generateComplexDiff(5, 100)

      const smallHunksTime = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={manySmallHunks} />)
        unmount()
      })

      const largeHunksTime = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={fewLargeHunks} />)
        unmount()
      })

      // Both should be reasonable, but many small hunks might be slightly faster
      expect(smallHunksTime).toBeLessThan(400)
      expect(largeHunksTime).toBeLessThan(400)
    })
  })

  describe('Re-render Performance', () => {
    it('efficiently handles prop changes', () => {
      const diff = generateLargeDiff(500)
      const { rerender } = render(<DiffViewer diff={diff} mode="unified" />)

      const rerenderTime = measureRenderTime(() => {
        rerender(<DiffViewer diff={diff} mode="split" />)
      })

      expect(rerenderTime).toBeLessThan(100)
    })

    it('handles rapid mode switching efficiently', () => {
      const diff = generateLargeDiff(300)
      const { rerender } = render(<DiffViewer diff={diff} mode="unified" />)

      const rapidSwitchTime = measureRenderTime(() => {
        rerender(<DiffViewer diff={diff} mode="split" />)
        rerender(<DiffViewer diff={diff} mode="inline" />)
        rerender(<DiffViewer diff={diff} mode="unified" />)
      })

      expect(rapidSwitchTime).toBeLessThan(200)
    })

    it('efficiently updates selection state', () => {
      const diff = generateLargeDiff(200)
      const { rerender } = render(<DiffViewer diff={diff} />)

      const selectionTime = measureRenderTime(() => {
        // Simulate selection changes
        for (let i = 0; i < 10; i++) {
          rerender(<DiffViewer diff={diff} />)
        }
      })

      expect(selectionTime).toBeLessThan(150)
    })
  })

  describe('Memory Management', () => {
    it('does not create memory leaks with large datasets', async () => {
      const initialMemory = measureMemoryUsage()

      // Render and unmount multiple large diffs
      for (let i = 0; i < 5; i++) {
        const largeDiff = generateLargeDiff(1000)
        const { unmount } = render(<DiffViewer diff={largeDiff} />)
        unmount()
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const finalMemory = measureMemoryUsage()

      // Memory increase should be minimal (within 10MB)
      if (finalMemory > 0 && initialMemory > 0) {
        expect(finalMemory - initialMemory).toBeLessThan(10)
      }
    })

    it('efficiently handles component cleanup', () => {
      const largeDiff = generateLargeDiff(1000)

      const cleanupTime = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={largeDiff} />)
        unmount()
      })

      expect(cleanupTime).toBeLessThan(50)
    })
  })

  describe('Feature Impact on Performance', () => {
    const testDiff = generateLargeDiff(500)

    it('syntax highlighting impact is reasonable', () => {
      const withoutHighlighting = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={testDiff} highlighting={false} />)
        unmount()
      })

      const withHighlighting = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={testDiff} highlighting={true} />)
        unmount()
      })

      // Highlighting should not add more than 100ms
      expect(withHighlighting - withoutHighlighting).toBeLessThan(100)
    })

    it('line numbers have minimal performance impact', () => {
      const withoutLineNumbers = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={testDiff} showLineNumbers={false} />)
        unmount()
      })

      const withLineNumbers = measureRenderTime(() => {
        const { unmount } = render(<DiffViewer diff={testDiff} showLineNumbers={true} />)
        unmount()
      })

      // Line numbers should not add more than 50ms
      expect(withLineNumbers - withoutLineNumbers).toBeLessThan(50)
    })

    it('all features enabled vs minimal features', () => {
      const minimalTime = measureRenderTime(() => {
        const { unmount } = render(
          <DiffViewer
            diff={testDiff}
            highlighting={false}
            showLineNumbers={false}
            showModeSelector={false}
            showCopyButton={false}
            showFileHeader={false}
          />
        )
        unmount()
      })

      const fullFeaturesTime = measureRenderTime(() => {
        const { unmount } = render(
          <DiffViewer
            diff={testDiff}
            highlighting={true}
            showLineNumbers={true}
            showModeSelector={true}
            showCopyButton={true}
            showFileHeader={true}
          />
        )
        unmount()
      })

      // Full features should not be more than 2x slower
      expect(fullFeaturesTime).toBeLessThan(minimalTime * 2)
    })
  })

  describe('Parser Performance', () => {
    it('efficiently parses large diffs', () => {
      const largeDiff = generateLargeDiff(2000)

      const parseTime = measureRenderTime(() => {
        render(<DiffViewer diff={largeDiff} />)
      })

      // Should parse and render within reasonable time
      expect(parseTime).toBeLessThan(800)
    })

    it('handles malformed content gracefully', () => {
      const malformedDiff = `
        --- a/file.js
        +++ b/file.js
        @@ invalid hunk header
        ${Array.from({ length: 500 }, (_, i) => `random line ${i}`).join('\n')}
      `

      const parseTime = measureRenderTime(() => {
        render(<DiffViewer diff={malformedDiff} />)
      })

      // Should fail fast and not hang
      expect(parseTime).toBeLessThan(100)
    })
  })

  describe('Different View Mode Performance', () => {
    const testDiff = generateLargeDiff(400)

    it('unified view renders efficiently', () => {
      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={testDiff} mode="unified" />)
      })

      expect(renderTime).toBeLessThan(300)
    })

    it('split view renders efficiently', () => {
      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={testDiff} mode="split" />)
      })

      expect(renderTime).toBeLessThan(400) // Slightly more complex layout
    })

    it('inline view renders efficiently', () => {
      const renderTime = measureRenderTime(() => {
        render(<DiffViewer diff={testDiff} mode="inline" />)
      })

      expect(renderTime).toBeLessThan(350)
    })
  })

  describe('Stress Testing', () => {
    it('handles extreme diff sizes without crashing', () => {
      const extremeDiff = generateLargeDiff(5000)

      expect(() => {
        render(<DiffViewer diff={extremeDiff} />)
      }).not.toThrow()

      expect(screen.getByText(/large-file\.js/)).toBeInTheDocument()
    })

    it('handles rapid successive renders', () => {
      const stressTime = measureRenderTime(() => {
        for (let i = 0; i < 10; i++) {
          const diff = generateLargeDiff(100 + i * 10)
          const { unmount } = render(<DiffViewer diff={diff} />)
          unmount()
        }
      })

      expect(stressTime).toBeLessThan(1000)
    })
  })
})