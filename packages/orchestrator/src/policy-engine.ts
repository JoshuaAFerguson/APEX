/**
 * @fileoverview PolicyEngine class for rule evaluation and policy enforcement
 *
 * The PolicyEngine class provides comprehensive rule evaluation capabilities
 * for agent actions, loading rules from configuration and returning detailed
 * policy violation results with severity levels.
 *
 * @module @apex/orchestrator/policy-engine
 */

import { minimatch } from 'minimatch';
import { randomUUID } from 'node:crypto';
import type {
  PolicyConfig,
  PolicyViolation,
  PolicyValidationResult,
  AllowedPathsConfig,
  ApprovalRule,
  ApprovalCondition,
  ApprovalOperationType,
  ToolAction,
  AgentDefinition,
  ApexConfig,
  PolicyEngine as IPolicyEngine,
  Policy,
  PolicyCheckContext,
  PolicyCheckOptions,
  PolicyCheckResult,
  PolicyEnforcementMode
} from '@apexcli/core';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Agent action context for policy evaluation
 */
export interface AgentActionContext {
  /** The agent performing the action */
  agentId: string;
  /** Type of action being performed */
  actionType: string;
  /** Tool being used for the action */
  toolName: string;
  /** Target resource (file path, command, etc.) */
  resource?: string;
  /** Action parameters */
  parameters?: Record<string, unknown>;
  /** Task context */
  taskId?: string;
  /** Workflow context */
  workflowId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Policy rule definition for evaluation
 */
export interface PolicyRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Rule type */
  type: 'path' | 'tool' | 'agent' | 'resource' | 'approval';
  /** Rule pattern or condition */
  pattern?: string;
  /** Whether rule allows or denies the action */
  action: 'allow' | 'deny' | 'require_approval';
  /** Severity level for violations */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Whether rule is enabled */
  enabled: boolean;
  /** Additional rule conditions */
  conditions?: Record<string, unknown>;
  /** Priority (higher number = higher priority) */
  priority: number;
}

/**
 * Policy evaluation result for an agent action
 */
export interface PolicyEvaluationResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** List of policy violations (if any) */
  violations: PolicyViolation[];
  /** Rules that were evaluated */
  evaluatedRules: PolicyRule[];
  /** Rules that matched the action */
  matchedRules: PolicyRule[];
  /** Overall severity of violations */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Human-readable evaluation summary */
  summary: string;
  /** Whether approval is required */
  requiresApproval: boolean;
}

/**
 * Rule loading configuration
 */
export interface RuleLoadingConfig {
  /** Load path rules from allowedPaths config */
  loadPathRules: boolean;
  /** Load approval rules from config */
  loadApprovalRules: boolean;
  /** Load tool restriction rules */
  loadToolRules: boolean;
  /** Load custom rules from policies array */
  loadCustomRules: boolean;
}

// ============================================================================
// PolicyEngine Implementation
// ============================================================================

/**
 * PolicyEngine class for comprehensive rule evaluation and policy enforcement.
 *
 * The PolicyEngine loads policy rules from configuration and evaluates agent
 * actions against those rules, returning detailed violation results with
 * severity levels. It supports multiple rule types including path, tool,
 * agent, and approval rules.
 *
 * ## Usage Example
 *
 * ```typescript
 * const config: ApexConfig = {
 *   policy: {
 *     enabled: true,
 *     enforcement: 'enforce',
 *     allowedPaths: {
 *       mode: 'allowlist',
 *       allow: ['src/**', 'tests/**'],
 *       block: ['src/secrets/**']
 *     }
 *   }
 * };
 *
 * const engine = new PolicyEngine(config);
 *
 * const actionContext: AgentActionContext = {
 *   agentId: 'developer',
 *   actionType: 'file_read',
 *   toolName: 'Read',
 *   resource: '/project/src/secrets/api-key.txt',
 *   taskId: 'task-123'
 * };
 *
 * const result = engine.evaluateAction(actionContext);
 * if (!result.allowed) {
 *   console.log('Policy violations:', result.violations);
 * }
 * ```
 */
export class PolicyEngine implements IPolicyEngine {
  private readonly config: ApexConfig;
  private readonly policyConfig: PolicyConfig;
  private readonly rules: PolicyRule[];
  private enforcementMode: PolicyEnforcementMode;
  private readonly policies: Map<string, Policy> = new Map();

