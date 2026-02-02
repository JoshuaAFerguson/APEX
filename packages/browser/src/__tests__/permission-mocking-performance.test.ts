/**
 * @apexcli/browser - Permission Mocking Performance Tests
 *
 * Performance benchmarks and stress tests for permission mocking utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,
  MockPermissionStatus,
} from '../permission-mocking/index.js';
import type {
  PermissionState,
  PermissionName,
  MockPermissionHandle,
} from '../permission-mocking/types.js';

// Mock navigator if not available in test environment
const originalNavigator = globalThis.navigator;
const mockNavigator = {
  permissions: {
    query: vi.fn(),
  },
} as any;

// Performance threshold constants
const PERFORMANCE_THRESHOLDS = {
  MOCK_CREATION_TIME: 10, // ms
  PERMISSION_QUERY_TIME: 5, // ms per query
  STATE_CHANGE_TIME: 2, // ms per state change
  BULK_OPERATION_TIME: 50, // ms for 100 operations
  MEMORY_CLEANUP_TIME: 20, // ms
  EVENT_HANDLING_TIME: 1, // ms per event
} as const;

// Helper function to measure execution time
function measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    resolve({ result, duration });
  });
}

// Helper to create sample permission data
function createSamplePermissions(count: number): PermissionName[] {
  const basePermissions: PermissionName[] = [
    'geolocation',
    'notifications',
    'camera',
    'microphone',
    'clipboard-read',
    'clipboard-write',
    'push',
    'persistent-storage',
  ];

  const permissions: PermissionName[] = [];
  for (let i = 0; i < count; i++) {
    permissions.push(basePermissions[i % basePermissions.length]);
  }
  return permissions;
}

describe('Permission Mocking Performance Tests', () => {
  beforeEach(() => {
    // Ensure clean state for each test
    if (isPermissionsMocked()) {
      const handle = getCurrentMockHandle();
      handle?.restore();
    }

    // Set up mock navigator for testing
    if (!globalThis.navigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    // Clean up any active mocks
    if (isPermissionsMocked()) {
      const handle = getCurrentMockHandle();
      handle?.restore();
    }

    // Restore original navigator
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('Mock Creation Performance', () => {
    it('should create mock handles quickly', async () => {
      const { duration } = await measureTime(() => {
        const handle = mockPermissions();
        handle.restore(); // Clean up immediately
        return handle;
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MOCK_CREATION_TIME);
    });

    it('should handle multiple rapid mock creations', async () => {
      const createCount = 10;
      const { duration } = await measureTime(async () => {
        const handles: MockPermissionHandle[] = [];
        for (let i = 0; i < createCount; i++) {
          const handle = mockPermissions();
          handles.push(handle);
          if (i > 0) {
            handles[i - 1].restore(); // Clean up previous
          }
        }
        // Clean up last handle
        handles[handles.length - 1].restore();
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MOCK_CREATION_TIME * createCount);
    });

    it('should create mocks with large initial states efficiently', async () => {
      const largeInitialStates: Partial<Record<PermissionName, PermissionState>> = {};
      const permissions = createSamplePermissions(20);

      permissions.forEach((permission, index) => {
        const state: PermissionState = index % 3 === 0 ? 'granted' :
                                      index % 3 === 1 ? 'denied' : 'prompt';
        largeInitialStates[permission] = state;
      });

      const { duration } = await measureTime(() => {
        const handle = mockPermissions({ initialStates: largeInitialStates });
        handle.restore();
        return handle;
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MOCK_CREATION_TIME * 2);
    });
  });

  describe('Permission Query Performance', () => {
    let handle: MockPermissionHandle;

    beforeEach(() => {
      handle = mockPermissions();
    });

    afterEach(() => {
      handle.restore();
    });

    it('should execute single permission queries quickly', async () => {
      const { duration } = await measureTime(() =>
        navigator.permissions.query({ name: 'notifications' })
      );

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PERMISSION_QUERY_TIME);
    });

    it('should handle concurrent permission queries efficiently', async () => {
      const queryCount = 50;
      const permissions = createSamplePermissions(queryCount);

      const { duration } = await measureTime(() =>
        Promise.all(
          permissions.map((permission) =>
            navigator.permissions.query({ name: permission })
          )
        )
      );

      // Should be faster than sequential queries due to lazy creation
      const expectedTime = PERFORMANCE_THRESHOLDS.PERMISSION_QUERY_TIME * queryCount / 10;
      expect(duration).toBeLessThan(expectedTime);
    });

    it('should demonstrate lazy creation efficiency', async () => {
      // First query for a permission (creates instance)
      const { duration: firstQueryDuration } = await measureTime(() =>
        navigator.permissions.query({ name: 'camera' })
      );

      // Subsequent queries for same permission (reuses instance)
      const { duration: secondQueryDuration } = await measureTime(() =>
        navigator.permissions.query({ name: 'camera' })
      );

      // Second query should be significantly faster
      expect(secondQueryDuration).toBeLessThan(firstQueryDuration / 2);
      expect(secondQueryDuration).toBeLessThan(1); // Very fast reuse
    });

    it('should handle complex permission descriptors efficiently', async () => {
      const complexDescriptor = {
        name: 'geolocation' as const,
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 300000,
        testMetadata: {
          testId: 'perf-test-001',
          scenario: 'high-accuracy-location',
          expectedBehavior: {
            shouldPrompt: true,
            accuracy: 'high',
            timeout: 5000,
          },
        },
      };

      const { duration } = await measureTime(() =>
        navigator.permissions.query(complexDescriptor)
      );

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PERMISSION_QUERY_TIME * 2);
    });
  });

  describe('State Management Performance', () => {
    let handle: MockPermissionHandle;

    beforeEach(() => {
      handle = mockPermissions();
    });

    afterEach(() => {
      handle.restore();
    });

    it('should change states quickly', async () => {
      const { duration } = await measureTime(() => {
        handle.setState('notifications', 'granted');
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.STATE_CHANGE_TIME);
    });

    it('should handle rapid state changes efficiently', async () => {
      const changeCount = 100;
      const states: PermissionState[] = ['granted', 'denied', 'prompt'];

      const { duration } = await measureTime(() => {
        for (let i = 0; i < changeCount; i++) {
          const state = states[i % states.length];
          handle.setState('camera', state);
        }
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME);
    });

    it('should handle bulk state operations efficiently', async () => {
      const permissions = createSamplePermissions(50);
      const bulkStates: Partial<Record<PermissionName, PermissionState>> = {};

      permissions.forEach((permission, index) => {
        const state: PermissionState = index % 3 === 0 ? 'granted' :
                                      index % 3 === 1 ? 'denied' : 'prompt';
        bulkStates[permission] = state;
      });

      const { duration } = await measureTime(() => {
        handle.setStates(bulkStates);
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME);
    });

    it('should retrieve states quickly', async () => {
      // Set up some states first
      handle.setStates({
        notifications: 'granted',
        geolocation: 'denied',
        camera: 'prompt',
      });

      const { duration } = await measureTime(() => {
        const states = handle.getStates();
        return states;
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.STATE_CHANGE_TIME);
    });
  });

  describe('Event Handling Performance', () => {
    let handle: MockPermissionHandle;
    let status: MockPermissionStatus;

    beforeEach(async () => {
      handle = mockPermissions();
      status = await navigator.permissions.query({ name: 'notifications' });
    });

    afterEach(() => {
      handle.restore();
    });

    it('should dispatch events quickly', async () => {
      const eventHandler = vi.fn();
      status.addEventListener('change', eventHandler);

      const { duration } = await measureTime(() => {
        status.setState('granted');
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.EVENT_HANDLING_TIME * 2);
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle many event listeners efficiently', async () => {
      const listenerCount = 50;
      const eventHandlers = Array.from({ length: listenerCount }, () => vi.fn());

      // Add all listeners
      const { duration: addListenersDuration } = await measureTime(() => {
        eventHandlers.forEach((handler) => {
          status.addEventListener('change', handler);
        });
      });

      expect(addListenersDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.EVENT_HANDLING_TIME * listenerCount);

      // Trigger event and measure
      const { duration: eventDuration } = await measureTime(() => {
        status.setState('granted');
      });

      expect(eventDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.EVENT_HANDLING_TIME * listenerCount);
      eventHandlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle rapid event sequences efficiently', async () => {
      const eventHistory: PermissionState[] = [];
      status.addEventListener('change', () => {
        eventHistory.push(status.state);
      });

      const states: PermissionState[] = Array.from({ length: 20 }, (_, i) =>
        i % 3 === 0 ? 'granted' : i % 3 === 1 ? 'denied' : 'prompt'
      );

      const { duration } = await measureTime(async () => {
        for (const state of states) {
          status.setState(state);
          // Small delay to ensure events are processed
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.EVENT_HANDLING_TIME * states.length * 10);
      expect(eventHistory).toEqual(states);
    });
  });

  describe('Memory Management Performance', () => {
    it('should clean up resources quickly on restore', async () => {
      // Create handle with many initial states
      const largeInitialStates: Partial<Record<PermissionName, PermissionState>> = {};
      const permissions = createSamplePermissions(30);

      permissions.forEach((permission) => {
        largeInitialStates[permission] = 'granted';
      });

      const handle = mockPermissions({ initialStates: largeInitialStates });

      // Create many permission status instances
      await Promise.all(
        permissions.map((permission) =>
          navigator.permissions.query({ name: permission })
        )
      );

      const { duration } = await measureTime(() => {
        handle.restore();
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_CLEANUP_TIME);
    });

    it('should handle memory efficiently with withMockedPermissions', async () => {
      const iterationCount = 20;

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < iterationCount; i++) {
          await withMockedPermissions(
            { initialStates: { camera: 'granted' } },
            async () => {
              const status = await navigator.permissions.query({ name: 'camera' });
              return status.state;
            }
          );
        }
      });

      // Should complete all iterations within reasonable time
      const expectedTime = PERFORMANCE_THRESHOLDS.MOCK_CREATION_TIME * iterationCount * 2;
      expect(duration).toBeLessThan(expectedTime);
    });
  });

  describe('Stress Testing', () => {
    it('should handle extreme concurrent operations', async () => {
      const handle = mockPermissions();
      const operationCount = 200;

      const { duration } = await measureTime(async () => {
        // Mix of different operations running concurrently
        const operations = Array.from({ length: operationCount }, async (_, i) => {
          const permission = createSamplePermissions(1)[0];
          const state: PermissionState = i % 3 === 0 ? 'granted' :
                                        i % 3 === 1 ? 'denied' : 'prompt';

          switch (i % 4) {
            case 0:
              // Query permission
              return navigator.permissions.query({ name: permission });
            case 1:
              // Set state
              handle.setState(permission, state);
              return handle.getState(permission);
            case 2:
              // Bulk operation
              handle.setStates({ [permission]: state });
              return handle.getStates();
            case 3:
              // Get current state
              return handle.getState(permission);
          }
        });

        await Promise.all(operations);
      });

      // Should complete within reasonable time even under stress
      expect(duration).toBeLessThan(1000); // 1 second max

      handle.restore();
    });

    it('should maintain performance with many permission instances', async () => {
      const handle = mockPermissions();
      const instanceCount = 100;

      const { duration } = await measureTime(async () => {
        // Create many unique permission combinations
        const promises = Array.from({ length: instanceCount }, async (i) => {
          const permission = createSamplePermissions(8)[i % 8]; // Use 8 different permissions
          const status = await navigator.permissions.query({
            name: permission,
            testMetadata: { testId: `stress-test-${i}` },
          });

          // Perform some operations on each
          status.setState(i % 2 === 0 ? 'granted' : 'denied');
          return status.getState();
        });

        await Promise.all(promises);
      });

      // Should scale reasonably well
      expect(duration).toBeLessThan(500); // 500ms max for 100 instances

      handle.restore();
    });

    it('should handle memory pressure scenarios', async () => {
      // Test creating and destroying many mocks rapidly
      const cycleCount = 10;

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < cycleCount; i++) {
          await withMockedPermissions(
            {
              initialStates: {
                notifications: 'granted',
                geolocation: 'denied',
                camera: 'prompt',
                microphone: 'granted',
              },
            },
            async (handle) => {
              // Create many status instances
              const statuses = await Promise.all([
                navigator.permissions.query({ name: 'notifications' }),
                navigator.permissions.query({ name: 'geolocation' }),
                navigator.permissions.query({ name: 'camera' }),
                navigator.permissions.query({ name: 'microphone' }),
              ]);

              // Perform operations on all
              statuses.forEach((status, index) => {
                const newState: PermissionState = index % 2 === 0 ? 'denied' : 'granted';
                status.setState(newState);
              });

              return statuses.map((s) => s.state);
            }
          );
        }
      });

      // Should handle repeated cycles efficiently
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MOCK_CREATION_TIME * cycleCount * 10);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across multiple test runs', async () => {
      const runCount = 5;
      const durations: number[] = [];

      for (let i = 0; i < runCount; i++) {
        const { duration } = await measureTime(async () => {
          const handle = mockPermissions({
            initialStates: { notifications: 'granted' },
          });

          const status = await navigator.permissions.query({ name: 'notifications' });
          status.setState('denied');
          status.setState('granted');
          handle.setState('camera', 'prompt');

          const states = handle.getStates();
          handle.restore();

          return states;
        });

        durations.push(duration);
      }

      // Durations should be consistent (no significant performance regression)
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      // Variance should be small (less than 50% of min duration)
      expect(variance).toBeLessThan(minDuration * 0.5);
    });

    it('should maintain performance with growing complexity', async () => {
      const complexities = [1, 5, 10, 25];
      const durations: number[] = [];

      for (const complexity of complexities) {
        const permissions = createSamplePermissions(complexity);
        const initialStates: Partial<Record<PermissionName, PermissionState>> = {};

        permissions.forEach((permission) => {
          initialStates[permission] = 'granted';
        });

        const { duration } = await measureTime(async () => {
          const handle = mockPermissions({ initialStates });

          await Promise.all(
            permissions.map((permission) =>
              navigator.permissions.query({ name: permission })
            )
          );

          handle.restore();
        });

        durations.push(duration);
      }

      // Performance should scale reasonably (not exponentially)
      // Each step shouldn't be more than 3x the previous
      for (let i = 1; i < durations.length; i++) {
        const scaleFactor = durations[i] / durations[i - 1];
        expect(scaleFactor).toBeLessThan(3);
      }
    });
  });
});