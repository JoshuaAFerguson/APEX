import { describe, it, expect } from 'vitest';
import {
  MCPConnectionEventTypeSchema,
  MCPConnectionEventType,
  MCPConnectionEventSchema,
  MCPConnectionEvent,
  MCPConnectionStateSchema,
  MCPConnectionState,
} from '../types.js';

/**
 * Comprehensive test suite for MCP Connection Event types and schemas
 * Tests validation, edge cases, and TypeScript type inference for MCP connection event management
 *
 * MCPConnectionEvent represents events that occur during MCP connection lifecycle,
 * providing information about connection state changes and related metadata.
 */
describe('MCP Connection Event Types and Schemas', () => {
  describe('MCPConnectionEventTypeSchema', () => {
    describe('Valid event types', () => {
      it('should accept all valid connection event types', () => {
        const validEventTypes = [
          'connected',
          'disconnected',
          'error',
          'reconnecting',
        ];

        validEventTypes.forEach(eventType => {
          expect(() => MCPConnectionEventTypeSchema.parse(eventType)).not.toThrow();
          const result = MCPConnectionEventTypeSchema.parse(eventType);
          expect(result).toBe(eventType);
        });
      });

      it('should provide proper TypeScript types for event types', () => {
        const eventTypes = MCPConnectionEventTypeSchema.options; // Get the enum values
        expect(eventTypes).toContain('connected');
        expect(eventTypes).toContain('disconnected');
        expect(eventTypes).toContain('error');
        expect(eventTypes).toContain('reconnecting');
        expect(eventTypes).toHaveLength(4);
      });

      it('should handle event type assignment in TypeScript', () => {
        const eventType: MCPConnectionEventType = 'connected';
        expect(eventType).toBe('connected');

        const parsedEventType: MCPConnectionEventType = MCPConnectionEventTypeSchema.parse('error');
        expect(parsedEventType).toBe('error');
      });
    });

    describe('Invalid event types', () => {
      it('should reject invalid connection event types', () => {
        const invalidEventTypes = [
          'connecting', // Valid state but not valid event type
          'pending',
          'failed',
          'stopped',
          'running',
          'started',
          'terminated',
          'initializing',
          'ready',
          'unknown',
          '',
          null,
          undefined,
          123,
          {},
          [],
          true,
          false,
        ];

        invalidEventTypes.forEach(eventType => {
          expect(() => MCPConnectionEventTypeSchema.parse(eventType)).toThrow();
        });
      });
    });
  });

  describe('MCPConnectionEventSchema', () => {
    describe('Valid event configurations', () => {
      it('should accept minimal required event configuration', () => {
        const minimalEvent = {
          type: 'connected' as const,
          serverId: 'test-server-id',
          serverName: 'Test Server',
          previousState: 'connecting' as const,
          newState: 'connected' as const,
          timestamp: new Date(),
        };

        const result = MCPConnectionEventSchema.parse(minimalEvent);

        expect(result.type).toBe('connected');
        expect(result.serverId).toBe('test-server-id');
        expect(result.serverName).toBe('Test Server');
        expect(result.previousState).toBe('connecting');
        expect(result.newState).toBe('connected');
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.message).toBeUndefined();
        expect(result.error).toBeUndefined();
      });

      it('should accept complete event configuration with all fields', () => {
        const now = new Date();
        const fullEvent = {
          type: 'error' as const,
          serverId: 'full-server-id',
          serverName: 'Full Test Server',
          previousState: 'connected' as const,
          newState: 'error' as const,
          timestamp: now,
          message: 'Connection lost due to network timeout',
          error: new Error('Network timeout after 30 seconds'),
        };

        const result = MCPConnectionEventSchema.parse(fullEvent);

        expect(result.type).toBe('error');
        expect(result.serverId).toBe('full-server-id');
        expect(result.serverName).toBe('Full Test Server');
        expect(result.previousState).toBe('connected');
        expect(result.newState).toBe('error');
        expect(result.timestamp).toEqual(now);
        expect(result.message).toBe('Connection lost due to network timeout');
        expect(result.error).toBeInstanceOf(Error);
      });

      it('should handle all valid event type scenarios', () => {
        const eventScenarios = [
          {
            type: 'connected' as const,
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            message: 'Successfully connected to MCP server',
          },
          {
            type: 'disconnected' as const,
            previousState: 'connected' as const,
            newState: 'disconnected' as const,
            message: 'Gracefully disconnected from MCP server',
          },
          {
            type: 'error' as const,
            previousState: 'connected' as const,
            newState: 'error' as const,
            message: 'Connection error occurred',
            error: new Error('Connection refused'),
          },
          {
            type: 'reconnecting' as const,
            previousState: 'error' as const,
            newState: 'reconnecting' as const,
            message: 'Attempting to reconnect to MCP server',
          },
        ];

        eventScenarios.forEach((scenario, index) => {
          const event = {
            type: scenario.type,
            serverId: `scenario-server-${index}`,
            serverName: `Scenario Server ${index}`,
            previousState: scenario.previousState,
            newState: scenario.newState,
            timestamp: new Date(),
            message: scenario.message,
            error: scenario.error,
          };

          expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
          const result = MCPConnectionEventSchema.parse(event);
          expect(result.type).toBe(scenario.type);
          expect(result.message).toBe(scenario.message);
          if (scenario.error) {
            expect(result.error).toBeDefined();
          }
        });
      });

      it('should handle all valid connection state transitions', () => {
        const validStates: MCPConnectionState[] = [
          'disconnected',
          'connecting',
          'connected',
          'reconnecting',
          'error',
        ];

        validStates.forEach(previousState => {
          validStates.forEach(newState => {
            const event = {
              type: 'connected' as const, // Use a valid event type
              serverId: 'transition-test-server',
              serverName: 'Transition Test Server',
              previousState,
              newState,
              timestamp: new Date(),
            };

            expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
            const result = MCPConnectionEventSchema.parse(event);
            expect(result.previousState).toBe(previousState);
            expect(result.newState).toBe(newState);
          });
        });
      });

      it('should handle various message formats', () => {
        const messageFormats = [
          'Simple message',
          'Message with numbers: 123 and special chars: !@#$%',
          'Very long message that provides detailed information about what happened during the connection event and includes multiple sentences with lots of context.',
          'Message with Unicode: тест 서버 测试 🚀',
          'Message with\nmultiline\ncontent',
          '',
        ];

        messageFormats.forEach(message => {
          const event = {
            type: 'connected' as const,
            serverId: 'message-test-server',
            serverName: 'Message Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp: new Date(),
            message,
          };

          expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
          const result = MCPConnectionEventSchema.parse(event);
          expect(result.message).toBe(message);
        });
      });

      it('should handle various error objects', () => {
        const errorObjects = [
          new Error('Simple error'),
          new TypeError('Type error occurred'),
          new RangeError('Value out of range'),
          new Error('Error with long message that describes the problem in detail'),
          { name: 'CustomError', message: 'Custom error object' },
          { code: 'ECONN', message: 'Connection error', details: { port: 3000 } },
          'String error message',
          123,
          { nested: { error: 'deeply nested error info' } },
          null,
        ];

        errorObjects.forEach(error => {
          const event = {
            type: 'error' as const,
            serverId: 'error-test-server',
            serverName: 'Error Test Server',
            previousState: 'connected' as const,
            newState: 'error' as const,
            timestamp: new Date(),
            error,
          };

          expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
          const result = MCPConnectionEventSchema.parse(event);
          expect(result.error).toBe(error); // Error field accepts any type
        });
      });

      it('should handle various timestamp formats', () => {
        const timestamps = [
          new Date(),
          new Date('2024-01-01T00:00:00Z'),
          new Date('2024-12-31T23:59:59.999Z'),
          new Date(0), // Unix epoch
          new Date('1970-01-01T00:00:00Z'),
        ];

        timestamps.forEach(timestamp => {
          const event = {
            type: 'connected' as const,
            serverId: 'timestamp-test-server',
            serverName: 'Timestamp Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp,
          };

          expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
          const result = MCPConnectionEventSchema.parse(event);
          expect(result.timestamp).toEqual(timestamp);
        });
      });
    });

    describe('Validation errors', () => {
      it('should reject invalid event types', () => {
        const invalidTypes = [
          'connecting', // Valid state but invalid event type
          'invalid',
          '',
          123,
          {},
          [],
          null,
          undefined,
          true,
          false,
        ];

        invalidTypes.forEach(type => {
          const event = {
            type,
            serverId: 'test-server',
            serverName: 'Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp: new Date(),
          };

          expect(() => MCPConnectionEventSchema.parse(event)).toThrow();
        });
      });

      it('should reject empty or invalid serverId', () => {
        const invalidServerIds = [
          '',
          '   ',
          '\t',
          '\n',
          null,
          undefined,
          123,
          {},
          [],
          true,
          false,
        ];

        invalidServerIds.forEach(serverId => {
          const event = {
            type: 'connected' as const,
            serverId,
            serverName: 'Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp: new Date(),
          };

          expect(() => MCPConnectionEventSchema.parse(event)).toThrow();
        });
      });

      it('should reject empty or invalid serverName', () => {
        const invalidServerNames = [
          '',
          '   ',
          '\t',
          '\n',
          null,
          undefined,
          123,
          {},
          [],
          true,
          false,
        ];

        invalidServerNames.forEach(serverName => {
          const event = {
            type: 'connected' as const,
            serverId: 'test-server',
            serverName,
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp: new Date(),
          };

          expect(() => MCPConnectionEventSchema.parse(event)).toThrow();
        });
      });

      it('should reject invalid connection states', () => {
        const invalidStates = [
          'invalid',
          'pending',
          'failed',
          '',
          123,
          {},
          [],
          null,
          undefined,
          true,
          false,
        ];

        invalidStates.forEach(state => {
          // Test invalid previousState
          const eventWithInvalidPreviousState = {
            type: 'connected' as const,
            serverId: 'test-server',
            serverName: 'Test Server',
            previousState: state,
            newState: 'connected' as const,
            timestamp: new Date(),
          };
          expect(() => MCPConnectionEventSchema.parse(eventWithInvalidPreviousState)).toThrow();

          // Test invalid newState
          const eventWithInvalidNewState = {
            type: 'connected' as const,
            serverId: 'test-server',
            serverName: 'Test Server',
            previousState: 'connecting' as const,
            newState: state,
            timestamp: new Date(),
          };
          expect(() => MCPConnectionEventSchema.parse(eventWithInvalidNewState)).toThrow();
        });
      });

      it('should reject invalid timestamp values', () => {
        const invalidTimestamps = [
          'invalid-date',
          '2024-01-01', // String date
          123456789, // Number timestamp
          {},
          [],
          null,
          undefined,
          true,
          false,
          'now',
        ];

        invalidTimestamps.forEach(timestamp => {
          const event = {
            type: 'connected' as const,
            serverId: 'test-server',
            serverName: 'Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp,
          };

          expect(() => MCPConnectionEventSchema.parse(event)).toThrow();
        });
      });

      it('should reject non-string message values', () => {
        const invalidMessages = [
          123,
          {},
          [],
          null, // null is allowed (optional field)
          true,
          false,
        ];

        invalidMessages.forEach(message => {
          const event = {
            type: 'connected' as const,
            serverId: 'test-server',
            serverName: 'Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp: new Date(),
            message,
          };

          if (message !== null) { // null is allowed for optional fields
            expect(() => MCPConnectionEventSchema.parse(event)).toThrow();
          }
        });
      });

      it('should reject missing required fields', () => {
        const requiredFields = ['type', 'serverId', 'serverName', 'previousState', 'newState', 'timestamp'];

        requiredFields.forEach(fieldToOmit => {
          const completeEvent = {
            type: 'connected' as const,
            serverId: 'test-server',
            serverName: 'Test Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp: new Date(),
          };

          delete completeEvent[fieldToOmit as keyof typeof completeEvent];

          expect(() => MCPConnectionEventSchema.parse(completeEvent)).toThrow();
        });
      });
    });

    describe('TypeScript type inference', () => {
      it('should provide correct TypeScript types', () => {
        const event = MCPConnectionEventSchema.parse({
          type: 'error',
          serverId: 'type-test-server',
          serverName: 'Type Test Server',
          previousState: 'connected',
          newState: 'error',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          message: 'Test error message',
          error: new Error('Test error'),
        });

        // Type assertions to ensure TypeScript compilation
        const type: MCPConnectionEventType = event.type;
        const serverId: string = event.serverId;
        const serverName: string = event.serverName;
        const previousState: MCPConnectionState = event.previousState;
        const newState: MCPConnectionState = event.newState;
        const timestamp: Date = event.timestamp;
        const message: string | undefined = event.message;
        const error: any = event.error;

        expect(typeof type).toBe('string');
        expect(typeof serverId).toBe('string');
        expect(typeof serverName).toBe('string');
        expect(typeof previousState).toBe('string');
        expect(typeof newState).toBe('string');
        expect(timestamp).toBeInstanceOf(Date);
        expect(typeof message).toBe('string');
        expect(error).toBeInstanceOf(Error);

        expect(type).toBe('error');
        expect(serverId).toBe('type-test-server');
        expect(serverName).toBe('Type Test Server');
        expect(previousState).toBe('connected');
        expect(newState).toBe('error');
        expect(message).toBe('Test error message');
      });

      it('should handle optional fields correctly in TypeScript', () => {
        const event: MCPConnectionEvent = {
          type: 'connected',
          serverId: 'optional-test-server',
          serverName: 'Optional Test Server',
          previousState: 'connecting',
          newState: 'connected',
          timestamp: new Date(),
        };

        expect(event.type).toBe('connected');
        expect(event.serverId).toBe('optional-test-server');
        expect(event.message).toBeUndefined();
        expect(event.error).toBeUndefined();
      });
    });

    describe('Real-world event scenarios', () => {
      it('should handle successful connection event', () => {
        const connectionEvent = {
          type: 'connected' as const,
          serverId: 'filesystem-server',
          serverName: 'Filesystem MCP Server',
          previousState: 'connecting' as const,
          newState: 'connected' as const,
          timestamp: new Date(),
          message: 'Successfully established connection to filesystem MCP server',
        };

        const result = MCPConnectionEventSchema.parse(connectionEvent);

        expect(result.type).toBe('connected');
        expect(result.serverId).toBe('filesystem-server');
        expect(result.message).toContain('Successfully established');
      });

      it('should handle graceful disconnection event', () => {
        const disconnectionEvent = {
          type: 'disconnected' as const,
          serverId: 'api-server',
          serverName: 'API MCP Server',
          previousState: 'connected' as const,
          newState: 'disconnected' as const,
          timestamp: new Date(),
          message: 'Client requested graceful shutdown of MCP connection',
        };

        const result = MCPConnectionEventSchema.parse(disconnectionEvent);

        expect(result.type).toBe('disconnected');
        expect(result.previousState).toBe('connected');
        expect(result.newState).toBe('disconnected');
        expect(result.message).toContain('graceful shutdown');
      });

      it('should handle network error event', () => {
        const errorEvent = {
          type: 'error' as const,
          serverId: 'remote-server',
          serverName: 'Remote MCP Server',
          previousState: 'connected' as const,
          newState: 'error' as const,
          timestamp: new Date(),
          message: 'Connection lost due to network timeout',
          error: {
            name: 'NetworkError',
            message: 'ETIMEDOUT: Connection timed out after 30 seconds',
            code: 'ETIMEDOUT',
            timeout: 30000,
          },
        };

        const result = MCPConnectionEventSchema.parse(errorEvent);

        expect(result.type).toBe('error');
        expect(result.error).toBeDefined();
        expect(result.error.code).toBe('ETIMEDOUT');
        expect(result.message).toContain('network timeout');
      });

      it('should handle reconnection attempt event', () => {
        const reconnectEvent = {
          type: 'reconnecting' as const,
          serverId: 'unstable-server',
          serverName: 'Unstable MCP Server',
          previousState: 'error' as const,
          newState: 'reconnecting' as const,
          timestamp: new Date(),
          message: 'Attempting automatic reconnection after connection failure (attempt 3/5)',
        };

        const result = MCPConnectionEventSchema.parse(reconnectEvent);

        expect(result.type).toBe('reconnecting');
        expect(result.previousState).toBe('error');
        expect(result.newState).toBe('reconnecting');
        expect(result.message).toContain('attempt 3/5');
      });

      it('should handle authentication error event', () => {
        const authErrorEvent = {
          type: 'error' as const,
          serverId: 'secure-api-server',
          serverName: 'Secure API MCP Server',
          previousState: 'connecting' as const,
          newState: 'error' as const,
          timestamp: new Date(),
          message: 'Authentication failed: Invalid API token',
          error: {
            name: 'AuthenticationError',
            message: 'The provided API token is invalid or has expired',
            status: 401,
            tokenStatus: 'expired',
          },
        };

        const result = MCPConnectionEventSchema.parse(authErrorEvent);

        expect(result.type).toBe('error');
        expect(result.message).toContain('Authentication failed');
        expect(result.error.status).toBe(401);
      });
    });

    describe('Edge cases and boundary conditions', () => {
      it('should handle very long server identifiers and names', () => {
        const longServerId = 'very-long-server-identifier-'.repeat(20).slice(0, -1);
        const longServerName = 'Very Long Server Name '.repeat(30).trimEnd();

        const event = {
          type: 'connected' as const,
          serverId: longServerId,
          serverName: longServerName,
          previousState: 'connecting' as const,
          newState: 'connected' as const,
          timestamp: new Date(),
        };

        const result = MCPConnectionEventSchema.parse(event);
        expect(result.serverId).toBe(longServerId);
        expect(result.serverName).toBe(longServerName);
      });

      it('should handle special characters in server identifiers', () => {
        const specialCharsEvent = {
          type: 'connected' as const,
          serverId: 'server-with-special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?',
          serverName: 'Server Name with Special Chars тест 서버 测试 🚀',
          previousState: 'connecting' as const,
          newState: 'connected' as const,
          timestamp: new Date(),
          message: 'Message with special characters: !@#$%^&*() and Unicode: тест 🚀',
        };

        const result = MCPConnectionEventSchema.parse(specialCharsEvent);
        expect(result.serverId).toContain('!@#$%^&*()');
        expect(result.serverName).toContain('тест 서버 测试 🚀');
        expect(result.message).toContain('тест 🚀');
      });

      it('should handle edge date values', () => {
        const edgeDates = [
          new Date(0), // Unix epoch
          new Date('1970-01-01T00:00:00Z'),
          new Date('2038-01-19T03:14:07Z'), // Y2038 boundary
          new Date('9999-12-31T23:59:59Z'), // Far future
        ];

        edgeDates.forEach(timestamp => {
          const event = {
            type: 'connected' as const,
            serverId: 'edge-date-server',
            serverName: 'Edge Date Server',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
            timestamp,
          };

          const result = MCPConnectionEventSchema.parse(event);
          expect(result.timestamp).toEqual(timestamp);
        });
      });

      it('should handle complex error objects', () => {
        const complexError = {
          name: 'ComplexError',
          message: 'A complex error occurred',
          stack: 'Error: A complex error occurred\\n    at function1 (file.js:10:5)\\n    at function2 (file.js:20:10)',
          code: 'COMPLEX_ERROR',
          details: {
            request: { url: 'https://api.example.com', method: 'POST' },
            response: { status: 500, body: 'Internal Server Error' },
            metadata: { timestamp: new Date().toISOString(), correlationId: 'abc-123' },
          },
          nested: {
            innerError: {
              type: 'NetworkError',
              cause: 'Connection timeout',
            },
          },
        };

        const event = {
          type: 'error' as const,
          serverId: 'complex-error-server',
          serverName: 'Complex Error Server',
          previousState: 'connected' as const,
          newState: 'error' as const,
          timestamp: new Date(),
          message: 'A complex error occurred with nested details',
          error: complexError,
        };

        const result = MCPConnectionEventSchema.parse(event);
        expect(result.error).toEqual(complexError);
        expect(result.error.details.request.url).toBe('https://api.example.com');
      });

      it('should handle rapid state transitions', () => {
        const states: MCPConnectionState[] = ['disconnected', 'connecting', 'connected', 'error', 'reconnecting', 'connected'];

        for (let i = 1; i < states.length; i++) {
          const event = {
            type: 'connected' as const,
            serverId: 'rapid-transition-server',
            serverName: 'Rapid Transition Server',
            previousState: states[i - 1],
            newState: states[i],
            timestamp: new Date(Date.now() + i * 100), // Stagger timestamps
            message: `Transition ${i}: ${states[i - 1]} -> ${states[i]}`,
          };

          expect(() => MCPConnectionEventSchema.parse(event)).not.toThrow();
          const result = MCPConnectionEventSchema.parse(event);
          expect(result.previousState).toBe(states[i - 1]);
          expect(result.newState).toBe(states[i]);
        }
      });
    });

    describe('Integration with connection management', () => {
      it('should work with connection state tracking', () => {
        const connectionStates: MCPConnectionState[] = [
          'disconnected',
          'connecting',
          'connected',
          'error',
          'reconnecting',
          'connected',
        ];

        const events = connectionStates.slice(1).map((newState, index) => {
          const previousState = connectionStates[index];
          return MCPConnectionEventSchema.parse({
            type: newState === 'connected' ? 'connected' :
                  newState === 'disconnected' ? 'disconnected' :
                  newState === 'reconnecting' ? 'reconnecting' : 'error',
            serverId: 'tracking-server',
            serverName: 'State Tracking Server',
            previousState,
            newState,
            timestamp: new Date(Date.now() + index * 1000),
            message: `State changed from ${previousState} to ${newState}`,
          });
        });

        expect(events).toHaveLength(5);
        expect(events[0].previousState).toBe('disconnected');
        expect(events[0].newState).toBe('connecting');
        expect(events[4].previousState).toBe('reconnecting');
        expect(events[4].newState).toBe('connected');
      });

      it('should maintain consistency across event streams', () => {
        const eventStream = [
          {
            type: 'connected' as const,
            message: 'Initial connection established',
            previousState: 'connecting' as const,
            newState: 'connected' as const,
          },
          {
            type: 'error' as const,
            message: 'Network error occurred',
            previousState: 'connected' as const,
            newState: 'error' as const,
            error: new Error('Network timeout'),
          },
          {
            type: 'reconnecting' as const,
            message: 'Attempting to reconnect',
            previousState: 'error' as const,
            newState: 'reconnecting' as const,
          },
          {
            type: 'connected' as const,
            message: 'Reconnection successful',
            previousState: 'reconnecting' as const,
            newState: 'connected' as const,
          },
        ];

        const parsedEvents = eventStream.map((eventData, index) =>
          MCPConnectionEventSchema.parse({
            type: eventData.type,
            serverId: 'stream-server',
            serverName: 'Stream Test Server',
            previousState: eventData.previousState,
            newState: eventData.newState,
            timestamp: new Date(Date.now() + index * 1000),
            message: eventData.message,
            error: eventData.error,
          })
        );

        expect(parsedEvents).toHaveLength(4);

        // Verify state transition continuity
        for (let i = 1; i < parsedEvents.length; i++) {
          expect(parsedEvents[i].previousState).toBe(parsedEvents[i - 1].newState);
        }
      });
    });
  });
});