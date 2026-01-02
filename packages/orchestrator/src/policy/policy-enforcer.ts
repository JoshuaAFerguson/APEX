/**
 * @fileoverview PolicyEnforcer base class for validating agent operations against policy rules
 *
 * This module provides the core PolicyEnforcer class that validates file paths against
 * the PolicyConfig's allowedPaths configuration. It supports glob pattern matching,
 * allowlist/blocklist modes, and generates PolicyViolation records for blocked paths.
 *
 * @module @apex/orchestrator/policy/policy-enforcer
 */

import { minimatch } from 'minimatch';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  PolicyConfig,
  PolicyViolation,
  AllowedPathsConfig,
  PolicyEnforcementMode,
} from '@apexcli/core';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for creating a PolicyViolation
 */
export interface ViolationOptions {
  /** Human-readable message describing the violation */
  message: string;
  /** Detailed description of the violation */
  description?: string;
  /** Resource or context that triggered the violation (e.g., file path) */
  resource?: string;
  /** Additional context about the violation */
  context?: Record<string, unknown>;
  /** Rule ID that was violated */
  ruleId?: string;
  /** The matched pattern that caused the violation */
  matchedPattern?: string;
}

/**
 * Result of path validation with detailed information
 */
export interface PathValidationResult {
  /** Whether the path is allowed */
  allowed: boolean;
  /** Reason for the decision */
  reason: string;
  /** Pattern that matched (if any) */
  matchedPattern?: string;
  /** Type of match (block, allow, sensitive, or default) */
  matchType: 'block' | 'allow' | 'sensitive' | 'default';
  /** Whether this path matches a sensitive pattern */
  isSensitive: boolean;
}

// ============================================================================
// PolicyEnforcer Implementation
// ============================================================================

/**
 * PolicyEnforcer validates agent operations against configured policy rules.
 *
 * The PolicyEnforcer class provides methods to validate file paths against
 * the allowedPaths configuration in PolicyConfig. It supports:
 *
 * - Glob pattern matching using minimatch
 * - Allowlist and blocklist validation modes
 * - Sensitive file pattern detection
 * - PolicyViolation generation with full context
 *
 * ## Usage Example
 *
 * ```typescript
 * const config: PolicyConfig = {
 *   allowedPaths: {
 *     mode: 'allowlist',
 *     allow: ['src/**', 'tests/**'],
 *     block: ['src/secrets/**'],
 *   },
 *   enforcement: 'enforce',
 * };
 *
 * const enforcer = new PolicyEnforcer(config);
 *
 * // Validate a file path
 * const violations = enforcer.validateFilePath('/project/src/main.ts');
 * if (violations.length === 0) {
 *   console.log('Path is allowed');
 * } else {
 *   console.log('Path blocked:', violations[0].message);
 * }
 * ```
 */
export class PolicyEnforcer {
  private readonly config: PolicyConfig;

  /**
   * Creates a new PolicyEnforcer instance.
   *
   * @param config - The policy configuration to enforce
   */
  constructor(config: PolicyConfig) {
    this.config = config;
  }

  /**
   * Gets the current policy configuration.
   */
  get policyConfig(): PolicyConfig {
    return this.config;
  }

  /**
   * Gets the enforcement mode for the policy.
   */
  get enforcementMode(): PolicyEnforcementMode {
    return this.config.enforcement ?? 'warn';
  }

