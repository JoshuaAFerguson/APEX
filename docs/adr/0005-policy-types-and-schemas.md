# ADR-0005: Policy Types and Zod Schemas

## Status

**Proposed**

## Context

APEX needs comprehensive policy-as-code types to support:
1. **Path-based policies** - Control which files agents can access using glob patterns
2. **Test requirement policies** - Enforce test coverage and testing requirements
3. **Approval policies** - Require human approval for sensitive operations
4. **Policy violations** - Track and report policy enforcement results

The existing codebase already has foundational types:
- `PolicyEnforcementMode` - Enforcement levels (strict, warn, audit, disabled)
- `PolicyConfig` - Top-level policy configuration
- `AllowedPathsConfig` - Path access configuration with glob patterns
- `RequiredTestsConfig` - Test requirement configuration
- `ApprovalRulesConfig` - Approval workflow configuration
- `PolicyValidationResult` / `PolicyEvaluationResult` - Result interfaces (non-Zod)

### Gap Analysis

The acceptance criteria require these **new types** that don't exist yet:

| Required Type | Description | Status |
|--------------|-------------|--------|
| `Policy` | Top-level policy wrapper with metadata | NEW |
| `PolicyRule` | Generic rule interface for all policy types | NEW |
| `PathPolicy` | Specialized path-based policy rules | NEW |
| `TestPolicy` | Specialized test requirement policy rules | NEW |
| `ApprovalPolicy` | Specialized approval policy rules | NEW |
| `PolicyViolation` | Individual policy violation record | NEW |
| `PolicyViolationEvent` | Event emitted when violation occurs | NEW |

## Decision

### 1. Type Architecture

We will introduce a **unified policy type hierarchy** that builds on existing types:

```
Policy (NEW - top-level container)
├── PolicyRule (NEW - base rule interface)
│   ├── PathPolicy (NEW - wraps AllowedPathsConfig)
│   ├── TestPolicy (NEW - wraps RequiredTestsConfig)
│   └── ApprovalPolicy (NEW - wraps ApprovalRulesConfig)
├── PolicyViolation (NEW - violation record)
└── PolicyViolationEvent (NEW - event for violations)
```

### 2. Schema Design

#### 2.1 PolicyRule Base Schema

```typescript
export const PolicyRuleSchema = z.object({
  /** Unique identifier for this rule */
  id: z.string().min(1),

  /** Human-readable name */
  name: z.string().min(1),

  /** Description of what this rule enforces */
  description: z.string().optional(),

  /** Rule type discriminator */
  type: z.enum(['path', 'test', 'approval']),

  /** Enforcement mode for this specific rule */
  enforcement: PolicyEnforcementModeSchema.optional(),

  /** Whether this rule is enabled */
  enabled: z.boolean().optional().default(true),

  /** Priority (higher = evaluated first) */
  priority: z.number().int().min(0).optional().default(0),

  /** Tags for categorization */
  tags: z.array(z.string()).optional().default([]),
});
```

#### 2.2 PathPolicy Schema

```typescript
export const PathPolicySchema = PolicyRuleSchema.extend({
  type: z.literal('path'),

  /** Path access configuration */
  config: AllowedPathsConfigSchema,

  /** Glob patterns that are allowed (convenience shorthand) */
  allowedPatterns: z.array(z.string()).optional(),

  /** Glob patterns that are blocked (convenience shorthand) */
  blockedPatterns: z.array(z.string()).optional(),
});
```

#### 2.3 TestPolicy Schema

```typescript
export const TestPolicySchema = PolicyRuleSchema.extend({
  type: z.literal('test'),

  /** Test requirements configuration */
  config: RequiredTestsConfigSchema,

  /** Minimum coverage threshold (convenience shorthand) */
  minCoverage: z.number().min(0).max(100).optional(),

  /** Test command override */
  testCommand: z.string().optional(),
});
```

#### 2.4 ApprovalPolicy Schema

```typescript
export const ApprovalPolicySchema = PolicyRuleSchema.extend({
  type: z.literal('approval'),

  /** Approval rules configuration */
  config: ApprovalRulesConfigSchema,

  /** Required approvers (convenience shorthand) */
  requiredApprovers: z.array(z.string()).optional(),

  /** Minimum approvals needed */
  minApprovals: z.number().int().min(1).optional().default(1),
});
```

#### 2.5 PolicyViolation Schema

