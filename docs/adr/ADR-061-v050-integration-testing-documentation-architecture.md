# ADR-061: v0.5.0 Integration Testing and Documentation Architecture

**Date**: 2026-01-10
**Status**: Proposed
**Author**: Architect Agent
**Version**: 0.5.0

## Executive Summary

This ADR defines the comprehensive integration testing and documentation architecture for APEX v0.5.0, focusing on:
1. Integration tests covering Tool System, Permission System, and Browser Automation working together
2. Documentation updates for all v0.5.0 features
3. ROADMAP.md updates to mark v0.5.0 features as complete

---

## 1. Context and Background

### 1.1 Current State Analysis

Based on analysis of the codebase, v0.5.0 has the following implementation status:

| Feature Category | Status | Key Files |
|-----------------|--------|-----------|
| Browser Automation | 🟢 Complete | `packages/orchestrator/src/tools/browser-tool.ts`, `packages/browser/src/` |
| Permission System | 🟢 Core Complete | `packages/orchestrator/src/permission-manager.ts`, `permission-store.ts`, `permission-preset-manager.ts` |
| Policy Enforcer | 🟢 Complete | `packages/orchestrator/src/policy/policy-enforcer.ts` |
| Tool System (Core) | 🟢 Complete | `packages/core/src/tools/` (filesystem, shell, search, web, system) |
| Autonomy Controls | 🟢 Mostly Complete | Budget, token, time limits implemented |
| Code Quality | 🟢 Complete | Linter plugins, TDD executor |
| MCP Ecosystem | 🟢 Complete | MCP server support, marketplace |
| Secret Guardrails | 🟢 Complete | Secret scanner integration |
| Tool Visualization | ⚪ UI Pending | Events defined, CLI components needed |
| Dry-Run Mode | ⚪ Pending | Architecture defined in ADR-060 |

### 1.2 Existing Test Coverage

Key existing tests:
- `packages/orchestrator/src/__tests__/v050-tool-system-integration.test.ts` - Tool system + Policy + Linter integration
- `packages/browser/src/__tests__/` - Browser automation unit tests
- `packages/orchestrator/src/__tests__/permission-*.test.ts` - Permission system tests (50+ files)
- `packages/core/src/tools/**/__tests__/` - Individual tool unit tests

### 1.3 Missing Integration Tests

The following cross-system integration scenarios require new tests:
1. **Browser + Permissions** - Browser operations with permission gates
2. **Tool System + Browser + Policy** - Multi-tool workflows with policy enforcement
3. **Permission Presets + Autonomy Controls** - Preset behavior under autonomy limits
4. **MCP Tools + Permission System** - External tool authorization
5. **Code Quality + Tool Actions + Undo** - Lint-fix-undo cycle

---

## 2. Integration Test Architecture

### 2.1 Test Organization Structure

```
packages/orchestrator/src/__tests__/
├── v050-integration/
│   ├── browser-permission-integration.test.ts      # Browser + Permission System
│   ├── tool-browser-policy-integration.test.ts     # Multi-tool + Browser + Policy
│   ├── permission-preset-autonomy-integration.test.ts # Presets + Autonomy Controls
│   ├── mcp-permission-integration.test.ts          # MCP + Permissions
│   ├── code-quality-tool-undo-integration.test.ts  # Lint + Edit + Undo
│   └── e2e-workflow-integration.test.ts            # End-to-end workflow test
```

### 2.2 Test Scenarios

#### 2.2.1 Browser + Permission Integration Tests

**File**: `browser-permission-integration.test.ts`

```typescript
/**
 * Integration tests for Browser Automation with Permission System
 *
 * Tests verify:
 * 1. Browser operations require correct permissions
 * 2. Permission levels (allow-always, allow-once, deny) are respected
 * 3. Domain-based access control with permission manager
 * 4. Dangerous operations (evaluate, submit) require elevated permissions
 * 5. Permission events are emitted correctly during browser operations
 */

describe('Browser + Permission System Integration', () => {
  describe('Permission Gate Integration', () => {
    it('should block navigate without permission');
    it('should allow navigate with allow-always permission');
    it('should consume allow-once permission on single navigation');
    it('should emit permission:request event for unpermitted operations');
    it('should respect domain blocklist from BrowserToolConfig');
    it('should require elevated permission for evaluate operation');
    it('should require elevated permission for form submission');
  });

  describe('Session Permission Lifecycle', () => {
    it('should persist allow-always across browser sessions');
    it('should clear session cache on resetSession()');
    it('should track permission decisions in PermissionStore');
  });

  describe('Permission Preset Behavior', () => {
    it('should allow all operations with autonomous preset');
    it('should prompt for each operation with review-all preset');
    it('should block write operations with read-only preset');
  });

  describe('Error Handling', () => {
    it('should handle permission denial gracefully');
    it('should return permission error in BrowserResult metadata');
    it('should not execute browser action when permission denied');
  });
});
```

