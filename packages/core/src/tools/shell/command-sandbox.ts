/**
 * @fileoverview CommandSandbox class for validating and constraining shell commands
 *
 * This module provides the main CommandSandbox class that orchestrates all
 * security validations for shell commands. It integrates blocklist checking,
 * path traversal detection, and working directory validation.
 *
 * @module @apex/core/tools/shell/command-sandbox
 */

import { checkCommandBlocklist, type CommandValidationResult } from './blocklist.js';
import { detectPathTraversal, validateWorkingDirectory } from './path-validator.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for command sandboxing
 */
export interface SandboxConfig {
  /** Enable/disable sandboxing (default: true) */
  enabled: boolean;
  /** Base directory for command execution (working directory must be within) */
  baseDirectory?: string;
  /** Additional allowed directories outside base (absolute paths) */
  allowedPaths?: string[];
  /** Custom blocklist patterns (in addition to defaults) */
  customBlocklist?: string[];
  /** Patterns to explicitly allow (overrides blocklist) */
  allowlist?: string[];
  /** Whether to allow sudo commands (default: false) */
  allowSudo?: boolean;
  /** Whether to allow network commands like curl, wget (default: true) */
  allowNetwork?: boolean;
  /** Maximum command length (default: 10000) */
  maxCommandLength?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<SandboxConfig> = {
  enabled: true,
  baseDirectory: undefined,
  allowedPaths: [],
  customBlocklist: [],
  allowlist: [],
  allowSudo: false,
  allowNetwork: true,
  maxCommandLength: 10000,
};

// ============================================================================
// CommandSandbox Class
// ============================================================================

/**
 * Sandbox for validating and constraining shell commands
 *
 * The CommandSandbox provides a layered security model for shell command validation:
 * 1. Basic checks (command length, enabled status)
 * 2. Allowlist checking (explicit allows override other checks)
 * 3. Blocklist pattern matching
 * 4. Path traversal detection
 * 5. Working directory validation
 *
 * Each layer can block command execution and provides specific error messages
 * to help users understand why their commands were rejected.
 */
export class CommandSandbox {
  private config: Required<SandboxConfig>;
  private customBlocklistPatterns: RegExp[];
  private allowlistPatterns: RegExp[];

  /**
   * Creates a new CommandSandbox instance
   *
   * @param config Partial configuration, will be merged with defaults
   */
  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Compile custom patterns for better performance
    this.customBlocklistPatterns = this.config.customBlocklist.map(
      pattern => new RegExp(pattern, 'i')
    );

    this.allowlistPatterns = this.config.allowlist.map(
      pattern => new RegExp(pattern, 'i')
    );
  }

  /**
   * Validates a command against all security rules
   *
   * This is the main entry point for command validation. It performs all
   * security checks in order and returns the first blocking issue found.
   *
   * @param command The command string to validate
   * @param workingDirectory Optional working directory for path validation
   * @returns CommandValidationResult indicating if command is allowed
   */
  validate(
    command: string,
    workingDirectory?: string
  ): CommandValidationResult {
    // Short circuit if sandboxing is disabled
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // 1. Basic validation checks
    const basicResult = this.performBasicValidation(command);
    if (!basicResult.allowed) {
      return basicResult;
    }

    // 2. Check allowlist first (explicit allows override everything)
    if (this.isExplicitlyAllowed(command)) {
      return {
        allowed: true,
        warnings: ['Command explicitly allowed by allowlist']
      };
    }

    // 3. Check standard blocklist patterns
    const blocklistResult = checkCommandBlocklist(command);
    if (!blocklistResult.allowed) {
      return blocklistResult;
    }

    // 4. Check custom blocklist patterns
    const customBlocklistResult = this.checkCustomBlocklist(command);
    if (!customBlocklistResult.allowed) {
      return customBlocklistResult;
    }

    // 5. Check for sudo if not allowed
    if (!this.config.allowSudo) {
      const sudoResult = this.checkSudoRestriction(command);
      if (!sudoResult.allowed) {
        return sudoResult;
      }
    }

    // 6. Check network restrictions if configured
    if (!this.config.allowNetwork) {
      const networkResult = this.checkNetworkRestriction(command);
      if (!networkResult.allowed) {
        return networkResult;
      }
    }

    // 7. Check for path traversal attempts
    const traversalResult = this.checkPathTraversal(command, workingDirectory);
    if (!traversalResult.allowed) {
      return traversalResult;
    }

    // 8. Validate working directory constraints
    const wdResult = validateWorkingDirectory(
      workingDirectory,
      this.config.baseDirectory,
      this.config.allowedPaths
    );
    if (!wdResult.allowed) {
      return wdResult;
    }

    // All checks passed
    return {
      allowed: true,
      warnings: this.gatherWarnings(command)
    };
  }

