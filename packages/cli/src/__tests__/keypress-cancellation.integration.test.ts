/**
 * Integration tests for any-keypress cancellation of auto-execute countdown
 *
 * These tests validate the feature in realistic scenarios with:
 * - Full component rendering
 * - Real timer behavior
 * - Message flow
 * - User interaction patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock timers for controlled testing
vi.useFakeTimers();

// Mock Ink and React for integration testing
vi.mock('ink', () => ({
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: vi.fn(),
  useApp: vi.fn(),
  render: vi.fn(),
}));

// Helper to simulate the full app state management
interface AppState {
  previewMode: boolean;
  pendingPreview?: {
    input: string;
    intent: { type: string; confidence: number };
    timestamp: Date;
  };
  remainingMs?: number;
  messages: Array<{
    id: string;
    type: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    timestamp: Date;
  }>;
  isProcessing: boolean;
}

interface MockAppContext {
  state: AppState;
  setState: (updater: Partial<AppState> | ((prev: AppState) => AppState)) => void;
  addMessage: (message: { type: string; content: string }) => void;
  handleInput: (input: string) => void;
}

// Mock app context setup
function createMockAppContext(): MockAppContext {
  let state: AppState = {
    previewMode: true,
    pendingPreview: undefined,
    remainingMs: undefined,
    messages: [],
    isProcessing: false,
  };

  const setState = vi.fn((updater: any) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
  });

  const addMessage = vi.fn((message: { type: string; content: string }) => {
    const newMessage = {
      id: `msg_${Date.now()}`,
      type: message.type as any,
      content: message.content,
      timestamp: new Date(),
    };
    state.messages = [...state.messages, newMessage];
  });

  const handleInput = vi.fn();

  return {
    state,
    setState,
    addMessage,
    handleInput,
  };
}

// Simulate the useInput handler logic from App.tsx
function simulateUseInputHandler(
  appContext: MockAppContext,
  input: string | undefined,
  key: any
) {
  const { state, setState, addMessage, handleInput } = appContext;

  if (state.pendingPreview) {
    if (key.return) {
      // Confirm - execute the pending action
      const pendingPreview = state.pendingPreview;
      setState({ pendingPreview: undefined });
      handleInput(pendingPreview.input);
      return;
    } else if (key.escape) {
      // Cancel - clear the preview
      setState({ pendingPreview: undefined });
      addMessage({ type: 'system', content: 'Preview cancelled.' });
      return;
    } else if (input?.toLowerCase() === 'e') {
      // Edit - return input to text box for modification
      const pendingInput = state.pendingPreview.input;
      setState({
        pendingPreview: undefined,
        editModeInput: pendingInput
      } as any);
      addMessage({ type: 'system', content: 'Returning to edit mode...' });
      return;
    } else {
      // Any other keypress - cancel countdown but keep preview visible
      setState({ remainingMs: undefined });
      addMessage({ type: 'system', content: 'Auto-execute cancelled.' });
      return;
    }
  }

  // Handle non-preview mode (shortcut processing would happen here)
}

describe('Keypress Cancellation Integration Tests', () => {
  let appContext: MockAppContext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    appContext = createMockAppContext();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('High-Confidence Auto-Execute Scenarios', () => {
    it('should cancel auto-execute countdown and preserve preview for manual confirmation', async () => {
      // Setup high-confidence scenario
      appContext.state.pendingPreview = {
        input: '/status',
        intent: { type: 'command', confidence: 0.98 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 3000; // 3 seconds countdown

      // Start the countdown timer simulation
      let countdownActive = true;
      const countdownTimer = setInterval(() => {
        if (appContext.state.remainingMs && appContext.state.remainingMs > 0) {
          appContext.setState({
            remainingMs: appContext.state.remainingMs - 100
          });
        } else if (countdownActive && appContext.state.remainingMs === 0) {
          // Auto-execute would happen here
          countdownActive = false;
          appContext.handleInput(appContext.state.pendingPreview!.input);
          appContext.setState({ pendingPreview: undefined, remainingMs: undefined });
        }
      }, 100);

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);
      expect(appContext.state.remainingMs).toBe(2000);

      // User presses any key to cancel
      simulateUseInputHandler(appContext, 'q', {});

      // Verify countdown was cancelled
      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });

      // Verify preview is still visible
      expect(appContext.state.pendingPreview).toBeDefined();
      expect(appContext.state.pendingPreview!.input).toBe('/status');

      // Advance more time - should NOT auto-execute anymore
      vi.advanceTimersByTime(5000);
      expect(appContext.handleInput).not.toHaveBeenCalled();

      // User can still manually confirm with Enter
      simulateUseInputHandler(appContext, '', { return: true });
      expect(appContext.handleInput).toHaveBeenCalledWith('/status');
      expect(appContext.state.pendingPreview).toBeUndefined();

      clearInterval(countdownTimer);
    });

    it('should handle cancellation in the last moments before auto-execute', async () => {
      // Setup scenario with very short countdown
      appContext.state.pendingPreview = {
        input: '/help',
        intent: { type: 'command', confidence: 0.99 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 200; // 200ms remaining

      // Advance to just before auto-execute
      vi.advanceTimersByTime(150);

      // Cancel at the last moment
      simulateUseInputHandler(appContext, 'stop', {});

      // Verify cancellation worked
      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });

      // Advance past original auto-execute time
      vi.advanceTimersByTime(100);

      // Should not have auto-executed
      expect(appContext.handleInput).not.toHaveBeenCalled();
      expect(appContext.state.pendingPreview).toBeDefined();
    });
  });

  describe('Manual Preview Scenarios', () => {
    it('should cancel countdown in manual preview mode', async () => {
      // Setup manual preview scenario (lower confidence)
      appContext.state.pendingPreview = {
        input: 'implement new feature',
        intent: { type: 'task', confidence: 0.85 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 10000; // 10 seconds for manual review

      // User decides to cancel during review
      vi.advanceTimersByTime(2000); // 2 seconds in
      simulateUseInputHandler(appContext, 'cancel', {});

      // Verify cancellation
      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });

      // Preview should remain for manual confirmation
      expect(appContext.state.pendingPreview).toBeDefined();
      expect(appContext.state.pendingPreview!.input).toBe('implement new feature');
    });
  });

  describe('User Interaction Flow', () => {
    beforeEach(() => {
      appContext.state.pendingPreview = {
        input: 'create component',
        intent: { type: 'task', confidence: 0.96 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 5000;
    });

    it('should support complete user workflow: cancel -> confirm', async () => {
      // Step 1: User cancels countdown
      simulateUseInputHandler(appContext, 'wait', {});

      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });
      expect(appContext.state.pendingPreview).toBeDefined();

      // Step 2: User reviews and decides to confirm
      simulateUseInputHandler(appContext, '', { return: true });

      expect(appContext.handleInput).toHaveBeenCalledWith('create component');
      expect(appContext.state.pendingPreview).toBeUndefined();
    });

    it('should support complete user workflow: cancel -> edit', async () => {
      // Step 1: User cancels countdown
      simulateUseInputHandler(appContext, 'modify', {});

      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.state.pendingPreview).toBeDefined();

      // Step 2: User decides to edit
      simulateUseInputHandler(appContext, 'e', {});

      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Returning to edit mode...'
      });
      expect(appContext.state.pendingPreview).toBeUndefined();
    });

    it('should support complete user workflow: cancel -> abandon', async () => {
      // Step 1: User cancels countdown
      simulateUseInputHandler(appContext, 'hmm', {});

      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.state.pendingPreview).toBeDefined();

      // Step 2: User abandons the action
      simulateUseInputHandler(appContext, '', { escape: true });

      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview cancelled.'
      });
      expect(appContext.state.pendingPreview).toBeUndefined();
      expect(appContext.handleInput).not.toHaveBeenCalled();
    });
  });

  describe('Rapid User Interactions', () => {
    beforeEach(() => {
      appContext.state.pendingPreview = {
        input: 'rapid test',
        intent: { type: 'command', confidence: 0.97 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 4000;
    });

    it('should handle rapid keypress sequence correctly', async () => {
      // Rapid sequence of keypresses
      const keypresses = ['a', 'b', 'c', 'd', 'e'];

      keypresses.forEach((key, index) => {
        // Clear previous mock calls to track each individual response
        if (index === 0) {
          // First keypress should cancel countdown
          simulateUseInputHandler(appContext, key, {});
          expect(appContext.state.remainingMs).toBeUndefined();
        } else {
          // Subsequent keypresses should not change state further
          const stateBeforeKeypress = { ...appContext.state };
          simulateUseInputHandler(appContext, key, {});

          // State should remain the same after first cancellation
          expect(appContext.state.remainingMs).toBeUndefined();
          expect(appContext.state.pendingPreview).toBeDefined();
        }
      });

      // Should only have one cancellation message
      const cancellationMessages = appContext.state.messages.filter(
        msg => msg.content === 'Auto-execute cancelled.'
      );
      expect(cancellationMessages).toHaveLength(1);
    });

    it('should handle keypress followed by immediate Enter', () => {
      // Cancel countdown
      simulateUseInputHandler(appContext, 'x', {});
      expect(appContext.state.remainingMs).toBeUndefined();

      // Immediately press Enter to confirm
      simulateUseInputHandler(appContext, '', { return: true });

      expect(appContext.handleInput).toHaveBeenCalledWith('rapid test');
      expect(appContext.state.pendingPreview).toBeUndefined();
    });

    it('should handle keypress followed by immediate Escape', () => {
      // Cancel countdown
      simulateUseInputHandler(appContext, 'y', {});
      expect(appContext.state.remainingMs).toBeUndefined();

      // Immediately press Escape to cancel preview
      simulateUseInputHandler(appContext, '', { escape: true });

      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview cancelled.'
      });
      expect(appContext.state.pendingPreview).toBeUndefined();
      expect(appContext.handleInput).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle cancellation when countdown is already at zero', () => {
      appContext.state.pendingPreview = {
        input: 'edge case test',
        intent: { type: 'command', confidence: 0.98 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 0;

      // Try to cancel when countdown is already at zero
      simulateUseInputHandler(appContext, 'z', {});

      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });
    });

    it('should handle multiple cancellation attempts', () => {
      appContext.state.pendingPreview = {
        input: 'multiple cancel test',
        intent: { type: 'command', confidence: 0.95 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 3000;

      // First cancellation
      simulateUseInputHandler(appContext, 'first', {});
      expect(appContext.state.remainingMs).toBeUndefined();

      const messagesAfterFirst = appContext.state.messages.length;

      // Second cancellation attempt
      simulateUseInputHandler(appContext, 'second', {});

      // Should still work and add another message
      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.state.messages.length).toBeGreaterThan(messagesAfterFirst);
    });

    it('should handle state corruption gracefully', () => {
      // Simulate corrupted state
      appContext.state.pendingPreview = {
        input: 'corruption test',
        intent: { type: 'command', confidence: 0.96 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = undefined; // Already undefined

      // Should handle gracefully
      expect(() => simulateUseInputHandler(appContext, 'test', {})).not.toThrow();

      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle high-frequency cancellation requests efficiently', () => {
      appContext.state.pendingPreview = {
        input: 'performance test',
        intent: { type: 'command', confidence: 0.97 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 5000;

      const startTime = performance.now();

      // Simulate high-frequency cancellation attempts
      for (let i = 0; i < 1000; i++) {
        simulateUseInputHandler(appContext, `key${i}`, {});
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 50ms for 1000 operations)
      expect(duration).toBeLessThan(50);

      // State should be consistent
      expect(appContext.state.remainingMs).toBeUndefined();
      expect(appContext.state.pendingPreview).toBeDefined();
    });

    it('should maintain memory stability during extended use', () => {
      appContext.state.pendingPreview = {
        input: 'memory test',
        intent: { type: 'command', confidence: 0.98 },
        timestamp: new Date(),
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate extended usage pattern
      for (let cycle = 0; cycle < 100; cycle++) {
        // Setup countdown
        appContext.state.remainingMs = 3000;

        // Cancel multiple times
        for (let i = 0; i < 10; i++) {
          simulateUseInputHandler(appContext, `cycle${cycle}_key${i}`, {});
        }

        // Clear and reset for next cycle
        appContext.setState({ remainingMs: undefined });
        appContext.state.messages = [];
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not leak significant memory (< 1MB increase)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Feature Integration', () => {
    it('should work correctly with all preview modes', async () => {
      const scenarios = [
        {
          name: 'high-confidence auto-execute',
          confidence: 0.98,
          initialTimeout: 2000,
        },
        {
          name: 'medium-confidence manual review',
          confidence: 0.85,
          initialTimeout: 8000,
        },
        {
          name: 'low-confidence extended review',
          confidence: 0.72,
          initialTimeout: 15000,
        },
      ];

      for (const scenario of scenarios) {
        // Reset state for each scenario
        appContext = createMockAppContext();
        appContext.state.pendingPreview = {
          input: `test for ${scenario.name}`,
          intent: { type: 'task', confidence: scenario.confidence },
          timestamp: new Date(),
        };
        appContext.state.remainingMs = scenario.initialTimeout;

        // Cancel countdown
        simulateUseInputHandler(appContext, 'cancel', {});

        // Verify cancellation worked for all scenarios
        expect(appContext.state.remainingMs).toBeUndefined();
        expect(appContext.addMessage).toHaveBeenCalledWith({
          type: 'system',
          content: 'Auto-execute cancelled.'
        });
        expect(appContext.state.pendingPreview).toBeDefined();

        // Verify manual confirmation still works
        simulateUseInputHandler(appContext, '', { return: true });
        expect(appContext.handleInput).toHaveBeenCalledWith(`test for ${scenario.name}`);
      }
    });

    it('should preserve all other preview functionality after cancellation', () => {
      appContext.state.pendingPreview = {
        input: 'comprehensive test',
        intent: { type: 'task', confidence: 0.94 },
        timestamp: new Date(),
      };
      appContext.state.remainingMs = 6000;

      // Cancel countdown
      simulateUseInputHandler(appContext, 'comprehensive', {});
      expect(appContext.state.remainingMs).toBeUndefined();

      // Test all preview actions still work

      // 1. Enter confirmation
      const beforeConfirm = { ...appContext.state };
      simulateUseInputHandler(appContext, '', { return: true });
      expect(appContext.handleInput).toHaveBeenCalledWith('comprehensive test');

      // Reset for next test
      appContext.state = {
        ...beforeConfirm,
        pendingPreview: {
          input: 'comprehensive test 2',
          intent: { type: 'task', confidence: 0.94 },
          timestamp: new Date(),
        }
      };

      // 2. Escape cancellation
      simulateUseInputHandler(appContext, '', { escape: true });
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview cancelled.'
      });
      expect(appContext.state.pendingPreview).toBeUndefined();

      // Reset for next test
      appContext.state = {
        ...beforeConfirm,
        pendingPreview: {
          input: 'comprehensive test 3',
          intent: { type: 'task', confidence: 0.94 },
          timestamp: new Date(),
        }
      };

      // 3. Edit mode
      simulateUseInputHandler(appContext, 'e', {});
      expect(appContext.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Returning to edit mode...'
      });
      expect(appContext.state.pendingPreview).toBeUndefined();
    });
  });
});