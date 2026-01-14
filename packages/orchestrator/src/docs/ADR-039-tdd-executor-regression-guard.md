# ADR-039: TDDExecutor Regression Guard

## Status

Implemented

## Date

2025-01-11

## Context

The TDDExecutor implements an iterative test-fix loop where Claude attempts to fix failing tests. A critical concern is that a fix for one failing test might break previously passing tests (regression). Without protection against regressions, the TDD loop could:

1. Fix one test while breaking others
2. Enter a cycle of fixing and breaking different tests
3. Leave the codebase in a worse state than before

### Requirements

The regression guard must:
1. **Capture Baseline**: Before each TDD iteration begins, run the full test suite to establish a baseline of passing/failing tests
2. **Detect Regression**: After each fix attempt, verify that no regression occurred (existing tests still pass)
3. **Automatic Reversion**: If regression is detected, revert the fix and try an alternative approach
4. **Event Emission**: Emit events for regression detection and fix reversion for observability

## Decision

Implement the regression guard as an integral part of the TDDExecutor class with the following architecture:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             TDDExecutor                                          │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        Execution Flow                                      │  │
│  │                                                                            │  │
│  │  1. Capture Baseline ────────────────────────────────────────────────┐    │  │
│  │     │                                                                │    │  │
│  │     │  regressionGuard: true                                         │    │  │
│  │     │  └── runTests() → baselineTestResult                           │    │  │
│  │     │                                                                │    │  │
│  │  2. TDD Iteration Loop ────────────────────────────────────────────┐│    │  │
│  │     │                                                              ││    │  │
│  │     │  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  ││    │  │
│  │     │  │ runTests()  │ → │ generateFix()│ → │ applyFix()       │  ││    │  │
│  │     │  │             │   │ (via Claude) │   │ (with backup)    │  ││    │  │
│  │     │  └─────────────┘   └──────────────┘   └────────┬─────────┘  ││    │  │
│  │     │                                                │            ││    │  │
│  │     │                                                ↓            ││    │  │
│  │     │  3. Regression Check ──────────────────────────────────────┐││    │  │
│  │     │     │                                                      │││    │  │
│  │     │     │  detectRegression()                                  │││    │  │
│  │     │     │  ├── runTests() → currentTestResult                  │││    │  │
│  │     │     │  ├── Compare with baselineTestResult                 │││    │  │
│  │     │     │  └── Check for new failures                          │││    │  │
│  │     │     │                                                      │││    │  │
│  │     │     │  If regression detected:                             │││    │  │
│  │     │     │  ├── emit('tdd:regression-detected')                 │││    │  │
│  │     │     │  ├── revertFix() from backup                         │││    │  │
│  │     │     │  ├── emit('tdd:fix-reverted')                        │││    │  │
│  │     │     │  └── Mark iteration as failed                        │││    │  │
│  │     │     └──────────────────────────────────────────────────────┘││    │  │
│  │     └──────────────────────────────────────────────────────────────┘│    │  │
│  │                                                                      │    │  │
│  │  4. Continue or Stop ────────────────────────────────────────────────┘    │  │
│  │     │                                                                      │  │
│  │     ├── Success: Tests pass → Return success                              │  │
│  │     ├── Max iterations reached → Return failure                           │  │
│  │     └── Fix failed/reverted → Try alternative in next iteration           │  │
│  │                                                                            │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Configuration

```typescript
export interface TDDExecutorConfig {
  /** Maximum number of fix iterations before giving up */
  maxIterations: number;
  /** Test command to execute (e.g., 'npm test', 'vitest run') */
  testCommand: string;
  /** Working directory for test execution */
  workingDirectory?: string;
  /** Timeout for each test run in milliseconds */
  testTimeout?: number;
  /** Whether to emit detailed events */
  enableEvents?: boolean;
  /** Whether to enable regression guard (default: true) */
  regressionGuard?: boolean;  // NEW
}
```

#### 2. Result Types

```typescript
export interface RegressionResult {
  /** Whether regression was detected */
  detected: boolean;
  /** Test result that detected the regression */
  testResult?: TestResult;
  /** Error message if regression check failed */
  error?: string;
  /** Whether the regression check was skipped */
  skipped?: boolean;
}

export interface FixBackup {
  /** Modified files with their original content */
  files: Record<string, string>;
  /** Timestamp when backup was created */
  timestamp: Date;
}

export interface TDDIterationResult {
  // ... existing fields ...
  /** Result of regression detection (if enabled) */
  regressionResult?: RegressionResult;
  /** Whether the fix was reverted due to regression */
  fixReverted?: boolean;
}
```

#### 3. Events

```typescript
export interface TDDEvents {
  // ... existing events ...
  'tdd:regression-detected': (regressionResult: RegressionResult, iteration: number, taskId: string) => void;
  'tdd:fix-reverted': (fixResult: FixResult, iteration: number, taskId: string) => void;
}
```

### Regression Detection Algorithm

The `detectRegression()` method compares current test results against the baseline:

