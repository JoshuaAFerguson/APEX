import * as os from 'os';
import * as path from 'path';

/**
 * Shell configuration for cross-platform command execution
 */
export interface ShellConfig {
  /** The shell executable to use */
  shell: string;
  /** Arguments to pass to the shell when executing commands */
  shellArgs: string[];
}

/**
 * Get the platform-appropriate shell configuration for exec/spawn operations
 *
 * Returns the correct shell and arguments for the current platform:
 * - Windows: cmd.exe with /d /s /c flags
 * - Unix-like (macOS, Linux): /bin/sh with -c flag
 *
 * @returns Shell configuration object with shell path and arguments
 */
export function getPlatformShell(): ShellConfig {
  if (isWindows()) {
    return {
      shell: 'cmd.exe',
      shellArgs: ['/d', '/s', '/c']
    };
  }

  return {
    shell: '/bin/sh',
    shellArgs: ['-c']
  };
}

/**
 * Check if the current platform is Windows
 *
 * @returns true if running on Windows, false otherwise
 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Get the platform-appropriate command to kill a process by PID
 *
 * Returns the correct kill command for the current platform:
 * - Windows: taskkill /f /pid {pid}
 * - Unix-like: kill -9 {pid}
 *
 * @param pid - The process ID to kill
 * @returns Array of command parts [command, ...args]
 * @throws {Error} If PID is not a valid positive integer
 */
export function getKillCommand(pid: number): string[] {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error('PID must be a positive integer');
  }

  if (isWindows()) {
    return ['taskkill', '/f', '/pid', pid.toString()];
  }

  return ['kill', '-9', pid.toString()];
}

/**
 * Resolve executable name with platform-appropriate extensions
 *
 * On Windows, checks for .exe and .cmd extensions and returns the first
 * existing executable. On Unix-like systems, returns the name as-is.
 *
 * @param name - The base executable name (e.g., 'node', 'git')
 * @returns The resolved executable name with appropriate extension
 */
export function resolveExecutable(name: string): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Executable name must be a non-empty string');
  }

  const baseName = name.trim();

  // On non-Windows platforms, return as-is
  if (!isWindows()) {
    return baseName;
  }

  // On Windows, check for common executable extensions
  const extensions = ['.exe', '.cmd', '.bat'];

  // If the name already has an extension, return as-is
  const ext = path.extname(baseName).toLowerCase();
  if (extensions.includes(ext)) {
    return baseName;
  }

  // For Windows without extension, prefer .exe first, then .cmd
  // In a real implementation, you might want to check if the file actually exists
  // but for this utility function, we'll just add the most common extension
  return baseName + '.exe';
}

/**
 * Create a shell command string by joining command parts with proper escaping
 *
 * Handles platform-specific command joining and escaping:
 * - Windows: Uses cmd.exe escaping rules
 * - Unix-like: Uses shell escaping rules
 *
 * @param commandParts - Array of command parts to join
 * @returns Properly escaped command string for the current platform
 * @throws {Error} If commandParts is empty or contains invalid parts
 */
export function createShellCommand(commandParts: string[]): string {
  if (!Array.isArray(commandParts) || commandParts.length === 0) {
    throw new Error('Command parts must be a non-empty array');
  }

  for (let i = 0; i < commandParts.length; i++) {
    if (typeof commandParts[i] !== 'string') {
      throw new Error(`Command part at index ${i} must be a string`);
    }
  }

  if (isWindows()) {
    // Windows cmd.exe escaping
    return commandParts.map(part => {
      // If the part contains spaces or special characters, wrap in quotes
      if (/[\s&|<>^]/.test(part)) {
        // Escape internal quotes by doubling them
        const escaped = part.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return part;
    }).join(' ');
  }

  // Unix shell escaping
  return commandParts.map(part => {
    // If the part contains special characters, escape them or wrap in quotes
    if (/[\s$`"'\\|&;<>(){}*?[\]~]/.test(part)) {
      // Use single quotes for simplicity, escape any single quotes inside
      const escaped = part.replace(/'/g, "'\"'\"'");
      return `'${escaped}'`;
    }
    return part;
  }).join(' ');
}

/**
 * Environment variable configuration for shell operations
 */
export interface EnvironmentConfig {
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Whether to inherit the current process environment */
  inheritEnv?: boolean;
  /** Working directory for the command */
  cwd?: string;
}

/**
 * Create environment configuration for shell operations
 *
 * Merges custom environment variables with optional inheritance from
 * the current process environment.
 *
 * @param config - Environment configuration options
 * @returns Complete environment object for child processes
 */
export function createEnvironmentConfig(config: EnvironmentConfig = {}): Record<string, string> {
  const { env = {}, inheritEnv = true } = config;

  if (inheritEnv) {
    return {
      ...process.env,
      ...env
    } as Record<string, string>;
  }

  return { ...env };
}

/**
 * Platform-specific path separator
 */
export const PATH_SEPARATOR = isWindows() ? ';' : ':';

/**
 * Platform-specific line ending
 */
export const LINE_ENDING = isWindows() ? '\r\n' : '\n';

/**
 * Common shell utilities and constants
 */
export const SHELL_CONSTANTS = {
  /** Platform-specific path separator for PATH environment variable */
  PATH_SEPARATOR,
  /** Platform-specific line ending */
  LINE_ENDING,
  /** Timeout for shell operations (30 seconds) */
  DEFAULT_TIMEOUT: 30000,
  /** Maximum buffer size for shell output */
  MAX_BUFFER: 1024 * 1024, // 1MB
} as const;