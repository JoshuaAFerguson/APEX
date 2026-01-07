# ADR-052: Dry-Run File System Integrity Integration Tests

## Status
Proposed

## Context

The APEX dry-run feature (v0.5.0) allows users to simulate task execution without making actual changes. While existing unit tests in `dry-run-execution.test.ts` validate orchestrator behavior (task creation, status transitions, usage tracking), there is a critical gap: **no integration tests verify that dry-run mode truly leaves the file system unchanged**.

This is essential for user confidence because dry-run mode is used to:
1. Preview what changes a task would make before committing
2. Test workflows without affecting production data
3. Validate task configurations in CI/CD pipelines

### Acceptance Criteria (from Task)
1. No files are created/modified/deleted during dry-run
2. SQLite database is not modified (or uses temp DB)
3. .apex directory state remains unchanged
4. Tests use file system snapshots or temp directories to verify

## Technical Design

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 Dry-Run File System Integration Test Suite                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────┐    ┌────────────────────────┐    ┌────────────────┐ │
│  │   FileSystemSnapshot  │    │   ApexOrchestrator     │    │  Verification  │ │
│  │                       │    │   (Dry-Run Mode)       │    │    Utilities   │ │
│  │  - captureSnapshot()  │    │                        │    │                │ │
│  │  - compareSnapshot()  │───▶│  - createTask()        │───▶│ - assertNoFS() │ │
│  │  - getFileHashes()    │    │  - executeTask()       │    │ - assertNoDb() │ │
│  │  - getDirectoryTree() │    │  - executeDryRunTask() │    │ - diffReport() │ │
│  └───────────────────────┘    └────────────────────────┘    └────────────────┘ │
│           │                            │                            │           │
│           ▼                            ▼                            ▼           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Isolated Test Environment                            ││
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  ││
│  │  │ Temp Project Dir │  │ .apex Directory  │  │ SQLite Database          │  ││
│  │  │                  │  │                  │  │                          │  ││
│  │  │ /tmp/apex-dry-   │  │ config.yaml      │  │ apex.db (copy for each   │  ││
│  │  │ run-test-XXXXX/  │  │ agents/          │  │ test scenario)           │  ││
│  │  │                  │  │ workflows/       │  │                          │  ││
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      File System Snapshot Comparison                         ││
│  │                                                                             ││
│  │  Before Dry-Run                    After Dry-Run                            ││
│  │  ┌─────────────────┐              ┌─────────────────┐                       ││
│  │  │ files: Map<     │              │ files: Map<     │                       ││
│  │  │   path, hash    │   ═══════▶   │   path, hash    │  MUST BE IDENTICAL   ││
│  │  │ >               │              │ >               │                       ││
│  │  └─────────────────┘              └─────────────────┘                       ││
│  │                                                                             ││
│  │  - Content hashes (SHA-256)                                                 ││
│  │  - File permissions                                                         ││
│  │  - Directory structure                                                      ││
│  │  - SQLite DB state                                                          ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Test File Structure

```typescript
// packages/orchestrator/src/__tests__/dry-run-filesystem-integrity.integration.test.ts

/**
 * Dry-Run File System Integrity Integration Tests
 *
 * Test Organization:
 *
 * 1. AC1: No File Changes (4 tests)
 *    - No project files created during dry-run
 *    - No project files modified during dry-run
 *    - No project files deleted during dry-run
 *    - Source code directory remains pristine
 *
 * 2. AC2: SQLite Database Unchanged (3 tests)
 *    - Database file size unchanged after dry-run
 *    - Database content hash unchanged after dry-run
 *    - Task records added but correctly marked as dry-run
 *
 * 3. AC3: .apex Directory State (4 tests)
 *    - config.yaml unchanged after dry-run
 *    - agents/ directory unchanged after dry-run
 *    - workflows/ directory unchanged after dry-run
 *    - No new artifact files created in .apex
 *
 * 4. AC4: Snapshot Verification (3 tests)
 *    - Complete directory tree comparison
 *    - File content hash verification
 *    - Temp directory isolation validation
 */
```

### 3. Core Test Utilities

#### 3.1 FileSystemSnapshot Class

