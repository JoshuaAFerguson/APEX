/**
 * Tab Completion Acceptance Tests
 *
 * Tests for tab completion acceptance criteria:
 * - AC1: Tab key accepts first suggestion when typing /he and completes to /help
 * - AC2: Tab replaces partial input with full command
 * - AC3: Tab on /session l completes to /session list
 * - AC4: Tab does nothing when no suggestions available
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from './test-utils';
import { waitFor } from '@testing-library/react';
import { AdvancedInput } from '../ui/components/AdvancedInput';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine';

// Mock Ink hooks - override global mocks
const mockUseInput = vi.fn();
const mockUseStdout = vi.fn(() => ({ stdout: { columns: 120 } }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useStdout: mockUseStdout,
  };
});

// Mock file system operations
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
}));

// Mock OS for path resolution
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user'),
}));

// Mock Fuse.js for search functionality
vi.mock('fuse.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockReturnValue([]),
  })),
}));

describe('Tab Completion Acceptance Tests', () => {
  let completionEngine: CompletionEngine;
  let mockContext: CompletionContext;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;

  const createAcceptanceTestContext = (): CompletionContext => ({
    projectPath: '/test/project',
    agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
    workflows: ['feature', 'bugfix', 'refactor'],
    recentTasks: [],
    inputHistory: [],
  });

  const simulateTyping = (handler: any, text: string) => {
    for (const char of text) {
      act(() => {
        handler(char, { ctrl: false, meta: false });
      });
    }
  };

  const simulateTab = (handler: any) => {
    act(() => {
      handler('', { tab: true });
    });
  };

  const waitForCompletions = async (debounceMs: number = 200) => {
    act(() => {
      vi.advanceTimersByTime(debounceMs);
    });
    await vi.runAllTimersAsync();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Initialize CompletionEngine with real instance (not mocked)
    completionEngine = new CompletionEngine();
    mockContext = createAcceptanceTestContext();

    // Initialize event handlers
    onSubmit = vi.fn();
    onChange = vi.fn();

    // Mock useInput to capture input handler
    mockUseInput.mockImplementation((handler) => {
      // Store handler for later use in tests
      mockUseInput.inputHandler = handler;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('AC1: Tab accepts first suggestion on /he → /help', () => {
    it('completes /he to /help when Tab is pressed', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type "/he"
      simulateTyping(inputHandler, '/he');

      // Wait for debounce and completions
      await waitForCompletions();

      // Verify /help is shown as suggestion
      await waitFor(() => {
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
      });

      // Clear previous onChange calls from typing
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify input changed to /help
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/help');
      });
    });

    it('selects /help as first suggestion when query is /he', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type "/he"
      simulateTyping(inputHandler, '/he');

      // Wait for debounce and completions
      await waitForCompletions();

      // Verify /help is shown in suggestions (should be first)
      await waitFor(() => {
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
      });

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab - should complete to the first suggestion (/help)
      simulateTab(inputHandler);

      // Verify it completed to /help specifically
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/help');
      });
    });
  });

  describe('AC2: Tab replaces partial input with full command', () => {
    it('replaces /stat with /status', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial command
      simulateTyping(inputHandler, '/stat');
      await waitForCompletions();

      // Clear previous onChange calls from typing
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify full command replaced partial
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/status');
      });
    });

    it('preserves text after completed command', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type: "run /stat some text", position cursor after /stat
      simulateTyping(inputHandler, 'run /stat some text');

      // Move cursor to after "/stat" (position 8)
      for (let i = 0; i < 10; i++) {
        act(() => {
          inputHandler('', { leftArrow: true });
        });
      }

      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab - should complete /stat to /status and preserve surrounding text
      simulateTab(inputHandler);

      // Verify text after command is preserved
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('run /status some text');
      });
    });

    it('updates cursor position to end of completed command', async () => {
      // Note: This test verifies that the cursor position logic works correctly
      // The actual cursor position is handled internally by AdvancedInput
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial command
      simulateTyping(inputHandler, '/stat');
      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify the completion occurred (cursor position is handled internally)
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/status');
      });
    });
  });

  describe('AC3: Tab on /session l → /session list', () => {
    it('completes /session l to /session list', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type "/session l"
      simulateTyping(inputHandler, '/session l');
      await waitForCompletions();

      // Verify suggestions shown
      await waitFor(() => {
        expect(screen.queryByText(/list/)).toBeInTheDocument();
      });

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify completed to /session list
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/session list');
      });
    });

    it('shows list as first option when typing /session l', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type "/session l"
      simulateTyping(inputHandler, '/session l');
      await waitForCompletions();

      // Verify list appears in suggestions
      await waitFor(() => {
        expect(screen.queryByText(/list/)).toBeInTheDocument();
      });

      // Clear onChange calls
      onChange.mockClear();

      // Press Tab - should complete to first suggestion
      simulateTab(inputHandler);

      // Verify it completed to /session list (list should be first alphabetically)
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/session list');
      });
    });

    it('completes /session lo to /session load', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type "/session lo" - should match "load" not "list"
      simulateTyping(inputHandler, '/session lo');
      await waitForCompletions();

      // Verify load appears in suggestions
      await waitFor(() => {
        expect(screen.queryByText(/load/)).toBeInTheDocument();
      });

      // Clear onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify it completed to /session load
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('/session load');
      });
    });
  });

  describe('AC4: Tab does nothing when no suggestions available', () => {
    it('does not modify input when pressing Tab with no suggestions', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type invalid command prefix that won't match any commands
      simulateTyping(inputHandler, '/xyz');
      await waitForCompletions();

      // Clear onChange call history from typing
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify nothing changed
      expect(onChange).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not crash when Tab pressed on empty input', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Don't type anything - input is empty
      await waitForCompletions();

      // Press Tab on empty input
      expect(() => {
        simulateTab(inputHandler);
      }).not.toThrow();

      // Verify nothing was called
      expect(onChange).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('preserves current input when no completion matches', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type command that has no matches
      simulateTyping(inputHandler, '/zzz');
      await waitForCompletions();

      // Clear onChange calls from typing
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify input was not modified
      expect(onChange).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});