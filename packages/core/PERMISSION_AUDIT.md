# APEX Core Permission Handling Code Paths Audit

This document provides a comprehensive audit of all permission-related code paths in the `@apex/core` package, including autonomy levels, configuration validation, and type definitions.

## Overview

The APEX permission system is built around several key concepts:
- **Tool Permissions**: Control which tools agents can use and how
- **Autonomy Levels**: Define human oversight requirements
- **Permission Presets**: Pre-configured permission sets
- **Configuration Validation**: Ensure permission settings are valid
- **Policy-as-Code**: File system and operation access controls

## 1. Core Type Definitions (`packages/core/src/types.ts`)

### Permission System Types

#### Tool Permission Levels
- **File**: `packages/core/src/types.ts:87-94`
- **Schema**: `ToolPermissionSchema`
- **Description**: Defines permission levels required for tool execution
- **Values**: `'read'`, `'write'`, `'execute'`, `'network'`, `'admin'`

#### User Permission Management
- **File**: `packages/core/src/types.ts:106-141`
- **Schemas**:
  - `PermissionLevelSchema` (lines 106-111): User-granted permission levels
  - `PermissionSchema` (lines 117-129): Stored permission record structure
  - `PermissionQuerySchema` (lines 135-141): Permission lookup parameters
- **Description**: Core permission storage and query mechanisms

#### Per-Tool Permission Configuration (v0.5.0)
- **File**: `packages/core/src/types.ts:151-857`
- **Key Schemas**:
  - `DirectoryAccessConfigSchema` (lines 151-170): Directory access controls
  - `BaseToolPermissionConfigSchema` (lines 176-192): Common tool settings
  - `FilesystemToolConfigSchema` (lines 198-211): File operation permissions
  - `ShellToolConfigSchema` (lines 217-239): Command execution permissions
  - `WebToolConfigSchema` (lines 239-261): Web access permissions
  - `BrowserToolConfigSchema` (lines 261-825): Browser automation permissions
  - `ToolPermissionConfigSchema` (lines 844-852): Union of all tool configs
- **Description**: Granular per-tool permission configuration system

#### Extended Permissions
- **File**: `packages/core/src/types.ts:864-900`
- **Schemas**:
  - `ExtendedPermissionSchema` (lines 864-877): Enhanced permission with context
  - `ToolPermissionCheckOptions` (interface, lines 886-899): Permission check parameters
  - `ToolPermissionResult` (interface, lines 900-909): Permission check results
- **Description**: Advanced permission checking and result handling

### Autonomy Control System

#### Autonomy Levels
- **File**: `packages/core/src/types.ts:1491-1527`
- **Schemas**:
  - `AutonomyLevelSchema` (lines 1491-1496): Current autonomy levels
  - `LegacyAutonomyLevelSchema` (lines 1506-1512): Backward compatibility
  - `migrateLegacyAutonomyLevel()` (lines 1517-1527): Migration utility
- **Description**: Controls human oversight requirements
- **Values**: `'full-auto'`, `'review-before-commit'`, `'review-all'`

#### Approval Gates and Resource Limits
- **File**: `packages/core/src/types.ts:1537-1671`
- **Schemas**:
  - `ApprovalCheckpointTypeSchema` (lines 1537-1546): Gate types
  - `ApprovalGateSchema` (lines 1552-1578): Gate configuration
  - `TaskResourceLimitsSchema` (lines 1584-1606): Execution limits
  - `AgentAutonomyOverrideSchema` (lines 1625-1635): Per-agent overrides
  - `AutonomyConfigSchema` (lines 1641-1671): Complete autonomy configuration
- **Description**: Approval workflow and resource constraint management

### Permission Preset System

