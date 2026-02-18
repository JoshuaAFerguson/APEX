# ADR 0015: Mock Factories Architecture for Core Domain Types

## Status
Proposed

## Context
APEX requires comprehensive test fixtures and mock factories for all core domain types defined in `packages/core/src/types.ts`. These factories need to:

1. Generate valid, typed objects that conform to Zod schemas
2. Support partial overrides for test customization
3. Provide sensible defaults for all required fields
4. Be consistent with existing factory patterns in the codebase
5. Enable easy testing across all APEX packages

### Current State
Some factories already exist in `packages/core/src/test-fixtures/factories/`:
- `task-factory.ts` - Has incorrect `TaskUsage` type structure
- `agent-factory.ts` - Complete implementation for `AgentDefinition`
- `workflow-factory.ts` - Complete implementation for `WorkflowDefinition`, `WorkflowStage`, `WorkflowGate`
- `tool-factory.ts` - Implementations for `ToolResult`, `ToolExecution`, `ToolInvocation`
- `autonomy-factory.ts` - `AutonomyConfig` and related types
- `config-factory.ts` - `ProjectConfig` and integrated configurations
- `permission-factory.ts` - Permission-related types

### Missing or Incomplete Factories
1. **Task factory type alignment** - `TaskUsage` uses incorrect structure
2. **Core Zod schema types** - Need factories that produce schema-valid objects:
   - `TaskArtifact` (interface, not Zod but defined in types.ts)
   - `TaskLog` (interface)
   - `IsolationConfig` (Zod schema)
   - `ToolDefinition` (Zod schema)
   - `ToolExecution` (Zod schema)
   - `FileSnapshot` (Zod schema)
   - `ToolAction` (Zod schema)
   - `ApprovalGate` (Zod schema)
   - `ApprovalState` (needs research)

## Decision

### Factory Design Pattern
All factories will follow this consistent pattern:

```typescript
/**
 * Factory function signature
 */
export type FixtureFactory<T, TOptions = Record<string, unknown>> = (
  overrides?: Partial<T>,
  options?: TOptions
) => T;

/**
 * Example implementation
 */
export const createFoo: FixtureFactory<Foo, FooFactoryOptions> = (
  overrides = {},
  options = {}
): Foo => {
  return {
    // Required fields with sensible defaults
    id: `foo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    requiredField: 'default-value',

    // Optional fields based on options
    ...(options.includeOptional && { optionalField: 'value' }),

    // Apply overrides last
    ...overrides,
  };
};
```

### Schema Validation
For Zod schema-based types, factories will:
1. Generate objects that pass schema validation
2. Use schema defaults where available
3. Provide explicit defaults for required fields without schema defaults

### Factory Categories

#### 1. Task Domain Factories (Fix and Enhance)
- `createTaskUsage()` - Fix to match actual `TaskUsage` interface
- `createTaskLog()` - Create `TaskLog` interface objects
- `createTaskArtifact()` - Create `TaskArtifact` interface objects

#### 2. Tool Domain Factories (New)
- `createToolDefinition()` - `ToolDefinitionSchema` compliant
- `createToolParameter()` - `ToolParameterSchema` compliant
- `createFileSnapshot()` - `FileSnapshotSchema` compliant
- `createToolAction()` - `ToolActionSchema` compliant
- `createToolActionSnapshot()` - `ToolActionSnapshotSchema` compliant

#### 3. Isolation Domain Factories (New)
- `createIsolationConfig()` - `IsolationConfigSchema` compliant
- `createContainerConfig()` - `ContainerConfigSchema` compliant

#### 4. Approval Domain Factories (Enhance)
- `createApprovalState()` - Approval state tracking

### File Organization

```
packages/core/src/test-fixtures/factories/
├── index.ts                 # Barrel exports
├── task-factory.ts          # Task, TaskUsage, TaskLog, TaskArtifact
├── agent-factory.ts         # AgentDefinition (existing)
├── workflow-factory.ts      # WorkflowDefinition, Stage, Gate (existing)
├── tool-factory.ts          # ToolResult, ToolExecution, ToolInvocation (existing)
├── tool-definition-factory.ts  # ToolDefinition, ToolParameter (NEW)
├── tool-action-factory.ts      # FileSnapshot, ToolAction, ToolActionSnapshot (NEW)
├── autonomy-factory.ts      # AutonomyConfig (existing)
├── config-factory.ts        # ProjectConfig, integrated configs (existing)
├── permission-factory.ts    # Permission types (existing)
└── isolation-factory.ts     # IsolationConfig, ContainerConfig (NEW)
```

### Testing Strategy
Each factory file should have corresponding test coverage:
- Validate generated objects against Zod schemas
- Test partial override behavior
- Test option flags
- Test preset collections

## Consequences

### Positive
- Consistent factory patterns across all domain types
- Schema-validated test data
- Easy customization via overrides
- Comprehensive test coverage enabled
- Clear separation of concerns

### Negative
- Some refactoring needed for existing factories with type mismatches
- Additional maintenance burden for keeping factories in sync with type changes

### Risks
- Breaking existing tests that depend on current factory implementations
- Mitigation: Provide backward-compatible aliases where needed

## Implementation Plan

1. **Phase 1: Fix Task Factory** (Priority: High)
   - Update `TaskUsage` structure to match interface
   - Add `TaskLog` and `TaskArtifact` factories

2. **Phase 2: New Tool Factories** (Priority: High)
   - Create `tool-definition-factory.ts`
   - Create `tool-action-factory.ts`

3. **Phase 3: Isolation Factory** (Priority: Medium)
   - Create `isolation-factory.ts`

4. **Phase 4: Update Exports** (Priority: High)
   - Update `factories/index.ts` with new exports
   - Ensure backward compatibility

5. **Phase 5: Tests** (Priority: High)
   - Add comprehensive tests for all new factories
   - Validate against Zod schemas

## References
- Existing factory implementations in `packages/core/src/test-fixtures/factories/`
- Type definitions in `packages/core/src/types.ts`
- Factory type definitions in `packages/core/src/test-fixtures/types.ts`
