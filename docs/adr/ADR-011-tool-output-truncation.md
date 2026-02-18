# ADR-011: Tool Output Truncation Utility

## Status
Proposed

## Context

The APEX orchestrator processes tool outputs from Claude agent executions. Large tool outputs can:
1. Consume excessive context window tokens
2. Degrade performance when processing/storing
3. Cause issues with JSON serialization for structured outputs
4. Impact readability in logs and UI displays

Currently, there's a basic `truncate()` function in `@apexcli/core/utils.ts` (line 497) that handles simple string truncation:

```typescript
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}
```

There's also a `truncateToolResult()` function in `@apexcli/orchestrator/context.ts` that handles tool result truncation but:
1. It's in the orchestrator package, not core (not reusable)
2. Doesn't preserve JSON structure
3. Has limited configurability

The acceptance criteria require:
- Utility function in **core** package
- Configurable max length
- Truncation indicator
- **Preserve structure for JSON outputs**
- Unit tests at various lengths

## Decision

### 1. Create a New `truncateToolOutput()` Function in Core

Create a comprehensive tool output truncation utility in `packages/core/src/utils.ts` with the following signature:

```typescript
/**
 * Options for truncating tool output
 */
export interface TruncateToolOutputOptions {
  /** Maximum length of the output in characters (default: 10000) */
  maxLength?: number;
  /** Suffix to append when truncated (default: '\n\n[... truncated]') */
  truncationSuffix?: string;
  /** Whether to preserve JSON structure when truncating (default: true) */
  preserveJsonStructure?: boolean;
  /** For arrays, maximum number of items to keep (default: 100) */
  maxArrayItems?: number;
  /** For objects, maximum depth to preserve (default: 5) */
  maxDepth?: number;
}

/**
 * Result of truncating tool output
 */
export interface TruncateToolOutputResult {
  /** The truncated output (string or object) */
  output: unknown;
  /** Whether truncation occurred */
  wasTruncated: boolean;
  /** Original length in characters */
  originalLength: number;
  /** Truncated length in characters */
  truncatedLength: number;
}

/**
 * Truncate tool output with configurable options
 * Handles both string and JSON outputs, preserving structure where possible
 */
export function truncateToolOutput(
  input: unknown,
  options?: TruncateToolOutputOptions
): TruncateToolOutputResult;
```

### 2. JSON Structure Preservation Strategy

For JSON outputs, we will:

1. **Arrays**: Truncate to `maxArrayItems` and add a truncation indicator object:
   ```typescript
   // Input: [1, 2, 3, 4, 5, 6, ...100 items]
   // Output: [1, 2, 3, ..., { "_truncated": true, "message": "97 more items" }]
   ```

2. **Objects**: Recursively traverse and truncate:
   - Deep objects: Truncate at `maxDepth` with indicator
   - Large string values: Apply string truncation
   - Large arrays: Apply array truncation

3. **Strings within JSON**: Apply string truncation to long string values

### 3. Implementation Approach

```typescript
function truncateToolOutput(
  input: unknown,
  options: TruncateToolOutputOptions = {}
): TruncateToolOutputResult {
  const {
    maxLength = 10000,
    truncationSuffix = '\n\n[... truncated]',
    preserveJsonStructure = true,
    maxArrayItems = 100,
    maxDepth = 5,
  } = options;

  // Handle string input
  if (typeof input === 'string') {
    return truncateString(input, maxLength, truncationSuffix);
  }

  // Handle JSON/object input
  if (preserveJsonStructure && (Array.isArray(input) || isPlainObject(input))) {
    return truncateJsonStructure(input, { maxLength, maxArrayItems, maxDepth });
  }

  // Fallback: stringify and truncate
  const stringified = JSON.stringify(input);
  return truncateString(stringified, maxLength, truncationSuffix);
}
```

### 4. File Structure

```
packages/core/src/
├── utils.ts                          # Add truncateToolOutput function
├── __tests__/
│   └── truncate-tool-output.test.ts  # New comprehensive test file
```

### 5. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Place in `@apexcli/core` | Enables reuse across orchestrator, CLI, and API packages |
| Return structured result | Allows consumers to detect truncation and access metadata |
| Preserve JSON by default | Critical for maintaining data semantics in tool outputs |
| Configurable limits | Different contexts need different truncation thresholds |
| Separate from existing `truncate()` | Different purpose - existing is for display, new is for tool outputs |

### 6. Test Strategy

The test file will cover:

1. **String truncation**:
   - No truncation needed (under limit)
   - Exact limit boundary
   - Simple truncation with default suffix
   - Custom suffix
   - Empty string
   - Very long strings (100K+ characters)

2. **JSON array truncation**:
   - Arrays under item limit
   - Arrays over item limit
   - Nested arrays
   - Arrays with mixed types

3. **JSON object truncation**:
   - Shallow objects
   - Deep nested objects (exceeding maxDepth)
   - Objects with long string values
   - Objects with array values

4. **Edge cases**:
   - `null` and `undefined` inputs
   - Circular reference handling (should not throw)
   - Non-serializable values (functions, symbols)
   - Unicode and multi-byte character handling

5. **Configuration combinations**:
   - Custom maxLength values (100, 1000, 50000)
   - preserveJsonStructure: false
   - Custom maxArrayItems
   - Custom maxDepth

## Consequences

### Positive
- Reusable utility across all APEX packages
- Maintains JSON structure for downstream parsing
- Configurable for different use cases
- Comprehensive metadata for truncation detection
- Well-tested with edge case coverage

### Negative
- JSON structure preservation adds complexity
- Slightly more memory usage for deep cloning during truncation
- Performance overhead for large nested structures

### Neutral
- Existing `truncate()` function remains for simple string truncation
- Orchestrator's `truncateToolResult()` can be refactored to use this (future work)

## Implementation Notes

1. Use `structuredClone()` or custom deep clone to avoid mutating input
2. Handle circular references gracefully (use WeakSet tracking)
3. Consider lazy evaluation for very large structures
4. Export both the function and types from `@apexcli/core`
5. Update `packages/core/src/index.ts` to export new function and types
