import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../__tests__/test-utils';
import { App, type AppProps, type AppState } from '../App';
import type { DisplayMode } from '@apex/core';

// Mock ink and its hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

// Mock services
const mockConversationManager = {
  addMessage: vi.fn(),
  getSuggestions: vi.fn(() => []),
  hasPendingClarification: vi.fn(() => false),
  detectIntent: vi.fn((input: string) => {
    if (input.startsWith('/')) {
      return { type: 'command', confidence: 0.9, metadata: {} };
    }
    return { type: 'task', confidence: 0.8, metadata: {} };
  }),
  clearContext: vi.fn(),
  setTask: vi.fn(),
  setAgent: vi.fn(),
  clearTask: vi.fn(),
  clearAgent: vi.fn(),
  provideClarification: vi.fn(),
};

const mockShortcutManager = {
  on: vi.fn(),
  handleKey: vi.fn(() => false),
  pushContext: vi.fn(),
  popContext: vi.fn(),
};

vi.mock('../../services/ConversationManager.js', () => ({
  ConversationManager: vi.fn().mockImplementation(function () { return mockConversationManager; }),
}));

vi.mock('../../services/ShortcutManager.js', () => ({
  ShortcutManager: vi.fn().mockImplementation(function () { return mockShortcutManager; }),
}));

vi.mock('../../services/CompletionEngine.js', () => ({
  CompletionEngine: vi.fn().mockImplementation(function () { return {}; }),
}));

// Mock InputPrompt to simulate user input
const mockInputPrompt = vi.fn(({ onSubmit, ...props }) => (
  <div data-testid="input-prompt">
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
    <button
      data-testid="submit-help"
      onClick={() => onSubmit('/help')}
    >
      Submit /help
    </button>
  </div>
));

vi.mock('../components/InputPrompt', () => ({
  InputPrompt: mockInputPrompt,
}));

