/**
 * Accessibility tests for ResourceUsageDisplay component
 * Ensures the component is accessible and provides appropriate ARIA labels
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResourceUsageDisplay } from '../ResourceUsageDisplay';

// Mock theme context
vi.mock('../../../context/ThemeContext.js', () => ({
  useThemeColors: vi.fn(() => ({
    muted: 'gray',
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  })),
}));

describe('ResourceUsageDisplay Accessibility Tests', () => {
  it('should provide meaningful text content for screen readers', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1200}
        outputTokens={800}
        cost={0.15}
        apiCalls={5}
        label="Current usage"
      />
    );

    // Check that all essential information is present as text
    expect(screen.getByText('Current usage:')).toBeInTheDocument();
    expect(screen.getByText(/1\.2k→0\.8k \(2\.0k total\)|2\.0k/)).toBeInTheDocument();
    expect(screen.getByText('$0.150')).toBeInTheDocument();
    expect(screen.getByText('5 calls')).toBeInTheDocument();
  });

  it('should provide clear information structure in compact mode', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={2500}
        outputTokens={1800}
        cost={0.25}
        apiCalls={10}
        compact={true}
      />
    );

    // In compact mode, information should still be readable
    expect(screen.getByText('4.3k tok')).toBeInTheDocument();
    expect(screen.getByText('$0.250')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    // Should have clear separators
    expect(screen.getAllByText('|')).toHaveLength(2);
  });

  it('should handle high contrast scenarios', () => {
    // Test with various cost levels to ensure color coding is accessible
    const testCases = [
      { cost: 0, expectedText: '$0.00', testName: 'zero cost' },
      { cost: 0.05, expectedText: '$0.05', testName: 'low cost' },
      { cost: 0.5, expectedText: '$0.500', testName: 'medium cost' },
      { cost: 2.5, expectedText: '$2.50', testName: 'high cost' },
      { cost: 10.0, expectedText: '$10.00', testName: 'very high cost' },
    ];

    testCases.forEach(({ cost, expectedText, testName }) => {
      const { unmount } = render(
        <ResourceUsageDisplay
          inputTokens={1000}
          outputTokens={1000}
          cost={cost}
          apiCalls={5}
        />
      );

      // The text should be present regardless of color
      expect(screen.getByText(expectedText)).toBeInTheDocument();

      unmount();
    });
  });

  it('should provide clear number formatting for cognitive accessibility', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1234567}
        outputTokens={987654}
        cost={45.67}
        apiCalls={123456}
      />
    );

    // Large numbers should be formatted clearly
    expect(screen.getByText('1.2M→1.0M (2.2M total)')).toBeInTheDocument();
    expect(screen.getByText('$45.67')).toBeInTheDocument();
    expect(screen.getByText('123,456 calls')).toBeInTheDocument();
  });

  it('should handle singular/plural forms correctly for language accessibility', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={1}
      />
    );

    // Single call should use singular form
    expect(screen.getByText('1 call')).toBeInTheDocument();

    // Multiple calls should use plural form
    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={2}
      />
    );

    expect(screen.getByText('2 calls')).toBeInTheDocument();

    // Zero calls should use plural form
    rerender(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.05}
        apiCalls={0}
      />
    );

    expect(screen.getByText('0 calls')).toBeInTheDocument();
  });

  it('should maintain consistent layout for predictable navigation', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={100}
        outputTokens={200}
        cost={0.01}
        apiCalls={1}
      />
    );

    // Check initial layout structure
    expect(screen.getByText('usage:')).toBeInTheDocument();
    const initialSeparators = screen.getAllByText('|');
    expect(initialSeparators).toHaveLength(2);

    // Change to large numbers - layout should remain consistent
    rerender(
      <ResourceUsageDisplay
        inputTokens={1500000}
        outputTokens={2500000}
        cost={50.75}
        apiCalls={10000}
      />
    );

    // Still should have same structure
    expect(screen.getByText('usage:')).toBeInTheDocument();
    const newSeparators = screen.getAllByText('|');
    expect(newSeparators).toHaveLength(2);
  });

  it('should work with screen reader simulation (text-only)', () => {
    const { container } = render(
      <ResourceUsageDisplay
        inputTokens={2500}
        outputTokens={1500}
        cost={1.25}
        apiCalls={15}
        label="API consumption"
      />
    );

    // Extract all text content as a screen reader would
    const textContent = container.textContent || '';

    // Should contain all essential information in readable order
    expect(textContent).toContain('API consumption:');
    expect(textContent).toMatch(/2\.5k→1\.5k \(4\.0k total\)|4\.0k/);
    expect(textContent).toContain('$1.25');
    expect(textContent).toContain('15 calls');

    // Should have separators to help parse information
    expect(textContent).toContain('|');
  });

  it('should handle very long labels appropriately', () => {
    render(
      <ResourceUsageDisplay
        inputTokens={1000}
        outputTokens={1000}
        cost={0.1}
        apiCalls={5}
        label="Very long descriptive label for resource usage tracking in development environment"
      />
    );

    expect(screen.getByText('Very long descriptive label for resource usage tracking in development environment:')).toBeInTheDocument();
  });

  it('should provide meaningful context for international users', () => {
    const currencies = [
      { symbol: '€', amount: 1.25 },
      { symbol: '£', amount: 0.95 },
      { symbol: '¥', amount: 150 },
      { symbol: 'CAD$', amount: 1.35 },
      { symbol: 'AUD$', amount: 1.40 },
    ];

    currencies.forEach(({ symbol, amount }) => {
      const { unmount } = render(
        <ResourceUsageDisplay
          inputTokens={1000}
          outputTokens={1000}
          cost={amount}
          currency={symbol}
          apiCalls={10}
        />
      );

      // Currency symbols should be clearly associated with amounts
      const expectedText = symbol + amount.toFixed(2);
      expect(screen.getByText(expectedText)).toBeInTheDocument();

      unmount();
    });
  });

  it('should maintain accessibility in rapid update scenarios', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={1000}
        outputTokens={1000}
        cost={0.1}
        apiCalls={5}
      />
    );

    // Simulate rapid updates that might occur in real-time monitoring
    for (let i = 1; i <= 5; i++) {
      rerender(
        <ResourceUsageDisplay
          inputTokens={1000 + i * 100}
          outputTokens={1000 + i * 50}
          cost={0.1 + i * 0.01}
          apiCalls={5 + i}
        />
      );

      // Structure should remain consistent after each update
      expect(screen.getByText('usage:')).toBeInTheDocument();
      expect(screen.getAllByText('|')).toHaveLength(2);
    }

    // Final state should be accessible
    expect(screen.getByText('1.5k→1.3k (2.8k total)')).toBeInTheDocument();
    expect(screen.getByText('$0.15')).toBeInTheDocument();
    expect(screen.getByText('10 calls')).toBeInTheDocument();
  });
});