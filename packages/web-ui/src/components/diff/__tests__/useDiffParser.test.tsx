/**
 * useDiffParser Hook Tests
 */

import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useDiffParser, useDiffFilePaths } from '../hooks/useDiffParser'

const validDiff = `--- a/src/app.js
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

const newFileDiff = `--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,3 @@
+export function helper() {
+  return true
+}`

const invalidDiff = `This is not a valid diff
Just some random text
Without proper headers`

describe('useDiffParser', () => {
  describe('Valid Diff Parsing', () => {
    it('parses valid diff correctly', () => {
      const { result } = renderHook(() => useDiffParser(validDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.isEmpty).toBe(false)
      expect(result.current.parseError).toBeNull()
      expect(result.current.fileDiff).toBeDefined()

      if (result.current.fileDiff) {
        expect(result.current.fileDiff.oldPath).toBe('src/app.js')
        expect(result.current.fileDiff.newPath).toBe('src/app.js')
        expect(result.current.fileDiff.language).toBe('javascript')
        expect(result.current.fileDiff.isNew).toBe(false)
        expect(result.current.fileDiff.isDeleted).toBe(false)
        expect(result.current.fileDiff.hunks).toHaveLength(1)
      }
    })

    it('detects language from diff file paths', () => {
      const typescriptDiff = validDiff.replace('src/app.js', 'src/app.ts')
      const { result } = renderHook(() => useDiffParser(typescriptDiff))

      expect(result.current.fileDiff?.language).toBe('typescript')
    })

    it('uses provided file path for language detection', () => {
      const { result } = renderHook(() => useDiffParser(validDiff, 'custom.py'))

      expect(result.current.fileDiff?.language).toBe('python')
    })

    it('handles new file creation', () => {
      const { result } = renderHook(() => useDiffParser(newFileDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.fileDiff?.isNew).toBe(true)
      expect(result.current.fileDiff?.language).toBe('typescript')
      expect(result.current.fileDiff?.oldPath).toBe('src/utils.ts')
      expect(result.current.fileDiff?.newPath).toBe('src/utils.ts')
    })

    it('handles deleted files', () => {
      const deletedDiff = `--- a/old-file.js
+++ /dev/null
@@ -1,2 +0,0 @@
-console.log('deleted')
-const data = true`

      const { result } = renderHook(() => useDiffParser(deletedDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.fileDiff?.isDeleted).toBe(true)
      expect(result.current.fileDiff?.language).toBe('javascript')
    })
  })

  describe('Error Handling', () => {
    it('handles empty diff', () => {
      const { result } = renderHook(() => useDiffParser(''))

      expect(result.current.isValid).toBe(false)
      expect(result.current.isEmpty).toBe(true)
      expect(result.current.parseError).toBeNull()
      expect(result.current.fileDiff).toBeNull()
    })

    it('handles null/undefined diff', () => {
      const { result: nullResult } = renderHook(() => useDiffParser(null as any))
      const { result: undefinedResult } = renderHook(() => useDiffParser(undefined as any))

      expect(nullResult.current.isEmpty).toBe(true)
      expect(undefinedResult.current.isEmpty).toBe(true)
    })

    it('handles whitespace-only diff', () => {
      const { result } = renderHook(() => useDiffParser('   \n  \t  \n   '))

      expect(result.current.isValid).toBe(false)
      expect(result.current.isEmpty).toBe(true)
      expect(result.current.parseError).toBeNull()
    })

    it('handles invalid diff format', () => {
      const { result } = renderHook(() => useDiffParser(invalidDiff))

      expect(result.current.isValid).toBe(false)
      expect(result.current.isEmpty).toBe(false)
      expect(result.current.parseError).toBe('Invalid diff format. Expected unified diff format.')
      expect(result.current.fileDiff).toBeNull()
    })

    it('handles malformed but valid-looking diff', () => {
      const malformedDiff = `--- a/file.js
+++ b/file.js
@@ invalid hunk header
some content`

      const { result } = renderHook(() => useDiffParser(malformedDiff))

      expect(result.current.isValid).toBe(false)
      expect(result.current.parseError).toBeDefined()
      expect(result.current.fileDiff).toBeNull()
    })

    it('provides meaningful error messages', () => {
      const { result } = renderHook(() => useDiffParser(invalidDiff))

      expect(result.current.parseError).toContain('unified diff format')
    })
  })

  describe('Memoization', () => {
    it('memoizes results for same input', () => {
      const { result, rerender } = renderHook(
        ({ diff, filePath }) => useDiffParser(diff, filePath),
        { initialProps: { diff: validDiff, filePath: 'test.js' } }
      )

      const firstResult = result.current

      // Re-render with same props
      rerender({ diff: validDiff, filePath: 'test.js' })

      // Should return the same object reference (memoized)
      expect(result.current).toBe(firstResult)
    })

    it('recalculates when diff changes', () => {
      const { result, rerender } = renderHook(
        ({ diff }) => useDiffParser(diff),
        { initialProps: { diff: validDiff } }
      )

      const firstResult = result.current

      // Re-render with different diff
      rerender({ diff: newFileDiff })

      // Should return different object (not memoized)
      expect(result.current).not.toBe(firstResult)
      expect(result.current.fileDiff?.isNew).toBe(true)
    })

    it('recalculates when file path changes', () => {
      const { result, rerender } = renderHook(
        ({ diff, filePath }) => useDiffParser(diff, filePath),
        { initialProps: { diff: validDiff, filePath: 'test.js' } }
      )

      const firstResult = result.current

      // Re-render with different file path
      rerender({ diff: validDiff, filePath: 'test.py' })

      // Should return different object (language changed)
      expect(result.current).not.toBe(firstResult)
      expect(result.current.fileDiff?.language).toBe('python')
    })
  })

  describe('Language Detection Priority', () => {
    it('prioritizes provided file path over diff paths', () => {
      const { result } = renderHook(() => useDiffParser(validDiff, 'override.py'))

      expect(result.current.fileDiff?.language).toBe('python')
    })

    it('falls back to new path from diff', () => {
      const renamedDiff = `--- a/old.js
