/**
 * ESLint Plugin for APEX Linter System
 *
 * This module provides ESLint integration for the APEX linting system.
 * It executes ESLint with JSON output, parses the results into standardized
 * LintIssue format, and supports automatic fixes for fixable issues.
 *
 * @module orchestrator/linter/plugins/eslint
 */

import { join, resolve } from 'path';
import {
  BaseLinterPlugin,
  LinterPluginMetadata,
  LinterExecuteOptions,
  LintResult,
  LintIssue,
  FixResult,
  LintSeverity,
} from '../plugin';

// ============================================================================
// ESLint Types (for parsing JSON output)
// ============================================================================

/**
 * ESLint JSON output format for a single file
 */
interface ESLintFileResult {
  /** Path to the file */
  filePath: string;

  /** Array of messages/issues found in the file */
  messages: ESLintMessage[];

  /** Whether any errors were suppressed */
  suppressedMessages?: ESLintMessage[];

  /** Number of errors in this file */
  errorCount: number;

  /** Number of warnings in this file */
  warningCount: number;

  /** Number of fixable error count */
  fixableErrorCount: number;

  /** Number of fixable warning count */
  fixableWarningCount: number;

  /** The source code of the file (when output is specified) */
  source?: string;

  /** The fixed source code (when fix is applied) */
  output?: string;
}

/**
 * ESLint message/issue format
 */
interface ESLintMessage {
  /** Rule ID that was violated */
  ruleId: string | null;

  /** Severity level (1 = warning, 2 = error) */
  severity: 1 | 2;

  /** Human-readable message */
  message: string;

  /** Line number (1-based) */
  line: number;

  /** Column number (1-based) */
  column: number;

  /** End line number (1-based) */
  endLine?: number;

  /** End column number (1-based) */
  endColumn?: number;

  /** Node type that caused the issue */
  nodeType?: string;

  /** Message ID for the rule */
  messageId?: string;

  /** Fix information if the issue is fixable */
  fix?: ESLintFix;

  /** Suggestions for fixing the issue */
  suggestions?: ESLintSuggestion[];
}

/**
 * ESLint fix information
 */
interface ESLintFix {
  /** Range to replace [start, end] */
  range: [number, number];

  /** Text to insert */
  text: string;
}

/**
 * ESLint suggestion information
 */
interface ESLintSuggestion {
  /** Description of the suggestion */
  desc: string;

  /** Fix to apply */
  fix: ESLintFix;

  /** Message ID for the suggestion */
  messageId?: string;
}

// ============================================================================
// ESLint Plugin Implementation
// ============================================================================

/**
 * ESLint plugin for APEX linting system
 *
 * Integrates ESLint into the APEX linter infrastructure by:
 * 1. Executing ESLint with JSON format output
 * 2. Parsing ESLint JSON results into standardized LintIssue format
 * 3. Supporting automatic fixes for auto-fixable issues
 * 4. Detecting ESLint availability and version
 *
 * @example
 * ```typescript
 * const eslintPlugin = new ESLintPlugin();
 *
 * // Check if ESLint is available
 * const available = await eslintPlugin.isAvailable();
 * if (!available) {
 *   console.log('ESLint not found');
 *   return;
 * }
 *
 * // Run ESLint on files
 * const result = await eslintPlugin.execute({
 *   files: ['src/example.js', 'src/example.ts'],
 *   fix: false
 * });
 *
 * console.log(`Found ${result.issues.length} issues`);
 * ```
 */
export class ESLintPlugin extends BaseLinterPlugin {
  /**
   * Plugin metadata
   */
  get metadata(): LinterPluginMetadata {
    return {
      id: 'eslint',
      name: 'ESLint',
      description: 'JavaScript and TypeScript linter for identifying and fixing code quality issues',
      supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0',
    };
  }

  // ==========================================================================
  // Core Plugin Interface Implementation
  // ==========================================================================

