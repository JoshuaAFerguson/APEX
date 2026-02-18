# Approval Flow Test Utilities

This module provides comprehensive testing utilities for approval workflows in APEX. It enables testing of pending approvals, auto-approvals, rejections, timeouts, and multi-step approval chains.

## Features

- 🎯 **Mock Approval States** - Create approval states with configurable properties
- 🚧 **Mock Approval Gates** - Create approval gates for workflow testing
- 📝 **Predefined Scenarios** - Ready-to-use approval scenarios for common test cases
- 🔄 **Full Workflow Environment** - Complete test environment with event simulation
- ✅ **Assertion Helpers** - Built-in assertions for approval state validation
- ⏰ **Timeout Simulation** - Test approval timeouts and auto-approval behavior
- 🔗 **Multi-Step Chains** - Test complex approval workflows with dependencies

## Quick Start

```typescript
import {
  createApprovalFlowTestEnvironment,
  createApprovalScenario,
  ApprovalTestAssertions,
} from '@apexcli/orchestrator';

// Create test environment
const approvalFlow = await createApprovalFlowTestEnvironment();

try {
  // Create task with approval gates
  const { task } = await approvalFlow.createTaskWithApprovals({
    gates: [
      { type: 'before-deploy', name: 'deployment-approval', minApprovals: 2 }
    ]
  });

  // Request approval
  const approval = await approvalFlow.requestApproval(task.id, 'deployment-approval');

  // Grant approval
  await approvalFlow.grantApproval(approval.id, 'admin@example.com', 'Looks good!');

  // Assert approval state
  await ApprovalTestAssertions.assertApprovalStatus(
    approvalFlow.getStore(),
    approval.id,
    'approved'
  );

} finally {
  await approvalFlow.cleanup();
}
```

## Core APIs

### Factory Functions

#### `createMockApprovalState(config: ApprovalStateConfig): ApprovalState`

Creates a mock approval state with configurable properties.

```typescript
const approval = createMockApprovalState({
  taskId: 'task-123',
  gateName: 'security-review',
  status: 'pending',
  stage: 'review',
  agent: 'reviewer',
  timeoutMinutes: 30,
});
```

**Configuration Options:**
- `taskId` (required) - The task this approval belongs to
- `gateName` - Name of the gate (default: 'test-gate')
- `status` - Approval status: 'pending' | 'approved' | 'denied'
- `approver` - Who made the approval decision
- `comment` - Comment or reason for the decision
- `stage` - Workflow stage where approval was requested
- `agent` - Agent that triggered the approval
- `timeoutMinutes` - Timeout in minutes
- And more...

#### `createMockApprovalGate(config: ApprovalGateConfig): ApprovalGate`

Creates a mock approval gate for workflows.

```typescript
const gate = createMockApprovalGate({
  type: 'before-deploy',
  name: 'deployment-gate',
  minApprovals: 2,
  timeout: 60,
  approvers: ['admin@example.com', 'devops@example.com'],
});
```

**Gate Types:**
- `before-commit` - Code commit approval
- `before-deploy` - Deployment approval
- `before-destructive` - Destructive operation approval
- `before-network` - Network access approval
- `before-file-write` - File write approval
- `deployment` - General deployment gate
- `custom` - Custom gate type

### Predefined Scenarios

#### `createApprovalScenario(taskId: string, scenario: ApprovalScenario): ApprovalState[]`

Creates predefined approval scenarios for testing.

```typescript
// Test different scenarios
const scenarios = [
  'pending-approval',      // Single pending approval
  'auto-approval',         // Automatically approved
  'manual-approval',       // Manually approved by user
  'rejection',             // Denied approval
  'timeout',               // Approval that will timeout
  'multi-step-approval',   // 3-step approval process
  'approval-chain',        // Sequential approval chain
];

for (const scenario of scenarios) {
  const approvals = createApprovalScenario('task-123', scenario);
  console.log(`${scenario}: ${approvals.length} approval(s)`);
}
```

