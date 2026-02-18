# ADR-003: Mock Factory Architecture for Core Domain Types

## Status
Proposed

## Context
The APEX project requires comprehensive mock factories for all core domain types defined in `packages/core/src/types.ts`. These factories are essential for:
- Unit and integration testing across all packages
- Consistent test data generation with sensible defaults
- Support for partial overrides to customize fixtures
- Type-safe fixtures that pass Zod schema validation

### Current State
Existing factories cover:
- **task-factory.ts**: Task, TaskUsage, TaskLog, Artifact
- **tool-factory.ts**: ToolResult, ToolExecution, ToolInvocation, ToolDefinition
- **autonomy-factory.ts**: AutonomyConfig, AgentAutonomyOverride, ApprovalGate, TaskResourceLimits
- **config-factory.ts**: ProjectConfig with integrated agents/workflows
- **permission-factory.ts**: ToolPermission, ToolPermissionResult

### Gap Analysis
Missing factories for core types:
1. **Agent Types**: AgentDefinition (standalone)
2. **Workflow Types**: WorkflowDefinition, WorkflowStage, WorkflowGate, IsolationConfig
3. **MCP Types**: MCPServerConfig, MCPConfig, MCPTool, MCPConnectionInfo, MCPRegistryServer
4. **Browser Types**: BrowserToolConfig, BrowserToolInput, BrowserToolOutput, BrowserSessionConfig
5. **Git Types**: GitConfig, WorktreeConfig, WorktreeInfo
6. **Configuration Types**: LimitsConfig, ModelsConfig, UIConfig, ApexConfig
7. **Code Quality Types**: LinterConfig, ESLintConfig, PrettierConfig, CodeQualityConfig, SecretScanningConfig
8. **Daemon Types**: DaemonConfig, LoggingConfig

## Decision

### Factory Architecture

All factories will follow the established pattern from existing factories:

```typescript
export const createTypeName: FixtureFactory<TypeName, TypeNameFactoryOptions> = (
  overrides = {},
  options = {}
): TypeName => {
  // Build object with sensible defaults
  // Apply overrides
  // Return typed object
};
```

### New Factory Files Structure

```
packages/core/src/test-fixtures/factories/
├── index.ts                    # Re-export all factories
├── task-factory.ts             # (existing)
├── tool-factory.ts             # (existing)
├── autonomy-factory.ts         # (existing)
├── config-factory.ts           # (existing)
├── permission-factory.ts       # (existing)
├── agent-factory.ts            # NEW: AgentDefinition factories
├── workflow-factory.ts         # NEW: Workflow-related factories
├── mcp-factory.ts              # NEW: MCP server/tool factories
├── browser-factory.ts          # NEW: Browser automation factories
├── git-factory.ts              # NEW: Git/worktree factories
├── limits-factory.ts           # NEW: Resource limits factories
├── linter-factory.ts           # NEW: Code quality factories
└── daemon-factory.ts           # NEW: Daemon/logging factories
```

### Factory Design Principles

1. **Sensible Defaults**: Every factory produces a valid, usable object out-of-the-box
2. **Partial Overrides**: All fields can be overridden via the first parameter
3. **Factory Options**: Second parameter for factory-specific behavior (e.g., include/exclude nested objects)
4. **Type Safety**: Return types match Zod-inferred types exactly
5. **Schema Validation**: All generated objects should pass Zod schema validation
6. **Preset Collections**: Group related factory variants for common testing scenarios

### Detailed Factory Specifications

#### 1. agent-factory.ts
```typescript
// Core factories
createAgentDefinition(overrides?, options?)
createAgentModel(model?: AgentModel)

// Preset factories
createDeveloperAgent()
createPlannerAgent()
createTesterAgent()
createReviewerAgent()
createArchitectAgent()

// Presets
AgentPresets.basic   // Standard agent configurations
AgentPresets.minimal // Agents with minimal tools
AgentPresets.full    // Fully-equipped agents
```

#### 2. workflow-factory.ts
```typescript
// Core factories
createWorkflowDefinition(overrides?, options?)
createWorkflowStage(overrides?)
createWorkflowGate(overrides?)
createIsolationConfig(overrides?)

// Workflow type factories
createFeatureWorkflow()
createBugfixWorkflow()
createHotfixWorkflow()
createRefactorWorkflow()

// Stage factories
createPlanningStage()
createImplementationStage()
createTestingStage()
createReviewStage()

// Presets
WorkflowPresets.simple    // 2-3 stage workflows
WorkflowPresets.standard  // Full feature workflow
WorkflowPresets.complex   // Multi-gate, parallel stages
```

#### 3. mcp-factory.ts
```typescript
// Core factories
createMCPServerConfig(overrides?)
createMCPConfig(overrides?, options?)
createMCPTool(overrides?)
createMCPConnectionInfo(overrides?)
createMCPRegistryServer(overrides?)
createMCPInstallation(overrides?)

// Status-based factories
createConnectedMCPServer()
createDisconnectedMCPServer()
createFailedMCPServer()

// Presets
MCPPresets.filesystem    // File-related MCP servers
MCPPresets.database      // DB servers
MCPPresets.marketplace   // Marketplace entries
```

