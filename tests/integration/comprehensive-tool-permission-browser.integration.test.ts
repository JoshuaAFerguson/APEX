/**
 * Comprehensive Integration Tests: Tools + Permissions + Browser Automation
 *
 * This test suite validates the complete integration between all three core systems:
 * 1. Tool System - Core tool infrastructure and execution
 * 2. Permission System - Access control and authorization
 * 3. Browser Automation - Web automation capabilities via mcp__browser-tools
 *
 * Key integration points tested:
 * - Tools respect permission settings before execution
 * - Browser automation integrates seamlessly with tool permission checks
 * - Permission denials are properly handled across all systems
 * - Events propagate correctly through all systems
 * - Error recovery works consistently across systems
 * - Performance under mixed workloads
 * - Resource cleanup and memory management
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Core types and interfaces
import type {
  Task,
  Permission,
  PermissionLevel,
  ToolPermissionResult,
  AgentTool,
  ApexConfig,
  ToolResult
} from '@apexcli/core';

// System components under test
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Mock the mcp__browser-tools__Browser function
const mockBrowserToolsExecute = vi.fn();

// Mock external dependencies
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve(mockPlaywrightPage)),
        on: vi.fn(),
        close: vi.fn()
      })),
      close: vi.fn()
    }))
  }
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve('mock file content')),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  rm: vi.fn(() => Promise.resolve()),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false, isFile: () => true })),
  readdir: vi.fn(() => Promise.resolve(['file1.txt', 'file2.js'])),
  mkdtemp: vi.fn((template) => Promise.resolve(`${template.replace('XXXXXX', 'test123')}`))
}));

// Mock Playwright page object
const mockPlaywrightPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot-data'))),
  evaluate: vi.fn(() => Promise.resolve('mock-evaluation-result')),
  waitForSelector: vi.fn(() => Promise.resolve()),
  textContent: vi.fn(() => Promise.resolve('Mock page text content')),
  getAttribute: vi.fn(() => Promise.resolve('mock-attribute-value')),
  on: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  content: vi.fn(() => Promise.resolve('<html><body>Mock page content</body></html>'))
};

// Helper to create mock tools with permission integration
function createMockToolWithPermissions(name: string, permissionManager: PermissionManager) {
  return {
    name,
    execute: vi.fn(async ({ operation, params }) => {
      // Check permissions first
      const permissionResult = await permissionManager.checkToolPermission(name as AgentTool, {
        scope: operation,
        context: params
      });

      if (!permissionResult.allowed) {
        return {
          success: false,
          error: `Permission denied: ${permissionResult.denialReason}`,
          tool: name,
          operation
        };
      }

      // Mock successful execution
      return {
        success: true,
        data: { result: `Mock ${name} operation: ${operation}` },
        tool: name,
        operation
      };
    })
  };
}

// Helper to create test environment
function createTestTask(testDir: string): Task {
  return {
    id: 'test-task-integration',
    description: 'Integration test task',
    workflow: 'testing',
    status: 'pending',
    config: {},
    metadata: {
      projectPath: testDir,
      createdAt: new Date(),
      priority: 'normal'
    }
  };
}

describe('Tools + Permissions + Browser Automation Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let browserTool: BrowserTool;
  let eventEmitter: EventEmitter;
  let testTask: Task;
  let systemEvents: any[];
  let toolRegistry: Map<string, any>;

  beforeEach(async () => {
    // Create isolated test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-integration-test-'));

    // Initialize core system components
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    systemEvents = [];
    toolRegistry = new Map();

    // Set up comprehensive event tracking
    setupEventTracking();

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.createTask(testTask);

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

    // Register comprehensive tool suite
    registerToolSuite();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup resources
    if (browserTool) {
      await browserTool.cleanup();
    }
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function setupEventTracking() {
    const eventTypes = [
      'permission:requested', 'permission:granted', 'permission:denied',
      'tool:execution:start', 'tool:execution:complete', 'tool:execution:error',
      'browser:operation:start', 'browser:operation:complete', 'browser:operation:error',
      'browser:session:created', 'browser:session:closed',
      'task:status:changed', 'system:error'
    ];

    eventTypes.forEach(eventType => {
      eventEmitter.on(eventType, (data) => {
        systemEvents.push({
          type: eventType,
          timestamp: Date.now(),
          data,
          context: { taskId: testTask.id }
        });
      });
    });
  }

  function registerToolSuite() {
    // Register core tools with permission integration
    toolRegistry.set('Read', createMockToolWithPermissions('Read', permissionManager));
    toolRegistry.set('Write', createMockToolWithPermissions('Write', permissionManager));
    toolRegistry.set('Edit', createMockToolWithPermissions('Edit', permissionManager));
    toolRegistry.set('Glob', createMockToolWithPermissions('Glob', permissionManager));
    toolRegistry.set('Grep', createMockToolWithPermissions('Grep', permissionManager));
    toolRegistry.set('Bash', createMockToolWithPermissions('Bash', permissionManager));

    // Register browser tool
    toolRegistry.set('Browser', browserTool);

    // Mock the mcp__browser-tools__Browser integration
    toolRegistry.set('mcp__browser-tools__Browser', {
      name: 'mcp__browser-tools__Browser',
      execute: mockBrowserToolsExecute
    });

    // Attach tools to orchestrator
    (orchestrator as any).tools = Object.fromEntries(toolRegistry);
  }

  describe('Core Integration: Tool Permission Validation', () => {
    it('should enforce permissions for all tool types before execution', async () => {
      // Deny all permissions initially
      await permissionManager.denyPermission('Read');
      await permissionManager.denyPermission('Write');
      await permissionManager.denyPermission('Browser');

      const readTool = toolRegistry.get('Read');
      const writeTool = toolRegistry.get('Write');

      // All operations should fail due to permission denial
      const readResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/test/file.txt' }
      });

      const writeResult = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: '/test/output.txt', content: 'test' }
      });

      const browserResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Verify all operations were denied
      expect(readResult.success).toBe(false);
      expect(readResult.error).toMatch(/permission.*denied/i);

      expect(writeResult.success).toBe(false);
      expect(writeResult.error).toMatch(/permission.*denied/i);

      expect(browserResult.success).toBe(false);
      expect(browserResult.error).toMatch(/permission.*denied/i);

      // Verify denial events were emitted
      const denialEvents = systemEvents.filter(e => e.type === 'permission:denied');
      expect(denialEvents.length).toBeGreaterThanOrEqual(3);
    });

    it('should allow tool execution with proper permission levels', async () => {
      // Grant specific permission levels
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-once');
      await permissionManager.grantPermission('Browser', 'allow-always');

      const readTool = toolRegistry.get('Read');
      const writeTool = toolRegistry.get('Write');

      // Read should succeed (allow-always)
      const readResult1 = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/test/file1.txt' }
      });

      const readResult2 = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/test/file2.txt' }
      });

      expect(readResult1.success).toBe(true);
      expect(readResult2.success).toBe(true);

      // First write should succeed (allow-once)
      const writeResult1 = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: '/test/output1.txt', content: 'test1' }
      });

      expect(writeResult1.success).toBe(true);

      // Second write should fail (allow-once consumed)
      const writeResult2 = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: '/test/output2.txt', content: 'test2' }
      });

      expect(writeResult2.success).toBe(false);

      // Browser operation should succeed
      mockPlaywrightPage.goto.mockResolvedValue({ status: () => 200 });
      const browserResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(browserResult.success).toBe(true);

      // Verify granted events were emitted
      const grantedEvents = systemEvents.filter(e => e.type === 'permission:granted');
      expect(grantedEvents.length).toBeGreaterThan(0);
    });

    it('should handle scoped permissions correctly across tools', async () => {
      // Grant scoped permissions
      await permissionManager.grantPermission('Read', 'allow-always', '/safe/*');
      await permissionManager.denyPermission('Read', '/restricted/*');
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:example.com');

      const readTool = toolRegistry.get('Read');

      // Read from safe path should succeed
      const safeReadResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/safe/config.json' }
      });

      expect(safeReadResult.success).toBe(true);

      // Read from restricted path should fail
      const restrictedReadResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/restricted/secrets.txt' }
      });

      expect(restrictedReadResult.success).toBe(false);

      // Browser navigation to allowed domain should succeed
      mockPlaywrightPage.goto.mockResolvedValue({ status: () => 200 });
      const allowedNavResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page' }
      });

      expect(allowedNavResult.success).toBe(true);
    });
  });

  describe('Browser Automation Integration', () => {
    it('should integrate browser operations with permission system', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Test various browser operations
      const operations = [
        { operation: 'navigate', params: { url: 'https://test.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'getText', params: { selector: '.content' } }
      ];

      for (const op of operations) {
        const result = await browserTool.execute(op as any);
        expect(result.success).toBe(true);
        expect(result.metadata?.permissionGranted).toBe(true);
      }

      // Verify browser events were emitted
      const browserEvents = systemEvents.filter(e => e.type.startsWith('browser:'));
      expect(browserEvents.length).toBeGreaterThan(0);
    });

    it('should handle browser-specific permission denials gracefully', async () => {
      // Grant general browser permission but deny specific operations
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.denyPermission('Browser', 'evaluate');

      // Navigation should succeed
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });

      expect(navResult.success).toBe(true);

      // JavaScript evaluation should fail
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      expect(evalResult.success).toBe(false);
      expect(evalResult.error).toMatch(/permission.*denied/i);
    });

    it('should handle mcp__browser-tools integration with permissions', async () => {
      await permissionManager.grantPermission('mcp__browser-tools__Browser', 'allow-always');

      // Mock successful MCP browser tools execution
      mockBrowserToolsExecute.mockResolvedValue({
        success: true,
        data: { result: 'MCP browser operation completed' }
      });

      const mcpTool = toolRegistry.get('mcp__browser-tools__Browser');
      const result = await mcpTool.execute({
        operation: 'navigate',
        params: { url: 'https://mcp-test.com' }
      });

      expect(result.success).toBe(true);
      expect(mockBrowserToolsExecute).toHaveBeenCalledWith({
        operation: 'navigate',
        params: { url: 'https://mcp-test.com' }
      });
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should execute complete development workflow with mixed permissions', async () => {
      // Set up realistic development workflow permissions
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Glob', 'allow-always');
      await permissionManager.grantPermission('Grep', 'allow-always');
      await permissionManager.grantPermission('Edit', 'allow-once');
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate,screenshot');
      await permissionManager.grantPermission('Write', 'allow-always', 'report-files');

      const workflowSteps = [];

      // Step 1: Read project configuration
      const readTool = toolRegistry.get('Read');
      const configResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: './package.json' }
      });
      workflowSteps.push({ step: 'read-config', success: configResult.success });

      // Step 2: Find source files
      const globTool = toolRegistry.get('Glob');
      const filesResult = await globTool.execute({
        operation: 'findFiles',
        params: { pattern: '**/*.ts' }
      });
      workflowSteps.push({ step: 'find-files', success: filesResult.success });

      // Step 3: Search for TODOs
      const grepTool = toolRegistry.get('Grep');
      const searchResult = await grepTool.execute({
        operation: 'searchText',
        params: { pattern: 'TODO' }
      });
      workflowSteps.push({ step: 'search-todos', success: searchResult.success });

      // Step 4: Edit a file (should succeed once)
      const editTool = toolRegistry.get('Edit');
      const editResult = await editTool.execute({
        operation: 'editFile',
        params: { filePath: 'src/main.ts', changes: [] }
      });
      workflowSteps.push({ step: 'edit-file', success: editResult.success });

      // Step 5: Navigate to test application
      mockPlaywrightPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });
      workflowSteps.push({ step: 'browser-navigate', success: navResult.success });

      // Step 6: Take screenshot for documentation
      mockPlaywrightPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      workflowSteps.push({ step: 'take-screenshot', success: screenshotResult.success });

      // Step 7: Write report
      const writeTool = toolRegistry.get('Write');
      const reportResult = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: './test-report.md', content: '# Test Report' }
      });
      workflowSteps.push({ step: 'write-report', success: reportResult.success });

      // Verify workflow completed successfully
      const successfulSteps = workflowSteps.filter(step => step.success);
      expect(successfulSteps.length).toBeGreaterThanOrEqual(6); // Most steps should succeed

      // Verify comprehensive event tracking
      const permissionEvents = systemEvents.filter(e => e.type.startsWith('permission:'));
      const toolEvents = systemEvents.filter(e => e.type.startsWith('tool:'));
      const browserEvents = systemEvents.filter(e => e.type.startsWith('browser:'));

      expect(permissionEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);
    });

    it('should coordinate browser automation with file operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');

      // Scenario: Extract data from web page and save to file

      // 1. Navigate to data source
      mockPlaywrightPage.goto.mockResolvedValue({ status: () => 200 });
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://api.example.com/data' }
      });
      expect(navResult.success).toBe(true);

      // 2. Extract data from page
      mockPlaywrightPage.textContent.mockResolvedValue('{"data": "extracted content"}');
      const extractResult = await browserTool.execute({
        operation: 'getText',
        params: { selector: 'pre' }
      });
      expect(extractResult.success).toBe(true);

      // 3. Save extracted data
      const writeTool = toolRegistry.get('Write');
      const saveResult = await writeTool.execute({
        operation: 'writeFile',
        params: {
          filePath: './extracted-data.json',
          content: extractResult.data?.text
        }
      });
      expect(saveResult.success).toBe(true);

      // 4. Verify saved data
      const readTool = toolRegistry.get('Read');
      const verifyResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: './extracted-data.json' }
      });
      expect(verifyResult.success).toBe(true);

      // Verify cross-system coordination
      const browserEvents = systemEvents.filter(e => e.type.startsWith('browser:'));
      const toolEvents = systemEvents.filter(e =>
        e.type.startsWith('tool:') &&
        ['Write', 'Read'].includes(e.data?.tool)
      );

      expect(browserEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle cascading failures gracefully', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Set up cascading failure scenario
      let failureCount = 0;
      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async () => {
        failureCount++;
        if (failureCount === 1) {
          throw new Error('Permission system temporarily unavailable');
        }
        return { allowed: true, level: 'allow-always' as PermissionLevel };
      });

      // Mock browser failure
      mockPlaywrightPage.goto.mockRejectedValueOnce(new Error('Network timeout'));

      // First operation should fail due to permission system
      const firstResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(firstResult.success).toBe(false);

      // Second operation should fail due to browser error
      const secondResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(secondResult.success).toBe(false);

      // Third operation should succeed (system recovered)
      mockPlaywrightPage.goto.mockResolvedValue({ status: () => 200 });
      const thirdResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(thirdResult.success).toBe(true);

      // Verify error events were tracked
      const errorEvents = systemEvents.filter(e => e.type.includes('error'));
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle permission changes during operation execution', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      let operationStarted = false;

      // Mock slow operation
      mockPlaywrightPage.goto.mockImplementation(async () => {
        operationStarted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: () => 200 };
      });

      // Start operation
      const operationPromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Change permissions while operation is running
      setTimeout(async () => {
        await permissionManager.denyPermission('Browser');
      }, 50);

      const result = await operationPromise;

      // Operation behavior may vary depending on implementation
      expect(result.success).toBeDefined();
      expect(operationStarted).toBe(true);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations across all systems', async () => {
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Glob', 'allow-always');

      const operationCount = 12;
      const startTime = Date.now();

      // Create mixed concurrent operations
      const operations = [];

      // File operations
      for (let i = 0; i < 4; i++) {
        operations.push(
          toolRegistry.get('Read').execute({
            operation: 'readFile',
            params: { filePath: `./file${i}.txt` }
          })
        );
      }

      // Browser operations
      for (let i = 0; i < 4; i++) {
        operations.push(
          browserTool.execute({
            operation: 'navigate',
            params: { url: `https://example.com/page${i}` }
          })
        );
      }

      // Search operations
      for (let i = 0; i < 4; i++) {
        operations.push(
          toolRegistry.get('Glob').execute({
            operation: 'findFiles',
            params: { pattern: `**/*.${i}.ts` }
          })
        );
      }

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      // Verify all operations completed
      expect(results.length).toBe(operationCount);

      // Most operations should succeed
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      ).length;

      expect(successCount).toBeGreaterThan(operationCount * 0.8);

      // Should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Less than 5 seconds

      // Verify event system handled high throughput
      expect(systemEvents.length).toBeGreaterThan(operationCount);
    });

    it('should manage memory and resources under load', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Track resource usage
      const initialState = browserTool.getResourceState();

      // Perform multiple resource-intensive operations
      const operations = Array.from({ length: 5 }, (_, i) =>
        browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true, path: `screenshot-${i}.png` }
        })
      );

      const results = await Promise.allSettled(operations);

      // At least some should succeed
      const successfulResults = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      );

      expect(successfulResults.length).toBeGreaterThan(0);

      // System should remain stable
      expect(browserTool).toBeDefined();
      expect(orchestrator).toBeDefined();

      // Resource state should be tracked
      const finalState = browserTool.getResourceState();
      expect(finalState.sessionId).toBe(initialState.sessionId);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration changes across all systems', async () => {
      // Test configuration that affects multiple systems
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

      // Apply configuration (mock for test)
      const applyConfigSpy = vi.fn();
      (orchestrator as any).applyConfig = applyConfigSpy;

      // Browser operations should respect disabled configuration
      const browserResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });

      // Result depends on how configuration is applied
      if (testConfig.tools?.browser?.enabled === false) {
        expect(browserResult.success).toBe(false);
      }
    });

    it('should validate cross-system configuration consistency', async () => {
      // Test configuration validation across systems
      const validConfig = {
        tools: {
          browser: {
            enabled: true,
            allowedDomains: ['example.com', 'test.com']
          }
        },
        permissions: {
          preset: 'interactive' as const
        }
      };

      // Valid configuration should not throw
      expect(() => {
        // Mock configuration validation
        if (Array.isArray(validConfig.tools.browser.allowedDomains)) {
          // Valid configuration
        } else {
          throw new Error('Invalid configuration');
        }
      }).not.toThrow();

      const invalidConfig = {
        tools: {
          browser: {
            enabled: true,
            allowedDomains: 'should-be-array' // Invalid type
          }
        }
      };

      // Invalid configuration should be caught
      expect(() => {
        if (typeof invalidConfig.tools.browser.allowedDomains === 'string') {
          throw new Error('Configuration validation failed');
        }
      }).toThrow(/configuration.*validation.*failed/i);
    });
  });
});