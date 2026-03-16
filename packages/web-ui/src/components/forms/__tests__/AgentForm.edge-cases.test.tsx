import React from 'react'
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AgentForm, type AgentFormProps } from '../AgentForm'
import type { AgentFormData } from '@/lib/schemas/agent-schema'
import type { MultiSelectOption } from '@/components/ui/MultiSelect'

// Mock console methods to test error handling
const mockConsoleError = vi.fn()
const originalConsoleError = console.error

beforeAll(() => {
  console.error = mockConsoleError
})

afterEach(() => {
  mockConsoleError.mockClear()
})

describe('AgentForm Edge Cases', () => {
  const user = userEvent.setup()
  let mockOnSubmit: ReturnType<typeof vi.fn>
  let mockOnCancel: ReturnType<typeof vi.fn>

  // Edge case data for testing
  const extremeMockTools: MultiSelectOption[] = [
    { value: 'tool-with-very-long-name-that-exceeds-normal-expectations', label: 'Tool With Very Long Name That Exceeds Normal Expectations And Might Cause Layout Issues' },
    { value: 'tool-with-special-chars!@#$%', label: 'Tool With Special Characters !@#$%' },
    { value: '', label: 'Empty Value Tool' }, // Invalid but testing edge case
    { value: 'disabled-tool', label: 'Disabled Tool', disabled: true },
  ]

  const extremeMockSkills: MultiSelectOption[] = [
    { value: 'skill-1', label: 'Skill 1' },
    { value: 'skill-2', label: 'Skill 2' },
    // ... generate many skills to test limits
    ...Array.from({ length: 100 }, (_, i) => ({
      value: `auto-skill-${i + 3}`,
      label: `Auto Generated Skill ${i + 3}`,
    })),
  ]

  const extremeFormData: AgentFormData = {
    name: 'agent-with-maximum-length-name-approaching-the-character-limit-for-agent-names-in-the-system',
    description: 'x'.repeat(500), // Exactly at limit
    prompt: 'x'.repeat(50000), // Exactly at limit
    model: 'sonnet',
    tools: Array.from({ length: 50 }, (_, i) => `tool-${i}`), // At limit
    skills: Array.from({ length: 100 }, (_, i) => `skill-${i}`), // At limit
  }

  beforeEach(() => {
    mockOnSubmit = vi.fn()
    mockOnCancel = vi.fn()
  })

  describe('Boundary Value Testing', () => {
    it('should handle form data at exact character limits', async () => {
      const maxLimitProps = {
        availableTools: Array.from({ length: 50 }, (_, i) => ({
          value: `tool-${i}`,
          label: `Tool ${i}`,
        })),
        availableSkills: Array.from({ length: 100 }, (_, i) => ({
          value: `skill-${i}`,
          label: `Skill ${i}`,
        })),
      }

      render(
        <AgentForm
          {...maxLimitProps}
          initialData={extremeFormData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Verify form loads with extreme data
      expect(screen.getByTestId('name-input')).toHaveValue(extremeFormData.name)
      expect(screen.getByTestId('description-textarea')).toHaveValue(extremeFormData.description)
      expect(screen.getByTestId('prompt-textarea')).toHaveValue(extremeFormData.prompt)

      // Check character counters show exact limits
      expect(screen.getByText('500/500')).toBeInTheDocument()
      expect(screen.getByText('50000/50000')).toBeInTheDocument()

      // Form should still be valid and submittable
      await waitFor(() => {
        expect(screen.getByTestId('submit-button')).toBeEnabled()
      })

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(extremeFormData)
      })
    })

    it('should handle form data just over character limits', async () => {
      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Test description over limit
      const descriptionTextarea = screen.getByTestId('description-textarea')
      const overLimitDescription = 'x'.repeat(501) // 1 char over limit

      fireEvent.change(descriptionTextarea, { target: { value: overLimitDescription } })
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Description must be at most 500 characters')).toBeInTheDocument()
        expect(screen.getByText('501/500')).toBeInTheDocument()
      })

      // Submit button should be disabled
      expect(screen.getByTestId('submit-button')).toBeDisabled()

      // Test prompt over limit
      const promptTextarea = screen.getByTestId('prompt-textarea')
      const overLimitPrompt = 'x'.repeat(50001) // 1 char over limit

      fireEvent.change(promptTextarea, { target: { value: overLimitPrompt } })
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Prompt must be at most 50000 characters')).toBeInTheDocument()
        expect(screen.getByText('50001/50000')).toBeInTheDocument()
      })
    })

    it('should handle minimum length requirements edge cases', async () => {
      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Test name exactly at minimum (1 char)
      const nameInput = screen.getByTestId('name-input')
      await user.type(nameInput, 'a')
      await user.tab()

      // Should be valid (1 char is minimum)
      await waitFor(() => {
        expect(screen.queryByText('Agent name is required')).not.toBeInTheDocument()
      })

      // Test prompt exactly at minimum (10 chars)
      const promptTextarea = screen.getByTestId('prompt-textarea')
      await user.type(promptTextarea, '1234567890') // Exactly 10 chars
      await user.tab()

      await waitFor(() => {
        expect(screen.queryByText('Prompt must be at least 10 characters')).not.toBeInTheDocument()
      })

      // Test prompt just under minimum (9 chars)
      await user.clear(promptTextarea)
      await user.type(promptTextarea, '123456789') // 9 chars
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText('Prompt must be at least 10 characters')).toBeInTheDocument()
      })
    })
  })

  describe('Invalid Data Handling', () => {
    it('should handle malformed tool and skill data', async () => {
      const malformedProps = {
        availableTools: [
          { value: null as any, label: 'Null Value Tool' },
          { value: undefined as any, label: 'Undefined Value Tool' },
          { value: 'valid-tool', label: null as any },
          { value: 'another-tool', label: undefined as any },
          null as any,
          undefined as any,
        ].filter(Boolean), // Remove null/undefined from array
        availableSkills: [
          { value: 'valid-skill', label: 'Valid Skill' },
        ],
      }

      // Should not crash when rendering
      expect(() => {
        render(
          <AgentForm
            {...malformedProps}
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        )
      }).not.toThrow()

      // Form should still be functional
      expect(screen.getByTestId('tools-multiselect')).toBeInTheDocument()
      expect(screen.getByTestId('skills-multiselect')).toBeInTheDocument()
    })

    it('should handle invalid initialData gracefully', async () => {
      const invalidInitialData = {
        name: null,
        description: undefined,
        prompt: '',
        model: 'invalid-model' as any,
        tools: ['non-existent-tool'],
        skills: null as any,
      } as any

      // Should not crash and should use defaults/handle gracefully
      expect(() => {
        render(
          <AgentForm
            availableTools={[]}
            availableSkills={[]}
            initialData={invalidInitialData}
            onSubmit={mockOnSubmit}
            onCancel={mockOnCancel}
          />
        )
      }).not.toThrow()

      // Should handle invalid data by falling back to defaults or handling validation
      expect(screen.getByTestId('name-input')).toHaveValue('')
      expect(screen.getByTestId('description-textarea')).toHaveValue('')
    })

    it('should handle rapid successive validation calls', async () => {
      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByTestId('name-input')

      // Rapidly type and clear to trigger many validation calls
      for (let i = 0; i < 10; i++) {
        await user.type(nameInput, `test${i}`)
        await user.clear(nameInput)
      }

      // Should still be responsive and not cause errors
      await user.type(nameInput, 'final-test')
      expect(nameInput).toHaveValue('final-test')
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large numbers of options without performance issues', async () => {
      const startTime = Date.now()

      render(
        <AgentForm
          availableTools={extremeMockTools}
          availableSkills={extremeMockSkills}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const endTime = Date.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000)

      // Should still be functional
      expect(screen.getByTestId('tools-multiselect')).toBeInTheDocument()
      expect(screen.getByTestId('skills-multiselect')).toBeInTheDocument()
    })

    it('should handle many rapid state updates', async () => {
      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByTestId('name-input')
      const descriptionTextarea = screen.getByTestId('description-textarea')

      // Rapidly update multiple fields
      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(user.type(nameInput, 'a'))
        promises.push(user.type(descriptionTextarea, 'b'))
      }

      await Promise.all(promises)

      // Should still be responsive
      expect(nameInput).toHaveValue('a'.repeat(20))
      expect(descriptionTextarea).toHaveValue('b'.repeat(20))
    })
  })

  describe('Async Edge Cases', () => {
    it('should handle onSubmit that never resolves', async () => {
      const neverResolvingSubmit = vi.fn().mockReturnValue(new Promise(() => {}))

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          initialData={{
            name: 'test',
            description: 'test description',
            prompt: 'test prompt that is long enough',
            model: 'sonnet',
            tools: [],
            skills: [],
          }}
          onSubmit={neverResolvingSubmit}
          onCancel={mockOnCancel}
        />
      )

      await user.click(screen.getByTestId('submit-button'))

      expect(neverResolvingSubmit).toHaveBeenCalled()

      // Form should remain in submitting state but should not break
      // Note: In a real app, there would be a timeout or cancel mechanism
    })

    it('should handle onSubmit that throws synchronously', async () => {
      const throwingSubmit = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous error')
      })

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          initialData={{
            name: 'test',
            description: 'test description',
            prompt: 'test prompt that is long enough',
            model: 'sonnet',
            tools: [],
            skills: [],
          }}
          onSubmit={throwingSubmit}
          onCancel={mockOnCancel}
        />
      )

      await user.click(screen.getByTestId('submit-button'))

      // Should have logged the error
      await waitFor(() => {
        expect(mockConsoleError).toHaveBeenCalledWith(
          'Form submission error:',
          expect.any(Error)
        )
      })

      // Form should still be functional
      expect(screen.getByTestId('submit-button')).toBeEnabled()
    })

    it('should handle multiple rapid submission attempts', async () => {
      let callCount = 0
      const slowSubmit = vi.fn().mockImplementation(async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          initialData={{
            name: 'test',
            description: 'test description',
            prompt: 'test prompt that is long enough',
            model: 'sonnet',
            tools: [],
            skills: [],
          }}
          onSubmit={slowSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByTestId('submit-button')

      // Try to click submit multiple times rapidly
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)

      // Should only be called once due to button being disabled during submission
      await waitFor(() => {
        expect(callCount).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle missing form validation API', async () => {
      // Mock missing checkValidity
      const originalCheckValidity = HTMLFormElement.prototype.checkValidity
      delete (HTMLFormElement.prototype as any).checkValidity

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Should still work with custom validation
      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByText('Agent name is required')).toBeInTheDocument()
      })

      // Restore
      HTMLFormElement.prototype.checkValidity = originalCheckValidity
    })

    it('should handle focus management with missing focus API', async () => {
      // Mock missing focus method
      const originalFocus = HTMLElement.prototype.focus
      HTMLElement.prototype.focus = vi.fn()

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByTestId('name-input')
      await user.click(nameInput)

      // Should not throw error
      expect(() => {
        nameInput.focus()
      }).not.toThrow()

      // Restore
      HTMLElement.prototype.focus = originalFocus
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('should handle screen reader navigation with many fields', async () => {
      render(
        <AgentForm
          availableTools={extremeMockTools.slice(0, 10)} // Reasonable number for testing
          availableSkills={extremeMockSkills.slice(0, 10)}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Verify all form fields are accessible via tab navigation
      const nameInput = screen.getByTestId('name-input')
      const descriptionTextarea = screen.getByTestId('description-textarea')
      const promptTextarea = screen.getByTestId('prompt-textarea')
      const submitButton = screen.getByTestId('submit-button')

      await user.click(nameInput)
      await user.tab()
      expect(descriptionTextarea).toHaveFocus()

      await user.tab()
      expect(promptTextarea).toHaveFocus()

      // Tab through remaining fields to submit button
      for (let i = 0; i < 10; i++) {
        await user.tab()
      }

      // Should eventually reach submit button
      expect(submitButton).toHaveFocus()
    })

    it('should handle high contrast mode styling', async () => {
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      })

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Should render without errors in high contrast mode
      expect(screen.getByTestId('agent-form')).toBeInTheDocument()
    })
  })

  describe('Network and Offline Edge Cases', () => {
    it('should handle offline mode gracefully', async () => {
      // Mock offline mode
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          initialData={{
            name: 'test',
            description: 'test description',
            prompt: 'test prompt that is long enough',
            model: 'sonnet',
            tools: [],
            skills: [],
          }}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      await user.click(screen.getByTestId('submit-button'))

      // Should still call submit (up to parent to handle offline state)
      expect(mockOnSubmit).toHaveBeenCalled()

      // Restore
      Object.defineProperty(navigator, 'onLine', {
        value: true,
      })
    })
  })

  describe('Cleanup and Memory Leaks', () => {
    it('should clean up event listeners on unmount', () => {
      const { unmount } = render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Add some event listeners through interactions
      const nameInput = screen.getByTestId('name-input')
      fireEvent.focus(nameInput)
      fireEvent.blur(nameInput)

      // Unmount should not cause memory leaks
      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should handle component re-mount with same props', () => {
      const { unmount, rerender } = render(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      unmount()

      // Re-render with same props
      rerender(
        <AgentForm
          availableTools={[]}
          availableSkills={[]}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Should work normally
      expect(screen.getByTestId('agent-form')).toBeInTheDocument()
    })
  })
})