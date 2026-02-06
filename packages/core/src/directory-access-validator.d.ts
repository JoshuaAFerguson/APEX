/**
 * @fileoverview Directory Access Validator - Path allowlist/blocklist checking with glob pattern support
 *
 * This module provides validation utilities for checking whether file paths are allowed or blocked
 * based on DirectoryAccessConfig allowlist and blocklist patterns. It supports glob patterns
 * for flexible path matching and provides methods to check individual patterns.
 *
 * Key features:
 * - Glob pattern matching using minimatch
 * - Allowlist and blocklist validation
 * - Default allow/deny behavior configuration
 * - Path normalization and security checks
 * - Support for both relative and absolute paths
 *
 * @module @apex/core/directory-access-validator
 */
import type { DirectoryAccessConfig } from './types.js';
/**
 * Result of a path validation check
 */
export interface PathValidationResult {
    /** Whether the path is allowed */
    allowed: boolean;
    /** Reason for the decision */
    reason: string;
    /** Pattern that matched (if any) */
    matchedPattern?: string;
    /** Whether the match was from allowlist or blocklist */
    matchType?: 'allowlist' | 'blocklist' | 'default';
}
/**
 * Options for path validation
 */
export interface ValidationOptions {
    /** Base directory for resolving relative paths */
    baseDir?: string;
    /** Whether to resolve symlinks when checking paths (default: true) */
    resolveSymlinks?: boolean;
}
/**
 * Validates file paths against allowlist/blocklist patterns using glob matching.
 *
 * The DirectoryAccessValidator provides methods to check whether file paths
 * are allowed or blocked based on configuration patterns. It supports:
 *
 * - Glob pattern matching using minimatch
 * - Allowlist and blocklist validation
 * - Default allow/deny behavior
 * - Path normalization and security validation
 *
 * ## Pattern Matching Examples
 *
 * ```typescript
 * const config: DirectoryAccessConfig = {
 *   allowlist: ['src/**\/*', 'docs/*.md'],
 *   blocklist: ['src/secrets/*', '**\/*.log'],
 *   defaultAllow: false
 * };
 *
 * const validator = new DirectoryAccessValidator();
 *
 * // Check if path is allowed
 * const result = validator.isPathAllowed('/project/src/main.ts', config);
 * console.log(result.allowed); // true (matches allowlist pattern 'src/**\/*')
 *
 * // Check blocklist match
 * const blocked = validator.matchesBlocklist('/project/src/secrets/key.txt', ['src/secrets/*']);
 * console.log(blocked); // true
 * ```
 */
export declare class DirectoryAccessValidator {
    /**
     * Checks if a path is allowed based on the given DirectoryAccessConfig.
     *
     * The validation logic follows this precedence:
     * 1. If path matches any blocklist pattern → DENY
     * 2. If path matches any allowlist pattern → ALLOW
     * 3. Use defaultAllow behavior (or infer from allowlist presence)
     *
     * @param filePath - The file path to check (can be relative or absolute)
     * @param config - The directory access configuration
     * @param options - Optional validation options
     * @returns Validation result with decision and reasoning
     */
    isPathAllowed(filePath: string, config: DirectoryAccessConfig, options?: ValidationOptions): PathValidationResult;
    /**
     * Checks if a path matches any pattern in the allowlist.
     *
     * @param filePath - The file path to check
     * @param patterns - Array of glob patterns to match against
     * @returns True if the path matches any allowlist pattern
     */
    matchesAllowlist(filePath: string, patterns: string[]): boolean;
    /**
     * Checks if a path matches any pattern in the blocklist.
     *
     * @param filePath - The file path to check
     * @param patterns - Array of glob patterns to match against
     * @returns True if the path matches any blocklist pattern
     */
    matchesBlocklist(filePath: string, patterns: string[]): boolean;
    /**
     * Normalizes and validates a file path.
     *
     * @private
     * @param filePath - The file path to normalize
     * @param baseDir - Optional base directory for resolving relative paths
     * @returns Normalized absolute path
     * @throws Error if path is invalid or potentially dangerous
     */
    private normalizeAndValidatePath;
    /**
     * Normalizes a path for consistent comparison.
     *
     * @private
     * @param filePath - The path to normalize
     * @returns Normalized path
     */
    private normalizePath;
    /**
     * Validates that a path doesn't contain dangerous patterns.
     *
     * @private
     * @param filePath - The path to validate
     * @throws Error if path contains dangerous patterns
     */
    private validatePathSecurity;
    /**
     * Checks if a file path matches any of the given glob patterns.
     *
     * @private
     * @param filePath - The normalized file path to check
     * @param patterns - Array of glob patterns
     * @returns True if the path matches any pattern
     */
    private matchesAnyPattern;
    /**
     * Checks if a file path matches a single glob pattern.
     *
     * @private
     * @param filePath - The file path to check
     * @param pattern - The glob pattern to match against
     * @returns True if the path matches the pattern
     */
    private matchesPattern;
}
/**
 * Default instance of DirectoryAccessValidator for convenience.
 * Use this for simple validation scenarios.
 */
export declare const directoryAccessValidator: DirectoryAccessValidator;
/**
 * Convenience function to check if a path is allowed.
 * Uses the default validator instance.
 *
 * @param filePath - The file path to check
 * @param config - The directory access configuration
 * @param options - Optional validation options
 * @returns Validation result
 */
export declare function isPathAllowed(filePath: string, config: DirectoryAccessConfig, options?: ValidationOptions): PathValidationResult;
/**
 * Convenience function to check allowlist patterns.
 * Uses the default validator instance.
 *
 * @param filePath - The file path to check
 * @param patterns - Array of glob patterns
 * @returns True if path matches any allowlist pattern
 */
export declare function matchesAllowlist(filePath: string, patterns: string[]): boolean;
/**
 * Convenience function to check blocklist patterns.
 * Uses the default validator instance.
 *
 * @param filePath - The file path to check
 * @param patterns - Array of glob patterns
 * @returns True if path matches any blocklist pattern
 */
export declare function matchesBlocklist(filePath: string, patterns: string[]): boolean;
//# sourceMappingURL=directory-access-validator.d.ts.map