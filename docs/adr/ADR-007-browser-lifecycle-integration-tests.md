# ADR-007: Browser Launch/Close Lifecycle Integration Tests

## Status
Proposed

## Context
APEX provides browser automation capabilities through the `@apexcli/browser` package, which includes `BrowserManager` and `BrowserSession` classes. These components manage browser lifecycle operations including instantiation, context creation, and graceful shutdown.

Integration tests are needed to verify:
1. Browser instantiation across different browser types (chromium, firefox, webkit)
2. Multiple concurrent browser instances
3. Graceful shutdown procedures
4. Error handling during launch and close operations
5. Timeout handling and resource cleanup

## Decision

### 1. Test File Location and Structure

Create a new integration test file at:
```
packages/browser/src/__tests__/browser-lifecycle.integration.test.ts
```

This follows the existing pattern of `*.integration.test.ts` for integration tests within the browser package.

### 2. Test Architecture

#### 2.1 Test Categories

The integration tests will be organized into five main describe blocks:

```typescript
describe('Browser Lifecycle Integration Tests', () => {
  describe('Browser Instantiation', () => { ... });
  describe('Multiple Browser Instances', () => { ... });
  describe('Graceful Shutdown', () => { ... });
  describe('Error Handling - Launch', () => { ... });
  describe('Error Handling - Close', () => { ... });
  describe('Timeout and Resource Cleanup', () => { ... });
});
```

#### 2.2 Test Setup Pattern

Each test suite will follow the established pattern:

```typescript
let manager: BrowserManager;

beforeEach(() => {
  manager = new BrowserManager({
    maxInstances: 10,  // Higher limit for concurrent tests
    reuseInstances: false,  // Ensure clean state per test
    instanceIdleTimeout: 60000
  });
});

afterEach(async () => {
  await manager.shutdown();
});
```

#### 2.3 Integration Test Scope

| Test Category | What is Tested | Acceptance Criteria |
|--------------|----------------|---------------------|
| Instantiation | Browser launch with default and custom options | All browser types launch successfully, return valid instance IDs |
| Multiple Instances | Concurrent launches, different browser types | Can manage 3+ instances, proper isolation |
| Graceful Shutdown | shutdown(), closeBrowser(), cleanup order | All resources released, no dangling processes |
| Launch Errors | Invalid paths, timeouts, resource limits | Structured error objects returned, state consistency maintained |
| Close Errors | Already closed, zombie contexts, partial failures | Graceful degradation, eventual cleanup |
| Timeout/Cleanup | Idle timeout, forced cleanup, resource monitoring | Automatic cleanup works, resource limits enforced |

### 3. Key Test Scenarios

#### 3.1 Browser Instantiation Tests

```typescript
// Test 1: Default browser instantiation
it('should launch chromium browser with default options')

// Test 2: All browser types
it('should launch all supported browser types: chromium, firefox, webkit')

// Test 3: Custom launch options
it('should apply custom launch options (args, timeout, headless)')

// Test 4: Context creation after launch
it('should create browser context immediately after launch')

// Test 5: Page creation workflow
it('should complete full lifecycle: launch -> context -> page')
```

#### 3.2 Multiple Browser Instances Tests

```typescript
// Test 1: Concurrent launches
it('should handle 3 concurrent browser launches')

// Test 2: Mixed browser types
it('should manage instances of different browser types simultaneously')

// Test 3: Instance isolation
it('should maintain isolation between browser instances')

// Test 4: Resource tracking
it('should track resource usage across multiple instances')

// Test 5: Sequential operations
it('should handle sequential launch-close cycles')
```

#### 3.3 Graceful Shutdown Tests

```typescript
// Test 1: Manager shutdown
it('should close all instances and contexts on manager.shutdown()')

// Test 2: Individual browser close
it('should close single browser and its contexts via closeBrowser()')

// Test 3: Context cascade
it('should close all contexts before closing browser')

// Test 4: Event emission
it('should emit browserClosed and contextClosed events in order')

// Test 5: Double shutdown
it('should handle multiple shutdown calls gracefully')
```

#### 3.4 Error Handling - Launch Tests

```typescript
// Test 1: Invalid executable path
it('should return structured error for invalid browser path')

// Test 2: Launch timeout
it('should handle launch timeout with proper error response')

// Test 3: Max instances exceeded
it('should reject launch when max instances reached')

// Test 4: Operations after shutdown
it('should fail launch attempts on shutdown manager')

// Test 5: State consistency on failure
it('should maintain consistent state after launch failure')
```

#### 3.5 Error Handling - Close Tests

