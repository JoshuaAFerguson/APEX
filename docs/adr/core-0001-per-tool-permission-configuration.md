# ADR-0001: Per-Tool Permission Configuration Schema

## Status

Proposed

## Context

The APEX platform requires granular permission control for tools used by AI agents. The current permission system (`PermissionSchema`) provides basic tool-level permissions with optional scope patterns, but lacks:

1. **Per-tool configuration settings** - Different tools require different configuration parameters (e.g., timeout for Bash, file size limits for Read/Write)
2. **Directory access control** - Explicit allowlist/blocklist patterns for filesystem-related tools
3. **Extensible tool-specific settings** - A way to define custom configuration for each tool type

### Current State

The existing `PermissionSchema` structure:
```typescript
export const PermissionSchema = z.object({
  tool: z.string().min(1, 'Tool name is required'),
  scope: z.string().optional(),
  level: PermissionLevelSchema,  // 'allow-always' | 'allow-once' | 'deny'
  expiry: z.date().optional(),
  createdAt: z.date(),
});
```

### Requirements

Per acceptance criteria:
1. New Zod schemas: `ToolPermissionConfig` (per-tool settings)
2. New Zod schemas: `DirectoryAccessConfig` (allowlist/blocklist paths)
3. Extended `Permission` schema to support tool-specific configurations
4. TypeScript types exported and compile successfully

## Decision

We will extend the permission system with a composable, type-safe per-tool configuration architecture.

### Schema Design

#### 1. DirectoryAccessConfig Schema

Controls filesystem access patterns:

```typescript
export const DirectoryAccessConfigSchema = z.object({
  /** Paths that are explicitly allowed (glob patterns supported) */
  allowlist: z.array(z.string()).optional().default([]),

  /** Paths that are explicitly blocked (glob patterns supported) */
  blocklist: z.array(z.string()).optional().default([]),

  /** Whether to allow access to paths not in allowlist/blocklist (default: false if allowlist is set, true otherwise) */
  defaultAllow: z.boolean().optional(),

  /** Whether to resolve symlinks when checking paths (default: true) */
  resolveSymlinks: z.boolean().optional().default(true),

  /** Maximum directory depth for recursive operations (0 = unlimited) */
  maxDepth: z.number().int().min(0).optional().default(0),
});
```

#### 2. ToolPermissionConfig Schema

Per-tool configuration with discriminated union for tool-specific settings:

```typescript
export const BaseToolPermissionConfigSchema = z.object({
  /** Whether the tool is enabled */
  enabled: z.boolean().optional().default(true),

  /** Maximum execution time in milliseconds (0 = no limit) */
  timeout: z.number().int().min(0).optional().default(0),

  /** Whether to require confirmation before execution */
  requireConfirmation: z.boolean().optional().default(false),

  /** Rate limiting: maximum calls per minute (0 = no limit) */
  rateLimitPerMinute: z.number().int().min(0).optional().default(0),

  /** Custom metadata for the tool configuration */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Tool-specific configurations
export const FilesystemToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Directory access control */
  directoryAccess: DirectoryAccessConfigSchema.optional(),

  /** Maximum file size in bytes for read/write operations (0 = no limit) */
  maxFileSize: z.number().int().min(0).optional().default(0),

  /** Allowed file extensions (empty = all allowed) */
  allowedExtensions: z.array(z.string()).optional().default([]),

  /** Blocked file extensions */
  blockedExtensions: z.array(z.string()).optional().default([]),
});

export const ShellToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Directory access control for working directory */
  directoryAccess: DirectoryAccessConfigSchema.optional(),

  /** Command patterns to block (regex strings) */
  blockedCommands: z.array(z.string()).optional().default([]),

  /** Whether to allow running commands as root/admin */
  allowElevatedPrivileges: z.boolean().optional().default(false),

  /** Environment variables to inject */
  environment: z.record(z.string(), z.string()).optional(),

  /** Working directory override */
  workingDirectory: z.string().optional(),
});

export const WebToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Allowed domains for web access (empty = all allowed) */
  allowedDomains: z.array(z.string()).optional().default([]),

  /** Blocked domains */
  blockedDomains: z.array(z.string()).optional().default([]),

  /** Maximum response size in bytes */
  maxResponseSize: z.number().int().min(0).optional().default(0),

  /** Whether to follow redirects */
  followRedirects: z.boolean().optional().default(true),

  /** Custom headers to include */
  headers: z.record(z.string(), z.string()).optional(),
});

export const SearchToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Directory access control for search scope */
  directoryAccess: DirectoryAccessConfigSchema.optional(),

  /** Maximum number of results */
  maxResults: z.number().int().min(1).optional().default(1000),

  /** File patterns to include in search */
  includePatterns: z.array(z.string()).optional().default([]),

  /** File patterns to exclude from search */
  excludePatterns: z.array(z.string()).optional().default([]),
});

// Union of all tool-specific configs
export const ToolPermissionConfigSchema = z.union([
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  SearchToolConfigSchema,
  BaseToolPermissionConfigSchema, // Fallback for generic tools
]);
```

