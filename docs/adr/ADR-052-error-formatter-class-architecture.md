# ADR-052: ErrorFormatter Class Architecture

## Status
Proposed

## Context
The APEX CLI needs a styled error formatter utility class for non-React console output. While the React-based `ErrorDisplay.tsx` component handles error rendering in the Ink-based UI, there's a need for a pure chalk-based utility class that can format errors consistently across handlers, services, and other non-React CLI contexts (e.g., `daemon-handlers.ts`, `confirmation.ts`, `task-inspector.ts`).

### Current State
- **ErrorDisplay.tsx**: React/Ink component for UI-based error display with suggestions
- **daemon-handlers.ts**: Uses inline chalk formatting for errors (e.g., `chalk.red()`)
- **confirmation.ts**: Uses chalk for warning/error styling
- **task-inspector.ts**: Uses chalk for comprehensive task inspection output

### Problem
Error formatting is scattered and inconsistent across the codebase. Each handler implements its own styling patterns, leading to:
- Duplicated styling logic
- Inconsistent error presentation
- No standardized structure for error context (file:line, suggestions, etc.)
- No verbosity level support for debugging vs user-facing output

## Decision

Create an `ErrorFormatter` class in `packages/cli/src/utils/ErrorFormatter.ts` that provides:

### 1. Core Interface

```typescript
/**
 * Verbosity levels for error output
 */
export type ErrorVerbosity = 'minimal' | 'normal' | 'verbose' | 'debug';

/**
 * Error location context
 */
export interface ErrorLocation {
  file?: string;
  line?: number;
  column?: number;
  functionName?: string;
}

/**
 * Suggestion for resolving an error
 */
export interface ErrorSuggestion {
  title: string;
  description: string;
  command?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Structured error information
 */
export interface FormattedError {
  message: string;
  code?: string;
  location?: ErrorLocation;
  stack?: string;
  context?: Record<string, unknown>;
  suggestions?: ErrorSuggestion[];
  timestamp?: Date;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Configuration options for error formatting
 */
export interface ErrorFormatterOptions {
  /** Default verbosity level */
  verbosity?: ErrorVerbosity;
  /** Whether to show timestamps */
  showTimestamp?: boolean;
  /** Maximum width for output (default: terminal width or 80) */
  maxWidth?: number;
  /** Whether to show color output (default: true) */
  useColors?: boolean;
}
```

### 2. ErrorFormatter Class

```typescript
export class ErrorFormatter {
  private options: Required<ErrorFormatterOptions>;

  constructor(options?: ErrorFormatterOptions);

  /**
   * Format a complete error with all sections
   */
  format(error: Error | FormattedError | string, overrideVerbosity?: ErrorVerbosity): string;

  /**
   * Format just the error header with icon and message
   */
  formatHeader(message: string, severity?: 'error' | 'warning' | 'info'): string;

  /**
   * Format error location context (file:line:column)
   */
  formatLocation(location: ErrorLocation): string;

  /**
   * Format suggestions section
   */
  formatSuggestions(suggestions: ErrorSuggestion[]): string;

  /**
   * Format stack trace with configurable depth
   */
  formatStack(stack: string, maxLines?: number): string;

  /**
   * Format context key-value pairs
   */
  formatContext(context: Record<string, unknown>): string;

  /**
   * Set verbosity level dynamically
   */
  setVerbosity(level: ErrorVerbosity): void;

  /**
   * Parse an Error object into FormattedError structure
   */
  static parseError(error: Error): FormattedError;

  /**
   * Extract file:line information from stack trace
   */
  static extractLocation(stack: string): ErrorLocation | undefined;

  /**
   * Generate automatic suggestions based on error message patterns
   */
  static generateSuggestions(message: string): ErrorSuggestion[];
}
```

### 3. Visual Design

The ErrorFormatter will produce styled output with distinct visual sections:

```
┌─ Error ──────────────────────────────────────────────┐
│ ❌ Error: ENOENT: no such file or directory          │
├─ Location ───────────────────────────────────────────┤
│   📍 src/utils/config.ts:42:15                       │
│      in loadConfiguration()                          │
├─ Context ────────────────────────────────────────────┤
│   path: /home/user/.apex/config.yaml                 │
│   operation: read                                    │
├─ Suggestions ────────────────────────────────────────┤
│   🔴 Missing configuration file                      │
│      Run 'apex init' to create the configuration     │
│      Try: apex init                                  │
│   🟡 Check file permissions                          │
│      Verify the file exists and is readable          │
└──────────────────────────────────────────────────────┘
```

