# Integration Test Infrastructure and Utilities

This document describes the comprehensive integration test infrastructure implemented for the APEX platform.

## Overview

The APEX integration test infrastructure provides a complete suite of utilities, fixtures, mock factories, and test setup/teardown helpers designed to facilitate robust integration testing across all APEX components.

## Key Components

### 1. Integration Test Utilities (`integration-test-utilities.ts`)

A comprehensive module that provides:

- **Complete test environment setup** with real APEX components
- **Event monitoring and tracking** for observing system behavior
- **Browser automation integration** (optional)
- **Permission testing environment** with approval system simulation
- **Tool mock registry** for controlled external dependencies
- **Predefined test scenarios** for common integration patterns

#### Usage Example:

```typescript
import { createIntegrationTestEnvironment } from '@apex/test-utils';

const env = await createIntegrationTestEnvironment({
  projectName: 'my-test-project',
  language: 'typescript',
  enableBrowser: true,
  enablePermissions: true,
  mockClaudeAPI: true,
});

// Use the environment for testing
const task = await env.orchestrator.createTask({
  description: 'Integration test task',
  workflow: 'feature',
});

// Monitor events
const eventData = await env.events.waitForEvent('task:created');

// Cleanup when done
await env.cleanup();
```

### 2. Test Setup/Teardown Helpers (`test-setup-teardown.ts`)

Robust test lifecycle management with:

- **Automated environment setup/teardown**
- **Test isolation** (filesystem, network, environment variables)
- **Resource cleanup** to prevent test pollution
- **Convenient Vitest hook wrappers**
- **Performance measurement utilities**

#### Usage Example:

```typescript
import { beforeAllWithSetup } from '@apex/test-utils';

describe('My Integration Tests', () => {
  const { getEnvironment } = beforeAllWithSetup({
    createIntegrationEnv: true,
    integrationOptions: {
      projectName: 'test-project',
      mockClaudeAPI: true,
    },
    isolateFilesystem: true,
    isolateNetwork: true,
  });

  it('should work with pre-setup environment', async () => {
    const env = getEnvironment();
    // Test with the pre-configured environment
  });
});
```

### 3. Enhanced Mock Factories (`enhanced-mock-factories.ts`)

Advanced mock creation with realistic behavior:

- **Advanced task mocks** with event tracking, history, validation, and metrics
- **Orchestrator mocks** with performance tracking and realistic behavior
- **Agent execution mocks** with customizable behavior patterns
- **Workflow execution mocks** with stage simulation and checkpoints
- **Mock registry system** for managing multiple mock instances

#### Usage Example:

```typescript
import { createAdvancedTaskMock, mockRegistry } from '@apex/test-utils';

// Create a sophisticated task mock
const taskMock = createAdvancedTaskMock(
  { description: 'Test task' },
  {
    withEvents: true,
    withHistory: true,
    withValidation: true,
    withMetrics: true,
  }
);

// Use advanced features
taskMock.updateStatus('in-progress');
taskMock.addLog('Starting execution');
await taskMock.simulateProgress(['planning', 'implementation', 'testing']);

const metrics = taskMock.getMetrics();
const history = taskMock.getStatusHistory();
```

## Enhanced Existing Infrastructure

The new utilities build upon and enhance the existing test infrastructure:

### Tool Integration Fixtures (`tool-integration-fixtures.ts`)
- Mock tool implementations for all APEX tools
- Permission testing scenarios
- Tool configuration fixtures
- Integration test helpers

### Permission Integration Fixtures (`permission-integration-fixtures.ts`)
- Permission approval workflow simulation
- MCP (Model Context Protocol) permission integration mocks
- User consent simulation
- Multi-agent permission scenarios

### Browser Automation Infrastructure
- Browser test bases and fixtures
- Automation mocks and simulators
- Test setup utilities
- Error handling fixtures

## Integration Test Scenarios

