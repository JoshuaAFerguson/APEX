/**
 * Comprehensive Tests for AgentConfigEditor Component
 *
 * Complete test suite covering all acceptance criteria:
 * - Form validation (AgentForm)
 * - Preview rendering (AgentPreview)
 * - API integration and error handling
 * - User interactions and workflows
 * - Edge cases and performance
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AgentConfigEditor } from '../AgentConfigEditor'
import type { AgentDefinition } from '@apexcli/core'

// Mock router
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
const mockApiClient = {
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  listAgents: vi.fn(),
}

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
}))

// Test data
const validAgent: AgentDefinition = {
  name: 'test-agent',
  description: 'A comprehensive test agent for all scenarios',
  prompt: 'You are a helpful test assistant that validates form functionality, API integration, and user interactions.',
  model: 'sonnet',
  tools: ['Read', 'Write', 'Bash'],
  skills: ['typescript', 'testing', 'validation'],
}

const existingAgent: AgentDefinition = {
  name: 'existing-agent',
  description: 'An existing agent for edit testing',
  prompt: 'You are an existing agent that tests the edit workflow and update functionality.',
  model: 'opus',
  tools: ['Read', 'Write'],
  skills: ['development', 'testing'],
}

describe('AgentConfigEditor Comprehensive Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouter.push.mockClear()
    mockApiClient.createAgent.mockResolvedValue(validAgent)
    mockApiClient.updateAgent.mockResolvedValue(existingAgent)
    mockApiClient.getAgent.mockResolvedValue(existingAgent)
  })

  describe('Form Validation Tests', () => {
    it('validates agent name format and requirements', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      const submitButton = screen.getByTestId('submit-button')

      // Initially disabled
      expect(submitButton).toBeDisabled()

      // Test invalid formats
      await user.type(nameInput, 'UPPERCASE')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Name can only contain lowercase letters, numbers, and hyphens')).toBeInTheDocument()
      })

      // Test valid format
      await user.clear(nameInput)
      await user.type(nameInput, 'valid-agent-name')
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Name can only contain lowercase letters, numbers, and hyphens')).not.toBeInTheDocument()
      })
    })

    it('validates description length requirements', async () => {
      render(<AgentConfigEditor />)

      const descriptionTextarea = screen.getByTestId('description-textarea')

      // Test empty description
      await user.click(descriptionTextarea)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Description is required')).toBeInTheDocument()
      })

      // Test valid description
      await user.type(descriptionTextarea, 'A valid description for testing')
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Description is required')).not.toBeInTheDocument()
      })
    })

    it('validates prompt length and requirements', async () => {
      render(<AgentConfigEditor />)

      const promptTextarea = screen.getByTestId('prompt-textarea')

      // Test too short
      await user.type(promptTextarea, 'Short')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Prompt must be at least 10 characters')).toBeInTheDocument()
      })

      // Test valid length
      await user.clear(promptTextarea)
      await user.type(promptTextarea, 'This is a valid prompt with sufficient length for testing validation requirements.')
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Prompt must be at least 10 characters')).not.toBeInTheDocument()
      })
    })

    it('handles character counters and limits correctly', async () => {
      render(<AgentConfigEditor />)

      const descriptionTextarea = screen.getByTestId('description-textarea')

      await user.type(descriptionTextarea, 'Test description')

      // Should show character count
      expect(screen.getByText('16/500')).toBeInTheDocument()

      // Test near limit warning
      const nearLimitText = 'x'.repeat(450)
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, nearLimitText)

      const counter = screen.getByText('450/500')
      expect(counter).toHaveClass('text-amber-600')
    })
  })

  describe('Preview Generation Tests', () => {
    it('generates correct YAML frontmatter and markdown content', async () => {
      render(<AgentConfigEditor />)

      // Fill form with data
      await user.type(screen.getByTestId('name-input'), 'preview-agent')
      await user.type(screen.getByTestId('description-textarea'), 'A test agent for preview generation')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a preview test agent that validates markdown generation.')

      // Check preview content
      const previewContent = screen.getByTestId('agent-preview-content')

      await waitFor(() => {
        expect(previewContent).toHaveTextContent('name: "preview-agent"')
        expect(previewContent).toHaveTextContent('description: A test agent for preview generation')
        expect(previewContent).toHaveTextContent('You are a preview test agent')
      })
    })

    it('updates preview in real-time as form changes', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      const previewContent = screen.getByTestId('agent-preview-content')

      await user.type(nameInput, 'real-time-test')

      await waitFor(() => {
        expect(previewContent).toHaveTextContent('real-time-test')
      })

      // Change name and verify preview updates
      await user.clear(nameInput)
      await user.type(nameInput, 'updated-name')

      await waitFor(() => {
        expect(previewContent).toHaveTextContent('updated-name')
        expect(previewContent).not.toHaveTextContent('real-time-test')
      })
    })

    it('handles copy and download functionality', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn()
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      // Mock URL.createObjectURL
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      global.URL.createObjectURL = mockCreateObjectURL

      render(<AgentConfigEditor />)

      // Fill form
      await user.type(screen.getByTestId('name-input'), 'copy-test-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Test copy functionality')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a test agent for copy functionality validation.')

      // Test copy functionality
      const copyButton = screen.getByTestId('agent-preview-copy-button')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining('name: "copy-test-agent"')
        )
      })

      // Test download functionality
      const downloadButton = screen.getByTestId('agent-preview-download-button')
      fireEvent.click(downloadButton)

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  describe('API Integration Tests', () => {
    it('handles successful agent creation with full workflow', async () => {
      const createdAgent = { ...validAgent, id: 'new-agent-id' }
      mockApiClient.createAgent.mockResolvedValue(createdAgent)

      render(<AgentConfigEditor />)

      // Fill complete form
      await user.type(screen.getByTestId('name-input'), validAgent.name)
      await user.type(screen.getByTestId('description-textarea'), validAgent.description)
      await user.type(screen.getByTestId('prompt-textarea'), validAgent.prompt)

      // Select model
      const modelSelect = screen.getByTestId('model-select')
      await user.click(modelSelect)
      await user.click(screen.getByText('Sonnet'))

      // Select tools
      const toolsSelect = screen.getByTestId('tools-multiselect')
      await user.click(toolsSelect)
      for (const tool of validAgent.tools) {
        await user.click(screen.getByTestId(`tools-multiselect-option-${tool}`))
      }

      // Select skills
      const skillsSelect = screen.getByTestId('skills-multiselect')
      await user.click(skillsSelect)
      for (const skill of validAgent.skills) {
        await user.click(screen.getByTestId(`skills-multiselect-option-${skill}`))
      }

      // Wait for form to be valid
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeEnabled()
      })

      // Submit
      await user.click(screen.getByTestId('submit-button'))

      // Verify API call
      await waitFor(() => {
        expect(mockApiClient.createAgent).toHaveBeenCalledWith({
          name: validAgent.name,
          description: validAgent.description,
          prompt: validAgent.prompt,
          model: validAgent.model,
          tools: validAgent.tools,
          skills: validAgent.skills,
        })
      })

      // Verify success feedback
      await waitFor(() => {
        expect(screen.getByText('Agent saved successfully! Redirecting...')).toBeInTheDocument()
      })

      // Verify redirect
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/agents')
      }, { timeout: 2000 })
    })

    it('handles successful agent editing workflow', async () => {
      mockApiClient.getAgent.mockResolvedValue(existingAgent)
      mockApiClient.updateAgent.mockResolvedValue({
        ...existingAgent,
        description: 'Updated description',
      })

      render(<AgentConfigEditor agentId="existing-agent" />)

      // Wait for agent to load
      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledWith('existing-agent')
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      // Verify form populated
      expect(screen.getByTestId('name-input')).toHaveValue('existing-agent')

      // Modify description
      const descriptionTextarea = screen.getByTestId('description-textarea')
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, 'Updated description through comprehensive testing')

      // Submit
      await user.click(screen.getByTestId('submit-button'))

      // Verify update call
      await waitFor(() => {
        expect(mockApiClient.updateAgent).toHaveBeenCalledWith(
          'existing-agent',
          expect.objectContaining({
            description: 'Updated description through comprehensive testing',
          })
        )
      })
    })

    it('handles API errors gracefully with proper feedback', async () => {
      const errorMessage = 'Network connection failed'
      mockApiClient.createAgent.mockRejectedValue(new Error(errorMessage))

      render(<AgentConfigEditor />)

      // Fill minimal valid form
      await user.type(screen.getByTestId('name-input'), 'error-test')
      await user.type(screen.getByTestId('description-textarea'), 'Error test description')
      await user.type(screen.getByTestId('prompt-textarea'), 'This is a test prompt for error handling validation.')

      // Submit
      await user.click(screen.getByTestId('submit-button'))

      // Verify error display
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      // Verify no redirect on error
      expect(mockRouter.push).not.toHaveBeenCalled()

      // Verify form remains editable
      expect(screen.getByTestId('name-input')).toBeEnabled()
    })

    it('handles loading states correctly', async () => {
      // Mock slow agent loading
      mockApiClient.getAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(existingAgent), 100))
      )

      render(<AgentConfigEditor agentId="loading-test" />)

      // Should show loading state
      expect(screen.getByText('Loading agent...')).toBeInTheDocument()

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      expect(screen.queryByText('Loading agent...')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('handles agent not found errors', async () => {
      mockApiClient.getAgent.mockRejectedValue(new Error('Agent not found'))

      render(<AgentConfigEditor agentId="nonexistent" />)

      await waitFor(() => {
        expect(screen.getByText('Agent not found')).toBeInTheDocument()
      })

      // Should show error UI
      expect(screen.getByText('Back to Agents')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('handles validation errors from server', async () => {
      const validationError = new Error('Validation failed: name already exists')
      mockApiClient.createAgent.mockRejectedValue(validationError)

      render(<AgentConfigEditor />)

      // Fill form
      await user.type(screen.getByTestId('name-input'), 'duplicate-name')
      await user.type(screen.getByTestId('description-textarea'), 'Test description')
      await user.type(screen.getByTestId('prompt-textarea'), 'Test prompt for validation error testing.')

      // Submit
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText('Validation failed: name already exists')).toBeInTheDocument()
      })
    })

    it('clears errors when form data changes', async () => {
      const submitError = new Error('Submit failed')
      mockApiClient.createAgent.mockRejectedValue(submitError)

      render(<AgentConfigEditor />)

      // Fill and submit to trigger error
      await user.type(screen.getByTestId('name-input'), 'error-clear-test')
      await user.type(screen.getByTestId('description-textarea'), 'Error test description')
      await user.type(screen.getByTestId('prompt-textarea'), 'Test prompt for error clearing functionality validation.')

      await user.click(screen.getByTestId('submit-button'))

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('Submit failed')).toBeInTheDocument()
      })

      // Modify form - should clear error
      await user.type(screen.getByTestId('name-input'), '-modified')

      await waitFor(() => {
        expect(screen.queryByText('Submit failed')).not.toBeInTheDocument()
      })
    })

    it('handles concurrent submission attempts', async () => {
      // Mock slow API response
      mockApiClient.createAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(validAgent), 500))
      )

      render(<AgentConfigEditor />)

      // Fill form
      await user.type(screen.getByTestId('name-input'), 'concurrent-test')
      await user.type(screen.getByTestId('description-textarea'), 'Concurrent test description')
      await user.type(screen.getByTestId('prompt-textarea'), 'Test prompt for concurrent submission handling validation.')

      const submitButton = screen.getByTestId('submit-button')

      // Submit multiple times rapidly
      await user.click(submitButton)
      await user.click(submitButton) // Should be ignored

      // Should only make one API call
      await waitFor(() => {
        expect(mockApiClient.createAgent).toHaveBeenCalledTimes(1)
      })

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled()
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('User Interaction Tests', () => {
    it('handles navigation flows correctly', async () => {
      render(<AgentConfigEditor />)

      // Test cancel
      await user.click(screen.getByTestId('cancel-button'))
      expect(mockRouter.push).toHaveBeenCalledWith('/agents')

      // Reset
      mockRouter.push.mockClear()

      // Test error page navigation
      mockApiClient.getAgent.mockRejectedValue(new Error('Load failed'))
      render(<AgentConfigEditor agentId="error-nav" />)

      await waitFor(() => {
        expect(screen.getByText('Load failed')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Back to Agents'))
      expect(mockRouter.push).toHaveBeenCalledWith('/agents')
    })

    it('handles retry functionality', async () => {
      mockApiClient.getAgent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(existingAgent)

      render(<AgentConfigEditor agentId="retry-test" />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      // Click retry
      await user.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledTimes(2)
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })
    })

    it('maintains form state during re-renders', async () => {
      const { rerender } = render(<AgentConfigEditor />)

      // Fill some fields
      await user.type(screen.getByTestId('name-input'), 'persistent-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Persistent description')

      // Re-render
      rerender(<AgentConfigEditor />)

      // Values should persist (component manages its own state)
      expect(screen.getByTestId('name-input')).toHaveValue('persistent-agent')
      expect(screen.getByTestId('description-textarea')).toHaveValue('Persistent description')
    })
  })

  describe('Performance and Accessibility', () => {
    it('has proper accessibility attributes', () => {
      render(<AgentConfigEditor />)

      // Form fields should be properly labeled
      expect(screen.getByLabelText('Agent Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText('System Prompt')).toBeInTheDocument()

      // Buttons should have accessible names
      expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      const descriptionTextarea = screen.getByTestId('description-textarea')

      // Focus first field
      nameInput.focus()
      expect(document.activeElement).toBe(nameInput)

      // Tab to next field
      await user.tab()
      expect(document.activeElement).toBe(descriptionTextarea)
    })

    it('handles rapid form updates efficiently', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      const startTime = Date.now()

      // Rapid typing simulation
      for (let i = 0; i < 20; i++) {
        await user.type(nameInput, 'a')
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000)

      // Preview should update correctly
      const preview = screen.getByTestId('agent-preview-content')
      await waitFor(() => {
        expect(preview).toHaveTextContent('a'.repeat(20))
      })
    })
  })
})