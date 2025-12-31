/**
 * @fileoverview Bash tool - Command execution with structured output
 *
 * This tool provides shell command execution capabilities with support for:
 * - Command execution via child_process.spawn
 * - Structured output with stdout, stderr, and exit code
 * - Timeout and cancellation support
 * - Background execution options
 * - Comprehensive error handling
 *
 * @module @apex/core/tools/shell/bash-tool
 */

import { spawn } from 'node:child_process';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolCategory, ToolPermission } from '../../types.js';
import { CommandSandbox, type SandboxConfig } from './command-sandbox.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input parameters for the Bash tool
 */
export interface BashToolInput {
  /** The command to execute */
  command: string;
  /** Optional timeout in milliseconds (default: 120000ms) */
  timeout?: number;
  /** Clear, concise description of what this command does */
  description?: string;
  /** Set to true to run this command in the background */
  run_in_background?: boolean;
}

/**
 * Output from the Bash tool
 */
export interface BashToolOutput {
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
  /** Exit code of the command */
  exitCode: number;
  /** Command that was executed */
  command: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Whether the command was killed due to timeout */
  timedOut: boolean;
  /** Process ID (if available) */
  pid?: number;
}

// ============================================================================
// Bash Tool Implementation
// ============================================================================

/**
 * Bash tool for executing shell commands with structured output.
 *
 * Features:
 * - Executes shell commands via child_process.spawn
 * - Returns structured output with stdout, stderr, and exit code
 * - Supports timeout and cancellation
 * - Optional background execution
 * - Comprehensive error handling and validation
 * - Security considerations for command execution
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Execute simple command
 * const result = await bashTool.execute({ command: 'ls -la' });
 *
 * // Execute with timeout
 * const result = await bashTool.execute({
 *   command: 'npm test',
 *   timeout: 60000,
 *   description: 'Run project tests'
 * });
 * ```
 */
export class BashTool extends BaseTool<BashToolInput, BashToolOutput> {
  /** Default timeout in milliseconds */
  private static readonly DEFAULT_TIMEOUT = 120000;

  /** Maximum allowed timeout in milliseconds (10 minutes) */
  private static readonly MAX_TIMEOUT = 600000;

  /** Commands that are potentially dangerous (kept for backward compatibility warnings) */
  private static readonly DANGEROUS_COMMANDS = new Set([
    'rm', 'rmdir', 'del', 'format', 'fdisk', 'mkfs',
    'dd', 'shred', 'wipe', 'shutdown', 'reboot', 'halt',
    'sudo', 'su', 'chmod', 'chown', 'passwd', 'userdel'
  ]);

  /** Command sandbox for security validation */
  private sandbox: CommandSandbox;

  constructor(sandboxConfig?: Partial<SandboxConfig>) {
    super({
      name: 'Bash',
      description: 'Executes bash commands and returns structured output with stdout, stderr, and exit code',
      category: 'shell' as ToolCategory,
      permissions: ['execute' as ToolPermission],
      dangerous: true, // Shell execution is inherently dangerous
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute',
          },
          timeout: {
            type: 'integer',
            description: 'Optional timeout in milliseconds (default: 120000ms, max: 600000ms)',
            minimum: 1000,
            maximum: 600000,
          },
          description: {
            type: 'string',
            description: 'Clear, concise description of what this command does in 5-10 words',
          },
          run_in_background: {
            type: 'boolean',
            description: 'Set to true to run this command in the background',
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
      examples: [
        {
          name: 'List files',
          description: 'List files in the current directory',
          input: {
            command: 'ls -la',
            description: 'List files with details'
          },
        },
        {
          name: 'Run with timeout',
          description: 'Execute a command with a custom timeout',
          input: {
            command: 'npm test',
            timeout: 60000,
            description: 'Run npm test suite'
          },
        },
        {
          name: 'Check git status',
          description: 'Check the status of git repository',
          input: {
            command: 'git status',
            description: 'Show git working tree status'
          },
        },
      ],
      version: '1.0.0',
      tags: ['shell', 'execution', 'command'],
    });

    // Initialize the command sandbox with provided configuration
    this.sandbox = new CommandSandbox(sandboxConfig);
  }