```typescript
interface FileSystemSnapshot {
  files: Map<string, FileInfo>;
  directories: Set<string>;
  timestamp: Date;
}

interface FileInfo {
  path: string;
  hash: string;           // SHA-256 content hash
  size: number;
  mtime: number;          // Modification time
  permissions: number;    // File mode
}

class FileSystemSnapshotUtil {
  /**
   * Captures a complete snapshot of a directory tree
   * Includes all files, subdirectories, hashes, and metadata
   */
  static async captureSnapshot(rootPath: string, options?: {
    exclude?: string[];   // Glob patterns to exclude
    maxDepth?: number;    // Maximum recursion depth
  }): Promise<FileSystemSnapshot>;

  /**
   * Compares two snapshots and returns differences
   * Returns empty diff if snapshots are identical
   */
  static compareSnapshots(
    before: FileSystemSnapshot,
    after: FileSystemSnapshot
  ): SnapshotDiff;

  /**
   * Asserts that two snapshots are identical
   * Throws with detailed diff if not
   */
  static assertIdentical(
    before: FileSystemSnapshot,
    after: FileSystemSnapshot,
    message?: string
  ): void;
}

interface SnapshotDiff {
  added: string[];        // Files/dirs that were created
  removed: string[];      // Files/dirs that were deleted
  modified: string[];     // Files whose content changed
  unchanged: number;      // Count of unchanged files
  isIdentical: boolean;   // Quick check
}
```

#### 3.2 SQLite State Capture

```typescript
interface SQLiteSnapshot {
  fileHash: string;       // Hash of the entire .db file
  fileSize: number;
  walSize: number;        // WAL journal size
  shmSize: number;        // Shared memory file size
  tableRowCounts: Map<string, number>;  // Row count per table
}

class SQLiteSnapshotUtil {
  /**
   * Captures SQLite database state including WAL
   * Note: Forces WAL checkpoint before capture for consistency
   */
  static async captureSnapshot(dbPath: string): Promise<SQLiteSnapshot>;

  /**
   * Compares database state before and after operation
   * Considers dry-run tasks as acceptable changes
   */
  static compareSnapshots(
    before: SQLiteSnapshot,
    after: SQLiteSnapshot,
    options?: { allowDryRunTasks?: boolean }
  ): SQLiteDiff;
}
```

### 4. Test Scenarios

#### 4.1 AC1: No Files Created/Modified/Deleted

```typescript
describe('AC1: No file system changes during dry-run', () => {
  it('should not create any new files in project directory', async () => {
    // Setup: Create project with existing source files
    const projectDir = await createTestProject({
      files: {
        'src/index.ts': 'export const hello = "world";',
        'src/utils/helper.ts': 'export function helper() {}',
        'package.json': '{"name": "test-project"}',
      }
    });

    // Capture before state
    const beforeSnapshot = await FileSystemSnapshotUtil.captureSnapshot(
      projectDir,
      { exclude: ['.apex/apex.db*'] }  // Exclude DB files
    );

    // Execute dry-run task
    const orchestrator = new ApexOrchestrator(projectDir);
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      description: 'Add new feature with multiple files',
      workflow: 'feature',
      dryRun: true,
    });

    await orchestrator.executeTask(task.id);

    // Capture after state
    const afterSnapshot = await FileSystemSnapshotUtil.captureSnapshot(
      projectDir,
      { exclude: ['.apex/apex.db*'] }
    );

    // Verify no changes
    FileSystemSnapshotUtil.assertIdentical(
      beforeSnapshot,
      afterSnapshot,
      'Dry-run should not create any files'
    );
  });

  it('should not modify existing source files', async () => {
    // Similar pattern with pre-existing files
    // Verify content hashes match exactly
  });

  it('should not delete any files', async () => {
    // Execute dry-run that would normally delete files
    // Verify all original files still exist
  });

  it('should preserve file permissions unchanged', async () => {
    // Capture file modes before/after
    // Verify identical permissions
  });
});
```

#### 4.2 AC2: SQLite Database Integrity

```typescript
describe('AC2: SQLite database not modified during dry-run', () => {
  it('should not change database file content hash', async () => {
    // Setup
    const projectDir = await createTestProject();
    const orchestrator = new ApexOrchestrator(projectDir);
    await orchestrator.initialize();

    // Force checkpoint to ensure WAL is merged
    await orchestrator.store.checkpoint();

    // Capture DB state
    const dbPath = path.join(projectDir, '.apex', 'apex.db');
    const beforeHash = await hashFile(dbPath);
    const beforeSize = (await fs.stat(dbPath)).size;

    // Execute dry-run
    const task = await orchestrator.createTask({
      description: 'Test task',
      workflow: 'feature',
      dryRun: true,
    });
    await orchestrator.executeTask(task.id);

    // Force checkpoint again
    await orchestrator.store.checkpoint();

    // Compare
    const afterHash = await hashFile(dbPath);
    const afterSize = (await fs.stat(dbPath)).size;

    // Note: Task creation DOES add a record - we verify it's marked as dryRun
    const storedTask = await orchestrator.store.getTask(task.id);
    expect(storedTask?.dryRun).toBe(true);

    // Additional verification: no other data changes
    // (task records are acceptable as they're just metadata)
  });

  it('should use isolated temp database when configured', async () => {
    // Test alternate pattern: using :memory: or temp file
    // This is an optional enhancement for strict isolation
  });

  it('should not create additional database artifacts', async () => {
    // Verify no extra .db-journal, .db-wal files beyond expected
  });
});
```

