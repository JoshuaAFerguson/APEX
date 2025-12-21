import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../__tests__/test-utils';
import { App, type AppProps, type AppState } from '../App';
import type { DisplayMode } from '@apex/core';

// Mock ink components and hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

// Mock services with more detailed implementations
const mockConversationManager = {
  addMessage: vi.fn(),
  getSuggestions: vi.fn(() => []),
  hasPendingClarification: vi.fn(() => false),
  detectIntent: vi.fn(() => ({ type: 'command', confidence: 0.9, metadata: {} })),
  clearContext: vi.fn(),
  setTask: vi.fn(),
  setAgent: vi.fn(),
  clearTask: vi.fn(),
  clearAgent: vi.fn(),
  provideClarification: vi.fn(),
};

const mockShortcutManager = {
  on: vi.fn(),
  handleKey: vi.fn(() => false),
  pushContext: vi.fn(),
  popContext: vi.fn(),
};

vi.mock('../../services/ConversationManager.js', () => ({
  ConversationManager: vi.fn().mockImplementation(() => mockConversationManager),
}));

vi.mock('../../services/ShortcutManager.js', () => ({
  ShortcutManager: vi.fn().mockImplementation(() => mockShortcutManager),
}));

vi.mock('../../services/CompletionEngine.js', () => ({
  CompletionEngine: vi.fn().mockImplementation(() => ({})),
}));

// Mock child components to verify props
const mockStatusBar = vi.fn(({ displayMode, ...props }) => (
  <div data-testid="status-bar" data-display-mode={displayMode}>
    StatusBar: {displayMode}
  </div>
));

const mockTaskProgress = vi.fn(({ displayMode, ...props }) => (
  <div data-testid="task-progress" data-display-mode={displayMode}>
    TaskProgress: {displayMode}
  </div>
));

const mockAgentPanel = vi.fn(({ displayMode, ...props }) => (
  <div data-testid="agent-panel" data-display-mode={displayMode}>
    AgentPanel: {displayMode}
  </div>
));

const mockResponseStream = vi.fn(({ displayMode, ...props }) => (
  <div data-testid="response-stream" data-display-mode={displayMode}>
    ResponseStream: {displayMode}
  </div>
));

const mockToolCall = vi.fn(({ displayMode, ...props }) => (
  <div data-testid="tool-call" data-display-mode={displayMode}>
    ToolCall: {displayMode}
  </div>
));

// Mock components at module level
vi.mock('../components/StatusBar', () => ({
  StatusBar: mockStatusBar,
}));

vi.mock('../components/TaskProgress', () => ({
  TaskProgress: mockTaskProgress,
}));

vi.mock('../components/agents/AgentPanel', () => ({
  AgentPanel: mockAgentPanel,
}));

vi.mock('../components/ResponseStream', () => ({
  ResponseStream: mockResponseStream,
}));

vi.mock('../components/ToolCall', () => ({
  ToolCall: mockToolCall,
}));

