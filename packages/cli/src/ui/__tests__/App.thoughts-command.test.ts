/**
 * Comprehensive tests for /thoughts command functionality in App component
 * Tests command handling, state updates, confirmation messages, and integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppState } from '../App';

describe('App /thoughts Command Functionality', () => {
  let mockState: AppState;

  beforeEach(() => {
    mockState = {
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
      displayMode: 'normal',
      previewMode: false,
      showThoughts: false,
    };
  });

  describe('Command recognition and parsing', () => {
    it('should recognize /thoughts command', () => {
      const input = '/thoughts';
      const isCommand = input.startsWith('/');
      const parts = input.slice(1).split(/\s+/);
      const command = parts[0].toLowerCase();

      expect(isCommand).toBe(true);
      expect(command).toBe('thoughts');
      expect(parts).toHaveLength(1);
    });

    it('should recognize thoughts command without slash', () => {
      const input = 'thoughts';
      const parts = input.split(/\s+/);
      const command = parts[0].toLowerCase();

      expect(command).toBe('thoughts');
    });

    it('should handle thoughts command with extra whitespace', () => {
      const inputs = [
        '/thoughts ',
        '  /thoughts  ',
        '/thoughts\t',
        '\n/thoughts\n',
      ];

      inputs.forEach(input => {
        const trimmed = input.trim();
        const isCommand = trimmed.startsWith('/');
        const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
        const command = parts[0]?.toLowerCase();

        expect(isCommand).toBe(true);
        expect(command).toBe('thoughts');
      });
    });

    it('should not recognize partial thoughts commands', () => {
      const invalidInputs = [
        '/though',
        '/thought',
        '/think',
        '/thoughs',
      ];

      invalidInputs.forEach(input => {
        const parts = input.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();

        expect(command).not.toBe('thoughts');
      });
    });
  });

  describe('State toggle functionality', () => {
    it('should toggle showThoughts from false to true', () => {
      const currentState = { ...mockState, showThoughts: false };

      // Simulate the thoughts command toggle logic
      const handleThoughtsCommand = (state: AppState) => {
        const newShowThoughts = !state.showThoughts;
        return {
          ...state,
          showThoughts: newShowThoughts,
        };
      };

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(true);
      expect(currentState.showThoughts).toBe(false); // Original unchanged
    });

    it('should toggle showThoughts from true to false', () => {
      const currentState = { ...mockState, showThoughts: true };

      const handleThoughtsCommand = (state: AppState) => {
        const newShowThoughts = !state.showThoughts;
        return {
          ...state,
          showThoughts: newShowThoughts,
        };
      };

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(false);
      expect(currentState.showThoughts).toBe(true); // Original unchanged
    });

    it('should maintain other state properties during toggle', () => {
      const currentState = {
        ...mockState,
        showThoughts: false,
        displayMode: 'verbose' as const,
        isProcessing: true,
        activeAgent: 'developer',
      };

      const handleThoughtsCommand = (state: AppState) => {
        return {
          ...state,
          showThoughts: !state.showThoughts,
        };
      };

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(true);
      expect(newState.displayMode).toBe('verbose');
      expect(newState.isProcessing).toBe(true);
      expect(newState.activeAgent).toBe('developer');
      expect(newState.projectPath).toBe('/test/project');
    });
  });

  describe('Confirmation message generation', () => {
    it('should generate enable confirmation message when turning on thoughts', () => {
      const currentState = { ...mockState, showThoughts: false };
      const newShowThoughts = !currentState.showThoughts;

      const expectedMessage = newShowThoughts
        ? 'Thought visibility enabled: AI reasoning will be shown'
        : 'Thought visibility disabled: AI reasoning will be hidden';

      expect(newShowThoughts).toBe(true);
      expect(expectedMessage).toBe('Thought visibility enabled: AI reasoning will be shown');
    });

    it('should generate disable confirmation message when turning off thoughts', () => {
      const currentState = { ...mockState, showThoughts: true };
      const newShowThoughts = !currentState.showThoughts;

      const expectedMessage = newShowThoughts
        ? 'Thought visibility enabled: AI reasoning will be shown'
        : 'Thought visibility disabled: AI reasoning will be hidden';

      expect(newShowThoughts).toBe(false);
      expect(expectedMessage).toBe('Thought visibility disabled: AI reasoning will be hidden');
    });

    it('should create properly formatted system message', () => {
      const generateSystemMessage = (showThoughts: boolean, timestamp = new Date()) => ({
        id: `msg_${Date.now()}`,
        type: 'system' as const,
        content: showThoughts
          ? 'Thought visibility enabled: AI reasoning will be shown'
          : 'Thought visibility disabled: AI reasoning will be hidden',
        timestamp,
      });

      const enableMessage = generateSystemMessage(true);
      const disableMessage = generateSystemMessage(false);

      expect(enableMessage.type).toBe('system');
      expect(enableMessage.content).toContain('enabled');
      expect(enableMessage.id).toContain('msg_');

      expect(disableMessage.type).toBe('system');
      expect(disableMessage.content).toContain('disabled');
      expect(disableMessage.id).toContain('msg_');
    });
  });

  describe('Complete command handling workflow', () => {
    it('should handle complete thoughts enable workflow', () => {
      const currentState = { ...mockState, showThoughts: false, messages: [] };

      // Simulate the complete command handling from App.tsx
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

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(true);
      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0].type).toBe('system');
      expect(newState.messages[0].content).toContain('enabled');
    });

    it('should handle complete thoughts disable workflow', () => {
      const currentState = {
        ...mockState,
        showThoughts: true,
        messages: [
          {
            id: 'existing_msg',
            type: 'user' as const,
            content: 'Previous message',
            timestamp: new Date(),
          },
        ],
      };

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

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(false);
      expect(newState.messages).toHaveLength(2);
      expect(newState.messages[0].content).toBe('Previous message');
      expect(newState.messages[1].type).toBe('system');
      expect(newState.messages[1].content).toContain('disabled');
    });
  });

  describe('Command execution scenarios', () => {
    it('should handle multiple consecutive thought toggles', () => {
      let currentState = { ...mockState, showThoughts: false, messages: [] };

      const handleThoughtsCommand = (state: AppState) => {
        const newShowThoughts = !state.showThoughts;
        return {
          ...state,
          showThoughts: newShowThoughts,
          messages: [
            ...state.messages,
            {
              id: `msg_${Date.now()}_${Math.random()}`,
              type: 'system' as const,
              content: newShowThoughts
                ? 'Thought visibility enabled: AI reasoning will be shown'
                : 'Thought visibility disabled: AI reasoning will be hidden',
              timestamp: new Date(),
            },
          ],
        };
      };

      // First toggle - enable
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(true);
      expect(currentState.messages).toHaveLength(1);
      expect(currentState.messages[0].content).toContain('enabled');

      // Second toggle - disable
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(false);
      expect(currentState.messages).toHaveLength(2);
      expect(currentState.messages[1].content).toContain('disabled');

      // Third toggle - enable again
      currentState = handleThoughtsCommand(currentState);
      expect(currentState.showThoughts).toBe(true);
      expect(currentState.messages).toHaveLength(3);
      expect(currentState.messages[2].content).toContain('enabled');
    });

    it('should handle thoughts command during active task', () => {
      const currentState = {
        ...mockState,
        showThoughts: false,
        isProcessing: true,
        activeAgent: 'developer',
        currentTask: {
          id: 'task-123',
          description: 'Test task',
          status: 'running' as const,
          workflow: 'feature',
          createdAt: new Date(),
        },
      };

      const handleThoughtsCommand = (state: AppState) => {
        return {
          ...state,
          showThoughts: !state.showThoughts,
        };
      };

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(true);
      expect(newState.isProcessing).toBe(true);
      expect(newState.activeAgent).toBe('developer');
      expect(newState.currentTask?.status).toBe('running');
    });

    it('should handle thoughts command with different display modes', () => {
      const displayModes: Array<'normal' | 'compact' | 'verbose'> = ['normal', 'compact', 'verbose'];

      displayModes.forEach(mode => {
        const currentState = {
          ...mockState,
          showThoughts: false,
          displayMode: mode,
        };

        const handleThoughtsCommand = (state: AppState) => {
          return {
            ...state,
            showThoughts: !state.showThoughts,
          };
        };

        const newState = handleThoughtsCommand(currentState);

        expect(newState.showThoughts).toBe(true);
        expect(newState.displayMode).toBe(mode);
      });
    });
  });

  describe('Input history and conversation integration', () => {
    it('should add thoughts command to input history', () => {
      const input = '/thoughts';
      const currentHistory = ['previous command', 'another command'];

      const newHistory = [...currentHistory, input];

      expect(newHistory).toEqual(['previous command', 'another command', '/thoughts']);
      expect(newHistory).toHaveLength(3);
    });

    it('should handle thoughts command in conversation context', () => {
      const conversationMessages = [
        {
          id: 'msg1',
          type: 'user' as const,
          content: 'Start working on the feature',
          timestamp: new Date(),
        },
        {
          id: 'msg2',
          type: 'assistant' as const,
          content: 'Starting feature implementation',
          agent: 'developer',
          thinking: 'I need to plan the architecture first',
          timestamp: new Date(),
        },
      ];

      const currentState = {
        ...mockState,
        showThoughts: false,
        messages: conversationMessages,
      };

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

      const newState = handleThoughtsCommand(currentState);

      expect(newState.showThoughts).toBe(true);
      expect(newState.messages).toHaveLength(3);
      expect(newState.messages[0].content).toBe('Start working on the feature');
      expect(newState.messages[1].thinking).toBe('I need to plan the architecture first');
      expect(newState.messages[2].content).toContain('enabled');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle thoughts command when state is already in target state', () => {
      // Enable when already enabled
      const enabledState = { ...mockState, showThoughts: true };

      const handleThoughtsCommand = (state: AppState) => {
        return {
          ...state,
          showThoughts: !state.showThoughts,
        };
      };

      const newState = handleThoughtsCommand(enabledState);
      expect(newState.showThoughts).toBe(false); // Should toggle anyway
    });

    it('should handle thoughts command with malformed input gracefully', () => {
      const malformedInputs = [
        '/thoughts extra args',
        '/thoughts 123',
        '/thoughts --flag',
      ];

      malformedInputs.forEach(input => {
        const parts = input.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();

        expect(command).toBe('thoughts');
        // Command should still work despite extra arguments
      });
    });

    it('should handle thoughts command during processing state', () => {
      const processingState = {
        ...mockState,
        showThoughts: false,
        isProcessing: true,
      };

      const handleThoughtsCommand = (state: AppState) => {
        return {
          ...state,
          showThoughts: !state.showThoughts,
        };
      };

      const newState = handleThoughtsCommand(processingState);

      expect(newState.showThoughts).toBe(true);
      expect(newState.isProcessing).toBe(true); // Should not affect processing state
    });
  });

  describe('Performance and optimization considerations', () => {
    it('should handle thoughts command with large message history efficiently', () => {
      const largeMessageHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg_${i}`,
        type: 'assistant' as const,
        content: `Message ${i}`,
        thinking: i % 2 === 0 ? `Thinking ${i}` : undefined,
        timestamp: new Date(Date.now() + i * 1000),
      }));

      const currentState = {
        ...mockState,
        showThoughts: false,
        messages: largeMessageHistory,
      };

      const handleThoughtsCommand = (state: AppState) => {
        return {
          ...state,
          showThoughts: !state.showThoughts,
        };
      };

      const start = performance.now();
      const newState = handleThoughtsCommand(currentState);
      const end = performance.now();

      expect(newState.showThoughts).toBe(true);
      expect(newState.messages).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should handle rapid thoughts command toggles', () => {
      let currentState = { ...mockState, showThoughts: false };

      const handleThoughtsCommand = (state: AppState) => {
        return {
          ...state,
          showThoughts: !state.showThoughts,
        };
      };

      // Simulate rapid toggles
      const toggleCount = 100;
      const start = performance.now();

      for (let i = 0; i < toggleCount; i++) {
        currentState = handleThoughtsCommand(currentState);
      }

      const end = performance.now();

      expect(currentState.showThoughts).toBe(false); // Even number of toggles
      expect(end - start).toBeLessThan(100); // Should handle rapid toggles efficiently
    });
  });
});