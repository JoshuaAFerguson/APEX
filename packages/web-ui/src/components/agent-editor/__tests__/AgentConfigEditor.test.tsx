/**
 * Tests for AgentConfigEditor Component
 *
 * Comprehensive test suite covering:
 * - Rendering in create and edit modes
 * - Form interactions and live preview
 * - Save/cancel functionality with API integration
 * - Error handling and loading states
 * - Navigation and routing
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AgentConfigEditor } from '../AgentConfigEditor'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import type { AgentDefinition } from '@apexcli/core'

// Get the mocked versions
const mockedApiClient = vi.mocked(apiClient)
const mockedUseRouter = vi.mocked(useRouter)

// Mock dependencies
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

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getAgent: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
  },
}))

// Mock the AgentForm and AgentPreview components for isolated testing
vi.mock('@/components/forms/AgentForm', () => ({
  AgentForm: ({ onChange, onSubmit, onCancel, isSubmitting, initialData }: any) => {
    React.useEffect(() => {
      // Trigger onChange with valid data to enable submit button
      onChange?.({
        name: 'test-agent',
        description: 'Test description',
        prompt: 'Test prompt that is long enough to be valid',
        model: 'sonnet',
        tools: [],
        skills: []
      })
    }, [onChange])

    return (
      <div data-testid="agent-form">
        <input
          data-testid="name-input"
          defaultValue={initialData?.name || ''}
          onChange={(e) => onChange?.({
            name: e.target.value,
            description: 'Test description',
            prompt: 'Test prompt that is long enough to be valid',
            model: 'sonnet',
            tools: [],
            skills: []
          })}
        />
        <button
          data-testid="submit-button"
          onClick={() => onSubmit({ name: 'test-agent', description: 'Test description', prompt: 'Test prompt that is long enough to be valid', model: 'sonnet', tools: [], skills: [] })}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Submit'}
        </button>
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  },
}))

vi.mock('../AgentPreview', () => ({
  AgentPreview: ({ data, isValid }: any) => (
    <div data-testid="agent-preview">
      <div data-testid="preview-content">Agent: {data?.name}</div>
      <div data-testid="validation-status">{isValid ? 'valid' : 'invalid'}</div>
    </div>
  ),
}))


const mockAgent: AgentDefinition = {
  name: 'existing-agent',
  description: 'An existing agent',
  prompt: 'You are an existing agent',
  model: 'sonnet',
  tools: ['web-search'],
  skills: ['problem-solving'],
}

describe('AgentConfigEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockRouter = mockedUseRouter()

  describe('Create Mode', () => {
    it('renders in create mode when no agentId provided', async () => {
      render(<AgentConfigEditor />)

      expect(screen.getByText('Create Agent')).toBeInTheDocument()
      expect(screen.getByText('Agent Configuration')).toBeInTheDocument()
      expect(screen.getByText('Live Preview')).toBeInTheDocument()
      expect(screen.getByTestId('agent-form')).toBeInTheDocument()
      expect(screen.getByTestId('agent-preview')).toBeInTheDocument()
      // Check for the button text in the bottom action bar
      expect(screen.getAllByText('Create Agent')).toHaveLength(2) // Header and bottom button
    })

    it('shows correct form state for create mode', async () => {
      render(<AgentConfigEditor />)

      expect(screen.getByText('Creating agent configuration')).toBeInTheDocument()
      expect(screen.queryByText(/Editing:/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()
    })

    it('handles form submission for creating new agent', async () => {
      const mockCreatedAgent = { ...mockAgent, name: 'new-agent' }
      mockedApiClient.createAgent.mockResolvedValue(mockCreatedAgent)

      render(<AgentConfigEditor />)

      // Find the actual submit button in the bottom action bar
      const submitButton = screen.getByRole('button', { name: 'Create Agent' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockedApiClient.createAgent).toHaveBeenCalledWith({
          name: 'test-agent',
          description: 'Test description',
          prompt: 'Test prompt that is long enough to be valid',
          model: 'sonnet',
          tools: [],
          skills: [],
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Agent saved successfully! Redirecting...')).toBeInTheDocument()
      })

      // Should redirect after success
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/agents')
      }, { timeout: 2000 })
    })

    it('handles create API errors', async () => {
      const errorMessage = 'Failed to create agent'
      mockedApiClient.createAgent.mockRejectedValue(new Error(errorMessage))

      render(<AgentConfigEditor />)

      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      expect(mockRouter.push).not.toHaveBeenCalled()
    })
  })

  describe('Edit Mode', () => {
    it('renders in edit mode when agentId provided', async () => {
      mockedApiClient.getAgent.mockResolvedValue(mockAgent)

      render(<AgentConfigEditor agentId="existing-agent" />)

      // Should show loading initially
      expect(screen.getByText('Loading agent...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      expect(screen.getByText('Editing: existing-agent')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Update Agent' })).toBeInTheDocument()
    })

    it('loads existing agent data', async () => {
      mockedApiClient.getAgent.mockResolvedValue(mockAgent)

      render(<AgentConfigEditor agentId="existing-agent" />)

      await waitFor(() => {
        expect(mockedApiClient.getAgent).toHaveBeenCalledWith('existing-agent')
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })
    })

    it('handles agent loading errors', async () => {
      const errorMessage = 'Agent not found'
      mockedApiClient.getAgent.mockRejectedValue(new Error(errorMessage))

      render(<AgentConfigEditor agentId="nonexistent" />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      expect(screen.getByText('Back to Agents')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('handles form submission for updating agent', async () => {
      mockedApiClient.getAgent.mockResolvedValue(mockAgent)
      mockedApiClient.updateAgent.mockResolvedValue(mockAgent)

      render(<AgentConfigEditor agentId="existing-agent" />)

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      const submitButton = screen.getByRole('button', { name: 'Update Agent' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockedApiClient.updateAgent).toHaveBeenCalledWith('existing-agent', {
          name: 'test-agent',
          description: 'Test description',
          prompt: 'Test prompt that is long enough to be valid',
          model: 'sonnet',
          tools: [],
          skills: [],
        })
      })
    })

    it('handles update API errors', async () => {
      mockedApiClient.getAgent.mockResolvedValue(mockAgent)
      const errorMessage = 'Failed to update agent'
      mockedApiClient.updateAgent.mockRejectedValue(new Error(errorMessage))

      render(<AgentConfigEditor agentId="existing-agent" />)

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })
  })

  describe('Form Interactions', () => {
    it('updates live preview when form changes', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByTestId('name-input')
      await userEvent.type(nameInput, 'my-agent')

      await waitFor(() => {
        expect(screen.getByTestId('preview-content')).toHaveTextContent('Agent: my-agent')
      })
    })

    it('shows form validation errors in preview', async () => {
      render(<AgentConfigEditor />)

      // Initially should be invalid (empty form)
      expect(screen.getByTestId('validation-status')).toHaveTextContent('invalid')
    })

    it('disables submit button when form is invalid', async () => {
      render(<AgentConfigEditor />)

      expect(screen.getByRole('button', { name: 'Create Agent' })).toBeDisabled()
      expect(screen.getByText('Form contains validation errors')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('navigates back to agents list on cancel', async () => {
      render(<AgentConfigEditor />)

      // Find the cancel button in the bottom action bar, not the mock one
      const cancelButton = screen.getAllByText('Cancel')[0] // Get the first Cancel button (from action bar)
      fireEvent.click(cancelButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/agents')
    })

    it('navigates back from error page', async () => {
      const errorMessage = 'Agent not found'
      mockedApiClient.getAgent.mockRejectedValue(new Error(errorMessage))

      render(<AgentConfigEditor agentId="nonexistent" />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: 'Back to Agents' })
      fireEvent.click(backButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/agents')
    })

    it('can retry loading failed agent', async () => {
      mockedApiClient.getAgent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockAgent)

      render(<AgentConfigEditor agentId="existing-agent" />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockedApiClient.getAgent).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Layout and UI', () => {
    it('renders split-pane layout correctly', () => {
      render(<AgentConfigEditor />)

      // Should have two main panels
      const forms = screen.getAllByText('Agent Configuration')
      const previews = screen.getAllByText('Live Preview')

      expect(forms).toHaveLength(1)
      expect(previews).toHaveLength(1)
    })

    it('shows loading state during submission', async () => {
      mockedApiClient.createAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      render(<AgentConfigEditor />)

      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      expect(submitButton).toHaveTextContent('Saving...')
      expect(submitButton).toBeDisabled()
    })

    it('shows success message after save', async () => {
      mockedApiClient.createAgent.mockResolvedValue(mockAgent)

      render(<AgentConfigEditor />)

      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Agent saved successfully! Redirecting...')).toBeInTheDocument()
      })
    })

    it('applies custom className', () => {
      const { container } = render(<AgentConfigEditor className="custom-class" />)
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Edge Cases', () => {
    it('handles API client errors gracefully', async () => {
      mockedApiClient.createAgent.mockRejectedValue(new Error())

      render(<AgentConfigEditor />)

      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to save agent')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('clears previous errors on new form changes', async () => {
      mockedApiClient.createAgent.mockRejectedValue(new Error('Save failed'))

      render(<AgentConfigEditor />)

      // Trigger error
      const submitButton = screen.getByTestId('submit-button')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument()
      })

      // Change form data - should clear error
      const nameInput = screen.getByTestId('name-input')
      await userEvent.type(nameInput, 'new-name')

      await waitFor(() => {
        expect(screen.queryByText('Save failed')).not.toBeInTheDocument()
      })
    })

    it('handles missing agent tools and skills', async () => {
      const agentWithoutToolsSkills = {
        ...mockAgent,
        tools: undefined,
        skills: undefined,
      }
      mockedApiClient.getAgent.mockResolvedValue(agentWithoutToolsSkills)

      render(<AgentConfigEditor agentId="minimal-agent" />)

      await waitFor(() => {
        expect(screen.getByText('Edit Agent')).toBeInTheDocument()
      })

      // Should not crash with undefined tools/skills
      expect(screen.getByTestId('agent-form')).toBeInTheDocument()
    })
  })
})