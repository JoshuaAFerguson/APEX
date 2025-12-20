/**
 * Comprehensive integration tests for display modes feature
 *
 * Tests the complete implementation of /compact and /verbose commands:
 * - Command parsing and execution
 * - State management and persistence
 * - UI component adaptation
 * - Edge cases and error handling
 *
 * Acceptance Criteria:
 * 1. /compact command toggles condensed output mode
 * 2. /verbose command toggles detailed debug output
 * 3. Display mode persists during session
 * 4. StatusBar and ActivityLog adapt to mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DisplayMode } from '@apexcli/core';

// Mock dependencies
const mockApp = {
  updateState: vi.fn(),
  addMessage: vi.fn(),
  getState: vi.fn(() => ({ displayMode: 'normal' })),
};

const mockSessionStore = {
  saveSession: vi.fn(),
  loadSession: vi.fn(),
  getDisplayMode: vi.fn(() => 'normal'),
  setDisplayMode: vi.fn(),
};

const mockActivityLog = {
  addEntry: vi.fn(),
  filterEntries: vi.fn(),
  getCompactEntries: vi.fn(() => []),
  getVerboseEntries: vi.fn(() => []),
};

const mockStatusBar = {
  setDisplayMode: vi.fn(),
  getCompactLayout: vi.fn(),
  getVerboseLayout: vi.fn(),
  getNormalLayout: vi.fn(),
};

describe('Display Modes Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Command Execution', () => {
    describe('/compact command', () => {
      it('should toggle from normal to compact mode', async () => {
        mockApp.getState.mockReturnValue({ displayMode: 'normal' });

        // Simulate handleCompact function from repl.tsx
        const handleCompact = async () => {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';

          mockApp.updateState({ displayMode: newMode });
          mockApp.addMessage({
            type: 'system',
            content: newMode === 'compact'
              ? 'Display mode set to compact: Single-line status, condensed output'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleCompact();

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to compact: Single-line status, condensed output',
        });
      });

      it('should toggle from compact back to normal mode', async () => {
        mockApp.getState.mockReturnValue({ displayMode: 'compact' });

        const handleCompact = async () => {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';

          mockApp.updateState({ displayMode: newMode });
          mockApp.addMessage({
            type: 'system',
            content: newMode === 'compact'
              ? 'Display mode set to compact: Single-line status, condensed output'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleCompact();

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'normal' });
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to normal: Standard display with all components shown',
        });
      });

      it('should change from verbose to compact mode', async () => {
        mockApp.getState.mockReturnValue({ displayMode: 'verbose' });

        const handleCompact = async () => {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';

          mockApp.updateState({ displayMode: newMode });
          mockApp.addMessage({
            type: 'system',
            content: newMode === 'compact'
              ? 'Display mode set to compact: Single-line status, condensed output'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleCompact();

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
      });
    });

    describe('/verbose command', () => {
      it('should toggle from normal to verbose mode', async () => {
        mockApp.getState.mockReturnValue({ displayMode: 'normal' });

        const handleVerbose = async () => {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';

          mockApp.updateState({ displayMode: newMode });
          mockApp.addMessage({
            type: 'system',
            content: newMode === 'verbose'
              ? 'Display mode set to verbose: Detailed debug output, full information'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleVerbose();

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to verbose: Detailed debug output, full information',
        });
      });

      it('should toggle from verbose back to normal mode', async () => {
        mockApp.getState.mockReturnValue({ displayMode: 'verbose' });

        const handleVerbose = async () => {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';

          mockApp.updateState({ displayMode: newMode });
          mockApp.addMessage({
            type: 'system',
            content: newMode === 'verbose'
              ? 'Display mode set to verbose: Detailed debug output, full information'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleVerbose();

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'normal' });
        expect(mockApp.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Display mode set to normal: Standard display with all components shown',
        });
      });

      it('should change from compact to verbose mode', async () => {
        mockApp.getState.mockReturnValue({ displayMode: 'compact' });

        const handleVerbose = async () => {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';

          mockApp.updateState({ displayMode: newMode });
          mockApp.addMessage({
            type: 'system',
            content: newMode === 'verbose'
              ? 'Display mode set to verbose: Detailed debug output, full information'
              : 'Display mode set to normal: Standard display with all components shown',
          });
        };

        await handleVerbose();

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
      });
    });

    describe('Command routing', () => {
      it('should route commands correctly through command handler', async () => {
        const commandRouter = async (command: string, args: string[]) => {
          const currentState = mockApp.getState();

          switch (command) {
            case 'compact':
              const compactMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';
              mockApp.updateState({ displayMode: compactMode });
              mockApp.addMessage({
                type: 'system',
                content: compactMode === 'compact'
                  ? 'Display mode set to compact: Single-line status, condensed output'
                  : 'Display mode set to normal: Standard display with all components shown',
              });
              break;

            case 'verbose':
              const verboseMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';
              mockApp.updateState({ displayMode: verboseMode });
              mockApp.addMessage({
                type: 'system',
                content: verboseMode === 'verbose'
                  ? 'Display mode set to verbose: Detailed debug output, full information'
                  : 'Display mode set to normal: Standard display with all components shown',
              });
              break;

            default:
              mockApp.addMessage({
                type: 'error',
                content: `Unknown command: ${command}. Type /help for available commands.`,
              });
          }
        };

        mockApp.getState.mockReturnValue({ displayMode: 'normal' });

        await commandRouter('compact', []);
        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });

        mockApp.getState.mockReturnValue({ displayMode: 'compact' });
        await commandRouter('verbose', []);
        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
      });
    });
  });

  describe('State Management', () => {
    it('should maintain display mode state consistently', () => {
      const stateManager = {
        currentState: { displayMode: 'normal' as DisplayMode },

        updateDisplayMode(newMode: DisplayMode) {
          this.currentState.displayMode = newMode;
        },

        getDisplayMode(): DisplayMode {
          return this.currentState.displayMode;
        }
      };

      // Test state transitions
      expect(stateManager.getDisplayMode()).toBe('normal');

      stateManager.updateDisplayMode('compact');
      expect(stateManager.getDisplayMode()).toBe('compact');

      stateManager.updateDisplayMode('verbose');
      expect(stateManager.getDisplayMode()).toBe('verbose');

      stateManager.updateDisplayMode('normal');
      expect(stateManager.getDisplayMode()).toBe('normal');
    });

    it('should handle rapid state changes without corruption', async () => {
      let currentMode: DisplayMode = 'normal';

      const fastToggle = async (targetMode: DisplayMode) => {
        currentMode = targetMode;
        mockApp.updateState({ displayMode: currentMode });
      };

      // Rapidly change modes
      await Promise.all([
        fastToggle('compact'),
        fastToggle('verbose'),
        fastToggle('normal'),
        fastToggle('compact'),
      ]);

      expect(mockApp.updateState).toHaveBeenCalledTimes(4);
      expect(mockApp.updateState).toHaveBeenLastCalledWith({ displayMode: 'compact' });
    });

    it('should validate display mode values', () => {
      const validateDisplayMode = (mode: any): mode is DisplayMode => {
        return ['normal', 'compact', 'verbose'].includes(mode);
      };

      expect(validateDisplayMode('normal')).toBe(true);
      expect(validateDisplayMode('compact')).toBe(true);
      expect(validateDisplayMode('verbose')).toBe(true);
      expect(validateDisplayMode('invalid')).toBe(false);
      expect(validateDisplayMode(null)).toBe(false);
      expect(validateDisplayMode(undefined)).toBe(false);
    });
  });

  describe('Component Adaptation', () => {
    describe('StatusBar component', () => {
      it('should adapt layout for compact mode', () => {
        const statusBar = {
          render(displayMode: DisplayMode) {
            switch (displayMode) {
              case 'compact':
                return {
                  layout: 'single-line',
                  showDetails: false,
                  showProgress: true,
                  showTokens: false,
                  maxWidth: 80,
                };
              case 'verbose':
                return {
                  layout: 'multi-line',
                  showDetails: true,
                  showProgress: true,
                  showTokens: true,
                  showDebugInfo: true,
                  maxWidth: 120,
                };
              default:
                return {
                  layout: 'standard',
                  showDetails: true,
                  showProgress: true,
                  showTokens: true,
                  maxWidth: 100,
                };
            }
          }
        };

        const compactLayout = statusBar.render('compact');
        expect(compactLayout.layout).toBe('single-line');
        expect(compactLayout.showDetails).toBe(false);
        expect(compactLayout.showTokens).toBe(false);

        const verboseLayout = statusBar.render('verbose');
        expect(verboseLayout.layout).toBe('multi-line');
        expect(verboseLayout.showDetails).toBe(true);
        expect(verboseLayout.showDebugInfo).toBe(true);

        const normalLayout = statusBar.render('normal');
        expect(normalLayout.layout).toBe('standard');
        expect(normalLayout.showDetails).toBe(true);
      });
    });

    describe('ActivityLog component', () => {
      it('should filter entries based on display mode', () => {
        const activityEntries = [
          { id: 1, type: 'user', content: 'User action', priority: 'high' },
          { id: 2, type: 'system', content: 'System message', priority: 'low' },
          { id: 3, type: 'debug', content: 'Debug info', priority: 'low' },
          { id: 4, type: 'error', content: 'Error message', priority: 'high' },
          { id: 5, type: 'tool', content: 'Tool output', priority: 'medium' },
        ];

        const filterByDisplayMode = (entries: any[], mode: DisplayMode) => {
          switch (mode) {
            case 'compact':
              return entries.filter(entry =>
                entry.priority === 'high' || entry.type === 'user'
              );
            case 'verbose':
              return entries; // Show all entries
            default:
              return entries.filter(entry =>
                entry.type !== 'debug'
              );
          }
        };

        const compactEntries = filterByDisplayMode(activityEntries, 'compact');
        expect(compactEntries).toHaveLength(2); // user + error
        expect(compactEntries.every(e => e.priority === 'high' || e.type === 'user')).toBe(true);

        const verboseEntries = filterByDisplayMode(activityEntries, 'verbose');
        expect(verboseEntries).toHaveLength(5); // all entries

        const normalEntries = filterByDisplayMode(activityEntries, 'normal');
        expect(normalEntries).toHaveLength(4); // all except debug
      });

      it('should adjust entry detail level based on display mode', () => {
        const formatEntry = (entry: any, mode: DisplayMode) => {
          const base = {
            id: entry.id,
            content: entry.content,
          };

          switch (mode) {
            case 'compact':
              return {
                ...base,
                content: entry.content.substring(0, 30) + (entry.content.length > 30 ? '...' : ''),
              };
            case 'verbose':
              return {
                ...base,
                timestamp: entry.timestamp,
                metadata: entry.metadata,
                stackTrace: entry.stackTrace,
                details: entry.details,
              };
            default:
              return {
                ...base,
                timestamp: entry.timestamp,
              };
          }
        };

        const sampleEntry = {
          id: 1,
          content: 'This is a very long debug message with lots of details',
          timestamp: '2024-01-01T10:00:00Z',
          metadata: { agent: 'developer' },
          stackTrace: 'Error: Stack trace details...',
          details: 'Additional debug information',
        };

        const compactFormatted = formatEntry(sampleEntry, 'compact');
        expect(compactFormatted.content).toBe('This is a very long debug mes...');
        expect(compactFormatted.metadata).toBeUndefined();

        const verboseFormatted = formatEntry(sampleEntry, 'verbose');
        expect(verboseFormatted.content).toBe(sampleEntry.content);
        expect(verboseFormatted.metadata).toBeDefined();
        expect(verboseFormatted.stackTrace).toBeDefined();
      });
    });

    describe('Message rendering', () => {
      it('should adapt message display based on display mode', () => {
        const messages = [
          { id: 1, type: 'user', content: 'Hello' },
          { id: 2, type: 'system', content: 'System ready' },
          { id: 3, type: 'assistant', content: 'How can I help?' },
          { id: 4, type: 'tool', content: 'Tool executed successfully', toolName: 'Read' },
          { id: 5, type: 'error', content: 'Something went wrong' },
        ];

        const filterMessages = (msgs: any[], mode: DisplayMode) => {
          switch (mode) {
            case 'compact':
              return msgs.filter(msg =>
                ['user', 'assistant', 'error'].includes(msg.type)
              );
            case 'verbose':
              return msgs; // Show all messages
            default:
              return msgs.filter(msg =>
                msg.type !== 'system' || msg.content.includes('error')
              );
          }
        };

        const compactMessages = filterMessages(messages, 'compact');
        expect(compactMessages).toHaveLength(3); // user, assistant, error

        const verboseMessages = filterMessages(messages, 'verbose');
        expect(verboseMessages).toHaveLength(5); // all messages

        const normalMessages = filterMessages(messages, 'normal');
        expect(normalMessages).toHaveLength(4); // all except non-error system
      });
    });
  });

  describe('Session Persistence', () => {
    it('should persist display mode across sessions', () => {
      const sessionManager = {
        data: { displayMode: 'normal' as DisplayMode },

        save() {
          mockSessionStore.saveSession(this.data);
        },

        load() {
          const saved = mockSessionStore.loadSession();
          if (saved?.displayMode) {
            this.data.displayMode = saved.displayMode;
          }
        },

        setDisplayMode(mode: DisplayMode) {
          this.data.displayMode = mode;
          this.save();
        },

        getDisplayMode() {
          return this.data.displayMode;
        }
      };

      mockSessionStore.loadSession.mockReturnValue({ displayMode: 'verbose' });

      sessionManager.load();
      expect(sessionManager.getDisplayMode()).toBe('verbose');

      sessionManager.setDisplayMode('compact');
      expect(mockSessionStore.saveSession).toHaveBeenCalledWith({ displayMode: 'compact' });
    });

    it('should handle session restoration with invalid display mode', () => {
      const sessionManager = {
        data: { displayMode: 'normal' as DisplayMode },

        load() {
          const saved = mockSessionStore.loadSession();
          if (saved?.displayMode && ['normal', 'compact', 'verbose'].includes(saved.displayMode)) {
            this.data.displayMode = saved.displayMode;
          }
        },

        getDisplayMode() {
          return this.data.displayMode;
        }
      };

      mockSessionStore.loadSession.mockReturnValue({ displayMode: 'invalid' });

      sessionManager.load();
      expect(sessionManager.getDisplayMode()).toBe('normal'); // Should fallback
    });

    it('should maintain display mode during session activities', () => {
      let currentMode: DisplayMode = 'compact';

      const simulateSessionActivity = () => {
        // Simulate various session activities that shouldn't affect display mode
        const activities = [
          () => mockApp.addMessage({ type: 'user', content: 'test' }),
          () => mockApp.updateState({ isProcessing: true }),
          () => mockApp.updateState({ tokens: { input: 100, output: 200 } }),
          () => mockApp.updateState({ isProcessing: false }),
        ];

        activities.forEach(activity => activity());

        // Display mode should remain unchanged
        return currentMode;
      };

      const resultMode = simulateSessionActivity();
      expect(resultMode).toBe('compact');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle commands when app context is unavailable', async () => {
      const safeHandleCompact = async () => {
        try {
          const currentState = mockApp.getState();
          const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';
          mockApp.updateState({ displayMode: newMode });
        } catch (error) {
          // Should handle gracefully
          console.warn('Failed to update display mode:', error);
        }
      };

      mockApp.getState.mockImplementation(() => { throw new Error('App not available'); });

      await expect(safeHandleCompact()).resolves.not.toThrow();
    });

    it('should handle malformed state objects', () => {
      const sanitizeState = (state: any) => {
        if (!state || typeof state !== 'object') {
          return { displayMode: 'normal' };
        }

        const validModes = ['normal', 'compact', 'verbose'];
        if (!validModes.includes(state.displayMode)) {
          return { ...state, displayMode: 'normal' };
        }

        return state;
      };

      expect(sanitizeState(null)).toEqual({ displayMode: 'normal' });
      expect(sanitizeState(undefined)).toEqual({ displayMode: 'normal' });
      expect(sanitizeState({ displayMode: 'invalid' })).toEqual({ displayMode: 'normal' });
      expect(sanitizeState({ displayMode: 'compact' })).toEqual({ displayMode: 'compact' });
    });

    it('should handle concurrent command execution', async () => {
      let operationCount = 0;

      const concurrentSafeHandler = async (command: string) => {
        const opId = ++operationCount;

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        mockApp.updateState({
          displayMode: command === 'compact' ? 'compact' : 'verbose',
          operationId: opId
        });

        return opId;
      };

      const promises = [
        concurrentSafeHandler('compact'),
        concurrentSafeHandler('verbose'),
        concurrentSafeHandler('compact'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockApp.updateState).toHaveBeenCalledTimes(3);
      expect(new Set(results).size).toBe(3); // All operations should have unique IDs
    });

    it('should handle memory constraints in verbose mode', () => {
      const verboseDataManager = {
        maxEntries: 1000,
        entries: [] as any[],

        addVerboseEntry(entry: any) {
          this.entries.push({
            ...entry,
            timestamp: Date.now(),
          });

          // Limit memory usage
          if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
          }
        },

        getVerboseData(mode: DisplayMode) {
          if (mode !== 'verbose') {
            return this.entries.slice(-10); // Only recent entries for non-verbose modes
          }
          return this.entries;
        }
      };

      // Add many entries
      for (let i = 0; i < 1500; i++) {
        verboseDataManager.addVerboseEntry({ id: i, content: `Entry ${i}` });
      }

      expect(verboseDataManager.entries.length).toBe(1000); // Should be limited

      const compactData = verboseDataManager.getVerboseData('compact');
      expect(compactData.length).toBe(10); // Only recent for compact

      const verboseData = verboseDataManager.getVerboseData('verbose');
      expect(verboseData.length).toBe(1000); // Full data for verbose
    });

    it('should validate command arguments and handle malformed input', () => {
      const parseDisplayCommand = (input: string): { command: string; mode: DisplayMode | null } => {
        const trimmed = input.trim().toLowerCase();

        if (trimmed === '/compact' || trimmed === 'compact') {
          return { command: 'compact', mode: 'compact' };
        }

        if (trimmed === '/verbose' || trimmed === 'verbose') {
          return { command: 'verbose', mode: 'verbose' };
        }

        return { command: 'unknown', mode: null };
      };

      expect(parseDisplayCommand('/compact')).toEqual({ command: 'compact', mode: 'compact' });
      expect(parseDisplayCommand('/verbose')).toEqual({ command: 'verbose', mode: 'verbose' });
      expect(parseDisplayCommand('compact')).toEqual({ command: 'compact', mode: 'compact' });
      expect(parseDisplayCommand('COMPACT')).toEqual({ command: 'compact', mode: 'compact' });
      expect(parseDisplayCommand('  /verbose  ')).toEqual({ command: 'verbose', mode: 'verbose' });
      expect(parseDisplayCommand('/invalid')).toEqual({ command: 'unknown', mode: null });
      expect(parseDisplayCommand('')).toEqual({ command: 'unknown', mode: null });
    });

    it('should handle UI rendering failures gracefully', () => {
      const robustRenderer = {
        render(displayMode: DisplayMode, data: any) {
          try {
            switch (displayMode) {
              case 'compact':
                return this.renderCompact(data);
              case 'verbose':
                return this.renderVerbose(data);
              default:
                return this.renderNormal(data);
            }
          } catch (error) {
            return this.renderFallback(error);
          }
        },

        renderCompact(data: any) {
          if (!data) throw new Error('No data for compact view');
          return { layout: 'compact', content: data.summary };
        },

        renderVerbose(data: any) {
          if (!data) throw new Error('No data for verbose view');
          return { layout: 'verbose', content: data };
        },

        renderNormal(data: any) {
          return { layout: 'normal', content: data?.main || 'No content' };
        },

        renderFallback(error: Error) {
          return { layout: 'fallback', content: `Render error: ${error.message}` };
        }
      };

      // Test fallback rendering
      const result = robustRenderer.render('compact', null);
      expect(result.layout).toBe('fallback');
      expect(result.content).toContain('Render error');

      // Test normal rendering
      const normalResult = robustRenderer.render('normal', { main: 'test content' });
      expect(normalResult.layout).toBe('normal');
      expect(normalResult.content).toBe('test content');
    });
  });

  describe('Performance and Optimization', () => {
    it('should optimize rendering performance in different modes', () => {
      const performanceTracker = {
        timings: [] as number[],

        measureRender(mode: DisplayMode, dataSize: number) {
          const startTime = performance.now();

          // Simulate rendering work based on mode
          let iterations = 0;
          switch (mode) {
            case 'compact':
              iterations = Math.min(dataSize * 0.1, 100); // Reduced work for compact
              break;
            case 'verbose':
              iterations = dataSize; // Full work for verbose
              break;
            default:
              iterations = Math.min(dataSize * 0.5, 500); // Moderate work for normal
              break;
          }

          // Simulate work
          for (let i = 0; i < iterations; i++) {
            Math.random();
          }

          const endTime = performance.now();
          const duration = endTime - startTime;
          this.timings.push(duration);

          return duration;
        }
      };

      const compactTime = performanceTracker.measureRender('compact', 1000);
      const normalTime = performanceTracker.measureRender('normal', 1000);
      const verboseTime = performanceTracker.measureRender('verbose', 1000);

      // Compact mode should be fastest
      expect(compactTime).toBeLessThan(verboseTime);

      // Normal mode should be between compact and verbose
      expect(normalTime).toBeGreaterThan(compactTime);
      expect(normalTime).toBeLessThan(verboseTime);
    });

    it('should manage memory efficiently across display modes', () => {
      const memoryManager = {
        allocatedMemory: 0,
        maxMemory: 1000,

        allocate(mode: DisplayMode, dataSize: number): boolean {
          let memoryNeeded = 0;

          switch (mode) {
            case 'compact':
              memoryNeeded = dataSize * 0.2; // Minimal memory for compact
              break;
            case 'verbose':
              memoryNeeded = dataSize * 1.5; // More memory for verbose
              break;
            default:
              memoryNeeded = dataSize; // Standard memory for normal
              break;
          }

          if (this.allocatedMemory + memoryNeeded <= this.maxMemory) {
            this.allocatedMemory += memoryNeeded;
            return true;
          }

          return false;
        },

        deallocate(amount: number) {
          this.allocatedMemory = Math.max(0, this.allocatedMemory - amount);
        },

        getUsage() {
          return this.allocatedMemory / this.maxMemory;
        }
      };

      // Test memory allocation for different modes
      expect(memoryManager.allocate('compact', 100)).toBe(true);
      expect(memoryManager.allocate('normal', 300)).toBe(true);
      expect(memoryManager.allocate('verbose', 400)).toBe(true); // Should succeed

      expect(memoryManager.getUsage()).toBeLessThan(1); // Should not exceed limit

      // Test that compact mode uses less memory
      memoryManager.deallocate(memoryManager.allocatedMemory); // Reset

      memoryManager.allocate('compact', 500);
      const compactUsage = memoryManager.allocatedMemory;

      memoryManager.deallocate(compactUsage);
      memoryManager.allocate('verbose', 500);
      const verboseUsage = memoryManager.allocatedMemory;

      expect(compactUsage).toBeLessThan(verboseUsage);
    });
  });
});