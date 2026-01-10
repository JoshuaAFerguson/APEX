# ADR-034: TDDExecutor Iterative Fix Loop

## Status

Proposed

## Date

2025-01-09

## Context

APEX needs a TDD (Test-Driven Development) execution loop that can:
1. Run tests
2. If tests fail, send failures to Claude for fixes
3. Apply the fix
4. Repeat until tests pass or maxIterations is reached

### Current State

The existing `TDDMode` class in `packages/orchestrator/src/tdd/tdd-mode.ts` provides:
- `runTestFirstCycle()` - runs tests for a specific file
- `autoCorrectionLoop()` - loops test execution but **does NOT call Claude for fixes**
- `checkRegression()` - runs full test suite to check for regressions

The key gap is that `autoCorrectionLoop()` only re-runs tests but lacks:
- Integration with Claude Agent SDK for fix generation
- Event emission for iteration tracking
- Integration with ApexOrchestrator

### Requirements

1. **TDDExecutor Class**: New class that orchestrates the TDD fix loop
2. **Claude SDK Integration**: Send test failures to Claude for fix generation
3. **Iterative Fix Loop**: Run tests → If fail, get fix from Claude → Apply fix → Repeat
4. **Event Emission**: Emit events for each iteration (start, fix-attempt, success, failure)
5. **Max Iterations Guard**: Stop after configurable maxIterations (from TDDModeConfig)
6. **ApexOrchestrator Integration**: Expose methods for orchestrator to invoke TDD mode

### Existing Patterns

The orchestrator package follows consistent patterns for event-emitting classes:

1. **EventEmitter3 Base**: All event-emitting classes extend `EventEmitter<TypedEvents>`
2. **Typed Events Interface**: Events defined via typed interface
3. **Query Function for Claude**: Uses `query()` from `@anthropic-ai/claude-agent-sdk`

## Decision

Create a new `TDDExecutor` class in `packages/orchestrator/src/tdd/tdd-executor.ts` that implements the iterative TDD fix loop.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ApexOrchestrator                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         TDDExecutor                                   │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌────────────────────────┐    │   │
│  │  │  TDDMode    │ → │ runTests()  │ → │ Claude SDK query()     │    │   │
│  │  │  (existing) │   │             │   │ (generate fix)         │    │   │
│  │  └─────────────┘   └─────────────┘   └────────────────────────┘    │   │
│  │       ↑                   │                   │                     │   │
│  │       │                   ↓                   ↓                     │   │
│  │       │           ┌─────────────────────────────────────────┐      │   │
│  │       └───────────│      Iteration Loop                     │      │   │
│  │                   │  1. Run tests                           │      │   │
│  │                   │  2. If pass → done                      │      │   │
│  │                   │  3. If fail → Claude generates fix      │      │   │
│  │                   │  4. Apply fix (via tools in query)      │      │   │
│  │                   │  5. Repeat until pass or maxIterations  │      │   │
│  │                   └─────────────────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          Event Emission                              │   │
│  │  • tdd:iteration-start   • tdd:fix-attempt   • tdd:iteration-end    │   │
│  │  • tdd:success           • tdd:failure        • tdd:max-iterations  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
packages/orchestrator/src/tdd/
├── tdd-mode.ts              # Existing - basic test running
├── tdd-mode.test.ts         # Existing tests
├── tdd-executor.ts          # NEW - iterative fix loop with Claude
├── tdd-executor.test.ts     # NEW - unit tests
└── index.ts                 # NEW - barrel export
```

### Type Definitions

```typescript
// ============================================================================
// Event Types
// ============================================================================

export interface TDDIterationStartEvent {
  taskId: string;
  iteration: number;
  maxIterations: number;
  testFile: string;
  timestamp: Date;
}

export interface TDDFixAttemptEvent {
  taskId: string;
  iteration: number;
  testOutput: string;
  failureCount: number;
  timestamp: Date;
}

export interface TDDIterationEndEvent {
  taskId: string;
  iteration: number;
  success: boolean;
  testOutput: string;
  duration: number; // milliseconds
  timestamp: Date;
}

export interface TDDSuccessEvent {
  taskId: string;
  iterations: number;
  totalDuration: number;
  timestamp: Date;
}

export interface TDDFailureEvent {
  taskId: string;
  iterations: number;
  reason: 'max_iterations' | 'fix_failed' | 'test_error';
  lastTestOutput: string;
  timestamp: Date;
}

// ============================================================================
// Events Interface
// ============================================================================

