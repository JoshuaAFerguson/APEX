# Tool Call Events Testing - v0.5.0

This directory contains comprehensive tests for the new tool call event emission functionality added in v0.5.0.

## Test Files

### 1. `tool-call-events.test.ts` - Main Integration Tests
Comprehensive end-to-end tests that validate all acceptance criteria:

- **AC1**: `tool:start` event emission with proper payload structure
- **AC2**: `tool:complete` event emission for success/error scenarios
- **AC3**: `tool:progress` event emission structure validation
- **AC4**: TypeScript type safety and core schema validation
- **AC5**: Integration with Claude Agent SDK query() method

Key test scenarios:
- Tool call lifecycle (start → progress → complete)
- Multiple tool calls in sequence
- Error handling and edge cases
- Timing calculations and cleanup
- Claude SDK response parsing
- Malformed input handling

### 2. `tool-events-validation.test.ts` - Type System Tests
Focused tests for TypeScript interface validation:

- ToolCallStartEvent structure and types
- ToolCallCompleteEvent with success/error results
- ToolCallProgressEvent with optional percentage
- Event consistency across different states
- Type safety at compile time

### 3. `tool-events-emitter.test.ts` - Event System Tests
Tests for the underlying event emitter functionality:

- Event emission and listener registration
- Multiple listeners per event
- Event listener removal and cleanup
- Once-only listeners
- Error handling in event listeners
- Event emission order validation

### 4. `tool-events-coverage.test.ts` - Coverage Analysis
Meta-test that validates our test coverage:

- Acceptance criteria completeness
- Edge case coverage
- Integration test coverage
- Documentation coverage
- Performance considerations

## Event Interfaces

### ToolCallStartEvent
Emitted when a tool call begins:
```typescript
{
  taskId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
  callId: string;
}
```

### ToolCallCompleteEvent
Emitted when a tool call completes (success or error):
```typescript
{
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number; // milliseconds
  };
  timestamp: Date;
}
```

### ToolCallProgressEvent
Emitted during long-running tool operations:
```typescript
{
  taskId: string;
  toolName: string;
  callId: string;
  progress: {
    message: string;
    percentage?: number;
  };
  timestamp: Date;
}
```

## Usage Example

```typescript
import { ApexOrchestrator } from '@apexcli/orchestrator';

const orchestrator = new ApexOrchestrator('./project', 'localhost:8080');

// Listen for tool call events
orchestrator.on('tool:start', (event) => {
  console.log(`Tool ${event.toolName} started for task ${event.taskId}`);
});

orchestrator.on('tool:complete', (event) => {
  if (event.result.success) {
    console.log(`Tool ${event.toolName} completed successfully in ${event.timing.duration}ms`);
  } else {
    console.log(`Tool ${event.toolName} failed: ${event.result.error}`);
  }
});

orchestrator.on('tool:progress', (event) => {
  const progress = event.progress.percentage
    ? `${event.progress.percentage}%`
    : 'working...';
  console.log(`Tool ${event.toolName}: ${event.progress.message} (${progress})`);
});

await orchestrator.initialize();
```

## Testing Strategy

1. **Unit Tests**: Validate individual event interfaces and type safety
2. **Integration Tests**: Test full tool call lifecycle with mocked Claude SDK
3. **Edge Case Tests**: Handle malformed inputs, orphaned results, timing edge cases
4. **Performance Tests**: Verify memory cleanup and efficiency
5. **Coverage Tests**: Ensure all acceptance criteria are thoroughly tested

## Running Tests

```bash
# Run all tool event tests
npm test -- __tests__/tool-*

# Run specific test file
npm test -- __tests__/tool-call-events.test.ts

# Run with coverage
npm test -- --coverage __tests__/tool-*
```

## Dependencies

- **vitest**: Testing framework
- **@anthropic-ai/claude-agent-sdk**: Mocked for Claude SDK integration
- **EventEmitter**: Node.js events for testing event emission

## Future Enhancements

- Real-time progress updates for long-running tools
- Tool call analytics and performance metrics
- Custom tool call filtering and routing
- Event persistence and replay capabilities