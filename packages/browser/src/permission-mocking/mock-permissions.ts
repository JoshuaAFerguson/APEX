/**
 * @apexcli/browser - Mock Permissions Factory
 *
 * Factory function and utilities for mocking the browser's Permissions API
 * with lazy creation and handle-based management
 */

import { MockPermissionStatusImpl } from './mock-permission-status.js';
import type {
  PermissionState,
  PermissionName,
  PermissionDescriptor,
  MockPermissionDescriptor,
  MockPermissionConfig,
  MockPermissionHandle,
  MockPermissionStatus,
  NavigatorWithMockedPermissions,
} from './types.js';

/**
 * Default configuration for permission mocking
 */
const DEFAULT_CONFIG: Required<MockPermissionConfig> = {
  initialStates: {},
  autoRestore: true,
  defaultState: 'prompt',
  enableLogging: false,
  logger: (message: string, data?: any) => {
    if (typeof console !== 'undefined') {
      console.debug('[MockPermissions]', message, data || '');
    }
  },
};

/**
 * Internal implementation of the MockPermissionHandle
 */
class MockPermissionHandleImpl implements MockPermissionHandle {
  private _config: Required<MockPermissionConfig>;
  private _originalPermissions: Navigator['permissions'] | null = null;
  private _permissionInstances = new Map<PermissionName, MockPermissionStatusImpl>();
  private _isActive = false;

  constructor(config: MockPermissionConfig) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._setupMocking();
  }

  /**
   * Set up the permission mocking by replacing navigator.permissions
   */
  private _setupMocking(): void {
    if (typeof navigator === 'undefined') {
      throw new Error('MockPermissions: navigator is not available (not in browser environment)');
    }

    // Store the original permissions API for restoration
    this._originalPermissions = navigator.permissions;

    // Create the mocked permissions object
    const mockedPermissions = {
      query: this._createQueryFunction(),
      isMocked: true as const,
      _original: this._originalPermissions,
      _mockHandle: this,
    };

    // Replace navigator.permissions with our mock
    Object.defineProperty(navigator, 'permissions', {
      value: mockedPermissions,
      writable: true,
      configurable: true,
    });

    this._isActive = true;

    if (this._config.enableLogging) {
      this._config.logger('Permission mocking activated', {
        initialStates: this._config.initialStates,
        defaultState: this._config.defaultState,
      });
    }
  }

  /**
   * Creates the mocked query function that returns MockPermissionStatus instances
   */
  private _createQueryFunction() {
    return async (descriptor: PermissionDescriptor | MockPermissionDescriptor): Promise<MockPermissionStatus> => {
      const { name } = descriptor;

      // Lazy creation: only create permission status when queried
      if (!this._permissionInstances.has(name)) {
        const initialState = this._config.initialStates[name] || this._config.defaultState;
        const testMetadata = 'testMetadata' in descriptor ? descriptor.testMetadata : undefined;

        const permissionStatus = new MockPermissionStatusImpl(name, initialState, testMetadata);
        this._permissionInstances.set(name, permissionStatus);

        if (this._config.enableLogging) {
          this._config.logger(`Created permission status for "${name}"`, { state: initialState });
        }
      }

      return this._permissionInstances.get(name)!;
    };
  }

  /**
   * Set the state of a specific permission
   */
  setState(permission: PermissionName, state: PermissionState): void {
    if (!this._isActive) {
      throw new Error('MockPermissions: Cannot set state after mock has been restored');
    }

    // Create permission instance if it doesn't exist
    if (!this._permissionInstances.has(permission)) {
      const permissionStatus = new MockPermissionStatusImpl(permission, state);
      this._permissionInstances.set(permission, permissionStatus);
    } else {
      this._permissionInstances.get(permission)!.setState(state);
    }

    if (this._config.enableLogging) {
      this._config.logger(`Set permission state for "${permission}"`, { state });
    }
  }

  /**
   * Get the current state of a permission
   */
  getState(permission: PermissionName): PermissionState {
    const instance = this._permissionInstances.get(permission);
    if (instance) {
      return instance.getState();
    }

    // Return default state if permission hasn't been queried yet
    return this._config.initialStates[permission] || this._config.defaultState;
  }

  /**
   * Set states for multiple permissions at once
   */
  setStates(states: Partial<Record<PermissionName, PermissionState>>): void {
    for (const [permission, state] of Object.entries(states)) {
      if (state) {
        this.setState(permission as PermissionName, state);
      }
    }
  }

  /**
   * Get all current permission states
   */
  getStates(): Partial<Record<PermissionName, PermissionState>> {
    const states: Partial<Record<PermissionName, PermissionState>> = {};

    // Include states from created instances
    for (const [name, instance] of this._permissionInstances) {
      states[name] = instance.getState();
    }

    // Include initial states for permissions that haven't been queried yet
    for (const [name, state] of Object.entries(this._config.initialStates)) {
      if (!(name in states)) {
        states[name as PermissionName] = state;
      }
    }

    return states;
  }

  /**
   * Restore the original navigator.permissions implementation
   */
  restore(): void {
    if (!this._isActive) {
      return; // Already restored
    }

    if (typeof navigator !== 'undefined' && this._originalPermissions) {
      Object.defineProperty(navigator, 'permissions', {
        value: this._originalPermissions,
        writable: true,
        configurable: true,
      });
    }

    // Clear permission instances
    this._permissionInstances.clear();
    this._isActive = false;

    if (this._config.enableLogging) {
      this._config.logger('Permission mocking restored');
    }
  }

  /**
   * Check if the mock is currently active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get access to the mock configuration
   */
  get config(): Readonly<Required<MockPermissionConfig>> {
    return { ...this._config };
  }
}

