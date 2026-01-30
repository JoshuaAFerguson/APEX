/**
 * @fileoverview Integration tests for BrowserPermissionDeniedError with APEX ecosystem
 *
 * These tests verify that BrowserPermissionDeniedError integrates correctly
 * with the broader APEX error handling and tool systems.
 */

import { describe, test, expect } from 'vitest';
import { ApexErrorCode, isApexError, toSafeErrorResponse } from '../../../apex-error.js';
import { BrowserPermissionDeniedError, isBrowserPermissionDeniedError } from '../browser-permission-denied-error.js';

describe('BrowserPermissionDeniedError Integration', () => {
  describe('APEX error system integration', () => {
    test('is recognized as an ApexError', () => {
      const error = new BrowserPermissionDeniedError('Permission denied');

      expect(isApexError(error)).toBe(true);
      expect(error.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(error.errorId).toMatch(/^apex_err_/);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    test('provides safe error response', () => {
      const error = new BrowserPermissionDeniedError('Geolocation access denied', {
        operation: 'getCurrentPosition',
        target: 'navigator.geolocation',
        permissionType: 'geolocation',
        taskId: 'task-123',
        agentId: 'browser-agent',
      });

      const safeResponse = toSafeErrorResponse(error);

      expect(safeResponse).toEqual({
        errorId: error.errorId,
        code: ApexErrorCode.BROWSER_PERMISSION_DENIED,
        message: 'Browser permission denied', // From SAFE_ERROR_MESSAGES
      });
    });

    test('error context is properly structured', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        operation: 'navigate',
        target: 'https://example.com',
        denialReason: 'Domain blocked',
        taskId: 'task-456',
        agentId: 'browser-agent',
        stage: 'execution',
      });

      const details = error.getDetails();

      expect(details.context.operation).toBe('navigate');
      expect(details.context.taskId).toBe('task-456');
      expect(details.context.agentId).toBe('browser-agent');
      expect(details.context.stage).toBe('execution');
      expect(details.context.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('error categorization and filtering', () => {
    test('is correctly categorized as browser error', () => {
      const error = new BrowserPermissionDeniedError('Permission denied');

      expect(error.isCategory('APEX_18')).toBe(true); // Browser errors range
      expect(error.isCategory('APEX_11')).toBe(false); // Task errors range
      expect(error.isCode(ApexErrorCode.BROWSER_PERMISSION_DENIED)).toBe(true);
    });

    test('type guard works correctly', () => {
      const browserError = new BrowserPermissionDeniedError('Permission denied');
      const apexError = new Error('Regular error');

      expect(isBrowserPermissionDeniedError(browserError)).toBe(true);
      expect(isBrowserPermissionDeniedError(apexError)).toBe(false);
      expect(isBrowserPermissionDeniedError(null)).toBe(false);
      expect(isBrowserPermissionDeniedError(undefined)).toBe(false);
    });
  });

  describe('error chains and causality', () => {
    test('preserves error chains correctly', () => {
      const originalError = new Error('Browser API error');
      const browserError = new BrowserPermissionDeniedError(
        'Permission denied',
        { operation: 'geolocation' },
        originalError
      );

      expect(browserError.cause).toBe(originalError);

      const details = browserError.getDetails();
      expect(details.cause?.message).toBe('Browser API error');
      expect(details.cause?.name).toBe('Error');
    });

    test('toString includes cause information', () => {
      const originalError = new Error('Permission denied by user');
      const browserError = new BrowserPermissionDeniedError(
        'Geolocation access failed',
        {
          operation: 'getCurrentPosition',
          taskId: 'task-789',
        },
        originalError
      );

      const errorString = browserError.toString();

      expect(errorString).toContain('BrowserPermissionDeniedError');
      expect(errorString).toContain('[APEX_1800]');
      expect(errorString).toContain('Geolocation access failed');
      expect(errorString).toContain('Task: task-789');
      expect(errorString).toContain('Caused by: Error: Permission denied by user');
    });
  });

  describe('serialization and JSON handling', () => {
    test('serializes correctly to JSON', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        operation: 'camera',
        permissionType: 'camera',
        target: 'navigator.mediaDevices',
        taskId: 'video-task',
      });

      const json = JSON.parse(JSON.stringify(error));

      expect(json.name).toBe('BrowserPermissionDeniedError');
      expect(json.code).toBe('APEX_1800');
      expect(json.context.operation).toBe('camera');
      expect(json.context.taskId).toBe('video-task');
    });

    test('toJSON method works correctly', () => {
      const error = new BrowserPermissionDeniedError('Permission denied', {
        operation: 'microphone',
        permissionType: 'microphone',
      });

      const jsonObj = error.toJSON();

      expect(jsonObj).toHaveProperty('errorId');
      expect(jsonObj).toHaveProperty('name', 'BrowserPermissionDeniedError');
      expect(jsonObj).toHaveProperty('code', ApexErrorCode.BROWSER_PERMISSION_DENIED);
      expect(jsonObj).toHaveProperty('context');
    });
  });

  describe('real-world usage scenarios', () => {
    test('domain restriction scenario', () => {
      const error = BrowserPermissionDeniedError.forDomainRestriction(
        'malicious.example.com',
        'navigate',
        'Domain is on security blocklist'
      );

      expect(error.isOperation('navigate')).toBe(true);
      expect(error.isPermissionType('domain')).toBe(true);
      expect(error.getUserFriendlyMessage()).toContain('domain was blocked');

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Add the domain to the allowed domains list');
    });

    test('disabled feature scenario', () => {
      const error = BrowserPermissionDeniedError.forDisabledFeature(
        'javascript',
        'evaluate'
      );

      expect(error.isOperation('evaluate')).toBe(true);
      expect(error.isPermissionType('javascript')).toBe(true);
      expect(error.message).toContain('javascript execution is disabled');

      const suggestions = error.getResolutionSuggestions();
      expect(suggestions).toContain('Enable JavaScript execution in tool configuration');
    });

    test('browser API permission scenario', () => {
      const originalPermissionError = new Error('User denied geolocation permission');
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'geolocation',
        'getCurrentPosition',
        'https://maps.example.com',
        originalPermissionError
      );

      expect(error.isPermissionType('geolocation')).toBe(true);
      expect(error.browserContext.target).toBe('https://maps.example.com');
      expect(error.cause).toBe(originalPermissionError);

      const userMessage = error.getUserFriendlyMessage();
      expect(userMessage).toContain('Location access was denied');
    });
  });

  describe('error code validation', () => {
    test('uses correct error code range', () => {
      const error = new BrowserPermissionDeniedError('Test');

      // Browser errors should be in the 1800-1899 range
      expect(error.code).toBe('APEX_1800');
      expect(error.code.startsWith('APEX_18')).toBe(true);
    });

    test('error code is properly categorized', () => {
      const error = new BrowserPermissionDeniedError('Test');

      // Should be in the browser category (1800s)
      expect(error.isCategory('APEX_18')).toBe(true);

      // Should not be in other categories
      expect(error.isCategory('APEX_11')).toBe(false); // Task errors
      expect(error.isCategory('APEX_12')).toBe(false); // Agent errors
      expect(error.isCategory('APEX_17')).toBe(false); // Integration errors
    });
  });
});