import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWebSocketConnection } from '../useWebSocketConnection';
import type { HealthCheckEvent, WebSocketHealthState } from '@/lib/websocket-client';

// Mock the WebSocket client
const mockWsClient = {
  isConnected: vi.fn(() => true),
  getHealthState: vi.fn(() => ({
    isHealthy: true,
    consecutiveFailures: 0,
    averageLatencyMs: 45,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
  })),
  onHealth: vi.fn(),
  offHealth: vi.fn(),
  // Mock reconnector access
  reconnector: {
    getStats: vi.fn(() => ({
      currentAttempt: 0,
      state: 'connected',
    })),
  },
};

vi.mock('@/lib/websocket-client', () => ({
  wsClient: mockWsClient,
}));

describe('useWebSocketConnection Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('returns initial connection health state', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current).toMatchObject({
        status: 'connected',
        isHealthy: true,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
        consecutiveFailures: 0,
      });
    });

    it('handles disconnected initial state', () => {
      mockWsClient.isConnected.mockReturnValueOnce(false);
      mockWsClient.getHealthState.mockReturnValueOnce({
        isHealthy: false,
        consecutiveFailures: 2,
        averageLatencyMs: 0,
      });

      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current.status).toBe('disconnected');
      expect(result.current.isHealthy).toBe(false);
    });
  });

  describe('Health Event Handling', () => {
    it('subscribes to health events on mount', () => {
      renderHook(() => useWebSocketConnection());

      expect(mockWsClient.onHealth).toHaveBeenCalledWith(expect.any(Function));
    });

    it('unsubscribes from health events on unmount', () => {
      const { unmount } = renderHook(() => useWebSocketConnection());

      unmount();

      expect(mockWsClient.offHealth).toHaveBeenCalledWith(expect.any(Function));
    });

    it('updates state when health event is received', () => {
      const healthEvent: HealthCheckEvent = {
        type: 'health:check',
        timestamp: new Date(),
        isHealthy: true,
        latencyMs: 50,
        consecutiveFailures: 0,
      };

      mockWsClient.onHealth.mockImplementation((handler) => {
        handler(healthEvent);
      });

      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current.latencyMs).toBe(50);
    });

    it('handles health state changes correctly', () => {
      let healthHandler: (event: HealthCheckEvent) => void;
      mockWsClient.onHealth.mockImplementation((handler) => {
        healthHandler = handler;
      });

      const { result } = renderHook(() => useWebSocketConnection());

      // Simulate unhealthy state
      act(() => {
        healthHandler({
          type: 'health:unhealthy',
          timestamp: new Date(),
          isHealthy: false,
          consecutiveFailures: 3,
        });
      });

      expect(result.current.isHealthy).toBe(false);
      expect(result.current.consecutiveFailures).toBe(3);
    });
  });

  describe('Polling Mechanism', () => {
    it('sets up polling interval', () => {
      renderHook(() => useWebSocketConnection());

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('clears polling interval on unmount', () => {
      const { unmount } = renderHook(() => useWebSocketConnection());

      unmount();

      expect(clearInterval).toHaveBeenCalled();
    });

    it('polls reconnector stats periodically', () => {
      renderHook(() => useWebSocketConnection());

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockWsClient.isConnected).toHaveBeenCalled();
      expect(mockWsClient.getHealthState).toHaveBeenCalled();
    });
  });

  describe('Reconnection State Tracking', () => {
    it('tracks reconnection attempts', () => {
      (mockWsClient as any).reconnector.getStats.mockReturnValue({
        currentAttempt: 3,
        state: 'reconnecting',
      });

      const { result } = renderHook(() => useWebSocketConnection());

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.reconnectAttempts).toBe(3);
      expect(result.current.status).toBe('reconnecting');
    });

    it('handles missing reconnector gracefully', () => {
      const originalReconnector = (mockWsClient as any).reconnector;
      delete (mockWsClient as any).reconnector;

      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current.reconnectAttempts).toBe(0);

      // Restore for other tests
      (mockWsClient as any).reconnector = originalReconnector;
    });
  });

  describe('Connection Uptime Calculation', () => {
    it('tracks connection uptime when connected', () => {
      mockWsClient.isConnected.mockReturnValue(true);

      const { result } = renderHook(() => useWebSocketConnection());

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.connectionUptime).toBeGreaterThan(0);
    });

    it('resets uptime when disconnected', () => {
      mockWsClient.isConnected
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const { result } = renderHook(() => useWebSocketConnection());

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.connectionUptime).toBeNull();
    });

    it('starts tracking uptime when connection is established', () => {
      mockWsClient.isConnected
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      const { result } = renderHook(() => useWebSocketConnection());

      // First poll - disconnected
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.connectionUptime).toBeNull();

      // Second poll - connected
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.connectionUptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Status Determination', () => {
    const testCases = [
      {
        name: 'connected when healthy and connected',
        connected: true,
        healthy: true,
        reconnecting: false,
        failures: 0,
        expected: 'connected',
      },
      {
        name: 'error when connected but unhealthy',
        connected: true,
        healthy: false,
        reconnecting: false,
        failures: 3,
        expected: 'error',
      },
      {
        name: 'reconnecting when reconnecting state',
        connected: false,
        healthy: false,
        reconnecting: true,
        failures: 2,
        expected: 'reconnecting',
      },
      {
        name: 'connecting when reconnecting while connected',
        connected: true,
        healthy: false,
        reconnecting: true,
        failures: 1,
        expected: 'connecting',
      },
      {
        name: 'disconnected when not connected and no failures',
        connected: false,
        healthy: false,
        reconnecting: false,
        failures: 0,
        expected: 'disconnected',
      },
      {
        name: 'error when not connected with failures',
        connected: false,
        healthy: false,
        reconnecting: false,
        failures: 2,
        expected: 'error',
      },
    ];

    testCases.forEach(({ name, connected, healthy, reconnecting, failures, expected }) => {
      it(`determines ${name}`, () => {
        mockWsClient.isConnected.mockReturnValue(connected);
        mockWsClient.getHealthState.mockReturnValue({
          isHealthy: healthy,
          consecutiveFailures: failures,
          averageLatencyMs: 50,
        });
        (mockWsClient as any).reconnector.getStats.mockReturnValue({
          currentAttempt: reconnecting ? 1 : 0,
          state: reconnecting ? 'reconnecting' : 'idle',
        });

        const { result } = renderHook(() => useWebSocketConnection());

        expect(result.current.status).toBe(expected);
      });
    });
  });

  describe('State Optimization', () => {
    it('only updates state when meaningful changes occur', () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount++;
        return useWebSocketConnection();
      });

      const initialRenderCount = renderCount;

      // Advance timer without changing state
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should not cause additional renders if state hasn't changed
      expect(renderCount).toBe(initialRenderCount);
    });

    it('updates state when connection status changes', () => {
      mockWsClient.isConnected
        .mockReturnValueOnce(true)
        .mockReturnValue(false);

      const { result } = renderHook(() => useWebSocketConnection());

      const initialStatus = result.current.status;

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.status).not.toBe(initialStatus);
    });

    it('updates uptime regularly when connected', () => {
      mockWsClient.isConnected.mockReturnValue(true);

      const { result } = renderHook(() => useWebSocketConnection());

      const initialUptime = result.current.connectionUptime;

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.connectionUptime).toBeGreaterThan(initialUptime || 0);
    });
  });

  describe('Error Handling', () => {
    it('handles errors in reconnector stats gracefully', () => {
      (mockWsClient as any).reconnector.getStats.mockImplementation(() => {
        throw new Error('Reconnector error');
      });

      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current.reconnectAttempts).toBe(0);
    });

    it('continues functioning when health state access fails', () => {
      mockWsClient.getHealthState.mockImplementation(() => {
        throw new Error('Health state error');
      });

      expect(() => {
        renderHook(() => useWebSocketConnection());
      }).not.toThrow();
    });
  });
});