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
  ApprovalRulesConfig,
  ApprovalRule,
  ApprovalCondition,
  ApprovalOperationType,
  ToolPermissionRule,
  ToolAction,
  AgentDefinition,
  ApexConfig,
  PolicyEngine as IPolicyEngine,
  Policy,
  PolicyCheckContext,
  PolicyCheckOptions,
  PolicyCheckResult,
  PolicyEnforcementMode,
  PolicyRule as CorePolicyRule,
  RuleTriggerEvent,
  ApexRule,
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
  type: 'path' | 'tool' | 'agent' | 'resource' | 'approval' | 'apex-rule';
  /** Rule pattern or condition */
  pattern?: string;
  /** Whether rule allows or denies the action */
  action: 'allow' | 'deny' | 'require_approval' | 'warn';
  /** Severity level for violations */
  severity: 'low' | 'medium' | 'high' | 'critical';
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
  severity: 'low' | 'medium' | 'high' | 'critical';
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
    this.policyConfig = config.policy || {
      enabled: false,
      enforcement: 'warn',
      version: '1.0',
      tags: [],
    };
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
      rule: violation.rule,
      message: violation.message,
      severity: violation.severity,
      blocking: violation.severity === 'high' || violation.severity === 'critical',
      policyType: violation.policyType,
      description: violation.description,
      resource: violation.resource,
      context: violation.context,
      timestamp: violation.timestamp,
      resolved: violation.resolved ?? false,
      resolvedAt: violation.resolvedAt,
      resolution: violation.resolution,
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
    if (loadingConfig.loadToolRules && this.config.permissions?.customRules?.length) {
      rules.push(...this.loadToolRules(this.config.permissions.customRules));
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
    const legacySensitivePatterns = (allowedPaths as AllowedPathsConfig & { sensitive?: string[] }).sensitive ?? [];
    const sensitivePatterns = allowedPaths.sensitivePatterns ?? legacySensitivePatterns;

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
          severity: 'high',
          enabled: true,
          priority: 100,
        });
      }
    }

    // Sensitive patterns (require approval)
    if (sensitivePatterns.length > 0) {
      for (const pattern of sensitivePatterns) {
        rules.push({
          id: `path-sensitive-${ruleCounter++}`,
          name: `Sensitive Path: ${pattern}`,
          description: `Requires approval for paths matching: ${pattern}`,
          type: 'path',
          pattern,
          action: 'require_approval',
          severity: 'medium',
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
          severity: 'low',
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
        severity: 'medium',
        enabled: true,
        priority: 1,
      });
    }

    return rules;
  }

  /**
   * Loads approval rules from configuration.
   */
  private loadApprovalRules(approvalRules: ApprovalRulesConfig): PolicyRule[] {
    const normalizedRules = this.normalizeApprovalRulesConfig(approvalRules);
    if (!normalizedRules || normalizedRules.enabled === false) {
      return [];
    }

    return normalizedRules.rules.map((rule, index) => ({
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
  private loadToolRules(customRules: ToolPermissionRule[]): PolicyRule[] {
    const rules: PolicyRule[] = [];
    let ruleCounter = 1;

    for (const rule of customRules) {
      const action = rule.behavior === 'confirm'
        ? 'require_approval'
        : rule.behavior === 'deny'
        ? 'deny'
        : 'allow';

      rules.push({
        id: `tool-${ruleCounter++}`,
        name: `Tool ${action}: ${rule.tool}`,
        description: rule.reason,
        type: 'tool',
        pattern: rule.tool,
        action,
        severity: rule.behavior === 'deny' ? 'high' : 'medium',
        enabled: true,
        priority: 70,
        conditions: {
          scope: rule.scope,
        },
      });
    }

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
  private mapUrgencyToSeverity(urgency: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (urgency) {
      case 'low': return 'low';
      case 'medium': return 'medium';
      case 'high': return 'high';
      case 'critical': return 'critical';
      default: return 'medium';
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
        severity: 'low',
        summary: 'Policy engine is disabled - all actions allowed',
        requiresApproval: false,
      };
    }

    const violations: PolicyViolation[] = [];
    const matchedRules: PolicyRule[] = [];
    const evaluatedRules = [...this.rules];
    let highestSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
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
        } else if (rule.action === 'warn') {
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

    const allowed = violations.length === 0 || violations.every(v => v.severity !== 'high' && v.severity !== 'critical');
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
      case 'apex-rule': // New case for custom ApexRules
        return this.evaluateApexRule(rule, actionContext);
      default:
        return false;
    }
  }

  /**
   * Evaluates an 'apex-rule' type policy rule.
   * Uses the parseAndEvaluateExpression method to check the rule's condition.
   */
  private evaluateApexRule(rule: PolicyRule, actionContext: AgentActionContext): boolean {
    const triggerEvent = rule.conditions?.triggerEvent as RuleTriggerEvent;
    const triggerToolName = rule.conditions?.triggerToolName as string | undefined;
    const expression = rule.conditions?.expression as string;

    if (!expression || !triggerEvent) {
      return false; // ApexRule must have an expression and trigger event
    }

    // Check if the actionContext matches the rule's trigger
    let triggerMatches = false;
    switch (triggerEvent) {
      case 'task.start':
        triggerMatches = actionContext.actionType === 'task.start';
        break;
      case 'task.update':
        triggerMatches = actionContext.actionType === 'task.update';
        break;
      case 'tool.use':
        triggerMatches = actionContext.actionType === 'tool.use' &&
                         (!triggerToolName || minimatch(actionContext.toolName, triggerToolName));
        break;
      case 'git.commit':
        triggerMatches = actionContext.actionType === 'git.commit';
        break;
      case 'git.push':
        triggerMatches = actionContext.actionType === 'git.push';
        break;
      case 'agent.thought':
        triggerMatches = actionContext.actionType === 'agent.thought';
        break;
      default:
        triggerMatches = false;
    }

    if (!triggerMatches) {
      return false;
    }

    // Build a comprehensive context for expression evaluation
    const evaluationContext = {
      task: {
        id: actionContext.taskId,
        workflow: actionContext.workflowId,
      },
      agent: {
        id: actionContext.agentId,
      },
      tool: {
        name: actionContext.toolName,
        input: actionContext.parameters,
        resource: actionContext.resource,
      },
      action: {
        type: actionContext.actionType,
      },
      // Directly expose actionContext for broader access if needed
      ...actionContext,
    };

    return this.parseAndEvaluateExpression(expression, evaluationContext);
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
    const normalizedType = this.normalizeApprovalConditionType(condition.type);

    switch (normalizedType) {
      case 'file-pattern':
        return this.evaluateApprovalFilePattern(condition, actionContext);
      case 'content-pattern':
        return this.evaluateApprovalContentPattern(condition, actionContext);
      case 'operation':
        return this.evaluateApprovalOperation(condition, actionContext);
      case 'cost-threshold':
        return this.evaluateApprovalCostThreshold(condition, actionContext);
      case 'token-threshold':
        return this.evaluateApprovalTokenThreshold(condition, actionContext);
      case 'custom':
        return this.evaluateApprovalCustom(condition, actionContext);
      default:
        return false;
    }
  }

  private normalizeApprovalRulesConfig(
    approvalRules: ApprovalRulesConfig | ApprovalRule[] | unknown
  ): ApprovalRulesConfig | null {
    if (!approvalRules) {
      return null;
    }

    if (Array.isArray(approvalRules)) {
      return this.buildApprovalRulesConfig({
        enabled: true,
        rules: approvalRules.map((rule, index) => this.normalizeApprovalRule(rule, index)),
      });
    }

    if (typeof approvalRules === 'object' && approvalRules) {
      const rules = (approvalRules as ApprovalRulesConfig).rules;
      if (Array.isArray(rules)) {
        return this.buildApprovalRulesConfig({
          ...(approvalRules as ApprovalRulesConfig),
          rules: rules.map((rule, index) => this.normalizeApprovalRule(rule, index)),
        });
      }
    }

    return null;
  }

  private normalizeApprovalRule(rule: ApprovalRule, index: number): ApprovalRule {
    const legacyRule = rule as ApprovalRule & { requiredApprovers?: string[]; id?: string };
    const normalizedConditions = (legacyRule.conditions || []).map(condition =>
      this.normalizeApprovalCondition(condition)
    );

    return {
      ...legacyRule,
      id: legacyRule.id || legacyRule.name || `approval-rule-${index + 1}`,
      approvers: legacyRule.approvers ?? legacyRule.requiredApprovers ?? [],
      conditions: normalizedConditions,
    };
  }

  private buildApprovalRulesConfig(base: Partial<ApprovalRulesConfig>): ApprovalRulesConfig {
    return {
      enabled: base.enabled ?? true,
      rules: base.rules ?? [],
      defaultTimeoutMinutes: base.defaultTimeoutMinutes ?? 60,
      defaultTimeoutAction: base.defaultTimeoutAction ?? 'reject',
      globalApprovers: base.globalApprovers ?? [],
      notificationsEnabled: base.notificationsEnabled ?? true,
      notificationChannels: base.notificationChannels,
      auditLog: base.auditLog ?? true,
      auditLogPath: base.auditLogPath ?? 'approval-audit.log',
    };
  }

  private normalizeApprovalCondition(condition: ApprovalCondition): ApprovalCondition {
    const legacyCondition = condition as ApprovalCondition & {
      value?: number;
      pattern?: string | string[];
    };

    return {
      ...legacyCondition,
      type: this.normalizeApprovalConditionType(legacyCondition.type),
      threshold: legacyCondition.threshold ?? legacyCondition.value,
      patterns: legacyCondition.patterns
        ?? (legacyCondition.pattern ? (Array.isArray(legacyCondition.pattern) ? legacyCondition.pattern : [legacyCondition.pattern]) : undefined),
    };
  }

  private normalizeApprovalConditionType(type: ApprovalCondition['type'] | string): ApprovalCondition['type'] {
    switch (type) {
      case 'file_pattern':
        return 'file-pattern';
      case 'content_pattern':
        return 'content-pattern';
      case 'cost_threshold':
        return 'cost-threshold';
      case 'token_threshold':
        return 'token-threshold';
      default:
        return type as ApprovalCondition['type'];
    }
  }

  private evaluateApprovalFilePattern(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    const patterns = condition.patterns ?? [];
    if (patterns.length === 0) {
      return false;
    }

    const filePaths = this.getApprovalFilePaths(actionContext);
    return filePaths.some(filePath =>
      patterns.some(pattern => minimatch(filePath, pattern))
    );
  }

  private evaluateApprovalContentPattern(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    const patterns = condition.patterns ?? [];
    if (patterns.length === 0) {
      return false;
    }

    const contents = this.getApprovalContents(actionContext);
    if (contents.length === 0) {
      return false;
    }

    return patterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return contents.some(content => regex.test(content));
      } catch (error) {
        console.warn(`Invalid content pattern regex: ${pattern}`, error);
        return false;
      }
    });
  }

  private evaluateApprovalOperation(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    const operations = condition.operations ?? [];
    if (operations.length === 0) {
      return false;
    }

    const metadataOperation = actionContext.metadata?.operation as ApprovalOperationType | undefined;
    const parameterOperation = (actionContext.parameters as { operation?: ApprovalOperationType } | undefined)?.operation;
    const inferredOperation = metadataOperation ?? parameterOperation ?? (operations.includes(actionContext.actionType as ApprovalOperationType)
      ? (actionContext.actionType as ApprovalOperationType)
      : undefined);

    return inferredOperation ? operations.includes(inferredOperation) : false;
  }

  private evaluateApprovalCostThreshold(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    if (typeof condition.threshold !== 'number') {
      return false;
    }

    const estimatedCost = (actionContext.metadata?.estimatedCost as number | undefined)
      ?? (actionContext.parameters as { estimatedCost?: number } | undefined)?.estimatedCost;

    return typeof estimatedCost === 'number' && estimatedCost >= condition.threshold;
  }

  private evaluateApprovalTokenThreshold(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    if (typeof condition.threshold !== 'number') {
      return false;
    }

    const tokenUsage = (actionContext.metadata?.tokenUsage as number | undefined)
      ?? (actionContext.parameters as { tokenUsage?: number } | undefined)?.tokenUsage;

    return typeof tokenUsage === 'number' && tokenUsage >= condition.threshold;
  }

  private evaluateApprovalCustom(condition: ApprovalCondition, actionContext: AgentActionContext): boolean {
    const expression = condition.expression;
    if (!expression) {
      return false;
    }

    const evaluationContext = {
      operation: actionContext.metadata?.operation,
      cost: actionContext.metadata?.estimatedCost,
      tokens: actionContext.metadata?.tokenUsage,
      files: this.getApprovalFilePaths(actionContext),
      action: actionContext.actionType,
      tool: {
        name: actionContext.toolName,
        input: actionContext.parameters,
        resource: actionContext.resource,
      },
      agent: {
        id: actionContext.agentId,
      },
      task: {
        id: actionContext.taskId,
        workflow: actionContext.workflowId,
      },
    };

    return this.parseAndEvaluateExpression(expression, evaluationContext);
  }

  private getApprovalFilePaths(actionContext: AgentActionContext): string[] {
    const filePaths: string[] = [];
    if (actionContext.resource) {
      filePaths.push(actionContext.resource);
    }

    const metadataPaths = actionContext.metadata?.filePaths as string[] | undefined;
    if (Array.isArray(metadataPaths)) {
      filePaths.push(...metadataPaths);
    }

    const params = actionContext.parameters as { file_path?: string; path?: string } | undefined;
    if (params?.file_path) {
      filePaths.push(params.file_path);
    }
    if (params?.path) {
      filePaths.push(params.path);
    }

    return Array.from(new Set(filePaths.filter(Boolean)));
  }

  private getApprovalContents(actionContext: AgentActionContext): string[] {
    const contents: string[] = [];

    const params = actionContext.parameters as { content?: string; text?: string } | undefined;
    if (params?.content) {
      contents.push(params.content);
    }
    if (params?.text) {
      contents.push(params.text);
    }

    const metadataContents = actionContext.metadata?.fileContents as Record<string, string> | Map<string, string> | undefined;
    if (metadataContents instanceof Map) {
      contents.push(...Array.from(metadataContents.values()));
    } else if (metadataContents && typeof metadataContents === 'object') {
      contents.push(...Object.values(metadataContents));
    }

    return contents;
  }

  /**
   * Creates a policy violation from a matched rule.
   */
  private createViolationFromRule(rule: PolicyRule, actionContext: AgentActionContext): PolicyViolation {
    return {
      id: randomUUID(),
      rule: rule.id,
      message: `Policy violation: ${rule.name}`,
      description: rule.description || `Action blocked by policy rule: ${rule.name}`,
      severity: rule.severity,
      blocking: rule.action === 'deny',
      policyType: rule.type === 'path' || rule.type === 'approval' ? rule.type : undefined,
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
      resolved: false,
    };
  }

  /**
   * Creates an approval violation for actions requiring approval.
   */
  private createApprovalViolation(rule: PolicyRule, actionContext: AgentActionContext): PolicyViolation {
    return {
      id: randomUUID(),
      rule: rule.id,
      message: `Approval required: ${rule.name}`,
      description: rule.description || `Action requires approval due to policy rule: ${rule.name}`,
      severity: rule.severity,
      blocking: false,
      policyType: rule.type === 'path' || rule.type === 'approval' ? rule.type : undefined,
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
      resolved: false,
    };
  }

  /**
   * Compares two severity levels and returns comparison result.
   * @returns Positive number if first severity is higher, negative if lower, 0 if equal
   */
  private compareSeverity(
    sev1: 'low' | 'medium' | 'high' | 'critical',
    sev2: 'low' | 'medium' | 'high' | 'critical'
  ): number {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
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
   * Registers a list of ApexRules as a 'project-rules' policy.
   * Converts ApexRules into PolicyRules and adds them to a dynamically created Policy.
   *
   * @param apexRules - An array of ApexRules to register
   */
  registerApexRules(apexRules: ApexRule[]): void {
    if (!apexRules || apexRules.length === 0) {
      return;
    }

    const projectId = 'apex-project-rules';
    let projectPolicy = this.getPolicy(projectId);

    const coreRules: CorePolicyRule[] = [];
    const evaluationRules: PolicyRule[] = [];

    apexRules.forEach((apexRule, index) => {
      const ruleId = `apex-rule-${index}`;
      const evaluationRule = this.convertApexRuleToPolicyRule(apexRule, ruleId);
      if (evaluationRule) {
        evaluationRules.push(evaluationRule);
      }
      const coreRule = this.convertApexRuleToCorePolicyRule(apexRule, ruleId);
      if (coreRule) {
        coreRules.push(coreRule);
      }
    });

    if (!projectPolicy) {
      projectPolicy = {
        id: projectId,
        name: 'APEX Project Rules',
        description: 'Dynamically loaded project-specific rules from .apexrules file',
        rules: coreRules,
        enabled: true,
        enforcement: 'warn',
        tags: ['apex-rule'],
        severityLevels: {
          default: 'medium',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.registerPolicy(projectPolicy);
    } else {
      projectPolicy.rules = coreRules;
      projectPolicy.updatedAt = new Date();
      projectPolicy.tags = projectPolicy.tags?.length ? projectPolicy.tags : ['apex-rule'];
      projectPolicy.severityLevels = projectPolicy.severityLevels || { default: 'medium' };
      this.policies.set(projectId, projectPolicy);
    }

    const retainedRules = this.rules.filter(rule => rule.type !== 'apex-rule');
    this.rules.length = 0;
    this.rules.push(...retainedRules, ...evaluationRules);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Converts a single ApexRule to a PolicyRule.
   */
  private convertApexRuleToPolicyRule(apexRule: ApexRule, defaultId: string): PolicyRule | null {
    if (!apexRule.condition?.expression) {
      console.warn(`ApexRule '${apexRule.name}' has no condition expression. Skipping.`);
      return null;
    }

    // Determine PolicyRule action based on ApexRule action
    let action: PolicyRule['action'];
    let severity: PolicyRule['severity'] = 'medium';

    switch (apexRule.action.type) {
      case 'block':
        action = 'deny';
        severity = 'critical';
        break;
      case 'warn':
        action = 'warn';
        severity = 'medium';
        break;
      case 'inject_prompt':
        action = 'warn'; // Injecting a prompt is a warning to the agent
        severity = 'medium';
        break;
      default:
        action = 'warn';
        severity = 'medium';
    }

    // Determine PolicyRule type - for ApexRules, we'll use a new 'apex-rule' type
    // This allows specific handling in evaluateRuleMatch later
    return {
      id: apexRule.name.replace(/\s+/g, '-').toLowerCase() || defaultId,
      name: apexRule.name,
      description: apexRule.description,
      type: 'apex-rule', // New custom rule type
      pattern: apexRule.trigger.event, // Use trigger event as pattern for now (will be evaluated by expression)
      action,
      severity,
      enabled: apexRule.enabled ?? true,
      priority: 50, // Default priority for project rules
      conditions: {
        expression: apexRule.condition.expression,
        triggerEvent: apexRule.trigger.event,
        triggerToolName: apexRule.trigger.toolName, // Pass tool name if defined
        actionType: apexRule.action.type,
        actionMessage: apexRule.action.message,
        actionPrompt: apexRule.action.prompt,
      },
    };
  }

  private convertApexRuleToCorePolicyRule(apexRule: ApexRule, defaultId: string): CorePolicyRule | null {
    if (!apexRule.condition?.expression) {
      return null;
    }

    let action: CorePolicyRule['action'] = 'warn';
    let severity: CorePolicyRule['severity'] = 'medium';

    switch (apexRule.action.type) {
      case 'block':
        action = 'deny';
        severity = 'critical';
        break;
      case 'warn':
        action = 'warn';
        severity = 'medium';
        break;
      case 'inject_prompt':
        action = 'warn';
        severity = 'medium';
        break;
      default:
        action = 'warn';
        severity = 'medium';
    }

    return {
      id: apexRule.name.replace(/\\s+/g, '-').toLowerCase() || defaultId,
      name: apexRule.name,
      description: apexRule.description,
      condition: apexRule.condition.expression,
      action,
      severity,
      enabled: apexRule.enabled ?? true,
      enforcement: undefined,
      tags: ['apex-rule'],
      metadata: {
        triggerEvent: apexRule.trigger.event,
        triggerToolName: apexRule.trigger.toolName,
        actionType: apexRule.action.type,
        actionMessage: apexRule.action.message,
        actionPrompt: apexRule.action.prompt,
      },
    };
  }

  /**
   * Parses and evaluates a boolean expression string against a given context.
   * Supports basic property access, comparisons (==, !=, <, <=, >, >=),
   * and logical operators (&&, ||, !).
   *
   * This is a simplified evaluator. For production, consider a robust AST-based solution.
   *
   * @param expression The boolean expression string (e.g., "tool.name == 'Write' && tool.input.path.startsWith('src/')")
   * @param context The context object containing variables (e.g., { tool: { name: 'Write', input: { path: 'src/file.ts' } }, task: { workflow: 'feature' } })
   * @returns The result of the expression evaluation
   */
  private parseAndEvaluateExpression(expression: string, context: Record<string, any>): boolean {
    // Replace property access with safe context lookups
    let jsExpression = expression.replace(/([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)/g, (match, p1, p2) => {
      // Handle special string methods like .startsWith() or .includes()
      // This is a simplification; a full evaluator would parse method calls
      // For now, assume it's used directly in the expression and `context[p1]` is a string
      if (p2 === 'startsWith' || p2 === 'includes' || p2 === 'endsWith') {
        // Need to ensure the base object is a string before calling these methods
        return `(typeof this.getProperty(context, '${p1}') === 'string' ? this.getProperty(context, '${p1}').${p2}' : false)`;
      }
      return `this.getProperty(context, '${p1}.${p2}')`;
    });
    
    // Replace string literals to be safe
    jsExpression = jsExpression.replace(/'([^']*)'/g, (match, p1) => JSON.stringify(p1));
    jsExpression = jsExpression.replace(/"([^"]*)"/g, (match, p1) => JSON.stringify(p1));

    // Basic sanitization: check for dangerous constructs (very rudimentary)
    // Add more comprehensive checks as needed
    if (/[;`[\]{}<>]/.test(jsExpression) || /new\s+|delete\s+|function\s+|eval\s+|this\s+|window\s+|global\s+|process\s+/.test(jsExpression)) {
      console.warn(`PolicyEngine: Potentially unsafe expression detected and blocked: ${expression}`);
      return false;
    }
    
    // Create a safe evaluation context function
    const evaluate = new Function('context', 'getProperty', `
      'use strict';
      const safeContext = { ...context }; // Clone context to prevent modification during evaluation
      try {
        return ${jsExpression};
      } catch (e) {
        console.error('PolicyEngine: Error evaluating rule expression:', e);
        return false;
      }
    `);

    try {
      return evaluate(context, this.getProperty);
    } catch (e) {
      console.error(`PolicyEngine: Failed to evaluate expression "${expression}":`, e);
      return false;
    }
  }

  /**
   * Helper to safely get nested properties from an object.
   * Prevents errors from accessing properties of undefined.
   */
  private getProperty(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc && typeof acc === 'object' && acc[part] !== undefined ? acc[part] : undefined), obj);
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
