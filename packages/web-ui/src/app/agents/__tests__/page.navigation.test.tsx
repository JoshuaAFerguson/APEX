/**
 * Tests for Agents Page Navigation
 *
 * Tests the navigation functionality added to the agents list page:
 * - Create Agent button navigation
 * - Edit buttons on agent cards
 * - Proper routing behavior
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import AgentsPage from '../page'
import { apiClient } from '@/lib/api-client'
import type { AgentDefinition } from '@apexcli/core'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listAgents: jest.fn(),
  },
}))

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
}

const mockAgents: AgentDefinition[] = [
  {
    name: 'agent-one',
    description: 'First test agent',
    prompt: 'You are agent one',
    model: 'sonnet',
    tools: ['web-search', 'file-read'],
    skills: ['problem-solving'],
  },
  {
    name: 'agent-two',
    description: 'Second test agent',
    prompt: 'You are agent two',
    model: 'opus',
    tools: ['bash'],
    skills: ['code-review', 'debugging'],
  },
  {
    name: 'minimal-agent',
    description: 'Minimal agent',
    prompt: 'You are minimal',
    model: 'haiku',
  },
]

describe('Agents Page Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(apiClient.listAgents as jest.Mock).mockResolvedValue(mockAgents)
  })

  describe('Create Agent Navigation', () => {
    it('renders Create Agent button in header', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()
      })
    })

    it('navigates to create page when Create Agent clicked', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: 'Create Agent' })
      fireEvent.click(createButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/agents/new')
    })

    it('maintains Refresh button alongside Create Agent button', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()
      })

      // Both buttons should be in the header
      const headerButtons = screen.getAllByRole('button')
      const headerButtonNames = headerButtons.map(btn => btn.textContent)
      expect(headerButtonNames).toContain('Refresh')
      expect(headerButtonNames).toContain('Create Agent')
    })
  })

  describe('Edit Agent Navigation', () => {
    it('renders Edit button on each agent card', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      // Should have Edit button for each agent
      const editButtons = screen.getAllByRole('button', { name: 'Edit' })
      expect(editButtons).toHaveLength(mockAgents.length)
    })

    it('navigates to edit page when Edit button clicked', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: 'Edit' })

      // Click first edit button (agent-one)
      fireEvent.click(editButtons[0])

      expect(mockRouter.push).toHaveBeenCalledWith('/agents/agent-one/edit')
    })

    it('navigates to correct edit page for different agents', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-two')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: 'Edit' })

      // Click second edit button (agent-two)
      fireEvent.click(editButtons[1])

      expect(mockRouter.push).toHaveBeenCalledWith('/agents/agent-two/edit')

      jest.clearAllMocks()

      // Click third edit button (minimal-agent)
      fireEvent.click(editButtons[2])

      expect(mockRouter.push).toHaveBeenCalledWith('/agents/minimal-agent/edit')
    })

    it('renders Edit buttons with proper styling', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: 'Edit' })

      // Check that edit buttons have expected classes (outline variant, small size, full width)
      editButtons.forEach(button => {
        expect(button).toHaveClass('w-full') // Full width within card
      })
    })
  })

  describe('Card Layout with Edit Buttons', () => {
    it('maintains agent card information with Edit buttons', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      // Check that agent information is still displayed
      expect(screen.getByText('First test agent')).toBeInTheDocument()
      expect(screen.getByText('Second test agent')).toBeInTheDocument()
      expect(screen.getByText('Minimal agent')).toBeInTheDocument()

      // Check that model badges are present
      expect(screen.getByText('sonnet')).toBeInTheDocument()
      expect(screen.getByText('opus')).toBeInTheDocument()
      expect(screen.getByText('haiku')).toBeInTheDocument()

      // Check that tools are displayed
      expect(screen.getByText('web-search')).toBeInTheDocument()
      expect(screen.getByText('file-read')).toBeInTheDocument()
      expect(screen.getByText('bash')).toBeInTheDocument()
    })

    it('shows tools above Edit button with proper spacing', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      // Tools should be displayed with proper spacing
      const toolElements = screen.getAllByText('web-search')
      expect(toolElements[0]).toBeInTheDocument()

      // Edit button should be in a separate section with border
      const editButtons = screen.getAllByRole('button', { name: 'Edit' })
      expect(editButtons[0]).toBeInTheDocument()
    })

    it('handles agents without tools gracefully', async () => {
      const agentsWithoutTools = [
        {
          name: 'no-tools-agent',
          description: 'Agent without tools',
          prompt: 'You have no tools',
          model: 'sonnet' as const,
        },
      ]

      ;(apiClient.listAgents as jest.Mock).mockResolvedValue(agentsWithoutTools)

      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('no-tools-agent')).toBeInTheDocument()
      })

      // Should still have Edit button even without tools
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()

      // Click edit button
      const editButton = screen.getByRole('button', { name: 'Edit' })
      fireEvent.click(editButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/agents/no-tools-agent/edit')
    })
  })

  describe('Error States', () => {
    it('still shows navigation when agents fail to load', async () => {
      ;(apiClient.listAgents as jest.Mock).mockRejectedValue(new Error('API Error'))

      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })

      // Create Agent button should still be available in error state
      expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()

      // Click should still work
      const createButton = screen.getByRole('button', { name: 'Create Agent' })
      fireEvent.click(createButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/agents/new')
    })

    it('shows Retry button in error state', async () => {
      ;(apiClient.listAgents as jest.Mock).mockRejectedValue(new Error('Network Error'))

      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('shows Create Agent button even during loading', () => {
      ;(apiClient.listAgents as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockAgents), 1000))
      )

      render(<AgentsPage />)

      // Should show Create Agent button immediately
      expect(screen.getByRole('button', { name: 'Create Agent' })).toBeInTheDocument()

      // Should show loading spinner
      expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper button labels and roles', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      // All buttons should have proper roles and accessible names
      const createButton = screen.getByRole('button', { name: 'Create Agent' })
      const refreshButton = screen.getByRole('button', { name: 'Refresh' })
      const editButtons = screen.getAllByRole('button', { name: 'Edit' })

      expect(createButton).toBeInTheDocument()
      expect(refreshButton).toBeInTheDocument()
      expect(editButtons).toHaveLength(mockAgents.length)

      // Buttons should be accessible via keyboard
      editButtons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1')
      })
    })

    it('provides clear context for Edit buttons', async () => {
      render(<AgentsPage />)

      await waitFor(() => {
        expect(screen.getByText('agent-one')).toBeInTheDocument()
      })

      // Each edit button should be within context of its agent card
      const agentOneCard = screen.getByText('agent-one').closest('div[data-testid], div')
      expect(agentOneCard).toContainElement(screen.getAllByRole('button', { name: 'Edit' })[0])
    })
  })
})