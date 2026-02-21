# ADR-004: Enforcement Mode Actions (Audit, Redact, Block)

## Status
Proposed

## Context

APEX needs a comprehensive enforcement mode system for secret scanning that provides three distinct behaviors when secrets are detected in tool outputs:

1. **`audit`**: Log detections for auditing purposes without blocking or modifying output
2. **`redact`** (maps to `mask`): Mask secrets in outputs before storage/emission
3. **`block`**: Halt execution and mark task as failed

The enforcement mode is configured via `secretScanning.enforcementMode` in `.apex/config.yaml` and should emit appropriate events for each mode to enable external monitoring and integration.

### Current State Analysis

Based on codebase investigation:

1. **Types already exist** in `@apexcli/core`:
   - `SecretScanningEnforcementModeSchema` with values: `'warn'`, `'block'`, `'audit'`
   - `SecretDetectionBehaviorSchema` with values: `'log'`, `'warn'`, `'mask'`, `'block'`
   - `SecretDetectedEvent` interface for event emission
   - `SecretFinding` interface for finding details

2. **SecretOutputProcessor** (`packages/orchestrator/src/secret-output-processor.ts`):
   - Already implements `log`, `warn`, `mask`, `block` behaviors
   - Returns `SecretProcessingResult` with output modification, blocking status, and log level

3. **OrchestratorEvents** already includes:
   - `'secret:detected'` event with `SecretDetectedEvent` payload
   - Policy-related events: `'policy:violation'`, `'policy:blocked'`, `'policy:warned'`, `'policy:audited'`

4. **Secret scanning integration** in orchestrator (`index.ts` lines ~2619-2690):
   - Scans tool outputs using `SecretScanner`
   - Uses `resolveSecretDetectionBehavior()` to determine behavior
   - Emits `'secret:detected'` event on findings
   - Processes output using `SecretOutputProcessor`

### Gap Analysis

The current implementation needs:

1. **Enforcement mode mapping**: Map `secretScanning.enforcementMode` (`audit`/`warn`/`block`) to `SecretDetectionBehavior` (`log`/`warn`/`mask`/`block`)

2. **Audit mode event**: Add `'secret:audited'` event for audit-only mode that logs but doesn't warn

3. **Task failure on block mode**: Ensure task is properly marked as failed when `block` mode triggers

4. **Storage interception**: Ensure redacted content is used for task store logs, not original content

## Decision

### 1. Enforcement Mode to Behavior Mapping

Create a mapping function that converts `SecretScanningEnforcementMode` to `SecretDetectionBehavior`:

```typescript
// In packages/orchestrator/src/secret-output-processor.ts

/**
 * Maps SecretScanningEnforcementMode to SecretDetectionBehavior
 *
 * @param enforcementMode - The configured enforcement mode
 * @returns The corresponding detection behavior
 */
export function mapEnforcementModeToBehavior(
  enforcementMode: SecretScanningEnforcementMode
): SecretDetectionBehavior {
  switch (enforcementMode) {
    case 'audit':
      return 'log';  // Log only, no warnings or modifications
    case 'warn':
      return 'warn'; // Log warnings but don't modify
    case 'block':
      return 'block'; // Block execution entirely
    default:
      return 'warn'; // Safe default
  }
}
```

### 2. Add `'secret:audited'` Event Type

Extend `OrchestratorEvents` interface with a dedicated audit event:

```typescript
// In packages/orchestrator/src/index.ts

export interface SecretAuditedEvent {
  taskId: string;
  toolName: string;
  callId: string;
  findings: SecretFinding[];
  count: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  timestamp: Date;
  /** Indicates this is audit-only, no action taken */
  auditOnly: true;
}

// Add to OrchestratorEvents interface:
export interface OrchestratorEvents {
  // ... existing events ...

  // Secret scanning events (v0.5.0)
  'secret:detected': (event: SecretDetectedEvent) => void;
  'secret:audited': (event: SecretAuditedEvent) => void;
  'secret:redacted': (event: SecretRedactedEvent) => void;
  'secret:blocked': (event: SecretBlockedEvent) => void;
}
```

### 3. Add `'secret:redacted'` Event Type

For tracking when content is masked:

```typescript
export interface SecretRedactedEvent {
  taskId: string;
  toolName: string;
  callId: string;
  findings: SecretFinding[];
  count: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  redactedCount: number;
  timestamp: Date;
}
```

### 4. Add `'secret:blocked'` Event Type

