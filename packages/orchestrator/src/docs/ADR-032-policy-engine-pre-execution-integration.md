# ADR-032: PolicyEngine Pre-Execution Integration into ApexOrchestrator

## Status
Proposed

## Date
2025-01-07

## Context

The APEX orchestrator currently has two policy-related components:

1. **PolicyEnforcer** (`./policy/policy-enforcer.ts`) - Validates file paths against `allowedPaths` configuration, checks approval rules, and emits policy violation events. Currently used for task-start validation only.

2. **PolicyEngine** (`./policy-engine.ts`) - A more comprehensive rule evaluation engine that implements the `IPolicyEngine` interface from `@apexcli/core`. It supports multiple rule types (path, tool, agent, approval) with severity levels and enforcement modes.

Currently, policy checks only occur at task start time (in `executeTask` method), but not during agent execution. This means tool operations during agent execution are not validated against policies in real-time.

The requirement is to integrate `PolicyEngine` into the pre-execution hook lifecycle so that **every tool use** is validated against policies before the Claude Agent SDK `query()` executes the tool.

## Decision

### 1. Constructor Options Extension

Extend `OrchestratorOptions` to accept an optional `PolicyEngine` instance for dependency injection:

```typescript
// packages/orchestrator/src/index.ts
export interface OrchestratorOptions {
  projectPath: string;
  apiUrl?: string;
  autonomyEnforcer?: AutonomyEnforcer;
  policyEngine?: PolicyEngine;  // NEW: Optional PolicyEngine injection
}
```

**Pattern Reference**: This follows the existing `autonomyEnforcer` injection pattern (lines 91-95, 763-770).

### 2. PolicyEngine Initialization

Add a private field and initialize PolicyEngine during `initialize()`:

```typescript
// New private field
private policyEngine!: PolicyEngine;

// In initialize() method, after config loading (around line 760)
this.policyEngine = options.policyEngine ?? createPolicyEngine(this.config);
```

**Initialization Order**: PolicyEngine should be initialized after config loading but before HookManager setup, as hooks will depend on it.

### 3. HookContext Extension

Extend `HookContext` interface to include PolicyEngine reference:

```typescript
// packages/orchestrator/src/hooks.ts
export interface HookContext {
  taskId: string;
  store: TaskStore;
  permissionPresetManager?: PermissionPresetManager;
  policyEngine?: PolicyEngine;  // NEW: PolicyEngine reference for pre-execution checks
  onToolUse?: (tool: string, input: unknown) => void;
  eventEmitter?: {
    emit: (event: string, data: unknown) => void;
  };
  // ... existing fields
}
```

### 4. Pre-Execution Hook Integration

Modify `createHooksWithManager()` to include policy checks before tool execution. The policy check should occur:

1. **After** autonomy enforcer check (line 6432)
2. **Before** HookManager pre-hooks execution (line 6454)

```typescript
// In createHooksWithManager(), PreToolUse hooks array
{
  hooks: [async (input: any, toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
    try {
      // 1. Autonomy check (existing)
      const requiresApproval = await this.autonomyEnforcer.checkAction(actionMetadata);
      if (requiresApproval) {
        return { /* deny */ };
      }

      // 2. NEW: Policy Engine check
      const policyContext: PolicyCheckContext = {
        action: input.tool_name || 'unknown',
        resource: this.extractResourceFromInput(input),
        agentId: agentName,
        taskId: hookContext.taskId,
        stage: stageName,
        toolName: input.tool_name,
        toolArguments: input.tool_input,
        filePaths: this.extractFilePathsFromInput(input),
      };

      const policyResult = await this.policyEngine.checkPolicy(policyContext);

      if (policyResult.status === 'deny') {
        // Emit policy blocked event
        this.emitPolicyBlocked(hookContext.taskId, agentName, input.tool_name, policyResult);

        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Policy violation: ${policyResult.violations.map(v => v.message).join('; ')}`,
          },
        };
      }

      // Emit warnings for non-blocking violations
      for (const violation of policyResult.violations) {
        if (!violation.blocking) {
          this.emitPolicyWarned(hookContext.taskId, agentName, input.tool_name, violation, policyResult.enforcementMode);
        }
      }

      // 3. HookManager pre-hooks (existing)
      // ...
    } catch (error) {
      // Log error and allow execution to continue
    }
  }],
  timeout: 30,
  priority: 1000,
}
```

### 5. Resource Extraction Helpers

Add helper methods to extract resources from tool inputs for policy context:

```typescript
private extractResourceFromInput(input: any): string | undefined {
  const toolInput = input.tool_input || {};
  // Common patterns for resource paths
  return toolInput.file_path
    || toolInput.path
    || toolInput.command
    || toolInput.url
    || undefined;
}

