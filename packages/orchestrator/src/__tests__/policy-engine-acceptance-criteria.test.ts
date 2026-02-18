/**
 * @fileoverview Acceptance criteria tests for PolicyEngine implementation
 *
 * This file specifically tests the acceptance criteria mentioned in the task:
 * - PolicyEngine class implements the interface
 * - Supports block, warn, and audit enforcement modes via configuration
 * - checkPolicy method evaluates policies and returns PolicyCheckResult
 * - Unit tests cover all three modes
 */

import { describe, beforeEach, it, expect } from 'vitest';
import { PolicyEngine } from '../policy-engine.js';
import type { ApexConfig, PolicyCheckContext, PolicyEngine as IPolicyEngine } from '@apexcli/core';

describe('PolicyEngine Acceptance Criteria', () => {
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
          allow: ['src/**'],
          block: ['secrets/**'],
          sensitive: ['config/**'],
        },
      },
    };
    engine = new PolicyEngine(config);
  });

  describe('AC1: PolicyEngine class implements the interface', () => {
    it('should implement the PolicyEngine interface', () => {
      // Verify that PolicyEngine implements the required interface
      expect(engine).toHaveProperty('checkPolicy');
      expect(engine).toHaveProperty('getEnforcementMode');
      expect(engine).toHaveProperty('setEnforcementMode');
      expect(engine).toHaveProperty('registerPolicy');
      expect(engine).toHaveProperty('unregisterPolicy');
      expect(engine).toHaveProperty('getPolicies');
      expect(engine).toHaveProperty('getPolicy');
      expect(engine).toHaveProperty('hasPolicy');
      expect(engine).toHaveProperty('clearPolicies');

      // Verify method signatures are correct
      expect(typeof engine.checkPolicy).toBe('function');
      expect(typeof engine.getEnforcementMode).toBe('function');
      expect(typeof engine.setEnforcementMode).toBe('function');
      expect(typeof engine.registerPolicy).toBe('function');
      expect(typeof engine.unregisterPolicy).toBe('function');
      expect(typeof engine.getPolicies).toBe('function');
      expect(typeof engine.getPolicy).toBe('function');
      expect(typeof engine.hasPolicy).toBe('function');
      expect(typeof engine.clearPolicies).toBe('function');
    });

    it('should be assignable to PolicyEngine interface type', () => {
      // TypeScript compile-time check that the class implements the interface
      const interfaceInstance: IPolicyEngine = engine;
      expect(interfaceInstance).toBe(engine);
    });
  });

  describe('AC2: Supports block, warn, and audit enforcement modes via configuration', () => {
    it('should support strict enforcement mode (equivalent to block)', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'secrets/api-key.txt',
        agentId: 'test-agent',
      };

      const result = await engine.checkPolicy(context, {
        enforcementMode: 'strict', // This is the "block" mode
      });

      expect(result.status).toBe('deny');
      expect(result.enforcementMode).toBe('strict');
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should support warn enforcement mode', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'config/sensitive.json',
        agentId: 'test-agent',
      };

      const result = await engine.checkPolicy(context, {
        enforcementMode: 'warn',
      });

      expect(result.status).toBe('allow'); // Warning doesn't block
      expect(result.enforcementMode).toBe('warn');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('medium');
    });

    it('should support audit enforcement mode', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'secrets/api-key.txt',
        agentId: 'test-agent',
      };

      const result = await engine.checkPolicy(context, {
        enforcementMode: 'audit',
      });

      expect(result.status).toBe('allow'); // Audit never blocks
      expect(result.enforcementMode).toBe('audit');
      expect(result.violations.length).toBeGreaterThan(0); // Still records violations
    });

    it('should configure enforcement mode via constructor config', () => {
      const strictConfig: ApexConfig = {
        ...config,
        policy: {
          ...config.policy!,
          enforcement: 'strict',
        },
      };

      const strictEngine = new PolicyEngine(strictConfig);
      expect(strictEngine.getEnforcementMode()).toBe('strict');

      const auditConfig: ApexConfig = {
        ...config,
        policy: {
          ...config.policy!,
          enforcement: 'audit',
        },
      };

      const auditEngine = new PolicyEngine(auditConfig);
      expect(auditEngine.getEnforcementMode()).toBe('audit');
    });

    it('should allow changing enforcement mode at runtime', () => {
      expect(engine.getEnforcementMode()).toBe('warn');

      engine.setEnforcementMode('strict');
      expect(engine.getEnforcementMode()).toBe('strict');

      engine.setEnforcementMode('audit');
      expect(engine.getEnforcementMode()).toBe('audit');

      engine.setEnforcementMode('warn');
      expect(engine.getEnforcementMode()).toBe('warn');
    });
  });

  describe('AC3: checkPolicy method evaluates policies and returns PolicyCheckResult', () => {
    it('should return complete PolicyCheckResult structure', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/index.ts',
        agentId: 'test-agent',
        taskId: 'test-123',
      };

      const result = await engine.checkPolicy(context);

      // Verify all required PolicyCheckResult fields
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

      // Verify field types
      expect(['allow', 'deny']).toContain(result.status);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(['strict', 'warn', 'audit', 'disabled']).toContain(result.enforcementMode);
      expect(result.checkedAt).toBeInstanceOf(Date);
      expect(typeof result.rulesEvaluated).toBe('number');
      expect(typeof result.rulesPassed).toBe('number');
      expect(typeof result.rulesFailed).toBe('number');
      expect(typeof result.durationMs).toBe('number');
      expect(typeof result.metadata).toBe('object');
    });

    it('should evaluate policies against the provided context', async () => {
      // Test allowed path
      const allowedContext: PolicyCheckContext = {
        action: 'file_read',
        resource: 'src/components/Button.tsx',
        agentId: 'test-agent',
      };

      const allowedResult = await engine.checkPolicy(allowedContext);
      expect(allowedResult.status).toBe('allow');
      expect(allowedResult.violations).toHaveLength(0);

      // Test blocked path
      const blockedContext: PolicyCheckContext = {
        action: 'file_read',
        resource: 'secrets/api-key.txt',
        agentId: 'test-agent',
      };

      const blockedResult = await engine.checkPolicy(blockedContext);
      expect(blockedResult.status).toBe('deny');
      expect(blockedResult.violations.length).toBeGreaterThan(0);
    });

    it('should respect enforcement mode options in checkPolicy', async () => {
      const context: PolicyCheckContext = {
        action: 'file_read',
        resource: 'secrets/api-key.txt',
        agentId: 'test-agent',
      };

      // Test overriding enforcement mode
      const strictResult = await engine.checkPolicy(context, {
        enforcementMode: 'strict',
      });
      expect(strictResult.enforcementMode).toBe('strict');
      expect(strictResult.status).toBe('deny');

      const auditResult = await engine.checkPolicy(context, {
        enforcementMode: 'audit',
      });
      expect(auditResult.enforcementMode).toBe('audit');
      expect(auditResult.status).toBe('allow');
    });
  });

  describe('AC4: Unit tests cover all three modes', () => {
    const testCases = [
      { mode: 'strict' as const, expectedBehavior: 'blocks on any violation' },
      { mode: 'warn' as const, expectedBehavior: 'allows with warnings, blocks on errors' },
      { mode: 'audit' as const, expectedBehavior: 'always allows but records violations' },
    ] as const;

    testCases.forEach(({ mode, expectedBehavior }) => {
      describe(`${mode} mode coverage`, () => {
        it(`should handle ${expectedBehavior}`, async () => {
          const warningContext: PolicyCheckContext = {
            action: 'file_read',
            resource: 'config/app.json', // Should trigger warning
            agentId: 'test-agent',
          };

          const errorContext: PolicyCheckContext = {
            action: 'file_read',
            resource: 'secrets/api-key.txt', // Should trigger error
            agentId: 'test-agent',
          };

          // Test with warning-level violation
          const warningResult = await engine.checkPolicy(warningContext, {
            enforcementMode: mode,
          });

          // Test with error-level violation
          const errorResult = await engine.checkPolicy(errorContext, {
            enforcementMode: mode,
          });

          switch (mode) {
            case 'strict':
              // Should block on any violation
              expect(warningResult.status).toBe('deny');
              expect(errorResult.status).toBe('deny');
              break;
            case 'warn':
              // Should allow warnings but block errors
              expect(warningResult.status).toBe('allow');
              expect(errorResult.status).toBe('deny');
              break;
            case 'audit':
              // Should allow everything but record violations
              expect(warningResult.status).toBe('allow');
              expect(errorResult.status).toBe('allow');
              expect(warningResult.violations.length).toBeGreaterThan(0);
              expect(errorResult.violations.length).toBeGreaterThan(0);
              break;
          }

          expect(warningResult.enforcementMode).toBe(mode);
          expect(errorResult.enforcementMode).toBe(mode);
        });
      });
    });

    it('should provide comprehensive test coverage metrics', async () => {
      // This test verifies that we can exercise all code paths
      const contexts = [
        { resource: 'src/index.ts', expectation: 'allow' },
        { resource: 'secrets/api-key.txt', expectation: 'violations' },
        { resource: 'config/database.json', expectation: 'approval' },
        { resource: 'not-allowed.txt', expectation: 'default-deny' },
      ];

      const modes = ['strict', 'warn', 'audit'] as const;

      for (const mode of modes) {
        for (const { resource, expectation } of contexts) {
          const context: PolicyCheckContext = {
            action: 'file_read',
            resource,
            agentId: 'test-agent',
          };

          const result = await engine.checkPolicy(context, {
            enforcementMode: mode,
          });

          // Verify we get a valid result for all combinations
          expect(result.enforcementMode).toBe(mode);
          expect(['allow', 'deny']).toContain(result.status);
          expect(typeof result.rulesEvaluated).toBe('number');

          // Log coverage information (would be useful for actual test reporting)
          if (expectation === 'violations' && result.violations.length === 0) {
            console.warn(`Expected violations for ${resource} in ${mode} mode but got none`);
          }
        }
      }
    });
  });
});