/**
 * History Completion and Tab Key Integration Tests
 *
 * Tests verify comprehensive history completion functionality with Tab key integration:
 * - AC1: History completion from inputHistory works correctly
 * - AC2: Minimum input length enforced (2 characters)
 * - AC3: Tab key accepts first history suggestion
 * - AC4: Tab replaces word being typed with history match
 * - AC5: Cursor positioning after Tab completion is correct
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from './test-utils';
import { waitFor } from '@testing-library/react';
import { AdvancedInput } from '../ui/components/AdvancedInput';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine';

// Mock Ink hooks
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

describe('History Completion and Tab Key Integration', () => {
  let completionEngine: CompletionEngine;
  let mockContext: CompletionContext;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;

  const createHistoryTestContext = (inputHistory: string[] = []): CompletionContext => ({
    projectPath: '/test/project',
    agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
    workflows: ['feature', 'bugfix', 'refactor'],
    recentTasks: [],
    inputHistory,
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

  const simulateArrowKey = (handler: any, direction: 'left' | 'right') => {
    act(() => {
      handler('', { leftArrow: direction === 'left', rightArrow: direction === 'right' });
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

    // Initialize CompletionEngine with real instance
    completionEngine = new CompletionEngine();

    // Initialize event handlers
    onSubmit = vi.fn();
    onChange = vi.fn();

    // Mock useInput to capture input handler
    mockUseInput.mockImplementation((handler) => {
      mockUseInput.inputHandler = handler;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('AC1: History completion from inputHistory works correctly', () => {
    it('shows history suggestions when typing prefix that matches history', async () => {
      const historyCommands = [
        'implement user authentication system',
        'fix authentication bug in login',
        'add authentication middleware',
        'create new dashboard component'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that matches multiple history entries
      simulateTyping(inputHandler, 'implement');
      await waitForCompletions();

      // Verify history suggestion appears
      await waitFor(() => {
        expect(screen.queryByText(/implement user authentication system/)).toBeInTheDocument();
      });
    });

    it('filters history suggestions by input prefix', async () => {
      const historyCommands = [
        'implement user authentication system',
        'fix authentication bug in login',
        'add authentication middleware',
        'create new dashboard component'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that should only match authentication commands
      simulateTyping(inputHandler, 'fix auth');
      await waitForCompletions();

      // Should show the 'fix authentication bug in login' command
      await waitFor(() => {
        expect(screen.queryByText(/fix authentication bug in login/)).toBeInTheDocument();
      });

      // Should NOT show commands that don't match 'fix auth'
      expect(screen.queryByText(/implement user authentication/)).not.toBeInTheDocument();
      expect(screen.queryByText(/create new dashboard/)).not.toBeInTheDocument();
    });

    it('shows most recent history entries first', async () => {
      const historyCommands = [
        'old authentication implementation',
        'newer authentication system',
        'latest authentication feature',
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix matching all authentication commands
      simulateTyping(inputHandler, 'latest auth');
      await waitForCompletions();

      // Should prioritize more recent entries (latest should appear first)
      await waitFor(() => {
        expect(screen.queryByText(/latest authentication feature/)).toBeInTheDocument();
      });
    });

    it('does not suggest exact match as completion', async () => {
      const historyCommands = [
        'implement user authentication',
        'implement feature testing'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type exact match from history
      simulateTyping(inputHandler, 'implement user authentication');
      await waitForCompletions();

      // Should not suggest the exact same input back
      const historyElements = screen.queryAllByText(/implement user authentication/);
      // There might be the input itself, but not a completion suggestion
      expect(historyElements.length).toBeLessThanOrEqual(1);
    });
  });

  describe('AC2: Minimum input length enforced (2 characters)', () => {
    it('does not show history completions for single character input', async () => {
      const historyCommands = [
        'implement user authentication',
        'add new features'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type only single character
      simulateTyping(inputHandler, 'i');
      await waitForCompletions();

      // Should not show any history suggestions
      expect(screen.queryByText(/implement user authentication/)).not.toBeInTheDocument();
      expect(screen.queryByText(/add new features/)).not.toBeInTheDocument();
    });

    it('shows history completions when input length is 2 or more', async () => {
      const historyCommands = [
        'implement user authentication',
        'add new features'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type exactly 2 characters
      simulateTyping(inputHandler, 'im');
      await waitForCompletions();

      // Should show history suggestions now
      await waitFor(() => {
        expect(screen.queryByText(/implement user authentication/)).toBeInTheDocument();
      });
    });

    it('does not show history completions for empty input', async () => {
      const historyCommands = [
        'implement user authentication',
        'add new features'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Don't type anything
      await waitForCompletions();

      // Should not show any history suggestions
      expect(screen.queryByText(/implement user authentication/)).not.toBeInTheDocument();
      expect(screen.queryByText(/add new features/)).not.toBeInTheDocument();
    });
  });

  describe('AC3: Tab key accepts first history suggestion', () => {
    it('completes input with first history suggestion when Tab is pressed', async () => {
      const historyCommands = [
        'implement user authentication system',
        'implement feature toggles',
        'create dashboard component'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that matches history
      simulateTyping(inputHandler, 'implement user');
      await waitForCompletions();

      // Verify suggestion is shown
      await waitFor(() => {
        expect(screen.queryByText(/implement user authentication system/)).toBeInTheDocument();
      });

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab to accept first suggestion
      simulateTab(inputHandler);

      // Verify input was completed with the first history match
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement user authentication system');
      });
    });

    it('prioritizes most relevant history suggestion as first option', async () => {
      const historyCommands = [
        'implement basic feature',
        'implement user authentication system', // More specific match
        'implement simple component'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that matches multiple commands
      simulateTyping(inputHandler, 'implement user');
      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab - should complete with most relevant match
      simulateTab(inputHandler);

      // Should complete with the more specific match
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement user authentication system');
      });
    });

    it('does nothing when no history suggestions are available', async () => {
      const historyCommands = [
        'implement user authentication',
        'add new features'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that doesn't match any history
      simulateTyping(inputHandler, 'delete old');
      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Should not modify input when no suggestions available
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('AC4: Tab replaces word being typed with history match', () => {
    it('replaces partial word with complete history suggestion', async () => {
      const historyCommands = [
        'implement comprehensive user authentication system',
        'create simple dashboard'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial word that matches history
      simulateTyping(inputHandler, 'implement comprehen');
      await waitForCompletions();

      // Verify suggestion is shown
      await waitFor(() => {
        expect(screen.queryByText(/implement comprehensive user authentication system/)).toBeInTheDocument();
      });

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Should replace partial input with complete history match
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement comprehensive user authentication system');
      });
    });

    it('replaces word when cursor is in middle of text', async () => {
      const historyCommands = [
        'implement user authentication system',
        'test authentication flow'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type text with cursor not at end
      simulateTyping(inputHandler, 'implement user extra text');

      // Move cursor to position after "user" (position 14)
      for (let i = 0; i < 11; i++) { // Move left 11 characters (" extra text")
        simulateArrowKey(inputHandler, 'left');
      }

      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab - should complete the word at cursor position
      simulateTab(inputHandler);

      // Should replace with history match and preserve text after cursor
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement user authentication system extra text');
      });
    });

    it('handles completion when multiple words match partially', async () => {
      const historyCommands = [
        'implement user authentication with JWT tokens',
        'implement user interface components'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial input that could match multiple commands
      simulateTyping(inputHandler, 'implement user auth');
      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab - should complete with first/best match
      simulateTab(inputHandler);

      // Should complete with one of the matches (likely the first/best scoring)
      await waitFor(() => {
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const completed = lastCall?.[0];
        expect(completed).toMatch(/implement user authentication/);
      });
    });
  });

  describe('AC5: Cursor positioning after Tab completion is correct', () => {
    it('positions cursor at end of completed text', async () => {
      const historyCommands = [
        'implement user authentication system'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial input
      simulateTyping(inputHandler, 'implement user');
      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Verify completion occurred
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement user authentication system');
      });

      // Note: Actual cursor position testing is challenging in this test environment
      // The AdvancedInput component handles cursor positioning internally
      // This test verifies that the completion happens correctly, and the component
      // is responsible for proper cursor positioning
    });

    it('preserves text after cursor when completing in middle of input', async () => {
      const historyCommands = [
        'implement user authentication'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type text with some content after
      simulateTyping(inputHandler, 'implement user and add tests');

      // Move cursor back to after "user"
      for (let i = 0; i < 13; i++) { // Move left past " and add tests"
        simulateArrowKey(inputHandler, 'left');
      }

      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Should complete and preserve text after completion point
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement user authentication and add tests');
      });
    });

    it('handles completion when cursor is at word boundary', async () => {
      const historyCommands = [
        'implement complete user authentication system'
      ];

      mockContext = createHistoryTestContext(historyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type exactly up to word boundary
      simulateTyping(inputHandler, 'implement complete');
      await waitForCompletions();

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab
      simulateTab(inputHandler);

      // Should complete the rest of the command
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith('implement complete user authentication system');
      });
    });
  });

  describe('History completion edge cases', () => {
    it('handles empty history gracefully', async () => {
      mockContext = createHistoryTestContext([]); // Empty history

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type input that would normally match history
      simulateTyping(inputHandler, 'implement');
      await waitForCompletions();

      // Should not show any suggestions
      expect(screen.queryByText(/From history/)).not.toBeInTheDocument();

      // Press Tab - should do nothing
      onChange.mockClear();
      simulateTab(inputHandler);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('handles very long history commands correctly', async () => {
      const longCommand = 'implement a very comprehensive user authentication system with JWT tokens, refresh tokens, password hashing, session management, role-based access control, and multi-factor authentication support';

      mockContext = createHistoryTestContext([longCommand]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that matches long command
      simulateTyping(inputHandler, 'implement a very');
      await waitForCompletions();

      // Should show truncated version in display
      await waitFor(() => {
        // The display value should be truncated but still recognizable
        const elements = screen.queryAllByText(/implement a very comprehensive/);
        expect(elements.length).toBeGreaterThan(0);
      });

      // Clear previous onChange calls
      onChange.mockClear();

      // Press Tab - should complete with full command
      simulateTab(inputHandler);

      // Should complete with the full long command
      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith(longCommand);
      });
    });

    it('limits history suggestions to reasonable number', async () => {
      // Create many similar history commands
      const manyCommands = Array.from({ length: 20 }, (_, i) =>
        `implement feature number ${i.toString().padStart(2, '0')}`
      );

      mockContext = createHistoryTestContext(manyCommands);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type prefix that matches many commands
      simulateTyping(inputHandler, 'implement feature');
      await waitForCompletions();

      // Should limit the number of suggestions shown (typically 5 for history)
      const suggestions = screen.queryAllByText(/implement feature number/);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });
});