#### 3. Extended Permission Schema

```typescript
export const ExtendedPermissionSchema = PermissionSchema.extend({
  /** Per-tool configuration settings */
  config: ToolPermissionConfigSchema.optional(),

  /** Description of why this permission was granted */
  grantReason: z.string().optional(),

  /** Who/what granted this permission */
  grantedBy: z.string().optional(),

  /** Tags for categorizing permissions */
  tags: z.array(z.string()).optional().default([]),
});
```

### Type Exports

All schemas will export corresponding TypeScript types:

```typescript
export type DirectoryAccessConfig = z.infer<typeof DirectoryAccessConfigSchema>;
export type BaseToolPermissionConfig = z.infer<typeof BaseToolPermissionConfigSchema>;
export type FilesystemToolConfig = z.infer<typeof FilesystemToolConfigSchema>;
export type ShellToolConfig = z.infer<typeof ShellToolConfigSchema>;
export type WebToolConfig = z.infer<typeof WebToolConfigSchema>;
export type SearchToolConfig = z.infer<typeof SearchToolConfigSchema>;
export type ToolPermissionConfig = z.infer<typeof ToolPermissionConfigSchema>;
export type ExtendedPermission = z.infer<typeof ExtendedPermissionSchema>;
```

### Placement in types.ts

The new schemas will be placed in the "User Permission Management" section (lines 64-109), immediately after the existing `PermissionQuerySchema`.

### Integration Points

1. **ApexConfig**: Add optional `defaultToolPermissions` field to set project-level defaults
2. **AgentDefinition**: Add optional `toolPermissions` field for agent-specific overrides
3. **Permission evaluation**: Update permission checking logic to consider tool configs

## Consequences

### Positive

1. **Granular Control**: Per-tool configuration allows fine-grained access control
2. **Type Safety**: Zod schemas provide runtime validation and TypeScript types
3. **Backwards Compatible**: Existing `Permission` objects remain valid; new fields are optional
4. **Extensible**: Easy to add new tool-specific configurations
5. **Composable**: `DirectoryAccessConfig` can be reused across multiple tool configs

### Negative

1. **Complexity**: More complex permission evaluation logic required
2. **Migration**: Existing permissions may need updates to leverage new features
3. **Performance**: Additional validation overhead for permission checks

### Risks

1. **Breaking Changes**: None expected if implementation follows optional field pattern
2. **Schema Evolution**: Future tool types may require additional config schemas

## Implementation Notes

1. Add schemas to `packages/core/src/types.ts` in the Permission Management section
2. Export all new types from `packages/core/src/index.ts` (via `types.ts` re-export)
3. Add comprehensive tests for all new schemas
4. Update documentation with examples of per-tool configuration

## References

- Existing Permission types: `packages/core/src/types.ts` (lines 64-109)
- Tool definitions: `packages/core/src/types.ts` (lines 35-315)
- Test patterns: `packages/core/src/permission-*.test.ts`
