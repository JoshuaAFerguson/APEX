# ADR-066: Container Workspace Configuration Validation

## Status
Proposed

## Context

APEX supports multiple workspace isolation strategies including `container`, `worktree`, `directory`, and `none`. When users configure the container strategy in their `.apex/config.yaml`, there are several potential misconfigurations that can lead to confusing runtime errors:

1. **Container runtime not available**: User configures `container` strategy but Docker/Podman is not installed or not running
2. **No image specified**: User selects `container` strategy but forgets to specify the container image
3. **Invalid container configuration**: User provides malformed container settings

Currently, these issues are discovered at task execution time rather than at configuration loading time, leading to poor user experience.

## Decision

We will implement a comprehensive workspace configuration validation system with the following components:

### 1. New Validation Module (`workspace-config-validator.ts`)

Create a new module in `@apex/core` that provides:

```typescript
// packages/core/src/workspace-config-validator.ts

export interface WorkspaceValidationResult {
  valid: boolean;
  errors: WorkspaceValidationError[];
  warnings: WorkspaceValidationWarning[];
}

export interface WorkspaceValidationError {
  code: WorkspaceValidationErrorCode;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface WorkspaceValidationWarning {
  code: WorkspaceValidationWarningCode;
  message: string;
  field?: string;
  suggestion?: string;
}

export type WorkspaceValidationErrorCode =
  | 'CONTAINER_RUNTIME_UNAVAILABLE'
  | 'CONTAINER_IMAGE_REQUIRED'
  | 'INVALID_WORKSPACE_STRATEGY'
  | 'CONTAINER_CONFIG_INVALID';

export type WorkspaceValidationWarningCode =
  | 'CONTAINER_IMAGE_NOT_SPECIFIED'
  | 'CONTAINER_RUNTIME_SLOW'
  | 'CONTAINER_NO_RESOURCE_LIMITS';

export async function validateWorkspaceConfig(
  config: ApexConfig,
  options?: WorkspaceValidationOptions
): Promise<WorkspaceValidationResult>;
```

### 2. Error Messages

Design clear, actionable error messages:

| Error Code | Message Template |
|------------|-----------------|
| `CONTAINER_RUNTIME_UNAVAILABLE` | "Container strategy requires Docker or Podman, but no container runtime is available. Install Docker (https://docker.com) or Podman (https://podman.io), or change workspace.defaultStrategy to 'worktree' or 'none'." |
| `CONTAINER_IMAGE_REQUIRED` | "Container workspace strategy is selected but no container image is specified. Add workspace.container.image to your config (e.g., 'node:20-alpine') or change workspace.defaultStrategy to 'worktree'." |

### 3. Warning Messages

Design helpful warning messages:

| Warning Code | Message Template |
|--------------|-----------------|
| `CONTAINER_IMAGE_NOT_SPECIFIED` | "Container strategy is configured but no default image is set. Tasks will need to specify an image, or add workspace.container.image to set a project default." |
| `CONTAINER_NO_RESOURCE_LIMITS` | "Container workspace has no resource limits configured. Consider setting workspace.container.resourceLimits for predictable resource usage." |

### 4. Integration with Config Loading

Modify `loadConfig()` in `config.ts` to optionally validate workspace configuration:

```typescript
export async function loadConfig(
  projectPath: string,
  options?: {
    validateWorkspace?: boolean;
    skipRuntimeCheck?: boolean;  // For testing environments
  }
): Promise<ApexConfig>;
```

When `validateWorkspace: true`:
- Validate workspace configuration
- Throw `WorkspaceConfigValidationError` for errors
- Log warnings using a provided logger or console

### 5. Schema Refinements

Add Zod refinements to existing schemas for semantic validation:

```typescript
// Add to WorkspaceDefaultsSchema
export const WorkspaceDefaultsSchema = z.object({
  defaultStrategy: WorkspaceStrategySchema.optional().default('none'),
  cleanupOnComplete: z.boolean().optional().default(true),
  container: ContainerDefaultsSchema.optional(),
}).refine(
  (data) => {
    // If strategy is 'container', container config is recommended
    if (data.defaultStrategy === 'container') {
      return true; // Allow, but validation will add warning
    }
    return true;
  },
  {
    message: "Container strategy selected but no container configuration provided",
  }
);
```

### 6. Custom Error Class

