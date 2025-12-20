/**
 * Command Completion Integration Tests
 *
 * Tests command completion functionality for slash commands in the APEX CLI.
 * Focuses specifically on the "/" trigger for command suggestions including:
 * - /help, /status, /session and other core commands
 * - Session subcommand completion (/session list, /session save, etc.)
 * - Progressive filtering as user types
 * - Tab completion and navigation
 * - Error handling and recovery
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

describe('Command Completion Integration Tests', () => {
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
        '/status',
        '/help',
        '/session list',
        '/session save'
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

  describe('Slash Command Trigger Tests', () => {
    it('triggers command suggestions when typing /', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Simulate typing "/"
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show command suggestions
        expect(screen.queryByText(/Suggestions/)).toBeInTheDocument();
      });
    });

    it('shows /help command in suggestions when typing /', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show /help command suggestion
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        expect(screen.queryByText(/Show help/)).toBeInTheDocument();
      });
    });

    it('shows /status command in suggestions when typing /', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show /status command suggestion
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
        expect(screen.queryByText(/Task status/)).toBeInTheDocument();
      });
    });

    it('shows /session command in suggestions when typing /', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show /session command suggestion
        expect(screen.queryByText(/\/session/)).toBeInTheDocument();
        expect(screen.queryByText(/Session management/)).toBeInTheDocument();
      });
    });

    it('filters commands based on prefix after /', async () => {
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
        // Should show /help command suggestion (starts with /he)
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        // Should NOT show /status command (doesn't start with /he)
        expect(screen.queryByText(/\/status/)).not.toBeInTheDocument();
      });
    });

    it('shows all command suggestions including core commands', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show multiple command suggestions
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
        expect(screen.queryByText(/\/session/)).toBeInTheDocument();
        expect(screen.queryByText(/\/agents/)).toBeInTheDocument();
        expect(screen.queryByText(/\/workflows/)).toBeInTheDocument();
      });
    });
  });

  describe('Command Filtering Tests', () => {
    it('progressively filters commands as user types more characters', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Simulate typing "/s"
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('s', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show commands starting with /s
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
        expect(screen.queryByText(/\/session/)).toBeInTheDocument();
        expect(screen.queryByText(/\/serve/)).toBeInTheDocument();
        // Should NOT show commands that don't start with /s
        expect(screen.queryByText(/\/help/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\/agents/)).not.toBeInTheDocument();
      });
    });

    it('shows exact match with highest priority', async () => {
      // Mock getCompletions to test exact matching behavior
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/help', type: 'command', score: 100, description: 'Show help', icon: '?' },
          { value: '/history', type: 'command', score: 80, description: 'Command history', icon: '📝' },
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
        // Exact match should appear first and be prioritized
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
        expect(screen.queryByText(/Show help/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });

    it('handles case-insensitive filtering', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Simulate typing "/HE" (uppercase)
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('H', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('E', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should still show /help command (case insensitive)
        expect(screen.queryByText(/\/help/)).toBeInTheDocument();
      });
    });

    it('shows no suggestions for unknown command prefix', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/xyz"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should not show any command suggestions for unknown prefix
        expect(screen.queryByText(/\/help/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\/status/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\/session/)).not.toBeInTheDocument();
      }, 100);
    });
  });

  describe('Session Subcommand Tests', () => {
    it('shows session subcommands when typing /session ', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/session "
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show session subcommands
        expect(screen.queryByText(/list/)).toBeInTheDocument();
        expect(screen.queryByText(/load/)).toBeInTheDocument();
        expect(screen.queryByText(/save/)).toBeInTheDocument();
        expect(screen.queryByText(/List sessions/)).toBeInTheDocument();
      });
    });

    it('filters session subcommands based on prefix', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/session l"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show subcommands starting with 'l'
        expect(screen.queryByText(/list/)).toBeInTheDocument();
        expect(screen.queryByText(/load/)).toBeInTheDocument();
        // Should NOT show other subcommands
        expect(screen.queryByText(/save/)).not.toBeInTheDocument();
        expect(screen.queryByText(/branch/)).not.toBeInTheDocument();
      });
    });

    it('shows session info subcommand', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/session i"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show info subcommand
        expect(screen.queryByText(/info/)).toBeInTheDocument();
        expect(screen.queryByText(/Session info/)).toBeInTheDocument();
      });
    });

    it('handles complete session subcommand names', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/session save"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Should show exact match for save subcommand
        expect(screen.queryByText(/save/)).toBeInTheDocument();
        expect(screen.queryByText(/Save session/)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Selection Tests', () => {
    it('supports tab completion for first suggestion', async () => {
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/help', type: 'command', score: 100, description: 'Show help', icon: '?' },
          { value: '/history', type: 'command', score: 80, description: 'Command history', icon: '📝' },
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

      // Type partial command
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

      // Should submit the first suggestion
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith('/help');
      });

      mockGetCompletions.mockRestore();
    });

    it('handles empty suggestions gracefully on tab', async () => {
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

      // Type command with no matches
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('x', { ctrl: false, meta: false });
      });
      act(() => {
        inputHandler('y', { ctrl: false, meta: false });
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

    it('maintains suggestion visibility while user types', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          onSubmit={onSubmit}
          onChange={onChange}
        />
      );

      const inputHandler = mockUseInput.inputHandler;

      // Type partial command
      act(() => {
        inputHandler('/', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Suggestions/)).toBeInTheDocument();
      });

      // Continue typing
      act(() => {
        inputHandler('s', { ctrl: false, meta: false });
      });

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Suggestions should still be visible with updated results
        expect(screen.queryByText(/Suggestions/)).toBeInTheDocument();
        expect(screen.queryByText(/\/status/)).toBeInTheDocument();
      });
    });

    it('hides suggestions when clearing input', async () => {
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

  describe('Icon and Description Display Tests', () => {
    it('displays command icons correctly', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/"
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Check for specific command descriptions that should appear
        expect(screen.queryByText(/Show help/)).toBeInTheDocument();
        expect(screen.queryByText(/Task status/)).toBeInTheDocument();
        expect(screen.queryByText(/Session management/)).toBeInTheDocument();
        expect(screen.queryByText(/List agents/)).toBeInTheDocument();
        expect(screen.queryByText(/List workflows/)).toBeInTheDocument();
      });
    });

    it('shows session subcommand descriptions', async () => {
      render(
        <AdvancedInput
          completionEngine={completionEngine}
          completionContext={mockContext}
          value="/session "
          onSubmit={onSubmit}
        />
      );

      // Fast-forward past debounce delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        // Check for session subcommand descriptions
        expect(screen.queryByText(/List sessions/)).toBeInTheDocument();
        expect(screen.queryByText(/Load session/)).toBeInTheDocument();
        expect(screen.queryByText(/Save session/)).toBeInTheDocument();
      });
    });

    it('handles commands without icons gracefully', async () => {
      // Mock getCompletions to return commands without icons
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockResolvedValue([
          { value: '/test', type: 'command', score: 100, description: 'Test command' },
        ]);

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
        // Should display command without crashing
        expect(screen.queryByText(/\/test/)).toBeInTheDocument();
        expect(screen.queryByText(/Test command/)).toBeInTheDocument();
      });

      mockGetCompletions.mockRestore();
    });
  });

  describe('Error Handling Tests', () => {
    it('handles completion engine errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockGetCompletions = vi.spyOn(completionEngine, 'getCompletions')
        .mockRejectedValue(new Error('Command completion engine error'));

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

    it('recovers from errors and continues working', async () => {
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
});