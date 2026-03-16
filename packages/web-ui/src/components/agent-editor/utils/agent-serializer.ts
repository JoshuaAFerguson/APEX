/**
 * Agent Serializer Utility
 *
 * Converts agent form data to markdown format with YAML frontmatter.
 * Follows the format expected by @apexcli/core config.ts saveAgent() function.
 *
 * @module components/agent-editor/utils/agent-serializer
 */

import type { AgentFormData } from '@/lib/schemas/agent-schema'
import type { AgentSerializerOptions } from '../types'

/**
 * Default serializer options
 */
const DEFAULT_OPTIONS: AgentSerializerOptions = {
  includeEmptyArrays: false,
  sortKeys: false,
}

/**
 * Serializes agent form data to markdown format with YAML frontmatter
 *
 * Follows the format expected by @apexcli/core:
 * - YAML frontmatter with name, description, tools, model, skills
 * - Tools and skills as comma-separated strings
 * - Markdown body containing the agent prompt
 *
 * @param data - Agent form data to serialize
 * @param options - Serialization options
 * @returns Markdown string with YAML frontmatter
 *
 * @example
 * ```typescript
 * const markdown = serializeAgentToMarkdown({
 *   name: 'developer',
 *   description: 'A software developer agent',
 *   prompt: 'You are a senior developer...',
 *   model: 'sonnet',
 *   tools: ['Read', 'Write', 'Edit'],
 *   skills: ['typescript', 'react'],
 * })
 * // Returns:
 * // ---
 * // name: developer
 * // description: A software developer agent
 * // tools: Read,Write,Edit
 * // model: sonnet
 * // skills: typescript,react
 * // ---
 * //
 * // You are a senior developer...
 * ```
 */
export function serializeAgentToMarkdown(
  data: AgentFormData,
  options: AgentSerializerOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Build frontmatter object
  const frontmatter: Record<string, string> = {
    name: data.name,
    description: data.description,
  }

  // Add tools if present
  if (data.tools && data.tools.length > 0) {
    frontmatter.tools = data.tools.join(',')
  } else if (opts.includeEmptyArrays) {
    frontmatter.tools = ''
  }

  // Add model if present and not default
  if (data.model) {
    frontmatter.model = data.model
  }

  // Add skills if present
  if (data.skills && data.skills.length > 0) {
    frontmatter.skills = data.skills.join(',')
  } else if (opts.includeEmptyArrays) {
    frontmatter.skills = ''
  }

  // Build YAML frontmatter string manually (simpler and more predictable than using a YAML library)
  const yamlLines: string[] = []

  // Determine key order - use the same order as core saveAgent function
  const keyOrder = opts.sortKeys
    ? Object.keys(frontmatter).sort()
    : ['name', 'description', 'tools', 'model', 'skills']

  for (const key of keyOrder) {
    if (key in frontmatter) {
      const value = frontmatter[key]
      // Escape YAML values if they contain special characters
      const escapedValue = needsYamlQuoting(value) ? `"${escapeYamlString(value)}"` : value
      yamlLines.push(`${key}: ${escapedValue}`)
    }
  }

  const yamlContent = yamlLines.join('\n')
  const prompt = data.prompt?.trim() || ''

  return `---\n${yamlContent}\n---\n\n${prompt}`
}

/**
 * Checks if a YAML value needs quoting
 */
function needsYamlQuoting(value: string): boolean {
  // Quote if contains special YAML characters or starts with special characters
  const yamlSpecialChars = /[:\[\]{}|>@`"'%&*?#-]/
  const startsWithSpecial = /^[\s\d@`"'|>*&%{[\]!,-]/

  return yamlSpecialChars.test(value) || startsWithSpecial.test(value)
}

/**
 * Escapes a string for use in quoted YAML
 */
function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/"/g, '\\"')   // Escape quotes
    .replace(/\n/g, '\\n')  // Escape newlines
    .replace(/\r/g, '\\r')  // Escape carriage returns
    .replace(/\t/g, '\\t')  // Escape tabs
}

/**
 * Validates that agent data can be serialized
 *
 * @param data - Agent form data to validate
 * @returns True if data can be serialized
 */
export function canSerialize(data: Partial<AgentFormData>): boolean {
  return Boolean(data.name && data.description && data.prompt)
}

/**
 * Estimates the character count of the generated markdown
 * Useful for displaying file size information
 *
 * @param data - Agent form data
 * @returns Estimated character count
 */
export function estimateMarkdownSize(data: AgentFormData): number {
  const markdown = serializeAgentToMarkdown(data)
  return markdown.length
}

/**
 * Generates a safe filename from agent name
 *
 * @param agentName - The agent name
 * @returns Safe filename with .md extension
 */
export function generateFileName(agentName: string): string {
  return `${agentName.replace(/\s+/g, '-').toLowerCase()}.md`
}