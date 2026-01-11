/**
 * Prettier Plugin for APEX Linter System
 *
 * This module provides Prettier integration for the APEX linting system.
 * It executes Prettier with --check flag to detect formatting issues and
 * --write flag to auto-fix formatting issues.
 *
 * @module orchestrator/linter/plugins/prettier
 */

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
// Prettier Plugin Implementation
// ============================================================================

/**
 * Prettier plugin for APEX linting system
 *
 * Integrates Prettier into the APEX linter infrastructure by:
 * 1. Executing Prettier with --check flag to detect formatting issues
 * 2. Converting Prettier output into standardized LintIssue format
 * 3. Supporting automatic fixes via --write flag
 * 4. Detecting Prettier availability and version
 *
 * @example
 * ```typescript
 * const prettierPlugin = new PrettierPlugin();
 *
 * // Check if Prettier is available
 * const available = await prettierPlugin.isAvailable();
 * if (!available) {
 *   console.log('Prettier not found');
 *   return;
 * }
 *
 * // Run Prettier on files
 * const result = await prettierPlugin.execute({
 *   files: ['src/example.js', 'src/example.ts'],
 *   fix: false
 * });
 *
 * console.log(`Found ${result.issues.length} formatting issues`);
 * ```
 */
export class PrettierPlugin extends BaseLinterPlugin {
  /**
   * Plugin metadata
   */
  get metadata(): LinterPluginMetadata {
    return {
      id: 'prettier',
      name: 'Prettier',
      description: 'Code formatter for maintaining consistent style across JavaScript, TypeScript, and other supported languages',
      supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.less', '.html', '.vue', '.md', '.yaml', '.yml', '.mjs', '.cjs'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0',
    };
  }

  // ==========================================================================
  // Core Plugin Interface Implementation
  // ==========================================================================

  /**
   * Execute Prettier on the specified files or patterns
   *
   * @param options - Execution options including files to format
   * @returns Promise resolving to the formatting result
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

      // Build Prettier command arguments
      const args = this.buildPrettierArgs(options);

      // Execute Prettier
      const result = await this.spawnProcess('prettier', args, {
        cwd: options.cwd,
        timeout: options.timeout,
        env: options.env,
      });

      const duration = Date.now() - startTime;

      // Parse issues from output (Prettier with --check lists unformatted files)
      const issues = this.parse(result.stdout, options);

      // Count files checked
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
        `Prettier execution failed: ${errorMessage}`,
        duration
      );
    }
  }

  /**
   * Parse raw Prettier output into standardized LintIssue format
   *
   * When run with --check, Prettier outputs file paths of unformatted files,
   * one per line. We convert these into formatting issues.
   *
   * @param output - Raw output from Prettier --check
   * @param options - Original execution options for context
   * @returns Array of parsed lint issues
   */
  parse(output: string, options?: LinterExecuteOptions): LintIssue[] {
    if (!output.trim()) {
      return [];
    }

    const issues: LintIssue[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      const filePath = line.trim();
      if (!filePath || filePath.startsWith('[') || filePath.includes('error')) {
        // Skip empty lines, log messages, or error lines
        continue;
      }

      // Create a formatting issue for each unformatted file
      const issue = this.createIssue({
        filePath,
        line: 1,
        column: 1,
        severity: 'warning' as LintSeverity,
        ruleId: 'prettier/formatting',
        message: 'File is not formatted according to Prettier configuration',
        fix: {
          description: 'Auto-format file with Prettier',
          replacements: [{
            startOffset: 0,
            endOffset: 0,
            text: '', // Will be replaced by Prettier --write
          }],
        },
      });

      issues.push(issue);

      // Emit individual issue event
      this.emit('lint:issue', {
        linterId: this.metadata.id,
        issue,
      });
    }

    return issues;
  }

  /**
   * Apply automatic formatting to resolve formatting issues
   *
   * @param issues - Issues to attempt to fix
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

      // Run Prettier with --write flag
      const args = ['--write', ...filePaths];

      const result = await this.spawnProcess('prettier', args, {
        cwd: options?.cwd,
        timeout: options?.timeout,
      });

      // Prettier --write doesn't output anything on success
      // We assume all files were fixed successfully if no error occurred
      const filesFixed = filePaths.length;
      const issuesFixed = issues.length;

      // Emit fix events
      for (const filePath of filePaths) {
        this.emit('fix:applied', {
          linterId: this.metadata.id,
          filePath,
          issuesFixed: issues.filter(i => i.filePath === filePath).length,
        });
      }

      return {
        success: true,
        filesFixed,
        issuesFixed,
        unfixedIssues: [],
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
   * Check if Prettier is available on the system
   *
   * @returns Promise resolving to true if Prettier is installed and accessible
   */
  async isAvailable(): Promise<boolean> {
    return this.commandExists('prettier');
  }

  /**
   * Get the version of Prettier
   *
   * @returns Promise resolving to the Prettier version string, or null if unavailable
   */
  async getToolVersion(): Promise<string | null> {
    try {
      const result = await this.spawnProcess('prettier', ['--version'], {
        timeout: 5000,
      });

      if (result.exitCode === 0) {
        // Prettier --version outputs just the version number
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
   * Build command-line arguments for Prettier execution
   *
   * @param options - Execution options
   * @returns Array of Prettier CLI arguments
   */
  private buildPrettierArgs(options: LinterExecuteOptions): string[] {
    const args: string[] = [];

    if (options.fix) {
      // Use --write flag for fixing/formatting
      args.push('--write');
    } else {
      // Use --check flag to list unformatted files
      args.push('--check');
    }

    // Add config path if specified
    if (options.configPath) {
      args.push('--config', options.configPath);
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
      // Default to common patterns
      args.push(
        '**/*.{js,jsx,ts,tsx,json,css,scss,less,html,vue,md,yaml,yml,mjs,cjs}'
      );
    }

    return args;
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

    // Otherwise, estimate based on issues found
    // Prettier only reports unformatted files, so add a reasonable estimate
    // for files that were checked but didn't have issues
    const filesWithIssues = new Set(issues.map(issue => issue.filePath)).size;

    // Assume roughly 10-20% of files have formatting issues
    const estimatedTotalFiles = Math.max(filesWithIssues * 5, 1);

    return estimatedTotalFiles;
  }
}

// Export as default for convenient importing
export default PrettierPlugin;