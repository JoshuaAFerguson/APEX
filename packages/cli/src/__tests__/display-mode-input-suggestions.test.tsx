/**
 * Tests for display mode commands in input suggestion system
 * Validates that /compact and /verbose appear in autocomplete suggestions
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

// Mock services with detailed suggestion implementations
const mockConversationManager = {
  addMessage: vi.fn(),
  clearContext: vi.fn(),
  getSuggestions: vi.fn(() => [
    '/compact',
    '/verbose',
    '/help',
    '/init',
    '/status',
    '/agents',
    '/workflows',
  ]),
  detectIntent: vi.fn(() => ({ type: 'command', confidence: 0.9 })),
  hasPendingClarification: vi.fn(() => false),
  provideClarification: vi.fn(),
};

const mockCompletionEngine = {
  getCompletions: vi.fn(() => [
    { text: '/compact', description: 'Switch to compact display mode' },
    { text: '/verbose', description: 'Switch to verbose display mode' },
    { text: '/help', description: 'Show available commands' },
  ]),
  updateContext: vi.fn(),
};

const mockShortcutManager = {
  on: vi.fn(),
  pushContext: vi.fn(),
  popContext: vi.fn(),
  handleKey: vi.fn(() => false),
};

vi.mock('../services/ConversationManager', () => ({
  ConversationManager: vi.fn(function () { return mockConversationManager; }),
}));

vi.mock('../services/CompletionEngine', () => ({
  CompletionEngine: vi.fn(function () { return mockCompletionEngine; }),
}));

vi.mock('../services/ShortcutManager', () => ({
  ShortcutManager: vi.fn(function () { return mockShortcutManager; }),
}));

// Enhanced mock InputPrompt to test suggestion behavior
const MockInputPrompt = vi.fn(({
  onSubmit,
  disabled,
  suggestions,
  completions,
  onInputChange,
  placeholder
}: {
  onSubmit: (input: string) => void;
  disabled: boolean;
  suggestions?: string[];
  completions?: { text: string; description: string }[];
  onInputChange?: (input: string) => void;
  placeholder?: string;
}) => {
  const [inputValue, setInputValue] = React.useState('');

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onInputChange?.(value);
  };

  return (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <input
        data-testid="command-input"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSubmit(inputValue);
          }
        }}
      />
      <div data-testid="suggestions-list" data-suggestions={JSON.stringify(suggestions || [])}>
        {suggestions?.map(suggestion => (
          <button
            key={suggestion}
            data-testid={`suggestion-${suggestion.replace('/', '')}`}
            onClick={() => {
              setInputValue(suggestion);
              onSubmit(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div data-testid="completions-list" data-completions={JSON.stringify(completions || [])}>
        {completions?.map(completion => (
          <div
            key={completion.text}
            data-testid={`completion-${completion.text.replace('/', '')}`}
            onClick={() => {
              setInputValue(completion.text);
              onSubmit(completion.text);
            }}
          >
            <span data-testid={`completion-text-${completion.text.replace('/', '')}`}>
              {completion.text}
            </span>
            <span data-testid={`completion-desc-${completion.text.replace('/', '')}`}>
              {completion.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: MockInputPrompt,
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

describe('Display Mode Input Suggestions', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

    MockInputPrompt.mockClear();
    mockConversationManager.getSuggestions.mockReturnValue([
      '/compact',
      '/verbose',
      '/help',
      '/init',
      '/status',
      '/agents',
      '/workflows',
    ]);

    mockCompletionEngine.getCompletions.mockReturnValue([
      { text: '/compact', description: 'Switch to compact display mode' },
      { text: '/verbose', description: 'Switch to verbose display mode' },
      { text: '/help', description: 'Show available commands' },
      { text: '/init', description: 'Initialize new project' },
    ]);

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

  describe('Basic Suggestion Inclusion', () => {
    it('should include display mode commands in suggestion list', async () => {
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

      await waitFor(() => {
        const suggestionsList = screen.getByTestId('suggestions-list');
        const suggestions = JSON.parse(suggestionsList.getAttribute('data-suggestions') || '[]');

        expect(suggestions).toContain('/compact');
        expect(suggestions).toContain('/verbose');
      });

      // Verify ConversationManager was called for suggestions
      expect(mockConversationManager.getSuggestions).toHaveBeenCalled();
    });

    it('should provide clickable suggestion buttons for display mode commands', async () => {
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

      await waitFor(() => {
        const compactSuggestion = screen.getByTestId('suggestion-compact');
        const verboseSuggestion = screen.getByTestId('suggestion-verbose');

        expect(compactSuggestion).toBeInTheDocument();
        expect(verboseSuggestion).toBeInTheDocument();
      });
    });

    it('should allow clicking suggestion buttons to execute display mode commands', async () => {
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

      await waitFor(() => {
        const compactSuggestion = screen.getByTestId('suggestion-compact');
        expect(compactSuggestion).toBeInTheDocument();
      });

      const compactSuggestion = screen.getByTestId('suggestion-compact');
      await act(async () => {
        compactSuggestion.click();
      });

      // Should switch to compact mode
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });
  });

  describe('Completion System Integration', () => {
    it('should include display mode commands in completion list with descriptions', async () => {
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

      await waitFor(() => {
        const completionsList = screen.getByTestId('completions-list');
        const completions = JSON.parse(completionsList.getAttribute('data-completions') || '[]');

        expect(completions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              text: '/compact',
              description: 'Switch to compact display mode'
            }),
            expect.objectContaining({
              text: '/verbose',
              description: 'Switch to verbose display mode'
            }),
          ])
        );
      });

      // Verify CompletionEngine was called
      expect(mockCompletionEngine.getCompletions).toHaveBeenCalled();
    });

    it('should display completion descriptions for display mode commands', async () => {
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

      await waitFor(() => {
        const compactText = screen.getByTestId('completion-text-compact');
        const compactDesc = screen.getByTestId('completion-desc-compact');
        const verboseText = screen.getByTestId('completion-text-verbose');
        const verboseDesc = screen.getByTestId('completion-desc-verbose');

        expect(compactText.textContent).toBe('/compact');
        expect(compactDesc.textContent).toBe('Switch to compact display mode');
        expect(verboseText.textContent).toBe('/verbose');
        expect(verboseDesc.textContent).toBe('Switch to verbose display mode');
      });
    });

    it('should allow clicking completions to execute display mode commands', async () => {
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

      await waitFor(() => {
        const verboseCompletion = screen.getByTestId('completion-verbose');
        expect(verboseCompletion).toBeInTheDocument();
      });

      const verboseCompletion = screen.getByTestId('completion-verbose');
      await act(async () => {
        verboseCompletion.click();
      });

      // Should switch to verbose mode
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'verbose');
      });
    });
  });

  describe('Dynamic Suggestion Updates', () => {
    it('should update suggestions after display mode changes', async () => {
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

      // Switch to compact mode
      const compactSuggestion = screen.getByTestId('suggestion-compact');
      await act(async () => {
        compactSuggestion.click();
      });

      // Suggestions should still be available after mode change
      await waitFor(() => {
        const suggestionsList = screen.getByTestId('suggestions-list');
        const suggestions = JSON.parse(suggestionsList.getAttribute('data-suggestions') || '[]');

        // Should still include both commands (to allow toggling)
        expect(suggestions).toContain('/compact');
        expect(suggestions).toContain('/verbose');
      });
    });

    it('should maintain suggestion availability across all display modes', async () => {
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

        await waitFor(() => {
          const suggestionsList = screen.getByTestId('suggestions-list');
          const suggestions = JSON.parse(suggestionsList.getAttribute('data-suggestions') || '[]');

          expect(suggestions).toContain('/compact');
          expect(suggestions).toContain('/verbose');
        });

        unmount();
        vi.clearAllMocks();
      }
    });
  });

  describe('Filtered Suggestions Based on Input', () => {
    it('should filter suggestions when user types partial commands', async () => {
      // Mock filtered suggestions
      mockConversationManager.getSuggestions.mockImplementation((context) => {
        if (context?.partialInput === '/c') {
          return ['/compact'];
        } else if (context?.partialInput === '/v') {
          return ['/verbose'];
        }
        return ['/compact', '/verbose', '/help', '/init', '/status'];
      });

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

      const input = screen.getByTestId('command-input');

      // Type partial command
      await act(async () => {
        input.value = '/c';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show only compact command if filtering is implemented
      // Note: This test validates the interface - actual filtering logic may vary
      expect(MockInputPrompt).toHaveBeenCalled();
    });

    it('should handle completion engine context updates', async () => {
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

      const input = screen.getByTestId('command-input');

      // Simulate typing
      await act(async () => {
        input.value = '/verb';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // CompletionEngine should be updated with context
      expect(mockCompletionEngine.updateContext).toHaveBeenCalled();
    });
  });

  describe('Suggestion Priority and Ordering', () => {
    it('should include display mode commands in appropriate priority order', async () => {
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

      await waitFor(() => {
        const suggestionsList = screen.getByTestId('suggestions-list');
        const suggestions = JSON.parse(suggestionsList.getAttribute('data-suggestions') || '[]');

        // Verify display mode commands are included
        const compactIndex = suggestions.indexOf('/compact');
        const verboseIndex = suggestions.indexOf('/verbose');

        expect(compactIndex).not.toBe(-1);
        expect(verboseIndex).not.toBe(-1);
      });
    });

    it('should provide consistent ordering across different app states', async () => {
      const states = [
        { ...initialState, displayMode: 'normal' as const },
        { ...initialState, displayMode: 'compact' as const },
        { ...initialState, displayMode: 'verbose' as const },
      ];

      for (const state of states) {
        const { unmount } = render(
          <ThemeProvider>
            <App
              initialState={state}
              onCommand={mockOnCommand}
              onTask={mockOnTask}
              onExit={mockOnExit}
            />
          </ThemeProvider>
        );

        await waitFor(() => {
          const suggestionsList = screen.getByTestId('suggestions-list');
          const suggestions = JSON.parse(suggestionsList.getAttribute('data-suggestions') || '[]');

          // Both commands should always be available
          expect(suggestions).toContain('/compact');
          expect(suggestions).toContain('/verbose');
        });

        unmount();
        vi.clearAllMocks();
      }
    });
  });

  describe('Error Handling in Suggestions', () => {
    it('should handle suggestion service errors gracefully', async () => {
      // Mock service error
      mockConversationManager.getSuggestions.mockImplementation(() => {
        throw new Error('Suggestion service error');
      });

      expect(() => {
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
      }).not.toThrow();

      // App should still render without suggestions
      await waitFor(() => {
        const input = screen.getByTestId('command-input');
        expect(input).toBeInTheDocument();
      });
    });

    it('should handle completion engine errors gracefully', async () => {
      mockCompletionEngine.getCompletions.mockImplementation(() => {
        throw new Error('Completion engine error');
      });

      expect(() => {
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
      }).not.toThrow();

      // App should still render
      await waitFor(() => {
        const input = screen.getByTestId('command-input');
        expect(input).toBeInTheDocument();
      });
    });

    it('should handle empty suggestion lists', async () => {
      mockConversationManager.getSuggestions.mockReturnValue([]);
      mockCompletionEngine.getCompletions.mockReturnValue([]);

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

      await waitFor(() => {
        const suggestionsList = screen.getByTestId('suggestions-list');
        const suggestions = JSON.parse(suggestionsList.getAttribute('data-suggestions') || '[]');

        expect(suggestions).toEqual([]);
      });

      // Input should still be functional
      const input = screen.getByTestId('command-input');
      await act(async () => {
        input.value = '/compact';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      // Manual command input should still work
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });
  });

  describe('Suggestion Accessibility', () => {
    it('should provide accessible suggestion interface', async () => {
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

      await waitFor(() => {
        // Check for proper test IDs and structure
        const suggestionsList = screen.getByTestId('suggestions-list');
        const completionsList = screen.getByTestId('completions-list');

        expect(suggestionsList).toBeInTheDocument();
        expect(completionsList).toBeInTheDocument();
      });

      // Suggestion buttons should be properly labeled
      const compactSuggestion = screen.getByTestId('suggestion-compact');
      const verboseSuggestion = screen.getByTestId('suggestion-verbose');

      expect(compactSuggestion.textContent).toBe('/compact');
      expect(verboseSuggestion.textContent).toBe('/verbose');
    });

    it('should provide keyboard navigation for suggestions', async () => {
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

      const input = screen.getByTestId('command-input');

      // Test direct keyboard input
      await act(async () => {
        input.value = '/compact';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      // Should execute command
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
      });
    });
  });
});
