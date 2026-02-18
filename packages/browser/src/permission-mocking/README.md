# Permission Mocking

Browser Permission API mocking utilities for testing permission-dependent functionality.

## Overview

This module provides a standards-compliant mock implementation of the W3C Permissions API with full TypeScript support and event handling. It allows you to programmatically control permission states during testing without requiring user interaction.

## Features

- ✅ **Standards Compliant**: Implements the W3C Permissions API specification
- ✅ **TypeScript Support**: Full type safety with comprehensive interfaces
- ✅ **Event Handling**: Native `EventTarget` support for state change events
- ✅ **Lazy Creation**: Permission status instances created only when queried
- ✅ **Handle-based API**: Clean management with `setState`/`getState`/`restore` methods
- ✅ **Configurable**: Support for initial states, default states, and logging
- ✅ **Automatic Cleanup**: Built-in restoration capabilities

## Quick Start

```typescript
import { mockPermissions } from '@apexcli/browser';

// Basic usage
const mockHandle = mockPermissions();
mockHandle.setState('notifications', 'granted');

// Test your permission-dependent code
const status = await navigator.permissions.query({ name: 'notifications' });
console.log(status.state); // 'granted'

// Clean up when done
mockHandle.restore();
```

## API Reference

### `mockPermissions(config?)`

Creates and activates permission mocking.

```typescript
const mockHandle = mockPermissions({
  initialStates: {
    'geolocation': 'denied',
    'notifications': 'granted'
  },
  defaultState: 'prompt',
  enableLogging: true
});
```

### MockPermissionHandle

The handle returned by `mockPermissions()` provides methods to control the mock:

- `setState(permission, state)` - Set a specific permission state
- `getState(permission)` - Get current permission state
- `setStates(states)` - Set multiple permission states at once
- `getStates()` - Get all current permission states
- `restore()` - Restore original `navigator.permissions`
- `isActive` - Check if mock is currently active
- `config` - Access to mock configuration (readonly)

### MockPermissionStatus

The mock permission status objects support all standard `PermissionStatus` features plus:

- `setState(newState)` - Programmatically change state
- `getState()` - Get current state
- `reset()` - Reset to 'prompt' state
- `isMock: true` - Identifies as mock instance

## Advanced Usage

### With Initial States

```typescript
const mockHandle = mockPermissions({
  initialStates: {
    'geolocation': 'denied',
    'notifications': 'granted',
    'camera': 'prompt'
  }
});
```

### Event Handling

```typescript
const status = await navigator.permissions.query({ name: 'notifications' });

// Using onchange property
status.onchange = () => {
  console.log('Permission changed to:', status.state);
};

// Using addEventListener
status.addEventListener('change', (event) => {
  console.log('State changed via event:', event.target.state);
});

// Trigger event by changing state
mockHandle.setState('notifications', 'denied');
```

### Automatic Cleanup

```typescript
import { withMockedPermissions } from '@apexcli/browser';

const result = await withMockedPermissions(
  { initialStates: { geolocation: 'granted' } },
  async (mockHandle) => {
    // Your test code here
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  }
);
// Permissions automatically restored here
```

### Testing Scenarios

```typescript
// Test permission denial
const mockHandle = mockPermissions();
const status = await navigator.permissions.query({ name: 'camera' });

// Simulate user denying permission
mockHandle.setState('camera', 'denied');
// Test how your app handles denied permissions

// Simulate user granting permission later
mockHandle.setState('camera', 'granted');
// Test permission-enabled functionality

mockHandle.restore();
```

## Supported Permissions

The mock supports all standard web permissions:

- `geolocation`
- `notifications`
- `push`
- `midi`
- `camera`
- `microphone`
- `speaker`
- `device-info`
- `background-fetch`
- `background-sync`
- `persistent-storage`
- `ambient-light-sensor`
- `accelerometer`
- `gyroscope`
- `magnetometer`
- `clipboard-read`
- `clipboard-write`
- `payment-handler`
- `screen-wake-lock`
- `xr-spatial-tracking`

## Testing Best Practices

1. **Always restore**: Use `mockHandle.restore()` or `withMockedPermissions()` to clean up
2. **Test state changes**: Verify your app handles permission changes correctly
3. **Test initial states**: Use different initial permission configurations
4. **Use event listeners**: Test that your app responds to permission state changes
5. **Mock early**: Set up permission mocking before initializing your app components

## Browser Compatibility

This mock is designed for testing environments and requires:
- `navigator.permissions` API availability
- `EventTarget` support
- ES2018+ features (async/await, object spread)