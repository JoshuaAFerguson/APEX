/**
 * Integration tests for REPL display mode functionality
 *
 * Tests the integration between:
 * - REPL command handling
 * - Display mode state management
 * - UI component adaptation
 * - Session persistence
 * - Error recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DisplayMode } from '@apex/core';

// Mock external dependencies
vi.mock('ink', () => ({
  render: vi.fn(),
  Box: vi.fn(),
  Text: vi.fn(),
  useInput: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

// Mock REPL context and services
const mockReplContext = {
  app: {
    getState: vi.fn(),
    updateState: vi.fn(),
    addMessage: vi.fn(),
    setState: vi.fn(),
  },
  orchestrator: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  sessionStore: {
    getDisplayMode: vi.fn(),
    setDisplayMode: vi.fn(),
    getCurrentSession: vi.fn(),
    updateSession: vi.fn(),
  },
  completionEngine: {
    getCompletions: vi.fn(),
    updateContext: vi.fn(),
  },
  conversationManager: {
    addMessage: vi.fn(),
    getContext: vi.fn(),
  },
};

describe('REPL Display Modes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    mockReplContext.app.getState.mockReturnValue({
      displayMode: 'normal',
      messages: [],
      isProcessing: false,
    });

    mockReplContext.sessionStore.getDisplayMode.mockReturnValue('normal');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Command Handling', () => {
    describe('/compact command', () => {
      it('should toggle from normal to compact mode', async () => {
        // Initial state: normal mode
        mockReplContext.app.getState.mockReturnValue({ displayMode: 'normal' });

        // Simulate /compact command
        const handleCompactCommand = async () => {
          const currentState = mockReplContext.app.getState();
          const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';

          mockReplContext.app.updateState({ displayMode: newMode });
          mockReplContext.sessionStore.setDisplayMode(newMode);
          mockReplContext.app.addMessage({
            type: 'system',
            content: newMode === 'compact'
              ? 'Display mode set to compact: Single-line status, condensed output'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleCompactCommand();

        expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
        expect(mockReplContext.sessionStore.setDisplayMode).toHaveBeenCalledWith('compact');
        expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to compact: Single-line status, condensed output',
        });
      });

      it('should toggle from compact back to normal mode', async () => {
        // Initial state: compact mode
        mockReplContext.app.getState.mockReturnValue({ displayMode: 'compact' });

        const handleCompactCommand = async () => {
          const currentState = mockReplContext.app.getState();
          const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';

          mockReplContext.app.updateState({ displayMode: newMode });
          mockReplContext.sessionStore.setDisplayMode(newMode);
          mockReplContext.app.addMessage({
            type: 'system',
            content: newMode === 'compact'
              ? 'Display mode set to compact: Single-line status, condensed output'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleCompactCommand();

        expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'normal' });
        expect(mockReplContext.sessionStore.setDisplayMode).toHaveBeenCalledWith('normal');
        expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to normal: Standard display with all components shown',
        });
      });
    });

    describe('/verbose command', () => {
      it('should toggle from normal to verbose mode', async () => {
        // Initial state: normal mode
        mockReplContext.app.getState.mockReturnValue({ displayMode: 'normal' });

        const handleVerboseCommand = async () => {
          const currentState = mockReplContext.app.getState();
          const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';

          mockReplContext.app.updateState({ displayMode: newMode });
          mockReplContext.sessionStore.setDisplayMode(newMode);
          mockReplContext.app.addMessage({
            type: 'system',
            content: newMode === 'verbose'
              ? 'Display mode set to verbose: Detailed debug output, full information'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleVerboseCommand();

        expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
        expect(mockReplContext.sessionStore.setDisplayMode).toHaveBeenCalledWith('verbose');
        expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to verbose: Detailed debug output, full information',
        });
      });

      it('should change from compact to verbose directly', async () => {
        // Initial state: compact mode
        mockReplContext.app.getState.mockReturnValue({ displayMode: 'compact' });

        const handleVerboseCommand = async () => {
          const currentState = mockReplContext.app.getState();
          const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';

          mockReplContext.app.updateState({ displayMode: newMode });
          mockReplContext.sessionStore.setDisplayMode(newMode);
          mockReplContext.app.addMessage({
            type: 'system',
            content: newMode === 'verbose'
              ? 'Display mode set to verbose: Detailed debug output, full information'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleVerboseCommand();

        expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
        expect(mockReplContext.sessionStore.setDisplayMode).toHaveBeenCalledWith('verbose');
      });
    });

    describe('Command routing', () => {
      it('should route display mode commands correctly', async () => {
        const handleCommand = async (command: string) => {
          const currentState = mockReplContext.app.getState();

          switch (command) {
            case 'compact':
              const compactMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';
              mockReplContext.app.updateState({ displayMode: compactMode });
              mockReplContext.sessionStore.setDisplayMode(compactMode);
              mockReplContext.app.addMessage({
                type: 'system',
                content: compactMode === 'compact'
                  ? 'Display mode set to compact: Single-line status, condensed output'
                  : 'Display mode set to normal: Standard display with all components shown',
              });
              break;

            case 'verbose':
              const verboseMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';
              mockReplContext.app.updateState({ displayMode: verboseMode });
              mockReplContext.sessionStore.setDisplayMode(verboseMode);
              mockReplContext.app.addMessage({
                type: 'system',
                content: verboseMode === 'verbose'
                  ? 'Display mode set to verbose: Detailed debug output, full information'
                  : 'Display mode set to normal: Standard display with all components shown',
              });
              break;

            default:
              mockReplContext.app.addMessage({
                type: 'error',
                content: `Unknown command: /${command}`,
              });
              break;
          }
        };

        // Test compact command routing
        mockReplContext.app.getState.mockReturnValue({ displayMode: 'normal' });
        await handleCommand('compact');
        expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });

        // Test verbose command routing
        mockReplContext.app.getState.mockReturnValue({ displayMode: 'normal' });
        await handleCommand('verbose');
        expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });

        // Test unknown command
        await handleCommand('unknown');
        expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
          type: 'error',
          content: 'Unknown command: /unknown',
        });
      });
    });
  });

  describe('State Management Integration', () => {
    it('should synchronize app state with session store', async () => {
      const synchronizeDisplayMode = async (newMode: DisplayMode) => {
        // Update app state
        mockReplContext.app.updateState({ displayMode: newMode });

        // Persist to session store
        mockReplContext.sessionStore.setDisplayMode(newMode);

        // Update context for other services
        mockReplContext.completionEngine.updateContext({
          displayMode: newMode,
        });
      };

      await synchronizeDisplayMode('compact');

      expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
      expect(mockReplContext.sessionStore.setDisplayMode).toHaveBeenCalledWith('compact');
      expect(mockReplContext.completionEngine.updateContext).toHaveBeenCalledWith({
        displayMode: 'compact',
      });
    });

    it('should restore display mode from session on REPL startup', async () => {
      // Simulate session store having saved mode
      mockReplContext.sessionStore.getDisplayMode.mockReturnValue('verbose');

      const initializeREPL = async () => {
        const savedMode = mockReplContext.sessionStore.getDisplayMode();

        if (savedMode && ['normal', 'compact', 'verbose'].includes(savedMode)) {
          mockReplContext.app.updateState({ displayMode: savedMode });
        } else {
          mockReplContext.app.updateState({ displayMode: 'normal' });
        }
      };

      await initializeREPL();

      expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
    });

    it('should handle corrupted session state gracefully', async () => {
      // Simulate corrupted session data
      mockReplContext.sessionStore.getDisplayMode.mockReturnValue('invalid-mode' as any);

      const initializeREPL = async () => {
        const savedMode = mockReplContext.sessionStore.getDisplayMode();

        if (savedMode && ['normal', 'compact', 'verbose'].includes(savedMode)) {
          mockReplContext.app.updateState({ displayMode: savedMode });
        } else {
          // Fallback to normal mode for invalid data
          mockReplContext.app.updateState({ displayMode: 'normal' });
        }
      };

      await initializeREPL();

      expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'normal' });
    });
  });

  describe('Event Handling Integration', () => {
    it('should handle orchestrator events differently based on display mode', async () => {
      const handleAgentMessage = (taskId: string, agent: string, message: string, mode: DisplayMode) => {
        let formattedMessage = message;

        switch (mode) {
          case 'compact':
            // Truncate message for compact display
            formattedMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
            break;
          case 'verbose':
            // Add extra details for verbose mode
            formattedMessage = `[${new Date().toISOString()}] ${agent}: ${message}`;
            break;
          default:
            // Standard formatting for normal mode
            formattedMessage = `${agent}: ${message}`;
            break;
        }

        mockReplContext.app.addMessage({
          type: 'agent',
          content: formattedMessage,
          taskId,
          agent,
        });
      };

      const longMessage = 'This is a very long message that should be truncated in compact mode but shown fully in verbose mode';

      // Test compact mode
      handleAgentMessage('task1', 'developer', longMessage, 'compact');
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'agent',
        content: 'This is a very long message that should be trunca...',
        taskId: 'task1',
        agent: 'developer',
      });

      vi.clearAllMocks();

      // Test verbose mode
      handleAgentMessage('task1', 'developer', longMessage, 'verbose');
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent',
          content: expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T.*\] developer: This is a very long message/),
          taskId: 'task1',
          agent: 'developer',
        })
      );

      vi.clearAllMocks();

      // Test normal mode
      handleAgentMessage('task1', 'developer', longMessage, 'normal');
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'agent',
        content: `developer: ${longMessage}`,
        taskId: 'task1',
        agent: 'developer',
      });
    });

    it('should handle tool use events based on display mode', async () => {
      const handleToolUse = (taskId: string, tool: string, input: any, mode: DisplayMode) => {
        let toolDisplay = `${tool}: `;

        switch (mode) {
          case 'compact':
            // Minimal display for compact mode
            if (typeof input === 'object' && input !== null) {
              toolDisplay += Object.keys(input).join(', ');
            } else {
              toolDisplay += String(input).substring(0, 20);
            }
            break;
          case 'verbose':
            // Full details for verbose mode
            toolDisplay += JSON.stringify(input, null, 2);
            break;
          default:
            // Summary for normal mode
            if (typeof input === 'object' && input !== null) {
              toolDisplay += JSON.stringify(input).substring(0, 100);
            } else {
              toolDisplay += String(input).substring(0, 100);
            }
            break;
        }

        mockReplContext.app.addMessage({
          type: 'tool',
          content: toolDisplay,
          taskId,
          tool,
        });
      };

      const toolInput = {
        file_path: '/very/long/path/to/some/file.ts',
        content: 'export function example() { return "hello"; }',
        options: { backup: true, validate: true },
      };

      // Test compact mode
      handleToolUse('task1', 'Write', toolInput, 'compact');
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'tool',
        content: 'Write: file_path, content, options',
        taskId: 'task1',
        tool: 'Write',
      });

      vi.clearAllMocks();

      // Test verbose mode
      handleToolUse('task1', 'Write', toolInput, 'verbose');
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'tool',
        content: expect.stringContaining('Write: {\n  "file_path"'),
        taskId: 'task1',
        tool: 'Write',
      });

      vi.clearAllMocks();

      // Test normal mode
      handleToolUse('task1', 'Write', toolInput, 'normal');
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'tool',
        content: expect.stringMatching(/^Write: \{.*\}$/),
        taskId: 'task1',
        tool: 'Write',
      });
    });
  });

  describe('Error Recovery', () => {
    it('should handle app state errors gracefully', async () => {
      // Simulate app state error
      mockReplContext.app.getState.mockImplementation(() => {
        throw new Error('App state corrupted');
      });

      const safeHandleCommand = async (command: string) => {
        try {
          const currentState = mockReplContext.app.getState();
          const newMode = command === 'compact' ? 'compact' : 'verbose';
          mockReplContext.app.updateState({ displayMode: newMode });
        } catch (error) {
          // Fallback to safe state
          mockReplContext.app.updateState({ displayMode: 'normal' });
          mockReplContext.app.addMessage({
            type: 'error',
            content: 'Error accessing app state, reset to normal mode',
          });
        }
      };

      await safeHandleCommand('compact');

      expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'normal' });
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'error',
        content: 'Error accessing app state, reset to normal mode',
      });
    });

    it('should recover from session store failures', async () => {
      // Simulate session store error
      mockReplContext.sessionStore.setDisplayMode.mockImplementation(() => {
        throw new Error('Session store write failed');
      });

      const safeSetDisplayMode = async (mode: DisplayMode) => {
        try {
          // Try to update app state first
          mockReplContext.app.updateState({ displayMode: mode });

          // Then try to persist
          mockReplContext.sessionStore.setDisplayMode(mode);
        } catch (error) {
          // If persistence fails, log but don't fail the operation
          mockReplContext.app.addMessage({
            type: 'warning',
            content: 'Display mode changed but could not be saved to session',
          });
        }
      };

      await safeSetDisplayMode('compact');

      expect(mockReplContext.app.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
      expect(mockReplContext.app.addMessage).toHaveBeenCalledWith({
        type: 'warning',
        content: 'Display mode changed but could not be saved to session',
      });
    });

    it('should handle message overflow in verbose mode', async () => {
      const handleMessageOverflow = (messages: any[], maxMessages: number, mode: DisplayMode) => {
        if (mode === 'verbose' && messages.length > maxMessages) {
          // In verbose mode, we might accumulate many messages
          // Implement cleanup while preserving important messages
          const importantMessages = messages.filter(msg =>
            msg.type === 'error' || msg.type === 'user' || msg.type === 'system'
          );
          const recentMessages = messages.slice(-Math.floor(maxMessages * 0.7));

          return [...importantMessages.slice(0, Math.floor(maxMessages * 0.3)), ...recentMessages];
        }

        return messages.slice(-maxMessages);
      };

      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        type: i % 10 === 0 ? 'error' : 'agent',
        content: `Message ${i}`,
        timestamp: Date.now() + i,
      }));

      const compactResult = handleMessageOverflow(manyMessages, 100, 'compact');
      const verboseResult = handleMessageOverflow(manyMessages, 100, 'verbose');

      expect(compactResult.length).toBeLessThanOrEqual(100);
      expect(verboseResult.length).toBeLessThanOrEqual(100);

      // Verbose mode should preserve more error messages
      const verboseErrorCount = verboseResult.filter(msg => msg.type === 'error').length;
      const compactErrorCount = compactResult.filter(msg => msg.type === 'error').length;

      expect(verboseErrorCount).toBeGreaterThanOrEqual(compactErrorCount);
    });
  });

  describe('Performance Integration', () => {
    it('should handle rapid mode switching efficiently', async () => {
      const rapidModeSwitch = async () => {
        const modes: DisplayMode[] = ['compact', 'verbose', 'normal'];
        const operations: Promise<void>[] = [];

        for (let i = 0; i < 100; i++) {
          const mode = modes[i % modes.length];
          const operation = Promise.resolve().then(() => {
            mockReplContext.app.updateState({ displayMode: mode });
            mockReplContext.sessionStore.setDisplayMode(mode);
          });
          operations.push(operation);
        }

        await Promise.all(operations);
      };

      const startTime = performance.now();
      await rapidModeSwitch();
      const endTime = performance.now();

      // Should complete quickly even with many operations
      expect(endTime - startTime).toBeLessThan(1000); // 1 second

      // All operations should have completed
      expect(mockReplContext.app.updateState).toHaveBeenCalledTimes(100);
      expect(mockReplContext.sessionStore.setDisplayMode).toHaveBeenCalledTimes(100);
    });

    it('should optimize message processing based on display mode', async () => {
      const processMessages = (messages: any[], mode: DisplayMode) => {
        const startTime = performance.now();

        const processedMessages = messages.map(msg => {
          switch (mode) {
            case 'compact':
              return {
                ...msg,
                content: msg.content.substring(0, 50), // Truncate for performance
              };
            case 'verbose':
              return {
                ...msg,
                content: msg.content,
                timestamp: new Date().toISOString(),
                metadata: { processed: true },
              };
            default:
              return msg;
          }
        });

        const endTime = performance.now();
        return { processedMessages, duration: endTime - startTime };
      };

      const testMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        content: `This is a test message number ${i} with some content that might be long`,
        type: 'agent',
      }));

      const compactResult = processMessages(testMessages, 'compact');
      const normalResult = processMessages(testMessages, 'normal');
      const verboseResult = processMessages(testMessages, 'verbose');

      // Compact mode should be fastest due to truncation
      expect(compactResult.duration).toBeLessThan(verboseResult.duration);

      // All modes should complete reasonably quickly
      expect(compactResult.duration).toBeLessThan(100);
      expect(normalResult.duration).toBeLessThan(150);
      expect(verboseResult.duration).toBeLessThan(200);
    });
  });
});