# ADR-051: File Download Permission Integration Tests

## Status
Proposed

## Context
The `BrowserTool` class in `packages/orchestrator/src/tools/browser-tool.ts` includes an `allowDownloads` configuration option in `BrowserToolConfig` (line 324). This option is passed through to Playwright's `acceptDownloads` context option (line 619). However, there is **no configuration-level enforcement** of download permissions within `checkConfigurationRestrictions()` — the method handles `evaluate`, `submit`, `screenshot`, and `navigate` restrictions, but does not check `allowDownloads`.

This means:
1. `allowDownloads` only controls the Playwright context creation (whether the browser itself accepts download events), but...
2. There is no explicit permission gate that blocks download-triggering operations (e.g., clicking a download link, navigating to a file URL) when `allowDownloads` is `false`.
3. We need integration tests that validate download permission enforcement at the **configuration restriction level**.

## Decision

### Architecture for Integration Tests

The test file will be located at:
```
packages/orchestrator/src/__tests__/file-download-permissions.integration.test.ts
```

This follows the established pattern of placing integration tests in `packages/orchestrator/src/__tests__/`.

### Test Architecture

The tests use the **same mock pattern** as `browser-tool-permission-integration.test.ts`:

```
┌─────────────────────────────────────────────────────────────┐
│  Test Suite: File Download Permission Integration           │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │  Mock Layer                               │              │
│  │  - Mock Playwright (chromium/page/context)│              │
│  │  - Mock PermissionManager                 │              │
│  │    • checkToolPermission (spy)            │              │
│  │    • getToolConfig (spy → BrowserToolConfig)│            │
│  └──────────────────────┬───────────────────┘              │
│                          │                                  │
│  ┌──────────────────────▼───────────────────┐              │
│  │  BrowserTool (real class)                 │              │
│  │  - constructor({ permissionManager })     │              │
│  │  - execute({ operation, params })         │              │
│  │  - checkPermission()                      │              │
│  └──────────────────────┬───────────────────┘              │
│                          │                                  │
│  ┌──────────────────────▼───────────────────┐              │
│  │  Test Scenarios                           │              │
│  │  1. allowDownloads: false → blocks        │              │
│  │  2. allowDownloads: true → allows         │              │
│  │  3. allowDownloads: undefined → default   │              │
│  │  4. Permission denied → blocks before     │              │
│  │     config check                          │              │
│  │  5. Context creation passes config through│              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Test Categories

#### 1. Configuration Restriction Enforcement (Primary)
Tests that `checkConfigurationRestrictions()` properly checks `allowDownloads` config.

**Current Gap**: The `checkConfigurationRestrictions()` method in `browser-tool.ts` does NOT have a case for download operations. The tests should validate the current behavior and document expected behavior.

**Design Decision**: Since `BrowserOperation` type does not include a `'download'` operation (downloads are side-effects of `navigate` or `click` operations), the tests should focus on:
- Verifying `allowDownloads` config is passed to Playwright's `acceptDownloads` context option
- Verifying the PermissionManager can be used to block operations that trigger downloads
- Testing the interplay between `allowDownloads` config and permission checks

#### 2. Playwright Context Configuration
Tests that `ensurePlaywrightPage()` correctly passes `allowDownloads` to `browser.newContext({ acceptDownloads })`.

#### 3. Permission + Config Interaction
Tests for the combined effect of permission levels AND download config.

### Interfaces and Contracts

The tests rely on these existing contracts:

```typescript
// BrowserToolConfig.allowDownloads → Playwright acceptDownloads
interface BrowserToolConfig {
  allowDownloads?: boolean;  // Controls browser context download acceptance
  // ...other fields
}

// PermissionManager.getToolConfig() → Returns BrowserToolConfig
// PermissionManager.checkToolPermission() → Returns ToolPermissionResult

