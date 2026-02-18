# ADR-020: HTML and Text Content Extraction Integration Tests

## Status
Proposed

## Date
2024-12-XX

## Context

The APEX Browser automation tool (`BrowserTool`) provides `getHtml` and `getText` operations for content extraction from web pages. While the existing `screenshot-content-capture.integration.test.ts` includes some coverage for these operations, dedicated integration tests are needed to:

1. Ensure comprehensive coverage of content extraction scenarios
2. Verify extracted content matches expected HTML/text accurately
3. Test edge cases specific to content extraction (not covered by screenshot tests)
4. Provide focused regression testing for content extraction changes

### Current State Analysis

The existing test infrastructure provides:
- `BrowserTool` class in `packages/orchestrator/src/tools/browser-tool.ts` with full `getHtml` and `getText` implementations
- Test helpers in `tests/browser-integration/utils/test-helpers.ts` including `createTestPage()` for rich test content
- `screenshot-content-capture.integration.test.ts` with partial content extraction tests

Current coverage gaps identified:
- No dedicated tests for `getHtml` on full page (returns complete document)
- Limited testing of nested HTML structure preservation
- No tests for content extraction after JavaScript DOM modifications
- No tests for handling of HTML entities and special characters in extraction
- No tests for very large content extraction performance

## Decision

### Test Architecture

Create a new dedicated integration test file: `tests/browser-integration/html-text-content-extraction.integration.test.ts`

The test file will follow the established patterns from `screenshot-content-capture.integration.test.ts`:

```typescript
// Test file structure
tests/
└── browser-integration/
    ├── html-text-content-extraction.integration.test.ts  // NEW
    ├── screenshot-content-capture.integration.test.ts    // Existing
    └── utils/
        ├── test-helpers.ts                               // Existing
        └── content-extraction-fixtures.ts                // NEW (optional)
```

### Test Categories

#### 1. Full HTML Content Extraction Tests
- Extract full page HTML via `getHtml` with no selector (returns `page.content()`)
- Verify DOCTYPE, html, head, and body tags are present
- Verify test-specific content markers are included
- Test that JavaScript-injected content is captured

#### 2. Element-Specific HTML Extraction Tests
- Extract HTML from specific selectors (`.test-header`, `.test-content`, `.test-footer`)
- Verify innerHTML is returned (not outerHTML)
- Test nested element extraction
- Test multiple sequential extractions

#### 3. Visible Text Extraction Tests
- Extract text from full page body
- Extract text from specific elements
- Verify HTML tags are stripped
- Verify whitespace handling and normalization
- Test text extraction from dynamically added content

#### 4. Content Matching Tests (Acceptance Criteria Focus)
- Create expected content fixtures
- Use exact string matching for critical content
- Use pattern matching (regex) for dynamic content
- Verify extracted content matches expected values

#### 5. Edge Case Tests
- Empty elements
- Elements with only whitespace
- Unicode characters and emojis
- HTML entities (`&lt;`, `&gt;`, `&amp;`, `&nbsp;`)
- Very deeply nested structures
- Large content (1000+ paragraphs)

#### 6. Dynamic Content Tests
- Content added via JavaScript after page load
- Content modified via `evaluate` operation
- Content in dynamically created elements

### Technical Implementation Details

#### BrowserTool Operations Used

```typescript
// getHtml operation - returns page content or element innerHTML
interface BrowserGetHtmlParams {
  selector?: string;  // Optional - omit for full page
}

// getText operation - returns element text content
interface BrowserGetTextParams {
  selector: string;  // Required
}
```

#### Expected Response Structure

```typescript
interface BrowserResult {
  success: boolean;
  operation: 'getHtml' | 'getText';
  data: {
    html?: string;  // For getHtml
    text?: string;  // For getText
  };
  error?: string;
  metadata: {
    url: string;
    title?: string;
    executionTime: number;
    permissionGranted: boolean;
  };
}
```

#### Test Fixture Strategy

Use the existing `createTestPage()` helper which returns a data URL with known content:
- Header: "APEX Browser Automation Test Page"
- Content sections: Screenshot Testing, Content Extraction, PDF Generation, Cross-Browser Testing
- Footer: "APEX Integration Testing"
- Special elements: `.empty-element`, `.dynamic-content`

Expected content fixtures for validation:
```typescript
const EXPECTED_CONTENT = {
  headerTitle: 'APEX Browser Automation Test Page',
  headerDescription: 'Comprehensive test page for screenshot and content capture functionality',
  footerText: 'APEX Integration Testing',
  testClasses: ['test-container', 'test-header', 'test-content', 'test-footer'],
};
```

### Test Configuration

```typescript
const TEST_CONFIG = {
  timeout: 60000,
  contentTimeout: 5000,
  selectors: {
    container: '.test-container',
    header: '.test-header',
    content: '.test-content',
    footer: '.test-footer',
    emptyElement: '.empty-element',
    dynamicContent: '.dynamic-content',
    nonExistent: '.non-existent-element',
  },
};
```

### Error Handling Tests

| Scenario | Expected Behavior |
|----------|------------------|
| Non-existent selector for getText | `success: false`, error contains "not found" |
| Non-existent selector for getHtml | `success: false`, error contains "not found" |
| Malformed CSS selector | `success: false`, error defined |
| Empty element text | `success: true`, `text: ''` |
| Browser not navigated | Graceful failure with error message |

## Consequences

### Positive
- Dedicated test coverage for content extraction operations
- Clear acceptance criteria validation
- Regression testing for future BrowserTool changes
- Documentation of expected content extraction behavior
- Performance benchmarking for large content

### Negative
- Additional test file to maintain
- Some test overlap with existing screenshot tests
- Requires browser automation infrastructure (Playwright)

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Tests may be flaky due to timing | Use appropriate wait conditions and timeouts |
| Browser engine differences | Focus on content correctness, not exact formatting |
| Test page changes break tests | Use explicit content fixtures with version control |

## Implementation Plan

1. Create the new test file following the architecture above
2. Implement test categories in order of priority
3. Run tests to verify they pass
4. Ensure build passes with no errors

## Related ADRs

- ADR-019: Browser Tool Architecture

## Notes

The tests should use the existing `BrowserTool` from `@apexcli/orchestrator` package, maintaining consistency with the existing test infrastructure. All tests should be written using Vitest with the existing test patterns.
