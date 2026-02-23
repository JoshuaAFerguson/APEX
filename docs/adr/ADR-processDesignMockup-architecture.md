# ADR: processDesignMockup Method Architecture

**Status**: Proposed
**Date**: 2025-01-XX
**Context**: Implementing processDesignMockup method for URL-based design mockup processing

## Summary

This ADR documents the technical design for adding a `processDesignMockup()` public method to the `MultimodalInputHandler` class. The method will handle URL-based design mockups, download images from URLs (including Figma export URLs), extract metadata from URL structure, and return `DesignMockupProcessResult` with an `imageBlock` and metadata.

## Context

The `MultimodalInputHandler` class in `packages/orchestrator/src/tools/multimodal-input-handler.ts` already handles:
- Local image file processing (`processImageFile`)
- Web page content processing (`processWebPage`)
- GitHub issue image extraction (`processGitHubIssueImages`)
- Figma URL parsing (`parseFigmaUrl`, `isFigmaUrl`)

The class has supporting infrastructure:
- `WebFetchTool` for HTTP requests with caching
- `DesignMockupProcessResult` type already defined in `design-mockup-types.ts`
- Figma URL patterns for parsing various Figma URL types
- Image format validation and base64 conversion utilities

## Decision

### Method Signature

```typescript
/**
 * Process a design mockup from a URL (including Figma export URLs)
 *
 * @param url - The design mockup URL to process
 * @param options - Optional processing options
 * @returns Promise resolving to DesignMockupProcessResult
 * @throws DesignMockupError for validation or processing failures
 */
async processDesignMockup(
  url: string,
  options?: DesignMockupOptions
): Promise<DesignMockupProcessResult>
```

### Implementation Strategy

#### 1. URL Detection & Routing

The method will detect the URL type and route accordingly:

```typescript
// Routing logic
if (this.isFigmaUrl(url)) {
  return this.processFigmaDesignMockup(url, options);
} else {
  return this.processGenericDesignMockup(url, options);
}
```

#### 2. Figma URL Processing Flow

For Figma URLs, the method will:

1. **Parse URL**: Use existing `parseFigmaUrl()` to extract `fileKey`, `nodeId`, `fileName`, `urlType`, etc.
2. **Construct export URL**: Build Figma image export URL or use direct image URL
3. **Download image**: Use `WebFetchTool` with appropriate headers
4. **Extract metadata**: Map FigmaUrlInfo to DesignFileMetadata
5. **Create imageBlock**: Convert downloaded image to Claude SDK format

```typescript
private async processFigmaDesignMockup(
  url: string,
  options?: DesignMockupOptions
): Promise<DesignMockupProcessResult>
```

#### 3. Generic URL Processing Flow

For non-Figma URLs (direct image URLs):

1. **Validate URL**: Check URL format
2. **Download image**: Use `WebFetchTool` to fetch image data
3. **Extract metadata**: Parse URL path for filename, detect format from extension/content-type
4. **Create imageBlock**: Convert to Claude SDK format

```typescript
private async processGenericDesignMockup(
  url: string,
  options?: DesignMockupOptions
): Promise<DesignMockupProcessResult>
```

### Metadata Extraction

#### From Figma URLs
```typescript
// FigmaUrlInfo → DesignFileMetadata mapping
{
  fileId: figmaInfo.fileKey,
  nodeId: figmaInfo.nodeId,
  fileUrl: figmaInfo.originalUrl,
  frameName: figmaInfo.fileName, // Decoded
  fileVersion: figmaInfo.versionId,
}
```

#### From Generic URLs
```typescript
// URL path analysis
{
  fileUrl: url,
  frameName: extractFilenameFromUrl(url), // e.g., "dashboard-v2.png"
}
```

### Design Tool Detection

Detect design tool from URL patterns:

```typescript
private detectDesignTool(url: string): DesignTool {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('figma.com')) return 'figma';
  if (urlLower.includes('sketch.cloud') || urlLower.includes('sketch.com')) return 'sketch';
  if (urlLower.includes('xd.adobe.com')) return 'adobe_xd';
  if (urlLower.includes('invisionapp.com')) return 'invision';
  if (urlLower.includes('zeplin.io')) return 'zeplin';
  if (urlLower.includes('framer.com')) return 'framer';
  if (urlLower.includes('canva.com')) return 'canva';

  return 'other';
}
```

