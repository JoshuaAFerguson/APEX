/**
 * @fileoverview Unit tests for BrowserPermissionDeniedError
 *
 * These tests validate error construction, message formatting, type checking,
 * and utility methods for browser permission denied scenarios.
 */

import { describe, test, expect } from 'vitest';
import { ApexErrorCode } from '../../../apex-error.js';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  toBrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext,
} from '../browser-permission-denied-error.js';

describe('BrowserPermissionDeniedError', () => {
  describe('constructor', () => {
    test('creates error with minimal parameters', () => {
      const error = new BrowserPermissionDeniedError('Permission denied');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BrowserPermissionDeniedError);
      expect(error.name).toBe('BrowserPermissionDeniedError');
      expect(error.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(error.message).toBe('Permission denied');
      expect(error.browserContext).toEqual({});
    });

    test('creates error with operation context', () => {
      const context: BrowserPermissionDeniedContext = {
        operation: 'navigate',
        target: 'https://example.com',
        denialReason: 'Domain not allowed',
        permissionType: 'domain',
      };

      const error = new BrowserPermissionDeniedError('Navigation blocked', context);

      expect(error.message).toBe('Navigation blocked (Operation: navigate) (Target: https://example.com) (Reason: Domain not allowed)');
      expect(error.browserContext).toEqual(context);
      expect(error.context.operation).toBe('navigate');
    });

    test('creates error with cause', () => {
      const originalError = new Error('Original permission error');
      const error = new BrowserPermissionDeniedError('Permission denied', {}, originalError);

      expect(error.cause).toBe(originalError);
    });

    test('sets proper prototype for instanceof checks', () => {
      const error = new BrowserPermissionDeniedError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof BrowserPermissionDeniedError).toBe(true);
      expect(error.constructor.name).toBe('BrowserPermissionDeniedError');
    });
  });

  describe('enhanced message creation', () => {
    test('includes operation in message', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        operation: 'click',
      });

      expect(error.message).toBe('Base message (Operation: click)');
    });

    test('includes target in message', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        target: '#submit-button',
      });

      expect(error.message).toBe('Base message (Target: #submit-button)');
    });

    test('includes denial reason in message', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        denialReason: 'Feature disabled',
      });

      expect(error.message).toBe('Base message (Reason: Feature disabled)');
    });

    test('includes all context in message', () => {
      const error = new BrowserPermissionDeniedError('Base message', {
        operation: 'evaluate',
        target: 'document.cookie',
        denialReason: 'JavaScript execution disabled',
      });

      expect(error.message).toBe('Base message (Operation: evaluate) (Target: document.cookie) (Reason: JavaScript execution disabled)');
    });
  });

  describe('permission type checking', () => {
    test('identifies permission type correctly', () => {
      const error = new BrowserPermissionDeniedError('Test', {
        permissionType: 'geolocation',
      });

      expect(error.isPermissionType('geolocation')).toBe(true);
      expect(error.isPermissionType('camera')).toBe(false);
      expect(error.isPermissionType('unknown')).toBe(false);
    });

    test('handles undefined permission type', () => {
      const error = new BrowserPermissionDeniedError('Test', {});

      expect(error.isPermissionType('geolocation')).toBe(false);
      expect(error.isPermissionType(undefined)).toBe(true);
    });
  });

  describe('operation checking', () => {
    test('identifies operation correctly', () => {
      const error = new BrowserPermissionDeniedError('Test', {
        operation: 'navigate',
      });

      expect(error.isOperation('navigate')).toBe(true);
      expect(error.isOperation('click')).toBe(false);
    });

    test('handles undefined operation', () => {
      const error = new BrowserPermissionDeniedError('Test', {});

      expect(error.isOperation('navigate')).toBe(false);
    });
  });

  describe('user-friendly messages', () => {
    test('provides geolocation-specific message', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'geolocation',
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('Location access was denied. Please allow location permissions in your browser settings.');
    });

    test('provides camera-specific message', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'camera',
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('Camera access was denied. Please allow camera permissions in your browser settings.');
    });

    test('provides domain-specific message', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'domain',
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('Access to the requested domain was blocked by security policies.');
    });

    test('provides generic message with operation and reason', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        operation: 'screenshot',
        denialReason: 'Screenshots disabled',
      });

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('The screenshot operation was denied: Screenshots disabled');
    });

    test('provides fallback message', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {});

      const message = error.getUserFriendlyMessage();
      expect(message).toBe('Permission was denied for the requested browser operation.');
    });
  });

  describe('resolution suggestions', () => {
    test('provides geolocation suggestions', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'geolocation',
      });

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Enable location permissions in browser settings');
      expect(suggestions).toContain('Check that the site is allowed to access location');
    });

    test('provides domain restriction suggestions', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        permissionType: 'domain',
      });

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Add the domain to the allowed domains list');
      expect(suggestions).toContain('Contact administrator to update security policies');
    });

    test('includes denial reason in suggestions', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        denialReason: 'Custom configuration issue',
      });

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Address the specific issue: Custom configuration issue');
    });
  });

  describe('static factory methods', () => {
    describe('fromBrowserPermissionError', () => {
      test('creates error from browser permission error', () => {
        const originalError = new Error('Permission denied by user');
        const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
          'geolocation',
          'getCurrentPosition',
          'https://example.com',
          originalError
        );

        expect(error.message).toBe("Browser permission 'geolocation' was denied (Operation: getCurrentPosition) (Target: https://example.com) (Reason: Permission denied by user)");
        expect(error.browserContext.operation).toBe('getCurrentPosition');
        expect(error.browserContext.target).toBe('https://example.com');
        expect(error.browserContext.permissionType).toBe('geolocation');
        expect(error.cause).toBe(originalError);
      });

      test('handles unknown permission types', () => {
        const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
          'unknown-permission',
          'someOperation'
        );

        expect(error.browserContext.permissionType).toBe('unknown');
      });
    });

    describe('forDomainRestriction', () => {
      test('creates error for domain restriction', () => {
        const error = BrowserPermissionDeniedError.forDomainRestriction(
          'restricted.com',
          'navigate',
          'Domain not in whitelist'
        );

        expect(error.message).toBe("Access to domain 'restricted.com' was denied (Operation: navigate) (Target: restricted.com) (Reason: Domain not in whitelist)");
        expect(error.browserContext.operation).toBe('navigate');
        expect(error.browserContext.target).toBe('restricted.com');
        expect(error.browserContext.permissionType).toBe('domain');
        expect(error.browserContext.denialReason).toBe('Domain not in whitelist');
      });
    });

    describe('forDisabledFeature', () => {
      test('creates error for disabled JavaScript', () => {
        const error = BrowserPermissionDeniedError.forDisabledFeature('javascript', 'evaluate');

        expect(error.message).toBe("Feature 'javascript' is disabled (Operation: evaluate) (Reason: javascript execution is disabled in tool configuration)");
        expect(error.browserContext.operation).toBe('evaluate');
        expect(error.browserContext.permissionType).toBe('javascript');
      });

      test('creates error for disabled forms', () => {
        const error = BrowserPermissionDeniedError.forDisabledFeature('form', 'submit');

        expect(error.message).toBe("Feature 'form' is disabled (Operation: submit) (Reason: form execution is disabled in tool configuration)");
        expect(error.browserContext.operation).toBe('submit');
        expect(error.browserContext.permissionType).toBe('form');
      });

      test('creates error for disabled screenshots', () => {
        const error = BrowserPermissionDeniedError.forDisabledFeature('screenshots', 'screenshot');

        expect(error.message).toBe("Feature 'screenshots' is disabled (Operation: screenshot) (Reason: screenshots execution is disabled in tool configuration)");
        expect(error.browserContext.operation).toBe('screenshot');
        expect(error.browserContext.permissionType).toBe('storage');
      });
    });
  });

  describe('type guards and utilities', () => {
    describe('isBrowserPermissionDeniedError', () => {
      test('identifies BrowserPermissionDeniedError correctly', () => {
        const browserError = new BrowserPermissionDeniedError('Test');
        const regularError = new Error('Test');
        const nullValue = null;
        const undefinedValue = undefined;

        expect(isBrowserPermissionDeniedError(browserError)).toBe(true);
        expect(isBrowserPermissionDeniedError(regularError)).toBe(false);
        expect(isBrowserPermissionDeniedError(nullValue)).toBe(false);
        expect(isBrowserPermissionDeniedError(undefinedValue)).toBe(false);
      });
    });

    describe('toBrowserPermissionDeniedError', () => {
      test('returns same instance if already BrowserPermissionDeniedError', () => {
        const browserError = new BrowserPermissionDeniedError('Test');
        const result = toBrowserPermissionDeniedError(browserError);

        expect(result).toBe(browserError);
      });

      test('converts regular Error to BrowserPermissionDeniedError', () => {
        const regularError = new Error('Regular error');
        const context: BrowserPermissionDeniedContext = {
          operation: 'click',
          permissionType: 'domain',
        };

        const result = toBrowserPermissionDeniedError(regularError, context);

        expect(result).toBeInstanceOf(BrowserPermissionDeniedError);
        expect(result.message).toBe('Regular error (Operation: click)');
        expect(result.cause).toBe(regularError);
        expect(result.browserContext.operation).toBe('click');
        expect(result.browserContext.permissionType).toBe('domain');
      });

      test('converts with empty context', () => {
        const regularError = new Error('Regular error');
        const result = toBrowserPermissionDeniedError(regularError);

        expect(result).toBeInstanceOf(BrowserPermissionDeniedError);
        expect(result.message).toBe('Regular error');
        expect(result.cause).toBe(regularError);
        expect(result.browserContext).toEqual({});
      });
    });
  });

  describe('inheritance and error properties', () => {
    test('extends ApexError correctly', () => {
      const error = new BrowserPermissionDeniedError('Test error', {
        taskId: 'task-123',
        agentId: 'browser-agent',
      });

      expect(error.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(error.context.taskId).toBe('task-123');
      expect(error.context.agentId).toBe('browser-agent');
      expect(error.errorId).toMatch(/^apex_err_/);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    test('supports error serialization', () => {
      const error = new BrowserPermissionDeniedError('Test error', {
        operation: 'navigate',
        target: 'https://example.com',
      });

      const serialized = error.toJSON();
      expect(serialized).toHaveProperty('errorId');
      expect(serialized).toHaveProperty('code', ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(serialized).toHaveProperty('message');
      expect(serialized).toHaveProperty('context');
    });

    test('provides detailed error information', () => {
      const originalError = new Error('Original error');
      const error = new BrowserPermissionDeniedError(
        'Test error',
        {
          operation: 'click',
          taskId: 'task-123',
        },
        originalError
      );

      const details = error.getDetails();
      expect(details.name).toBe('BrowserPermissionDeniedError');
      expect(details.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(details.context.operation).toBe('click');
      expect(details.cause?.message).toBe('Original error');
    });
  });

  describe('permission type mapping', () => {
    test('maps standard browser permission names', () => {
      const testCases = [
        { input: 'geolocation', expected: 'geolocation' },
        { input: 'camera', expected: 'camera' },
        { input: 'microphone', expected: 'microphone' },
        { input: 'notifications', expected: 'notifications' },
        { input: 'clipboard-read', expected: 'clipboard' },
        { input: 'clipboard-write', expected: 'clipboard' },
        { input: 'persistent-storage', expected: 'storage' },
        { input: 'unknown-permission', expected: 'unknown' },
      ];

      testCases.forEach(({ input, expected }) => {
        const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
          input,
          'testOperation'
        );
        expect(error.browserContext.permissionType).toBe(expected);
      });
    });

    test('handles case insensitive permission names', () => {
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'GEOLOCATION',
        'testOperation'
      );
      expect(error.browserContext.permissionType).toBe('geolocation');
    });
  });
});