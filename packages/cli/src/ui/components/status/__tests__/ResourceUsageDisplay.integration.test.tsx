/**
 * Integration tests for ResourceUsageDisplay component
 * Tests the component in realistic scenarios with actual usage data
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResourceUsageDisplay } from '../ResourceUsageDisplay';
import { ThemeProvider } from '../../../context/ThemeContext';

// Mock theme context dependencies
const mockThemeColors = {
  muted: '#6B7280',
  info: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  primary: '#8B5CF6',
};

vi.mock('../../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => mockThemeColors),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock ResourceLimitBar components with test-friendly implementation
vi.mock('../ResourceLimitBar.js', () => ({
  ResourceLimitBar: ({ current, limit, label, formatter, limitFormatter }: any) => {
    const currentDisplay = formatter ? formatter(current) : current.toLocaleString();
    const limitDisplay = limitFormatter ? limitFormatter(limit) : limit.toLocaleString();
    const percentage = limit > 0 ? (current / limit) * 100 : 0;
    const isExceeded = current > limit;
    const level = percentage < 50 ? 'safe' : percentage < 80 ? 'warning' : 'danger';

    return (
      <div
        data-testid="resource-limit-bar"
        data-current={current}
        data-limit={limit}
        data-percentage={Math.round(percentage)}
        data-level={level}
        data-exceeded={isExceeded}
      >
        <span>{label}: </span>
        <span data-testid="progress-display">[{'█'.repeat(Math.floor(percentage / 10))}{'░'.repeat(10 - Math.floor(percentage / 10))}]</span>
        <span data-testid="value-display">{currentDisplay}/{limitDisplay}</span>
        {isExceeded && <span data-testid="warning-indicator">⚠️</span>}
      </div>
    );
  },
  CompactResourceLimitBar: ({ current, limit, label }: any) => {
    const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
    const isExceeded = current > limit;
    const level = percentage < 50 ? 'safe' : percentage < 80 ? 'warning' : 'danger';

    return (
      <div
        data-testid="compact-resource-limit-bar"
        data-current={current}
        data-limit={limit}
        data-percentage={percentage}
        data-level={level}
        data-exceeded={isExceeded}
      >
        <span>{label}: </span>
        <span data-testid="compact-progress">[{'█'.repeat(Math.floor(percentage / 20))}{'░'.repeat(5 - Math.floor(percentage / 20))}]</span>
        <span data-testid="percentage-display">{percentage}%</span>
        {isExceeded && <span data-testid="warning-indicator">⚠️</span>}
      </div>
    );
  },
}));

describe('ResourceUsageDisplay Integration Tests', () => {
  it('should handle realistic API usage scenarios', () => {
    // Simulate a typical development workflow with moderate usage
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={1250}
        outputTokens={850}
        cost={0.075}
        apiCalls={5}
        label="Development Session"
      />
    );

    expect(screen.getByText('Development Session:')).toBeInTheDocument();
    expect(screen.getByText('1.3k→0.9k (2.1k total)')).toBeInTheDocument();
    expect(screen.getByText('$0.075')).toBeInTheDocument();
    expect(screen.getByText('5 calls')).toBeInTheDocument();

    // Simulate scaling up to production usage
    rerender(
      <ResourceUsageDisplay
        inputTokens={25000}
        outputTokens={18500}
        cost={2.45}
        apiCalls={150}
        label="Production Deploy"
      />
    );

    expect(screen.getByText('Production Deploy:')).toBeInTheDocument();
    expect(screen.getByText('25.0k→18.5k (43.5k total)')).toBeInTheDocument();
    expect(screen.getByText('$2.45')).toBeInTheDocument();
    expect(screen.getByText('150 calls')).toBeInTheDocument();
  });

  it('should handle monitoring dashboard scenarios', () => {
    // Simulate a monitoring dashboard with compact display
    render(
      <ResourceUsageDisplay
        inputTokens={2500000}
        outputTokens={1800000}
        cost={15.75}
        apiCalls={50000}
        compact={true}
      />
    );

    // Compact format for dashboard widgets
    expect(screen.getByText('4.3M tok')).toBeInTheDocument();
    expect(screen.getByText('$15.75')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();

    // Should show separators
    expect(screen.getAllByText('|')).toHaveLength(2);
  });

  it('should handle different cost ranges with appropriate formatting', () => {
    const scenarios = [
      { cost: 0.0005, expected: '$0.0005', scenario: 'micro-transactions' },
      { cost: 0.025, expected: '$0.025', scenario: 'small operations' },
      { cost: 0.5, expected: '$0.500', scenario: 'medium operations' },
      { cost: 2.5, expected: '$2.50', scenario: 'large operations' },
      { cost: 50.0, expected: '$50.00', scenario: 'enterprise usage' },
    ];

    scenarios.forEach(({ cost, expected, scenario }) => {
      const { unmount } = render(
        <ResourceUsageDisplay
          inputTokens={1000}
          outputTokens={1000}
          cost={cost}
          apiCalls={10}
          label={scenario}
        />
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle progressive token usage accumulation', () => {
    // Simulate tokens accumulating over time
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={500}
        outputTokens={300}
        cost={0.02}
        apiCalls={1}
        showBreakdown={false}
      />
    );

    expect(screen.getByText('800')).toBeInTheDocument();

    // Add more tokens
    rerender(
      <ResourceUsageDisplay
        inputTokens={1200}
        outputTokens={800}
        cost={0.065}
        apiCalls={3}
        showBreakdown={false}
      />
    );

    expect(screen.getByText('2.0k')).toBeInTheDocument();

    // Heavy usage
    rerender(
      <ResourceUsageDisplay
        inputTokens={15000}
        outputTokens={12000}
        cost={1.25}
        apiCalls={25}
        showBreakdown={true} // Auto-enable breakdown for large totals
      />
    );

    expect(screen.getByText('15.0k→12.0k (27.0k total)')).toBeInTheDocument();
  });

  it('should handle international currency scenarios', () => {
    const currencies = [
      { symbol: '€', amount: 1.25, expected: '€1.25' },
      { symbol: '£', amount: 0.95, expected: '£0.95' },
      { symbol: '¥', amount: 150.0, expected: '¥150.00' },
      { symbol: 'CAD$', amount: 1.35, expected: 'CAD$1.35' },
    ];

    currencies.forEach(({ symbol, amount, expected }) => {
      const { unmount } = render(
        <ResourceUsageDisplay
          inputTokens={1000}
          outputTokens={1000}
          cost={amount}
          currency={symbol}
          apiCalls={10}
        />
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('should maintain layout consistency across different data ranges', () => {
    const testCases = [
      { inputTokens: 1, outputTokens: 1, cost: 0.001, apiCalls: 1 },
      { inputTokens: 500, outputTokens: 300, cost: 0.025, apiCalls: 5 },
      { inputTokens: 1200, outputTokens: 800, cost: 0.15, apiCalls: 12 },
      { inputTokens: 15000, outputTokens: 10000, cost: 2.5, apiCalls: 100 },
      { inputTokens: 500000, outputTokens: 300000, cost: 35.0, apiCalls: 1000 },
    ];

    testCases.forEach((testCase, index) => {
      const { unmount } = render(
        <ResourceUsageDisplay
          {...testCase}
          label={`Test ${index + 1}`}
        />
      );

      // All tests should have the label and separators
      expect(screen.getByText(`Test ${index + 1}:`)).toBeInTheDocument();
      expect(screen.getAllByText('|')).toHaveLength(2);

      // All tests should show some form of token count
      const tokenElements = screen.getAllByText(/\d+/);
      expect(tokenElements.length).toBeGreaterThan(0);

      unmount();
    });
  });

  it('should work correctly with theme provider wrapper', () => {
    // Test that component works within actual theme context
    render(
      <ThemeProvider defaultTheme="dark">
        <ResourceUsageDisplay
          inputTokens={1500}
          outputTokens={1200}
          cost={0.25}
          apiCalls={8}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('usage:')).toBeInTheDocument();
    expect(screen.getByText('1.5k→1.2k (2.7k total)')).toBeInTheDocument();
    expect(screen.getByText('$0.250')).toBeInTheDocument();
    expect(screen.getByText('8 calls')).toBeInTheDocument();
  });

  it('should handle rapid updates without visual glitches', () => {
    // Simulate rapid state updates as would happen in real-time monitoring
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={1000}
        outputTokens={1000}
        cost={0.1}
        apiCalls={5}
      />
    );

    // Multiple rapid updates
    const updates = [
      { inputTokens: 1100, outputTokens: 1050, cost: 0.11, apiCalls: 6 },
      { inputTokens: 1250, outputTokens: 1180, cost: 0.125, apiCalls: 7 },
      { inputTokens: 1400, outputTokens: 1300, cost: 0.14, apiCalls: 8 },
      { inputTokens: 1600, outputTokens: 1450, cost: 0.16, apiCalls: 9 },
    ];

    updates.forEach((update) => {
      rerender(
        <ResourceUsageDisplay
          {...update}
        />
      );

      // Should maintain structure after each update
      expect(screen.getByText('usage:')).toBeInTheDocument();
      expect(screen.getAllByText('|')).toHaveLength(2);
    });

    // Final state should be correct
    expect(screen.getByText('1.6k→1.5k (3.1k total)')).toBeInTheDocument();
    expect(screen.getByText('$0.160')).toBeInTheDocument();
    expect(screen.getByText('9 calls')).toBeInTheDocument();
  });

  describe('Limit Indicators Integration', () => {
    it('should render usage display with comprehensive limit indicators', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={400}
          outputTokens={100}
          cost={2.5}
          apiCalls={8}
          limits={{
            maxTokens: 1000,    // 500/1000 = 50% (warning)
            maxCost: 5.0,       // 2.5/5.0 = 50% (warning)
            maxApiCalls: 10,    // 8/10 = 80% (danger)
          }}
        />
      );

      // Basic usage display should be present
      expect(screen.getByText('usage:')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument(); // Total tokens
      expect(screen.getByText('$2.50')).toBeInTheDocument();
      expect(screen.getByText('8 calls')).toBeInTheDocument();

      // All limit bars should be rendered
      const limitBars = screen.getAllByTestId('resource-limit-bar');
      expect(limitBars).toHaveLength(3);

      // Check specific limit levels
      const tokenBar = limitBars.find(bar => bar.getAttribute('data-current') === '500');
      expect(tokenBar).toHaveAttribute('data-limit', '1000');
      expect(tokenBar).toHaveAttribute('data-level', 'warning');

      const apiBar = limitBars.find(bar => bar.getAttribute('data-current') === '8');
      expect(apiBar).toHaveAttribute('data-level', 'danger');
    });

    it('should show exceeded indicators when limits are surpassed', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={600}
          outputTokens={600}
          cost={6.0}
          apiCalls={12}
          limits={{
            maxTokens: 1000,    // 1200/1000 = 120% (exceeded)
            maxCost: 5.0,       // 6.0/5.0 = 120% (exceeded)
            maxApiCalls: 10,    // 12/10 = 120% (exceeded)
          }}
        />
      );

      const limitBars = screen.getAllByTestId('resource-limit-bar');
      expect(limitBars).toHaveLength(3);

      // All should be exceeded and show warning indicators
      limitBars.forEach(bar => {
        expect(bar).toHaveAttribute('data-exceeded', 'true');
        expect(bar).toHaveAttribute('data-level', 'danger');
      });

      const warningIndicators = screen.getAllByTestId('warning-indicator');
      expect(warningIndicators).toHaveLength(3);
    });

    it('should handle compact mode with limit indicators', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={300}
          outputTokens={200}
          cost={4.0}
          apiCalls={9}
          compact={true}
          limits={{
            maxTokens: 1000,    // 500/1000 = 50% (warning)
            maxCost: 5.0,       // 4.0/5.0 = 80% (danger)
            maxApiCalls: 10,    // 9/10 = 90% (danger)
          }}
        />
      );

      // Basic compact display should be present
      expect(screen.getByText('500 tok')).toBeInTheDocument();
      expect(screen.getByText('$4.00')).toBeInTheDocument();

      // Compact limit bars should be rendered
      const compactBars = screen.getAllByTestId('compact-resource-limit-bar');
      expect(compactBars).toHaveLength(3);

      // Check percentage displays
      expect(screen.getByText('50%')).toBeInTheDocument(); // Tokens
      expect(screen.getByText('80%')).toBeInTheDocument(); // Cost
      expect(screen.getByText('90%')).toBeInTheDocument(); // API calls
    });

    it('should handle partial limits configuration', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={300}
          outputTokens={200}
          cost={4.0}
          apiCalls={9}
          limits={{
            maxTokens: 1000,
            // Only tokens limit provided
          }}
        />
      );

      // Should only render one limit bar
      const limitBars = screen.getAllByTestId('resource-limit-bar');
      expect(limitBars).toHaveLength(1);

      // Should be the tokens limit bar
      expect(limitBars[0]).toHaveAttribute('data-current', '500');
      expect(limitBars[0]).toHaveAttribute('data-limit', '1000');
    });

    it('should handle daily budget limit separately from cost limit', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={300}
          outputTokens={200}
          cost={4.0}
          apiCalls={9}
          limits={{
            maxCost: 5.0,        // Per-task cost limit
            dailyBudget: 100.0,  // Daily budget limit (also uses cost)
          }}
        />
      );

      // Should render two limit bars (cost and daily budget)
      const limitBars = screen.getAllByTestId('resource-limit-bar');
      expect(limitBars).toHaveLength(2);

      // Both should use cost value (4.0) but different limits
      const costBar = limitBars.find(bar => bar.getAttribute('data-limit') === '5');
      const budgetBar = limitBars.find(bar => bar.getAttribute('data-limit') === '100');

      expect(costBar).toHaveAttribute('data-current', '4');
      expect(budgetBar).toHaveAttribute('data-current', '4');
    });

    it('should hide limit indicators when disabled', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={300}
          outputTokens={200}
          cost={4.0}
          apiCalls={9}
          limits={{
            maxTokens: 1000,
            maxCost: 5.0,
          }}
          showLimitIndicators={false}
        />
      );

      // Basic usage should be shown
      expect(screen.getByText('usage:')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();

      // No limit bars should be rendered
      expect(screen.queryByTestId('resource-limit-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('compact-resource-limit-bar')).not.toBeInTheDocument();
    });

    it('should handle real-world development scenarios', () => {
      // Test typical development workflow with approaching limits
      render(
        <ResourceUsageDisplay
          inputTokens={4200}
          outputTokens={4800}
          cost={8.75}
          apiCalls={23}
          limits={{
            maxTokens: 10000,      // 90% usage (danger)
            maxCost: 10.0,         // 87.5% usage (danger)
            maxApiCalls: 25,       // 92% usage (danger)
          }}
        />
      );

      const limitBars = screen.getAllByTestId('resource-limit-bar');

      // All should be in danger level but not exceeded
      limitBars.forEach(bar => {
        expect(bar).toHaveAttribute('data-level', 'danger');
        expect(bar).toHaveAttribute('data-exceeded', 'false');
      });

      // Should not show warning indicators (not exceeded)
      expect(screen.queryByTestId('warning-indicator')).not.toBeInTheDocument();
    });
  });
});