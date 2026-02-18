# Test Utilities Quick Reference

## Basic Usage

```typescript
import { createTestSuite } from '@apex/core/test-fixtures';

const suite = createTestSuite();
beforeEach(suite.beforeEach);
afterEach(suite.afterEach);
```

## Package-Specific Helpers

### CLI Tests
```typescript
import { createCLITestSuite } from '@apex/core/test-fixtures';

const suite = createCLITestSuite({
  mockFileSystem: { '/file.txt': 'content' },
  mockEnvVars: { VAR: 'value' }
});
```

### Orchestrator Tests
```typescript
import { createOrchestratorTestSuite } from '@apex/core/test-fixtures';

const suite = createOrchestratorTestSuite({
  mockAgents: ['planner', 'developer'],
  timeout: 60000
});
```

### Core Tests
```typescript
import { createCoreTestSuite } from '@apex/core/test-fixtures';

const suite = createCoreTestSuite();
```

### Timer Tests
```typescript
import { createTimerTestSuite, advanceTimers } from '@apex/core/test-fixtures';

const suite = createTimerTestSuite();
// Use advanceTimers(ms) in tests
```

## Sharing Data Between Setup and Tests

```typescript
import { setTestData, getTestData } from '@apex/core/test-fixtures';

// In customSetup
setTestData('myService', new MyService());

// In test
const service = getTestData('myService');
```

## Custom Cleanup

```typescript
import { addCleanupTask } from '@apex/core/test-fixtures';

// In test or customSetup
const resource = openResource();
addCleanupTask(() => resource.close());
```

## Common Configurations

### Full Mocking
```typescript
const suite = createTestSuite({
  setupMocks: true,
  mockConfig: {
    mockFs: true,
    mockNetwork: true,
    mockTimers: true
  }
});
```

### File System Only
```typescript
const suite = createTestSuite({
  setupMocks: true,
  mockConfig: {
    mockFs: true,
    mockData: {
      fileSystemData: { '/file.txt': 'content' }
    }
  }
});
```

### Custom Setup/Teardown
```typescript
const suite = createTestSuite({
  customSetup: async () => {
    // Initialize resources
  },
  customTeardown: async () => {
    // Clean up resources
  }
});
```

## Migration Pattern

Replace this:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // manual setup
});

afterEach(() => {
  vi.resetAllMocks();
  // manual cleanup
});
```

With this:
```typescript
const suite = createTestSuite({
  setupMocks: true,
  customSetup: () => {
    // setup logic here
  }
});

beforeEach(suite.beforeEach);
afterEach(suite.afterEach);
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `createTestSuite(config)` | Main function - creates setup/teardown hooks |
| `createCLITestSuite(options)` | Pre-configured for CLI package tests |
| `createOrchestratorTestSuite(options)` | Pre-configured for orchestrator tests |
| `createCoreTestSuite(options)` | Minimal setup for pure logic tests |
| `createTimerTestSuite(options)` | Pre-configured with fake timers |
| `setTestData(key, value)` | Store data for test duration |
| `getTestData(key)` | Retrieve test data |
| `addCleanupTask(fn)` | Register cleanup function |
| `advanceTimers(ms)` | Advance fake timers |
| `flushTimers()` | Run all pending timers |

See `USAGE_GUIDE.md` for comprehensive examples and `MIGRATION_EXAMPLES.md` for migration patterns.