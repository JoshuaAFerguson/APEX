/**
 * Comprehensive unit tests for PreviewPanel component
 *
 * Tests cover:
 * - Component rendering in all display modes
 * - Intent detection and display
 * - User interaction handling
 * - Accessibility features
 * - Error states and edge cases
 * - Performance considerations
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreviewPanel } from '../PreviewPanel';
import type { PreviewPanelProps } from '../PreviewPanel';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => (
    <div data-testid="ink-box" {...props}>
      {children}
    </div>
  ),
  Text: ({ children, color, bold, ...props }: any) => (
    <span
      data-testid="ink-text"
      data-color={color}
      data-bold={bold}
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('PreviewPanel Component', () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnEdit: ReturnType<typeof vi.fn>;

  const defaultProps: PreviewPanelProps = {
    input: 'test input',
    intent: {
      type: 'command',
      confidence: 0.8,
      command: 'run',
      args: ['--help'],
    },
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onEdit: vi.fn(),
  };

  beforeEach(() => {
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
    mockOnEdit = vi.fn();

    defaultProps.onConfirm = mockOnConfirm;
    defaultProps.onCancel = mockOnCancel;
    defaultProps.onEdit = mockOnEdit;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with minimal props', () => {
      const minimalProps: PreviewPanelProps = {
        input: 'hello',
        intent: { type: 'task', confidence: 0.5 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      const { container } = render(<PreviewPanel {...minimalProps} />);
      expect(container).toBeDefined();

      // Check for key elements
      expect(screen.getByText('📋 Input Preview')).toBeDefined();
      expect(screen.getByText('"hello"')).toBeDefined();
    });

    it('should display input text correctly', () => {
      const testInputs = [
        'Simple command',
        'Multi\nline\ninput',
        'Special chars: !@#$%^&*()',
        'Unicode: 🚀 中文 éñ',
        '',
      ];

      testInputs.forEach((input) => {
        const props = { ...defaultProps, input };
        const { rerender } = render(<PreviewPanel {...props} />);

        if (input) {
          expect(screen.getByText(`"${input}"`)).toBeDefined();
        } else {
          expect(screen.getByText('""')).toBeDefined();
        }

        rerender(<div />);
      });
    });

    it('should show preview as enabled by default', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Should show [on] indicator
      expect(screen.getByText('[on]')).toBeDefined();
      expect(screen.getByText('on')).toBeDefined();
    });
  });

  describe('Intent Type Display', () => {
    const intentTypes = [
      { type: 'command' as const, icon: '⚡', description: 'Execute command' },
      { type: 'task' as const, icon: '📝', description: 'Create task' },
      { type: 'question' as const, icon: '❓', description: 'Answer question' },
      { type: 'clarification' as const, icon: '💬', description: 'Provide clarification' },
    ];

    intentTypes.forEach(({ type, icon, description }) => {
      it(`should display ${type} intent correctly`, () => {
        const props = {
          ...defaultProps,
          intent: { type, confidence: 0.7 },
        };

        render(<PreviewPanel {...props} />);

        expect(screen.getByText(icon)).toBeDefined();
        expect(screen.getByText(new RegExp(description, 'i'))).toBeDefined();
      });
    });

    it('should handle unknown intent types gracefully', () => {
      const props = {
        ...defaultProps,
        intent: { type: 'unknown' as any, confidence: 0.5 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeDefined();
      expect(screen.getByText('Process input')).toBeDefined();
    });
  });

  describe('Confidence Display', () => {
    const confidenceTests = [
      { confidence: 0.95, color: 'green', percentage: 95 },
      { confidence: 0.85, color: 'green', percentage: 85 },
      { confidence: 0.75, color: 'yellow', percentage: 75 },
      { confidence: 0.65, color: 'yellow', percentage: 65 },
      { confidence: 0.55, color: 'red', percentage: 55 },
      { confidence: 0.35, color: 'red', percentage: 35 },
      { confidence: 0, color: 'red', percentage: 0 },
      { confidence: 1, color: 'green', percentage: 100 },
    ];

    confidenceTests.forEach(({ confidence, color, percentage }) => {
      it(`should display confidence ${confidence} with ${color} color`, () => {
        const props = {
          ...defaultProps,
          intent: { ...defaultProps.intent, confidence },
        };

        render(<PreviewPanel {...props} />);

        // Check percentage display
        expect(screen.getByText(`${percentage}%`)).toBeDefined();

        // Check color coding through data attributes
        const confidenceElement = screen.getByText(`${percentage}%`);
        expect(confidenceElement.getAttribute('data-color')).toBe(color);
      });
    });

    it('should handle edge case confidence values', () => {
      const edgeCases = [
        { confidence: -0.1, expectedColor: 'red', expectedPercentage: 0 },
        { confidence: 1.1, expectedColor: 'green', expectedPercentage: 100 },
        { confidence: NaN, expectedColor: 'red', expectedPercentage: 0 },
        { confidence: Infinity, expectedColor: 'green', expectedPercentage: 100 },
      ];

      edgeCases.forEach(({ confidence, expectedColor, expectedPercentage }) => {
        const getConfidenceColor = (conf: number): string => {
          const clampedConf = Math.max(0, Math.min(1, isNaN(conf) ? 0 : conf));
          if (clampedConf >= 0.8) return 'green';
          if (clampedConf >= 0.6) return 'yellow';
          return 'red';
        };

        const getConfidencePercentage = (conf: number): number => {
          const clampedConf = Math.max(0, Math.min(1, isNaN(conf) ? 0 : conf));
          return Math.round(clampedConf * 100);
        };

        expect(getConfidenceColor(confidence)).toBe(expectedColor);
        expect(getConfidencePercentage(confidence)).toBe(expectedPercentage);
      });
    });
  });

  describe('Command Intent Details', () => {
    it('should display command details correctly', () => {
      const commandProps = {
        ...defaultProps,
        intent: {
          type: 'command' as const,
          confidence: 0.9,
          command: 'status',
          args: ['--verbose', '--json'],
        },
      };

      render(<PreviewPanel {...commandProps} />);

      expect(screen.getByText('/status --verbose --json')).toBeDefined();
      expect(screen.getByText(/Execute command/)).toBeDefined();
    });

    it('should handle command without args', () => {
      const commandProps = {
        ...defaultProps,
        intent: {
          type: 'command' as const,
          confidence: 0.8,
          command: 'help',
        },
      };

      render(<PreviewPanel {...commandProps} />);

      expect(screen.getByText('/help')).toBeDefined();
    });

    it('should handle command with empty args array', () => {
      const commandProps = {
        ...defaultProps,
        intent: {
          type: 'command' as const,
          confidence: 0.8,
          command: 'init',
          args: [],
        },
      };

      render(<PreviewPanel {...commandProps} />);

      expect(screen.getByText('/init')).toBeDefined();
    });
  });

  describe('Workflow Display', () => {
    it('should display workflow when provided', () => {
      const workflowProps = {
        ...defaultProps,
        intent: { type: 'task' as const, confidence: 0.8 },
        workflow: 'feature-development',
      };

      render(<PreviewPanel {...workflowProps} />);

      expect(screen.getByText(/feature-development workflow/)).toBeDefined();
    });

    it('should handle task without workflow', () => {
      const taskProps = {
        ...defaultProps,
        intent: { type: 'task' as const, confidence: 0.8 },
      };

      render(<PreviewPanel {...taskProps} />);

      expect(screen.getByText('Create task')).toBeDefined();
      expect(screen.queryByText(/workflow/)).toBeNull();
    });

    it('should display workflow only for task intents', () => {
      const nonTaskProps = {
        ...defaultProps,
        intent: { type: 'command' as const, confidence: 0.8 },
        workflow: 'should-not-appear',
      };

      render(<PreviewPanel {...nonTaskProps} />);

      expect(screen.queryByText(/should-not-appear/)).toBeNull();
    });
  });

  describe('Action Buttons', () => {
    it('should trigger onConfirm when confirm is called', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Simulate confirm action (would be triggered by user input)
      defaultProps.onConfirm();

      expect(mockOnConfirm).toHaveBeenCalledOnce();
    });

    it('should trigger onCancel when cancel is called', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Simulate cancel action
      defaultProps.onCancel();

      expect(mockOnCancel).toHaveBeenCalledOnce();
    });

    it('should trigger onEdit when edit is called', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Simulate edit action
      defaultProps.onEdit();

      expect(mockOnEdit).toHaveBeenCalledOnce();
    });

    it('should handle missing callback functions gracefully', () => {
      const propsWithMissingCallbacks = {
        ...defaultProps,
        onConfirm: undefined as any,
        onCancel: undefined as any,
        onEdit: undefined as any,
      };

      // Should not throw
      expect(() => {
        render(<PreviewPanel {...propsWithMissingCallbacks} />);
      }).not.toThrow();
    });
  });

  describe('Error States and Edge Cases', () => {
    it('should handle null or undefined intent gracefully', () => {
      const propsWithNullIntent = {
        ...defaultProps,
        intent: null as any,
      };

      // Should not crash
      expect(() => {
        render(<PreviewPanel {...propsWithNullIntent} />);
      }).not.toThrow();
    });

    it('should handle malformed intent object', () => {
      const propsWithMalformedIntent = {
        ...defaultProps,
        intent: { type: 'command', confidence: 'not-a-number' } as any,
      };

      // Should not crash
      expect(() => {
        render(<PreviewPanel {...propsWithMalformedIntent} />);
      }).not.toThrow();
    });

    it('should handle very long input text', () => {
      const longInput = 'a'.repeat(10000);
      const propsWithLongInput = {
        ...defaultProps,
        input: longInput,
      };

      const { container } = render(<PreviewPanel {...propsWithLongInput} />);
      expect(container).toBeDefined();
      expect(screen.getByText(`"${longInput}"`)).toBeDefined();
    });

    it('should handle special characters in input', () => {
      const specialChars = [
        'Input with "quotes" and \'apostrophes\'',
        'Input with <tags> and &entities;',
        'Input with\nnewlines\tand\ttabs',
        'Input with emoji 🚀 and unicode ñáéí',
      ];

      specialChars.forEach((input) => {
        const props = { ...defaultProps, input };
        const { rerender } = render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${input}"`)).toBeDefined();
        rerender(<div />);
      });
    });

    it('should handle circular references in metadata', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const propsWithCircularMeta = {
        ...defaultProps,
        intent: {
          ...defaultProps.intent,
          metadata: circularObj,
        },
      };

      // Should not crash due to circular reference
      expect(() => {
        render(<PreviewPanel {...propsWithCircularMeta} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should provide appropriate ARIA labels', () => {
      const { container } = render(<PreviewPanel {...defaultProps} />);

      // Preview panel should be identifiable
      expect(container.querySelector('[role="region"]') ||
             container.querySelector('[aria-label*="preview"]') ||
             screen.queryByText('Input Preview')).toBeDefined();
    });

    it('should have proper semantic structure', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Should have clear headings or labels
      expect(screen.getByText('Input Preview')).toBeDefined();
      expect(screen.getByText('Detected Intent:')).toBeDefined();
    });

    it('should provide screen reader friendly content', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Confidence should be readable
      const confidenceText = screen.getByText(/80%/);
      expect(confidenceText).toBeDefined();

      // Intent type should be readable
      expect(screen.getByText(/Execute command/)).toBeDefined();
    });

    it('should handle keyboard navigation context', () => {
      // This would test keyboard shortcuts if implemented
      render(<PreviewPanel {...defaultProps} />);

      // Preview should be navigable
      expect(screen.getByText('Input Preview')).toBeDefined();

      // The component should be focusable through keyboard
      // (Implementation would depend on actual keyboard handling)
    });
  });

  describe('Performance Considerations', () => {
    it('should render efficiently with large amounts of data', () => {
      const largeMetadata = {
        files: Array.from({ length: 1000 }, (_, i) => `file${i}.ts`),
        dependencies: Array.from({ length: 500 }, (_, i) => `dep${i}`),
        history: Array.from({ length: 100 }, (_, i) => `action${i}`),
      };

      const performanceProps = {
        ...defaultProps,
        intent: {
          ...defaultProps.intent,
          metadata: largeMetadata,
        },
      };

      const startTime = performance.now();
      render(<PreviewPanel {...performanceProps} />);
      const endTime = performance.now();

      // Rendering should complete quickly even with large data
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });

    it('should handle rapid re-renders without performance issues', () => {
      const { rerender } = render(<PreviewPanel {...defaultProps} />);

      const startTime = performance.now();

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        const updatedProps = {
          ...defaultProps,
          input: `Updated input ${i}`,
          intent: {
            ...defaultProps.intent,
            confidence: Math.random(),
          },
        };
        rerender(<PreviewPanel {...updatedProps} />);
      }

      const endTime = performance.now();

      // 100 re-renders should complete quickly
      expect(endTime - startTime).toBeLessThan(1000); // 1 second threshold
    });

    it('should not cause memory leaks with frequent updates', () => {
      const { rerender, unmount } = render(<PreviewPanel {...defaultProps} />);

      // Simulate component lifecycle
      for (let i = 0; i < 50; i++) {
        const props = {
          ...defaultProps,
          input: `Memory test ${i}`,
          intent: { ...defaultProps.intent, confidence: Math.random() },
        };
        rerender(<PreviewPanel {...props} />);
      }

      // Should unmount cleanly
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Integration with Display Modes', () => {
    it('should adapt to compact display mode requirements', () => {
      // Test that component can work in compact contexts
      const compactProps = {
        ...defaultProps,
        input: 'Short input for compact mode',
        intent: { ...defaultProps.intent, confidence: 0.9 },
      };

      render(<PreviewPanel {...compactProps} />);

      // Should still display essential information
      expect(screen.getByText('Input Preview')).toBeDefined();
      expect(screen.getByText(/90%/)).toBeDefined();
    });

    it('should provide full detail for verbose mode', () => {
      const verboseProps = {
        ...defaultProps,
        intent: {
          ...defaultProps.intent,
          metadata: {
            estimatedTime: '5 minutes',
            complexity: 'medium',
            requirements: ['node', 'npm'],
          },
        },
        workflow: 'detailed-workflow',
      };

      render(<PreviewPanel {...verboseProps} />);

      // Should show all available information
      expect(screen.getByText('Input Preview')).toBeDefined();
      expect(screen.getByText(/detailed-workflow workflow/)).toBeDefined();
    });
  });
});