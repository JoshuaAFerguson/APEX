/**
 * Browser Automation Permission-Granted Integration Tests
 *
 * This test suite verifies that browser automation operations succeed when
 * appropriate permissions are granted. Complements the existing permission-denial
 * tests by focusing on successful operation scenarios.
 *
 * Coverage:
 * - Navigation operations with permissions
 * - Click operations with permissions
 * - Form filling operations with permissions
 * - Screenshot operations with permissions
 * - Text extraction operations with permissions
 * - Scroll/hover operations with permissions
 * - JavaScript evaluation with elevated permissions
 * - Form submission with elevated permissions
 * - Permission level behavior (allow-always, allow-once)
 * - Event emission verification for granted permissions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore } from '@apexcli/orchestrator';
import {
  BrowserTool,
  type BrowserParams,
  type BrowserResult,
  type BrowserNavigateParams,
  type BrowserClickParams,
  type BrowserTypeParams,
  type BrowserScreenshotParams,
  type BrowserGetTextParams,
  type BrowserGetAttributeParams,
  type BrowserGetHtmlParams,
  type BrowserScrollParams,
  type BrowserHoverParams,
  type BrowserEvaluateParams,
  type BrowserSubmitParams,
  type BrowserWaitForSelectorParams,
} from '../../packages/orchestrator/src/tools/browser-tool';
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

// Test pages using data URLs for self-contained testing
const TEST_PAGES = {
  simple: 'data:text/html,<html><body><h1>Test Page</h1></body></html>',
  withButton: 'data:text/html,<html><body><button id="test-btn">Click Me</button></body></html>',
  withForm: 'data:text/html,<html><body><form id="test-form"><input type="text" id="name" placeholder="Name"><textarea id="comments" placeholder="Comments"></textarea><button type="submit">Submit</button></form></body></html>',
  withLinks: 'data:text/html,<html><body><a href="#section1" id="test-link">Go to Section</a><div id="section1">Section Content</div></body></html>',
  withElements: 'data:text/html,<html><body><div id="scrollable" style="height: 200px; overflow: auto;"><div style="height: 1000px;"><p id="target">Target Element</p></div></div></body></html>',
  titled: 'data:text/html,<html><head><title>Test Title</title></head><body><h1>Content</h1></body></html>',
  withAttributes: 'data:text/html,<html><body><div id="test-div" data-value="test-attr" class="test-class">Element with attributes</div></body></html>',
  interactive: 'data:text/html,<html><body><div id="hover-target" onmouseover="this.style.backgroundColor=\'yellow\'">Hover me</div></body></html>',
};

describe('Browser Permission-Granted Integration', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let permissionEvents: any[] = [];

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-granted-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool with permission manager
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });

    // Create mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'test.local'],
      blockedDomains: ['blocked.com', 'dangerous.site'],
    });

    // Mock browser tool to use our test session
    vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Set up permission event tracking
    permissionEvents = [];
    const eventEmitter = permissionStore as any as EventEmitter;

    eventEmitter.on('permission:requested', (event) => {
      permissionEvents.push({ type: 'requested', ...event });
    });

    eventEmitter.on('permission:granted', (event) => {
      permissionEvents.push({ type: 'granted', ...event });
    });

    eventEmitter.on('permission:denied', (event) => {
      permissionEvents.push({ type: 'denied', ...event });
    });
  });

  afterEach(async () => {
    await mockSession?.close();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Navigation Operations', () => {
    it('should navigate to data URL when permission is granted', async () => {
      // Grant navigation permission
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const result: BrowserResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.data).toHaveProperty('url');

      // Verify permission event was emitted
      expect(permissionEvents).toContainEqual(
        expect.objectContaining({
          type: 'granted',
          tool: 'Browser',
          operation: 'navigate',
        })
      );
    });

    it('should navigate to multiple URLs with allow-always permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const urls = [TEST_PAGES.simple, TEST_PAGES.withButton, TEST_PAGES.withForm];

      for (const url of urls) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should navigate once with allow-once permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

      // First navigation should succeed
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });
      expect(result1.success).toBe(true);

      // Second navigation should fail (permission consumed)
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withButton }
      });
      expect(result2.success).toBe(false);
      expect(result2.error?.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Click Operations', () => {
    beforeEach(async () => {
      // Grant basic navigation for setup
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withButton }
      });
    });

    it('should click buttons when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-btn' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should click links when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');

      // Navigate to page with links first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withLinks }
      });

      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#test-link' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Form Filling Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withForm }
      });
    });

    it('should fill text inputs when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');

      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: '#name', text: 'Test User' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should fill textarea when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');

      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: '#comments', text: 'Test comments here' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should clear and type when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');

      // First, add some text
      await browserTool.execute({
        operation: 'type',
        params: { selector: '#name', text: 'Initial text' }
      });

      // Then clear and type new text
      const result = await browserTool.execute({
        operation: 'type',
        params: { selector: '#name', text: 'New text', clearFirst: true }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Screenshot Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });
    });

    it('should capture viewport screenshot when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should capture full page screenshot when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should capture element screenshot when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { selector: 'h1' }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Text Extraction Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withAttributes }
      });
    });

    it('should extract text when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getText');

      const result = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#test-div' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.text).toContain('Element with attributes');
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should get attributes when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getAttribute');

      const result = await browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#test-div', attribute: 'data-value' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.value).toBe('test-attr');
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should get HTML when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getHtml');

      const result = await browserTool.execute({
        operation: 'getHtml',
        params: { selector: '#test-div' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.html).toContain('data-value="test-attr"');
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Scroll/Hover Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withElements }
      });
    });

    it('should scroll to coordinates when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'scroll');

      const result = await browserTool.execute({
        operation: 'scroll',
        params: { x: 0, y: 100 }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should scroll element into view when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'scroll');

      const result = await browserTool.execute({
        operation: 'scroll',
        params: { selector: '#target' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should hover element when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'hover');

      // Navigate to interactive page first
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.interactive }
      });

      const result = await browserTool.execute({
        operation: 'hover',
        params: { selector: '#hover-target' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('JavaScript Evaluation', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.titled }
      });
    });

    it('should evaluate JavaScript successfully with elevated permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.title;' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('Test Title');
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should evaluate DOM queries with permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.querySelector("h1").textContent;' }
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe('Content');
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should evaluate scripts with arguments with permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'evaluate');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'function add(a, b) { return a + b; } return add(args.x, args.y);',
          args: { x: 5, y: 10 }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.result).toBe(15);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Form Submission', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withForm }
      });
    });

    it('should submit forms successfully with elevated permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'submit');

      const result = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#test-form' }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Permission Level Behavior', () => {
    it('should persist allow-always across multiple operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Multiple navigations should all succeed
      const urls = [TEST_PAGES.simple, TEST_PAGES.withButton, TEST_PAGES.withForm];

      for (const url of urls) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url }
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should consume allow-once after first operation', async () => {
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

      // First navigation succeeds
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });
      expect(result1.success).toBe(true);

      // Second navigation should fail (permission consumed)
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withButton }
      });
      expect(result2.success).toBe(false);
      expect(result2.error?.code).toBe('PERMISSION_DENIED');
    });

    it('should handle permission inheritance from parent scopes', async () => {
      // Grant broad browser permission
      await permissionManager.grantPermission('Browser', 'allow-always', '*');

      // All operations should succeed
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });

      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: 'h1' }
      });

      expect(clickResult.success).toBe(true);
      expect(clickResult.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Event Emission Verification', () => {
    it('should emit permission:granted events for successful operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });

      // Verify permission:granted event was emitted
      expect(permissionEvents).toContainEqual(
        expect.objectContaining({
          type: 'granted',
          tool: 'Browser',
          operation: 'navigate',
        })
      );

      // Verify event has required metadata
      const grantedEvent = permissionEvents.find(e => e.type === 'granted');
      expect(grantedEvent).toHaveProperty('timestamp');
      expect(grantedEvent).toHaveProperty('sessionId');
    });

    it('should emit events with accurate metadata', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      // Clear previous events
      permissionEvents.length = 0;

      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });

      await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      // Should have two granted events
      const grantedEvents = permissionEvents.filter(e => e.type === 'granted');
      expect(grantedEvents).toHaveLength(2);

      expect(grantedEvents[0].operation).toBe('navigate');
      expect(grantedEvents[1].operation).toBe('screenshot');
    });

    it('should emit events with correct timing', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const beforeTime = Date.now();

      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });

      const afterTime = Date.now();

      const grantedEvent = permissionEvents.find(e => e.type === 'granted');
      expect(grantedEvent?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(grantedEvent?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Complex Operation Sequences', () => {
    it('should handle multi-step workflow with permissions', async () => {
      // Grant all necessary permissions
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');
      await permissionManager.grantPermission('Browser', 'allow-always', 'getText');

      // Complex workflow: navigate -> fill form -> get text
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.withForm }
      });
      expect(navResult.success).toBe(true);

      const typeResult = await browserTool.execute({
        operation: 'type',
        params: { selector: '#name', text: 'Integration Test User' }
      });
      expect(typeResult.success).toBe(true);

      const textResult = await browserTool.execute({
        operation: 'getText',
        params: { selector: '#name' }
      });
      expect(textResult.success).toBe(true);

      // All should have permission granted
      expect(navResult.metadata?.permissionGranted).toBe(true);
      expect(typeResult.metadata?.permissionGranted).toBe(true);
      expect(textResult.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('waitForSelector Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: TEST_PAGES.simple }
      });
    });

    it('should wait for elements when permission is granted', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'waitForSelector');

      const result = await browserTool.execute({
        operation: 'waitForSelector',
        params: { selector: 'h1', timeout: 5000 }
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });
  });
});