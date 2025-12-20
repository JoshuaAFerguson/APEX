import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

describe('PreviewPanel - Responsive Accessibility Tests', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const baseProps: PreviewPanelProps = {
    input: 'Accessibility test input',
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

  describe('Screen reader accessibility across breakpoints', () => {
    it('provides meaningful text content in narrow mode', () => {
      render(<PreviewPanel {...baseProps} width={50} />);

      // Essential information should be accessible even in narrow mode
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Action:')).toBeInTheDocument();

      // Action buttons should be clearly labeled with their shortcuts
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
    });

    it('provides full context in wide mode', () => {
      render(<PreviewPanel {...baseProps} width={180} />);

      // All contextual information should be available
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();

      // Action buttons should have both shortcuts and labels
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('maintains semantic structure across breakpoints', () => {
      // Test narrow mode
      const { rerender } = render(<PreviewPanel {...baseProps} width={50} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();

      // Test wide mode
      rerender(<PreviewPanel {...baseProps} width={180} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();

      // Core semantic structure should remain consistent
    });

    it('provides adequate context for each intent type in narrow mode', () => {
      const intents: Array<{ intent: PreviewPanelProps['intent']; expectedText: string }> = [
        { intent: { type: 'task', confidence: 0.8 }, expectedText: 'Task Intent' },
        { intent: { type: 'command', confidence: 0.9, command: 'test' }, expectedText: 'Command Intent' },
        { intent: { type: 'question', confidence: 0.7 }, expectedText: 'Question Intent' },
        { intent: { type: 'clarification', confidence: 0.85 }, expectedText: 'Clarification Intent' },
      ];

      intents.forEach(({ intent, expectedText }) => {
        const { rerender } = render(<PreviewPanel {...baseProps} intent={intent} width={50} />);

        expect(screen.getByText(expectedText)).toBeInTheDocument();
        expect(screen.getByText('Action:')).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });
  });

  describe('Keyboard navigation accessibility', () => {
    it('shows clear keyboard shortcuts across all breakpoints', () => {
      const breakpoints = [
        { width: 50, label: 'narrow' },
        { width: 80, label: 'compact' },
        { width: 120, label: 'normal' },
        { width: 180, label: 'wide' },
      ];

      breakpoints.forEach(({ width, label }) => {
        const { rerender } = render(<PreviewPanel {...baseProps} width={width} />);

        // Keyboard shortcuts should always be visible
        expect(screen.getByText('[Enter]')).toBeInTheDocument();
        expect(screen.getByText('[Esc]')).toBeInTheDocument();
        expect(screen.getByText('[e]')).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });

    it('provides appropriate labels for keyboard shortcuts', () => {
      // Narrow mode - shortcuts only
      const { rerender } = render(<PreviewPanel {...baseProps} width={50} />);

      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();

      // Wide mode - shortcuts with labels
      rerender(<PreviewPanel {...baseProps} width={180} />);

      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  describe('Information hierarchy and readability', () => {
    it('maintains clear information hierarchy in narrow mode', () => {
      render(<PreviewPanel {...baseProps} width={50} />);

      // Information should be presented in logical order
      const text = screen.getByText('Input:').closest('div')?.textContent || '';
      expect(text).toMatch(/Input:.*Accessibility test input/);

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Action:')).toBeInTheDocument();
    });

    it('provides progressive disclosure from narrow to wide', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} width={50} />);

      // Narrow: minimal info
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('85%')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      // Compact: some additional info
      rerender(<PreviewPanel {...baseProps} width={80} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      // Wide: full info
      rerender(<PreviewPanel {...baseProps} width={180} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });

    it('ensures critical information is never hidden', () => {
      const criticalBreakpoints = [40, 50, 60, 80, 100, 120, 160, 180];

      criticalBreakpoints.forEach((width) => {
        const { rerender } = render(<PreviewPanel {...baseProps} width={width} />);

        // These elements should ALWAYS be visible for usability
        expect(screen.getByText('Input:')).toBeInTheDocument();
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText('[Enter]')).toBeInTheDocument();
        expect(screen.getByText('[Esc]')).toBeInTheDocument();
        expect(screen.getByText('[e]')).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });
  });

  describe('Text truncation accessibility', () => {
    it('provides meaningful truncation that preserves context', () => {
      const longInput = 'Create a new React component with TypeScript support, testing, and comprehensive documentation';

      // Narrow mode
      render(<PreviewPanel {...baseProps} input={longInput} width={50} />);

      // Truncated text should still provide meaningful context
      const truncatedText = screen.getByText(/"Create a new React component\.\.\."/).textContent;
      expect(truncatedText).toBeTruthy();

      // Should not show the full text
      expect(screen.queryByText(new RegExp(longInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).not.toBeInTheDocument();
    });

    it('handles truncation gracefully for different content types', () => {
      const testCases = [
        {
          input: 'Short text',
          width: 50,
          shouldTruncate: false
        },
        {
          input: 'This is a moderately long input that should be truncated in narrow mode',
          width: 50,
          shouldTruncate: true
        },
        {
          input: 'This is a moderately long input that should be truncated in narrow mode',
          width: 180,
          shouldTruncate: false
        }
      ];

      testCases.forEach(({ input, width, shouldTruncate }, index) => {
        const { rerender } = render(<PreviewPanel {...baseProps} input={input} width={width} />);

        if (shouldTruncate) {
          expect(screen.getByText(/\.\.\."/)).toBeInTheDocument();
        } else {
          expect(screen.getByText(`"${input}"`)).toBeInTheDocument();
        }

        // Clean up for next test
        rerender(<div />);
      });
    });

    it('preserves action context even when truncated', () => {
      const longCommandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'deploy-application-to-production-environment',
        args: ['with-full-validation', 'and-comprehensive-testing', 'including-security-checks'],
      };

      render(<PreviewPanel {...baseProps} intent={longCommandIntent} width={50} />);

      // Even when truncated, the user should understand this is a command
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('Action:')).toBeInTheDocument();
      expect(screen.getByText(/Execute command:/)).toBeInTheDocument();
    });
  });

  describe('Color and visual accessibility', () => {
    it('provides text-based confidence indicators alongside colors', () => {
      const confidenceLevels = [
        { confidence: 0.9, expected: '90%' },
        { confidence: 0.7, expected: '70%' },
        { confidence: 0.5, expected: '50%' },
      ];

      confidenceLevels.forEach(({ confidence, expected }) => {
        const intent: PreviewPanelProps['intent'] = {
          type: 'task',
          confidence,
        };

        const { rerender } = render(<PreviewPanel {...baseProps} intent={intent} width={180} />);

        // Text-based confidence should be available for screen readers
        expect(screen.getByText(expected)).toBeInTheDocument();
        expect(screen.getByText('Confidence:')).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });

    it('ensures status indicators have text alternatives', () => {
      render(<PreviewPanel {...baseProps} width={180} />);

      // Status indicator should have text content, not just color
      expect(screen.getByText('[on]')).toBeInTheDocument();

      // Icons should be supplemented with text
      expect(screen.getByText('📝')).toBeInTheDocument(); // Task icon
      expect(screen.getByText('Task Intent')).toBeInTheDocument(); // Text description
    });

    it('provides intent icons with text descriptions', () => {
      const intentTypes: Array<{ intent: PreviewPanelProps['intent']; icon: string; description: string }> = [
        { intent: { type: 'task', confidence: 0.8 }, icon: '📝', description: 'Task Intent' },
        { intent: { type: 'command', confidence: 0.9, command: 'test' }, icon: '⚡', description: 'Command Intent' },
        { intent: { type: 'question', confidence: 0.7 }, icon: '❓', description: 'Question Intent' },
        { intent: { type: 'clarification', confidence: 0.85 }, icon: '💬', description: 'Clarification Intent' },
      ];

      intentTypes.forEach(({ intent, icon, description }) => {
        const { rerender } = render(<PreviewPanel {...baseProps} intent={intent} width={180} />);

        expect(screen.getByText(icon)).toBeInTheDocument();
        expect(screen.getByText(description)).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });
  });

  describe('Responsive accessibility compliance', () => {
    it('maintains minimum content requirements at all breakpoints', () => {
      const breakpoints = [30, 50, 80, 120, 180];

      breakpoints.forEach((width) => {
        const { rerender } = render(<PreviewPanel {...baseProps} width={width} />);

        // Minimum accessible content requirements
        expect(screen.getByText('Input:')).toBeInTheDocument();
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText(/Intent$/)).toBeInTheDocument(); // Some form of intent description
        expect(screen.getByText('[Enter]')).toBeInTheDocument();
        expect(screen.getByText('[Esc]')).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });

    it('provides equivalent functionality across breakpoints', () => {
      // The core functionality should be accessible regardless of visual presentation

      // Narrow mode test
      const { rerender } = render(<PreviewPanel {...baseProps} width={50} />);

      // User can understand what input was provided
      expect(screen.getByText(/Accessibility test input/)).toBeInTheDocument();

      // User can understand the intent
      expect(screen.getByText('Task Intent')).toBeInTheDocument();

      // User knows what action will be taken
      expect(screen.getByText(/Create task/)).toBeInTheDocument();

      // User knows how to interact
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();

      // Wide mode should provide the same core functionality with additional context
      rerender(<PreviewPanel {...baseProps} width={180} />);

      expect(screen.getByText(/Accessibility test input/)).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText(/Create task/)).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
    });

    it('handles accessibility with malformed or edge case data', () => {
      const edgeCases = [
        { input: '', label: 'empty input' },
        { input: '\n\t  \r\n', label: 'whitespace only' },
        { input: '🚀'.repeat(100), label: 'emoji overflow' },
        { input: 'a'.repeat(1000), label: 'extremely long' },
      ];

      edgeCases.forEach(({ input, label }) => {
        const { rerender } = render(<PreviewPanel {...baseProps} input={input} width={50} />);

        // Should still provide basic accessibility even with edge case data
        expect(screen.getByText('Input:')).toBeInTheDocument();
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText('[Enter]')).toBeInTheDocument();

        // Clean up for next test
        rerender(<div />);
      });
    });
  });
});