export interface TDDExecutorEvents {
  'tdd:iteration-start': (event: TDDIterationStartEvent) => void;
  'tdd:fix-attempt': (event: TDDFixAttemptEvent) => void;
  'tdd:iteration-end': (event: TDDIterationEndEvent) => void;
  'tdd:success': (event: TDDSuccessEvent) => void;
  'tdd:failure': (event: TDDFailureEvent) => void;
}

// ============================================================================
// Configuration
// ============================================================================

export interface TDDExecutorOptions {
  /** Project path for test execution */
  projectPath: string;
  /** TDD mode configuration (maxIterations, testCommand, etc.) */
  config: TDDModeConfig;
  /** Optional task ID for event correlation */
  taskId?: string;
  /** Environment variables for test execution */
  env?: NodeJS.ProcessEnv;
  /** Model to use for fix generation (default: 'sonnet') */
  model?: 'opus' | 'sonnet' | 'haiku';
  /** Timeout per test run in milliseconds */
  testTimeout?: number;
}

// ============================================================================
// Result Types
// ============================================================================

export interface TDDExecutionResult {
  success: boolean;
  iterations: number;
  totalDuration: number;
  outputs: Array<{
    iteration: number;
    testSuccess: boolean;
    testOutput: string;
    fixApplied: boolean;
  }>;
  finalTestOutput?: string;
  error?: string;
}
```

### Class Design

```typescript
import { EventEmitter } from 'eventemitter3';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { TDDMode, CommandResult } from './tdd-mode';
import type { TDDModeConfig } from '@apexcli/core';

export class TDDExecutor extends EventEmitter<TDDExecutorEvents> {
  private tddMode: TDDMode;
  private config: TDDModeConfig;
  private projectPath: string;
  private taskId: string;
  private model: 'opus' | 'sonnet' | 'haiku';
  private testTimeout: number;
  private env?: NodeJS.ProcessEnv;

  constructor(options: TDDExecutorOptions) {
    super();
    this.config = options.config;
    this.projectPath = options.projectPath;
    this.taskId = options.taskId ?? `tdd-${Date.now()}`;
    this.model = options.model ?? 'sonnet';
    this.testTimeout = options.testTimeout ?? 300000;
    this.env = options.env;

    // Initialize underlying TDDMode
    this.tddMode = new TDDMode(this.config, {
      projectPath: this.projectPath,
      env: this.env,
      timeoutMs: this.testTimeout,
    });
  }

  /**
   * Execute the TDD fix loop for a test file
   *
   * This method:
   * 1. Runs the specified test file
   * 2. If tests fail, sends the failure output to Claude for fix generation
   * 3. Claude applies fixes using file editing tools
   * 4. Re-runs tests
   * 5. Repeats until tests pass or maxIterations is reached
   */
  async execute(testFile: string, implFile?: string): Promise<TDDExecutionResult> {
    const maxIterations = this.config.maxIterations ?? 5;
    const outputs: TDDExecutionResult['outputs'] = [];
    const startTime = Date.now();
    let currentIteration = 0;

    while (currentIteration < maxIterations) {
      currentIteration++;

      // Emit iteration start
      this.emit('tdd:iteration-start', {
        taskId: this.taskId,
        iteration: currentIteration,
        maxIterations,
        testFile,
        timestamp: new Date(),
      });

      const iterationStart = Date.now();

      // Run tests
      const testResult = await this.tddMode.runTestFirstCycle(testFile, implFile);

      if (testResult.success) {
        // Tests passed!
        outputs.push({
          iteration: currentIteration,
          testSuccess: true,
          testOutput: this.formatTestOutput(testResult.output),
          fixApplied: false,
        });

        this.emit('tdd:iteration-end', {
          taskId: this.taskId,
          iteration: currentIteration,
          success: true,
          testOutput: this.formatTestOutput(testResult.output),
          duration: Date.now() - iterationStart,
          timestamp: new Date(),
        });

        this.emit('tdd:success', {
          taskId: this.taskId,
          iterations: currentIteration,
          totalDuration: Date.now() - startTime,
          timestamp: new Date(),
        });

        return {
          success: true,
          iterations: currentIteration,
          totalDuration: Date.now() - startTime,
          outputs,
          finalTestOutput: this.formatTestOutput(testResult.output),
        };
      }

      // Tests failed - emit fix attempt event
      const testOutput = this.formatTestOutput(testResult.output);
      this.emit('tdd:fix-attempt', {
        taskId: this.taskId,
        iteration: currentIteration,
        testOutput,
        failureCount: this.countFailures(testOutput),
        timestamp: new Date(),
      });

      // Request fix from Claude
      const fixSuccess = await this.requestFix(testFile, testOutput, implFile);

      outputs.push({
        iteration: currentIteration,
        testSuccess: false,
        testOutput,
        fixApplied: fixSuccess,
      });

      this.emit('tdd:iteration-end', {
        taskId: this.taskId,
        iteration: currentIteration,
        success: false,
        testOutput,
        duration: Date.now() - iterationStart,
        timestamp: new Date(),
      });

      if (!fixSuccess) {
        // Claude couldn't apply a fix - stop the loop
        this.emit('tdd:failure', {
          taskId: this.taskId,
          iterations: currentIteration,
          reason: 'fix_failed',
          lastTestOutput: testOutput,
          timestamp: new Date(),
        });

        return {
          success: false,
          iterations: currentIteration,
          totalDuration: Date.now() - startTime,
          outputs,
          finalTestOutput: testOutput,
          error: 'Failed to apply fix',
        };
      }
    }

    // Max iterations reached
    const lastOutput = outputs[outputs.length - 1];
    this.emit('tdd:failure', {
      taskId: this.taskId,
      iterations: currentIteration,
      reason: 'max_iterations',
      lastTestOutput: lastOutput?.testOutput ?? '',
      timestamp: new Date(),
    });

    return {
      success: false,
      iterations: currentIteration,
      totalDuration: Date.now() - startTime,
      outputs,
      finalTestOutput: lastOutput?.testOutput,
      error: `Max iterations (${maxIterations}) reached`,
    };
  }

