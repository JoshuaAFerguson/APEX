// This file verifies that all imports in our test files are correct
// It imports everything we use in tests to ensure no runtime errors

// Test framework imports
import { describe, it, expect } from 'vitest';

// All the schemas we test
import {
  PolicyConfigSchema,
  AllowedPathsConfigSchema,
  RequiredTestsConfigSchema,
  ApprovalRulesConfigSchema,
  TestRequirementRuleSchema,
  ApprovalRuleSchema,
  ApprovalConditionSchema,
  PathAccessModeSchema,
  TestEnforcementLevelSchema,
  PolicyEnforcementModeSchema,
  ApprovalUrgencySchema,
} from '../types';

// All the types we use
import type {
  PolicyConfig,
  AllowedPathsConfig,
  RequiredTestsConfig,
  ApprovalRulesConfig,
} from '../types';

// Verify that schemas are callable (they should be Zod schemas)
describe('Import Verification', () => {
  it('should import all schemas correctly', () => {
    // Test that all schemas are defined and callable
    expect(typeof PolicyConfigSchema.parse).toBe('function');
    expect(typeof AllowedPathsConfigSchema.parse).toBe('function');
    expect(typeof RequiredTestsConfigSchema.parse).toBe('function');
    expect(typeof ApprovalRulesConfigSchema.parse).toBe('function');
    expect(typeof TestRequirementRuleSchema.parse).toBe('function');
    expect(typeof ApprovalRuleSchema.parse).toBe('function');
    expect(typeof ApprovalConditionSchema.parse).toBe('function');
    expect(typeof PathAccessModeSchema.parse).toBe('function');
    expect(typeof TestEnforcementLevelSchema.parse).toBe('function');
    expect(typeof PolicyEnforcementModeSchema.parse).toBe('function');
    expect(typeof ApprovalUrgencySchema.parse).toBe('function');
  });

  it('should create valid type instances', () => {
    // Test that types can be used correctly
    const policyConfig: PolicyConfig = {
      version: '1.0',
      enforcement: 'warn',
      enabled: true,
      tags: []
    };

    const allowedPaths: AllowedPathsConfig = {
      mode: 'allowlist',
      allow: [],
      block: []
    };

    const requiredTests: RequiredTestsConfig = {
      enforcement: 'warn',
      rules: []
    };

    const approvalRules: ApprovalRulesConfig = {
      enabled: true,
      rules: [],
      defaultTimeoutMinutes: 60,
      defaultTimeoutAction: 'reject',
      globalApprovers: [],
      notificationsEnabled: true
    };

    expect(policyConfig).toBeDefined();
    expect(allowedPaths).toBeDefined();
    expect(requiredTests).toBeDefined();
    expect(approvalRules).toBeDefined();
  });

  it('should validate basic configurations', () => {
    // Test that basic parsing works
    expect(() => PolicyConfigSchema.parse({})).not.toThrow();
    expect(() => AllowedPathsConfigSchema.parse({})).not.toThrow();
    expect(() => RequiredTestsConfigSchema.parse({})).not.toThrow();
    expect(() => ApprovalRulesConfigSchema.parse({})).not.toThrow();

    expect(() => PathAccessModeSchema.parse('allowlist')).not.toThrow();
    expect(() => TestEnforcementLevelSchema.parse('warn')).not.toThrow();
    expect(() => PolicyEnforcementModeSchema.parse('warn')).not.toThrow();
    expect(() => ApprovalUrgencySchema.parse('normal')).not.toThrow();
  });
});

// Export to verify module can be imported
export const verificationComplete = true;