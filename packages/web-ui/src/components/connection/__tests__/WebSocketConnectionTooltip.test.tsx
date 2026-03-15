import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WebSocketConnectionTooltip } from '../WebSocketConnectionTooltip';
import type { WebSocketConnectionHealth } from '@/types/websocket-connection';

// Mock the utility functions
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
  getRelativeTime: vi.fn((date: Date) => '5m ago'),
  formatPercentage: vi.fn((value: number) => `${value}%`),
}));

// Mock the CONNECTION_STATUS_LABELS
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
    formatLatency: (ms: number | null) => ms ? `${ms}ms` : 'N/A',
    formatUptime: (ms: number | null) => {
      if (!ms) return 'N/A';
      const minutes = Math.floor(ms / 60000);
      return `${minutes}m`;
    },
  };
});

const createMockHealth = (overrides: Partial<WebSocketConnectionHealth> = {}): WebSocketConnectionHealth => ({
  status: 'connected',
  isHealthy: true,
  latencyMs: 45,
  averageLatencyMs: 52,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  consecutiveFailures: 0,
  lastHealthyAt: new Date('2023-01-01T12:00:00Z'),
  lastCheckAt: new Date('2023-01-01T12:05:00Z'),
  connectionUptime: 3600000, // 1 hour
  ...overrides,
});

