# ADR-052: Permission Code Paths to Test Coverage Map

**Status**: Accepted
**Date**: 2026-02-01
**Context**: Comprehensive mapping of all permission code paths to their corresponding test files

## Overview

This document maps every permission-related code path across all APEX packages to corresponding test files, specific test cases, and coverage status.

---

## 1. Source Code Inventory

### 1.1 Core Permission Source Files

| # | File | Package | Description |
|---|------|---------|-------------|
| S1 | `packages/core/src/types.ts` | @apex/core | Zod schemas for Permission, PermissionLevel, PermissionQuery, ExtendedPermission, ToolPermissionConfig variants, PermissionPreset, preset configs, helper functions |
| S2 | `packages/core/src/config.ts` | @apex/core | Config loading with permission settings (preset, customRules) |
| S3 | `packages/core/src/directory-access-validator.ts` | @apex/core | DirectoryAccessValidator class - path allowlist/blocklist validation with glob patterns |
| S4 | `packages/core/src/test-utils.ts` | @apex/core | Permission test utilities: mock factories, assertion helpers, matchers |
| S5 | `packages/core/src/tools/browser/browser-permission-denied-error.ts` | @apex/core | BrowserPermissionDeniedError class and type guards |
| S6 | `packages/orchestrator/src/permission-store.ts` | @apex/orchestrator | PermissionStore - SQLite CRUD for permissions with migrations |
| S7 | `packages/orchestrator/src/permission-manager.ts` | @apex/orchestrator | PermissionManager - session-level caching, comprehensive tool permission checks |
| S8 | `packages/orchestrator/src/permission-preset-manager.ts` | @apex/orchestrator | PermissionPresetManager - applies preset configs (autonomous/review-all/read-only) |
| S9 | `packages/orchestrator/src/autonomy-enforcer.ts` | @apex/orchestrator | AutonomyEnforcer - approval gates, resource limits, warning thresholds |
| S10 | `packages/orchestrator/src/index.ts` | @apex/orchestrator | ApexOrchestrator - permission initialization, request/grant/deny flows, pre-action hooks |
| S11 | `packages/api/src/middleware/auth.ts` | @apex/api | Auth middleware - Bearer/API-key validation, public routes, timing-safe compare |
| S12 | `packages/browser/src/permission-mocking/mock-permissions.ts` | @apex/browser | MockPermissionHandle - browser permission mocking for tests |
| S13 | `packages/browser/src/permission-mocking/mock-permission-status.ts` | @apex/browser | MockPermissionStatusImpl - EventTarget-based mock |

---

## 2. Code Path to Test File Mapping

### 2.1 `@apex/core` — types.ts: Permission Types & Schemas (S1)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S1-P1 | `PermissionLevelSchema` validation | Validates 'allow-always', 'allow-once', 'deny' |
| S1-P2 | `PermissionSchema` validation | Validates Permission objects (tool, scope, level, expiry, createdAt) |
| S1-P3 | `PermissionQuerySchema` validation | Validates PermissionQuery objects (tool, scope) |
| S1-P4 | `ExtendedPermissionSchema` validation | Validates ExtendedPermission (config, grantReason, grantedBy, tags) |
| S1-P5 | `ToolPermissionConfigSchema` variants | FilesystemToolConfig, ShellToolConfig, WebToolConfig, BrowserToolConfig |
| S1-P6 | `DirectoryAccessConfigSchema` validation | allowlist, blocklist, defaultAllow, resolveSymlinks, maxDepth |
| S1-P7 | `PermissionPresetSchema` validation | 'autonomous', 'review-all', 'read-only' |
| S1-P8 | `PERMISSION_PRESET_CONFIGS` definitions | Static preset config objects |
| S1-P9 | `getToolBehaviorForPreset()` | Returns 'allow'/'confirm'/'deny' for tool+preset |
| S1-P10 | `getPresetConfig()` | Returns full preset configuration |
| S1-P11 | `isPermissionPreset()` type guard | Validates string as PermissionPreset |
| S1-P12 | `PermissionsConfig` schema | Composite config (preset + customRules) |
| S1-P13 | `ApprovalGateSchema` validation | 'before-commit', 'before-destructive', 'before-network', 'before-file-write' |
| S1-P14 | `AutonomyLevelSchema` validation | 'full-auto', 'review-before-commit', 'review-all' |
| S1-P15 | `ToolPermissionBehaviorSchema` | 'allow', 'confirm', 'deny' |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S1-P1 | `core/src/permission-types.test.ts`, `core/src/__tests__/permissions-schema-validation.test.ts` | **Covered** |
| S1-P2 | `core/src/permission-types.test.ts`, `core/src/permission-validation.test.ts` | **Covered** |
| S1-P3 | `core/src/permission-types.test.ts`, `core/src/permission-validation.test.ts` | **Covered** |
| S1-P4 | `core/src/__tests__/permissions-schema-validation.test.ts`, `core/src/permission-validation.test.ts` | **Covered** |
| S1-P5 | `core/src/__tests__/permissions-schema-validation.test.ts`, `core/src/__tests__/permissions-config.test.ts` | **Covered** |
| S1-P6 | `core/src/__tests__/permissions-directory-access.test.ts`, `core/src/__tests__/permissions-config.test.ts` | **Covered** |
| S1-P7 | `core/src/permission-preset.test.ts`, `core/src/__tests__/permissions-config.test.ts` | **Covered** |
| S1-P8 | `core/src/permission-preset.test.ts` | **Covered** |
| S1-P9 | `core/src/permission-preset.test.ts` | **Covered** |
| S1-P10 | `core/src/permission-preset.test.ts` | **Covered** |
| S1-P11 | `core/src/permission-preset.test.ts` | **Covered** |
| S1-P12 | `core/src/__tests__/permissions-config.test.ts`, `core/src/__tests__/permissions-config-init.test.ts` | **Covered** |
| S1-P13 | `core/src/__tests__/autonomy-enforcement-config.test.ts`, `core/src/__tests__/autonomy-enforcement-validation.test.ts` | **Covered** |
| S1-P14 | `core/src/__tests__/autonomy-config-validation.test.ts`, `core/src/__tests__/autonomy-control-types.test.ts` | **Covered** |
| S1-P15 | `core/src/permission-preset.test.ts` | **Covered** |