  /**
   * Request a fix from Claude using the Agent SDK
   */
  private async requestFix(
    testFile: string,
    testOutput: string,
    implFile?: string
  ): Promise<boolean> {
    const prompt = this.buildFixPrompt(testFile, testOutput, implFile);

    try {
      // Use Claude Agent SDK to generate and apply the fix
      for await (const message of query({
        prompt,
        options: {
          model: this.model,
          permissionMode: 'acceptEdits',
          maxTurns: 10, // Limit turns for fix attempts
          cwd: this.projectPath,
          env: this.env,
        },
      })) {
        // Process messages - Claude will use file editing tools to apply fixes
        // We just need to let the query complete
      }

      return true;
    } catch (error) {
      // Fix attempt failed
      return false;
    }
  }

  /**
   * Build the prompt for Claude to fix failing tests
   */
  private buildFixPrompt(testFile: string, testOutput: string, implFile?: string): string {
    const implContext = implFile
      ? `\n\nThe implementation file that likely needs fixing is: ${implFile}`
      : '';

    return `You are fixing failing tests in a TDD workflow.

## Test File
${testFile}

## Test Output (Failures)
\`\`\`
${testOutput}
\`\`\`
${implContext}

## Instructions
1. Analyze the test failures carefully
2. Identify the root cause of each failure
3. Fix the implementation code (NOT the tests) to make the tests pass
4. Use the Edit tool to apply your fixes
5. Focus on minimal, targeted changes to fix the failures
6. Do not modify the test file unless it contains obvious bugs

Make the tests pass with the minimum necessary changes.`;
  }

  /**
   * Format test output for display
   */
  private formatTestOutput(result: CommandResult): string {
    const output = result.stdout + (result.stderr ? `\n${result.stderr}` : '');
    // Truncate if too long
    const maxLength = 10000;
    if (output.length > maxLength) {
      return output.substring(0, maxLength) + '\n... (truncated)';
    }
    return output;
  }