**Available Scenarios:**

1. **pending-approval**: Single approval waiting for decision
2. **auto-approval**: Instantly approved by system
3. **manual-approval**: Approved by user after review
4. **rejection**: Denied with reason
5. **timeout**: Approval with short timeout for testing
6. **multi-step-approval**: Three-stage approval process
7. **approval-chain**: Sequential approval dependencies

### Approval Flow Test Environment

#### `ApprovalFlowTestEnvironment`

Full-featured test environment for approval workflows.

```typescript
const env = await createApprovalFlowTestEnvironment();

// Create task with approvals
const { task, gates } = await env.createTaskWithApprovals({
  task: { description: 'Feature deployment' },
  gates: [
    { type: 'before-deploy', name: 'security-review' },
    { type: 'before-deploy', name: 'qa-approval' },
  ]
});

// Request approvals
const securityApproval = await env.requestApproval(task.id, 'security-review');
const qaApproval = await env.requestApproval(task.id, 'qa-approval');

// Listen for events
env.getEventEmitter().on('approval-granted', (data) => {
  console.log(`Approval granted: ${data.approvalId} by ${data.approver}`);
});

// Grant approvals
await env.grantApproval(securityApproval.id, 'security@example.com');
await env.grantApproval(qaApproval.id, 'qa@example.com');

// Check completion
const allComplete = await env.areAllApprovalsComplete(task.id);
console.log('All approvals complete:', allComplete);

await env.cleanup();
```

#### Key Methods

**Task and Approval Management:**
- `createTaskWithApprovals()` - Create task with approval gates
- `requestApproval()` - Request approval for a gate
- `grantApproval()` - Grant an approval
- `denyApproval()` - Deny an approval
- `simulateApprovalWorkflow()` - Run complete scenario

**Status Checking:**
- `areAllApprovalsComplete()` - Check if all approvals are approved
- `hasAnyApprovalBeenDenied()` - Check if any approval was denied
- `getPendingApprovals()` - Get pending approvals for a task

**Event Handling:**
- `getEventEmitter()` - Get event emitter for listening to events
- `waitForApprovalEvent()` - Wait for specific approval events

**Events Emitted:**
- `approval-required` - When approval is requested
- `approval-granted` - When approval is granted
- `approval-denied` - When approval is denied
- `approval-timeout` - When approval times out

### Assertion Helpers

#### `ApprovalTestAssertions`

Built-in assertion helpers for approval state validation.

```typescript
// Assert approval status
await ApprovalTestAssertions.assertApprovalStatus(
  store,
  approvalId,
  'approved'
);

// Assert number of pending approvals
await ApprovalTestAssertions.assertPendingApprovalsCount(
  store,
  taskId,
  2
);

// Assert all approvals are approved
await ApprovalTestAssertions.assertAllApprovalsApproved(
  store,
  taskId
);

// Assert specific approver
await ApprovalTestAssertions.assertApprovalApprover(
  store,
  approvalId,
  'admin@example.com'
);
```

## Advanced Usage

### Testing Timeout Scenarios

```typescript
const env = await createApprovalFlowTestEnvironment();

// Listen for timeout events
const timeoutPromise = env.waitForApprovalEvent('approval-timeout', 5000);

// Request approval with short timeout
const approval = await env.requestApproval(taskId, 'timeout-gate', {
  timeoutMinutes: 0.01, // 600ms timeout
});

// Wait for timeout
const timeoutData = await timeoutPromise;
console.log('Approval timed out:', timeoutData.approvalId);
```

### Testing Multi-Step Approval Chains

```typescript
const env = await createApprovalFlowTestEnvironment();
const { task } = await env.createTaskWithApprovals();

// Simulate a 3-step approval process
const approvals = await env.simulateApprovalWorkflow(task.id, 'multi-step-approval');

// First approval should be complete
expect(approvals[0].status).toBe('approved');

// Second approval should be pending
expect(approvals[1].status).toBe('pending');

// Grant the second approval
await env.grantApproval(approvals[1].id, 'security@example.com');

// Check if all are complete
const allComplete = await env.areAllApprovalsComplete(task.id);
console.log('All complete:', allComplete); // false, still has pending
```