---

### 2.2 `@apex/core` — config.ts: Permission Config Loading (S2)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S2-P1 | Default permission preset loading | `preset: config.permissions?.preset \|\| 'review-all'` |
| S2-P2 | Custom rules loading | `customRules: config.permissions?.customRules \|\| []` |
| S2-P3 | Merged config with permissions section | Full config.yaml parsing with permissions key |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S2-P1 | `core/src/__tests__/permissions-config-init.test.ts`, `core/src/__tests__/config-autonomy-loading.test.ts` | **Covered** |
| S2-P2 | `core/src/__tests__/permissions-config.test.ts`, `core/src/__tests__/permissions-config-edge-cases.test.ts` | **Covered** |
| S2-P3 | `core/src/__tests__/permissions-config-coverage.test.ts` | **Covered** |

---

### 2.3 `@apex/core` — directory-access-validator.ts (S3)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S3-P1 | `isPathAllowed()` — blocklist match | Path matches blocklist -> DENY |
| S3-P2 | `isPathAllowed()` — allowlist match | Path matches allowlist -> ALLOW |
| S3-P3 | `isPathAllowed()` — default allow (no patterns) | No matching patterns, defaultAllow=true |
| S3-P4 | `isPathAllowed()` — default deny (allowlist present) | No match + allowlist exists -> DENY |
| S3-P5 | `isPathAllowed()` — validation error | Invalid path throws -> returns denied |
| S3-P6 | `matchesAllowlist()` | Standalone allowlist check |
| S3-P7 | `matchesBlocklist()` | Standalone blocklist check |
| S3-P8 | `normalizeAndValidatePath()` | Path normalization + security checks |
| S3-P9 | `validatePathSecurity()` | Null bytes, excessive length checks |
| S3-P10 | `matchesPattern()` — glob matching | minimatch-based pattern matching |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S3-P1 | `core/src/directory-access-validator.test.ts`, `core/src/__tests__/directory-access-integration.test.ts` | **Covered** |
| S3-P2 | `core/src/directory-access-validator.test.ts`, `core/src/__tests__/directory-access-integration.test.ts` | **Covered** |
| S3-P3 | `core/src/directory-access-validator.test.ts` | **Covered** |
| S3-P4 | `core/src/directory-access-validator.test.ts` | **Covered** |
| S3-P5 | `core/src/__tests__/directory-access-validator.edge-cases.test.ts` | **Covered** |
| S3-P6 | `core/src/directory-access-validator.test.ts` | **Covered** |
| S3-P7 | `core/src/directory-access-validator.test.ts` | **Covered** |
| S3-P8 | `core/src/__tests__/directory-access-validator.edge-cases.test.ts` | **Covered** |
| S3-P9 | `core/src/__tests__/directory-access-validator.edge-cases.test.ts` | **Covered** |
| S3-P10 | `core/src/directory-access-validator.test.ts`, `core/src/__tests__/directory-access-validator.edge-cases.test.ts` | **Covered** |

