# Potential Build & Test Issues - Checkout Command

This document outlines potential issues that may arise during build and test execution, along with their solutions.

---

## Build Issues

### 1. TypeScript Compilation Errors

#### Import Resolution Errors
**Error**:
```
Cannot find module '@apexcli/core' or its corresponding type declarations
```

**Cause**: Core package not built before CLI package

**Solution**:
```bash
# Build packages in order
npm run build --workspace=@apexcli/core
npm run build --workspace=@apexcli/orchestrator
npm run build --workspace=@apexcli/cli

# Or use turbo to build all
npm run build
```

#### Type Errors for WorktreeInfo
**Error**:
```
Property 'WorktreeInfo' does not exist on type 'typeof import("@apexcli/core")'
```

**Cause**: WorktreeInfo not exported from core package

**Solution**: Verify that `WorktreeInfo` is exported in `/Users/s0v3r1gn/APEX/packages/core/src/index.ts`

#### Missing Method Errors
**Error**:
```
Property 'listTaskWorktrees' does not exist on type 'ApexOrchestrator'
```

**Cause**: Orchestrator methods not implemented or not exported

**Solution**: Verify implementation in `/Users/s0v3r1gn/APEX/packages/orchestrator/src/index.ts`

### 2. Module Resolution Errors

**Error**:
```
Module not found: Error: Can't resolve './handlers/daemon-handlers'
```

**Cause**: Import path incorrect or file not in dist

**Solution**: Check that all imported files exist and are included in the build output

### 3. Circular Dependency Issues

**Error**:
```
Circular dependency detected
```

**Cause**: Core, orchestrator, and CLI have circular imports

**Solution**: Ensure proper dependency hierarchy:
- core (no dependencies on other packages)
- orchestrator (depends on core)
- cli (depends on orchestrator and core)

---

## Test Execution Issues

### 1. Test Import Errors

#### Module Resolution in Tests
**Error**:
```
Cannot find module '../index.js' from 'src/__tests__/checkout-command.test.ts'
```

**Cause**: Test trying to import from dist instead of src

**Solution**: Ensure vitest config includes proper path resolution:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

#### Mock Issues
**Error**:
```
Cannot spy on property 'log' of [object Object] because it is not a function
```

**Cause**: Mock setup incorrect

**Solution**: Verify mock setup in test setup:
```typescript
const mockConsoleLog = vi.spyOn(console, 'log');
```

### 2. Integration Test Failures

#### Git Not Available
**Error**:
```
Error: Command failed: git worktree --help
```

**Cause**: Git or git worktree not available on test system

**Expected**: Tests should skip gracefully with message:
```
Skipping git worktree integration test - git worktree not available
```

#### Temporary Directory Issues
**Error**:
```
EACCES: permission denied, mkdir '/tmp/apex-worktrees'
```

**Cause**: Insufficient permissions in temp directory

**Solution**: Tests use `os.tmpdir()` which should be writable. If issue persists, check system temp permissions

#### Cleanup Failures
**Error**:
```
Failed to clean up temp directory: EBUSY: resource busy
```

**Cause**: File handles not released before cleanup

**Expected**: Warning message, not test failure. Tests include try-catch in afterEach

### 3. Mock and Assertion Issues

#### Chalk Mock Not Working
**Error**:
```
Expected stringContaining but received colored output
```

**Cause**: Chalk mock not applied correctly

**Solution**: Verify chalk mock in test file:
```typescript
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    // ... other colors
  },
}));
```

#### Console.log Not Captured
**Error**:
```
Expected console.log to have been called with...
```

**Cause**: Mock cleared before assertion

**Solution**: Ensure mock is set up in beforeEach and assertions happen before mockClear:
```typescript
beforeEach(() => {
  mockConsoleLog.mockClear();
});

// In test
await handler(ctx, args);
expect(mockConsoleLog).toHaveBeenCalledWith(...); // Before next test
```

### 4. Async/Timing Issues

#### Promise Not Resolved
**Error**:
```
Timeout of 5000ms exceeded
```

**Cause**: Async operation not completing

