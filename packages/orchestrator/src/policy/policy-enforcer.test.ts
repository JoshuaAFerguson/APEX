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
import type { PolicyConfig, PolicyViolation } from '@apexcli/core';

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
});
