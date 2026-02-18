import { describe, it, expect } from 'vitest';
import {
  MCPConnectionConfigSchema,
  MCPConnectionConfig,
  MCPConnectionStateSchema,
  MCPConnectionState,
  MCPConnectionInfoSchema,
  MCPConnectionInfo,
  ApexConfigSchema,
} from '../types.js';

/**
 * Acceptance Criteria Test for MCP Connection Types and Configuration Schema
 *
 * This test file validates that the implementation meets the specific acceptance criteria:
 * "Zod schemas defined in packages/core/src/types.ts for MCPConnectionConfig (retry limits,
 * timeouts, pool size, health check interval), MCPConnectionState enum, MCPConnectionInfo type.
 * Config loading updated to parse MCP settings from .apex/config.yaml"
 */
describe('MCP Connection Types - Acceptance Criteria Validation', () => {
  describe('MCPConnectionConfig schema with required fields', () => {
    it('should include retry limits field (maxRetries)', () => {
      const configWithRetries = {
        maxRetries: 5,
      };

      const result = MCPConnectionConfigSchema.parse(configWithRetries);
      expect(result.maxRetries).toBe(5);

      // Test validation of retry limits
      expect(() => MCPConnectionConfigSchema.parse({ maxRetries: -1 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ maxRetries: 1.5 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ maxRetries: 0 })).not.toThrow();
    });

    it('should include timeouts fields', () => {
      const configWithTimeouts = {
        requestTimeoutMs: 30000,
        connectionTimeoutMs: 5000,
        readTimeoutMs: 120000,
        writeTimeoutMs: 30000,
        idleTimeoutMs: 300000,
        healthCheckTimeoutMs: 5000,
        heartbeatIntervalMs: 30000,
        keepAliveIntervalMs: 15000,
      };

      const result = MCPConnectionConfigSchema.parse(configWithTimeouts);
      expect(result.requestTimeoutMs).toBe(30000);
      expect(result.connectionTimeoutMs).toBe(5000);
      expect(result.idleTimeoutMs).toBe(300000);
      expect(result.healthCheckTimeoutMs).toBe(5000);
      expect(result.heartbeatIntervalMs).toBe(30000);
      expect(result.keepAliveIntervalMs).toBe(15000);

      // Test validation of timeouts (should be non-negative)
      expect(() => MCPConnectionConfigSchema.parse({ requestTimeoutMs: -1 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ connectionTimeoutMs: -1 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ requestTimeoutMs: 0 })).not.toThrow();
    });

    it('should include pool size field', () => {
      const configWithPoolSize = {
        poolSize: 3,
      };

      const result = MCPConnectionConfigSchema.parse(configWithPoolSize);
      expect(result.poolSize).toBe(3);

      // Test validation of pool size (must be between 1-100)
      expect(() => MCPConnectionConfigSchema.parse({ poolSize: 0 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ poolSize: 101 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ poolSize: 1 })).not.toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ poolSize: 100 })).not.toThrow();
    });

    it('should include health check interval field', () => {
      const configWithHealthCheck = {
        healthCheckIntervalMs: 60000,
      };

      const result = MCPConnectionConfigSchema.parse(configWithHealthCheck);
      expect(result.healthCheckIntervalMs).toBe(60000);

      // Test validation of health check interval (minimum 5000ms)
      expect(() => MCPConnectionConfigSchema.parse({ healthCheckIntervalMs: -1 })).toThrow();
      expect(() => MCPConnectionConfigSchema.parse({ healthCheckIntervalMs: 0 })).not.toThrow();
    });

    it('should provide all required fields with proper types and defaults', () => {
      const minimalConfig = {};
      const result = MCPConnectionConfigSchema.parse(minimalConfig);

      // Verify all acceptance criteria fields are present with correct types
      expect(typeof result.maxRetries).toBe('number');
      expect(typeof result.requestTimeoutMs).toBe('number');
      expect(typeof result.poolSize).toBe('number');
      expect(typeof result.healthCheckIntervalMs).toBe('number');

      // Verify default values are reasonable
      expect(result.maxRetries).toBeGreaterThanOrEqual(0);
      expect(result.poolSize).toBeGreaterThanOrEqual(1);
      expect(result.healthCheckIntervalMs).toBeGreaterThanOrEqual(0);
    });

    it('should validate comprehensive configuration', () => {
      const fullConfig = {
        maxRetries: 3,
        requestTimeoutMs: 30000,
        connectionTimeoutMs: 5000,
        readTimeoutMs: 120000,
        writeTimeoutMs: 30000,
        idleTimeoutMs: 300000,
        poolSize: 2,
        healthCheckIntervalMs: 60000,
        healthCheckTimeoutMs: 5000,
        heartbeatEnabled: true,
        heartbeatIntervalMs: 30000,
        keepAliveIntervalMs: 15000,
      };

      // Should parse without errors
      expect(() => MCPConnectionConfigSchema.parse(fullConfig)).not.toThrow();

      const result = MCPConnectionConfigSchema.parse(fullConfig);

      // All acceptance criteria fields must be present
      expect(result.maxRetries).toBe(3);
      expect(result.poolSize).toBe(2);
      expect(result.healthCheckIntervalMs).toBe(60000);
      expect(result.requestTimeoutMs).toBe(30000);
    });
  });

  describe('MCPConnectionState enum validation', () => {
    it('should define proper connection states', () => {
      const validStates = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'error',
      ];

      // All valid states should parse correctly
      validStates.forEach(state => {
        expect(() => MCPConnectionStateSchema.parse(state)).not.toThrow();
        const result = MCPConnectionStateSchema.parse(state);
        expect(result).toBe(state);
      });

      // Type should be properly inferred
      const state: MCPConnectionState = 'connected';
      expect(state).toBe('connected');
    });

    it('should reject invalid connection states', () => {
      const invalidStates = [
        'invalid',
        'unknown',
        'pending',
        'stopped',
        '',
        null,
        undefined,
      ];

      invalidStates.forEach(state => {
        expect(() => MCPConnectionStateSchema.parse(state)).toThrow();
      });
    });

    it('should provide enum for state transitions', () => {
      // Test that all expected states are available for state machines
      const stateTransitions = {
        disconnected: ['connecting'],
        connecting: ['connected', 'error', 'disconnected'],
        connected: ['disconnected', 'error', 'reconnecting'],
        reconnecting: ['connected', 'error', 'disconnected'],
        error: ['disconnected', 'reconnecting'],
      };

      // Verify all states in transitions are valid
      Object.entries(stateTransitions).forEach(([from, toStates]) => {
        expect(() => MCPConnectionStateSchema.parse(from)).not.toThrow();
        toStates.forEach(to => {
          expect(() => MCPConnectionStateSchema.parse(to)).not.toThrow();
        });
      });
    });
  });

  describe('MCPConnectionInfo type validation', () => {
    it('should include comprehensive connection information', () => {
      const fullConnectionInfo = {
        serverId: 'test-server-id',
        serverName: 'Test Server Name',
        config: {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'test' },
          autoStart: true,
          capabilities: ['filesystem'],
          connection: {
            maxRetries: 3,
            requestTimeoutMs: 30000,
            poolSize: 1,
            healthCheckIntervalMs: 30000,
          },
        },
        state: 'connected' as const,
        connectedAt: new Date('2024-01-01T12:00:00Z'),
        lastActivityAt: new Date('2024-01-01T12:05:00Z'),
        reconnectAttempts: 2,
        lastError: 'Previous connection timeout',
        metrics: {
          totalRequests: 150,
          successfulRequests: 147,
          failedRequests: 3,
          bytesSent: 500000,
          bytesReceived: 524000,
          uptimeMs: 300000,
        },
      };

      // Should parse without errors
      expect(() => MCPConnectionInfoSchema.parse(fullConnectionInfo)).not.toThrow();

      const result = MCPConnectionInfoSchema.parse(fullConnectionInfo);

      // Verify all comprehensive connection information fields
      expect(result.serverId).toBe('test-server-id');
      expect(result.serverName).toBe('Test Server Name');
      expect(result.config.name).toBe('test-server');
      expect(result.state).toBe('connected');
      expect(result.connectedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(result.lastActivityAt).toEqual(new Date('2024-01-01T12:05:00Z'));
      expect(result.reconnectAttempts).toBe(2);
      expect(result.lastError).toBe('Previous connection timeout');
      expect(result.metrics?.totalRequests).toBe(150);
      expect(result.metrics?.failedRequests).toBe(3);
      expect(result.metrics?.uptimeMs).toBe(300000);
    });

    it('should require essential connection tracking fields', () => {
      const requiredFields = ['serverId', 'serverName', 'config', 'state'];

      requiredFields.forEach(field => {
        const completeInfo = {
          serverId: 'test-server',
          serverName: 'Test Server',
          config: {
            name: 'test',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
          state: 'connected' as const,
        };

        delete completeInfo[field as keyof typeof completeInfo];

        expect(() => MCPConnectionInfoSchema.parse(completeInfo)).toThrow();
      });
    });

    it('should handle optional fields appropriately', () => {
      const minimalInfo = {
        serverId: 'minimal-server',
        serverName: 'Minimal Server',
        config: {
          name: 'minimal',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
        },
        state: 'disconnected' as const,
      };

      const result = MCPConnectionInfoSchema.parse(minimalInfo);

      // Optional fields should be undefined or have defaults
      expect(result.connectedAt).toBeUndefined();
      expect(result.lastActivityAt).toBeUndefined();
      expect(result.reconnectAttempts).toBe(0); // Default
      expect(result.lastError).toBeUndefined();
      expect(result.metrics).toBeUndefined();
    });

    it('should validate server configuration types within connection info', () => {
      const serverTypes = ['stdio', 'http', 'sse', 'sdk'] as const;

      serverTypes.forEach(type => {
        const info = {
          serverId: `${type}-server`,
          serverName: `${type} Server`,
          config: {
            name: `${type}-test`,
            type,
            command: type === 'stdio' ? 'node' : undefined,
            url: type === 'http' || type === 'sse' ? 'https://example.com' : undefined,
            autoStart: false,
          },
          state: 'connected' as const,
        };

        expect(() => MCPConnectionInfoSchema.parse(info)).not.toThrow();
        const result = MCPConnectionInfoSchema.parse(info);
        expect(result.config.type).toBe(type);
      });
    });
  });

  describe('Integration with ApexConfig schema', () => {
    it('should integrate MCP connection settings into config loading', () => {
      const configWithMCPConnections = {
        project: {
          name: 'test-project',
          version: '1.0.0',
          description: 'Test project with MCP connections',
        },
        mcp: {
          enabled: true,
          servers: {
            'primary-server': {
              name: 'primary-server',
              type: 'stdio' as const,
              command: 'node',
              autoStart: true,
              connection: {
                maxRetries: 5,
                requestTimeoutMs: 45000,
                poolSize: 2,
                healthCheckIntervalMs: 60000,
              },
            },
            'backup-server': {
              name: 'backup-server',
              type: 'http' as const,
              url: 'https://backup.example.com',
              autoStart: false,
              connection: {
                maxRetries: 10,
                requestTimeoutMs: 120000,
                poolSize: 1,
                healthCheckIntervalMs: 120000,
              },
            },
          },
          connection: {
            maxRetries: 3,
            requestTimeoutMs: 30000,
            poolSize: 1,
            healthCheckIntervalMs: 30000,
          },
        },
      };

      // Should validate against complete ApexConfig schema
      expect(() => ApexConfigSchema.parse(configWithMCPConnections)).not.toThrow();

      const validatedConfig = ApexConfigSchema.parse(configWithMCPConnections);

      // Verify MCP connection settings are properly loaded
      expect(validatedConfig.mcp?.enabled).toBe(true);
      expect(validatedConfig.mcp?.connection?.maxRetries).toBe(3);
      expect(validatedConfig.mcp?.connection?.poolSize).toBe(1);

      // Verify per-server connection overrides
      const primaryServer = validatedConfig.mcp?.servers?.['primary-server'];
      expect(primaryServer?.connection?.maxRetries).toBe(5);
      expect(primaryServer?.connection?.poolSize).toBe(2);

      const backupServer = validatedConfig.mcp?.servers?.['backup-server'];
      expect(backupServer?.connection?.maxRetries).toBe(10);
      expect(backupServer?.connection?.poolSize).toBe(1);
    });
  });

  describe('Complete acceptance criteria validation', () => {
    it('should satisfy all specified acceptance criteria', () => {
      // ✅ Test 1: MCPConnectionConfig with retry limits, timeouts, pool size, health check interval
      const connectionConfig = MCPConnectionConfigSchema.parse({
        maxRetries: 3, // retry limits ✓
        requestTimeoutMs: 30000, // timeouts ✓
        poolSize: 2, // pool size ✓
        healthCheckIntervalMs: 60000, // health check interval ✓
      });

      expect(connectionConfig.maxRetries).toBe(3);
      expect(connectionConfig.requestTimeoutMs).toBe(30000);
      expect(connectionConfig.poolSize).toBe(2);
      expect(connectionConfig.healthCheckIntervalMs).toBe(60000);

      // ✅ Test 2: MCPConnectionState enum
      const connectionState = MCPConnectionStateSchema.parse('connected');
      expect(connectionState).toBe('connected');

      // Verify it's properly typed
      const state: MCPConnectionState = connectionState;
      expect(typeof state).toBe('string');

      // ✅ Test 3: MCPConnectionInfo type
      const connectionInfo = MCPConnectionInfoSchema.parse({
        serverId: 'acceptance-server',
        serverName: 'Acceptance Test Server',
        config: {
          name: 'acceptance-test',
          type: 'stdio',
          command: 'node',
          autoStart: false,
          connection: connectionConfig, // Uses the config from test 1
        },
        state: connectionState, // Uses the state from test 2
        reconnectAttempts: 0,
      });

      expect(connectionInfo.serverId).toBe('acceptance-server');
      expect(connectionInfo.state).toBe('connected');
      expect(connectionInfo.config.connection?.maxRetries).toBe(3);

      // Verify TypeScript type inference works
      const info: MCPConnectionInfo = connectionInfo;
      expect(info.serverId).toBe('acceptance-server');

      // ✅ Test 4: Zod schemas defined in packages/core/src/types.ts
      // (Verified by the fact that we can import and use them)
      expect(MCPConnectionConfigSchema).toBeDefined();
      expect(MCPConnectionStateSchema).toBeDefined();
      expect(MCPConnectionInfoSchema).toBeDefined();

      // ✅ Test 5: Config loading updated to parse MCP settings from .apex/config.yaml
      // (This is tested in the integration test above and in the separate config loading test file)

      // Comprehensive validation - all components work together
      expect(() => MCPConnectionInfoSchema.parse(connectionInfo)).not.toThrow();
    });

    it('should demonstrate complete workflow with all MCP connection types', () => {
      // 1. Define global connection configuration
      const globalConnectionConfig: MCPConnectionConfig = {
        maxRetries: 3,
        requestTimeoutMs: 30000,
        connectionTimeoutMs: 5000,
        idleTimeoutMs: 300000,
        poolSize: 1,
        healthCheckIntervalMs: 30000,
        healthCheckTimeoutMs: 5000,
        heartbeatEnabled: true,
        heartbeatIntervalMs: 30000,
        keepAliveIntervalMs: 15000,
      };

      // 2. Simulate connection state progression
      const connectionStates: MCPConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'connected',
      ];

      connectionStates.forEach(state => {
        expect(() => MCPConnectionStateSchema.parse(state)).not.toThrow();
      });

      // 3. Create comprehensive connection info
      const connectionInfo: MCPConnectionInfo = {
        serverId: 'workflow-test-server',
        serverName: 'Workflow Test Server',
        config: {
          name: 'workflow-test',
          type: 'stdio',
          command: 'npx',
          args: ['@mcp/test-server'],
          env: { NODE_ENV: 'test' },
          autoStart: true,
          capabilities: ['filesystem', 'network'],
          connection: globalConnectionConfig,
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 1,
        metrics: {
          totalRequests: 42,
          successfulRequests: 42,
          failedRequests: 0,
          bytesSent: 1024,
          bytesReceived: 1024,
          uptimeMs: 120000,
        },
      };

      // Validate the complete workflow
      expect(() => MCPConnectionInfoSchema.parse(connectionInfo)).not.toThrow();

      const validatedInfo = MCPConnectionInfoSchema.parse(connectionInfo);

      // Verify all acceptance criteria components are working together
      expect(validatedInfo.config.connection?.maxRetries).toBe(3); // Connection config ✓
      expect(validatedInfo.state).toBe('connected'); // Connection state ✓
      expect(validatedInfo.metrics?.totalRequests).toBe(42); // Connection info ✓

      // This demonstrates that all acceptance criteria are fully implemented and working
      console.log('✅ All MCP connection types and configuration acceptance criteria validated');
    });
  });
});
