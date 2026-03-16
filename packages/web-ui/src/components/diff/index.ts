/**
 * Diff Viewer Component Exports
 *
 * Public API for the Rich Diff Viewer component system.
 */

// Main component
export { DiffViewer } from './DiffViewer'

// Subcomponents (for advanced usage)
export { DiffCopyButton } from './DiffCopyButton'
export { DiffModeSelector } from './DiffModeSelector'
export { DiffHeader } from './DiffHeader'
export { DiffLine } from './DiffLine'
export { DiffLineNumber } from './DiffLineNumber'

// View mode components (for custom implementations)
export { DiffViewerUnified } from './DiffViewerUnified'
export { DiffViewerSplit } from './DiffViewerSplit'
export { DiffViewerInline } from './DiffViewerInline'

// Hooks
export { useDiffParser, useDiffFilePaths } from './hooks/useDiffParser'

// Utilities
export { parseDiff, isValidDiff, getDiffStats } from './utils/diff-parser'
export { detectLanguage, isHighlightingSupported, getLanguageDisplayName } from './utils/language-detector'
export { highlightLine, looksLikeCode, getThemePrefix } from './utils/syntax-highlighter'

// Constants
export {
  DEFAULT_VIEW_MODE,
  DEFAULT_HIGHLIGHT_CONFIG,
  DEFAULT_MAX_HEIGHT,
  DEFAULT_EMPTY_MESSAGE,
  EXTENSION_MAP,
  LINE_TYPE_STYLES,
  LINE_TYPE_INDICATOR,
  LINE_TYPE_INDICATOR_COLOR,
  COPY_FEEDBACK_DURATION,
} from './constants'

// Types
export type {
  DiffViewMode,
  DiffLineType,
  SupportedLanguage,
  DiffLineData,
  DiffHunk,
  FileDiff,
  HighlightConfig,
  DiffViewerProps,
  DiffLineProps,
  DiffCopyButtonProps,
  DiffViewModeProps,
  DiffLineNumberProps,
  DiffHeaderProps,
  DiffModeSelectorProps,
} from './types'