# Permission Code Path → Test File Mapping

## Technical Design: Comprehensive Permission Test Coverage Analysis

**Author**: Architect Agent
**Date**: 2026-02-02
**Status**: Architecture Stage Output
**ADR References**: ADR-006 (Permission Manager Integration), ADR-014 (Permission Confirmation Handling), ADR-060 (v0.5.0 Tool System Permissions)

---

## 1. Permission System Architecture Overview

The APEX permission system spans 4 packages with 3 core source files in `orchestrator`, 2+ in `core`, and integrations in `cli` and `api`. The architecture follows a layered design:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI / API (Presentation)                      │
│  PermissionPrompt, WebSocket notifications, REST endpoints       │
├─────────────────────────────────────────────────────────────────┤
│              Orchestrator (Business Logic)                        │
│  PermissionManager → PermissionPresetManager → PermissionStore   │
│  ApexOrchestrator (events, confirmation flow, policy enforcement) │
├─────────────────────────────────────────────────────────────────┤
│                    Core (Domain Types)                            │
│  Zod schemas, DirectoryAccessValidator, BrowserPermissionDenied  │
│  Test utilities, mock helpers, assertion matchers                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Permission Code Paths

### Code Path Index

| # | Code Path | Source File(s) | Package |
|---|-----------|----------------|---------|
| 1 | Permission Types & Schemas | `core/src/types.ts` | core |
| 2 | Directory Access Validation | `core/src/directory-access-validator.ts` | core |
| 3 | Browser Permission Denied Error | `core/src/tools/browser/browser-permission-denied-error.ts` | core |
| 4 | Permission Test Utilities | `core/src/test-utils.ts` | core |
| 5 | PermissionStore (SQLite CRUD) | `orchestrator/src/permission-store.ts` | orchestrator |
| 6 | PermissionManager (Session Cache + Checks) | `orchestrator/src/permission-manager.ts` | orchestrator |
| 7 | PermissionPresetManager (Preset Application) | `orchestrator/src/permission-preset-manager.ts` | orchestrator |
| 8 | Orchestrator Permission Events | `orchestrator/src/index.ts` (events, confirmation) | orchestrator |
| 9 | Orchestrator Policy Enforcement | `orchestrator/src/index.ts` (autonomy enforcer, hooks) | orchestrator |
| 10 | Config-based Permission Loading | `core/src/config.ts` | core |
| 11 | Permission Notification Schema & Events | `core/src/types.ts` (notification types) | core |
| 12 | CLI Permission UI Components | `cli/src/ui/components/permissions/` | cli |
| 13 | CLI Permission Audit & Security | `cli/src/__tests__/` (audit, security) | cli |
| 14 | API Permission Notifications | `api/src/__tests__/` | api |
| 15 | Cross-Package Integration | `tests/integration/` | root |

---

## 3. Detailed Mapping: Code Paths → Test Files

