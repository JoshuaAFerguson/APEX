# ADR: Notification API Permissions Integration Test Architecture

## Status
Accepted

## Date
2025-01-30

## Context

We need to implement integration tests for the browser Notification API permissions system. The acceptance criteria require testing:

1. `Notification.requestPermission()` requires user gesture in secure contexts
2. Permission states (`granted`/`denied`/`default`) are correctly detected
3. Permission state transitions work correctly
4. Edge cases (multiple permission requests, denied-then-granted flows)
5. All tests pass

The APEX codebase already has a comprehensive permission mocking infrastructure in `packages/browser/src/permission-mocking/` that provides W3C-compliant mocking of `navigator.permissions.query()`. However, there is no specific test suite for the **Notification API** (`Notification.requestPermission()`, `Notification.permission` property, and the `new Notification()` constructor).

## Decision

### 1. Test Location

**Place tests at**: `tests/integration/notification-api-permissions.integration.test.ts`

**Rationale**: This follows the established pattern for integration tests in the project. All browser permission integration tests live in `tests/integration/` (e.g., `browser-security-permissions.integration.test.ts`, `permission-policy-browser.integration.test.ts`).

### 2. Testing Approach: Mock the Notification API in jsdom

Since tests run in a `jsdom` environment (per `vitest.config.ts`), and `jsdom` does not implement the Notification API, we will:

- **Create a `MockNotification` class** that simulates `window.Notification` including:
  - Static `permission` property (returns `'default'`, `'granted'`, or `'denied'`)
  - Static `requestPermission()` method (returns a Promise resolving to a permission state)
  - Constructor that throws when permission is not `'granted'`
  - Support for simulating user gesture requirements

- **Leverage the existing `permission-mocking` infrastructure** from `@apexcli/browser` for `navigator.permissions.query({ name: 'notifications' })` integration

- **Keep mocking self-contained within the test file** to avoid coupling the test infrastructure to production code

**Rationale**: The test should not depend on a real browser. By mocking at the API level, we can fully control permission states and transitions, test edge cases deterministically, and run tests fast in CI without browser launch overhead.

### 3. Test Structure

The test file will be organized into these describe blocks:

```
notification-api-permissions.integration.test.ts
|
+-- Notification API Permission Integration Tests
    |
    +-- Permission State Detection
    |   +-- should detect 'default' permission state initially
    |   +-- should detect 'granted' permission state
    |   +-- should detect 'denied' permission state
    |   +-- should reflect permission state via Notification.permission
    |
    +-- Notification.requestPermission()
    |   +-- should return a Promise resolving to permission state
    |   +-- should support callback-style API (legacy)
    |   +-- should require user gesture in secure context (simulated)
    |   +-- should resolve to 'granted' when user accepts
    |   +-- should resolve to 'denied' when user rejects
    |   +-- should resolve to 'default' when user dismisses
    |
    +-- Permission State Transitions
    |   +-- should transition from 'default' to 'granted'
    |   +-- should transition from 'default' to 'denied'
    |   +-- should NOT transition from 'denied' to 'granted' via requestPermission
    |   +-- should handle transition via permissions.query onchange event
    |   +-- should keep state consistent between Notification.permission and permissions.query
    |
    +-- Edge Cases
    |   +-- should handle multiple concurrent requestPermission() calls
    |   +-- should handle rapid sequential permission requests
    |   +-- should handle denied-then-granted flow (requires browser settings change)
    |   +-- should handle requestPermission() when already granted
    |   +-- should handle requestPermission() when already denied
    |   +-- should handle Notification constructor when permission not granted
    |   +-- should handle Notification constructor when permission is granted
    |
    +-- Integration with navigator.permissions API
        +-- should reflect state via navigator.permissions.query
        +-- should fire onchange event when permission changes
        +-- should maintain consistency across both APIs
```

### 4. MockNotification Design

```typescript
interface MockNotificationStatic {
  permission: NotificationPermission;  // 'default' | 'granted' | 'denied'
  requestPermission(callback?: (permission: string) => void): Promise<NotificationPermission>;

  // Test helpers (not part of real API)
  _setPermission(state: NotificationPermission): void;
  _setUserResponse(response: NotificationPermission): void;
  _requireUserGesture(require: boolean): void;
  _isUserGestureActive: boolean;
  _simulateUserGesture<T>(fn: () => T): T;
  _reset(): void;
}
```

Key behaviors:
- `requestPermission()` consults `_userResponse` to determine what the "user" would choose
- When `_requireUserGesture` is true, `requestPermission()` throws/rejects if called outside `_simulateUserGesture()`
- `_setPermission()` directly sets the static `permission` property (for testing state detection)
- `_reset()` restores all mock state to defaults

### 5. Integration with Existing Permission Mocking

The test will use `withMockedPermissions()` from `@apexcli/browser/permission-mocking` for tests that verify consistency between `Notification.permission` and `navigator.permissions.query({ name: 'notifications' })`. This ensures both APIs stay in sync, which is the real-world behavior.

### 6. Test Environment

- **Vitest environment**: `jsdom` (matches the default in `vitest.config.ts` for non-backend packages)
- **Test timeout**: Default 5s (sufficient since no real browser interaction)
- **No external dependencies**: All mocking is self-contained
- **Cleanup**: `afterEach` restores `window.Notification` and permission mock handles

## Consequences

### Positive
- Tests run fast in CI (no browser required)
- Deterministic - no flakiness from real permission dialogs
- Complete coverage of the Notification API permission lifecycle
- Reuses existing `permission-mocking` infrastructure for `navigator.permissions` integration
- Follows established test patterns in the codebase

### Negative
- Mock may not capture all browser-specific quirks (e.g., Firefox vs Chrome differences)
- User gesture simulation is approximate - real browsers have stricter transient activation tracking
- If the W3C Notification API spec changes, mocks need manual updates

### Mitigations
- The `MockNotification` is designed to be W3C-spec-compliant in its interface
- Integration tests with real browsers (via Playwright) can be added as a separate E2E layer
- Test metadata and scenario descriptions document expected browser behaviors

## Related
- `packages/browser/src/permission-mocking/` - Existing W3C Permissions API mocking
- `packages/browser/src/__tests__/permission-mocking.test.ts` - Existing permission mock tests
- `tests/integration/browser-security-permissions.integration.test.ts` - Related browser security tests
- `tests/integration/permission-policy-browser.integration.test.ts` - Related permission policy tests
