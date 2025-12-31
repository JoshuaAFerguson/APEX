/**
 * @fileoverview Path validation and traversal detection for BashTool security
 *
 * This module provides functions to detect path traversal attempts and validate
 * that commands operate within allowed directories. It helps prevent attacks
 * that try to access files outside the intended sandbox.
 *
 * @module @apex/core/tools/shell/path-validator
 */

import { resolve, normalize, isAbsolute, sep } from 'node:path';
import type { CommandValidationResult } from './blocklist.js';

// ============================================================================
// Types and Constants
// ============================================================================

/**
 * Result of path traversal detection
 */
export interface PathTraversalResult {
  /** Whether path traversal was detected */
  detected: boolean;
  /** Suspicious paths found in the command */
  suspiciousPaths: string[];
  /** The specific patterns that were matched */
  matchedPatterns: string[];
}

/**
 * Patterns that indicate potential path traversal attempts
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,                                    // ../
  /\.\.$/,                                      // ends with ..
  /\.\.['"]/,                                   // .. followed by quote
  /\/\.\.\//g,                                  // /../
  /^\.\.$/,                                     // just ..
  /\.\.\\/g,                                    // ..\ (Windows)
  /\.\.%2[fF]/g,                                // URL encoded ../
  /\.\.%5[cC]/g,                                // URL encoded ..\
  /\.\.\x2[fF]/g,                               // Hex encoded ../
  /\.\.\x5[cC]/g,                               // Hex encoded ..\
] as const;

/**
 * Suspicious absolute paths that should be flagged
 */
const SUSPICIOUS_PATHS = [
  /\/etc\/(passwd|shadow|sudoers|ssh)/,         // Critical system files
  /\/root\//,                                   // Root user directory
  /~\/\.\w+/,                                   // Hidden files in home (~/.bashrc, ~/.ssh, etc.)
  /\/proc\//,                                   // Process filesystem
  /\/sys\//,                                    // System filesystem
  /\/dev\//,                                    // Device files
  /\/boot\//,                                   // Boot files
  /\/var\/log\//,                               // System logs
  /\/tmp\/.*\.\.(\/|\\)/,                       // Traversal in /tmp
  // Windows paths
  /[A-Z]:\\Windows/i,                           // Windows directory
  /[A-Z]:\\System/i,                            // System directory
  /[A-Z]:\\Program Files/i,                     // Program Files
  /\\\.\.\\|\/\.\.\/.*[A-Z]:/,                  // Traversal to Windows drives
] as const;

/**
 * Patterns for extracting path-like strings from commands
 * These patterns look for quoted paths, absolute paths, and relative paths
 */
const PATH_EXTRACTION_PATTERNS = [
  /"([^"]+)"/g,                                 // Double quoted paths
  /'([^']+)'/g,                                 // Single quoted paths
  /\s([\/~][^\s;|&<>]+)/g,                      // Unquoted absolute/home paths
  /\s(\.\.?[\/\\][^\s;|&<>]*)/g,                // Relative paths starting with . or ..
  /\s([a-zA-Z]:[\\\/][^\s;|&<>]*)/g,            // Windows absolute paths
] as const;

// ============================================================================
// Path Traversal Detection
// ============================================================================

/**
 * Detects path traversal attempts in commands
 *
 * This function analyzes a command string for patterns that could indicate
 * attempts to access files outside the intended directory scope.
 *
 * @param command The command string to analyze
 * @param baseDirectory Optional base directory for relative path checking
 * @returns PathTraversalResult with detection status and details
 */
export function detectPathTraversal(
  command: string,
  baseDirectory?: string
): PathTraversalResult {
  const suspiciousPaths: string[] = [];
  const matchedPatterns: string[] = [];

  // Extract all potential paths from the command
  const extractedPaths = extractPathsFromCommand(command);

  // Check each extracted path for traversal patterns
  for (const path of extractedPaths) {
    // Check for traversal patterns
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(path)) {
        suspiciousPaths.push(path);
        matchedPatterns.push(pattern.source);
        break; // Don't add the same path multiple times
      }
    }

    // Check for suspicious absolute paths
    for (const pattern of SUSPICIOUS_PATHS) {
      if (pattern.test(path)) {
        suspiciousPaths.push(path);
        matchedPatterns.push(pattern.source);
        break;
      }
    }

    // If we have a base directory, check if the resolved path escapes it
    if (baseDirectory && !suspiciousPaths.includes(path)) {
      const escapesBase = checkPathEscapesBase(path, baseDirectory);
      if (escapesBase) {
        suspiciousPaths.push(path);
        matchedPatterns.push('path_escape_base_directory');
      }
    }
  }

  return {
    detected: suspiciousPaths.length > 0,
    suspiciousPaths: [...new Set(suspiciousPaths)], // Remove duplicates
    matchedPatterns: [...new Set(matchedPatterns)],
  };
}

/**
 * Extracts potential file paths from a command string
 *
 * @param command The command to analyze
 * @returns Array of potential paths found in the command
 */
