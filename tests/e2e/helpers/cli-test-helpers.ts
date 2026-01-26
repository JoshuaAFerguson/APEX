/**
 * @fileoverview CLI testing helpers for APEX E2E tests
 *
 * Provides utilities for executing APEX CLI commands in test environments
 * with proper timeout handling, output capturing, and error management.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Path to the CLI - adjust based on where it's built
const CLI_PATH = path.join(__dirname, '../../../packages/cli/dist/index.js');

/**
 * Result of CLI command execution
 */
export interface CLIResult {
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
  /** Exit code (0 = success, non-zero = error) */
  exitCode: number;
  /** Whether the command was successful (exitCode === 0) */
  success: boolean;
}

/**
 * Options for CLI command execution
 */
export interface CLIOptions {
  /** Working directory to run the command in */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Whether to suppress color output (default: true) */
  noColor?: boolean;
  /** Additional CLI flags to append */
  flags?: string[];
}

/**
 * Execute an APEX CLI command and return the result
 *
 * @param command - The CLI command to run (without 'apex' prefix)
 * @param options - Execution options
 * @returns Promise resolving to command result
 *
 * @example
 * ```typescript
 * // Run 'apex init --yes' in a temp directory
 * const result = await runApexCLI('init --yes', { cwd: tempDir });
 * expect(result.success).toBe(true);
 * ```
 */
export async function runApexCLI(command: string, options: CLIOptions = {}): Promise<CLIResult> {
  const {
    cwd = process.cwd(),
    timeout = 30000,
    env = {},
    noColor = true,
    flags = []
  } = options;

  // Build the full command
  const fullFlags = [...flags];
  if (noColor) {
    fullFlags.push('--no-color');
  }

  const flagsStr = fullFlags.length > 0 ? ` ${fullFlags.join(' ')}` : '';
  const fullCommand = `node ${CLI_PATH} ${command}${flagsStr}`;

  // Set up environment
  const execEnv = {
    ...process.env,
    ...env,
    ...(noColor ? { NO_COLOR: '1' } : {}),
    NODE_ENV: 'test',
    APEX_TEST_MODE: 'e2e'
  };

  try {
    const result = await execAsync(fullCommand, {
      cwd,
      timeout,
      env: execEnv,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      success: true
    };
  } catch (error: any) {
    // execAsync throws on non-zero exit codes
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: error.code || 1,
      success: false
    };
  }
}

/**
 * Execute multiple CLI commands in sequence
 *
 * @param commands - Array of commands to execute
 * @param options - Execution options (applied to all commands)
 * @returns Promise resolving to array of results
 */
export async function runApexCLISequence(
  commands: string[],
  options: CLIOptions = {}
): Promise<CLIResult[]> {
  const results: CLIResult[] = [];

  for (const command of commands) {
    const result = await runApexCLI(command, options);
    results.push(result);

    // Stop on first failure unless explicitly told to continue
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Create a new APEX project in the specified directory
 *
 * @param projectPath - Path to create the project in
 * @param options - CLI options
 * @returns Promise resolving to init command result
 */
export async function initApexProject(
  projectPath: string,
  options: Omit<CLIOptions, 'cwd'> = {}
): Promise<CLIResult> {
  return runApexCLI('init --yes', {
    ...options,
    cwd: projectPath
  });
}

/**
 * Check if the CLI binary exists and is executable
 *
 * @returns Promise resolving to boolean indicating CLI availability
 */
export async function checkCLIAvailable(): Promise<boolean> {
  try {
    const result = await runApexCLI('--version', { timeout: 5000 });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Parse JSON output from CLI commands that support --json flag
 *
 * @param output - Raw stdout from CLI command
 * @returns Parsed JSON object or null if parsing failed
 */
export function parseJSONOutput(output: string): any | null {
  try {
    // Clean up the output (remove any extra whitespace/newlines)
    const cleaned = output.trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Assert that a CLI result was successful
 *
 * @param result - CLI result to check
 * @param message - Optional custom error message
 * @throws Error if the command was not successful
 */
export function assertCLISuccess(result: CLIResult, message?: string): void {
  if (!result.success) {
    const errorMsg = message || `CLI command failed with exit code ${result.exitCode}`;
    const fullError = `${errorMsg}\nStdout: ${result.stdout}\nStderr: ${result.stderr}`;
    throw new Error(fullError);
  }
}

/**
 * Assert that a CLI result failed
 *
 * @param result - CLI result to check
 * @param message - Optional custom error message
 * @throws Error if the command was successful
 */
export function assertCLIFailure(result: CLIResult, message?: string): void {
  if (result.success) {
    const errorMsg = message || 'Expected CLI command to fail but it succeeded';
    throw new Error(errorMsg);
  }
}