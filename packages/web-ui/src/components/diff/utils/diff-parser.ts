/**
 * Diff Parser Utility
 *
 * Parses unified diff format into structured data for rendering.
 * Supports standard git diff output with proper line number calculation.
 */

import type { FileDiff, DiffHunk, DiffLineData, DiffLineType } from '../types'

/**
 * Parse unified diff format into structured FileDiff
 *
 * @param diff - Raw unified diff content
 * @returns Parsed file diff data (without language detection)
 */
export function parseDiff(diff: string): Omit<FileDiff, 'language'> {
  const lines = diff.split('\n')

  let oldPath = ''
  let newPath = ''
  let isNew = false
  let isDeleted = false
  let isRenamed = false
  let isBinary = false
  const hunks: DiffHunk[] = []

  let currentHunk: DiffHunk | null = null
  let i = 0

  // Parse header
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).replace(/^a\//, '')
      if (oldPath === '/dev/null') isNew = true
    } else if (line.startsWith('+++ ')) {
      newPath = line.slice(4).replace(/^b\//, '')
      if (newPath === '/dev/null') isDeleted = true
    } else if (line.startsWith('rename from ')) {
      isRenamed = true
    } else if (line.startsWith('Binary files')) {
      isBinary = true
    } else if (line.startsWith('@@ ')) {
      // Start of hunk, break to hunk parsing
      break
    }

    i++
  }

  // Parse hunks
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('@@ ')) {
      // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (match) {
        // Save previous hunk
        if (currentHunk) {
          hunks.push(currentHunk)
        }

        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldLines: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newLines: parseInt(match[4] || '1', 10),
          header: line,
          lines: [],
        }
      }
    } else if (currentHunk && line.length > 0) {
      // Parse diff line
      const type = getLineType(line)
      const content = getLineContent(line, type)

      // Calculate line numbers based on position in hunk
      const { oldLineNumber, newLineNumber } = calculateLineNumbers(
        currentHunk,
        type
      )

      currentHunk.lines.push({
        oldLineNumber,
        newLineNumber,
        type,
        content,
      })
    }

    i++
  }

  // Save last hunk
  if (currentHunk) {
    hunks.push(currentHunk)
  }

  return {
    oldPath: oldPath || 'unknown',
    newPath: newPath || 'unknown',
    isNew,
    isDeleted,
    isRenamed,
    isBinary,
    hunks,
  }
}

/**
 * Determine line type from diff line prefix
 */
function getLineType(line: string): DiffLineType {
  if (line.startsWith('+')) return 'added'
  if (line.startsWith('-')) return 'removed'
  if (line.startsWith(' ')) return 'unchanged'
  if (line.startsWith('@@')) return 'header'
  return 'context'
}

/**
 * Extract content from diff line (removing prefix)
 */
function getLineContent(line: string, type: DiffLineType): string {
  if (type === 'header') return line
  if (type === 'context') return line
  return line.slice(1) // Remove +, -, or space prefix
}

/**
 * Calculate line numbers for a diff line within its hunk
 */
function calculateLineNumbers(
  hunk: DiffHunk,
  type: DiffLineType
): { oldLineNumber: number | null; newLineNumber: number | null } {
  let oldLineNumber: number | null = null
  let newLineNumber: number | null = null

  // Count lines processed in this hunk so far
  const linesProcessed = hunk.lines.length
  const unchangedBefore = hunk.lines.filter(
    l => l.type === 'unchanged' || l.type === 'context'
  ).length
  const removedBefore = hunk.lines.filter(l => l.type === 'removed').length
  const addedBefore = hunk.lines.filter(l => l.type === 'added').length

  if (type === 'removed' || type === 'unchanged' || type === 'context') {
    oldLineNumber = hunk.oldStart + unchangedBefore + removedBefore
  }
  if (type === 'added' || type === 'unchanged' || type === 'context') {
    newLineNumber = hunk.newStart + unchangedBefore + addedBefore
  }

  return { oldLineNumber, newLineNumber }
}

/**
 * Validate if a string contains valid diff format
 *
 * @param diff - Raw diff content
 * @returns True if appears to be valid diff format
 */
export function isValidDiff(diff: string): boolean {
  if (!diff || !diff.trim()) return false

  const lines = diff.split('\n')

  // Check for basic diff indicators
  const hasMinusPrefix = lines.some(line => line.startsWith('--- '))
  const hasPlusPrefix = lines.some(line => line.startsWith('+++ '))
  const hasHunkHeader = lines.some(line => line.startsWith('@@ '))

  return hasMinusPrefix && hasPlusPrefix && hasHunkHeader
}

/**
 * Get summary statistics from a diff
 *
 * @param fileDiff - Parsed file diff
 * @returns Summary statistics
 */
export function getDiffStats(fileDiff: FileDiff) {
  let linesAdded = 0
  let linesRemoved = 0
  let linesUnchanged = 0

  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      switch (line.type) {
        case 'added':
          linesAdded++
          break
        case 'removed':
          linesRemoved++
          break
        case 'unchanged':
        case 'context':
          linesUnchanged++
          break
      }
    }
  }

  return {
    linesAdded,
    linesRemoved,
    linesUnchanged,
    totalLines: linesAdded + linesRemoved + linesUnchanged,
  }
}