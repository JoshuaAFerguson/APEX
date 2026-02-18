import { describe, it, expect, beforeEach } from 'vitest';
import {
  PolicyEngine,
  PolicyCheckResult,
  PolicyCheckResultSchema,
  PolicyCheckContext,
  PolicyCheckContextSchema,
  PolicyCheckOptions,
  PolicyCheckOptionsSchema,
  Policy,
  PolicyViolation,
  PolicyViolationSchema,
  type PolicyEngine as PolicyEngineType,
  type PolicyCheckResult as PolicyCheckResultType,
  type PolicyCheckContext as PolicyCheckContextType,
  type PolicyCheckOptions as PolicyCheckOptionsType,
  type PolicyViolation as PolicyViolationType,
  type Policy as PolicyType,
} from '../types';

/**
 * Advanced mock PolicyEngine implementation for integration testing
 */
class AdvancedMockPolicyEngine implements PolicyEngineType {
  private policies: PolicyType[] = [];
  private enforcementMode = 'strict' as const;

  async checkPolicy(
    context: PolicyCheckContextType,
    options?: PolicyCheckOptionsType
  ): Promise<PolicyCheckResultType> {
    // Validate inputs using schemas
    const validatedContext = PolicyCheckContextSchema.parse(context);
    const validatedOptions = options ? PolicyCheckOptionsSchema.parse(options) : {};

    // Simulate policy evaluation based on registered policies
    const violations = await this.evaluatePolicies(validatedContext, validatedOptions);

    // Apply options constraints
    const maxViolations = validatedOptions.maxViolations || 0;
    const filteredViolations = maxViolations > 0
      ? violations.slice(0, maxViolations)
      : violations;

    // Filter by warnings if specified
    const finalViolations = validatedOptions.includeWarnings === false
      ? filteredViolations.filter(v => v.blocking)
      : filteredViolations;

    // Determine status based on violations and enforcement mode
    const effectiveEnforcement = validatedOptions.enforcementMode || this.enforcementMode;
    const hasBlockingViolations = finalViolations.some(v => v.blocking);

    let status: 'allow' | 'deny' = 'allow';
    if (hasBlockingViolations && effectiveEnforcement === 'strict') {
      status = 'deny';
    }

    const result: PolicyCheckResultType = {
      status,
      violations: finalViolations,
      enforcementMode: effectiveEnforcement,
      checkedAt: new Date(),
      policyName: this.policies.length > 0 ? this.policies[0].name : 'MockPolicyEngine',
      policyId: this.policies.length > 0 ? this.policies[0].id : 'mock-engine',
      rulesEvaluated: this.policies.length,
      rulesPassed: this.policies.length - violations.length,
      rulesFailed: violations.length,
      durationMs: Math.floor(Math.random() * 100) + 10, // Simulate processing time
      metadata: {
        engineVersion: '1.0.0',
        evaluationId: `eval-${Date.now()}`,
        contextHash: this.hashContext(validatedContext)
      }
    };

    // Validate result before returning
    return PolicyCheckResultSchema.parse(result);
  }

  private async evaluatePolicies(
    context: PolicyCheckContextType,
    options: PolicyCheckOptionsType
  ): Promise<PolicyViolationType[]> {
    const violations: PolicyViolationType[] = [];
    const policiesToCheck = options.policyIds
      ? this.policies.filter(p => options.policyIds!.includes(p.id))
      : this.policies;

    for (const policy of policiesToCheck) {
      if (!policy.enabled) continue;

      const policyViolations = await this.evaluatePolicy(policy, context);
      violations.push(...policyViolations);

      // Stop early if requested
      if (!options.continueOnViolation && violations.length > 0) {
        break;
      }
    }

    return violations;
  }

  private async evaluatePolicy(
    policy: PolicyType,
    context: PolicyCheckContextType
  ): Promise<PolicyViolationType[]> {
    const violations: PolicyViolationType[] = [];

    // Simulate different policy type evaluations
    switch (policy.type) {
      case 'path':
        violations.push(...this.evaluatePathPolicy(policy, context));
        break;
      case 'test':
        violations.push(...this.evaluateTestPolicy(policy, context));
        break;
      case 'approval':
        violations.push(...this.evaluateApprovalPolicy(policy, context));
        break;
    }

    return violations;
  }

