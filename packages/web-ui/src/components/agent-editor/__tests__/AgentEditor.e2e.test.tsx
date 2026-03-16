/**
 * End-to-End Tests for Agent Configuration Editor
 *
 * Complete acceptance criteria testing:
 * - Form validation comprehensive coverage
 * - Preview generation and real-time updates
 * - API integration and error handling
 * - User interaction flows
 * - Edge cases and accessibility
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import component after mocks are set up
let AgentConfigEditor: any

// Mock router first
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getAgent: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    listAgents: vi.fn(),
  },
}))

describe('Agent Configuration Editor E2E Tests', () => {
  const user = userEvent.setup()
  let mockApiClient: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Import the component and mocked API client after mocks are set up
    const { AgentConfigEditor: Component } = await import('../AgentConfigEditor')
    const { apiClient } = await import('@/lib/api-client')

    AgentConfigEditor = Component
    mockApiClient = vi.mocked(apiClient)

    mockRouter.push.mockClear()

    // Setup default successful responses
    mockApiClient.createAgent.mockResolvedValue({ id: 'test-agent', name: 'test-agent' })
    mockApiClient.updateAgent.mockResolvedValue({ id: 'existing-agent', name: 'existing-agent' })
    mockApiClient.getAgent.mockResolvedValue({
      name: 'existing-agent',
      description: 'An existing agent',
      prompt: 'You are an existing agent for testing edit functionality.',
      model: 'sonnet',
      tools: ['Read', 'Write'],
      skills: ['testing'],
    })
  })

  describe('Form Validation Acceptance Tests', () => {
    it('validates all required fields and formats correctly', async () => {
      render(<AgentConfigEditor />)

      const submitButton = screen.getByTestId('submit-button')
      expect(submitButton).toBeDisabled()

      // Test agent name validation
      const nameInput = screen.getByTestId('name-input')

      // Invalid format
      await user.type(nameInput, 'Invalid Name!')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Name can only contain lowercase letters, numbers, and hyphens')).toBeInTheDocument()
      })

      // Valid format
      await user.clear(nameInput)
      await user.type(nameInput, 'valid-agent-name')
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Name can only contain lowercase letters, numbers, and hyphens')).not.toBeInTheDocument()
      })

      // Test description validation
      const descriptionTextarea = screen.getByTestId('description-textarea')
      await user.type(descriptionTextarea, 'Valid description for comprehensive testing')

      // Test prompt validation
      const promptTextarea = screen.getByTestId('prompt-textarea')

      // Too short
      await user.type(promptTextarea, 'Short')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Prompt must be at least 10 characters')).toBeInTheDocument()
      })

      // Valid length
      await user.clear(promptTextarea)
      await user.type(promptTextarea, 'You are a comprehensive test agent that validates all functionality and requirements.')

      await waitFor(() => {
        expect(screen.queryByText('Prompt must be at least 10 characters')).not.toBeInTheDocument()
        expect(submitButton).toBeEnabled()
      })
    })

    it('handles character counters and length limits', async () => {
      render(<AgentConfigEditor />)

      const descriptionTextarea = screen.getByTestId('description-textarea')

      // Test character counting
      await user.type(descriptionTextarea, 'Test description')
      expect(screen.getByText('16/500')).toBeInTheDocument()

      // Test warning at 90% capacity
      const nearLimitText = 'x'.repeat(450)
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, nearLimitText)

      const counter = screen.getByText('450/500')
      expect(counter).toHaveClass('text-amber-600')

      // Test prompt counter
      const promptTextarea = screen.getByTestId('prompt-textarea')
      await user.type(promptTextarea, 'Testing character counter functionality')
      expect(screen.getByText('39/50000')).toBeInTheDocument()
    })
  })

  describe('Preview Generation Acceptance Tests', () => {
    it('generates correct markdown with YAML frontmatter', async () => {
      render(<AgentConfigEditor />)

      // Fill form with comprehensive data
      await user.type(screen.getByTestId('name-input'), 'preview-test-agent')
      await user.type(screen.getByTestId('description-textarea'), 'A comprehensive test agent for preview generation')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a helpful test assistant that validates preview generation functionality.')

      // Select model
      const modelSelect = screen.getByTestId('model-select')
      await user.click(modelSelect)
      await user.click(screen.getByText('Opus'))

      // Select tools
      const toolsSelect = screen.getByTestId('tools-multiselect')
      await user.click(toolsSelect)
      await user.click(screen.getByTestId('tools-multiselect-option-Read'))
      await user.click(screen.getByTestId('tools-multiselect-option-Write'))

      // Verify YAML frontmatter in preview
      const previewContent = screen.getByTestId('agent-preview-content')

      await waitFor(() => {
        expect(previewContent).toHaveTextContent('name: "preview-test-agent"')
        expect(previewContent).toHaveTextContent('description: A comprehensive test agent for preview generation')
        expect(previewContent).toHaveTextContent('model: opus')
        expect(previewContent).toHaveTextContent('tools: Read,Write')
      })

      // Verify markdown body
      await waitFor(() => {
        expect(previewContent).toHaveTextContent('You are a helpful test assistant')
      })
    })

    it('updates preview in real-time during form changes', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      const previewContent = screen.getByTestId('agent-preview-content')

      // Real-time name update
      await user.type(nameInput, 'realtime-agent')

      await waitFor(() => {
        expect(previewContent).toHaveTextContent('realtime-agent')
      })

      // Real-time description update
      const descriptionTextarea = screen.getByTestId('description-textarea')
      await user.type(descriptionTextarea, 'Real-time update testing')

      await waitFor(() => {
        expect(previewContent).toHaveTextContent('Real-time update testing')
      })

      // Verify validation status updates
      const validationStatus = screen.getByTestId('validation-status')
      expect(validationStatus).toHaveTextContent('invalid')

      // Complete form to make valid
      await user.type(screen.getByTestId('prompt-textarea'), 'Complete prompt for real-time validation testing functionality.')

      await waitFor(() => {
        expect(validationStatus).toHaveTextContent('valid')
      })
    })

    it('handles copy and download functionality correctly', async () => {
      // Mock clipboard and file download
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText }
      })

      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      const mockRevokeObjectURL = vi.fn()
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      render(<AgentConfigEditor />)

      // Fill form
      await user.type(screen.getByTestId('name-input'), 'copy-download-test')
      await user.type(screen.getByTestId('description-textarea'), 'Test copy and download functionality')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a test agent for copy and download functionality validation.')

      // Test copy functionality
      const copyButton = screen.getByTestId('agent-preview-copy-button')
      await user.click(copyButton)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('name: "copy-download-test"')
        )
      })

      // Test download functionality
      const downloadButton = screen.getByTestId('agent-preview-download-button')
      await user.click(downloadButton)

      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'text/markdown' })
      )
    })
  })

  describe('API Integration Acceptance Tests', () => {
    it('completes full agent creation workflow successfully', async () => {
      const createdAgent = {
        id: 'new-agent-id',
        name: 'integration-test-agent',
        description: 'Integration test agent',
        prompt: 'You are an integration test agent.',
        model: 'sonnet',
        tools: ['Read', 'Write'],
        skills: ['testing'],
      }

      mockApiClient.createAgent.mockResolvedValue(createdAgent)

      render(<AgentConfigEditor />)

      // Fill complete form
      await user.type(screen.getByTestId('name-input'), 'integration-test-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Integration test agent for API workflow')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are an integration test agent that validates the complete API creation workflow.')

      // Select tools
      const toolsSelect = screen.getByTestId('tools-multiselect')
      await user.click(toolsSelect)
      await user.click(screen.getByTestId('tools-multiselect-option-Read'))
      await user.click(screen.getByTestId('tools-multiselect-option-Write'))

      // Select skills
      const skillsSelect = screen.getByTestId('skills-multiselect')
      await user.click(skillsSelect)
      await user.click(screen.getByTestId('skills-multiselect-option-testing'))

      // Submit form
      const submitButton = screen.getByTestId('submit-button')

      await waitFor(() => {
        expect(submitButton).toBeEnabled()
      })

      await user.click(submitButton)

      // Verify API call with correct data
      await waitFor(() => {
        expect(mockApiClient.createAgent).toHaveBeenCalledWith({
          name: 'integration-test-agent',
          description: 'Integration test agent for API workflow',
          prompt: 'You are an integration test agent that validates the complete API creation workflow.',
          model: 'sonnet',
          tools: ['Read', 'Write'],
          skills: ['testing'],
        })
      })

      // Verify success feedback
      await waitFor(() => {
        expect(screen.getByText('Agent saved successfully! Redirecting...')).toBeInTheDocument()
      })

      // Verify navigation
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/agents')
      }, { timeout: 2000 })
    })

    it('handles edit workflow with existing agent loading', async () => {
      const existingAgent = {
        name: 'edit-test-agent',
        description: 'Original description',
        prompt: 'Original prompt for edit testing functionality validation.',
        model: 'opus',
        tools: ['Read', 'Write', 'Bash'],
        skills: ['development', 'testing'],
      }

      mockApiClient.getAgent.mockResolvedValue(existingAgent)
      mockApiClient.updateAgent.mockResolvedValue({
        ...existingAgent,
        description: 'Updated description',
      })

      render(<AgentConfigEditor agentId="edit-test-agent" />)

      // Verify loading state
      expect(screen.getByText('Loading agent...')).toBeInTheDocument()

      // Wait for agent to load
      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledWith('edit-test-agent')
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      // Verify form populated with existing data
      expect(screen.getByTestId('name-input')).toHaveValue('edit-test-agent')
      expect(screen.getByTestId('description-textarea')).toHaveValue('Original description')

      // Make changes
      const descriptionTextarea = screen.getByTestId('description-textarea')
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, 'Updated description for comprehensive testing')

      // Submit changes
      await user.click(screen.getByTestId('submit-button'))

      // Verify update API call
      await waitFor(() => {
        expect(mockApiClient.updateAgent).toHaveBeenCalledWith(
          'edit-test-agent',
          expect.objectContaining({
            description: 'Updated description for comprehensive testing',
          })
        )
      })
    })

    it('handles comprehensive error scenarios gracefully', async () => {
      // Test creation errors
      const createError = new Error('Agent name already exists')
      mockApiClient.createAgent.mockRejectedValue(createError)

      render(<AgentConfigEditor />)

      // Fill valid form
      await user.type(screen.getByTestId('name-input'), 'error-test-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Error testing description')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a test agent for comprehensive error handling validation.')

      // Submit and verify error handling
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText('Agent name already exists')).toBeInTheDocument()
      })

      // Verify no navigation on error
      expect(mockRouter.push).not.toHaveBeenCalled()

      // Verify form remains editable
      expect(screen.getByTestId('name-input')).toBeEnabled()

      // Test error clearing on form change
      await user.type(screen.getByTestId('name-input'), '-modified')

      await waitFor(() => {
        expect(screen.queryByText('Agent name already exists')).not.toBeInTheDocument()
      })
    })

    it('handles loading errors with retry functionality', async () => {
      const loadError = new Error('Network connection failed')
      mockApiClient.getAgent
        .mockRejectedValueOnce(loadError)
        .mockResolvedValueOnce({
          name: 'retry-test-agent',
          description: 'Retry test description',
          prompt: 'Retry test prompt for error recovery validation.',
          model: 'sonnet',
          tools: ['Read'],
          skills: ['testing'],
        })

      render(<AgentConfigEditor agentId="retry-test-agent" />)

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      })

      // Should show retry controls
      expect(screen.getByText('Retry')).toBeInTheDocument()
      expect(screen.getByText('Back to Agents')).toBeInTheDocument()

      // Test retry
      await user.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledTimes(2)
      })

      // Should load successfully on retry
      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })
    })
  })

  describe('User Interaction and Edge Cases', () => {
    it('handles concurrent operations and loading states', async () => {
      // Mock slow API response
      mockApiClient.createAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 'test' }), 500))
      )

      render(<AgentConfigEditor />)

      // Fill form
      await user.type(screen.getByTestId('name-input'), 'concurrent-test')
      await user.type(screen.getByTestId('description-textarea'), 'Concurrent operations test')
      await user.type(screen.getByTestId('prompt-textarea'), 'Testing concurrent API operations and loading states validation.')

      const submitButton = screen.getByTestId('submit-button')

      // Submit multiple times rapidly
      await user.click(submitButton)
      await user.click(submitButton) // Should be ignored

      // Should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      // Should only make one API call
      await waitFor(() => {
        expect(mockApiClient.createAgent).toHaveBeenCalledTimes(1)
      })
    })

    it('maintains accessibility throughout interactions', async () => {
      render(<AgentConfigEditor />)

      // Verify ARIA labels and roles
      expect(screen.getByLabelText('Agent Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText('System Prompt')).toBeInTheDocument()

      // Test keyboard navigation
      const nameInput = screen.getByTestId('name-input')
      const descriptionTextarea = screen.getByTestId('description-textarea')

      nameInput.focus()
      expect(document.activeElement).toBe(nameInput)

      await user.tab()
      expect(document.activeElement).toBe(descriptionTextarea)

      // Test error announcements
      await user.type(nameInput, 'Invalid Name!')
      await user.tab()

      await waitFor(() => {
        const errorElement = screen.getByText('Name can only contain lowercase letters, numbers, and hyphens')
        expect(errorElement).toHaveAttribute('role', 'alert')
      })
    })

    it('handles navigation flows correctly', async () => {
      render(<AgentConfigEditor />)

      // Test cancel navigation
      await user.click(screen.getByTestId('cancel-button'))
      expect(mockRouter.push).toHaveBeenCalledWith('/agents')

      // Reset and test error navigation
      mockRouter.push.mockClear()
      const loadError = new Error('Agent not found')
      mockApiClient.getAgent.mockRejectedValue(loadError)

      render(<AgentConfigEditor agentId="not-found" />)

      await waitFor(() => {
        expect(screen.getByText('Agent not found')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Back to Agents'))
      expect(mockRouter.push).toHaveBeenCalledWith('/agents')
    })

    it('handles form state persistence and recovery', async () => {
      const { rerender } = render(<AgentConfigEditor />)

      // Fill form
      await user.type(screen.getByTestId('name-input'), 'persistence-test')
      await user.type(screen.getByTestId('description-textarea'), 'Persistence test description')

      // Re-render component
      rerender(<AgentConfigEditor />)

      // Form state should persist (component manages its own state)
      expect(screen.getByTestId('name-input')).toHaveValue('persistence-test')
      expect(screen.getByTestId('description-textarea')).toHaveValue('Persistence test description')
    })

    it('validates performance with rapid form updates', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      const startTime = Date.now()

      // Simulate rapid typing
      for (let i = 0; i < 50; i++) {
        await user.type(nameInput, 'a')
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in reasonable time
      expect(duration).toBeLessThan(3000)

      // Preview should update correctly
      const preview = screen.getByTestId('agent-preview-content')
      await waitFor(() => {
        expect(preview).toHaveTextContent('a'.repeat(50))
      })
    })
  })
})