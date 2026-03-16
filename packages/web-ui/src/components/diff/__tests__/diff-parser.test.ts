/**
 * Diff Parser Utility Tests
 */

import { describe, it, expect } from 'vitest'
import { parseDiff, isValidDiff, getDiffStats } from '../utils/diff-parser'

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

const newFileDiff = `--- /dev/null
+++ b/src/new-file.js
@@ -0,0 +1,3 @@
+console.log('New file')
+const data = { test: true }
+export default data`

const deletedFileDiff = `--- a/src/old-file.js
+++ /dev/null
@@ -1,3 +0,0 @@
-console.log('Old file')
-const data = { test: false }
-export default data`

describe('isValidDiff', () => {
  it('should validate correct diff format', () => {
    expect(isValidDiff(sampleDiff)).toBe(true)
    expect(isValidDiff(newFileDiff)).toBe(true)
    expect(isValidDiff(deletedFileDiff)).toBe(true)
  })

  it('should reject invalid diff formats', () => {
    expect(isValidDiff('')).toBe(false)
    expect(isValidDiff('not a diff')).toBe(false)
    expect(isValidDiff('--- only minus\n+++ only plus')).toBe(false)
    expect(isValidDiff('--- a/file\n+++ b/file\nno hunk header')).toBe(false)
  })
})

describe('parseDiff', () => {
  it('should parse basic diff correctly', () => {
    const result = parseDiff(sampleDiff)

    expect(result.oldPath).toBe('src/app.js')
    expect(result.newPath).toBe('src/app.js')
    expect(result.isNew).toBe(false)
    expect(result.isDeleted).toBe(false)
    expect(result.isRenamed).toBe(false)
    expect(result.isBinary).toBe(false)
    expect(result.hunks).toHaveLength(1)

    const hunk = result.hunks[0]
    expect(hunk.oldStart).toBe(1)
    expect(hunk.oldLines).toBe(4)
    expect(hunk.newStart).toBe(1)
    expect(hunk.newLines).toBe(6)
    expect(hunk.header).toBe('@@ -1,4 +1,6 @@')
    expect(hunk.lines.length).toBeGreaterThan(0)
  })

  it('should detect new files', () => {
    const result = parseDiff(newFileDiff)

    expect(result.oldPath).toBe('src/new-file.js')
    expect(result.newPath).toBe('src/new-file.js')
    expect(result.isNew).toBe(true)
    expect(result.isDeleted).toBe(false)
  })

  it('should detect deleted files', () => {
    const result = parseDiff(deletedFileDiff)

    expect(result.oldPath).toBe('src/old-file.js')
    expect(result.newPath).toBe('src/old-file.js')
    expect(result.isNew).toBe(false)
    expect(result.isDeleted).toBe(true)
  })

  it('should parse line types correctly', () => {
    const result = parseDiff(sampleDiff)
    const lines = result.hunks[0].lines

    // Check for different line types
    const hasUnchanged = lines.some(line => line.type === 'unchanged')
    const hasAdded = lines.some(line => line.type === 'added')
    const hasRemoved = lines.some(line => line.type === 'removed')

    expect(hasUnchanged).toBe(true)
    expect(hasAdded).toBe(true)
    expect(hasRemoved).toBe(true)
  })

  it('should calculate line numbers correctly', () => {
    const result = parseDiff(sampleDiff)
    const lines = result.hunks[0].lines

    // Find first unchanged line
    const unchangedLine = lines.find(line => line.type === 'unchanged')
    expect(unchangedLine).toBeDefined()
    expect(unchangedLine!.oldLineNumber).toBeDefined()
    expect(unchangedLine!.newLineNumber).toBeDefined()

    // Find added line
    const addedLine = lines.find(line => line.type === 'added')
    expect(addedLine).toBeDefined()
    expect(addedLine!.oldLineNumber).toBeNull()
    expect(addedLine!.newLineNumber).toBeDefined()

    // Find removed line
    const removedLine = lines.find(line => line.type === 'removed')
    expect(removedLine).toBeDefined()
    expect(removedLine!.oldLineNumber).toBeDefined()
    expect(removedLine!.newLineNumber).toBeNull()
  })

  it('should handle empty diff', () => {
    expect(() => parseDiff('')).not.toThrow()
  })
})

describe('getDiffStats', () => {
  it('should calculate stats correctly', () => {
    const fileDiff = parseDiff(sampleDiff)
    const stats = getDiffStats({ ...fileDiff, language: 'javascript' })

    expect(stats.linesAdded).toBeGreaterThan(0)
    expect(stats.linesRemoved).toBeGreaterThan(0)
    expect(stats.linesUnchanged).toBeGreaterThan(0)
    expect(stats.totalLines).toBe(stats.linesAdded + stats.linesRemoved + stats.linesUnchanged)
  })

  it('should handle new file stats', () => {
    const fileDiff = parseDiff(newFileDiff)
    const stats = getDiffStats({ ...fileDiff, language: 'javascript' })

    expect(stats.linesAdded).toBeGreaterThan(0)
    expect(stats.linesRemoved).toBe(0)
  })

  it('should handle deleted file stats', () => {
    const fileDiff = parseDiff(deletedFileDiff)
    const stats = getDiffStats({ ...fileDiff, language: 'javascript' })

    expect(stats.linesAdded).toBe(0)
    expect(stats.linesRemoved).toBeGreaterThan(0)
  })
})