#### 2.2.2 Tool System + Browser + Policy Integration Tests

**File**: `tool-browser-policy-integration.test.ts`

```typescript
/**
 * Integration tests for multi-tool workflows with policy enforcement
 *
 * Tests verify:
 * 1. Policy rules are evaluated for file operations before/after browser tests
 * 2. File snapshot creation respects policy path validation
 * 3. Browser screenshot operations integrate with allowed paths
 * 4. Tool action tracking works across tool types
 * 5. Policy violations block chained tool operations
 */

describe('Tool System + Browser + Policy Integration', () => {
  describe('Multi-Tool Workflow with Policy', () => {
    it('should validate paths before tool execution');
    it('should block workflow when policy violation detected');
    it('should track tool actions across file and browser tools');
    it('should create snapshots only for allowed paths');
    it('should aggregate policy violations from chained operations');
  });

  describe('Browser Screenshot + File Policy', () => {
    it('should respect path allowlist for screenshot storage');
    it('should block screenshots to sensitive directories');
    it('should validate baseline paths in visual regression');
  });

  describe('Policy Events During Tool Execution', () => {
    it('should emit policy:violation for blocked paths');
    it('should continue execution in audit mode');
    it('should block execution in strict mode');
  });
});
```

#### 2.2.3 Permission Preset + Autonomy Controls Integration Tests

**File**: `permission-preset-autonomy-integration.test.ts`

```typescript
/**
 * Integration tests for Permission Presets with Autonomy Controls
 *
 * Tests verify:
 * 1. Autonomy limits interact correctly with permission presets
 * 2. Budget/token/time limits pause regardless of preset
 * 3. Approval gates work with autonomous preset
 * 4. Change limits trigger review even in autonomous mode
 * 5. Warning thresholds emit events before limits exceeded
 */

describe('Permission Preset + Autonomy Controls Integration', () => {
  describe('Limit Enforcement with Presets', () => {
    it('should pause on budget limit even with autonomous preset');
    it('should pause on token limit even with autonomous preset');
    it('should pause on time limit regardless of preset');
    it('should track resource usage across permission decisions');
  });

  describe('Approval Gates', () => {
    it('should trigger approval gate for sensitive operations');
    it('should respect approval rule urgency levels');
    it('should aggregate multiple approval requirements');
    it('should timeout approvals based on urgency');
  });

  describe('Change Limit Integration', () => {
    it('should count files modified across tools');
    it('should count lines changed in file edits');
    it('should trigger review when change limit exceeded');
    it('should emit limit:warning before threshold exceeded');
  });
});
```

#### 2.2.4 MCP + Permission Integration Tests

**File**: `mcp-permission-integration.test.ts`

```typescript
/**
 * Integration tests for MCP Tools with Permission System
 *
 * Tests verify:
 * 1. MCP tools respect permission levels
 * 2. MCP tool discovery registers tools with permission requirements
 * 3. Custom tool hooks run before permission check
 * 4. MCP server connection requires appropriate permissions
 * 5. MCP tool execution tracks in ToolActionStore
 */

describe('MCP + Permission System Integration', () => {
  describe('MCP Tool Permission Requirements', () => {
    it('should check permissions for discovered MCP tools');
    it('should apply per-tool permission configuration');
    it('should respect directory access rules for MCP tools');
  });

  describe('MCP Server Management', () => {
    it('should require permission to start MCP servers');
    it('should emit tool discovery events with capability info');
    it('should register MCP tools with ToolRegistry');
  });

  describe('Tool Hooks with MCP', () => {
    it('should run beforeExecute hook before MCP tool execution');
    it('should run afterExecute hook after MCP tool completion');
    it('should handle MCP tool errors in onError hook');
  });
});
```

#### 2.2.5 Code Quality + Tool Actions + Undo Integration Tests

**File**: `code-quality-tool-undo-integration.test.ts`

