import * as os from 'os';
import * as path from 'path';

/**
 * Get the user's home directory path in a cross-platform way
 *
 * @returns The absolute path to the user's home directory
 * @throws {Error} If the home directory cannot be determined
 */
export function getHomeDir(): string {
  // Use Node.js built-in os.homedir() which handles cross-platform differences
  const homeDir = os.homedir();

  if (!homeDir) {
    throw new Error('Unable to determine home directory');
  }

  return homeDir;
}

/**
 * Normalize a file path for the current platform
 *
 * Converts path separators to the current platform's format and resolves
 * relative path components (., ..)
 *
 * @param pathStr - The path string to normalize
 * @returns The normalized path string
 */
export function normalizePath(pathStr: string): string {
  if (typeof pathStr !== 'string') {
    throw new Error('Path must be a string');
  }

  // Use Node.js path.normalize to handle platform differences
  return path.normalize(pathStr);
}

/**
 * Get the configuration directory path in a cross-platform way
 *
 * On Windows: %APPDATA% or %USERPROFILE%\AppData\Roaming
 * On macOS: ~/.config
 * On Linux: ~/.config
 *
 * @param appName - Optional application name to append to the config directory
 * @returns The absolute path to the configuration directory
 */
export function getConfigDir(appName?: string): string {
  let configDir: string;

  // Platform-specific configuration directory detection
  if (process.platform === 'win32') {
    // Windows: Use APPDATA environment variable or fall back to USERPROFILE\AppData\Roaming
    configDir = process.env.APPDATA || path.join(getHomeDir(), 'AppData', 'Roaming');
  } else {
    // Unix-like systems (macOS, Linux): Use ~/.config
    configDir = path.join(getHomeDir(), '.config');
  }

  // Append application name if provided
  if (appName) {
    configDir = path.join(configDir, appName);
  }

  return normalizePath(configDir);
}