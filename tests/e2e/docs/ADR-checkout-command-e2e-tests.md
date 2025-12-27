# ADR: E2E Tests for Checkout Command with Real Git Operations

## Status
Proposed

## Context

The APEX project includes a `/checkout` command that manages git worktrees for task isolation. This command provides three main functionalities:
1. **Switch to task worktree** (`/checkout <task_id>`) - Switches to the worktree for a specific task
2. **List worktrees** (`/checkout --list`) - Lists all task worktrees
3. **Cleanup worktrees** (`/checkout --cleanup [<task_id>]`) - Removes orphaned/stale worktrees

The acceptance criteria requires E2E tests that verify:
- Checkout creates worktree
- Checkout --list shows worktrees
- Checkout --cleanup removes orphaned worktrees
- Checkout switches to correct branch
- All checkout tests pass

### Existing Infrastructure

The project already has well-established E2E test patterns in:
- `tests/e2e/git-commands.e2e.test.ts` (746 lines) - Comprehensive git operations testing
- `tests/e2e/merge-command.test.ts` (783 lines) - Merge command with real repositories

### Key Components

1. **WorktreeManager** (`packages/orchestrator/src/worktree-manager.ts`)
   - `createWorktree(taskId, branchName): Promise<string>`
   - `getWorktree(taskId): Promise<WorktreeInfo | null>`
   - `switchToWorktree(taskId): Promise<string>`
   - `deleteWorktree(taskId): Promise<boolean>`
   - `listWorktrees(): Promise<WorktreeInfo[]>`

2. **ApexOrchestrator Methods**
   - `getTaskWorktree(taskId)` - Retrieves worktree info for a task
   - `listTaskWorktrees()` - Lists all task worktrees
   - `switchToTaskWorktree(taskId)` - Switches to a task's worktree
   - `cleanupOrphanedWorktrees()` - Cleans up orphaned worktrees
   - `cleanupTaskWorktree(taskId)` - Cleans up a specific task's worktree

3. **Worktree Configuration**
   ```yaml
   git:
     autoWorktree: true
     worktree:
       cleanupOnComplete: true
       maxWorktrees: 5
       pruneStaleAfterDays: 7
       preserveOnFailure: false
   ```

## Decision

Create a new E2E test file at `tests/e2e/checkout-command.e2e.test.ts` that tests the checkout command with real git worktree operations.

### Test File Structure

```typescript
tests/e2e/checkout-command.e2e.test.ts
├── Helper Functions
│   ├── runGit(args, cwd) - Execute git commands
│   ├── initGitRepo(repoPath, isBare?) - Initialize git repository
│   ├── createTestTask(overrides?) - Create test task object
│   ├── createApexConfig(projectPath) - Create APEX configuration with worktree enabled
│   └── verifyWorktreeState(repoPath) - Verify worktree configuration
│
├── E2E: Checkout Command Worktree Operations
│   ├── Worktree Creation Tests
│   │   ├── should create worktree when task is started with autoWorktree enabled
│   │   ├── should create worktree in correct location (.apex-worktrees/task-{id})
│   │   └── should create worktree with correct branch name
│   │
│   ├── Worktree Listing Tests (--list)
│   │   ├── should list all task worktrees
│   │   ├── should show correct worktree information (path, branch, status)
│   │   └── should handle empty worktree list
│   │
│   ├── Worktree Cleanup Tests (--cleanup)
│   │   ├── should remove orphaned worktrees
│   │   ├── should cleanup specific task worktree with task_id
│   │   └── should handle cleanup when no orphaned worktrees exist
│   │
│   └── Worktree Switching Tests
│       ├── should switch to correct worktree for task
│       ├── should return correct worktree path
│       └── should handle non-existent worktree gracefully
│
└── Error Cases and Edge Conditions
    ├── should handle max worktrees limit
    ├── should handle worktree creation failure
    └── should maintain repository integrity after operations
```

### Test Scenarios

#### 1. Worktree Creation Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Create worktree for new task | When task starts with autoWorktree enabled | `git worktree add` | Worktree directory exists, branch created |
| Worktree location | Verify correct path structure | `git worktree list` | Path is `.apex-worktrees/task-{taskId}` |
| Branch naming | Verify branch naming convention | `git branch --list` | Branch follows `apex/{task-id}-{slug}` pattern |

#### 2. Worktree Listing Tests (--list)

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| List all worktrees | Show all active task worktrees | `git worktree list --porcelain` | All worktrees displayed with correct info |
| Worktree details | Show path, branch, status, timestamps | - | Each worktree shows taskId, branch, path |
| Empty list | Handle no worktrees gracefully | - | "No task worktrees found" message |

#### 3. Worktree Cleanup Tests (--cleanup)

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Cleanup orphaned | Remove stale worktrees | `git worktree remove`, `git worktree prune` | Orphaned worktrees removed |
| Cleanup specific task | Remove worktree for specific task | `git worktree remove` | Task's worktree removed |
| No orphans | Handle cleanup when none exist | - | "No orphaned worktrees found" message |

