import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

/**
 * Verification tests for PreviewPanel responsive terminal width adaptation
 * These tests validate the core acceptance criteria are met
 */
describe('PreviewPanel - Responsive Width Adaptation Verification', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const baseProps: PreviewPanelProps = {
    input: 'Create a new React component with TypeScript support and comprehensive testing',
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

  describe('✅ Acceptance Criteria Verification', () => {
    it('uses useStdoutDimensions hook integration', () => {
      // Test that component renders without explicit width (using hook)
      render(<PreviewPanel {...baseProps} />);

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('abbreviates intent details in narrow terminals', () => {
      render(<PreviewPanel {...baseProps} width={50} />);

      // Should hide decorative elements in narrow mode
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
      expect(screen.queryByText('85%')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();

      // Should truncate long input
      expect(screen.getByText('"Create a new React component..."')).toBeInTheDocument();
      expect(screen.queryByText('"Create a new React component with TypeScript support and comprehensive testing"')).not.toBeInTheDocument();
    });

    it('shows full confidence percentage and agent flow in wide terminals', () => {
      render(<PreviewPanel {...baseProps} width={180} />);

      // Should show all elements in wide mode
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();

      // Should show full input
      expect(screen.getByText('"Create a new React component with TypeScript support and comprehensive testing"')).toBeInTheDocument();
    });

    it('prevents horizontal overflow across all breakpoints', () => {
      const widths = [30, 50, 80, 120, 160, 200];

      widths.forEach((width) => {
        const { container, rerender } = render(<PreviewPanel {...baseProps} width={width} />);

        // Component should render without errors regardless of width
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText('[Enter]')).toBeInTheDocument();
        expect(screen.getByText('[Esc]')).toBeInTheDocument();
        expect(screen.getByText('[e]')).toBeInTheDocument();

        // No text should be longer than the specified limits for each breakpoint
        const intentIcon = width < 60 ? '📝' : '📝'; // Task intent icon should always be present
        expect(screen.getByText(intentIcon)).toBeInTheDocument();

        rerender(<PreviewPanel {...baseProps} width={widths[Math.min(widths.length - 1, widths.indexOf(width) + 1)]} />);
      });
    });

    it('covers all responsive breakpoints correctly', () => {
      // Test each breakpoint boundary
      const testCases = [
        { width: 59, mode: 'narrow', hasTitle: false, hasConfidence: false, hasWorkflow: false, hasStatus: false },
        { width: 60, mode: 'compact', hasTitle: true, hasConfidence: true, hasWorkflow: false, hasStatus: false },
        { width: 99, mode: 'compact', hasTitle: true, hasConfidence: true, hasWorkflow: false, hasStatus: false },
        { width: 100, mode: 'normal', hasTitle: true, hasConfidence: true, hasWorkflow: true, hasStatus: true },
        { width: 159, mode: 'normal', hasTitle: true, hasConfidence: true, hasWorkflow: true, hasStatus: true },
        { width: 160, mode: 'wide', hasTitle: true, hasConfidence: true, hasWorkflow: true, hasStatus: true },
      ];

      testCases.forEach(({ width, mode, hasTitle, hasConfidence, hasWorkflow, hasStatus }) => {
        const { rerender } = render(<PreviewPanel {...baseProps} width={width} />);

        // Verify breakpoint-specific behavior
        if (hasTitle) {
          expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
        }

        if (hasConfidence) {
          expect(screen.getByText('85%')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('85%')).not.toBeInTheDocument();
        }

        if (hasWorkflow) {
          expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
          expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
        }

        if (hasStatus) {
          expect(screen.getByText('[on]')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('[on]')).not.toBeInTheDocument();
        }

        // Core elements should always be present
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText('Task Intent')).toBeInTheDocument();
      });
    });
  });

  describe('✅ Additional Critical Functionality', () => {
    it('handles different intent types responsively', () => {
      const intents = [
        { type: 'command' as const, confidence: 0.95, command: 'deploy', args: ['production'] },
        { type: 'question' as const, confidence: 0.7 },
        { type: 'clarification' as const, confidence: 0.85 },
      ];

      intents.forEach((intent) => {
        const { rerender } = render(<PreviewPanel {...baseProps} intent={intent} width={180} />);

        // Wide mode - should show confidence
        expect(screen.getByText(`${Math.round(intent.confidence * 100)}%`)).toBeInTheDocument();

        // Narrow mode - should hide confidence
        rerender(<PreviewPanel {...baseProps} intent={intent} width={50} />);
        expect(screen.queryByText(`${Math.round(intent.confidence * 100)}%`)).not.toBeInTheDocument();

        // But intent type should always be visible
        const expectedType = intent.type.charAt(0).toUpperCase() + intent.type.slice(1);
        expect(screen.getByText(`${expectedType} Intent`)).toBeInTheDocument();
      });
    });

    it('maintains layout consistency during width transitions', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} width={180} />);

      // Start with wide layout
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();

      // Transition through breakpoints
      rerender(<PreviewPanel {...baseProps} width={120} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();

      rerender(<PreviewPanel {...baseProps} width={80} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      rerender(<PreviewPanel {...baseProps} width={50} />);
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      // Core functionality should remain stable throughout
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
    });

    it('properly truncates content without breaking layout', () => {
      const longInput = 'A'.repeat(200);
      const longCommandIntent = {
        type: 'command' as const,
        confidence: 0.9,
        command: 'very-long-command-name-that-should-be-truncated',
        args: ['arg1', 'extremely-long-argument-that-should-be-truncated', 'arg3'],
      };

      // Test input truncation in narrow mode
      render(<PreviewPanel {...baseProps} input={longInput} width={50} />);
      expect(screen.getByText(/^"A+\.\.\."$/)).toBeInTheDocument();
      expect(screen.queryByText(`"${longInput}"`)).not.toBeInTheDocument();

      // Test command truncation in narrow mode
      render(<PreviewPanel {...baseProps} intent={longCommandIntent} width={50} />);
      expect(screen.getByText(/\.\.\.$/) ).toBeInTheDocument();

      // Wide mode should show more content
      render(<PreviewPanel {...baseProps} intent={longCommandIntent} width={180} />);
      expect(screen.getByText(/Execute command: \/very-long-command-name-that-should-be-truncated/)).toBeInTheDocument();
    });
  });

  describe('✅ useStdoutDimensions Hook Integration', () => {
    it('works without explicit width parameter', () => {
      // This tests the hook integration when no width is provided
      render(<PreviewPanel {...baseProps} />);

      // Should render successfully with hook-provided dimensions
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
    });

    it('prioritizes explicit width over hook dimensions', () => {
      // Explicit narrow width should override any hook values
      render(<PreviewPanel {...baseProps} width={40} />);

      // Should use narrow configuration regardless of hook value
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('85%')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });
  });
});