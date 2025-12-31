/**
 * @fileoverview Dangerous Operation Detection and Confirmation Logic
 *
 * This module provides the DangerousOperationDetector class that identifies
 * dangerous tool operations using ToolDefinition.dangerous flag and pattern
 * matching. It returns severity levels and confirmation requirements for
 * operations that could potentially harm the system or data.
 *
 * The detector integrates with existing blocklist patterns from the shell
 * tool to provide comprehensive dangerous operation detection across all
 * tool types.
 *
 * @module @apex/core/dangerous-operation-detector
 */

import type { ToolDefinition, ToolInvocation } from './types.js';
import { checkCommandBlocklist, COMMAND_BLOCKLIST } from './tools/shell/blocklist.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Severity levels for dangerous operations
 * - 'low': Minor risk, may warrant user attention
 * - 'medium': Moderate risk, should prompt for confirmation
 * - 'high': High risk, requires explicit confirmation
 * - 'critical': Critical risk, requires elevated confirmation
 */
export type DangerousSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Confirmation requirements for dangerous operations
 */
export interface ConfirmationRequirements {
  /** Whether confirmation is required before execution */
  required: boolean;
  /** Type of confirmation needed */
  type: 'simple' | 'detailed' | 'elevated';
  /** Warning message to display to the user */
  message: string;
  /** Additional context about the risk */
  context?: string;
  /** Suggested alternative actions */
  alternatives?: string[];
}

/**
 * Detection result for dangerous operations
 */
export interface DangerousOperationResult {
  /** Whether the operation is considered dangerous */
  isDangerous: boolean;
  /** Severity level if dangerous */
  severity?: DangerousSeverity;
  /** Specific reason why it's dangerous */
  reason?: string;
  /** Category of dangerous operation */
  category?: string;
  /** Confirmation requirements */
  confirmation?: ConfirmationRequirements;
  /** Pattern or rule that was matched */
  matchedPattern?: string;
}

/**
 * Configuration for the dangerous operation detector
 */
export interface DetectorConfig {
  /** Enable detection based on ToolDefinition.dangerous flag */
  useToolDefinition: boolean;
  /** Enable pattern-based detection for shell commands */
  usePatternMatching: boolean;
  /** Enable detection for filesystem operations */
  useFilesystemPatterns: boolean;
  /** Enable detection for network operations */
  useNetworkPatterns: boolean;
  /** Custom dangerous patterns to check */
  customPatterns?: DangerousPattern[];
}

/**
 * Custom dangerous pattern definition
 */
export interface DangerousPattern {
  /** Pattern to match (regex or string) */
  pattern: RegExp | string;
  /** Severity if matched */
  severity: DangerousSeverity;
  /** Category name */
  category: string;
  /** Description of the danger */
  description: string;
  /** Tool types this pattern applies to */
  applicableTools?: string[];
}

// ============================================================================
// Built-in Dangerous Patterns
// ============================================================================

/**
 * Filesystem operation patterns that could be dangerous
 */
const FILESYSTEM_DANGEROUS_PATTERNS: DangerousPattern[] = [
  {
    pattern: /\/\.\.\/.*\/\.\.\/.*\/\.\.\//,
    severity: 'high',
    category: 'path_traversal',
    description: 'Deep path traversal attempt detected',
    applicableTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob'],
  },
  {
    pattern: /\/(etc|boot|sys|proc|dev)\//,
    severity: 'high',
    category: 'system_files',
    description: 'Access to critical system directories',
    applicableTools: ['Read', 'Write', 'Edit', 'MultiEdit'],
  },
  {
    pattern: /\.(ssh|gnupg|aws)\/.*key/i,
    severity: 'critical',
    category: 'credential_files',
    description: 'Access to credential or key files',
    applicableTools: ['Read', 'Write', 'Edit'],
  },
  {
    pattern: /\/root\//,
    severity: 'medium',
    category: 'privileged_access',
    description: 'Access to root user directory',
    applicableTools: ['Read', 'Write', 'Edit', 'MultiEdit'],
  },
  {
    pattern: /\.(env|config|secret)/i,
    severity: 'medium',
    category: 'configuration_files',
    description: 'Access to configuration or environment files',
    applicableTools: ['Read', 'Write', 'Edit'],
  },
];

/**
 * Network operation patterns that could be dangerous
 */
const NETWORK_DANGEROUS_PATTERNS: DangerousPattern[] = [
  {
    pattern: /https?:\/\/[^\/]*\.(onion|bit|i2p)\//,
    severity: 'high',
    category: 'dark_web',
    description: 'Access to dark web or suspicious domains',
    applicableTools: ['WebFetch'],
  },
  {
    pattern: /https?:\/\/[^\/]*\.(tk|ml|cf|ga)\//,
    severity: 'medium',
    category: 'suspicious_domains',
    description: 'Access to commonly abused free domains',
    applicableTools: ['WebFetch'],
  },
  {
    pattern: /(exec|shell|cmd|eval)\s*=.*https?/,
    severity: 'critical',
    category: 'remote_execution',
    description: 'Potential remote code execution pattern',
    applicableTools: ['WebFetch'],
  },
];

