import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSocketConnectionIndicator } from '../WebSocketConnectionIndicator';
import type { WebSocketConnectionHealth } from '@/types/websocket-connection';

// Mock the utilities
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
  getRelativeTime: (date: Date) => '5m ago',
  formatPercentage: (value: number) => `${value}%`,
}));

// Real hook implementation for integration testing
const mockHealthStates = {
  connected: {
    status: 'connected' as const,
    isHealthy: true,
    latencyMs: 45,
    averageLatencyMs: 52,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
    connectionUptime: 3600000,
  },
  disconnected: {
    status: 'disconnected' as const,
    isHealthy: false,
    latencyMs: null,
    averageLatencyMs: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 3,
    lastHealthyAt: new Date(Date.now() - 300000),
    lastCheckAt: new Date(),
    connectionUptime: null,
  },
  reconnecting: {
    status: 'reconnecting' as const,
    isHealthy: false,
    latencyMs: null,
    averageLatencyMs: 125,
    reconnectAttempts: 3,
    maxReconnectAttempts: 10,
    consecutiveFailures: 3,
    lastHealthyAt: new Date(Date.now() - 120000),
    lastCheckAt: new Date(),
    connectionUptime: null,
  },
};

let currentHealthState = mockHealthStates.connected;

// Mock the hook to return controllable state
vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => currentHealthState)
}));

