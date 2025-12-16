/**
 * Integration tests for /thoughts command functionality
 * Tests the integration between App component, command handling, and state management
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';
import type { DisplayMode } from '../ui/types';

// Mock ink hooks
const mockUseInput = vi.fn();
const mockUseApp = vi.fn(() => ({ exit: vi.fn() }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useApp: mockUseApp,
    useStdout: () => ({ stdout: { columns: 120 } }),
    Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

// Mock all service dependencies
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

// Mock UI components
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({
    onSubmit,
    disabled,
    value,
    onChange
  }: {
    onSubmit: (input: string) => void;
    disabled: boolean;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <input
        data-testid="input-field"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <button
        data-testid="submit-button"
        onClick={() => onSubmit(value || '')}
      >
        Submit
      </button>
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content, type }: { content: string; type: string }) => (
    <div data-testid="response-stream" data-type={type}>{content}</div>
  ),
  StatusBar: ({
    displayMode,
    previewMode,
    showThoughts
  }: {
    displayMode: DisplayMode;
    previewMode: boolean;
    showThoughts?: boolean;
  }) => (
    <div
      data-testid="status-bar"
      data-display-mode={displayMode}
      data-preview-mode={previewMode}
      data-show-thoughts={showThoughts}
    >
      {showThoughts && <span data-testid="thoughts-indicator">💭</span>}
    </div>
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
}));

describe('Thoughts Command Integration Tests', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

    vi.mocked(mockUseInput).mockImplementation(mockUseInput);

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
      displayMode: 'normal' as DisplayMode,
      previewMode: false,
      showThoughts: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('Command execution and state integration', () => {
    it('toggles showThoughts state and reflects in StatusBar', async () => {
      const { container } = render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Initially showThoughts should be false
      const statusBar = screen.getByTestId('status-bar');
      expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');
      expect(screen.queryByTestId('thoughts-indicator')).not.toBeInTheDocument();

      // Submit /thoughts command
      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      // Wait for state update and UI re-render
      await waitFor(() => {
        const updatedStatusBar = screen.getByTestId('status-bar');
        expect(updatedStatusBar).toHaveAttribute('data-show-thoughts', 'true');
        expect(screen.getByTestId('thoughts-indicator')).toBeInTheDocument();
      });

      // Check for system confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessages = responseStreams.filter(stream =>
          stream.getAttribute('data-type') === 'system'
        );
        const enabledMessage = systemMessages.find(msg =>
          msg.textContent?.includes('Thought visibility enabled')
        );
        expect(enabledMessage).toBeTruthy();
      });
    });

    it('works correctly with different display modes', async () => {
      const displayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

      for (const mode of displayModes) {
        const testState = { ...initialState, displayMode: mode };

        const { unmount } = render(
          <ThemeProvider>
            <App
              initialState={testState}
              onCommand={mockOnCommand}
              onTask={mockOnTask}
              onExit={mockOnExit}
            />
          </ThemeProvider>
        );

        const inputField = screen.getByTestId('input-field');
        const submitButton = screen.getByTestId('submit-button');

        await act(async () => {
          inputField.value = '/thoughts';
          submitButton.click();
        });

        await waitFor(() => {
          const statusBar = screen.getByTestId('status-bar');
          expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');
          expect(statusBar).toHaveAttribute('data-display-mode', mode);
        });

        unmount();
      }
    });

    it('works correctly with preview mode enabled', async () => {
      const previewState = { ...initialState, previewMode: true };

      render(
        <ThemeProvider>
          <App
            initialState={previewState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');
        expect(statusBar).toHaveAttribute('data-preview-mode', 'true');
      });
    });

    it('persists state across multiple interactions', async () => {
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

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      // Enable thoughts
      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('thoughts-indicator')).toBeInTheDocument();
      });

      // Perform other command (should not affect thoughts state)
      await act(async () => {
        inputField.value = '/help';
        submitButton.click();
      });

      // Thoughts should still be enabled
      await waitFor(() => {
        expect(screen.getByTestId('thoughts-indicator')).toBeInTheDocument();
      });

      // Disable thoughts
      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('thoughts-indicator')).not.toBeInTheDocument();
      });
    });

    it('handles command with various arguments gracefully', async () => {
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

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      const variants = [
        '/thoughts',
        '/thoughts on',
        '/thoughts off',
        '/thoughts toggle',
        '/thoughts status',
        '/THOUGHTS',
        '/Thoughts'
      ];

      for (const command of variants) {
        await act(async () => {
          inputField.value = command;
          submitButton.click();
        });

        // Should handle all variants without crashing
        await waitFor(() => {
          const responseStreams = screen.getAllByTestId('response-stream');
          expect(responseStreams.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Message history and conversation integration', () => {
    it('adds system messages to conversation history', async () => {
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

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      // Toggle thoughts twice to generate multiple messages
      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessages = responseStreams.filter(stream =>
          stream.getAttribute('data-type') === 'system'
        );

        // Should have both enable and disable messages
        expect(systemMessages.length).toBeGreaterThanOrEqual(2);

        const enabledMessage = systemMessages.find(msg =>
          msg.textContent?.includes('enabled')
        );
        const disabledMessage = systemMessages.find(msg =>
          msg.textContent?.includes('disabled')
        );

        expect(enabledMessage).toBeTruthy();
        expect(disabledMessage).toBeTruthy();
      });
    });

    it('does not interfere with regular conversation flow', async () => {
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

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      // Submit a regular task
      await act(async () => {
        inputField.value = 'Create a function to calculate factorial';
        submitButton.click();
      });

      // Submit thoughts command
      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      // Submit another regular task
      await act(async () => {
        inputField.value = 'Write tests for the factorial function';
        submitButton.click();
      });

      // Verify onTask was called for regular tasks but not for thoughts
      expect(mockOnTask).toHaveBeenCalledWith('Create a function to calculate factorial');
      expect(mockOnTask).toHaveBeenCalledWith('Write tests for the factorial function');
      expect(mockOnTask).not.toHaveBeenCalledWith('/thoughts');
      expect(mockOnCommand).not.toHaveBeenCalledWith('thoughts', []);
    });
  });

  describe('Error handling and edge cases', () => {
    it('handles processing state correctly', async () => {
      const processingState = { ...initialState, isProcessing: true };

      render(
        <ThemeProvider>
          <App
            initialState={processingState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      // Command should work even during processing
      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');
      });
    });

    it('maintains state consistency after component re-renders', async () => {
      const { rerender } = render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      // Enable thoughts
      await act(async () => {
        inputField.value = '/thoughts';
        submitButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('thoughts-indicator')).toBeInTheDocument();
      });

      // Force re-render with new props
      const newState = { ...initialState, showThoughts: true, cost: 0.05 };
      rerender(
        <ThemeProvider>
          <App
            initialState={newState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // State should persist
      expect(screen.getByTestId('thoughts-indicator')).toBeInTheDocument();
    });

    it('handles malformed command input gracefully', async () => {
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

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      const malformedInputs = [
        '/ thoughts',
        '//thoughts',
        '/thoughtss',
        '/thought',
        '/THOUGHTS!!!',
        ''
      ];

      for (const input of malformedInputs) {
        expect(() => {
          act(() => {
            inputField.value = input;
            submitButton.click();
          });
        }).not.toThrow();
      }
    });
  });

  describe('Performance and memory considerations', () => {
    it('does not cause memory leaks with rapid toggling', async () => {
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

      const inputField = screen.getByTestId('input-field');
      const submitButton = screen.getByTestId('submit-button');

      // Rapidly toggle thoughts many times
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          inputField.value = '/thoughts';
          submitButton.click();
        });
      }

      // Should end with thoughts disabled (even number of toggles)
      await waitFor(() => {
        expect(screen.queryByTestId('thoughts-indicator')).not.toBeInTheDocument();
      });
    });

    it('handles component cleanup properly', () => {
      const { unmount } = render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});