/**
 * Browser MCP Integration Tests
 *
 * This test suite specifically validates the integration between:
 * - BrowserTool (Playwright/Puppeteer integration)
 * - mcp__browser-tools__Browser (MCP browser tools)
 * - Permission system enforcement for both
 *
 * Focuses on ensuring both browser automation systems work together
 * and respect the same permission policies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock MCP browser tools function
const mockMcpBrowserExecute = vi.fn();

// Mock Playwright
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

const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot'))),
  evaluate: vi.fn(() => Promise.resolve('result')),
  on: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
};

// Mock MCP browser tools wrapper
class MockMcpBrowserTool {
  constructor(private permissionManager: PermissionManager, private eventEmitter?: EventEmitter) {}

  async execute(params: { operation: string; params: any }) {
    // Check permissions through permission manager
    const permissionResult = await this.permissionManager.checkToolPermission('mcp__browser-tools__Browser', {
      scope: params.operation,
      context: params.params
    });

    if (!permissionResult.allowed) {
      this.eventEmitter?.emit('permission:denied', {
        tool: 'mcp__browser-tools__Browser',
        operation: params.operation,
        reason: permissionResult.denialReason
      });

      return {
        success: false,
        error: `MCP Permission denied: ${permissionResult.denialReason}`
      };
    }

    this.eventEmitter?.emit('permission:granted', {
      tool: 'mcp__browser-tools__Browser',
      operation: params.operation
    });

    // Delegate to mock
    return mockMcpBrowserExecute(params);
  }
}

describe('Browser MCP Integration Tests', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let browserTool: BrowserTool;
  let mcpBrowserTool: MockMcpBrowserTool;
  let systemEvents: any[];

  beforeEach(async () => {
    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();
    systemEvents = [];

    // Track events
    eventEmitter.on('permission:granted', (data) => systemEvents.push({ type: 'granted', data }));
    eventEmitter.on('permission:denied', (data) => systemEvents.push({ type: 'denied', data }));

    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright'
    });

    mcpBrowserTool = new MockMcpBrowserTool(permissionManager, eventEmitter);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await browserTool.cleanup();
  });

  describe('Unified Permission Enforcement', () => {
    it('should apply same permissions to both browser systems', async () => {
      // Grant permission to both browser tools
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always');

      // Setup mocks
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockMcpBrowserExecute.mockResolvedValue({
        success: true,
        data: { url: 'https://example.com', status: 200 }
      });

      // Execute same operation through both systems
      const nativeResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const mcpResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Both should succeed
      expect(nativeResult.success).toBe(true);
      expect(mcpResult.success).toBe(true);

      // Both should have generated permission events
      const grantedEvents = systemEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(2);
      expect(grantedEvents.some(e => e.data.tool === 'Browser')).toBe(true);
      expect(grantedEvents.some(e => e.data.tool === 'mcp__browser-tools__Browser')).toBe(true);
    });

    it('should deny operations consistently across both systems', async () => {
      // Deny permissions for both
      await permissionManager.denyPermission('Browser');
      await permissionManager.denyPermission('mcp__browser-tools__Browser');

      const nativeResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const mcpResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Both should fail
      expect(nativeResult.success).toBe(false);
      expect(nativeResult.error).toMatch(/permission.*denied/i);

      expect(mcpResult.success).toBe(false);
      expect(mcpResult.error).toMatch(/permission.*denied/i);

      // Both should have generated denial events
      const deniedEvents = systemEvents.filter(e => e.type === 'denied');
      expect(deniedEvents.length).toBe(2);
    });

    it('should handle different permission levels for each system', async () => {
      // Give different permission levels
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-once');

      // Setup mocks
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockMcpBrowserExecute.mockResolvedValue({ success: true, data: {} });

      // Native browser should work multiple times
      const nativeResult1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page1' }
      });

      const nativeResult2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' }
      });

      expect(nativeResult1.success).toBe(true);
      expect(nativeResult2.success).toBe(true);

      // MCP browser should work once then fail
      const mcpResult1 = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page1' }
      });

      const mcpResult2 = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' }
      });

      expect(mcpResult1.success).toBe(true);
      expect(mcpResult2.success).toBe(false); // Permission consumed
    });
  });

  describe('Operation-Specific Permissions', () => {
    it('should enforce operation-specific permissions across systems', async () => {
      // Allow navigation but deny screenshots for both
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.denyPermission('Browser', 'screenshot');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always', 'navigate');
      await permissionManager.denyPermission('mcp__browser-tools__Browser', 'screenshot');

      // Setup mocks
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
      mockMcpBrowserExecute.mockImplementation(async ({ operation }) => {
        return { success: true, data: { operation } };
      });

      // Navigation should succeed for both
      const nativeNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const mcpNavResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(nativeNavResult.success).toBe(true);
      expect(mcpNavResult.success).toBe(true);

      // Screenshots should fail for both
      const nativeScreenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      const mcpScreenshotResult = await mcpBrowserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(nativeScreenshotResult.success).toBe(false);
      expect(mcpScreenshotResult.success).toBe(false);
    });

    it('should handle domain-based restrictions for both systems', async () => {
      // Allow example.com but block dangerous.com
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:example.com');
      await permissionManager.denyPermission('Browser', 'navigate:dangerous.com');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always', 'navigate:example.com');
      await permissionManager.denyPermission('mcp__browser-tools__Browser', 'navigate:dangerous.com');

      // Setup mocks
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockMcpBrowserExecute.mockResolvedValue({ success: true, data: {} });

      // Allowed domain should work for both
      const nativeAllowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      const mcpAllowedResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(nativeAllowedResult.success).toBe(true);
      expect(mcpAllowedResult.success).toBe(true);

      // Blocked domain should fail for both
      const nativeBlockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://dangerous.com' }
      });

      const mcpBlockedResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://dangerous.com' }
      });

      expect(nativeBlockedResult.success).toBe(false);
      expect(mcpBlockedResult.success).toBe(false);
    });
  });

  describe('Cross-System Coordination', () => {
    it('should coordinate resource usage between systems', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always');

      // Setup mocks for resource-intensive operations
      mockPage.screenshot.mockResolvedValue(Buffer.alloc(1024 * 1024)); // 1MB
      mockMcpBrowserExecute.mockImplementation(async ({ operation }) => {
        if (operation === 'screenshot') {
          return { success: true, data: { size: 1024 * 1024 } };
        }
        return { success: true, data: {} };
      });

      // Execute concurrent operations across both systems
      const operations = [
        browserTool.execute({ operation: 'screenshot', params: { fullPage: true } }),
        mcpBrowserTool.execute({ operation: 'screenshot', params: { fullPage: true } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://test1.com' } }),
        mcpBrowserTool.execute({ operation: 'navigate', params: { url: 'https://test2.com' } })
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete successfully
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });

      // Both systems should remain functional
      expect(browserTool.isActive()).toBe(true);
    });

    it('should handle permission changes affecting both systems', async () => {
      // Initially grant permissions
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always');

      // Setup mocks
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockMcpBrowserExecute.mockResolvedValue({ success: true, data: {} });

      // Operations should succeed
      let nativeResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      let mcpResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(nativeResult.success).toBe(true);
      expect(mcpResult.success).toBe(true);

      // Revoke permissions
      await permissionManager.denyPermission('Browser');
      await permissionManager.denyPermission('mcp__browser-tools__Browser');

      // Operations should now fail
      nativeResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      mcpResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(nativeResult.success).toBe(false);
      expect(mcpResult.success).toBe(false);
    });

    it('should handle errors consistently across systems', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always');

      // Setup error conditions
      mockPage.goto.mockRejectedValue(new Error('Network timeout'));
      mockMcpBrowserExecute.mockRejectedValue(new Error('MCP service unavailable'));

      const nativeResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://timeout.com' }
      });

      const mcpResult = await mcpBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://unavailable.com' }
      });

      // Both should handle errors gracefully
      expect(nativeResult.success).toBe(false);
      expect(nativeResult.error).toBeDefined();

      expect(mcpResult.success).toBe(false);
      expect(mcpResult.error).toBeDefined();

      // Systems should remain stable after errors
      expect(browserTool.getState()).toBeDefined();
    });
  });

  describe('Performance Comparison', () => {
    it('should handle comparable workloads across both systems', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always');

      // Setup mocks with realistic timing
      mockPage.goto.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ status: () => 200 }), 50))
      );
      mockMcpBrowserExecute.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true, data: {} }), 60))
      );

      const operationCount = 5;
      const startTime = Date.now();

      // Create parallel operations for both systems
      const nativeOperations = Array.from({ length: operationCount }, (_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://native${i}.com` }
        })
      );

      const mcpOperations = Array.from({ length: operationCount }, (_, i) =>
        mcpBrowserTool.execute({
          operation: 'navigate',
          params: { url: `https://mcp${i}.com` }
        })
      );

      const [nativeResults, mcpResults] = await Promise.all([
        Promise.allSettled(nativeOperations),
        Promise.allSettled(mcpOperations)
      ]);

      const endTime = Date.now();

      // Both systems should complete successfully
      nativeResults.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });

      mcpResults.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });

      // Should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000); // Less than 2 seconds

      // Permission events should be tracked for both systems
      const grantedEvents = systemEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(operationCount * 2); // Both systems
    });
  });
});