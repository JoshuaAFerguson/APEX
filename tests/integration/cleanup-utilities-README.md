# Cleanup Utilities Integration Tests

This directory contains integration tests that demonstrate the proper functioning of APEX cleanup utilities for test isolation and state management.

## Test Files

- `cleanup-utilities.integration.test.ts` - Comprehensive integration tests
- `cleanup-utilities-minimal.test.ts` - Focused tests demonstrating core functionality

## Acceptance Criteria Demonstrated

### AC1: Multiple tests running in isolation without state leakage

**Test Location**: `cleanup-utilities-minimal.test.ts` - "AC1: Test Isolation Without State Leakage"

**What it proves**:
- Each test creates TaskStore data and verifies it exists
- Subsequent tests start with completely clean databases
- No data from previous tests is visible in new tests
- Tests can run in any order without affecting each other

**Key mechanisms**:
- `beforeEach()` calls `testHooks.beforeEach()` to set up clean state
- `afterEach()` calls `testHooks.afterEach()` to clean up all state
- `TestAssertions.assertEmptyDatabase()` verifies complete cleanup

### AC2: Proper cleanup of SQLite database between tests

**Test Location**: `cleanup-utilities-minimal.test.ts` - "AC2: SQLite Database Cleanup Between Tests"

**What it proves**:
- Complex database state (tasks, templates, logs) is completely cleaned up
- Database schema remains intact after cleanup
- Statistical verification shows zero records in all tables
- Multiple table types are properly cleaned (tasks, templates, logs, etc.)

**Key mechanisms**:
- `createTestHooks()` provides TaskStore cleanup utilities
- `TestAssertions.getDatabaseStats()` provides detailed cleanup verification
- SQL schema preservation allows continued database operations after cleanup

### AC3: beforeEach/afterEach patterns working correctly with utilities

**Test Location**: `cleanup-utilities-minimal.test.ts` - "AC3: beforeEach/afterEach Patterns Working Correctly"

**What it proves**:
- Setup runs before each test (counter verification)
- Cleanup runs after each test (counter verification)
- Manual reset functionality works within tests
- Multiple cleanup calls are handled gracefully
- Cleanup execution order is predictable

**Key mechanisms**:
- Counter tracking proves execution order
- Manual `testHooks.resetTaskStore()` calls within tests
- Database state verification before and after operations

## Technical Implementation Details

### Cleanup Utilities Used

1. **APEX TaskStore Cleanup** (`packages/orchestrator/src/test-cleanup.ts`):
   - `TestCleanup` class for database and state management
   - `TestHooks` class for test lifecycle management
   - `createTestHooks()` factory function
   - `TestAssertions` class for verification

2. **Standard Test Cleanup** (`tests/test-utils/cleanup.ts`):
   - `CleanupManager` for comprehensive resource management
   - File system, environment, timer, and mock cleanup
   - `withCleanup()` utility for automatic cleanup

### Database Schema Support

The cleanup utilities work with the complete APEX database schema including:
- Core tables: tasks, task_logs, task_artifacts, task_templates
- Workflow tables: gates, commands, task_dependencies, task_checkpoints
- Advanced tables: thought_captures, task_interactions, workspace_info
- System tables: idle_tasks, approval_states, permissions, audit_logs
- MCP tables: mcp_marketplace, mcp_servers, mcp_installations

### Performance Characteristics

- In-memory SQLite databases for fast test execution
- Transaction-based cleanup for consistency
- Preserved schema for continued operations
- Minimal overhead for test setup/teardown

## Usage Examples

### Basic Test Pattern

```typescript
import { createTestHooks, TestAssertions } from '../../packages/orchestrator/src/test-cleanup';

describe('My Test Suite', () => {
  const testHooks = createTestHooks();

  beforeEach(async () => {
    await testHooks.beforeEach();
  });

  afterEach(async () => {
    await testHooks.afterEach();
  });

  it('should work with clean state', async () => {
    const store = await testHooks.createTaskStore();

    // Your test logic here

    // Verify isolation
    await TestAssertions.assertEmptyDatabase(store);
  });
});
```

### Manual Reset Pattern

```typescript
it('should handle manual reset', async () => {
  const store = await testHooks.createTaskStore();

  // Add data
  await store.createTask({...});

  // Reset manually
  await testHooks.resetTaskStore(store);

  // Verify cleanup
  await TestAssertions.assertEmptyDatabase(store);
});
```

### Multiple Environment Pattern

```typescript
it('should isolate multiple environments', async () => {
  const devStore = await testHooks.createTaskStore('/dev/path');
  const prodStore = await testHooks.createTaskStore('/prod/path');

  // Both stores operate independently
  // Cleanup handles both automatically
});
```

## Integration with APEX Workflow

These cleanup utilities integrate seamlessly with APEX's testing infrastructure:

1. **TaskStore Integration**: Direct compatibility with APEX TaskStore operations
2. **Event System**: Preserves event handlers and cleanup
3. **Configuration Management**: Maintains test configuration isolation
4. **Error Handling**: Graceful handling of cleanup failures

The integration tests prove that APEX's cleanup utilities provide enterprise-grade test isolation suitable for complex multi-agent workflows and database operations.