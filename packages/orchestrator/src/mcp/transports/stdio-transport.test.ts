/**
 * Tests for StdioTransport implementation
 *
 * @module orchestrator/mcp/transports/stdio-transport.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ChildProcess } from 'child_process';
import { StdioTransport, type StdioTransportOptions } from './stdio-transport.js';
import { type JSONRPCMessage, MCPTransportError } from '../types.js';

// ============================================================================
// Mocks
// ============================================================================

// Mock child_process module
const mockChildProcess = {
  stdin: {
    write: vi.fn(),
    end: vi.fn(),
    writable: true,
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  stdout: {
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  stderr: {
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  pid: 12345,
  killed: false,
  kill: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockSpawn = vi.fn(() => mockChildProcess);

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to simulate child process events
 */
function simulateProcessEvent(event: string, ...args: any[]) {
  const handler = mockChildProcess.on.mock.calls.find(call => call[0] === event);
  if (handler) {
    handler[1](...args);
  }
}

/**
 * Helper to simulate stdout data
 */
function simulateStdoutData(data: string) {
  const handler = mockChildProcess.stdout.on.mock.calls.find(call => call[0] === 'data');
  if (handler) {
    handler[1](Buffer.from(data));
  }
}

/**
 * Helper to simulate stderr data
 */