export function extractPathsFromCommand(command: string): string[] {
  const paths: string[] = [];

  // Use each extraction pattern to find paths
  for (const pattern of PATH_EXTRACTION_PATTERNS) {
    let match;
    const globalPattern = new RegExp(pattern.source, pattern.flags);

    while ((match = globalPattern.exec(command)) !== null) {
      // The captured group is either index 1 (for quoted paths) or index 1 (for unquoted)
      const path = match[1] || match[0];
      if (path && path.length > 1) { // Ignore single characters
        paths.push(path.trim());
      }
    }
  }

  // Also look for common file operations with paths
  const fileOpMatches = command.match(/(?:cd|cp|mv|rm|ls|cat|touch|mkdir|rmdir)\s+([^\s;|&<>]+)/g);
  if (fileOpMatches) {
    for (const match of fileOpMatches) {
      const parts = match.split(/\s+/);
      if (parts.length > 1) {
        paths.push(parts[parts.length - 1]); // Last part is usually the path
      }
    }
  }

  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Checks if a path would escape from a base directory when resolved
 *
 * @param path The path to check
 * @param baseDirectory The base directory that should contain the path
 * @returns True if the path escapes the base directory
 */
export function checkPathEscapesBase(path: string, baseDirectory: string): boolean {
  try {
    // Normalize the base directory
    const normalizedBase = normalize(resolve(baseDirectory));

    // If the path is relative, resolve it relative to the base
    // If it's absolute, use it as-is
    let resolvedPath: string;

    if (isAbsolute(path)) {
      resolvedPath = normalize(path);
    } else {
      resolvedPath = normalize(resolve(baseDirectory, path));
    }

    // Check if the resolved path is within the base directory
    // Add separator to prevent false positives with similar names
    const basePlusSeperator = normalizedBase + sep;
    const isWithin = resolvedPath === normalizedBase || resolvedPath.startsWith(basePlusSeperator);

    return !isWithin;
  } catch (error) {
    // If path resolution fails, consider it suspicious
    return true;
  }
}

// ============================================================================
// Working Directory Validation
// ============================================================================

/**
 * Validates that a working directory is within allowed paths
 *
 * @param workingDirectory The working directory to validate
 * @param baseDirectory Optional base directory constraint
 * @param allowedPaths Additional allowed paths outside the base
 * @returns CommandValidationResult indicating if the directory is allowed
 */
export function validateWorkingDirectory(
  workingDirectory: string | undefined,
  baseDirectory: string | undefined,
  allowedPaths: string[] = []
): CommandValidationResult {
  // If no base directory is set, allow any working directory
  if (!baseDirectory) {
    return { allowed: true };
  }

  // Use current working directory if not specified
  const cwd = workingDirectory || process.cwd();

  try {
    const resolvedCwd = resolve(cwd);
    const resolvedBase = resolve(baseDirectory);

    // Check if working directory is within base directory
    const basePlusSeperator = resolvedBase + sep;
    const isWithinBase = resolvedCwd === resolvedBase || resolvedCwd.startsWith(basePlusSeperator);

    // Check if working directory is within any allowed path
    const isInAllowedPath = allowedPaths.some(allowedPath => {
      const resolvedAllowed = resolve(allowedPath);
      const allowedPlusSeperator = resolvedAllowed + sep;
      return resolvedCwd === resolvedAllowed || resolvedCwd.startsWith(allowedPlusSeperator);
    });

    if (!isWithinBase && !isInAllowedPath) {
      return {
        allowed: false,
        blockedReason: `Working directory '${cwd}' is outside the allowed sandbox. ` +
                      `Must be within '${baseDirectory}'` +
                      (allowedPaths.length > 0 ? ` or allowed paths: ${allowedPaths.join(', ')}` : ''),
        violationType: 'directory_escape',
        violatedRule: `baseDirectory: ${baseDirectory}`,
      };
    }

    return { allowed: true };
  } catch (error) {
    // If path resolution fails, block for safety
    return {
      allowed: false,
      blockedReason: `Unable to validate working directory '${cwd}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      violationType: 'directory_escape',
      violatedRule: 'path_resolution_failed',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalizes a path for consistent comparison
 * Handles both Unix and Windows path separators
 *
 * @param path The path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  return normalize(path).replace(/\\/g, '/');
}

/**
 * Checks if two paths refer to the same location
 *
 * @param path1 First path
 * @param path2 Second path
 * @returns True if paths refer to the same location
 */
export function pathsEqual(path1: string, path2: string): boolean {
  try {
    const resolved1 = resolve(path1);
    const resolved2 = resolve(path2);
    return normalizePath(resolved1) === normalizePath(resolved2);
  } catch {
    return false;
  }
}

/**
 * Gets the relative path from base to target, if target is within base
 *
 * @param base The base directory
 * @param target The target path
 * @returns Relative path if target is within base, null otherwise
 */
export function getRelativePathIfWithin(base: string, target: string): string | null {
  try {
    const resolvedBase = resolve(base);
    const resolvedTarget = resolve(target);
    const basePlusSeperator = resolvedBase + sep;

    if (resolvedTarget === resolvedBase) {
      return '.';
    }

    if (resolvedTarget.startsWith(basePlusSeperator)) {
      return resolvedTarget.slice(resolvedBase.length + 1);
    }

    return null;
  } catch {
    return null;
  }
}