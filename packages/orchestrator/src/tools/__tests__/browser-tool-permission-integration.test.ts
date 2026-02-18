/**
 * Browser Tool Permission Manager Integration Tests
 *
 * Tests the integration between BrowserTool and PermissionManager including:
 * - Permission level enforcement
 * - Scope-based permission checking
 * - Configuration-based restrictions
 * - Dangerous operation handling
 * - Allow-once permission consumption
 * - Domain-based access control
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BrowserTool, BrowserToolConfig } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { PermissionLevel, ToolPermissionResult } from '@apexcli/core';

// Mock Playwright
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(),
  evaluate: vi.fn(() => Promise.resolve('result')),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot'))),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType,
}));

describe('Browser Tool Permission Manager Integration', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let permissionCheckSpy: Mock;
  let getToolConfigSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock browser responses
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);

    // Create permission manager with spies
    permissionCheckSpy = vi.fn();
    getToolConfigSpy = vi.fn();

    mockPermissionManager = {
      checkToolPermission: permissionCheckSpy,
      getToolConfig: getToolConfigSpy,
    } as any;

    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
    });
  });

  describe('Permission Level Enforcement', () => {
    it('should allow operations with full permission level', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({ enabled: true });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionLevel).toBe('full');
    });

    it('should allow operations with read permission level for safe operations', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'read' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({ enabled: true });

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionLevel).toBe('read');
    });

    it('should deny dangerous operations without explicit permission level', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: null,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });

    it('should allow dangerous operations with explicit permission level', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'console.log("test")' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Scope-Based Permission Checking', () => {
    it('should build correct permission scope for navigation', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({ enabled: true });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://specific-site.com/path' },
      });

      expect(permissionCheckSpy).toHaveBeenCalledWith('Browser', {
        scope: 'navigate:https://specific-site.com/path',
        consumeAllowOnce: true,
      });
    });

    it('should build correct permission scope for click operation', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({ enabled: true });

      await browserTool.execute({
        operation: 'click',
        params: { selector: '#specific-button' },
      });

      expect(permissionCheckSpy).toHaveBeenCalledWith('Browser', {
        scope: 'click:#specific-button',
        consumeAllowOnce: true,
      });
    });

    it('should build correct permission scope for evaluate operation', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true,
      });

      await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.querySelector("#test")' },
      });

      // Script should be hashed for privacy in scope
      expect(permissionCheckSpy).toHaveBeenCalledWith('Browser', {
        scope: expect.stringMatching(/^evaluate:script_[A-Za-z0-9+/=]+$/),
        consumeAllowOnce: true,
      });
    });

    it('should not consume allow-once permissions during pre-check', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });

      await browserTool.checkPermission('navigate', 'https://example.com');

      expect(permissionCheckSpy).toHaveBeenCalledWith('Browser', {
        scope: 'navigate:https://example.com',
        consumeAllowOnce: false,
      });
    });

    it('should consume allow-once permissions during execution', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({ enabled: true });

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(permissionCheckSpy).toHaveBeenCalledWith('Browser', {
        scope: 'navigate:https://example.com',
        consumeAllowOnce: true,
      });
    });
  });

  describe('Configuration-Based Access Control', () => {
    it('should respect domain allowlist configuration', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowedDomains: ['trusted.com', 'internal.company.com'],
      } as BrowserToolConfig);

      // Should allow navigation to allowed domain
      const allowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://trusted.com/page' },
      });
      expect(allowedResult.success).toBe(true);

      // Should block navigation to non-allowed domain
      const blockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://external.com/page' },
      });
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toBe('Domain external.com is not in allowlist');
    });

    it('should respect domain blocklist configuration', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        blockedDomains: ['malicious.com', 'unsafe.site'],
      } as BrowserToolConfig);

      // Should block navigation to blocked domain
      const blockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://malicious.com/page' },
      });
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toBe('Domain malicious.com is blocked');

      // Should allow navigation to non-blocked domain
      const allowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe.com/page' },
      });
      expect(allowedResult.success).toBe(true);
    });

    it('should enforce JavaScript execution restrictions', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'alert("test")' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('JavaScript execution is disabled');
    });

    it('should enforce form submission restrictions', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowFormSubmission: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#form' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Form submission is disabled');
    });

    it('should enforce screenshot restrictions', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowScreenshots: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Screenshots are disabled');
    });

    it('should respect tool disabled configuration', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: false,
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser tool is disabled');
    });
  });

  describe('Dangerous Operation Detection', () => {
    it('should identify JavaScript evaluation as dangerous', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true,
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'window.location.href = "https://malicious.com"' },
      });

      expect(result.success).toBe(true); // Should succeed with proper permission level
    });

    it('should identify form submission as dangerous', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowFormSubmission: true,
      });

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#payment-form' },
      });

      expect(result.success).toBe(true); // Should succeed with proper permission level
    });

    it('should identify navigation to external domains as dangerous when restricted', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: null, // No explicit permission level
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowedDomains: ['trusted.com'],
      } as BrowserToolConfig);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://external.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous operation requires explicit permission');
    });
  });

  describe('Permission Denial Handling', () => {
    it('should handle permission denial with reason', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'User explicitly denied browser access',
      } as ToolPermissionResult);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User explicitly denied browser access');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should handle permission denial without specific reason', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: false,
        level: null,
        requiresConfirmation: false,
      } as ToolPermissionResult);

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation denied by permission policy');
      expect(result.metadata?.permissionGranted).toBe(false);
    });
  });

  describe('No Permission Manager Scenario', () => {
    it('should allow all operations when no permission manager is set', async () => {
      const tool = new BrowserTool(); // No permission manager

      // Mock basic browser setup
      mockBrowser.newContext.mockResolvedValue(mockContext);
      mockContext.newPage.mockResolvedValue(mockPage);

      const result = await tool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should return permissive result for permission checks without manager', async () => {
      const tool = new BrowserTool(); // No permission manager

      const result = await tool.checkPermission('evaluate', 'script_hash');

      expect(result).toEqual({
        allowed: true,
        level: null,
        requiresConfirmation: false,
      });
    });
  });

  describe('Permission Manager Error Handling', () => {
    it('should handle permission check errors gracefully', async () => {
      permissionCheckSpy.mockRejectedValue(new Error('Permission system unavailable'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission system unavailable');
    });

    it('should handle configuration retrieval errors gracefully', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockRejectedValue(new Error('Config unavailable'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Config unavailable');
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle multiple permission checks for composite operations', async () => {
      permissionCheckSpy.mockResolvedValue({
        allowed: true,
        level: 'full' as PermissionLevel,
        requiresConfirmation: false,
      });
      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true,
      });

      // Execute multiple operations in sequence
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });

      await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      });

      await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.readyState' },
      });

      // Each operation should have triggered a permission check
      expect(permissionCheckSpy).toHaveBeenCalledTimes(3);

      // Verify different scopes were checked
      expect(permissionCheckSpy).toHaveBeenNthCalledWith(1, 'Browser', {
        scope: 'navigate:https://example.com',
        consumeAllowOnce: true,
      });
      expect(permissionCheckSpy).toHaveBeenNthCalledWith(2, 'Browser', {
        scope: 'click:#button',
        consumeAllowOnce: true,
      });
      expect(permissionCheckSpy).toHaveBeenNthCalledWith(3, 'Browser', {
        scope: expect.stringMatching(/^evaluate:script_/),
        consumeAllowOnce: true,
      });
    });

    it('should handle mixed permission levels for different operations', async () => {
      // Different permission levels for different operations
      permissionCheckSpy
        .mockResolvedValueOnce({
          allowed: true,
          level: 'full' as PermissionLevel,
          requiresConfirmation: false,
        })
        .mockResolvedValueOnce({
          allowed: true,
          level: 'read' as PermissionLevel,
          requiresConfirmation: false,
        });

      getToolConfigSpy.mockResolvedValue({
        enabled: true,
        allowJavaScriptExecution: true,
        allowScreenshots: true,
      });

      // First operation with full permission
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      });
      expect(navResult.success).toBe(true);
      expect(navResult.metadata?.permissionLevel).toBe('full');

      // Second operation with read permission
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true },
      });
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.metadata?.permissionLevel).toBe('read');
    });
  });
});