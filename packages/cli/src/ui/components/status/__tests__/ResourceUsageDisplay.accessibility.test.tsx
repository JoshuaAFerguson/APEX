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

// Mock ResourceLimitBar components with accessibility considerations
vi.mock('../ResourceLimitBar.js', () => ({
  ResourceLimitBar: ({ current, limit, label }: any) => {
    const percentage = limit > 0 ? (current / limit) * 100 : 0;
    const isExceeded = current > limit;
    const level = percentage < 50 ? 'safe' : percentage < 80 ? 'warning' : 'danger';

    // Provide screen reader friendly content
    const ariaLabel = `${label} usage: ${current} of ${limit} (${Math.round(percentage)}%)`;
    const statusMessage = isExceeded ? 'Warning: Limit exceeded' :
                          level === 'danger' ? 'Alert: Near limit' :
                          level === 'warning' ? 'Caution: Approaching limit' : 'Normal usage';

    return (
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-describedby={`${label}-status`}
        data-testid="accessible-limit-bar"
        data-level={level}
        data-exceeded={isExceeded}
      >
        <span id={`${label}-status`} className="sr-only">{statusMessage}</span>
        <span aria-hidden="true">{label}: {current}/{limit}</span>
        {isExceeded && (
          <span role="alert" aria-label="Limit exceeded warning">⚠️</span>
        )}
      </div>
    );
  },
  CompactResourceLimitBar: ({ current, limit, label }: any) => {
    const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
    const isExceeded = current > limit;
    const level = percentage < 50 ? 'safe' : percentage < 80 ? 'warning' : 'danger';

    const ariaLabel = `${label} usage: ${percentage}% of limit`;
    const statusMessage = isExceeded ? 'Exceeded' :
                          level === 'danger' ? 'Critical' :
                          level === 'warning' ? 'High' : 'Normal';

    return (
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-describedby={`${label}-compact-status`}
        data-testid="accessible-compact-limit-bar"
        data-level={level}
      >
        <span id={`${label}-compact-status`} className="sr-only">{statusMessage} usage level</span>
        <span aria-hidden="true">{label}: {percentage}%</span>
        {isExceeded && (
          <span role="alert" aria-label="Limit exceeded warning">⚠️</span>
        )}
      </div>
    );
  },
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

  describe('Limit Indicators Accessibility', () => {
    it('should provide accessible limit indicator progress bars', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={500}
          outputTokens={300}
          cost={2.5}
          apiCalls={8}
          limits={{
            maxTokens: 1000,
            maxCost: 5.0,
            maxApiCalls: 10,
          }}
        />
      );

      // Should have progress bars with proper ARIA attributes
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3);

      // Each progress bar should have proper accessibility attributes
      progressBars.forEach(progressBar => {
        expect(progressBar).toHaveAttribute('aria-label');
        expect(progressBar).toHaveAttribute('aria-valuenow');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax');
        expect(progressBar).toHaveAttribute('aria-describedby');
      });
    });

    it('should provide meaningful status messages for screen readers', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={450}
          outputTokens={50}
          cost={7.5}
          apiCalls={12}
          limits={{
            maxTokens: 1000,    // 50% - warning
            maxCost: 10.0,      // 75% - warning
            maxApiCalls: 10,    // 120% - exceeded
          }}
        />
      );

      // Check for status descriptions for screen readers
      expect(screen.getByText('Caution: Approaching limit')).toBeInTheDocument(); // tokens
      expect(screen.getByText('Caution: Approaching limit')).toBeInTheDocument(); // cost
      expect(screen.getByText('Warning: Limit exceeded')).toBeInTheDocument(); // API calls
    });

    it('should provide accessible warning alerts for exceeded limits', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={600}
          outputTokens={600}
          cost={6.0}
          apiCalls={15}
          limits={{
            maxTokens: 1000,    // 120% - exceeded
            maxCost: 5.0,       // 120% - exceeded
            maxApiCalls: 10,    // 150% - exceeded
          }}
        />
      );

      // Warning indicators should be alerts for screen readers
      const warningAlerts = screen.getAllByRole('alert');
      expect(warningAlerts).toHaveLength(3);

      // Each alert should have proper labeling
      warningAlerts.forEach(alert => {
        expect(alert).toHaveAttribute('aria-label', 'Limit exceeded warning');
        expect(alert).toHaveTextContent('⚠️');
      });
    });

    it('should maintain accessibility in compact mode with limits', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={400}
          outputTokens={100}
          cost={4.0}
          apiCalls={8}
          compact={true}
          limits={{
            maxTokens: 1000,    // 50% - warning
            maxCost: 5.0,       // 80% - danger
            maxApiCalls: 10,    // 80% - danger
          }}
        />
      );

      // Should have compact progress bars with proper accessibility
      const compactBars = screen.getAllByTestId('accessible-compact-limit-bar');
      expect(compactBars).toHaveLength(3);

      // Each should be a proper progressbar with percentage values
      compactBars.forEach(bar => {
        expect(bar).toHaveAttribute('role', 'progressbar');
        expect(bar).toHaveAttribute('aria-label');
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
      });

      // Check specific percentage labels for screen readers
      const tokenBar = compactBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('tokens usage')
      );
      expect(tokenBar).toHaveAttribute('aria-label', 'tokens usage: 50% of limit');

      const costBar = compactBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('cost usage')
      );
      expect(costBar).toHaveAttribute('aria-label', 'cost usage: 80% of limit');
    });

    it('should not rely solely on color for status indication', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={400}
          outputTokens={500}
          cost={4.5}
          apiCalls={9}
          limits={{
            maxTokens: 1000,    // 90% - danger
            maxCost: 5.0,       // 90% - danger
            maxApiCalls: 10,    // 90% - danger
          }}
        />
      );

      // Status should be conveyed through text, not just color
      const progressBars = screen.getAllByTestId('accessible-limit-bar');

      progressBars.forEach(bar => {
        expect(bar).toHaveAttribute('data-level', 'danger');
        // Should have text-based status indication
        expect(bar.querySelector('[id$="-status"]')).toBeInTheDocument();
      });

      // Text-based status should be present for screen readers
      expect(screen.getAllByText('Alert: Near limit')).toHaveLength(3);
    });

    it('should provide meaningful ARIA labels for different resource types', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={750}
          outputTokens={250}
          cost={4.0}
          apiCalls={12}
          limits={{
            maxTokens: 1000,
            maxCost: 5.0,
            maxApiCalls: 10,
          }}
        />
      );

      const progressBars = screen.getAllByRole('progressbar');

      // Find specific progress bars by their aria-label content
      const tokenBar = progressBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('tokens usage')
      );
      expect(tokenBar).toHaveAttribute('aria-label', 'tokens usage: 1000 of 1000 (100%)');

      const costBar = progressBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('cost usage')
      );
      expect(costBar).toHaveAttribute('aria-label', 'cost usage: 4 of 5 (80%)');

      const apiBar = progressBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('calls usage')
      );
      expect(apiBar).toHaveAttribute('aria-label', 'calls usage: 12 of 10 (120%)');
    });

    it('should handle dynamic content changes accessibly', () => {
      const { rerender } = render(
        <ResourceUsageDisplay
          inputTokens={300}
          outputTokens={200}
          cost={1.0}
          apiCalls={3}
          limits={{
            maxTokens: 1000,
            maxCost: 5.0,
            maxApiCalls: 10,
          }}
        />
      );

      // Initial state - all safe
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getAllByText('Normal usage')).toHaveLength(3);

      // Update to exceeded state
      rerender(
        <ResourceUsageDisplay
          inputTokens={600}
          outputTokens={600}
          cost={6.0}
          apiCalls={12}
          limits={{
            maxTokens: 1000,
            maxCost: 5.0,
            maxApiCalls: 10,
          }}
        />
      );

      // Should now have alerts for exceeded limits
      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(3);

      // Alerts should be properly labeled
      alerts.forEach(alert => {
        expect(alert).toHaveAttribute('aria-label', 'Limit exceeded warning');
      });

      // Status messages should update
      expect(screen.getAllByText('Warning: Limit exceeded')).toHaveLength(3);
    });

    it('should handle partial limits configuration accessibly', () => {
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

      // Should only have one accessible progress bar
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(1);

      // Should be properly labeled
      expect(progressBars[0]).toHaveAttribute('aria-label', 'tokens usage: 500 of 1000 (50%)');
    });

    it('should provide accessible daily budget vs cost differentiation', () => {
      render(
        <ResourceUsageDisplay
          inputTokens={300}
          outputTokens={200}
          cost={4.0}
          apiCalls={9}
          limits={{
            maxCost: 5.0,        // Per-task cost limit
            dailyBudget: 100.0,  // Daily budget limit
          }}
        />
      );

      // Should have two progress bars with different labels
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);

      const costBar = progressBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('cost usage')
      );
      const budgetBar = progressBars.find(bar =>
        bar.getAttribute('aria-label')?.includes('daily budget usage')
      );

      expect(costBar).toHaveAttribute('aria-label', 'cost usage: 4 of 5 (80%)');
      expect(budgetBar).toHaveAttribute('aria-label', 'daily budget usage: 4 of 100 (4%)');
    });

    it('should maintain accessibility with no limit indicators shown', () => {
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

      // Should not have any progress bars when indicators are disabled
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      // Basic usage information should still be accessible
      expect(screen.getByText('usage:')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('should handle screen reader navigation flow', () => {
      const { container } = render(
        <ResourceUsageDisplay
          inputTokens={500}
          outputTokens={300}
          cost={3.0}
          apiCalls={7}
          limits={{
            maxTokens: 1000,
            maxCost: 5.0,
            maxApiCalls: 10,
          }}
        />
      );

      // Extract text content as a screen reader would encounter it
      const textContent = container.textContent || '';

      // Should contain main usage info first
      expect(textContent).toContain('usage:');
      expect(textContent).toContain('800'); // Total tokens
      expect(textContent).toContain('$3.00');
      expect(textContent).toContain('7 calls');

      // Should contain accessible status information
      expect(textContent).toContain('Caution: Approaching limit'); // For warning levels
      expect(textContent).toContain('Normal usage'); // For safe levels
    });
  });
});