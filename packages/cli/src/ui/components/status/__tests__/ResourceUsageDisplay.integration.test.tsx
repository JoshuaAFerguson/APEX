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
vi.mock('../../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => ({
    muted: 'gray',
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
});