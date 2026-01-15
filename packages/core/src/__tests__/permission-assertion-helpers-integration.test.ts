/**
 * @fileoverview Integration Test for Permission Assertion Helpers
 *
 * This test demonstrates the complete integration of the permission assertion helpers
 * with a realistic permission management scenario. It shows how all the helpers work
 * together to provide comprehensive permission state validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../test-setup.js'; // Auto-register custom matchers

import {
  // Mock creation utilities
  createMockPermission,
  createMockToolPermissionResult,
  createMockPermissionHistory,
  createMockPermissionContext,
  createCommonPermissionScenarios,

  // Function-based assertions
  expectPermissionGranted,
  expectPermissionDenied,
  expectPermissionPending,
  assertPermissionContext,
  assertPermissionHistory,

  // Types
  type PermissionContext,
  type PermissionHistory,
  type ToolPermissionResult,
} from '../test-utils.js';

describe('Permission Assertion Helpers - Full Integration', () => {
  describe('Real-world Permission Scenarios', () => {
    it('should validate a complete developer workflow', async () => {
      // Scenario: Developer agent working on a project with mixed permissions
      const projectContext: PermissionContext = {
        permissions: [
          createMockPermission({ tool: 'Read', level: 'allow-always', scope: '/project/**' }),
          createMockPermission({ tool: 'Write', level: 'allow-once', scope: '/project/src/**' }),
          createMockPermission({ tool: 'Bash', level: 'deny', scope: 'rm -rf*' }),
          createMockPermission({ tool: 'WebFetch', level: 'allow-always', scope: 'api.github.com' }),
        ],
        preset: 'review-all',
        agent: 'developer',
        metadata: { projectPath: '/project', trustLevel: 'medium' },
      };

      // Test context validation using custom matcher
      expect(projectContext).toHavePermissionContext({
        hasPermissions: ['Read', 'Write', 'WebFetch'],
        lacksPermissions: ['Edit'], // Edit permission wasn't granted
        preset: 'review-all',
        agent: 'developer',
        permissionCount: 4,
      });

      // Test context validation using function
      assertPermissionContext(projectContext, {
        hasPermissions: ['Read', 'Write', 'Bash', 'WebFetch'],
        preset: 'review-all',
        agent: 'developer',
      });

      // Simulate permission check results
      const readResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
        config: { directoryAccess: { allowlist: ['/project/**'] } },
      });

      const writeResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
        config: { directoryAccess: { allowlist: ['/project/src/**'] } },
      });

      const bashResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Dangerous command detected: rm -rf operations are blocked',
        config: { blockedCommands: ['rm -rf*'] },
      });

      // Test permission results with custom matchers
      expect(readResult).toBePermissionGranted('allow-always');
      expect(writeResult).toBePermissionPending();
      expect(bashResult).toBePermissionDenied('dangerous command');

      // Test permission results with function assertions
      expectPermissionGranted(readResult, 'allow-always');
      expectPermissionPending(writeResult);
      expectPermissionDenied(bashResult, 'dangerous command');

      // All assertions should pass - this validates the complete workflow
      expect(true).toBe(true);
    });

    it('should validate permission history across multiple sessions', () => {
      // Scenario: Tracking permission decisions over time
      const sessionHistory = createMockPermissionHistory([
        {
          tool: 'Read',
          scope: '/project/README.md',
          granted: true,
          level: 'allow-always',
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
          decidedBy: 'preset',
          reason: 'Autonomous preset allows read operations',
        },
        {
          tool: 'Write',
          scope: '/project/src/index.ts',
          granted: true,
          level: 'allow-once',
          timestamp: new Date(Date.now() - 240000), // 4 minutes ago
          decidedBy: 'user',
          reason: 'User approved file modification',
        },
        {
          tool: 'Bash',
          scope: 'npm install',
          granted: true,
          level: 'allow-once',
          timestamp: new Date(Date.now() - 180000), // 3 minutes ago
          decidedBy: 'user',
          reason: 'User approved package installation',
        },
        {
          tool: 'Bash',
          scope: 'rm -rf node_modules',
          granted: false,
          timestamp: new Date(Date.now() - 120000), // 2 minutes ago
          decidedBy: 'policy',
          reason: 'Dangerous operation blocked by security policy',
        },
        {
          tool: 'Read',
          scope: '/project/package.json',
          granted: true,
          level: 'allow-always',
          timestamp: new Date(Date.now() - 60000), // 1 minute ago
          decidedBy: 'preset',
          reason: 'Autonomous preset allows read operations',
        },
      ]);

      // Test history validation with custom matcher
      expect(sessionHistory).toHavePermissionHistory({
        totalEntries: 5,
        grantedCount: 4,
        deniedCount: 1,
        hasToolEntry: 'Read',
        hasToolEntry: 'Write',
        hasToolEntry: 'Bash',
        hasRecentEntry: {
          tool: 'Read',
          withinMinutes: 2,
          granted: true,
        },
        entriesInOrder: ['Read', 'Write', 'Bash', 'Bash', 'Read'],
      });

      // Test history validation with function
      assertPermissionHistory(sessionHistory, {
        totalEntries: 5,
        grantedCount: 4,
        deniedCount: 1,
        hasRecentEntry: {
          tool: 'Bash',
          withinMinutes: 4,
          granted: false,
        },
      });
    });

    it('should handle complex permission state transitions', () => {
      // Scenario: Permission states changing based on context
      const scenarios = createCommonPermissionScenarios();

      // Test read-only scenario
      const readOnlyContext: PermissionContext = {
        permissions: Object.values(scenarios.readOnly),
        preset: 'read-only',
      };

      expect(readOnlyContext).toHavePermissionContext({
        hasPermissions: ['Read', 'Grep', 'Glob'],
        lacksPermissions: ['Write', 'Bash'],
      });

      // Test review-all scenario
      const reviewContext: PermissionContext = {
        permissions: Object.values(scenarios.reviewAll),
        preset: 'review-all',
      };

      expect(reviewContext).toHavePermissionContext({
        hasPermissions: ['Read', 'Write', 'Bash', 'WebFetch'],
        permissionCount: 4,
      });

      // Verify all permissions in review-all require confirmation
      for (const permission of reviewContext.permissions) {
        if (permission.level === 'allow-once') {
          const result = createMockToolPermissionResult({
            allowed: true,
            level: 'allow-once',
            requiresConfirmation: true,
          });
          expect(result).toBePermissionPending();
        }
      }
    });
  });

  describe('Error Message Quality Validation', () => {
    it('should provide detailed error messages for permission failures', () => {
      const failedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool access denied: insufficient privileges for system-level operations',
      });

      let errorMessage = '';
      try {
        expect(failedResult).toBePermissionGranted();
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      // Verify error message contains helpful information
      expect(errorMessage).toContain('Expected permission to be granted');
      expect(errorMessage).toContain('but it was denied');
      expect(errorMessage).toContain('insufficient privileges');
      expect(errorMessage).toContain('system-level operations');
    });

    it('should provide detailed error messages for context validation failures', () => {
      const invalidContext: PermissionContext = {
        permissions: [
          createMockPermission({ tool: 'Read', level: 'allow-always' }),
        ],
        preset: 'autonomous',
        agent: 'test-agent',
      };

      let errorMessage = '';
      try {
        expect(invalidContext).toHavePermissionContext({
          hasPermissions: ['Read', 'Write', 'Bash'],
          preset: 'read-only',
          agent: 'production-agent',
          permissionCount: 5,
        });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      // Verify error message contains all validation failures
      expect(errorMessage).toContain('Missing expected permission for tool: Write');
      expect(errorMessage).toContain('Missing expected permission for tool: Bash');
      expect(errorMessage).toContain('Expected preset: read-only, got: autonomous');
      expect(errorMessage).toContain('Expected agent: production-agent, got: test-agent');
      expect(errorMessage).toContain('Expected 5 permissions, got: 1');
    });

    it('should provide detailed error messages for history validation failures', () => {
      const invalidHistory = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          timestamp: new Date(Date.now() - 600000), // 10 minutes ago
        },
      ]);

      let errorMessage = '';
      try {
        expect(invalidHistory).toHavePermissionHistory({
          totalEntries: 5,
          grantedCount: 3,
          deniedCount: 2,
          hasToolEntry: 'Write',
          hasRecentEntry: {
            tool: 'Read',
            withinMinutes: 5,
            granted: true,
          },
        });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      // Verify error message contains all validation failures
      expect(errorMessage).toContain('Expected 5 total entries, got: 1');
      expect(errorMessage).toContain('Expected 3 granted entries, got: 1');
      expect(errorMessage).toContain('Expected 2 denied entries, got: 0');
      expect(errorMessage).toContain('Expected entry for tool: Write');
      expect(errorMessage).toContain('Expected recent entry for tool: Read within 5 minutes');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should work with existing function-based assertions', () => {
      // Test that new matchers don't break existing patterns
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      // Both approaches should work
      expectPermissionGranted(result, 'allow-always');
      expect(result).toBePermissionGranted('allow-always');

      // They should be functionally equivalent
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should integrate with existing test utilities', () => {
      const scenarios = createCommonPermissionScenarios();

      // Use scenarios with new matchers
      const fullAccessContext: PermissionContext = {
        permissions: Object.values(scenarios.fullAccess),
        preset: 'autonomous',
      };

      expect(fullAccessContext).toHavePermissionContext({
        hasPermissions: ['Read', 'Write', 'Edit', 'Bash', 'WebFetch', 'WebSearch'],
        preset: 'autonomous',
      });

      // All permissions should be granted automatically
      for (const permission of fullAccessContext.permissions) {
        const result = createMockToolPermissionResult({
          allowed: true,
          level: permission.level,
          requiresConfirmation: false,
        });
        expect(result).toBePermissionGranted();
      }
    });
  });
});