/**
 * Browser Common Operations Permission Tests
 *
 * This test suite specifically focuses on the common browser operations
 * mentioned in the acceptance criteria: navigation, clicking, form filling, etc.
 * Tests verify that these core operations succeed when appropriate permissions
 * are granted and fail appropriately when permissions are denied.
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
} from '@apexcli/core';

describe('Browser Common Operations - Permission Verification', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-common-ops-'));

    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      eventEmitter,
      taskId: testTask.id,
    });

    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['example.com', 'testsite.local', 'webapp.test'],
      blockedDomains: [],
    });

    // Mock browser implementation for common operations
    vi.spyOn(browserTool as any, 'ensurePage').mockResolvedValue({
      backend: 'playwright',
      page: {
        url: () => 'https://example.com',
        title: () => Promise.resolve('Test Application'),
        goto: vi.fn().mockResolvedValue({ status: () => 200 }),
        click: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('test-screenshot-data')),
        evaluate: vi.fn().mockResolvedValue('test result'),
        locator: vi.fn().mockReturnValue({
          evaluate: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        }),
        waitForSelector: vi.fn().mockResolvedValue(true),
        getAttribute: vi.fn().mockResolvedValue('test-value'),
        textContent: vi.fn().mockResolvedValue('Sample text content'),
        innerHTML: vi.fn().mockResolvedValue('<div>Sample HTML</div>'),
        content: vi.fn().mockResolvedValue('<!DOCTYPE html><html><body>Sample page</body></html>'),
        hover: vi.fn().mockResolvedValue(undefined),
        viewportSize: () => ({ width: 1280, height: 720 }),
      },
    });
  });

  afterEach(async () => {
    await browserTool?.cleanup();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    eventEmitter.removeAllListeners();
  });

  describe('Navigation Operations', () => {
    it('should allow page navigation with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://example.com',
          waitUntil: 'load',
        },
      } as any);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.data).toEqual({
        url: 'https://example.com',
        status: 200,
      });
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.metadata?.url).toBe('https://example.com');
    });

    it('should allow navigation to different pages in workflow', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');

      const pages = [
        'https://example.com',
        'https://example.com/login',
        'https://example.com/dashboard',
        'https://example.com/profile',
      ];

      for (const url of pages) {
        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url },
        } as any);

        expect(result.success).toBe(true);
        expect(result.data?.url).toBe(url);
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should deny navigation without proper permissions', async () => {
      // No permissions granted
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);
      expect(result.metadata?.permissionGranted).toBe(false);
    });
  });

  describe('Clicking Operations', () => {
    beforeEach(async () => {
      // Navigate to page first
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
    });

    it('should allow clicking elements with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');

      const clickTargets = [
        '#login-button',
        '.menu-item',
        '[data-action="submit"]',
        'button[type="submit"]',
      ];

      for (const selector of clickTargets) {
        const result = await browserTool.execute({
          operation: 'click',
          params: { selector },
        } as any);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('click');
        expect(result.data).toEqual({ clicked: selector });
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should allow clicking with different button types', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'click');

      const clickOptions = [
        { selector: '#button1', button: 'left' as const },
        { selector: '#button2', button: 'right' as const },
        { selector: '#button3', button: 'middle' as const },
      ];

      for (const options of clickOptions) {
        const result = await browserTool.execute({
          operation: 'click',
          params: options,
        } as any);

        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should deny clicking without proper permissions', async () => {
      // No click permission granted
      const result = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);
      expect(result.metadata?.permissionGranted).toBe(false);
    });
  });

  describe('Form Filling Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/form' },
      } as any);
    });

    it('should allow form filling with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');

      const formFields = [
        { selector: '#username', text: 'testuser' },
        { selector: '#email', text: 'test@example.com' },
        { selector: '#password', text: 'securepassword' },
        { selector: 'textarea[name="comments"]', text: 'This is a test comment' },
      ];

      for (const field of formFields) {
        const result = await browserTool.execute({
          operation: 'type',
          params: field,
        } as any);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('type');
        expect(result.data).toEqual({
          typed: field.text,
          into: field.selector,
        });
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should allow form filling with advanced options', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');

      const result = await browserTool.execute({
        operation: 'type',
        params: {
          selector: '#search-input',
          text: 'search query',
          delay: 50,
          clearFirst: true,
        },
      } as any);

      expect(result.success).toBe(true);
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should allow form submission with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'submit');

      const result = await browserTool.execute({
        operation: 'submit',
        params: {
          selector: '#registration-form',
          validate: true,
        },
      } as any);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('submit');
      expect(result.data).toEqual({ submitted: '#registration-form' });
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should deny form operations without proper permissions', async () => {
      // No type permission granted
      const typeResult = await browserTool.execute({
        operation: 'type',
        params: { selector: '#input', text: 'test' },
      } as any);

      expect(typeResult.success).toBe(false);
      expect(typeResult.error).toMatch(/permission.*denied/i);

      // No submit permission granted
      const submitResult = await browserTool.execute({
        operation: 'submit',
        params: { selector: '#form' },
      } as any);

      expect(submitResult.success).toBe(false);
      expect(submitResult.error).toMatch(/permission.*denied/i);
    });
  });

  describe('Content Extraction Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
    });

    it('should allow text extraction with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getText');

      const textSelectors = [
        'h1',
        '.title',
        '#main-content',
        '[data-testid="description"]',
      ];

      for (const selector of textSelectors) {
        const result = await browserTool.execute({
          operation: 'getText',
          params: { selector },
        } as any);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('getText');
        expect(result.data).toEqual({ text: 'Sample text content' });
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should allow attribute extraction with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getAttribute');

      const attributeQueries = [
        { selector: '#link', attribute: 'href' },
        { selector: 'img', attribute: 'src' },
        { selector: 'input', attribute: 'value' },
        { selector: '.container', attribute: 'class' },
      ];

      for (const query of attributeQueries) {
        const result = await browserTool.execute({
          operation: 'getAttribute',
          params: query,
        } as any);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('getAttribute');
        expect(result.data).toEqual({
          attribute: query.attribute,
          value: 'test-value',
        });
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should allow HTML extraction with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'getHtml');

      // Extract element HTML
      const elementResult = await browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.content' },
      } as any);

      expect(elementResult.success).toBe(true);
      expect(elementResult.data).toEqual({ html: '<div>Sample HTML</div>' });

      // Extract full page HTML
      const pageResult = await browserTool.execute({
        operation: 'getHtml',
        params: {},
      } as any);

      expect(pageResult.success).toBe(true);
      expect(pageResult.data?.html).toContain('<!DOCTYPE html>');
      expect(pageResult.metadata?.permissionGranted).toBe(true);
    });

    it('should deny content extraction without proper permissions', async () => {
      // No content extraction permissions
      const operations = [
        { operation: 'getText', params: { selector: 'h1' } },
        { operation: 'getAttribute', params: { selector: 'a', attribute: 'href' } },
        { operation: 'getHtml', params: { selector: 'div' } },
      ];

      for (const op of operations) {
        const result = await browserTool.execute(op as any);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied/i);
        expect(result.metadata?.permissionGranted).toBe(false);
      }
    });
  });

  describe('Screenshot and Visual Operations', () => {
    beforeEach(async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' },
      } as any);
    });

    it('should allow screenshots with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const screenshotOptions = [
        { fullPage: false },
        { fullPage: true },
        { format: 'png' as const },
        { format: 'jpeg' as const, quality: 80 },
      ];

      for (const options of screenshotOptions) {
        const result = await browserTool.execute({
          operation: 'screenshot',
          params: options,
        } as any);

        expect(result.success).toBe(true);
        expect(result.operation).toBe('screenshot');
        expect(result.screenshot).toBeDefined();
        expect(result.data).toMatchObject({
          width: 1280,
          height: 720,
          format: options.format || 'png',
        });
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });

    it('should allow element screenshots with granted permissions', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: {
          selector: '#main-content',
          format: 'png' as const,
        },
      } as any);

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(result.metadata?.permissionGranted).toBe(true);
    });

    it('should deny screenshots without proper permissions', async () => {
      // No screenshot permission
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: false },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied/i);
      expect(result.metadata?.permissionGranted).toBe(false);
    });
  });

  describe('Complete User Workflow Example', () => {
    it('should execute a complete user workflow with proper permissions', async () => {
      // Grant all necessary permissions for a complete workflow
      await permissionManager.grantPermission('Browser', 'allow-always');

      const workflow = [
        // 1. Navigate to application
        {
          operation: 'navigate',
          params: { url: 'https://example.com/app' },
          expect: { success: true, operation: 'navigate' }
        },
        // 2. Click login button
        {
          operation: 'click',
          params: { selector: '#login-btn' },
          expect: { success: true, operation: 'click' }
        },
        // 3. Fill username field
        {
          operation: 'type',
          params: { selector: '#username', text: 'testuser', clearFirst: true },
          expect: { success: true, operation: 'type' }
        },
        // 4. Fill password field
        {
          operation: 'type',
          params: { selector: '#password', text: 'password123' },
          expect: { success: true, operation: 'type' }
        },
        // 5. Submit login form
        {
          operation: 'submit',
          params: { selector: '#login-form', validate: true },
          expect: { success: true, operation: 'submit' }
        },
        // 6. Wait for dashboard to load
        {
          operation: 'waitForSelector',
          params: { selector: '.dashboard', timeout: 5000, visible: true },
          expect: { success: true, operation: 'waitForSelector' }
        },
        // 7. Take screenshot of dashboard
        {
          operation: 'screenshot',
          params: { fullPage: false },
          expect: { success: true, operation: 'screenshot' }
        },
        // 8. Extract user info
        {
          operation: 'getText',
          params: { selector: '.user-profile .name' },
          expect: { success: true, operation: 'getText' }
        },
        // 9. Navigate to settings
        {
          operation: 'navigate',
          params: { url: 'https://example.com/app/settings' },
          expect: { success: true, operation: 'navigate' }
        },
        // 10. Hover over help tooltip
        {
          operation: 'hover',
          params: { selector: '.help-icon' },
          expect: { success: true, operation: 'hover' }
        }
      ];

      const results = [];

      for (const [index, step] of workflow.entries()) {
        const result = await browserTool.execute(step as any);
        results.push(result);

        // Verify each step succeeds
        expect(result.success).toBe(step.expect.success);
        expect(result.operation).toBe(step.expect.operation);
        expect(result.metadata?.permissionGranted).toBe(true);

        console.log(`✅ Step ${index + 1}: ${step.operation} completed successfully`);
      }

      // Verify complete workflow executed successfully
      expect(results).toHaveLength(workflow.length);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.metadata?.permissionGranted)).toBe(true);

      console.log(`🎉 Complete workflow executed successfully with ${results.length} steps`);
    });

    it('should handle partial workflow failure with mixed permissions', async () => {
      // Grant only some permissions
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-once', 'click');
      await permissionManager.grantPermission('Browser', 'allow-always', 'type');
      // Note: No submit permission granted

      const workflow = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button1' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'click', params: { selector: '#button2' } }, // Should fail (allow-once consumed)
        { operation: 'submit', params: { selector: '#form' } }, // Should fail (no permission)
      ];

      const results = [];

      for (const step of workflow) {
        const result = await browserTool.execute(step as any);
        results.push(result);
      }

      // Verify expected results
      expect(results[0].success).toBe(true); // navigate - should succeed
      expect(results[1].success).toBe(true); // click - should succeed (first use)
      expect(results[2].success).toBe(true); // type - should succeed
      expect(results[3].success).toBe(false); // click - should fail (allow-once consumed)
      expect(results[4].success).toBe(false); // submit - should fail (no permission)

      // Verify successful operations have permission granted
      expect(results[0].metadata?.permissionGranted).toBe(true);
      expect(results[1].metadata?.permissionGranted).toBe(true);
      expect(results[2].metadata?.permissionGranted).toBe(true);

      // Verify failed operations show permission denied
      expect(results[3].metadata?.permissionGranted).toBe(false);
      expect(results[4].metadata?.permissionGranted).toBe(false);
    });
  });
});