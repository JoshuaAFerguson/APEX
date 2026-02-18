# ADR-005: Mock Permission Context Helpers for Test Utilities

## Status
Accepted

## Date
2025-01-10

## Context

The APEX codebase has a comprehensive permission system defined in `@apex/core/types.ts` including:
- **ToolPermission**: Permission levels required for tool execution (`read`, `write`, `execute`, `network`, `admin`)
- **PermissionLevel**: User-granted permission levels (`allow-always`, `allow-once`, `deny`)
- **Permission**: Stored permission records with tool, scope, level, expiry, and createdAt
- **ExtendedPermission**: Permissions with config, grantReason, grantedBy, and tags
- **PermissionPreset**: Predefined permission configurations (`autonomous`, `review-all`, `read-only`)
- **ToolPermissionConfig**: Per-tool configuration (FilesystemToolConfig, ShellToolConfig, WebToolConfig, etc.)
- **ToolPermissionResult**: Result of permission checks (allowed, level, requiresConfirmation, denialReason, config)
- **PermissionsConfig**: Combined preset and customRules configuration
- **Permission event types**: PermissionRequestEventData, PermissionGrantedEventData, PermissionDeniedEventData

The existing `test-utils.ts` provides platform detection and mocking utilities but lacks permission-related mock helpers. Tests currently have to manually construct permission objects, leading to:
1. Boilerplate in test files
2. Inconsistent mock data across tests
3. Potential drift from actual types as the schema evolves

## Decision

We will extend `packages/core/src/test-utils.ts` with mock permission context helpers that:

1. **Follow existing patterns**: Maintain the same style as existing test utilities (platform mocking, test skipping)
2. **Use factory functions**: Provide `create*` functions that return properly typed objects with sensible defaults
3. **Support partial overrides**: Allow tests to override specific properties while keeping defaults
4. **Stay type-safe**: Leverage TypeScript and Zod schemas to ensure mock data matches production types
5. **Export from dedicated submodule**: Continue the pattern of not exporting test-utils from main index.ts

### API Design

The following factory functions will be added:

```typescript
// Core permission mocks
createMockPermission(overrides?: Partial<Permission>): Permission
createMockExtendedPermission(overrides?: Partial<ExtendedPermission>): ExtendedPermission
createMockPermissionQuery(overrides?: Partial<PermissionQuery>): PermissionQuery

// Tool permission configuration mocks
createMockToolPermissionConfig(overrides?: Partial<BaseToolPermissionConfig>): BaseToolPermissionConfig
createMockFilesystemToolConfig(overrides?: Partial<FilesystemToolConfig>): FilesystemToolConfig
createMockShellToolConfig(overrides?: Partial<ShellToolConfig>): ShellToolConfig
createMockWebToolConfig(overrides?: Partial<WebToolConfig>): WebToolConfig
createMockBrowserToolConfig(overrides?: Partial<BrowserToolConfig>): BrowserToolConfig
createMockSearchToolConfig(overrides?: Partial<SearchToolConfig>): SearchToolConfig
createMockDirectoryAccessConfig(overrides?: Partial<DirectoryAccessConfig>): DirectoryAccessConfig

// Permission result mocks
createMockToolPermissionResult(overrides?: Partial<ToolPermissionResult>): ToolPermissionResult
createMockDirectoryAccessResult(overrides?: Partial<DirectoryAccessResult>): DirectoryAccessResult

// Permission preset mocks
createMockPermissionsConfig(overrides?: Partial<PermissionsConfig>): PermissionsConfig
createMockPermissionPresetConfig(overrides?: Partial<PermissionPresetConfig>): PermissionPresetConfig
createMockToolPermissionRule(overrides?: Partial<ToolPermissionRule>): ToolPermissionRule

// Permission event data mocks
createMockPermissionRequestEventData(overrides?: Partial<PermissionRequestEventData>): PermissionRequestEventData
createMockPermissionGrantedEventData(overrides?: Partial<PermissionGrantedEventData>): PermissionGrantedEventData
createMockPermissionDeniedEventData(overrides?: Partial<PermissionDeniedEventData>): PermissionDeniedEventData

// Agent/tool permission helpers
mockAgentPermissions(agentName: string, permissions: Permission[]): Permission[]
mockToolPermissions(toolName: string, options?: { level?: PermissionLevel; scope?: string }): Permission
```

### Default Values Strategy

Each factory function will provide production-realistic defaults:

```typescript
createMockPermission() → {
  tool: 'Read',
  scope: undefined,
  level: 'allow-always',
  expiry: undefined,
  createdAt: new Date()
}

createMockToolPermissionResult() → {
  allowed: true,
  level: 'allow-always',
  requiresConfirmation: false,
  denialReason: undefined,
  config: undefined
}
```

## Consequences

### Positive
- **Reduced test boilerplate**: Tests can use `createMockPermission({ tool: 'Write' })` instead of constructing full objects
- **Type safety**: Factory functions return properly typed objects matching Zod schemas
- **Maintainability**: When permission types change, only factory functions need updating
- **Consistency**: All tests use the same default values, making behavior more predictable
- **Documentation**: Factory functions serve as living documentation of valid permission structures

### Negative
- **Additional code in test-utils**: Increases the size of the test utilities module
- **Learning curve**: Developers need to discover and learn the available factory functions

### Neutral
- **No runtime impact**: Test utilities are not exported from the main package and don't affect production builds

## Implementation Notes

1. **File structure**: Add all permission mocks to existing `test-utils.ts` file, keeping related utilities together
2. **Import types**: Import only types (not schemas) to minimize dependencies and avoid circular imports
3. **JSDoc comments**: Document each function with examples for IDE discoverability
4. **Export grouping**: Group permission-related exports together for clarity

## Alternatives Considered

### Alternative 1: Separate `test-utils/permissions.ts` file
- **Pros**: Cleaner separation, easier to find permission-specific utilities
- **Cons**: Adds complexity, requires additional import paths
- **Decision**: Rejected in favor of simplicity - extend existing file

### Alternative 2: Use Zod schema defaults directly
- **Pros**: No need for separate factory functions
- **Cons**: Zod defaults are for parsing, not for test data generation; doesn't support partial overrides cleanly
- **Decision**: Rejected - factory functions provide better ergonomics

### Alternative 3: Export from main index.ts
- **Pros**: Simpler import path
- **Cons**: Adds vitest as a runtime dependency for production code
- **Decision**: Rejected - maintain current pattern of separate test-utils import
