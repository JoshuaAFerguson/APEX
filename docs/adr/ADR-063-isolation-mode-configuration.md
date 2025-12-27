# ADR-063: Isolation Mode Configuration

## Status

Proposed

## Context

APEX tasks need different levels of isolation depending on the workflow type and project requirements. Currently, the system has a `WorkspaceStrategy` type with values `'worktree' | 'container' | 'directory' | 'none'`, but there is no clear mapping to user-friendly isolation modes or per-workflow configuration.

### Current State

1. **WorkspaceStrategy** (`packages/core/src/types.ts`):
   ```typescript
   export const WorkspaceStrategySchema = z.enum(['worktree', 'container', 'directory', 'none']);
   export type WorkspaceStrategy = z.infer<typeof WorkspaceStrategySchema>;
   ```

2. **WorkspaceConfig** (`packages/core/src/types.ts`):
   ```typescript
   export const WorkspaceConfigSchema = z.object({
     strategy: WorkspaceStrategySchema,
     path: z.string().optional(),
     container: ContainerConfigSchema.optional(),
     cleanup: z.boolean(),
     preserveOnFailure: z.boolean().optional().default(false),
   });
   ```

3. **WorkspaceDefaults** (`packages/core/src/types.ts`):
   ```typescript
   export const WorkspaceDefaultsSchema = z.object({
     defaultStrategy: WorkspaceStrategySchema.optional().default('none'),
     cleanupOnComplete: z.boolean().optional().default(true),
     container: ContainerDefaultsSchema.optional(),
   });
   ```

4. **WorkspaceManager** (`packages/orchestrator/src/workspace-manager.ts`):
   - Already implements `createWorkspace()` with switch on `config.strategy`
   - Supports `worktree`, `container`, `directory`, and `none` strategies

5. **ApexOrchestrator** (`packages/orchestrator/src/index.ts`):
   - Creates workspace based on task's `workspace` property or `effectiveConfig.workspace.defaultStrategy`

### Problem Statement

Users need a simpler abstraction for isolation levels that maps to their development needs:
- **Full isolation** = Container + worktree (maximum security, reproducibility)
- **Worktree isolation** = Git worktree only (lightweight isolation, fast)
- **Shared** = No isolation, work in current project directory (current behavior)

Additionally, different workflows may require different isolation levels (e.g., `feature` workflow might need full isolation while `bugfix` might work with shared).

## Decision

Introduce an `IsolationMode` type and per-workflow isolation configuration that maps to the underlying `WorkspaceStrategy` values.

### 1. Type Definitions (packages/core/src/types.ts)

#### 1.1 Add IsolationMode Type

```typescript
// ============================================================================
// Isolation Mode Configuration (v0.4.0)
// ============================================================================

/**
 * Isolation mode determines the level of workspace isolation for task execution
 * - 'full': Maximum isolation using container + worktree (container runs in isolated worktree)
 * - 'worktree': Git worktree isolation only (fast, lightweight git-based isolation)
 * - 'shared': No isolation, work in current project directory (existing behavior)
 */
export const IsolationModeSchema = z.enum(['full', 'worktree', 'shared']);
export type IsolationMode = z.infer<typeof IsolationModeSchema>;

/**
 * Isolation configuration for workflows
 * Allows per-workflow isolation settings with fallback to global defaults
 */
export const IsolationConfigSchema = z.object({
  /** Default isolation mode for all workflows */
  default: IsolationModeSchema.optional().default('shared'),
  /** Per-workflow isolation mode overrides */
  overrides: z.record(z.string(), IsolationModeSchema).optional(),
});
export type IsolationConfig = z.infer<typeof IsolationConfigSchema>;
```

#### 1.2 Update ApexConfigSchema

Add isolation configuration to the main config schema:

```typescript
export const ApexConfigSchema = z.object({
  // ... existing fields ...

  /** Isolation mode configuration for task execution */
  isolation: IsolationConfigSchema.optional(),

  // ... rest of fields ...
});
```

