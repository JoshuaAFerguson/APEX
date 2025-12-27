# ADR: Merge Command Implementation

## Status
Proposed

## Context

APEX needs a `/merge <taskId>` CLI command to merge completed task branches back into the default branch (typically `main` or `master`). This command should support both standard merges and squash merges via a `--squash` flag.

### Current State Analysis

1. **Related Commands**: The codebase already has git-related commands:
   - `/push` (`p` alias) - Push task branch to remote
   - `/pr` - Create pull request for a task
   - `/checkout` (`co` alias) - Switch to task worktree
   - `/diff` (`d` alias) - Show code changes made by a task

2. **Orchestrator Methods**: The `ApexOrchestrator` class has:
   - `pushTaskBranch(taskId)` - Push branch to remote
   - `createPullRequest(taskId, options)` - Create PR using `gh` CLI
   - `checkPRMerged(taskId)` - Check if PR is merged
   - `isGitHubCliAvailable()` - Check for `gh` CLI
   - `isGitHubRepo()` - Check if GitHub repo

3. **Task Properties**: Tasks have `branchName` and `prUrl` optional fields

## Decision

### 1. CLI Command Design

**Command Registration** (in `packages/cli/src/index.ts`):

```typescript
{
  name: 'merge',
  aliases: ['m'],
  description: 'Merge a task branch into the default branch',
  usage: '/merge <task_id> [--squash]',
  handler: async (ctx, args) => { /* ... */ }
}
```

**Command Options**:
- `<task_id>` - Required: The task ID or partial ID to merge
- `--squash` or `-s` - Optional: Perform a squash merge instead of standard merge

### 2. Orchestrator Method Design

Add new method to `ApexOrchestrator` class:

```typescript
interface MergeResult {
  success: boolean;
  error?: string;
  mergeCommit?: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

async mergeTaskBranch(taskId: string, options?: {
  squash?: boolean;
}): Promise<MergeResult>
```

### 3. Implementation Flow

```
┌─────────────────────────────────────────────────────────┐
│                     /merge <taskId>                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│               1. Validate APEX initialized               │
│               2. Validate task_id provided               │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  3. Retrieve task by ID                  │
│            (Use getTask with partial matching)           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                4. Validate task has branch               │
│               (Check task.branchName exists)             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              5. Call orchestrator.mergeTaskBranch        │
│                 with squash option if set                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│           6. Display success/failure message             │
│        - Show merge commit hash on success               │
│        - Show files changed statistics                   │
│        - Show helpful conflict resolution tips on fail   │
└─────────────────────────────────────────────────────────┘
```

### 4. Orchestrator Method Implementation

