# ADR-0001: checkTaskStart Method Design

## Status
Proposed

## Date
2026-01-02

## Context

The PolicyEnforcer class in `packages/orchestrator/src/policy/policy-enforcer.ts` currently provides:
- File path validation (`validateFilePath`)
- Approval requirement checking (`checkApprovalRequired`)

We need to add a `checkTaskStart(task)` method that evaluates policies before a task begins execution and returns policy check results with violations that have severity levels (error, warning, info).

## Decision

### Method Signature

```typescript
/**
 * Result of checking if a task can start.
 */
export interface TaskStartCheckResult {
  /** Whether the task is allowed to start */
  allowed: boolean;
  /** List of policy violations detected */
  violations: PolicyViolation[];
  /** Summary message for the check result */
  summary: string;
  /** Breakdown of violations by severity */
  violationsBySeverity: {
    error: PolicyViolation[];
    warning: PolicyViolation[];
    info: PolicyViolation[];
  };
}

/**
 * Checks if a task is allowed to start based on policy rules.
 *
 * Evaluates the following policies:
 * 1. Task priority and effort constraints
 * 2. Resource limits (cost, tokens, concurrent tasks)
 * 3. Required workflow configuration
 * 4. Path access restrictions (if task has project path)
 * 5. Approval requirements (if configured)
 *
 * @param task - The task to validate before starting
 * @param context - Optional context for policy evaluation
 * @returns TaskStartCheckResult with allowed status and violations
 */
checkTaskStart(
  task: Task,
  context?: {
    currentConcurrentTasks?: number;
    dailySpentBudget?: number;
    dailyTokenUsage?: number;
  }
): TaskStartCheckResult;
```

### Policy Checks to Implement

The `checkTaskStart` method will evaluate the following policies:

#### 1. **Enabled Policy Check**
- If policy is disabled, return `allowed: true` with no violations
- Severity: N/A (skip all checks)

#### 2. **Resource Limits Validation**
- **Concurrent tasks limit**: Check if adding this task exceeds `maxConcurrentTasks`
  - Severity: `error` (blocks task start)
- **Daily budget limit**: Check if daily budget has been exceeded
  - Severity: `error` (blocks task start)
- **Token usage limit**: Check if daily token limit has been exceeded
  - Severity: `warning` (warns but allows start)

#### 3. **Workflow Validation**
- Verify task has a valid workflow assigned
  - Severity: `error` if missing workflow in strict mode

#### 4. **Path Access Validation**
- Validate `task.projectPath` against `allowedPaths` configuration
  - Severity: Based on enforcement mode (`strict` = error, `warn` = warning, `audit` = info)

#### 5. **Approval Pre-flight Check**
- Check if the task will require approval at start
- Use existing `checkApprovalRequired(task, 'start', context)` method
  - Severity: `warning` if approval will be required (informational)

### Severity Mapping

| Enforcement Mode | Violation Severity |
|-----------------|-------------------|
| `strict`        | `error`           |
| `warn`          | `warning`         |
| `audit`         | `info`            |
| `disabled`      | N/A (no checks)   |

### Return Value Logic

```typescript
const result: TaskStartCheckResult = {
  allowed: errorViolations.length === 0, // Only errors block
  violations: [...errorViolations, ...warningViolations, ...infoViolations],
  summary: buildSummary(violations),
  violationsBySeverity: {
    error: errorViolations,
    warning: warningViolations,
    info: infoViolations,
  },
};
```

### Integration with Existing Code

The method will:
1. Reuse `validateFilePath()` for path validation
2. Reuse `checkApprovalRequired()` for approval checks
3. Use the existing `createViolation()` protected method
4. Emit `policy:violation` events for each violation detected
5. Follow the existing severity mapping from `getSeverityFromEnforcement()`

### New Interface Export

Add `TaskStartCheckResult` to the module exports in `packages/orchestrator/src/policy/index.ts`.

## Consequences

### Positive
- Provides a unified API for pre-task-start policy validation
- Reuses existing validation logic (DRY principle)
- Severity levels allow nuanced handling (block on errors, warn on warnings)
- Event emission maintains consistency with existing pattern
- Clear separation between blocking violations (error) and non-blocking (warning/info)

### Negative
- Adds complexity to PolicyEnforcer class
- Requires context parameter for accurate concurrent task checking
- May need orchestrator integration to provide runtime context

### Neutral
- Method can be extended in future to add more policy checks
- Interface design allows for future expansion of check types

## Implementation Notes

1. **File to modify**: `packages/orchestrator/src/policy/policy-enforcer.ts`
2. **Test file to update**: `packages/orchestrator/src/policy/policy-enforcer.test.ts`
3. **Export to update**: `packages/orchestrator/src/policy/index.ts`
4. **No core type changes needed** - uses existing `PolicyViolation` type

### Key Implementation Details

- The method should be synchronous (no async operations needed)
- Violations should include descriptive `ruleId` values like `task-start-concurrent-limit`
- The `resource` field in violations should reference the task ID
- Context fields about violations should include relevant threshold values
