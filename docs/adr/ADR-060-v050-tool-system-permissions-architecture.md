# ADR-060: v0.5.0 Tool System & Permissions - Technical Architecture

**Date**: 2026-01-02
**Status**: Proposed
**Author**: Architect Agent
**Version**: 0.5.0

## Executive Summary

This ADR defines the comprehensive technical architecture for APEX v0.5.0, focusing on the Tool System & Permissions feature set. The design builds upon existing infrastructure (tools, permissions, browser automation) and introduces new capabilities for browser automation, built-in tools, visualization, autonomy controls, code quality integration, and MCP ecosystem support.

---

## 1. Context and Problem Statement

### 1.1 Background

APEX v0.4.0 established the foundation for autonomous operation with daemon mode, workspace isolation, and session management. v0.5.0 extends this foundation with a comprehensive tool system that provides:

1. **Browser Automation** - Headless browser capabilities for testing and debugging
2. **Built-in Tools** - Claude Code-parity tools (Read, Write, Edit, Bash, etc.)
3. **Tool Visualization** - Real-time tool execution display with timing and output formatting
4. **Permission System** - Fine-grained permission controls with presets and persistence
5. **Autonomy Controls** - Configurable approval gates, budget limits, and change limits
6. **Code Quality Integration** - Lint-after-edit, compiler feedback, and TDD support
7. **Tool Extensions** - Custom tools, hooks, and MCP server support

### 1.2 Existing Infrastructure

The codebase already has significant foundational work:

| Component | Location | Status |
|-----------|----------|--------|
| BaseTool abstract class | `packages/core/src/tools/base-tool.ts` | Complete |
| ToolRegistry singleton | `packages/core/src/tools/tool-registry.ts` | Complete |
| Permission types/schemas | `packages/core/src/types.ts` | Complete |
| PermissionStore | `packages/orchestrator/src/permission-store.ts` | Complete |
| PermissionManager | `packages/orchestrator/src/permission-manager.ts` | Complete |
| PermissionPresetManager | `packages/orchestrator/src/permission-preset-manager.ts` | Complete |
| DirectoryAccessValidator | `packages/core/src/directory-access-validator.ts` | Complete |
| DangerousOperationDetector | `packages/core/src/dangerous-operation-detector.ts` | Complete |
| BrowserManager | `packages/orchestrator/src/browser-manager.ts` | Complete |
| BrowserTool | `packages/orchestrator/src/tools/browser-tool.ts` | Partial |
| MCP Transport layer | `packages/orchestrator/src/mcp/` | Partial |
| Filesystem tools | `packages/core/src/tools/filesystem/` | Complete |
| Shell tools | `packages/core/src/tools/shell/` | Complete |
| Web tools | `packages/core/src/tools/web/` | Complete |
| Search tools | `packages/core/src/tools/search/` | Complete |

---

## 2. Technical Design

### 2.1 High-Level Architecture

