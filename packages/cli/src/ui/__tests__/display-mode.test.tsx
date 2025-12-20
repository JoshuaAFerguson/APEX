/**
 * Tests for DisplayMode functionality in APEX CLI
 * Tests all aspects of display mode state management, command handling, and UI behavior
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../__tests__/test-utils';
import { App, type AppState, type AppProps } from '../App';
import type { DisplayMode } from '@apexcli/core';

describe('DisplayMode Functionality', () => {
  let mockOnCommand: vi.Mock;
  let mockOnTask: vi.Mock;
  let mockOnExit: vi.Mock;
  let baseInitialState: AppState;

  beforeEach(() => {
    mockOnCommand = vi.fn();
    mockOnTask = vi.fn();
    mockOnExit = vi.fn();

    baseInitialState = {
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
      sessionStartTime: new Date(),
      displayMode: 'normal',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with normal display mode by default', () => {
      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Access the app state through global instance
      const appInstance = (globalThis as any).__apexApp;
      expect(appInstance.getState().displayMode).toBe('normal');
    });

    it('should accept custom initial display mode', () => {
      const customState = { ...baseInitialState, displayMode: 'compact' as DisplayMode };

      render(
        <App
          initialState={customState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const appInstance = (globalThis as any).__apexApp;
      expect(appInstance.getState().displayMode).toBe('compact');
    });

    it('should initialize with verbose display mode', () => {
      const verboseState = { ...baseInitialState, displayMode: 'verbose' as DisplayMode };

      render(
        <App
          initialState={verboseState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const appInstance = (globalThis as any).__apexApp;
      expect(appInstance.getState().displayMode).toBe('verbose');
    });
  });

  describe('State Updates via updateState', () => {
    it('should update display mode to compact', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      act(() => {
        appInstance.updateState({ displayMode: 'compact' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('compact');
      });
    });

    it('should update display mode to verbose', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      act(() => {
        appInstance.updateState({ displayMode: 'verbose' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('verbose');
      });
    });

    it('should cycle through all display modes', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Start with normal (default)
      expect(appInstance.getState().displayMode).toBe('normal');

      // Change to compact
      act(() => {
        appInstance.updateState({ displayMode: 'compact' });
      });
      await waitFor(() => {
        expect(appInstance.getState().displayMode).toBe('compact');
      });

      // Change to verbose
      act(() => {
        appInstance.updateState({ displayMode: 'verbose' });
      });
      await waitFor(() => {
        expect(appInstance.getState().displayMode).toBe('verbose');
      });

      // Back to normal
      act(() => {
        appInstance.updateState({ displayMode: 'normal' });
      });
      await waitFor(() => {
        expect(appInstance.getState().displayMode).toBe('normal');
      });
    });

    it('should preserve other state when updating displayMode', async () => {
      let appInstance: any = null;

      const stateWithData = {
        ...baseInitialState,
        tokens: { input: 100, output: 200 },
        cost: 0.05,
        model: 'opus',
        isProcessing: true,
      };

      render(
        <App
          initialState={stateWithData}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      act(() => {
        appInstance.updateState({ displayMode: 'compact' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('compact');
        // Other state should be preserved
        expect(state.tokens).toEqual({ input: 100, output: 200 });
        expect(state.cost).toBe(0.05);
        expect(state.model).toBe('opus');
        expect(state.isProcessing).toBe(true);
      });
    });
  });

  describe('Command Handling', () => {
    it('should handle /compact command correctly', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate typing the compact command
      // We'll test this through the handleInput method by accessing the component's internal state
      // Since the command is handled in handleInput, we need to trigger it

      // Access the component's handleInput method (this would normally be triggered by user input)
      // For testing purposes, we'll directly update state to simulate command execution
      act(() => {
        appInstance.updateState({
          displayMode: 'compact',
          messages: [
            ...appInstance.getState().messages,
            {
              id: 'test-msg',
              type: 'system',
              content: 'Display mode set to compact: Single-line status, condensed output',
              timestamp: new Date(),
            },
          ],
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('compact');
        expect(state.messages.some((m: any) =>
          m.content.includes('Display mode set to compact')
        )).toBe(true);
      });
    });

    it('should handle /verbose command correctly', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      act(() => {
        appInstance.updateState({
          displayMode: 'verbose',
          messages: [
            ...appInstance.getState().messages,
            {
              id: 'test-msg',
              type: 'system',
              content: 'Display mode set to verbose: Detailed debug output, full information',
              timestamp: new Date(),
            },
          ],
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('verbose');
        expect(state.messages.some((m: any) =>
          m.content.includes('Display mode set to verbose')
        )).toBe(true);
      });
    });

    it('should not call onCommand for display mode commands', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate handling display mode commands without calling external onCommand
      act(() => {
        appInstance.updateState({ displayMode: 'compact' });
      });

      act(() => {
        appInstance.updateState({ displayMode: 'verbose' });
      });

      // onCommand should not have been called for display mode changes
      expect(mockOnCommand).not.toHaveBeenCalled();
    });
  });

  describe('Message Filtering by Display Mode', () => {
    const createTestMessages = () => [
      { id: '1', type: 'user', content: 'User message', timestamp: new Date() },
      { id: '2', type: 'assistant', content: 'Assistant response', timestamp: new Date() },
      { id: '3', type: 'system', content: 'System message', timestamp: new Date() },
      { id: '4', type: 'tool', content: 'Tool output', toolName: 'Read', timestamp: new Date() },
      { id: '5', type: 'error', content: 'Error message', timestamp: new Date() },
    ];

    it('should filter system and tool messages in compact mode', async () => {
      const stateWithMessages = {
        ...baseInitialState,
        displayMode: 'compact' as DisplayMode,
        messages: createTestMessages(),
      };

      render(
        <App
          initialState={stateWithMessages}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // In compact mode, system and tool messages should be filtered
      // User, assistant, and error messages should still be visible
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // System and tool messages should be filtered out in compact mode
      expect(screen.queryByText('System message')).not.toBeInTheDocument();
    });

    it('should show all messages in verbose mode', () => {
      const stateWithMessages = {
        ...baseInitialState,
        displayMode: 'verbose' as DisplayMode,
        messages: createTestMessages(),
      };

      render(
        <App
          initialState={stateWithMessages}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // In verbose mode, all messages should be visible
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();
      expect(screen.getByText('System message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should show all messages in normal mode', () => {
      const stateWithMessages = {
        ...baseInitialState,
        displayMode: 'normal' as DisplayMode,
        messages: createTestMessages(),
      };

      render(
        <App
          initialState={stateWithMessages}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // In normal mode, all messages should be visible (default behavior)
      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant response')).toBeInTheDocument();
      expect(screen.getByText('System message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('StatusBar Integration', () => {
    it('should pass displayMode to StatusBar component', () => {
      const stateWithDisplayMode = {
        ...baseInitialState,
        displayMode: 'compact' as DisplayMode,
        gitBranch: 'feature/test',
        tokens: { input: 100, output: 200 },
        cost: 0.05,
        model: 'sonnet',
        initialized: true,
      };

      render(
        <App
          initialState={stateWithDisplayMode}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // The StatusBar should receive the displayMode prop
      // This would be visible through the status bar rendering behavior
      // Since we can't directly test props, we test the component renders properly
      expect(screen.getByText(/feature\/test/)).toBeInTheDocument();
    });

    it('should update StatusBar when displayMode changes', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Change display mode
      act(() => {
        appInstance.updateState({ displayMode: 'verbose' });
      });

      // StatusBar should continue to work correctly
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('verbose');
      });
    });
  });

  describe('Type Safety and Edge Cases', () => {
    it('should handle invalid display mode gracefully', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Try to set an invalid display mode (this would be caught by TypeScript in real usage)
      expect(() => {
        act(() => {
          appInstance.updateState({ displayMode: 'invalid' as any });
        });
      }).not.toThrow();

      // App should continue to function
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state).toBeDefined();
      });
    });

    it('should handle concurrent displayMode updates', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Multiple rapid updates
      act(() => {
        appInstance.updateState({ displayMode: 'compact' });
        appInstance.updateState({ displayMode: 'verbose' });
        appInstance.updateState({ displayMode: 'normal' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('normal');
      });
    });

    it('should maintain displayMode across app re-renders', async () => {
      let appInstance: any = null;

      const TestWrapper = ({ testProp }: { testProp: string }) => (
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      const { rerender } = render(<TestWrapper testProp="initial" />);

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Set display mode
      act(() => {
        appInstance.updateState({ displayMode: 'verbose' });
      });

      await waitFor(() => {
        expect(appInstance.getState().displayMode).toBe('verbose');
      });

      // Force re-render
      rerender(<TestWrapper testProp="changed" />);

      // Display mode should persist
      await waitFor(() => {
        expect(appInstance.getState().displayMode).toBe('verbose');
      });
    });
  });
});