#### Permission Presets
- **File**: `packages/core/src/types.ts:6821-7064`
- **Schemas**:
  - `PermissionPresetSchema` (lines 6821-6826): Available presets
  - `ToolPermissionBehaviorSchema` (lines 6834-6839): Tool behavior types
  - `ToolPermissionRuleSchema` (lines 6878-6888): Permission rules
  - `PermissionPresetConfigSchema` (lines 6894-6910): Preset configuration
  - `PermissionsConfigSchema` (lines 7049-7064): Main permissions config
- **Description**: Pre-configured permission sets for common use cases

#### Preset Configurations
- **File**: `packages/core/src/types.ts:6916-7043`
- **Constants**:
  - `READ_ONLY_TOOLS` (lines 6845-6852): Safe tools list
  - `WRITE_TOOLS` (lines 6858-6866): Privileged tools list
  - `PERMISSION_PRESET_CONFIGS` (lines 6916-6964): Built-in presets
- **Functions**:
  - `getToolBehaviorForPreset()` (lines 6972-6986): Get tool behavior
  - `isToolAllowedForPreset()` (lines 6994-6999): Check if tool allowed
  - `isToolConfirmRequiredForPreset()` (lines 7007-7012): Check if confirmation required
  - `isToolDeniedForPreset()` (lines 7020-7025): Check if tool denied
  - `getPresetConfig()` (lines 7032-7034): Get preset configuration
  - `isPermissionPreset()` (lines 7041-7043): Type guard function

### Policy-as-Code Configuration

#### Path Access Control
- **File**: `packages/core/src/types.ts:7070-7120`
- **Schemas**:
  - `PathAccessModeSchema` (lines 7075-7076): Access control modes
  - `AllowedPathsConfigSchema` (lines 7082-7120): File system access rules
- **Description**: Filesystem access control using glob patterns

### Event System for Permissions

#### Permission Events
- **File**: `packages/core/src/types.ts:5544-5839`
- **Interfaces**:
  - `PermissionRequestEventData` (lines 5544-5566): Permission request events
  - `PermissionGrantedEventData` (lines 5567-5587): Permission granted events
  - `PermissionDeniedEventData` (lines 5588-5609): Permission denied events
  - `PermissionEvent` (lines 5755-5763): Generic permission event
- **Schemas**:
  - `PermissionNotificationSchema` (lines 5785-5839): Permission notifications
- **Description**: Event-driven permission management system

#### Permission Change Events
- **File**: `packages/core/src/types.ts:9561-9617`
- **Schemas**:
  - `PermissionChangeTypeSchema` (lines 9561-9567): Change types
  - `PermissionDetailsSchema` (lines 9572-9595): Change details
  - `PermissionChangeEventSchema` (lines 9600-9617): Change events
- **Description**: Permission modification tracking and auditing

## 2. Configuration Loading and Validation (`packages/core/src/config.ts`)

### Permission Configuration Loading
- **File**: `packages/core/src/config.ts:12,240-312`
- **Functions**:
  - `loadConfig()` (lines 240-312): Main configuration loader
- **Description**: Loads and validates APEX configuration including permission settings

### Default Permission Configuration
- **File**: `packages/core/src/config.ts:877-879,1181-1184`
- **Functions**:
  - `initializeApex()` (lines 801-976): Sets default permission preset to 'review-all'
  - `getEffectiveConfig()` (lines 1076-1558): Applies permission defaults
- **Description**: Establishes secure-by-default permission configuration

## 3. Permission Test Utilities (`packages/core/src/test-utils.ts`)

### Mock Permission Objects
- **File**: `packages/core/src/test-utils.ts:476-867`
- **Functions**:
  - `createMockPermission()` (lines 476-501): Creates mock Permission objects
  - `createMockExtendedPermission()` (lines 503-527): Creates mock ExtendedPermission objects
  - `createMockPermissionQuery()` (lines 529-549): Creates mock PermissionQuery objects
  - `createMockToolPermissionConfig()` (lines 551-572): Creates mock tool configs
  - `createMockToolPermissionResult()` (lines 747-770): Creates mock permission results
  - `createMockPermissionsConfig()` (lines 798-819): Creates mock permissions config
  - `createMockPermissionPresetConfig()` (lines 821-843): Creates mock preset config
  - `createMockToolPermissionRule()` (lines 845-867): Creates mock permission rules