```typescript
async mergeTaskBranch(taskId: string, options?: {
  squash?: boolean;
}): Promise<MergeResult> {
  await this.ensureInitialized();

  const task = await this.store.getTask(taskId);
  if (!task) {
    return { success: false, error: `Task not found: ${taskId}` };
  }

  if (!task.branchName) {
    return { success: false, error: 'Task does not have a branch' };
  }

  const defaultBranch = this.effectiveConfig.git.defaultBranch;

  try {
    // 1. Save current branch
    const { stdout: currentBranch } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: this.projectPath }
    );

    // 2. Checkout the default branch and pull latest
    await execAsync(`git checkout ${defaultBranch}`, { cwd: this.projectPath });
    await execAsync(`git pull origin ${defaultBranch}`, { cwd: this.projectPath });

    // 3. Perform merge
    const mergeCommand = options?.squash
      ? `git merge --squash ${task.branchName}`
      : `git merge ${task.branchName} --no-edit`;

    await execAsync(mergeCommand, { cwd: this.projectPath });

    // 4. For squash merge, need to commit
    if (options?.squash) {
      const commitMsg = this.generateSquashCommitMessage(task);
      await execAsync(
        `git commit -m "${commitMsg.replace(/"/g, '\\"')}"`,
        { cwd: this.projectPath }
      );
    }

    // 5. Get merge stats
    const { stdout: diffStat } = await execAsync(
      `git diff --stat HEAD~1`,
      { cwd: this.projectPath }
    );

    // Parse diff stats
    const stats = this.parseDiffStats(diffStat);

    // 6. Get merge commit hash
    const { stdout: commitHash } = await execAsync(
      'git rev-parse --short HEAD',
      { cwd: this.projectPath }
    );

    // 7. Log the merge
    await this.store.addLog(task.id, {
      level: 'info',
      message: `Branch ${task.branchName} merged into ${defaultBranch} (${options?.squash ? 'squash' : 'standard'} merge)`,
    });

    return {
      success: true,
      mergeCommit: commitHash.trim(),
      filesChanged: stats.filesChanged,
      insertions: stats.insertions,
      deletions: stats.deletions,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Check for merge conflict
    if (errorMsg.includes('CONFLICT') || errorMsg.includes('Automatic merge failed')) {
      // Abort the merge to return to clean state
      try {
        await execAsync('git merge --abort', { cwd: this.projectPath });
      } catch {
        // Ignore abort errors
      }

      return {
        success: false,
        error: `Merge conflict detected. Please resolve conflicts manually:\n  1. git checkout ${defaultBranch}\n  2. git merge ${task.branchName}\n  3. Resolve conflicts\n  4. git commit`
      };
    }

    return { success: false, error: errorMsg };
  }
}

private generateSquashCommitMessage(task: Task): string {
  const shortId = task.id.substring(0, 8);
  return `feat: ${task.description} [${shortId}]`;
}

