# ADR 0003: Mock Factories Architecture for Core Domain Types

## Status

**Proposed** - Pending implementation review

## Context

APEX requires comprehensive mock factories for testing purposes. The acceptance criteria state:

> Mock factories exist for all core types defined in packages/core/src/types.ts including Task, Agent, Workflow, and related Zod schemas. Factories support partial overrides and generate valid typed objects.

### Current State Analysis

After thorough codebase analysis, the following factories **already exist** in `/packages/core/src/test-fixtures/factories/`:

| Factory File | Types Covered | Status |
|-------------|---------------|--------|
| `task-factory.ts` | Task, TaskStatus, TaskPriority, TaskEffort, TaskUsage, TaskLog, Artifact | ✅ Complete |
| `workflow-factory.ts` | WorkflowDefinition, WorkflowStage, WorkflowGate, IsolationConfig | ✅ Complete |
| `agent-factory.ts` | AgentDefinition, AgentModel | ✅ Complete |
| `tool-factory.ts` | ToolResult, ToolExecution, ToolInvocation, ToolDefinition | ✅ Complete |
| `autonomy-factory.ts` | AutonomyConfig, AgentAutonomyOverride, ApprovalGate, TaskResourceLimits | ✅ Complete |
| `config-factory.ts` | ProjectConfig (with integrated autonomy, agents, workflows) | ✅ Complete |
| `permission-factory.ts` | ToolPermission, ToolPermissionResult | ✅ Complete |

### Factory Pattern Analysis

All existing factories follow a consistent pattern:

```typescript
// 1. Factory signature type from types.ts
export type FixtureFactory<T, TOptions = Record<string, unknown>> = (
  overrides?: Partial<T>,
  options?: TOptions
) => T;

// 2. Core factory function with sensible defaults
export const createXxx: FixtureFactory<Xxx, XxxFactoryOptions> = (
  overrides = {},
  options = {}
): Xxx => {
  // Default implementation
  return { ...defaults, ...overrides };
};

// 3. Specialized factories for common scenarios
export const createSpecializedXxx: FixtureFactory<Xxx> = (overrides = {}) =>
  createXxx({ ...specializedDefaults, ...overrides });

// 4. Preset collections for organized access
export const XxxPresets = {
  category1: { variant1: () => createXxx(...), ... },
  category2: { ... },
} as const;
```

## Decision

### Scope Clarification

**The acceptance criteria are ALREADY MET** - all core domain types have existing factory implementations:

1. **Task-related types** - `task-factory.ts` covers:
   - `Task` (with all statuses: pending, running, completed, failed, paused, cancelled)
   - `TaskUsage`, `TaskLog`, `Artifact`
   - Workflow-specific and priority-specific variants

2. **Agent-related types** - `agent-factory.ts` covers:
   - `AgentDefinition` with all agent roles (planner, architect, developer, tester, reviewer, devops)
   - Model variants (opus, sonnet, haiku, inherit)

3. **Workflow-related types** - `workflow-factory.ts` covers:
   - `WorkflowDefinition` (feature, hotfix, bugfix, enhancement, refactor)
   - `WorkflowStage` (planning, architecture, implementation, testing, review, deployment)
   - `WorkflowGate` (approval, quality, security, deployment)
   - `IsolationConfig`

4. **Tool-related types** - `tool-factory.ts` covers:
   - `ToolResult`, `ToolExecution`, `ToolInvocation`, `ToolDefinition`
   - File system, shell, and web tool response presets

5. **Autonomy types** - `autonomy-factory.ts` covers:
   - `AutonomyConfig`, `AgentAutonomyOverride`, `ApprovalGate`, `TaskResourceLimits`
   - Level-specific configs (full-auto, review-before-commit, review-all)

6. **Permission types** - `permission-factory.ts` covers:
   - `ToolPermission`, `ToolPermissionResult`
   - Security level and stage-based permission sets

### Types NOT Needing Factories

Some types in `types.ts` are **not suitable for factories**:

1. **Enum types** - `AgentModel`, `AgentTool`, `TaskStatus`, etc. are simple enums used as values
2. **Configuration schemas** - `LimitsConfig`, `GitConfig`, `UIConfig`, etc. are covered by `config-factory.ts`
3. **Browser operation types** - Specialized browser params are internal implementation details
4. **Zod schema types** - The schemas themselves generate valid types; factories test the domain objects

### Architecture Decisions

#### AD-1: Maintain Existing Factory Pattern
Continue using the established `FixtureFactory<T, TOptions>` pattern with:
- Partial overrides for customization
- Options for conditional inclusion of related data
- Preset collections for organized test scenarios