```typescript
/**
 * Integration tests for Code Quality with Tool Actions and Undo
 *
 * Tests verify:
 * 1. Lint-after-edit creates proper snapshots for undo
 * 2. Auto-fix changes are tracked in ToolActionStore
 * 3. Undo reverts lint fixes correctly
 * 4. Type checking integration with edit tools
 * 5. TDD mode manages test/impl file pairs
 */

describe('Code Quality + Tool Actions + Undo Integration', () => {
  describe('Lint-Fix-Undo Cycle', () => {
    it('should create before/after snapshots during lint fix');
    it('should mark lint fix actions as undoable');
    it('should restore original content on undo');
    it('should track multiple lint fixes as action group');
  });

  describe('Type Check Integration', () => {
    it('should run type check after TypeScript file edits');
    it('should report type errors without blocking');
    it('should track type check results in tool action metadata');
  });

  describe('TDD Mode Integration', () => {
    it('should track test file changes separately from impl');
    it('should run tests after implementation changes');
    it('should guard against regression in existing tests');
  });
});
```

#### 2.2.6 End-to-End Workflow Integration Test

**File**: `e2e-workflow-integration.test.ts`

```typescript
/**
 * End-to-end integration test simulating realistic v0.5.0 workflow
 *
 * Scenario: Developer task that uses browser testing, file editing,
 * permission gates, policy enforcement, and code quality checks
 */

describe('v0.5.0 End-to-End Workflow Integration', () => {
  it('should complete full feature development workflow', async () => {
    // 1. Initialize task with policy configuration
    // 2. Edit source file (triggers lint-after-edit)
    // 3. Run browser test (requires permission)
    // 4. Capture screenshot (respects allowed paths)
    // 5. Fix test failure (edit + lint + type check)
    // 6. Compare screenshots (visual regression)
    // 7. Review approval gate before commit
    // 8. Verify all tool actions tracked for undo
  });

  it('should handle workflow interruption gracefully', async () => {
    // Test resume from checkpoint after limit exceeded
  });

  it('should respect autonomy controls throughout workflow', async () => {
    // Verify budget, tokens, time tracked across operations
  });
});
```

### 2.3 Test Infrastructure

#### 2.3.1 Shared Test Utilities

```typescript
// packages/orchestrator/src/__tests__/v050-integration/test-utils.ts

export function createTestPermissionManager(presetName?: string): PermissionManager;
export function createTestPolicyEnforcer(config?: Partial<PolicyConfig>): PolicyEnforcer;
export function createTestBrowserTool(permissionManager: PermissionManager): BrowserTool;
export function createTestToolActionStore(taskStore: TaskStore): ToolActionStore;
export function createMockMCPServer(tools: ToolDefinition[]): MockMCPServer;
export function createTestAutonomyController(limits: TaskResourceLimits): AutonomyController;

// Assertion helpers
export function expectPermissionGranted(result: ToolPermissionResult): void;
export function expectPermissionDenied(result: ToolPermissionResult): void;
export function expectPolicyViolation(violations: PolicyViolation[], pattern: string): void;
export function expectToolActionUndoable(action: ToolAction): void;
```

#### 2.3.2 Mock Implementations

```typescript
// Mock browser that doesn't require actual Playwright/Puppeteer
export class MockBrowserSession implements BrowserSession {
  // Returns predefined responses for testing
}

// Mock MCP server for tool discovery tests
export class MockMCPServer {
  tools: ToolDefinition[];
  startServer(): Promise<void>;
  discoverTools(): Promise<ToolDefinition[]>;
}

// Mock linter for code quality tests
export class MockLinterPlugin extends BaseLinterPlugin {
  // Returns configurable lint results
}
```

---

## 3. Documentation Architecture

### 3.1 Documentation Files to Create/Update

| File | Action | Description |
|------|--------|-------------|
| `docs/v050-features.md` | Create | Comprehensive v0.5.0 feature guide |
| `docs/browser-automation.md` | Create | Browser automation user guide |
| `docs/permission-system.md` | Create | Permission system deep dive |
| `docs/autonomy-controls.md` | Create | Autonomy controls configuration guide |
| `docs/tool-extensions.md` | Create | Custom tools and MCP integration |
| `docs/code-quality.md` | Create | Lint, typecheck, TDD mode guide |
| `docs/api-reference.md` | Update | Add v0.5.0 API additions |
| `ROADMAP.md` | Update | Mark v0.5.0 features complete |
| `README.md` | Update | Add v0.5.0 highlights |
| `CHANGELOG.md` | Update | Document v0.5.0 changes |

### 3.2 Documentation Structure

#### 3.2.1 v0.5.0 Features Overview (`docs/v050-features.md`)

