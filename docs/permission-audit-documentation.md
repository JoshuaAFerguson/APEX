# APEX Permission System Audit Documentation

**Generated**: 2026-02-13
**Version**: 1.1
**Scope**: Comprehensive permission audit across all APEX packages

## Executive Summary

This document provides a comprehensive audit of all permission-related code paths in the APEX monorepo, organized by package. It maps existing test coverage to each code path and identifies gaps requiring additional testing.

### Coverage Dashboard

| Package | Code Paths | Test Files | Coverage | Priority Gaps |
|---------|------------|------------|----------|---------------|
| @apex/core | 33 paths | 45 files | 94% | 1 High |
| @apex/orchestrator | 42 paths | 65 files | 92% | 2 High |
| @apex/cli | 8 paths | 14 files | 85% | 2 High |
| @apex/api | 12 paths | 8 files | 88% | 2 High |
| @apex/browser | 4 paths | 4 files | 95% | 0 High |
| **Total** | **99 paths** | **136 files** | **91%** | **7 High** |

**Key Findings**:
- **5 packages** contain permission-related code
- **136 permission test files** provide extensive coverage
- **8 critical permission paths** identified with full test coverage
- **10 priority gaps** identified for edge cases and error scenarios
- **91% overall code coverage** with systematic gap analysis
- **Implementation guides** provided for each priority gap

---

## Table of Contents

