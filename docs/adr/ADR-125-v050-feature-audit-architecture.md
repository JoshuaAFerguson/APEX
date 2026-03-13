# ADR-125: v0.5.0 Feature Audit - Technical Architecture Design

## Status

Accepted

## Date

2026-03-10

## Context

APEX v0.5.0 introduces four major feature categories that require comprehensive audit verification:
1. **Autonomy Controls** - Budget/token/time limits, approval gates, autonomy levels
2. **Code Quality Integration** - Lint-after-edit, auto-fix, pre-edit validation
3. **Tool Extensions** - Custom tools registration, tool hooks, tool plugin system
4. **MCP Features** - MCP server integration, marketplace, tool discovery

This ADR documents the architecture audit findings and verification approach for these features.

---

## 1. Autonomy Controls Architecture

### 1.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ApexOrchestrator                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │  AutonomyEnforcer   │◄───│  PolicyEngine       │                     │
│  │  - checkAction()    │    │  - evaluateRules()  │                     │
│  │  - checkLimits()    │    │  - checkViolations()│                     │
│  │  - recordUsage()    │    └─────────────────────┘                     │
│  └─────────┬───────────┘                                                │
│            │                                                             │
│  ┌─────────▼───────────┐    ┌─────────────────────┐                     │
│  │ ApprovalGateCtrl    │◄───│  TaskStore (SQLite) │                     │
│  │ - requestApproval() │    │  - saveApprovalState│                     │
│  │ - resolveApproval() │    │  - updateUsage()    │                     │
│  └─────────────────────┘    └─────────────────────┘                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     UI Components (Ink/React)                     │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │   │
│  │  │  ApprovalGate   │  │  LimitWarning   │  │ ResourceDashboard│ │   │
│  │  │  - A/D keys     │  │  - progress bar │  │  - all metrics   │ │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Type Definitions (Verified)

**Location**: `packages/core/src/types.ts`

| Schema | Lines | Status |
|--------|-------|--------|
| `AutonomyLevelSchema` | 1495-1500 | ✅ Verified |
| `ApprovalCheckpointTypeSchema` | 1541-1556 | ✅ Verified |
| `ApprovalGateSchema` | 1558-1582 | ✅ Verified |
| `TaskResourceLimitsSchema` | 1588-1610 | ✅ Verified |
| `AutonomyConfigSchema` | 1612-1680 | ✅ Verified |

**Autonomy Levels**:
- `full-auto` - No approval checkpoints
- `review-before-commit` - Pause for git commit/push/deploy
- `review-all` - Pause for all non-read operations

**Resource Limits**:
- `maxCost` (USD), `maxTokens`, `maxTimeMs`
- `maxFilesCreated`, `maxFilesModified`, `maxFilesDeleted`
- `maxLinesChanged`, `maxTurns`, `dailyBudget`, `maxConcurrentTasks`

### 1.3 Implementation Files (Verified)

| Component | File | Status |
|-----------|------|--------|
| AutonomyEnforcer | `packages/orchestrator/src/autonomy-enforcer.ts` | ✅ Implemented |
| ApprovalGateController | `packages/orchestrator/src/approval-gate-controller.ts` | ✅ Implemented |
| PolicyEngine | `packages/orchestrator/src/policy-engine.ts` | ✅ Implemented |
| PolicyEnforcer | `packages/orchestrator/src/policy/policy-enforcer.ts` | ✅ Implemented |
| ApprovalGate UI | `packages/cli/src/ui/components/autonomy/ApprovalGate.tsx` | ✅ Implemented |
| LimitWarning UI | `packages/cli/src/ui/components/autonomy/LimitWarning.tsx` | ✅ Implemented |

### 1.4 Test Coverage (Verified)