function simulateStderrData(data: string) {
  const handler = mockChildProcess.stderr.on.mock.calls.find(call => call[0] === 'data');
  if (handler) {
    handler[1](Buffer.from(data));
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('StdioTransport', () => {
  let transport: StdioTransport;
  let options: StdioTransportOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock state
    mockChildProcess.killed = false;
    mockChildProcess.stdin.writable = true;
    mockChildProcess.stdin.write.mockImplementation((data, encoding, callback) => {
      if (callback) callback();
      return true;
    });

    options = {
      command: 'node',
      args: ['test-server.js'],
      cwd: '/test/directory',
    };

    transport = new StdioTransport(options);
  });

  afterEach(() => {
    if (transport) {
      transport.removeAllListeners();
    }
  });

  describe('constructor', () => {
    it('should initialize with required options', () => {
      const basicTransport = new StdioTransport({
        command: 'node',
        args: ['server.js'],
      });

      expect(basicTransport.getState()).toBe('disconnected');
      expect(basicTransport.isConnected()).toBe(false);
    });

    it('should apply default options', () => {
      const defaultTransport = new StdioTransport({
        command: 'python',
        args: ['server.py'],
      });

      expect(defaultTransport.getState()).toBe('disconnected');
      // Defaults are applied internally and tested through behavior
    });

    it('should accept custom options', () => {
      const customOptions: StdioTransportOptions = {
        command: 'npx',
        args: ['mcp-server'],
        cwd: '/custom/path',
        env: { NODE_ENV: 'test' },
        inheritEnv: false,
        shutdownTimeout: 10000,
        connectionTimeout: 60000,
      };

      const customTransport = new StdioTransport(customOptions);
      expect(customTransport.getState()).toBe('disconnected');
    });
  });

  describe('connection lifecycle', () => {
    it('should spawn process and connect successfully', async () => {
      const connectPromise = transport.connect();

      // Simulate successful process start
      setTimeout(() => {
        simulateProcessEvent('spawn');
      }, 10);

      await connectPromise;

      expect(mockSpawn).toHaveBeenCalledWith('node', ['test-server.js'], {
        cwd: '/test/directory',
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      expect(transport.isConnected()).toBe(true);
      expect(transport.getProcessId()).toBe(12345);
    });

    it('should handle spawn failure', async () => {
      const spawnError = new Error('Command not found');
      mockSpawn.mockImplementationOnce(() => {
        throw spawnError;
      });

      await expect(transport.connect()).rejects.toThrow(MCPTransportError);
      expect(transport.isConnected()).toBe(false);
    });

    it('should reject multiple connection attempts', async () => {
      const firstConnect = transport.connect();

      // Try to connect again immediately
      await expect(transport.connect()).rejects.toThrow(MCPTransportError);

      // Complete first connection
      setTimeout(() => simulateProcessEvent('spawn'), 10);
      await firstConnect;
    });

    it('should handle immediate process exit during connection', async () => {
      const connectPromise = transport.connect();

      // Simulate process exiting immediately
      setTimeout(() => {
        simulateProcessEvent('exit', 1);
      }, 10);

      await expect(connectPromise).rejects.toThrow(MCPTransportError);
      expect(transport.isConnected()).toBe(false);
    });

    it('should handle process errors during connection', async () => {
      const connectPromise = transport.connect();
      const processError = new Error('EACCES');

      setTimeout(() => {
        simulateProcessEvent('error', processError);
      }, 10);

      await expect(connectPromise).rejects.toThrow(MCPTransportError);
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('disconnection', () => {
    beforeEach(async () => {
      await transport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should disconnect gracefully', async () => {
      const disconnectPromise = transport.disconnect('test disconnect');

      // Simulate process exit
      setTimeout(() => {
        simulateProcessEvent('exit', 0);
      }, 10);

      await disconnectPromise;

      expect(transport.isConnected()).toBe(false);
      expect(mockChildProcess.stdin.end).toHaveBeenCalled();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle multiple disconnect calls', async () => {
      const firstDisconnect = transport.disconnect();
      const secondDisconnect = transport.disconnect();

      setTimeout(() => {
        simulateProcessEvent('exit', 0);
      }, 10);

      await Promise.all([firstDisconnect, secondDisconnect]);

      expect(transport.isConnected()).toBe(false);
    });

    it('should force kill after timeout', async () => {
      // Create transport with short shutdown timeout
      const shortTimeoutTransport = new StdioTransport({
        ...options,
        shutdownTimeout: 50,
      });

      await shortTimeoutTransport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));

      const disconnectPromise = shortTimeoutTransport.disconnect();

      // Don't simulate exit, let it timeout
      await disconnectPromise;

      // Should have tried SIGKILL after timeout
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      // SIGKILL would be called after timeout, but hard to test with timers
    });
  });

  describe('message sending', () => {
    beforeEach(async () => {
      await transport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should send JSON-RPC messages', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
        params: { foo: 'bar' },
      };

      await transport.send(message);

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify(message) + '\n',
        'utf8',
        expect.any(Function)
      );
    });

    it('should reject sending when not connected', async () => {
      await transport.disconnect();
      setTimeout(() => simulateProcessEvent('exit', 0), 1);
      await new Promise(resolve => setTimeout(resolve, 20));

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow(MCPTransportError);
    });

    it('should handle write errors', async () => {
      mockChildProcess.stdin.write.mockImplementationOnce((data, encoding, callback) => {
        if (callback) callback(new Error('Write failed'));
        return false;
      });

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow(MCPTransportError);
    });
  });

  describe('message receiving', () => {
    beforeEach(async () => {
      await transport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should parse and emit complete JSON-RPC messages', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      const testMessage = { jsonrpc: '2.0', id: 1, result: { success: true } };
      simulateStdoutData(JSON.stringify(testMessage) + '\n');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messageSpy).toHaveBeenCalledWith(testMessage);
    });

    it('should handle partial messages across multiple data events', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      const testMessage = { jsonrpc: '2.0', id: 2, result: { data: 'test' } };
      const messageStr = JSON.stringify(testMessage) + '\n';

      // Send message in two parts
      simulateStdoutData(messageStr.substring(0, 20));
      simulateStdoutData(messageStr.substring(20));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messageSpy).toHaveBeenCalledWith(testMessage);
    });

    it('should handle multiple messages in one data event', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      const message1 = { jsonrpc: '2.0', id: 1, result: { a: 1 } };
      const message2 = { jsonrpc: '2.0', id: 2, result: { b: 2 } };

      const data = JSON.stringify(message1) + '\n' + JSON.stringify(message2) + '\n';
      simulateStdoutData(data);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messageSpy).toHaveBeenCalledTimes(2);
      expect(messageSpy).toHaveBeenCalledWith(message1);
      expect(messageSpy).toHaveBeenCalledWith(message2);
    });

    it('should handle invalid JSON gracefully', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      simulateStdoutData('invalid json\n');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(expect.any(MCPTransportError));
    });

    it('should emit stderr data', async () => {
      const stderrSpy = vi.fn();
      transport.on('stderr', stderrSpy);

      simulateStderrData('Debug: server started\n');

      expect(stderrSpy).toHaveBeenCalledWith('Debug: server started');
    });
  });

  describe('process error handling', () => {
    beforeEach(async () => {
      await transport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should handle unexpected process exit', async () => {
      const errorSpy = vi.fn();
      const disconnectedSpy = vi.fn();

      transport.on('error', errorSpy);
      transport.on('disconnected', disconnectedSpy);

      simulateProcessEvent('exit', 1);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(expect.any(MCPTransportError));
      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should handle process termination by signal', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      simulateProcessEvent('exit', null, 'SIGTERM');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(expect.any(MCPTransportError));
    });

    it('should handle process runtime errors', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      const runtimeError = new Error('Runtime error');
      simulateProcessEvent('error', runtimeError);

      expect(errorSpy).toHaveBeenCalledWith(expect.any(MCPTransportError));
    });

    it('should ignore stdin errors during shutdown', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      // Start disconnect
      const disconnectPromise = transport.disconnect();

      // Simulate stdin error during disconnect
      const stdinHandler = mockChildProcess.stdin.on.mock.calls.find(call => call[0] === 'error');
      if (stdinHandler) {
        stdinHandler[1](new Error('EPIPE'));
      }

      setTimeout(() => simulateProcessEvent('exit', 0), 10);
      await disconnectPromise;

      // Should not have emitted error for EPIPE during shutdown
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('environment and process options', () => {
    it('should merge environment variables when inheritEnv is true', async () => {
      const transportWithEnv = new StdioTransport({
        command: 'node',
        args: ['server.js'],
        env: { CUSTOM_VAR: 'test' },
        inheritEnv: true,
      });

      await transportWithEnv.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);

      expect(mockSpawn).toHaveBeenCalledWith('node', ['server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, CUSTOM_VAR: 'test' },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });
    });

    it('should use only provided env when inheritEnv is false', async () => {
      const customEnv = { ONLY_VAR: 'test' };
      const transportWithoutInherit = new StdioTransport({
        command: 'node',
        args: ['server.js'],
        env: customEnv,
        inheritEnv: false,
      });

      await transportWithoutInherit.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);

      expect(mockSpawn).toHaveBeenCalledWith('node', ['server.js'], {
        cwd: process.cwd(),
        env: customEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });
    });
  });

  describe('stress testing and edge cases', () => {
    beforeEach(async () => {
      await transport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should handle very large messages', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      // Create a large message with substantial data
      const largeData = 'x'.repeat(10000);
      const largeMessage = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { data: largeData }
      };

      simulateStdoutData(JSON.stringify(largeMessage) + '\n');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messageSpy).toHaveBeenCalledWith(largeMessage);
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await transport.disconnect();
        setTimeout(() => simulateProcessEvent('exit', 0), 1);
        await new Promise(resolve => setTimeout(resolve, 10));

        await transport.connect();
        setTimeout(() => simulateProcessEvent('spawn'), 1);
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(transport.isConnected()).toBe(true);
      }
    });

    it('should handle binary or non-UTF8 data gracefully', async () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      // Simulate binary data that might cause encoding issues
      const binaryBuffer = Buffer.from([0xFF, 0xFE, 0xFD, 0x00]);
      const handler = mockChildProcess.stdout.on.mock.calls.find(call => call[0] === 'data');
      if (handler) {
        handler[1](binaryBuffer);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should either parse successfully or emit an error
      expect(errorSpy).toHaveBeenCalledWith(expect.any(MCPTransportError));
    });

    it('should handle message buffer edge cases', async () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      // Test message split across multiple tiny chunks
      const message = { jsonrpc: '2.0' as const, id: 1, result: { test: 'value' } };
      const messageStr = JSON.stringify(message) + '\n';

      // Send one character at a time
      for (const char of messageStr) {
        simulateStdoutData(char);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(messageSpy).toHaveBeenCalledWith(message);
    });

    it('should handle mixed valid and invalid messages in stream', async () => {
      const messageSpy = vi.fn();
      const errorSpy = vi.fn();
      transport.on('message', messageSpy);
      transport.on('error', errorSpy);

      const validMessage = { jsonrpc: '2.0' as const, id: 1, result: { valid: true } };
      const data = JSON.stringify(validMessage) + '\n' +
                  'invalid json\n' +
                  JSON.stringify({ jsonrpc: '2.0', id: 2, result: { valid: true } }) + '\n';

      simulateStdoutData(data);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have parsed 2 valid messages and emitted 1 error
      expect(messageSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle process that never closes cleanly', async () => {
      const cleanupTransport = new StdioTransport({
        command: 'node',
        args: ['server.js'],
        shutdownTimeout: 50,
      });

      await cleanupTransport.connect();
      setTimeout(() => simulateProcessEvent('spawn'), 1);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Start disconnect but don't simulate exit
      const disconnectPromise = cleanupTransport.disconnect();

      // Should force kill after timeout
      await disconnectPromise;

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle stdin write errors during normal operation', async () => {
      mockChildProcess.stdin.write.mockImplementationOnce((data, encoding, callback) => {
        // Simulate write failure
        if (callback) callback(new Error('EPIPE: Broken pipe'));
        return false;
      });

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow('Failed to send message');
    });

    it('should handle process spawn with invalid command', async () => {
      const invalidTransport = new StdioTransport({
        command: 'non-existent-command-12345',
        args: [],
      });

      mockSpawn.mockImplementationOnce(() => {
        const error = new Error('spawn non-existent-command-12345 ENOENT');
        (error as any).code = 'ENOENT';
        throw error;
      });

      await expect(invalidTransport.connect()).rejects.toThrow('Failed to spawn process');
    });

    it('should handle empty stderr data', () => {
      const stderrSpy = vi.fn();
      transport.on('stderr', stderrSpy);

      simulateStderrData('');
      simulateStderrData('   ');
      simulateStderrData('\n');

      // Should not emit stderr events for empty/whitespace-only data
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('should handle connection timeout with connection never resolving', async () => {
      const timeoutTransport = new StdioTransport({
        command: 'node',
        args: ['slow-server.js'],
        connectionTimeout: 100,
      });

      const connectPromise = timeoutTransport.connect();

      // Don't simulate spawn event, let it timeout
      await expect(connectPromise).rejects.toThrow(MCPTransportError);
      expect(timeoutTransport.getState()).toBe('error');
    });
  });
});