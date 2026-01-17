import { describe, it, expect } from 'vitest';
import { getMCPServers, getMCPConfig, isMCPEnabled } from '../config.js';
import { ApexConfig } from '../types.js';

/**
 * Test suite for new MCP configuration helper functions
 * Tests the utility functions added for easier MCP configuration access
 */
describe('MCP Configuration Helper Functions', () => {
  describe('getMCPServers', () => {
    it('should return empty object when no MCP config', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };

      const servers = getMCPServers(config);
      expect(servers).toEqual({});
    });

    it('should return servers when MCP config exists', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['filesystem-server'],
              autoStart: true,
            },
          },
        },
      };

      const servers = getMCPServers(config);
      expect(servers).toHaveProperty('filesystem');
      expect(servers.filesystem.name).toBe('Filesystem Server');
    });
  });

  describe('getMCPConfig', () => {
    it('should return default MCP config when none provided', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };

      const mcpConfig = getMCPConfig(config);
      expect(mcpConfig.enabled).toBe(true);
      expect(mcpConfig.servers).toEqual({});
      expect(mcpConfig.marketplace).toBeUndefined();
      expect(mcpConfig.connection).toBeUndefined();
    });

    it('should return full MCP config when provided', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: {
          enabled: false,
          servers: { test: { name: 'Test', type: 'stdio', command: 'test' } },
          marketplace: { url: 'https://example.com', enabled: true },
          connection: { maxRetries: 5 },
        },
      };

      const mcpConfig = getMCPConfig(config);
      expect(mcpConfig.enabled).toBe(false);
      expect(mcpConfig.servers).toHaveProperty('test');
      expect(mcpConfig.marketplace).toEqual({
        url: 'https://example.com',
        enabled: true,
      });
      expect(mcpConfig.connection).toEqual({ maxRetries: 5 });
    });
  });

  describe('isMCPEnabled', () => {
    it('should return true by default when no MCP config', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
      };

      expect(isMCPEnabled(config)).toBe(true);
    });

    it('should return configured value when MCP config exists', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: { enabled: false },
      };

      expect(isMCPEnabled(config)).toBe(false);
    });

    it('should return true when explicitly enabled', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        mcp: { enabled: true },
      };

      expect(isMCPEnabled(config)).toBe(true);
    });
  });
});