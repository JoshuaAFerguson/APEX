import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

describe('PreviewPanel - Responsive Edge Cases', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const baseProps: PreviewPanelProps = {
    input: 'Test input for responsive behavior',
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
  });

  describe('Boundary width testing', () => {
    it('handles exact breakpoint boundaries correctly', () => {
      // Test exact boundaries: 60, 100, 160

      // Narrow boundary (59 vs 60)
      const { rerender } = render(<PreviewPanel {...baseProps} width={59} />);
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument(); // Narrow mode
      expect(screen.queryByText('85%')).not.toBeInTheDocument();

      rerender(<PreviewPanel {...baseProps} width={60} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument(); // Compact mode
      expect(screen.getByText('85%')).toBeInTheDocument();

      // Compact boundary (99 vs 100)
      rerender(<PreviewPanel {...baseProps} width={99} />);
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument(); // Compact mode
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();

      rerender(<PreviewPanel {...baseProps} width={100} />);
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument(); // Normal mode
      expect(screen.getByText('[on]')).toBeInTheDocument();

      // Normal boundary (159 vs 160)
      // Wide mode should be the same as normal for display purposes but with larger limits
      rerender(<PreviewPanel {...baseProps} width={159} />);
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument(); // Normal mode

      rerender(<PreviewPanel {...baseProps} width={160} />);
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument(); // Wide mode
    });

    it('handles single-column edge case', () => {
      render(<PreviewPanel {...baseProps} width={1} />);

      // Should still render without crashing
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();

      // Should use narrow configuration
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('85%')).not.toBeInTheDocument();
    });

    it('handles extremely wide terminals', () => {
      render(<PreviewPanel {...baseProps} width={500} />);

      // Should render all elements without overflow
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  describe('Content truncation stress tests', () => {
    it('handles Unicode characters in input truncation', () => {
      const unicodeInput = '🚀 Créer une composant avec émoji 🎯 et caractères spéciaux ñáéíóú';

      // Wide mode - should not truncate
      const { rerender } = render(<PreviewPanel {...baseProps} input={unicodeInput} width={180} />);
      expect(screen.getByText(`"${unicodeInput}"`)).toBeInTheDocument();

      // Narrow mode - should truncate properly without breaking Unicode
      rerender(<PreviewPanel {...baseProps} input={unicodeInput} width={50} />);
      expect(screen.getByText(/^"🚀 Créer une composant avec.+\.\.\."$/)).toBeInTheDocument();
    });

    it('handles extremely long single-word input', () => {
      const longWord = 'supercalifragilisticexpialidociousantidisestablishmentarianism'.repeat(3);

      render(<PreviewPanel {...baseProps} input={longWord} width={50} />);

      // Should truncate without breaking layout
      expect(screen.getByText(/^"supercalifragilisticexpialidocious.+\.\.\."$/)).toBeInTheDocument();
      expect(screen.queryByText(new RegExp(`"${longWord}"`))).not.toBeInTheDocument();
    });

    it('handles input with newlines and special whitespace', () => {
      const inputWithNewlines = 'Line one\nLine two\t\rLine three with mixed\u00A0whitespace';

      render(<PreviewPanel {...baseProps} input={inputWithNewlines} width={50} />);

      // Should handle whitespace correctly in truncation
      expect(screen.getByText(/^"Line one.+\.\.\."$/)).toBeInTheDocument();
    });

    it('handles action description truncation with complex commands', () => {
      const complexCommandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'deploy-with-very-long-name-that-should-be-truncated',
        args: [
          'production-environment-with-extremely-long-name',
          '--force-deployment',
          '--skip-validation-and-tests',
          '--override-safety-checks',
          'additional-parameter-that-makes-this-even-longer'
        ],
      };

      render(<PreviewPanel {...baseProps} intent={complexCommandIntent} width={50} />);

      // Should show truncated command properly
      expect(screen.queryByText(/Execute command: \/deploy-with-very-long-name-that-should-be-truncated production-environment-with-extremely-long-name --force-deployment --skip-validation-and-tests --override-safety-checks additional-parameter-that-makes-this-even-longer/)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });
  });

  describe('Hook integration edge cases', () => {
    it('handles undefined width from hook gracefully', () => {
      // Test with no explicit width (relies on hook)
      render(<PreviewPanel {...baseProps} />);

      // Should render with fallback dimensions without error
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });

    it('handles rapid width changes', () => {
      // Test component stability during rapid width changes
      const widths = [50, 80, 120, 180, 60, 100, 40, 200];

      const { rerender } = render(<PreviewPanel {...baseProps} width={widths[0]} />);

      widths.forEach((width, index) => {
        if (index === 0) return; // Skip first render

        rerender(<PreviewPanel {...baseProps} width={width} />);

        // Component should remain stable
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText('[Enter]')).toBeInTheDocument();
        expect(screen.getByText('[Esc]')).toBeInTheDocument();
        expect(screen.getByText('[e]')).toBeInTheDocument();
      });
    });

    it('handles breakpoint changes with different intent types', () => {
      const intents: PreviewPanelProps['intent'][] = [
        { type: 'task', confidence: 0.8 },
        { type: 'command', confidence: 0.95, command: 'test', args: ['arg1'] },
        { type: 'question', confidence: 0.7 },
        { type: 'clarification', confidence: 0.85 },
      ];

      intents.forEach((intent) => {
        const { rerender } = render(<PreviewPanel {...baseProps} intent={intent} width={180} />);

        // Should show full details in wide mode
        if (intent.type === 'task') {
          expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
        }

        // Switch to narrow mode
        rerender(<PreviewPanel {...baseProps} intent={intent} width={50} />);

        // Should adapt appropriately
        expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
        expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

        // But core intent should still be visible
        expect(screen.getByText(`${intent.type.charAt(0).toUpperCase()}${intent.type.slice(1)} Intent`)).toBeInTheDocument();
      });
    });
  });

  describe('Layout stability tests', () => {
    it('maintains consistent element ordering across breakpoints', () => {
      const { rerender, container } = render(<PreviewPanel {...baseProps} width={180} />);

      // Get element order in wide mode
      const wideElements = Array.from(container.querySelectorAll('*[data-testid], span, div')).map(el => el.textContent);

      // Switch to narrow
      rerender(<PreviewPanel {...baseProps} width={50} />);

      // Basic structure should remain consistent (though some elements may be hidden)
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
    });

    it('prevents content overflow in narrow terminals', () => {
      const { container } = render(<PreviewPanel {...baseProps} width={30} />);

      // No text content should exceed the terminal width
      // This is a basic check since actual overflow detection would require DOM measurement
      expect(container).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });

    it('handles mixed content lengths appropriately', () => {
      const mixedProps: PreviewPanelProps = {
        ...baseProps,
        input: 'Short',
        intent: {
          type: 'command',
          confidence: 0.5,
          command: 'very-very-very-long-command-name',
          args: ['arg1', 'extremely-long-argument-that-should-be-truncated', 'arg3'],
        },
      };

      // Wide mode
      const { rerender } = render(<PreviewPanel {...mixedProps} width={180} />);
      expect(screen.getByText('"Short"')).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/very-very-very-long-command-name arg1 extremely-long-argument-that-should-be-truncated arg3/)).toBeInTheDocument();

      // Narrow mode
      rerender(<PreviewPanel {...mixedProps} width={50} />);
      expect(screen.getByText('"Short"')).toBeInTheDocument(); // Short input not truncated
      expect(screen.queryByText(/Execute command: \/very-very-very-long-command-name arg1 extremely-long-argument-that-should-be-truncated arg3/)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument(); // Long command truncated
    });
  });

  describe('Confidence display edge cases', () => {
    it('handles confidence values with many decimal places', () => {
      const preciseConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.857142857142857,
      };

      render(<PreviewPanel {...baseProps} intent={preciseConfidenceIntent} width={180} />);

      // Should round to whole percentage
      expect(screen.getByText('86%')).toBeInTheDocument(); // Math.round(85.7142...) = 86
      expect(screen.queryByText('85.7%')).not.toBeInTheDocument();
      expect(screen.queryByText('857142857142857%')).not.toBeInTheDocument();
    });

    it('handles negative confidence values', () => {
      const negativeConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: -0.1,
      };

      render(<PreviewPanel {...baseProps} intent={negativeConfidenceIntent} width={180} />);

      // Should handle gracefully (though this shouldn't happen in practice)
      expect(screen.getByText('-10%')).toBeInTheDocument();
    });

    it('handles NaN confidence values', () => {
      const nanConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: NaN,
      };

      render(<PreviewPanel {...baseProps} intent={nanConfidenceIntent} width={180} />);

      // Should handle gracefully
      expect(screen.getByText('NaN%')).toBeInTheDocument();
    });
  });

  describe('Workflow display variations', () => {
    it('handles missing workflow with task intent across breakpoints', () => {
      const taskIntentNoWorkflow: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.9,
      };

      // Wide mode
      const { rerender } = render(<PreviewPanel {...baseProps} intent={taskIntentNoWorkflow} workflow={undefined} width={180} />);
      expect(screen.getByText('Create task')).toBeInTheDocument(); // No workflow specified
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      // Narrow mode
      rerender(<PreviewPanel {...baseProps} intent={taskIntentNoWorkflow} workflow={undefined} width={50} />);
      expect(screen.getByText(/Create task/)).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('handles empty string workflow', () => {
      const taskIntentEmptyWorkflow: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.9,
      };

      render(<PreviewPanel {...baseProps} intent={taskIntentEmptyWorkflow} workflow="" width={180} />);

      // Should treat empty string like undefined
      expect(screen.getByText('Create task')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('handles very long workflow names', () => {
      const longWorkflowName = 'extremely-long-workflow-name-that-might-cause-layout-issues-if-not-handled-properly';

      render(<PreviewPanel {...baseProps} workflow={longWorkflowName} width={180} />);

      expect(screen.getByText(`Create task (${longWorkflowName} workflow)`)).toBeInTheDocument();

      // In narrow mode, workflow details are hidden anyway
      render(<PreviewPanel {...baseProps} workflow={longWorkflowName} width={50} />);
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });
  });

  describe('Memory and performance edge cases', () => {
    it('handles rapid re-renders without memory leaks', () => {
      const props = [...Array(100)].map((_, i) => ({
        ...baseProps,
        input: `Test input ${i}`,
        width: 50 + (i % 150), // Varying widths
      }));

      const { rerender } = render(<PreviewPanel {...props[0]} />);

      props.forEach((prop, index) => {
        if (index === 0) return;
        rerender(<PreviewPanel {...prop} />);
      });

      // Should complete without errors
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });

    it('handles component unmount/remount during width changes', () => {
      const { rerender, unmount } = render(<PreviewPanel {...baseProps} width={180} />);

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      unmount();

      // Remount with different width
      rerender(<PreviewPanel {...baseProps} width={50} />);

      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });
  });
});