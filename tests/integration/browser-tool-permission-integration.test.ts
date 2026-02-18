/**
 * Browser Tool + Permission System Integration Tests
 *
 * This test suite focuses specifically on the integration between:
 * - Browser Tool execution pipeline
 * - Permission management system
 * - Tool registration and validation
 *
 * Tests ensure browser automation respects permission settings,
 * handles different permission levels correctly, and integrates
 * properly with the broader tool ecosystem.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Core types
import type {
  BrowserSession,
  BrowserSessionConfig,
  PermissionLevel,
  ToolPermissionResult,
  BrowserToolConfig
} from '@apexcli/core';

// Components under test
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Test utilities
import { MockBrowserSession } from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

// Mock playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(mockPage)),
        on: vi.fn(),
        close: vi.fn()
      })),
      close: vi.fn()
    }))
  }
}));

// Mock page object with comprehensive browser operations
const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  selectOption: vi.fn(() => Promise.resolve()),
  check: vi.fn(() => Promise.resolve()),
  uncheck: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  evaluate: vi.fn(() => Promise.resolve('mock-evaluation-result')),
  waitForSelector: vi.fn(() => Promise.resolve()),
  waitForNavigation: vi.fn(() => Promise.resolve()),
  textContent: vi.fn(() => Promise.resolve('Mock text content')),
  getAttribute: vi.fn(() => Promise.resolve('mock-attribute')),
  on: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  setViewportSize: vi.fn(() => Promise.resolve())
};

describe('Browser Tool + Permission System Integration', () => {
  let testDir: string;
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let eventEmitter: EventEmitter;
  let mockSession: MockBrowserSession;
  let permissionEvents: any[];

  beforeEach(async () => {
    // Setup test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-permission-test-'));

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
    permissionEvents = [];

    // Setup permission event tracking
    eventEmitter.on('permission:requested', (event) => {
      permissionEvents.push({ type: 'requested', ...event });
    });
    eventEmitter.on('permission:granted', (event) => {
      permissionEvents.push({ type: 'granted', ...event });
    });
    eventEmitter.on('permission:denied', (event) => {
      permissionEvents.push({ type: 'denied', ...event });
    });

    // Create browser tool with permission integration
    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright',
      engine: 'chromium',
      headless: true
    });

    // Create mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local', 'safe.org'],
      blockedDomains: ['malicious.com', 'dangerous.site']
    });

    // Mock browser tool session creation
    vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await mockSession?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Permission-Controlled Browser Operations', () => {
    describe('Navigation Operations', () => {
      it('should require navigation permission for page navigation', async () => {
        // Initially deny browser permissions
        await permissionManager.grantPermission('Browser', undefined, 'deny');

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied/i);

        // Verify permission was requested but denied
        const requestedEvents = permissionEvents.filter(e => e.type === 'requested');
        const deniedEvents = permissionEvents.filter(e => e.type === 'denied');

        expect(requestedEvents.length).toBeGreaterThan(0);
        expect(deniedEvents.length).toBeGreaterThan(0);
        expect(requestedEvents[0].tool).toBe('Browser');
      });

      it('should allow navigation with proper permissions', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

        mockPage.goto.mockResolvedValue({ status: () => 200 });
        mockPage.url.mockReturnValue('https://example.com');

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        expect(result.success).toBe(true);
        expect(result.data.url).toBe('https://example.com');

        // Verify permission was granted
        const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
        expect(grantedEvents.length).toBeGreaterThan(0);
        expect(grantedEvents[0].tool).toBe('Browser');
      });

      it('should handle domain-specific navigation permissions', async () => {
        // Grant permission only for specific domain
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:example.com');

        // Navigation to allowed domain should succeed
        mockPage.goto.mockResolvedValue({ status: () => 200 });
        const allowedResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/page' }
        });

        expect(allowedResult.success).toBe(true);

        // Navigation to different domain should fail
        const blockedResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://other.com/page' }
        });

        expect(blockedResult.success).toBe(false);
        expect(blockedResult.error).toMatch(/permission.*denied|domain.*not.*allowed/i);
      });

      it('should respect one-time navigation permissions', async () => {
        await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

        mockPage.goto.mockResolvedValue({ status: () => 200 });

        // First navigation should succeed
        const firstResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/page1' }
        });
        expect(firstResult.success).toBe(true);

        // Second navigation should fail (permission consumed)
        const secondResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/page2' }
        });
        expect(secondResult.success).toBe(false);
        expect(secondResult.error).toMatch(/permission.*denied|consumed/i);
      });
    });

    describe('Interaction Operations', () => {
      it('should require interaction permissions for click operations', async () => {
        // Grant navigation but not interaction permissions
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
        await permissionManager.grantPermission('Browser', 'click', 'deny');

        // Navigate first
        mockPage.goto.mockResolvedValue({ status: () => 200 });
        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        // Click should be denied
        const clickResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#button' }
        });

        expect(clickResult.success).toBe(false);
        expect(clickResult.error).toMatch(/permission.*denied/i);

        // Verify click permission was requested specifically
        const clickRequestEvents = permissionEvents.filter(e =>
          e.type === 'requested' && e.scope?.includes('click')
        );
        expect(clickRequestEvents.length).toBeGreaterThan(0);
      });

      it('should allow click operations with proper permissions', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'click');

        mockPage.click.mockResolvedValue();

        const result = await browserTool.execute({
          operation: 'click',
          params: { selector: '#submit-button' }
        });

        expect(result.success).toBe(true);
        expect(mockPage.click).toHaveBeenCalledWith('#submit-button');

        // Verify permission was granted
        const grantedEvents = permissionEvents.filter(e =>
          e.type === 'granted' && e.scope?.includes('click')
        );
        expect(grantedEvents.length).toBeGreaterThan(0);
      });

      it('should handle form interaction permissions separately', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'type');
        await permissionManager.grantPermission('Browser', 'submit', 'deny');

        // Typing should be allowed
        mockPage.type.mockResolvedValue();
        const typeResult = await browserTool.execute({
          operation: 'type',
          params: { selector: '#input', text: 'test data' }
        });
        expect(typeResult.success).toBe(true);

        // Form submission should be denied
        const submitResult = await browserTool.execute({
          operation: 'submit',
          params: { selector: '#form' }
        });
        expect(submitResult.success).toBe(false);
        expect(submitResult.error).toMatch(/permission.*denied/i);
      });

      it('should validate element selectors in permission scope', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'click:#safe-button');
        await permissionManager.grantPermission('Browser', 'click:#dangerous-button', 'deny');

        // Click on safe button should succeed
        mockPage.click.mockResolvedValue();
        const safeResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#safe-button' }
        });
        expect(safeResult.success).toBe(true);

        // Click on dangerous button should fail
        const dangerousResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#dangerous-button' }
        });
        expect(dangerousResult.success).toBe(false);
      });
    });

    describe('Data Extraction Operations', () => {
      it('should control text extraction permissions', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
        await permissionManager.grantPermission('Browser', 'allow-once', 'getText');

        // Navigate first
        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        // First text extraction should succeed
        mockPage.textContent.mockResolvedValue('Sample text content');
        const firstResult = await browserTool.execute({
          operation: 'getText',
          params: { selector: 'h1' }
        });
        expect(firstResult.success).toBe(true);
        expect(firstResult.data.text).toBe('Sample text content');

        // Second text extraction should fail (allow-once consumed)
        const secondResult = await browserTool.execute({
          operation: 'getText',
          params: { selector: 'p' }
        });
        expect(secondResult.success).toBe(false);
        expect(secondResult.error).toMatch(/permission.*denied|consumed/i);
      });

      it('should require elevated permissions for attribute extraction', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
        await permissionManager.grantPermission('Browser', 'getAttribute', 'deny');

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        const result = await browserTool.execute({
          operation: 'getAttribute',
          params: { selector: '#form', attribute: 'action' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied/i);

        // Verify elevated permission was requested
        const elevatedRequestEvents = permissionEvents.filter(e =>
          e.type === 'requested' && e.scope?.includes('getAttribute')
        );
        expect(elevatedRequestEvents.length).toBeGreaterThan(0);
      });
    });

    describe('Screenshot and Evaluation Operations', () => {
      it('should require screenshot permissions', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
        await permissionManager.grantPermission('Browser', 'screenshot', 'deny');

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        const screenshotResult = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        });

        expect(screenshotResult.success).toBe(false);
        expect(screenshotResult.error).toMatch(/permission.*denied/i);

        const screenshotRequestEvents = permissionEvents.filter(e =>
          e.type === 'requested' && e.scope?.includes('screenshot')
        );
        expect(screenshotRequestEvents.length).toBeGreaterThan(0);
      });

      it('should require elevated permissions for JavaScript evaluation', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
        await permissionManager.grantPermission('Browser', 'evaluate', 'deny');

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com' }
        });

        const evalResult = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'document.title' }
        });

        expect(evalResult.success).toBe(false);
        expect(evalResult.error).toMatch(/permission.*denied|elevated.*permission/i);

        const evalRequestEvents = permissionEvents.filter(e =>
          e.type === 'requested' && e.scope?.includes('evaluate')
        );
        expect(evalRequestEvents.length).toBeGreaterThan(0);
      });

      it('should allow JavaScript evaluation with explicit dangerous permission', async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

        mockPage.evaluate.mockResolvedValue('Document Title');

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'return document.title' }
        });

        expect(result.success).toBe(true);
        expect(result.data.result).toBe('Document Title');

        const grantedEvents = permissionEvents.filter(e =>
          e.type === 'granted' && e.scope?.includes('evaluate')
        );
        expect(grantedEvents.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Permission Scope and Inheritance', () => {
    it('should handle hierarchical permission scopes', async () => {
      // Grant general browser permission
      await permissionManager.grantPermission('Browser', 'allow-always');

      // All operations should inherit from general permission
      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'screenshot', params: { fullPage: true } }
      ];

      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.click.mockResolvedValue();
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

      for (const op of operations) {
        const result = await browserTool.execute(op);
        // All operations should succeed through permission inheritance
        expect(result.success).toBe(true);
      }

      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThan(0);
    });

    it('should respect specific permission denials over general permissions', async () => {
      // Grant general browser permission but deny specific operation
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Browser', 'evaluate', 'deny');

      // General operations should succeed
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(navResult.success).toBe(true);

      // Specifically denied operation should fail
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'window.location.href' }
      });
      expect(evalResult.success).toBe(false);
      expect(evalResult.error).toMatch(/permission.*denied/i);
    });

    it('should handle URL-scoped permissions correctly', async () => {
      // Grant permission only for specific URL
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:https://example.com/*');

      // Navigation to allowed URL should succeed
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const allowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page1' }
      });
      expect(allowedResult.success).toBe(true);

      // Navigation to different domain should fail
      const deniedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://other.com/page' }
      });
      expect(deniedResult.success).toBe(false);

      const scopedGrantEvents = permissionEvents.filter(e =>
        e.type === 'granted' && e.scope?.includes('example.com')
      );
      expect(scopedGrantEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle permission system failures gracefully', async () => {
      // Mock permission system failure
      vi.spyOn(permissionManager, 'checkToolPermission').mockRejectedValue(
        new Error('Permission database connection lost')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*database|connection.*lost/i);

      // Verify no browser operations were attempted
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    it('should not execute operations when permissions are denied', async () => {
      await permissionManager.grantPermission('Browser', undefined, 'deny');

      const navigationSpy = vi.spyOn(mockPage, 'goto');
      const clickSpy = vi.spyOn(mockPage, 'click');

      // Attempt various operations
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      // Verify no actual browser operations were executed
      expect(navigationSpy).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('should provide detailed error messages for permission failures', async () => {
      await permissionManager.grantPermission('Browser', 'dangerous-operation', 'deny');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'dangerous.code()' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/permission.*denied|dangerous.*operation/i);

      // Error should be user-friendly and informative
      expect(result.error).not.toMatch(/undefined|null|internal.*error/i);
    });

    it('should handle browser operation failures with permission context', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock browser operation failure
      mockPage.goto.mockRejectedValue(new Error('Page load timeout'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://slow-site.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/page.*load.*timeout/i);

      // Permission should have been granted but operation failed
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThan(0);
    });

    it('should handle session cleanup on permission changes', async () => {
      // Start with permission and create session
      await permissionManager.grantPermission('Browser', 'allow-once');

      mockPage.goto.mockResolvedValue({ status: () => 200 });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Permission should be consumed, but session should remain active
      const sessionCloseSpy = vi.spyOn(mockSession, 'close');

      const nextResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      expect(nextResult.success).toBe(false);
      // Session cleanup is typically handled at higher level, not immediately
      expect(sessionCloseSpy).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Integration', () => {
    it('should respect tool configuration settings', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Set tool configuration with restrictions
      const toolConfig: BrowserToolConfig = {
        enabled: true,
        allowedDomains: ['safe-site.com'],
        blockedDomains: ['blocked-site.com'],
        allowJavaScriptExecution: false,
        allowFormSubmission: false,
        allowScreenshots: true
      };

      await permissionManager.setToolConfig('Browser', toolConfig);

      // Blocked domain should fail even with permissions
      const blockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked-site.com' }
      });
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toMatch(/domain.*blocked|not.*allowed/i);

      // JavaScript execution should be blocked by config
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return true' }
      });
      expect(evalResult.success).toBe(false);
      expect(evalResult.error).toMatch(/javascript.*disabled|not.*allowed/i);

      // Screenshots should be allowed by config
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://safe-site.com' }
      });

      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(true);
    });

    it('should handle configuration overrides properly', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Initial restrictive config
      await permissionManager.setToolConfig('Browser', {
        enabled: true,
        allowJavaScriptExecution: false
      });

      // JavaScript should be blocked
      const blockedResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return "blocked"' }
      });
      expect(blockedResult.success).toBe(false);

      // Override config to allow JavaScript
      await permissionManager.setToolConfig('Browser', {
        enabled: true,
        allowJavaScriptExecution: true
      });

      // JavaScript should now be allowed
      mockPage.evaluate.mockResolvedValue('allowed');
      const allowedResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return "allowed"' }
      });
      expect(allowedResult.success).toBe(true);
      expect(allowedResult.data.result).toBe('allowed');
    });

    it('should disable tool when configuration specifies enabled: false', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Disable browser tool via configuration
      await permissionManager.setToolConfig('Browser', {
        enabled: false
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/tool.*disabled|not.*enabled/i);

      // No browser operations should be attempted
      expect(mockPage.goto).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Operation Handling', () => {
    it('should handle concurrent permission checks correctly', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Start multiple operations concurrently
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.click.mockResolvedValue();
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));

      const operations = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com/1' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com/2' } }),
        browserTool.execute({ operation: 'click', params: { selector: '#btn1' } }),
        browserTool.execute({ operation: 'screenshot', params: { fullPage: true } })
      ];

      const results = await Promise.all(operations);

      // All operations should succeed with proper permission handling
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });

      // Verify permissions were checked for each operation
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBeGreaterThanOrEqual(operations.length);
    });

    it('should handle mixed permission levels in concurrent operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');

      // Concurrent operations with different permission levels
      const operations = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com/1' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://example.com/2' } }),
        browserTool.execute({ operation: 'click', params: { selector: '#btn1' } }),
        browserTool.execute({ operation: 'click', params: { selector: '#btn2' } })
      ];

      const results = await Promise.allSettled(operations);

      // Only one navigation should succeed (allow-once)
      const navResults = results.slice(0, 2);
      const successfulNavs = navResults.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      );
      expect(successfulNavs).toHaveLength(1);

      // Both clicks should succeed (allow-always)
      const clickResults = results.slice(2, 4);
      clickResults.forEach(r => {
        expect(r.status).toBe('fulfilled');
        expect((r as any).value.success).toBe(true);
      });
    });
  });
});