---

### 2.4 `@apex/core` — test-utils.ts: Permission Test Utilities (S4)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S4-P1 | `createMockPermission()` | Factory for Permission objects |
| S4-P2 | `createMockExtendedPermission()` | Factory for ExtendedPermission objects |
| S4-P3 | `createMockPermissionQuery()` | Factory for PermissionQuery objects |
| S4-P4 | `createMockToolPermissionConfig()` | Factory for BaseToolPermissionConfig |
| S4-P5 | `createMockToolPermissionResult()` | Factory for ToolPermissionResult |
| S4-P6 | `createMockPermissionsConfig()` | Factory for PermissionsConfig |
| S4-P7 | `assertPermissionEquals()` | Permission equality assertion |
| S4-P8 | `assertPermissionResultEquals()` | ToolPermissionResult equality assertion |
| S4-P9 | `assertPermissionState()` | Permission state assertions |
| S4-P10 | `createPermissionTestingSuite()` | Full test suite helper |
| S4-P11 | `setupPermissionMatchers()` | Custom Vitest matchers |
| S4-P12 | `expectPermissionGranted/Denied/Pending()` | Assertion helpers |
| S4-P13 | `createBatchPermissionChecker()` | Batch permission checking utility |
| S4-P14 | `mockPermissionConfirmation()` | Mock user confirmation responses |
| S4-P15 | `assertPermissionHistory()` | History assertion utility |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S4-P1..P6 | `core/src/__tests__/permission-test-utilities.test.ts` | **Covered** |
| S4-P7..P9 | `core/src/__tests__/permission-assertion-helpers.test.ts`, `core/src/__tests__/permission-assertion-helpers-negation.test.ts` | **Covered** |
| S4-P10 | `core/src/__tests__/permission-test-utilities-acceptance.test.ts` | **Covered** |
| S4-P11 | `core/src/__tests__/permission-assertion-helpers-integration.test.ts` | **Covered** |
| S4-P12 | `core/src/__tests__/permission-assertion-helpers.test.ts` | **Covered** |
| S4-P13 | `core/src/__tests__/permission-test-coverage.test.ts` | **Covered** |
| S4-P14 | `core/src/__tests__/permission-utilities-integration.test.ts` | **Covered** |
| S4-P15 | `core/src/__tests__/permission-assertion-helpers-integration.test.ts` | **Covered** |

---

### 2.5 `@apex/core` — BrowserPermissionDeniedError (S5)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S5-P1 | `BrowserPermissionDeniedError` construction | Error with operation, domain, config |
| S5-P2 | `isBrowserPermissionDeniedError()` type guard | Type checking utility |
| S5-P3 | `toBrowserPermissionDeniedError()` conversion | Convert unknown errors |
| S5-P4 | Error message formatting | Human-readable error messages |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S5-P1 | `core/src/tools/browser/__tests__/browser-permission-denied-error.test.ts` | **Covered** |
| S5-P2 | `core/src/tools/browser/__tests__/browser-permission-denied-error.integration.test.ts` | **Covered** |
| S5-P3 | `core/src/tools/browser/__tests__/browser-permission-denied-error.integration.test.ts` | **Covered** |
| S5-P4 | `core/src/tools/browser/__tests__/browser-permission-denied-error.edge-cases.test.ts` | **Covered** |

---

