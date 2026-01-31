/**
 * Browser Sensitive Operations Permissions Integration Tests
 *
 * This test suite verifies that sensitive browser operations (file downloads, clipboard access,
 * camera/microphone, geolocation, notifications, persistent storage, etc.) check for and require
 * explicit permissions before executing. This ensures compliance with security policies and
 * prevents unauthorized access to sensitive browser APIs.
 *
 * Test Categories:
 * 1. File Download Operations
 * 2. Clipboard Access Operations
 * 3. Camera/Microphone Access
 * 4. Geolocation API Access
 * 5. Notification API Access
 * 6. Persistent Storage Access
 * 7. Cross-origin Resource Access
 * 8. Screen Recording/Capture
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore, PermissionManager, PermissionStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { createTestTask } from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

import type {
  Task,
  BrowserOperation
} from '@apexcli/core';

interface SensitiveOperationTest {
  operation: BrowserOperation;
  params: any;
  requiredPermissions: string[];
  description: string;
  sensitivityLevel: 'high' | 'medium' | 'low';
  userContextRequired?: boolean;
}

describe('Browser Sensitive Operations Permissions Integration', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let testTask: Task;
  let securityEvents: any[] = [];

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-sensitive-browser-test-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool with strict security configuration
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });

    // Set up security event tracking
    securityEvents = [];
    const eventEmitter = new EventEmitter();
    browserTool.setEventEmitter(eventEmitter);

    eventEmitter.on('permission:sensitive-operation-blocked', (event) => {
      securityEvents.push({ type: 'sensitive-operation-blocked', ...event });
    });

    eventEmitter.on('permission:required-before-execution', (event) => {
      securityEvents.push({ type: 'permission-required', ...event });
    });

    eventEmitter.on('permission:elevation-required', (event) => {
      securityEvents.push({ type: 'elevation-required', ...event });
    });
  });

  afterEach(async () => {
    await browserTool?.cleanup();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('File Download Operations', () => {
    const downloadTests: SensitiveOperationTest[] = [
      {
        operation: 'evaluate',
        params: {
          script: `
            const link = document.createElement('a');
            link.href = 'data:text/plain;charset=utf-8,Test File Content';
            link.download = 'test-file.txt';
            document.body.appendChild(link);
            link.click();
          `
        },
        requiredPermissions: ['browser:file-download', 'browser:dom-manipulation'],
        description: 'programmatic file download via data URL',
        sensitivityLevel: 'high'
      },
      {
        operation: 'click',
        params: { selector: 'a[download]' },
        requiredPermissions: ['browser:file-download'],
        description: 'clicking download links',
        sensitivityLevel: 'medium'
      },
      {
        operation: 'evaluate',
        params: {
          script: `
            fetch('/api/export-data')
              .then(response => response.blob())
              .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'data.csv';
                link.click();
              });
          `
        },
        requiredPermissions: ['browser:file-download', 'browser:network-request', 'browser:blob-api'],
        description: 'API data export and download',
        sensitivityLevel: 'high'
      }
    ];

    downloadTests.forEach(test => {
      it(`should require explicit permission before ${test.description}`, async () => {
        // Navigate to a test page first
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

        const navigateResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'http://localhost:3000/test-page' }
        });

        // Attempt sensitive operation without permission
        const result = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        // Should be blocked without proper permissions
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|file.*download.*blocked|elevated.*permission/i);

        // Verify security event was emitted
        expect(securityEvents.some(e =>
          e.type === 'sensitive-operation-blocked' &&
          e.operation === test.operation
        )).toBe(true);

        // Grant required permissions
        for (const permission of test.requiredPermissions) {
          await permissionManager.grantPermission('Browser', 'allow-once', permission);
        }

        // Operation should now succeed
        const retryResult = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        expect(retryResult.success).toBe(true);
      });
    });

    it('should validate file download destination paths', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');
      await permissionManager.grantPermission('Browser', 'allow-once', 'browser:file-download');

      const suspiciousPathTests = [
        '/etc/config',
        'C:\\Windows\\System32\\test',
        '../../../etc/test',
        '~/.ssh/test_file'
      ];

      for (const suspiciousPath of suspiciousPathTests) {
        const result = await browserTool.execute({
          operation: 'evaluate',
          params: {
            script: `
              const link = document.createElement('a');
              link.href = 'data:text/plain,test';
              link.download = '${suspiciousPath}';
              link.click();
            `
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/suspicious.*path|invalid.*destination|security.*policy/i);
      }
    });

    it('should block downloads of executable file types without special permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');
      await permissionManager.grantPermission('Browser', 'allow-once', 'browser:file-download');

      const executableExtensions = ['.exe', '.bat', '.sh', '.scr', '.com', '.cmd', '.pif'];

      for (const ext of executableExtensions) {
        const result = await browserTool.execute({
          operation: 'evaluate',
          params: {
            script: `
              const link = document.createElement('a');
              link.href = 'data:text/plain,test content';
              link.download = 'testfile${ext}';
              link.click();
            `
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/executable.*blocked|dangerous.*file.*type|additional.*permission/i);
      }
    });
  });

  describe('Clipboard Access Operations', () => {
    const clipboardTests: SensitiveOperationTest[] = [
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.clipboard.writeText("test data")'
        },
        requiredPermissions: ['browser:clipboard-write'],
        description: 'writing to clipboard',
        sensitivityLevel: 'high'
      },
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.clipboard.readText()'
        },
        requiredPermissions: ['browser:clipboard-read'],
        description: 'reading from clipboard',
        sensitivityLevel: 'high'
      },
      {
        operation: 'evaluate',
        params: {
          script: `
            navigator.clipboard.write([
              new ClipboardItem({
                'image/png': fetch('/test-image.png').then(r => r.blob())
              })
            ])
          `
        },
        requiredPermissions: ['browser:clipboard-write', 'browser:network-request'],
        description: 'writing image data to clipboard',
        sensitivityLevel: 'high'
      }
    ];

    clipboardTests.forEach(test => {
      it(`should require explicit permission before ${test.description}`, async () => {
        // Navigate to test page with HTTPS for clipboard API
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

        const navigateResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://localhost:3000/test-page' }
        });

        // Attempt clipboard operation without permission
        const result = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|clipboard.*blocked|user.*gesture.*required/i);

        // Grant required permissions
        for (const permission of test.requiredPermissions) {
          await permissionManager.grantPermission('Browser', 'allow-once', permission);
        }

        // Should now have permission (though may still require user gesture in real browser)
        const retryResult = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        // Note: Real browsers require user gesture for clipboard, so we expect either success
        // or a user gesture requirement error, but not a permission denied error
        if (!retryResult.success) {
          expect(retryResult.error).not.toMatch(/permission.*denied/i);
          expect(retryResult.error).toMatch(/user.*gesture|user.*activation/i);
        }
      });
    });
  });

  describe('Camera/Microphone Access Operations', () => {
    const mediaTests: SensitiveOperationTest[] = [
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.mediaDevices.getUserMedia({ video: true })'
        },
        requiredPermissions: ['browser:camera-access'],
        description: 'camera access',
        sensitivityLevel: 'high',
        userContextRequired: true
      },
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.mediaDevices.getUserMedia({ audio: true })'
        },
        requiredPermissions: ['browser:microphone-access'],
        description: 'microphone access',
        sensitivityLevel: 'high',
        userContextRequired: true
      },
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.mediaDevices.getUserMedia({ video: true, audio: true })'
        },
        requiredPermissions: ['browser:camera-access', 'browser:microphone-access'],
        description: 'combined camera and microphone access',
        sensitivityLevel: 'high',
        userContextRequired: true
      },
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.mediaDevices.getDisplayMedia({ video: true })'
        },
        requiredPermissions: ['browser:screen-capture'],
        description: 'screen capture/recording',
        sensitivityLevel: 'high',
        userContextRequired: true
      }
    ];

    mediaTests.forEach(test => {
      it(`should require explicit permission before ${test.description}`, async () => {
        // Navigate to HTTPS test page (required for media APIs)
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

        const navigateResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://localhost:3000/test-page' }
        });

        // Attempt media access without permission
        const result = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|media.*blocked|camera.*denied|microphone.*denied/i);

        // Verify high-severity security event
        expect(securityEvents.some(e =>
          e.type === 'sensitive-operation-blocked' &&
          e.sensitivityLevel === 'high' &&
          (e.operation === 'camera-access' || e.operation === 'microphone-access' || e.operation === 'screen-capture')
        )).toBe(true);

        // Grant required permissions
        for (const permission of test.requiredPermissions) {
          await permissionManager.grantPermission('Browser', 'allow-once', permission);
        }

        // Should require user context/confirmation for media operations
        if (test.userContextRequired) {
          const retryResult = await browserTool.execute({
            operation: test.operation,
            params: test.params
          });

          if (!retryResult.success) {
            expect(retryResult.error).toMatch(/user.*context|user.*gesture|browser.*permission/i);
          }
        }
      });
    });

    it('should block media access in background contexts', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');
      await permissionManager.grantPermission('Browser', 'allow-once', 'browser:camera-access');

      // Simulate background context (no user interaction)
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            // Attempt to access camera in background without user gesture
            setTimeout(() => {
              navigator.mediaDevices.getUserMedia({ video: true });
            }, 5000);
          `
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/background.*context|user.*gesture.*required|active.*context/i);
    });

    it('should enforce camera/microphone usage time limits', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');
      await permissionManager.grantPermission('Browser', 'allow-once', 'browser:camera-access');

      // Configure time-limited permission
      await permissionManager.configureTemporaryPermission('browser:camera-access', {
        duration: 60000, // 1 minute
        autoRevoke: true
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            navigator.mediaDevices.getUserMedia({ video: true })
              .then(stream => {
                // Keep stream active for longer than allowed
                setTimeout(() => {
                  // This should be automatically stopped
                  return stream.active;
                }, 65000);
              });
          `
        }
      });

      // Should enforce time limits even after initial permission grant
      expect(securityEvents.some(e =>
        e.type === 'permission-expired' ||
        e.type === 'automatic-revocation'
      )).toBe(true);
    });
  });

  describe('Geolocation API Access Operations', () => {
    const locationTests: SensitiveOperationTest[] = [
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.geolocation.getCurrentPosition(pos => pos)'
        },
        requiredPermissions: ['browser:geolocation-access'],
        description: 'current position access',
        sensitivityLevel: 'high'
      },
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.geolocation.watchPosition(pos => pos)'
        },
        requiredPermissions: ['browser:geolocation-access', 'browser:geolocation-watch'],
        description: 'continuous position tracking',
        sensitivityLevel: 'high'
      },
      {
        operation: 'evaluate',
        params: {
          script: `
            navigator.geolocation.getCurrentPosition(
              pos => fetch('/api/track-location', {
                method: 'POST',
                body: JSON.stringify(pos.coords)
              })
            )
          `
        },
        requiredPermissions: ['browser:geolocation-access', 'browser:network-request'],
        description: 'location tracking with network transmission',
        sensitivityLevel: 'high'
      }
    ];

    locationTests.forEach(test => {
      it(`should require explicit permission before ${test.description}`, async () => {
        // Navigate to HTTPS test page (required for geolocation)
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

        const navigateResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://localhost:3000/test-page' }
        });

        // Attempt geolocation access without permission
        const result = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|geolocation.*blocked|location.*access.*denied/i);

        // Verify security event for location access attempt
        expect(securityEvents.some(e =>
          e.type === 'sensitive-operation-blocked' &&
          e.operation?.includes('geolocation')
        )).toBe(true);

        // Grant required permissions
        for (const permission of test.requiredPermissions) {
          await permissionManager.grantPermission('Browser', 'allow-once', permission);
        }

        // Location access typically still requires browser-level user permission
        const retryResult = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        if (!retryResult.success) {
          expect(retryResult.error).toMatch(/browser.*permission|user.*denied|location.*unavailable/i);
        }
      });
    });
  });

  describe('Notification API Access Operations', () => {
    const notificationTests: SensitiveOperationTest[] = [
      {
        operation: 'evaluate',
        params: {
          script: 'Notification.requestPermission()'
        },
        requiredPermissions: ['browser:notification-request'],
        description: 'notification permission request',
        sensitivityLevel: 'medium'
      },
      {
        operation: 'evaluate',
        params: {
          script: 'new Notification("Test notification", { body: "Hello" })'
        },
        requiredPermissions: ['browser:notification-display'],
        description: 'displaying notifications',
        sensitivityLevel: 'medium'
      }
    ];

    notificationTests.forEach(test => {
      it(`should require explicit permission before ${test.description}`, async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

        const navigateResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://localhost:3000/test-page' }
        });

        // Attempt notification operation without permission
        const result = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|notification.*blocked|user.*permission.*required/i);

        // Grant required permissions
        for (const permission of test.requiredPermissions) {
          await permissionManager.grantPermission('Browser', 'allow-once', permission);
        }

        const retryResult = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        // Notifications typically require browser-level permission
        if (!retryResult.success) {
          expect(retryResult.error).toMatch(/browser.*permission|user.*denied/i);
        }
      });
    });
  });

  describe('Persistent Storage Access Operations', () => {
    const storageTests: SensitiveOperationTest[] = [
      {
        operation: 'evaluate',
        params: {
          script: 'navigator.storage.persist()'
        },
        requiredPermissions: ['browser:persistent-storage'],
        description: 'requesting persistent storage',
        sensitivityLevel: 'medium'
      },
      {
        operation: 'evaluate',
        params: {
          script: `
            const request = indexedDB.open('test-db', 1);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['data'], 'readwrite');
              const store = transaction.objectStore('data');
              store.add({ id: 1, data: 'test-content' });
            };
          `
        },
        requiredPermissions: ['browser:indexeddb-write'],
        description: 'storing data in IndexedDB',
        sensitivityLevel: 'medium'
      },
      {
        operation: 'evaluate',
        params: {
          script: `
            caches.open('v1').then(cache => {
              cache.add('/api/test-data');
            });
          `
        },
        requiredPermissions: ['browser:cache-api', 'browser:network-request'],
        description: 'caching resources',
        sensitivityLevel: 'medium'
      }
    ];

    storageTests.forEach(test => {
      it(`should require explicit permission before ${test.description}`, async () => {
        await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

        const navigateResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://localhost:3000/test-page' }
        });

        // Attempt storage operation without permission
        const result = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/permission.*denied|storage.*blocked|quota.*exceeded|user.*permission/i);

        // Grant required permissions
        for (const permission of test.requiredPermissions) {
          await permissionManager.grantPermission('Browser', 'allow-once', permission);
        }

        const retryResult = await browserTool.execute({
          operation: test.operation,
          params: test.params
        });

        if (retryResult.success) {
          expect(retryResult.metadata?.permissionGranted).toBe(true);
        }
      });
    });

    it('should enforce storage quotas', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');
      await permissionManager.grantPermission('Browser', 'allow-once', 'browser:indexeddb-write');

      // Configure storage quota limits
      await permissionManager.configureResourceLimits('browser:storage', {
        maxSizeBytes: 1024 * 1024, // 1MB limit
        maxEntries: 1000
      });

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB of data
            localStorage.setItem('large-item', largeData);
          `
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/quota.*exceeded|storage.*limit|size.*limit.*exceeded/i);
    });
  });

  describe('Cross-Origin Resource Access', () => {
    it('should block cross-origin requests without explicit permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

      const navigateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://localhost:3000/test-page' }
      });

      const crossOriginRequests = [
        'https://api.external.com/data',
        'http://test.example.com/api',
        'https://analytics.example.net/collect'
      ];

      for (const url of crossOriginRequests) {
        const result = await browserTool.execute({
          operation: 'evaluate',
          params: {
            script: `fetch('${url}')`
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/cross.*origin|cors.*blocked|external.*request.*denied/i);
      }
    });

    it('should allow trusted cross-origin requests with permission', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');
      await permissionManager.grantPermission('Browser', 'allow-once', 'browser:cors-request:api.trusted.com');

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'fetch("https://api.trusted.com/public/data")'
        }
      });

      // Should succeed with explicit permission for trusted domain
      expect(result.success).toBe(true);
    });
  });

  describe('Audit and Compliance Tracking', () => {
    it('should maintain comprehensive audit trail for all sensitive operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

      // Attempt various sensitive operations to generate audit events
      const sensitiveOperations = [
        { operation: 'evaluate', params: { script: 'navigator.clipboard.readText()' }},
        { operation: 'evaluate', params: { script: 'navigator.geolocation.getCurrentPosition()' }},
        { operation: 'evaluate', params: { script: 'navigator.mediaDevices.getUserMedia({ video: true })' }},
        { operation: 'evaluate', params: { script: 'new Notification("test")' }},
        { operation: 'evaluate', params: { script: 'navigator.storage.persist()' }}
      ];

      for (const op of sensitiveOperations) {
        await browserTool.execute(op as any);
      }

      // Verify comprehensive audit trail
      expect(securityEvents.length).toBeGreaterThan(0);

      const auditTrail = securityEvents.map(event => ({
        timestamp: event.timestamp,
        operation: event.operation,
        sensitivityLevel: event.sensitivityLevel,
        decision: event.decision,
        requiredPermissions: event.requiredPermissions
      }));

      // Validate audit completeness
      expect(auditTrail.length).toBe(sensitiveOperations.length);

      auditTrail.forEach(entry => {
        expect(entry.timestamp).toBeDefined();
        expect(entry.operation).toBeDefined();
        expect(entry.sensitivityLevel).toMatch(/high|medium|low/);
        expect(entry.decision).toMatch(/blocked|allowed|requires-permission/);
        expect(entry.requiredPermissions).toBeDefined();
      });
    });

    it('should generate security compliance report for sensitive operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:localhost');

      // Simulate various permission scenarios
      const testScenarios = [
        // Blocked operations
        { op: 'clipboard-read', shouldBlock: true },
        { op: 'camera-access', shouldBlock: true },
        { op: 'geolocation', shouldBlock: true },
        // Allowed operations
        { op: 'screenshot', shouldBlock: false },
        { op: 'getText', shouldBlock: false }
      ];

      for (const scenario of testScenarios) {
        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script: `console.log('test-${scenario.op}')` }
        });
      }

      const complianceReport = {
        totalSensitiveOperations: securityEvents.filter(e => e.sensitivityLevel).length,
        highSensitivityBlocked: securityEvents.filter(e =>
          e.sensitivityLevel === 'high' && e.decision === 'blocked'
        ).length,
        mediumSensitivityBlocked: securityEvents.filter(e =>
          e.sensitivityLevel === 'medium' && e.decision === 'blocked'
        ).length,
        permissionEscalationRequests: securityEvents.filter(e =>
          e.type === 'elevation-required'
        ).length,
        auditTrailComplete: securityEvents.length > 0
      };

      expect(complianceReport).toMatchObject({
        totalSensitiveOperations: expect.any(Number),
        highSensitivityBlocked: expect.any(Number),
        mediumSensitivityBlocked: expect.any(Number),
        permissionEscalationRequests: expect.any(Number),
        auditTrailComplete: true
      });

      // High sensitivity operations should be blocked by default
      expect(complianceReport.highSensitivityBlocked).toBeGreaterThan(0);
    });
  });
});