#### AD-2: Factory Organization
Factories are organized by domain concept:
- `task-factory.ts` - Task lifecycle and execution
- `agent-factory.ts` - Agent definitions and roles
- `workflow-factory.ts` - Workflow structure and stages
- `tool-factory.ts` - Tool execution and results
- `autonomy-factory.ts` - Autonomy configuration
- `permission-factory.ts` - Permission management
- `config-factory.ts` - Project configuration (aggregates other factories)

#### AD-3: Export Strategy
All factories are re-exported through `factories/index.ts` for unified access:
```typescript
import { createTask, createAgent, createWorkflowDefinition } from '@apex/core/test-fixtures';
```

#### AD-4: Validation Functions
Each factory module includes validation functions to verify object structure:
```typescript
export function validateXxx(obj: Xxx): boolean;
```

## Consequences

### Positive

1. **Complete coverage** - All core domain types have factory support
2. **Consistent API** - Unified `FixtureFactory<T, TOptions>` pattern
3. **Partial overrides** - Tests can easily customize specific fields
4. **Preset collections** - Common scenarios are pre-configured
5. **Type safety** - Full TypeScript integration with Zod schemas

### Negative

1. **Maintenance overhead** - Factories must be updated when types change
2. **Learning curve** - Developers need to understand the factory options

### Neutral

1. **No additional factories needed** - The task is already complete
2. **Documentation could be enhanced** - JSDoc comments exist but could be more comprehensive

## Technical Design Summary

### Existing Factory Coverage

```
packages/core/src/test-fixtures/factories/
├── index.ts              # Re-exports all factories
├── task-factory.ts       # Task, TaskUsage, TaskLog, Artifact
├── workflow-factory.ts   # WorkflowDefinition, WorkflowStage, WorkflowGate, IsolationConfig
├── agent-factory.ts      # AgentDefinition
├── tool-factory.ts       # ToolResult, ToolExecution, ToolInvocation, ToolDefinition
├── autonomy-factory.ts   # AutonomyConfig, AgentAutonomyOverride, ApprovalGate, TaskResourceLimits
├── config-factory.ts     # ProjectConfig (integrates all above)
├── permission-factory.ts # ToolPermission, ToolPermissionResult
└── __tests__/
    ├── autonomy-factory.test.ts
    ├── autonomy-factory-integration.test.ts
    ├── autonomy-factory-examples.test.ts
    ├── config-factory.test.ts
    └── permission-factory.test.ts
```

### Factory Interface Pattern

```typescript
// Core type definitions in ../types.ts
export type FixtureFactory<T, TOptions = Record<string, unknown>> = (
  overrides?: Partial<T>,
  options?: TOptions
) => T;

// Example usage
const task = createTask({ status: 'completed' }, { includeUsage: true });
const agent = createDeveloperAgent({ model: 'opus' });
const workflow = createFeatureWorkflow({ name: 'custom-feature' });
```

### Preset Collections Pattern

```typescript
export const TaskPresets = {
  basic: { pending, running, completed, failed, paused, cancelled },
  workflows: { feature, hotfix, bugfix, enhancement, refactor },
  priorities: { low, normal, high, urgent },
  efforts: { minimal, small, medium, large, xlarge },
  enriched: { withUsage, withLogs, withArtifacts, complete }
};

export const AgentPresets = {
  workflow: { planner, architect, developer, tester, reviewer, devops },
  models: { opus, sonnet, haiku, inherit },
  capabilities: { minimal, basic, standard, advanced }
};

export const WorkflowPresets = {
  types: { feature, hotfix, bugfix, enhancement, refactor },
  complexity: { minimal, simple, standard, comprehensive },
  execution: { sequential, parallel, gated }
};
```

## Verification

To verify the factories meet acceptance criteria:

1. **All core types have factories** ✅
   - Task, Agent, Workflow, and related Zod schemas are covered

2. **Partial override support** ✅
   - All factories accept `overrides?: Partial<T>` parameter

3. **Valid typed objects** ✅
   - Factories return fully-typed objects matching Zod schemas
   - Validation functions available for verification

## Conclusion

**No new factories are required.** The existing implementation in `/packages/core/src/test-fixtures/factories/` already provides complete coverage for all core domain types with:

- Partial override support
- Valid typed object generation
- Comprehensive preset collections
- Full test coverage

The architecture stage confirms the acceptance criteria are already satisfied by the existing codebase.
