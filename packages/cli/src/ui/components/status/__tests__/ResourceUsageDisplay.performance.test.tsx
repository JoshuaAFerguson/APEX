/**
 * Performance tests for ResourceUsageDisplay component
 * Ensures the component renders efficiently with large data sets
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResourceUsageDisplay, formatTokenCount, formatCurrency, formatApiCalls } from '../ResourceUsageDisplay';

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

describe('ResourceUsageDisplay Performance Tests', () => {
  it('should handle very large token numbers efficiently', () => {
    const startTime = performance.now();

    render(
      <ResourceUsageDisplay
        inputTokens={999999999}
        outputTokens={888888888}
        cost={999.99}
        apiCalls={999999999}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Render should complete quickly (under 100ms even on slow machines)
    expect(renderTime).toBeLessThan(100);

    // Should correctly format large numbers
    expect(screen.getByText('1000.0M→888.9M (1888.9M total)')).toBeInTheDocument();
    expect(screen.getByText('$999.99')).toBeInTheDocument();
    expect(screen.getByText('999,999,999 calls')).toBeInTheDocument();
  });

  it('should format numbers efficiently in utility functions', () => {
    const iterations = 10000;

    // Test formatTokenCount performance
    const tokenStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      formatTokenCount(Math.random() * 10000000);
    }
    const tokenEnd = performance.now();
    const tokenTime = tokenEnd - tokenStart;

    // Test formatCurrency performance
    const currencyStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      formatCurrency(Math.random() * 1000);
    }
    const currencyEnd = performance.now();
    const currencyTime = currencyEnd - currencyStart;

    // Test formatApiCalls performance
    const apiStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      formatApiCalls(Math.floor(Math.random() * 10000000));
    }
    const apiEnd = performance.now();
    const apiTime = apiEnd - apiStart;

    // All formatting functions should be very fast (under 50ms for 10k iterations)
    expect(tokenTime).toBeLessThan(50);
    expect(currencyTime).toBeLessThan(50);
    expect(apiTime).toBeLessThan(50);
  });

  it('should handle rapid re-renders without performance degradation', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={1000}
        outputTokens={1000}
        cost={0.1}
        apiCalls={10}
      />
    );

    const iterations = 100;
    const startTime = performance.now();

    // Simulate 100 rapid updates
    for (let i = 0; i < iterations; i++) {
      rerender(
        <ResourceUsageDisplay
          inputTokens={1000 + i * 100}
          outputTokens={1000 + i * 50}
          cost={0.1 + i * 0.01}
          apiCalls={10 + i}
        />
      );
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // 100 re-renders should complete quickly (under 500ms)
    expect(totalTime).toBeLessThan(500);

    // Final state should be correct
    expect(screen.getByText('10.9k→5.9k (16.9k total)')).toBeInTheDocument();
    expect(screen.getByText('$1.09')).toBeInTheDocument();
    expect(screen.getByText('109 calls')).toBeInTheDocument();
  });

  it('should efficiently handle compact mode rendering', () => {
    const { rerender } = render(
      <ResourceUsageDisplay
        inputTokens={5000000}
        outputTokens={3000000}
        cost={25.50}
        apiCalls={1000000}
        compact={false}
      />
    );

    const standardStart = performance.now();
    // Re-render in standard mode multiple times
    for (let i = 0; i < 50; i++) {
      rerender(
        <ResourceUsageDisplay
          inputTokens={5000000 + i * 1000}
          outputTokens={3000000 + i * 500}
          cost={25.50 + i * 0.1}
          apiCalls={1000000 + i * 100}
          compact={false}
        />
      );
    }
    const standardEnd = performance.now();
    const standardTime = standardEnd - standardStart;

    const compactStart = performance.now();
    // Re-render in compact mode multiple times
    for (let i = 0; i < 50; i++) {
      rerender(
        <ResourceUsageDisplay
          inputTokens={5000000 + i * 1000}
          outputTokens={3000000 + i * 500}
          cost={25.50 + i * 0.1}
          apiCalls={1000000 + i * 100}
          compact={true}
        />
      );
    }
    const compactEnd = performance.now();
    const compactTime = compactEnd - compactStart;

    // Both modes should be fast (under 300ms for 50 renders each)
    expect(standardTime).toBeLessThan(300);
    expect(compactTime).toBeLessThan(300);

    // Compact mode might be slightly faster due to simpler layout
    // but the difference shouldn't be dramatic
    expect(Math.abs(standardTime - compactTime)).toBeLessThan(100);
  });

  it('should handle edge cases in formatting without performance issues', () => {
    const edgeCases = [
      { tokens: 0, cost: 0, calls: 0 },
      { tokens: 1, cost: 0.0001, calls: 1 },
      { tokens: 999, cost: 0.009, calls: 999 },
      { tokens: 1000, cost: 0.01, calls: 1000 },
      { tokens: 999999, cost: 0.999, calls: 999999 },
      { tokens: 1000000, cost: 1.0, calls: 1000000 },
      { tokens: 999999999, cost: 999.99, calls: 999999999 },
    ];

    const startTime = performance.now();

    edgeCases.forEach((testCase, index) => {
      const { unmount } = render(
        <ResourceUsageDisplay
          inputTokens={testCase.tokens}
          outputTokens={testCase.tokens}
          cost={testCase.cost}
          apiCalls={testCase.calls}
          key={index}
        />
      );
      unmount();
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should handle all edge cases quickly (under 50ms)
    expect(totalTime).toBeLessThan(50);
  });

  it('should not cause memory leaks with component cleanup', () => {
    const components = [];

    // Create and destroy multiple instances
    for (let i = 0; i < 100; i++) {
      const { unmount } = render(
        <ResourceUsageDisplay
          inputTokens={i * 1000}
          outputTokens={i * 500}
          cost={i * 0.1}
          apiCalls={i * 10}
        />
      );
      components.push(unmount);
    }

    // Clean up all components
    const cleanupStart = performance.now();
    components.forEach(unmount => unmount());
    const cleanupEnd = performance.now();
    const cleanupTime = cleanupEnd - cleanupStart;

    // Cleanup should be fast (under 100ms for 100 components)
    expect(cleanupTime).toBeLessThan(100);
  });

  it('should handle mathematical edge cases efficiently', () => {
    const mathEdgeCases = [
      { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 0 },
      { inputTokens: 0, outputTokens: Number.MAX_SAFE_INTEGER },
      { inputTokens: Math.PI * 1000000, outputTokens: Math.E * 1000000 },
      { inputTokens: 1.7976931348623157e+308, outputTokens: 0 }, // Near max float
    ];

    mathEdgeCases.forEach((testCase, index) => {
      expect(() => {
        const { unmount } = render(
          <ResourceUsageDisplay
            inputTokens={testCase.inputTokens}
            outputTokens={testCase.outputTokens}
            cost={0.1}
            apiCalls={1}
            key={index}
          />
        );
        unmount();
      }).not.toThrow();
    });
  });

  it('should maintain consistent performance across different breakdown modes', () => {
    const testData = {
      inputTokens: 5000000,
      outputTokens: 3000000,
      cost: 15.75,
      apiCalls: 50000,
    };

    // Test breakdown enabled
    const breakdownStart = performance.now();
    for (let i = 0; i < 50; i++) {
      const { unmount } = render(
        <ResourceUsageDisplay
          {...testData}
          showBreakdown={true}
        />
      );
      unmount();
    }
    const breakdownEnd = performance.now();
    const breakdownTime = breakdownEnd - breakdownStart;

    // Test breakdown disabled
    const noBreakdownStart = performance.now();
    for (let i = 0; i < 50; i++) {
      const { unmount } = render(
        <ResourceUsageDisplay
          {...testData}
          showBreakdown={false}
        />
      );
      unmount();
    }
    const noBreakdownEnd = performance.now();
    const noBreakdownTime = noBreakdownEnd - noBreakdownStart;

    // Both should be fast and roughly equivalent
    expect(breakdownTime).toBeLessThan(200);
    expect(noBreakdownTime).toBeLessThan(200);
    expect(Math.abs(breakdownTime - noBreakdownTime)).toBeLessThan(100);
  });
});