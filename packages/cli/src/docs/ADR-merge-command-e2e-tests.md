# ADR: Merge Command End-to-End Tests with Real Git Operations

## Status
Proposed

## Context

APEX requires comprehensive end-to-end (E2E) tests for the merge command that verify complete workflows using real git operations rather than mocked git commands. The acceptance criteria requires verification of:

1. Standard merge works correctly
2. Squash merge works correctly
3. Merge conflict detection and proper handling
4. Merge after push sequence
5. Merge correctly updates the main branch

### Current State Analysis

1. **Existing Test Infrastructure**:
   - `packages/cli/src/__tests__/push-command.e2e.test.ts` - Comprehensive E2E tests for push command
   - `tests/e2e/git-commands.e2e.test.ts` - E2E tests for git operations
   - `packages/orchestrator/src/merge-task-branch.test.ts` - Unit tests for merge functionality
   - `packages/orchestrator/src/merge-task-branch-edge-cases.test.ts` - Edge case unit tests
   - `packages/cli/src/__tests__/merge-command.test.ts` - CLI command unit tests

2. **Core Implementation**:
   - `mergeTaskBranch()` method in `ApexOrchestrator` (lines 4603-4780)
   - CLI merge command handler in `packages/cli/src/index.ts`
   - `MergeTaskBranchResult` interface with `success`, `error`, `conflicted`, `changedFiles` fields

3. **Key E2E Patterns from Push Command Tests**:
   - Creates temporary local and bare remote repositories
   - Uses `execSync` for real git operations
   - Mocks chalk for clean test output
   - Captures console output for validation
   - Uses real `ApexOrchestrator` instances
   - Cleans up temp directories after tests

## Decision

### 1. Test File Location

Create new E2E test file at:
```
packages/cli/src/__tests__/merge-command.e2e.test.ts
```

This follows the established pattern of placing E2E tests alongside unit tests in the `__tests__` directory, with `.e2e.test.ts` suffix to distinguish them.

### 2. Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Merge Command E2E Test Suite                    │
├─────────────────────────────────────────────────────────────────┤
│  Setup Layer (beforeEach)                                       │
│  ├── Create temp local git repository                           │
│  ├── Create temp bare remote repository                         │
│  ├── Initialize git with user config                            │
│  ├── Create initial commit on main branch                       │
│  ├── Set up remote origin                                       │
│  ├── Push main to remote                                        │
│  ├── Create APEX config                                         │
│  └── Initialize ApexOrchestrator                                │
├─────────────────────────────────────────────────────────────────┤
│  Helper Functions                                               │
│  ├── createTaskWithBranch() - Create task with feature branch   │
│  ├── createConflictingBranches() - Set up merge conflict        │
│  ├── getCurrentBranch() - Get current git branch                │
│  ├── getGitLog() - Get commit history                           │
│  ├── getChangedFiles() - Get files changed in last commit       │
│  ├── verifyMergeCommit() - Check merge commit exists            │
│  └── remoteBranchExists() - Verify remote branch state          │
├─────────────────────────────────────────────────────────────────┤
│  Test Groups                                                    │
│  ├── Core Merge Functionality (AC: standard merge works)        │
│  ├── Squash Merge Functionality (AC: squash merge works)        │
│  ├── Merge Conflict Detection (AC: conflict detection)          │
│  ├── Merge After Push Sequence (AC: merge after push)           │
│  └── Main Branch Update Verification (AC: updates main)         │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Test Scenarios

#### 3.1 Core Merge Functionality Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Standard merge with full task ID | Merge feature branch to main | checkout, merge --no-ff | Merge commit exists, files merged |
| Standard merge with partial ID | Resolve partial ID, merge | checkout, merge --no-ff | Correct task resolved |
| Merge creates proper commit | Verify merge commit format | git log | Commit message contains branch name |
| Changed files tracked correctly | Verify changedFiles array | git diff --name-only | Files match expected |

