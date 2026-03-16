import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AgentForm, type AgentFormProps } from '../AgentForm'
import type { AgentFormData } from '@/lib/schemas/agent-schema'
import type { MultiSelectOption } from '@/components/ui/MultiSelect'

// Test data
const mockTools: MultiSelectOption[] = [
  { value: 'Read', label: 'Read Files', description: 'Read files from filesystem' },
  { value: 'Write', label: 'Write Files', description: 'Write files to filesystem' },
  { value: 'Bash', label: 'Execute Commands', description: 'Execute bash commands' },
  { value: 'WebSearch', label: 'Search the Web', description: 'Search the web for information' },
  { value: 'Edit', label: 'Edit Files', description: 'Edit existing files' },
]

const mockSkills: MultiSelectOption[] = [
  { value: 'typescript', label: 'TypeScript', description: 'TypeScript development' },
  { value: 'react', label: 'React', description: 'React development' },
  { value: 'nodejs', label: 'Node.js', description: 'Node.js development' },
  { value: 'python', label: 'Python', description: 'Python development' },
  { value: 'testing', label: 'Testing', description: 'Software testing' },
  { value: 'devops', label: 'DevOps', description: 'DevOps and infrastructure' },
]

describe('AgentForm Integration Tests', () => {
  const user = userEvent.setup()
  let mockOnSubmit: ReturnType<typeof vi.fn>
  let mockOnCancel: ReturnType<typeof vi.fn>

  const defaultProps: Omit<AgentFormProps, 'onSubmit' | 'onCancel'> = {
    availableTools: mockTools,
    availableSkills: mockSkills,
  }

  beforeEach(() => {
    mockOnSubmit = vi.fn()
    mockOnCancel = vi.fn()
  })

  describe('Complete Form Workflows', () => {
    it('should handle complete create workflow with all fields', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Fill out the complete form
      await user.type(screen.getByTestId('name-input'), 'developer-agent')
      await user.type(screen.getByTestId('description-textarea'), 'A comprehensive development agent that helps with coding tasks and project management')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a skilled developer assistant who helps users with coding tasks, code reviews, debugging, testing, and project management. You have deep expertise in multiple programming languages and best practices.')

      // Change model selection
      await user.click(screen.getByTestId('model-select'))
      await user.click(screen.getByText('Opus'))

      // Select multiple tools
      await user.click(screen.getByTestId('tools-multiselect'))
      await user.click(screen.getByTestId('tools-multiselect-option-Read'))
      await user.click(screen.getByTestId('tools-multiselect-option-Write'))
      await user.click(screen.getByTestId('tools-multiselect-option-Bash'))
      await user.click(screen.getByTestId('tools-multiselect-option-Edit'))

      // Select multiple skills
      await user.click(screen.getByTestId('skills-multiselect'))
      await user.click(screen.getByTestId('skills-multiselect-option-typescript'))
      await user.click(screen.getByTestId('skills-multiselect-option-react'))
      await user.click(screen.getByTestId('skills-multiselect-option-nodejs'))
      await user.click(screen.getByTestId('skills-multiselect-option-testing'))

      // Submit the form
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'developer-agent',
          description: 'A comprehensive development agent that helps with coding tasks and project management',
          prompt: 'You are a skilled developer assistant who helps users with coding tasks, code reviews, debugging, testing, and project management. You have deep expertise in multiple programming languages and best practices.',
          model: 'opus',
          tools: ['Read', 'Write', 'Bash', 'Edit'],
          skills: ['typescript', 'react', 'nodejs', 'testing'],
        })
      })
    })

    it('should handle complete edit workflow with modifications', async () => {
      const initialData: AgentFormData = {
        name: 'original-agent',
        description: 'Original description',
        prompt: 'Original prompt that is long enough to meet the minimum requirements for validation.',
        model: 'sonnet',
        tools: ['Read'],
        skills: ['typescript'],
      }

      render(
        <AgentForm
          {...defaultProps}
          initialData={initialData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Verify initial values are loaded
      expect(screen.getByTestId('name-input')).toHaveValue('original-agent')
      expect(screen.getByText('Update Agent')).toBeInTheDocument()

      // Modify all fields
      const nameInput = screen.getByTestId('name-input')
      await user.clear(nameInput)
      await user.type(nameInput, 'updated-agent')

      const descTextarea = screen.getByTestId('description-textarea')
      await user.clear(descTextarea)
      await user.type(descTextarea, 'Updated description with new functionality and improvements')

      const promptTextarea = screen.getByTestId('prompt-textarea')
      await user.clear(promptTextarea)
      await user.type(promptTextarea, 'You are an updated assistant with enhanced capabilities and improved functionality for better user assistance.')

      // Change model
      await user.click(screen.getByTestId('model-select'))
      await user.click(screen.getByText('Haiku'))

      // Add more tools
      await user.click(screen.getByTestId('tools-multiselect'))
      await user.click(screen.getByTestId('tools-multiselect-option-Write'))
      await user.click(screen.getByTestId('tools-multiselect-option-WebSearch'))

      // Add more skills
      await user.click(screen.getByTestId('skills-multiselect'))
      await user.click(screen.getByTestId('skills-multiselect-option-react'))
      await user.click(screen.getByTestId('skills-multiselect-option-python'))

      // Submit the form
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'updated-agent',
          description: 'Updated description with new functionality and improvements',
          prompt: 'You are an updated assistant with enhanced capabilities and improved functionality for better user assistance.',
          model: 'haiku',
          tools: ['Read', 'Write', 'WebSearch'],
          skills: ['typescript', 'react', 'python'],
        })
      })
    })

    it('should handle workflow with maximum selections', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Fill required fields
      await user.type(screen.getByTestId('name-input'), 'max-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Agent with maximum selections')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are an agent configured with the maximum number of tools and skills allowed by the system.')

      // Select all available tools (should be limited by MAX_TOOLS validation)
      await user.click(screen.getByTestId('tools-multiselect'))
      for (const tool of mockTools) {
        await user.click(screen.getByTestId(`tools-multiselect-option-${tool.value}`))
      }

      // Select all available skills (should be limited by MAX_SKILLS validation)
      await user.click(screen.getByTestId('skills-multiselect'))
      for (const skill of mockSkills) {
        await user.click(screen.getByTestId(`skills-multiselect-option-${skill.value}`))
      }

      // Submit the form
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'max-agent',
          description: 'Agent with maximum selections',
          prompt: 'You are an agent configured with the maximum number of tools and skills allowed by the system.',
          model: 'sonnet',
          tools: mockTools.map(t => t.value),
          skills: mockSkills.map(s => s.value),
        })
      })
    })
  })

  describe('Real-world Validation Scenarios', () => {
    it('should handle mixed valid and invalid field combinations', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Enter valid name
      await user.type(screen.getByTestId('name-input'), 'valid-agent')

      // Enter invalid description (too long)
      const longDescription = 'This is a very long description that exceeds the maximum length limit for agent descriptions. '.repeat(10)
      await user.type(screen.getByTestId('description-textarea'), longDescription)
      await user.tab()

      // Enter valid prompt
      await user.type(screen.getByTestId('prompt-textarea'), 'This is a valid prompt that meets the minimum length requirements.')

      // Try to submit
      await user.click(screen.getByTestId('submit-button'))

      // Should show validation error for description
      await waitFor(() => {
        expect(screen.getByText('Description must be at most 500 characters')).toBeInTheDocument()
      })

      // Should not call onSubmit
      expect(mockOnSubmit).not.toHaveBeenCalled()

      // Fix the description
      const descTextarea = screen.getByTestId('description-textarea')
      await user.clear(descTextarea)
      await user.type(descTextarea, 'Valid description')

      // Now submit should work
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })
    })

    it('should handle progressive form completion with real-time validation', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Initially submit button should be disabled
      expect(screen.getByTestId('submit-button')).toBeDisabled()

      // Add name - still invalid (missing other required fields)
      await user.type(screen.getByTestId('name-input'), 'progressive-agent')
      expect(screen.getByTestId('submit-button')).toBeDisabled()

      // Add description - still invalid (missing prompt)
      await user.type(screen.getByTestId('description-textarea'), 'Progressive completion test')
      expect(screen.getByTestId('submit-button')).toBeDisabled()

      // Add prompt - should become valid
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a test agent for progressive form completion validation testing.')

      // Wait for form to become valid
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeEnabled()
      })

      // Submit should work
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'progressive-agent',
          description: 'Progressive completion test',
          prompt: 'You are a test agent for progressive form completion validation testing.',
          model: 'sonnet',
          tools: [],
          skills: [],
        })
      })
    })

    it('should handle name format validation edge cases', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = screen.getByTestId('name-input')

      // Test various invalid name formats
      const invalidNames = [
        'UPPERCASE',
        'mixed-Case',
        'with_underscores',
        'with spaces',
        'with.dots',
        'with@symbols',
        '123-starts-with-number',
        'ends-with-',
        '--double-hyphens--',
        '',
      ]

      for (const invalidName of invalidNames) {
        await user.clear(nameInput)
        await user.type(nameInput, invalidName)
        await user.tab()

        // Should show format error (except for empty which shows required error)
        const expectedError = invalidName === ''
          ? 'Agent name is required'
          : 'Name can only contain lowercase letters, numbers, and hyphens'

        await waitFor(() => {
          expect(screen.getByText(expectedError)).toBeInTheDocument()
        })
      }

      // Test valid names
      const validNames = [
        'valid-name',
        'agent-123',
        'a',
        'my-development-agent',
        'test123',
      ]

      for (const validName of validNames) {
        await user.clear(nameInput)
        await user.type(nameInput, validName)
        await user.tab()

        // Should not show any error
        await waitFor(() => {
          expect(screen.queryByText('Name can only contain lowercase letters, numbers, and hyphens')).not.toBeInTheDocument()
          expect(screen.queryByText('Agent name is required')).not.toBeInTheDocument()
        })
      }
    })

    it('should handle prompt length validation correctly', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const promptTextarea = screen.getByTestId('prompt-textarea')

      // Test prompt too short
      await user.type(promptTextarea, 'short')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Prompt must be at least 10 characters')).toBeInTheDocument()
      })

      // Test minimum valid length
      await user.clear(promptTextarea)
      await user.type(promptTextarea, '1234567890') // Exactly 10 characters
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Prompt must be at least 10 characters')).not.toBeInTheDocument()
      })

      // Test longer valid prompt
      await user.clear(promptTextarea)
      await user.type(promptTextarea, 'This is a properly sized prompt for agent validation.')
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Prompt must be at least 10 characters')).not.toBeInTheDocument()
      })
    })
  })

  describe('Character Counter Integration', () => {
    it('should update character counters correctly during typing', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const descTextarea = screen.getByTestId('description-textarea')
      const promptTextarea = screen.getByTestId('prompt-textarea')

      // Test description counter
      await user.type(descTextarea, 'Test description')
      expect(screen.getByText('16/500')).toBeInTheDocument()

      // Test prompt counter
      await user.type(promptTextarea, 'Test prompt for character counting validation')
      expect(screen.getByText('42/50000')).toBeInTheDocument()

      // Test approaching limit styling (90% of max)
      const nearLimitText = 'x'.repeat(450) // 90% of 500
      await user.clear(descTextarea)
      await user.type(descTextarea, nearLimitText)
      expect(screen.getByText('450/500')).toBeInTheDocument()
    })

    it('should show warning colors when approaching limits', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const descTextarea = screen.getByTestId('description-textarea')

      // Test amber warning at 90% (450+ chars)
      const warningText = 'x'.repeat(455)
      await user.type(descTextarea, warningText)

      const counter = screen.getByText('455/500')
      expect(counter).toHaveClass('text-amber-600')

      // Test red warning when over limit
      const overLimitText = 'x'.repeat(505)
      await user.clear(descTextarea)
      await user.type(descTextarea, overLimitText.substring(0, 500)) // textarea will be limited

      // The counter should show the actual typed length
      expect(screen.getByText('500/500')).toBeInTheDocument()
    })
  })

  describe('Form State Persistence', () => {
    it('should maintain form state during re-renders', async () => {
      const { rerender } = render(
        <AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill some fields
      await user.type(screen.getByTestId('name-input'), 'persistent-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Test persistence')

      // Re-render with new props
      rerender(
        <AgentForm
          {...defaultProps}
          isSubmitting={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Values should persist
      expect(screen.getByTestId('name-input')).toHaveValue('persistent-agent')
      expect(screen.getByTestId('description-textarea')).toHaveValue('Test persistence')
    })

    it('should reset state when initialData changes', () => {
      const initialData1: AgentFormData = {
        name: 'agent-1',
        description: 'First agent',
        prompt: 'First prompt with sufficient length for validation.',
        model: 'sonnet',
        tools: ['Read'],
        skills: ['typescript'],
      }

      const initialData2: AgentFormData = {
        name: 'agent-2',
        description: 'Second agent',
        prompt: 'Second prompt with sufficient length for validation.',
        model: 'opus',
        tools: ['Write'],
        skills: ['react'],
      }

      const { rerender } = render(
        <AgentForm
          {...defaultProps}
          initialData={initialData1}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByTestId('name-input')).toHaveValue('agent-1')

      // Change initialData
      rerender(
        <AgentForm
          {...defaultProps}
          initialData={initialData2}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByTestId('name-input')).toHaveValue('agent-2')
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle submission errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const failingSubmit = vi.fn().mockRejectedValue(new Error('Network error'))

      render(
        <AgentForm
          {...defaultProps}
          onSubmit={failingSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Fill valid form
      await user.type(screen.getByTestId('name-input'), 'error-test-agent')
      await user.type(screen.getByTestId('description-textarea'), 'Testing error handling')
      await user.type(screen.getByTestId('prompt-textarea'), 'You are a test agent for error handling scenarios.')

      // Submit should fail gracefully
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Form submission error:', expect.any(Error))
      })

      // Form should still be usable after error
      expect(screen.getByTestId('submit-button')).toBeEnabled()
      expect(screen.getByTestId('name-input')).toHaveValue('error-test-agent')

      consoleSpy.mockRestore()
    })

    it('should allow correction of validation errors', async () => {
      render(<AgentForm {...defaultProps} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Submit empty form to trigger all validation errors
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText('Agent name is required')).toBeInTheDocument()
        expect(screen.getByText('Description is required')).toBeInTheDocument()
        expect(screen.getByText('Prompt is required')).toBeInTheDocument()
      })

      // Correct each error one by one
      await user.type(screen.getByTestId('name-input'), 'corrected-agent')
      await waitFor(() => {
        expect(screen.queryByText('Agent name is required')).not.toBeInTheDocument()
      })

      await user.type(screen.getByTestId('description-textarea'), 'Corrected description')
      await waitFor(() => {
        expect(screen.queryByText('Description is required')).not.toBeInTheDocument()
      })

      await user.type(screen.getByTestId('prompt-textarea'), 'Corrected prompt with adequate length.')
      await waitFor(() => {
        expect(screen.queryByText('Prompt is required')).not.toBeInTheDocument()
      })

      // Form should now be valid and submittable
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeEnabled()
      })

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })
    })
  })
})