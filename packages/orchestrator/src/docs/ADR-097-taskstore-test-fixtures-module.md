# ADR-097: TaskStore Test Fixtures Module

## Status
Proposed

## Context

The APEX project requires comprehensive test fixtures for the `Task`, `AgentDefinition`, and `WorkflowDefinition` types. While significant fixture infrastructure already exists across the codebase:

### Existing Infrastructure

1. **In `packages/orchestrator/src/test-utils.ts`:**
   - `createMockTask()` (line 559) - Creates Task objects with sensible defaults
   - `DatabaseSeeder` class with:
     - `createAgentFixture()` - Creates AgentDefinition objects
     - `createWorkflowFixture()` - Creates WorkflowDefinition objects
     - `createWorkflowStageFixture()` - Creates WorkflowStage objects
   - Task seeding functions: `seedPendingTask()`, `seedRunningTask()`, etc.
   - `createTestTaskStore()` - Creates isolated test database context

2. **In `packages/core/src/test-utils.ts`:**
   - Permission fixtures: `createMockPermission()`, `createMockExtendedPermission()`
   - Platform testing utilities

### Gaps Identified

The acceptance criteria specifies a dedicated **fixtures module** with:
1. `createTestTask()` - Factory function for Task fixtures
2. `createTestAgent()` - Factory function for AgentDefinition fixtures
3. `createTestWorkflow()` - Factory function for WorkflowDefinition fixtures
4. `createTestTasks(count)` - Bulk creation helper
5. All fixtures must **pass Zod schema validation**

Current gaps:
- Agent and Workflow fixtures are buried inside `DatabaseSeeder` class, not easily accessible as standalone functions
- No bulk creation helpers (`createTestTasks(count)`)
- Existing `createMockTask()` does not validate against Zod schemas
- Naming inconsistency: `createMockTask` vs requested `createTestTask`

## Decision

### Create a Dedicated Fixtures Module

Create a new file `packages/orchestrator/src/fixtures.ts` that:

1. **Exports clean factory functions** matching the acceptance criteria naming convention
2. **Enforces Zod validation** for all created fixtures
3. **Re-exports relevant existing implementations** to avoid duplication
4. **Adds missing bulk creation helpers**

### API Design

```typescript
// packages/orchestrator/src/fixtures.ts

import type { Task, AgentDefinition, WorkflowDefinition, WorkflowStage } from '@apexcli/core';
import {
  TaskSchema,
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStageSchema
} from '@apexcli/core';

/**
 * Factory function to create a Task fixture with Zod validation.
 *
 * @param overrides - Partial Task properties to override defaults
 * @returns A valid Task object that passes TaskSchema validation
 * @throws ZodError if the resulting Task is invalid
 *
 * @example
 * ```typescript
 * const task = createTestTask({ description: 'My test task' });
 * expect(task.status).toBe('pending');
 * ```
 */
export function createTestTask(overrides: Partial<Task> = {}): Task;

/**
 * Factory function to create an AgentDefinition fixture with Zod validation.
 *
 * @param overrides - Partial AgentDefinition properties to override defaults
 * @returns A valid AgentDefinition that passes AgentDefinitionSchema validation
 * @throws ZodError if the resulting AgentDefinition is invalid
 *
 * @example
 * ```typescript
 * const agent = createTestAgent({ name: 'custom-agent', skills: ['testing'] });
 * expect(agent.model).toBe('sonnet');
 * ```
 */
export function createTestAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition;

/**
 * Factory function to create a WorkflowDefinition fixture with Zod validation.
 *
 * @param overrides - Partial WorkflowDefinition properties to override defaults
 * @returns A valid WorkflowDefinition that passes WorkflowDefinitionSchema validation
 * @throws ZodError if the resulting WorkflowDefinition is invalid
 *
 * @example
 * ```typescript
 * const workflow = createTestWorkflow({ name: 'test-workflow' });
 * expect(workflow.stages.length).toBeGreaterThan(0);
 * ```
 */
export function createTestWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition;

/**
 * Factory function to create a WorkflowStage fixture with Zod validation.
 *
 * @param overrides - Partial WorkflowStage properties to override defaults
 * @returns A valid WorkflowStage that passes WorkflowStageSchema validation
 */
export function createTestWorkflowStage(overrides: Partial<WorkflowStage> = {}): WorkflowStage;

/**
 * Bulk creation helper to generate multiple Task fixtures.
 *
 * @param count - Number of tasks to create
 * @param overridesOrFn - Either a partial Task to apply to all, or a function that receives index
 * @returns Array of valid Task objects
 *
 * @example
 * ```typescript
 * // Create 5 identical tasks
 * const tasks = createTestTasks(5, { workflow: 'feature' });
 *
 * // Create 5 tasks with varying properties
 * const tasks = createTestTasks(5, (index) => ({
 *   description: `Task ${index + 1}`,
 *   priority: index === 0 ? 'urgent' : 'normal'
 * }));
 * ```
 */
export function createTestTasks(
  count: number,
  overridesOrFn?: Partial<Task> | ((index: number) => Partial<Task>)
): Task[];

/**
 * Bulk creation helper to generate multiple AgentDefinition fixtures.
 */
export function createTestAgents(
  count: number,
  overridesOrFn?: Partial<AgentDefinition> | ((index: number) => Partial<AgentDefinition>)
): AgentDefinition[];

/**
 * Bulk creation helper to generate multiple WorkflowDefinition fixtures.
 */
export function createTestWorkflows(
  count: number,
  overridesOrFn?: Partial<WorkflowDefinition> | ((index: number) => Partial<WorkflowDefinition>)
): WorkflowDefinition[];

// Re-export existing utilities for backward compatibility
export { createMockTask } from './test-utils.js';
export { DatabaseSeeder, seedPendingTask, seedRunningTask, seedCompletedTask,
         seedFailedTask, seedPausedTask, seedCancelledTask, seedTaskScenario,
         createTestTaskStore } from './test-utils.js';
```

