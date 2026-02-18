/**
 * @fileoverview Edge case tests for BrowserPermissionDeniedError
 *
 * These tests cover additional edge cases, boundary conditions, and
 * specific scenarios that complement the main unit and integration tests.
 */

import { describe, test, expect } from 'vitest';
import { ApexErrorCode } from '../../../apex-error.js';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  toBrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext,
  type BrowserResourceState,
} from '../browser-permission-denied-error.js';

describe('BrowserPermissionDeniedError Edge Cases', () => {
  describe('message enhancement edge cases', () => {
    test('handles empty strings in context gracefully', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        operation: '',
        target: '',
        denialReason: '',
      });

      // Empty strings should not add parenthetical info
      expect(error.message).toBe('Base message');
    });

    test('handles whitespace-only strings in context', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        operation: '   ',
        target: '\t\n',
        denialReason: ' ',
      });

      // Whitespace-only strings are truthy and will be included
      expect(error.message).toBe('Base message (Operation:    ) (Target: \t\n) (Reason:  )');
    });

    test('handles very long context strings', () => {
      const longOperation = 'x'.repeat(1000);
      const longTarget = 'y'.repeat(1000);
      const longReason = 'z'.repeat(1000);

      const error = new BrowserPermissionDeniedError('Base message', {
        operation: longOperation,
        target: longTarget,
        denialReason: longReason,
      });

      expect(error.message).toContain('Base message');
      expect(error.message).toContain(`(Operation: ${longOperation})`);
      expect(error.message).toContain(`(Target: ${longTarget})`);
      expect(error.message).toContain(`(Reason: ${longReason})`);
    });

    test('handles special characters in context', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        operation: 'test-operation',
        target: 'https://example.com/path?param=value&other=123',
        denialReason: 'Error: Something failed (code: 500)',
      });

      expect(error.message).toBe(
        'Base message (Operation: test-operation) (Target: https://example.com/path?param=value&other=123) (Reason: Error: Something failed (code: 500))'
      );
    });

    test('handles unicode characters in context', () => {
      const error = new BrowserPermissionDeniedError('基本メッセージ', {
        operation: 'クリック',
        target: 'ボタン',
        denialReason: 'アクセス拒否',
      });

      expect(error.message).toBe('基本メッセージ (Operation: クリック) (Target: ボタン) (Reason: アクセス拒否)');
    });
  });

  describe('permission type boundary cases', () => {
    test('handles all defined permission types', () => {
      const permissionTypes: Array<BrowserPermissionDeniedContext['permissionType']> = [
        'geolocation',
        'camera',
        'microphone',
        'notifications',
        'clipboard',
        'storage',
        'domain',
        'javascript',
        'form',
        'unknown'
      ];

      permissionTypes.forEach((type) => {
        const error = new BrowserPermissionDeniedError('Permission denied', {
          permissionType: type,
        });

        expect(error.isPermissionType(type)).toBe(true);
        expect(error.getUserFriendlyMessage()).toBeDefined();
        expect(error.getResolutionSuggestions()).toHaveLength.greaterThan(0);
      });
    });

    test('handles undefined permission type in all methods', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {});

      expect(error.isPermissionType(undefined)).toBe(true);
      expect(error.isPermissionType('geolocation')).toBe(false);
      expect(error.getUserFriendlyMessage()).toBeDefined();
      expect(error.getResolutionSuggestions()).toHaveLength.greaterThan(0);
    });

    test('permission type checking is case-sensitive', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'geolocation',
      });

      // @ts-expect-error - Testing runtime behavior with invalid type
      expect(error.isPermissionType('Geolocation')).toBe(false);
      // @ts-expect-error - Testing runtime behavior with invalid type
      expect(error.isPermissionType('GEOLOCATION')).toBe(false);
    });
  });

  describe('static factory method edge cases', () => {
    describe('fromBrowserPermissionError', () => {
      test('handles null/undefined original error', () => {
        const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
          'geolocation',
          'getCurrentPosition',
          'https://example.com'
          // No original error
        );

        expect(error.browserContext.denialReason).toBe('Permission denied by browser');
        expect(error.cause).toBeUndefined();
      });

      test('handles original error without message', () => {
        const originalError = new Error();
        const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
          'geolocation',
          'getCurrentPosition',
          'https://example.com',
          originalError
        );

        expect(error.browserContext.denialReason).toBe('Permission denied by browser');
        expect(error.cause).toBe(originalError);
      });

      test('handles very long permission names', () => {
        const longPermissionName = 'some-very-long-permission-name-that-is-not-standard'.repeat(10);
        const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
          longPermissionName,
          'testOperation'
        );

        expect(error.message).toContain(longPermissionName);
        expect(error.browserContext.permissionType).toBe('unknown');
      });

      test('handles case-insensitive permission mapping correctly', () => {
        const testCases = [
          { input: 'Geolocation', expected: 'geolocation' },
          { input: 'CAMERA', expected: 'camera' },
          { input: 'MiCrOpHoNe', expected: 'microphone' },
          { input: 'clipboard-READ', expected: 'clipboard' },
        ];

        testCases.forEach(({ input, expected }) => {
          const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
            input,
            'testOperation'
          );
          expect(error.browserContext.permissionType).toBe(expected);
        });
      });
    });

    describe('forDomainRestriction', () => {
      test('handles empty domain gracefully', () => {
        const error = BrowserPermissionDeniedError.forDomainRestriction(
          '',
          'navigate',
          'Empty domain restriction'
        );

        expect(error.browserContext.target).toBe('');
        expect(error.message).toContain("Access to domain '' was denied");
      });

      test('handles malformed URLs as domains', () => {
        const malformedDomain = 'not-a-valid-domain://invalid';
        const error = BrowserPermissionDeniedError.forDomainRestriction(
          malformedDomain,
          'navigate',
          'Invalid domain format'
        );

        expect(error.browserContext.target).toBe(malformedDomain);
        expect(error.browserContext.permissionType).toBe('domain');
      });
    });

    describe('forDisabledFeature', () => {
      test('handles screenshots feature type mapping', () => {
        const error = BrowserPermissionDeniedError.forDisabledFeature(
          'screenshots',
          'takeScreenshot'
        );

        expect(error.browserContext.permissionType).toBe('storage');
        expect(error.browserContext.operation).toBe('takeScreenshot');
        expect(error.browserContext.denialReason).toBe('screenshots execution is disabled in tool configuration');
      });

      test('preserves original feature names in error messages', () => {
        const features: Array<'javascript' | 'form' | 'screenshots'> = ['javascript', 'form', 'screenshots'];

        features.forEach((feature) => {
          const error = BrowserPermissionDeniedError.forDisabledFeature(feature, 'testOperation');
          expect(error.message).toContain(`Feature '${feature}' is disabled`);
        });
      });
    });
  });

  describe('user-friendly message edge cases', () => {
    test('provides consistent messages for unknown permission types', () => {
      const error1 = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'unknown',
      });

      const error2 = new BrowserPermissionDeniedError('Permission denied', {
        // No permissionType specified (undefined)
      });

      // Both should fall through to the default case
      expect(error1.getUserFriendlyMessage()).toBe('Permission was denied for the requested browser operation.');
      expect(error2.getUserFriendlyMessage()).toBe('Permission was denied for the requested browser operation.');
    });

    test('handles operation and reason without permission type', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        operation: 'specialOperation',
        denialReason: 'Custom security policy',
        // No permissionType
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('The specialOperation operation was denied: Custom security policy');
    });

    test('handles operation without reason and permission type', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        operation: 'specialOperation',
        // No denialReason or permissionType
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('Permission was denied for the requested browser operation.');
    });

    test('handles reason without operation and permission type', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        denialReason: 'Custom security policy',
        // No operation or permissionType
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('Permission was denied for the requested browser operation.');
    });
  });

  describe('resolution suggestions edge cases', () => {
    test('includes denial reason in suggestions for unknown permission types', () => {
      const customReason = 'Very specific configuration issue that needs addressing';
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'unknown',
        denialReason: customReason,
      });

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Check browser permissions and security settings');
      expect(suggestions).toContain('Review tool configuration for permission restrictions');
      expect(suggestions).toContain(`Address the specific issue: ${customReason}`);
    });

    test('provides default suggestions when no permission type or reason', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {});

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Check browser permissions and security settings');
      expect(suggestions).toContain('Review tool configuration for permission restrictions');
      expect(suggestions).not.toContain('Address the specific issue:');
    });

    test('all permission types provide at least one suggestion', () => {
      const permissionTypes: Array<BrowserPermissionDeniedContext['permissionType']> = [
        'geolocation',
        'camera',
        'microphone',
        'notifications',
        'clipboard',
        'storage',
        'domain',
        'javascript',
        'form',
        'unknown'
      ];

      permissionTypes.forEach((type) => {
        const error = new BrowserPermissionDeniedError('Permission denied', {
          permissionType: type,
        });

        const suggestions = error.getResolutionSuggestions();
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.every(s => typeof s === 'string' && s.length > 0)).toBe(true);
      });
    });
  });

  describe('type guard edge cases', () => {
    test('handles various falsy values', () => {
      const falsyValues = [null, undefined, false, 0, '', NaN];

      falsyValues.forEach((value) => {
        expect(isBrowserPermissionDeniedError(value)).toBe(false);
      });
    });

    test('handles objects that look like errors but are not', () => {
      const fakeError = {
        name: 'BrowserPermissionDeniedError',
        message: 'Fake error',
        code: ApexErrorCode.BROWSER_PERMISSION_DENIED,
      };

      expect(isBrowserPermissionDeniedError(fakeError)).toBe(false);
    });

    test('handles subclasses correctly', () => {
      class ExtendedBrowserPermissionDeniedError extends BrowserPermissionDeniedError {
        constructor() {
          super('Extended error');
        }
      }

      const extended = new ExtendedBrowserPermissionDeniedError();
      expect(isBrowserPermissionDeniedError(extended)).toBe(true);
    });
  });

  describe('utility function edge cases', () => {
    describe('toBrowserPermissionDeniedError', () => {
      test('preserves stack trace when converting', () => {
        const originalError = new Error('Original error');
        const converted = toBrowserPermissionDeniedError(originalError);

        expect(converted.cause).toBe(originalError);
        expect(converted.stack).toBeDefined();
      });

      test('handles error with no message', () => {
        const originalError = new Error();
        const converted = toBrowserPermissionDeniedError(originalError, {
          operation: 'test',
        });

        expect(converted.message).toBe(' (Operation: test)');
        expect(converted.cause).toBe(originalError);
      });

      test('merges context correctly when converting', () => {
        const originalError = new Error('Original error');
        const context: BrowserPermissionDeniedContext = {
          operation: 'click',
          target: 'button',
          permissionType: 'domain',
          taskId: 'task-123',
        };

        const converted = toBrowserPermissionDeniedError(originalError, context);

        expect(converted.browserContext.operation).toBe('click');
        expect(converted.browserContext.target).toBe('button');
        expect(converted.browserContext.permissionType).toBe('domain');
        expect(converted.context.taskId).toBe('task-123');
      });
    });
  });

  describe('inheritance chain validation', () => {
    test('maintains proper prototype chain', () => {
      const error = new BrowserPermissionDeniedError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof BrowserPermissionDeniedError).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(BrowserPermissionDeniedError.prototype);
      expect(error.constructor).toBe(BrowserPermissionDeniedError);
    });

    test('name property is correctly set', () => {
      const error = new BrowserPermissionDeniedError('Test error');
      expect(error.name).toBe('BrowserPermissionDeniedError');
    });

    test('toString method works correctly', () => {
      const error = new BrowserPermissionDeniedError('Test error', {
        taskId: 'task-123',
      });

      const str = error.toString();
      expect(str).toContain('BrowserPermissionDeniedError');
      expect(str).toContain('[APEX_1800]');
      expect(str).toContain('Test error');
      expect(str).toContain('Task: task-123');
    });
  });

  describe('BrowserResourceState interface validation', () => {
    test('BrowserResourceState interface is properly exported and typeable', () => {
      // This test validates that the BrowserResourceState interface can be used correctly
      const mockResourceState: BrowserResourceState = {
        browserActive: true,
        contextActive: true,
        pageActive: false,
        currentUrl: 'https://example.com',
        lastAllocation: new Date(),
        sessionId: 'session-123',
        activeOperations: 2,
      };

      expect(mockResourceState.browserActive).toBe(true);
      expect(mockResourceState.contextActive).toBe(true);
      expect(mockResourceState.pageActive).toBe(false);
      expect(mockResourceState.currentUrl).toBe('https://example.com');
      expect(mockResourceState.lastAllocation).toBeInstanceOf(Date);
      expect(mockResourceState.sessionId).toBe('session-123');
      expect(mockResourceState.activeOperations).toBe(2);
    });

    test('BrowserResourceState handles optional properties', () => {
      const minimalResourceState: BrowserResourceState = {
        browserActive: false,
        contextActive: false,
        pageActive: false,
        activeOperations: 0,
      };

      expect(minimalResourceState.currentUrl).toBeUndefined();
      expect(minimalResourceState.lastAllocation).toBeUndefined();
      expect(minimalResourceState.sessionId).toBeUndefined();
    });
  });

  describe('concurrent error creation scenarios', () => {
    test('creates multiple errors with different contexts simultaneously', () => {
      const errors = Array.from({ length: 100 }, (_, i) =>
        new BrowserPermissionDeniedError(`Error ${i}`, {
          operation: `operation-${i}`,
          target: `target-${i}`,
          denialReason: `reason-${i}`,
          taskId: `task-${i}`,
        })
      );

      // All errors should have unique IDs and proper properties
      const errorIds = errors.map(e => e.errorId);
      const uniqueIds = new Set(errorIds);
      expect(uniqueIds.size).toBe(100);

      errors.forEach((error, i) => {
        expect(error.message).toContain(`Error ${i}`);
        expect(error.browserContext.operation).toBe(`operation-${i}`);
        expect(error.context.taskId).toBe(`task-${i}`);
        expect(error.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      });
    });
  });
});