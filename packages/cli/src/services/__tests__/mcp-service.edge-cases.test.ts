import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpService } from '../mcp-service';
import { loadConfig, getMCPServers } from '@apexcli/core';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';

// Mock the @apexcli/core module
vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  getMCPServers: vi.fn(),
}));

/**
 * Edge case tests for McpService
 * Tests unusual configurations, error conditions, and boundary cases
 */
describe('McpService Edge Cases', () => {
  let mcpService: McpService;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    mcpService = new McpService(mockProjectPath);
  });

  describe('Complex server configurations', () => {
    it('should handle servers with minimal configuration', async () => {
      const mockConfig: Partial<ApexConfig> = {
        mcp: {
          enabled: true,
          servers: {
            'minimal-server': {
              name: 'minimal-server',
              type: 'stdio',
              // No command, args, or env fields
            } as MCPServerConfig,
          },
        },
      };

      const mockServers: Record<string, MCPServerConfig> = {
        'minimal-server': {
          name: 'minimal-server',
          type: 'stdio',
        } as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getInstalledServers();

      expect(result).toEqual(mockServers);
      expect(result['minimal-server'].name).toBe('minimal-server');
    });

    it('should handle servers with special characters in names', async () => {
      const mockServers: Record<string, MCPServerConfig> = {
        'server-with-dashes': {
          name: 'server-with-dashes',
          type: 'stdio',
          command: 'test'
        } as MCPServerConfig,
        'server_with_underscores': {
          name: 'server_with_underscores',
          type: 'stdio',
          command: 'test'
        } as MCPServerConfig,
        'server.with.dots': {
          name: 'server.with.dots',
          type: 'stdio',
          command: 'test'
        } as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getInstalledServers();

      expect(Object.keys(result)).toHaveLength(3);
      expect(result).toHaveProperty('server-with-dashes');
      expect(result).toHaveProperty('server_with_underscores');
      expect(result).toHaveProperty('server.with.dots');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle null error from loadConfig', async () => {
      vi.mocked(loadConfig).mockRejectedValue(null);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: null'
      );
    });

    it('should handle undefined error from loadConfig', async () => {
      vi.mocked(loadConfig).mockRejectedValue(undefined);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: undefined'
      );
    });

    it('should handle error object without message', async () => {
      const errorWithoutMessage = { code: 'ENOENT', path: '/missing/file' };
      vi.mocked(loadConfig).mockRejectedValue(errorWithoutMessage);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: [object Object]'
      );
    });
  });

  describe('getMCPServers function edge cases', () => {
    it('should handle when getMCPServers throws an error', async () => {
      const mockConfig: ApexConfig = {} as ApexConfig;
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(getMCPServers).mockImplementation(() => {
        throw new Error('getMCPServers failed');
      });

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: getMCPServers failed'
      );
    });

    it('should handle when getMCPServers returns null', async () => {
      const mockConfig: ApexConfig = {} as ApexConfig;
      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      // @ts-expect-error Testing edge case where function returns unexpected type
      vi.mocked(getMCPServers).mockReturnValue(null);

      const result = await mcpService.getInstalledServers();
      expect(result).toBeNull();
    });
  });

  describe('Multiple concurrent calls', () => {
    it('should handle multiple concurrent calls to getInstalledServers', async () => {
      const mockServers: Record<string, MCPServerConfig> = {
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'test'
        } as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      // Call multiple times concurrently
      const promises = [
        mcpService.getInstalledServers(),
        mcpService.getInstalledServers(),
        mcpService.getInstalledServers()
      ];

      const results = await Promise.all(promises);

      // All calls should return the same result
      results.forEach(result => {
        expect(result).toEqual(mockServers);
      });

      // loadConfig should have been called multiple times
      expect(loadConfig).toHaveBeenCalledTimes(3);
    });
  });

  describe('Path edge cases', () => {
    it('should handle relative path normalization', () => {
      const service1 = new McpService('./relative/path');
      const service2 = new McpService('../another/path');

      // Services should be created without throwing
      expect(service1).toBeInstanceOf(McpService);
      expect(service2).toBeInstanceOf(McpService);
    });

    it('should handle empty path gracefully', () => {
      const service = new McpService('');
      expect(service).toBeInstanceOf(McpService);
    });
  });
});