+++ b/new.py
@@ -1,1 +1,1 @@
-old content
+new content`

      const { result } = renderHook(() => useDiffParser(renamedDiff))

      expect(result.current.fileDiff?.language).toBe('python')
    })

    it('falls back to old path if new path not available', () => {
      const { result } = renderHook(() => useDiffParser(validDiff))

      expect(result.current.fileDiff?.language).toBe('javascript')
    })

    it('defaults to unknown for unrecognized extensions', () => {
      const unknownDiff = validDiff.replace('.js', '.unknown')
      const { result } = renderHook(() => useDiffParser(unknownDiff))

      expect(result.current.fileDiff?.language).toBe('unknown')
    })
  })

  describe('Binary Files', () => {
    it('handles binary file diffs', () => {
      const binaryDiff = `--- a/image.png
+++ b/image.png
Binary files a/image.png and b/image.png differ`

      const { result } = renderHook(() => useDiffParser(binaryDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.fileDiff?.isBinary).toBe(true)
    })
  })

  describe('Complex Scenarios', () => {
    it('handles multiple hunks', () => {
      const multiHunkDiff = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 line 1
+added line
 line 2
 line 3
@@ -10,2 +11,3 @@
 line 10
 line 11
+another addition`

      const { result } = renderHook(() => useDiffParser(multiHunkDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.fileDiff?.hunks).toHaveLength(2)
    })

    it('handles very large diffs', () => {
      const largeDiff = `--- a/large.js
+++ b/large.js
@@ -1,100 +1,200 @@
${Array.from({ length: 200 }, (_, i) => i % 2 === 0 ? `+line ${i}` : ` line ${i}`).join('\n')}`

      const { result } = renderHook(() => useDiffParser(largeDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.fileDiff?.hunks[0]?.lines.length).toBe(200)
    })

    it('handles diffs with only context lines', () => {
      const contextDiff = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 context line 1
 context line 2
 context line 3`

      const { result } = renderHook(() => useDiffParser(contextDiff))

      expect(result.current.isValid).toBe(true)
      expect(result.current.fileDiff?.hunks[0]?.lines.every(line =>
        line.type === 'unchanged'
      )).toBe(true)
    })
  })
})

describe('useDiffFilePaths', () => {
  it('extracts file paths from diff headers', () => {
    const { result } = renderHook(() => useDiffFilePaths(validDiff))

    expect(result.current.oldPath).toBe('src/app.js')
    expect(result.current.newPath).toBe('src/app.js')
  })

  it('handles new file creation paths', () => {
    const { result } = renderHook(() => useDiffFilePaths(newFileDiff))

    expect(result.current.oldPath).toBe('/dev/null')
    expect(result.current.newPath).toBe('src/utils.ts')
  })

  it('handles deleted file paths', () => {
    const deletedDiff = `--- a/old.js
+++ /dev/null`

    const { result } = renderHook(() => useDiffFilePaths(deletedDiff))

    expect(result.current.oldPath).toBe('old.js')
    expect(result.current.newPath).toBe('/dev/null')
  })

  it('strips a/ and b/ prefixes', () => {
    const prefixedDiff = `--- a/path/to/file.js
+++ b/path/to/file.js`

    const { result } = renderHook(() => useDiffFilePaths(prefixedDiff))

    expect(result.current.oldPath).toBe('path/to/file.js')
    expect(result.current.newPath).toBe('path/to/file.js')
  })

  it('handles missing paths gracefully', () => {
    const { result } = renderHook(() => useDiffFilePaths('invalid content'))

    expect(result.current.oldPath).toBe('')
    expect(result.current.newPath).toBe('')
  })

  it('handles empty input', () => {
    const { result } = renderHook(() => useDiffFilePaths(''))

    expect(result.current.oldPath).toBe('')
    expect(result.current.newPath).toBe('')
  })

  it('memoizes results', () => {
    const { result, rerender } = renderHook(
      ({ diff }) => useDiffFilePaths(diff),
      { initialProps: { diff: validDiff } }
    )

    const firstResult = result.current

    // Re-render with same input
    rerender({ diff: validDiff })

    // Should be memoized
    expect(result.current).toBe(firstResult)
  })

  it('recalculates when input changes', () => {
    const { result, rerender } = renderHook(
      ({ diff }) => useDiffFilePaths(diff),
      { initialProps: { diff: validDiff } }
    )

    const firstResult = result.current

    // Re-render with different input
    rerender({ diff: newFileDiff })

    // Should recalculate
    expect(result.current).not.toBe(firstResult)
    expect(result.current.newPath).toBe('src/utils.ts')
  })
})