/**
 * Tests for App.tsx state management and prop passing
 * Focuses on agent handoff state management and prop flow to AgentPanel
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../__tests__/test-utils';
import { App, type AppState, type AppProps } from '../App';

describe('App State Management for Agent Handoff', () => {
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
      config: {
        workflows: {
          feature: {
            stages: [
              { name: 'planning', agent: 'planner' },
              { name: 'architecture', agent: 'architect' },
              { name: 'implementation', agent: 'developer' },
              { name: 'testing', agent: 'tester' },
              { name: 'review', agent: 'reviewer' },
              { name: 'deployment', agent: 'devops' },
            ]
          }
        }
      } as any,
      orchestrator: null,
      gitBranch: 'feature/test',
      currentTask: {
        id: 'task-123',
        description: 'Test task',
        workflow: 'feature',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 0, output: 0 },
      cost: 0,
      model: 'claude-3-sonnet',
      sessionStartTime: new Date(),
      displayMode: 'normal',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state management', () => {
    it('initializes with correct default values for agent handoff state', () => {
      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should show AgentPanel with current task
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('handles state without current task', () => {
      const stateWithoutTask = {
        ...baseInitialState,
        currentTask: undefined,
      };

      render(
        <App
          initialState={stateWithoutTask}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should not show AgentPanel without current task
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('initializes with agent handoff state properties', async () => {
      const stateWithHandoff = {
        ...baseInitialState,
        activeAgent: 'developer',
        previousAgent: 'architect',
        parallelAgents: [
          { name: 'tester', status: 'parallel' as const, stage: 'testing' },
        ],
        showParallelPanel: true,
      };

      render(
        <App
          initialState={stateWithHandoff}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should show parallel execution panel
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('state updates via updateState method', () => {
    it('updates agent handoff state correctly', async () => {
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

      // Update with handoff state
      act(() => {
        appInstance.updateState({
          previousAgent: 'planner',
          activeAgent: 'developer',
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.previousAgent).toBe('planner');
        expect(state.activeAgent).toBe('developer');
      });
    });

    it('updates parallel agent state correctly', async () => {
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

      // Update with parallel agents
      const parallelAgents = [
        { name: 'developer', status: 'parallel' as const, stage: 'coding' },
        { name: 'tester', status: 'parallel' as const, stage: 'testing' },
      ];

      act(() => {
        appInstance.updateState({
          parallelAgents,
          showParallelPanel: true,
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual(parallelAgents);
        expect(state.showParallelPanel).toBe(true);
      });

      // Should update UI
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('handles partial state updates', async () => {
      let appInstance: any = null;

      const initialStateWithAgents = {
        ...baseInitialState,
        activeAgent: 'planner',
        parallelAgents: [{ name: 'old-agent', status: 'parallel' as const }],
      };

      render(
        <App
          initialState={initialStateWithAgents}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Update only activeAgent
      act(() => {
        appInstance.updateState({
          activeAgent: 'developer',
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
        expect(state.parallelAgents).toEqual([{ name: 'old-agent', status: 'parallel' }]);
      });
    });

    it('clears agent state correctly', async () => {
      let appInstance: any = null;

      const initialStateWithAgents = {
        ...baseInitialState,
        activeAgent: 'developer',
        previousAgent: 'planner',
        parallelAgents: [{ name: 'tester', status: 'parallel' as const }],
        showParallelPanel: true,
      };

      render(
        <App
          initialState={initialStateWithAgents}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Clear all agent state
      act(() => {
        appInstance.updateState({
          activeAgent: undefined,
          previousAgent: undefined,
          parallelAgents: [],
          showParallelPanel: false,
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBeUndefined();
        expect(state.previousAgent).toBeUndefined();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // UI should update
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('prop passing to AgentPanel', () => {
    it('passes correct workflow agents to AgentPanel', () => {
      render(
        <App
          initialState={baseInitialState}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should derive agents from workflow configuration and pass to AgentPanel
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('passes currentAgent prop correctly', async () => {
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

      // Update current agent
      act(() => {
        appInstance.updateState({
          activeAgent: 'developer',
        });
      });

      // AgentPanel should receive and display the current agent
      await waitFor(() => {
        // The current agent should be highlighted/visible in some way
        expect(screen.getByText('developer')).toBeInTheDocument();
      });
    });

    it('passes parallel agent props correctly', async () => {
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

      // Add parallel agents
      const parallelAgents = [
        { name: 'worker1', status: 'parallel' as const, stage: 'task1' },
        { name: 'worker2', status: 'parallel' as const, stage: 'task2' },
      ];

      act(() => {
        appInstance.updateState({
          parallelAgents,
          showParallelPanel: true,
        });
      });

      // AgentPanel should receive and display parallel agents
      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('worker1')).toBeInTheDocument();
        expect(screen.getByText('worker2')).toBeInTheDocument();
      });
    });

    it('handles workflow with no stages gracefully', () => {
      const stateWithEmptyWorkflow = {
        ...baseInitialState,
        config: {
          workflows: {
            feature: {
              stages: []
            }
          }
        } as any,
      };

      render(
        <App
          initialState={stateWithEmptyWorkflow}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should still show AgentPanel but with empty agent list
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles missing workflow configuration', () => {
      const stateWithNoWorkflow = {
        ...baseInitialState,
        config: null,
      };

      render(
        <App
          initialState={stateWithNoWorkflow}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      // Should still show AgentPanel but with empty agent list
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('conversation manager integration', () => {
    it('syncs task and agent info with conversation manager', async () => {
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

      // Update with new task and agent
      act(() => {
        appInstance.updateState({
          currentTask: {
            ...baseInitialState.currentTask,
            id: 'new-task-456',
          },
          activeAgent: 'tester',
        });
      });

      // Should sync with conversation manager
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.currentTask?.id).toBe('new-task-456');
        expect(state.activeAgent).toBe('tester');
      });
    });

    it('clears conversation manager state when task is cleared', async () => {
      let appInstance: any = null;

      const stateWithTask = {
        ...baseInitialState,
        currentTask: {
          ...baseInitialState.currentTask!,
          id: 'task-to-clear',
        },
        activeAgent: 'developer',
      };

      render(
        <App
          initialState={stateWithTask}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Clear task and agent
      act(() => {
        appInstance.updateState({
          currentTask: undefined,
          activeAgent: undefined,
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.currentTask).toBeUndefined();
        expect(state.activeAgent).toBeUndefined();
      });

      // Should not show AgentPanel without task
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });
  });

  describe('state consistency', () => {
    it('maintains state consistency across re-renders', async () => {
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

      // Set some state
      act(() => {
        appInstance.updateState({
          activeAgent: 'developer',
          previousAgent: 'planner',
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
        expect(state.previousAgent).toBe('planner');
      });

      // Force re-render with different prop
      rerender(<TestWrapper testProp="changed" />);

      // State should persist
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
        expect(state.previousAgent).toBe('planner');
      });
    });

    it('handles concurrent state updates correctly', async () => {
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

      // Multiple concurrent updates
      act(() => {
        appInstance.updateState({
          activeAgent: 'developer',
        });
        appInstance.updateState({
          previousAgent: 'planner',
        });
        appInstance.updateState({
          parallelAgents: [{ name: 'tester', status: 'parallel' }],
        });
        appInstance.updateState({
          showParallelPanel: true,
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
        expect(state.previousAgent).toBe('planner');
        expect(state.parallelAgents).toEqual([{ name: 'tester', status: 'parallel' }]);
        expect(state.showParallelPanel).toBe(true);
      });
    });

    it('preserves unrelated state during agent updates', async () => {
      let appInstance: any = null;

      const stateWithOtherData = {
        ...baseInitialState,
        tokens: { input: 100, output: 200 },
        cost: 0.05,
        model: 'claude-3-opus',
      };

      render(
        <App
          initialState={stateWithOtherData}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Update only agent state
      act(() => {
        appInstance.updateState({
          activeAgent: 'developer',
          parallelAgents: [{ name: 'tester', status: 'parallel' }],
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Agent state should update
        expect(state.activeAgent).toBe('developer');
        expect(state.parallelAgents).toEqual([{ name: 'tester', status: 'parallel' }]);
        // Other state should persist
        expect(state.tokens).toEqual({ input: 100, output: 200 });
        expect(state.cost).toBe(0.05);
        expect(state.model).toBe('claude-3-opus');
      });
    });
  });

  describe('displayMode state management', () => {
    it('updates displayMode correctly', async () => {
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

      // Initial state should be normal
      expect(appInstance.getState().displayMode).toBe('normal');

      // Update to compact
      act(() => {
        appInstance.updateState({ displayMode: 'compact' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('compact');
      });

      // Update to verbose
      act(() => {
        appInstance.updateState({ displayMode: 'verbose' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('verbose');
      });
    });

    it('preserves displayMode when updating other state', async () => {
      let appInstance: any = null;

      const initialStateWithDisplayMode = {
        ...baseInitialState,
        displayMode: 'compact',
      };

      render(
        <App
          initialState={initialStateWithDisplayMode}
          onCommand={mockOnCommand}
          onTask={mockOnTask}
          onExit={mockOnExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Update other properties but not displayMode
      act(() => {
        appInstance.updateState({
          tokens: { input: 100, output: 200 },
          cost: 0.05,
          activeAgent: 'developer',
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('compact'); // Should remain unchanged
        expect(state.tokens).toEqual({ input: 100, output: 200 });
        expect(state.activeAgent).toBe('developer');
      });
    });

    it('handles displayMode updates with other properties', async () => {
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

      // Update displayMode along with other properties
      act(() => {
        appInstance.updateState({
          displayMode: 'verbose',
          activeAgent: 'tester',
          isProcessing: true,
          tokens: { input: 50, output: 100 },
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.displayMode).toBe('verbose');
        expect(state.activeAgent).toBe('tester');
        expect(state.isProcessing).toBe(true);
        expect(state.tokens).toEqual({ input: 50, output: 100 });
      });
    });

    it('cycles through all display modes correctly', async () => {
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

      // Cycle through all modes
      const modes = ['normal', 'compact', 'verbose', 'normal'] as const;

      for (let i = 0; i < modes.length; i++) {
        act(() => {
          appInstance.updateState({ displayMode: modes[i] });
        });

        await waitFor(() => {
          const state = appInstance.getState();
          expect(state.displayMode).toBe(modes[i]);
        });
      }
    });
  });

  describe('error handling', () => {
    it('handles invalid agent state gracefully', async () => {
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

      // Try to update with invalid data
      expect(() => {
        act(() => {
          appInstance.updateState({
            parallelAgents: null, // Invalid type
            showParallelPanel: 'invalid', // Invalid type
          });
        });
      }).not.toThrow();

      // App should continue to function
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles missing workflow data gracefully', () => {
      const stateWithInvalidWorkflow = {
        ...baseInitialState,
        currentTask: {
          ...baseInitialState.currentTask!,
          workflow: 'nonexistent-workflow',
        },
      };

      expect(() => {
        render(
          <App
            initialState={stateWithInvalidWorkflow}
            onCommand={mockOnCommand}
            onTask={mockOnTask}
            onExit={mockOnExit}
          />
        );
      }).not.toThrow();

      // Should still show AgentPanel with empty agent list
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });
});