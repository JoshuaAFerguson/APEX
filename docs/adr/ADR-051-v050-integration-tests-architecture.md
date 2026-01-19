# ADR-051: v0.5.0 Integration Tests Architecture

## Status
Proposed

## Date
2026-01-18

## Context

The v0.5.0 release introduces three major subsystems that need to work together seamlessly:

1. **Tool System** - Tool registry, tool actions, file snapshots, undo/redo capabilities
2. **Permission System** - Permission manager, permission store, permission presets, autonomy controls
3. **Browser Automation** - Browser tool, mock sessions, screenshot comparisons, domain policies

The acceptance criteria require integration tests that verify these three systems work together correctly - tools respect permissions, browser automation integrates with the tool system, etc.

## Decision

### Architecture Overview

The integration test architecture follows a layered design with shared test utilities, mock implementations, and assertion helpers that enable comprehensive cross-system testing.

```
packages/orchestrator/src/__tests__/v050-integration/
├── test-utils.ts                           # Shared utilities, mocks, helpers
├── browser-permission-integration.test.ts  # Browser + Permission integration
├── tool-browser-policy-integration.test.ts # Tool + Browser + Policy integration
├── mcp-permission-integration.test.ts      # MCP + Permission integration
├── permission-preset-autonomy-integration.test.ts # Preset + Autonomy integration
├── code-quality-tool-undo-integration.test.ts     # Code Quality + Tool Actions + Undo
├── e2e-workflow-integration.test.ts        # End-to-end workflow simulation
└── combined-system-integration.test.ts     # NEW: All three systems together (to be created)
```

### Core Design Principles

1. **Single Test Environment Factory**
   - `createTestEnvironment()` provides a complete, isolated test environment
   - Includes TaskStore, PermissionManager, PolicyEnforcer, BrowserTool, ToolActionStore, AutonomyController
   - Automatic cleanup on test completion

2. **Mock Implementations**
   - `MockBrowserSession` - Full browser session mock for testing without real browser automation
   - `MockMCPServer` - Simulates MCP server for tool discovery tests
   - All mocks emit events identical to real implementations

3. **Assertion Helpers**
   - `expectPermissionGranted/Denied` - Permission result assertions
   - `expectPolicyViolation` - Policy violation pattern matching
   - `expectToolActionUndoable/NotUndoable` - Undo capability assertions

### Integration Test Categories

#### 1. Browser + Permission System Integration (Existing)
**File:** `browser-permission-integration.test.ts`

Tests verify:
- Browser operations require correct permissions
- Permission levels (allow-always, allow-once, deny) are respected
- Domain-based access control with permission manager
- Dangerous operations (evaluate, submit) require elevated permissions
- Permission events are emitted correctly during browser operations

#### 2. Tool + Browser + Policy Integration (Existing)
**File:** `tool-browser-policy-integration.test.ts`

Tests verify:
- Policy rules are evaluated for file operations before/after browser tests
- File snapshot creation respects policy path validation
- Browser screenshot operations integrate with allowed paths
- Tool action tracking works across tool types
- Policy violations block chained tool operations

#### 3. Permission Preset + Autonomy Integration (Existing)
**File:** `permission-preset-autonomy-integration.test.ts`

Tests verify:
- Autonomy limits interact correctly with permission presets
- Budget/token/time limits pause regardless of preset
- Approval gates work with autonomous preset
- Change limits trigger review even in autonomous mode
- Warning thresholds emit events before limits exceeded

#### 4. MCP + Permission Integration (Existing)
**File:** `mcp-permission-integration.test.ts`

Tests verify:
- MCP tools respect permission levels
- MCP tool discovery registers tools with permission requirements
- Custom tool hooks run before permission check
- MCP server connection requires appropriate permissions
- MCP tool execution tracks in ToolActionStore

#### 5. Code Quality + Tool Actions + Undo Integration (Existing)
**File:** `code-quality-tool-undo-integration.test.ts`

Tests verify:
- Lint-after-edit creates proper snapshots for undo
- Auto-fix changes are tracked in ToolActionStore
- Undo reverts lint fixes correctly
- Type checking integration with edit tools
- TDD mode manages test/impl file pairs

#### 6. End-to-End Workflow Integration (Existing)
**File:** `e2e-workflow-integration.test.ts`

Tests verify:
- Complete feature development workflow
- Workflow interruption handling
- Autonomy controls throughout workflow

#### 7. Combined System Integration (NEW - To Be Implemented)
**File:** `combined-system-integration.test.ts`

This new test file should verify the complete integration of all three systems:

```typescript
/**
 * Integration tests for Combined Tool, Permission, and Browser Automation Systems
 *
 * Tests verify:
 * 1. Complete tri-system interaction flows
 * 2. Event propagation across system boundaries
 * 3. Error handling and recovery across systems
 * 4. Resource cleanup and state consistency
 * 5. Complex multi-tool workflows with permissions and browser actions
 */
```

### Test Scenarios for Combined System Integration

