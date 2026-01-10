/**
 * Unit tests for ResourceLimitBar components
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { ResourceLimitBar, CompactResourceLimitBar } from '../ResourceLimitBar.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';

// Mock the ProgressBar component to avoid complex rendering logic in tests
jest.mock('../../ProgressIndicators.js', () => ({
  ProgressBar: ({ progress, color, width }: any) => (
    <span data-testid="progress-bar" data-progress={progress} data-color={color} data-width={width}>
      {'█'.repeat(Math.floor((progress / 100) * (width || 20)))}
      {'░'.repeat((width || 20) - Math.floor((progress / 100) * (width || 20)))}
    </span>
  ),
}));

function renderWithTheme(component: React.ReactElement) {
  return render(
    <ThemeProvider defaultTheme="dark">
      {component}
    </ThemeProvider>
  );
}

describe('ResourceLimitBar', () => {
  it('should render current usage vs limit', () => {
    const { lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={250}
        limit={500}
        label="tokens"
      />
    );

    const output = lastFrame();
    expect(output).toContain('tokens:');
    expect(output).toContain('250/500');
  });

  it('should show warning indicator when limit is exceeded', () => {
    const { lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={600}
        limit={500}
        label="tokens"
      />
    );

    const output = lastFrame();
    expect(output).toContain('⚠️');
    expect(output).toContain('600/500');
  });

  it('should use custom formatters when provided', () => {
    const formatter = (value: number) => `${value}k`;
    const limitFormatter = (value: number) => `${value}M`;

    const { lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={250}
        limit={500}
        label="tokens"
        formatter={formatter}
        limitFormatter={limitFormatter}
      />
    );

    const output = lastFrame();
    expect(output).toContain('250k/500M');
  });

  it('should show percentage when enabled', () => {
    const { lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={250}
        limit={500}
        label="tokens"
        showPercentage={true}
      />
    );

    const output = lastFrame();
    expect(output).toContain('(50%)');
  });

  it('should use default formatter for numeric values', () => {
    const { lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={2500}
        limit={5000}
        label="calls"
      />
    );

    const output = lastFrame();
    expect(output).toContain('2,500/5,000'); // Locale formatting
  });
});

describe('CompactResourceLimitBar', () => {
  it('should render compact layout with percentage', () => {
    const { lastFrame } = renderWithTheme(
      <CompactResourceLimitBar
        current={250}
        limit={500}
        label="tok"
      />
    );

    const output = lastFrame();
    expect(output).toContain('tok:');
    expect(output).toContain('50%');
  });

  it('should show warning indicator when limit is exceeded', () => {
    const { lastFrame } = renderWithTheme(
      <CompactResourceLimitBar
        current={600}
        limit={500}
        label="tok"
      />
    );

    const output = lastFrame();
    expect(output).toContain('⚠️');
    expect(output).toContain('120%'); // 600/500 * 100
  });

  it('should use custom formatter when provided', () => {
    const formatter = (value: number) => `${value}k`;

    const { lastFrame } = renderWithTheme(
      <CompactResourceLimitBar
        current={250}
        limit={500}
        label="tok"
        formatter={formatter}
      />
    );

    // Percentage should still be shown, not the formatted value
    const output = lastFrame();
    expect(output).toContain('50%');
  });

  it('should use specified width for progress bar', () => {
    const { container } = renderWithTheme(
      <CompactResourceLimitBar
        current={250}
        limit={500}
        label="tok"
        width={15}
      />
    );

    const progressBar = container.querySelector('[data-testid="progress-bar"]');
    expect(progressBar).toHaveAttribute('data-width', '15');
  });
});