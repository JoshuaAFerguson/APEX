# ADR: MultimodalInputHandler Architecture

## Status
Implemented

## Context

APEX needs to support multimodal inputs (images) for Claude SDK integration. The `MultimodalInputHandler` class provides the capability to:
1. Load image files (PNG, JPEG, GIF, WebP) from local paths
2. Validate image formats and file sizes
3. Convert images to base64 encoding
4. Return Claude SDK compatible `ImageBlockParam` structures

This enables APEX agents to process visual inputs such as screenshots, design mockups, and diagrams as part of their workflows.

## Decision

### Architecture Overview

The `MultimodalInputHandler` is implemented as a standalone utility class in `@apexcli/orchestrator` that handles image file processing for Claude SDK integration.

```
packages/orchestrator/src/tools/
├── multimodal-input-handler.ts    # Main implementation
├── multimodal-input-handler.test.ts  # Unit tests (to be added)
└── index.ts                       # Tool exports (needs update)
```

### Core Components

#### 1. ImageBlockParam Interface

Matches the Claude SDK's expected structure for image content blocks:

```typescript
interface ImageBlockParam {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}
```

This interface is compatible with the Anthropic SDK's `@anthropic-ai/sdk` types defined in `resources/messages.d.ts`.

#### 2. MultimodalInputHandler Class

**Configuration Options:**

```typescript
interface MultimodalInputHandlerConfig {
  /** Maximum file size in bytes (default: 20MB) */
  maxFileSizeBytes?: number;
  /** Supported image formats (default: ['png', 'jpg', 'jpeg', 'gif', 'webp']) */
  supportedFormats?: string[];
}
```

**Processing Result:**

```typescript
interface ImageProcessResult {
  /** Claude SDK compatible ImageBlockParam */
  imageBlock: ImageBlockParam;
  /** Original file size in bytes */
  fileSizeBytes: number;
  /** Detected media type */
  mediaType: string;
}
```

**Core Methods:**

```typescript
class MultimodalInputHandler {
  constructor(config?: MultimodalInputHandlerConfig);

  // Main processing method
  async processImageFile(imagePath: string): Promise<ImageProcessResult>;

  // Configuration access
  getConfig(): Required<MultimodalInputHandlerConfig>;

  // Utility methods
  isSupportedFormat(filePath: string): boolean;
  getSupportedMediaTypes(): ImageBlockParam['source']['media_type'][];
}
```

#### 3. Error Handling

Custom error class with typed error codes:

```typescript
class MultimodalInputError extends Error {
  code: string;

  // Error codes:
  // - 'FILE_NOT_FOUND': File does not exist
  // - 'NOT_A_FILE': Path is not a regular file
  // - 'FILE_TOO_LARGE': File exceeds size limit
  // - 'EMPTY_FILE': File has zero bytes
  // - 'UNSUPPORTED_FORMAT': File extension not supported
  // - 'FORMAT_NOT_CONFIGURED': Format not in config
  // - 'BASE64_CONVERSION_ERROR': Failed to read/encode file
  // - 'PROCESSING_ERROR': Generic processing failure
}
```

### Validation Rules

1. **File Existence**: Verifies the file exists and is a regular file
2. **File Size**: Default limit of 20MB (configurable)
3. **Empty File Check**: Rejects files with 0 bytes
4. **Format Validation**:
   - Checks file extension against supported formats
   - Maps extensions to Claude SDK media types

### Media Type Mapping

| Extension | Claude SDK Media Type |
|-----------|----------------------|
| `.png`    | `image/png`          |
| `.jpg`    | `image/jpeg`         |
| `.jpeg`   | `image/jpeg`         |
| `.gif`    | `image/gif`          |
| `.webp`   | `image/webp`         |

### Integration Points

#### 1. With Existing Multimodal Types

The handler complements the existing multimodal type system defined in `@apexcli/core/types.ts`:

