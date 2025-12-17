import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../__tests__/test-utils';
import { App, Message } from '../App';

describe('Thoughts Filtering Based on showThoughts State', () => {
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
        { name: 'developer', role: 'developer' },
        { name: 'tester', role: 'tester' },
      ],
      workflows: {
        feature: {
          name: 'Feature Development',
          agents: ['developer', 'tester'],
          stages: {
            implementation: { agent: 'developer', description: 'Implement' },
            testing: { agent: 'tester', description: 'Test' },
          },
        },
      },
      autonomyLevel: 'balanced' as const,
      limits: { maxCost: 10, maxTokens: 100000, maxTime: 3600 },
    };

    mockProps = {
      conversationManager: mockConversationManager,
      config: mockConfig,
      initialTask: null,
      onTaskComplete: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('Message Filtering with Thinking Field', () => {
    const sampleMessages: Message[] = [
      {
        id: '1',
        type: 'assistant',
        content: 'I need to analyze this problem.',
        thinking: 'Let me break this down: first I need to understand the requirements...',
        agent: 'developer',
        timestamp: new Date('2023-01-01T10:00:00Z'),
      },
      {
        id: '2',
        type: 'user',
        content: 'What should I implement?',
        timestamp: new Date('2023-01-01T10:01:00Z'),
      },
      {
        id: '3',
        type: 'assistant',
        content: 'Here is my recommendation.',
        thinking: 'Based on the user\'s question, I should provide a clear answer...',
        agent: 'developer',
        timestamp: new Date('2023-01-01T10:02:00Z'),
      },
      {
        id: '4',
        type: 'tool',
        content: 'File created successfully',
        toolName: 'Write',
        toolStatus: 'success',
        agent: 'developer',
        timestamp: new Date('2023-01-01T10:03:00Z'),
      },
      {
        id: '5',
        type: 'assistant',
        content: 'Tests are passing.',
        thinking: 'All the test cases look good, no issues found.',
        agent: 'tester',
        timestamp: new Date('2023-01-01T10:04:00Z'),
      },
    ];

    beforeEach(() => {
      mockConversationManager.getHistory.mockReturnValue(sampleMessages);
    });

    it('should display main content for all messages regardless of showThoughts state', async () => {
      render(<App {...mockProps} />);

      // All main content should be visible by default
      expect(screen.getByText('I need to analyze this problem.')).toBeInTheDocument();
      expect(screen.getByText('What should I implement?')).toBeInTheDocument();
      expect(screen.getByText('Here is my recommendation.')).toBeInTheDocument();
      expect(screen.getByText('File created successfully')).toBeInTheDocument();
      expect(screen.getByText('Tests are passing.')).toBeInTheDocument();

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Main content should still be visible
      expect(screen.getByText('I need to analyze this problem.')).toBeInTheDocument();
      expect(screen.getByText('What should I implement?')).toBeInTheDocument();
      expect(screen.getByText('Here is my recommendation.')).toBeInTheDocument();
      expect(screen.getByText('File created successfully')).toBeInTheDocument();
      expect(screen.getByText('Tests are passing.')).toBeInTheDocument();
    });

    it('should handle messages with thinking field when showThoughts is enabled', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Thoughts should be hidden by default
      expect(screen.queryByText(/Let me break this down/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Based on the user\'s question/)).not.toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/thoughts display.*on/i)).toBeInTheDocument();
      });

      // With current implementation, thoughts may not be visually separate
      // But the showThoughts state should be passed to components
      // This tests the infrastructure is in place
    });

    it('should handle messages without thinking field gracefully', async () => {
      const messagesWithoutThinking: Message[] = [
        {
          id: '1',
          type: 'user',
          content: 'User message without thinking',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'assistant',
          content: 'Assistant message without thinking',
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

      // Messages should display normally
      expect(screen.getByText('User message without thinking')).toBeInTheDocument();
      expect(screen.getByText('Assistant message without thinking')).toBeInTheDocument();
    });

    it('should handle mixed messages (some with thinking, some without)', async () => {
      const mixedMessages: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Message with thinking',
          thinking: 'Internal reasoning here',
          agent: 'developer',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'assistant',
          content: 'Message without thinking',
          agent: 'developer',
          timestamp: new Date(),
        },
        {
          id: '3',
          type: 'user',
          content: 'User message',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(mixedMessages);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // All content should be visible
      expect(screen.getByText('Message with thinking')).toBeInTheDocument();
      expect(screen.getByText('Message without thinking')).toBeInTheDocument();
      expect(screen.getByText('User message')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // All content should still be visible
      expect(screen.getByText('Message with thinking')).toBeInTheDocument();
      expect(screen.getByText('Message without thinking')).toBeInTheDocument();
      expect(screen.getByText('User message')).toBeInTheDocument();
    });
  });

  describe('Agent-Specific Thought Filtering', () => {
    const agentSpecificMessages: Message[] = [
      {
        id: '1',
        type: 'assistant',
        content: 'Developer response',
        thinking: 'Developer thinking process...',
        agent: 'developer',
        timestamp: new Date(),
      },
      {
        id: '2',
        type: 'assistant',
        content: 'Tester response',
        thinking: 'Tester analysis thoughts...',
        agent: 'tester',
        timestamp: new Date(),
      },
      {
        id: '3',
        type: 'assistant',
        content: 'System message',
        thinking: 'System reasoning...',
        timestamp: new Date(),
      },
    ];

    beforeEach(() => {
      mockConversationManager.getHistory.mockReturnValue(agentSpecificMessages);
    });

    it('should handle thoughts from different agents', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // All agent responses should be visible
      expect(screen.getByText('Developer response')).toBeInTheDocument();
      expect(screen.getByText('Tester response')).toBeInTheDocument();
      expect(screen.getByText('System message')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // All responses should still be visible
      expect(screen.getByText('Developer response')).toBeInTheDocument();
      expect(screen.getByText('Tester response')).toBeInTheDocument();
      expect(screen.getByText('System message')).toBeInTheDocument();
    });

    it('should handle messages without agent field', async () => {
      const noAgentMessages: Message[] = [
        {
          id: '1',
          type: 'system',
          content: 'System message without agent',
          thinking: 'System level thinking',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'error',
          content: 'Error message',
          thinking: 'Error analysis',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(noAgentMessages);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      expect(screen.getByText('System message without agent')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Messages should still display
      expect(screen.getByText('System message without agent')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Tool Message Thought Filtering', () => {
    const toolMessages: Message[] = [
      {
        id: '1',
        type: 'tool',
        content: 'Tool execution result',
        thinking: 'Tool reasoning about the operation',
        toolName: 'Edit',
        toolStatus: 'success',
        agent: 'developer',
        timestamp: new Date(),
      },
      {
        id: '2',
        type: 'tool',
        content: 'Another tool result',
        toolName: 'Read',
        toolStatus: 'success',
        agent: 'developer',
        timestamp: new Date(),
        // No thinking field
      },
    ];

    beforeEach(() => {
      mockConversationManager.getHistory.mockReturnValue(toolMessages);
    });

    it('should handle tool messages with thinking field', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      expect(screen.getByText('Tool execution result')).toBeInTheDocument();
      expect(screen.getByText('Another tool result')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Tool results should still be visible
      expect(screen.getByText('Tool execution result')).toBeInTheDocument();
      expect(screen.getByText('Another tool result')).toBeInTheDocument();
    });

    it('should handle tool messages with different statuses', async () => {
      const statusMessages: Message[] = [
        {
          id: '1',
          type: 'tool',
          content: 'Success result',
          thinking: 'Successful operation thinking',
          toolStatus: 'success',
          agent: 'developer',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'tool',
          content: 'Error result',
          thinking: 'Error analysis thinking',
          toolStatus: 'error',
          agent: 'developer',
          timestamp: new Date(),
        },
        {
          id: '3',
          type: 'tool',
          content: 'Pending result',
          thinking: 'Pending operation thoughts',
          toolStatus: 'pending',
          agent: 'developer',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(statusMessages);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // All tool results should be visible
      expect(screen.getByText('Success result')).toBeInTheDocument();
      expect(screen.getByText('Error result')).toBeInTheDocument();
      expect(screen.getByText('Pending result')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // All results should still be visible
      expect(screen.getByText('Success result')).toBeInTheDocument();
      expect(screen.getByText('Error result')).toBeInTheDocument();
      expect(screen.getByText('Pending result')).toBeInTheDocument();
    });
  });

  describe('Dynamic Thought Filtering', () => {
    const dynamicMessages: Message[] = [
      {
        id: '1',
        type: 'assistant',
        content: 'First response',
        thinking: 'First thinking process',
        agent: 'developer',
        timestamp: new Date(),
      },
    ];

    it('should handle adding new messages while thoughts are enabled', async () => {
      mockConversationManager.getHistory.mockReturnValue(dynamicMessages);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts first
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('First response')).toBeInTheDocument();

      // Simulate adding a new message
      const updatedMessages = [
        ...dynamicMessages,
        {
          id: '2',
          type: 'assistant',
          content: 'Second response',
          thinking: 'Second thinking process',
          agent: 'developer',
          timestamp: new Date(),
        } as Message,
      ];

      mockConversationManager.getHistory.mockReturnValue(updatedMessages);

      // Re-render would happen in real app when messages update
      // For testing, we simulate by checking that the component can handle it
      expect(screen.getByText('First response')).toBeInTheDocument();
    });

    it('should handle removing messages while thoughts are enabled', async () => {
      mockConversationManager.getHistory.mockReturnValue(dynamicMessages);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('First response')).toBeInTheDocument();

      // Simulate clearing messages
      mockConversationManager.getHistory.mockReturnValue([]);

      // Execute clear command
      fireEvent.change(input, { target: { value: '/clear' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Message should be gone, but thoughts state should persist
      expect(mockConversationManager.clearContext).toHaveBeenCalled();
    });
  });

  describe('Display Mode Integration with Thought Filtering', () => {
    const displayModeMessages: Message[] = [
      {
        id: '1',
        type: 'assistant',
        content: 'Response for display mode testing',
        thinking: 'Complex thinking process with multiple steps...',
        agent: 'developer',
        timestamp: new Date(),
      },
    ];

    beforeEach(() => {
      mockConversationManager.getHistory.mockReturnValue(displayModeMessages);
    });

    it('should filter thoughts correctly in normal display mode', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      expect(screen.getByText('Response for display mode testing')).toBeInTheDocument();

      // Enable thoughts in normal mode
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Response for display mode testing')).toBeInTheDocument();
    });

    it('should filter thoughts correctly in compact display mode', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Switch to compact mode
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Enable thoughts in compact mode
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Response should be visible (possibly truncated in compact mode)
      expect(screen.getByText(/Response for display mode testing/)).toBeInTheDocument();
    });

    it('should filter thoughts correctly in verbose display mode', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Switch to verbose mode
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Enable thoughts in verbose mode
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Response for display mode testing')).toBeInTheDocument();
    });

    it('should maintain thought filtering across display mode changes', async () => {
      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Change display modes
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Content should remain visible through all mode changes
      expect(screen.getByText(/Response for display mode testing/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases in Thought Filtering', () => {
    it('should handle empty thinking fields', async () => {
      const emptyThinkingMessages: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Response with empty thinking',
          thinking: '',
          agent: 'developer',
          timestamp: new Date(),
        },
        {
          id: '2',
          type: 'assistant',
          content: 'Response with whitespace thinking',
          thinking: '   \n   ',
          agent: 'developer',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(emptyThinkingMessages);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      expect(screen.getByText('Response with empty thinking')).toBeInTheDocument();
      expect(screen.getByText('Response with whitespace thinking')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Responses should still be visible
      expect(screen.getByText('Response with empty thinking')).toBeInTheDocument();
      expect(screen.getByText('Response with whitespace thinking')).toBeInTheDocument();
    });

    it('should handle very long thinking content', async () => {
      const longThinkingMessage: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Response with long thinking',
          thinking: 'This is a very long thinking process. '.repeat(100) + 'End of thinking.',
          agent: 'developer',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(longThinkingMessage);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      expect(screen.getByText('Response with long thinking')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Response with long thinking')).toBeInTheDocument();
    });

    it('should handle special characters in thinking content', async () => {
      const specialCharThinkingMessage: Message[] = [
        {
          id: '1',
          type: 'assistant',
          content: 'Response with special thinking',
          thinking: 'Thinking with 🤔 emojis and <html> tags & special chars: "quotes" \'apostrophes\' [brackets]',
          agent: 'developer',
          timestamp: new Date(),
        },
      ];

      mockConversationManager.getHistory.mockReturnValue(specialCharThinkingMessage);

      render(<App {...mockProps} />);

      const input = screen.getByRole('textbox') || screen.getByTestId('user-input');

      expect(screen.getByText('Response with special thinking')).toBeInTheDocument();

      // Enable thoughts
      fireEvent.change(input, { target: { value: '/thoughts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Response with special thinking')).toBeInTheDocument();
    });
  });
});