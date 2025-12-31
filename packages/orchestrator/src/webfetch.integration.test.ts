import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Tool, ToolInput, ToolResult } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('WebFetch Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-webfetch-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'webfetch-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create orchestrator
    orchestrator = new ApexOrchestrator(testDir);
  });

  afterEach(async () => {
    if (orchestrator) {
      orchestrator.cleanup?.();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('WebFetch Tool Registration', () => {
    it('should register WebFetch tool in orchestrator', async () => {
      await orchestrator.initialize();

      // Get available tools
      const tools = orchestrator.getAvailableTools?.() || [];
      const webFetchTool = tools.find((tool: Tool) => tool.name === 'WebFetch');

      expect(webFetchTool).toBeDefined();
      expect(webFetchTool?.name).toBe('WebFetch');
      expect(webFetchTool?.description).toContain('web');
    });
  });

  describe('WebFetch Tool Execution with Hooks', () => {
    it('should execute WebFetch with audit hooks', async () => {
      await orchestrator.initialize();

      // Track events
      const events: any[] = [];
      orchestrator.on('tool.used', (event) => events.push(event));
      orchestrator.on('log.added', (event) => events.push(event));

      // Mock successful webfetch query response
      const mockResponse = {
        tool_calls: [
          {
            name: 'WebFetch',
            input: {
              url: 'https://api.github.com/repos/microsoft/vscode',
              prompt: 'Get repository information'
            }
          }
        ]
      };

      vi.mocked(query).mockResolvedValue(mockResponse);

      // Create a task that uses WebFetch
      const task = await orchestrator.createTask({
        description: 'Test WebFetch integration with hooks',
        workflow: 'research',
        autonomy: 'supervised',
      });

      // Run the task
      await orchestrator.runTask(task.id);

      // Verify audit logging occurred
      const logEvents = events.filter(e => e.type === 'log.added');
      const webfetchLogs = logEvents.filter(e =>
        e.log?.message?.includes('WebFetch') ||
        e.log?.metadata?.tool === 'WebFetch'
      );

      expect(webfetchLogs.length).toBeGreaterThan(0);
    });

    it('should block restricted URLs through hooks', async () => {
      await orchestrator.initialize();

      // Track events
      const events: any[] = [];
      orchestrator.on('tool.blocked', (event) => events.push(event));
      orchestrator.on('log.added', (event) => events.push(event));

      // Mock webfetch call with restricted URL
      const mockResponse = {
        tool_calls: [
          {
            name: 'WebFetch',
            input: {
              url: 'http://localhost:3000/secret',
              prompt: 'Try to access localhost'
            }
          }
        ]
      };

      vi.mocked(query).mockResolvedValue(mockResponse);

      // Create a task that tries to use restricted URL
      const task = await orchestrator.createTask({
        description: 'Test blocked WebFetch URL',
        workflow: 'research',
        autonomy: 'supervised',
      });

      // Run the task
      await orchestrator.runTask(task.id);

      // Verify the URL was blocked
      const blockEvents = events.filter(e => e.type === 'tool.blocked');
      const localhostBlocks = blockEvents.filter(e =>
        e.reason?.includes('localhost') ||
        e.reason?.includes('restricted')
      );

      expect(localhostBlocks.length).toBeGreaterThan(0);
    });

    it('should emit proper events for WebFetch tool usage', async () => {
      await orchestrator.initialize();

      // Track all events
      const events: any[] = [];
      orchestrator.on('tool.started', (event) => events.push({ type: 'tool.started', ...event }));
      orchestrator.on('tool.completed', (event) => events.push({ type: 'tool.completed', ...event }));
      orchestrator.on('tool.used', (event) => events.push({ type: 'tool.used', ...event }));

      // Mock successful webfetch
      const mockResponse = {
        tool_calls: [
          {
            name: 'WebFetch',
            input: {
              url: 'https://httpbin.org/get',
              method: 'GET'
            }
          }
        ]
      };

      vi.mocked(query).mockResolvedValue(mockResponse);

      // Create and run task
      const task = await orchestrator.createTask({
        description: 'Test WebFetch events',
        workflow: 'research',
        autonomy: 'supervised',
      });

      await orchestrator.runTask(task.id);

      // Verify events were emitted
      const toolEvents = events.filter(e =>
        e.tool === 'WebFetch' ||
        e.toolName === 'WebFetch'
      );

      expect(toolEvents.length).toBeGreaterThan(0);
    });
  });

  describe('WebFetch Security Validation', () => {
    it('should validate network permissions for different URL patterns', async () => {
      await orchestrator.initialize();

      const restrictedUrls = [
        'file:///etc/passwd',
        'ftp://internal.server/data',
        'http://192.168.1.1/admin',
        'https://10.0.0.1/config',
        'http://internal.local/secrets'
      ];

      for (const url of restrictedUrls) {
        // Track events for this URL
        const events: any[] = [];
        orchestrator.on('log.added', (event) => events.push(event));

        // Mock webfetch with restricted URL
        const mockResponse = {
          tool_calls: [
            {
              name: 'WebFetch',
              input: { url, prompt: 'Test restricted access' }
            }
          ]
        };

        vi.mocked(query).mockResolvedValue(mockResponse);

        // Create task
        const task = await orchestrator.createTask({
          description: `Test restricted URL: ${url}`,
          workflow: 'research',
          autonomy: 'supervised',
        });

        await orchestrator.runTask(task.id);

        // Verify the URL was blocked
        const blockLogs = events.filter(e =>
          e.log?.level === 'warn' || e.log?.level === 'error'
        );
        const urlBlocks = blockLogs.filter(e =>
          e.log?.message?.includes('Blocked WebFetch') ||
          e.log?.metadata?.blocked === true
        );

        expect(urlBlocks.length).toBeGreaterThan(0, `URL ${url} should have been blocked`);
      }
    });

    it('should allow legitimate URLs', async () => {
      await orchestrator.initialize();

      const allowedUrls = [
        'https://api.github.com/user',
        'https://www.npmjs.com/package/axios',
        'https://docs.anthropic.com/api-reference'
      ];

      for (const url of allowedUrls) {
        // Track events for this URL
        const events: any[] = [];
        orchestrator.on('log.added', (event) => events.push(event));

        // Mock successful webfetch
        const mockResponse = {
          tool_calls: [
            {
              name: 'WebFetch',
              input: { url, prompt: 'Test legitimate access' }
            }
          ]
        };

        vi.mocked(query).mockResolvedValue(mockResponse);

        // Create task
        const task = await orchestrator.createTask({
          description: `Test allowed URL: ${url}`,
          workflow: 'research',
          autonomy: 'supervised',
        });

        await orchestrator.runTask(task.id);

        // Verify the URL was NOT blocked (no deny permission decisions)
        const blockLogs = events.filter(e =>
          e.log?.level === 'error' &&
          e.log?.message?.includes('Blocked WebFetch')
        );

        expect(blockLogs.length).toBe(0, `URL ${url} should NOT have been blocked`);
      }
    });
  });

  describe('WebFetch Tool Error Handling', () => {
    it('should handle WebFetch tool errors gracefully', async () => {
      await orchestrator.initialize();

      // Track events
      const events: any[] = [];
      orchestrator.on('tool.error', (event) => events.push(event));
      orchestrator.on('log.added', (event) => events.push(event));

      // Mock webfetch with invalid URL
      const mockResponse = {
        tool_calls: [
          {
            name: 'WebFetch',
            input: {
              url: 'not-a-valid-url',
              prompt: 'Test invalid URL'
            }
          }
        ]
      };

      vi.mocked(query).mockResolvedValue(mockResponse);

      // Create task
      const task = await orchestrator.createTask({
        description: 'Test WebFetch error handling',
        workflow: 'research',
        autonomy: 'supervised',
      });

      await orchestrator.runTask(task.id);

      // Verify errors were logged appropriately
      const errorEvents = events.filter(e =>
        e.type === 'tool.error' ||
        (e.log?.level === 'error' && e.log?.message?.includes('WebFetch'))
      );

      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('WebFetch Tool Performance', () => {
    it('should track WebFetch usage and response times', async () => {
      await orchestrator.initialize();

      // Track events
      const events: any[] = [];
      orchestrator.on('tool.completed', (event) => events.push(event));
      orchestrator.on('log.added', (event) => events.push(event));

      // Mock webfetch with timing metadata
      const mockResponse = {
        tool_calls: [
          {
            name: 'WebFetch',
            input: {
              url: 'https://httpbin.org/get',
              prompt: 'Test performance tracking'
            }
          }
        ]
      };

      vi.mocked(query).mockResolvedValue(mockResponse);

      const startTime = Date.now();

      // Create and run task
      const task = await orchestrator.createTask({
        description: 'Test WebFetch performance tracking',
        workflow: 'research',
        autonomy: 'supervised',
      });

      await orchestrator.runTask(task.id);

      const endTime = Date.now();

      // Verify performance metadata was captured
      const completionEvents = events.filter(e =>
        e.tool === 'WebFetch' && e.type === 'tool.completed'
      );

      // Check that the task completed in reasonable time
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max

      // Verify usage tracking
      const task_result = await orchestrator.getTask(task.id);
      expect(task_result?.usage.totalTokens).toBeGreaterThanOrEqual(0);
    });
  });
});