  /**
   * Checks if the policy is enabled.
   */
  get isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Validates a file path against the allowedPaths configuration.
   *
   * The validation follows this precedence:
   * 1. If path matches any block pattern -> VIOLATION
   * 2. If mode is 'allowlist' and path doesn't match allow patterns -> VIOLATION
   * 3. If path matches sensitive patterns -> VIOLATION (requires approval)
   * 4. Otherwise -> ALLOWED (empty array)
   *
   * @param filePath - The file path to validate
   * @returns Array of PolicyViolation objects (empty if path is allowed)
   */
  validateFilePath(filePath: string): PolicyViolation[] {
    // If policy is disabled, allow everything
    if (!this.isEnabled) {
      return [];
    }

    const allowedPaths = this.config.allowedPaths;

    // If no allowedPaths configuration, allow everything
    if (!allowedPaths) {
      return [];
    }

    const violations: PolicyViolation[] = [];
    const normalizedPath = this.normalizePath(filePath);
    const validationResult = this.evaluatePath(normalizedPath, allowedPaths);

    if (!validationResult.allowed) {
      violations.push(
        this.createViolation({
          message: validationResult.reason,
          description: this.buildViolationDescription(validationResult, normalizedPath),
          resource: normalizedPath,
          ruleId: 'path-validation',
          matchedPattern: validationResult.matchedPattern,
          context: {
            matchType: validationResult.matchType,
            isSensitive: validationResult.isSensitive,
            mode: allowedPaths.mode ?? 'allowlist',
          },
        })
      );
    }

    // Also check for sensitive patterns (even if path is otherwise allowed)
    if (validationResult.allowed && validationResult.isSensitive) {
      violations.push(
        this.createViolation({
          message: `Path '${normalizedPath}' matches sensitive file pattern and requires approval`,
          description: `The path matches a sensitive pattern: ${validationResult.matchedPattern}. Access to sensitive files requires explicit human approval.`,
          resource: normalizedPath,
          ruleId: 'sensitive-path',
          matchedPattern: validationResult.matchedPattern,
          context: {
            matchType: 'sensitive',
            isSensitive: true,
            requiresApproval: true,
          },
        })
      );
    }

    return violations;
  }

  // ============================================================================
  // Protected Methods (for subclasses)
  // ============================================================================

  /**
   * Creates a PolicyViolation with the given options.
   *
   * @param opts - Options for creating the violation
   * @returns A fully populated PolicyViolation object
   */
  protected createViolation(opts: ViolationOptions): PolicyViolation {
    const severity = this.getSeverityFromEnforcement();

    return {
      id: randomUUID(),
      ruleId: opts.ruleId ?? 'path-validation',
      policyType: 'path',
      severity,
      message: opts.message,
      description: opts.description,
      resource: opts.resource,
      context: {
        ...opts.context,
        matchedPattern: opts.matchedPattern,
      },
      timestamp: new Date(),
      resolved: false,
    };
  }

