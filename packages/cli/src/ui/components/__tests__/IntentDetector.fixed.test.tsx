import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntentDetector, SmartSuggestions, Intent } from '../IntentDetector';

// Mock Fuse.js with more realistic behavior
vi.mock('fuse.js', () => {
  return {
    default: class MockFuse {
      private items: any[];
      private options: any;

      constructor(items: any[], options?: any) {
        this.items = items || [];
        this.options = options || {};
      }

      search(query: string) {
        if (!query) return [];

        const threshold = this.options.threshold || 0.4;
        const matches = this.items.filter(item => {
          if (typeof item === 'string') {
            // Simple string matching for history
            return item.toLowerCase().includes(query.toLowerCase());
          }

          // Handle command objects
          const nameMatch = item.name?.toLowerCase().includes(query.toLowerCase());
          const aliasMatch = item.aliases?.some((alias: string) =>
            alias.toLowerCase().includes(query.toLowerCase())
          );
          const descMatch = item.description?.toLowerCase().includes(query.toLowerCase());

          return nameMatch || aliasMatch || descMatch;
        });

        return matches.map((item, index) => ({
          item,
          score: Math.min(0.1 + (index * 0.1), threshold - 0.01) // Ensure score is below threshold
        }));
      }
    },
  };
});

describe('IntentDetector - Fixed Tests', () => {
  const mockCommands = [
    {
      name: 'run',
      aliases: ['execute', 'exec'],
      description: 'Execute a task',
      examples: ['run "create component"', 'run "fix bug"'],
    },
    {
      name: 'status',
      aliases: ['st'],
      description: 'Show task status',
      examples: ['status', 'status taskId'],
    },
    {
      name: 'help',
      aliases: ['h'],
      description: 'Show help information',
      examples: ['help', 'help command'],
    },
  ];

  let mockOnIntentDetected: any;

  beforeEach(() => {
    mockOnIntentDetected = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should render nothing when input is empty', () => {
    const { container } = render(
      <IntentDetector
        input=""
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should detect command intent for slash commands', async () => {
    render(
      <IntentDetector
        input="/run test task"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    // Advance past the debounce timer
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'command',
          confidence: 1.0,
          command: 'run',
        })
      );
    }, { timeout: 2000 });
  });

  it('should detect help intent for help patterns', async () => {
    render(
      <IntentDetector
        input="help me with this"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'help',
          confidence: 0.8,
        })
      );
    }, { timeout: 2000 });
  });

  it('should detect task intent for action words', async () => {
    render(
      <IntentDetector
        input="create a new component"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task',
          confidence: expect.any(Number),
        })
      );
    }, { timeout: 2000 });
  });

  it('should detect question intent for question patterns', async () => {
    render(
      <IntentDetector
        input="How do I create a component?"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'question',
          confidence: expect.any(Number),
        })
      );
    }, { timeout: 2000 });
  });

  it('should detect config intent for configuration patterns', async () => {
    render(
      <IntentDetector
        input="config set theme dark"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'config',
          confidence: 0.8,
        })
      );
    }, { timeout: 2000 });
  });

  it('should respect minConfidence threshold', async () => {
    render(
      <IntentDetector
        input="abc"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
        minConfidence={0.5}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Should not call onIntentDetected for low confidence
    expect(mockOnIntentDetected).not.toHaveBeenCalled();
  });

  it('should handle navigation patterns', async () => {
    render(
      <IntentDetector
        input="go to dashboard"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'navigation',
          confidence: 0.8,
        })
      );
    }, { timeout: 2000 });
  });

  it('should provide appropriate confidence scores', async () => {
    const testCases = [
      { input: '/help', expectedType: 'command', expectedConfidence: 1.0 },
      { input: 'create component', expectedType: 'task', minConfidence: 0.7 },
      { input: 'what is this?', expectedType: 'question', minConfidence: 0.7 },
      { input: 'help me', expectedType: 'help', expectedConfidence: 0.8 },
    ];

    for (const testCase of testCases) {
      const localMock = vi.fn();

      render(
        <IntentDetector
          input={testCase.input}
          commands={mockCommands}
          onIntentDetected={localMock}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(localMock).toHaveBeenCalledWith(
          expect.objectContaining({
            type: testCase.expectedType,
            confidence: testCase.expectedConfidence || expect.any(Number),
          })
        );

        if (testCase.minConfidence) {
          const call = localMock.mock.calls[0][0];
          expect(call.confidence).toBeGreaterThanOrEqual(testCase.minConfidence);
        }
      }, { timeout: 2000 });
    }
  });
});

