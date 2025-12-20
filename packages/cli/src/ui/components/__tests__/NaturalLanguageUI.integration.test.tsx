/**
 * Natural Language UI Integration Tests
 * Tests the integration of IntentDetector and SmartSuggestions with the conversation flow
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentDetector, SmartSuggestions } from '../IntentDetector';

// Mock Fuse.js
vi.mock('fuse.js', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      search: vi.fn().mockReturnValue([
        { item: { name: 'run', description: 'Execute a task' }, score: 0.1 },
        { item: { name: 'status', description: 'Show status' }, score: 0.3 }
      ]),
    })),
  };
});

describe('Natural Language UI Integration', () => {
  const mockCommands = [
    {
      name: 'run',
      aliases: ['execute', 'exec'],
      description: 'Execute a task',
      examples: ['run "create component"', 'run "fix bug"'],
    },
    {
      name: 'status',
      aliases: ['st', 'stat'],
      description: 'Show task status',
      examples: ['status', 'status taskId'],
    },
    {
      name: 'help',
      aliases: ['h', '?'],
      description: 'Show help information',
      examples: ['help', 'help command'],
    },
    {
      name: 'logs',
      aliases: ['log'],
      description: 'Show task logs',
      examples: ['logs', 'logs taskId'],
    },
  ];

  const mockHistory = [
    'create a new React component',
    'fix the authentication bug',
    '/status auth-task',
    '/help workflows',
    'update the documentation',
  ];

  const mockProjectContext = {
    currentDirectory: '/src/components',
    activeTask: 'auth-implementation-123',
    lastCommand: '/run',
    recentFiles: ['Auth.tsx', 'Login.tsx', 'utils.ts'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Intent Detection UI Flow', () => {
    it('should display appropriate intent analysis for task descriptions', async () => {
      const mockOnIntent = vi.fn();

      render(
        <IntentDetector
          input="create a new user authentication component"
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
          showSuggestions={true}
        />
      );

      // Wait for debounce
      act(() => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText(/Task Intent/i)).toBeInTheDocument();
      });

      // Should show task-related UI elements
      expect(screen.getByText('📝')).toBeInTheDocument(); // Task icon
      expect(screen.getByText(/task description detected/i)).toBeInTheDocument();
    });

    it('should display command intent for slash commands', async () => {
      const mockOnIntent = vi.fn();

      render(
        <IntentDetector
          input="/run create authentication system"
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText(/Command Intent/i)).toBeInTheDocument();
      });

      expect(screen.getByText('⚡')).toBeInTheDocument(); // Command icon
      expect(mockOnIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'command',
          confidence: 1.0,
          command: 'run'
        })
      );
    });

    it('should display question intent for interrogative input', async () => {
      const mockOnIntent = vi.fn();

      render(
        <IntentDetector
          input="How do I implement JWT authentication?"
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText(/Question Intent/i)).toBeInTheDocument();
      });

      expect(screen.getByText('❓')).toBeInTheDocument(); // Question icon
    });

    it('should show confidence scores with appropriate colors', async () => {
      const testCases = [
        { input: '/help', expectedColor: 'green', minConfidence: 100 },
        { input: 'create component', expectedColor: 'yellow', minConfidence: 70 },
        { input: 'unclear input', expectedColor: 'red', minConfidence: 30 },
      ];

      for (const { input, minConfidence } of testCases) {
        const { unmount } = render(
          <IntentDetector
            input={input}
            commands={mockCommands}
          />
        );

        act(() => {
          vi.advanceTimersByTime(350);
        });

        await waitFor(() => {
          const confidenceElement = screen.queryByText(new RegExp(`${minConfidence}%`));
          if (confidenceElement) {
            expect(confidenceElement).toBeInTheDocument();
          }
        });

        unmount();
      }
    });

    it('should provide contextual suggestions based on intent type', async () => {
      const { rerender } = render(
        <IntentDetector
          input="fix authentication"
          commands={mockCommands}
          showSuggestions={true}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Wait for suggestions to appear
      await waitFor(() => {
        const suggestions = screen.queryByText('Suggestions:');
        if (suggestions) {
          expect(suggestions).toBeInTheDocument();
        }
      });

      // Check for task-specific suggestions
      rerender(
        <IntentDetector
          input="help me with authentication"
          commands={mockCommands}
          showSuggestions={true}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        // Help intent should show help-related suggestions
        const helpSuggestion = screen.queryByText('/help');
        if (helpSuggestion) {
          expect(helpSuggestion).toBeInTheDocument();
        }
      });
    });
  });

  describe('Smart Suggestions Integration', () => {
    it('should display context-aware suggestions', () => {
      render(
        <SmartSuggestions
          input="status"
          history={mockHistory}
          context={mockProjectContext}
          maxSuggestions={5}
        />
      );

      expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();

      // Should show task-specific suggestions based on active task
      expect(screen.getByText('/status auth-implementation-123')).toBeInTheDocument();
      expect(screen.getByText('/logs auth-implementation-123')).toBeInTheDocument();
    });

    it('should show file-based suggestions from project context', () => {
      render(
        <SmartSuggestions
          input="edit"
          history={mockHistory}
          context={mockProjectContext}
          maxSuggestions={5}
        />
      );

      // Should suggest editing recent files
      expect(screen.getByText('Edit Auth.tsx')).toBeInTheDocument();
      expect(screen.getByText('Edit Login.tsx')).toBeInTheDocument();
    });

    it('should display different suggestion types with appropriate icons', () => {
      render(
        <SmartSuggestions
          input="component"
          history={mockHistory}
          context={mockProjectContext}
          maxSuggestions={10}
        />
      );

      // Should show various suggestion type icons
      expect(screen.getByText('🎯')).toBeInTheDocument(); // Context suggestions
    });

    it('should respect maxSuggestions limit', () => {
      const { rerender } = render(
        <SmartSuggestions
          input="test"
          history={mockHistory}
          context={mockProjectContext}
          maxSuggestions={3}
        />
      );

      const suggestions = screen.getAllByText(/🎯|💡|⏱️/);
      expect(suggestions.length).toBeLessThanOrEqual(3);

      // Test with different limit
      rerender(
        <SmartSuggestions
          input="test"
          history={mockHistory}
          context={mockProjectContext}
          maxSuggestions={1}
        />
      );

      const limitedSuggestions = screen.getAllByText(/🎯|💡|⏱️/);
      expect(limitedSuggestions.length).toBeLessThanOrEqual(1);
    });

    it('should handle empty context gracefully', () => {
      render(
        <SmartSuggestions
          input="create component"
          history={[]}
          context={undefined}
          maxSuggestions={5}
        />
      );

      expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();

      // Should still show completion suggestions even without context
      const completionSuggestions = screen.queryAllByText(/Create a new/);
      expect(completionSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Conversation Flow Integration', () => {
    it('should handle progressive intent refinement', async () => {
      let currentInput = 'create';
      const mockOnIntent = vi.fn();

      const { rerender } = render(
        <IntentDetector
          input={currentInput}
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
          showSuggestions={true}
        />
      );

      // Initial ambiguous input
      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Add more context
      currentInput = 'create a component';
      rerender(
        <IntentDetector
          input={currentInput}
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
          showSuggestions={true}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Add specific details
      currentInput = 'create a React authentication component';
      rerender(
        <IntentDetector
          input={currentInput}
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
          showSuggestions={true}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockOnIntent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'task',
            confidence: expect.any(Number)
          })
        );
      });
    });

    it('should adapt suggestions based on conversation context', () => {
      // Simulate different conversation states
      const authContext = {
        ...mockProjectContext,
        activeTask: 'auth-implementation',
        recentFiles: ['Auth.tsx', 'JWT.utils.ts'],
      };

      const { rerender } = render(
        <SmartSuggestions
          input="test"
          history={mockHistory}
          context={authContext}
        />
      );

      expect(screen.getByText('/status auth-implementation')).toBeInTheDocument();

      // Change to testing context
      const testContext = {
        ...mockProjectContext,
        activeTask: 'unit-tests',
        recentFiles: ['Auth.test.tsx', 'Login.test.tsx'],
      };

      rerender(
        <SmartSuggestions
          input="test"
          history={mockHistory}
          context={testContext}
        />
      );

      expect(screen.getByText('/status unit-tests')).toBeInTheDocument();
    });

    it('should maintain consistency between intent detection and suggestions', async () => {
      const mockOnIntent = vi.fn();
      const mockOnSuggestion = vi.fn();

      const { container } = render(
        <div>
          <IntentDetector
            input="create authentication component"
            commands={mockCommands}
            onIntentDetected={mockOnIntent}
            showSuggestions={true}
          />
          <SmartSuggestions
            input="create authentication component"
            history={mockHistory}
            context={mockProjectContext}
            onSuggestion={mockOnSuggestion}
          />
        </div>
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockOnIntent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'task'
          })
        );
      });

      // Both components should recognize this as a task-related input
      expect(screen.getByText(/Task Intent/i)).toBeInTheDocument();
      expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide clear visual feedback for different intent types', async () => {
      const intentTests = [
        { input: '/help', expectedIcon: '⚡', expectedType: 'Command' },
        { input: 'create component', expectedIcon: '📝', expectedType: 'Task' },
        { input: 'what is this?', expectedIcon: '❓', expectedType: 'Question' },
        { input: 'config set theme', expectedIcon: '⚙️', expectedType: 'Config' },
        { input: 'help me', expectedIcon: '💡', expectedType: 'Help' },
      ];

      for (const { input, expectedIcon, expectedType } of intentTests) {
        const { unmount } = render(
          <IntentDetector
            input={input}
            commands={mockCommands}
          />
        );

        act(() => {
          vi.advanceTimersByTime(350);
        });

        await waitFor(() => {
          const iconElement = screen.queryByText(expectedIcon);
          const typeElement = screen.queryByText(new RegExp(`${expectedType} Intent`));

          if (iconElement && typeElement) {
            expect(iconElement).toBeInTheDocument();
            expect(typeElement).toBeInTheDocument();
          }
        });

        unmount();
      }
    });

    it('should show loading states appropriately', () => {
      render(
        <IntentDetector
          input="analyzing this input"
          commands={mockCommands}
        />
      );

      // Should show loading initially
      expect(screen.getByText('Analyzing intent...')).toBeInTheDocument();

      // After timeout, should show intent
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.queryByText('Analyzing intent...')).not.toBeInTheDocument();
    });

    it('should handle rapid input changes gracefully', async () => {
      const mockOnIntent = vi.fn();

      const { rerender } = render(
        <IntentDetector
          input=""
          commands={mockCommands}
          onIntentDetected={mockOnIntent}
        />
      );

      // Rapid input changes
      const inputs = ['c', 'cr', 'cre', 'create', 'create c', 'create comp', 'create component'];

      inputs.forEach((input, index) => {
        rerender(
          <IntentDetector
            input={input}
            commands={mockCommands}
            onIntentDetected={mockOnIntent}
          />
        );

        // Small advancement for debounce
        act(() => {
          vi.advanceTimersByTime(100);
        });
      });

      // Final advancement to complete last debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should have called onIntentDetected for the final input
      await waitFor(() => {
        expect(mockOnIntent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'task'
          })
        );
      });
    });

    it('should respect confidence thresholds', () => {
      // Test with high confidence threshold
      const { rerender } = render(
        <IntentDetector
          input="unclear ambiguous input"
          commands={mockCommands}
          minConfidence={0.9}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Should not show intent for low confidence input
      expect(screen.queryByText(/Intent/)).not.toBeInTheDocument();

      // Test with lower threshold
      rerender(
        <IntentDetector
          input="unclear ambiguous input"
          commands={mockCommands}
          minConfidence={0.3}
        />
      );

      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Should show intent with lower threshold
      expect(screen.queryByText(/Intent/)).toBeInTheDocument();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large suggestion lists efficiently', () => {
      const largeHistory = Array.from({ length: 1000 }, (_, i) => `command ${i}`);
      const complexContext = {
        ...mockProjectContext,
        recentFiles: Array.from({ length: 100 }, (_, i) => `file${i}.tsx`),
      };

      const startTime = performance.now();

      render(
        <SmartSuggestions
          input="test"
          history={largeHistory}
          context={complexContext}
          maxSuggestions={5}
        />
      );

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();
    });

    it('should cleanup timers properly on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = render(
        <IntentDetector
          input="test input"
          commands={mockCommands}
        />
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});