- **Description**: Testing utilities for permission-related objects

### Permission Event Mocking
- **File**: `packages/core/src/test-utils.ts:868-932`
- **Functions**:
  - `createMockPermissionRequestEventData()` (lines 868-893): Mock permission requests
  - `createMockPermissionGrantedEventData()` (lines 895-919): Mock grant events
  - `createMockPermissionDeniedEventData()` (lines 921-932): Mock denial events
- **Description**: Event system testing utilities

### Permission Context Management
- **File**: `packages/core/src/test-utils.ts:935-1157`
- **Interfaces**:
  - `AgentPermissionContext` (lines 935-945): Agent permission context
  - `ToolPermissionContext` (lines 947-956): Tool permission context
  - `MockPermissionContext` (lines 958-982): Unified mock context
- **Functions**:
  - `mockAgentPermissions()` (lines 984-1018): Mock agent permissions
  - `mockToolPermissions()` (lines 1020-1078): Mock tool permissions
  - `createMockPermissionContext()` (lines 1080-1157): Create mock context
- **Description**: Permission context mocking for testing

### Permission Testing Suites
- **File**: `packages/core/src/test-utils.ts:1158-1489`
- **Functions**:
  - `createCommonPermissionScenarios()` (lines 1158-1251): Common test scenarios
  - `createTestPermissionStore()` (lines 1253-1292): Test permission storage
  - `createPermissionTestingSuite()` (lines 1491-1619): Complete test suite
- **Description**: Comprehensive permission testing frameworks

### Permission Assertions and Matchers
- **File**: `packages/core/src/test-utils.ts:1294-2728`
- **Functions**:
  - `assertPermissionEquals()` (lines 1294-1330): Permission equality assertions
  - `assertPermissionResultEquals()` (lines 1332-1364): Result equality assertions
  - `assertPermissionState()` (lines 1366-1431): State assertions
  - `expectPermissionGranted()` (lines 1770-1797): Grant expectations
  - `expectPermissionDenied()` (lines 1799-1829): Denial expectations
  - `expectPermissionPending()` (lines 1831-1855): Pending expectations
  - `setupPermissionMatchers()` (lines 2728): Custom matchers setup
- **Description**: Assertion helpers and custom matchers for permission testing

## 4. Error Handling (`packages/core/src/tools/browser/`)

### Browser Permission Errors
- **File**: `packages/core/src/tools/browser/browser-permission-denied-error.ts`
- **Classes**:
  - `BrowserPermissionDeniedError` (lines 155-436): Specialized permission error
  - `BrowserPermissionDeniedContext` (lines 105-153): Error context interface
- **Functions**:
  - `isBrowserPermissionDeniedError()` (lines 438-447): Type guard
  - `toBrowserPermissionDeniedError()` (lines 449-470): Error converter
- **Description**: Browser-specific permission denial error handling

### Generic Permission Errors
- **File**: `packages/core/src/test-fixtures/errors/`
- **Functions**:
  - `createPermissionError()` (agent-errors.ts:256): Creates agent permission errors
  - `createPermissionError()` (system-errors.ts:260): Creates system permission errors
- **Description**: Generic permission error creation utilities

## 5. Tool-Specific Permission Integration

### Individual Tool Permissions
- **Files**: `packages/core/src/tools/*/`
- **Pattern**: Each tool imports `ToolPermission` type from types.ts
- **Examples**:
  - `packages/core/src/tools/filesystem/read-tool.ts:18`
  - `packages/core/src/tools/filesystem/glob-tool.ts:18`
  - `packages/core/src/tools/shell/bash-tool.ts:16`
  - `packages/core/src/tools/web/web-search-tool.ts:39`
  - `packages/core/src/tools/search/grep-tool.ts:20`