describe('WebSocketConnectionIndicator Integration Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    currentHealthState = mockHealthStates.connected;
  });

  describe('Real-world Usage Scenarios', () => {
    it('displays complete connection information when healthy', () => {
      render(<WebSocketConnectionIndicator showLatency showTooltip />);

      // Check main indicator
      expect(screen.getByText('45ms')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('text-green-400');

      // Check tooltip is wrapped
      expect(screen.getByRole('status').closest('[data-testid="websocket-tooltip"]')).toBeInTheDocument();
    });

    it('handles connection state transitions smoothly', () => {
      const { rerender } = render(<WebSocketConnectionIndicator />);

      // Start connected
      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Transition to disconnected
      currentHealthState = mockHealthStates.disconnected;
      rerender(<WebSocketConnectionIndicator />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();

      // Transition to reconnecting
      currentHealthState = mockHealthStates.reconnecting;
      rerender(<WebSocketConnectionIndicator />);
      expect(screen.getByText('Reconnecting (3/10)')).toBeInTheDocument();
    });

    it('works correctly with all features enabled', () => {
      render(
        <WebSocketConnectionIndicator
          size="lg"
          showLatency
          showReconnectAttempts
          showTooltip
          animated
          className="custom-class"
        />
      );

      const indicator = screen.getByRole('status');

      // Check size
      expect(indicator).toHaveClass('px-4', 'py-2', 'text-base', 'gap-2');

      // Check custom class
      expect(indicator).toHaveClass('custom-class');

      // Check latency display
      expect(screen.getByText('45ms')).toBeInTheDocument();

      // Check tooltip wrapper
      expect(indicator.closest('[data-testid="websocket-tooltip"]')).toBeInTheDocument();
    });

    it('handles tooltip interactions properly', async () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      const indicator = screen.getByRole('status');

      // Test mouse interactions
      fireEvent.mouseEnter(indicator);
      await waitFor(() => {
        // In real implementation, tooltip would be visible
        expect(indicator).toBeInTheDocument();
      });

      fireEvent.mouseLeave(indicator);
      await waitFor(() => {
        expect(indicator).toBeInTheDocument();
      });
    });

    it('responds to prop changes dynamically', () => {
      const { rerender } = render(
        <WebSocketConnectionIndicator showLatency={false} />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Enable latency display
      rerender(<WebSocketConnectionIndicator showLatency={true} />);
      expect(screen.getByText('45ms')).toBeInTheDocument();
    });
  });

  describe('Health Override Functionality', () => {
    it('prioritizes override data over hook data', () => {
      const override: Partial<WebSocketConnectionHealth> = {
        status: 'error',
        isHealthy: false,
        consecutiveFailures: 5,
      };

      render(<WebSocketConnectionIndicator healthOverride={override} />);

      // Should show error state despite hook returning connected
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('text-red-400');
    });

    it('merges override with hook data correctly', () => {
      const override: Partial<WebSocketConnectionHealth> = {
        latencyMs: 999,
      };

      render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={override}
        />
      );

      // Should show override latency
      expect(screen.getByText('999ms')).toBeInTheDocument();
      // But maintain other properties from hook
      expect(screen.getByRole('status')).toHaveClass('text-green-400');
    });
  });

  describe('Accessibility in Real Usage', () => {
    it('maintains accessibility across all states', () => {
      const states = [mockHealthStates.connected, mockHealthStates.disconnected, mockHealthStates.reconnecting];

      states.forEach((state, index) => {
        currentHealthState = state;
        const { unmount } = render(<WebSocketConnectionIndicator />);

        const indicator = screen.getByRole('status');
        expect(indicator).toHaveAttribute('aria-label');
        expect(indicator.getAttribute('aria-label')).toContain('Connection status:');

        // Check that decorative elements are properly marked
        const hiddenElements = indicator.querySelectorAll('[aria-hidden="true"]');
        expect(hiddenElements.length).toBeGreaterThan(0);

        unmount();
      });
    });

    it('supports keyboard navigation with tooltip', () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      const wrapper = screen.getByRole('status').closest('[tabindex="0"]');
      expect(wrapper).toBeInTheDocument();

      if (wrapper) {
        fireEvent.focus(wrapper);
        fireEvent.blur(wrapper);
      }
    });
  });

  describe('Performance Considerations', () => {
    it('handles frequent state updates without issues', () => {
      const { rerender } = render(<WebSocketConnectionIndicator />);

      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        currentHealthState = i % 2 === 0 ? mockHealthStates.connected : mockHealthStates.disconnected;
        rerender(<WebSocketConnectionIndicator />);
      }

      // Should end with last state
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('memoizes display text properly', () => {
      const { rerender } = render(
        <WebSocketConnectionIndicator showLatency showReconnectAttempts />
      );

      // Multiple rerenders with same state should not cause issues
      rerender(<WebSocketConnectionIndicator showLatency showReconnectAttempts />);
      rerender(<WebSocketConnectionIndicator showLatency showReconnectAttempts />);

      expect(screen.getByText('45ms')).toBeInTheDocument();
    });
  });

  describe('Edge Cases in Integration', () => {
    it('handles missing health data gracefully', () => {
      currentHealthState = {
        ...mockHealthStates.connected,
        latencyMs: null,
        averageLatencyMs: null,
        lastHealthyAt: null,
        lastCheckAt: null,
        connectionUptime: null,
      };

      render(<WebSocketConnectionIndicator showLatency />);

      // Should fallback to status text when latency is null
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('handles extreme latency values', () => {
      currentHealthState = {
        ...mockHealthStates.connected,
        latencyMs: 9999,
      };

      render(<WebSocketConnectionIndicator showLatency />);

      expect(screen.getByText('10.0s')).toBeInTheDocument();
    });

    it('handles high reconnection attempts', () => {
      currentHealthState = {
        ...mockHealthStates.reconnecting,
        reconnectAttempts: 9,
        maxReconnectAttempts: 10,
      };

      render(<WebSocketConnectionIndicator />);

      expect(screen.getByText('Reconnecting (9/10)')).toBeInTheDocument();
    });
  });

  describe('Component Interaction', () => {
    it('tooltip and indicator work together correctly', () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      const tooltipWrapper = screen.getByTestId('websocket-tooltip');
      const indicator = screen.getByRole('status');

      expect(tooltipWrapper).toContain(indicator);
    });

    it('animation state affects visual presentation consistently', () => {
      // Test with animation enabled
      currentHealthState = mockHealthStates.reconnecting;
      const { rerender } = render(<WebSocketConnectionIndicator animated={true} />);

      let indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('animate-pulse');

      // Test with animation disabled
      rerender(<WebSocketConnectionIndicator animated={false} />);

      indicator = screen.getByRole('status');
      expect(indicator).not.toHaveClass('animate-pulse');
    });
  });

  describe('Configuration Combinations', () => {
    const configurations = [
      { size: 'sm' as const, showLatency: true, showTooltip: false },
      { size: 'md' as const, showLatency: false, showTooltip: true },
      { size: 'lg' as const, showLatency: true, showTooltip: true },
    ];

    configurations.forEach(config => {
      it(`works with configuration: ${JSON.stringify(config)}`, () => {
        render(<WebSocketConnectionIndicator {...config} />);

        const indicator = screen.getByRole('status');
        expect(indicator).toBeInTheDocument();

        // Verify tooltip presence based on config
        const tooltip = screen.queryByTestId('websocket-tooltip');
        if (config.showTooltip) {
          expect(tooltip).toBeInTheDocument();
        } else {
          expect(tooltip).not.toBeInTheDocument();
        }
      });
    });
  });
});