  /**
   * Validates the input parameters with security considerations.
   */
  validate(
    params: BashToolInput,
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Command validation
    if (!params.command?.trim()) {
      errors.push('command cannot be empty or only whitespace');
    } else {
      const command = params.command.trim();

      // 1. NEW: Sandbox security validation (blocks dangerous commands)
      const sandboxResult = this.sandbox.validate(command, context?.workingDirectory);
      if (!sandboxResult.allowed) {
        errors.push(sandboxResult.blockedReason || 'Command blocked by security policy');
      }

      // Add any sandbox warnings
      if (sandboxResult.warnings) {
        warnings.push(...sandboxResult.warnings);
      }

      // 2. LEGACY: Keep existing warning system for backward compatibility
      // These only generate warnings now since blocking is handled by sandbox
      const firstWord = command.split(/\s+/)[0];
      const baseCommand = firstWord.split('/').pop() || firstWord; // Handle paths like /bin/rm

      if (BashTool.DANGEROUS_COMMANDS.has(baseCommand)) {
        // Only warn if sandbox didn't already block
        if (sandboxResult.allowed) {
          warnings.push(`Potentially dangerous command detected: ${baseCommand} - use with caution`);
        }
      }

      // Legacy suspicious pattern checking (now mostly handled by sandbox)
      const suspiciousPatterns = [
        /;\s*rm\s+/,     // ; rm
        /\|\s*rm\s+/,    // | rm
        /&&\s*rm\s+/,    // && rm
        /`.*`/,          // command substitution
        /\$\(/,          // command substitution
        />\/dev\/null.*&/, // common background pattern that could hide malicious activity
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(command) && sandboxResult.allowed) {
          warnings.push('Command contains potentially suspicious patterns - review carefully');
          break;
        }
      }
    }

    // Timeout validation
    if (params.timeout !== undefined) {
      if (!Number.isInteger(params.timeout) || params.timeout < 1000) {
        errors.push('timeout must be an integer of at least 1000ms');
      }
      if (params.timeout > BashTool.MAX_TIMEOUT) {
        errors.push(`timeout cannot exceed ${BashTool.MAX_TIMEOUT}ms`);
      }
    }

    // Description validation (optional but recommended)
    if (params.description !== undefined && !params.description.trim()) {
      warnings.push('description should not be empty if provided');
    }

    // Context-aware validation
    if (context?.timeout && params.timeout && params.timeout > context.timeout) {
      warnings.push('command timeout exceeds execution context timeout');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  /**
   * Executes the shell command and returns structured output.
   */
  protected async executeImpl(
    params: BashToolInput,
    context?: ToolExecutionContext
  ): Promise<BashToolOutput> {
    const command = params.command.trim();
    const timeout = params.timeout || BashTool.DEFAULT_TIMEOUT;
    const startTime = Date.now();

    // Handle background execution (simplified - just note it for now)
    if (params.run_in_background) {
      // Note: Real background execution would require additional infrastructure
      // For now, we'll execute normally but could extend this later
    }

    return new Promise((resolve, reject) => {
      let timedOut = false;
      let stdout = '';
      let stderr = '';

      // Split command into parts for spawn
      const [cmd, ...args] = this.parseCommand(command);

      // Spawn the process
      const child = spawn(cmd, args, {
        shell: true,
        cwd: context?.workingDirectory,
        env: {
          ...process.env,
          ...(context?.environment || {})
        },
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
      });

      const pid = child.pid;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Handle abort signal from context
      const onAbort = () => {
        clearTimeout(timeoutId);
        child.kill('SIGTERM');
        reject(new Error('Command execution was cancelled'));
      };

      if (context?.signal) {
        if (context.signal.aborted) {
          clearTimeout(timeoutId);
          child.kill('SIGTERM');
          reject(new Error('Command execution was cancelled'));
          return;
        }
        context.signal.addEventListener('abort', onAbort);
      }

      // Collect stdout
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      // Collect stderr
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      // Handle process completion
      child.on('close', (exitCode: number | null) => {
        clearTimeout(timeoutId);

        if (context?.signal) {
          context.signal.removeEventListener('abort', onAbort);
        }

        const duration = Date.now() - startTime;

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: exitCode ?? -1, // Use -1 if exit code is null
          command,
          duration,
          timedOut,
          pid,
        });
      });

      // Handle errors
      child.on('error', (error) => {
        clearTimeout(timeoutId);

        if (context?.signal) {
          context.signal.removeEventListener('abort', onAbort);
        }

        // If it's a timeout, resolve with timeout info instead of rejecting
        if (timedOut) {
          const duration = Date.now() - startTime;
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim() + (stderr ? '\n' : '') + 'Command timed out',
            exitCode: -1,
            command,
            duration,
            timedOut: true,
            pid,
          });
        } else {
          reject(new Error(`Failed to execute command: ${error.message}`));
        }
      });
    });
  }

  /**
   * Parses a command string into command and arguments.
   * This is a simple implementation - in production, you might want more sophisticated parsing.
   */
  private parseCommand(command: string): string[] {
    // For now, let the shell handle the parsing by using the full command as one argument
    // This is safer and handles quoting, escaping, etc. properly
    return ['/bin/sh', '-c', command];
  }
}