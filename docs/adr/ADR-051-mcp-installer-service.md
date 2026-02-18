# ADR-051: MCP Installer Service Architecture

## Status
Proposed

## Context

The APEX platform needs a one-click installation mechanism for MCP (Model Context Protocol) servers. This feature will allow users to easily install, uninstall, and manage npm/npx-based MCP servers from a marketplace.

### Current State

The codebase already has several MCP-related components:

1. **`MCPServerManager`** (`packages/orchestrator/src/mcp/server-manager.ts`)
   - Manages MCP server configurations
   - Fetches marketplace entries from remote/local sources
   - Basic `installServer(name)` method that adds config to YAML

2. **`TaskStore`** (`packages/orchestrator/src/store.ts`)
   - SQLite database with existing tables:
     - `mcp_marketplace` - Caches marketplace entries
     - `mcp_servers` - Tracks installed server configurations
   - Methods: `upsertMcpMarketplaceEntry`, `listMcpMarketplaceEntries`, `getMcpMarketplaceEntry`, `upsertMcpServerConfig`, `listMcpServerConfigs`

3. **Core Types** (`packages/core/src/types.ts`)
   - `MCPServer` - Server definition with name, package, description, version
   - `MCPInstallation` - Installation record with id, serverId, installedAt, status, configPath
   - `MCPInstallationStatus` - Enum: pending, installing, installed, failed, uninstalling, uninstalled
   - `MCPServerConfig` - Runtime configuration for servers
   - `MCPMarketplaceEntry` - Marketplace listing with installCommand

### Gap Analysis

While the infrastructure exists, the current implementation lacks:
1. A dedicated installer service with proper lifecycle management
2. Actual npm/npx command execution for package installation
3. Installation status tracking in SQLite
4. Uninstall capability
5. Error handling and rollback mechanisms
6. Installation progress events

## Decision

We will create a new **`MCPInstaller`** class in `@apex/orchestrator` that provides a complete installation lifecycle for npm/npx-based MCP servers.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCPInstaller                                 │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ install(name)   │  │ uninstall(name)  │  │ listInstalled()   │  │
│  └────────┬────────┘  └────────┬─────────┘  └─────────┬─────────┘  │
│           │                    │                       │            │
│           ▼                    ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Installation Manager                      │   │
│  │  - Validates marketplace entries                            │   │
│  │  - Executes npm/npx commands                                │   │
│  │  - Manages installation state transitions                   │   │
│  │  - Emits progress events                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                    │                       │            │
│           ▼                    ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      MCPInstallStore                         │   │
│  │  - Persists installation records to SQLite                  │   │
│  │  - Tracks installation status                               │   │
│  │  - Stores configuration paths                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │     MCPServerManager     │
                    │  (Config management)     │
                    └──────────────────────────┘
```

### Class Design

#### MCPInstaller Interface

```typescript
export interface MCPInstallerOptions {
  projectPath: string;
  store: TaskStore;
  serverManager: MCPServerManager;
}

export interface MCPInstallerEvents {
  'install:start': (data: { name: string; serverId: string }) => void;
  'install:progress': (data: { name: string; message: string; phase: InstallPhase }) => void;
  'install:complete': (data: { name: string; installation: MCPInstallation }) => void;
  'install:failed': (data: { name: string; error: Error }) => void;
  'uninstall:start': (data: { name: string }) => void;
  'uninstall:complete': (data: { name: string }) => void;
  'uninstall:failed': (data: { name: string; error: Error }) => void;
}

export type InstallPhase =
  | 'validating'
  | 'downloading'
  | 'installing'
  | 'configuring'
  | 'verifying';

export class MCPInstaller extends EventEmitter<MCPInstallerEvents> {
  constructor(options: MCPInstallerOptions);

  /**
   * Install an MCP server from the marketplace
   * @param name - Name of the MCP server to install
   * @returns The installation record
   */
  async install(name: string): Promise<MCPInstallation>;

  /**
   * Uninstall an MCP server
   * @param name - Name of the MCP server to uninstall
   */
  async uninstall(name: string): Promise<void>;

  /**
   * List all installed MCP servers
   * @returns Array of installation records with their configurations
   */
  async listInstalled(): Promise<MCPInstallation[]>;

  /**
   * Get installation status for a specific server
   * @param name - Name of the MCP server
   */
  async getInstallation(name: string): Promise<MCPInstallation | null>;