// ============================================================================
// DangerousOperationDetector Class
// ============================================================================

/**
 * Detects dangerous operations based on tool definitions and pattern matching
 */
export class DangerousOperationDetector {
  private readonly config: DetectorConfig;

  /**
   * Creates a new DangerousOperationDetector instance
   * @param config Configuration options for the detector
   */
  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = {
      useToolDefinition: true,
      usePatternMatching: true,
      useFilesystemPatterns: true,
      useNetworkPatterns: true,
      customPatterns: [],
      ...config,
    };
  }

  /**
   * Detects dangerous operations for a tool invocation
   * @param toolDefinition The tool being invoked
   * @param invocation The specific invocation parameters
   * @returns Detection result with severity and confirmation requirements
   */
  public detectDangerousOperation(
    toolDefinition: ToolDefinition,
    invocation: ToolInvocation
  ): DangerousOperationResult {
    // Check tool definition dangerous flag first
    if (this.config.useToolDefinition && toolDefinition.dangerous) {
      return this.handleToolDefinitionDangerous(toolDefinition, invocation);
    }

    // Check for pattern-based dangers
    if (this.config.usePatternMatching) {
      const patternResult = this.checkPatternDangers(toolDefinition, invocation);
      if (patternResult.isDangerous) {
        return patternResult;
      }
    }

    // Not dangerous
    return { isDangerous: false };
  }

  /**
   * Handles tools marked as dangerous in their definition
   */
  private handleToolDefinitionDangerous(
    toolDefinition: ToolDefinition,
    invocation: ToolInvocation
  ): DangerousOperationResult {
    const severity = this.determineSeverityFromTool(toolDefinition);
    const confirmation = this.createConfirmationRequirements(
      severity,
      `The ${toolDefinition.name} tool is marked as dangerous`,
      toolDefinition.description
    );

    return {
      isDangerous: true,
      severity,
      reason: `Tool "${toolDefinition.name}" is marked as dangerous in its definition`,
      category: 'tool_definition',
      confirmation,
    };
  }

  /**
   * Checks for pattern-based dangerous operations
   */
  private checkPatternDangers(
    toolDefinition: ToolDefinition,
    invocation: ToolInvocation
  ): DangerousOperationResult {
    // Check shell command blocklist for Bash tool
    if (toolDefinition.name === 'Bash') {
      return this.checkBashCommandDangers(invocation);
    }

    // Check filesystem patterns
    if (this.config.useFilesystemPatterns && this.isFilesystemTool(toolDefinition.name)) {
      const fsResult = this.checkFilesystemPatterns(invocation);
      if (fsResult.isDangerous) {
        return fsResult;
      }
    }

    // Check network patterns
    if (this.config.useNetworkPatterns && this.isNetworkTool(toolDefinition.name)) {
      const networkResult = this.checkNetworkPatterns(invocation);
      if (networkResult.isDangerous) {
        return networkResult;
      }
    }

    // Check custom patterns
    if (this.config.customPatterns) {
      const customResult = this.checkCustomPatterns(toolDefinition, invocation);
      if (customResult.isDangerous) {
        return customResult;
      }
    }

    return { isDangerous: false };
  }

  /**
   * Checks Bash commands against the existing blocklist
   */
  private checkBashCommandDangers(invocation: ToolInvocation): DangerousOperationResult {
    const command = invocation.parameters?.command as string;
    if (!command) {
      return { isDangerous: false };
    }

    const blocklistResult = checkCommandBlocklist(command);
    if (!blocklistResult.allowed) {
      return {
        isDangerous: true,
        severity: 'critical', // Blocklist commands are always critical
        reason: blocklistResult.blockedReason || 'Command matches dangerous pattern',
        category: blocklistResult.violatedRule?.split(':')[0] || 'blocklist',
        confirmation: this.createConfirmationRequirements(
          'critical',
          blocklistResult.blockedReason || 'Dangerous command detected',
          `Command: ${command}`
        ),
        matchedPattern: blocklistResult.violatedRule,
      };
    }

    return { isDangerous: false };
  }

  /**
   * Checks filesystem operations for dangerous patterns
   */
  private checkFilesystemPatterns(invocation: ToolInvocation): DangerousOperationResult {
    const filePath = invocation.parameters?.file_path as string ||
                    invocation.parameters?.path as string;

    if (!filePath) {
      return { isDangerous: false };
    }

    return this.checkPatternsAgainstValue(FILESYSTEM_DANGEROUS_PATTERNS, filePath);
  }

  /**
   * Checks network operations for dangerous patterns
   */
  private checkNetworkPatterns(invocation: ToolInvocation): DangerousOperationResult {
    const url = invocation.parameters?.url as string;
    if (!url) {
      return { isDangerous: false };
    }

    return this.checkPatternsAgainstValue(NETWORK_DANGEROUS_PATTERNS, url);
  }

  /**
   * Checks custom patterns against the invocation
   */
  private checkCustomPatterns(
    toolDefinition: ToolDefinition,
    invocation: ToolInvocation
  ): DangerousOperationResult {
    const customPatterns = this.config.customPatterns?.filter(pattern =>
      !pattern.applicableTools || pattern.applicableTools.includes(toolDefinition.name)
    ) || [];

    // Check against all parameter values
    const allValues = Object.values(invocation.parameters || {})
      .filter(v => typeof v === 'string')
      .join(' ');

    return this.checkPatternsAgainstValue(customPatterns, allValues);
  }

  /**
   * Checks an array of patterns against a value
   */
  private checkPatternsAgainstValue(
    patterns: DangerousPattern[],
    value: string
  ): DangerousOperationResult {
    for (const pattern of patterns) {
      const regex = pattern.pattern instanceof RegExp
        ? pattern.pattern
        : new RegExp(pattern.pattern);

      if (regex.test(value)) {
        return {
          isDangerous: true,
          severity: pattern.severity,
          reason: pattern.description,
          category: pattern.category,
          confirmation: this.createConfirmationRequirements(
            pattern.severity,
            pattern.description,
            `Matched value: ${value}`
          ),
          matchedPattern: pattern.pattern.toString(),
        };
      }
    }

    return { isDangerous: false };
  }

  /**
   * Determines severity level based on tool definition
   */
  private determineSeverityFromTool(toolDefinition: ToolDefinition): DangerousSeverity {
    // Check tool category and permissions to determine severity
    if (toolDefinition.permissions?.includes('admin')) {
      return 'critical';
    }
    if (toolDefinition.permissions?.includes('execute')) {
      return 'high';
    }
    if (toolDefinition.permissions?.includes('write')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Creates confirmation requirements based on severity
   */
  private createConfirmationRequirements(
    severity: DangerousSeverity,
    message: string,
    context?: string
  ): ConfirmationRequirements {
    switch (severity) {
      case 'critical':
        return {
          required: true,
          type: 'elevated',
          message: `⚠️  CRITICAL RISK: ${message}`,
          context,
          alternatives: [
            'Review the operation carefully before proceeding',
            'Consider using a less risky alternative',
            'Ensure you have proper backups',
          ],
        };
      case 'high':
        return {
          required: true,
          type: 'detailed',
          message: `⚠️  HIGH RISK: ${message}`,
          context,
          alternatives: [
            'Double-check the parameters',
            'Consider the potential impact',
          ],
        };
      case 'medium':
        return {
          required: true,
          type: 'simple',
          message: `⚠️  MODERATE RISK: ${message}`,
          context,
        };
      case 'low':
        return {
          required: false,
          type: 'simple',
          message: `ℹ️  LOW RISK: ${message}`,
          context,
        };
    }
  }

  /**
   * Checks if a tool is a filesystem-related tool
   */
  private isFilesystemTool(toolName: string): boolean {
    return ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob'].includes(toolName);
  }

  /**
   * Checks if a tool is a network-related tool
   */
  private isNetworkTool(toolName: string): boolean {
    return ['WebFetch', 'WebSearch'].includes(toolName);
  }

  /**
   * Gets all available danger categories
   */
  public getDangerCategories(): string[] {
    const categories = new Set<string>();

    // Add blocklist categories
    Object.keys(COMMAND_BLOCKLIST).forEach(cat => categories.add(cat));

    // Add filesystem categories
    FILESYSTEM_DANGEROUS_PATTERNS.forEach(p => categories.add(p.category));

    // Add network categories
    NETWORK_DANGEROUS_PATTERNS.forEach(p => categories.add(p.category));

    // Add custom categories
    this.config.customPatterns?.forEach(p => categories.add(p.category));

    return Array.from(categories);
  }

  /**
   * Gets patterns for a specific category
   */
  public getPatternsForCategory(category: string): DangerousPattern[] {
    const patterns: DangerousPattern[] = [];

    // Add filesystem patterns
    patterns.push(...FILESYSTEM_DANGEROUS_PATTERNS.filter(p => p.category === category));

    // Add network patterns
    patterns.push(...NETWORK_DANGEROUS_PATTERNS.filter(p => p.category === category));

    // Add custom patterns
    if (this.config.customPatterns) {
      patterns.push(...this.config.customPatterns.filter(p => p.category === category));
    }

    return patterns;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a default dangerous operation detector instance
 */
export function createDefaultDetector(): DangerousOperationDetector {
  return new DangerousOperationDetector();
}

/**
 * Quick check if a tool invocation is dangerous using default configuration
 */
export function isOperationDangerous(
  toolDefinition: ToolDefinition,
  invocation: ToolInvocation
): boolean {
  const detector = createDefaultDetector();
  const result = detector.detectDangerousOperation(toolDefinition, invocation);
  return result.isDangerous;
}

/**
 * Gets confirmation requirements for a tool invocation
 */
export function getConfirmationRequirements(
  toolDefinition: ToolDefinition,
  invocation: ToolInvocation
): ConfirmationRequirements | null {
  const detector = createDefaultDetector();
  const result = detector.detectDangerousOperation(toolDefinition, invocation);
  return result.confirmation || null;
}