### Export Format Detection

```typescript
private detectExportFormat(
  url: string,
  contentType?: string
): DesignExportFormat {
  // Priority 1: Check content-type header
  if (contentType) {
    if (contentType.includes('image/png')) return 'png';
    if (contentType.includes('image/jpeg')) return 'jpeg';
    if (contentType.includes('image/webp')) return 'webp';
    if (contentType.includes('image/svg')) return 'svg';
    if (contentType.includes('application/pdf')) return 'pdf';
  }

  // Priority 2: Check URL extension
  const ext = this.getExtensionFromUrl(url);
  if (['png', 'jpeg', 'jpg', 'webp', 'svg', 'pdf'].includes(ext)) {
    return ext === 'jpg' ? 'jpeg' : ext as DesignExportFormat;
  }

  // Default to PNG
  return 'png';
}
```

### Error Handling

Use `DesignMockupError` with appropriate error codes:

```typescript
// Error scenarios and codes
- INVALID_URL: URL validation failed
- UNSUPPORTED_TOOL: Design tool not supported
- NETWORK_ERROR: HTTP request failed
- FILE_NOT_FOUND: 404 response
- FILE_TOO_LARGE: Image exceeds size limit
- PROCESSING_ERROR: Image processing failed
- TIMEOUT: Request timeout
```

### Caching Strategy

Leverage existing `WebFetchTool` caching:

```typescript
const webFetchParams = {
  url: imageUrl,
  timeout: options?.timeout || 30000,
  bypassCache: options?.bypassCache || false,
  cacheTtl: options?.cacheTtl || 900000, // 15 minutes default
  convertToMarkdown: false, // Raw image data
};
```

### Return Structure

```typescript
const result: DesignMockupProcessResult = {
  imageBlock: {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png', // or detected type
      data: base64ImageData,
    },
  },
  designTool: detectedTool,
  metadata: {
    fileId: figmaInfo?.fileKey,
    nodeId: figmaInfo?.nodeId,
    fileUrl: url,
    frameName: extractedName,
  },
  exportFormat: detectedFormat,
  exportScale: options?.exportScale || 1,
  fileSizeBytes: imageBuffer.length,
  mediaType: `image/${detectedFormat}`,
  processingTime: Date.now() - startTime,
  fromCache: webFetchResult.fromCache || false,
  cacheKey: webFetchResult.metadata?.cacheKey,
};
```

### Integration with Existing Code

The method will reuse these existing components:

1. **`WebFetchTool`** - For HTTP requests with caching
2. **`parseFigmaUrl()`** - For Figma URL parsing
3. **`isFigmaUrl()`** - For URL detection
4. **`validateFileSize()`** - For size validation
5. **`MEDIA_TYPE_MAP`** - For media type mapping
6. **Existing private helpers** - `_extractModeFromUrl`, `_extractScaleFactorFromUrl`, etc.

### Exports

Add to `packages/orchestrator/src/tools/index.ts`:

```typescript
export {
  // ... existing exports
  processDesignMockup,  // New convenience function
} from './multimodal-input-handler';
```

Add convenience function:

```typescript
/**
 * Convenience function for processing design mockup URLs
 */
export async function processDesignMockup(
  url: string,
  options?: DesignMockupOptions,
  config?: MultimodalInputHandlerConfig
): Promise<DesignMockupProcessResult> {
  const handler = config ? new MultimodalInputHandler(config) : multimodalInputHandler;
  return handler.processDesignMockup(url, options);
}
```

## File Changes

### Files to Modify

1. **`packages/orchestrator/src/tools/multimodal-input-handler.ts`**
   - Add `processDesignMockup()` public method
   - Add `processFigmaDesignMockup()` private method
   - Add `processGenericDesignMockup()` private method
   - Add `detectDesignTool()` private method
   - Add `detectExportFormat()` private method
   - Add `extractFilenameFromUrl()` private method
   - Add `processDesignMockup` convenience function export

