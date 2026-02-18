# ADR: Permission and Autonomy Level Test Helpers

## Status
Proposed

## Context

APEX requires comprehensive test utilities to enable testing of:
1. Different autonomy levels (`full-auto`, `review-before-commit`, `review-all`)
2. Permission scenarios (allow-always, allow-once, deny)
3. Approval flows and gates
4. Permission denials and boundary conditions

Currently, the codebase has scattered test utilities across packages:
- `@apexcli/core/test-utils.ts` - Permission mocking, platform detection, assertion helpers
- `@apexcli/orchestrator/test-utils.ts` - Database utilities, task fixtures, permission store testing

This ADR proposes a unified architecture for **autonomy and permission test helpers** that will enable:
- Simulating different autonomy levels in isolation
- Testing approval gate flows (request, grant, deny, timeout)
- Testing permission boundaries and edge cases
- Integration testing of the complete permission/autonomy flow

## Decision

### Architecture Overview

We will create a new test utility module in `@apexcli/core` and extend the orchestrator test utilities:

```
packages/core/src/
└── test-utils/
    └── autonomy-helpers.ts    # NEW: Autonomy level simulation

packages/orchestrator/src/
└── test-utils/
    └── approval-gate-helpers.ts  # NEW: Approval gate testing
    └── permission-flow-helpers.ts # NEW: Complete permission flow testing
```

### Component Design

#### 1. Autonomy Level Test Helpers (`@apexcli/core/test-utils/autonomy-helpers.ts`)

```typescript
// Types for autonomy testing
export interface AutonomyTestContext {
  level: AutonomyLevel;
  gates: ApprovalGate[];
  limits: TaskResourceLimits;
  stageOverrides: Record<string, AutonomyLevel>;
  agentOverrides: Record<string, AutonomyLevel | AgentAutonomyOverride>;
}

export interface AutonomyScenario {
  name: string;
  description: string;
  config: AutonomyTestContext;
  expectedBehaviors: AutonomyExpectation[];
}

export interface AutonomyExpectation {
  action: string;
  operationType: 'read' | 'write' | 'execute' | 'network' | 'dangerous';
  requiresApproval: boolean;
  gateType?: ApprovalCheckpointType;
}

// Factory functions
export function createAutonomyTestContext(overrides?: Partial<AutonomyTestContext>): AutonomyTestContext;
export function createFullAutoContext(limits?: TaskResourceLimits): AutonomyTestContext;
export function createReviewBeforeCommitContext(gates?: ApprovalGate[]): AutonomyTestContext;
export function createReviewAllContext(limits?: TaskResourceLimits): AutonomyTestContext;

// Predefined scenarios
export function createAutonomyScenarios(): Record<string, AutonomyScenario>;

// Assertion helpers
export function assertAutonomyRequiresApproval(context: AutonomyTestContext, action: string, operationType: string): void;
export function assertAutonomyAllowsAction(context: AutonomyTestContext, action: string): void;
```

#### 2. Approval Gate Test Helpers (`@apexcli/orchestrator/test-utils/approval-gate-helpers.ts`)

```typescript
// Mock approval controller for testing
export interface MockApprovalGateController {
  requestApproval(): Promise<ApprovalResult>;
  grant(approver: string, comment?: string): Promise<void>;
  deny(denier: string, reason: string): Promise<void>;
  simulateTimeout(): Promise<void>;
  getState(): ApprovalState;
  reset(): void;
}

// Factory functions
export function createMockApprovalGate(config: Partial<ApprovalGateConfig>): MockApprovalGateController;
export function createAutoApproveGate(delayMs?: number): MockApprovalGateController;
export function createAutoDenyGate(reason?: string): MockApprovalGateController;
export function createTimeoutGate(timeoutMs: number): MockApprovalGateController;

// Approval flow simulation
export interface ApprovalFlowSimulator {
  registerGate(gateName: string, behavior: 'approve' | 'deny' | 'timeout' | 'pending'): void;
  setDefaultBehavior(behavior: 'approve' | 'deny' | 'timeout'): void;
  simulateApprovalRequest(gateName: string): Promise<ApprovalResult>;
  getApprovalHistory(): ApprovalHistoryEntry[];
  reset(): void;
}

export function createApprovalFlowSimulator(): ApprovalFlowSimulator;

// Assertion helpers
export function assertApprovalGranted(result: ApprovalResult): void;
export function assertApprovalDenied(result: ApprovalResult, expectedReason?: string): void;
export function assertApprovalTimeout(result: ApprovalResult): void;
export function assertApprovalPending(state: ApprovalState): void;
```

#### 3. Permission Flow Test Helpers (`@apexcli/orchestrator/test-utils/permission-flow-helpers.ts`)

