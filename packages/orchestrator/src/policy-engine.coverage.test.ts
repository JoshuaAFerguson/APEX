/**
 * @fileoverview PolicyEngine coverage tests to ensure all interface methods are properly tested
 *
 * This file focuses on testing the PolicyEngine interface implementation
 * and ensuring all three enforcement modes (strict, warn, audit) plus disabled
 * are fully covered as specified in the acceptance criteria.
 */

import { describe, beforeEach, it, expect } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import type { ApexConfig, PolicyCheckContext, PolicyEnforcementMode, Policy } from '@apexcli/core';

describe('PolicyEngine Interface Coverage - All Enforcement Modes', () => {
  let engine: PolicyEngine;
  let config: ApexConfig;

  beforeEach(() => {
    config = {
      agents: [],
      workflows: [],
      policy: {
        enabled: true,
        enforcement: 'warn',
        name: 'Test Policy Configuration',
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

  describe('checkPolicy method - complete coverage', () => {
    const testContext: PolicyCheckContext = {
      action: 'file_read',
      resource: 'src/secrets/api-key.txt',
      agentId: 'test-agent',
      taskId: 'coverage-test-123',
      toolName: 'Read',
      toolArguments: { file_path: 'src/secrets/api-key.txt' },
      metadata: {
        workflowId: 'workflow-123',
        testRun: true,
      },
    };

    it('should support strict enforcement mode', async () => {
      const result = await engine.checkPolicy(testContext, {
        enforcementMode: 'strict',
      });

      expect(result.status).toBe('deny');
      expect(result.enforcementMode).toBe('strict');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].blocking).toBe(true);
      expect(result.violations[0].severity).toBe('high');
      expect(result.rulesEvaluated).toBeGreaterThan(0);
      expect(result.rulesFailed).toBeGreaterThan(0);
      expect(result.policyId).toBe('policy-engine-config');
      expect(result.policyName).toBe('Test Policy Configuration');
    });

    it('should support warn enforcement mode', async () => {
      const warnContext: PolicyCheckContext = {
        ...testContext,
        resource: 'config/sensitive.json', // Triggers medium severity, not high
      };

      const result = await engine.checkPolicy(warnContext, {
        enforcementMode: 'warn',
      });

      expect(result.status).toBe('allow'); // Warns don't block in warn mode
      expect(result.enforcementMode).toBe('warn');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('medium');
      expect(result.rulesEvaluated).toBeGreaterThan(0);
    });

    it('should support audit enforcement mode', async () => {
      const result = await engine.checkPolicy(testContext, {
        enforcementMode: 'audit',
      });

      expect(result.status).toBe('allow'); // Audit never blocks
      expect(result.enforcementMode).toBe('audit');
      expect(result.violations.length).toBeGreaterThan(0); // Still records violations
      expect(result.violations[0].blocking).toBe(true); // But doesn't block
      expect(result.rulesEvaluated).toBeGreaterThan(0);
      expect(result.metadata?.legacyEvaluation).toBe(true);
    });

    it('should support disabled enforcement mode with correct structure', async () => {
      const result = await engine.checkPolicy(testContext, {
        enforcementMode: 'disabled',
      });

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('disabled');
      expect(result.violations).toHaveLength(0);
      expect(result.rulesEvaluated).toBe(0);
      expect(result.rulesPassed).toBe(0);
      expect(result.rulesFailed).toBe(0);
      expect(result.metadata).toEqual({ disabled: true });
      expect(result.policyId).toBe('policy-engine-config');
      expect(typeof result.durationMs).toBe('number');
      expect(result.checkedAt).toBeInstanceOf(Date);
    });
  });

  describe('enforcement mode management methods', () => {
    it('should get current enforcement mode', () => {
      const mode = engine.getEnforcementMode();
      expect(mode).toBe('warn'); // From config
      expect(['strict', 'warn', 'audit', 'disabled']).toContain(mode);
    });

    it('should set enforcement mode to all valid values', () => {
      const modes: PolicyEnforcementMode[] = ['strict', 'warn', 'audit', 'disabled'];

      modes.forEach(mode => {
        engine.setEnforcementMode(mode);
        expect(engine.getEnforcementMode()).toBe(mode);
      });
    });
  });

  describe('policy management interface methods', () => {
    const testPolicy: Policy = {
      id: 'test-coverage-policy',
      name: 'Test Coverage Policy',
      description: 'Policy for testing coverage',
      enabled: true,
      enforcement: 'strict',
      type: 'path',
      rules: [
        {
          id: 'test-rule-1',
          name: 'Test blocking rule',
          condition: 'path.includes("test")',
          action: 'deny',
          severity: 'high',
        },
      ],
      config: {
        mode: 'allowlist',
        allowedPaths: ['src/**'],
        blockedPaths: ['test/**'],
      },
      tags: ['test', 'coverage'],
      metadata: { testPolicy: true },
    };

    it('should register policy', () => {
      expect(engine.hasPolicy('test-coverage-policy')).toBe(false);

      engine.registerPolicy(testPolicy);

      expect(engine.hasPolicy('test-coverage-policy')).toBe(true);
      expect(engine.getPolicy('test-coverage-policy')).toEqual(testPolicy);
    });

    it('should get all policies', () => {
      expect(engine.getPolicies()).toHaveLength(0);

      engine.registerPolicy(testPolicy);

      const policies = engine.getPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0]).toEqual(testPolicy);
    });

    it('should unregister policy', () => {
      engine.registerPolicy(testPolicy);
      expect(engine.hasPolicy('test-coverage-policy')).toBe(true);

      const removed = engine.unregisterPolicy('test-coverage-policy');

      expect(removed).toBe(true);
      expect(engine.hasPolicy('test-coverage-policy')).toBe(false);
      expect(engine.getPolicy('test-coverage-policy')).toBeUndefined();
    });

    it('should return false when unregistering non-existent policy', () => {
      const removed = engine.unregisterPolicy('non-existent-policy');
      expect(removed).toBe(false);
    });

    it('should clear all policies', () => {
      engine.registerPolicy(testPolicy);
      engine.registerPolicy({ ...testPolicy, id: 'another-policy' });

      expect(engine.getPolicies()).toHaveLength(2);

      engine.clearPolicies();

      expect(engine.getPolicies()).toHaveLength(0);
    });
  });

  describe('PolicyCheckResult structure validation', () => {
    it('should return complete PolicyCheckResult for all enforcement modes', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/index.ts',
        agentId: 'test-agent',
        taskId: 'structure-test',
      };

      const modes: PolicyEnforcementMode[] = ['strict', 'warn', 'audit', 'disabled'];

      for (const mode of modes) {
        const result = await engine.checkPolicy(context, {
          enforcementMode: mode,
        });

        // Verify all required fields are present
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('violations');
        expect(result).toHaveProperty('enforcementMode');
        expect(result).toHaveProperty('checkedAt');
        expect(result).toHaveProperty('policyName');
        expect(result).toHaveProperty('policyId');
        expect(result).toHaveProperty('rulesEvaluated');
        expect(result).toHaveProperty('rulesPassed');
        expect(result).toHaveProperty('rulesFailed');
        expect(result).toHaveProperty('durationMs');
        expect(result).toHaveProperty('metadata');

        // Verify types
        expect(['allow', 'deny']).toContain(result.status);
        expect(Array.isArray(result.violations)).toBe(true);
        expect(result.enforcementMode).toBe(mode);
        expect(result.checkedAt).toBeInstanceOf(Date);
        expect(typeof result.rulesEvaluated).toBe('number');
        expect(typeof result.rulesPassed).toBe('number');
        expect(typeof result.rulesFailed).toBe('number');
        expect(typeof result.durationMs).toBe('number');
        expect(typeof result.metadata).toBe('object');
      }
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle context without optional fields', async () => {
      const minimalContext: PolicyCheckContext = {
        action: 'test_action',
        agentId: 'test-agent',
      };

      const result = await engine.checkPolicy(minimalContext);

      expect(result.status).toBeDefined();
      expect(result.enforcementMode).toBe('warn'); // Default from engine
    });

    it('should handle context with all optional fields', async () => {
      const fullContext: PolicyCheckContext = {
        action: 'file_write',
        resource: 'src/test.ts',
        agentId: 'developer',
        taskId: 'task-full-123',
        toolName: 'Write',
        toolArguments: {
          file_path: 'src/test.ts',
          content: 'test content',
        },
        metadata: {
          workflowId: 'workflow-456',
          stage: 'development',
          priority: 'high',
        },
      };

      const result = await engine.checkPolicy(fullContext);

      expect(result.status).toBeDefined();
      expect(result.metadata?.legacyEvaluation).toBe(true);
    });

    it('should handle different combinations of options', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/secrets/test.env',
        agentId: 'test-agent',
      };

      // Test with maxViolations and enforcement mode
      const result = await engine.checkPolicy(context, {
        enforcementMode: 'strict',
        maxViolations: 2,
      });

      expect(result.enforcementMode).toBe('strict');
      expect(result.violations.length).toBeLessThanOrEqual(2);
    });
  });
});
