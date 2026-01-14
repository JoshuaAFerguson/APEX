import {
  MCPConnectionConfigSchema,
  MCPConnectionConfig,
  MCPConnectionStateSchema,
  MCPConnectionState,
  MCPConnectionInfoSchema,
  MCPConnectionInfo,
  MCPConnection,
  MCPConnectionEventSchema,
  MCPConnectionEvent,
  MCPConnectionEventTypeSchema,
  MCPConnectionEventType,
} from '../types.js';

/**
 * Test file to verify that MCP connection types are properly exported and accessible
 * This validates the export requirements for the new MCP connection types added in v0.5.0
 */
describe('MCP Connection Types Export Validation', () => {
  describe('MCPConnectionConfig exports', () => {
    it('should export MCPConnectionConfigSchema', () => {
      expect(MCPConnectionConfigSchema).toBeDefined();
      expect(typeof MCPConnectionConfigSchema).toBe('object');
      expect(typeof MCPConnectionConfigSchema.parse).toBe('function');
      expect(typeof MCPConnectionConfigSchema.safeParse).toBe('function');
    });

    it('should have working MCPConnectionConfig type (compile-time verification)', () => {
      const createConnectionConfig = (config: MCPConnectionConfig): MCPConnectionConfig => config;

      const testConfig: MCPConnectionConfig = {
        maxRetries: 5,
        timeoutMs: 30000,
        connectTimeoutMs: 5000,
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

      const result = createConnectionConfig(testConfig);
      expect(result.maxRetries).toBe(5);
      expect(result.poolSize).toBe(2);
      expect(result.heartbeatEnabled).toBe(true);
    });

    it('should handle partial configuration with defaults', () => {
      const partialConfig = MCPConnectionConfigSchema.parse({
        maxRetries: 2,
        timeoutMs: 15000,
      });

      // Type should be assignable
      const typedConfig: MCPConnectionConfig = partialConfig;
      expect(typedConfig.maxRetries).toBe(2);
      expect(typedConfig.timeoutMs).toBe(15000);
      expect(typedConfig.poolSize).toBe(1); // Default value
    });
  });

  describe('MCPConnectionState exports', () => {
    it('should export MCPConnectionStateSchema', () => {
      expect(MCPConnectionStateSchema).toBeDefined();
      expect(typeof MCPConnectionStateSchema).toBe('object');
      expect(typeof MCPConnectionStateSchema.parse).toBe('function');
      expect(typeof MCPConnectionStateSchema.safeParse).toBe('function');
    });

    it('should have working MCPConnectionState type (compile-time verification)', () => {
      const processState = (state: MCPConnectionState): string => `Current state: ${state}`;

      const testState: MCPConnectionState = 'connected';
      const result = processState(testState);
      expect(result).toBe('Current state: connected');

      // Test all valid state values
      const allStates: MCPConnectionState[] = [
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'error',
      ];

      allStates.forEach(state => {
        const stateResult = processState(state);
        expect(stateResult).toBe(`Current state: ${state}`);
      });
    });
  });

  describe('MCPConnectionInfo exports', () => {
    it('should export MCPConnectionInfoSchema', () => {
      expect(MCPConnectionInfoSchema).toBeDefined();
      expect(typeof MCPConnectionInfoSchema).toBe('object');
      expect(typeof MCPConnectionInfoSchema.parse).toBe('function');
      expect(typeof MCPConnectionInfoSchema.safeParse).toBe('function');
    });

    it('should have working MCPConnectionInfo type (compile-time verification)', () => {
      const createConnectionInfo = (info: MCPConnectionInfo): MCPConnectionInfo => info;

      const testInfo: MCPConnectionInfo = {
        serverId: 'export-test-server',
        serverName: 'Export Test Server',
        config: {
          name: 'export-test',
          type: 'stdio',
          command: 'node',
          autoStart: false,
        },
        state: 'connected',
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        reconnectAttempts: 1,
        metrics: {
          requestCount: 42,
          errorCount: 1,
          averageResponseTimeMs: 150,
          bytesTransferred: 1024,
          bytesSent: 512,
          bytesReceived: 512,
          uptimeMs: 60000,
        },
      };

      const result = createConnectionInfo(testInfo);
      expect(result.serverId).toBe('export-test-server');
      expect(result.state).toBe('connected');
      expect(result.metrics?.requestCount).toBe(42);
    });

    it('should support backwards compatibility alias MCPConnection', () => {
      // Test that MCPConnection type alias works
      const createConnection = (connection: MCPConnection): MCPConnection => connection;

      const testConnection: MCPConnection = {
        serverId: 'alias-test-server',
        serverName: 'Alias Test Server',
        config: {
          name: 'alias-test',
          type: 'http',
          url: 'http://localhost:3000',
          autoStart: true,
        },
        state: 'disconnected',
        reconnectAttempts: 0,
      };

      const result = createConnection(testConnection);
      expect(result.serverId).toBe('alias-test-server');
      expect(result.state).toBe('disconnected');

      // Should be assignable to MCPConnectionInfo
      const connectionInfo: MCPConnectionInfo = result;
      expect(connectionInfo.serverId).toBe('alias-test-server');
    });
  });

  describe('MCPConnectionEvent exports', () => {
    it('should export MCPConnectionEventSchema', () => {
      expect(MCPConnectionEventSchema).toBeDefined();
      expect(typeof MCPConnectionEventSchema).toBe('object');
      expect(typeof MCPConnectionEventSchema.parse).toBe('function');
      expect(typeof MCPConnectionEventSchema.safeParse).toBe('function');
    });

    it('should export MCPConnectionEventTypeSchema', () => {
      expect(MCPConnectionEventTypeSchema).toBeDefined();
      expect(typeof MCPConnectionEventTypeSchema).toBe('object');
      expect(typeof MCPConnectionEventTypeSchema.parse).toBe('function');
    });

    it('should have working MCPConnectionEvent type (compile-time verification)', () => {
      const handleEvent = (event: MCPConnectionEvent): string => {
        return `Event: ${event.type} for server ${event.serverName}`;
      };

      const testEvent: MCPConnectionEvent = {
        type: 'connected',
        serverId: 'event-test-server',
        serverName: 'Event Test Server',
        previousState: 'connecting',
        newState: 'connected',
        timestamp: new Date(),
        message: 'Successfully connected',
      };

      const result = handleEvent(testEvent);
      expect(result).toBe('Event: connected for server Event Test Server');
    });

    it('should have working MCPConnectionEventType type', () => {
      const processEventType = (type: MCPConnectionEventType): string => `Processing ${type}`;

      const allEventTypes: MCPConnectionEventType[] = [
        'connected',
        'disconnected',
        'error',
        'reconnecting',
      ];

      allEventTypes.forEach(type => {
        const result = processEventType(type);
        expect(result).toBe(`Processing ${type}`);
      });
    });
  });

  describe('Schema interoperability', () => {
    it('should use consistent types between schema and type definitions', () => {
      // Test connection config
      const configData = {
        maxRetries: 3,
        timeoutMs: 30000,
        poolSize: 2,
        healthCheckIntervalMs: 60000,
      };

      const parsedConfig = MCPConnectionConfigSchema.parse(configData);
      const typedConfig: MCPConnectionConfig = parsedConfig;
      expect(typedConfig.maxRetries).toBe(3);

      // Test connection info
      const infoData = {
        serverId: 'interop-server',
        serverName: 'Interop Test Server',
        config: {
          name: 'interop-test',
          type: 'stdio' as const,
          command: 'node',
          autoStart: false,
          connection: parsedConfig,
        },
        state: 'connected' as const,
        reconnectAttempts: 0,
      };

      const parsedInfo = MCPConnectionInfoSchema.parse(infoData);
      const typedInfo: MCPConnectionInfo = parsedInfo;
      expect(typedInfo.serverId).toBe('interop-server');
      expect(typedInfo.config.connection?.maxRetries).toBe(3);

      // Test connection event
      const eventData = {
        type: 'connected' as const,
        serverId: typedInfo.serverId,
        serverName: typedInfo.serverName,
        previousState: 'connecting' as const,
        newState: 'connected' as const,
        timestamp: new Date(),
      };

      const parsedEvent = MCPConnectionEventSchema.parse(eventData);
      const typedEvent: MCPConnectionEvent = parsedEvent;
      expect(typedEvent.type).toBe('connected');
      expect(typedEvent.serverId).toBe(typedInfo.serverId);
    });

    it('should maintain type safety in function parameters', () => {
      const validateConnectionConfig = (config: MCPConnectionConfig): boolean => {
        return config.maxRetries >= 0 && config.poolSize >= 1;
      };

      const validateConnectionInfo = (info: MCPConnectionInfo): boolean => {
        return info.serverId.length > 0 && info.serverName.length > 0;
      };

      const validateConnectionEvent = (event: MCPConnectionEvent): boolean => {
        return event.serverId.length > 0 && event.timestamp instanceof Date;
      };

      const config = MCPConnectionConfigSchema.parse({
        maxRetries: 5,
        poolSize: 3,
      });

      const info = MCPConnectionInfoSchema.parse({
        serverId: 'validation-server',
        serverName: 'Validation Test Server',
        config: {
          name: 'validation-test',
          type: 'stdio',
          command: 'node',
          autoStart: false,
        },
        state: 'connected',
        reconnectAttempts: 0,
      });

      const event = MCPConnectionEventSchema.parse({
        type: 'connected',
        serverId: info.serverId,
        serverName: info.serverName,
        previousState: 'connecting',
        newState: 'connected',
        timestamp: new Date(),
      });

      // These should compile and work correctly
      expect(validateConnectionConfig(config)).toBe(true);
      expect(validateConnectionInfo(info)).toBe(true);
      expect(validateConnectionEvent(event)).toBe(true);
    });
  });

  describe('Runtime validation', () => {
    it('should provide meaningful error messages for invalid connection config', () => {
      const invalidConfig = {
        maxRetries: -1, // Invalid: negative retries
        timeoutMs: 30000,
        poolSize: 0, // Invalid: zero pool size
      };

      expect(() => MCPConnectionConfigSchema.parse(invalidConfig)).toThrow();

      const result = MCPConnectionConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const hasRetryError = result.error.issues.some(issue =>
          issue.path.includes('maxRetries'));
        const hasPoolSizeError = result.error.issues.some(issue =>
          issue.path.includes('poolSize'));
        expect(hasRetryError || hasPoolSizeError).toBe(true);
      }
    });

    it('should validate connection state enum strictly', () => {
      const invalidState = 'invalid-state';

      expect(() => MCPConnectionStateSchema.parse(invalidState)).toThrow();

      const result = MCPConnectionStateSchema.safeParse(invalidState);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should validate connection info required fields', () => {
      const invalidInfo = {
        serverId: '', // Invalid: empty serverId
        serverName: 'Test Server',
        config: {
          name: 'test',
          type: 'stdio',
          command: 'node',
          autoStart: false,
        },
        state: 'connected',
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidInfo)).toThrow();

      const result = MCPConnectionInfoSchema.safeParse(invalidInfo);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue =>
          issue.path.includes('serverId'))).toBe(true);
      }
    });

    it('should validate connection event types strictly', () => {
      const invalidEvent = {
        type: 'invalid-event-type',
        serverId: 'test-server',
        serverName: 'Test Server',
        previousState: 'connecting',
        newState: 'connected',
        timestamp: new Date(),
      };

      expect(() => MCPConnectionEventSchema.parse(invalidEvent)).toThrow();

      const result = MCPConnectionEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue =>
          issue.path.includes('type'))).toBe(true);
      }
    });

    it('should validate metrics with proper number types', () => {
      const invalidInfo = {
        serverId: 'metrics-test',
        serverName: 'Metrics Test',
        config: {
          name: 'metrics',
          type: 'stdio',
          command: 'node',
          autoStart: false,
        },
        state: 'connected',
        metrics: {
          requestCount: -1, // Invalid: negative count
          errorCount: 2.5, // Invalid: non-integer
          averageResponseTimeMs: 150,
        },
      };

      expect(() => MCPConnectionInfoSchema.parse(invalidInfo)).toThrow();

      const result = MCPConnectionInfoSchema.safeParse(invalidInfo);
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasRequestCountError = result.error.issues.some(issue =>
          issue.path.includes('requestCount'));
        const hasErrorCountError = result.error.issues.some(issue =>
          issue.path.includes('errorCount'));
        expect(hasRequestCountError || hasErrorCountError).toBe(true);
      }
    });
  });

  describe('Default value verification', () => {
    it('should apply correct defaults for MCPConnectionConfig', () => {
      const config = MCPConnectionConfigSchema.parse({});

      // Verify all expected defaults
      expect(config.maxRetries).toBe(3);
      expect(config.timeoutMs).toBe(30000);
      expect(config.connectTimeoutMs).toBe(5000);
      expect(config.readTimeoutMs).toBe(120000);
      expect(config.writeTimeoutMs).toBe(30000);
      expect(config.idleTimeoutMs).toBe(300000);
      expect(config.poolSize).toBe(1);
      expect(config.healthCheckIntervalMs).toBe(30000);
      expect(config.healthCheckTimeoutMs).toBe(5000);
      expect(config.heartbeatEnabled).toBe(true);
      expect(config.heartbeatIntervalMs).toBe(30000);
      expect(config.keepAliveIntervalMs).toBe(15000);
    });

    it('should apply defaults for MCPConnectionInfo', () => {
      const info = MCPConnectionInfoSchema.parse({
        serverId: 'default-test',
        serverName: 'Default Test',
        config: {
          name: 'default',
          type: 'stdio',
          command: 'node',
          autoStart: false,
        },
        state: 'disconnected',
      });

      expect(info.reconnectAttempts).toBe(0);
      expect(info.connectedAt).toBeUndefined();
      expect(info.lastActivityAt).toBeUndefined();
      expect(info.lastError).toBeUndefined();
      expect(info.metrics).toBeUndefined();
    });
  });
});