# ADR-065: Code Quality Integration - Lint-After-Edit and Auto-Fix

## Status

Accepted

## Date

2025-01-10

## Context

APEX v0.5.0 requires automatic code quality enforcement that integrates seamlessly with the AI agent workflow. When agents modify code via Edit/Write operations, the system should automatically validate and fix code quality issues without manual intervention.

### Current State Analysis

The codebase already has significant infrastructure in place:

1. **LinterService** (`packages/orchestrator/src/linter/service.ts`)
   - Full plugin-based linter orchestration
   - Sequential and parallel execution modes
   - Result aggregation across multiple linters
   - Fix conflict detection and safe fix application
   - Comprehensive event emission for progress tracking

2. **ESLintPlugin** (`packages/orchestrator/src/linter/plugins/eslint.ts`)
   - Complete ESLint integration with JSON output parsing
   - Auto-fix support via `--fix` flag
   - Event emission for issues and fixes

3. **PrettierPlugin** (test file exists: `packages/orchestrator/src/linter/plugins/PrettierPlugin.test.ts`)
   - Mock implementation in tests demonstrating expected interface
   - Needs actual implementation file

4. **Hook System** (`packages/orchestrator/src/hooks.ts`)
   - `lintAfterEdit` hook already implemented (lines 797-846)
   - Triggered for FILE_MODIFYING_TOOLS: `['Write', 'Edit', 'MultiEdit', 'NotebookEdit']`
   - Checks `config.linter.global.runAfterEdit` to enable/disable

5. **Configuration Schema** (`packages/core/src/types.ts`)
   - `LinterConfigSchema` with `runAfterEdit` option
   - `CodeQualityConfigSchema` with `preEditValidation`, `typecheck`, and `autoFix`
   - Full schema support for ESLint, Prettier, and custom linters

### What's Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| LinterService orchestration | ✅ Complete | `orchestrator/src/linter/service.ts` |
| ESLintPlugin | ✅ Complete | `orchestrator/src/linter/plugins/eslint.ts` |
| PrettierPlugin | ⚠️ Tests only | `orchestrator/src/linter/plugins/PrettierPlugin.test.ts` |
| `lintAfterEdit` hook | ✅ Complete | `orchestrator/src/hooks.ts:797-846` |
| `runTypecheckAfterEdit` hook | ✅ Complete | `orchestrator/src/hooks.ts:887-965` |
| LinterConfig schema | ✅ Complete | `core/src/types.ts` |
| CodeQualityConfig schema | ✅ Complete | `core/src/types.ts` |
| Config loading for linter | ✅ Complete | `core/src/config.ts:795-801` |
| Lint-after-edit tests | ✅ Complete | `orchestrator/src/hooks-lint-after-edit.test.ts` |

### What Needs to Be Done

1. **PrettierPlugin Implementation**: Create actual plugin file (tests exist, implementation missing)
2. **Plugin Registration in Orchestrator**: Wire up plugins to LinterService in ApexOrchestrator
3. **Additional Tests**: Verify auto-fix integration and configurable linter behavior

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ApexOrchestrator                              │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│ │ HookContext  │──▶│   Hooks      │──▶│   PostToolUse Hooks      │ │
│ │  .linterSvc  │   │ createHooks()│   │  - recordFileModifying   │ │
│ │  .config     │   │              │   │  - lintAfterEdit ◀────── │ │
│ └──────────────┘   └──────────────┘   │  - runTypecheckAfterEdit │ │
│                                        └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┬─┘
                                                                    │
                  ┌─────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LinterService                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  ESLintPlugin  │  │ PrettierPlugin │  │ Custom Plugins │        │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘        │
│           │                   │                   │                 │
│           └───────────────────┼───────────────────┘                 │
│                               │                                     │
│                      ┌────────▼────────┐                           │
│                      │  execute()      │                           │
│                      │  - sequential   │                           │
│                      │  - parallel     │                           │
│                      └────────┬────────┘                           │
│                               │                                     │
│                      ┌────────▼────────┐                           │
│                      │  fix()          │                           │
│                      │  - auto-fix     │                           │
│                      │  - conflict det │                           │
│                      └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Lint-After-Edit