### Code Path 1: Permission Types & Zod Schemas
**Source**: `packages/core/src/types.ts`
**Exports**: `PermissionSchema`, `PermissionLevelSchema`, `PermissionQuerySchema`, `DirectoryAccessConfigSchema`, `BaseToolPermissionConfigSchema`, `FilesystemToolConfigSchema`, `ShellToolConfigSchema`, `WebToolConfigSchema`, `BrowserToolConfigSchema`, `SearchToolConfigSchema`, `ToolPermissionConfigSchema`, `ExtendedPermissionSchema`, `PermissionPresetSchema`, `ToolPermissionBehaviorSchema`, `ToolPermissionRuleSchema`, `PermissionPresetConfigSchema`, `PermissionsConfigSchema`, `PermissionChangeTypeSchema`, `PermissionDetailsSchema`, `PermissionChangeEventSchema`, `PermissionNotificationSchema`
**Key functions**: `getPresetConfig()`, `isPermissionPreset()`, `getToolBehaviorForPreset()`, `PERMISSION_PRESET_CONFIGS`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `core/src/permission-types.test.ts` | PermissionSchema, PermissionLevelSchema, PermissionQuerySchema validation | **Covered** |
| `core/src/permission-validation.test.ts` | Schema validation edge cases | **Covered** |
| `core/src/permission-preset.test.ts` | PermissionPresetSchema, PERMISSION_PRESET_CONFIGS, getPresetConfig(), isPermissionPreset() | **Covered** |
| `core/src/__tests__/permissions-schema-validation.test.ts` | Comprehensive schema validation across all permission schemas | **Covered** |
| `core/src/__tests__/extended-permission-validation.test.ts` | ExtendedPermissionSchema validation | **Covered** |
| `core/src/__tests__/permission-preset-validation.test.ts` | PermissionPresetConfigSchema, ToolPermissionRuleSchema | **Covered** |
| `core/src/__tests__/tool-permission-configurations.test.ts` | FilesystemToolConfigSchema, ShellToolConfigSchema, WebToolConfigSchema, BrowserToolConfigSchema, SearchToolConfigSchema | **Covered** |
| `core/src/__tests__/permission-change-event.test.ts` | PermissionChangeTypeSchema, PermissionDetailsSchema, PermissionChangeEventSchema | **Covered** |
| `core/src/__tests__/permission-change-event-comprehensive.test.ts` | Extended change event scenarios | **Covered** |
| `core/src/__tests__/permission-notification-events.test.ts` | PermissionNotificationSchema | **Covered** |

**Coverage Status**: ✅ **COVERED** — All Zod schemas have dedicated test files.

---

### Code Path 2: DirectoryAccessValidator
**Source**: `packages/core/src/directory-access-validator.ts`
**Class**: `DirectoryAccessValidator`
**Methods**: `isPathAllowed()`, `matchesAllowlist()`, `matchesBlocklist()`, `normalizePath()`
**Logic**: Blocklist > Allowlist > Default allow/deny; minimatch glob pattern matching

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `core/src/directory-access-validator.test.ts` | Core isPathAllowed(), allowlist/blocklist matching, default behavior | **Covered** |
| `core/src/__tests__/directory-access-integration.test.ts` | Integration with PermissionManager.checkDirectoryAccess() | **Covered** |
| `core/src/__tests__/permissions-directory-access.test.ts` | Directory access config validation and path matching | **Covered** |
| `core/src/__tests__/directory-access-validator.edge-cases.test.ts` | Edge cases: symlinks, relative paths, empty configs, special chars | **Covered** |
| `core/src/__tests__/directory-access-comprehensive.test.ts` | Comprehensive pattern matching scenarios | **Covered** |
| `test_artifacts/directory-access-validator-windows.test.ts` | Windows path handling (test artifact, not in main suite) | **Partial** |

**Coverage Status**: ✅ **COVERED** — Strong coverage including edge cases. Windows tests are in test_artifacts (not automated).

---

### Code Path 3: BrowserPermissionDeniedError
**Source**: `packages/core/src/tools/browser/browser-permission-denied-error.ts`
**Exports**: `BrowserPermissionDeniedError` (class), `BrowserPermissionDeniedContext`, `BrowserLifecycleState`, `isBrowserPermissionDeniedError()`, `toBrowserPermissionDeniedError()`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `core/src/__tests__/browser-permission-error-handling.test.ts` | Error construction, context, type guards | **Covered** |
| `core/src/__tests__/permission-denial-error-messages.test.ts` | Error message formatting for denials | **Covered** |
| `core/src/__tests__/permission-denial-graceful-degradation.test.ts` | Graceful handling when permissions denied | **Covered** |
| `core/src/__tests__/permission-denial-comprehensive.test.ts` | Full denial scenario coverage | **Covered** |
| `orchestrator/src/__tests__/v050-integration/browser-permission-integration.test.ts` | Browser + permission manager integration | **Covered** |
| `tests/integration/browser-permission-validation.test.ts` | Cross-package browser permission flows | **Covered** |
| `tests/integration/browser-automation-permissions.integration.test.ts` | Browser automation permission scenarios | **Covered** |
| `tests/integration/browser-security-permissions.integration.test.ts` | Security-focused browser permission tests | **Covered** |
| `tests/integration/browser-sensitive-operations-permissions.integration.test.ts` | Sensitive operation permission checks | **Covered** |
| `tests/integration/permission-policy-browser.integration.test.ts` | Policy enforcement for browser operations | **Covered** |

