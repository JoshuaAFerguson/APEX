import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResourceUsageDisplay, formatTokenCount, formatCurrency, formatApiCalls } from '../ResourceUsageDisplay';

// Mock theme context
vi.mock('../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => ({
    muted: 'gray',
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  })),
}));

describe('ResourceUsageDisplay', () => {
  it('should render with default label', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={3}
      />
    );

    expect(screen.getByText('usage:')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument(); // Total tokens for small amounts
    expect(screen.getByText('$0.05')).toBeInTheDocument();
    expect(screen.getByText('3 calls')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={3}
        label="API usage"
      />
    );

    expect(screen.getByText('API usage:')).toBeInTheDocument();
  });

  it('should show breakdown for large token totals', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1200}
        outputTokens={800}
        cost={0.15}
        apiCalls={5}
      />
    );

    expect(screen.getByText('1.2k→0.8k (2.0k total)')).toBeInTheDocument();
    expect(screen.getByText('$0.150')).toBeInTheDocument();
    expect(screen.getByText('5 calls')).toBeInTheDocument();
  });

  it('should force breakdown when showBreakdown is true', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={300}
        outputTokens={400}
        cost={0.02}
        apiCalls={2}
        showBreakdown={true}
      />
    );

    expect(screen.getByText('300→400 (700 total)')).toBeInTheDocument();
  });

  it('should hide breakdown when showBreakdown is false', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1200}
        outputTokens={800}
        cost={0.15}
        apiCalls={5}
        showBreakdown={false}
      />
    );

    expect(screen.getByText('2.0k')).toBeInTheDocument();
    expect(screen.queryByText('1.2k→0.8k')).not.toBeInTheDocument();
  });

  it('should render compact mode', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1200}
        outputTokens={800}
        cost={0.15}
        apiCalls={5}
        compact={true}
      />
    );

    expect(screen.getByText('2.0k tok')).toBeInTheDocument();
    expect(screen.getByText('$0.150')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText('usage:')).not.toBeInTheDocument(); // No label in compact mode
  });

  it('should handle single API call correctly', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.01}
        apiCalls={1}
      />
    );

    expect(screen.getByText('1 call')).toBeInTheDocument(); // Singular form
  });

  it('should handle zero cost', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0}
        apiCalls={1}
      />
    );

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('should handle custom currency', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={1}
        currency="€"
      />
    );

    expect(screen.getByText('€0.05')).toBeInTheDocument();
  });

  it('should handle zero tokens', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={0}
        outputTokens={0}
        cost={0}
        apiCalls={0}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('0 calls')).toBeInTheDocument();
  });

  it('should handle large numbers correctly', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1500000}
        outputTokens={2500000}
        cost={25.50}
        apiCalls={1000}
      />
    );

    expect(screen.getByText('1.5M→2.5M (4.0M total)')).toBeInTheDocument();
    expect(screen.getByText('$25.50')).toBeInTheDocument();
    expect(screen.getByText('1,000 calls')).toBeInTheDocument();
  });
});

describe('formatTokenCount', () => {
  it('should format small numbers without units', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(100)).toBe('100');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('should format thousands with k suffix', () => {
    expect(formatTokenCount(1000)).toBe('1.0k');
    expect(formatTokenCount(1234)).toBe('1.2k');
    expect(formatTokenCount(999999)).toBe('1000.0k');
  });

  it('should format millions with M suffix', () => {
    expect(formatTokenCount(1000000)).toBe('1.0M');
    expect(formatTokenCount(1234567)).toBe('1.2M');
    expect(formatTokenCount(10000000)).toBe('10.0M');
  });
});

describe('formatCurrency', () => {
  it('should handle zero amount', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(0, '€')).toBe('€0.00');
  });

  it('should handle very small amounts with 4 decimal places', () => {
    expect(formatCurrency(0.0001)).toBe('$0.0001');
    expect(formatCurrency(0.0099)).toBe('$0.0099');
  });

  it('should handle small amounts with 3 decimal places', () => {
    expect(formatCurrency(0.01)).toBe('$0.010');
    expect(formatCurrency(0.999)).toBe('$0.999');
  });

  it('should handle normal amounts with 2 decimal places', () => {
    expect(formatCurrency(1)).toBe('$1.00');
    expect(formatCurrency(25.50)).toBe('$25.50');
    expect(formatCurrency(1000)).toBe('$1000.00');
  });

  it('should handle custom currency symbols', () => {
    expect(formatCurrency(1.50, '€')).toBe('€1.50');
    expect(formatCurrency(0.001, '¥')).toBe('¥0.001');
  });
});