```
+-----------------------------------------------------------------------------+
|                              APEX v0.5.0 Architecture                        |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +----------------------------------------------------------------------+   |
|  |                        CLI / API Layer                                |   |
|  |  +-------------+  +-------------+  +-------------+  +-------------+  |   |
|  |  | Tool Call   |  | Permission  |  | Approval    |  | Dry-Run     |  |   |
|  |  | Display     |  | Prompts     |  | Gates UI    |  | Preview     |  |   |
|  |  +-------------+  +-------------+  +-------------+  +-------------+  |   |
|  +----------------------------------------------------------------------+   |
|                                      |                                       |
|  +----------------------------------------------------------------------+   |
|  |                        Orchestrator Layer                             |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  |  | ToolExecutor    |  | PermissionGate  |  | AutonomyController  |   |   |
|  |  |                 |  |                 |  |                     |   |   |
|  |  | - Pre-hooks     |  | - Check perms   |  | - Budget tracking   |   |   |
|  |  | - Validation    |  | - Prompt user   |  | - Change limits     |   |   |
|  |  | - Execution     |  | - Store decision|  | - Time limits       |   |   |
|  |  | - Post-hooks    |  | - Consume once  |  | - Approval gates    |   |   |
|  |  | - Undo tracking |  |                 |  |                     |   |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  |                                                                       |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  |  | CodeQuality     |  | BrowserManager  |  | MCPServerManager    |   |   |
|  |  | Integration     |  |                 |  |                     |   |   |
|  |  |                 |  | - Page actions  |  | - Server registry   |   |   |
|  |  | - Lint on edit  |  | - Screenshots   |  | - Tool discovery    |   |   |
|  |  | - Type checking |  | - Console logs  |  | - Transport mgmt    |   |   |
|  |  | - TDD mode      |  | - Visual diff   |  | - Auto-config       |   |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  +----------------------------------------------------------------------+   |
|                                      |                                       |
|  +----------------------------------------------------------------------+   |
|  |                          Core Layer                                   |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  |  | ToolRegistry    |  | PolicyEnforcer  |  | SecretScanner       |   |   |
|  |  |                 |  |                 |  |                     |   |   |
|  |  | - Built-in tools|  | - Policy rules  |  | - Secret patterns   |   |   |
|  |  | - Custom tools  |  | - Path policies |  | - Block on match    |   |   |
|  |  | - MCP tools     |  | - Test policies |  | - Redaction         |   |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  |                                                                       |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  |  | ToolAction      |  | DirectoryAccess |  | Dangerous           |   |   |
|  |  | Store           |  | Validator       |  | OperationDetector   |   |   |
|  |  |                 |  |                 |  |                     |   |   |
|  |  | - Snapshots     |  | - Allow/block   |  | - Pattern matching  |   |   |
|  |  | - Undo support  |  | - Glob patterns |  | - Severity levels   |   |   |
|  |  | - Retention     |  | - Symlinks      |  | - Confirmations     |   |   |
|  |  +-----------------+  +-----------------+  +---------------------+   |   |
|  +----------------------------------------------------------------------+   |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 2.2 Component Specifications

#### 2.2.1 Browser Automation System

**Package**: `@apexcli/orchestrator`

```typescript
// packages/orchestrator/src/browser/index.ts

/**
 * Browser Automation Feature Set
 *
 * Provides headless browser capabilities for:
 * - Web application testing
 * - Screenshot capture and visual regression
 * - Console log capture and error detection
 * - Browser actions (click, type, scroll, navigate)
 */

// Existing: BrowserManager (browser-manager.ts)
// Existing: BrowserTool (tools/browser-tool.ts)

// New components to implement:

interface VisualRegressionConfig {
  baselineDir: string;
  diffDir: string;
  threshold: number;  // 0-1, percentage of pixels allowed to differ
  updateBaseline: boolean;
}

interface ConsoleCapture {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: Date;
  url?: string;
  lineNumber?: number;
}

