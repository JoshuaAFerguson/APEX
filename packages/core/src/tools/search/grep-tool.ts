/**
 * @fileoverview Grep tool - Content search with ripgrep integration
 *
 * This tool provides powerful content search capabilities using ripgrep with support for:
 * - Regular expression pattern matching
 * - File type filtering and glob patterns
 * - Multiple output modes (content, files_with_matches, count)
 * - Context lines (-A, -B, -C)
 * - Case insensitive search
 * - Multiline matching
 * - Performance optimization for large codebases
 *
 * @module @apex/core/tools/search/grep-tool
 */

import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolCategory, ToolPermission } from '../../types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input parameters for the Grep tool
 */
export interface GrepToolInput {
  /** The regex pattern to search for in file contents */
  pattern: string;

  /** File or directory to search in (defaults to cwd) */
  path?: string;

  /** Glob pattern to filter files (e.g., "*.js", "*.{ts,tsx}") */
  glob?: string;

  /** File type to search (e.g., "js", "py", "rust") - maps to rg --type */
  type?: string;

  /**
   * Output mode:
   * - "content": Show matching lines (default)
   * - "files_with_matches": Show only file paths
   * - "count": Show match counts per file
   */
  output_mode?: 'content' | 'files_with_matches' | 'count';

  /** Lines to show after each match (rg -A) */
  '-A'?: number;

  /** Lines to show before each match (rg -B) */
  '-B'?: number;

  /** Lines to show before and after each match (rg -C) */
  '-C'?: number;

  /** Case insensitive search (rg -i) */
  '-i'?: boolean;

  /** Show line numbers in output (rg -n) */
  '-n'?: boolean;

  /** Enable multiline mode (rg -U --multiline-dotall) */
  multiline?: boolean;

  /** Limit output to first N lines/entries */
  head_limit?: number;

  /** Skip first N lines/entries before applying head_limit */
  offset?: number;
}

/**
 * A single grep match result
 */
export interface GrepMatch {
  /** Absolute path to the file */
  path: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** The matching line content */
  content: string;
  /** Context lines before the match */
  contextBefore?: string[];
  /** Context lines after the match */
  contextAfter?: string[];
}

/**
 * Match count for a single file
 */
export interface GrepFileCount {
  /** Absolute path to the file */
  path: string;
  /** Number of matches in this file */
  count: number;
}

/**
 * Output from the Grep tool (discriminated union based on output_mode)
 */
export interface GrepToolOutput {
  /** Output mode that was used */
  mode: 'content' | 'files_with_matches' | 'count';

  /** Pattern that was searched */
  pattern: string;

  /** Directory/file that was searched */
  searchPath: string;

  /** Time taken for the search in milliseconds */
  searchTime: number;

  /** Total number of matches found */
  totalMatches: number;

  /** Total number of files with matches */
  totalFiles: number;

  /** Whether results were truncated due to limits */
  truncated: boolean;

  // Mode-specific outputs (only one will be populated)

  /** Matches with content (when mode = 'content') */
  matches?: GrepMatch[];

  /** Files with matches (when mode = 'files_with_matches') */
  files?: string[];

  /** Match counts per file (when mode = 'count') */
  counts?: GrepFileCount[];
}

/**
 * Ripgrep JSON output line structure
 */
interface RipgrepJsonLine {
  type: 'begin' | 'match' | 'context' | 'end';
  data?: {
    path?: { text: string };
    line_number?: number;
    absolute_offset?: number;
    lines?: { text: string };
    submatches?: Array<{
      start: number;
      end: number;
      match: { text: string };
    }>;
    stats?: {
      elapsed: { secs: number; nanos: number };
      searches: number;
      searches_with_match: number;
      bytes_searched: number;
      bytes_printed: number;
      matched_lines: number;
      matches: number;
    };
  };
}

// ============================================================================
// Grep Tool Implementation
// ============================================================================

/**
 * Grep tool for powerful content search with ripgrep integration.
 *
 * Features:
 * - Powered by ripgrep (rg) for maximum performance
 * - Full regular expression support with proper validation
 * - Multiple output modes for different use cases
 * - File type and glob pattern filtering
 * - Context lines support (-A, -B, -C)
 * - Multiline matching support
 * - Case insensitive search
 * - Graceful fallback if ripgrep not available
 * - Built-in safety limits and cancellation support
 *
 * ## Pattern Examples
 *
 * - `"function.*Error"` - Functions containing "Error"
 * - `"TODO|FIXME"` - Code comments with todos
 * - `"interface\\s+\\w+"` - Interface declarations
 * - `"import.*from.*react"` - React imports
 * - `"class\\s+\\w+\\s+extends"` - Class inheritance
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Find all TODO comments
 * const result = await grepTool.execute({
 *   pattern: 'TODO|FIXME',
 *   output_mode: 'content'
 * });
 *
 * // Find TypeScript files with interface declarations
 * const result = await grepTool.execute({
 *   pattern: 'interface\\s+\\w+',
 *   type: 'ts',
 *   output_mode: 'files_with_matches'
 * });
 *
 * // Search with context lines
 * const result = await grepTool.execute({
 *   pattern: 'error',
 *   '-C': 2,
 *   '-i': true
 * });
 * ```
 */
