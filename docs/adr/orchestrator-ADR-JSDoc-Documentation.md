# Architecture Decision Record: JSDoc Documentation for @apex/orchestrator Public APIs

## Status
Accepted

## Context
The `@apex/orchestrator` package contains the core orchestration logic for APEX, including task management, daemon execution, prompt building, and various service integrations. The public APIs currently lack comprehensive JSDoc documentation, making it difficult for consumers to understand the intended usage, parameters, and return values.

## Decision
We will add comprehensive JSDoc documentation to all exported classes, functions, interfaces, and types in the following files:

### Priority 1 - Core Public APIs (Must Have)
1. **index.ts** - `ApexOrchestrator` class
   - Main orchestration class with 100+ methods
   - Events interface (`OrchestratorEvents`)
   - All exported interfaces and types

2. **store.ts** - `TaskStore` and `ToolActionStore` classes
   - Database interaction layer
   - Task CRUD operations
   - Checkpoint, log, artifact management

3. **runner.ts** - `DaemonRunner` class
   - Background task execution
   - Metrics and logging interfaces

### Priority 2 - Supporting Services
4. **prompts.ts** - Prompt building functions
   - `buildOrchestratorPrompt`
   - `buildAgentDefinitions`
   - `buildStagePrompt`
   - `buildResumePrompt`
   - `parseDecompositionRequest`

5. **hooks.ts** - Hook system
   - `createHooks` function
   - `HookContext` interface
   - Hook configuration types

6. **context.ts** - Context management
   - Token estimation functions
   - Context compaction utilities
   - Summary generation

### Priority 3 - Additional Service Classes
7. **daemon.ts** - `DaemonManager` class
8. **workspace-manager.ts** - `WorkspaceManager` class
9. **worktree-manager.ts** - `WorktreeManager` class
10. **policy-engine.ts** - `PolicyEngine` class
11. **browser-manager.ts** - `BrowserManager` class
12. **linter/service.ts** - `LinterService` class

## JSDoc Standard Format

### Classes
```typescript
/**
 * Brief description of what the class does.
 *
 * Additional context about usage patterns, lifecycle, or important behaviors.
 *
 * @example
 * ```typescript
 * const orchestrator = new ApexOrchestrator({ projectPath: '/my/project' });
 * await orchestrator.initialize();
 * const task = await orchestrator.createTask({ description: 'Build feature X' });
 * await orchestrator.executeTask(task.id);
 * ```
 *
 * @fires OrchestratorEvents#task:created - When a new task is created
 * @fires OrchestratorEvents#task:completed - When a task finishes successfully
 */
export class ApexOrchestrator extends EventEmitter<OrchestratorEvents> {
```

### Methods
```typescript
/**
 * Brief description of the method's purpose.
 *
 * Additional details about behavior, side effects, or important notes.
 *
 * @param taskId - The unique identifier of the task
 * @param options - Configuration options for execution
 * @param options.autoRetry - Whether to automatically retry on transient failures
 * @param options.cliFlags - CLI-specific flags to pass through
 *
 * @returns A promise that resolves when execution completes
 *
 * @throws {Error} If the task is not found
 * @throws {Error} If the workflow is not configured
 *
 * @example
 * ```typescript
 * await orchestrator.executeTask('task_abc123', { autoRetry: true });
 * ```
 */
async executeTask(taskId: string, options?: ExecuteTaskOptions): Promise<void> {
```

### Interfaces
```typescript
/**
 * Configuration options for the orchestrator.
 *
 * @example
 * ```typescript
 * const options: OrchestratorOptions = {
 *   projectPath: '/path/to/project',
 *   apiUrl: 'http://localhost:3000'
 * };
 * ```
 */
export interface OrchestratorOptions {
  /**
   * Absolute path to the project directory containing `.apex/` configuration.
   * This directory must exist and contain valid APEX configuration files.
   */
  projectPath: string;

  /**
   * Base URL for the APEX API server.
   * Used for task status updates and coordination.
   * @default undefined - Uses environment variable or config file
   */
  apiUrl?: string;
}
```

