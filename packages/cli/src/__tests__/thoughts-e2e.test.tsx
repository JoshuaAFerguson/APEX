/**
 * End-to-end integration test for showThoughts feature
 * Tests complete workflow from command input to state changes and UI updates
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock ink hooks
const { mockUseInput, mockUseApp } = vi.hoisted(() => ({
  mockUseInput: vi.fn(),
  mockUseApp: vi.fn(() => ({ exit: vi.fn() })),
}));

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

// Mock UI components to track state propagation
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({ onSubmit, disabled }: { onSubmit: (input: string) => void; disabled: boolean }) => (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <button data-testid="submit-thoughts" onClick={() => onSubmit('/thoughts')}>
        Submit /thoughts
      </button>
      <button data-testid="submit-help" onClick={() => onSubmit('/help')}>
        Submit /help
      </button>
      <button data-testid="submit-status" onClick={() => onSubmit('/status')}>
        Submit /status
      </button>
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content, type }: { content: string; type: string }) => (
    <div data-testid="response-stream" data-type={type}>{content}</div>
  ),
  StatusBar: ({ showThoughts }: { showThoughts?: boolean }) => (
    <div data-testid="status-bar" data-show-thoughts={showThoughts?.toString()} />
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
}));

describe('Thoughts Feature End-to-End', () => {
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

  describe('Complete Feature Workflow', () => {
    it('should handle complete toggle workflow with state propagation', async () => {
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

      // Initial state - should be false
      let statusBar = screen.getByTestId('status-bar');
      expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');

      // Execute /thoughts command to enable
      const thoughtsButton = screen.getByTestId('submit-thoughts');

      await act(async () => {
        thoughtsButton.click();
      });

      // Wait for state update and confirmation message
      await waitFor(() => {
        statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');

        const responseStreams = screen.getAllByTestId('response-stream');
        const enabledMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility enabled')
        );
        expect(enabledMessage).toBeTruthy();
      });

      // Execute /thoughts command again to disable
      await act(async () => {
        thoughtsButton.click();
      });

      // Wait for state update and confirmation message
      await waitFor(() => {
        statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');

        const responseStreams = screen.getAllByTestId('response-stream');
        const disabledMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility disabled')
        );
        expect(disabledMessage).toBeTruthy();
      });
    });

    it('should work with /help command to show current status', async () => {
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

      // Check help shows disabled status initially
      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available commands:') &&
          stream.textContent?.includes('currently disabled')
        );
        expect(helpMessage).toBeTruthy();
      });

      // Enable thoughts
      const thoughtsButton = screen.getByTestId('submit-thoughts');
      await act(async () => {
        thoughtsButton.click();
      });

      // Check help now shows enabled status
      await act(async () => {
        helpButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available commands:') &&
          stream.textContent?.includes('currently enabled')
        );
        expect(helpMessage).toBeTruthy();
      });
    });

    it('should work with /status command to show current configuration', async () => {
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

      // Check status shows current configuration
      const statusButton = screen.getByTestId('submit-status');
      await act(async () => {
        statusButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const statusMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility is currently enabled')
        );
        expect(statusMessage).toBeTruthy();
      });
    });

    it('should maintain state consistency across multiple operations', async () => {
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
      const helpButton = screen.getByTestId('submit-help');
      const statusButton = screen.getByTestId('submit-status');

      // Multiple operations in sequence
      // 1. Enable thoughts
      await act(async () => {
        thoughtsButton.click();
      });

      // 2. Check help
      await act(async () => {
        helpButton.click();
      });

      // 3. Check status
      await act(async () => {
        statusButton.click();
      });

      // 4. Disable thoughts
      await act(async () => {
        thoughtsButton.click();
      });

      // 5. Final status check
      await act(async () => {
        statusButton.click();
      });

      // Verify final state is correct
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');

        const responseStreams = screen.getAllByTestId('response-stream');
        const finalStatusMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility is currently disabled')
        );
        expect(finalStatusMessage).toBeTruthy();
      });
    });

    it('should not interfere with external command handling', async () => {
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

      // Execute /thoughts command
      const thoughtsButton = screen.getByTestId('submit-thoughts');
      await act(async () => {
        thoughtsButton.click();
      });

      // Ensure external command handler was not called for built-in commands
      expect(mockOnCommand).not.toHaveBeenCalledWith('thoughts', []);
      expect(mockOnCommand).not.toHaveBeenCalledWith('help', []);
      expect(mockOnCommand).not.toHaveBeenCalledWith('status', []);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle rapid consecutive toggles correctly', async () => {
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

      // Rapid fire toggles
      await act(async () => {
        thoughtsButton.click(); // false -> true
        thoughtsButton.click(); // true -> false
        thoughtsButton.click(); // false -> true
      });

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');
      });
    });

    it('should work correctly when app is in processing state', async () => {
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

      const thoughtsButton = screen.getByTestId('submit-thoughts');
      await act(async () => {
        thoughtsButton.click();
      });

      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');

        const responseStreams = screen.getAllByTestId('response-stream');
        const enabledMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility enabled')
        );
        expect(enabledMessage).toBeTruthy();
      });
    });
  });
});