interface RuntimeErrorCapture {
  message: string;
  stack?: string;
  timestamp: Date;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

// VisualRegressionTester - compares screenshots against baselines
// ConsoleLogCapture - captures and filters browser console output
// RuntimeErrorDetector - monitors and reports JavaScript errors
```

**Implementation Tasks**:
1. Extend `BrowserTool` with screenshot comparison methods
2. Add `ConsoleLogCapture` event listener integration
3. Implement `VisualRegressionTester` class with pixelmatch integration
4. Add `RuntimeErrorDetector` for uncaught exception monitoring

#### 2.2.2 Built-in Tools (Claude Code Parity)

**Status**: Mostly complete, requiring integration and CLI visualization

| Tool | Package | Status | Notes |
|------|---------|--------|-------|
| Read | `@apexcli/core` | Complete | `tools/filesystem/read-tool.ts` |
| Write | `@apexcli/core` | Complete | `tools/filesystem/write-tool.ts` |
| Edit | `@apexcli/core` | Complete | `tools/filesystem/edit-tool.ts` |
| MultiEdit | `@apexcli/core` | Complete | `tools/filesystem/multi-edit-tool.ts` |
| NotebookEdit | `@apexcli/core` | Complete | `tools/filesystem/notebook-edit-tool.ts` |
| Bash | `@apexcli/core` | Complete | `tools/shell/bash-tool.ts` |
| Glob | `@apexcli/core` | Complete | `tools/filesystem/glob-tool.ts` |
| Grep | `@apexcli/core` | Complete | `tools/search/grep-tool.ts` |
| WebFetch | `@apexcli/core` | Complete | `tools/web/web-search-tool.ts` |
| WebSearch | `@apexcli/core` | Complete | `tools/web/web-search-tool.ts` |
| TodoWrite | `@apexcli/core` | Complete | `tools/system/todo-write-tool.ts` |

**Implementation Tasks**:
1. Wire tools to orchestrator events for visualization
2. Add tool execution timing to CLI display
3. Implement tool output truncation and formatting
4. Add diff preview rendering before Edit/Write operations

#### 2.2.3 Tool Visualization System

**Package**: `@apexcli/cli`

```typescript
// packages/cli/src/ui/components/tools/ToolCallDisplay.tsx

interface ToolCallDisplayProps {
  toolName: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  output?: unknown;
  error?: string;
  isDangerous?: boolean;
  requiresConfirmation?: boolean;
}

// ToolCallDisplay - real-time tool execution visualization
// ToolOutputFormatter - syntax-highlighted, truncated output display
// ToolTimingBadge - execution duration indicator
// DiffPreview - inline diff preview before applying changes
// UndoButton - revert last tool action
```

**Design Principles**:
- Show tool name and parameters in real-time
- Syntax highlight output based on content type
- Truncate large outputs with "Show more" expansion
- Display execution duration prominently
- Color-code status (pending=gray, running=blue, success=green, error=red)

#### 2.2.4 Permission System

**Status**: Core implementation complete, UI integration needed

```typescript
// Existing types in packages/core/src/types.ts:
// - PermissionLevel: 'allow-always' | 'allow-once' | 'deny'
// - Permission, PermissionQuery, ExtendedPermission
// - ToolPermissionConfig variants (Filesystem, Shell, Web, Search)
// - DirectoryAccessConfig

// Existing implementations:
// - PermissionStore (SQLite-backed)
// - PermissionManager (session caching, consumption)
// - PermissionPresetManager (autonomous, review-all, read-only)
// - DirectoryAccessValidator (glob pattern matching)
// - DangerousOperationDetector (pattern-based danger detection)

// New UI components needed in packages/cli/src/ui/components/permissions/

interface PermissionPromptProps {
  tool: string;
  scope?: string;
  operation: string;
  isDangerous: boolean;
  dangerLevel?: 'low' | 'medium' | 'high' | 'critical';
  onAllow: (level: 'allow-always' | 'allow-once') => void;
  onDeny: () => void;
}

// PermissionPrompt - inline permission request UI
// PermissionPresetSelector - preset switching (autonomous/review-all/read-only)
// PermissionHistory - view past permission decisions
```

#### 2.2.5 Autonomy Controls

**Package**: `@apexcli/orchestrator`

```typescript
// packages/orchestrator/src/autonomy-controller.ts

interface AutonomyControllerConfig {
  level: 'full-auto' | 'review-before-commit' | 'review-all';
  gates: ApprovalGate[];
  limits: {
    maxCost?: number;
    maxTokens?: number;
    maxTimeMs?: number;
    maxFilesModified?: number;
    maxLinesChanged?: number;
    maxTurns?: number;
  };
  warningThresholds: {
    costWarningPercent: number;      // e.g., 80
    tokenWarningPercent: number;     // e.g., 80
    timeWarningPercent: number;      // e.g., 80
  };
}

class AutonomyController {
  constructor(config: AutonomyControllerConfig, orchestrator: ApexOrchestrator);

  // Check if action requires approval
  async checkApprovalRequired(action: string, context: TaskContext): Promise<boolean>;