// BrowserTool.execute() → 3-layer permission check:
//   1. checkPermissionInternal() → PermissionManager.checkToolPermission()
//   2. checkConfigurationRestrictions() → PermissionManager.getToolConfig()
//   3. checkDangerousOperation() → dangerous op detection
```

### Mock Strategy

Follow the exact mock pattern from `browser-tool-permission-integration.test.ts`:

```typescript
// Mock Playwright at module level
vi.mock('playwright', () => ({
  chromium: { launch: vi.fn(() => Promise.resolve(mockBrowser)) },
  firefox: { launch: vi.fn(() => Promise.resolve(mockBrowser)) },
  webkit: { launch: vi.fn(() => Promise.resolve(mockBrowser)) },
}));

// Mock PermissionManager as partial mock with spies
mockPermissionManager = {
  checkToolPermission: permissionCheckSpy,
  getToolConfig: getToolConfigSpy,
} as any;
```

### Test Specifications

| Test ID | Category | Description | Expected Behavior |
|---------|----------|-------------|-------------------|
| FDP-01 | Context Config | `allowDownloads: true` passes `acceptDownloads: true` to context | Playwright context created with `acceptDownloads: true` |
| FDP-02 | Context Config | `allowDownloads: false` passes `acceptDownloads: false` to context | Playwright context created with `acceptDownloads: false` |
| FDP-03 | Context Config | `allowDownloads: undefined` defaults to `acceptDownloads: true` | Default behavior preserved |
| FDP-04 | Permission Gate | Permission denied blocks before download config is checked | `success: false`, permission error |
| FDP-05 | Permission Gate | Permission granted + `allowDownloads: true` allows operations | `success: true` |
| FDP-06 | Permission Gate | Permission granted + `allowDownloads: false` still allows non-download ops | Navigate succeeds (download blocking is context-level) |
| FDP-07 | Combined | No permission manager → downloads allowed by default | `success: true`, `acceptDownloads: true` |
| FDP-08 | Combined | Config `enabled: false` blocks all operations including download-triggering | `success: false`, "Browser tool is disabled" |
| FDP-09 | Context Verify | Multiple operations reuse same context with download config | Context created once with correct config |
| FDP-10 | Edge Cases | Config returned as null → default download behavior | `acceptDownloads: true` (default) |

### File Dependencies

The test file imports from:
- `vitest` — test framework
- `../tools/browser-tool` — `BrowserTool`, `BrowserToolConfig`
- `../../permission-manager` — `PermissionManager` (type only, mocked)
- `@apexcli/core` — `PermissionLevel`, `ToolPermissionResult`

### Non-Goals

- **Not testing actual browser downloads**: Tests use mocked Playwright; no real browser is launched.
- **Not adding a new `download` operation**: The `BrowserOperation` type stays unchanged. Downloads are a side-effect of existing operations.
- **Not modifying `checkConfigurationRestrictions()`**: The architecture stage identifies the gap but does not implement production code changes. That's for the developer stage.

## Consequences

### Positive
- Establishes clear test coverage for download permission behavior
- Documents the current gap in `checkConfigurationRestrictions()` for future enhancement
- Follows existing mock patterns for consistency and maintainability
- Tests are fast (no real browser needed)

### Negative
- Tests may initially pass trivially for some cases since `checkConfigurationRestrictions()` doesn't have download-specific logic yet
- Some tests verify Playwright context config passthrough rather than application-level blocking

### Notes for Next Stages

1. **Developer Stage**: The test file should be created following this architecture. If the developer decides to add download-specific checking in `checkConfigurationRestrictions()`, additional tests for that behavior should be included.

2. **Tester Stage**: Verify all 10 test specifications pass. Consider adding edge cases for:
   - Download triggered by `evaluate` (JavaScript-initiated download)
   - Download triggered by `click` on `<a download>` element
   - Race conditions between permission revocation and active downloads

3. **Reviewer Stage**: Ensure mock setup doesn't leak between tests (`vi.clearAllMocks()` in `beforeEach`).