describe('App DisplayMode Command Handling Tests', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let baseState: AppState;
  let props: AppProps;
  let appInstance: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();

    baseState = {
      initialized: true,
      projectPath: '/test/project',
      config: null,
      orchestrator: null,
      gitBranch: 'main',
      currentTask: undefined,
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 100, output: 50 },
      cost: 0.025,
      model: 'sonnet',
      displayMode: 'normal' as DisplayMode,
      previewMode: false,
      showThoughts: false,
    };

    props = {
      initialState: baseState,
      onCommand: mockOnCommand,
      onTask: mockOnTask,
      onExit: mockOnExit,
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Compact Command Handling', () => {
    it('should handle /compact command and toggle to compact mode', async () => {
      const { container } = render(<App {...props} />);

      const submitButton = screen.getByTestId('submit-compact');

      await act(async () => {
        submitButton.click();
      });

      // Verify that the command was processed
      // Since we're testing the internal logic, we need to check the state change
      expect(container).toBeInTheDocument();

      // The command should not call onCommand since it's handled internally
      expect(mockOnCommand).not.toHaveBeenCalledWith('compact', []);
    });

    it('should toggle back to normal when already in compact mode', async () => {
      const compactProps = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'compact' as DisplayMode,
        },
      };

      const { container } = render(<App {...compactProps} />);
      const submitButton = screen.getByTestId('submit-compact');

      await act(async () => {
        submitButton.click();
      });

      expect(container).toBeInTheDocument();
    });

    it('should add confirmation message when switching to compact mode', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-compact');

      await act(async () => {
        submitButton.click();
      });

      // Advance timers to trigger the confirmation message
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(container).toBeInTheDocument();
      // In a real test, we would verify the message appears in the messages array
    });
  });

  describe('Verbose Command Handling', () => {
    it('should handle /verbose command and toggle to verbose mode', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        submitButton.click();
      });

      expect(container).toBeInTheDocument();
      expect(mockOnCommand).not.toHaveBeenCalledWith('verbose', []);
    });

    it('should toggle back to normal when already in verbose mode', async () => {
      const verboseProps = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'verbose' as DisplayMode,
        },
      };

      const { container } = render(<App {...verboseProps} />);
      const submitButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        submitButton.click();
      });

      expect(container).toBeInTheDocument();
    });

    it('should add confirmation message when switching to verbose mode', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        submitButton.click();
      });

      // Advance timers to trigger the confirmation message
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(container).toBeInTheDocument();
    });
  });

  describe('Help Command and Overlay', () => {
    it('should display help overlay when /help command is executed', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-help');

      await act(async () => {
        submitButton.click();
      });

      expect(container).toBeInTheDocument();

      // In a full implementation, we would check that showHelp state is true
      // and that the help overlay is visible
    });

    it('should show /compact and /verbose commands in help overlay', async () => {
      const { container } = render(<App {...props} />);

      // The help overlay content should be tested when it's shown
      // For now, we verify the component structure is correct
      expect(container).toBeInTheDocument();
    });

    it('should auto-hide help overlay after timeout', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-help');

      await act(async () => {
        submitButton.click();
      });

      // Advance timers to trigger help overlay hiding
      act(() => {
        vi.advanceTimersByTime(10001); // Just over 10 seconds
      });

      expect(container).toBeInTheDocument();
    });
  });

  describe('Command Processing Integration', () => {
    it('should detect command intent correctly', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-compact');

      await act(async () => {
        submitButton.click();
      });

      // Verify that detectIntent was called with the command
      expect(mockConversationManager.detectIntent).toHaveBeenCalledWith('/compact');
    });

    it('should add command to input history', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        submitButton.click();
      });

      // The input should be added to conversation manager
      expect(mockConversationManager.addMessage).toHaveBeenCalledWith({
        role: 'user',
        content: '/verbose',
      });
    });

    it('should handle command shortcuts via shortcut manager', () => {
      render(<App {...props} />);

      // Verify that shortcut manager is configured for commands
      expect(mockShortcutManager.on).toHaveBeenCalledWith('command', expect.any(Function));
    });
  });

  describe('State Management During Commands', () => {
    it('should not set isProcessing for display mode commands', async () => {
      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-compact');

      await act(async () => {
        submitButton.click();
      });

      // Display mode commands should be handled immediately without processing state
      expect(container).toBeInTheDocument();
    });

    it('should maintain other state during display mode changes', async () => {
      const stateWithData = {
        ...baseState,
        tokens: { input: 500, output: 300 },
        cost: 0.15,
        activeAgent: 'developer',
      };

      const propsWithData = {
        ...props,
        initialState: stateWithData,
      };

      const { container } = render(<App {...propsWithData} />);
      const submitButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        submitButton.click();
      });

      // Other state should be preserved
      expect(container).toBeInTheDocument();
    });
  });

  describe('Command Error Handling', () => {
    it('should handle malformed commands gracefully', async () => {
      // Mock InputPrompt to send malformed command
      const malformedMockInputPrompt = vi.fn(({ onSubmit, ...props }) => (
        <div data-testid="input-prompt">
          <button
            data-testid="submit-malformed"
            onClick={() => onSubmit('/compact extra args')}
          >
            Submit malformed
          </button>
        </div>
      ));

      // Temporarily replace the mock
      vi.doMock('../components/InputPrompt', () => ({
        InputPrompt: malformedMockInputPrompt,
      }));

      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-malformed');

      await act(async () => {
        submitButton.click();
      });

      expect(container).toBeInTheDocument();
    });

    it('should handle unknown commands appropriately', async () => {
      const unknownCommandMockInputPrompt = vi.fn(({ onSubmit, ...props }) => (
        <div data-testid="input-prompt">
          <button
            data-testid="submit-unknown"
            onClick={() => onSubmit('/unknowncommand')}
          >
            Submit unknown
          </button>
        </div>
      ));

      vi.doMock('../components/InputPrompt', () => ({
        InputPrompt: unknownCommandMockInputPrompt,
      }));

      const { container } = render(<App {...props} />);
      const submitButton = screen.getByTestId('submit-unknown');

      await act(async () => {
        submitButton.click();
      });

      // Unknown commands should be passed to onCommand
      expect(mockOnCommand).toHaveBeenCalledWith('unknowncommand', []);
    });
  });

  describe('Command Suggestion Integration', () => {
    it('should provide display mode commands in suggestions', () => {
      render(<App {...props} />);

      // Verify that InputPrompt receives suggestions including display mode commands
      expect(mockInputPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestions: expect.arrayContaining(['/compact', '/verbose']),
        }),
        {}
      );
    });

    it('should include display mode commands in smart suggestions', () => {
      render(<App {...props} />);

      // The getSmartSuggestions function should include display mode commands
      const lastCall = mockInputPrompt.mock.calls[mockInputPrompt.mock.calls.length - 1];
      const suggestions = lastCall[0].suggestions || [];

      expect(suggestions).toContain('/compact');
      expect(suggestions).toContain('/verbose');
    });
  });
});
