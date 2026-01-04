# ADR-010: Secret Detection in Tool Outputs

## Status
Proposed

## Date
2024-01-04

## Context

APEX needs to detect secrets in tool outputs before they are exposed through events. Currently:
- `SecretScanner` class exists in `packages/orchestrator/src/scanner.ts` with full pattern-based detection
- `SecretScanner` is initialized in `ApexOrchestrator` when configured
- Tool events (`tool:start`, `tool:complete`) are emitted when tools execute
- Tool outputs are included in `tool:complete` events without scanning

We need to:
1. Scan tool outputs for secrets before `tool:complete` events are emitted
2. Emit a `secret:detected` event when secrets are found
3. Include tool name, detection results, and configured behavior in the event payload

## Decision

### 1. Event Type Definition

Add a new `secret:detected` event to the `ApexOrchestratorEvents` interface:

```typescript
// In packages/orchestrator/src/index.ts

/**
 * Event payload for secret:detected event (v0.5.0)
 * Emitted when a tool output contains detected secrets
 */
export interface SecretDetectedEvent {
  /** Task ID being executed */
  taskId: string;
  /** Name of the tool whose output contained secrets */
  toolName: string;
  /** Unique identifier for this tool call */
  callId: string;
  /** Array of detected secret findings */
  findings: SecretFinding[];
  /** Total number of secrets detected */
  count: number;
  /** Severity breakdown */
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Configured behavior for secret detection */
  behavior: SecretDetectionBehavior;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Behavior configuration for secret detection
 */
export type SecretDetectionBehavior = 'log' | 'warn' | 'block' | 'mask';
```

Add to `ApexOrchestratorEvents`:
```typescript
'secret:detected': (event: SecretDetectedEvent) => void;
```

### 2. Integration Point

The scanning should occur in the tool output processing flow, specifically in the `executeStage` method where `tool_result` blocks are processed (around line 2299-2357 in `index.ts`).

**Before** emitting `tool:complete`, we will:
1. Check if `secretScanner` is configured
2. Scan the tool output content
3. If findings exist, emit `secret:detected` event
4. Then emit `tool:complete` (possibly with masked output based on behavior)

### 3. Scanning Flow

```
┌──────────────────┐
│ tool_result      │
│ block received   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ secretScanner    │──── No ───► Emit tool:complete
│ configured?      │              (unchanged flow)
└────────┬─────────┘
         │ Yes
         ▼
┌──────────────────┐
│ Scan output      │
│ for secrets      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Secrets found?   │──── No ───► Emit tool:complete
└────────┬─────────┘              (unchanged flow)
         │ Yes
         ▼
┌──────────────────┐
│ Emit             │
│ secret:detected  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Apply behavior   │
│ (mask/log/etc)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Emit             │
│ tool:complete    │
└──────────────────┘
```

### 4. Configuration Schema Extension

Add behavior configuration to `SecretScannerConfigSchema`:

```typescript
// In packages/core/src/types.ts

export const SecretDetectionBehaviorSchema = z.enum(['log', 'warn', 'block', 'mask']);
export type SecretDetectionBehavior = z.infer<typeof SecretDetectionBehaviorSchema>;

// Update SecretScannerConfigSchema
export const SecretScannerConfigSchema = z.object({
  // ... existing fields ...

  /** Behavior when secrets are detected in tool outputs (default: 'warn') */
  onSecretDetected: SecretDetectionBehaviorSchema.optional().default('warn'),
});
```

### 5. Behavior Definitions

| Behavior | Description |
|----------|-------------|
| `log` | Log the detection, emit event, continue normally |
| `warn` | Emit event with warning level, log prominently |
| `block` | Emit event, prevent tool output from being stored/logged |
| `mask` | Emit event, mask secrets in the output before storing |

### 6. Implementation Location

The primary implementation will be in `packages/orchestrator/src/index.ts`:

1. Add `SecretDetectedEvent` interface (~line 450)
2. Add to `ApexOrchestratorEvents` interface (~line 185)
3. Modify tool result handling in `executeStage` (~line 2305):

```typescript
// After getting tool output, before emitting tool:complete
if (this.secretScanner && block.content) {
  const outputContent = typeof block.content === 'string'
    ? block.content
    : JSON.stringify(block.content);

  const findings = this.secretScanner.scan(outputContent, `tool:${toolName}`);

  if (findings.length > 0) {
    const severityCounts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    };

    this.emit('secret:detected', {
      taskId: task.id,
      toolName: toolExecution.toolName,
      callId,
      findings,
      count: findings.length,
      severityCounts,
      behavior: this.config.scanner?.onSecretDetected ?? 'warn',
      timestamp: new Date(),
    });

    // Apply behavior (mask/block/etc)
    // ...
  }
}
```

### 7. Type Exports

Export the new types from `packages/core/src/types.ts`:
- `SecretDetectionBehavior`
- `SecretDetectedEvent` (via orchestrator re-export)

### 8. Test Coverage Requirements

1. Unit tests in `packages/orchestrator/src/__tests__/`:
   - `secret-detected-event.test.ts` - Event emission tests
   - Update existing tool event tests to verify ordering

2. Test scenarios:
   - Scanner not configured → no scanning, no event
   - Scanner configured, no secrets → no event
   - Scanner configured, secrets found → event emitted with correct payload
   - Multiple secrets in output → correct count and severity breakdown
   - Behavior configuration affects output handling
   - Event timing: `secret:detected` emitted BEFORE `tool:complete`

## Consequences

### Positive
- Proactive secret detection prevents accidental exposure
- Event-based architecture allows flexible handling (logging, alerting, blocking)
- Configurable behavior supports different security postures
- Integration with existing `SecretScanner` minimizes new code

### Negative
- Slight performance overhead for scanning all tool outputs
- Additional complexity in tool output flow
- Potential for false positives triggering unnecessary alerts

### Risks
- Large tool outputs could slow execution (mitigated by existing maxLineLength)
- Pattern matching is not foolproof (low-confidence findings should be filtered)

## Implementation Notes

### File Changes Required

1. **packages/core/src/types.ts**
   - Add `SecretDetectionBehaviorSchema`
   - Update `SecretScannerConfigSchema` with `onSecretDetected` field

2. **packages/orchestrator/src/index.ts**
   - Add `SecretDetectedEvent` interface
   - Update `ApexOrchestratorEvents` with `secret:detected`
   - Modify `executeStage` tool result handling

3. **New test file**: `packages/orchestrator/src/__tests__/secret-detected-event.test.ts`

### Dependency Order

1. First: Update core types (schema extension)
2. Second: Update orchestrator (event interface and emission logic)
3. Third: Add tests

### Rollback Plan

If issues arise, the feature can be disabled by:
1. Not configuring `scanner` in apex config
2. The conditional check `if (this.secretScanner)` ensures no impact when disabled

## References

- Existing SecretScanner: `packages/orchestrator/src/scanner.ts`
- Tool events implementation: `packages/orchestrator/src/index.ts` (lines 2280-2357)
- SecretScanner integration tests: `packages/orchestrator/src/__tests__/apex-orchestrator-secret-scanner-integration.test.ts`
