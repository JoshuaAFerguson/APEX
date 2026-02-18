import { describe, it, expect } from 'vitest';
import {
  MCPConnectionStateSchema,
  MCPConnectionInfoSchema,
  MCPConnectionSchema,
  MCPConnectionEventSchema,
  MCPConnectionEventTypeSchema,
  MCPConnectionConfigSchema,
  type MCPConnectionState,
  type MCPConnectionInfo,
  type MCPConnection,
  type MCPConnectionEvent,
  type MCPConnectionEventType,
  type MCPConnectionConfig,
} from '../types.js';

/**
 * Comprehensive test suite for MCP Connection types and schemas
 * Tests validation, edge cases, and TypeScript type inference for MCP connection management
 */
describe('MCP Connection Types and Schemas', () => {
  describe('MCPConnectionStateSchema', () => {
    it('should accept all valid connection states', () => {
      const validStates: MCPConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'error',
      ];

      validStates.forEach(state => {
        const result = MCPConnectionStateSchema.parse(state);
        expect(result).toBe(state);
      });
    });

    it('should reject invalid connection states', () => {
      const invalidStates = [
        'unknown',
        'pending',
        'active',
        'inactive',
        123,
        null,
        undefined,
        {},
        [],
      ];

      invalidStates.forEach(state => {
        expect(() => MCPConnectionStateSchema.parse(state)).toThrow();
      });
    });

    it('should provide proper TypeScript types', () => {
      const state: MCPConnectionState = 'connected';
      expect(state).toBe('connected');

      const stateFromParse: MCPConnectionState = MCPConnectionStateSchema.parse('connecting');
      expect(stateFromParse).toBe('connecting');
    });
  });

  describe('MCPConnectionConfigSchema', () => {
    it('should accept minimal configuration with defaults', () => {
      const minimalConfig = {};

      const result = MCPConnectionConfigSchema.parse(minimalConfig);
      expect(result.maxRetries).toBe(3); // default
      expect(result.requestTimeoutMs).toBe(30000); // default
      expect(result.connectionTimeoutMs).toBe(10000); // default
      expect(result.poolSize).toBe(1); // default
      expect(result.healthCheckIntervalMs).toBe(30000); // default
      expect(result.heartbeatEnabled).toBe(true); // default
      expect(result.heartbeatIntervalMs).toBe(30000); // default
    });

    it('should accept complete configuration', () => {
      const completeConfig: MCPConnectionConfig = {
        maxRetries: 5,
        requestTimeoutMs: 45000,
        connectionTimeoutMs: 10000,
        poolSize: 3,
        healthCheckIntervalMs: 30000,
        heartbeatEnabled: false,
        heartbeatIntervalMs: 60000,
      };

      const result = MCPConnectionConfigSchema.parse(completeConfig);
      expect(result.maxRetries).toBe(5);
      expect(result.requestTimeoutMs).toBe(45000);
      expect(result.connectionTimeoutMs).toBe(10000);
      expect(result.poolSize).toBe(3);
      expect(result.healthCheckIntervalMs).toBe(30000);
      expect(result.heartbeatEnabled).toBe(false);
    });

    it('should handle edge values within valid ranges', () => {
      const edgeConfig: MCPConnectionConfig = {
        maxRetries: 0, // minimum
        requestTimeoutMs: 1, // very small
        connectionTimeoutMs: 1, // very small
        poolSize: 100, // maximum
        healthCheckIntervalMs: 5000, // minimum
        heartbeatIntervalMs: 0, // minimum
      };

      const result = MCPConnectionConfigSchema.parse(edgeConfig);
      expect(result.maxRetries).toBe(0);
      expect(result.requestTimeoutMs).toBe(1);
      expect(result.poolSize).toBe(100);
      expect(result.healthCheckIntervalMs).toBe(5000);
    });

    it('should reject invalid values outside ranges', () => {
      const invalidConfigs = [
        { maxRetries: -1 }, // below minimum
        { requestTimeoutMs: -1 }, // below minimum
        { connectionTimeoutMs: -1 }, // below minimum
        { poolSize: 0 }, // below minimum
        { poolSize: 101 }, // above maximum
        { healthCheckIntervalMs: -1 }, // below minimum
        { heartbeatIntervalMs: -1 }, // below minimum
      ];

      invalidConfigs.forEach(config => {
        expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject non-numeric values for numeric fields', () => {
      const invalidConfigs = [
        { maxRetries: 'three' },
        { requestTimeoutMs: '30000' },
        { poolSize: true },
        { healthCheckIntervalMs: null },
      ];

      invalidConfigs.forEach(config => {
        expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('MCPConnectionInfoSchema', () => {
    const baseConnectionInfo = {
      serverId: 'test-server',
      serverName: 'Test MCP Server',
      config: {
        name: 'Test Server',
        type: 'stdio' as const,
        command: 'node',
        autoStart: false,
      },
      state: 'connected' as const,
    };

    it('should accept minimal connection info', () => {
      const result = MCPConnectionInfoSchema.parse(baseConnectionInfo);
      expect(result.serverId).toBe('test-server');
      expect(result.state).toBe('connected');
    });

    it('should accept complete connection info', () => {
      const completeInfo: MCPConnectionInfo = {
        serverId: 'comprehensive-server',
        serverName: 'Comprehensive MCP Server',
        config: {
          name: 'Comprehensive Server',
          type: 'http',
          url: 'http://localhost:3000/mcp',
          autoStart: true,
          connection: {
            maxRetries: 3,
            requestTimeoutMs: 30000,
          },
        },
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:00Z'),
        lastActivityAt: new Date('2024-01-15T10:30:00Z'),
        reconnectAttempts: 2,
        lastError: 'Connection timeout',
        metrics: {
          totalRequests: 150,
          successfulRequests: 147,
          failedRequests: 3,
          bytesSent: 5000,
          bytesReceived: 10000,
          uptimeMs: 1800000,
        },
      };

      const result = MCPConnectionInfoSchema.parse(completeInfo);
      expect(result.serverName).toBe('Comprehensive MCP Server');
      expect(result.connectedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.reconnectAttempts).toBe(2);
      expect(result.metrics?.totalRequests).toBe(150);
      expect(result.metrics?.failedRequests).toBe(3);
    });

    it('should handle all connection states', () => {
      const states: MCPConnectionState[] = ['disconnected', 'connecting', 'connected', 'reconnecting', 'error'];

      states.forEach(state => {
        const info = { ...baseConnectionInfo, state };
        const result = MCPConnectionInfoSchema.parse(info);
        expect(result.state).toBe(state);
      });
    });

    it('should handle error state with error details', () => {
      const errorInfo: MCPConnectionInfo = {
        ...baseConnectionInfo,
        state: 'error',
        lastError: 'Server unreachable',
        reconnectAttempts: 5,
      };

      const result = MCPConnectionInfoSchema.parse(errorInfo);
      expect(result.state).toBe('error');
      expect(result.lastError).toBe('Server unreachable');
      expect(result.reconnectAttempts).toBe(5);
    });

    it('should handle connection with metrics', () => {
      const metricsInfo: MCPConnectionInfo = {
        ...baseConnectionInfo,
        metrics: {
          totalRequests: 1000,
          successfulRequests: 999,
          failedRequests: 1,
          bytesSent: 50000,
          bytesReceived: 100000,
          uptimeMs: 3600000,
        },
      };

      const result = MCPConnectionInfoSchema.parse(metricsInfo);
      expect(result.metrics?.totalRequests).toBe(1000);
      expect(result.metrics?.successfulRequests).toBe(999);
      expect(result.metrics?.failedRequests).toBe(1);
    });

    it('should reject connection info with empty serverId or serverName', () => {
      const invalidInfos = [
        { ...baseConnectionInfo, serverId: '' },
        { ...baseConnectionInfo, serverName: '' },
        { ...baseConnectionInfo, serverId: null },
        { ...baseConnectionInfo, serverName: null },
      ];

      invalidInfos.forEach(info => {
        expect(() => MCPConnectionInfoSchema.parse(info)).toThrow();
      });
    });

    it('should reject negative metrics values', () => {
      const invalidMetrics = {
        ...baseConnectionInfo,
        metrics: {
          totalRequests: -1,
          successfulRequests: -10,
          failedRequests: -5,
          bytesSent: 0,
          bytesReceived: 0,
          uptimeMs: 0,
        },
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidMetrics)).toThrow();
    });
  });

  describe('MCPConnectionEventTypeSchema', () => {
    it('should accept all valid event types', () => {
      const validTypes: MCPConnectionEventType[] = [
        'connected',
        'disconnected',
        'error',
        'reconnecting',
      ];

      validTypes.forEach(type => {
        const result = MCPConnectionEventTypeSchema.parse(type);
        expect(result).toBe(type);
      });
    });

    it('should reject invalid event types', () => {
      const invalidTypes = [
        'connecting',
        'failed',
        'timeout',
        'ready',
        123,
        null,
        undefined,
      ];

      invalidTypes.forEach(type => {
        expect(() => MCPConnectionEventTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('MCPConnectionEventSchema', () => {
    const baseEvent = {
      type: 'connected' as const,
      serverId: 'test-server',
      serverName: 'Test Server',
      previousState: 'connecting' as const,
      newState: 'connected' as const,
      timestamp: new Date('2024-01-15T10:00:00Z'),
    };

    it('should accept minimal connection event', () => {
      const result = MCPConnectionEventSchema.parse(baseEvent);
      expect(result.type).toBe('connected');
      expect(result.serverId).toBe('test-server');
      expect(result.previousState).toBe('connecting');
      expect(result.newState).toBe('connected');
    });

    it('should accept complete connection event', () => {
      const completeEvent: MCPConnectionEvent = {
        type: 'error',
        serverId: 'problematic-server',
        serverName: 'Problematic MCP Server',
        previousState: 'connected',
        newState: 'error',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        message: 'Connection lost due to network timeout',
        error: new Error('Network timeout'),
      };

      const result = MCPConnectionEventSchema.parse(completeEvent);
      expect(result.type).toBe('error');
      expect(result.message).toBe('Connection lost due to network timeout');
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should handle different event type combinations', () => {
      const eventCombinations = [
        {
          type: 'connected' as const,
          previousState: 'connecting' as const,
          newState: 'connected' as const,
          message: 'Successfully connected to server',
        },
        {
          type: 'disconnected' as const,
          previousState: 'connected' as const,
          newState: 'disconnected' as const,
          message: 'Server disconnected gracefully',
        },
        {
          type: 'reconnecting' as const,
          previousState: 'error' as const,
          newState: 'reconnecting' as const,
          message: 'Attempting to reconnect after error',
        },
        {
          type: 'error' as const,
          previousState: 'connected' as const,
          newState: 'error' as const,
          message: 'Connection error occurred',
          error: { name: 'ConnectionError', message: 'Timeout' },
        },
      ];

      eventCombinations.forEach(eventData => {
        const event = {
          ...baseEvent,
          ...eventData,
        };
        const result = MCPConnectionEventSchema.parse(event);
        expect(result.type).toBe(eventData.type);
        expect(result.previousState).toBe(eventData.previousState);
        expect(result.newState).toBe(eventData.newState);
      });
    });

    it('should reject event with empty required fields', () => {
      const invalidEvents = [
        { ...baseEvent, type: null },
        { ...baseEvent, serverId: '' },
        { ...baseEvent, serverName: '' },
        { ...baseEvent, timestamp: null },
      ];

      invalidEvents.forEach(event => {
        expect(() => MCPConnectionEventSchema.parse(event)).toThrow();
      });
    });
  });

  describe('Backwards Compatibility', () => {
    it('should ensure MCPConnectionSchema is alias for MCPConnectionInfoSchema', () => {
      const connectionInfo = {
        serverId: 'compat-server',
        serverName: 'Compatibility Test Server',
        config: {
          name: 'Compat Server',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
        },
        state: 'connected' as const,
      };

      // Both should parse the same way
      const infoResult = MCPConnectionInfoSchema.parse(connectionInfo);
      const compatResult = MCPConnectionSchema.parse(connectionInfo);

      expect(infoResult).toEqual(compatResult);
      expect(infoResult.serverId).toBe('compat-server');
    });

    it('should ensure type aliases work correctly', () => {
      const info: MCPConnectionInfo = {
        serverId: 'alias-test',
        serverName: 'Alias Test',
        config: {
          name: 'Test',
          type: 'stdio',
          command: 'node',
          autoStart: false,
        },
        state: 'connected',
      };

      // Should be assignable to alias type
      const connection: MCPConnection = info;
      expect(connection.serverId).toBe('alias-test');
    });
  });

  describe('Integration and Real-World Scenarios', () => {
    it('should handle complete connection lifecycle', () => {
      const serverId = 'lifecycle-server';
      const serverName = 'Lifecycle Test Server';
      const config = {
        name: 'Lifecycle Server',
        type: 'http' as const,
        url: 'http://localhost:3000/mcp',
        autoStart: true,
        connection: {
          maxRetries: 3,
          requestTimeoutMs: 30000,
          healthCheckIntervalMs: 60000,
        },
      };

      // 1. Initial disconnected state
      const initialConnection: MCPConnectionInfo = {
        serverId,
        serverName,
        config,
        state: 'disconnected',
      };

      // 2. Connecting event
      const connectingEvent: MCPConnectionEvent = {
        type: 'connected',
        serverId,
        serverName,
        previousState: 'disconnected',
        newState: 'connecting',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        message: 'Initiating connection to server',
      };

      // 3. Connected state with activity
      const connectedConnection: MCPConnectionInfo = {
        serverId,
        serverName,
        config,
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:01Z'),
        lastActivityAt: new Date('2024-01-15T10:30:00Z'),
        metrics: {
          totalRequests: 50,
          successfulRequests: 50,
          failedRequests: 0,
          bytesSent: 5000,
          bytesReceived: 10000,
          uptimeMs: 1800000,
        },
      };

      // 4. Error event
      const errorEvent: MCPConnectionEvent = {
        type: 'error',
        serverId,
        serverName,
        previousState: 'connected',
        newState: 'error',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        message: 'Connection lost due to server restart',
        error: { name: 'ConnectionLost', message: 'Server restart detected' },
      };

      // 5. Reconnecting event
      const reconnectingEvent: MCPConnectionEvent = {
        type: 'reconnecting',
        serverId,
        serverName,
        previousState: 'error',
        newState: 'reconnecting',
        timestamp: new Date('2024-01-15T11:00:05Z'),
        message: 'Attempting automatic reconnection',
      };

      // Validate all lifecycle components
      const validInitial = MCPConnectionInfoSchema.parse(initialConnection);
      const validConnecting = MCPConnectionEventSchema.parse(connectingEvent);
      const validConnected = MCPConnectionInfoSchema.parse(connectedConnection);
      const validError = MCPConnectionEventSchema.parse(errorEvent);
      const validReconnecting = MCPConnectionEventSchema.parse(reconnectingEvent);

      expect(validInitial.state).toBe('disconnected');
      expect(validConnecting.type).toBe('connected');
      expect(validConnected.metrics?.totalRequests).toBe(50);
      expect(validError.error?.name).toBe('ConnectionLost');
      expect(validReconnecting.newState).toBe('reconnecting');
    });

    it('should handle high-performance server configuration', () => {
      const highPerfConnection: MCPConnectionInfo = {
        serverId: 'high-perf-server',
        serverName: 'High Performance MCP Server',
        config: {
          name: 'High Performance Server',
          type: 'http',
          url: 'https://high-perf.example.com/mcp',
          headers: {
            'X-API-Version': 'v2',
            'Authorization': 'Bearer high-perf-token',
          },
          autoStart: true,
          connection: {
            maxRetries: 10,
            requestTimeoutMs: 5000, // Fast timeout
            connectionTimeoutMs: 2000,
            poolSize: 50, // Large pool
            healthCheckIntervalMs: 5000, // Frequent checks
            heartbeatEnabled: true,
            heartbeatIntervalMs: 10000,
          },
        },
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:00Z'),
        lastActivityAt: new Date('2024-01-15T10:35:00Z'),
        metrics: {
          totalRequests: 10000,
          successfulRequests: 9999,
          failedRequests: 1,
          bytesSent: 500000,
          bytesReceived: 1000000,
          uptimeMs: 2100000,
        },
      };

      const result = MCPConnectionInfoSchema.parse(highPerfConnection);
      expect(result.config.connection?.poolSize).toBe(50);
      expect(result.metrics?.totalRequests).toBe(10000);
      expect(result.metrics?.successfulRequests).toBe(9999);
    });

    it('should handle edge cases with Unicode and special characters', () => {
      const unicodeConnection: MCPConnectionInfo = {
        serverId: 'unicode-server-测试',
        serverName: 'Unicode MCP Server тест 🚀',
        config: {
          name: 'Unicode Test Server 测试服务器',
          type: 'stdio',
          command: 'node',
          args: ['--config', '/path/with/unicode/测试/тест/🔧/config.json'],
          autoStart: false,
        },
        state: 'connected',
        lastError: 'Previous error: 测试错误',
      };

      const result = MCPConnectionInfoSchema.parse(unicodeConnection);
      expect(result.serverId).toBe('unicode-server-测试');
      expect(result.serverName).toBe('Unicode MCP Server тест 🚀');
      expect(result.lastError).toBe('Previous error: 测试错误');
    });

    it('should handle extreme metrics values', () => {
      const extremeConnection: MCPConnectionInfo = {
        serverId: 'extreme-server',
        serverName: 'Extreme Performance Server',
        config: {
          name: 'Extreme Server',
          type: 'http',
          url: 'http://localhost:3000',
          autoStart: false,
        },
        state: 'connected',
        metrics: {
          totalRequests: 1000000, // 1 million requests
          successfulRequests: 1000000, // Perfect reliability
          failedRequests: 0,
          bytesSent: 999999999,
          bytesReceived: 999999999,
          uptimeMs: 86400000, // 24 hours
        },
      };

      const result = MCPConnectionInfoSchema.parse(extremeConnection);
      expect(result.metrics?.totalRequests).toBe(1000000);
      expect(result.metrics?.successfulRequests).toBe(1000000);
      expect(result.metrics?.failedRequests).toBe(0);
    });
  });

  describe('Error Handling and Validation', () => {
    it('should provide clear error messages for invalid data', () => {
      const invalidConnection = {
        serverId: '', // empty
        serverName: 'Test',
        config: {
          name: 'Test',
          type: 'invalid-type', // invalid
          autoStart: false,
        },
        state: 'invalid-state', // invalid
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidConnection)).toThrow();
    });

    it('should handle malformed date objects', () => {
      const invalidDateConnection = {
        serverId: 'date-test',
        serverName: 'Date Test',
        config: {
          name: 'Test',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
        },
        state: 'connected' as const,
        connectedAt: 'invalid-date', // invalid date
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidDateConnection)).toThrow();
    });

    it('should validate numeric constraints properly', () => {
      const invalidNumericConnection = {
        serverId: 'numeric-test',
        serverName: 'Numeric Test',
        config: {
          name: 'Test',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
        },
        state: 'connected' as const,
        reconnectAttempts: -5, // negative value - schema has .min(0)
        metrics: {
          totalRequests: -100, // negative value
          successfulRequests: -50, // negative value
          failedRequests: -10, // negative value
          bytesSent: 0,
          bytesReceived: 0,
          uptimeMs: 0,
        },
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidNumericConnection)).toThrow();
    });
  });
});