#### 1.3 Update WorkflowDefinitionSchema

Add optional isolation mode to workflow definitions:

```typescript
export const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  trigger: z.array(z.string()).optional(),
  stages: z.array(WorkflowStageSchema),
  /** Override isolation mode for this specific workflow */
  isolation: IsolationModeSchema.optional(),
});
```

### 2. Isolation Mode to Strategy Mapping

Create a utility function to map isolation modes to workspace strategies:

```typescript
// packages/core/src/isolation.ts

import { IsolationMode, WorkspaceStrategy, WorkspaceConfig, ContainerConfig } from './types';

/**
 * Maps an IsolationMode to the corresponding WorkspaceStrategy
 */
export function mapIsolationModeToStrategy(mode: IsolationMode): WorkspaceStrategy {
  switch (mode) {
    case 'full':
      return 'container';  // Container strategy includes worktree internally
    case 'worktree':
      return 'worktree';
    case 'shared':
      return 'none';
    default:
      return 'none';
  }
}

/**
 * Creates a WorkspaceConfig from an IsolationMode
 */
export function createWorkspaceConfigFromMode(
  mode: IsolationMode,
  options?: {
    containerConfig?: ContainerConfig;
    cleanup?: boolean;
    preserveOnFailure?: boolean;
  }
): WorkspaceConfig {
  const strategy = mapIsolationModeToStrategy(mode);

  return {
    strategy,
    cleanup: options?.cleanup ?? true,
    preserveOnFailure: options?.preserveOnFailure ?? false,
    container: mode === 'full' ? options?.containerConfig : undefined,
  };
}

/**
 * Resolves the effective isolation mode for a workflow
 * Priority: workflow definition > workflow override > global default > 'shared'
 */
export function resolveIsolationMode(
  workflowName: string,
  workflowIsolation?: IsolationMode,
  isolationConfig?: IsolationConfig
): IsolationMode {
  // 1. Workflow definition has highest priority
  if (workflowIsolation) {
    return workflowIsolation;
  }

  // 2. Check per-workflow overrides in config
  if (isolationConfig?.overrides?.[workflowName]) {
    return isolationConfig.overrides[workflowName];
  }

  // 3. Fall back to global default
  return isolationConfig?.default ?? 'shared';
}
```

### 3. Configuration Integration (packages/core/src/config.ts)

#### 3.1 Update getEffectiveConfig()

```typescript
export function getEffectiveConfig(config: ApexConfig): Required<ApexConfig> {
  return {
    // ... existing fields ...

    isolation: {
      default: config.isolation?.default ?? 'shared',
      overrides: config.isolation?.overrides ?? {},
    },

    // ... rest of fields ...
  };
}
```

### 4. Orchestrator Integration (packages/orchestrator/src/index.ts)

#### 4.1 Update Task Creation

Modify `createTask()` to select isolation strategy based on workflow config:

```typescript
import { resolveIsolationMode, createWorkspaceConfigFromMode } from '@apexcli/core';

async createTask(options: {
  description: string;
  workflow?: string;
  // ... other options ...
}): Promise<Task> {
  // ... existing task creation logic ...

  const workflow = options.workflow || 'feature';

  // Load workflow definition to check for isolation override
  const workflowDef = await loadWorkflow(this.projectPath, workflow);

  // Resolve isolation mode from workflow and config
  const isolationMode = resolveIsolationMode(
    workflow,
    workflowDef?.isolation,
    this.effectiveConfig.isolation
  );

  // Create workspace config from isolation mode
  const workspaceConfig = createWorkspaceConfigFromMode(isolationMode, {
    containerConfig: this.effectiveConfig.workspace?.container,
    cleanup: this.effectiveConfig.workspace?.cleanupOnComplete ?? true,
    preserveOnFailure: false,
  });

  // ... continue with task creation using workspaceConfig ...
}
```

#### 4.2 Update executeTask()

