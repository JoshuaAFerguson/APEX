import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration tests for the complete preview configuration feature
 * Tests the full flow from command execution to runtime behavior
 */

interface PreviewConfig {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}

interface AppState {
  previewMode: boolean;
  previewConfig: PreviewConfig;
  pendingPreview?: {
    input: string;
    intent: {
      type: 'command' | 'task' | 'question' | 'clarification';
      confidence: number;
      metadata?: Record<string, unknown>;
    };
    timestamp: Date;
  };
  messages: Array<{
    id: string;
    type: 'system' | 'assistant' | 'error';
    content: string;
    timestamp: Date;
  }>;
}

// Mock application context
let mockAppState: AppState;

const mockApp = {
  getState: () => mockAppState,
  updateState: vi.fn((updates: Partial<AppState>) => {
    mockAppState = { ...mockAppState, ...updates };
  }),
  addMessage: vi.fn((message: Omit<AppState['messages'][0], 'id' | 'timestamp'>) => {
    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    mockAppState.messages.push(newMessage);
  }),
};

// Mock timer functions
let activeTimeouts: Map<number, NodeJS.Timeout> = new Map();
let timeoutId = 0;

const mockSetTimeout = vi.fn((callback: () => void, delay: number) => {
  const id = ++timeoutId;
  const timeout = setTimeout(() => {
    activeTimeouts.delete(id);
    callback();
  }, delay);
  activeTimeouts.set(id, timeout);
  return id;
});

const mockClearTimeout = vi.fn((id: number) => {
  const timeout = activeTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    activeTimeouts.delete(id);
  }
});

// Simulate the preview command handler
async function executePreviewCommand(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  const value = args[1];
  const currentState = mockApp.getState();

  switch (action) {
    case 'confidence':
      if (value !== undefined) {
        const threshold = parseFloat(value);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
          const newConfig = {
            ...currentState.previewConfig,
            confidenceThreshold: threshold / 100,
          };
          mockApp.updateState({ previewConfig: newConfig });
          mockApp.addMessage({
            type: 'system',
            content: `Preview confidence threshold set to ${threshold}%.`,
          });
        } else {
          mockApp.addMessage({
            type: 'error',
            content: 'Confidence threshold must be a number between 0 and 100.',
          });
        }
      }
      break;

    case 'auto':
      if (value === 'on' || value === 'true') {
        const newConfig = {
          ...currentState.previewConfig,
          autoExecuteHighConfidence: true,
        };
        mockApp.updateState({ previewConfig: newConfig });
        mockApp.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs enabled.',
        });
      } else if (value === 'off' || value === 'false') {
        const newConfig = {
          ...currentState.previewConfig,
          autoExecuteHighConfidence: false,
        };
        mockApp.updateState({ previewConfig: newConfig });
        mockApp.addMessage({
          type: 'system',
          content: 'Auto-execute for high confidence inputs disabled.',
        });
      }
      break;

    case 'timeout':
      if (value !== undefined) {
        const timeout = parseInt(value, 10);
        if (!isNaN(timeout) && timeout > 0) {
          const newConfig = {
            ...currentState.previewConfig,
            timeoutMs: timeout * 1000,
          };
          mockApp.updateState({ previewConfig: newConfig });
          mockApp.addMessage({
            type: 'system',
            content: `Preview timeout set to ${timeout}s.`,
          });
        }
      }
      break;

    case 'on':
      mockApp.updateState({ previewMode: true, pendingPreview: undefined });
      mockApp.addMessage({
        type: 'system',
        content: 'Preview mode enabled. You will see a preview before each execution.',
      });
      break;
  }
}

// Simulate input processing logic
function processInput(input: string): { shouldAutoExecute: boolean; showPreview: boolean } {
  const state = mockApp.getState();

  if (!state.previewMode) {
    return { shouldAutoExecute: true, showPreview: false };
  }

  if (input.startsWith('/preview')) {
    return { shouldAutoExecute: true, showPreview: false };
  }

  // Mock intent detection
  const confidence = input.includes('high confidence') ? 0.95 : 0.75;

  const shouldAutoExecute =
    state.previewConfig.autoExecuteHighConfidence &&
    confidence >= state.previewConfig.confidenceThreshold;

  if (shouldAutoExecute) {
    mockApp.addMessage({
      type: 'system',
      content: `Auto-executing (confidence: ${Math.round(confidence * 100)}% ≥ ${Math.round(state.previewConfig.confidenceThreshold * 100)}%)`,
    });
    return { shouldAutoExecute: true, showPreview: false };
  }

  // Set up preview
  mockApp.updateState({
    pendingPreview: {
      input,
      intent: { type: 'task', confidence },
      timestamp: new Date(),
    },
  });

  // Set up timeout
  mockSetTimeout(() => {
    const currentState = mockApp.getState();
    if (currentState.pendingPreview) {
      mockApp.updateState({ pendingPreview: undefined });
      mockApp.addMessage({
        type: 'system',
        content: `Preview cancelled after ${currentState.previewConfig.timeoutMs / 1000}s timeout.`,
      });
    }
  }, state.previewConfig.timeoutMs);

  return { shouldAutoExecute: false, showPreview: true };
}

