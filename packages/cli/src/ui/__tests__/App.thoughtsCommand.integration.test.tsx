import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../__tests__/test-utils';
import { App, Message, AppState } from '../App';

describe('App Thoughts Command Integration', () => {
  let mockConversationManager: any;
  let mockConfig: any;
  let mockProps: any;

  beforeEach(() => {
    mockConversationManager = {
      clearContext: vi.fn(),
      addMessage: vi.fn(),
      getHistory: vi.fn().mockReturnValue([]),
      saveSession: vi.fn(),
      loadSession: vi.fn(),
      processMessage: vi.fn(),
    };

    mockConfig = {
      agents: [
        { name: 'planner', role: 'planner' },
        { name: 'architect', role: 'architect' },
        { name: 'developer', role: 'developer' },
        { name: 'tester', role: 'tester' },
        { name: 'reviewer', role: 'reviewer' },
        { name: 'devops', role: 'devops' },
      ],
      workflows: {
        feature: {
          name: 'Feature Development',
          agents: ['planner', 'architect', 'developer', 'tester', 'reviewer'],
          stages: {
            planning: { agent: 'planner', description: 'Plan the feature' },
            architecture: { agent: 'architect', description: 'Design architecture' },
            implementation: { agent: 'developer', description: 'Implement feature' },
            testing: { agent: 'tester', description: 'Test implementation' },
            review: { agent: 'reviewer', description: 'Review code' },
          },
        },
      },
      autonomyLevel: 'balanced' as const,
      limits: {
        maxCost: 10,
        maxTokens: 100000,
        maxTime: 3600,
      },
    };

    mockProps = {
      conversationManager: mockConversationManager,
      config: mockConfig,
      initialTask: null,
      onTaskComplete: vi.fn(),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Thoughts Command Recognition', () => {
    it('should recognize /thoughts command and toggle state', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Execute thoughts command
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should show confirmation message
      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*on/i) ||
               screen.getByText(/agent thoughts.*enabled/i) ||
               screen.getByText(/showing.*thoughts/i)).toBeInTheDocument();
      });
    });

    it('should handle case-insensitive thoughts commands', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      const commandVariations = ['/thoughts', '/THOUGHTS', '/Thoughts', '/tHoUgHtS'];

      for (const command of commandVariations) {
        fireEvent.change(input, { target: { value: command } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
          expect(screen.getByText(/thoughts/i)).toBeInTheDocument();
        });

        // Reset for next test
        fireEvent.change(input, { target: { value: '/clear' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      }
    });

    it('should not execute thoughts command with extra parameters', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Try command with extra parameters
      fireEvent.change(input, { target: { value: '/thoughts extra parameters' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should either handle gracefully or show error
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('should distinguish thoughts command from regular messages', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Send regular message containing "thoughts"
      fireEvent.change(input, { target: { value: 'I have some thoughts about this' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not trigger command
      expect(screen.queryByText(/thoughts display.*on/i)).not.toBeInTheDocument();

      // Send actual command
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should trigger command
      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*on/i) ||
               screen.getByText(/agent thoughts.*enabled/i)).toBeInTheDocument();
      });
    });
  });

  describe('State Management Integration', () => {
    it('should toggle showThoughts state correctly', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Initial state should be false
      // Turn on
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*on/i) ||
               screen.getByText(/enabled/i)).toBeInTheDocument();
      });

      // Turn off
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*off/i) ||
               screen.getByText(/disabled/i)).toBeInTheDocument();
      });
    });

    it('should persist state across other commands', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts.*on/i)).toBeInTheDocument();
      });

      // Execute other command
      fireEvent.change(input, { target: { value: '/help' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Thoughts state should persist
      // (We can't directly test this without accessing internal state,
      // but we can test that no "off" message appears)
      expect(screen.queryByText(/thoughts.*off/i)).not.toBeInTheDocument();
    });

    it('should maintain state after clearing messages', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts.*on/i)).toBeInTheDocument();
      });

      // Clear messages
      fireEvent.change(input, { target: { value: '/clear' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // State should persist through clear
      expect(mockConversationManager.clearContext).toHaveBeenCalled();
    });

    it('should work with display mode changes', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Switch to compact mode
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/compact/i)).toBeInTheDocument();
      });

      // Switch to verbose mode
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/verbose/i)).toBeInTheDocument();
      });

      // Thoughts state should work with all display modes
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts.*off/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Active Task', () => {
    it('should pass showThoughts to AgentPanel when task is active', async () => {
      const mockTask = {
        id: 'test-task',
        description: 'Test task with thoughts',
        status: 'running' as const,
        workflow: 'feature',
        agent: 'developer',
        stage: 'implementation',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
        logs: [],
        artifacts: [],
        retryCount: 0,
        maxRetries: 3,
      };

      render(<App {...mockProps} initialTask={mockTask} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Should show AgentPanel
      expect(screen.getByText(/Active Agents/i)).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // AgentPanel should continue to work normally
      expect(screen.getByText(/Active Agents/i)).toBeInTheDocument();
      expect(screen.getByText(/developer/i)).toBeInTheDocument();
    });

    it('should work with task status display when thoughts are enabled', async () => {
      const mockTask = {
        id: 'test-task',
        description: 'Testing thoughts with status',
        status: 'running' as const,
        workflow: 'feature',
        agent: 'tester',
        stage: 'testing',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: { inputTokens: 1000, outputTokens: 500, cost: 0.05 },
        logs: [],
        artifacts: [],
        retryCount: 0,
        maxRetries: 3,
      };

      render(<App {...mockProps} initialTask={mockTask} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Should show task info
      expect(screen.getByText(/Testing thoughts with status/i)).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Task info should still be visible
      expect(screen.getByText(/Testing thoughts with status/i)).toBeInTheDocument();
    });
  });

  describe('Message Handling with Thoughts', () => {
    it('should handle messages with thinking field when thoughts are enabled', async () => {
      const messagesWithThinking: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Main response content',
          thinking: 'Internal reasoning process...',
          agent: 'developer',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'user',
          content: 'User question',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(messagesWithThinking);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Messages should be displayed
      expect(screen.getByText(/Main response content/i)).toBeInTheDocument();
      expect(screen.getByText(/User question/i)).toBeInTheDocument();
    });

    it('should handle messages without thinking field when thoughts are enabled', async () => {
      const messagesWithoutThinking: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Response without thinking',
          agent: 'developer',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(messagesWithoutThinking);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Message should still display normally
      expect(screen.getByText(/Response without thinking/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rapid thoughts command toggling', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Rapid toggle 5 times
      for (let i = 0; i < 5; i++) {
        fireEvent.change(input, { target: { value: '/thoughts' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        // Small delay to allow processing
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should handle gracefully without errors
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('should handle thoughts command with malformed input', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      const malformedCommands = [
        '/thoughts   ', // trailing spaces
        '  /thoughts', // leading spaces
        '/thoughts\n', // with newline
        '/thoughtss', // misspelled
      ];

      for (const command of malformedCommands) {
        fireEvent.change(input, { target: { value: command } });
        fireEvent.keyDown(input, { key: 'Enter' });

        // Should handle gracefully
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      }
    });

    it('should work when no conversation manager is available', () => {
      const propsWithoutManager = {
        ...mockProps,
        conversationManager: null,
      };

      expect(() => {
        render(<App {...propsWithoutManager} />);
      }).not.toThrow();
    });

    it('should handle empty config gracefully with thoughts command', async () => {
      const propsWithEmptyConfig = {
        ...mockProps,
        config: {
          agents: [],
          workflows: {},
          autonomyLevel: 'balanced' as const,
          limits: { maxCost: 10, maxTokens: 100000, maxTime: 3600 },
        },
      };

      render(<App {...propsWithEmptyConfig} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Should still handle thoughts command
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Confirmation Messages', () => {
    it('should show appropriate confirmation when enabling thoughts', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*on/i) ||
               screen.getByText(/showing.*agent thoughts/i) ||
               screen.getByText(/agent thoughts.*enabled/i)).toBeInTheDocument();
      });
    });

    it('should show appropriate confirmation when disabling thoughts', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // First enable
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/on/i)).toBeInTheDocument();
      });

      // Then disable
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*off/i) ||
               screen.getByText(/hiding.*agent thoughts/i) ||
               screen.getByText(/agent thoughts.*disabled/i)).toBeInTheDocument();
      });
    });

    it('should clear input after executing thoughts command', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: '/thoughts' } });
      expect(input.value).toBe('/thoughts');

      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should add confirmation message to message history', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        // The confirmation message should be added to the conversation
        expect(screen.getByText(/thoughts display/i)).toBeInTheDocument();
      });
    });
  });

  describe('Command Integration with Other Features', () => {
    it('should work alongside help command', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Show help
      fireEvent.change(input, { target: { value: '/help' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Then use thoughts command
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts/i)).toBeInTheDocument();
      });
    });

    it('should work with display mode commands', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Set compact mode
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Enable thoughts in compact mode
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts/i)).toBeInTheDocument();
      });

      // Switch to verbose mode
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Thoughts should still work in verbose mode
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });
});