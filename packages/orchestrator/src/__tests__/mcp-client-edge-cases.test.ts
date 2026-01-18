/**
 * @fileoverview Additional edge case tests for MCPClientUtility
 *
 * These tests cover additional edge cases and boundary conditions
 * that supplement the comprehensive existing test suite.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MCPServerConfig } from '@apexcli/core';
import { MCPClientUtility } from '../mcp-client.js';

// Mock dependencies
vi.mock('child_process');
vi.mock('../mcp/index.js');

describe('MCPClientUtility - Additional Edge Cases', () => {
  let utility: MCPClientUtility;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the MCP client and transport
    vi.doMock('../mcp/index.js', () => ({
      MCPClient: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue([]),
        on: vi.fn(),
      })),
      StdioTransport: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        send: vi.fn(),
      })),
    }));

    const mockSpawn = vi.fn(() => ({
      on: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'spawn') {
          setTimeout(() => callback(), 10);
        }
        return { on: vi.fn() };
      }),
      kill: vi.fn(),
      killed: false,
      stderr: { on: vi.fn() },
    }));

    vi.doMock('child_process', () => ({
      spawn: mockSpawn,
    }));
  });

  afterEach(async () => {
    if (utility) {
      await utility.disconnectAll();
    }
    vi.restoreAllMocks();
  });

  describe('logging behavior', () => {
    it('should handle logging when disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      utility = new MCPClientUtility({
        enableLogging: false,
      });

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['./test.js'],
        autoStart: true,
      };

      await utility.connectServer(config);

      // Should not have called console.log since logging is disabled
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle logging when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      utility = new MCPClientUtility({
        enableLogging: true,
      });

      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['./test.js'],
        autoStart: true,
      };

      await utility.connectServer(config);

      // Should have logged connection messages
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MCPClientUtility]')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('boundary conditions', () => {
    beforeEach(() => {
      utility = new MCPClientUtility({
        enableLogging: false,
        maxConcurrentConnections: 1,
        defaultTimeoutMs: 1000,
      });
    });

    it('should handle empty server name gracefully', async () => {
      const config: MCPServerConfig = {
        name: '', // Empty but valid
        command: 'node',
        args: ['./test.js'],
        autoStart: true,
      };

      const result = await utility.connectServer(config);
      expect(result.success).toBe(true);
    });

    it('should handle server config with no args', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        // No args property
        autoStart: true,
      };

      const result = await utility.connectServer(config);
      expect(result.success).toBe(true);
    });

    it('should handle server config with empty args array', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: [], // Empty array
        autoStart: true,
      };

      const result = await utility.connectServer(config);
      expect(result.success).toBe(true);
    });

    it('should handle server config with no envVars', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['./test.js'],
        // No envVars property
        autoStart: true,
      };

      const result = await utility.connectServer(config);
      expect(result.success).toBe(true);
    });

    it('should handle server config with empty envVars array', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['./test.js'],
        envVars: [], // Empty array
        autoStart: true,
      };

      const result = await utility.connectServer(config);
      expect(result.success).toBe(true);
    });
  });

  describe('connection state edge cases', () => {
    beforeEach(() => {
      utility = new MCPClientUtility({
        enableLogging: false,
      });
    });

    it('should return false for hasActiveConnections when no connections exist', () => {
      expect(utility.hasActiveConnections()).toBe(false);
    });

    it('should return empty array for getConnections when no connections exist', () => {
      expect(utility.getConnections()).toEqual([]);
    });

    it('should return empty map for getAllTools when no connections exist', () => {
      const tools = utility.getAllTools();
      expect(tools.size).toBe(0);
    });

    it('should return undefined for getConnection with non-existent ID', () => {
      const connection = utility.getConnection('non-existent-id');
      expect(connection).toBeUndefined();
    });
  });

  describe('utility functions edge cases', () => {
    it('should handle createMCPClientUtility with undefined options', () => {
      const { createMCPClientUtility } = require('../mcp-client.js');
      const utility = createMCPClientUtility(undefined);
      expect(utility).toBeInstanceOf(MCPClientUtility);
    });

    it('should handle createMCPClientUtility with empty object', () => {
      const { createMCPClientUtility } = require('../mcp-client.js');
      const utility = createMCPClientUtility({});
      expect(utility).toBeInstanceOf(MCPClientUtility);
    });
  });
});