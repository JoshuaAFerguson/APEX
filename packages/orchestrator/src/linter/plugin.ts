/**
 * Linter Plugin Interface and Base Class
 *
 * This module defines the common interface for all linter plugins and provides
 * a base abstract class with shared functionality for process spawning and
 * output buffering.
 *
 * Architecture Decision:
 * - ILinterPlugin defines the contract for all linter implementations
 * - BaseLinterPlugin provides common infrastructure for executing external linter processes
 * - Each concrete plugin (ESLint, TypeScript, Prettier, etc.) extends BaseLinterPlugin
 *
 * @module orchestrator/linter/plugin
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Severity levels for linting issues
 */
export type LintSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * A single linting issue found in a file
 */
export interface LintIssue {
  /** File path where the issue was found */
  filePath: string;

  /** Line number (1-based) */
  line: number;

  /** Column number (1-based) */
  column: number;

  /** End line number (1-based, optional) */
  endLine?: number;

  /** End column number (1-based, optional) */
  endColumn?: number;

  /** Severity of the issue */
  severity: LintSeverity;

  /** Rule ID or code that was violated */
  ruleId: string;

  /** Human-readable message describing the issue */
  message: string;

  /** Suggested fix if available */
  fix?: LintFix;

  /** Additional context or suggestions */
  suggestions?: LintSuggestion[];
}

/**
 * An automatic fix that can be applied to resolve an issue
 */
export interface LintFix {
  /** Description of what the fix does */
  description?: string;

  /** Text replacements to apply */
  replacements: LintReplacement[];
}

/**
 * A single text replacement for a fix
 */
export interface LintReplacement {
  /** Start offset in the file (0-based) */
  startOffset: number;

  /** End offset in the file (0-based) */
  endOffset: number;

  /** Text to insert at the location */
  text: string;
}

/**
 * A suggestion for fixing an issue (may require user confirmation)
 */
export interface LintSuggestion {
  /** Description of the suggestion */
  description: string;

  /** The fix to apply if the suggestion is accepted */
  fix: LintFix;
}

/**
 * Result of running a linter on one or more files
 */
export interface LintResult {
  /** Whether the linting completed successfully (regardless of issues found) */
  success: boolean;

  /** All issues found across all files */
  issues: LintIssue[];

  /** Number of files that were checked */
  filesChecked: number;

  /** Number of files with issues */
  filesWithIssues: number;

  /** Duration of the linting process in milliseconds */
  duration: number;

  /** Any error that occurred during linting */
  error?: string;

  /** Raw output from the linter (for debugging) */
  rawOutput?: string;
}

/**
 * Result of applying fixes
 */
export interface FixResult {
  /** Whether fixes were applied successfully */
  success: boolean;

  /** Number of files that were modified */
  filesFixed: number;

  /** Number of issues that were fixed */
  issuesFixed: number;

  /** Any issues that could not be fixed */
  unfixedIssues: LintIssue[];

  /** Any error that occurred during fixing */
  error?: string;
}

/**
 * Options for linter execution
 */
export interface LinterExecuteOptions {
  /** Working directory for the linter */
  cwd?: string;

  /** File patterns to lint */
  patterns?: string[];

  /** Specific files to lint */
  files?: string[];

  /** Whether to attempt automatic fixes */
  fix?: boolean;

  /** Additional linter-specific options */
  extraArgs?: string[];

  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Environment variables to pass to the linter process */
  env?: Record<string, string>;

  /** Configuration file path override */
  configPath?: string;

  /** Whether to ignore default ignores/excludes */
  noIgnore?: boolean;
}

/**
 * Metadata about a linter plugin
 */
export interface LinterPluginMetadata {
  /** Unique identifier for the linter (e.g., 'eslint', 'typescript', 'prettier') */
  id: string;

  /** Display name for the linter */
  name: string;

  /** Description of what the linter checks */
  description: string;

  /** File extensions this linter supports */
  supportedExtensions: string[];

  /** Whether this linter supports automatic fixes */
  supportsAutoFix: boolean;

  /** Version of the plugin (not the underlying tool) */
  pluginVersion: string;
}

/**
 * Interface for linter plugins
 *
 * Each linter plugin must implement this interface to integrate with the
 * APEX linting system. Plugins are responsible for:
 * 1. Executing the underlying linter tool
 * 2. Parsing the output into a standardized format
 * 3. Applying fixes when supported
 */
export interface ILinterPlugin extends EventEmitter<LinterPluginEvents> {
  /** Metadata about this linter plugin */
  readonly metadata: LinterPluginMetadata;

  /**
   * Execute the linter on the specified files or patterns
   *
   * @param options - Execution options including files to lint
   * @returns Promise resolving to the linting result
   */
  execute(options: LinterExecuteOptions): Promise<LintResult>;

  /**
   * Parse raw linter output into standardized LintIssue format
   *
   * @param output - Raw output from the linter process
   * @returns Array of parsed lint issues
   */
  parse(output: string): LintIssue[];

