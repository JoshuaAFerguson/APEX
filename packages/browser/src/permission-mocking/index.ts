/**
 * @apexcli/browser - Permission Mocking Module
 *
 * Browser Permission API mocking utilities for testing permission-dependent functionality.
 * This module provides a standards-compliant mock implementation of the W3C Permissions API
 * with full TypeScript support and event handling.
 *
 * @example
 * ```typescript
 * import { mockPermissions } from '@apexcli/browser/permission-mocking';
 *
 * // Basic usage
 * const mockHandle = mockPermissions();
 * mockHandle.setState('notifications', 'granted');
 *
 * // Test permission-dependent code
 * const status = await navigator.permissions.query({ name: 'notifications' });
 * console.log(status.state); // 'granted'
 *
 * // Clean up
 * mockHandle.restore();
 * ```
 *
 * @example
 * ```typescript
 * import { withMockedPermissions } from '@apexcli/browser/permission-mocking';
 *
 * // Automatic cleanup
 * const result = await withMockedPermissions(
 *   { initialStates: { geolocation: 'denied' } },
 *   async () => {
 *     // Your test code here
 *     const status = await navigator.permissions.query({ name: 'geolocation' });
 *     return status.state;
 *   }
 * );
 * // Permissions automatically restored
 * ```
 */

// Export core mocking functions
export {
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,
} from './mock-permissions.js';

// Export the MockPermissionStatus implementation class
export { MockPermissionStatusImpl as MockPermissionStatus } from './mock-permission-status.js';

// Export all types and interfaces
export type {
  // Core permission types
  PermissionState,
  PermissionName,
  PermissionDescriptor,
  PermissionStateChangeHandler,

  // Mock-specific types
  MockPermissionDescriptor,
  MockPermissionStatus,
  MockPermissionConfig,
  MockPermissionHandle,
  NavigatorWithMockedPermissions,

  // Type guards
  isMockPermissionStatus,
  isPermissionsMocked as isPermissionsMockedTypeGuard,
} from './types.js';

// Re-export type guard functions for convenience
export { isMockPermissionStatus, isPermissionsMocked as isPermissionsMockedGuard } from './types.js';

/**
 * Default export containing all permission mocking utilities
 *
 * Provides convenient access to all functions and classes in a single import
 * for CommonJS compatibility and convenience.
 *
 * @example
 * ```typescript
 * import permissionMocking from '@apexcli/browser/permission-mocking';
 *
 * const mockHandle = permissionMocking.mockPermissions();
 * mockHandle.setState('camera', 'granted');
 * ```
 */
export default {
  // Core functions
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,

  // Classes
  MockPermissionStatus: MockPermissionStatusImpl,

  // Type guards (re-exported as functions)
  isMockPermissionStatus,
  isPermissionsMockedGuard,
} as const;