export class GrepTool extends BaseTool<GrepToolInput, GrepToolOutput> {
  /** Maximum number of results to return */
  private static readonly MAX_RESULTS = 10000;

  /** Maximum time to spend on search in milliseconds */
  private static readonly MAX_SEARCH_TIME = 60000; // 60 seconds

  /** Cache ripgrep availability check */
  private ripgrepAvailable: boolean | null = null;

  constructor() {
    super({
      name: 'Grep',
      description: 'A powerful search tool built on ripgrep for searching file contents. Supports regex pattern matching, file type filtering, context lines, and multiple output modes (content/files/count). Fast and efficient for large codebases.',
      category: 'search' as ToolCategory,
      permissions: ['read' as ToolPermission],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The regular expression pattern to search for in file contents',
          },
          path: {
            type: 'string',
            description: 'File or directory to search in (rg PATH). Defaults to current working directory.',
          },
          glob: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob',
          },
          type: {
            type: 'string',
            description: 'File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.',
          },
          output_mode: {
            type: 'string',
            enum: ['content', 'files_with_matches', 'count'],
            description: 'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".',
          },
          '-A': {
            type: 'number',
            description: 'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
          },
          '-B': {
            type: 'number',
            description: 'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
          },
          '-C': {
            type: 'number',
            description: 'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
          },
          '-i': {
            type: 'boolean',
            description: 'Case insensitive search (rg -i)',
          },
          '-n': {
            type: 'boolean',
            description: 'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.',
          },
          multiline: {
            type: 'boolean',
            description: 'Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.',
          },
          head_limit: {
            type: 'number',
            description: 'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 0 (unlimited).',
          },
          offset: {
            type: 'number',
            description: 'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.',
          },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
      examples: [
        {
          name: 'Search for TODO comments',
          description: 'Find all TODO and FIXME comments in the codebase',
          input: { pattern: 'TODO|FIXME', output_mode: 'content' },
        },
        {
          name: 'Find files with specific function',
          description: 'Find TypeScript files containing async functions',
          input: { pattern: 'async\\s+function', type: 'ts', output_mode: 'files_with_matches' },
        },
        {
          name: 'Search with context lines',
          description: 'Search for error patterns with 2 lines of context',
          input: { pattern: 'error', '-C': 2, '-i': true, output_mode: 'content' },
        },
        {
          name: 'Count matches per file',
          description: 'Count occurrences of import statements in JavaScript files',
          input: { pattern: 'import.*from', type: 'js', output_mode: 'count' },
        },
      ],
      version: '1.0.0',
      tags: ['search', 'content', 'regex', 'ripgrep', 'pattern-matching'],
    });
  }

  /**
   * Validates the input parameters with enhanced pattern, path, and option checks.
   */
  validate(
    params: GrepToolInput,
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Pattern validation
    if (!params.pattern?.trim()) {
      errors.push('pattern cannot be empty');
    } else {
      // Validate regex syntax
      try {
        new RegExp(params.pattern);
      } catch (error) {
        errors.push(`invalid regular expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Check for potentially dangerous patterns
      const dangerousPatterns = ['.*', '.+', '.*.*', '.+.+'];
      if (dangerousPatterns.includes(params.pattern)) {
        warnings.push('pattern may cause catastrophic backtracking and poor performance');
      }

      // Warn about very broad patterns
      if (params.pattern === '.' || params.pattern === '.*' || params.pattern === '.+') {
        warnings.push('very broad pattern will match most lines and may be slow');
      }
    }

    // Path validation
    if (params.path !== undefined) {
      if (!params.path.trim()) {
        errors.push('path cannot be empty if specified');
      } else {
        // Security: Check for path traversal attempts
        const normalizedPath = path.normalize(params.path);
        if (normalizedPath.includes('..') && !path.isAbsolute(normalizedPath)) {
          warnings.push('relative path contains ".." - ensure this is intentional');
        }

        // Security: Warn about system directories
        const dangerousPatterns = ['/etc/', '/proc/', '/sys/', '/dev/', 'C:\\Windows\\', 'C:\\System32\\'];
        if (dangerousPatterns.some(pattern => normalizedPath.startsWith(pattern))) {
          warnings.push('accessing system directories - use caution');
        }
      }
    }

    // Context line validation
    const contextParams = [params['-A'], params['-B'], params['-C']];
    for (let i = 0; i < contextParams.length; i++) {
      const value = contextParams[i];
      if (value !== undefined) {
        if (!Number.isInteger(value) || value < 0) {
          const paramName = ['-A', '-B', '-C'][i];
          errors.push(`${paramName} must be a non-negative integer`);
        } else if (value > 50) {
          const paramName = ['-A', '-B', '-C'][i];
          warnings.push(`${paramName} value of ${value} is very large and may impact performance`);
        }
      }
    }

    // Output mode validation
    if (params.output_mode && !['content', 'files_with_matches', 'count'].includes(params.output_mode)) {
      errors.push('output_mode must be one of: content, files_with_matches, count');
    }

    // Context lines only work with content mode
    if (params.output_mode && params.output_mode !== 'content') {
      const contextUsed = params['-A'] || params['-B'] || params['-C'] || params['-n'];
      if (contextUsed) {
        warnings.push('context lines (-A, -B, -C) and line numbers (-n) only work with output_mode "content"');
      }
    }

    // Head limit and offset validation
    if (params.head_limit !== undefined) {
      if (!Number.isInteger(params.head_limit) || params.head_limit < 0) {
        errors.push('head_limit must be a non-negative integer');
      }
    }

    if (params.offset !== undefined) {
      if (!Number.isInteger(params.offset) || params.offset < 0) {
        errors.push('offset must be a non-negative integer');
      }
    }

    // Glob and type validation
    if (params.glob && params.type) {
      warnings.push('both glob and type specified - type filter will take precedence');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  /**
   * Executes the grep search operation.
   */
  protected async executeImpl(
    params: GrepToolInput,
    context?: ToolExecutionContext
  ): Promise<GrepToolOutput> {
    const startTime = Date.now();

    // Check cancellation early
    if (context?.signal?.aborted) {
      throw new Error('Grep operation was cancelled');
    }

    // Determine search directory
    const searchPath = this.resolveSearchPath(params.path, context?.workingDirectory);

    // Check if search path exists
    try {
      const stats = await fs.stat(searchPath);
      if (!stats.isDirectory() && !stats.isFile()) {
        throw new Error(`Search path must be a file or directory: ${searchPath}`);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = (error as { code: string }).code;
        if (code === 'ENOENT') {
          throw new Error(`Search path not found: ${searchPath}`);
        } else if (code === 'EACCES' || code === 'EPERM') {
          throw new Error(`Permission denied accessing search path: ${searchPath}`);
        }
      }
      throw new Error(`Failed to access search path: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check ripgrep availability
    const ripgrepAvailable = await this.checkRipgrepAvailability();
    if (!ripgrepAvailable) {
      throw new Error('Ripgrep (rg) is not available. Please install ripgrep for content search functionality.');
    }

    // Build ripgrep command
    const rgArgs = this.buildRipgrepArgs(params, searchPath);

    // Execute ripgrep
    let rgOutput: string;
    try {
      rgOutput = await this.executeRipgrep(rgArgs, context?.signal);
    } catch (error) {
      throw new Error(`Ripgrep execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Parse output based on mode
    const result = this.parseRipgrepOutput(
      rgOutput,
      params.output_mode || 'files_with_matches',
      params.pattern,
      searchPath,
      params.head_limit,
      params.offset
    );

    const endTime = Date.now();
    result.searchTime = endTime - startTime;

    // Check if search took too long
    if (result.searchTime > GrepTool.MAX_SEARCH_TIME) {
      result.truncated = true;
    }

    return result;
  }

  /**
   * Resolves the search path based on input parameters and context.
   */
  private resolveSearchPath(inputPath?: string, workingDirectory?: string): string {
    if (!inputPath) {
      return workingDirectory || process.cwd();
    }

    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }

    const baseDir = workingDirectory || process.cwd();
    return path.resolve(baseDir, inputPath);
  }

  /**
   * Checks if ripgrep is available in the system.
   */
  private async checkRipgrepAvailability(): Promise<boolean> {
    if (this.ripgrepAvailable !== null) {
      return this.ripgrepAvailable;
    }

    try {
      const { spawn } = await import('node:child_process');
      const child = spawn('rg', ['--version'], { stdio: 'ignore' });

      const result = await new Promise<boolean>((resolve) => {
        child.on('close', (code) => {
          resolve(code === 0);
        });
        child.on('error', () => {
          resolve(false);
        });
      });

      this.ripgrepAvailable = result;
      return result;
    } catch (error) {
      this.ripgrepAvailable = false;
      return false;
    }
  }

  /**
   * Builds ripgrep command arguments from input parameters.
   */
  private buildRipgrepArgs(params: GrepToolInput, searchPath: string): string[] {
    const args: string[] = [];

    // Always use JSON output for structured parsing
    args.push('--json');

    // Output mode specific flags
    switch (params.output_mode) {
      case 'files_with_matches':
        args.push('--files-with-matches');
        break;
      case 'count':
        args.push('--count');
        break;
      case 'content':
      default:
        // Content mode is default, no special flag needed
        if (params['-n'] !== false) {
          args.push('-n'); // Line numbers by default for content mode
        }
        break;
    }

    // Context lines (only for content mode)
    if (params.output_mode === 'content' || !params.output_mode) {
      if (params['-A'] !== undefined) {
        args.push('-A', params['-A'].toString());
      }
      if (params['-B'] !== undefined) {
        args.push('-B', params['-B'].toString());
      }
      if (params['-C'] !== undefined) {
        args.push('-C', params['-C'].toString());
      }
    }

    // Case sensitivity
    if (params['-i']) {
      args.push('-i');
    }

    // Multiline mode
    if (params.multiline) {
      args.push('-U', '--multiline-dotall');
    }

    // File filtering
    if (params.type) {
      args.push('--type', params.type);
    }

    if (params.glob) {
      args.push('--glob', params.glob);
    }

    // Add pattern and search path
    args.push(params.pattern);
    args.push(searchPath);

    return args;
  }

  /**
   * Executes ripgrep with the given arguments.
   */
  private async executeRipgrep(args: string[], signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('rg', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        signal,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        // ripgrep returns 1 when no matches found, which is not an error
        if (code === 0 || code === 1) {
          resolve(stdout);
        } else {
          reject(new Error(`ripgrep exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle cancellation
      if (signal) {
        signal.addEventListener('abort', () => {
          child.kill('SIGTERM');
          reject(new Error('Ripgrep operation was cancelled'));
        });
      }
    });
  }

  /**
   * Parses ripgrep JSON output into structured results.
   */
  private parseRipgrepOutput(
    output: string,
    mode: 'content' | 'files_with_matches' | 'count',
    pattern: string,
    searchPath: string,
    headLimit?: number,
    offset?: number
  ): GrepToolOutput {
    const lines = output.trim().split('\n').filter(line => line.trim());
    const matches: GrepMatch[] = [];
    const files: string[] = [];
    const counts: GrepFileCount[] = [];

    let totalMatches = 0;
    let totalFiles = 0;
    let truncated = false;

    // Apply offset and head limit to lines
    const startIndex = offset || 0;
    const endIndex = headLimit ? startIndex + headLimit : lines.length;
    const processedLines = lines.slice(startIndex, endIndex);

    if (endIndex < lines.length) {
      truncated = true;
    }

    for (const line of processedLines) {
      if (!line.trim()) continue;

      try {
        const jsonData: RipgrepJsonLine = JSON.parse(line);

        switch (jsonData.type) {
          case 'match':
            if (mode === 'content' && jsonData.data) {
              const match: GrepMatch = {
                path: jsonData.data.path?.text || '',
                line: jsonData.data.line_number || 0,
                column: jsonData.data.submatches?.[0]?.start || 0,
                content: jsonData.data.lines?.text || '',
              };
              matches.push(match);
              totalMatches++;
            } else if (mode === 'files_with_matches' && jsonData.data?.path?.text) {
              const filePath = jsonData.data.path.text;
              if (!files.includes(filePath)) {
                files.push(filePath);
                totalFiles++;
              }
            }
            break;

          case 'begin':
            if (mode === 'count' && jsonData.data?.path?.text) {
              // For count mode, we'll track files and their match counts
              totalFiles++;
            }
            break;

          case 'end':
            if (mode === 'count' && jsonData.data?.stats && jsonData.data.path?.text) {
              const count: GrepFileCount = {
                path: jsonData.data.path.text,
                count: jsonData.data.stats.matches || 0,
              };
              counts.push(count);
              totalMatches += count.count;
            }
            break;
        }

        // Check limits
        if (mode === 'content' && matches.length >= GrepTool.MAX_RESULTS) {
          truncated = true;
          break;
        } else if (mode === 'files_with_matches' && files.length >= GrepTool.MAX_RESULTS) {
          truncated = true;
          break;
        }
      } catch (error) {
        // Skip invalid JSON lines
        continue;
      }
    }

    // For files mode, count total matches as total files
    if (mode === 'files_with_matches') {
      totalMatches = totalFiles;
    }

    // For content mode, count unique files
    if (mode === 'content') {
      const uniqueFiles = new Set(matches.map(m => m.path));
      totalFiles = uniqueFiles.size;
    }

    return {
      mode,
      pattern,
      searchPath,
      searchTime: 0, // Will be set by caller
      totalMatches,
      totalFiles,
      truncated,
      matches: mode === 'content' ? matches : undefined,
      files: mode === 'files_with_matches' ? files : undefined,
      counts: mode === 'count' ? counts : undefined,
    };
  }
}