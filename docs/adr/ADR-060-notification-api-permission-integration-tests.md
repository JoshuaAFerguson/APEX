# ADR-060: Notification API Permission Integration Tests - Technical Design

## Status
Accepted

## Date
2026-01-31

## Context

We need integration tests for the browser Notification API permissions. The tests must verify:

1. `Notification.requestPermission()` requires user gesture in secure contexts
2. Permission states (`granted`/`denied`/`default`) are correctly detected
3. Permission state transitions work correctly
4. Edge cases (multiple permission requests, denied-then-granted flows)
5. All tests pass

The APEX project already has:
- A robust **permission mocking infrastructure** in `packages/browser/src/permission-mocking/` (MockPermissionStatus, mockPermissions factory, withMockedPermissions helper)
- Established **test helpers** in `packages/core/src/__tests__/helpers/` (EventCollector, MockPermissionTrigger, WSTestClient)
- Existing **permission notification integration tests** across core, orchestrator, CLI, and API packages
- **Vitest** as the test framework with jsdom environment for browser-like tests

## Decision

### Test Architecture

We will create a single integration test file at:
```
tests/integration/notification-api-permissions.integration.test.ts
```

This location is chosen because:
- The `tests/integration/` directory is already used for cross-package integration tests
- These tests span browser permission mocking (`@apex/browser`) and the notification system (`@apex/core`)
- The main `vitest.config.ts` already includes `tests/**/*.test.ts` patterns

### Test Environment

- **Environment**: `jsdom` (default in vitest.config.ts) - provides `Notification`, `navigator.permissions`, and `EventTarget` APIs
- **No real browser required**: We use the existing `MockPermissionStatusImpl` and `mockPermissions()` infrastructure to simulate browser Notification API behavior
- **Notification API mock**: We create a lightweight `MockNotification` class that simulates `Notification.requestPermission()` and `Notification.permission` behavior, integrated with the existing permission mocking system

### Test Structure (5 Test Suites)

#### Suite 1: User Gesture Requirement (AC-1)
Tests that `Notification.requestPermission()` enforces user gesture requirements in secure contexts.

| Test ID | Description | Approach |
|---------|-------------|----------|
| NAPI-01 | requestPermission rejects without user gesture in secure context | Mock `isSecureContext=true`, track gesture state, verify rejection |
| NAPI-02 | requestPermission succeeds with user gesture | Simulate user gesture flag, verify resolution |
| NAPI-03 | requestPermission works without gesture in non-secure context | Mock `isSecureContext=false`, verify it still resolves |
| NAPI-04 | Gesture requirement produces correct error type | Verify `NotAllowedError` DOMException |

#### Suite 2: Permission State Detection (AC-2)
Tests that the three permission states are correctly read and reported.

| Test ID | Description | Approach |
|---------|-------------|----------|
| NAPI-05 | Detects 'default' permission state | Set mock state to 'prompt' (W3C equivalent of 'default'), verify `Notification.permission === 'default'` |
| NAPI-06 | Detects 'granted' permission state | Set mock to 'granted', verify detection |
| NAPI-07 | Detects 'denied' permission state | Set mock to 'denied', verify detection |
| NAPI-08 | Permission state syncs between Notification API and Permissions API | Query `navigator.permissions.query({name:'notifications'})` and `Notification.permission`, verify consistency |

#### Suite 3: Permission State Transitions (AC-3)
Tests state changes and event dispatching.

| Test ID | Description | Approach |
|---------|-------------|----------|
| NAPI-09 | Transition from default to granted | Start at 'prompt', call requestPermission (mock grants), verify state change + event |
| NAPI-10 | Transition from default to denied | Start at 'prompt', call requestPermission (mock denies), verify state change + event |
| NAPI-11 | onchange event fires on state transition | Register onchange handler, trigger state change, verify handler called with correct event |
| NAPI-12 | addEventListener('change') works for state transitions | Register via addEventListener, trigger transition, verify |
| NAPI-13 | No event fires when state doesn't change | Set state to same value, verify no event dispatched |

#### Suite 4: Edge Cases (AC-4)
Tests complex and unusual scenarios.

