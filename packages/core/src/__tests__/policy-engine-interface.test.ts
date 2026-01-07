import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PolicyEngine,
  PolicyCheckResult,
  PolicyCheckResultSchema,
  PolicyCheckContext,
  PolicyCheckContextSchema,
  PolicyCheckOptions,
  PolicyCheckOptionsSchema,
  PolicyCheckStatus,
  PolicyCheckStatusSchema,
  Policy,
  PolicyViolation,
  PolicyEnforcementMode,
  type PolicyViolation as PolicyViolationType,
  type PolicyCheckResult as PolicyCheckResultType,
  type PolicyCheckContext as PolicyCheckContextType,
  type PolicyCheckOptions as PolicyCheckOptionsType,
} from '../types';

/**
 * Mock implementation of PolicyEngine for testing purposes
 */
class MockPolicyEngine implements PolicyEngine {
  private policies: Policy[] = [];
  private enforcementMode: PolicyEnforcementMode = 'strict';
  private violations: PolicyViolationType[] = [];

  async checkPolicy(
    context: PolicyCheckContextType,
    options?: PolicyCheckOptionsType
  ): Promise<PolicyCheckResultType> {
    const enforcementMode = options?.enforcementMode || this.enforcementMode;
    const violations = this.violations.slice(0, options?.maxViolations || this.violations.length);

    return {
      status: violations.some(v => v.blocking) ? 'deny' : 'allow',
      violations,
      enforcementMode,
      checkedAt: new Date(),
      policyName: 'MockPolicy',
      policyId: 'mock-policy-1',
      rulesEvaluated: 5,
      rulesPassed: 3,
      rulesFailed: 2,
      durationMs: 100,
      metadata: {
        mockData: 'test'
      }
    };
  }

  getEnforcementMode(): PolicyEnforcementMode {
    return this.enforcementMode;
  }

  setEnforcementMode(mode: PolicyEnforcementMode): void {
    this.enforcementMode = mode;
  }

  registerPolicy(policy: Policy): void {
    this.policies.push(policy);
  }

  unregisterPolicy(policyId: string): boolean {
    const initialLength = this.policies.length;
    this.policies = this.policies.filter(p => p.id !== policyId);
    return this.policies.length < initialLength;
  }

  getPolicies(): Policy[] {
    return [...this.policies];
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.find(p => p.id === policyId);
  }

  hasPolicy(policyId: string): boolean {
    return this.policies.some(p => p.id === policyId);
  }

  clearPolicies(): void {
    this.policies = [];
  }

  // Test utility method to set violations for testing
  setViolations(violations: PolicyViolationType[]): void {
    this.violations = violations;
  }
}