private extractFilePathsFromInput(input: any): string[] {
  const toolInput = input.tool_input || {};
  const paths: string[] = [];

  if (toolInput.file_path) paths.push(toolInput.file_path);
  if (toolInput.path) paths.push(toolInput.path);
  if (toolInput.directory) paths.push(toolInput.directory);
  if (toolInput.notebook_path) paths.push(toolInput.notebook_path);

  return paths;
}
```

### 6. Event Emission

Leverage existing event data types for policy violations:

```typescript
private emitPolicyBlocked(
  taskId: string,
  agentName: string,
  toolName: string,
  result: PolicyCheckResult
): void {
  const eventData: PolicyBlockedEventData = {
    taskId,
    agent: agentName,
    action: toolName,
    violations: result.violations,
    enforcementMode: result.enforcementMode,
    timestamp: new Date(),
  };
  this.emit('policy:blocked', eventData);
}

private emitPolicyWarned(
  taskId: string,
  agentName: string,
  toolName: string,
  violation: PolicyViolation,
  enforcementMode: PolicyEnforcementMode
): void {
  const eventData: PolicyWarnedEventData = {
    taskId,
    agent: agentName,
    action: toolName,
    violation,
    enforcementMode,
    timestamp: new Date(),
  };
  this.emit('policy:warned', eventData);
}
```

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ApexOrchestrator                               │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│  │ OrchestratorOpts│───▶│   initialize()   │───▶│  Private Fields  │    │
│  │ + policyEngine? │    │  (line ~760)     │    │  + policyEngine  │    │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    executeAgentStage()                            │  │
│  │                                                                   │  │
│  │   1. Build prompt                                                 │  │
│  │   2. Create HookContext (+ policyEngine ref)                     │  │
│  │   3. createHooksWithManager()                                     │  │
│  │      └─► PreToolUse Hook Pipeline                                │  │
│  │          ┌─────────────────────────────────────────────┐         │  │
│  │          │ (1) Autonomy Enforcer Check                 │         │  │
│  │          │ (2) PolicyEngine.checkPolicy() ◄── NEW      │         │  │
│  │          │ (3) HookManager Pre-hooks                   │         │  │
│  │          │ (4) Base hooks (danger detection, etc.)     │         │  │
│  │          └─────────────────────────────────────────────┘         │  │
│  │   4. Claude SDK query()                                          │  │
│  │                                                                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Events Emitted:                                                       │
│  ├── policy:blocked (PolicyBlockedEventData)                          │
│  ├── policy:warned (PolicyWarnedEventData)                            │
│  └── policy:audited (PolicyAuditedEventData)                          │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## Implementation Files

| File | Changes Required |
|------|-----------------|
| `packages/orchestrator/src/index.ts` | 1. Extend `OrchestratorOptions` with `policyEngine?` field<br>2. Add `private policyEngine!: PolicyEngine` field<br>3. Initialize in `initialize()` method<br>4. Pass to `HookContext` in `executeAgentStage()`<br>5. Integrate policy check in `createHooksWithManager()`<br>6. Add helper methods and event emission |
| `packages/orchestrator/src/hooks.ts` | Extend `HookContext` interface with `policyEngine?` field |

## Enforcement Modes Behavior

| Mode | Blocking Violations | Non-Blocking Violations |
|------|---------------------|-------------------------|
| `strict` | Deny + emit `policy:blocked` | Deny + emit `policy:blocked` |
| `warn` | Deny + emit `policy:blocked` | Allow + emit `policy:warned` |
| `audit` | Allow + emit `policy:audited` | Allow + emit `policy:audited` |
| `disabled` | Allow (no emit) | Allow (no emit) |

## Testing Strategy

1. **Unit Tests**:
   - PolicyEngine injection via constructor options
   - PolicyEngine default creation when not injected
   - HookContext includes policyEngine reference

2. **Integration Tests**:
   - Pre-execution policy checks block violating tool uses
   - Non-blocking violations emit warnings but allow execution
   - Event emission for all policy outcomes
   - Audit mode logs but doesn't block

3. **Edge Cases**:
   - PolicyEngine throws exception (should log and allow)
   - No policies configured (should allow all)
   - Multiple violations in single check

## Consequences

### Positive
- Real-time policy enforcement during agent execution
- Consistent pattern with AutonomyEnforcer integration
- Dependency injection enables testing with mock PolicyEngine
- Events provide observability into policy decisions

### Negative
- Additional async call per tool use (performance consideration)
- Increased complexity in hook pipeline

### Mitigations
- PolicyEngine evaluation is typically fast (<10ms)
- Timeout on pre-hooks prevents blocking (30s default)
- Disabled mode bypasses all checks

## Related ADRs
- ADR-018: Policy Enforcer Base Class
- ADR-029: Autonomy Enforcer Integration
- ADR-031: Policy Violation Event Types
