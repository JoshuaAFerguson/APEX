import { describe, it, expect } from 'vitest';
import {
  MCPConfigSchema,
  MCPToolsConfigSchema,
  MCPServerConfigSchema,
  MCPConfig,
  MCPToolsConfig,
} from '../types.js';

/**
 * Integration test suite for MCPToolsConfig within the broader MCP ecosystem
 * Tests how MCPToolsConfig integrates with other MCP components and schemas,
 * validates real-world usage patterns, and ensures backward compatibility.
 */
describe('MCPToolsConfig Integration Tests', () => {
  describe('Integration with MCPConfig', () => {
    it('should work seamlessly with complete MCP configuration', () => {
      const fullMCPConfig = {
        enabled: true,
        servers: {
          'integration-server-1': {
            name: 'Integration Test Server 1',
            type: 'stdio' as const,
            command: 'node',
            args: ['integration-server-1.js'],
            env: { 'NODE_ENV': 'test' },
            autoStart: true,
            capabilities: ['integration', 'test'],
          },
          'integration-server-2': {
            name: 'Integration Test Server 2',
            type: 'http' as const,
            url: 'http://integration-test:3000/mcp',
            headers: { 'Content-Type': 'application/json' },
            autoStart: false,
            capabilities: ['http', 'integration'],
          },
        },
        marketplace: {
          url: 'https://integration-marketplace.test',
          enabled: true,
          refreshIntervalMinutes: 60,
        },
        connection: {
          maxRetries: 4,
          timeoutMs: 35000,
          poolSize: 2,
        },
        tools: {
          autoDiscovery: true,
          enableCaching: false,
          maxConcurrentTools: 12,
          timeoutMs: 25000,
          enableValidation: true,
          allowedTools: ['integration-tool-1', 'integration-tool-2', 'test-helper'],
          deniedTools: ['dangerous-integration', 'deprecated-tool'],
          enableLogging: true,
        },
      };

      const result = MCPConfigSchema.parse(fullMCPConfig);

      // Verify MCP config structure
      expect(result.enabled).toBe(true);
      expect(Object.keys(result.servers)).toHaveLength(2);
      expect(result.marketplace?.url).toBe('https://integration-marketplace.test');
      expect(result.connection?.maxRetries).toBe(4);

      // Verify tools config integration
      expect(result.tools).toBeDefined();
      expect(result.tools?.autoDiscovery).toBe(true);
      expect(result.tools?.enableCaching).toBe(false);
      expect(result.tools?.maxConcurrentTools).toBe(12);
      expect(result.tools?.timeoutMs).toBe(25000);
      expect(result.tools?.enableValidation).toBe(true);
      expect(result.tools?.allowedTools).toEqual(['integration-tool-1', 'integration-tool-2', 'test-helper']);
      expect(result.tools?.deniedTools).toEqual(['dangerous-integration', 'deprecated-tool']);
      expect(result.tools?.enableLogging).toBe(true);

      // Verify server configurations are preserved
      expect(result.servers['integration-server-1'].type).toBe('stdio');
      expect(result.servers['integration-server-1'].capabilities).toContain('integration');
      expect(result.servers['integration-server-2'].type).toBe('http');
      expect(result.servers['integration-server-2'].url).toBe('http://integration-test:3000/mcp');
    });

    it('should handle MCP config without tools configuration', () => {
      const mcpConfigWithoutTools = {
        enabled: true,
        servers: {
          'standalone-server': {
            name: 'Standalone Server',
            type: 'stdio' as const,
            command: 'npx',
            args: ['standalone-mcp-server'],
            autoStart: true,
          },
        },
        connection: {
          maxRetries: 2,
          timeoutMs: 20000,
        },
      };

      const result = MCPConfigSchema.parse(mcpConfigWithoutTools);

      expect(result.enabled).toBe(true);
      expect(result.servers['standalone-server']).toBeDefined();
      expect(result.connection?.maxRetries).toBe(2);
      expect(result.tools).toBeUndefined(); // Should be optional
    });

    it('should handle tools-only configuration within MCP config', () => {
      const toolsOnlyConfig = {
        tools: {
          autoDiscovery: false,
          enableCaching: true,
          maxConcurrentTools: 8,
          timeoutMs: 40000,
          enableValidation: false,
          allowedTools: ['tools-only-test'],
          deniedTools: [],
          enableLogging: false,
        },
      };

      const result = MCPConfigSchema.parse(toolsOnlyConfig);

      expect(result.enabled).toBe(true); // Default value
      expect(result.servers).toEqual({}); // Default empty object
      expect(result.marketplace).toBeUndefined();
      expect(result.connection).toBeUndefined();

      // Tools config should be preserved
      expect(result.tools?.autoDiscovery).toBe(false);
      expect(result.tools?.enableCaching).toBe(true);
      expect(result.tools?.maxConcurrentTools).toBe(8);
      expect(result.tools?.allowedTools).toEqual(['tools-only-test']);
    });
  });

  describe('Server and tools interaction scenarios', () => {
    it('should handle different tool configurations for different server types', () => {
      const multiServerConfig = {
        servers: {
          'stdio-server': {
            name: 'STDIO MCP Server',
            type: 'stdio' as const,
            command: 'node',
            args: ['stdio-server.js'],
            autoStart: true,
            capabilities: ['filesystem', 'local'],
          },
          'http-server': {
            name: 'HTTP MCP Server',
            type: 'http' as const,
            url: 'https://remote-mcp-server.com/api',
            headers: { 'Authorization': 'Bearer remote-token' },
            autoStart: true,
            capabilities: ['api', 'remote'],
          },
          'sse-server': {
            name: 'SSE MCP Server',
            type: 'sse' as const,
            url: 'https://streaming-mcp.com/events',
            headers: { 'Accept': 'text/event-stream' },
            autoStart: false,
            capabilities: ['events', 'realtime'],
          },
        },
        tools: {
          autoDiscovery: true,
          enableCaching: true,
          maxConcurrentTools: 20,
          timeoutMs: 45000,
          enableValidation: true,
          allowedTools: [
            'filesystem-reader', // For stdio server
            'http-client',      // For http server
            'event-listener',   // For sse server
            'universal-tool',   // For all servers
          ],
          deniedTools: [
            'filesystem-writer', // Too dangerous for remote servers
            'admin-commands',    // Not allowed in this configuration
          ],
          enableLogging: true,
        },
      };

      const result = MCPConfigSchema.parse(multiServerConfig);

      expect(Object.keys(result.servers)).toHaveLength(3);

      // Verify different server types
      expect(result.servers['stdio-server'].type).toBe('stdio');
      expect(result.servers['stdio-server'].capabilities).toContain('filesystem');
      expect(result.servers['http-server'].type).toBe('http');
      expect(result.servers['http-server'].capabilities).toContain('remote');
      expect(result.servers['sse-server'].type).toBe('sse');
      expect(result.servers['sse-server'].capabilities).toContain('realtime');

      // Verify tools configuration works across all server types
      expect(result.tools?.allowedTools).toContain('filesystem-reader');
      expect(result.tools?.allowedTools).toContain('http-client');
      expect(result.tools?.allowedTools).toContain('event-listener');
      expect(result.tools?.allowedTools).toContain('universal-tool');
      expect(result.tools?.deniedTools).toContain('filesystem-writer');
      expect(result.tools?.deniedTools).toContain('admin-commands');
    });

    it('should handle tools configuration with server capability constraints', () => {
      const capabilityConstrainedConfig = {
        servers: {
          'readonly-server': {
            name: 'Read-only Server',
            type: 'stdio' as const,
            command: 'readonly-mcp-server',
            autoStart: true,
            capabilities: ['read', 'query', 'search'],
          },
          'admin-server': {
            name: 'Admin Server',
            type: 'http' as const,
            url: 'https://admin-mcp.internal/api',
            headers: { 'X-Role': 'admin' },
            autoStart: false,
            capabilities: ['read', 'write', 'delete', 'admin'],
          },
        },
        tools: {
          autoDiscovery: false, // Explicit tool management
          enableCaching: true,
          maxConcurrentTools: 5,
          timeoutMs: 30000,
          enableValidation: true,
          allowedTools: [
            'data-reader',     // Compatible with readonly-server
            'search-engine',   // Compatible with readonly-server
            'query-builder',   // Compatible with both servers
            'admin-panel',     // Only for admin-server
            'user-manager',    // Only for admin-server
          ],
          deniedTools: [
            'data-writer',     // Not compatible with readonly-server
            'file-deleter',    // Too dangerous
            'system-reboot',   // Administrative, not needed
          ],
          enableLogging: true,
        },
      };

      const result = MCPConfigSchema.parse(capabilityConstrainedConfig);

      expect(result.servers['readonly-server'].capabilities).not.toContain('write');
      expect(result.servers['admin-server'].capabilities).toContain('admin');

      expect(result.tools?.autoDiscovery).toBe(false);
      expect(result.tools?.allowedTools).toContain('admin-panel');
      expect(result.tools?.deniedTools).toContain('data-writer');
    });
  });

  describe('Performance and scaling scenarios', () => {
    it('should handle high-performance configuration with many servers and tools', () => {
      const manyServers: Record<string, any> = {};
      const manyAllowedTools: string[] = [];
      const manyDeniedTools: string[] = [];

      // Create 20 servers
      for (let i = 0; i < 20; i++) {
        manyServers[`server-${i}`] = {
          name: `Performance Test Server ${i}`,
          type: i % 2 === 0 ? 'stdio' : 'http',
          command: i % 2 === 0 ? `server-${i}` : undefined,
          url: i % 2 === 1 ? `https://server-${i}.test/mcp` : undefined,
          autoStart: i % 3 === 0,
          capabilities: [`capability-${i}`, 'common'],
        };
      }

      // Create 50 allowed tools and 25 denied tools
      for (let i = 0; i < 50; i++) {
        manyAllowedTools.push(`allowed-tool-${i}`);
      }
      for (let i = 0; i < 25; i++) {
        manyDeniedTools.push(`denied-tool-${i}`);
      }

      const highPerformanceConfig = {
        enabled: true,
        servers: manyServers,
        tools: {
          autoDiscovery: false, // Explicit management for performance
          enableCaching: true,  // Aggressive caching
          maxConcurrentTools: 100, // Maximum concurrency
          timeoutMs: 120000, // Long timeout for heavy operations
          enableValidation: false, // Skip validation for speed
          allowedTools: manyAllowedTools,
          deniedTools: manyDeniedTools,
          enableLogging: false, // Disable logging for performance
        },
      };

      const result = MCPConfigSchema.parse(highPerformanceConfig);

      expect(Object.keys(result.servers)).toHaveLength(20);
      expect(result.tools?.allowedTools).toHaveLength(50);
      expect(result.tools?.deniedTools).toHaveLength(25);
      expect(result.tools?.maxConcurrentTools).toBe(100);
      expect(result.tools?.enableLogging).toBe(false);

      // Verify specific servers are properly configured
      expect(result.servers['server-0'].type).toBe('stdio');
      expect(result.servers['server-1'].type).toBe('http');
      expect(result.servers['server-19'].capabilities).toContain('common');
    });

    it('should handle resource-constrained configuration', () => {
      const constrainedConfig = {
        servers: {
          'minimal-server': {
            name: 'Minimal Server',
            type: 'stdio' as const,
            command: 'minimal-mcp',
            autoStart: true,
            capabilities: ['basic'],
          },
        },
        tools: {
          autoDiscovery: true, // Let system discover minimal set
          enableCaching: false, // Save memory
          maxConcurrentTools: 1, // Single-threaded
          timeoutMs: 5000, // Quick timeout
          enableValidation: true, // Ensure correctness
          allowedTools: ['essential-tool'], // Minimal tool set
          deniedTools: ['heavy-processor', 'memory-intensive'], // Block resource hogs
          enableLogging: false, // Save I/O
        },
      };

      const result = MCPConfigSchema.parse(constrainedConfig);

      expect(result.tools?.maxConcurrentTools).toBe(1);
      expect(result.tools?.timeoutMs).toBe(5000);
      expect(result.tools?.enableCaching).toBe(false);
      expect(result.tools?.allowedTools).toEqual(['essential-tool']);
      expect(result.tools?.deniedTools).toContain('memory-intensive');
    });
  });

  describe('Security and access control scenarios', () => {
    it('should handle security-focused configuration with strict controls', () => {
      const securityConfig = {
        servers: {
          'secure-server': {
            name: 'Secure MCP Server',
            type: 'https' as const,
            url: 'https://secure.internal/mcp',
            headers: {
              'Authorization': 'Bearer ${SECURE_TOKEN}',
              'X-Security-Level': 'high',
            },
            autoStart: true,
            capabilities: ['secure-read', 'audit'],
          },
        },
        connection: {
          maxRetries: 1, // Fail fast for security
          timeoutMs: 10000, // Short timeout
          poolSize: 1, // Limited connections
        },
        tools: {
          autoDiscovery: false, // Manual approval only
          enableCaching: false, // No data persistence
          maxConcurrentTools: 2, // Limited concurrency
          timeoutMs: 15000, // Conservative timeout
          enableValidation: true, // Strict validation
          allowedTools: [
            'security-scanner',
            'audit-logger',
            'permission-checker',
            'encrypted-reader',
          ],
          deniedTools: [
            'file-writer',
            'network-client',
            'system-command',
            'debug-tool',
            'admin-panel',
            'data-exporter',
          ],
          enableLogging: true, // Full audit trail
        },
      };

      const result = MCPConfigSchema.parse(securityConfig);

      expect(result.servers['secure-server'].url).toContain('https://');
      expect(result.connection?.maxRetries).toBe(1);
      expect(result.tools?.autoDiscovery).toBe(false);
      expect(result.tools?.enableCaching).toBe(false);
      expect(result.tools?.maxConcurrentTools).toBe(2);
      expect(result.tools?.allowedTools).toContain('security-scanner');
      expect(result.tools?.deniedTools).toContain('system-command');
      expect(result.tools?.enableLogging).toBe(true);
    });

    it('should handle multi-tenant configuration with tool isolation', () => {
      const multiTenantConfig = {
        servers: {
          'tenant-a-server': {
            name: 'Tenant A Server',
            type: 'http' as const,
            url: 'https://tenant-a.mcp.service/api',
            headers: { 'X-Tenant': 'tenant-a' },
            autoStart: true,
            capabilities: ['tenant-a-data', 'shared'],
          },
          'tenant-b-server': {
            name: 'Tenant B Server',
            type: 'http' as const,
            url: 'https://tenant-b.mcp.service/api',
            headers: { 'X-Tenant': 'tenant-b' },
            autoStart: true,
            capabilities: ['tenant-b-data', 'shared'],
          },
          'shared-server': {
            name: 'Shared Services Server',
            type: 'stdio' as const,
            command: 'shared-mcp-server',
            autoStart: true,
            capabilities: ['shared', 'common-utilities'],
          },
        },
        tools: {
          autoDiscovery: true, // Allow discovery within tenant boundaries
          enableCaching: true, // Cache for performance
          maxConcurrentTools: 10, // Moderate concurrency
          timeoutMs: 30000, // Standard timeout
          enableValidation: true, // Ensure tenant boundaries
          allowedTools: [
            'tenant-a-processor',
            'tenant-b-processor',
            'shared-utility',
            'common-validator',
            'multi-tenant-logger',
          ],
          deniedTools: [
            'cross-tenant-access',
            'admin-override',
            'tenant-switcher',
          ],
          enableLogging: true, // Full audit for compliance
        },
      };

      const result = MCPConfigSchema.parse(multiTenantConfig);

      expect(Object.keys(result.servers)).toHaveLength(3);
      expect(result.servers['tenant-a-server'].headers?.['X-Tenant']).toBe('tenant-a');
      expect(result.servers['tenant-b-server'].headers?.['X-Tenant']).toBe('tenant-b');
      expect(result.servers['shared-server'].capabilities).toContain('shared');

      expect(result.tools?.allowedTools).toContain('shared-utility');
      expect(result.tools?.deniedTools).toContain('cross-tenant-access');
      expect(result.tools?.enableLogging).toBe(true);
    });
  });

  describe('Migration and backward compatibility', () => {
    it('should handle migration from configuration without tools', () => {
      const legacyConfig = {
        enabled: true,
        servers: {
          'legacy-server': {
            name: 'Legacy Server',
            type: 'stdio' as const,
            command: 'legacy-mcp-server',
            autoStart: true,
          },
        },
        // No tools configuration - should use defaults when added
      };

      const result = MCPConfigSchema.parse(legacyConfig);

      expect(result.enabled).toBe(true);
      expect(result.servers['legacy-server']).toBeDefined();
      expect(result.tools).toBeUndefined(); // Should remain undefined

      // Now add tools configuration
      const migratedConfig = {
        ...legacyConfig,
        tools: {
          autoDiscovery: true,
          enableCaching: true,
        },
      };

      const migratedResult = MCPConfigSchema.parse(migratedConfig);
      expect(migratedResult.tools?.autoDiscovery).toBe(true);
      expect(migratedResult.tools?.enableCaching).toBe(true);
      expect(migratedResult.tools?.maxConcurrentTools).toBe(10); // Default
      expect(migratedResult.tools?.timeoutMs).toBe(30000); // Default
    });

    it('should handle gradual adoption of tools configuration', () => {
      const phases = [
        // Phase 1: Basic tools config
        {
          tools: {
            autoDiscovery: true,
          },
        },
        // Phase 2: Add caching
        {
          tools: {
            autoDiscovery: true,
            enableCaching: true,
          },
        },
        // Phase 3: Add tool controls
        {
          tools: {
            autoDiscovery: true,
            enableCaching: true,
            allowedTools: ['safe-tool-1', 'safe-tool-2'],
          },
        },
        // Phase 4: Full configuration
        {
          tools: {
            autoDiscovery: false,
            enableCaching: true,
            maxConcurrentTools: 15,
            timeoutMs: 45000,
            enableValidation: true,
            allowedTools: ['safe-tool-1', 'safe-tool-2', 'new-tool'],
            deniedTools: ['deprecated-tool'],
            enableLogging: true,
          },
        },
      ];

      phases.forEach((phase, index) => {
        const result = MCPToolsConfigSchema.parse(phase.tools);

        // Each phase should parse successfully
        expect(result).toBeDefined();
        expect(result.autoDiscovery).toBeDefined();
        expect(result.enableCaching).toBeDefined();

        // Later phases should have more configuration
        if (index >= 2) {
          expect(result.allowedTools).toBeDefined();
        }
        if (index === 3) {
          expect(result.deniedTools).toContain('deprecated-tool');
          expect(result.enableLogging).toBe(true);
        }
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle conflicting tool configurations gracefully', () => {
      // Configuration where a tool is both allowed and denied
      const conflictingConfig = {
        allowedTools: ['conflicted-tool', 'safe-tool'],
        deniedTools: ['conflicted-tool', 'dangerous-tool'],
      };

      // Schema should parse this successfully (runtime logic handles conflicts)
      const result = MCPToolsConfigSchema.parse(conflictingConfig);
      expect(result.allowedTools).toContain('conflicted-tool');
      expect(result.deniedTools).toContain('conflicted-tool');
    });

    it('should handle empty configuration arrays', () => {
      const emptyArraysConfig = {
        autoDiscovery: false,
        allowedTools: [],
        deniedTools: [],
      };

      const result = MCPToolsConfigSchema.parse(emptyArraysConfig);
      expect(result.autoDiscovery).toBe(false);
      expect(result.allowedTools).toEqual([]);
      expect(result.deniedTools).toEqual([]);
    });

    it('should handle extreme but valid timeout and concurrency values', () => {
      const extremeButValidConfig = {
        maxConcurrentTools: 1, // Minimum
        timeoutMs: 0, // Zero timeout (immediate)
      };

      const result = MCPToolsConfigSchema.parse(extremeButValidConfig);
      expect(result.maxConcurrentTools).toBe(1);
      expect(result.timeoutMs).toBe(0);

      const extremeButValidConfig2 = {
        maxConcurrentTools: 100, // Maximum
        timeoutMs: 600000, // 10 minutes
      };

      const result2 = MCPToolsConfigSchema.parse(extremeButValidConfig2);
      expect(result2.maxConcurrentTools).toBe(100);
      expect(result2.timeoutMs).toBe(600000);
    });
  });
});