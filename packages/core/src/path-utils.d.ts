/**
 * Get the user's home directory path in a cross-platform way
 *
 * Uses Node.js os.homedir() to handle cross-platform differences automatically.
 * This function works on Windows, macOS, and Linux systems.
 *
 * @returns The absolute path to the user's home directory
 * @throws {Error} If the home directory cannot be determined
 *
 * @example
 * ```typescript
 * const homeDir = getHomeDir();
 * console.log(homeDir);
 * // On Windows: "C:\\Users\\username"
 * // On macOS: "/Users/username"
 * // On Linux: "/home/username"
 * ```
 */
export declare function getHomeDir(): string;
/**
 * Normalize a file path for the current platform
 *
 * Converts path separators to the current platform's format and resolves
 * relative path components (., ..). This is essential for cross-platform
 * path handling in APEX.
 *
 * @param pathStr - The path string to normalize
 * @returns The normalized path string
 * @throws {Error} When pathStr is not a string
 *
 * @example
 * ```typescript
 * // Cross-platform path normalization
 * const path1 = normalizePath('../project/src/./file.ts');
 * console.log(path1); // "../project/src/file.ts"
 *
 * // Platform-specific separator handling
 * const path2 = normalizePath('project\\src/file.ts');
 * // On Windows: "project\\src\\file.ts"
 * // On Unix: "project/src/file.ts"
 *
 * // Error handling
 * try {
 *   normalizePath(null);
 * } catch (error) {
 *   console.error(error.message); // "Path must be a string"
 * }
 * ```
 */
export declare function normalizePath(pathStr: string): string;
/**
 * Get the configuration directory path in a cross-platform way
 *
 * Follows platform conventions for application configuration storage.
 * On Windows: %APPDATA% or %USERPROFILE%\AppData\Roaming
 * On macOS: ~/.config
 * On Linux: ~/.config
 *
 * @param appName - Optional application name to append to the config directory
 * @returns The absolute path to the configuration directory
 * @throws {Error} If the home directory cannot be determined (via getHomeDir)
 *
 * @example
 * ```typescript
 * // Get base config directory
 * const configDir = getConfigDir();
 * console.log(configDir);
 * // On Windows: "C:\\Users\\username\\AppData\\Roaming"
 * // On macOS/Linux: "/Users/username/.config" or "/home/username/.config"
 *
 * // Get app-specific config directory
 * const apexConfigDir = getConfigDir('apex');
 * console.log(apexConfigDir);
 * // On Windows: "C:\\Users\\username\\AppData\\Roaming\\apex"
 * // On macOS/Linux: "/Users/username/.config/apex"
 *
 * // Use for storing application settings
 * const settingsPath = path.join(getConfigDir('myapp'), 'settings.json');
 * ```
 */
export declare function getConfigDir(appName?: string): string;
//# sourceMappingURL=path-utils.d.ts.map