  // Check if any limits are exceeded
  checkLimits(usage: TaskUsage): LimitCheckResult;

  // Track resource consumption
  recordUsage(usage: Partial<TaskUsage>): void;

  // Emit warnings when approaching limits
  checkWarningThresholds(): WarningResult[];
}
```

**Limit Types**:
- **Budget limits**: Pause when cost threshold reached
- **Token limits**: Pause when token threshold reached
- **Time limits**: Maximum task duration
- **Change limits**: Maximum files/lines changed without approval
- **Turn limits**: Maximum API/agent turns

#### 2.2.6 Code Quality Integration

**Package**: `@apexcli/orchestrator`

```typescript
// packages/orchestrator/src/code-quality/index.ts

interface CodeQualityConfig {
  lintAfterEdit: boolean;
  autoFixLintErrors: boolean;
  typeCheckAfterEdit: boolean;
  compilerFeedbackLoop: boolean;
  preEditValidation: boolean;
}

interface LintResult {
  filePath: string;
  errors: LintError[];
  warnings: LintWarning[];
  fixable: number;
  fixed?: number;
}

class CodeQualityIntegration {
  constructor(config: CodeQualityConfig, projectPath: string);

  // Run linter after file edit
  async lintAfterEdit(filePath: string): Promise<LintResult>;

  // Auto-fix linting errors
  async autoFixFile(filePath: string): Promise<LintResult>;

  // Pre-edit syntax validation
  async validateSyntax(content: string, language: string): Promise<ValidationResult>;

  // Type checking (TypeScript/Flow)
  async typeCheck(filePath: string): Promise<TypeCheckResult>;

  // Compiler feedback loop
  async runBuildCheck(): Promise<BuildResult>;
}
```

**TDD Mode**:
```typescript
// packages/orchestrator/src/tdd/tdd-mode.ts

interface TDDModeConfig {
  enabled: boolean;
  testCommand: string;
  watchMode: boolean;
  maxIterations: number;
  regressionGuard: boolean;
}

class TDDMode {
  constructor(config: TDDModeConfig);

  // Write test first, then implementation
  async runTestFirstCycle(testFile: string, implFile: string): Promise<TDDResult>;

  // Auto-correction loop until tests pass
  async autoCorrectionLoop(testFile: string): Promise<CorrectionResult>;

  // Ensure existing tests don't break
  async checkRegression(): Promise<RegressionResult>;
}
```

#### 2.2.7 Tool Extensions & MCP Support

**Package**: `@apexcli/orchestrator`

```typescript
// packages/orchestrator/src/mcp/mcp-server-manager.ts

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  autoStart?: boolean;
  capabilities?: string[];
}

interface MCPMarketplaceEntry {
  name: string;
  description: string;
  version: string;
  author: string;
  installCommand: string;
  capabilities: string[];
  verified: boolean;
}

class MCPServerManager {
  constructor(orchestrator: ApexOrchestrator);

  // Discover and list MCP servers
  async listServers(): Promise<MCPServerConfig[]>;

  // Install from marketplace
  async installServer(name: string): Promise<InstallResult>;

  // Start MCP server
  async startServer(name: string): Promise<void>;

  // Stop MCP server
  async stopServer(name: string): Promise<void>;

  // Get tools from connected server
  async discoverTools(serverName: string): Promise<ToolDefinition[]>;

  // Register MCP tools with ToolRegistry
  async registerMCPTools(serverName: string): Promise<void>;
}

// Custom tool definition
interface CustomToolConfig {
  name: string;
  description: string;
  command: string;
  args?: string[];
  parameters: ToolParametersSchema;
  outputParser?: 'json' | 'text' | 'lines';
  timeout?: number;
}

// Tool hooks
interface ToolHooks {
  beforeExecute?: (params: unknown) => Promise<unknown>;
  afterExecute?: (result: ToolResult) => Promise<ToolResult>;
  onError?: (error: Error) => Promise<void>;
}
```

#### 2.2.8 Policy-as-Code System

**Package**: `@apexcli/core`

```typescript
// packages/core/src/policy/policy-enforcer.ts

interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  type: 'path' | 'command' | 'test' | 'approval' | 'custom';
  condition: string;  // Expression or glob pattern
  action: 'allow' | 'deny' | 'require-approval' | 'warn';
  priority: number;
}

interface PolicyConfig {
  version: string;
  rules: PolicyRule[];
  defaults: {
    pathAction: 'allow' | 'deny';
    commandAction: 'allow' | 'deny';
    testRequired: boolean;
    approvalRequired: boolean;
  };
}

class PolicyEnforcer {
  constructor(config: PolicyConfig);

  // Evaluate policy for a tool invocation
  evaluate(tool: string, params: unknown): PolicyEvaluationResult;

  // Load policy from .apex/policy.yaml
  static loadFromFile(projectPath: string): PolicyEnforcer;
}
```

#### 2.2.9 Secret-Leak Guardrails

**Package**: `@apexcli/core`

```typescript
// packages/core/src/security/secret-scanner.ts

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// Default patterns detect common credential formats:
// - Cloud provider access keys
// - Version control tokens
// - Database connection strings
// - Private keys and certificates

class SecretScanner {
  constructor(customPatterns?: SecretPattern[]);

  // Scan content for secrets
  scan(content: string): SecretMatch[];

  // Block commit if secrets detected
  blockOnSecrets(content: string): BlockResult;

  // Redact secrets in output
  redact(content: string): string;
}
```

---

## 3. Data Flow

### 3.1 Tool Execution Flow

```
1. Agent requests tool execution
                |
                v
2. ToolExecutor receives request
   |--> Pre-hooks execute (validation, transformation)
   |
   v
3. PermissionGate checks authorization
   |--> Check PermissionStore for existing permission
   |--> Check DirectoryAccessValidator for path access
   |--> Check DangerousOperationDetector for risk level
   |
   |--> If no permission: emit 'permission:request' event
   |    --> CLI shows PermissionPrompt
   |    --> User decides: allow-always | allow-once | deny
   |    --> Decision stored and execution continues/blocked
   |
   v
4. AutonomyController checks limits
   |--> Check budget, tokens, time, changes against limits
   |--> If limit approaching: emit 'limit:warning' event
   |--> If limit exceeded: emit 'limit:exceeded' and pause
   |
   v
5. Tool executes via BaseTool.execute()
   |--> emit 'tool:start' event --> CLI shows ToolCallDisplay
   |--> emit 'tool:progress' events --> CLI updates display
   |
   |--> For file modifications:
   |    --> ToolActionStore captures before-snapshot
   |
   v
6. Tool completes
   |--> emit 'tool:complete' event --> CLI shows result
   |
   |--> For file modifications:
   |    --> ToolActionStore captures after-snapshot
   |    --> CodeQualityIntegration runs lint-after-edit
   |
   |--> Post-hooks execute (logging, cleanup)
   |
   v
7. Result returned to agent
```

### 3.2 Permission Decision Flow

```
Permission Request
        |
        v
+-------------------+
| Check Session     |
| Cache             |<--- allow-once consumed here
+--------+----------+
         | miss
         v
+-------------------+
| Check Permission  |
| Store (SQLite)    |
+--------+----------+
         | miss
         v
+-------------------+
| Check Preset      |
| Manager           |<--- autonomous/review-all/read-only
+--------+----------+
         | no preset decision
         v
+-------------------+
| Prompt User       |
| (CLI/API)         |
+--------+----------+
         |
         v
+-------------------+
| Store Decision    |
| Based on Level    |
+-------------------+
| allow-always -->  |
|   SQLite          |
|                   |
| allow-once -->    |
|   Session Cache   |
|                   |
| deny -->          |
|   SQLite          |
+-------------------+
```

---

## 4. API Specifications

### 4.1 New Events (OrchestratorEvents extension)

```typescript
// Extend packages/orchestrator/src/index.ts OrchestratorEvents

