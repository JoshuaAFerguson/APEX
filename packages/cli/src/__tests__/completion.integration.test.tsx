import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from './test-utils.js';
import { waitFor } from '@testing-library/react';
import { AdvancedInput } from '../ui/components/AdvancedInput.js';
import { CompletionEngine, CompletionContext } from '../services/CompletionEngine.js';

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
  readdir: vi.fn().mockResolvedValue([
    { name: 'src', isDirectory: () => true },
    { name: 'package.json', isDirectory: () => false },
    { name: 'README.md', isDirectory: () => false },
  ]),
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

describe('CompletionEngine + AdvancedInput Integration Tests', () => {
  let completionEngine: CompletionEngine;
  let mockContext: CompletionContext;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Initialize CompletionEngine
    completionEngine = new CompletionEngine();

    // Create mock completion context
    mockContext = {
      projectPath: '/test/project',
      agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
      workflows: ['feature', 'bugfix', 'refactor'],
      recentTasks: [
        { id: 'task_123456', description: 'Implement user authentication' },
        { id: 'task_789012', description: 'Fix bug in payment processor' }
      ],
      inputHistory: [
        'add authentication to the login page',
        'fix the payment bug',
        'update documentation',
        'create new component',
        '/status',
        '/help'
      ]
    };

    // Initialize event handlers
    onSubmit = vi.fn();
    onChange = vi.fn();
    onCancel = vi.fn();

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

  describe('Basic Integration', () => {
    it('renders AdvancedInput with CompletionEngine successfully', () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('apex> ')).toBeInTheDocument();
      expect(screen.getByText(/Type a command/)).toBeInTheDocument();
    });

    it('passes completion engine and context to AdvancedInput without errors', () => {
      expect(() => {
        render(
          <AdvancedInput
            completionEngine={completionEngine}
            completionContext={mockContext}
            onSubmit={onSubmit}
            placeholder="Custom placeholder"
            prompt="test> "
          />
        );
      }).not.toThrow();

      expect(screen.getByText('test> ')).toBeInTheDocument();
      expect(screen.getByText('Custom placeholder')).toBeInTheDocument();
    });

    it('handles missing completion context gracefully', () => {
      expect(() => {
        render(
          <AdvancedInput
            completionEngine={completionEngine}
            // No completionContext provided
            onSubmit={onSubmit}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Suggestion Appearance Tests', () => {
    it('shows suggestions when typing command prefix', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Simulate typing "/he"
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('h', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('e', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show suggestions for commands starting with "/he"
        expect(screen.queryByText(/Suggestions/)).toBeInTheDocument();
      });
    });

    it('displays command suggestions with icons and descriptions', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/help"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show help command suggestion
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        expect(screen.queryByText(/Show help/)).toBeInTheDocument();
      });
    });

    it('shows agent suggestions with @ prefix', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Simulate typing "@plan"
      act(() => {
        inputHandler('@', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('p', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('l', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('a', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('n', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show planner agent suggestion
        expect(screen.queryByText(/planner/)).toBeInTheDocument();
      });
    });

    it('shows workflow suggestions with --workflow flag', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="run --workflow fea"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show feature workflow suggestion
        expect(screen.queryByText(/feature/)).toBeInTheDocument();
      });
    });

    it('shows task ID suggestions', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="retry task_123"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show task suggestions
        expect(screen.queryByText(/task_123456/)).toBeInTheDocument();
        expect(screen.queryByText(/Implement user authentication/)).toBeInTheDocument();
      });
    });

    it('shows history suggestions', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="add auth"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show history suggestions that match
        expect(screen.queryByText(/add authentication/)).toBeInTheDocument();
      });
    });

    it('hides suggestions when input is cleared', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/help"
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      // Fast-forward past debounce delay to show suggestions
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
      });

      // Simulate clearing input with Ctrl+L
      const inputHandler = mockUseInput.inputHandler;
      act(() => {
        inputHandler('l', { ctrl: true });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Suggestions should be hidden
        expect(screen.queryByText(/Suggestions/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Debouncing Tests', () => {
    it('debounces suggestion updates during rapid typing', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions');

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          debounceMs={100}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Simulate rapid typing
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('h', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('e', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('l', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('p', { ctrl: false, meta: false });
      });

      // Should not have called getCompletions yet
      expect(mockGetCompletions).not.toHaveBeenCalled();

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Now getCompletions should have been called once
      expect(mockGetCompletions).toHaveBeenCalledTimes(1);
      expect(mockGetCompletions).toHaveBeenLastCalledWith('/help', 5, mockContext);
    });

    it('respects custom debounce timing', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions');

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          debounceMs={300}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type input
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });

      // Wait less than debounce time
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should not have called getCompletions yet
      expect(mockGetCompletions).not.toHaveBeenCalled();

      // Wait for full debounce time
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Now should have called getCompletions
      expect(mockGetCompletions).toHaveBeenCalledTimes(1);
    });

    it('cancels previous debounced calls on new input', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions');

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          debounceMs={200}
          onSubmit={onSubmit}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type first character
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });

      // Wait partial debounce time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Type second character before debounce completes
      act(() => {
        inputHandler('h', { ctrl: false, meta: false });
      });

      // Wait partial debounce time again
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Still shouldn't have called getCompletions
      expect(mockGetCompletions).not.toHaveBeenCalled();

      // Wait for full debounce time from last input
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Should have called getCompletions only once with final input
      expect(mockGetCompletions).toHaveBeenCalledTimes(1);
      expect(mockGetCompletions).toHaveBeenLastCalledWith('/h', 2, mockContext);
    });
  });

  describe('Deduplication Tests', () => {
    it('removes duplicate suggestions from different sources', async () => {
      // Mock getCompletions to return duplicates
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/help', type: 'command', score: 100, description: 'Show help', icon: '?' },
          { value: '/help', type: 'command', score: 80, description: 'Help command' }, // Duplicate
          { value: '/status', type: 'command', score: 90, description: 'Show status', icon: 'i' },
        ]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/he"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(mockGetCompletions).toHaveBeenCalled();

        // Should only show one /help suggestion (the one with higher score)
        const helpElements = screen.queryAllByText(/\/help/);
        expect(helpElements.length).toBeLessThanOrEqual(1);

        // Should show other non-duplicate suggestions
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });

    it('preserves suggestions with same value but different types', async () => {
      // Mock getCompletions to return same value with different types
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: 'test', type: 'command', score: 100, description: 'Test command' },
          { value: 'test', type: 'file', score: 80, description: 'Test file' },
          { value: 'test', type: 'history', score: 60, description: 'From history' },
        ]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="test"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(mockGetCompletions).toHaveBeenCalled();

        // All three should be preserved since they have different types
        expect(screen.queryByText(/Test command/)).toBeInTheDocument();
        expect(screen.queryByText(/Test file/)).toBeInTheDocument();
        expect(screen.queryByText(/From history/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });

    it('keeps higher scored suggestion when deduplicating', async () => {
      // Mock getCompletions to return duplicates with different scores
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/help', type: 'command', score: 60, description: 'Basic help' },
          { value: '/help', type: 'command', score: 100, description: 'Advanced help', icon: '?' },
          { value: '/help', type: 'command', score: 80, description: 'Standard help' },
        ]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/help"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(mockGetCompletions).toHaveBeenCalled();

        // Should show only the highest scored version
        expect(screen.queryByText(/Advanced help/)).toBeInTheDocument();
        expect(screen.queryByText(/Basic help/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Standard help/)).not.toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });
  });

  describe('Tab Completion Integration', () => {
    it('completes input using first suggestion on Tab', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/help', type: 'command', score: 100, description: 'Show help' },
          { value: '/history', type: 'command', score: 80, description: 'Show history' },
        ]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial input
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('h', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Press Tab to complete
      act(() => {
        inputHandler('', { tab: true });
      });

      // Should submit the first (highest scored) suggestion
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith('/help');
      });

      mockGetCompletions.mockRestore();
    });

    it('handles Tab when no suggestions are available', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type input with no matching suggestions
      act(() => {
        inputHandler('x', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('y', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('z', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Press Tab
      act(() => {
        inputHandler('', { tab: true });
      });

      // Should not crash and not submit
      expect(onSubmit).not.toHaveBeenCalled();

      mockGetCompletions.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles completion engine errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockRejectedValue(new Error('Completion engine error'));

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/test"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should not crash the component
      await waitFor(() => {
        expect(screen.queryByText('apex> ')).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
      consoleSpy.mockRestore();
    });

    it('continues to work after completion engine error', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions');

      // First call fails
      mockGetCompletions.mockRejectedValueOnce(new Error('Network error'));

      // Second call succeeds
      mockGetCompletions.mockResolvedValueOnce([
        { value: '/help', type: 'command', score: 100, description: 'Show help' }
      ]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type input that will cause error
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Clear and type again
      act(() => {
        inputHandler('l', { ctrl: true }); // Clear
      });
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('h', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should work normally after error
      await waitFor(() => {
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('simulates complete user workflow with suggestions', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions');

      // Mock different completion responses for different inputs
      mockGetCompletions
        .mockImplementation(async (input, cursor, context) => {
          if (input === '/') {
            return [
              { value: '/help', type: 'command', score: 100, description: 'Show help' },
              { value: '/status', type: 'command', score: 90, description: 'Show status' }
            ];
          }
          if (input === '/he') {
            return [
              { value: '/help', type: 'command', score: 100, description: 'Show help' }
            ];
          }
          if (input === 'create') {
            return [
              { value: 'create a new component', type: 'history', score: 80, description: 'From history' }
            ];
          }
          return [];
        });

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Scenario 1: User types "/" and sees commands
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
      });

      // Scenario 2: User continues typing "/he" to narrow suggestions
      act(() => {
        inputHandler('h', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('e', { ctrl: false, meta: false });
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        expect(screen.queryByText(/\/status/)).not.toBeInTheDocument(); // Filtered out
      });

      // Scenario 3: User clears and types natural language
      act(() => {
        inputHandler('l', { ctrl: true }); // Clear
      });

      act(() => {
        inputHandler('c', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('r', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('e', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('a', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('t', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('e', { ctrl: false, meta: false });
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.queryByText(/create a new component/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });

    it('handles mixed suggestion types in same session', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/status', type: 'command', score: 100, description: 'Show status', icon: 'i' },
          { value: '@planner', type: 'agent', score: 90, description: 'Creates plans', icon: '🤖' },
          { value: 'task_123456', type: 'task', score: 80, description: 'User auth task', icon: '📋' },
          { value: 'status update', type: 'history', score: 70, description: 'From history', icon: '📝' },
        ]);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="sta"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show all different types of suggestions
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
        expect(screen.queryByText(/planner/)).toBeInTheDocument();
        expect(screen.queryByText(/task_123456/)).toBeInTheDocument();
        expect(screen.queryByText(/status update/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });
  });

  describe('Performance Tests', () => {
    it('handles large number of suggestions efficiently', async () => {
      // Create a large number of suggestions
      const largeSuggestionSet = Array.from({ length: 100 }, (_, i) => ({
        value: `/command${i}`,
        type: 'command',
        score: 100 - i,
        description: `Command ${i}`,
      }));

      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue(largeSuggestionSet);

      const startTime = performance.now();

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/command"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const endTime = performance.now();

      // Should render without significant delay
      expect(endTime - startTime).toBeLessThan(1000);

      await waitFor(() => {
        expect(screen.queryByText(/command0/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });

    it('limits displayed suggestions to reasonable number', async () => {
      const manySuggestions = Array.from({ length: 50 }, (_, i) => ({
        value: `/test${i}`,
        type: 'command',
        score: 100 - i,
        description: `Test command ${i}`,
      }));

      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue(manySuggestions);

      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/test"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should limit the number of displayed suggestions
        const suggestionElements = screen.queryAllByText(/test\d+/);
        expect(suggestionElements.length).toBeLessThanOrEqual(15); // Reasonable limit
      });

      mockGetCompletions.mockRestore();
    });
  });
});