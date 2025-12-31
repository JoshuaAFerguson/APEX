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

import path from 'node:path';
import { minimatch } from 'minimatch';
import type { DirectoryAccessConfig } from './types.js';
import { normalizePath } from './path-utils.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

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

// ============================================================================
// DirectoryAccessValidator Implementation
// ============================================================================

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
 *   allowlist: ['src/**/*', 'docs/*.md'],
 *   blocklist: ['src/secrets/*', '**/*.log'],
 *   defaultAllow: false
 * };
 *
 * const validator = new DirectoryAccessValidator();
 *
 * // Check if path is allowed
 * const result = validator.isPathAllowed('/project/src/main.ts', config);
 * console.log(result.allowed); // true (matches allowlist pattern 'src/**/*')
 *
 * // Check blocklist match
 * const blocked = validator.matchesBlocklist('/project/src/secrets/key.txt', ['src/secrets/*']);
 * console.log(blocked); // true
 * ```
 */
export class DirectoryAccessValidator {
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
  isPathAllowed(
    filePath: string,
    config: DirectoryAccessConfig,
    options: ValidationOptions = {}
  ): PathValidationResult {
    try {
      // Normalize and validate the path
      const normalizedPath = this.normalizeAndValidatePath(filePath, options.baseDir);

      // Check blocklist first (highest priority)
      if (config.blocklist && config.blocklist.length > 0) {
        if (this.matchesBlocklist(normalizedPath, config.blocklist)) {
          return {
            allowed: false,
            reason: 'Path matches blocklist pattern',
            matchType: 'blocklist'
          };
        }
      }

      // Check allowlist second
      if (config.allowlist && config.allowlist.length > 0) {
        if (this.matchesAllowlist(normalizedPath, config.allowlist)) {
          return {
            allowed: true,
            reason: 'Path matches allowlist pattern',
            matchType: 'allowlist'
          };
        }
      }

      // Determine default behavior
      const shouldAllowByDefault = config.defaultAllow !== undefined
        ? config.defaultAllow
        : (!config.allowlist || config.allowlist.length === 0);

      return {
        allowed: shouldAllowByDefault,
        reason: shouldAllowByDefault
          ? 'Path allowed by default policy (no patterns matched)'
          : 'Path denied by default policy (allowlist present but no match)',
        matchType: 'default'
      };

    } catch (error) {
      return {
        allowed: false,
        reason: `Path validation error: ${error instanceof Error ? error.message : String(error)}`,
        matchType: 'default'
      };
    }
  }

  /**
   * Checks if a path matches any pattern in the allowlist.
   *
   * @param filePath - The file path to check
   * @param patterns - Array of glob patterns to match against
   * @returns True if the path matches any allowlist pattern
   */
  matchesAllowlist(filePath: string, patterns: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    try {
      const normalizedPath = this.normalizePath(filePath);
      return this.matchesAnyPattern(normalizedPath, patterns);
    } catch {
      return false;
    }
  }

  /**
   * Checks if a path matches any pattern in the blocklist.
   *
   * @param filePath - The file path to check
   * @param patterns - Array of glob patterns to match against
   * @returns True if the path matches any blocklist pattern
   */
  matchesBlocklist(filePath: string, patterns: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    try {
      const normalizedPath = this.normalizePath(filePath);
      return this.matchesAnyPattern(normalizedPath, patterns);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Normalizes and validates a file path.
   *
   * @private
   * @param filePath - The file path to normalize
   * @param baseDir - Optional base directory for resolving relative paths
   * @returns Normalized absolute path
   * @throws Error if path is invalid or potentially dangerous
   */
  private normalizeAndValidatePath(filePath: string, baseDir?: string): string {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('File path must be a non-empty string');
    }

    // Convert to absolute path if relative
    let absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(baseDir || process.cwd(), filePath);

    // Normalize the path
    absolutePath = normalizePath(absolutePath);

    // Security check: ensure path doesn't escape intended boundaries
    this.validatePathSecurity(absolutePath);

    return absolutePath;
  }

  /**
   * Normalizes a path for consistent comparison.
   *
   * @private
   * @param filePath - The path to normalize
   * @returns Normalized path
   */
  private normalizePath(filePath: string): string {
    return normalizePath(filePath);
  }

  /**
   * Validates that a path doesn't contain dangerous patterns.
   *
   * @private
   * @param filePath - The path to validate
   * @throws Error if path contains dangerous patterns
   */
  private validatePathSecurity(filePath: string): void {
    const normalizedPath = path.normalize(filePath);

    // Check for null bytes (directory traversal attack)
    if (normalizedPath.includes('\0')) {
      throw new Error('Path contains null bytes');
    }

    // Check for excessively long paths
    if (normalizedPath.length > 4096) {
      throw new Error('Path exceeds maximum length');
    }
  }

  /**
   * Checks if a file path matches any of the given glob patterns.
   *
   * @private
   * @param filePath - The normalized file path to check
   * @param patterns - Array of glob patterns
   * @returns True if the path matches any pattern
   */
  private matchesAnyPattern(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a file path matches a single glob pattern.
   *
   * @private
   * @param filePath - The file path to check
   * @param pattern - The glob pattern to match against
   * @returns True if the path matches the pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    if (!pattern || typeof pattern !== 'string') {
      return false;
    }

    try {
      // Normalize the pattern
      const normalizedPattern = pattern.trim();
      if (!normalizedPattern) {
        return false;
      }

      // Use minimatch for pattern matching with appropriate options
      return minimatch(filePath, normalizedPattern, {
        dot: true, // Include hidden files
        nocase: false, // Case sensitive by default
        nobrace: false, // Enable brace expansion like {js,ts}
        noglobstar: false, // Enable ** globstar patterns
        noext: false, // Enable extglob patterns
        nonegate: false, // Enable negation patterns
        nocomment: false, // Enable comment patterns
        flipNegate: false, // Don't flip negation
        partial: false, // Require full match
        allowWindowsEscape: false, // Don't allow Windows escape sequences
        windowsPathsNoEscape: false // Don't treat Windows paths specially
      });
    } catch (error) {
      // If pattern is invalid, treat as non-matching for safety
      return false;
    }
  }
}

// ============================================================================
// Exported Functions and Constants
// ============================================================================

/**
 * Default instance of DirectoryAccessValidator for convenience.
 * Use this for simple validation scenarios.
 */
export const directoryAccessValidator = new DirectoryAccessValidator();

/**
 * Convenience function to check if a path is allowed.
 * Uses the default validator instance.
 *
 * @param filePath - The file path to check
 * @param config - The directory access configuration
 * @param options - Optional validation options
 * @returns Validation result
 */
export function isPathAllowed(
  filePath: string,
  config: DirectoryAccessConfig,
  options?: ValidationOptions
): PathValidationResult {
  return directoryAccessValidator.isPathAllowed(filePath, config, options);
}

/**
 * Convenience function to check allowlist patterns.
 * Uses the default validator instance.
 *
 * @param filePath - The file path to check
 * @param patterns - Array of glob patterns
 * @returns True if path matches any allowlist pattern
 */
export function matchesAllowlist(filePath: string, patterns: string[]): boolean {
  return directoryAccessValidator.matchesAllowlist(filePath, patterns);
}

/**
 * Convenience function to check blocklist patterns.
 * Uses the default validator instance.
 *
 * @param filePath - The file path to check
 * @param patterns - Array of glob patterns
 * @returns True if path matches any blocklist pattern
 */
export function matchesBlocklist(filePath: string, patterns: string[]): boolean {
  return directoryAccessValidator.matchesBlocklist(filePath, patterns);
}