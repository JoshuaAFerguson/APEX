/**
 * Integration tests for agent thought display functionality in App component
 * Tests the complete flow of displaying agent thoughts with collapsible reasoning sections
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState, type Message } from '../App.js';
import { ThemeProvider } from '../context/ThemeContext.js';

// Mock ink hooks
const mockUseInput = vi.fn();
const mockUseApp = vi.fn(() => ({ exit: vi.fn() }));

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
    useApp: mockUseApp,
    Box: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) =>
      <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, color, dimColor, ...props }: {
      children: React.ReactNode;
      color?: string;
      dimColor?: boolean;
      [key: string]: any;
    }) => (
      <span data-testid="text" data-color={color} data-dim={dimColor} {...props}>
        {children}
      </span>
    ),
  };
});

// Mock service dependencies
vi.mock('../../services/ConversationManager', () => ({
  ConversationManager: class MockConversationManager {
    addMessage = vi.fn();
    clearContext = vi.fn();
    getSuggestions = vi.fn(() => []);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.8 }));
    hasPendingClarification = vi.fn(() => false);
    provideClarification = vi.fn();
  },
}));

vi.mock('../../services/ShortcutManager', () => ({
  ShortcutManager: class MockShortcutManager {
    on = vi.fn();
    pushContext = vi.fn();
    popContext = vi.fn();
    handleKey = vi.fn(() => false);
  },
}));

vi.mock('../../services/CompletionEngine', () => ({
  CompletionEngine: class MockCompletionEngine {
    getCompletions = vi.fn(() => []);
    updateContext = vi.fn();
  },
}));

// Mock UI components with thought display functionality
vi.mock('../components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({ onSubmit }: { onSubmit: (input: string) => void }) => (
    <div data-testid="input-prompt">
      <button data-testid="toggle-thoughts" onClick={() => onSubmit('/thoughts')}>
        Toggle Thoughts
      </button>
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content, type, agent }: { content: string; type: string; agent?: string }) => (
    <div data-testid="response-stream" data-type={type} data-agent={agent}>
      {content}
    </div>
  ),
  StatusBar: ({ showThoughts }: { showThoughts?: boolean }) => (
    <div data-testid="status-bar" data-show-thoughts={showThoughts}>
      {showThoughts && '💭 THOUGHTS'}
    </div>
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
  ThoughtDisplay: ({ thinking, agent, displayMode, compact }: {
    thinking: string;
    agent: string;
    displayMode?: string;
    compact?: boolean;
  }) => {
    if (compact || displayMode === 'compact') {
      return <div data-testid="thought-display-hidden" />;
    }
    return (
      <div data-testid="thought-display" data-agent={agent} data-display-mode={displayMode}>
        <span data-testid="thought-header">💭 {agent} thinking</span>
        <span data-testid="thought-content">{thinking}</span>
      </div>
    );
  },
}));

describe('App - Thought Display Integration', () => {
  let mockOnCommand: ReturnType<typeof vi.fn>;
  let mockOnTask: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;
  let baseState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

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

  describe('Thought Display Toggle', () => {
    it('should toggle thought display from false to true', async () => {
      const { rerender } = render(
        <ThemeProvider>
          <App
            initialState={baseState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Initially thoughts should not be shown in status bar
      const statusBar = screen.getByTestId('status-bar');
      expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');

      // Toggle thoughts on
      const toggleButton = screen.getByTestId('toggle-thoughts');
      await act(async () => {
        toggleButton.click();
      });

      // Should show confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const confirmationMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility enabled')
        );
        expect(confirmationMessage).toBeTruthy();
      });
    });

    it('should toggle thought display from true to false', async () => {
      const thoughtsEnabledState = { ...baseState, showThoughts: true };

      render(
        <ThemeProvider>
          <App
            initialState={thoughtsEnabledState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Status bar should show thoughts are enabled
      const statusBar = screen.getByTestId('status-bar');
      expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');

      // Toggle thoughts off
      const toggleButton = screen.getByTestId('toggle-thoughts');
      await act(async () => {
        toggleButton.click();
      });

      // Should show confirmation message
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const confirmationMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility disabled')
        );
        expect(confirmationMessage).toBeTruthy();
      });
    });
  });

  describe('Agent Thought Display', () => {
    it('should display agent thoughts when enabled', async () => {
      const thoughtsEnabledState = {
        ...baseState,
        showThoughts: true,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            agent: 'developer',
            thinking: 'I need to analyze the requirements first.',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={thoughtsEnabledState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should display the thought content
      await waitFor(() => {
        const thoughtDisplay = screen.getByTestId('thought-display');
        expect(thoughtDisplay).toBeInTheDocument();
        expect(thoughtDisplay).toHaveAttribute('data-agent', 'developer');

        const thoughtHeader = screen.getByTestId('thought-header');
        expect(thoughtHeader).toHaveTextContent('💭 developer thinking');

        const thoughtContent = screen.getByTestId('thought-content');
        expect(thoughtContent).toHaveTextContent('I need to analyze the requirements first.');
      });
    });

    it('should not display agent thoughts when disabled', async () => {
      const thoughtsDisabledState = {
        ...baseState,
        showThoughts: false,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            agent: 'developer',
            thinking: 'I need to analyze the requirements first.',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={thoughtsDisabledState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should not display the thought content
      expect(screen.queryByTestId('thought-display')).not.toBeInTheDocument();
      expect(screen.queryByText('💭 developer thinking')).not.toBeInTheDocument();
      expect(screen.queryByText('I need to analyze the requirements first.')).not.toBeInTheDocument();
    });

    it('should handle messages without thinking content gracefully', async () => {
      const stateWithoutThoughts = {
        ...baseState,
        showThoughts: true,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Task completed successfully.',
            agent: 'developer',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithoutThoughts}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should not display thought content when not present
      expect(screen.queryByTestId('thought-display')).not.toBeInTheDocument();

      // But should still show the regular message
      const responseStream = screen.getByTestId('response-stream');
      expect(responseStream).toHaveTextContent('Task completed successfully.');
    });

    it('should handle empty thinking content gracefully', async () => {
      const stateWithEmptyThoughts = {
        ...baseState,
        showThoughts: true,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            agent: 'developer',
            thinking: '',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithEmptyThoughts}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should not display thought content when empty
      expect(screen.queryByTestId('thought-display')).not.toBeInTheDocument();
    });

    it('should handle whitespace-only thinking content', async () => {
      const stateWithWhitespaceThoughts = {
        ...baseState,
        showThoughts: true,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            agent: 'developer',
            thinking: '   \n\t   ',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithWhitespaceThoughts}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should not display thought content when only whitespace
      expect(screen.queryByTestId('thought-display')).not.toBeInTheDocument();
    });
  });

  describe('Display Mode Integration', () => {
    it('should respect compact mode and hide thoughts', async () => {
      const compactState = {
        ...baseState,
        showThoughts: true,
        displayMode: 'compact' as const,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            agent: 'developer',
            thinking: 'Analyzing requirements...',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={compactState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should hide thought display in compact mode
      expect(screen.queryByTestId('thought-display')).not.toBeInTheDocument();
      expect(screen.getByTestId('thought-display-hidden')).toBeInTheDocument();
    });

    it('should show thoughts normally in verbose mode', async () => {
      const verboseState = {
        ...baseState,
        showThoughts: true,
        displayMode: 'verbose' as const,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            agent: 'developer',
            thinking: 'Detailed analysis of the requirements...',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={verboseState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should display thoughts in verbose mode
      const thoughtDisplay = screen.getByTestId('thought-display');
      expect(thoughtDisplay).toBeInTheDocument();
      expect(thoughtDisplay).toHaveAttribute('data-display-mode', 'verbose');

      const thoughtContent = screen.getByTestId('thought-content');
      expect(thoughtContent).toHaveTextContent('Detailed analysis of the requirements...');
    });
  });

  describe('Multiple Agent Thoughts', () => {
    it('should display thoughts from multiple agents', async () => {
      const multiAgentState = {
        ...baseState,
        showThoughts: true,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Planning phase complete.',
            agent: 'planner',
            thinking: 'Breaking down the task into stages...',
            timestamp: new Date(),
          },
          {
            type: 'assistant' as const,
            content: 'Implementation started.',
            agent: 'developer',
            thinking: 'Setting up the project structure...',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={multiAgentState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should display thoughts from both agents
      const thoughtDisplays = screen.getAllByTestId('thought-display');
      expect(thoughtDisplays).toHaveLength(2);

      // Check planner thoughts
      const plannerThoughts = thoughtDisplays.find(el =>
        el.getAttribute('data-agent') === 'planner'
      );
      expect(plannerThoughts).toBeDefined();

      // Check developer thoughts
      const developerThoughts = thoughtDisplays.find(el =>
        el.getAttribute('data-agent') === 'developer'
      );
      expect(developerThoughts).toBeDefined();
    });
  });

  describe('Status Bar Integration', () => {
    it('should show thoughts indicator in status bar when enabled', async () => {
      const thoughtsEnabledState = { ...baseState, showThoughts: true };

      render(
        <ThemeProvider>
          <App
            initialState={thoughtsEnabledState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const statusBar = screen.getByTestId('status-bar');
      expect(statusBar).toHaveAttribute('data-show-thoughts', 'true');
      expect(statusBar).toHaveTextContent('💭 THOUGHTS');
    });

    it('should not show thoughts indicator in status bar when disabled', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={baseState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const statusBar = screen.getByTestId('status-bar');
      expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');
      expect(statusBar).not.toHaveTextContent('💭 THOUGHTS');
    });
  });

  describe('Error Cases', () => {
    it('should handle missing agent name gracefully', async () => {
      const stateWithMissingAgent = {
        ...baseState,
        showThoughts: true,
        messages: [
          {
            type: 'assistant' as const,
            content: 'Working on the task...',
            thinking: 'Some thinking content...',
            timestamp: new Date(),
          },
        ] as Message[],
      };

      render(
        <ThemeProvider>
          <App
            initialState={stateWithMissingAgent}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      // Should not display thought content without agent
      expect(screen.queryByTestId('thought-display')).not.toBeInTheDocument();
    });

    it('should handle rapid thought toggle states', async () => {
      render(
        <ThemeProvider>
          <App
            initialState={baseState}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-thoughts');

      // Rapidly toggle thoughts multiple times
      await act(async () => {
        toggleButton.click(); // false -> true
        toggleButton.click(); // true -> false
        toggleButton.click(); // false -> true
      });

      // Should end up in enabled state
      await waitFor(() => {
        const responseStreams = screen.getAllByTestId('response-stream');
        const enabledMessage = responseStreams.find(stream =>
          stream.textContent?.includes('Thought visibility enabled')
        );
        expect(enabledMessage).toBeTruthy();
      });
    });
  });
});