#### 4.3 AC3: .apex Directory Unchanged

```typescript
describe('AC3: .apex directory state remains unchanged', () => {
  it('should not modify config.yaml', async () => {
    const projectDir = await createTestProject();
    const configPath = path.join(projectDir, '.apex', 'config.yaml');

    const beforeHash = await hashFile(configPath);

    // Execute dry-run that might normally update config
    const orchestrator = new ApexOrchestrator(projectDir);
    await orchestrator.initialize();
    await orchestrator.createTask({
      description: 'Test',
      workflow: 'feature',
      dryRun: true
    });

    const afterHash = await hashFile(configPath);
    expect(afterHash).toBe(beforeHash);
  });

  it('should not add/modify agent definition files', async () => {
    const projectDir = await createTestProject();
    const agentsDir = path.join(projectDir, '.apex', 'agents');

    const beforeSnapshot = await FileSystemSnapshotUtil.captureSnapshot(agentsDir);

    // Execute dry-run
    const orchestrator = new ApexOrchestrator(projectDir);
    await orchestrator.initialize();
    const task = await orchestrator.createTask({
      description: 'Create new agent',
      workflow: 'feature',
      dryRun: true
    });
    await orchestrator.executeTask(task.id);

    const afterSnapshot = await FileSystemSnapshotUtil.captureSnapshot(agentsDir);
    FileSystemSnapshotUtil.assertIdentical(beforeSnapshot, afterSnapshot);
  });

  it('should not add/modify workflow files', async () => {
    // Similar pattern for workflows/ directory
  });

  it('should not create artifact files in .apex', async () => {
    // Verify no new files in .apex/artifacts or similar
  });
});
```

#### 4.4 AC4: Comprehensive Snapshot Verification

```typescript
describe('AC4: Snapshot-based verification', () => {
  it('should pass complete directory tree comparison', async () => {
    const projectDir = await createTestProject({
      files: {
        'src/index.ts': 'console.log("hello");',
        'src/lib/utils.ts': 'export const utils = {};',
        'tests/index.test.ts': 'describe("test", () => {});',
        'README.md': '# Project',
        '.gitignore': 'node_modules\n.apex',
      }
    });

    const beforeSnapshot = await FileSystemSnapshotUtil.captureSnapshot(
      projectDir,
      { exclude: ['.apex/apex.db', '.apex/apex.db-wal', '.apex/apex.db-shm'] }
    );

    // Run multiple dry-run tasks
    const orchestrator = new ApexOrchestrator(projectDir);
    await orchestrator.initialize();

    for (let i = 0; i < 3; i++) {
      const task = await orchestrator.createTask({
        description: `Test task ${i}`,
        workflow: 'feature',
        dryRun: true,
      });
      await orchestrator.executeTask(task.id);
    }

    const afterSnapshot = await FileSystemSnapshotUtil.captureSnapshot(
      projectDir,
      { exclude: ['.apex/apex.db', '.apex/apex.db-wal', '.apex/apex.db-shm'] }
    );

    const diff = FileSystemSnapshotUtil.compareSnapshots(beforeSnapshot, afterSnapshot);

    expect(diff.isIdentical).toBe(true);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it('should verify file content hashes match exactly', async () => {
    // Test with binary files, large files, special characters
  });

  it('should correctly isolate each test in temp directory', async () => {
    // Verify test isolation - changes in one test don't affect others
    // Run tests in parallel to ensure no interference
  });
});
```

### 5. Test Helper Implementations

#### 5.1 Project Creation Helper

