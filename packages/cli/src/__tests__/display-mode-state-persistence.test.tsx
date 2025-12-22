/**
 * State Persistence Edge Case Tests for Display Modes
 *
 * Tests that display mode state properly persists through various
 * application state changes, edge cases, and error conditions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { App, type AppState, type Message } from '../ui/App';
import type { DisplayMode, Task } from '@apexcli/core';

// Mock ink hooks
const mockUseInput = vi.fn();
const mockUseApp = vi.fn(() => ({ exit: vi.fn() }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useApp: mockUseApp,
    useStdout: () => ({ stdout: { columns: 120 } }),
    Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, color, ...props }: any) => <span style={{ color }} {...props}>{children}</span>,
  };
});

// Mock service dependencies
vi.mock('../services/ConversationManager', () => ({
  ConversationManager: class MockConversationManager {
    addMessage = vi.fn();
    clearContext = vi.fn();
    getSuggestions = vi.fn(() => []);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.8 }));
    hasPendingClarification = vi.fn(() => false);
    provideClarification = vi.fn();
    setTask = vi.fn();
    setAgent = vi.fn();
    clearTask = vi.fn();
    clearAgent = vi.fn();
  },
}));

vi.mock('../services/ShortcutManager', () => ({
  ShortcutManager: class MockShortcutManager {
    on = vi.fn();
    pushContext = vi.fn();
    popContext = vi.fn();
    handleKey = vi.fn(() => false);
  },
}));

vi.mock('../services/CompletionEngine', () => ({
  CompletionEngine: class MockCompletionEngine {
    getCompletions = vi.fn(() => []);
    updateContext = vi.fn();
  },
}));

// Track display mode across renders
let lastReceivedDisplayMode: DisplayMode | undefined;

// Mock UI components with display mode tracking
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children, ...props }: any) => <div data-testid="banner" {...props}>{children}</div>,
  InputPrompt: ({ onSubmit, disabled, ...props }: any) => (
    <div data-testid="input-prompt" data-disabled={disabled} {...props}>
      <button
        data-testid="submit-compact"
        onClick={() => onSubmit('/compact')}
      >
        /compact
      </button>
      <button
        data-testid="submit-verbose"
        onClick={() => onSubmit('/verbose')}
      >
        /verbose
      </button>
      <button
        data-testid="submit-task"
        onClick={() => onSubmit('Create new feature')}
      >
        Submit Task
      </button>
    </div>
  ),
  ServicesPanel: (props: any) => <div data-testid="services-panel" {...props} />,
  PreviewPanel: (props: any) => <div data-testid="preview-panel" {...props} />,
  ResponseStream: ({ displayMode, ...props }: any) => {
    lastReceivedDisplayMode = displayMode;
    return <div data-testid="response-stream" data-display-mode={displayMode} {...props} />;
  },
  StatusBar: ({ displayMode, ...props }: any) => {
    lastReceivedDisplayMode = displayMode;
    return <div data-testid="status-bar" data-display-mode={displayMode} {...props} />;
  },
  TaskProgress: ({ displayMode, ...props }: any) => {
    lastReceivedDisplayMode = displayMode;
    return <div data-testid="task-progress" data-display-mode={displayMode} {...props} />;
  },
  AgentPanel: ({ displayMode, ...props }: any) => {
    lastReceivedDisplayMode = displayMode;
    return <div data-testid="agent-panel" data-display-mode={displayMode} {...props} />;
  },
  ToolCall: ({ displayMode, ...props }: any) => {
    lastReceivedDisplayMode = displayMode;
    return <div data-testid="tool-call" data-display-mode={displayMode} {...props} />;
  },
}));

describe('Display Mode State Persistence - Edge Cases', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let baseState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    lastReceivedDisplayMode = undefined;

    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();

    baseState = {
      initialized: true,
      projectPath: '/test/project',
      config: null,
      orchestrator: null,
      gitBranch: 'main',
      currentTask: undefined,
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 0, output: 0 },
      cost: 0,
      model: 'claude-3-sonnet',
      activeAgent: undefined,
      displayMode: 'normal' as DisplayMode,
      previewMode: false,
      showThoughts: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('State Persistence Through Task Lifecycle', () => {
    it('should maintain display mode when task is created', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Verify initial compact mode
      expect(lastReceivedDisplayMode).toBe('compact');

      // Simulate task creation
      const newTask: Task = {
        id: 'new-task',
        description: 'Test task',
        status: 'pending',
        workflow: 'feature',
        createdAt: new Date(),
      };

      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', currentTask: newTask }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Display mode should persist
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'compact');
      expect(lastReceivedDisplayMode).toBe('compact');
    });

    it('should maintain display mode during task status changes', async () => {
      const task: Task = {
        id: 'test-task',
        description: 'Test task',
        status: 'pending',
        workflow: 'feature',
        createdAt: new Date(),
      };

      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', currentTask: task }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Task status changes
      const statuses = ['in-progress', 'completed', 'failed', 'cancelled'] as const;

      for (const status of statuses) {
        rerender(
          <App
            initialState={{
              ...baseState,
              displayMode: 'verbose',
              currentTask: { ...task, status }
            }}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );

        expect(lastReceivedDisplayMode).toBe('verbose');
        expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'verbose');
      }
    });

    it('should maintain display mode when task is cleared', async () => {
      const task: Task = {
        id: 'test-task',
        description: 'Test task',
        status: 'completed',
        workflow: 'feature',
        createdAt: new Date(),
      };

      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact', currentTask: task }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Clear task
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', currentTask: undefined }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');
    });
  });

  describe('State Persistence Through Message Changes', () => {
    it('should maintain display mode when messages are added', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'verbose' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Add messages progressively
      const messageStates = [
        { messages: [{ id: '1', type: 'user', content: 'Hello', timestamp: new Date() }] },
        {
          messages: [
            { id: '1', type: 'user', content: 'Hello', timestamp: new Date() },
            { id: '2', type: 'assistant', content: 'Hi there!', timestamp: new Date() },
          ]
        },
        {
          messages: [
            { id: '1', type: 'user', content: 'Hello', timestamp: new Date() },
            { id: '2', type: 'assistant', content: 'Hi there!', timestamp: new Date() },
            { id: '3', type: 'system', content: 'System message', timestamp: new Date() },
          ]
        },
      ];

      for (const messageState of messageStates) {
        rerender(
          <App
            initialState={{
              ...baseState,
              displayMode: 'verbose',
              messages: messageState.messages as Message[]
            }}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );

        expect(lastReceivedDisplayMode).toBe('verbose');
      }
    });

    it('should maintain display mode when messages are cleared', async () => {
      const messagesState = {
        messages: [
          { id: '1', type: 'user', content: 'Hello', timestamp: new Date() },
          { id: '2', type: 'assistant', content: 'Hi there!', timestamp: new Date() },
        ] as Message[]
      };

      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact', ...messagesState }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Clear messages
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', messages: [] }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');
    });
  });

  describe('State Persistence Through Processing State Changes', () => {
    it('should maintain display mode during processing state transitions', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', isProcessing: false }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Start processing
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', isProcessing: true }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // End processing
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', isProcessing: false }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');
    });

    it('should allow display mode changes during processing', async () => {
      render(
        <App
          initialState={{ ...baseState, displayMode: 'normal', isProcessing: true }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const compactButton = screen.getByTestId('submit-compact');

      await act(async () => {
        compactButton.click();
      });

      await act(async () => {
        vi.runAllTimers();
      });

      // Display mode should change even during processing
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'compact');
    });
  });

  describe('State Persistence Through Agent Changes', () => {
    it('should maintain display mode when active agent changes', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact', activeAgent: undefined }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Change active agent
      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

      for (const agent of agents) {
        rerender(
          <App
            initialState={{ ...baseState, displayMode: 'compact', activeAgent: agent }}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );

        expect(lastReceivedDisplayMode).toBe('compact');
      }

      // Clear active agent
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', activeAgent: undefined }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');
    });

    it('should maintain display mode through agent handoff scenarios', async () => {
      const { rerender } = render(
        <App
          initialState={{
            ...baseState,
            displayMode: 'verbose',
            activeAgent: 'planner',
            previousAgent: undefined
          }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Simulate agent handoff
      rerender(
        <App
          initialState={{
            ...baseState,
            displayMode: 'verbose',
            activeAgent: 'developer',
            previousAgent: 'planner'
          }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');
    });
  });

  describe('State Persistence Through Error Conditions', () => {
    it('should maintain display mode when command execution fails', async () => {
      mockOnCommand.mockRejectedValueOnce(new Error('Command failed'));

      render(
        <App
          initialState={{ ...baseState, displayMode: 'compact' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const taskButton = screen.getByTestId('submit-task');

      await act(async () => {
        taskButton.click();
      });

      // Display mode should persist even after command failure
      expect(lastReceivedDisplayMode).toBe('compact');
    });

    it('should maintain display mode when task execution fails', async () => {
      mockOnTask.mockRejectedValueOnce(new Error('Task failed'));

      render(
        <App
          initialState={{ ...baseState, displayMode: 'verbose' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const taskButton = screen.getByTestId('submit-task');

      await act(async () => {
        taskButton.click();
      });

      // Display mode should persist even after task failure
      expect(lastReceivedDisplayMode).toBe('verbose');
    });

    it('should handle null/undefined display mode gracefully', async () => {
      const invalidState = {
        ...baseState,
        displayMode: null as any,
      };

      expect(() => {
        render(
          <App
            initialState={invalidState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );
      }).not.toThrow();

      expect(lastReceivedDisplayMode).toBe(null);
    });

    it('should handle invalid display mode values gracefully', async () => {
      const invalidState = {
        ...baseState,
        displayMode: 'invalid-mode' as any,
      };

      expect(() => {
        render(
          <App
            initialState={invalidState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );
      }).not.toThrow();

      expect(lastReceivedDisplayMode).toBe('invalid-mode');
    });
  });

  describe('State Persistence Through Configuration Changes', () => {
    it('should maintain display mode when project configuration changes', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact', config: null }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Simulate config loading
      const mockConfig = {
        project: { name: 'test-project' },
        autonomy: 'review-before-commit' as const,
        agents: {},
        workflows: {},
        limits: { maxCost: 10, maxTokens: 100000 },
        git: { branchPrefix: 'apex/' },
      };

      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', config: mockConfig }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');
    });

    it('should maintain display mode when API/Web URLs change', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'verbose' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Add API URL
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', apiUrl: 'http://localhost:4000' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Add Web URL
      rerender(
        <App
          initialState={{
            ...baseState,
            displayMode: 'verbose',
            apiUrl: 'http://localhost:4000',
            webUrl: 'http://localhost:3000'
          }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');
    });
  });

  describe('Race Conditions and Timing Issues', () => {
    it('should handle rapid display mode changes without state corruption', async () => {
      render(
        <App
          initialState={{ ...baseState, displayMode: 'normal' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const compactButton = screen.getByTestId('submit-compact');
      const verboseButton = screen.getByTestId('submit-verbose');

      // Rapid fire mode changes
      await act(async () => {
        compactButton.click();
      });

      await act(async () => {
        verboseButton.click();
      });

      await act(async () => {
        compactButton.click();
      });

      await act(async () => {
        verboseButton.click();
      });

      await act(async () => {
        vi.runAllTimers();
      });

      // Final state should be consistent
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'verbose');
      expect(lastReceivedDisplayMode).toBe('verbose');
    });

    it('should handle display mode changes during async operations', async () => {
      mockOnTask.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(
        <App
          initialState={{ ...baseState, displayMode: 'normal' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const compactButton = screen.getByTestId('submit-compact');
      const taskButton = screen.getByTestId('submit-task');

      // Start async task
      await act(async () => {
        taskButton.click();
      });

      // Change display mode during async operation
      await act(async () => {
        compactButton.click();
      });

      await act(async () => {
        vi.runAllTimers();
      });

      // Display mode should be updated even during async operation
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'compact');
    });
  });

  describe('Memory Leaks and Cleanup', () => {
    it('should not accumulate state when components are unmounted and remounted', async () => {
      const { unmount, rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Unmount and remount
      unmount();

      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'verbose' }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should have fresh state
      expect(lastReceivedDisplayMode).toBe('verbose');
    });

    it('should handle component re-initialization properly', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact', initialized: false }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Simulate initialization
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', initialized: true }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');
    });
  });

  describe('Integration with Other State Management', () => {
    it('should maintain display mode when preview mode is toggled', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', previewMode: false }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Toggle preview mode
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', previewMode: true }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');

      // Toggle back
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'verbose', previewMode: false }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('verbose');
    });

    it('should maintain display mode when thoughts visibility is toggled', async () => {
      const { rerender } = render(
        <App
          initialState={{ ...baseState, displayMode: 'compact', showThoughts: false }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');

      // Toggle thoughts
      rerender(
        <App
          initialState={{ ...baseState, displayMode: 'compact', showThoughts: true }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      expect(lastReceivedDisplayMode).toBe('compact');
    });
  });
});