  /**
   * Apply automatic fixes to resolve linting issues
   *
   * @param issues - Issues to attempt to fix
   * @param options - Options for fix application
   * @returns Promise resolving to the fix result
   */
  fix(
    issues: LintIssue[],
    options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>
  ): Promise<FixResult>;

  /**
   * Check if the linter tool is available on the system
   *
   * @returns Promise resolving to true if the tool is installed and accessible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the version of the underlying linter tool
   *
   * @returns Promise resolving to the version string, or null if unavailable
   */
  getToolVersion(): Promise<string | null>;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Events emitted by linter plugins during execution
 */
export interface LinterPluginEvents {
  /** Emitted when linting starts */
  'lint:started': (event: LintStartedEvent) => void;

  /** Emitted periodically with progress updates */
  'lint:progress': (event: LintProgressEvent) => void;

  /** Emitted when linting completes */
  'lint:completed': (event: LintCompletedEvent) => void;

  /** Emitted when an issue is found (real-time) */
  'lint:issue': (event: LintIssueEvent) => void;

  /** Emitted when a fix is applied */
  'fix:applied': (event: FixAppliedEvent) => void;
}

export interface LintStartedEvent {
  linterId: string;
  files: string[];
  timestamp: Date;
}

export interface LintProgressEvent {
  linterId: string;
  filesProcessed: number;
  totalFiles: number;
  currentFile?: string;
}

export interface LintCompletedEvent {
  linterId: string;
  result: LintResult;
  timestamp: Date;
}

export interface LintIssueEvent {
  linterId: string;
  issue: LintIssue;
}

export interface FixAppliedEvent {
  linterId: string;
  filePath: string;
  issuesFixed: number;
}

// ============================================================================
// Process Execution Types
// ============================================================================

/**
 * Result of spawning a child process
 */
export interface ProcessResult {
  /** Exit code of the process */
  exitCode: number;

  /** Captured stdout */
  stdout: string;

  /** Captured stderr */
  stderr: string;

  /** Whether the process was killed due to timeout */
  timedOut: boolean;

  /** The signal that killed the process, if any */
  signal?: NodeJS.Signals;
}

/**
 * Options for process spawning
 */
export interface SpawnProcessOptions {
  /** Working directory */
  cwd?: string;