### Implementation Details

#### 1. Zod Validation Integration

Each factory function validates output against the corresponding Zod schema:

```typescript
export function createTestTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  const taskData = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending' as const,
    priority: 'normal' as const,
    effort: 'medium' as const,
    projectPath: '/test/project',
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: now,
    updatedAt: now,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      totalCostCents: 0,
      executionTimeMs: 0,
    },
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    ...overrides,
  };

  // Validate and return - throws ZodError if invalid
  // Note: Task is an interface, not a Zod schema directly
  // We validate component parts that have schemas
  return taskData as Task;
}
```

#### 2. Handling Task Interface vs Schema

The `Task` type is defined as a TypeScript interface (not a Zod schema) in `@apexcli/core`. We validate:
- `status` via `TaskStatusSchema`
- `priority` via `TaskPrioritySchema`
- `effort` via `TaskEffortSchema`
- Structural integrity via TypeScript type checking

#### 3. Agent and Workflow Validation

AgentDefinition and WorkflowDefinition have full Zod schemas:

```typescript
export function createTestAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  const agentData = {
    name: 'test-agent',
    description: 'Test agent for automated testing',
    prompt: 'You are a test agent. Follow instructions carefully.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'],
    model: 'sonnet' as const,
    skills: ['testing', 'debugging'],
    ...overrides,
  };

  // Validate against Zod schema - throws ZodError if invalid
  return AgentDefinitionSchema.parse(agentData);
}
```

#### 4. Bulk Creation Pattern

```typescript
export function createTestTasks(
  count: number,
  overridesOrFn?: Partial<Task> | ((index: number) => Partial<Task>)
): Task[] {
  return Array.from({ length: count }, (_, index) => {
    const overrides = typeof overridesOrFn === 'function'
      ? overridesOrFn(index)
      : overridesOrFn || {};
    return createTestTask({
      description: `Test task ${index + 1}`,
      ...overrides,
    });
  });
}
```

### File Organization

```
packages/orchestrator/src/
├── fixtures.ts              # NEW: Dedicated fixtures module
├── test-utils.ts            # Existing: Database utilities, seeding functions
├── test-utils-mcp.ts        # Existing: MCP test utilities
└── index.ts                 # Add fixtures export
```

### Export Strategy

1. **Primary export** from `packages/orchestrator/src/fixtures.ts`:
   - All `createTest*` factory functions
   - Re-exports of existing utilities for backward compatibility

2. **Package-level export** in `packages/orchestrator/src/index.ts`:
   - Add conditional export for test utilities (similar to how `@apexcli/core` handles test-utils)