**Coverage Status**: ✅ **COVERED** — Extensive coverage across unit and integration tests.

---

### Code Path 4: Permission Test Utilities
**Source**: `packages/core/src/test-utils.ts`
**Exports**: `createMockPermission()`, `createMockExtendedPermission()`, `createMockPermissionQuery()`, `createMockToolPermissionConfig()`, `createMockDirectoryAccessConfig()`, `createMockToolPermissionResult()`, `createMockDirectoryAccessResult()`, `createMockPermissionsConfig()`, `createMockPermissionPresetConfig()`, `createMockToolPermissionRule()`, `createMockPermissionRequestEventData()`, `createMockPermissionGrantedEventData()`, `createMockPermissionDeniedEventData()`, `AgentPermissionContext`, `ToolPermissionContext`, `MockPermissionContext`, `mockAgentPermissions()`, `mockToolPermissions()`, `createMockPermissionContext()`, `createCommonPermissionScenarios()`, `assertPermissionEquals()`, `assertPermissionResultEquals()`, `assertPermissionState()`, `createPermissionTestingSuite()`, `createBatchPermissionChecker()`, `waitForPermissionEvent()`, `mockPermissionConfirmation()`, `expectPermissionGranted()`, `expectPermissionDenied()`, `expectPermissionPending()`, `PermissionContext`, `assertPermissionContext()`, `PermissionHistory`, `assertPermissionHistory()`, `createMockPermissionHistory()`, `expectPermissionState()`, `expectBatchPermissions()`, `PermissionMatchers`, `toBePermissionGranted()`, `toBePermissionDenied()`, `toBePermissionPending()`, `toHavePermissionContext()`, `toHavePermissionHistory()`, `setupPermissionMatchers()`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `core/src/__tests__/permission-test-utilities.test.ts` | Mock creation functions, permission context helpers | **Covered** |
| `core/src/__tests__/permission-utilities-integration.test.ts` | Integration of test utilities with real code | **Covered** |
| `core/src/__tests__/permission-test-utilities-acceptance.test.ts` | Acceptance criteria for test utility completeness | **Covered** |
| `core/src/__tests__/permission-test-coverage.test.ts` | Meta-coverage of test utilities | **Covered** |
| `core/src/__tests__/permission-assertion-helpers.test.ts` | assertPermissionEquals, assertPermissionResultEquals, assertPermissionState | **Covered** |
| `core/src/__tests__/permission-assertion-helpers-integration.test.ts` | Assertion helpers in integration scenarios | **Covered** |
| `core/src/__tests__/permission-assertion-helpers-negation.test.ts` | Negation cases for assertion helpers | **Covered** |
| `core/src/__tests__/helpers/MockPermissionTrigger.ts` | Test helper class (supporting file) | **N/A** |

**Coverage Status**: ✅ **COVERED** — Comprehensive self-testing of test utilities.

---

### Code Path 5: PermissionStore (SQLite CRUD)
**Source**: `packages/orchestrator/src/permission-store.ts`
**Class**: `PermissionStore`
**Methods**: `initialize()`, `createPermissionsTable()`, `runMigrations()`, `savePermission()`, `saveExtendedPermission()`, `getPermission()`, `getExtendedPermission()`, `listPermissions()`, `listExtendedPermissions()`, `clearPermissions()`, `clearExpired()`, `clearPermissionsForTool()`, `clearPermission()`, `getDirectoryAccess()`, `updateDirectoryAccess()`, `close()`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `orchestrator/src/__tests__/permission-store.test.ts` | Core CRUD: save, get, list, clear, expiry handling | **Covered** |
| `orchestrator/src/__tests__/permission-store.integration.test.ts` | SQLite integration, real DB operations | **Covered** |
| `orchestrator/src/__tests__/permission-store-extended-integration.test.ts` | Extended permissions: config, grantReason, grantedBy, tags | **Covered** |
| `orchestrator/src/__tests__/permission-store-extended.test.ts` | ExtendedPermission save/get/list | **Covered** |
| `orchestrator/src/__tests__/permission-store-migration.test.ts` | Database migration logic (column additions) | **Covered** |
| `orchestrator/src/__tests__/permission-store-migration-integration.test.ts` | Migration with real DB | **Covered** |
| `orchestrator/src/__tests__/permission-store-per-tool.test.ts` | Per-tool permission operations | **Covered** |
| `orchestrator/src/__tests__/permission-database-integration.test.ts` | Database-level integration tests | **Covered** |
| `orchestrator/src/__tests__/permission-database-persistence.test.ts` | Data persistence across store instances | **Covered** |

