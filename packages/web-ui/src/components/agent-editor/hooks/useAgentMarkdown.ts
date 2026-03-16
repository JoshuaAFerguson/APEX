/**
 * useAgentMarkdown Hook
 *
 * Hook that generates markdown content from agent form data.
 * Updates reactively when form data changes.
 *
 * @module components/agent-editor/hooks/useAgentMarkdown
 */

'use client'

import { useMemo } from 'react'
import type { AgentFormData } from '@/lib/schemas/agent-schema'
import { serializeAgentToMarkdown, generateFileName } from '../utils/agent-serializer'
import type { UseAgentMarkdownResult } from '../types'

/**
 * Hook that generates markdown content from agent form data
 *
 * @param data - Agent form data to convert to markdown
 * @returns Generated markdown, filename, and ready state
 *
 * @example
 * ```tsx
 * const { markdown, fileName, isReady } = useAgentMarkdown(formData)
 * ```
 */
export function useAgentMarkdown(data: AgentFormData): UseAgentMarkdownResult {
  return useMemo(() => {
    // Guard against missing required data
    if (!data || !data.name || !data.description || !data.prompt) {
      return {
        markdown: '',
        fileName: 'untitled.md',
        isReady: false,
      }
    }

    const markdown = serializeAgentToMarkdown(data)
    const fileName = generateFileName(data.name)

    return {
      markdown,
      fileName,
      isReady: true,
    }
  }, [data])
}