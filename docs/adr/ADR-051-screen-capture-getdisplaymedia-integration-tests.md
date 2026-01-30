# ADR-051: Screen Capture (getDisplayMedia) Integration Tests Architecture

## Status
Accepted

## Date
2026-01-30

## Context

The APEX browser automation platform needs integration tests for screen capture (`getDisplayMedia`) permissions. The existing permission system (`@apexcli/browser/permission-mocking`) supports standard W3C permissions but does not yet cover `getDisplayMedia`, which has unique characteristics:

1. **Not part of the Permissions API** - Unlike camera/microphone, `getDisplayMedia` is accessed via `navigator.mediaDevices.getDisplayMedia()` and cannot be queried through `navigator.permissions.query()`.
2. **Requires user gesture** - Browsers mandate a transient user activation (click, keypress) before calling `getDisplayMedia()`.
3. **Requires secure context** - Only works over HTTPS or localhost.
4. **Display surface selection** - Users choose between monitor, window, or browser tab.
5. **Track lifecycle** - The returned `MediaStreamTrack` can be stopped by the user or programmatically, and permission is not persistent.

## Decision

### Test File Location

Place the integration test file at:
```
tests/integration/screen-capture-permissions.integration.test.ts
```

This follows the existing pattern established by:
- `tests/integration/browser-security-permissions.integration.test.ts`
- `tests/integration/browser-automation-permissions.integration.test.ts`

### Architecture: Mock-Based Integration Testing

Since `getDisplayMedia` cannot be tested in headless browsers (no display to capture) and requires real user gestures, we use a **mock-based approach** that tests the permission and error handling logic without a real browser.

#### Layer 1: DisplayMediaMock (Test Utility)

Create a `MockDisplayMedia` class that simulates the `navigator.mediaDevices.getDisplayMedia()` API:

```typescript
// In the test file (no separate utility file needed for a single test suite)

class MockMediaStreamTrack extends EventTarget {
  id: string;
  kind: 'video' | 'audio' = 'video';
  label: string;
  readyState: 'live' | 'ended' = 'live';
  enabled: boolean = true;
  onended: ((event: Event) => void) | null = null;

  constructor(label: string, kind?: 'video' | 'audio') { ... }
  stop(): void { /* sets readyState='ended', dispatches 'ended' event */ }
  getSettings(): DisplayMediaTrackSettings { ... }
  clone(): MockMediaStreamTrack { ... }
}

class MockMediaStream {
  id: string;
  active: boolean = true;
  tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[]) { ... }
  getVideoTracks(): MockMediaStreamTrack[] { ... }
  getAudioTracks(): MockMediaStreamTrack[] { ... }
  getTracks(): MockMediaStreamTrack[] { ... }
  addTrack(track: MockMediaStreamTrack): void { ... }
  removeTrack(track: MockMediaStreamTrack): void { ... }
}

interface DisplayMediaTrackSettings {
  displaySurface: 'monitor' | 'window' | 'browser';
  cursor: 'always' | 'motion' | 'never';
  width: number;
  height: number;
  frameRate: number;
}
```

#### Layer 2: getDisplayMedia Mock Controller

```typescript
interface MockGetDisplayMediaConfig {
  // Permission behavior
  permissionBehavior: 'grant' | 'deny' | 'error';

  // Context requirements
  requireSecureContext: boolean;
  requireUserGesture: boolean;

  // Display surface settings
  defaultDisplaySurface: 'monitor' | 'window' | 'browser';
  availableSurfaces: Array<'monitor' | 'window' | 'browser'>;

  // Track settings
  trackSettings: Partial<DisplayMediaTrackSettings>;

  // Error simulation
  errorType?: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError' | 'AbortError';
  errorMessage?: string;
}

class MockGetDisplayMediaController {
  private config: MockGetDisplayMediaConfig;
  private activeStreams: MockMediaStream[] = [];
  private hasUserGesture: boolean = false;
  private isSecureContext: boolean = true;
  private captureCount: number = 0;

  constructor(config: Partial<MockGetDisplayMediaConfig>) { ... }

  // Core mock implementation
  async getDisplayMedia(constraints?: DisplayMediaStreamConstraints): Promise<MockMediaStream> { ... }

  // Test control methods
  simulateUserGesture(): void { ... }
  clearUserGesture(): void { ... }
  setSecureContext(isSecure: boolean): void { ... }
  setPermissionBehavior(behavior: 'grant' | 'deny' | 'error'): void { ... }
  revokePermission(): void { /* stops all active tracks */ }
  getActiveStreams(): MockMediaStream[] { ... }
  getCaptureCount(): number { ... }
  reset(): void { ... }
}
```

#### Layer 3: Test Suite Structure

