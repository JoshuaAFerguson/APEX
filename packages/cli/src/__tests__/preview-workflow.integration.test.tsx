import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../ui/App';
import type { AppState } from '../ui/App';

// Mock dependencies
const mockOrchestrator = {
  on: vi.fn(),
  off: vi.fn(),
  executeTask: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn().mockResolvedValue({ id: 'test-task' }),
  initialize: vi.fn(),
  listTasks: vi.fn().mockResolvedValue([]),
  cancelTask: vi.fn(),
  updateTaskStatus: vi.fn(),
};

const mockSessionStore = {
  initialize: vi.fn(),
  getActiveSessionId: vi.fn(),
  setActiveSession: vi.fn(),
  saveSession: vi.fn(),
  loadSession: vi.fn(),
};

const mockSessionAutoSaver = {
  start: vi.fn(),
  stop: vi.fn(),
  save: vi.fn(),
  addMessage: vi.fn(),
  updateState: vi.fn(),
  getSession: vi.fn().mockReturnValue({
    id: 'test-session',
    messages: [],
    state: { totalCost: 0, totalTokens: { input: 0, output: 0 } },
  }),
};

const mockConversationManager = {
  addMessage: vi.fn(),
  detectIntent: vi.fn(),
  getSuggestions: vi.fn().mockReturnValue([]),
  hasPendingClarification: vi.fn().mockReturnValue(false),
  clearContext: vi.fn(),
  setTask: vi.fn(),
  setAgent: vi.fn(),
  clearTask: vi.fn(),
  clearAgent: vi.fn(),
};

// Mock Ink hooks
vi.mock('ink', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
  Text: ({ children, color }: { children: React.ReactNode; color?: string }) =>
    <span data-testid="text" style={{ color }}>{children}</span>,
  useInput: vi.fn(),
  useApp: () => ({ exit: vi.fn() }),
  useStdout: () => ({ stdout: { columns: 80, rows: 24 } }),
  useFocusManager: () => ({
    focusNext: vi.fn(),
    focusPrevious: vi.fn(),
    focus: vi.fn(),
  }),
}));

vi.mock('../services/ConversationManager', () => ({
  ConversationManager: vi.fn(function () { return mockConversationManager; }),
}));

vi.mock('../services/ShortcutManager', () => ({
  ShortcutManager: vi.fn(function () { return ({
    on: vi.fn(),
    handleKey: vi.fn(),
    pushContext: vi.fn(),
    popContext: vi.fn(),
  }); }),
}));

vi.mock('../services/CompletionEngine', () => ({
  CompletionEngine: vi.fn(function () { return ({
    getSuggestions: vi.fn().mockReturnValue([]),
  }); }),
}));

