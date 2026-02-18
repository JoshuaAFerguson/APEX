# ADR-001: LinterService Orchestration Architecture

## Status

Proposed

## Context

APEX requires a unified linting orchestration layer that can:
1. Manage multiple linter plugin registrations
2. Execute configured linters in sequence or parallel
3. Aggregate results from multiple linters
4. Coordinate auto-fix operations across linters
5. Emit events for progress tracking and integration

The existing infrastructure includes:
- `ILinterPlugin` interface and `BaseLinterPlugin` base class for individual linters
- `ESLintPlugin` as a reference implementation
- EventEmitter-based event system throughout the codebase
- Pattern of service classes with `initialize()` lifecycle methods

## Decision

### Core Architecture

The `LinterService` class will follow these architectural principles:

#### 1. Plugin Registry Pattern

```typescript
interface LinterServiceOptions {
  /** Working directory for linter execution */
  projectPath: string;

  /** Default timeout for linter execution (ms) */
  defaultTimeout?: number;

  /** Maximum concurrent linters when running in parallel */
  maxConcurrency?: number;

  /** Auto-fix configuration */
  autoFix?: {
    enabled: boolean;
    maxAttempts?: number;
    backoffMs?: number;
  };
}

interface RegisteredPlugin {
  plugin: ILinterPlugin;
  enabled: boolean;
  priority: number;
  config?: LinterPluginConfig;
}

interface LinterPluginConfig {
  /** Override timeout for this specific linter */
  timeout?: number;
  /** File patterns to include (overrides plugin defaults) */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Whether to enable auto-fix for this linter */
  autoFix?: boolean;
  /** Additional linter-specific configuration */
  extraConfig?: Record<string, unknown>;
}
```

#### 2. Execution Modes

The service supports two execution modes:

**Sequential Mode** (default):
- Linters run in priority order
- Each linter completes before the next starts
- Suitable for linters that may conflict or have dependencies
- Simpler error handling and debugging

**Parallel Mode**:
- Linters run concurrently up to `maxConcurrency`
- Faster for independent linters
- Results aggregated upon completion
- Requires careful file locking for fixes

```typescript
type ExecutionMode = 'sequential' | 'parallel';

interface ExecuteOptions {
  mode?: ExecutionMode;
  files?: string[];
  patterns?: string[];
  fix?: boolean;
  linterIds?: string[];  // Run only specific linters
  stopOnError?: boolean; // Stop execution on first linter failure
}
```

#### 3. Result Aggregation

Aggregated results combine outputs from all linters:

```typescript
interface AggregatedLintResult {
  /** Overall success (all linters succeeded) */
  success: boolean;

  /** Combined issues from all linters */
  issues: LintIssue[];

  /** Per-linter results for detailed analysis */
  linterResults: Map<string, LintResult>;

  /** Summary statistics */
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    hintCount: number;
    filesChecked: number;
    filesWithIssues: number;
    lintersRun: number;
    lintersSucceeded: number;
    lintersFailed: number;
    totalDuration: number;
  };

  /** Issues grouped by file for efficient display */
  issuesByFile: Map<string, LintIssue[]>;

  /** Issues grouped by severity */
  issuesBySeverity: Record<LintSeverity, LintIssue[]>;
}
```

#### 4. Auto-Fix Coordination

Fixes are applied carefully to avoid conflicts:

```typescript
interface FixCoordinator {
  /** Plan fixes across all linters, detecting conflicts */
  planFixes(issues: LintIssue[]): FixPlan;

  /** Apply fixes in safe order */
  applyFixes(plan: FixPlan): Promise<AggregatedFixResult>;
}

interface FixPlan {
  /** Fixes that can be applied safely */
  safeToApply: LintIssue[];

  /** Fixes with potential conflicts */
  conflicts: FixConflict[];

  /** Order of application */
  applicationOrder: FixBatch[];
}

interface FixBatch {
  filePath: string;
  issues: LintIssue[];
  linterId: string;
}

interface FixConflict {
  file: string;
  issues: LintIssue[];
  reason: 'overlapping-range' | 'same-location' | 'mutual-exclusion';
}

interface AggregatedFixResult {
  success: boolean;
  totalFilesFixed: number;
  totalIssuesFixed: number;
  fixResultsByLinter: Map<string, FixResult>;
  conflicts: FixConflict[];
  unfixedIssues: LintIssue[];
  error?: string;
}
```

#### 5. Event System

Events for progress tracking and integration:

