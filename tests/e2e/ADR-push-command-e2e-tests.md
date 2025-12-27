# ADR: E2E Tests for Push Command with Real Git Operations

## Status
Proposed

## Context

The APEX CLI provides a `/push` command that pushes task branches to a remote repository. Currently, there are unit tests and integration tests for the push command, but comprehensive E2E tests with real git operations are missing.

### Existing Test Coverage

1. **Unit Tests** (`packages/cli/src/__tests__/push-command.test.ts`):
   - Command registration and validation
   - Mock orchestrator interactions
   - Error handling scenarios

2. **Integration Tests** (`packages/cli/src/__tests__/push-command.integration.test.ts`):
   - Real orchestrator with temporary git repos
   - Database integration
   - Basic failure scenarios

3. **Partial ID Tests** (`packages/cli/src/__tests__/push-command.partial-id.test.ts`):
   - 8/12-character partial ID matching
   - Full ID backward compatibility
   - Edge cases for ID resolution

4. **Git Commands E2E** (`tests/e2e/git-commands.e2e.test.ts`):
   - Repository setup, branch management, git state verification
   - Existing push test exists but only tests for failure scenario (no remote)

### Gap Analysis

Missing E2E test coverage:
- **Push to remote works**: Successful push with bare remote repository
- **Push with partial task IDs**: E2E verification of partial ID resolution
- **Push failure scenarios**: No remote configured, branch doesn't exist on remote
- **Push output verification**: Correct success/error message display

## Decision

Create a new E2E test file specifically for push command tests that exercises the complete push flow with real git operations.

## Technical Design

### File Structure

```
tests/e2e/
├── git-commands.e2e.test.ts     # Existing comprehensive git tests
└── push-command.e2e.test.ts     # NEW: Dedicated push command E2E tests
```

### Test File: `push-command.e2e.test.ts`

#### Dependencies

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import type { Task } from '@apexcli/core';
```

#### Helper Functions (Reuse from git-commands.e2e.test.ts)

1. **`runGit(args, cwd)`**: Execute git commands with error handling
2. **`initGitRepo(repoPath, isBare)`**: Initialize git repos with proper config
3. **`createTestTask(overrides)`**: Create task objects for testing
4. **`createApexConfig(projectPath)`**: Set up APEX project structure
5. **`verifyGitState(repoPath)`**: Verify branch, status, and commits

#### Test Suites

### Suite 1: Push to Remote Works

```typescript
describe('E2E: Push Command - Remote Push Operations', () => {
  // Setup: bare remote + local repo with origin configured

  it('should successfully push task branch to configured remote', async () => {
    // 1. Initialize orchestrator
    // 2. Create task with branch
    // 3. Create and checkout feature branch
    // 4. Make commits
    // 5. Call orchestrator.pushTaskBranch(taskId)
    // 6. Verify remote has the branch (ls-remote)
    // Expected: result.success === true
  });

  it('should set upstream tracking after push', async () => {
    // Similar setup
    // Verify: git rev-parse --abbrev-ref @{upstream}
    // Expected: origin/{branchName}
  });

  it('should push multiple commits to remote', async () => {
    // Multiple commits before push
    // Verify all commits present on remote
  });
});
```

### Suite 2: Push with Partial Task IDs

```typescript
describe('E2E: Push Command - Partial Task ID Resolution', () => {
  it('should push when using 8-character partial task ID', async () => {
    // Create task with known ID
    // Use partial ID (first 8 chars) to push
    // Verify push succeeds
  });

  it('should push when using 12-character partial task ID', async () => {
    // Similar to above with 12-char prefix
  });

  it('should push with full task ID', async () => {
    // Backward compatibility test
  });

  it('should handle ambiguous partial IDs by selecting first match', async () => {
    // Create two tasks with similar ID prefixes
    // Push using ambiguous prefix
    // Verify first task's branch is pushed
  });
});
```

### Suite 3: Push Failure Scenarios

```typescript
describe('E2E: Push Command - Failure Scenarios', () => {
  it('should handle push failure when no remote is configured', async () => {
    // Local repo without origin remote
    // Attempt push
    // Expected: result.success === false, result.error contains 'remote'
  });

  it('should handle push failure when remote repository is unreachable', async () => {
    // Configure non-existent remote URL
    // Attempt push
    // Expected: Graceful failure with error message
  });

  it('should handle push failure when branch does not exist locally', async () => {
    // Create task with branchName but don't create the branch
    // Attempt push
    // Expected: result.success === false
  });

  it('should handle push when task has no branch configured', async () => {
    // Create task without branchName
    // Attempt push
    // Expected: result.error === 'Task does not have a branch'
  });

  it('should handle push when git push is disabled in config', async () => {
    // Set effectiveConfig.git.pushAfterTask = false
    // Attempt push
    // Expected: result.success === false with appropriate message
  });

  it('should handle push failure when task does not exist', async () => {
    // Use non-existent task ID
    // Expected: result.error === 'Task not found: {taskId}'
  });
});
```

### Suite 4: Push Output Verification

```typescript
describe('E2E: Push Command - Output Verification', () => {
  it('should output correct success message with branch name', async () => {
    // Successful push
    // Verify console output contains branch name
    // Expected: "Successfully pushed {branchName} to origin"
  });

  it('should output correct error message for failed push', async () => {
    // Failed push scenario
    // Verify error message is descriptive
    // Expected: "Failed to push: {error}"
  });

  it('should display pushing progress message', async () => {
    // Before push
    // Verify: "Pushing branch {branchName} to remote..."
  });

  it('should return remoteBranch in successful result', async () => {
    // Verify result.remoteBranch === "origin/{branchName}"
  });
});
```

### Test Setup Requirements

#### Per-Test Environment

Each test needs:
1. **Temporary local git repository** with proper git config (user.name, user.email)
2. **Temporary bare remote repository** to act as origin
3. **APEX configuration** in `.apex/config.yaml`
4. **ApexOrchestrator instance** pointing to local repo
5. **Initial commit** on main branch

#### Setup Code Template

```typescript
let testDir: string;
let bareRepoDir: string;
let orchestrator: ApexOrchestrator;

