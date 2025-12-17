/**
 * Tests for display mode command parsing and error handling
 * Validates handling of malformed commands, extra arguments, and edge cases
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock ink hooks
const mockUseInput = vi.fn();
const mockUseApp = vi.fn(() => ({ exit: vi.fn() }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useApp: mockUseApp,
    Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

// Mock services
vi.mock('../services/ConversationManager', () => ({
  ConversationManager: class MockConversationManager {
    addMessage = vi.fn();
    clearContext = vi.fn();
    getSuggestions = vi.fn(() => []);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.8 }));
    hasPendingClarification = vi.fn(() => false);
    provideClarification = vi.fn();
  },
}));

vi.mock('../services/ShortcutManager', () => ({
  ShortcutManager: class MockShortcutManager {
    on = vi.fn();
    pushContext = vi.fn();
    popContext = vi.fn();
    handleKey = vi.fn(() => false);
  },
}));

vi.mock('../services/CompletionEngine', () => ({
  CompletionEngine: class MockCompletionEngine {
    getCompletions = vi.fn(() => []);
    updateContext = vi.fn();
  },
}));

// Mock UI components to simulate command input
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({ onSubmit, disabled }: { onSubmit: (input: string) => void; disabled: boolean }) => (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <input
        data-testid="command-input"
        placeholder="Enter command"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const input = (e.target as HTMLInputElement).value;
            onSubmit(input);
          }
        }}
      />
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content, type }: { content: string; type: string }) => (
    <div data-testid="response-stream" data-type={type}>{content}</div>
  ),
  StatusBar: ({ displayMode, previewMode }: { displayMode: string; previewMode: boolean }) => (
    <div data-testid="status-bar" data-display-mode={displayMode} data-preview-mode={previewMode} />
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
}));

describe('Display Mode Command Parsing Error Handling', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

    initialState = {
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
      previewMode: false,
      showThoughts: false,
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper function to simulate command input
  const submitCommand = async (command: string) => {
    const input = screen.getByTestId('command-input');
    await act(async () => {
      (input as HTMLInputElement).value = command;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
  };

  describe('Commands with Extra Arguments', () => {
    it('should handle /compact with extra arguments', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/compact extra args');

      // Should still switch to compact mode (ignoring extra args)
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });

      // Should show confirmation message without error
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const compactMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Display mode set to compact')
        );
        expect(compactMessage).toBeTruthy();
      });
    });

    it('should handle /verbose with flags and options', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/verbose --debug --level=max');

      // Should still switch to verbose mode (ignoring flags)
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'verbose');
      });

      // Should show confirmation message without error
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const verboseMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Display mode set to verbose')
        );
        expect(verboseMessage).toBeTruthy();
      });
    });

    it('should handle commands with numeric arguments', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/compact 123 456');

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });
  });

  describe('Case Sensitivity and Whitespace', () => {
    it('should handle uppercase commands', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/COMPACT');

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });

    it('should handle mixed case commands', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/Verbose');

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'verbose');
      });
    });

    it('should handle commands with leading/trailing whitespace', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('  /compact  ');

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });

    it('should handle commands with internal whitespace', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/compact   extra   spaces');

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });
  });

  describe('Invalid Commands and Typos', () => {
    it('should handle typos in display mode commands gracefully', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Typo: /compac instead of /compact
      await submitCommand('/compac');

      // Should not change display mode
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
      });

      // Should pass through to external command handler for unknown commands
      expect(mockOnCommand).toHaveBeenCalledWith('compac', []);
    });

    it('should handle similar command names', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const similarCommands = [
        '/compacts',
        '/verbosity',
        '/compact-mode',
        '/verbose-debug',
      ];

      for (const command of similarCommands) {
        await submitCommand(command);

        // Should not change display mode
        await waitFor(() => {
          const statusBar = screen.getByTestId('status-bar');
          expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
        });
      }

      // All should be passed to external handler
      expect(mockOnCommand).toHaveBeenCalledTimes(similarCommands.length);
    });

    it('should handle empty slash command', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/');

      // Should not change display mode
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
      });

      // Should handle gracefully (might be passed to external handler)
    });
  });

  describe('Special Characters and Unicode', () => {
    it('should handle commands with special characters', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/compact@#$%');

      // Should not match as display mode command
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
      });

      expect(mockOnCommand).toHaveBeenCalledWith('compact@#$%', []);
    });

    it('should handle unicode characters in command arguments', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/compact 🚀 ñ ü');

      // Should still work (ignoring unicode args)
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });
  });

  describe('Command Parsing Edge Cases', () => {
    it('should handle multiple slashes', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('//compact');

      // Should not match display mode pattern
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
      });

      expect(mockOnCommand).toHaveBeenCalledWith('/compact', []);
    });

    it('should handle slash in middle of command', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('comp/act');

      // Should not match any command pattern
      expect(mockOnCommand).not.toHaveBeenCalled();
    });

    it('should handle very long command strings', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const longArgs = 'a'.repeat(1000);
      await submitCommand(`/compact ${longArgs}`);

      // Should still work with very long arguments
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });

    it('should handle null and undefined inputs gracefully', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Test with empty string
      await submitCommand('');

      // Should not cause errors or state changes
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
      });

      expect(mockOnCommand).not.toHaveBeenCalled();
    });
  });

  describe('State Consistency During Invalid Commands', () => {
    it('should maintain current display mode when invalid commands are entered', async () => {
      // Start with compact mode
      const compactState = { ...initialState, displayMode: 'compact' as const };

      render(
        <ThemeProvider>
          <App
            initialState={compactState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Try various invalid commands
      const invalidCommands = [
        '/invalid',
        '/compact-wrong',
        '/compac',
        '//compact',
        '/compact@',
      ];

      for (const command of invalidCommands) {
        await submitCommand(command);

        // Display mode should remain compact throughout
        await waitFor(() => {
          const statusBar = screen.getByTestId('status-bar');
          expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
        });
      }
    });

    it('should not affect other app state during command parsing errors', async () => {
      const stateWithData = {
        ...initialState,
        messages: [
          { id: '1', type: 'user' as const, content: 'Test message', timestamp: new Date() },
        ],
        tokens: { input: 100, output: 200 },
        cost: 0.05,
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithData}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      await submitCommand('/invalid-command');

      // Other state should remain unchanged
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const userMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Test message')
        );
        expect(userMessage).toBeTruthy();
      });
    });
  });

  describe('Command Processing Performance', () => {
    it('should handle rapid invalid command submission without performance degradation', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const startTime = Date.now();

      // Rapidly submit many invalid commands
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(submitCommand(`/invalid${i}`));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds for 50 commands)
      expect(duration).toBeLessThan(5000);

      // State should still be normal
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'normal');
      });
    });

    it('should handle mixed valid and invalid commands efficiently', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const commands = [
        '/compact',      // valid
        '/invalid1',     // invalid
        '/verbose',      // valid
        '/invalid2',     // invalid
        '/compact',      // valid
        '/typo',         // invalid
      ];

      for (const command of commands) {
        await submitCommand(command);
      }

      // Should end up in compact mode (last valid command)
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });

      // Invalid commands should have been passed to external handler
      expect(mockOnCommand).toHaveBeenCalledWith('invalid1', []);
      expect(mockOnCommand).toHaveBeenCalledWith('invalid2', []);
      expect(mockOnCommand).toHaveBeenCalledWith('typo', []);
    });
  });
});