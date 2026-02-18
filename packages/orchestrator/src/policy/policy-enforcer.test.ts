/**
 * @fileoverview Unit tests for PolicyEnforcer class
 *
 * Tests cover:
 * - Constructor and configuration
 * - File path validation with glob patterns
 * - Allowlist mode validation
 * - Blocklist mode validation
 * - Sensitive file pattern detection
 * - PolicyViolation generation
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEnforcer, createPolicyEnforcer } from './policy-enforcer.js';
import type { PolicyConfig, PolicyViolation, PolicyViolationEvent, Task } from '@apexcli/core';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock Task object with default values and any overrides
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task',
    description: 'Test task description',
    workflow: 'feature-development',
    autonomy: 'autonomous',
    status: 'pending',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/project',
    branchName: 'feature/test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.05,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  } as Task;
}

describe('PolicyEnforcer', () => {
  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create an instance with policy config', () => {
      const config: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
      };

      const enforcer = new PolicyEnforcer(config);

      expect(enforcer).toBeInstanceOf(PolicyEnforcer);
      expect(enforcer.policyConfig).toBe(config);
    });

    it('should store the enforcement mode', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
      };

      const enforcer = new PolicyEnforcer(config);

      expect(enforcer.enforcementMode).toBe('enforce');
    });

    it('should default enforcement mode to warn', () => {
      const config: PolicyConfig = {};

      const enforcer = new PolicyEnforcer(config);

      expect(enforcer.enforcementMode).toBe('warn');
    });

    it('should default enabled to true', () => {
      const config: PolicyConfig = {};

      const enforcer = new PolicyEnforcer(config);

      expect(enforcer.isEnabled).toBe(true);
    });

    it('should respect enabled=false in config', () => {
      const config: PolicyConfig = {
        enabled: false,
      };

      const enforcer = new PolicyEnforcer(config);

      expect(enforcer.isEnabled).toBe(false);
    });
  });

  // ============================================================================
  // validateFilePath Tests - Basic Scenarios
  // ============================================================================

  describe('validateFilePath', () => {
    describe('when policy is disabled', () => {
      it('should allow all paths', () => {
        const config: PolicyConfig = {
          enabled: false,
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['**/*'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const violations = enforcer.validateFilePath('/any/path/file.ts');

        expect(violations).toHaveLength(0);
      });
    });

    describe('when no allowedPaths configured', () => {
      it('should allow all paths', () => {
        const config: PolicyConfig = {
          enforcement: 'enforce',
        };

        const enforcer = new PolicyEnforcer(config);
        const violations = enforcer.validateFilePath('/any/path/file.ts');

        expect(violations).toHaveLength(0);
      });
    });

    describe('when empty path is provided', () => {
      it('should handle empty string gracefully', () => {
        const config: PolicyConfig = {
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const violations = enforcer.validateFilePath('');

        expect(violations).toHaveLength(1);
        expect(violations[0].policyType).toBe('path');
      });
    });
  });

  // ============================================================================
  // Allowlist Mode Tests
  // ============================================================================

  describe('allowlist mode', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'tests/**/*.test.ts', 'package.json', 'docs/*.md'],
          block: [],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should allow paths matching glob patterns', () => {
      expect(enforcer.validateFilePath('src/index.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('src/utils/helper.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('src/deep/nested/file.js')).toHaveLength(0);
    });

    it('should allow paths matching specific file patterns', () => {
      expect(enforcer.validateFilePath('tests/unit.test.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('tests/integration/api.test.ts')).toHaveLength(0);
    });

    it('should allow exact file matches', () => {
      expect(enforcer.validateFilePath('package.json')).toHaveLength(0);
    });

    it('should allow paths matching single-level wildcards', () => {
      expect(enforcer.validateFilePath('docs/readme.md')).toHaveLength(0);
      expect(enforcer.validateFilePath('docs/api.md')).toHaveLength(0);
    });

    it('should block paths not matching any allow pattern', () => {
      const violations = enforcer.validateFilePath('node_modules/package/index.js');

      expect(violations).toHaveLength(1);
      expect(violations[0].policyType).toBe('path');
      expect(violations[0].message).toContain('not in the allowed paths list');
    });

    it('should block paths that are close but do not match', () => {
      const violations = enforcer.validateFilePath('docs/nested/file.md');

      expect(violations).toHaveLength(1);
      expect(violations[0].resource).toBe('docs/nested/file.md');
    });

    it('should block files with wrong extension', () => {
      const violations = enforcer.validateFilePath('tests/unit.spec.ts');

      expect(violations).toHaveLength(1);
    });
  });

  // ============================================================================
  // Blocklist Mode Tests
  // ============================================================================

  describe('blocklist mode', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'blocklist',
          allow: [],
          block: ['node_modules/**', '.env*', '**/*.secret', 'secrets/**'],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should allow paths not in block list', () => {
      expect(enforcer.validateFilePath('src/index.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('tests/unit.test.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('package.json')).toHaveLength(0);
    });

    it('should block paths matching block patterns', () => {
      const violations = enforcer.validateFilePath('node_modules/lodash/index.js');

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('blocked by pattern');
      expect(violations[0].context?.matchedPattern).toBe('node_modules/**');
    });

    it('should block dotfiles matching patterns', () => {
      const violations = enforcer.validateFilePath('.env');

      expect(violations).toHaveLength(1);
    });

    it('should block files with blocked extensions', () => {
      const violations = enforcer.validateFilePath('config/database.secret');

      expect(violations).toHaveLength(1);
      expect(violations[0].context?.matchedPattern).toBe('**/*.secret');
    });

    it('should block paths in blocked directories', () => {
      const violations = enforcer.validateFilePath('secrets/api-key.txt');

      expect(violations).toHaveLength(1);
    });
  });

  // ============================================================================
  // Block Takes Precedence Tests
  // ============================================================================

  describe('block patterns precedence', () => {
    it('should block paths even if they match allow patterns', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['src/secrets/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Regular src files should be allowed
      expect(enforcer.validateFilePath('src/index.ts')).toHaveLength(0);

      // But src/secrets should be blocked
      const violations = enforcer.validateFilePath('src/secrets/api-key.ts');
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('blocked by pattern');
    });
  });

  // ============================================================================
  // Sensitive Pattern Tests
  // ============================================================================

  describe('sensitive patterns', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['**/*'],
          sensitivePatterns: ['.env*', '**/*.key', '**/credentials.*'],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should flag sensitive files even when allowed', () => {
      const violations = enforcer.validateFilePath('.env.local');

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('sensitive-path');
      expect(violations[0].message).toContain('requires approval');
      expect(violations[0].context?.isSensitive).toBe(true);
      expect(violations[0].context?.requiresApproval).toBe(true);
    });

    it('should flag files with sensitive extensions', () => {
      const violations = enforcer.validateFilePath('config/server.key');

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('sensitive-path');
    });

    it('should flag files with sensitive names', () => {
      const violations = enforcer.validateFilePath('config/credentials.json');

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('sensitive');
    });

    it('should not flag regular files', () => {
      const violations = enforcer.validateFilePath('src/index.ts');

      expect(violations).toHaveLength(0);
    });
  });

  // ============================================================================
  // PolicyViolation Structure Tests
  // ============================================================================

  describe('PolicyViolation structure', () => {
    it('should include all required fields', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations).toHaveLength(1);
      const violation = violations[0];

      expect(violation.id).toBeDefined();
      expect(typeof violation.id).toBe('string');
      expect(violation.ruleId).toBe('path-validation');
      expect(violation.policyType).toBe('path');
      expect(violation.severity).toBe('error');
      expect(violation.message).toBeDefined();
      expect(violation.timestamp).toBeInstanceOf(Date);
      expect(violation.resolved).toBe(false);
    });

    it('should include resource in violation', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations[0].resource).toBe('blocked/file.ts');
    });

    it('should include matched pattern in context when blocked', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'blocklist',
          block: ['node_modules/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('node_modules/pkg/index.js');

      expect(violations[0].context?.matchedPattern).toBe('node_modules/**');
    });

    it('should use correct severity for enforce mode', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations[0].severity).toBe('error');
    });

    it('should use correct severity for warn mode', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations[0].severity).toBe('warning');
    });

    it('should use correct severity for audit mode', () => {
      const config: PolicyConfig = {
        enforcement: 'audit',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations[0].severity).toBe('info');
    });
  });

  // ============================================================================
  // Path Normalization Tests
  // ============================================================================

  describe('path normalization', () => {
    let enforcer: PolicyEnforcer;

    beforeEach(() => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };
      enforcer = new PolicyEnforcer(config);
    });

    it('should normalize paths with double slashes', () => {
      expect(enforcer.validateFilePath('src//utils//helper.ts')).toHaveLength(0);
    });

    it('should normalize paths with . and ..', () => {
      expect(enforcer.validateFilePath('src/utils/../index.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('./src/index.ts')).toHaveLength(0);
    });

    it('should handle Windows-style paths', () => {
      expect(enforcer.validateFilePath('src\\utils\\helper.ts')).toHaveLength(0);
    });

    it('should strip trailing slashes', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src'],
        },
      };
      const e = new PolicyEnforcer(config);

      expect(e.validateFilePath('src/')).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty allow array in allowlist mode', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: [],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      // With empty allow list, all paths should be allowed by default
      expect(enforcer.validateFilePath('any/file.ts')).toHaveLength(0);
    });

    it('should handle empty block array in blocklist mode', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'blocklist',
          block: [],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      expect(enforcer.validateFilePath('any/file.ts')).toHaveLength(0);
    });

    it('should handle paths with special characters', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      expect(enforcer.validateFilePath('src/file with spaces.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('src/file-with-dashes.ts')).toHaveLength(0);
      expect(enforcer.validateFilePath('src/file_with_underscores.ts')).toHaveLength(0);
    });

    it('should handle hidden files (dotfiles)', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      expect(enforcer.validateFilePath('src/.gitignore')).toHaveLength(0);
      expect(enforcer.validateFilePath('src/.hidden/file.ts')).toHaveLength(0);
    });

    it('should handle invalid patterns gracefully', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['[invalid', 'src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      // Should still work with valid patterns
      expect(enforcer.validateFilePath('src/index.ts')).toHaveLength(0);
    });

    it('should handle undefined patterns arrays', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
        },
      };

      const enforcer = new PolicyEnforcer(config);
      // With undefined allow list, should allow by default
      expect(enforcer.validateFilePath('any/file.ts')).toHaveLength(0);
    });

    it('should generate unique violation IDs', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations1 = enforcer.validateFilePath('blocked/file1.ts');
      const violations2 = enforcer.validateFilePath('blocked/file2.ts');

      expect(violations1[0].id).not.toBe(violations2[0].id);
    });
  });

  // ============================================================================
  // createPolicyEnforcer Factory Tests
  // ============================================================================

  describe('createPolicyEnforcer', () => {
    it('should create enforcer with default config', () => {
      const enforcer = createPolicyEnforcer();

      expect(enforcer).toBeInstanceOf(PolicyEnforcer);
      expect(enforcer.enforcementMode).toBe('warn');
      expect(enforcer.isEnabled).toBe(true);
    });

    it('should merge provided config with defaults', () => {
      const enforcer = createPolicyEnforcer({
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      });

      expect(enforcer.enforcementMode).toBe('enforce');
      expect(enforcer.policyConfig.version).toBe('1.0');
    });

    it('should respect enabled override', () => {
      const enforcer = createPolicyEnforcer({
        enabled: false,
      });

      expect(enforcer.isEnabled).toBe(false);
    });
  });

  // ============================================================================
  // Complex Scenarios
  // ============================================================================

  describe('complex scenarios', () => {
    it('should handle overlapping patterns correctly', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['**/*.ts', '**/*.js'],
          block: ['**/test/**', '**/*.test.ts'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // Regular TS files should be allowed
      expect(enforcer.validateFilePath('src/index.ts')).toHaveLength(0);

      // Test files should be blocked
      expect(enforcer.validateFilePath('src/test/index.ts')).toHaveLength(1);
      expect(enforcer.validateFilePath('src/index.test.ts')).toHaveLength(1);
    });

    it('should handle multiple violations (blocked + sensitive)', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'blocklist',
          block: ['secrets/**'],
          sensitivePatterns: ['**/*.key'],
        },
      };

      const enforcer = new PolicyEnforcer(config);

      // File that is both blocked AND sensitive
      const violations = enforcer.validateFilePath('secrets/api.key');

      // Should only report the block violation (block takes precedence)
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('blocked');
    });

    it('should provide detailed descriptions for violations', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**', 'lib/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations[0].description).toContain('src/**');
      expect(violations[0].description).toContain('lib/**');
    });
  });

  // ============================================================================
  // checkApprovalRequired Tests
  // ============================================================================

  describe('checkApprovalRequired', () => {
    let baseTask: Task;

    beforeEach(() => {
      baseTask = {
        id: 'test-task-1',
        description: 'Test task description',
        workflow: 'feature',
        autonomy: 'autonomous',
        status: 'pending',
        priority: 'normal',
        effort: 'medium',
        projectPath: '/project',
        branchName: 'feature/test',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05,
        },
        logs: [],
        artifacts: [],
      } as Task;
    });

    describe('when policy is disabled', () => {
      it('should return no approval required', () => {
        const config: PolicyConfig = {
          enabled: false,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'test-rule',
              name: 'Test Rule',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(false);
        expect(result.reason).toContain('policy disabled');
      });
    });

    describe('when approval rules are disabled', () => {
      it('should return no approval required', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: false,
            rules: [{
              id: 'test-rule',
              name: 'Test Rule',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(false);
        expect(result.reason).toContain('approval rules');
      });
    });

    describe('when no approval rules are configured', () => {
      it('should return no approval required', () => {
        const config: PolicyConfig = {
          enabled: true,
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(false);
        expect(result.reason).toContain('No approval rules');
      });
    });

    describe('when no rules match', () => {
      it('should return no approval required', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'test-rule',
              name: 'Test Rule',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'create');

        expect(result.required).toBe(false);
        expect(result.reason).toContain('No approval rules matched');
      });
    });

    describe('file pattern conditions', () => {
      it('should trigger approval for matching file patterns', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'sensitive-files',
              name: 'Sensitive Files Rule',
              description: 'Requires approval for sensitive files',
              urgency: 'high',
              conditions: [{
                type: 'file-pattern',
                patterns: ['**/*.env*', '**/secrets/**', '**/*.key'],
              }],
              approvers: ['security-team'],
              minApprovals: 2,
              timeoutMinutes: 30,
              timeoutAction: 'reject',
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const context = {
          filePaths: ['config/.env.production', 'src/utils/helper.ts'],
        };

        const result = enforcer.checkApprovalRequired(baseTask, 'modify', context);

        expect(result.required).toBe(true);
        expect(result.urgency).toBe('high');
        expect(result.minApprovals).toBe(2);
        expect(result.timeoutMinutes).toBe(30);
        expect(result.timeoutAction).toBe('reject');
        expect(result.requiredApprovers).toContain('security-team');
        expect(result.reason).toContain('Sensitive Files Rule');
      });

      it('should not trigger for non-matching file patterns', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'sensitive-files',
              name: 'Sensitive Files Rule',
              conditions: [{
                type: 'file-pattern',
                patterns: ['**/*.env*', '**/secrets/**'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const context = {
          filePaths: ['src/index.ts', 'tests/unit.test.ts'],
        };

        const result = enforcer.checkApprovalRequired(baseTask, 'modify', context);

        expect(result.required).toBe(false);
      });

      it('should handle empty file paths gracefully', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'file-rule',
              name: 'File Rule',
              conditions: [{
                type: 'file-pattern',
                patterns: ['**/*.env*'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const context = { filePaths: [] };

        const result = enforcer.checkApprovalRequired(baseTask, 'modify', context);

        expect(result.required).toBe(false);
      });
    });

    describe('content pattern conditions', () => {
      it('should trigger approval for matching content patterns', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'api-key-rule',
              name: 'API Key Detection',
              urgency: 'critical',
              conditions: [{
                type: 'content-pattern',
                patterns: ['API_KEY\\s*=', 'SECRET\\s*:', 'password\\s*='],
              }],
              approvers: ['security-admin'],
              timeoutMinutes: 10,
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const context = {
          fileContents: new Map([
            ['config.js', 'const API_KEY = "secret123"'],
            ['helper.ts', 'export function helper() { return true; }'],
          ]),
        };

        const result = enforcer.checkApprovalRequired(baseTask, 'modify', context);

        expect(result.required).toBe(true);
        expect(result.urgency).toBe('critical');
        expect(result.timeoutMinutes).toBe(10);
        expect(result.requiredApprovers).toContain('security-admin');
      });

      it('should handle invalid regex patterns gracefully', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'invalid-regex',
              name: 'Invalid Regex Rule',
              conditions: [{
                type: 'content-pattern',
                patterns: ['[invalid regex('],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const context = {
          fileContents: new Map([['test.js', 'some content']]),
        };

        const result = enforcer.checkApprovalRequired(baseTask, 'modify', context);

        expect(result.required).toBe(false);
      });
    });

    describe('operation conditions', () => {
      it('should trigger approval for matching operations', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'deploy-rule',
              name: 'Deployment Approval',
              urgency: 'high',
              conditions: [{
                type: 'operation',
                operations: ['deploy', 'publish', 'release'],
              }],
              approvers: ['devops-team', 'tech-lead'],
              minApprovals: 2,
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(true);
        expect(result.urgency).toBe('high');
        expect(result.minApprovals).toBe(2);
        expect(result.requiredApprovers).toEqual(expect.arrayContaining(['devops-team', 'tech-lead']));
      });

      it('should match operations case-insensitively', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'deploy-rule',
              name: 'Deployment Approval',
              conditions: [{
                type: 'operation',
                operations: ['DEPLOY'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(true);
      });

      it('should check context.operation as fallback', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'context-op-rule',
              name: 'Context Operation Rule',
              conditions: [{
                type: 'operation',
                operations: ['create'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const context = { operation: 'create' as const };

        const result = enforcer.checkApprovalRequired(baseTask, 'other', context);

        expect(result.required).toBe(true);
      });
    });

    describe('cost threshold conditions', () => {
      it('should trigger approval when cost exceeds threshold', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'cost-rule',
              name: 'High Cost Approval',
              urgency: 'normal',
              conditions: [{
                type: 'cost-threshold',
                threshold: 0.10,
              }],
              approvers: ['finance-team'],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);

        // Test with context cost
        const contextWithCost = { estimatedCost: 0.15 };
        let result = enforcer.checkApprovalRequired(baseTask, 'execute', contextWithCost);
        expect(result.required).toBe(true);
        expect(result.requiredApprovers).toContain('finance-team');

        // Test with task cost when no context cost
        const taskWithHighCost = { ...baseTask, usage: { ...baseTask.usage, estimatedCost: 0.20 } };
        result = enforcer.checkApprovalRequired(taskWithHighCost, 'execute');
        expect(result.required).toBe(true);
      });

      it('should not trigger when cost is below threshold', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'cost-rule',
              name: 'High Cost Approval',
              conditions: [{
                type: 'cost-threshold',
                threshold: 1.00,
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'execute');

        expect(result.required).toBe(false);
      });
    });

    describe('token threshold conditions', () => {
      it('should trigger approval when tokens exceed threshold', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'token-rule',
              name: 'High Token Usage Approval',
              conditions: [{
                type: 'token-threshold',
                threshold: 1000,
              }],
              approvers: ['resource-team'],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);

        // Test with context tokens
        const contextWithTokens = { tokenUsage: 2000 };
        let result = enforcer.checkApprovalRequired(baseTask, 'execute', contextWithTokens);
        expect(result.required).toBe(true);
        expect(result.requiredApprovers).toContain('resource-team');

        // Test with task tokens when no context tokens
        const taskWithHighTokens = { ...baseTask, usage: { ...baseTask.usage, totalTokens: 2500 } };
        result = enforcer.checkApprovalRequired(taskWithHighTokens, 'execute');
        expect(result.required).toBe(true);
      });

      it('should not trigger when tokens are below threshold', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'token-rule',
              name: 'High Token Usage Approval',
              conditions: [{
                type: 'token-threshold',
                threshold: 5000,
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'execute');

        expect(result.required).toBe(false);
      });
    });

    describe('custom conditions', () => {
      it('should handle simple numeric expressions', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'custom-rule',
              name: 'Custom Expression Rule',
              conditions: [{
                type: 'custom',
                expression: '0.10 > 0.05',
              }],
              approvers: ['admin'],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'execute');

        expect(result.required).toBe(true);
      });

      it('should handle variable interpolation', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'custom-rule',
              name: 'Custom Expression Rule',
              conditions: [{
                type: 'custom',
                expression: '{cost} > 0.03',
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'execute');

        expect(result.required).toBe(true);
      });

      it('should handle invalid expressions gracefully', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'custom-rule',
              name: 'Custom Expression Rule',
              conditions: [{
                type: 'custom',
                expression: 'invalid expression syntax',
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'execute');

        expect(result.required).toBe(false);
      });
    });

    describe('rule logic modes', () => {
      it('should handle AND logic (requireAllConditions: true)', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'and-rule',
              name: 'AND Logic Rule',
              requireAllConditions: true,
              conditions: [
                {
                  type: 'operation',
                  operations: ['deploy'],
                },
                {
                  type: 'cost-threshold',
                  threshold: 0.01,
                },
              ],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);

        // Should trigger when both conditions match
        let result = enforcer.checkApprovalRequired(baseTask, 'deploy');
        expect(result.required).toBe(true);

        // Should not trigger when only one condition matches
        result = enforcer.checkApprovalRequired(baseTask, 'create');
        expect(result.required).toBe(false);
      });

      it('should handle OR logic (requireAllConditions: false)', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'or-rule',
              name: 'OR Logic Rule',
              requireAllConditions: false,
              conditions: [
                {
                  type: 'operation',
                  operations: ['deploy'],
                },
                {
                  type: 'cost-threshold',
                  threshold: 0.01,
                },
              ],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);

        // Should trigger when operation matches (even if cost doesn't exceed threshold much)
        let result = enforcer.checkApprovalRequired(baseTask, 'deploy');
        expect(result.required).toBe(true);

        // Should trigger when cost matches (even if operation doesn't match)
        result = enforcer.checkApprovalRequired(baseTask, 'create');
        expect(result.required).toBe(true);
      });
    });

    describe('multiple rule aggregation', () => {
      it('should aggregate multiple triggered rules correctly', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'rule-1',
                name: 'High Priority Rule',
                priority: 100,
                urgency: 'critical',
                timeoutMinutes: 5,
                minApprovals: 2,
                timeoutAction: 'reject',
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
                approvers: ['security-team'],
              },
              {
                id: 'rule-2',
                name: 'Medium Priority Rule',
                priority: 50,
                urgency: 'high',
                timeoutMinutes: 15,
                minApprovals: 1,
                timeoutAction: 'escalate',
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
                approvers: ['devops-team'],
              },
            ],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(true);
        expect(result.urgency).toBe('critical'); // Highest urgency
        expect(result.timeoutMinutes).toBe(5); // Shortest timeout
        expect(result.minApprovals).toBe(2); // Maximum approvals
        expect(result.timeoutAction).toBe('reject'); // Most restrictive
        expect(result.requiredApprovers).toEqual(expect.arrayContaining(['security-team', 'devops-team']));
        expect(result.triggeredRules).toHaveLength(2);
      });

      it('should sort triggered rules by priority', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'low-priority',
                name: 'Low Priority Rule',
                priority: 10,
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
              },
              {
                id: 'high-priority',
                name: 'High Priority Rule',
                priority: 100,
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
              },
            ],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.triggeredRules[0].id).toBe('high-priority');
        expect(result.triggeredRules[1].id).toBe('low-priority');
      });
    });

    describe('rule enabled/disabled filtering', () => {
      it('should only evaluate enabled rules', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'enabled-rule',
                name: 'Enabled Rule',
                enabled: true,
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
                approvers: ['team-a'],
              },
              {
                id: 'disabled-rule',
                name: 'Disabled Rule',
                enabled: false,
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
                approvers: ['team-b'],
              },
            ],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(true);
        expect(result.triggeredRules).toHaveLength(1);
        expect(result.triggeredRules[0].id).toBe('enabled-rule');
        expect(result.requiredApprovers).toEqual(['team-a']);
      });

      it('should treat rules without enabled flag as enabled by default', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'default-enabled',
              name: 'Default Enabled Rule',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(true);
      });
    });

    describe('default values and edge cases', () => {
      it('should use appropriate defaults for urgency levels', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'default-rule',
              name: 'Default Rule',
              conditions: [{
                type: 'operation',
                operations: ['deploy'],
              }],
              // No urgency specified - should default to 'normal'
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(true);
        expect(result.urgency).toBe('normal');
        expect(result.minApprovals).toBe(1);
        expect(result.timeoutAction).toBe('reject');
      });

      it('should handle rules with empty conditions arrays', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'empty-conditions',
              name: 'Empty Conditions Rule',
              conditions: [],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(false);
      });

      it('should handle unknown condition types gracefully', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [{
              id: 'unknown-condition',
              name: 'Unknown Condition Rule',
              conditions: [{
                type: 'unknown-type' as any,
              }],
            }],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.required).toBe(false);
      });

      it('should build meaningful reasons for single and multiple rules', () => {
        const config: PolicyConfig = {
          enabled: true,
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'rule-1',
                name: 'Security Rule',
                description: 'Security approval required',
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
              },
              {
                id: 'rule-2',
                name: 'Compliance Rule',
                conditions: [{
                  type: 'operation',
                  operations: ['deploy'],
                }],
              },
            ],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const result = enforcer.checkApprovalRequired(baseTask, 'deploy');

        expect(result.reason).toContain('Security Rule, Compliance Rule');
      });
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe('event emission', () => {
    it('should emit policy:violation event when path is blocked', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'blocklist',
          block: ['node_modules/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const violations = enforcer.validateFilePath('node_modules/pkg/index.js');

      expect(violations).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('policy_violation');
      expect(events[0].violation.policyType).toBe('path');
      expect(events[0].violation.message).toContain('blocked by pattern');
      expect(events[0].violation.id).toBe(violations[0].id);
    });

    it('should emit policy:violation event for sensitive files', () => {
      const config: PolicyConfig = {
        enforcement: 'warn',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['**/*'],
          sensitivePatterns: ['.env*'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const violations = enforcer.validateFilePath('.env.local');

      expect(violations).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('policy_violation');
      expect(events[0].violation.ruleId).toBe('sensitive-path');
      expect(events[0].violation.message).toContain('requires approval');
    });

    it('should emit multiple events for multiple violations', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      enforcer.validateFilePath('blocked/file1.ts');
      enforcer.validateFilePath('blocked/file2.ts');

      expect(events).toHaveLength(2);
      expect(events[0].violation.resource).toBe('blocked/file1.ts');
      expect(events[1].violation.resource).toBe('blocked/file2.ts');
      expect(events[0].id).not.toBe(events[1].id); // Unique event IDs
    });

    it('should not emit events when path is allowed', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const violations = enforcer.validateFilePath('src/index.ts');

      expect(violations).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    it('should not emit events when policy is disabled', () => {
      const config: PolicyConfig = {
        enabled: false,
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const violations = enforcer.validateFilePath('blocked/file.ts');

      expect(violations).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    it('should include context information in events', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      const context = {
        taskId: 'task-123',
        agentId: 'agent-456',
        workflowId: 'workflow-789',
        metadata: { customField: 'value' },
      };

      enforcer.validateFilePath('blocked/file.ts', context);

      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('task-123');
      expect(events[0].agentId).toBe('agent-456');
      expect(events[0].workflowId).toBe('workflow-789');
      expect(events[0].metadata?.customField).toBe('value');
    });

    it('should emit events conforming to PolicyViolationEventSchema structure', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];
      enforcer.on('policy:violation', (event) => events.push(event));

      enforcer.validateFilePath('blocked/file.ts');

      expect(events).toHaveLength(1);
      const event = events[0];

      // Verify required fields
      expect(event.type).toBe('policy_violation');
      expect(typeof event.id).toBe('string');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.violation).toBeDefined();
      expect(event.violation.id).toBeDefined();
      expect(event.violation.policyType).toBe('path');

      // Verify optional fields are handled correctly
      expect(event.taskId).toBeUndefined();
      expect(event.agentId).toBeUndefined();
      expect(event.workflowId).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });

    it('should handle event listener removal', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events: PolicyViolationEvent[] = [];

      const listener = (event: PolicyViolationEvent) => events.push(event);
      enforcer.on('policy:violation', listener);

      // First violation should emit event
      enforcer.validateFilePath('blocked/file1.ts');
      expect(events).toHaveLength(1);

      // Remove listener
      enforcer.off('policy:violation', listener);

      // Second violation should not emit event
      enforcer.validateFilePath('blocked/file2.ts');
      expect(events).toHaveLength(1); // Still 1, not 2
    });

    it('should support multiple event listeners', () => {
      const config: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
        },
      };

      const enforcer = new PolicyEnforcer(config);
      const events1: PolicyViolationEvent[] = [];
      const events2: PolicyViolationEvent[] = [];

      enforcer.on('policy:violation', (event) => events1.push(event));
      enforcer.on('policy:violation', (event) => events2.push(event));

      enforcer.validateFilePath('blocked/file.ts');

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0].id).toBe(events2[0].id); // Same event object
    });
  });

  // ============================================================================
  // checkTaskStart Tests
  // ============================================================================

  describe('checkTaskStart', () => {
    describe('when policy is disabled', () => {
      it('should allow task to start without evaluation', () => {
        const config: PolicyConfig = {
          enabled: false,
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['**/*'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task-1',
          workflow: 'production-deploy',
          priority: 'critical',
          effort: 'xlarge',
          usage: { estimatedCost: 50.0, totalTokens: 10000 },
        });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['/blocked/path.ts'],
          operationType: 'deploy',
        });

        expect(result.passed).toBe(true);
        expect(result.results).toHaveLength(0);
        expect(result.requiresApproval).toBe(false);
        expect(result.triggeredApprovalRules).toHaveLength(0);
      });
    });

    describe('with no policy violations', () => {
      it('should allow task to start', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task-1',
          workflow: 'feature-development',
          priority: 'medium',
          effort: 'small',
          usage: { estimatedCost: 2.0, totalTokens: 1000 },
        });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['src/components/Button.tsx'],
          operationType: 'code-review',
        });

        expect(result.passed).toBe(true);
        expect(result.passedCount).toBe(0);
        expect(result.failedCount).toBe(0);
        expect(result.warningCount).toBe(0);
        expect(result.results).toHaveLength(0);
        expect(result.requiresApproval).toBe(false);
      });
    });

    describe('with path violations', () => {
      it('should detect blocked path violations', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['src/secrets/**'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task-1',
          workflow: 'feature-development',
        });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['src/secrets/api-keys.ts'],
        });

        expect(result.passed).toBe(false);
        expect(result.failedCount).toBe(0);
        expect(result.warningCount).toBe(1);
        expect(result.results).toHaveLength(1);

        const violation = result.results[0];
        expect(violation.ruleType).toBe('path');
        expect(violation.severity).toBe('warning');
        expect(violation.message).toContain('blocked by pattern');
        expect(violation.details?.filePath).toBe('src/secrets/api-keys.ts');
      });

      it('should handle multiple path violations', () => {
        const config: PolicyConfig = {
          enforcement: 'strict',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
            block: ['node_modules/**'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({ id: 'test-task-1' });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: [
            'node_modules/some-package/index.js',
            'package-lock.json',
          ],
        });

        expect(result.passed).toBe(false);
        expect(result.results.length).toBeGreaterThanOrEqual(1);
        expect(result.results.some(r => r.ruleType === 'path')).toBe(true);
      });
    });

    describe('with task-specific policy rules', () => {
      it('should flag critical priority tasks', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'critical-task',
          priority: 'critical',
          workflow: 'urgent-fix',
        });

        const result = enforcer.checkTaskStart(task);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].ruleId).toBe('critical-task-review');
        expect(result.results[0].ruleName).toBe('Critical Task Review');
        expect(result.results[0].severity).toBe('warning');
        expect(result.results[0].details?.taskPriority).toBe('critical');
      });

      it('should flag large effort tasks', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'large-task',
          effort: 'large',
          workflow: 'refactoring',
        });

        const result = enforcer.checkTaskStart(task);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].ruleId).toBe('large-effort-review');
        expect(result.results[0].severity).toBe('info');
        expect(result.results[0].details?.taskEffort).toBe('large');
      });

      it('should flag high-cost tasks', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'expensive-task',
          usage: { estimatedCost: 15.50, totalTokens: 50000 },
        });

        const result = enforcer.checkTaskStart(task);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].ruleId).toBe('high-cost-review');
        expect(result.results[0].severity).toBe('warning');
        expect(result.results[0].details?.estimatedCost).toBe(15.50);
      });

      it('should flag production-related workflows', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'prod-deploy',
          workflow: 'production-deployment',
        });

        const result = enforcer.checkTaskStart(task);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].ruleId).toBe('production-deployment');
        expect(result.results[0].severity).toBe('error');
        expect(result.results[0].details?.workflow).toBe('production-deployment');
      });
    });

    describe('enforcement mode behavior', () => {
      it('should pass in audit mode even with violations', () => {
        const config: PolicyConfig = {
          enforcement: 'audit',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task',
          priority: 'critical',
          usage: { estimatedCost: 20.0, totalTokens: 10000 },
        });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['blocked/path.ts'],
        });

        expect(result.passed).toBe(true); // Audit mode always passes
        expect(result.results.length).toBeGreaterThan(0); // But violations are recorded
      });

      it('should fail in strict mode with warnings', () => {
        const config: PolicyConfig = {
          enforcement: 'strict',
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task',
          priority: 'critical', // This will generate a warning
        });

        const result = enforcer.checkTaskStart(task);

        expect(result.passed).toBe(false); // Strict mode fails on warnings
        expect(result.warningCount).toBeGreaterThan(0);
      });

      it('should fail in warn mode only with errors', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task',
          priority: 'critical', // This generates a warning, not error
        });

        const result = enforcer.checkTaskStart(task);

        expect(result.passed).toBe(true); // Warn mode passes with warnings
        expect(result.warningCount).toBeGreaterThan(0);
        expect(result.failedCount).toBe(0);
      });
    });

    describe('approval requirements', () => {
      it('should detect when approval is required', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
          approvalRules: {
            enabled: true,
            rules: [
              {
                id: 'production-approval',
                name: 'Production Deployment',
                description: 'Require approval for production deployments',
                enabled: true,
                conditions: [
                  {
                    type: 'operation',
                    operations: ['deploy'],
                  },
                ],
                approvers: ['ops-team'],
                urgency: 'high',
                timeoutMinutes: 30,
                timeoutAction: 'reject',
              },
            ],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({ id: 'deploy-task' });

        const result = enforcer.checkTaskStart(task, {
          operationType: 'deploy',
        });

        expect(result.requiresApproval).toBe(true);
        expect(result.triggeredApprovalRules).toContain('production-approval');

        const approvalResult = result.results.find(r => r.ruleType === 'approval');
        expect(approvalResult).toBeDefined();
        expect(approvalResult?.severity).toBe('error'); // High urgency maps to error
      });
    });

    describe('result aggregation', () => {
      it('should correctly aggregate counts and results', () => {
        const config: PolicyConfig = {
          enforcement: 'warn',
          allowedPaths: {
            mode: 'allowlist',
            allow: ['src/**'],
          },
        };

        const enforcer = new PolicyEnforcer(config);
        const task = createMockTask({
          id: 'test-task',
          priority: 'critical', // warning
          effort: 'large', // info
          workflow: 'production-deploy', // error
          usage: { estimatedCost: 15.0, totalTokens: 5000 }, // warning
        });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['blocked/path.ts'], // warning
        });

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.passedCount + result.failedCount + result.warningCount).toBeGreaterThan(0);
        expect(result.evaluatedAt).toBeInstanceOf(Date);
        expect(result.policyName).toBe(config.name);
      });
    });
  });
});