```
1. Agent calls Edit/Write tool
   │
   ▼
2. PreToolUse hooks capture file snapshot
   │
   ▼
3. Tool executes (file modified)
   │
   ▼
4. PostToolUse hooks triggered
   │
   ├──▶ recordFileModifyingToolAction (stores action)
   │
   └──▶ lintAfterEdit
        │
        ├── Check: config.linter.global.runAfterEdit == true?
        │   └── No: return {} (skip)
        │
        ├── Check: context.linterService exists?
        │   └── No: return {} (skip)
        │
        └── Yes: Execute linter
            │
            ▼
            linterService.execute({
              files: [modifiedFilePath],
              mode: config.linter.global.parallel ? 'parallel' : 'sequential',
              fix: autoFixEnabled,  // from integrations.ide.autoFixOnSave or linter.eslint.autoFix
              stopOnError: config.linter.global.failFast,
              timeout: config.linter.global.timeoutMs
            })
            │
            ▼
        5. LinterService executes registered plugins
            │
            ├── ESLintPlugin.execute() → LintResult
            ├── PrettierPlugin.execute() → LintResult
            └── [Custom].execute() → LintResult
            │
            ▼
        6. Results aggregated → AggregatedLintResult
            │
            ▼
        7. If fix enabled && issues.some(i => i.fix):
            └── LinterService.fix(issues) → Apply auto-fixes
            │
            ▼
        8. Errors logged to TaskStore
```

### Configuration Schema

The configuration is already defined in `packages/core/src/types.ts`:

```yaml
# .apex/config.yaml
linter:
  global:
    enabled: true
    runAfterEdit: true      # <- Triggers lint-after-edit hook
    runOnCommit: true
    runOnSave: false
    parallel: true
    maxConcurrency: 4
    failFast: false
    timeoutMs: 60000

  eslint:
    enabled: true
    autoFix: true           # <- Auto-fix for ESLint issues
    configPath: .eslintrc.js
    extensions: ['.js', '.jsx', '.ts', '.tsx']
    failOnWarning: false

  prettier:
    enabled: true
    autoFix: true           # <- Auto-fix for Prettier formatting
    configPath: .prettierrc
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.md']

  custom:
    - name: 'mypy'
      enabled: true
      command: 'mypy'
      args: ['--strict']
      parseFormat: 'line'
      linePattern: '^(?<file>.+):(?<line>\d+):(?<column>\d+): (?<severity>error|warning): (?<message>.+)$'
      extensions: ['.py']
      autoFix: false

  integrations:
    ide:
      autoFixOnSave: true   # <- Alternative auto-fix trigger
    git:
      hookType: 'pre-commit'

codeQuality:
  preEditValidation:
    enabled: true
    mode: 'warn'            # 'warn' | 'block'

  typecheck:
    enabled: true
    runAfterEdit: true
    command: 'npm run typecheck'
    timeoutMs: 60000
    failOnError: false

  autoFix:
    enabled: true
    triggerStages: ['implementation', 'testing', 'development', 'coding']
    triggerAgents: ['developer', 'tester']
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx']
    maxFilesPerStage: 50
    skipOnStageFailure: true
```

### Implementation Tasks

#### Task 1: Create PrettierPlugin Implementation

**File**: `packages/orchestrator/src/linter/plugins/prettier.ts`

The test file `PrettierPlugin.test.ts` contains a complete MockPrettierPlugin that demonstrates the expected interface. Create the actual implementation:

```typescript
export class PrettierPlugin extends BaseLinterPlugin {
  get metadata(): LinterPluginMetadata {
    return {
      id: 'prettier',
      name: 'Prettier',
      description: 'Code formatter for maintaining consistent style',
      supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.less', '.html', '.vue', '.md', '.yaml', '.yml'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    // Use --check flag for detection, --write for fix
    const args = this.buildPrettierArgs(options);
    const result = await this.spawnProcess('prettier', args, options);
    return this.createLintResult(this.parse(result.stdout), ...);
  }

  parse(output: string): LintIssue[] {
    // Parse prettier --check output (lists files needing formatting)
    // Each non-header line is a file path
  }

  async fix(issues: LintIssue[], options?: FixOptions): Promise<FixResult> {
    // Run prettier --write on the file paths
    const files = [...new Set(issues.map(i => i.filePath))];
    await this.spawnProcess('prettier', ['--write', ...files], options);
    // Verify fixes by running --check again
  }
}
```

#### Task 2: Wire Up LinterService in ApexOrchestrator

**File**: `packages/orchestrator/src/index.ts`

The orchestrator needs to:
1. Create LinterService instance based on config
2. Register appropriate plugins (ESLint, Prettier, custom)
3. Pass linterService to HookContext

