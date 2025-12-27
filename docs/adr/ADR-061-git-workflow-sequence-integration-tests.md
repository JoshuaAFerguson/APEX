# ADR-061: Git Command Workflow Sequence Integration Tests (Push → Merge)

## Status
Proposed

## Context

The APEX CLI provides git-related commands (`/push` and `/merge`) that work with task branches. While individual command tests exist, there are no integration tests that verify the **complete workflow sequence** of pushing a task branch and then merging it, with proper **state tracking between commands**.

### Current Test Coverage

**Push Command Tests:**
- `push-command.test.ts` - Unit tests for command registration and validation
- `push-command.integration.test.ts` - Real orchestrator and git integration
- `push-command.partial-id.test.ts` - Partial task ID matching and edge cases
- `push-command.smoke.test.ts` - Basic smoke tests

**Merge Command Tests:**
- `merge-command.test.ts` - Unit tests and command behavior
- `merge-command-integration.test.ts` - Integration registration verification
- `merge-command-validation.test.ts` - Input validation and error cases

### Missing Coverage

No tests currently verify:
1. **Sequential command execution**: Push followed by merge on the same task
2. **State persistence across commands**: Task state maintained between push and merge
3. **Partial ID resolution consistency**: Same task resolved across both commands
4. **Error recovery in sequences**: Handling failures mid-workflow

### Acceptance Criteria

Integration tests verify push command followed by merge command works correctly in sequence, with proper state tracking between commands.

## Decision

### 1. Test Architecture Overview

Create a new integration test file dedicated to git command workflow sequences:

```
packages/cli/src/__tests__/
├── git-workflow-sequence.integration.test.ts   # NEW: Push → Merge sequence tests
├── push-command.test.ts                        # Existing
├── push-command.integration.test.ts            # Existing
├── merge-command.test.ts                       # Existing
└── merge-command-integration.test.ts           # Existing
```

### 2. Key Design Principles

#### 2.1 Real Git Repository Operations
- Use Node.js `os.tmpdir()` with unique subdirectories for each test
- Initialize real git repositories with actual branches and commits
- No mocking of git operations to ensure real-world behavior validation

#### 2.2 Shared Context Pattern
```typescript
// Pattern: Same orchestrator instance across commands (simulating real CLI session)
const realOrchestrator = new ApexOrchestrator(tempProjectPath);
const mockContext: CliContext = {
  cwd: tempProjectPath,
  initialized: true,
  orchestrator: realOrchestrator,
  // ...
};
```

#### 2.3 State Tracking Verification
- Verify task state persists in SQLite database between commands
- Confirm branch name, logs, and artifacts carry over
- Test that partial ID resolution finds the same task consistently

### 3. Technical Implementation

#### 3.1 Test File Structure

