# ADR-200: Screenshot and Content Capture Integration Tests Architecture

## Status
Proposed

## Context
APEX requires comprehensive integration tests for screenshot capture and content extraction functionality. The browser automation system (`@apexcli/browser` and `@apexcli/orchestrator`) provides capabilities for:
- Full page screenshots
- Element-specific screenshots
- PDF generation from web pages
- HTML content extraction
- Text content extraction

An initial test file exists at `tests/browser-integration/screenshot-content-capture.integration.test.ts` but requires validation, enhancement, and completion to ensure all acceptance criteria are met.

## Decision

### Test Architecture Overview

#### Directory Structure
```
tests/browser-integration/
├── screenshot-content-capture.integration.test.ts  # Main integration tests (exists, needs completion)
├── utils/
│   └── test-helpers.ts                             # Test utilities (needs createTestPage, createTempDir)
├── fixtures/
│   ├── common-scenarios.ts                         # Reusable test scenarios
│   └── test-pages/
│       ├── full-page-test.html                     # Rich content test page
│       ├── element-test.html                       # Element-specific test page
│       └── pdf-test.html                           # PDF generation test page
└── vitest.config.ts                                # Vitest configuration (exists)
```

### Test Categories and Coverage

#### 1. Full Page Screenshots
| Test Case | Description | Priority |
|-----------|-------------|----------|
| PNG format capture | Full page screenshot in PNG format | High |
| JPEG format with quality | Full page JPEG with quality 50/80/100 | High |
| Multiple viewports | Desktop (1920x1080), Tablet (768x1024), Mobile (375x667) | Medium |
| Base64 data return | Screenshot returns base64 when no path provided | High |
| File system save | Screenshot saves to filesystem correctly | High |

#### 2. Element Screenshots
| Test Case | Description | Priority |
|-----------|-------------|----------|
| CSS selector capture | Screenshot specific element by CSS selector | High |
| Multiple elements | Screenshot different elements sequentially | Medium |
| Non-existent element | Graceful handling of missing elements | High |
| Element visibility | Wait for element visibility before capture | Medium |

#### 3. PDF Generation
| Test Case | Description | Priority |
|-----------|-------------|----------|
| Basic PDF export | Generate PDF from page | High |
| PDF options | Format (A4, Letter), margins, landscape mode | Medium |
| Print media styles | Respect @media print CSS rules | Medium |
| PDF file validation | Verify PDF file structure is valid | High |

#### 4. HTML Content Extraction
| Test Case | Description | Priority |
|-----------|-------------|----------|
| Full page HTML | Extract complete page HTML | High |
| Element HTML | Extract specific element innerHTML | High |
| HTML structure preservation | Maintain DOM structure in extraction | Medium |
| Multiple elements | Extract HTML from multiple selectors | Medium |

#### 5. Text Content Extraction
| Test Case | Description | Priority |
|-----------|-------------|----------|
| Full page text | Extract all visible text content | High |
| Element text | Extract text from specific elements | High |
| Text cleanup | Strip HTML tags, preserve spacing | Medium |
| Empty elements | Handle empty content gracefully | Medium |

#### 6. Cross-Browser Compatibility
| Test Case | Description | Priority |
|-----------|-------------|----------|
| Chromium consistency | All operations work on Chromium | High |
| Firefox compatibility | All operations work on Firefox | Medium |
| WebKit compatibility | All operations work on WebKit | Low |

#### 7. Error Handling
| Test Case | Description | Priority |
|-----------|-------------|----------|
| Navigation failures | Handle invalid URLs gracefully | High |
| Selector errors | Handle malformed CSS selectors | High |
| Timeout handling | Proper timeout error messages | Medium |
| Resource cleanup | Browser cleanup on failure | High |

#### 8. Performance Validation
| Test Case | Description | Priority |
|-----------|-------------|----------|
| Screenshot timing | Full page screenshot < 10 seconds | Medium |
| Content extraction timing | HTML/Text extraction < 5 seconds | Medium |
| Large page handling | Handle pages with extensive content | Medium |

### Technical Implementation

#### Key Interfaces

```typescript
// Test context interface
interface TestContext {
  tempDir: string;
  browserTool: BrowserTool;
  testPageUrl: string;
}

// Screenshot result validation
interface ScreenshotResult {
  success: boolean;
  data?: { format: 'png' | 'jpeg' };
  screenshot?: string;  // Base64 or file path
  metadata?: {
    url: string;
    executionTime: number;
    permissionGranted: boolean;
  };
}

// Content extraction result
interface ContentResult {
  success: boolean;
  data?: { html?: string; text?: string };
  error?: string;
}
```

