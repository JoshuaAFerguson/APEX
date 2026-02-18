# ADR-009: PermissionManager Extension for Granular Tool and Directory Permission Checks

## Status

Proposed

## Context

The APEX v0.5.0 permission system currently provides:
- `PermissionManager`: High-level permission management with session-level caching
- `PermissionStore`: SQLite persistence for permissions with extended permission support
- `PermissionPresetManager`: Preset-based permission configuration
- `DirectoryAccessValidator`: Path validation against allowlist/blocklist patterns

However, there is a gap between these components. The PermissionManager only provides basic `checkPermission()`, `grantPermission()`, `revokePermission()`, and `hasPermission()` methods. It lacks:

1. **Granular tool permission checking** with tool-specific configuration options
2. **Integrated directory access validation** that combines permission levels with path validation
3. **Direct access to tool configuration** stored in extended permissions

This ADR proposes extending the `PermissionManager` class with new methods to bridge these gaps.

## Decision

### New Methods to Add

We will extend `PermissionManager` with three new methods:

#### 1. `checkToolPermission(tool: string, options?: ToolPermissionCheckOptions): Promise<ToolPermissionResult>`

A comprehensive tool permission check that returns detailed permission information including:
- Permission level (allow-always, allow-once, deny, or null)
- Tool-specific configuration (if available)
- Whether confirmation is required
- Denial reason (if denied)

**Interface Definition:**

```typescript
interface ToolPermissionCheckOptions {
  /** Optional scope for the permission check */
  scope?: string;
  /** Optional path to validate against directory access rules */
  path?: string;
  /** Whether to consume allow-once permissions (default: true) */
  consumeAllowOnce?: boolean;
  /** Optional base directory for path validation */
  baseDir?: string;
}

interface ToolPermissionResult {
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** The permission level (null if no permission exists) */
  level: PermissionLevel | null;
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Reason for denial (if not allowed) */
  denialReason?: string;
  /** Tool-specific configuration (if available) */
  config?: ToolPermissionConfig;
  /** Path validation result (if path was provided) */
  pathValidation?: PathValidationResult;
}
```

#### 2. `checkDirectoryAccess(path: string, tool?: string): Promise<DirectoryAccessResult>`

Validates directory access by combining:
- Tool-specific directory access configuration from the permission store
- DirectoryAccessValidator for pattern matching
- Session-level directory access overrides (new cache type)

**Interface Definition:**

```typescript
interface DirectoryAccessCheckOptions {
  /** Tool name for tool-specific directory access config */
  tool?: string;
  /** Scope for the permission check */
  scope?: string;
  /** Base directory for resolving relative paths */
  baseDir?: string;
}

interface DirectoryAccessResult {
  /** Whether access to the path is allowed */
  allowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** The matched pattern (if any) */
  matchedPattern?: string;
  /** Whether it matched allowlist, blocklist, or defaulted */
  matchType?: 'allowlist' | 'blocklist' | 'default';
  /** The directory access config that was used */
  configUsed?: DirectoryAccessConfig;
}
```

#### 3. `getToolConfig(tool: string, scope?: string): Promise<ToolPermissionConfig | null>`

Retrieves tool-specific configuration from the permission store:

```typescript
async getToolConfig(tool: string, scope?: string): Promise<ToolPermissionConfig | null>
```

### Session Cache Extension

The session cache will be extended to support:

1. **Directory access overrides**: Temporary directory access rules for the session
2. **Tool config cache**: Cached tool configurations for performance

```typescript
private sessionCache: Map<string, PermissionLevel> = new Map();
private sessionDirectoryAccess: Map<string, DirectoryAccessConfig> = new Map();
private sessionToolConfigCache: Map<string, ToolPermissionConfig | null> = new Map();
```

The `resetSession()` method will be updated to clear all cache types.

### Integration Flow

