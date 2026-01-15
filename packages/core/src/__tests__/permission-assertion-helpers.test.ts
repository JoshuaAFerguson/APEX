/**
 * @fileoverview Test for Custom Permission Assertion Helpers
 *
 * This test validates that the custom assertion helpers (expectPermissionGranted,
 * expectPermissionDenied, expectPermissionPending, assertPermissionContext,
 * and assertPermissionHistory) work correctly and integrate with Vitest.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import '../test-setup.js'; // Import the custom matchers

import {
  createMockToolPermissionResult,
  createMockPermissionHistory,
  expectPermissionGranted,
  expectPermissionDenied,
  expectPermissionPending,
  assertPermissionContext,
  assertPermissionHistory,
  setupPermissionMatchers,
  type PermissionContext,
  type PermissionHistory,
  type ToolPermissionResult,
} from '../test-utils.js';

describe('Permission Assertion Helpers', () => {
  beforeAll(() => {
    // Ensure custom matchers are registered
    setupPermissionMatchers(expect);
  });

  describe('expectPermissionGranted', () => {
    it('should pass when permission is granted', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      expect(() => expectPermissionGranted(result)).not.toThrow();
      expect(() => expectPermissionGranted(result, 'allow-always')).not.toThrow();
    });

    it('should fail when permission is denied', () => {
      const result = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool is blocked',
      });

      expect(() => expectPermissionGranted(result)).toThrow('Expected permission to be granted, but it was denied');
    });

    it('should fail when permission level does not match', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: false,
      });

      expect(() => expectPermissionGranted(result, 'allow-always')).toThrow('Permission granted but with unexpected level');
    });
  });

  describe('expectPermissionDenied', () => {
    it('should pass when permission is denied', () => {
      const result = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Security policy violation',
      });

      expect(() => expectPermissionDenied(result)).not.toThrow();
      expect(() => expectPermissionDenied(result, 'security policy')).not.toThrow();
    });

    it('should fail when permission is granted', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
      });

      expect(() => expectPermissionDenied(result)).toThrow('Expected permission to be denied, but it was granted');
    });

    it('should fail when denial reason does not match', () => {
      const result = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool not found',
      });

      expect(() => expectPermissionDenied(result, 'security')).toThrow('Expected permission to be denied with reason containing');
    });
  });

  describe('expectPermissionPending', () => {
    it('should pass when permission is pending', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
      });

      expect(() => expectPermissionPending(result)).not.toThrow();
    });

    it('should fail when permission is granted automatically', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      expect(() => expectPermissionPending(result)).toThrow('Expected permission to be pending (require confirmation), but it was granted automatically');
    });

    it('should fail when permission is denied outright', () => {
      const result = createMockToolPermissionResult({
        allowed: false,
        requiresConfirmation: false,
        denialReason: 'Blocked by policy',
      });

      expect(() => expectPermissionPending(result)).toThrow('Expected permission to be pending (require confirmation), but it was denied outright');
    });
  });

  describe('assertPermissionContext', () => {
    it('should pass when context matches expected state', () => {
      const context: PermissionContext = {
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
          { tool: 'Write', level: 'allow-once', scope: undefined, createdAt: new Date() },
        ],
        preset: 'review-all',
        agent: 'developer',
      };

      expect(() => assertPermissionContext(context, {
        hasPermissions: ['Read', 'Write'],
        preset: 'review-all',
        agent: 'developer',
        permissionCount: 2,
      })).not.toThrow();
    });

    it('should fail when expected permission is missing', () => {
      const context: PermissionContext = {
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
        ],
        preset: 'review-all',
      };

      expect(() => assertPermissionContext(context, {
        hasPermissions: ['Read', 'Write'],
      })).toThrow('Missing expected permission for tool: Write');
    });

    it('should fail when unexpected permission exists', () => {
      const context: PermissionContext = {
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
          { tool: 'Bash', level: 'deny', scope: undefined, createdAt: new Date() },
        ],
      };

      expect(() => assertPermissionContext(context, {
        lacksPermissions: ['Bash'],
      })).toThrow('Unexpected permission found for tool: Bash');
    });

    it('should fail when preset does not match', () => {
      const context: PermissionContext = {
        permissions: [],
        preset: 'autonomous',
      };

      expect(() => assertPermissionContext(context, {
        preset: 'read-only',
      })).toThrow('Expected preset: read-only, got: autonomous');
    });
  });

  describe('assertPermissionHistory', () => {
    it('should pass when history matches expected criteria', () => {
      const history = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          level: 'allow-always',
          timestamp: new Date(),
          decidedBy: 'user',
        },
        {
          tool: 'Write',
          granted: false,
          timestamp: new Date(),
          reason: 'User denied request',
          decidedBy: 'user',
        },
      ]);

      expect(() => assertPermissionHistory(history, {
        totalEntries: 2,
        grantedCount: 1,
        deniedCount: 1,
        hasToolEntry: 'Read',
      })).not.toThrow();
    });

    it('should fail when entry counts do not match', () => {
      const history = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          timestamp: new Date(),
        },
      ]);

      expect(() => assertPermissionHistory(history, {
        totalEntries: 2,
      })).toThrow('Expected 2 total entries, got: 1');
    });

    it('should fail when expected tool entry is missing', () => {
      const history = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          timestamp: new Date(),
        },
      ]);

      expect(() => assertPermissionHistory(history, {
        hasToolEntry: 'Write',
      })).toThrow('Expected entry for tool: Write');
    });

    it('should pass when checking recent entries', () => {
      const history = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          timestamp: new Date(Date.now() - 30000), // 30 seconds ago
        },
      ]);

      expect(() => assertPermissionHistory(history, {
        hasRecentEntry: {
          tool: 'Read',
          withinMinutes: 1,
          granted: true,
        },
      })).not.toThrow();
    });

    it('should fail when recent entry is not found', () => {
      const history = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        },
      ]);

      expect(() => assertPermissionHistory(history, {
        hasRecentEntry: {
          tool: 'Read',
          withinMinutes: 1,
          granted: true,
        },
      })).toThrow('Expected recent entry for tool: Read within 1 minutes (granted)');
    });
  });

  describe('Custom Vitest Matchers', () => {
    describe('toBePermissionGranted', () => {
      it('should work as a custom Vitest matcher', () => {
        const grantedResult = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
        });

        const deniedResult = createMockToolPermissionResult({
          allowed: false,
          denialReason: 'Blocked',
        });

        // These should work with the custom matcher
        expect(grantedResult).toBePermissionGranted();
        expect(grantedResult).toBePermissionGranted('allow-always');
        expect(deniedResult).not.toBePermissionGranted();
      });

      it('should provide clear error messages', () => {
        const deniedResult = createMockToolPermissionResult({
          allowed: false,
          denialReason: 'Tool is blocked by security policy',
        });

        expect(() => {
          expect(deniedResult).toBePermissionGranted();
        }).toThrow('Expected permission to be granted, but it was denied');
      });
    });

    describe('toBePermissionDenied', () => {
      it('should work as a custom Vitest matcher', () => {
        const deniedResult = createMockToolPermissionResult({
          allowed: false,
          denialReason: 'Security violation',
        });

        const grantedResult = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
        });

        expect(deniedResult).toBePermissionDenied();
        expect(deniedResult).toBePermissionDenied('security');
        expect(grantedResult).not.toBePermissionDenied();
      });

      it('should support reason matching', () => {
        const result = createMockToolPermissionResult({
          allowed: false,
          denialReason: 'Dangerous operation detected',
        });

        expect(result).toBePermissionDenied('dangerous');
        expect(result).toBePermissionDenied('operation');

        expect(() => {
          expect(result).toBePermissionDenied('security');
        }).toThrow('Expected permission to be denied with reason containing "security"');
      });
    });

    describe('toBePermissionPending', () => {
      it('should work as a custom Vitest matcher', () => {
        const pendingResult = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-once',
          requiresConfirmation: true,
        });

        const grantedResult = createMockToolPermissionResult({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false,
        });

        expect(pendingResult).toBePermissionPending();
        expect(grantedResult).not.toBePermissionPending();
      });
    });

    describe('toHavePermissionContext', () => {
      it('should work as a custom Vitest matcher', () => {
        const context: PermissionContext = {
          permissions: [
            { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
            { tool: 'Write', level: 'allow-once', scope: undefined, createdAt: new Date() },
          ],
          preset: 'review-all',
          agent: 'developer',
        };

        expect(context).toHavePermissionContext({
          hasPermissions: ['Read', 'Write'],
          preset: 'review-all',
          agent: 'developer',
          permissionCount: 2,
        });

        expect(context).not.toHavePermissionContext({
          hasPermissions: ['Bash'],
        });
      });
    });

    describe('toHavePermissionHistory', () => {
      it('should work as a custom Vitest matcher', () => {
        const history = createMockPermissionHistory([
          {
            tool: 'Read',
            granted: true,
            timestamp: new Date(),
          },
          {
            tool: 'Write',
            granted: false,
            timestamp: new Date(),
          },
        ]);

        expect(history).toHavePermissionHistory({
          totalEntries: 2,
          grantedCount: 1,
          deniedCount: 1,
          hasToolEntry: 'Read',
        });

        expect(history).not.toHavePermissionHistory({
          totalEntries: 5,
        });
      });
    });
  });

  describe('Integration with existing helpers', () => {
    it('should work alongside existing test utilities', () => {
      // Show that the new matchers work with existing mock functions
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
      });

      // Both approaches should work
      expect(() => expectPermissionPending(result)).not.toThrow();
      expect(result).toBePermissionPending();

      // And they should be equivalent
      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Policy violation',
      });

      expect(() => expectPermissionDenied(deniedResult, 'policy')).not.toThrow();
      expect(deniedResult).toBePermissionDenied('policy');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear, helpful error messages', () => {
      const result = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool requires elevated privileges',
      });

      // Test that error messages contain useful information
      try {
        expect(result).toBePermissionGranted();
        throw new Error('Expected assertion to fail');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('Expected permission to be granted');
        expect(message).toContain('but it was denied');
        expect(message).toContain('Tool requires elevated privileges');
      }
    });

    it('should provide detailed context in error messages', () => {
      const context: PermissionContext = {
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
        ],
        preset: 'autonomous',
        agent: 'test-agent',
      };

      try {
        expect(context).toHavePermissionContext({
          hasPermissions: ['Read', 'Write', 'Bash'],
          preset: 'read-only',
          permissionCount: 5,
        });
        throw new Error('Expected assertion to fail');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('Missing expected permission for tool: Write');
        expect(message).toContain('Missing expected permission for tool: Bash');
        expect(message).toContain('Expected preset: read-only, got: autonomous');
        expect(message).toContain('Expected 5 permissions, got: 1');
      }
    });
  });
});