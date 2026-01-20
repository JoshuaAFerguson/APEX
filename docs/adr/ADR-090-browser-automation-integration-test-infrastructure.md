# ADR-090: Browser Automation Integration Test Infrastructure

## Status
Accepted

## Date
2026-01-19

## Context

The APEX project requires robust integration test infrastructure for browser automation capabilities. This infrastructure must support:

1. Testing browser session lifecycle management
2. Cross-browser compatibility testing (Chromium, Firefox, WebKit)
3. Screenshot capture and visual comparison
4. Console capture and error detection
5. Navigation and interaction testing
6. Integration with the orchestrator's tool system and permission system

### Current State Analysis

The codebase already has substantial browser automation testing infrastructure:

| Component | Status | Location |
|-----------|--------|----------|
| Playwright dependency | ✅ Installed | `packages/browser/package.json` |
| Test utilities | ✅ Exists | `packages/browser/src/__tests__/test-utils.ts` |
| HTML fixtures | ✅ Exists | `packages/browser/src/__tests__/fixtures/*.html` |
| Integration tests | ✅ Exists | `packages/browser/src/__tests__/integration.test.ts` |
| Vitest configuration | ✅ Configured | `vitest.config.ts` |
| Browser package tests | ✅ Working | `packages/browser/src/__tests__/*.test.ts` |

This ADR documents the existing architecture and defines enhancements for the integration test infrastructure.

## Decision

### Architecture Overview

The browser automation integration test infrastructure follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Test Layer (Vitest)                         │
├─────────────────────────────────────────────────────────────────┤
│  packages/browser/src/__tests/                                  │
│  ├── integration.test.ts          # Full workflow tests         │
│  ├── browser-session.test.ts      # Session lifecycle           │
│  ├── browser-manager.test.ts      # Multi-session management    │
│  ├── screenshot-*.test.ts         # Screenshot capture tests    │
│  ├── console-*.test.ts            # Console capture tests       │
│  ├── navigation-*.test.ts         # Navigation API tests        │
│  └── fixtures/                    # HTML test pages             │
├─────────────────────────────────────────────────────────────────┤
│                   Test Utilities Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  packages/browser/src/__tests__/test-utils.ts                   │
│  ├── TestPages (content generators)                             │
│  ├── ScreenshotValidators (result validation)                   │
│  ├── PerformanceMonitor (timing measurements)                   │
│  ├── MockScenarios (error simulation)                           │
│  └── TestDataGenerators (content generation)                    │
├─────────────────────────────────────────────────────────────────┤
│                    Browser Package Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  packages/browser/src/                                          │
│  ├── browser-manager.ts           # Multi-browser management    │
│  ├── browser-session.ts           # Individual session control  │
│  ├── screenshot-utility.ts        # Screenshot capture          │
│  └── index.ts                     # Public API exports          │
├─────────────────────────────────────────────────────────────────┤
│                     Playwright Layer                            │
└─────────────────────────────────────────────────────────────────┘
```

### Test Fixture Structure

```
packages/browser/src/__tests__/fixtures/
├── test-page.html      # Primary navigation test page
├── page2.html          # Secondary navigation target
├── page3.html          # Tertiary navigation target
└── (extensible for additional scenarios)
```

### Test Utilities API

The `test-utils.ts` module provides:

#### 1. TestPages - HTML Content Generators
```typescript
TestPages.simple(title?: string, backgroundColor?: string): string
TestPages.tall(height?: number): string
TestPages.complex(): string
TestPages.unicode(): string
TestPages.empty(): string
TestPages.transparent(): string
```

#### 2. ScreenshotValidators - Result Validation
```typescript
ScreenshotValidators.isPNG(buffer: Buffer): boolean
ScreenshotValidators.isJPEG(buffer: Buffer): boolean
ScreenshotValidators.isValidResult(result: any): boolean
ScreenshotValidators.isSuccessfulResult(result: any): boolean
ScreenshotValidators.isFailedResult(result: any): boolean
```

#### 3. PerformanceMonitor - Timing Utilities
```typescript
class PerformanceMonitor {
  start(): void
  stop(): number
  getAverage(): number
  getMedian(): number
  getMin(): number
  getMax(): number
  getStats(): PerformanceStats
  reset(): void
}
```

#### 4. MockScenarios - Error Simulation
```typescript
MockScenarios.slowLoadingPage(page: Page, delay?: number): Promise<void>
MockScenarios.networkError(page: Page): Promise<void>
MockScenarios.jsError(): string
```

#### 5. TestDataGenerators - Content Generation
```typescript
TestDataGenerators.generateHeavyContent(elementCount: number): string
TestDataGenerators.randomColor(): string
TestDataGenerators.randomTestPage(): string
```

### Integration Test Patterns

#### Pattern 1: Browser Session Lifecycle
```typescript
describe('Browser Session Lifecycle', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = createBrowserManager();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  it('should complete full lifecycle', async () => {
    const session = createBrowserSession(manager);
    await session.launch();
    await session.navigate('data:text/html,<h1>Test</h1>');
    await session.screenshot();
    await session.close();
  });
});
```

#### Pattern 2: Cross-Browser Testing
```typescript
const browsers = ['chromium', 'firefox', 'webkit'] as const;

