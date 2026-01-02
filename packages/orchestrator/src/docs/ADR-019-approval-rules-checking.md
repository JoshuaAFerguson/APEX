# ADR-019: Approval Rules Checking for Human-in-the-Loop

## Status

Proposed

## Date

2025-01-02

## Context

APEX needs a human-in-the-loop mechanism to ensure that certain operations require explicit human approval before proceeding. The existing `PolicyEnforcer` class (ADR-018) handles file path validation, but we need to extend it to evaluate `ApprovalPolicy` rules based on:

1. **File patterns** - Operations on certain file types or paths
2. **Task types** - Based on task workflow, priority, or effort
3. **Risk levels** - Operations with high-risk thresholds
4. **Content patterns** - Matching file content
5. **Cost/Token thresholds** - Budget-based approvals
6. **Custom expressions** - Flexible rule evaluation

### Existing Infrastructure

The types already exist in `@apex/core/types.ts`:

- `ApprovalRule` - Defines when approval is required with conditions, urgency, timeout settings
- `ApprovalCondition` - Individual condition (file-pattern, operation, cost-threshold, etc.)
- `ApprovalRulesConfig` - Configuration container for approval rules
- `ApprovalConditionType` - Enum of condition types
- `PolicyConfig.approvalRules` - Optional approval rules configuration

The `PolicyEnforcer` class exists with:
- `validateFilePath()` method for path validation
- Protected `matchesPattern()` helper for glob matching
- Protected `createViolation()` helper for violation generation

## Decision

Extend `PolicyEnforcer` with a new `checkApprovalRequired()` method that:

### Method Signature

```typescript
interface ApprovalCheckContext {
  /** File paths being accessed or modified */
  filePaths?: string[];
  /** Content of files (for content-pattern matching) */
  fileContents?: Map<string, string>;
  /** Current operation being performed */
  operation?: ApprovalOperationType;
  /** Estimated cost in USD */
  estimatedCost?: number;
  /** Token usage */
  tokenUsage?: number;
  /** Custom context variables for expression evaluation */
  customContext?: Record<string, unknown>;
}

interface ApprovalRequirement {
  /** Whether approval is required */
  required: boolean;
  /** Rules that triggered the requirement (sorted by priority) */
  triggeredRules: ApprovalRule[];
  /** Urgency level (highest among triggered rules) */
  urgency: ApprovalUrgency;
  /** Timeout in minutes (shortest among triggered rules for safety) */
  timeoutMinutes: number;
  /** Required approvers (union of all triggered rules) */
  requiredApprovers: string[];
  /** Minimum approvals needed (maximum among triggered rules) */
  minApprovals: number;
  /** Timeout action (most restrictive among triggered rules) */
  timeoutAction: 'reject' | 'approve' | 'escalate';
  /** Human-readable summary of why approval is needed */
  reason: string;
}

class PolicyEnforcer {
  // ... existing methods ...

  /**
   * Checks if human approval is required for a task/action combination.
   * Evaluates all enabled approval rules and returns consolidated requirements.
   */
  checkApprovalRequired(
    task: Task,
    action: string,
    context?: ApprovalCheckContext
  ): ApprovalRequirement;
}
```

### Rule Evaluation Logic

1. **Filter enabled rules**: Only evaluate rules where `enabled !== false`
2. **Sort by priority**: Higher priority rules are evaluated first
3. **Evaluate conditions**: For each rule, check if conditions match
   - `requireAllConditions: true` → ALL conditions must match (AND logic)
   - `requireAllConditions: false` (default) → ANY condition triggers (OR logic)
4. **Aggregate results**: Combine all triggered rules into a single requirement

### Condition Type Evaluation

