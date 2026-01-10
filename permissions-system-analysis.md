# APEX Permissions System Architecture Analysis

## Overview

The APEX permissions system is a comprehensive, multi-layered security framework that governs agent tool access and execution. It operates through several interconnected components that handle authorization, confirmation flows, dangerous operation detection, and policy enforcement.

## Core Architecture Components

### 1. Permission Types and Schemas (`@apex/core/types.ts`)

#### Permission Levels
- **`allow-always`**: Permanently allow the tool/scope combination
- **`allow-once`**: Allow for a single invocation only (consumed after use)
- **`deny`**: Explicitly deny the tool/scope combination

#### Permission Data Structures

```typescript
// Base permission record
interface Permission {
  tool: string;           // Tool name
  scope?: string;         // Optional scope restriction (e.g., file pattern)
  level: PermissionLevel; // Allow/deny/allow-once
  expiry?: Date;          // Optional expiration
  createdAt: Date;        // Creation timestamp
}

// Extended permission with configuration
interface ExtendedPermission extends Permission {
  config?: ToolPermissionConfig;  // Tool-specific settings
  grantReason?: string;           // Why permission was granted
  grantedBy?: string;            // Who granted it
  tags?: string[];               // Categorization tags
}
```

#### Tool Permission Configuration
Each tool can have granular configuration controlling:
- **Enabled state**: Whether the tool is available
- **Confirmation requirements**: Force user confirmation
- **Directory access**: Allowlist/blocklist patterns
- **Rate limiting**: Calls per minute
- **Timeout settings**: Maximum execution time
- **Custom metadata**: Tool-specific data

### 2. Permission Manager (`orchestrator/permission-manager.ts`)

The `PermissionManager` class provides high-level permission management with session-level caching:

#### Key Features
- **Session Cache**: Temporary storage for `allow-once` permissions
- **Permission Checking**: Comprehensive permission validation
- **Tool Configuration**: Per-tool behavior settings
- **Directory Access Validation**: Path-based access controls

#### Core Methods
```typescript
// Check permission level (consumes allow-once)
async checkPermission(tool: string, scope?: string): Promise<PermissionLevel | null>

// Grant permission with persistence handling
async grantPermission(tool: string, scope: string | undefined, level: PermissionLevel): Promise<void>

// Comprehensive tool permission check with path validation
async checkToolPermission(tool: string, options: ToolPermissionCheckOptions): Promise<ToolPermissionResult>

// Directory access validation
async checkDirectoryAccess(path: string, options: DirectoryAccessCheckOptions): Promise<DirectoryAccessResult>
```

### 3. Permission Store (`orchestrator/permission-store.ts`)

Persistent storage layer using SQLite database:
- Stores permission records in `.apex/apex.db`
- Supports both basic and extended permission schemas
- Handles permission queries, updates, and deletion
- Provides migration support for schema evolution

### 4. Permission Presets (`orchestrator/permission-preset-manager.ts`)

Pre-configured permission templates for common security postures:

#### Available Presets
- **`autonomous`**: All tools allowed without confirmation (full autonomy)
- **`review-all`**: All tools require user confirmation before execution
- **`read-only`**: Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)

#### Tool Categories
- **Read Tools**: `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`
- **Write/Execute Tools**: `Write`, `Edit`, `MultiEdit`, `Bash`, `TodoWrite`, etc.

## Confirmation Flow Mechanisms

### 1. Pre-Tool Hook Integration

The permission system integrates with the Claude Agent SDK's pre-tool hooks to intercept tool execution:

```typescript
// Hook flow in hooks.ts
'PreToolUse': async (input: HookInput, context: HookContext) => {
  // 1. Check permission presets
  // 2. Validate dangerous operations
  // 3. Enforce policy rules
  // 4. Emit permission events
  // 5. Return allow/deny decision
}
```

### 2. Permission Request Events

When permissions are needed, the system emits events for external handling:

