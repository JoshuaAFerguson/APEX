# ADR-051: Full Page Screenshot Integration Tests Architecture

## Status
Proposed

## Context

The task requires creating integration tests for full page screenshot capture functionality. Based on analysis of the existing codebase:

### Existing Implementation
- **Location**: `packages/browser/src/browser-session.ts` (lines 857-891)
- **Method**: `captureFullPage(options: ScreenshotOptions = {}): Promise<BrowserActionResult<Buffer>>`
- **Features**:
  - Full page capture via Playwright's `fullPage: true` option
  - PNG (default) and JPEG format support
  - Configurable JPEG quality (0-100)
  - Optional file path saving
  - Buffer return for programmatic use
  - Error handling with meaningful messages

### Existing Test Coverage
Analysis of existing tests in `packages/browser/src/__tests__/`:
1. **captureFullPage-integration.test.ts** - Integration with navigation, interactions, and other captures
2. **captureFullPage-edge-cases.test.ts** - Edge cases including empty content, errors, extreme dimensions
3. **captureFullPage-performance.test.ts** - Performance benchmarks and stress testing
4. **captureFullPage-final-validation.test.ts** - Comprehensive acceptance criteria validation

### Gap Analysis
The existing tests are **comprehensive and well-structured**. However, I identified the following areas that could benefit from additional coverage:

1. **Viewport sizing tests** - Explicit tests for various viewport dimensions
2. **Scroll handling verification** - Tests that verify content from scroll positions is captured
3. **Image dimension verification** - Tests that validate actual image dimensions match expectations
4. **Cross-browser consistency** - Tests that verify behavior across Chromium/Firefox/WebKit

## Decision

### Technical Design for Additional Integration Tests

Based on the acceptance criteria ("Full page screenshot tests exist and pass, tests verify image output format and dimensions"), I recommend the following test architecture:

#### 1. Test File Structure

```
packages/browser/src/__tests__/
├── captureFullPage-integration.test.ts     (existing)
├── captureFullPage-edge-cases.test.ts      (existing)
├── captureFullPage-performance.test.ts     (existing)
├── captureFullPage-final-validation.test.ts (existing)
└── captureFullPage-viewport-dimensions.test.ts  (NEW - if gaps exist)
```

#### 2. Key Test Categories

##### A. Image Output Format Verification (Already Covered)
```typescript
// Verify PNG signature: 0x89 0x50 0x4E 0x47
expect(result.data![0]).toBe(0x89);
expect(result.data![1]).toBe(0x50);

// Verify JPEG signature: 0xFF 0xD8
expect(jpegResult.data![0]).toBe(0xFF);
expect(jpegResult.data![1]).toBe(0xD8);
```

##### B. Viewport Sizing Tests
```typescript
describe('Viewport Sizing', () => {
  const viewportSizes = [
    { width: 320, height: 568, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop HD' },
    { width: 2560, height: 1440, name: 'desktop 2K' },
  ];

  for (const size of viewportSizes) {
    it(`should capture full page at ${size.name} viewport (${size.width}x${size.height})`, async () => {
      // Test captures work correctly at various viewport sizes
    });
  }
});
```

##### C. Scroll Handling Verification
```typescript
describe('Scroll Handling', () => {
  it('should capture content from all scroll positions', async () => {
    // Create page with markers at different vertical positions
    // Capture full page and verify all markers are included
  });

  it('should restore scroll position after capture', async () => {
    // Verify scroll position is preserved after captureFullPage
  });
});
```

##### D. Image Dimension Verification
```typescript
describe('Image Dimensions', () => {
  it('should capture images with width matching viewport', async () => {
    // Use PNG metadata parsing to verify image dimensions
    // Width should match configured viewport width
  });

  it('should capture images with height matching page content', async () => {
    // Create page with known height (e.g., 3000px)
    // Verify captured image height exceeds viewport height
  });
});
```

#### 3. Test Infrastructure Requirements

| Component | Description | Status |
|-----------|-------------|--------|
| BrowserManager | Browser lifecycle management | Existing |
| BrowserSession | Session with captureFullPage method | Existing |
| ScreenshotOptions | Type definitions for options | Existing |
| Temp directory handling | File system cleanup | Existing |
| PNG parsing (pngjs) | For dimension verification | Existing |
| Vitest | Test framework | Existing |

#### 4. Technical Implementation Details

##### Image Dimension Parsing
```typescript
import { PNG } from 'pngjs';

function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  // PNG files store dimensions in IHDR chunk (bytes 16-23)
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
  // For JPEG, use a JPEG parsing library or skip dimension tests
  throw new Error('Dimension parsing only supported for PNG');
}
```

##### Scroll Position Verification
```typescript
async function getScrollPosition(session: BrowserSession): Promise<{ x: number; y: number }> {
  const result = await session.evaluate('({ x: window.scrollX, y: window.scrollY })');
  return result.data as { x: number; y: number };
}
```

#### 5. Test Execution Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Execution Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Setup Phase                                                 │
│     ├── Create BrowserManager                                   │
│     ├── Create BrowserSession with specific viewport            │
│     ├── Launch browser in headless mode                         │
│     └── Create temp directory for file outputs                  │
│                                                                 │
│  2. Test Execution                                              │
│     ├── Navigate to test page (data: URL or localhost)          │
│     ├── Execute captureFullPage with various options            │
│     ├── Verify result success                                   │
│     ├── Verify buffer contents (format signature)               │
│     ├── Verify image dimensions (if PNG)                        │
│     └── Verify file saves correctly (if path specified)         │
│                                                                 │
│  3. Cleanup Phase                                               │
│     ├── Close browser session                                   │
│     ├── Shutdown browser manager                                │
│     └── Remove temp directory                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 6. Existing Coverage Assessment

Based on my analysis, the existing tests **already cover** the acceptance criteria:

| Acceptance Criterion | Existing Coverage | Location |
|---------------------|-------------------|----------|
| Full page screenshot tests exist | ✅ Yes (72+ tests) | captureFullPage-*.test.ts |
| Tests pass | ✅ Designed to pass | All test files |
| Verify image output format | ✅ PNG/JPEG signatures | edge-cases, final-validation |
| Verify image dimensions | ⚠️ Partial (size comparisons) | integration, performance |

#### 7. Recommended Actions

Given the comprehensive existing coverage, I recommend:

1. **Primary**: Verify existing tests pass with `npm run test`
2. **Secondary**: Add explicit dimension verification tests if needed
3. **Optional**: Add cross-browser tests for webkit/firefox if required

## Consequences

### Positive
- Builds on well-established test patterns in the codebase
- Leverages existing infrastructure (BrowserManager, BrowserSession)
- Follows ADR patterns established in the project
- Comprehensive coverage of acceptance criteria

### Negative
- May have redundancy with existing tests
- PNG dimension parsing adds complexity

### Risks
- Browser automation tests can be flaky due to timing
- Different browsers may have subtle rendering differences

## References
- `packages/browser/src/browser-session.ts` - captureFullPage implementation (lines 857-891)
- `packages/browser/src/types.ts` - ScreenshotOptions, BrowserActionResult types
- `packages/browser/src/__tests__/captureFullPage-*.test.ts` - Existing test files
- `packages/orchestrator/src/tools/browser-tool.adr.md` - Browser tool architecture
- `docs/adr/` - Project ADR conventions
