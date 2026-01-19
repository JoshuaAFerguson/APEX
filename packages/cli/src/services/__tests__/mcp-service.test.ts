import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpService } from '../mcp-service';
import { loadConfig, getMCPServers } from '@apexcli/core';
import type { ApexConfig, MCPServerConfig } from '@apexcli/core';

// Mock the @apexcli/core module
vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  getMCPServers: vi.fn(),
}));

describe('McpService', () => {
  let mcpService: McpService;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    mcpService = new McpService(mockProjectPath);
  });

  describe('getInstalledServers', () => {
    it('should return MCP servers from config when they exist', async () => {
      const mockConfig: Partial<ApexConfig> = {
        mcp: {
          enabled: true,
          servers: {
            'test-server': {
              name: 'test-server',
              type: 'stdio',
              command: 'test-command',
            } as MCPServerConfig,
          },
        },
      };

      const mockServers: Record<string, MCPServerConfig> = {
        'test-server': {
          name: 'test-server',
          type: 'stdio',
          command: 'test-command',
        } as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getInstalledServers();

      expect(loadConfig).toHaveBeenCalledWith(mockProjectPath);
      expect(getMCPServers).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual(mockServers);
    });

    it('should return empty object when no MCP servers are configured', async () => {
      const mockConfig: Partial<ApexConfig> = {
        mcp: {
          enabled: true,
          servers: {},
        },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.getInstalledServers();

      expect(result).toEqual({});
    });

    it('should throw descriptive error when APEX is not initialized', async () => {
      const error = new Error(`APEX not initialized in ${mockProjectPath}. Run 'apex init' first.`);
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        `Cannot read MCP servers: APEX not initialized in ${mockProjectPath}. Run 'apex init' first.`
      );
    });

    it('should throw wrapped error for other config loading failures', async () => {
      const error = new Error('Permission denied');
      vi.mocked(loadConfig).mockRejectedValue(error);

      await expect(mcpService.getInstalledServers()).rejects.toThrow(
        'Failed to read MCP server configuration: Permission denied'
      );
    });
  });

  describe('isMcpEnabled', () => {
    it('should return true when MCP is explicitly enabled', async () => {
      const mockConfig: Partial<ApexConfig> = {
        mcp: {
          enabled: true,
          servers: {},
        },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig as ApexConfig);

      const result = await mcpService.isMcpEnabled();

      expect(result).toBe(true);
    });

    it('should return false when MCP is explicitly disabled', async () => {
      const mockConfig: Partial<ApexConfig> = {
        mcp: {
          enabled: false,
          servers: {},
        },
      };

      vi.mocked(loadConfig).mockResolvedValue(mockConfig as ApexConfig);

      const result = await mcpService.isMcpEnabled();

      expect(result).toBe(false);
    });

    it('should return true when MCP config is not present (default)', async () => {
      const mockConfig: Partial<ApexConfig> = {};

      vi.mocked(loadConfig).mockResolvedValue(mockConfig as ApexConfig);

      const result = await mcpService.isMcpEnabled();

      expect(result).toBe(true);
    });
  });

  describe('getServerConfig', () => {
    it('should return server config when server exists', async () => {
      const mockServerConfig: MCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: 'test-command',
      } as MCPServerConfig;

      const mockServers = {
        'test-server': mockServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getServerConfig('test-server');

      expect(result).toEqual(mockServerConfig);
    });

    it('should return null when server does not exist', async () => {
      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.getServerConfig('non-existent-server');

      expect(result).toBeNull();
    });
  });

  describe('isServerInstalled', () => {
    it('should return true when server is configured', async () => {
      const mockServers = {
        'test-server': {} as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.isServerInstalled('test-server');

      expect(result).toBe(true);
    });

    it('should return false when server is not configured', async () => {
      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.isServerInstalled('test-server');

      expect(result).toBe(false);
    });
  });

  describe('getInstalledServerNames', () => {
    it('should return array of server names', async () => {
      const mockServers = {
        'server-1': {} as MCPServerConfig,
        'server-2': {} as MCPServerConfig,
        'server-3': {} as MCPServerConfig,
      };

      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue(mockServers);

      const result = await mcpService.getInstalledServerNames();

      expect(result).toEqual(['server-1', 'server-2', 'server-3']);
    });

    it('should return empty array when no servers are configured', async () => {
      vi.mocked(loadConfig).mockResolvedValue({} as ApexConfig);
      vi.mocked(getMCPServers).mockReturnValue({});

      const result = await mcpService.getInstalledServerNames();

      expect(result).toEqual([]);
    });
  });

  describe('constructor', () => {
    it('should use provided project path', () => {
      const customPath = '/custom/project/path';
      const service = new McpService(customPath);

      // The internal projectPath should be resolved absolute path
      expect(service).toBeInstanceOf(McpService);
    });

    it('should use current working directory when no path provided', () => {
      const service = new McpService();

      expect(service).toBeInstanceOf(McpService);
    });
  });
});