| Test Category | File | Status |
|---------------|------|--------|
| Zod Schema Validation | `packages/core/src/__tests__/autonomy-control-types.test.ts` | ✅ EXISTS |
| Resource Limit Tracking | `packages/orchestrator/src/resource-limit-tracking.test.ts` | ✅ EXISTS |
| Approval Gate Flow | `packages/orchestrator/src/__tests__/approval-gate-controller.integration.test.ts` | ✅ EXISTS |
| Autonomy Levels | `packages/orchestrator/src/__tests__/autonomy-enforcement-comprehensive.test.ts` | ✅ EXISTS |
| Edge Cases | `packages/orchestrator/src/__tests__/autonomy-enforcer-edge-cases.test.ts` | ✅ EXISTS |
| Timeout Handling | `packages/orchestrator/src/__tests__/approval-timeout-basic.test.ts` | ✅ EXISTS |

### 1.5 Audit Verification Criteria

- [x] AutonomyLevel enum has all 3 levels defined
- [x] Legacy level migration supported (full→full-auto, manual→review-all)
- [x] ApprovalGate supports 7 checkpoint types
- [x] TaskResourceLimits supports 10 limit fields
- [x] AutonomyEnforcer enforces level-specific behavior
- [x] ApprovalGateController manages approval lifecycle with timeouts
- [x] UI components support keyboard interactions (A/D keys)
- [x] Test coverage comprehensive across all scenarios

---

## 2. Code Quality Integration Architecture

### 2.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Hook System                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  PostToolUse Hooks (FILE_MODIFYING_TOOLS: Write,Edit,MultiEdit,Notebook)│
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. recordFileModifyingToolAction                               │    │
│  │  2. lintAfterEdit ◄── Primary code quality hook                 │    │
│  │  3. runTypecheckAfterEdit                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  PreToolUse Hooks                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. captureFileSnapshot (for rollback)                          │    │
│  │  2. validatePreEditSyntax (JSON/YAML validation)                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LinterService                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ ESLintPlugin  │  │PrettierPlugin │  │ CustomPlugins │               │
│  │ - execute()   │  │ - execute()   │  │ - execute()   │               │
│  │ - fix()       │  │ - fix()       │  │ - fix()       │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Fix Conflict Detection                        │   │
│  │  - Identifies overlapping fix ranges                             │   │
│  │  - Applies non-conflicting fixes in batches                      │   │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Type Definitions (Verified)

**Location**: `packages/core/src/types.ts`

| Schema | Lines | Status |
|--------|-------|--------|
| `LinterGlobalConfigSchema` | 2396-2420 | ✅ Verified |
| `LinterConfigSchema` | 2460-2498 | ✅ Verified |
| `PreEditValidationConfigSchema` | 2507-2511 | ✅ Verified |
| `TypecheckConfigSchema` | 2513-2520 | ✅ Verified |
| `CodeQualityConfigSchema` | 2541-2547 | ✅ Verified |

**Key Configuration Options**:
```yaml
linter:
  global:
    enabled: true
    runAfterEdit: true  # Triggers lint-after-edit
  eslint:
    autoFix: true
  prettier:
    autoFix: true

codeQuality:
  preEditValidation:
    enabled: true
    mode: 'warn' | 'block'
  typecheck:
    enabled: true
    runAfterEdit: true
```

### 2.3 Implementation Files (Verified)

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| lintAfterEdit Hook | `packages/orchestrator/src/hooks.ts` | 899-948 | ✅ Implemented |
| validatePreEditSyntax Hook | `packages/orchestrator/src/hooks.ts` | 815-897 | ✅ Implemented |
| runTypecheckAfterEdit Hook | `packages/orchestrator/src/hooks.ts` | 989-1067 | ✅ Implemented |
| LinterService | `packages/orchestrator/src/linter/service.ts` | Full | ✅ Implemented |
| ESLintPlugin | `packages/orchestrator/src/linter/plugins/eslint.ts` | Full | ✅ Implemented |
| Auto-Fix Logic | `packages/orchestrator/src/linter/service.ts` | 817-904 | ✅ Implemented |
| Import Auto-Fixer | `packages/orchestrator/src/import-auto-fixer/` | Full | ✅ Implemented |

### 2.4 Data Flow

