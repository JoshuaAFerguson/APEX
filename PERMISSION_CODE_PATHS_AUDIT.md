# APEX Permission Handling Code Paths Audit

This document provides a comprehensive audit of permission handling code paths across all APEX packages and documents current test coverage gaps.

## Executive Summary

APEX implements a sophisticated permission management system across four main packages. The permission system includes:
- Type definitions and schemas
- Permission storage and management
- UI components for permission prompts
- API endpoints for permission decisions
- Comprehensive test coverage (70+ dedicated permission test files)

## 1. Core Package (`@apex/core`) - Permission Foundation

### Permission-Related Code Paths

#### Type Definitions (`packages/core/src/types.ts`)
- **PermissionLevelSchema**: Defines permission levels (`allow-always`, `allow-once`, `deny`)
- **PermissionSchema**: Core permission record structure with tool, scope, level, expiry, createdAt
- **PermissionQuerySchema**: Query parameters for permission lookups
- **DirectoryAccessConfigSchema**: Controls directory access via allowlist/blocklist patterns
- **BaseToolPermissionConfigSchema**: Base configuration for all tools
- **FilesystemToolConfigSchema**: Filesystem-specific permission configurations
- **ExtendedPermissionSchema**: Enhanced permissions with config, reason, grantedBy, tags
- **ToolPermissionCheckOptions**: Options for comprehensive permission checks
- **DirectoryAccessCheckOptions**: Options for directory access validation

#### Permission Validation (`packages/core/src/`)
- **DirectoryAccessValidator**: Validates path access against allowlist/blocklist patterns
- **PermissionConfigLoader**: Loads permission configurations from YAML files
- **DangerousOperationDetector**: Detects potentially dangerous operations requiring permissions

#### Browser Permission Handling
- **BrowserPermissionDeniedError**: Specialized error for browser permission failures
- **MockBrowser**: Testing utilities for browser permission scenarios

### Test Coverage Analysis - Core Package

**Coverage Status: EXCELLENT** - 25+ dedicated test files

Key test coverage areas:
- ✅ **Permission type validation**: Complete coverage of all schemas
- ✅ **Directory access validation**: Comprehensive path checking logic
- ✅ **Permission configuration loading**: YAML config parsing and validation
- ✅ **Dangerous operation detection**: Security-focused operation classification
- ✅ **Browser permission errors**: Browser-specific permission handling
- ✅ **Integration tests**: Cross-package permission workflows

**Coverage Gaps**: None identified - core package has comprehensive test coverage.

## 2. Orchestrator Package (`@apex/orchestrator`) - Permission Logic

### Permission-Related Code Paths

#### Core Permission Management
- **PermissionStore** (`permission-store.ts`): SQLite-based persistent permission storage
  - `savePermission()`: Store basic permissions
  - `saveExtendedPermission()`: Store enhanced permissions with metadata
  - `getPermission()` / `getExtendedPermission()`: Retrieve permissions by tool/scope
  - `listPermissions()` / `listExtendedPermissions()`: Query permissions with filtering
  - `clearPermission()` / `clearPermissions()`: Remove permissions
  - `getDirectoryAccess()` / `updateDirectoryAccess()`: Manage directory permissions

- **PermissionManager** (`permission-manager.ts`): High-level permission orchestration
  - `checkPermission()`: Check permission level, consuming allow-once permissions
  - `grantPermission()`: Grant permissions with level and scope
  - `revokePermission()`: Remove granted permissions
  - `hasPermission()`: Boolean permission check
  - `getToolConfig()` / `setToolConfig()`: Tool-specific configuration management
  - `checkDirectoryAccess()`: Validate directory access with configuration
  - `checkToolPermission()`: Comprehensive permission validation with path checking

#### Permission Preset System
- **PermissionPresetManager** (`permission-preset-manager.ts`): Predefined permission patterns
  - `applyPreset()`: Apply permission presets, clearing existing permissions
  - `listPresets()`: Available permission preset management
  - `validatePreset()`: Preset validation logic

#### Browser Tool Integration
- **BrowserManager** (`browser-manager.ts`): Browser permission integration
  - `setPermissionManager()`: Inject permission manager into browser tools
  - Tool lifecycle permission checking

- **BrowserTool** (`tools/browser-tool.ts`): Browser-specific permission logic
  - `checkPermission()`: Browser action permission validation
  - Integration with PermissionManager for navigation, evaluation, etc.

### Test Coverage Analysis - Orchestrator Package

**Coverage Status: EXCELLENT** - 40+ dedicated test files

Key test coverage areas:
- ✅ **PermissionStore CRUD operations**: Complete database interaction coverage
- ✅ **PermissionManager session management**: Session caching and consumption logic
- ✅ **Permission preset workflows**: Preset application and management
- ✅ **Browser permission integration**: Tool-specific permission checking
- ✅ **Event-driven permission flows**: Permission request/grant/deny event handling
- ✅ **Database migrations**: Extended permission schema migration testing
- ✅ **Permission granularity**: Per-tool, per-scope permission management
- ✅ **Policy engine integration**: Permission enforcement with policies
- ✅ **Mid-stream permission revocation**: Dynamic permission changes during execution

