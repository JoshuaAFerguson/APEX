# ADR-081: Browser Automation Permission-Granted Integration Tests

## Status

**Proposed** - Ready for implementation in development stage

## Context

The APEX platform has comprehensive browser automation capabilities integrated with a permission system. Existing tests focus primarily on **permission denial scenarios** (verifying operations are blocked when permissions are not granted). However, the acceptance criteria require tests that verify **permission-granted scenarios** - ensuring that when appropriate permissions are granted, browser automation operations succeed.

### Existing Test Coverage Gap

After analyzing the codebase, the following permission-related test files exist:

| Test File | Focus |
|-----------|-------|
| `browser-automation-permissions.integration.test.ts` | Mixed (some grants, primarily denial scenarios) |
| `browser-security-permissions.integration.test.ts` | Security-focused denial scenarios |
| `browser-sensitive-operations-permissions.integration.test.ts` | Sensitive operation denial scenarios |
| `browser-permission-validation.test.ts` | Permission checking mechanisms |

**Gap Identified**: Need comprehensive integration tests that specifically verify:
1. Operations succeed when appropriate permissions are granted
2. All common browser operations work with proper permissions
3. Different permission levels (allow-always, allow-once) work correctly
4. Permission events are emitted correctly for successful operations

## Decision

### 1. Test Architecture

Create a new integration test file: `tests/integration/browser-permission-granted.integration.test.ts`

This test suite will follow the existing test patterns established in the codebase while specifically testing permission-granted success scenarios.

### 2. Test Categories

```
Browser Permission-Granted Integration Tests
├── Navigation Operations
│   ├── Basic URL navigation with permission
│   ├── Data URL navigation with permission
│   ├── Allowed domain navigation with permission
│   └── Subdomain navigation with permission inheritance
│
├── Click Operations
│   ├── Basic element clicking with permission
│   ├── Button clicking with permission
│   └── Link clicking with permission
│
├── Form Filling Operations
│   ├── Text input with permission
│   ├── Textarea input with permission
│   ├── Clear and type with permission
│   └── Form field value verification
│
├── Screenshot Operations
│   ├── Viewport screenshot with permission
│   ├── Full page screenshot with permission
│   ├── Element screenshot with permission
│   └── Screenshot path/buffer verification
│
├── Text Extraction Operations
│   ├── getText with permission
│   ├── getAttribute with permission
│   └── getHtml with permission
│
├── Scroll/Hover Operations
│   ├── Scroll to coordinates with permission
│   ├── Scroll element into view with permission
│   └── Hover element with permission
│
├── JavaScript Evaluation
│   ├── Basic script evaluation with elevated permission
│   ├── DOM query evaluation with permission
│   └── Script with arguments with permission
│
├── Form Submission
│   ├── Basic form submit with elevated permission
│   └── Form submit with validation with permission
│
├── Permission Level Behavior
│   ├── allow-always persistence across operations
│   ├── allow-once consumption verification
│   └── Permission inheritance from parent scopes
│
└── Event Emission Verification
    ├── permission:granted events emitted
    ├── Event metadata accuracy
    └── Event timing verification
```

### 3. Test Infrastructure

#### Dependencies (existing)

The tests will leverage existing infrastructure:

```typescript
// From packages/orchestrator
import { BrowserTool } from '@apexcli/orchestrator';
import { PermissionManager } from '@apexcli/orchestrator';
import { PermissionStore } from '@apexcli/orchestrator';

// From test utilities
import { createTestTask, MockBrowserSession } from 'packages/orchestrator/src/__tests__/v050-integration/test-utils';
```

#### Test Environment Setup

```typescript
// Standard setup pattern from existing tests
beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-granted-'));

  permissionStore = new PermissionStore(testDir);
  await permissionStore.initialize();
  permissionManager = new PermissionManager(permissionStore);

  browserTool = new BrowserTool({
    permissionManager,
    backend: 'playwright',
    headless: true,
    eventEmitter: new EventEmitter(),
  });

  // Track permission events
  permissionEvents = [];
  browserTool.eventEmitter.on('permission:granted', (event) => {
    permissionEvents.push({ type: 'granted', ...event });
  });
});

afterEach(async () => {
  await browserTool?.cleanup();
  await permissionStore?.close();
  await fs.rm(testDir, { recursive: true, force: true });
});
```

### 4. Key Test Scenarios

#### 4.1 Navigation with Permission