  /**
   * Creates a new PolicyEngine instance.
   *
   * @param config - The APEX configuration containing policy settings
   * @param ruleLoadingConfig - Configuration for which rule types to load
   */
  constructor(
    config: ApexConfig,
    ruleLoadingConfig: RuleLoadingConfig = {
      loadPathRules: true,
      loadApprovalRules: true,
      loadToolRules: true,
      loadCustomRules: true
    }
  ) {
    this.config = config;
    this.policyConfig = config.policy || { enabled: false, enforcement: 'warn' };
    this.enforcementMode = this.policyConfig.enforcement || 'warn';
    this.rules = this.loadRulesFromConfig(ruleLoadingConfig);
  }

  /**
   * Check policies against the given context.
   *
   * @param context - The context describing the action to check
   * @param options - Optional configuration for this check
   * @returns A promise resolving to the policy check result
   */
  async checkPolicy(
    context: PolicyCheckContext,
    options?: PolicyCheckOptions
  ): Promise<PolicyCheckResult> {
    const startTime = Date.now();
    const enforcementMode = options?.enforcementMode || this.enforcementMode;

    // Convert new context format to legacy format for evaluation
    const agentActionContext: AgentActionContext = {
      agentId: context.agentId || 'unknown',
      actionType: context.action,
      toolName: context.toolName || context.action,
      resource: context.resource,
      parameters: context.toolArguments,
      taskId: context.taskId,
      workflowId: context.metadata?.workflowId as string,
      metadata: context.metadata,
    };

    // Use existing evaluation logic
    const legacyResult = this.evaluateAction(agentActionContext);

    // Convert legacy result to new format
    const violations: PolicyViolation[] = legacyResult.violations.map(violation => ({
      id: violation.id,
      rule: violation.ruleId,
      message: violation.message,
      severity: violation.severity,
      blocking: violation.severity === 'error' || violation.severity === 'critical',
      policyType: violation.ruleType === 'path' ? 'path' :
                  violation.ruleType === 'approval' ? 'approval' :
                  violation.ruleType === 'tool' ? 'test' : 'path',
      description: violation.description,
      resource: violation.resource,
      context: violation.context,
      timestamp: violation.timestamp,
    }));

    // Apply enforcement mode logic
    let status: 'allow' | 'deny';
    switch (enforcementMode) {
      case 'strict':
        // Block on any violations
        status = violations.length > 0 ? 'deny' : 'allow';
        break;
      case 'warn':
        // Only block on critical/error violations
        status = violations.some(v => v.blocking) ? 'deny' : 'allow';
        break;
      case 'audit':
        // Log but don't block
        status = 'allow';
        break;
      case 'disabled':
        // Always allow
        return {
          status: 'allow',
          violations: [],
          enforcementMode,
          checkedAt: new Date(),
          policyName: this.policyConfig.name,
          policyId: 'policy-engine-config',
          rulesEvaluated: 0,
          rulesPassed: 0,
          rulesFailed: 0,
          durationMs: Date.now() - startTime,
          metadata: {
            disabled: true,
          },
        };
      default:
        status = legacyResult.allowed ? 'allow' : 'deny';
    }

    // Apply maxViolations limit if specified
    const limitedViolations = options?.maxViolations && options.maxViolations > 0
      ? violations.slice(0, options.maxViolations)
      : violations;

    return {
      status,
      violations: limitedViolations,
      enforcementMode,
      checkedAt: new Date(),
      policyName: this.policyConfig.name,
      policyId: 'policy-engine-config',
      rulesEvaluated: legacyResult.evaluatedRules.length,
      rulesPassed: legacyResult.evaluatedRules.length - legacyResult.matchedRules.length,
      rulesFailed: legacyResult.matchedRules.filter(rule => rule.action === 'deny').length,
      durationMs: Date.now() - startTime,
      metadata: {
        legacyEvaluation: true,
        matchedRulesCount: legacyResult.matchedRules.length,
        requiresApproval: legacyResult.requiresApproval,
      },
    };
  }

  /**
   * Get the current enforcement mode.
   */
  getEnforcementMode(): PolicyEnforcementMode {
    return this.enforcementMode;
  }

  /**
   * Set the default enforcement mode.
   */
  setEnforcementMode(mode: PolicyEnforcementMode): void {
    this.enforcementMode = mode;
  }

  /**
   * Register a policy for evaluation.
   */
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Unregister a policy.
   */
  unregisterPolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * Get all registered policies.
   */
  getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific policy by ID.
   */
  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Check if a specific policy is registered.
   */
  hasPolicy(policyId: string): boolean {
    return this.policies.has(policyId);
  }

