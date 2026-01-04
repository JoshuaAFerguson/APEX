# ADR-070: Configurable Secret Detection Behavior Modes

## Status
Accepted

## Date
2025-01-04

## Context

The APEX platform has an existing `SecretScanner` class for detecting secrets in tool outputs, and a `SecretDetectionBehavior` type with values: `'log' | 'warn' | 'mask' | 'block'`. Currently, the implementation:

1. Scans tool outputs for secrets when configured
2. Emits a `secret:detected` event with findings and the configured behavior
3. Logs the detection to the task store
4. BUT: Does not actually implement the different behaviors

The acceptance criteria requires:
- **warn**: Event emitted, output passes through unchanged
- **block**: Event emitted, tool output is blocked/error returned
- **redact** (maps to 'mask'): Secrets are replaced with [REDACTED] in output
- All behaviors tested

## Decision

### 1. Rename 'mask' to Align with Terminology

The existing schema uses `'mask'` but the acceptance criteria mentions `'redact'`. For clarity:
- Keep the schema value as `'mask'` (backward compatible)
- The behavior will replace secrets with `[REDACTED]` text (not partial masking)
- Document that 'mask' = 'redact' = replace with `[REDACTED]`

### 2. Behavior Definitions

| Behavior | Event Emitted | Output Modification | Tool Result |
|----------|---------------|---------------------|-------------|
| `log`    | Yes           | None                | Original output passed through |
| `warn`   | Yes           | None                | Original output passed through |
| `block`  | Yes           | N/A                 | Tool result replaced with error |
| `mask`   | Yes           | Secrets → [REDACTED]| Modified output with redacted secrets |

#### Behavioral Differences Between `log` and `warn`:
- `log`: Detection logged at 'info' level (for debugging/auditing)
- `warn`: Detection logged at 'warn' level (for active monitoring)

### 3. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Tool Output Processing                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐                                                │
│  │ Tool Result     │                                                │
│  │ (raw output)    │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐     No                                         │
│  │ Scanner         ├──────────► Continue to tool:complete           │
│  │ Configured?     │                                                │
│  └────────┬────────┘                                                │
│           │ Yes                                                      │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Scan Output     │                                                │
│  │ for Secrets     │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐     No                                         │
│  │ Secrets Found?  ├──────────► Continue to tool:complete           │
│  └────────┬────────┘                                                │
│           │ Yes                                                      │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Emit Event      │◄─────────── Always emit secret:detected        │
│  │ secret:detected │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Apply Behavior                                      │   │
│  │  ┌─────────┬─────────┬─────────────┬────────────────────┐   │   │
│  │  │  log    │  warn   │    mask     │      block         │   │   │
│  │  ├─────────┼─────────┼─────────────┼────────────────────┤   │   │
│  │  │Log:info │Log:warn │Log:warn     │Log:error           │   │   │
│  │  │Pass thru│Pass thru│Redact output│Return error result │   │   │
│  │  └─────────┴─────────┴─────────────┴────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────┘ │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ Emit            │                                                │
│  │ tool:complete   │                                                │
│  └─────────────────┘                                                │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### 4. Implementation Approach

#### 4.1 SecretOutputProcessor Class

Create a new utility class `SecretOutputProcessor` that encapsulates behavior logic:

```typescript
// packages/orchestrator/src/secret-output-processor.ts

export interface SecretProcessingResult {
  /** The processed output (modified for 'mask', error for 'block', original for 'log'/'warn') */
  output: string | Record<string, unknown>;
  /** Whether the output was modified */
  wasModified: boolean;
  /** Whether the tool should be marked as failed */
  shouldBlock: boolean;
  /** Error message if blocked */
  blockError?: string;
  /** Log level to use */
  logLevel: 'info' | 'warn' | 'error';
}

export class SecretOutputProcessor {
  /**
   * Process tool output based on secret detection behavior
   */
  processOutput(
    output: string | Record<string, unknown>,
    findings: SecretFinding[],
    behavior: SecretDetectionBehavior
  ): SecretProcessingResult;

  /**
   * Redact secrets in content by replacing with [REDACTED]
   */
  private redactSecrets(
    content: string,
    findings: SecretFinding[]
  ): string;
}
```

#### 4.2 Behavior Implementation Details

**log behavior:**
```typescript
return {
  output: originalOutput,
  wasModified: false,
  shouldBlock: false,
  logLevel: 'info',
};
```

**warn behavior:**
```typescript
return {
  output: originalOutput,
  wasModified: false,
  shouldBlock: false,
  logLevel: 'warn',
};
```

**mask behavior:**
```typescript
const redactedOutput = this.redactSecrets(stringOutput, findings);
return {
  output: redactedOutput,
  wasModified: true,
  shouldBlock: false,
  logLevel: 'warn',
};
```

**block behavior:**
```typescript
return {
  output: originalOutput, // Not used
  wasModified: false,
  shouldBlock: true,
  blockError: `Tool output blocked: ${findings.length} secret(s) detected`,
  logLevel: 'error',
};
```

