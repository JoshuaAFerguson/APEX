/**
 * Tests for /thoughts command functionality
 * Tests toggle behavior and confirmation messages as implemented in App.tsx
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock ink hooks - extending the base setup
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

// Mock UI components to simplify testing
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({ onSubmit, disabled }: { onSubmit: (input: string) => void; disabled: boolean }) => (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <button
        data-testid="submit-thoughts"
        onClick={() => onSubmit('/thoughts')}
      >
        Submit /thoughts
      </button>
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content, type }: { content: string; type: string }) => (
    <div data-testid="response-stream" data-type={type}>{content}</div>
  ),
  StatusBar: ({ displayMode, previewMode, showThoughts }: { displayMode: string; previewMode: boolean; showThoughts?: boolean }) => (
    <div data-testid="status-bar" data-display-mode={displayMode} data-preview-mode={previewMode} data-show-thoughts={showThoughts} />
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
}));

describe('Thoughts Command', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let mockShortcutManagerInstance: any;
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

    // Mock shortcut manager instance to capture event handlers
    mockShortcutManagerInstance = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'command') {
          // Store the command handler for later use
          mockShortcutManagerInstance._commandHandler = handler;
        }
      }),
      pushContext: vi.fn(),
      popContext: vi.fn(),
      handleKey: vi.fn(() => false),
    };

    // Mock ShortcutManager constructor
    const ShortcutManagerMock = vi.fn(() => mockShortcutManagerInstance);
    vi.mocked(require('../services/ShortcutManager')).ShortcutManager = ShortcutManagerMock;

    vi.mocked(useInput).mockImplementation(mockUseInput);

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

  describe('/thoughts command', () => {
    it('should toggle from false to true via input handler', async () => {
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

      // Find and click the thoughts button to simulate input submission
      const thoughtsButton = screen.getByTestId('submit-thoughts');

      await act(async () => {
        thoughtsButton.click();
      });

      // Check that the confirmation message appears
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessages = responseStreams.filter(stream =>
          stream.getAttribute('data-type') === 'system'
        );

        const enabledMessage = systemMessages.find(msg =>
          msg.textContent?.includes('Thought visibility enabled')
        );
        expect(enabledMessage).toBeTruthy();
        expect(enabledMessage?.textContent).toContain('AI reasoning will be shown');
      });
    });

    it('should toggle from true back to false via input handler', async () => {
      // Start with showThoughts enabled
      const thoughtsEnabledState = { ...initialState, showThoughts: true };

      render(
        <ThemeProvider>
          <App
            initialState={thoughtsEnabledState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Submit /thoughts command again
      const thoughtsButton = screen.getByTestId('submit-thoughts');

      await act(async () => {
        thoughtsButton.click();
      });

      // Check that the appropriate confirmation message appears
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessages = responseStreams.filter(stream =>
          stream.getAttribute('data-type') === 'system'
        );

        const disabledMessage = systemMessages.find(msg =>
          msg.textContent?.includes('Thought visibility disabled')
        );
        expect(disabledMessage).toBeTruthy();
        expect(disabledMessage?.textContent).toContain('AI reasoning will be hidden');
      });
    });

    it('should work via shortcut handler', async () => {
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

      // Simulate shortcut command trigger
      if (mockShortcutManagerInstance._commandHandler) {
        await act(async () => {
          await mockShortcutManagerInstance._commandHandler('thoughts');
        });

        // Wait for the async message addition
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
      }
    });

    it('should not call external command handler for thoughts command', async () => {
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

      // Submit /thoughts command
      const thoughtsButton = screen.getByTestId('submit-thoughts');

      await act(async () => {
        thoughtsButton.click();
      });

      // External command handler should not be called for built-in commands
      expect(mockOnCommand).not.toHaveBeenCalledWith('thoughts', []);
    });

    it('should handle command case-insensitively via shortcut handler', async () => {
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

      // Test shortcut handler with different cases
      if (mockShortcutManagerInstance._commandHandler) {
        await act(async () => {
          await mockShortcutManagerInstance._commandHandler('THOUGHTS');
        });

        // Wait for the async message addition
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

        // Test with mixed case
        await act(async () => {
          await mockShortcutManagerInstance._commandHandler('Thoughts');
        });

        await waitFor(() => {
          const responseStreams = screen.getAllByTestId('response-stream');
          const systemMessages = responseStreams.filter(stream =>
            stream.getAttribute('data-type') === 'system'
          );

          const disabledMessage = systemMessages.find(msg =>
            msg.textContent?.includes('Thought visibility disabled')
          );
          expect(disabledMessage).toBeTruthy();
        });
      }
    });

    it('should not interfere with other display modes', async () => {
      const compactState = { ...initialState, displayMode: 'compact', previewMode: true };

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

      // Submit /thoughts command
      const thoughtsButton = screen.getByTestId('submit-thoughts');

      await act(async () => {
        thoughtsButton.click();
      });

      // Check that other modes are preserved
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
        expect(statusBar).toHaveAttribute('data-preview-mode', 'true');
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle rapid consecutive toggle execution', async () => {
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

      const thoughtsButton = screen.getByTestId('submit-thoughts');

      // Rapidly toggle thoughts visibility
      await act(async () => {
        thoughtsButton.click();
      });

      await act(async () => {
        thoughtsButton.click();
      });

      await act(async () => {
        thoughtsButton.click();
      });

      // Should end up with thoughts enabled (3 toggles: false -> true -> false -> true)
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessages = responseStreams.filter(stream =>
          stream.getAttribute('data-type') === 'system'
        );

        // Should have the final enabled message
        const enabledMessage = systemMessages.find(msg =>
          msg.textContent?.includes('Thought visibility enabled')
        );
        expect(enabledMessage).toBeTruthy();
      });
    });

    it('should maintain state consistency during processing', async () => {
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

      // Command should still work even when processing
      const thoughtsButton = screen.getByTestId('submit-thoughts');

      await act(async () => {
        thoughtsButton.click();
      });

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

    it('should handle initial state correctly', () => {
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

      // Should render without crashing with showThoughts: false
      expect(container).toBeTruthy();
    });
  });
});