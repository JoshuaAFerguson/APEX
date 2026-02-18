# ADR-051: compareScreenshot() Helper Function

## Status
Accepted

## Context

The `@apex/core` package already has a robust `ScreenshotComparator` class with comprehensive image comparison capabilities. However, the acceptance criteria for the visual regression testing feature requires a simplified `compareScreenshot()` helper function with a specific signature:

```typescript
compareScreenshot(baseline: string, actual: string, options?: CompareOptions): Promise<ComparisonResult>
```

### Current Implementation

The existing `ScreenshotComparator` class provides:
- `compare(imagePath1, imagePath2, options)` - compares file paths
- `compareBuffers(buffer1, buffer2, options)` - compares buffers directly
- `createScreenshotComparator()` - factory function
- `compareImages()` - utility function returning boolean match status

### Requirements Gap

The acceptance criteria specifies:
1. Accept file paths **or base64 images** for baseline and actual screenshots
2. Return a `ComparisonResult` with match status, diff percentage, **and diff image data**
3. Uses pixel-level comparison with configurable threshold
4. Has unit tests covering match, mismatch, and edge cases

## Decision

Create a new `compareScreenshot()` helper function in `@apex/core` that wraps the existing `ScreenshotComparator` class, adding:

1. **Automatic input detection** - Detect whether input is a file path or base64-encoded image
2. **Base64 support** - Convert base64 strings to buffers for comparison
3. **Enhanced result type** - Return `ComparisonResult` with `diffImageData` as base64

### Type Definitions

```typescript
/**
 * Options for compareScreenshot helper function
 */
export interface CompareOptions {
  /** Pixel difference tolerance threshold (0-1). Default: 0.1 */
  threshold?: number;
  /** Whether to include alpha channel in comparison. Default: false */
  includeAlpha?: boolean;
  /** Whether to generate diff image. Default: true */
  generateDiff?: boolean;
  /** Color for highlighting different pixels [R, G, B]. Default: [255, 0, 255] (magenta) */
  diffColor?: [number, number, number];
}

/**
 * Result of screenshot comparison
 */
export interface ComparisonResult {
  /** Whether images match within threshold */
  match: boolean;
  /** Percentage of different pixels (0-100) */
  diffPercentage: number;
  /** Number of different pixels */
  diffPixels: number;
  /** Total number of pixels compared */
  totalPixels: number;
  /** Similarity score (0-1, where 1 is identical) */
  similarity: number;
  /** Base64-encoded diff image data (PNG format, only if generateDiff is true) */
  diffImageData?: string;
}
```

### Function Signature

```typescript
/**
 * Compare two screenshots for visual differences
 *
 * @param baseline - File path or base64-encoded image for baseline
 * @param actual - File path or base64-encoded image for actual screenshot
 * @param options - Comparison options
 * @returns Comparison result with match status, diff percentage, and diff image data
 *
 * @example
 * // Compare two file paths
 * const result = await compareScreenshot('/path/to/baseline.png', '/path/to/actual.png');
 *
 * @example
 * // Compare base64 images
 * const result = await compareScreenshot(base64Baseline, base64Actual, { threshold: 0.05 });
 *
 * @example
 * // Mix file path and base64
 * const result = await compareScreenshot('/path/to/baseline.png', base64Actual);
 */
export async function compareScreenshot(
  baseline: string,
  actual: string,
  options?: CompareOptions
): Promise<ComparisonResult>;
```

## Architecture

### Input Detection Strategy

The function will detect input type using the following heuristics:

