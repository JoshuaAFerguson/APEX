# APEX Permission Handling and Error Patterns Analysis

## Overview

This document provides a comprehensive analysis of existing permission handling, error patterns, and user interaction mechanisms across APEX packages. This analysis was conducted as part of the implementation stage for understanding current patterns to inform future development.

## 1. Permission Handling in Orchestrator Package

### Core Permission System

The orchestrator package implements a sophisticated permission system with the following key components:

#### PermissionManager (`packages/orchestrator/src/permission-manager.ts`)

- **Primary Class**: `PermissionManager` - Centralized permission evaluation and enforcement
- **Storage**: Uses `PermissionStore` with SQLite backend for persistence
- **Architecture**: Evaluates permissions based on tool type, autonomy level, and permission presets

#### Permission Evaluation Flow

```typescript
// Permission check flow:
1. Tool requests permission via checkPermission()
2. PermissionManager evaluates based on:
   - Current autonomy level
   - Permission preset configuration
   - Tool-specific requirements
   - Existing granted permissions
3. Returns PermissionResult { granted: boolean, denialReason?: string }
```

#### Key Permission Components

**Permission Presets** (`packages/orchestrator/src/permission-preset-manager.ts`):
- `full-auto`: Most tools allowed automatically
- `review-before-commit`: Requires confirmation for file-modifying tools
- `review-all`: All tools require user confirmation

**Permission Store** (`packages/orchestrator/src/permission-store.ts`):
- SQLite-backed persistence
- Stores granted permissions with metadata (grantedBy, grantedAt, etc.)
- Supports permission lifetime management

### Error Suggestion System

The orchestrator includes an intelligent error suggestion system (`packages/orchestrator/src/suggestion-matcher.ts`):

```typescript
// Permission-related error patterns recognized:
- /Permission denied/i → "Check file/directory permissions and ownership"
- /EPERM/i → "Operation not permitted. May require elevated privileges"
- /Access is denied/i → "Windows permission error. Check file permissions"
- /unauthorized/i → "Authentication required. Check credentials, API keys, or login status"
- /forbidden/i → "Access forbidden. Verify you have the required permissions"
```

### User Confirmation Mechanisms

**Approval Gates**: When tools require confirmation:
- Tasks are paused with `pauseReason: 'approval_gate'`
- `ApprovalRequiredEventData` emitted with approval details
- External systems (CLI/API) handle user interaction
- Tasks resume after `grantApproval()` called

**Dangerous Operation Detection** (`packages/orchestrator/src/dangerous-operation-detector.ts`):
- Analyzes commands for potentially harmful operations
- Provides contextual warnings and confirmation prompts
- Integrates with permission system for approval workflow

## 2. CLI User Prompt and Cancellation Handling

### Confirmation System

**Main Module**: `packages/cli/src/utils/confirmation.ts`

```typescript
// Dangerous operation types with different risk levels:
enum DangerousOperation {
  CANCEL_TASK = 'cancel_task',      // Medium risk
  TRASH_TASK = 'trash_task',        // Low risk
  EMPTY_TRASH = 'empty_trash',      // High risk, irreversible
  MERGE_TASK = 'merge_task',        // Medium risk
  DELETE_TEMPLATE = 'delete_template', // High risk, irreversible
  UNARCHIVE_TASK = 'unarchive_task'    // Low risk
}
```

#### Autonomy-Aware Confirmation

```typescript
// Confirmation behavior varies by autonomy level:
function shouldShowConfirmation(operation, autonomyLevel, options) {
  switch (autonomyLevel) {
    case 'full-auto':
      return config.irreversible && config.consequenceLevel === 'high';
    case 'review-before-commit':
      return config.consequenceLevel === 'medium' || config.consequenceLevel === 'high';
    case 'review-all':
      return true; // Always confirm
  }
}
```

### Interactive Conversation Manager

**Module**: `packages/cli/src/services/ConversationManager.ts`

- **Confirmation Processing**: Recognizes affirmative (`['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'true', '1']`) and negative (`['no', 'n', 'nope', 'nah', 'cancel', 'abort', 'false', '0']`) responses
- **Choice Handling**: Supports numbered selections and text matching for multi-option prompts
- **Cancellation**: Built-in support for cancellation keywords in user responses

### CLI Interaction Library Usage

- **Primary Library**: `inquirer` for interactive prompts
- **Pattern**: Uses `inquirer.prompt()` with type-specific configurations
- **Cancellation Support**: Built-in Ctrl+C handling and explicit cancellation commands

## 3. API Authorization Error Handling

### Current Authorization State

**Key Finding**: The API package currently implements **NO authentication or authorization mechanisms**.

**Documentation**: This is explicitly documented in `packages/api/src/__tests__/authorization.test.ts`:

```typescript
/**
 * This test file provides the infrastructure and framework for testing authorization
 * mechanisms in the APEX API. Currently, the API has NO authorization implemented,
 * which these tests document and validate.
 */
```

### Authorization Test Infrastructure

**Comprehensive Test Suite**: `packages/api/src/__tests__/authorization.test.ts` and `packages/api/src/__tests__/permission-analysis.test.ts`

