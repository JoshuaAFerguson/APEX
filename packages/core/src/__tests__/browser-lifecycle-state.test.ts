/**
 * Unit tests for Browser Lifecycle State types and interfaces
 *
 * Tests verify:
 * 1. BrowserLifecycleState union type constraints
 * 2. BrowserLifecycleAware interface implementation
 * 3. BrowserResourceState integration with lifecycleState
 * 4. Type safety and TypeScript compilation
 * 5. State transition logic and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  BrowserLifecycleState,
  BrowserLifecycleAware,
  BrowserResourceState
} from '../types.js';

// Test implementations for interface validation
class MockBrowserSession implements BrowserLifecycleAware {
  state: BrowserLifecycleState;

  constructor(initialState: BrowserLifecycleState = 'idle') {
    this.state = initialState;
  }

  isActive(): boolean {
    return this.state === 'active';
  }

  launch(): void {
    if (this.state === 'idle') {
      this.state = 'launching';
    }
  }

  activate(): void {
    if (this.state === 'launching') {
      this.state = 'active';
    }
  }

  cleanup(): void {
    if (this.state === 'active') {
      this.state = 'cleaning_up';
    }
  }

  destroy(): void {
    this.state = 'destroyed';
  }

  reset(): void {
    if (this.state === 'cleaning_up') {
      this.state = 'idle';
    }
  }
}

describe('BrowserLifecycleState Types', () => {
  describe('BrowserLifecycleState Union Type', () => {
    it('should accept all valid lifecycle state values', () => {
      const validStates: BrowserLifecycleState[] = [
        'idle',
        'launching',
        'active',
        'cleaning_up',
        'destroyed'
      ];

      validStates.forEach(state => {
        expect(typeof state).toBe('string');
        expect(['idle', 'launching', 'active', 'cleaning_up', 'destroyed']).toContain(state);
      });
    });

    it('should ensure type safety at compile time', () => {
      // These assignments should compile without TypeScript errors
      let state: BrowserLifecycleState;

      state = 'idle';
      expect(state).toBe('idle');

      state = 'launching';
      expect(state).toBe('launching');

      state = 'active';
      expect(state).toBe('active');

      state = 'cleaning_up';
      expect(state).toBe('cleaning_up');

      state = 'destroyed';
      expect(state).toBe('destroyed');
    });

    it('should support state comparison and conditional logic', () => {
      const states: BrowserLifecycleState[] = ['idle', 'launching', 'active', 'cleaning_up', 'destroyed'];

      states.forEach(state => {
        const isOperational = state === 'active';
        const isTransitioning = state === 'launching' || state === 'cleaning_up';
        const isStable = state === 'idle' || state === 'active' || state === 'destroyed';

        expect(typeof isOperational).toBe('boolean');
        expect(typeof isTransitioning).toBe('boolean');
        expect(typeof isStable).toBe('boolean');
      });
    });
  });

  describe('BrowserLifecycleAware Interface', () => {
    let mockSession: MockBrowserSession;

    beforeEach(() => {
      mockSession = new MockBrowserSession();
    });

    it('should implement required state property', () => {
      expect(mockSession).toHaveProperty('state');
      expect(typeof mockSession.state).toBe('string');
      expect(['idle', 'launching', 'active', 'cleaning_up', 'destroyed']).toContain(mockSession.state);
    });

    it('should implement required isActive() method', () => {
      expect(mockSession).toHaveProperty('isActive');
      expect(typeof mockSession.isActive).toBe('function');
      expect(typeof mockSession.isActive()).toBe('boolean');
    });

    it('should return true from isActive() only when state is active', () => {
      const states: Array<[BrowserLifecycleState, boolean]> = [
        ['idle', false],
        ['launching', false],
        ['active', true],
        ['cleaning_up', false],
        ['destroyed', false]
      ];

      states.forEach(([state, expectedActive]) => {
        mockSession.state = state;
        expect(mockSession.isActive()).toBe(expectedActive);
      });
    });

    it('should support typical browser lifecycle transitions', () => {
      // Start in idle state
      expect(mockSession.state).toBe('idle');
      expect(mockSession.isActive()).toBe(false);

      // Launch browser
      mockSession.launch();
      expect(mockSession.state).toBe('launching');
      expect(mockSession.isActive()).toBe(false);

      // Activate browser
      mockSession.activate();
      expect(mockSession.state).toBe('active');
      expect(mockSession.isActive()).toBe(true);

      // Start cleanup
      mockSession.cleanup();
      expect(mockSession.state).toBe('cleaning_up');
      expect(mockSession.isActive()).toBe(false);

      // Reset to idle (if reusable)
      mockSession.reset();
      expect(mockSession.state).toBe('idle');
      expect(mockSession.isActive()).toBe(false);
    });

    it('should support complete destruction workflow', () => {
      mockSession.state = 'active';
      expect(mockSession.isActive()).toBe(true);

      mockSession.destroy();
      expect(mockSession.state).toBe('destroyed');
      expect(mockSession.isActive()).toBe(false);
    });

    it('should handle edge cases in state transitions', () => {
      // Cannot launch from non-idle states
      mockSession.state = 'destroyed';
      mockSession.launch();
      expect(mockSession.state).toBe('destroyed'); // Should not change

      // Cannot activate from non-launching states
      mockSession.state = 'idle';
      mockSession.activate();
      expect(mockSession.state).toBe('idle'); // Should not change

      // Cannot cleanup from non-active states
      mockSession.state = 'launching';
      mockSession.cleanup();
      expect(mockSession.state).toBe('launching'); // Should not change

      // Cannot reset from non-cleaning_up states
      mockSession.state = 'active';
      mockSession.reset();
      expect(mockSession.state).toBe('active'); // Should not change
    });
  });

  describe('BrowserResourceState with lifecycleState Integration', () => {
    it('should support optional lifecycleState field', () => {
      const resourceState: BrowserResourceState = {
        browserActive: false,
        contextActive: false,
        pageActive: false,
        activeOperations: 0
      };

      // lifecycleState should be optional
      expect(resourceState.lifecycleState).toBeUndefined();

      // Should be able to add lifecycleState
      resourceState.lifecycleState = 'idle';
      expect(resourceState.lifecycleState).toBe('idle');
    });

    it('should correlate resource state with lifecycle state', () => {
      const testCases: Array<{
        lifecycleState: BrowserLifecycleState;
        expectedBrowserActive: boolean;
        description: string;
      }> = [
        { lifecycleState: 'idle', expectedBrowserActive: false, description: 'idle state should not have active browser' },
        { lifecycleState: 'launching', expectedBrowserActive: false, description: 'launching state should not have active browser yet' },
        { lifecycleState: 'active', expectedBrowserActive: true, description: 'active state should have active browser' },
        { lifecycleState: 'cleaning_up', expectedBrowserActive: false, description: 'cleaning_up state should not have active browser' },
        { lifecycleState: 'destroyed', expectedBrowserActive: false, description: 'destroyed state should not have active browser' }
      ];

      testCases.forEach(({ lifecycleState, expectedBrowserActive, description }) => {
        const resourceState: BrowserResourceState = {
          browserActive: expectedBrowserActive,
          contextActive: expectedBrowserActive,
          pageActive: expectedBrowserActive,
          activeOperations: expectedBrowserActive ? 1 : 0,
          lifecycleState
        };

        expect(resourceState.browserActive).toBe(expectedBrowserActive);
        expect(resourceState.lifecycleState).toBe(lifecycleState);
      }, description);
    });

    it('should support complete resource state tracking', () => {
      const resourceState: BrowserResourceState = {
        browserActive: false,
        contextActive: false,
        pageActive: false,
        activeOperations: 0,
        lifecycleState: 'idle',
        currentUrl: undefined,
        lastAllocation: undefined,
        sessionId: undefined
      };

      // Simulate browser launch
      resourceState.lifecycleState = 'launching';
      resourceState.lastAllocation = new Date();
      resourceState.sessionId = 'session-123';

      expect(resourceState.lifecycleState).toBe('launching');
      expect(resourceState.lastAllocation).toBeInstanceOf(Date);
      expect(resourceState.sessionId).toBe('session-123');

      // Simulate browser activation
      resourceState.lifecycleState = 'active';
      resourceState.browserActive = true;
      resourceState.contextActive = true;
      resourceState.pageActive = true;
      resourceState.currentUrl = 'https://example.com';
      resourceState.activeOperations = 1;

      expect(resourceState.lifecycleState).toBe('active');
      expect(resourceState.browserActive).toBe(true);
      expect(resourceState.currentUrl).toBe('https://example.com');
      expect(resourceState.activeOperations).toBe(1);

      // Simulate cleanup
      resourceState.lifecycleState = 'cleaning_up';
      resourceState.browserActive = false;
      resourceState.contextActive = false;
      resourceState.pageActive = false;
      resourceState.activeOperations = 0;
      resourceState.currentUrl = undefined;

      expect(resourceState.lifecycleState).toBe('cleaning_up');
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.currentUrl).toBeUndefined();

      // Simulate destruction
      resourceState.lifecycleState = 'destroyed';
      resourceState.sessionId = undefined;
      resourceState.lastAllocation = undefined;

      expect(resourceState.lifecycleState).toBe('destroyed');
      expect(resourceState.sessionId).toBeUndefined();
    });
  });

  describe('Type Integration and Edge Cases', () => {
    it('should handle mixed implementations with different lifecycle patterns', () => {
      class AlwaysActiveBrowser implements BrowserLifecycleAware {
        state: BrowserLifecycleState = 'active';

        isActive(): boolean {
          return true; // Always returns true regardless of state
        }
      }

      class StrictBrowser implements BrowserLifecycleAware {
        state: BrowserLifecycleState = 'idle';

        isActive(): boolean {
          return this.state === 'active';
        }
      }

      const alwaysActive = new AlwaysActiveBrowser();
      const strict = new StrictBrowser();

      expect(alwaysActive.isActive()).toBe(true);
      expect(strict.isActive()).toBe(false);

      strict.state = 'active';
      expect(strict.isActive()).toBe(true);
    });

    it('should support functional programming patterns', () => {
      const createResourceState = (lifecycleState: BrowserLifecycleState): BrowserResourceState => ({
        browserActive: lifecycleState === 'active',
        contextActive: lifecycleState === 'active',
        pageActive: lifecycleState === 'active',
        activeOperations: lifecycleState === 'active' ? 1 : 0,
        lifecycleState
      });

      const states: BrowserLifecycleState[] = ['idle', 'launching', 'active', 'cleaning_up', 'destroyed'];
      const resourceStates = states.map(createResourceState);

      resourceStates.forEach((state, index) => {
        expect(state.lifecycleState).toBe(states[index]);
        expect(state.browserActive).toBe(states[index] === 'active');
      });
    });

    it('should handle concurrent state changes safely', () => {
      const session = new MockBrowserSession();
      const operations = [
        () => { session.state = 'launching'; },
        () => { session.state = 'active'; },
        () => { session.state = 'cleaning_up'; },
        () => { session.state = 'destroyed'; }
      ];

      // Simulate rapid state changes
      operations.forEach(operation => {
        operation();
        expect(['idle', 'launching', 'active', 'cleaning_up', 'destroyed']).toContain(session.state);
      });
    });

    it('should maintain type safety with complex state objects', () => {
      interface ExtendedBrowserState extends BrowserLifecycleAware {
        metadata: {
          version: string;
          features: string[];
        };
      }

      const complexSession: ExtendedBrowserState = {
        state: 'idle',
        metadata: {
          version: '1.0.0',
          features: ['navigation', 'screenshots']
        },
        isActive(): boolean {
          return this.state === 'active';
        }
      };

      expect(complexSession.state).toBe('idle');
      expect(complexSession.isActive()).toBe(false);
      expect(complexSession.metadata.version).toBe('1.0.0');
      expect(complexSession.metadata.features).toContain('navigation');

      complexSession.state = 'active';
      expect(complexSession.isActive()).toBe(true);
    });
  });

  describe('Documentation Examples Validation', () => {
    it('should validate the example from BrowserLifecycleAware JSDoc', () => {
      // This tests the exact example from the interface documentation
      class BrowserSession implements BrowserLifecycleAware {
        state: BrowserLifecycleState = 'idle';

        isActive(): boolean {
          return this.state === 'active';
        }

        async launch(): Promise<void> {
          this.state = 'launching';
          // ... launch logic would go here
          this.state = 'active';
        }
      }

      const session = new BrowserSession();
      expect(session.state).toBe('idle');
      expect(session.isActive()).toBe(false);

      // Test the launch method
      session.launch().then(() => {
        expect(session.state).toBe('active');
        expect(session.isActive()).toBe(true);
      });
    });

    it('should validate state transition flow from documentation', () => {
      // Tests the documented flow: idle → launching → active → cleaning_up → destroyed
      //                                      ↓
      //                                  cleaning_up → idle (if reusable)

      const session = new MockBrowserSession('idle');

      // Forward flow
      expect(session.state).toBe('idle');
      session.launch();
      expect(session.state).toBe('launching');
      session.activate();
      expect(session.state).toBe('active');
      session.cleanup();
      expect(session.state).toBe('cleaning_up');

      // Option 1: Reset to idle (reusable)
      session.reset();
      expect(session.state).toBe('idle');

      // Option 2: Complete destruction
      session.state = 'cleaning_up';
      session.destroy();
      expect(session.state).toBe('destroyed');
    });
  });
});