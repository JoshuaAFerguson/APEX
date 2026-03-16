/**
 * Language Detection Utility
 *
 * Detects programming language from file path extensions
 * for syntax highlighting purposes.
 */

import type { SupportedLanguage } from '../types'
import { EXTENSION_MAP } from '../constants'

/**
 * Detect programming language from file path
 *
 * @param filePath - File path or name to analyze
 * @returns Detected language or 'unknown' if not recognized
 */
export function detectLanguage(filePath?: string): SupportedLanguage {
  if (!filePath) return 'unknown'

  // Get file extension
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) return 'unknown'

  const ext = filePath.slice(lastDot).toLowerCase()
  return EXTENSION_MAP[ext] || 'unknown'
}

/**
 * Check if a language supports syntax highlighting
 *
 * @param language - Language to check
 * @returns True if highlighting is available
 */
export function isHighlightingSupported(language: SupportedLanguage): boolean {
  return language !== 'text' && language !== 'unknown'
}

/**
 * Get display name for a language
 *
 * @param language - Language identifier
 * @returns Human-readable language name
 */
export function getLanguageDisplayName(language: SupportedLanguage): string {
  const displayNames: Record<SupportedLanguage, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    jsx: 'React JSX',
    tsx: 'React TSX',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    shell: 'Shell Script',
    css: 'CSS',
    html: 'HTML',
    sql: 'SQL',
    text: 'Plain Text',
    unknown: 'Unknown',
  }

  return displayNames[language] || 'Unknown'
}