  private evaluatePathPolicy(policy: PolicyType, context: PolicyCheckContextType): PolicyViolationType[] {
    if (policy.type !== 'path') return [];

    const violations: PolicyViolationType[] = [];

    // Simulate path policy violations
    if (context.filePaths) {
      for (const filePath of context.filePaths) {
        if (filePath.includes('secret') || filePath.includes('.env')) {
          violations.push({
            id: `path-violation-${Date.now()}-${Math.random()}`,
            rule: 'no-secrets-in-paths',
            message: `Potential secret file detected: ${filePath}`,
            severity: 'critical',
            blocking: true,
            timestamp: new Date(),
            policyType: 'path',
            context: {
              filePath,
              policyId: policy.id,
              rule: 'secrets-detection'
            }
          });
        }
      }
    }

    return violations;
  }

  private evaluateTestPolicy(policy: PolicyType, context: PolicyCheckContextType): PolicyViolationType[] {
    if (policy.type !== 'test') return [];

    const violations: PolicyViolationType[] = [];

    // Simulate test policy violations
    if (context.action === 'command_execute' && !context.toolArguments?.command?.includes('test')) {
      violations.push({
        id: `test-violation-${Date.now()}-${Math.random()}`,
        rule: 'tests-required-before-implementation',
        message: 'Tests should be run before implementation changes',
        severity: 'warning',
        blocking: false,
        timestamp: new Date(),
        policyType: 'test',
        context: {
          action: context.action,
          policyId: policy.id,
          stage: context.stage
        }
      });
    }

    return violations;
  }

  private evaluateApprovalPolicy(policy: PolicyType, context: PolicyCheckContextType): PolicyViolationType[] {
    if (policy.type !== 'approval') return [];

    const violations: PolicyViolationType[] = [];

    // Simulate approval policy violations
    if (context.stage === 'deployment' || context.action === 'api_call') {
      violations.push({
        id: `approval-violation-${Date.now()}-${Math.random()}`,
        rule: 'approval-required-for-deployment',
        message: 'Manual approval required for deployment actions',
        severity: 'info',
        blocking: true,
        timestamp: new Date(),
        policyType: 'approval',
        context: {
          action: context.action,
          stage: context.stage,
          policyId: policy.id,
          approvalRequired: true
        }
      });
    }

    return violations;
  }

  private hashContext(context: PolicyCheckContextType): string {
    // Simple hash for testing purposes
    return Buffer.from(JSON.stringify(context)).toString('base64').substring(0, 16);
  }

  getEnforcementMode() {
    return this.enforcementMode;
  }

  setEnforcementMode(mode: typeof this.enforcementMode): void {
    this.enforcementMode = mode;
  }

  registerPolicy(policy: PolicyType): void {
    this.policies.push(policy);
  }

  unregisterPolicy(policyId: string): boolean {
    const initialLength = this.policies.length;
    this.policies = this.policies.filter(p => p.id !== policyId);
    return this.policies.length < initialLength;
  }

  getPolicies(): PolicyType[] {
    return [...this.policies];
  }

  getPolicy(policyId: string): PolicyType | undefined {
    return this.policies.find(p => p.id === policyId);
  }

  hasPolicy(policyId: string): boolean {
    return this.policies.some(p => p.id === policyId);
  }

  clearPolicies(): void {
    this.policies = [];
  }
}

