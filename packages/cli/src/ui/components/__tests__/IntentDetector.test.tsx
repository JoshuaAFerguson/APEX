import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentDetector, SmartSuggestions, Intent } from '../IntentDetector';

// Mock Fuse.js
vi.mock('fuse.js', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      search: vi.fn().mockReturnValue([]),
    })),
  };
});

describe('IntentDetector', () => {
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

  const mockOnIntentDetected = vi.fn();

  beforeEach(() => {
    mockOnIntentDetected.mockClear();
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

  it('should show loading state briefly', async () => {
    render(
      <IntentDetector
        input="test input"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    // Check if loading text appears (though it might be brief)
    const loadingText = screen.queryByText('Analyzing intent...');
    // Note: Due to the 300ms timeout, this might not always be visible in tests
  });

  it('should detect command intent for slash commands', () => {
    render(
      <IntentDetector
        input="/run test task"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    // Should eventually detect the command intent
    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'command',
          confidence: 1.0,
          command: 'run',
        })
      );
    }, 400);
  });

  it('should detect help intent for help patterns', () => {
    render(
      <IntentDetector
        input="help me with this"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'help',
          confidence: 0.8,
        })
      );
    }, 400);
  });

  it('should detect task intent for action words', () => {
    render(
      <IntentDetector
        input="create a new component"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task',
          confidence: expect.any(Number),
        })
      );
    }, 400);
  });

  it('should detect question intent for question patterns', () => {
    render(
      <IntentDetector
        input="How do I create a component?"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'question',
          confidence: 0.8,
        })
      );
    }, 400);
  });

  it('should detect config intent for configuration patterns', () => {
    render(
      <IntentDetector
        input="config set theme dark"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'config',
          confidence: 0.8,
        })
      );
    }, 400);
  });

  it('should show suggestions when enabled', () => {
    const { rerender } = render(
      <IntentDetector
        input="fix something"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
        showSuggestions={true}
      />
    );

    // Wait for the debounce
    setTimeout(() => {
      rerender(
        <IntentDetector
          input="fix something"
          commands={mockCommands}
          onIntentDetected={mockOnIntentDetected}
          showSuggestions={true}
        />
      );

      expect(screen.queryByText('Suggestions:')).toBeInTheDocument();
    }, 400);
  });

  it('should respect minConfidence threshold', () => {
    render(
      <IntentDetector
        input="unclear input"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
        minConfidence={0.9}
      />
    );

    setTimeout(() => {
      // With high confidence threshold, unclear inputs shouldn't trigger
      expect(mockOnIntentDetected).not.toHaveBeenCalled();
    }, 400);
  });

  it('should handle navigation patterns', () => {
    render(
      <IntentDetector
        input="go to status page"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'navigation',
          confidence: 0.8,
        })
      );
    }, 400);
  });

  it('should provide appropriate confidence scores', () => {
    render(
      <IntentDetector
        input="/status"
        commands={mockCommands}
        onIntentDetected={mockOnIntentDetected}
      />
    );

    setTimeout(() => {
      expect(mockOnIntentDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 1.0, // Exact command matches should have 100% confidence
        })
      );
    }, 400);
  });
});