### 4. Verbosity Levels

| Level | Shows |
|-------|-------|
| `minimal` | Error message only (single line) |
| `normal` | Message + location + top suggestion |
| `verbose` | Message + location + context + all suggestions |
| `debug` | Everything including full stack trace |

### 5. Color Scheme

Following existing patterns in the codebase:

- **Error messages**: `chalk.red`
- **Warnings**: `chalk.yellow`
- **Info**: `chalk.cyan`
- **Location (file:line)**: `chalk.gray` for path, `chalk.yellow` for line numbers
- **Suggestions**: `chalk.yellow` for titles, `chalk.white` for descriptions
- **Commands**: `chalk.cyan` with gray background
- **Context values**: `chalk.gray`
- **Priority icons**:
  - High: `🔴` (red circle)
  - Medium: `🟡` (yellow circle)
  - Low: `🟢` (green circle)
- **Separators**: `chalk.gray('─'.repeat(width))`

### 6. File Structure

```
packages/cli/src/utils/
├── ErrorFormatter.ts           # Main class implementation
├── __tests__/
│   └── ErrorFormatter.test.ts  # Unit tests
└── index.ts                    # Export barrel (add ErrorFormatter)
```

### 7. Integration Points

The ErrorFormatter will be usable in:

1. **Handler functions** (daemon-handlers, service-handlers):
   ```typescript
   const formatter = new ErrorFormatter({ verbosity: 'normal' });
   console.log(formatter.format(error));
   ```

2. **Services** (task-inspector, confirmation):
   ```typescript
   const formatter = new ErrorFormatter({ verbosity: 'verbose' });
   console.log(formatter.formatHeader('Task failed', 'error'));
   console.log(formatter.formatLocation({ file: task.file, line: task.line }));
   ```

3. **CLI entrypoint** (index.ts):
   ```typescript
   import { ErrorFormatter } from './utils/ErrorFormatter.js';
   const errorFormatter = new ErrorFormatter({
     verbosity: config?.verbosity || 'normal'
   });
   ```

### 8. Compatibility with ErrorDisplay.tsx

The `ErrorFormatter` class will share types with `ErrorDisplay.tsx`:
- `ErrorSuggestion` interface is already defined in ErrorDisplay.tsx
- Import from ErrorDisplay or create a shared types file

For consistency, we recommend:
```typescript
// packages/cli/src/types/error.ts
export interface ErrorSuggestion { ... }
export interface ErrorLocation { ... }
export interface FormattedError { ... }
```

Both `ErrorFormatter.ts` and `ErrorDisplay.tsx` can import from this shared location.

## Consequences

### Positive
- **Consistency**: All CLI error output follows the same visual patterns
- **Maintainability**: Single source of truth for error formatting logic
- **Flexibility**: Verbosity levels allow appropriate detail for different contexts
- **Testability**: Pure class with no React dependencies, easy to unit test
- **Reusability**: Can be used across handlers, services, and utilities

### Negative
- Additional abstraction layer for simple error cases
- Need to update existing handlers to use the new formatter (migration effort)

### Neutral
- Works alongside (not replacing) the React-based ErrorDisplay component
- No breaking changes to existing functionality

## Implementation Notes

1. **Static utility methods**: Include `parseError()`, `extractLocation()`, and `generateSuggestions()` as static methods for use without instantiation

2. **Builder pattern alternative**: Consider a fluent builder API for complex error construction:
   ```typescript
   ErrorFormatter.create()
     .message('Failed to load configuration')
     .location({ file: 'config.ts', line: 42 })
     .addSuggestion({ title: 'Run init', ... })
     .format('verbose');
   ```

3. **Terminal width detection**: Use `process.stdout.columns` or fallback to 80

4. **Box drawing**: Consider using `boxen` package (already in dependencies) for bordered output at verbose/debug levels

## References

- Existing patterns: `daemon-handlers.ts`, `confirmation.ts`, `task-inspector.ts`
- React component: `ErrorDisplay.tsx`
- Chalk documentation: https://github.com/chalk/chalk
- Boxen package: https://github.com/sindresorhus/boxen