Pre-built scenarios for common testing patterns:

1. **Basic Task Execution**: Simple task creation and completion
2. **Multi-Stage Workflow**: Complex workflow with multiple stages
3. **Permission-Protected Tools**: Testing permission enforcement
4. **Browser Automation**: Automated browser interaction testing
5. **Error Handling and Recovery**: Testing failure scenarios
6. **Concurrent Task Execution**: Testing parallel task processing

## Test Assertions

Comprehensive assertion helpers for validation:

- `taskCreated(task)`: Verify task creation
- `taskProgressedThroughStages(events, stages)`: Verify workflow progression
- `permissionsChecked(env, tool)`: Verify permission enforcement
- `toolsCalled(registry, tools)`: Verify tool execution
- `eventSequence(events, sequence)`: Verify event ordering

## File Structure

```
tests/test-utils/
├── integration-test-utilities.ts      # Main integration utilities
├── test-setup-teardown.ts            # Lifecycle management
├── enhanced-mock-factories.ts        # Advanced mocking
├── tool-integration-fixtures.ts      # Tool testing fixtures
├── permission-integration-fixtures.ts # Permission testing
├── browser-automation-test-setup.ts  # Browser testing
├── index.ts                          # Main exports
└── README-Integration-Testing.md     # This documentation
```

## Key Features

### Environment Isolation
- Filesystem operations contained within test directories
- Network requests mocked to prevent external calls
- Environment variables isolated per test
- Process state restoration after tests

### Event Monitoring
- Real-time event tracking during test execution
- Event history for post-test analysis
- Event filtering and querying capabilities
- Timeout-based event waiting

### Performance Tracking
- Execution time measurement
- Resource usage monitoring
- Performance benchmarking utilities
- Memory leak detection helpers

### Mock Sophistication
- Realistic behavior patterns
- Configurable failure modes
- History and metrics tracking
- Custom behavior injection

## Best Practices

### 1. Use Environment Cleanup
Always ensure proper cleanup of test environments:

```typescript
const env = await createIntegrationTestEnvironment();
try {
  // Your tests here
} finally {
  await env.cleanup();
}
```

### 2. Leverage Test Hooks
Use the provided hook wrappers for automatic lifecycle management:

```typescript
const { getEnvironment } = beforeAllWithSetup({
  createIntegrationEnv: true,
  // Environment will be automatically cleaned up
});
```

### 3. Monitor Events
Use event monitoring to verify system behavior:

```typescript
await env.orchestrator.createTask(...);
const event = await env.events.waitForEvent('task:created');
expect(event.task.id).toBeDefined();
```

### 4. Test Realistic Scenarios
Use predefined scenarios for consistency:

```typescript
const result = await integrationScenarios.multiStageWorkflow(env);
integrationAssertions.taskProgressedThroughStages(
  env.events.getEvents(),
  ['planning', 'implementation', 'testing']
);
```

## Dependencies

The integration test utilities depend on:

- `@apexcli/core`: Core APEX types and utilities
- `@apexcli/orchestrator`: Task orchestration engine
- `vitest`: Testing framework
- `playwright`: Browser automation (optional)
- Various existing test utilities

## Future Enhancements

Potential future improvements:

1. **Visual Testing**: Screenshot comparison utilities
2. **Performance Regression**: Automated performance baseline comparison
3. **Load Testing**: Multi-user scenario simulation
4. **Chaos Testing**: Fault injection and resilience testing
5. **Documentation Generation**: Automatic test documentation from scenarios

## Conclusion

This comprehensive integration test infrastructure provides APEX developers with powerful, flexible, and reliable tools for testing complex multi-component interactions. The utilities are designed to be both easy to use for simple scenarios and extensible for complex custom testing needs.

The infrastructure supports the full spectrum of APEX testing requirements, from basic unit-like integration tests to complex end-to-end workflows involving multiple agents, permissions, tools, and browser automation.