```
1. Agent calls Edit/Write tool
         │
         ▼
2. PreToolUse: captureFileSnapshot (stores original)
         │
         ▼
3. PreToolUse: validatePreEditSyntax
   ├── JSON/YAML validation
   └── Mode: 'warn' (log) or 'block' (deny)
         │
         ▼
4. Tool executes (file modified)
         │
         ▼
5. PostToolUse: lintAfterEdit
   ├── Check: config.linter.global.runAfterEdit == true
   ├── Execute LinterService with modified files
   ├── Aggregate results from all plugins
   ├── If autoFix enabled: apply fixes
   └── Log errors to TaskStore
         │
         ▼
6. PostToolUse: runTypecheckAfterEdit
   ├── Execute typecheck command
   └── Parse TypeScript errors
```

### 2.5 Test Coverage (Verified)

| Test Category | File | Status |
|---------------|------|--------|
| Lint-After-Edit | `packages/orchestrator/src/hooks-lint-after-edit.test.ts` | ✅ EXISTS |
| LinterService | `packages/orchestrator/src/linter/service.test.ts` | ✅ EXISTS |
| ESLint Plugin | `packages/orchestrator/src/linter/plugins/eslint.test.ts` | ✅ EXISTS |
| Prettier Plugin | `packages/orchestrator/src/linter/plugins/PrettierPlugin.test.ts` | ✅ EXISTS |

### 2.6 Audit Verification Criteria

- [x] lintAfterEdit hook triggers on Write/Edit/MultiEdit/NotebookEdit
- [x] Pre-edit validation blocks invalid JSON/YAML when mode='block'
- [x] Auto-fix applies ESLint/Prettier fixes automatically
- [x] Fix conflict detection prevents overlapping fix ranges
- [x] TypeScript type checking integration available
- [x] Configuration schema supports all documented options
- [x] Test coverage exists for hook behavior

---

## 3. Tool Extensions Architecture

### 3.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Tool Registration                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     ToolRegistry (Singleton)                     │   │
│  │  - register(tool: ToolInterface)                                │   │
│  │  - unregister(name: string)                                     │   │
│  │  - getAll(): ToolRegistryEntry[]                                │   │
│  │  - setAvailability(name, available, reason)                     │   │
│  │  - recordInvocation(name, success)                              │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    BaseTool<TInput, TOutput>                     │   │
│  │  - getDefinition(): ToolDefinition                              │   │
│  │  - validate(params): ValidationResult                           │   │
│  │  - execute(params, context): ToolResult                         │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  Custom Tools Builder                            │   │
│  │  buildCustomToolsServer(tools: CustomToolConfig[])              │   │
│  │  - Parameter interpolation: {{input.property}}                  │   │
│  │  - Output parsing: json | text | lines                          │   │
│  │  - Command execution with timeout                               │   │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Type Definitions (Verified)

**Location**: `packages/core/src/types.ts`

| Schema | Lines | Status |
|--------|-------|--------|
| `CustomToolConfigSchema` | 1072-1109 | ✅ Verified |
| `ToolHookDefinitionSchema` | 9033-9069 | ✅ Verified |
| `ToolHookConfigSchema` | 9071-9078 | ✅ Verified |
| `PreHookContextSchema` | 9098-9108 | ✅ Verified |
| `PreHookResultSchema` | 9110-9127 | ✅ Verified |
| `PostHookContextSchema` | 9151-9170 | ✅ Verified |
| `ToolExecutionHooks` | 9884-9979 | ✅ Verified |

**CustomToolConfig Interface**:
```typescript
{
  name: string;                    // Unique tool identifier (1-64 chars)
  description: string;             // Human-readable description
  command: string;                 // Command to execute
  args?: string[];                 // Arguments with interpolation
  parameters?: ToolParametersSchema; // JSON Schema for parameters
  outputParser?: 'json' | 'text' | 'lines';
  timeoutMs?: number;              // Default: 60000ms
  workingDirectory?: string;
  env?: Record<string, string>;
  enabled?: boolean;               // Default: true
}
```

**Tool Hooks**:
- `pre` - Before tool execution, can modify args or cancel
- `post` - After execution, receives result

### 3.3 Implementation Files (Verified)

