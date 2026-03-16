/**
 * Constants for AgentPreview component
 *
 * @module components/agent-editor/constants
 */

/**
 * Test IDs for component testing
 */
export const TEST_IDS = {
  agentPreview: 'agent-preview',
  agentPreviewContent: 'agent-preview-content',
  copyButton: 'agent-preview-copy-button',
  downloadButton: 'agent-preview-download-button',
  validationStatus: 'agent-preview-validation-status',
} as const

/**
 * Default props for AgentPreview
 */
export const AGENT_PREVIEW_DEFAULTS = {
  showFileName: true,
  showCopyButton: true,
  showDownloadButton: true,
  maxHeight: 400,
  showValidationStatus: true,
} as const