#### 4.3 Redaction Strategy

For the `mask` behavior, secrets will be redacted by:
1. Sorting findings by position (descending) to avoid offset issues
2. Replacing each match with `[REDACTED]`
3. Handling both string and JSON outputs

```typescript
private redactSecrets(content: string, findings: SecretFinding[]): string {
  // Sort by line and column (descending) to replace from end to start
  const sortedFindings = [...findings].sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });

  const lines = content.split('\n');

  for (const finding of sortedFindings) {
    const lineIdx = finding.line - 1; // Convert to 0-based
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const line = lines[lineIdx];
      const startCol = finding.column - 1; // Convert to 0-based
      const endCol = finding.endColumn - 1;

      lines[lineIdx] =
        line.substring(0, startCol) +
        '[REDACTED]' +
        line.substring(endCol);
    }
  }

  return lines.join('\n');
}
```

### 5. Integration with ApexOrchestrator

Modify the tool output processing in `executeStage` (around line 2354):

```typescript
// After scanning for secrets
if (findings.length > 0) {
  // Emit event (always)
  this.emit('secret:detected', { ... });

  // Process based on behavior
  const processor = new SecretOutputProcessor();
  const result = processor.processOutput(
    block.content,
    findings,
    this.config.scanner?.onSecretDetected ?? 'warn'
  );

  // Log with appropriate level
  await this.store.addLog(task.id, {
    level: result.logLevel,
    message: `Secrets detected in tool output: ${toolExecution.toolName}`,
    metadata: { ... },
  });

  // Handle blocking
  if (result.shouldBlock) {
    success = false;
    block.content = result.blockError;
    block.is_error = true;
  } else if (result.wasModified) {
    // Use redacted output for mask behavior
    block.content = result.output;
  }
  // For log/warn, output passes through unchanged
}
```

### 6. Test Coverage Requirements

Create comprehensive tests for all behaviors:

```typescript
// packages/orchestrator/src/__tests__/secret-output-processor.test.ts

describe('SecretOutputProcessor', () => {
  describe('log behavior', () => {
    it('should emit event and pass output unchanged');
    it('should set logLevel to info');
    it('should not modify output');
  });

  describe('warn behavior', () => {
    it('should emit event and pass output unchanged');
    it('should set logLevel to warn');
    it('should not modify output');
  });

  describe('mask behavior', () => {
    it('should emit event and redact secrets');
    it('should replace secrets with [REDACTED]');
    it('should handle multiple secrets');
    it('should handle secrets on same line');
    it('should handle JSON output');
    it('should set wasModified to true');
  });

  describe('block behavior', () => {
    it('should emit event and return error');
    it('should set shouldBlock to true');
    it('should provide appropriate error message');
    it('should set logLevel to error');
  });
});

// Integration tests
describe('Secret Detection Behavior Integration', () => {
  it('should pass through output unchanged for warn behavior');
  it('should block output and return error for block behavior');
  it('should redact secrets for mask behavior');
  it('should use info level for log behavior');
});
```

### 7. File Changes Required

| File | Changes |
|------|---------|
| `packages/orchestrator/src/secret-output-processor.ts` | **NEW**: SecretOutputProcessor class |
| `packages/orchestrator/src/index.ts` | Import and use SecretOutputProcessor |
| `packages/orchestrator/src/__tests__/secret-output-processor.test.ts` | **NEW**: Unit tests |
| `packages/orchestrator/src/__tests__/secret-detection-behavior.integration.test.ts` | **NEW**: Integration tests |

### 8. Backward Compatibility

- Schema values remain unchanged (`'log' | 'warn' | 'mask' | 'block'`)
- Default behavior remains `'warn'`
- Existing `secret:detected` event structure unchanged
- Event is always emitted regardless of behavior (allows external monitoring)

## Consequences

### Positive
- Clear separation of concerns with dedicated processor class
- Testable behavior logic in isolation
- All four behaviors implemented consistently
- Event always emitted for external monitoring/alerting
- Flexible configuration per security requirements

### Negative
- Slight additional complexity in tool output flow
- For 'block' behavior, tool execution appears to fail (intentional)
- Redaction may lose context in output (necessary trade-off)

### Risks
- Redaction might not catch all instances if patterns overlap
- Block behavior changes tool execution flow (may affect agent reasoning)
- Performance impact for large outputs with many findings

## Implementation Order

1. Create `SecretOutputProcessor` class with all behavior logic
2. Add comprehensive unit tests for the processor
3. Integrate processor into `ApexOrchestrator.executeStage`
4. Add integration tests for end-to-end behavior verification
5. Run full test suite to ensure no regressions
6. Update documentation if needed

## References

- ADR-010: Secret Detection in Tool Outputs
- `packages/orchestrator/src/scanner.ts`: SecretScanner implementation
- `packages/core/src/types.ts`: SecretDetectionBehavior schema
- Existing tests: `packages/orchestrator/src/__tests__/secret-detection.*.test.ts`