  /**
   * Checks if a path matches any of the given glob patterns.
   *
   * @param filePath - The normalized file path to check
   * @param patterns - Array of glob patterns to match against
   * @returns The first matching pattern, or undefined if no match
   */
  protected matchesPattern(filePath: string, patterns: string[]): string | undefined {
    if (!patterns || patterns.length === 0) {
      return undefined;
    }

    for (const pattern of patterns) {
      if (this.matchSinglePattern(filePath, pattern)) {
        return pattern;
      }
    }

    return undefined;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Evaluates a path against the allowedPaths configuration.
   */
  private evaluatePath(
    normalizedPath: string,
    allowedPaths: AllowedPathsConfig
  ): PathValidationResult {
    const mode = allowedPaths.mode ?? 'allowlist';
    const allowPatterns = allowedPaths.allow ?? [];
    const blockPatterns = allowedPaths.block ?? [];
    const sensitivePatterns = allowedPaths.sensitivePatterns ?? [];

    // Check sensitive patterns first (for flagging, not blocking)
    const sensitiveMatch = this.matchesPattern(normalizedPath, sensitivePatterns);
    const isSensitive = sensitiveMatch !== undefined;

    // Block patterns always take precedence
    const blockMatch = this.matchesPattern(normalizedPath, blockPatterns);
    if (blockMatch !== undefined) {
      return {
        allowed: false,
        reason: `Path '${normalizedPath}' is blocked by pattern '${blockMatch}'`,
        matchedPattern: blockMatch,
        matchType: 'block',
        isSensitive,
      };
    }

    // Check allow patterns
    const allowMatch = this.matchesPattern(normalizedPath, allowPatterns);

    if (mode === 'allowlist') {
      // In allowlist mode, path must match an allow pattern
      if (allowPatterns.length > 0 && allowMatch === undefined) {
        return {
          allowed: false,
          reason: `Path '${normalizedPath}' is not in the allowed paths list`,
          matchType: 'default',
          isSensitive,
        };
      }

      // Path is allowed (either matches allow pattern or no patterns defined)
      return {
        allowed: true,
        reason: allowMatch
          ? `Path matches allow pattern '${allowMatch}'`
          : 'Path allowed by default (no patterns defined)',
        matchedPattern: allowMatch ?? sensitiveMatch,
        matchType: allowMatch ? 'allow' : 'default',
        isSensitive,
      };
    } else {
      // In blocklist mode, path is allowed unless blocked
      return {
        allowed: true,
        reason: 'Path allowed (blocklist mode, not in block list)',
        matchedPattern: sensitiveMatch,
        matchType: 'default',
        isSensitive,
      };
    }
  }

  /**
   * Matches a file path against a single glob pattern.
   */
  private matchSinglePattern(filePath: string, pattern: string): boolean {
    if (!pattern || typeof pattern !== 'string') {
      return false;
    }

    try {
      const normalizedPattern = pattern.trim();
      if (!normalizedPattern) {
        return false;
      }

      // Use minimatch with appropriate options for path matching
      return minimatch(filePath, normalizedPattern, {
        dot: true, // Include hidden files
        nocase: process.platform === 'win32', // Case-insensitive on Windows
        nobrace: false, // Enable brace expansion
        noglobstar: false, // Enable ** patterns
        matchBase: true, // Match basename if pattern has no slashes
      });
    } catch {
      // Invalid pattern - treat as non-matching for safety
      return false;
    }
  }

  /**
   * Normalizes a file path for consistent comparison.
   */
  private normalizePath(filePath: string): string {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return '';
    }

    // Normalize path separators and resolve . and ..
    let normalized = path.normalize(filePath);

    // Convert Windows separators to forward slashes for consistent matching
    normalized = normalized.replace(/\\/g, '/');

    // Remove trailing slashes (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Gets the severity level based on enforcement mode.
   */
  private getSeverityFromEnforcement(): 'info' | 'warning' | 'error' {
    switch (this.enforcementMode) {
      case 'enforce':
        return 'error';
      case 'warn':
        return 'warning';
      case 'audit':
        return 'info';
      default:
        return 'warning';
    }
  }

  /**
   * Builds a detailed description for a violation.
   */
  private buildViolationDescription(
    result: PathValidationResult,
    normalizedPath: string
  ): string {
    const mode = this.config.allowedPaths?.mode ?? 'allowlist';

    if (result.matchType === 'block') {
      return `The file path '${normalizedPath}' matches a blocked pattern. ` +
        `Block patterns take precedence over allow patterns. ` +
        `Matched pattern: ${result.matchedPattern}`;
    }

    if (result.matchType === 'default' && mode === 'allowlist') {
      const allowPatterns = this.config.allowedPaths?.allow ?? [];
      return `The file path '${normalizedPath}' is not in the allowed paths list. ` +
        `In allowlist mode, paths must match at least one allow pattern. ` +
        `Configured allow patterns: ${allowPatterns.join(', ') || '(none)'}`;
    }

    return `Path validation failed for '${normalizedPath}'`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a PolicyEnforcer with default configuration.
 *
 * @param config - Optional policy configuration
 * @returns A new PolicyEnforcer instance
 */
export function createPolicyEnforcer(config: Partial<PolicyConfig> = {}): PolicyEnforcer {
  const defaultConfig: PolicyConfig = {
    version: '1.0',
    enforcement: 'warn',
    enabled: true,
    ...config,
  };

  return new PolicyEnforcer(defaultConfig);
}
