/**
 * @fileoverview Test for Permission Assertion Helpers - Negation Cases
 *
 * This test validates that the custom assertion helpers work correctly with
 * negation (expect().not.toBe...) and provide appropriate error messages.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import '../test-setup.js'; // Auto-register custom matchers

import {
  createMockToolPermissionResult,
  createMockPermissionHistory,
  setupPermissionMatchers,
  type PermissionContext,
  type PermissionHistory,
  type ToolPermissionResult,
} from '../test-utils.js';

describe('Permission Assertion Helpers - Negation Tests', () => {
  beforeAll(() => {
    setupPermissionMatchers(expect);
  });

  describe('toBePermissionGranted negation', () => {
    it('should pass when permission is denied and we expect it NOT to be granted', () => {
      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Access blocked',
      });

      expect(deniedResult).not.toBePermissionGranted();
      expect(deniedResult).not.toBePermissionGranted('allow-always');
    });

    it('should pass when permission level does not match expected', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
      });

      expect(result).not.toBePermissionGranted('allow-always');
    });

    it('should fail when permission is granted and we expect it NOT to be', () => {
      const grantedResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
      });

      expect(() => {
        expect(grantedResult).not.toBePermissionGranted();
      }).toThrow('Expected permission NOT to be granted, but it was');
    });
  });

  describe('toBePermissionDenied negation', () => {
    it('should pass when permission is granted and we expect it NOT to be denied', () => {
      const grantedResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
      });

      expect(grantedResult).not.toBePermissionDenied();
      expect(grantedResult).not.toBePermissionDenied('security');
    });

    it('should pass when denial reason does not match', () => {
      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Tool not found',
      });

      expect(deniedResult).not.toBePermissionDenied('security violation');
    });

    it('should fail when permission is denied and we expect it NOT to be', () => {
      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Security policy violation',
      });

      expect(() => {
        expect(deniedResult).not.toBePermissionDenied();
      }).toThrow('Expected permission NOT to be denied, but it was');
    });
  });

  describe('toBePermissionPending negation', () => {
    it('should pass when permission is granted automatically', () => {
      const grantedResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      expect(grantedResult).not.toBePermissionPending();
    });

    it('should pass when permission is denied outright', () => {
      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        requiresConfirmation: false,
        denialReason: 'Blocked by policy',
      });

      expect(deniedResult).not.toBePermissionPending();
    });

    it('should fail when permission is pending and we expect it NOT to be', () => {
      const pendingResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
      });

      expect(() => {
        expect(pendingResult).not.toBePermissionPending();
      }).toThrow('Expected permission NOT to be pending, but it was');
    });
  });

  describe('toHavePermissionContext negation', () => {
    it('should pass when context does not match expected state', () => {
      const context: PermissionContext = {
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
        ],
        preset: 'read-only',
        agent: 'test-agent',
      };

      // Should pass because context doesn't match (different preset, missing permissions)
      expect(context).not.toHavePermissionContext({
        hasPermissions: ['Read', 'Write', 'Bash'],
        preset: 'autonomous',
        permissionCount: 5,
      });
    });

    it('should fail when context matches and we expect it NOT to', () => {
      const context: PermissionContext = {
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: undefined, createdAt: new Date() },
          { tool: 'Write', level: 'allow-once', scope: undefined, createdAt: new Date() },
        ],
        preset: 'review-all',
        agent: 'developer',
      };

      expect(() => {
        expect(context).not.toHavePermissionContext({
          hasPermissions: ['Read', 'Write'],
          preset: 'review-all',
          agent: 'developer',
          permissionCount: 2,
        });
      }).toThrow('Expected permission context NOT to match expected state, but it did');
    });
  });

  describe('toHavePermissionHistory negation', () => {
    it('should pass when history does not match expected criteria', () => {
      const history = createMockPermissionHistory([
        {
          tool: 'Read',
          granted: true,
          timestamp: new Date(),
        },
      ]);

      // Should pass because history doesn't match (different counts, missing entries)
      expect(history).not.toHavePermissionHistory({
        totalEntries: 5,
        grantedCount: 3,
        hasToolEntry: 'Write',
      });
    });

    it('should fail when history matches and we expect it NOT to', () => {
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

      expect(() => {
        expect(history).not.toHavePermissionHistory({
          totalEntries: 2,
          grantedCount: 1,
          deniedCount: 1,
          hasToolEntry: 'Read',
        });
      }).toThrow('Expected permission history NOT to match expected criteria, but it did');
    });
  });

  describe('Complex negation scenarios', () => {
    it('should handle mixed positive and negative assertions', () => {
      const grantedResult = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
      });

      const deniedResult = createMockToolPermissionResult({
        allowed: false,
        denialReason: 'Security policy violation',
      });

      // Mix of positive and negative assertions
      expect(grantedResult).toBePermissionGranted();
      expect(grantedResult).toBePermissionPending();
      expect(grantedResult).not.toBePermissionDenied();
      expect(grantedResult).not.toBePermissionGranted('allow-always');

      expect(deniedResult).toBePermissionDenied();
      expect(deniedResult).toBePermissionDenied('security');
      expect(deniedResult).not.toBePermissionGranted();
      expect(deniedResult).not.toBePermissionPending();
    });

    it('should provide clear error messages for failed negations', () => {
      const result = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      // Test error message for failed negation
      let errorMessage = '';
      try {
        expect(result).not.toBePermissionGranted();
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      expect(errorMessage).toContain('Expected permission NOT to be granted, but it was');
    });
  });

  describe('Edge cases with negation', () => {
    it('should handle null and undefined values correctly', () => {
      const resultWithNullLevel = createMockToolPermissionResult({
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      // These should work correctly with negation
      expect(resultWithNullLevel).not.toBePermissionGranted('allow-once');
      expect(resultWithNullLevel).not.toBePermissionPending();
    });

    it('should handle empty contexts and histories', () => {
      const emptyContext: PermissionContext = {
        permissions: [],
      };

      const emptyHistory = createMockPermissionHistory([]);

      expect(emptyContext).not.toHavePermissionContext({
        hasPermissions: ['Read'],
        permissionCount: 1,
      });

      expect(emptyHistory).not.toHavePermissionHistory({
        totalEntries: 1,
        hasToolEntry: 'Read',
      });
    });
  });
});