#### 3.2 Squash Merge Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Squash merge with --squash flag | Squash all commits | merge --squash, commit | Single commit, no merge commit |
| Squash merge with -s flag | Short flag test | merge --squash | Same as --squash |
| Squash commit message format | Verify message structure | git log -1 | Contains task desc, Claude co-author |
| Squash preserves file changes | All files included | git diff --name-only | All feature files present |

#### 3.3 Merge Conflict Detection Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Conflict detection and abort | Create conflict, attempt merge | merge (fails), abort | Result.conflicted = true |
| Repository clean after conflict | Abort leaves clean state | git status --porcelain | Empty status |
| Conflict error message | Verify helpful guidance | Console output | Contains resolution steps |
| Multiple file conflicts | Complex conflict scenario | Multiple files conflict | All conflicts detected |

#### 3.4 Merge After Push Sequence Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Merge after successful push | Push then merge | push, merge | Both operations succeed |
| Merge updates main after push | Main reflects push | git log | Merge commit on main |
| Remote stays consistent | Remote has merged content | ls-remote | Branch refs correct |
| Merge of already pushed branch | Push first, then merge | push, merge | Clean merge |

#### 3.5 Main Branch Update Verification Tests

| Test Case | Description | Git Operations | Assertions |
|-----------|-------------|----------------|------------|
| Main branch updated | Verify HEAD moved | git rev-parse HEAD | New commit hash |
| Feature files on main | Files accessible on main | fs.access | Feature files exist |
| Commit history preserved | History shows merge | git log | Merge in history |
| Branch pointer correct | Main points to merge | git show-ref | Correct ref |

### 4. Implementation Details

#### 4.1 Test Setup Pattern

```typescript
// Setup structure following push-command.e2e.test.ts pattern
beforeEach(async () => {
  // Create temp directories
  tempProjectPath = join(tmpdir(), `apex-merge-e2e-${Date.now()}`);
  tempRemotePath = join(tmpdir(), `apex-merge-e2e-remote-${Date.now()}`);
  await mkdir(tempProjectPath, { recursive: true });
  await mkdir(tempRemotePath, { recursive: true });

  // Initialize bare remote
  execSync('git init --bare', { cwd: tempRemotePath, stdio: 'ignore' });

  // Initialize local with proper config
  execSync('git init', { cwd: tempProjectPath, stdio: 'ignore' });
  execSync('git config user.name "E2E Test User"', { cwd: tempProjectPath });
  execSync('git config user.email "e2e@test.dev"', { cwd: tempProjectPath });

  // Initial commit and remote setup
  await writeFile(join(tempProjectPath, 'README.md'), '# Test Project\n');
  execSync('git add .', { cwd: tempProjectPath, stdio: 'ignore' });
  execSync('git commit -m "Initial commit"', { cwd: tempProjectPath, stdio: 'ignore' });
  execSync('git branch -M main', { cwd: tempProjectPath, stdio: 'ignore' });
  execSync(`git remote add origin ${tempRemotePath}`, { cwd: tempProjectPath });
  execSync('git push -u origin main', { cwd: tempProjectPath, stdio: 'ignore' });

  // APEX setup
  const apexDir = join(tempProjectPath, '.apex');
  await mkdir(apexDir, { recursive: true });
  await writeFile(join(apexDir, 'config.yaml'), apexConfigYaml);

  // Initialize orchestrator
  realOrchestrator = new ApexOrchestrator({ projectPath: tempProjectPath });
  await realOrchestrator.initialize();
});
```

#### 4.2 Key Helper Functions

```typescript
// Create task with actual git branch
async function createTaskWithBranch(
  orchestrator: ApexOrchestrator,
  projectPath: string,
  description: string,
  files: { name: string; content: string }[] = []
): Promise<{ task: Task; branchName: string }>;

// Create conflicting changes on two branches
async function createConflictingBranches(
  projectPath: string,
  branchName: string,
  conflictFileName: string
): Promise<void>;

// Verify merge commit exists in history
function verifyMergeCommit(
  projectPath: string,
  branchName: string
): boolean;

// Get changed files from last commit
function getChangedFiles(projectPath: string): string[];
```

