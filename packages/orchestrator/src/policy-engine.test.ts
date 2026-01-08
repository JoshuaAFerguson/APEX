/**
 * @fileoverview Unit tests for PolicyEngine class
 *
 * Comprehensive test coverage for rule matching logic, evaluation results,
 * and policy violation handling in the PolicyEngine.
 */

import { describe, beforeEach, it, expect } from 'vitest';
import { PolicyEngine, createPolicyEngine, type AgentActionContext, type PolicyRule } from './policy-engine.js';
import type { ApexConfig, PolicyConfig, PolicyCheckContext, PolicyCheckOptions, Policy } from '@apexcli/core';

describe('PolicyEngine', () => {
  describe('Constructor and Basic Properties', () => {
    it('should initialize with default configuration', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
        },
      };

      const engine = new PolicyEngine(config);

      expect(engine.isEnabled).toBe(true);
      expect(engine.policyConfiguration).toEqual(config.policy);
      expect(engine.policyRules).toHaveLength(0);
    });

    it('should initialize with disabled policy', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: false,
          enforcement: 'warn',
        },
      };

      const engine = new PolicyEngine(config);

      expect(engine.isEnabled).toBe(false);
      expect(engine.policyRules).toHaveLength(0);
    });

    it('should initialize with missing policy configuration', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
      };

      const engine = new PolicyEngine(config);

      expect(engine.isEnabled).toBe(false);
      expect(engine.policyConfiguration).toEqual({ enabled: false, enforcement: 'warn' });
    });
  });

  describe('Rule Loading from Configuration', () => {
    it('should load path rules from allowedPaths configuration', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**', 'tests/**'],
            block: ['src/secrets/**', '**/.env'],
            sensitive: ['config/**', 'database/**'],
          },
        },
      };

      const engine = new PolicyEngine(config);
      const rules = engine.policyRules;

      // Should have block rules (highest priority)
      const blockRules = rules.filter(r => r.action === 'deny' && r.type === 'path');
      expect(blockRules).toHaveLength(2);
      expect(blockRules[0].pattern).toBe('src/secrets/**');
      expect(blockRules[0].priority).toBe(100);
      expect(blockRules[0].severity).toBe('high');

      // Should have sensitive rules (require approval)
      const sensitiveRules = rules.filter(r => r.action === 'require_approval' && r.type === 'path');
      expect(sensitiveRules).toHaveLength(2);
      expect(sensitiveRules[0].pattern).toBe('config/**');
      expect(sensitiveRules[0].priority).toBe(90);
      expect(sensitiveRules[0].severity).toBe('medium');

      // Should have allow rules for allowlist mode
      const allowRules = rules.filter(r => r.action === 'allow' && r.type === 'path');
      expect(allowRules).toHaveLength(2);

      // Should have default deny rule for allowlist mode
      const defaultDenyRules = rules.filter(r => r.id === 'path-default-deny');
      expect(defaultDenyRules).toHaveLength(1);
      expect(defaultDenyRules[0].priority).toBe(1);
    });

    it('should load approval rules from configuration', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          approvalRules: [
            {
              name: 'High Cost Operations',
              description: 'Require approval for expensive operations',
              urgency: 'high',
              conditions: [
                {
                  type: 'cost_threshold',
                  value: 10.0,
                },
              ],
              requiredApprovers: ['admin'],
              minApprovals: 1,
              timeoutMinutes: 30,
              timeoutAction: 'reject',
            },
            {
              name: 'Sensitive File Access',
              description: 'Require approval for sensitive files',
              urgency: 'medium',
              conditions: [
                {
                  type: 'file_pattern',
                  value: '/secrets/**',
                },
              ],
              requiredApprovers: ['security-admin'],
              minApprovals: 1,
              timeoutMinutes: 60,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      const engine = new PolicyEngine(config);
      const approvalRules = engine.getRulesByType('approval');

      expect(approvalRules).toHaveLength(2);
      expect(approvalRules[0].name).toBe('High Cost Operations');
      expect(approvalRules[0].severity).toBe('high'); // High urgency maps to high severity
      expect(approvalRules[1].name).toBe('Sensitive File Access');
      expect(approvalRules[1].severity).toBe('medium'); // Medium urgency maps to medium severity
    });

    it('should respect rule loading configuration', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['secrets/**'],
          },
          approvalRules: [
            {
              name: 'Test Rule',
              conditions: [],
              requiredApprovers: [],
              minApprovals: 1,
              timeoutMinutes: 30,
              timeoutAction: 'reject',
            },
          ],
        },
      };

      // Load only path rules
      const enginePathOnly = new PolicyEngine(config, {
        loadPathRules: true,
        loadApprovalRules: false,
        loadToolRules: false,
        loadCustomRules: false,
      });

      expect(enginePathOnly.getRulesByType('path').length).toBeGreaterThan(0);
      expect(enginePathOnly.getRulesByType('approval')).toHaveLength(0);

      // Load only approval rules
      const engineApprovalOnly = new PolicyEngine(config, {
        loadPathRules: false,
        loadApprovalRules: true,
        loadToolRules: false,
        loadCustomRules: false,
      });

      expect(engineApprovalOnly.getRulesByType('path')).toHaveLength(0);
      expect(engineApprovalOnly.getRulesByType('approval')).toHaveLength(1);
    });
  });

  describe('Agent Action Evaluation', () => {
    let engine: PolicyEngine;
    let config: ApexConfig;

    beforeEach(() => {
      config = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**', 'tests/**'],
            block: ['src/secrets/**', '**/.env'],
            sensitive: ['config/**'],
          },
        },
      };
      engine = new PolicyEngine(config);
    });

    it('should allow actions when policy is disabled', () => {
      const disabledConfig: ApexConfig = {
        ...config,
        policy: { enabled: false, enforcement: 'warn' },
      };
      const disabledEngine = new PolicyEngine(disabledConfig);

      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: '/project/src/secrets/api-key.txt',
      };

      const result = disabledEngine.evaluateAction(actionContext);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary).toContain('disabled');
    });

    it('should block access to blocked paths', () => {
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'src/secrets/api-key.txt',
        taskId: 'task-123',
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('high');
      expect(result.violations[0].message).toContain('Policy violation');
      expect(result.violations[0].resource).toBe('src/secrets/api-key.txt');
      expect(result.violations[0].context?.agentId).toBe('test-agent');
      expect(result.violations[0].context?.taskId).toBe('task-123');
      expect(result.severity).toBe('high');
    });

    it('should allow access to allowed paths', () => {
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'src/components/Button.tsx',
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary).toContain('allowed');
    });

    it('should require approval for sensitive paths', () => {
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_write',
        toolName: 'Write',
        resource: 'config/database.yml',
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(true); // Not blocked, but requires approval
      expect(result.requiresApproval).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('medium');
      expect(result.violations[0].message).toContain('Approval required');
      expect(result.violations[0].context?.requiresApproval).toBe(true);
    });

    it('should block access to non-allowed paths in allowlist mode', () => {
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'docs/README.md', // Not in allowed patterns
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleId).toBe('path-default-deny');
      expect(result.summary).toContain('blocked');
    });

    it('should handle multiple rule matches correctly', () => {
      // Create an action that could match multiple rules
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'src/secrets/config.env', // Matches both block and could match sensitive patterns
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(false);
      expect(result.matchedRules.length).toBeGreaterThanOrEqual(1);
      expect(result.evaluatedRules.length).toBeGreaterThan(0);
      expect(result.violations).toHaveLength(1); // Should have violation from block rule
    });

    it('should handle actions without resource paths', () => {
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'calculation',
        toolName: 'Calculator',
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Rule Matching Logic', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**/*.ts', 'tests/**/*.test.js'],
            block: ['**/*.secret', 'node_modules/**'],
            sensitive: ['config/*.json', 'database/*.sql'],
          },
        },
      };
      engine = new PolicyEngine(config);
    });

    it('should match glob patterns correctly', () => {
      const testCases = [
        { path: 'src/components/Button.ts', shouldMatch: 'allow' },
        { path: 'src/utils/helpers.ts', shouldMatch: 'allow' },
        { path: 'src/styles.css', shouldMatch: 'deny' }, // Not allowed in allowlist
        { path: 'tests/unit/button.test.js', shouldMatch: 'allow' },
        { path: 'secrets.secret', shouldMatch: 'deny' },
        { path: 'node_modules/package/index.js', shouldMatch: 'deny' },
        { path: 'config/app.json', shouldMatch: 'approval' },
        { path: 'database/migration.sql', shouldMatch: 'approval' },
      ];

      testCases.forEach(({ path, shouldMatch }) => {
        const actionContext: AgentActionContext = {
          agentId: 'test-agent',
          actionType: 'file_read',
          toolName: 'Read',
          resource: path,
        };

        const result = engine.evaluateAction(actionContext);

        switch (shouldMatch) {
          case 'allow':
            expect(result.allowed).toBe(true);
            expect(result.violations).toHaveLength(0);
            break;
          case 'deny':
            expect(result.allowed).toBe(false);
            expect(result.violations.length).toBeGreaterThan(0);
            break;
          case 'approval':
            expect(result.requiresApproval).toBe(true);
            expect(result.violations.length).toBeGreaterThan(0);
            expect(result.violations[0].context?.requiresApproval).toBe(true);
            break;
        }
      });
    });

    it('should prioritize block rules over allow rules', () => {
      // Create a path that would match both block and allow patterns
      const actionContext: AgentActionContext = {
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'src/secrets.secret', // Matches both src/** allow and *.secret block
      };

      const result = engine.evaluateAction(actionContext);

      expect(result.allowed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('high'); // Block rules have high severity
    });
  });

  describe('Rule Management', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['secrets/**'],
            sensitive: ['config/**'],
          },
        },
      };
      engine = new PolicyEngine(config);
    });

    it('should get rules by type', () => {
      const pathRules = engine.getRulesByType('path');
      const approvalRules = engine.getRulesByType('approval');
      const toolRules = engine.getRulesByType('tool');

      expect(pathRules.length).toBeGreaterThan(0);
      expect(approvalRules).toHaveLength(0);
      expect(toolRules).toHaveLength(0);

      pathRules.forEach(rule => {
        expect(rule.type).toBe('path');
      });
    });

    it('should get rules by severity', () => {
      const errorRules = engine.getRulesBySeverity('high');
      const warningRules = engine.getRulesBySeverity('medium');

      expect(errorRules.length).toBeGreaterThan(0); // Block rules have high severity
      expect(warningRules.length).toBeGreaterThan(0); // Sensitive rules have medium severity

      errorRules.forEach(rule => {
        expect(rule.severity).toBe('high');
      });
    });

    it('should reload rules from configuration', () => {
      const initialRuleCount = engine.policyRules.length;

      // Reload with different configuration
      engine.reloadRules({
        loadPathRules: false,
        loadApprovalRules: false,
        loadToolRules: false,
        loadCustomRules: false,
      });

      expect(engine.policyRules).toHaveLength(0);

      // Reload with default configuration
      engine.reloadRules();

      expect(engine.policyRules.length).toBe(initialRuleCount);
    });
  });

  describe('validateFilePath convenience method', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['secrets/**'],
          },
        },
      };
      engine = new PolicyEngine(config);
    });

    it('should validate file paths correctly', () => {
      const allowedViolations = engine.validateFilePath('src/index.ts');
      expect(allowedViolations).toHaveLength(0);

      const blockedViolations = engine.validateFilePath('secrets/api-key.txt');
      expect(blockedViolations.length).toBeGreaterThan(0);
      expect(blockedViolations[0].severity).toBe('high');
    });

    it('should handle optional agent ID parameter', () => {
      const violations = engine.validateFilePath('secrets/api-key.txt', 'test-agent');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].context?.agentId).toBe('test-agent');
    });
  });

  describe('Policy evaluation result properties', () => {
    it('should generate appropriate evaluation summaries', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['secrets/**'],
            sensitive: ['config/**'],
          },
        },
      };
      const engine = new PolicyEngine(config);

      // Test allowed action
      const allowedResult = engine.evaluateAction({
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'src/index.ts',
      });
      expect(allowedResult.summary).toContain('allowed');
      expect(allowedResult.summary).toContain('no policy violations');

      // Test blocked action
      const blockedResult = engine.evaluateAction({
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'secrets/api-key.txt',
      });
      expect(blockedResult.summary).toContain('blocked');
      expect(blockedResult.summary).toContain('violation');

      // Test approval required action
      const approvalResult = engine.evaluateAction({
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'config/database.json',
      });
      expect(approvalResult.summary).toContain('approval');
    });

    it('should track highest severity correctly', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['secrets/**'], // high severity
            sensitive: ['config/**'], // medium severity
          },
        },
      };
      const engine = new PolicyEngine(config);

      // Test high severity (block rule)
      const errorResult = engine.evaluateAction({
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'secrets/api-key.txt',
      });
      expect(errorResult.severity).toBe('high');

      // Test medium severity (sensitive rule)
      const warningResult = engine.evaluateAction({
        agentId: 'test-agent',
        actionType: 'file_read',
        toolName: 'Read',
        resource: 'config/database.json',
      });
      expect(warningResult.severity).toBe('medium');
    });
  });

  describe('Factory function', () => {
    it('should create PolicyEngine instance via factory', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
        },
      };

      const engine = createPolicyEngine(config);

      expect(engine).toBeInstanceOf(PolicyEngine);
      expect(engine.isEnabled).toBe(true);
    });

    it('should pass rule loading configuration to factory', () => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
        },
      };

      const engine = createPolicyEngine(config, {
        loadPathRules: false,
        loadApprovalRules: false,
        loadToolRules: false,
        loadCustomRules: false,
      });

      expect(engine.policyRules).toHaveLength(0);
    });
  });

  describe('PolicyEngine Interface Implementation', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      const config: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['secrets/**'],
          },
        },
      };
      engine = new PolicyEngine(config);
    });

    describe('checkPolicy method', () => {
      it('should evaluate policy with new context format', async () => {
        const context: PolicyCheckContext = {
          action: 'file_write',
          resource: 'src/index.ts',
          agentId: 'developer',
          taskId: 'task-123',
        };

        const result = await engine.checkPolicy(context);

        expect(result.status).toBe('allow');
        expect(result.enforcementMode).toBe('warn');
        expect(result.checkedAt).toBeInstanceOf(Date);
        expect(typeof result.rulesEvaluated).toBe('number');
        expect(typeof result.durationMs).toBe('number');
      });

      it('should deny access to blocked paths', async () => {
        const context: PolicyCheckContext = {
          action: 'file_read',
          resource: 'secrets/api-key.txt',
          agentId: 'developer',
        };

        const result = await engine.checkPolicy(context);

        expect(result.status).toBe('deny');
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations[0].blocking).toBe(true);
      });

      it('should respect enforcement mode options', async () => {
        const context: PolicyCheckContext = {
          action: 'file_read',
          resource: 'secrets/api-key.txt',
          agentId: 'developer',
        };

        // Test audit mode - should allow even with violations
        const auditResult = await engine.checkPolicy(context, {
          enforcementMode: 'audit',
        });
        expect(auditResult.status).toBe('allow');
        expect(auditResult.enforcementMode).toBe('audit');

        // Test strict mode - should block on any violation
        const strictResult = await engine.checkPolicy(context, {
          enforcementMode: 'strict',
        });
        expect(strictResult.status).toBe('deny');
        expect(strictResult.enforcementMode).toBe('strict');
      });

      it('should limit violations based on maxViolations option', async () => {
        const context: PolicyCheckContext = {
          action: 'file_read',
          resource: 'secrets/api-key.txt',
          agentId: 'developer',
        };

        const result = await engine.checkPolicy(context, {
          maxViolations: 1,
        });

        expect(result.violations.length).toBeLessThanOrEqual(1);
      });

      it('should handle disabled enforcement mode', async () => {
        const context: PolicyCheckContext = {
          action: 'file_read',
          resource: 'secrets/api-key.txt',
          agentId: 'developer',
        };

        const result = await engine.checkPolicy(context, {
          enforcementMode: 'disabled',
        });

        expect(result.status).toBe('allow');
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementMode).toBe('disabled');
      });
    });

    describe('enforcement mode management', () => {
      it('should get and set enforcement mode', () => {
        expect(engine.getEnforcementMode()).toBe('warn');

        engine.setEnforcementMode('strict');
        expect(engine.getEnforcementMode()).toBe('strict');

        engine.setEnforcementMode('audit');
        expect(engine.getEnforcementMode()).toBe('audit');
      });
    });

    describe('policy management', () => {
      const samplePolicy: Policy = {
        id: 'test-policy-1',
        name: 'Test Path Policy',
        description: 'A test path policy',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        rules: [
          {
            id: 'rule-1',
            name: 'Block secrets',
            condition: 'path.includes("secret")',
            action: 'deny',
            severity: 'critical',
          }
        ],
        config: {
          mode: 'allowlist',
          allowedPaths: ['src/**/*.ts'],
          blockedPaths: ['node_modules/**/*']
        },
        tags: ['test', 'path'],
        metadata: { testPolicy: true }
      };

      it('should register and retrieve policies', () => {
        expect(engine.getPolicies()).toHaveLength(0);

        engine.registerPolicy(samplePolicy);

        expect(engine.getPolicies()).toHaveLength(1);
        expect(engine.getPolicy('test-policy-1')).toEqual(samplePolicy);
        expect(engine.hasPolicy('test-policy-1')).toBe(true);
      });

      it('should unregister policies correctly', () => {
        engine.registerPolicy(samplePolicy);
        expect(engine.hasPolicy('test-policy-1')).toBe(true);

        const removed = engine.unregisterPolicy('test-policy-1');

        expect(removed).toBe(true);
        expect(engine.hasPolicy('test-policy-1')).toBe(false);
        expect(engine.getPolicy('test-policy-1')).toBeUndefined();
      });

      it('should return false when trying to unregister non-existent policy', () => {
        const removed = engine.unregisterPolicy('non-existent-policy');
        expect(removed).toBe(false);
      });

      it('should clear all policies', () => {
        engine.registerPolicy(samplePolicy);
        engine.registerPolicy({
          ...samplePolicy,
          id: 'test-policy-2',
          name: 'Test Policy 2'
        });

        expect(engine.getPolicies()).toHaveLength(2);

        engine.clearPolicies();

        expect(engine.getPolicies()).toHaveLength(0);
      });

      it('should handle multiple policies', () => {
        const policies = [
          { ...samplePolicy, id: 'policy-1' },
          { ...samplePolicy, id: 'policy-2', type: 'test' as const, config: {
            enforcement: 'strict' as const,
            coverage: { minimum: 80 },
            rules: []
          }},
          { ...samplePolicy, id: 'policy-3', type: 'approval' as const, config: {
            conditions: [],
            timeoutMs: 300000,
            timeoutAction: 'deny' as const
          }}
        ];

        policies.forEach(policy => engine.registerPolicy(policy));

        expect(engine.getPolicies()).toHaveLength(3);
        expect(engine.hasPolicy('policy-1')).toBe(true);
        expect(engine.hasPolicy('policy-2')).toBe(true);
        expect(engine.hasPolicy('policy-3')).toBe(true);
      });
    });
  });
});