```typescript
export class WorkspaceConfigValidationError extends Error {
  constructor(
    public readonly errors: WorkspaceValidationError[],
    public readonly warnings: WorkspaceValidationWarning[] = []
  ) {
    const errorMessages = errors.map(e => e.message).join('\n');
    super(`Workspace configuration validation failed:\n${errorMessages}`);
    this.name = 'WorkspaceConfigValidationError';
  }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     loadConfig()                             │
│                         │                                    │
│                         ▼                                    │
│              ┌──────────────────────┐                        │
│              │  YAML Parse + Zod    │                        │
│              │  Schema Validation   │                        │
│              └──────────────────────┘                        │
│                         │                                    │
│                         ▼                                    │
│              ┌──────────────────────┐                        │
│              │  validateWorkspace   │                        │
│              │     Config()         │                        │
│              └──────────────────────┘                        │
│                         │                                    │
│         ┌───────────────┼───────────────┐                    │
│         ▼               ▼               ▼                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │  Strategy   │ │  Container  │ │  Runtime    │            │
│  │  Validation │ │  Config     │ │  Detection  │            │
│  │             │ │  Validation │ │  (optional) │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│         │               │               │                    │
│         └───────────────┼───────────────┘                    │
│                         ▼                                    │
│              ┌──────────────────────┐                        │
│              │  ValidationResult    │                        │
│              │  {errors, warnings}  │                        │
│              └──────────────────────┘                        │
│                         │                                    │
│              ┌──────────┴──────────┐                         │
│              ▼                     ▼                         │
│     ┌─────────────┐       ┌─────────────┐                    │
│     │   Errors?   │       │  Warnings?  │                    │
│     │    Throw    │       │    Log      │                    │
│     └─────────────┘       └─────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Validation Module
1. Create `packages/core/src/workspace-config-validator.ts`
2. Implement `WorkspaceValidationResult` types
3. Implement `validateWorkspaceConfig()` function
4. Add unit tests for all validation scenarios

### Phase 2: Integration with ContainerRuntime
1. Modify validation to use existing `ContainerRuntime` class
2. Add async runtime detection with caching
3. Handle edge cases (Docker not started, permission errors)

### Phase 3: Config Loading Integration
1. Update `loadConfig()` to accept validation options
2. Create `WorkspaceConfigValidationError` class
3. Add integration tests

### Phase 4: CLI Integration
1. Add validation during `apex init`
2. Add `--validate` flag to `apex status`
3. Display warnings with appropriate styling

## Files to Create/Modify

### New Files
- `packages/core/src/workspace-config-validator.ts` - Main validation module
- `packages/core/src/__tests__/workspace-config-validator.test.ts` - Unit tests
- `packages/core/src/__tests__/workspace-config-validator.integration.test.ts` - Integration tests

### Modified Files
- `packages/core/src/config.ts` - Add validation option to `loadConfig()`
- `packages/core/src/index.ts` - Export new module
- `packages/core/src/types.ts` - Add validation types (if not in validator module)

## Validation Rules

### Errors (Prevent Configuration Load)

| Rule | Condition | Error Code |
|------|-----------|------------|
| Runtime Required | `strategy === 'container' && !runtimeAvailable` | `CONTAINER_RUNTIME_UNAVAILABLE` |
| Image Required | `strategy === 'container' && !container?.image && strictMode` | `CONTAINER_IMAGE_REQUIRED` |

### Warnings (Log but Continue)

| Rule | Condition | Warning Code |
|------|-----------|--------------|
| No Default Image | `strategy === 'container' && !container?.image` | `CONTAINER_IMAGE_NOT_SPECIFIED` |
| No Resource Limits | `strategy === 'container' && !container?.resourceLimits` | `CONTAINER_NO_RESOURCE_LIMITS` |

## Testing Strategy

1. **Unit Tests**: Test each validation rule in isolation
2. **Integration Tests**: Test full validation flow with mock runtime
3. **Edge Cases**:
   - Runtime available but slow to respond
   - Runtime available but Docker daemon not running
   - Partial container configuration
   - Strategy transition scenarios

## Backwards Compatibility

- Validation is opt-in via `validateWorkspace: true` option
- Default behavior remains unchanged
- Warnings don't prevent configuration loading
- Errors can be bypassed with `skipRuntimeCheck: true`

## Security Considerations

- Runtime detection uses existing `ContainerRuntime` class (already audited)
- No new system access required
- Error messages don't leak sensitive information

## Performance Considerations

- Container runtime detection is cached (5-minute default)
- Validation adds minimal overhead (<100ms for first call)
- Subsequent validations use cached runtime info

## Consequences

### Positive
- Early detection of configuration errors
- Clear, actionable error messages
- Reduced debugging time for users
- Better onboarding experience

### Negative
- Slight increase in config loading time when validation enabled
- Additional maintenance burden for validation rules
- Risk of false positives if runtime detection is flaky

## References

- [ADR-063: Container Manager Architecture](./ADR-063-container-manager-architecture.md)
- [ADR-064: Container Manager EventEmitter3 Refactoring](./ADR-064-container-manager-eventemitter3-refactoring.md)
- [Container Runtime Detection](../packages/core/src/container-runtime.ts)
