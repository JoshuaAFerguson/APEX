# ADR-060: Permission Scenario Test Helpers Architecture

## Status
**Proposed**

## Context

APEX requires comprehensive test infrastructure for simulating permission checks, denials, and grants across tools, file access, and agent capabilities. The acceptance criteria specify:

1. Helper functions to simulate permission checks, denials, and grants
2. Ability to mock permission states for tools, file access, and agent capabilities
3. Helpers for testing permission boundary conditions

### Existing Infrastructure Analysis

After thorough analysis, the codebase already has **extensive** permission test infrastructure:

#### Current State (What Exists)

1. **`tests/test-utils/permission-test-helpers.ts`** (655 lines)
   - `MockPermissionManager` for browser tools with `checkToolPermission`, `denyPermission`, `grantPermission`
   - `createTrackedMockBrowser()` for resource tracking and leak detection
   - `createPermissionTestContext()` for complete browser permission testing
   - `createPermissionDenialScenarios()` with 17 pre-built scenarios
   - Assertion helpers: `assertPermissionDeniedResponse`, `assertPermissionEventsEmitted`, `assertErrorMessageQuality`

2. **`tests/test-utils/mcp-permission-helpers.ts`** (933 lines)
   - `MockMcpPermissionManager` for MCP server/tool/resource permissions
   - `createMockMcpServer()` for simulating MCP servers with tools and resources
   - `createMcpPermissionTestContext()` for complete MCP permission testing
   - `createMcpPermissionTestScenarios()` with 11 pre-built scenarios
   - `simulateMcpWorkflow()` for multi-step MCP permission workflows

3. **`tests/test-utils/autonomy-test-helpers.ts`** (1388 lines)
   - `MockAutonomyManager` for autonomy level management
   - `MockPermissionManager` (different interface) for tool permissions
   - `MockTaskManager` for task lifecycle testing
   - `ApprovalSimulator` for testing approval flows
   - `createAutonomyTestScenarios()` with 8 autonomy-specific scenarios
   - `createPermissionTestScenarios()` with 10 permission-specific scenarios
   - `createAutonomyBoundaryTestScenarios()` with 9 boundary condition scenarios

4. **`tests/test-utils/permission-integration-fixtures.ts`** (754 lines)
   - `MockPermissionApprovalSystem` for user consent simulation
   - `MockMCPPermissionServer` for MCP integration
   - `permissionScenarios` with 5 common scenarios
   - `permissionTestFactory` for creating test scenarios
   - `permissionAssertions` helper object

#### Gap Analysis (What's Missing)

Despite the extensive infrastructure, there are gaps:

1. **Unified Permission Scenario API**: Multiple files with overlapping but inconsistent APIs
2. **Agent Capability Permissions**: No dedicated helpers for testing agent-specific capabilities (e.g., which tools an agent can use based on its definition)
3. **File Access Permission Scenarios**: Limited scenarios for `DirectoryAccessConfig` patterns
4. **Consolidated Permission State Management**: No single entry point for managing permission states
5. **Permission Boundary Condition Testing**: Boundary scenarios exist but are scattered

## Decision

Create a **unified permission scenario test helpers module** that:

1. **Consolidates** existing permission testing infrastructure under a unified API
2. **Extends** with agent capability permission testing
3. **Provides** comprehensive file access permission scenarios
4. **Implements** boundary condition testing helpers
5. **Maintains** backward compatibility with existing helpers

### Architecture Design

```
tests/test-utils/
├── permission-test-helpers.ts           (existing - browser permissions)
├── mcp-permission-helpers.ts            (existing - MCP permissions)
├── autonomy-test-helpers.ts             (existing - autonomy/approval)
├── permission-integration-fixtures.ts   (existing - integration scenarios)
└── permission-scenario-helpers.ts       (NEW - unified API)
```

### New Module: `permission-scenario-helpers.ts`

#### Core Types

```typescript
// Unified permission state for all permission types
interface UnifiedPermissionState {
  tools: Map<string, ToolPermissionState>;
  files: Map<string, FileAccessState>;
  agents: Map<string, AgentCapabilityState>;
  mcp: Map<string, McpPermissionState>;
}

// Tool permission state
interface ToolPermissionState {
  tool: AgentTool;
  level: PermissionLevel;
  scopes: Map<string, PermissionLevel>;
  requiresConfirmation: boolean;
}

// File access state
interface FileAccessState {
  pattern: string;
  accessType: 'allowed' | 'denied' | 'requires-confirmation';
  directoryConfig?: DirectoryAccessConfig;
}

// Agent capability state
interface AgentCapabilityState {
  agentId: string;
  allowedTools: AgentTool[];
  deniedTools: AgentTool[];
  autonomyLevel: AutonomyLevel;
  overrides: AgentAutonomyOverride | null;
}
```