interface OrchestratorEvents {
  // ... existing events ...

  // Tool call events (v0.5.0)
  'tool:start': (event: ToolCallStartEvent) => void;
  'tool:progress': (event: ToolCallProgressEvent) => void;
  'tool:complete': (event: ToolCallCompleteEvent) => void;

  // Permission events (v0.5.0)
  'permission:request': (event: PermissionRequestEventData) => void;
  'permission:granted': (event: PermissionGrantedEventData) => void;
  'permission:denied': (event: PermissionDeniedEventData) => void;

  // Dangerous operation events (v0.5.0)
  'dangerous:detected': (event: DangerousOperationDetectedEventData) => void;
  'dangerous:confirmed': (event: DangerousOperationConfirmedEventData) => void;
  'dangerous:blocked': (event: DangerousOperationBlockedEventData) => void;

  // Limit events (v0.5.0)
  'limit:warning': (event: LimitWarningEvent) => void;
  'limit:exceeded': (event: LimitExceededEvent) => void;

  // Code quality events (v0.5.0)
  'lint:started': (event: LintStartedEvent) => void;
  'lint:completed': (event: LintCompletedEvent) => void;
  'typecheck:started': (event: TypeCheckStartedEvent) => void;
  'typecheck:completed': (event: TypeCheckCompletedEvent) => void;

  // MCP events (v0.5.0)
  'mcp:server-connected': (event: MCPServerConnectedEvent) => void;
  'mcp:server-disconnected': (event: MCPServerDisconnectedEvent) => void;
  'mcp:tools-discovered': (event: MCPToolsDiscoveredEvent) => void;
}
```

### 4.2 Configuration Schema Extensions

```yaml
# .apex/config.yaml additions for v0.5.0

# Permission presets
permissions:
  preset: 'review-all'  # autonomous | review-all | read-only
  persistence: true     # Persist decisions across sessions

# Per-tool permission overrides
tools:
  bash:
    enabled: true
    requireConfirmation: true
    blockedCommands:
      - 'rm -rf /'
      - 'sudo'
    directoryAccess:
      allowlist:
        - 'src/**'
        - 'tests/**'
      blocklist:
        - '.git/**'
        - 'node_modules/**'

  webFetch:
    enabled: true
    blockedDomains:
      - '*.onion'
    maxResponseSize: 10485760  # 10MB

# Autonomy controls
autonomy:
  level: 'review-before-commit'
  gates:
    - type: before-commit
      required: true
    - type: before-destructive
      required: true

  limits:
    maxCostPerTask: 10.00
    maxTokensPerTask: 500000
    maxTimePerTaskMs: 3600000  # 1 hour
    maxFilesModified: 50
    maxLinesChanged: 2000

  warningThresholds:
    costWarningPercent: 80
    tokenWarningPercent: 80

# Code quality integration
codeQuality:
  lintAfterEdit: true
  autoFixLintErrors: true
  typeCheckAfterEdit: true
  preEditValidation: true
  tddMode:
    enabled: false
    testCommand: 'npm test'

# MCP server configuration
mcp:
  servers:
    - name: 'filesystem'
      command: 'npx'
      args: ['@modelcontextprotocol/server-filesystem']
      autoStart: true

# Policy rules
policy:
  version: '1.0'
  defaults:
    pathAction: 'allow'
    testRequired: true
  rules:
    - id: 'no-secrets'
      name: 'Block secret patterns'
      type: 'custom'
      condition: 'content matches secret-pattern'
      action: 'deny'
    - id: 'require-tests'
      name: 'Require tests for src changes'
      type: 'test'
      condition: 'path matches src/**'
      action: 'require-approval'
