# ADR-051: Auto-Fix Orchestrator Event Integration

## Status
Accepted

## Date
2026-01-08

## Context

APEX's auto-fix functionality (for automatically fixing missing imports, syntax errors, and formatting issues) currently has event types defined in `@apex/core/types.ts`, but these events are **not integrated** into the main `OrchestratorEvents` interface in `@apex/orchestrator`. This prevents:

1. The CLI and API from receiving real-time notifications about auto-fix operations
2. Proper auditing and debugging of auto-fix operations
3. UI components from displaying auto-fix progress to users

### Current State Analysis

#### Existing Auto-Fix Types in `@apex/core/types.ts`

```typescript
// Event types enum (lines 6172-6178)
export const AutoFixEventTypeSchema = z.enum([
  'autofix:requested',   // Auto-fix was requested for a file
  'autofix:started',     // Auto-fix operation began
  'autofix:completed',   // Auto-fix operation completed successfully
  'autofix:failed',      // Auto-fix operation failed
  'autofix:skipped',     // Auto-fix was skipped (disabled or no fixes needed)
]);

// Event record schema (lines 6185-6216)
export const AutoFixEventSchema = z.object({
  id: z.string().min(1),
  type: AutoFixEventTypeSchema,
  taskId: z.string().min(1),
  filePath: z.string().min(1),
  fixType: z.enum(['syntax', 'imports', 'formatting']).optional(),
  timestamp: z.date(),
  issuesDetected: z.number().min(0).optional(),
  issuesFixed: z.number().min(0).optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

#### Existing `ImportAutoFixer` Events (separate event system)

The `ImportAutoFixer` class has its own `ImportAutoFixerEvents` interface:
- `analysis:started`, `analysis:completed`
- `fix:started`, `fix:import-added`, `fix:completed`, `fix:error`
- `resolution:ambiguous`

These are component-level events that need to be bridged to orchestrator-level events.

#### OrchestratorEvents Interface Gap

The `OrchestratorEvents` interface (90+ event types) currently has NO auto-fix events. It includes similar patterns:
- `lint:started`, `lint:completed`, `lint:issue`, `lint:fix-applied`
- `tool:start`, `tool:progress`, `tool:complete`
- `hook:pre:start`, `hook:pre:complete`, etc.

## Decision

### 1. Naming Convention Decision

**Use existing `autofix:*` naming convention** (no hyphen) to maintain consistency with:
- Existing `AutoFixEventTypeSchema` in core types
- Pattern used by lint events (`lint:started`, not `lint-started`)
- Pattern used by other orchestrator events

The acceptance criteria mentioned `auto-fix:*` but we will use `autofix:*` to align with existing codebase conventions.

### 2. Event Type Design

Add the following events to `OrchestratorEvents`:

```typescript
// Auto-fix events (v0.5.0)
'autofix:requested': (event: AutoFixRequestedEventData) => void;
'autofix:started': (event: AutoFixStartedEventData) => void;
'autofix:progress': (event: AutoFixProgressEventData) => void;
'autofix:completed': (event: AutoFixCompletedEventData) => void;
'autofix:failed': (event: AutoFixFailedEventData) => void;
'autofix:skipped': (event: AutoFixSkippedEventData) => void;
```

### 3. Event Data Interfaces

Define specific event data interfaces following existing patterns:

```typescript
/**
 * Event payload when auto-fix is requested for a file
 */
export interface AutoFixRequestedEventData {
  taskId: string;
  filePath: string;
  fixTypes: Array<'syntax' | 'imports' | 'formatting'>;
  triggeredBy: 'agent' | 'hook' | 'manual';
  timestamp: Date;
}

/**
 * Event payload when auto-fix operation begins
 */
export interface AutoFixStartedEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  issuesDetected: number;
  timestamp: Date;
}

/**
 * Event payload for auto-fix progress updates
 */
export interface AutoFixProgressEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  issuesFixed: number;
  issuesRemaining: number;
  currentFix?: string; // Description of current fix being applied
  timestamp: Date;
}

/**
 * Event payload when auto-fix completes successfully
 */
export interface AutoFixCompletedEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  issuesDetected: number;
  issuesFixed: number;
  duration: number; // milliseconds
  timestamp: Date;
}

/**
 * Event payload when auto-fix fails
 */
export interface AutoFixFailedEventData {
  taskId: string;
  filePath: string;
  fixType: 'syntax' | 'imports' | 'formatting';
  error: string;
  issuesDetected: number;
  issuesFixed: number; // How many were fixed before failure
  timestamp: Date;
}

/**
 * Event payload when auto-fix is skipped
 */
export interface AutoFixSkippedEventData {
  taskId: string;
  filePath: string;
  reason: 'disabled' | 'no_issues' | 'unsupported_file' | 'manual_override';
  timestamp: Date;
}
```

### 4. Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ApexOrchestrator                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    OrchestratorEvents                         │  │
│  │  - autofix:requested                                          │  │
│  │  - autofix:started                                            │  │
│  │  - autofix:progress (NEW - not in AutoFixEventTypeSchema)     │  │
│  │  - autofix:completed                                          │  │
│  │  - autofix:failed                                             │  │
│  │  - autofix:skipped                                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                               ▲                                     │
│                               │ emit()                              │
│  ┌───────────────────────────┴──────────────────────────────────┐  │
│  │                    ImportAutoFixer                            │  │
│  │  (bridges ImportAutoFixerEvents to OrchestratorEvents)        │  │
│  │                                                               │  │
│  │  fix:started → autofix:started                                │  │
│  │  fix:import-added → autofix:progress                          │  │
│  │  fix:completed → autofix:completed                            │  │
│  │  fix:error → autofix:failed                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Implementation Plan

#### Phase 1: Core Types (this stage - architecture)
1. Add event data interfaces to `@apex/orchestrator/src/index.ts`
2. Update `OrchestratorEvents` interface with auto-fix events

#### Phase 2: Implementation (next stage - development)
1. Add emit helper methods to `ApexOrchestrator`
2. Wire `ImportAutoFixer` events to orchestrator events
3. Update any other auto-fix producers to emit events

#### Phase 3: Consumers (later stages)
1. CLI: Display auto-fix progress
2. API: WebSocket notifications
3. UI components: Real-time feedback

## Files to Modify

### `@apex/orchestrator/src/index.ts`
1. Add 6 new event data interfaces
2. Add 6 new events to `OrchestratorEvents` interface

### `@apex/core/src/types.ts` (optional enhancement)
- Consider adding `'autofix:progress'` to `AutoFixEventTypeSchema` for consistency
- Not strictly required but improves alignment

## Consequences

### Positive
- Full observability of auto-fix operations
- Enables CLI/UI progress indicators
- Consistent with existing event patterns
- Backward compatible (additive change only)

### Negative
- Slight increase in event volume during auto-fix operations
- Need to ensure event bridging doesn't create duplicate events

### Risks
- Performance impact if many files are auto-fixed simultaneously (mitigated by batching)

## Alternatives Considered

### 1. Use Hyphenated Names (`auto-fix:*`)
Rejected because existing codebase uses `autofix:*` and other events use colons without hyphens.

### 2. Reuse ImportAutoFixerEvents Directly
Rejected because orchestrator events need task context and standardized payloads.

### 3. Add Events Only to Core Types
Rejected because events need to be emittable from the orchestrator.

## References

- `packages/core/src/types.ts` - AutoFixEventTypeSchema, AutoFixEventSchema
- `packages/orchestrator/src/index.ts` - OrchestratorEvents interface
- `packages/orchestrator/src/import-auto-fixer/types.ts` - ImportAutoFixerEvents