/**
 * Creates and activates permission mocking with the specified configuration
 *
 * This function replaces the browser's native `navigator.permissions` API with a
 * mock implementation that allows programmatic control over permission states.
 *
 * @param config - Configuration options for the permission mock
 * @returns A handle that can be used to control and clean up the mock
 *
 * @example
 * ```typescript
 * // Basic usage
 * const mockHandle = mockPermissions();
 * mockHandle.setState('notifications', 'granted');
 *
 * // With initial states
 * const mockHandle = mockPermissions({
 *   initialStates: {
 *     'geolocation': 'denied',
 *     'notifications': 'granted'
 *   }
 * });
 *
 * // Clean up when done
 * mockHandle.restore();
 * ```
 *
 * @example
 * ```typescript
 * // Test notification permission
 * const mockHandle = mockPermissions({
 *   initialStates: { notifications: 'granted' }
 * });
 *
 * const status = await navigator.permissions.query({ name: 'notifications' });
 * console.log(status.state); // 'granted'
 *
 * // Change state and listen for events
 * status.onchange = () => console.log('State changed to:', status.state);
 * mockHandle.setState('notifications', 'denied'); // Triggers event
 *
 * mockHandle.restore();
 * ```
 *
 * @throws Will throw an error if navigator is not available (non-browser environment)
 */
export function mockPermissions(config: MockPermissionConfig = {}): MockPermissionHandle {
  return new MockPermissionHandleImpl(config);
}

/**
 * Utility function to check if permissions are currently mocked
 *
 * @returns true if navigator.permissions is currently mocked, false otherwise
 */
export function isPermissionsMocked(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const permissions = navigator.permissions as any;
  return permissions && permissions.isMocked === true;
}

/**
 * Utility function to get the current mock handle if permissions are mocked
 *
 * @returns The current MockPermissionHandle if mocking is active, null otherwise
 */
export function getCurrentMockHandle(): MockPermissionHandle | null {
  if (!isPermissionsMocked()) {
    return null;
  }

  const permissions = (navigator as NavigatorWithMockedPermissions).permissions;
  return permissions._mockHandle || null;
}

/**
 * Convenience function to temporarily mock permissions for a specific operation
 *
 * This function automatically restores the original permissions after the
 * provided function completes, even if it throws an error.
 *
 * @param config - Configuration for the temporary mock
 * @param fn - Function to execute with mocked permissions
 * @returns Promise that resolves to the result of the provided function
 *
 * @example
 * ```typescript
 * const result = await withMockedPermissions(
 *   { initialStates: { notifications: 'granted' } },
 *   async () => {
 *     const status = await navigator.permissions.query({ name: 'notifications' });
 *     return status.state; // Will be 'granted'
 *   }
 * );
 * // Permissions are automatically restored here
 * ```
 */
export async function withMockedPermissions<T>(
  config: MockPermissionConfig,
  fn: (handle: MockPermissionHandle) => Promise<T> | T
): Promise<T> {
  const handle = mockPermissions(config);

  try {
    return await fn(handle);
  } finally {
    handle.restore();
  }
}