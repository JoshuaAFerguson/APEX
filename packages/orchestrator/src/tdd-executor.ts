/**
 * TDDExecutor - Implements TDD execution loop with iterative test-fix cycles
 *
 * This module provides:
 * - TDDExecutor: Main class implementing the TDD loop
 * - TDDIterationResult: Result of each TDD iteration
 * - TDD event types: Events emitted during TDD execution
 *
 * The TDD execution follows this loop:
 * 1. Run tests
 * 2. If tests fail, send failures to Claude for fix
 * 3. Apply fix
 * 4. Repeat until tests pass or maxIterations reached
 *
 * @module tdd-executor
 */

import { EventEmitter } from 'eventemitter3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  TaskStatus,
  generateTaskId,
  ApexEvent,
  ApexEventType,
} from '@apexcli/core';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration options for TDD execution
 */
export interface TDDExecutorConfig {
  /** Maximum number of fix iterations before giving up */
  maxIterations: number;
  /** Test command to execute (e.g., 'npm test', 'vitest run') */
  testCommand: string;
  /** Working directory for test execution */
  workingDirectory?: string;
  /** Timeout for each test run in milliseconds */
  testTimeout?: number;
  /** Whether to emit detailed events */
  enableEvents?: boolean;
  /** Whether to enable regression guard (default: true) */
  regressionGuard?: boolean;
}

/**
 * Result of a test execution
 */
export interface TestResult {
  /** Whether tests passed */
  success: boolean;
  /** Exit code of test command */
  exitCode: number;
  /** Standard output from test command */
  stdout: string;
  /** Standard error from test command */
  stderr: string;
  /** Duration of test execution in milliseconds */
  duration: number;
  /** Parsed test failures (if any) */
  failures: TestFailure[];
}

/**
 * Represents a single test failure
 */
export interface TestFailure {
  /** Test file path */
  file: string;
  /** Test name or description */
  test: string;
  /** Error message */
  message: string;
  /** Stack trace (if available) */
  stack?: string;
  /** Expected value (for assertion failures) */
  expected?: string;
  /** Actual value (for assertion failures) */
  actual?: string;
}

/**
 * Fix suggested by Claude
 */
export interface SuggestedFix {
  /** Description of the fix */
  description: string;
  /** File to modify */
  file: string;
  /** Original content to replace */
  originalContent: string;
  /** New content to apply */
  newContent: string;
  /** Confidence level of the fix (0-1) */
  confidence: number;
  /** Reasoning for the fix */
  reasoning?: string;
}

/**
 * Result of applying a fix
 */
export interface FixResult {
  /** Whether the fix was applied successfully */
  success: boolean;
  /** Error message if fix failed */
  error?: string;
  /** Files that were modified */
  modifiedFiles: string[];
  /** Backup data for reverting changes */
  backup?: FixBackup;
}

/**
 * Backup data for reverting fixes
 */
export interface FixBackup {
  /** Modified files with their original content */
  files: Record<string, string>;
  /** Timestamp when backup was created */
  timestamp: Date;
}

/**
 * Result of regression detection
 */
export interface RegressionResult {
  /** Whether regression was detected */
  detected: boolean;
  /** Test result that detected the regression */
  testResult?: TestResult;
  /** Error message if regression check failed */
  error?: string;
  /** Whether the regression check was skipped */
  skipped?: boolean;
}

/**
 * Result of a single TDD iteration
 */
export interface TDDIterationResult {
  /** Iteration number (1-based) */
  iteration: number;
  /** Test result for this iteration */
  testResult: TestResult;
  /** Fix suggested by Claude (if tests failed) */
  suggestedFix?: SuggestedFix;
  /** Result of applying the fix (if attempted) */
  fixResult?: FixResult;
  /** Result of regression detection (if enabled) */
  regressionResult?: RegressionResult;
  /** Whether the fix was reverted due to regression */
  fixReverted?: boolean;
  /** Whether this iteration resolved all test failures */
  resolved: boolean;
  /** Duration of the entire iteration in milliseconds */
  duration: number;
  /** Timestamp when iteration started */
  startTime: Date;
  /** Timestamp when iteration ended */
  endTime: Date;
}

/**
 * Final result of TDD execution
 */
export interface TDDExecutionResult {
  /** Whether tests are now passing */
  success: boolean;
  /** Total number of iterations performed */
  totalIterations: number;
  /** Results from each iteration */
  iterations: TDDIterationResult[];
  /** Total duration of TDD execution in milliseconds */
  totalDuration: number;
  /** Final test result */
  finalTestResult: TestResult;
  /** Reason for stopping (if unsuccessful) */
  stopReason?: 'max_iterations' | 'fix_failed' | 'test_error' | 'no_failures';
}

/**
 * TDD event types
 */