2. **`packages/orchestrator/src/tools/index.ts`**
   - Add `processDesignMockup` to exports

### Files to Create (tests - for developer stage)

1. **`packages/orchestrator/src/tools/__tests__/multimodal-input-handler-design-mockup.test.ts`**
   - Unit tests for processDesignMockup method

## Architectural Decisions

### AD1: Single Method Entry Point

**Decision**: Use a single `processDesignMockup()` method that internally routes to specialized handlers.

**Rationale**:
- Consistent API surface
- Easier for consumers (no need to choose method based on URL type)
- Internal routing allows optimization per design tool

### AD2: Leverage Existing Infrastructure

**Decision**: Reuse `WebFetchTool`, `parseFigmaUrl`, and validation utilities.

**Rationale**:
- DRY principle
- Existing code is tested and working
- Consistent caching behavior
- Reduced implementation effort

### AD3: Return DesignMockupProcessResult

**Decision**: Return the existing `DesignMockupProcessResult` type from `design-mockup-types.ts`.

**Rationale**:
- Type already defined with all needed fields
- Consistent with acceptance criteria
- Well-documented structure

### AD4: Error Handling with DesignMockupError

**Decision**: Use `DesignMockupError` class for all errors.

**Rationale**:
- Purpose-built error class exists
- Error codes provide context
- Details field allows additional info

### AD5: Optional AI Analysis

**Decision**: Support optional AI analysis via `options.analysisPrompt`.

**Rationale**:
- Consistent with `processWebPage` pattern
- Enables design description generation
- Leverages existing Claude Haiku integration

## Alternatives Considered

### Alternative 1: Separate Methods per Design Tool

Rejected because:
- Would require consumers to know URL type upfront
- More complex API surface
- Less flexible for future design tool support

### Alternative 2: New Handler Class

Rejected because:
- `MultimodalInputHandler` already has required infrastructure
- Would duplicate WebFetchTool and validation logic
- Inconsistent with existing patterns

## Consequences

### Positive
- Clean, single-method API for design mockup processing
- Reuses existing tested infrastructure
- Consistent with existing handler patterns
- Full metadata extraction from Figma URLs

### Negative
- Adds complexity to already large class (~1000 LOC)
- Figma API limitations without access token (public files only)

### Risks
- Figma URL patterns may change (mitigated by comprehensive regex)
- Large images may cause memory issues (mitigated by size limits)

## Implementation Notes for Developer Stage

1. Start by implementing private helper methods (`detectDesignTool`, `detectExportFormat`, `extractFilenameFromUrl`)
2. Implement `processGenericDesignMockup` for simpler direct image URLs
3. Implement `processFigmaDesignMockup` building on existing Figma parsing
4. Add main `processDesignMockup` method with routing
5. Add convenience function export
6. Update index.ts exports
7. Write comprehensive tests

## Test Cases for Tester Stage

1. **Figma file URLs** - `https://www.figma.com/file/abc123/Design-Name`
2. **Figma design URLs** - `https://www.figma.com/design/abc123/Design-Name`
3. **Figma with node-id** - `https://www.figma.com/file/abc123/Name?node-id=123:456`
4. **Figma proto URLs** - `https://www.figma.com/proto/abc123/Name`
5. **Direct PNG URLs** - `https://example.com/mockup.png`
6. **Direct JPEG URLs** - `https://example.com/design.jpg`
7. **Invalid URLs** - Should throw INVALID_URL error
8. **Non-image URLs** - Should handle gracefully
9. **Large images** - Should throw FILE_TOO_LARGE if over limit
10. **Network errors** - Should throw NETWORK_ERROR
11. **404 responses** - Should throw FILE_NOT_FOUND
12. **Caching behavior** - Verify cache hit/miss
13. **Options handling** - exportScale, timeout, bypassCache

## References

- `packages/orchestrator/src/tools/multimodal-input-handler.ts` - Main implementation file
- `packages/orchestrator/src/tools/design-mockup-types.ts` - Type definitions
- `packages/orchestrator/src/tools/webfetch.ts` - HTTP client with caching
- `docs/adr/orchestrator-ADR-multimodal-input-handler.md` - Existing handler ADR