describe('SmartSuggestions - Fixed Tests', () => {
  const mockHistory = ['create component', 'fix bug', 'run tests', 'deploy app'];
  const mockContext = {
    currentDirectory: '/project',
    activeTask: 'create-feature',
    lastCommand: '/status',
    recentFiles: ['App.tsx', 'utils.ts', 'README.md']
  };

  it('should render nothing when input is too short', () => {
    const { container } = render(
      <SmartSuggestions
        input="ab"
        history={mockHistory}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should show suggestions for longer input', () => {
    render(
      <SmartSuggestions
        input="create"
        history={mockHistory}
      />
    );

    expect(screen.getByText('💡 Smart Suggestions')).toBeInTheDocument();
  });

  it('should include context-based suggestions when context is provided', () => {
    render(
      <SmartSuggestions
        input="create"
        history={mockHistory}
        context={mockContext}
      />
    );

    expect(screen.getByText('💡 Smart Suggestions')).toBeInTheDocument();
    // Should include context-aware suggestions
    expect(screen.getByText(/create-feature/)).toBeInTheDocument();
  });

  it('should include file-based suggestions when recent files are available', () => {
    render(
      <SmartSuggestions
        input="edit"
        history={mockHistory}
        context={mockContext}
      />
    );

    // Should suggest recent files for editing
    expect(screen.getByText(/App\.tsx/)).toBeInTheDocument();
  });

  it('should limit suggestions to maxSuggestions', () => {
    render(
      <SmartSuggestions
        input="test"
        history={mockHistory}
        context={mockContext}
        maxSuggestions={2}
      />
    );

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(2);
  });

  it('should show different icons for different suggestion types', () => {
    render(
      <SmartSuggestions
        input="create"
        history={mockHistory}
        context={mockContext}
      />
    );

    // Should have different type icons
    expect(screen.getByText('⏱️')).toBeInTheDocument(); // history icon
    expect(screen.getByText('💡')).toBeInTheDocument(); // completion icon
    expect(screen.getByText('🎯')).toBeInTheDocument(); // context icon
  });

  it('should handle empty history gracefully', () => {
    render(
      <SmartSuggestions
        input="create component"
        history={[]}
      />
    );

    // Should still show completion suggestions even without history
    expect(screen.getByText('💡 Smart Suggestions')).toBeInTheDocument();
  });

  it('should show confidence scores', () => {
    render(
      <SmartSuggestions
        input="create"
        history={mockHistory}
      />
    );

    // Should display confidence percentages
    const confidenceText = screen.getByText(/\d+%/);
    expect(confidenceText).toBeInTheDocument();
  });
});

describe('Intent Types and Confidence - Comprehensive Tests', () => {
  let mockOnIntentDetected: any;
  const mockCommands = [
    { name: 'test', aliases: ['t'], description: 'Run tests' },
    { name: 'build', aliases: ['b'], description: 'Build project' },
  ];

  beforeEach(() => {
    mockOnIntentDetected = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should assign correct intent types for various inputs', async () => {
    const testCases = [
      { input: '/test', expectedType: 'command', expectedConfidence: 1.0 },
      { input: 'help with testing', expectedType: 'help', expectedConfidence: 0.8 },
      { input: 'What is this feature?', expectedType: 'question' },
      { input: 'config set debug true', expectedType: 'config', expectedConfidence: 0.8 },
      { input: 'create new feature', expectedType: 'task' },
      { input: 'fix the login bug', expectedType: 'task' },
      { input: 'update documentation', expectedType: 'task' },
      { input: 'remove old code', expectedType: 'task' },
      { input: 'test the application', expectedType: 'task' },
      { input: 'deploy to production', expectedType: 'task' },
      { input: 'go to settings', expectedType: 'navigation', expectedConfidence: 0.8 },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const localMock = vi.fn();

      const { unmount } = render(
        <IntentDetector
          key={i}
          input={testCase.input}
          commands={mockCommands}
          onIntentDetected={localMock}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(localMock).toHaveBeenCalled();
        const intent = localMock.mock.calls[0][0] as Intent;

        expect(intent.type).toBe(testCase.expectedType);

        if (testCase.expectedConfidence) {
          expect(intent.confidence).toBe(testCase.expectedConfidence);
        } else {
          expect(intent.confidence).toBeGreaterThan(0.3);
        }
      }, { timeout: 2000 });

      unmount();
    }
  });

  it('should provide task suggestions for different action words', async () => {
    const taskInputs = [
      'create new component',
      'fix authentication bug',
      'update user interface',
      'remove deprecated code',
      'test payment flow',
      'deploy latest version'
    ];

    for (let i = 0; i < taskInputs.length; i++) {
      const input = taskInputs[i];
      const localMock = vi.fn();

      const { unmount } = render(
        <IntentDetector
          key={i}
          input={input}
          commands={mockCommands}
          onIntentDetected={localMock}
          showSuggestions={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(localMock).toHaveBeenCalled();
        const intent = localMock.mock.calls[0][0] as Intent;

        expect(intent.type).toBe('task');
        expect(intent.confidence).toBeGreaterThanOrEqual(0.5);
        expect(intent.suggestions).toBeDefined();
        expect(Array.isArray(intent.suggestions)).toBe(true);
      }, { timeout: 2000 });

      unmount();
    }
  });
});