# APEX Test Helpers

This directory contains comprehensive test helpers for testing permission and autonomy scenarios in the APEX system.

## Overview

The test helpers provide utilities for:

- **Permission Testing**: Simulating different permission levels, approval flows, and denial scenarios
- **Autonomy Level Testing**: Testing different autonomy levels and their approval requirements
- **Boundary Condition Testing**: Validating autonomy boundaries and checkpoint requirements
- **Mock Systems**: Mock permission managers and approval systems for isolated testing

## Files

### `permission-test-helpers.ts`
Comprehensive utilities for testing permission scenarios:

- `PermissionTestHelpers`: Main class for permission testing utilities
- `MockPermissionManager`: Mock permission manager for controlled testing scenarios
- `PermissionTestScenarios`: Pre-configured test scenarios for common patterns

### `autonomy-test-helpers.ts`
Comprehensive utilities for testing autonomy level scenarios:

- `AutonomyTestHelpers`: Main class for autonomy testing utilities
- `MockApprovalSystem`: Mock approval system for testing approval flows
- `AutonomyTestScenarios`: Pre-configured test scenarios for autonomy patterns

### `index.ts`
Central export file providing all helpers and a combined `ApexTestHelpers` class.

### `validation.ts`
Simple validation script to verify helper functionality without requiring a full test runner.

## Usage Examples

### Basic Permission Testing

```typescript
import { PermissionTestHelpers } from './helpers';

const helpers = new PermissionTestHelpers();

// Create a permission
const permission = helpers.createPermission('Write', 'allow-always');

// Simulate approval/denial
const approved = helpers.simulatePermissionApproval('Read');
const denied = helpers.simulatePermissionDenial('Delete', '/important');

// Use mock permission manager
const manager = helpers.getMockPermissionManager();
manager.configurePermissionCheck('Shell', undefined, {
  allowed: true,
  level: 'allow-once',
  requiresConfirmation: false,
});
const result = manager.checkPermission('Shell');
```

### Basic Autonomy Testing

```typescript
import { AutonomyTestHelpers } from './helpers';

const helpers = new AutonomyTestHelpers();

// Create autonomy configurations
const fullAuto = helpers.createAutonomyConfig('full-auto');
const supervised = helpers.createAutonomyConfig('supervised', {
  includeGates: true,
  includeResourceLimits: true,
});

// Test autonomy boundaries
const boundary = helpers.testAutonomyBoundary({
  autonomyLevel: 'review-before-commit',
  action: 'git-commit',
  shouldRequireApproval: true,
  expectedCheckpoint: 'before-commit',
});

// Simulate approval flows
const gate = helpers.createApprovalGate('deploy', 'Deploy Gate', 'before-deploy');
const approval = helpers.simulateApprovalFlow({
  gate,
  outcome: 'approved',
  responseTimeMs: 3000,
});
```

### Combined Testing

```typescript
import { apexTestHelpers } from './helpers';

// Create integrated scenarios
const scenario = apexTestHelpers.createIntegratedScenario('review-all', 'allow-always');

// Access both permission and autonomy helpers
const permissionResult = apexTestHelpers.permission.simulatePermissionApproval('Write');
const autonomyConfig = apexTestHelpers.autonomy.createAutonomyConfig('supervised');

// Reset all state between tests
apexTestHelpers.reset();
```

### Pre-configured Scenarios

```typescript
import {
  PermissionTestScenarios,
  AutonomyTestScenarios,
  PermissionTestHelpers,
  AutonomyTestHelpers
} from './helpers';

const permissionHelpers = new PermissionTestHelpers();
const autonomyHelpers = new AutonomyTestHelpers();

// Apply pre-configured permission scenarios
PermissionTestScenarios.fullAccess(permissionHelpers);
PermissionTestScenarios.noAccess(permissionHelpers);
PermissionTestScenarios.mixedPermissions(permissionHelpers);

// Test autonomy boundaries across all levels
const boundaries = AutonomyTestScenarios.boundaryConditions(autonomyHelpers);
```

## Key Features

### Permission Test Helpers

1. **Permission Creation**: Create basic and extended permissions with metadata
2. **Scenario Simulation**: Simulate approval, denial, timeout, and confirmation scenarios
3. **Mock Manager**: Full mock permission manager with configurable behaviors
4. **Approval Flows**: Create approval requests and responses with realistic timings
5. **Common Scenarios**: Pre-built scenarios for typical permission patterns

### Autonomy Test Helpers

1. **Autonomy Configs**: Create autonomy configurations for all levels with optional gates/limits
2. **Approval Gates**: Create approval gates with various checkpoint types and configurations
3. **Boundary Testing**: Test autonomy boundaries to verify approval requirements
4. **Mock Approval System**: Full mock approval system for tracking requests/responses
5. **Flow Simulation**: Simulate complete approval flows with different outcomes

### Combined Helpers

1. **Integrated Scenarios**: Combine permission and autonomy testing
2. **Unified Reset**: Reset all mock state across both systems
3. **Cross-cutting Concerns**: Test interactions between permission and autonomy systems

## Test Coverage

The helpers enable comprehensive testing of:

- ✅ Permission approval flows
- ✅ Permission denial scenarios
- ✅ Autonomy level boundary conditions
- ✅ Approval gate configurations
- ✅ Approval timeout scenarios
- ✅ Allow-once permission consumption
- ✅ Multi-approval workflows
- ✅ Agent-specific autonomy overrides
- ✅ Stage-specific autonomy overrides
- ✅ Resource limit enforcement
- ✅ Rejection behavior handling
- ✅ Scope-based permissions
- ✅ Time-based permission expiry

## Architecture

The helpers are designed with:

- **Type Safety**: Full TypeScript typing with proper interfaces
- **Modularity**: Separate concerns for permissions vs autonomy
- **Extensibility**: Easy to add new scenarios and configurations
- **Testability**: Mock systems that are easy to configure and verify
- **Reusability**: Common scenarios and singleton instances for convenience
- **Integration**: Combined helpers for cross-cutting test scenarios

## Implementation

Built using APEX core types from `../../types.ts` including:

- `Permission`, `PermissionLevel`, `ToolPermissionResult`
- `AutonomyLevel`, `AutonomyConfig`, `ApprovalGate`
- `ApprovalRequest`, `ApprovalResponse`, `ApprovalCheckpointType`
- `TaskResourceLimits`, `AgentAutonomyOverride`

The helpers provide a comprehensive testing foundation for validating permission and autonomy behavior across the entire APEX system.