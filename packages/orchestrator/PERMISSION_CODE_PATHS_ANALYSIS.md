# Permission-Related Code Paths in @apex/orchestrator

## Overview

This document provides a comprehensive analysis of all permission-related code paths, functions, and components in the `@apex/orchestrator` package. This analysis identifies every file, class, method, and code path that handles permissions, access control, authorization logic, or related policy enforcement.

## Core Permission Management Components

### 1. Permission Store (`src/permission-store.ts`)

**Primary responsibility**: Persistent storage of tool permissions in SQLite database

**Key classes and methods**:
- `PermissionStore` class
  - `initialize()` - Sets up database connection and ensures permissions table exists
  - `savePermission(permission: Permission)` - Saves basic permissions
  - `saveExtendedPermission(permission: ExtendedPermission)` - Saves extended permissions with additional metadata
  - `getPermission(query: PermissionQuery)` - Retrieves permissions for tool/scope combination
  - `getExtendedPermission(query: PermissionQuery)` - Retrieves extended permissions
  - `listPermissions(options?)` - Lists all permissions with filtering options
  - `listExtendedPermissions(options?)` - Lists extended permissions with advanced filtering
  - `clearPermissions()` - Clears all stored permissions
  - `clearExpired()` - Removes expired permissions
  - `clearPermissionsForTool(toolName)` - Removes permissions for specific tool
  - `clearPermission(query)` - Removes specific tool/scope permission
  - `getDirectoryAccess(query)` - Gets directory access configuration
  - `updateDirectoryAccess(query, config)` - Updates directory access settings
  - `close()` - Closes database connection

**Database schema**:
- `permissions` table with columns: id, tool_name, scope, level, expires_at, created_at
- Extended columns (v0.5.0): config, grant_reason, granted_by, tags
- Indexes for performance on tool_name/scope, level, expires_at

### 2. Permission Manager (`src/permission-manager.ts`)

**Primary responsibility**: High-level permission management with session-level caching

**Key classes and methods**:
- `PermissionManager` class
  - `checkPermission(tool, scope?)` - Checks permission level, consuming allow-once permissions
  - `grantPermission(tool, scope, level)` - Grants permission for tool/scope
  - `revokePermission(tool, scope?)` - Revokes existing permission
  - `hasPermission(tool, scope?)` - Boolean check if tool is allowed
  - `getToolConfig(tool, scope?)` - Retrieves tool-specific configuration
  - `setToolConfig(tool, config, scope?)` - Sets session-level tool configuration
  - `checkDirectoryAccess(path, options)` - Validates directory access with path patterns
  - `checkToolPermission(tool, options)` - Comprehensive permission check with path validation
  - `resetSession()` - Clears session cache for new sessions

**Session caching**:
- `sessionCache` - Stores allow-once permissions for current session
- `sessionDirectoryAccess` - Caches directory access configurations
- `sessionToolConfigCache` - Caches tool configurations

### 3. Permission Preset Manager (`src/permission-preset-manager.ts`)

**Primary responsibility**: Applies preset configurations (autonomous, review-all, read-only) to permission store

**Key classes and methods**:
- `PermissionPresetManager` class
  - `applyPreset(preset: PermissionPreset)` - Applies preset configuration, clearing existing permissions
  - `getCurrentPreset()` - Returns active preset
  - `getEffectivePermissionLevel(tool, scope?)` - Gets effective permission based on preset and store
  - `isToolAllowed(tool, scope?)` - Checks if tool allowed without confirmation
  - `isConfirmationRequired(tool, scope?)` - Checks if tool requires confirmation
  - `isToolDenied(tool, scope?)` - Checks if tool is explicitly denied
  - `getPresetConfig()` - Gets current preset configuration details
  - `resetToPreset()` - Reapplies current preset to sync store

**Preset behaviors**:
- `autonomous` - All tools allowed without confirmation
- `review-all` - All tools require user confirmation
- `read-only` - Only read-only tools (Read, Grep, Glob, WebFetch, WebSearch) allowed