```typescript
interface PermissionRequestEventData {
  requestId: string;      // Unique request identifier
  tool: string;          // Tool requiring permission
  scope?: string;        // Optional scope/context
  description: string;   // Human-readable description
  isDangerous: boolean;  // Risk flag
  agent: string;         // Requesting agent
  timestamp: Date;       // Request time
}
```

### 3. Approval Flow States

#### Approval Lifecycle
1. **Request Generation**: System detects need for approval
2. **Event Emission**: `permission:request` event fired
3. **External Handling**: UI/CLI captures event and prompts user
4. **Decision Processing**: User approves/denies via API
5. **Permission Storage**: Decision stored as permission record
6. **Task Resumption**: Execution continues or fails

#### Approval State Management
```typescript
interface ApprovalState {
  id: string;                    // Unique approval ID
  taskId: string;               // Associated task
  gateName: string;             // Gate that triggered approval
  status: 'pending' | 'approved' | 'denied';
  requestedAt: Date;
  approvalsReceived: number;
  approvalsRequired: number;
  timeoutMinutes?: number;
  expiresAt?: Date;
  context: Record<string, any>; // Additional context
}
```

### 4. Dangerous Operation Detection

The `DangerousOperationDetector` class analyzes tool usage patterns:

#### Risk Categories
- **Critical**: System-destructive operations (`rm -rf /`, fork bombs)
- **High**: Privilege escalation, code injection, data destruction
- **Medium**: Legitimate but risky operations (sudo, chmod, git force-push)
- **Low**: Minor security concerns

#### Detection Patterns
- **Bash Commands**: Pattern matching against dangerous command signatures
- **File Operations**: Sensitive file paths (.env, ssh keys, system files)
- **Web Requests**: Localhost, private networks, sensitive endpoints

## Policy Engine Integration

### 1. Policy-based Access Control

The permission system integrates with the policy engine for rule-based governance:

```typescript
// Policy rules can trigger approval requirements
interface PolicyRule {
  id: string;
  name: string;
  type: 'path' | 'tool' | 'agent' | 'resource' | 'approval';
  action: 'allow' | 'deny' | 'require_approval' | 'warn';
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern?: string;
  conditions?: Record<string, unknown>;
}
```

### 2. Approval Gate System

Approval gates provide checkpoints in workflows:
- **Pre-stage Gates**: Before workflow stage execution
- **Pre-tool Gates**: Before individual tool execution
- **Resource Gates**: Based on usage thresholds
- **Policy Gates**: Triggered by policy violations

## Testing Infrastructure

### 1. Test Patterns

The permission system uses comprehensive testing patterns:

#### Unit Tests
- **Permission Manager**: Core permission logic
- **Permission Store**: Database operations
- **Dangerous Operation Detector**: Pattern detection
- **Permission Presets**: Configuration application

#### Integration Tests
- **Event Flow**: End-to-end permission request/response
- **Hook Integration**: Pre-tool hook behavior
- **Approval Lifecycle**: State transitions
- **Policy Integration**: Rule enforcement

#### Test Utilities
```typescript
// Common test setup pattern
describe('PermissionManager', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create isolated test environment
    testDir = join(tmpdir(), `apex-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();
    manager = new PermissionManager(store);
  });

  afterEach(() => {
    // Cleanup
    if (store) store.close();
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });
});
```

### 2. Mock Infrastructure

Tests use sophisticated mocking:
- **Event Emitters**: Mock event-driven flows
- **File System**: Isolated test directories
- **Time**: Controllable timestamps for expiration testing
- **External Dependencies**: Stubbed Claude Agent SDK interactions

## Event-Driven Architecture

### 1. Permission Events

The system emits various events for external handling:

```typescript
// Core permission events
'permission:request'   // Permission needed
'permission:granted'   // Permission approved
'permission:denied'    // Permission rejected

// Dangerous operation events
'dangerous:detected'   // Risky operation found
'dangerous:confirmed'  // User approved risky operation
'dangerous:blocked'    // Risky operation blocked

