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
      expect(result.timeoutMs).toBe(30000); // default
      expect(result.connectTimeoutMs).toBe(5000); // default
      expect(result.poolSize).toBe(1); // default
      expect(result.healthCheckIntervalMs).toBe(60000); // default
      expect(result.heartbeatEnabled).toBe(true); // default
      expect(result.heartbeatIntervalMs).toBe(30000); // default
    });

    it('should accept complete configuration', () => {
      const completeConfig: MCPConnectionConfig = {
        maxRetries: 5,
        timeoutMs: 45000,
        connectTimeoutMs: 10000,
        readTimeoutMs: 120000,
        poolSize: 3,
        healthCheckEnabled: true,
        healthCheckIntervalMs: 30000,
        heartbeatEnabled: false,
        heartbeatIntervalMs: 60000,
      };

      const result = MCPConnectionConfigSchema.parse(completeConfig);
      expect(result.maxRetries).toBe(5);
      expect(result.timeoutMs).toBe(45000);
      expect(result.connectTimeoutMs).toBe(10000);
      expect(result.readTimeoutMs).toBe(120000);
      expect(result.poolSize).toBe(3);
      expect(result.healthCheckEnabled).toBe(true);
      expect(result.healthCheckIntervalMs).toBe(30000);
      expect(result.heartbeatEnabled).toBe(false);
    });

    it('should handle edge values within valid ranges', () => {
      const edgeConfig: MCPConnectionConfig = {
        maxRetries: 0, // minimum
        timeoutMs: 1, // very small
        connectTimeoutMs: 1, // very small
        readTimeoutMs: 0, // minimum
        poolSize: 100, // maximum
        healthCheckIntervalMs: 5000, // minimum
        heartbeatIntervalMs: 0, // minimum
      };

      const result = MCPConnectionConfigSchema.parse(edgeConfig);
      expect(result.maxRetries).toBe(0);
      expect(result.timeoutMs).toBe(1);
      expect(result.poolSize).toBe(100);
      expect(result.healthCheckIntervalMs).toBe(5000);
    });

    it('should reject invalid values outside ranges', () => {
      const invalidConfigs = [
        { maxRetries: -1 }, // below minimum
        { maxRetries: 101 }, // above maximum
        { timeoutMs: -1 }, // below minimum
        { connectTimeoutMs: -1 }, // below minimum
        { readTimeoutMs: -1 }, // below minimum
        { poolSize: 0 }, // below minimum
        { poolSize: 101 }, // above maximum
        { healthCheckIntervalMs: 4999 }, // below minimum
        { heartbeatIntervalMs: -1 }, // below minimum
      ];

      invalidConfigs.forEach(config => {
        expect(() => MCPConnectionConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject non-numeric values for numeric fields', () => {
      const invalidConfigs = [
        { maxRetries: 'three' },
        { timeoutMs: '30000' },
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
            timeoutMs: 30000,
          },
        },
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:00Z'),
        lastActivityAt: new Date('2024-01-15T10:30:00Z'),
        reconnectAttempts: 2,
        lastError: 'Connection timeout',
        lastErrorAt: new Date('2024-01-15T09:55:00Z'),
        version: '1.2.3',
        capabilities: ['filesystem', 'network'],
        performance: {
          avgResponseTime: 250,
          requestCount: 150,
          errorRate: 0.02,
          lastMeasured: new Date('2024-01-15T10:25:00Z'),
        },
      };

      const result = MCPConnectionInfoSchema.parse(completeInfo);
      expect(result.serverName).toBe('Comprehensive MCP Server');
      expect(result.connectedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.reconnectAttempts).toBe(2);
      expect(result.capabilities).toContain('filesystem');
      expect(result.performance?.avgResponseTime).toBe(250);
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
        lastErrorAt: new Date('2024-01-15T11:00:00Z'),
        reconnectAttempts: 5,
      };

      const result = MCPConnectionInfoSchema.parse(errorInfo);
      expect(result.state).toBe('error');
      expect(result.lastError).toBe('Server unreachable');
      expect(result.reconnectAttempts).toBe(5);
    });

    it('should handle connection with performance metrics', () => {
      const perfInfo: MCPConnectionInfo = {
        ...baseConnectionInfo,
        performance: {
          avgResponseTime: 150,
          requestCount: 1000,
          errorRate: 0.001,
          lastMeasured: new Date(),
        },
      };

      const result = MCPConnectionInfoSchema.parse(perfInfo);
      expect(result.performance?.avgResponseTime).toBe(150);
      expect(result.performance?.requestCount).toBe(1000);
      expect(result.performance?.errorRate).toBe(0.001);
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

    it('should reject negative performance metrics', () => {
      const invalidPerf = {
        ...baseConnectionInfo,
        performance: {
          avgResponseTime: -100,
          requestCount: -10,
          errorRate: -0.1,
          lastMeasured: new Date(),
        },
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidPerf)).toThrow();
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
          timeoutMs: 30000,
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
        version: '1.0.0',
        capabilities: ['filesystem', 'api'],
        performance: {
          avgResponseTime: 200,
          requestCount: 50,
          errorRate: 0.0,
          lastMeasured: new Date('2024-01-15T10:30:00Z'),
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
      expect(validConnected.performance?.requestCount).toBe(50);
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
            timeoutMs: 5000, // Fast timeout
            connectTimeoutMs: 2000,
            readTimeoutMs: 10000,
            poolSize: 50, // Large pool
            healthCheckEnabled: true,
            healthCheckIntervalMs: 5000, // Frequent checks
            heartbeatEnabled: true,
            heartbeatIntervalMs: 10000,
          },
        },
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:00Z'),
        lastActivityAt: new Date('2024-01-15T10:35:00Z'),
        version: '2.5.0',
        capabilities: ['filesystem', 'network', 'database', 'cache'],
        performance: {
          avgResponseTime: 50, // Very fast
          requestCount: 10000, // High volume
          errorRate: 0.0001, // Very low error rate
          lastMeasured: new Date('2024-01-15T10:35:00Z'),
        },
      };

      const result = MCPConnectionInfoSchema.parse(highPerfConnection);
      expect(result.config.connection?.poolSize).toBe(50);
      expect(result.performance?.avgResponseTime).toBe(50);
      expect(result.performance?.requestCount).toBe(10000);
      expect(result.capabilities).toContain('database');
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
        version: '1.0.0-测试',
        capabilities: ['unicode-支持', 'тест-capability'],
      };

      const result = MCPConnectionInfoSchema.parse(unicodeConnection);
      expect(result.serverId).toBe('unicode-server-测试');
      expect(result.serverName).toBe('Unicode MCP Server тест 🚀');
      expect(result.capabilities).toContain('unicode-支持');
    });

    it('should handle extreme performance values', () => {
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
        performance: {
          avgResponseTime: 1, // 1ms - extremely fast
          requestCount: 1000000, // 1 million requests
          errorRate: 0.0, // Perfect reliability
          lastMeasured: new Date(),
        },
      };

      const result = MCPConnectionInfoSchema.parse(extremeConnection);
      expect(result.performance?.avgResponseTime).toBe(1);
      expect(result.performance?.requestCount).toBe(1000000);
      expect(result.performance?.errorRate).toBe(0.0);
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
        reconnectAttempts: -5, // negative value
        performance: {
          avgResponseTime: -100, // negative value
          requestCount: -50, // negative value
          errorRate: 1.5, // > 1.0
          lastMeasured: new Date(),
        },
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidNumericConnection)).toThrow();
    });
  });
});