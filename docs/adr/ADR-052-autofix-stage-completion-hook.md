# ADR-052: Auto-Fix Execution Hook After Code Generation Stages

## Status
Accepted

## Date
2026-01-09

## Context

APEX workflows include stages that generate or modify code (e.g., `implementation`, `testing`). After these stages complete, files may contain:
- Missing imports
- Syntax errors
- Formatting issues

Currently, while auto-fix events are defined (ADR-051), there is no automated mechanism to trigger the `AutoFixService` after code generation workflow stages complete. This requires manual intervention or relies on per-tool hooks that only run after individual file edits.

### Current State

1. **Per-tool auto-fix hooks** exist in `packages/orchestrator/src/hooks.ts` (line 826+) that run linters after file modifications via `Write`, `Edit`, `MultiEdit` tools.

2. **AutoFix events** are defined in `OrchestratorEvents` (lines 310-316):
   - `autofix:requested`, `autofix:started`, `autofix:progress`
   - `autofix:completed`, `autofix:failed`, `autofix:skipped`

3. **ImportAutoFixer** service exists in `packages/orchestrator/src/import-auto-fixer/` with full detection and resolution capabilities.

4. **Stage completion** happens in `executeWorkflowStage()` method (line 2298) where results are captured and the stage transitions to the next one.

### Problem

- Per-tool hooks run after **each** file modification, which is inefficient for batch operations
- No consolidation of auto-fix at stage boundaries
- Missing imports across multiple files aren't correlated
- No stage-level context for auto-fix decisions

## Decision

Implement an **Auto-Fix Stage Completion Hook** that triggers after code generation stages complete, running consolidated auto-fix on all modified files.

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ApexOrchestrator                                  │
│                                                                             │
│  executeWorkflow()                                                          │
│       │                                                                     │
│       ▼                                                                     │
│  executeWorkflowStage()                                                     │
│       │                                                                     │
│       ├─── [Stage Execution via Claude SDK] ───────────────────────────────►│
│       │         │                                                           │
│       │         ▼                                                           │
│       │    File modifications tracked via toolActionStore                   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │            Stage Completion Detection                               │    │
│  │                                                                     │    │
│  │  isCodeGenerationStage(stage) ?                                    │    │
│  │     └── Check stage.agent ∈ ['developer', 'tester']                │    │
│  │     └── Check stage.outputs includes 'code_changes', 'test_files'  │    │
│  │                                                                     │    │
│  └─────────────────────┬──────────────────────────────────────────────┘    │
│                        │                                                    │
│                        ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │            AutoFixStageHook                                         │    │
│  │                                                                     │    │
│  │  1. Get modified files from toolActionStore                        │    │
│  │  2. Filter to fixable file types (.ts, .tsx, .js, .jsx, etc.)      │    │
│  │  3. Emit autofix:requested event                                   │    │
│  │  4. Create AutoFixService with task context                        │    │
│  │  5. Run auto-fix on all files                                      │    │
│  │  6. Emit autofix:completed/failed/skipped events                   │    │
│  │  7. Return fix results for stage summary                           │    │
│  │                                                                     │    │
│  └─────────────────────┬──────────────────────────────────────────────┘    │
│                        │                                                    │
│                        ▼                                                    │
│  Stage continues or fails based on AutoFix outcome                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Key Components

#### 2.1 AutoFixStageHook Class

New class in `packages/orchestrator/src/autofix-stage-hook.ts`:

```typescript
export interface AutoFixStageHookOptions {
  projectPath: string;
  taskId: string;
  stageName: string;
  agentName: string;
  toolActionStore: ToolActionStore;
  config: AutoFixStageConfig;
  eventEmitter: EventEmitter<OrchestratorEvents>;
}

export interface AutoFixStageConfig {
  enabled: boolean;
  codeGenerationStages: string[];  // e.g., ['implementation', 'testing']
  codeGenerationAgents: string[];  // e.g., ['developer', 'tester']
  fixTypes: Array<'syntax' | 'imports' | 'formatting'>;
  stopOnError: boolean;
  maxFilesToFix: number;
}

export interface AutoFixStageResult {
  success: boolean;
  filesProcessed: number;
  filesFixed: number;
  totalIssuesDetected: number;
  totalIssuesFixed: number;
  errors: AutoFixError[];
  duration: number;
}

export class AutoFixStageHook {
  constructor(options: AutoFixStageHookOptions);

  /**
   * Determine if this stage should trigger auto-fix
   */
  shouldTrigger(stage: WorkflowStage): boolean;

  /**
   * Execute auto-fix on all files modified during the stage
   */
  async execute(): Promise<AutoFixStageResult>;

  /**
   * Get files modified during the current stage
   */
  private getModifiedFiles(): string[];

  /**
   * Filter files to those eligible for auto-fix
   */
  private filterFixableFiles(files: string[]): string[];
}
```

#### 2.2 Integration Point in ApexOrchestrator

Modification to `executeWorkflowStage()` method:

```typescript
// After stage execution completes (around line 2300)
private async executeWorkflowStage(
  task: Task,
  stage: WorkflowStage,
  agent: AgentDefinition,
  workflow: WorkflowDefinition,
  previousResults: Map<string, StageResult>,
  resumeContext?: string
): Promise<StageResult & { decompositionRequest?: DecompositionRequest }> {
  // ... existing stage execution ...

  // NEW: After stage completes successfully, run auto-fix hook
  const autoFixResult = await this.runAutoFixStageHook(task, stage, agent);

  // Include auto-fix results in stage summary
  const enhancedResult = {
    ...result,
    autoFix: autoFixResult,
    summary: autoFixResult?.filesFixed > 0
      ? `${result.summary}\n\nAuto-fix: Fixed ${autoFixResult.totalIssuesFixed} issues in ${autoFixResult.filesFixed} files.`
      : result.summary,
  };

  return enhancedResult;
}

private async runAutoFixStageHook(
  task: Task,
  stage: WorkflowStage,
  agent: AgentDefinition
): Promise<AutoFixStageResult | null> {
  const config = this.effectiveConfig.autoFix?.stageHook;
  if (!config?.enabled) return null;

  const hook = new AutoFixStageHook({
    projectPath: this.projectPath,
    taskId: task.id,
    stageName: stage.name,
    agentName: agent.name,
    toolActionStore: this.toolActionStore,
    config,
    eventEmitter: this,
  });

  if (!hook.shouldTrigger(stage)) return null;

  return hook.execute();
}
```

#### 2.3 Configuration Schema Addition

Add to `@apex/core/types.ts`:

```typescript
export const AutoFixStageConfigSchema = z.object({
  /** Enable auto-fix after code generation stages */
  enabled: z.boolean().default(true),

  /** Stage names that should trigger auto-fix */
  codeGenerationStages: z.array(z.string()).default(['implementation', 'testing']),

  /** Agent names that indicate code generation */
  codeGenerationAgents: z.array(z.string()).default(['developer', 'tester']),

  /** Types of fixes to apply */
  fixTypes: z.array(z.enum(['syntax', 'imports', 'formatting'])).default(['imports', 'formatting']),

  /** Whether to fail the stage if auto-fix fails */
  stopOnError: z.boolean().default(false),

  /** Maximum number of files to process (0 = unlimited) */
  maxFilesToFix: z.number().min(0).default(50),
});

export type AutoFixStageConfig = z.infer<typeof AutoFixStageConfigSchema>;
```

### 3. Event Flow

```
Stage "implementation" completes
    │
    ▼
shouldTrigger() → true (developer agent, outputs code_changes)
    │
    ▼
emit('autofix:requested', {
  taskId,
  filePath: '*', // Multiple files
  fixTypes: ['imports', 'formatting'],
  triggeredBy: 'hook',
  timestamp
})
    │
    ▼
For each modified file:
    │
    ├── emit('autofix:started', { taskId, filePath, fixType, issuesDetected })
    │
    ├── Run ImportAutoFixer.fix()
    │
    ├── emit('autofix:progress', { taskId, filePath, issuesFixed, issuesRemaining })
    │
    └── emit('autofix:completed', { taskId, filePath, issuesFixed, duration })
        OR
        emit('autofix:failed', { taskId, filePath, error })
    │
    ▼
Return AutoFixStageResult
```