```typescript
interface LinterServiceEvents {
  // Lifecycle events
  'service:initialized': () => void;
  'service:disposed': () => void;

  // Plugin events
  'plugin:registered': (event: PluginRegisteredEvent) => void;
  'plugin:unregistered': (event: PluginUnregisteredEvent) => void;
  'plugin:enabled': (event: PluginStateChangedEvent) => void;
  'plugin:disabled': (event: PluginStateChangedEvent) => void;

  // Execution events
  'execution:started': (event: ExecutionStartedEvent) => void;
  'execution:progress': (event: ExecutionProgressEvent) => void;
  'execution:completed': (event: ExecutionCompletedEvent) => void;
  'execution:error': (event: ExecutionErrorEvent) => void;

  // Per-linter events (forwarded from plugins)
  'linter:started': (event: LinterStartedEvent) => void;
  'linter:completed': (event: LinterCompletedEvent) => void;
  'linter:issue': (event: LinterIssueEvent) => void;

  // Fix events
  'fix:started': (event: FixStartedEvent) => void;
  'fix:progress': (event: FixProgressEvent) => void;
  'fix:completed': (event: FixCompletedEvent) => void;
  'fix:conflict': (event: FixConflictEvent) => void;
}

interface ExecutionStartedEvent {
  executionId: string;
  mode: ExecutionMode;
  linters: string[];
  files: string[];
  timestamp: Date;
}

interface ExecutionProgressEvent {
  executionId: string;
  completedLinters: number;
  totalLinters: number;
  currentLinter?: string;
  issuesSoFar: number;
}

interface ExecutionCompletedEvent {
  executionId: string;
  result: AggregatedLintResult;
  timestamp: Date;
}
```

### Class Structure

```typescript
export class LinterService extends EventEmitter<LinterServiceEvents> {
  // State
  private plugins: Map<string, RegisteredPlugin>;
  private options: Required<LinterServiceOptions>;
  private initialized: boolean;
  private executionCounter: number;

  // Lifecycle
  constructor(options: LinterServiceOptions);
  async initialize(): Promise<void>;
  async dispose(): Promise<void>;

  // Plugin Management
  register(plugin: ILinterPlugin, config?: LinterPluginConfig): void;
  unregister(linterId: string): boolean;
  enable(linterId: string): void;
  disable(linterId: string): void;
  getPlugin(linterId: string): ILinterPlugin | undefined;
  getRegisteredPlugins(): RegisteredPlugin[];
  isPluginAvailable(linterId: string): Promise<boolean>;

  // Execution
  async execute(options?: ExecuteOptions): Promise<AggregatedLintResult>;
  async fix(issues: LintIssue[], options?: FixOptions): Promise<AggregatedFixResult>;

  // Utilities
  getIssuesByFile(result: AggregatedLintResult): Map<string, LintIssue[]>;
  getSupportedExtensions(): string[];

  // Private methods
  private executeSequential(options: ExecuteOptions): Promise<AggregatedLintResult>;
  private executeParallel(options: ExecuteOptions): Promise<AggregatedLintResult>;
  private aggregateResults(results: Map<string, LintResult>): AggregatedLintResult;
  private planFixes(issues: LintIssue[]): FixPlan;
  private detectFixConflicts(issues: LintIssue[]): FixConflict[];
  private forwardPluginEvents(plugin: ILinterPlugin, linterId: string): void;
}
```

### Integration Points

1. **With ApexOrchestrator**: LinterService can be instantiated and used by the orchestrator for automated code quality checks during task execution.

2. **With WorkspaceManager**: Linting can be scoped to specific workspace paths for isolated task execution.

3. **With Event System**: All events are compatible with the existing orchestrator event forwarding patterns.

## Consequences

### Positive

1. **Extensible**: Easy to add new linter plugins without modifying core service
2. **Flexible Execution**: Sequential or parallel modes support different use cases
3. **Observable**: Comprehensive events enable rich UI integration
4. **Safe Fixes**: Conflict detection prevents destructive auto-fix operations
5. **Consistent**: Follows existing codebase patterns (EventEmitter, initialize/dispose)

### Negative

1. **Complexity**: Multiple execution modes add code complexity
2. **Memory**: Aggregating results from many linters could consume significant memory
3. **Fix Conflicts**: Parallel fixes require careful coordination

### Risks

1. **Plugin Compatibility**: Plugins must correctly implement the interface
2. **Resource Contention**: Parallel linting on large codebases may strain resources
3. **Fix Ordering**: Some fix conflicts may be hard to detect automatically

## Implementation Notes

### Priority System

Plugins are registered with a priority (0 = highest). Default priority is 100.
When executing sequentially, plugins run in priority order.
When executing in parallel, priority determines which linter's fix takes precedence in conflicts.

### File Filtering

Files are filtered using a combination of:
1. Global include/exclude patterns from execute options
2. Per-plugin include/exclude from plugin config
3. Plugin's `supportedExtensions` from metadata

### Error Handling

- Individual linter failures don't stop execution (unless `stopOnError: true`)
- Failed linters are marked in results with error details
- Fix failures are recorded but don't prevent other fixes

### Concurrency Control

Parallel execution uses a semaphore pattern to limit concurrent linter processes:
- Default `maxConcurrency`: 4
- Each linter process counts against the limit
- Prevents resource exhaustion on large codebases

## Related Documents

- `plugin.ts` - ILinterPlugin interface and BaseLinterPlugin
- `plugins/eslint.ts` - Reference ESLint plugin implementation
- ADR-002 (future) - Linter Configuration Schema
