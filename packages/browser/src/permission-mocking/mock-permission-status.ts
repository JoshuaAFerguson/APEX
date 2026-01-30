/**
 * @apexcli/browser - MockPermissionStatus Implementation
 *
 * Standards-compliant mock implementation of the PermissionStatus interface
 * with EventTarget support for state change events
 */

import type {
  PermissionState,
  PermissionName,
  PermissionStateChangeHandler,
  MockPermissionStatus,
  MockPermissionDescriptor,
} from './types.js';

/**
 * Mock implementation of PermissionStatus that extends EventTarget
 *
 * Provides a standards-compliant mock of the browser's PermissionStatus API
 * with full event support for testing permission-dependent functionality.
 *
 * @see https://w3c.github.io/permissions/#permissionstatus
 */
export class MockPermissionStatusImpl extends EventTarget implements MockPermissionStatus {
  private _state: PermissionState;
  private _name: PermissionName;
  private _onchange: PermissionStateChangeHandler | null = null;
  private _testMetadata?: MockPermissionDescriptor['testMetadata'];

  /**
   * Creates a new MockPermissionStatus instance
   *
   * @param name - The permission name this status represents
   * @param initialState - The initial permission state (default: 'prompt')
   * @param testMetadata - Optional metadata for testing scenarios
   */
  constructor(
    name: PermissionName,
    initialState: PermissionState = 'prompt',
    testMetadata?: MockPermissionDescriptor['testMetadata']
  ) {
    super();
    this._name = name;
    this._state = initialState;
    this._testMetadata = testMetadata;
  }

  /**
   * Current permission state
   * @readonly
   */
  get state(): PermissionState {
    return this._state;
  }

  /**
   * Permission name being tracked
   * @readonly
   */
  get name(): PermissionName {
    return this._name;
  }

  /**
   * Event handler for state changes
   * Compatible with the standard PermissionStatus.onchange property
   */
  get onchange(): PermissionStateChangeHandler | null {
    return this._onchange;
  }

  set onchange(handler: PermissionStateChangeHandler | null) {
    // Remove previous handler if it exists
    if (this._onchange) {
      this.removeEventListener('change', this._onchange);
    }

    this._onchange = handler;

    // Add new handler if provided
    if (handler) {
      this.addEventListener('change', handler);
    }
  }

  /**
   * Identifies this as a mock instance
   * @readonly
   */
  get isMock(): true {
    return true;
  }

  /**
   * Test metadata associated with this permission status
   * @readonly
   */
  get testMetadata(): MockPermissionDescriptor['testMetadata'] | undefined {
    return this._testMetadata;
  }

  /**
   * Mock-specific method to programmatically change the permission state
   *
   * This method simulates a permission state change and dispatches the
   * appropriate events to any registered listeners.
   *
   * @param newState - The new permission state to set
   */
  setState(newState: PermissionState): void {
    const previousState = this._state;

    // Only dispatch event if state actually changes
    if (previousState !== newState) {
      this._state = newState;

      // Create and dispatch change event
      const changeEvent = new Event('change');
      this.dispatchEvent(changeEvent);
    }
  }

  /**
   * Mock-specific method to get the current state
   *
   * This is primarily useful for testing to verify state without
   * relying on the readonly 'state' property.
   *
   * @returns The current permission state
   */
  getState(): PermissionState {
    return this._state;
  }

  /**
   * Mock-specific method to reset to initial state
   *
   * Resets the permission to 'prompt' state and dispatches change event
   * if the current state was different.
   */
  reset(): void {
    this.setState('prompt');
  }

  /**
   * Updates test metadata (useful for dynamic test scenarios)
   *
   * @param metadata - New test metadata to associate with this permission
   */
  setTestMetadata(metadata?: MockPermissionDescriptor['testMetadata']): void {
    this._testMetadata = metadata;
  }

  /**
   * Creates a string representation of the permission status
   * Useful for debugging and logging
   */
  toString(): string {
    return `MockPermissionStatus { name: "${this._name}", state: "${this._state}" }`;
  }

  /**
   * Creates a JSON representation of the permission status
   * Useful for serialization in tests
   */
  toJSON(): object {
    return {
      name: this._name,
      state: this._state,
      isMock: true,
      testMetadata: this._testMetadata,
    };
  }

  /**
   * Override addEventListener to provide type safety for change events
   */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener, options);
  }

  /**
   * Override removeEventListener to provide type safety for change events
   */
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener, options);
  }
}