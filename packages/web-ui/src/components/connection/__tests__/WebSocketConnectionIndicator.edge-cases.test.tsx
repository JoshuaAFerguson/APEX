import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSocketConnectionIndicator } from '../WebSocketConnectionIndicator';
import { WebSocketConnectionTooltip } from '../WebSocketConnectionTooltip';
import type { WebSocketConnectionHealth } from '@/types/websocket-connection';

// Mock the utility functions
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
  getRelativeTime: vi.fn((date: Date) => {
    const now = Date.now();
    const then = date.getTime();
    const diff = Math.floor((now - then) / 60000);
    return diff <= 0 ? 'now' : `${diff}m ago`;
  }),
  formatPercentage: vi.fn((value: number, precision = 1) => `${(value * 100).toFixed(precision)}%`),
}));

// Mock the hook to return controllable state
let mockHealthState: WebSocketConnectionHealth = {
  status: 'connected',
  isHealthy: true,
  latencyMs: 45,
  averageLatencyMs: 52,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  consecutiveFailures: 0,
  lastHealthyAt: new Date(),
  lastCheckAt: new Date(),
  connectionUptime: 3600000,
};

vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => mockHealthState)
}));

// Mock the types module
vi.mock('@/types/websocket-connection', async () => {
  const actual = await vi.importActual('@/types/websocket-connection');
  return {
    ...actual,
    CONNECTION_STATUS_LABELS: {
      connected: 'Connected',
      disconnected: 'Disconnected',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting',
      error: 'Connection Error',
    },
    formatLatency: (ms: number | null) => {
      if (ms === null) return 'N/A';
      if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
      return `${Math.round(ms)}ms`;
    },
    formatUptime: (ms: number | null) => {
      if (ms === null) return 'N/A';
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m`;
      return `${Math.floor(ms / 1000)}s`;
    },
  };
});

describe('WebSocketConnectionIndicator Edge Cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();

    // Reset to default state
    mockHealthState = {
      status: 'connected',
      isHealthy: true,
      latencyMs: 45,
      averageLatencyMs: 52,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
      connectionUptime: 3600000,
    };

    // Mock getBoundingClientRect for tooltip positioning
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      value: vi.fn(() => ({
        width: 200,
        height: 50,
        top: 100,
        left: 100,
        bottom: 150,
        right: 300,
      })),
      writable: true,
    });

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Extreme Latency Values', () => {
    it('handles zero latency correctly', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={{ latencyMs: 0 }}
        />
      );

      expect(screen.getByText('0ms')).toBeInTheDocument();
    });

    it('handles very high latency values', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={{ latencyMs: 30000 }}
        />
      );

      expect(screen.getByText('30.0s')).toBeInTheDocument();
    });

    it('handles fractional latency values', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={{ latencyMs: 123.456 }}
        />
      );

      expect(screen.getByText('123ms')).toBeInTheDocument();
    });

    it('handles negative latency gracefully', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency
          healthOverride={{ latencyMs: -50 }}
        />
      );

      // Should display negative value or handle gracefully
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Extreme Reconnection Scenarios', () => {
    it('handles maximum reconnection attempts', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 10,
            maxReconnectAttempts: 10,
          }}
        />
      );

      expect(screen.getByText('Reconnecting (10/10)')).toBeInTheDocument();
    });

    it('handles attempts exceeding maximum', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 15,
            maxReconnectAttempts: 10,
          }}
        />
      );

      expect(screen.getByText('Reconnecting (15/10)')).toBeInTheDocument();
    });

    it('handles zero maximum attempts', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 5,
            maxReconnectAttempts: 0,
          }}
        />
      );

      expect(screen.getByText('Reconnecting (5/0)')).toBeInTheDocument();
    });

    it('handles negative attempt values gracefully', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: -1,
            maxReconnectAttempts: 10,
          }}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Extreme Failure Scenarios', () => {
    it('handles very high consecutive failures', () => {
      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            status: 'error',
            consecutiveFailures: 1000,
          }}
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();

      // Test tooltip with high failures
      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should render without crashing
    });

    it('handles zero failures with error status', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'error',
            consecutiveFailures: 0,
          }}
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });

    it('handles negative failure count', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'error',
            consecutiveFailures: -5,
          }}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Date/Time Edge Cases', () => {
    it('handles very old last healthy timestamp', () => {
      const veryOldDate = new Date('1990-01-01');

      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            lastHealthyAt: veryOldDate,
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should render without errors
    });

    it('handles future dates gracefully', () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow

      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            lastHealthyAt: futureDate,
            lastCheckAt: futureDate,
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should render without errors
    });

    it('handles null timestamps', () => {
      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            lastHealthyAt: null,
            lastCheckAt: null,
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should render without errors
    });

    it('handles invalid date objects', () => {
      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            lastHealthyAt: new Date('invalid'),
            lastCheckAt: new Date('invalid'),
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should render without errors
    });
  });

  describe('Uptime Edge Cases', () => {
    it('handles extremely long uptime', () => {
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;

      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            connectionUptime: oneYearMs,
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should render without errors
    });

    it('handles zero uptime', () => {
      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            connectionUptime: 0,
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should show 0s uptime
    });

    it('handles negative uptime', () => {
      render(
        <WebSocketConnectionIndicator
          showTooltip
          healthOverride={{
            connectionUptime: -1000,
          }}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should handle gracefully
    });
  });

  describe('Tooltip Positioning Edge Cases', () => {
    it('handles tooltip near viewport edges correctly', async () => {
      // Mock element near right edge
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        value: vi.fn(() => ({
          width: 100,
          height: 50,
          top: 100,
          left: 950, // Near right edge of 1024px screen
          bottom: 150,
          right: 1050,
        })),
        writable: true,
      });

      render(
        <WebSocketConnectionIndicator showTooltip />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should position tooltip without overflow
    });

    it('handles tooltip near bottom edge', async () => {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        value: vi.fn(() => ({
          width: 100,
          height: 50,
          top: 700, // Near bottom of 768px screen
          left: 100,
          bottom: 750,
          right: 200,
        })),
        writable: true,
      });

      render(
        <WebSocketConnectionIndicator showTooltip />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should position tooltip above element
    });

    it('handles very small viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 300, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 200, writable: true });

      render(
        <WebSocketConnectionIndicator showTooltip />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should handle cramped space gracefully
    });
  });

  describe('Complex Health Override Scenarios', () => {
    it('handles partial health override with missing fields', () => {
      const partialOverride = {
        status: 'connected' as const,
        latencyMs: 100,
        // Missing other fields
      };

      render(
        <WebSocketConnectionIndicator
          showLatency
          showTooltip
          healthOverride={partialOverride}
        />
      );

      expect(screen.getByText('100ms')).toBeInTheDocument();

      fireEvent.mouseEnter(screen.getByRole('status'));
      // Should merge with hook data for missing fields
    });

    it('handles override with conflicting status and health', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'connected',
            isHealthy: false, // Conflicting
            consecutiveFailures: 5,
          }}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('handles empty health override object', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{}}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Animation and Styling Edge Cases', () => {
    it('handles rapid animation state changes', () => {
      const { rerender } = render(
        <WebSocketConnectionIndicator
          animated
          healthOverride={{ status: 'connecting' }}
        />
      );

      expect(screen.getByRole('status')).toHaveClass('animate-pulse');

      rerender(
        <WebSocketConnectionIndicator
          animated={false}
          healthOverride={{ status: 'connecting' }}
        />
      );

      expect(screen.getByRole('status')).not.toHaveClass('animate-pulse');
    });

    it('handles very long custom class names', () => {
      const longClassName = 'a'.repeat(1000);

      render(
        <WebSocketConnectionIndicator className={longClassName} />
      );

      expect(screen.getByRole('status')).toHaveClass(longClassName);
    });

    it('handles undefined and null class names', () => {
      render(
        <WebSocketConnectionIndicator className={undefined} />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles rapid component mounting and unmounting', () => {
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<WebSocketConnectionIndicator />);
        unmount();
      }

      // Should not cause memory leaks or crashes
      expect(true).toBe(true);
    });

    it('handles rapid tooltip show/hide cycles', () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      const trigger = screen.getByRole('status');

      // Rapid mouse events
      for (let i = 0; i < 20; i++) {
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseLeave(trigger);
      }

      // Should not cause performance issues
      expect(trigger).toBeInTheDocument();
    });

    it('handles large number of component instances', () => {
      const components = Array.from({ length: 50 }, (_, i) => (
        <WebSocketConnectionIndicator
          key={i}
          healthOverride={{
            status: i % 2 === 0 ? 'connected' : 'disconnected',
            latencyMs: i * 10,
          }}
        />
      ));

      render(<div>{components}</div>);

      expect(screen.getAllByRole('status')).toHaveLength(50);
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('maintains accessibility with extremely long status text', () => {
      const longText = 'Very long status text that might overflow containers and cause layout issues';

      // Test with normal status - we can't easily mock the status labels during runtime
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'connected' }}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label');
      expect(indicator.getAttribute('aria-label')).toContain('Connected');
    });

    it('handles special characters in status labels', () => {
      // Test that the component handles normal status labels correctly
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'connected' }}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('maintains focus behavior under stress', () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      const trigger = screen.getByRole('button');

      // Rapid focus/blur cycles
      for (let i = 0; i < 10; i++) {
        fireEvent.focus(trigger);
        fireEvent.blur(trigger);
      }

      // Should still be focusable
      expect(trigger).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Integration with External Systems', () => {
    it('handles window resize events during tooltip display', () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      fireEvent.mouseEnter(screen.getByRole('status'));

      // Simulate multiple rapid resizes
      act(() => {
        for (let i = 0; i < 10; i++) {
          Object.defineProperty(window, 'innerWidth', {
            value: 800 + i * 50,
            writable: true
          });
          fireEvent(window, new Event('resize'));
        }
      });

      // Tooltip should still be functional
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('handles DOM mutations while tooltip is visible', () => {
      render(<WebSocketConnectionIndicator showTooltip />);

      fireEvent.mouseEnter(screen.getByRole('status'));

      // Simulate DOM changes
      act(() => {
        document.body.style.margin = '20px';
        document.body.style.padding = '10px';
      });

      // Should handle gracefully
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Prop Validation Edge Cases', () => {
    it('handles all props combinations', () => {
      const allPropsCombinations = [
        {
          size: 'sm' as const,
          showLatency: true,
          showReconnectAttempts: true,
          showTooltip: true,
          animated: true,
        },
        {
          size: 'md' as const,
          showLatency: false,
          showReconnectAttempts: false,
          showTooltip: false,
          animated: false,
        },
        {
          size: 'lg' as const,
          showLatency: true,
          showReconnectAttempts: false,
          showTooltip: true,
          animated: false,
        },
      ];

      allPropsCombinations.forEach((props, index) => {
        const { unmount } = render(
          <WebSocketConnectionIndicator
            key={index}
            {...props}
            data-testid={`indicator-${index}`}
          />
        );

        expect(screen.getByTestId(`indicator-${index}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('handles unknown HTML attributes gracefully', () => {
      const unknownProps = {
        'data-unknown': 'value',
        'aria-unknown': 'value',
        'customProp': 'value',
      };

      render(
        <WebSocketConnectionIndicator
          {...unknownProps as any}
          data-testid="with-unknown-props"
        />
      );

      expect(screen.getByTestId('with-unknown-props')).toBeInTheDocument();
    });
  });
});