# ADR-085: Centralized Test Fixtures Module

## Status
Proposed

## Context

The APEX codebase has over 1,700 test files across multiple packages (core, orchestrator, cli, api). Currently, test fixtures are fragmented across multiple locations:

1. **Custom tool fixtures**: `packages/core/src/__tests__/fixtures/custom-tools/`
2. **CLI agent fixtures**: `packages/cli/src/ui/components/agents/__tests__/test-utils/fixtures.ts`
3. **MCP error presets**: `packages/orchestrator/src/mcp/mock-server/error-presets.ts`
4. **Claude SDK mocks**: `packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts`
5. **Various inline fixtures**: Scattered throughout individual test files

This fragmentation leads to:
- **Code duplication**: Similar fixtures recreated across packages
- **Inconsistent patterns**: Different factory patterns and naming conventions
- **Maintenance burden**: Updates required in multiple places
- **Discovery issues**: Developers don't know what fixtures exist

The task is to create a centralized fixtures module that exports:
- Common tool response fixtures
- Request template fixtures
- Error scenario fixtures

All fixtures must be properly typed and documented.

## Decision

We will create a centralized fixtures module in `@apex/core` under `src/test-fixtures/` with the following structure:

```
packages/core/src/test-fixtures/
├── index.ts                    # Main barrel export
├── responses/
│   ├── index.ts               # Response fixture exports
│   ├── tool-responses.ts      # Common tool execution responses
│   ├── mcp-responses.ts       # MCP protocol responses
│   ├── agent-responses.ts     # Claude Agent SDK responses
│   └── api-responses.ts       # REST/WebSocket responses
├── requests/
│   ├── index.ts               # Request fixture exports
│   ├── tool-requests.ts       # Tool invocation requests
│   ├── mcp-requests.ts        # MCP/JSON-RPC requests
│   ├── task-requests.ts       # Task creation/update requests
│   └── api-requests.ts        # REST API requests
├── errors/
│   ├── index.ts               # Error fixture exports
│   ├── mcp-errors.ts          # MCP error scenarios (enhanced from error-presets.ts)
│   ├── agent-errors.ts        # Claude Agent SDK errors
│   ├── validation-errors.ts   # Zod/Schema validation errors
│   └── system-errors.ts       # Network, filesystem, timeout errors
├── factories/
│   ├── index.ts               # Factory exports
│   ├── task-factory.ts        # Task creation factories
│   ├── agent-factory.ts       # Agent/workflow factories
│   ├── tool-factory.ts        # Tool definition factories
│   └── config-factory.ts      # Configuration factories
├── builders/
│   ├── index.ts               # Builder exports
│   ├── response-builder.ts    # Fluent response builders
│   ├── request-builder.ts     # Fluent request builders
│   └── error-builder.ts       # Fluent error builders
└── types.ts                   # Fixture-specific type definitions
```

### Key Design Principles

#### 1. **Type Safety First**
All fixtures will be fully typed using the existing Zod schemas and TypeScript types from `@apex/core/types`:

```typescript
import type { Task, TaskStatus, ToolResult, ToolExecution } from '../types.js';

// All fixtures validate against existing schemas
export const completedTask: Task = { ... };
```

#### 2. **Factory Functions with Overrides**
Follow the established pattern from the codebase (seen in `test-helpers.ts`, `fixtures.ts`):

```typescript
/**
 * Creates a Task fixture with sensible defaults
 * @param overrides - Partial Task properties to override defaults
 */
export function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Date.now()}`,
    description: 'Test task description',
    workflow: 'feature',
    autonomy: 'review-before-commit',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: createDefaultUsage(),
    logs: [],
    artifacts: [],
    ...overrides,
  };
}
```

#### 3. **Preset Collections**
Group related fixtures into named presets for common testing scenarios:

```typescript
// Error Presets - extending existing MCP error presets pattern
export const ErrorPresets = {
  // MCP Protocol Errors
  mcp: {
    protocolMismatch: createMCPError({ code: -32600, message: 'Protocol version not supported' }),
    timeout: createMCPError({ code: -32000, message: 'Request timed out' }),
    connectionReset: createMCPError({ code: -32000, message: 'Connection reset by peer' }),
    ...
  },
  // Agent SDK Errors
  agent: {
    sessionLimit: new Error('Session limit reached: Context window utilization is 85%'),
    budgetExceeded: new Error('Task exceeded budget limit'),
    ...
  },
  // Validation Errors
  validation: {
    invalidTask: createValidationError('task', ['id', 'description']),
    ...
  },
};
```

#### 4. **Builder Pattern for Complex Fixtures**
For complex, multi-part fixtures, use builder pattern (following `MockResponseBuilder` from claude-agent-sdk.ts):

```typescript
export class ToolResponseBuilder {
  private response: Partial<ToolResult> = { success: true };

  static create(): ToolResponseBuilder {
    return new ToolResponseBuilder();
  }

  withSuccess(success: boolean): this { ... }
  withOutput(output: unknown): this { ... }
  withError(error: string): this { ... }
  withDuration(ms: number): this { ... }
  withToolName(name: string): this { ... }
  build(): ToolResult { ... }
}

// Usage:
const response = ToolResponseBuilder.create()
  .withToolName('Read')
  .withOutput({ content: 'file content' })
  .withDuration(100)
  .build();
```

#### 5. **JSDoc Documentation**
All fixtures, factories, and builders must be documented:

```typescript
/**
 * Creates a mock tool execution response
 *
 * @param toolName - Name of the tool (e.g., 'Read', 'Write', 'Bash')
 * @param output - Tool output data
 * @param options - Additional options for the response
 * @returns A fully-typed ToolResult object
 *
 * @example
 * ```typescript
 * const response = createToolResponse('Read', {
 *   content: 'Hello World'
 * });
 * expect(response.success).toBe(true);
 * ```
 */