Ensure the task runner uses the resolved workspace config:

```typescript
async executeTask(taskId: string, options?: { autoRetry?: boolean }): Promise<void> {
  // ... existing logic ...

  const task = await this.store.getTask(taskId);

  // Create workspace based on task's isolation config
  if (task.workspace?.strategy !== 'none') {
    const workspace = await this.workspaceManager.createWorkspace(task);

    // Update task with workspace path
    await this.store.updateTask(taskId, {
      workspace: {
        ...task.workspace,
        path: workspace.workspacePath,
      },
    });

    await this.store.addLog(taskId, {
      level: 'info',
      message: `Created ${task.workspace.strategy} workspace at ${workspace.workspacePath}`,
    });
  }

  // ... continue with task execution ...
}
```

### 5. Configuration Examples

#### 5.1 .apex/config.yaml

```yaml
version: "1.0"
project:
  name: my-project
  language: typescript

# Global isolation settings
isolation:
  default: shared  # Default for all workflows
  overrides:
    feature: full      # Features get full container+worktree isolation
    bugfix: worktree   # Bugfixes get worktree-only isolation
    refactor: worktree # Refactors get worktree-only isolation

# Container defaults for 'full' isolation mode
workspace:
  cleanupOnComplete: true
  container:
    image: "node:20-alpine"
    resourceLimits:
      cpu: 2
      memory: "2g"
```

#### 5.2 .apex/workflows/feature.yaml

```yaml
name: feature
description: Full feature implementation workflow
trigger:
  - manual
  - apex:feature

# Override isolation at workflow level
isolation: full

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    outputs:
      - implementation_plan
      - subtasks
  # ... rest of stages ...
```

### 6. Data Flow

```
Task Creation Request
    │
    ├─► Load workflow definition
    │       │
    │       └─► workflowDef.isolation (optional)
    │
    ├─► Resolve isolation mode:
    │       │
    │       ├─► 1. Check workflow definition
    │       ├─► 2. Check config.isolation.overrides[workflow]
    │       └─► 3. Fall back to config.isolation.default
    │
    ├─► Map isolation mode to workspace strategy:
    │       │
    │       ├─► 'full'     → 'container' (with worktree integration)
    │       ├─► 'worktree' → 'worktree'
    │       └─► 'shared'   → 'none'
    │
    ├─► Create WorkspaceConfig with:
    │       │
    │       ├─► strategy (from mapping)
    │       ├─► container config (if 'full' mode)
    │       └─► cleanup settings
    │
    └─► Store task with workspace config

Task Execution
    │
    ├─► If strategy !== 'none':
    │       │
    │       ├─► workspaceManager.createWorkspace(task)
    │       │
    │       └─► Update task with workspace path
    │
    ├─► Execute workflow stages in isolated workspace
    │
    └─► On completion:
            │
            └─► workspaceManager.cleanupWorkspace(taskId)
```

### 7. Full Isolation Mode Details

When `isolation: full` is selected, the system should:

1. **Create a git worktree** for the task branch
2. **Start a container** with the worktree mounted
3. **Execute task within the container**
4. **Sync changes back** to the worktree
5. **Cleanup both** container and worktree on completion

This requires enhancing the `WorkspaceManager.createContainerWorkspace()` to integrate worktree creation:

```typescript
private async createContainerWorkspace(task: Task, config: WorkspaceConfig, workspaceInfo: WorkspaceInfo): Promise<void> {
  // For 'full' isolation, first create a worktree
  let workspacePath: string;

  if (this.shouldUseWorktreeForContainer()) {
    // Create worktree first
    const branchName = task.branchName || `apex-${task.id}`;
    workspacePath = await this.createWorktreeWorkspace(task);
    workspaceInfo.warnings?.push('Using worktree-backed container isolation');
  } else {
    workspacePath = join(this.workspacesDir, `container-${task.id}`);
    await fs.mkdir(workspacePath, { recursive: true });
  }

  // Then create container with workspace mounted
  const mergedContainerConfig: ContainerConfig = {
    // ... merge config ...
    volumes: {
      [workspacePath]: '/workspace',  // Mount worktree or project
      ...config.container?.volumes,
    },
    // ...
  };

  // ... rest of container creation ...
}
```