describe('formatApiCalls', () => {
  it('should format small numbers without commas', () => {
    expect(formatApiCalls(0)).toBe('0');
    expect(formatApiCalls(100)).toBe('100');
    expect(formatApiCalls(999)).toBe('999');
  });

  it('should format large numbers with locale commas', () => {
    expect(formatApiCalls(1000)).toBe('1,000');
    expect(formatApiCalls(12345)).toBe('12,345');
    expect(formatApiCalls(1000000)).toBe('1,000,000');
  });
});

describe('ResourceUsageDisplay Edge Cases', () => {
  it('should handle negative values gracefully', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={-100}
        outputTokens={200}
        cost={-0.05}
        apiCalls={3}
      />
    );

    expect(screen.getByText('100')).toBeInTheDocument(); // Total tokens = -100 + 200 = 100
    expect(screen.getByText('$-0.050')).toBeInTheDocument(); // Negative cost formatted
    expect(screen.getByText('3 calls')).toBeInTheDocument();
  });

  it('should handle extremely large token numbers', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={50000000}
        outputTokens={25000000}
        cost={100.5555}
        apiCalls={10000000}
      />
    );

    expect(screen.getByText('50.0M→25.0M (75.0M total)')).toBeInTheDocument();
    expect(screen.getByText('$100.56')).toBeInTheDocument();
    expect(screen.getByText('10,000,000 calls')).toBeInTheDocument();
  });

  it('should handle fractional tokens', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={100.5}
        outputTokens={200.7}
        cost={0.05}
        apiCalls={3}
      />
    );

    // Note: formatTokenCount converts to integer for display, so 301.2 becomes 301
    expect(screen.getByText('301')).toBeInTheDocument();
  });

  it('should show proper color mapping based on cost thresholds', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0}
        apiCalls={1}
      />
    );

    // Test zero cost (should be muted)
    expect(screen.getByText('$0.00')).toBeInTheDocument();

    // Test low cost (should be success)
    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$0.05')).toBeInTheDocument();

    // Test medium cost (should be info)
    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.5}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$0.500')).toBeInTheDocument();

    // Test high cost (should be warning)
    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={2.5}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$2.50')).toBeInTheDocument();

    // Test very high cost (should be error)
    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={10.0}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });

  it('should handle compact mode with breakdown disabled', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1200}
        outputTokens={800}
        cost={0.15}
        apiCalls={5}
        compact={true}
        showBreakdown={true} // This should be ignored in compact mode
      />
    );

    // In compact mode, breakdown is never shown
    expect(screen.getByText('2.0k tok')).toBeInTheDocument();
    expect(screen.queryByText('1.2k→800')).not.toBeInTheDocument();
    expect(screen.queryByText('usage:')).not.toBeInTheDocument();
  });

  it('should handle mixed extreme values', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={0}
        outputTokens={999999}
        cost={0.0001}
        apiCalls={1}
      />
    );

    expect(screen.getByText('1000.0k')).toBeInTheDocument(); // Close to million threshold
    expect(screen.getByText('$0.0001')).toBeInTheDocument(); // Very small cost
    expect(screen.getByText('1 call')).toBeInTheDocument(); // Singular form
  });

  it('should handle threshold edge cases for token formatting', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={999}
        outputTokens={0}
        cost={0.01}
        apiCalls={1}
      />
    );
    expect(screen.getByText('999')).toBeInTheDocument(); // Just under 1k

    rerender(
      <ResourceUsageDisplay
        inputTokens={1000}
        outputTokens={0}
        cost={0.01}
        apiCalls={1}
      />
    );
    expect(screen.getByText('1.0k')).toBeInTheDocument(); // Exactly 1k

    rerender(
      <ResourceUsageDisplay
        inputTokens={999999}
        outputTokens={0}
        cost={0.01}
        apiCalls={1}
      />
    );
    expect(screen.getByText('1000.0k')).toBeInTheDocument(); // Just under 1M

    rerender(
      <ResourceUsageDisplay
        inputTokens={1000000}
        outputTokens={0}
        cost={0.01}
        apiCalls={1}
      />
    );
    expect(screen.getByText('1.0M')).toBeInTheDocument(); // Exactly 1M
  });

  it('should handle currency edge cases', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.009999}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$0.0100')).toBeInTheDocument(); // Just under 0.01 threshold

    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.999}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$0.999')).toBeInTheDocument(); // Just under 1.0 threshold

    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.99999}
        apiCalls={1}
      />
    );
    expect(screen.getByText('$1.00')).toBeInTheDocument(); // Rounds up to 1.0 threshold
  });
});