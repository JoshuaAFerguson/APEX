# Architecture Decision Record: Git Status Awareness Interface Fix

## Status
Proposed

## Context
The `v060-git-status-awareness.test.ts` test file expects a different interface for `GitStatus` than what is currently implemented in `packages/core/src/types.ts` and `packages/core/src/project-context-analyzer.ts`. This ADR documents the required changes to align the implementation with test expectations.

## Decision

### 1. GitStatus Interface Changes

The `GitStatus` type must be updated to include the following properties:

```typescript
export const GitStatusSchema = z.object({
  /** Whether the path is a git repository */
  isRepository: z.boolean(),

  /** Current branch name (empty string if not a git repo or detached HEAD) */
  branch: z.string(),  // Changed from z.string().nullable()

  /** Whether the working directory is clean (no changes) */
  isClean: z.boolean(),  // NEW

  /** Whether there are uncommitted changes (staged or unstaged) */
  hasUncommittedChanges: z.boolean(),  // NEW

  /** Whether there are untracked files */
  hasUntrackedFiles: z.boolean(),  // NEW

  /** Whether there are staged changes */
  hasStagedChanges: z.boolean(),  // NEW

  /** All changed files with status and staged flag */
  changedFiles: z.array(z.object({  // NEW - unified array
    path: z.string(),
    status: z.string(),
    staged: z.boolean(),
  })),

  /** Total number of stashes */
  stashCount: z.number().int().min(0),

  /** Remote tracking information */
  tracking: z.object({  // NEW - nested object
    remote: z.string().optional(),
    remoteBranch: z.string().optional(),
    aheadCount: z.number().int().min(0),
    behindCount: z.number().int().min(0),
  }).optional(),

  /** Last commit information */
  lastCommit: z.object({  // NEW - nested object
    hash: z.string(),
    message: z.string(),
    timestamp: z.date(),
  }).optional(),

  // Keep existing properties for backward compatibility
  remoteBranch: z.string().nullable().optional(),
  ahead: z.number().int().min(0).optional().default(0),
  behind: z.number().int().min(0).optional().default(0),
  staged: z.array(GitChangedFileSchema).optional().default([]),
  unstaged: z.array(GitChangedFileSchema).optional().default([]),
  untracked: z.array(z.string()).optional().default([]),
  hasConflicts: z.boolean().optional().default(false),
  isDirty: z.boolean().optional().default(false),
  lastCommitHash: z.string().optional(),
  lastCommitMessage: z.string().optional(),
  lastCommitTimestamp: z.date().optional(),
  remotes: z.array(z.object({
    name: z.string(),
    url: z.string(),
  })).optional().default([]),
  recentCommits: z.array(GitCommitSchema).optional().default([]),
});
```

### 2. getGitStatus Method Signature Fix

The `getGitStatus` method must accept an optional `directoryPath` parameter:

```typescript
async getGitStatus(directoryPath?: string): Promise<GitStatus>
```

If `directoryPath` is provided, it should analyze that directory instead of `this.projectPath`.

### 3. Empty GitStatus for Non-Git Directories

When a directory is not a git repository, `getEmptyGitStatus()` must return:

```typescript
{
  isRepository: false,
  branch: '',                    // Empty string, not null
  isClean: true,
  hasUncommittedChanges: false,
  hasUntrackedFiles: false,
  hasStagedChanges: false,
  changedFiles: [],
  stashCount: 0,
  tracking: undefined,
  lastCommit: undefined,
  // Legacy fields for backward compatibility
  remoteBranch: null,
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  untracked: [],
  hasConflicts: false,
  isDirty: false,
  remotes: [],
  recentCommits: [],
}
```

### 4. Compute Derived Properties

In `getGitStatus()`, compute the new properties from existing data:

```typescript
// Compute derived properties
gitStatus.isClean = !gitStatus.isDirty;
gitStatus.hasUncommittedChanges = gitStatus.staged.length > 0 || gitStatus.unstaged.length > 0;
gitStatus.hasUntrackedFiles = gitStatus.untracked.length > 0;
gitStatus.hasStagedChanges = gitStatus.staged.length > 0;

// Build unified changedFiles array
gitStatus.changedFiles = [
  ...gitStatus.staged.map(f => ({ path: f.path, status: f.status, staged: true })),
  ...gitStatus.unstaged.map(f => ({ path: f.path, status: f.status, staged: false })),
  ...gitStatus.untracked.map(p => ({ path: p, status: 'untracked', staged: false })),
];

// Build nested tracking object
if (gitStatus.remoteBranch) {
  const remoteMatch = gitStatus.remoteBranch.match(/^([^\/]+)\/(.+)$/);
  gitStatus.tracking = {
    remote: remoteMatch ? remoteMatch[1] : undefined,
    remoteBranch: gitStatus.remoteBranch,
    aheadCount: gitStatus.ahead || 0,
    behindCount: gitStatus.behind || 0,
  };
}

// Build nested lastCommit object
if (gitStatus.lastCommitHash) {
  gitStatus.lastCommit = {
    hash: gitStatus.lastCommitHash,
    message: gitStatus.lastCommitMessage || '',
    timestamp: gitStatus.lastCommitTimestamp || new Date(),
  };
}
```

### 5. analyze() Method with Options

Add a new `analyze()` overload that accepts an options object:

```typescript
interface AnalyzeOptions {
  includeGit?: boolean;
  includeFrameworks?: boolean;
  includeConfiguration?: boolean;
  includeTestFrameworks?: boolean;
}

async analyze(directoryPath?: string, options?: AnalyzeOptions): Promise<ProjectContext>
```

The returned `ProjectContext` should include a `git` property (aliasing `gitStatus`) for compatibility with tests:

```typescript
interface ProjectContext {
  git?: GitStatus;  // Add alias
  gitStatus?: GitStatus;
  // ... other fields
}
```

### 6. Branch Type Handling

Change `branch` from `string | null` to `string`:
- For valid git repos: branch name or empty string for detached HEAD
- For non-git directories: empty string

## Consequences

### Positive
- Tests will pass with the correct interface
- Better semantic properties (`isClean`, `hasUncommittedChanges`, etc.)
- Unified `changedFiles` array is easier to consume
- Nested objects (`tracking`, `lastCommit`) provide cleaner structure

### Negative
- Schema changes may require migration for existing consumers
- Backward compatibility fields add some redundancy

### Mitigation
- Keep legacy flat fields for backward compatibility
- Both `git` and `gitStatus` aliases on ProjectContext

## Implementation Steps

1. **Update types.ts**:
   - Add new properties to GitStatusSchema
   - Change `branch` type from nullable to required string
   - Add `tracking` and `lastCommit` nested object schemas

2. **Update project-context-analyzer.ts**:
   - Modify `getGitStatus(directoryPath?: string)` signature
   - Update `getEmptyGitStatus()` with new properties
   - Compute derived properties after fetching git data
   - Add `git` alias to ProjectContext

3. **Update analyze() method**:
   - Support options object with includeGit, includeFrameworks, etc.
   - Return `git` field in ProjectContext

## Test Cases to Pass

All 21 tests in `tests/v060-git-status-awareness.test.ts`:
- Git Repository Detection (3 tests)
- Branch Information and Tracking (3 tests)
- Uncommitted Changes Detection (4 tests)
- Recent Commit Analysis (3 tests)
- Integration with Project Context (2 tests)
- Error Handling and Edge Cases (3 tests)
- Real-world Git Scenarios (3 tests)
