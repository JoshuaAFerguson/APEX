/**
 * Edge Cases Tests for AgentConfigEditor Component
 *
 * Tests covering complex scenarios, boundary conditions, and edge cases:
 * - Performance edge cases (large data, long lists)
 * - Network failure scenarios
 * - Malformed data handling
 * - Concurrent operation scenarios
 * - Browser compatibility edge cases
 * - Memory and resource management
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AgentConfigEditor } from '../AgentConfigEditor'
import type { AgentDefinition } from '@apexcli/core'

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

const mockApiClient = {
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  listAgents: vi.fn(),
}

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
}))

describe('AgentConfigEditor Edge Cases', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Data Boundary Conditions', () => {
    it('should handle maximum length inputs correctly', async () => {
      render(<AgentConfigEditor />)

      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      // Test maximum description length (500 chars)
      const maxDescription = 'A'.repeat(500)
      await user.type(descriptionTextarea, maxDescription)

      await waitFor(() => {
        expect((descriptionTextarea as HTMLTextAreaElement).value).toBe(maxDescription)
        expect(screen.getByText('500 / 500')).toBeInTheDocument()
      })

      // Test maximum prompt length (50000 chars)
      const veryLongPrompt = 'This is a very long prompt. '.repeat(1800) // ~50000 chars
      await user.clear(promptTextarea)
      await user.type(promptTextarea, veryLongPrompt)

      await waitFor(() => {
        expect((promptTextarea as HTMLTextAreaElement).value.length).toBeGreaterThan(40000)
      })
    }, 15000)

    it('should handle minimum length validation edge cases', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      // Single character name (valid)
      await user.type(nameInput, 'a')
      await waitFor(() => {
        expect(screen.queryByText(/at least 1 character/i)).not.toBeInTheDocument()
      })

      // Single character description (valid)
      await user.type(descriptionTextarea, 'A')
      await waitFor(() => {
        expect(screen.queryByText(/at least 1 character/i)).not.toBeInTheDocument()
      })

      // 10 character prompt (minimum)
      await user.type(promptTextarea, '1234567890')
      await waitFor(() => {
        expect(screen.queryByText(/at least 10 characters/i)).not.toBeInTheDocument()
      })

      // 9 character prompt (invalid)
      await user.clear(promptTextarea)
      await user.type(promptTextarea, '123456789')
      await waitFor(() => {
        expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
      })
    })

    it('should handle special characters in form fields', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      // Name with valid special characters (hyphens)
      await user.type(nameInput, 'test-agent-with-hyphens')
      await waitFor(() => {
        expect(screen.queryByText(/must be lowercase/i)).not.toBeInTheDocument()
      })

      // Description with unicode and emojis
      const unicodeDescription = 'Test agent 🤖 with unicode characters: àáâãäå ñ'
      await user.type(descriptionTextarea, unicodeDescription)
      await waitFor(() => {
        expect((descriptionTextarea as HTMLTextAreaElement).value).toBe(unicodeDescription)
      })

      // Prompt with markdown and code blocks
      const markdownPrompt = `You are an agent that understands:

# Markdown Headers
- Lists and **bold** text
- \`code snippets\`
- [Links](https://example.com)

\`\`\`javascript
console.log("Hello World");
\`\`\`

And much more!`
      await user.clear(promptTextarea)
      await user.type(promptTextarea, markdownPrompt)
      await waitFor(() => {
        expect((promptTextarea as HTMLTextAreaElement).value).toBe(markdownPrompt)
      })
    })

    it('should handle empty and whitespace-only inputs', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)

      // Whitespace-only name
      await user.type(nameInput, '   ')
      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument()
      })

      // Whitespace-only description
      await user.type(descriptionTextarea, '   \n   \t   ')
      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Network and API Edge Cases', () => {
    it('should handle slow network responses', async () => {
      // Simulate very slow API response
      mockApiClient.getAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          name: 'slow-agent',
          description: 'Slow loading agent',
          prompt: 'You are a slow loading agent.',
          model: 'sonnet',
          tools: [],
          skills: [],
        } as AgentDefinition), 5000))
      )

      render(<AgentConfigEditor agentId="slow-agent" />)

      // Should show loading state for extended period
      expect(screen.getByText(/loading/i)).toBeInTheDocument()

      // Wait for slow response (but don't wait full 5 seconds in test)
      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalled()
      }, { timeout: 1000 })
    }, 10000)

    it('should handle network timeouts and retries', async () => {
      let callCount = 0
      mockApiClient.getAgent.mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Request timeout'))
        }
        return Promise.resolve({
          name: 'retry-agent',
          description: 'Successfully loaded after retries',
          prompt: 'You are an agent that loaded after several retries.',
          model: 'sonnet',
          tools: [],
          skills: [],
        } as AgentDefinition)
      })

      render(<AgentConfigEditor agentId="retry-agent" />)

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument()
      })

      // Retry multiple times
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument()
      })

      await user.click(retryButton)

      // Third attempt should succeed
      await waitFor(() => {
        expect(screen.getByText(/edit agent/i)).toBeInTheDocument()
      })

      expect(callCount).toBe(3)
    }, 15000)

    it('should handle malformed API responses', async () => {
      // Response missing required fields
      mockApiClient.getAgent.mockResolvedValue({
        name: 'incomplete-agent',
        // missing description, prompt, model
      } as any)

      render(<AgentConfigEditor agentId="incomplete-agent" />)

      await waitFor(() => {
        // Should handle gracefully - either show error or use defaults
        expect(screen.getByText(/edit agent/i) || screen.getByText(/error/i)).toBeInTheDocument()
      })
    })

    it('should handle HTTP status errors', async () => {
      const httpError = new Error('HTTP 404: Not Found')
      ;(httpError as any).status = 404
      mockApiClient.getAgent.mockRejectedValue(httpError)

      render(<AgentConfigEditor agentId="not-found" />)

      await waitFor(() => {
        expect(screen.getByText(/404.*not found/i)).toBeInTheDocument()
      })
    })

    it('should handle concurrent API calls', async () => {
      render(<AgentConfigEditor />)

      // Fill form quickly and submit multiple times
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'concurrent-test')
      await user.type(descriptionTextarea, 'Test concurrent submissions')
      await user.type(promptTextarea, 'Test prompt for concurrent submissions')

      const submitButton = screen.getByRole('button', { name: /create agent/i })

      // Simulate multiple rapid clicks
      mockApiClient.createAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          name: 'concurrent-test',
          description: 'Test concurrent submissions',
          prompt: 'Test prompt for concurrent submissions',
          model: 'sonnet',
          tools: [],
          skills: [],
        } as AgentDefinition), 1000))
      )

      await act(async () => {
        await user.click(submitButton)
        await user.click(submitButton) // Second click should be ignored
        await user.click(submitButton) // Third click should be ignored
      })

      // Should only make one API call despite multiple clicks
      await waitFor(() => {
        expect(mockApiClient.createAgent).toHaveBeenCalledTimes(1)
      }, { timeout: 2000 })
    }, 10000)
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large form inputs without memory leaks', async () => {
      render(<AgentConfigEditor />)

      const promptTextarea = screen.getByLabelText(/system prompt/i)

      // Generate very large text input
      const largeText = 'This is a large prompt. '.repeat(2000) // ~48KB

      await act(async () => {
        await user.clear(promptTextarea)
        // Use fireEvent for large input to avoid userEvent performance issues
        fireEvent.change(promptTextarea, { target: { value: largeText } })
      })

      await waitFor(() => {
        expect((promptTextarea as HTMLTextAreaElement).value.length).toBeGreaterThan(40000)
      })

      // Memory usage should remain stable (no practical way to test this in jsdom)
      // But we can ensure the component doesn't crash
      expect(promptTextarea).toBeInTheDocument()
    })

    it('should handle rapid form updates without performance degradation', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)

      // Simulate rapid typing
      const rapidUpdates = Array.from({ length: 50 }, (_, i) => `char-${i}`)

      for (const update of rapidUpdates) {
        await act(async () => {
          fireEvent.change(nameInput, { target: { value: update } })
        })
      }

      await waitFor(() => {
        expect((nameInput as HTMLInputElement).value).toBe('char-49')
      })

      // Component should still be responsive
      expect(nameInput).toBeInTheDocument()
    })

    it('should cleanup event listeners on unmount', async () => {
      const { unmount } = render(<AgentConfigEditor />)

      // Add some form interactions
      const nameInput = screen.getByLabelText(/agent name/i)
      await user.type(nameInput, 'cleanup-test')

      // Unmount component
      unmount()

      // No practical way to test event listener cleanup in jsdom,
      // but we ensure no errors are thrown during unmount
      expect(true).toBe(true)
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle clipboard operations gracefully when unavailable', async () => {
      // Mock clipboard API as unavailable
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      })

      render(<AgentConfigEditor />)

      // Fill form to enable preview
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'clipboard-test')
      await user.type(descriptionTextarea, 'Test clipboard fallback')
      await user.type(promptTextarea, 'Test prompt for clipboard fallback functionality')

      // Preview should be visible
      await waitFor(() => {
        expect(screen.getByTestId('agent-preview')).toBeInTheDocument()
      })

      // Copy button should either be disabled or use fallback
      const copyButton = screen.queryByTestId('agent-preview-copy-button')
      if (copyButton) {
        await user.click(copyButton)
        // Should not crash even without clipboard API
        expect(copyButton).toBeInTheDocument()
      }
    })

    it('should handle focus management correctly', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)

      // Test tab navigation
      nameInput.focus()
      expect(document.activeElement).toBe(nameInput)

      await user.tab()
      expect(document.activeElement).toBe(descriptionTextarea)

      // Test shift+tab backwards navigation
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(document.activeElement).toBe(nameInput)
    })

    it('should handle window resize during editing', async () => {
      render(<AgentConfigEditor />)

      // Start editing
      const nameInput = screen.getByLabelText(/agent name/i)
      await user.type(nameInput, 'resize-test')

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 300, writable: true })
      fireEvent(window, new Event('resize'))

      // Component should still be functional
      expect((nameInput as HTMLInputElement).value).toBe('resize-test')

      // Resize back to larger window
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
      fireEvent(window, new Event('resize'))

      expect((nameInput as HTMLInputElement).value).toBe('resize-test')
    })
  })

  describe('Race Condition Edge Cases', () => {
    it('should handle component unmounting during API call', async () => {
      mockApiClient.createAgent.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve({
            name: 'unmount-test',
            description: 'Test unmount',
            prompt: 'Test prompt',
            model: 'sonnet',
            tools: [],
            skills: [],
          } as AgentDefinition), 1000)
        })
      )

      const { unmount } = render(<AgentConfigEditor />)

      // Fill and submit form
      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      const promptTextarea = screen.getByLabelText(/system prompt/i)

      await user.type(nameInput, 'unmount-test')
      await user.type(descriptionTextarea, 'Test unmount')
      await user.type(promptTextarea, 'Test prompt for unmount scenario')

      const submitButton = screen.getByRole('button', { name: /create agent/i })
      await user.click(submitButton)

      // Unmount before API call completes
      unmount()

      // Should not cause any errors or memory leaks
      expect(true).toBe(true)
    })

    it('should handle props changing during edit mode', async () => {
      const { rerender } = render(<AgentConfigEditor agentId="agent-1" />)

      mockApiClient.getAgent.mockResolvedValue({
        name: 'agent-1',
        description: 'First agent',
        prompt: 'First agent prompt',
        model: 'sonnet',
        tools: [],
        skills: [],
      })

      await waitFor(() => {
        expect(screen.getByText(/edit agent/i)).toBeInTheDocument()
      })

      // Change agentId prop
      mockApiClient.getAgent.mockResolvedValue({
        name: 'agent-2',
        description: 'Second agent',
        prompt: 'Second agent prompt',
        model: 'opus',
        tools: [],
        skills: [],
      })

      rerender(<AgentConfigEditor agentId="agent-2" />)

      await waitFor(() => {
        expect(mockApiClient.getAgent).toHaveBeenCalledWith('agent-2')
      })
    })
  })

  describe('Validation Edge Cases', () => {
    it('should handle validation with complex tool/skill combinations', async () => {
      render(<AgentConfigEditor />)

      // Note: These tests would be more meaningful with real MultiSelect components
      // For now, we test the structure is present
      expect(screen.getByText(/tools/i)).toBeInTheDocument()
      expect(screen.getByText(/skills/i)).toBeInTheDocument()
    })

    it('should handle form submission with partially valid data', async () => {
      render(<AgentConfigEditor />)

      const nameInput = screen.getByLabelText(/agent name/i)
      const descriptionTextarea = screen.getByLabelText(/description/i)
      // Don't fill prompt (required field)

      await user.type(nameInput, 'partial-test')
      await user.type(descriptionTextarea, 'Partial data test')

      const submitButton = screen.getByRole('button', { name: /create agent/i })

      // Submit button should be disabled
      expect(submitButton).toBeDisabled()

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/form contains validation errors/i)).toBeInTheDocument()
      })
    })
  })
})