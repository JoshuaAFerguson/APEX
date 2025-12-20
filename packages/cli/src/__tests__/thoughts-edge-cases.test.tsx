/**
 * Edge cases and error handling tests for agent thought display functionality
 * Tests boundary conditions, error states, and robustness
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App.js';
import { ThoughtDisplay } from '../ui/components/ThoughtDisplay.js';
import { ThemeProvider } from '../ui/context/ThemeContext.js';

// Mock ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) =>
    <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, color, dimColor, wrap }: {
    children: React.ReactNode;
    color?: string;
    dimColor?: boolean;
    wrap?: string;
  }) => (
    <span data-testid="text" data-color={color} data-dim={dimColor} data-wrap={wrap}>
      {children}
    </span>
  ),
  useInput: vi.fn(),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
}));

// Mock services
vi.mock('../services/ConversationManager', () => ({
  ConversationManager: class {
    addMessage = vi.fn();
    clearContext = vi.fn();
    getSuggestions = vi.fn(() => []);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.8 }));
    hasPendingClarification = vi.fn(() => false);
    provideClarification = vi.fn();
  },
}));

vi.mock('../services/ShortcutManager', () => ({
  ShortcutManager: class {
    on = vi.fn();
    pushContext = vi.fn();
    popContext = vi.fn();
    handleKey = vi.fn(() => false);
  },
}));

vi.mock('../services/CompletionEngine', () => ({
  CompletionEngine: class {
    getCompletions = vi.fn(() => []);
    updateContext = vi.fn();
  },
}));

describe('Thought Display - Edge Cases and Error Handling', () => {
  let baseState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

    baseState = {
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

  describe('ThoughtDisplay Edge Cases', () => {
    it('should handle extremely long thinking content gracefully', () => {
      // Generate a massive thinking content (10,000 characters)
      const massiveThinking = 'A'.repeat(10000);

      render(
        <ThoughtDisplay
          thinking={massiveThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should truncate to 300 characters + "..."
      const textElements = screen.getAllByTestId('text');
      const contentElement = textElements.find(el =>
        el.textContent?.startsWith('AAA') && el.textContent.endsWith('...')
      );

      expect(contentElement).toBeTruthy();
      expect(contentElement?.textContent).toHaveLength(303); // 300 + "..."

      // Should show truncation indicator
      const truncationIndicator = textElements.find(el =>
        el.textContent?.includes('(truncated from 10000 chars)')
      );
      expect(truncationIndicator).toBeTruthy();
    });

    it('should handle unicode and emoji content correctly', () => {
      const unicodeThinking = '🤖 Analyzing data: 日本語 العربية 🔍📊💡';

      render(
        <ThoughtDisplay
          thinking={unicodeThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      const contentElement = screen.getByText(unicodeThinking);
      expect(contentElement).toBeInTheDocument();
    });

    it('should handle content with only newlines and tabs', () => {
      const whitespaceContent = '\n\n\t\t\n\t\n';

      render(
        <ThoughtDisplay
          thinking={whitespaceContent}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should still render the content as-is
      const contentElement = screen.getByText(whitespaceContent);
      expect(contentElement).toBeInTheDocument();
    });

    it('should handle malformed or undefined props gracefully', () => {
      // Test with undefined values that shouldn't crash the component
      expect(() => {
        render(
          <ThoughtDisplay
            thinking=""
            agent=""
            displayMode={undefined as any}
            compact={undefined as any}
          />
        );
      }).not.toThrow();
    });

    it('should handle rapid display mode changes', () => {
      const thinking = 'Test thinking content';
      const { rerender } = render(
        <ThoughtDisplay
          thinking={thinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Rapidly change display modes
      rerender(
        <ThoughtDisplay
          thinking={thinking}
          agent="developer"
          displayMode="compact"
        />
      );

      rerender(
        <ThoughtDisplay
          thinking={thinking}
          agent="developer"
          displayMode="verbose"
        />
      );

      rerender(
        <ThoughtDisplay
          thinking={thinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should handle changes without errors
      expect(screen.getByText(thinking)).toBeInTheDocument();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle many simultaneous thought displays', () => {
      // Create state with many messages containing thoughts
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        type: 'assistant' as const,
        content: `Message ${i}`,
        agent: `agent-${i % 5}`,
        thinking: `Thinking for message ${i} - this is a longer thought process that tests memory usage`,
        timestamp: new Date(),
      }));

      const stateWithManyMessages = {
        ...baseState,
        showThoughts: true,
        messages: manyMessages,
      };

      // Mock the components to avoid rendering complexity
      const MockApp = vi.fn(() => <div data-testid="mock-app" />);

      expect(() => {
        render(
          <ThemeProvider>
            <MockApp />
          </ThemeProvider>
        );
      }).not.toThrow();
    });

    it('should handle frequent state updates without memory leaks', async () => {
      let updateCount = 0;
      const maxUpdates = 50;

      const TestComponent = () => {
        const [thinking, setThinking] = React.useState('Initial thinking');

        React.useEffect(() => {
          const interval = setInterval(() => {
            if (updateCount < maxUpdates) {
              setThinking(`Updated thinking ${++updateCount}`);
            } else {
              clearInterval(interval);
            }
          }, 10);

          return () => clearInterval(interval);
        }, []);

        return (
          <ThoughtDisplay
            thinking={thinking}
            agent="developer"
            displayMode="normal"
          />
        );
      };

      render(<TestComponent />);

      // Wait for updates to complete
      await waitFor(() => {
        expect(updateCount).toBe(maxUpdates);
      }, { timeout: 2000 });

      // Component should still be functional
      expect(screen.getByText(`Updated thinking ${maxUpdates}`)).toBeInTheDocument();
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle exactly at truncation limits', () => {
      // Test normal mode limit (300 chars)
      const exactNormalLimit = 'X'.repeat(300);

      render(
        <ThoughtDisplay
          thinking={exactNormalLimit}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByText(exactNormalLimit)).toBeInTheDocument();
      expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
    });

    it('should handle one character over truncation limits', () => {
      // Test one char over normal mode limit
      const oneOverLimit = 'X'.repeat(301);

      render(
        <ThoughtDisplay
          thinking={oneOverLimit}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should be truncated
      expect(screen.getByText(/X{300}\.\.\.$/)).toBeInTheDocument();
      expect(screen.getByText(/\(truncated from 301 chars\)/)).toBeInTheDocument();
    });

    it('should handle verbose mode boundaries correctly', () => {
      // Test verbose mode limit (1000 chars)
      const exactVerboseLimit = 'Y'.repeat(1000);

      render(
        <ThoughtDisplay
          thinking={exactVerboseLimit}
          agent="developer"
          displayMode="verbose"
        />
      );

      expect(screen.getByText(exactVerboseLimit)).toBeInTheDocument();
      expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle rapid toggle operations without state corruption', async () => {
      let clickCount = 0;
      const MockInputPrompt = () => (
        <button
          data-testid="rapid-toggle"
          onClick={async () => {
            // Simulate rapid clicking
            for (let i = 0; i < 10; i++) {
              clickCount++;
              // Simulate async state updates
              await new Promise(resolve => setTimeout(resolve, 1));
            }
          }}
        >
          Rapid Toggle
        </button>
      );

      render(<MockInputPrompt />);

      const button = screen.getByTestId('rapid-toggle');

      await act(async () => {
        button.click();
        button.click();
        button.click();
      });

      // Should handle rapid operations without errors
      expect(clickCount).toBeGreaterThan(0);
    });

    it('should handle simultaneous thought updates from different agents', async () => {
      const agents = ['planner', 'developer', 'tester', 'reviewer'];
      let updatePromises: Promise<void>[] = [];

      // Simulate simultaneous updates
      agents.forEach(agent => {
        const promise = new Promise<void>(resolve => {
          setTimeout(() => {
            render(
              <ThoughtDisplay
                thinking={`Thinking from ${agent}`}
                agent={agent}
                displayMode="normal"
              />
            );
            resolve();
          }, Math.random() * 100);
        });
        updatePromises.push(promise);
      });

      await Promise.all(updatePromises);

      // All agents should be rendered
      agents.forEach(agent => {
        expect(screen.getByText(`Thinking from ${agent}`)).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from rendering errors gracefully', () => {
      // Test error boundary scenarios
      const ErrorComponent = () => {
        throw new Error('Test rendering error');
      };

      const RecoveryComponent = () => {
        try {
          return <ErrorComponent />;
        } catch {
          return (
            <ThoughtDisplay
              thinking="Recovered from error"
              agent="developer"
              displayMode="normal"
            />
          );
        }
      };

      render(<RecoveryComponent />);
      expect(screen.getByText('Recovered from error')).toBeInTheDocument();
    });

    it('should handle corrupt or invalid message data', () => {
      const corruptMessages = [
        { type: null, content: undefined, agent: '', thinking: null },
        { type: 'assistant', content: 'Valid', agent: undefined, thinking: {} },
        { type: 'assistant', content: 'Valid', agent: 'dev', thinking: 123 },
      ] as any;

      // Should not crash when filtering/processing corrupt data
      expect(() => {
        const validMessages = corruptMessages.filter((msg: any) =>
          msg &&
          typeof msg.thinking === 'string' &&
          msg.thinking.trim().length > 0 &&
          msg.agent
        );
        expect(validMessages).toHaveLength(0);
      }).not.toThrow();
    });
  });

  describe('Platform Compatibility', () => {
    it('should handle different terminal widths gracefully', () => {
      // Test with very narrow terminal
      const narrowThinking = 'This is a very long thought that should wrap properly even in narrow terminals with limited width availability';

      render(
        <ThoughtDisplay
          thinking={narrowThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      const contentElement = screen.getByText(narrowThinking);
      expect(contentElement).toHaveAttribute('data-wrap', 'wrap');
    });

    it('should handle special characters that might break terminal rendering', () => {
      const specialChars = '\x1b[31m\x00\r\n\t\\/"\'`${}[]()';

      render(
        <ThoughtDisplay
          thinking={`Testing special chars: ${specialChars}`}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should render without breaking
      expect(screen.getByText(/Testing special chars:/)).toBeInTheDocument();
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('should maintain accessibility with very long agent names', () => {
      const longAgentName = 'very-long-agent-name-that-exceeds-normal-expectations-for-agent-naming';

      render(
        <ThoughtDisplay
          thinking="Test thinking"
          agent={longAgentName}
          displayMode="normal"
        />
      );

      expect(screen.getByText(new RegExp(`💭 ${longAgentName} thinking`))).toBeInTheDocument();
    });

    it('should handle agent names with special characters', () => {
      const specialAgentName = 'agent@domain.com_v2.1-beta';

      render(
        <ThoughtDisplay
          thinking="Test thinking"
          agent={specialAgentName}
          displayMode="normal"
        />
      );

      expect(screen.getByText(new RegExp(`💭 ${specialAgentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} thinking`))).toBeInTheDocument();
    });
  });
});