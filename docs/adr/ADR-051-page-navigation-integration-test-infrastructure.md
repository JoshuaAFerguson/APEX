# ADR-051: Page Navigation Integration Test Infrastructure

## Status

Accepted

## Context

APEX requires comprehensive integration testing for page navigation features within browser automation workflows. The navigation testing needs to cover:

- Basic navigation flows (forward, back, refresh)
- URL routing and parameter validation
- Navigation history management
- Cross-origin navigation testing
- Page load state management
- Navigation performance measurement
- Error handling during navigation

The existing browser integration test infrastructure provides a foundation, but navigation-specific testing requires specialized utilities, fixtures, and a mock server for controlled scenarios.

## Decision

We will implement a dedicated page navigation integration test infrastructure with the following architecture:

### 1. Directory Structure

```
tests/page-navigation/
├── vitest.config.ts              # Navigation-specific Vitest configuration
├── setup.ts                      # Global setup/teardown and browser utilities
├── README.md                     # Comprehensive documentation
├── navigation.integration.test.ts # Sample integration tests
├── fixtures/
│   └── navigation-scenarios.ts   # Reusable navigation test scenarios
└── utils/
    └── navigation-helpers.ts     # Navigation test utility functions
```

### 2. Technology Stack

- **Test Framework**: Vitest (consistent with existing test infrastructure)
- **Browser Automation**: Playwright (already a project dependency)
- **Mock Server**: Node.js HTTP server (built into setup.ts)
- **Environment**: Node.js (for browser automation control)

### 3. Key Components

#### Setup File (`setup.ts`)
- Global browser instance management
- Mock server lifecycle management (start/stop)
- Navigation tracking configuration
- Performance monitoring setup
- Temporary directory management for test artifacts
- Screenshot capture utilities

#### Navigation Scenarios (`fixtures/navigation-scenarios.ts`)
- Predefined navigation test flows
- Scenario runner with step execution
- Expected outcome validation
- Performance threshold checking

#### Navigation Helpers (`utils/navigation-helpers.ts`)
- Safe navigation with retry logic
- Navigation state validation
- Performance measurement utilities
- History management testing
- Navigation event monitoring

### 4. Mock Server Design

The integrated mock server provides controlled navigation scenarios:

| Route | Purpose |
|-------|---------|
| `/` | Home page with navigation menu |
| `/page1`, `/page2`, `/page3` | Test pages with navigation controls |
| `/slow` | Simulates slow loading (2s delay) |
| `/error` | Returns 500 for error handling |
| `/redirect?to=URL` | HTTP redirect testing |

### 5. Vitest Configuration

Navigation-specific configuration includes:

```typescript
{
  test: {
    environment: 'node',
    testTimeout: 60000,       // Extended for navigation operations
    hookTimeout: 30000,       // For browser setup/teardown
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,          // Limit concurrent browser instances
        minForks: 1,
      },
    },
    sequence: {
      shuffle: false,         // Prevent navigation conflicts
    },
  },
}
```

### 6. NPM Scripts

```json
{
  "test:page-navigation": "vitest run --config tests/page-navigation/vitest.config.ts",
  "test:page-navigation:watch": "vitest --config tests/page-navigation/vitest.config.ts",
  "test:page-navigation:coverage": "vitest run --config tests/page-navigation/vitest.config.ts --coverage",
  "validate:page-navigation-infrastructure": "node -e \"...\""
}
```

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    Page Navigation Test Suite                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐    ┌────────────────────┐                   │
│  │  Vitest Runner  │───▶│  setup.ts          │                   │
│  └─────────────────┘    │  - Browser init    │                   │
│                         │  - Mock server     │                   │
│                         │  - Temp dirs       │                   │
│                         └────────────────────┘                   │
│                                  │                                │
│         ┌────────────────────────┼────────────────────────┐      │
│         ▼                        ▼                        ▼      │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────┐  │
│  │  Test Files  │    │  Navigation       │    │  Fixtures/   │  │
│  │  *.test.ts   │◀──▶│  Helpers          │◀──▶│  Scenarios   │  │
│  └──────────────┘    └───────────────────┘    └──────────────┘  │
│         │                        │                        │      │
│         └────────────────────────┼────────────────────────┘      │
│                                  ▼                                │
│                    ┌────────────────────────┐                    │
│                    │     Playwright         │                    │
│                    │  ┌──────────────────┐  │                    │
│                    │  │  Browser Context │  │                    │
│                    │  │  - Chromium      │  │                    │
│                    │  │  - Firefox       │  │                    │
│                    │  │  - WebKit        │  │                    │
│                    │  └──────────────────┘  │                    │
│                    └────────────────────────┘                    │
│                                  │                                │
│                                  ▼                                │
│                    ┌────────────────────────┐                    │
│                    │     Mock Server        │                    │
│                    │  - Navigation routes   │                    │
│                    │  - Redirects           │                    │
│                    │  - Error scenarios     │                    │
│                    │  - Slow responses      │                    │
│                    └────────────────────────┘                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Test Initialization**
   - Vitest loads configuration from `vitest.config.ts`
   - `setup.ts` runs before all tests
   - Mock server starts on random available port
   - Browser instance is ready for tests

2. **Test Execution**
   - Individual tests use helpers for safe navigation
   - Navigation events are monitored and tracked
   - Performance metrics are collected
   - Screenshots captured for debugging

3. **Test Cleanup**
   - Browser contexts/pages closed
   - Mock server stopped
   - Temporary files cleaned up

## Key Design Decisions

### Why Playwright over Puppeteer?
- Multi-browser support (Chromium, Firefox, WebKit)
- Better API for navigation testing
- Built-in waiting and timeout handling
- Already a project dependency

### Why Vitest over Jest?
- Consistent with existing test infrastructure
- Native TypeScript support
- Faster execution
- Better ESM support

### Why a Mock Server?
- Controlled test environment
- Predictable navigation behavior
- Ability to simulate edge cases (slow, error, redirect)
- No external dependencies during testing

### Why Sequential Test Execution?
- Navigation tests can conflict when running in parallel
- Browser resource management
- More reliable test results

## Consequences

### Positive
- Comprehensive navigation testing capability
- Consistent with existing infrastructure patterns
- Reusable utilities and fixtures
- Good documentation and examples
- Performance monitoring built-in

### Negative
- Additional test suite to maintain
- Slower execution than unit tests (browser overhead)
- Requires Playwright browser binaries

### Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Flaky tests due to timing | Retry configuration in CI, extended timeouts |
| Resource exhaustion | Limited concurrency, proper cleanup |
| Browser version drift | Use Playwright's browser management |

## Verification

The infrastructure includes:
- Sample integration test demonstrating all features
- README documentation with examples
- Validation script for infrastructure checking
- Coverage integration

## Related ADRs

- ADR for browser integration tests (tests/browser-integration)
- ADR for keyboard integration tests (tests/keyboard-integration)
- ADR for form integration tests (tests/form-integration)

## References

- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [APEX Browser Integration Tests](../tests/browser-integration/README.md)
