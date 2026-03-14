# ADR-0013: WebSocket Payload Truncation for Large Outputs

## Status

Proposed

## Context

WebSocket event serialization in the APEX API broadcasts events like `tool:complete` and `agent:tool-use` which can contain arbitrarily large payloads. When tools produce outputs with 100K+ items (e.g., large directory listings, database query results, or log outputs), these payloads can:

1. **Crash or hang clients** - Web browsers and UI clients may struggle with JSON parsing of multi-MB payloads
2. **Consume excessive bandwidth** - Large payloads waste network resources
3. **Cause memory pressure** - Both server and client-side memory can be exhausted
4. **Degrade user experience** - UI becomes unresponsive during large payload processing

The existing `safeSerialize` function in `@apexcli/core` handles circular references but does not address payload size limits.

## Decision

We will implement a **payload truncation system** with the following components:

### 1. Core Utility Function: `truncatePayload`

**Location**: `packages/core/src/utils.ts`

```typescript
/**
 * Configuration for payload truncation
 */
export interface TruncatePayloadOptions {
  /** Maximum number of items in arrays (default: 1000) */
  maxArrayItems?: number;
  /** Maximum string length in bytes (default: 50KB = 51200) */
  maxStringLength?: number;
  /** Whether to include truncation metadata (default: true) */
  includeMetadata?: boolean;
}

/**
 * Metadata about truncation operations
 */
export interface TruncationMetadata {
  /** Whether any truncation occurred */
  truncated: boolean;
  /** Details about what was truncated */
  truncations: TruncationDetail[];
}

export interface TruncationDetail {
  /** Path to truncated property (e.g., "data.output.items") */
  path: string;
  /** Type of truncation applied */
  type: 'array' | 'string';
  /** Original size before truncation */
  originalSize: number;
  /** Size after truncation */
  truncatedSize: number;
}

/**
 * Result of payload truncation
 */
export interface TruncatedPayload<T> {
  /** The truncated data */
  data: T;
  /** Metadata about truncation operations */
  _truncation?: TruncationMetadata;
}
```

**Algorithm Design**:
- Recursively traverse the object/array structure
- Track the current path for metadata reporting
- When encountering an array with length > `maxArrayItems`:
  - Slice to first `maxArrayItems` elements
  - Record truncation in metadata
- When encountering a string with length > `maxStringLength`:
  - Truncate with ellipsis suffix
  - Record truncation in metadata
- Handle circular references gracefully (existing `safeSerialize` pattern)
- Return wrapped result with `_truncation` metadata if truncations occurred

### 2. Integration Point: `broadcast()` Function

**Location**: `packages/api/src/index.ts`

Modify the event handlers for `tool:complete` and `agent:tool-use` events:

```typescript
// Before broadcasting tool:complete events
orchestrator.on('tool:complete', (event: ToolCallCompleteEvent) => {
  const truncatedData = truncatePayload({
    toolName: event.toolName,
    callId: event.callId,
    result: event.result,  // This contains output that may be large
    timing: event.timing,
  }, {
    maxArrayItems: 1000,
    maxStringLength: 50 * 1024, // 50KB
  });

  broadcast(event.taskId, {
    type: 'tool:complete',
    taskId: event.taskId,
    timestamp: new Date(),
    data: truncatedData.data,
    _truncation: truncatedData._truncation,
  });
});

// Before broadcasting agent:tool-use events
orchestrator.on('agent:tool-use', (taskId: string, tool: string, input: unknown) => {
  const truncatedData = truncatePayload({
    tool,
    input,  // This contains input that may be large
  }, {
    maxArrayItems: 1000,
    maxStringLength: 50 * 1024,
  });

  broadcast(taskId, {
    type: 'agent:tool-use',
    taskId,
    timestamp: new Date(),
    data: truncatedData.data,
    _truncation: truncatedData._truncation,
  });
});
```

### 3. Configuration

Default limits are chosen based on practical considerations:

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `maxArrayItems` | 1000 | Sufficient for most use cases; larger datasets should paginate |
| `maxStringLength` | 50KB | Reasonable for log snippets; full logs available via other means |

These can be overridden per-call for flexibility.

## Implementation Plan

### Phase 1: Core Utility (packages/core)
1. Add `TruncatePayloadOptions`, `TruncationMetadata`, `TruncationDetail`, and `TruncatedPayload` interfaces to `utils.ts`
2. Implement `truncatePayload` function with recursive traversal
3. Export new types and function from `index.ts`
4. Add comprehensive unit tests