describe('PolicyEngine Integration Tests', () => {
  let engine: AdvancedMockPolicyEngine;

  beforeEach(() => {
    engine = new AdvancedMockPolicyEngine();
  });

  describe('End-to-End Policy Checking Workflow', () => {
    it('should handle complete policy checking workflow with no violations', async () => {
      // Register a path policy
      const pathPolicy: PolicyType = {
        id: 'safe-paths-policy',
        name: 'Safe Paths Policy',
        description: 'Ensures only safe paths are accessed',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'allowlist',
          allowedPaths: ['src/**/*.ts', 'tests/**/*.test.ts'],
          blockedPaths: ['**/*.secret', '**/node_modules/**']
        }
      };

      engine.registerPolicy(pathPolicy);

      // Create a context for safe file access
      const context: PolicyCheckContextType = {
        action: 'file_read',
        resource: 'src/components/Button.tsx',
        agentId: 'developer-agent',
        taskId: 'task-read-component',
        stage: 'implementation',
        toolName: 'Read',
        filePaths: ['src/components/Button.tsx'],
        userId: 'dev-user'
      };

      // Check policy with default options
      const result = await engine.checkPolicy(context);

      // Verify the result
      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(0);
      expect(result.enforcementMode).toBe('strict');
      expect(result.rulesEvaluated).toBe(1);
      expect(result.rulesPassed).toBe(1);
      expect(result.rulesFailed).toBe(0);
      expect(result.policyName).toBe('Safe Paths Policy');
      expect(result.metadata).toBeDefined();

      // Validate schema compliance
      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
    });

    it('should handle policy checking with violations and blocking', async () => {
      // Register multiple policies
      const pathPolicy: PolicyType = {
        id: 'security-path-policy',
        name: 'Security Path Policy',
        description: 'Blocks access to sensitive files',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'blocklist',
          allowedPaths: [],
          blockedPaths: ['**/*.secret', '**/.env*']
        }
      };

      const testPolicy: PolicyType = {
        id: 'test-requirement-policy',
        name: 'Test Requirement Policy',
        description: 'Requires tests for implementations',
        enabled: true,
        enforcement: 'warn',
        type: 'test',
        config: {
          enforcement: 'warn',
          coverage: { minimum: 80 },
          rules: []
        }
      };

      engine.registerPolicy(pathPolicy);
      engine.registerPolicy(testPolicy);

      // Create context that will trigger violations
      const context: PolicyCheckContextType = {
        action: 'file_write',
        resource: 'config/.env.secret',
        agentId: 'developer-agent',
        taskId: 'task-config-update',
        stage: 'implementation',
        toolName: 'Write',
        filePaths: ['config/.env.secret'],
        content: 'API_KEY=secret123',
        userId: 'dev-user',
        metadata: {
          sensitive: true
        }
      };

      const options: PolicyCheckOptionsType = {
        enforcementMode: 'strict',
        continueOnViolation: true,
        includeWarnings: true,
        maxViolations: 10
      };

      // Check policies
      const result = await engine.checkPolicy(context, options);

      // Verify violations are detected
      expect(result.status).toBe('deny');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.enforcementMode).toBe('strict');
      expect(result.rulesFailed).toBeGreaterThan(0);

      // Check violation structure
      const pathViolation = result.violations.find(v => v.policyType === 'path');
      expect(pathViolation).toBeDefined();
      expect(pathViolation?.blocking).toBe(true);
      expect(pathViolation?.severity).toBe('critical');

      // Validate each violation schema
      result.violations.forEach(violation => {
        expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
      });

      // Validate overall result schema
      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
    });

    it('should handle selective policy checking with policy IDs', async () => {
      // Register multiple policies
      const policies: PolicyType[] = [
        {
          id: 'path-policy-1',
          name: 'Path Policy 1',
          description: 'First path policy',
          enabled: true,
          enforcement: 'strict',
          type: 'path',
          config: { mode: 'allowlist', allowedPaths: [], blockedPaths: [] }
        },
        {
          id: 'test-policy-1',
          name: 'Test Policy 1',
          description: 'First test policy',
          enabled: true,
          enforcement: 'warn',
          type: 'test',
          config: { enforcement: 'warn', coverage: { minimum: 80 }, rules: [] }
        },
        {
          id: 'approval-policy-1',
          name: 'Approval Policy 1',
          description: 'First approval policy',
          enabled: true,
          enforcement: 'strict',
          type: 'approval',
          config: { conditions: [], timeoutMs: 300000, timeoutAction: 'deny' }
        }
      ];

      policies.forEach(policy => engine.registerPolicy(policy));

      const context: PolicyCheckContextType = {
        action: 'deployment',
        stage: 'deployment',
        agentId: 'deploy-agent',
        userId: 'deploy-user'
      };

      // Check only specific policies
      const options: PolicyCheckOptionsType = {
        policyIds: ['approval-policy-1'],
        continueOnViolation: true
      };

      const result = await engine.checkPolicy(context, options);

      // Should only evaluate the approval policy
      expect(result.rulesEvaluated).toBe(1);

      // Should have approval violation
      const approvalViolation = result.violations.find(v => v.policyType === 'approval');
      expect(approvalViolation).toBeDefined();

      // Validate result
      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
    });

    it('should handle different enforcement modes correctly', async () => {
      const policy: PolicyType = {
        id: 'test-enforcement-policy',
        name: 'Test Enforcement Policy',
        description: 'Policy for testing enforcement modes',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'blocklist',
          allowedPaths: [],
          blockedPaths: ['**/*.secret']
        }
      };

      engine.registerPolicy(policy);

      const context: PolicyCheckContextType = {
        action: 'file_access',
        filePaths: ['data/api.secret'],
        userId: 'test-user'
      };

      // Test strict mode
      const strictResult = await engine.checkPolicy(context, {
        enforcementMode: 'strict'
      });
      expect(strictResult.status).toBe('deny');
      expect(strictResult.enforcementMode).toBe('strict');

      // Test warn mode
      const warnResult = await engine.checkPolicy(context, {
        enforcementMode: 'warn'
      });
      expect(warnResult.status).toBe('allow'); // Violations don't block in warn mode
      expect(warnResult.enforcementMode).toBe('warn');

      // Test monitor mode
      const monitorResult = await engine.checkPolicy(context, {
        enforcementMode: 'monitor'
      });
      expect(monitorResult.status).toBe('allow'); // Violations don't block in monitor mode
      expect(monitorResult.enforcementMode).toBe('monitor');

      // All results should have violations logged
      [strictResult, warnResult, monitorResult].forEach(result => {
        expect(result.violations.length).toBeGreaterThan(0);
        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
      });
    });

    it('should handle complex real-world scenario with multiple violations', async () => {
      // Setup comprehensive policy suite
      const policies: PolicyType[] = [
        {
          id: 'security-policy',
          name: 'Security Policy',
          description: 'Security and secrets detection',
          enabled: true,
          enforcement: 'strict',
          type: 'path',
          config: {
            mode: 'blocklist',
            allowedPaths: [],
            blockedPaths: ['**/*.secret', '**/.env*', '**/credentials/**']
          }
        },
        {
          id: 'test-coverage-policy',
          name: 'Test Coverage Policy',
          description: 'Ensures adequate test coverage',
          enabled: true,
          enforcement: 'warn',
          type: 'test',
          config: {
            enforcement: 'warn',
            coverage: { minimum: 85, target: 95 },
            rules: []
          }
        },
        {
          id: 'deployment-approval-policy',
          name: 'Deployment Approval Policy',
          description: 'Requires approval for production deployments',
          enabled: true,
          enforcement: 'strict',
          type: 'approval',
          config: {
            conditions: [
              {
                field: 'stage',
                operator: 'equals',
                value: 'deployment',
                description: 'Deployment stage requires approval'
              }
            ],
            timeoutMs: 600000,
            timeoutAction: 'deny'
          }
        }
      ];

      policies.forEach(policy => engine.registerPolicy(policy));

      // Complex deployment scenario context
      const context: PolicyCheckContextType = {
        action: 'api_call',
        resource: 'https://production-api.example.com/deploy',
        agentId: 'deployment-agent',
        taskId: 'task-production-deployment',
        stage: 'deployment',
        toolName: 'WebFetch',
        toolArguments: {
          url: 'https://production-api.example.com/deploy',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer production-token'
          },
          body: JSON.stringify({
            version: '2.1.0',
            environment: 'production',
            configFiles: ['config/production.env', 'secrets/api.secret']
          })
        },
        filePaths: [
          'config/production.env',
          'secrets/api.secret',
          'src/deploy/deployer.ts'
        ],
        userId: 'deployment-user',
        metadata: {
          deploymentId: 'deploy-prod-20241201-001',
          environment: 'production',
          approvalStatus: 'pending',
          riskLevel: 'high'
        }
      };

      const options: PolicyCheckOptionsType = {
        enforcementMode: 'strict',
        continueOnViolation: true,
        includeWarnings: true,
        maxViolations: 20,
        timeoutMs: 30000
      };

      // Execute policy check
      const result = await engine.checkPolicy(context, options);

      // Comprehensive result validation
      expect(result).toBeDefined();
      expect(result.status).toBe('deny'); // Should be blocked due to violations
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.enforcementMode).toBe('strict');
      expect(result.rulesEvaluated).toBe(3);
      expect(result.rulesFailed).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);

      // Check for expected violation types
      const violationTypes = new Set(result.violations.map(v => v.policyType));
      expect(violationTypes.has('path')).toBe(true); // Security violations
      expect(violationTypes.has('approval')).toBe(true); // Approval required

      // Validate security violations
      const securityViolations = result.violations.filter(v => v.policyType === 'path');
      expect(securityViolations.length).toBeGreaterThan(0);
      securityViolations.forEach(violation => {
        expect(violation.blocking).toBe(true);
        expect(violation.severity).toBe('critical');
        expect(violation.context).toBeDefined();
      });

      // Validate approval violations
      const approvalViolations = result.violations.filter(v => v.policyType === 'approval');
      expect(approvalViolations.length).toBeGreaterThan(0);
      approvalViolations.forEach(violation => {
        expect(violation.blocking).toBe(true);
        expect(violation.context?.approvalRequired).toBe(true);
      });

      // Validate metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.engineVersion).toBeDefined();
      expect(result.metadata?.evaluationId).toBeDefined();
      expect(result.metadata?.contextHash).toBeDefined();

      // Comprehensive schema validation
      expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
      expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();

      result.violations.forEach(violation => {
        expect(() => PolicyViolationSchema.parse(violation)).not.toThrow();
      });
    });
  });

  describe('Policy Management Integration', () => {
    it('should handle dynamic policy registration and evaluation', async () => {
      // Start with no policies
      expect(engine.getPolicies()).toHaveLength(0);

      const context: PolicyCheckContextType = {
        action: 'file_write',
        filePaths: ['test.secret'],
        userId: 'test-user'
      };

      // Should pass with no policies
      let result = await engine.checkPolicy(context);
      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(0);

      // Add a policy dynamically
      const policy: PolicyType = {
        id: 'dynamic-security-policy',
        name: 'Dynamic Security Policy',
        description: 'Dynamically added security policy',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'blocklist',
          allowedPaths: [],
          blockedPaths: ['**/*.secret']
        }
      };

      engine.registerPolicy(policy);
      expect(engine.getPolicies()).toHaveLength(1);
      expect(engine.hasPolicy('dynamic-security-policy')).toBe(true);

      // Same context should now fail
      result = await engine.checkPolicy(context);
      expect(result.status).toBe('deny');
      expect(result.violations.length).toBeGreaterThan(0);

      // Remove the policy
      const removed = engine.unregisterPolicy('dynamic-security-policy');
      expect(removed).toBe(true);
      expect(engine.getPolicies()).toHaveLength(0);

      // Same context should pass again
      result = await engine.checkPolicy(context);
      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(0);
    });

    it('should handle policy enabling/disabling through replacement', async () => {
      const basePolicy: PolicyType = {
        id: 'toggleable-policy',
        name: 'Toggleable Policy',
        description: 'Policy that can be enabled/disabled',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'blocklist',
          allowedPaths: [],
          blockedPaths: ['**/*.secret']
        }
      };

      const context: PolicyCheckContextType = {
        action: 'file_access',
        filePaths: ['config.secret'],
        userId: 'test-user'
      };

      // Register enabled policy
      engine.registerPolicy(basePolicy);
      let result = await engine.checkPolicy(context);
      expect(result.status).toBe('deny');

      // Replace with disabled policy
      engine.unregisterPolicy('toggleable-policy');
      engine.registerPolicy({ ...basePolicy, enabled: false });

      result = await engine.checkPolicy(context);
      expect(result.status).toBe('allow'); // Disabled policy shouldn't trigger violations
      expect(result.rulesEvaluated).toBe(1); // Policy is still evaluated but skipped
    });
  });

  describe('Performance and Limits Testing', () => {
    it('should handle maximum violations limit correctly', async () => {
      // Setup policy that will generate many violations
      const policy: PolicyType = {
        id: 'violation-generator-policy',
        name: 'Violation Generator Policy',
        description: 'Policy that generates multiple violations',
        enabled: true,
        enforcement: 'strict',
        type: 'path',
        config: {
          mode: 'blocklist',
          allowedPaths: [],
          blockedPaths: ['**/*.secret']
        }
      };

      engine.registerPolicy(policy);

      // Create context with many violating files
      const manySecretFiles = Array.from({ length: 50 }, (_, i) => `secret${i}.secret`);
      const context: PolicyCheckContextType = {
        action: 'bulk_file_access',
        filePaths: manySecretFiles,
        userId: 'test-user'
      };

      // Test with violation limit
      const options: PolicyCheckOptionsType = {
        maxViolations: 5,
        continueOnViolation: true
      };

      const result = await engine.checkPolicy(context, options);
      expect(result.violations).toHaveLength(5); // Should be limited to 5
      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
    });

    it('should handle large metadata and context objects', async () => {
      const policy: PolicyType = {
        id: 'metadata-test-policy',
        name: 'Metadata Test Policy',
        description: 'Policy for testing large metadata',
        enabled: true,
        enforcement: 'monitor',
        type: 'test',
        config: {
          enforcement: 'monitor',
          coverage: { minimum: 80 },
          rules: []
        }
      };

      engine.registerPolicy(policy);

      // Create large metadata object
      const largeMetadata: Record<string, unknown> = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key${i}`] = {
          value: `value${i}`,
          timestamp: new Date().toISOString(),
          data: Array.from({ length: 10 }, (_, j) => `item${j}`)
        };
      }

      const context: PolicyCheckContextType = {
        action: 'large_data_processing',
        metadata: largeMetadata,
        userId: 'test-user'
      };

      const result = await engine.checkPolicy(context);
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
    });
  });
});