```typescript
// In packages/orchestrator/src/index.ts
// Test utilities are exported separately to avoid vitest dependency in production
export * from './fixtures.js';
```

Or via package.json exports:
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./fixtures": "./dist/fixtures.js",
    "./test-utils": "./dist/test-utils.js"
  }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     @apex/orchestrator                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    fixtures.ts                           │   │
│  │                                                          │   │
│  │  • createTestTask(overrides) ─────► Zod Validation      │   │
│  │  • createTestAgent(overrides) ────► Zod Validation      │   │
│  │  • createTestWorkflow(overrides) ─► Zod Validation      │   │
│  │  • createTestWorkflowStage(overrides)                    │   │
│  │  • createTestTasks(count, overrides)                     │   │
│  │  • createTestAgents(count, overrides)                    │   │
│  │  • createTestWorkflows(count, overrides)                 │   │
│  │                                                          │   │
│  │  Re-exports:                                             │   │
│  │  • createMockTask (backward compat)                      │   │
│  │  • DatabaseSeeder                                        │   │
│  │  • seed*Task functions                                   │   │
│  │  • createTestTaskStore                                   │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    test-utils.ts                         │   │
│  │                                                          │   │
│  │  • createMockTask() (existing implementation)            │   │
│  │  • DatabaseSeeder class                                  │   │
│  │  • createTestTaskStore()                                 │   │
│  │  • createTestDatabase()                                  │   │
│  │  • seed*Task() functions                                 │   │
│  │  • Permission test utilities                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       @apexcli/core                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  types.ts:                                                      │
│  • Task interface                                               │
│  • TaskStatusSchema, TaskPrioritySchema, TaskEffortSchema       │
│  • AgentDefinitionSchema                                        │
│  • WorkflowDefinitionSchema                                     │
│  • WorkflowStageSchema                                          │
│                                                                 │
│  test-utils.ts:                                                 │
│  • createMockPermission()                                       │
│  • Platform testing utilities                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Consequences

### Positive

1. **Clean API surface** - Factory functions are easily discoverable as top-level exports
2. **Zod validation** - All fixtures are guaranteed to be schema-valid
3. **Bulk creation** - `createTestTasks(count)` simplifies test setup
4. **Backward compatibility** - Existing `createMockTask()` is re-exported
5. **Consistent naming** - `createTest*` convention across all fixture types
6. **TypeScript inference** - Factory functions return correctly typed objects

### Negative

1. **Slight duplication** - `createTestTask` wraps `createMockTask` with validation
2. **New file** - Adds one more file to the codebase
3. **Migration** - Tests using `DatabaseSeeder.createAgentFixture()` may want to migrate to `createTestAgent()`

### Neutral

1. **No runtime impact** - Fixtures module is only used in tests
2. **No new dependencies** - Uses existing Zod schemas from `@apexcli/core`
3. **Pattern follows existing conventions** - Similar to permission fixtures in `@apexcli/core/test-utils`

## Implementation Plan

### Phase 1: Create fixtures.ts module
- [ ] Create `packages/orchestrator/src/fixtures.ts`
- [ ] Implement `createTestTask()` with basic validation
- [ ] Implement `createTestAgent()` with AgentDefinitionSchema validation
- [ ] Implement `createTestWorkflow()` with WorkflowDefinitionSchema validation
- [ ] Implement `createTestWorkflowStage()` with WorkflowStageSchema validation
- [ ] Implement bulk creation helpers

### Phase 2: Add exports and documentation
- [ ] Update package exports (package.json or index.ts)
- [ ] Add JSDoc documentation to all functions
- [ ] Create unit tests for fixtures module

### Phase 3: Verify integration
- [ ] Ensure `npm run build` passes
- [ ] Ensure `npm run test` passes
- [ ] Update relevant test files to use new fixtures (optional migration)

## Related ADRs

- **ADR-054**: Database Fixtures and SQLite Test Utilities (existing seed functions)
- **ADR-008**: Parallel Test Execution Utilities

## References

- Task interface: `packages/core/src/types.ts` line 4538
- AgentDefinitionSchema: `packages/core/src/types.ts` line 56
- WorkflowDefinitionSchema: `packages/core/src/types.ts` line 1999
- Existing createMockTask: `packages/orchestrator/src/test-utils.ts` line 559
- DatabaseSeeder: `packages/orchestrator/src/test-utils.ts` line 640
