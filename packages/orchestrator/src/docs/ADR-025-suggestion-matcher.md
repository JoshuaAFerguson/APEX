# ADR-025: SuggestionMatcher Class

## Status

Proposed

## Date

2025-01-03

## Context

APEX agents need a mechanism to map common error patterns to actionable suggestions. When agents encounter compiler errors, file system errors, or other common issues, they should be able to provide helpful guidance to resolve them. This enables faster error resolution and better user experience.

### Requirements

1. **Pattern Matching**: Map common error patterns to suggestions
2. **Error Categories**: Support TypeScript errors, file system errors, module errors, permission errors
3. **Simple Interface**: Single `getSuggestion(error)` method
4. **Extensibility**: Easy to add new error patterns

### Existing Patterns

The orchestrator package has established patterns for matcher/detector classes:

1. **DangerousOperationDetector**: Uses regex patterns to detect dangerous operations
   - Pattern-based matching with string or RegExp
   - Returns structured results with metadata
   - Initializes patterns in constructor via private methods

2. **StaleCommentDetector**: Uses regex patterns to find comments
   - Pattern-based matching with configurable thresholds
   - Returns structured results following core types

3. **Class Structure**: Simple stateless classes with public methods
   - No EventEmitter inheritance needed (this is a pure utility class)
   - Pattern storage in private readonly arrays
   - Type-safe interfaces for patterns and results

## Decision

Create `SuggestionMatcher` class in `packages/orchestrator/src/suggestion-matcher.ts` following the established detector pattern.

### Architecture

```typescript
// ============================================================================
// Types
// ============================================================================

/**
 * Categories of error patterns
 */
export type ErrorPatternCategory =
  | 'typescript'   // TypeScript compiler errors
  | 'filesystem'   // File system errors (ENOENT, EACCES, etc.)
  | 'module'       // Module resolution errors
  | 'permission';  // Permission-related errors

/**
 * Definition of an error pattern with its associated suggestion
 */
export interface ErrorPattern {
  /** Pattern to match against error message (string or regex) */
  pattern: string | RegExp;
  /** Category of this error pattern */
  category: ErrorPatternCategory;
  /** Suggestion to return when pattern matches */
  suggestion: string;
  /** Optional: TypeScript error code (e.g., 'TS2339') */
  code?: string;
}

/**
 * Result from suggestion lookup
 */
export interface SuggestionResult {
  /** The matched pattern category */
  category: ErrorPatternCategory;
  /** The suggestion text */
  suggestion: string;
  /** The matched error code, if applicable */
  code?: string;
  /** Confidence level of the match (exact code match vs regex match) */
  confidence: 'high' | 'medium';
}
```

### Class Design

```typescript
/**
 * SuggestionMatcher - Maps common error patterns to actionable suggestions
 *
 * Provides a simple interface to look up suggestions for common errors
 * encountered during development workflows. Supports TypeScript errors,
 * file system errors, module resolution errors, and permission errors.
 *
 * @example
 * ```typescript
 * const matcher = new SuggestionMatcher();
 *
 * const suggestion = matcher.getSuggestion("Cannot find module 'foo'");
 * // Returns: { category: 'module', suggestion: '...', confidence: 'medium' }
 *
 * const tsSuggestion = matcher.getSuggestion("TS2339: Property 'x' does not exist");
 * // Returns: { category: 'typescript', suggestion: '...', code: 'TS2339', confidence: 'high' }
 * ```
 */
export class SuggestionMatcher {
  private readonly patterns: ErrorPattern[];

  constructor() {
    this.patterns = [
      ...this.initializeTypeScriptPatterns(),
      ...this.initializeFileSystemPatterns(),
      ...this.initializeModulePatterns(),
      ...this.initializePermissionPatterns(),
    ];
  }

  /**
   * Get a suggestion for an error message
   *
   * @param error - The error message or error object to match
   * @returns SuggestionResult if a matching pattern is found, undefined otherwise
   */
  public getSuggestion(error: string | Error): SuggestionResult | undefined {
    const errorMessage = typeof error === 'string' ? error : error.message;

    // First, try to match by TypeScript error code (highest confidence)
    const tsCodeMatch = errorMessage.match(/TS(\d{4,5})/);
    if (tsCodeMatch) {
      const code = `TS${tsCodeMatch[1]}`;
      const pattern = this.patterns.find(p => p.code === code);
      if (pattern) {
        return {
          category: pattern.category,
          suggestion: pattern.suggestion,
          code: pattern.code,
          confidence: 'high',
        };
      }
    }

    // Fall back to pattern matching
    for (const pattern of this.patterns) {
      const matches = typeof pattern.pattern === 'string'
        ? errorMessage.toLowerCase().includes(pattern.pattern.toLowerCase())
        : pattern.pattern.test(errorMessage);

      if (matches) {
        return {
          category: pattern.category,
          suggestion: pattern.suggestion,
          code: pattern.code,
          confidence: 'medium',
        };
      }
    }

    return undefined;
  }

  /**
   * Get all registered patterns
   */
  public getPatterns(): ReadonlyArray<ErrorPattern> {
    return this.patterns;
  }

  /**
   * Get patterns by category
   */
  public getPatternsByCategory(category: ErrorPatternCategory): ReadonlyArray<ErrorPattern> {
    return this.patterns.filter(p => p.category === category);
  }
}
```