#### PDF Generation Support

PDF generation requires Playwright's `page.pdf()` method. Add to BrowserSession:

```typescript
// packages/browser/src/browser-session.ts
interface PDFOptions {
  path?: string;
  format?: 'Letter' | 'A4' | 'Legal' | 'Tabloid';
  landscape?: boolean;
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
}

async generatePdf(options: PDFOptions = {}): Promise<BrowserActionResult<Buffer>> {
  // Note: PDF generation only works in Chromium
  // Implementation uses page.pdf() from Playwright
}
```

#### Test Utilities Enhancement

The `tests/browser-integration/utils/test-helpers.ts` needs these exports:

```typescript
// Create temporary directory for test artifacts
export async function createTempDir(): Promise<string>;

// Cleanup temporary directory
export async function cleanupTempDir(tempDir: string): Promise<void>;

// Create test page and return URL (data: or file: URL)
export async function createTestPage(): Promise<string>;
```

### Integration with Existing Infrastructure

#### BrowserTool Integration
The tests use `BrowserTool` from `@apexcli/orchestrator`:
- `execute({ operation: 'screenshot', params: {...} })` for screenshots
- `execute({ operation: 'getHtml', params: {...} })` for HTML extraction
- `execute({ operation: 'getText', params: {...} })` for text extraction

#### Test Configuration (vitest.config.ts)
- Uses Playwright as browser backend
- Extended timeout: 60 seconds for browser operations
- Sequential execution to prevent resource conflicts
- Setup file: `./setup.ts` for global browser management

### Test Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Test Suite    │───▶│   BrowserTool    │───▶│   Playwright    │
│                 │    │   (Orchestrator) │    │   Browser       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                      │                       │
        ▼                      ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Test Page     │    │   Permission     │    │   Page Object   │
│   (data: URL)   │    │   Manager        │    │   (screenshot,  │
│                 │    │                  │    │   content)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                                              │
        ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│   Assertions    │◀─────────────────────────│   Result Data   │
│   (Vitest)      │                          │   (Buffer/str)  │
└─────────────────┘                          └─────────────────┘
```

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Coverage | File |
|---------------------|---------------|------|
| Full page screenshots | Full Page Screenshots suite | screenshot-content-capture.integration.test.ts |
| Element screenshots | Element Screenshots suite | screenshot-content-capture.integration.test.ts |
| PDF generation | PDF Generation suite (NEW) | screenshot-content-capture.integration.test.ts |
| HTML/text extraction | HTML Content Extraction + Text Content Extraction suites | screenshot-content-capture.integration.test.ts |
| All tests pass with `npm run test` | CI/CD integration | package.json test script |

## Implementation Tasks

### Phase 1: Test Utilities Setup
1. Add `createTempDir()` and `cleanupTempDir()` to test-helpers.ts
2. Implement `createTestPage()` function that returns a data: URL
3. Ensure cleanup hooks properly dispose of browser resources

### Phase 2: Complete Existing Tests
1. Review and fix any failing tests in screenshot-content-capture.integration.test.ts
2. Add missing assertions for metadata validation
3. Add proper error message validation

### Phase 3: PDF Generation
1. Add `generatePdf()` method to BrowserSession class
2. Add `pdf` operation to BrowserTool
3. Create PDF generation test suite

### Phase 4: Cross-Browser and Performance
1. Implement cross-browser test suite (optionally skipped in CI)
2. Add performance benchmarking tests
3. Validate resource cleanup on all code paths

## Consequences

### Positive
- Comprehensive test coverage for screenshot and content capture
- Clear documentation of expected behavior
- Regression protection for browser automation features
- PDF generation capability added to APEX

### Negative
- Browser tests are slower than unit tests
- Cross-browser tests require multiple browser installations
- PDF generation only works in Chromium (Playwright limitation)

### Risks
- Flaky tests due to browser timing variations
- Test page content changes may affect screenshot comparisons
- Network-dependent tests may fail in CI without proper mocking

## Related ADRs
- ADR-090: Browser Automation Integration Test Infrastructure
- ADR-051: compareScreenshot Helper Function
- ADR-052: Element Interaction Integration Test Infrastructure

## References
- [Playwright Screenshot API](https://playwright.dev/docs/screenshots)
- [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf)
- [Vitest Configuration](https://vitest.dev/config/)