  /**
   * Clear all registered policies.
   */
  clearPolicies(): void {
    this.policies.clear();
  }

  /**
   * Gets the current policy configuration.
   */
  get policyConfiguration(): PolicyConfig {
    return this.policyConfig;
  }

  /**
   * Gets all loaded policy rules.
   */
  get policyRules(): readonly PolicyRule[] {
    return [...this.rules];
  }

  /**
   * Checks if the policy engine is enabled.
   */
  get isEnabled(): boolean {
    return this.policyConfig.enabled !== false;
  }

  /**
   * Loads policy rules from the APEX configuration.
   *
   * @param loadingConfig - Configuration for which rule types to load
   * @returns Array of loaded policy rules
   */
  private loadRulesFromConfig(loadingConfig: RuleLoadingConfig): PolicyRule[] {
    const rules: PolicyRule[] = [];

    if (!this.policyConfig.enabled) {
      return rules;
    }

    // Load path rules from allowedPaths configuration
    if (loadingConfig.loadPathRules && this.policyConfig.allowedPaths) {
      rules.push(...this.loadPathRules(this.policyConfig.allowedPaths));
    }

    // Load approval rules
    if (loadingConfig.loadApprovalRules && this.policyConfig.approvalRules) {
      rules.push(...this.loadApprovalRules(this.policyConfig.approvalRules));
    }

    // Load tool rules from permissions
    if (loadingConfig.loadToolRules && this.config.permissions?.tools) {
      rules.push(...this.loadToolRules(this.config.permissions.tools));
    }

    // Load custom rules from policies array
    if (loadingConfig.loadCustomRules && this.config.policies) {
      rules.push(...this.loadCustomRules(this.config.policies));
    }

    // Sort rules by priority (highest first)
    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Loads path-based rules from allowedPaths configuration.
   */
  private loadPathRules(allowedPaths: AllowedPathsConfig): PolicyRule[] {
    const rules: PolicyRule[] = [];
    let ruleCounter = 1;

    // Block patterns (highest priority)
    if (allowedPaths.block) {
      for (const pattern of allowedPaths.block) {
        rules.push({
          id: `path-block-${ruleCounter++}`,
          name: `Block Path: ${pattern}`,
          description: `Blocks access to paths matching: ${pattern}`,
          type: 'path',
          pattern,
          action: 'deny',
          severity: 'error',
          enabled: true,
          priority: 100,
        });
      }
    }

    // Sensitive patterns (require approval)
    if (allowedPaths.sensitive) {
      for (const pattern of allowedPaths.sensitive) {
        rules.push({
          id: `path-sensitive-${ruleCounter++}`,
          name: `Sensitive Path: ${pattern}`,
          description: `Requires approval for paths matching: ${pattern}`,
          type: 'path',
          pattern,
          action: 'require_approval',
          severity: 'warning',
          enabled: true,
          priority: 90,
        });
      }
    }

    // Allow patterns (for allowlist mode)
    if (allowedPaths.mode === 'allowlist' && allowedPaths.allow) {
      for (const pattern of allowedPaths.allow) {
        rules.push({
          id: `path-allow-${ruleCounter++}`,
          name: `Allow Path: ${pattern}`,
          description: `Allows access to paths matching: ${pattern}`,
          type: 'path',
          pattern,
          action: 'allow',
          severity: 'info',
          enabled: true,
          priority: 50,
        });
      }

      // Add default deny rule for allowlist mode
      rules.push({
        id: 'path-default-deny',
        name: 'Default Deny (Allowlist Mode)',
        description: 'Denies access to paths not explicitly allowed in allowlist mode',
        type: 'path',
        pattern: '**',
        action: 'deny',
        severity: 'warning',
        enabled: true,
        priority: 1,
      });
    }

    return rules;
  }

  /**
   * Loads approval rules from configuration.
   */
  private loadApprovalRules(approvalRules: ApprovalRule[]): PolicyRule[] {
    return approvalRules.map((rule, index) => ({
      id: `approval-${index + 1}`,
      name: rule.name || `Approval Rule ${index + 1}`,
      description: rule.description,
      type: 'approval',
      action: 'require_approval',
      severity: this.mapUrgencyToSeverity(rule.urgency || 'medium'),
      enabled: rule.enabled !== false,
      priority: 80,
      conditions: {
        approvalRule: rule,
      },
    }));
  }

  /**
   * Loads tool restriction rules from permissions configuration.
   */
  private loadToolRules(toolsConfig: Record<string, unknown>): PolicyRule[] {
    const rules: PolicyRule[] = [];
    // This would load tool-specific restrictions based on permissions config
    // Implementation depends on the specific permissions schema
    return rules;
  }

  /**
   * Loads custom rules from policies array.
   */
  private loadCustomRules(policies: unknown[]): PolicyRule[] {
    const rules: PolicyRule[] = [];
    // This would parse custom policy definitions
    // Implementation depends on the specific policy schema
    return rules;
  }

  /**
   * Maps approval urgency to policy severity.
   */
  private mapUrgencyToSeverity(urgency: string): 'info' | 'warning' | 'error' | 'critical' {
    switch (urgency) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'critical';
      default: return 'warning';
    }
  }

