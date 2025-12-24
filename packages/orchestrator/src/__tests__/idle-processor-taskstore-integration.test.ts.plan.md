# Architecture Decision Record (ADR): Integration Tests for IdleProcessor-IdleTaskGenerator-TaskStore Flow

## Status
**Proposed** - Pending implementation approval

## Context
The acceptance criteria require integration tests that verify:
1. Auto-generated tasks have `priority='low'`
2. Tasks are persisted to the `idle_tasks` table
3. Tasks can be promoted to real tasks in the `tasks` table
4. Promoted tasks reference the original `idle_task_id`

Currently, there are existing tests covering parts of this flow:
- `store.test.ts` - Unit tests for TaskStore CRUD operations including idle tasks
- `idle-task-generator.integration.test.ts` - Integration tests for task generation
- `idle-processor-database-integration.test.ts` - Database integration for IdleProcessor

However, there is **no single test file** that covers the complete **end-to-end integration flow** from IdleProcessor through IdleTaskGenerator to TaskStore with real database persistence.

## Decision

### Test File Structure
Create a new integration test file:
```
packages/orchestrator/src/__tests__/idle-processor-taskstore-flow.integration.test.ts
```

### Test Architecture

#### 1. Test Setup Pattern
```typescript
// Use real SQLite database (like store.test.ts pattern)
beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-idle-flow-test-'));
  await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

  // Real TaskStore with real database
  store = new TaskStore(testDir);
  await store.initialize();

  // Real IdleProcessor (uses real IdleTaskGenerator internally)
  processor = new IdleProcessor(testDir, config, store);
});

afterEach(async () => {
  store.close();
  await fs.rm(testDir, { recursive: true, force: true });
});
```

#### 2. Test Categories

**Category A: Priority='low' Verification**
```typescript
describe('Auto-generated tasks have priority="low"', () => {
  it('should set priority to "low" for all generated idle tasks');
  it('should maintain priority="low" regardless of analysis severity');
  it('should persist priority="low" to database correctly');
});
```

**Category B: Persistence to idle_tasks Table**
```typescript
describe('Tasks are persisted to idle_tasks table', () => {
  it('should persist generated tasks to database');
  it('should store all required fields correctly');
  it('should generate unique IDs with idle_ prefix');
  it('should persist createdAt timestamp');
  it('should default implemented to false');
});
```

**Category C: Promotion to tasks Table**
```typescript
describe('Tasks can be promoted to regular tasks', () => {
  it('should create new task in tasks table on promotion');
  it('should copy description and acceptance criteria');
  it('should preserve priority on promotion');
  it('should use suggestedWorkflow as task workflow');
});
```

**Category D: Foreign Key Reference**
```typescript
describe('Promoted tasks reference original idle_task_id', () => {
  it('should set implementedTaskId on idle task after promotion');
  it('should mark idle task as implemented=true');
  it('should maintain referential integrity');
  it('should prevent double-promotion');
});
```

#### 3. Integration Flow Test
```typescript
describe('Complete IdleProcessor -> IdleTaskGenerator -> TaskStore flow', () => {
  it('should generate, persist, and promote tasks end-to-end', async () => {
    // 1. Trigger idle processing
    await processor.processIdleTime();

    // 2. Verify tasks generated with priority='low'
    const idleTasks = await store.listIdleTasks();
    expect(idleTasks.length).toBeGreaterThan(0);
    expect(idleTasks.every(t => t.priority === 'low')).toBe(true);

    // 3. Verify persistence in idle_tasks table
    for (const task of idleTasks) {
      const dbTask = await store.getIdleTask(task.id);
      expect(dbTask).not.toBeNull();
      expect(dbTask!.id).toMatch(/^idle_/);
      expect(dbTask!.implemented).toBe(false);
    }

    // 4. Promote first task
    const firstTask = idleTasks[0];
    const realTaskId = await store.promoteIdleTask(firstTask.id, {
      workflow: firstTask.suggestedWorkflow,
      autonomy: 'full',
      projectPath: testDir,
    });

    // 5. Verify task created in tasks table
    const realTask = await store.getTask(realTaskId);
    expect(realTask).not.toBeNull();
    expect(realTask!.description).toBe(firstTask.description);

    // 6. Verify idle task references the promoted task
    const updatedIdleTask = await store.getIdleTask(firstTask.id);
    expect(updatedIdleTask!.implemented).toBe(true);
    expect(updatedIdleTask!.implementedTaskId).toBe(realTaskId);
  });
});
```