#### Core Factory Functions

```typescript
// Create unified permission test context
function createPermissionScenarioContext(config?: PermissionScenarioConfig): PermissionScenarioContext;

// Create specific permission states
function createToolPermissionState(tool: AgentTool, level: PermissionLevel, scopes?: Record<string, PermissionLevel>): ToolPermissionState;
function createFileAccessState(pattern: string, access: 'allowed' | 'denied' | 'requires-confirmation', config?: DirectoryAccessConfig): FileAccessState;
function createAgentCapabilityState(agentId: string, config: Partial<AgentCapabilityState>): AgentCapabilityState;
```

#### Permission Simulation Functions

```typescript
// Simulate permission check
async function simulatePermissionCheck(context: PermissionScenarioContext, query: PermissionQuery): Promise<ToolPermissionResult>;

// Simulate permission denial
async function simulatePermissionDenial(context: PermissionScenarioContext, tool: AgentTool, scope?: string, reason?: string): Promise<void>;

// Simulate permission grant
async function simulatePermissionGrant(context: PermissionScenarioContext, tool: AgentTool, level: PermissionLevel, scope?: string): Promise<void>;

// Simulate file access check
async function simulateFileAccessCheck(context: PermissionScenarioContext, path: string, operation: 'read' | 'write' | 'execute'): Promise<{ allowed: boolean; reason?: string }>;

// Simulate agent capability check
async function simulateAgentCapabilityCheck(context: PermissionScenarioContext, agentId: string, tool: AgentTool): Promise<{ allowed: boolean; reason?: string }>;
```

#### Boundary Condition Helpers

```typescript
// Create boundary test scenarios
function createPermissionBoundaryScenarios(): {
  // Permission level transitions
  levelTransition: {
    allowTosDeny: () => PermissionScenarioContext;
    denyToAllow: () => PermissionScenarioContext;
    onceToAlways: () => PermissionScenarioContext;
  };

  // Scope boundaries
  scopeBoundaries: {
    exactMatch: () => PermissionScenarioContext;
    wildcardMatch: () => PermissionScenarioContext;
    noMatch: () => PermissionScenarioContext;
    partialMatch: () => PermissionScenarioContext;
  };

  // Agent capability boundaries
  agentBoundaries: {
    toolNotInList: () => PermissionScenarioContext;
    toolInDenyList: () => PermissionScenarioContext;
    autonomyOverride: () => PermissionScenarioContext;
    conflictingOverrides: () => PermissionScenarioContext;
  };

  // File access boundaries
  fileBoundaries: {
    allowlistOnly: () => PermissionScenarioContext;
    blocklistOnly: () => PermissionScenarioContext;
    mixedList: () => PermissionScenarioContext;
    symlinkResolution: () => PermissionScenarioContext;
    depthLimit: () => PermissionScenarioContext;
  };

  // Timing boundaries
  timingBoundaries: {
    expiredPermission: () => PermissionScenarioContext;
    nearExpiry: () => PermissionScenarioContext;
    rateLimitExceeded: () => PermissionScenarioContext;
  };
};
```

#### Pre-built Scenario Generators

```typescript
// Comprehensive scenario generators
function createPermissionScenarios(): {
  // Tool permission scenarios
  tool: {
    allToolsAllowed: () => PermissionScenarioContext;
    allToolsDenied: () => PermissionScenarioContext;
    readOnlyTools: () => PermissionScenarioContext;
    noNetworkAccess: () => PermissionScenarioContext;
    noShellAccess: () => PermissionScenarioContext;
    browserRestricted: () => PermissionScenarioContext;
    customToolSet: (tools: AgentTool[]) => PermissionScenarioContext;
  };

  // File access scenarios
  file: {
    fullAccess: () => PermissionScenarioContext;
    readOnlyAccess: () => PermissionScenarioContext;
    projectRootOnly: () => PermissionScenarioContext;
    noSensitivePaths: () => PermissionScenarioContext;
    configFilesBlocked: () => PermissionScenarioContext;
    customPaths: (allowlist: string[], blocklist: string[]) => PermissionScenarioContext;
  };

  // Agent capability scenarios
  agent: {
    developer: () => PermissionScenarioContext;  // Full tools, review-before-commit
    tester: () => PermissionScenarioContext;     // Read + test tools, full-auto
    reviewer: () => PermissionScenarioContext;   // Read-only, review-all
    planner: () => PermissionScenarioContext;    // No tools, full-auto
    architect: () => PermissionScenarioContext;  // Read + design tools
    devops: () => PermissionScenarioContext;     // Shell + network, review-all
    custom: (config: AgentCapabilityState) => PermissionScenarioContext;
  };

  // Combined scenarios
  combined: {
    sandboxedDevelopment: () => PermissionScenarioContext;
    productionSafe: () => PermissionScenarioContext;
    aiSafeMode: () => PermissionScenarioContext;
    fullAutonomy: () => PermissionScenarioContext;
    reviewRequired: () => PermissionScenarioContext;
  };
};
```

