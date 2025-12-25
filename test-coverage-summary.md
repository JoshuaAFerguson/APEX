# Test Coverage Summary for checkout --cleanup <taskId> Feature

## Feature Overview
The checkout --cleanup command has been extended to support an optional taskId argument for manual single-task worktree cleanup functionality.

## Test Coverage Achieved

### Unit Tests for ApexOrchestrator.cleanupTaskWorktree()
Location: `/packages/orchestrator/src/index.test.ts`

✅ **Error Handling Tests:**
1. Throws error when worktree management is not enabled
2. Throws error when taskId is empty string
3. Propagates errors from WorktreeManager

✅ **Success Path Tests:**
1. Successfully delegates to WorktreeManager.deleteWorktree() and returns true
2. Returns false when worktree doesn't exist

### CLI Integration Tests for checkout --cleanup <taskId>
Location: `/packages/cli/src/__tests__/checkout-command.test.ts`

✅ **Command Structure Tests:**
1. Usage string includes `[<task_id>]` parameter
2. Help text shows both `--cleanup` and `--cleanup <task_id>` options

✅ **Functionality Tests:**
1. Successfully cleans up worktree for specific task (partial ID matching)
2. Shows success message with task ID and description
3. Handles task not found scenarios
4. Handles cleanup failures (returns false)
5. Handles cleanup errors (exceptions thrown)
6. Handles worktree management not enabled errors

✅ **Edge Cases Tests:**
1. Partial task ID matching works correctly
2. Error messages provide helpful guidance
3. Mock orchestrator interactions are verified

### Existing WorktreeManager Tests
Location: `/packages/orchestrator/src/worktree-manager.test.ts`

✅ **WorktreeManager.deleteWorktree() is fully tested:**
1. Successfully deletes existing worktrees
2. Returns false for non-existent worktrees
3. Handles empty task IDs
4. Error handling for filesystem issues

## Test Files Created/Modified

### Modified Files:
1. **`/packages/orchestrator/src/index.test.ts`** - Added 5 new unit tests for `cleanupTaskWorktree` method

### Existing Test Files (Already Comprehensive):
1. **`/packages/cli/src/__tests__/checkout-command.test.ts`** - Contains 10+ tests covering the new CLI functionality
2. **`/packages/orchestrator/src/worktree-manager.test.ts`** - Comprehensive WorktreeManager tests
3. **`/packages/cli/src/__tests__/checkout-command.edge-cases.test.ts`** - Additional edge case coverage

## Coverage Verification

### New ApexOrchestrator Method Coverage:
- ✅ All branches tested (error paths and success paths)
- ✅ All guard clauses tested
- ✅ Input validation tested
- ✅ Delegation to WorktreeManager tested
- ✅ Error propagation tested

### CLI Command Coverage:
- ✅ Command parsing and argument handling
- ✅ Task ID resolution and partial matching
- ✅ Success and failure message output
- ✅ Error handling and user guidance
- ✅ Integration with orchestrator methods

## Acceptance Criteria Verification

✅ **CLI command '/checkout --cleanup <taskId>' cleans up worktree for specific task**
- Implemented and tested in CLI command handler
- Supports partial task ID matching
- Shows appropriate success/failure messages

✅ **Help text updated**
- Usage string shows optional `<task_id>` parameter
- Help output includes both cleanup options
- Error messages provide guidance

✅ **Unit tests verify single-task cleanup functionality**
- 5 new unit tests for ApexOrchestrator.cleanupTaskWorktree()
- Existing CLI integration tests cover end-to-end functionality
- WorktreeManager tests ensure underlying functionality works

All acceptance criteria have been met with comprehensive test coverage.