- **Coverage**: Tests confirm all endpoints are accessible without authentication
- **Security Analysis**: Documents complete lack of access control as intentional current state
- **Future Preparation**: Infrastructure ready for authentication implementation

#### Current API Behavior

```typescript
// All endpoints currently allow:
- Unauthenticated task creation, modification, deletion
- Unrestricted access to configuration and sensitive operations
- WebSocket connections without authentication
- Template and MCP server management without authorization
- Approval system access without identity verification
```

### Permission Event Broadcasting

**WebSocket Integration**: `packages/api/src/__tests__/websocket-permission-notifications.test.ts`

The API supports real-time permission event broadcasting:

```typescript
// Permission events broadcasted via WebSocket:
- permission:request - When approval needed
- permission:granted - When permission approved
- permission:denied - When permission rejected
- dangerous:confirmed - When dangerous operation confirmed
```

### Error Response Patterns

**HTTP Status Codes**: Currently the API never returns:
- `401 Unauthorized` - No authentication implemented
- `403 Forbidden` - No authorization implemented

**Error Structure**: Standard Fastify error responses used for validation and server errors.

## 4. Existing Test Patterns to Follow

### Test Structure Standards

**Common Pattern Across Packages**:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(async () => {
    // Setup test environment
    testContext = await createTestEnvironment();
  });

  afterEach(async () => {
    // Cleanup resources
    if (testContext?.cleanup) {
      await testContext.cleanup();
    }
  });

  describe('Feature Group', () => {
    it('should validate specific behavior', async () => {
      // Arrange, Act, Assert pattern
    });
  });
});
```

### Permission Test Patterns

**Integration Test Style** (from `packages/orchestrator/src/__tests__/permission-check-autonomy-integration.test.ts`):

```typescript
describe('Permission Check Integration Tests', () => {
  let manager: PermissionManager;
  let store: PermissionStore;

  beforeEach(async () => {
    // Create isolated test directory
    testDir = join(tmpdir(), `apex-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    store = new PermissionStore(testDir);
    manager = new PermissionManager(store);
  });

  it('should deny permission with appropriate reason', async () => {
    const result = await manager.checkPermission('Write', config);
    expect(result.granted).toBe(false);
    expect(result.denialReason).toBe('Tool requires user confirmation before execution');
  });
});
```

### API Test Patterns

**HTTP Testing** (from `packages/api/src/__tests__/authorization.test.ts`):

```typescript
describe('API Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestEnvironment({
      silent: true,
      mockOrchestrator: true
    });
  });

  it('should handle unauthenticated requests appropriately', async () => {
    const response = await context.httpUtils.request('/api/endpoint');
    expect(response.statusCode).not.toBe(401);
    expect(response.statusCode).not.toBe(403);
  });
});
```

### Test Environment Setup

**Shared Test Utilities**: All packages use consistent test environment setup with:

- **Temporary Directories**: Isolated test workspaces
- **Mock Services**: Configurable mocking for external dependencies
- **Cleanup Automation**: Proper resource cleanup in `afterEach`
- **HTTP Test Utils**: Standardized request helpers
- **WebSocket Test Clients**: Reusable WebSocket testing infrastructure

### Assertion Patterns

**Permission Testing**:
```typescript
expect(result.granted).toBe(false);
expect(result.denialReason).toContain('requires user confirmation');
```

**Event Testing**:
```typescript
expect(events).toHaveLength(1);
expect(events[0].type).toBe('permission:request');
expect(events[0].data.taskId).toBe(taskId);
```

**Status Code Testing**:
```typescript
expect(response.statusCode).toBe(200);
expect(response.statusCode).not.toBe(401);
expect(response.statusCode).not.toBe(403);
```

## Key Insights for Development

### 1. Permission System Architecture

- **Centralized**: All permission logic flows through `PermissionManager`
- **Configurable**: Behavior varies by autonomy level and permission presets
- **Persistent**: SQLite storage for permission grants
- **Event-Driven**: Approval workflow uses events for coordination

### 2. User Interaction Patterns

- **CLI**: Rich interactive prompts with `inquirer` and cancellation support
- **Autonomy-Aware**: Confirmation requirements adapt to user's autonomy preferences
- **Consistent**: Standardized dangerous operation handling across features

### 3. API Security Posture

- **Current State**: No authentication/authorization implemented
- **Documented**: Explicitly tested and documented as intentional
- **Prepared**: Infrastructure ready for future security implementation

### 4. Testing Standards

- **Comprehensive**: Extensive integration test coverage
- **Isolated**: Proper test environment isolation
- **Realistic**: Tests use actual components rather than excessive mocking
- **Documented**: Test acceptance criteria clearly defined

## Recommendations for Future Implementation

1. **Follow Existing Patterns**: Use established permission manager integration for new features
2. **Maintain Test Standards**: Follow integration test patterns for comprehensive coverage
3. **Consider API Security**: Plan for authentication when implementing API-based permission features
4. **Leverage Event System**: Use existing approval event workflow for user confirmation flows
5. **Respect Autonomy Levels**: Ensure new permission features adapt to user autonomy preferences

---

*Analysis completed as part of APEX permission system documentation and future development planning.*