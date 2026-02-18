# ToolInvocationRecorder

The `ToolInvocationRecorder` is a utility class for capturing and analyzing tool invocations during testing and development. It provides an in-memory recording mechanism that allows developers to track tool usage patterns, debug tool calls, and verify tool behavior in tests.

## Features

- **Capture Tool Invocations**: Record tool calls with parameters, context, and timestamps
- **Track Executions**: Update recorded invocations with execution results and timing data
- **Flexible Querying**: Query recorded invocations by tool name, parameters, time ranges, and context
- **Statistics**: Generate usage statistics including success rates, performance metrics, and usage patterns
- **Testing Support**: Clear/reset functionality for clean test isolation
- **Global Instance**: Optional singleton instance for application-wide monitoring

## Basic Usage

### Recording Invocations

```typescript
import { ToolInvocationRecorder } from '@apexcli/orchestrator';

const recorder = new ToolInvocationRecorder();

// Record a tool invocation
recorder.recordInvocation({
  toolName: 'Read',
  parameters: { file_path: '/src/example.ts' },
  requestId: 'req-123',
  context: {
    taskId: 'feature-dev',
    agentName: 'developer',
    stageName: 'implementation',
  },
});

// Update with execution results
recorder.recordExecution('req-123', {
  callId: 'call-123',
  toolName: 'Read',
  input: { file_path: '/src/example.ts' },
  startTime: new Date(),
  endTime: new Date(),
  duration: 150,
  status: 'completed',
  result: {
    success: true,
    output: 'file content...',
  },
});
```

### Querying Invocations

```typescript
// Get all invocations for a specific tool
const readInvocations = recorder.queryInvocations({ toolName: 'Read' });

// Filter by context
const taskInvocations = recorder.queryInvocations({
  taskId: 'feature-dev',
  agentName: 'developer'
});

// Filter by parameters
const specificFileOps = recorder.queryInvocations({
  parameters: { file_path: '/src/example.ts' }
});

// Filter by time range
const recentOps = recorder.queryInvocations({
  startTime: new Date(Date.now() - 3600000), // Last hour
  limit: 10
});
```

### Getting Statistics

```typescript
const stats = recorder.getStats();

console.log('Total invocations:', stats.totalInvocations);
console.log('Success rate:', stats.successfulExecutions / stats.totalInvocations);
console.log('Most used tools:', stats.topTools);
console.log('Average duration:', stats.averageDuration, 'ms');
```

## Testing Usage

The `ToolInvocationRecorder` is particularly useful for testing tool behavior and verifying that the correct tools are being called with the expected parameters.

### Test Setup Pattern

```typescript
describe('Agent Tool Usage', () => {
  let recorder: ToolInvocationRecorder;

  beforeEach(() => {
    recorder = new ToolInvocationRecorder();
  });

  afterEach(() => {
    recorder.clear();
  });

  it('should read configuration file during initialization', async () => {
    // Execute the code that should trigger tool calls
    await initializeProject();

    // Verify the expected tool was called
    const configReads = recorder.queryInvocations({
      toolName: 'Read',
      parameters: { file_path: '/project/config.yaml' }
    });

    expect(configReads).toHaveLength(1);
    expect(configReads[0].execution?.status).toBe('completed');
  });

  it('should use correct tools for file operations', async () => {
    await processFiles();

    const stats = recorder.getStats();
    expect(stats.topTools).toContainEqual({
      toolName: 'Read',
      count: expect.any(Number)
    });
  });
});
```

### Integration Testing

```typescript
it('should complete workflow with expected tool sequence', async () => {
  const recorder = new ToolInvocationRecorder();

  // Execute workflow
  await runWorkflow('feature-development', { recorder });

  // Verify tool sequence
  const allOps = recorder.getAllInvocations();
  const toolSequence = allOps.map(op => op.invocation.toolName);

  expect(toolSequence).toEqual([
    'Read',    // Read project files
    'Edit',    // Modify code
    'Write',   // Create new files
    'Bash',    // Run tests
  ]);
});
```

## Global Recorder

For application-wide monitoring, you can use the global recorder instance:

```typescript
import { globalRecorder } from '@apexcli/orchestrator';

// Record throughout the application
globalRecorder.recordInvocation(invocation);

// Analyze usage patterns at any point
const appStats = globalRecorder.getStats();

// Reset between sessions
globalRecorder.reset();
```

## API Reference

### ToolInvocationRecorder

#### Methods

##### `recordInvocation(invocation: ToolInvocation): ToolInvocationRecord`
Records a tool invocation request with timestamp.

##### `recordExecution(requestId: string, execution: ToolExecution): boolean`
Updates a recorded invocation with execution details using the request ID.

##### `recordExecutionByCallId(callId: string, execution: ToolExecution): boolean`
Updates a recorded invocation with execution details using the call ID or context matching.

##### `queryInvocations(options?: ToolInvocationQueryOptions): ToolInvocationRecord[]`
Queries recorded invocations with flexible filtering options.

##### `getStats(): ToolInvocationStats`
Returns statistics about recorded invocations including success rates and usage patterns.

##### `clear(): void`
Removes all recorded invocations (useful for test cleanup).

##### `reset(): void`
Alias for `clear()` for semantic clarity.

#### Convenience Methods

- `getInvocationsForTool(toolName: string)` - Get all invocations for a specific tool
- `getInvocationsInTimeRange(start: Date, end: Date)` - Get invocations in time range
- `getInvocationsWithParameters(params: Record<string, unknown>)` - Get invocations with matching parameters
- `hasInvocations(): boolean` - Check if any invocations recorded
- `getInvocationCount(): number` - Get total number of invocations
- `getLatestInvocation()` - Get most recent invocation
- `getAllInvocations()` - Get all invocations (defensive copy)

### ToolInvocationQueryOptions

```typescript
interface ToolInvocationQueryOptions {
  toolName?: string;           // Filter by tool name
  taskId?: string;             // Filter by task ID
  agentName?: string;          // Filter by agent name
  stageName?: string;          // Filter by stage name
  startTime?: Date;            // Filter by start time
  endTime?: Date;              // Filter by end time
  parameters?: Record<string, unknown>; // Filter by parameters
  status?: 'running' | 'completed' | 'failed'; // Filter by execution status
  limit?: number;              // Limit number of results
}
```

### ToolInvocationStats

```typescript
interface ToolInvocationStats {
  totalInvocations: number;
  successfulExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  topTools: Array<{ toolName: string; count: number }>;
  averageDuration?: number; // Average execution time in milliseconds
}
```

## Best Practices

1. **Test Isolation**: Always clear the recorder between tests to avoid interference
2. **Specific Queries**: Use specific query parameters to avoid false positives in tests
3. **Performance Monitoring**: Monitor `averageDuration` to identify slow tools
4. **Error Analysis**: Check `failedExecutions` to identify problematic tool calls
5. **Global Usage**: Use global recorder sparingly and reset between sessions

## Examples

See `examples/tool-invocation-recorder-usage.ts` for comprehensive usage examples including:
- Basic recording and querying
- Testing patterns
- Performance monitoring
- Time-based analysis
- Advanced filtering scenarios

## Implementation Notes

- The recorder stores data in memory and does not persist between application restarts
- Parameter matching uses exact comparison for primitives and shallow comparison for objects
- Time-based filtering uses the `recordedAt` timestamp of when the invocation was recorded
- The global recorder is a singleton that can be accessed from anywhere in the application