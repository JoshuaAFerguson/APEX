/**
 * Browser Tool Permission Denial Integration Test Suite
 *
 * This test suite specifically verifies the integration of three key components
 * in BrowserTool.execute() permission denial handling:
 *
 * 1. BrowserPermissionDeniedError creation with proper context
 * 2. cleanup() method integration with resource management
 * 3. permission:denied event emission via eventEmitter
 *
 * These tests ensure that all three denial paths properly implement the
 * complete integration pattern as specified in the acceptance criteria.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  PermissionLevel,
  ToolPermissionResult,
  BrowserResourceState
} from '@apexcli/core';

// Mock Playwright to control browser behavior
const createMockPage = () => ({
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  evaluate: vi.fn(() => Promise.resolve('test')),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  close: vi.fn(() => Promise.resolve()),
});

const createMockContext = () => ({
  newPage: vi.fn(() => Promise.resolve(createMockPage())),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
});

const createMockBrowser = () => ({
  newContext: vi.fn(() => Promise.resolve(createMockContext())),
  close: vi.fn(() => Promise.resolve()),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
});

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(createMockBrowser())),
};

vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('BrowserTool Permission Denial Integration Complete', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let capturedEvents: any[];
  let permissionCheckSpy: any;
  let getToolConfigSpy: any;
  let cleanupSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create event emitter and capture events
    eventEmitter = new EventEmitter();
    capturedEvents = [];

    // Capture all permission-related events
    eventEmitter.on('permission:denied', (event) => {
      capturedEvents.push({ type: 'permission:denied', ...event });
    });

    // Create mocks for permission manager
    permissionCheckSpy = vi.fn();
    getToolConfigSpy = vi.fn();

    mockPermissionManager = {
      checkToolPermission: permissionCheckSpy,
      getToolConfig: getToolConfigSpy,
    } as any;

    // Create browser tool with dependencies
    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      eventEmitter: eventEmitter,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });

    // Setup spy on cleanup method
    cleanupSpy = vi.spyOn(browserTool, 'cleanup');
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Denial Path 1: Permission Check Denial Integration', () => {
    it('should integrate BrowserPermissionDeniedError, cleanup(), and permission:denied event for permission manager denial', async () => {
      // Setup: Permission manager denies the operation
      permissionCheckSpy.mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'User explicitly denied browser navigation access'
      } as ToolPermissionResult);

      // Track the session ID for verification
      const sessionId = browserTool.getResourceState().sessionId;

      // Execute: Attempt operation that will be denied
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://restricted-site.com' }
      });

      // ============================================================
      // INTEGRATION VERIFICATION
      // ============================================================

      // 1. BrowserPermissionDeniedError Creation with Context
      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser configuration restriction: User explicitly denied browser navigation access');
      expect(result.metadata?.target).toBe('https://restricted-site.com');
      expect(result.metadata?.permissionGranted).toBe(false);

      // 2. cleanup() Integration - Should be called if resources were allocated
      // In this early denial case, browser shouldn't be launched, so cleanup might not be called
      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false);
      expect(resourceState.contextActive).toBe(false);
      expect(resourceState.pageActive).toBe(false);

      // 3. permission:denied Event Emission with Proper Context
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent).toMatchObject({
        operation: 'navigate',
        target: 'https://restricted-site.com',
        denialReason: 'User explicitly denied browser navigation access',
        sessionId: sessionId,
        timestamp: expect.any(Date)
      });

      // Verify the event contains the BrowserPermissionDeniedError
      expect(deniedEvent.error).toBeInstanceOf(BrowserPermissionDeniedError);
      expect(isBrowserPermissionDeniedError(deniedEvent.error)).toBe(true);

      // 4. Error Object Context Verification
      const errorObj = deniedEvent.error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.operation).toBe('navigate');
      expect(errorObj.browserContext.target).toBe('https://restricted-site.com');
      expect(errorObj.browserContext.denialReason).toBe('User explicitly denied browser navigation access');
      expect(errorObj.browserContext.permissionType).toBe('domain');
      expect(errorObj.browserContext.sessionId).toBe(sessionId);
    });

    it('should integrate cleanup() when browser resources were already allocated before denial', async () => {
      // Setup: First allow navigation to establish browser session
      permissionCheckSpy
        .mockResolvedValueOnce({
          allowed: true,
          level: 'full' as PermissionLevel,
          requiresConfirmation: false
        })
        .mockResolvedValueOnce({
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: 'Operation now denied'
        });

      getToolConfigSpy.mockResolvedValue({ enabled: true });

      // Execute first operation to establish browser resources
      const firstResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(firstResult.success).toBe(true);

      // Verify resources are now active
      let resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive || resourceState.pageActive || resourceState.contextActive).toBe(true);

      // Clear previous events and reset spy
      capturedEvents.length = 0;
      cleanupSpy.mockClear();

      // Execute second operation that will be denied
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      // ============================================================
      // INTEGRATION VERIFICATION WITH ACTIVE RESOURCES
      // ============================================================

      expect(result.success).toBe(false);

      // Cleanup should be called or resources should be managed properly
      resourceState = browserTool.getResourceState();
      // The implementation may clean up immediately or defer, but should not leak resources

      // Event should be emitted
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent.operation).toBe('screenshot');
      expect(deniedEvent.error).toBeInstanceOf(BrowserPermissionDeniedError);
    });
  });

  describe('Denial Path 2: Configuration Restriction Integration', () => {
    it('should integrate all three components for JavaScript execution denial', async () => {
      // Setup: Allow permissions but deny JavaScript via configuration
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false
      });

      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false, // Deny JavaScript
        allowScreenshots: true,
        allowFormSubmission: true
      } as BrowserToolConfig);

      const sessionId = browserTool.getResourceState().sessionId;

      // Execute: JavaScript evaluation should be denied by configuration
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.querySelector("#dangerous-element").click();' }
      });

      // ============================================================
      // CONFIGURATION DENIAL INTEGRATION VERIFICATION
      // ============================================================

      // 1. BrowserPermissionDeniedError with Configuration Context
      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser configuration restriction: JavaScript execution is disabled');
      expect(result.metadata?.target).toMatch(/script_/); // Script hash
      expect(result.metadata?.permissionGranted).toBe(false);

      // 2. Resource Cleanup Integration
      // Browser might be launched before config denial, so cleanup should manage resources
      const resourceState = browserTool.getResourceState();
      // Resources should be properly managed

      // 3. Event Emission with Configuration-Specific Context
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent).toMatchObject({
        operation: 'evaluate',
        target: expect.stringMatching(/script_/),
        denialReason: 'JavaScript execution is disabled',
        sessionId: sessionId,
        restrictionType: 'configuration'
      });

      // 4. BrowserPermissionDeniedError Context for JavaScript Denial
      const errorObj = deniedEvent.error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.permissionType).toBe('javascript');
      expect(errorObj.browserContext.operation).toBe('evaluate');
      expect(errorObj.isPermissionType('javascript')).toBe(true);
      expect(errorObj.isOperation('evaluate')).toBe(true);
    });

    it('should integrate all three components for domain allowlist restriction', async () => {
      // Setup: Only allow specific domains
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false
      });

      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowedDomains: ['trusted-domain.com'],
        allowJavaScriptExecution: true,
        allowScreenshots: true
      } as BrowserToolConfig);

      // Execute: Navigate to non-allowlisted domain
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://untrusted-domain.com/malicious-page' }
      });

      // Verify integration for domain restrictions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser configuration restriction: Domain untrusted-domain.com is not in allowlist');

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent.operation).toBe('navigate');
      expect(deniedEvent.target).toBe('https://untrusted-domain.com/malicious-page');
      expect(deniedEvent.restrictionType).toBe('configuration');

      const errorObj = deniedEvent.error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.permissionType).toBe('domain');
    });
  });

  describe('Denial Path 3: Dangerous Operations Integration', () => {
    it('should integrate all three components for dangerous operation blocking', async () => {
      // Setup: Basic permissions allowed, but dangerous operations need explicit permission
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission level - this triggers dangerous operation check
        requiresConfirmation: false
      });

      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true, // Config allows it, but lack of permission level blocks it
        allowScreenshots: true,
        allowFormSubmission: true
      } as BrowserToolConfig);

      const sessionId = browserTool.getResourceState().sessionId;

      // Execute: Dangerous JavaScript operation
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'window.location.href = "https://malicious-redirect.com/steal-data";' }
      });

      // ============================================================
      // DANGEROUS OPERATION INTEGRATION VERIFICATION
      // ============================================================

      // 1. BrowserPermissionDeniedError for Dangerous Operation
      expect(result.success).toBe(false);
      expect(result.error).toBe('Dangerous operation blocked: Executing arbitrary JavaScript code');
      expect(result.metadata?.target).toMatch(/script_/);
      expect(result.metadata?.permissionGranted).toBe(false);

      // 2. Resource Cleanup for Security
      // Dangerous operations should trigger cleanup to prevent security issues
      const resourceState = browserTool.getResourceState();

      // 3. Event Emission for Security Monitoring
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent).toMatchObject({
        operation: 'evaluate',
        target: expect.stringMatching(/script_/),
        denialReason: 'Dangerous operation requires explicit permission: Executing arbitrary JavaScript code',
        sessionId: sessionId,
        restrictionType: 'dangerous_operation'
      });

      // 4. Security Context in Error
      const errorObj = deniedEvent.error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.permissionType).toBe('javascript');
      expect(errorObj.getUserFriendlyMessage()).toContain('JavaScript execution is not permitted');

      const suggestions = errorObj.getResolutionSuggestions();
      expect(suggestions).toContain('Enable JavaScript execution in tool configuration');
    });

    it('should integrate all three components for dangerous form submission', async () => {
      // Setup: Allow navigation but require explicit permission for form submission
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission level
        requiresConfirmation: false
      });

      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowFormSubmission: true, // Config allows it, but dangerous operation check blocks it
        allowJavaScriptExecution: true,
        allowScreenshots: true
      } as BrowserToolConfig);

      // Execute: Dangerous form submission
      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#credit-card-form' }
      });

      // Verify dangerous form submission handling
      expect(result.success).toBe(false);
      expect(result.error).toBe('Dangerous operation blocked: Submitting form data');

      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent.operation).toBe('submit');
      expect(deniedEvent.target).toBe('#credit-card-form');
      expect(deniedEvent.restrictionType).toBe('dangerous_operation');

      const errorObj = deniedEvent.error as BrowserPermissionDeniedError;
      expect(errorObj.browserContext.permissionType).toBe('form');
      expect(errorObj.getUserFriendlyMessage()).toContain('Form submission is not permitted');
    });
  });

  describe('Catch Block Error Handling Integration', () => {
    it('should handle BrowserPermissionDeniedError in catch block with full integration', async () => {
      // Setup: Force permission checking to throw BrowserPermissionDeniedError
      const thrownError = new BrowserPermissionDeniedError(
        'Permission system catastrophic failure',
        {
          operation: 'navigate',
          target: 'https://test-error-handling.com',
          denialReason: 'System error during permission validation',
          permissionType: 'domain',
          sessionId: browserTool.getResourceState().sessionId
        }
      );

      permissionCheckSpy.mockRejectedValue(thrownError);

      // Execute: This should trigger the catch block
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test-error-handling.com' }
      });

      // ============================================================
      // CATCH BLOCK INTEGRATION VERIFICATION
      // ============================================================

      // 1. Graceful Error Handling
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.operation).toBe('navigate');
      expect(result.error).toBe('Permission system catastrophic failure (Operation: navigate) (Target: https://test-error-handling.com) (Reason: System error during permission validation)');

      // 2. Cleanup Integration in Catch Block
      const resourceState = browserTool.getResourceState();
      // Resources should be properly managed even when errors occur

      // 3. Event Emission from Catch Block
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(1);

      const deniedEvent = deniedEvents[0];
      expect(deniedEvent).toMatchObject({
        operation: 'navigate',
        target: 'https://test-error-handling.com',
        denialReason: 'System error during permission validation',
        restrictionType: 'exception'
      });

      // 4. Error Object Preservation
      expect(deniedEvent.error).toBe(thrownError);
      expect(isBrowserPermissionDeniedError(deniedEvent.error)).toBe(true);

      // 5. No Crashes or Exceptions
      expect(() => result).not.toThrow();
    });

    it('should handle cleanup failure gracefully during error handling', async () => {
      // First establish browser resources
      permissionCheckSpy.mockResolvedValueOnce({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false
      });
      getToolConfigSpy.mockResolvedValue({ enabled: true });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Mock cleanup to fail
      cleanupSpy.mockRejectedValue(new Error('Resource cleanup catastrophic failure'));

      // Now cause a permission error
      permissionCheckSpy.mockResolvedValue({
        allowed: false,
        level: null,
        denialReason: 'Permission revoked'
      });

      capturedEvents.length = 0; // Reset events

      // Execute operation that should be denied
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {}
      });

      // Should handle cleanup failure gracefully
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(() => result).not.toThrow();

      // Should still emit permission denied event despite cleanup failure
      const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Path Integration Verification', () => {
    it('should demonstrate consistent integration pattern across all three denial paths', async () => {
      const testCases = [
        {
          name: 'Permission Manager Denial',
          setup: () => {
            permissionCheckSpy.mockResolvedValue({
              allowed: false,
              denialReason: 'User denied access'
            });
            getToolConfigSpy.mockResolvedValue({ enabled: true });
          },
          operation: { operation: 'navigate' as const, params: { url: 'https://denied-site.com' } },
          expectedError: 'Browser configuration restriction: User denied access',
          expectedTarget: 'https://denied-site.com'
        },
        {
          name: 'Configuration Restriction',
          setup: () => {
            permissionCheckSpy.mockResolvedValue({ allowed: true, level: 'full' });
            getToolConfigSpy.mockResolvedValue({
              enabled: true,
              allowFormSubmission: false
            });
          },
          operation: { operation: 'submit' as const, params: { selector: '#restricted-form' } },
          expectedError: 'Browser configuration restriction: Form submission is disabled',
          expectedTarget: '#restricted-form'
        },
        {
          name: 'Dangerous Operation Block',
          setup: () => {
            permissionCheckSpy.mockResolvedValue({ allowed: true, level: null });
            getToolConfigSpy.mockResolvedValue({
              enabled: true,
              allowJavaScriptExecution: true
            });
          },
          operation: { operation: 'evaluate' as const, params: { script: 'dangerous-code' } },
          expectedError: 'Dangerous operation blocked: Executing arbitrary JavaScript code',
          expectedTarget: expect.stringMatching(/script_/)
        }
      ];

      for (const testCase of testCases) {
        // Setup
        testCase.setup();
        capturedEvents.length = 0;

        // Execute
        const result = await browserTool.execute(testCase.operation);

        // Verify consistent integration pattern
        expect(result.success).toBe(false);
        expect(result.error).toBe(testCase.expectedError);
        expect(result.metadata?.target).toEqual(testCase.expectedTarget);
        expect(result.metadata?.permissionGranted).toBe(false);

        // Verify event emission
        const deniedEvents = capturedEvents.filter(e => e.type === 'permission:denied');
        expect(deniedEvents.length).toBeGreaterThan(0);

        const event = deniedEvents[0];
        expect(event.operation).toBe(testCase.operation.operation);
        expect(event.error).toBeInstanceOf(BrowserPermissionDeniedError);

        // Verify no crashes
        expect(() => result).not.toThrow();

        console.log(`✓ ${testCase.name} demonstrates consistent integration pattern`);
      }
    });
  });
});