```
checkToolPermission(tool, options)
  │
  ├─► checkPermission(tool, scope)     // Existing method
  │     ├─► Session cache lookup
  │     └─► PermissionStore lookup
  │
  ├─► getToolConfig(tool, scope)       // New method
  │     ├─► Tool config cache lookup
  │     └─► PermissionStore.getExtendedPermission()
  │
  └─► checkDirectoryAccess(path, tool) // New method (if path provided)
        ├─► Session directory access lookup
        ├─► Get tool's directory config
        └─► DirectoryAccessValidator.isPathAllowed()
```

## Consequences

### Positive

1. **Unified Permission API**: Single entry point for comprehensive permission checks
2. **Performance**: Session-level caching reduces database queries
3. **Flexibility**: Tool-specific configurations are accessible programmatically
4. **Directory Access Integration**: Seamless path validation with tool permissions
5. **Backward Compatibility**: Existing methods remain unchanged

### Negative

1. **Increased Complexity**: More methods and cache types to manage
2. **Memory Usage**: Additional session caches for directory access and tool config
3. **Testing Surface**: More test cases needed for new functionality

### Neutral

1. **New Dependencies**: DirectoryAccessValidator import from @apexcli/core
2. **Session Lifecycle**: Extended session reset behavior affects more state

## Implementation Plan

### Phase 1: Types and Interfaces
1. Add new interfaces to `@apexcli/core/types.ts`
2. Export new types from the package

### Phase 2: PermissionManager Extension
1. Add new cache properties for directory access and tool config
2. Implement `getToolConfig()` method
3. Implement `checkDirectoryAccess()` method
4. Implement `checkToolPermission()` method
5. Update `resetSession()` to clear all caches

### Phase 3: Testing
1. Unit tests for each new method
2. Integration tests with DirectoryAccessValidator
3. Session caching behavior tests
4. Edge case and error handling tests

### Phase 4: Documentation
1. Update API documentation
2. Add usage examples
3. Update CLAUDE.md if needed

## File Changes

### Modified Files
- `packages/core/src/types.ts`: New interfaces
- `packages/orchestrator/src/permission-manager.ts`: New methods
- `packages/orchestrator/src/__tests__/permission-manager.test.ts`: New tests

### No New Files Required
All changes fit within existing file structure.

## Technical Details

### Cache Key Generation

For directory access cache:
```typescript
private generateDirectoryAccessCacheKey(path: string, tool?: string): string {
  return tool ? `${tool}:${path}` : path;
}
```

For tool config cache:
```typescript
private generateToolConfigCacheKey(tool: string, scope?: string): string {
  return scope ? `${tool}:${scope}` : tool;
}
```

### Session Cache Invalidation

Session caches are cleared in the following scenarios:
1. `resetSession()` is called
2. Tool configuration is updated via `grantPermission()` with config
3. Directory access configuration is updated

### Thread Safety

The implementation maintains the same thread-safety characteristics as the existing PermissionManager:
- Session caches use Map which is not thread-safe
- Concurrent access may result in race conditions for allow-once consumption
- This is acceptable for the single-threaded Node.js environment

## Alternatives Considered

### Alternative 1: Separate DirectoryPermissionManager

Create a new class specifically for directory access:

```typescript
class DirectoryPermissionManager {
  checkAccess(path: string, tool?: string): Promise<DirectoryAccessResult>
}
```

**Rejected because:**
- Increases API surface area
- Requires coordination between multiple managers
- Tool permissions and directory access are conceptually linked

### Alternative 2: Extend PermissionPresetManager

Add directory and tool config methods to the preset manager:

**Rejected because:**
- Preset manager is focused on preset application
- Would create unclear responsibility boundaries
- PermissionManager is the logical location for runtime permission checks

### Alternative 3: Create New Permission Facade

Create a facade that combines all permission components:

```typescript
class PermissionFacade {
  constructor(
    manager: PermissionManager,
    presetManager: PermissionPresetManager,
    validator: DirectoryAccessValidator
  )
}
```

**Rejected because:**
- Adds unnecessary abstraction layer
- Most use cases need only PermissionManager
- Extension is simpler and more cohesive

## References

- `packages/orchestrator/src/permission-manager.ts`
- `packages/orchestrator/src/permission-store.ts`
- `packages/core/src/directory-access-validator.ts`
- `packages/core/src/types.ts` (ToolPermissionConfig types)
