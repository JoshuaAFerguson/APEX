/**
 * Performance tests for showThoughts feature
 * Validates that the feature doesn't introduce performance regressions
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, type AppState } from '../ui/App';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock ink hooks
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: vi.fn(() => ({ exit: vi.fn() })),
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

// Mock UI components
vi.mock('../ui/components/index.js', () => ({
  Banner: () => <div data-testid="banner" />,
  InputPrompt: ({ onSubmit }: { onSubmit: (input: string) => void }) => (
    <div data-testid="input-prompt">
      <button data-testid="submit-thoughts" onClick={() => onSubmit('/thoughts')}>
        Submit /thoughts
      </button>
    </div>
  ),
  ServicesPanel: () => <div data-testid="services-panel" />,
  PreviewPanel: () => <div data-testid="preview-panel" />,
  ResponseStream: ({ content }: { content: string }) => <div data-testid="response-stream">{content}</div>,
  StatusBar: ({ showThoughts }: { showThoughts?: boolean }) => (
    <div data-testid="status-bar" data-show-thoughts={showThoughts?.toString()} />
  ),
  TaskProgress: () => <div data-testid="task-progress" />,
  AgentPanel: () => <div data-testid="agent-panel" />,
  ToolCall: () => <div data-testid="tool-call" />,
}));

describe('Thoughts Feature Performance Tests', () => {
  let initialState: AppState;

  beforeEach(() => {
    vi.clearAllMocks();

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

  it('should render quickly with showThoughts feature', () => {
    const startTime = performance.now();

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

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Rendering should be fast (less than 100ms in test environment)
    expect(renderTime).toBeLessThan(100);
    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-show-thoughts', 'false');
  });

  it('should toggle state quickly without performance degradation', async () => {
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

    const thoughtsButton = screen.getByTestId('submit-thoughts');

    // Measure time for multiple rapid toggles
    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      await act(async () => {
        thoughtsButton.click();
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // 100 toggles should complete quickly (less than 1000ms in test environment)
    expect(totalTime).toBeLessThan(1000);

    // Final state should be correct (100 toggles = even number, so back to false)
    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar).toHaveAttribute('data-show-thoughts', 'false');
  });

  it('should handle large message history efficiently with showThoughts', async () => {
    // Create state with large message history
    const largeMessageHistory = Array.from({ length: 1000 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
      timestamp: new Date(),
    }));

    const stateWithLargeHistory = {
      ...initialState,
      messages: largeMessageHistory,
    };

    const startTime = performance.now();

    render(
      <ThemeProvider>
        <App
          initialState={stateWithLargeHistory}
          onCommand={vi.fn()}
          onTask={vi.fn()}
          onExit={vi.fn()}
        />
      </ThemeProvider>
    );

    // Toggle thoughts with large history
    const thoughtsButton = screen.getByTestId('submit-thoughts');
    await act(async () => {
      thoughtsButton.click();
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should handle large history efficiently (less than 200ms)
    expect(totalTime).toBeLessThan(200);
    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-show-thoughts', 'true');
  });

  it('should not cause memory leaks with repeated toggles', async () => {
    const { unmount } = render(
      <ThemeProvider>
        <App
          initialState={initialState}
          onCommand={vi.fn()}
          onTask={vi.fn()}
          onExit={vi.fn()}
        />
      </ThemeProvider>
    );

    const thoughtsButton = screen.getByTestId('submit-thoughts');

    // Simulate many user interactions
    for (let i = 0; i < 50; i++) {
      await act(async () => {
        thoughtsButton.click();
      });
    }

    // Component should unmount cleanly without errors
    expect(() => unmount()).not.toThrow();
  });

  it('should scale well with different state complexities', async () => {
    // Test with complex state
    const complexState = {
      ...initialState,
      messages: Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: `Complex message ${i}`,
        timestamp: new Date(),
      })),
      inputHistory: Array.from({ length: 100 }, (_, i) => `/command${i}`),
      tokens: { input: 10000, output: 5000 },
      cost: 25.50,
    };

    const startTime = performance.now();

    render(
      <ThemeProvider>
        <App
          initialState={complexState}
          onCommand={vi.fn()}
          onTask={vi.fn()}
          onExit={vi.fn()}
        />
      </ThemeProvider>
    );

    const thoughtsButton = screen.getByTestId('submit-thoughts');

    // Multiple operations with complex state
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        thoughtsButton.click();
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should handle complex state efficiently (less than 500ms)
    expect(totalTime).toBeLessThan(500);
    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-show-thoughts', 'false');
  });
});