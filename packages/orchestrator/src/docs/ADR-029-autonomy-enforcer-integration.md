# ADR-029: AutonomyEnforcer Integration in ApexOrchestrator

## Status
Proposed

## Context

The APEX orchestrator needs to enforce autonomy policies including:
- Resource limits (tokens, cost, time, files)
- Approval gates at various stages
- Autonomy level controls (full-auto, review-before-commit, review-all)

Currently, there is an `AutonomyController` class in `autonomy-controller.ts` that provides:
- Resource limit checking and enforcement
- Approval gate management based on autonomy level
- Usage tracking for tasks
- Warning threshold monitoring

However, this controller is **not currently integrated** into the `ApexOrchestrator`. The orchestrator needs to:
1. Accept an `AutonomyEnforcer` instance via constructor options, OR
2. Initialize one from the loaded configuration during `initialize()`
3. Make the enforcer accessible during task execution for policy checks

## Decision

### 1. Rename AutonomyController to AutonomyEnforcer

For naming consistency with `PolicyEnforcer`, rename the class from `AutonomyController` to `AutonomyEnforcer`. This follows the existing pattern where enforcement components are named with the `-Enforcer` suffix:
- `PolicyEnforcer` - enforces policy rules
- `AutonomyEnforcer` - enforces autonomy rules

### 2. Update Constructor Options

Extend `OrchestratorOptions` to accept an optional `AutonomyEnforcer` instance:

```typescript
export interface OrchestratorOptions {
  projectPath: string;
  apiUrl?: string;
  autonomyEnforcer?: AutonomyEnforcer;  // Optional injection
}
```

### 3. Initialize AutonomyEnforcer in initialize()

During the `initialize()` method, the orchestrator will:
1. Check if an `AutonomyEnforcer` was injected via constructor
2. If not, create one from the loaded configuration
3. Wire up event handlers for limit warnings/exceeded events
4. Make the enforcer accessible via a getter

```typescript
async initialize(): Promise<void> {
  // ... existing initialization code ...

  // Initialize autonomy enforcer
  if (!this.autonomyEnforcer) {
    this.autonomyEnforcer = new AutonomyEnforcer(
      this.buildAutonomyEnforcerConfig(),
      this
    );
  }
  this.setupAutonomyEnforcerEvents();

  // ... rest of initialization ...
}

private buildAutonomyEnforcerConfig(): AutonomyEnforcerConfig {
  return {
    level: this.effectiveConfig.autonomy.level,
    gates: this.effectiveConfig.autonomy.gates,
    limits: {
      maxTokensPerTask: this.effectiveConfig.limits.maxTokensPerTask,
      maxCostPerTask: this.effectiveConfig.limits.maxCostPerTask,
      maxTimePerTaskMs: this.effectiveConfig.limits.maxTimePerTaskMs,
    },
    warningThresholds: {
      costWarningPercent: 80,
      tokenWarningPercent: 80,
      timeWarningPercent: 80,
      fileWarningPercent: 80,
    },
  };
}
```

### 4. Event Forwarding

The `AutonomyEnforcer` emits events that need to be forwarded to the orchestrator's event system:

```typescript
private setupAutonomyEnforcerEvents(): void {
  this.autonomyEnforcer.on('limit:warning', (warning) => {
    const task = this.store.getTask(this.currentTaskId);
    if (task) {
      this.emit('limit:warning', {
        taskId: task.id,
        limitType: warning.type,
        currentValue: warning.currentValue,
        limitValue: warning.limitValue,
        utilizationPercent: (warning.currentValue / warning.limitValue) * 100,
        timestamp: new Date(),
      });
    }
  });

  this.autonomyEnforcer.on('limit:exceeded', (result, task) => {
    this.emit('limit:exceeded', {
      taskId: task.id,
      limitType: result.limitType!,
      currentValue: result.currentValue!,
      limitValue: result.limitValue!,
      timestamp: new Date(),
    });
  });

  this.autonomyEnforcer.on('approval:required', (gateName, context) => {
    // Handle approval required - could pause task or emit event
    this.emit('approval:required', {
      taskId: context.task.id,
      gateId: gateName,
      gateName: gateName,
      stage: context.currentStage,
      agent: context.agent,
      timestamp: new Date(),
    });
  });
}
```

### 5. Public Accessor

Provide a getter for accessing the enforcer during task execution:

```typescript
/**
 * Get the autonomy enforcer instance for policy checks
 */
get autonomyEnforcer(): AutonomyEnforcer {
  return this._autonomyEnforcer;
}
```

### 6. Update AutonomyEnforcer Interface

Update the config interface to align with the existing type system:

```typescript
export interface AutonomyEnforcerConfig {
  /** Autonomy level setting */
  level: AutonomyLevel;
  /** Approval gates configuration */
  gates: ApprovalGate[];
  /** Resource and operational limits */
  limits: AutonomyLimits;
  /** Warning thresholds as percentages */
  warningThresholds: {
    costWarningPercent: number;
    tokenWarningPercent: number;
    timeWarningPercent: number;
    fileWarningPercent: number;
  };
}
```

## Consequences

### Positive
- Centralized autonomy enforcement through a single component
- Clean separation of concerns between orchestration and policy enforcement
- Consistent naming with `PolicyEnforcer`
- Dependency injection allows for testing with mocked enforcers
- Event-based communication for loose coupling
- Configurable via the existing config system