```typescript
// In ApexOrchestrator constructor or initialize method:

private async initializeLinterService(): Promise<void> {
  const linterConfig = this.config.linter;
  if (!linterConfig?.global?.enabled) return;

  this.linterService = new LinterService({
    projectPath: this.projectPath,
    defaultTimeout: linterConfig.global.timeoutMs,
    maxConcurrency: linterConfig.global.maxConcurrency,
    autoFix: {
      enabled: linterConfig.integrations?.ide?.autoFixOnSave ?? false,
    },
  });

  await this.linterService.initialize();

  // Register ESLint if enabled
  if (linterConfig.eslint?.enabled !== false) {
    const eslint = new ESLintPlugin();
    if (await eslint.isAvailable()) {
      this.linterService.register(eslint, {
        autoFix: linterConfig.eslint?.autoFix,
        priority: 1,
      });
    }
  }

  // Register Prettier if enabled
  if (linterConfig.prettier?.enabled !== false) {
    const prettier = new PrettierPlugin();
    if (await prettier.isAvailable()) {
      this.linterService.register(prettier, {
        autoFix: linterConfig.prettier?.autoFix,
        priority: 2, // Run after ESLint
      });
    }
  }

  // Register custom linters
  for (const custom of linterConfig.custom ?? []) {
    if (custom.enabled) {
      const plugin = new CustomLinterPlugin(custom);
      this.linterService.register(plugin, { autoFix: custom.autoFix });
    }
  }
}
```

#### Task 3: Export Plugins from Linter Index

**File**: `packages/orchestrator/src/linter/index.ts`

```typescript
// Add exports
export { ESLintPlugin } from './plugins/eslint';
export { PrettierPlugin } from './plugins/prettier';
```

#### Task 4: Add Integration Tests

**File**: `packages/orchestrator/src/linter/lint-after-edit.integration.test.ts`

Test the full flow:
1. Create HookContext with LinterService
2. Trigger PostToolUse hook with Write/Edit input
3. Verify linterService.execute() called with correct parameters
4. Verify auto-fix applied when enabled
5. Verify logs written to TaskStore

### API Contract

#### LinterService.execute()

```typescript
interface ExecuteOptions {
  mode?: 'sequential' | 'parallel';
  files?: string[];
  patterns?: string[];
  fix?: boolean;
  linterIds?: string[];
  stopOnError?: boolean;
  timeout?: number;
  env?: Record<string, string>;
}

interface AggregatedLintResult {
  success: boolean;
  issues: LintIssue[];
  linterResults: Map<string, LintResult>;
  summary: LintSummary;
  issuesByFile: Map<string, LintIssue[]>;
  issuesBySeverity: Record<LintSeverity, LintIssue[]>;
}
```

#### Hook Context Contract

```typescript
interface HookContext {
  taskId: string;
  store: TaskStore;
  linterService?: LinterService;  // Optional, may not be initialized
  config?: {
    linter?: LinterConfig;
    codeQuality?: CodeQualityConfig;
  };
}
```

### Error Handling

1. **Linter not available**: Skip silently, log at debug level
2. **Linter timeout**: Log warning, continue execution
3. **Linter failure**: Log error, do not block tool execution
4. **Fix conflict**: Log warning, apply non-conflicting fixes only
5. **Config missing**: Use sensible defaults, lint disabled by default

### Event Emission

The lintAfterEdit hook should emit events for monitoring:

```typescript
// Already handled by LinterService events:
'execution:started'
'execution:completed'
'linter:issue'
'fix:applied'

// TaskStore logs:
context.store.addLog(taskId, {
  level: 'warn',
  message: 'Lint after edit failed',
  metadata: { tool, filePaths, error }
});
```

## Consequences

### Positive

1. **Automatic code quality**: Every AI-generated edit is automatically validated
2. **Reduced feedback loops**: Auto-fix resolves common issues immediately
3. **Configurable**: Teams can choose which linters to use and when
4. **Non-blocking**: Lint failures don't prevent tool execution
5. **Extensible**: Plugin architecture allows adding new linters

### Negative

1. **Performance overhead**: Each edit triggers linter execution
2. **Complexity**: Multiple configuration points to understand
3. **False positives**: Linter rules may conflict with AI-generated code patterns

### Mitigations

1. **Performance**: Use `parallel` mode, `failFast` option, file-specific linting
2. **Complexity**: Provide sensible defaults, documentation
3. **False positives**: Allow `eslint-disable` comments, configurable rules

## Implementation Priority

1. **High**: PrettierPlugin implementation (tests exist, implementation missing)
2. **High**: Wire LinterService to HookContext in ApexOrchestrator
3. **Medium**: Integration tests for full lint-after-edit flow
4. **Low**: CustomLinterPlugin for arbitrary linter support

## Verification Checklist

- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] PrettierPlugin implementation complete
- [ ] LinterService wired to ApexOrchestrator
- [ ] Lint-after-edit hook functional with config enabled
- [ ] Auto-fix applies for fixable issues
- [ ] Documentation updated

## References

- `packages/orchestrator/src/linter/service.ts` - LinterService implementation
- `packages/orchestrator/src/linter/plugins/eslint.ts` - ESLint plugin reference
- `packages/orchestrator/src/hooks.ts:797-846` - lintAfterEdit hook
- `packages/core/src/types.ts` - LinterConfig schema
- `packages/orchestrator/src/hooks-lint-after-edit.test.ts` - Existing tests