### 8. Error Handling

- **Fallback behavior**: If container creation fails in 'full' mode, fall back to 'worktree' mode
- **Graceful degradation**: If worktree fails, fall back to 'shared' mode with warning
- **Validation**: Warn if 'full' mode is selected but no container runtime is available

```typescript
async createWorkspace(task: Task): Promise<WorkspaceInfo> {
  let config = task.workspace || {
    strategy: this.defaultStrategy,
    cleanup: true,
  };

  // Attempt creation with fallback
  try {
    return await this.createWorkspaceWithStrategy(task, config);
  } catch (error) {
    // Fallback chain: full → worktree → shared
    if (config.strategy === 'container') {
      console.warn(`Container workspace failed, falling back to worktree: ${error}`);
      return await this.createWorkspaceWithStrategy(task, { ...config, strategy: 'worktree' });
    }
    if (config.strategy === 'worktree') {
      console.warn(`Worktree workspace failed, falling back to shared: ${error}`);
      return await this.createWorkspaceWithStrategy(task, { ...config, strategy: 'none' });
    }
    throw error;
  }
}
```

## Consequences

### Positive

1. **Simplified User Mental Model**: Users think in terms of isolation levels, not implementation details
2. **Per-Workflow Customization**: Different workflows can have different isolation needs
3. **Graceful Fallback**: System degrades gracefully when isolation methods are unavailable
4. **Backward Compatible**: Default 'shared' mode preserves existing behavior
5. **Flexible Configuration**: Global defaults with workflow-specific overrides

### Negative

1. **Additional Abstraction Layer**: IsolationMode → WorkspaceStrategy mapping adds indirection
2. **Configuration Complexity**: More config options to understand
3. **Resource Usage**: 'full' mode uses more resources (container + worktree)

### Neutral

1. **Migration**: Existing configs work unchanged (defaults to 'shared')
2. **Documentation**: Need to document the three isolation modes clearly

## Implementation Checklist

### Core Package (packages/core)

1. [ ] Add `IsolationModeSchema` and `IsolationMode` type to `types.ts`
2. [ ] Add `IsolationConfigSchema` and `IsolationConfig` type to `types.ts`
3. [ ] Update `ApexConfigSchema` to include `isolation` field
4. [ ] Update `WorkflowDefinitionSchema` to include `isolation` field
5. [ ] Create `packages/core/src/isolation.ts` with mapping utilities
6. [ ] Update `getEffectiveConfig()` in `config.ts`
7. [ ] Export new types and utilities from package index
8. [ ] Add unit tests for isolation utilities

### Orchestrator Package (packages/orchestrator)

9. [ ] Update `createTask()` to resolve isolation mode
10. [ ] Update `executeTask()` to create workspace based on isolation
11. [ ] Enhance `WorkspaceManager` for 'full' isolation mode (worktree + container)
12. [ ] Add fallback logic for isolation mode degradation
13. [ ] Add integration tests for isolation modes

### CLI Package (packages/cli)

14. [ ] Update `init` command to include isolation config template
15. [ ] Add `--isolation` flag to `run` command for one-off override

### Documentation

16. [ ] Document isolation modes in user guide
17. [ ] Add configuration examples to README
18. [ ] Update workflow documentation with isolation field

## References

- WorkspaceStrategy type: `packages/core/src/types.ts` (line 635)
- WorkspaceManager: `packages/orchestrator/src/workspace-manager.ts`
- ApexOrchestrator: `packages/orchestrator/src/index.ts`
- ADR-051 Worktree Task Lifecycle: `docs/adr/ADR-051-worktree-task-lifecycle-integration.md`
