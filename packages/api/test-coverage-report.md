# Trash Management API Test Coverage Report

## Overview
Comprehensive tests have been implemented and verified for all four trash management API endpoints.

## Tested Endpoints

### 1. POST /tasks/:id/trash
**Purpose**: Move task to trash (soft delete)

**Test Coverage**:
- ✅ Happy path: Successfully moves task to trash
- ✅ Error handling: Returns 404 for non-existent task
- ✅ Validation: Returns 400 if task is already in trash
- ✅ Response format: Proper JSON response with `ok: true` and message

### 2. POST /tasks/:id/restore
**Purpose**: Restore task from trash

**Test Coverage**:
- ✅ Happy path: Successfully restores task from trash
- ✅ Error handling: Returns 404 for non-existent task
- ✅ Validation: Returns 400 if task is not in trash
- ✅ Response format: Proper JSON response with `ok: true` and message

### 3. GET /tasks/trashed
**Purpose**: List all trashed tasks

**Test Coverage**:
- ✅ Happy path: Lists multiple trashed tasks with correct count
- ✅ Empty case: Returns empty array when no trashed tasks exist
- ✅ Response format: Returns `{ tasks: [], count: 0, message: string }`
- ✅ Filtering: Only returns tasks with `trashedAt` timestamp

### 4. DELETE /tasks/trash
**Purpose**: Permanently delete all trashed tasks

**Test Coverage**:
- ✅ Happy path: Permanently deletes all trashed tasks and returns count
- ✅ Empty case: Handles empty trash gracefully (deletedCount: 0)
- ✅ Response format: Returns `{ ok: true, deletedCount: number, message: string }`

## Integration Test Coverage

### Complete Trash Lifecycle Workflow
**Test**: create → trash → list → restore → empty

**Verifications**:
- ✅ Task initially appears in normal task list
- ✅ After trashing, task disappears from normal list
- ✅ Trashed task appears only in trashed list
- ✅ After restore, task disappears from trashed list
- ✅ Restored task reappears in normal list
- ✅ After permanent deletion, task is completely gone (returns 404)

## Error Scenarios Covered

1. **Invalid Task IDs**: All endpoints properly return 404 for non-existent tasks
2. **State Validation**:
   - Cannot trash already-trashed tasks (400 error)
   - Cannot restore non-trashed tasks (400 error)
3. **Data Consistency**: Task state changes are properly reflected across all endpoints
4. **Message Formatting**: All responses include appropriate user-friendly messages

## Mock Implementation Validation

The test suite uses a comprehensive mock orchestrator that:
- ✅ Implements all four trash management methods (`trashTask`, `restoreTask`, `listTrashedTasks`, `emptyTrash`)
- ✅ Maintains proper task state (trashedAt timestamp, status changes)
- ✅ Enforces business logic constraints
- ✅ Provides realistic error conditions

## Test File Location
`packages/api/src/index.test.ts` (lines 527-849)

## Summary
All trash management API endpoints have comprehensive test coverage including:
- Happy path scenarios
- Error conditions and edge cases
- Complete workflow integration testing
- Proper response format validation
- State consistency verification

The implementation meets all acceptance criteria:
- ✅ POST /tasks/:id/trash moves task to trash
- ✅ POST /tasks/:id/restore restores from trash
- ✅ GET /tasks/trashed lists trashed tasks
- ✅ DELETE /tasks/trash permanently deletes all trashed tasks
- ✅ Proper error handling for invalid task IDs and states