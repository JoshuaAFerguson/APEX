# APEX Permission Handling and Error Patterns Analysis

## Executive Summary

This document provides a comprehensive analysis of permission handling and error patterns across all APEX packages. The analysis covers the orchestrator, CLI, API, and core packages to understand how permissions are currently checked, how user prompts and cancellation are handled in the CLI, how authorization errors are managed in the API, and existing test patterns to follow.

## 1. Permission Handling in Orchestrator

### 1.1 Permission Storage Architecture

The orchestrator implements a sophisticated permission system centered around the `PermissionStore` class:

**Location**: `packages/orchestrator/src/permission-store.ts`

**Key Features**:
- SQLite-based persistent storage (`.apex/apex.db`)
- Scoped permissions (tool + optional scope)
- Permission levels: `allow-always`, `allow-once`, `deny`
- Support for expiration timestamps
- Extended permissions with metadata (v0.5.0+)

**Database Schema**:
```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  scope TEXT,
  level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  -- Extended fields (v0.5.0)
  config TEXT,           -- JSON: ToolPermissionConfig
  grant_reason TEXT,
  granted_by TEXT,
  tags TEXT              -- JSON: string[]
);
```

### 1.2 Permission Checking Flow

**Permission Query Process**:
1. Generate unique permission ID from tool name + scope
2. Query database for existing permission
3. Check expiration and auto-clean expired permissions
4. Return permission level or null if none found

**Extended Permission Features**:
- Directory access configuration
- Tool-specific configurations (JSON stored)
- Audit trail with grant reason and granter
- Tagging system for categorization

### 1.3 Permission Lifecycle Management

**CRUD Operations**:
- `savePermission()` / `saveExtendedPermission()` - Upsert permission
- `getPermission()` / `getExtendedPermission()` - Retrieve with expiry check
- `listPermissions()` / `listExtendedPermissions()` - Filter and list
- `clearPermissions()` - Bulk deletion
- `clearExpired()` - Automatic cleanup

**Advanced Features**:
- Permission presets for common tool groups
- Granular directory access control
- Migration system for schema updates
- JSON validation for configuration data

## 2. CLI User Prompts and Cancellation

### 2.1 Approval Prompt System

**Location**: `packages/cli/src/utils/approval-prompt.ts`

**Core Components**:
- `showApprovalPrompt()` - Main approval interface
- `promptForAdditionalInfo()` - Follow-up information requests

**User Interface Design**:
```typescript
interface ApprovalPromptOptions {
  eventData: ApprovalRequiredEventData;
  onSelection: (response: ApprovalResponse) => Promise<void>;
}
```

### 2.2 Approval Workflow

**Three-Option Response System**:
1. **Approve** (✅) - Allow operation to proceed
2. **Deny** (❌) - Block operation with optional reason
3. **Request More Info** (📝) - Ask for additional details

**Rich Context Display**:
- Task description and ID
- Gate name and stage information
- Agent information
- Affected files list (up to 5 shown, with "X more" indicator)
- Changes summary
- Timeout information with real-time countdown

### 2.3 Cancellation and Error Handling

**Cancellation Patterns**:
- Uses `inquirer` for interactive prompts
- Graceful handling of Ctrl+C interruptions
- Timeout support with visual countdown
- Response validation and error feedback

**Error Recovery**:
- Input validation with retry prompts
- Required field enforcement
- Timeout handling with expired request detection

## 3. API Authorization Errors

### 3.1 HTTP Error Response Patterns

**Location**: `packages/api/src/index.ts`

**Standardized Error Format**:
```typescript
{
  error: string,
  status?: string,
  message?: string,
  timestamp?: Date
}
```

### 3.2 Common Authorization Scenarios

**Task Not Found (404)**:
```typescript
return reply.status(404).send({ error: 'Task not found' });
```

**Missing Required Fields (400)**:
```typescript
if (!approver) {
  return reply.status(400).send({ error: 'Approver is required' });
}
```

**Operation Not Allowed (400)**:
```typescript
if (!retryableStatuses.includes(task.status)) {
  return reply.status(400).send({
    error: 'Only failed, cancelled, or stuck tasks can be retried'
  });
}
```

**Internal Server Errors (500)**:
```typescript
} catch (error) {
  return reply.status(500).send({
    error: error instanceof Error ? error.message : 'Failed to process request'
  });
}
```

### 3.3 API Error Broadcasting

**WebSocket Error Events**:
- Real-time error notifications via WebSocket connections
- Task-specific error broadcasting
- Health monitoring with error detection
- MCP installation/uninstallation error events