| Component | File | Status |
|-----------|------|--------|
| ToolRegistry | `packages/core/src/tools/tool-registry.ts` | ✅ Implemented |
| BaseTool | `packages/core/src/tools/base-tool.ts` | ✅ Implemented |
| Custom Tools Server | `packages/orchestrator/src/custom-tools.ts` | ✅ Implemented |
| Hook Execution | `packages/orchestrator/src/hooks.ts` | ✅ Implemented |
| MCP Tool Registry | `packages/orchestrator/src/mcp-tool-registry.ts` | ✅ Implemented |
| Schema Translator | `packages/orchestrator/src/schema-translator.ts` | ✅ Implemented |

### 3.4 Custom Tool Configuration Example

```yaml
# .apex/config.yaml
tools:
  custom:
    - name: 'run-mypy'
      description: 'Run MyPy type checker on Python files'
      command: 'mypy'
      args: ['{{input.path}}', '--strict']
      parameters:
        type: object
        properties:
          path:
            type: string
            description: 'File or directory to check'
        required: ['path']
      outputParser: 'lines'
      timeoutMs: 30000
      enabled: true
```

### 3.5 Test Coverage (Verified)

| Test Category | File | Status |
|---------------|------|--------|
| Tool Registry | `packages/core/src/__tests__/tools/tool-registry.test.ts` | ✅ EXISTS |
| BaseTool | `packages/core/src/__tests__/tools/base-tool.test.ts` | ✅ EXISTS |
| Custom Tool Fixtures | `packages/core/src/__tests__/fixtures/custom-tools/` | ✅ EXISTS |
| Schema Translator | `packages/orchestrator/src/schema-translator.test.ts` | ✅ EXISTS |

### 3.6 Audit Verification Criteria

- [x] ToolRegistry singleton provides registration/discovery
- [x] BaseTool abstract class enables custom implementations
- [x] CustomToolConfig schema supports all documented fields
- [x] Tool hooks support pre/post execution interception
- [x] Parameter interpolation with `{{input.property}}` syntax
- [x] Output parsing supports json/text/lines modes
- [x] Timeout and working directory configuration
- [x] Test fixtures exist for validation

---

## 4. MCP Ecosystem Architecture

### 4.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MCP Integration Layer                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    MCPConnectionManager                          │   │
│  │  - connect(server): Promise<MCPConnection>                      │   │
│  │  - disconnect(connectionId)                                     │   │
│  │  - discoverServers(): Promise<MCPServerConfig[]>                │   │
│  │  - Health checking with exponential backoff                     │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         MCPClient                                │   │
│  │  - listTools(): Promise<MCPTool[]>                              │   │
│  │  - callTool(name, args): Promise<ToolResult>                    │   │
│  │  - ping(): Promise<void>                                        │   │
│  │  JSON-RPC 2.0 protocol, connection pooling                      │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     MCPToolRegistry                              │   │
│  │  - addConnection(connection)                                    │   │
│  │  - getAllTools(): MCPToolRegistryEntry[]                        │   │
│  │  - getAvailableTools(): filtered by connection state            │   │
│  │  - Auto-refresh with configurable intervals                     │   │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        MCP Marketplace                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       MCPRegistry (Core)                         │   │
│  │  - listServers(options): MCPMarketplaceEntry[]                  │   │
│  │  - getServer(name): MCPMarketplaceEntry                         │   │
│  │  - getCategories(): category listing                            │   │
│  │  - Catalog loading from bundled JSON                            │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  MCPMarketplaceService                           │   │
│  │  - loadMarketplaceData()                                        │   │
│  │  - getMarketplaceEntries(filter)                                │   │
│  │  - getFeaturedEntries()                                         │   │
│  │  - getInstallationRecommendations()                             │   │
│  │  - Category-based filtering                                     │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       MCPInstaller                               │   │
│  │  - install(name | MCPServer): Promise<void>                     │   │
│  │  - uninstall(name): Promise<void>                               │   │
│  │  - listInstalled(): MCPInstallation[]                           │   │
│  │  - Rollback on failure, SQLite tracking                         │   │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      MCPConfigurator                             │   │
│  │  - generateConfig(format): config object                        │   │
│  │  - addServer(config): void                                      │   │
│  │  - removeServer(name): void                                     │   │
│  │  - Formats: apex, claude-desktop, json                          │   │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Type Definitions (Verified)

