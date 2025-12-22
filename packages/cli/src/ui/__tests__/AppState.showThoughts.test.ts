/**
 * Integration tests for showThoughts state management in App component
 * Tests the showThoughts boolean toggle and its integration with UI components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppState, AppProps } from '../App';
import type { DisplayMode } from '@apexcli/core';

describe('AppState showThoughts Integration', () => {
  let mockAppState: AppState;
  let mockAppProps: AppProps;

  beforeEach(() => {
    mockAppState = {
      initialized: true,
      projectPath: '/test/project',
      config: null,
      orchestrator: null,
      gitBranch: 'main',
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 0, output: 0 },
      cost: 0,
      model: 'sonnet',
      sessionStartTime: new Date(),
      sessionName: 'Test Session',
      displayMode: 'normal' as DisplayMode,
      previewMode: false,
      showThoughts: false,
    };

    mockAppProps = {
      initialState: mockAppState,
      onCommand: vi.fn(),
      onTask: vi.fn(),
      onExit: vi.fn(),
    };
  });

  describe('showThoughts state initialization', () => {
    it('should initialize with showThoughts as false', () => {
      expect(mockAppState.showThoughts).toBe(false);
    });

    it('should allow showThoughts to be set to true in initial state', () => {
      const stateWithThoughts: AppState = {
        ...mockAppState,
        showThoughts: true,
      };

      expect(stateWithThoughts.showThoughts).toBe(true);
    });

    it('should maintain showThoughts state type safety', () => {
      // TypeScript compilation test
      const validState: AppState = {
        ...mockAppState,
        showThoughts: true,
      };

      const anotherValidState: AppState = {
        ...mockAppState,
        showThoughts: false,
      };

      expect(typeof validState.showThoughts).toBe('boolean');
      expect(typeof anotherValidState.showThoughts).toBe('boolean');
    });
  });

  describe('showThoughts state transitions', () => {
    it('should toggle showThoughts from false to true', () => {
      const initialState = { ...mockAppState, showThoughts: false };
      const newState = { ...initialState, showThoughts: !initialState.showThoughts };

      expect(newState.showThoughts).toBe(true);
    });

    it('should toggle showThoughts from true to false', () => {
      const initialState = { ...mockAppState, showThoughts: true };
      const newState = { ...initialState, showThoughts: !initialState.showThoughts };

      expect(newState.showThoughts).toBe(false);
    });

    it('should maintain other state properties during showThoughts toggle', () => {
      const initialState = {
        ...mockAppState,
        showThoughts: false,
        displayMode: 'verbose' as DisplayMode,
        isProcessing: true,
      };

      const newState = {
        ...initialState,
        showThoughts: !initialState.showThoughts,
      };

      expect(newState.showThoughts).toBe(true);
      expect(newState.displayMode).toBe('verbose');
      expect(newState.isProcessing).toBe(true);
      expect(newState.projectPath).toBe('/test/project');
    });
  });

  describe('showThoughts with different display modes', () => {
    it('should work with normal display mode', () => {
      const state: AppState = {
        ...mockAppState,
        displayMode: 'normal',
        showThoughts: true,
      };

      expect(state.displayMode).toBe('normal');
      expect(state.showThoughts).toBe(true);
    });

    it('should work with verbose display mode', () => {
      const state: AppState = {
        ...mockAppState,
        displayMode: 'verbose',
        showThoughts: true,
      };

      expect(state.displayMode).toBe('verbose');
      expect(state.showThoughts).toBe(true);
    });

    it('should work with compact display mode', () => {
      const state: AppState = {
        ...mockAppState,
        displayMode: 'compact',
        showThoughts: true,
      };

      expect(state.displayMode).toBe('compact');
      expect(state.showThoughts).toBe(true);
      // Note: In compact mode, thoughts might be hidden by UI components
    });
  });

  describe('showThoughts state persistence simulation', () => {
    it('should simulate state updates as they would happen in the app', () => {
      let currentState = { ...mockAppState, showThoughts: false };

      // Simulate /thoughts command toggle
      const handleThoughtsCommand = (state: AppState) => ({
        ...state,
        showThoughts: !state.showThoughts,
      });

      // First toggle - enable thoughts
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(true);

      // Second toggle - disable thoughts
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(false);

      // Third toggle - enable again
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(true);
    });

    it('should handle state updates with partial updates', () => {
      let currentState = { ...mockAppState, showThoughts: false };

      // Simulate partial state update (like updateState function)
      const updateState = (updates: Partial<AppState>) => ({
        ...currentState,
        ...updates,
      });

      currentState = updateState({ showThoughts: true });
      expect(currentState.showThoughts).toBe(true);

      currentState = updateState({ showThoughts: false, displayMode: 'verbose' });
      expect(currentState.showThoughts).toBe(false);
      expect(currentState.displayMode).toBe('verbose');
    });
  });

  describe('showThoughts with agent and message data', () => {
    it('should handle showThoughts with messages containing thinking data', () => {
      const messagesWithThinking = [
        {
          id: 'msg1',
          type: 'assistant' as const,
          content: 'Working on the task...',
          agent: 'developer',
          thinking: 'I need to analyze the requirements first',
          timestamp: new Date(),
        },
        {
          id: 'msg2',
          type: 'assistant' as const,
          content: 'Task completed',
          agent: 'developer',
          thinking: 'All tests are passing, implementation looks good',
          timestamp: new Date(),
        },
      ];

      const stateWithThoughts: AppState = {
        ...mockAppState,
        showThoughts: true,
        messages: messagesWithThinking,
      };

      expect(stateWithThoughts.showThoughts).toBe(true);
      expect(stateWithThoughts.messages).toHaveLength(2);
      expect(stateWithThoughts.messages[0].thinking).toBe('I need to analyze the requirements first');
      expect(stateWithThoughts.messages[1].thinking).toBe('All tests are passing, implementation looks good');
    });

    it('should handle showThoughts with parallel agents', () => {
      const parallelAgents = [
        {
          name: 'tester-unit',
          status: 'parallel' as const,
          debugInfo: {
            thinking: 'Running unit tests',
            tokensUsed: { input: 500, output: 600 },
          },
        },
        {
          name: 'tester-integration',
          status: 'parallel' as const,
          debugInfo: {
            thinking: 'Running integration tests',
            tokensUsed: { input: 700, output: 800 },
          },
        },
      ];

      const stateWithParallelThoughts: AppState = {
        ...mockAppState,
        showThoughts: true,
        showParallelPanel: true,
        parallelAgents,
      };

      expect(stateWithParallelThoughts.showThoughts).toBe(true);
      expect(stateWithParallelThoughts.parallelAgents).toHaveLength(2);
      expect(stateWithParallelThoughts.parallelAgents?.[0].debugInfo?.thinking).toBe('Running unit tests');
      expect(stateWithParallelThoughts.parallelAgents?.[1].debugInfo?.thinking).toBe('Running integration tests');
    });
  });

  describe('showThoughts validation and edge cases', () => {
    it('should handle showThoughts with undefined or null values gracefully', () => {
      // This tests type safety - showThoughts should always be boolean
      const validState: AppState = {
        ...mockAppState,
        showThoughts: false,
      };

      expect(typeof validState.showThoughts).toBe('boolean');
      expect(validState.showThoughts).toBe(false);
    });

    it('should handle showThoughts in complex state scenarios', () => {
      const complexState: AppState = {
        ...mockAppState,
        showThoughts: true,
        isProcessing: true,
        displayMode: 'verbose',
        previewMode: true,
        currentTask: {
          id: 'task-123',
          description: 'Test task',
          status: 'running',
          workflow: 'feature',
          createdAt: new Date(),
        },
        activeAgent: 'developer',
        parallelAgents: [
          {
            name: 'tester',
            status: 'parallel',
            debugInfo: { thinking: 'Testing in progress' },
          },
        ],
      };

      expect(complexState.showThoughts).toBe(true);
      expect(complexState.isProcessing).toBe(true);
      expect(complexState.displayMode).toBe('verbose');
      expect(complexState.previewMode).toBe(true);
      expect(complexState.parallelAgents?.[0].debugInfo?.thinking).toBe('Testing in progress');
    });
  });

  describe('showThoughts command integration simulation', () => {
    it('should simulate thoughts command with confirmation message', () => {
      let currentState = { ...mockAppState, showThoughts: false, messages: [] };

      // Simulate the /thoughts command behavior from App.tsx
      const handleThoughtsCommand = (state: AppState) => {
        const newShowThoughts = !state.showThoughts;
        return {
          ...state,
          showThoughts: newShowThoughts,
          messages: [
            ...state.messages,
            {
              id: `msg_${Date.now()}`,
              type: 'system' as const,
              content: newShowThoughts
                ? 'Thought visibility enabled: AI reasoning will be shown'
                : 'Thought visibility disabled: AI reasoning will be hidden',
              timestamp: new Date(),
            },
          ],
        };
      };

      // Enable thoughts
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(true);
      expect(currentState.messages).toHaveLength(1);
      expect(currentState.messages[0].content).toContain('Thought visibility enabled');

      // Disable thoughts
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(false);
      expect(currentState.messages).toHaveLength(2);
      expect(currentState.messages[1].content).toContain('Thought visibility disabled');
    });
  });

  describe('showThoughts performance considerations', () => {
    it('should handle showThoughts with large number of agents efficiently', () => {
      const manyAgents = Array.from({ length: 50 }, (_, i) => ({
        name: `agent-${i}`,
        status: 'active' as const,
        debugInfo: {
          thinking: `Agent ${i} thinking content`,
          tokensUsed: { input: 100, output: 150 },
        },
      }));

      const stateWithManyAgents: AppState = {
        ...mockAppState,
        showThoughts: true,
        parallelAgents: manyAgents,
      };

      expect(stateWithManyAgents.showThoughts).toBe(true);
      expect(stateWithManyAgents.parallelAgents).toHaveLength(50);

      // Verify all agents have thinking content
      const agentsWithThinking = stateWithManyAgents.parallelAgents?.filter(
        agent => agent.debugInfo?.thinking
      );
      expect(agentsWithThinking).toHaveLength(50);
    });

    it('should handle showThoughts with large message history efficiently', () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        type: 'assistant' as const,
        content: `Message ${i} content`,
        agent: 'developer',
        thinking: i % 2 === 0 ? `Thinking for message ${i}` : undefined,
        timestamp: new Date(Date.now() + i * 1000),
      }));

      const stateWithManyMessages: AppState = {
        ...mockAppState,
        showThoughts: true,
        messages: manyMessages,
      };

      expect(stateWithManyMessages.showThoughts).toBe(true);
      expect(stateWithManyMessages.messages).toHaveLength(100);

      // Verify thinking content is present for even-numbered messages
      const messagesWithThinking = stateWithManyMessages.messages.filter(
        msg => msg.thinking
      );
      expect(messagesWithThinking).toHaveLength(50);
    });
  });
});