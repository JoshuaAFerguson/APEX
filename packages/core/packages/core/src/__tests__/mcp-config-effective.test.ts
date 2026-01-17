import { describe, it, expect } from 'vitest';
import { getEffectiveConfig } from '../config.js';
import { ApexConfig } from '../types.js';

/**
 * Tests for getEffectiveConfig function handling of MCP configuration
 * Ensures default values are applied correctly and user values are preserved
 */
describe('getEffectiveConfig MCP Configuration Handling', () => {
  describe('MCP defaults when not specified', () => {
    it('should apply MCP defaults when MCP section is missing', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp).toBeDefined();
      expect(effective.mcp.enabled).toBe(true);
      expect(effective.mcp.servers).toEqual({});
      expect(effective.mcp.marketplace).toBeUndefined();
      expect(effective.mcp.connection).toBeUndefined();
    });

    it('should apply partial MCP defaults when MCP section is partially defined', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          servers: {
            'test-server': {
              name: 'Test Server',
              type: 'stdio',
              command: 'node',
              autoStart: true,
            },
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(true); // default value
      expect(effective.mcp.servers).toEqual(config.mcp?.servers);
      expect(effective.mcp.marketplace).toBeUndefined();
      expect(effective.mcp.connection).toBeUndefined();
    });
  });

  describe('MCP value preservation', () => {
    it('should preserve explicitly set MCP values', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: false,
          servers: {
            'custom-server': {
              name: 'Custom Server',
              type: 'http',
              url: 'https://api.example.com/mcp',
              headers: {
                'Authorization': 'Bearer token123',
              },
              autoStart: false,
              capabilities: ['custom'],
              connection: {
                maxRetries: 5,
                timeoutMs: 45000,
              },
            },
          },
          marketplace: {
            url: 'https://custom-marketplace.com',
            enabled: true,
            refreshIntervalMinutes: 1440,
            allowUnverified: true,
          },
          connection: {
            maxRetries: 10,
            timeoutMs: 60000,
            autoReconnect: true,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(false);
      expect(effective.mcp.servers).toEqual(config.mcp?.servers);
      expect(effective.mcp.marketplace).toEqual(config.mcp?.marketplace);
      expect(effective.mcp.connection).toEqual(config.mcp?.connection);
    });

    it('should handle mixed explicit and default values', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: false, // explicit
          servers: {
            'server1': {
              name: 'Server 1',
              type: 'stdio',
              command: 'node',
              autoStart: true,
            },
          },
          // marketplace not specified, should be undefined
          connection: {
            maxRetries: 7,
            timeoutMs: 35000,
            // other connection fields not specified
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(false); // preserved
      expect(effective.mcp.servers).toEqual(config.mcp?.servers); // preserved
      expect(effective.mcp.marketplace).toBeUndefined(); // default
      expect(effective.mcp.connection?.maxRetries).toBe(7); // preserved
      expect(effective.mcp.connection?.timeoutMs).toBe(35000); // preserved
      // Other connection fields should match what was provided
      expect(effective.mcp.connection).toEqual({
        maxRetries: 7,
        timeoutMs: 35000,
      });
    });
  });

  describe('Complex MCP configuration scenarios', () => {
    it('should handle multiple servers with different configurations', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'multi-server-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: true,
          servers: {
            filesystem: {
              name: 'Filesystem Server',
              type: 'stdio',
              command: 'npx',
              args: ['filesystem-server'],
              env: {
                'NODE_ENV': 'development',
              },
              autoStart: true,
              capabilities: ['filesystem'],
              connection: {
                maxRetries: 3,
                timeoutMs: 30000,
              },
            },
            database: {
              name: 'Database Server',
              type: 'http',
              url: 'https://db-api.example.com/mcp',
              headers: {
                'Content-Type': 'application/json',
              },
              autoStart: false,
              capabilities: ['database', 'sql'],
              connection: {
                maxRetries: 5,
                timeoutMs: 60000,
                poolSize: 3,
              },
            },
            events: {
              name: 'Event Stream Server',
              type: 'sse',
              url: 'https://events.example.com/stream',
              headers: {
                'Accept': 'text/event-stream',
              },
              autoStart: true,
              capabilities: ['events'],
            },
            sdk: {
              name: 'SDK Server',
              type: 'sdk',
              autoStart: false,
              capabilities: ['sdk'],
            },
          },
          marketplace: {
            url: 'https://marketplace.example.com',
            enabled: true,
            refreshIntervalMinutes: 720,
            allowUnverified: false,
          },
          connection: {
            maxRetries: 5,
            timeoutMs: 45000,
            autoReconnect: true,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(true);
      expect(Object.keys(effective.mcp.servers)).toHaveLength(4);

      // Check that all servers are preserved
      expect(effective.mcp.servers.filesystem.name).toBe('Filesystem Server');
      expect(effective.mcp.servers.database.type).toBe('http');
      expect(effective.mcp.servers.events.url).toBe('https://events.example.com/stream');
      expect(effective.mcp.servers.sdk.type).toBe('sdk');

      // Check marketplace and connection are preserved
      expect(effective.mcp.marketplace?.url).toBe('https://marketplace.example.com');
      expect(effective.mcp.connection?.maxRetries).toBe(5);
    });

    it('should handle empty servers object correctly', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'empty-servers-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: true,
          servers: {},
          marketplace: {
            url: 'https://registry.example.com',
            enabled: true,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(true);
      expect(effective.mcp.servers).toEqual({});
      expect(effective.mcp.marketplace?.url).toBe('https://registry.example.com');
      expect(effective.mcp.connection).toBeUndefined();
    });
  });

  describe('Type safety and structure validation', () => {
    it('should maintain proper TypeScript types for MCP configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'type-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: true,
          servers: {
            'typed-server': {
              name: 'Typed Server',
              type: 'stdio',
              command: 'node',
              args: ['server.js'],
              autoStart: true,
            },
          },
        },
      };

      const effective = getEffectiveConfig(config);

      // These should all compile without TypeScript errors and have proper types
      expect(typeof effective.mcp.enabled).toBe('boolean');
      expect(typeof effective.mcp.servers).toBe('object');

      const server = effective.mcp.servers['typed-server'];
      if (server) {
        expect(typeof server.name).toBe('string');
        expect(typeof server.type).toBe('string');
        expect(typeof server.autoStart).toBe('boolean');
        expect(Array.isArray(server.args)).toBe(true);
      }
    });

    it('should handle undefined MCP configuration gracefully', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'undefined-mcp-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        // mcp property is undefined
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp).toBeDefined();
      expect(effective.mcp.enabled).toBe(true);
      expect(effective.mcp.servers).toEqual({});
      expect(effective.mcp.marketplace).toBeUndefined();
      expect(effective.mcp.connection).toBeUndefined();
    });
  });

  describe('Integration with other config sections', () => {
    it('should preserve other config sections while applying MCP defaults', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'integration-test-project',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
        },
        agents: {
          enabled: ['planner', 'developer', 'reviewer'],
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
        // MCP section omitted
      };

      const effective = getEffectiveConfig(config);

      // Other sections should be preserved
      expect(effective.project.name).toBe('integration-test-project');
      expect(effective.project.language).toBe('typescript');
      expect(effective.autonomy.level).toBe('full-auto');
      expect(effective.agents.enabled).toEqual(['planner', 'developer', 'reviewer']);
      expect(effective.limits.maxTokensPerTask).toBe(100000);

      // MCP should get defaults
      expect(effective.mcp.enabled).toBe(true);
      expect(effective.mcp.servers).toEqual({});
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle MCP enabled set to false explicitly', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'disabled-mcp-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          enabled: false,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(false);
      expect(effective.mcp.servers).toEqual({}); // should still get empty object default
    });

    it('should handle MCP with only marketplace configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'marketplace-only-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          marketplace: {
            url: 'https://marketplace-only.example.com',
            enabled: true,
            refreshIntervalMinutes: 60,
            allowUnverified: true,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(true); // default
      expect(effective.mcp.servers).toEqual({}); // default
      expect(effective.mcp.marketplace?.url).toBe('https://marketplace-only.example.com');
      expect(effective.mcp.marketplace?.refreshIntervalMinutes).toBe(60);
      expect(effective.mcp.connection).toBeUndefined();
    });

    it('should handle MCP with only connection configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'connection-only-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        mcp: {
          connection: {
            maxRetries: 8,
            timeoutMs: 50000,
            autoReconnect: false,
          },
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.mcp.enabled).toBe(true); // default
      expect(effective.mcp.servers).toEqual({}); // default
      expect(effective.mcp.marketplace).toBeUndefined();
      expect(effective.mcp.connection?.maxRetries).toBe(8);
      expect(effective.mcp.connection?.timeoutMs).toBe(50000);
      expect(effective.mcp.connection?.autoReconnect).toBe(false);
    });
  });
});