### Testing Event-Driven Workflows

```typescript
const env = await createApprovalFlowTestEnvironment();
const events: string[] = [];

// Listen to all approval events
env.getEventEmitter().on('approval-required', () => events.push('required'));
env.getEventEmitter().on('approval-granted', () => events.push('granted'));
env.getEventEmitter().on('approval-denied', () => events.push('denied'));

// Simulate workflow
const { task } = await env.createTaskWithApprovals();
const approval = await env.requestApproval(task.id, 'test-gate');
await env.grantApproval(approval.id, 'user@example.com');

// Verify event sequence
expect(events).toEqual(['required', 'granted']);
```

### Custom Workflow Testing

```typescript
import { createWorkflowWithApprovals } from '@apexcli/orchestrator';

// Create workflow with custom approval gates
const workflow = createWorkflowWithApprovals({
  name: 'secure-deployment',
  gates: [
    {
      type: 'before-commit',
      name: 'code-review',
      minApprovals: 2,
      approvers: ['dev1@example.com', 'dev2@example.com']
    },
    {
      type: 'before-deploy',
      name: 'security-approval',
      timeout: 120,
      approvers: ['security@example.com']
    },
    {
      type: 'before-deploy',
      name: 'final-approval',
      minApprovals: 3,
      approvers: ['cto@example.com', 'lead@example.com', 'ops@example.com']
    }
  ]
});

console.log('Workflow created with', workflow.stages[0].gates?.length, 'approval gates');
```

## Best Practices

1. **Always Clean Up**: Call `cleanup()` on test environments to prevent resource leaks
2. **Use Realistic Timeouts**: Don't use extremely short timeouts that might cause flaky tests
3. **Test Event Sequences**: Verify that approval events are emitted in the correct order
4. **Test Error Cases**: Use assertions to test invalid approval IDs, wrong states, etc.
5. **Isolate Tests**: Each test should have its own approval environment

## Error Handling

The utilities include comprehensive error handling for common scenarios:

```typescript
// Approval not found
await expect(
  env.grantApproval('invalid-id', 'user@example.com')
).rejects.toThrow('Approval invalid-id not found');

// Wrong approval status
await expect(
  ApprovalTestAssertions.assertApprovalStatus(store, approvalId, 'denied')
).rejects.toThrow('Expected approval status denied, got pending');

// Event timeout
await expect(
  env.waitForApprovalEvent('approval-granted', 100)
).rejects.toThrow('Timeout waiting for approval-granted event');
```

## Integration with Testing Frameworks

### Vitest/Jest

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApprovalFlowTestEnvironment } from '@apexcli/orchestrator';

describe('Approval Workflows', () => {
  let approvalFlow: ApprovalFlowTestEnvironment;

  beforeEach(async () => {
    approvalFlow = await createApprovalFlowTestEnvironment();
  });

  afterEach(async () => {
    await approvalFlow.cleanup();
  });

  it('should handle approval workflow', async () => {
    const { task } = await approvalFlow.createTaskWithApprovals();
    const approval = await approvalFlow.requestApproval(task.id, 'test-gate');
    await approvalFlow.grantApproval(approval.id, 'admin@example.com');

    const isComplete = await approvalFlow.areAllApprovalsComplete(task.id);
    expect(isComplete).toBe(true);
  });
});
```

## Performance Considerations

- Uses in-memory SQLite databases for fast testing
- Event emitters are cleaned up automatically
- Timeouts are properly cleared to prevent memory leaks
- Database connections are pooled and reused

## Compatibility

- ✅ Node.js 18+
- ✅ TypeScript 5.0+
- ✅ Works with Vitest, Jest, and other testing frameworks
- ✅ Compatible with both CommonJS and ESM