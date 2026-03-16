/**
 * AgentPreviewHeader Component
 *
 * Header component for AgentPreview.
 * Shows file name, validation status, and action buttons.
 *
 * @module components/agent-editor/AgentPreviewHeader
 */

'use client'

import React from 'react'
import { Copy, Download, FileText, Check, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentPreviewHeaderProps } from './types'

/**
 * Header component for AgentPreview
 * Shows file name, validation status, and action buttons
 */
export function AgentPreviewHeader({
  agentName,
  isValid,
  showValidationStatus,
  showCopyButton,
  showDownloadButton,
  onCopy,
  onDownload,
  copied = false,
  className,
}: AgentPreviewHeaderProps & { copied?: boolean }) {
  const fileName = `${agentName.replace(/\s+/g, '-').toLowerCase()}.md`

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 border-b bg-background-tertiary',
      'border-border',
      className
    )}>
      {/* File name and icon */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-foreground-secondary" />
        <span className="font-medium text-sm text-foreground">{fileName}</span>

        {/* Validation status */}
        {showValidationStatus && (
          <span className="flex items-center gap-1">
            {isValid ? (
              <CheckCircle2
                className="w-4 h-4 text-green-500"
                aria-label="Valid agent definition"
              />
            ) : (
              <AlertCircle
                className="w-4 h-4 text-amber-500"
                aria-label="Incomplete agent definition"
              />
            )}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {showCopyButton && (
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              'p-2 text-foreground-secondary hover:text-foreground',
              'hover:bg-background-secondary rounded-md transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
            )}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
            data-testid="agent-preview-copy-button"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        )}

        {showDownloadButton && (
          <button
            type="button"
            onClick={onDownload}
            className={cn(
              'p-2 text-foreground-secondary hover:text-foreground',
              'hover:bg-background-secondary rounded-md transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
            )}
            title="Download as .md file"
            aria-label="Download as .md file"
            data-testid="agent-preview-download-button"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}