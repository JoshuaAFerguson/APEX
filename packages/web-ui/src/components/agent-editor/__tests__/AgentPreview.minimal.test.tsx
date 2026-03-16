/**
 * Minimal AgentPreview Test
 *
 * Testing only import and basic functionality to debug issues.
 */

import { describe, it, expect } from 'vitest'

describe('AgentPreview - Import Test', () => {
  it('can import the component without errors', async () => {
    try {
      const { AgentPreview } = await import('../AgentPreview')
      expect(AgentPreview).toBeDefined()
    } catch (error) {
      throw new Error(`Failed to import AgentPreview: ${error}`)
    }
  })

  it('can import serializer utilities without errors', async () => {
    try {
      const {
        serializeAgentToMarkdown,
        canSerialize,
        estimateMarkdownSize,
        generateFileName
      } = await import('../utils/agent-serializer')

      expect(serializeAgentToMarkdown).toBeDefined()
      expect(canSerialize).toBeDefined()
      expect(estimateMarkdownSize).toBeDefined()
      expect(generateFileName).toBeDefined()
    } catch (error) {
      throw new Error(`Failed to import serializer utilities: ${error}`)
    }
  })

  it('can import hook without errors', async () => {
    try {
      const { useAgentMarkdown } = await import('../hooks/useAgentMarkdown')
      expect(useAgentMarkdown).toBeDefined()
    } catch (error) {
      throw new Error(`Failed to import useAgentMarkdown hook: ${error}`)
    }
  })
})