# ADR-066: Container Resource Limits Config Merging

## Status
Proposed

## Context

The APEX project has a workspace isolation feature that supports container-based execution. Currently:

1. **`getEffectiveConfig()` in `packages/core/src/config.ts`** returns merged defaults for most config sections, but **does not include the `workspace` section** in its return object (lines 269-343).

2. **`ApexConfig` includes `workspace: WorkspaceDefaultsSchema.optional()`** (line 322 in types.ts), which defines:
   - `defaultStrategy: WorkspaceStrategySchema` - Default isolation strategy (`'worktree' | 'container' | 'directory' | 'none'`)
   - `cleanupOnComplete: boolean` - Whether to cleanup workspace after task completion
   - `container: ContainerDefaultsSchema` - Default container configuration

3. **`WorkspaceManager`** currently receives `defaultStrategy` from the orchestrator (line 261 in index.ts):
   ```typescript
   this.workspaceManager = new WorkspaceManager({
     projectPath: this.projectPath,
     defaultStrategy: this.effectiveConfig.workspace?.strategy || 'none',
   });
   ```

4. The **`WorkspaceManager.createContainerWorkspace()`** method builds container configuration from the task's workspace config, but does not merge with global defaults.

## Problem Statement

Task-level container configuration should be able to:
1. Inherit default resource limits from the project's global workspace configuration
2. Override specific settings at the task level while keeping others from defaults
3. Have `getEffectiveConfig()` return workspace defaults for consistency with other config sections

## Decision

### 1. Update `getEffectiveConfig()` to Include Workspace Defaults

Add the `workspace` section to `getEffectiveConfig()` with proper defaults:

```typescript
// In packages/core/src/config.ts - getEffectiveConfig function
workspace: {
  defaultStrategy: config.workspace?.defaultStrategy || 'none',
  cleanupOnComplete: config.workspace?.cleanupOnComplete ?? true,
  container: {
    image: config.workspace?.container?.image,
    resourceLimits: config.workspace?.container?.resourceLimits,
    networkMode: config.workspace?.container?.networkMode || 'bridge',
    environment: config.workspace?.container?.environment,
    autoRemove: config.workspace?.container?.autoRemove ?? true,
    installTimeout: config.workspace?.container?.installTimeout,
  },
},
```

### 2. Update WorkspaceManager to Receive Full Workspace Defaults

Modify `WorkspaceManagerOptions` interface:

```typescript
// In packages/orchestrator/src/workspace-manager.ts
export interface WorkspaceManagerOptions {
  projectPath: string;
  defaultStrategy: WorkspaceConfig['strategy'];
  containerDefaults?: ContainerDefaults; // NEW: Global container defaults
}
```

### 3. Implement Config Merging in WorkspaceManager

Update `createContainerWorkspace()` to merge global defaults with task-level config:

```typescript
private async createContainerWorkspace(task: Task, config: WorkspaceConfig): Promise<string> {
  // Merge global container defaults with task-specific config
  const mergedContainerConfig: ContainerConfig = {
    // Global defaults (lowest priority)
    ...this.containerDefaults,
    // Task-specific overrides (highest priority)
    ...config.container,
    // Deep merge for nested objects
    resourceLimits: {
      ...this.containerDefaults?.resourceLimits,
      ...config.container?.resourceLimits,
    },
    environment: {
      ...this.containerDefaults?.environment,
      ...config.container?.environment,
    },
    // Required fields from task config
    image: config.container?.image || this.containerDefaults?.image || 'node:20-alpine',
  };

  // ... rest of container creation logic
}
```

### 4. Update Orchestrator to Pass Container Defaults

```typescript
// In packages/orchestrator/src/index.ts - initialize()
this.workspaceManager = new WorkspaceManager({
  projectPath: this.projectPath,
  defaultStrategy: this.effectiveConfig.workspace.defaultStrategy,
  containerDefaults: this.effectiveConfig.workspace.container,
});
```

## Merge Priority (Lowest to Highest)

1. **Schema Defaults** - Defined in Zod schemas (`ContainerDefaultsSchema`, `ResourceLimitsSchema`)
2. **Project Config** - `.apex/config.yaml` workspace.container settings
3. **Task Config** - Task-specific workspace.container overrides

This ensures task-level settings always take precedence while falling back to project defaults.

## Type Definitions

The existing types already support this architecture:

```typescript
// ContainerDefaults - Project-level defaults (workspace.container in config.yaml)
export const ContainerDefaultsSchema = z.object({
  image: z.string().optional(),
  resourceLimits: ResourceLimitsSchema.optional(),
  networkMode: ContainerNetworkModeSchema.optional(),
  environment: z.record(z.string(), z.string()).optional(),
  autoRemove: z.boolean().optional().default(true),
  installTimeout: z.number().positive().optional(),
});

// ContainerConfig - Full container configuration for task execution
export const ContainerConfigSchema = z.object({
  image: z.string().min(1),
  // ... all container options including resourceLimits
});
```

## Files to Modify

1. **`packages/core/src/config.ts`**
   - Add `workspace` section to `getEffectiveConfig()` return object

2. **`packages/orchestrator/src/workspace-manager.ts`**
   - Update `WorkspaceManagerOptions` interface to include `containerDefaults`
   - Implement config merging in `createContainerWorkspace()`

3. **`packages/orchestrator/src/index.ts`**
   - Update `WorkspaceManager` instantiation to pass `containerDefaults`

## Testing Strategy

1. **Unit Tests** (`packages/core/src/config.test.ts`)
   - Test `getEffectiveConfig()` returns workspace defaults
   - Test workspace config merging behavior

2. **Integration Tests** (`packages/orchestrator/src/__tests__/`)
   - Test WorkspaceManager receives and uses container defaults
   - Test task-level overrides take precedence
   - Test deep merging of nested objects (resourceLimits, environment)

## Example Configuration

```yaml
# .apex/config.yaml
workspace:
  defaultStrategy: container
  cleanupOnComplete: true
  container:
    image: node:20-alpine
    resourceLimits:
      cpu: 2
      memory: "2g"
    networkMode: bridge
    environment:
      NODE_ENV: development
```

Task-level override:
```typescript
const task: Task = {
  // ...
  workspace: {
    strategy: 'container',
    cleanup: true,
    container: {
      image: 'node:20-alpine',
      resourceLimits: {
        memory: "4g",  // Override: 4g instead of 2g default
        // cpu inherits 2 from defaults
      },
    },
  },
};
```

## Consequences

### Positive
- Consistent config handling across all sections via `getEffectiveConfig()`
- DRY principle: define defaults once, override when needed
- Clear merge priority: task > project > schema defaults
- Backwards compatible: existing configs work unchanged

### Negative
- Slightly more complex config merging logic
- Need to handle deep merging for nested objects

## Implementation Checklist

- [ ] Update `getEffectiveConfig()` to include workspace section
- [ ] Update `WorkspaceManagerOptions` interface
- [ ] Implement config merging in `createContainerWorkspace()`
- [ ] Update orchestrator to pass container defaults
- [ ] Add unit tests for getEffectiveConfig workspace
- [ ] Add integration tests for config merging
- [ ] Update existing tests if needed
- [ ] Run `npm run build` to verify no type errors
- [ ] Run `npm run test` to verify all tests pass
