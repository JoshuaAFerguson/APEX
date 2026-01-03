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
import { EventEmitter } from 'eventemitter3';
import type {
  PolicyConfig,
  PolicyViolation,
  PolicyViolationEvent,
  PolicyValidationResult as CorePolicyValidationResult,
  PolicyEvaluationResult,
  AllowedPathsConfig,
  PolicyEnforcementMode,
  Task,
  ApprovalRule,
  ApprovalCondition,
  ApprovalUrgency,
  ApprovalOperationType,
} from '@apexcli/core';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Policy validation result with rule details
 * Matches LegacyPolicyValidationResult from core for PolicyEvaluationResult
 */
export interface PolicyValidationResult {
  /** Whether the validation passed */
  passed: boolean;
  /** Rule identifier */
  ruleId: string;
  /** Human-readable rule name */
  ruleName: string;
  /** Type of rule */
  ruleType: 'path' | 'test' | 'approval';
  /** Validation message */
  message: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
  /** Additional details about the validation */
  details?: Record<string, unknown>;
}

/**
 * Events emitted by the PolicyEnforcer
 */
export interface PolicyEnforcerEvents {
  /** Emitted when a policy violation is detected */
  'policy:violation': (event: PolicyViolationEvent) => void;
}

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

/**
 * Context for approval requirement checking
 */
export interface ApprovalCheckContext {
  /** File paths being accessed or modified */
  filePaths?: string[];
  /** Content of files (for content-pattern matching) */
  fileContents?: Map<string, string>;
  /** Current operation being performed */
  operation?: ApprovalOperationType;
  /** Estimated cost in USD */
  estimatedCost?: number;
  /** Token usage */
  tokenUsage?: number;
  /** Custom context variables for expression evaluation */
  customContext?: Record<string, unknown>;
}

/**
 * Result of approval requirement checking
 */
export interface ApprovalRequirement {
  /** Whether approval is required */
  required: boolean;
  /** Rules that triggered the requirement (sorted by priority) */
  triggeredRules: ApprovalRule[];
  /** Urgency level (highest among triggered rules) */
  urgency: ApprovalUrgency;
  /** Timeout in minutes (shortest among triggered rules for safety) */
  timeoutMinutes: number;
  /** Required approvers (union of all triggered rules) */
  requiredApprovers: string[];
  /** Minimum approvals needed (maximum among triggered rules) */
  minApprovals: number;
  /** Timeout action (most restrictive among triggered rules) */
  timeoutAction: 'reject' | 'approve' | 'escalate';
  /** Human-readable summary of why approval is needed */
  reason: string;
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
 * - Real-time event emission for policy violations
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
 * // Listen for policy violations
 * enforcer.on('policy:violation', (event) => {
 *   console.log('Policy violation detected:', event.violation.message);
 * });
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
export class PolicyEnforcer extends EventEmitter<PolicyEnforcerEvents> {
  private readonly config: PolicyConfig;

