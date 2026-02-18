# ADR-015: Screenshot Comparator Design

## Status

Proposed

## Context

APEX needs a screenshot comparison capability to support visual regression testing and UI verification workflows. This is particularly useful for:
- Automated UI testing during development
- Verifying visual changes before deployment
- Detecting unexpected visual regressions
- Supporting autonomous visual QA agents

The comparison engine must:
1. Load and compare two PNG images
2. Compute pixel-by-pixel differences
3. Return a similarity score (0-1)
4. Support configurable tolerance thresholds
5. Be performant enough for interactive workflows

## Decision

### Architecture Overview

We will implement a `ScreenshotComparator` class as a standalone utility in `@apex/core`, following the established patterns in the codebase. The design prioritizes:
- **Simplicity**: Single-purpose class with clear interface
- **Performance**: Efficient pixel comparison using typed arrays
- **Configurability**: Tolerance thresholds for real-world usage
- **Testability**: Pure functions where possible

### Module Location

```
packages/core/src/
├── screenshot-comparator.ts      # Main implementation
└── __tests__/
    └── screenshot-comparator.test.ts
```

The ScreenshotComparator is a **utility class**, not a tool. It provides functionality that can be used by other tools or components. It will be exported from the main `@apex/core` package.

### Type Definitions

Following the Zod-first pattern established in `types.ts`:

```typescript
// Zod schemas for validation
export const ComparisonOptionsSchema = z.object({
  /** Color difference tolerance (0-255). Higher = more tolerant. Default: 0 (exact match) */
  colorTolerance: z.number().int().min(0).max(255).optional().default(0),

  /** Anti-aliasing detection. When true, ignores anti-aliased edges. Default: true */
  antiAliasingDetection: z.boolean().optional().default(true),

  /** Alpha channel comparison mode */
  alphaMode: z.enum(['include', 'ignore', 'diff-only']).optional().default('include'),

  /** Output diff image data (increases memory usage). Default: false */
  generateDiffImage: z.boolean().optional().default(false),

  /** Color to use for highlighting differences in diff image (RGBA) */
  diffColor: z.object({
    r: z.number().int().min(0).max(255),
    g: z.number().int().min(0).max(255),
    b: z.number().int().min(0).max(255),
    a: z.number().int().min(0).max(255),
  }).optional(),
});

export type ComparisonOptions = z.infer<typeof ComparisonOptionsSchema>;

export const ComparisonResultSchema = z.object({
  /** Similarity score from 0 (completely different) to 1 (identical) */
  similarity: z.number().min(0).max(1),

  /** Number of pixels that differ beyond the tolerance threshold */
  differentPixels: z.number().int().min(0),

  /** Total number of pixels compared */
  totalPixels: z.number().int().min(0),

  /** Whether the images have matching dimensions */
  dimensionsMatch: z.boolean(),

  /** Dimensions of image 1 */
  image1Dimensions: z.object({
    width: z.number().int().min(0),
    height: z.number().int().min(0),
  }),

  /** Dimensions of image 2 */
  image2Dimensions: z.object({
    width: z.number().int().min(0),
    height: z.number().int().min(0),
  }),

  /** Base64-encoded diff image (only if generateDiffImage was true) */
  diffImage: z.string().optional(),

  /** Comparison duration in milliseconds */
  durationMs: z.number(),
});

export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;
```

### Class Interface

```typescript
/**
 * Screenshot comparison utility for pixel-level image comparison.
 *
 * Supports PNG images and provides configurable tolerance for
 * handling anti-aliasing and minor color differences.
 *
 * @example
 * ```typescript
 * const comparator = new ScreenshotComparator();
 * const result = await comparator.compare(
 *   '/path/to/baseline.png',
 *   '/path/to/current.png',
 *   { colorTolerance: 5 }
 * );
 * console.log(`Similarity: ${result.similarity}`);
 * ```
 */
export class ScreenshotComparator {
  /**
   * Compare two images and return similarity metrics
   * @param image1Path - Path to first (baseline) image
   * @param image2Path - Path to second (current) image
   * @param options - Comparison configuration
   */
  compare(
    image1Path: string,
    image2Path: string,
    options?: ComparisonOptions
  ): Promise<ComparisonResult>;

  /**
   * Compare two images from Buffer data
   * @param image1Buffer - First image buffer (PNG format)
   * @param image2Buffer - Second image buffer (PNG format)
   * @param options - Comparison configuration
   */
  compareBuffers(
    image1Buffer: Buffer,
    image2Buffer: Buffer,
    options?: ComparisonOptions
  ): Promise<ComparisonResult>;

  /**
   * Load a PNG image from disk
   * @param imagePath - Path to PNG file
   * @returns Decoded image data
   */
  private loadImage(imagePath: string): Promise<ImageData>;

  /**
   * Compute pixel-by-pixel differences between two images
   * Core comparison algorithm
   */
  private computeDifference(
    img1: ImageData,
    img2: ImageData,
    options: ComparisonOptions
  ): PixelDiffResult;
}
```

### Dependencies

We will add these dependencies to `@apex/core/package.json`:

```json
{
  "dependencies": {
    "pngjs": "^7.0.0"
  },
  "devDependencies": {
    "@types/pngjs": "^6.0.4"
  }
}
```