For tracking when execution is blocked:

```typescript
export interface SecretBlockedEvent {
  taskId: string;
  toolName: string;
  callId: string;
  findings: SecretFinding[];
  count: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  blockReason: string;
  timestamp: Date;
}
```

### 5. Update `resolveSecretDetectionBehavior()` Method

Modify to prioritize `secretScanning.enforcementMode`:

```typescript
// In packages/orchestrator/src/index.ts

private resolveSecretDetectionBehavior(): SecretDetectionBehavior {
  // Priority 1: secretScanning.enforcementMode (new simplified config)
  const secretScanningConfig = this.effectiveConfig.secretScanning;
  if (secretScanningConfig?.enabled !== false && secretScanningConfig?.enforcementMode) {
    return mapEnforcementModeToBehavior(secretScanningConfig.enforcementMode);
  }

  // Priority 2: guardrails.secrets config
  const guardrails = this.effectiveConfig.guardrails;
  const guardrailsEnabled = guardrails?.enabled !== false;
  const guardrailSecrets = guardrailsEnabled && guardrails?.secrets?.enabled !== false
    ? guardrails.secrets
    : undefined;

  if (guardrailSecrets?.onDetection) {
    return guardrailSecrets.onDetection;
  }

  // Priority 3: Legacy scanner config
  return this.effectiveConfig.scanner?.onSecretDetected ?? 'warn';
}
```

### 6. Enhanced Secret Detection Flow in `runStage()`

Update the tool result handling to emit appropriate events based on mode:

```typescript
// In runStage() tool_result handling (around line 2619)

if (findings.length > 0) {
  const behavior = this.resolveSecretDetectionBehavior();
  const enforcementMode = this.resolveEnforcementMode(); // New helper
  const processed = this.secretOutputProcessor.processOutput(
    outputForEvents as string | Record<string, unknown>,
    findings,
    behavior
  );

  outputForEvents = processed.output;

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  // Emit base detection event (always)
  this.emit('secret:detected', {
    taskId: task.id,
    toolName: toolExecution.toolName,
    callId,
    findings,
    count: findings.length,
    severityCounts,
    behavior,
    timestamp: new Date(),
  });

  // Emit mode-specific events
  switch (enforcementMode) {
    case 'audit':
      this.emit('secret:audited', {
        taskId: task.id,
        toolName: toolExecution.toolName,
        callId,
        findings,
        count: findings.length,
        severityCounts,
        timestamp: new Date(),
        auditOnly: true,
      });
      break;

    case 'warn':
      // 'warn' mode: just logs warning, handled by existing secret:detected event
      // No additional event needed
      break;

    case 'block':
      success = false;
      toolError = processed.blockError || 'Tool output blocked due to secret detection';
      this.emit('secret:blocked', {
        taskId: task.id,
        toolName: toolExecution.toolName,
        callId,
        findings,
        count: findings.length,
        severityCounts,
        blockReason: toolError,
        timestamp: new Date(),
      });
      break;
  }

  // For redact/mask mode, emit redacted event if content was modified
  if (behavior === 'mask' && processed.wasModified) {
    this.emit('secret:redacted', {
      taskId: task.id,
      toolName: toolExecution.toolName,
      callId,
      findings,
      count: findings.length,
      severityCounts,
      redactedCount: findings.length,
      timestamp: new Date(),
    });
  }

  // Log the detection with appropriate level
  await this.store.addLog(task.id, {
    level: processed.logLevel,
    message: `Secrets detected in tool output: ${toolExecution.toolName} (${findings.length} findings)`,
    metadata: {
      toolName: toolExecution.toolName,
      callId,
      secretCount: findings.length,
      severityCounts,
      behavior,
      enforcementMode,
    },
  });
}
```

### 7. Helper Method for Enforcement Mode Resolution

```typescript
// In packages/orchestrator/src/index.ts

/**
 * Resolves the current enforcement mode from configuration
 * @returns The configured enforcement mode
 */
private resolveEnforcementMode(): SecretScanningEnforcementMode {
  const secretScanningConfig = this.effectiveConfig.secretScanning;
  return secretScanningConfig?.enforcementMode ?? 'warn';
}
```

### 8. Block Mode: Task Failure Handling

When block mode triggers, the task should be marked as failed. This is already handled by the existing flow where `success = false` causes tool execution to fail, which propagates up the chain.

However, we should add explicit task failure handling for critical secrets:

