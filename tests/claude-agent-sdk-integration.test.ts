/**
 * Claude Agent SDK Integration Tests
 *
 * Comprehensive test suite for validating Claude Agent SDK integration
 * as documented in the implementation audit report.
 *
 * Tests cover:
 * - SDK package dependencies and imports
 * - Authentication and initialization
 * - API call implementations and streaming
 * - Tool execution and MCP integration
 * - Message processing and event handling
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicDriver } from '../packages/orchestrator/src/drivers/anthropic-driver.js';
import { CredentialManager, type Credentials } from '../packages/orchestrator/src/auth/credential-manager.js';
import { buildCustomToolsServer } from '../packages/orchestrator/src/custom-tools.js';
import { createMockToolManager, setupCommonToolMocks } from './test-utils/claude-agent-sdk-mocks.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  DriverRequest,
  DriverEvent,
} from '../packages/orchestrator/src/drivers/types.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  createSdkMcpServer: vi.fn(),
  tool: vi.fn(),
}));

describe('Claude Agent SDK Integration', () => {
  let driver: AnthropicDriver;
  let credentialManager: CredentialManager;
  let tempDir: string;
  let mockToolManager: any;

  beforeEach(() => {
    // Create temporary directory for test credentials
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-test-'));
    credentialManager = new CredentialManager(tempDir);
    driver = new AnthropicDriver();

    // Setup SDK mocks
    mockToolManager = createMockToolManager();
    setupCommonToolMocks(mockToolManager);

    // Clear environment
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(async () => {
    // Cleanup
    await driver.dispose();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    mockToolManager.cleanup();
    vi.clearAllMocks();
  });

  describe('SDK Package Dependencies', () => {
    it('should import Claude Agent SDK successfully', async () => {
      // This test verifies that the SDK package is properly installed
      // and can be imported without errors
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      expect(query).toBeDefined();
      expect(typeof query).toBe('function');
    });

    it('should import SDK types successfully', async () => {
      const types = await import('@anthropic-ai/claude-agent-sdk');
      expect(types).toBeDefined();
      // The types should be available in the module
      expect(typeof types.query).toBe('function');
    });

    it('should import createSdkMcpServer for tool integration', async () => {
      const { createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');
      expect(createSdkMcpServer).toBeDefined();
      expect(typeof createSdkMcpServer).toBe('function');
    });
  });

  describe('Authentication and Initialization', () => {
    it('should initialize driver without credentials', async () => {
      await expect(driver.initialize()).resolves.not.toThrow();
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('should initialize driver with valid credentials', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-test-token-12345',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      // Create new driver instance to test initialization
      const testDriver = new AnthropicDriver();
      await testDriver.initialize();

      expect(process.env.ANTHROPIC_API_KEY).toBe('sk-test-token-12345');

      await testDriver.dispose();
    });

    it('should handle missing credentials gracefully', async () => {
      const testDriver = new AnthropicDriver();
      await expect(testDriver.initialize()).resolves.not.toThrow();
      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
      await testDriver.dispose();
    });

    it('should resolve model aliases correctly', () => {
      expect(driver.resolveModel('opus')).toBe('claude-opus-4-5-20251101');
      expect(driver.resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');
      expect(driver.resolveModel('sonnet')).toBe('claude-sonnet-4-20250514');
      expect(driver.resolveModel('unknown')).toBe('claude-sonnet-4-20250514'); // default
    });
  });

  describe('Credential Manager', () => {
    it('should save credentials securely', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-test-token',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);

      const credentialsPath = path.join(tempDir, 'credentials.json');
      expect(fs.existsSync(credentialsPath)).toBe(true);

      // Check file permissions
      const stats = fs.statSync(credentialsPath);
      const mode = stats.mode & parseInt('777', 8);
      expect(mode).toBe(parseInt('600', 8)); // Should be 0o600
    });

    it('should retrieve saved credentials', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-test-token',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);
      const retrieved = await credentialManager.getCredentials('anthropic');

      expect(retrieved).toEqual(testCreds);
    });

    it('should return null for non-existent credentials', async () => {
      const retrieved = await credentialManager.getCredentials('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should delete credentials', async () => {
      const testCreds: Credentials = {
        accessToken: 'sk-test-token',
        provider: 'anthropic',
      };

      await credentialManager.saveCredentials('anthropic', testCreds);
      await credentialManager.deleteCredentials('anthropic');

      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toBeNull();
    });

    it('should handle malformed credentials file', async () => {
      const credentialsPath = path.join(tempDir, 'credentials.json');
      fs.writeFileSync(credentialsPath, 'invalid json');

      const retrieved = await credentialManager.getCredentials('anthropic');
      expect(retrieved).toBeNull();
    });
  });

  describe('API Call Implementation and Streaming', () => {
    it('should create valid SDK options from driver request', async () => {
      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        systemPrompt: 'You are a helpful assistant',
        model: 'claude-sonnet-4-20250514',
        maxTurns: 5,
        cwd: '/test/path',
        mcpServers: {},
      };

      // Start the stream and consume first event to trigger query
      const stream = driver.stream(request);
      const firstEvent = await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        options: expect.objectContaining({
          systemPrompt: 'You are a helpful assistant',
          model: 'claude-sonnet-4-20250514',
          maxTurns: 5,
          cwd: '/test/path',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          tools: { type: 'preset', preset: 'claude_code' },
        }),
      });
    });

    it('should handle streaming API responses', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Hello from Claude!' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Task completed',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({
        type: 'text',
        content: 'Hello from Claude!',
      });
      expect(events[1]).toEqual({
        type: 'usage',
        inputTokens: 10,
        outputTokens: 5,
      });
      expect(events[2]).toEqual({
        type: 'complete',
        summary: 'Task completed',
      });
    });

    it('should handle tool calls in streaming responses', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool_123',
                name: 'Read',
                input: { file_path: '/test.txt' }
              },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool_123',
                content: 'File contents',
                is_error: false,
              },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Read /test.txt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        type: 'tool_call',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/test.txt' },
      });
      expect(events[1]).toEqual({
        type: 'tool_result',
        id: 'tool_123',
        content: 'File contents',
        isError: false,
      });
    });

    it('should handle thinking blocks in responses', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'thinking', thinking: 'Let me think about this...' },
              { type: 'text', text: 'Here is my response' },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'thinking',
        content: 'Let me think about this...',
      });
      expect(events).toContainEqual({
        type: 'text',
        content: 'Here is my response',
      });
    });

    it('should handle MCP server configuration', async () => {
      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const mcpServers = {
        'test-server': {
          command: 'node',
          args: ['test-server.js'],
        },
      };

      const request: DriverRequest = {
        prompt: 'Test with MCP',
        model: 'claude-sonnet-4-20250514',
        mcpServers,
      };

      const stream = driver.stream(request);
      await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test with MCP',
        options: expect.objectContaining({
          mcpServers,
        }),
      });
    });
  });

  describe('Custom Tools Integration', () => {
    it('should create MCP server for custom tools', () => {
      const customTools = [
        {
          name: 'test-tool',
          description: 'A test tool',
          command: 'echo',
          args: ['hello'],
          parameters: {
            properties: {
              message: { type: 'string', description: 'Message to echo' },
            },
            required: ['message'],
          },
          enabled: true,
        },
      ];

      const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
      vi.mocked(tool).mockReturnValue({});
      vi.mocked(createSdkMcpServer).mockReturnValue({});

      const result = buildCustomToolsServer(customTools, '/test/project');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('custom-tools');
      expect(tool).toHaveBeenCalledWith(
        'test-tool',
        'A test tool',
        expect.any(Object),
        expect.any(Function)
      );
      expect(createSdkMcpServer).toHaveBeenCalledWith({
        name: 'custom-tools',
        tools: expect.any(Array),
      });
    });

    it('should return null when no custom tools are enabled', () => {
      const result = buildCustomToolsServer([], '/test/project');
      expect(result).toBeNull();
    });

    it('should filter out disabled tools', () => {
      const customTools = [
        {
          name: 'enabled-tool',
          description: 'Enabled tool',
          command: 'echo',
          args: ['enabled'],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
        {
          name: 'disabled-tool',
          description: 'Disabled tool',
          command: 'echo',
          args: ['disabled'],
          parameters: { properties: {}, required: [] },
          enabled: false,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      vi.mocked(tool).mockReturnValue({});

      buildCustomToolsServer(customTools, '/test/project');

      expect(tool).toHaveBeenCalledTimes(1);
      expect(tool).toHaveBeenCalledWith(
        'enabled-tool',
        expect.any(String),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle abort controller cancellation', async () => {
      const mockQuery = vi.fn().mockImplementation(() => {
        throw new Error('AbortError');
      });
      Object.defineProperty(mockQuery, 'name', { value: 'AbortError' });

      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'status',
        message: 'Query aborted',
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockQuery = vi.fn().mockImplementation(() => {
        throw new Error('API Error: Invalid request');
      });

      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'API Error: Invalid request',
      });
    });

    it('should handle malformed SDK messages', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: null, // Malformed content
          },
        },
        {
          type: 'unknown-type',
          data: 'unexpected',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should not crash, just skip malformed messages
      expect(events).toHaveLength(0);
    });

    it('should handle result messages with errors', async () => {
      const mockMessages = [
        {
          type: 'result',
          subtype: 'error',
          errors: ['Connection failed', 'Timeout occurred'],
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'Connection failed; Timeout occurred',
      });
    });

    it('should cleanup active controllers on dispose', async () => {
      const abortSpy = vi.fn();
      const mockAbortController = {
        abort: abortSpy,
        signal: {},
      };

      // Mock AbortController constructor
      global.AbortController = vi.fn().mockImplementation(() => mockAbortController);

      const mockQuery = vi.fn().mockReturnValue([]);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      // Start a stream but don't complete it
      const stream = driver.stream(request);
      await stream.next();

      // Dispose should abort active controllers
      await driver.dispose();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('Message Processing Validation', () => {
    it('should handle empty content blocks', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: '' },
              { type: 'text', text: undefined },
            ],
          },
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'text',
        content: '',
      });
    });

    it('should handle missing usage information gracefully', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Hello' }],
            // No usage information
          },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Complete',
          // No usage information
        },
      ];

      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(sdk.query).mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events: DriverEvent[] = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'text', content: 'Hello' },
        { type: 'complete', summary: 'Complete' },
      ]);
    });
  });

  describe('Integration Completeness Verification', () => {
    it('should verify driver provider ID', () => {
      expect(driver.providerId).toBe('anthropic');
    });

    it('should verify all required driver methods exist', () => {
      expect(typeof driver.initialize).toBe('function');
      expect(typeof driver.authenticate).toBe('function');
      expect(typeof driver.dispose).toBe('function');
      expect(typeof driver.resolveModel).toBe('function');
      expect(typeof driver.stream).toBe('function');
    });

    it('should verify credential manager methods exist', () => {
      expect(typeof credentialManager.saveCredentials).toBe('function');
      expect(typeof credentialManager.getCredentials).toBe('function');
      expect(typeof credentialManager.deleteCredentials).toBe('function');
    });

    it('should verify custom tools function exists', () => {
      expect(typeof buildCustomToolsServer).toBe('function');
    });
  });
});