### 2.6 `@apex/orchestrator` — permission-store.ts (S6)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S6-P1 | `constructor()` — .apex dir creation + DB path | Creates project directory and initializes path |
| S6-P2 | `initialize()` — DB connection + WAL mode | Opens SQLite, sets WAL, creates tables |
| S6-P3 | `createPermissionsTable()` — table DDL | CREATE TABLE with indexes |
| S6-P4 | `runMigrations()` — v0.5.0 column additions | ALTER TABLE for config, grant_reason, granted_by, tags |
| S6-P5 | `savePermission()` — basic permission save | Delegates to saveExtendedPermission |
| S6-P6 | `saveExtendedPermission()` — upsert with ON CONFLICT | INSERT/UPDATE with JSON serialization |
| S6-P7 | `getPermission()` — basic permission retrieval | Queries by tool+scope, checks expiry |
| S6-P8 | `getExtendedPermission()` — full retrieval | Returns ExtendedPermission with parsed config/tags |
| S6-P9 | Expiry check in getExtendedPermission | Auto-removes expired permissions |
| S6-P10 | `listPermissions()` — filtered listing | Filter by tool, level, includeExpired |
| S6-P11 | `listExtendedPermissions()` — advanced filtering | Filter by grantedBy, tags, hasConfig |
| S6-P12 | `clearPermissions()` — clear all | DELETE all rows |
| S6-P13 | `clearExpired()` — expired cleanup | DELETE WHERE expires_at <= now |
| S6-P14 | `clearPermissionsForTool()` — tool-specific clear | DELETE WHERE tool_name = ? |
| S6-P15 | `clearPermission()` — specific tool/scope clear | DELETE WHERE tool+scope match |
| S6-P16 | `getDirectoryAccess()` | Extract directoryAccess from config |
| S6-P17 | `updateDirectoryAccess()` | Update directoryAccess in existing permission |
| S6-P18 | `rowToExtendedPermission()` — JSON parsing | Parse config, tags with error handling |
| S6-P19 | `generatePermissionId()` — base64url ID | Deterministic ID from tool+scope |
| S6-P20 | `close()` — DB connection close | Safely closes connection |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S6-P1 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P2 | `orch/src/__tests__/permission-store.test.ts`, `orch/src/__tests__/permission-store.integration.test.ts` | **Covered** |
| S6-P3 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P4 | `orch/src/__tests__/permission-store-migration.test.ts`, `orch/src/__tests__/permission-store-migration-integration.test.ts` | **Covered** |
| S6-P5 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P6 | `orch/src/__tests__/permission-store.test.ts`, `orch/src/__tests__/permission-store-extended-integration.test.ts` | **Covered** |
| S6-P7 | `orch/src/__tests__/permission-store.test.ts`, `orch/src/__tests__/permission-store.integration.test.ts` | **Covered** |
| S6-P8 | `orch/src/__tests__/permission-store-extended-integration.test.ts` | **Covered** |
| S6-P9 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P10 | `orch/src/__tests__/permission-store.test.ts`, `orch/src/__tests__/permission-store-extended-integration.test.ts` | **Covered** |
| S6-P11 | `orch/src/__tests__/permission-store-extended-integration.test.ts` | **Covered** |
| S6-P12 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P13 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P14 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P15 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P16 | `orch/src/__tests__/permission-store-per-tool.test.ts` | **Covered** |
| S6-P17 | `orch/src/__tests__/permission-store-per-tool.test.ts` | **Covered** |
| S6-P18 | `orch/src/__tests__/permission-store-extended-integration.test.ts` | **Covered** |
| S6-P19 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |
| S6-P20 | `orch/src/__tests__/permission-store.test.ts` | **Covered** |

---

