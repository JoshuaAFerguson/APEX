# ADR-024: ErrorFeedbackLoop Core Class

## Status

Proposed

## Date

2025-01-02

## Context

APEX agents need a mechanism to receive, track, and respond to compiler and build errors during development workflows. This enables iterative error correction and supports future integration with automated fix suggestions.

### Requirements

1. **Error Reception**: Accept compiler errors (TypeScript, ESLint, build errors)
2. **In-Memory Storage**: Maintain error history for analysis and pattern detection
3. **Event Emission**: Emit events when errors are received for real-time notification
4. **Extensibility**: Support future enhancements (fix suggestions, error patterns)

### Existing Patterns

The orchestrator package has well-established patterns for event-emitting classes:

1. **EventEmitter3 Base**: All event-emitting classes use `eventemitter3`
   - `ThoughtCaptureManager extends EventEmitter<ThoughtCaptureManagerEvents>`
   - `CapacityMonitor extends EventEmitter<CapacityMonitorEvents>`
   - `WorkspaceManager extends EventEmitter<WorkspaceManagerEvents>`

2. **Typed Events Interface**: Events are defined via a typed interface
   ```typescript
   interface FooEvents {
     'event:name': (payload: PayloadType) => void;
   }
   ```

3. **Core Types Integration**: Use types from `@apexcli/core` (e.g., `StructuredError`)

## Decision

Create `ErrorFeedbackLoop` class in `packages/orchestrator/src/error-feedback.ts` following established patterns.

### Architecture

```typescript
import { EventEmitter } from 'eventemitter3';
import { StructuredError, ErrorContext } from '@apexcli/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Compiler error with additional metadata for feedback loop processing
 */
export interface CompilerError {
  /** Unique identifier for this error instance */
  id: string;
  /** The structured error from @apexcli/core */
  error: StructuredError;
  /** When the error was received */
  receivedAt: Date;
  /** Task ID associated with this error (if any) */
  taskId?: string;
  /** Whether the error has been addressed/fixed */
  resolved: boolean;
  /** Resolution timestamp */
  resolvedAt?: Date;
}

/**
 * Event payload for error:received event
 */
export interface ErrorReceivedEvent {
  /** The compiler error that was received */
  error: CompilerError;
  /** Total count of unresolved errors after this one was added */
  unresolvedCount: number;
  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * Event payload for error:resolved event
 */
export interface ErrorResolvedEvent {
  /** The compiler error that was resolved */
  error: CompilerError;
  /** Remaining unresolved error count */
  remainingCount: number;
  /** Timestamp of resolution */
  timestamp: Date;
}

/**
 * Event payload for errors:cleared event
 */
export interface ErrorsClearedEvent {
  /** Number of errors that were cleared */
  clearedCount: number;
  /** Task ID if errors were cleared for a specific task */
  taskId?: string;
  /** Timestamp of the clear operation */
  timestamp: Date;
}

// ============================================================================
// Events Interface
// ============================================================================

export interface ErrorFeedbackLoopEvents {
  /** Emitted when a new error is received */
  'error:received': (event: ErrorReceivedEvent) => void;
  /** Emitted when an error is marked as resolved */
  'error:resolved': (event: ErrorResolvedEvent) => void;
  /** Emitted when errors are cleared */
  'errors:cleared': (event: ErrorsClearedEvent) => void;
}
```

### Class Design

