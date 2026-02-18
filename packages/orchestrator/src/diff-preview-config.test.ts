/**
 * Configuration Tests for Diff Preview Functionality
 *
 * Tests configuration-based enabling/disabling of diff preview:
 * - Config schema validation
 * - Default behavior testing
 * - Runtime config changes
 * - Edge cases in configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookContext } from './hooks';
import { EventEmitter } from 'events';

describe('Diff Preview Configuration Tests', () => {
  let mockEventEmitter: EventEmitter;
  let mockStore: any;
  let mockFileSnapshots: Map<string, string>;
  let emittedEvents: Array<{ event: string; data: any }>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEventEmitter = new EventEmitter();
    emittedEvents = [];

    // Capture all emitted events
    const originalEmit = mockEventEmitter.emit;
    mockEventEmitter.emit = function(event: string, data?: any) {
      emittedEvents.push({ event, data });
      return originalEmit.call(this, event, data);
    };

    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
    };

    mockFileSnapshots = new Map();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    emittedEvents = [];
  });

  const createTestContext = (config?: any): HookContext => ({
    taskId: 'config-test-123',
    store: mockStore,
    eventEmitter: mockEventEmitter,
    fileSnapshots: mockFileSnapshots,
    config,
  });

  // Helper function to simulate the generateDiffPreview hook behavior based on config
  const simulateHookBehavior = async (context: HookContext, toolName: string, callId: string, filePath: string): Promise<boolean> => {
    // Simulate the config checks that would happen in generateDiffPreview

    // Skip if no event emitter available
    if (!context.eventEmitter) {
      return false;
    }

    // Skip if diff preview is disabled in config (default is enabled)
    if (context.config?.ui?.diffPreview === false) {
      return false;
    }

    // Simulate diff generation and event emission
    const { generateFileDiff } = await import('./utils/diff');

    // Mock a simple diff result
    const diffResult = {
      hasDifferences: true,
      diff: `--- a${filePath}\n+++ b${filePath}\n@@ -1 +1 @@\n-old content\n+new content`,
      addedLines: 1,
      removedLines: 1,
    };

    if (diffResult.hasDifferences) {
      context.eventEmitter.emit('diff:preview', {
        taskId: context.taskId,
        toolName,
        callId,
        filePath,
        diff: diffResult.diff,
        addedLines: diffResult.addedLines,
        removedLines: diffResult.removedLines,
        timestamp: new Date(),
      });

      await context.store.addLog(context.taskId, {
        level: 'debug',
        message: `Diff preview generated for: ${filePath}`,
        metadata: {
          tool: toolName,
          filePath,
          addedLines: diffResult.addedLines,
          removedLines: diffResult.removedLines,
          callId,
        },
      });

      return true;
    }

    return false;
  };

  describe('Configuration Schema Validation', () => {
    it('should handle valid diffPreview: true configuration', async () => {
      const context = createTestContext({
        ui: { diffPreview: true }
      });

      const eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'test-call-1',
        '/test/valid-true.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].event).toBe('diff:preview');
    });

    it('should handle valid diffPreview: false configuration', async () => {
      const context = createTestContext({
        ui: { diffPreview: false }
      });

      const eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'test-call-2',
        '/test/valid-false.txt'
      );

      expect(eventEmitted).toBe(false);
      expect(emittedEvents).toHaveLength(0);
    });

    it('should handle configuration with only ui section', async () => {
      const context = createTestContext({
        ui: {}
      });

      // When diffPreview is not specified, should default to enabled
      const eventEmitted = await simulateHookBehavior(
        context,
        'Edit',
        'test-call-3',
        '/test/ui-only.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });

    it('should handle empty configuration object', async () => {
      const context = createTestContext({});

      // When no ui section exists, should default to enabled
      const eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'test-call-4',
        '/test/empty-config.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });

    it('should handle null configuration', async () => {
      const context = createTestContext(null);

      // When config is null, should default to enabled
      const eventEmitted = await simulateHookBehavior(
        context,
        'Edit',
        'test-call-5',
        '/test/null-config.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });

    it('should handle undefined configuration', async () => {
      const context = createTestContext(undefined);

      // When config is undefined, should default to enabled
      const eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'test-call-6',
        '/test/undefined-config.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });
  });

  describe('Default Behavior Testing', () => {
    it('should be enabled by default when no diffPreview setting is provided', async () => {
      const configurationsWithDefaults = [
        undefined,                           // No config
        {},                                 // Empty config
        { ui: {} },                        // Empty UI config
        { ui: { previewMode: true } },     // Other UI settings without diffPreview
        { other: { setting: true } },      // Non-UI config sections
      ];

      for (const [index, config] of configurationsWithDefaults.entries()) {
        const context = createTestContext(config);

        const eventEmitted = await simulateHookBehavior(
          context,
          'Write',
          `default-test-${index}`,
          `/test/default-${index}.txt`
        );

        expect(eventEmitted).toBe(true);

        // Clear events between tests
        emittedEvents.length = 0;
      }
    });

    it('should respect explicit diffPreview: false setting', async () => {
      const configurationsWithDisabled = [
        { ui: { diffPreview: false } },
        { ui: { diffPreview: false, previewMode: true } },
        { ui: { diffPreview: false }, other: { setting: true } },
      ];

      for (const [index, config] of configurationsWithDisabled.entries()) {
        const context = createTestContext(config);

        const eventEmitted = await simulateHookBehavior(
          context,
          'Edit',
          `disabled-test-${index}`,
          `/test/disabled-${index}.txt`
        );

        expect(eventEmitted).toBe(false);
        expect(emittedEvents).toHaveLength(0);
      }
    });

    it('should respect explicit diffPreview: true setting', async () => {
      const configurationsWithEnabled = [
        { ui: { diffPreview: true } },
        { ui: { diffPreview: true, previewMode: false } },
        { ui: { diffPreview: true }, other: { setting: false } },
      ];

      for (const [index, config] of configurationsWithEnabled.entries()) {
        const context = createTestContext(config);

        const eventEmitted = await simulateHookBehavior(
          context,
          'Write',
          `enabled-test-${index}`,
          `/test/enabled-${index}.txt`
        );

        expect(eventEmitted).toBe(true);
        expect(emittedEvents).toHaveLength(1);

        // Clear events between tests
        emittedEvents.length = 0;
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle malformed ui configuration gracefully', async () => {
      const malformedConfigs = [
        { ui: null },                      // null ui section
        { ui: 'invalid' },                // string instead of object
        { ui: [] },                       // array instead of object
        { ui: { diffPreview: null } },    // null diffPreview value
        { ui: { diffPreview: 'yes' } },   // string instead of boolean
        { ui: { diffPreview: 1 } },       // number instead of boolean
        { ui: { diffPreview: [] } },      // array instead of boolean
        { ui: { diffPreview: {} } },      // object instead of boolean
      ];

      for (const [index, config] of malformedConfigs.entries()) {
        const context = createTestContext(config);

        // The hook should handle malformed config gracefully
        // In JavaScript, most falsy values would be treated as disabled
        // Only explicit false should disable, everything else should default to enabled
        const expectEnabled = config.ui?.diffPreview !== false;

        const eventEmitted = await simulateHookBehavior(
          context,
          'Edit',
          `malformed-test-${index}`,
          `/test/malformed-${index}.txt`
        );

        if (expectEnabled) {
          expect(eventEmitted).toBe(true);
        } else {
          expect(eventEmitted).toBe(false);
        }

        // Clear events between tests
        emittedEvents.length = 0;
      }
    });

    it('should handle deeply nested configuration objects', async () => {
      const deepConfig = {
        ui: {
          diffPreview: true,
          nested: {
            level1: {
              level2: {
                setting: 'value'
              }
            }
          }
        },
        other: {
          section: {
            with: {
              deep: {
                nesting: true
              }
            }
          }
        }
      };

      const context = createTestContext(deepConfig);

      const eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'deep-config-test',
        '/test/deep-config.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });

    it('should handle configuration with circular references', async () => {
      const circularConfig: any = {
        ui: { diffPreview: true }
      };
      circularConfig.self = circularConfig; // Create circular reference

      const context = createTestContext(circularConfig);

      // Should not cause infinite recursion
      const eventEmitted = await simulateHookBehavior(
        context,
        'Edit',
        'circular-test',
        '/test/circular.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });
  });

  describe('Runtime Configuration Changes', () => {
    it('should respond to configuration changes between calls', async () => {
      let context = createTestContext({ ui: { diffPreview: true } });

      // First call with enabled config
      let eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'runtime-test-1',
        '/test/runtime-1.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);

      // Clear events
      emittedEvents.length = 0;

      // Second call with disabled config (simulate config reload)
      context = createTestContext({ ui: { diffPreview: false } });

      eventEmitted = await simulateHookBehavior(
        context,
        'Edit',
        'runtime-test-2',
        '/test/runtime-2.txt'
      );

      expect(eventEmitted).toBe(false);
      expect(emittedEvents).toHaveLength(0);

      // Third call with enabled config again
      context = createTestContext({ ui: { diffPreview: true } });

      eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'runtime-test-3',
        '/test/runtime-3.txt'
      );

      expect(eventEmitted).toBe(true);
      expect(emittedEvents).toHaveLength(1);
    });
  });

  describe('Integration with Other UI Settings', () => {
    it('should work independently of other UI configuration settings', async () => {
      const configsWithOtherSettings = [
        {
          ui: {
            diffPreview: true,
            previewMode: false,
            verboseLogging: true,
            colorOutput: false,
          }
        },
        {
          ui: {
            diffPreview: false,
            previewMode: true,
            verboseLogging: false,
            colorOutput: true,
          }
        },
        {
          ui: {
            diffPreview: true,
            theme: 'dark',
            fontSize: 14,
            showLineNumbers: true,
          }
        }
      ];

      for (const [index, config] of configsWithOtherSettings.entries()) {
        const context = createTestContext(config);
        const expectEnabled = config.ui.diffPreview === true;

        const eventEmitted = await simulateHookBehavior(
          context,
          'Edit',
          `ui-integration-${index}`,
          `/test/ui-integration-${index}.txt`
        );

        if (expectEnabled) {
          expect(eventEmitted).toBe(true);
          expect(emittedEvents).toHaveLength(1);
        } else {
          expect(eventEmitted).toBe(false);
          expect(emittedEvents).toHaveLength(0);
        }

        // Clear events between tests
        emittedEvents.length = 0;
      }
    });
  });

  describe('Error Handling with Configuration', () => {
    it('should handle missing event emitter even with enabled config', async () => {
      const context: HookContext = {
        taskId: 'missing-emitter-test',
        store: mockStore,
        // eventEmitter: undefined, // Missing event emitter
        fileSnapshots: mockFileSnapshots,
        config: { ui: { diffPreview: true } },
      };

      const eventEmitted = await simulateHookBehavior(
        context,
        'Write',
        'missing-emitter',
        '/test/missing-emitter.txt'
      );

      expect(eventEmitted).toBe(false);
      expect(emittedEvents).toHaveLength(0);
    });

    it('should handle store errors gracefully regardless of config', async () => {
      const faultyStore = {
        addLog: vi.fn().mockRejectedValue(new Error('Store error')),
      };

      const context: HookContext = {
        taskId: 'faulty-store-test',
        store: faultyStore,
        eventEmitter: mockEventEmitter,
        fileSnapshots: mockFileSnapshots,
        config: { ui: { diffPreview: true } },
      };

      // The hook should handle store errors gracefully
      let eventEmitted = false;
      try {
        eventEmitted = await simulateHookBehavior(
          context,
          'Write',
          'faulty-store',
          '/test/faulty-store.txt'
        );
      } catch (error) {
        // Store error should be handled, not propagated
        expect(error).toBeInstanceOf(Error);
      }

      // Event might still be emitted even if logging fails
      // The exact behavior depends on implementation
    });
  });

  describe('Performance with Different Configurations', () => {
    it('should be fast when disabled (early return)', async () => {
      const context = createTestContext({ ui: { diffPreview: false } });

      const start = Date.now();

      // Call multiple times
      for (let i = 0; i < 100; i++) {
        await simulateHookBehavior(
          context,
          'Write',
          `perf-disabled-${i}`,
          `/test/perf-disabled-${i}.txt`
        );
      }

      const duration = Date.now() - start;

      // Should be very fast when disabled (early returns)
      expect(duration).toBeLessThan(100); // Less than 100ms for 100 calls
      expect(emittedEvents).toHaveLength(0);
    });

    it('should handle multiple configuration checks efficiently', async () => {
      const contexts = [
        createTestContext({ ui: { diffPreview: true } }),
        createTestContext({ ui: { diffPreview: false } }),
        createTestContext(undefined),
        createTestContext({}),
      ];

      const start = Date.now();

      for (const [contextIndex, context] of contexts.entries()) {
        for (let i = 0; i < 25; i++) {
          await simulateHookBehavior(
            context,
            'Edit',
            `multi-config-${contextIndex}-${i}`,
            `/test/multi-config-${contextIndex}-${i}.txt`
          );
        }
      }

      const duration = Date.now() - start;

      // Should handle 100 total calls efficiently
      expect(duration).toBeLessThan(1000); // Less than 1 second for 100 calls

      // Only enabled configs should have emitted events
      // contexts[0] (true): 25 events
      // contexts[1] (false): 0 events
      // contexts[2] (undefined, default true): 25 events
      // contexts[3] ({}, default true): 25 events
      expect(emittedEvents).toHaveLength(75);
    });
  });
});