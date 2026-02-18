/**
 * Integration tests for ApexWebSocketClient with ExponentialBackoffReconnector
 *
 * Tests the real-world integration of WebSocket client reconnection logic
 * using the exponential backoff reconnector.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexWebSocketClient } from '../websocket-client.js';

// Mock WebSocket for testing
class MockWebSocket {
  public static CONNECTING = 0;
  public static OPEN = 1;
  public static CLOSING = 2;
  public static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe('ApexWebSocketClient Integration Tests', () => {
  let client: ApexWebSocketClient;
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();

    // Capture console output
    consoleLogs = [];
    consoleErrors = [];
    consoleWarnings = [];

    vi.spyOn(console, 'log').mockImplementation((message) => {
      consoleLogs.push(message);
    });
    vi.spyOn(console, 'error').mockImplementation((message) => {
      consoleErrors.push(message);
    });
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      consoleWarnings.push(message);
    });
  });

  afterEach(() => {
    client?.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('WebSocket URL conversion', () => {
    it('should convert HTTP URLs to WebSocket URLs', () => {
      client = new ApexWebSocketClient('http://localhost:3000');
      expect(client['url']).toBe('ws://localhost:3000/ws');
    });

    it('should convert HTTPS URLs to WebSocket URLs', () => {
      client = new ApexWebSocketClient('https://api.example.com');
      expect(client['url']).toBe('wss://api.example.com/ws');
    });

    it('should handle URLs that already have /ws path', () => {
      client = new ApexWebSocketClient('ws://localhost:3000/ws');
      expect(client['url']).toBe('ws://localhost:3000/ws');
    });

    it('should handle invalid URLs gracefully', () => {
      client = new ApexWebSocketClient('invalid-url');
      expect(client['url']).toContain('/ws');
    });
  });

  describe('Exponential backoff reconnection integration', () => {
    it('should use exponential backoff for reconnection attempts', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 100,
        backoffFactor: 2,
        maxRetries: 3,
        jitterStrategy: 'none', // Remove jitter for predictable testing
      });

      // Connect initially
      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Simulate connection loss
      const ws = client['ws'] as MockWebSocket;
      ws.close(1006, 'Connection lost');

      // Should schedule first reconnection attempt
      expect(consoleLogs).toContain('[APEX WS] Reconnection attempt 1 in 100ms...');

      // Advance time and verify reconnection attempts
      await vi.advanceTimersByTimeAsync(100);
      expect(consoleLogs.filter(log => log.includes('Reconnection attempt 2 in 200ms'))).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(200);
      expect(consoleLogs.filter(log => log.includes('Reconnection attempt 3 in 400ms'))).toHaveLength(1);
    });

    it('should stop reconnecting after max attempts', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 100,
        maxRetries: 2,
        jitterStrategy: 'none',
      });

      // Mock WebSocket constructor to always fail
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            this.onerror?.(new Event('error'));
            this.onclose?.(new CloseEvent('close', { code: 1006, reason: 'Connection failed' }));
          }, 5);
        }
      } as any;

      client.connect();

      // Let all attempts fail
      await vi.advanceTimersByTimeAsync(1000);

      // Should log exhaustion message
      const exhaustionLogs = consoleErrors.filter(log =>
        log.includes('Max reconnection attempts') && log.includes('reached')
      );
      expect(exhaustionLogs.length).toBeGreaterThan(0);

      // Restore WebSocket
      global.WebSocket = originalWebSocket;
    });

    it('should reset reconnection state on successful connection', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 100,
        maxRetries: 5,
        jitterStrategy: 'none',
      });

      // Connect initially
      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Simulate connection loss and one failed reconnection
      let ws = client['ws'] as MockWebSocket;
      ws.close(1006, 'Connection lost');
      await vi.advanceTimersByTimeAsync(100);

      // Simulate successful reconnection
      await vi.advanceTimersByTimeAsync(20);

      // Verify success message
      const successLogs = consoleLogs.filter(log =>
        log.includes('Reconnected after') && log.includes('attempts')
      );
      expect(successLogs.length).toBeGreaterThan(0);

      // Verify reconnection counter reset
      expect(client['reconnectAttempts']).toBe(0);
    });

    it('should handle jitter strategies correctly', async () => {
      const delays: number[] = [];

      // Mock the reconnector to capture delay values
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 1000,
        maxRetries: 3,
        jitterStrategy: 'full',
      });

      // Capture delay values from logs
      const originalLog = console.log;
      vi.mocked(console.log).mockImplementation((message: string) => {
        if (message.includes('Reconnection attempt') && message.includes('in ')) {
          const match = message.match(/in (\d+)ms/);
          if (match) {
            delays.push(parseInt(match[1], 10));
          }
        }
        originalLog(message);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Force multiple reconnection attempts
      const ws = client['ws'] as MockWebSocket;
      ws.close(1006, 'Connection lost');

      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);
      await vi.advanceTimersByTimeAsync(800);

      // With full jitter, delays should vary from base calculations
      expect(delays.length).toBeGreaterThan(0);
      // Full jitter should produce values between 0 and the calculated delay
      // We can't test exact values due to randomness, but we can verify they're reasonable
      delays.forEach(delay => {
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(4000); // Max for third attempt with factor 2
      });
    });
  });

  describe('Event handling during reconnection', () => {
    it('should maintain event handlers across reconnections', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 100,
        maxRetries: 2,
        jitterStrategy: 'none',
      });

      const events: any[] = [];
      client.on('task:updated', (event) => {
        events.push(event);
      });

      // Connect initially
      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Simulate message
      const ws1 = client['ws'] as MockWebSocket;
      const testEvent = {
        type: 'task:updated',
        taskId: 'test-123',
        timestamp: new Date().toISOString(),
      };
      ws1.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify(testEvent)
      }));

      expect(events).toHaveLength(1);

      // Simulate connection loss and reconnection
      ws1.close(1006, 'Connection lost');
      await vi.advanceTimersByTimeAsync(120); // Wait for reconnection

      // Simulate message on new connection
      const ws2 = client['ws'] as MockWebSocket;
      ws2.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({ ...testEvent, taskId: 'test-456' })
      }));

      expect(events).toHaveLength(2);
    });

    it('should handle malformed messages gracefully during reconnection', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      const ws = client['ws'] as MockWebSocket;

      // Send malformed JSON
      ws.onmessage?.(new MessageEvent('message', {
        data: 'invalid json{'
      }));

      // Should log error but not crash
      expect(consoleErrors.some(error =>
        error.includes('Error parsing message')
      )).toBe(true);

      // Should still be connected
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Cleanup and resource management', () => {
    it('should properly clean up reconnector when disconnected', () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      const destroySpy = vi.spyOn(client['reconnector'], 'destroy');

      client.connect();
      client.disconnect();

      // Should not call destroy on reconnector (it's managed internally)
      // But should stop reconnection attempts
      expect(client['shouldReconnect']).toBe(false);

      // Verify no further reconnection attempts are scheduled
      expect(client['reconnectTimer']).toBeNull();
    });

    it('should clear timers when disconnecting', () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 100,
        maxRetries: 3,
      });

      client.connect();

      // Force a reconnection scenario
      const ws = client['ws'] as MockWebSocket;
      ws.close(1006, 'Connection lost');

      // Should have scheduled a reconnection
      expect(client['reconnector'].getStats().currentAttempt).toBe(1);

      // Disconnect should clear everything
      client.disconnect();

      expect(client['reconnectTimer']).toBeNull();
      expect(client['shouldReconnect']).toBe(false);
    });

    it('should handle multiple disconnect calls gracefully', () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      client.connect();
      client.disconnect();
      client.disconnect(); // Should not throw
      client.disconnect(); // Should not throw

      expect(client['ws']).toBeNull();
      expect(client['shouldReconnect']).toBe(false);
    });
  });

  describe('State management integration', () => {
    it('should handle state events correctly', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      const stateEvents: any[] = [];
      client.onState((tasks) => {
        stateEvents.push(tasks);
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      const ws = client['ws'] as MockWebSocket;
      const stateEvent = {
        type: 'task:state',
        tasks: [{ id: 'task-1', status: 'running' }],
      };

      ws.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify(stateEvent)
      }));

      expect(stateEvents).toHaveLength(1);
      expect(stateEvents[0]).toEqual([{ id: 'task-1', status: 'running' }]);
    });

    it('should maintain state handlers across reconnections', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 50,
        maxRetries: 2,
        jitterStrategy: 'none',
      });

      const stateEvents: any[] = [];
      client.onState((tasks) => {
        stateEvents.push(tasks);
      });

      // Initial connection
      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      // Send initial state
      const ws1 = client['ws'] as MockWebSocket;
      ws1.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'task:state',
          tasks: [{ id: 'task-1' }],
        })
      }));

      // Force reconnection
      ws1.close(1006, 'Connection lost');
      await vi.advanceTimersByTimeAsync(70);

      // Send state on new connection
      const ws2 = client['ws'] as MockWebSocket;
      ws2.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'task:state',
          tasks: [{ id: 'task-2' }],
        })
      }));

      expect(stateEvents).toHaveLength(2);
      expect(stateEvents[0]).toEqual([{ id: 'task-1' }]);
      expect(stateEvents[1]).toEqual([{ id: 'task-2' }]);
    });
  });

  describe('Configuration integration', () => {
    it('should use custom reconnection configuration', () => {
      const customConfig = {
        baseDelayMs: 500,
        backoffFactor: 3,
        maxDelayMs: 15000,
        maxRetries: 5,
        jitterStrategy: 'decorrelated' as const,
      };

      client = new ApexWebSocketClient('ws://localhost:3000', customConfig);

      const reconnectorConfig = client['reconnector'].getConfig();
      expect(reconnectorConfig.baseDelayMs).toBe(500);
      expect(reconnectorConfig.backoffFactor).toBe(3);
      expect(reconnectorConfig.maxDelayMs).toBe(15000);
      expect(reconnectorConfig.maxRetries).toBe(5);
      expect(reconnectorConfig.jitterStrategy).toBe('decorrelated');
    });

    it('should fall back to default configuration', () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      const reconnectorConfig = client['reconnector'].getConfig();
      expect(reconnectorConfig.baseDelayMs).toBe(1000);
      expect(reconnectorConfig.backoffFactor).toBe(2);
      expect(reconnectorConfig.maxDelayMs).toBe(30000);
      expect(reconnectorConfig.maxRetries).toBe(10);
      expect(reconnectorConfig.jitterStrategy).toBe('equal');
    });
  });

  describe('Performance under load', () => {
    it('should handle rapid connection state changes', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000', {
        baseDelayMs: 10,
        maxRetries: 50,
        jitterStrategy: 'none',
      });

      const startTime = Date.now();

      // Simulate rapid connection/disconnection cycles
      for (let i = 0; i < 10; i++) {
        client.connect();
        await vi.advanceTimersByTimeAsync(5);

        const ws = client['ws'] as MockWebSocket;
        ws?.close(1006, `Rapid disconnect ${i}`);
        await vi.advanceTimersByTimeAsync(15);
      }

      const endTime = Date.now();

      // Should complete quickly despite multiple cycles
      expect(endTime - startTime).toBeLessThan(1000);

      // Should not have excessive error logs
      expect(consoleErrors.length).toBeLessThan(20);
    });

    it('should handle many event handlers efficiently', async () => {
      client = new ApexWebSocketClient('ws://localhost:3000');

      const handlerResults: number[] = [];

      // Add many event handlers
      for (let i = 0; i < 100; i++) {
        client.on('test:event', () => {
          handlerResults.push(i);
        });
      }

      client.connect();
      await vi.advanceTimersByTimeAsync(20);

      const startTime = Date.now();

      // Send event that triggers all handlers
      const ws = client['ws'] as MockWebSocket;
      ws.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'test:event',
          timestamp: new Date().toISOString(),
        })
      }));

      const endTime = Date.now();

      // All handlers should execute quickly
      expect(endTime - startTime).toBeLessThan(100);
      expect(handlerResults).toHaveLength(100);
    });
  });
});