browsers.forEach(browserType => {
  it(`should work with ${browserType}`, async () => {
    const session = createBrowserSession(manager, {
      browserType,
      headless: true
    });
    // ... test implementation
  });
});
```

#### Pattern 3: Error Recovery
```typescript
it('should handle browser crash gracefully', async () => {
  const session = createBrowserSession(manager);
  await session.launch();

  // Force crash
  const browser = session.getBrowser();
  await browser?.close();

  // Subsequent operations should fail gracefully
  const result = await session.navigate('https://example.com');
  expect(result.success).toBe(false);

  // Cleanup should still work
  await session.close();
});
```

### Orchestrator Integration Tests

The orchestrator package contains browser-related integration tests:

```
packages/orchestrator/src/__tests__/
├── browser-automation-integration.test.ts
├── browser-automation-system.test.ts
├── browser-events-*.test.ts
├── browser-manager-integration.test.ts
├── browser-tool-integration-e2e.test.ts
└── v050-integration/
    ├── browser-permission-integration.test.ts
    └── tool-browser-policy-integration.test.ts
```

### Running Integration Tests

```bash
# Run all tests
npm run test

# Run browser package tests only
npm test --workspace=@apex/browser

# Run specific integration test
npx vitest run packages/browser/src/__tests__/integration.test.ts

# Run with coverage
npm run test:coverage

# Watch mode during development
npm run test:watch
```

### Timeouts Configuration

Browser automation tests require extended timeouts due to:
- Browser launch time (~5-10 seconds)
- Network operations
- Multi-browser parallel execution

Default timeout configuration in tests:
```typescript
it('browser test', async () => {
  // ... test code
}, 15000); // 15 second timeout for single browser operations

it('multi-browser test', async () => {
  // ... test code
}, 30000); // 30 second timeout for cross-browser tests

it('performance test', async () => {
  // ... test code
}, 60000); // 60 second timeout for performance/stress tests
```

### Environment Requirements

1. **Node.js** >= 18.0.0
2. **Playwright browsers** installed via `npx playwright install`
3. **Display server** (for non-headless tests on Linux)
4. **Sufficient memory** for multi-browser tests (~500MB per browser instance)

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit Tests | `packages/browser/src/__tests__/*.test.ts` | Individual component testing |
| Integration Tests | `packages/browser/src/__tests__/integration.test.ts` | Full workflow testing |
| E2E Tests | `packages/orchestrator/src/__tests__/*e2e*.test.ts` | End-to-end scenarios |
| Visual Tests | `packages/orchestrator/src/__tests__/visual-*.test.ts` | Screenshot comparison |
| Stress Tests | `packages/browser/src/__tests__/*.stress.test.ts` | Performance/load testing |
| Edge Case Tests | `packages/browser/src/__tests__/*.edge.test.ts` | Boundary conditions |

## Consequences

### Positive
- Comprehensive test coverage for browser automation
- Cross-browser compatibility verification
- Reusable test utilities reduce duplication
- Clear separation of concerns (unit vs integration vs e2e)
- Existing infrastructure is well-documented and extensible

### Negative
- Browser tests are slower than pure unit tests
- Require Playwright browser binaries installed
- Memory intensive when running parallel browser instances
- Flaky test potential due to browser timing issues

### Mitigation Strategies
- Use `headless: true` by default for speed
- Implement retry logic for flaky network operations
- Configure appropriate timeouts per test category
- Run browser tests in CI with isolated environments

## Implementation Checklist

Based on the acceptance criteria, the following items are verified:

- [x] Browser automation test dependencies installed (Playwright in `@apexcli/browser`)
- [x] Test setup/teardown utilities exist (`test-utils.ts`)
- [x] Test fixtures directory structure exists (`fixtures/`)
- [x] Integration test script in package.json (`npm run test` using vitest)

## Related Resources

- `packages/browser/README.md` - Browser package documentation
- `packages/browser/TESTING.md` - Testing guidelines
- `packages/browser/TESTING_SUMMARY.md` - Test coverage summary
- `docs/browser-automation.md` - User-facing documentation
- ADR-051: v0.5.0 Integration Tests Architecture
- ADR-007: Browser Events Orchestrator Integration
