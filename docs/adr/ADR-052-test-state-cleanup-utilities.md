# ADR-052: Test State Cleanup Utilities Architecture

## Status

Accepted

## Context

APEX requires comprehensive test isolation to ensure reliable test execution. Tests that share state (database connections, in-memory state, mock objects, event listeners, temporary files) can lead to flaky tests and false positives/negatives. The current test infrastructure has various cleanup mechanisms scattered across packages, but lacks a unified, comprehensive approach for test state isolation.

### Current State

The existing test utilities include:
- `tests/test-utils/cleanup.ts` - General cleanup managers for files, processes, mocks, timers, environment
- `tests/test-utils/context.ts` - Test context management with temp directories
- `packages/orchestrator/src/test-utils/db.ts` - In-memory SQLite database utilities
- `packages/orchestrator/src/test-utils.ts` - TaskStore-specific test utilities
- `packages/core/src/test-utils/` - Mock tools and browser utilities

### Requirements

1. **Hooks for beforeEach/afterEach patterns** - Consistent setup/teardown hooks
2. **Database cleanup helpers for SQLite TaskStore** - Complete database state reset
3. **In-memory state reset functions** - Clear singletons, caches, event listeners

## Decision

Implement a centralized **State Cleanup Utilities** module that provides:

### 1. Test Lifecycle Hooks

```typescript
// Usage pattern
import { createTestHarness } from '@apex/test-utils';

const harness = createTestHarness({
  database: true,
  mockOrchestrator: true,
  tempFiles: true
});

beforeEach(async () => {
  await harness.setup();
});

afterEach(async () => {
  await harness.teardown();
});
```

### 2. Database Cleanup Utilities

Three levels of database cleanup:

1. **`clearTestDatabase(db)`** - Truncate all tables, preserve schema
2. **`resetTestDatabase(db)`** - Drop and recreate all tables
3. **`cleanupTestDatabase(context)`** - Close connection and cleanup

```typescript
interface DatabaseCleanupOptions {
  preserveSchema?: boolean;     // Keep tables, truncate data (default: true)
  preserveReferenceData?: boolean; // Keep workflow/agent definitions
  tables?: string[];            // Specific tables to clean (default: all)
}
```

### 3. In-Memory State Reset

```typescript
interface StateResetManager {
  // Registry for resettable state
  register(name: string, resetFn: () => void | Promise<void>): void;

  // Reset all registered state
  resetAll(): Promise<void>;

  // Reset specific state
  reset(name: string): Promise<void>;

  // Built-in reset functions
  resetEventEmitters(): void;
  resetSingletons(): void;
  resetMocks(): void;
  resetTimers(): void;
}
```

### 4. Composable Cleanup Strategies

```typescript
// Composable cleanup strategies
const strategies = {
  database: new DatabaseCleanupStrategy(),
  filesystem: new FilesystemCleanupStrategy(),
  mocks: new MockCleanupStrategy(),
  events: new EventCleanupStrategy(),
  timers: new TimerCleanupStrategy(),
  environment: new EnvironmentCleanupStrategy()
};

// Compose into test harness
const harness = new TestHarness()
  .use(strategies.database)
  .use(strategies.filesystem)
  .use(strategies.mocks);
```

## Architecture

### Module Structure

```
tests/test-utils/
├── index.ts                    # Main export (existing)
├── state-cleanup/
│   ├── index.ts               # Re-export all cleanup utilities
│   ├── types.ts               # Shared types and interfaces
│   ├── harness.ts             # TestHarness class
│   ├── database-cleanup.ts    # Database-specific cleanup
│   ├── state-reset.ts         # In-memory state reset
│   ├── event-cleanup.ts       # Event emitter cleanup
│   └── strategies/
│       ├── base.ts            # CleanupStrategy interface
│       ├── database.ts        # DatabaseCleanupStrategy
│       ├── filesystem.ts      # FilesystemCleanupStrategy
│       ├── mocks.ts           # MockCleanupStrategy
│       └── timers.ts          # TimerCleanupStrategy
└── __tests__/
    └── state-cleanup.test.ts  # Tests for cleanup utilities
```

### Key Interfaces

```typescript
/**
 * Core cleanup strategy interface
 */
interface CleanupStrategy {
  name: string;
  setup(): Promise<void>;
  teardown(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * Test harness configuration
 */
interface TestHarnessConfig {
  // Enable database isolation
  database?: boolean | DatabaseCleanupOptions;

  // Enable filesystem cleanup
  filesystem?: boolean | { tempDir?: string };

  // Enable mock reset
  mocks?: boolean;

  // Enable event listener cleanup
  events?: boolean;

  // Enable timer cleanup
  timers?: boolean;

  // Custom cleanup strategies
  strategies?: CleanupStrategy[];
}

/**
 * Main test harness interface
 */
interface TestHarness {
  // Lifecycle methods
  setup(): Promise<void>;
  teardown(): Promise<void>;

  // Access to underlying resources
  database?: TestDatabaseContext;
  tempDir?: string;

  // State management
  reset(): Promise<void>;

  // Fluent API for adding strategies
  use(strategy: CleanupStrategy): TestHarness;
}
```

