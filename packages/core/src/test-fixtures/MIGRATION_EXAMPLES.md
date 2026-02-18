# Migration Examples

This document shows concrete examples of migrating existing test files to use the APEX test setup and teardown utilities.

## Before and After Comparisons

### Example 1: CLI SessionStore Test

#### Before (Manual Pattern)
```typescript
// packages/cli/src/services/__tests__/SessionStore.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { SessionStore } from '../SessionStore';

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
}));

const mockFs = vi.mocked(fs);

describe('SessionStore', () => {
  let sessionStore: SessionStore;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectPath = '/test/project';
    sessionStore = new SessionStore(mockProjectPath);

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // tests...
});
```

#### After (Using Test Utilities)
```typescript
// packages/cli/src/services/__tests__/SessionStore.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCLITestSuite, setTestData, getTestData } from '@apex/core/test-fixtures';
import { SessionStore } from '../SessionStore';

describe('SessionStore', () => {
  const suite = createCLITestSuite({
    mockFileSystem: {
      '/test/project/.apex/sessions/session1.json': '{"id": "session1"}',
      '/test/project/.apex/config.yaml': 'project: test'
    },
    customSetup: () => {
      const sessionStore = new SessionStore('/test/project');
      setTestData('sessionStore', sessionStore);
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should load sessions', async () => {
    const store = getTestData('sessionStore');
    const sessions = await store.loadSessions();
    expect(sessions).toHaveLength(1);
  });
});
```

**Benefits of Migration:**
- 15 lines reduced to 8 lines
- No manual mock setup
- Automatic cleanup handling
- Consistent patterns across tests

### Example 2: Orchestrator Test

#### Before (Manual Pattern)
```typescript
describe('ApexOrchestrator', () => {
  let orchestrator: ApexOrchestrator;
  let mockTaskStore: any;
  let mockClaudeSDK: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskStore = {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      getTask: vi.fn()
    };
    mockClaudeSDK = {
      query: vi.fn()
    };

    // Mock environment variables
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('NODE_ENV', 'test');

    orchestrator = new ApexOrchestrator({
      projectPath: '/test/project',
      taskStore: mockTaskStore,
      claudeSDK: mockClaudeSDK
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  // tests...
});
```

#### After (Using Test Utilities)
```typescript
describe('ApexOrchestrator', () => {
  const suite = createOrchestratorTestSuite({
    timeout: 60000,
    customSetup: () => {
      const orchestrator = new ApexOrchestrator({
        projectPath: '/test/project'
      });
      setTestData('orchestrator', orchestrator);
    }
  });

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  // tests...
});
```

### Example 3: Timer-based Test

#### Before (Manual Pattern)
```typescript
describe('Delayed Operations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle timeout', () => {
    const callback = vi.fn();
    setTimeout(callback, 5000);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalled();
  });
});
```

#### After (Using Test Utilities)
```typescript
import { createTimerTestSuite, advanceTimers } from '@apex/core/test-fixtures';

describe('Delayed Operations', () => {
  const suite = createTimerTestSuite();

  beforeEach(suite.beforeEach);
  afterEach(suite.afterEach);

  it('should handle timeout', async () => {
    const callback = vi.fn();
    setTimeout(callback, 5000);

    expect(callback).not.toHaveBeenCalled();
    await advanceTimers(5000);
    expect(callback).toHaveBeenCalled();
  });
});
```

## Migration Checklist

When migrating a test file:

1. **Identify the package type** (CLI, Orchestrator, Core, API)
2. **Choose the appropriate helper** (`createCLITestSuite`, `createOrchestratorTestSuite`, etc.)
3. **Move file system mocks** to `mockFileSystem` option
4. **Move environment variables** to `mockEnvVars` option
5. **Move initialization code** to `customSetup` function
6. **Use `setTestData`/`getTestData`** for sharing instances between setup and tests
7. **Replace manual beforeEach/afterEach** with suite hooks
8. **Add cleanup tasks** using `addCleanupTask` if needed

## Common Patterns

### File System Mocking
```typescript
// Before
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockImplementation((path) => {
    if (path === '/config.yaml') return 'project: test';
    throw new Error('File not found');
  })
}));

// After
const suite = createCLITestSuite({
  mockFileSystem: {
    '/config.yaml': 'project: test'
  }
});
```

### Environment Variables
```typescript
// Before
vi.stubEnv('APEX_PROJECT_PATH', '/test');
vi.stubEnv('NODE_ENV', 'test');

// After
const suite = createCLITestSuite({
  mockEnvVars: {
    APEX_PROJECT_PATH: '/test',
    NODE_ENV: 'test'
  }
});
```

### Custom Resource Cleanup
```typescript
// Before
let database;
beforeEach(async () => {
  database = await createTestDatabase();
});
afterEach(async () => {
  await database.close();
});

// After
const suite = createTestSuite({
  customSetup: async () => {
    const database = await createTestDatabase();
    setTestData('database', database);
    addCleanupTask(() => database.close());
  }
});
```

### Shared Test State
```typescript
// Before
let userSession;
beforeEach(() => {
  userSession = { userId: '123', token: 'abc' };
});

// After
const suite = createTestSuite({
  customSetup: () => {
    setTestData('userSession', { userId: '123', token: 'abc' });
  }
});

// In tests
const session = getTestData('userSession');
```

## Migration Benefits

1. **Consistency** - All tests follow the same patterns
2. **Reduced Boilerplate** - Less repetitive setup code
3. **Better Cleanup** - Automatic resource cleanup prevents test pollution
4. **Error Resilience** - Cleanup continues even if individual tasks fail
5. **Easier Maintenance** - Changes to test patterns happen in one place
6. **Package-Specific Optimizations** - Each helper is tuned for its package's needs

## Next Steps

After migrating a test file:

1. **Run the tests** to ensure they still pass
2. **Check for test isolation** by running tests multiple times
3. **Look for cleanup issues** by checking if tests affect each other
4. **Submit a PR** with the migration for review

See `USAGE_GUIDE.md` for more comprehensive examples and patterns.