## Policy and Enforcement Components

### 4. Policy Engine (`src/policy-engine.ts`)

**Primary responsibility**: Rule evaluation and policy enforcement with comprehensive policy checking

**Key classes and methods**:
- `PolicyEngine` class
  - `checkPolicy(context, options?)` - Main policy checking method for new format
  - `evaluateAction(actionContext)` - Evaluates agent actions against policy rules
  - `getEnforcementMode()` / `setEnforcementMode(mode)` - Manages enforcement mode
  - `registerPolicy(policy)` / `unregisterPolicy(policyId)` - Policy registration
  - `registerApexRules(apexRules)` - Registers custom ApexRules as policy rules
  - `validateFilePath(filePath, agentId?)` - Validates file path against path rules
  - `reloadRules(config?)` - Reloads rules from configuration
  - `getRulesByType(type)` / `getRulesBySeverity(severity)` - Rule filtering methods

**Rule types supported**:
- Path rules - File/directory access control
- Tool rules - Tool usage restrictions
- Agent rules - Agent-specific restrictions
- Approval rules - Human approval requirements
- APEX rules - Custom project-specific rules

**Rule loading methods**:
- `loadPathRules(allowedPaths)` - Creates path-based rules from allowedPaths config
- `loadApprovalRules(approvalRules)` - Creates approval requirement rules
- `loadToolRules(customRules)` - Creates tool restriction rules
- `loadCustomRules(policies)` - Loads custom policy definitions

### 5. Policy Enforcer (`src/policy/policy-enforcer.ts`)

**Primary responsibility**: Validates agent operations against configured policy rules

**Key classes and methods**:
- `PolicyEnforcer` class
  - `validateFilePath(filePath, context?)` - Validates file paths against allowedPaths configuration
  - `checkApprovalRequired(task, action, context?)` - Determines if human approval needed
  - `checkTaskStart(task, context?)` - Comprehensive task start policy evaluation
  - `createViolation(options)` - Creates PolicyViolation objects
  - `createViolationEvent(violation, context)` - Creates events for violation emission

**Validation logic**:
- Block pattern validation (highest precedence)
- Allowlist/blocklist mode enforcement
- Sensitive file pattern detection requiring approval
- Approval rule evaluation with multiple condition types

**Approval condition evaluation**:
- `evaluateFilePatternCondition()` - File pattern matching
- `evaluateContentPatternCondition()` - Content regex matching
- `evaluateOperationCondition()` - Operation type matching
- `evaluateCostThresholdCondition()` - Cost threshold checks
- `evaluateTokenThresholdCondition()` - Token usage checks
- `evaluateCustomCondition()` - Custom expression evaluation

## Integration and Orchestration

### 6. Main Orchestrator (`src/index.ts`)

**Permission-related integration points**:

**Core permission components**:
- Imports and instantiates `PermissionStore`, `PermissionManager`, `PermissionPresetManager`
- Initializes permission system in constructor
- Provides access to permission managers through getter methods

**Event emission for permissions**:
```typescript
'permission:request': (event: PermissionRequestEventData) => void;
'permission:granted': (event: PermissionGrantedEventData) => void;
'permission:denied': (event: PermissionDeniedEventData) => void;
```

**Permission event data interfaces**:
- `PermissionRequestEventData` - When agent requests tool permission
- `PermissionGrantedEventData` - When permission request is approved
- `PermissionDeniedEventData` - When permission request is rejected

**Permission integration with task lifecycle**:
- Permission checks during tool execution
- Policy enforcement during task start
- Approval workflow integration
- Autonomy level enforcement

### 7. Task Store (`src/store.ts`)

**Permission-related database functionality**:
- Maintains permissions table structure
- Supports approval states table for approval workflow
- Handles permission-related database migrations
- Provides persistence layer for permission decisions

**Database tables related to permissions**:
- `permissions` table - Core permission storage
- `approval_states` table - Approval workflow state management

