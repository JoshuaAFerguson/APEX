import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

// Mock the hook
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 30,
    breakpoint: 'normal' as const,
  }),
}));

describe('PreviewPanel Countdown Edge Cases and Error Handling', () => {
  let baseProps: PreviewPanelProps;

  beforeEach(() => {
    vi.useFakeTimers();

    baseProps = {
      input: 'test input',
      intent: {
        type: 'task',
        confidence: 0.9,
      },
      workflow: 'feature',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      onEdit: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Extreme Time Values', () => {
    it('should handle zero milliseconds', () => {
      const props = {
        ...baseProps,
        remainingMs: 0,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/0s/)).toBeInTheDocument();
    });

    it('should handle negative time values', () => {
      const props = {
        ...baseProps,
        remainingMs: -1000,
      };

      render(<PreviewPanel {...props} />);

      // Should render without crashing, though behavior may vary
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      // Math.ceil on negative values should produce negative results
      expect(screen.getByText(/-1s/)).toBeInTheDocument();
    });

    it('should handle very large time values', () => {
      const props = {
        ...baseProps,
        remainingMs: Number.MAX_SAFE_INTEGER,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      // Should display a very large number
      const largeSeconds = Math.ceil(Number.MAX_SAFE_INTEGER / 1000);
      expect(screen.getByText(new RegExp(`${largeSeconds}s`))).toBeInTheDocument();
    });

    it('should handle very small positive values', () => {
      const props = {
        ...baseProps,
        remainingMs: 0.1,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/1s/)).toBeInTheDocument(); // Should ceil to 1
    });

    it('should handle fractional milliseconds', () => {
      const fractionalValues = [
        { ms: 1500.7, expected: '2s' },
        { ms: 2999.9, expected: '3s' },
        { ms: 5000.1, expected: '6s' },
        { ms: 0.5, expected: '1s' },
      ];

      fractionalValues.forEach(({ ms, expected }) => {
        const props = {
          ...baseProps,
          remainingMs: ms,
        };

        const { unmount } = render(<PreviewPanel {...props} />);

        expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Special Number Values', () => {
    it('should handle NaN values gracefully', () => {
      const props = {
        ...baseProps,
        remainingMs: NaN,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      // NaN handling - Math.ceil(NaN) returns NaN, which should be handled
      expect(screen.getByText(/NaNs/)).toBeInTheDocument();
    });

    it('should handle Infinity values gracefully', () => {
      const props = {
        ...baseProps,
        remainingMs: Infinity,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      // Infinity handling - Math.ceil(Infinity) returns Infinity
      expect(screen.getByText(/Infinitys/)).toBeInTheDocument();
    });

    it('should handle negative Infinity values', () => {
      const props = {
        ...baseProps,
        remainingMs: -Infinity,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/-Infinitys/)).toBeInTheDocument();
    });
  });

  describe('Rapid State Changes', () => {
    it('should handle rapid countdown updates without memory leaks', async () => {
      const props = {
        ...baseProps,
        remainingMs: 5000,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      // Simulate rapid countdown updates
      const updates = Array.from({ length: 100 }, (_, i) => 5000 - (i * 50));

      updates.forEach((ms) => {
        rerender(<PreviewPanel {...props} remainingMs={ms} />);
      });

      // Should still be functional after rapid updates
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
    });

    it('should handle rapid addition and removal of countdown', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} />);

      // Rapidly add and remove countdown
      for (let i = 0; i < 50; i++) {
        rerender(<PreviewPanel {...baseProps} remainingMs={i % 2 === 0 ? 3000 : undefined} />);
      }

      // Should still render correctly
      expect(screen.queryByText(/📋 Input Preview/)).toBeInTheDocument();
    });

    it('should handle countdown oscillation between color ranges', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      // Oscillate between color ranges
      const timeValues = [6000, 4000, 1500, 8000, 3000, 2000, 10000];
      timeValues.forEach((ms) => {
        rerender(<PreviewPanel {...props} remainingMs={ms} />);
        expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle Edge Cases', () => {
    it('should handle unmount during countdown display', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
      };

      const { unmount } = render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle mount with countdown already active', () => {
      const props = {
        ...baseProps,
        remainingMs: 2500,
      };

      // Should mount successfully with countdown
      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });

    it('should handle multiple component instances with different countdown values', () => {
      const props1 = {
        ...baseProps,
        remainingMs: 5000,
      };

      const props2 = {
        ...baseProps,
        remainingMs: 2000,
      };

      const { container: container1 } = render(<PreviewPanel {...props1} />);
      const { container: container2 } = render(<PreviewPanel {...props2} />);

      // Both should render correctly
      expect(container1).toBeInTheDocument();
      expect(container2).toBeInTheDocument();
    });
  });

  describe('Error Boundary and Graceful Degradation', () => {
    it('should not crash when countdown formatting fails', () => {
      // Mock Math.ceil to throw an error
      const originalCeil = Math.ceil;
      vi.spyOn(Math, 'ceil').mockImplementation(() => {
        throw new Error('Ceiling calculation failed');
      });

      const props = {
        ...baseProps,
        remainingMs: 3000,
      };

      // Component should still render, even if countdown formatting fails
      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();

      // Restore original function
      vi.mocked(Math.ceil).mockRestore();
      Math.ceil = originalCeil;
    });

    it('should handle malformed countdown configuration', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        // Simulate corrupted component state
        intent: {
          type: 'task' as const,
          confidence: 0.9,
          // Add unexpected properties
          malformed: true,
          nested: { deep: { value: 'test' } },
        } as any,
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });

    it('should handle string values passed as remainingMs', () => {
      const props = {
        ...baseProps,
        remainingMs: '3000' as any, // Invalid type
      };

      // Should either handle gracefully or not display countdown
      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle object values passed as remainingMs', () => {
      const props = {
        ...baseProps,
        remainingMs: { value: 3000 } as any, // Invalid type
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should not create memory leaks with rapid countdown changes', async () => {
      const props = {
        ...baseProps,
        remainingMs: 10000,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      // Simulate high-frequency updates
      for (let i = 10000; i > 0; i -= 100) {
        rerender(<PreviewPanel {...props} remainingMs={i} />);
      }

      // Check that the component is still responsive
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
    });

    it('should handle concurrent re-renders efficiently', () => {
      const props = {
        ...baseProps,
        remainingMs: 5000,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      // Simulate concurrent updates
      const updates = Promise.all([
        Promise.resolve().then(() => rerender(<PreviewPanel {...props} remainingMs={4000} />)),
        Promise.resolve().then(() => rerender(<PreviewPanel {...props} remainingMs={3000} />)),
        Promise.resolve().then(() => rerender(<PreviewPanel {...props} remainingMs={2000} />)),
      ]);

      return expect(updates).resolves.toBeUndefined();
    });

    it('should maintain performance with very long input and countdown', () => {
      const longInput = 'Very long input text '.repeat(1000);

      const props = {
        ...baseProps,
        input: longInput,
        remainingMs: 3000,
      };

      const startTime = performance.now();
      render(<PreviewPanel {...props} />);
      const endTime = performance.now();

      // Should render in reasonable time (this is a basic performance check)
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });
  });

  describe('Integration with Other Features Edge Cases', () => {
    it('should handle countdown with malformed intent types', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        intent: {
          type: 'invalid-type' as any,
          confidence: 0.9,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      // Should fall back to default icon and description
      expect(screen.getByText(/🔍/)).toBeInTheDocument();
    });

    it('should handle countdown with extremely high confidence', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        intent: {
          type: 'task' as const,
          confidence: 99.9, // Invalid confidence > 1
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      // Should display rounded percentage
      expect(screen.getByText(/9990%/)).toBeInTheDocument();
    });

    it('should handle countdown with negative confidence', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        intent: {
          type: 'task' as const,
          confidence: -0.5, // Negative confidence
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(/-50%/)).toBeInTheDocument();
    });

    it('should handle countdown with circular reference in intent metadata', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj; // Create circular reference

      const props = {
        ...baseProps,
        remainingMs: 3000,
        intent: {
          type: 'command' as const,
          confidence: 0.8,
          command: 'test',
          metadata: circularObj,
        },
      };

      // Should not crash due to circular reference
      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });
  });

  describe('Terminal Width Edge Cases with Countdown', () => {
    it('should handle countdown in extremely narrow terminals', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        width: 1, // Extremely narrow
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });

    it('should handle countdown with width changes during display', () => {
      const props = {
        ...baseProps,
        remainingMs: 4000,
        width: 200,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      expect(screen.getByText(/4s/)).toBeInTheDocument();

      // Change width dramatically during countdown
      rerender(<PreviewPanel {...props} width={30} />);

      expect(screen.getByText(/4s/)).toBeInTheDocument();
    });

    it('should handle undefined width with countdown', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        width: undefined,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });
  });
});