**Coverage Status**: ✅ **COVERED** — All CRUD operations, migrations, and persistence well-tested.

---

### Code Path 6: PermissionManager (Session Cache + Composite Checks)
**Source**: `packages/orchestrator/src/permission-manager.ts`
**Class**: `PermissionManager`
**Methods**: `checkPermission()`, `grantPermission()`, `revokePermission()`, `hasPermission()`, `getToolConfig()`, `setToolConfig()`, `checkDirectoryAccess()`, `checkToolPermission()`, `checkPermissionWithoutConsumption()`, `resetSession()`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `orchestrator/src/__tests__/permission-manager.test.ts` | Core: checkPermission, grantPermission, revokePermission, hasPermission, session cache | **Covered** |
| `orchestrator/src/__tests__/permission-manager-extended.test.ts` | getToolConfig, setToolConfig, checkDirectoryAccess, checkToolPermission | **Covered** |
| `orchestrator/src/__tests__/permission-manager-coverage.test.ts` | Coverage gap analysis and fill | **Covered** |
| `orchestrator/src/__tests__/permission-manager-granular.test.ts` | Granular per-tool permission checks | **Covered** |
| `orchestrator/src/__tests__/permission-check-integration.test.ts` | checkToolPermission with path validation integration | **Covered** |
| `orchestrator/src/__tests__/permission-check-autonomy-integration.test.ts` | Permission checks with autonomy presets | **Covered** |
| `orchestrator/src/__tests__/permission-check-edge-cases-integration.test.ts` | Edge cases: null scope, expired, concurrent | **Covered** |
| `orchestrator/src/__tests__/permission-granular-integration.test.ts` | Granular permission integration | **Covered** |
| `orchestrator/src/__tests__/permission-grants-integration.test.ts` | Grant flows and session cache behavior | **Covered** |

**Key Paths Within checkToolPermission()**:
| Decision Path | Test Coverage |
|---------------|---------------|
| `level === 'deny'` → denied | ✅ Covered in permission-manager.test.ts, permission-denial-scenarios.test.ts |
| `level === 'allow-always'` → allowed | ✅ Covered in permission-manager.test.ts |
| `level === 'allow-once'` → allowed + consumed | ✅ Covered in permission-manager.test.ts (session cache tests) |
| `level === null` + `config.requireConfirmation` → requires confirmation | ✅ Covered in permission-manager-extended.test.ts |
| `level === null` + no config → default allowed | ✅ Covered in permission-manager.test.ts |
| `pathValidation.allowed === false` → override deny | ✅ Covered in permission-check-integration.test.ts |
| `config.enabled === false` → disabled | ✅ Covered in permission-manager-extended.test.ts |

**Coverage Status**: ✅ **COVERED** — All decision branches tested.

---