// Approval gate events
'approval:required'    // Approval gate triggered
'approval:approved'    // Gate approval granted
'approval:denied'      // Gate approval denied
```

### 2. Event Data Structures

Each event carries typed data:
```typescript
interface PermissionRequestEventData {
  requestId: string;
  tool: string;
  scope?: string;
  description: string;
  isDangerous: boolean;
  agent: string;
  timestamp: Date;
}

interface DangerousOperationDetectedEventData {
  operationId: string;
  tool: string;
  operation: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskDescription: string;
  agent: string;
  timestamp: Date;
}
```

## Directory Access Control

### 1. Path Validation System

The `DirectoryAccessValidator` provides fine-grained path controls:

```typescript
interface DirectoryAccessConfig {
  allowlist: string[];    // Allowed path patterns
  blocklist: string[];    // Blocked path patterns
  defaultAllow: boolean;  // Default behavior
  resolveSymlinks: boolean; // Follow symlinks
  maxDepth: number;       // Directory traversal limit
}
```

### 2. Pattern Matching

Uses glob patterns for flexible path control:
- **Allowlist**: Explicitly permitted paths
- **Blocklist**: Explicitly forbidden paths
- **Precedence**: Blocklist overrides allowlist
- **Default Behavior**: Configurable allow/deny for unmatched paths

## Configuration Integration

### 1. APEX Configuration

Permission settings integrate with main config:

```yaml
# .apex/config.yaml
permissions:
  preset: 'review-all'  # autonomous | review-all | read-only
  customRules:
    - tool: 'Bash'
      behavior: 'confirm'
      scope: 'rm *'
      reason: 'Deletion commands require confirmation'

tools:
  Read:
    enabled: true
    requireConfirmation: false
    directoryAccess:
      allowlist: ['src/**', 'docs/**']
      blocklist: ['.env*', '**/.git/**']
      defaultAllow: false
```

### 2. Tool-Specific Configuration

Each tool can have custom permission configuration:
- **Filesystem Tools**: Directory access controls
- **Shell Tools**: Command pattern restrictions
- **Web Tools**: Domain allowlists/blocklists
- **Browser Tools**: Navigation restrictions

## Security Considerations

### 1. Session Management

- **Session Isolation**: Each task gets fresh permission context
- **Allow-Once Consumption**: Single-use permissions automatically expire
- **Cache Management**: Session cache cleared between tasks

### 2. Audit Trail

- **Permission Grants**: All permission decisions logged
- **Dangerous Operations**: Risk assessments recorded
- **Approval History**: Gate decisions tracked with timestamps

### 3. Fail-Safe Design

- **Default Deny**: Unknown operations require explicit approval
- **Escalation**: Dangerous patterns trigger confirmation
- **Timeout Handling**: Expired approvals default to denial

## Performance Characteristics

### 1. Caching Strategy

- **Session Cache**: In-memory storage for frequently accessed permissions
- **Tool Config Cache**: Cached tool configurations per session
- **Directory Access Cache**: Cached path validation results

### 2. Database Optimization

- **SQLite Storage**: Local, fast permission persistence
- **Indexed Queries**: Optimized permission lookups
- **Batch Operations**: Efficient bulk permission operations

### 3. Scalability Considerations

- **Per-Project Isolation**: Separate permission stores per project
- **Memory Management**: Session cache cleanup and limits
- **Event Efficiency**: Non-blocking event emission

## Integration Points

### 1. Claude Agent SDK

- **Hook Registration**: Pre/post-tool execution hooks
- **Permission Mode**: SDK permission handling configuration
- **Event Propagation**: SDK event forwarding to orchestrator

### 2. CLI/API Interface

- **Permission Commands**: CLI commands for permission management
- **Approval Endpoints**: API endpoints for approval handling
- **Real-time Updates**: WebSocket streams for approval events

### 3. External Systems

- **Event-Driven Integration**: External systems can listen to permission events
- **Approval Delegation**: External approval systems can handle requests
- **Policy Integration**: External policy engines can contribute rules

This comprehensive permissions system provides robust security controls while maintaining flexibility for various development workflows and security postures.