| Condition Type | Evaluation Logic |
|---------------|------------------|
| `file-pattern` | Use `matchesPattern()` against `context.filePaths` |
| `content-pattern` | Regex match against `context.fileContents` |
| `operation` | Check if `action` or `context.operation` matches `condition.operations` |
| `cost-threshold` | Compare `context.estimatedCost` or `task.usage.estimatedCost` against threshold |
| `token-threshold` | Compare `context.tokenUsage` or `task.usage.totalTokens` against threshold |
| `custom` | Evaluate expression with interpolated variables |

### Task Type Integration

The method uses Task properties for additional context:

- `task.workflow` - Can be used in custom expressions
- `task.priority` - Can trigger high-priority approval rules
- `task.effort` - Large efforts may require approval
- `task.usage.estimatedCost` - Cost threshold evaluation
- `task.usage.totalTokens` - Token threshold evaluation

### Urgency Aggregation

When multiple rules trigger, the highest urgency wins:
```
critical > high > normal > low
```

### Timeout Calculation

For safety, use the **shortest** timeout among triggered rules to ensure prompt review.

### Timeout Action Priority

Most restrictive action wins:
```
reject > escalate > approve
```

## Architecture

```
packages/orchestrator/src/policy/
├── policy-enforcer.ts     # Extended with checkApprovalRequired()
├── policy-enforcer.test.ts # Extended with approval rule tests
└── index.ts               # Export new types
```

### New Exports

```typescript
// packages/orchestrator/src/policy/index.ts
export {
  PolicyEnforcer,
  createPolicyEnforcer,
  type ViolationOptions,
  type PathValidationResult,
  type ApprovalCheckContext,      // NEW
  type ApprovalRequirement,       // NEW
} from './policy-enforcer.js';
```

### Example Usage

```typescript
const enforcer = new PolicyEnforcer(policyConfig);

// Check if task action requires approval
const requirement = enforcer.checkApprovalRequired(
  task,
  'deploy',
  {
    filePaths: ['src/config/production.yaml', 'deploy/k8s/deployment.yaml'],
    operation: 'deploy',
    estimatedCost: 15.50,
  }
);

if (requirement.required) {
  console.log(`Approval required: ${requirement.reason}`);
  console.log(`Urgency: ${requirement.urgency}`);
  console.log(`Timeout: ${requirement.timeoutMinutes} minutes`);
  // Emit approval request event, pause task, notify approvers...
}
```

## Consequences

### Positive

- **Consistent API**: Extends existing PolicyEnforcer pattern
- **Full type safety**: Uses existing Zod-validated types from core
- **Flexible conditions**: Supports multiple condition types and custom expressions
- **Aggregated results**: Single consolidated requirement from multiple rules
- **Safe defaults**: Most restrictive values used when aggregating

### Negative

- **Complexity**: Custom expression evaluation adds complexity
- **Performance**: Content pattern matching could be slow for large files
- **Dependency on Task**: Method requires Task object, limiting standalone use

### Risks

- Expression injection in custom conditions (mitigated by sandboxed evaluation)
- Content pattern regex DoS (mitigated by timeout/complexity limits)

## Test Coverage Requirements

1. **Basic rule matching**
   - Single rule, single condition
   - Multiple rules, multiple conditions
   - AND vs OR condition logic

2. **Condition type tests**
   - File pattern matching (glob patterns)
   - Content pattern matching (regex)
   - Operation type matching
   - Cost threshold comparison
   - Token threshold comparison
   - Custom expression evaluation

3. **Task type integration**
   - High-priority task triggers
   - Large effort triggers
   - Workflow-specific rules

4. **Aggregation tests**
   - Urgency aggregation (highest wins)
   - Timeout aggregation (shortest wins)
   - Timeout action aggregation (most restrictive)
   - Approver aggregation (union)
   - Min approvals aggregation (maximum)

5. **Edge cases**
   - Empty rules configuration
   - Disabled rules
   - No matching conditions
   - All rules triggered

## References

- ADR-018: PolicyEnforcer Base Class
- `@apex/core/types.ts` - ApprovalRule, ApprovalCondition schemas
- PolicyConfig.approvalRules configuration