### Code Path 7: PermissionPresetManager
**Source**: `packages/orchestrator/src/permission-preset-manager.ts`
**Class**: `PermissionPresetManager`
**Methods**: `applyPreset()`, `getCurrentPreset()`, `getEffectivePermissionLevel()`, `isToolAllowed()`, `isConfirmationRequired()`, `isToolDenied()`, `getPresetConfig()`, `resetToPreset()`, `applyPresetRules()`, `behaviorToPermissionLevel()`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `orchestrator/src/__tests__/permission-preset-manager.test.ts` | Core: applyPreset, getCurrentPreset, getEffectivePermissionLevel, isToolAllowed/Denied/ConfirmationRequired | **Covered** |
| `orchestrator/src/__tests__/permission-preset-manager.validation.test.ts` | Invalid preset validation, edge cases | **Covered** |
| `orchestrator/src/__tests__/permission-preset-manager.edge-cases.test.ts` | Edge cases and boundary conditions | **Covered** |
| `orchestrator/src/__tests__/permission-preset-manager.performance.test.ts` | Performance under load | **Covered** |
| `orchestrator/src/__tests__/permission-preset-manager.advanced-integration.test.ts` | Advanced integration scenarios | **Covered** |
| `orchestrator/src/__tests__/permission-preset-manager-comprehensive.test.ts` | Comprehensive scenario coverage | **Covered** |
| `orchestrator/src/__tests__/permission-preset-integration.test.ts` | Preset + PermissionStore integration | **Covered** |
| `orchestrator/src/__tests__/permission-preset-comprehensive.test.ts` | Full preset lifecycle | **Covered** |
| `orchestrator/src/__tests__/permission-preset-hooks.test.ts` | Preset lifecycle hooks | **Covered** |
| `orchestrator/src/__tests__/permission-preset-hooks-edge-cases.test.ts` | Hook edge cases | **Covered** |
| `orchestrator/src/__tests__/permission-preset-hooks-integration.test.ts` | Hook integration | **Covered** |
| `orchestrator/src/__tests__/permission-preset-warning-integration.test.ts` | Warning scenarios during preset changes | **Covered** |
| `orchestrator/src/__tests__/v050-integration/permission-preset-autonomy-integration.test.ts` | v0.5.0 autonomy preset integration | **Covered** |

**Preset Behavior Coverage**:
| Preset | Behavior | Test Coverage |
|--------|----------|---------------|
| `autonomous` | All tools allow-always | ✅ |
| `review-all` | All tools require confirmation (allow-once) | ✅ |
| `read-only` | Read tools allowed, write tools denied | ✅ |
| `behaviorToPermissionLevel('allow')` → `allow-always` | ✅ |
| `behaviorToPermissionLevel('confirm')` → `allow-once` | ✅ |
| `behaviorToPermissionLevel('deny')` → `deny` | ✅ |

**Coverage Status**: ✅ **COVERED** — Extensive coverage including presets, hooks, integration, edge cases, and performance.

---

### Code Path 8: Orchestrator Permission Events
**Source**: `packages/orchestrator/src/index.ts`
**Events**: `permission:request`, `permission:granted`, `permission:denied`, `permission:notification`
**Methods**: `requestPermission()`, `grantPermissionConfirmation()`, `denyPermissionConfirmation()`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `orchestrator/src/__tests__/permission-events.test.ts` | Event emission for request/granted/denied | **Covered** |
| `orchestrator/src/__tests__/permission-events-types.test.ts` | Event data type validation | **Covered** |
| `orchestrator/src/__tests__/permission-events-integration.test.ts` | End-to-end event flow | **Covered** |
| `orchestrator/src/__tests__/permission-events-acceptance.test.ts` | Acceptance criteria for events | **Covered** |
| `orchestrator/src/__tests__/permission-events-verification.test.ts` | Event verification helpers | **Covered** |
| `orchestrator/src/__tests__/permission-events-final-verification.test.ts` | Final verification pass | **Covered** |
| `orchestrator/src/__tests__/permission-confirmation.test.ts` | Confirmation flow: request → grant/deny | **Covered** |
| `orchestrator/src/__tests__/permission-external-confirmation.test.ts` | External confirmation providers | **Covered** |
| `orchestrator/src/__tests__/permission-flow-integration.test.ts` | Full permission flow lifecycle | **Covered** |
| `orchestrator/src/__tests__/permission-notification-orchestrator.integration.test.ts` | Notification emission from orchestrator | **Covered** |
| `orchestrator/src/__tests__/permission-change-notifications-integration.test.ts` | Change notification integration | **Covered** |
| `orchestrator/src/__tests__/apex-orchestrator-permission-initialization.test.ts` | Permission system initialization in orchestrator | **Covered** |
| `orchestrator/src/__tests__/apex-orchestrator-permission-integration.test.ts` | Full orchestrator permission integration | **Covered** |
| `orchestrator/src/__tests__/permission-orchestrator-e2e.test.ts` | End-to-end orchestrator permission | **Covered** |

