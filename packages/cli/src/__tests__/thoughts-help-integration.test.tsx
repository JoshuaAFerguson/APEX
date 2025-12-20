/**
 * Integration test for /thoughts command help system integration
 * Validates that /thoughts appears in help commands and provides proper descriptions
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';

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
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

// Mock services
vi.mock('../services/ConversationManager', () => ({
  ConversationManager: class MockConversationManager {
    addMessage = vi.fn();
    clearContext = vi.fn();
    getSuggestions = vi.fn(() => []);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.8 }));
    hasPendingClarification = vi.fn(() => false);
    provideClarification = vi.fn();
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

// Mock UI components - capture help content
let capturedHelpContent = '';
vi.mock('../ui/components/index.js', () => ({
  Banner: ({ children }: { children?: React.ReactNode }) => <div data-testid="banner">{children}</div>,
  InputPrompt: ({ onSubmit, disabled }: { onSubmit: (input: string) => void; disabled: boolean }) => (
    <div data-testid="input-prompt" data-disabled={disabled}>
      <button data-testid="submit-help" onClick={() => onSubmit('/help')}>Submit /help</button>
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content, type }: { content: string; type: string }) => {
    if (type === 'system' && content.includes('Available commands:')) {
      capturedHelpContent = content;
    }
    return (
      <div data-testid="response-stream" data-type={type}>{content}</div>
    );
  },
  StatusBar: ({ showThoughts }: { showThoughts?: boolean }) => (
    <div data-testid="status-bar" data-show-thoughts={showThoughts} />
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
}));

describe('Thoughts Command Help Integration', () => {
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedHelpContent = '';

    vi.mocked(useInput).mockImplementation(mockUseInput);

    initialState = {
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

  it('should include /thoughts in help command output', async () => {
    render(
      <ThemeProvider>
        <App
          initialState={initialState}
          onCommand={vi.fn()}
          onTask={vi.fn()}
          onExit={vi.fn()}
        />
      </ThemeProvider>
    );

    // Submit /help command
    const helpButton = screen.getByTestId('submit-help');

    await act(async () => {
      helpButton.click();
    });

    // Verify that help is displayed and includes thoughts command
    await waitFor(() => {
      const responseStreams = screen.getAllByTestId('response-stream');
      const systemMessages = responseStreams.filter(stream =>
        stream.getAttribute('data-type') === 'system'
      );

      const helpMessage = systemMessages.find(msg =>
        msg.textContent?.includes('Available commands:')
      );

      expect(helpMessage).toBeTruthy();
      expect(helpMessage?.textContent).toContain('/thoughts');
      expect(helpMessage?.textContent).toContain('Toggle thought visibility');
    });
  });

  it('should show current thoughts status in help', async () => {
    // Test with thoughts enabled
    const thoughtsEnabledState = { ...initialState, showThoughts: true };

    render(
      <ThemeProvider>
        <App
          initialState={thoughtsEnabledState}
          onCommand={vi.fn()}
          onTask={vi.fn()}
          onExit={vi.fn()}
        />
      </ThemeProvider>
    );

    const helpButton = screen.getByTestId('submit-help');

    await act(async () => {
      helpButton.click();
    });

    await waitFor(() => {
      const responseStreams = screen.getAllByTestId('response-stream');
      const systemMessages = responseStreams.filter(stream =>
        stream.getAttribute('data-type') === 'system'
      );

      const helpMessage = systemMessages.find(msg =>
        msg.textContent?.includes('Available commands:')
      );

      expect(helpMessage).toBeTruthy();
      // Should indicate current status
      expect(helpMessage?.textContent).toContain('currently enabled');
    });
  });

  it('should show thoughts disabled status in help', async () => {
    render(
      <ThemeProvider>
        <App
          initialState={initialState} // showThoughts: false
          onCommand={vi.fn()}
          onTask={vi.fn()}
          onExit={vi.fn()}
        />
      </ThemeProvider>
    );

    const helpButton = screen.getByTestId('submit-help');

    await act(async () => {
      helpButton.click();
    });

    await waitFor(() => {
      const responseStreams = screen.getAllByTestId('response-stream');
      const systemMessages = responseStreams.filter(stream =>
        stream.getAttribute('data-type') === 'system'
      );

      const helpMessage = systemMessages.find(msg =>
        msg.textContent?.includes('Available commands:')
      );

      expect(helpMessage).toBeTruthy();
      // Should indicate current status
      expect(helpMessage?.textContent).toContain('currently disabled');
    });
  });
});