  /**
   * Evaluates an agent action against all loaded policy rules.
   *
   * @param actionContext - Context about the agent action to evaluate
   * @returns Comprehensive evaluation result with violations and metadata
   */
  evaluateAction(actionContext: AgentActionContext): PolicyEvaluationResult {
    if (!this.isEnabled) {
      return {
        allowed: true,
        violations: [],
        evaluatedRules: [],
        matchedRules: [],
        severity: 'info',
        summary: 'Policy engine is disabled - all actions allowed',
        requiresApproval: false,
      };
    }

    const violations: PolicyViolation[] = [];
    const matchedRules: PolicyRule[] = [];
    const evaluatedRules = [...this.rules];
    let highestSeverity: 'info' | 'warning' | 'error' | 'critical' = 'info';
    let requiresApproval = false;

    // Evaluate each rule against the action
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      const ruleMatches = this.evaluateRuleMatch(rule, actionContext);
      if (ruleMatches) {
        matchedRules.push(rule);

        if (rule.action === 'deny') {
          const violation = this.createViolationFromRule(rule, actionContext);
          violations.push(violation);

          if (this.compareSeverity(rule.severity, highestSeverity) > 0) {
            highestSeverity = rule.severity;
          }
        } else if (rule.action === 'require_approval') {
          requiresApproval = true;
          const violation = this.createApprovalViolation(rule, actionContext);
          violations.push(violation);

          if (this.compareSeverity(rule.severity, highestSeverity) > 0) {
            highestSeverity = rule.severity;
          }
        }
        // 'allow' rules don't create violations but may prevent denial
      }
    }

    const allowed = violations.length === 0 || violations.every(v => v.severity !== 'error' && v.severity !== 'critical');
    const summary = this.generateEvaluationSummary(allowed, violations.length, matchedRules.length, requiresApproval);

