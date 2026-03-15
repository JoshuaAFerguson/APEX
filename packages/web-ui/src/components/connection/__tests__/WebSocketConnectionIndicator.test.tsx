import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSocketConnectionIndicator } from '../WebSocketConnectionIndicator';
import type { WebSocketConnectionHealth } from '@/types/websocket-connection';

// Mock the cn utility function
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
  getRelativeTime: (date: Date) => '5m ago',
  formatPercentage: (value: number) => `${value}%`,
}));

// Mock the hook
vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => ({
    status: 'connected',
    isHealthy: true,
    latencyMs: 45,
    averageLatencyMs: 52,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
    connectionUptime: 3600000, // 1 hour
  }))
}));

// Mock the tooltip component
vi.mock('../WebSocketConnectionTooltip', () => ({
  WebSocketConnectionTooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="websocket-tooltip">{children}</div>
  ),
}));

describe('WebSocketConnectionIndicator Component', () => {
  beforeEach(() => {
    // Clear any previous renders
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<WebSocketConnectionIndicator />);

      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('aria-label', 'Connection status: Connected');
    });

    it('displays status text by default', () => {
      render(<WebSocketConnectionIndicator />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('includes status dot and icon', () => {
      render(<WebSocketConnectionIndicator />);

      const indicator = screen.getByRole('status');
      const statusDot = indicator.querySelector('[aria-hidden="true"]');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<WebSocketConnectionIndicator size="sm" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('px-2', 'py-1', 'text-xs', 'gap-1');
    });

    it('renders medium size correctly (default)', () => {
      render(<WebSocketConnectionIndicator size="md" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('px-3', 'py-1.5', 'text-sm', 'gap-1.5');
    });

    it('renders large size correctly', () => {
      render(<WebSocketConnectionIndicator size="lg" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('px-4', 'py-2', 'text-base', 'gap-2');
    });
  });

  describe('Connection Status States', () => {
    const mockHealthStates: Record<string, Partial<WebSocketConnectionHealth>> = {
      connected: {
        status: 'connected',
        isHealthy: true,
        latencyMs: 45,
        reconnectAttempts: 0,
      },
      disconnected: {
        status: 'disconnected',
        isHealthy: false,
        latencyMs: null,
        reconnectAttempts: 0,
      },
      connecting: {
        status: 'connecting',
        isHealthy: false,
        latencyMs: null,
        reconnectAttempts: 1,
      },
      reconnecting: {
        status: 'reconnecting',
        isHealthy: false,
        latencyMs: null,
        reconnectAttempts: 3,
        maxReconnectAttempts: 10,
      },
      error: {
        status: 'error',
        isHealthy: false,
        latencyMs: null,
        consecutiveFailures: 5,
      },
    };

    it('renders connected state correctly', () => {
      render(<WebSocketConnectionIndicator healthOverride={mockHealthStates.connected} />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-green-950/50', 'text-green-400', 'border-green-900');
    });

    it('renders disconnected state correctly', () => {
      render(<WebSocketConnectionIndicator healthOverride={mockHealthStates.disconnected} />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-red-950/50', 'text-red-400', 'border-red-900');
    });

    it('renders connecting state correctly', () => {
      render(<WebSocketConnectionIndicator healthOverride={mockHealthStates.connecting} />);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-apex-950/50', 'text-apex-400', 'border-apex-900');
    });

    it('renders reconnecting state correctly', () => {
      render(<WebSocketConnectionIndicator healthOverride={mockHealthStates.reconnecting} />);

      expect(screen.getByText('Reconnecting (3/10)')).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-yellow-950/50', 'text-yellow-400', 'border-yellow-900');
    });

    it('renders error state correctly', () => {
      render(<WebSocketConnectionIndicator healthOverride={mockHealthStates.error} />);

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('bg-red-950/50', 'text-red-400', 'border-red-900');
    });
  });

  describe('Latency Display', () => {
    it('shows latency when connected and showLatency is true', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency={true}
          healthOverride={{
            status: 'connected',
            latencyMs: 45,
          }}
        />
      );

      expect(screen.getByText('45ms')).toBeInTheDocument();
    });

    it('shows connected text when showLatency is false', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency={false}
          healthOverride={{
            status: 'connected',
            latencyMs: 45,
          }}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.queryByText('45ms')).not.toBeInTheDocument();
    });

    it('shows connected text when latency is null', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency={true}
          healthOverride={{
            status: 'connected',
            latencyMs: null,
          }}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  describe('Reconnection Attempts Display', () => {
    it('shows reconnection attempts when reconnecting by default', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 2,
            maxReconnectAttempts: 10,
          }}
        />
      );

      expect(screen.getByText('Reconnecting (2/10)')).toBeInTheDocument();
    });

    it('hides reconnection attempts when showReconnectAttempts is false', () => {
      render(
        <WebSocketConnectionIndicator
          showReconnectAttempts={false}
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 2,
            maxReconnectAttempts: 10,
          }}
        />
      );

      expect(screen.getByText('Reconnecting')).toBeInTheDocument();
      expect(screen.queryByText('Reconnecting (2/10)')).not.toBeInTheDocument();
    });

    it('shows basic text when reconnect attempts is 0', () => {
      render(
        <WebSocketConnectionIndicator
          showReconnectAttempts={true}
          healthOverride={{
            status: 'reconnecting',
            reconnectAttempts: 0,
            maxReconnectAttempts: 10,
          }}
        />
      );

      expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    });
  });

  describe('Tooltip Integration', () => {
    it('wraps with tooltip by default', () => {
      render(<WebSocketConnectionIndicator />);

      expect(screen.getByTestId('websocket-tooltip')).toBeInTheDocument();
    });

    it('does not wrap with tooltip when showTooltip is false', () => {
      render(<WebSocketConnectionIndicator showTooltip={false} />);

      expect(screen.queryByTestId('websocket-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('includes animation classes by default for appropriate states', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'connecting' }}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('animate-pulse');
    });

    it('disables animation when animated is false', () => {
      render(
        <WebSocketConnectionIndicator
          animated={false}
          healthOverride={{ status: 'connecting' }}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).not.toHaveClass('animate-pulse');
    });

    it('applies pulse animation to disconnected state', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'disconnected' }}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('animate-pulse');
    });

    it('applies pulse animation to error state', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'error' }}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('animate-pulse');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(<WebSocketConnectionIndicator className="custom-class" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('custom-class');
    });

    it('preserves default classes when adding custom className', () => {
      render(<WebSocketConnectionIndicator className="custom" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass(
        'inline-flex',
        'items-center',
        'rounded-full',
        'border',
        'font-medium',
        'transition-all',
        'duration-300',
        'custom'
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper role and aria-label', () => {
      render(<WebSocketConnectionIndicator />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Connection status: Connected');
    });

    it('updates aria-label based on status', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'disconnected' }}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Connection status: Disconnected');
    });

    it('marks decorative elements as aria-hidden', () => {
      render(<WebSocketConnectionIndicator />);

      const indicator = screen.getByRole('status');
      const hiddenElements = indicator.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBeGreaterThan(0);
    });
  });

  describe('Props Handling', () => {
    it('passes through HTML attributes', () => {
      render(
        <WebSocketConnectionIndicator
          data-testid="custom-indicator"
          id="indicator-1"
        />
      );

      const indicator = screen.getByTestId('custom-indicator');
      expect(indicator).toHaveAttribute('id', 'indicator-1');
    });

    it('handles healthOverride prop correctly', () => {
      const customHealth: Partial<WebSocketConnectionHealth> = {
        status: 'error',
        isHealthy: false,
        consecutiveFailures: 3,
      };

      render(<WebSocketConnectionIndicator healthOverride={customHealth} />);

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles null latency gracefully', () => {
      render(
        <WebSocketConnectionIndicator
          showLatency={true}
          healthOverride={{
            status: 'connected',
            latencyMs: null,
          }}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('handles undefined health override', () => {
      render(<WebSocketConnectionIndicator healthOverride={undefined} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('handles partial health override', () => {
      render(
        <WebSocketConnectionIndicator
          healthOverride={{ status: 'disconnected' }}
        />
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });
});