private parseDiffStats(diffOutput: string): { filesChanged: number; insertions: number; deletions: number } {
  // Parse output like: "10 files changed, 200 insertions(+), 50 deletions(-)"
  const match = diffOutput.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  return {
    filesChanged: match?.[1] ? parseInt(match[1], 10) : 0,
    insertions: match?.[2] ? parseInt(match[2], 10) : 0,
    deletions: match?.[3] ? parseInt(match[3], 10) : 0,
  };
}
```

### 5. CLI Handler Implementation

```typescript
{
  name: 'merge',
  aliases: ['m'],
  description: 'Merge a task branch into the default branch',
  usage: '/merge <task_id> [--squash]',
  handler: async (ctx, args) => {
    if (!ctx.initialized || !ctx.orchestrator) {
      console.log(chalk.red('APEX not initialized. Run /init first.'));
      return;
    }

    const taskId = args.filter(arg => !arg.startsWith('-'))[0];
    if (!taskId) {
      console.log(chalk.red('Usage: /merge <task_id> [--squash]'));
      console.log(chalk.gray('\nOptions:'));
      console.log(chalk.gray('  --squash, -s    Squash all commits into a single commit'));
      return;
    }

    const squash = args.includes('--squash') || args.includes('-s');

    const task = await ctx.orchestrator.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      return;
    }

    if (!task.branchName) {
      console.log(chalk.red('Task does not have a branch'));
      console.log(chalk.gray('Tasks need a branch to be merged. Check task status with /status'));
      return;
    }

    const mergeType = squash ? 'squash' : 'standard';
    console.log(chalk.cyan(`\nMerging branch ${task.branchName} (${mergeType} merge)...\n`));

    const result = await ctx.orchestrator.mergeTaskBranch(taskId, { squash });

    if (result.success) {
      console.log(chalk.green(`✓ Successfully merged ${task.branchName}`));
      console.log(chalk.gray(`  Merge commit: ${result.mergeCommit}`));
      if (result.filesChanged !== undefined) {
        console.log(chalk.gray(`  Changed: ${result.filesChanged} file(s), +${result.insertions || 0} -${result.deletions || 0}`));
      }
    } else {
      console.log(chalk.red(`Failed to merge: ${result.error}`));
    }
  },
},
```

### 6. Error Handling Strategy

| Error Case | Detection | Behavior |
|------------|-----------|----------|
| APEX not initialized | `!ctx.initialized` | Show "Run /init first" message |
| No task ID provided | `!taskId` | Show usage help |
| Task not found | `getTask()` returns null | Show "Task not found" error |
| No branch on task | `!task.branchName` | Show "Task needs branch" error |
| Merge conflict | Error contains 'CONFLICT' | Abort merge, show resolution steps |
| Git command fails | Other exec errors | Show error message |

### 7. File Modifications

1. **`packages/cli/src/index.ts`**
   - Add merge command to the `commands` array
   - Position after `push` command (git-related commands grouped)

2. **`packages/orchestrator/src/index.ts`**
   - Add `MergeResult` interface
   - Add `mergeTaskBranch(taskId, options)` method
   - Add `generateSquashCommitMessage(task)` private method
   - Add `parseDiffStats(output)` private method

3. **`packages/cli/src/__tests__/merge-command.test.ts`** (new file)
   - Command registration tests
   - Command validation tests
   - Success path tests
   - Error handling tests

4. **`packages/orchestrator/src/__tests__/merge-task-branch.test.ts`** (new file)
   - Standard merge tests
   - Squash merge tests
   - Conflict handling tests
   - Error scenarios

## Test Strategy

### Unit Tests for CLI Command

```typescript
describe('Merge Command', () => {
  describe('Command registration', () => {
    it('should be registered with name "merge" and alias "m"');
    it('should have correct description and usage');
  });

  describe('Command validation', () => {
    it('should reject when APEX is not initialized');
    it('should reject when no task ID is provided');
    it('should reject when task is not found');
    it('should reject when task has no branch');
  });

  describe('Standard merge', () => {
    it('should call mergeTaskBranch without squash option');
    it('should display success message with commit info');
  });

  describe('Squash merge', () => {
    it('should call mergeTaskBranch with squash: true for --squash flag');
    it('should call mergeTaskBranch with squash: true for -s flag');
  });

  describe('Error handling', () => {
    it('should display merge conflict error with resolution steps');
    it('should display generic error for other failures');
  });
});
```

### Unit Tests for Orchestrator Method

```typescript
describe('mergeTaskBranch', () => {
  describe('Standard merge', () => {
    it('should checkout default branch and merge task branch');
    it('should return merge commit hash on success');
    it('should return file change statistics');
  });

  describe('Squash merge', () => {
    it('should use --squash flag and create separate commit');
    it('should generate appropriate commit message');
  });

  describe('Conflict handling', () => {
    it('should detect merge conflicts');
    it('should abort merge on conflict');
    it('should return helpful error message');
  });

  describe('Error scenarios', () => {
    it('should handle task not found');
    it('should handle task without branch');
    it('should handle git command failures');
  });
});
```

## Consequences

### Positive
- Completes the git workflow: task creation → work → push → PR → merge
- Follows established patterns from push/pr/checkout commands
- Provides both standard and squash merge options
- Graceful conflict handling with actionable guidance
- Consistent error messaging

### Negative
- Performs merge locally (not via PR merge button)
- Requires working directory to be clean before merge
- User must handle authentication for push after merge

### Future Considerations
- Add `--push` flag to automatically push after merge
- Add `--delete-branch` flag to clean up merged branch
- Add GitHub PR merge support via `gh pr merge` for PR-based merges
- Integrate with worktree cleanup workflow

## Implementation Checklist

- [ ] Add `MergeResult` interface to orchestrator
- [ ] Implement `mergeTaskBranch` method in orchestrator
- [ ] Implement `generateSquashCommitMessage` helper
- [ ] Implement `parseDiffStats` helper
- [ ] Add merge command to CLI commands array
- [ ] Write unit tests for CLI command
- [ ] Write unit tests for orchestrator method
- [ ] Verify `npm run build` passes
- [ ] Verify `npm run test` passes
