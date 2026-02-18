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
 * Test Coverage Verification for McpService
 * This test file ensures all public methods and branches are covered
 */
describe('McpService Test Coverage Verification', () => {
  let mcpService: McpService;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    mcpService = new McpService(mockProjectPath);
  });

  describe('Constructor coverage', () => {
    it('should create instance with provided path', () => {
      const service = new McpService('/custom/path');
      expect(service).toBeInstanceOf(McpService);
    });

    it('should create instance with default path', () => {
      const service = new McpService();
      expect(service).toBeInstanceOf(McpService);
    });
  });

  describe('getInstalledServers method coverage', () => {
    it('should cover successful path with servers', async () => {
      const mockConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              name: 'test-server',
              type: 'stdio',
              command: 'test-cmd',
            } as MCPServerConfig,
          },
        },
      };

      const mockServers = {
        'test-server': mockConfig.mcp!.servers!['test-server']
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getInstalledServers();

      expect(loadConfig).toHaveBeenCalledWith(mockProjectPath);
      expect(getMCPServers).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual(mockServers);
    });

    it('should cover APEX not initialized error path', async () => {
      const error = new Error('APEX not initialized in /test. Run \'apex init\' first.');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Cannot read MCP servers: APEX not initialized in /test/project. Run \'apex init\' first.'
      );
    });

    it('should cover general error path', async () => {
      const error = new Error('File system error');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: File system error'
      );
    });

    it('should cover non-Error exception path', async () => {
      vi.mocked(loadConfig).mockRejectedValue('String error');

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: String error'
      );
    });
  });

  describe('isMcpEnabled method coverage', () => {
    it('should cover explicit true path', async () => {
      const mockConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: { enabled: true, servers: {} },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      const result = await mcpService.isMcpEnabled();
      expect(result).toBe(true);
    });

    it('should cover explicit false path', async () => {
      const mockConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: { enabled: false, servers: {} },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      const result = await mcpService.isMcpEnabled();
      expect(result).toBe(false);
    });

    it('should cover default true path when mcp config missing', async () => {
      const mockConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      const result = await mcpService.isMcpEnabled();
      expect(result).toBe(true);
    });

    it('should cover default true path when enabled is undefined', async () => {
      const mockConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: { servers: {} }, // enabled is undefined
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig);

      const result = await mcpService.isMcpEnabled();
      expect(result).toBe(true);
    });

    it('should cover APEX not initialized error path', async () => {
      const error = new Error('APEX not initialized in /test. Run \'apex init\' first.');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(mcpService.isMcpEnabled()).rejects.toThrow(
        'Cannot check MCP status: APEX not initialized in /test/project. Run \'apex init\' first.'
      );
    });

    it('should cover general error path', async () => {
      const error = new Error('Configuration error');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(mcpService.isMcpEnabled()).rejects.toThrow(
        'Failed to check MCP configuration: Configuration error'
      );
    });
  });

  describe('getServerConfig method coverage', () => {
    it('should cover server found path', async () => {
      const mockServerConfig: MCPServerConfig = {
        name: 'found-server',
        type: 'stdio',
        command: 'test-cmd',
      } as MCPServerConfig;

      const mockServers = {
        'found-server': mockServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getServerConfig('found-server');
      expect(result).toEqual(mockServerConfig);
    });

    it('should cover server not found path', async () => {
      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.getServerConfig('missing-server');
      expect(result).toBeNull();
    });

    it('should cover server key exists but value is falsy', async () => {
      const mockServers = {
        'empty-server': undefined as any,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getServerConfig('empty-server');
      expect(result).toBeNull();
    });
  });

  describe('isServerInstalled method coverage', () => {
    it('should cover server installed path', async () => {
      const mockServers = {
        'installed-server': {} as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.isServerInstalled('installed-server');
      expect(result).toBe(true);
    });

    it('should cover server not installed path', async () => {
      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.isServerInstalled('missing-server');
      expect(result).toBe(false);
    });
  });

  describe('getInstalledServerNames method coverage', () => {
    it('should cover servers exist path', async () => {
      const mockServers = {
        'server-1': {} as MCPServerConfig,
        'server-2': {} as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getInstalledServerNames();
      expect(result).toEqual(['server-1', 'server-2']);
    });

    it('should cover no servers path', async () => {
      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.getInstalledServerNames();
      expect(result).toEqual([]);
    });
  });
});