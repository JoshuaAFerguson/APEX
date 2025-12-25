# ADR-009: PR Merge Detection Method

## Status
Implemented

## Context
APEX needs to detect when a PR associated with a task has been merged. This is essential for the worktree cleanup workflow (emit `worktree:merge-cleaned` event) and for future features like automatic task lifecycle management based on PR state.

The planning stage identified this as a simple, single-method implementation that:
1. Takes a `taskId` parameter
2. Uses the `gh pr view` CLI command to check if a PR is merged
3. Returns `true`/`false`
4. Handles error cases gracefully (missing gh CLI, unauthenticated state, network errors)

## Decision

### Method Signature

```typescript
/**
 * Check if the PR associated with a task has been merged
 * @param taskId The ID of the task to check
 * @returns true if PR is merged, false otherwise (includes cases where no PR exists or errors occur)
 */
async checkPRMerged(taskId: string): Promise<boolean>
```

### Implementation Location
The method will be added to the `ApexOrchestrator` class in `packages/orchestrator/src/index.ts`, following the existing pattern of git-related methods like `createPullRequest`, `isGitHubCliAvailable`, and `isGitHubRepo`.

### Implementation Strategy

#### 1. Prerequisites Check
Reuse existing helper methods:
- `isGitHubCliAvailable()` - Check if `gh` CLI is installed
- `isGitHubRepo()` - Check if this is a GitHub repository

#### 2. Task Lookup
- Retrieve task from store using `this.store.getTask(taskId)`
- Return `false` if task not found or `task.prUrl` is not set

#### 3. PR State Detection
Use `gh pr view` with JSON output for reliable parsing:

```bash
gh pr view <PR_URL_OR_NUMBER> --json state --jq '.state'
```

The `state` field returns one of:
- `"OPEN"` - PR is still open
- `"MERGED"` - PR has been merged
- `"CLOSED"` - PR was closed without merging

#### 4. Error Handling Strategy

| Error Case | Detection | Behavior |
|------------|-----------|----------|
| Missing `gh` CLI | `isGitHubCliAvailable()` returns false | Return `false`, log warning |
| Not authenticated | `gh` command fails with auth error | Return `false`, log warning |
| Network error | `gh` command fails with network error | Return `false`, log warning |
| PR not found | `gh` command fails with "not found" | Return `false`, log debug |
| Task not found | `getTask()` returns null | Return `false` |
| No PR URL on task | `task.prUrl` is undefined | Return `false` |

**Rationale for returning `false` on errors**: Following the principle of graceful degradation. The caller is typically asking "should I clean up the worktree?" - and in case of uncertainty, the safer answer is "not yet" (i.e., `false`).

### Proposed Implementation

```typescript
/**
 * Check if the PR associated with a task has been merged
 * @param taskId The ID of the task to check
 * @returns true if PR is merged, false otherwise
 */
async checkPRMerged(taskId: string): Promise<boolean> {
  await this.ensureInitialized();

  // Get the task
  const task = await this.store.getTask(taskId);
  if (!task) {
    return false;
  }

  // Check if task has a PR URL
  if (!task.prUrl) {
    return false;
  }

  // Check prerequisites
  const ghAvailable = await this.isGitHubCliAvailable();
  if (!ghAvailable) {
    await this.store.addLog(taskId, {
      level: 'warn',
      message: 'Cannot check PR merge status: GitHub CLI (gh) not available',
    });
    return false;
  }

  const isGitHub = await this.isGitHubRepo();
  if (!isGitHub) {
    await this.store.addLog(taskId, {
      level: 'warn',
      message: 'Cannot check PR merge status: Not a GitHub repository',
    });
    return false;
  }

  try {
    // Extract PR number or use full URL
    // gh pr view accepts both PR number and full URL
    const { stdout } = await execAsync(
      `gh pr view "${task.prUrl}" --json state --jq '.state'`,
      { cwd: this.projectPath }
    );

    const state = stdout.trim().toUpperCase();
    return state === 'MERGED';
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Determine log level based on error type
    const isAuthError = errorMessage.includes('auth') || errorMessage.includes('login');
    const isNotFoundError = errorMessage.includes('not found') || errorMessage.includes('Could not resolve');

    await this.store.addLog(taskId, {
      level: isNotFoundError ? 'debug' : 'warn',
      message: `Failed to check PR merge status: ${errorMessage}`,
    });

    return false;
  }
}
```

