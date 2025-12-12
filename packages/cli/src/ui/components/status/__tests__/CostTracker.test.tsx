import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CostTracker } from '../CostTracker';

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

describe('CostTracker', () => {
  it('should render cost tracker with default label and currency', () => {
    render(
      <CostTracker cost={1.50} />
    );

    expect(screen.getByText('cost:')).toBeInTheDocument();
    expect(screen.getByText('$1.50')).toBeInTheDocument();
  });

  it('should render custom label', () => {
    render(
      <CostTracker
        cost={1.50}
        label="API cost"
      />
    );

    expect(screen.getByText('API cost:')).toBeInTheDocument();
  });

  it('should render custom currency', () => {
    render(
      <CostTracker
        cost={1.50}
        currency="€"
      />
    );

    expect(screen.getByText('€1.50')).toBeInTheDocument();
  });

  it('should format zero cost correctly', () => {
    render(
      <CostTracker cost={0} />
    );

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('should format very small costs with more precision', () => {
    render(
      <CostTracker cost={0.0012} />
    );

    expect(screen.getByText('$0.0012')).toBeInTheDocument();
  });

  it('should format small costs with three decimal places', () => {
    render(
      <CostTracker cost={0.056} />
    );

    expect(screen.getByText('$0.056')).toBeInTheDocument();
  });

  it('should format regular costs with two decimal places', () => {
    render(
      <CostTracker cost={2.5} />
    );

    expect(screen.getByText('$2.50')).toBeInTheDocument();
  });

  it('should handle session cost when provided', () => {
    render(
      <CostTracker
        cost={5.00}
        sessionCost={2.50}
      />
    );

    // Should display sessionCost first
    expect(screen.getByText('$2.50')).toBeInTheDocument();
  });

  it('should show both session cost and total cost when different', () => {
    render(
      <CostTracker
        cost={5.00}
        sessionCost={2.50}
      />
    );

    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
  });

  it('should not show total cost when same as session cost', () => {
    render(
      <CostTracker
        cost={2.50}
        sessionCost={2.50}
      />
    );

    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.queryByText('/')).not.toBeInTheDocument();
    // Should only show one instance of $2.50
    const costTexts = screen.getAllByText('$2.50');
    expect(costTexts).toHaveLength(1);
  });

  it('should handle edge case of exactly 0.01', () => {
    render(
      <CostTracker cost={0.01} />
    );

    expect(screen.getByText('$0.010')).toBeInTheDocument();
  });

  it('should handle edge case just below 0.01', () => {
    render(
      <CostTracker cost={0.009} />
    );

    expect(screen.getByText('$0.0090')).toBeInTheDocument();
  });

  it('should handle edge case of exactly 1.00', () => {
    render(
      <CostTracker cost={1.00} />
    );

    expect(screen.getByText('$1.00')).toBeInTheDocument();
  });

  it('should handle edge case just below 1.00', () => {
    render(
      <CostTracker cost={0.999} />
    );

    expect(screen.getByText('$0.999')).toBeInTheDocument();
  });

  it('should handle large costs', () => {
    render(
      <CostTracker cost={123.456} />
    );

    expect(screen.getByText('$123.46')).toBeInTheDocument();
  });

  it('should handle negative costs (edge case)', () => {
    render(
      <CostTracker cost={-1.50} />
    );

    expect(screen.getByText('-$1.50')).toBeInTheDocument();
  });

  it('should handle very small negative costs', () => {
    render(
      <CostTracker cost={-0.001} />
    );

    expect(screen.getByText('-$0.0010')).toBeInTheDocument();
  });

  it('should use correct precision boundaries', () => {
    const testCases = [
      { cost: 0, expected: '$0.00' },
      { cost: 0.005, expected: '$0.0050' },
      { cost: 0.01, expected: '$0.010' },
      { cost: 0.1, expected: '$0.100' },
      { cost: 1, expected: '$1.00' },
      { cost: 10.555, expected: '$10.56' },
    ];

    testCases.forEach(({ cost, expected }) => {
      const { unmount } = render(<CostTracker cost={cost} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });
});