describe('WebSocketConnectionTooltip Component', () => {
  let mockGetBoundingClientRect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock getBoundingClientRect for position calculations
    mockGetBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 100,
      top: 100,
      left: 100,
      bottom: 200,
      right: 300,
    });

    // Mock all elements getBoundingClientRect
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
      writable: true,
    });

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    // Clear document
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders children without tooltip initially', () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <span data-testid="test-content">Test Button</span>
        </WebSocketConnectionTooltip>
      );

      expect(screen.getByText('Test Button')).toBeInTheDocument();
      expect(screen.queryByText('Connection Health')).not.toBeInTheDocument();
    });

    it('applies correct wrapper structure', () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <span data-testid="child">Child</span>
        </WebSocketConnectionTooltip>
      );

      const wrapper = screen.getByTestId('child').parentElement;
      expect(wrapper).toHaveClass('focus:outline-none');
      expect(wrapper).toHaveAttribute('tabIndex', '0');
      expect(wrapper).toHaveAttribute('role', 'button');
    });

    it('has proper accessibility attributes on trigger', () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <div>Content</div>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('tabIndex', '0');
      expect(trigger).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('Tooltip Visibility', () => {
    it('shows tooltip on mouse enter', async () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <span data-testid="trigger-content">Trigger</span>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');
      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
      });
    });

    it('hides tooltip on mouse leave', async () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <span data-testid="trigger-content">Trigger</span>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
      });

      // Hide tooltip
      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Connection Health')).not.toBeInTheDocument();
      });
    });

    it('shows tooltip on focus', async () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <span data-testid="trigger-content">Trigger</span>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');
      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
      });
    });

    it('hides tooltip on blur', async () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <span data-testid="trigger-content">Trigger</span>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');

      // Show tooltip
      fireEvent.focus(trigger);
      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
      });

      // Hide tooltip
      fireEvent.blur(trigger);
      await waitFor(() => {
        expect(screen.queryByText('Connection Health')).not.toBeInTheDocument();
      });
    });

    it('sets proper aria-describedby when visible', async () => {
      const health = createMockHealth();
      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('aria-describedby');

      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-describedby', 'websocket-tooltip');
      });
    });
  });

  describe('Connected State Display', () => {
    it('displays connected status information correctly', async () => {
      const health = createMockHealth({
        status: 'connected',
        latencyMs: 45,
        averageLatencyMs: 52,
        connectionUptime: 3600000,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
        expect(screen.getByText('Connected')).toBeInTheDocument();
        expect(screen.getByText('45ms')).toBeInTheDocument();
        expect(screen.getByText('60m')).toBeInTheDocument(); // uptime formatted
      });
    });

    it('shows average latency when different from current', async () => {
      const health = createMockHealth({
        status: 'connected',
        latencyMs: 45,
        averageLatencyMs: 60,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('45ms')).toBeInTheDocument();
        expect(screen.getByText('(avg: 60ms)')).toBeInTheDocument();
      });
    });

    it('hides average latency when same as current', async () => {
      const health = createMockHealth({
        status: 'connected',
        latencyMs: 50,
        averageLatencyMs: 50,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('50ms')).toBeInTheDocument();
        expect(screen.queryByText('(avg:')).not.toBeInTheDocument();
      });
    });

    it('shows uptime when available', async () => {
      const health = createMockHealth({
        status: 'connected',
        connectionUptime: 120000, // 2 minutes
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Uptime:')).toBeInTheDocument();
        expect(screen.getByText('2m')).toBeInTheDocument();
      });
    });

    it('hides uptime when null', async () => {
      const health = createMockHealth({
        status: 'connected',
        connectionUptime: null,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
        expect(screen.queryByText('Uptime:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Reconnecting State Display', () => {
    it('displays reconnection attempts', async () => {
      const health = createMockHealth({
        status: 'reconnecting',
        reconnectAttempts: 3,
        maxReconnectAttempts: 10,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Reconnecting')).toBeInTheDocument();
        expect(screen.getByText('Attempts:')).toBeInTheDocument();
        expect(screen.getByText('3/10')).toBeInTheDocument();
      });
    });

    it('hides attempts section when attempts is 0', async () => {
      const health = createMockHealth({
        status: 'reconnecting',
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Reconnecting')).toBeInTheDocument();
        expect(screen.queryByText('Attempts:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Health Metrics Display', () => {
    it('calculates and displays success rate correctly', async () => {
      const health = createMockHealth({
        consecutiveFailures: 0,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Health Checks')).toBeInTheDocument();
        expect(screen.getByText('Success Rate:')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('displays consecutive failures with appropriate color', async () => {
      const health = createMockHealth({
        consecutiveFailures: 3,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Consecutive Failures:')).toBeInTheDocument();
        const failureElement = screen.getByText('3');
        expect(failureElement).toHaveClass('text-red-400');
      });
    });

    it('shows green color for zero failures', async () => {
      const health = createMockHealth({
        consecutiveFailures: 0,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const failureElement = screen.getByText('0');
        expect(failureElement).toHaveClass('text-green-400');
      });
    });

    it('displays last healthy time when available', async () => {
      const health = createMockHealth({
        lastHealthyAt: new Date('2023-01-01T12:00:00Z'),
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Last Healthy:')).toBeInTheDocument();
        expect(screen.getByText('5m ago')).toBeInTheDocument();
      });
    });

    it('hides last healthy when null', async () => {
      const health = createMockHealth({
        lastHealthyAt: null,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Health Checks')).toBeInTheDocument();
        expect(screen.queryByText('Last Healthy:')).not.toBeInTheDocument();
      });
    });

    it('displays last check time', async () => {
      const health = createMockHealth({
        lastCheckAt: new Date('2023-01-01T12:05:00Z'),
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Last Check:')).toBeInTheDocument();
        expect(screen.getByText('5m ago')).toBeInTheDocument();
      });
    });
  });

  describe('Status Dot Colors', () => {
    const statusTests = [
      { status: 'connected' as const, expectedClass: 'bg-green-500' },
      { status: 'disconnected' as const, expectedClass: 'bg-red-500' },
      { status: 'connecting' as const, expectedClass: 'bg-apex-500' },
      { status: 'reconnecting' as const, expectedClass: 'bg-yellow-500' },
      { status: 'error' as const, expectedClass: 'bg-red-500' },
    ];

    statusTests.forEach(({ status, expectedClass }) => {
      it(`displays correct color for ${status} status`, async () => {
        const health = createMockHealth({ status });

        render(
          <WebSocketConnectionTooltip health={health}>
            <button>Trigger</button>
          </WebSocketConnectionTooltip>
        );

        fireEvent.mouseEnter(screen.getByRole('button'));

        await waitFor(() => {
          const statusDot = screen.getByText('Connection Health')
            .closest('[role="tooltip"]')!
            .querySelector('.w-2.h-2.rounded-full');
          expect(statusDot).toHaveClass(expectedClass);
        });
      });
    });
  });

  describe('Positioning', () => {
    it('positions tooltip below trigger by default', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip.style.top).toBe('208px'); // 100 (trigger bottom) + 100 (height) + 8 (offset)
      });
    });

    it('handles tooltip positioning when near viewport edge', async () => {
      // Mock narrow viewport
      Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });

      // Mock trigger near right edge
      mockGetBoundingClientRect.mockReturnValue({
        width: 100,
        height: 50,
        top: 100,
        left: 350, // Near right edge
        bottom: 150,
        right: 450,
      });

      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        // Should be adjusted to fit within viewport
        expect(tooltip.style.left).toBe('192px'); // 400 - 200 - 8
      });
    });

    it('positions tooltip above when would overflow bottom', async () => {
      // Mock short viewport
      Object.defineProperty(window, 'innerHeight', { value: 200, writable: true });

      // Mock trigger near bottom
      mockGetBoundingClientRect.mockReturnValue({
        width: 100,
        height: 50,
        top: 150, // Near bottom
        left: 100,
        bottom: 200,
        right: 200,
      });

      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        // Should be positioned above trigger
        expect(tooltip.style.top).toBe('42px'); // 150 - 100 - 8
      });
    });

    it('handles window resize events', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      // Simulate window resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
        fireEvent(window, new Event('resize'));
      });

      // Tooltip should still be visible and positioned
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Success Rate Calculation', () => {
    it('returns 100% for no failures', async () => {
      const health = createMockHealth({ consecutiveFailures: 0 });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('calculates reduced rate for multiple failures', async () => {
      const health = createMockHealth({ consecutiveFailures: 5 });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        // With 5 failures, should be 85%
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });

    it('has minimum threshold for very high failures', async () => {
      const health = createMockHealth({ consecutiveFailures: 10 });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        // Should not go below 50%
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className to tooltip container', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health} className="custom-tooltip">
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip.firstChild).toHaveClass('custom-tooltip');
      });
    });

    it('preserves default tooltip styling', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltipContent = screen.getByRole('tooltip').firstChild;
        expect(tooltipContent).toHaveClass(
          'bg-background-secondary',
          'border',
          'border-border-secondary',
          'rounded-lg',
          'shadow-lg',
          'max-w-xs',
          'p-4'
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('tabIndex', '0');
      expect(trigger).toHaveAttribute('role', 'button');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('id', 'websocket-tooltip');
        expect(trigger).toHaveAttribute('aria-describedby', 'websocket-tooltip');
      });
    });

    it('supports keyboard navigation', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');

      // Should be focusable
      expect(trigger).toHaveAttribute('tabIndex', '0');

      // Focus should show tooltip
      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      // Blur should hide tooltip
      fireEvent.blur(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('is non-interactive when visible', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('pointer-events-none');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles null values gracefully', async () => {
      const health = createMockHealth({
        latencyMs: null,
        averageLatencyMs: null,
        lastHealthyAt: null,
        lastCheckAt: null,
        connectionUptime: null,
      });

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
        // Should not crash and should display what it can
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('cleans up event listeners on unmount', () => {
      const health = createMockHealth();
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      fireEvent.mouseEnter(screen.getByRole('button'));

      unmount();

      // Should have cleaned up resize listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('handles rapid show/hide events', async () => {
      const health = createMockHealth();

      render(
        <WebSocketConnectionTooltip health={health}>
          <button>Trigger</button>
        </WebSocketConnectionTooltip>
      );

      const trigger = screen.getByRole('button');

      // Rapid mouse events
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Connection Health')).toBeInTheDocument();
      });
    });
  });
});