- `ImageInput` - Higher-level input schema with metadata
- `ImageMediaType` - Extended media types including SVG, BMP, TIFF
- `MultimodalInput` - Discriminated union for all input types

The `MultimodalInputHandler` focuses specifically on file-to-Claude-SDK conversion, while the core types provide the full data model for APEX workflows.

#### 2. With ApexOrchestrator

The handler can be used within workflow stages to process image inputs:

```typescript
import { MultimodalInputHandler } from '@apexcli/orchestrator';

const handler = new MultimodalInputHandler();
const result = await handler.processImageFile('/path/to/screenshot.png');

// Use with Claude SDK message content
const content = [
  { type: 'text', text: 'Analyze this image:' },
  result.imageBlock
];
```

#### 3. Convenience Exports

```typescript
// Default instance for simple use cases
export const multimodalInputHandler = new MultimodalInputHandler();

// Convenience function
export async function processImageFile(
  imagePath: string,
  config?: MultimodalInputHandlerConfig
): Promise<ImageProcessResult>;
```

### Design Patterns Used

1. **Configuration with Defaults**: Merges user config with sensible defaults
2. **Validation Chain**: Sequential validation steps with early failure
3. **Custom Error Types**: Typed error codes for programmatic handling
4. **Static Mapping**: Compile-time media type mapping for type safety

## Alternatives Considered

### Alternative 1: Extend ImageInput Schema
Extending the existing `ImageInput` schema to include file loading was considered but rejected because:
- Separation of concerns: data schema vs. file I/O operations
- The existing schema handles both base64 data and URLs
- File loading is an operational concern, not a data modeling concern

### Alternative 2: EventEmitter-Based Handler
Using EventEmitter pattern (like BrowserManager) was considered but rejected because:
- Image processing is a simple, synchronous-like operation
- No need for lifecycle events or state management
- Single-file processing doesn't benefit from event streaming

### Alternative 3: Integration with Core Types
Tight integration with `@apexcli/core` multimodal types was considered but:
- Core should remain pure data types without I/O dependencies
- Handler is orchestrator-specific functionality
- Keeps core package lightweight

## Consequences

### Positive
- Clean, focused API for image processing
- Compatible with Claude SDK without additional transformation
- Comprehensive validation prevents common errors
- Configurable for different use cases
- Follows existing APEX patterns

### Negative
- Does not handle URL-based images (must be downloaded separately)
- No image format detection beyond file extension
- No image optimization or resizing capabilities

### Neutral
- Located in tools directory alongside other tool implementations
- Requires explicit export from orchestrator package
- Tests need to be added

## Implementation Checklist

- [x] Core `MultimodalInputHandler` class implementation
- [x] `ImageBlockParam` interface matching Claude SDK
- [x] File validation (existence, size, format)
- [x] Base64 encoding
- [x] Error handling with typed codes
- [x] Configuration support
- [ ] Export from `tools/index.ts`
- [ ] Export from `orchestrator/src/index.ts`
- [ ] Unit tests for all validation scenarios
- [ ] Integration tests with mock files
- [ ] Documentation in README

## Test Plan

### Unit Tests Required

1. **Successful Processing**
   - Valid PNG file
   - Valid JPEG file
   - Valid GIF file
   - Valid WebP file

2. **Validation Errors**
   - Non-existent file
   - Directory instead of file
   - Empty file
   - File exceeds size limit
   - Unsupported format

3. **Configuration**
   - Custom max file size
   - Custom supported formats
   - Default configuration values

4. **Utility Methods**
   - `isSupportedFormat()` returns correct values
   - `getSupportedMediaTypes()` returns correct array
   - `getConfig()` returns current configuration

## References

- Claude SDK Types: `node_modules/@anthropic-ai/sdk/resources/messages.d.ts`
- Core Multimodal Types: `packages/core/src/types.ts` (lines 11630-12100)
- BrowserManager Pattern: `packages/orchestrator/src/browser-manager.ts`
- ADR Template: `docs/adr/orchestrator-ADR-001-import-auto-fixer.md`