  /**
   * Count the number of test failures from output
   */
  private countFailures(output: string): number {
    // Common patterns for test failure counts
    const patterns = [
      /(\d+) failing/i,
      /(\d+) failed/i,
      /FAIL:\s*(\d+)/i,
      /Failures:\s*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return 1; // Default to 1 if we can't parse
  }

  /**
   * Check regression by running the full test suite
   */
  async checkRegression(): Promise<boolean> {
    const result = await this.tddMode.checkRegression();
    return result.status === 'passed';
  }
}
```

### Integration with ApexOrchestrator

The `ApexOrchestrator` class should be extended to support TDD mode integration:

```typescript
// In ApexOrchestrator class

/**
 * Execute TDD fix loop for a task
 */
async executeTDDLoop(
  taskId: string,
  testFile: string,
  implFile?: string
): Promise<TDDExecutionResult> {
  const task = await this.store.getTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Get TDD config from effective config
  const tddConfig = this.effectiveConfig.tdd;
  if (!tddConfig?.enabled) {
    throw new Error('TDD mode is not enabled');
  }

  // Create TDDExecutor
  const executor = new TDDExecutor({
    projectPath: this.projectPath,
    config: tddConfig,
    taskId,
    env: process.env,
    model: this.effectiveConfig.models?.default ?? 'sonnet',
  });

  // Forward TDD events to orchestrator events
  executor.on('tdd:iteration-start', (event) => {
    this.emit('tdd:iteration-start', event);
  });
  executor.on('tdd:fix-attempt', (event) => {
    this.emit('tdd:fix-attempt', event);
  });
  executor.on('tdd:iteration-end', (event) => {
    this.emit('tdd:iteration-end', event);
  });
  executor.on('tdd:success', (event) => {
    this.emit('tdd:success', event);
  });
  executor.on('tdd:failure', (event) => {
    this.emit('tdd:failure', event);
  });

  // Execute the TDD loop
  return executor.execute(testFile, implFile);
}
```

### OrchestratorEvents Extension

Add TDD events to `OrchestratorEvents` interface:

```typescript
// Add to OrchestratorEvents interface
export interface OrchestratorEvents {
  // ... existing events ...

  // TDD execution events
  'tdd:iteration-start': (event: TDDIterationStartEvent) => void;
  'tdd:fix-attempt': (event: TDDFixAttemptEvent) => void;
  'tdd:iteration-end': (event: TDDIterationEndEvent) => void;
  'tdd:success': (event: TDDSuccessEvent) => void;
  'tdd:failure': (event: TDDFailureEvent) => void;
}
```

## Testing Strategy

### Unit Tests (tdd-executor.test.ts)

1. **Constructor Tests**
   - Creates TDDExecutor with valid options
   - Uses default values when optional params not provided
   - Initializes underlying TDDMode correctly

2. **Execute Loop Tests**
   - Returns success when tests pass on first iteration
   - Iterates and applies fixes when tests fail
   - Stops when tests pass after fix
   - Stops at maxIterations when tests never pass
   - Handles fix application failure gracefully

3. **Event Emission Tests**
   - Emits `tdd:iteration-start` at start of each iteration
   - Emits `tdd:fix-attempt` when requesting fix from Claude
   - Emits `tdd:iteration-end` at end of each iteration
   - Emits `tdd:success` when tests pass
   - Emits `tdd:failure` when max iterations reached

4. **Prompt Building Tests**
   - Builds correct prompt with test file and output
   - Includes implementation file context when provided

5. **Test Output Parsing Tests**
   - Correctly counts failures from various test output formats
   - Handles truncation of long outputs

### Integration Tests

1. **With ApexOrchestrator**
   - Orchestrator forwards TDD events correctly
   - Works with effective config TDD settings

2. **With TDDMode**
   - Correctly uses TDDMode for test execution
   - Respects TDDModeConfig settings

## Consequences

### Positive

- **Clean Separation**: TDDExecutor handles iteration logic while TDDMode handles test execution
- **Event-Driven**: Full observability via events for CLI/API consumers
- **Configurable**: Uses existing TDDModeConfig for settings
- **Extensible**: Can add more sophisticated fix strategies later
- **Testable**: Mock-friendly design with injected dependencies

### Negative

- **Token Usage**: Each fix attempt consumes Claude API tokens
- **Time Cost**: Multiple iterations can be slow for complex test suites
- **Fix Quality**: Claude may not always generate correct fixes

### Risks

- **Infinite Loops**: Mitigated by maxIterations guard
- **Flaky Tests**: May cause unnecessary fix attempts (future: add flaky test detection)
- **Large Files**: Long test output may hit context limits (mitigated by truncation)

## Implementation Order

1. Create `packages/orchestrator/src/tdd/tdd-executor.ts` with TDDExecutor class
2. Create `packages/orchestrator/src/tdd/tdd-executor.test.ts` with unit tests
3. Create `packages/orchestrator/src/tdd/index.ts` barrel export
4. Add TDD events to OrchestratorEvents interface in `index.ts`
5. Add `executeTDDLoop` method to ApexOrchestrator class
6. Export new types from orchestrator package

## References

- `packages/orchestrator/src/tdd/tdd-mode.ts` - Existing TDD mode implementation
- `packages/orchestrator/src/error-feedback.ts` - Similar EventEmitter pattern
- `packages/core/src/types.ts` - TDDModeConfig definition
- `packages/orchestrator/src/index.ts` - Claude SDK query() usage
