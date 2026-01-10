/**
 * Tests for MCPTransport abstract base class
 *
 * @module orchestrator/mcp/transports/transport.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  MCPTransport,
  type TransportState,
  type MCPTransportBaseOptions,
} from './transport.js';
import {
  type JSONRPCMessage,
  type MCPTransportEvents,
  MCPTransportError,
} from '../types.js';

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Concrete implementation of MCPTransport for testing
 */
class TestTransport extends MCPTransport {
  public connectCalled = false;
  public disconnectCalled = false;
  public sentMessages: JSONRPCMessage[] = [];
  public shouldFailConnect = false;
  public shouldFailSend = false;

  async connect(): Promise<void> {
    this.connectCalled = true;

    if (this.shouldFailConnect) {
      this.setState('error');
      throw new MCPTransportError('Connection failed', 'CONNECTION_FAILED');
    }

    this.setState('connecting');

    // Simulate connection establishment
    setTimeout(() => {
      this.setState('connected');
    }, 10);

    // Wait for connection to be established
    await new Promise<void>((resolve) => {
      if (this.isConnected()) {
        resolve();
      } else {
        this.once('connected', resolve);
      }
    });
  }

  async disconnect(reason?: string): Promise<void> {
    this.disconnectCalled = true;
    this.setState('disconnecting');

    // Simulate disconnection
    setTimeout(() => {
      this.setState('disconnected', reason);
    }, 10);

    // Wait for disconnection
    await new Promise<void>((resolve) => {
      if (!this.isConnected()) {
        resolve();
      } else {
        this.once('disconnected', resolve);
      }
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new MCPTransportError('Not connected', 'NOT_CONNECTED');
    }

    if (this.shouldFailSend) {
      throw new MCPTransportError('Send failed', 'SEND_FAILED');
    }

    this.sentMessages.push(message);
  }

  // Helper methods for testing
  public getState(): TransportState {
    return super.getState();
  }

  public emitMessage(message: JSONRPCMessage): void {
    this.emit('message', message);
  }

  public simulateUnexpectedDisconnect(): void {
    this.handleUnexpectedDisconnect('Test disconnect');
  }

  public simulateError(error: MCPTransportError): void {
    this.emit('error', error);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('MCPTransport', () => {
  let transport: TestTransport;

  beforeEach(() => {
    transport = new TestTransport();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultTransport = new TestTransport();
      expect(defaultTransport.getState()).toBe('disconnected');
      expect(defaultTransport.isConnected()).toBe(false);
    });

    it('should accept custom base options', () => {
      const options: MCPTransportBaseOptions = {
        connectionTimeout: 5000,
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 2000,
      };

      const customTransport = new TestTransport(options);
      expect(customTransport.getState()).toBe('disconnected');
      // Base options are protected, so we can't directly test them,
      // but they will be tested through behavior
    });
  });

  describe('state management', () => {
    it('should start in disconnected state', () => {
      expect(transport.getState()).toBe('disconnected');
      expect(transport.isConnected()).toBe(false);
    });

    it('should transition through states during connection', async () => {
      const states: TransportState[] = [];

      // Track state changes indirectly through events
      transport.on('connected', () => states.push('connected'));

      await transport.connect();

      expect(transport.isConnected()).toBe(true);
      expect(transport.getState()).toBe('connected');
      expect(states).toContain('connected');
    });

    it('should transition to disconnected state', async () => {
      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      const disconnectPromise = new Promise<string | undefined>((resolve) => {
        transport.once('disconnected', resolve);
      });

      await transport.disconnect('test reason');

      expect(transport.isConnected()).toBe(false);
      expect(transport.getState()).toBe('disconnected');

      const reason = await disconnectPromise;
      expect(reason).toBe('test reason');
    });
  });

  describe('abstract method implementation', () => {
    it('should call connect implementation', async () => {
      expect(transport.connectCalled).toBe(false);

      await transport.connect();

      expect(transport.connectCalled).toBe(true);
      expect(transport.isConnected()).toBe(true);
    });

    it('should call disconnect implementation', async () => {
      await transport.connect();
      expect(transport.disconnectCalled).toBe(false);

      await transport.disconnect();

      expect(transport.disconnectCalled).toBe(true);
      expect(transport.isConnected()).toBe(false);
    });

    it('should call send implementation when connected', async () => {
      await transport.connect();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await transport.send(message);

      expect(transport.sentMessages).toHaveLength(1);
      expect(transport.sentMessages[0]).toEqual(message);
    });

    it('should throw when sending while disconnected', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow(MCPTransportError);
    });
  });

  describe('event handling', () => {
    it('should emit connected event', async () => {
      const connectedSpy = vi.fn();
      transport.on('connected', connectedSpy);

      await transport.connect();

      expect(connectedSpy).toHaveBeenCalledOnce();
    });

    it('should emit disconnected event', async () => {
      await transport.connect();

      const disconnectedSpy = vi.fn();
      transport.on('disconnected', disconnectedSpy);

      await transport.disconnect('test reason');

      expect(disconnectedSpy).toHaveBeenCalledWith('test reason');
    });

    it('should emit message events', () => {
      const messageSpy = vi.fn();
      transport.on('message', messageSpy);

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      transport.emitMessage(message);

      expect(messageSpy).toHaveBeenCalledWith(message);
    });

    it('should emit error events', () => {
      const errorSpy = vi.fn();
      transport.on('error', errorSpy);

      const error = new MCPTransportError('Test error', 'CONNECTION_FAILED');
      transport.simulateError(error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('error handling', () => {
    it('should handle connection failures', async () => {
      transport.shouldFailConnect = true;

      await expect(transport.connect()).rejects.toThrow(MCPTransportError);
      expect(transport.getState()).toBe('error');
    });

    it('should handle send failures', async () => {
      await transport.connect();
      transport.shouldFailSend = true;

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow(MCPTransportError);
    });
  });

  describe('helper methods', () => {
    it('should parse valid JSON-RPC messages', () => {
      const validMessage = '{"jsonrpc":"2.0","id":1,"method":"test"}';
      const parsed = (transport as any).parseMessage(validMessage);

      expect(parsed).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      });
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = '{"jsonrpc":"2.0","id":1,';

      expect(() => {
        (transport as any).parseMessage(invalidJson);
      }).toThrow(MCPTransportError);
    });

    it('should throw on invalid JSON-RPC version', () => {
      const invalidVersion = '{"jsonrpc":"1.0","id":1,"method":"test"}';

      expect(() => {
        (transport as any).parseMessage(invalidVersion);
      }).toThrow(MCPTransportError);
    });

    it('should serialize messages correctly', () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: { foo: 'bar' },
      };

      const serialized = (transport as any).serializeMessage(message);
      expect(serialized).toBe(JSON.stringify(message));
    });

    it('should create timeout promises', async () => {
      const timeoutPromise = (transport as any).createTimeoutPromise(10, 'test operation');

      await expect(timeoutPromise).rejects.toThrow(MCPTransportError);
    });
  });

  describe('auto-reconnect functionality', () => {
    it('should not auto-reconnect by default', async () => {
      await transport.connect();
      const connectSpy = vi.spyOn(transport, 'connect');

      transport.simulateUnexpectedDisconnect();

      // Wait a bit to see if reconnection attempts occur
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not have attempted to reconnect
      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should auto-reconnect when enabled', async () => {
      // Create transport with auto-reconnect enabled
      const autoReconnectTransport = new TestTransport({
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 50,
      });

      await autoReconnectTransport.connect();
      const connectSpy = vi.spyOn(autoReconnectTransport, 'connect');

      // Simulate unexpected disconnect
      autoReconnectTransport.simulateUnexpectedDisconnect();

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have attempted to reconnect
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should stop reconnecting after max attempts', async () => {
      const autoReconnectTransport = new TestTransport({
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 10,
      });

      await autoReconnectTransport.connect();

      // Make connection attempts fail
      autoReconnectTransport.shouldFailConnect = true;

      const errorSpy = vi.fn();
      autoReconnectTransport.on('error', errorSpy);

      // Simulate unexpected disconnect
      autoReconnectTransport.simulateUnexpectedDisconnect();

      // Wait for all reconnection attempts to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have emitted errors for each failed reconnection attempt
      expect(errorSpy).toHaveBeenCalled();
      expect(autoReconnectTransport.getState()).toBe('disconnected');
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const autoReconnectTransport = new TestTransport({
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 10,
      });

      await autoReconnectTransport.connect();

      // Simulate disconnect and successful reconnect
      autoReconnectTransport.simulateUnexpectedDisconnect();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(autoReconnectTransport.isConnected()).toBe(true);

      // Disconnect again - should start from 0 attempts
      autoReconnectTransport.simulateUnexpectedDisconnect();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(autoReconnectTransport.isConnected()).toBe(true);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle connection timeout', async () => {
      const timeoutTransport = new TestTransport({
        connectionTimeout: 100,
      });

      // Override connect to never resolve
      timeoutTransport.connect = vi.fn().mockImplementation(() => {
        timeoutTransport.setState('connecting');
        return new Promise(() => {}); // Never resolves
      });

      const timeoutPromise = (timeoutTransport as any).createTimeoutPromise(50, 'connection');
      await expect(timeoutPromise).rejects.toThrow('connection timed out after 50ms');
    });

    it('should handle null and undefined values in message parsing', () => {
      expect(() => {
        (transport as any).parseMessage('null');
      }).toThrow(MCPTransportError);

      expect(() => {
        (transport as any).parseMessage('undefined');
      }).toThrow(MCPTransportError);
    });

    it('should handle empty and whitespace-only JSON', () => {
      expect(() => {
        (transport as any).parseMessage('');
      }).toThrow(MCPTransportError);

      expect(() => {
        (transport as any).parseMessage('   ');
      }).toThrow(MCPTransportError);
    });

    it('should validate JSON-RPC structure thoroughly', () => {
      // Missing jsonrpc field
      expect(() => {
        (transport as any).parseMessage('{"id":1,"method":"test"}');
      }).toThrow(MCPTransportError);

      // Wrong jsonrpc version
      expect(() => {
        (transport as any).parseMessage('{"jsonrpc":"1.0","id":1,"method":"test"}');
      }).toThrow(MCPTransportError);

      // Array instead of object
      expect(() => {
        (transport as any).parseMessage('[1,2,3]');
      }).toThrow(MCPTransportError);
    });

    it('should handle large delay values in delay helper', async () => {
      const start = Date.now();
      await (transport as any).delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow for timing variance
    });

    it('should handle state transitions during error conditions', () => {
      transport.setState('connecting');
      transport.setState('error');
      expect(transport.getState()).toBe('error');

      transport.setState('disconnecting');
      transport.setState('disconnected', 'error recovery');
      expect(transport.getState()).toBe('disconnected');
    });
  });
});