**Solution**:
- Check that all async operations in handler have proper await
- Verify mocks return resolved promises:
```typescript
mockOrchestrator.listTasks.mockResolvedValue([]);
```

#### Race Conditions in Tests
**Error**:
```
Expected mock function to have been called with X but was called with Y
```

**Cause**: Multiple async operations completing in unexpected order

**Solution**: Use proper async/await patterns:
```typescript
await checkoutCommand?.handler(mockContext, ['--list']);
// Wait for async operations to complete before assertions
```

### 5. Type Errors in Tests

#### Task Type Mismatch
**Error**:
```
Type 'Partial<Task>' is not assignable to type 'Task'
```

**Cause**: Mock task missing required fields

**Solution**: Use Partial<Task> for mocks or provide all required fields:
```typescript
const mockTask: Partial<Task> = {
  id: 'task-123',
  description: 'Test',
  status: 'in-progress',
  // ... other required fields
};
```

#### Context Type Issues
**Error**:
```
Type 'CliContext' is not assignable to parameter of type 'ApexContext'
```

**Cause**: Context type mismatch

**Solution**: Ensure test context matches expected type:
```typescript
const mockContext: CliContext = {
  cwd: '/test',
  initialized: true,
  config: { /* ... */ },
  orchestrator: mockOrchestrator,
  // ... all required fields
};
```

---

## Test Coverage Issues

### 1. Coverage Thresholds Not Met

**Warning**:
```
Coverage for branches (65%) does not meet threshold (70%)
```

**Cause**: Some error paths not tested

**Solution**: Add tests for error scenarios:
- Error thrown by orchestrator
- Network failures
- Invalid input handling

### 2. Uncovered Code Paths

**Common Uncovered Paths**:
1. Error catch blocks
2. Null/undefined checks
3. Edge case validations
4. Cleanup error handlers

**Solution**: Add tests specifically for these paths:
```typescript
it('should handle orchestrator errors', async () => {
  mockOrchestrator.listTasks.mockRejectedValue(new Error('DB error'));
  await handler(ctx, ['task-123']);
  expect(mockConsoleLog).toHaveBeenCalledWith(
    expect.stringContaining('Error: DB error')
  );
});
```

---

## Environment-Specific Issues

### 1. Operating System Differences

#### Path Separators
**Issue**: Tests fail on Windows due to path separator differences

**Solution**: Use path.join() and path.resolve() for cross-platform compatibility

#### Git Configuration
**Issue**: Git user.name/email not configured in CI

**Solution**: Integration tests set git config:
```bash
git config user.name "Test User"
git config user.email "test@example.com"
```

### 2. Node Version Issues

**Error**:
```
SyntaxError: Unexpected token '?'
```

**Cause**: Node version < 18.0.0

**Solution**: Ensure Node.js >= 18.0.0 (specified in package.json engines)

### 3. Package Manager Issues

**Error**:
```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Cause**: Package version conflicts

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

## Common Test Failures

### 1. Snapshot Mismatches

**Issue**: Console output doesn't match expected strings

**Common Causes**:
- Extra whitespace
- Different line endings
- Emoji encoding issues

**Solution**: Use flexible matchers:
```typescript
expect(mockConsoleLog).toHaveBeenCalledWith(
  expect.stringContaining('Task not found')
);
```

### 2. Time-Dependent Tests

**Issue**: Tests fail due to time differences

**Example**:
```typescript
// Flaky - depends on exact time
expect(timeAgo).toBe('2 hours ago');

// Better - use time ranges
expect(timeAgo).toMatch(/\d+ hours? ago/);
```

### 3. Mock State Leakage

**Issue**: Tests pass individually but fail when run together

**Cause**: Mocks not reset between tests

**Solution**: Use proper cleanup:
```typescript
afterEach(() => {
  vi.clearAllMocks();
  mockConsoleLog.mockClear();
});
```

---

## Debugging Tips

### 1. Enable Verbose Output

```bash
# Run tests with verbose output
npx vitest run --reporter=verbose

# Run specific test file with debugging
npx vitest run checkout-command.test.ts --reporter=verbose
```

### 2. Isolate Failing Tests

```typescript
// Run only this test
it.only('should handle task not found', async () => {
  // ...
});