export function createToolResponse(
  toolName: string,
  output: unknown,
  options?: ToolResponseOptions
): ToolResult { ... }
```

### Fixture Categories

#### Response Fixtures (`responses/`)

| File | Contents | Types Used |
|------|----------|------------|
| `tool-responses.ts` | Read, Write, Edit, Bash, Glob, Grep tool responses | `ToolResult`, `ToolExecution` |
| `mcp-responses.ts` | JSON-RPC responses, tool list responses, resource responses | `JSONRPCResponse`, `MCPToolsListResult` |
| `agent-responses.ts` | Claude SDK query responses, streaming events | `MockQueryResponse`, `StreamingEvent` |
| `api-responses.ts` | Task status, health endpoints, WebSocket events | `TaskStatusResponse`, `HealthMetrics` |

#### Request Fixtures (`requests/`)

| File | Contents | Types Used |
|------|----------|------------|
| `tool-requests.ts` | Tool invocation requests with various parameters | `ToolInvocation` |
| `mcp-requests.ts` | JSON-RPC requests, initialize, tools/call | `JSONRPCRequest`, `MCPInitializeRequest` |
| `task-requests.ts` | Task creation, update, decomposition requests | `CreateTaskRequest`, `TaskDecomposition` |
| `api-requests.ts` | REST API request payloads | Various API request types |

#### Error Fixtures (`errors/`)

| File | Contents | Types Used |
|------|----------|------------|
| `mcp-errors.ts` | Extended from existing error-presets.ts with more scenarios | `MockErrorScenarioPreset`, `MockErrorSimulationConfig` |
| `agent-errors.ts` | Claude SDK error scenarios | Error objects with specific messages |
| `validation-errors.ts` | Zod validation errors, schema violations | `ZodError`, custom error types |
| `system-errors.ts` | ENOENT, ECONNRESET, ETIMEDOUT, permission errors | Node.js error types |

### Integration with Existing Test Infrastructure

#### 1. Re-export Existing Fixtures
The new module will re-export compatible existing fixtures to maintain backward compatibility:

```typescript
// packages/core/src/test-fixtures/index.ts
export * from './responses/index.js';
export * from './requests/index.js';
export * from './errors/index.js';
export * from './factories/index.js';
export * from './builders/index.js';

// Re-export existing fixtures for backward compatibility
export {
  loadValidToolFixtures,
  loadInvalidToolFixtures,
  loadEdgeCaseFixtures,
  createTestToolConfig,
} from '../__tests__/fixtures/custom-tools/index.js';
```

#### 2. Integration with Mock Servers
The MCP error fixtures will integrate with the existing mock server infrastructure:

```typescript
// Can be used with withMockMCP helper
import { ErrorPresets } from '@apexcli/core/test-fixtures';
import { withMockMCP } from '@apex/orchestrator/mcp/mock-server';

await withMockMCP(builder =>
  builder.withErrorSimulation(ErrorPresets.mcp.timeout)
);
```

#### 3. Integration with MockClaudeAgentSDK
The agent response fixtures will work with the existing mock SDK:

```typescript
import { AgentResponseFixtures } from '@apexcli/core/test-fixtures';
import { MockClaudeAgentSDK } from '@apex/orchestrator/__tests__/mocks';

const mockSDK = new MockClaudeAgentSDK();
mockSDK.addResponse(AgentResponseFixtures.successWithToolUse);
```

### Export Strategy

The module will be exported from `@apex/core` package:

```typescript
// packages/core/src/index.ts
export * from './test-fixtures/index.js';
```

This allows imports like:
```typescript
import {
  createTask,
  ErrorPresets,
  ToolResponseBuilder
} from '@apexcli/core/test-fixtures';
```

## Consequences

### Positive
1. **Single source of truth** for test fixtures across all packages
2. **Type safety** ensures fixtures are valid against schemas
3. **Better discovery** via centralized documentation
4. **Reduced duplication** across test files
5. **Consistent patterns** for fixture creation
6. **Easier maintenance** when types change

### Negative
1. **Initial migration effort** to update existing tests
2. **Package dependency** - all packages now depend on @apex/core for testing
3. **Learning curve** for the fixture API

### Risks
1. **Circular dependencies** - must ensure test-fixtures don't import from test code
2. **Bundle size** - test fixtures are dev dependencies only

## Implementation Plan

### Phase 1: Foundation (This Stage)
1. Create directory structure in `packages/core/src/test-fixtures/`
2. Implement core factories: `task-factory.ts`, `tool-factory.ts`
3. Implement error presets: `mcp-errors.ts`, `agent-errors.ts`
4. Add comprehensive JSDoc documentation

### Phase 2: Response & Request Fixtures
1. Implement tool response fixtures
2. Implement MCP response fixtures
3. Implement request template fixtures
4. Add builder classes

### Phase 3: Integration & Migration
1. Update existing tests to use centralized fixtures
2. Deprecate duplicated fixtures
3. Add integration tests for fixture module

## References

- Existing fixture patterns:
  - `packages/core/src/__tests__/fixtures/custom-tools/index.ts`
  - `packages/cli/src/ui/components/agents/__tests__/test-utils/fixtures.ts`
  - `packages/orchestrator/src/mcp/mock-server/error-presets.ts`
  - `packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts`
- Type definitions: `packages/core/src/types.ts`