```typescript
export class ErrorFeedbackLoop extends EventEmitter<ErrorFeedbackLoopEvents> {
  // In-memory error storage
  private errors: Map<string, CompilerError> = new Map();

  constructor() {
    super();
  }

  /**
   * Receive a new compiler error
   */
  receiveError(error: StructuredError, taskId?: string): CompilerError {
    const compilerError: CompilerError = {
      id: this.generateId(),
      error,
      receivedAt: new Date(),
      taskId,
      resolved: false,
    };

    this.errors.set(compilerError.id, compilerError);

    this.emit('error:received', {
      error: compilerError,
      unresolvedCount: this.getUnresolvedCount(),
      timestamp: new Date(),
    });

    return compilerError;
  }

  /**
   * Receive multiple errors at once (e.g., from a build)
   */
  receiveErrors(errors: StructuredError[], taskId?: string): CompilerError[] {
    return errors.map(e => this.receiveError(e, taskId));
  }

  /**
   * Mark an error as resolved
   */
  resolveError(errorId: string): boolean { ... }

  /**
   * Get all errors (optionally filtered by task)
   */
  getErrors(taskId?: string): CompilerError[] { ... }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(taskId?: string): CompilerError[] { ... }

  /**
   * Get resolved errors
   */
  getResolvedErrors(taskId?: string): CompilerError[] { ... }

  /**
   * Clear all errors (optionally for a specific task)
   */
  clearErrors(taskId?: string): number { ... }

  /**
   * Get count of unresolved errors
   */
  getUnresolvedCount(taskId?: string): number { ... }

  /**
   * Check if there are any unresolved errors
   */
  hasUnresolvedErrors(taskId?: string): boolean { ... }

  private generateId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### File Structure

```
packages/orchestrator/src/
├── error-feedback.ts           # ErrorFeedbackLoop class
└── error-feedback.test.ts      # Unit tests
```

### Integration with StructuredError

The class uses `StructuredError` from `@apexcli/core` which provides:
- `id`: Unique error identifier
- `message`: Human-readable message
- `severity`: error | warning | info | hint
- `category`: syntax | type | lint | test | runtime | build | etc.
- `location`: File, line, column information
- `code`: Error code (e.g., TS2339)
- `suggestion`: Suggested fix

This enables rich error metadata without reinventing the wheel.

### Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Source                              │
│  (TypeScript Compiler, ESLint, Build Tools)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  ErrorFeedbackLoop                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ receiveError(error: StructuredError, taskId?)       │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ errors: Map<string, CompilerError>                   │   │
│  │   - In-memory storage                                │   │
│  │   - Indexed by error ID                              │   │
│  │   - Queryable by taskId                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ emit('error:received', { error, unresolvedCount })   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Consumers                           │
│  (ApexOrchestrator, CLI, API, Future FixSuggester)          │
└─────────────────────────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests (error-feedback.test.ts)

1. **Error Reception Tests**
   - Single error reception
   - Multiple error reception via `receiveErrors()`
   - Error with taskId association
   - Error without taskId

2. **Event Emission Tests**
   - `error:received` event emitted on receiveError()
   - Event payload contains correct error and count
   - `error:resolved` event emitted on resolveError()
   - `errors:cleared` event emitted on clearErrors()

3. **Storage and Query Tests**
   - getErrors() returns all errors
   - getErrors(taskId) filters by task
   - getUnresolvedErrors() filters by resolved status
   - getUnresolvedCount() returns correct count

4. **Resolution Tests**
   - resolveError() marks error as resolved
   - resolveError() sets resolvedAt timestamp
   - resolveError() returns false for non-existent ID

5. **Clear Tests**
   - clearErrors() removes all errors
   - clearErrors(taskId) removes only matching task errors
   - clearErrors() returns count of cleared errors

## Consequences

### Positive

- **Consistent with codebase**: Follows established EventEmitter patterns
- **Type-safe**: Full TypeScript support with typed events
- **Reuses core types**: Leverages existing `StructuredError` schema
- **Testable**: Simple in-memory storage, easy to test
- **Extensible**: Can add persistence, pattern detection, fix suggestions later

### Negative

- **Memory growth**: Long-running sessions could accumulate errors (mitigated by clearErrors)
- **No persistence**: Errors lost on restart (intentional for MVP, can add later)

### Risks

- None for MVP scope - this is a focused, well-defined component

## References

- `packages/core/src/error-formatter.ts` - StructuredError definition
- `packages/orchestrator/src/thought-capture.ts` - Similar EventEmitter pattern
- `packages/orchestrator/src/capacity-monitor.ts` - Similar EventEmitter pattern
