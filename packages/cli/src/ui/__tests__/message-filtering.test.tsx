import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { App, AppState, AppProps, Message } from '../App';

describe('Message Filtering in Display Modes', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createMessage = (type: Message['type'], content: string, id?: string, options?: Partial<Message>): Message => ({
    id: id || `msg_${Math.random()}`,
    type,
    content,
    timestamp: new Date(),
    ...options,
  });

  const createAppState = (messages: Message[], displayMode: 'normal' | 'compact' | 'verbose' = 'normal'): AppState => ({
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: null,
    messages,
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: 'claude-3-sonnet',
    displayMode,
  });

  describe('Normal Mode Message Display', () => {
    it('should show all message types in normal mode', () => {
      const messages: Message[] = [
        createMessage('user', 'User message'),
        createMessage('assistant', 'Assistant response'),
        createMessage('system', 'System notification'),
        createMessage('tool', 'Tool output', undefined, {
          toolName: 'test-tool',
          toolInput: { param: 'value' },
          toolOutput: 'result',
          toolStatus: 'success',
        }),
        createMessage('error', 'Error message'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'normal'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // All message types should be visible in normal mode
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();
      expect(screen.getByText('System notification')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Compact Mode Message Filtering', () => {
    it('should filter out system messages in compact mode', () => {
      const messages: Message[] = [
        createMessage('user', 'User message'),
        createMessage('assistant', 'Assistant response'),
        createMessage('system', 'System notification'),
        createMessage('system', 'Another system message'),
        createMessage('error', 'Error message'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Non-system messages should be visible
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // System messages should be filtered out
      expect(screen.queryByText('System notification')).not.toBeInTheDocument();
      expect(screen.queryByText('Another system message')).not.toBeInTheDocument();
    });

    it('should filter out tool messages in compact mode', () => {
      const messages: Message[] = [
        createMessage('user', 'User message'),
        createMessage('assistant', 'Assistant response'),
        createMessage('tool', 'Tool output 1', undefined, {
          toolName: 'tool1',
          toolInput: { param: 'value1' },
          toolOutput: 'result1',
          toolStatus: 'success',
        }),
        createMessage('tool', 'Tool output 2', undefined, {
          toolName: 'tool2',
          toolInput: { param: 'value2' },
          toolOutput: 'result2',
          toolStatus: 'success',
        }),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Non-tool messages should be visible
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();

      // Tool messages should be filtered out
      expect(screen.queryByText('Tool output 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Tool output 2')).not.toBeInTheDocument();
    });

    it('should keep user, assistant, and error messages in compact mode', () => {
      const messages: Message[] = [
        createMessage('user', 'Important user input'),
        createMessage('assistant', 'Key assistant response'),
        createMessage('error', 'Critical error message'),
        createMessage('system', 'Filtered system message'),
        createMessage('tool', 'Filtered tool output'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Important messages should remain visible
      expect(screen.getByText('Important user input')).toBeInTheDocument();
      expect(screen.getByText('Key assistant response')).toBeInTheDocument();
      expect(screen.getByText('Critical error message')).toBeInTheDocument();

      // Verbose messages should be filtered
      expect(screen.queryByText('Filtered system message')).not.toBeInTheDocument();
      expect(screen.queryByText('Filtered tool output')).not.toBeInTheDocument();
    });
  });

  describe('Verbose Mode Message Display', () => {
    it('should show all message types including debug info in verbose mode', () => {
      const messages: Message[] = [
        createMessage('user', 'User message'),
        createMessage('assistant', 'Assistant response'),
        createMessage('system', 'System notification'),
        createMessage('system', 'Debug: Internal state'),
        createMessage('tool', 'Tool debug output', undefined, {
          toolName: 'debug-tool',
          toolInput: { debug: true },
          toolOutput: 'debug result',
          toolStatus: 'success',
        }),
        createMessage('error', 'Error with stack trace'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'verbose'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // All messages should be visible in verbose mode
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();
      expect(screen.getByText('System notification')).toBeInTheDocument();
      expect(screen.getByText('Debug: Internal state')).toBeInTheDocument();
      expect(screen.getByText('Error with stack trace')).toBeInTheDocument();

      // Tool messages should also be visible
      expect(screen.getByText('Tool debug output')).toBeInTheDocument();
    });

    it('should display technical debug messages in verbose mode', () => {
      const messages: Message[] = [
        createMessage('system', 'Orchestrator: Agent handoff initiated'),
        createMessage('system', 'Debug: Memory usage at 45%'),
        createMessage('system', 'Performance: Task completed in 2.3s'),
        createMessage('tool', 'API call trace', undefined, {
          toolName: 'api-client',
          toolInput: { endpoint: '/debug', method: 'GET' },
          toolOutput: 'HTTP 200 - Response time: 124ms',
          toolStatus: 'success',
        }),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'verbose'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // All technical messages should be visible
      expect(screen.getByText('Orchestrator: Agent handoff initiated')).toBeInTheDocument();
      expect(screen.getByText('Debug: Memory usage at 45%')).toBeInTheDocument();
      expect(screen.getByText('Performance: Task completed in 2.3s')).toBeInTheDocument();
      expect(screen.getByText('API call trace')).toBeInTheDocument();
    });
  });

  describe('Message Count Limitations', () => {
    it('should respect the last 20 messages limit in all modes', () => {
      // Create 25 messages
      const messages: Message[] = Array.from({ length: 25 }, (_, i) =>
        createMessage('user', `Message ${i + 1}`, `msg${i + 1}`)
      );

      const props: AppProps = {
        initialState: createAppState(messages, 'normal'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should only show the last 20 messages (6-25)
      expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Message 5')).not.toBeInTheDocument();
      expect(screen.getByText('Message 6')).toBeInTheDocument();
      expect(screen.getByText('Message 25')).toBeInTheDocument();
    });

    it('should apply filtering after message count limit in compact mode', () => {
      // Create 25 messages with mixed types
      const messages: Message[] = Array.from({ length: 25 }, (_, i) => {
        const type = i % 3 === 0 ? 'system' : i % 3 === 1 ? 'user' : 'assistant';
        return createMessage(type, `${type} message ${i + 1}`, `msg${i + 1}`);
      });

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should show last 20 messages, but filter out system messages
      // Messages 6-25 should be considered, but system messages filtered out
      expect(screen.queryByText('system message 6')).not.toBeInTheDocument(); // system, should be filtered
      expect(screen.getByText('user message 7')).toBeInTheDocument(); // user, should show
      expect(screen.getByText('assistant message 8')).toBeInTheDocument(); // assistant, should show
      expect(screen.queryByText('system message 9')).not.toBeInTheDocument(); // system, should be filtered
    });
  });

  describe('Dynamic Filtering Changes', () => {
    it('should apply new filter when switching from normal to compact', async () => {
      const messages: Message[] = [
        createMessage('user', 'User message'),
        createMessage('system', 'System message'),
        createMessage('assistant', 'Assistant message'),
      ];

      const initialState = createAppState(messages, 'normal');
      const props: AppProps = {
        initialState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      const { rerender } = render(<App {...props} />);

      // Initially all messages visible
      expect(screen.getByText('System message')).toBeInTheDocument();

      // Switch to compact mode
      const compactState = { ...initialState, displayMode: 'compact' as const };

      await act(async () => {
        rerender(<App {...props} initialState={compactState} />);
      });

      // System message should now be filtered out
      expect(screen.queryByText('System message')).not.toBeInTheDocument();
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
    });

    it('should restore messages when switching from compact to verbose', async () => {
      const messages: Message[] = [
        createMessage('user', 'User message'),
        createMessage('system', 'System message'),
        createMessage('tool', 'Tool message', undefined, {
          toolName: 'test',
          toolOutput: 'output',
          toolStatus: 'success',
        }),
        createMessage('assistant', 'Assistant message'),
      ];

      const compactState = createAppState(messages, 'compact');
      const props: AppProps = {
        initialState: compactState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      const { rerender } = render(<App {...props} />);

      // In compact mode, system and tool messages hidden
      expect(screen.queryByText('System message')).not.toBeInTheDocument();
      expect(screen.queryByText('Tool message')).not.toBeInTheDocument();

      // Switch to verbose mode
      const verboseState = { ...compactState, displayMode: 'verbose' as const };

      await act(async () => {
        rerender(<App {...props} initialState={verboseState} />);
      });

      // All messages should now be visible
      expect(screen.getByText('System message')).toBeInTheDocument();
      expect(screen.getByText('Tool message')).toBeInTheDocument();
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message list gracefully', () => {
      const props: AppProps = {
        initialState: createAppState([], 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should not crash with empty messages
      expect(screen.getByPlaceholderText(/Type a task or \/help for commands/)).toBeInTheDocument();
    });

    it('should handle all filtered messages in compact mode', () => {
      const messages: Message[] = [
        createMessage('system', 'System message 1'),
        createMessage('system', 'System message 2'),
        createMessage('tool', 'Tool message 1'),
        createMessage('tool', 'Tool message 2'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // All messages should be filtered out, leaving empty message area
      expect(screen.queryByText('System message 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Tool message 1')).not.toBeInTheDocument();

      // App should still be functional
      expect(screen.getByPlaceholderText(/Type a task or \/help for commands/)).toBeInTheDocument();
    });

    it('should handle messages with undefined or null content', () => {
      const messages: Message[] = [
        { ...createMessage('user', ''), content: '' }, // empty content
        createMessage('system', 'Valid system message'),
        createMessage('assistant', 'Valid assistant message'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should handle empty content gracefully
      expect(screen.getByText('Valid assistant message')).toBeInTheDocument();
      expect(screen.queryByText('Valid system message')).not.toBeInTheDocument(); // filtered in compact
    });

    it('should handle very long message content in all modes', () => {
      const longContent = 'A'.repeat(1000);
      const messages: Message[] = [
        createMessage('user', longContent),
        createMessage('system', longContent),
        createMessage('assistant', longContent),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'verbose'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should handle long content without crashing
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should maintain message order after filtering', () => {
      const messages: Message[] = [
        createMessage('user', 'First user message'),
        createMessage('system', 'System message (filtered)'),
        createMessage('assistant', 'Assistant message'),
        createMessage('tool', 'Tool message (filtered)'),
        createMessage('user', 'Second user message'),
      ];

      const props: AppProps = {
        initialState: createAppState(messages, 'compact'),
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Check that visible messages maintain their relative order
      const visibleMessages = screen.getAllByText(/user message|Assistant message/);
      expect(visibleMessages).toHaveLength(3); // 2 user + 1 assistant

      // The order should be: first user, assistant, second user
      expect(visibleMessages[0]).toHaveTextContent('First user message');
      expect(visibleMessages[1]).toHaveTextContent('Assistant message');
      expect(visibleMessages[2]).toHaveTextContent('Second user message');
    });
  });
});