```typescript
private async detectRegression(): Promise<RegressionResult> {
  if (!this.baselineTestResult) {
    return { detected: false, skipped: true, error: 'No baseline available' };
  }

  const currentTestResult = await this.runTests();

  const regressionDetected =
    // If baseline tests passed but current tests fail
    (this.baselineTestResult.success && !currentTestResult.success) ||
    // If current tests have more failures than baseline
    (currentTestResult.failures.length > this.baselineTestResult.failures.length) ||
    // If current tests have different failures than baseline
    this.hasNewFailures(this.baselineTestResult.failures, currentTestResult.failures);

  return {
    detected: regressionDetected,
    testResult: currentTestResult,
    error: regressionDetected ? 'Regression detected: existing tests are now failing' : undefined,
  };
}

private hasNewFailures(baselineFailures: TestFailure[], currentFailures: TestFailure[]): boolean {
  const baselineSignatures = new Set(
    baselineFailures.map(f => `${f.file}:${f.test}:${f.message}`)
  );

  return currentFailures.some(failure => {
    const signature = `${failure.file}:${failure.test}:${failure.message}`;
    return !baselineSignatures.has(signature);
  });
}
```

### Fix Backup and Reversion

When a fix is applied, a backup is created:

```typescript
private async applyFix(fix: SuggestedFix): Promise<FixResult> {
  // Read current file content
  const fileContent = await fs.readFile(filePath, 'utf-8');

  // Create backup for potential reversion
  const backup: FixBackup = {
    files: { [fix.file]: fileContent },
    timestamp: new Date(),
  };

  // Apply fix
  const newContent = fileContent.replace(fix.originalContent, fix.newContent);
  await fs.writeFile(filePath, newContent, 'utf-8');

  return { success: true, modifiedFiles: [fix.file], backup };
}

private async revertFix(fixResult: FixResult): Promise<FixResult> {
  if (!fixResult.backup) {
    return { success: false, error: 'No backup available', modifiedFiles: [] };
  }

  for (const [file, originalContent] of Object.entries(fixResult.backup.files)) {
    await fs.writeFile(filePath, originalContent, 'utf-8');
  }

  return { success: true, modifiedFiles: Object.keys(fixResult.backup.files) };
}
```

### Test Coverage

The regression guard is thoroughly tested in `tdd-executor-regression-guard.test.ts`:

1. **Baseline Test Result Capture**
   - Captures baseline before TDD iterations when enabled
   - Handles baseline test failures gracefully
   - Skips baseline capture when regression guard is disabled

2. **Regression Detection**
   - Detects regression when previously passing tests now fail
   - Detects regression when more failures appear than in baseline
   - Detects regression when test success changes to failure
   - Does NOT detect regression when only expected failures remain
   - Handles regression detection test failures

3. **Fix Reversion**
   - Reverts fix when regression is detected
   - Handles revert failure gracefully
   - Handles missing backup during revert

4. **Event Emission**
   - Emits regression detection and fix reversion events
   - Does not emit regression events when guard is disabled

5. **Edge Cases**
   - Handles identical test failure signatures correctly
   - Handles complex test failure output with multiple files
   - Handles empty or missing baseline test results

6. **Integration with TDD Workflow**
   - Continues TDD iterations after successful regression check
   - Stops TDD execution when fix reversion fails

## Consequences

### Positive

- **Prevents Regression**: Ensures fixes don't break existing functionality
- **Automatic Recovery**: Reverts problematic fixes automatically
- **Observable**: Events enable real-time monitoring of regression detection
- **Configurable**: Can be disabled when not needed (`regressionGuard: false`)
- **Non-Invasive**: Works with existing TDD workflow without breaking changes

### Negative

- **Additional Test Runs**: Each iteration requires extra test runs for regression checking
- **Time Overhead**: Increased execution time for full test suite runs
- **False Positives**: May detect "regression" for flaky tests

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Performance impact from extra test runs | Baseline is captured once; regression check uses same test command |
| Flaky tests causing false regression detection | Future: Add flaky test detection/filtering |
| Backup storage for large files | Backup is per-iteration, cleaned up after completion |
| Complex multi-file fixes | Backup supports multiple files |

## File Structure

```
packages/orchestrator/src/
├── tdd-executor.ts                      # Main implementation
├── tdd-executor.test.ts                 # General unit tests
├── tdd-executor-regression-guard.test.ts # Regression guard specific tests
├── tdd-executor-integration.test.ts     # Integration tests
├── tdd-executor-edge-cases.test.ts      # Edge case tests
├── tdd-executor-e2e.test.ts             # End-to-end tests
└── docs/
    ├── ADR-034-tdd-executor-iterative-fix-loop.md  # Original TDD executor ADR
    └── ADR-039-tdd-executor-regression-guard.md    # This document
```

## Acceptance Criteria Verification

| Criteria | Implementation | Status |
|----------|----------------|--------|
| Before each TDD iteration, run full test suite to capture baseline | `execute()` calls `runTests()` at start when `regressionGuard: true` | ✅ |
| After each fix attempt, verify no regression | `detectRegression()` called after `applyFix()` | ✅ |
| If regression detected, revert fix | `revertFix()` called when `regressionDetected` is true | ✅ |
| Try alternative approach after regression | Next iteration generates new fix via Claude | ✅ |
| Unit tests verify regression detection | `tdd-executor-regression-guard.test.ts` with comprehensive coverage | ✅ |

## References

- ADR-034: TDDExecutor Iterative Fix Loop (original TDD executor design)
- `packages/orchestrator/src/tdd-executor.ts` - Implementation
- `packages/orchestrator/src/tdd-executor-regression-guard.test.ts` - Tests