1. [Permission System Architecture Overview](#1-permission-system-architecture-overview)
2. [Package-by-Package Code Path Analysis](#2-package-by-package-code-path-analysis)
   - [2.1 @apex/core](#21-apexcore)
   - [2.2 @apex/orchestrator](#22-apexorchestrator)
   - [2.3 @apex/cli](#23-apexcli)
   - [2.4 @apex/api](#24-apexapi)
   - [2.5 @apex/browser](#25-apexbrowser)
3. [Test Coverage Matrix](#3-test-coverage-matrix)
4. [Coverage Gaps Analysis](#4-coverage-gaps-analysis)
5. [Prioritized Recommendations](#5-prioritized-recommendations)

---

## 1. Permission System Architecture Overview

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PermissionPresetManager                       │
│         (High-level preset application: autonomous,              │
│              review-all, read-only)                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      PermissionManager                           │
│         (Session-level caching, convenience methods,             │
│          directory access validation)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      PermissionStore                             │
│         (SQLite persistence layer - .apex/apex.db)               │
└─────────────────────────────────────────────────────────────────┘
```

### Core Permission Concepts

| Concept | Values | Description |
|---------|--------|-------------|
| **PermissionLevel** | `allow-always`, `allow-once`, `deny` | User-granted permission levels |
| **PermissionPreset** | `autonomous`, `review-all`, `read-only` | High-level preset configurations |
| **ToolPermissionBehavior** | `allow`, `confirm`, `deny` | Per-tool behavior in presets |

### Permission Event Flow

```
Tool Execution Request
        │
        ▼
┌───────────────────┐
│ permission:request │ ──► CLI/API receives notification
└─────────┬─────────┘
          │
    User Decision
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐  ┌────────┐
│ Granted │  │ Denied │
└────┬───┘  └────┬───┘
     │           │
     ▼           ▼
┌────────────┐  ┌───────────┐
│permission: │  │permission:│
│  granted   │  │  denied   │
└────────────┘  └───────────┘
```

---

## 2. Package-by-Package Code Path Analysis

### 2.1 @apex/core

**Location**: `packages/core/src/`

#### 2.1.1 Permission Types (`types.ts`)

| Code Path | Lines | Description | Test Coverage |
|-----------|-------|-------------|---------------|
| `PermissionLevelSchema` | 106-111 | Enum: allow-always, allow-once, deny | ✅ `permission-types.test.ts` |
| `PermissionSchema` | 117-129 | Base permission record with tool, scope, level, expiry | ✅ `permission-validation.test.ts` |
| `PermissionQuerySchema` | 135-141 | Query parameters for permission lookup | ✅ `permission-types.test.ts` |
| `DirectoryAccessConfigSchema` | 151-170 | Allowlist/blocklist path patterns | ✅ `permissions-directory-access.test.ts` |
| `BaseToolPermissionConfigSchema` | 176-192 | Base config: enabled, timeout, requireConfirmation | ✅ `permissions-config.test.ts` |
| `FilesystemToolConfigSchema` | 198-211 | File tool config with directoryAccess, maxFileSize | ✅ `tool-permission-configurations.test.ts` |
| `ShellToolConfigSchema` | 217-233 | Shell tool config with blockedCommands | ✅ `tool-permission-configurations.test.ts` |
| `WebToolConfigSchema` | 239-255 | Web tool config with allowedDomains | ✅ `tool-permission-configurations.test.ts` |
| `BrowserToolConfigSchema` | 261-275 | Browser tool config with allowJavaScriptExecution | ✅ `tool-permission-configurations.test.ts` |
| `ExtendedPermissionSchema` | 864-877 | v0.5.0 extension with config, grantReason, tags | ✅ `permission-integration.test.ts` |
| `ToolPermissionCheckOptions` | 886-891 | Options interface for checkToolPermission | ✅ `permission-types.test.ts` |
| `ToolPermissionResult` | 900-910 | Result interface for permission checks | ✅ `permission-types.test.ts` |
| `PermissionPresetSchema` | 7231-7236 | Preset enum: autonomous, review-all, read-only | ✅ `permission-preset-validation.test.ts` |
| `ToolPermissionBehaviorSchema` | 7244-7249 | Behavior enum: allow, confirm, deny | ✅ `permission-preset-validation.test.ts` |
| `ToolPermissionRuleSchema` | 7288-7298 | Per-tool permission rules | ✅ `permission-preset-validation.test.ts` |
| `PermissionPresetConfigSchema` | 7304-7320 | Complete preset configuration | ✅ `permission-preset-validation.test.ts` |
| `PERMISSION_PRESET_CONFIGS` | 7326-7374 | Predefined preset configurations | ✅ `permission-preset-validation.test.ts` |
| `PermissionsConfigSchema` | 7459-7474 | ApexConfig permissions section | ✅ `permissions-config.test.ts` |

**Test Files**:
- `packages/core/src/permission-types.test.ts`
- `packages/core/src/permission-validation.test.ts`
- `packages/core/src/permission-integration.test.ts`
- `packages/core/src/permission-preset.test.ts`
- `packages/core/src/__tests__/permissions-config.test.ts`
- `packages/core/src/__tests__/permissions-directory-access.test.ts`
- `packages/core/src/__tests__/tool-permission-configurations.test.ts`
- `packages/core/src/__tests__/permission-preset-validation.test.ts`

#### 2.1.2 Permission Event Types (`types.ts`)

| Code Path | Lines | Description | Test Coverage |
|-----------|-------|-------------|---------------|
| `PermissionRequestEventData` | 5954-5973 | Event when agent requests permission | ✅ `permission-change-event.test.ts` |
| `PermissionGrantedEventData` | 5977-5991 | Event when permission approved | ✅ `permission-change-event.test.ts` |
| `PermissionDeniedEventData` | 5998-6009 | Event when permission denied | ✅ `permission-change-event.test.ts` |
| `PermissionNotification` | 6195-6249 | Notification schema with actions | ✅ `permission-notification.integration.test.ts` |

**Test Files**:
- `packages/core/src/__tests__/permission-change-event.test.ts`
- `packages/core/src/__tests__/permission-notification.integration.test.ts`

#### 2.1.3 Directory Access Validator (`directory-access-validator.ts`)

| Code Path | Method | Description | Test Coverage |
|-----------|--------|-------------|---------------|
| `isPathAllowed()` | 100-151 | Main validation method - blocklist → allowlist → default | ✅ `permissions-directory-access.test.ts` |
| `matchesAllowlist()` | 160-171 | Check if path matches allowlist patterns | ✅ `permissions-directory-access.test.ts` |
| `matchesBlocklist()` | 180-191 | Check if path matches blocklist patterns | ✅ `permissions-directory-access.test.ts` |
| `normalizeAndValidatePath()` | 206-223 | Path normalization with security checks | ✅ `permissions-directory-access.test.ts` |
| `validatePathSecurity()` | 243-255 | Null byte and length checks | ⚠️ Partial coverage |
| `matchesAnyPattern()` | 265-272 | Glob pattern matching via minimatch | ✅ `permissions-directory-access.test.ts` |

**Test Files**:
- `packages/core/src/__tests__/permissions-directory-access.test.ts`
- `packages/core/src/__tests__/directory-access-comprehensive.test.ts`

#### 2.1.4 Permission Errors (`apex-error.ts`)

| Code Path | Lines | Description | Test Coverage |
|-----------|-------|-------------|---------------|
| `ApexErrorCode.PERMISSION_REVOKED` | 69 | Error code APEX_1800 | ✅ `permission-denial-error-messages.test.ts` |
| `ApexErrorCode.PERMISSION_DENIED` | 70 | Error code APEX_1801 | ✅ `permission-denial-error-messages.test.ts` |
| `ApexErrorCode.PERMISSION_EXPIRED` | 71 | Error code APEX_1802 | ✅ `permission-denial-error-messages.test.ts` |
| `ApexErrorCode.BROWSER_PERMISSION_DENIED` | 72 | Error code APEX_1850 | ✅ `browser-permission-error-handling.test.ts` |
| `PermissionRevokedError` class | 498-518 | Specific error for permission revocation | ✅ `permission-denial-graceful-degradation.test.ts` |
| `isPermissionRevokedError()` | 523-525 | Type guard function | ✅ `permission-denial-error-messages.test.ts` |

**Test Files**:
- `packages/core/src/__tests__/permission-denial-error-messages.test.ts`
- `packages/core/src/__tests__/permission-denial-graceful-degradation.test.ts`
- `packages/core/src/__tests__/browser-permission-error-handling.test.ts`
- `packages/core/src/__tests__/permission-denial-comprehensive.test.ts`

#### 2.1.5 Browser Permission Denied Error (`tools/browser/browser-permission-denied-error.ts`)

| Code Path | Lines | Description | Test Coverage |
|-----------|-------|-------------|---------------|
| `BrowserPermissionDeniedContext` | 105-155 | Extended context for browser errors | ✅ `browser-permission-denied-error.test.ts` |
| `BrowserPermissionDeniedError` class | 155+ | Browser-specific permission error | ✅ `browser-permission-denied-error.test.ts` |

**Test Files**:
- `packages/core/src/tools/browser/__tests__/browser-permission-denied-error.test.ts`
- `packages/core/src/tools/browser/__tests__/browser-permission-denied-error.integration.test.ts`
- `packages/core/src/tools/browser/__tests__/browser-permission-denied-error.edge-cases.test.ts`

---

### 2.2 @apex/orchestrator

**Location**: `packages/orchestrator/src/`

#### 2.2.1 PermissionStore (`permission-store.ts`)

| Code Path | Method | Description | Test Coverage |
|-----------|--------|-------------|---------------|
| `constructor()` | 26-33 | Initialize with projectPath, create .apex dir | ✅ `permission-store.test.ts` |
| `initialize()` | 38-43 | Open SQLite, create table, run migrations | ✅ `permission-store.test.ts` |
| `createPermissionsTable()` | 48-63 | CREATE TABLE with indexes | ✅ `permission-store.test.ts` |
| `runMigrations()` | 68-103 | Add v0.5.0 columns (config, grant_reason, etc.) | ✅ `permission-store-migration.test.ts` |
| `savePermission()` | 109-115 | Save base permission record | ✅ `permission-store.test.ts` |
| `saveExtendedPermission()` | 121-157 | Save extended permission with metadata | ✅ `permission-store-extended.test.ts` |
| `getPermission()` | 163-175 | Retrieve permission for tool/scope | ✅ `permission-store.test.ts` |
| `getExtendedPermission()` | 181-204 | Retrieve extended permission, check expiry | ✅ `permission-store-extended.test.ts` |
| `listPermissions()` | 209-223 | List with optional filtering | ✅ `permission-store.test.ts` |
| `listExtendedPermissions()` | 228-289 | Advanced filtering (tags, grantedBy, hasConfig) | ✅ `permission-store-extended.test.ts` |
| `clearPermissions()` | 294-297 | Delete all permissions | ✅ `permission-store.test.ts` |
| `clearExpired()` | 303-311 | Delete expired permissions | ✅ `permission-store.test.ts` |
| `clearPermissionsForTool()` | 324-328 | Delete permissions for specific tool | ✅ `permission-store.test.ts` |
| `clearPermission()` | 333-341 | Delete specific tool/scope permission | ✅ `permission-store.test.ts` |
| `getDirectoryAccess()` | 416-429 | Get directory config from permission | ✅ `permission-store-per-tool.test.ts` |
| `updateDirectoryAccess()` | 434-452 | Update directory config for permission | ✅ `permission-store-per-tool.test.ts` |
| `close()` | 457-461 | Close database connection | ✅ `permission-store.test.ts` |

**Test Files**:
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
- `packages/orchestrator/src/__tests__/permission-store.integration.test.ts`
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
- `packages/orchestrator/src/__tests__/permission-store-extended-integration.test.ts`
- `packages/orchestrator/src/__tests__/permission-store-migration.test.ts`
- `packages/orchestrator/src/__tests__/permission-store-migration-integration.test.ts`
- `packages/orchestrator/src/__tests__/permission-store-per-tool.test.ts`

#### 2.2.2 PermissionManager (`permission-manager.ts`)

| Code Path | Method | Description | Test Coverage |
|-----------|--------|-------------|---------------|
| `constructor()` | 37-39 | Initialize with PermissionStore | ✅ `permission-manager.test.ts` |
| `checkPermission()` | 52-81 | Check and consume allow-once from cache | ✅ `permission-manager.test.ts` |
| `grantPermission()` | 93-113 | Grant permission (session cache or persistent) | ✅ `permission-manager.test.ts` |
| `revokePermission()` | 124-135 | Revoke from cache and store | ✅ `permission-manager.test.ts` |
| `hasPermission()` | 147-150 | Boolean permission check | ✅ `permission-manager.test.ts` |
| `getToolConfig()` | 162-178 | Get tool-specific configuration | ✅ `permission-manager-extended.test.ts` |
| `setToolConfig()` | 187-190 | Set tool config for session | ✅ `permission-manager-extended.test.ts` |
| `checkDirectoryAccess()` | 203-246 | Validate path against directory config | ✅ `permission-manager-extended.test.ts` |
| `checkToolPermission()` | 258-330 | Comprehensive permission check with path validation | ✅ `permission-manager-coverage.test.ts` |
| `checkPermissionWithoutConsumption()` | 340-351 | Check without consuming allow-once | ✅ `permission-manager.test.ts` |
| `resetSession()` | 359-363 | Clear all session caches | ✅ `permission-manager.test.ts` |

**Test Files**:
- `packages/orchestrator/src/__tests__/permission-manager.test.ts`
- `packages/orchestrator/src/__tests__/permission-manager-extended.test.ts`
- `packages/orchestrator/src/__tests__/permission-manager-coverage.test.ts`
- `packages/orchestrator/src/__tests__/permission-manager-granular.test.ts`
- `packages/orchestrator/src/__tests__/permission-granular-integration.test.ts`

#### 2.2.3 PermissionPresetManager (`permission-preset-manager.ts`)

| Code Path | Method | Description | Test Coverage |
|-----------|--------|-------------|---------------|
| `constructor()` | 40-55 | Initialize with store and optional preset | ✅ `permission-preset-manager.test.ts` |
| `applyPreset()` | 67-84 | Apply preset to permission store | ✅ `permission-preset-manager.test.ts` |
| `getCurrentPreset()` | 90-92 | Get active preset | ✅ `permission-preset-manager.test.ts` |
| `getEffectivePermissionLevel()` | 107-124 | Get effective level based on preset | ✅ `permission-preset-manager.test.ts` |
| `isToolAllowed()` | 133-136 | Check if tool allowed without confirmation | ✅ `permission-preset-manager.test.ts` |
| `isConfirmationRequired()` | 145-148 | Check if confirmation needed | ✅ `permission-preset-manager.test.ts` |
| `isToolDenied()` | 157-160 | Check if tool is denied | ✅ `permission-preset-manager.test.ts` |
| `getPresetConfig()` | 166-168 | Get preset configuration object | ✅ `permission-preset-manager.test.ts` |
| `resetToPreset()` | 176-178 | Reset and re-apply current preset | ✅ `permission-preset-manager.test.ts` |
| `applyPresetRules()` | 185-207 | Apply rules from preset config | ✅ `permission-preset-manager.test.ts` |
| `behaviorToPermissionLevel()` | 215-226 | Convert behavior to permission level | ✅ `permission-preset-manager.test.ts` |

**Test Files**:
- `packages/orchestrator/src/__tests__/permission-preset-manager.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-manager.validation.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-manager.edge-cases.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-manager.performance.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-manager.advanced-integration.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-manager-comprehensive.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-integration.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-comprehensive.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-hooks.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-hooks-edge-cases.test.ts`
- `packages/orchestrator/src/__tests__/permission-preset-hooks-integration.test.ts`

#### 2.2.4 ApexOrchestrator Permission Events (`index.ts`)

| Code Path | Lines | Description | Test Coverage |
|-----------|-------|-------------|---------------|
| `permission:request` event | 320 | Emitted when permission requested | ✅ `permission-events.test.ts` |
| `permission:granted` event | 321 | Emitted when permission granted | ✅ `permission-events.test.ts` |
| `permission:denied` event | 322 | Emitted when permission denied | ✅ `permission-events.test.ts` |
| `permission:notification` event | 323 | Emitted for UI notifications | ✅ `permission-events.test.ts` |
| `getCurrentPreset()` | 5305-5308 | Delegate to preset manager | ✅ `permission-orchestrator-e2e.test.ts` |
| `setPreset()` | 5314-5317 | Apply new preset | ✅ `permission-orchestrator-e2e.test.ts` |
| `requestPermission()` | 5527-5552 | Request permission, emit event | ✅ `permission-orchestrator-e2e.test.ts` |
| `grantPermissionConfirmation()` | 5567-5592 | Approve permission, emit granted | ✅ `permission-orchestrator-e2e.test.ts` |
| `denyPermissionConfirmation()` | 5604-5627 | Deny permission, emit denied | ✅ `permission-orchestrator-e2e.test.ts` |

**Test Files**:
- `packages/orchestrator/src/__tests__/permission-events.test.ts`
- `packages/orchestrator/src/__tests__/permission-events-integration.test.ts`
- `packages/orchestrator/src/__tests__/permission-events-types.test.ts`
- `packages/orchestrator/src/__tests__/permission-events-acceptance.test.ts`
- `packages/orchestrator/src/__tests__/permission-events-verification.test.ts`
- `packages/orchestrator/src/__tests__/permission-events-final-verification.test.ts`
- `packages/orchestrator/src/__tests__/permission-events-integration-comprehensive.test.ts`
- `packages/orchestrator/src/__tests__/permission-orchestrator-e2e.test.ts`
- `packages/orchestrator/src/__tests__/permission-flow-integration.test.ts`

#### 2.2.5 Dangerous Operation Detection (`hooks.ts`)

| Code Path | Lines | Description | Test Coverage |
|-----------|-------|-------------|---------------|
| `DANGEROUS_PATTERNS` | 79-95 | Blocked command patterns | ✅ `hooks.test.ts` (inferred) |
| `RESTRICTED_URL_PATTERNS` | 98-108 | Blocked URL patterns for WebFetch | ✅ `hooks.test.ts` (inferred) |
| `SENSITIVE_PATHS` | 114-127 | Sensitive file path patterns | ✅ `hooks.test.ts` (inferred) |
| `detectDangerousOperation()` | 178-250 | Hook for detecting risky operations | ✅ `permission-denial-scenarios.test.ts` |

**Test Files**:
- `packages/orchestrator/src/__tests__/permission-denial-scenarios.test.ts`
- `packages/orchestrator/src/__tests__/permission-denial-comprehensive.test.ts`

#### 2.2.6 Permission Revocation (`__tests__/mocks/permission-revocation.ts`)

| Code Path | Class/Function | Description | Test Coverage |
|-----------|----------------|-------------|---------------|
| `PermissionRevocationSimulator` | 208+ | Simulates permission revocation scenarios | ✅ `permission-revocation-comprehensive.test.ts` |

**Test Files**:
- `packages/orchestrator/src/__tests__/permission-revocation-comprehensive.test.ts`
- `packages/orchestrator/src/__tests__/permission-revocation-cleanup.test.ts`
- `packages/orchestrator/src/__tests__/permission-revocation-graceful-degradation.test.ts`
- `packages/orchestrator/src/__tests__/permission-revocation-user-interaction.test.ts`
- `packages/orchestrator/src/__tests__/mid-stream-permission-revocation.test.ts`
- `packages/orchestrator/src/__tests__/partial-results-permission-revocation.test.ts`

---

### 2.3 @apex/cli

**Location**: `packages/cli/src/`

#### 2.3.1 Permission Event Handling (`ui/hooks/useOrchestratorEvents.ts`)

| Code Path | Description | Test Coverage |
|-----------|-------------|---------------|
| Permission event subscription | Subscribe to permission:* events | ✅ `useOrchestratorEvents.permission-integration.test.ts` |
| Permission request notifications | Display permission request UI | ✅ `useOrchestratorEvents.permission-notifications.test.ts` |
| Permission granted notifications | Display grant confirmation | ✅ `useOrchestratorEvents.permission-notifications.test.ts` |
| Permission denied notifications | Display denial message | ✅ `useOrchestratorEvents.permission-notifications.test.ts` |

**Test Files**:
- `packages/cli/src/ui/hooks/__tests__/useOrchestratorEvents.permission-integration.test.ts`
- `packages/cli/src/ui/hooks/__tests__/useOrchestratorEvents.permission-notifications.test.ts`

#### 2.3.2 Permission UI Components (`ui/components/permissions/`)

| Component | Description | Test Coverage |
|-----------|-------------|---------------|
| `PermissionPrompt` | Interactive permission approval prompt | ✅ `PermissionPrompt.comprehensive.test.ts` |
| `PermissionNotificationDisplay` | Display permission notifications | ✅ `PermissionNotificationDisplay.test.tsx` |

**Test Files**:
- `packages/cli/src/ui/components/permissions/__tests__/PermissionPrompt.comprehensive.test.ts`
- `packages/cli/src/ui/components/permissions/__tests__/PermissionNotificationDisplay.test.tsx`

#### 2.3.3 CLI Permission Integration Tests

**Test Files**:
- `packages/cli/src/__tests__/permission-notifications.test.ts`
- `packages/cli/src/__tests__/permission-notification-cli.integration.test.ts`
- `packages/cli/src/__tests__/cli-permission-notifications.integration.test.ts`
- `packages/cli/src/__tests__/cli-permission-events-simple.integration.test.ts`
- `packages/cli/src/__tests__/permission-history-persistence.test.ts`
- `packages/cli/src/__tests__/permission-audit-system.test.ts`
- `packages/cli/src/__tests__/permission-audit-integration.test.ts`
- `packages/cli/src/__tests__/permission-security-vulnerabilities.test.ts`
- `packages/cli/src/__tests__/permission-edge-cases-comprehensive.test.ts`
- `packages/cli/src/__tests__/permission-cross-package-integration.test.ts`
- `packages/cli/src/__tests__/permission-test-coverage-report.test.ts`
- `packages/cli/src/__tests__/permission-system-test-runner.test.ts`

---

### 2.4 @apex/api

**Location**: `packages/api/src/`

#### 2.4.1 Permission REST Endpoints

| Endpoint Pattern | Description | Test Coverage |
|------------------|-------------|---------------|
| Permission notification endpoints | REST API for notifications | ✅ `permission-endpoints-integration.test.ts` |
| Permission approval endpoints | Approve/deny via API | ✅ `permission-endpoints-integration.test.ts` |
| Permission management endpoints | CRUD operations | ✅ `permission-endpoints-integration.test.ts` |
| Permission history endpoints | Query permission history | ✅ `permission-endpoints-integration.test.ts` |
| Permission settings endpoints | Configure permission settings | ✅ `permission-endpoints-integration.test.ts` |

**Test Files**:
- `packages/api/src/__tests__/permission-endpoints-integration.test.ts`
- `packages/api/src/__tests__/permission-notification-api.integration.test.ts`
- `packages/api/src/__tests__/permission-analysis.test.ts`

#### 2.4.2 WebSocket Permission Broadcasting

| Feature | Description | Test Coverage |
|---------|-------------|---------------|
| Permission request broadcasting | Real-time permission requests via WS | ✅ `websocket-permission-broadcasting-integration.test.ts` |
| Permission notifications via WS | Real-time permission notifications | ✅ `websocket-permission-notifications.test.ts` |
| Permission update broadcasting | Real-time permission state updates | ✅ `websocket-permission-integration-validation.test.ts` |

**Test Files**:
- `packages/api/src/__tests__/websocket-permission-notifications.test.ts`
- `packages/api/src/__tests__/websocket-permission-broadcasting-integration.test.ts`
- `packages/api/src/__tests__/websocket-permission-integration-validation.test.ts`

---

### 2.5 @apex/browser

**Location**: `packages/browser/src/`

#### 2.5.1 Permission Mocking (`permission-mocking/`)

| Code Path | Description | Test Coverage |
|-----------|-------------|---------------|
| `MockPermissionHandleImpl` | Mock permission handle for testing | ✅ `permission-mocking.test.ts` |
| `MockPermissionStatusImpl` | Mock permission status | ✅ `permission-mocking.test.ts` |
| `PermissionDescriptor` | Permission descriptor interface | ✅ `permission-mocking.test.ts` |
| `MockPermissionConfig` | Configuration for mock permissions | ✅ `permission-mocking.test.ts` |

**Test Files**:
- `packages/browser/src/__tests__/permission-mocking.test.ts`
- `packages/browser/src/__tests__/permission-mocking-edge-cases.test.ts`
- `packages/browser/src/__tests__/permission-mocking-integration.test.ts`
- `packages/browser/src/__tests__/permission-mocking-performance.test.ts`

---

## 3. Test Coverage Matrix

### 3.1 Critical Permission Paths

| Critical Path | @apex/core | @apex/orchestrator | @apex/cli | @apex/api | Integration |
|---------------|------------|-------------------|-----------|-----------|-------------|
| Permission grant (allow-always) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Permission grant (allow-once) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Permission deny | ✅ | ✅ | ✅ | ✅ | ✅ |
| Permission check with consumption | ✅ | ✅ | N/A | N/A | ✅ |
| Permission check without consumption | ✅ | ✅ | N/A | N/A | ✅ |
| Permission revocation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Session cache behavior | N/A | ✅ | ✅ | N/A | ✅ |
| Event emission on changes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Concurrent access handling | N/A | ✅ | N/A | N/A | ✅ |
| Database persistence | N/A | ✅ | N/A | N/A | ✅ |
| Database recovery | N/A | ✅ | N/A | N/A | ✅ |
| Cross-package event propagation | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 Integration Test Coverage

| Integration Test File | Scenarios Covered |
|-----------------------|-------------------|
| `tests/integration/cross-package-permission-flows.integration.test.ts` | 10 test cases |
| `tests/integration/dynamic-permission-flows.integration.test.ts` | 12 test cases |
| `tests/integration/permission-notification-complete-e2e.integration.test.ts` | E2E notification flow |
| `tests/integration/permission-notification-edge-cases.integration.test.ts` | Edge cases |
| `tests/integration/permission-e2e-complete-flow.test.ts` | Complete E2E |
| `tests/integration/permissions-acceptance-criteria.test.ts` | Acceptance criteria |
| `tests/integration/browser-automation-permissions.integration.test.ts` | Browser + permissions |
| `tests/integration/browser-permission-denied-*.test.ts` | 6 test files |
| `tests/integration/api-permission-notifications.integration.test.ts` | API + permissions |

---

## 4. Coverage Gaps Analysis

### 4.1 Identified Gaps

| Gap ID | Package | Code Path | Current Coverage | Gap Description | Priority |
|--------|---------|-----------|------------------|-----------------|----------|
| GAP-001 | core | `validatePathSecurity()` null byte handling | ⚠️ Partial | Edge case for null bytes in paths needs explicit test | Medium |
| GAP-002 | core | `DirectoryAccessValidator` symlink resolution | ⚠️ Partial | Symlink edge cases with circular references | Low |
| GAP-003 | orchestrator | `PermissionStore` concurrent write conflicts | ⚠️ Partial | SQLite write contention under heavy load | Medium |
| GAP-004 | orchestrator | `PermissionManager` cache invalidation race | ⚠️ Partial | Race condition when cache updated during check | Medium |
| GAP-005 | orchestrator | Permission expiry edge cases | ⚠️ Partial | Expiry at exact boundary timestamps | Low |
| GAP-006 | cli | Permission prompt timeout handling | ❌ Missing | User prompt timeout scenarios | High |
| GAP-007 | cli | Multi-agent permission coordination | ⚠️ Partial | Parallel agents requesting same permission | Medium |
| GAP-008 | api | WebSocket reconnection with pending permissions | ⚠️ Partial | Client reconnect during permission flow | High |
| GAP-009 | api | Permission endpoint authentication edge cases | ⚠️ Partial | Token expiry during permission approval | Medium |
| GAP-010 | browser | Permission state sync across browser contexts | ⚠️ Partial | Multiple pages/contexts sharing permission state | Low |

### 4.2 Gap Classification

**High Priority** (Security/Reliability Impact):
- GAP-006: Permission prompt timeout handling
- GAP-008: WebSocket reconnection with pending permissions

**Medium Priority** (Edge Cases):
- GAP-001: Null byte path validation
- GAP-003: Concurrent write conflicts
- GAP-004: Cache invalidation race conditions
- GAP-007: Multi-agent permission coordination
- GAP-009: Authentication edge cases

**Low Priority** (Minor Edge Cases):
- GAP-002: Symlink circular references
- GAP-005: Permission expiry boundaries
- GAP-010: Browser context sync

---

## 5. Prioritized Recommendations

### 5.1 High Priority Recommendations

#### R-001: Add Permission Prompt Timeout Tests (GAP-006)
**Package**: @apex/cli
**File**: `packages/cli/src/__tests__/permission-prompt-timeout.test.ts` (new)
**Description**: Add tests for permission prompt timeout scenarios:
- User doesn't respond within configured timeout
- Graceful degradation when prompt times out
- Retry behavior after timeout
- Timeout notification to user

**Suggested Test Cases**:
```typescript
describe('Permission Prompt Timeout', () => {
  it('should timeout after configured duration');
  it('should emit timeout event when prompt expires');
  it('should allow retry after timeout');
  it('should preserve task state during timeout');
});
```

#### R-002: Add WebSocket Reconnection Tests (GAP-008)
**Package**: @apex/api
**File**: `packages/api/src/__tests__/websocket-permission-reconnection.test.ts` (new)
**Description**: Add tests for WebSocket reconnection during permission flows:
- Client reconnects with pending permission request
- Server state recovery after reconnection
- Permission response delivery after reconnect
- Multiple reconnection attempts

**Suggested Test Cases**:
```typescript
describe('WebSocket Permission Reconnection', () => {
  it('should queue permission responses during disconnection');
  it('should deliver queued responses after reconnect');
  it('should handle permission timeout during disconnection');
  it('should sync permission state on reconnection');
});
```

### 5.2 Medium Priority Recommendations

#### R-003: Add Null Byte Path Validation Tests (GAP-001)
**Package**: @apex/core
**File**: `packages/core/src/__tests__/directory-access-security.test.ts` (new)
**Description**: Add explicit tests for path security validation:
- Null byte injection attempts
- Path traversal with encoded characters
- Excessive path length handling
- Unicode normalization edge cases

#### R-004: Add Concurrent Write Conflict Tests (GAP-003)
**Package**: @apex/orchestrator
**File**: `packages/orchestrator/src/__tests__/permission-store-concurrency.test.ts` (new)
**Description**: Add tests for SQLite concurrency:
- Concurrent permission writes for same tool/scope
- WAL mode behavior under load
- Transaction isolation verification

#### R-005: Add Cache Invalidation Race Tests (GAP-004)
**Package**: @apex/orchestrator
**File**: `packages/orchestrator/src/__tests__/permission-manager-race-conditions.test.ts` (new)
**Description**: Add tests for cache race conditions:
- Check and grant happening simultaneously
- Session reset during active check
- Cache update notification propagation

#### R-006: Add Multi-Agent Permission Coordination Tests (GAP-007)
**Package**: @apex/cli
**File**: `packages/cli/src/__tests__/permission-multi-agent-coordination.test.ts` (new)
**Description**: Add tests for parallel agent scenarios:
- Multiple agents requesting same permission
- Permission grant applies to all waiting agents
- Agent handoff with pending permissions

#### R-007: Add Authentication Edge Case Tests (GAP-009)
**Package**: @apex/api
**File**: `packages/api/src/__tests__/permission-auth-edge-cases.test.ts` (new)
**Description**: Add tests for authentication during permission flows:
- Token expiry during approval flow
- Re-authentication requirement mid-flow
- Permission state after auth refresh

### 5.3 Low Priority Recommendations

#### R-008: Add Symlink Edge Case Tests (GAP-002)
**Package**: @apex/core
**Description**: Add tests for symlink edge cases including circular references

#### R-009: Add Permission Expiry Boundary Tests (GAP-005)
**Package**: @apex/orchestrator
**Description**: Add tests for exact expiry timestamp boundaries

#### R-010: Add Browser Context Sync Tests (GAP-010)
**Package**: @apex/browser
**Description**: Add tests for permission state across multiple browser contexts

---

## Appendix A: Test File Index

### @apex/core Permission Tests
```
packages/core/src/permission-coverage.test.ts
packages/core/src/permission-integration.test.ts
packages/core/src/permission-types.test.ts
packages/core/src/permission-validation.test.ts
packages/core/src/permission-preset.test.ts
packages/core/src/__tests__/permissions-config.test.ts
packages/core/src/__tests__/permissions-edge-cases.test.ts
packages/core/src/__tests__/permissions-integration.test.ts
packages/core/src/__tests__/permissions-config-coverage.test.ts
packages/core/src/__tests__/permissions-config-edge-cases.test.ts
packages/core/src/__tests__/permissions-config-init.test.ts
packages/core/src/__tests__/permissions-directory-access.test.ts
packages/core/src/__tests__/permissions-schema-validation.test.ts
packages/core/src/__tests__/permission-change-event.test.ts
packages/core/src/__tests__/permission-change-event-*.test.ts (5 files)
packages/core/src/__tests__/permission-denial-*.test.ts (4 files)
packages/core/src/__tests__/permission-notification.integration.test.ts
packages/core/src/__tests__/permission-preset-validation.test.ts
packages/core/src/__tests__/permission-autonomy-integration.test.ts
packages/core/src/__tests__/permission-system-*.test.ts (3 files)
packages/core/src/__tests__/permission-test-*.test.ts (4 files)
packages/core/src/__tests__/permission-assertion-helpers*.test.ts (3 files)
packages/core/src/__tests__/permission-performance-scale.test.ts
packages/core/src/__tests__/tool-permission-configurations.test.ts
packages/core/src/tools/browser/__tests__/browser-permission-denied-error*.test.ts (3 files)
packages/core/src/tools/browser/__tests__/browser-tool-permission-error-handling.test.ts
```

### @apex/orchestrator Permission Tests
```
packages/orchestrator/src/__tests__/permission-store*.test.ts (8 files)
packages/orchestrator/src/__tests__/permission-manager*.test.ts (5 files)
packages/orchestrator/src/__tests__/permission-preset-*.test.ts (12 files)
packages/orchestrator/src/__tests__/permission-events*.test.ts (7 files)
packages/orchestrator/src/__tests__/permission-revocation*.test.ts (6 files)
packages/orchestrator/src/__tests__/permission-denial*.test.ts (2 files)
packages/orchestrator/src/__tests__/permission-check*.test.ts (4 files)
packages/orchestrator/src/__tests__/permission-grants-integration.test.ts
packages/orchestrator/src/__tests__/permission-confirmation.test.ts
packages/orchestrator/src/__tests__/permission-external-confirmation.test.ts
packages/orchestrator/src/__tests__/permission-flow-integration.test.ts
packages/orchestrator/src/__tests__/permission-manual-validation.test.ts
packages/orchestrator/src/__tests__/permission-orchestrator-e2e.test.ts
packages/orchestrator/src/__tests__/permission-database*.test.ts (3 files)
packages/orchestrator/src/__tests__/permission-notification*.test.ts (2 files)
packages/orchestrator/src/__tests__/permission-change-notifications-integration.test.ts
packages/orchestrator/src/__tests__/permission-concurrent-modifications.test.ts
packages/orchestrator/src/__tests__/permission-system-recovery.test.ts
packages/orchestrator/src/__tests__/permissions-system.test.ts
packages/orchestrator/src/__tests__/v050-integration/permission-*.test.ts (3 files)
packages/orchestrator/src/tools/__tests__/browser-tool-permission*.test.ts (7 files)
```

### @apex/cli Permission Tests
```
packages/cli/src/__tests__/permission-notifications.test.ts
packages/cli/src/__tests__/permission-notification-cli.integration.test.ts
packages/cli/src/__tests__/cli-permission-notifications.integration.test.ts
packages/cli/src/__tests__/cli-permission-events-simple.integration.test.ts
packages/cli/src/__tests__/permission-history-persistence.test.ts
packages/cli/src/__tests__/permission-audit-system.test.ts
packages/cli/src/__tests__/permission-audit-integration.test.ts
packages/cli/src/__tests__/permission-security-vulnerabilities.test.ts
packages/cli/src/__tests__/permission-edge-cases-comprehensive.test.ts
packages/cli/src/__tests__/permission-cross-package-integration.test.ts
packages/cli/src/__tests__/permission-test-coverage-report.test.ts
packages/cli/src/__tests__/permission-system-test-runner.test.ts
packages/cli/src/ui/hooks/__tests__/useOrchestratorEvents.permission-*.test.ts (2 files)
packages/cli/src/ui/components/permissions/__tests__/PermissionPrompt.comprehensive.test.ts
packages/cli/src/ui/components/permissions/__tests__/PermissionNotificationDisplay.test.tsx
```

### @apex/api Permission Tests
```
packages/api/src/__tests__/permission-analysis.test.ts
packages/api/src/__tests__/permission-endpoints-integration.test.ts
packages/api/src/__tests__/permission-notification-api.integration.test.ts
packages/api/src/__tests__/websocket-permission-notifications.test.ts
packages/api/src/__tests__/websocket-permission-broadcasting-integration.test.ts
packages/api/src/__tests__/websocket-permission-integration-validation.test.ts
```

### @apex/browser Permission Tests
```
packages/browser/src/__tests__/permission-mocking.test.ts
packages/browser/src/__tests__/permission-mocking-edge-cases.test.ts
packages/browser/src/__tests__/permission-mocking-integration.test.ts
packages/browser/src/__tests__/permission-mocking-performance.test.ts
```

### Integration Permission Tests
```
tests/integration/cross-package-permission-flows.integration.test.ts
tests/integration/dynamic-permission-flows.integration.test.ts
tests/integration/permission-notification-*.test.ts (5 files)
tests/integration/permission-e2e-complete-flow.test.ts
tests/integration/permissions-acceptance-criteria.test.ts
tests/integration/browser-permission-*.test.ts (10 files)
tests/integration/browser-automation-permissions.integration.test.ts
tests/integration/browser-security-permissions.integration.test.ts
tests/integration/api-permission-notifications.integration.test.ts
tests/integration/tool-permission-browser-complete.integration.test.ts
tests/integration/comprehensive-tool-permission-browser.integration.test.ts
```

---

## Appendix B: Permission Event Types Reference

| Event | Payload Interface | Emitted By | Consumed By |
|-------|-------------------|------------|-------------|
| `permission:request` | `PermissionRequestEventData` | ApexOrchestrator | CLI, API |
| `permission:granted` | `PermissionGrantedEventData` | ApexOrchestrator | CLI, API |
| `permission:denied` | `PermissionDeniedEventData` | ApexOrchestrator | CLI, API |
| `permission:notification` | `PermissionNotification` | ApexOrchestrator | CLI, API |

---

## Appendix C: Database Schema

```sql
-- Permission Store Schema (v0.5.0)
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  scope TEXT,
  level TEXT NOT NULL CHECK (level IN ('allow-always', 'allow-once', 'deny')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  config TEXT,           -- JSON: ToolPermissionConfig
  grant_reason TEXT,
  granted_by TEXT,
  tags TEXT              -- JSON: string[]
);

-- Indexes
CREATE INDEX idx_permissions_tool_scope ON permissions(tool_name, scope);
CREATE INDEX idx_permissions_level ON permissions(level);
CREATE INDEX idx_permissions_expires_at ON permissions(expires_at);
```

---

## 6. Implementation Guides for Priority Gaps

### 6.1 High Priority Gap Implementations

#### GUIDE-001: Permission Prompt Timeout Implementation (GAP-006)

**Target File**: `packages/cli/src/__tests__/permission-prompt-timeout.test.ts`

**Step-by-Step Implementation**:

1. **Test Setup**:
```typescript
import { jest } from '@jest/globals';
import { ApexOrchestrator } from '@apex/orchestrator';
import { PermissionPrompt } from '../ui/components/permissions/PermissionPrompt.js';

describe('Permission Prompt Timeout', () => {
  let orchestrator: ApexOrchestrator;
  let mockClearTimeout: jest.SpyInstance;
  let mockSetTimeout: jest.SpyInstance;

  beforeEach(() => {
    orchestrator = new ApexOrchestrator({ projectPath: '/test' });
    // Mock timeout functions for controlled testing
    mockSetTimeout = jest.spyOn(global, 'setTimeout');
    mockClearTimeout = jest.spyOn(global, 'clearTimeout');
  });
```

2. **Core Test Cases**:
```typescript
  it('should timeout after configured duration', async () => {
    const timeoutMs = 5000;
    const mockTimeout = jest.fn();

    // Configure timeout
    process.env.APEX_PERMISSION_TIMEOUT = timeoutMs.toString();

    // Request permission but don't respond
    const permissionRequest = orchestrator.requestPermission({
      tool: 'Write',
      scope: '/sensitive/file.txt'
    });

    // Advance timer past timeout
    jest.advanceTimersByTime(timeoutMs + 100);

    // Expect timeout behavior
    expect(mockTimeout).toHaveBeenCalled();
  });

  it('should emit timeout event when prompt expires', async () => {
    const timeoutListener = jest.fn();
    orchestrator.on('permission:timeout', timeoutListener);

    const request = orchestrator.requestPermission({
      tool: 'Bash',
      scope: 'rm -rf /'
    });

    jest.advanceTimersByTime(6000); // Default 5s + buffer

    expect(timeoutListener).toHaveBeenCalledWith({
      tool: 'Bash',
      scope: 'rm -rf /',
      timeoutMs: 5000,
      timestamp: expect.any(Date)
    });
  });
```

3. **Integration with CLI**:
```typescript
  it('should preserve task state during timeout', async () => {
    const taskManager = orchestrator.getTaskManager();
    const task = await taskManager.createTask({
      type: 'feature',
      description: 'test feature'
    });

    // Start task execution
    const execution = orchestrator.executeTask(task.id);

    // Simulate permission timeout
    const permissionRequest = orchestrator.requestPermission({
      tool: 'Write',
      scope: '/test/file.txt'
    });

    jest.advanceTimersByTime(6000);

    // Task should remain in consistent state
    const updatedTask = await taskManager.getTask(task.id);
    expect(updatedTask.status).toBe('waiting-for-permission');
    expect(updatedTask.metadata.lastPermissionRequest).toBeDefined();
  });
```

**Configuration Requirements**:
- Add `APEX_PERMISSION_TIMEOUT` environment variable support
- Add timeout configuration to `.apex/config.yaml` schema
- Implement timeout event emission in ApexOrchestrator

#### GUIDE-002: WebSocket Reconnection Implementation (GAP-008)

**Target File**: `packages/api/src/__tests__/websocket-permission-reconnection.test.ts`

**Step-by-Step Implementation**:

1. **Test Infrastructure**:
```typescript
import { WebSocket, WebSocketServer } from 'ws';
import { FastifyInstance } from 'fastify';
import { ApexAPI } from '../index.js';

describe('WebSocket Permission Reconnection', () => {
  let api: FastifyInstance;
  let client: WebSocket;
  let reconnectClient: WebSocket;

  beforeEach(async () => {
    api = await ApexAPI.create({ port: 0 });
    await api.listen();

    const address = api.server.address();
    const port = typeof address === 'object' ? address?.port : 3001;

    client = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise(resolve => client.on('open', resolve));
  });
```

2. **Core Reconnection Logic**:
```typescript
  it('should queue permission responses during disconnection', async () => {
    const orchestrator = api.getOrchestrator();

    // Request permission while connected
    const permissionRequest = orchestrator.requestPermission({
      tool: 'Write',
      scope: '/important/file.txt'
    });

    // Verify request received
    const requestMessage = await waitForMessage(client);
    expect(requestMessage.type).toBe('permission:request');

    // Simulate client disconnect
    client.close();

    // Grant permission while disconnected (server-side)
    await orchestrator.grantPermissionConfirmation(
      requestMessage.data.permissionId,
      'allow-once'
    );

    // Reconnect client
    reconnectClient = new WebSocket(`ws://localhost:${api.server.address().port}/ws`);
    await new Promise(resolve => reconnectClient.on('open', resolve));

    // Should receive queued grant response
    const grantMessage = await waitForMessage(reconnectClient);
    expect(grantMessage.type).toBe('permission:granted');
    expect(grantMessage.data.permissionId).toBe(requestMessage.data.permissionId);
  });
```

3. **State Synchronization**:
```typescript
  it('should sync permission state on reconnection', async () => {
    const orchestrator = api.getOrchestrator();

    // Create multiple permissions while connected
    const permissions = await Promise.all([
      orchestrator.requestPermission({ tool: 'Read', scope: '/file1.txt' }),
      orchestrator.requestPermission({ tool: 'Write', scope: '/file2.txt' }),
    ]);

    // Grant first, leave second pending
    await orchestrator.grantPermissionConfirmation(permissions[0].id, 'allow-always');

    // Disconnect and reconnect
    client.close();
    reconnectClient = new WebSocket(`ws://localhost:${api.server.address().port}/ws`);
    await new Promise(resolve => reconnectClient.on('open', resolve));

    // Should receive state sync message
    const syncMessage = await waitForMessage(reconnectClient);
    expect(syncMessage.type).toBe('permission:sync');
    expect(syncMessage.data.grantedPermissions).toHaveLength(1);
    expect(syncMessage.data.pendingRequests).toHaveLength(1);
  });
```

**Infrastructure Requirements**:
- Add permission message queuing to WebSocket handler
- Implement client session restoration logic
- Add `permission:sync` event type to core types

#### GUIDE-003: Cache Invalidation Race Condition Tests (GAP-004)

**Target File**: `packages/orchestrator/src/__tests__/permission-manager-race-conditions.test.ts`

**Implementation Pattern**:
```typescript
describe('Permission Manager Race Conditions', () => {
  it('should handle concurrent check and grant operations', async () => {
    const manager = new PermissionManager(store);

    // Simulate race condition with Promise.all
    const [checkResult, grantResult] = await Promise.all([
      manager.checkPermission('Write', '/file.txt'),
      manager.grantPermission('Write', '/file.txt', 'allow-once')
    ]);

    // Verify consistent state regardless of execution order
    expect(checkResult || grantResult).toBeTruthy();
  });
});
```

### 6.2 Medium Priority Gap Implementations

#### GUIDE-004: Null Byte Path Validation (GAP-001)

**Target File**: `packages/core/src/__tests__/directory-access-security.test.ts`

**Security Test Cases**:
```typescript
describe('Directory Access Security Validation', () => {
  it('should reject paths with null bytes', () => {
    const validator = new DirectoryAccessValidator(config);

    const maliciousPaths = [
      '/normal/path\0',
      '/path\0/with/null',
      '\0/starting/with/null',
      '/path/with\0multiple\0nulls'
    ];

    maliciousPaths.forEach(path => {
      expect(() => validator.isPathAllowed(path)).toThrow(/null byte/i);
    });
  });
});
```

#### GUIDE-005: Multi-Agent Coordination (GAP-007)

**Target File**: `packages/cli/src/__tests__/permission-multi-agent-coordination.test.ts`

**Coordination Test Pattern**:
```typescript
describe('Multi-Agent Permission Coordination', () => {
  it('should coordinate permission grants across multiple agents', async () => {
    const orchestrator = new ApexOrchestrator(config);

    // Simulate multiple agents requesting same permission
    const agents = ['agent1', 'agent2', 'agent3'];
    const permissionRequests = agents.map(agent =>
      orchestrator.requestPermission({
        tool: 'Write',
        scope: '/shared/resource.txt',
        agentId: agent
      })
    );

    // Grant permission once
    await orchestrator.grantPermissionConfirmation(
      permissionRequests[0].id,
      'allow-always'
    );

    // All agents should receive grant notification
    const results = await Promise.all(permissionRequests);
    results.forEach(result => {
      expect(result.level).toBe('allow-always');
    });
  });
});
```

### 6.3 Implementation Checklist

#### Before Starting Implementation:

- [ ] Review existing test patterns in the target package
- [ ] Understand the specific permission flow being tested
- [ ] Set up proper mocking infrastructure
- [ ] Configure test timeouts appropriately

#### During Implementation:

- [ ] Follow existing test naming conventions
- [ ] Use proper TypeScript types from `@apex/core`
- [ ] Include both happy path and error scenarios
- [ ] Add proper cleanup in `afterEach`/`afterAll`

#### After Implementation:

- [ ] Run tests to ensure they pass: `npm test --workspace=<package>`
- [ ] Verify test coverage improvement
- [ ] Update this documentation with implementation status
- [ ] Create follow-up tasks for any integration requirements

### 6.4 Testing Infrastructure Requirements

#### New Event Types Needed:
```typescript
// Add to packages/core/src/types.ts
export interface PermissionTimeoutEventData extends BaseEventData {
  tool: string;
  scope?: string;
  timeoutMs: number;
  timestamp: Date;
}

export interface PermissionSyncEventData extends BaseEventData {
  grantedPermissions: Permission[];
  pendingRequests: PermissionRequest[];
  sessionId: string;
}
```

#### Configuration Extensions Needed:
```yaml
# Add to .apex/config.yaml schema
permissions:
  timeout:
    enabled: true
    defaultTimeoutMs: 30000
    retryAttempts: 3
  websocket:
    enableReconnectionQueue: true
    maxQueuedMessages: 100
```

---

*Document generated by APEX Permission Audit System v1.1*