**Error Event Structure**:
```typescript
{
  type: 'error-type',
  taskId: string,
  timestamp: Date,
  data: {
    error: string,
    stage?: string,
    context?: object
  }
}
```

## 4. Existing Test Patterns

### 4.1 Test Framework and Structure

**Primary Testing Stack**:
- **Vitest** - Primary test runner
- **SQLite in-memory databases** - Fast test isolation
- **Temporary directories** - File system test isolation
- **EventEmitter mocking** - Event testing

### 4.2 Permission Testing Patterns

**Example Test Structure** (`packages/orchestrator/src/__tests__/permission-events.test.ts`):
```typescript
describe('Permission Change Event Emission', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let testDbPath: string;

  beforeEach(async () => {
    // Create temporary SQLite database
    testDbPath = join(tmpdir(), `apex-test-${Date.now()}.db`);

    // Mock configuration
    const mockConfig = {
      project: { name: 'test-project', autonomy: 'supervised' },
      agents: {},
      workflows: {},
      limits: { maxConcurrentTasks: 1, maxCost: 100 },
      permissions: { presets: {}, defaults: {} }
    };
  });

  afterEach(async () => {
    // Cleanup temporary files
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });
});
```

### 4.3 Common Testing Utilities

**Database Testing**:
- Temporary SQLite databases for isolation
- Automatic cleanup in `afterEach` hooks
- Migration testing for schema changes

**Event Testing**:
- EventEmitter spy functions
- Event payload validation
- Timing and sequence verification

**Error Testing**:
- Exception boundary testing
- Error message validation
- Recovery scenario testing

## 5. Cross-Package Integration Patterns

### 5.1 Permission Flow Integration

**Orchestrator → CLI Flow**:
1. Orchestrator detects permission required
2. Emits `approval:required` event
3. CLI catches event and shows approval prompt
4. User response sent back via API call
5. Orchestrator processes response and continues/blocks

**API → Orchestrator Flow**:
1. API receives approval/denial request
2. Validates request format and authorization
3. Forwards to orchestrator via method call
4. Orchestrator updates permission store
5. Broadcasts state change via WebSocket

### 5.2 Error Propagation

**Error Flow Chain**:
```
Core Tool → Orchestrator → API → CLI/WebSocket
     ↓           ↓         ↓         ↓
   Throws    Catches    HTTP      User
  Exception   Logs     Status    Display
```

### 5.3 Event Broadcasting Architecture

**Real-time Updates**:
- WebSocket connections for live updates
- Event filtering by type
- Task-specific and global event channels
- Health monitoring and error detection

## 6. Recommendations for Future Development

### 6.1 Permission System Enhancements

1. **Role-Based Access Control (RBAC)**
   - User roles and hierarchies
   - Permission inheritance
   - Group-based permissions

2. **Audit Logging**
   - Complete permission change history
   - User action tracking
   - Compliance reporting

3. **Policy Engine**
   - Declarative permission policies
   - Conditional permissions based on context
   - Automated policy enforcement

### 6.2 Error Handling Improvements

1. **Structured Error Types**
   - Error classification and categorization
   - Error code standardization
   - Internationalization support

2. **Recovery Mechanisms**
   - Automatic retry logic
   - Graceful degradation
   - Circuit breaker patterns

3. **User Experience**
   - Contextual error messages
   - Suggested actions
   - Progressive disclosure

### 6.3 Testing Strategy

1. **Integration Testing**
   - End-to-end permission flows
   - Cross-package interaction testing
   - Real-world scenario simulation

2. **Performance Testing**
   - Permission lookup performance
   - Database query optimization
   - WebSocket event throughput

3. **Security Testing**
   - Permission bypass attempts
   - Input validation testing
   - SQL injection prevention

## 7. Key Files and Locations

### Permission-Related Files
- `packages/orchestrator/src/permission-store.ts` - Core permission storage
- `packages/orchestrator/src/permission-manager.ts` - Permission business logic
- `packages/cli/src/utils/approval-prompt.ts` - User approval interface
- `packages/core/src/types.ts` - Permission type definitions

### Error Handling Files
- `packages/api/src/index.ts` - API error responses
- `packages/cli/src/utils/ErrorFormatter.ts` - Error formatting
- `packages/orchestrator/src/index.ts` - Orchestrator error handling

### Test Files
- `packages/orchestrator/src/__tests__/permission-*.test.ts` - Permission tests
- `packages/cli/src/__tests__/approval-*.test.ts` - Approval flow tests
- `packages/api/src/__tests__/confirmations-*.test.ts` - API confirmation tests

This analysis provides a comprehensive overview of the current permission handling and error patterns in APEX, serving as a foundation for understanding the system architecture and planning future enhancements.