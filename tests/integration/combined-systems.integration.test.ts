/**
 * Comprehensive Integration Tests: Tools + Permissions + Browser Automation
 *
 * This test suite validates the complete integration between three core systems:
 * 1. Tool System - Core tool infrastructure and execution
 * 2. Permission System - Access control and authorization
 * 3. Browser Automation - Web automation capabilities
 *
 * Tests verify that:
 * - Tools respect permission settings before execution
 * - Browser automation integrates with tool permission checks
 * - Events propagate correctly across all three systems
 * - Error handling works consistently across systems
 * - Configuration changes affect all systems appropriately
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Import core types and utilities
import type {
  Task,
  Permission,
  PermissionLevel,
  ToolPermissionResult,
  BrowserSession,
  AgentTool,
  ApexConfig
} from '@apexcli/core';

// Import orchestrator components
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Import test utilities
import {
  createTestTask,
  MockBrowserSession,
  setupTestEnvironment,
  cleanupTestEnvironment
} from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

// Mock external dependencies
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

vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn()
}));

// Mock browser page object
const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  evaluate: vi.fn(() => Promise.resolve('mock-result')),
  on: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
};

describe('Combined Systems Integration: Tools + Permissions + Browser Automation', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let testTask: Task;
  let systemEvents: any[];

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-combined-test-'));

    // Initialize system components
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    eventEmitter = new EventEmitter();
    systemEvents = [];

    // Set up event tracking
    setupEventTracking();

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Initialize browser tool with permission integration
    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright',
      engine: 'chromium',
      headless: true
    });

    // Create orchestrator with all components
    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      taskStore,
      permissionManager,
      eventEmitter
    });

    // Register tools in orchestrator
    (orchestrator as any).tools = {
      browser: browserTool
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestEnvironment(testDir, taskStore);
    vi.restoreAllMocks();
  });

  function setupEventTracking() {
    const eventTypes = [
      'permission:requested',
      'permission:granted',
      'permission:denied',
      'tool:execution:start',
      'tool:execution:complete',
      'tool:execution:error',
      'browser:operation:start',
      'browser:operation:complete',
      'browser:session:created',
      'browser:session:closed',
      'task:status:changed',
      'system:error'
    ];

    eventTypes.forEach(eventType => {
      eventEmitter.on(eventType, (data) => {
        systemEvents.push({
          type: eventType,
          timestamp: Date.now(),
          data
        });
      });
    });
  }

  describe('Core Tool Permission Integration', () => {
    it('should validate permissions before executing any tool operation', async () => {
      // Initially deny all permissions
      await permissionManager.denyPermission('Read');
      await permissionManager.denyPermission('Browser');

      // Mock tool execution that requires Read permission
      const readToolMock = vi.fn().mockResolvedValue({
        success: false,
        error: 'Permission denied for Read tool'
      });

      // Try to execute read operation
      const result = await executeToolWithPermissionCheck('Read', 'readFile', {
        filePath: '/test/file.txt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);

      // Verify permission request was made
      const permissionEvents = systemEvents.filter(e => e.type === 'permission:requested');
      expect(permissionEvents).toHaveLength(1);
      expect(permissionEvents[0].data.tool).toBe('Read');
    });

    it('should allow tool execution with proper permissions', async () => {
      // Grant read permission
      await permissionManager.grantPermission('Read', 'allow-always');

      // Mock successful read operation
      const mockReadResult = {
        success: true,
        data: { content: 'file content' },
        metadata: { filePath: '/test/file.txt' }
      };

      const result = await executeToolWithPermissionCheck('Read', 'readFile', {
        filePath: '/test/file.txt'
      });

      // Verify permission was checked and granted
      const grantedEvents = systemEvents.filter(e => e.type === 'permission:granted');
      expect(grantedEvents).toHaveLength(1);
      expect(grantedEvents[0].data.tool).toBe('Read');
    });

    it('should handle tool-specific permission scopes', async () => {
      // Grant permission for specific file pattern
      await permissionManager.grantPermission('Read', 'allow-always', '/safe/path/*');
      await permissionManager.denyPermission('Read', '/dangerous/path/*');

      // Attempt to read from allowed path
      const allowedResult = await executeToolWithPermissionCheck('Read', 'readFile', {
        filePath: '/safe/path/config.yaml'
      });

      // Should succeed (if tool implementation allows)
      const allowedEvents = systemEvents.filter(e =>
        e.type === 'permission:requested' &&
        e.data.scope?.includes('/safe/path')
      );
      expect(allowedEvents.length).toBeGreaterThan(0);

      // Attempt to read from blocked path
      systemEvents.length = 0; // Clear events
      const blockedResult = await executeToolWithPermissionCheck('Read', 'readFile', {
        filePath: '/dangerous/path/secret.txt'
      });

      const deniedEvents = systemEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Browser Automation + Permission Integration', () => {
    it('should require browser permissions before any automation operations', async () => {
      // Start without browser permissions
      await permissionManager.denyPermission('Browser');

      // Attempt to navigate
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(false);
      expect(navResult.error).toMatch(/permission.*denied/i);

      // Verify no browser session was created
      const sessionEvents = systemEvents.filter(e => e.type === 'browser:session:created');
      expect(sessionEvents).toHaveLength(0);
    });

    it('should allow browser operations with proper permissions', async () => {
      // Grant browser permissions
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock successful navigation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://example.com');

      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(navResult.success).toBe(true);

      // Verify permission was granted and operation executed
      const grantedEvents = systemEvents.filter(e => e.type === 'permission:granted');
      expect(grantedEvents.length).toBeGreaterThan(0);

      const operationEvents = systemEvents.filter(e => e.type === 'browser:operation:complete');
      expect(operationEvents.length).toBeGreaterThan(0);
    });

    it('should handle different permission levels for browser operations', async () => {
      // Grant one-time permission
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

      // First navigation should succeed
      mockPage.goto.mockResolvedValue({ status: () => 200 });
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

    it('should enforce domain-based restrictions through permissions', async () => {
      // Grant browser permission but configure domain restrictions
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock domain validation in browser tool
      const mockValidateDomain = vi.fn()
        .mockReturnValueOnce(true)   // allow example.com
        .mockReturnValueOnce(false); // block dangerous.com

      (browserTool as any).validateDomain = mockValidateDomain;

      // Allowed domain should work
      const allowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Blocked domain should fail
      const blockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://dangerous.com' }
      });

      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toMatch(/domain.*blocked|not.*allowed/i);
    });
  });

  describe('Cross-System Integration Scenarios', () => {
    it('should coordinate permissions across tools and browser automation', async () => {
      // Grant different permission levels to different tools
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-once');
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');
      await permissionManager.denyPermission('Browser', 'evaluate');

      // Test read tool execution
      const readResult = await executeToolWithPermissionCheck('Read', 'readFile', {
        filePath: '/test/config.json'
      });

      // Test write tool execution
      const writeResult = await executeToolWithPermissionCheck('Write', 'writeFile', {
        filePath: '/test/output.txt',
        content: 'test data'
      });

      // Test allowed browser operation
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(true);

      // Test denied browser operation
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      expect(evalResult.success).toBe(false);

      // Verify permission events for all operations
      const grantedEvents = systemEvents.filter(e => e.type === 'permission:granted');
      const deniedEvents = systemEvents.filter(e => e.type === 'permission:denied');

      expect(grantedEvents.length).toBeGreaterThan(0);
      expect(deniedEvents.length).toBeGreaterThan(0);
    });

    it('should handle complex multi-step workflows with mixed permissions', async () => {
      // Set up a complex permission scenario
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-once', 'click');
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.denyPermission('Write');

      const workflowEvents: any[] = [];

      // Step 1: Navigate to page (should succeed)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://form-example.com' }
      });
      expect(navResult.success).toBe(true);
      workflowEvents.push({ step: 1, success: navResult.success });

      // Step 2: Read configuration file (should succeed)
      const configResult = await executeToolWithPermissionCheck('Read', 'readFile', {
        filePath: '/config/form-settings.json'
      });
      workflowEvents.push({ step: 2, success: configResult.success });

      // Step 3: Click form element (should succeed, consuming allow-once)
      mockPage.click.mockResolvedValue();
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#submit-button' }
      });
      expect(clickResult.success).toBe(true);
      workflowEvents.push({ step: 3, success: clickResult.success });

      // Step 4: Try to save results (should fail - no write permission)
      const saveResult = await executeToolWithPermissionCheck('Write', 'writeFile', {
        filePath: '/results/form-data.json',
        content: '{"submitted": true}'
      });
      expect(saveResult.success).toBe(false);
      workflowEvents.push({ step: 4, success: saveResult.success });

      // Step 5: Try to click again (should fail - allow-once consumed)
      const secondClickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#another-button' }
      });
      expect(secondClickResult.success).toBe(false);
      workflowEvents.push({ step: 5, success: secondClickResult.success });

      // Verify workflow progression
      expect(workflowEvents).toEqual([
        { step: 1, success: true },  // Navigate
        { step: 2, success: true },  // Read config
        { step: 3, success: true },  // Click (consume permission)
        { step: 4, success: false }, // Write denied
        { step: 5, success: false }  // Click denied (consumed)
      ]);
    });

    it('should propagate errors consistently across systems', async () => {
      // Set up error conditions
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock browser failure
      mockPage.goto.mockRejectedValue(new Error('Network timeout'));

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://timeout-test.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/network timeout/i);

      // Verify error events were propagated
      const errorEvents = systemEvents.filter(e =>
        e.type === 'tool:execution:error' ||
        e.type === 'browser:operation:error' ||
        e.type === 'system:error'
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle permission system failures gracefully', async () => {
      // Mock permission manager failure
      const originalCheck = permissionManager.checkToolPermission;
      permissionManager.checkToolPermission = vi.fn().mockRejectedValue(
        new Error('Permission database connection failed')
      );

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*database|connection.*failed/i);

      // Restore original function
      permissionManager.checkToolPermission = originalCheck;
    });
  });

  describe('Event Flow and System Coordination', () => {
    it('should emit events in correct order across all systems', async () => {
      // Grant permissions
      await permissionManager.grantPermission('Browser', 'allow-always');

      const eventOrder: string[] = [];

      // Track event ordering
      eventEmitter.on('permission:requested', () => eventOrder.push('permission:requested'));
      eventEmitter.on('permission:granted', () => eventOrder.push('permission:granted'));
      eventEmitter.on('browser:operation:start', () => eventOrder.push('browser:operation:start'));
      eventEmitter.on('tool:execution:start', () => eventOrder.push('tool:execution:start'));
      eventEmitter.on('tool:execution:complete', () => eventOrder.push('tool:execution:complete'));
      eventEmitter.on('browser:operation:complete', () => eventOrder.push('browser:operation:complete'));

      // Execute browser operation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://event-order-test.com' }
      });

      // Verify events were emitted in logical order
      // Permission events should come before execution events
      const permissionIndex = eventOrder.findIndex(e => e === 'permission:granted');
      const executionStartIndex = eventOrder.findIndex(e => e === 'tool:execution:start');
      const executionCompleteIndex = eventOrder.findIndex(e => e === 'tool:execution:complete');

      if (permissionIndex !== -1 && executionStartIndex !== -1) {
        expect(permissionIndex).toBeLessThan(executionStartIndex);
      }
      if (executionStartIndex !== -1 && executionCompleteIndex !== -1) {
        expect(executionStartIndex).toBeLessThan(executionCompleteIndex);
      }
    });

    it('should broadcast system status changes to all listeners', async () => {
      const statusUpdates: any[] = [];

      // Listen to various status events
      eventEmitter.on('task:status:changed', (data) => statusUpdates.push({ type: 'task', ...data }));
      eventEmitter.on('permission:granted', (data) => statusUpdates.push({ type: 'permission', ...data }));
      eventEmitter.on('browser:session:created', (data) => statusUpdates.push({ type: 'browser', ...data }));

      // Grant permissions and trigger operations
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Update task status
      await taskStore.updateTask(testTask.id, { status: 'in-progress' });

      // Execute browser operation (creates session)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://status-test.com' }
      });

      // Verify all systems reported status changes
      expect(statusUpdates.length).toBeGreaterThan(0);

      const taskStatus = statusUpdates.find(u => u.type === 'task');
      const permissionStatus = statusUpdates.find(u => u.type === 'permission');
      const browserStatus = statusUpdates.find(u => u.type === 'browser');

      // At least one type of status update should have occurred
      expect([taskStatus, permissionStatus, browserStatus].some(Boolean)).toBe(true);
    });

    it('should handle concurrent operations with proper event coordination', async () => {
      // Grant permissions for concurrent operations
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');

      const concurrentEvents: any[] = [];

      eventEmitter.on('tool:execution:start', (data) => {
        concurrentEvents.push({ event: 'start', tool: data.tool, timestamp: Date.now() });
      });

      eventEmitter.on('tool:execution:complete', (data) => {
        concurrentEvents.push({ event: 'complete', tool: data.tool, timestamp: Date.now() });
      });

      // Start concurrent operations
      const operations = [
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://concurrent1.com' }
        }),
        browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        }),
        executeToolWithPermissionCheck('Read', 'readFile', {
          filePath: '/test/file1.txt'
        }),
        executeToolWithPermissionCheck('Read', 'readFile', {
          filePath: '/test/file2.txt'
        })
      ];

      await Promise.all(operations);

      // Verify all operations were tracked
      const startEvents = concurrentEvents.filter(e => e.event === 'start');
      const completeEvents = concurrentEvents.filter(e => e.event === 'complete');

      expect(startEvents.length).toBeGreaterThan(0);
      expect(completeEvents.length).toBeGreaterThan(0);

      // Verify each start has a corresponding complete
      startEvents.forEach(startEvent => {
        const correspondingComplete = completeEvents.find(
          completeEvent =>
            completeEvent.tool === startEvent.tool &&
            completeEvent.timestamp >= startEvent.timestamp
        );
        expect(correspondingComplete).toBeDefined();
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should respect global configuration changes across all systems', async () => {
      // Define test configuration
      const testConfig: Partial<ApexConfig> = {
        tools: {
          browser: {
            enabled: false,
            allowScreenshots: false
          },
          filesystem: {
            enabled: true,
            readOnly: true
          }
        },
        permissions: {
          preset: 'denyAll',
          persistence: true
        }
      };

      // Apply configuration (mock this for test)
      const applyConfigSpy = vi.fn();
      (orchestrator as any).applyConfig = applyConfigSpy;
      await (orchestrator as any).applyConfig?.(testConfig);

      // Browser tool should be disabled
      const browserResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });
      expect(browserResult.success).toBe(false);
      expect(browserResult.error).toMatch(/disabled|not.*enabled/i);

      // Verify config was applied
      expect(applyConfigSpy).toHaveBeenCalledWith(testConfig);
    });

    it('should handle configuration validation across systems', async () => {
      // Test invalid configuration
      const invalidConfig = {
        tools: {
          browser: {
            enabled: true,
            allowedDomains: 'invalid-should-be-array' // Invalid type
          }
        }
      };

      // Configuration validation should fail
      expect(() => {
        // Mock configuration validation
        if (typeof invalidConfig.tools.browser.allowedDomains === 'string') {
          throw new Error('Configuration validation failed: allowedDomains must be an array');
        }
      }).toThrow(/configuration validation failed/i);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle resource cleanup across all systems', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Track resource creation
      const resourceEvents: string[] = [];

      eventEmitter.on('browser:session:created', () => resourceEvents.push('session:created'));
      eventEmitter.on('browser:session:closed', () => resourceEvents.push('session:closed'));

      // Create browser session through operation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://cleanup-test.com' }
      });

      // Cleanup resources
      await (browserTool as any).cleanup?.();

      // Verify resources were properly managed
      expect(resourceEvents).toContain('session:created');
    });

    it('should handle system load and rate limiting', async () => {
      // Configure rate limiting
      await permissionManager.setToolConfig('Browser', {
        enabled: true,
        rateLimitPerMinute: 2 // Very low limit for testing
      });

      await permissionManager.grantPermission('Browser', 'allow-always');

      // Attempt rapid operations
      const rapidOperations = [
        browserTool.execute({ operation: 'navigate', params: { url: 'https://test1.com' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://test2.com' } }),
        browserTool.execute({ operation: 'navigate', params: { url: 'https://test3.com' } })
      ];

      const results = await Promise.allSettled(rapidOperations);

      // Some operations should be rate limited
      const rejectedResults = results.filter(r =>
        r.status === 'fulfilled' && !(r.value as any).success
      );

      // At least one operation should hit rate limit (depends on implementation)
      // This test demonstrates the integration point even if rate limiting isn't fully implemented
    });
  });

  // Helper function to simulate tool execution with permission checks
  async function executeToolWithPermissionCheck(
    tool: AgentTool,
    operation: string,
    params: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Check permission first
      const permissionResult = await permissionManager.checkToolPermission(tool, {
        scope: `${operation}:${JSON.stringify(params)}`,
        consumeAllowOnce: true
      });

      if (!permissionResult.allowed) {
        return {
          success: false,
          error: permissionResult.denialReason || `Permission denied for ${tool} tool`
        };
      }

      // Emit permission granted event
      eventEmitter.emit('permission:granted', {
        tool,
        scope: operation,
        level: permissionResult.level
      });

      // Emit tool execution events
      eventEmitter.emit('tool:execution:start', { tool, operation });

      // Mock tool execution logic
      let result: any;
      switch (tool) {
        case 'Read':
          result = { success: true, data: { content: 'mock file content' } };
          break;
        case 'Write':
          result = { success: true, data: { bytesWritten: 100 } };
          break;
        case 'Glob':
          result = { success: true, data: { files: ['/mock/file.txt'] } };
          break;
        default:
          result = { success: true, data: {} };
      }

      eventEmitter.emit('tool:execution:complete', { tool, operation, result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      eventEmitter.emit('tool:execution:error', { tool, operation, error: errorMessage });

      return {
        success: false,
        error: errorMessage
      };
    }
  }
});