  /**
   * Updates the sandbox configuration
   *
   * @param newConfig Partial configuration to merge with current config
   */
  updateConfig(newConfig: Partial<SandboxConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Recompile patterns
    this.customBlocklistPatterns = this.config.customBlocklist.map(
      pattern => new RegExp(pattern, 'i')
    );

    this.allowlistPatterns = this.config.allowlist.map(
      pattern => new RegExp(pattern, 'i')
    );
  }

  /**
   * Gets the current sandbox configuration
   *
   * @returns Copy of current configuration
   */
  getConfig(): Required<SandboxConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Validation Methods
  // ============================================================================

  /**
   * Performs basic validation checks
   */
  private performBasicValidation(command: string): CommandValidationResult {
    // Check command length
    if (command.length > this.config.maxCommandLength) {
      return {
        allowed: false,
        blockedReason: `Command exceeds maximum length of ${this.config.maxCommandLength} characters (current: ${command.length})`,
        violationType: 'forbidden_pattern',
        violatedRule: `maxCommandLength: ${this.config.maxCommandLength}`,
      };
    }

    // Check for empty command (should be caught earlier, but be safe)
    if (!command.trim()) {
      return {
        allowed: false,
        blockedReason: 'Empty commands are not allowed',
        violationType: 'forbidden_pattern',
        violatedRule: 'empty_command',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks if a command is explicitly allowed via allowlist
   */
  private isExplicitlyAllowed(command: string): boolean {
    return this.allowlistPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Checks custom blocklist patterns
   */
  private checkCustomBlocklist(command: string): CommandValidationResult {
    for (const [index, pattern] of this.customBlocklistPatterns.entries()) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          blockedReason: `Command blocked by custom security rule: ${this.config.customBlocklist[index]}`,
          violationType: 'blocklist',
          violatedRule: `custom_blocklist[${index}]: ${pattern.source}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Checks sudo restriction if sudo is not allowed
   */
  private checkSudoRestriction(command: string): CommandValidationResult {
    // Simple check for sudo - more comprehensive patterns are in the blocklist
    if (/\bsudo\b/.test(command)) {
      return {
        allowed: false,
        blockedReason: 'Sudo commands are not allowed in this sandbox configuration',
        violationType: 'blocklist',
        violatedRule: 'allowSudo: false',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks network restriction if network commands are not allowed
   */
  private checkNetworkRestriction(command: string): CommandValidationResult {
    const networkCommands = /\b(curl|wget|nc|netcat|telnet|ssh|scp|rsync)\b/;

    if (networkCommands.test(command)) {
      return {
        allowed: false,
        blockedReason: 'Network commands are not allowed in this sandbox configuration',
        violationType: 'blocklist',
        violatedRule: 'allowNetwork: false',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks for path traversal attempts
   */
  private checkPathTraversal(
    command: string,
    workingDirectory?: string
  ): CommandValidationResult {
    const traversalResult = detectPathTraversal(command, this.config.baseDirectory);

    if (traversalResult.detected) {
      return {
        allowed: false,
        blockedReason: `Path traversal attempt detected. Suspicious paths: ${traversalResult.suspiciousPaths.join(', ')}`,
        violationType: 'path_traversal',
        violatedRule: `patterns: ${traversalResult.matchedPatterns.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Gathers non-blocking warnings about the command
   */
  private gatherWarnings(command: string): string[] | undefined {
    const warnings: string[] = [];

    // Check for potentially risky but not blocked operations
    if (/\bchmod\b.*[0-7]{3}/.test(command)) {
      warnings.push('Command changes file permissions - ensure this is intended');
    }

    if (/\b(curl|wget)\b/.test(command) && this.config.allowNetwork) {
      warnings.push('Command performs network operations - ensure URLs are trusted');
    }

    if (/\b(tar|zip|unzip)\b/.test(command)) {
      warnings.push('Command handles archives - be cautious of zip bombs or path traversal in archives');
    }

    if (/>\s*\/dev\//.test(command)) {
      warnings.push('Command writes to device files - ensure this is safe');
    }

    return warnings.length > 0 ? warnings : undefined;
  }

  // ============================================================================
  // Public Utility Methods
  // ============================================================================

  /**
   * Tests if a specific pattern would be blocked
   * Useful for testing and debugging
   *
   * @param pattern The pattern to test
   * @returns True if the pattern would be blocked
   */
  isPatternBlocked(pattern: string): boolean {
    const result = this.validate(pattern);
    return !result.allowed;
  }

  /**
   * Gets statistics about the current configuration
   *
   * @returns Object with configuration statistics
   */
  getStats(): {
    enabled: boolean;
    hasBaseDirectory: boolean;
    allowedPathsCount: number;
    customBlocklistCount: number;
    allowlistCount: number;
    maxCommandLength: number;
  } {
    return {
      enabled: this.config.enabled,
      hasBaseDirectory: this.config.baseDirectory !== undefined,
      allowedPathsCount: this.config.allowedPaths.length,
      customBlocklistCount: this.config.customBlocklist.length,
      allowlistCount: this.config.allowlist.length,
      maxCommandLength: this.config.maxCommandLength,
    };
  }

  /**
   * Enables or disables the sandbox
   *
   * @param enabled Whether to enable the sandbox
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a CommandSandbox with strict security settings
 * Suitable for production environments or untrusted code execution
 *
 * @param baseDirectory Base directory to constrain operations
 * @param allowedPaths Additional allowed paths
 * @returns Configured CommandSandbox instance
 */
export function createStrictSandbox(
  baseDirectory?: string,
  allowedPaths: string[] = []
): CommandSandbox {
  return new CommandSandbox({
    enabled: true,
    baseDirectory,
    allowedPaths,
    allowSudo: false,
    allowNetwork: false,
    maxCommandLength: 5000, // Shorter length for strict mode
    customBlocklist: [
      // Additional strict patterns
      'python.*-c',               // Python one-liners
      'perl.*-e',                 // Perl one-liners
      'ruby.*-e',                 // Ruby one-liners
      'node.*-e',                 // Node one-liners
    ],
  });
}

/**
 * Creates a CommandSandbox with permissive settings
 * Suitable for development environments or trusted users
 *
 * @param baseDirectory Optional base directory
 * @returns Configured CommandSandbox instance
 */
export function createPermissiveSandbox(baseDirectory?: string): CommandSandbox {
  return new CommandSandbox({
    enabled: true,
    baseDirectory,
    allowedPaths: ['/tmp', '/var/tmp'],
    allowSudo: false, // Still don't allow sudo by default
    allowNetwork: true,
    maxCommandLength: 20000,
    // No custom blocklist - only use defaults
  });
}

/**
 * Creates a disabled sandbox (no restrictions)
 * Only for testing or when security is handled elsewhere
 *
 * @returns Disabled CommandSandbox instance
 */
export function createDisabledSandbox(): CommandSandbox {
  return new CommandSandbox({
    enabled: false,
  });
}