### Functions
```typescript
/**
 * Builds the system prompt for the orchestrator agent.
 *
 * This prompt establishes the agent's role, available tools, workflow context,
 * and operational guidelines for the AI orchestrator.
 *
 * @param context - The context containing config, workflow, task, and agent information
 * @returns The formatted system prompt string
 *
 * @example
 * ```typescript
 * const prompt = buildOrchestratorPrompt({
 *   config: effectiveConfig,
 *   workflow: featureWorkflow,
 *   task: currentTask,
 *   agents: loadedAgents
 * });
 * ```
 */
export function buildOrchestratorPrompt(context: PromptContext): string {
```

### Event Interfaces
```typescript
/**
 * Event data emitted when a task is created.
 *
 * @event OrchestratorEvents#task:created
 */
export interface TaskCreatedEvent {
  /** The newly created task */
  task: Task;
  /** Timestamp when the task was created */
  createdAt: Date;
}
```

### Type Aliases
```typescript
/**
 * Supported browser rendering engines for automated testing.
 *
 * - `chromium` - Chrome/Edge browser engine (recommended for most use cases)
 * - `firefox` - Mozilla Firefox engine
 * - `webkit` - Safari browser engine
 */
export type BrowserEngine = 'chromium' | 'firefox' | 'webkit';
```

## Documentation Tags to Use

| Tag | Usage |
|-----|-------|
| `@param` | Required for all parameters |
| `@returns` | Required for all non-void return types |
| `@throws` | Document all thrown exceptions |
| `@example` | Required for all public methods and classes |
| `@default` | Document default values for optional parameters |
| `@fires` | Document events emitted by the method |
| `@see` | Cross-reference related types or methods |
| `@since` | Version when the API was introduced |
| `@deprecated` | Mark deprecated APIs with migration guidance |

## Implementation Guidelines

### 1. Completeness
- Every exported symbol must have JSDoc documentation
- All parameters must be documented with `@param`
- All return types must be documented with `@returns`
- At least one `@example` per public method

### 2. Clarity
- First line should be a concise summary (max 80 chars)
- Use present tense ("Creates a task" not "Create a task")
- Avoid redundant phrases ("This method..." is unnecessary)
- Include units for numeric parameters (milliseconds, bytes, etc.)

### 3. Examples
- Examples should be runnable TypeScript code
- Include import statements if needed for clarity
- Show common use cases, not edge cases
- Use realistic parameter values

### 4. Cross-References
- Link related types with `@see`
- Reference parent classes/interfaces
- Link to events when documenting emitting methods

## File-by-File Implementation Plan

### index.ts (ApexOrchestrator)
- Document `ApexOrchestrator` class (main entry point)
- Document all 40+ exported interfaces
- Document all event types in `OrchestratorEvents`
- Document public methods: `initialize`, `createTask`, `executeTask`, `cancelTask`, `resumeTask`, `pauseTask`, `getTaskStatus`, etc.

### store.ts (TaskStore)
- Document `TaskStore` class
- Document `ToolActionStore` class
- Document all CRUD operations
- Document checkpoint/iteration/template methods

### runner.ts (DaemonRunner)
- Document `DaemonRunner` class
- Document `DaemonRunnerOptions` interface
- Document `DaemonMetrics` interface
- Document `start`, `stop`, `getMetrics` methods

### prompts.ts
- Document all exported functions
- Document `PromptContext` and `DecompositionRequest` interfaces
- Include examples showing prompt output structure

### hooks.ts
- Document `createHooks` function
- Document `HookContext` interface
- Document security-related patterns and restrictions

### context.ts
- Document all token estimation functions
- Document context compaction strategies
- Document summary generation functions

## Consequences

### Positive
- Improved developer experience with IntelliSense support
- Self-documenting API reduces need for external docs
- Easier onboarding for new contributors
- Better type safety through documented contracts

### Negative
- Increased maintenance overhead (docs must stay in sync)
- Larger source files
- Risk of documentation drift if not maintained

## Validation Criteria
1. All exported symbols have JSDoc comments
2. Every `@param` has a description
3. Every `@returns` has a description
4. At least one `@example` per public class/function
5. `npm run build` passes without errors
6. `npm run test` passes without failures

## Related Documents
- TypeScript JSDoc Reference: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
- TSDoc Standard: https://tsdoc.org/
