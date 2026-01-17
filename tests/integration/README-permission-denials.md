# Permission Denials Integration Tests

This directory contains comprehensive integration tests for permission denials in the APEX system.

## Test Files

### `permission-denials-comprehensive.test.ts`
Main comprehensive test suite covering:
- **Permission Denials Prevent Actions**: Validates that denied permissions actually prevent tool execution
- **Denial State Tracking**: Verifies that denial decisions are tracked with proper audit information
- **Re-Request Scenarios**: Tests the ability to re-request previously denied permissions

### `permission-denials-validation.test.ts`
Basic validation test to ensure the test environment and imports are working correctly.

## Test Coverage

### 1. Permission Denials Prevent Actions
- Explicit permission denials prevent tool execution
- Scoped denials (wildcard patterns) work correctly
- Dangerous operations are properly blocked
- Preset-based denials function as expected
- Path-based restrictions are enforced

### 2. Denial State Tracking
- Who denied permissions and when is recorded
- Audit trail maintains complete denial history
- Denial reasons are categorized and stored
- Concurrent denials are tracked without conflicts
- Events are emitted for all denial actions

### 3. Re-Request Scenarios
- Previously denied permissions can be re-requested
- Multiple request/denial/approval cycles work
- Different scopes for re-requests are handled
- Escalation workflows function properly
- Expired permissions can be renewed through re-request

### 4. Additional Coverage
- Approval gate denials vs permission denials
- Edge cases and error scenarios
- Performance with high volumes of denials
- Database consistency during denial operations
- Event emission ordering and timing

## Acceptance Criteria Validation

These tests specifically validate the acceptance criteria:
> Tests verify that permission denials work correctly: denying permissions prevents actions, denial states are tracked, and denied permissions can be re-requested appropriately

### ✅ Denying permissions prevents actions
- Multiple test cases verify that denied permissions block tool execution
- Tests cover explicit denials, preset denials, and path-based denials
- Verification that `result.allowed === false` when permissions are denied

### ✅ Denial states are tracked
- Comprehensive audit trail testing
- Event emission verification for all denial events
- Database persistence checks for denial decisions
- Tracking of who denied, when, and why

### ✅ Denied permissions can be re-requested appropriately
- Full re-request cycle testing from denial to approval
- Multiple cycles of request/deny/request/approve
- Escalation and renewal scenarios
- Handling of different scopes and contexts

## Running the Tests

```bash
# Run all permission denial tests
npm test tests/integration/permission-denials-*

# Run just the comprehensive test suite
npm test tests/integration/permission-denials-comprehensive.test.ts

# Run validation test
npm test tests/integration/permission-denials-validation.test.ts
```

## Test Architecture

The tests use:
- **Vitest** as the test framework
- **Temporary directories** for isolated test environments
- **Event listeners** to track permission system behavior
- **ApexOrchestrator** instances with minimal configurations
- **Comprehensive cleanup** in afterEach hooks

## Integration Points

These tests integrate with:
- `@apexcli/orchestrator` - Main orchestrator functionality
- `@apexcli/core` - Type definitions and event interfaces
- Permission Manager - Core permission logic
- Permission Store - Persistent storage
- Event system - Real-time event emission
- Approval system - Approval gate denials

The tests provide end-to-end validation of the permission denial system while maintaining isolation and repeatability.