# ADR-067: Container Execution Context in WorkspaceInfo

## Status
Proposed

## Date
2024-12-26

## Context

The APEX orchestrator manages containerized workspaces for task execution through the `WorkspaceManager` class. Currently, when a container is created for a task:

1. The container ID is only available during container creation in `createContainerWorkspace()`
2. The container ID is not persisted to `WorkspaceInfo`
3. Other parts of the system cannot easily retrieve the container ID for a running task
4. External consumers need to query containers by name pattern (e.g., `apex-task-{taskId}`)

This creates friction when:
- Monitoring container health for specific tasks
- Executing commands in task containers
- Forwarding container events to orchestrator events
- Managing container lifecycle from CLI or API

## Decision

### 1. Add `containerId` field to `WorkspaceInfo` interface

**Location**: `packages/orchestrator/src/workspace-manager.ts`

```typescript
export interface WorkspaceInfo {
  taskId: string;
  config: WorkspaceConfig;
  workspacePath: string;
  status: 'active' | 'cleanup-pending' | 'cleaned';
  createdAt: Date;
  lastAccessed: Date;
  containerId?: string;  // NEW: Container ID for container strategy workspaces
}
```

**Rationale**:
- The field is optional (`containerId?`) because not all workspace strategies use containers
- It follows the existing pattern of optional fields in `WorkspaceInfo`
- JSON serialization/deserialization will naturally handle the optional field

### 2. Store container ID when creating container workspaces

**Location**: `createContainerWorkspace()` in `WorkspaceManager`

After container creation succeeds, the container ID from `ContainerManager.createContainer()` result should be stored in the workspace info before it's added to `activeWorkspaces`.

```typescript
// After successful container creation
if (result.containerId) {
  workspaceInfo.containerId = result.containerId;
}
```

### 3. Add `getContainerIdForTask(taskId)` method

**Location**: `packages/orchestrator/src/workspace-manager.ts`

```typescript
/**
 * Get the active container ID for a task
 * @param taskId The task ID to look up
 * @returns The container ID if the task has an active container workspace, null otherwise
 */
getContainerIdForTask(taskId: string): string | null {
  const workspace = this.activeWorkspaces.get(taskId);
  if (!workspace || workspace.status !== 'active') {
    return null;
  }
  return workspace.containerId || null;
}
```

**Rationale**:
- Synchronous method since data is already in memory
- Returns `null` for:
  - Non-existent workspaces
  - Non-active workspaces (cleanup-pending, cleaned)
  - Non-container workspaces (worktree, directory, none strategies)
- Simple, focused API that does one thing well

## Implementation Details

### Changes Required

1. **WorkspaceInfo interface** (`workspace-manager.ts:27-34`)
   - Add optional `containerId?: string` field

2. **createContainerWorkspace method** (`workspace-manager.ts:381-461`)
   - Store `result.containerId` in workspace info after successful creation
   - The creation logic already returns `containerId` from `ContainerManager.createContainer()`

3. **New getContainerIdForTask method**
   - Add after `getWorkspace()` method for logical grouping
   - Simple lookup with null-safety

4. **loadActiveWorkspaces method** (`workspace-manager.ts:638-661`)
   - No changes needed - JSON.parse naturally handles optional fields

5. **saveWorkspaceInfo method** (`workspace-manager.ts:663-668)
   - No changes needed - JSON.stringify naturally handles optional fields

### Test Requirements

Add unit tests in `packages/orchestrator/src/__tests__/`:

1. **WorkspaceInfo type tests** - Verify containerId field is properly typed
2. **Container workspace creation** - Verify containerId is stored after creation
3. **getContainerIdForTask tests**:
   - Returns container ID for active container workspace
   - Returns null for non-existent task
   - Returns null for non-active workspace
   - Returns null for non-container strategy workspace
4. **Persistence tests** - Verify containerId survives save/load cycle

## Alternatives Considered

### Alternative 1: Query ContainerManager by task ID
Could use `ContainerManager.listApexContainers()` and filter by task label, but:
- Requires async operation for simple lookup
- Adds unnecessary overhead
- Container might be in transition state

### Alternative 2: Maintain separate taskId->containerId map
Could add a separate `Map<string, string>` for container IDs, but:
- Duplicates state management
- Requires additional synchronization logic
- Adds complexity without clear benefit

### Alternative 3: Store container ID in Task object
Could add containerId to the Task type in core, but:
- Task type is domain-focused (what to do)
- WorkspaceInfo is execution-focused (how it's running)
- Violates separation of concerns

## Consequences

### Positive
- Simple, direct access to container ID for any task
- No additional async operations needed
- Natural fit with existing WorkspaceInfo data model
- Enables downstream features (shell commands, monitoring)

### Negative
- Slight increase in WorkspaceInfo serialized size (negligible)
- Need to ensure containerId is cleared/updated if container is recreated

### Risks
- Container ID becomes stale if container is removed externally
  - Mitigation: Workspace cleanup already handles container removal
  - Mitigation: Container health monitoring detects dead containers

## References

- `packages/orchestrator/src/workspace-manager.ts` - WorkspaceManager implementation
- `packages/core/src/container-manager.ts` - ContainerManager with containerId in results
- `packages/core/src/types.ts` - Core type definitions
- ADR-063: Container Manager Architecture
- ADR-064: Container Manager EventEmitter3 Refactoring
