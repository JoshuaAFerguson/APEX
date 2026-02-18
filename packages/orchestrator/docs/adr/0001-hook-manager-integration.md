# ADR-0001: HookManager Integration with Orchestrator

## Status
Proposed

## Context

The APEX orchestrator needs to support user-configurable tool hooks that execute before (pre) and after (post) tool executions. While the current `hooks.ts` module provides SDK-compatible hooks for internal use (auditing, dangerous command blocking, permission checks), there's no mechanism for users to define custom hooks via configuration.

The `@apexcli/core` package already defines the necessary type schemas:
- `ToolHookConfig` - Configuration container for pre/post hooks
- `ToolHookDefinition` - Individual hook definition with handler path, priority, timeout
- `PreHookContext` / `PostHookContext` - Context passed to hooks
- `PreHookResult` / `PostHookResult` - Return values from hooks

## Decision

We will create a `HookManager` class in `packages/orchestrator/src/hook-manager.ts` that:

1. **Manages hook lifecycle**:
   - Loads hook definitions from `ApexConfig.toolHooks`
   - Validates handler paths exist and are executable
   - Sorts hooks by priority (higher priority = earlier execution)

2. **Provides execution methods**:
   - `executePreHooks(context: PreHookContext): Promise<PreHookExecutionResult>`
   - `executePostHooks(context: PostHookContext): Promise<PostHookExecutionResult>`

3. **Integrates with existing hook system**:
   - Works alongside existing SDK hooks in `hooks.ts`
   - User hooks execute within the pre/post hook chains
   - Pre-hooks can modify args or cancel execution (returned via result)
   - Post-hooks can observe and modify results

4. **Emits events for observability**:
   - `hook:pre:start` - When pre-hooks begin executing
   - `hook:pre:complete` - When pre-hooks finish (with result)
   - `hook:post:start` - When post-hooks begin executing
   - `hook:post:complete` - When post-hooks finish (with result)

## Architecture

### Class Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ApexOrchestrator                            │
├─────────────────────────────────────────────────────────────────────┤
│ - hookManager: HookManager                                         │
│ - config: ApexConfig                                               │
├─────────────────────────────────────────────────────────────────────┤
│ + initialize(): Promise<void>                                      │
│   └─> Creates HookManager with config.toolHooks                    │
│ - runStage(): Creates hookContext, integrates with HookManager     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           HookManager                               │
├─────────────────────────────────────────────────────────────────────┤
│ - preHooks: ToolHookDefinition[]                                   │
│ - postHooks: ToolHookDefinition[]                                  │
│ - config: ToolHookConfig                                           │
│ - eventEmitter: EventEmitter                                       │
│ - projectPath: string                                              │
│ - handlerCache: Map<string, HookHandler>                           │
├─────────────────────────────────────────────────────────────────────┤
│ + constructor(options: HookManagerOptions)                         │
│ + initialize(): Promise<void>                                      │
│ + executePreHooks(context: PreHookContext): Promise<PreResult>     │
│ + executePostHooks(context: PostHookContext): Promise<PostResult>  │
│ + getHooksForTool(toolName: string, type: 'pre'|'post'): Hook[]   │
│ + reloadHooks(): Promise<void>                                     │
│ - loadHandler(handlerPath: string): Promise<HookHandler>           │
│ - validateHandlerPath(path: string): Promise<boolean>              │
└─────────────────────────────────────────────────────────────────────┘
```

### Event Flow

```
Tool Execution Request
        │
        ▼
┌───────────────────────┐
│  Emit hook:pre:start  │ ◀── Contains: toolName, taskId, invocationId
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Execute Pre-Hooks    │ ◀── Sorted by priority, respects timeouts
│  (user-configured)    │     Can modify args or cancel execution
└───────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Emit hook:pre:complete  │ ◀── Contains: action, modifiedArgs, elapsed
└─────────────────────────┘
        │
        ▼ (if action != 'cancel')
┌───────────────────────┐
│  SDK PreToolUse hooks │ ◀── Existing hooks from hooks.ts
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│   Tool Execution      │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  SDK PostToolUse      │ ◀── Existing hooks from hooks.ts
└───────────────────────┘
        │
        ▼
┌────────────────────────┐
│  Emit hook:post:start  │ ◀── Contains: toolName, result, taskId
└────────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Execute Post-Hooks   │ ◀── Can observe or modify result
│  (user-configured)    │
└───────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ Emit hook:post:complete  │ ◀── Contains: modifiedResult, elapsed
└──────────────────────────┘
```

### Integration Points

1. **Orchestrator Constructor** (`index.ts`):
   ```typescript
   private hookManager!: HookManager;
   ```

2. **Orchestrator.initialize()** (`index.ts`):
   ```typescript
   // Initialize hook manager
   this.hookManager = new HookManager({
     projectPath: this.projectPath,
     config: this.config.toolHooks,
     eventEmitter: this,
   });
   await this.hookManager.initialize();
   ```

3. **Stage Execution** (`index.ts`, around line 2024):
   - Before calling `query()`, create enhanced `HookContext` that includes `hookManager`
   - The existing `createHooks()` will be modified to integrate with `HookManager`

4. **New Events** in `OrchestratorEvents`:
   ```typescript
   'hook:pre:start': (event: HookExecutionStartEvent) => void;
   'hook:pre:complete': (event: HookExecutionCompleteEvent) => void;
   'hook:post:start': (event: HookExecutionStartEvent) => void;
   'hook:post:complete': (event: HookExecutionCompleteEvent) => void;
   ```

### Handler Loading Strategy

Handlers are loaded from paths specified in hook definitions. Supported handler types:

1. **JavaScript/TypeScript modules** (`.js`, `.ts`):
   - Dynamically imported using `import()`
   - Must export a function matching `HookHandler` signature

2. **Shell scripts** (`.sh`, `.bash`):
   - Executed via `child_process.spawn`
   - Context passed via stdin (JSON)
   - Result read from stdout (JSON)

### Error Handling

- Hook timeouts: Abort hook and continue (or fail if `failOnError: true`)
- Handler load errors: Log error, skip hook, emit warning event
- Execution errors: Catch, log, respect `failOnError` setting
- Cancel actions: Return immediately with cancel result

## Consequences

### Positive
- Users can define custom pre/post hooks via configuration
- Clean separation between internal SDK hooks and user hooks
- Event-based observability for debugging and monitoring
- Priority-based execution order
- Timeout protection prevents runaway hooks

### Negative
- Additional complexity in hook execution flow
- Potential performance impact from multiple hook executions
- Need to maintain backward compatibility with existing hooks

### Neutral
- Handler caching trades memory for performance
- Dynamic import of handlers may have cold-start delay

## Implementation Plan

1. Create `hook-manager.ts` with `HookManager` class
2. Add new event types to `OrchestratorEvents` interface
3. Modify `ApexOrchestrator.initialize()` to create `HookManager`
4. Modify `createHooks()` in `hooks.ts` to integrate with `HookManager`
5. Add handler loading and execution logic
6. Write unit tests for `HookManager`
7. Update documentation

## Files to Create/Modify

### New Files
- `packages/orchestrator/src/hook-manager.ts` - HookManager class

### Modified Files
- `packages/orchestrator/src/index.ts` - Add hookManager, new events, initialize
- `packages/orchestrator/src/hooks.ts` - Integrate HookManager calls
- `packages/core/src/types.ts` - Add HookExecutionEvent types (if needed)