**Location**: `packages/core/src/types.ts`

| Schema | Lines | Status |
|--------|-------|--------|
| `MCPServerConfigSchema` | 3373-3397 | ✅ Verified |
| `MCPMarketplaceEntrySchema` | 3403-3425 | ✅ Verified |
| `MCPMarketplaceSourceSchema` | 3427-3433 | ✅ Verified |
| `MCPMarketplaceSchema` | 3435-3447 | ✅ Verified |
| `MCPToolsConfigSchema` | 3454-3482 | ✅ Verified |
| `MCPConfigSchema` | 3484-3499 | ✅ Verified |

**MCPServerConfig Types**:
- `stdio` - Process-based communication
- `http` - HTTP REST API
- `sse` - Server-Sent Events
- `sdk` - Claude Agent SDK integration

**MCPMarketplaceEntry Fields**:
```typescript
{
  name: string;
  description: string;
  version: string;
  author: string;
  homepage?: string;
  repository?: string;
  installCommand: string;
  serverConfig: MCPServerConfig;
  capabilities: string[];
  verified: boolean;
}
```

### 4.3 Implementation Files (Verified)

| Component | File | Status |
|-----------|------|--------|
| MCPClient | `packages/orchestrator/src/mcp/client.ts` | ✅ Implemented |
| MCPConnectionManager | `packages/orchestrator/src/mcp/connection-manager.ts` | ✅ Implemented |
| MCPServerManager | `packages/orchestrator/src/mcp/server-manager.ts` | ✅ Implemented |
| MCPMarketplaceService | `packages/orchestrator/src/mcp/marketplace-service.ts` | ✅ Implemented |
| MCPRegistry | `packages/core/src/mcp/mcp-registry.ts` | ✅ Implemented |
| MCPInstaller | `packages/orchestrator/src/mcp-installer.ts` | ✅ Implemented |
| MCPConfigurator | `packages/orchestrator/src/mcp/configurator.ts` | ✅ Implemented |
| MCPToolRegistry | `packages/orchestrator/src/mcp-tool-registry.ts` | ✅ Implemented |
| SchemaTranslator | `packages/orchestrator/src/schema-translator.ts` | ✅ Implemented |

### 4.4 Installation Flow

```
1. Browse marketplace (MCPRegistry.listServers)
         │
         ▼
2. Search/filter (category, verified, capabilities)
         │
         ▼
3. Select server → get details (MCPRegistry.getServer)
         │
         ▼
4. Install (MCPInstaller.install)
   ├── Execute npm install command
   ├── Create config file
   ├── Record in SQLite database
   └── On failure: rollback all changes
         │
         ▼
5. Configure (MCPConfigurator.addServer)
   └── Add to project .apex/config.yaml
         │
         ▼
6. Connect (MCPConnectionManager.connect)
   └── Establish connection, discover tools
         │
         ▼
7. Discover tools (MCPToolRegistry.addConnection)
   ├── Call listTools() on server
   ├── Translate schemas to Claude SDK format
   └── Register in tool registry
```

### 4.5 Test Coverage (Verified)

| Test Category | File | Status |
|---------------|------|--------|
| MCPRegistry | `packages/core/src/__tests__/mcp-registry.test.ts` | ✅ EXISTS |
| MCPRegistry Edge Cases | `packages/core/src/__tests__/mcp-registry.edge-cases.test.ts` | ✅ EXISTS |
| MCPInstaller | `packages/orchestrator/src/__tests__/mcp-installer.test.ts` | ✅ EXISTS |
| MCPInstaller Rollback | `packages/orchestrator/src/__tests__/mcp-installer-rollback.test.ts` | ✅ EXISTS |
| MCPConfigurator | `packages/orchestrator/src/mcp/configurator.test.ts` | ✅ EXISTS |
| MCPConfigurator Integration | `packages/orchestrator/src/mcp/configurator.integration.test.ts` | ✅ EXISTS |
| CLI Commands | `packages/cli/src/__tests__/mcp-marketplace-*.test.ts` | ✅ EXISTS |
| API Endpoints | `packages/api/src/__tests__/mcp-*.test.ts` | ✅ EXISTS |