describe('Preview Workflow Integration Tests', () => {
  let mockUseInput: ReturnType<typeof vi.fn>;
  let onCommand: ReturnType<typeof vi.fn>;
  let onTask: ReturnType<typeof vi.fn>;
  let onExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseInput = vi.fn();
    onCommand = vi.fn();
    onTask = vi.fn();
    onExit = vi.fn();

    // Setup default intent detection behavior
    mockConversationManager.detectIntent.mockImplementation((input: string) => {
      if (input.startsWith('/')) {
        const command = input.slice(1).split(' ')[0];
        const args = input.slice(1).split(' ').slice(1);
        return {
          type: 'command',
          confidence: 0.95,
          metadata: { command, args },
        };
      } else if (input.includes('?') || input.toLowerCase().startsWith('how') ||
                 input.toLowerCase().startsWith('what') || input.toLowerCase().startsWith('why')) {
        return {
          type: 'question',
          confidence: 0.85,
        };
      } else {
        return {
          type: 'task',
          confidence: 0.8,
          metadata: { suggestedWorkflow: 'feature' },
        };
      }
    });

    vi.mocked(require('ink').useInput).mockImplementation(mockUseInput);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createInitialState = (overrides: Partial<AppState> = {}): AppState => ({
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
    ...overrides,
  });

  const createAppProps = (initialState: AppState) => ({
    initialState,
    onCommand,
    onTask,
    onExit,
  });

  describe('Preview Mode Activation', () => {
    it('should activate preview mode via /preview command', async () => {
      const initialState = createInitialState();
      render(<App {...createAppProps(initialState)} />);

      // Get the input handler function
      expect(mockUseInput).toHaveBeenCalled();
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate /preview command
      inputHandler('/preview', { return: true });

      // Should call onCommand with preview command
      await waitFor(() => {
        expect(onCommand).toHaveBeenCalledWith('preview', []);
      });
    });

    it('should toggle preview mode with repeated /preview commands', async () => {
      const initialState = createInitialState({ previewMode: false });
      render(<App {...createAppProps(initialState)} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // First toggle - enable
      inputHandler('/preview', { return: true });
      await waitFor(() => {
        expect(onCommand).toHaveBeenCalledWith('preview', []);
      });

      // Second toggle - disable
      inputHandler('/preview', { return: true });
      await waitFor(() => {
        expect(onCommand).toHaveBeenCalledTimes(2);
      });
    });

    it('should show preview mode with specific arguments', async () => {
      const initialState = createInitialState();
      render(<App {...createAppProps(initialState)} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Test different preview command variations
      const commands = [
        '/preview on',
        '/preview off',
        '/preview status',
        '/preview toggle',
      ];

      for (const command of commands) {
        const [cmd, ...args] = command.slice(1).split(' ');
        inputHandler(command, { return: true });
        await waitFor(() => {
          expect(onCommand).toHaveBeenCalledWith(cmd, args);
        });
      }
    });
  });

  describe('Preview Panel Display Logic', () => {
    it('should show preview panel for task input when preview mode is enabled', async () => {
      const initialState = createInitialState({ previewMode: true });
      const { rerender } = render(<App {...createAppProps(initialState)} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate task input
      inputHandler('create a login form', {});

      // Update state to show pending preview
      const newState = {
        ...initialState,
        pendingPreview: {
          input: 'create a login form',
          intent: {
            type: 'task' as const,
            confidence: 0.8,
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      };

      rerender(<App {...createAppProps(newState)} />);

      // Should display preview panel
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('"create a login form"')).toBeInTheDocument();
    });

    it('should not show preview panel when preview mode is disabled', async () => {
      const initialState = createInitialState({ previewMode: false });
      render(<App {...createAppProps(initialState)} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate task input
      inputHandler('create a login form', {});

      // Should proceed directly to execution without preview
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('create a login form');
      });

      // Should not show preview panel
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
    });

    it('should bypass preview for /preview command itself', async () => {
      const initialState = createInitialState({ previewMode: true });
      render(<App {...createAppProps(initialState)} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // /preview command should not trigger preview panel
      inputHandler('/preview', { return: true });

      // Should execute directly
      await waitFor(() => {
        expect(onCommand).toHaveBeenCalledWith('preview', []);
      });

      // Should not show preview panel for the command itself
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
    });
  });

  describe('Preview Panel Interactions', () => {
    it('should confirm execution on Enter key', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'create a component',
          intent: {
            type: 'task',
            confidence: 0.8,
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Enter key press in preview mode
      inputHandler('', { return: true });

      // Should execute the pending task
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('create a component');
      });
    });

    it('should cancel preview on Escape key', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'create a component',
          intent: {
            type: 'task',
            confidence: 0.8,
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate Escape key press in preview mode
      inputHandler('', { escape: true });

      // Should not execute the task
      expect(onTask).not.toHaveBeenCalled();

      // Should show cancellation message in messages
      expect(screen.getByText('Preview cancelled.')).toBeInTheDocument();
    });

    it('should enter edit mode on e key', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'create a component',
          intent: {
            type: 'task',
            confidence: 0.8,
          },
          timestamp: new Date(),
        },
      });

      const { rerender } = render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate 'e' key press in preview mode
      inputHandler('e', {});

      // Should set edit mode input
      const newState = {
        ...initialState,
        pendingPreview: undefined,
        editModeInput: 'create a component',
      };

      rerender(<App {...createAppProps(newState)} />);

      // Should show edit mode message
      expect(screen.getByText('Returning to edit mode...')).toBeInTheDocument();
    });

    it('should ignore other keys in preview mode', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'create a component',
          intent: {
            type: 'task',
            confidence: 0.8,
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate other key presses
      const testKeys = ['a', 'b', 'space', 'tab'];
      for (const key of testKeys) {
        inputHandler(key, {});
      }

      // Should not execute any tasks
      expect(onTask).not.toHaveBeenCalled();
      expect(onCommand).not.toHaveBeenCalled();
    });
  });

  describe('Intent Display Integration', () => {
    it('should display command intent correctly in preview', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: '/status task123',
          intent: {
            type: 'command',
            confidence: 0.95,
            command: 'status',
            args: ['task123'],
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);

      // Should show command intent details
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('Execute command: /status task123')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should display task intent with workflow information', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'create a user dashboard',
          intent: {
            type: 'task',
            confidence: 0.85,
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);

      // Should show task intent with workflow
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should display question intent appropriately', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'How do I implement authentication?',
          intent: {
            type: 'question',
            confidence: 0.9,
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);

      // Should show question intent
      expect(screen.getByText('Question Intent')).toBeInTheDocument();
      expect(screen.getByText('Answer question')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('State Management Integration', () => {
    it('should maintain preview mode state across multiple inputs', async () => {
      const initialState = createInitialState({ previewMode: true });
      let currentState = initialState;

      const { rerender } = render(<App {...createAppProps(currentState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // First input
      inputHandler('first task', {});

      // Show first preview
      currentState = {
        ...currentState,
        pendingPreview: {
          input: 'first task',
          intent: { type: 'task', confidence: 0.8 },
          timestamp: new Date(),
        },
      };
      rerender(<App {...createAppProps(currentState)} />);

      // Cancel first preview
      inputHandler('', { escape: true });
      currentState = {
        ...currentState,
        pendingPreview: undefined,
        messages: [
          ...currentState.messages,
          {
            id: 'msg1',
            type: 'system',
            content: 'Preview cancelled.',
            timestamp: new Date(),
          },
        ],
      };
      rerender(<App {...createAppProps(currentState)} />);

      // Second input - preview mode should still be active
      inputHandler('second task', {});

      // Should show second preview
      currentState = {
        ...currentState,
        pendingPreview: {
          input: 'second task',
          intent: { type: 'task', confidence: 0.8 },
          timestamp: new Date(),
        },
      };
      rerender(<App {...createAppProps(currentState)} />);

      expect(screen.getByText('"second task"')).toBeInTheDocument();
    });

    it('should handle rapid input changes in preview mode', async () => {
      const initialState = createInitialState({ previewMode: true });
      let currentState = initialState;

      const { rerender } = render(<App {...createAppProps(currentState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate rapid typing
      const inputs = ['c', 'cr', 'cre', 'creat', 'create', 'create task'];

      for (const input of inputs) {
        inputHandler(input, {});

        // Update state with latest input
        currentState = {
          ...currentState,
          pendingPreview: {
            input,
            intent: { type: 'task', confidence: 0.7 },
            timestamp: new Date(),
          },
        };
        rerender(<App {...createAppProps(currentState)} />);

        // Advance timers to handle any debouncing
        vi.advanceTimersByTime(50);
      }

      // Final state should show the last input
      expect(screen.getByText('"create task"')).toBeInTheDocument();
    });

    it('should clear preview state after successful execution', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'create a form',
          intent: { type: 'task', confidence: 0.8 },
          timestamp: new Date(),
        },
      });

      const { rerender } = render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Confirm execution
      inputHandler('', { return: true });

      // Update state to clear preview
      const newState = {
        ...initialState,
        pendingPreview: undefined,
        isProcessing: true,
      };
      rerender(<App {...createAppProps(newState)} />);

      // Should not show preview panel
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();

      // Should have executed the task
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('create a form');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle intent detection failures gracefully', async () => {
      // Mock intent detection to throw an error
      mockConversationManager.detectIntent.mockImplementation(() => {
        throw new Error('Intent detection failed');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const initialState = createInitialState({ previewMode: true });
      render(<App {...createAppProps(initialState)} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Should not crash on intent detection error
      expect(() => {
        inputHandler('some input', {});
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle empty preview state gracefully', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: undefined, // No pending preview
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Should not crash when trying to interact with non-existent preview
      expect(() => {
        inputHandler('', { return: true });
        inputHandler('', { escape: true });
        inputHandler('e', {});
      }).not.toThrow();
    });

    it('should handle malformed preview data', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'test',
          intent: null as any, // Invalid intent
          timestamp: new Date(),
        },
      });

      // Should render without crashing
      expect(() => {
        render(<App {...createAppProps(initialState)} />);
      }).not.toThrow();
    });

    it('should handle component unmount during preview', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'test task',
          intent: { type: 'task', confidence: 0.8 },
          timestamp: new Date(),
        },
      });

      const { unmount } = render(<App {...createAppProps(initialState)} />);

      // Start an operation
      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('', { return: true });

      // Unmount component
      expect(() => {
        unmount();
      }).not.toThrow();

      // Advance timers to ensure no memory leaks
      vi.advanceTimersByTime(1000);
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide clear visual feedback for preview mode status', async () => {
      const enabledState = createInitialState({ previewMode: true });
      const { rerender } = render(<App {...createAppProps(enabledState)} />);

      // When preview mode is enabled, status bar should indicate it
      expect(screen.getByText('[on]')).toBeInTheDocument();

      const disabledState = createInitialState({ previewMode: false });
      rerender(<App {...createAppProps(disabledState)} />);

      // When disabled, should not show the indicator or show [off]
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
    });

    it('should maintain keyboard accessibility in preview mode', async () => {
      const initialState = createInitialState({
        previewMode: true,
        pendingPreview: {
          input: 'test input',
          intent: { type: 'task', confidence: 0.8 },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);

      // All interactive elements should be accessible
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should provide meaningful status updates during preview workflow', async () => {
      const initialState = createInitialState({ previewMode: true });
      let currentState = initialState;

      const { rerender } = render(<App {...createAppProps(currentState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Enter input to trigger preview
      inputHandler('create something', {});

      // Show preview
      currentState = {
        ...currentState,
        pendingPreview: {
          input: 'create something',
          intent: { type: 'task', confidence: 0.8 },
          timestamp: new Date(),
        },
      };
      rerender(<App {...createAppProps(currentState)} />);

      // Should show clear intent information
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();

      // Cancel preview
      inputHandler('', { escape: true });

      currentState = {
        ...currentState,
        pendingPreview: undefined,
        messages: [
          {
            id: 'msg1',
            type: 'system',
            content: 'Preview cancelled.',
            timestamp: new Date(),
          },
        ],
      };
      rerender(<App {...createAppProps(currentState)} />);

      // Should show cancellation feedback
      expect(screen.getByText('Preview cancelled.')).toBeInTheDocument();
    });
  });
});
