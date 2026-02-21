# ADR-004: Mock Factories for Core Domain Types

## Status
Proposed

## Date
2025-02-13

## Context

The APEX codebase has a comprehensive type system defined in `packages/core/src/types.ts` with Zod schemas for validation. There's an existing `packages/core/src/test-utils.ts` file with mock factories for Permission-related types, but it lacks factories for core domain types essential for testing:

- **Task** - The fundamental unit of work in APEX
- **AgentDefinition** - AI agent configuration
- **WorkflowDefinition** - Multi-stage automated process definitions
- **WorkflowStage** - Individual workflow stage configuration
- **WorkflowGate** - Approval checkpoints in workflows
- **TaskUsage** - Resource tracking for task execution
- **TaskLog** - Task execution logging
- **TaskArtifact** - Generated outputs from tasks
- **IsolationConfig** - Task isolation settings
- **AutonomyConfig** - Autonomy level configuration

Without mock factories, tests must manually construct complex objects with all required fields, leading to verbose tests and maintenance burden when schemas change.

## Decision

We will extend `packages/core/src/test-utils.ts` with mock factories for all core domain types, following the existing pattern of:

1. **Factory Functions**: `createMock<TypeName>(overrides?: Partial<TypeName>): TypeName`
2. **Partial Overrides**: All factories accept partial objects that merge with sensible defaults
3. **Zod Schema Compliance**: All mock objects validate against their Zod schemas
4. **Composable Design**: Complex types compose simpler mock factories

### Factory Design Pattern

```typescript
/**
 * Create a mock Task with sensible defaults
 *
 * @param overrides - Optional partial Task to override defaults
 * @returns A complete Task object suitable for testing
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  return {
    // Required fields with sensible defaults
    id,
    description: 'Mock task for testing',
    workflow: 'default',
    autonomy: 'review-before-commit',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/mock/project/path',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: now,
    updatedAt: now,
    usage: createMockTaskUsage(),
    logs: [],
    artifacts: [],
    // Allow all fields to be overridden
    ...overrides,
  };
}
```

### Proposed Factory Functions

#### Core Task Types
- `createMockTask(overrides?: Partial<Task>): Task`
- `createMockTaskUsage(overrides?: Partial<TaskUsage>): TaskUsage`
- `createMockTaskLog(overrides?: Partial<TaskLog>): TaskLog`
- `createMockTaskArtifact(overrides?: Partial<TaskArtifact>): TaskArtifact`
- `createMockSubtaskDefinition(overrides?: Partial<SubtaskDefinition>): SubtaskDefinition`

#### Agent Types
- `createMockAgentDefinition(overrides?: Partial<AgentDefinition>): AgentDefinition`

#### Workflow Types
- `createMockWorkflowDefinition(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition`
- `createMockWorkflowStage(overrides?: Partial<WorkflowStage>): WorkflowStage`
- `createMockWorkflowGate(overrides?: Partial<WorkflowGate>): WorkflowGate`
- `createMockIsolationConfig(overrides?: Partial<IsolationConfig>): IsolationConfig`

#### Autonomy Types
- `createMockAutonomyConfig(overrides?: Partial<AutonomyConfig>): AutonomyConfig`
- `createMockApprovalGate(overrides?: Partial<ApprovalGate>): ApprovalGate`
- `createMockTaskResourceLimits(overrides?: Partial<TaskResourceLimits>): TaskResourceLimits`

### Utility Functions

In addition to individual factories, we'll provide:

```typescript
// Create a complete workflow with stages
export function createMockWorkflowWithStages(
  workflowOverrides?: Partial<WorkflowDefinition>,
  stageCount?: number
): WorkflowDefinition

// Create a task with logs and artifacts
export function createMockTaskWithHistory(
  taskOverrides?: Partial<Task>,
  logCount?: number,
  artifactCount?: number
): Task

// Common testing scenarios
export function createCommonTaskScenarios(): {
  pendingTask: Task;
  runningTask: Task;
  completedTask: Task;
  failedTask: Task;
  pausedTask: Task;
}

export function createCommonWorkflowScenarios(): {
  simpleWorkflow: WorkflowDefinition;
  parallelWorkflow: WorkflowDefinition;
  gatedWorkflow: WorkflowDefinition;
}
```

## File Structure

```
packages/core/src/
├── test-utils.ts              # Extended with core domain mock factories
└── __tests__/
    └── mock-factories.test.ts # Tests validating mock factory correctness
```

## Consequences

### Positive
- **Reduced Test Verbosity**: Tests can focus on assertions, not object construction
- **Schema Evolution Resilience**: When types change, only factories need updating
- **Type Safety**: Factories return fully-typed objects validated against Zod schemas
- **Composability**: Complex mocks can be built from simpler factories
- **Consistency**: All tests use the same default values for predictability

### Negative
- **Maintenance Overhead**: Factories must be kept in sync with schema changes
- **Hidden Complexity**: Developers must understand default values to write effective tests

### Neutral
- **Learning Curve**: New contributors must learn the factory API

## Implementation Notes

1. **Type Imports**: Import types from `./types.js` using the ESM import pattern
2. **Date Handling**: Use `new Date()` for timestamps, allowing override for deterministic tests
3. **ID Generation**: Use predictable ID patterns for easier debugging
4. **Vitest Dependency**: File already depends on `vitest` for `vi` mock functions
5. **Validation**: Consider optional schema validation in factories for development builds

## Related ADRs
- ADR-001: Monorepo Structure (establishes package layout)
- ADR-002: Type System with Zod (establishes schema patterns)

## References
- Existing `test-utils.ts` mock factories for Permission types
- Zod schema definitions in `types.ts`
- Test-fixtures patterns in `test-fixtures/` directory
