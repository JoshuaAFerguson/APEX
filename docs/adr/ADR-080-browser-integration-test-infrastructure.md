# ADR-080: Browser Integration Test Infrastructure

## Status

**Accepted** - Infrastructure is fully implemented and operational

## Context

The APEX platform requires comprehensive browser automation testing infrastructure for browser-based capture tests. This includes:

- Browser automation library support (Playwright and Puppeteer)
- Test fixtures with sample HTML pages
- Integration test configuration compatible with `npm run test`

## Decision

The browser integration test infrastructure has been designed and implemented with a **dual-backend architecture** supporting both Playwright and Puppeteer, along with comprehensive test fixtures and Vitest integration.

### 1. Browser Automation Libraries

#### Primary: Playwright (^1.47.0)
- **Multi-browser support**: Chromium, Firefox, WebKit (Safari)
- **Cross-platform testing**: Desktop and mobile device emulation
- **Headless/headed modes**: CI optimization with headed debugging support
- **Built-in screenshot comparison**: Native visual regression testing
- **Configuration**: `playwright.config.ts` at project root

#### Secondary: Puppeteer (^24.34.0)
- **Chromium-focused**: Optimized for Chrome/Chromium testing
- **Lightweight alternative**: For simpler automation scenarios
- **Configuration**: `puppeteer.config.js` at project root

#### Supporting Dependencies
- `pixelmatch` (^5.3.0) - Screenshot comparison
- `pngjs` (^7.0.0) - PNG image processing
- `@types/puppeteer` (^7.0.4) - TypeScript definitions
- `@types/pixelmatch` (^5.2.6) - TypeScript definitions
- `@types/pngjs` (^6.0.5) - TypeScript definitions

### 2. Test Fixtures Architecture

#### Location: `tests/browser-integration/fixtures/`

| Fixture File | Purpose |
|--------------|---------|
| `basic-test-page.html` | Simple page with basic elements for navigation testing |
| `interactive-test-page.html` | Complex page with interactive elements (buttons, forms) |
| `form-test-page.html` | Form elements for input interaction testing |
| `error-test-page.html` | Pages that generate errors for error handling tests |
| `common-scenarios.ts` | TypeScript scenarios and helper functions |
| `error-page-scenarios.ts` | Error scenario definitions |
| `permission-test-scenarios.ts` | Browser permission testing scenarios |

#### Location: `packages/browser/src/__tests__/fixtures/`

| Fixture File | Purpose |
|--------------|---------|
| `test-page.html` | Navigation test page with buttons and links |
| `page2.html` | Secondary navigation target |
| `page3.html` | Tertiary navigation target |

### 3. Test Configuration

#### Integration Test Config: `tests/browser-integration/vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.browser.test.ts', '**/*.integration.test.ts'],
    testTimeout: 60000,  // 60s for browser operations
    hookTimeout: 30000,  // 30s for setup/teardown
    setupFiles: ['./setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { maxForks: 2, minForks: 1 }
    }
  }
});
```

#### Main Vitest Config: `vitest.config.ts`

The main configuration includes browser integration tests via:
- `tests/**/*.test.ts` pattern
- Environment-specific globs for node environment

### 4. Test Utilities

#### Location: `tests/browser-integration/utils/`

| Utility File | Purpose |
|--------------|---------|
| `test-helpers.ts` | Common browser test utilities (click, fill, wait) |
| `browser-automation-test-helpers.ts` | Advanced browser automation management |
| `browser-permission-mocks.ts` | Permission API mocking utilities |
| `integration-test-context.ts` | APEX-specific integration context |

#### Location: `tests/browser-integration/setup.ts`

Provides:
- Global browser instance management
- Temporary directory creation for artifacts
- Browser context and page factory functions
- Screenshot capture utilities
- Cleanup hooks (beforeAll, afterAll, beforeEach, afterEach)
- Mock browser dependencies for unit testing

### 5. NPM Scripts

```json
{
  "test:browser-integration": "vitest run --config tests/browser-integration/vitest.config.ts",
  "test:browser-integration:watch": "vitest --config tests/browser-integration/vitest.config.ts",
  "test:browser-integration:coverage": "vitest run --config tests/browser-integration/vitest.config.ts --coverage",
  "test:browser-infrastructure": "vitest run tests/browser-integration/infrastructure-verification.test.ts",
  "validate:browser-infrastructure": "node -e \"console.log('Playwright:', require('playwright').chromium ? 'installed' : 'missing'); console.log('Puppeteer:', require('puppeteer') ? 'installed' : 'missing');\""
}
```

### 6. Directory Structure

```
APEX/
├── playwright.config.ts           # Playwright global configuration
├── puppeteer.config.js            # Puppeteer global configuration
├── package.json                   # Dependencies and scripts
├── vitest.config.ts               # Main test configuration
│
├── tests/
│   └── browser-integration/
│       ├── vitest.config.ts       # Browser-specific Vitest config
│       ├── setup.ts               # Global setup/teardown
│       ├── README.md              # Documentation
│       │
│       ├── fixtures/
│       │   ├── basic-test-page.html
│       │   ├── interactive-test-page.html
│       │   ├── form-test-page.html
│       │   ├── error-test-page.html
│       │   ├── common-scenarios.ts
│       │   ├── error-page-scenarios.ts
│       │   └── permission-test-scenarios.ts
│       │
│       ├── utils/
│       │   ├── test-helpers.ts
│       │   ├── browser-automation-test-helpers.ts
│       │   ├── browser-permission-mocks.ts
│       │   └── integration-test-context.ts
│       │
│       └── *.test.ts              # Test files
│
└── packages/browser/
    └── src/__tests__/
        └── fixtures/
            ├── test-page.html
            ├── page2.html
            └── page3.html
```

## Consequences

### Positive

1. **Dual-backend flexibility**: Tests can use either Playwright or Puppeteer based on requirements
2. **Multi-browser coverage**: Tests can run across Chromium, Firefox, and WebKit
3. **CI/CD integration**: Headless mode and artifact management for automated pipelines
4. **Comprehensive fixtures**: Ready-to-use HTML pages for common testing scenarios
5. **npm integration**: All tests run via standard `npm run test` command
6. **Screenshot comparison**: Visual regression testing capabilities built-in
7. **Resource management**: Proper cleanup and resource limiting prevents test conflicts

### Negative

1. **Dual dependency maintenance**: Both Playwright and Puppeteer require updates
2. **Browser binary management**: Need to ensure browser binaries are installed
3. **Extended timeouts**: Browser tests are inherently slower than unit tests

## Verification

The infrastructure can be verified via:

```bash
# Run all browser integration tests
npm run test:browser-integration

# Verify infrastructure setup
npm run validate:browser-infrastructure

# Run with main test suite
npm run test
```

## Related ADRs

- ADR-004-browser-navigation-api.md (packages/browser)
- ADR-002-console-capture-integration-tests.md (packages/browser)
- ADR-004-browser-test-utils-module.md (packages/browser)
