import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../__tests__/test-utils';
import { App, type AppState } from '../App';
import type { DisplayMode } from '@apex/core';

// Minimal mocks for integration test
vi.mock('ink', () => ({
  Box: ({ children }: any) => React.createElement('div', null, children),
  Text: ({ children, color, bold }: any) => React.createElement('span', {
    'data-color': color,
    'data-bold': bold
  }, children),
  useInput: vi.fn(),
  useApp: () => ({ exit: vi.fn() }),
  useStdout: () => ({ stdout: { columns: 120 } }),
}));

vi.mock('../../services/ConversationManager', () => ({
  ConversationManager: class {
    addMessage = vi.fn();
    getSuggestions = vi.fn(() => []);
    hasPendingClarification = vi.fn(() => false);
    detectIntent = vi.fn(() => ({ type: 'task', confidence: 0.9 }));
    clearContext = vi.fn();
    setTask = vi.fn();
    setAgent = vi.fn();
    clearTask = vi.fn();
    clearAgent = vi.fn();
  }
}));

vi.mock('../../services/ShortcutManager', () => ({
  ShortcutManager: class {
    on = vi.fn();
    handleKey = vi.fn(() => false);
    pushContext = vi.fn();
    popContext = vi.fn();
  }
}));

vi.mock('../../services/CompletionEngine', () => ({
  CompletionEngine: class {}
}));

describe('Countdown Integration Test', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should manage countdown state correctly through preview lifecycle', () => {
    const mockOnTask = vi.fn();
    const mockOnCommand = vi.fn();
    const mockOnExit = vi.fn();

    const baseState: AppState = {
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
      model: 'sonnet',
      displayMode: 'normal' as DisplayMode,
      previewMode: true,
      previewConfig: {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: false,
        timeoutMs: 3000, // 3 seconds
      },
      showThoughts: false,
    };

    // Test 1: No countdown without pending preview
    const { rerender } = render(
      <App
        initialState={baseState}
        onCommand={mockOnCommand}
        onTask={mockOnTask}
        onExit={mockOnExit}
      />
    );

    expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();

    // Test 2: Countdown appears when preview is set
    const stateWithPreview = {
      ...baseState,
      pendingPreview: {
        input: 'test task',
        intent: {
          type: 'task' as const,
          confidence: 0.9,
        },
        timestamp: new Date(),
      },
    };

    rerender(
      <App
        initialState={stateWithPreview}
        onCommand={mockOnCommand}
        onTask={mockOnTask}
        onExit={mockOnExit}
      />
    );

    // Allow useEffect to run
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Countdown should appear
    expect(screen.queryByText(/Auto-execute in/)).toBeInTheDocument();
    expect(screen.queryByText(/3s/)).toBeInTheDocument();

    // Test 3: Countdown decrements
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText(/2s/)).toBeInTheDocument();

    // Test 4: Auto-execute on timeout
    act(() => {
      vi.advanceTimersByTime(2100); // Total 3.1 seconds
    });

    expect(mockOnTask).toHaveBeenCalledWith('test task');

    // Test 5: Countdown clears when preview is removed
    rerender(
      <App
        initialState={baseState}
        onCommand={mockOnCommand}
        onTask={mockOnTask}
        onExit={mockOnExit}
      />
    );

    expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
  });

  it('should handle command execution on countdown timeout', () => {
    const mockOnTask = vi.fn();
    const mockOnCommand = vi.fn();
    const mockOnExit = vi.fn();

    const stateWithCommandPreview: AppState = {
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
      model: 'sonnet',
      displayMode: 'normal' as DisplayMode,
      previewMode: true,
      previewConfig: {
        confidenceThreshold: 0.8,
        autoExecuteHighConfidence: false,
        timeoutMs: 1000, // 1 second
      },
      showThoughts: false,
      pendingPreview: {
        input: '/status',
        intent: {
          type: 'command' as const,
          confidence: 0.9,
          command: 'status',
          args: [],
        },
        timestamp: new Date(),
      },
    };

    render(
      <App
        initialState={stateWithCommandPreview}
        onCommand={mockOnCommand}
        onTask={mockOnTask}
        onExit={mockOnExit}
      />
    );

    // Initialize countdown
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Trigger timeout
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Should execute command
    expect(mockOnCommand).toHaveBeenCalledWith('status', []);
    expect(mockOnTask).not.toHaveBeenCalled();
  });
});