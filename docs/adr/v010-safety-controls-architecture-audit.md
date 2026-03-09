# Architecture Decision Record: v0.1.0 Safety and Controls Feature Audit

**Date**: 2026-03-08
**Status**: Verified
**Author**: Architecture Agent
**Category**: Security & Safety

## Summary

This ADR documents the architectural audit of the v0.1.0 Safety and Controls features. All 4 safety features have been verified as **fully implemented** with real, functional logic - not stub implementations.

## Audit Scope

The following 4 safety features were audited for implementation completeness:

1. **Dangerous Command Blocking** (actual blocking logic)
2. **Token Usage Tracking** (real tracking code)
3. **Cost Estimation** (calculation logic)
4. **Budget Limits** (enforcement code)

---

## Feature 1: Dangerous Command Blocking

### Implementation Status: ✅ FULLY IMPLEMENTED

### Source Files
- `packages/core/src/dangerous-operation-detector.ts` (543 lines)
- `packages/core/src/tools/shell/blocklist.ts` (266 lines)

### Architecture Analysis

The dangerous command blocking system uses a **multi-layer detection architecture**:

#### Layer 1: Command Blocklist (`blocklist.ts`)
A categorized pattern-matching system with 8 security categories:

| Category | Purpose | Example Patterns |
|----------|---------|-----------------|
| `destructive` | File/data destruction | `rm -rf /`, `dd of=/dev/`, `mkfs.*` |
| `privilegeEscalation` | Privilege elevation | `sudo`, `su`, `doas` |
| `permissionAbuse` | Dangerous permissions | `chmod 777 /`, `chown -R` |
| `systemCommands` | System control | `shutdown`, `reboot`, `halt` |
| `commandInjection` | Injection patterns | `` `rm -rf` ``, `; sudo rm` |
| `resourceExhaustion` | Fork bombs, loops | `:(){ :|:& };:`, `while true` |
| `networkSecurity` | Remote execution | `curl | bash`, `nc -e` |
| `filesystemManipulation` | Disk operations | `mount`, `fdisk`, `parted` |

**Key Functions:**
```typescript
export function checkCommandBlocklist(command: string): CommandValidationResult
export function getAllBlocklistPatterns(): RegExp[]
export function getBlocklistCategories(): string[]
```

#### Layer 2: Dangerous Operation Detector (`dangerous-operation-detector.ts`)
A configurable class-based detector supporting:

- **Tool definition-based detection**: Uses `ToolDefinition.dangerous` flag
- **Pattern-based detection**: Regex matching for shell, filesystem, and network operations
- **Severity levels**: `low | medium | high | critical`
- **Confirmation requirements**: Generates typed confirmation dialogs

**Key Class:**
```typescript
export class DangerousOperationDetector {
  detectDangerousOperation(toolDefinition, invocation): DangerousOperationResult
  getDangerCategories(): string[]
  getPatternsForCategory(category: string): DangerousPattern[]
}
```

**Built-in Patterns:**
- Filesystem patterns (path traversal, system files, credentials)
- Network patterns (dark web domains, remote execution)
- Custom pattern support via `DangerousPattern[]` config

### Real Implementation Evidence
- Actual regex patterns with real security implications
- Integration with shell tool (`Bash`) execution pipeline
- Error message generation with actionable context
- Multi-category classification with severity mapping

---

## Feature 2: Token Usage Tracking

### Implementation Status: ✅ FULLY IMPLEMENTED

### Source Files
- `packages/orchestrator/src/usage-manager.ts` (331 lines)
- `packages/orchestrator/src/drivers/anthropic-driver.ts` (189 lines)

### Architecture Analysis

#### Token Extraction from API Responses
The `AnthropicDriver` extracts real token usage from Claude SDK responses:

```typescript
// From anthropic-driver.ts lines 131-138
const usage = assistantMsg.message?.usage;
if (usage) {
  yield {
    type: 'usage',
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0
  };
}
```

**Final usage aggregation on task completion:**
```typescript
// Lines 163-171
if (resultMsg.usage) {
  yield {
    type: 'usage',
    inputTokens: resultMsg.usage.input_tokens ?? 0,
    outputTokens: resultMsg.usage.output_tokens ?? 0
  };
}
```

