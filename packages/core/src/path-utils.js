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
 * @returns The absolute path to the user's home directory
 * @throws {Error} If the home directory cannot be determined
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
 * relative path components (., ..)
 *
 * @param pathStr - The path string to normalize
 * @returns The normalized path string
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
 * On Windows: %APPDATA% or %USERPROFILE%\AppData\Roaming
 * On macOS: ~/.config
 * On Linux: ~/.config
 *
 * @param appName - Optional application name to append to the config directory
 * @returns The absolute path to the configuration directory
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