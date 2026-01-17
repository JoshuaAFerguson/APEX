# ADR-065: Shared Confirmation Flow Test Fixtures Module

## Status
Accepted

## Date
2025-01-17

## Context

The APEX codebase has extensive testing for confirmation flows including:
- Permission request/granted/denied events
- Dangerous operation detection/confirmation/blocking events
- Approval gate events (required/granted/denied/timeout)

Currently, test files create their own mock data inline, leading to:
1. **Duplication**: Same mock structures repeated across multiple test files
2. **Inconsistency**: Different tests may use slightly different mock structures
3. **Maintenance burden**: Changes to types require updates in multiple places
4. **Missing coverage**: Some edge cases may not be tested consistently

The existing `packages/core/src/test-utils.ts` provides factory functions for permission-related types, but there's no centralized module for confirmation flow test scenarios.

## Decision

Create a new shared test fixtures module at `tests/fixtures/confirmation-flows.ts` that provides:

### 1. Mock Confirmation Request Factories
Factory functions for creating mock data for all confirmation types:
- `createMockPermissionRequest()` - Permission request events
- `createMockDangerousOperation()` - Dangerous operation detection events
- `createMockApprovalRequest()` - Approval gate events

### 2. Standard Test Scenarios
Pre-built scenarios for common test cases:
- **Approve scenarios**: Permission granted, operation confirmed, approval granted
- **Deny scenarios**: Permission denied, operation blocked, approval denied
- **Timeout scenarios**: Approval timeout with configurable behavior

### 3. Parameterized Fixture Generators
Higher-order functions for generating fixtures with specific characteristics:
- `generatePermissionMatrix()` - All combinations of tools and permission levels
- `generateRiskLevelScenarios()` - Dangerous operations at each risk level
- `generateTimeoutScenarios()` - Various timeout configurations

## Technical Design

### File Structure
```
tests/fixtures/
└── confirmation-flows.ts    # Main fixtures module
```

### Type Dependencies
The module will import types from:
- `@apexcli/core` - Permission and approval event types
- `@apex/orchestrator` - OrchestratorEvents and event data interfaces

### Interface Design

```typescript
// === Type Imports ===
import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalResolvedEventData,
  PermissionLevel,
} from '@apexcli/core';

// === Factory Function Signatures ===

/**
 * Factory for creating mock permission request events
 */
export function createMockPermissionRequest(
  overrides?: Partial<PermissionRequestEventData>
): PermissionRequestEventData;

/**
 * Factory for creating mock dangerous operation events
 */
export function createMockDangerousOperationDetected(
  overrides?: Partial<DangerousOperationDetectedEventData>
): DangerousOperationDetectedEventData;

/**
 * Factory for creating mock approval request events
 */
export function createMockApprovalRequired(
  overrides?: Partial<ApprovalRequiredEventData>
): ApprovalRequiredEventData;

// === Standard Test Scenarios ===

export interface ConfirmationScenario<TRequest, TResponse> {
  name: string;
  description: string;
  request: TRequest;
  response: TResponse;
  expectedOutcome: 'approved' | 'denied' | 'timeout' | 'blocked';
}

/**
 * Pre-built permission flow scenarios
 */
export const PERMISSION_SCENARIOS: {
  approved: ConfirmationScenario<PermissionRequestEventData, PermissionGrantedEventData>[];
  denied: ConfirmationScenario<PermissionRequestEventData, PermissionDeniedEventData>[];
};

/**
 * Pre-built dangerous operation scenarios
 */
export const DANGEROUS_OPERATION_SCENARIOS: {
  confirmed: ConfirmationScenario<DangerousOperationDetectedEventData, DangerousOperationConfirmedEventData>[];
  blocked: ConfirmationScenario<DangerousOperationDetectedEventData, DangerousOperationBlockedEventData>[];
};

/**
 * Pre-built approval gate scenarios
 */
export const APPROVAL_SCENARIOS: {
  approved: ConfirmationScenario<ApprovalRequiredEventData, ApprovalGrantedEventData>[];
  denied: ConfirmationScenario<ApprovalRequiredEventData, ApprovalDeniedEventData>[];
  timeout: ConfirmationScenario<ApprovalRequiredEventData, ApprovalResolvedEventData>[];
};

// === Parameterized Generators ===

export interface PermissionMatrixEntry {
  tool: string;
  level: PermissionLevel;
  request: PermissionRequestEventData;
  grantedResponse: PermissionGrantedEventData;
  deniedResponse: PermissionDeniedEventData;
}

/**
 * Generate permission scenarios for all tool/level combinations
 */
export function generatePermissionMatrix(
  tools?: string[]
): PermissionMatrixEntry[];

export interface RiskLevelScenario {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  operation: DangerousOperationDetectedEventData;
  confirmedResponse: DangerousOperationConfirmedEventData;
  blockedResponse: DangerousOperationBlockedEventData;
}

/**
 * Generate dangerous operation scenarios for each risk level
 */
export function generateRiskLevelScenarios(): RiskLevelScenario[];

export interface TimeoutScenario {
  name: string;
  timeoutMinutes: number;
  timeoutAction: 'reject' | 'approve' | 'escalate';
  request: ApprovalRequiredEventData;
  expectedResolution: ApprovalResolvedEventData;
}

/**
 * Generate timeout scenarios with various configurations
 */
export function generateTimeoutScenarios(): TimeoutScenario[];
```

