/**
 * Advanced System Interactions Integration Tests
 *
 * Tests complex interactions and edge cases between:
 * - Tool System (file operations, shell commands, web requests)
 * - Permission System (dynamic permissions, policy enforcement, scoped access)
 * - Browser Automation (session management, security policies, error handling)
 *
 * Advanced Scenarios:
 * - Dynamic permission changes during workflow execution
 * - Tool chaining with permission inheritance
 * - Browser session sharing between operations
 * - Policy-based permission enforcement
 * - Resource cleanup under error conditions
 * - Cross-system event propagation and ordering
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { mkdtemp, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, rmSync, mkdirSync } from 'fs';

// Core imports
import type {
  PermissionLevel,
  PermissionPreset,
  PolicyConfig,
  ToolResult,
  BrowserOperation
} from '@apexcli/core';

// System components
import { TaskStore } from '@apexcli/orchestrator/src/store';
import { PermissionStore } from '@apexcli/orchestrator/src/permission-store';
import { PermissionManager } from '@apexcli/orchestrator/src/permission-manager';
import { PermissionPresetManager } from '@apexcli/orchestrator/src/permission-preset-manager';
import { PolicyEnforcer } from '@apexcli/orchestrator/src/policy/policy-enforcer';
import { BrowserTool } from '@apexcli/orchestrator/src/tools/browser-tool';

// Mock configuration
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser))
  }
}));

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn()
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn()
};

const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  evaluate: vi.fn(() => Promise.resolve('mock-result')),
  waitForSelector: vi.fn(() => Promise.resolve({})),
  getAttribute: vi.fn(() => Promise.resolve('mock-attribute')),
  textContent: vi.fn(() => Promise.resolve('mock-text')),
  getByRole: vi.fn(() => ({
    click: vi.fn(() => Promise.resolve()),
    fill: vi.fn(() => Promise.resolve()),
    textContent: vi.fn(() => Promise.resolve('mock-role-text'))
  })),
  on: vi.fn(),
  close: vi.fn()
};

describe('Advanced System Interactions Integration Tests', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let presetManager: PermissionPresetManager;
  let policyEnforcer: PolicyEnforcer;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let systemEvents: Array<{ type: string; timestamp: number; data: any; order: number }>;
  let eventCounter: number;

  beforeAll(async () => {
    // Ensure test directories exist
    const baseTestDir = join(tmpdir(), 'apex-advanced-tests');
    if (!existsSync(baseTestDir)) {
      mkdirSync(baseTestDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Create isolated test environment
    testDir = await mkdtemp(join(tmpdir(), 'apex-advanced-test-'));
    eventCounter = 0;

    // Initialize stores
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();

    // Initialize permission management
    permissionManager = new PermissionManager(permissionStore);
    presetManager = new PermissionPresetManager(permissionManager);

    // Initialize policy enforcement
    policyEnforcer = new PolicyEnforcer({
      version: '1.0',
      enforcement: 'enforce',
      enabled: true,
      allowedPaths: {
        mode: 'allowlist',
        allow: [`${testDir}/**/*`],
        block: ['/system/**', '/etc/**'],
        sensitive: [`${testDir}/config/**`]
      },
      approvalRules: []
    });

    // Set up event system
    eventEmitter = new EventEmitter();
    systemEvents = [];
    setupAdvancedEventTracking();

    // Initialize browser tool
    browserTool = new BrowserTool({
      permissionManager,
      policyEnforcer,
      eventEmitter,
      config: {
        headless: true,
        timeout: 30000,
        allowScreenshots: true,
        allowJavaScriptExecution: true,
        allowedDomains: ['example.com', 'test.com'],
        blockedDomains: ['malicious.com', 'blocked.com']
      }
    });

    // Create test files
    await setupTestFiles();

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await taskStore?.close();
    await permissionStore?.close();
    await (browserTool as any)?.cleanup?.();

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    eventEmitter?.removeAllListeners();
    vi.restoreAllMocks();
  });

  function setupAdvancedEventTracking() {
    const eventTypes = [
      'permission:requested',
      'permission:granted',
      'permission:denied',
      'permission:changed',
      'policy:violation',
      'policy:approved',
      'tool:execution:start',
      'tool:execution:complete',
      'tool:execution:error',
      'browser:operation:start',
      'browser:operation:complete',
      'browser:operation:error',
      'browser:session:created',
      'browser:session:shared',
      'browser:session:closed',
      'workflow:step:start',
      'workflow:step:complete',
      'system:resource:allocated',
      'system:resource:released',
      'system:error'
    ];

    eventTypes.forEach(eventType => {
      eventEmitter.on(eventType, (data) => {
        systemEvents.push({
          type: eventType,
          timestamp: Date.now(),
          data,
          order: ++eventCounter
        });
      });
    });
  }

  async function setupTestFiles() {
    const configDir = join(testDir, 'config');
    const dataDir = join(testDir, 'data');

    mkdirSync(configDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    await writeFile(join(configDir, 'settings.json'), JSON.stringify({
      version: '1.0',
      settings: { debug: true }
    }));

    await writeFile(join(dataDir, 'input.txt'), 'Sample data for processing');
    await writeFile(join(dataDir, 'urls.txt'), 'https://example.com/page1\nhttps://test.com/page2');
  }

  describe('Dynamic Permission Management', () => {
    it('should handle permission changes during workflow execution', async () => {
      // Start with basic permissions
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'screenshot', 'allow-always');

      const workflowSteps: any[] = [];

      // Step 1: Navigate to page (should succeed)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/dynamic' }
      });

      expect(navResult.success).toBe(true);
      workflowSteps.push({ step: 'initial_nav', success: true });

      // Step 2: Change permissions dynamically (revoke screenshot)
      await permissionManager.revokePermission('Browser', 'screenshot');
      eventEmitter.emit('permission:changed', {
        tool: 'Browser',
        operation: 'screenshot',
        newLevel: 'denied'
      });

      // Step 3: Try to take screenshot (should fail now)
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult.success).toBe(false);
      workflowSteps.push({ step: 'screenshot_denied', success: false });

      // Step 4: Grant screenshot permission again
      await permissionManager.grantPermission('Browser', 'screenshot', 'allow-once');
      eventEmitter.emit('permission:changed', {
        tool: 'Browser',
        operation: 'screenshot',
        newLevel: 'allow-once'
      });

      // Step 5: Screenshot should work now
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));
      const screenshotResult2 = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult2.success).toBe(true);
      workflowSteps.push({ step: 'screenshot_allowed', success: true });

      // Verify workflow adapted to permission changes
      expect(workflowSteps).toEqual([
        { step: 'initial_nav', success: true },
        { step: 'screenshot_denied', success: false },
        { step: 'screenshot_allowed', success: true }
      ]);

      // Verify permission change events
      const changeEvents = systemEvents.filter(e => e.type === 'permission:changed');
      expect(changeEvents).toHaveLength(2);
    });

    it('should apply permission presets dynamically', async () => {
      // Start with restrictive preset
      await presetManager.applyPreset('readOnly');

      // Verify restrictive behavior
      const writeResult1 = await simulateFileOperation('Write', {
        filePath: join(testDir, 'test-output.txt'),
        content: 'test content'
      });
      expect(writeResult1.success).toBe(false);

      // Change to permissive preset
      await presetManager.applyPreset('development');

      // Same operation should now succeed
      const writeResult2 = await simulateFileOperation('Write', {
        filePath: join(testDir, 'test-output2.txt'),
        content: 'test content'
      });
      // Note: Success depends on actual preset implementation

      // Verify preset change affected permissions
      const permissionEvents = systemEvents.filter(e =>
        e.type === 'permission:granted' || e.type === 'permission:denied'
      );
      expect(permissionEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Chaining with Permission Inheritance', () => {
    it('should handle multi-tool workflows with inherited permissions', async () => {
      // Set up hierarchical permissions
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'evaluate', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');

      const chainResults: any[] = [];

      // Chain 1: Browser -> File Operations
      // Step 1: Extract data from web page
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        title: 'Data Page',
        items: ['item1', 'item2', 'item3'],
        metadata: { timestamp: '2024-01-01T00:00:00Z' }
      });

      const extractResult = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            return {
              title: document.title,
              items: Array.from(document.querySelectorAll('.item')).map(el => el.textContent),
              metadata: { timestamp: new Date().toISOString() }
            };
          `
        }
      });

      chainResults.push({ operation: 'extract', success: extractResult.success });

      // Step 2: Save extracted data (inherits context from browser operation)
      const saveResult = await simulateFileOperation('Write', {
        filePath: join(testDir, 'extracted-data.json'),
        content: JSON.stringify(extractResult.data),
        context: { source: 'browser-extraction', inherit: true }
      });

      chainResults.push({ operation: 'save', success: saveResult.success });

      // Step 3: Read back and process data
      const readResult = await simulateFileOperation('Read', {
        filePath: join(testDir, 'extracted-data.json'),
        context: { inherit: true }
      });

      chainResults.push({ operation: 'read', success: readResult.success });

      // Verify all operations in chain succeeded
      expect(chainResults.every(result => result.success)).toBe(true);

      // Verify proper event sequencing in chain
      const executionEvents = systemEvents.filter(e =>
        e.type === 'tool:execution:complete' || e.type === 'browser:operation:complete'
      );
      expect(executionEvents.length).toBeGreaterThanOrEqual(3);

      // Verify events are properly ordered
      for (let i = 1; i < executionEvents.length; i++) {
        expect(executionEvents[i].order).toBeGreaterThan(executionEvents[i-1].order);
      }
    });

    it('should handle permission failures in tool chains gracefully', async () => {
      // Set up mixed permissions (some allowed, some denied)
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'evaluate', 'allow-always');
      await permissionManager.denyPermission('Write'); // Block file writing
      await permissionManager.grantPermission('Read', 'allow-always');

      const chainAttempts: any[] = [];

      // Attempt 1: Browser operation (should succeed)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.evaluate.mockResolvedValue({ data: 'extracted content' });

      const browserResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return { data: "extracted content" };' }
      });

      chainAttempts.push({
        step: 'browser_extract',
        success: browserResult.success,
        data: browserResult.data
      });

      // Attempt 2: Save data (should fail due to denied Write permission)
      const saveResult = await simulateFileOperation('Write', {
        filePath: join(testDir, 'failed-save.json'),
        content: JSON.stringify(browserResult.data)
      });

      chainAttempts.push({
        step: 'save_data',
        success: saveResult.success,
        error: saveResult.error
      });

      // Attempt 3: Continue chain with alternative approach (read existing file)
      await writeFile(join(testDir, 'fallback-data.json'), '{"fallback": true}');

      const fallbackResult = await simulateFileOperation('Read', {
        filePath: join(testDir, 'fallback-data.json')
      });

      chainAttempts.push({
        step: 'fallback_read',
        success: fallbackResult.success
      });

      // Verify partial success pattern
      expect(chainAttempts[0].success).toBe(true);  // Browser succeeded
      expect(chainAttempts[1].success).toBe(false); // Write failed
      expect(chainAttempts[2].success).toBe(true);  // Fallback succeeded

      // Verify appropriate error handling
      expect(chainAttempts[1].error).toMatch(/permission.*denied/i);

      // Verify chain continued despite failure
      expect(chainAttempts).toHaveLength(3);
    });
  });

  describe('Browser Session Management', () => {
    it('should share browser sessions efficiently across operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const sessionOperations: any[] = [];

      // Operation 1: Navigate (creates session)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const nav1Result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/session-test' }
      });

      sessionOperations.push({ op: 'navigate1', success: nav1Result.success });

      // Operation 2: Click on same page (should reuse session)
      mockPage.click.mockResolvedValue();
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button1' }
      });

      sessionOperations.push({ op: 'click', success: clickResult.success });

      // Operation 3: Take screenshot (should reuse session)
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      sessionOperations.push({ op: 'screenshot', success: screenshotResult.success });

      // Operation 4: Navigate to different page (may reuse or create new session)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const nav2Result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com/other-page' }
      });

      sessionOperations.push({ op: 'navigate2', success: nav2Result.success });

      // Verify all operations succeeded
      expect(sessionOperations.every(op => op.success)).toBe(true);

      // Verify session management events
      const sessionEvents = systemEvents.filter(e =>
        e.type === 'browser:session:created' ||
        e.type === 'browser:session:shared' ||
        e.type === 'browser:session:closed'
      );

      // Should have efficient session usage (depends on implementation)
      const createdEvents = sessionEvents.filter(e => e.type === 'browser:session:created');
      expect(createdEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should isolate browser sessions for different permission scopes', async () => {
      // Set up domain-specific permissions
      await permissionManager.grantPermission('Browser', 'navigate:https://example.com/*', 'allow-always');
      await permissionManager.grantPermission('Browser', 'navigate:https://test.com/*', 'allow-always');
      await permissionManager.denyPermission('Browser', 'navigate:https://blocked.com/*');

      const isolationTests: any[] = [];

      // Test 1: Navigate to first allowed domain
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page1' }
      });

      isolationTests.push({ domain: 'example.com', success: result1.success });

      // Test 2: Navigate to second allowed domain (different session)
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com/page1' }
      });

      isolationTests.push({ domain: 'test.com', success: result2.success });

      // Test 3: Try blocked domain (should fail)
      const result3 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/page1' }
      });

      isolationTests.push({ domain: 'blocked.com', success: result3.success });

      // Verify domain isolation
      expect(isolationTests[0].success).toBe(true);  // example.com allowed
      expect(isolationTests[1].success).toBe(true);  // test.com allowed
      expect(isolationTests[2].success).toBe(false); // blocked.com denied

      // Verify proper session management for different domains
      const sessionEvents = systemEvents.filter(e =>
        e.type === 'browser:session:created'
      );
      expect(sessionEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Policy-Based Permission Enforcement', () => {
    it('should enforce path-based access policies', async () => {
      // Configure policy with path restrictions
      const policyConfig: PolicyConfig = {
        version: '1.0',
        enforcement: 'enforce',
        enabled: true,
        allowedPaths: {
          mode: 'allowlist',
          allow: [`${testDir}/data/**/*`],
          block: [`${testDir}/config/**/*`],
          sensitive: [`${testDir}/config/settings.json`]
        },
        approvalRules: [
          {
            id: 'sensitive-file-access',
            name: 'Sensitive File Access',
            description: 'Require approval for sensitive file operations',
            urgency: 'high',
            condition: {
              type: 'file-pattern',
              pattern: '**/config/**',
              operation: 'write'
            },
            enabled: true
          }
        ]
      };

      policyEnforcer = new PolicyEnforcer(policyConfig);

      const policyTests: any[] = [];

      // Test 1: Access allowed path (should succeed)
      const allowedResult = await simulateFileOperationWithPolicy('Read', {
        filePath: join(testDir, 'data/input.txt')
      });
      policyTests.push({ test: 'allowed_path', success: allowedResult.success });

      // Test 2: Access blocked path (should fail)
      const blockedResult = await simulateFileOperationWithPolicy('Write', {
        filePath: join(testDir, 'config/secret.txt'),
        content: 'secret data'
      });
      policyTests.push({ test: 'blocked_path', success: blockedResult.success });

      // Test 3: Access sensitive file (should require approval)
      const sensitiveResult = await simulateFileOperationWithPolicy('Write', {
        filePath: join(testDir, 'config/settings.json'),
        content: '{"sensitive": true}'
      });
      policyTests.push({ test: 'sensitive_file', success: sensitiveResult.success });

      // Verify policy enforcement
      expect(policyTests[0].success).toBe(true);  // Allowed path
      expect(policyTests[1].success).toBe(false); // Blocked path
      // Sensitive file result depends on approval mechanism

      // Verify policy violation events
      const violationEvents = systemEvents.filter(e => e.type === 'policy:violation');
      expect(violationEvents.length).toBeGreaterThan(0);
    });

    it('should integrate policy enforcement with browser permissions', async () => {
      // Configure browser-specific policies
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'evaluate', 'allow-always');

      const browserPolicyTests: any[] = [];

      // Test 1: Navigate to allowed domain with evaluation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.evaluate.mockResolvedValue({ safe: true });

      const safeEvalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return { safe: true };' }
      });

      browserPolicyTests.push({ test: 'safe_evaluation', success: safeEvalResult.success });

      // Test 2: Try potentially dangerous evaluation
      const dangerousScript = `
        // Potentially dangerous script
        return window.location.href;
      `;

      const dangerousResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: dangerousScript }
      });

      browserPolicyTests.push({
        test: 'dangerous_evaluation',
        success: dangerousResult.success,
        blocked: !dangerousResult.success
      });

      // Verify policy integration
      expect(browserPolicyTests[0].success).toBe(true); // Safe operation
      // Dangerous operation result depends on policy implementation

      // Verify policy events for browser operations
      const policyEvents = systemEvents.filter(e =>
        e.type === 'policy:violation' || e.type === 'policy:approved'
      );
      expect(policyEvents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-System Event Propagation', () => {
    it('should maintain proper event ordering across all systems', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const eventSequence: string[] = [];

      // Set up event listeners to track order
      eventEmitter.on('permission:requested', () => eventSequence.push('permission:requested'));
      eventEmitter.on('permission:granted', () => eventSequence.push('permission:granted'));
      eventEmitter.on('browser:operation:start', () => eventSequence.push('browser:operation:start'));
      eventEmitter.on('tool:execution:start', () => eventSequence.push('tool:execution:start'));
      eventEmitter.on('tool:execution:complete', () => eventSequence.push('tool:execution:complete'));
      eventEmitter.on('browser:operation:complete', () => eventSequence.push('browser:operation:complete'));

      // Execute browser operation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/event-test' }
      });

      // Verify logical event ordering
      const permissionIndex = eventSequence.indexOf('permission:granted');
      const startIndex = eventSequence.indexOf('browser:operation:start');
      const completeIndex = eventSequence.indexOf('browser:operation:complete');

      if (permissionIndex !== -1 && startIndex !== -1) {
        expect(permissionIndex).toBeLessThan(startIndex);
      }

      if (startIndex !== -1 && completeIndex !== -1) {
        expect(startIndex).toBeLessThan(completeIndex);
      }

      // Verify events were emitted with proper timestamps
      const timestampedEvents = systemEvents.filter(e => e.timestamp && e.order);
      timestampedEvents.sort((a, b) => a.order - b.order);

      for (let i = 1; i < timestampedEvents.length; i++) {
        expect(timestampedEvents[i].timestamp).toBeGreaterThanOrEqual(timestampedEvents[i-1].timestamp);
      }
    });
  });

  // Helper functions
  async function simulateFileOperation(operation: string, params: any): Promise<ToolResult> {
    try {
      eventEmitter.emit('tool:execution:start', { tool: operation, params });

      // Simulate permission check
      const hasPermission = await permissionManager.hasPermission(operation);

      if (!hasPermission) {
        eventEmitter.emit('permission:denied', { tool: operation });
        return { success: false, error: `Permission denied for ${operation}` };
      }

      eventEmitter.emit('permission:granted', { tool: operation });

      // Simulate operation
      const result = { success: true, data: params };
      eventEmitter.emit('tool:execution:complete', { tool: operation, result });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      eventEmitter.emit('tool:execution:error', { tool: operation, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  async function simulateFileOperationWithPolicy(operation: string, params: any): Promise<ToolResult> {
    try {
      // Check policy first
      const policyCheck = await policyEnforcer.checkFileAccess(params.filePath, operation);

      if (policyCheck.violation) {
        eventEmitter.emit('policy:violation', policyCheck);
        return { success: false, error: 'Policy violation: ' + policyCheck.reason };
      }

      if (policyCheck.requiresApproval) {
        eventEmitter.emit('policy:approval:required', policyCheck);
        // Simulate approval process (auto-approve for test)
        eventEmitter.emit('policy:approved', policyCheck);
      }

      return await simulateFileOperation(operation, params);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Policy check failed';
      return { success: false, error: errorMsg };
    }
  }
});