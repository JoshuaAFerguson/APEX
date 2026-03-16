/**
 * AgentPreview Component
 *
 * Main component for displaying a live preview of agent definition
 * as a markdown file with YAML frontmatter and syntax highlighting.
 *
 * @module components/agent-editor/AgentPreview
 */

'use client'

import React, { forwardRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAgentMarkdown } from './hooks/useAgentMarkdown'
import { AgentPreviewHeader } from './AgentPreviewHeader'
import { AgentPreviewContent } from './AgentPreviewContent'
import { Spinner } from '@/components/ui/Spinner'
import type { AgentPreviewProps } from './types'

/**
 * AgentPreview Component
 *
 * Displays a live preview of agent definition as a markdown file
 * with YAML frontmatter and syntax highlighting.
 *
 * @example
 * ```tsx
 * <AgentPreview
 *   data={formData}
 *   showCopyButton
 *   showDownloadButton
 *   onCopy={(content) => console.log('Copied:', content)}
 * />
 * ```
 */
export const AgentPreview = forwardRef<HTMLDivElement, AgentPreviewProps>(
  ({
    data,
    className,
    showFileName = true,
    showCopyButton = true,
    showDownloadButton = true,
    maxHeight = 400,
    onCopy,
    loading = false,
    isValid = true,
    showValidationStatus = true,
  }, ref) => {
    const [copied, setCopied] = useState(false)

    // Generate markdown from form data
    const { markdown, fileName, isReady } = useAgentMarkdown(data)

    // Handle copy to clipboard
    const handleCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(markdown)
        setCopied(true)
        onCopy?.(markdown)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    }, [markdown, onCopy])

    // Handle download
    const handleDownload = useCallback(() => {
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    }, [markdown, fileName])

    // Loading state
    if (loading || !isReady) {
      return (
        <div className={cn(
          'flex items-center justify-center p-8 border rounded-lg',
          'border-border bg-background-secondary',
          className
        )}>
          <Spinner size="md" />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'border rounded-lg bg-background-secondary overflow-hidden flex flex-col',
          'border-border',
          className
        )}
        data-testid="agent-preview"
      >
        {/* Header with controls */}
        {showFileName && (
          <AgentPreviewHeader
            agentName={data.name || 'untitled'}
            isValid={isValid}
            showValidationStatus={showValidationStatus}
            showCopyButton={showCopyButton}
            showDownloadButton={showDownloadButton}
            onCopy={handleCopy}
            onDownload={handleDownload}
            copied={copied}
          />
        )}

        {/* Preview content */}
        <AgentPreviewContent
          content={markdown}
          highlighting
          maxHeight={maxHeight}
        />
      </div>
    )
  }
)

AgentPreview.displayName = 'AgentPreview'