#### 4. browser-factory.ts
```typescript
// Core factories
createBrowserToolConfig(overrides?)
createBrowserSessionConfig(overrides?)
createBrowserToolInput(operation, params?)
createBrowserToolOutput(overrides?)
createConsoleMessage(overrides?)
createBrowserError(overrides?)

// Operation-specific input factories
createNavigateInput(url)
createClickInput(selector)
createTypeInput(selector, text)
createScreenshotInput(options?)

// Presets
BrowserPresets.operations   // All operation inputs
BrowserPresets.outputs      // Success/failure outputs
BrowserPresets.sessions     // Session configurations
```

#### 5. git-factory.ts
```typescript
// Core factories
createGitConfig(overrides?)
createWorktreeConfig(overrides?)
createWorktreeInfo(overrides?)

// Configuration variants
createAutoCommitGitConfig()
createManualGitConfig()
createWorktreeEnabledGitConfig()

// Presets
GitPresets.basic        // Simple git config
GitPresets.automation   // Full automation enabled
GitPresets.worktrees    // Worktree isolation
```

#### 6. limits-factory.ts
```typescript
// Core factories
createLimitsConfig(overrides?)
createModelsConfig(overrides?)
createUIConfig(overrides?)

// Limit variants
createStrictLimits()
createRelaxedLimits()
createTestingLimits()

// Presets
LimitsPresets.development  // Dev-friendly limits
LimitsPresets.production   // Production-safe limits
LimitsPresets.testing      // Fast/cheap for tests
```

#### 7. linter-factory.ts
```typescript
// Core factories
createLinterConfig(overrides?, options?)
createESLintConfig(overrides?)
createPrettierConfig(overrides?)
createCustomLinterConfig(overrides?)
createCodeQualityConfig(overrides?)
createSecretScanningConfig(overrides?)

// Configuration variants
createStrictLinterConfig()
createRelaxedLinterConfig()
createCILinterConfig()

// Presets
LinterPresets.minimal     // Minimal linting
LinterPresets.standard    // ESLint + Prettier
LinterPresets.strict      // All checks enabled
```

#### 8. daemon-factory.ts
```typescript
// Core factories
createDaemonConfig(overrides?, options?)
createLoggingConfig(overrides?)
createLogRotationConfig(overrides?)

// Configuration variants
createProductionDaemonConfig()
createDevelopmentDaemonConfig()
createTestingDaemonConfig()

// Presets
DaemonPresets.minimal     // Minimal daemon config
DaemonPresets.full        // All features enabled
DaemonPresets.monitoring  // With health checks
```

### Integration with Existing Factories

The new factories will integrate with existing ones:

```typescript
// config-factory.ts can compose with new factories
createProjectConfig({
  agents: {
    developer: createDeveloperAgent(),
    tester: createTesterAgent(),
  },
  git: createAutoCommitGitConfig(),
  limits: createTestingLimits(),
  linter: createStrictLinterConfig(),
});
```

### Testing Strategy

Each factory file will have corresponding tests:
1. **Unit Tests**: Verify default values, override behavior, type correctness
2. **Schema Validation Tests**: Ensure all outputs pass Zod validation
3. **Integration Tests**: Test factory composition
4. **Example Tests**: Document usage patterns

## Consequences

### Positive
- Comprehensive test coverage for all core types
- Consistent factory API across all types
- Reduced boilerplate in test files
- Type-safe test data generation
- Easy to maintain with preset collections

### Negative
- Additional code to maintain
- Potential for factory bloat if not managed
- Need to keep factories in sync with type changes

### Mitigation
- Use TypeScript to catch type mismatches at compile time
- Add CI checks for schema validation of factory outputs
- Document factory update process in CONTRIBUTING.md

## Implementation Plan

### Phase 1: Core Factories
1. agent-factory.ts - AgentDefinition
2. workflow-factory.ts - WorkflowDefinition, WorkflowStage

### Phase 2: Configuration Factories
3. git-factory.ts - GitConfig, WorktreeConfig
4. limits-factory.ts - LimitsConfig, ModelsConfig, UIConfig

### Phase 3: Integration Factories
5. mcp-factory.ts - MCP types
6. browser-factory.ts - Browser automation types

### Phase 4: Quality Factories
7. linter-factory.ts - Code quality types
8. daemon-factory.ts - Daemon/logging types

### Phase 5: Update index.ts
9. Export all new factories from index.ts
10. Update documentation

## References
- Existing factory implementations in `packages/core/src/test-fixtures/factories/`
- Type definitions in `packages/core/src/types.ts`
- Test fixture types in `packages/core/src/test-fixtures/types.ts`
