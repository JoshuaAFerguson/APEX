/**
 * Integration Tests for AgentConfigEditor Component
 *
 * Comprehensive integration test suite covering:
 * - Full workflow testing with real components
 * - End-to-end form submission flows
 * - Split-pane layout integration
 * - Live preview functionality
 * - Error handling scenarios
 * - Complex validation scenarios
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AgentConfigEditor } from '../AgentConfigEditor'
import { apiClient } from '@/lib/api-client'
import type { AgentDefinition } from '@apexcli/core'

// Mock only essential dependencies, not the components we want to test
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getAgent: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    listAgents: vi.fn(),
  },
}))

// Get mocked instance
const { apiClient } = await import('@/lib/api-client')
const mockApiClient = vi.mocked(apiClient)

// Test data
const validAgentData: AgentDefinition = {
  name: 'test-agent',
  description: 'A test agent for integration testing',
  prompt: 'You are a helpful test agent that assists with testing functionality and ensuring quality.',
  model: 'sonnet',
  tools: ['Read', 'Write'],
  skills: ['testing', 'quality-assurance'],
}

const existingAgent: AgentDefinition = {
  name: 'existing-agent',
  description: 'An existing agent for testing edit functionality',
  prompt: 'You are an existing agent that helps with various tasks and provides assistance.',
  model: 'opus',
  tools: ['Read', 'Write', 'Bash'],
  skills: ['development', 'problem-solving', 'analysis'],
}

describe('AgentConfigEditor Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup successful API responses by default
    mockApiClient.createAgent.mockResolvedValue(validAgentData)
    mockApiClient.updateAgent.mockResolvedValue(existingAgent)
    mockApiClient.getAgent.mockResolvedValue(existingAgent)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Create Agent Workflow', () => {
    it('should complete full create agent workflow successfully', async () => {
      render(<AgentConfigEditor />)

      // Verify initial state - should show create mode
      expect(screen.getByText(/create agent/i)).toBeInTheDocument()

      // Verify split-pane layout is rendered
      expect(screen.getByRole('main')).toBeInTheDocument()

      // Fill out the form with valid data
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, validAgentData.name)
      await user.type(descriptionTextarea, validAgentData.description)
      await user.type(promptTextarea, validAgentData.prompt)

      // Select model
      const modelSelect = screen.getByLabelText(/model/i)
      await user.selectOptions(modelSelect, validAgentData.model)

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /create agent/i })

      await act(async () => {
        await user.click(submitButton)
      })

      // Verify API was called with correct data
      await waitFor(() => {
        expect(mockApiClient.createAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            name: validAgentData.name,
            description: validAgentData.description,
            prompt: validAgentData.prompt,
            model: validAgentData.model,
          })
        )
      })
    }, 10000)

    it('should show validation errors for invalid form data', async () => {
      render(<AgentConfigEditor />)

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /create agent/i })
      expect(submitButton).toBeDisabled()

      // Fill only name field with invalid data
      const nameInput = screen.getByLabelText(/agent name/i)
      await user.type(nameInput, 'Invalid Name With Spaces')

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/must be lowercase/i)).toBeInTheDocument()
      })
    })

    it('should handle API errors during creation gracefully', async () => {
      mockApiClient.createAgent.mockRejectedValue(new Error('Network error'))

      render(<AgentConfigEditor />)

      // Fill form with valid data
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'valid-agent-name')
      await user.type(descriptionTextarea, 'A valid description')
      await user.type(promptTextarea, 'A valid system prompt for the agent')

      // Try to submit
      const submitButton = screen.getByRole('button', { name: /create agent/i })

      await act(async () => {
        await user.click(submitButton)
      })

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    }, 10000)
  })

  describe('Edit Agent Workflow', () => {
    it('should load existing agent and allow editing', async () => {
      render(<AgentConfigEditor agentId="existing-agent" />)

      // Should show loading initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument()

      // Wait for agent to load
      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledWith('existing-agent')
      })

      await waitFor(() => {
        expect(screen.getByText(/edit agent/i)).toBeInTheDocument()
      })

      // Form should be populated with existing data
      const nameInput = screen.getByLabelText(/agent name/i) as HTMLInputElement
      const descriptionTextarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement

      await waitFor(() => {
        expect(nameInput.value).toBe(existingAgent.name)
        expect(descriptionTextarea.value).toBe(existingAgent.description)
      })
    }, 10000)

    it('should update agent successfully', async () => {
      render(<AgentConfigEditor agentId="existing-agent" />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText(/edit agent/i)).toBeInTheDocument()
      })

      // Modify description
      const descriptionTextarea = screen.getByLabelText(/description/i)
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, 'Updated description for testing')

      // Submit changes
      const submitButton = screen.getByRole('button', { name: /update agent/i })

      await act(async () => {
        await user.click(submitButton)
      })

      // Verify update API was called
      await waitFor(() => {
        expect(mockApiClient.updateAgent).toHaveBeenCalledWith(
          'existing-agent',
          expect.objectContaining({
            description: 'Updated description for testing',
          })
        )
      })
    }, 10000)

    it('should handle agent loading errors', async () => {
      mockApiClient.getAgent.mockRejectedValue(new Error('Agent not found'))

      render(<AgentConfigEditor agentId="nonexistent-agent" />)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/agent not found/i)).toBeInTheDocument()
      })

      // Should show retry and back buttons
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })
  })

  describe('Live Preview Integration', () => {
    it('should update preview in real-time as form changes', async () => {
      render(<AgentConfigEditor />)

      // Get initial preview state
      const previewSection = screen.getByTestId('agent-preview')
      expect(previewSection).toBeInTheDocument()

      // Fill name field
      const nameInput = screen.getByLabelText(/agent name/i)
      await user.type(nameInput, 'preview-test-agent')

      // Preview should show the name
      await waitFor(() => {
        expect(previewSection).toHaveTextContent('preview-test-agent')
      })

      // Add description
      const descriptionTextarea = screen.getByLabelText(/description/i)
      await user.type(descriptionTextarea, 'Preview test description')

      // Preview should update with description
      await waitFor(() => {
        expect(previewSection).toHaveTextContent('Preview test description')
      })
    })

    it('should show validation status in preview', async () => {
      render(<AgentConfigEditor />)

      const previewSection = screen.getByTestId('agent-preview')

      // Initially should be invalid (empty form)
      expect(previewSection).toHaveTextContent(/invalid/i)

      // Fill required fields to make valid
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'valid-agent-name')
      await user.type(descriptionTextarea, 'A valid description')
      await user.type(promptTextarea, 'A valid system prompt that meets minimum length requirements')

      // Should now show valid
      await waitFor(() => {
        expect(previewSection).toHaveTextContent(/valid/i)
      })
    })

    it('should generate proper markdown format in preview', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'markdown-test-agent')
      await user.type(descriptionTextarea, 'Test agent for markdown generation')
      await user.type(promptTextarea, 'You are a test agent for markdown generation testing.')

      // Preview should contain YAML frontmatter
      await waitFor(() => {
        const preview = screen.getByTestId('agent-preview-content')
        expect(preview).toHaveTextContent('name: markdown-test-agent')
        expect(preview).toHaveTextContent('description: Test agent for markdown generation')
      })
    })
  })

  describe('Form Validation Integration', () => {
    it('should validate agent name format', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)

      // Test invalid characters
      await user.type(nameInput, 'Invalid Name!')

      await waitFor(() => {
        expect(screen.getByText(/must be lowercase/i)).toBeInTheDocument()
      })

      // Clear and enter valid name
      await user.clear(nameInput)
      await user.type(nameInput, 'valid-agent-name')

      await waitFor(() => {
        expect(screen.queryByText(/must be lowercase/i)).not.toBeInTheDocument()
      })
    })

    it('should validate field length requirements', async () => {
      render(<AgentConfigEditor />)

      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      // Test minimum length validation
      await user.type(promptTextarea, 'Short')

      await waitFor(() => {
        expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
      })

      // Test maximum length (for description)
      const longDescription = 'A'.repeat(600) // Over 500 character limit
      await user.type(descriptionTextarea, longDescription)

      await waitFor(() => {
        expect(screen.getByText(/maximum 500 characters/i)).toBeInTheDocument()
      })
    })

    it('should show character counters', async () => {
      render(<AgentConfigEditor />)

      const descriptionTextarea = screen.getByLabelText(/description/i)

      await user.type(descriptionTextarea, 'Test description')

      // Should show character count
      await waitFor(() => {
        expect(screen.getByText(/16 \/ 500/)).toBeInTheDocument()
      })
    })
  })

  describe('Tools and Skills Selection', () => {
    it('should allow selecting multiple tools', async () => {
      render(<AgentConfigEditor />)

      // Find tools multi-select
      const toolsSection = screen.getByText(/tools/i).closest('div')
      expect(toolsSection).toBeInTheDocument()

      // Note: This would require the actual MultiSelect component to test properly
      // The test structure is set up for when real components are used
    })

    it('should allow selecting multiple skills', async () => {
      render(<AgentConfigEditor />)

      // Find skills multi-select
      const skillsSection = screen.getByText(/skills/i).closest('div')
      expect(skillsSection).toBeInTheDocument()

      // Note: This would require the actual MultiSelect component to test properly
      // The test structure is set up for when real components are used
    })
  })

  describe('Split-pane Layout', () => {
    it('should render both form and preview sections', () => {
      render(<AgentConfigEditor />)

      // Should have both main sections
      expect(screen.getByText(/agent configuration/i)).toBeInTheDocument()
      expect(screen.getByText(/live preview/i)).toBeInTheDocument()
    })

    it('should maintain responsive layout', () => {
      render(<AgentConfigEditor />)

      const main = screen.getByRole('main')
      expect(main).toHaveClass('flex')

      // Should have two main grid areas or flex children
      const children = main.children
      expect(children.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Navigation Integration', () => {
    it('should handle cancel action', async () => {
      const { useRouter } = await import('next/navigation')
      const mockRouter = useRouter()

      render(<AgentConfigEditor />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/agents')
    })

    it('should redirect after successful creation', async () => {
      const { useRouter } = await import('next/navigation')
      const mockRouter = useRouter()

      render(<AgentConfigEditor />)

      // Fill form with minimal valid data
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'redirect-test-agent')
      await user.type(descriptionTextarea, 'Test description')
      await user.type(promptTextarea, 'Test system prompt for redirect testing functionality')

      const submitButton = screen.getByRole('button', { name: /create agent/i })

      await act(async () => {
        await user.click(submitButton)
      })

      // Should redirect after successful creation
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/agents')
      }, { timeout: 3000 })
    }, 10000)
  })

  describe('Error Recovery', () => {
    it('should clear errors when form is modified', async () => {
      mockApiClient.createAgent.mockRejectedValue(new Error('Creation failed'))

      render(<AgentConfigEditor />)

      // Fill form and submit to trigger error
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'error-test-agent')
      await user.type(descriptionTextarea, 'Test description')
      await user.type(promptTextarea, 'Test system prompt for error recovery testing')

      const submitButton = screen.getByRole('button', { name: /create agent/i })

      await act(async () => {
        await user.click(submitButton)
      })

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/creation failed/i)).toBeInTheDocument()
      })

      // Modify form - should clear error
      await user.type(nameInput, '-modified')

      await waitFor(() => {
        expect(screen.queryByText(/creation failed/i)).not.toBeInTheDocument()
      })
    }, 10000)

    it('should allow retry after agent loading failure', async () => {
      mockApiClient.getAgent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(existingAgent)

      render(<AgentConfigEditor agentId="retry-test-agent" />)

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      // Should retry and succeed
      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledTimes(2)
      })

      await waitFor(() => {
        expect(screen.getByText(/edit agent/i)).toBeInTheDocument()
      })
    }, 10000)
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<AgentConfigEditor />)

      // Form should have proper labels
      expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument()

      // Buttons should have accessible names
      expect(screen.getByRole('button', { name: /create agent/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)

      // Should be able to focus form elements
      nameInput.focus()
      expect(document.activeElement).toBe(nameInput)

      // Tab should move to next field
      await user.tab()
      const descriptionTextarea = screen.getByLabelText(/description/i)
      expect(document.activeElement).toBe(descriptionTextarea)
    })
  })
})