## Supporting Components and Utilities

### 8. Browser Tool Permissions (`src/tools/browser-tool.ts`)

**Browser-specific permission handling**:
- Permission checks for browser automation operations
- Integration with permission manager for browser tool access
- Specialized permission scoping for browser operations

### 9. Policy Event Handling

**Event-driven permission architecture**:
- Policy violation events
- Permission request/grant/deny events
- Integration with orchestrator event system
- Real-time permission status updates

### 10. Autonomy Enforcement (`autonomy-enforcer.ts`)

**Autonomy level integration with permissions**:
- Enforcement of autonomy levels (supervised, autonomous, etc.)
- Integration with permission system for autonomy-based access control
- Stage-specific and agent-specific autonomy overrides

## Permission-Related Configuration

### Configuration Integration

**Permission configuration sources**:
- `.apex/config.yaml` - Project-level permission configuration
- Permission presets from `@apexcli/core`
- Runtime permission grants and denials
- Policy configuration for rules and enforcement

**Configuration types**:
- `PermissionPreset` - Predefined permission patterns
- `PermissionLevel` - allow-always, allow-once, deny
- `ToolPermissionConfig` - Tool-specific configuration
- `DirectoryAccessConfig` - Directory access patterns
- `PolicyConfig` - Policy rules and enforcement mode

## Test Coverage and Validation

### Comprehensive Test Suite

**Permission-related test files**:
- `src/__tests__/permission-*.test.ts` - Permission system unit tests
- `src/__tests__/approval-*.test.ts` - Approval workflow tests
- `src/__tests__/policy-*.test.ts` - Policy engine and enforcement tests
- `src/policy/*.test.ts` - Policy enforcer specific tests
- `src/tools/__tests__/browser-tool-permission-*.test.ts` - Browser permission tests

## Data Flow and Architecture

### Permission Check Flow

1. **Tool execution request** → Permission Manager
2. **Permission Manager** checks session cache → Permission Store
3. **Permission Store** queries SQLite database
4. **Policy Engine** evaluates rules if no explicit permission
5. **Policy Enforcer** validates paths and approval requirements
6. **Result** - allow/deny/require-approval decision

### Approval Workflow Flow

1. **Policy Enforcer** detects approval requirement
2. **Approval events** emitted through orchestrator
3. **Approval state** persisted in database
4. **Human approval** processed through API/CLI
5. **Permission granted** on approval, task continues

### Session Management

- Session-level caching for allow-once permissions
- Session reset on new task sessions
- Tool configuration overrides per session
- Directory access pattern caching

## Security Considerations

### Permission Security Features

1. **Explicit permission model** - Default deny unless explicitly allowed
2. **Time-based expiration** - Permissions can have expiration timestamps
3. **Scope-based permissions** - Tool permissions can be scoped to specific contexts
4. **Session isolation** - Allow-once permissions isolated to sessions
5. **Audit trail** - All permission decisions logged and trackable
6. **Policy enforcement modes** - Configurable strictness levels
7. **Pattern-based access control** - Glob patterns for file/directory access
8. **Content-based approval** - Approval rules can analyze file content
9. **Cost/token thresholds** - Approval required above resource thresholds
10. **Multi-level approval** - Support for multiple approvers and minimum approval counts

## Summary

The @apex/orchestrator package implements a comprehensive permission and access control system with the following key characteristics:

- **Layered architecture** with distinct components for storage, management, presets, and enforcement
- **Flexible permission model** supporting tool-specific, scope-specific, and time-based permissions
- **Policy-driven enforcement** with configurable rules and multiple enforcement modes
- **Session-aware caching** for performance and user experience
- **Integration with approval workflows** for human oversight
- **Comprehensive audit and event system** for tracking permission decisions
- **Extensible rule system** supporting custom policies and approval conditions
- **Database-backed persistence** with migration support for schema evolution

This analysis covers all identified permission-related code paths, functions, and components within the @apex/orchestrator package, providing a complete map of the authorization and access control implementation.