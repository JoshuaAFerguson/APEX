/**
 * @fileoverview Integration tests for orchestrator enforcement mode handling
 *
 * Tests how the orchestrator handles different enforcement modes:
 * - resolveSecretDetectionBehavior method
 * - event emission for different enforcement modes
 * - policy enforcement integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import type {
  PolicyEngine as IPolicyEngine,
  PolicyCheckContext,
  PolicyCheckResult,
  PolicyEnforcementMode,
  ApexConfig,
} from '@apexcli/core';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Orchestrator Enforcement Mode Integration', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let mockPolicyEngine: MockPolicyEngine;

  class MockPolicyEngine implements IPolicyEngine {
    private enforcementMode: PolicyEnforcementMode = 'warn';
    private mockResult: PolicyCheckResult | null = null;

    setEnforcementMode(mode: PolicyEnforcementMode): void {
      this.enforcementMode = mode;
    }

    getEnforcementMode(): PolicyEnforcementMode {
      return this.enforcementMode;
    }

    setMockResult(result: PolicyCheckResult): void {
      this.mockResult = result;
    }

    async checkPolicy(context: PolicyCheckContext): Promise<PolicyCheckResult> {
      return this.mockResult || {
        status: 'allow',
        violations: [],
        enforcementMode: this.enforcementMode,
        checkedAt: new Date(),
        policyName: 'test-policy',
        policyId: 'test-id',
        rulesEvaluated: 0,
        rulesPassed: 0,
        rulesFailed: 0,
        durationMs: 1,
        metadata: {},
      };
    }

    // Required interface methods
    registerPolicy(): void {}
    unregisterPolicy(): boolean { return false; }
    getPolicies(): any[] { return []; }
    getPolicy(): any { return undefined; }
    hasPolicy(): boolean { return false; }
    clearPolicies(): void {}
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-enforcement-test-'));
    await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });

    mockPolicyEngine = new MockPolicyEngine();

    orchestrator = new ApexOrchestrator({ projectPath: tempDir,
      policyEngine: mockPolicyEngine,
    });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('resolveSecretDetectionBehavior method', () => {
    it('should map audit enforcement mode to log behavior', () => {
      // Access private method for testing
      const orchestratorPrivate = orchestrator as any;

      // Mock secret scanning config with audit mode
      orchestratorPrivate.effectiveConfig = {
        secretScanning: {
          enabled: true,
          enforcementMode: 'audit'
        }
      };

      const behavior = orchestratorPrivate.resolveSecretDetectionBehavior();
      expect(behavior).toBe('log');
    });

    it('should map block enforcement mode to block behavior', () => {
      const orchestratorPrivate = orchestrator as any;

      orchestratorPrivate.effectiveConfig = {
        secretScanning: {
          enabled: true,
          enforcementMode: 'block'
        }
      };

      const behavior = orchestratorPrivate.resolveSecretDetectionBehavior();
      expect(behavior).toBe('block');
    });

    it('should map warn enforcement mode to warn behavior', () => {
      const orchestratorPrivate = orchestrator as any;

      orchestratorPrivate.effectiveConfig = {
        secretScanning: {
          enabled: true,
          enforcementMode: 'warn'
        }
      };

      const behavior = orchestratorPrivate.resolveSecretDetectionBehavior();
      expect(behavior).toBe('warn');
    });

    it('should default to warn behavior when enforcement mode is undefined', () => {
      const orchestratorPrivate = orchestrator as any;

      orchestratorPrivate.effectiveConfig = {
        secretScanning: {
          enabled: true
          // enforcementMode not specified
        }
      };

      const behavior = orchestratorPrivate.resolveSecretDetectionBehavior();
      expect(behavior).toBe('warn');
    });

    it('should handle disabled secret scanning', () => {
      const orchestratorPrivate = orchestrator as any;

      orchestratorPrivate.effectiveConfig = {
        secretScanning: {
          enabled: false,
          enforcementMode: 'block'
        }
      };

      const behavior = orchestratorPrivate.resolveSecretDetectionBehavior();
      // Should still return the configured behavior even if disabled
      expect(behavior).toBe('block');
    });
  });

  describe('policy enforcement mode handling', () => {
    it('should handle audit enforcement mode correctly', async () => {
      mockPolicyEngine.setEnforcementMode('audit');

      const auditEvents: any[] = [];
      orchestrator.on('policy:audited', (event) => auditEvents.push(event));

      const mockViolations = [{
        id: 'test-violation',
        rule: 'test-rule',
        message: 'Test violation',
        severity: 'warning' as const,
        blocking: false,
        policyType: 'test',
        description: 'Test description',
        resource: '/test/resource',
        context: {},
        timestamp: new Date(),
      }];

      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: mockViolations,
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'test-policy',
        policyId: 'test-id',
        rulesEvaluated: 1,
        rulesPassed: 0,
        rulesFailed: 1,
        durationMs: 5,
        metadata: {},
      });

      // Test the policy enforcement logic
      const orchestratorPrivate = orchestrator as any;
      const handled = await orchestratorPrivate.handlePolicyViolations(
        mockViolations,
        'audit',
        { id: 'test-task', status: 'running' },
        { action: 'test-action', agentName: 'test-agent' }
      );

      expect(handled).toBe(true);
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0].enforcementMode).toBe('audit');
    });

    it('should handle block enforcement mode correctly', async () => {
      mockPolicyEngine.setEnforcementMode('strict');

      const blockEvents: any[] = [];
      orchestrator.on('policy:blocked', (event) => blockEvents.push(event));

      const mockViolations = [{
        id: 'blocking-violation',
        rule: 'blocking-rule',
        message: 'Blocking violation',
        severity: 'error' as const,
        blocking: true,
        policyType: 'security',
        description: 'This violation blocks execution',
        resource: '/restricted/path',
        context: {},
        timestamp: new Date(),
      }];

      const orchestratorPrivate = orchestrator as any;
      const handled = await orchestratorPrivate.handlePolicyViolations(
        mockViolations,
        'strict',
        { id: 'test-task', status: 'running' },
        { action: 'restricted-action', agentName: 'test-agent' }
      );

      expect(handled).toBe(false); // Should return false for blocked actions
      expect(blockEvents).toHaveLength(1);
      expect(blockEvents[0].enforcementMode).toBe('strict');
    });

    it('should handle warn enforcement mode correctly', async () => {
      const warnEvents: any[] = [];
      orchestrator.on('policy:warned', (event) => warnEvents.push(event));

      const mockViolations = [{
        id: 'warning-violation',
        rule: 'warning-rule',
        message: 'Warning violation',
        severity: 'warning' as const,
        blocking: false,
        policyType: 'style',
        description: 'This violation generates a warning',
        resource: '/warn/path',
        context: {},
        timestamp: new Date(),
      }];

      const orchestratorPrivate = orchestrator as any;
      const handled = await orchestratorPrivate.handlePolicyViolations(
        mockViolations,
        'warn',
        { id: 'test-task', status: 'running' },
        { action: 'warn-action', agentName: 'test-agent' }
      );

      expect(handled).toBe(true); // Should return true for warn mode
      expect(warnEvents).toHaveLength(1);
      expect(warnEvents[0].enforcementMode).toBe('warn');
    });

    it('should handle disabled enforcement mode', async () => {
      const orchestratorPrivate = orchestrator as any;

      const handled = await orchestratorPrivate.handlePolicyViolations(
        [], // empty violations
        'disabled',
        { id: 'test-task', status: 'running' },
        { action: 'any-action', agentName: 'test-agent' }
      );

      expect(handled).toBe(true); // Should always return true when disabled
    });
  });

  describe('resolvePolicyEnforcementMode method', () => {
    it('should resolve policy enforcement mode correctly', () => {
      const orchestratorPrivate = orchestrator as any;

      // Mock policy enforcer
      orchestratorPrivate.policyEnforcer = {
        enforcementMode: 'audit'
      };

      const mode = orchestratorPrivate.resolvePolicyEnforcementMode();
      expect(mode).toBe('audit');
    });

    it('should fall back to default when no policy enforcer', () => {
      const orchestratorPrivate = orchestrator as any;
      orchestratorPrivate.policyEnforcer = null;

      const mode = orchestratorPrivate.resolvePolicyEnforcementMode();
      expect(mode).toBe('warn'); // Default enforcement mode
    });
  });

  describe('event emission patterns', () => {
    it('should emit appropriate events for each enforcement mode', async () => {
      const allEvents: Array<{ type: string; data: any }> = [];

      orchestrator.on('policy:audited', (data) => allEvents.push({ type: 'audited', data }));
      orchestrator.on('policy:warned', (data) => allEvents.push({ type: 'warned', data }));
      orchestrator.on('policy:blocked', (data) => allEvents.push({ type: 'blocked', data }));

      const testViolation = {
        id: 'test-violation',
        rule: 'test-rule',
        message: 'Test message',
        severity: 'warning' as const,
        blocking: false,
        policyType: 'test',
        description: 'Test description',
        resource: '/test',
        context: {},
        timestamp: new Date(),
      };

      const orchestratorPrivate = orchestrator as any;
      const testTask = { id: 'test-task', status: 'running' };
      const testContext = { action: 'test-action', agentName: 'test-agent' };

      // Test audit mode
      await orchestratorPrivate.handlePolicyViolations([testViolation], 'audit', testTask, testContext);

      // Test warn mode
      await orchestratorPrivate.handlePolicyViolations([testViolation], 'warn', testTask, testContext);

      // Test strict/block mode
      await orchestratorPrivate.handlePolicyViolations([testViolation], 'strict', testTask, testContext);

      expect(allEvents).toHaveLength(3);
      expect(allEvents.find(e => e.type === 'audited')).toBeDefined();
      expect(allEvents.find(e => e.type === 'warned')).toBeDefined();
      expect(allEvents.find(e => e.type === 'blocked')).toBeDefined();
    });
  });

  describe('error handling in enforcement modes', () => {
    it('should handle empty violations array gracefully', async () => {
      const orchestratorPrivate = orchestrator as any;

      const result = await orchestratorPrivate.handlePolicyViolations(
        [], // empty violations
        'audit',
        { id: 'test-task', status: 'running' },
        { action: 'test-action', agentName: 'test-agent' }
      );

      expect(result).toBe(true);
    });

    it('should handle null violations gracefully', async () => {
      const orchestratorPrivate = orchestrator as any;

      const result = await orchestratorPrivate.handlePolicyViolations(
        null as any,
        'audit',
        { id: 'test-task', status: 'running' },
        { action: 'test-action', agentName: 'test-agent' }
      );

      expect(result).toBe(true);
    });
  });
});