**Rationale for pngjs:**
- Pure JavaScript PNG encoder/decoder - no native dependencies
- Lightweight (~50KB)
- Well-maintained with TypeScript support
- Used by popular tools like pixelmatch
- No external dependencies (important for APEX's standalone nature)

We are **not** using `pixelmatch` directly because:
1. We want control over the comparison algorithm
2. Custom tolerance handling for APEX-specific needs
3. Avoiding extra dependencies
4. The core algorithm is straightforward (~100 lines)

### Comparison Algorithm

The pixel comparison algorithm:

```typescript
function comparePixels(
  r1: number, g1: number, b1: number, a1: number,
  r2: number, g2: number, b2: number, a2: number,
  tolerance: number
): boolean {
  // Fast path: exact match
  if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
    return true;
  }

  // Compute color distance (Euclidean in RGB space)
  const deltaR = r1 - r2;
  const deltaG = g1 - g2;
  const deltaB = b1 - b2;
  const deltaA = a1 - a2;

  // Use squared distance to avoid sqrt for performance
  const distanceSquared = deltaR * deltaR + deltaG * deltaG +
                          deltaB * deltaB + deltaA * deltaA;
  const toleranceSquared = tolerance * tolerance * 4; // 4 channels

  return distanceSquared <= toleranceSquared;
}
```

### Anti-Aliasing Detection

For anti-aliasing detection, we check if a different pixel is surrounded by similar pixels (edge detection):

```typescript
function isAntiAliased(
  img: ImageData,
  x: number, y: number,
  width: number, height: number
): boolean {
  // Check 3x3 neighborhood
  // If pixel differs significantly from neighbors, likely anti-aliased edge
  // Implementation uses luminance gradient analysis
}
```

### Error Handling

Following APEX patterns from `apex-error.ts`:

```typescript
export enum ScreenshotComparatorErrorCode {
  IMAGE_LOAD_FAILED = 'SCREENSHOT_1000',
  INVALID_IMAGE_FORMAT = 'SCREENSHOT_1001',
  FILE_NOT_FOUND = 'SCREENSHOT_1002',
  COMPARISON_FAILED = 'SCREENSHOT_1003',
}

export class ScreenshotComparatorError extends Error {
  constructor(
    message: string,
    public code: ScreenshotComparatorErrorCode,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScreenshotComparatorError';
  }
}
```

### Testing Strategy

1. **Unit Tests**: Pure function testing for comparison algorithm
   - Exact match detection
   - Tolerance threshold handling
   - Anti-aliasing detection
   - Dimension mismatch handling

2. **Integration Tests**: File I/O and end-to-end comparison
   - Load and compare real PNG files
   - Performance benchmarks
   - Memory usage verification

3. **Test Fixtures**: Create test images programmatically
   - Identical images → similarity = 1.0
   - Completely different → similarity = 0.0
   - Subtle differences → 0.9 < similarity < 1.0
   - Anti-aliased edges
   - Dimension mismatches

```typescript
// Test fixture generation
import { PNG } from 'pngjs';

function createTestImage(width: number, height: number, color: RGBA): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }
  return PNG.sync.write(png);
}
```

### File Structure

```
packages/core/src/
├── screenshot-comparator.ts        # Main implementation
│   ├── ComparisonOptionsSchema     # Zod validation
│   ├── ComparisonResultSchema      # Zod validation
│   ├── ScreenshotComparator        # Main class
│   ├── ScreenshotComparatorError   # Error class
│   └── ScreenshotComparatorErrorCode # Error codes
├── __tests__/
│   ├── screenshot-comparator.test.ts           # Unit tests
│   └── screenshot-comparator.integration.test.ts # Integration tests
└── index.ts                        # Add export
```

### Export from Package

Add to `packages/core/src/index.ts`:

```typescript
// Screenshot Comparison
export * from './screenshot-comparator';
```

## Consequences

### Positive

1. **Standalone Utility**: Not tied to tool framework, can be used anywhere
2. **Pure JS Dependencies**: No native compilation issues
3. **Type-Safe**: Full TypeScript support with Zod validation
4. **Configurable**: Tolerance thresholds for real-world usage
5. **Testable**: Clear separation of concerns
6. **Documented**: JSDoc and example usage

### Negative

1. **New Dependency**: Adds pngjs to @apex/core
2. **Memory Usage**: Loading full images into memory
3. **PNG Only**: Initial version only supports PNG format

### Risks

1. **Large Images**: Memory pressure with very large screenshots
   - Mitigation: Document size recommendations, consider streaming

2. **Performance**: CPU-intensive comparison
   - Mitigation: Use typed arrays, avoid unnecessary allocations

## Implementation Notes

### Phase 1 (This Stage): Architecture Design
- Define types and interfaces
- Create ADR document
- Design test strategy

### Phase 2 (Developer Stage): Implementation
- Implement ScreenshotComparator class
- Add dependencies to package.json
- Write unit tests with generated test images
- Export from index.ts

### Phase 3 (Tester Stage): Verification
- Run test suite
- Verify npm build passes
- Performance testing

## Related

- ADR-014: Base Tool Abstract Class (patterns reference)
- `types.ts`: Zod schema patterns
- `apex-error.ts`: Error handling patterns
