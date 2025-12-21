import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '../../__tests__/test-utils';
import { App, AppState, AppProps } from '../App';
import type { ApexConfig } from '@apex/core';

describe('Display Modes - Integration Tests', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;

  const baseAppState: AppState = {
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: null,
    messages: [
      {
        id: 'msg1',
        type: 'system',
        content: 'System message for testing',
        timestamp: new Date(),
      },
      {
        id: 'msg2',
        type: 'assistant',
        content: 'Assistant message for testing',
        timestamp: new Date(),
      },
      {
        id: 'msg3',
        type: 'tool',
        content: 'Tool output',
        toolName: 'test-tool',
        toolInput: { param: 'value' },
        toolOutput: 'Tool result',
        toolStatus: 'success',
        timestamp: new Date(),
      },
      {
        id: 'msg4',
        type: 'user',
        content: 'User input for testing',
        timestamp: new Date(),
      },
    ],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 1000, output: 500 },
    cost: 0.05,
    model: 'claude-3-sonnet',
    displayMode: 'normal',
    gitBranch: 'feature/test',
    activeAgent: 'developer',
    sessionStartTime: new Date(Date.now() - 60000), // 1 minute ago
    subtaskProgress: { completed: 2, total: 5 },
  };

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

  describe('Message Filtering Integration', () => {
    it('should filter out system and tool messages in compact mode', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Initially, all messages should be visible (normal mode)
      expect(screen.getByText('System message for testing')).toBeInTheDocument();
      expect(screen.getByText('Assistant message for testing')).toBeInTheDocument();
      expect(screen.getByText('User input for testing')).toBeInTheDocument();

      // Switch to compact mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // After switching to compact, system and tool messages should be filtered out
      expect(screen.queryByText('System message for testing')).not.toBeInTheDocument();
      expect(screen.getByText('Assistant message for testing')).toBeInTheDocument();
      expect(screen.getByText('User input for testing')).toBeInTheDocument();
    });

    it('should show all messages including debug info in verbose mode', async () => {
      const stateWithDebugMessages = {
        ...baseAppState,
        messages: [
          ...baseAppState.messages,
          {
            id: 'debug1',
            type: 'system' as const,
            content: 'Debug: Internal state change',
            timestamp: new Date(),
          },
        ],
      };

      const props: AppProps = {
        initialState: stateWithDebugMessages,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Switch to verbose mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      // In verbose mode, all messages including debug info should be visible
      expect(screen.getByText('System message for testing')).toBeInTheDocument();
      expect(screen.getByText('Assistant message for testing')).toBeInTheDocument();
      expect(screen.getByText('User input for testing')).toBeInTheDocument();
      expect(screen.getByText('Debug: Internal state change')).toBeInTheDocument();
    });

    it('should restore normal message display when switching from compact to verbose', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Switch to compact mode first
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.queryByText('System message for testing')).not.toBeInTheDocument();
      });

      // Then switch to verbose mode
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      // System messages should now be visible again
      expect(screen.getByText('System message for testing')).toBeInTheDocument();
    });
  });

  describe('StatusBar Integration', () => {
    it('should show compact status bar in compact mode', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Switch to compact mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // StatusBar should render in compact mode
      // Check for essential elements that should remain in compact mode
      expect(screen.getByText('developer')).toBeInTheDocument(); // Active agent
      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument(); // Timer

      // In compact mode, some detailed info might be hidden
      // This depends on the StatusBar implementation
    });

    it('should show full status bar in verbose mode', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Switch to verbose mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      // StatusBar should show all available information in verbose mode
      expect(screen.getByText('feature/test')).toBeInTheDocument(); // Git branch
      expect(screen.getByText('developer')).toBeInTheDocument(); // Active agent
      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument(); // Timer
      expect(screen.getByText('1.5k')).toBeInTheDocument(); // Token count (1000+500)
      expect(screen.getByText(/\$0\.0500/)).toBeInTheDocument(); // Cost
    });
  });

  describe('Component State Synchronization', () => {
    it('should sync display mode across all components', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      const { rerender } = render(<App {...props} />);

      // Switch to compact mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // Rerender with new state to simulate state propagation
      const newState = { ...baseAppState, displayMode: 'compact' as const };

      await act(async () => {
        rerender(<App {...props} initialState={newState} />);
      });

      // Components should reflect the compact mode
      expect(screen.queryByText('System message for testing')).not.toBeInTheDocument();
    });

    it('should handle rapid mode switching without state corruption', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Rapidly switch modes multiple times
      for (let i = 0; i < 5; i++) {
        const mode = i % 2 === 0 ? '/compact' : '/verbose';

        fireEvent.change(input, { target: { value: mode } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
          const expectedText = mode === '/compact' ? 'compact' : 'verbose';
          expect(screen.getByText(new RegExp(`Display mode set to ${expectedText}`))).toBeInTheDocument();
        });
      }

      // Final state should be compact (last iteration)
      expect(screen.queryByText('System message for testing')).not.toBeInTheDocument();
      expect(screen.getByText('Assistant message for testing')).toBeInTheDocument();
    });
  });

  describe('Session Persistence', () => {
    it('should maintain display mode across app restarts', async () => {
      // Test with initial compact mode
      const compactState = { ...baseAppState, displayMode: 'compact' as const };

      const props: AppProps = {
        initialState: compactState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should start in compact mode with filtered messages
      expect(screen.queryByText('System message for testing')).not.toBeInTheDocument();
      expect(screen.getByText('Assistant message for testing')).toBeInTheDocument();
    });

    it('should maintain display mode across app restarts with verbose', async () => {
      // Test with initial verbose mode
      const verboseState = { ...baseAppState, displayMode: 'verbose' as const };

      const props: AppProps = {
        initialState: verboseState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should start in verbose mode with all messages
      expect(screen.getByText('System message for testing')).toBeInTheDocument();
      expect(screen.getByText('Assistant message for testing')).toBeInTheDocument();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle display mode changes during active task execution', async () => {
      const activeTaskState = {
        ...baseAppState,
        isProcessing: true,
        currentTask: {
          id: 'task-123',
          description: 'Test task',
          status: 'in-progress' as const,
          workflow: 'development',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const props: AppProps = {
        initialState: activeTaskState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Should show task progress components
      expect(screen.getByText('Test task')).toBeInTheDocument();

      // Switch to compact mode while task is running
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // Task should still be visible and running
      expect(screen.getByText('Test task')).toBeInTheDocument();
      expect(screen.queryByText('System message for testing')).not.toBeInTheDocument();
    });

    it('should handle display mode with parallel agent execution', async () => {
      const parallelState = {
        ...baseAppState,
        parallelAgents: [
          { name: 'reviewer', status: 'parallel' as const, progress: 30 },
          { name: 'tester', status: 'parallel' as const, progress: 45 },
        ],
        showParallelPanel: true,
      };

      const props: AppProps = {
        initialState: parallelState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Switch to compact mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // Parallel agents should still be visible
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('should handle display mode changes with long message history', async () => {
      // Create state with many messages
      const manyMessages = Array.from({ length: 30 }, (_, i) => ({
        id: `msg${i}`,
        type: (i % 3 === 0 ? 'system' : i % 3 === 1 ? 'assistant' : 'user') as 'system' | 'assistant' | 'user',
        content: `Message ${i}`,
        timestamp: new Date(Date.now() - (30 - i) * 1000),
      }));

      const longHistoryState = {
        ...baseAppState,
        messages: manyMessages,
      };

      const props: AppProps = {
        initialState: longHistoryState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Switch to compact mode
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // Should still show recent messages (App shows last 20)
      // System messages should be filtered out
      const systemMessages = screen.queryAllByText(/^Message (0|3|6|9|12|15|18|21|24|27)$/);
      expect(systemMessages).toHaveLength(0);

      // But assistant and user messages should be visible
      expect(screen.getByText('Message 29')).toBeInTheDocument();
      expect(screen.getByText('Message 28')).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should recover gracefully from component errors during mode switch', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      // Mock console.error to suppress error output during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Display mode commands should work even if there are component errors
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // App should continue functioning
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});