/**
 * AgentPreview Component Tests
 *
 * Tests for the main AgentPreview component functionality.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AgentPreview } from '../AgentPreview'
import type { AgentFormData } from '@/lib/schemas/agent-schema'

// Mock link object for download testing - track calls
const mockLinkClick = vi.fn()
let mockLinkDownload = ''
let mockLinkHref = ''

// Mock only specific browser APIs without breaking DOM
beforeEach(() => {
  // Reset mocks
  mockLinkClick.mockClear()
  mockLinkDownload = ''
  mockLinkHref = ''

  // Mock clipboard API
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  })

  // Mock URL API
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  // Spy on createElement to intercept anchor creation for downloads
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const element = originalCreateElement(tagName)
    if (tagName === 'a') {
      // Track anchor element properties for download testing
      Object.defineProperty(element, 'download', {
        get: () => mockLinkDownload,
        set: (val) => { mockLinkDownload = val },
      })
      Object.defineProperty(element, 'href', {
        get: () => mockLinkHref,
        set: (val) => { mockLinkHref = val },
      })
      element.click = mockLinkClick
    }
    return element
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const validAgentData: AgentFormData = {
  name: 'test-agent',
  description: 'A test agent for unit testing',
  prompt: 'You are a helpful test assistant that follows instructions carefully.',
  model: 'sonnet',
  tools: ['Read', 'Write', 'Edit'],
  skills: ['typescript', 'react', 'testing'],
}

const incompleteAgentData: Partial<AgentFormData> = {
  name: 'incomplete',
  description: '',
  prompt: '',
}

describe('AgentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('renders preview with valid agent data', () => {
      render(<AgentPreview data={validAgentData} />)

      expect(screen.getByTestId('agent-preview')).toBeInTheDocument()
      expect(screen.getByText('test-agent.md')).toBeInTheDocument()
      expect(screen.getByTestId('agent-preview-content')).toBeInTheDocument()
    })

    it('renders loading state when loading prop is true', () => {
      render(<AgentPreview data={validAgentData} loading />)

      expect(screen.queryByTestId('agent-preview')).not.toBeInTheDocument()
      // Spinner is rendered inside a container with specific classes
      const container = document.querySelector('.animate-spin')
      expect(container).toBeInTheDocument()
    })

    it('renders loading state when data is incomplete', () => {
      render(<AgentPreview data={incompleteAgentData as AgentFormData} />)

      expect(screen.queryByTestId('agent-preview')).not.toBeInTheDocument()
      // Spinner is rendered inside a container with specific classes
      const container = document.querySelector('.animate-spin')
      expect(container).toBeInTheDocument()
    })

    it('shows file name with .md extension', () => {
      render(<AgentPreview data={validAgentData} />)

      expect(screen.getByText('test-agent.md')).toBeInTheDocument()
    })

    it('hides file name when showFileName is false', () => {
      render(<AgentPreview data={validAgentData} showFileName={false} />)

      expect(screen.queryByText('test-agent.md')).not.toBeInTheDocument()
    })

    it('shows validation status when enabled', () => {
      render(<AgentPreview data={validAgentData} isValid={true} showValidationStatus />)

      expect(screen.getByLabelText('Valid agent definition')).toBeInTheDocument()
    })

    it('shows invalid status when data is invalid', () => {
      render(<AgentPreview data={validAgentData} isValid={false} showValidationStatus />)

      expect(screen.getByLabelText('Incomplete agent definition')).toBeInTheDocument()
    })
  })

  describe('Content Generation', () => {
    it('generates correct YAML frontmatter format', () => {
      render(<AgentPreview data={validAgentData} />)

      const content = screen.getByTestId('agent-preview-content')
      const textContent = content.textContent || ''

      expect(textContent).toContain('name: "test-agent"')
      expect(textContent).toContain('description: A test agent for unit testing')
      expect(textContent).toContain('model: sonnet')
    })

    it('includes tools as comma-separated string', () => {
      render(<AgentPreview data={validAgentData} />)

      const content = screen.getByTestId('agent-preview-content')
      const textContent = content.textContent || ''

      expect(textContent).toContain('tools: Read,Write,Edit')
    })

    it('includes skills as comma-separated string', () => {
      render(<AgentPreview data={validAgentData} />)

      const content = screen.getByTestId('agent-preview-content')
      const textContent = content.textContent || ''

      expect(textContent).toContain('skills: typescript,react,testing')
    })

    it('includes prompt as markdown body', () => {
      render(<AgentPreview data={validAgentData} />)

      const content = screen.getByTestId('agent-preview-content')
      const textContent = content.textContent || ''

      expect(textContent).toContain('You are a helpful test assistant')
    })

    it('updates live when form data changes', () => {
      const { rerender } = render(<AgentPreview data={validAgentData} />)

      let content = screen.getByTestId('agent-preview-content')
      expect(content.textContent).toContain('test-agent')

      const updatedData = {
        ...validAgentData,
        name: 'updated-agent',
      }

      rerender(<AgentPreview data={updatedData} />)

      content = screen.getByTestId('agent-preview-content')
      expect(content.textContent).toContain('updated-agent')
    })
  })

  describe('Copy Functionality', () => {
    it('copies entire markdown content to clipboard', async () => {
      render(<AgentPreview data={validAgentData} />)

      const copyButton = screen.getByTestId('agent-preview-copy-button')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('name: "test-agent"')
        )
      })
    })

    it('shows success feedback after copy', async () => {
      render(<AgentPreview data={validAgentData} />)

      const copyButton = screen.getByTestId('agent-preview-copy-button')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Copied!')).toBeInTheDocument()
      })
    })

    it('calls onCopy callback', async () => {
      const onCopyMock = vi.fn()
      render(<AgentPreview data={validAgentData} onCopy={onCopyMock} />)

      const copyButton = screen.getByTestId('agent-preview-copy-button')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(onCopyMock).toHaveBeenCalledWith(
          expect.stringContaining('name: "test-agent"')
        )
      })
    })

    it('hides copy button when showCopyButton is false', () => {
      render(<AgentPreview data={validAgentData} showCopyButton={false} />)

      expect(screen.queryByTestId('agent-preview-copy-button')).not.toBeInTheDocument()
    })
  })

  describe('Download Functionality', () => {
    it('downloads file with correct name', () => {
      render(<AgentPreview data={validAgentData} />)

      const downloadButton = screen.getByTestId('agent-preview-download-button')
      fireEvent.click(downloadButton)

      expect(mockLinkDownload).toBe('test-agent.md')
      expect(mockLinkClick).toHaveBeenCalled()
    })

    it('downloads file with correct content', () => {
      render(<AgentPreview data={validAgentData} />)

      const downloadButton = screen.getByTestId('agent-preview-download-button')
      fireEvent.click(downloadButton)

      expect(URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text/markdown'
        })
      )
    })

    it('uses .md extension', () => {
      const dataWithSpaces = {
        ...validAgentData,
        name: 'My Test Agent'
      }

      render(<AgentPreview data={dataWithSpaces} />)

      const downloadButton = screen.getByTestId('agent-preview-download-button')
      fireEvent.click(downloadButton)

      expect(mockLinkDownload).toBe('my-test-agent.md')
    })

    it('hides download button when showDownloadButton is false', () => {
      render(<AgentPreview data={validAgentData} showDownloadButton={false} />)

      expect(screen.queryByTestId('agent-preview-download-button')).not.toBeInTheDocument()
    })
  })

  describe('Props and Configuration', () => {
    it('applies custom className', () => {
      render(<AgentPreview data={validAgentData} className="custom-class" />)

      const preview = screen.getByTestId('agent-preview')
      expect(preview).toHaveClass('custom-class')
    })

    it('applies maxHeight style', () => {
      render(<AgentPreview data={validAgentData} maxHeight={300} />)

      const content = screen.getByTestId('agent-preview-content').parentElement
      expect(content).toHaveStyle({ maxHeight: '300px' })
    })

    it('applies maxHeight as string', () => {
      render(<AgentPreview data={validAgentData} maxHeight="50vh" />)

      const content = screen.getByTestId('agent-preview-content').parentElement
      expect(content).toHaveStyle({ maxHeight: '50vh' })
    })
  })

  describe('Error Handling', () => {
    it('handles clipboard write failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock clipboard to reject
      navigator.clipboard.writeText = vi.fn(() => Promise.reject(new Error('Clipboard access denied')))

      render(<AgentPreview data={validAgentData} />)

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
})