```typescript
// After the switch statement in runStage()

if (enforcementMode === 'block' && findings.some(f => f.severity === 'critical' || f.severity === 'high')) {
  // For block mode with critical/high severity secrets, mark task as failed
  const failureError = new Error(
    `Task blocked: ${findings.length} secret(s) detected including ` +
    `${severityCounts.critical} critical and ${severityCounts.high} high severity findings`
  );

  this.emit('task:failed', task, failureError);
  throw failureError;
}
```

## Architecture Diagram

```
                              ┌─────────────────────────────────┐
                              │      .apex/config.yaml          │
                              │  secretScanning:                │
                              │    enforcementMode: audit|warn|block
                              └──────────────┬──────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ApexOrchestrator                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     runStage() - Tool Result Handler              │  │
│  │  ┌────────────────┐   ┌─────────────────────┐                    │  │
│  │  │  SecretScanner │──▶│ SecretOutputProcessor │                  │  │
│  │  │  scan(content) │   │ processOutput(...)   │                    │  │
│  │  └────────────────┘   └──────────┬──────────┘                    │  │
│  │                                  │                                │  │
│  │         ┌────────────────────────┼────────────────────────┐      │  │
│  │         │                        │                        │      │  │
│  │         ▼                        ▼                        ▼      │  │
│  │  ┌────────────┐          ┌────────────┐          ┌────────────┐  │  │
│  │  │  'audit'   │          │   'warn'   │          │  'block'   │  │  │
│  │  │ Log only   │          │Log warning │          │ Halt exec  │  │  │
│  │  └─────┬──────┘          └─────┬──────┘          └─────┬──────┘  │  │
│  │        │                       │                       │         │  │
│  │        ▼                       ▼                       ▼         │  │
│  │  emit('secret:       emit('secret:             emit('secret:      │  │
│  │   audited')           detected')                blocked')          │  │
│  │                                                     │             │  │
│  │                                              task.status =        │  │
│  │                                                'failed'           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Event Subscribers  │
                    │  - CLI display      │
                    │  - API WebSocket    │
                    │  - Audit logs       │
                    │  - External systems │
                    └─────────────────────┘
```

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/types.ts` | MODIFY | Export `SecretScanningEnforcementMode` type (already exists) |
| `packages/orchestrator/src/index.ts` | MODIFY | Add `SecretAuditedEvent`, `SecretRedactedEvent`, `SecretBlockedEvent` interfaces; extend `OrchestratorEvents`; update `resolveSecretDetectionBehavior()`; add `resolveEnforcementMode()` |
| `packages/orchestrator/src/secret-output-processor.ts` | MODIFY | Add `mapEnforcementModeToBehavior()` function |

## Test Plan

### Unit Tests

1. **secret-output-processor.test.ts** - Update to test `mapEnforcementModeToBehavior()`
2. **enforcement-mode-events.test.ts** - New test file for mode-specific events

### Integration Tests

1. **secret-enforcement-audit.integration.test.ts** - Test audit mode event emission
2. **secret-enforcement-block.integration.test.ts** - Test block mode task failure
3. **secret-enforcement-redact.integration.test.ts** - Test redact mode output masking

### Acceptance Criteria Verification

| Criterion | Test Strategy |
|-----------|---------------|
| `audit` logs detections | Verify `secret:audited` event emitted, no blocking |
| `redact` masks secrets before storage/emission | Verify `secret:redacted` event, output modified |
| `block` halts execution and marks task failed | Verify `secret:blocked` event, task status = 'failed' |
| Each mode emits appropriate events | Verify event payloads match interfaces |

## Consequences

### Positive

- Clear separation of enforcement behaviors
- Comprehensive event system for monitoring
- Backward compatible with existing configurations
- Audit trail for security compliance

### Negative

- Additional event types increase complexity
- Existing `SecretDetectionBehavior` now has dual mapping paths

### Risks

- Performance impact of scanning all tool outputs (mitigated by existing implementation)
- False positives in secret detection could block legitimate operations (mitigated by configurable severity thresholds)

## Implementation Order

1. Add new event interfaces to `index.ts`
2. Add `mapEnforcementModeToBehavior()` to `secret-output-processor.ts`
3. Update `resolveSecretDetectionBehavior()` in orchestrator
4. Add `resolveEnforcementMode()` helper
5. Update tool result handling to emit mode-specific events
6. Add unit tests
7. Add integration tests
8. Run full test suite to verify no regressions