  /**
   * Check if a server is installed
   * @param name - Name of the MCP server
   */
  async isInstalled(name: string): Promise<boolean>;
}
```

### Database Schema Updates

Add new table for tracking installations (extends existing `mcp_servers` table):

```sql
CREATE TABLE IF NOT EXISTS mcp_installations (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled')),
  installed_at TEXT,
  updated_at TEXT NOT NULL,
  config_path TEXT NOT NULL,
  package_name TEXT,
  package_version TEXT,
  install_command TEXT,
  error_message TEXT,
  FOREIGN KEY (server_id) REFERENCES mcp_marketplace(name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_installations_status ON mcp_installations(status);
CREATE INDEX IF NOT EXISTS idx_mcp_installations_name ON mcp_installations(name);
```

### Installation Flow

```
1. install("filesystem")
   │
   ├─► Validate marketplace entry exists
   │   └─► Emit 'install:start'
   │
   ├─► Create installation record (status: 'pending')
   │   └─► Emit 'install:progress' (phase: 'validating')
   │
   ├─► Execute npm/npx install command
   │   ├─► Emit 'install:progress' (phase: 'downloading')
   │   └─► Emit 'install:progress' (phase: 'installing')
   │
   ├─► Update config.yaml via MCPServerManager
   │   └─► Emit 'install:progress' (phase: 'configuring')
   │
   ├─► Verify installation (optional health check)
   │   └─► Emit 'install:progress' (phase: 'verifying')
   │
   ├─► Update installation record (status: 'installed')
   │   └─► Emit 'install:complete'
   │
   └─► On error:
       ├─► Update installation record (status: 'failed')
       ├─► Rollback if possible
       └─► Emit 'install:failed'
```

### npm/npx Command Execution

The installer supports multiple installation patterns:

1. **npx-based servers** (most common):
   ```bash
   # No npm install needed, just configure
   npx @modelcontextprotocol/server-filesystem
   ```

2. **Global npm packages**:
   ```bash
   npm install -g @modelcontextprotocol/server-memory
   ```

3. **Local project dependencies**:
   ```bash
   npm install @modelcontextprotocol/server-fetch --save-dev
   ```

4. **Custom install commands** (from marketplace entry):
   ```bash
   # Marketplace entry.installCommand is executed directly
   npx -y @example/mcp-server setup
   ```

### Error Handling Strategy

| Error Type | Handling | Recovery |
|------------|----------|----------|
| Network failure | Retry 3x with backoff | Mark as 'failed', user can retry |
| npm install failure | Log output, no retry | Mark as 'failed', cleanup partial |
| Config write failure | Immediate fail | Rollback npm install if possible |
| Validation failure | Immediate fail | No cleanup needed |

### Integration Points

1. **ApexOrchestrator** - Can use MCPInstaller to auto-install required MCP servers
2. **CLI** - `apex mcp install <name>` command
3. **API** - REST endpoint for installation management
4. **MCPServerManager** - Configuration updates after installation

## Consequences

### Positive
- Clean separation of concerns (installation vs. configuration)
- Full installation lifecycle tracking
- Event-driven progress reporting
- SQLite persistence for crash recovery
- Support for various npm installation patterns

### Negative
- Additional complexity in the MCP module
- Requires npm/npx to be available in the environment
- Installation state can become stale if npm operations happen outside APEX

### Risks
- npm registry availability affects installation success
- Package version conflicts possible in project context
- Windows vs Unix command execution differences

## Implementation Notes

### File Structure
```
packages/orchestrator/src/mcp/
├── index.ts           # Add MCPInstaller export
├── installer.ts       # NEW: MCPInstaller class
├── installer.test.ts  # NEW: Unit tests
├── server-manager.ts  # Existing: No changes needed
├── client.ts          # Existing: MCP client
└── types.ts           # Add InstallPhase type if needed
```

### Dependencies
- No new external dependencies required
- Uses existing `child_process.exec` pattern from `server-manager.ts`
- Uses existing `TaskStore` for SQLite operations

### Testing Strategy
1. Unit tests with mocked npm/npx execution
2. Integration tests with real npm install (in CI)
3. Error scenario tests (network failure, invalid package)

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [npm programmatic API](https://docs.npmjs.com/cli)
- Existing `MCPServerManager` implementation
- `TaskStore` SQLite patterns
