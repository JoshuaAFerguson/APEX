/**
 * Comprehensive Browser Automation Permission Integration Tests
 *
 * This test suite provides comprehensive coverage for browser automation operations
 * when permissions are properly granted. Tests verify that:
 * 1. All browser operations succeed with appropriate permissions
 * 2. Permission events are properly emitted
 * 3. Operation results include permission metadata
 * 4. Browser sessions handle permission state correctly
 * 5. Complex workflows respect permission inheritance
 * 6. Error scenarios provide clear feedback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';
import { createTestTask, MockBrowserSession } from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

import type {
  Task,
  PermissionLevel,
  BrowserSession,
  BrowserSessionConfig,
  ToolPermissionResult,
} from '@apexcli/core';

import type {
  BrowserNavigateParams,
  BrowserClickParams,
  BrowserTypeParams,
  BrowserScreenshotParams,
  BrowserEvaluateParams,
  BrowserSubmitParams,
  BrowserWaitForSelectorParams,
  BrowserGetAttributeParams,
  BrowserGetTextParams,
  BrowserGetHtmlParams,
  BrowserScrollParams,
  BrowserHoverParams,
  BrowserResult,
} from '../../packages/orchestrator/src/tools/browser-tool';

describe('Browser Permission Integration - Comprehensive Coverage', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let permissionEvents: any[] = [];
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-comprehensive-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool with permission manager
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      eventEmitter,
      taskId: testTask.id,
    });

    // Create mock browser session with enhanced capabilities
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local', 'safe.site', 'trusted.domain'],
      blockedDomains: ['blocked.com', 'dangerous.site'],
    });

    // Mock browser tool to use our test session
    vi.spyOn(browserTool as any, 'ensurePage').mockResolvedValue({
      backend: 'playwright',
      page: {
        url: () => 'https://example.com',
        title: () => Promise.resolve('Test Page Title'),
        goto: vi.fn().mockResolvedValue({ status: () => 200 }),
        click: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
        evaluate: vi.fn().mockResolvedValue('evaluation result'),
        locator: vi.fn().mockReturnValue({
          evaluate: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        }),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        getAttribute: vi.fn().mockResolvedValue('test-attribute-value'),
        textContent: vi.fn().mockResolvedValue('test text content'),
        content: vi.fn().mockResolvedValue('<html><body>Test HTML</body></html>'),
        innerHTML: vi.fn().mockResolvedValue('<div>Inner HTML</div>'),
        hover: vi.fn().mockResolvedValue(undefined),
        viewportSize: () => ({ width: 1920, height: 1080 }),
      },
    });

    // Set up permission event tracking
    permissionEvents = [];

    eventEmitter.on('permission:granted', (event) => {
      permissionEvents.push({ type: 'granted', ...event });
    });

    eventEmitter.on('permission:denied', (event) => {
      permissionEvents.push({ type: 'denied', ...event });
    });

    eventEmitter.on('permission:requested', (event) => {
      permissionEvents.push({ type: 'requested', ...event });
    });
  });

  afterEach(async () => {
    await browserTool?.cleanup();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    eventEmitter.removeAllListeners();
  });

  describe('Core Navigation Operations with Permissions', () => {
    it('should allow navigation with proper browser permissions', async () => {
      // Grant navigation permission
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://example.com',
          waitUntil: 'load',
          timeout: 5000,
        } as BrowserNavigateParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.data).toEqual({
        url: 'https://example.com',
        status: 200,
      });
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.metadata?.url).toBe('https://example.com');
      expect(result.metadata?.title).toBe('Test Page Title');
    });

    it('should allow multiple navigation operations with always permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://test.local/page3',
      ];

      for (const url of urls) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url } as BrowserNavigateParams,
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      }

      // Verify all operations were granted
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(urls.length);
    });

    it('should respect one-time navigation permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

      // First navigation should succeed
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
      expect(result1.success).toBe(true);

      // Second navigation should fail (permission consumed)
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.local' } as BrowserNavigateParams,
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/permission.*denied/i);
    });
  });

  describe('Element Interaction Operations with Permissions', () => {
    beforeEach(async () => {
      // Grant navigation permission for setup
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
    });

    it('should allow click operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');

      const result = await browserTool.execute({
        operation: 'click',
        params: {
          selector: '#submit-button',
          button: 'left',
          clickCount: 1,
        } as BrowserClickParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('click');
      expect(result.data).toEqual({
        clicked: '#submit-button',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow type operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');

      const result = await browserTool.execute({
        operation: 'type',
        params: {
          selector: '#username',
          text: 'testuser',
          delay: 100,
          clearFirst: true,
        } as BrowserTypeParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('type');
      expect(result.data).toEqual({
        typed: 'testuser',
        into: '#username',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow hover operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'hover');

      const result = await browserTool.execute({
        operation: 'hover',
        params: {
          selector: '.tooltip-trigger',
        } as BrowserHoverParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('hover');
      expect(result.data).toEqual({
        hovered: '.tooltip-trigger',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Data Extraction Operations with Permissions', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
    });

    it('should allow getText operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getText');

      const result = await browserTool.execute({
        operation: 'getText',
        params: {
          selector: 'h1',
        } as BrowserGetTextParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getText');
      expect(result.data).toEqual({
        text: 'test text content',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow getAttribute operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getAttribute');

      const result = await browserTool.execute({
        operation: 'getAttribute',
        params: {
          selector: '#input-field',
          attribute: 'placeholder',
        } as BrowserGetAttributeParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getAttribute');
      expect(result.data).toEqual({
        attribute: 'placeholder',
        value: 'test-attribute-value',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow getHtml operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getHtml');

      const result = await browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '.content',
        } as BrowserGetHtmlParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('getHtml');
      expect(result.data).toEqual({
        html: '<div>Inner HTML</div>',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow full page HTML extraction with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getHtml');

      const result = await browserTool.execute({
        operation: 'getHtml',
        params: {} as BrowserGetHtmlParams,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        html: '<html><body>Test HTML</body></html>',
      });
    });
  });

  describe('Screenshot Operations with Permissions', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
    });

    it('should allow screenshot operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          fullPage: false,
          format: 'png',
        } as BrowserScreenshotParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('screenshot');
      expect(result.data).toEqual({
        width: 1920,
        height: 1080,
        format: 'png',
      });
      expect(result.screenshot).toMatch(/^data:image\/png;base64,/);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow screenshot with file path and proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const screenshotPath = path.join(testDir, 'test-screenshot.png');
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          path: screenshotPath,
          fullPage: true,
          format: 'png',
          quality: 90,
        } as BrowserScreenshotParams,
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe(screenshotPath);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('JavaScript Evaluation Operations with Permissions', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
    });

    it('should allow JavaScript evaluation with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'return document.title;',
          args: [],
        } as BrowserEvaluateParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('evaluate');
      expect(result.data).toEqual({
        result: 'evaluation result',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow complex JavaScript evaluation with arguments', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'return args[0] + args[1];',
          args: [5, 10],
        } as BrowserEvaluateParams,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        result: 'evaluation result',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Form Submission Operations with Permissions', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
    });

    it('should allow form submission with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'submit');

      const result = await browserTool.execute({
        operation: 'submit',
        params: {
          selector: '#contact-form',
          validate: true,
        } as BrowserSubmitParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('submit');
      expect(result.data).toEqual({
        submitted: '#contact-form',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow form submission without validation', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'submit');

      const result = await browserTool.execute({
        operation: 'submit',
        params: {
          selector: '#simple-form',
          validate: false,
        } as BrowserSubmitParams,
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Wait and Scroll Operations with Permissions', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' } as BrowserNavigateParams,
      });
    });

    it('should allow waitForSelector operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'waitForSelector');

      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '.dynamic-content',
          timeout: 5000,
          visible: true,
        } as BrowserWaitForSelectorParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('waitForSelector');
      expect(result.data).toEqual({
        found: '.dynamic-content',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow scroll operations with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'scroll');

      const result = await browserTool.execute({
        operation: 'scroll',
        params: {
          x: 0,
          y: 500,
        } as BrowserScrollParams,
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('scroll');
      expect(result.data).toEqual({
        scrolled: '0,500',
      });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow scrolling to element with proper permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'scroll');

      const result = await browserTool.execute({
        operation: 'scroll',
        params: {
          selector: '#bottom-section',
        } as BrowserScrollParams,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        scrolled: '#bottom-section',
      });
    });
  });

  describe('Permission Inheritance and Workflow Tests', () => {
    it('should allow complex workflow with general browser permission', async () => {
      // Grant general browser permission
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Execute a complete workflow
      const workflow = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'getText', params: { selector: 'h1' } },
        { operation: 'click', params: { selector: '#menu-button' } },
        { operation: 'waitForSelector', params: { selector: '.dropdown-menu' } },
        { operation: 'screenshot', params: { fullPage: false } },
        { operation: 'scroll', params: { x: 0, y: 300 } },
        { operation: 'getAttribute', params: { selector: '#footer', attribute: 'class' } },
        { operation: 'hover', params: { selector: '.tooltip-trigger' } },
      ];

      const results: BrowserResult[] = [];

      for (const step of workflow) {
        const result = await browserTool.execute(step as any);
        results.push(result);
      }

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
        expect(result.operation).toBe(workflow[index].operation);
      });

      // Verify all operations were granted
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(workflow.length);
    });

    it('should handle mixed permission levels in workflow', async () => {
      // Grant specific permissions for different operations
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-once', 'click');
      await permissionManager.grantPermission('Browser', 'allow-always', 'getText');

      // Execute workflow
      const navigate = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(navigate.success).toBe(true);

      const click = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      } as any);
      expect(click.success).toBe(true);

      const getText = await browserTool.execute({
        operation: 'getText',
        params: { selector: 'h1' },
      } as any);
      expect(getText.success).toBe(true);

      // Second click should fail (allow-once consumed)
      const clickAgain = await browserTool.execute({
        operation: 'click',
        params: { selector: '#another-button' },
      } as any);
      expect(clickAgain.success).toBe(false);
    });
  });

  describe('Permission Event Verification', () => {
    it('should emit correct permission events for granted operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      const grantedEvent = permissionEvents.find(e => e.type === 'granted');
      expect(grantedEvent).toBeDefined();
      expect(grantedEvent).toMatchObject({
        type: 'granted',
        tool: 'Browser',
        operation: 'navigate',
      });
    });

    it('should track permission usage over time', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const startTime = Date.now();

      // Execute multiple operations
      const operations = ['navigate', 'click', 'getText', 'screenshot'];
      for (const operation of operations) {
        await browserTool.execute({
          operation,
          params: operation === 'navigate'
            ? { url: 'https://example.com' }
            : operation === 'click' || operation === 'getText'
            ? { selector: '#element' }
            : {},
        } as any);
      }

      const endTime = Date.now();

      // Verify all operations were tracked
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents.length).toBe(operations.length);

      // Verify timestamp tracking
      grantedEvents.forEach(event => {
        expect(event.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(event.timestamp).toBeLessThanOrEqual(endTime);
      });
    });
  });

  describe('Permission Metadata Validation', () => {
    it('should include comprehensive metadata for all operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toMatchObject({
        url: 'https://example.com',
        title: 'Test Page Title',
        permissionGranted: true,
        permissionLevel: 'allow-always',
        executionTime: expect.any(Number),
        target: 'https://example.com',
      });

      expect(typeof result.metadata?.executionTime).toBe('number');
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include operation-specific metadata', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Navigate first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      // Test screenshot metadata
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false, format: 'png' },
      } as any);

      expect(screenshotResult.metadata?.url).toBe('https://example.com');
      expect(screenshotResult.data).toMatchObject({
        width: 1920,
        height: 1080,
        format: 'png',
      });
    });
  });

  describe('Resource Management with Permissions', () => {
    it('should properly manage browser resources when permissions are granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Check initial state
      expect(browserTool.isActive()).toBe(false);

      // Execute operation to activate browser
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(result.success).toBe(true);
      expect(browserTool.isActive()).toBe(true);

      const resourceState = browserTool.getResourceState();
      expect(resourceState.browserActive).toBe(false); // Mock doesn't actually launch browser
      expect(resourceState.sessionId).toBeDefined();
    });

    it('should handle concurrent operations with permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Execute multiple operations simultaneously
      const operations = [
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/1' },
        } as any),
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/2' },
        } as any),
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/3' },
        } as any),
      ];

      const results = await Promise.all(operations);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      });
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should maintain permission state across operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Execute successful operation
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
      expect(result1.success).toBe(true);

      // Execute another operation - permission should still be valid
      const result2 = await browserTool.execute({
        operation: 'getText',
        params: { selector: 'h1' },
      } as any);
      expect(result2.success).toBe(true);
      expect(result2.metadata?.permissionGranted).toBe(true);
    });

    it('should provide clear error context when operations fail', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock a browser operation failure
      const mockPage = {
        url: () => 'https://example.com',
        title: () => Promise.resolve('Test Page'),
        goto: vi.fn().mockRejectedValue(new Error('Network timeout')),
      };

      vi.spyOn(browserTool as any, 'ensurePage').mockResolvedValueOnce({
        backend: 'playwright',
        page: mockPage,
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.metadata?.permissionGranted).toBe(true); // Permission was granted
    });
  });
});