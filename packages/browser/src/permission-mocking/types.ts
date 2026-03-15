/**
 * @apexcli/browser - Permission Mocking Types
 *
 * TypeScript types for browser Permission API mocking utilities
 */

/**
 * Standard permission states as defined by the W3C Permissions API specification
 * @see https://w3c.github.io/permissions/#enumdef-permissionstate
 */
export type PermissionState = 'granted' | 'denied' | 'prompt';

/**
 * Standard permission names as defined by the W3C Permissions API specification
 * @see https://w3c.github.io/permissions/#permission-registry
 */
export type PermissionName =
  | 'geolocation'
  | 'notifications'
  | 'push'
  | 'midi'
  | 'camera'
  | 'microphone'
  | 'speaker'
  | 'device-info'
  | 'background-fetch'
  | 'background-sync'
  | 'persistent-storage'
  | 'ambient-light-sensor'
  | 'accelerometer'
  | 'gyroscope'
  | 'magnetometer'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'payment-handler'
  | 'screen-wake-lock'
  | 'xr-spatial-tracking';

/**
 * Permission query descriptor as defined by the W3C specification
 * @see https://w3c.github.io/permissions/#dictdef-permissiondescriptor
 */
export interface PermissionDescriptor {
  /** The permission name being queried */
  name: PermissionName;
  /** Additional properties for specific permissions (e.g., userVisibleOnly for push) */
  [key: string]: any;
}

/**
 * Extended permission query interface for mock implementation
 * Provides additional metadata for testing scenarios
 */
export interface MockPermissionDescriptor extends PermissionDescriptor {
  /** Optional metadata for test scenarios */
  testMetadata?: {
    /** Custom test identifier */
    testId?: string;
    /** Test scenario description */
    scenario?: string;
    /** Expected behavior flags */
    expectedBehavior?: Record<string, any>;
  };
}

/**
 * Event handler type for permission state change events
 */
export type PermissionStateChangeHandler = (event: Event) => void;

/**
 * Mock permission status interface that extends the standard PermissionStatus
 * Provides additional methods for testing and state control
 * @see https://w3c.github.io/permissions/#permissionstatus
 */
export interface MockPermissionStatus extends EventTarget {
  /** Current permission state */
  readonly state: PermissionState;

  /** Permission name being tracked */
  readonly name: PermissionName;

  /** Event handler for state changes */
  onchange: PermissionStateChangeHandler | null;

  /** Mock-specific method to programmatically change the permission state */
  setState(newState: PermissionState): void;

  /** Mock-specific method to get the current state (for testing) */
  getState(): PermissionState;

  /** Mock-specific method to reset to initial state */
  reset(): void;

  /** Mock-specific method to check if this is a mock instance */
  readonly isMock: true;

  /** Mock-specific metadata for testing */
  readonly testMetadata?: MockPermissionDescriptor['testMetadata'];
}

/**
 * Permission mocking configuration options
 */
export interface MockPermissionConfig {
  /** Initial permission states for various permissions */
  initialStates?: Partial<Record<PermissionName, PermissionState>>;

  /** Whether to automatically restore original permissions on cleanup */
  autoRestore?: boolean;

  /** Default state for unmocked permissions */
  defaultState?: PermissionState;

  /** Whether to log state changes (useful for debugging) */
  enableLogging?: boolean;

  /** Custom logging function */
  logger?: (message: string, data?: any) => void;
}

/**
 * Handle returned by mockPermissions for controlling the mock
 */
export interface MockPermissionHandle {
  /** Set the state of a specific permission */
  setState(permission: PermissionName, state: PermissionState): void;

  /** Get the current state of a permission */
  getState(permission: PermissionName): PermissionState;

  /** Set states for multiple permissions at once */
  setStates(states: Partial<Record<PermissionName, PermissionState>>): void;

  /** Get all current permission states */
  getStates(): Partial<Record<PermissionName, PermissionState>>;

  /** Restore the original navigator.permissions implementation */
  restore(): void;

  /** Check if the mock is currently active */
  readonly isActive: boolean;

  /** Get access to the mock configuration */
  readonly config: Readonly<MockPermissionConfig>;
}

/**
 * Mocked Permissions API interface
 * Extends native PermissionAPI while adding mock-specific capabilities
 */
export interface MockedPermissionsAPI {
  /** Query a permission using descriptor or mock descriptor */
  query(descriptor: PermissionDescriptor | MockPermissionDescriptor): Promise<MockPermissionStatus>;

  /** Mock-specific property to identify mocked permissions */
  readonly isMocked: true;

  /** Reference to the original permissions API (stored during mocking) */
  readonly _original?: Permissions;

  /** Access to the mock handle from the navigator object */
  readonly _mockHandle?: MockPermissionHandle;
}

/**
 * Extended Navigator interface with mocked permissions
 * Used internally to type the navigator object with mocking support
 * Note: Uses composition to avoid LSP violations with the native PermissionsAPI
 */
export interface NavigatorWithMockedPermissions extends Omit<Navigator, 'permissions'> {
  /** Mocked permissions API */
  readonly permissions: MockedPermissionsAPI;
}

/**
 * Type guard to check if a PermissionStatus is a mock
 */
export function isMockPermissionStatus(
  status: PermissionStatus | MockPermissionStatus
): status is MockPermissionStatus {
  return 'isMock' in status && status.isMock === true;
}

/**
 * Type guard to check if navigator.permissions is mocked
 * Uses a type assertion since we're checking runtime behavior
 */
export function isPermissionsMocked(
  navigator: Navigator | NavigatorWithMockedPermissions
): navigator is NavigatorWithMockedPermissions {
  return 'permissions' in navigator &&
         navigator.permissions &&
         'isMocked' in navigator.permissions &&
         (navigator.permissions as any).isMocked === true;
}