/**
 * Browser Permission Validation Test
 *
 * Simplified test to verify that browser operations check for permissions
 * before executing. This test focuses on the core permission validation
 * mechanism without complex scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Browser Permission Validation', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-browser-permission-test-'));

    // Initialize stores
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      headless: true,
    });
  });

  afterEach(async () => {
    await browserTool?.cleanup();
    await permissionStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Permission Checking', () => {
    it('should check permissions before navigation', async () => {
      // Without any permissions granted
      const result = await browserTool.checkPermission('navigate', 'https://example.com');

      // The permission check should complete and indicate the current permission state
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('requiresConfirmation');
    });

    it('should check permissions before evaluate operations', async () => {
      const result = await browserTool.checkPermission('evaluate', 'document.title');

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('requiresConfirmation');
    });

    it('should check permissions before screenshot operations', async () => {
      const result = await browserTool.checkPermission('screenshot', 'viewport');

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('requiresConfirmation');
    });

    it('should check permissions for sensitive operations', async () => {
      const sensitiveOperations = [
        { operation: 'evaluate', target: 'navigator.clipboard.readText()' },
        { operation: 'evaluate', target: 'navigator.geolocation.getCurrentPosition()' },
        { operation: 'evaluate', target: 'navigator.mediaDevices.getUserMedia()' },
      ];

      for (const { operation, target } of sensitiveOperations) {
        const result = await browserTool.checkPermission(operation as any, target);

        // Should always return a valid permission result
        expect(result).toHaveProperty('allowed');
        expect(typeof result.allowed).toBe('boolean');
        expect(result).toHaveProperty('requiresConfirmation');
        expect(typeof result.requiresConfirmation).toBe('boolean');
      }
    });
  });

  describe('Permission Granting Flow', () => {
    it('should respect granted permissions', async () => {
      // Grant navigation permission
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate');

      const result = await browserTool.checkPermission('navigate', 'https://localhost:3000');

      expect(result.allowed).toBe(true);
      expect(result.level).toBeDefined();
    });

    it('should enforce permission scoping', async () => {
      // Grant scoped permission for localhost only
      await permissionManager.grantPermission('Browser', 'allow-once', 'navigate:localhost');

      const localhostResult = await browserTool.checkPermission('navigate', 'https://localhost:3000');
      const externalResult = await browserTool.checkPermission('navigate', 'https://example.com');

      // Should allow localhost but not external domains
      expect(localhostResult.allowed).toBe(true);
      expect(externalResult.allowed).toBe(false);
    });

    it('should handle permission levels correctly', async () => {
      // Test different permission levels
      await permissionManager.grantPermission('Browser', 'allow-always', 'screenshot');

      const result = await browserTool.checkPermission('screenshot', 'viewport');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });
  });

  describe('Permission Denial Flow', () => {
    it('should properly deny operations without permissions', async () => {
      // Without granting any permissions
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Should be denied due to lack of permissions
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|not.*allowed/i);
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should provide clear denial reasons', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      // Should be denied with clear reason
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);
    });
  });

  describe('Sensitive Operation Validation', () => {
    it('should require explicit permissions for clipboard operations', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'navigator.clipboard.readText()' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|clipboard.*blocked/i);
    });

    it('should require explicit permissions for media device access', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'navigator.mediaDevices.getUserMedia({ video: true })' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|media.*blocked|camera.*denied/i);
    });

    it('should require explicit permissions for geolocation access', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'navigator.geolocation.getCurrentPosition()' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|geolocation.*blocked|location.*denied/i);
    });

    it('should require explicit permissions for file downloads', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const link = document.createElement('a');
            link.href = 'data:text/plain,test';
            link.download = 'test.txt';
            link.click();
          `
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|download.*blocked|file.*access/i);
    });

    it('should require explicit permissions for notifications', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'new Notification("Test notification")' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|notification.*blocked/i);
    });

    it('should require explicit permissions for persistent storage', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'navigator.storage.persist()' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission.*denied|storage.*blocked/i);
    });
  });

  describe('Permission Validation Before Execution', () => {
    it('should validate permissions before any browser operation starts', async () => {
      // This test verifies the core acceptance criteria:
      // "Tests verify that sensitive operations check for and require explicit permissions before executing"

      const sensitiveOperations = [
        {
          operation: 'evaluate',
          params: { script: 'navigator.clipboard.writeText("test")' },
          description: 'clipboard write'
        },
        {
          operation: 'evaluate',
          params: { script: 'navigator.mediaDevices.getUserMedia({ audio: true })' },
          description: 'microphone access'
        },
        {
          operation: 'evaluate',
          params: { script: 'navigator.geolocation.getCurrentPosition()' },
          description: 'geolocation access'
        },
        {
          operation: 'evaluate',
          params: { script: 'Notification.requestPermission()' },
          description: 'notification permission request'
        }
      ];

      // All operations should be blocked due to lack of permissions
      for (const { operation, params, description } of sensitiveOperations) {
        const result = await browserTool.execute({ operation: operation as any, params });

        expect(result.success, `${description} should be blocked without permissions`).toBe(false);
        expect(result.error, `${description} should have permission-related error`).toMatch(/permission/i);
        expect(result.metadata?.permissionGranted, `${description} should show permission not granted`).toBe(false);
      }
    });

    it('should allow operations after granting appropriate permissions', async () => {
      // Grant basic browser permissions
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.grantPermission('Browser', 'allow-once', 'evaluate');

      // Should now be able to navigate and run basic scripts
      const navigateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'data:text/html,<h1>Test Page</h1>' }
      });

      expect(navigateResult.success).toBe(true);
      expect(navigateResult.metadata?.permissionGranted).toBe(true);

      const scriptResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      expect(scriptResult.success).toBe(true);
      expect(scriptResult.metadata?.permissionGranted).toBe(true);
    });
  });
});