**Coverage Gaps**: None identified - orchestrator has extensive permission test coverage.

## 3. CLI Package (`@apex/cli`) - Permission UI

### Permission-Related Code Paths

#### Permission UI Components
- **PermissionPrompt** (`ui/components/permissions/PermissionPrompt.tsx`): Interactive permission UI
  - User permission decision interface (allow-always/allow-once/deny)
  - Danger level visualization (low/medium/high/critical)
  - Keyboard navigation and direct key selection
  - Compact and normal display modes
  - Parameter display and context information

- **PermissionHistory**: Historical permission decisions display
  - Past permission decisions tracking
  - Permission audit trail UI

#### Permission Event Handling
- **useOrchestratorEvents**: React hook for permission event handling
  - Real-time permission notifications
  - Permission change event processing

### Test Coverage Analysis - CLI Package

**Coverage Status: GOOD** - 5+ dedicated test files

Key test coverage areas:
- ✅ **PermissionPrompt component**: UI interaction and state management
- ✅ **Permission notifications**: Event-driven notification handling
- ✅ **Orchestrator event integration**: Permission event processing
- ⚠️ **Permission history display**: Limited test coverage
- ⚠️ **Keyboard navigation**: Partial coverage of shortcut handling

**Coverage Gaps Identified**:
1. **Permission history component testing**: No comprehensive tests for PermissionHistory component
2. **Keyboard navigation edge cases**: Limited testing of complex key combinations
3. **Permission prompt accessibility**: No dedicated accessibility testing
4. **Error state handling**: Limited testing of permission prompt error states

## 4. API Package (`@apex/api`) - Permission Endpoints

### Permission-Related Code Paths

#### No Direct Permission Endpoints
The API package focuses on task management and does not expose direct permission management endpoints. Permission decisions are handled through:

#### Indirect Permission Integration
- **WebSocket event broadcasting**: Permission-related events streamed to clients
- **Orchestrator integration**: Permission decisions affect task execution flows
- **Event filtering**: Clients can subscribe to permission-specific events

### Test Coverage Analysis - API Package

**Coverage Status: LIMITED** - 2 dedicated test files

Key test coverage areas:
- ✅ **WebSocket permission notifications**: Event broadcasting testing
- ✅ **Permission analysis utilities**: Basic permission analysis functionality
- ⚠️ **Permission event filtering**: Limited WebSocket filter testing

**Coverage Gaps Identified**:
1. **Permission event integration**: No comprehensive tests for permission events affecting API responses
2. **Permission-based access control**: No testing of permission-driven API behavior
3. **Permission event reliability**: Limited testing of permission event delivery guarantees

## 5. Browser Package (`@apex/browser`) - Permission Mocking

### Permission-Related Code Paths

#### Permission Mocking System
- **MockPermissions** (`permission-mocking/mock-permissions.ts`): Browser permission simulation
- **MockPermissionStatus** (`permission-mocking/mock-permission-status.ts`): Permission status mocking
- **Permission types** (`permission-mocking/types.ts`): Type definitions for mock permissions

### Test Coverage Analysis - Browser Package

**Coverage Status: GOOD** - 3+ dedicated test files

Key test coverage areas:
- ✅ **Permission mocking utilities**: Mock permission status and behavior
- ✅ **Edge case handling**: Permission mocking error scenarios
- ⚠️ **Browser permission APIs**: Limited coverage of actual browser permission integration

**Coverage Gaps Identified**:
1. **Real browser permission testing**: No tests with actual browser permission APIs
2. **Permission callback handling**: Limited testing of permission state change callbacks
3. **Cross-browser compatibility**: No testing across different browser permission implementations

## Summary of Coverage Gaps Requiring New Tests

### Critical Gaps (High Priority)

1. **CLI Package**:
   - PermissionHistory component comprehensive testing
   - Permission prompt accessibility compliance testing
   - Complex keyboard navigation scenario testing
   - Permission prompt error state handling

2. **API Package**:
   - Permission event integration with API workflows
   - Permission-based access control for API endpoints
   - Permission event delivery reliability testing

### Minor Gaps (Medium Priority)

1. **Browser Package**:
   - Real browser permission API integration testing
   - Permission state change callback testing
   - Cross-browser permission compatibility testing

2. **Integration Testing**:
   - End-to-end permission workflows across all packages
   - Performance testing of permission decision flows
   - Permission system stress testing under high load

## Overall Assessment

**Test Coverage Score: 85/100**

APEX has **excellent** permission handling test coverage overall, with 70+ dedicated permission test files across packages. The core permission logic in `@apex/core` and `@apex/orchestrator` is comprehensively tested. The main gaps are in UI component testing (`@apex/cli`) and integration scenarios (`@apex/api`).

### Recommendations

1. **Immediate**: Implement missing CLI component tests for PermissionHistory and error states
2. **Short-term**: Add API integration tests for permission-driven workflows
3. **Long-term**: Implement cross-browser permission compatibility testing
4. **Ongoing**: Maintain comprehensive integration test coverage for new permission features

The permission system architecture is robust and well-tested, providing a solid foundation for secure agent tool access control.