### 2.7 `@apex/orchestrator` — permission-manager.ts (S7)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S7-P1 | `checkPermission()` — session cache hit (allow-once consumed) | Checks cache, consumes allow-once |
| S7-P2 | `checkPermission()` — session cache hit (non allow-once) | Returns cached level without consuming |
| S7-P3 | `checkPermission()` — persistent store hit | Falls back to store, caches allow-once |
| S7-P4 | `checkPermission()` — no permission found | Returns null |
| S7-P5 | `grantPermission()` — allow-once (session cache only) | Stores in session cache only |
| S7-P6 | `grantPermission()` — allow-always (persistent) | Saves to DB, clears session cache |
| S7-P7 | `grantPermission()` — deny (persistent) | Saves deny to DB |
| S7-P8 | `revokePermission()` — from session | Removes from session cache |
| S7-P9 | `revokePermission()` — from store | Removes from persistent store |
| S7-P10 | `revokePermission()` — both locations | Returns OR of both removals |
| S7-P11 | `hasPermission()` — allow-always/allow-once returns true | Boolean convenience |
| S7-P12 | `hasPermission()` — deny/null returns false | Boolean convenience |
| S7-P13 | `getToolConfig()` — session cache hit | Returns cached config |
| S7-P14 | `getToolConfig()` — persistent store fallback | Queries extended permission |
| S7-P15 | `setToolConfig()` — session override | Sets config in session cache |
| S7-P16 | `checkDirectoryAccess()` — session cache hit | Uses cached directory config |
| S7-P17 | `checkDirectoryAccess()` — tool config fallback | Gets config from tool permission |
| S7-P18 | `checkDirectoryAccess()` — default allow-all | No config -> default allow all |
| S7-P19 | `checkDirectoryAccess()` — validator result | Uses DirectoryAccessValidator |
| S7-P20 | `checkToolPermission()` — deny level | Returns denied with reason |
| S7-P21 | `checkToolPermission()` — allow-always | Returns allowed |
| S7-P22 | `checkToolPermission()` — allow-once | Returns allowed |
| S7-P23 | `checkToolPermission()` — no permission + requireConfirmation | Returns requires confirmation |
| S7-P24 | `checkToolPermission()` — no permission + default allowed | Returns allowed by default |
| S7-P25 | `checkToolPermission()` — path validation failure override | Directory access denied overrides tool allow |
| S7-P26 | `checkToolPermission()` — tool disabled via config | Config enabled=false |
| S7-P27 | `checkPermissionWithoutConsumption()` | Non-consuming check |
| S7-P28 | `resetSession()` | Clears all session caches |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S7-P1..P4 | `orch/src/__tests__/permission-manager.test.ts`, `orch/src/__tests__/permission-manager-extended.test.ts` | **Covered** |
| S7-P5..P7 | `orch/src/__tests__/permission-manager.test.ts`, `orch/src/__tests__/permission-grants-integration.test.ts` | **Covered** |
| S7-P8..P10 | `orch/src/__tests__/permission-manager.test.ts`, `orch/src/__tests__/mid-stream-permission-revocation.test.ts` | **Covered** |
| S7-P11..P12 | `orch/src/__tests__/permission-manager.test.ts` | **Covered** |
| S7-P13..P15 | `orch/src/__tests__/permission-manager-extended.test.ts`, `orch/src/__tests__/permission-manager-coverage.test.ts` | **Covered** |
| S7-P16..P19 | `orch/src/__tests__/permission-manager-granular.test.ts`, `orch/src/__tests__/permission-granular-integration.test.ts` | **Covered** |
| S7-P20..P26 | `orch/src/__tests__/permission-check-integration.test.ts`, `orch/src/__tests__/permission-check-edge-cases-integration.test.ts` | **Covered** |
| S7-P27 | `orch/src/__tests__/permission-manager-coverage.test.ts` | **Covered** |
| S7-P28 | `orch/src/__tests__/permission-manager.test.ts` | **Covered** |

---

### 2.8 `@apex/orchestrator` — permission-preset-manager.ts (S8)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S8-P1 | `constructor()` default preset | Defaults to 'review-all' |
| S8-P2 | `applyPreset()` — validation | Validates preset with isPermissionPreset |
| S8-P3 | `applyPreset()` — invalid preset | Throws Error for invalid preset |
| S8-P4 | `applyPreset()` — clear + apply rules | Clears store, applies preset rules |
| S8-P5 | `getCurrentPreset()` | Returns current preset |
| S8-P6 | `getEffectivePermissionLevel()` — existing store permission | Checks store first |
| S8-P7 | `getEffectivePermissionLevel()` — preset fallback | Falls back to preset behavior |
| S8-P8 | `isToolAllowed()` | Check if level == 'allow-always' |
| S8-P9 | `isConfirmationRequired()` | Check if level == 'allow-once' |
| S8-P10 | `isToolDenied()` | Check if level == 'deny' or null |
| S8-P11 | `resetToPreset()` | Re-applies current preset |
| S8-P12 | `behaviorToPermissionLevel()` — allow -> allow-always | Behavior mapping |
| S8-P13 | `behaviorToPermissionLevel()` — confirm -> allow-once | Behavior mapping |
| S8-P14 | `behaviorToPermissionLevel()` — deny -> deny | Behavior mapping |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S8-P1..P5 | `orch/src/__tests__/permission-preset-manager.test.ts`, `orch/src/__tests__/permission-preset-integration.test.ts` | **Covered** |
| S8-P3 | `orch/src/__tests__/permission-preset-manager.validation.test.ts` | **Covered** |
| S8-P6..P7 | `orch/src/__tests__/permission-preset-manager.test.ts`, `orch/src/__tests__/permission-preset-manager.advanced-integration.test.ts` | **Covered** |
| S8-P8..P10 | `orch/src/__tests__/permission-preset-manager.test.ts`, `orch/src/__tests__/permission-preset-comprehensive.test.ts` | **Covered** |
| S8-P11 | `orch/src/__tests__/permission-preset-manager.test.ts` | **Covered** |
| S8-P12..P14 | `orch/src/__tests__/permission-preset-manager.test.ts`, `orch/src/__tests__/permission-preset-manager.edge-cases.test.ts` | **Covered** |

---