```typescript
// Test 1: Close non-existent instance
it('should handle closing non-existent browser instance')

// Test 2: Close already closed
it('should handle closing already-closed browser')

// Test 3: Browser crash simulation
it('should recover from browser crash during close')

// Test 4: Orphaned contexts
it('should cleanup orphaned contexts on browser close')

// Test 5: Partial failure recovery
it('should continue cleanup after partial close failure')
```

#### 3.6 Timeout and Resource Cleanup Tests

```typescript
// Test 1: Idle timeout cleanup
it('should automatically cleanup idle instances after timeout')

// Test 2: Manual cleanup trigger
it('should cleanup idle instances via cleanupIdleInstances()')

// Test 3: Resource limit monitoring
it('should emit resourceLimitExceeded when limits are breached')

// Test 4: Memory tracking
it('should accurately track memory usage across instances')

// Test 5: Cleanup with active contexts
it('should not cleanup instances with active contexts')
```

### 4. Technical Implementation Details

#### 4.1 Dependencies

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import { BROWSER_LIMITS, ERROR_MESSAGES } from '../constants.js';
```

#### 4.2 Timeout Configuration

Integration tests involving actual browser launches require extended timeouts:

```typescript
// At file level
const BROWSER_TEST_TIMEOUT = 60000; // 60 seconds for browser operations

// Per-test timeout for slow operations
it('should handle launch timeout', async () => { ... }, BROWSER_TEST_TIMEOUT);
```

#### 4.3 Event Testing Pattern

```typescript
const eventPromise = new Promise<BrowserInstanceInfo>((resolve) => {
  manager.once('browserCreated', resolve);
});

const result = await manager.launchBrowser({ browserType: 'chromium' });
const event = await eventPromise;

expect(event.id).toBe(result.data?.id);
```

#### 4.4 Cleanup Verification Pattern

```typescript
// Before cleanup
expect(manager.getInstances()).toHaveLength(3);
expect(manager.getContexts()).toHaveLength(5);

// Perform shutdown
await manager.shutdown();

// Verify cleanup
expect(manager.getInstances()).toHaveLength(0);
expect(manager.getContexts()).toHaveLength(0);
```

### 5. Test Utilities

Leverage existing test utilities:

```typescript
// From tests/test-utils/browser-test-base.ts
import {
  BrowserTestBase,
  createBrowserTest,
  DEFAULT_BROWSER_TEST_CONFIG
} from '../../../tests/test-utils/browser-test-base.js';
```

### 6. CI/CD Considerations

- Tests should run in headless mode (controlled via `process.env.CI`)
- Browser tests are slower - consider parallel execution limits
- Ensure cleanup runs even on test failures via `afterEach`
- Use appropriate test timeouts for browser operations

### 7. Edge Cases to Cover

1. **Race conditions**: Concurrent launch/close on same instance
2. **Memory pressure**: Rapid instance creation/destruction cycles
3. **Browser disconnect**: Handle unexpected browser process termination
4. **Resource exhaustion**: Test behavior at resource limits
5. **Network issues**: Handle slow/failed browser downloads (if applicable)

## Consequences

### Positive
- Comprehensive coverage of browser lifecycle operations
- Clear regression detection for browser management features
- Documentation of expected behavior through tests
- Consistent with existing test patterns in the codebase

### Negative
- Integration tests are slower than unit tests
- Browser tests can be flaky due to external dependencies
- Additional CI/CD time for browser test execution

### Mitigations
- Use `beforeEach`/`afterEach` for proper cleanup
- Implement retry logic for flaky network-dependent tests
- Configure appropriate timeouts
- Run browser tests in isolated CI jobs

## Implementation Notes

### File Structure

```
packages/browser/src/__tests__/
├── browser-lifecycle.integration.test.ts  # NEW - Primary lifecycle tests
├── browser-manager.test.ts                # Existing unit tests
├── browser-manager.edge.test.ts           # Existing edge case tests
├── browser-session.test.ts                # Existing session tests
└── ...
```

### Dependencies on Existing Code

- `BrowserManager` class from `../browser-manager.js`
- `BrowserSession` class from `../browser-session.js`
- Constants from `../constants.js`
- Types from `../types.js`

### Test Data Requirements

- No external fixtures needed
- Tests create and destroy browser instances
- Use in-memory HTML content via `page.setContent()` where needed

## References

- Existing tests: `browser-manager.test.ts`, `browser-manager.edge.test.ts`
- Browser types: `types.ts`
- Manager implementation: `browser-manager.ts`
- Session implementation: `browser-session.ts`
- Test utilities: `tests/test-utils/browser-test-base.ts`