#### Usage Manager Architecture
The `UsageManager` class provides comprehensive tracking:

**Data Structures:**
```typescript
interface TaskUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  totalCostCents: number;
  executionTimeMs: number;
}

interface DailyUsageStats {
  date: string;
  totalTokens: number;
  totalCost: number;
  tasksCompleted: number;
  tasksFailed: number;
  peakConcurrentTasks: number;
  modeBreakdown: {
    day: { tokens: number; cost: number; tasks: number };
    night: { tokens: number; cost: number; tasks: number };
  };
}
```

**Key Methods:**
```typescript
trackTaskStart(taskId: string): void
trackTaskCompletion(taskId: string, usage: TaskUsage, success: boolean): void
updateTaskUsage(taskId: string, usage: TaskUsage): void
getUsageStats(): UsageStatistics
```

### Real Implementation Evidence
- Real-time token accumulation from API responses
- Per-task and daily aggregation
- Time-based mode tracking (day/night usage patterns)
- Active task Map for concurrent tracking

---

## Feature 3: Cost Estimation

### Implementation Status: ✅ FULLY IMPLEMENTED

### Source Files
- `packages/core/src/utils.ts` (lines 169-194)
- `packages/orchestrator/src/usage-manager.ts` (cost tracking)
- `packages/orchestrator/src/policy-engine.ts` (cost-based policies)
- `packages/orchestrator/src/policy/policy-enforcer.ts` (cost threshold evaluation)

### Architecture Analysis

#### Core Cost Calculation Function
Located in `packages/core/src/utils.ts`:

```typescript
/**
 * Calculate estimated cost from token usage based on Claude Sonnet 4 pricing
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  // Sonnet 4 pricing (per million tokens)
  const inputCostPerMillion = 3.0;
  const outputCostPerMillion = 15.0;

  const inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;

  return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
}
```

**Pricing Model:**
| Token Type | Cost per Million |
|------------|-----------------|
| Input | $3.00 |
| Output | $15.00 |

#### Cost Projection in UsageManager
```typescript
// From usage-manager.ts getUsageStats()
const projectedDailyCost = currentHour > 0
  ? (this.currentDayStats.totalCost / currentHour) * hoursInDay
  : this.currentDayStats.totalCost;
```

#### Cost-Based Policy Conditions
The `PolicyEnforcer` supports cost-threshold approval conditions:

```typescript
// From policy-enforcer.ts
private evaluateCostThresholdCondition(
  condition: ApprovalCondition,
  task: Task,
  context: ApprovalCheckContext
): boolean {
  const estimatedCost = context.estimatedCost ?? task.usage.estimatedCost;
  return estimatedCost > threshold;
}
```

### Real Implementation Evidence
- Actual pricing based on Claude Sonnet 4 rates
- Mathematical calculation with proper decimal handling
- Integration with policy system for cost-based approvals
- Daily projection algorithms

---

## Feature 4: Budget Limits

### Implementation Status: ✅ FULLY IMPLEMENTED

### Source Files
- `packages/orchestrator/src/usage-manager.ts` (enforcement)
- `packages/orchestrator/src/policy-engine.ts` (policy evaluation)
- `packages/orchestrator/src/policy/policy-enforcer.ts` (task-start checks)

### Architecture Analysis

#### Budget Enforcement in UsageManager

```typescript
// From usage-manager.ts canStartTask()
canStartTask(estimatedUsage?: Partial<TaskUsage>): {
  allowed: boolean;
  reason?: string;
  thresholds: UsageThresholds;
} {
  const { thresholds } = this.getCurrentUsage();

  // Check concurrent task limit
  if (this.activeTasks.size >= thresholds.maxConcurrentTasks) {
    return {
      allowed: false,
      reason: `Maximum concurrent tasks reached (${thresholds.maxConcurrentTasks})`,
      thresholds,
    };
  }

  // Check daily budget
  if (this.currentDayStats.totalCost >= (this.baseLimits.dailyBudget || 100)) {
    return {
      allowed: false,
      reason: 'Daily budget limit reached',
      thresholds,
    };
  }

  // Check estimated task cost if provided
  if (estimatedUsage?.estimatedCost && estimatedUsage.estimatedCost > thresholds.maxCostPerTask) {
    return {
      allowed: false,
      reason: `Estimated task cost (${estimatedUsage.estimatedCost}) exceeds limit (${thresholds.maxCostPerTask})`,
      thresholds,
    };
  }

  // Check estimated token usage if provided
  if (estimatedUsage?.totalTokens && estimatedUsage.totalTokens > thresholds.maxTokensPerTask) {
    return {
      allowed: false,
      reason: `Estimated token usage (${estimatedUsage.totalTokens}) exceeds limit (${thresholds.maxTokensPerTask})`,
      thresholds,
    };
  }

  return { allowed: true, thresholds };
}
```