### Error Pattern Mappings

#### TypeScript Errors

| Code | Pattern | Suggestion |
|------|---------|------------|
| TS2304 | Cannot find name | Check if the type/variable is imported, or add a type declaration |
| TS2339 | Property does not exist | Verify the property exists on the type, or use optional chaining (?.) |
| TS2345 | Argument type mismatch | Check function signature and ensure argument types match |
| TS2322 | Type not assignable | Verify type compatibility, use type assertion if intentional |
| TS2307 | Cannot find module | Install the missing package or add @types/package for type definitions |
| TS2532 | Object possibly undefined | Add null check or use optional chaining (?.) before accessing |
| TS2531 | Object possibly null | Add null check before accessing properties |
| TS7006 | Implicit any | Add explicit type annotation to the parameter |
| TS1005 | Expected token | Check for syntax errors like missing semicolons or brackets |
| TS2349 | Not callable | Ensure the value is a function before calling |
| TS2554 | Wrong argument count | Check function signature for required/optional parameters |
| TS2741 | Property missing | Add the required property to the object literal |

#### File System Errors

| Pattern | Suggestion |
|---------|------------|
| ENOENT | File or directory not found. Verify the path exists and is spelled correctly |
| EACCES | Permission denied. Check file permissions or run with appropriate privileges |
| EEXIST | File already exists. Use a different name or remove the existing file first |
| EISDIR | Expected a file but found a directory. Check your path |
| ENOTDIR | Expected a directory but found a file. Check your path |
| ENOTEMPTY | Directory not empty. Remove contents first or use recursive delete |
| EMFILE | Too many open files. Close unused file handles or increase ulimit |
| ENOSPC | No space left on device. Free up disk space |

#### Module Errors

| Pattern | Suggestion |
|---------|------------|
| Cannot find module | Install the missing package with npm/yarn, or check the import path |
| Module not found | Verify the module path is correct and the package is installed |
| Cannot resolve | Check the import path and ensure the file/module exists |
| Unexpected token | The file may have syntax errors or be in an unexpected format |
| exports is not defined | Use ES module syntax (import/export) or configure module type |
| require is not defined | Use import syntax in ES modules, or add "type": "commonjs" |

#### Permission Errors

| Pattern | Suggestion |
|---------|------------|
| Permission denied | Check file/directory permissions and ownership |
| EPERM | Operation not permitted. May require elevated privileges |
| Access is denied | Windows permission error. Check file permissions and run as admin if needed |
| unauthorized | Authentication required. Check credentials or API keys |
| forbidden | Access forbidden. Verify you have the required permissions |

### File Structure

```
packages/orchestrator/src/
├── suggestion-matcher.ts       # SuggestionMatcher class
└── suggestion-matcher.test.ts  # Unit tests (to be created in develop stage)
```

### Integration with ErrorFeedbackLoop

The `SuggestionMatcher` can be used standalone or integrated with the `ErrorFeedbackLoop` (ADR-024):

```typescript
// Future integration example
class ErrorFeedbackLoop {
  private suggestionMatcher = new SuggestionMatcher();

  receiveError(error: StructuredError, taskId?: string): CompilerError {
    // Auto-populate suggestion if not provided
    if (!error.suggestion) {
      const result = this.suggestionMatcher.getSuggestion(error.message);
      if (result) {
        error.suggestion = result.suggestion;
      }
    }
    // ... rest of receiveError logic
  }
}
```

### Export

Add to `packages/orchestrator/src/index.ts`:

```typescript
export {
  SuggestionMatcher,
  type ErrorPattern,
  type ErrorPatternCategory,
  type SuggestionResult
} from './suggestion-matcher';
```

## Testing Strategy

### Unit Tests (suggestion-matcher.test.ts)

1. **TypeScript Error Matching**
   - Match by error code (TS2339, TS2304, etc.)
   - Match by error message pattern
   - High confidence for code matches

2. **File System Error Matching**
   - Match ENOENT, EACCES, EEXIST, etc.
   - Return appropriate suggestions

3. **Module Error Matching**
   - Match "Cannot find module" patterns
   - Match import resolution errors

4. **Permission Error Matching**
   - Match permission-related patterns
   - Cross-platform patterns (Unix and Windows)

5. **No Match Behavior**
   - Returns undefined for unknown errors
   - Returns undefined for empty strings

6. **Edge Cases**
   - Case-insensitive matching
   - Partial matches
   - Error object input (not just string)

## Consequences

### Positive

- **Simple API**: Single `getSuggestion(error)` method
- **Consistent with codebase**: Follows DangerousOperationDetector pattern
- **Type-safe**: Full TypeScript support
- **Extensible**: Easy to add new patterns
- **Reusable**: Can be used standalone or integrated with ErrorFeedbackLoop
- **Confidence levels**: Distinguishes between exact code matches and pattern matches

### Negative

- **Static patterns**: Patterns are hardcoded (can be extended to load from config)
- **English only**: Suggestions are in English (internationalization could be added)

### Risks

- None for MVP scope - focused utility class with clear responsibility

## References

- `packages/orchestrator/src/dangerous-operation-detector.ts` - Similar pattern-based detection
- `packages/orchestrator/src/docs/ADR-024-error-feedback-loop.md` - Future integration target
- `packages/core/src/error-formatter.ts` - StructuredError definition