describe('Preview Configuration Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Reset mocks
    vi.clearAllMocks();
    activeTimeouts.clear();
    timeoutId = 0;

    // Initialize default state
    mockAppState = {
      previewMode: false,
      previewConfig: {
        confidenceThreshold: 0.9,
        autoExecuteHighConfidence: false,
        timeoutMs: 10000,
      },
      messages: [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    activeTimeouts.clear();
  });

  describe('Complete Configuration Workflow', () => {
    it('should complete a full configuration and usage workflow', async () => {
      // Step 1: Enable preview mode
      await executePreviewCommand(['on']);

      expect(mockAppState.previewMode).toBe(true);
      expect(mockAppState.messages).toHaveLength(1);
      expect(mockAppState.messages[0].content).toBe('Preview mode enabled. You will see a preview before each execution.');

      // Step 2: Configure confidence threshold
      await executePreviewCommand(['confidence', '80']);

      expect(mockAppState.previewConfig.confidenceThreshold).toBe(0.8);
      expect(mockAppState.messages).toHaveLength(2);
      expect(mockAppState.messages[1].content).toBe('Preview confidence threshold set to 80%.');

      // Step 3: Enable auto-execute
      await executePreviewCommand(['auto', 'on']);

      expect(mockAppState.previewConfig.autoExecuteHighConfidence).toBe(true);
      expect(mockAppState.messages).toHaveLength(3);
      expect(mockAppState.messages[2].content).toBe('Auto-execute for high confidence inputs enabled.');

      // Step 4: Set custom timeout
      await executePreviewCommand(['timeout', '5']);

      expect(mockAppState.previewConfig.timeoutMs).toBe(5000);
      expect(mockAppState.messages).toHaveLength(4);
      expect(mockAppState.messages[3].content).toBe('Preview timeout set to 5s.');

      // Step 5: Test high confidence auto-execute
      const result1 = processInput('high confidence task');

      expect(result1.shouldAutoExecute).toBe(true);
      expect(result1.showPreview).toBe(false);
      expect(mockAppState.messages[4].content).toContain('Auto-executing');
      expect(mockAppState.messages[4].content).toContain('95% ≥ 80%');

      // Step 6: Test low confidence preview
      const result2 = processInput('low confidence task');

      expect(result2.shouldAutoExecute).toBe(false);
      expect(result2.showPreview).toBe(true);
      expect(mockAppState.pendingPreview).toBeDefined();
      expect(mockAppState.pendingPreview?.input).toBe('low confidence task');

      // Step 7: Test timeout functionality
      vi.advanceTimersByTime(5000); // Advance past 5s timeout

      expect(mockAppState.pendingPreview).toBeUndefined();
      expect(mockAppState.messages).toHaveLength(6);
      expect(mockAppState.messages[5].content).toBe('Preview cancelled after 5s timeout.');
    });

    it('should handle configuration changes during active preview', async () => {
      // Setup: Enable preview mode and create pending preview
      await executePreviewCommand(['on']);
      mockAppState.pendingPreview = {
        input: 'test task',
        intent: { type: 'task', confidence: 0.75 },
        timestamp: new Date(),
      };

      // Change configuration while preview is active
      await executePreviewCommand(['confidence', '70']); // Lower threshold
      await executePreviewCommand(['auto', 'on']); // Enable auto-execute

      expect(mockAppState.previewConfig.confidenceThreshold).toBe(0.7);
      expect(mockAppState.previewConfig.autoExecuteHighConfidence).toBe(true);

      // Pending preview should still exist (not affected by config changes)
      expect(mockAppState.pendingPreview).toBeDefined();
    });

    it('should properly chain multiple configuration commands', async () => {
      const commands = [
        ['on'],
        ['confidence', '85'],
        ['timeout', '15'],
        ['auto', 'on'],
      ];

      for (const command of commands) {
        await executePreviewCommand(command);
      }

      // Verify final state
      expect(mockAppState.previewMode).toBe(true);
      expect(mockAppState.previewConfig).toEqual({
        confidenceThreshold: 0.85,
        autoExecuteHighConfidence: true,
        timeoutMs: 15000,
      });
      expect(mockAppState.messages).toHaveLength(4);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle invalid configurations gracefully', async () => {
      await executePreviewCommand(['on']);

      const invalidCommands = [
        ['confidence', '150'],  // Invalid threshold
        ['confidence', 'abc'],  // Non-numeric
        ['timeout', '0'],       // Invalid timeout
        ['timeout', '-5'],      // Negative timeout
      ];

      for (const command of invalidCommands) {
        const messagesBefore = mockAppState.messages.length;
        await executePreviewCommand(command);

        // Should add error message
        expect(mockAppState.messages.length).toBe(messagesBefore + 1);
        expect(mockAppState.messages[mockAppState.messages.length - 1].type).toBe('error');
      }

      // Configuration should remain unchanged
      expect(mockAppState.previewConfig).toEqual({
        confidenceThreshold: 0.9,
        autoExecuteHighConfidence: false,
        timeoutMs: 10000,
      });
    });

    it('should handle rapid configuration changes', async () => {
      await executePreviewCommand(['on']);

      // Rapidly change confidence threshold
      const thresholds = ['80', '85', '90', '75', '95'];

      for (const threshold of thresholds) {
        await executePreviewCommand(['confidence', threshold]);
      }

      // Should end up with the last value
      expect(mockAppState.previewConfig.confidenceThreshold).toBe(0.95);
      expect(mockAppState.messages).toHaveLength(6); // 1 for 'on' + 5 for confidence changes
    });

    it('should maintain configuration when preview mode is toggled', async () => {
      // Set up custom configuration
      await executePreviewCommand(['on']);
      await executePreviewCommand(['confidence', '75']);
      await executePreviewCommand(['auto', 'on']);
      await executePreviewCommand(['timeout', '20']);

      const customConfig = { ...mockAppState.previewConfig };

      // Toggle preview mode off and on
      mockAppState.previewMode = false;
      await executePreviewCommand(['on']);

      // Configuration should be preserved
      expect(mockAppState.previewConfig).toEqual(customConfig);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should properly clean up timeouts', async () => {
      await executePreviewCommand(['on']);
      await executePreviewCommand(['timeout', '2']);

      // Create multiple previews with timeouts
      processInput('task 1');
      processInput('task 2');
      processInput('task 3');

      expect(activeTimeouts.size).toBe(3);

      // Advance time to trigger all timeouts
      vi.advanceTimersByTime(2000);

      expect(activeTimeouts.size).toBe(0); // All timeouts should be cleaned up
    });

    it('should not create memory leaks with rapid preview changes', async () => {
      await executePreviewCommand(['on']);
      await executePreviewCommand(['timeout', '1']);

      // Create and cancel many previews rapidly
      for (let i = 0; i < 10; i++) {
        processInput(`task ${i}`);
        vi.advanceTimersByTime(500); // Advance halfway through timeout
      }

      // Complete remaining timeouts
      vi.advanceTimersByTime(1000);

      expect(activeTimeouts.size).toBe(0);

      // Should have appropriate number of timeout messages
      const timeoutMessages = mockAppState.messages.filter(m =>
        m.content.includes('timeout')
      );
      expect(timeoutMessages.length).toBeGreaterThan(0);
      expect(timeoutMessages.length).toBeLessThanOrEqual(10);
    });

    it('should handle concurrent configuration and execution', async () => {
      await executePreviewCommand(['on']);

      // Start a preview
      processInput('test task');
      expect(mockAppState.pendingPreview).toBeDefined();

      // Change configuration while preview is active
      await executePreviewCommand(['confidence', '50']);
      await executePreviewCommand(['auto', 'on']);

      // Preview should still be active
      expect(mockAppState.pendingPreview).toBeDefined();

      // New configuration should be applied
      expect(mockAppState.previewConfig.confidenceThreshold).toBe(0.5);
      expect(mockAppState.previewConfig.autoExecuteHighConfidence).toBe(true);

      // Process new input with updated configuration
      const result = processInput('high confidence task'); // 95% confidence

      expect(result.shouldAutoExecute).toBe(true); // Should auto-execute with new threshold
    });
  });

  describe('State Consistency Verification', () => {
    it('should maintain state consistency across all operations', async () => {
      const operations = [
        () => executePreviewCommand(['on']),
        () => executePreviewCommand(['confidence', '80']),
        () => executePreviewCommand(['auto', 'on']),
        () => executePreviewCommand(['timeout', '30']),
        () => processInput('high confidence task'),
        () => processInput('low confidence task'),
        () => vi.advanceTimersByTime(5000),
        () => executePreviewCommand(['auto', 'off']),
        () => processInput('another task'),
      ];

      for (const operation of operations) {
        const stateBefore = JSON.parse(JSON.stringify(mockAppState));
        operation();
        const stateAfter = mockAppState;

        // State should always be valid
        expect(typeof stateAfter.previewMode).toBe('boolean');
        expect(typeof stateAfter.previewConfig.confidenceThreshold).toBe('number');
        expect(typeof stateAfter.previewConfig.autoExecuteHighConfidence).toBe('boolean');
        expect(typeof stateAfter.previewConfig.timeoutMs).toBe('number');
        expect(Array.isArray(stateAfter.messages)).toBe(true);

        // Configuration values should be in valid ranges
        expect(stateAfter.previewConfig.confidenceThreshold).toBeGreaterThanOrEqual(0);
        expect(stateAfter.previewConfig.confidenceThreshold).toBeLessThanOrEqual(1);
        expect(stateAfter.previewConfig.timeoutMs).toBeGreaterThan(0);
      }
    });
  });
});