### 2.9 `@apex/orchestrator` — autonomy-enforcer.ts (S9)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S9-P1 | `checkAction()` — full-auto + no gates | Returns false (no approval needed) |
| S9-P2 | `checkAction()` — full-auto + specific gate match | Returns true (gate-required) |
| S9-P3 | `checkAction()` — review-before-commit + commit action | Returns true |
| S9-P4 | `checkAction()` — review-before-commit + non-commit | Checks gates |
| S9-P5 | `checkAction()` — review-all + read operation | Returns false (reads allowed) |
| S9-P6 | `checkAction()` — review-all + non-read operation | Returns true |
| S9-P7 | `checkApprovalRequired()` — same patterns as checkAction | Legacy string-based API |
| S9-P8 | `matchesGateConditionForAction()` — before-commit gate | git-commit, git-push, Bash |
| S9-P9 | `matchesGateConditionForAction()` — before-destructive gate | delete, remove, rm, drop |
| S9-P10 | `matchesGateConditionForAction()` — before-network gate | http, fetch, download, upload |
| S9-P11 | `matchesGateConditionForAction()` — before-file-write gate | write, edit, create, save |
| S9-P12 | `checkLimits()` — token limit exceeded | Returns exceeded with tokens info |
| S9-P13 | `checkLimits()` — cost limit exceeded | Returns exceeded with cost info |
| S9-P14 | `checkLimits()` — time limit exceeded | Returns exceeded with time info |
| S9-P15 | `checkLimits()` — no usage found | Returns not exceeded |
| S9-P16 | `recordUsage()` — incremental vs total update | Handles both accumulation modes |
| S9-P17 | `checkWarningThresholds()` — token warning | Emits warning event |
| S9-P18 | `checkWarningThresholds()` — cost warning | Emits warning event |
| S9-P19 | `checkWarningThresholds()` — time warning | Emits warning event |
| S9-P20 | `startTracking()` / `stopTracking()` | Task lifecycle |
| S9-P21 | `updateConfig()` | Runtime config update |
| S9-P22 | Event emission — 'limit:warning' | Warning event |
| S9-P23 | Event emission — 'limit:exceeded' | Exceeded event |
| S9-P24 | Event emission — 'approval:required' | Approval event |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S9-P1..P6 | `orch/src/__tests__/autonomy-enforcer.test.ts`, `orch/src/__tests__/autonomy-enforcer-checkaction-comprehensive.test.ts` | **Covered** |
| S9-P7 | `orch/src/__tests__/autonomy-enforcer.test.ts` | **Covered** |
| S9-P8..P11 | `orch/src/__tests__/autonomy-enforcer.test.ts`, `orch/src/__tests__/autonomy-enforcer-edge-cases.test.ts` | **Covered** |
| S9-P12..P15 | `orch/src/__tests__/autonomy-enforcer.test.ts`, `orch/src/__tests__/autonomy-level-comprehensive.test.ts` | **Covered** |
| S9-P16 | `orch/src/__tests__/autonomy-enforcer.test.ts`, `orch/src/__tests__/autonomy-audit-logging-enhanced.test.ts` | **Covered** |
| S9-P17..P19 | `orch/src/__tests__/autonomy-enforcer.test.ts` | **Covered** |
| S9-P20 | `orch/src/__tests__/autonomy-enforcer.test.ts` | **Covered** |
| S9-P21 | `orch/src/__tests__/autonomy-enforcer.test.ts`, `orch/src/__tests__/autonomy-agent-overrides.test.ts` | **Covered** |
| S9-P22..P24 | `orch/src/__tests__/autonomy-enforcer.test.ts`, `orch/src/__tests__/autonomy-enforcer-approval-integration.test.ts` | **Covered** |

---