1. **File path detection**:
   - String starts with `/`, `./`, `../`, or contains `/` with a file extension
   - Windows paths: starts with drive letter (e.g., `C:\`)

2. **Base64 detection**:
   - String starts with `data:image/` (data URL format)
   - String contains only valid base64 characters and is reasonably long
   - String does not contain path separators

```typescript
function isBase64Image(input: string): boolean {
  // Data URL format
  if (input.startsWith('data:image/')) {
    return true;
  }

  // Raw base64 detection
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  const minBase64Length = 100; // Minimum length for valid image base64

  // Not a path and matches base64 pattern
  if (!input.includes('/') && !input.includes('\\') &&
      input.length > minBase64Length && base64Regex.test(input.substring(0, 100))) {
    return true;
  }

  return false;
}
```

### Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    compareScreenshot()                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   baseline  │    │   actual    │    │      options        │ │
│  │   string    │    │   string    │    │    CompareOptions   │ │
│  └──────┬──────┘    └──────┬──────┘    └─────────┬───────────┘ │
│         │                  │                      │             │
│         v                  v                      │             │
│  ┌─────────────────────────────┐                 │             │
│  │    detectInputType()        │                 │             │
│  │  • isBase64Image()          │                 │             │
│  │  • isFilePath()             │                 │             │
│  └─────────────┬───────────────┘                 │             │
│                │                                  │             │
│    ┌───────────┴────────────┐                    │             │
│    │                        │                    │             │
│    v                        v                    │             │
│  ┌────────────┐   ┌─────────────────┐           │             │
│  │ File path  │   │  Base64 string  │           │             │
│  │ → readFile │   │  → decodeBase64 │           │             │
│  └─────┬──────┘   └────────┬────────┘           │             │
│        │                   │                     │             │
│        └───────┬───────────┘                     │             │
│                │                                 │             │
│                v                                 │             │
│        ┌───────────────┐                        │             │
│        │    Buffer     │                        │             │
│        │   (baseline)  │                        │             │
│        └───────┬───────┘                        │             │
│                │                                 │             │
│                v                                 v             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           ScreenshotComparator.compareBuffers()          │  │
│  │                                                          │  │
│  │  • Normalize images (resize if needed)                   │  │
│  │  • Pixel-level comparison with threshold                 │  │
│  │  • Generate diff image buffer                            │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │                                 │
│                               v                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Transform Result                               │   │
│  │                                                          │   │
│  │  • Calculate diffPercentage from differentPixels         │   │
│  │  • Encode diff buffer to base64 (if generateDiff)        │   │
│  │  • Determine match status based on threshold             │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │                                 │
│                               v                                 │
│                    ┌───────────────────┐                        │
│                    │ ComparisonResult  │                        │
│                    └───────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Strategy

The implementation will:

1. **Reuse existing infrastructure**: Leverage `ScreenshotComparator.compareBuffers()` for the core comparison logic
2. **Add input normalization layer**: Convert file paths and base64 to buffers before comparison
3. **Enhance result transformation**: Convert internal result format to the `ComparisonResult` interface

### File Structure

```
packages/core/src/
├── screenshot-comparator.ts      # Existing - ScreenshotComparator class
├── compare-screenshot.ts         # NEW - compareScreenshot() helper function
├── types.ts                      # Add CompareOptions, ComparisonResult types
└── index.ts                      # Export new function
```

### Integration with Existing Code

The new function will be a thin wrapper around `ScreenshotComparator`:

```typescript
// packages/core/src/compare-screenshot.ts
import * as fs from 'fs/promises';
import { ScreenshotComparator } from './screenshot-comparator';
import type { CompareOptions, ComparisonResult } from './types';

export async function compareScreenshot(
  baseline: string,
  actual: string,
  options: CompareOptions = {}
): Promise<ComparisonResult> {
  // 1. Detect input types and convert to buffers
  const baselineBuffer = await resolveToBuffer(baseline);
  const actualBuffer = await resolveToBuffer(actual);

  // 2. Create comparator with mapped options
  const comparator = new ScreenshotComparator({
    tolerance: options.threshold ?? 0.1,
    includeAlpha: options.includeAlpha ?? false,
    outputDiff: options.generateDiff !== false,
    diffColor: options.diffColor ?? [255, 0, 255],
  });

  // 3. Perform comparison
  const result = await comparator.compareBuffers(baselineBuffer, actualBuffer);

  // 4. Generate diff image data if requested
  let diffImageData: string | undefined;
  if (options.generateDiff !== false) {
    diffImageData = await generateDiffBase64(baselineBuffer, actualBuffer, comparator);
  }

  // 5. Transform to ComparisonResult
  return {
    match: result.isMatch,
    diffPercentage: (result.differentPixels / result.totalPixels) * 100,
    diffPixels: result.differentPixels,
    totalPixels: result.totalPixels,
    similarity: result.similarity,
    diffImageData,
  };
}
```

## Test Plan

### Unit Tests

1. **Input Type Detection**
   - File path detection (Unix paths, Windows paths)
   - Base64 detection (data URL format, raw base64)
   - Edge cases (empty strings, invalid inputs)

2. **Match Scenarios**
   - Identical images → match: true, diffPercentage: 0
   - Similar images within threshold → match: true
   - Different images → match: false

3. **Mismatch Scenarios**
   - Completely different images → match: false, diffPercentage: ~100
   - Slightly different images → check threshold behavior

4. **Edge Cases**
   - Empty images
   - Different dimensions (should throw error)
   - Invalid file paths (should throw meaningful error)
   - Corrupted base64 (should throw meaningful error)

5. **Options Testing**
   - Custom threshold values
   - generateDiff: false (no diffImageData)
   - Custom diffColor
   - includeAlpha: true

### Test File Structure

```
packages/core/src/__tests__/
├── compare-screenshot.test.ts           # Main unit tests
├── compare-screenshot.edge-cases.test.ts # Edge case tests
├── compare-screenshot.integration.test.ts # Integration with real images
└── fixtures/
    ├── baseline.png
    ├── actual-match.png
    ├── actual-mismatch.png
    └── actual-slight-diff.png
```

## Consequences

### Positive

1. **Simplified API**: Single function call for common comparison use case
2. **Flexible input**: Supports both file paths and base64, enabling use in various contexts
3. **Rich output**: Returns comprehensive comparison data including diff image
4. **Backward compatible**: Existing code using `ScreenshotComparator` continues to work

### Negative

1. **Memory overhead**: Base64 encoding of diff images increases memory usage
2. **Performance**: Additional encoding/decoding step for base64 inputs

### Mitigations

1. **Lazy diff generation**: Only generate diff when `generateDiff` is true (default)
2. **Streaming for large images**: Consider streaming approach for very large images in future

## References

- Existing `ScreenshotComparator` class: `packages/core/src/screenshot-comparator.ts`
- Existing types: `packages/core/src/types.ts` (ScreenshotComparisonOptions, ScreenshotComparisonResult)
- Browser tool comparison: `packages/orchestrator/src/tools/browser-tool.ts` (compareScreenshot operation)