#### Assertion Helpers

```typescript
// Unified assertion helpers
const permissionAssertions = {
  // Tool assertions
  assertToolAllowed: (context: PermissionScenarioContext, tool: AgentTool, scope?: string) => void;
  assertToolDenied: (context: PermissionScenarioContext, tool: AgentTool, scope?: string) => void;
  assertToolRequiresConfirmation: (context: PermissionScenarioContext, tool: AgentTool) => void;

  // File assertions
  assertFileAccessAllowed: (context: PermissionScenarioContext, path: string, operation?: string) => void;
  assertFileAccessDenied: (context: PermissionScenarioContext, path: string, operation?: string) => void;

  // Agent assertions
  assertAgentCanUseTool: (context: PermissionScenarioContext, agentId: string, tool: AgentTool) => void;
  assertAgentCannotUseTool: (context: PermissionScenarioContext, agentId: string, tool: AgentTool) => void;
  assertAgentAutonomyLevel: (context: PermissionScenarioContext, agentId: string, expectedLevel: AutonomyLevel) => void;

  // Event assertions
  assertPermissionEventEmitted: (context: PermissionScenarioContext, eventType: string, count?: number) => void;
  assertNoPermissionViolations: (context: PermissionScenarioContext) => void;

  // Boundary assertions
  assertBoundaryRespected: (context: PermissionScenarioContext, boundary: string) => void;
};
```

### Integration with Existing Helpers

The new module will **delegate** to existing helpers rather than duplicate:

```typescript
import { createPermissionTestContext, createPermissionDenialScenarios } from './permission-test-helpers.js';
import { createMcpPermissionTestContext, createMcpPermissionTestScenarios } from './mcp-permission-helpers.js';
import { createAutonomyTestContext, createAutonomyTestScenarios, createPermissionTestScenarios } from './autonomy-test-helpers.js';

// Unified context composes from existing contexts
class PermissionScenarioContext {
  private browserContext: PermissionTestContext;
  private mcpContext: McpPermissionTestContext;
  private autonomyContext: AutonomyTestContext;

  // Unified API methods delegate to appropriate context
}
```

## Consequences

### Positive
- Single entry point for all permission testing scenarios
- Comprehensive coverage of tools, files, and agent capabilities
- Boundary condition testing is explicitly supported
- Backward compatible with existing test infrastructure
- Well-documented scenarios reduce test setup boilerplate

### Negative
- Additional module to maintain
- Some potential for API confusion between old and new helpers
- Requires careful coordination to avoid duplication

### Mitigations
- Clear documentation distinguishing use cases
- Deprecation notices on overlapping old APIs (future)
- TypeScript types enforce correct usage

## Implementation Plan

1. **Phase 1**: Create `permission-scenario-helpers.ts` with core types and factory functions
2. **Phase 2**: Implement tool and file permission simulation
3. **Phase 3**: Implement agent capability permission simulation
4. **Phase 4**: Add boundary condition scenarios
5. **Phase 5**: Create comprehensive pre-built scenarios
6. **Phase 6**: Add assertion helpers
7. **Phase 7**: Write tests for the new module

## Related ADRs

- ADR-007: Permission Notification Integration Tests
- ADR-016: Bash Tool (dangerous flag permissions)
- ADR-052: Permission Denial Error Handling Tests

## References

- Existing test files: `tests/test-utils/permission-*.ts`, `tests/test-utils/autonomy-test-helpers.ts`
- Core types: `packages/core/src/types.ts` (PermissionLevel, AgentTool, DirectoryAccessConfig)
- Integration tests: `tests/integration/permission-*.test.ts`