```typescript
// Complete permission testing environment
export interface PermissionFlowTestEnvironment {
  // Core components
  permissionManager: PermissionManager;
  autonomyEnforcer: AutonomyEnforcer;
  approvalController: MockApprovalGateController;

  // Configuration
  setAutonomyLevel(level: AutonomyLevel): void;
  setPermissionPreset(preset: PermissionPreset): void;
  addCustomRule(rule: ToolPermissionRule): void;

  // Simulation
  simulateToolExecution(tool: string, scope?: string): Promise<PermissionFlowResult>;
  simulateApprovalFlow(gateName: string): Promise<ApprovalResult>;
  simulateBatchOperations(operations: ToolOperation[]): Promise<BatchPermissionResult>;

  // State management
  reset(): void;
  cleanup(): Promise<void>;

  // History & debugging
  getPermissionHistory(): PermissionFlowHistoryEntry[];
  getApprovalHistory(): ApprovalHistoryEntry[];
}

export interface PermissionFlowResult {
  allowed: boolean;
  level: PermissionLevel | null;
  requiresApproval: boolean;
  approvalResult?: ApprovalResult;
  denialReason?: string;
}

// Factory function
export function createPermissionFlowTestEnvironment(options?: {
  autonomyLevel?: AutonomyLevel;
  permissionPreset?: PermissionPreset;
  initialPermissions?: Permission[];
  mockApprovals?: Record<string, 'approve' | 'deny' | 'timeout'>;
}): Promise<PermissionFlowTestEnvironment>;

// Predefined scenarios for common testing patterns
export function createPermissionBoundaryScenarios(): Record<string, PermissionBoundaryScenario>;
export function createApprovalFlowScenarios(): Record<string, ApprovalFlowScenario>;
```

### Integration with Existing Utilities

The new helpers integrate with existing test utilities:

```typescript
// Example usage combining existing and new utilities
import { createMockPermission, createCommonPermissionScenarios } from '@apexcli/core/test-utils';
import { createPermissionFlowTestEnvironment } from '@apexcli/orchestrator/test-utils/permission-flow-helpers';
import { createAutonomyTestContext } from '@apexcli/core/test-utils/autonomy-helpers';

describe('Autonomy and Permission Integration', () => {
  let testEnv: PermissionFlowTestEnvironment;

  beforeEach(async () => {
    testEnv = await createPermissionFlowTestEnvironment({
      autonomyLevel: 'review-before-commit',
      permissionPreset: 'review-all',
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('should require approval for write operations in review-all mode', async () => {
    const result = await testEnv.simulateToolExecution('Write', '/project/file.ts');
    expect(result.requiresApproval).toBe(true);
  });
});
```

### Key Design Decisions

1. **Separation of Concerns**:
   - Core types and context creation in `@apexcli/core`
   - Database-dependent utilities in `@apexcli/orchestrator`

2. **Composable Design**: Each helper can be used independently or composed together

3. **Mock-First Approach**: All helpers provide mock implementations that don't require actual database connections by default

4. **Scenario-Based Testing**: Predefined scenarios for common test patterns reduce boilerplate

5. **Stateful Simulation**: Approval flow simulators maintain state for complex multi-step testing

### File Organization

```
packages/core/src/
├── test-utils.ts                    # Existing - re-exports all test utilities
├── test-utils/
│   ├── index.ts                     # Barrel export
│   ├── platform-helpers.ts          # Existing platform detection (refactored)
│   ├── permission-mocks.ts          # Existing permission mocks (refactored)
│   └── autonomy-helpers.ts          # NEW: Autonomy level simulation

packages/orchestrator/src/
├── test-utils.ts                    # Existing - re-exports all test utilities
├── test-utils/
│   ├── index.ts                     # Barrel export
│   ├── database-helpers.ts          # Existing DB utilities (refactored)
│   ├── task-fixtures.ts             # Existing task fixtures (refactored)
│   ├── permission-store-helpers.ts  # Existing permission store (refactored)
│   ├── approval-gate-helpers.ts     # NEW: Approval gate testing
│   └── permission-flow-helpers.ts   # NEW: Complete permission flow testing
```

## Consequences

### Positive
- Unified testing approach for permission and autonomy features
- Reduced test boilerplate with predefined scenarios
- Easier integration testing of complex permission flows
- Better test isolation through mock-first design
- Improved developer experience for testing permission-related features

### Negative
- Some code restructuring required to extract existing utilities
- Learning curve for new testing patterns
- Additional maintenance burden for test utilities

### Neutral
- Test helpers are implementation-agnostic and can evolve with the system
- Existing tests can be gradually migrated to use new helpers

## Implementation Plan

### Phase 1: Core Autonomy Helpers
1. Create `packages/core/src/test-utils/autonomy-helpers.ts`
2. Implement `AutonomyTestContext` and factory functions
3. Implement predefined autonomy scenarios
4. Add assertion helpers

### Phase 2: Approval Gate Helpers
1. Create `packages/orchestrator/src/test-utils/approval-gate-helpers.ts`
2. Implement `MockApprovalGateController`
3. Implement `ApprovalFlowSimulator`
4. Add assertion helpers

### Phase 3: Permission Flow Integration
1. Create `packages/orchestrator/src/test-utils/permission-flow-helpers.ts`
2. Implement `PermissionFlowTestEnvironment`
3. Integrate with existing permission utilities
4. Add comprehensive scenarios

### Phase 4: Documentation & Migration
1. Update existing test utilities to use new structure
2. Add JSDoc documentation
3. Create usage examples
4. Update existing tests to demonstrate patterns

## References

- Existing utilities: `packages/core/src/test-utils.ts`
- Existing utilities: `packages/orchestrator/src/test-utils.ts`
- Permission types: `packages/core/src/types.ts` (lines 100-130, 6810-7000)
- Autonomy types: `packages/core/src/types.ts` (lines 1480-1720)
- Approval gate controller: `packages/orchestrator/src/approval-gate-controller.ts`
- Autonomy enforcer: `packages/orchestrator/src/autonomy-enforcer.ts`