#### 4.3 Merge Command Access

```typescript
// Get merge command from commands array
const mergeCommand = commands.find(cmd => cmd.name === 'merge');

// Execute merge via command handler
await mergeCommand!.handler(mockContext, [taskId, '--squash']);
```

### 5. Test Execution Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     E2E Test Execution Flow                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  1. beforeEach: Create isolated test environment                  │
│     - Temp directories for local repo and bare remote            │
│     - Real git repository with proper config                     │
│     - APEX configuration and ApexOrchestrator instance           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. Test Execution                                                │
│     - Create task with real git branch                           │
│     - Perform merge operation via CLI command handler            │
│     - Capture console output for validation                      │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Verification                                                  │
│     - Check git state (branch, commits, files)                   │
│     - Verify console output messages                             │
│     - Validate result object properties                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. afterEach: Cleanup                                           │
│     - Restore console.log                                        │
│     - Remove temp directories                                    │
│     - Clean up orchestrator resources                            │
└──────────────────────────────────────────────────────────────────┘
```

### 6. Acceptance Criteria Mapping

| Acceptance Criteria | Test Group | Key Test Cases |
|---------------------|------------|----------------|
| Standard merge works | Core Merge Functionality | Standard merge with full/partial ID |
| Squash merge works | Squash Merge Functionality | Squash with --squash and -s flags |
| Merge conflict detection | Conflict Detection | Conflict detection, abort, error message |
| Merge after push sequence | Merge After Push | Push then merge, remote consistency |
| Merge updates main correctly | Main Branch Update | HEAD moved, files on main, history |

### 7. File Structure

```
packages/cli/src/__tests__/
├── merge-command.e2e.test.ts       # NEW: E2E tests with real git
├── merge-command.test.ts           # Existing: Unit tests (mocked)
├── merge-command-integration.test.ts  # Existing: Integration tests
├── merge-command-validation.test.ts   # Existing: Validation tests
└── push-command.e2e.test.ts        # Reference: Pattern to follow
```

### 8. Dependencies

- **vitest** - Test framework
- **fs/promises** - File system operations
- **child_process** - Git command execution
- **@apexcli/orchestrator** - ApexOrchestrator class
- **@apexcli/core** - Task type definitions

### 9. Error Handling Strategy

| Error Scenario | Detection | Test Behavior |
|----------------|-----------|---------------|
| Git command fails | execSync throws | Catch, verify error handling |
| Merge conflicts | Result.conflicted | Verify abort and clean state |
| Task not found | Result.error | Verify error message |
| No branch on task | Result.error | Verify proper error |
| Non-git directory | Git status fails | Verify graceful failure |

## Consequences

### Positive
- Comprehensive validation of merge functionality with real git operations
- Tests cover all acceptance criteria explicitly
- Follows established patterns from push-command.e2e.test.ts
- Isolated test environments prevent interference
- Validates complete workflow from CLI to git operations

### Negative
- E2E tests are slower than unit tests
- Requires disk I/O for temp directories
- Git operations may have timing sensitivities
- Cleanup failures can leave temp files

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Flaky tests from timing | Use explicit waits, avoid race conditions |
| Temp dir cleanup failures | Use force cleanup, handle errors gracefully |
| Git version differences | Test on minimum supported git version |
| Platform differences | Test on multiple platforms in CI |

## Implementation Checklist

- [ ] Create `merge-command.e2e.test.ts` file structure
- [ ] Implement test setup (beforeEach) with git/APEX initialization
- [ ] Implement helper functions for task/branch creation
- [ ] Implement Core Merge Functionality tests
- [ ] Implement Squash Merge Functionality tests
- [ ] Implement Merge Conflict Detection tests
- [ ] Implement Merge After Push Sequence tests
- [ ] Implement Main Branch Update Verification tests
- [ ] Verify `npm run build` passes
- [ ] Verify `npm run test` passes
- [ ] Document test coverage mapping to acceptance criteria