export interface TDDEvents {
  'tdd:started': (config: TDDExecutorConfig, taskId: string) => void;
  'tdd:iteration-started': (iteration: number, taskId: string) => void;
  'tdd:test-run': (testResult: TestResult, iteration: number, taskId: string) => void;
  'tdd:fix-generated': (fix: SuggestedFix, iteration: number, taskId: string) => void;
  'tdd:fix-applied': (fixResult: FixResult, iteration: number, taskId: string) => void;
  'tdd:regression-detected': (regressionResult: RegressionResult, iteration: number, taskId: string) => void;
  'tdd:fix-reverted': (fixResult: FixResult, iteration: number, taskId: string) => void;
  'tdd:iteration-completed': (result: TDDIterationResult, taskId: string) => void;
  'tdd:completed': (result: TDDExecutionResult, taskId: string) => void;
  'tdd:failed': (error: Error, iteration: number, taskId: string) => void;
}

// ============================================================================
// TDDExecutor Class
// ============================================================================

/**
 * Executes TDD loops with iterative test-fix cycles
 */
export class TDDExecutor extends EventEmitter<TDDEvents> {
  private config: TDDExecutorConfig;
  private agents: Record<string, AgentDefinition>;
  private baselineTestResult?: TestResult;

  constructor(config: TDDExecutorConfig, agents: Record<string, AgentDefinition> = {}) {
    super();
    this.config = config;
    this.agents = agents;
    // Enable regression guard by default
    if (this.config.regressionGuard === undefined) {
      this.config.regressionGuard = true;
    }
  }

  /**
   * Execute the TDD loop: run tests, fix failures, repeat until pass or max iterations
   */
  async execute(taskId?: string): Promise<TDDExecutionResult> {
    const executionTaskId = taskId || generateTaskId();
    const startTime = Date.now();

    if (this.config.enableEvents) {
      this.emit('tdd:started', this.config, executionTaskId);
    }

    const iterations: TDDIterationResult[] = [];
    let currentIteration = 1;

    try {
      // Capture baseline test result if regression guard is enabled
      if (this.config.regressionGuard) {
        this.baselineTestResult = await this.runTests();
      }

      while (currentIteration <= this.config.maxIterations) {
        if (this.config.enableEvents) {
          this.emit('tdd:iteration-started', currentIteration, executionTaskId);
        }

        const iterationResult = await this.executeIteration(currentIteration, executionTaskId);
        iterations.push(iterationResult);

        if (this.config.enableEvents) {
          this.emit('tdd:iteration-completed', iterationResult, executionTaskId);
        }

        // If tests pass, we're done
        if (iterationResult.resolved) {
          const result: TDDExecutionResult = {
            success: true,
            totalIterations: currentIteration,
            iterations,
            totalDuration: Date.now() - startTime,
            finalTestResult: iterationResult.testResult,
          };

          if (this.config.enableEvents) {
            this.emit('tdd:completed', result, executionTaskId);
          }

          return result;
        }

        // If fix failed to apply or was reverted due to regression, stop
        if (iterationResult.fixResult && !iterationResult.fixResult.success) {
          const result: TDDExecutionResult = {
            success: false,
            totalIterations: currentIteration,
            iterations,
            totalDuration: Date.now() - startTime,
            finalTestResult: iterationResult.testResult,
            stopReason: 'fix_failed',
          };

          if (this.config.enableEvents) {
            this.emit('tdd:completed', result, executionTaskId);
          }

          return result;
        }

        currentIteration++;
      }

      // Reached max iterations without success
      const finalTestResult = await this.runTests();
      const result: TDDExecutionResult = {
        success: false,
        totalIterations: this.config.maxIterations,
        iterations,
        totalDuration: Date.now() - startTime,
        finalTestResult,
        stopReason: 'max_iterations',
      };

      if (this.config.enableEvents) {
        this.emit('tdd:completed', result, executionTaskId);
      }

      return result;
    } catch (error) {
      if (this.config.enableEvents) {
        this.emit('tdd:failed', error as Error, currentIteration, executionTaskId);
      }
      throw error;
    }
  }

