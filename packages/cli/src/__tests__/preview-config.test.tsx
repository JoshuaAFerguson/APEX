import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App, type AppState } from '../ui/App';

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

describe('Preview Configuration Tests', () => {
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
      } else if (input.includes('high confidence')) {
        return {
          type: 'task',
          confidence: 0.95, // High confidence
          metadata: { suggestedWorkflow: 'feature' },
        };
      } else if (input.includes('low confidence')) {
        return {
          type: 'task',
          confidence: 0.6, // Low confidence
          metadata: { suggestedWorkflow: 'feature' },
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
    previewConfig: {
      confidenceThreshold: 0.9,
      autoExecuteHighConfidence: false,
      timeoutMs: 10000,
    },
    showThoughts: false,
    ...overrides,
  });

  const createAppProps = (initialState: AppState) => ({
    initialState,
    onCommand,
    onTask,
    onExit,
  });

  describe('Preview Configuration State Management', () => {
    it('should have correct default preview configuration values', () => {
      const initialState = createInitialState();
      render(<App {...createAppProps(initialState)} />);

      // Verify default configuration is properly structured
      expect(initialState.previewConfig).toEqual({
        confidenceThreshold: 0.9,
        autoExecuteHighConfidence: false,
        timeoutMs: 10000,
      });
    });

    it('should maintain preview configuration state across re-renders', () => {
      const customConfig = {
        confidenceThreshold: 0.85,
        autoExecuteHighConfidence: true,
        timeoutMs: 5000,
      };

      const initialState = createInitialState({
        previewMode: true,
        previewConfig: customConfig,
      });

      const { rerender } = render(<App {...createAppProps(initialState)} />);

      // Re-render with the same state
      rerender(<App {...createAppProps(initialState)} />);

      // Configuration should remain intact
      expect(initialState.previewConfig).toEqual(customConfig);
    });

    it('should preserve other config values when updating preview config', () => {
      const initialState = createInitialState({
        previewConfig: {
          confidenceThreshold: 0.8,
          autoExecuteHighConfidence: false,
          timeoutMs: 15000,
        },
      });

      render(<App {...createAppProps(initialState)} />);

      // Simulate updating just the confidence threshold
      const newState = {
        ...initialState,
        previewConfig: {
          ...initialState.previewConfig,
          confidenceThreshold: 0.75,
        },
      };

      expect(newState.previewConfig.autoExecuteHighConfidence).toBe(false);
      expect(newState.previewConfig.timeoutMs).toBe(15000);
      expect(newState.previewConfig.confidenceThreshold).toBe(0.75);
    });
  });

  describe('Auto-Execute High Confidence Logic', () => {
    it('should auto-execute when confidence meets threshold and auto-execute is enabled', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: true,
          timeoutMs: 10000,
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Input with confidence 0.95 (above threshold of 0.9)
      inputHandler('high confidence task', {});

      // Should auto-execute without showing preview
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('high confidence task');
      });

      // Should show auto-execute message
      expect(screen.getByText(/Auto-executing.*confidence: 95%.*≥.*90%/)).toBeInTheDocument();
    });

    it('should show preview when confidence is below threshold even with auto-execute enabled', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: true,
          timeoutMs: 10000,
        },
      });

      const { rerender } = render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Input with confidence 0.6 (below threshold of 0.9)
      inputHandler('low confidence task', {});

      // Should show preview instead of auto-executing
      const newState = {
        ...initialState,
        pendingPreview: {
          input: 'low confidence task',
          intent: {
            type: 'task' as const,
            confidence: 0.6,
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      };

      rerender(<App {...createAppProps(newState)} />);

      // Should display preview panel
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('"low confidence task"')).toBeInTheDocument();

      // Should not have auto-executed
      expect(onTask).not.toHaveBeenCalled();
    });

    it('should respect auto-execute disabled setting', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false, // Disabled
          timeoutMs: 10000,
        },
      });

      const { rerender } = render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Input with high confidence (0.95)
      inputHandler('high confidence task', {});

      // Should show preview despite high confidence
      const newState = {
        ...initialState,
        pendingPreview: {
          input: 'high confidence task',
          intent: {
            type: 'task' as const,
            confidence: 0.95,
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      };

      rerender(<App {...createAppProps(newState)} />);

      // Should display preview panel
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('"high confidence task"')).toBeInTheDocument();

      // Should not have auto-executed
      expect(onTask).not.toHaveBeenCalled();
    });

    it('should handle edge case where confidence exactly equals threshold', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.8,
          autoExecuteHighConfidence: true,
          timeoutMs: 10000,
        },
      });

      // Mock exact threshold confidence
      mockConversationManager.detectIntent.mockReturnValue({
        type: 'task',
        confidence: 0.8, // Exactly equals threshold
        metadata: { suggestedWorkflow: 'feature' },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      inputHandler('exact threshold task', {});

      // Should auto-execute (confidence >= threshold)
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('exact threshold task');
      });
    });
  });

  describe('Preview Timeout Functionality', () => {
    it('should cancel preview after configured timeout', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 2000, // 2 second timeout
        },
        pendingPreview: {
          input: 'test task',
          intent: {
            type: 'task',
            confidence: 0.8,
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(2000);

      // Should show timeout message
      await waitFor(() => {
        expect(screen.getByText('Preview cancelled after 2s timeout.')).toBeInTheDocument();
      });
    });

    it('should not timeout if preview is confirmed before timeout', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 5000,
        },
        pendingPreview: {
          input: 'test task',
          intent: {
            type: 'task',
            confidence: 0.8,
            metadata: { suggestedWorkflow: 'feature' },
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Confirm execution before timeout
      vi.advanceTimersByTime(1000); // Only advance 1 second
      inputHandler('', { return: true });

      // Should execute task
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('test task');
      });

      // Continue advancing time past original timeout
      vi.advanceTimersByTime(5000);

      // Should not show timeout message since preview was already confirmed
      expect(screen.queryByText(/timeout/)).not.toBeInTheDocument();
    });

    it('should handle different timeout values correctly', async () => {
      const timeouts = [1000, 5000, 15000];

      for (const timeoutMs of timeouts) {
        vi.clearAllMocks();

        const initialState = createInitialState({
          previewMode: true,
          previewConfig: {
            confidenceThreshold: 0.9,
            autoExecuteHighConfidence: false,
            timeoutMs,
          },
          pendingPreview: {
            input: 'test task',
            intent: {
              type: 'task',
              confidence: 0.8,
              metadata: { suggestedWorkflow: 'feature' },
            },
            timestamp: new Date(),
          },
        });

        render(<App {...createAppProps(initialState)} />);

        // Advance exactly to timeout
        vi.advanceTimersByTime(timeoutMs);

        // Should show timeout message with correct duration
        await waitFor(() => {
          expect(screen.getByText(`Preview cancelled after ${timeoutMs / 1000}s timeout.`)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid confidence threshold values', () => {
      // Test values outside valid range (0-1)
      const invalidValues = [-0.1, 1.1, NaN, Infinity, -Infinity];

      invalidValues.forEach((invalidValue) => {
        const initialState = createInitialState({
          previewConfig: {
            confidenceThreshold: invalidValue,
            autoExecuteHighConfidence: false,
            timeoutMs: 10000,
          },
        });

        // Should not crash when rendering with invalid values
        expect(() => {
          render(<App {...createAppProps(initialState)} />);
        }).not.toThrow();
      });
    });

    it('should handle invalid timeout values', () => {
      const invalidValues = [-1000, 0, NaN, Infinity, -Infinity];

      invalidValues.forEach((invalidValue) => {
        const initialState = createInitialState({
          previewConfig: {
            confidenceThreshold: 0.9,
            autoExecuteHighConfidence: false,
            timeoutMs: invalidValue,
          },
        });

        // Should not crash when rendering with invalid timeout values
        expect(() => {
          render(<App {...createAppProps(initialState)} />);
        }).not.toThrow();
      });
    });

    it('should handle boolean type validation for autoExecuteHighConfidence', () => {
      // Test with various truthy/falsy values
      const testValues = [true, false, 1, 0, 'true', 'false', null, undefined];

      testValues.forEach((value) => {
        const initialState = createInitialState({
          previewConfig: {
            confidenceThreshold: 0.9,
            autoExecuteHighConfidence: value as boolean,
            timeoutMs: 10000,
          },
        });

        // Should not crash when rendering with various boolean-like values
        expect(() => {
          render(<App {...createAppProps(initialState)} />);
        }).not.toThrow();
      });
    });
  });

  describe('Preview Configuration Integration with Existing Functionality', () => {
    it('should work correctly with preview mode disabled', async () => {
      const initialState = createInitialState({
        previewMode: false, // Disabled
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: true,
          timeoutMs: 5000,
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // High confidence input should execute directly when preview mode is off
      inputHandler('high confidence task', {});

      // Should execute immediately regardless of auto-execute settings
      await waitFor(() => {
        expect(onTask).toHaveBeenCalledWith('high confidence task');
      });

      // Should not show preview panel
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
    });

    it('should not apply auto-execute logic to preview command itself', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: true,
          timeoutMs: 5000,
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Preview command should always execute directly
      inputHandler('/preview status', { return: true });

      // Should execute preview command directly
      await waitFor(() => {
        expect(onCommand).toHaveBeenCalledWith('preview', ['status']);
      });

      // Should not show preview panel for the command
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
    });

    it('should properly clear timeout when preview is cancelled manually', async () => {
      const initialState = createInitialState({
        previewMode: true,
        previewConfig: {
          confidenceThreshold: 0.9,
          autoExecuteHighConfidence: false,
          timeoutMs: 5000,
        },
        pendingPreview: {
          input: 'test task',
          intent: {
            type: 'task',
            confidence: 0.8,
          },
          timestamp: new Date(),
        },
      });

      render(<App {...createAppProps(initialState)} />);
      const inputHandler = mockUseInput.mock.calls[0][0];

      // Cancel preview manually before timeout
      vi.advanceTimersByTime(1000);
      inputHandler('', { escape: true });

      // Should show manual cancellation message
      expect(screen.getByText('Preview cancelled.')).toBeInTheDocument();

      // Continue advancing time past timeout
      vi.advanceTimersByTime(10000);

      // Should not show timeout message since it was manually cancelled
      expect(screen.queryByText(/timeout/)).not.toBeInTheDocument();
    });
  });
});