```typescript
it('should navigate successfully when permission is granted', async () => {
  // Grant navigation permission
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

  const result = await browserTool.execute({
    operation: 'navigate',
    params: { url: 'data:text/html,<h1>Test Page</h1>' }
  });

  expect(result.success).toBe(true);
  expect(result.metadata?.permissionGranted).toBe(true);
  expect(result.data).toHaveProperty('url');
});
```

#### 4.2 Click with Permission

```typescript
it('should click elements successfully when permission is granted', async () => {
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
  await permissionManager.grantPermission('Browser', 'allow-always', 'click');

  // Navigate to test page
  await browserTool.execute({
    operation: 'navigate',
    params: { url: 'data:text/html,<button id="test-btn">Click Me</button>' }
  });

  const result = await browserTool.execute({
    operation: 'click',
    params: { selector: '#test-btn' }
  });

  expect(result.success).toBe(true);
  expect(result.metadata?.permissionGranted).toBe(true);
});
```

#### 4.3 Form Filling with Permission

```typescript
it('should fill forms successfully when permission is granted', async () => {
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
  await permissionManager.grantPermission('Browser', 'allow-always', 'type');

  await browserTool.execute({
    operation: 'navigate',
    params: { url: 'data:text/html,<input type="text" id="name" />' }
  });

  const result = await browserTool.execute({
    operation: 'type',
    params: { selector: '#name', text: 'Test User' }
  });

  expect(result.success).toBe(true);
  expect(result.metadata?.permissionGranted).toBe(true);
});
```

#### 4.4 Screenshot with Permission

```typescript
it('should capture screenshots successfully when permission is granted', async () => {
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
  await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

  await browserTool.execute({
    operation: 'navigate',
    params: { url: 'data:text/html,<h1>Screenshot Test</h1>' }
  });

  const result = await browserTool.execute({
    operation: 'screenshot',
    params: { fullPage: false }
  });

  expect(result.success).toBe(true);
  expect(result.screenshot).toBeDefined();
  expect(result.metadata?.permissionGranted).toBe(true);
});
```

#### 4.5 JavaScript Evaluation with Elevated Permission

```typescript
it('should evaluate JavaScript successfully with elevated permission', async () => {
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
  await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

  await browserTool.execute({
    operation: 'navigate',
    params: { url: 'data:text/html,<title>Test Title</title>' }
  });

  const result = await browserTool.execute({
    operation: 'evaluate',
    params: { script: 'return document.title;' }
  });

  expect(result.success).toBe(true);
  expect(result.data?.result).toBe('Test Title');
  expect(result.metadata?.permissionGranted).toBe(true);
});
```

#### 4.6 Form Submission with Elevated Permission

```typescript
it('should submit forms successfully with elevated permission', async () => {
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
  await permissionManager.grantPermission('Browser', 'allow-always', 'submit');

  await browserTool.execute({
    operation: 'navigate',
    params: {
      url: 'data:text/html,<form id="test-form" onsubmit="return false"><button type="submit">Submit</button></form>'
    }
  });

  const result = await browserTool.execute({
    operation: 'submit',
    params: { selector: '#test-form' }
  });

  expect(result.success).toBe(true);
  expect(result.metadata?.permissionGranted).toBe(true);
});
```

#### 4.7 Permission Level Behavior

```typescript
describe('Permission Level Behavior', () => {
  it('should persist allow-always across multiple operations', async () => {
    await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

    // Multiple navigations should all succeed
    for (let i = 0; i < 3; i++) {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: `data:text/html,<h1>Page ${i}</h1>` }
      });

      expect(result.success).toBe(true);
    }
  });

  it('should consume allow-once after first operation', async () => {
    await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

    // First navigation succeeds
    const result1 = await browserTool.execute({
      operation: 'navigate',
      params: { url: 'data:text/html,<h1>First</h1>' }
    });
    expect(result1.success).toBe(true);

    // Second navigation should fail (permission consumed)
    const result2 = await browserTool.execute({
      operation: 'navigate',
      params: { url: 'data:text/html,<h1>Second</h1>' }
    });
    expect(result2.success).toBe(false);
  });
});
```

#### 4.8 Event Emission Verification