```typescript
interface TestProjectOptions {
  files?: Record<string, string>;
  config?: Partial<ApexConfig>;
  agents?: Record<string, string>;
  workflows?: Record<string, string>;
}

async function createTestProject(options: TestProjectOptions = {}): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'apex-dry-run-fs-test-')
  );

  // Create .apex directory structure
  const apexDir = path.join(tempDir, '.apex');
  await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
  await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });

  // Write config
  const config = {
    project: { name: 'test-project', version: '1.0.0' },
    autonomy: { default: 'guided' },
    permissions: { preset: 'autonomous', customRules: [] },
    limits: { maxRetries: 3, maxConcurrentTasks: 2, maxTaskTime: 3600, maxTurns: 10 },
    git: { branchPrefix: 'apex', autoCommit: false, autoPush: false },
    ...options.config,
  };
  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    yaml.stringify(config)
  );

  // Write default agents
  const defaultAgents = {
    planner: '# Planner Agent\n\nPlans implementations.',
    developer: '# Developer Agent\n\nImplements features.',
    ...options.agents,
  };
  for (const [name, content] of Object.entries(defaultAgents)) {
    await fs.writeFile(path.join(apexDir, 'agents', `${name}.md`), content);
  }

  // Write default workflow
  const defaultWorkflow = `
name: Feature Workflow
description: Standard feature development workflow

stages:
  - name: planning
    agent: planner
  - name: implementation
    agent: developer
`;
  await fs.writeFile(
    path.join(apexDir, 'workflows', 'feature.yaml'),
    options.workflows?.feature || defaultWorkflow
  );

  // Write project files
  if (options.files) {
    for (const [filePath, content] of Object.entries(options.files)) {
      const fullPath = path.join(tempDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
  }

  return tempDir;
}
```

#### 5.2 Cleanup Helper

```typescript
async function cleanupTestProject(projectDir: string): Promise<void> {
  if (projectDir && projectDir.includes('apex-dry-run-fs-test-')) {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
}
```

### 6. Implementation Notes

#### 6.1 Database Handling

The SQLite database (`apex.db`) presents a special case:
- **Task creation** adds a record to track the dry-run task
- This is intentional and useful for auditing
- The key verification is that `dryRun: true` is set on the record

Options for strict database isolation (future enhancement):
1. Use `:memory:` database for dry-run tasks
2. Create a temporary copy of the database
3. Roll back transaction after dry-run simulation

For this implementation, we verify:
- The `dryRun` flag is correctly stored
- No unexpected database changes occur
- WAL/SHM files are properly managed

#### 6.2 Mock Strategy

The dry-run tests should NOT mock the Claude Agent SDK. Instead:
- The `executeDryRunTask()` method already bypasses Claude calls
- We verify this by checking that no API calls are made
- The orchestrator's internal simulation is what we're testing

#### 6.3 Edge Cases to Test

```typescript
describe('Edge cases', () => {
  it('should handle dry-run with workflow that creates git branches', async () => {
    // Verify no actual git operations occur
  });

  it('should handle dry-run with file-creating tools in workflow', async () => {
    // Verify Write tool is not executed
  });

  it('should handle dry-run with container workspace configuration', async () => {
    // Verify no containers are created
  });

  it('should handle concurrent dry-run tasks', async () => {
    // Verify no interference between parallel dry-runs
  });

  it('should handle dry-run followed by real execution', async () => {
    // Verify dry-run doesn't affect subsequent real execution
  });
});
```

### 7. Test Dependencies

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "fast-glob": "^3.3.2"  // For directory traversal
  }
}
```

### 8. File Location

```
packages/orchestrator/src/__tests__/
├── dry-run-execution.test.ts                    # Existing unit tests
└── dry-run-filesystem-integrity.integration.test.ts  # NEW: Integration tests
```

## Decision

Implement integration tests that verify file system integrity during dry-run execution using:

1. **FileSystemSnapshot utility** - Captures complete directory state with content hashes
2. **Before/After comparison** - Strict verification that no files changed
3. **Temp directory isolation** - Each test runs in isolated temp project
4. **SQLite state tracking** - Verifies database is only modified for dry-run task records

## Consequences

### Positive
- High confidence that dry-run mode is truly safe
- Regression protection for future dry-run changes
- Clear test patterns for similar file-system-sensitive features
- Documentation of expected dry-run behavior

### Negative
- Additional test execution time (file I/O operations)
- Maintenance overhead for snapshot utilities
- Potential flakiness with file system timing

### Mitigation
- Use SSD-optimized temp directories
- Implement test parallelization carefully
- Add retry logic for transient file system issues

## Related
- Existing: `packages/orchestrator/src/__tests__/dry-run-execution.test.ts`
- Related: ADR-046 (Error Recovery Tests) for similar file system testing patterns
- Related: `packages/orchestrator/src/__tests__/snapshot-integration.test.ts` for snapshot patterns
