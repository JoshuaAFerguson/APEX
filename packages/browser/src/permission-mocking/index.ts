/**
 * @apexcli/browser - Permission Mocking Module
 *
 * Browser Permission API mocking utilities for testing permission-dependent functionality.
 */

// Import core functions into local scope
import {
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,
} from './mock-permissions.js';

import { MockPermissionStatusImpl } from './mock-permission-status.js';

import { isMockPermissionStatus } from './types.js';

// Re-export core mocking functions
export {
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,
};

// Export the MockPermissionStatus implementation class
export { MockPermissionStatusImpl as MockPermissionStatus };

// Export all types and interfaces
export type {
  PermissionState,
  PermissionName,
  PermissionDescriptor,
  PermissionStateChangeHandler,
  MockPermissionDescriptor,
  MockPermissionConfig,
  MockPermissionHandle,
  NavigatorWithMockedPermissions,
} from './types.js';

// Re-export type guard function
export { isMockPermissionStatus };

/**
 * Default export containing all permission mocking utilities
 */
export default {
  mockPermissions,
  isPermissionsMocked,
  getCurrentMockHandle,
  withMockedPermissions,
  MockPermissionStatus: MockPermissionStatusImpl,
  isMockPermissionStatus,
} as const;