### Database Cleanup Implementation

```typescript
/**
 * Database cleanup for TaskStore
 */
class DatabaseCleanupStrategy implements CleanupStrategy {
  name = 'database';
  private context?: TestDatabaseContext;

  constructor(private options: DatabaseCleanupOptions = {}) {}

  async setup(): Promise<void> {
    this.context = await createTestDatabase();
  }

  async teardown(): Promise<void> {
    if (this.context) {
      cleanupTestDatabase(this.context);
    }
  }

  async reset(): Promise<void> {
    if (!this.context) return;

    if (this.options.preserveSchema !== false) {
      await this.truncateAllTables();
    } else {
      await this.teardown();
      await this.setup();
    }
  }

  private async truncateAllTables(): Promise<void> {
    const tables = this.options.tables ?? [
      'tasks', 'task_logs', 'task_artifacts', 'gates',
      'task_dependencies', 'task_checkpoints', 'thought_captures',
      'task_interactions', 'workspace_info', 'idle_tasks',
      'task_iterations', 'task_templates', 'todos',
      'approval_states', 'file_snapshots', 'tool_actions',
      'snapshots', 'permissions', 'mcp_marketplace',
      'mcp_servers', 'mcp_installations', 'fix_attempts',
      'audit_logs', 'commands'
    ];

    // Disable foreign key checks temporarily
    this.context!.db.exec('PRAGMA foreign_keys = OFF');

    for (const table of tables) {
      this.context!.db.exec(`DELETE FROM ${table}`);
    }

    // Re-enable foreign key checks
    this.context!.db.exec('PRAGMA foreign_keys = ON');
  }
}
```

### Event Cleanup Implementation

```typescript
/**
 * Event emitter cleanup for test isolation
 */
class EventCleanupStrategy implements CleanupStrategy {
  name = 'events';
  private trackedEmitters: Set<EventEmitter> = new Set();

  async setup(): Promise<void> {
    // Nothing to setup - will track emitters as they're registered
  }

  async teardown(): Promise<void> {
    for (const emitter of this.trackedEmitters) {
      emitter.removeAllListeners();
    }
    this.trackedEmitters.clear();
  }

  async reset(): Promise<void> {
    await this.teardown();
  }

  track(emitter: EventEmitter): void {
    this.trackedEmitters.add(emitter);
  }
}
```

## Usage Patterns

### Basic Usage

```typescript
import { createTestHarness } from 'tests/test-utils';

describe('TaskStore Operations', () => {
  const harness = createTestHarness({ database: true });

  beforeEach(() => harness.setup());
  afterEach(() => harness.teardown());

  it('should create task', async () => {
    const store = new TaskStore(harness.tempDir!);
    store.setDatabase(harness.database!.db);
    // Test logic...
  });
});
```

### Advanced Usage with Custom Strategies

```typescript
import {
  createTestHarness,
  DatabaseCleanupStrategy,
  MockCleanupStrategy
} from 'tests/test-utils';

describe('Integration Tests', () => {
  const harness = createTestHarness()
    .use(new DatabaseCleanupStrategy({ preserveSchema: true }))
    .use(new MockCleanupStrategy());

  beforeAll(() => harness.setup());
  afterAll(() => harness.teardown());
  beforeEach(() => harness.reset());

  // Tests with shared setup but isolated state...
});
```

### State Reset Between Tests

```typescript
import { StateResetManager } from 'tests/test-utils';

const stateManager = new StateResetManager();

// Register custom resettable state
stateManager.register('myCache', () => myCache.clear());
stateManager.register('configSingleton', () => ConfigSingleton.reset());

beforeEach(async () => {
  await stateManager.resetAll();
});
```

## Consequences

### Positive

1. **Consistent test isolation** - All tests use the same cleanup patterns
2. **Reduced test flakiness** - State leakage between tests eliminated
3. **Composable architecture** - Easy to add new cleanup strategies
4. **Clear ownership** - Centralized location for cleanup logic
5. **Reusable across packages** - Shared test utilities benefit all packages

### Negative

1. **Additional complexity** - More infrastructure to maintain
2. **Learning curve** - Developers need to understand the harness API
3. **Potential overhead** - Full cleanup may be slower than minimal cleanup

### Mitigation

- Document common usage patterns
- Provide sensible defaults that work for most tests
- Allow granular control for performance-sensitive tests

## Integration Points

### Package Integration

- **@apex/core**: Browser mocks, tool type mocks
- **@apex/orchestrator**: TaskStore, database cleanup
- **@apex/cli**: Session store, UI component state
- **@apex/api**: Server cleanup, WebSocket state

### Vitest Integration

```typescript
// vitest.setup.ts
import { setupGlobalTestEnvironment } from 'tests/test-utils';

setupGlobalTestEnvironment({
  autoCleanup: true,
  databaseIsolation: true
});
```

## References

- Existing: `tests/test-utils/cleanup.ts`
- Existing: `packages/orchestrator/src/test-utils/db.ts`
- Vitest best practices: https://vitest.dev/guide/test-context.html
