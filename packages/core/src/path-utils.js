"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHomeDir = getHomeDir;
exports.normalizePath = normalizePath;
exports.getConfigDir = getConfigDir;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
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
function getHomeDir() {
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
function normalizePath(pathStr) {
    if (typeof pathStr !== 'string') {
        throw new Error('Path must be a string');
    }
    // Use Node.js path.normalize to handle platform differences
    return path.normalize(pathStr);
}
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
function getConfigDir(appName) {
    let configDir;
    // Platform-specific configuration directory detection
    if (process.platform === 'win32') {
        // Windows: Use APPDATA environment variable or fall back to USERPROFILE\AppData\Roaming
        configDir = process.env.APPDATA || path.join(getHomeDir(), 'AppData', 'Roaming');
    }
    else {
        // Unix-like systems (macOS, Linux): Use ~/.config
        configDir = path.join(getHomeDir(), '.config');
    }
    // Append application name if provided
    if (appName) {
        configDir = path.join(configDir, appName);
    }
    return normalizePath(configDir);
}
//# sourceMappingURL=path-utils.js.map