  /**
   * Execute a single TDD iteration
   */
  private async executeIteration(iteration: number, taskId: string): Promise<TDDIterationResult> {
    const startTime = new Date();

    // Run tests
    const testResult = await this.runTests();

    if (this.config.enableEvents) {
      this.emit('tdd:test-run', testResult, iteration, taskId);
    }

    // If tests pass, iteration is complete
    if (testResult.success) {
      return {
        iteration,
        testResult,
        resolved: true,
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
      };
    }

    // If tests fail but no failures detected, stop
    if (testResult.failures.length === 0) {
      return {
        iteration,
        testResult,
        resolved: false,
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
      };
    }

    // Generate fix using Claude
    const suggestedFix = await this.generateFix(testResult.failures);

    if (this.config.enableEvents) {
      this.emit('tdd:fix-generated', suggestedFix, iteration, taskId);
    }

    // Apply the fix
    const fixResult = await this.applyFix(suggestedFix);

    if (this.config.enableEvents) {
      this.emit('tdd:fix-applied', fixResult, iteration, taskId);
    }

    // Check for regression if fix was applied and regression guard is enabled
    let regressionResult: RegressionResult | undefined;
    let fixReverted = false;

    if (fixResult.success && this.config.regressionGuard) {
      regressionResult = await this.detectRegression();

      if (regressionResult.detected) {
        // Regression detected - revert the fix
        if (this.config.enableEvents) {
          this.emit('tdd:regression-detected', regressionResult, iteration, taskId);
        }

        const revertResult = await this.revertFix(fixResult);
        if (revertResult.success) {
          fixReverted = true;
          // Mark fix as failed since it was reverted
          fixResult.success = false;
          fixResult.error = `Fix reverted due to regression: ${regressionResult.error || 'existing tests failed'}`;

          if (this.config.enableEvents) {
            this.emit('tdd:fix-reverted', revertResult, iteration, taskId);
          }
        } else {
          // If revert failed, that's a critical error
          fixResult.success = false;
          fixResult.error = `Regression detected but revert failed: ${revertResult.error}`;
        }
      }
    }

    return {
      iteration,
      testResult,
      suggestedFix,
      fixResult,
      regressionResult,
      fixReverted,
      resolved: false, // We'll check in the next iteration
      duration: Date.now() - startTime.getTime(),
      startTime,
      endTime: new Date(),
    };
  }

  /**
   * Run tests and parse results
   */
  private async runTests(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(this.config.testCommand, {
        cwd: this.config.workingDirectory || process.cwd(),
        timeout: this.config.testTimeout || 60000,
      });

      const duration = Date.now() - startTime;
      const failures = this.parseTestFailures(stdout, stderr);

      return {
        success: true,
        exitCode: 0,
        stdout,
        stderr,
        duration,
        failures,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const failures = this.parseTestFailures(error.stdout || '', error.stderr || '');

      return {
        success: false,
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        duration,
        failures,
      };
    }
  }

  /**
   * Parse test failures from test output
   */
  private parseTestFailures(stdout: string, stderr: string): TestFailure[] {
    const failures: TestFailure[] = [];
    const output = stdout + '\n' + stderr;

    // Parse Vitest/Jest format failures
    // This is a simple parser - can be enhanced for better accuracy
    const failureRegex = /FAIL\s+(.+?)\n.*?(?:✕|×)\s+(.+?)\n.*?(\w+Error.*?)(?=\n\n|\n\s*at|\n\s*FAIL|\n\s*✓|$)/gs;
    let match;

    while ((match = failureRegex.exec(output)) !== null) {
      const [, file, test, message] = match;
      failures.push({
        file: file.trim(),
        test: test.trim(),
        message: message.trim(),
      });
    }

    // If no failures found with regex but tests failed, create generic failure
    if (failures.length === 0 && (stderr.includes('FAIL') || stdout.includes('FAIL'))) {
      failures.push({
        file: 'unknown',
        test: 'Test execution',
        message: 'Tests failed but could not parse specific failures',
      });
    }

    return failures;
  }

