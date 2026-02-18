# ADR: Tool Output Truncation Utility

## Status
Proposed

## Context

APEX tools (Bash, Grep, Read, Glob, etc.) can produce large outputs that may overwhelm agent context windows or cause performance issues. Currently, each tool implements its own truncation logic, leading to:

1. **Inconsistent behavior** - Different tools truncate differently (some by lines, some by characters)
2. **Code duplication** - Similar truncation logic repeated across tools
3. **No JSON structure preservation** - When output is JSON, naive truncation breaks the structure
4. **No clear truncation indicators** - Users may not realize output was truncated

### Existing Patterns in Codebase

After analyzing the codebase, I found:

1. **`utils.ts:truncate()`** - Basic string truncation with suffix (lines 497-500)
2. **`background-task-manager.ts`** - Buffer-based truncation for shell output (lines 178-195)
3. **`read-tool.ts`** - Line-based truncation with "... [truncated]" indicator (line 353)
4. **`grep-tool.ts`** - Result count-based truncation with `truncated` flag (lines 676-764)
5. **`glob-tool.ts`** - File count-based truncation with `truncated` flag (lines 284-371)

All tools use a `truncated: boolean` flag in their output interfaces.

## Decision

Create a unified **Tool Output Truncation Utility** in `@apex/core` with the following design:

### 1. Core Interface & Types

```typescript
// packages/core/src/truncation.ts

/**
 * Configuration options for output truncation
 */
export interface TruncationOptions {
  /** Maximum length in characters (default: 30000) */
  maxLength?: number;

  /** Truncation indicator to append (default: '\n... [truncated]') */
  indicator?: string;

  /** Whether to preserve JSON structure (default: auto-detect) */
  preserveJson?: boolean;

  /** Position: 'end' (keep start), 'start' (keep end), 'middle' (keep both ends) */
  position?: 'end' | 'start' | 'middle';

  /** For 'middle' position, ratio of content to keep at start (default: 0.5) */
  middleSplitRatio?: number;
}

/**
 * Result of truncation operation
 */
export interface TruncationResult {
  /** The truncated content */
  content: string;

  /** Whether truncation occurred */
  truncated: boolean;

  /** Original length before truncation */
  originalLength: number;

  /** Amount of content removed in characters */
  removedLength: number;
}
```

### 2. Main Truncation Function

```typescript
/**
 * Truncate tool output with configurable options
 *
 * Features:
 * - Configurable max length
 * - Truncation indicator
 * - JSON structure preservation
 * - Position-based truncation (start, end, middle)
 *
 * @param content - The content to truncate
 * @param options - Truncation configuration
 * @returns TruncationResult with truncated content and metadata
 */
export function truncateOutput(
  content: string,
  options?: TruncationOptions
): TruncationResult;
```

### 3. JSON-Aware Truncation

For JSON outputs, the utility will:

1. **Detect JSON** - Check if content starts with `{` or `[` and is valid JSON
2. **Preserve structure** - For objects, truncate values not keys; for arrays, truncate elements
3. **Add markers** - Insert `"... [truncated N items]"` or similar indicators
4. **Fallback gracefully** - If JSON parsing fails, fall back to plain text truncation

```typescript
/**
 * Truncate JSON while preserving structure
 */
function truncateJson(
  content: string,
  maxLength: number,
  indicator: string
): TruncationResult;
```

### 4. File Location & Exports

```
packages/core/src/
├── truncation.ts           # Main truncation utility
├── index.ts                # Add export for truncation
└── __tests__/
    └── truncation.test.ts  # Unit tests
```

The utility will be exported from `@apex/core`:

```typescript
// packages/core/src/index.ts
export * from './truncation';
```

### 5. Default Configuration

Based on existing patterns in the codebase:

| Option | Default | Rationale |
|--------|---------|-----------|
| `maxLength` | 30000 | Matches existing tool limits (Read tool, Grep tool) |
| `indicator` | `'\n... [truncated]'` | Consistent with Read tool pattern |
| `preserveJson` | Auto-detect | Smart default, explicit override available |
| `position` | `'end'` | Keep beginning, most useful for error messages |
| `middleSplitRatio` | 0.5 | Equal split for middle truncation |

### 6. Usage Examples

```typescript
import { truncateOutput } from '@apex/core';

// Basic usage
const result = truncateOutput(largeOutput);
if (result.truncated) {
  console.log(`Truncated ${result.removedLength} characters`);
}

// Custom max length
const result = truncateOutput(output, { maxLength: 10000 });

// JSON-aware truncation
const jsonResult = truncateOutput(jsonString, {
  preserveJson: true,
  maxLength: 5000
});

// Keep end of output (useful for error logs)
const errorLog = truncateOutput(buildOutput, {
  position: 'start',
  indicator: '[... earlier output truncated]\n'
});

// Keep both ends (useful for large files)
const fileContent = truncateOutput(content, {
  position: 'middle',
  middleSplitRatio: 0.3  // 30% at start, 70% at end
});
```

## Consequences

### Positive

1. **Consistency** - All tools can use the same truncation logic
2. **Maintainability** - Single place to fix bugs or improve truncation
3. **JSON Safety** - Structured data won't be broken by truncation
4. **Flexibility** - Position-based truncation for different use cases
5. **Observability** - `TruncationResult` provides metadata about what was truncated

### Negative

1. **Migration** - Existing tools may need updates to use new utility (optional)
2. **Complexity** - JSON-aware truncation adds parsing overhead
3. **Edge cases** - Need to handle malformed JSON, mixed content

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Performance overhead for JSON parsing | Only parse if `preserveJson` is true or content looks like JSON |
| Breaking existing behavior | New utility is additive; existing tools continue working |
| Truncation in middle of UTF-8 character | Use proper string handling, not byte-based truncation |

## Implementation Plan

1. **Phase 1: Core Implementation** (Developer stage)
   - Create `truncation.ts` with `truncateOutput()` function
   - Implement basic string truncation with position support
   - Add `TruncationOptions` and `TruncationResult` interfaces

2. **Phase 2: JSON Support** (Developer stage)
   - Add JSON detection and parsing
   - Implement `truncateJson()` for structured truncation
   - Handle edge cases (nested objects, arrays)

3. **Phase 3: Testing** (Tester stage)
   - Unit tests for various lengths
   - Tests for JSON preservation
   - Edge case tests (empty, unicode, mixed content)

4. **Phase 4: Integration** (Future)
   - Optional: Update existing tools to use new utility
   - Add to tool base class as helper method

## Technical Notes

### UTF-8 Safety

The utility must handle multi-byte UTF-8 characters correctly:

```typescript
// Correct: Use string length (code points)
content.length

// Incorrect: Byte-based operations that may split characters
Buffer.byteLength(content)
```

### JSON Truncation Strategy

For JSON arrays:
```json
// Before: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
// After:  [1, 2, 3, "... [7 items truncated]"]
```

For JSON objects:
```json
// Before: {"key1": "value1", "key2": "very long value..."}
// After:  {"key1": "value1", "key2": "very lo... [truncated]"}
```

### Existing `truncate()` Function

The existing `truncate()` function in `utils.ts` (lines 497-500) handles simple string truncation. The new `truncateOutput()` function will:

1. Provide richer functionality (position, JSON-awareness)
2. Return metadata (original length, was truncated)
3. Not replace `truncate()` - they serve different purposes

## Related

- `packages/core/src/utils.ts` - Existing `truncate()` function
- `packages/core/src/tools/filesystem/read-tool.ts` - Line truncation example
- `packages/core/src/tools/search/grep-tool.ts` - Result truncation example
