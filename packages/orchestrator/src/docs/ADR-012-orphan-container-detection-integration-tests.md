# ADR-012: Orphan Container Detection Integration Tests

## Status
Proposed

## Date
2025-01-27

## Context

The task is to add integration tests for orphan container detection. Based on the existing codebase analysis at `/Users/s0v3r1gn/APEX/packages/orchestrator/src/__tests__/container-orphan-detection.integration.test.ts`, a well-structured integration test file already exists that provides significant coverage.

### Current Implementation State

The existing test file covers:
1. **Task Completion Cleanup** - Tests for `task:completed` event cleanup triggers
2. **Task Failure Cleanup** - Tests for `task:failed` event with `preserveOnFailure` support
3. **Task Cancellation Cleanup** - Tests for cancelled task cleanup
4. **Orphan Detection Utilities** - Tests for the `checkForOrphanedContainers` helper function
5. **Configuration Changes During Runtime** - Tests for dynamic config changes

### Existing Architecture Components

1. **ContainerManager** (`@apexcli/core/container-manager.ts`)
   - `listApexContainers(runtimeType, includeExited)` - Lists APEX containers by naming convention
   - Container naming uses prefix `apex-` with separator `-`
   - Supports Docker and Podman runtimes
   - Emits container lifecycle events: `container:created`, `container:started`, `container:stopped`, `container:died`, `container:removed`

2. **WorkspaceManager** (`packages/orchestrator/src/workspace-manager.ts`)
   - `cleanupWorkspace(taskId)` - Cleans up workspace for a task
   - Tracks active workspaces with container IDs
   - Integrates with ContainerManager for container lifecycle

3. **ApexOrchestrator** (`packages/orchestrator/src/index.ts`)
   - `setupAutomaticWorkspaceCleanup()` - Sets up event handlers for cleanup
   - Emits `orphan:detected` and `orphan:recovered` events
   - Handles `task:completed`, `task:failed`, and cancellation cleanup
   - `shouldPreserveOnFailure(task)` - Determines if workspace should be preserved

4. **ContainerRuntime** (`@apexcli/core/container-runtime.ts`)
   - `getBestRuntime()` - Returns 'docker', 'podman', or 'none'

## Decision

### Test Architecture

The integration tests should be structured into the following test suites to ensure comprehensive coverage:

#### 1. Orphan Detection Utility Tests
**Location**: `checkForOrphanedContainers` helper function tests

| Test Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| `handles container runtime unavailability` | Runtime is 'none' | Returns `{hasOrphans: false, orphanedContainers: [], totalApexContainers: 0}` |
| `detects running APEX containers as orphans` | Containers with `apex-` prefix in 'running' state | Returns orphan list with container names |
| `detects created APEX containers as orphans` | Containers with `apex-` prefix in 'created' state | Returns orphan list with container names |
| `ignores exited containers` | Containers in 'exited' state | Not included in orphan list |
| `filters by APEX naming convention` | Only `apex-` or `apex-task-` prefixed | Other containers excluded |
| `handles listApexContainers errors gracefully` | ContainerManager throws error | Returns `{hasOrphans: false, orphanedContainers: [], totalApexContainers: 0}` |

#### 2. Orchestrator Lifecycle Event Integration Tests
**Focus**: Integration with orchestrator event system

| Test Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| `calls cleanup on task:completed` | Single task completion | `cleanupWorkspace` called with task ID |
| `handles concurrent task:completed events` | Multiple simultaneous completions | All cleanups called |
| `calls cleanup on task:failed with preserveOnFailure=false` | Task failure without preservation | `cleanupWorkspace` called |
| `preserves workspace on task:failed with preserveOnFailure=true` | Task failure with preservation | `cleanupWorkspace` NOT called, log written |
| `respects global config fallback` | Task without explicit preserveOnFailure | Uses `git.worktree.preserveOnFailure` |
| `cleans up on task cancellation` | `cancelTask()` called | `cleanupWorkspace` called |
| `emits orphan:detected event` | Orphans found at startup | Event emitted with task list |
| `emits orphan:recovered event` | Orphan cleanup performed | Event emitted with recovery details |

#### 3. Container Runtime Graceful Degradation Tests
**Focus**: Handling missing container runtime

| Test Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| `operates without runtime (none)` | No Docker/Podman installed | Tests complete without errors |
| `skips container-specific tests without runtime` | Use `it.skipIf(!hasContainerRuntime)` | Tests skip gracefully |
| `fallback to directory workspace` | Container creation fails | Falls back to directory strategy |

#### 4. Container Naming Convention Validation Tests
**Focus**: APEX container identification

