# Trash Management API Endpoints - Implementation Verification

## Overview
This document describes the implementation of the trash management API endpoints for APEX.

## Implemented Endpoints

### 1. POST /tasks/:id/trash
Moves a task to trash (soft delete).

**Request**: `POST /tasks/:id/trash`
**Response**:
```json
{
  "ok": true,
  "message": "Task moved to trash"
}
```

**Error Cases**:
- 404: Task not found
- 400: Task is already in trash

### 2. POST /tasks/:id/restore
Restores a task from trash.

**Request**: `POST /tasks/:id/restore`
**Response**:
```json
{
  "ok": true,
  "message": "Task restored from trash"
}
```

**Error Cases**:
- 404: Task not found
- 400: Task is not in trash

### 3. GET /tasks/trashed
Lists all trashed tasks.

**Request**: `GET /tasks/trashed`
**Response**:
```json
{
  "tasks": [...],
  "count": 2,
  "message": "2 trashed task(s) found"
}
```

### 4. DELETE /tasks/trash
Permanently deletes all trashed tasks.

**Request**: `DELETE /tasks/trash`
**Response**:
```json
{
  "ok": true,
  "deletedCount": 3,
  "message": "3 task(s) permanently deleted from trash"
}
```

## Implementation Details

### Files Modified:
- `packages/api/src/index.ts`: Added 4 new endpoints
- `packages/api/src/index.test.ts`: Added comprehensive tests

### Integration:
- Uses existing `ApexOrchestrator` methods:
  - `trashTask(taskId)`
  - `restoreTask(taskId)`
  - `listTrashedTasks()`
  - `emptyTrash()`

### Error Handling:
- Proper HTTP status codes (404, 400, 500)
- Meaningful error messages
- Exception handling with try/catch blocks

### Testing:
- Complete test coverage for all 4 endpoints
- Tests happy path and error conditions
- Mock orchestrator updated to support trash operations

## Verification Commands

To verify the implementation:

1. Build the project:
   ```bash
   npm run build
   ```

2. Run tests:
   ```bash
   npm run test
   ```

3. Type checking:
   ```bash
   npm run typecheck
   ```

## Console Output
The API server startup now includes the new endpoints in the console output.