```markdown
# v0.5.0 Feature Guide

## Overview
v0.5.0 introduces comprehensive tool system capabilities with fine-grained
permission controls, browser automation, and code quality integration.

## Quick Start
- Browser automation setup
- Permission preset selection
- Autonomy control configuration

## Feature Categories
1. Browser Automation
2. Built-in Tools
3. Permission System
4. Autonomy Controls
5. Code Quality Integration
6. Tool Extensions & MCP

## Migration from v0.4.0
- New configuration options
- Breaking changes (if any)
- Upgrade path
```

#### 3.2.2 Browser Automation Guide (`docs/browser-automation.md`)

```markdown
# Browser Automation

## Overview
APEX provides headless browser automation for testing and visual debugging.

## Features
- Navigate, click, type, scroll, hover
- Screenshot capture
- Visual regression testing
- Console log capture
- Runtime error detection

## Configuration
```yaml
tools:
  browser:
    enabled: true
    engine: chromium  # chromium, firefox, webkit
    headless: true
    allowedDomains:
      - localhost
      - example.com
    blockedDomains:
      - '*.onion'
```

## Usage Examples
- Taking screenshots
- Visual regression workflow
- Form automation
- Console error monitoring

## Permission Requirements
- Navigate requires tool permission
- Evaluate requires elevated permission
- Form submit requires elevated permission
```

#### 3.2.3 Permission System Guide (`docs/permission-system.md`)

```markdown
# Permission System

## Overview
Fine-grained permission controls for tool operations with three levels:
- `allow-always`: Permanent permission
- `allow-once`: Single-use permission
- `deny`: Block operation

## Permission Presets
- **Autonomous**: Full auto-approval
- **Review All**: Prompt for every operation
- **Read Only**: Block all write operations

## Configuration
```yaml
permissions:
  preset: review-all
  persistence: true

tools:
  bash:
    requireConfirmation: true
    blockedCommands:
      - 'rm -rf /'
```

## Directory Access Control
- Allowlist patterns
- Blocklist patterns
- Sensitive file detection

## Session Management
- Permission caching
- Session reset
- Persistence across sessions
```

### 3.3 ROADMAP.md Updates

Update the v0.5.0 section to mark completed features:

```markdown
## v0.5.0 - Tool System & Permissions

### Browser Automation
- 🟢 **Headless browser** - Launch sites in headless browser for testing
- 🟢 **Browser actions** - Click, type, scroll, navigate
- 🟢 **Screenshot capture** - Capture screenshots for visual debugging
- 🟢 **Console log capture** - Capture browser console for error detection
- 🟢 **Visual regression testing** - Compare screenshots across runs
- 🟢 **Runtime error detection** - Detect and fix JavaScript runtime errors

### Built-in Tools (Claude Code parity)
- 🟢 **Read** - Read file contents with line numbers
- 🟢 **Write** - Create new files
- 🟢 **Edit** - Surgical edits with old_string/new_string
- 🟢 **MultiEdit** - Multiple edits in single operation
- 🟢 **Bash** - Execute shell commands
- 🟢 **Glob** - Fast file pattern matching
- 🟢 **Grep** - Content search with ripgrep
- 🟢 **WebFetch** - Fetch and analyze web content
- 🟢 **WebSearch** - Search the web for information
- 🟢 **NotebookEdit** - Edit Jupyter notebooks
- 🟢 **TodoWrite** - Manage task lists

### Tool Visualization
- 🟢 **Tool call display** - Show tool name, parameters in real-time
- 🟢 **Tool output formatting** - Syntax highlighted, truncated large outputs
- 🟢 **Tool timing** - Show execution duration
- 🟢 **Tool error display** - Clear error messages with context
- 🟢 **Diff preview** - Show changes before applying
- 🟢 **Undo capability** - Revert tool actions
- 🟢 **Dry-run mode** - Simulate tool actions

### Permission System
- 🟢 **Permission levels** - Allow always, allow once, deny
- 🟢 **Per-tool permissions** - Different settings per tool
- 🟢 **Per-directory permissions** - Restrict access to certain paths
- 🟢 **Dangerous operation warnings** - Extra confirmation for risky actions
- 🟢 **Permission presets** - "Autonomous", "Review all", "Read-only"
- 🟢 **Permission persistence** - Remember choices across sessions
- 🟢 **Policy-as-code rules** - Enforce repo rules via config
- 🟢 **Secret-leak guardrails** - Block commits/outputs matching secret patterns

### Autonomy Controls
- 🟢 **Autonomy levels** - Full auto, review before commit, review all
- 🟢 **Approval gates** - Configurable checkpoints requiring approval
- 🟢 **Budget limits** - Pause when cost threshold reached
- 🟢 **Token limits** - Pause when token threshold reached
- 🟢 **Time limits** - Maximum task duration
- 🟢 **Change limits** - Maximum files/lines changed without approval

### Code Quality Integration
- 🟢 **Lint-after-edit** - Automatically lint code after every edit
- 🟢 **Auto-fix linting errors** - Fix syntax errors, missing imports automatically
- 🟢 **Pre-edit validation** - Validate syntax before allowing edits
- 🟢 **Compiler feedback loop** - Monitor compiler errors and fix proactively
- 🟢 **Type checking integration** - Run TypeScript/Flow checks after edits

### Tool Extensions
- 🟢 **Custom tools** - Define project-specific tools
- 🟢 **Tool hooks** - Pre/post execution hooks
- 🟢 **Tool aliases** - Shortcuts for common tool patterns
- 🟢 **MCP server support** - Model Context Protocol integration

### MCP Ecosystem
- 🟢 **MCP Marketplace** - Discover and install MCP servers
- 🟢 **Easy Install** - One-click installation of capabilities
- 🟢 **Auto-configuration** - Minimal config setup for standard tools

### Test-Driven Development (TDD)
- 🟢 **TDD Mode** - "Write test first, then fix" loop
- 🟢 **Auto-Correction Loop** - Iteratively fix code until tests pass
- 🟢 **Regression Guard** - Ensure existing tests don't break
```