    return {
      allowed,
      violations,
      evaluatedRules,
      matchedRules,
      severity: highestSeverity,
      summary,
      requiresApproval,
    };
  }

  /**
   * Evaluates whether a specific rule matches the given action context.
   */
  private evaluateRuleMatch(rule: PolicyRule, actionContext: AgentActionContext): boolean {
    switch (rule.type) {
      case 'path':
        return this.evaluatePathRule(rule, actionContext);
      case 'tool':
        return this.evaluateToolRule(rule, actionContext);
      case 'agent':
        return this.evaluateAgentRule(rule, actionContext);
      case 'approval':
        return this.evaluateApprovalRule(rule, actionContext);
      default:
        return false;
    }
  }

  /**
   * Evaluates a path-based rule against the action context.
   */
  private evaluatePathRule(rule: PolicyRule, actionContext: AgentActionContext): boolean {
    if (!actionContext.resource || !rule.pattern) {
      return false;
    }

    return minimatch(actionContext.resource, rule.pattern);
  }

  /**
   * Evaluates a tool-based rule against the action context.
   */
  private evaluateToolRule(rule: PolicyRule, actionContext: AgentActionContext): boolean {
    if (!rule.pattern) {
      return false;
    }

    return minimatch(actionContext.toolName, rule.pattern);
  }

  /**
   * Evaluates an agent-based rule against the action context.
   */
  private evaluateAgentRule(rule: PolicyRule, actionContext: AgentActionContext): boolean {
    if (!rule.pattern) {
      return false;
    }

    return minimatch(actionContext.agentId, rule.pattern);
  }

  /**
   * Evaluates an approval rule against the action context.
   */
  private evaluateApprovalRule(rule: PolicyRule, actionContext: AgentActionContext): boolean {
    const approvalRule = rule.conditions?.approvalRule as ApprovalRule;
    if (!approvalRule) {
      return false;
    }

    // Check if any condition matches
    return approvalRule.conditions?.some(condition =>
      this.evaluateApprovalCondition(condition, actionContext)
    ) ?? false;
  }

  /**
   * Evaluates an approval condition against the action context.
   */
  private evaluateApprovalCondition(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    // This would implement specific approval condition evaluation logic
    // Based on the condition type and actionContext
    return false; // Placeholder
  }

  /**
   * Creates a policy violation from a matched rule.
   */
  private createViolationFromRule(rule: PolicyRule, actionContext: AgentActionContext): PolicyViolation {
    return {
      id: randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      message: `Policy violation: ${rule.name}`,
      description: rule.description || `Action blocked by policy rule: ${rule.name}`,
      severity: rule.severity,
      resource: actionContext.resource || actionContext.toolName,
      context: {
        agentId: actionContext.agentId,
        toolName: actionContext.toolName,
        actionType: actionContext.actionType,
        taskId: actionContext.taskId,
        workflowId: actionContext.workflowId,
        rulePattern: rule.pattern,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Creates an approval violation for actions requiring approval.
   */
  private createApprovalViolation(rule: PolicyRule, actionContext: AgentActionContext): PolicyViolation {
    return {
      id: randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      message: `Approval required: ${rule.name}`,
      description: rule.description || `Action requires approval due to policy rule: ${rule.name}`,
      severity: rule.severity,
      resource: actionContext.resource || actionContext.toolName,
      context: {
        agentId: actionContext.agentId,
        toolName: actionContext.toolName,
        actionType: actionContext.actionType,
        taskId: actionContext.taskId,
        workflowId: actionContext.workflowId,
        requiresApproval: true,
        rulePattern: rule.pattern,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Compares two severity levels and returns comparison result.
   * @returns Positive number if first severity is higher, negative if lower, 0 if equal
   */
  private compareSeverity(
    sev1: 'info' | 'warning' | 'error' | 'critical',
    sev2: 'info' | 'warning' | 'error' | 'critical'
  ): number {
    const severityOrder = { info: 1, warning: 2, error: 3, critical: 4 };
    return severityOrder[sev1] - severityOrder[sev2];
  }

  /**
   * Generates a human-readable summary of the evaluation result.
   */
  private generateEvaluationSummary(
    allowed: boolean,
    violationCount: number,
    matchedRulesCount: number,
    requiresApproval: boolean
  ): string {
    if (allowed && violationCount === 0) {
      return 'Action allowed - no policy violations detected';
    }

    if (requiresApproval) {
      return `Action requires approval - ${violationCount} policy rule(s) matched requiring approval`;
    }

    if (!allowed) {
      return `Action blocked - ${violationCount} policy violation(s) detected from ${matchedRulesCount} matched rule(s)`;
    }

    return `Action allowed with warnings - ${violationCount} policy warning(s) from ${matchedRulesCount} matched rule(s)`;
  }

  /**
   * Reloads rules from configuration.
   * Useful when configuration has been updated at runtime.
   */
  reloadRules(ruleLoadingConfig?: RuleLoadingConfig): void {
    const loadingConfig = ruleLoadingConfig || {
      loadPathRules: true,
      loadApprovalRules: true,
      loadToolRules: true,
      loadCustomRules: true
    };

    this.rules.length = 0; // Clear existing rules
    this.rules.push(...this.loadRulesFromConfig(loadingConfig));
  }

  /**
   * Gets rules by type.
   */
  getRulesByType(type: PolicyRule['type']): PolicyRule[] {
    return this.rules.filter(rule => rule.type === type);
  }

  /**
   * Gets rules by severity.
   */
  getRulesBySeverity(severity: PolicyRule['severity']): PolicyRule[] {
    return this.rules.filter(rule => rule.severity === severity);
  }

  /**
   * Validates a file path against path rules.
   * Convenience method for path-specific validation.
   */
  validateFilePath(filePath: string, agentId?: string): PolicyViolation[] {
    const actionContext: AgentActionContext = {
      agentId: agentId || 'unknown',
      actionType: 'file_access',
      toolName: 'filesystem',
      resource: filePath,
    };

    const result = this.evaluateAction(actionContext);
    return result.violations;
  }
}

/**
 * Factory function for creating PolicyEngine instances.
 *
 * @param config - APEX configuration
 * @param ruleLoadingConfig - Optional rule loading configuration
 * @returns Configured PolicyEngine instance
 */
export function createPolicyEngine(
  config: ApexConfig,
  ruleLoadingConfig?: RuleLoadingConfig
): PolicyEngine {
  return new PolicyEngine(config, ruleLoadingConfig);
}