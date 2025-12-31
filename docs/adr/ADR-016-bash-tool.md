# ADR-016: BashTool Implementation

## Status
Proposed

## Context

APEX needs a `BashTool` for executing shell commands during agent task execution. This is a core capability required for the `shell` category of tools, enabling agents to:
- Run build commands (npm, cargo, go, etc.)
- Execute git operations
- Run tests and linters
- Interact with the development environment

The existing tool framework provides a well-established pattern through `BaseTool`, `ToolRegistry`, and the filesystem tools (ReadTool, EditTool, WriteTool). The BashTool must follow this pattern while addressing the unique concerns of command execution: security, timeouts, background execution, and structured output.

## Decision

### 1. Directory Structure

Create a new `shell/` directory following the pattern of `filesystem/`:

```
packages/core/src/tools/
├── shell/
│   ├── bash-tool.ts       # Main BashTool class
│   ├── index.ts           # Module exports
│   ├── register.ts        # Registration utilities
│   └── __tests__/
│       └── bash-tool.test.ts
```

### 2. BashTool Interface Design

```typescript
// Input parameters (matching acceptance criteria)
interface BashToolInput {
  /** The shell command to execute (required) */
  command: string;

  /** Optional timeout in milliseconds (default: 120000ms = 2 minutes, max: 600000ms = 10 minutes) */
  timeout?: number;

  /** Short description of what the command does (5-10 words) */
  description?: string;

  /** Run command in background, allowing async monitoring */
  run_in_background?: boolean;
}

// Output structure
interface BashToolOutput {
  /** Standard output from the command */
  stdout: string;

  /** Standard error output from the command */
  stderr: string;

  /** Exit code of the process (0 = success) */
  exitCode: number;

  /** Whether the command timed out */
  timedOut: boolean;

  /** Whether the command was cancelled via AbortSignal */
  cancelled: boolean;

  /** Execution duration in milliseconds */
  duration: number;

  /** Process ID (useful for background execution) */
  pid?: number;

  /** Background execution status */
  background?: boolean;
}
```

### 3. Implementation Architecture

The BashTool will use Node.js `child_process.spawn()` for several reasons:
- Stream-based output (better for large outputs)
- Better signal handling (for timeout/cancellation)
- Non-blocking I/O
- Access to PID for background process management

```typescript
class BashTool extends BaseTool<BashToolInput, BashToolOutput> {
  constructor() {
    super({
      name: 'Bash',
      description: 'Executes shell commands with timeout and structured output',
      category: 'shell',
      permissions: ['execute'],
      dangerous: true,  // Command execution is inherently dangerous
      parameters: { /* JSON Schema for BashToolInput */ },
      examples: [ /* Usage examples */ ],
      version: '1.0.0',
      tags: ['shell', 'command', 'execution'],
    });
  }

  protected async executeImpl(
    params: BashToolInput,
    context?: ToolExecutionContext
  ): Promise<BashToolOutput> {
    // 1. Spawn child process with shell
    // 2. Set up timeout handling
    // 3. Handle abort signal from context
    // 4. Collect stdout/stderr
    // 5. Return structured output
  }
}
```

### 4. Security Considerations

The tool will be marked as `dangerous: true` and require `execute` permission. Additional safeguards:

- **Timeout enforcement**: Default 2 minutes, max 10 minutes
- **Output truncation**: Limit stdout/stderr to prevent memory issues (configurable max ~30KB)
- **Working directory**: Respect `context.workingDirectory` when provided
- **Environment isolation**: Use `context.environment` if provided, otherwise inherit
- **Abort support**: Respect `context.signal` for cancellation

### 5. Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| Command not found | Return `{success: true, exitCode: 127, stderr: "..."}` |
| Permission denied | Return `{success: true, exitCode: 126, stderr: "..."}` |
| Timeout | Kill process, return `{success: true, timedOut: true}` |
| Cancelled | Kill process, return `{success: true, cancelled: true}` |
| Spawn failure | Throw error (caught by BaseTool.execute) |

Note: `success` in ToolResult refers to tool execution, not command success. A command with non-zero exit code is still a successful tool execution.

### 6. Background Execution

When `run_in_background: true`:
- Spawn process detached
- Return immediately with PID
- Caller can use PID to monitor/kill later

For MVP, background execution can be deferred to a future iteration if needed.

### 7. Testing Strategy

Tests will use controlled commands:
- `echo "test"` - Simple output verification
- `exit 1` - Non-zero exit code handling
- `sleep 0.1` - Timeout testing (with short timeout)
- `cat` - stdin handling (if needed later)
- Platform-specific handling for Windows vs Unix

## Consequences

### Positive
- Consistent with existing tool patterns (filesystem tools)
- Structured output enables reliable parsing by agents
- Timeout/cancellation support prevents runaway processes
- Security-conscious design with proper permissions
- Extensible for future features (background execution, streaming)

### Negative
- `dangerous: true` requires careful agent permission management
- Command execution is inherently platform-dependent
- Background execution adds complexity (can be deferred)

### Neutral
- Uses spawn() over exec() (trade-off: more code, better control)
- Output truncation may lose information (necessary for safety)

## Implementation Plan

1. **Create directory structure**: `packages/core/src/tools/shell/`
2. **Implement BashTool class** in `bash-tool.ts`
3. **Create index.ts** for exports
4. **Create register.ts** for registration utilities
5. **Update parent index.ts** to export shell tools
6. **Implement tests** in `__tests__/bash-tool.test.ts`
7. **Verify build and tests pass**

## File Changes Summary

### New Files
- `packages/core/src/tools/shell/bash-tool.ts` - Main implementation
- `packages/core/src/tools/shell/index.ts` - Module exports
- `packages/core/src/tools/shell/register.ts` - Registration utilities
- `packages/core/src/tools/shell/__tests__/bash-tool.test.ts` - Tests

### Modified Files
- `packages/core/src/tools/index.ts` - Add shell tool exports