  /**
   * Execute ESLint on the specified files or patterns
   *
   * @param options - Execution options including files to lint
   * @returns Promise resolving to the linting result
   */
  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const startTime = Date.now();

    try {
      // Emit start event
      this.emit('lint:started', {
        linterId: this.metadata.id,
        files: options.files || options.patterns || [],
        timestamp: new Date(),
      });

      // Build ESLint command arguments
      const args = this.buildESLintArgs(options);

      // Execute ESLint
      const result = await this.spawnProcess('eslint', args, {
        cwd: options.cwd,
        timeout: options.timeout,
        env: options.env,
      });

      const duration = Date.now() - startTime;

      // Parse issues from JSON output
      const issues = this.parse(result.stdout);

      // Count files checked (approximate based on issues + successful files)
      const filesChecked = this.estimateFilesChecked(options, issues);

      // Create result
      const lintResult = this.createLintResult(issues, filesChecked, duration, result.stdout);

      // Emit completion event
      this.emit('lint:completed', {
        linterId: this.metadata.id,
        result: lintResult,
        timestamp: new Date(),
      });

      return lintResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return this.createErrorResult(
        `ESLint execution failed: ${errorMessage}`,
        duration
      );
    }
  }

  /**
   * Parse raw ESLint JSON output into standardized LintIssue format
   *
   * @param output - Raw JSON output from ESLint
   * @returns Array of parsed lint issues
   */
  parse(output: string): LintIssue[] {
    if (!output.trim()) {
      return [];
    }

    try {
      const eslintResults: ESLintFileResult[] = JSON.parse(output);
      const issues: LintIssue[] = [];

      for (const fileResult of eslintResults) {
        for (const message of fileResult.messages) {
          const issue = this.convertESLintMessageToLintIssue(fileResult.filePath, message);
          issues.push(issue);

          // Emit individual issue event
          this.emit('lint:issue', {
            linterId: this.metadata.id,
            issue,
          });
        }
      }

      return issues;
    } catch (error) {
      throw new Error(
        `Failed to parse ESLint JSON output: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Apply automatic fixes to resolve linting issues
   *
   * @param issues - Issues to attempt to fix (currently unused, ESLint handles all fixes in one pass)
   * @param options - Options for fix application
   * @returns Promise resolving to the fix result
   */
  async fix(
    issues: LintIssue[],
    options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>
  ): Promise<FixResult> {
    try {
      // Get unique file paths from issues
      const filePaths = [...new Set(issues.map(issue => issue.filePath))];

      if (filePaths.length === 0) {
        return {
          success: true,
          filesFixed: 0,
          issuesFixed: 0,
          unfixedIssues: [],
        };
      }

      // Run ESLint with --fix flag
      const args = ['--fix', '--format', 'json', ...filePaths];

      const result = await this.spawnProcess('eslint', args, {
        cwd: options?.cwd,
        timeout: options?.timeout,
      });

      // Parse the output to see remaining issues
      const remainingIssues = this.parse(result.stdout);

      // Calculate fixes applied
      const originalIssueCount = issues.length;
      const unfixedIssues = remainingIssues.filter(remaining =>
        issues.some(original =>
          original.filePath === remaining.filePath &&
          original.line === remaining.line &&
          original.column === remaining.column &&
          original.ruleId === remaining.ruleId
        )
      );

      const issuesFixed = originalIssueCount - unfixedIssues.length;
      const filesFixed = filePaths.filter(filePath =>
        !unfixedIssues.some(issue => issue.filePath === filePath)
      ).length;

      // Emit fix events
      for (const filePath of filePaths) {
        const fileIssuesFixed = issues.filter(i => i.filePath === filePath).length -
                               unfixedIssues.filter(i => i.filePath === filePath).length;

        if (fileIssuesFixed > 0) {
          this.emit('fix:applied', {
            linterId: this.metadata.id,
            filePath,
            issuesFixed: fileIssuesFixed,
          });
        }
      }

      return {
        success: true,
        filesFixed,
        issuesFixed,
        unfixedIssues,
      };

    } catch (error) {
      return {
        success: false,
        filesFixed: 0,
        issuesFixed: 0,
        unfixedIssues: issues,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if ESLint is available on the system
   *
   * @returns Promise resolving to true if ESLint is installed and accessible
   */
  async isAvailable(): Promise<boolean> {
    return this.commandExists('eslint');
  }

  /**
   * Get the version of ESLint
   *
   * @returns Promise resolving to the ESLint version string, or null if unavailable
   */
  async getToolVersion(): Promise<string | null> {
    try {
      const result = await this.spawnProcess('eslint', ['--version'], {
        timeout: 5000,
      });

      if (result.exitCode === 0) {
        // ESLint --version outputs something like "v8.45.0"
        return result.stdout.trim();
      }

      return null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Build command-line arguments for ESLint execution
   *
   * @param options - Execution options
   * @returns Array of ESLint CLI arguments
   */
  private buildESLintArgs(options: LinterExecuteOptions): string[] {
    const args: string[] = [];

    // Always use JSON format for parsing
    args.push('--format', 'json');

    // Add fix flag if requested
    if (options.fix) {
      args.push('--fix');
    }

    // Add config path if specified
    if (options.configPath) {
      args.push('--config', options.configPath);
    }

    // Add no-ignore flag if requested
    if (options.noIgnore) {
      args.push('--no-ignore');
    }

    // Add extra arguments
    if (options.extraArgs?.length) {
      args.push(...options.extraArgs);
    }

    // Add file patterns or files
    if (options.patterns?.length) {
      args.push(...options.patterns);
    } else if (options.files?.length) {
      args.push(...options.files);
    } else {
      // Default to current directory
      args.push('.');
    }

    return args;
  }

  /**
   * Convert an ESLint message to a standardized LintIssue
   *
   * @param filePath - Path to the file
   * @param message - ESLint message
   * @returns Converted LintIssue
   */
  private convertESLintMessageToLintIssue(filePath: string, message: ESLintMessage): LintIssue {
    const severity: LintSeverity = this.parseSeverity(message.severity);

    return this.createIssue({
      filePath,
      line: message.line,
      column: message.column,
      endLine: message.endLine,
      endColumn: message.endColumn,
      severity,
      ruleId: message.ruleId || 'unknown',
      message: message.message,
      fix: message.fix ? this.convertESLintFix(message.fix) : undefined,
      suggestions: message.suggestions?.map(suggestion => ({
        description: suggestion.desc,
        fix: this.convertESLintFix(suggestion.fix),
      })),
    });
  }

  /**
   * Convert an ESLint fix to a standardized LintFix
   *
   * @param eslintFix - ESLint fix object
   * @returns Converted LintFix
   */
  private convertESLintFix(eslintFix: ESLintFix) {
    return {
      description: 'Auto-fix suggestion from ESLint',
      replacements: [{
        startOffset: eslintFix.range[0],
        endOffset: eslintFix.range[1],
        text: eslintFix.text,
      }],
    };
  }

  /**
   * Estimate the number of files checked based on options and issues found
   *
   * @param options - Execution options
   * @param issues - Issues found
   * @returns Estimated number of files checked
   */
  private estimateFilesChecked(options: LinterExecuteOptions, issues: LintIssue[]): number {
    // If specific files were provided, count them
    if (options.files?.length) {
      return options.files.length;
    }

    // Otherwise, count unique files from issues (minimum estimate)
    const filesWithIssues = new Set(issues.map(issue => issue.filePath)).size;

    // ESLint likely checked more files than just those with issues
    // This is a rough estimate - in practice you'd want to parse
    // additional ESLint output or use a different approach
    return Math.max(filesWithIssues, 1);
  }
}

// Export as default for convenient importing
export default ESLintPlugin;