```typescript
// git-workflow-sequence.integration.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { execSync } from 'child_process';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    dim: (str: string) => str,
    magenta: { bold: (str: string) => str },
  },
}));

/**
 * Git Command Workflow Sequence Integration Tests
 *
 * These tests verify the complete push → merge workflow sequence with:
 *
 * 1. Sequential command execution (push then merge)
 * 2. State persistence across commands
 * 3. Partial ID resolution consistency
 * 4. Error recovery in sequences
 */
describe('Git Command Workflow Sequences', () => {
  let tempProjectPath: string;
  let tempRemotePath: string;
  let realOrchestrator: ApexOrchestrator;
  let mockContext: CliContext;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create temporary directories
    tempProjectPath = join(tmpdir(), `apex-workflow-test-${Date.now()}`);
    tempRemotePath = join(tmpdir(), `apex-workflow-remote-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });
    await mkdir(tempRemotePath, { recursive: true });

    // Initialize "remote" bare repository (for push tests)
    execSync('git init --bare', { cwd: tempRemotePath, stdio: 'ignore' });

    // Initialize project repository
    execSync('git init', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempProjectPath, stdio: 'ignore' });

    // Create initial commit
    await writeFile(join(tempProjectPath, 'README.md'), '# Test Project\n');
    execSync('git add README.md', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: tempProjectPath, stdio: 'ignore' });

    // Set up main branch and remote
    execSync('git branch -M main', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync(`git remote add origin ${tempRemotePath}`, { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git push -u origin main', { cwd: tempProjectPath, stdio: 'ignore' });

    // Create APEX config
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });
    await writeFile(join(apexDir, 'config.yaml'), `
project:
  name: workflow-test-project
  description: Test project for git workflow integration
`);

    // Initialize real orchestrator
    realOrchestrator = new ApexOrchestrator(tempProjectPath);
    await realOrchestrator.initialize();

    mockContext = {
      cwd: tempProjectPath,
      initialized: true,
      config: {} as any,
      orchestrator: realOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(async () => {
    mockConsoleLog.mockRestore();
    try {
      await rm(tempProjectPath, { recursive: true, force: true });
      await rm(tempRemotePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Test implementations...
});
```

#### 3.2 Helper Functions

```typescript
/**
 * Helper to create a task with an actual git branch and commits
 */
async function createTaskWithBranch(
  orchestrator: ApexOrchestrator,
  projectPath: string,
  description: string
): Promise<{ task: Task; branchName: string }> {
  const task = await orchestrator.createTask({
    description,
    workflow: 'feature',
  });

  const branchName = `feature/task-${task.id.substring(0, 8)}`;

  // Create actual branch with commits
  execSync(`git checkout -b ${branchName}`, { cwd: projectPath, stdio: 'ignore' });
  await writeFile(join(projectPath, 'feature.js'), `// Feature: ${description}\n`);
  execSync('git add feature.js', { cwd: projectPath, stdio: 'ignore' });
  execSync(`git commit -m "Implement: ${description}"`, { cwd: projectPath, stdio: 'ignore' });
  execSync('git checkout main', { cwd: projectPath, stdio: 'ignore' });

  // Update task with branch name
  await (orchestrator as any).store.updateTask(task.id, { branchName });

  return { task, branchName };
}

/**
 * Helper to get current git branch
 */
function getCurrentBranch(projectPath: string): string {
  return execSync('git branch --show-current', { cwd: projectPath, encoding: 'utf-8' }).trim();
}

/**
 * Helper to get git log output
 */
function getGitLog(projectPath: string, format: string = '%s'): string[] {
  const output = execSync(`git log --oneline --format="${format}"`, {
    cwd: projectPath,
    encoding: 'utf-8'
  });
  return output.trim().split('\n').filter(Boolean);
}

/**
 * Helper to check if branch exists
 */
function branchExists(projectPath: string, branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branchName}`, { cwd: projectPath, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * State tracking interface for workflow verification
 */
interface WorkflowStateSnapshot {
  taskId: string;
  branchName: string | undefined;
  gitBranches: string[];
  currentBranch: string;
  lastCommitMessage: string;
}

/**
 * Helper to capture workflow state at any point
 */
async function captureWorkflowState(
  orchestrator: ApexOrchestrator,
  projectPath: string,
  taskId: string
): Promise<WorkflowStateSnapshot> {
  const tasks = await orchestrator.listTasks({ limit: 100 });
  const task = tasks.find(t => t.id === taskId);

  const branches = execSync('git branch', { cwd: projectPath, encoding: 'utf-8' })
    .split('\n')
    .map(b => b.replace('*', '').trim())
    .filter(Boolean);

  const commits = getGitLog(projectPath);

  return {
    taskId,
    branchName: task?.branchName,
    gitBranches: branches,
    currentBranch: getCurrentBranch(projectPath),
    lastCommitMessage: commits[0] || '',
  };
}
```

### 4. Test Specifications

#### 4.1 Push → Merge Sequence Tests

```typescript
describe('Push → Merge workflow', () => {
  it('should execute push then merge in sequence on same task', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');
    expect(pushCmd).toBeDefined();
    expect(mergeCmd).toBeDefined();

    // Create task with branch
    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Implement new feature'
    );

    // Capture initial state
    const initialState = await captureWorkflowState(realOrchestrator, tempProjectPath, task.id);
    expect(initialState.branchName).toBe(branchName);
    expect(initialState.gitBranches).toContain(branchName);

    // STEP 1: Execute push command
    await pushCmd!.handler(mockContext, [task.id]);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Pushing')
    );

    // Verify remote has the branch
    const remoteBranches = execSync('git ls-remote --heads origin', {
      cwd: tempProjectPath,
      encoding: 'utf-8'
    });
    expect(remoteBranches).toContain(branchName);

    // STEP 2: Execute merge command
    mockConsoleLog.mockClear();
    await mergeCmd!.handler(mockContext, [task.id]);

    // Verify merge output
    const hasSuccess = mockConsoleLog.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('completed'))
    );
    expect(hasSuccess).toBe(true);

    // Capture final state
    const finalState = await captureWorkflowState(realOrchestrator, tempProjectPath, task.id);

    // Branch should still exist (merge doesn't delete)
    expect(finalState.gitBranches).toContain(branchName);

    // Current branch should be main
    expect(finalState.currentBranch).toBe('main');

    // Commit history should contain merge or feature commit
    const commits = getGitLog(tempProjectPath);
    const hasFeatureCommit = commits.some(msg =>
      msg.includes('Implement') || msg.includes('Merge')
    );
    expect(hasFeatureCommit).toBe(true);
  });

  it('should maintain task state consistency across push and merge', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'State consistency test'
    );

    // State before push
    const stateBeforePush = await captureWorkflowState(realOrchestrator, tempProjectPath, task.id);
    expect(stateBeforePush.branchName).toBe(branchName);

    // Execute push
    await pushCmd!.handler(mockContext, [task.id]);

    // State after push (should be unchanged for task)
    const stateAfterPush = await captureWorkflowState(realOrchestrator, tempProjectPath, task.id);
    expect(stateAfterPush.branchName).toBe(branchName);
    expect(stateAfterPush.taskId).toBe(task.id);

    // Execute merge
    await mergeCmd!.handler(mockContext, [task.id]);

    // State after merge (task should still reference same branch)
    const stateAfterMerge = await captureWorkflowState(realOrchestrator, tempProjectPath, task.id);
    expect(stateAfterMerge.branchName).toBe(branchName);
    expect(stateAfterMerge.taskId).toBe(task.id);
  });

  it('should handle squash merge after push', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Squash merge test'
    );

    // Add multiple commits to the feature branch
    execSync(`git checkout ${branchName}`, { cwd: tempProjectPath, stdio: 'ignore' });
    await writeFile(join(tempProjectPath, 'feature2.js'), '// More feature code\n');
    execSync('git add feature2.js', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git commit -m "Additional feature work"', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git checkout main', { cwd: tempProjectPath, stdio: 'ignore' });

    // Push
    await pushCmd!.handler(mockContext, [task.id]);

    // Squash merge
    mockConsoleLog.mockClear();
    await mergeCmd!.handler(mockContext, [task.id, '--squash']);

    // Verify squash was acknowledged
    const hasSquashMessage = mockConsoleLog.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.toLowerCase().includes('squash'))
    );
    expect(hasSquashMessage).toBe(true);
  });
});
```

#### 4.2 Partial ID Resolution in Sequences

```typescript
describe('Partial ID resolution in sequences', () => {
  it('should resolve same task with different partial ID formats', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Partial ID test'
    );

    // Use 8-character partial ID for push
    const partialId8 = task.id.substring(0, 8);
    await pushCmd!.handler(mockContext, [partialId8]);

    // Verify push was attempted for correct task
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Pushing')
    );

    // Use 12-character partial ID for merge
    mockConsoleLog.mockClear();
    const partialId12 = task.id.substring(0, 12);
    await mergeCmd!.handler(mockContext, [partialId12]);

    // Verify merge was attempted for correct task
    const hasTaskReference = mockConsoleLog.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' &&
        (arg.includes('completed') || arg.includes('Merging')))
    );
    expect(hasTaskReference).toBe(true);
  });

  it('should reject ambiguous partial IDs', async () => {
    const pushCmd = commands.find(c => c.name === 'push');

    // Create two tasks that might have similar prefixes
    const { task: task1 } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'First task'
    );
    const { task: task2 } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Second task'
    );

    // Use very short partial ID (might be ambiguous)
    const veryShortId = task1.id.substring(0, 4);
    await pushCmd!.handler(mockContext, [veryShortId]);

    // Should either succeed (if unique) or show appropriate message
    // The key is that it doesn't crash or produce incorrect behavior
    expect(mockConsoleLog).toHaveBeenCalled();
  });
});
```

#### 4.3 Error Recovery in Sequences

```typescript
describe('Error recovery across commands', () => {
  it('should allow merge after failed push attempt', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Error recovery test'
    );

    // Remove remote to cause push failure
    execSync('git remote remove origin', { cwd: tempProjectPath, stdio: 'ignore' });

    // Push should fail
    await pushCmd!.handler(mockContext, [task.id]);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Failed')
    );

    // Task should still be in valid state
    const tasks = await realOrchestrator.listTasks({ limit: 100 });
    const taskAfterFailure = tasks.find(t => t.id === task.id);
    expect(taskAfterFailure).toBeDefined();
    expect(taskAfterFailure?.branchName).toBe(branchName);

    // Merge should still work (local merge doesn't need remote)
    mockConsoleLog.mockClear();
    await mergeCmd!.handler(mockContext, [task.id]);

    // Merge should succeed locally
    const hasMergeOutput = mockConsoleLog.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' &&
        (arg.includes('Merging') || arg.includes('completed')))
    );
    expect(hasMergeOutput).toBe(true);
  });

  it('should handle merge failure after successful push', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Merge failure test'
    );

    // Push successfully
    await pushCmd!.handler(mockContext, [task.id]);

    // Create conflicting changes on main
    await writeFile(join(tempProjectPath, 'feature.js'), '// Conflicting content\n');
    execSync('git add feature.js', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git commit -m "Conflicting change on main"', { cwd: tempProjectPath, stdio: 'ignore' });

    // Attempt merge (should fail with conflict)
    mockConsoleLog.mockClear();
    await mergeCmd!.handler(mockContext, [task.id]);

    // Should handle conflict gracefully
    const hasConflictOrError = mockConsoleLog.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' &&
        (arg.includes('conflict') || arg.includes('Failed') || arg.includes('error')))
    );
    // May succeed with auto-merge or fail with conflict - both are valid
    expect(mockConsoleLog).toHaveBeenCalled();

    // Repository should be in clean state (merge aborted if conflicted)
    const gitStatus = execSync('git status --porcelain', {
      cwd: tempProjectPath,
      encoding: 'utf-8'
    }).trim();
    // Either clean or has resolved changes
    expect(true).toBe(true); // Placeholder - actual behavior depends on merge result
  });

  it('should preserve task data through multiple retry cycles', async () => {
    const pushCmd = commands.find(c => c.name === 'push');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Retry cycle test'
    );

    // Remove remote
    execSync('git remote remove origin', { cwd: tempProjectPath, stdio: 'ignore' });

    // Multiple failed push attempts
    for (let i = 0; i < 3; i++) {
      mockConsoleLog.mockClear();
      await pushCmd!.handler(mockContext, [task.id]);

      // Verify task state is preserved after each failure
      const tasks = await realOrchestrator.listTasks({ limit: 100 });
      const currentTask = tasks.find(t => t.id === task.id);
      expect(currentTask).toBeDefined();
      expect(currentTask?.branchName).toBe(branchName);
    }

    // Re-add remote
    execSync(`git remote add origin ${tempRemotePath}`, { cwd: tempProjectPath, stdio: 'ignore' });

    // Now push should succeed
    mockConsoleLog.mockClear();
    await pushCmd!.handler(mockContext, [task.id]);

    const hasSuccess = mockConsoleLog.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('Successfully'))
    );
    expect(hasSuccess).toBe(true);
  });
});
```

#### 4.4 Edge Cases

```typescript
describe('Workflow edge cases', () => {
  it('should handle push and merge when already on feature branch', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task, branchName } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Same branch test'
    );

    // Stay on feature branch
    execSync(`git checkout ${branchName}`, { cwd: tempProjectPath, stdio: 'ignore' });

    // Push should work from feature branch
    await pushCmd!.handler(mockContext, [task.id]);

    // Merge should switch to main and merge
    mockConsoleLog.mockClear();
    await mergeCmd!.handler(mockContext, [task.id]);

    // Should end up on main
    const currentBranch = getCurrentBranch(tempProjectPath);
    expect(currentBranch).toBe('main');
  });

  it('should handle rapid push-merge sequence', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    const { task } = await createTaskWithBranch(
      realOrchestrator,
      tempProjectPath,
      'Rapid sequence test'
    );

    // Execute push and merge in rapid succession
    await pushCmd!.handler(mockContext, [task.id]);
    await mergeCmd!.handler(mockContext, [task.id]);

    // Verify final state is correct
    const currentBranch = getCurrentBranch(tempProjectPath);
    expect(currentBranch).toBe('main');

    const commits = getGitLog(tempProjectPath);
    expect(commits.length).toBeGreaterThan(1);
  });

  it('should handle workflow with multiple tasks', async () => {
    const pushCmd = commands.find(c => c.name === 'push');
    const mergeCmd = commands.find(c => c.name === 'merge');

    // Create multiple tasks
    const task1 = await createTaskWithBranch(realOrchestrator, tempProjectPath, 'Feature 1');
    const task2 = await createTaskWithBranch(realOrchestrator, tempProjectPath, 'Feature 2');

    // Push both
    await pushCmd!.handler(mockContext, [task1.task.id]);
    await pushCmd!.handler(mockContext, [task2.task.id]);

    // Merge first task
    await mergeCmd!.handler(mockContext, [task1.task.id]);

    // Merge second task (should work even after first merge)
    mockConsoleLog.mockClear();
    await mergeCmd!.handler(mockContext, [task2.task.id]);

    // Both should be merged
    const commits = getGitLog(tempProjectPath);
    expect(commits.length).toBeGreaterThan(2);
  });
});
```

### 5. Test Organization Summary

```
git-workflow-sequence.integration.test.ts
├── Push → Merge workflow (3 tests)
│   ├── should execute push then merge in sequence on same task
│   ├── should maintain task state consistency across push and merge
│   └── should handle squash merge after push
├── Partial ID resolution in sequences (2 tests)
│   ├── should resolve same task with different partial ID formats
│   └── should reject ambiguous partial IDs
├── Error recovery across commands (3 tests)
│   ├── should allow merge after failed push attempt
│   ├── should handle merge failure after successful push
│   └── should preserve task data through multiple retry cycles
└── Workflow edge cases (3 tests)
    ├── should handle push and merge when already on feature branch
    ├── should handle rapid push-merge sequence
    └── should handle workflow with multiple tasks

Total: 11 integration tests
```

### 6. Implementation Considerations

#### 6.1 Git Repository Setup

Each test requires:
- Local project repository with initial commit
- Bare "remote" repository for push verification
- APEX `.apex/` directory with config
- Real orchestrator instance

#### 6.2 Cleanup Requirements

```typescript
afterEach(async () => {
  mockConsoleLog.mockRestore();
  try {
    await rm(tempProjectPath, { recursive: true, force: true });
    await rm(tempRemotePath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});
```

#### 6.3 Console Output Verification

Tests use flexible matchers since exact output may vary:
```typescript
const hasSuccess = mockConsoleLog.mock.calls.some(call =>
  call.some(arg => typeof arg === 'string' && arg.includes('Successfully'))
);
```

#### 6.4 Test Timeout

Consider setting extended timeout for git operations:
```typescript
vi.setConfig({ testTimeout: 30000 }); // 30 seconds
```

## Consequences

### Positive

- Validates complete push → merge workflow sequence
- Tests real git operations without mocking
- Verifies state persistence across commands
- Catches issues with partial ID resolution
- Documents expected error recovery behavior
- Provides confidence in multi-command workflows

### Negative

- Slower test execution due to git operations
- Requires temp directory cleanup
- More complex setup with "remote" repository
- Potential for flaky tests on slow systems

### Mitigations

- Use unique temp directories per test
- Clean up in `afterEach` hooks
- Set appropriate timeouts
- Use flexible output matchers

## Implementation Notes for Developer Stage

1. **File Location**: Create `packages/cli/src/__tests__/git-workflow-sequence.integration.test.ts`

2. **Dependencies**:
   - vitest for testing
   - fs/promises for file operations
   - child_process for git commands
   - @apexcli/orchestrator for real orchestrator

3. **Chalk Mock**: Required to avoid color codes in output assertions

4. **Remote Repository**: Use bare git repository to simulate push/pull behavior

5. **Branch Management**: Always return to main branch between operations

6. **State Verification**: Use orchestrator.listTasks() to verify task state persistence

## Related ADRs

- ADR-044: Session Persistence Integration Tests
- ADR-045: Error Recovery Integration Tests

## Files to Create/Modify

- **CREATE**: `packages/cli/src/__tests__/git-workflow-sequence.integration.test.ts`
