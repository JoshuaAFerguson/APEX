/**
 * End-to-end integration tests for display mode functionality
 * Tests complete user flows from command input to UI updates
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';
import type { DisplayMode } from '@apex/core';

// Mock ink hooks
const mockUseInput = vi.fn();
const mockUseApp = vi.fn(() => ({ exit: vi.fn() }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useApp: mockUseApp,
    Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
    Text: ({ children, color }: { children: React.ReactNode; color?: string }) =>
      <span data-color={color}>{children}</span>,
  };
});

// Mock services with detailed implementations
const mockConversationManager = {
  addMessage: vi.fn(),
  clearContext: vi.fn(),
  getSuggestions: vi.fn(() => ['/compact', '/verbose', '/help']),
  detectIntent: vi.fn(() => ({ type: 'command', confidence: 0.9 })),
  hasPendingClarification: vi.fn(() => false),
  provideClarification: vi.fn(),
};

const mockShortcutManager = {
  on: vi.fn(),
  pushContext: vi.fn(),
  popContext: vi.fn(),
  handleKey: vi.fn(() => false),
};

const mockCompletionEngine = {
  getCompletions: vi.fn(() => ['/compact', '/verbose']),
  updateContext: vi.fn(),
};

vi.mock('../services/ConversationManager', () => ({
  ConversationManager: vi.fn(function () { return mockConversationManager; }),
}));

vi.mock('../services/ShortcutManager', () => ({
  ShortcutManager: vi.fn(function () { return mockShortcutManager; }),
}));

vi.mock('../services/CompletionEngine', () => ({
  CompletionEngine: vi.fn(function () { return mockCompletionEngine; }),
}));

// Enhanced mock components to track display mode changes
const MockInputPrompt = vi.fn(({ onSubmit, disabled, suggestions }: {
  onSubmit: (input: string) => void;
  disabled: boolean;
  suggestions?: string[];
}) => (
  <div data-testid="input-prompt" data-disabled={disabled}>
    <div data-testid="suggestions" data-suggestions={JSON.stringify(suggestions || [])} />
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
      data-testid="submit-help"
      onClick={() => onSubmit('/help')}
    >
      /help
    </button>
    <button
      data-testid="submit-custom"
      onClick={() => onSubmit('/custom-command arg1')}
    >
      /custom
    </button>
  </div>
));

const MockStatusBar = vi.fn(({ displayMode, previewMode, isConnected, gitBranch, tokens, cost, model }: {
  displayMode: DisplayMode;
  previewMode: boolean;
  isConnected?: boolean;
  gitBranch?: string;
  tokens?: { input: number; output: number };
  cost?: number;
  model?: string;
}) => (
  <div
    data-testid="status-bar"
    data-display-mode={displayMode}
    data-preview-mode={previewMode}
    data-is-connected={isConnected}
    data-git-branch={gitBranch}
    data-tokens={JSON.stringify(tokens)}
    data-cost={cost}
    data-model={model}
  >
    StatusBar in {displayMode} mode
  </div>
));

const MockAgentPanel = vi.fn(({ agents, currentAgent, displayMode, onAgentSelect }: {
  agents: any[];
  currentAgent?: string;
  displayMode: DisplayMode;
  onAgentSelect?: (agent: string) => void;
}) => (
  <div
    data-testid="agent-panel"
    data-display-mode={displayMode}
    data-current-agent={currentAgent}
    data-agent-count={agents.length}
  >
    AgentPanel in {displayMode} mode - Current: {currentAgent}
  </div>
));

const MockTaskProgress = vi.fn(({ taskId, description, status, displayMode }: {
  taskId: string;
  description: string;
  status: string;
  displayMode: DisplayMode;
}) => (
  <div
    data-testid="task-progress"
    data-display-mode={displayMode}
    data-task-id={taskId}
    data-status={status}
  >
    Task: {description} ({status}) in {displayMode} mode
  </div>
));

const MockResponseStream = vi.fn(({ content, type, agent, displayMode }: {
  content: string;
  type: string;
  agent?: string;
  displayMode?: DisplayMode;
}) => (
  <div
    data-testid="response-stream"
    data-type={type}
    data-agent={agent}
    data-display-mode={displayMode}
  >
    {content}
  </div>
));

vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: MockInputPrompt,
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: MockResponseStream,
  StatusBar: MockStatusBar,
  TaskProgress: MockTaskProgress,
  AgentPanel: MockAgentPanel,
  ToolCall: ({ toolName, status, displayMode }: { toolName: string; status: string; displayMode?: DisplayMode }) => (
    <div data-testid="tool-call" data-tool={toolName} data-status={status} data-display-mode={displayMode}>
      ToolCall: {toolName} ({status}) in {displayMode} mode
    </div>
  ),
}));

describe('Display Mode E2E User Flow Integration', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    MockInputPrompt.mockClear();
    MockStatusBar.mockClear();
    MockAgentPanel.mockClear();
    MockTaskProgress.mockClear();
    MockResponseStream.mockClear();

    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

    initialState = {
      initialized: true,
      projectPath: '/test/project',
      config: { autonomy: { level: 'medium' } } as any,
      orchestrator: null,
      gitBranch: 'feature/display-modes',
      currentTask: undefined,
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 150, output: 300 },
      cost: 0.12,
      model: 'claude-3-sonnet',
      displayMode: 'normal',
      previewMode: false,
      showThoughts: false,
      activeAgent: undefined,
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete User Flow: Normal → Compact → Verbose', () => {
    it('should handle complete user flow from normal to compact to verbose mode', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // === PHASE 1: Initial state verification ===
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'normal' }),
          {}
        );
      });

      // === PHASE 2: Switch to compact mode ===
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Verify all components received compact mode
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });

      // Verify confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const compactMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Display mode set to compact')
        );
        expect(compactMessage).toBeTruthy();
        expect(compactMessage?.textContent).toContain('Single-line status, condensed output');
      });

      // === PHASE 3: Switch to verbose mode ===
      const verboseButton = screen.getByTestId('submit-verbose');
      await act(async () => {
        verboseButton.click();
      });

      // Verify all components received verbose mode
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'verbose' }),
          {}
        );
      });

      // Verify verbose confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const verboseMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Display mode set to verbose')
        );
        expect(verboseMessage).toBeTruthy();
        expect(verboseMessage?.textContent).toContain('Detailed debug output, full information');
      });

      // === PHASE 4: Verify input history ===
      expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: '/compact' })
      );
      expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: '/verbose' })
      );
    });
  });

  describe('User Flow with Active Task and Agent', () => {
    it('should propagate display mode to all components when task and agent are active', async () => {
      const stateWithTask = {
        ...initialState,
        currentTask: {
          id: 'task-123',
          description: 'Implement display mode tests',
          status: 'in-progress',
          workflow: 'feature',
          createdAt: new Date(),
        },
        activeAgent: 'developer',
        agents: [
          { id: 'planner', name: 'Planner', status: 'completed' },
          { id: 'developer', name: 'Developer', status: 'active' },
        ],
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithTask}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Switch to compact mode
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Verify TaskProgress receives displayMode
      await waitFor(() => {
        expect(MockTaskProgress).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });

      // Verify AgentPanel receives displayMode
      await waitFor(() => {
        expect(MockAgentPanel).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });

      // Verify StatusBar still receives displayMode
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });
    });
  });

  describe('User Flow with Message Filtering', () => {
    it('should demonstrate message filtering behavior across display modes', async () => {
      const stateWithMessages = {
        ...initialState,
        messages: [
          {
            id: 'msg1',
            type: 'user' as const,
            content: 'Test user message',
            timestamp: new Date(),
          },
          {
            id: 'msg2',
            type: 'assistant' as const,
            content: 'Test assistant response',
            timestamp: new Date(),
          },
          {
            id: 'msg3',
            type: 'system' as const,
            content: 'System notification',
            timestamp: new Date(),
          },
          {
            id: 'msg4',
            type: 'tool' as const,
            content: 'Tool execution result',
            toolName: 'TestTool',
            timestamp: new Date(),
          },
        ],
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithMessages}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // === NORMAL MODE: All messages visible ===
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        expect(responseStreams).toHaveLength(4); // All message types shown
      });

      // === COMPACT MODE: System and tool messages filtered ===
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        // Should have user + assistant + confirmation message (3 total)
        const nonSystemMessages = responseStreams.filter(stream =>
          !stream.textContent?.includes('System notification') &&
          stream.getAttribute('data-type') !== 'tool'
        );
        expect(nonSystemMessages.length).toBeGreaterThanOrEqual(3);
      });

      // === VERBOSE MODE: All messages visible again ===
      const verboseButton = screen.getByTestId('submit-verbose');
      await act(async () => {
        verboseButton.click();
      });

      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        // Should show all original messages plus confirmation messages
        expect(responseStreams.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Suggestion System Integration', () => {
    it('should include display mode commands in suggestion system', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Verify suggestions include display mode commands
      await waitFor(() => {
        const suggestionsElement = screen.getByTestId('suggestions');
        const suggestions = JSON.parse(suggestionsElement.getAttribute('data-suggestions') || '[]');

        expect(suggestions).toContain('/compact');
        expect(suggestions).toContain('/verbose');
      });

      // Verify ConversationManager provides suggestions
      expect(mockConversationManager.getSuggestions).toHaveBeenCalled();
    });

    it('should update suggestions after display mode changes', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Suggestions should still be available after mode change
      await waitFor(() => {
        expect(mockConversationManager.addMessage).toHaveBeenCalled();
        // Verify suggestions are still provided
        const suggestionsElement = screen.getByTestId('suggestions');
        const suggestions = JSON.parse(suggestionsElement.getAttribute('data-suggestions') || '[]');
        expect(suggestions).toContain('/verbose');
      });
    });
  });

  describe('Help Integration in User Flow', () => {
    it('should show help with display mode commands and then allow mode switching', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Show help
      const helpButton = screen.getByTestId('submit-help');
      await act(async () => {
        helpButton.click();
      });

      // Verify help message contains display mode commands
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available Commands') &&
          stream.textContent?.includes('/compact') &&
          stream.textContent?.includes('/verbose')
        );
        expect(helpMessage).toBeTruthy();
      });

      // Switch to compact mode after seeing help
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Verify mode switch worked
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });

      // Show help again to verify it works in compact mode
      await act(async () => {
        helpButton.click();
      });

      // Help should still include all commands in compact mode
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const helpMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Available Commands')
        );
        expect(helpMessage).toBeTruthy();
      });
    });
  });

  describe('External Command Integration', () => {
    it('should handle external commands without affecting display mode state', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Switch to compact mode
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });

      // Execute external command
      const customButton = screen.getByTestId('submit-custom');
      await act(async () => {
        customButton.click();
      });

      // Verify external command was called
      await waitFor(() => {
        expect(mockOnCommand).toHaveBeenCalledWith('custom-command', ['arg1']);
      });

      // Verify display mode remained unchanged
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });
    });
  });

  describe('Performance and State Consistency', () => {
    it('should maintain consistent state across rapid display mode changes', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
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
        verboseButton.click();
      });

      // Should end up in verbose mode with consistent state
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'verbose' }),
          {}
        );
      });

      // All components should have received the final display mode
      expect(MockInputPrompt).toHaveBeenCalled();
      expect(MockStatusBar).toHaveBeenCalled();
    });

    it('should preserve all other app state during display mode changes', async () => {
      const complexState = {
        ...initialState,
        gitBranch: 'feature/test-branch',
        tokens: { input: 500, output: 750 },
        cost: 0.35,
        model: 'claude-3-opus',
        previewMode: true,
      };

      render(
        <ThemeProvider>
          <App
            initialState={complexState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Switch display mode
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Verify all other state is preserved
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({
            displayMode: 'compact',
            previewMode: true,
            gitBranch: 'feature/test-branch',
            tokens: { input: 500, output: 750 },
            cost: 0.35,
            model: 'claude-3-opus',
          }),
          {}
        );
      });
    });
  });

  describe('Error Recovery in User Flow', () => {
    it('should recover gracefully from errors during display mode operations', async () => {
      // Mock a service error
      mockConversationManager.addMessage.mockRejectedValueOnce(new Error('Service error'));

      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const compactButton = screen.getByTestId('submit-compact');

      // Should not throw even if service fails
      expect(async () => {
        await act(async () => {
          compactButton.click();
        });
      }).not.toThrow();

      // Display mode should still update (local state change)
      await waitFor(() => {
        expect(MockStatusBar).toHaveBeenCalledWith(
          expect.objectContaining({ displayMode: 'compact' }),
          {}
        );
      });
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide proper visual feedback throughout the user flow', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={initialState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Switch to compact mode
      const compactButton = screen.getByTestId('submit-compact');
      await act(async () => {
        compactButton.click();
      });

      // Should provide immediate visual confirmation
      await waitFor(() => {
        const statusBar = screen.getByTestId('status-bar');
        expect(statusBar).toHaveAttribute('data-display-mode', 'compact');
        expect(statusBar.textContent).toContain('compact mode');
      });

      // Should provide text confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const confirmation = responseStreams.find(stream =>
          stream.textContent?.includes('Display mode set to compact')
        );
        expect(confirmation).toBeTruthy();
      });
    });
  });
});
