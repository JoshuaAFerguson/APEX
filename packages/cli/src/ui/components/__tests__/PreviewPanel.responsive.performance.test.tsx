import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

describe('PreviewPanel - Responsive Performance Tests', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const baseProps: PreviewPanelProps = {
    input: 'Performance test input',
    intent: {
      type: 'task',
      confidence: 0.85,
    },
    workflow: 'feature',
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
  };

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();
    // Enable fake timers for performance testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Rendering performance', () => {
    it('renders quickly with initial props', () => {
      const startTime = performance.now();

      render(<PreviewPanel {...baseProps} width={120} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // Rendering should be fast (under 50ms in test environment)
      expect(renderTime).toBeLessThan(50);
    });

    it('handles rapid width changes efficiently', () => {
      const widths = [50, 80, 120, 180, 60, 100, 40, 200, 150, 90];
      const { rerender } = render(<PreviewPanel {...baseProps} width={widths[0]} />);

      const startTime = performance.now();

      // Rapidly change widths
      widths.slice(1).forEach((width) => {
        rerender(<PreviewPanel {...baseProps} width={width} />);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // All re-renders should complete quickly (under 200ms for 9 re-renders)
      expect(totalTime).toBeLessThan(200);
    });

    it('handles breakpoint boundary transitions efficiently', () => {
      const boundaryWidths = [59, 60, 99, 100, 159, 160]; // Around breakpoint boundaries
      const { rerender } = render(<PreviewPanel {...baseProps} width={boundaryWidths[0]} />);

      const timings: number[] = [];

      boundaryWidths.slice(1).forEach((width) => {
        const start = performance.now();
        rerender(<PreviewPanel {...baseProps} width={width} />);
        const end = performance.now();
        timings.push(end - start);
      });

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // Each boundary transition should be fast
      timings.forEach((timing) => {
        expect(timing).toBeLessThan(20);
      });
    });
  });

  describe('Memory performance', () => {
    it('handles multiple re-renders without memory accumulation', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} width={120} />);

      // Track if component handles many re-renders without errors
      const iterations = 100;

      act(() => {
        for (let i = 0; i < iterations; i++) {
          rerender(<PreviewPanel {...baseProps} width={100 + (i % 60)} />);
        }
      });

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // Should complete without throwing or hanging
    });

    it('properly cleans up on unmount', () => {
      const { unmount } = render(<PreviewPanel {...baseProps} width={120} />);

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles rapid mount/unmount cycles', () => {
      const cycles = 10;

      for (let i = 0; i < cycles; i++) {
        const { unmount } = render(<PreviewPanel {...baseProps} width={120 + i} />);
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        unmount();
      }

      // Should complete all cycles without errors
    });
  });

  describe('Configuration memoization performance', () => {
    it('efficiently handles same breakpoint with different widths', () => {
      // Both widths are in 'normal' range (100-159)
      const normalWidths = [100, 110, 120, 130, 140, 150, 159];
      const { rerender } = render(<PreviewPanel {...baseProps} width={normalWidths[0]} />);

      const startTime = performance.now();

      normalWidths.slice(1).forEach((width) => {
        rerender(<PreviewPanel {...baseProps} width={width} />);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();

      // Should be fast since configuration doesn't change
      expect(totalTime).toBeLessThan(100);
    });

    it('efficiently handles configuration object generation', () => {
      const iterations = 50;
      const { rerender } = render(<PreviewPanel {...baseProps} width={120} />);

      const startTime = performance.now();

      // Re-render many times to test memoization
      for (let i = 0; i < iterations; i++) {
        rerender(<PreviewPanel {...baseProps} width={120} />);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // Average render time should be very fast due to memoization
      expect(averageTime).toBeLessThan(5);
    });
  });

  describe('Text processing performance', () => {
    it('efficiently handles very long input text', () => {
      const longInput = 'A'.repeat(10000); // Very long input

      const startTime = performance.now();

      render(<PreviewPanel {...baseProps} input={longInput} width={50} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should truncate and display quickly
      expect(screen.getByText(/^"A+\.\.\."/)).toBeInTheDocument();
      expect(renderTime).toBeLessThan(100);
    });

    it('efficiently handles complex unicode input', () => {
      const unicodeInput = '🚀'.repeat(1000) + '🎯'.repeat(1000) + '💻'.repeat(1000);

      const startTime = performance.now();

      render(<PreviewPanel {...baseProps} input={unicodeInput} width={50} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(screen.getByText(/^"🚀+.+\.\.\."/)).toBeInTheDocument();
      expect(renderTime).toBeLessThan(150); // Unicode might be slightly slower
    });

    it('efficiently handles action description formatting', () => {
      const complexIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'very-long-command-name'.repeat(10),
        args: Array.from({ length: 50 }, (_, i) => `arg-${i}-with-very-long-name`),
      };

      const startTime = performance.now();

      render(<PreviewPanel {...baseProps} intent={complexIntent} width={50} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('Responsive layout calculation performance', () => {
    it('efficiently calculates breakpoints for many width values', () => {
      const testWidths = Array.from({ length: 200 }, (_, i) => i + 1); // 1-200
      const { rerender } = render(<PreviewPanel {...baseProps} width={testWidths[0]} />);

      const startTime = performance.now();

      testWidths.slice(1).forEach((width) => {
        rerender(<PreviewPanel {...baseProps} width={width} />);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // Should handle all width calculations efficiently
      expect(totalTime).toBeLessThan(500);
    });

    it('handles extreme width values efficiently', () => {
      const extremeWidths = [1, 10000, 0.5, 999999, -10, Number.MAX_SAFE_INTEGER];
      const { rerender } = render(<PreviewPanel {...baseProps} width={100} />);

      extremeWidths.forEach((width) => {
        const startTime = performance.now();
        rerender(<PreviewPanel {...baseProps} width={width} />);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(50);
      });

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });
  });

  describe('Component composition performance', () => {
    it('efficiently handles complex props combinations', () => {
      const complexProps: PreviewPanelProps[] = Array.from({ length: 20 }, (_, i) => ({
        ...baseProps,
        input: `Complex input ${i} with special characters: 🚀💻${JSON.stringify({ test: i })}`,
        intent: {
          type: ['task', 'command', 'question', 'clarification'][i % 4] as any,
          confidence: (i % 100) / 100,
          command: i % 2 === 0 ? `command-${i}` : undefined,
          args: i % 2 === 0 ? Array.from({ length: i % 10 }, (_, j) => `arg-${j}`) : undefined,
          metadata: { iteration: i, complexity: 'high' },
        },
        workflow: i % 3 === 0 ? 'feature' : undefined,
        width: 60 + (i * 10), // Varying widths
      }));

      const { rerender } = render(<PreviewPanel {...complexProps[0]} />);

      const startTime = performance.now();

      complexProps.slice(1).forEach((props) => {
        rerender(<PreviewPanel {...props} />);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(totalTime).toBeLessThan(400); // Should handle complex variations efficiently
    });

    it('maintains performance with deeply nested conditional rendering', () => {
      const nestedRenderProps: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.95,
        },
        workflow: 'feature',
        width: 180, // Wide mode triggers most conditional rendering
      };

      const iterations = 30;
      const { rerender } = render(<PreviewPanel {...nestedRenderProps} />);

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        rerender(<PreviewPanel {...nestedRenderProps} />);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(averageTime).toBeLessThan(10); // Each re-render should be very fast
    });
  });

  describe('Stress testing', () => {
    it('handles continuous breakpoint transitions without degradation', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} width={50} />);

      const transitionPattern = [50, 80, 120, 180, 160, 100, 60, 40];
      const cycles = 25; // Multiple cycles of the pattern

      const startTime = performance.now();

      for (let cycle = 0; cycle < cycles; cycle++) {
        transitionPattern.forEach((width) => {
          rerender(<PreviewPanel {...baseProps} width={width} />);
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const totalTransitions = cycles * transitionPattern.length;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      // Should maintain performance across many transitions
      expect(totalTime / totalTransitions).toBeLessThan(5); // Average per transition
    });

    it('handles concurrent prop changes and width changes', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} width={120} />);

      const combinations = Array.from({ length: 50 }, (_, i) => ({
        props: {
          ...baseProps,
          input: `Input ${i}`,
          intent: {
            ...baseProps.intent,
            confidence: (i % 100) / 100,
          },
        },
        width: 60 + (i % 100),
      }));

      const startTime = performance.now();

      combinations.forEach(({ props, width }) => {
        rerender(<PreviewPanel {...props} width={width} />);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(totalTime).toBeLessThan(1000); // Should handle concurrent changes efficiently
    });
  });

  describe('Performance regression prevention', () => {
    it('maintains baseline performance for common use cases', () => {
      const commonScenarios = [
        { width: 50, label: 'narrow mobile' },
        { width: 80, label: 'compact laptop' },
        { width: 120, label: 'normal desktop' },
        { width: 180, label: 'wide monitor' },
      ];

      commonScenarios.forEach(({ width, label }) => {
        const { unmount } = render(<PreviewPanel {...baseProps} width={width} />);

        const startTime = performance.now();

        // Simulate typical user interaction pattern
        for (let i = 0; i < 10; i++) {
          const { rerender, unmount: unmountInner } = render(<PreviewPanel {...baseProps} width={width} />);
          rerender(<PreviewPanel {...baseProps} width={width} />);
          unmountInner();
        }

        const endTime = performance.now();
        const averageTime = (endTime - startTime) / 10;

        expect(averageTime).toBeLessThan(20); // Baseline performance for each scenario

        unmount();
      });
    });
  });
});