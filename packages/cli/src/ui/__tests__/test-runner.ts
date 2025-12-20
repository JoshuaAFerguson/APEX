/**
 * Manual test runner for keypress cancellation tests
 *
 * This file allows us to run basic validation of our test logic
 * without requiring the full vitest environment
 */

// Simple test framework for basic validation
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

function describe(name: string, fn: () => void): void {
  console.log(`\n🧪 ${name}`);
  fn();
}

function it(name: string, fn: () => void): TestResult {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    return { name, passed: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${name}: ${errorMsg}`);
    return { name, passed: false, error: errorMsg };
  }
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toBeUndefined: () => {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, but got ${actual}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, but got undefined`);
      }
    },
    toHaveBeenCalledWith: (expected: any) => {
      if (!actual.mock || !actual.mock.calls) {
        throw new Error(`Expected function to be called with ${JSON.stringify(expected)}, but function was not mocked`);
      }
      const found = actual.mock.calls.some((call: any[]) =>
        JSON.stringify(call[0]) === JSON.stringify(expected)
      );
      if (!found) {
        throw new Error(`Expected function to be called with ${JSON.stringify(expected)}, but it wasn't`);
      }
    },
    not: {
      toHaveBeenCalled: () => {
        if (actual.mock && actual.mock.calls && actual.mock.calls.length > 0) {
          throw new Error(`Expected function not to be called, but it was called ${actual.mock.calls.length} times`);
        }
      }
    }
  };
}

// Mock function factory
function vi() {
  return {
    fn: () => ({
      mock: { calls: [] as any[] },
      mockImplementation: function(impl: Function) {
        return impl;
      },
      mockClear: function() {
        this.mock.calls = [];
      }
    }),
    clearAllMocks: () => {},
  };
}

// Test state simulation
interface TestState {
  pendingPreview?: {
    input: string;
    intent: any;
    timestamp: Date;
  };
  remainingMs?: number;
  messages: Array<{
    type: string;
    content: string;
  }>;
}

// Run basic keypress cancellation tests
function runKeypressCancellationTests(): TestResult[] {
  const results: TestResult[] = [];

  describe('Basic Keypress Cancellation Validation', () => {
    let testState: TestState;
    let mockAddMessage: any;
    let mockHandleInput: any;

    // Setup
    testState = {
      pendingPreview: {
        input: 'test command',
        intent: { type: 'command', confidence: 0.96 },
        timestamp: new Date(),
      },
      remainingMs: 3000,
      messages: [],
    };

    mockAddMessage = vi().fn();
    mockHandleInput = vi().fn();

    // Simulate keypress handler
    function simulateKeypress(input: string | undefined, key: any) {
      if (testState.pendingPreview) {
        if (key.return) {
          const pendingPreview = testState.pendingPreview;
          testState.pendingPreview = undefined;
          mockHandleInput({ input: pendingPreview.input });
          return;
        } else if (key.escape) {
          testState.pendingPreview = undefined;
          mockAddMessage({ type: 'system', content: 'Preview cancelled.' });
          return;
        } else if (input?.toLowerCase() === 'e') {
          testState.pendingPreview = undefined;
          mockAddMessage({ type: 'system', content: 'Returning to edit mode...' });
          return;
        } else {
          testState.remainingMs = undefined;
          mockAddMessage({ type: 'system', content: 'Auto-execute cancelled.' });
          return;
        }
      }
    }

    // Test 1: Any keypress cancels countdown
    results.push(it('should cancel countdown on any keypress', () => {
      const initialRemainingMs = testState.remainingMs;
      expect(initialRemainingMs).toBe(3000);

      simulateKeypress('x', {});

      expect(testState.remainingMs).toBeUndefined();
    }));

    // Test 2: System message is displayed
    results.push(it('should show cancellation message', () => {
      mockAddMessage.mockClear();
      testState.remainingMs = 2000; // Reset for this test

      simulateKeypress('y', {});

      expect(mockAddMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Auto-execute cancelled.'
      });
    }));

    // Test 3: Preview remains visible
    results.push(it('should keep preview visible after cancellation', () => {
      testState.remainingMs = 1000; // Reset for this test
      const originalPreview = testState.pendingPreview;

      simulateKeypress('z', {});

      expect(testState.pendingPreview).toBe(originalPreview);
      expect(testState.pendingPreview).toBeDefined();
    }));

    // Test 4: Enter still confirms
    results.push(it('should confirm with Enter', () => {
      // Reset state
      testState = {
        pendingPreview: {
          input: 'test enter',
          intent: { type: 'command', confidence: 0.98 },
          timestamp: new Date(),
        },
        remainingMs: 5000,
        messages: [],
      };
      mockHandleInput.mockClear();

      simulateKeypress('', { return: true });

      expect(mockHandleInput).toHaveBeenCalledWith({ input: 'test enter' });
      expect(testState.pendingPreview).toBeUndefined();
    }));

    // Test 5: Escape cancels preview
    results.push(it('should cancel preview with Escape', () => {
      // Reset state
      testState = {
        pendingPreview: {
          input: 'test escape',
          intent: { type: 'command', confidence: 0.97 },
          timestamp: new Date(),
        },
        remainingMs: 4000,
        messages: [],
      };
      mockAddMessage.mockClear();
      mockHandleInput.mockClear();

      simulateKeypress('', { escape: true });

      expect(testState.pendingPreview).toBeUndefined();
      expect(mockAddMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Preview cancelled.'
      });
      expect(mockHandleInput).not.toHaveBeenCalled();
    }));
  });

  return results;
}

// Export for external use or run directly
if (require.main === module) {
  console.log('🚀 Running Keypress Cancellation Tests...\n');

  const results = runKeypressCancellationTests();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }

  console.log(passed === results.length ? '\n🎉 All tests passed!' : '\n⚠️  Some tests failed.');
}

export { runKeypressCancellationTests };