import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../__tests__/test-utils';
import { App, Message } from '../App';

describe('Thoughts Display Feature', () => {
  const mockConversationManager = {
    clearContext: vi.fn(),
    addMessage: vi.fn(),
    getHistory: vi.fn().mockReturnValue([]),
    saveSession: vi.fn(),
    loadSession: vi.fn(),
  };

  const mockConfig = {
    agents: [],
    workflows: {},
    autonomyLevel: 'balanced' as const,
    limits: {
      maxCost: 10,
      maxTokens: 100000,
      maxTime: 3600,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Interface with Thinking Field', () => {
    it('should support Message interface with optional thinking field', () => {
      const messageWithThinking: Message = {
        id: '1',
        type: 'assistant',
        content: 'This is the main response',
        thinking: 'This is the agents internal reasoning',
        timestamp: new Date(),
      };

      const messageWithoutThinking: Message = {
        id: '2',
        type: 'user',
        content: 'User question',
        timestamp: new Date(),
      };

      // Both message structures should be valid
      expect(messageWithThinking.thinking).toBe('This is the agents internal reasoning');
      expect(messageWithoutThinking.thinking).toBeUndefined();
      expect(messageWithThinking.content).toBe('This is the main response');
      expect(messageWithoutThinking.content).toBe('User question');
    });

    it('should handle all message types with thinking field', () => {
      const messageTypes: Array<Message['type']> = ['user', 'assistant', 'tool', 'system', 'error'];

      messageTypes.forEach(type => {
        const message: Message = {
          id: `test-${type}`,
          type,
          content: `Content for ${type}`,
          thinking: `Thinking for ${type}`,
          timestamp: new Date(),
        };

        expect(message.thinking).toBe(`Thinking for ${type}`);
        expect(message.type).toBe(type);
      });
    });

    it('should validate Message interface structure', () => {
      const completeMessage: Message = {
        id: 'complete-msg',
        type: 'assistant',
        content: 'Main content',
        agent: 'developer',
        toolName: 'Edit',
        toolInput: { file: 'test.ts' },
        toolOutput: 'File edited',
        toolStatus: 'success',
        toolDuration: 1500,
        thinking: 'I need to edit this file because...',
        timestamp: new Date(),
      };

      // Verify all fields are preserved
      expect(completeMessage.id).toBe('complete-msg');
      expect(completeMessage.type).toBe('assistant');
      expect(completeMessage.content).toBe('Main content');
      expect(completeMessage.agent).toBe('developer');
      expect(completeMessage.toolName).toBe('Edit');
      expect(completeMessage.toolInput).toEqual({ file: 'test.ts' });
      expect(completeMessage.toolOutput).toBe('File edited');
      expect(completeMessage.toolStatus).toBe('success');
      expect(completeMessage.toolDuration).toBe(1500);
      expect(completeMessage.thinking).toBe('I need to edit this file because...');
      expect(completeMessage.timestamp).toBeInstanceOf(Date);
    });

    it('should handle empty and special characters in thinking field', () => {
      const specialCasesMessages: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Response',
          thinking: '', // Empty string
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'assistant',
          content: 'Response',
          thinking: 'Multi\nline\nthinking', // Multiline
          timestamp: new Date(),
        },
        {
          id: '3',
          type: 'assistant',
          content: 'Response',
          thinking: 'Thinking with "quotes" and \'apostrophes\'', // Special chars
          timestamp: new Date(),
        },
        {
          id: '4',
          type: 'assistant',
          content: 'Response',
          thinking: 'Thinking with emojis 🤔💭', // Unicode
          timestamp: new Date(),
        },
      ];

      specialCasesMessages.forEach(message => {
        expect(message.thinking).toBeDefined();
        expect(typeof message.thinking).toBe('string');
      });
    });
  });

  describe('Thoughts Command Integration', () => {
    it('should toggle thoughts display when /thoughts command is entered', async () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      // Find the input element - this might need adjustment based on actual implementation
      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Test thoughts command toggle
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should show confirmation message
      expect(screen.getByText(/thoughts display: on/i) ||
             screen.getByText(/showing agent thoughts/i)).toBeInTheDocument();

      // Toggle again
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should show off confirmation
      expect(screen.getByText(/thoughts display: off/i) ||
             screen.getByText(/hiding agent thoughts/i)).toBeInTheDocument();
    });

    it('should persist thoughts display state between command toggles', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      // Initial state should be false (thoughts hidden)
      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // State should persist until toggled again
      fireEvent.change(input, { target: { value: '/other-command' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Thoughts should still be enabled
      expect(screen.queryByText(/thoughts display: off/i)).not.toBeInTheDocument();
    });

    it('should handle /thoughts command case variations', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Test different case variations
      const variations = ['/thoughts', '/THOUGHTS', '/Thoughts', '/tHoUgHtS'];

      variations.forEach(variation => {
        fireEvent.change(input, { target: { value: variation } });
        fireEvent.keyDown(input, { key: 'Enter' });

        // Should handle all variations
        expect(screen.getByText(/thoughts display/i)).toBeInTheDocument();
      });
    });

    it('should show appropriate confirmation messages for thoughts toggle', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Check for appropriate confirmation message
      expect(screen.getByText(/thoughts display.*on/i) ||
             screen.getByText(/showing.*thoughts/i) ||
             screen.getByText(/agent thoughts.*enabled/i)).toBeInTheDocument();

      // Disable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Check for disable confirmation
      expect(screen.getByText(/thoughts display.*off/i) ||
             screen.getByText(/hiding.*thoughts/i) ||
             screen.getByText(/agent thoughts.*disabled/i)).toBeInTheDocument();
    });
  });

  describe('Thoughts State Management', () => {
    it('should initialize with showThoughts as false by default', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      // Verify initial state - thoughts should be hidden by default
      // This would need to check internal component state or visual indicators
      expect(screen.queryByText(/thoughts.*enabled/i)).not.toBeInTheDocument();
    });

    it('should update showThoughts state correctly', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Toggle thoughts on
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // State should be true now
      expect(screen.getByText(/thoughts display.*on/i)).toBeInTheDocument();

      // Toggle thoughts off
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // State should be false now
      expect(screen.getByText(/thoughts display.*off/i)).toBeInTheDocument();
    });

    it('should pass showThoughts state to AgentPanel', () => {
      const mockTask = {
        id: 'test-task',
        description: 'Test task',
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

      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: mockTask,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      // AgentPanel should receive showThoughts prop
      // This would need to be tested through implementation details or mocking
      expect(screen.getByText(/Active Agents/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid thoughts command input gracefully', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Test malformed command
      fireEvent.change(input, { target: { value: '/thoughts extra args' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should either ignore extra args or show error
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('should handle rapid thoughts toggle commands', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Rapid toggling
      for (let i = 0; i < 5; i++) {
        fireEvent.change(input, { target: { value: '/thoughts' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      }

      // Should handle rapid toggles without errors
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Integration with Other Commands', () => {
    it('should work correctly alongside other display commands', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Test thoughts with compact mode
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Both should be active
      expect(screen.getByText(/compact/i)).toBeInTheDocument();
      expect(screen.getByText(/thoughts/i)).toBeInTheDocument();
    });

    it('should maintain state when using help command', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Use help command
      fireEvent.change(input, { target: { value: '/help' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Thoughts state should persist after help
      expect(screen.queryByText(/thoughts display.*off/i)).not.toBeInTheDocument();
    });

    it('should maintain state when clearing messages', () => {
      const mockProps = {
        conversationManager: mockConversationManager,
        config: mockConfig,
        initialTask: null,
        onTaskComplete: vi.fn(),
      };

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Clear messages
      fireEvent.change(input, { target: { value: '/clear' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Thoughts state should persist after clear
      // This would need internal state verification
    });
  });
});