```typescript
it('should emit permission:granted events for successful operations', async () => {
  await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

  await browserTool.execute({
    operation: 'navigate',
    params: { url: 'data:text/html,<h1>Test</h1>' }
  });

  // Verify permission:granted event was emitted
  expect(permissionEvents).toContainEqual(
    expect.objectContaining({
      type: 'granted',
      tool: 'Browser',
      operation: 'navigate',
    })
  );

  // Verify event has required metadata
  const grantedEvent = permissionEvents.find(e => e.type === 'granted');
  expect(grantedEvent).toHaveProperty('timestamp');
  expect(grantedEvent).toHaveProperty('sessionId');
});
```

### 5. Test Data Strategy

#### Use Data URLs for Self-Contained Tests

```typescript
const TEST_PAGES = {
  simple: 'data:text/html,<html><body><h1>Test</h1></body></html>',
  withButton: 'data:text/html,<button id="btn">Click</button>',
  withForm: 'data:text/html,<form id="form"><input id="name"><button>Submit</button></form>',
  withLinks: 'data:text/html,<a href="#section1">Link</a><div id="section1">Section</div>',
};
```

This approach:
- Avoids network dependencies
- Makes tests self-contained
- Runs faster in CI/CD
- Works in headless mode

### 6. File Structure

```
tests/integration/
├── browser-permission-granted.integration.test.ts  # New file
├── browser-automation-permissions.integration.test.ts  # Existing
├── browser-security-permissions.integration.test.ts  # Existing
├── browser-sensitive-operations-permissions.integration.test.ts  # Existing
└── browser-permission-validation.test.ts  # Existing
```

### 7. Coverage Requirements

The new test suite must cover:

| Operation | Permission Level | Scenarios |
|-----------|------------------|-----------|
| navigate | allow-always, allow-once | Basic URL, data URL, allowed domains |
| click | allow-always, allow-once | Buttons, links, elements |
| type | allow-always, allow-once | Text inputs, clear first |
| screenshot | allow-always, allow-once | Viewport, full page, element |
| getText | allow-always | Single element, multiple |
| getAttribute | allow-always | Various attributes |
| getHtml | allow-always | Element, full page |
| scroll | allow-always | Coordinates, element |
| hover | allow-always | Basic hover |
| evaluate | allow-always (elevated) | DOM queries, return values |
| submit | allow-always (elevated) | Form submission |
| waitForSelector | allow-always | Element waiting |

### 8. Integration with CI/CD

Tests should run as part of the standard test suite:

```bash
npm run test  # Includes new tests
npm run test -- tests/integration/browser-permission-granted.integration.test.ts  # Run specific test
```

## Consequences

### Positive

1. **Comprehensive coverage**: Fills the gap in permission-granted scenario testing
2. **Acceptance criteria met**: Directly addresses the requirement for permission success tests
3. **Self-contained tests**: Data URLs eliminate external dependencies
4. **Pattern consistency**: Follows existing test infrastructure patterns
5. **Event verification**: Confirms proper event emission for granted permissions

### Negative

1. **Browser startup overhead**: Each test requires browser initialization
2. **Test execution time**: Browser tests are inherently slower than unit tests
3. **Platform dependencies**: Requires Playwright/Puppeteer browser binaries

### Mitigations

1. Use `beforeAll` browser setup to reduce startup overhead
2. Group related tests to reuse browser context
3. Ensure CI has browser dependencies pre-installed

## Implementation Notes

### For Developer Stage

1. Create test file at `tests/integration/browser-permission-granted.integration.test.ts`
2. Follow the test structure outlined in Section 4
3. Use existing test utilities from `test-utils.ts`
4. Ensure all tests pass with `npm run test`
5. Verify build passes with `npm run build`

### Test Naming Convention

```typescript
describe('Browser Permission-Granted Integration', () => {
  describe('Navigation Operations', () => {
    it('should navigate to data URL when permission is granted');
    it('should navigate to allowed domains when permission is granted');
  });

  describe('Click Operations', () => {
    it('should click buttons when permission is granted');
    it('should click links when permission is granted');
  });

  // etc.
});
```

## Related ADRs

- ADR-080: Browser Integration Test Infrastructure
- ADR-051: Multi-page Browser Workflows Integration Tests

## Verification Checklist

- [ ] Test file created and follows patterns
- [ ] All common browser operations covered
- [ ] Permission levels (allow-always, allow-once) tested
- [ ] Event emission verified
- [ ] Tests pass with `npm run test`
- [ ] Build passes with `npm run build`
- [ ] No regressions in existing tests