### Usage Patterns

```typescript
// Basic factory usage
const request = createMockPermissionRequest({ tool: 'Write' });

// Pre-built scenarios
PERMISSION_SCENARIOS.approved.forEach(scenario => {
  it(`should handle ${scenario.name}`, () => {
    // test implementation
  });
});

// Parameterized matrix testing
generatePermissionMatrix(['Read', 'Write', 'Bash']).forEach(entry => {
  describe(`${entry.tool} at ${entry.level}`, () => {
    it('should grant permission', () => { /* ... */ });
    it('should deny permission', () => { /* ... */ });
  });
});
```

## Implementation Notes

### Consistency with Existing Patterns
- Follow the factory function pattern from `packages/core/src/test-utils.ts`
- Use `Partial<T>` overrides pattern for flexibility
- Generate unique IDs using timestamp + random suffix pattern

### ID Generation
```typescript
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### Timestamp Handling
- All timestamps should use `new Date()` by default
- Allow override via factory parameters for deterministic testing

### Tool Categories Covered
- **Read-only**: Read, Grep, Glob
- **Write**: Write, Edit, MultiEdit
- **Execute**: Bash
- **Network**: WebFetch, WebSearch
- **System**: TodoWrite, NotebookEdit

### Risk Levels Covered
- **low**: Informational operations
- **medium**: Potentially reversible operations
- **high**: Significant system changes
- **critical**: Irreversible or dangerous operations

### Timeout Configurations
- Standard timeout (60 minutes)
- Quick timeout (5 minutes)
- Extended timeout (24 hours)
- No timeout (undefined)

## Consequences

### Positive
1. **Reduced duplication** - Single source of truth for test data
2. **Consistent testing** - All tests use the same mock structures
3. **Easier maintenance** - Type changes only require updates in one place
4. **Better coverage** - Parameterized generators ensure comprehensive testing
5. **Improved readability** - Descriptive scenario names and documentation

### Negative
1. **Additional dependency** - Tests must import from fixtures module
2. **Learning curve** - Developers need to learn the fixture API
3. **Potential over-engineering** - Simple tests may not need complex fixtures

### Neutral
1. **Module location** - Placed in `tests/fixtures/` to be accessible across test types

## References
- `packages/core/src/test-utils.ts` - Existing test utility patterns
- `packages/core/src/types.ts` - Type definitions for confirmation events
- `packages/orchestrator/src/index.ts` - Orchestrator event interfaces