### Test Strategy

Tests should be added to `packages/orchestrator/src/index.test.ts`:

```typescript
describe('checkPRMerged', () => {
  it('should return true when PR is merged', async () => {
    execMockBehavior['gh pr view'] = { stdout: 'MERGED\n' };
    // ... setup task with prUrl
    expect(await orchestrator.checkPRMerged(taskId)).toBe(true);
  });

  it('should return false when PR is open', async () => {
    execMockBehavior['gh pr view'] = { stdout: 'OPEN\n' };
    expect(await orchestrator.checkPRMerged(taskId)).toBe(false);
  });

  it('should return false when PR is closed without merge', async () => {
    execMockBehavior['gh pr view'] = { stdout: 'CLOSED\n' };
    expect(await orchestrator.checkPRMerged(taskId)).toBe(false);
  });

  it('should return false when task not found', async () => {
    expect(await orchestrator.checkPRMerged('non-existent')).toBe(false);
  });

  it('should return false when task has no PR URL', async () => {
    // Create task without PR
    expect(await orchestrator.checkPRMerged(taskId)).toBe(false);
  });

  it('should return false when gh CLI is not available', async () => {
    execMockBehavior['gh --version'] = { error: new Error('command not found') };
    expect(await orchestrator.checkPRMerged(taskId)).toBe(false);
  });

  it('should return false on network/auth errors', async () => {
    execMockBehavior['gh pr view'] = { error: new Error('authentication required') };
    expect(await orchestrator.checkPRMerged(taskId)).toBe(false);
  });

  it('should return false for PR not found', async () => {
    execMockBehavior['gh pr view'] = { error: new Error('Could not resolve to a PullRequest') };
    expect(await orchestrator.checkPRMerged(taskId)).toBe(false);
  });
});
```

## Consequences

### Positive
- Simple, focused method with single responsibility
- Reuses existing infrastructure (`execAsync`, `isGitHubCliAvailable`, `isGitHubRepo`)
- Graceful error handling - never throws, always returns boolean
- Logging provides visibility into failures for debugging
- Follows existing patterns in the codebase

### Negative
- Requires `gh` CLI to be installed and authenticated
- Relies on external network call (cannot work offline)
- May have rate limiting concerns if called frequently

### Future Considerations
- Could add caching for repeated checks on the same PR
- Could integrate with GitHub webhooks for real-time merge notification
- Could add a polling mechanism in the daemon for autonomous cleanup

## Files to Modify

1. **`packages/orchestrator/src/index.ts`**
   - Add `checkPRMerged(taskId: string): Promise<boolean>` method

2. **`packages/orchestrator/src/index.test.ts`**
   - Add test suite for `checkPRMerged` method

## Implementation Checklist

- [x] Add `checkPRMerged` method to `ApexOrchestrator` class
- [x] Add comprehensive tests covering all error scenarios
- [x] Ensure method follows existing code patterns and conventions
- [ ] Ensure `npm run build` passes _(requires approval to run)_
- [ ] Ensure `npm run test` passes _(requires approval to run)_
- [x] Update any exports if needed (not needed as method is public on class)

## Implementation Notes

The final implementation differs slightly from the proposed version:

1. **Simplified approach**: Removed redundant `isGitHubRepo()` check since the method gracefully handles non-GitHub repos through error handling
2. **Enhanced error handling**: Added specific error message detection for authentication, network, and not-found errors
3. **Different JSON parsing**: Used `--json state` instead of `--jq '.state'` to avoid jq dependency and parsed JSON in TypeScript
4. **URL validation**: Added PR URL format validation to extract PR number correctly
5. **Test location**: Created separate test file `check-pr-merged.test.ts` instead of adding to main index test file

These changes improve the robustness and maintainability of the implementation while meeting all the acceptance criteria.
