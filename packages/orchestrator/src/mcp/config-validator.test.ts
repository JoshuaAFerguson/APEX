/**
 * ConfigValidator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigValidator } from './config-validator.js';
import type { MCPConfig, MCPServerConfig } from '@apexcli/core';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const validConfig: MCPConfig = {
        enabled: true,
        servers: {
          testServer: {
            name: 'testServer',
            type: 'stdio',
            command: 'npx',
            args: ['test-package'],
          },
        },
      };

      const result = validator.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidConfig: MCPConfig = {
        enabled: true,
        servers: {
          invalid: {
            name: 'invalid',
            type: 'stdio',
            // Missing command
          } as MCPServerConfig,
        },
      };

      const result = validator.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate server names', () => {
      const configWithDuplicates: MCPConfig = {
        enabled: true,
        servers: {
          server1: {
            name: 'duplicate',
            type: 'stdio',
            command: 'npx',
          },
          server2: {
            name: 'duplicate',
            type: 'stdio',
            command: 'node',
          },
        },
      };

      const result = validator.validateConfig(configWithDuplicates);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duplicate server names'))).toBe(true);
    });
  });

  describe('validateServerConfig', () => {
    it('should validate stdio server configuration', () => {
      const stdioServer: MCPServerConfig = {
        name: 'test',
        type: 'stdio',
        command: 'npx',
        args: ['package'],
      };

      const result = validator.validateServerConfig(stdioServer);
      expect(result.valid).toBe(true);
    });

    it('should validate http server configuration', () => {
      const httpServer: MCPServerConfig = {
        name: 'test',
        type: 'http',
        url: 'https://example.com/mcp',
      };

      const result = validator.validateServerConfig(httpServer);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid server type', () => {
      const invalidServer: MCPServerConfig = {
        name: 'test',
        type: 'invalid' as any,
        command: 'test',
      };

      const result = validator.validateServerConfig(invalidServer);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNKNOWN_SERVER_TYPE')).toBe(true);
    });

    it('should detect missing command for stdio servers', () => {
      const stdioWithoutCommand: MCPServerConfig = {
        name: 'test',
        type: 'stdio',
        // Missing command
      } as MCPServerConfig;

      const result = validator.validateServerConfig(stdioWithoutCommand);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Command is required'))).toBe(true);
    });

    it('should detect missing URL for http servers', () => {
      const httpWithoutUrl: MCPServerConfig = {
        name: 'test',
        type: 'http',
        // Missing URL
      } as MCPServerConfig;

      const result = validator.validateServerConfig(httpWithoutUrl);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('URL is required'))).toBe(true);
    });

    it('should validate URL format', () => {
      const invalidUrlServer: MCPServerConfig = {
        name: 'test',
        type: 'http',
        url: 'not-a-url',
      };

      const result = validator.validateServerConfig(invalidUrlServer);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_URL')).toBe(true);
    });

    it('should warn about HTTP URLs for non-local servers', () => {
      const httpServer: MCPServerConfig = {
        name: 'test',
        type: 'http',
        url: 'http://example.com/mcp',
      };

      const result = validator.validateServerConfig(httpServer);
      expect(result.warnings.some(w => w.message.includes('insecure'))).toBe(true);
    });

    it('should detect configuration conflicts', () => {
      const conflictedServer: MCPServerConfig = {
        name: 'test',
        type: 'stdio',
        command: 'npx',
        url: 'https://example.com', // Should not have URL for stdio
      };

      const result = validator.validateServerConfig(conflictedServer);
      expect(result.warnings.some(w => w.code === 'CONFLICTING_CONFIG')).toBe(true);
    });
  });

  describe('validateClaudeDesktopConfig', () => {
    it('should validate valid Claude Desktop configuration', () => {
      const claudeConfig = {
        mcpServers: {
          testServer: {
            command: 'npx',
            args: ['test-package'],
          },
        },
      };

      const result = validator.validateClaudeDesktopConfig(claudeConfig);
      expect(result.valid).toBe(true);
    });

    it('should detect missing mcpServers field', () => {
      const invalidConfig = {};

      const result = validator.validateClaudeDesktopConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('mcpServers'))).toBe(true);
    });

    it('should detect missing command in server config', () => {
      const configMissingCommand = {
        mcpServers: {
          testServer: {
            // Missing command
          },
        },
      };

      const result = validator.validateClaudeDesktopConfig(configMissingCommand);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Command is required'))).toBe(true);
    });

    it('should validate args array', () => {
      const configInvalidArgs = {
        mcpServers: {
          testServer: {
            command: 'npx',
            args: 'not-an-array',
          },
        },
      };

      const result = validator.validateClaudeDesktopConfig(configInvalidArgs);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('array'))).toBe(true);
    });
  });
});