**Coverage Status**: ✅ **COVERED** — All event types and confirmation flows tested.

---

### Code Path 9: Orchestrator Policy Enforcement (Autonomy Enforcer)
**Source**: `packages/orchestrator/src/index.ts` (lines ~8600-8900)
**Logic**: Autonomy enforcer deny decisions, policy enforcement, sensitive path access, pre-hook failures

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `orchestrator/src/__tests__/permission-denial-scenarios.test.ts` | Denial scenarios from policy enforcement | **Covered** |
| `orchestrator/src/__tests__/mid-stream-permission-revocation.test.ts` | Mid-execution permission revocation | **Covered** |
| `orchestrator/src/__tests__/permission-revocation-comprehensive.test.ts` | Comprehensive revocation scenarios | **Covered** |
| `orchestrator/src/__tests__/permission-revocation-graceful-degradation.test.ts` | Graceful degradation on revocation | **Covered** |
| `orchestrator/src/__tests__/permission-concurrent-modifications.test.ts` | Concurrent permission modifications | **Covered** |
| `orchestrator/src/__tests__/permission-system-recovery.test.ts` | System recovery from permission errors | **Covered** |
| `orchestrator/src/__tests__/permissions-system.test.ts` | Overall system behavior | **Covered** |
| `orchestrator/src/__tests__/permission-manual-validation.test.ts` | Manual validation scenarios | **Covered** |
| `orchestrator/src/__tests__/v050-integration/mcp-permission-integration.test.ts` | MCP server permission enforcement | **Covered** |

**Coverage Status**: ✅ **COVERED** — Policy enforcement, revocation, concurrent modifications, and recovery all tested.

---

### Code Path 10: Config-based Permission Loading
**Source**: `packages/core/src/config.ts`
**Logic**: Loading `permissions` block from `.apex/config.yaml`, parsing preset, applying toolConfig

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `core/src/__tests__/permissions-config.test.ts` | Config parsing of permissions block | **Covered** |
| `core/src/__tests__/permissions-config-coverage.test.ts` | Config coverage analysis | **Covered** |
| `core/src/__tests__/permissions-config-edge-cases.test.ts` | Config edge cases (missing, malformed) | **Covered** |
| `core/src/__tests__/permissions-config-init.test.ts` | Initialization with permission config | **Covered** |
| `core/src/__tests__/config-permission-loading.test.ts` | Config → permission system loading | **Covered** |
| `core/src/__tests__/permission-autonomy-integration.test.ts` | Config autonomy → preset integration | **Covered** |

**Coverage Status**: ✅ **COVERED**

---

### Code Path 11: Permission Notification Schema & Events
**Source**: `packages/core/src/types.ts` (PermissionNotificationSchema, PermissionEventData types)

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `core/src/__tests__/permission-notification-events.test.ts` | Notification schema validation | **Covered** |
| `core/src/__tests__/permission-notification.integration.test.ts` | Notification integration flow | **Covered** |
| `tests/integration/permission-notification.integration.test.ts` | Cross-package notification flow | **Covered** |
| `tests/integration/permission-notification-flow-end-to-end.integration.test.ts` | Full E2E notification flow | **Covered** |

**Coverage Status**: ✅ **COVERED**

---