- **Description**: Individual tools integrate with the permission system

## 6. Test Coverage Files

### Permission-Specific Tests
- **Files**: `packages/core/src/permission-*.test.ts`
  - `permission-coverage.test.ts`: Permission system coverage validation
  - `permission-integration.test.ts`: Integration testing
  - `permission-types.test.ts`: Type validation testing
  - `permission-validation.test.ts`: Configuration validation testing
  - `permission-preset.test.ts`: Preset functionality testing

### Autonomy Control Tests
- **Files**: `packages/core/src/__tests__/autonomy-*`
  - `autonomy-control-comprehensive.test.ts`: Comprehensive autonomy testing
  - `autonomy-control-types.test.ts`: Type system testing
  - `autonomy-control-integration.test.ts`: Integration testing
  - `autonomy-control-acceptance.test.ts`: Acceptance criteria testing
  - `autonomy-control-edge-cases.test.ts`: Edge case handling

## 7. Key Permission Code Paths Summary

### 1. Permission Type System
- **Location**: `packages/core/src/types.ts` (lines 87-141, 864-900)
- **Purpose**: Core permission data structures and validation schemas

### 2. Tool Permission Configuration
- **Location**: `packages/core/src/types.ts` (lines 151-857)
- **Purpose**: Per-tool permission settings and directory access controls

### 3. Autonomy Control System
- **Location**: `packages/core/src/types.ts` (lines 1491-1671)
- **Purpose**: Human oversight controls and approval workflows

### 4. Permission Presets
- **Location**: `packages/core/src/types.ts` (lines 6821-7064)
- **Purpose**: Pre-configured permission sets and behavior helpers

### 5. Configuration Loading
- **Location**: `packages/core/src/config.ts` (lines 240-312, 1076-1558)
- **Purpose**: Permission configuration loading and default application

### 6. Testing Infrastructure
- **Location**: `packages/core/src/test-utils.ts` (lines 476-2728)
- **Purpose**: Comprehensive testing utilities for permission system

### 7. Error Handling
- **Location**: `packages/core/src/tools/browser/browser-permission-denied-error.ts`
- **Purpose**: Permission-specific error handling and reporting

### 8. Event System
- **Location**: `packages/core/src/types.ts` (lines 5544-5839, 9561-9617)
- **Purpose**: Permission change events and notification system

## 8. Permission Flow Architecture

### Configuration Flow
1. **Default Setup**: `initializeApex()` sets 'review-all' preset
2. **Loading**: `loadConfig()` loads user configuration
3. **Validation**: Configuration schemas validate permission settings
4. **Application**: `getEffectiveConfig()` applies defaults and overrides

### Runtime Permission Check Flow
1. **Tool Request**: Tool requests permission for operation
2. **Preset Check**: Check permission preset configuration
3. **Rule Evaluation**: Apply custom rules and overrides
4. **User Confirmation**: Prompt user if confirmation required
5. **Result**: Return permission decision with context

### Autonomy Control Flow
1. **Level Check**: Evaluate autonomy level setting
2. **Gate Evaluation**: Check if approval gates apply
3. **Override Application**: Apply agent/stage specific overrides
4. **Approval Request**: Request human approval if required
5. **Action**: Proceed, skip, or abort based on approval result

## Conclusion

The APEX Core permission system provides comprehensive access control through:

- **Granular Tool Permissions**: Per-tool configuration with scope controls
- **Flexible Autonomy Levels**: Configurable human oversight requirements
- **Preset Configurations**: Common permission patterns for ease of use
- **Policy-as-Code**: File system and operation access rules
- **Event-Driven Architecture**: Permission change tracking and notifications
- **Comprehensive Testing**: Extensive test utilities and coverage validation

All permission-related code is centralized in `packages/core/src/types.ts` with supporting functionality in `config.ts` and `test-utils.ts`, ensuring maintainability and consistency across the APEX platform.