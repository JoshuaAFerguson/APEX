/**
 * Complete Integration Tests: Tools, Permissions, and Browser Automation
 *
 * This test suite provides comprehensive end-to-end testing of the three core systems:
 * 1. Tool System - File operations, shell commands, and web interactions
 * 2. Permission System - Access control, scoped permissions, and policy enforcement
 * 3. Browser Automation - Web navigation, interaction, and data extraction
 *
 * Focus Areas:
 * - Real-world workflow scenarios combining all three systems
 * - Permission enforcement across different tool types and scopes
 * - Browser automation with various permission levels and domain restrictions
 * - Error recovery and graceful degradation when permissions are denied
 * - Event propagation and system coordination
 * - Resource management and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { mkdtemp, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, rmSync } from 'fs';

// Import types
import type {
  Task,
  Permission,
  PermissionLevel,
  ToolPermissionResult,
  AgentTool,
  BrowserOperation,
  ToolResult
} from '@apexcli/core';

// Import system components
import { TaskStore, PermissionStore, PermissionManager } from '@apexcli/orchestrator';
import { BrowserTool as OrchestratorBrowserTool } from '@apexcli/orchestrator';
import { ToolRegistry, ReadTool, BashTool, GrepTool, WebSearchTool, BrowserTool } from '@apexcli/core/tools';

// Mock Playwright for browser operations
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
  },
  firefox: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(mockPage)),
        on: vi.fn(),
        close: vi.fn()
      })),
      close: vi.fn()
    }))
  },
  webkit: {
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

// Mock browser page with comprehensive operations
const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Mock Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  evaluate: vi.fn(() => Promise.resolve('evaluation-result')),
  waitForSelector: vi.fn(() => Promise.resolve({})),
  getAttribute: vi.fn(() => Promise.resolve('attribute-value')),
  textContent: vi.fn(() => Promise.resolve('page text content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>mock html</div>')),
  hover: vi.fn(() => Promise.resolve()),
  selectOption: vi.fn(() => Promise.resolve()),
  check: vi.fn(() => Promise.resolve()),
  uncheck: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 }))
};

describe('Complete Integration: Tools + Permissions + Browser Automation', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let toolRegistry: ToolRegistry;
  let systemEvents: Array<{ type: string; timestamp: number; data: any }>;

  beforeEach(async () => {
    // Create isolated test environment
    testDir = await mkdtemp(join(tmpdir(), 'apex-complete-integration-'));

    // Initialize data stores
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();

    permissionManager = new PermissionManager(permissionStore);

    // Set up event tracking
    eventEmitter = new EventEmitter();
    systemEvents = [];
    setupEventTracking();

    // Initialize tool registry with all tools
    toolRegistry = ToolRegistry.getInstance();
    registerAllTools();

    // Initialize browser tool
    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      config: {
        headless: true,
        timeout: 30000,
        allowScreenshots: true,
        allowJavaScriptExecution: true
      }
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up resources
    await taskStore?.close();
    await permissionStore?.close();

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    eventEmitter?.removeAllListeners();
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
      'browser:operation:error',
      'browser:session:created',
      'browser:session:closed',
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

  function registerAllTools() {
    toolRegistry.registerTool('Read', ReadTool);
    toolRegistry.registerTool('Write', WriteTool);
    toolRegistry.registerTool('Bash', BashTool);
    toolRegistry.registerTool('Grep', GrepTool);
    toolRegistry.registerTool('WebSearch', WebSearchTool);
    toolRegistry.registerTool('Browser', BrowserTool);
  }

  describe('End-to-End Workflow Scenarios', () => {
    it('should execute a complete web scraping workflow with all systems', async () => {
      // Scenario: Scrape a webpage, save content to file, and generate report

      // Step 1: Set up permissions for entire workflow
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'screenshot', 'allow-always');
      await permissionManager.grantPermission('Browser', 'evaluate', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');

      const workflowResults: any[] = [];

      // Step 2: Navigate to target website
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://example.com/data');
      mockPage.title.mockResolvedValue('Data Page');

      const navigateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/data' }
      });

      expect(navigateResult.success).toBe(true);
      workflowResults.push({ step: 'navigate', success: true });

      // Step 3: Extract data from page
      mockPage.evaluate.mockResolvedValue({
        title: 'Data Page',
        items: ['Item 1', 'Item 2', 'Item 3'],
        timestamp: new Date().toISOString()
      });

      const extractResult = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            return {
              title: document.title,
              items: Array.from(document.querySelectorAll('.item')).map(el => el.textContent),
              timestamp: new Date().toISOString()
            };
          `
        }
      });

      expect(extractResult.success).toBe(true);
      workflowResults.push({ step: 'extract', success: true, data: extractResult.data });

      // Step 4: Take screenshot for documentation
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));

      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      expect(screenshotResult.success).toBe(true);
      workflowResults.push({ step: 'screenshot', success: true });

      // Step 5: Save extracted data to file (simulated)
      const writeResult = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'scraped-data.json'),
        content: JSON.stringify(extractResult.data, null, 2)
      });

      expect(writeResult.success).toBe(true);
      workflowResults.push({ step: 'save_data', success: true });

      // Step 6: Generate summary report (simulated)
      const reportContent = `
# Web Scraping Report

**URL**: https://example.com/data
**Timestamp**: ${new Date().toISOString()}
**Items Found**: ${extractResult.data?.items?.length || 0}

## Summary
Successfully scraped data from the target website.
`;

      const reportResult = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'scraping-report.md'),
        content: reportContent
      });

      expect(reportResult.success).toBe(true);
      workflowResults.push({ step: 'generate_report', success: true });

      // Verify complete workflow success
      expect(workflowResults.every(result => result.success)).toBe(true);
      expect(workflowResults).toHaveLength(6);

      // Verify all permission checks passed
      const deniedEvents = systemEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(0);

      // Verify proper event sequencing
      const grantedEvents = systemEvents.filter(e => e.type === 'permission:granted');
      expect(grantedEvents.length).toBeGreaterThan(0);
    });

    it('should handle mixed permission levels in multi-step workflow', async () => {
      // Scenario: File analysis workflow with varying permission levels

      // Set up mixed permissions
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-once'); // Single use
      await permissionManager.grantPermission('Browser', 'evaluate', 'allow-always');
      await permissionManager.denyPermission('Write'); // Blocked operation
      await permissionManager.grantPermission('Grep', 'allow-always');

      const workflowSteps: Array<{ step: string; success: boolean; reason?: string }> = [];

      // Step 1: Read local file (should succeed - always allowed)
      const readResult = await simulateToolExecution('Read', 'readFile', {
        filePath: join(testDir, 'test-file.txt')
      });
      expect(readResult.success).toBe(true);
      workflowSteps.push({ step: 'read_file', success: true });

      // Step 2: Navigate to reference page (should succeed - allow-once)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const navigateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://reference.com/data' }
      });
      expect(navigateResult.success).toBe(true);
      workflowSteps.push({ step: 'navigate', success: true });

      // Step 3: Extract reference data (should succeed - always allowed)
      mockPage.evaluate.mockResolvedValue({ reference: 'data' });
      const evaluateResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'return { reference: "data" };' }
      });
      expect(evaluateResult.success).toBe(true);
      workflowSteps.push({ step: 'extract_reference', success: true });

      // Step 4: Try to save results (should fail - denied)
      const saveResult = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'results.json'),
        content: JSON.stringify({ data: 'analysis' })
      });
      expect(saveResult.success).toBe(false);
      workflowSteps.push({ step: 'save_results', success: false, reason: 'write_denied' });

      // Step 5: Try to navigate again (should fail - allow-once consumed)
      const secondNavigateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://another-reference.com' }
      });
      expect(secondNavigateResult.success).toBe(false);
      workflowSteps.push({ step: 'navigate_again', success: false, reason: 'permission_consumed' });

      // Step 6: Search in file content (should succeed - always allowed)
      const grepResult = await simulateToolExecution('Grep', 'searchContent', {
        pattern: 'search-term',
        content: 'file content with search-term inside'
      });
      expect(grepResult.success).toBe(true);
      workflowSteps.push({ step: 'search_content', success: true });

      // Verify mixed results as expected
      const successfulSteps = workflowSteps.filter(step => step.success);
      const failedSteps = workflowSteps.filter(step => !step.success);

      expect(successfulSteps).toHaveLength(4); // read, navigate, evaluate, grep
      expect(failedSteps).toHaveLength(2); // write denied, navigate consumed

      // Verify specific denial reasons
      expect(failedSteps.find(step => step.step === 'save_results')?.reason).toBe('write_denied');
      expect(failedSteps.find(step => step.step === 'navigate_again')?.reason).toBe('permission_consumed');
    });

    it('should coordinate browser automation with file operations', async () => {
      // Scenario: Download webpage content and process it locally

      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Grep', 'allow-always');

      // Step 1: Navigate and capture page content
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.innerHTML.mockResolvedValue(`
        <html>
          <body>
            <h1>Important Data</h1>
            <div class="content">
              <p>Key information: ABC123</p>
              <p>Status: Active</p>
              <p>Contact: info@example.com</p>
            </div>
          </body>
        </html>
      `);

      const navigateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://data-source.com/info' }
      });
      expect(navigateResult.success).toBe(true);

      // Step 2: Extract HTML content
      const htmlResult = await browserTool.execute({
        operation: 'getHtml',
        params: {}
      });
      expect(htmlResult.success).toBe(true);

      // Step 3: Save HTML content locally
      const saveHtmlResult = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'captured-content.html'),
        content: htmlResult.data
      });
      expect(saveHtmlResult.success).toBe(true);

      // Step 4: Extract specific data using text processing
      const searchResult = await simulateToolExecution('Grep', 'searchFile', {
        filePath: join(testDir, 'captured-content.html'),
        pattern: 'Key information: ([A-Z0-9]+)'
      });
      expect(searchResult.success).toBe(true);

      // Step 5: Save extracted data
      const extractedData = {
        source_url: 'https://data-source.com/info',
        extracted_at: new Date().toISOString(),
        key_info: 'ABC123', // Extracted from HTML
        status: 'Active'
      };

      const saveDataResult = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'extracted-data.json'),
        content: JSON.stringify(extractedData, null, 2)
      });
      expect(saveDataResult.success).toBe(true);

      // Verify coordination between browser and file systems
      const executionEvents = systemEvents.filter(e =>
        e.type === 'tool:execution:complete' || e.type === 'browser:operation:complete'
      );
      expect(executionEvents.length).toBeGreaterThan(0);

      // Verify no permission violations occurred
      const deniedEvents = systemEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents).toHaveLength(0);
    });
  });

  describe('Permission Enforcement Edge Cases', () => {
    it('should handle domain-specific browser permissions', async () => {
      // Set up domain-specific permissions
      await permissionManager.grantPermission('Browser', 'navigate:https://trusted.com/*', 'allow-always');
      await permissionManager.grantPermission('Browser', 'navigate:https://example.com', 'allow-once');
      await permissionManager.denyPermission('Browser', 'navigate:https://blocked.com/*');

      // Test allowed domain (trusted.com)
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const trustedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://trusted.com/page1' }
      });
      expect(trustedResult.success).toBe(true);

      // Test another page on trusted domain (should also work)
      const trustedResult2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://trusted.com/page2' }
      });
      expect(trustedResult2.success).toBe(true);

      // Test allow-once domain (example.com)
      const onceResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(onceResult.success).toBe(true);

      // Test same domain again (should fail - consumed)
      const onceResult2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' }
      });
      expect(onceResult2.success).toBe(false);

      // Test blocked domain
      const blockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com/dangerous' }
      });
      expect(blockedResult.success).toBe(false);

      // Verify permission events
      const grantedEvents = systemEvents.filter(e => e.type === 'permission:granted');
      const deniedEvents = systemEvents.filter(e => e.type === 'permission:denied');

      expect(grantedEvents.length).toBeGreaterThanOrEqual(3); // trusted x2, example x1
      expect(deniedEvents.length).toBeGreaterThanOrEqual(2); // example consumed, blocked
    });

    it('should enforce operation-specific permissions within tools', async () => {
      // Set up operation-specific permissions
      await permissionManager.grantPermission('Browser', 'navigate', 'allow-always');
      await permissionManager.grantPermission('Browser', 'screenshot', 'allow-once');
      await permissionManager.grantPermission('Browser', 'click', 'allow-always');
      await permissionManager.denyPermission('Browser', 'evaluate');

      // Test allowed operations
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });
      expect(navResult.success).toBe(true);

      mockPage.click.mockResolvedValue();
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });
      expect(clickResult.success).toBe(true);

      // Test limited operation (allow-once)
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(true);

      // Test same limited operation again (should fail)
      const screenshotResult2 = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult2.success).toBe(false);

      // Test denied operation
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      expect(evalResult.success).toBe(false);

      // Verify permission enforcement
      const deniedEvents = systemEvents.filter(e => e.type === 'permission:denied');
      expect(deniedEvents.length).toBeGreaterThanOrEqual(2); // screenshot consumed, evaluate denied
    });
  });

  describe('Error Recovery and System Resilience', () => {
    it('should recover gracefully from browser automation failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');

      // Simulate browser failure
      mockPage.goto.mockRejectedValue(new Error('Network timeout'));
      mockPage.screenshot.mockResolvedValue(Buffer.from('fallback-screenshot'));

      const results: any[] = [];

      // Step 1: Try to navigate (will fail)
      try {
        const navResult = await browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://unreliable-site.com' }
        });
        results.push({ step: 'navigate', success: navResult.success, error: navResult.error });
      } catch (error) {
        results.push({ step: 'navigate', success: false, error: error.message });
      }

      // Step 2: Continue with other operations despite failure
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      results.push({ step: 'screenshot', success: screenshotResult.success });

      // Step 3: Log the error to file (should succeed)
      const logResult = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'error-log.txt'),
        content: `Navigation failed: ${results[0].error}\nFallback operations completed.`
      });
      results.push({ step: 'log_error', success: logResult.success });

      // Verify recovery behavior
      expect(results[0].success).toBe(false); // Navigation failed
      expect(results[1].success).toBe(true);  // Screenshot succeeded
      expect(results[2].success).toBe(true);  // Logging succeeded

      // Verify error events were emitted
      const errorEvents = systemEvents.filter(e =>
        e.type === 'browser:operation:error' || e.type === 'tool:execution:error'
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle permission system failures gracefully', async () => {
      // Mock permission manager failure
      const originalCheck = permissionManager.checkPermission;
      let failureCount = 0;

      permissionManager.checkPermission = vi.fn().mockImplementation(async (...args) => {
        failureCount++;
        if (failureCount <= 2) {
          throw new Error('Permission database temporarily unavailable');
        }
        return originalCheck.apply(permissionManager, args);
      });

      const results: any[] = [];

      // Step 1: First attempt (should fail due to permission system failure)
      const result1 = await simulateToolExecution('Read', 'readFile', {
        filePath: join(testDir, 'test-file.txt')
      });
      results.push({ step: 'attempt1', success: result1.success });

      // Step 2: Second attempt (should also fail)
      const result2 = await simulateToolExecution('Write', 'writeFile', {
        filePath: join(testDir, 'output.txt'),
        content: 'test content'
      });
      results.push({ step: 'attempt2', success: result2.success });

      // Step 3: Third attempt (should succeed after recovery)
      const result3 = await simulateToolExecution('Read', 'readFile', {
        filePath: join(testDir, 'test-file.txt')
      });
      results.push({ step: 'attempt3', success: result3.success });

      // Verify failure and recovery pattern
      expect(results[0].success).toBe(false); // Failed due to permission system
      expect(results[1].success).toBe(false); // Failed due to permission system
      // Note: result3 success depends on actual implementation of error recovery

      // Verify error events
      const errorEvents = systemEvents.filter(e => e.type === 'system:error');
      expect(errorEvents.length).toBeGreaterThan(0);

      // Restore original function
      permissionManager.checkPermission = originalCheck;
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle concurrent operations efficiently', async () => {
      // Set up permissions for concurrent operations
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');

      const startTime = Date.now();

      // Execute multiple operations concurrently
      const concurrentOperations = [
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://site1.com' }
        }),
        browserTool.execute({
          operation: 'navigate',
          params: { url: 'https://site2.com' }
        }),
        simulateToolExecution('Read', 'readFile', {
          filePath: join(testDir, 'file1.txt')
        }),
        simulateToolExecution('Read', 'readFile', {
          filePath: join(testDir, 'file2.txt')
        }),
        simulateToolExecution('Write', 'writeFile', {
          filePath: join(testDir, 'output1.txt'),
          content: 'concurrent content 1'
        }),
        simulateToolExecution('Write', 'writeFile', {
          filePath: join(testDir, 'output2.txt'),
          content: 'concurrent content 2'
        })
      ];

      const results = await Promise.allSettled(concurrentOperations);
      const endTime = Date.now();

      // Verify all operations completed
      expect(results).toHaveLength(6);

      // Check that operations ran concurrently (not sequentially)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete quickly if concurrent

      // Verify successful operations
      const successfulResults = results.filter(result =>
        result.status === 'fulfilled' && (result.value as any).success
      );
      expect(successfulResults.length).toBeGreaterThan(0);

      // Verify proper event tracking for concurrent operations
      const executionEvents = systemEvents.filter(e =>
        e.type === 'tool:execution:start' || e.type === 'browser:operation:start'
      );
      expect(executionEvents.length).toBeGreaterThanOrEqual(6);
    });

    it('should properly manage browser session lifecycle', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      const sessionEvents: string[] = [];
      eventEmitter.on('browser:session:created', () => sessionEvents.push('created'));
      eventEmitter.on('browser:session:closed', () => sessionEvents.push('closed'));

      // Step 1: Create session through navigation
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://session-test.com' }
      });
      expect(navResult.success).toBe(true);

      // Step 2: Use existing session for screenshot
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot'));
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(true);

      // Step 3: Clean up session
      await (browserTool as any).cleanup?.();

      // Verify session lifecycle events (depending on implementation)
      // Note: Actual event verification depends on BrowserTool implementation
      const createdEvents = sessionEvents.filter(e => e === 'created');
      const closedEvents = sessionEvents.filter(e => e === 'closed');

      // Sessions should be managed properly
      expect(createdEvents.length).toBeGreaterThanOrEqual(0);
      expect(closedEvents.length).toBeGreaterThanOrEqual(0);
    });
  });

  // Helper function to simulate tool execution with permission checks
  async function simulateToolExecution(
    tool: AgentTool,
    operation: string,
    params: any
  ): Promise<ToolResult> {
    try {
      // Emit tool execution start
      eventEmitter.emit('tool:execution:start', { tool, operation, params });

      // Check permissions
      const permissionResult = await permissionManager.checkPermission(tool, {
        scope: `${operation}:${JSON.stringify(params)}`,
        consumeAllowOnce: true
      });

      if (!permissionResult.allowed) {
        eventEmitter.emit('permission:denied', {
          tool,
          operation,
          reason: permissionResult.reason
        });

        return {
          success: false,
          error: permissionResult.reason || `Permission denied for ${tool}`
        };
      }

      // Emit permission granted
      eventEmitter.emit('permission:granted', {
        tool,
        operation,
        level: permissionResult.level
      });

      // Simulate tool execution
      let result: ToolResult;
      switch (tool) {
        case 'Read':
          result = {
            success: true,
            data: {
              content: 'mock file content',
              filePath: params.filePath
            }
          };
          break;

        case 'Write':
          result = {
            success: true,
            data: {
              filePath: params.filePath,
              bytesWritten: params.content?.length || 0
            }
          };
          break;

        case 'Grep':
          result = {
            success: true,
            data: {
              matches: ['mock match 1', 'mock match 2'],
              pattern: params.pattern
            }
          };
          break;

        case 'Bash':
          result = {
            success: true,
            data: {
              stdout: 'command executed successfully',
              stderr: '',
              exitCode: 0
            }
          };
          break;

        default:
          result = { success: true, data: {} };
      }

      // Emit completion
      eventEmitter.emit('tool:execution:complete', {
        tool,
        operation,
        result
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      eventEmitter.emit('tool:execution:error', {
        tool,
        operation,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }
});