### Code Path 12: CLI Permission UI Components
**Source**: `packages/cli/src/ui/components/permissions/PermissionPrompt.tsx`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `cli/src/ui/components/permissions/__tests__/PermissionPrompt.test.tsx` | Core rendering and interaction | **Covered** |
| `cli/src/ui/components/permissions/__tests__/PermissionPrompt.comprehensive.test.ts` | Comprehensive scenarios | **Covered** |
| `cli/src/ui/components/permissions/__tests__/PermissionPrompt.keyboard.test.tsx` | Keyboard interaction | **Covered** |
| `cli/src/ui/components/permissions/__tests__/PermissionPrompt.accessibility.test.tsx` | Accessibility testing | **Covered** |
| `cli/src/ui/components/permissions/__tests__/PermissionHistory.test.tsx` | Permission history display | **Covered** |
| `cli/src/__tests__/permission-notifications.test.ts` | CLI notification display | **Covered** |
| `cli/src/__tests__/permission-notification-cli.integration.test.ts` | CLI notification integration | **Covered** |
| `cli/src/ui/hooks/__tests__/useOrchestratorEvents.permission-notifications.test.ts` | Hook-level notification handling | **Covered** |
| `cli/src/__tests__/cli-confirmation-flow-e2e.test.ts` | E2E confirmation flow in CLI | **Covered** |
| `cli/src/ui/components/agents/__tests__/MockOrchestrator.confirmation-flow.test.ts` | Mock orchestrator confirmation | **Covered** |
| `cli/src/ui/components/agents/__tests__/mock-orchestrator-confirmation-flow.test.ts` | Confirmation flow variants | **Covered** |

**Coverage Status**: ✅ **COVERED**

---

### Code Path 13: CLI Permission Audit & Security
**Source**: Various CLI test files focused on security analysis

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `cli/src/__tests__/permission-audit-system.test.ts` | Audit trail for permission changes | **Covered** |
| `cli/src/__tests__/permission-audit-integration.test.ts` | Audit integration | **Covered** |
| `cli/src/__tests__/permission-security-vulnerabilities.test.ts` | Security vulnerability testing | **Covered** |
| `cli/src/__tests__/permission-edge-cases-comprehensive.test.ts` | Edge case security scenarios | **Covered** |
| `cli/src/__tests__/permission-cross-package-integration.test.ts` | Cross-package permission integrity | **Covered** |
| `cli/src/__tests__/permission-test-coverage-report.test.ts` | Coverage reporting | **Covered** |
| `cli/src/__tests__/permission-system-test-runner.test.ts` | System-level test runner | **Covered** |

**Coverage Status**: ✅ **COVERED**

---

### Code Path 14: API Permission Notifications
**Source**: `packages/api/src/` (REST endpoints, WebSocket)

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `api/src/__tests__/permission-notification-api.integration.test.ts` | REST API permission notification endpoints | **Covered** |
| `api/src/__tests__/websocket-permission-notifications.test.ts` | WebSocket permission event streaming | **Covered** |
| `api/src/__tests__/permission-analysis.test.ts` | Permission analysis endpoint | **Covered** |

**Coverage Status**: ✅ **COVERED**

---

### Code Path 15: Cross-Package Integration Tests
**Source**: `tests/integration/`

| Test File | Specific Paths Covered | Coverage |
|-----------|----------------------|----------|
| `tests/integration/permissions-system-integration.test.ts` | Full system permission integration | **Covered** |
| `tests/integration/permissions-acceptance-criteria.test.ts` | Acceptance criteria verification | **Covered** |
| `tests/integration/permission-denials-validation.test.ts` | Denial validation across system | **Covered** |
| `tests/integration/permission-denials-comprehensive.test.ts` | Comprehensive denial scenarios | **Covered** |
| `tests/integration/permission-denials-simple.test.ts` | Simple denial cases | **Covered** |
| `tests/integration/browser-automation-permissions.integration.test.ts` | Browser + permissions | **Covered** |
| `tests/integration/browser-security-permissions.integration.test.ts` | Browser security | **Covered** |
| `tests/integration/permission-policy-browser.integration.test.ts` | Policy + browser | **Covered** |
| `tests/integration/browser-permission-validation.test.ts` | Browser permission validation | **Covered** |
| `tests/integration/browser-sensitive-operations-permissions.integration.test.ts` | Sensitive ops | **Covered** |
| `tests/integration/permission-notification.integration.test.ts` | Notification cross-package | **Covered** |
| `tests/integration/permission-notification-flow-end-to-end.integration.test.ts` | Full E2E flow | **Covered** |

