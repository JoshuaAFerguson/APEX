/**
 * Integration test suite for APEX Systems Integration
 *
 * This test file validates the interaction between the three core systems:
 * 1. Tools System ↔ Permissions System
 * 2. Browser Automation ↔ Permissions System
 * 3. Tools System ↔ Browser Automation ↔ Permissions System
 * 4. MCP Integration ↔ Permissions System
 * 5. Event flow and system coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BrowserTool, BrowserToolConfig } from '../tools/browser-tool';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { ApexOrchestrator } from '../index';
import { EventEmitter } from 'eventemitter3';
import {
  Permission,
  PermissionLevel,
  ToolPermissionResult,
  DirectoryAccessConfig,
  ApexConfig
} from '@apexcli/core';

// Mock browser dependencies
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(mockPage)),
        on: vi.fn()
      }))
    }))
  }
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => Buffer.from('mock-baseline')),
  writeFileSync: vi.fn()
}));

vi.mock('pixelmatch', () => ({
  default: vi.fn(() => 0) // Perfect match by default
}));

vi.mock('pngjs', () => ({
  PNG: {
    sync: {
      read: vi.fn(() => ({
        width: 1920,
        height: 1080,
        data: new Buffer(1920 * 1080 * 4)
      })),
      write: vi.fn(() => Buffer.from('mock-diff'))
    }
  }
}));

// Mock page object
const mockPage = {
  url: vi.fn(() => 'https://test-integration.com'),
  title: vi.fn(() => Promise.resolve('Integration Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('screenshot-data'))),
  evaluate: vi.fn(() => Promise.resolve('evaluation-result')),
  on: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 }))
};

describe('APEX Systems Integration', () => {
  let orchestrator: ApexOrchestrator;
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let eventEmitter: EventEmitter;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    // Create mock permission store
    permissionStore = {
      getPermission: vi.fn(),
      savePermission: vi.fn(),
      clearPermission: vi.fn(),
      getExtendedPermission: vi.fn(),
      getAllPermissions: vi.fn(),
      clearAllPermissions: vi.fn()
    } as any;

    // Create permission manager
    permissionManager = new PermissionManager(permissionStore);

    // Create event emitter
    eventEmitter = new EventEmitter();

    // Create browser tool with permission integration
    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      engine: 'chromium',
      headless: true
    });

    // Mock APEX config
    mockConfig = {
      permissions: {
        preset: 'reviewAll' as const,
        persistence: true
      },
      tools: {
        browser: {
          enabled: true,
          allowedDomains: ['test.com', 'trusted.org'],
          blockedDomains: ['malicious.com'],
          allowScreenshots: true,
          allowJavaScriptExecution: false
        }
      }
    } as ApexConfig;

    // Create orchestrator (partial mock for integration testing)
    orchestrator = {
      permissionManager,
      eventEmitter,
      tools: {
        browser: browserTool
      },
      config: mockConfig
    } as any;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tools ↔ Permissions Integration', () => {
    describe('Permission-Gated Tool Execution', () => {
      it('should require permissions before executing browser operations', async () => {
        // Mock permission check to initially deny
        const mockCheckToolPermission = vi.fn()
          .mockResolvedValueOnce({
            allowed: false,
            denialReason: 'Permission required',
            requiresConfirmation: true
          })
          .mockResolvedValueOnce({
            allowed: true,
            level: 'allow-once',
            requiresConfirmation: false
          });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // First attempt should be denied
        const firstResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://test.com' }
        });

        expect(firstResult.success).toBe(false);
        expect(firstResult.error).toBe('Permission required');

        // Grant permission and try again
        await permissionManager.grantPermission('Browser', 'navigate:https://test.com', 'allow-once');

        const secondResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://test.com' }
        });

        expect(secondResult.success).toBe(true);
        expect(secondResult.metadata?.permissionLevel).toBe('allow-once');
      });

      it('should consume allow-once permissions correctly', async () => {
        // Grant an allow-once permission
        await permissionManager.grantPermission('Browser', 'screenshot:viewport', 'allow-once');

        const mockCheckToolPermission = vi.fn()
          .mockResolvedValueOnce({
            allowed: true,
            level: 'allow-once',
            requiresConfirmation: false
          })
          .mockResolvedValueOnce({
            allowed: false,
            denialReason: 'Permission consumed',
            requiresConfirmation: false
          });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // First screenshot should succeed and consume the permission
        const firstResult = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: false }
        });

        expect(firstResult.success).toBe(true);

        // Second screenshot should be denied
        const secondResult = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: false }
        });

        expect(secondResult.success).toBe(false);
        expect(secondResult.error).toBe('Permission consumed');
      });

      it('should respect persistent allow-always permissions', async () => {
        // Mock persistent permission
        const mockPermission: Permission = {
          tool: 'Browser',
          scope: 'click',
          level: 'allow-always',
          createdAt: new Date()
        };

        (permissionStore.getPermission as Mock).mockResolvedValue(mockPermission);

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Multiple operations should all succeed
        const operations = [
          { operation: 'click' as const, params: { selector: '#btn1' } },
          { operation: 'click' as const, params: { selector: '#btn2' } },
          { operation: 'click' as const, params: { selector: '#btn3' } }
        ];

        for (const op of operations) {
          const result = await browserTool.execute(op);
          expect(result.success).toBe(true);
          expect(result.metadata?.permissionLevel).toBe('allow-always');
        }
      });
    });

    describe('Configuration-Based Restrictions', () => {
      it('should integrate tool configuration with permission system', async () => {
        // Mock tool configuration
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowedDomains: ['trusted.com'],
          blockedDomains: ['malicious.com'],
          allowJavaScriptExecution: false
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Blocked domain should be rejected by configuration
        const blockedResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://malicious.com/evil' }
        });

        expect(blockedResult.success).toBe(false);
        expect(blockedResult.error).toBe('Domain malicious.com is blocked');

        // Disallowed operation should be rejected
        const evalResult = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'alert("blocked")' }
        });

        expect(evalResult.success).toBe(false);
        expect(evalResult.error).toBe('JavaScript execution is disabled');

        // Allowed domain and operation should succeed
        const allowedResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://trusted.com' }
        });

        expect(allowedResult.success).toBe(true);
      });

      it('should handle session-level configuration overrides', async () => {
        // Set session-level override
        permissionManager.setToolConfig('Browser', {
          enabled: true,
          allowJavaScriptExecution: true // Override default restriction
        });

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // JavaScript should now be allowed due to session override
        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'return "allowed in session"' }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: 'evaluation-result' });
      });
    });
  });

  describe('Browser Automation ↔ Permissions Integration', () => {
    describe('Domain-Based Access Control', () => {
      it('should enforce domain restrictions through permission system', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowedDomains: ['safe.org', 'trusted.com'],
          blockedDomains: []
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Test allowed domain
        const allowedResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://safe.org/page' }
        });

        expect(allowedResult.success).toBe(true);

        // Test disallowed domain
        const disallowedResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://untrusted.net/page' }
        });

        expect(disallowedResult.success).toBe(false);
        expect(disallowedResult.error).toContain('Domain untrusted.net is not in allowlist');
      });

      it('should integrate domain checks with permission scoping', async () => {
        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-once',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowedDomains: ['example.com']
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://example.com/test' }
        });

        // Verify permission was checked with proper scope including domain
        expect(mockCheckToolPermission).toHaveBeenCalledWith('Browser', {
          scope: 'navigate:https://example.com/test',
          consumeAllowOnce: true
        });
      });
    });

    describe('Operation-Specific Permissions', () => {
      it('should handle dangerous operations with elevated permission requirements', async () => {
        let permissionLevel: PermissionLevel | null = null;

        const mockCheckToolPermission = vi.fn().mockImplementation(() => ({
          allowed: permissionLevel === 'allow-always',
          level: permissionLevel,
          denialReason: permissionLevel ? undefined : 'Dangerous operation requires explicit permission',
          requiresConfirmation: false
        }));

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // First attempt without explicit permission should fail
        const deniedResult = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'window.location = "https://malicious.com"' }
        });

        expect(deniedResult.success).toBe(false);
        expect(deniedResult.error).toContain('Dangerous operation requires explicit permission');

        // Grant explicit permission
        permissionLevel = 'allow-always';

        const allowedResult = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'return "now allowed"' }
        });

        expect(allowedResult.success).toBe(true);
        expect(allowedResult.data).toEqual({ result: 'evaluation-result' });
      });

      it('should scope permissions by operation and target', async () => {
        const permissionScopes = new Set<string>();

        const mockCheckToolPermission = vi.fn().mockImplementation((tool: string, options: any) => {
          permissionScopes.add(options.scope);
          return Promise.resolve({
            allowed: true,
            level: 'allow-always',
            requiresConfirmation: false
          });
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Execute different operations
        await browserTool.execute({
          operation: 'click',
          params: { selector: '#submit-button' }
        });

        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://form-handler.com' }
        });

        await browserTool.execute({
          operation: 'screenshot',
          params: { selector: '.result-area' }
        });

        // Verify different scopes were created
        expect(permissionScopes.has('click:#submit-button')).toBe(true);
        expect(permissionScopes.has('navigate:https://form-handler.com')).toBe(true);
        expect(permissionScopes.has('screenshot:.result-area')).toBe(true);
      });
    });
  });

  describe('Visual Regression Testing Integration', () => {
    describe('Permission-Controlled Visual Testing', () => {
      it('should require screenshot permissions for visual regression tests', async () => {
        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowScreenshots: false
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/test.png',
            testId: 'permission-test'
          }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Screenshots are disabled');
      });

      it('should emit visual comparison events through permission-controlled operations', async () => {
        const visualEvents: any[] = [];

        eventEmitter.on('visual:comparison:passed', (data) => visualEvents.push({ type: 'passed', data }));
        eventEmitter.on('visual:comparison:failed', (data) => visualEvents.push({ type: 'failed', data }));

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowScreenshots: true
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        // Perfect match (0 different pixels)
        const pixelmatch = require('pixelmatch').default;
        pixelmatch.mockReturnValue(0);

        const result = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/perfect-match.png',
            testId: 'integration-visual-test',
            threshold: 0.01
          }
        });

        expect(result.success).toBe(true);
        expect(visualEvents.length).toBe(1);
        expect(visualEvents[0].type).toBe('passed');
        expect(visualEvents[0].data).toMatchObject({
          testId: 'integration-visual-test',
          passed: true,
          pageUrl: 'https://test-integration.com'
        });
      });
    });
  });

  describe('Event Flow and System Coordination', () => {
    describe('Cross-System Event Propagation', () => {
      it('should coordinate events between permission system and browser automation', async () => {
        const systemEvents: any[] = [];

        // Listen to various system events
        eventEmitter.on('permission:granted', (data) => systemEvents.push({ type: 'permission:granted', data }));
        eventEmitter.on('browser:operation:start', (data) => systemEvents.push({ type: 'browser:operation:start', data }));
        eventEmitter.on('browser:operation:complete', (data) => systemEvents.push({ type: 'browser:operation:complete', data }));

        // Mock permission events (would be emitted by real permission manager)
        const mockCheckToolPermission = vi.fn().mockImplementation((tool, options) => {
          // Simulate permission grant event
          eventEmitter.emit('permission:granted', {
            tool,
            scope: options.scope,
            level: 'allow-once'
          });

          return Promise.resolve({
            allowed: true,
            level: 'allow-once',
            requiresConfirmation: false
          });
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Execute browser operation
        await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://event-test.com' }
        });

        // Verify permission event was emitted
        const permissionEvents = systemEvents.filter(e => e.type === 'permission:granted');
        expect(permissionEvents.length).toBe(1);
        expect(permissionEvents[0].data).toMatchObject({
          tool: 'Browser',
          scope: 'navigate:https://event-test.com',
          level: 'allow-once'
        });
      });

      it('should handle permission denial events', async () => {
        const denialEvents: any[] = [];

        eventEmitter.on('permission:denied', (data) => denialEvents.push(data));

        const mockCheckToolPermission = vi.fn().mockImplementation(() => {
          // Simulate permission denial event
          eventEmitter.emit('permission:denied', {
            tool: 'Browser',
            scope: 'evaluate:dangerous-script',
            reason: 'Dangerous operation blocked'
          });

          return Promise.resolve({
            allowed: false,
            denialReason: 'Dangerous operation blocked',
            requiresConfirmation: false
          });
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const result = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'dangerous script' }
        });

        expect(result.success).toBe(false);
        expect(denialEvents.length).toBe(1);
        expect(denialEvents[0]).toMatchObject({
          tool: 'Browser',
          scope: 'evaluate:dangerous-script',
          reason: 'Dangerous operation blocked'
        });
      });
    });
  });

  describe('End-to-End Workflow Integration', () => {
    describe('Complete Web Automation Workflow', () => {
      it('should execute a complete permission-controlled browser workflow', async () => {
        const workflowEvents: any[] = [];

        // Track all events
        eventEmitter.on('permission:granted', (data) => workflowEvents.push({ type: 'permission', action: 'granted', ...data }));
        eventEmitter.on('visual:comparison:passed', (data) => workflowEvents.push({ type: 'visual', action: 'passed', ...data }));

        // Grant necessary permissions
        await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
        await permissionManager.grantPermission('Browser', 'click', 'allow-always');
        await permissionManager.grantPermission('Browser', 'screenshot', 'allow-always');
        await permissionManager.grantPermission('Browser', 'compareScreenshot', 'allow-always');

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const mockGetToolConfig = vi.fn().mockResolvedValue({
          enabled: true,
          allowScreenshots: true,
          allowedDomains: ['workflow-test.com']
        } as BrowserToolConfig);

        permissionManager.getToolConfig = mockGetToolConfig;

        // Step 1: Navigate to page
        const navResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://workflow-test.com/form' }
        });

        expect(navResult.success).toBe(true);

        // Step 2: Interact with page
        const clickResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#submit-form' }
        });

        expect(clickResult.success).toBe(true);

        // Step 3: Take screenshot
        const screenshotResult = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        });

        expect(screenshotResult.success).toBe(true);

        // Step 4: Visual regression test
        const pixelmatch = require('pixelmatch').default;
        pixelmatch.mockReturnValue(0); // Perfect match

        const compareResult = await browserTool.execute({
          operation: 'compareScreenshot',
          params: {
            baselinePath: '/baselines/form-submitted.png',
            testId: 'workflow-integration-test'
          }
        });

        expect(compareResult.success).toBe(true);

        // Verify all operations succeeded with proper permission checks
        expect(mockCheckToolPermission).toHaveBeenCalledTimes(4);
        expect(navResult.metadata?.permissionGranted).toBe(true);
        expect(clickResult.metadata?.permissionGranted).toBe(true);
        expect(screenshotResult.metadata?.permissionGranted).toBe(true);
        expect(compareResult.metadata?.permissionGranted).toBe(true);
      });

      it('should handle partial workflow failures due to permission restrictions', async () => {
        // Grant limited permissions
        await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
        await permissionManager.grantPermission('Browser', 'click', 'allow-once');
        // Note: No screenshot permission granted

        const mockCheckToolPermission = vi.fn()
          .mockResolvedValueOnce({ allowed: true, level: 'allow-always', requiresConfirmation: false })
          .mockResolvedValueOnce({ allowed: true, level: 'allow-once', requiresConfirmation: false })
          .mockResolvedValueOnce({ allowed: false, denialReason: 'No permission for screenshots', requiresConfirmation: false });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Step 1: Navigate (should succeed)
        const navResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://limited-workflow.com' }
        });

        expect(navResult.success).toBe(true);

        // Step 2: Click (should succeed and consume allow-once)
        const clickResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#button' }
        });

        expect(clickResult.success).toBe(true);

        // Step 3: Screenshot (should fail - no permission)
        const screenshotResult = await browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true }
        });

        expect(screenshotResult.success).toBe(false);
        expect(screenshotResult.error).toBe('No permission for screenshots');

        // Verify permission consumption
        const secondClickResult = await browserTool.execute({
          operation: 'click',
          params: { selector: '#another-button' }
        });

        expect(secondClickResult.success).toBe(false); // allow-once was consumed
      });
    });
  });

  describe('System Configuration Integration', () => {
    describe('Unified Configuration Management', () => {
      it('should coordinate configuration between permission and tool systems', async () => {
        // Test that tool configurations are properly integrated with permission system
        const complexConfig: BrowserToolConfig = {
          enabled: true,
          timeout: 30000,
          requireConfirmation: false,
          rateLimitPerMinute: 60,
          allowedDomains: ['config-test.com'],
          blockedDomains: ['blocked-config.com'],
          allowJavaScriptExecution: true,
          allowFormSubmission: false,
          allowScreenshots: true,
          engine: 'chromium',
          headless: true,
          viewport: { width: 1280, height: 720 }
        };

        permissionManager.setToolConfig('Browser', complexConfig);

        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Test JavaScript execution (allowed by config)
        const evalResult = await browserTool.execute({
          operation: 'evaluate',
          params: { script: 'return "config allows this"' }
        });

        expect(evalResult.success).toBe(true);

        // Test form submission (blocked by config)
        const submitResult = await browserTool.execute({
          operation: 'submit',
          params: { selector: '#form' }
        });

        expect(submitResult.success).toBe(false);
        expect(submitResult.error).toBe('Form submission is disabled');

        // Test domain restriction (blocked by config)
        const blockedNavResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://blocked-config.com/page' }
        });

        expect(blockedNavResult.success).toBe(false);
        expect(blockedNavResult.error).toBe('Domain blocked-config.com is blocked');
      });
    });
  });

  describe('Error Propagation and Recovery', () => {
    describe('Cross-System Error Handling', () => {
      it('should properly propagate permission errors through tool execution', async () => {
        const errorEvents: any[] = [];

        eventEmitter.on('permission:denied', (data) => errorEvents.push({ type: 'permission', ...data }));
        eventEmitter.on('tool:error', (data) => errorEvents.push({ type: 'tool', ...data }));

        const mockCheckToolPermission = vi.fn().mockImplementation(() => {
          const error = new Error('Permission store connection failed');
          eventEmitter.emit('permission:error', { error: error.message });
          throw error;
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://error-test.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission store connection failed');
      });

      it('should handle browser automation failures with permission context', async () => {
        const mockCheckToolPermission = vi.fn().mockResolvedValue({
          allowed: true,
          level: 'allow-always',
          requiresConfirmation: false
        });

        permissionManager.checkToolPermission = mockCheckToolPermission;

        // Mock browser failure
        mockPage.goto.mockRejectedValue(new Error('Browser crashed'));

        const result = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://crash-test.com' }
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Browser crashed');
        expect(result.metadata?.permissionGranted).toBe(false); // Should be false due to error
      });
    });
  });
});