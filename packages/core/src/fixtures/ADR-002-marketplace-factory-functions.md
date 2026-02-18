# ADR-002: Factory Functions for Marketplace Test Data Generation

## Status
Proposed

## Context

The marketplace fixtures in `packages/core/src/fixtures/marketplace.ts` currently provide static fixture instances (e.g., `baseFilesystemMarketplaceEntry`, `baseMemoryServer`) and simple utility functions (`createMarketplaceEntry`, `createServerConfig`). However, these existing functions:

1. **Require a base object** - The current `createServerConfig(baseConfig, overrides)` pattern requires passing an existing fixture
2. **Lack standalone factory functions** - There's no way to create a fresh MCPServer, MCPMarketplaceEntry, or MCPServerConfig from scratch with just partial overrides
3. **Don't follow the established factory pattern** - The test-fixtures package uses `createTask(overrides, options)` pattern which is more flexible

## Decision

Implement factory functions for the three core marketplace entities following the established pattern from `test-fixtures/factories/task-factory.ts`:

1. **`createMCPServer`** - Factory for `MCPServer` (runtime server definition)
2. **`createMCPMarketplaceEntry`** - Factory for `MCPMarketplaceEntry` (package/marketplace entry)
3. **`createMCPServerConfig`** - Factory for `MCPServerConfig` (server configuration)

### Design Principles

1. **Standalone creation with sensible defaults** - Each factory should produce a valid, complete object without requiring any parameters
2. **Partial overrides support** - All properties should be overridable via a partial object
3. **Factory options** - Optional second parameter for factory-level configuration (e.g., preset variants)
4. **Full TypeScript typing** - Leverage the existing `FixtureFactory<T, TOptions>` type pattern
5. **Unique ID generation** - Factories should generate unique names/IDs when created
6. **Zod schema compatibility** - All generated objects should pass Zod schema validation

### API Design

```typescript
// Basic usage - creates with sensible defaults
const server = createMCPServer();
const entry = createMCPMarketplaceEntry();
const config = createMCPServerConfig();

// With overrides - customize specific fields
const customServer = createMCPServer({
  name: 'my-server',
  package: '@my-org/mcp-server',
  version: '2.0.0'
});

// With options - factory-level configuration
const prodConfig = createMCPServerConfig({}, {
  type: 'http',
  autoStart: true
});
```

### Factory Options Types

```typescript
export interface MCPServerFactoryOptions {
  /** Include default environment variables */
  includeEnv?: boolean;
  /** Include structured envVars array */
  includeEnvVars?: boolean;
}

export interface MCPServerConfigFactoryOptions {
  /** Connection type preset */
  type?: 'stdio' | 'http' | 'sse' | 'sdk';
  /** Whether to auto-start */
  autoStart?: boolean;
  /** Include environment variables */
  includeEnv?: boolean;
}

export interface MCPMarketplaceEntryFactoryOptions {
  /** Set verified status */
  verified?: boolean;
  /** Include default capabilities */
  includeCapabilities?: boolean;
}
```

### Default Values Strategy

Each factory provides sensible defaults that:
- Pass Zod schema validation
- Represent realistic test scenarios
- Generate unique identifiers using timestamp + random suffix pattern

#### MCPServer Defaults
```typescript
{
  name: 'test-server-{unique-id}',
  package: '@apex/test-mcp-server',
  command: 'npx',
  args: ['@apex/test-mcp-server'],
  env: {},
  envVars: [],
  version: '1.0.0'
}
```

#### MCPServerConfig Defaults
```typescript
{
  name: 'test-config-{unique-id}',
  type: 'stdio',
  command: 'npx',
  args: ['@apex/test-mcp-server'],
  autoStart: false
}
```

#### MCPMarketplaceEntry Defaults
```typescript
{
  name: 'test-marketplace-entry-{unique-id}',
  description: 'Test MCP server for testing purposes',
  version: '1.0.0',
  author: 'Test Author',
  homepage: 'https://example.com/test-server',
  repository: 'https://github.com/test/test-server',
  installCommand: 'npm install -g @apex/test-mcp-server',
  serverConfig: createMCPServerConfig(), // Uses config factory
  capabilities: ['tools'],
  verified: false
}
```

### Preset Collections

Following the `TaskPresets` pattern, provide organized preset collections:

