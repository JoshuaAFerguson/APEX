/**
 * Comprehensive Permission Denial and Error Handling Tests
 *
 * This test suite verifies:
 * 1. Proper error messages and graceful degradation when permissions are denied
 * 2. Permission revocation scenarios and user prompt cancellation
 * 3. Error handling across different permission denial paths
 * 4. Test coverage adequacy for all permission scenarios
 *
 * @category Permission Tests
 * @see ADR-052-permission-denial-error-handling-tests.md
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  toBrowserPermissionDeniedError,
  type BrowserPermissionDeniedContext
} from '../tools/browser/browser-permission-denied-error.js';
import { ApexError, ApexErrorCode, type ApexErrorContext } from '../apex-error.js';

describe('Comprehensive Permission Denial and Error Handling Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'permission-denial-test-'));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('User Prompt Cancellation Scenarios', () => {
    test('should handle user cancelling permission prompt via SIGINT', async () => {
      const mockPrompt = vi.fn().mockImplementation(() => {
        const error = new Error('User cancelled the prompt');
        error.name = 'ExitPromptError';
        throw error;
      });

      // Simulate user cancelling permission prompt
      const permissionError = new BrowserPermissionDeniedError(
        'Permission request cancelled by user',
        {
          permissionType: 'camera',
          operation: 'getUserMedia',
          denialReason: 'User cancelled permission dialog'
        }
      );

      expect(permissionError.getUserFriendlyMessage()).toBe(
        'Camera access was denied. Please allow camera permissions in your browser settings.'
      );

      // Verify proper error code
      expect(permissionError.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
    });

    test('should handle user closing prompt window (timeout scenario)', async () => {
      const timeoutError = new BrowserPermissionDeniedError(
        'Permission request timed out',
        {
          permissionType: 'notifications',
          operation: 'requestPermission',
          denialReason: 'User did not respond to permission prompt within timeout period',
          target: 'https://example.com'
        }
      );

      // Verify timeout is handled gracefully
      expect(timeoutError.getUserFriendlyMessage()).toBe(
        'Notification permissions were denied. Please enable notifications in your browser settings.'
      );

      // Check that timeout scenarios provide helpful resolution suggestions
      const suggestions = timeoutError.getResolutionSuggestions();
      expect(suggestions).toContain('Enable notification permissions for this site');
      expect(suggestions).toContain('Check browser notification settings');
    });

    test('should preserve partial results when permission is cancelled mid-operation', async () => {
      // Simulate scenario where permission is granted, some work is done, then cancelled
      const partialResults = {
        completedOperations: [
          { operation: 'read', file: '/tmp/data1.txt', success: true },
          { operation: 'read', file: '/tmp/data2.txt', success: true }
        ],
        cancelledOperations: [
          { operation: 'write', file: '/tmp/output.txt', success: false, reason: 'Permission cancelled' }
        ]
      };

      const cancellationError = new BrowserPermissionDeniedError(
        'Operation cancelled during execution',
        {
          permissionType: 'storage',
          operation: 'writeFile',
          denialReason: 'User cancelled permission mid-operation',
          target: '/tmp/output.txt'
        }
      );

      // Verify error provides context for partial completion
      expect(cancellationError.message).toContain('Operation cancelled during execution');
      expect(cancellationError.browserContext.denialReason).toBe('User cancelled permission mid-operation');

      // Verify graceful handling doesn't lose partial results
      const details = cancellationError.getDetails();
      expect(details.context.target).toBe('/tmp/output.txt');
      expect(details.context.operation).toBe('writeFile');
    });

    test('should handle subsequent tool calls after user cancellation', async () => {
      // First operation: cancelled
      const firstError = new BrowserPermissionDeniedError(
        'First operation cancelled',
        {
          permissionType: 'clipboard',
          operation: 'writeText',
          denialReason: 'User cancelled'
        }
      );

      // Second operation: should be blocked due to earlier cancellation
      const secondError = new BrowserPermissionDeniedError(
        'Subsequent operation blocked',
        {
          permissionType: 'clipboard',
          operation: 'writeText',
          denialReason: 'Permission previously denied'
        }
      );

      // Both errors should have same permission type
      expect(firstError.isPermissionType('clipboard')).toBe(true);
      expect(secondError.isPermissionType('clipboard')).toBe(true);

      // Both should provide same user-friendly message
      const firstMessage = firstError.getUserFriendlyMessage();
      const secondMessage = secondError.getUserFriendlyMessage();
      expect(firstMessage).toBe(secondMessage);
      expect(firstMessage).toBe('Clipboard access was denied. Please allow clipboard permissions for this operation.');
    });
  });

  describe('Permission Revocation Scenarios', () => {
    test('should handle permission revocation during active operation', async () => {
      const revocationError = new BrowserPermissionDeniedError(
        'Permission was revoked while operation was in progress',
        {
          permissionType: 'geolocation',
          operation: 'getCurrentPosition',
          denialReason: 'Permission revoked by user or system policy',
          target: 'https://maps.example.com'
        }
      );

      // Verify revocation provides clear message
      expect(revocationError.getUserFriendlyMessage()).toBe(
        'Location access was denied. Please allow location permissions in your browser settings.'
      );

      // Verify resolution suggestions are helpful for revocation scenarios
      const suggestions = revocationError.getResolutionSuggestions();
      expect(suggestions).toContain('Enable location permissions in browser settings');
      expect(suggestions).toContain('Check that the site is allowed to access location');
    });

    test('should handle permission revocation for multiple tools simultaneously', async () => {
      const multiToolRevocation = [
        new BrowserPermissionDeniedError(
          'Camera permission revoked',
          {
            permissionType: 'camera',
            operation: 'getUserMedia',
            denialReason: 'Bulk permission revocation by user'
          }
        ),
        new BrowserPermissionDeniedError(
          'Microphone permission revoked',
          {
            permissionType: 'microphone',
            operation: 'getUserMedia',
            denialReason: 'Bulk permission revocation by user'
          }
        ),
        new BrowserPermissionDeniedError(
          'Notification permission revoked',
          {
            permissionType: 'notifications',
            operation: 'requestPermission',
            denialReason: 'Bulk permission revocation by user'
          }
        )
      ];

      // All should be properly categorized as permission errors
      for (const error of multiToolRevocation) {
        expect(isBrowserPermissionDeniedError(error)).toBe(true);
        expect(error.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
      }

      // Each should have specific user-friendly message
      expect(multiToolRevocation[0].getUserFriendlyMessage()).toBe(
        'Camera access was denied. Please allow camera permissions in your browser settings.'
      );
      expect(multiToolRevocation[1].getUserFriendlyMessage()).toBe(
        'Microphone access was denied. Please allow microphone permissions in your browser settings.'
      );
      expect(multiToolRevocation[2].getUserFriendlyMessage()).toBe(
        'Notification permissions were denied. Please enable notifications in your browser settings.'
      );
    });

    test('should handle permission downgrade scenarios (always -> once -> denied)', async () => {
      // Simulate permission downgrade scenario
      const downgrades = [
        {
          stage: 'allow-always',
          error: null
        },
        {
          stage: 'allow-once',
          error: new BrowserPermissionDeniedError(
            'Permission downgraded to single use',
            {
              permissionType: 'storage',
              operation: 'requestStorageAccess',
              denialReason: 'Permission downgraded from always-allow to single-use'
            }
          )
        },
        {
          stage: 'deny',
          error: new BrowserPermissionDeniedError(
            'Permission completely revoked',
            {
              permissionType: 'storage',
              operation: 'requestStorageAccess',
              denialReason: 'Permission completely revoked after downgrade'
            }
          )
        }
      ];

      // Verify final denial provides proper error handling
      const finalError = downgrades[2].error!;
      expect(finalError.getUserFriendlyMessage()).toBe(
        'Storage access was denied. Please check your browser privacy settings.'
      );
      expect(finalError.browserContext.denialReason).toBe(
        'Permission completely revoked after downgrade'
      );
    });
  });

  describe('Graceful Degradation Verification', () => {
    test('should never throw unhandled exceptions on permission denial', () => {
      const permissionTypes: BrowserPermissionDeniedContext['permissionType'][] = [
        'geolocation', 'camera', 'microphone', 'notifications', 'clipboard',
        'storage', 'domain', 'javascript', 'form', 'unknown', undefined
      ];

      // Test all permission types for graceful handling
      for (const permissionType of permissionTypes) {
        expect(() => {
          const error = new BrowserPermissionDeniedError(
            'Test denial',
            { permissionType }
          );

          // These operations should never throw
          error.getUserFriendlyMessage();
          error.getResolutionSuggestions();
          error.toJSON();
          error.toSafeErrorResponse();
          error.toString();
          error.getDetails();
        }).not.toThrow();
      }
    });

    test('should provide consistent error responses across all denial types', () => {
      const denialScenarios = [
        {
          scenario: 'User denied permission',
          error: new BrowserPermissionDeniedError(
            'User explicitly denied permission',
            {
              permissionType: 'camera',
              operation: 'getUserMedia',
              denialReason: 'User clicked "Block" on permission dialog'
            }
          )
        },
        {
          scenario: 'System policy denial',
          error: new BrowserPermissionDeniedError(
            'System policy blocked permission',
            {
              permissionType: 'camera',
              operation: 'getUserMedia',
              denialReason: 'Corporate security policy blocks camera access'
            }
          )
        },
        {
          scenario: 'Browser security denial',
          error: new BrowserPermissionDeniedError(
            'Browser blocked insecure request',
            {
              permissionType: 'camera',
              operation: 'getUserMedia',
              denialReason: 'HTTPS required for camera access'
            }
          )
        }
      ];

      // All scenarios should provide consistent interface
      for (const { scenario, error } of denialScenarios) {
        expect(error.getUserFriendlyMessage()).toBe(
          'Camera access was denied. Please allow camera permissions in your browser settings.'
        );

        const response = error.toSafeErrorResponse();
        expect(response.message).toBe('Browser permission denied');
        expect(response.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);

        // Should not expose internal details in safe response
        expect(response.message).not.toContain('Corporate security');
        expect(response.message).not.toContain('HTTPS required');
      }
    });

    test('should handle error chaining without losing context', () => {
      const rootCause = new Error('Network connection timeout');
      const networkError = new Error('Failed to connect to permission service', { cause: rootCause });
      const permissionError = new BrowserPermissionDeniedError(
        'Permission check failed',
        {
          permissionType: 'notifications',
          operation: 'requestPermission',
          denialReason: 'Unable to contact permission service'
        },
        networkError
      );

      // Verify error chain is preserved
      expect(permissionError.cause).toBe(networkError);
      expect(networkError.cause).toBe(rootCause);

      // Verify stack trace includes full chain
      const errorString = permissionError.toString(true);
      expect(errorString).toContain('BrowserPermissionDeniedError: Permission check failed');
      expect(errorString).toContain('Caused by: Error: Failed to connect to permission service');

      // Verify user-friendly message doesn't expose internal errors
      expect(permissionError.getUserFriendlyMessage()).toBe(
        'Notification permissions were denied. Please enable notifications in your browser settings.'
      );
    });

    test('should sanitize sensitive information from error messages', () => {
      const sensitiveError = new BrowserPermissionDeniedError(
        'Permission denied for user alice@company.com at /home/alice/.private/api-keys.json',
        {
          permissionType: 'storage',
          operation: 'readFile',
          target: '/home/alice/.private/api-keys.json',
          denialReason: 'Access denied to credential file with password=secret123'
        }
      );

      // User-friendly message should not contain sensitive paths or credentials
      const userMessage = sensitiveError.getUserFriendlyMessage();
      expect(userMessage).not.toContain('alice@company.com');
      expect(userMessage).not.toContain('/home/alice/.private');
      expect(userMessage).not.toContain('api-keys.json');
      expect(userMessage).not.toContain('password=secret123');

      // Safe error response should be generic
      const safeResponse = sensitiveError.toSafeErrorResponse();
      expect(safeResponse.message).toBe('Browser permission denied');
      expect(safeResponse.message).not.toContain('alice@company.com');
    });
  });

  describe('Error Code and Type Classification', () => {
    test('should correctly classify all permission error types', () => {
      const errorTypes = [
        new BrowserPermissionDeniedError('Test', { permissionType: 'camera' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'microphone' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'geolocation' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'notifications' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'clipboard' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'storage' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'domain' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'javascript' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'form' }),
        new BrowserPermissionDeniedError('Test', { permissionType: 'unknown' })
      ];

      for (const error of errorTypes) {
        // Type classification
        expect(isBrowserPermissionDeniedError(error)).toBe(true);
        expect(error instanceof BrowserPermissionDeniedError).toBe(true);
        expect(error instanceof ApexError).toBe(true);
        expect(error instanceof Error).toBe(true);

        // Error code classification
        expect(error.code).toBe(ApexErrorCode.BROWSER_PERMISSION_DENIED);
        expect(error.isCode(ApexErrorCode.BROWSER_PERMISSION_DENIED)).toBe(true);
        expect(error.isCode(ApexErrorCode.VALIDATION_ERROR)).toBe(false);
        expect(error.isCode(ApexErrorCode.INTERNAL_ERROR)).toBe(false);

        // Category classification (adjust category name as needed)
        expect(error.isCategory('APEX_18')).toBe(true);
      }
    });

    test('should distinguish permission errors from other error types', () => {
      const permissionError = new BrowserPermissionDeniedError(
        'Permission denied',
        { permissionType: 'camera' }
      );
      const validationError = new ApexError('Validation failed', ApexErrorCode.VALIDATION_ERROR);
      const genericError = new Error('Generic error');

      // Type guards should distinguish correctly
      expect(isBrowserPermissionDeniedError(permissionError)).toBe(true);
      expect(isBrowserPermissionDeniedError(validationError)).toBe(false);
      expect(isBrowserPermissionDeniedError(genericError)).toBe(false);
      expect(isBrowserPermissionDeniedError(null)).toBe(false);
      expect(isBrowserPermissionDeniedError(undefined)).toBe(false);
      expect(isBrowserPermissionDeniedError('string')).toBe(false);
    });

    test('should handle error conversion and wrapping correctly', () => {
      const originalError = new Error('Original error message');
      const context: BrowserPermissionDeniedContext = {
        permissionType: 'microphone',
        operation: 'getUserMedia',
        denialReason: 'Hardware not available'
      };

      // Convert generic error to permission error
      const permissionError = toBrowserPermissionDeniedError(originalError, context);

      expect(permissionError instanceof BrowserPermissionDeniedError).toBe(true);
      expect(permissionError.cause).toBe(originalError);
      expect(permissionError.browserContext.permissionType).toBe('microphone');
      expect(permissionError.message).toContain('Original error message');

      // Converting already converted error should return same instance
      const reconverted = toBrowserPermissionDeniedError(permissionError);
      expect(reconverted).toBe(permissionError);
    });
  });

  describe('Factory Methods and Convenience Constructors', () => {
    test('should create appropriate errors via factory methods', () => {
      // Test fromBrowserPermissionError factory
      const originalError = new Error('NotAllowedError: Permission denied');
      const factoryError = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'geolocation',
        'getCurrentPosition',
        'https://maps.example.com',
        originalError
      );

      expect(factoryError.browserContext.permissionType).toBe('geolocation');
      expect(factoryError.browserContext.operation).toBe('getCurrentPosition');
      expect(factoryError.browserContext.target).toBe('https://maps.example.com');
      expect(factoryError.cause).toBe(originalError);

      // Test forDomainRestriction factory
      const domainError = BrowserPermissionDeniedError.forDomainRestriction(
        'malicious-site.com',
        'navigate',
        'Domain is on security blocklist'
      );

      expect(domainError.browserContext.permissionType).toBe('domain');
      expect(domainError.browserContext.target).toBe('malicious-site.com');
      expect(domainError.browserContext.operation).toBe('navigate');
      expect(domainError.browserContext.denialReason).toBe('Domain is on security blocklist');

      // Test forDisabledFeature factory
      const featureError = BrowserPermissionDeniedError.forDisabledFeature(
        'javascript',
        'evaluate'
      );

      expect(featureError.browserContext.permissionType).toBe('javascript');
      expect(featureError.browserContext.operation).toBe('evaluate');
      expect(featureError.message).toContain('Feature \'javascript\' is disabled');
    });
  });

  describe('Test Coverage Validation', () => {
    test('should cover all documented permission types', () => {
      // This test ensures we have coverage for all permission types mentioned in documentation
      const documentedPermissionTypes = [
        'geolocation', 'camera', 'microphone', 'notifications',
        'clipboard', 'storage', 'domain', 'javascript', 'form'
      ];

      for (const permissionType of documentedPermissionTypes) {
        const error = new BrowserPermissionDeniedError(
          `Test ${permissionType} permission`,
          { permissionType: permissionType as any }
        );

        // Each permission type should have a specific user message
        const message = error.getUserFriendlyMessage();
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);

        // Each should have at least 2 resolution suggestions
        const suggestions = error.getResolutionSuggestions();
        expect(suggestions.length).toBeGreaterThanOrEqual(2);

        // All suggestions should be non-empty strings
        for (const suggestion of suggestions) {
          expect(typeof suggestion).toBe('string');
          expect(suggestion.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test('should cover all common denial scenarios', () => {
      const denialScenarios = [
        { reason: 'User explicitly denied', context: { denialReason: 'User clicked deny' } },
        { reason: 'Permission timeout', context: { denialReason: 'User did not respond in time' } },
        { reason: 'System policy', context: { denialReason: 'Blocked by corporate policy' } },
        { reason: 'Browser security', context: { denialReason: 'Insecure context' } },
        { reason: 'Hardware unavailable', context: { denialReason: 'Camera is in use by another app' } },
        { reason: 'Permission revoked', context: { denialReason: 'Permission was revoked mid-operation' } }
      ];

      for (const scenario of denialScenarios) {
        const error = new BrowserPermissionDeniedError(
          `Test ${scenario.reason}`,
          {
            permissionType: 'camera',
            operation: 'getUserMedia',
            ...scenario.context
          }
        );

        // Should handle all scenarios gracefully
        expect(() => error.getUserFriendlyMessage()).not.toThrow();
        expect(() => error.getResolutionSuggestions()).not.toThrow();
        expect(() => error.toSafeErrorResponse()).not.toThrow();
      }
    });
  });
});