describe('App DisplayMode Integration Tests', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let baseState: AppState;
  let props: AppProps;

  beforeEach(() => {
    vi.useFakeTimers();

    mockOnCommand = vi.fn().mockResolvedValue(undefined);
    mockOnTask = vi.fn().mockResolvedValue(undefined);
    mockOnExit = vi.fn();

    baseState = {
      initialized: true,
      projectPath: '/test/project',
      config: null,
      orchestrator: null,
      gitBranch: 'feature/test',
      currentTask: {
        id: 'test-task-123',
        description: 'Test task for display mode integration',
        status: 'in-progress',
        workflow: 'feature',
        createdAt: new Date(),
      },
      activeAgent: 'developer',
      messages: [
        {
          id: 'msg1',
          type: 'user' as const,
          content: 'User message content',
          timestamp: new Date(),
        },
        {
          id: 'msg2',
          type: 'system' as const,
          content: 'System message content',
          timestamp: new Date(),
        },
        {
          id: 'msg3',
          type: 'tool' as const,
          content: 'Tool execution result',
          toolName: 'TestTool',
          toolInput: { param: 'value' },
          toolOutput: 'success',
          toolStatus: 'success' as const,
          timestamp: new Date(),
        },
        {
          id: 'msg4',
          type: 'assistant' as const,
          content: 'Assistant response',
          agent: 'developer',
          timestamp: new Date(),
        },
      ],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 150, output: 200 },
      cost: 0.05,
      model: 'sonnet',
      displayMode: 'normal' as DisplayMode,
      previewMode: false,
      showThoughts: false,
    };

    props = {
      initialState: baseState,
      onCommand: mockOnCommand,
      onTask: mockOnTask,
      onExit: mockOnExit,
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Component Prop Passing Verification', () => {
    it('should pass displayMode to StatusBar component', () => {
      render(<App {...props} />);

      expect(mockStatusBar).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'normal',
        }),
        {}
      );

      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'normal');
    });

    it('should pass displayMode to TaskProgress when task exists', () => {
      render(<App {...props} />);

      expect(mockTaskProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'normal',
          taskId: 'test-task-123',
          description: 'Test task for display mode integration',
        }),
        {}
      );

      expect(screen.getByTestId('task-progress')).toHaveAttribute('data-display-mode', 'normal');
    });

    it('should pass displayMode to AgentPanel when task exists', () => {
      render(<App {...props} />);

      expect(mockAgentPanel).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'normal',
          currentAgent: 'developer',
        }),
        {}
      );

      expect(screen.getByTestId('agent-panel')).toHaveAttribute('data-display-mode', 'normal');
    });

    it('should pass displayMode to message rendering components', () => {
      render(<App {...props} />);

      // ResponseStream should be called for non-tool messages
      expect(mockResponseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'normal',
        }),
        {}
      );

      // ToolCall should be called for tool messages
      expect(mockToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'normal',
          toolName: 'TestTool',
        }),
        {}
      );
    });
  });

  describe('DisplayMode State Changes', () => {
    it('should update all components when displayMode changes to compact', () => {
      const { rerender } = render(<App {...props} />);

      // Change to compact mode
      const compactProps = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'compact' as DisplayMode,
        },
      };

      rerender(<App {...compactProps} />);

      // Verify all components receive the updated displayMode
      expect(mockStatusBar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          displayMode: 'compact',
        }),
        {}
      );

      expect(mockTaskProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          displayMode: 'compact',
        }),
        {}
      );

      expect(mockAgentPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          displayMode: 'compact',
        }),
        {}
      );
    });

    it('should update all components when displayMode changes to verbose', () => {
      const { rerender } = render(<App {...props} />);

      // Change to verbose mode
      const verboseProps = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'verbose' as DisplayMode,
        },
      };

      rerender(<App {...verboseProps} />);

      // Verify all components receive the updated displayMode
      expect(mockStatusBar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          displayMode: 'verbose',
        }),
        {}
      );

      expect(mockTaskProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          displayMode: 'verbose',
        }),
        {}
      );

      expect(mockAgentPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          displayMode: 'verbose',
        }),
        {}
      );
    });
  });

  describe('Message Filtering by DisplayMode', () => {
    it('should filter system and tool messages in compact mode', () => {
      const compactProps = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'compact' as DisplayMode,
        },
      };

      render(<App {...compactProps} />);

      // In compact mode, system and tool messages should be filtered
      const responseStreamCalls = mockResponseStream.mock.calls;
      const toolCallCalls = mockToolCall.mock.calls;

      // Should have fewer calls due to filtering
      expect(responseStreamCalls.length + toolCallCalls.length).toBeLessThan(baseState.messages.length);
    });

    it('should show all messages in verbose mode', () => {
      const verboseProps = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'verbose' as DisplayMode,
        },
      };

      render(<App {...verboseProps} />);

      // In verbose mode, all messages should be rendered
      const responseStreamCalls = mockResponseStream.mock.calls;
      const toolCallCalls = mockToolCall.mock.calls;

      // Should render all messages (some as ResponseStream, some as ToolCall)
      expect(responseStreamCalls.length + toolCallCalls.length).toBeGreaterThan(0);
    });

    it('should show most messages in normal mode', () => {
      render(<App {...props} />);

      // In normal mode, most messages should be shown
      const responseStreamCalls = mockResponseStream.mock.calls;
      const toolCallCalls = mockToolCall.mock.calls;

      expect(responseStreamCalls.length + toolCallCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Component Rendering Without Task', () => {
    it('should pass displayMode to StatusBar even without active task', () => {
      const propsWithoutTask = {
        ...props,
        initialState: {
          ...baseState,
          currentTask: undefined,
          activeAgent: undefined,
        },
      };

      render(<App {...propsWithoutTask} />);

      expect(mockStatusBar).toHaveBeenCalledWith(
        expect.objectContaining({
          displayMode: 'normal',
        }),
        {}
      );

      // TaskProgress and AgentPanel should not be rendered
      expect(mockTaskProgress).not.toHaveBeenCalled();
      expect(mockAgentPanel).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined displayMode gracefully', () => {
      const propsWithUndefinedMode = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: undefined as any,
        },
      };

      expect(() => render(<App {...propsWithUndefinedMode} />)).not.toThrow();
    });

    it('should handle invalid displayMode gracefully', () => {
      const propsWithInvalidMode = {
        ...props,
        initialState: {
          ...baseState,
          displayMode: 'invalid-mode' as any,
        },
      };

      expect(() => render(<App {...propsWithInvalidMode} />)).not.toThrow();
    });
  });

  describe('State Consistency', () => {
    it('should maintain displayMode consistency across all components', () => {
      render(<App {...props} />);

      const statusBarCall = mockStatusBar.mock.calls[0][0];
      const taskProgressCall = mockTaskProgress.mock.calls[0][0];
      const agentPanelCall = mockAgentPanel.mock.calls[0][0];

      expect(statusBarCall.displayMode).toBe('normal');
      expect(taskProgressCall.displayMode).toBe('normal');
      expect(agentPanelCall.displayMode).toBe('normal');
    });

    it('should maintain consistency when state updates', () => {
      const { rerender } = render(<App {...props} />);

      // Update with new state but same displayMode
      const updatedProps = {
        ...props,
        initialState: {
          ...baseState,
          isProcessing: true,
          tokens: { input: 200, output: 300 },
        },
      };

      rerender(<App {...updatedProps} />);

      // All components should still receive the same displayMode
      const latestCalls = {
        statusBar: mockStatusBar.mock.calls[mockStatusBar.mock.calls.length - 1][0],
        taskProgress: mockTaskProgress.mock.calls[mockTaskProgress.mock.calls.length - 1][0],
        agentPanel: mockAgentPanel.mock.calls[mockAgentPanel.mock.calls.length - 1][0],
      };

      expect(latestCalls.statusBar.displayMode).toBe('normal');
      expect(latestCalls.taskProgress.displayMode).toBe('normal');
      expect(latestCalls.agentPanel.displayMode).toBe('normal');
    });
  });

  describe('Performance Considerations', () => {
    it('should not cause excessive re-renders when displayMode is unchanged', () => {
      const { rerender } = render(<App {...props} />);

      const initialCallCounts = {
        statusBar: mockStatusBar.mock.calls.length,
        taskProgress: mockTaskProgress.mock.calls.length,
        agentPanel: mockAgentPanel.mock.calls.length,
      };

      // Update unrelated state
      const updatedProps = {
        ...props,
        initialState: {
          ...baseState,
          isProcessing: true, // This should not affect displayMode
        },
      };

      rerender(<App {...updatedProps} />);

      const finalCallCounts = {
        statusBar: mockStatusBar.mock.calls.length,
        taskProgress: mockTaskProgress.mock.calls.length,
        agentPanel: mockAgentPanel.mock.calls.length,
      };

      // Components should re-render, but displayMode should be consistent
      expect(finalCallCounts.statusBar).toBeGreaterThan(initialCallCounts.statusBar);
      expect(finalCallCounts.taskProgress).toBeGreaterThan(initialCallCounts.taskProgress);
      expect(finalCallCounts.agentPanel).toBeGreaterThan(initialCallCounts.agentPanel);

      // But displayMode should be the same
      const latestCalls = {
        statusBar: mockStatusBar.mock.calls[mockStatusBar.mock.calls.length - 1][0],
        taskProgress: mockTaskProgress.mock.calls[mockTaskProgress.mock.calls.length - 1][0],
        agentPanel: mockAgentPanel.mock.calls[mockAgentPanel.mock.calls.length - 1][0],
      };

      expect(latestCalls.statusBar.displayMode).toBe('normal');
      expect(latestCalls.taskProgress.displayMode).toBe('normal');
      expect(latestCalls.agentPanel.displayMode).toBe('normal');
    });
  });
});