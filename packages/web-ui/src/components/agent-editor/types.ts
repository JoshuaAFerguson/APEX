/**
 * Type definitions for AgentPreview component
 *
 * @module components/agent-editor/types
 */

import type { AgentFormData } from '@/lib/schemas/agent-schema'

/**
 * Props for AgentPreview component
 */
export interface AgentPreviewProps {
  /** Agent form data to preview */
  data: AgentFormData
  /** Optional class name for styling */
  className?: string
  /** Show/hide file name header */
  showFileName?: boolean
  /** Show copy button */
  showCopyButton?: boolean
  /** Show download button */
  showDownloadButton?: boolean
  /** Maximum height before scrolling */
  maxHeight?: number | string
  /** Callback when copy is triggered */
  onCopy?: (content: string) => void
  /** Loading state */
  loading?: boolean
  /** Whether the form data is valid */
  isValid?: boolean
  /** Show validation status indicator */
  showValidationStatus?: boolean
}

/**
 * Props for AgentPreviewHeader component
 */
export interface AgentPreviewHeaderProps {
  /** Agent name for file name display */
  agentName: string
  /** Whether form data is valid */
  isValid: boolean
  /** Show validation indicator */
  showValidationStatus: boolean
  /** Copy button visibility */
  showCopyButton: boolean
  /** Download button visibility */
  showDownloadButton: boolean
  /** Copy callback */
  onCopy: () => void
  /** Download callback */
  onDownload: () => void
  /** Whether content was just copied */
  copied?: boolean
  /** Optional className */
  className?: string
}

/**
 * Props for AgentPreviewContent component
 */
export interface AgentPreviewContentProps {
  /** Generated markdown content */
  content: string
  /** Enable syntax highlighting */
  highlighting?: boolean
  /** Maximum height */
  maxHeight?: number | string
  /** Optional className */
  className?: string
}

/**
 * Options for markdown generation
 */
export interface AgentSerializerOptions {
  /** Whether to include empty arrays in output */
  includeEmptyArrays?: boolean
  /** Whether to sort frontmatter keys */
  sortKeys?: boolean
}

/**
 * Result of useAgentMarkdown hook
 */
export interface UseAgentMarkdownResult {
  /** Generated markdown content */
  markdown: string
  /** File name for download */
  fileName: string
  /** Whether content is ready */
  isReady: boolean
}