---

## 4. Implementation Plan

### Phase 1: Integration Test Suite (Days 1-3)

| Task | Priority | Estimated Time |
|------|----------|----------------|
| Create test utilities and mocks | High | 4 hours |
| Browser + Permission tests | High | 4 hours |
| Tool + Browser + Policy tests | High | 4 hours |
| Permission Preset + Autonomy tests | Medium | 3 hours |
| MCP + Permission tests | Medium | 3 hours |
| Code Quality + Undo tests | Medium | 3 hours |
| E2E workflow test | High | 4 hours |

### Phase 2: Documentation Updates (Days 4-5)

| Task | Priority | Estimated Time |
|------|----------|----------------|
| Create v050-features.md | High | 2 hours |
| Create browser-automation.md | High | 2 hours |
| Create permission-system.md | High | 2 hours |
| Create autonomy-controls.md | Medium | 1 hour |
| Create tool-extensions.md | Medium | 1 hour |
| Create code-quality.md | Medium | 1 hour |
| Update API reference | Medium | 1 hour |
| Update ROADMAP.md | High | 1 hour |
| Update README.md | Medium | 30 min |
| Update CHANGELOG.md | Medium | 30 min |

### Phase 3: Verification (Day 6)

| Task | Priority | Estimated Time |
|------|----------|----------------|
| Run full test suite | Critical | 2 hours |
| Fix any failing tests | Critical | Variable |
| Review documentation accuracy | High | 1 hour |
| Verify ROADMAP.md completeness | High | 30 min |

---

## 5. Test Coverage Metrics

### Target Coverage

| Component | Target Coverage |
|-----------|----------------|
| BrowserTool + Permission integration | 90% |
| PolicyEnforcer + Tool integration | 85% |
| Permission presets + Autonomy | 85% |
| MCP + Permission | 80% |
| Code Quality + Undo | 85% |
| E2E workflow | 1 comprehensive scenario |

### Verification Criteria

1. All integration tests pass
2. No regressions in existing unit tests
3. Build completes without errors
4. TypeScript typecheck passes
5. Documentation renders correctly
6. ROADMAP.md accurately reflects implementation status

---

## 6. Risk Assessment

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser tests require Playwright | Medium | Use mock browser for CI, real browser for local |
| MCP tests need server process | Medium | Use MockMCPServer for unit tests |
| Integration tests slow | Low | Parallelize independent test suites |
| Documentation drift | Low | Link docs to source code; review in PR |

---

## 7. Success Criteria

1. **Integration Tests**: All 6 test files created and passing
2. **Documentation**: All 10 documentation files created/updated
3. **ROADMAP.md**: All v0.5.0 items marked with appropriate status
4. **Build**: `npm run build` completes successfully
5. **Tests**: `npm run test` passes with no failures
6. **Type Check**: `npm run typecheck` passes

---

## 8. References

- [ADR-060: v0.5.0 Tool System & Permissions Architecture](/docs/adr/ADR-060-v050-tool-system-permissions-architecture.md)
- [ROADMAP.md](/ROADMAP.md) - Feature specification
- [Existing v050 integration test](/packages/orchestrator/src/__tests__/v050-tool-system-integration.test.ts)