```typescript
export const PolicyViolationSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export const PolicyViolationSchema = z.object({
  /** Unique violation ID */
  id: z.string().min(1),

  /** ID of the rule that was violated */
  ruleId: z.string().min(1),

  /** Name of the violated rule */
  ruleName: z.string().min(1),

  /** Type of policy violated */
  policyType: z.enum(['path', 'test', 'approval']),

  /** Severity of the violation */
  severity: PolicyViolationSeveritySchema,

  /** Human-readable violation message */
  message: z.string().min(1),

  /** Detailed context about the violation */
  details: z.object({
    /** File paths involved (for path violations) */
    paths: z.array(z.string()).optional(),
    /** Patterns that matched */
    matchedPatterns: z.array(z.string()).optional(),
    /** Operation that was attempted */
    operation: z.string().optional(),
    /** Agent that triggered the violation */
    agentId: z.string().optional(),
    /** Task context */
    taskId: z.string().optional(),
    /** Additional context */
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).optional(),

  /** Timestamp when violation was detected */
  timestamp: z.date(),

  /** Whether this violation blocked the operation */
  blocked: z.boolean(),

  /** Resolution status */
  resolution: z.object({
    resolved: z.boolean(),
    resolvedAt: z.date().optional(),
    resolvedBy: z.string().optional(),
    resolution: z.enum(['approved', 'dismissed', 'fixed', 'ignored']).optional(),
    notes: z.string().optional(),
  }).optional(),
});
```

#### 2.6 PolicyViolationEvent Schema

```typescript
export const PolicyViolationEventSchema = z.object({
  /** Event type identifier */
  type: z.literal('policy_violation'),

  /** The violation that occurred */
  violation: PolicyViolationSchema,

  /** Timestamp of the event */
  timestamp: z.date(),

  /** Source context */
  source: z.object({
    /** Agent that triggered the violation */
    agentId: z.string().optional(),
    /** Task being executed */
    taskId: z.string().optional(),
    /** Tool that was invoked */
    toolName: z.string().optional(),
    /** Stage in the workflow */
    stage: z.string().optional(),
  }),

  /** Action taken in response */
  action: z.enum(['blocked', 'warned', 'logged', 'approval_requested']),

  /** Whether the operation was allowed to proceed */
  operationAllowed: z.boolean(),
});
```

#### 2.7 Policy (Top-Level Container) Schema

```typescript
export const PolicySchema = z.object({
  /** Policy schema version */
  version: z.string().optional().default('1.0'),

  /** Policy identifier */
  id: z.string().min(1),

  /** Human-readable name */
  name: z.string().min(1),

  /** Description */
  description: z.string().optional(),

  /** Global enforcement mode */
  enforcement: PolicyEnforcementModeSchema.optional().default('warn'),

  /** Whether this policy is enabled */
  enabled: z.boolean().optional().default(true),

  /** Path-based policies */
  pathPolicies: z.array(PathPolicySchema).optional().default([]),

  /** Test requirement policies */
  testPolicies: z.array(TestPolicySchema).optional().default([]),

  /** Approval policies */
  approvalPolicies: z.array(ApprovalPolicySchema).optional().default([]),

  /** Tags for categorization */
  tags: z.array(z.string()).optional().default([]),

  /** Custom metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /** Creation timestamp */
  createdAt: z.date().optional(),

  /** Last modified timestamp */
  updatedAt: z.date().optional(),
});
```

### 3. Type Exports

All new types will be exported from `@apex/core`:
- `Policy`, `PolicySchema`
- `PolicyRule`, `PolicyRuleSchema`
- `PathPolicy`, `PathPolicySchema`
- `TestPolicy`, `TestPolicySchema`
- `ApprovalPolicy`, `ApprovalPolicySchema`
- `PolicyViolation`, `PolicyViolationSchema`
- `PolicyViolationSeverity`, `PolicyViolationSeveritySchema`
- `PolicyViolationEvent`, `PolicyViolationEventSchema`

### 4. Integration with Existing Types

The new types **extend and compose** existing types rather than replacing them:

- `PathPolicy.config` uses existing `AllowedPathsConfigSchema`
- `TestPolicy.config` uses existing `RequiredTestsConfigSchema`
- `ApprovalPolicy.config` uses existing `ApprovalRulesConfigSchema`
- `PolicyRule.enforcement` uses existing `PolicyEnforcementModeSchema`

This ensures backward compatibility with existing configuration files.

### 5. Location in Codebase

All new schemas will be added to `packages/core/src/types.ts` in a new section:

```
// ============================================================================
// Policy Types (v0.5.0)
// ============================================================================
```

Located after the existing `PolicyEvaluationResult` interface (line ~3398).

## Consequences

### Positive

1. **Type Safety**: All policy types have Zod validation for runtime safety
2. **Composability**: New types compose existing configuration types
3. **Extensibility**: `PolicyRule` base allows easy addition of new policy types
4. **Event-Driven**: `PolicyViolationEvent` supports event-based architectures
5. **Audit Trail**: `PolicyViolation.resolution` tracks violation lifecycle

### Negative

1. **Complexity**: More types to maintain
2. **Migration**: May require updates to existing policy consumers

### Neutral

1. **File Size**: Increases `types.ts` by ~150 lines
2. **Testing**: Will need comprehensive Zod schema tests

## Implementation Notes

1. Add schemas to `types.ts` in the designated section
2. Ensure all new types are exported from `@apex/core`
3. Add corresponding tests for schema validation
4. Verify build and tests pass after implementation
