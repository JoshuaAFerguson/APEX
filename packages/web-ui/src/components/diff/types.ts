/**
 * Rich Diff Viewer Component Types
 *
 * Comprehensive type definitions for the diff viewer component system.
 * Supports multiple view modes (unified/split/inline) with syntax highlighting.
 */

/**
 * View mode for diff display
 */
export type DiffViewMode = 'unified' | 'split' | 'inline'

/**
 * Type of change for a diff line
 */
export type DiffLineType = 'added' | 'removed' | 'unchanged' | 'header' | 'context'

/**
 * Programming language for syntax highlighting
 */
export type SupportedLanguage =
  | 'javascript' | 'typescript' | 'jsx' | 'tsx'
  | 'python' | 'go' | 'rust' | 'java'
  | 'json' | 'yaml' | 'markdown' | 'shell'
  | 'css' | 'html' | 'sql'
  | 'text' | 'unknown'

/**
 * Represents a single line in a diff
 */
export interface DiffLineData {
  /** Line number in the old file (null for added lines) */
  oldLineNumber: number | null
  /** Line number in the new file (null for removed lines) */
  newLineNumber: number | null
  /** Type of change */
  type: DiffLineType
  /** Raw content of the line (without +/- prefix) */
  content: string
  /** Whether this line is selected */
  isSelected?: boolean
}

/**
 * Represents a chunk/hunk in a diff
 */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number
  /** Number of lines in old file section */
  oldLines: number
  /** Starting line in new file */
  newStart: number
  /** Number of lines in new file section */
  newLines: number
  /** Header text (e.g., @@ -1,4 +1,6 @@) */
  header: string
  /** Lines in this hunk */
  lines: DiffLineData[]
}

/**
 * Represents a complete file diff
 */
export interface FileDiff {
  /** Original file path */
  oldPath: string
  /** New file path (may differ for renames) */
  newPath: string
  /** Whether this is a new file */
  isNew: boolean
  /** Whether this is a deleted file */
  isDeleted: boolean
  /** Whether this is a renamed file */
  isRenamed: boolean
  /** Whether this is a binary file */
  isBinary: boolean
  /** Detected language for highlighting */
  language: SupportedLanguage
  /** Hunks containing the actual changes */
  hunks: DiffHunk[]
}

/**
 * Configuration for syntax highlighting
 */
export interface HighlightConfig {
  /** Enable/disable highlighting */
  enabled: boolean
  /** Custom highlighter function (for future Prism.js integration) */
  highlighter?: (code: string, language: SupportedLanguage) => string
  /** Theme name (affects CSS class prefix) */
  theme?: 'dark' | 'light' | 'auto'
}

/**
 * Props for DiffViewer component
 */
export interface DiffViewerProps {
  /** Raw diff content (unified diff format) */
  diff: string
  /** File path(s) for language detection */
  filePath?: string
  /** Display mode */
  mode?: DiffViewMode
  /** Allow mode switching via UI */
  showModeSelector?: boolean
  /** Show line numbers */
  showLineNumbers?: boolean
  /** Enable syntax highlighting */
  highlighting?: boolean | HighlightConfig
  /** Show copy button */
  showCopyButton?: boolean
  /** Maximum height before scrolling */
  maxHeight?: number | string
  /** Callback when line is clicked */
  onLineClick?: (line: DiffLineData, index: number) => void
  /** Callback when lines are selected */
  onSelectionChange?: (selectedLines: DiffLineData[]) => void
  /** Callback when copy is triggered */
  onCopy?: (content: string) => void
  /** Additional class name */
  className?: string
  /** Loading state */
  loading?: boolean
  /** Error state */
  error?: string | null
  /** Custom empty state message */
  emptyMessage?: string
  /** File header visibility */
  showFileHeader?: boolean
  /** Expand/collapse hunks */
  collapsible?: boolean
  /** Initially collapsed */
  defaultCollapsed?: boolean
}

/**
 * Props for DiffLine component
 */
export interface DiffLineProps {
  line: DiffLineData
  index: number
  language: SupportedLanguage
  showLineNumbers: boolean
  highlighting: boolean
  onClick?: (line: DiffLineData, index: number) => void
  isSelected?: boolean
  className?: string
}

/**
 * Copy button props
 */
export interface DiffCopyButtonProps {
  content: string
  onCopy?: (content: string) => void
  className?: string
  variant?: 'icon' | 'text' | 'icon-text'
}

/**
 * Props for view mode components
 */
export interface DiffViewModeProps {
  fileDiff: FileDiff
  showLineNumbers: boolean
  highlighting: boolean
  highlightConfig?: HighlightConfig
  selectedLines: Set<number>
  onLineClick: (line: DiffLineData, index: number) => void
  collapsible: boolean
  defaultCollapsed: boolean
}

/**
 * Props for DiffLineNumber component
 */
export interface DiffLineNumberProps {
  number: number | null
  type?: 'normal' | 'empty'
  className?: string
}

/**
 * Props for DiffHeader component
 */
export interface DiffHeaderProps {
  oldPath: string
  newPath: string
  isNew: boolean
  isDeleted: boolean
  isRenamed: boolean
  className?: string
}

/**
 * Props for DiffModeSelector component
 */
export interface DiffModeSelectorProps {
  value: DiffViewMode
  onChange: (mode: DiffViewMode) => void
  className?: string
}