```

---

## 5. Implementation Phases

### Phase 1: Tool Visualization & Events (Week 1-2)

**Priority**: High - Enables visibility into tool execution

1. Wire existing tools to emit `tool:start`, `tool:progress`, `tool:complete` events
2. Create `ToolCallDisplay` CLI component
3. Add timing information to all tool executions
4. Implement output truncation and syntax highlighting
5. Add diff preview before Edit/Write operations

**Files to modify/create**:
- `packages/orchestrator/src/index.ts` - Add tool event emission
- `packages/cli/src/ui/components/tools/ToolCallDisplay.tsx` - New
- `packages/cli/src/ui/components/tools/ToolOutputFormatter.tsx` - New
- `packages/cli/src/ui/components/tools/DiffPreview.tsx` - New

### Phase 2: Permission System UI Integration (Week 2-3)

**Priority**: High - Core user interaction for permissions

1. Create `PermissionPrompt` CLI component
2. Wire permission events to CLI
3. Add permission preset switching command
4. Implement dry-run mode for tool preview

**Files to modify/create**:
- `packages/cli/src/ui/components/permissions/PermissionPrompt.tsx` - New
- `packages/cli/src/ui/components/permissions/PresetSelector.tsx` - New
- `packages/cli/src/commands/permissions.ts` - New
- `packages/orchestrator/src/index.ts` - Wire permission events

### Phase 3: Autonomy Controls (Week 3-4)

**Priority**: High - Safety and resource management

1. Implement `AutonomyController` class
2. Wire limit checking to tool execution flow
3. Add approval gate prompts to CLI
4. Implement budget/token/time tracking visualization

**Files to modify/create**:
- `packages/orchestrator/src/autonomy-controller.ts` - New
- `packages/cli/src/ui/components/autonomy/LimitWarning.tsx` - New
- `packages/cli/src/ui/components/autonomy/ApprovalGate.tsx` - New

### Phase 4: Code Quality Integration (Week 4-5)

**Priority**: Medium - Developer experience enhancement

1. Implement `CodeQualityIntegration` class
2. Add lint-after-edit to file tools
3. Implement type checking integration
4. Add TDD mode scaffolding

**Files to modify/create**:
- `packages/orchestrator/src/code-quality/index.ts` - New
- `packages/orchestrator/src/code-quality/linter.ts` - New
- `packages/orchestrator/src/code-quality/type-checker.ts` - New
- `packages/orchestrator/src/tdd/tdd-mode.ts` - New

### Phase 5: Browser Automation Enhancements (Week 5-6)

**Priority**: Medium - Testing capabilities

1. Extend `BrowserTool` with screenshot comparison
2. Implement `ConsoleLogCapture`
3. Add `VisualRegressionTester`
4. Implement `RuntimeErrorDetector`

**Files to modify/create**:
- `packages/orchestrator/src/tools/browser-tool.ts` - Extend
- `packages/orchestrator/src/browser/visual-regression.ts` - New
- `packages/orchestrator/src/browser/console-capture.ts` - New
- `packages/orchestrator/src/browser/error-detector.ts` - New

### Phase 6: MCP Ecosystem (Week 6-7)

**Priority**: Medium - Extensibility

1. Implement `MCPServerManager`
2. Add MCP tool discovery and registration
3. Create marketplace integration
4. Add auto-configuration support

**Files to modify/create**:
- `packages/orchestrator/src/mcp/mcp-server-manager.ts` - New
- `packages/orchestrator/src/mcp/marketplace.ts` - New
- `packages/cli/src/commands/mcp.ts` - New

### Phase 7: Policy & Security (Week 7-8)

**Priority**: Medium - Safety guardrails

1. Implement `PolicyEnforcer`
2. Create `SecretScanner`
3. Add policy file parsing
4. Wire policy checks to tool execution

**Files to modify/create**:
- `packages/core/src/policy/policy-enforcer.ts` - New
- `packages/core/src/security/secret-scanner.ts` - New
- `packages/core/src/policy/policy-parser.ts` - New

---

## 6. Testing Strategy

### 6.1 Unit Tests

- Tool event emission
- Permission checking logic
- Limit calculations
- Policy rule evaluation
- Secret pattern matching
- Visual regression diffing

### 6.2 Integration Tests

- Full tool execution with permission flow
- Limit-triggered pauses and warnings
- Code quality feedback loop
- MCP server communication
- Browser automation scenarios

### 6.3 E2E Tests

- Complete permission workflow (request, prompt, decision, execution)
- Autonomy control scenarios (budget exceeded, time limit, etc.)
- TDD mode cycle (test, implement, verify)

---

## 7. Migration Notes

### 7.1 Backward Compatibility

- All existing tool implementations remain compatible
- Permission presets default to `review-all` for safety
- Existing `.apex/config.yaml` files work without v0.5.0 sections

### 7.2 Upgrade Path

1. Add `permissions.preset` to config if using presets
2. Configure `autonomy.limits` for resource management
3. Enable `codeQuality.lintAfterEdit` for automatic linting
4. Add MCP servers to `mcp.servers` for extensions

---

## 8. Security Considerations

1. **Secret Detection**: All tool outputs scanned before display
2. **Path Validation**: DirectoryAccessValidator prevents path traversal
3. **Command Blocking**: Shell blocklist prevents dangerous commands
4. **Permission Persistence**: SQLite storage with proper file permissions
5. **MCP Isolation**: Each MCP server runs in separate process

---

## 9. Performance Considerations

1. **Permission Caching**: Session-level cache reduces database queries
2. **Tool Result Streaming**: Large outputs streamed to avoid memory issues
3. **Lazy Loading**: MCP servers started on-demand, not at boot
4. **Snapshot Retention**: Configurable limits prevent disk exhaustion

---

## 10. Open Questions

1. **MCP Marketplace Source**: Use existing registry or self-hosted?
2. **Visual Regression Storage**: Local baseline or cloud comparison?
3. **TDD Mode Scope**: Per-file or per-test-suite granularity?
4. **Policy Expression Language**: Custom DSL or use existing (CEL, Rego)?

---

## 11. References

- [ROADMAP.md](/ROADMAP.md) - v0.5.0 feature specification
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Claude Code](https://claude.ai/code) - Tool parity reference

---

## 12. Appendix: Type Definitions Summary

```typescript
// Key new types for v0.5.0