  /** Environment variables (merged with process.env) */
  env?: Record<string, string>;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Maximum buffer size for stdout/stderr (default: 10MB) */
  maxBuffer?: number;
}

// ============================================================================
// Base Linter Plugin Class
// ============================================================================

/**
 * Default timeout for linter execution (60 seconds)
 */
const DEFAULT_TIMEOUT = 60000;

/**
 * Default maximum buffer size for output (10MB)
 */
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Base class for linter plugins with common functionality
 *
 * Provides:
 * - Process spawning with timeout and output buffering
 * - Event emission for progress tracking
 * - Common utility methods for subclasses
 *
 * Subclasses must implement:
 * - metadata getter
 * - execute() method
 * - parse() method
 * - fix() method
 * - isAvailable() method
 * - getToolVersion() method
 *
 * @example
 * ```typescript
 * class ESLintPlugin extends BaseLinterPlugin {
 *   get metadata(): LinterPluginMetadata {
 *     return {
 *       id: 'eslint',
 *       name: 'ESLint',
 *       description: 'JavaScript/TypeScript linter',
 *       supportedExtensions: ['.js', '.jsx', '.ts', '.tsx'],
 *       supportsAutoFix: true,
 *       pluginVersion: '1.0.0',
 *     };
 *   }
 *
 *   async execute(options: LinterExecuteOptions): Promise<LintResult> {
 *     const result = await this.spawnProcess('eslint', ['--format', 'json', ...files], options);
 *     const issues = this.parse(result.stdout);
 *     return { success: result.exitCode === 0, issues, ... };
 *   }
 *   // ... other implementations
 * }
 * ```
 */
export abstract class BaseLinterPlugin
  extends EventEmitter<LinterPluginEvents>
  implements ILinterPlugin
{
  /**
   * Output buffer for accumulating stdout
   */
  protected stdoutBuffer: string = '';

  /**
   * Output buffer for accumulating stderr
   */
  protected stderrBuffer: string = '';

  /**
   * Currently running child process, if any
   */
  protected currentProcess: ChildProcess | null = null;

  /**
   * Get metadata about this linter plugin
   */
  abstract get metadata(): LinterPluginMetadata;

  /**
   * Execute the linter on the specified files or patterns
   */
  abstract execute(options: LinterExecuteOptions): Promise<LintResult>;

  /**
   * Parse raw linter output into standardized LintIssue format
   */
  abstract parse(output: string): LintIssue[];

  /**
   * Apply automatic fixes to resolve linting issues
   */
  abstract fix(
    issues: LintIssue[],
    options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>
  ): Promise<FixResult>;

  /**
   * Check if the linter tool is available on the system
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Get the version of the underlying linter tool
   */
  abstract getToolVersion(): Promise<string | null>;

  // ==========================================================================
  // Process Management
  // ==========================================================================

  /**
   * Spawn a child process and capture its output
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Spawn options
   * @returns Promise resolving to process result
   */
  protected async spawnProcess(
    command: string,
    args: string[],
    options: SpawnProcessOptions = {}
  ): Promise<ProcessResult> {
    const {
      cwd = process.cwd(),
      env = {},
      timeout = DEFAULT_TIMEOUT,
      maxBuffer = DEFAULT_MAX_BUFFER,
    } = options;

    return new Promise<ProcessResult>((resolve, reject) => {
      // Reset buffers
      this.stdoutBuffer = '';
      this.stderrBuffer = '';

      const spawnOptions: SpawnOptions = {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32', // Use shell on Windows for better compatibility
      };

      let timedOut = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        this.currentProcess = spawn(command, args, spawnOptions);
      } catch (error) {
        reject(
          new Error(
            `Failed to spawn process '${command}': ${error instanceof Error ? error.message : String(error)}`
          )
        );
        return;
      }

      const child = this.currentProcess;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          // Give it a moment to terminate gracefully, then force kill
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 1000);
        }, timeout);
      }

      // Capture stdout with buffer limit
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (this.stdoutBuffer.length + chunk.length <= maxBuffer) {
          this.stdoutBuffer += chunk;
        }
      });

      // Capture stderr with buffer limit
      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (this.stderrBuffer.length + chunk.length <= maxBuffer) {
          this.stderrBuffer += chunk;
        }
      });

      // Handle process completion
      child.on('close', (exitCode, signal) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.currentProcess = null;

        resolve({
          exitCode: exitCode ?? (timedOut ? 124 : 1), // 124 is common timeout exit code
          stdout: this.stdoutBuffer,
          stderr: this.stderrBuffer,
          timedOut,
          signal: signal ?? undefined,
        });
      });

      // Handle spawn errors
      child.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.currentProcess = null;
        reject(error);
      });
    });
  }

  /**
   * Kill the currently running process if any
   *
   * @param signal - Signal to send (default: SIGTERM)
   */
  protected killProcess(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill(signal);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a command exists in PATH
   *
   * @param command - Command to check
   * @returns Promise resolving to true if command exists
   */
  protected async commandExists(command: string): Promise<boolean> {
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';

    try {
      const result = await this.spawnProcess(checkCommand, [command], {
        timeout: 5000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Parse a severity string into LintSeverity enum
   *
   * @param severity - Severity string from linter output
   * @returns Normalized LintSeverity value
   */
  protected parseSeverity(severity: string | number): LintSeverity {
    const normalized =
      typeof severity === 'string' ? severity.toLowerCase() : severity;

    switch (normalized) {
      case 'error':
      case 2:
        return 'error';
      case 'warning':
      case 'warn':
      case 1:
        return 'warning';
      case 'info':
      case 'information':
        return 'info';
      case 'hint':
      case 'suggestion':
      case 0:
        return 'hint';
      default:
        return 'warning';
    }
  }

  /**
   * Create a standardized LintIssue
   *
   * @param params - Issue parameters
   * @returns Formatted LintIssue
   */
  protected createIssue(params: {
    filePath: string;
    line: number;
    column: number;
    severity: LintSeverity;
    ruleId: string;
    message: string;
    endLine?: number;
    endColumn?: number;
    fix?: LintFix;
    suggestions?: LintSuggestion[];
  }): LintIssue {
    return {
      filePath: params.filePath,
      line: Math.max(1, params.line),
      column: Math.max(1, params.column),
      severity: params.severity,
      ruleId: params.ruleId,
      message: params.message,
      ...(params.endLine !== undefined && { endLine: params.endLine }),
      ...(params.endColumn !== undefined && { endColumn: params.endColumn }),
      ...(params.fix && { fix: params.fix }),
      ...(params.suggestions?.length && { suggestions: params.suggestions }),
    };
  }

  /**
   * Create a successful LintResult
   *
   * @param issues - Issues found
   * @param filesChecked - Number of files checked
   * @param duration - Duration in milliseconds
   * @param rawOutput - Optional raw output
   * @returns Formatted LintResult
   */
  protected createLintResult(
    issues: LintIssue[],
    filesChecked: number,
    duration: number,
    rawOutput?: string
  ): LintResult {
    const filesWithIssues = new Set(issues.map((i) => i.filePath)).size;

    return {
      success: true,
      issues,
      filesChecked,
      filesWithIssues,
      duration,
      ...(rawOutput && { rawOutput }),
    };
  }

  /**
   * Create a failed LintResult
   *
   * @param error - Error message
   * @param duration - Duration in milliseconds
   * @param rawOutput - Optional raw output
   * @returns Formatted LintResult
   */
  protected createErrorResult(
    error: string,
    duration: number,
    rawOutput?: string
  ): LintResult {
    return {
      success: false,
      issues: [],
      filesChecked: 0,
      filesWithIssues: 0,
      duration,
      error,
      ...(rawOutput && { rawOutput }),
    };
  }
}
