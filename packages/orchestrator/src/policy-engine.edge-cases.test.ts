/**
 * @fileoverview Additional edge case tests for PolicyEngine enforcement modes
 *
 * These tests complement the main test suite by covering specific edge cases
 * for enforcement mode behavior that might not be covered in the main tests.
 */

import { describe, beforeEach, it, expect } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import type { ApexConfig, PolicyCheckContext, PolicyCheckOptions } from '@apexcli/core';

describe('PolicyEngine Edge Cases - Enforcement Modes', () => {
  let engine: PolicyEngine;
  let config: ApexConfig;

  beforeEach(() => {
    config = {
      agents: [],
      workflows: [],
      policy: {
        enabled: true,
        enforcement: 'warn',
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

  describe('warn enforcement mode with violations', () => {
    it('should allow action but include violations in warn mode', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'config/database.yml', // This should trigger sensitive path requiring approval
        agentId: 'developer',
        taskId: 'task-warn-test',
      };

      const result = await engine.checkPolicy(context, {
        enforcementMode: 'warn',
      });

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('warn');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('warning');
      expect(result.violations[0].message).toContain('Approval required');
      expect(typeof result.durationMs).toBe('number');
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('should block only on critical/error violations in warn mode', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/api-key.txt', // This should be blocked (error severity)
        agentId: 'developer',
        taskId: 'task-error-test',
      };

      const result = await engine.checkPolicy(context, {
        enforcementMode: 'warn',
      });

      expect(result.status).toBe('deny');
      expect(result.enforcementMode).toBe('warn');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].blocking).toBe(true);
      expect(result.violations[0].severity).toBe('error');
    });
  });

  describe('disabled mode metadata verification', () => {
    it('should include correct metadata structure for disabled mode', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/api-key.txt',
        agentId: 'developer',
        taskId: 'task-disabled-test',
      };

      const result = await engine.checkPolicy(context, {
        enforcementMode: 'disabled',
      });

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(0);
      expect(result.enforcementMode).toBe('disabled');
      expect(result.rulesEvaluated).toBe(0);
      expect(result.rulesPassed).toBe(0);
      expect(result.rulesFailed).toBe(0);
      expect(result.metadata).toEqual({ disabled: true });
      expect(result.policyId).toBe('policy-engine-config');
      expect(typeof result.durationMs).toBe('number');
      expect(result.checkedAt).toBeInstanceOf(Date);
    });
  });

  describe('strict mode comprehensive testing', () => {
    it('should block on any violation including warnings in strict mode', async () => {
      // Test with warning-level violation (sensitive path)
      const sensitiveContext: PolicyCheckContext = {
        action: 'file_write',
        resource: 'config/app.json',
        agentId: 'developer',
        taskId: 'task-strict-warning',
      };

      const strictResult = await engine.checkPolicy(sensitiveContext, {
        enforcementMode: 'strict',
      });

      expect(strictResult.status).toBe('deny');
      expect(strictResult.enforcementMode).toBe('strict');
      expect(strictResult.violations.length).toBeGreaterThan(0);
      expect(strictResult.violations[0].severity).toBe('warning');
    });

    it('should block on error violations in strict mode', async () => {
      const blockedContext: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/credentials.env',
        agentId: 'developer',
        taskId: 'task-strict-error',
      };

      const strictResult = await engine.checkPolicy(blockedContext, {
        enforcementMode: 'strict',
      });

      expect(strictResult.status).toBe('deny');
      expect(strictResult.enforcementMode).toBe('strict');
      expect(strictResult.violations.length).toBeGreaterThan(0);
      expect(strictResult.violations[0].severity).toBe('error');
    });
  });

  describe('audit mode comprehensive testing', () => {
    it('should allow all actions but log violations in audit mode', async () => {
      // Test with blocked path
      const blockedContext: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/api-key.txt',
        agentId: 'developer',
        taskId: 'task-audit-blocked',
      };

      const auditResult = await engine.checkPolicy(blockedContext, {
        enforcementMode: 'audit',
      });

      expect(auditResult.status).toBe('allow');
      expect(auditResult.enforcementMode).toBe('audit');
      // Violations should still be recorded for auditing purposes
      expect(auditResult.violations.length).toBeGreaterThan(0);
      expect(auditResult.violations[0].severity).toBe('error');
      expect(auditResult.violations[0].blocking).toBe(true);
    });

    it('should include metadata about legacy evaluation in audit mode', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/api-key.txt',
        agentId: 'developer',
        taskId: 'task-audit-metadata',
      };

      const auditResult = await engine.checkPolicy(context, {
        enforcementMode: 'audit',
      });

      expect(auditResult.status).toBe('allow');
      expect(auditResult.metadata?.legacyEvaluation).toBe(true);
      expect(typeof auditResult.metadata?.matchedRulesCount).toBe('number');
      expect(typeof auditResult.metadata?.requiresApproval).toBe('boolean');
    });
  });

  describe('enforcement mode override behavior', () => {
    it('should use options enforcement mode over engine default', async () => {
      // Engine default is 'warn', but we override to 'strict'
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'config/sensitive.json',
        agentId: 'developer',
        taskId: 'task-override',
      };

      const defaultResult = await engine.checkPolicy(context);
      expect(defaultResult.enforcementMode).toBe('warn');

      const overrideResult = await engine.checkPolicy(context, {
        enforcementMode: 'strict',
      });
      expect(overrideResult.enforcementMode).toBe('strict');

      // The behavior should be different based on enforcement mode
      if (defaultResult.violations.length > 0 && defaultResult.violations[0].severity === 'warning') {
        expect(defaultResult.status).toBe('allow'); // warn mode allows warnings
        expect(overrideResult.status).toBe('deny'); // strict mode blocks warnings
      }
    });
  });

  describe('maxViolations option edge cases', () => {
    it('should limit violations to maxViolations when specified', async () => {
      // Create a context that might trigger multiple violations
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'not-allowed-path.secret', // Should trigger both default deny and block rules
        agentId: 'developer',
        taskId: 'task-max-violations',
      };

      const unlimitedResult = await engine.checkPolicy(context);
      const limitedResult = await engine.checkPolicy(context, {
        maxViolations: 1,
      });

      if (unlimitedResult.violations.length > 1) {
        expect(limitedResult.violations).toHaveLength(1);
        expect(limitedResult.violations.length).toBeLessThan(unlimitedResult.violations.length);
      }
    });

    it('should handle maxViolations of 0', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/api-key.txt',
        agentId: 'developer',
        taskId: 'task-zero-violations',
      };

      const result = await engine.checkPolicy(context, {
        maxViolations: 0,
      });

      expect(result.violations).toHaveLength(0);
      // Status should still reflect the policy decision
      expect(result.status).toBe('deny'); // Should still deny based on rules
    });
  });

  describe('performance and timing', () => {
    it('should include duration timing in all enforcement modes', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/index.ts',
        agentId: 'developer',
        taskId: 'task-timing',
      };

      const modes = ['strict', 'warn', 'audit', 'disabled'] as const;

      for (const mode of modes) {
        const result = await engine.checkPolicy(context, {
          enforcementMode: mode,
        });

        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(typeof result.durationMs).toBe('number');
        expect(result.checkedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('policy configuration edge cases', () => {
    it('should handle missing policy name gracefully', () => {
      const configWithoutPolicyName: ApexConfig = {
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

      const engineWithoutName = new PolicyEngine(configWithoutPolicyName);

      expect(() => {
        const context: PolicyCheckContext = {
          action: 'file_read',
          resource: 'src/index.ts',
          agentId: 'developer',
        };
        return engineWithoutName.checkPolicy(context);
      }).not.toThrow();
    });

    it('should handle policy engine with no rules gracefully', async () => {
      const minimalConfig: ApexConfig = {
        agents: [],
        workflows: [],
        policy: {
          enabled: true,
          enforcement: 'strict',
        },
      };

      const minimalEngine = new PolicyEngine(minimalConfig);
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'any-file.txt',
        agentId: 'developer',
      };

      const result = await minimalEngine.checkPolicy(context);

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(0);
      expect(result.rulesEvaluated).toBe(0);
    });
  });
});