### 4.6 Current Issues (Roadmap 🟡 Items)

Based on ROADMAP.md analysis, these MCP features have known issues:

| Feature | Issue | Status |
|---------|-------|--------|
| MCP Marketplace | Error handling incomplete | 🟡 In Progress |
| Easy Install | MCP server integration broken | 🟡 In Progress |
| Auto-configuration | Install error events not properly broadcast | 🟡 In Progress |

### 4.7 Audit Verification Criteria

- [x] MCPRegistry loads catalog and supports filtering
- [x] MCPInstaller handles install/uninstall with rollback
- [x] MCPConfigurator generates configs for multiple formats
- [x] MCPToolRegistry discovers tools from connected servers
- [x] SchemaTranslator converts MCP schemas to Zod
- [x] Event emission for connection lifecycle
- [x] Comprehensive test coverage across packages
- [ ] Error handling for marketplace operations (known issue)
- [ ] WebSocket event broadcasting for install status (known issue)

---

## 5. Cross-Cutting Architecture Concerns

### 5.1 Event System

All major components use EventEmitter for lifecycle events:

```typescript
// AutonomyEnforcer events
'limit:warning'   // { metric, value, limit, percentage }
'limit:exceeded'  // { metric, value, limit, percentage }
'approval:required' // { action, context }

// ApprovalGateController events
'approval:requested'
'approval:resolved'
'approval:timeout'

// LinterService events
'execution:started'
'execution:completed'
'linter:issue'
'fix:applied'

// MCPToolRegistry events
'tool:registered'
'tool:unregistered'
'connection:added'
'connection:removed'
```

### 5.2 Configuration Hierarchy

```yaml
# .apex/config.yaml
autonomy:
  level: 'review-before-commit'
  limits:
    maxTokens: 500000
    maxCost: 5.0
  gates:
    - type: 'before-commit'
      required: true

linter:
  global:
    enabled: true
    runAfterEdit: true
  eslint:
    autoFix: true

codeQuality:
  preEditValidation:
    enabled: true
    mode: 'warn'

tools:
  custom:
    - name: 'my-tool'
      command: 'my-command'

mcp:
  enabled: true
  servers:
    - name: 'filesystem'
      type: 'stdio'
      command: 'npx'
      args: ['@anthropic/mcp-server-filesystem']
```

### 5.3 Storage Layer

All persistence uses SQLite via TaskStore:

- **Approval states**: `approval_states` table
- **Resource usage**: `task_usage` table
- **MCP installations**: `mcp_installations` table
- **Permissions**: `permissions` table

---

## 6. Summary

### 6.1 Verification Status

| Feature Category | Implementation | Tests | Documentation |
|-----------------|---------------|-------|---------------|
| Autonomy Controls | ✅ Complete | ✅ Comprehensive | ✅ ADR-031 |
| Code Quality Integration | ✅ Complete | ✅ Good | ✅ ADR-065 |
| Tool Extensions | ✅ Complete | ✅ Good | ✅ In Types |
| MCP Ecosystem | ⚠️ 3 Known Issues | ✅ Comprehensive | ✅ ADR-070 |

### 6.2 Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| Autonomy levels verified | ✅ PASS |
| Lint-after-edit verified | ✅ PASS |
| Custom tools verified | ✅ PASS |
| MCP marketplace verified | ⚠️ PARTIAL (3 issues noted) |
| Real implementation verification | ✅ PASS |

### 6.3 Recommendations

1. **Fix MCP Issues**: Address the 3 known issues in MCP Ecosystem before v0.5.0 final
2. **Additional Testing**: Add E2E tests for full marketplace→install→configure→connect flow
3. **Documentation**: Update user documentation with configuration examples
4. **Performance**: Consider caching for frequently accessed MCP catalog data

---

## References

- ADR-031: Autonomy Controls Comprehensive Testing Architecture
- ADR-065: Code Quality Integration - Lint-After-Edit and Auto-Fix
- ADR-070: MCP Marketplace Test Architecture
- ROADMAP.md: v0.5.0 - Tool System & Permissions section
- `packages/core/src/types.ts`: All Zod schema definitions
