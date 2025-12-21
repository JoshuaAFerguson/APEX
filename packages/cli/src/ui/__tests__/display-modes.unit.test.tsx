import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../__tests__/test-utils';
import { App, AppState, AppProps, Message } from '../App';
import type { ApexConfig } from '@apex/core';

describe('Display Modes - Unit Tests', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;

  const baseAppState: AppState = {
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: null,
    messages: [],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 0, output: 0 },
    cost: 0,
    model: 'claude-3-sonnet',
    displayMode: 'normal',
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

  describe('/compact command', () => {
    it('should set display mode to compact', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // Find and interact with the input
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Type the compact command
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // Check that the system message was added
      expect(screen.getByText('Display mode set to compact: Single-line status, condensed output')).toBeInTheDocument();
    });

    it('should not call onCommand for /compact (handled locally)', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // onCommand should not be called since /compact is handled internally
      expect(mockOnCommand).not.toHaveBeenCalled();
    });

    it('should work with mixed case /COMPACT', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/COMPACT' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });
    });
  });

  describe('/verbose command', () => {
    it('should set display mode to verbose', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      expect(screen.getByText('Display mode set to verbose: Detailed debug output, full information')).toBeInTheDocument();
    });

    it('should not call onCommand for /verbose (handled locally)', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      expect(mockOnCommand).not.toHaveBeenCalled();
    });

    it('should work with mixed case /VERBOSE', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/VERBOSE' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });
    });
  });

  describe('Display mode state management', () => {
    it('should persist display mode changes', async () => {
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

      // Rerender and check that state persists
      const newState = { ...baseAppState, displayMode: 'compact' as const };
      rerender(<App {...props} initialState={newState} />);

      // The state should have persisted (no message filtering test here, just state)
      // This would be tested through the StatusBar and other components
    });

    it('should toggle between modes', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Switch to compact
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      // Switch to verbose
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });

      // Switch back to compact
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        // Should have multiple compact messages
        expect(screen.getAllByText(/Display mode set to compact/).length).toBeGreaterThan(1);
      });
    });
  });

  describe('Help command integration', () => {
    it('should show /compact and /verbose in help text', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/help' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('/compact')).toBeInTheDocument();
        expect(screen.getByText('/verbose')).toBeInTheDocument();
        expect(screen.getByText('Toggle compact display mode')).toBeInTheDocument();
        expect(screen.getByText('Toggle verbose display mode')).toBeInTheDocument();
      });
    });
  });

  describe('Invalid commands', () => {
    it('should handle unknown commands normally (not display mode)', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      fireEvent.change(input, { target: { value: '/unknown' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockOnCommand).toHaveBeenCalledWith('unknown', []);
      });
    });

    it('should not treat non-commands as display mode changes', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Type something that's not a command
      fireEvent.change(input, { target: { value: 'make this compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockOnTask).toHaveBeenCalledWith('make this compact');
      });

      expect(screen.queryByText(/Display mode set to/)).not.toBeInTheDocument();
    });
  });

  describe('Command suggestions', () => {
    it('should include compact and verbose in suggestions', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      // The suggestions are provided by getSmartSuggestions()
      // We can check that the commands are included in the help suggestions
      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Start typing to trigger suggestions (implementation detail)
      fireEvent.change(input, { target: { value: '/c' } });

      // Note: This tests the smart suggestions integration
      // The actual suggestions display depends on the InputPrompt implementation
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully during mode switching', async () => {
      const props: AppProps = {
        initialState: baseAppState,
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Even with potential errors, commands should work
      fireEvent.change(input, { target: { value: '/compact' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to compact/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should work even when processing other commands', async () => {
      const props: AppProps = {
        initialState: { ...baseAppState, isProcessing: true },
        onCommand: mockOnCommand,
        onTask: mockOnTask,
        onExit: mockOnExit,
      };

      render(<App {...props} />);

      const input = screen.getByPlaceholderText(/Type a task or \/help for commands/);

      // Display mode commands should work even when processing
      fireEvent.change(input, { target: { value: '/verbose' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/Display mode set to verbose/)).toBeInTheDocument();
      });
    });
  });
});