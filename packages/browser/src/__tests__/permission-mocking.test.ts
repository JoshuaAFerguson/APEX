/**
 * @apexcli/browser - Permission Mocking Tests
 *
 * Comprehensive tests for browser Permission API mocking utilities
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

describe('Permission Mocking', () => {
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

  describe('mockPermissions', () => {
    it('should create a mock handle and activate mocking', () => {
      const handle = mockPermissions();

      expect(handle).toBeDefined();
      expect(handle.isActive).toBe(true);
      expect(isPermissionsMocked()).toBe(true);

      handle.restore();
    });

    it('should apply initial permission states', () => {
      const handle = mockPermissions({
        initialStates: {
          notifications: 'granted',
          geolocation: 'denied',
        },
      });

      expect(handle.getState('notifications')).toBe('granted');
      expect(handle.getState('geolocation')).toBe('denied');
      expect(handle.getState('camera')).toBe('prompt'); // default state

      handle.restore();
    });

    it('should use custom default state', () => {
      const handle = mockPermissions({
        defaultState: 'denied',
      });

      expect(handle.getState('microphone')).toBe('denied');

      handle.restore();
    });

    it('should enable logging when configured', () => {
      const logSpy = vi.fn();
      const handle = mockPermissions({
        enableLogging: true,
        logger: logSpy,
      });

      expect(logSpy).toHaveBeenCalledWith(
        'Permission mocking activated',
        expect.any(Object)
      );

      handle.restore();
    });
  });

  describe('MockPermissionHandle', () => {
    let handle: MockPermissionHandle;

    beforeEach(() => {
      handle = mockPermissions();
    });

    afterEach(() => {
      handle.restore();
    });

    describe('setState/getState', () => {
      it('should set and get permission states', () => {
        handle.setState('notifications', 'granted');
        expect(handle.getState('notifications')).toBe('granted');

        handle.setState('notifications', 'denied');
        expect(handle.getState('notifications')).toBe('denied');
      });

      it('should handle multiple permission states', () => {
        const states: Record<PermissionName, PermissionState> = {
          notifications: 'granted',
          geolocation: 'denied',
          camera: 'prompt',
        };

        handle.setStates(states);

        expect(handle.getState('notifications')).toBe('granted');
        expect(handle.getState('geolocation')).toBe('denied');
        expect(handle.getState('camera')).toBe('prompt');
      });

      it('should return all current states', () => {
        handle.setState('notifications', 'granted');
        handle.setState('geolocation', 'denied');

        const states = handle.getStates();

        expect(states.notifications).toBe('granted');
        expect(states.geolocation).toBe('denied');
      });
    });

    describe('restore', () => {
      it('should restore original navigator.permissions', () => {
        const originalPermissions = navigator.permissions;

        expect(isPermissionsMocked()).toBe(true);
        handle.restore();

        expect(isPermissionsMocked()).toBe(false);
        expect(handle.isActive).toBe(false);
      });

      it('should prevent state changes after restoration', () => {
        handle.restore();

        expect(() => {
          handle.setState('notifications', 'granted');
        }).toThrow('MockPermissions: Cannot set state after mock has been restored');
      });

      it('should be safe to call multiple times', () => {
        handle.restore();
        handle.restore(); // Should not throw

        expect(handle.isActive).toBe(false);
      });
    });

    describe('config access', () => {
      it('should provide readonly access to configuration', () => {
        const config = handle.config;

        expect(config).toMatchObject({
          initialStates: {},
          autoRestore: true,
          defaultState: 'prompt',
          enableLogging: false,
        });

        // Should be readonly
        expect(() => {
          (config as any).defaultState = 'granted';
        }).not.toThrow(); // Assignment doesn't throw but shouldn't affect original

        expect(handle.config.defaultState).toBe('prompt');
      });
    });
  });

  describe('navigator.permissions.query', () => {
    let handle: MockPermissionHandle;

    beforeEach(() => {
      handle = mockPermissions({
        initialStates: {
          notifications: 'granted',
        },
      });
    });

    afterEach(() => {
      handle.restore();
    });

    it('should return MockPermissionStatus instances', async () => {
      const status = await navigator.permissions.query({ name: 'notifications' });

      expect(status).toBeInstanceOf(MockPermissionStatus);
      expect(status.isMock).toBe(true);
      expect(status.name).toBe('notifications');
      expect(status.state).toBe('granted');
    });

    it('should create permission status lazily', async () => {
      // Camera not in initial states
      const status = await navigator.permissions.query({ name: 'camera' });

      expect(status.state).toBe('prompt'); // default state
      expect(status.name).toBe('camera');
    });

    it('should maintain same instance for repeated queries', async () => {
      const status1 = await navigator.permissions.query({ name: 'notifications' });
      const status2 = await navigator.permissions.query({ name: 'notifications' });

      expect(status1).toBe(status2);
    });

    it('should handle test metadata', async () => {
      const status = await navigator.permissions.query({
        name: 'geolocation',
        testMetadata: {
          testId: 'test-123',
          scenario: 'user-grants-permission',
        },
      });

      expect(status.testMetadata).toEqual({
        testId: 'test-123',
        scenario: 'user-grants-permission',
      });
    });
  });

  describe('MockPermissionStatus', () => {
    let handle: MockPermissionHandle;
    let status: MockPermissionStatus;

    beforeEach(async () => {
      handle = mockPermissions();
      status = await navigator.permissions.query({ name: 'notifications' });
    });

    afterEach(() => {
      handle.restore();
    });

    describe('state management', () => {
      it('should have initial state properties', () => {
        expect(status.state).toBe('prompt');
        expect(status.name).toBe('notifications');
        expect(status.isMock).toBe(true);
        expect(status.onchange).toBeNull();
      });

      it('should allow state changes via setState', () => {
        status.setState('granted');
        expect(status.state).toBe('granted');

        status.setState('denied');
        expect(status.state).toBe('denied');
      });

      it('should provide getState method', () => {
        status.setState('granted');
        expect(status.getState()).toBe('granted');
      });

      it('should reset to prompt state', () => {
        status.setState('granted');
        status.reset();
        expect(status.state).toBe('prompt');
      });
    });

    describe('event handling', () => {
      it('should dispatch change events on state changes', () => {
        const changeHandler = vi.fn();
        status.addEventListener('change', changeHandler);

        status.setState('granted');

        expect(changeHandler).toHaveBeenCalledTimes(1);
        expect(changeHandler).toHaveBeenCalledWith(expect.any(Event));
      });

      it('should not dispatch events for same state', () => {
        const changeHandler = vi.fn();
        status.addEventListener('change', changeHandler);

        status.setState('prompt'); // Same as initial state
        expect(changeHandler).not.toHaveBeenCalled();

        status.setState('granted');
        status.setState('granted'); // Same state again
        expect(changeHandler).toHaveBeenCalledTimes(1);
      });

      it('should support onchange property handler', () => {
        const changeHandler = vi.fn();
        status.onchange = changeHandler;

        status.setState('granted');

        expect(changeHandler).toHaveBeenCalledTimes(1);
      });

      it('should remove previous onchange handler when setting new one', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        status.onchange = handler1;
        status.onchange = handler2;

        status.setState('granted');

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      it('should remove handler when setting onchange to null', () => {
        const handler = vi.fn();

        status.onchange = handler;
        status.onchange = null;

        status.setState('granted');

        expect(handler).not.toHaveBeenCalled();
      });

      it('should support removeEventListener', () => {
        const handler = vi.fn();

        status.addEventListener('change', handler);
        status.setState('granted');
        expect(handler).toHaveBeenCalledTimes(1);

        status.removeEventListener('change', handler);
        status.setState('denied');
        expect(handler).toHaveBeenCalledTimes(1); // No additional calls
      });
    });

    describe('utility methods', () => {
      it('should provide toString representation', () => {
        const str = status.toString();
        expect(str).toBe('MockPermissionStatus { name: "notifications", state: "prompt" }');
      });

      it('should provide JSON representation', () => {
        const json = status.toJSON();
        expect(json).toEqual({
          name: 'notifications',
          state: 'prompt',
          isMock: true,
          testMetadata: undefined,
        });
      });

      it('should handle test metadata in JSON', async () => {
        const statusWithMeta = await navigator.permissions.query({
          name: 'camera',
          testMetadata: { testId: 'test-456' },
        });

        const json = statusWithMeta.toJSON();
        expect(json.testMetadata).toEqual({ testId: 'test-456' });
      });
    });
  });

  describe('utility functions', () => {
    describe('isPermissionsMocked', () => {
      it('should return false when not mocked', () => {
        expect(isPermissionsMocked()).toBe(false);
      });

      it('should return true when mocked', () => {
        const handle = mockPermissions();
        expect(isPermissionsMocked()).toBe(true);
        handle.restore();
      });
    });

    describe('getCurrentMockHandle', () => {
      it('should return null when not mocked', () => {
        expect(getCurrentMockHandle()).toBeNull();
      });

      it('should return active handle when mocked', () => {
        const handle = mockPermissions();
        const currentHandle = getCurrentMockHandle();

        expect(currentHandle).toBe(handle);
        expect(currentHandle?.isActive).toBe(true);

        handle.restore();
      });
    });

    describe('withMockedPermissions', () => {
      it('should automatically restore after function completes', async () => {
        const result = await withMockedPermissions(
          { initialStates: { notifications: 'granted' } },
          async (handle) => {
            expect(isPermissionsMocked()).toBe(true);
            return handle.getState('notifications');
          }
        );

        expect(result).toBe('granted');
        expect(isPermissionsMocked()).toBe(false);
      });

      it('should restore even if function throws', async () => {
        const error = new Error('Test error');

        await expect(
          withMockedPermissions(
            {},
            async () => {
              expect(isPermissionsMocked()).toBe(true);
              throw error;
            }
          )
        ).rejects.toThrow('Test error');

        expect(isPermissionsMocked()).toBe(false);
      });

      it('should work with synchronous functions', async () => {
        const result = await withMockedPermissions(
          { defaultState: 'denied' },
          (handle) => {
            return handle.getState('microphone');
          }
        );

        expect(result).toBe('denied');
        expect(isPermissionsMocked()).toBe(false);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle permission request flow simulation', async () => {
      const handle = mockPermissions({
        initialStates: { notifications: 'prompt' },
      });

      // Initial query
      const status = await navigator.permissions.query({ name: 'notifications' });
      expect(status.state).toBe('prompt');

      // Simulate user granting permission
      const eventFired = new Promise<void>((resolve) => {
        status.onchange = () => resolve();
      });

      handle.setState('notifications', 'granted');
      await eventFired;

      expect(status.state).toBe('granted');

      handle.restore();
    });

    it('should support multiple permission workflows', async () => {
      const handle = mockPermissions();

      // Set up different permissions
      const permissions: Array<{ name: PermissionName; state: PermissionState }> = [
        { name: 'notifications', state: 'granted' },
        { name: 'geolocation', state: 'denied' },
        { name: 'camera', state: 'prompt' },
      ];

      const statuses = await Promise.all(
        permissions.map(({ name }) => navigator.permissions.query({ name }))
      );

      // Apply states
      permissions.forEach(({ name, state }) => {
        handle.setState(name, state);
      });

      // Verify all states
      statuses.forEach((status, index) => {
        expect(status.state).toBe(permissions[index].state);
      });

      handle.restore();
    });

    it('should maintain state consistency across queries', async () => {
      const handle = mockPermissions();

      handle.setState('microphone', 'granted');

      const status1 = await navigator.permissions.query({ name: 'microphone' });
      const status2 = await navigator.permissions.query({ name: 'microphone' });

      expect(status1.state).toBe('granted');
      expect(status2.state).toBe('granted');
      expect(status1).toBe(status2); // Same instance

      handle.restore();
    });
  });

  describe('error handling', () => {
    it('should throw error in non-browser environment', () => {
      const originalNavigator = globalThis.navigator;
      delete (globalThis as any).navigator;

      expect(() => {
        mockPermissions();
      }).toThrow('MockPermissions: navigator is not available (not in browser environment)');

      // Restore navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('should handle edge cases in state setting', () => {
      const handle = mockPermissions();

      // Should not throw for valid states
      expect(() => {
        handle.setState('notifications', 'granted');
        handle.setState('notifications', 'denied');
        handle.setState('notifications', 'prompt');
      }).not.toThrow();

      handle.restore();
    });
  });
});