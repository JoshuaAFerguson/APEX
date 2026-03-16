/**
 * Constants and default configurations for the Diff Viewer component
 */

import type { DiffViewMode, DiffLineType, SupportedLanguage, HighlightConfig } from './types'

/**
 * Default view mode
 */
export const DEFAULT_VIEW_MODE: DiffViewMode = 'unified'

/**
 * Default highlight configuration
 */
export const DEFAULT_HIGHLIGHT_CONFIG: HighlightConfig = {
  enabled: true,
  theme: 'auto',
}

/**
 * Default max height for diff viewer
 */
export const DEFAULT_MAX_HEIGHT = 600

/**
 * Line type visual indicators
 */
export const LINE_TYPE_INDICATOR: Record<DiffLineType, string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
  header: '@',
  context: ' ',
}

/**
 * Line type CSS classes for background colors
 */
export const LINE_TYPE_STYLES: Record<DiffLineType, string> = {
  added: 'bg-green-500/10 hover:bg-green-500/15',
  removed: 'bg-red-500/10 hover:bg-red-500/15',
  unchanged: 'bg-transparent hover:bg-background/50',
  header: 'bg-blue-500/10 text-blue-400',
  context: 'bg-transparent hover:bg-background/50',
}

/**
 * Line type indicator colors
 */
export const LINE_TYPE_INDICATOR_COLOR: Record<DiffLineType, string> = {
  added: 'text-green-500',
  removed: 'text-red-500',
  unchanged: 'text-muted-foreground',
  header: 'text-blue-400',
  context: 'text-muted-foreground',
}

/**
 * Supported file extensions mapping to languages
 */
export const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',

  // Go
  '.go': 'go',

  // Rust
  '.rs': 'rust',

  // Java
  '.java': 'java',

  // Data formats
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',

  // Markup
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',

  // Styles
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',

  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',

  // SQL
  '.sql': 'sql',

  // Plain text
  '.txt': 'text',
}

/**
 * Default empty state message
 */
export const DEFAULT_EMPTY_MESSAGE = 'No changes to display'

/**
 * Copy feedback duration (ms)
 */
export const COPY_FEEDBACK_DURATION = 2000