  /**
   * Creates a new PolicyEnforcer instance.
   *
   * @param config - The policy configuration to enforce
   */
  constructor(config: PolicyConfig) {
    super();
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
   * Emits 'policy:violation' events for each violation detected.
   *
   * @param filePath - The file path to validate
   * @param context - Optional context for event emission
   * @returns Array of PolicyViolation objects (empty if path is allowed)
   */
  validateFilePath(
    filePath: string,
    context: {
      taskId?: string;
      agentId?: string;
      workflowId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): PolicyViolation[] {
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
      const violation = this.createViolation({
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
      });
      violations.push(violation);

      // Emit policy violation event
      const violationEvent = this.createViolationEvent(violation, context);
      this.emit('policy:violation', violationEvent);
    }

    // Also check for sensitive patterns (even if path is otherwise allowed)
    if (validationResult.allowed && validationResult.isSensitive) {
      const sensitiveViolation = this.createViolation({
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
      });
      violations.push(sensitiveViolation);

      // Emit policy violation event for sensitive file
      const sensitiveViolationEvent = this.createViolationEvent(sensitiveViolation, context);
      this.emit('policy:violation', sensitiveViolationEvent);
    }

    return violations;
  }

  /**
   * Checks if human approval is required for a task/action combination.
   *
   * Evaluates all enabled approval rules against the task and context to determine
   * if human intervention is needed before proceeding. Rules are evaluated in
   * priority order, and results are aggregated using conservative defaults.
   *
   * @param task - The task being executed
   * @param action - The action being performed (e.g., 'deploy', 'delete', 'create')
   * @param context - Additional context for rule evaluation
   * @returns Consolidated approval requirements from all triggered rules
   */
  checkApprovalRequired(
    task: Task,
    action: string,
    context: ApprovalCheckContext = {}
  ): ApprovalRequirement {
    // If policy is disabled or no approval rules configured, no approval needed
    if (!this.isEnabled || !this.config.approvalRules?.enabled) {
      return {
        required: false,
        triggeredRules: [],
        urgency: 'normal',
        timeoutMinutes: 60,
        requiredApprovers: [],
        minApprovals: 1,
        timeoutAction: 'reject',
        reason: 'No approval rules configured or policy disabled',
      };
    }

    const approvalRules = this.config.approvalRules.rules || [];

    // Filter enabled rules and sort by priority (higher first)
    const enabledRules = approvalRules
      .filter(rule => rule.enabled !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Evaluate rules to find which ones trigger
    const triggeredRules: ApprovalRule[] = [];

    for (const rule of enabledRules) {
      if (this.evaluateRule(rule, task, action, context)) {
        triggeredRules.push(rule);
      }
    }

    // If no rules triggered, no approval needed
    if (triggeredRules.length === 0) {
      return {
        required: false,
        triggeredRules: [],
        urgency: 'normal',
        timeoutMinutes: 60,
        requiredApprovers: [],
        minApprovals: 1,
        timeoutAction: 'reject',
        reason: 'No approval rules matched',
      };
    }

    // Aggregate results from all triggered rules
    return this.aggregateApprovalRequirements(triggeredRules);
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
      rule: opts.ruleId ?? 'path-validation',
      policyType: 'path',
      severity,
      message: opts.message,
      blocking: this.enforcementMode === 'strict',
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
   * Creates a PolicyViolationEvent for event emission.
   *
   * @param violation - The policy violation that triggered the event
   * @param context - Optional context for task, agent, and workflow IDs
   * @returns A fully populated PolicyViolationEvent object
   */
  protected createViolationEvent(
    violation: PolicyViolation,
    context: {
      taskId?: string;
      agentId?: string;
      workflowId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): PolicyViolationEvent {
    return {
      type: 'policy_violation',
      id: randomUUID(),
      timestamp: new Date(),
      violation,
      taskId: context.taskId,
      agentId: context.agentId,
      workflowId: context.workflowId,
      metadata: context.metadata,
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
   * Evaluates whether an approval rule should trigger based on task and context.
   */
  private evaluateRule(
    rule: ApprovalRule,
    task: Task,
    action: string,
    context: ApprovalCheckContext
  ): boolean {
    const conditions = rule.conditions;

    if (rule.requireAllConditions) {
      // AND logic: ALL conditions must match
      return conditions.every(condition => this.evaluateCondition(condition, task, action, context));
    } else {
      // OR logic: ANY condition triggers (default)
      return conditions.some(condition => this.evaluateCondition(condition, task, action, context));
    }
  }

  /**
   * Evaluates a single approval condition.
   */
  private evaluateCondition(
    condition: ApprovalCondition,
    task: Task,
    action: string,
    context: ApprovalCheckContext
  ): boolean {
    switch (condition.type) {
      case 'file-pattern':
        return this.evaluateFilePatternCondition(condition, context);
      case 'content-pattern':
        return this.evaluateContentPatternCondition(condition, context);
      case 'operation':
        return this.evaluateOperationCondition(condition, action, context);
      case 'cost-threshold':
        return this.evaluateCostThresholdCondition(condition, task, context);
      case 'token-threshold':
        return this.evaluateTokenThresholdCondition(condition, task, context);
      case 'custom':
        return this.evaluateCustomCondition(condition, task, action, context);
      default:
        // Unknown condition type - treat as non-matching for safety
        return false;
    }
  }

  /**
   * Aggregates multiple triggered rules into a single requirement.
   */
  private aggregateApprovalRequirements(triggeredRules: ApprovalRule[]): ApprovalRequirement {
    if (triggeredRules.length === 0) {
      return {
        required: false,
        triggeredRules: [],
        urgency: 'normal',
        timeoutMinutes: 60,
        requiredApprovers: [],
        minApprovals: 1,
        timeoutAction: 'reject',
        reason: 'No rules triggered',
      };
    }

    // Calculate aggregated values
    const urgency = this.getHighestUrgency(triggeredRules);
    const timeoutMinutes = this.getShortestTimeout(triggeredRules, urgency);
    const requiredApprovers = this.getUnionOfApprovers(triggeredRules);
    const minApprovals = this.getMaximumApprovals(triggeredRules);
    const timeoutAction = this.getMostRestrictiveTimeoutAction(triggeredRules);
    const reason = this.buildApprovalReason(triggeredRules);

    return {
      required: true,
      triggeredRules,
      urgency,
      timeoutMinutes,
      requiredApprovers,
      minApprovals,
      timeoutAction,
      reason,
    };
  }

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
   * Returns PolicySeverity: 'low' | 'medium' | 'high' | 'critical'
   */
  private getSeverityFromEnforcement(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.enforcementMode) {
      case 'strict':
        return 'critical';
      case 'warn':
        return 'high';
      case 'audit':
        return 'low';
      default:
        return 'medium';
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

  // ============================================================================
  // Approval Condition Evaluation Methods
  // ============================================================================

  /**
   * Evaluates file pattern conditions against context file paths.
   */
  private evaluateFilePatternCondition(
    condition: ApprovalCondition,
    context: ApprovalCheckContext
  ): boolean {
    const patterns = condition.patterns || [];
    const filePaths = context.filePaths || [];

    // If no patterns defined or no files to check, condition doesn't match
    if (patterns.length === 0 || filePaths.length === 0) {
      return false;
    }

    // Check if any file matches any pattern
    return filePaths.some(filePath => {
      const normalizedPath = this.normalizePath(filePath);
      return this.matchesPattern(normalizedPath, patterns) !== undefined;
    });
  }

  /**
   * Evaluates content pattern conditions against file contents.
   */
  private evaluateContentPatternCondition(
    condition: ApprovalCondition,
    context: ApprovalCheckContext
  ): boolean {
    const patterns = condition.patterns || [];
    const fileContents = context.fileContents || new Map();

    // If no patterns defined or no content to check, condition doesn't match
    if (patterns.length === 0 || fileContents.size === 0) {
      return false;
    }

    // Check if any file content matches any regex pattern
    for (const [filePath, content] of fileContents.entries()) {
      for (const pattern of patterns) {
        try {
          const regex = new RegExp(pattern, 'i'); // Case-insensitive by default
          if (regex.test(content)) {
            return true;
          }
        } catch {
          // Invalid regex - skip this pattern for safety
          continue;
        }
      }
    }

    return false;
  }

  /**
   * Evaluates operation conditions against the action and context.
   */
  private evaluateOperationCondition(
    condition: ApprovalCondition,
    action: string,
    context: ApprovalCheckContext
  ): boolean {
    const operations = condition.operations || [];

    // If no operations defined, condition doesn't match
    if (operations.length === 0) {
      return false;
    }

    // Check action against operations list
    const actionLower = action.toLowerCase();
    const operationMatched = operations.some(op =>
      op.toLowerCase() === actionLower
    );

    if (operationMatched) {
      return true;
    }

    // Also check context.operation if provided
    if (context.operation) {
      return operations.includes(context.operation);
    }

    return false;
  }

  /**
   * Evaluates cost threshold conditions.
   */
  private evaluateCostThresholdCondition(
    condition: ApprovalCondition,
    task: Task,
    context: ApprovalCheckContext
  ): boolean {
    const threshold = condition.threshold;

    // If no threshold defined, condition doesn't match
    if (threshold === undefined || threshold <= 0) {
      return false;
    }

    // Check context cost first, then task cost
    const estimatedCost = context.estimatedCost ?? task.usage.estimatedCost;
    return estimatedCost > threshold;
  }

  /**
   * Evaluates token threshold conditions.
   */
  private evaluateTokenThresholdCondition(
    condition: ApprovalCondition,
    task: Task,
    context: ApprovalCheckContext
  ): boolean {
    const threshold = condition.threshold;

    // If no threshold defined, condition doesn't match
    if (threshold === undefined || threshold <= 0) {
      return false;
    }

    // Check context tokens first, then task tokens
    const tokenUsage = context.tokenUsage ?? task.usage.totalTokens;
    return tokenUsage > threshold;
  }

  /**
   * Evaluates custom expression conditions.
   * Note: This is a simplified implementation. A production system would
   * use a sandboxed expression evaluator.
   */
  private evaluateCustomCondition(
    condition: ApprovalCondition,
    task: Task,
    action: string,
    context: ApprovalCheckContext
  ): boolean {
    const expression = condition.expression;

    // If no expression defined, condition doesn't match
    if (!expression) {
      return false;
    }

    try {
      // Create evaluation context with available variables
      const evalContext = {
        cost: context.estimatedCost ?? task.usage.estimatedCost,
        tokens: context.tokenUsage ?? task.usage.totalTokens,
        files: (context.filePaths || []).join(','),
        operation: action,
        task_priority: task.priority,
        task_effort: task.effort,
        task_workflow: task.workflow,
        ...context.customContext,
      };

      // Simple string interpolation for basic expressions
      // In production, use a proper expression evaluator
      let evaluatedExpression = expression;
      for (const [key, value] of Object.entries(evalContext)) {
        const placeholder = `{${key}}`;
        evaluatedExpression = evaluatedExpression.replace(
          new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
          String(value)
        );
      }

      // For now, just check for basic numeric comparisons
      // This is a very basic implementation - production would use a proper parser
      return this.evaluateSimpleExpression(evaluatedExpression, evalContext);
    } catch {
      // If evaluation fails, condition doesn't match for safety
      return false;
    }
  }

  // ============================================================================
  // Approval Aggregation Helper Methods
  // ============================================================================

  /**
   * Gets the highest urgency level among triggered rules.
   */
  private getHighestUrgency(rules: ApprovalRule[]): ApprovalUrgency {
    const urgencyOrder: Record<ApprovalUrgency, number> = {
      low: 0,
      normal: 1,
      high: 2,
      critical: 3,
    };

    let highestUrgency: ApprovalUrgency = 'normal';
    let highestLevel = urgencyOrder[highestUrgency];

    for (const rule of rules) {
      const ruleUrgency = rule.urgency || 'normal';
      const ruleLevel = urgencyOrder[ruleUrgency];
      if (ruleLevel > highestLevel) {
        highestUrgency = ruleUrgency;
        highestLevel = ruleLevel;
      }
    }

    return highestUrgency;
  }

  /**
   * Gets the shortest timeout among triggered rules for safety.
   */
  private getShortestTimeout(rules: ApprovalRule[], urgency: ApprovalUrgency): number {
    // Default timeouts by urgency
    const defaultTimeouts: Record<ApprovalUrgency, number> = {
      low: 1440,  // 24 hours
      normal: 60, // 1 hour
      high: 15,   // 15 minutes
      critical: 5, // 5 minutes
    };

    let shortestTimeout = defaultTimeouts[urgency];

    for (const rule of rules) {
      const ruleTimeout = rule.timeoutMinutes || defaultTimeouts[rule.urgency || 'normal'];
      if (ruleTimeout < shortestTimeout) {
        shortestTimeout = ruleTimeout;
      }
    }

    return shortestTimeout;
  }

  /**
   * Gets the union of all required approvers from triggered rules.
   */
  private getUnionOfApprovers(rules: ApprovalRule[]): string[] {
    const approvers = new Set<string>();

    for (const rule of rules) {
      if (rule.approvers) {
        rule.approvers.forEach(approver => approvers.add(approver));
      }
    }

    return Array.from(approvers);
  }

  /**
   * Gets the maximum number of approvals required among triggered rules.
   */
  private getMaximumApprovals(rules: ApprovalRule[]): number {
    let maxApprovals = 1;

    for (const rule of rules) {
      const ruleMinApprovals = rule.minApprovals || 1;
      if (ruleMinApprovals > maxApprovals) {
        maxApprovals = ruleMinApprovals;
      }
    }

    return maxApprovals;
  }

  /**
   * Gets the most restrictive timeout action among triggered rules.
   */
  private getMostRestrictiveTimeoutAction(rules: ApprovalRule[]): 'reject' | 'approve' | 'escalate' {
    const actionOrder: Record<'reject' | 'approve' | 'escalate', number> = {
      approve: 0,
      escalate: 1,
      reject: 2,
    };

    let mostRestrictiveAction: 'reject' | 'approve' | 'escalate' = 'reject';
    let mostRestrictiveLevel = actionOrder[mostRestrictiveAction];

    for (const rule of rules) {
      const ruleAction = rule.timeoutAction || 'reject';
      const ruleLevel = actionOrder[ruleAction];
      if (ruleLevel > mostRestrictiveLevel) {
        mostRestrictiveAction = ruleAction;
        mostRestrictiveLevel = ruleLevel;
      }
    }

    return mostRestrictiveAction;
  }

  /**
   * Builds a human-readable reason for why approval is required.
   */
  private buildApprovalReason(rules: ApprovalRule[]): string {
    if (rules.length === 0) {
      return 'No approval rules triggered';
    }

    if (rules.length === 1) {
      const rule = rules[0];
      return rule.description || rule.name || `Rule '${rule.id}' requires approval`;
    }

    const ruleNames = rules.map(rule => rule.name || rule.id).join(', ');
    return `Multiple approval rules triggered: ${ruleNames}`;
  }

  /**
   * Evaluates a simple expression (basic implementation).
   * This is a minimal implementation for demonstration.
   * Production systems should use a proper expression evaluator.
   */
  private evaluateSimpleExpression(expression: string, context: Record<string, unknown>): boolean {
    // Very basic implementation - just handle simple numeric comparisons
    const numericComparison = /^(\d+(?:\.\d+)?)\s*([><=]+)\s*(\d+(?:\.\d+)?)$/.exec(expression.trim());
    if (numericComparison) {
      const [, left, operator, right] = numericComparison;
      const leftValue = parseFloat(left);
      const rightValue = parseFloat(right);

      switch (operator) {
        case '>':
          return leftValue > rightValue;
        case '>=':
          return leftValue >= rightValue;
        case '<':
          return leftValue < rightValue;
        case '<=':
          return leftValue <= rightValue;
        case '==':
        case '=':
          return leftValue === rightValue;
        default:
          return false;
      }
    }

    // For now, if we can't parse it, return false for safety
    return false;
  }

  // ============================================================================
  // Task Start Policy Checking
  // ============================================================================

  /**
   * Checks if a task can start based on policy evaluation.
   *
   * Evaluates all policy rules (path validation, approval requirements, etc.)
   * against the task to determine if it should be allowed to start or if
   * violations should block/warn about the task execution.
   *
   * @param task - The task to evaluate
   * @param context - Optional context for evaluation
   * @returns Policy evaluation result with violations and approval requirements
   */
  checkTaskStart(
    task: Task,
    context: {
      /** File paths that the task will access */
      projectPaths?: string[];
      /** Estimated task operation type */
      operationType?: string;
      /** Additional context for rule evaluation */
      metadata?: Record<string, unknown>;
    } = {}
  ): PolicyEvaluationResult {
    // If policy is disabled, allow task to start
    if (!this.isEnabled) {
      return {
        passed: true,
        passedCount: 0,
        failedCount: 0,
        warningCount: 0,
        results: [],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: this.config.name,
      };
    }

    const results: PolicyValidationResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;
    let requiresApproval = false;
    const triggeredApprovalRules: string[] = [];

    // 1. Evaluate path validation rules
    if (context.projectPaths) {
      for (const filePath of context.projectPaths) {
        const pathViolations = this.validateFilePath(filePath, {
          taskId: task.id,
          workflowId: task.workflow,
          metadata: context.metadata,
        });

        for (const violation of pathViolations) {
          // Map policy severity to result severity
          const mappedSeverity: 'info' | 'warning' | 'error' =
            violation.severity === 'critical' ? 'error' :
            violation.severity === 'high' ? 'warning' : 'info';

          const result: PolicyValidationResult = {
            passed: false,
            ruleId: violation.rule,
            ruleName: 'File Path Access',
            ruleType: 'path',
            message: violation.message,
            severity: mappedSeverity,
            details: {
              filePath,
              violationType: violation.policyType,
              context: violation.context,
            },
          };

          results.push(result);

          if (result.severity === 'error') {
            failedCount++;
          } else if (result.severity === 'warning') {
            warningCount++;
          }

          // Check if this is a sensitive path requiring approval
          if (violation.context?.requiresApproval) {
            requiresApproval = true;
            triggeredApprovalRules.push(`sensitive-path-${violation.rule}`);
          }
        }
      }
    }

    // 2. Evaluate approval requirements
    const approvalReq = this.checkApprovalRequired(
      task,
      context.operationType || 'task-start',
      {
        filePaths: context.projectPaths,
        operation: context.operationType as any,
        estimatedCost: task.usage.estimatedCost,
        tokenUsage: task.usage.totalTokens,
        customContext: context.metadata,
      }
    );

    if (approvalReq.required) {
      requiresApproval = true;
      triggeredApprovalRules.push(...approvalReq.triggeredRules.map(rule => rule.id));

      const approvalResult: PolicyValidationResult = {
        passed: false,
        ruleId: 'approval-required',
        ruleName: 'Human Approval Required',
        ruleType: 'approval',
        message: approvalReq.reason,
        severity: this.getApprovalSeverity(approvalReq.urgency),
        details: {
          urgency: approvalReq.urgency,
          timeoutMinutes: approvalReq.timeoutMinutes,
          requiredApprovers: approvalReq.requiredApprovers,
          minApprovals: approvalReq.minApprovals,
          triggeredRules: approvalReq.triggeredRules.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
          })),
        },
      };

      results.push(approvalResult);

      if (approvalResult.severity === 'error') {
        failedCount++;
      } else if (approvalResult.severity === 'warning') {
        warningCount++;
      }
    }

    // 3. Evaluate task-specific policy rules based on task properties
    const taskPolicyResults = this.evaluateTaskPolicies(task, context);
    results.push(...taskPolicyResults);

    // Update counts for task policy results
    for (const result of taskPolicyResults) {
      if (result.passed) {
        passedCount++;
      } else if (result.severity === 'error') {
        failedCount++;
      } else if (result.severity === 'warning') {
        warningCount++;
      }
    }

    // Determine overall pass/fail based on enforcement mode
    const hasErrors = failedCount > 0;
    const hasWarnings = warningCount > 0;

    let passed: boolean;
    switch (this.enforcementMode) {
      case 'strict':
        passed = !hasErrors && !hasWarnings;
        break;
      case 'warn':
        passed = !hasErrors;
        break;
      case 'audit':
      case 'disabled':
        passed = true;
        break;
      default:
        passed = !hasErrors;
    }

    return {
      passed,
      passedCount,
      failedCount,
      warningCount,
      results,
      requiresApproval,
      triggeredApprovalRules,
      evaluatedAt: new Date(),
      policyName: this.config.name,
    };
  }

  /**
   * Evaluates task-specific policies based on task properties.
   *
   * @param task - The task to evaluate
   * @param context - Additional context for evaluation
   * @returns Array of policy validation results
   */
  private evaluateTaskPolicies(
    task: Task,
    context: { metadata?: Record<string, unknown> } = {}
  ): PolicyValidationResult[] {
    const results: PolicyValidationResult[] = [];

    // Check for high-risk task characteristics
    if (task.priority === 'urgent') {
      results.push({
        passed: false,
        ruleId: 'urgent-task-review',
        ruleName: 'Urgent Task Review',
        ruleType: 'approval',
        message: 'Urgent priority tasks require additional oversight',
        severity: 'warning',
        details: {
          taskPriority: task.priority,
          taskWorkflow: task.workflow,
          taskEffort: task.effort,
        },
      });
    }

    // Check for large effort tasks
    if (task.effort === 'large' || task.effort === 'xl') {
      results.push({
        passed: false,
        ruleId: 'large-effort-review',
        ruleName: 'Large Effort Task Review',
        ruleType: 'approval',
        message: `Tasks with ${task.effort} effort require review due to potential impact`,
        severity: 'info',
        details: {
          taskEffort: task.effort,
          taskWorkflow: task.workflow,
          estimatedCost: task.usage.estimatedCost,
        },
      });
    }

    // Check for high-cost tasks
    if (task.usage.estimatedCost > 10.0) {
      results.push({
        passed: false,
        ruleId: 'high-cost-review',
        ruleName: 'High Cost Task Review',
        ruleType: 'approval',
        message: `Tasks with estimated cost over $10 require approval (current: $${task.usage.estimatedCost.toFixed(2)})`,
        severity: 'warning',
        details: {
          estimatedCost: task.usage.estimatedCost,
          costThreshold: 10.0,
          taskId: task.id,
        },
      });
    }

    // Check for production-related workflows
    const productionWorkflows = ['deploy', 'release', 'production'];
    if (productionWorkflows.some(wf => task.workflow.toLowerCase().includes(wf))) {
      results.push({
        passed: false,
        ruleId: 'production-deployment',
        ruleName: 'Production Deployment Review',
        ruleType: 'approval',
        message: 'Production-related workflows require mandatory approval',
        severity: 'error',
        details: {
          workflow: task.workflow,
          detectedKeywords: productionWorkflows.filter(wf =>
            task.workflow.toLowerCase().includes(wf)
          ),
        },
      });
    }

    return results;
  }

  /**
   * Maps approval urgency to severity level.
   */
  private getApprovalSeverity(urgency: ApprovalUrgency): 'info' | 'warning' | 'error' {
    switch (urgency) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'normal':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'warning';
    }
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
    tags: [],
    ...config,
  };

  return new PolicyEnforcer(defaultConfig);
}
