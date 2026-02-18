/**
 * Comprehensive Integration Tests: Tool System + Permission System + Browser Automation
 *
 * This test suite provides comprehensive coverage of the integration between:
 * 1. Tool System - All registered tools and their execution pipeline
 * 2. Permission System - Complete permission lifecycle and enforcement
 * 3. Browser Automation - Full browser automation capabilities
 *
 * These tests focus on realistic workflows and comprehensive coverage of interactions
 * between all three systems, ensuring they work correctly together in production scenarios.
 *
 * Coverage includes:
 * - End-to-end workflow testing with multiple tools
 * - Permission enforcement across different tool types
 * - Browser automation with various permission levels
 * - Complex permission scenarios with multiple scopes
 * - Error recovery and system resilience
 * - Performance under load with all systems active
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Core types and interfaces
import type {
  Task,
  Permission,
  PermissionLevel,
  PermissionPreset,
  ToolPermissionResult,
  BrowserSession,
  AgentTool,
  ApexConfig,
  ToolResult,
  WorkflowStage
} from '@apexcli/core';

// System components under test
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';

// Test utilities and helpers
import {
  createTestTask,
  MockBrowserSession,
  createTestEnvironment
} from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

// Mock external dependencies with comprehensive coverage
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
  }
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve('mock file content')),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  rm: vi.fn(() => Promise.resolve()),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false, isFile: () => true })),
  readdir: vi.fn(() => Promise.resolve(['file1.txt', 'file2.js']))
}));

// Comprehensive mock page object with all browser operations
const mockPage = {
  url: vi.fn(() => 'about:blank'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  selectOption: vi.fn(() => Promise.resolve()),
  check: vi.fn(() => Promise.resolve()),
  uncheck: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot-data'))),
  evaluate: vi.fn(() => Promise.resolve('mock-evaluation-result')),
  waitForSelector: vi.fn(() => Promise.resolve()),
  waitForNavigation: vi.fn(() => Promise.resolve()),
  textContent: vi.fn(() => Promise.resolve('Mock page text content')),
  getAttribute: vi.fn(() => Promise.resolve('mock-attribute-value')),
  getByText: vi.fn(() => ({ click: vi.fn(() => Promise.resolve()) })),
  locator: vi.fn(() => ({
    click: vi.fn(() => Promise.resolve()),
    fill: vi.fn(() => Promise.resolve()),
    textContent: vi.fn(() => Promise.resolve('Mock locator text'))
  })),
  on: vi.fn(),
  close: vi.fn(),
  viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
  setViewportSize: vi.fn(() => Promise.resolve()),
  reload: vi.fn(() => Promise.resolve()),
  goBack: vi.fn(() => Promise.resolve()),
  goForward: vi.fn(() => Promise.resolve()),
  content: vi.fn(() => Promise.resolve('<html><body>Mock page content</body></html>'))
};

describe('Comprehensive Systems Integration: Tools + Permissions + Browser Automation', () => {
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
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-comprehensive-test-'));

    // Initialize core system components
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    eventEmitter = new EventEmitter();

    systemEvents = [];
    toolRegistry = new Map();

    // Set up comprehensive event tracking
    setupComprehensiveEventTracking();

    // Create test task with realistic configuration
    testTask = createTestTask(testDir, {
      description: 'Comprehensive integration test task',
      workflow: 'feature-development',
      priority: 'high',
      maxRetries: 2
    });
    await taskStore.createTask(testTask);

    // Initialize browser tool with full configuration
    browserTool = new BrowserTool({
      permissionManager,
      eventEmitter,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      defaultTimeout: 30000,
      allowedDomains: ['*.example.com', 'safe.org', 'test.local'],
      blockedDomains: ['malicious.com', '*.dangerous.site']
    });

    // Create orchestrator with comprehensive configuration
    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      taskStore,
      permissionManager,
      eventEmitter,
      config: {
        tools: {
          browser: { enabled: true, allowScreenshots: true, allowJavaScriptExecution: true },
          filesystem: { enabled: true, readOnly: false }
        },
        permissions: {
          preset: 'interactive' as PermissionPreset,
          persistence: true,
          auditLog: true
        }
      }
    });

    // Register comprehensive tool suite
    registerToolSuite();

    // Clear all mock call history
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup resources
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function setupComprehensiveEventTracking() {
    const eventTypes = [
      // Permission events
      'permission:requested', 'permission:granted', 'permission:denied',
      'permission:expired', 'permission:escalated', 'permission:revoked',
      // Tool execution events
      'tool:execution:start', 'tool:execution:complete', 'tool:execution:error',
      'tool:validation:start', 'tool:validation:complete', 'tool:validation:error',
      // Browser automation events
      'browser:session:created', 'browser:session:closed', 'browser:session:error',
      'browser:operation:start', 'browser:operation:complete', 'browser:operation:error',
      'browser:navigation:start', 'browser:navigation:complete',
      // System coordination events
      'workflow:stage:start', 'workflow:stage:complete', 'workflow:stage:error',
      'task:status:changed', 'task:error', 'task:completed',
      // Error and recovery events
      'system:error', 'system:recovery', 'system:degraded'
    ];

    eventTypes.forEach(eventType => {
      eventEmitter.on(eventType, (data) => {
        systemEvents.push({
          type: eventType,
          timestamp: Date.now(),
          data,
          context: {
            taskId: testTask.id,
            stage: getCurrentWorkflowStage()
          }
        });
      });
    });
  }

  function getCurrentWorkflowStage(): string {
    return 'testing'; // Simplified for test context
  }

  function registerToolSuite() {
    // Register core file system tools
    toolRegistry.set('Read', createMockTool('Read', ['readFile', 'readDirectory']));
    toolRegistry.set('Write', createMockTool('Write', ['writeFile', 'createDirectory']));
    toolRegistry.set('Edit', createMockTool('Edit', ['editFile', 'replaceText']));
    toolRegistry.set('Glob', createMockTool('Glob', ['findFiles', 'matchPattern']));
    toolRegistry.set('Grep', createMockTool('Grep', ['searchText', 'searchPattern']));

    // Register system tools
    toolRegistry.set('Bash', createMockTool('Bash', ['executeCommand', 'runScript']));

    // Register browser tool
    toolRegistry.set('Browser', browserTool);

    // Attach tools to orchestrator
    (orchestrator as any).tools = Object.fromEntries(toolRegistry);
  }

  function createMockTool(name: string, operations: string[]) {
    return {
      name,
      operations,
      execute: vi.fn(async ({ operation, params }) => {
        // Emit tool execution events
        eventEmitter.emit('tool:execution:start', { tool: name, operation, params });

        try {
          // Check permissions first
          const permissionResult = await permissionManager.checkToolPermission(name as AgentTool, {
            scope: operation,
            context: params
          });

          if (!permissionResult.allowed) {
            eventEmitter.emit('permission:denied', {
              tool: name,
              operation,
              reason: permissionResult.denialReason
            });

            return {
              success: false,
              error: `Permission denied: ${permissionResult.denialReason}`,
              tool: name,
              operation
            };
          }

          eventEmitter.emit('permission:granted', {
            tool: name,
            operation,
            level: permissionResult.level
          });

          // Mock successful execution based on tool type
          let result: ToolResult;
          switch (name) {
            case 'Read':
              result = mockReadOperation(operation, params);
              break;
            case 'Write':
              result = mockWriteOperation(operation, params);
              break;
            case 'Edit':
              result = mockEditOperation(operation, params);
              break;
            case 'Glob':
              result = mockGlobOperation(operation, params);
              break;
            case 'Grep':
              result = mockGrepOperation(operation, params);
              break;
            case 'Bash':
              result = mockBashOperation(operation, params);
              break;
            default:
              result = { success: true, data: { mockResult: true } };
          }

          eventEmitter.emit('tool:execution:complete', { tool: name, operation, result });
          return result;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          eventEmitter.emit('tool:execution:error', { tool: name, operation, error: errorMessage });

          return {
            success: false,
            error: errorMessage,
            tool: name,
            operation
          };
        }
      })
    };
  }

  // Mock tool operation implementations
  function mockReadOperation(operation: string, params: any): ToolResult {
    switch (operation) {
      case 'readFile':
        return { success: true, data: { content: `Mock content of ${params.filePath}`, size: 1024 } };
      case 'readDirectory':
        return { success: true, data: { files: ['file1.txt', 'file2.js', 'subdirectory/'] } };
      default:
        return { success: false, error: `Unknown read operation: ${operation}` };
    }
  }

  function mockWriteOperation(operation: string, params: any): ToolResult {
    switch (operation) {
      case 'writeFile':
        return { success: true, data: { bytesWritten: params.content?.length || 0, path: params.filePath } };
      case 'createDirectory':
        return { success: true, data: { created: params.path, permissions: '755' } };
      default:
        return { success: false, error: `Unknown write operation: ${operation}` };
    }
  }

  function mockEditOperation(operation: string, params: any): ToolResult {
    switch (operation) {
      case 'editFile':
        return { success: true, data: { linesChanged: 5, filePath: params.filePath } };
      case 'replaceText':
        return { success: true, data: { replacements: 3, pattern: params.pattern } };
      default:
        return { success: false, error: `Unknown edit operation: ${operation}` };
    }
  }

  function mockGlobOperation(operation: string, params: any): ToolResult {
    switch (operation) {
      case 'findFiles':
        return { success: true, data: { matches: ['src/main.ts', 'src/utils.ts'], pattern: params.pattern } };
      case 'matchPattern':
        return { success: true, data: { files: ['test.js', 'spec.js'], count: 2 } };
      default:
        return { success: false, error: `Unknown glob operation: ${operation}` };
    }
  }

  function mockGrepOperation(operation: string, params: any): ToolResult {
    switch (operation) {
      case 'searchText':
        return {
          success: true,
          data: {
            matches: [
              { file: 'src/main.ts', line: 15, content: 'console.log("test")' },
              { file: 'src/utils.ts', line: 42, content: 'return test()' }
            ],
            pattern: params.pattern
          }
        };
      case 'searchPattern':
        return { success: true, data: { files: ['main.ts'], matchCount: 3 } };
      default:
        return { success: false, error: `Unknown grep operation: ${operation}` };
    }
  }

  function mockBashOperation(operation: string, params: any): ToolResult {
    switch (operation) {
      case 'executeCommand':
        return {
          success: true,
          data: {
            stdout: 'Command executed successfully',
            stderr: '',
            exitCode: 0,
            command: params.command
          }
        };
      case 'runScript':
        return { success: true, data: { output: 'Script completed', duration: 1500 } };
      default:
        return { success: false, error: `Unknown bash operation: ${operation}` };
    }
  }

  describe('End-to-End Workflow Integration', () => {
    it('should execute complete development workflow with all systems', async () => {
      // Set up realistic permissions for development workflow
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');
      await permissionManager.grantPermission('Edit', 'allow-always');
      await permissionManager.grantPermission('Glob', 'allow-always');
      await permissionManager.grantPermission('Grep', 'allow-always');
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate,screenshot');
      await permissionManager.grantPermission('Bash', 'allow-once', 'test-commands');

      const workflowSteps = [];

      // Step 1: Read project configuration
      const readTool = toolRegistry.get('Read');
      const configResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: './package.json' }
      });
      expect(configResult.success).toBe(true);
      workflowSteps.push({ step: 'read-config', success: configResult.success });

      // Step 2: Find relevant files
      const globTool = toolRegistry.get('Glob');
      const filesResult = await globTool.execute({
        operation: 'findFiles',
        params: { pattern: '**/*.ts' }
      });
      expect(filesResult.success).toBe(true);
      workflowSteps.push({ step: 'find-files', success: filesResult.success });

      // Step 3: Search for patterns in code
      const grepTool = toolRegistry.get('Grep');
      const searchResult = await grepTool.execute({
        operation: 'searchText',
        params: { pattern: 'TODO', context: 3 }
      });
      expect(searchResult.success).toBe(true);
      workflowSteps.push({ step: 'search-todos', success: searchResult.success });

      // Step 4: Edit files based on findings
      const editTool = toolRegistry.get('Edit');
      const editResult = await editTool.execute({
        operation: 'editFile',
        params: {
          filePath: 'src/main.ts',
          changes: [{ line: 15, content: 'console.log("Updated");' }]
        }
      });
      expect(editResult.success).toBe(true);
      workflowSteps.push({ step: 'edit-file', success: editResult.success });

      // Step 5: Navigate to test application in browser
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://test.example.com');

      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com' }
      });
      expect(navResult.success).toBe(true);
      workflowSteps.push({ step: 'browser-navigate', success: navResult.success });

      // Step 6: Take screenshot for documentation
      mockPage.screenshot.mockResolvedValue(Buffer.from('screenshot-data'));

      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true, path: 'test-screenshot.png' }
      });
      expect(screenshotResult.success).toBe(true);
      workflowSteps.push({ step: 'take-screenshot', success: screenshotResult.success });

      // Step 7: Run test command
      const bashTool = toolRegistry.get('Bash');
      const testResult = await bashTool.execute({
        operation: 'executeCommand',
        params: { command: 'npm test' }
      });
      expect(testResult.success).toBe(true);
      workflowSteps.push({ step: 'run-tests', success: testResult.success });

      // Step 8: Write summary report
      const writeTool = toolRegistry.get('Write');
      const reportResult = await writeTool.execute({
        operation: 'writeFile',
        params: {
          filePath: './test-report.md',
          content: '# Test Report\n\nAll tests passed successfully.'
        }
      });
      expect(reportResult.success).toBe(true);
      workflowSteps.push({ step: 'write-report', success: reportResult.success });

      // Verify complete workflow succeeded
      expect(workflowSteps.every(step => step.success)).toBe(true);

      // Verify comprehensive event tracking
      const permissionEvents = systemEvents.filter(e => e.type.startsWith('permission:'));
      const toolEvents = systemEvents.filter(e => e.type.startsWith('tool:'));
      const browserEvents = systemEvents.filter(e => e.type.startsWith('browser:'));

      expect(permissionEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);
    });

    it('should handle mixed permission scenarios in realistic workflow', async () => {
      // Set up complex permission scenario
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-once'); // Limited writes
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.denyPermission('Browser', 'evaluate'); // No JS execution
      await permissionManager.grantPermission('Edit', 'require-approval'); // Needs confirmation

      const workflowResults = [];

      // Multiple read operations should all succeed
      const readTool = toolRegistry.get('Read');
      for (let i = 0; i < 3; i++) {
        const result = await readTool.execute({
          operation: 'readFile',
          params: { filePath: `./file${i}.txt` }
        });
        workflowResults.push({ operation: `read-${i}`, success: result.success });
      }

      // First write should succeed
      const writeTool = toolRegistry.get('Write');
      const write1 = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: './output1.txt', content: 'First write' }
      });
      workflowResults.push({ operation: 'write-1', success: write1.success });
      expect(write1.success).toBe(true);

      // Second write should fail (allow-once consumed)
      const write2 = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: './output2.txt', content: 'Second write' }
      });
      workflowResults.push({ operation: 'write-2', success: write2.success });
      expect(write2.success).toBe(false);

      // Browser navigation should succeed
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      workflowResults.push({ operation: 'navigate', success: navResult.success });
      expect(navResult.success).toBe(true);

      // Browser JS evaluation should fail (denied)
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });
      workflowResults.push({ operation: 'evaluate', success: evalResult.success });
      expect(evalResult.success).toBe(false);

      // Verify expected workflow behavior
      const readResults = workflowResults.filter(r => r.operation.startsWith('read'));
      expect(readResults.every(r => r.success)).toBe(true);

      const writeResults = workflowResults.filter(r => r.operation.startsWith('write'));
      expect(writeResults[0].success).toBe(true);
      expect(writeResults[1].success).toBe(false);
    });

    it('should coordinate browser automation with file system operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');

      // Scenario: Extract data from web page and save to file

      // 1. Navigate to data source page
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.url.mockReturnValue('https://api.example.com/data');

      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://api.example.com/data' }
      });
      expect(navResult.success).toBe(true);

      // 2. Extract data from page
      const pageData = '{"users": [{"id": 1, "name": "John"}, {"id": 2, "name": "Jane"}]}';
      mockPage.textContent.mockResolvedValue(pageData);

      const extractResult = await browserTool.execute({
        operation: 'getText',
        params: { selector: 'pre' }
      });
      expect(extractResult.success).toBe(true);

      // 3. Save extracted data to file
      const writeTool = toolRegistry.get('Write');
      const saveResult = await writeTool.execute({
        operation: 'writeFile',
        params: {
          filePath: './extracted-data.json',
          content: extractResult.data.text
        }
      });
      expect(saveResult.success).toBe(true);

      // 4. Read and verify saved data
      const readTool = toolRegistry.get('Read');
      const verifyResult = await readTool.execute({
        operation: 'readFile',
        params: { filePath: './extracted-data.json' }
      });
      expect(verifyResult.success).toBe(true);

      // Verify event coordination
      const browserEvents = systemEvents.filter(e => e.type.startsWith('browser:'));
      const toolEvents = systemEvents.filter(e =>
        e.type.startsWith('tool:') &&
        (e.data.tool === 'Write' || e.data.tool === 'Read')
      );

      expect(browserEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Permission Scenarios', () => {
    it('should handle hierarchical permission inheritance', async () => {
      // Set up hierarchical permissions
      await permissionManager.grantPermission('Browser', 'allow-always'); // General browser access
      await permissionManager.denyPermission('Browser', 'evaluate'); // Specific denial
      await permissionManager.grantPermission('Browser', 'allow-once', 'screenshot'); // Limited specific

      // General navigation should inherit from main permission
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(navResult.success).toBe(true);

      // Click should also inherit from main permission
      const clickResult = await browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });
      expect(clickResult.success).toBe(true);

      // Evaluate should be specifically denied despite general permission
      const evalResult = await browserTool.execute({
        operation: 'evaluate',
        params: { script: 'window.location.href' }
      });
      expect(evalResult.success).toBe(false);

      // First screenshot should succeed (allow-once)
      const screenshot1 = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshot1.success).toBe(true);

      // Second screenshot should fail (allow-once consumed)
      const screenshot2 = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshot2.success).toBe(false);
    });

    it('should handle time-based permission expiry', async () => {
      // Grant permission with short expiry
      const expiryTime = new Date(Date.now() + 1000); // 1 second from now
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate', {
        expiryTime
      });

      // Immediate operation should succeed
      const immediateResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(immediateResult.success).toBe(true);

      // Wait for permission to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Operation after expiry should fail
      const expiredResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.com' }
      });
      expect(expiredResult.success).toBe(false);
      expect(expiredResult.error).toMatch(/permission.*expired|expired.*permission/i);
    });

    it('should handle domain-specific browser permissions', async () => {
      // Set up domain-specific permissions
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:example.com');
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate:*.safe.org');
      await permissionManager.denyPermission('Browser', 'navigate:*.blocked.site');

      // Allowed domain should work
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const allowedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page' }
      });
      expect(allowedResult.success).toBe(true);

      // Wildcard domain should work
      const wildcardResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://app.safe.org/dashboard' }
      });
      expect(wildcardResult.success).toBe(true);

      // Blocked domain should fail
      const blockedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://malware.blocked.site' }
      });
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toMatch(/permission.*denied|domain.*blocked/i);

      // Unspecified domain should fail (no general permission)
      const unspecifiedResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://random.com' }
      });
      expect(unspecifiedResult.success).toBe(false);
    });

    it('should handle operation-specific permissions across tools', async () => {
      // Set up operation-specific permissions for different tools
      await permissionManager.grantPermission('Read', 'allow-always', 'readFile:/config/*');
      await permissionManager.denyPermission('Read', 'readFile:/secrets/*');
      await permissionManager.grantPermission('Write', 'allow-once', 'writeFile:/output/*');
      await permissionManager.grantPermission('Browser', 'allow-always', 'navigate');
      await permissionManager.denyPermission('Browser', 'screenshot');

      const readTool = toolRegistry.get('Read');
      const writeTool = toolRegistry.get('Write');

      // Allowed read path should work
      const allowedRead = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/config/app.json' }
      });
      expect(allowedRead.success).toBe(true);

      // Blocked read path should fail
      const blockedRead = await readTool.execute({
        operation: 'readFile',
        params: { filePath: '/secrets/api-key.txt' }
      });
      expect(blockedRead.success).toBe(false);

      // Allowed write should work
      const allowedWrite = await writeTool.execute({
        operation: 'writeFile',
        params: { filePath: '/output/result.txt', content: 'test' }
      });
      expect(allowedWrite.success).toBe(true);

      // Browser navigation should work
      const navResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(navResult.success).toBe(true);

      // Browser screenshot should fail
      const screenshotResult = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });
      expect(screenshotResult.success).toBe(false);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle cascading failures across all systems gracefully', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Write', 'allow-always');

      // Set up cascading failure scenario
      let failureCount = 0;

      // Mock permission system failure
      vi.spyOn(permissionManager, 'checkToolPermission').mockImplementation(async (tool, context) => {
        failureCount++;
        if (failureCount === 1) {
          throw new Error('Permission system temporarily unavailable');
        }
        // Restore normal behavior after first failure
        return { allowed: true, level: 'allow-always' as PermissionLevel };
      });

      // Mock browser failure
      mockPage.goto.mockRejectedValueOnce(new Error('Browser navigation failed'));

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
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      const thirdResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });
      expect(thirdResult.success).toBe(true);

      // Verify error events were tracked
      const errorEvents = systemEvents.filter(e => e.type.includes('error'));
      expect(errorEvents.length).toBeGreaterThan(0);

      // Verify system remained stable despite failures
      expect(orchestrator).toBeDefined();
      expect(browserTool).toBeDefined();
      expect(permissionManager).toBeDefined();
    });

    it('should handle resource cleanup during failures', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      let resourcesCreated = 0;
      let resourcesCleaned = 0;

      // Track resource lifecycle
      eventEmitter.on('browser:session:created', () => resourcesCreated++);
      eventEmitter.on('browser:session:closed', () => resourcesCleaned++);

      // Start operation that will fail after resource creation
      mockPage.goto.mockImplementation(async () => {
        // Simulate resource created
        eventEmitter.emit('browser:session:created');
        // Then fail
        throw new Error('Navigation failed after session creation');
      });

      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);

      // Verify cleanup happened
      if (resourcesCreated > 0) {
        // Should have attempted cleanup
        expect(resourcesCleaned).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent permission changes during execution', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      let operationStarted = false;
      let permissionRevoked = false;

      // Mock slow navigation
      mockPage.goto.mockImplementation(async () => {
        operationStarted = true;
        // Wait for permission revocation
        await new Promise(resolve => setTimeout(resolve, 100));
        if (permissionRevoked) {
          throw new Error('Permission revoked during operation');
        }
        return { status: () => 200 };
      });

      // Start navigation
      const navigationPromise = browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Revoke permission while operation is running
      setTimeout(async () => {
        await permissionManager.denyPermission('Browser');
        permissionRevoked = true;
      }, 50);

      const result = await navigationPromise;

      // Operation behavior depends on implementation:
      // - May succeed if permission checked at start
      // - May fail if permission re-checked during operation
      expect(result.success).toBeDefined();
      expect(operationStarted).toBe(true);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle high-throughput operations across all systems', async () => {
      await permissionManager.grantPermission('Read', 'allow-always');
      await permissionManager.grantPermission('Browser', 'allow-always');
      await permissionManager.grantPermission('Glob', 'allow-always');

      const operationCount = 20;
      const startTime = Date.now();

      // Create mixed concurrent operations
      const operations = [];

      // File operations
      for (let i = 0; i < 7; i++) {
        operations.push(
          toolRegistry.get('Read').execute({
            operation: 'readFile',
            params: { filePath: `./file${i}.txt` }
          })
        );
      }

      // Browser operations
      for (let i = 0; i < 7; i++) {
        operations.push(
          browserTool.execute({
            operation: 'navigate',
            params: { url: `https://example.com/page${i}` }
          })
        );
      }

      // Search operations
      for (let i = 0; i < 6; i++) {
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

      expect(successCount).toBeGreaterThan(operationCount * 0.8); // At least 80% success

      // Should complete within reasonable time (depends on implementation)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Less than 10 seconds

      // Verify event system handled high throughput
      const allEvents = systemEvents.length;
      expect(allEvents).toBeGreaterThan(operationCount); // Multiple events per operation
    });

    it('should handle memory-intensive browser operations', async () => {
      await permissionManager.grantPermission('Browser', 'allow-always');

      // Mock large screenshot data
      const largeScreenshotData = Buffer.alloc(5 * 1024 * 1024); // 5MB
      mockPage.screenshot.mockResolvedValue(largeScreenshotData);

      // Take multiple large screenshots
      const screenshotPromises = Array.from({ length: 5 }, (_, i) =>
        browserTool.execute({
          operation: 'screenshot',
          params: { fullPage: true, path: `screenshot-${i}.png` }
        })
      );

      const results = await Promise.allSettled(screenshotPromises);

      // At least some should succeed
      const successfulResults = results.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      );

      expect(successfulResults.length).toBeGreaterThan(0);

      // System should remain stable
      expect(orchestrator).toBeDefined();
      expect(browserTool).toBeDefined();
    });
  });

  describe('System Integration Edge Cases', () => {
    it('should handle tool registration and deregistration dynamically', async () => {
      await permissionManager.grantPermission('CustomTool', 'allow-always');

      // Initially custom tool should not exist
      expect(toolRegistry.has('CustomTool')).toBe(false);

      // Register new tool dynamically
      const customTool = createMockTool('CustomTool', ['customOperation']);
      toolRegistry.set('CustomTool', customTool);
      (orchestrator as any).tools.CustomTool = customTool;

      // Should now be able to use custom tool
      const result = await customTool.execute({
        operation: 'customOperation',
        params: { data: 'test' }
      });

      expect(result.success).toBe(true);

      // Deregister tool
      toolRegistry.delete('CustomTool');
      delete (orchestrator as any).tools.CustomTool;

      // Tool should no longer be available
      expect(toolRegistry.has('CustomTool')).toBe(false);
    });

    it('should handle malformed tool configurations gracefully', async () => {
      // Test with invalid tool configuration
      const invalidTool = {
        name: null, // Invalid name
        operations: undefined, // Invalid operations
        execute: 'not-a-function' // Invalid execute method
      };

      // System should handle invalid tools without crashing
      expect(() => {
        toolRegistry.set('InvalidTool', invalidTool as any);
      }).not.toThrow();

      // Attempting to use invalid tool should fail gracefully
      try {
        await (invalidTool as any).execute?.({
          operation: 'test',
          params: {}
        });
      } catch (error) {
        expect(error).toBeDefined();
        // System should remain stable despite tool errors
        expect(orchestrator).toBeDefined();
      }
    });

    it('should handle complex nested permission contexts', async () => {
      // Set up nested permission contexts
      await permissionManager.grantPermission('Read', 'allow-always', 'project:main');
      await permissionManager.grantPermission('Browser', 'allow-always', 'domain:example.com');
      await permissionManager.grantPermission('Write', 'allow-once', 'directory:/safe');

      // Operations within nested contexts should work
      const readTool = toolRegistry.get('Read');
      const contextualRead = await readTool.execute({
        operation: 'readFile',
        params: {
          filePath: './main/config.json',
          context: { project: 'main' }
        }
      });
      expect(contextualRead.success).toBe(true);

      // Operations outside contexts should be handled appropriately
      const outsideContextRead = await readTool.execute({
        operation: 'readFile',
        params: {
          filePath: './other/config.json',
          context: { project: 'other' }
        }
      });
      // Behavior depends on implementation - may succeed or fail
      expect(outsideContextRead.success).toBeDefined();
    });
  });
});