### Key Design Decisions

#### Decision 1: Real Database vs Mocks
**Choice**: Use real SQLite database
**Rationale**: Integration tests should verify actual persistence. Mocks would only test interface contracts, not actual database operations.

#### Decision 2: Test Isolation
**Choice**: Create temporary directory per test with unique timestamp
**Rationale**: Ensures tests are isolated and can run in parallel without conflicts.

#### Decision 3: Event Verification
**Choice**: Include event emission verification using spies
**Rationale**: IdleProcessor emits events during processing; verifying these ensures the integration is complete.

#### Decision 4: Error Case Coverage
**Choice**: Include error scenarios (promotion of non-existent task, double-promotion)
**Rationale**: Ensures the integration handles edge cases correctly.

### Database Schema Reference

```sql
-- idle_tasks table
CREATE TABLE idle_tasks (
  id TEXT PRIMARY KEY,              -- Pattern: idle_[timestamp]_[random]
  type TEXT NOT NULL,               -- 'maintenance'|'refactoring'|'docs'|'tests'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,           -- Always 'low' for auto-generated
  estimated_effort TEXT NOT NULL,
  suggested_workflow TEXT NOT NULL,
  rationale TEXT NOT NULL,
  created_at TEXT NOT NULL,
  implemented BOOLEAN DEFAULT 0,
  implemented_task_id TEXT,         -- FK to tasks.id (set on promotion)
  FOREIGN KEY (implemented_task_id) REFERENCES tasks(id)
);
```

### Component Interaction Diagram

```
┌─────────────────┐      ┌───────────────────┐      ┌─────────────┐
│  IdleProcessor  │─────▶│ IdleTaskGenerator │─────▶│  TaskStore  │
│                 │      │                   │      │             │
│ processIdleTime │      │ generateTask()    │      │ createIdleTask()
│ implementIdleTask│     │ priority='low'    │      │ promoteIdleTask()
└─────────────────┘      └───────────────────┘      │ getIdleTask()
                                                     │ listIdleTasks()
                                                     └─────────────┘
                                                           │
                                                           ▼
                                                    ┌─────────────┐
                                                    │   SQLite    │
                                                    │ idle_tasks  │
                                                    │   tasks     │
                                                    └─────────────┘
```

### Test Data Fixtures

```typescript
const createMinimalProjectAnalysis = (): ProjectAnalysis => ({
  codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
  testCoverage: { percentage: 50, uncoveredFiles: ['src/uncovered.ts'] },
  dependencies: { outdated: ['old-dep@1.0.0'], security: [] },
  codeQuality: {
    lintIssues: 10,
    duplicatedCode: [],
    complexityHotspots: [],
    codeSmells: []
  },
  documentation: {
    coverage: 50,
    missingDocs: ['src/undocumented.ts'],
    outdatedDocs: [],
    undocumentedExports: [],
    missingReadmeSections: [],
    apiCompleteness: { documented: 50, undocumented: 50 }
  },
  performance: { slowTests: [], bottlenecks: [] },
  testAnalysis: {
    branchCoverage: { percentage: 60, uncoveredBranches: [] },
    untestedExports: [],
    missingIntegrationTests: [],
    antiPatterns: []
  }
});
```

## Consequences

### Positive
- Complete coverage of the acceptance criteria
- Real database testing ensures persistence correctness
- Test isolation prevents flaky tests
- Follows existing test patterns in the codebase

### Negative
- Requires temporary file system access (acceptable for integration tests)
- Slightly slower than unit tests with mocks
- Depends on IdleTaskGenerator implementation details for priority verification

### Risks
- Database file locking on Windows (mitigated by unique temp directories)
- Test cleanup failures on CI (mitigated by afterEach cleanup with error handling)

## Implementation Notes

1. **File Location**: `packages/orchestrator/src/__tests__/idle-processor-taskstore-flow.integration.test.ts`
2. **Dependencies**: vitest, fs/promises, path, os
3. **Imports**: TaskStore, IdleProcessor, IdleTaskGenerator (for type checking)
4. **Test Count**: ~15-20 test cases across 4 categories plus 1 end-to-end flow test