```typescript
export const MCPServerPresets = {
  basic: {
    filesystem: () => createMCPServer({ name: 'filesystem-server', ... }),
    memory: () => createMCPServer({ name: 'memory-server', ... }),
    git: () => createMCPServer({ name: 'git-server', ... }),
  },
  configs: {
    stdio: () => createMCPServerConfig({}, { type: 'stdio' }),
    http: () => createMCPServerConfig({}, { type: 'http' }),
    sse: () => createMCPServerConfig({}, { type: 'sse' }),
  },
  marketplace: {
    verified: () => createMCPMarketplaceEntry({}, { verified: true }),
    unverified: () => createMCPMarketplaceEntry({}, { verified: false }),
    withCapabilities: () => createMCPMarketplaceEntry({
      capabilities: ['tools', 'resources', 'prompts']
    }),
  }
} as const;
```

### File Structure

```
packages/core/src/fixtures/
├── marketplace.ts          # Existing static fixtures + new factories
├── factories.ts            # New file: standalone factory functions
├── index.ts                # Updated exports
├── ADR-002-marketplace-factory-functions.md  # This document
└── __tests__/
    ├── marketplace.test.ts          # Existing tests
    ├── factories.test.ts            # New factory unit tests
    └── factories-integration.test.ts # Integration tests
```

### Integration with Existing Code

The new factory functions will:
1. Coexist with existing static fixtures (backward compatible)
2. Be exported from `fixtures/index.ts`
3. Follow the same JSDoc documentation pattern
4. Support the same override patterns as existing utilities

### Relationship to Existing Utilities

| Existing Function | New Factory | Difference |
|-------------------|-------------|------------|
| `createServerConfig(base, overrides)` | `createMCPServerConfig(overrides, options)` | No base required |
| `createMarketplaceEntry(base, overrides)` | `createMCPMarketplaceEntry(overrides, options)` | No base required |
| N/A | `createMCPServer(overrides, options)` | New capability |

The existing functions will remain for backward compatibility but the new factories are preferred for new tests.

## Consequences

### Positive
- **Cleaner test code** - No need to import and spread base fixtures
- **Consistent patterns** - Aligns with task-factory.ts patterns
- **Better type safety** - Full TypeScript inference on overrides
- **Unique IDs** - Each factory call produces unique identifiers
- **Schema validation** - Guaranteed to pass Zod validation
- **Presets available** - Quick access to common configurations

### Negative
- **Slight API duplication** - Existing `createServerConfig` and new `createMCPServerConfig` serve similar purposes
- **Migration effort** - Existing tests using old patterns may want to migrate

### Risks
- **Default value drift** - If schemas change, factory defaults may become stale
  - Mitigation: Factory tests validate against Zod schemas
- **Naming confusion** - `createServerConfig` vs `createMCPServerConfig`
  - Mitigation: JSDoc deprecation notices on old functions

## Implementation Plan

1. Create `factories.ts` with the three factory functions
2. Add factory option types to support customization
3. Create preset collections for common scenarios
4. Update `index.ts` to export new factories
5. Add comprehensive unit tests
6. Add integration tests with Zod schema validation
7. Update documentation

## Example Usage in Tests

```typescript
import {
  createMCPServer,
  createMCPServerConfig,
  createMCPMarketplaceEntry,
  MCPServerPresets
} from '@apex/core/fixtures';

describe('MCP Installation', () => {
  it('should install a server', async () => {
    // Simple case - factory with defaults
    const server = createMCPServer();
    expect(server.name).toContain('test-server');

    // Custom case - override specific fields
    const customServer = createMCPServer({
      name: 'postgres-server',
      package: '@modelcontextprotocol/server-postgres'
    });

    // Preset case - use predefined configuration
    const filesystemServer = MCPServerPresets.basic.filesystem();
    expect(filesystemServer.name).toBe('filesystem-server');
  });

  it('should validate marketplace entry', () => {
    const entry = createMCPMarketplaceEntry({
      verified: true,
      capabilities: ['tools', 'resources']
    });

    expect(MCPMarketplaceEntrySchema.safeParse(entry).success).toBe(true);
  });
});
```

## References

- `packages/core/src/test-fixtures/factories/task-factory.ts` - Pattern reference
- `packages/core/src/fixtures/marketplace.ts` - Existing fixtures
- `packages/core/src/types.ts` - Zod schemas for MCPServer, MCPServerConfig, MCPMarketplaceEntry