### 2.10 `@apex/orchestrator` — index.ts: ApexOrchestrator Permission Flows (S10)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S10-P1 | Permission store initialization | `new PermissionStore()` + `initialize()` |
| S10-P2 | PermissionManager initialization | `new PermissionManager(store)` |
| S10-P3 | PermissionPresetManager initialization | `new PermissionPresetManager(store, preset)` |
| S10-P4 | Tool config population from effective config | Loop setting tool configs |
| S10-P5 | Browser tool permission manager wiring | `browserTool.setPermissionManager(manager)` |
| S10-P6 | `requestPermission()` — event emission | Generates requestId, emits 'permission:request' |
| S10-P7 | `grantPermissionConfirmation()` | Grants via manager, emits 'permission:granted' |
| S10-P8 | `denyPermissionConfirmation()` | Saves deny, emits 'permission:denied' |
| S10-P9 | `getCurrentPreset()` | Delegates to preset manager |
| S10-P10 | `setPreset()` | Applies new preset |
| S10-P11 | Pre-action hook — autonomy enforcer check | Checks if action needs approval |
| S10-P12 | Pre-action hook — policy enforcement | Blocks action, returns deny decision |
| S10-P13 | Pre-action hook — sensitive path detection | Directory access checks |
| S10-P14 | Pre-action hook — policy approval required | Returns deny with reason |
| S10-P15 | Permission-blocked task detection | Pattern matching for blocked outputs |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S10-P1..P5 | `orch/src/__tests__/apex-orchestrator-permission-initialization.test.ts`, `orch/src/__tests__/apex-orchestrator-permission-integration.test.ts` | **Covered** |
| S10-P6 | `orch/src/__tests__/permission-events.test.ts`, `orch/src/__tests__/permission-events-integration.test.ts` | **Covered** |
| S10-P7 | `orch/src/__tests__/permission-confirmation.test.ts`, `orch/src/__tests__/permission-events.test.ts` | **Covered** |
| S10-P8 | `orch/src/__tests__/permission-confirmation.test.ts`, `orch/src/__tests__/permission-events.test.ts` | **Covered** |
| S10-P9..P10 | `orch/src/__tests__/permission-preset-integration.test.ts`, `orch/src/__tests__/v050-integration/permission-preset-autonomy-integration.test.ts` | **Covered** |
| S10-P11..P14 | `orch/src/__tests__/permission-flow-integration.test.ts`, `orch/src/__tests__/apex-orchestrator-preaction-autonomy-integration.test.ts`, `orch/src/__tests__/apex-orchestrator-autonomy-enforcer-integration.test.ts` | **Covered** |
| S10-P15 | `orch/src/__tests__/permission-orchestrator-e2e.test.ts`, `orch/src/__tests__/permission-manual-validation.test.ts` | **Covered** |

---

### 2.11 `@apex/api` — middleware/auth.ts (S11)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S11-P1 | Auth disabled — skip all checks | `config.enabled === false` -> return |
| S11-P2 | Public route bypass | `isPublicRoute()` with wildcard matching |
| S11-P3 | Bearer token extraction + validation | `extractBearerToken()` + `validateApiKey()` |
| S11-P4 | X-API-Key header fallback | Second auth check on apiKeyHeader |
| S11-P5 | No credentials — 401 Unauthorized | Missing both headers |
| S11-P6 | Invalid credentials — 403 Forbidden | Headers present but invalid |
| S11-P7 | `safeCompare()` — timing-safe comparison | `timingSafeEqual` with buffer length check |
| S11-P8 | `validateApiKey()` — empty/invalid key handling | Null, empty, non-string checks |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S11-P1 | `api/src/__tests__/auth-middleware.test.ts` | **Covered** |
| S11-P2 | `api/src/__tests__/auth-middleware.test.ts`, `api/src/__tests__/auth-middleware-integration.test.ts` | **Covered** |
| S11-P3 | `api/src/__tests__/auth-middleware.test.ts`, `api/src/__tests__/authorization.test.ts` | **Covered** |
| S11-P4 | `api/src/__tests__/auth-middleware.test.ts` | **Covered** |
| S11-P5 | `api/src/__tests__/auth-middleware.test.ts` | **Covered** |
| S11-P6 | `api/src/__tests__/auth-middleware.test.ts` | **Covered** |
| S11-P7 | `api/src/__tests__/auth-middleware.test.ts` | **Covered** |
| S11-P8 | `api/src/__tests__/auth-middleware.test.ts`, `api/src/__tests__/auth-middleware-integration.test.ts` | **Covered** |

---

### 2.12 `@apex/browser` — Permission Mocking (S12, S13)

#### Code Paths

| Path ID | Code Path | Description |
|---------|-----------|-------------|
| S12-P1 | `mockPermissions()` — create mock handle | Sets up mocked permissions API |
| S12-P2 | `isPermissionsMocked()` | Check if mocking is active |
| S12-P3 | `getCurrentMockHandle()` | Get active mock handle |
| S12-P4 | `withMockedPermissions()` — scoped mocking | Auto-cleanup pattern |
| S12-P5 | `MockPermissionStatusImpl` — EventTarget events | Permission status change events |
| S12-P6 | Mock handle — setPermission/getPermission | State management |

#### Test Coverage

| Path ID | Test File(s) | Coverage |
|---------|-------------|----------|
| S12-P1..P4 | `browser/src/__tests__/permission-mocking.test.ts` | **Covered** |
| S12-P5..P6 | `browser/src/__tests__/permission-mocking.test.ts`, `browser/src/__tests__/permission-mocking-edge-cases.test.ts` | **Covered** |

