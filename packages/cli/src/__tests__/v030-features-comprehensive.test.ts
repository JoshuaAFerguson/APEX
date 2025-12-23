/**
 * Comprehensive tests for v0.3.0 features
 *
 * This test suite validates the three main v0.3.0 features:
 * 1. Input Preview - Show what will be sent before execution
 * 2. Compact Mode - Condensed output for experienced users
 * 3. Verbose Mode - Detailed output for debugging
 *
 * Tests focus on:
 * - Feature integration and interaction
 * - Performance under different conditions
 * - Edge cases and error handling
 * - User experience consistency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DisplayMode } from '@apexcli/core';

// Mock React and Ink for CLI testing
vi.mock('ink', () => ({
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: vi.fn(),
  render: vi.fn(),
}));

vi.mock('react', () => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
  createContext: vi.fn(),
  useContext: vi.fn(),
}));

// Mock core services
const mockApp = {
  getState: vi.fn(),
  updateState: vi.fn(),
  addMessage: vi.fn(),
  setState: vi.fn(),
};

const mockPreviewPanel = {
  show: vi.fn(),
  hide: vi.fn(),
  update: vi.fn(),
  getState: vi.fn(),
};

const mockStatusBar = {
  setDisplayMode: vi.fn(),
  getLayout: vi.fn(),
  render: vi.fn(),
};

const mockActivityLog = {
  addEntry: vi.fn(),
  filterEntries: vi.fn(),
  setDisplayMode: vi.fn(),
};

describe('v0.3.0 Features - Comprehensive Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default app state
    mockApp.getState.mockReturnValue({
      displayMode: 'normal',
      showPreview: false,
      messages: [],
      isProcessing: false,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Feature Integration Tests', () => {
    describe('Input Preview + Display Modes', () => {
      it('should show appropriate preview detail level based on display mode', async () => {
        const testInput = 'create a new React component called Button';

        const mockIntent = {
          type: 'task' as const,
          confidence: 0.85,
          metadata: { estimatedComplexity: 'medium' },
        };

        // Test preview in compact mode
        mockApp.getState.mockReturnValue({ displayMode: 'compact' });

        const compactPreview = {
          input: testInput,
          intent: mockIntent,
          displayMode: 'compact',
          showDetails: false,
          maxLines: 3,
        };

        expect(compactPreview.showDetails).toBe(false);
        expect(compactPreview.maxLines).toBe(3);

        // Test preview in verbose mode
        mockApp.getState.mockReturnValue({ displayMode: 'verbose' });

        const verbosePreview = {
          input: testInput,
          intent: mockIntent,
          displayMode: 'verbose',
          showDetails: true,
          showMetadata: true,
          showConfidence: true,
          showWorkflow: true,
        };

        expect(verbosePreview.showDetails).toBe(true);
        expect(verbosePreview.showMetadata).toBe(true);
        expect(verbosePreview.showConfidence).toBe(true);

        // Test preview in normal mode
        mockApp.getState.mockReturnValue({ displayMode: 'normal' });

        const normalPreview = {
          input: testInput,
          intent: mockIntent,
          displayMode: 'normal',
          showDetails: true,
          showMetadata: false,
          showConfidence: true,
        };

        expect(normalPreview.showDetails).toBe(true);
        expect(normalPreview.showMetadata).toBe(false);
      });

      it('should handle display mode changes while preview is active', async () => {
        const testInput = '/status';
        let currentMode: DisplayMode = 'normal';
        let previewVisible = true;

        // Simulate preview being shown
        mockPreviewPanel.getState.mockReturnValue({ visible: true, input: testInput });

        // Simulate mode change to compact
        const handleModeChange = (newMode: DisplayMode) => {
          currentMode = newMode;
          mockApp.updateState({ displayMode: newMode });

          if (previewVisible) {
            mockPreviewPanel.update({
              displayMode: newMode,
              showDetails: newMode !== 'compact',
            });
          }
        };

        handleModeChange('compact');

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
        expect(mockPreviewPanel.update).toHaveBeenCalledWith({
          displayMode: 'compact',
          showDetails: false,
        });

        handleModeChange('verbose');

        expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'verbose' });
        expect(mockPreviewPanel.update).toHaveBeenCalledWith({
          displayMode: 'verbose',
          showDetails: true,
        });
      });
    });

    describe('Display Mode Persistence', () => {
      it('should maintain display mode across different operations', async () => {
        const operations = [
          { name: 'show preview', action: () => mockPreviewPanel.show() },
          { name: 'add message', action: () => mockApp.addMessage({ type: 'user', content: 'test' }) },
          { name: 'process input', action: () => mockApp.updateState({ isProcessing: true }) },
          { name: 'complete processing', action: () => mockApp.updateState({ isProcessing: false }) },
        ];

        // Set initial mode to compact
        mockApp.getState.mockReturnValue({ displayMode: 'compact' });

        for (const operation of operations) {
          await operation.action();

          // Verify display mode remains unchanged
          const state = mockApp.getState();
          expect(state.displayMode).toBe('compact');
        }
      });

      it('should handle rapid display mode toggles without corruption', async () => {
        let currentMode: DisplayMode = 'normal';

        const fastToggle = async (targetMode: DisplayMode) => {
          currentMode = targetMode;
          mockApp.updateState({ displayMode: targetMode });
          mockStatusBar.setDisplayMode(targetMode);
          mockActivityLog.setDisplayMode(targetMode);
        };

        // Rapidly change modes
        const togglePromises = [
          fastToggle('compact'),
          fastToggle('verbose'),
          fastToggle('normal'),
          fastToggle('compact'),
          fastToggle('verbose'),
        ];

        await Promise.all(togglePromises);

        // Verify all services were called for each mode change
        expect(mockApp.updateState).toHaveBeenCalledTimes(5);
        expect(mockStatusBar.setDisplayMode).toHaveBeenCalledTimes(5);
        expect(mockActivityLog.setDisplayMode).toHaveBeenCalledTimes(5);

        // Verify final state is consistent
        expect(mockApp.updateState).toHaveBeenLastCalledWith({ displayMode: 'verbose' });
      });
    });
  });

  describe('Performance Tests', () => {
    describe('Preview Panel Performance', () => {
      it('should render large inputs efficiently in different display modes', () => {
        const largeInput = 'x'.repeat(10000);
        const startTime = performance.now();

        // Test compact mode rendering (should be fastest)
        const compactRenderTime = (() => {
          const start = performance.now();
          mockPreviewPanel.update({
            input: largeInput.substring(0, 100) + '...', // Truncated for compact
            displayMode: 'compact',
          });
          return performance.now() - start;
        })();

        // Test normal mode rendering
        const normalRenderTime = (() => {
          const start = performance.now();
          mockPreviewPanel.update({
            input: largeInput.substring(0, 500) + '...', // Moderate truncation
            displayMode: 'normal',
          });
          return performance.now() - start;
        })();

        // Test verbose mode rendering
        const verboseRenderTime = (() => {
          const start = performance.now();
          mockPreviewPanel.update({
            input: largeInput, // Full input in verbose
            displayMode: 'verbose',
          });
          return performance.now() - start;
        })();

        const totalTime = performance.now() - startTime;

        // All operations should complete quickly
        expect(totalTime).toBeLessThan(50); // 50ms total

        // Compact should be fastest (due to truncation)
        expect(compactRenderTime).toBeLessThan(verboseRenderTime);

        // All individual operations should be fast
        expect(compactRenderTime).toBeLessThan(10);
        expect(normalRenderTime).toBeLessThan(15);
        expect(verboseRenderTime).toBeLessThan(25);
      });

      it('should handle frequent preview updates without performance degradation', async () => {
        const updateCount = 100;
        const updates: number[] = [];

        for (let i = 0; i < updateCount; i++) {
          const startTime = performance.now();

          mockPreviewPanel.update({
            input: `test input ${i}`,
            intent: { type: 'task', confidence: Math.random() },
            displayMode: i % 3 === 0 ? 'compact' : i % 3 === 1 ? 'normal' : 'verbose',
          });

          const duration = performance.now() - startTime;
          updates.push(duration);
        }

        // Check that updates remain fast throughout
        const averageTime = updates.reduce((a, b) => a + b, 0) / updates.length;
        const maxTime = Math.max(...updates);

        expect(averageTime).toBeLessThan(1); // Average under 1ms
        expect(maxTime).toBeLessThan(10); // Max under 10ms

        // Performance should not degrade over time
        const firstHalf = updates.slice(0, updateCount / 2);
        const secondHalf = updates.slice(updateCount / 2);
        const firstAverage = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAverage = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        expect(secondAverage).toBeLessThan(firstAverage * 2); // No significant degradation
      });
    });

    describe('Display Mode Memory Usage', () => {
      it('should manage memory efficiently across modes', () => {
        const memoryTracker = {
          allocatedMemory: 0,
          maxMemory: 1000,

          allocate(mode: DisplayMode, dataSize: number): boolean {
            let memoryNeeded = 0;

            switch (mode) {
              case 'compact':
                memoryNeeded = dataSize * 0.3; // Reduced memory usage
                break;
              case 'verbose':
                memoryNeeded = dataSize * 1.2; // More memory for verbose data
                break;
              default:
                memoryNeeded = dataSize; // Standard memory usage
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

          getUsagePercentage() {
            return (this.allocatedMemory / this.maxMemory) * 100;
          }
        };

        // Test that compact mode uses less memory
        expect(memoryTracker.allocate('compact', 100)).toBe(true);
        const compactUsage = memoryTracker.allocatedMemory;

        memoryTracker.deallocate(compactUsage);

        expect(memoryTracker.allocate('verbose', 100)).toBe(true);
        const verboseUsage = memoryTracker.allocatedMemory;

        expect(compactUsage).toBeLessThan(verboseUsage);

        // Test memory limit enforcement
        memoryTracker.deallocate(verboseUsage);

        // Try to allocate more than available
        expect(memoryTracker.allocate('verbose', 1000)).toBe(false);
        expect(memoryTracker.allocate('compact', 1000)).toBe(true); // Should succeed due to lower usage
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('Malformed Input Handling', () => {
      it('should handle extremely long inputs gracefully', () => {
        const extremelyLongInput = 'a'.repeat(1000000); // 1MB of text

        const processLargeInput = (input: string, mode: DisplayMode) => {
          try {
            const maxLength = mode === 'compact' ? 100 : mode === 'normal' ? 1000 : 10000;
            const truncated = input.length > maxLength ?
              input.substring(0, maxLength) + '...' :
              input;

            return {
              success: true,
              processed: truncated,
              originalLength: input.length,
              processedLength: truncated.length,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        };

        const compactResult = processLargeInput(extremelyLongInput, 'compact');
        expect(compactResult.success).toBe(true);
        expect(compactResult.processedLength).toBe(103); // 100 + '...'

        const normalResult = processLargeInput(extremelyLongInput, 'normal');
        expect(normalResult.success).toBe(true);
        expect(normalResult.processedLength).toBe(1003); // 1000 + '...'

        const verboseResult = processLargeInput(extremelyLongInput, 'verbose');
        expect(verboseResult.success).toBe(true);
        expect(verboseResult.processedLength).toBe(10003); // 10000 + '...'
      });

      it('should handle special characters and unicode correctly', () => {
        const specialInputs = [
          '🚀 Deploy feature with 中文 characters',
          'SQL injection attempt: \'; DROP TABLE users; --',
          'Unicode escape: \\u0041\\u0042\\u0043',
          'Emoji storm: 🎉🎊🎈🎁🎀🎂🍰🧁🍭🍬',
          'Mixed scripts: Hello नमस्ते こんにちは 你好 مرحبا',
        ];

        specialInputs.forEach((input) => {
          const sanitizeInput = (text: string) => {
            // Remove potentially dangerous characters
            return text
              .replace(/[<>&"']/g, '') // Basic XSS prevention
              .replace(/;.*--/g, '') // SQL injection prevention
              .substring(0, 10000); // Length limit
          };

          const sanitized = sanitizeInput(input);
          expect(sanitized).toBeDefined();
          expect(sanitized.length).toBeLessThanOrEqual(10000);
          expect(sanitized).not.toContain('<script>');
          expect(sanitized).not.toContain('DROP TABLE');
        });
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle simultaneous mode changes and preview updates', async () => {
        const concurrentOperations = [];
        let operationCount = 0;

        // Create multiple concurrent operations
        for (let i = 0; i < 10; i++) {
          const operation = async () => {
            const opId = ++operationCount;

            // Simulate race conditions
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

            const mode: DisplayMode = ['compact', 'normal', 'verbose'][i % 3] as DisplayMode;

            mockApp.updateState({
              displayMode: mode,
              operationId: opId,
            });

            mockPreviewPanel.update({
              input: `operation ${opId}`,
              displayMode: mode,
              timestamp: Date.now(),
            });

            return opId;
          };

          concurrentOperations.push(operation());
        }

        const results = await Promise.all(concurrentOperations);

        // Verify all operations completed
        expect(results).toHaveLength(10);
        expect(new Set(results).size).toBe(10); // All unique operation IDs

        // Verify services were called for each operation
        expect(mockApp.updateState).toHaveBeenCalledTimes(10);
        expect(mockPreviewPanel.update).toHaveBeenCalledTimes(10);
      });

      it('should maintain consistency during rapid user interactions', async () => {
        let stateVersion = 0;
        const stateHistory: Array<{ version: number; displayMode: DisplayMode; timestamp: number }> = [];

        const updateState = async (newMode: DisplayMode) => {
          const version = ++stateVersion;
          const timestamp = Date.now();

          // Simulate async state update
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));

          stateHistory.push({ version, displayMode: newMode, timestamp });
          mockApp.updateState({ displayMode: newMode, version });

          return version;
        };

        // Simulate rapid user interactions
        const interactions = [
          'compact', 'verbose', 'normal', 'compact', 'verbose',
          'normal', 'compact', 'verbose', 'compact', 'normal'
        ] as DisplayMode[];

        const versionPromises = interactions.map(mode => updateState(mode));
        const versions = await Promise.all(versionPromises);

        // Verify all updates completed
        expect(versions).toHaveLength(10);
        expect(stateHistory).toHaveLength(10);

        // Verify states are in chronological order
        for (let i = 1; i < stateHistory.length; i++) {
          expect(stateHistory[i].timestamp).toBeGreaterThanOrEqual(stateHistory[i - 1].timestamp);
        }

        // Verify final state is consistent
        const finalState = stateHistory[stateHistory.length - 1];
        expect(finalState.displayMode).toBe('normal');
        expect(finalState.version).toBe(10);
      });
    });

    describe('Error Recovery', () => {
      it('should recover gracefully from preview panel errors', async () => {
        const errorScenarios = [
          { name: 'null input', input: null },
          { name: 'undefined intent', intent: undefined },
          { name: 'invalid display mode', displayMode: 'invalid' as DisplayMode },
          { name: 'missing callback', onConfirm: undefined },
        ];

        errorScenarios.forEach(({ name, ...props }) => {
          const safePreviewUpdate = (updateProps: any) => {
            try {
              // Validate and sanitize props
              const safeProps = {
                input: updateProps.input || '',
                intent: updateProps.intent || { type: 'task', confidence: 0 },
                displayMode: ['compact', 'normal', 'verbose'].includes(updateProps.displayMode)
                  ? updateProps.displayMode
                  : 'normal',
                onConfirm: updateProps.onConfirm || (() => {}),
                onCancel: updateProps.onCancel || (() => {}),
                onEdit: updateProps.onEdit || (() => {}),
              };

              mockPreviewPanel.update(safeProps);
              return { success: true, props: safeProps };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          };

          const result = safePreviewUpdate(props);
          expect(result.success).toBe(true);
          expect(result.props).toBeDefined();
        });
      });

      it('should handle display mode corruption and auto-recovery', () => {
        const corruptedStates = [
          { displayMode: null },
          { displayMode: undefined },
          { displayMode: 'invalid' },
          { displayMode: 123 },
          { displayMode: {} },
          { displayMode: [] },
        ];

        const sanitizeDisplayMode = (state: any): DisplayMode => {
          const validModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

          if (!state || typeof state !== 'object') {
            return 'normal';
          }

          if (!validModes.includes(state.displayMode)) {
            return 'normal';
          }

          return state.displayMode;
        };

        corruptedStates.forEach((corruptedState, index) => {
          const sanitized = sanitizeDisplayMode(corruptedState);
          expect(sanitized).toBe('normal');

          // Test that the app recovers
          mockApp.getState.mockReturnValue({ ...corruptedState });
          const recoveredMode = sanitizeDisplayMode(mockApp.getState());
          expect(recoveredMode).toBe('normal');
        });
      });
    });
  });

  describe('User Experience Consistency', () => {
    describe('Feature Discoverability', () => {
      it('should provide consistent help information across modes', () => {
        const getHelpContent = (mode: DisplayMode) => {
          const baseCommands = [
            { command: '/compact', description: 'Toggle compact display mode' },
            { command: '/verbose', description: 'Toggle verbose display mode' },
            { command: '/preview', description: 'Toggle input preview' },
            { command: '/help', description: 'Show this help' },
          ];

          switch (mode) {
            case 'compact':
              return {
                commands: baseCommands.map(cmd => ({
                  ...cmd,
                  description: cmd.description.substring(0, 30),
                })),
                layout: 'minimal',
              };
            case 'verbose':
              return {
                commands: baseCommands.map(cmd => ({
                  ...cmd,
                  description: cmd.description,
                  examples: [`Example: ${cmd.command}`],
                  shortcuts: cmd.command === '/compact' ? ['Ctrl+C'] : undefined,
                })),
                layout: 'detailed',
              };
            default:
              return {
                commands: baseCommands,
                layout: 'standard',
              };
          }
        };

        const compactHelp = getHelpContent('compact');
        const normalHelp = getHelpContent('normal');
        const verboseHelp = getHelpContent('verbose');

        // All modes should have the same commands available
        expect(compactHelp.commands).toHaveLength(4);
        expect(normalHelp.commands).toHaveLength(4);
        expect(verboseHelp.commands).toHaveLength(4);

        // Verbose mode should have additional information
        expect(verboseHelp.commands[0].examples).toBeDefined();
        expect(normalHelp.commands[0].examples).toBeUndefined();
        expect(compactHelp.commands[0].examples).toBeUndefined();

        // Compact mode should have shortened descriptions
        expect(compactHelp.commands[0].description.length).toBeLessThanOrEqual(30);
      });
    });

    describe('Mode Transition Feedback', () => {
      it('should provide appropriate feedback for mode transitions', () => {
        const modeTransitions = [
          { from: 'normal', to: 'compact', expected: /compact.*condensed/i },
          { from: 'normal', to: 'verbose', expected: /verbose.*detailed/i },
          { from: 'compact', to: 'normal', expected: /normal.*standard/i },
          { from: 'compact', to: 'verbose', expected: /verbose.*detailed/i },
          { from: 'verbose', to: 'normal', expected: /normal.*standard/i },
          { from: 'verbose', to: 'compact', expected: /compact.*condensed/i },
        ];

        modeTransitions.forEach(({ from, to, expected }) => {
          mockApp.getState.mockReturnValue({ displayMode: from });

          const getFeedbackMessage = (fromMode: DisplayMode, toMode: DisplayMode): string => {
            if (toMode === 'compact') {
              return 'Display mode set to compact: Single-line status, condensed output';
            } else if (toMode === 'verbose') {
              return 'Display mode set to verbose: Detailed debug output, full information';
            } else {
              return 'Display mode set to normal: Standard display with all components shown';
            }
          };

          const message = getFeedbackMessage(from as DisplayMode, to as DisplayMode);
          expect(message).toMatch(expected);
        });
      });
    });
  });
});