### Phase 2: API Integration (packages/api)
1. Import `truncatePayload` in API index
2. Modify `tool:complete` handler to apply truncation
3. Modify `agent:tool-use` handler to apply truncation
4. Add integration tests for large payload handling

### Phase 3: Type Updates
1. Update `ApexEvent` type to include optional `_truncation` metadata
2. Update client-side types in web-ui if applicable

## File Changes

### Modified Files
- `packages/core/src/utils.ts` - Add truncatePayload function and types
- `packages/core/src/utils.test.ts` - Add unit tests
- `packages/api/src/index.ts` - Apply truncation in broadcast handlers

### New Files
- `tests/websocket-payload-truncation.integration.test.ts` - Integration tests

## Technical Details

### Truncation Algorithm

```typescript
function truncatePayload<T>(
  payload: T,
  options: TruncatePayloadOptions = {}
): TruncatedPayload<T> {
  const {
    maxArrayItems = 1000,
    maxStringLength = 50 * 1024,
    includeMetadata = true,
  } = options;

  const truncations: TruncationDetail[] = [];
  const seen = new WeakSet();

  function truncateValue(value: unknown, path: string): unknown {
    // Handle nullish values
    if (value === null || value === undefined) {
      return value;
    }

    // Handle strings
    if (typeof value === 'string') {
      if (value.length > maxStringLength) {
        truncations.push({
          path,
          type: 'string',
          originalSize: value.length,
          truncatedSize: maxStringLength,
        });
        return value.slice(0, maxStringLength) + '... [truncated]';
      }
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return value;
    }

    // Handle circular references
    if (seen.has(value as object)) {
      return '[Circular]';
    }
    seen.add(value as object);

    // Handle arrays
    if (Array.isArray(value)) {
      const originalLength = value.length;
      const truncatedArray = value.slice(0, maxArrayItems);

      if (originalLength > maxArrayItems) {
        truncations.push({
          path,
          type: 'array',
          originalSize: originalLength,
          truncatedSize: maxArrayItems,
        });
      }

      return truncatedArray.map((item, index) =>
        truncateValue(item, `${path}[${index}]`)
      );
    }

    // Handle objects
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = truncateValue(val, path ? `${path}.${key}` : key);
    }
    return result;
  }

  const truncatedData = truncateValue(payload, '') as T;

  if (includeMetadata && truncations.length > 0) {
    return {
      data: truncatedData,
      _truncation: {
        truncated: true,
        truncations,
      },
    };
  }

  return { data: truncatedData };
}
```

### Error Handling

- The function is designed to be fail-safe
- If truncation fails for any reason, return original payload
- Log warnings for debugging but don't throw

### Performance Considerations

- Single-pass recursive traversal: O(n) where n is total elements
- WeakSet for circular reference detection: O(1) lookup
- Early termination for primitives
- No deep cloning until truncation is needed

## Consequences

### Positive
- **Prevents crashes**: Large payloads no longer overwhelm clients
- **Preserves information**: Truncation metadata indicates what was removed
- **Configurable**: Limits can be adjusted per use case
- **Non-breaking**: Existing event structure preserved; metadata is additive
- **Testable**: Clear boundaries for unit and integration testing

### Negative
- **Data loss**: Some information is discarded (intentionally)
- **Complexity**: Additional processing for every broadcast
- **Metadata overhead**: Small increase in payload size for truncation info

### Neutral
- **Client adaptation**: Clients may need to handle `_truncation` metadata
- **Debugging**: Truncated data may make debugging harder in some cases

## Alternatives Considered

### 1. Compression (gzip)
- **Rejected**: Doesn't address memory issues; just transfers the problem
- Client still needs to decompress and parse large JSON

### 2. Pagination
- **Rejected for real-time events**: Adds complexity; breaks WebSocket streaming model
- Better suited for REST API endpoints

### 3. Reference-based approach
- **Rejected**: Store large outputs separately, send only reference ID
- Adds state management complexity; requires additional API calls

### 4. Client-side limits
- **Rejected**: Puts burden on every client implementation
- Server-side is more reliable and consistent

## Notes

- This feature supports the v0.6.0 WebSocket stability improvements
- Truncation thresholds may be tuned based on production metrics
- Future work: Add configuration via APEX config file

## References

- `packages/core/src/utils.ts` - Existing utility functions including `truncateToolOutput`
- `packages/api/src/index.ts` - WebSocket broadcast implementation
- RFC 6455 (WebSocket Protocol) - No explicit size limits but practical considerations
