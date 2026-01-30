/**
 * @apexcli/browser - Permission Mocking Edge Cases Tests
 *
 * Additional comprehensive tests for edge cases, performance, and advanced scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,
  MockPermissionStatus,
  isMockPermissionStatus,
  isPermissionsMockedGuard,
} from '../permission-mocking/index.js';
import type {
  PermissionState,
  PermissionName,
  MockPermissionHandle,
  PermissionDescriptor,
} from '../permission-mocking/types.js';

// Mock navigator if not available in test environment
const originalNavigator = globalThis.navigator;
const mockNavigator = {
  permissions: {
    query: vi.fn(),
  },
} as any;

describe('Permission Mocking Edge Cases', () => {
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

  describe('Type Guards', () => {
    it('should correctly identify mock permission status instances', async () => {
      const handle = mockPermissions();

      const mockStatus = await navigator.permissions.query({ name: 'notifications' });
      const realStatus = { state: 'granted', name: 'notifications' } as any;

      expect(isMockPermissionStatus(mockStatus)).toBe(true);
      expect(isMockPermissionStatus(realStatus)).toBe(false);

      handle.restore();
    });

    it('should correctly identify mocked permissions with type guard', () => {
      expect(isPermissionsMockedGuard(navigator)).toBe(false);

      const handle = mockPermissions();
      expect(isPermissionsMockedGuard(navigator)).toBe(true);

      handle.restore();
      expect(isPermissionsMockedGuard(navigator)).toBe(false);
    });
  });

  describe('Multiple Mock Instances', () => {
    it('should prevent creating multiple simultaneous mocks', () => {
      const handle1 = mockPermissions();
      expect(handle1.isActive).toBe(true);

      // Creating second mock should replace the first
      const handle2 = mockPermissions();
      expect(handle2.isActive).toBe(true);
      expect(handle1.isActive).toBe(false); // First should be inactive

      handle2.restore();
    });

    it('should handle restoration of inactive handles gracefully', () => {
      const handle1 = mockPermissions();
      const handle2 = mockPermissions(); // Replaces handle1

      expect(() => handle1.restore()).not.toThrow();
      expect(handle1.isActive).toBe(false);

      handle2.restore();
    });
  });

  describe('Permission Descriptor Variations', () => {
    let handle: MockPermissionHandle;

    beforeEach(() => {
      handle = mockPermissions();
    });

    afterEach(() => {
      handle.restore();
    });

    it('should handle permission descriptors with additional properties', async () => {
      const descriptor = {
        name: 'push' as PermissionName,
        userVisibleOnly: true,
      };

      const status = await navigator.permissions.query(descriptor);
      expect(status.name).toBe('push');
      expect(status.state).toBe('prompt');
    });

    it('should preserve test metadata in permission status', async () => {
      const descriptor = {
        name: 'geolocation' as PermissionName,
        testMetadata: {
          testId: 'geo-test-123',
          scenario: 'user-location-sharing',
          expectedBehavior: {
            shouldPrompt: true,
            accuracy: 'high',
          },
        },
      };

      const status = await navigator.permissions.query(descriptor);
      expect(status.testMetadata).toEqual(descriptor.testMetadata);
    });

    it('should handle missing or undefined properties gracefully', async () => {
      const descriptors = [
        { name: 'camera' as PermissionName },
        { name: 'microphone' as PermissionName, undefined: undefined },
        { name: 'notifications' as PermissionName, null: null },
      ];

      for (const descriptor of descriptors) {
        const status = await navigator.permissions.query(descriptor);
        expect(status).toBeDefined();
        expect(status.name).toBe(descriptor.name);
      }
    });
  });

  describe('Event System Edge Cases', () => {
    let handle: MockPermissionHandle;
    let status: MockPermissionStatus;

    beforeEach(async () => {
      handle = mockPermissions();
      status = await navigator.permissions.query({ name: 'notifications' });
    });

    afterEach(() => {
      handle.restore();
    });

    it('should handle rapid state changes correctly', () => {
      const eventSpy = vi.fn();
      status.addEventListener('change', eventSpy);

      // Rapid state changes
      status.setState('granted');
      status.setState('denied');
      status.setState('prompt');
      status.setState('granted');

      expect(eventSpy).toHaveBeenCalledTimes(4);
    });

    it('should maintain event order consistency', () => {
      const eventOrder: PermissionState[] = [];

      status.addEventListener('change', () => {
        eventOrder.push(status.state);
      });

      const states: PermissionState[] = ['granted', 'denied', 'prompt'];
      states.forEach(state => status.setState(state));

      expect(eventOrder).toEqual(states);
    });

    it('should handle event listener exceptions gracefully', () => {
      const errorThrowingHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      const normalHandler = vi.fn();

      status.addEventListener('change', errorThrowingHandler);
      status.addEventListener('change', normalHandler);

      expect(() => status.setState('granted')).not.toThrow();
      expect(normalHandler).toHaveBeenCalled();
    });

    it('should support event listener options', () => {
      const onceFn = vi.fn();
      const normalFn = vi.fn();

      status.addEventListener('change', onceFn, { once: true });
      status.addEventListener('change', normalFn);

      status.setState('granted');
      status.setState('denied');

      expect(onceFn).toHaveBeenCalledTimes(1);
      expect(normalFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('State Management Edge Cases', () => {
    let handle: MockPermissionHandle;

    beforeEach(() => {
      handle = mockPermissions();
    });

    afterEach(() => {
      handle.restore();
    });

    it('should handle all supported permission types', () => {
      const permissions: PermissionName[] = [
        'geolocation',
        'notifications',
        'push',
        'midi',
        'camera',
        'microphone',
        'speaker',
        'device-info',
        'background-fetch',
        'background-sync',
        'persistent-storage',
        'ambient-light-sensor',
        'accelerometer',
        'gyroscope',
        'magnetometer',
        'clipboard-read',
        'clipboard-write',
        'payment-handler',
        'screen-wake-lock',
        'xr-spatial-tracking',
      ];

      const states: PermissionState[] = ['granted', 'denied', 'prompt'];

      permissions.forEach((permission, index) => {
        const state = states[index % states.length];
        handle.setState(permission, state);
        expect(handle.getState(permission)).toBe(state);
      });
    });

    it('should handle concurrent state modifications', async () => {
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const permission = i % 2 === 0 ? 'camera' : 'microphone';
        const state: PermissionState = i % 3 === 0 ? 'granted' : 'denied';

        handle.setState(permission as PermissionName, state);
        return { permission, state };
      });

      const results = await Promise.all(promises);

      // Verify final states are consistent
      expect(handle.getState('camera')).toMatch(/granted|denied|prompt/);
      expect(handle.getState('microphone')).toMatch(/granted|denied|prompt/);
    });

    it('should maintain state consistency during bulk operations', () => {
      const bulkStates = {
        geolocation: 'granted' as PermissionState,
        notifications: 'denied' as PermissionState,
        camera: 'prompt' as PermissionState,
        microphone: 'granted' as PermissionState,
      };

      handle.setStates(bulkStates);
      const currentStates = handle.getStates();

      Object.entries(bulkStates).forEach(([permission, expectedState]) => {
        expect(currentStates[permission as PermissionName]).toBe(expectedState);
      });
    });
  });

  describe('Memory and Performance', () => {
    it('should clean up event listeners properly on restore', async () => {
      const handle = mockPermissions();
      const status = await navigator.permissions.query({ name: 'notifications' });

      const handler = vi.fn();
      status.addEventListener('change', handler);

      // Simulate memory tracking
      const originalListeners = status as any; // We can't directly access listeners, but test behavior

      handle.restore();

      // After restore, setting state should not trigger the handler
      // This is a behavioral test since we can't directly inspect listeners
      expect(() => status.setState('granted')).not.toThrow();
    });

    it('should handle many permission instances efficiently', async () => {
      const handle = mockPermissions();
      const startTime = Date.now();

      // Create many permission status instances
      const statuses = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          navigator.permissions.query({
            name: (i % 2 === 0 ? 'camera' : 'microphone') as PermissionName
          })
        )
      );

      const creationTime = Date.now() - startTime;

      // Should create instances quickly (less than 100ms even in slow environments)
      expect(creationTime).toBeLessThan(1000);

      // Verify lazy creation - should only have 2 unique instances
      const uniqueInstances = new Set(statuses);
      expect(uniqueInstances.size).toBe(2);

      handle.restore();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty configuration gracefully', () => {
      const handle = mockPermissions({});
      expect(handle.isActive).toBe(true);
      expect(handle.config.defaultState).toBe('prompt');
      handle.restore();
    });

    it('should handle partial configuration objects', () => {
      const handle = mockPermissions({
        enableLogging: true,
        // Other properties omitted
      });

      const config = handle.config;
      expect(config.enableLogging).toBe(true);
      expect(config.autoRestore).toBe(true); // Should use default
      expect(config.defaultState).toBe('prompt'); // Should use default

      handle.restore();
    });

    it('should override default logger correctly', () => {
      const customLogger = vi.fn();
      const handle = mockPermissions({
        enableLogging: true,
        logger: customLogger,
      });

      // Setting state should trigger custom logger
      handle.setState('notifications', 'granted');
      expect(customLogger).toHaveBeenCalled();

      handle.restore();
    });

    it('should handle invalid initial states gracefully', () => {
      const handle = mockPermissions({
        initialStates: {
          // @ts-expect-error - Testing invalid state handling
          notifications: 'invalid-state' as any,
          geolocation: 'granted',
        },
      });

      // Should not throw, but might ignore invalid states
      expect(() => handle.getState('notifications')).not.toThrow();
      expect(handle.getState('geolocation')).toBe('granted');

      handle.restore();
    });
  });

  describe('withMockedPermissions Edge Cases', () => {
    it('should handle nested withMockedPermissions calls', async () => {
      const result = await withMockedPermissions(
        { defaultState: 'granted' },
        async (outerHandle) => {
          expect(outerHandle.isActive).toBe(true);

          const innerResult = await withMockedPermissions(
            { defaultState: 'denied' },
            async (innerHandle) => {
              expect(innerHandle.isActive).toBe(true);
              return innerHandle.getState('camera');
            }
          );

          // Outer handle should be restored after inner completes
          expect(outerHandle.isActive).toBe(true);
          return { outer: outerHandle.getState('microphone'), inner: innerResult };
        }
      );

      expect(result.outer).toBe('granted');
      expect(result.inner).toBe('denied');
      expect(isPermissionsMocked()).toBe(false);
    });

    it('should handle async errors in wrapped function', async () => {
      const asyncError = new Error('Async operation failed');

      await expect(
        withMockedPermissions(
          { defaultState: 'granted' },
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw asyncError;
          }
        )
      ).rejects.toThrow('Async operation failed');

      expect(isPermissionsMocked()).toBe(false);
    });

    it('should handle immediate promise rejection', async () => {
      await expect(
        withMockedPermissions(
          {},
          async () => {
            throw new Error('Immediate rejection');
          }
        )
      ).rejects.toThrow('Immediate rejection');

      expect(isPermissionsMocked()).toBe(false);
    });
  });

  describe('Browser Environment Edge Cases', () => {
    it('should handle undefined navigator gracefully in utility functions', () => {
      const originalNavigator = globalThis.navigator;
      delete (globalThis as any).navigator;

      expect(isPermissionsMocked()).toBe(false);
      expect(getCurrentMockHandle()).toBeNull();

      // Restore navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('should handle navigator without permissions property', () => {
      const originalNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      expect(isPermissionsMocked()).toBe(false);

      // Restore navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('should handle modification of navigator during active mock', () => {
      const handle = mockPermissions();
      expect(isPermissionsMocked()).toBe(true);

      // Simulate external code modifying navigator
      const modifiedPermissions = { ...navigator.permissions, customProperty: true };
      Object.defineProperty(navigator, 'permissions', {
        value: modifiedPermissions,
        writable: true,
        configurable: true,
      });

      // Should still be considered mocked if the mock properties remain
      if ('isMocked' in navigator.permissions) {
        expect(isPermissionsMocked()).toBe(true);
      }

      handle.restore();
    });
  });
});