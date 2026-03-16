/**
 * Diff Parser Hook
 *
 * Custom hook for parsing diff content and detecting language.
 * Memoizes parsing results for performance.
 */

'use client'

import { useMemo } from 'react'
import { parseDiff, isValidDiff } from '../utils/diff-parser'
import { detectLanguage } from '../utils/language-detector'
import type { FileDiff } from '../types'

interface UseDiffParserResult {
  fileDiff: FileDiff | null
  parseError: string | null
  isValid: boolean
  isEmpty: boolean
}

/**
 * Parse and validate diff content with language detection
 *
 * @param diff - Raw diff content
 * @param filePath - Optional file path for language detection
 * @returns Parsed diff data with error handling
 */
export function useDiffParser(diff: string, filePath?: string): UseDiffParserResult {
  return useMemo(() => {
    // Handle empty or null diff
    if (!diff || !diff.trim()) {
      return {
        fileDiff: null,
        parseError: null,
        isValid: false,
        isEmpty: true,
      }
    }

    // Basic validation
    if (!isValidDiff(diff)) {
      return {
        fileDiff: null,
        parseError: 'Invalid diff format. Expected unified diff format.',
        isValid: false,
        isEmpty: false,
      }
    }

    try {
      // Parse the diff
      const parsed = parseDiff(diff)

      // Detect language from file path or diff header
      const path = filePath || parsed.newPath || parsed.oldPath
      const language = detectLanguage(path)

      const fileDiff: FileDiff = {
        ...parsed,
        language,
      }

      return {
        fileDiff,
        parseError: null,
        isValid: true,
        isEmpty: false,
      }
    } catch (error) {
      return {
        fileDiff: null,
        parseError: error instanceof Error ? error.message : 'Failed to parse diff',
        isValid: false,
        isEmpty: false,
      }
    }
  }, [diff, filePath])
}

/**
 * Extract file paths from diff header for language detection
 */
export function useDiffFilePaths(diff: string): { oldPath: string; newPath: string } {
  return useMemo(() => {
    if (!diff) return { oldPath: '', newPath: '' }

    const lines = diff.split('\n')
    let oldPath = ''
    let newPath = ''

    for (const line of lines) {
      if (line.startsWith('--- ')) {
        oldPath = line.slice(4).replace(/^a\//, '')
      } else if (line.startsWith('+++ ')) {
        newPath = line.slice(4).replace(/^b\//, '')
        break // Stop after finding both paths
      }
    }

    return { oldPath, newPath }
  }, [diff])
}