| Test Case | Description | Expected Behavior |
|-----------|-------------|-------------------|
| `identifies apex-* containers` | Container named `apex-123` | Detected as APEX container |
| `identifies apex-task-* containers` | Container named `apex-task-456` | Detected as APEX container |
| `excludes non-APEX containers` | Container named `other-container` | Not detected as APEX |
| `extracts task ID from container name` | Container `apex-taskId` | Task ID extracted correctly |

### Test Implementation Pattern

```typescript
describe('Container Orphan Detection Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;
  let containerManager: ContainerManager;
  let runtimeType: ContainerRuntimeType;
  let hasContainerRuntime: boolean;

  beforeAll(async () => {
    // Detect container runtime once for all tests
    runtimeType = await containerRuntime.getBestRuntime();
    hasContainerRuntime = runtimeType !== 'none';

    if (hasContainerRuntime) {
      containerManager = new ContainerManager();
    }
  });

  beforeEach(async () => {
    // Reset mocks and create orchestrator
    vi.clearAllMocks();
    // ... setup mocks
    await orchestrator.initialize();
  });

  // Test suites follow...
});
```

### Mock Strategy

The tests use comprehensive mocking to:
1. **Mock TaskStore** - Avoid database operations
2. **Mock WorkspaceManager** - Track cleanup calls without actual cleanup
3. **Mock Claude Agent SDK** - Prevent API calls
4. **Real ContainerManager** (conditional) - Use real container operations when runtime is available

### Configuration Hierarchy Testing

The tests verify the `preserveOnFailure` configuration precedence:
1. **Task-level** (`task.workspace.preserveOnFailure`) - Highest priority
2. **Strategy-specific** (`git.worktree.preserveOnFailure` for worktrees)
3. **Default** (`false`) - Lowest priority

## Consequences

### Positive
- Comprehensive coverage of orphan detection scenarios
- Graceful handling of missing container runtime
- Clear separation between unit and integration concerns
- Consistent with existing test patterns in the codebase

### Negative
- Integration tests require container runtime for full coverage
- Tests may be slower due to real container operations (when available)

### Dependencies
- `@apexcli/core`: ContainerManager, ContainerRuntime, containerRuntime singleton
- `packages/orchestrator`: ApexOrchestrator, WorkspaceManager, TaskStore
- `vitest`: Test framework with `it.skipIf` support

## Files to Modify/Create

### Already Exists (Review/Enhance)
- `packages/orchestrator/src/__tests__/container-orphan-detection.integration.test.ts`

### Related Test Files for Reference
- `packages/orchestrator/src/container-cleanup-integration.test.ts`
- `packages/orchestrator/src/container-cleanup-on-failure.test.ts`
- `packages/orchestrator/src/container-cleanup-edge-cases.test.ts`
- `packages/orchestrator/src/container-cleanup-performance.test.ts`
- `packages/orchestrator/src/__tests__/container-cleanup-comprehensive.integration.test.ts`

## Acceptance Criteria Verification

| Criteria | Status | Location |
|----------|--------|----------|
| Orphan detection utility correctly identifies APEX containers | Covered | `describe('Orphan Detection Utilities')` |
| Handles missing container runtime gracefully | Covered | `it('should handle container runtime unavailability gracefully')` |
| Integration with orchestrator lifecycle events | Covered | `describe('Task Completion Cleanup')`, `describe('Task Failure Cleanup')`, `describe('Task Cancellation Cleanup')` |
| Tests pass | To verify | Run `npm run test` |

## Test File Structure Summary

```
packages/orchestrator/src/__tests__/
└── container-orphan-detection.integration.test.ts
    ├── Task Completion Cleanup
    │   ├── should call workspace cleanup when task completes successfully
    │   └── should handle multiple concurrent task completions
    ├── Task Failure Cleanup
    │   ├── should cleanup container when task fails with preserveOnFailure=false
    │   └── should preserve container when task fails with preserveOnFailure=true
    ├── Task Cancellation Cleanup
    │   └── should cleanup container when task is cancelled
    ├── Orphan Detection Utilities
    │   ├── should handle container runtime unavailability gracefully
    │   ├── should detect container runtime and verify no orphans after lifecycle
    │   └── should verify container naming convention detection
    └── Configuration Changes During Runtime
        └── should respect configuration changes for subsequent failures
```

## Conclusion

The existing test file at `container-orphan-detection.integration.test.ts` already provides comprehensive coverage for the orphan container detection feature. The architecture is well-designed with proper mocking, graceful degradation for missing container runtime, and thorough testing of the orchestrator lifecycle integration.

The technical design documents the existing architecture and provides a reference for future enhancements or modifications to the orphan detection testing strategy.
