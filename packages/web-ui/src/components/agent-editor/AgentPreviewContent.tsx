/**
 * AgentPreviewContent Component
 *
 * Content display component for AgentPreview.
 * Renders markdown with syntax-highlighted YAML frontmatter.
 *
 * @module components/agent-editor/AgentPreviewContent
 */

'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AgentPreviewContentProps } from './types'

/**
 * Content display component for AgentPreview
 * Renders markdown with syntax-highlighted YAML frontmatter
 */
export function AgentPreviewContent({
  content,
  highlighting = true,
  maxHeight = 400,
  className,
}: AgentPreviewContentProps) {
  // Parse and highlight content
  const highlightedContent = useMemo(() => {
    if (!highlighting) {
      return { __html: escapeHtml(content) }
    }
    return { __html: highlightAgentMarkdown(content) }
  }, [content, highlighting])

  return (
    <div
      className={cn(
        'flex-1 overflow-auto',
        className
      )}
      style={{ maxHeight }}
    >
      <pre
        className="p-4 text-sm font-mono leading-relaxed text-foreground bg-background"
        data-testid="agent-preview-content"
      >
        <code dangerouslySetInnerHTML={highlightedContent} />
      </pre>
    </div>
  )
}

/**
 * Apply syntax highlighting to agent markdown content
 * Highlights YAML frontmatter and markdown body separately
 */
function highlightAgentMarkdown(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []

  let inFrontmatter = false
  let frontmatterStarted = false

  for (const line of lines) {
    // Handle frontmatter delimiters
    if (line.trim() === '---') {
      if (!frontmatterStarted) {
        frontmatterStarted = true
        inFrontmatter = true
        result.push(`<span class="yaml-delimiter">${escapeHtml(line)}</span>`)
      } else {
        inFrontmatter = false
        result.push(`<span class="yaml-delimiter">${escapeHtml(line)}</span>`)
      }
      continue
    }

    if (inFrontmatter) {
      // Highlight YAML key-value pairs
      result.push(highlightYamlLine(line))
    } else {
      // Markdown body - minimal highlighting
      result.push(highlightMarkdownLine(line))
    }
  }

  return result.join('\n')
}

/**
 * Highlight a single YAML line
 */
function highlightYamlLine(line: string): string {
  // Match key: value pattern
  const match = line.match(/^(\s*)([a-zA-Z_-]+)(\s*:\s*)(.*)$/)

  if (match) {
    const [, indent, key, separator, value] = match
    return `${escapeHtml(indent)}<span class="yaml-key">${escapeHtml(key)}</span><span class="yaml-separator">${escapeHtml(separator)}</span><span class="yaml-value">${escapeHtml(value)}</span>`
  }

  return escapeHtml(line)
}

/**
 * Highlight a markdown line (minimal highlighting for readability)
 */
function highlightMarkdownLine(line: string): string {
  let result = escapeHtml(line)

  // Highlight headers
  if (/^#{1,6}\s/.test(line)) {
    result = `<span class="md-header">${result}</span>`
  }

  // Highlight bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<span class="md-bold">**$1**</span>')

  // Highlight code
  result = result.replace(/`([^`]+)`/g, '<span class="md-code">`$1`</span>')

  // Highlight lists
  if (/^\s*[-*+]\s/.test(line)) {
    result = `<span class="md-list">${result}</span>`
  }

  // Highlight numbered lists
  if (/^\s*\d+\.\s/.test(line)) {
    result = `<span class="md-list">${result}</span>`
  }

  return result
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}