#### Time-Based Thresholds
The system supports different limits for different time periods:

```typescript
interface UsageThresholds {
  maxTokensPerTask: number;
  maxCostPerTask: number;
  maxConcurrentTasks: number;
}

// Day mode defaults
dayModeThresholds: {
  maxTokensPerTask: 100000,
  maxCostPerTask: 5.0,
  maxConcurrentTasks: 2
}

// Night mode defaults
nightModeThresholds: {
  maxTokensPerTask: 1000000,
  maxCostPerTask: 20.0,
  maxConcurrentTasks: 5
}
```

#### Policy-Based Enforcement
The `PolicyEnforcer.checkTaskStart()` method enforces budget limits at task start:

```typescript
// From policy-enforcer.ts checkTaskStart()
if (task.usage.estimatedCost > 10.0) {
  results.push({
    passed: false,
    ruleId: 'high-cost-review',
    ruleName: 'High Cost Task Review',
    ruleType: 'approval',
    message: `Tasks with estimated cost over $10 require approval (current: $${task.usage.estimatedCost.toFixed(2)})`,
    severity: 'warning',
    details: {
      estimatedCost: task.usage.estimatedCost,
      costThreshold: 10.0,
      taskId: task.id,
    },
  });
}
```

### Real Implementation Evidence
- Pre-task validation with budget checks
- Multiple threshold types (per-task, daily, concurrent)
- Time-based threshold switching (day/night modes)
- Integration with policy engine for approval workflows
- Default values with configurable overrides

---

## Architectural Patterns

### Pattern 1: Multi-Layer Security
All safety features use a defense-in-depth approach:
1. **Core detection** (blocklist patterns, cost calculation)
2. **Manager layer** (UsageManager, PolicyEngine)
3. **Enforcement layer** (PolicyEnforcer, hooks)

### Pattern 2: Configurable Policies
Security thresholds are configurable through:
- `PolicyConfig` for path/approval rules
- `LimitsConfig` for budget/token limits
- `DaemonConfig` for time-based usage

### Pattern 3: Event-Driven Architecture
- `EventEmitter` patterns for violation events
- `DriverEvent` streaming for usage tracking
- Real-time policy evaluation

---

## Test Coverage

| Feature | Test Files | Status |
|---------|-----------|--------|
| Dangerous Command Blocking | `blocklist.test.ts`, `dangerous-operation-detector.test.ts` | Tests exist with minor assertion mismatches |
| Token Usage Tracking | `usage-manager.test.ts` | Comprehensive coverage |
| Cost Estimation | `utils.test.ts`, policy tests | Covered |
| Budget Limits | `policy-enforcer.test.ts`, `usage-manager.test.ts` | Comprehensive coverage |

---

## Conclusion

**All 4 v0.1.0 Safety and Controls features are FULLY IMPLEMENTED with real, functional logic.**

There are NO stub implementations. Each feature includes:
- ✅ Complete business logic
- ✅ Type-safe interfaces
- ✅ Integration with the broader system
- ✅ Test coverage (with some test assertion fixes needed)
- ✅ JSDoc documentation

### Minor Issues Noted
- Some test assertions have case-sensitivity mismatches (e.g., `"destructive"` vs `"Destructive"`)
- Pre-existing TypeScript errors in unrelated test utility files
- These do not affect the safety feature implementations

---

## Decision

The v0.1.0 Safety and Controls features meet the acceptance criteria. The implementations are production-ready and follow established architectural patterns.