### Negative
- Adds another component to initialize and manage
- Circular reference between orchestrator and enforcer (enforcer needs orchestrator for store access)
- Additional event handlers to maintain

### Mitigations
- The circular reference is managed by passing the orchestrator to the enforcer's constructor (existing pattern)
- Event forwarding is straightforward and follows existing patterns in the codebase

## Implementation Plan

### Phase 1: Rename and Restructure (This ADR)
1. Rename `AutonomyController` to `AutonomyEnforcer` in `autonomy-controller.ts` → `autonomy-enforcer.ts`
2. Update `AutonomyControllerConfig` to `AutonomyEnforcerConfig`
3. Update `AutonomyControllerEvents` to `AutonomyEnforcerEvents`
4. Update all imports and references

### Phase 2: Integration (This Task)
1. Add `autonomyEnforcer?` to `OrchestratorOptions`
2. Add private `_autonomyEnforcer` field to `ApexOrchestrator`
3. Add initialization logic in `initialize()` method
4. Add `buildAutonomyEnforcerConfig()` private method
5. Add `setupAutonomyEnforcerEvents()` private method
6. Add public getter for `autonomyEnforcer`
7. Export `AutonomyEnforcer` from index.ts

### Phase 3: Task Execution Integration (Future)
1. Call `autonomyEnforcer.checkApprovalRequired()` before tool execution
2. Call `autonomyEnforcer.checkLimits()` after usage updates
3. Handle limit exceeded by pausing or failing tasks

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/autonomy-controller.ts` | Rename/Modify | Rename to `autonomy-enforcer.ts`, update class and interface names |
| `packages/orchestrator/src/autonomy-enforcer.ts` | New | Renamed file with updated exports |
| `packages/orchestrator/src/index.ts` | Modify | Add `autonomyEnforcer` field, initialization, event handling, and exports |
| `packages/orchestrator/src/index.ts` | Modify | Update `OrchestratorOptions` interface |

## Technical Design

### Class Diagram

```
┌─────────────────────────┐
│   ApexOrchestrator      │
├─────────────────────────┤
│ - autonomyEnforcer      │──────────┐
│ - config                │          │
│ - effectiveConfig       │          │
│ - store                 │          │
├─────────────────────────┤          │
│ + initialize()          │          │
│ + autonomyEnforcer      │          │
│ - buildEnforcerConfig() │          │
│ - setupEnforcerEvents() │          │
└─────────────────────────┘          │
           │                         │
           │ uses                    │
           ▼                         ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│      TaskStore          │  │   AutonomyEnforcer      │
├─────────────────────────┤  ├─────────────────────────┤
│ + getTask()             │  │ - config                │
│ + updateTask()          │  │ - taskUsageMap          │
└─────────────────────────┘  │ - taskStartTimes        │
                             ├─────────────────────────┤
                             │ + checkApprovalRequired()│
                             │ + checkLimits()          │
                             │ + recordUsage()          │
                             │ + startTracking()        │
                             │ + stopTracking()         │
                             └─────────────────────────┘
```

### Sequence Diagram: Initialization

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ApexOrchestrator │     │ AutonomyEnforcer │     │    TaskStore     │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │ initialize()           │                        │
         │───────────────────────>│                        │
         │                        │                        │
         │ new AutonomyEnforcer() │                        │
         │───────────────────────>│                        │
         │                        │                        │
         │ setupEvents()          │                        │
         │───────────────────────>│                        │
         │                        │                        │
         │                        │ on('task:started')     │
         │                        │────────────────────────>
         │                        │                        │
         │ initialized            │                        │
         │<───────────────────────│                        │
```

### Sequence Diagram: Limit Checking

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ApexOrchestrator │     │ AutonomyEnforcer │     │    External      │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │ emit('usage:updated')  │                        │
         │───────────────────────>│                        │
         │                        │                        │
         │                        │ recordUsage()          │
         │                        │───────────────────────>│
         │                        │                        │
         │                        │ checkLimits()          │
         │                        │───────────────────────>│
         │                        │                        │
         │    limit:exceeded      │                        │
         │<───────────────────────│                        │
         │                        │                        │
         │ emit('limit:exceeded') │                        │
         │───────────────────────────────────────────────────>
         │                        │                        │
         │ pauseTask() or fail    │                        │
         │───────────────────────>│                        │
```

## Alternatives Considered

### 1. Merge into PolicyEnforcer
Considered merging autonomy enforcement into the existing `PolicyEnforcer`, but:
- Different responsibilities (autonomy vs. policy/security)
- Would make PolicyEnforcer too large
- Violates single responsibility principle

### 2. No Dependency Injection
Considered always creating the enforcer internally, but:
- Makes testing more difficult
- Doesn't allow for custom enforcer implementations
- Less flexible for advanced use cases

### 3. Static Factory Method
Considered using a factory method instead of constructor injection:
```typescript
static createWithEnforcer(options: OrchestratorOptions): ApexOrchestrator
```
But:
- Adds complexity without clear benefit
- Constructor injection is simpler and more idiomatic

## References

- ADR-018: Policy Enforcer Base Class
- ADR-019: Approval Rules Checking
- Existing `autonomy-controller.ts` implementation
- `PolicyEnforcer` pattern in `packages/orchestrator/src/policy.ts`
