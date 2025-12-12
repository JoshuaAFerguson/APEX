import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TokenCounter } from '../TokenCounter';

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

describe('TokenCounter', () => {
  it('should render token counter with default label', () => {
    render(
      <TokenCounter
        inputTokens={100}
        outputTokens={200}
      />
    );

    expect(screen.getByText('tokens:')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('should render custom label', () => {
    render(
      <TokenCounter
        inputTokens={100}
        outputTokens={200}
        label="API tokens"
      />
    );

    expect(screen.getByText('API tokens:')).toBeInTheDocument();
  });

  it('should format small numbers without units', () => {
    render(
      <TokenCounter
        inputTokens={50}
        outputTokens={150}
      />
    );

    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('should format thousands with k suffix', () => {
    render(
      <TokenCounter
        inputTokens={1500}
        outputTokens={2500}
      />
    );

    expect(screen.getByText('4.0k')).toBeInTheDocument();
  });

  it('should format millions with M suffix', () => {
    render(
      <TokenCounter
        inputTokens={1500000}
        outputTokens={2500000}
      />
    );

    expect(screen.getByText('4.0M')).toBeInTheDocument();
  });

  it('should show breakdown for large totals', () => {
    render(
      <TokenCounter
        inputTokens={1200}
        outputTokens={800}
      />
    );

    // For totals > 1000, should show input→output format
    expect(screen.getByText('1.2k→0.8k')).toBeInTheDocument();
  });

  it('should not show breakdown for small totals', () => {
    render(
      <TokenCounter
        inputTokens={300}
        outputTokens={400}
      />
    );

    // For totals ≤ 1000, should show total only
    expect(screen.getByText('700')).toBeInTheDocument();
    expect(screen.queryByText('300→400')).not.toBeInTheDocument();
  });

  it('should handle zero tokens', () => {
    render(
      <TokenCounter
        inputTokens={0}
        outputTokens={0}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle zero input tokens', () => {
    render(
      <TokenCounter
        inputTokens={0}
        outputTokens={500}
      />
    );

    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('should handle zero output tokens', () => {
    render(
      <TokenCounter
        inputTokens={500}
        outputTokens={0}
      />
    );

    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('should handle exact thousand boundary', () => {
    render(
      <TokenCounter
        inputTokens={500}
        outputTokens={500}
      />
    );

    // Exactly 1000 should show breakdown
    expect(screen.getByText('0.5k→0.5k')).toBeInTheDocument();
  });

  it('should handle exact million boundary', () => {
    render(
      <TokenCounter
        inputTokens={500000}
        outputTokens={500000}
      />
    );

    // Exactly 1 million
    expect(screen.getByText('0.5M→0.5M')).toBeInTheDocument();
  });

  it('should format decimals correctly for k suffix', () => {
    render(
      <TokenCounter
        inputTokens={1234}
        outputTokens={5678}
      />
    );

    expect(screen.getByText('1.2k→5.7k')).toBeInTheDocument();
  });

  it('should format decimals correctly for M suffix', () => {
    render(
      <TokenCounter
        inputTokens={1234567}
        outputTokens={2345678}
      />
    );

    expect(screen.getByText('1.2M→2.3M')).toBeInTheDocument();
  });
});