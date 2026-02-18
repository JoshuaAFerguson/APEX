/**
 * Edge case and comprehensive tests for ResourceLimitBar components
 * Tests complex scenarios, edge cases, and integration aspects
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ResourceLimitBar, CompactResourceLimitBar } from '../ResourceLimitBar.js';
import { ThemeProvider } from '../../../context/ThemeContext.js';

// Mock the ProgressBar component to avoid complex rendering logic in tests
vi.mock('../../ProgressIndicators.js', () => ({
  ProgressBar: ({ progress, color, width }: any) => (
    <span
      data-testid="progress-bar"
      data-progress={progress}
      data-color={color}
      data-width={width}
      data-progress-filled={Math.floor((progress / 100) * (width || 20))}
    >
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

describe('ResourceLimitBar Edge Cases', () => {
  describe('extreme values', () => {
    it('should handle zero current and limit values', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={0}
          limit={0}
          label="tokens"
        />
      );

      const output = lastFrame();
      expect(output).toContain('tokens:');
      expect(output).toContain('0/0');
      expect(output).not.toContain('⚠️'); // Zero should not show warning
    });

    it('should handle negative current values', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={-50}
          limit={100}
          label="tokens"
        />
      );

      const output = lastFrame();
      expect(output).toContain('-50/100');
    });

    it('should handle extremely large numbers', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={999999999}
          limit={1000000000}
          label="tokens"
        />
      );

      const output = lastFrame();
      expect(output).toContain('999,999,999/1,000,000,000');
    });

    it('should handle decimal values correctly', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={25.7}
          limit={100.3}
          label="cost"
        />
      );

      const output = lastFrame();
      expect(output).toContain('26/100'); // Default formatter should round
    });

    it('should handle current exactly at limit', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={100}
          limit={100}
          label="tokens"
        />
      );

      const output = lastFrame();
      expect(output).toContain('100/100');
      expect(output).not.toContain('⚠️'); // At limit but not exceeded
    });

    it('should handle current minimally over limit', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={100.001}
          limit={100}
          label="tokens"
        />
      );

      const output = lastFrame();
      expect(output).toContain('⚠️'); // Should show warning for any amount over
    });
  });

  describe('formatter edge cases', () => {
    it('should handle formatter that returns empty string', () => {
      const emptyFormatter = () => '';

      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label="tokens"
          formatter={emptyFormatter}
        />
      );

      const output = lastFrame();
      expect(output).toContain('/100'); // Should still show limit
    });

    it('should handle formatter that throws error', () => {
      const errorFormatter = () => {
        throw new Error('Formatter error');
      };

      // This should not crash the component
      expect(() => {
        renderWithTheme(
          <ResourceLimitBar
            current={50}
            limit={100}
            label="tokens"
            formatter={errorFormatter}
          />
        );
      }).toThrow(); // But it should propagate the error for debugging
    });

    it('should handle formatter that returns very long string', () => {
      const longFormatter = (value: number) => `${'x'.repeat(1000)}${value}${'y'.repeat(1000)}`;

      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label="tokens"
          formatter={longFormatter}
        />
      );

      const output = lastFrame();
      // Should still render properly despite long strings
      expect(output).toContain('tokens:');
    });

    it('should handle different formatter for current vs limit', () => {
      const currentFormatter = (value: number) => `${value}k`;
      const limitFormatter = (value: number) => `${value}M`;

      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={250}
          limit={5}
          label="tokens"
          formatter={currentFormatter}
          limitFormatter={limitFormatter}
        />
      );

      const output = lastFrame();
      expect(output).toContain('250k/5M');
    });
  });

  describe('width variations', () => {
    it('should handle very small width', () => {
      const { container } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label="tokens"
          width={1}
        />
      );

      const progressBar = container.querySelector('[data-testid="progress-bar"]');
      expect(progressBar).toHaveAttribute('data-width', '1');
    });

    it('should handle very large width', () => {
      const { container } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label="tokens"
          width={100}
        />
      );

      const progressBar = container.querySelector('[data-testid="progress-bar"]');
      expect(progressBar).toHaveAttribute('data-width', '100');
    });

    it('should handle zero width', () => {
      const { container } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label="tokens"
          width={0}
        />
      );

      const progressBar = container.querySelector('[data-testid="progress-bar"]');
      expect(progressBar).toHaveAttribute('data-width', '0');
    });
  });

  describe('percentage display edge cases', () => {
    it('should handle percentage display with extreme values', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={33}
          limit={100}
          label="tokens"
          showPercentage={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('(33%)');
    });

    it('should round percentage correctly', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={33.333}
          limit={100}
          label="tokens"
          showPercentage={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('(33%)'); // Should round to nearest integer
    });

    it('should handle percentage over 100', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={150}
          limit={100}
          label="tokens"
          showPercentage={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('(100%)'); // Should clamp at 100% for display
      expect(output).toContain('⚠️'); // But still show warning
    });
  });

  describe('label variations', () => {
    it('should handle empty label', () => {
      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label=""
        />
      );

      const output = lastFrame();
      expect(output).toContain(':'); // Should still show colon
    });

    it('should handle very long label', () => {
      const longLabel = 'this is a very long label that might cause layout issues';

      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label={longLabel}
        />
      );

      const output = lastFrame();
      expect(output).toContain(longLabel);
    });

    it('should handle label with special characters', () => {
      const specialLabel = 'tōkęns/sêc (αβγ) 💰';

      const { lastFrame } = renderWithTheme(
        <ResourceLimitBar
          current={50}
          limit={100}
          label={specialLabel}
        />
      );

      const output = lastFrame();
      expect(output).toContain(specialLabel);
    });
  });
});

describe('CompactResourceLimitBar Edge Cases', () => {
  describe('percentage calculations', () => {
    it('should handle percentage exactly at boundary', () => {
      const { lastFrame } = renderWithTheme(
        <CompactResourceLimitBar
          current={50}
          limit={100}
          label="tok"
        />
      );

      const output = lastFrame();
      expect(output).toContain('50%');
    });

    it('should round percentage correctly for display', () => {
      const { lastFrame } = renderWithTheme(
        <CompactResourceLimitBar
          current={33.7}
          limit={100}
          label="tok"
        />
      );

      const output = lastFrame();
      expect(output).toContain('34%'); // Should round to nearest integer
    });

    it('should handle very small percentages', () => {
      const { lastFrame } = renderWithTheme(
        <CompactResourceLimitBar
          current={0.1}
          limit={100}
          label="tok"
        />
      );

      const output = lastFrame();
      expect(output).toContain('0%'); // Should round down to 0
    });

    it('should show 100% when exactly at limit', () => {
      const { lastFrame } = renderWithTheme(
        <CompactResourceLimitBar
          current={100}
          limit={100}
          label="tok"
        />
      );

      const output = lastFrame();
      expect(output).toContain('100%');
      expect(output).not.toContain('⚠️'); // At limit but not exceeded
    });
  });

  describe('width constraints', () => {
    it('should respect minimum width', () => {
      const { container } = renderWithTheme(
        <CompactResourceLimitBar
          current={50}
          limit={100}
          label="tok"
          width={1}
        />
      );

      const progressBar = container.querySelector('[data-testid="progress-bar"]');
      expect(progressBar).toHaveAttribute('data-width', '1');
    });

    it('should handle large width in compact mode', () => {
      const { container } = renderWithTheme(
        <CompactResourceLimitBar
          current={50}
          limit={100}
          label="tok"
          width={50}
        />
      );

      const progressBar = container.querySelector('[data-testid="progress-bar"]');
      expect(progressBar).toHaveAttribute('data-width', '50');
    });
  });

  describe('formatter edge cases in compact mode', () => {
    it('should ignore custom formatter in percentage display', () => {
      const customFormatter = (value: number) => `${value}k`;

      const { lastFrame } = renderWithTheme(
        <CompactResourceLimitBar
          current={5000}
          limit={10000}
          label="tok"
          formatter={customFormatter}
        />
      );

      const output = lastFrame();
      // Should show percentage, not formatted value
      expect(output).toContain('50%');
      expect(output).not.toContain('5k');
    });

    it('should handle formatter that returns undefined', () => {
      const undefinedFormatter = () => undefined as any;

      const { lastFrame } = renderWithTheme(
        <CompactResourceLimitBar
          current={50}
          limit={100}
          label="tok"
          formatter={undefinedFormatter}
        />
      );

      const output = lastFrame();
      // Should still show percentage regardless of formatter
      expect(output).toContain('50%');
    });
  });
});

describe('Both Components Integration', () => {
  it('should handle rapid re-renders with changing values', () => {
    const { rerender, lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={10}
        limit={100}
        label="tokens"
      />
    );

    // Rapid value changes
    for (let i = 20; i <= 100; i += 10) {
      rerender(
        <ThemeProvider defaultTheme="dark">
          <ResourceLimitBar
            current={i}
            limit={100}
            label="tokens"
          />
        </ThemeProvider>
      );
    }

    const output = lastFrame();
    expect(output).toContain('100/100');
  });

  it('should maintain consistent behavior between standard and compact modes', () => {
    const props = {
      current: 75,
      limit: 100,
      label: 'tokens'
    };

    const { lastFrame: standardFrame } = renderWithTheme(
      <ResourceLimitBar {...props} />
    );

    const { lastFrame: compactFrame } = renderWithTheme(
      <CompactResourceLimitBar {...props} />
    );

    const standardOutput = standardFrame();
    const compactOutput = compactFrame();

    // Both should handle the same data consistently
    expect(standardOutput).toContain('75/100');
    expect(compactOutput).toContain('75%');

    // Neither should show warning at 75% (under 80% threshold)
    expect(standardOutput).not.toContain('⚠️');
    expect(compactOutput).not.toContain('⚠️');
  });

  it('should handle theme changes gracefully', () => {
    const { rerender, lastFrame } = renderWithTheme(
      <ResourceLimitBar
        current={90}
        limit={100}
        label="tokens"
      />
    );

    // Switch theme
    rerender(
      <ThemeProvider defaultTheme="light">
        <ResourceLimitBar
          current={90}
          limit={100}
          label="tokens"
        />
      </ThemeProvider>
    );

    const output = lastFrame();
    expect(output).toContain('90/100'); // Should still render correctly
  });
});