// Skip this test
it.skip('should handle large task lists', async () => {
  // ...
});
```

### 3. Add Debug Logging

```typescript
it('should list worktrees', async () => {
  const worktrees = await ctx.orchestrator.listTaskWorktrees();
  console.log('Worktrees:', worktrees); // Debug output
  expect(worktrees).toHaveLength(2);
});
```

### 4. Check Mock Call History

```typescript
// See all calls to a mock
console.log(mockOrchestrator.listTasks.mock.calls);

// See call arguments
console.log(mockConsoleLog.mock.calls);
```

---

## Expected Test Output

### Successful Test Run

```
 ✓ packages/cli/src/__tests__/checkout-command.test.ts (20)
   ✓ Checkout Command (20)
     ✓ Command registration (2)
       ✓ should have checkout command registered with correct properties
       ✓ should be accessible via alias "co"
     ✓ Task worktree switching (5)
       ✓ should switch to task worktree when task exists
       ✓ should handle task not found
       ✓ should handle task without worktree
       ✓ should handle worktree switching errors
       ✓ should handle worktree not enabled error
     ✓ List worktrees (2)
       ✓ should list all task worktrees
       ✓ should handle empty worktrees list
     ✓ Cleanup orphaned worktrees (2)
       ✓ should clean up orphaned worktrees successfully
       ✓ should handle no orphaned worktrees
     ✓ Error handling (4)
       ✓ should handle uninitialized context
       ✓ should handle missing orchestrator
       ✓ should handle no arguments
       ✓ should handle general errors with helpful suggestions
     ✓ Partial task ID matching (2)
       ✓ should match task with partial ID
       ✓ should handle ambiguous partial ID
     ✓ Integration scenarios (3)
       ✓ should provide helpful guidance after successful checkout
       ✓ should handle various worktree statuses in list view
       ✓ should handle time formatting in worktree listing

 ✓ packages/cli/src/__tests__/checkout-command.integration.test.ts (14)
   ✓ Checkout Command Integration (14)
     ✓ Real worktree management (5)
     ✓ Command parsing and validation (3)
     ✓ Performance and edge cases (3)
     ✓ User experience (3)

 ✓ packages/cli/src/__tests__/checkout-command.edge-cases.test.ts (24)
   ✓ Checkout Command Edge Cases (24)
     ✓ Null and undefined handling (3)
     ✓ Extreme values and boundary conditions (5)
     ✓ Network and I/O error simulation (4)
     ✓ Malformed data handling (3)
     ✓ Race conditions and concurrency (3)
     ✓ Memory and resource constraints (2)
     ✓ Time and date handling edge cases (2)
     ✓ Configuration edge cases (2)

Test Files  3 passed (3)
     Tests  58 passed (58)
  Start at  XX:XX:XX
  Duration  XXXms
```

### Test Warnings (Expected)

```
WARN  Git worktree command not available, skipping integration test
WARN  Failed to clean up temp directory: /tmp/apex-test-xxx
```

These warnings are expected and handled gracefully by the tests.

---

## Resolution Checklist

When encountering build/test issues:

1. ✅ Check Node.js version (>= 18.0.0)
2. ✅ Clean install dependencies: `rm -rf node_modules && npm install`
3. ✅ Build packages in order: `npm run build`
4. ✅ Run type checking: `npm run typecheck`
5. ✅ Check test configuration: vitest.config.ts
6. ✅ Verify mock setup in test files
7. ✅ Run tests in isolation: `npx vitest run <test-file>`
8. ✅ Check for circular dependencies
9. ✅ Verify import paths are correct
10. ✅ Review test cleanup (afterEach blocks)

---

## Getting Help

If issues persist:

1. **Review Test Output**: Check exact error message and stack trace
2. **Check Documentation**: Review test coverage markdown
3. **Run Individual Tests**: Isolate the failing test
4. **Check Mock Configuration**: Verify all mocks are set up correctly
5. **Review Recent Changes**: Use git diff to see what changed

---

**Document Version**: 1.0
**Last Updated**: 2025-12-24