**Coverage Status**: ✅ **COVERED**

---

## 4. Coverage Summary Matrix

| Code Path | Unit Tests | Integration Tests | Edge Cases | Status |
|-----------|-----------|------------------|------------|--------|
| 1. Permission Types & Schemas | 10 files | 2 files | ✅ | ✅ COVERED |
| 2. DirectoryAccessValidator | 2 files | 3 files | ✅ | ✅ COVERED |
| 3. BrowserPermissionDeniedError | 4 files | 6 files | ✅ | ✅ COVERED |
| 4. Permission Test Utilities | 7 files | 2 files | ✅ | ✅ COVERED |
| 5. PermissionStore (SQLite) | 4 files | 5 files | ✅ | ✅ COVERED |
| 6. PermissionManager | 3 files | 6 files | ✅ | ✅ COVERED |
| 7. PermissionPresetManager | 6 files | 7 files | ✅ | ✅ COVERED |
| 8. Permission Events | 6 files | 8 files | ✅ | ✅ COVERED |
| 9. Policy Enforcement | 3 files | 6 files | ✅ | ✅ COVERED |
| 10. Config Loading | 5 files | 1 file | ✅ | ✅ COVERED |
| 11. Notification Schema | 2 files | 2 files | ✅ | ✅ COVERED |
| 12. CLI Permission UI | 5 files | 6 files | ✅ | ✅ COVERED |
| 13. CLI Audit & Security | 7 files | 0 files | ✅ | ✅ COVERED |
| 14. API Notifications | 1 file | 2 files | ✅ | ✅ COVERED |
| 15. Cross-Package Integration | 0 files | 12 files | ✅ | ✅ COVERED |

**Total Permission Test Files**: ~120+ dedicated permission test files across all packages.

---

## 5. Test File Count by Package

| Package | Permission Test Files |
|---------|---------------------|
| `packages/core/src/` (root) | 5 |
| `packages/core/src/__tests__/` | 32 |
| `packages/orchestrator/src/__tests__/` | 53 |
| `packages/orchestrator/src/__tests__/v050-integration/` | 3 |
| `packages/cli/src/__tests__/` | 9 |
| `packages/cli/src/ui/components/permissions/__tests__/` | 5 |
| `packages/cli/src/ui/hooks/__tests__/` | 1 |
| `packages/cli/src/ui/components/agents/__tests__/` | 3 |
| `packages/api/src/__tests__/` | 3 |
| `tests/integration/` | 12 |
| **Total** | **~126** |

---

## 6. Architectural Observations

### Strengths
1. **Layered testing** — Each permission code path has unit, integration, AND edge-case tests
2. **Cross-package coverage** — Integration tests verify permission flows across core → orchestrator → cli/api boundaries
3. **Decision branch coverage** — The `checkToolPermission()` method has every decision branch explicitly tested
4. **Preset coverage** — All 3 presets (autonomous, review-all, read-only) have dedicated tests
5. **Test utilities** — Rich test utilities in core/test-utils.ts are themselves well-tested

### Potential Gaps (Minor)
1. **Windows path handling** — `directory-access-validator-windows.test.ts` is in `test_artifacts/` (not part of automated CI)
2. **Performance tests** — `permission-preset-manager.performance.test.ts` exists but may not run in CI
3. **Coverage report tests** — Several `*-coverage-report.test.ts` files appear to be meta-tests rather than functional tests

### Recommendations for Next Stages
1. Verify all 126 test files actually pass (run `npm run test`)
2. Consider moving `test_artifacts/directory-access-validator-windows.test.ts` into the main test suite
3. The mapping document itself could be generated programmatically by parsing test `describe()` blocks

---

## 7. ADR: Permission Test Mapping Architecture

### Decision
Document the test-to-code-path mapping as a static markdown document in `docs/architecture/` rather than generating it dynamically.

### Rationale
- Static documents are easier to review and maintain
- The permission system is stable (v0.5.0 complete)
- Dynamic generation would require parsing ASTs or test runner output

### Consequences
- Must be updated manually when permission code paths change
- Serves as a reference for future refactoring or audit tasks