#### Scenario 1: Browser-Driven File Modification with Permissions
```
1. Grant browser permission (allow-always)
2. Navigate to test page
3. Extract data via browser.getText()
4. Use extracted data to modify file (requires file permission check)
5. Verify tool action recorded with proper snapshots
6. Verify undo capability
```

#### Scenario 2: Tool Execution Triggering Browser Verification
```
1. Edit source file (TypeScript)
2. Run lint-fix (creates snapshots)
3. Launch browser to visual test the changes
4. Take screenshot for regression comparison
5. All actions tracked in ToolActionStore
6. Verify permissions respected at each step
```

#### Scenario 3: Permission Cascade Across Systems
```
1. Apply "supervised" permission preset
2. Attempt browser navigation (should require approval)
3. Attempt file edit (should require approval)
4. Attempt MCP tool execution (should require approval)
5. Verify all approval requests are tracked
6. Grant/deny and verify system behavior
```

#### Scenario 4: Policy Enforcement Across Systems
```
1. Configure policy with blocked paths
2. Attempt browser screenshot to blocked path → blocked
3. Attempt file edit in blocked path → blocked
4. Attempt MCP file reader on blocked path → blocked
5. Verify consistent policy violations across all systems
```

#### Scenario 5: Resource Limit Impact on All Systems
```
1. Set low budget limit
2. Execute browser operations (consumes budget)
3. Execute file operations (consumes budget)
4. Execute MCP operations (consumes budget)
5. Verify limit:exceeded stops all systems
6. Verify partial work can be undone
```

#### Scenario 6: Error Recovery Across Systems
```
1. Start multi-step workflow
2. Browser operation succeeds
3. File operation fails mid-way
4. Verify browser session cleaned up
5. Verify file snapshots preserved for recovery
6. Verify permission state consistent
```

### Test Utilities Enhancement

The existing `test-utils.ts` should be enhanced with:

```typescript
// Multi-system workflow builder
export class IntegrationWorkflowBuilder {
  private steps: WorkflowStep[] = [];

  addBrowserStep(operation: BrowserOperation): this;
  addFileStep(operation: FileOperation): this;
  addMCPStep(operation: MCPOperation): this;
  addPermissionGate(permission: PermissionConfig): this;

  async execute(testEnv: TestEnvironment): Promise<WorkflowResult>;
  async verify(expectations: WorkflowExpectations): Promise<void>;
}

// Cross-system event tracker
export class IntegrationEventTracker {
  private events: Map<string, IntegrationEvent[]>;

  trackPermission(event: PermissionEvent): void;
  trackPolicy(event: PolicyEvent): void;
  trackToolAction(event: ToolActionEvent): void;
  trackBrowser(event: BrowserEvent): void;

  getTimeline(): TimelineEvent[];
  verifyEventOrder(expected: string[]): void;
  verifyEventContent(matcher: EventMatcher): void;
}
```

### Interface Contracts

#### Tool System → Permission System
```typescript
interface ToolPermissionGate {
  checkPermission(tool: string, scope?: string): Promise<ToolPermissionResult>;
  recordUsage(tool: string, usage: UsageMetrics): void;
}
```

#### Permission System → Policy Enforcer
```typescript
interface PolicyCheck {
  validateFilePath(path: string): PolicyViolation[];
  checkApprovalRequired(context: ApprovalContext): ApprovalCheck;
}
```

#### Browser Tool → Permission Manager
```typescript
interface BrowserPermissionCheck {
  checkToolPermission(query: PermissionQuery): Promise<ToolPermissionResult>;
  grantPermission(tool: string, level: PermissionLevel, scope?: string): Promise<void>;
}
```

#### Autonomy Controller → All Systems
```typescript
interface AutonomyGate {
  checkLimits(): LimitStatus;
  recordUsage(usage: UsageMetrics): void;
  recordFileChange(file: string, lines: number): void;
  createApprovalGate(id: string, description: string, urgency: Urgency): ApprovalGate;
}
```

### Implementation Priority

1. **High Priority** - Combined System Integration Tests
   - These are the missing tests that verify tri-system interaction
   - Focus on critical paths: browser + permission, tool + policy, all-three together

2. **Medium Priority** - Error Recovery Tests
   - Ensure systems gracefully handle failures in other systems
   - Verify cleanup and state consistency

3. **Lower Priority** - Performance Tests
   - Verify event propagation doesn't create bottlenecks
   - Test with high-volume tool actions

## Consequences

### Positive
- Comprehensive coverage of cross-system interactions
- Shared test utilities reduce duplication
- Mock implementations enable fast, reliable tests
- Clear interface contracts enable independent development

### Negative
- Test setup complexity increases with system count
- Mock maintenance burden as systems evolve
- Integration tests are slower than unit tests

### Mitigation
- Use factory patterns for test environment creation
- Keep mocks minimal - only mock external dependencies
- Run integration tests in CI but allow skipping for quick feedback

## Related ADRs
- ADR-045: Error Recovery Integration Tests
- ADR-046: Error Recovery Test Architecture