#### 4. Worktree Switching Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Switch to task worktree | Navigate to task's worktree | - | Returns correct worktree path |
| Verify correct branch | Ensure on correct branch | `git rev-parse --abbrev-ref HEAD` | Current branch matches task's branch |
| Non-existent worktree | Handle missing worktree | - | "No worktree found for task" error |

### Helper Functions Design

```typescript
/**
 * Helper function to run git commands with error handling
 */
async function runGit(args: string, cwd: string): Promise<{ stdout: string; stderr: string; success: boolean }>

/**
 * Helper function to initialize a git repository with worktree support
 */
async function initGitRepo(repoPath: string, isBare = false): Promise<void>

/**
 * Helper function to create a test task
 */
function createTestTask(overrides: Partial<Task> = {}): Task

/**
 * Helper function to create APEX config with worktree management enabled
 */
async function createApexConfig(projectPath: string): Promise<void>

/**
 * Helper function to verify worktree state
 */
async function verifyWorktreeState(repoPath: string): Promise<{
  worktrees: WorktreeInfo[];
  mainWorktree: string;
  taskWorktrees: WorktreeInfo[];
}>
```

### Test Setup and Teardown Pattern

```typescript
describe('E2E: Checkout Command with Real Git Worktree Operations', () => {
  let testDir: string;
  let worktreeBaseDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // 1. Create temp directories
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-checkout-e2e-'));
    worktreeBaseDir = path.join(testDir, '..', '.apex-worktrees');

    // 2. Initialize git repository
    await initGitRepo(testDir);

    // 3. Create APEX config with worktree management enabled
    await createApexConfig(testDir);

    // 4. Create initial commit
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
    await runGit('add README.md', testDir);
    await runGit('commit -m "Initial commit"', testDir);

    // 5. Initialize orchestrator with worktree support
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    try {
      await orchestrator?.cleanup?.();
      // Clean up worktrees first
      await runGit('worktree prune', testDir);
      await fs.rm(testDir, { recursive: true, force: true });
      if (worktreeBaseDir) {
        await fs.rm(worktreeBaseDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });
});
```

### Configuration Requirements

The test configuration must enable worktree management:

```yaml
version: 0.4.0
project:
  name: checkout-e2e-test-project
  language: typescript
  description: E2E test project for checkout command
autonomy:
  default: full
models:
  planning: sonnet
  implementation: sonnet
  review: haiku
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 1.0
  dailyBudget: 10.0
api:
  url: http://localhost:3000
  port: 3000
git:
  defaultBranch: main
  branchPrefix: apex/
  autoWorktree: true  # CRITICAL: Must be enabled
  commitFormat: conventional
  worktree:
    cleanupOnComplete: true
    maxWorktrees: 5
    pruneStaleAfterDays: 7
    preserveOnFailure: false
```

## Implementation Plan

### Phase 1: Core Worktree Creation Tests
1. Test worktree creation when starting a task
2. Verify worktree directory structure
3. Verify branch creation and naming

### Phase 2: Worktree Listing Tests (--list)
1. Test listing multiple worktrees
2. Test empty worktree list handling
3. Verify worktree information display

### Phase 3: Worktree Cleanup Tests (--cleanup)
1. Test orphaned worktree cleanup
2. Test specific task worktree cleanup
3. Verify cleanup of stale worktrees

### Phase 4: Worktree Switching Tests
1. Test switching to task worktree
2. Verify correct branch after switch
3. Test error handling for missing worktrees

### Phase 5: Edge Cases and Error Handling
1. Max worktrees limit handling
2. Worktree creation failure handling
3. Repository integrity verification

## Expected Test Count

Based on the acceptance criteria and test scenarios:
- **Worktree Creation**: 3-4 tests
- **Worktree Listing**: 3-4 tests
- **Worktree Cleanup**: 4-5 tests
- **Worktree Switching**: 3-4 tests
- **Error Cases**: 3-4 tests

**Total: ~16-21 test cases**

## Consequences

### Positive
- Comprehensive coverage of checkout command with real git operations
- Tests verify actual worktree creation, not just mocked responses
- Follows established E2E testing patterns in the project
- Tests cover all acceptance criteria

### Negative
- Tests require git worktree support (git >= 2.5)
- Tests may be slower due to real filesystem operations
- Cleanup must be thorough to avoid disk space issues

### Risks
- Worktree operations can fail on some filesystems
- Tests must handle concurrent execution carefully
- Cleanup failures may leave orphaned directories

## Related Files

### Source Files
- `packages/orchestrator/src/worktree-manager.ts` - WorktreeManager implementation
- `packages/orchestrator/src/index.ts` - ApexOrchestrator worktree methods
- `packages/cli/src/index.ts` - CLI checkout command registration

### Existing Test Files
- `tests/e2e/git-commands.e2e.test.ts` - Reference for E2E patterns
- `tests/e2e/merge-command.test.ts` - Reference for merge E2E patterns
- `packages/cli/src/__tests__/checkout-command.test.ts` - Unit tests

### New Test File
- `tests/e2e/checkout-command.e2e.test.ts` - New E2E test file

## References

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- Existing E2E test patterns in `tests/e2e/`
- WorktreeManager implementation in `packages/orchestrator/src/worktree-manager.ts`