// Tool Visualization
interface ToolCallStartEvent {
  taskId: string;
  toolName: string;
  input: Record<string, unknown>;
  callId: string;
  timestamp: Date;
}

interface ToolCallProgressEvent {
  taskId: string;
  toolName: string;
  callId: string;
  progress: { message: string; percentage?: number };
  timestamp: Date;
}

interface ToolCallCompleteEvent {
  taskId: string;
  toolName: string;
  callId: string;
  result: { success: boolean; output?: unknown; error?: string };
  timing: { startTime: Date; endTime: Date; duration: number };
  timestamp: Date;
}

// Autonomy Controls
interface AutonomyControllerConfig {
  level: AutonomyLevel;
  gates: ApprovalGate[];
  limits: TaskResourceLimits;
  warningThresholds: {
    costWarningPercent: number;
    tokenWarningPercent: number;
    timeWarningPercent: number;
  };
}

interface LimitCheckResult {
  exceeded: boolean;
  limitType?: 'tokens' | 'cost' | 'time' | 'files';
  currentValue?: number;
  limitValue?: number;
}

// Code Quality
interface LintResult {
  filePath: string;
  errors: LintError[];
  warnings: LintWarning[];
  fixable: number;
  fixed?: number;
}

interface TypeCheckResult {
  success: boolean;
  errors: TypeCheckError[];
  warnings: TypeCheckWarning[];
}

// MCP
interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  autoStart?: boolean;
  capabilities?: string[];
}

// Policy
interface PolicyRule {
  id: string;
  name: string;
  type: 'path' | 'command' | 'test' | 'approval' | 'custom';
  condition: string;
  action: 'allow' | 'deny' | 'require-approval' | 'warn';
  priority: number;
}

// Security
interface SecretMatch {
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: { line: number; column: number };
  redacted: string;
}
```
