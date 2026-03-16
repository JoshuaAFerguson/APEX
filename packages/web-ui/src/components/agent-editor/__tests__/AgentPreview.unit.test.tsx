/**
 * AgentPreview Unit Tests - Focused Testing
 *
 * Testing hook functionality and component logic without full rendering.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useAgentMarkdown } from '../hooks/useAgentMarkdown'
import {
  serializeAgentToMarkdown,
  canSerialize,
  estimateMarkdownSize,
  generateFileName
} from '../utils/agent-serializer'
import type { AgentFormData } from '@/lib/schemas/agent-schema'

const validAgentData: AgentFormData = {
  name: 'test-agent',
  description: 'A test agent for unit testing',
  prompt: 'You are a helpful test assistant that follows instructions carefully.',
  model: 'sonnet',
  tools: ['Read', 'Write', 'Edit'],
  skills: ['typescript', 'react', 'testing'],
}

describe('AgentPreview - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('useAgentMarkdown hook', () => {
    it('generates markdown and filename from valid data', () => {
      const { result } = renderHook(() => useAgentMarkdown(validAgentData))

      expect(result.current.isReady).toBe(true)
      expect(result.current.fileName).toBe('test-agent.md')
      expect(result.current.markdown).toContain('---')
      expect(result.current.markdown).toContain('name: "test-agent"')
      expect(result.current.markdown).toContain('You are a helpful test assistant')
    })

    it('returns not ready for incomplete data', () => {
      const incompleteData = {
        name: 'test',
        description: '',
        prompt: '',
      } as AgentFormData

      const { result } = renderHook(() => useAgentMarkdown(incompleteData))

      expect(result.current.isReady).toBe(false)
      expect(result.current.fileName).toBe('untitled.md')
      expect(result.current.markdown).toBe('')
    })

    it('updates when data changes', () => {
      let data = validAgentData
      const { result, rerender } = renderHook(() => useAgentMarkdown(data))

      expect(result.current.markdown).toContain('name: "test-agent"')

      // Update data
      data = { ...validAgentData, name: 'updated-agent' }
      rerender()

      expect(result.current.markdown).toContain('name: "updated-agent"')
      expect(result.current.fileName).toBe('updated-agent.md')
    })
  })

  describe('Agent serializer', () => {
    it('serializes complete agent data correctly', () => {
      const result = serializeAgentToMarkdown(validAgentData)

      // Check YAML frontmatter structure
      expect(result).toMatch(/^---\n[\s\S]+\n---\n\n[\s\S]+$/)
      expect(result).toContain('name: "test-agent"')
      expect(result).toContain('description: A test agent for unit testing')
      expect(result).toContain('tools: Read,Write,Edit')
      expect(result).toContain('model: sonnet')
      expect(result).toContain('skills: typescript,react,testing')
      expect(result).toContain('You are a helpful test assistant')
    })

    it('omits empty arrays by default', () => {
      const dataWithoutTools = {
        ...validAgentData,
        tools: [],
        skills: []
      }

      const result = serializeAgentToMarkdown(dataWithoutTools)

      expect(result).not.toContain('tools:')
      expect(result).not.toContain('skills:')
    })

    it('quotes values with special characters', () => {
      const dataWithSpecialChars = {
        ...validAgentData,
        description: 'A test agent: with special "characters"',
      }

      const result = serializeAgentToMarkdown(dataWithSpecialChars)
      expect(result).toContain('description: "A test agent: with special \\"characters\\""')
    })

    it('validates serializable data correctly', () => {
      expect(canSerialize(validAgentData)).toBe(true)
      expect(canSerialize({ ...validAgentData, name: '' })).toBe(false)
      expect(canSerialize({ ...validAgentData, description: '' })).toBe(false)
      expect(canSerialize({ ...validAgentData, prompt: '' })).toBe(false)
    })

    it('estimates markdown size correctly', () => {
      const size = estimateMarkdownSize(validAgentData)
      const actualSize = serializeAgentToMarkdown(validAgentData).length
      expect(size).toBe(actualSize)
    })

    it('generates safe filenames', () => {
      expect(generateFileName('test-agent')).toBe('test-agent.md')
      expect(generateFileName('My Test Agent')).toBe('my-test-agent.md')
      expect(generateFileName('TestAgent')).toBe('testagent.md')
    })
  })

  describe('Markdown format validation', () => {
    it('follows correct YAML frontmatter format', () => {
      const markdown = serializeAgentToMarkdown(validAgentData)
      const lines = markdown.split('\n')

      // Should start with frontmatter delimiter
      expect(lines[0]).toBe('---')

      // Find closing delimiter
      const closingIndex = lines.findIndex((line, index) =>
        index > 0 && line === '---'
      )
      expect(closingIndex).toBeGreaterThan(0)

      // Should have empty line before prompt
      expect(lines[closingIndex + 1]).toBe('')

      // Prompt should start after empty line
      expect(lines[closingIndex + 2]).toBe('You are a helpful test assistant that follows instructions carefully.')
    })

    it('handles multiline prompts correctly', () => {
      const dataWithMultilinePrompt = {
        ...validAgentData,
        prompt: 'Line 1\n\nLine 2\nLine 3'
      }

      const markdown = serializeAgentToMarkdown(dataWithMultilinePrompt)

      expect(markdown).toContain('Line 1')
      expect(markdown).toContain('Line 2')
      expect(markdown).toContain('Line 3')
    })
  })
})