beforeEach(async () => {
  // Create temp directories
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-push-e2e-'));
  bareRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-push-bare-'));

  // Setup bare remote
  await initGitRepo(bareRepoDir, true);

  // Setup local repo
  await initGitRepo(testDir);
  await createApexConfig(testDir);
  await runGit(`remote add origin ${bareRepoDir}`, testDir);

  // Initial commit and push to establish main
  await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
  await runGit('add README.md', testDir);
  await runGit('commit -m "Initial commit"', testDir);
  await runGit('push -u origin main', testDir);

  // Initialize orchestrator with push enabled
  orchestrator = new ApexOrchestrator({ projectPath: testDir });
  await orchestrator.initialize();

  // Enable push after task for E2E tests
  (orchestrator as any).effectiveConfig.git.pushAfterTask = true;

  // Mock build/test validation to always pass
  (orchestrator as any).validateBuildAndTests = async () => ({ success: true });
});

afterEach(async () => {
  try {
    await orchestrator?.cleanup?.();
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm(bareRepoDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Cleanup failed:', error);
  }
});
```

### Configuration for E2E Push Tests

The push command uses `gitPushTask()` which:
1. Checks `effectiveConfig.git.pushAfterTask` - **must be true** for push to work
2. Validates build and tests via `validateBuildAndTests()` - **must be mocked to succeed**
3. Executes `git push -u origin {branchName}`

For E2E tests, we need to:
- Set `pushAfterTask: true` in effectiveConfig
- Mock `validateBuildAndTests` to return `{ success: true }`

### Integration with CLI Commands

To test the full CLI flow (not just orchestrator):
```typescript
import { commands } from '@apexcli/cli';

const pushCommand = commands.find(cmd => cmd.name === 'push');
await pushCommand.handler(mockContext, [taskId]);
```

### Acceptance Criteria Mapping

| Criterion | Test Suite | Test Case |
|-----------|------------|-----------|
| Push to remote works | Suite 1 | `should successfully push task branch...` |
| Push with partial task IDs works | Suite 2 | `should push when using 8-character...` |
| Push failure - no remote | Suite 3 | `should handle push failure when no remote...` |
| Push failure - no branch | Suite 3 | `should handle push when task has no branch...` |
| Push output is correct | Suite 4 | All output verification tests |
| All push tests pass | All | Vitest should report 0 failures |

## Consequences

### Positive

- Comprehensive E2E coverage for push command
- Real git operations validate actual behavior
- Partial ID resolution tested in realistic scenario
- Error handling verified with actual git errors
- Test patterns reusable for other git commands

### Negative

- Increased test execution time (temp repo creation)
- Requires git binary on test environment
- Tests may be flaky on certain CI environments

### Mitigation

- Use `beforeEach`/`afterEach` for proper cleanup
- Add timeouts for git operations
- Skip tests if git is not available
- Use temp directories in system temp folder

## Implementation Notes

1. **Import helpers from existing test file** or extract to shared module
2. **Follow existing patterns** in `git-commands.e2e.test.ts`
3. **Use vitest's describe/it/expect** for consistency
4. **Mock only validation**, not git operations (this is E2E)
5. **Verify git state** after each operation, not just orchestrator return values

## File to Create

`tests/e2e/push-command.e2e.test.ts`

## Dependencies

- No new npm packages required
- Uses existing test infrastructure
- Compatible with current vitest configuration
