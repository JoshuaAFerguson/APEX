/**
 * AgentPreview Edge Cases and Error Handling Tests
 *
 * Tests for edge cases, error conditions, and boundary values.
 */

import { describe, it, expect, vi } from 'vitest'
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

describe('AgentPreview - Edge Cases and Error Handling', () => {
  describe('Boundary conditions', () => {
    it('handles empty agent name gracefully', () => {
      const data: AgentFormData = {
        name: '',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      expect(canSerialize(data)).toBe(false)

      const { result } = renderHook(() => useAgentMarkdown(data))
      expect(result.current.isReady).toBe(false)
    })

    it('handles empty description gracefully', () => {
      const data: AgentFormData = {
        name: 'test-agent',
        description: '',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      expect(canSerialize(data)).toBe(false)

      const { result } = renderHook(() => useAgentMarkdown(data))
      expect(result.current.isReady).toBe(false)
    })

    it('handles empty prompt gracefully', () => {
      const data: AgentFormData = {
        name: 'test-agent',
        description: 'Test description',
        prompt: '',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      expect(canSerialize(data)).toBe(false)

      const { result } = renderHook(() => useAgentMarkdown(data))
      expect(result.current.isReady).toBe(false)
    })

    it('handles whitespace-only fields', () => {
      const data: AgentFormData = {
        name: '   ',
        description: '\n\t ',
        prompt: '  \n  ',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      // canSerialize only checks for truthy strings, not if they're meaningful
      // This is considered valid by the current implementation
      expect(canSerialize(data)).toBe(true)
    })

    it('handles minimal valid data', () => {
      const minimalData: AgentFormData = {
        name: 'minimal',
        description: 'a',
        prompt: 'b',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      expect(canSerialize(minimalData)).toBe(true)

      const markdown = serializeAgentToMarkdown(minimalData)
      expect(markdown).toContain('name: minimal')
      expect(markdown).toContain('description: a')
      expect(markdown).not.toContain('tools:')
      expect(markdown).not.toContain('skills:')
      expect(markdown).toContain('\n\nb')
    })

    it('handles maximum length data', () => {
      const longString = 'a'.repeat(10000)
      const maxData: AgentFormData = {
        name: longString,
        description: longString,
        prompt: longString,
        model: 'sonnet',
        tools: Array(100).fill('LongToolName'.repeat(10)),
        skills: Array(100).fill('long-skill-name'.repeat(5))
      }

      expect(canSerialize(maxData)).toBe(true)

      const markdown = serializeAgentToMarkdown(maxData)
      expect(markdown.length).toBeGreaterThan(30000)

      const estimatedSize = estimateMarkdownSize(maxData)
      expect(estimatedSize).toBe(markdown.length)
    })
  })

  describe('Special character handling', () => {
    it('handles YAML special characters in name', () => {
      const data: AgentFormData = {
        name: 'agent:with[special]chars',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('name: "agent:with[special]chars"')
    })

    it('handles quotes in description', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'A "quoted" description with \'single quotes\'',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('description: "A \\"quoted\\" description with \'single quotes\'"')
    })

    it('handles newlines in description', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Line 1\nLine 2\rLine 3\r\nLine 4',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      // The implementation splits newlines into separate YAML lines
      expect(markdown).toContain('description: Line 1')
      expect(markdown).toContain('Line 2')
      expect(markdown).toContain('Line 3')
      expect(markdown).toContain('Line 4')
    })

    it('handles unicode characters', () => {
      const data: AgentFormData = {
        name: 'agent-émoji-🤖',
        description: 'Descripción with unicode: αβγ 中文 🎉',
        prompt: 'Unicode prompt: ñ ü ç',
        model: 'sonnet',
        tools: ['Tool-🔧'],
        skills: ['skill-αβγ']
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('name: "agent-émoji-🤖"')
      expect(markdown).toContain('Descripción with unicode: αβγ 中文 🎉')
      expect(markdown).toContain('tools: "Tool-🔧"') // Tools with hyphens get quoted
      expect(markdown).toContain('skills: "skill-αβγ"') // Skills with hyphens get quoted
      expect(markdown).toContain('Unicode prompt: ñ ü ç')
    })

    it('handles backslashes in text', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Path: C:\\Users\\Agent\\file.txt',
        prompt: 'Use regex: \\d+ for numbers',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('description: "Path: C:\\\\Users\\\\Agent\\\\file.txt"')
      expect(markdown).toContain('Use regex: \\d+ for numbers')
    })
  })

  describe('Array handling edge cases', () => {
    it('handles empty arrays with includeEmptyArrays option', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data, { includeEmptyArrays: true })
      expect(markdown).toContain('tools: ')
      expect(markdown).toContain('skills: ')
    })

    it('handles tools with special characters', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: ['Read-Write', 'API:Call', 'File[System]'],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      // Tools with special characters get quoted according to YAML rules
      expect(markdown).toContain('tools: "Read-Write,API:Call,File[System]"')
    })

    it('handles single item arrays', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: ['OnlyTool'],
        skills: ['only-skill']
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('tools: OnlyTool')
      // Skills with hyphens get quoted according to YAML rules
      expect(markdown).toContain('skills: "only-skill"')
    })

    it('handles duplicate items in arrays', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: ['Read', 'Write', 'Read', 'Edit'],
        skills: ['js', 'ts', 'js']
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('tools: Read,Write,Read,Edit')
      expect(markdown).toContain('skills: js,ts,js')
    })
  })

  describe('File name generation edge cases', () => {
    it('handles very long agent names', () => {
      const longName = 'a'.repeat(200)
      const fileName = generateFileName(longName)
      expect(fileName).toBe(longName.toLowerCase() + '.md')
    })

    it('handles agent names with multiple spaces', () => {
      expect(generateFileName('My    Agent   Name')).toBe('my-agent-name.md')
    })

    it('handles agent names with leading/trailing spaces', () => {
      expect(generateFileName('  Agent Name  ')).toBe('agent-name.md')
    })

    it('handles agent names with only spaces', () => {
      expect(generateFileName('   ')).toBe('.md')
    })

    it('handles agent names with special characters', () => {
      expect(generateFileName('Agent@Name#1')).toBe('agent@name#1.md')
    })

    it('handles empty agent name', () => {
      expect(generateFileName('')).toBe('.md')
    })
  })

  describe('Model field handling', () => {
    it('includes model when present', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'opus',
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).toContain('model: opus')
    })

    it('handles undefined model', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: undefined as any,
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).not.toContain('model:')
    })

    it('handles empty string model', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: '' as any,
        tools: [],
        skills: []
      }

      const markdown = serializeAgentToMarkdown(data)
      expect(markdown).not.toContain('model:')
    })
  })

  describe('Key sorting option', () => {
    it('sorts keys alphabetically when sortKeys is true', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: ['Read'],
        skills: ['js']
      }

      const markdown = serializeAgentToMarkdown(data, { sortKeys: true })
      const lines = markdown.split('\n')
      const yamlLines = lines.slice(1, lines.findIndex((line, i) => i > 0 && line === '---'))

      const keys = yamlLines.map(line => line.split(':')[0])
      const sortedKeys = [...keys].sort()

      expect(keys).toEqual(sortedKeys)
    })

    it('maintains original order when sortKeys is false', () => {
      const data: AgentFormData = {
        name: 'test',
        description: 'Test description',
        prompt: 'Test prompt',
        model: 'sonnet',
        tools: ['Read'],
        skills: ['js']
      }

      const markdown = serializeAgentToMarkdown(data, { sortKeys: false })
      const lines = markdown.split('\n')
      const yamlLines = lines.slice(1, lines.findIndex((line, i) => i > 0 && line === '---'))

      const keys = yamlLines.map(line => line.split(':')[0])

      // Should follow the expected order: name, description, tools, model, skills
      const expectedOrder = ['name', 'description', 'tools', 'model', 'skills']
      expect(keys).toEqual(expectedOrder)
    })
  })
})