| Test ID | Description | Approach |
|---------|-------------|----------|
| NAPI-14 | Multiple simultaneous requestPermission calls | Fire 3 concurrent calls, verify all resolve consistently |
| NAPI-15 | requestPermission during pending request | Start one request, fire another before first resolves |
| NAPI-16 | denied-then-granted flow (re-request after denial) | Deny first, then grant on second request, verify state transitions |
| NAPI-17 | Permission state persists across queries | Set state, query multiple times, verify consistency |
| NAPI-18 | Cleanup after mock restore | Mock permissions, restore, verify original behavior restored |
| NAPI-19 | Rapid state transitions | Toggle state rapidly between granted/denied, verify all events fire in order |
| NAPI-20 | Permission callback API (legacy) | Test `Notification.requestPermission(callback)` callback-style API |

#### Suite 5: Integration with APEX Permission Notification System (AC-5)
Tests that browser notification permissions integrate with APEX's event system.

| Test ID | Description | Approach |
|---------|-------------|----------|
| NAPI-21 | Permission request emits APEX notification event | Use MockPermissionTrigger + EventCollector to verify notification emitted |
| NAPI-22 | Permission grant emits correct notification type | Verify `permission:granted` notification with correct metadata |
| NAPI-23 | Permission denial emits correct notification type | Verify `permission:denied` notification |
| NAPI-24 | Full permission lifecycle produces ordered events | Verify request -> notification -> grant/deny event sequence |

### Mock Architecture

```
MockNotification (new)
  ├── static permission: string ('default'|'granted'|'denied')
  ├── static requestPermission(): Promise<string>
  ├── integrates with → MockPermissionHandle (existing)
  │     └── setState('notifications', state) ←→ MockNotification.permission
  └── enforces user gesture via → SecureContextSimulator (new, lightweight)
        ├── isSecureContext: boolean
        └── hasUserGesture: boolean

Tests use:
  ├── withMockedPermissions() from @apex/browser (existing)
  ├── MockPermissionStatusImpl from @apex/browser (existing)
  ├── EventCollector from @apex/core test helpers (existing)
  └── MockPermissionTrigger from @apex/core test helpers (existing)
```

### Key Design Decisions

1. **Reuse existing mocking infrastructure**: The `packages/browser/src/permission-mocking/` module already provides `mockPermissions()`, `MockPermissionStatusImpl`, and `withMockedPermissions()`. We build on top of this rather than creating new mocking from scratch.

2. **MockNotification class as thin adapter**: We create a lightweight `MockNotification` class that wraps the existing permission mock infrastructure to provide the `Notification` API interface (`Notification.permission`, `Notification.requestPermission()`). This keeps the mock layer thin and testable.

3. **State mapping**: The W3C Permissions API uses `'prompt'` while the Notification API uses `'default'`. Our mock handles this mapping transparently.

4. **User gesture simulation**: Instead of trying to simulate real DOM events, we use a simple boolean flag (`hasUserGesture`) checked by the mock `requestPermission()`. This is the standard approach in browser testing.

5. **jsdom environment**: We run in jsdom which provides `EventTarget`, `Event`, and basic browser globals. This avoids the need for a real browser while still testing API contracts.

6. **Integration with APEX event system**: Suite 5 connects browser notification permissions to the APEX permission notification system using existing EventCollector and MockPermissionTrigger helpers.

### File Organization

```
tests/integration/
  └── notification-api-permissions.integration.test.ts  (main test file, ~400-500 lines)
```

All mock utilities needed are either:
- Already available in `packages/browser/src/permission-mocking/`
- Already available in `packages/core/src/__tests__/helpers/`
- Created inline in the test file (MockNotification, SecureContextSimulator - lightweight, <100 lines)

### Dependencies

No new npm dependencies required. The test uses:
- `vitest` (existing)
- `@apex/browser` permission-mocking module (existing)
- `@apex/core` test helpers (existing)
- `eventemitter3` (existing)

## Consequences

### Positive
- Comprehensive coverage of all 5 acceptance criteria with 24 test cases
- Reuses existing infrastructure (no new dependencies)
- Clean separation: browser mocking vs APEX integration vs edge cases
- Tests are isolated and can run independently
- jsdom environment keeps tests fast (no browser startup)

### Negative
- jsdom doesn't perfectly replicate real browser behavior (acceptable for unit/integration tests; real browser testing would be e2e)
- MockNotification is a test-only construct; changes to the real Notification API spec would need manual sync

### Risks
- jsdom's Notification API support may be incomplete (mitigated by our mock replacing it entirely)
- Permission state mapping ('prompt' vs 'default') could be a source of bugs (mitigated by explicit tests in Suite 2)