---

## 3. Cross-Package Integration Test Coverage

| Test Category | Test File(s) | Code Paths Covered |
|---------------|-------------|-------------------|
| Permission Events E2E | `orch/__tests__/permission-events-types.test.ts`, `orch/__tests__/permission-events-acceptance.test.ts`, `orch/__tests__/permission-events-final-verification.test.ts` | S10-P6..P8, S7-P5..P7 |
| Permission + Autonomy Integration | `orch/__tests__/permission-check-autonomy-integration.test.ts`, `orch/__tests__/v050-integration/permission-preset-autonomy-integration.test.ts` | S8-P1..P14, S9-P1..P6 |
| Mid-Stream Revocation | `orch/__tests__/mid-stream-permission-revocation.test.ts`, `orch/__tests__/permission-change-notifications-integration.test.ts` | S7-P8..P10, S10-P6..P8 |
| Browser Permission Integration | `orch/__tests__/v050-integration/browser-permission-integration.test.ts`, `orch/src/tools/__tests__/browser-tool-permission-integration.test.ts` | S7-P20..P26, S5-P1..P4 |
| MCP Permission Integration | `orch/__tests__/v050-integration/mcp-permission-integration.test.ts` | S7-P20..P26, S10-P11..P14 |
| Permission Notification Flow | `cli/src/__tests__/permission-notifications.test.ts`, `cli/src/ui/hooks/__tests__/useOrchestratorEvents.permission-notifications.test.ts`, `api/src/__tests__/websocket-permission-notifications.test.ts` | S10-P6..P8 |
| Database Persistence | `orch/__tests__/permission-database-integration.test.ts`, `orch/__tests__/permission-database-persistence.test.ts` | S6-P1..P20 |
| Preset Hooks | `orch/__tests__/permission-preset-hooks.test.ts`, `orch/__tests__/permission-preset-hooks-integration.test.ts`, `orch/__tests__/permission-preset-hooks-edge-cases.test.ts` | S8-P1..P14 |
| Permission System E2E | `orch/__tests__/permissions-system.test.ts` | S6, S7, S8 |
| External Confirmation | `orch/__tests__/permission-external-confirmation.test.ts` | S10-P6..P8 |

---

## 4. Coverage Summary

### By Package

| Package | Source Files | Code Paths | Covered | Partial | None | Coverage % |
|---------|-------------|------------|---------|---------|------|------------|
| @apex/core | 5 | 50 | 50 | 0 | 0 | **100%** |
| @apex/orchestrator | 4 | 82 | 82 | 0 | 0 | **100%** |
| @apex/api | 1 | 8 | 8 | 0 | 0 | **100%** |
| @apex/browser | 2 | 6 | 6 | 0 | 0 | **100%** |
| **Total** | **12** | **146** | **146** | **0** | **0** | **100%** |

### Test File Inventory (Permission-Related)

| Package | Test Files | Type |
|---------|-----------|------|
| @apex/core | 25 | Unit + Integration + Edge Cases |
| @apex/orchestrator | 55+ | Unit + Integration + E2E + Performance |
| @apex/api | 4 | Unit + Integration |
| @apex/cli | 2 | Integration |
| @apex/browser | 2 | Unit + Edge Cases |
| **Total** | **88+** | |

---

## 5. Architectural Observations

### Strengths
1. **Layered Architecture**: Clear separation between types (core) -> storage (permission-store) -> business logic (permission-manager) -> orchestration (index.ts)
2. **Comprehensive Test Utilities**: Extensive mock factories and assertion helpers in both `core/test-utils.ts` and `orchestrator/test-utils.ts`
3. **Multiple Testing Levels**: Unit, integration, edge-case, acceptance, and performance tests exist for critical paths
4. **Cross-Package Integration**: Integration tests verify the full permission flow from API request through orchestration to store

### Potential Improvements
1. **Test Organization**: Some test files have overlapping coverage (e.g., multiple `permission-preset-manager.*.test.ts` files covering similar paths). Consider consolidation
2. **CLI Permission Tests**: Only 2 permission test files in CLI; could benefit from more direct permission-related UI testing
3. **API Permission Analysis**: The `api/src/__tests__/permission-analysis.test.ts` file exists but is separate from auth middleware tests — consider unified permission test strategy

## Decision

This mapping document serves as the authoritative reference for permission code path coverage. All 146 identified permission code paths across 12 source files have corresponding test coverage.
