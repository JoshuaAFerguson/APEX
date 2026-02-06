/**
 * Get the user's home directory path in a cross-platform way
 *
 * @returns The absolute path to the user's home directory
 * @throws {Error} If the home directory cannot be determined
 */
export declare function getHomeDir(): string;
/**
 * Normalize a file path for the current platform
 *
 * Converts path separators to the current platform's format and resolves
 * relative path components (., ..)
 *
 * @param pathStr - The path string to normalize
 * @returns The normalized path string
 */
export declare function normalizePath(pathStr: string): string;
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
export declare function getConfigDir(appName?: string): string;
//# sourceMappingURL=path-utils.d.ts.map