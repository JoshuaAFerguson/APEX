# ADR 0008: MCPConfigurator Extension - addServer, removeServer, getConfig Methods

## Status
Proposed

## Context

The MCPConfigurator class in `packages/orchestrator/src/mcp/configurator.ts` currently provides:
- ✅ `generateConfig(format, servers)` - Generates configuration in specified format
- ✅ `generateClaudeDesktopConfig(servers)` - Generates claude_desktop_config.json format
- ✅ `exportConfig(format, outputPath, servers)` - Exports configuration to file
- ✅ `importConfig(source, format)` - Imports from external formats
- ✅ `validateConfig(config)` - Validates MCP configuration
- ✅ Template management methods

**Missing Methods Required by Acceptance Criteria:**
- ❌ `addServer(serverId, config)` - Add a new server to configuration
- ❌ `removeServer(serverId)` - Remove a server from configuration
- ❌ `getConfig()` - Get the current complete configuration

## Decision

### 1. Method Signatures

```typescript
/**
 * Add a new MCP server to the configuration
 * @param serverId - Unique identifier for the server
 * @param config - Server configuration (MCPServerConfig)
 * @param options - Optional settings
 * @returns The updated MCPConfig
 */
addServer(
  serverId: string,
  config: MCPServerConfig,
  options?: {
    validate?: boolean;      // Validate config before adding (default: true)
    overwrite?: boolean;     // Overwrite if exists (default: false)
    persist?: boolean;       // Persist to disk (default: false)
  }
): MCPConfig;

/**
 * Remove an MCP server from the configuration
 * @param serverId - Server identifier to remove
 * @param options - Optional settings
 * @returns The updated MCPConfig or null if server not found
 */
removeServer(
  serverId: string,
  options?: {
    persist?: boolean;       // Persist to disk (default: false)
  }
): MCPConfig | null;

/**
 * Get the current MCP configuration
 * @returns Current MCPConfig object
 */
getConfig(): MCPConfig;
```

### 2. Architecture Design

```
┌─────────────────────────────────────────────────────────────┐
│                     MCPConfigurator                          │
├─────────────────────────────────────────────────────────────┤
│ Private State:                                               │
│  - projectPath: string                                       │
│  - config: ApexConfig (readonly reference)                   │
│  - localMcpConfig: MCPConfig (mutable local state)          │
│  - templates: Map<string, MCPServerTemplate>                 │
│  - envDetector: EnvVarDetector                               │
│  - validator: ConfigValidator                                │
├─────────────────────────────────────────────────────────────┤
│ Existing Methods:                                            │
│  + generateConfig(format, servers)                           │
│  + generateClaudeDesktopConfig(servers)                      │
│  + exportConfig(format, outputPath, servers)                 │
│  + importConfig(source, format)                              │
│  + validateConfig(config)                                    │
│  + detectEnvironmentVariables(serverId)                      │
│  + getServerTemplates(category?)                             │
│  + generateFromTemplate(templateId, overrides?)              │
│  + registerTemplate(template)                                │
├─────────────────────────────────────────────────────────────┤
│ NEW Methods:                                                 │
│  + addServer(serverId, config, options?)                     │
│  + removeServer(serverId, options?)                          │
│  + getConfig()                                               │
├─────────────────────────────────────────────────────────────┤
│ Events:                                                      │
│  + 'config:generated'                                        │
│  + 'config:validated'                                        │
│  + 'config:applied'                                          │
│  + 'env:detected'                                            │
│  + 'env:missing'                                             │
│  + 'server:added'      (NEW)                                 │
│  + 'server:removed'    (NEW)                                 │
└─────────────────────────────────────────────────────────────┘
```

### 3. State Management Strategy

The current implementation uses `this.config.mcp` (from ApexConfig) as the source of truth. Since ApexConfig is passed as a readonly reference, we need to manage modifications carefully:

**Approach: Copy-on-Write with Local State**
1. Initialize `this.localMcpConfig` from `this.config.mcp` in constructor
2. `addServer()` and `removeServer()` modify `this.localMcpConfig`
3. `getConfig()` returns `this.localMcpConfig`
4. `generateConfig()` uses `this.localMcpConfig` instead of `this.config.mcp`
5. Optional `persist` flag writes changes back to disk via config loader

### 4. Event Additions

```typescript
// New events to add to MCPConfiguratorEvents interface
export interface MCPConfiguratorEvents {
  // ... existing events ...
  'server:added': (data: { serverId: string; config: MCPServerConfig }) => void;
  'server:removed': (data: { serverId: string }) => void;
}
```

### 5. Error Handling

```typescript
// Error conditions to handle:
class MCPConfiguratorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'SERVER_EXISTS'      // addServer with overwrite=false
      | 'SERVER_NOT_FOUND'   // removeServer for non-existent
      | 'VALIDATION_FAILED'  // addServer with invalid config
      | 'PERSIST_FAILED',    // Failed to save to disk
    public readonly serverId?: string
  ) {
    super(message);
    this.name = 'MCPConfiguratorError';
  }
}
```

### 6. Implementation Plan

#### Phase 1: Core Method Implementation (Developer Stage)
1. Add `localMcpConfig` private field
2. Initialize from `config.mcp` in constructor
3. Update existing methods to use `localMcpConfig`
4. Implement `getConfig()` method
5. Implement `addServer()` method
6. Implement `removeServer()` method
7. Add new events to interface

#### Phase 2: Persistence Support (Developer Stage)
1. Add optional `persist` parameter to methods
2. Implement `persistConfig()` helper method
3. Integrate with config loading system (from @apexcli/core)

#### Phase 3: Testing (Tester Stage)
1. Unit tests for `getConfig()`
2. Unit tests for `addServer()` with all option combinations
3. Unit tests for `removeServer()` with all option combinations
4. Event emission tests
5. Error condition tests
6. Integration tests with template system

### 7. Format Support

The implementation supports generating configurations for multiple MCP client formats:

| Format | Output | Notes |
|--------|--------|-------|
| `apex` | MCPConfig | Native APEX format |
| `claude-desktop` | ClaudeDesktopConfig | claude_desktop_config.json format (stdio only) |
| `json` | MCPConfig | Standard JSON export |

## Consequences

### Positive
- Complete CRUD operations for MCP server management
- Event-driven architecture for UI/CLI updates
- Maintains backward compatibility with existing methods
- Clean separation between in-memory state and persistence
- Supports both Claude Desktop and other MCP client formats

### Negative
- Adds state management complexity
- Config drift possible if external modifications occur
- Persistence feature requires integration with core config loader

### Risks
- Race conditions if multiple configurator instances exist
- Memory overhead for large configurations

## Files to Modify

1. `packages/orchestrator/src/mcp/configurator.ts` - Add methods and state
2. `packages/orchestrator/src/mcp/configurator.test.ts` - Add tests
3. `packages/orchestrator/src/mcp/index.ts` - Export any new types

## References

- MCPConfig schema: `packages/core/src/types.ts` line 2395
- MCPServerConfig schema: `packages/core/src/types.ts` line 2339
- Existing MCPConfigurator: `packages/orchestrator/src/mcp/configurator.ts`
