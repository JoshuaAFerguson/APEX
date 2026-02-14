/**
 * @fileoverview Shell Tool Mocks
 *
 * This file provides mock implementations for shell-related tools,
 * primarily the Bash tool for command execution.
 */

import { vi } from 'vitest';
import type { ToolMock } from '../types.js';

// ============================================================================
// Shell Command Response Types
// ============================================================================

interface ShellCommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  workingDirectory?: string;
}

// ============================================================================
// Bash Tool Mock
// ============================================================================

/**
 * Create a Bash tool mock with configurable command responses
 */
export function createBashMock(
  commandResponses: Record<string, Partial<ShellCommandResult>> = {},
  options: {
    defaultWorkingDir?: string;
    simulateDelay?: boolean;
    allowDangerousCommands?: boolean;
    blockedCommands?: string[];
    timeout?: number;
  } = {}
): ToolMock {
  const calls: ToolMock['calls'] = [];
  const {
    defaultWorkingDir = '/tmp',
    simulateDelay = true,
    allowDangerousCommands = false,
    blockedCommands = ['rm -rf /', 'format', 'dd if=/dev/zero'],
    timeout = 30000,
  } = options;

  const mockFn = vi.fn().mockImplementation(async (params: {
    command: string;
    description?: string;
    timeout?: number;
    dangerouslyDisableSandbox?: boolean;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const {
        command,
        description,
        timeout: commandTimeout = timeout,
        dangerouslyDisableSandbox = false,
      } = params;

      if (!command || command.trim() === '') {
        const error = new Error('Command parameter is required');
        callInfo.error = error;
        throw error;
      }

      const trimmedCommand = command.trim();

      // Check for blocked commands
      const isBlocked = blockedCommands.some((blocked) =>
        trimmedCommand.toLowerCase().includes(blocked.toLowerCase())
      );

      if (isBlocked && !dangerouslyDisableSandbox) {
        const error = new Error(`Command blocked for security reasons: ${trimmedCommand}`);
        callInfo.error = error;
        throw error;
      }

      // Check for dangerous commands
      if (!allowDangerousCommands && !dangerouslyDisableSandbox) {
        const dangerousPatterns = [
          /rm\s+-rf?\s+\/[^\/\s]*/,
          /chmod\s+777/,
          /sudo\s+rm/,
          /mkfs\./,
          /dd\s+if=/,
        ];

        const isDangerous = dangerousPatterns.some((pattern) => pattern.test(trimmedCommand));
        if (isDangerous) {
          const error = new Error(
            `Dangerous command detected. Use dangerouslyDisableSandbox: true to override: ${trimmedCommand}`
          );
          callInfo.error = error;
          throw error;
        }
      }

      // Simulate command execution time
      const executionStart = Date.now();
      if (simulateDelay) {
        const delay = Math.random() * 100 + 50; // 50-150ms
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Check for configured response
      const configuredResponse = findCommandResponse(trimmedCommand, commandResponses);
      let result: ShellCommandResult;

      if (configuredResponse) {
        result = {
          command: trimmedCommand,
          stdout: '',
          stderr: '',
          exitCode: 0,
          executionTime: Date.now() - executionStart,
          workingDirectory: defaultWorkingDir,
          ...configuredResponse,
        };
      } else {
        // Generate default response based on command
        result = generateDefaultCommandResponse(trimmedCommand, defaultWorkingDir);
        result.executionTime = Date.now() - executionStart;
      }

      // Handle command timeout
      if (result.executionTime > commandTimeout) {
        const error = new Error(`Command timed out after ${commandTimeout}ms: ${trimmedCommand}`);
        callInfo.error = error;
        throw error;
      }

      // Handle non-zero exit codes
      if (result.exitCode !== 0) {
        const error = new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr || 'Unknown error'}`);
        callInfo.error = error;
        throw error;
      }

      const response = {
        success: true,
        command: result.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        execution_time_ms: result.executionTime,
        working_directory: result.workingDirectory,
        description,
      };

      callInfo.result = response;
      return response;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'Bash', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

/**
 * Create a Bash mock that simulates specific command behaviors
 */
export function createRealisticBashMock(workingDirectory = '/tmp'): ToolMock {
  const commonCommands: Record<string, Partial<ShellCommandResult>> = {
    'pwd': {
      stdout: workingDirectory,
      exitCode: 0,
    },
    'whoami': {
      stdout: 'testuser',
      exitCode: 0,
    },
    'date': {
      stdout: new Date().toString(),
      exitCode: 0,
    },
    'echo hello': {
      stdout: 'hello',
      exitCode: 0,
    },
    'ls': {
      stdout: 'file1.txt\nfile2.js\ndirectory1\n',
      exitCode: 0,
    },
    'ls -la': {
      stdout: `total 8
drwxr-xr-x  3 testuser testuser  96 Jan 15 10:30 .
drwxr-xr-x  5 testuser testuser 160 Jan 15 10:29 ..
-rw-r--r--  1 testuser testuser  12 Jan 15 10:30 file1.txt
-rw-r--r--  1 testuser testuser  25 Jan 15 10:30 file2.js
drwxr-xr-x  2 testuser testuser  64 Jan 15 10:30 directory1`,
      exitCode: 0,
    },
    'git status': {
      stdout: `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`,
      exitCode: 0,
    },
    'npm --version': {
      stdout: '9.2.0',
      exitCode: 0,
    },
    'node --version': {
      stdout: 'v18.17.0',
      exitCode: 0,
    },
  };

  return createBashMock(commonCommands, {
    defaultWorkingDir: workingDirectory,
    simulateDelay: true,
    allowDangerousCommands: false,
  });
}

/**
 * Create a Bash mock that always fails
 */
export function createFailingBashMock(
  exitCode = 1,
  errorMessage = 'Command execution failed'
): ToolMock {
  const calls: ToolMock['calls'] = [];

  const mockFn = vi.fn().mockImplementation(async (params: { command: string }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    const error = new Error(`Command failed with exit code ${exitCode}: ${errorMessage}`);
    callInfo.error = error;
    throw error;
  });

  return {
    mock: mockFn,
    config: { tool: 'Bash', shouldSucceed: false, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find a command response that matches the given command
 */
function findCommandResponse(
  command: string,
  responses: Record<string, Partial<ShellCommandResult>>
): Partial<ShellCommandResult> | undefined {
  // Try exact match first
  if (responses[command]) {
    return responses[command];
  }

  // Try pattern matching
  for (const [pattern, response] of Object.entries(responses)) {
    if (pattern.includes('*') || pattern.includes('?')) {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\./g, '\\.');

      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(command)) {
        return response;
      }
    } else if (command.includes(pattern)) {
      // Partial match
      return response;
    }
  }

  return undefined;
}

/**
 * Generate a default response for unknown commands
 */
function generateDefaultCommandResponse(
  command: string,
  workingDirectory: string
): ShellCommandResult {
  const cmd = command.toLowerCase();

  // Handle common command patterns
  if (cmd.startsWith('echo ')) {
    const text = command.substring(5).replace(/^["']|["']$/g, '');
    return {
      command,
      stdout: text,
      stderr: '',
      exitCode: 0,
      executionTime: 10,
      workingDirectory,
    };
  }

  if (cmd.startsWith('cat ')) {
    return {
      command,
      stdout: 'Mock file content\nLine 2\nLine 3',
      stderr: '',
      exitCode: 0,
      executionTime: 20,
      workingDirectory,
    };
  }

  if (cmd.startsWith('ls ')) {
    return {
      command,
      stdout: 'mock-file.txt\nother-file.js\n',
      stderr: '',
      exitCode: 0,
      executionTime: 15,
      workingDirectory,
    };
  }

  if (cmd.startsWith('grep ')) {
    return {
      command,
      stdout: 'mock-file.txt: matching line here\nother-file.js: another match',
      stderr: '',
      exitCode: 0,
      executionTime: 30,
      workingDirectory,
    };
  }

  if (cmd === 'pwd') {
    return {
      command,
      stdout: workingDirectory,
      stderr: '',
      exitCode: 0,
      executionTime: 5,
      workingDirectory,
    };
  }

  if (cmd.startsWith('mkdir ') || cmd.startsWith('touch ')) {
    return {
      command,
      stdout: '',
      stderr: '',
      exitCode: 0,
      executionTime: 25,
      workingDirectory,
    };
  }

  // Default for unknown commands
  return {
    command,
    stdout: `Mock output for: ${command}`,
    stderr: '',
    exitCode: 0,
    executionTime: 50,
    workingDirectory,
  };
}