/**
 * Tests for help overlay integration with display mode commands
 * Validates that /compact and /verbose commands appear in help and work correctly
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
    Text: ({ children, color }: { children: React.ReactNode; color?: string }) =>
      <span data-color={color}>{children}</span>,
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

// Mock UI components
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({ onSubmit, disabled }: { onSubmit: (input: string) => void; disabled: boolean }) => (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <button
        data-testid="submit-help"
        onClick={() => onSubmit('/help')}
      >
        Submit /help
      </button>
      <button
        data-testid="submit-compact"
        onClick={() => onSubmit('/compact')}
      >
        Submit /compact
      </button>
      <button
        data-testid="submit-verbose"
        onClick={() => onSubmit('/verbose')}
      >
        Submit /verbose
      </button>
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

describe('Display Mode Help Overlay Integration', () => {
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

  describe('Help Overlay Display', () => {
    it('should show help overlay with display mode commands when /help is executed', async () => {
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

      // Execute /help command
      const helpButton = screen.getByTestId('submit-help');

      await act(async () => {
        helpButton.click();
      });

      // Should display help content with compact and verbose commands
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.getAttribute('data-type') === 'system' &&
          stream.textContent?.includes('Available Commands')
        );

        expect(helpMessage).toBeTruthy();

        // Should contain display mode commands
        expect(helpMessage?.textContent).toMatch(/\/compact.*Toggle compact display mode/i);
        expect(helpMessage?.textContent).toMatch(/\/verbose.*Toggle verbose display mode/i);
      });
    });

    it('should include proper descriptions for display mode commands in help', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.getAttribute('data-type') === 'system' &&
          stream.textContent?.includes('Available Commands')
        );

        if (helpMessage?.textContent) {
          // Check for compact command description
          expect(helpMessage.textContent).toMatch(
            /\/compact.*(?:Toggle|Switch to).*compact.*(?:display|mode)/i
          );

          // Check for verbose command description
          expect(helpMessage.textContent).toMatch(
            /\/verbose.*(?:Toggle|Switch to).*verbose.*(?:display|mode)/i
          );

          // Ensure descriptions explain what the modes do
          expect(helpMessage.textContent).toMatch(/compact.*(?:minimal|condensed|single-line)/i);
          expect(helpMessage.textContent).toMatch(/verbose.*(?:detailed|debug|full)/i);
        }
      });
    });

    it('should format display mode commands with proper colors in help overlay', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      await waitFor(() => {
        // Look for colored text elements in help output
        const coloredElements = screen.getAllByRole('generic').filter(el =>
          el.getAttribute('data-color') === 'yellow' &&
          (el.textContent?.includes('/compact') || el.textContent?.includes('/verbose'))
        );

        // Should have at least command names in yellow
        expect(coloredElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Help Overlay Integration with Display Mode Changes', () => {
    it('should show help overlay in current display mode context', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      // Help should be displayed appropriately for compact mode
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');

        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available Commands')
        );
        expect(helpMessage).toBeTruthy();
      });
    });

    it('should allow switching display modes after showing help', async () => {
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

      // Show help first
      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      // Then switch to compact mode
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Mode should have changed successfully
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });

      // Should show compact mode confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const compactMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Display mode set to compact')
        );
        expect(compactMessage).toBeTruthy();
      });
    });
  });

  describe('Help Command vs Display Mode Commands', () => {
    it('should not interfere between /help and display mode commands', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      const compactButton = screen.getByTestId('submit-compact');
      const verboseButton = screen.getByTestId('submit-verbose');

      // Execute commands in sequence
      await act(async () => {
        helpButton.click();
      });

      await act(async () => {
        compactButton.click();
      });

      await act(async () => {
        helpButton.click();
      });

      await act(async () => {
        verboseButton.click();
      });

      // Should end up in verbose mode
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'verbose');
      });

      // Should have multiple system messages (help + mode changes)
      const responseStreams = screen.getAllByTestId('response-stream');
      const systemMessages = responseStreams.filter(stream =>
        stream.getAttribute('data-type') === 'system'
      );

      expect(systemMessages.length).toBeGreaterThanOrEqual(4); // 2 help + 2 mode changes
    });

    it('should handle rapid help and display mode command execution', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      const compactButton = screen.getByTestId('submit-compact');
      const verboseButton = screen.getByTestId('submit-verbose');

      // Rapid execution
      await act(async () => {
        helpButton.click();
        compactButton.click();
        helpButton.click();
        verboseButton.click();
        compactButton.click();
      });

      // Should handle all commands without errors
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });

      // Should have multiple system messages
      const responseStreams = screen.getAllByTestId('response-stream');
      const systemMessages = responseStreams.filter(stream =>
        stream.getAttribute('data-type') === 'system'
      );

      expect(systemMessages.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Help Overlay Accessibility', () => {
    it('should provide accessible help content structure', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available Commands')
        );

        if (helpMessage?.textContent) {
          // Help should have clear structure
          expect(helpMessage.textContent).toMatch(/Available Commands/);
          expect(helpMessage.textContent).toMatch(/\/\w+/); // Command patterns

          // Commands should be clearly separated
          const commandCount = (helpMessage.textContent.match(/\/\w+/g) || []).length;
          expect(commandCount).toBeGreaterThanOrEqual(2); // At least /compact and /verbose
        }
      });
    });

    it('should include display mode commands in help regardless of current mode', async () => {
      const modes = ['normal', 'compact', 'verbose'] as const;

      for (const mode of modes) {
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

        const helpButton = screen.getByTestId('submit-help');
        await act(async () => {
          helpButton.click();
        });

        await waitFor(() => {
          const responseStreams = screen.getAllByTestId('response-stream');
          const helpMessage = responseStreams.find(stream =>
            stream.textContent?.includes('Available Commands')
          );

          // Should always include both commands regardless of current mode
          expect(helpMessage?.textContent).toMatch(/\/compact/);
          expect(helpMessage?.textContent).toMatch(/\/verbose/);
        });

        unmount();
      }
    });
  });

  describe('Error Handling in Help Overlay', () => {
    it('should handle help display gracefully when in invalid display mode', async () => {
      const invalidState = { ...initialState, displayMode: 'invalid' as any };

      expect(() => {
        render(
          <ThemeProvider>
            <App
              initialState={invalidState}
              onCommand={mockOnCommand}
              onTask={mockOnTask}
              onExit={mockOnExit}
            />
          </ThemeProvider>
        );
      }).not.toThrow();

      const helpButton = screen.getByTestId('submit-help');

      expect(async () => {
        await act(async () => {
          helpButton.click();
        });
      }).not.toThrow();
    });

    it('should show help even when processing other commands', async () => {
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

      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      // Help should still be displayed even when processing
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available Commands')
        );
        expect(helpMessage).toBeTruthy();
      });
    });
  });
});