  /**
   * Generate fix suggestions using Claude
   */
  private async generateFix(failures: TestFailure[]): Promise<SuggestedFix> {
    // Find a developer agent to use for fixes
    const developerAgent = this.agents['developer'] || Object.values(this.agents).find(
      agent => agent.role?.toLowerCase().includes('developer') ||
               agent.role?.toLowerCase().includes('implement')
    );

    if (!developerAgent) {
      throw new Error('No developer agent available for generating fixes');
    }

    const failureDetails = failures.map(f =>
      `File: ${f.file}\nTest: ${f.test}\nError: ${f.message}${f.stack ? '\nStack: ' + f.stack : ''}`
    ).join('\n\n');

    const prompt = `You are a developer agent helping to fix failing tests in a TDD loop.

Here are the test failures that need to be fixed:

${failureDetails}

Please analyze these failures and provide a fix. The fix should:
1. Address the root cause of the test failures
2. Be minimal and focused
3. Follow good coding practices
4. Maintain compatibility with existing code

Respond with a JSON object in this format:
{
  "description": "Brief description of what the fix does",
  "file": "path/to/file/to/modify",
  "originalContent": "exact content to be replaced",
  "newContent": "new content to insert",
  "confidence": 0.8,
  "reasoning": "explanation of why this fix should work"
}

Only provide ONE fix per response, targeting the most critical failure first.`;

    try {
      const response = await query({
        agent: {
          name: developerAgent.name,
          role: developerAgent.role,
          description: developerAgent.description,
          instructions: developerAgent.instructions,
        },
        message: prompt,
        model: 'claude-3-5-sonnet-20241022',
      });

      // Parse the JSON response
      const fixData = JSON.parse(response.content);

      return {
        description: fixData.description,
        file: fixData.file,
        originalContent: fixData.originalContent,
        newContent: fixData.newContent,
        confidence: fixData.confidence || 0.5,
        reasoning: fixData.reasoning,
      };
    } catch (error) {
      throw new Error(`Failed to generate fix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply a suggested fix to the codebase
   */
  private async applyFix(fix: SuggestedFix): Promise<FixResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Read the file
      const filePath = path.resolve(this.config.workingDirectory || process.cwd(), fix.file);
      let fileContent = await fs.readFile(filePath, 'utf-8');

      // Create backup for potential reversion
      const backup: FixBackup = {
        files: { [fix.file]: fileContent },
        timestamp: new Date(),
      };

      // Apply the fix
      if (!fileContent.includes(fix.originalContent)) {
        return {
          success: false,
          error: `Original content not found in file: ${fix.file}`,
          modifiedFiles: [],
        };
      }

      const newContent = fileContent.replace(fix.originalContent, fix.newContent);
      await fs.writeFile(filePath, newContent, 'utf-8');

      return {
        success: true,
        modifiedFiles: [fix.file],
        backup,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error applying fix',
        modifiedFiles: [],
      };
    }
  }

  /**
   * Detect if a regression has occurred by comparing current test results to baseline
   */
  private async detectRegression(): Promise<RegressionResult> {
    if (!this.baselineTestResult) {
      return {
        detected: false,
        skipped: true,
        error: 'No baseline test result available',
      };
    }

    try {
      const currentTestResult = await this.runTests();

      // Regression is detected if:
      // 1. Previously passing tests now fail
      // 2. New failures have appeared that weren't in the baseline
      const regressionDetected =
        // If baseline tests passed but current tests fail
        (this.baselineTestResult.success && !currentTestResult.success) ||
        // If current tests have more failures than baseline
        (currentTestResult.failures.length > this.baselineTestResult.failures.length) ||
        // If current tests have different failures than baseline (excluding expected failures)
        this.hasNewFailures(this.baselineTestResult.failures, currentTestResult.failures);

      return {
        detected: regressionDetected,
        testResult: currentTestResult,
        error: regressionDetected ? 'Regression detected: existing tests are now failing' : undefined,
      };
    } catch (error) {
      return {
        detected: true, // Assume regression if we can't run tests
        error: `Failed to run regression check: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if current failures contain new failures not present in baseline
   */
  private hasNewFailures(baselineFailures: TestFailure[], currentFailures: TestFailure[]): boolean {
    // Create a set of baseline failure signatures for comparison
    const baselineSignatures = new Set(
      baselineFailures.map(f => `${f.file}:${f.test}:${f.message}`)
    );

    // Check if any current failures are not in baseline
    return currentFailures.some(failure => {
      const signature = `${failure.file}:${failure.test}:${failure.message}`;
      return !baselineSignatures.has(signature);
    });
  }

  /**
   * Revert a fix by restoring files from backup
   */
  private async revertFix(fixResult: FixResult): Promise<FixResult> {
    if (!fixResult.backup) {
      return {
        success: false,
        error: 'No backup available to revert fix',
        modifiedFiles: [],
      };
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const restoredFiles: string[] = [];

      for (const [file, originalContent] of Object.entries(fixResult.backup.files)) {
        const filePath = path.resolve(this.config.workingDirectory || process.cwd(), file);
        await fs.writeFile(filePath, originalContent, 'utf-8');
        restoredFiles.push(file);
      }

      return {
        success: true,
        modifiedFiles: restoredFiles,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error reverting fix',
        modifiedFiles: [],
      };
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a TDDExecutor with default configuration
 */
export function createTDDExecutor(
  testCommand: string,
  maxIterations: number = 3,
  agents: Record<string, AgentDefinition> = {},
  regressionGuard: boolean = true
): TDDExecutor {
  const config: TDDExecutorConfig = {
    maxIterations,
    testCommand,
    enableEvents: true,
    regressionGuard,
  };

  return new TDDExecutor(config, agents);
}

/**
 * Execute TDD loop with simple configuration
 */
export async function executeTDD(
  testCommand: string,
  maxIterations: number = 3,
  agents: Record<string, AgentDefinition> = {},
  regressionGuard: boolean = true
): Promise<TDDExecutionResult> {
  const executor = createTDDExecutor(testCommand, maxIterations, agents, regressionGuard);
  return await executor.execute();
}