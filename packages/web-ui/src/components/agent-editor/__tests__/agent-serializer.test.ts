/**
 * Agent Serializer Utility Tests
 *
 * Tests for agent form data to markdown conversion functionality.
 */

import { describe, it, expect } from 'vitest'
import {
  serializeAgentToMarkdown,
  canSerialize,
  estimateMarkdownSize,
  generateFileName,
} from '../utils/agent-serializer'
import type { AgentFormData } from '@/lib/schemas/agent-schema'

describe('agent-serializer', () => {
  const validAgentData: AgentFormData = {
    name: 'test-agent',
    description: 'A test agent for unit testing',
    prompt: 'You are a helpful test assistant that follows instructions carefully.',
    model: 'sonnet',
    tools: ['Read', 'Write', 'Edit'],
    skills: ['typescript', 'react', 'testing'],
  }

  describe('serializeAgentToMarkdown', () => {
    it('serializes complete agent data correctly', () => {
      const result = serializeAgentToMarkdown(validAgentData)

      expect(result).toContain('---')
      expect(result).toContain('name: "test-agent"') // Agent names with hyphens are quoted
      expect(result).toContain('description: A test agent for unit testing')
      expect(result).toContain('tools: Read,Write,Edit')
      expect(result).toContain('model: sonnet')
      expect(result).toContain('skills: typescript,react,testing')
      expect(result).toContain('You are a helpful test assistant')
    })

    it('omits empty tools array by default', () => {
      const dataWithoutTools = {
        ...validAgentData,
        tools: [],
      }

      const result = serializeAgentToMarkdown(dataWithoutTools)

      expect(result).not.toContain('tools:')
    })

    it('omits empty skills array by default', () => {
      const dataWithoutSkills = {
        ...validAgentData,
        skills: [],
      }

      const result = serializeAgentToMarkdown(dataWithoutSkills)

      expect(result).not.toContain('skills:')
    })

    it('includes empty arrays when option is set', () => {
      const dataWithEmptyArrays = {
        ...validAgentData,
        tools: [],
        skills: [],
      }

      const result = serializeAgentToMarkdown(dataWithEmptyArrays, {
        includeEmptyArrays: true,
      })

      expect(result).toContain('tools: ')
      expect(result).toContain('skills: ')
    })

    it('sorts keys when option is set', () => {
      const result = serializeAgentToMarkdown(validAgentData, {
        sortKeys: true,
      })

      const lines = result.split('\n')
      const yamlLines = lines.slice(1, -3) // Remove frontmatter delimiters and content

      // Check that keys are alphabetically sorted
      const keys = yamlLines.map(line => line.split(':')[0])
      const sortedKeys = [...keys].sort()

      expect(keys).toEqual(sortedKeys)
    })

    it('handles special characters in values', () => {
      const dataWithSpecialChars = {
        ...validAgentData,
        description: 'A test agent: with special "characters" & symbols',
      }

      const result = serializeAgentToMarkdown(dataWithSpecialChars)

      expect(result).toContain('description: "A test agent: with special \\"characters\\" & symbols"')
    })

    it('preserves prompt formatting', () => {
      const dataWithFormattedPrompt = {
        ...validAgentData,
        prompt: `You are a helpful assistant.

Here are your instructions:
1. Be helpful
2. Be accurate
3. Be concise`,
      }

      const result = serializeAgentToMarkdown(dataWithFormattedPrompt)

      expect(result).toContain('You are a helpful assistant.')
      expect(result).toContain('1. Be helpful')
      expect(result).toContain('2. Be accurate')
      expect(result).toContain('3. Be concise')
    })

    it('follows the correct YAML frontmatter format', () => {
      const result = serializeAgentToMarkdown(validAgentData)
      const lines = result.split('\n')

      // Should start and end with frontmatter delimiters
      expect(lines[0]).toBe('---')

      // Find closing frontmatter delimiter (second occurrence of ---)
      const closingDelimiterIndex = lines.findIndex((line, index) =>
        index > 0 && line === '---'
      )
      expect(closingDelimiterIndex).toBeGreaterThan(0)

      // Should have proper key: value format
      const yamlLines = lines.slice(1, closingDelimiterIndex)

      yamlLines.forEach(line => {
        if (line !== '---') {
          expect(line).toMatch(/^[a-zA-Z_-]+: /)
        }
      })
    })
  })

  describe('canSerialize', () => {
    it('returns true for valid agent data', () => {
      expect(canSerialize(validAgentData)).toBe(true)
    })

    it('returns false when name is missing', () => {
      const invalidData = { ...validAgentData, name: '' }
      expect(canSerialize(invalidData)).toBe(false)
    })

    it('returns false when description is missing', () => {
      const invalidData = { ...validAgentData, description: '' }
      expect(canSerialize(invalidData)).toBe(false)
    })

    it('returns false when prompt is missing', () => {
      const invalidData = { ...validAgentData, prompt: '' }
      expect(canSerialize(invalidData)).toBe(false)
    })

    it('returns true when optional fields are missing', () => {
      const minimalData = {
        name: 'test',
        description: 'test desc',
        prompt: 'test prompt',
      }
      expect(canSerialize(minimalData)).toBe(true)
    })
  })

  describe('estimateMarkdownSize', () => {
    it('returns character count of generated markdown', () => {
      const size = estimateMarkdownSize(validAgentData)
      const markdown = serializeAgentToMarkdown(validAgentData)

      expect(size).toBe(markdown.length)
    })

    it('returns larger size for agent with more content', () => {
      const smallAgent = {
        ...validAgentData,
        description: 'Short',
        prompt: 'Short prompt',
        tools: [],
        skills: [],
      }

      const largeAgent = {
        ...validAgentData,
        description: 'Very long description with lots of detailed information about what this agent does',
        prompt: 'Very long prompt with detailed instructions that goes on for multiple sentences and provides extensive guidance',
        tools: ['Tool1', 'Tool2', 'Tool3', 'Tool4', 'Tool5'],
        skills: ['skill1', 'skill2', 'skill3', 'skill4', 'skill5'],
      }

      const smallSize = estimateMarkdownSize(smallAgent)
      const largeSize = estimateMarkdownSize(largeAgent)

      expect(largeSize).toBeGreaterThan(smallSize)
    })
  })

  describe('generateFileName', () => {
    it('generates correct filename with .md extension', () => {
      expect(generateFileName('test-agent')).toBe('test-agent.md')
    })

    it('converts spaces to hyphens', () => {
      expect(generateFileName('My Test Agent')).toBe('my-test-agent.md')
    })

    it('converts to lowercase', () => {
      expect(generateFileName('TestAgent')).toBe('testagent.md')
    })

    it('handles multiple spaces', () => {
      expect(generateFileName('My   Test    Agent')).toBe('my-test-agent.md')
    })
  })
})