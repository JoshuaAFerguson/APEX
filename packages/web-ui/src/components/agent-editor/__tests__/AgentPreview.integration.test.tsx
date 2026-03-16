/**
 * AgentPreview Integration Tests
 *
 * Integration tests that verify the complete functionality
 * of the AgentPreview component suite.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AgentPreview } from '../AgentPreview'
import type { AgentFormData } from '@/lib/schemas/agent-schema'

// Mock APIs
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
})

const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
}

// Store original createElement
const originalCreateElement = document.createElement.bind(document)

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tag: string) => {
    if (tag === 'a') {
      return mockLink
    }
    return originalCreateElement(tag)
  }),
})

Object.defineProperty(document.body, 'appendChild', { value: vi.fn() })
Object.defineProperty(document.body, 'removeChild', { value: vi.fn() })

describe('AgentPreview Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('handles complete agent creation workflow', async () => {
    // Start with empty/invalid data
    const initialData: Partial<AgentFormData> = {
      name: '',
      description: '',
      prompt: '',
    }

    const { rerender } = render(
      <AgentPreview
        data={initialData as AgentFormData}
        isValid={false}
        showValidationStatus
      />
    )

    // Should show loading/invalid state
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Simulate progressive form filling
    const step1Data: Partial<AgentFormData> = {
      name: 'developer',
      description: 'A software development agent',
      prompt: '',
    }

    rerender(
      <AgentPreview
        data={step1Data as AgentFormData}
        isValid={false}
        showValidationStatus
      />
    )

    // Still loading because prompt is empty
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Complete the form
    const completeData: AgentFormData = {
      name: 'developer',
      description: 'A software development agent',
      prompt: 'You are a senior software developer with expertise in TypeScript and React.',
      model: 'sonnet',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
      skills: ['typescript', 'react', 'nodejs'],
    }

    rerender(
      <AgentPreview
        data={completeData}
        isValid={true}
        showValidationStatus
      />
    )

    // Now should show the complete preview
    expect(screen.getByTestId('agent-preview')).toBeInTheDocument()
    expect(screen.getByText('developer.md')).toBeInTheDocument()
    expect(screen.getByLabelText('Valid agent definition')).toBeInTheDocument()

    // Verify content includes all fields
    const content = screen.getByTestId('agent-preview-content')
    const textContent = content.textContent || ''

    expect(textContent).toContain('name: developer') // Simple names don't get quoted
    expect(textContent).toContain('description: A software development agent')
    expect(textContent).toContain('tools: Read,Write,Edit,Bash')
    expect(textContent).toContain('model: sonnet')
    expect(textContent).toContain('skills: typescript,react,nodejs')
    expect(textContent).toContain('You are a senior software developer')
  })

  it('handles real-time form updates', async () => {
    const initialData: AgentFormData = {
      name: 'test-agent',
      description: 'Initial description',
      prompt: 'Initial prompt',
      model: 'sonnet',
      tools: ['Read'],
      skills: ['testing'],
    }

    const { rerender } = render(<AgentPreview data={initialData} />)

    // Verify initial content
    let content = screen.getByTestId('agent-preview-content')
    expect(content.textContent).toContain('Initial description')
    expect(content.textContent).toContain('tools: Read')

    // Simulate form field updates
    const updatedData: AgentFormData = {
      ...initialData,
      description: 'Updated description with more details',
      tools: ['Read', 'Write', 'Edit'],
      skills: ['testing', 'automation', 'quality-assurance'],
    }

    rerender(<AgentPreview data={updatedData} />)

    // Verify updates are reflected immediately
    content = screen.getByTestId('agent-preview-content')
    expect(content.textContent).toContain('Updated description with more details')
    expect(content.textContent).toContain('tools: Read,Write,Edit')
    expect(content.textContent).toContain('skills: testing,automation,quality-assurance')
    expect(content.textContent).not.toContain('Initial description')
  })

  it('handles copy-paste workflow', async () => {
    const testData: AgentFormData = {
      name: 'copy-test',
      description: 'Agent for testing copy functionality',
      prompt: 'You are a test agent for validating copy-paste workflows.',
      model: 'sonnet',
      tools: ['Read', 'Write'],
      skills: ['testing'],
    }

    const onCopyMock = vi.fn()
    render(<AgentPreview data={testData} onCopy={onCopyMock} />)

    // Click copy button
    const copyButton = screen.getByTestId('agent-preview-copy-button')
    fireEvent.click(copyButton)

    // Verify clipboard interaction
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('name: "copy-test"')
      )
    })

    // Verify callback was called with complete markdown
    await waitFor(() => {
      expect(onCopyMock).toHaveBeenCalledWith(
        expect.stringMatching(/^---\nname: "copy-test"[\s\S]*You are a test agent for validating copy-paste workflows\.$/m)
      )
    })

    // Verify success feedback
    expect(screen.getByLabelText('Copied!')).toBeInTheDocument()

    // Feedback should disappear after timeout
    await waitFor(() => {
      expect(screen.queryByLabelText('Copied!')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles download workflow', () => {
    const testData: AgentFormData = {
      name: 'Download Test Agent',
      description: 'Agent for testing download functionality',
      prompt: 'You are a test agent for validating download workflows.',
      model: 'sonnet',
      tools: ['Read', 'Write'],
      skills: ['testing'],
    }

    render(<AgentPreview data={testData} />)

    // Click download button
    const downloadButton = screen.getByTestId('agent-preview-download-button')
    fireEvent.click(downloadButton)

    // Verify file creation and download
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text/markdown'
      })
    )

    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(mockLink.download).toBe('download-test-agent.md')
    expect(mockLink.click).toHaveBeenCalled()
    expect(document.body.appendChild).toHaveBeenCalledWith(mockLink)
    expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('validates markdown format matches core saveAgent function', () => {
    const testData: AgentFormData = {
      name: 'format-test',
      description: 'Test agent for validating format compatibility',
      prompt: 'You are a test agent with multiline instructions.\n\nYou should:\n1. Follow instructions\n2. Be helpful',
      model: 'sonnet',
      tools: ['Read', 'Write', 'Edit'],
      skills: ['typescript', 'testing'],
    }

    render(<AgentPreview data={testData} />)

    const content = screen.getByTestId('agent-preview-content')
    const textContent = content.textContent || ''

    // Verify YAML frontmatter structure
    const lines = textContent.split('\n')
    expect(lines[0]).toBe('---')

    // Find the closing frontmatter delimiter
    const closingDelimiterIndex = lines.findIndex((line, index) =>
      index > 0 && line === '---'
    )
    expect(closingDelimiterIndex).toBeGreaterThan(0)

    // Verify YAML content between delimiters
    const yamlLines = lines.slice(1, closingDelimiterIndex)
    expect(yamlLines.some(line => line.includes('name: "format-test"'))).toBe(true)
    expect(yamlLines.some(line => line.includes('description: Test agent for validating format compatibility'))).toBe(true)
    expect(yamlLines.some(line => line.includes('tools: Read,Write,Edit'))).toBe(true)
    expect(yamlLines.some(line => line.includes('model: sonnet'))).toBe(true)
    expect(yamlLines.some(line => line.includes('skills: typescript,testing'))).toBe(true)

    // Verify prompt content after frontmatter
    const promptStart = closingDelimiterIndex + 2 // Skip closing delimiter and empty line
    const promptLines = lines.slice(promptStart)
    expect(promptLines.join('\n')).toContain('You are a test agent with multiline instructions.')
    expect(promptLines.join('\n')).toContain('1. Follow instructions')
    expect(promptLines.join('\n')).toContain('2. Be helpful')
  })

  it('handles edge cases and error conditions', async () => {
    // Test with minimal valid data
    const minimalData: AgentFormData = {
      name: 'minimal',
      description: 'Minimal agent',
      prompt: 'Simple prompt',
      model: 'sonnet',
      tools: [],
      skills: [],
    }

    render(<AgentPreview data={minimalData} />)

    const content = screen.getByTestId('agent-preview-content')
    const textContent = content.textContent || ''

    // Should not include empty arrays
    expect(textContent).not.toContain('tools:')
    expect(textContent).not.toContain('skills:')

    // Test clipboard error handling
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    navigator.clipboard.writeText = vi.fn(() => Promise.reject(new Error('Access denied')))

    const copyButton = screen.getByTestId('agent-preview-copy-button')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to copy to clipboard:',
        expect.any(Error)
      )
    })

    consoleErrorSpy.mockRestore()
  })
})