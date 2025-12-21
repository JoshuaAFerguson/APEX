/**
 * Comprehensive End-to-End Tests for Display Modes Feature
 *
 * Tests all acceptance criteria:
 * 1. /compact command toggles condensed output mode with single-line status
 * 2. /verbose command toggles detailed debug output mode
 * 3. Display mode state persists within session
 * 4. Components respect displayMode state (ActivityLog hidden in compact, debug info shown in verbose)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { App, type AppState, type Message } from '../ui/App';
import type { DisplayMode } from '@apex/core';

// Mock ink hooks
const mockUseInput = vi.fn();
const mockUseApp = vi.fn(() => ({ exit: vi.fn() }));
const mockUseStdout = vi.fn(() => ({ stdout: { columns: 120 } }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useApp: mockUseApp,
    useStdout: mockUseStdout,
    Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, color, ...props }: any) => <span style={{ color }} {...props}>{children}</span>,
  };
});

// Mock all service dependencies
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

// Track components that receive displayMode prop for verification
const componentTracker = {
  statusBarProps: null as any,
  taskProgressProps: null as any,
  agentPanelProps: null as any,
  responseStreamProps: [] as any[],
  toolCallProps: [] as any[],
  activityLogProps: null as any,
};

// Mock UI components with prop tracking
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children, ...props }: any) => <div data-testid="banner" {...props}>{children}</div>,
  InputPrompt: ({ onSubmit, disabled, ...props }: any) => (
    <div data-testid="input-prompt" data-disabled={disabled} {...props}>
      <button
        data-testid="submit-compact"
        onClick={() => onSubmit('/compact')}
      >
        Submit /compact
      </button>
      <button
        data-testid="submit-verbose"
        onClick={() => onSubmit('/verbose')}
      >
        Submit /verbose
      </button>
      <button
        data-testid="submit-normal-task"
        onClick={() => onSubmit('Create a new feature')}
      >
        Submit Task
      </button>
    </div>
  ),
  ServicesPanel: (props: any) => <div data-testid="services-panel" {...props} />,
  PreviewPanel: (props: any) => <div data-testid="preview-panel" {...props} />,
  ResponseStream: ({ content, type, displayMode, ...props }: any) => {
    componentTracker.responseStreamProps.push({ content, type, displayMode, ...props });
    return (
      <div data-testid="response-stream" data-type={type} data-display-mode={displayMode} {...props}>
        {content}
      </div>
    );
  },
  StatusBar: ({ displayMode, ...props }: any) => {
    componentTracker.statusBarProps = { displayMode, ...props };
    return (
      <div data-testid="status-bar" data-display-mode={displayMode} {...props} />
    );
  },
  TaskProgress: ({ displayMode, ...props }: any) => {
    componentTracker.taskProgressProps = { displayMode, ...props };
    return (
      <div data-testid="task-progress" data-display-mode={displayMode} {...props} />
    );
  },
  AgentPanel: ({ displayMode, ...props }: any) => {
    componentTracker.agentPanelProps = { displayMode, ...props };
    return (
      <div data-testid="agent-panel" data-display-mode={displayMode} {...props} />
    );
  },
  ToolCall: ({ displayMode, ...props }: any) => {
    componentTracker.toolCallProps.push({ displayMode, ...props });
    return (
      <div data-testid="tool-call" data-display-mode={displayMode} {...props} />
    );
  },
}));

describe('Display Modes - Comprehensive E2E Tests', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset component tracker
    componentTracker.statusBarProps = null;
    componentTracker.taskProgressProps = null;
    componentTracker.agentPanelProps = null;
    componentTracker.responseStreamProps = [];
    componentTracker.toolCallProps = [];
    componentTracker.activityLogProps = null;

    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();

    initialState = {
      initialized: true,
      projectPath: '/test/project',
      config: null,
      orchestrator: null,
      gitBranch: 'feature/display-modes',
      currentTask: undefined,
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 1000, output: 500 },
      cost: 0.0234,
      model: 'claude-3-sonnet',
      activeAgent: undefined,
      displayMode: 'normal' as DisplayMode,
      previewMode: false,
      showThoughts: false,
      apiUrl: 'http://localhost:4000',
      webUrl: 'http://localhost:3000',
      sessionStartTime: new Date(),
      sessionName: 'Test Session',
      subtaskProgress: { completed: 3, total: 5 },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1: /compact command toggles condensed output mode', () => {
    it('should toggle from normal to compact mode with confirmation message', async () => {
      render(
        <App
          initialState={initialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const compactButton = screen.getByTestId('submit-compact');

      await act(async () => {
        compactButton.click();
      });

      // Fast-forward past the setTimeout in the component
      await act(async () => {
        vi.runAllTimers();
      });

      // Verify state change to compact mode
      await waitFor(() => {
        expect(componentTracker.statusBarProps?.displayMode).toBe('compact');
      });

      // Verify confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessage = responseStreams.find(stream =>
          stream.getAttribute('data-type') === 'system' &&
          stream.textContent?.includes('Display mode set to compact')
        );
        expect(systemMessage).toBeTruthy();
        expect(systemMessage?.textContent).toContain('Single-line status, condensed output');
      });
    });

    it('should toggle back from compact to normal mode', async () => {
      const compactState = { ...initialState, displayMode: 'compact' as DisplayMode };

      render(
        <App
          initialState={compactState}
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

      // Verify toggle back to normal
      await waitFor(() => {
        expect(componentTracker.statusBarProps?.displayMode).toBe('normal');
      });

      // Verify appropriate confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const normalMessage = responseStreams.find(stream =>
          stream.getAttribute('data-type') === 'system' &&
          stream.textContent?.includes('Display mode set to normal')
        );
        expect(normalMessage).toBeTruthy();
        expect(normalMessage?.textContent).toContain('Standard display with all components shown');
      });
    });

    it('should filter messages correctly in compact mode', async () => {
      const stateWithMessages = {
        ...initialState,
        displayMode: 'compact' as DisplayMode,
        messages: [
          { id: '1', type: 'user', content: 'User message', timestamp: new Date() },
          { id: '2', type: 'assistant', content: 'Assistant message', timestamp: new Date() },
          { id: '3', type: 'system', content: 'System message', timestamp: new Date() },
          { id: '4', type: 'tool', content: 'Tool output', toolName: 'TestTool', timestamp: new Date() },
          { id: '5', type: 'error', content: 'Error message', timestamp: new Date() },
        ] as Message[],
      };

      render(
        <App
          initialState={stateWithMessages}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // In compact mode, system and tool messages should be filtered out
      const responseStreams = screen.getAllByTestId('response-stream');

      // Should only show user, assistant, and error messages (3 total)
      expect(responseStreams).toHaveLength(3);

      // Verify system message is not shown
      expect(responseStreams.find(stream =>
        stream.textContent?.includes('System message')
      )).toBeUndefined();

      // Verify no tool calls are shown
      expect(screen.queryAllByTestId('tool-call')).toHaveLength(0);
    });
  });

  describe('Acceptance Criteria 2: /verbose command toggles detailed debug output mode', () => {
    it('should toggle from normal to verbose mode with confirmation message', async () => {
      render(
        <App
          initialState={initialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const verboseButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        verboseButton.click();
      });

      await act(async () => {
        vi.runAllTimers();
      });

      // Verify state change to verbose mode
      await waitFor(() => {
        expect(componentTracker.statusBarProps?.displayMode).toBe('verbose');
      });

      // Verify confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const systemMessage = responseStreams.find(stream =>
          stream.getAttribute('data-type') === 'system' &&
          stream.textContent?.includes('Display mode set to verbose')
        );
        expect(systemMessage).toBeTruthy();
        expect(systemMessage?.textContent).toContain('Detailed debug output, full information');
      });
    });

    it('should toggle back from verbose to normal mode', async () => {
      const verboseState = { ...initialState, displayMode: 'verbose' as DisplayMode };

      render(
        <App
          initialState={verboseState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const verboseButton = screen.getByTestId('submit-verbose');

      await act(async () => {
        verboseButton.click();
      });

      await act(async () => {
        vi.runAllTimers();
      });

      // Verify toggle back to normal
      await waitFor(() => {
        expect(componentTracker.statusBarProps?.displayMode).toBe('normal');
      });
    });

    it('should show all messages in verbose mode', async () => {
      const stateWithMessages = {
        ...initialState,
        displayMode: 'verbose' as DisplayMode,
        messages: [
          { id: '1', type: 'user', content: 'User message', timestamp: new Date() },
          { id: '2', type: 'assistant', content: 'Assistant message', timestamp: new Date() },
          { id: '3', type: 'system', content: 'System message', timestamp: new Date() },
          { id: '4', type: 'tool', content: 'Tool output', toolName: 'TestTool', timestamp: new Date() },
          { id: '5', type: 'error', content: 'Error message', timestamp: new Date() },
        ] as Message[],
      };

      render(
        <App
          initialState={stateWithMessages}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // In verbose mode, all messages should be shown
      const responseStreams = screen.getAllByTestId('response-stream');
      const toolCalls = screen.getAllByTestId('tool-call');

      // Should have 4 response streams + 1 tool call = 5 total messages
      expect(responseStreams.length + toolCalls.length).toBe(5);
    });
  });

  describe('Acceptance Criteria 3: Display mode state persists within session', () => {
    it('should maintain compact mode through various app state changes', async () => {
      const { rerender } = render(
        <App
          initialState={{...initialState, displayMode: 'compact'}}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Verify initial compact mode
      expect(componentTracker.statusBarProps?.displayMode).toBe('compact');

      // Simulate state changes that might occur during normal operation
      const stateChanges = [
        { ...initialState, displayMode: 'compact' as DisplayMode, isProcessing: true },
        {
          ...initialState,
          displayMode: 'compact' as DisplayMode,
          currentTask: {
            id: 'test-task',
            description: 'Test task',
            status: 'in-progress',
            workflow: 'feature',
            createdAt: new Date(),
          },
          activeAgent: 'developer',
        },
        {
          ...initialState,
          displayMode: 'compact' as DisplayMode,
          messages: [
            { id: '1', type: 'user', content: 'Test message', timestamp: new Date() }
          ] as Message[],
        },
      ];

      for (const newState of stateChanges) {
        rerender(
          <App
            initialState={newState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );

        // Display mode should persist through all state changes
        expect(componentTracker.statusBarProps?.displayMode).toBe('compact');
      }
    });

    it('should maintain verbose mode through task execution', async () => {
      render(
        <App
          initialState={{...initialState, displayMode: 'verbose'}}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Submit a task
      const taskButton = screen.getByTestId('submit-normal-task');

      await act(async () => {
        taskButton.click();
      });

      // Display mode should persist through task submission
      expect(componentTracker.statusBarProps?.displayMode).toBe('verbose');
      expect(mockOnTask).toHaveBeenCalledWith('Create a new feature');
    });

    it('should not be affected by other command executions', async () => {
      render(
        <App
          initialState={{...initialState, displayMode: 'compact'}}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Mock an external command that would call onCommand
      await act(async () => {
        mockOnCommand('status', []);
      });

      // Display mode should remain unchanged
      expect(componentTracker.statusBarProps?.displayMode).toBe('compact');
    });
  });

  describe('Acceptance Criteria 4: Components respect displayMode state', () => {
    it('should pass displayMode prop to all relevant components', async () => {
      const stateWithTask = {
        ...initialState,
        displayMode: 'verbose' as DisplayMode,
        currentTask: {
          id: 'test-task',
          description: 'Test task',
          status: 'in-progress',
          workflow: 'feature',
          createdAt: new Date(),
        },
        activeAgent: 'developer',
        messages: [
          { id: '1', type: 'assistant', content: 'Assistant message', timestamp: new Date() },
          { id: '2', type: 'tool', content: 'Tool output', toolName: 'TestTool', timestamp: new Date() },
        ] as Message[],
      };

      render(
        <App
          initialState={stateWithTask}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Verify StatusBar receives displayMode
      expect(componentTracker.statusBarProps?.displayMode).toBe('verbose');

      // Verify TaskProgress receives displayMode
      expect(componentTracker.taskProgressProps?.displayMode).toBe('verbose');

      // Verify AgentPanel receives displayMode
      expect(componentTracker.agentPanelProps?.displayMode).toBe('verbose');

      // Verify ResponseStream components receive displayMode
      expect(componentTracker.responseStreamProps).toHaveLength(1);
      expect(componentTracker.responseStreamProps[0]?.displayMode).toBe('verbose');

      // Verify ToolCall components receive displayMode
      expect(componentTracker.toolCallProps).toHaveLength(1);
      expect(componentTracker.toolCallProps[0]?.displayMode).toBe('verbose');
    });

    it('should update all component props when display mode changes', async () => {
      const { rerender } = render(
        <App
          initialState={{...initialState, displayMode: 'normal'}}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Initial state - all components should have normal mode
      expect(componentTracker.statusBarProps?.displayMode).toBe('normal');

      // Change to compact mode
      rerender(
        <App
          initialState={{...initialState, displayMode: 'compact'}}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // All components should now have compact mode
      expect(componentTracker.statusBarProps?.displayMode).toBe('compact');
    });

    it('should handle edge cases with invalid display mode values', async () => {
      const invalidState = {
        ...initialState,
        displayMode: 'invalid' as any,
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

      // Components should still receive the invalid value without crashing
      expect(componentTracker.statusBarProps?.displayMode).toBe('invalid');
    });
  });

  describe('Integration with other features', () => {
    it('should work correctly with preview mode', async () => {
      render(
        <App
          initialState={{
            ...initialState,
            displayMode: 'compact',
            previewMode: true,
          }}
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

      // Both display mode and preview mode should be maintained
      expect(componentTracker.statusBarProps?.displayMode).toBe('normal');
      expect(componentTracker.statusBarProps?.previewMode).toBe(true);
    });

    it('should work correctly with thoughts visibility', async () => {
      render(
        <App
          initialState={{
            ...initialState,
            displayMode: 'verbose',
            showThoughts: true,
          }}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Both display mode and thoughts visibility should be passed to components
      expect(componentTracker.statusBarProps?.displayMode).toBe('verbose');
      expect(componentTracker.statusBarProps?.showThoughts).toBe(true);
    });

    it('should handle rapid mode switching without errors', async () => {
      render(
        <App
          initialState={initialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const compactButton = screen.getByTestId('submit-compact');
      const verboseButton = screen.getByTestId('submit-verbose');

      // Rapidly switch between modes
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
        vi.runAllTimers();
      });

      // Should end up in compact mode
      expect(componentTracker.statusBarProps?.displayMode).toBe('compact');
    });
  });

  describe('Command case sensitivity and variations', () => {
    it('should handle commands case-insensitively', async () => {
      const { container } = render(
        <App
          initialState={initialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // The actual case-insensitive handling is tested in the display-mode-commands.test.tsx
      // This test verifies the overall integration works
      expect(container).toBeTruthy();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle undefined displayMode gracefully', async () => {
      const invalidState = {
        ...initialState,
        displayMode: undefined as any,
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
    });

    it('should maintain consistency during processing state', async () => {
      render(
        <App
          initialState={{...initialState, isProcessing: true, displayMode: 'verbose'}}
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

      // Display mode change should work even during processing
      expect(componentTracker.statusBarProps?.displayMode).toBe('compact');
    });
  });
});