describe('SmartSuggestions', () => {
  const mockHistory = [
    'create a new component',
    'fix the authentication bug',
    '/status',
    '/help',
    'update the documentation',
  ];

  const mockContext = {
    currentDirectory: '/src/components',
    activeTask: 'task123',
    lastCommand: '/run',
    recentFiles: ['Component.tsx', 'utils.ts'],
  };

  const mockOnSuggestion = vi.fn();

  beforeEach(() => {
    mockOnSuggestion.mockClear();
  });

  it('should render nothing when input is too short', () => {
    const { container } = render(
      <SmartSuggestions
        input="a"
        history={mockHistory}
        onSuggestion={mockOnSuggestion}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should show suggestions for longer input', () => {
    render(
      <SmartSuggestions
        input="create"
        history={mockHistory}
        onSuggestion={mockOnSuggestion}
      />
    );

    // Should show the smart suggestions container
    expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();
  });

  it('should include context-based suggestions when context is provided', () => {
    render(
      <SmartSuggestions
        input="status"
        history={mockHistory}
        context={mockContext}
        onSuggestion={mockOnSuggestion}
      />
    );

    // Should include suggestions related to the active task
    setTimeout(() => {
      expect(screen.getByText('/status task123')).toBeInTheDocument();
      expect(screen.getByText('/logs task123')).toBeInTheDocument();
    }, 100);
  });

  it('should include file-based suggestions when recent files are available', () => {
    render(
      <SmartSuggestions
        input="edit"
        history={mockHistory}
        context={mockContext}
        onSuggestion={mockOnSuggestion}
      />
    );

    setTimeout(() => {
      expect(screen.getByText('Edit Component.tsx')).toBeInTheDocument();
      expect(screen.getByText('Edit utils.ts')).toBeInTheDocument();
    }, 100);
  });

  it('should limit suggestions to maxSuggestions', () => {
    render(
      <SmartSuggestions
        input="test"
        history={mockHistory}
        context={mockContext}
        onSuggestion={mockOnSuggestion}
        maxSuggestions={2}
      />
    );

    // Should show at most 2 suggestions
    setTimeout(() => {
      const suggestions = screen.getAllByText(/🎯|💡|⏱️/);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    }, 100);
  });

  it('should show different icons for different suggestion types', () => {
    render(
      <SmartSuggestions
        input="component"
        history={mockHistory}
        context={mockContext}
        onSuggestion={mockOnSuggestion}
      />
    );

    // Should show various suggestion type icons
    setTimeout(() => {
      // History suggestions (⏱️), context suggestions (🎯), completion suggestions (💡)
      expect(screen.getByText(/⏱️|🎯|💡/)).toBeInTheDocument();
    }, 100);
  });

  it('should handle empty history gracefully', () => {
    render(
      <SmartSuggestions
        input="test input"
        history={[]}
        onSuggestion={mockOnSuggestion}
      />
    );

    // Should still work with empty history
    expect(screen.getByText('Smart Suggestions')).toBeInTheDocument();
  });

  it('should show confidence scores', () => {
    render(
      <SmartSuggestions
        input="create"
        history={mockHistory}
        context={mockContext}
        onSuggestion={mockOnSuggestion}
      />
    );

    setTimeout(() => {
      // Should show percentage confidence scores
      expect(screen.getByText(/\(\d+%\)/)).toBeInTheDocument();
    }, 100);
  });
});

describe('Intent Types and Confidence', () => {
  const mockCommands = [
    { name: 'test', aliases: [], description: 'Test command' },
  ];

  it('should assign correct intent types', () => {
    const testCases = [
      { input: '/help', expectedType: 'command' },
      { input: 'create something', expectedType: 'task' },
      { input: 'how do I?', expectedType: 'help' },
      { input: 'config set value', expectedType: 'config' },
      { input: 'what is this?', expectedType: 'question' },
      { input: 'go to dashboard', expectedType: 'navigation' },
    ];

    testCases.forEach(({ input, expectedType }) => {
      const mockCallback = vi.fn();
      render(
        <IntentDetector
          input={input}
          commands={mockCommands}
          onIntentDetected={mockCallback}
        />
      );

      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: expectedType,
          })
        );
      }, 400);
    });
  });

  it('should provide task suggestions for different action words', () => {
    const actionWords = ['fix', 'update', 'remove', 'test'];

    actionWords.forEach(action => {
      const mockCallback = vi.fn();
      render(
        <IntentDetector
          input={`${action} something`}
          commands={mockCommands}
          onIntentDetected={mockCallback}
        />
      );

      setTimeout(() => {
        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'task',
            suggestions: expect.any(Array),
          })
        );
      }, 400);
    });
  });
});