```
describe('Screen Capture (getDisplayMedia) Permission Tests')
├── describe('User Gesture Requirements')
│   ├── should throw NotAllowedError when called without user gesture
│   ├── should succeed when called with active user gesture
│   ├── should fail after user gesture expires (transient activation)
│   └── should handle rapid successive calls with gesture validation
│
├── describe('Secure Context Requirements')
│   ├── should throw NotAllowedError in insecure context (HTTP)
│   ├── should succeed in secure context (HTTPS)
│   ├── should succeed on localhost regardless of protocol
│   └── should validate both gesture AND secure context together
│
├── describe('Permission Denied Scenarios')
│   ├── should throw NotAllowedError when user denies permission
│   ├── should throw NotAllowedError with correct DOMException name
│   ├── should emit permission-denied event through PermissionManager
│   ├── should handle repeated denials gracefully
│   └── should not leave dangling resources after denial
│
├── describe('Display Surface Constraints')
│   ├── should handle monitor capture with correct settings
│   ├── should handle window capture with correct settings
│   ├── should handle browser tab capture with correct settings
│   ├── should apply preferCurrentTab constraint when specified
│   ├── should respect displaySurface constraint in options
│   ├── should handle video constraints (width, height, frameRate)
│   └── should handle audio constraint (system audio capture)
│
├── describe('Track Lifecycle and Edge Cases')
│   ├── should fire 'ended' event when track is stopped programmatically
│   ├── should fire 'ended' event when user stops sharing
│   ├── should update stream.active when all tracks end
│   ├── should handle multiple concurrent captures
│   ├── should handle capture after previous capture ended
│   └── should clean up resources when track stops
│
└── describe('Permission Revocation')
    ├── should stop all active tracks when permission is revoked
    ├── should emit appropriate events on permission revocation
    ├── should handle revocation during active capture
    └── should require new permission grant after revocation
```

### Integration with Existing Permission System

The tests integrate with the existing `PermissionManager` and `PermissionStore` from `@apexcli/orchestrator`:

```typescript
// Setup pattern (matching existing tests)
beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-screen-capture-test-'));
  taskStore = new TaskStore(testDir);
  await taskStore.initialize();
  permissionStore = new PermissionStore();
  permissionManager = new PermissionManager(permissionStore);
  testTask = createTestTask(testDir);
  await taskStore.addTask(testTask);

  // Screen capture specific setup
  displayMediaController = new MockGetDisplayMediaController({
    requireSecureContext: true,
    requireUserGesture: true,
    permissionBehavior: 'grant',
    defaultDisplaySurface: 'monitor',
  });

  // Track permission events
  permissionEvents = [];
  const eventEmitter = permissionStore as any as EventEmitter;
  eventEmitter.on('permission:request', (e) => permissionEvents.push(e));
  eventEmitter.on('permission:denied', (e) => permissionEvents.push(e));
  eventEmitter.on('permission:revoked', (e) => permissionEvents.push(e));
});
```

### Error Types (W3C Compliant)

Tests must verify these specific DOMException error types:
- **`NotAllowedError`** - User denied, no gesture, or insecure context
- **`NotFoundError`** - No display surface available
- **`NotReadableError`** - Hardware/OS error preventing capture
- **`OverconstrainedError`** - Constraints cannot be satisfied
- **`AbortError`** - Operation aborted

### Key Design Decisions

1. **Self-contained mocks**: All mock classes are defined within the test file (or a co-located test-utils file). This avoids modifying the production `PermissionName` type which doesn't include screen capture.

2. **No production code changes needed**: The architecture stage only produces tests and the ADR. The `getDisplayMedia` API is fundamentally different from the Permissions API, so extending `PermissionName` is not appropriate.

3. **Event-driven verification**: Tests use the existing `EventEmitter` pattern to verify permission events are emitted correctly.

4. **W3C spec alignment**: Mock implementations follow the actual `getDisplayMedia()` spec for error types, constraint handling, and track lifecycle.

5. **Test config**: Uses `vitest.config.ts` (main config) with `node` environment. The test path `tests/integration/` is already included in the main vitest config's `include` patterns.

## Consequences

### Positive
- Tests verify all acceptance criteria without requiring real browser/display hardware
- Follows established patterns from existing browser permission integration tests
- Mock controller provides fine-grained control over all edge cases
- No production code changes needed at architecture stage
- W3C-compliant error handling ensures real-world compatibility

### Negative
- Mock-based tests cannot verify actual browser behavior
- May need updating if the getDisplayMedia spec changes significantly

### Risks
- Mock fidelity: Mocks may not perfectly replicate browser behavior
- Mitigation: Follow W3C spec strictly, reference MDN documentation for edge cases

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `tests/integration/screen-capture-permissions.integration.test.ts` | Create | Main integration test file with all test suites and mock utilities |
| `docs/adr/ADR-051-screen-capture-getdisplaymedia-integration-tests.md` | Create | This architecture decision record |

## Dependencies

- `vitest` (existing)
- `eventemitter3` (existing)
- `@apexcli/orchestrator` - `TaskStore`, `PermissionManager`, `PermissionStore` (existing)
- `@apexcli/core` - Types (existing)
- Test utilities from `packages/orchestrator/src/__tests__/v050-integration/test-utils` (existing)

## Notes for Next Stages

1. **Developer stage**: Implement the test file following this architecture. All mock classes should be self-contained within the test file. Use the `MockGetDisplayMediaController` pattern for test control.

2. **Tester stage**: After implementation, verify all 25+ test cases pass. Pay special attention to:
   - Error type matching (DOMException names must be exact)
   - Event emission verification through PermissionStore
   - Track lifecycle events firing in correct order
   - Resource cleanup in afterEach hooks

3. **Important constraints**:
   - The test file must use `node` environment (not jsdom) since it's in `tests/integration/`
   - `EventTarget` is available in Node 16+ (project targets ES2022)
   - Do NOT modify `PermissionName` type in production code - `getDisplayMedia` is not a standard permission