describe('PolicyEngine Interface', () => {
  let policyEngine: MockPolicyEngine;

  beforeEach(() => {
    policyEngine = new MockPolicyEngine();
  });

  describe('Basic Interface Implementation', () => {
    it('should implement all required methods', () => {
      expect(typeof policyEngine.checkPolicy).toBe('function');
      expect(typeof policyEngine.getEnforcementMode).toBe('function');
      expect(typeof policyEngine.setEnforcementMode).toBe('function');
      expect(typeof policyEngine.registerPolicy).toBe('function');
      expect(typeof policyEngine.unregisterPolicy).toBe('function');
      expect(typeof policyEngine.getPolicies).toBe('function');
      expect(typeof policyEngine.getPolicy).toBe('function');
      expect(typeof policyEngine.hasPolicy).toBe('function');
      expect(typeof policyEngine.clearPolicies).toBe('function');
    });
  });

  describe('checkPolicy method', () => {
    it('should return valid PolicyCheckResult with minimal context', async () => {
      const context: PolicyCheckContextType = {
        action: 'file_write'
      };

      const result = await policyEngine.checkPolicy(context);

      expect(result).toBeDefined();
      expect(result.status).toMatch(/^(allow|deny)$/);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(typeof result.enforcementMode).toBe('string');
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('should handle complete context with all fields', async () => {
      const context: PolicyCheckContextType = {
        action: 'command_execute',
        resource: '/bin/bash',
        agentId: 'agent-123',
        taskId: 'task-456',
        stage: 'implementation',
        toolName: 'Bash',
        toolArguments: {
          command: 'ls -la',
          timeout: 5000
        },
        filePaths: ['/path/to/file1.ts', '/path/to/file2.js'],
        content: 'console.log("Hello World");',
        userId: 'user-789',
        metadata: {
          requestId: 'req-abc',
          sessionId: 'session-xyz'
        }
      };

      const result = await policyEngine.checkPolicy(context);

      expect(result).toBeDefined();
      expect(PolicyCheckResultSchema.parse(result)).toBeTruthy();
    });

    it('should respect options parameters', async () => {
      const violations: PolicyViolationType[] = [
        {
          id: 'v1',
          rule: 'test-rule-1',
          message: 'Test violation 1',
          severity: 'warning',
          blocking: false,
          timestamp: new Date(),
          policyType: 'path',
          context: { test: 'data1' }
        },
        {
          id: 'v2',
          rule: 'test-rule-2',
          message: 'Test violation 2',
          severity: 'critical',
          blocking: true,
          timestamp: new Date(),
          policyType: 'test',
          context: { test: 'data2' }
        }
      ];
      policyEngine.setViolations(violations);

      const context: PolicyCheckContextType = { action: 'test_action' };
      const options: PolicyCheckOptionsType = {
        enforcementMode: 'warn',
        maxViolations: 1
      };

      const result = await policyEngine.checkPolicy(context, options);

      expect(result.enforcementMode).toBe('warn');
      expect(result.violations).toHaveLength(1);
    });

    it('should return allow status when no blocking violations exist', async () => {
      const violations: PolicyViolationType[] = [
        {
          id: 'v1',
          rule: 'warning-rule',
          message: 'Warning violation',
          severity: 'warning',
          blocking: false,
          timestamp: new Date(),
          policyType: 'path',
          context: {}
        }
      ];
      policyEngine.setViolations(violations);

      const context: PolicyCheckContextType = { action: 'test_action' };
      const result = await policyEngine.checkPolicy(context);

      expect(result.status).toBe('allow');
    });

    it('should return deny status when blocking violations exist', async () => {
      const violations: PolicyViolationType[] = [
        {
          id: 'v1',
          rule: 'blocking-rule',
          message: 'Blocking violation',
          severity: 'critical',
          blocking: true,
          timestamp: new Date(),
          policyType: 'test',
          context: {}
        }
      ];
      policyEngine.setViolations(violations);

      const context: PolicyCheckContextType = { action: 'test_action' };
      const result = await policyEngine.checkPolicy(context);

      expect(result.status).toBe('deny');
    });
  });

  describe('Enforcement Mode Management', () => {
    it('should get and set enforcement mode', () => {
      expect(policyEngine.getEnforcementMode()).toBe('strict');

      policyEngine.setEnforcementMode('warn');
      expect(policyEngine.getEnforcementMode()).toBe('warn');

      policyEngine.setEnforcementMode('monitor');
      expect(policyEngine.getEnforcementMode()).toBe('monitor');
    });
  });

  describe('Policy Management', () => {
    const samplePolicy: Policy = {
      id: 'test-policy-1',
      name: 'Test Path Policy',
      description: 'A test path policy',
      enabled: true,
      enforcement: 'strict',
      type: 'path',
      config: {
        mode: 'allowlist',
        allowedPaths: ['src/**/*.ts', 'tests/**/*.test.ts'],
        blockedPaths: ['node_modules/**/*']
      },
      tags: ['test', 'path'],
      metadata: { testPolicy: true }
    };

    it('should register and retrieve policies', () => {
      expect(policyEngine.getPolicies()).toHaveLength(0);

      policyEngine.registerPolicy(samplePolicy);

      expect(policyEngine.getPolicies()).toHaveLength(1);
      expect(policyEngine.getPolicy('test-policy-1')).toEqual(samplePolicy);
      expect(policyEngine.hasPolicy('test-policy-1')).toBe(true);
    });

    it('should unregister policies correctly', () => {
      policyEngine.registerPolicy(samplePolicy);
      expect(policyEngine.hasPolicy('test-policy-1')).toBe(true);

      const removed = policyEngine.unregisterPolicy('test-policy-1');

      expect(removed).toBe(true);
      expect(policyEngine.hasPolicy('test-policy-1')).toBe(false);
      expect(policyEngine.getPolicy('test-policy-1')).toBeUndefined();
    });

    it('should return false when trying to unregister non-existent policy', () => {
      const removed = policyEngine.unregisterPolicy('non-existent-policy');
      expect(removed).toBe(false);
    });

    it('should clear all policies', () => {
      policyEngine.registerPolicy(samplePolicy);
      policyEngine.registerPolicy({
        ...samplePolicy,
        id: 'test-policy-2',
        name: 'Test Policy 2'
      });

      expect(policyEngine.getPolicies()).toHaveLength(2);

      policyEngine.clearPolicies();

      expect(policyEngine.getPolicies()).toHaveLength(0);
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

      policies.forEach(policy => policyEngine.registerPolicy(policy));

      expect(policyEngine.getPolicies()).toHaveLength(3);
      expect(policyEngine.hasPolicy('policy-1')).toBe(true);
      expect(policyEngine.hasPolicy('policy-2')).toBe(true);
      expect(policyEngine.hasPolicy('policy-3')).toBe(true);
    });
  });

  describe('Integration with Policy Types', () => {
    it('should work with path policies', () => {
      const pathPolicy: Policy = {
        id: 'path-policy-test',
        name: 'Path Policy',
        description: 'Test path policy',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'blocklist',
          allowedPaths: ['src/**/*'],
          blockedPaths: ['**/*.secret', '**/node_modules/**']
        }
      };

      policyEngine.registerPolicy(pathPolicy);

      const retrieved = policyEngine.getPolicy('path-policy-test');
      expect(retrieved?.type).toBe('path');
      expect(retrieved?.config.mode).toBe('blocklist');
    });

    it('should work with test policies', () => {
      const testPolicy: Policy = {
        id: 'test-policy-test',
        name: 'Test Policy',
        description: 'Test test policy',
        enabled: true,
        enforcement: 'strict',
        type: 'test',
        config: {
          enforcement: 'strict',
          coverage: { minimum: 85, target: 95 },
          rules: [
            {
              id: 'unit-tests',
              name: 'Unit Tests Required',
              description: 'All modules must have unit tests',
              enabled: true,
              enforcement: 'strict',
              pattern: '**/*.test.ts',
              command: 'npm test'
            }
          ]
        }
      };

      policyEngine.registerPolicy(testPolicy);

      const retrieved = policyEngine.getPolicy('test-policy-test');
      expect(retrieved?.type).toBe('test');
      expect(retrieved?.config.coverage.minimum).toBe(85);
    });

    it('should work with approval policies', () => {
      const approvalPolicy: Policy = {
        id: 'approval-policy-test',
        name: 'Approval Policy',
        description: 'Test approval policy',
        enabled: true,
        enforcement: 'strict',
        type: 'approval',
        config: {
          conditions: [
            {
              field: 'stage',
              operator: 'equals',
              value: 'implementation',
              description: 'Implementation stage requires approval'
            }
          ],
          timeoutMs: 600000,
          timeoutAction: 'deny'
        }
      };

      policyEngine.registerPolicy(approvalPolicy);

      const retrieved = policyEngine.getPolicy('approval-policy-test');
      expect(retrieved?.type).toBe('approval');
      expect(retrieved?.config.timeoutMs).toBe(600000);
    });
  });
});