### 4. File Tracking Integration

Leverage existing `ToolActionStore` to get modified files:

```typescript
private getModifiedFiles(): string[] {
  const actions = this.toolActionStore.getActionsForTask(this.taskId);

  const modifiedFiles = new Set<string>();

  for (const action of actions) {
    // Only include actions from current stage
    if (action.stageName !== this.stageName) continue;

    // Only include file-modifying tools
    if (!['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(action.toolName)) continue;

    // Extract file path from action
    const filePath = this.extractFilePath(action);
    if (filePath) {
      modifiedFiles.add(filePath);
    }
  }

  return Array.from(modifiedFiles);
}
```

### 5. Failure Handling

```typescript
async execute(): Promise<AutoFixStageResult> {
  const files = this.getModifiedFiles();
  const fixableFiles = this.filterFixableFiles(files);

  if (fixableFiles.length === 0) {
    this.eventEmitter.emit('autofix:skipped', {
      taskId: this.taskId,
      filePath: '*',
      reason: 'no_issues',
      timestamp: new Date(),
    });
    return { success: true, filesProcessed: 0, filesFixed: 0, ... };
  }

  const results = await Promise.allSettled(
    fixableFiles.map(file => this.fixFile(file))
  );

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => ({ file: '?', error: r.reason.message }));

  // Determine success based on config
  const success = this.config.stopOnError ? errors.length === 0 : true;

  return {
    success,
    filesProcessed: fixableFiles.length,
    filesFixed: results.filter(r => r.status === 'fulfilled').length,
    errors,
    ...
  };
}
```

## Files to Create/Modify

### New Files
1. `packages/orchestrator/src/autofix-stage-hook.ts` - Main hook implementation
2. `packages/orchestrator/src/autofix-stage-hook.test.ts` - Unit tests

### Modify Files
1. `packages/orchestrator/src/index.ts` - Add hook integration to executeWorkflowStage
2. `packages/core/src/types.ts` - Add AutoFixStageConfigSchema
3. `packages/core/src/config.ts` - Add default config values

## Consequences

### Positive
- Consolidated auto-fix at stage boundaries is more efficient than per-tool hooks
- Stage-level context enables smarter fix decisions
- Clean separation of concerns between per-tool and per-stage auto-fix
- Configurable trigger conditions support different workflows
- Event-driven design enables UI/CLI progress reporting

### Negative
- Additional complexity in stage execution flow
- Potential duplicate work if per-tool hooks are also enabled
- Need to coordinate with existing linter integration

### Risks
- Performance impact if many files modified in a single stage (mitigated by maxFilesToFix)
- Race conditions with file system if stage execution continues (mitigated by running hook synchronously)

## Alternatives Considered

### 1. Enhance Per-Tool Hooks Only
Rejected because per-tool hooks run after each file modification, missing cross-file context and causing N runs instead of 1.

### 2. Separate Post-Stage Workflow Step
Rejected because it would require workflow file modifications and wouldn't be automatic.

### 3. Background Auto-Fix Process
Rejected because synchronous execution ensures fixes are included in stage results and PR.

## Implementation Plan

1. **Phase 1** (This stage - architecture): Design complete ✓
2. **Phase 2** (implementation): Create AutoFixStageHook class and integrate
3. **Phase 3** (testing): Add comprehensive tests
4. **Phase 4** (review): Validate integration with existing linter hooks

## References

- ADR-051: Auto-Fix Orchestrator Event Integration
- `packages/orchestrator/src/import-auto-fixer/` - ImportAutoFixer implementation
- `packages/orchestrator/src/hooks.ts` - Existing per-tool hook implementation
- `packages/orchestrator/src/linter/service.ts` - LinterService for comparison
