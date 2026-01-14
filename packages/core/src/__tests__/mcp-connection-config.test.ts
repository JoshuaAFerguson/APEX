import { describe, it, expect } from 'vitest';
import {
  MCPConnectionConfigSchema,
  MCPConnectionConfig,
  MCPConnectionStateSchema,
  MCPConnectionState,
  MCPConnectionInfoSchema,
  MCPConnectionInfo,
  MCPServerConfigSchema,
} from '../types.js';

/**
 * Comprehensive test suite for MCP Connection Configuration types and schemas
 * Tests validation, edge cases, and TypeScript type inference for MCP connection management
 *
 * Covers the acceptance criteria:
 * - MCPConnectionConfig with retry limits, timeouts, pool size, and health check interval
 * - MCPConnectionState enum with proper connection states
 * - MCPConnectionInfo type with comprehensive connection information
 */
describe('MCP Connection Configuration Tests', () => {
  describe('MCPConnectionConfigSchema', () => {
    describe('Valid configurations', () => {
      it('should accept minimal configuration with all defaults', () => {
        const minimalConfig = {};
        const result = MCPConnectionConfigSchema.parse(minimalConfig);

        // Verify all defaults are applied
        expect(result.maxRetries).toBe(3);
        expect(result.timeoutMs).toBe(30000);
        expect(result.connectTimeoutMs).toBe(5000);
        expect(result.readTimeoutMs).toBe(120000);
        expect(result.writeTimeoutMs).toBe(30000);
        expect(result.idleTimeoutMs).toBe(300000);
        expect(result.poolSize).toBe(1);
        expect(result.healthCheckIntervalMs).toBe(30000);
        expect(result.healthCheckTimeoutMs).toBe(5000);
        expect(result.heartbeatEnabled).toBe(true);
        expect(result.heartbeatIntervalMs).toBe(30000);
        expect(result.keepAliveIntervalMs).toBe(15000);
      });

      it('should accept complete configuration with all fields', () => {
        const fullConfig = {
          maxRetries: 5,
          timeoutMs: 45000,
          connectTimeoutMs: 10000,
          readTimeoutMs: 180000,
          writeTimeoutMs: 60000,
          idleTimeoutMs: 600000,
          poolSize: 3,
          healthCheckIntervalMs: 60000,
          healthCheckTimeoutMs: 10000,
          heartbeatEnabled: false,
          heartbeatIntervalMs: 45000,
          keepAliveIntervalMs: 20000,
        };

        const result = MCPConnectionConfigSchema.parse(fullConfig);

        expect(result.maxRetries).toBe(5);
        expect(result.timeoutMs).toBe(45000);
        expect(result.connectTimeoutMs).toBe(10000);
        expect(result.readTimeoutMs).toBe(180000);
        expect(result.writeTimeoutMs).toBe(60000);
        expect(result.idleTimeoutMs).toBe(600000);
        expect(result.poolSize).toBe(3);
        expect(result.healthCheckIntervalMs).toBe(60000);
        expect(result.healthCheckTimeoutMs).toBe(10000);
        expect(result.heartbeatEnabled).toBe(false);
        expect(result.heartbeatIntervalMs).toBe(45000);
        expect(result.keepAliveIntervalMs).toBe(20000);
      });

      it('should handle edge case values within valid ranges', () => {
        const edgeCaseConfig = {
          maxRetries: 0, // No retries
          timeoutMs: 1000, // Minimum timeout
          poolSize: 1, // Minimum pool size
          healthCheckIntervalMs: 5000, // Minimum health check interval
        };

        const result = MCPConnectionConfigSchema.parse(edgeCaseConfig);

        expect(result.maxRetries).toBe(0);
        expect(result.timeoutMs).toBe(1000);
        expect(result.poolSize).toBe(1);
        expect(result.healthCheckIntervalMs).toBe(5000);
      });

      it('should handle maximum valid values', () => {
        const maxConfig = {
          maxRetries: 100, // Maximum retries
          timeoutMs: 3600000, // 1 hour timeout
          poolSize: 100, // Maximum pool size
          healthCheckIntervalMs: 3600000, // 1 hour health check interval
        };

        const result = MCPConnectionConfigSchema.parse(maxConfig);

        expect(result.maxRetries).toBe(100);
        expect(result.timeoutMs).toBe(3600000);
        expect(result.poolSize).toBe(100);
        expect(result.healthCheckIntervalMs).toBe(3600000);
      });

      it('should handle partial configurations', () => {
        const partialConfigs = [
          { maxRetries: 5 },
          { timeoutMs: 45000 },
          { poolSize: 2 },
          { healthCheckIntervalMs: 45000 },
          { heartbeatEnabled: false },
          { maxRetries: 2, timeoutMs: 20000 },
          { poolSize: 3, healthCheckIntervalMs: 60000 },
        ];

        partialConfigs.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).not.toThrow();
          const result = MCPConnectionConfigSchema.parse(config);

          // Verify specified values are preserved
          Object.entries(config).forEach(([key, value]) => {
            expect(result[key as keyof MCPConnectionConfig]).toBe(value);
          });

          // Verify defaults are applied to unspecified fields
          if (!('maxRetries' in config)) {
            expect(result.maxRetries).toBe(3);
          }
          if (!('timeoutMs' in config)) {
            expect(result.timeoutMs).toBe(30000);
          }
        });
      });
    });

    describe('Validation errors', () => {
      it('should reject negative retry values', () => {
        const invalidConfigs = [
          { maxRetries: -1 },
          { maxRetries: -5 },
        ];

        invalidConfigs.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });

      it('should reject retry values exceeding maximum', () => {
        const invalidConfigs = [
          { maxRetries: 101 },
          { maxRetries: 1000 },
        ];

        invalidConfigs.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });

      it('should reject negative timeout values', () => {
        const invalidTimeouts = [
          { timeoutMs: -1 },
          { connectTimeoutMs: -1000 },
          { readTimeoutMs: -500 },
          { writeTimeoutMs: -300 },
          { idleTimeoutMs: -100 },
          { healthCheckTimeoutMs: -50 },
          { heartbeatIntervalMs: -25 },
          { keepAliveIntervalMs: -10 },
        ];

        invalidTimeouts.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });

      it('should reject invalid pool size values', () => {
        const invalidPoolSizes = [
          { poolSize: 0 },
          { poolSize: -1 },
          { poolSize: 101 },
          { poolSize: 1000 },
        ];

        invalidPoolSizes.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });

      it('should reject invalid health check interval values', () => {
        const invalidIntervals = [
          { healthCheckIntervalMs: -1 },
          { healthCheckIntervalMs: 4999 }, // Below minimum
        ];

        invalidIntervals.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });

      it('should reject non-integer values', () => {
        const invalidTypes = [
          { maxRetries: 3.5 },
          { timeoutMs: 30000.1 },
          { poolSize: 1.2 },
          { healthCheckIntervalMs: 30000.9 },
        ];

        invalidTypes.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });

      it('should reject non-numeric values', () => {
        const invalidTypes = [
          { maxRetries: 'three' },
          { timeoutMs: '30000' },
          { poolSize: [] },
          { healthCheckIntervalMs: {} },
          { heartbeatEnabled: 'true' },
        ];

        invalidTypes.forEach(config => {
          expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
        });
      });
    });

    describe('TypeScript type inference', () => {
      it('should provide correct TypeScript types', () => {
        const config = MCPConnectionConfigSchema.parse({
          maxRetries: 5,
          timeoutMs: 45000,
          poolSize: 2,
          healthCheckIntervalMs: 60000,
          heartbeatEnabled: false,
        });

        // Type assertions to ensure TypeScript compilation
        const maxRetries: number = config.maxRetries;
        const timeoutMs: number = config.timeoutMs;
        const poolSize: number = config.poolSize;
        const healthCheckIntervalMs: number = config.healthCheckIntervalMs;
        const heartbeatEnabled: boolean = config.heartbeatEnabled;

        expect(typeof maxRetries).toBe('number');
        expect(typeof timeoutMs).toBe('number');
        expect(typeof poolSize).toBe('number');
        expect(typeof healthCheckIntervalMs).toBe('number');
        expect(typeof heartbeatEnabled).toBe('boolean');

        expect(maxRetries).toBe(5);
        expect(timeoutMs).toBe(45000);
        expect(poolSize).toBe(2);
        expect(healthCheckIntervalMs).toBe(60000);
        expect(heartbeatEnabled).toBe(false);
      });

      it('should handle optional fields correctly in TypeScript', () => {
        const config: MCPConnectionConfig = {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
          healthCheckIntervalMs: 30000,
        };

        // All fields should be accessible without optional chaining
        expect(config.maxRetries).toBeDefined();
        expect(config.timeoutMs).toBeDefined();
        expect(config.poolSize).toBeDefined();
        expect(config.healthCheckIntervalMs).toBeDefined();
      });
    });
  });

  describe('MCPConnectionStateSchema', () => {
    describe('Valid state values', () => {
      it('should accept all valid connection states', () => {
        const validStates = [
          'disconnected',
          'connecting',
          'connected',
          'reconnecting',
          'error',
        ];

        validStates.forEach(state => {
          expect(() => MCPConnectionStateSchema.parse(state)).not.toThrow();
          const result = MCPConnectionStateSchema.parse(state);
          expect(result).toBe(state);
        });
      });

      it('should provide proper TypeScript types for states', () => {
        const states = MCPConnectionStateSchema.options; // Get the enum values
        expect(states).toContain('disconnected');
        expect(states).toContain('connecting');
        expect(states).toContain('connected');
        expect(states).toContain('reconnecting');
        expect(states).toContain('error');
      });
    });

    describe('Invalid state values', () => {
      it('should reject invalid connection states', () => {
        const invalidStates = [
          'unknown',
          'pending',
          'failed',
          'stopped',
          'running',
          'initializing',
          '',
          null,
          undefined,
          123,
          {},
          [],
        ];

        invalidStates.forEach(state => {
          expect(() => MCPConnectionStateSchema.parse(state)).toThrow();
        });
      });
    });

    describe('TypeScript type inference', () => {
      it('should provide correct TypeScript types', () => {
        const state: MCPConnectionState = 'connected';
        expect(state).toBe('connected');

        const stateFromParse: MCPConnectionState = MCPConnectionStateSchema.parse('connecting');
        expect(stateFromParse).toBe('connecting');
      });
    });
  });

  describe('MCPConnectionInfoSchema', () => {
    describe('Valid connection info configurations', () => {
      it('should accept minimal required fields', () => {
        const minimalInfo = {
          serverId: 'test-server-id',
          serverName: 'Test Server',
          config: {
            name: 'test-server',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
          state: 'disconnected' as const,
        };

        const result = MCPConnectionInfoSchema.parse(minimalInfo);

        expect(result.serverId).toBe('test-server-id');
        expect(result.serverName).toBe('Test Server');
        expect(result.config.name).toBe('test-server');
        expect(result.state).toBe('disconnected');
        expect(result.connectedAt).toBeUndefined();
        expect(result.lastActivityAt).toBeUndefined();
        expect(result.reconnectAttempts).toBe(0);
        expect(result.lastError).toBeUndefined();
        expect(result.metrics).toBeUndefined();
      });

      it('should accept complete configuration with all fields', () => {
        const now = new Date();
        const fullInfo = {
          serverId: 'full-server-id',
          serverName: 'Full Test Server',
          config: {
            name: 'full-test-server',
            type: 'http' as const,
            url: 'http://localhost:3000',
            headers: { 'Authorization': 'Bearer token' },
            autoStart: true,
            capabilities: ['filesystem', 'network'],
            connection: {
              maxRetries: 5,
              timeoutMs: 60000,
              poolSize: 2,
            },
          },
          state: 'connected' as const,
          connectedAt: now,
          lastActivityAt: now,
          reconnectAttempts: 2,
          lastError: 'Connection timeout',
          metrics: {
            requestCount: 150,
            errorCount: 3,
            averageResponseTimeMs: 250,
            lastRequestAt: now,
            bytesTransferred: 1024000,
            bytesSent: 500000,
            bytesReceived: 524000,
            uptimeMs: 3600000,
          },
        };

        const result = MCPConnectionInfoSchema.parse(fullInfo);

        expect(result.serverId).toBe('full-server-id');
        expect(result.serverName).toBe('Full Test Server');
        expect(result.config.name).toBe('full-test-server');
        expect(result.config.type).toBe('http');
        expect(result.config.url).toBe('http://localhost:3000');
        expect(result.config.autoStart).toBe(true);
        expect(result.state).toBe('connected');
        expect(result.connectedAt).toEqual(now);
        expect(result.lastActivityAt).toEqual(now);
        expect(result.reconnectAttempts).toBe(2);
        expect(result.lastError).toBe('Connection timeout');
        expect(result.metrics?.requestCount).toBe(150);
        expect(result.metrics?.errorCount).toBe(3);
        expect(result.metrics?.uptimeMs).toBe(3600000);
      });

      it('should handle different server configuration types', () => {
        const serverTypes = [
          {
            type: 'stdio' as const,
            command: 'npx',
            args: ['mcp-server'],
            env: { 'NODE_ENV': 'production' },
          },
          {
            type: 'http' as const,
            url: 'https://api.example.com/mcp',
            headers: { 'X-API-Key': 'secret' },
          },
          {
            type: 'sse' as const,
            url: 'https://events.example.com/mcp',
            headers: { 'Accept': 'text/event-stream' },
          },
          {
            type: 'sdk' as const,
          },
        ];

        serverTypes.forEach((configOverride, index) => {
          const info = {
            serverId: `server-${index}`,
            serverName: `Server ${index}`,
            config: {
              name: `server-${index}`,
              autoStart: false,
              ...configOverride,
            },
            state: 'disconnected' as const,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).not.toThrow();
          const result = MCPConnectionInfoSchema.parse(info);
          expect(result.config.type).toBe(configOverride.type);
        });
      });

      it('should handle all connection states', () => {
        const connectionStates: MCPConnectionState[] = [
          'disconnected',
          'connecting',
          'connected',
          'reconnecting',
          'error',
        ];

        connectionStates.forEach(state => {
          const info = {
            serverId: 'test-server',
            serverName: 'Test Server',
            config: {
              name: 'test-server',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).not.toThrow();
          const result = MCPConnectionInfoSchema.parse(info);
          expect(result.state).toBe(state);
        });
      });

      it('should handle metrics with various values', () => {
        const metricsVariants = [
          {
            requestCount: 0,
            errorCount: 0,
            averageResponseTimeMs: 0,
            bytesTransferred: 0,
            uptimeMs: 0,
          },
          {
            requestCount: 1000000,
            errorCount: 500,
            averageResponseTimeMs: 5000,
            bytesTransferred: 1073741824, // 1 GB
            uptimeMs: 86400000, // 1 day
          },
          {
            requestCount: 42,
            errorCount: 1,
            averageResponseTimeMs: 150,
            lastRequestAt: new Date(),
            bytesSent: 2048,
            bytesReceived: 4096,
          },
        ];

        metricsVariants.forEach((metrics, index) => {
          const info = {
            serverId: `metrics-test-${index}`,
            serverName: 'Metrics Test Server',
            config: {
              name: 'metrics-test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state: 'connected' as const,
            metrics,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).not.toThrow();
          const result = MCPConnectionInfoSchema.parse(info);
          expect(result.metrics).toEqual(expect.objectContaining(metrics));
        });
      });
    });

    describe('Validation errors', () => {
      it('should reject empty or invalid serverId', () => {
        const invalidServerIds = ['', '   ', null, undefined, 123, {}];

        invalidServerIds.forEach(serverId => {
          const info = {
            serverId,
            serverName: 'Test Server',
            config: {
              name: 'test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state: 'disconnected' as const,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
        });
      });

      it('should reject empty or invalid serverName', () => {
        const invalidServerNames = ['', '   ', null, undefined, 123, {}];

        invalidServerNames.forEach(serverName => {
          const info = {
            serverId: 'test-server',
            serverName,
            config: {
              name: 'test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state: 'disconnected' as const,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
        });
      });

      it('should reject invalid connection states', () => {
        const invalidStates = ['invalid', 'unknown', '', null, undefined, 123];

        invalidStates.forEach(state => {
          const info = {
            serverId: 'test-server',
            serverName: 'Test Server',
            config: {
              name: 'test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
        });
      });

      it('should reject invalid date values', () => {
        const invalidDates = ['invalid-date', 123, 'not-a-date', {}, []];

        invalidDates.forEach(date => {
          const info = {
            serverId: 'test-server',
            serverName: 'Test Server',
            config: {
              name: 'test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state: 'connected' as const,
            connectedAt: date,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
        });
      });

      it('should reject negative metric values', () => {
        const invalidMetrics = [
          { requestCount: -1 },
          { errorCount: -5 },
          { averageResponseTimeMs: -100 },
          { bytesTransferred: -1000 },
          { uptimeMs: -500 },
        ];

        invalidMetrics.forEach(metrics => {
          const info = {
            serverId: 'test-server',
            serverName: 'Test Server',
            config: {
              name: 'test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state: 'connected' as const,
            metrics,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
        });
      });

      it('should reject non-integer metric values', () => {
        const invalidMetrics = [
          { requestCount: 10.5 },
          { errorCount: 2.3 },
          { averageResponseTimeMs: 150.7 },
          { uptimeMs: 1000.1 },
        ];

        invalidMetrics.forEach(metrics => {
          const info = {
            serverId: 'test-server',
            serverName: 'Test Server',
            config: {
              name: 'test',
              type: 'stdio' as const,
              command: 'node',
              autoStart: false,
            },
            state: 'connected' as const,
            metrics,
          };

          expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
        });
      });

      it('should reject missing required fields', () => {
        const requiredFields = ['serverId', 'serverName', 'config', 'state'];

        requiredFields.forEach(fieldToOmit => {
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

          delete completeInfo[fieldToOmit as keyof typeof completeInfo];

          expect(() => MCPConnectionInfoSchema.parse(completeInfo)).toThrow();
        });
      });
    });

    describe('TypeScript type inference', () => {
      it('should provide correct TypeScript types', () => {
        const info = MCPConnectionInfoSchema.parse({
          serverId: 'type-test-server',
          serverName: 'Type Test Server',
          config: {
            name: 'type-test',
            type: 'stdio',
            command: 'node',
            args: ['--version'],
            autoStart: true,
          },
          state: 'connected',
          connectedAt: new Date(),
          reconnectAttempts: 1,
          metrics: {
            requestCount: 100,
            errorCount: 2,
            averageResponseTimeMs: 200,
            uptimeMs: 60000,
          },
        });

        // Type assertions to ensure TypeScript compilation
        const serverId: string = info.serverId;
        const serverName: string = info.serverName;
        const state: MCPConnectionState = info.state;
        const connectedAt: Date | undefined = info.connectedAt;
        const reconnectAttempts: number = info.reconnectAttempts;
        const requestCount: number | undefined = info.metrics?.requestCount;

        expect(typeof serverId).toBe('string');
        expect(typeof serverName).toBe('string');
        expect(typeof state).toBe('string');
        expect(connectedAt).toBeInstanceOf(Date);
        expect(typeof reconnectAttempts).toBe('number');
        expect(typeof requestCount).toBe('number');

        expect(serverId).toBe('type-test-server');
        expect(serverName).toBe('Type Test Server');
        expect(state).toBe('connected');
        expect(reconnectAttempts).toBe(1);
        expect(requestCount).toBe(100);
      });

      it('should handle backwards compatibility aliases', () => {
        // Test that MCPConnection type alias works
        const connection: MCPConnectionInfo = {
          serverId: 'alias-test',
          serverName: 'Alias Test',
          config: {
            name: 'alias-test',
            type: 'stdio',
            command: 'node',
            autoStart: false,
          },
          state: 'disconnected',
          reconnectAttempts: 0,
        };

        expect(connection.serverId).toBe('alias-test');
        expect(connection.state).toBe('disconnected');
      });
    });
  });

  describe('Integration tests', () => {
    it('should work together for complete MCP connection management', () => {
      // 1. Define connection configuration
      const connectionConfig = MCPConnectionConfigSchema.parse({
        maxRetries: 3,
        timeoutMs: 30000,
        poolSize: 2,
        healthCheckIntervalMs: 60000,
        heartbeatEnabled: true,
      });

      // 2. Create server config with connection settings
      const serverConfig = MCPServerConfigSchema.parse({
        name: 'integration-test-server',
        type: 'stdio',
        command: 'npx',
        args: ['integration-test-server'],
        autoStart: true,
        capabilities: ['filesystem'],
        connection: connectionConfig,
      });

      // 3. Create connection info that tracks the connection
      const connectionInfo = MCPConnectionInfoSchema.parse({
        serverId: 'integration-test-001',
        serverName: serverConfig.name,
        config: serverConfig,
        state: 'connecting',
        reconnectAttempts: 0,
      });

      // 4. Simulate state transitions
      const states: MCPConnectionState[] = ['connecting', 'connected'];

      states.forEach(state => {
        const updatedInfo = MCPConnectionInfoSchema.parse({
          ...connectionInfo,
          state,
          connectedAt: state === 'connected' ? new Date() : undefined,
        });
        expect(updatedInfo.state).toBe(state);
      });

      // 5. Verify configuration inheritance
      expect(connectionInfo.config.connection?.maxRetries).toBe(3);
      expect(connectionInfo.config.connection?.poolSize).toBe(2);
      expect(connectionInfo.serverId).toBe('integration-test-001');
      expect(connectionInfo.serverName).toBe('integration-test-server');
    });

    it('should handle error scenarios in connection workflow', () => {
      const connectionInfo = MCPConnectionInfoSchema.parse({
        serverId: 'error-test-server',
        serverName: 'Error Test Server',
        config: {
          name: 'error-test',
          type: 'http',
          url: 'http://invalid-url:9999',
          autoStart: false,
        },
        state: 'error',
        reconnectAttempts: 3,
        lastError: 'Connection refused',
      });

      expect(connectionInfo.state).toBe('error');
      expect(connectionInfo.reconnectAttempts).toBe(3);
      expect(connectionInfo.lastError).toBe('Connection refused');

      // Can transition to reconnecting
      const reconnectingInfo = MCPConnectionInfoSchema.parse({
        ...connectionInfo,
        state: 'reconnecting',
        reconnectAttempts: 4,
      });

      expect(reconnectingInfo.state).toBe('reconnecting');
      expect(reconnectingInfo.reconnectAttempts).toBe(4);
    });

    it('should validate configuration hierarchies', () => {
      // Global connection config
      const globalConfig = MCPConnectionConfigSchema.parse({
        maxRetries: 5,
        timeoutMs: 60000,
        poolSize: 3,
      });

      // Per-server override config
      const serverOverrideConfig = MCPConnectionConfigSchema.parse({
        maxRetries: 2,
        timeoutMs: 15000,
        // poolSize inherits from global (3)
      });

      // Verify both are valid
      expect(globalConfig.maxRetries).toBe(5);
      expect(globalConfig.timeoutMs).toBe(60000);
      expect(globalConfig.poolSize).toBe(3);

      expect(serverOverrideConfig.maxRetries).toBe(2);
      expect(serverOverrideConfig.timeoutMs).toBe(15000);
      expect(serverOverrideConfig.poolSize).toBe(1); // Default, not inherited
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle extreme timeout values', () => {
      const extremeConfig = {
        timeoutMs: 1, // Very short timeout
        connectTimeoutMs: 1000000, // Very long connect timeout
        healthCheckIntervalMs: 5000, // Minimum health check interval
      };

      const result = MCPConnectionConfigSchema.parse(extremeConfig);
      expect(result.timeoutMs).toBe(1);
      expect(result.connectTimeoutMs).toBe(1000000);
      expect(result.healthCheckIntervalMs).toBe(5000);
    });

    it('should handle Unicode strings in connection info', () => {
      const unicodeInfo = {
        serverId: 'тест-서버-测试-🚀',
        serverName: 'Test Server with Unicode тест 🌟',
        config: {
          name: 'unicode-test-server',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
        },
        state: 'connected' as const,
      };

      const result = MCPConnectionInfoSchema.parse(unicodeInfo);
      expect(result.serverId).toBe('тест-서버-测试-🚀');
      expect(result.serverName).toBe('Test Server with Unicode тест 🌟');
    });

    it('should handle very large metric values', () => {
      const largeMetrics = {
        requestCount: Number.MAX_SAFE_INTEGER,
        errorCount: 0,
        averageResponseTimeMs: 999999,
        bytesTransferred: Number.MAX_SAFE_INTEGER,
        uptimeMs: Number.MAX_SAFE_INTEGER,
      };

      const info = {
        serverId: 'large-metrics-test',
        serverName: 'Large Metrics Test',
        config: {
          name: 'large-metrics',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
        },
        state: 'connected' as const,
        metrics: largeMetrics,
      };

      const result = MCPConnectionInfoSchema.parse(info);
      expect(result.metrics?.requestCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.metrics?.bytesTransferred).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle edge dates', () => {
      const edgeDates = [
        new Date(0), // Unix epoch
        new Date('1970-01-01T00:00:00Z'),
        new Date('2038-01-19T03:14:07Z'), // Y2038 boundary
        new Date('9999-12-31T23:59:59Z'), // Far future
      ];

      edgeDates.forEach(date => {
        const info = {
          serverId: 'edge-date-test',
          serverName: 'Edge Date Test',
          config: {
            name: 'edge-date',
            type: 'stdio' as const,
            command: 'node',
            autoStart: false,
          },
          state: 'connected' as const,
          connectedAt: date,
          lastActivityAt: date,
        };

        const result = MCPConnectionInfoSchema.parse(info);
        expect(result.connectedAt).toEqual(date);
        expect(result.lastActivityAt).toEqual(date);
      });
    });
  });
});