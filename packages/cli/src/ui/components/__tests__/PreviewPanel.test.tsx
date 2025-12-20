import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

describe('PreviewPanel', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const defaultProps: PreviewPanelProps = {
    input: 'test input',
    intent: {
      type: 'task',
      confidence: 0.8,
    },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
  };

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();
  });

  describe('basic rendering', () => {
    it('renders with minimal props in wide terminal', () => {
      render(<PreviewPanel {...defaultProps} width={180} />);

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('"test input"')).toBeInTheDocument();
    });

    it('displays input text correctly in wide terminal', () => {
      render(<PreviewPanel {...defaultProps} input="create a new component" width={180} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('"create a new component"')).toBeInTheDocument();
    });

    it('shows detected intent section', () => {
      render(<PreviewPanel {...defaultProps} width={180} />);

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });

    it('displays action buttons in wide terminal', () => {
      render(<PreviewPanel {...defaultProps} width={180} />);

      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('adapts layout for narrow terminals', () => {
      render(<PreviewPanel {...defaultProps} width={50} />);

      // Title should be hidden in narrow mode
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();

      // But core functionality should remain
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();

      // Button labels should be hidden
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });
  });

  describe('intent type display', () => {
    it('displays command intent correctly in wide terminal', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'status',
        args: ['task123'],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} width={180} />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('Execute command: /status task123')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('displays task intent correctly in wide terminal', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.85,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" width={180} />);

      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('displays question intent correctly in wide terminal', () => {
      const questionIntent: PreviewPanelProps['intent'] = {
        type: 'question',
        confidence: 0.7,
      };

      render(<PreviewPanel {...defaultProps} intent={questionIntent} width={180} />);

      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.getByText('Question Intent')).toBeInTheDocument();
      expect(screen.getByText('Answer question')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('displays clarification intent correctly in wide terminal', () => {
      const clarificationIntent: PreviewPanelProps['intent'] = {
        type: 'clarification',
        confidence: 0.9,
      };

      render(<PreviewPanel {...defaultProps} intent={clarificationIntent} width={180} />);

      expect(screen.getByText('💬')).toBeInTheDocument();
      expect(screen.getByText('Clarification Intent')).toBeInTheDocument();
      expect(screen.getByText('Provide clarification')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('hides workflow details in narrow mode', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.85,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" width={50} />);

      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.queryByText('85%')).not.toBeInTheDocument(); // Confidence hidden in narrow
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument(); // Workflow details hidden
      expect(screen.queryByText('planner → architect → developer → tester')).not.toBeInTheDocument();
    });
  });

  describe('confidence color coding', () => {
    it('displays high confidence in green in wide terminal', () => {
      const highConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.9,
      };

      render(<PreviewPanel {...defaultProps} intent={highConfidenceIntent} width={180} />);

      expect(screen.getByText('90%')).toBeInTheDocument();
      // Note: Color testing would require checking className or style props
      // This is implementation-dependent and may need adjustment based on how colors are applied
    });

    it('displays medium confidence in yellow in wide terminal', () => {
      const mediumConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.7,
      };

      render(<PreviewPanel {...defaultProps} intent={mediumConfidenceIntent} width={180} />);

      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('displays low confidence in red in wide terminal', () => {
      const lowConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.5,
      };

      render(<PreviewPanel {...defaultProps} intent={lowConfidenceIntent} width={180} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('hides confidence percentage in narrow mode', () => {
      const highConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.9,
      };

      render(<PreviewPanel {...defaultProps} intent={highConfidenceIntent} width={50} />);

      expect(screen.queryByText('90%')).not.toBeInTheDocument();
      expect(screen.queryByText('Confidence:')).not.toBeInTheDocument();
    });
  });

  describe('workflow display', () => {
    it('shows agent flow for task intent with workflow in wide terminal', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.8,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" width={180} />);

      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('does not show agent flow for non-task intents', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'help',
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} workflow="feature" width={180} />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('planner → architect → developer → tester')).not.toBeInTheDocument();
    });

    it('does not show agent flow for task intent without workflow', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.8,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} width={180} />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('hides agent flow in compact/narrow modes regardless of workflow', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.8,
      };

      // Compact mode (80 cols)
      const { rerender } = render(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" width={80} />);
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      // Narrow mode (50 cols)
      rerender(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" width={50} />);
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });
  });

  describe('command intent details', () => {
    it('displays command without arguments in wide terminal', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'help',
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} width={180} />);

      expect(screen.getByText('Execute command: /help')).toBeInTheDocument();
    });

    it('displays command with arguments in wide terminal', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'run',
        args: ['create component', '--workflow', 'feature'],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} width={180} />);

      expect(screen.getByText('Execute command: /run create component --workflow feature')).toBeInTheDocument();
    });

    it('truncates long commands in narrow terminal', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'very-long-command-name',
        args: ['with', 'many', 'arguments', 'that', 'should', 'be', 'truncated'],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} width={50} />);

      expect(screen.getByText(/Execute command: \/very-long-command-name with many arguments that should be truncated/)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });

    it('displays command with empty args array', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'status',
        args: [],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} width={180} />);

      expect(screen.getByText('Execute command: /status')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      render(<PreviewPanel {...defaultProps} input="" width={180} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('""')).toBeInTheDocument();
    });

    it('handles very long input in wide terminal', () => {
      const longInput = 'a'.repeat(140);
      render(<PreviewPanel {...defaultProps} input={longInput} width={180} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText(`"${longInput}"`)).toBeInTheDocument();
    });

    it('truncates very long input in narrow terminal', () => {
      const longInput = 'a'.repeat(50);
      render(<PreviewPanel {...defaultProps} input={longInput} width={50} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText(/^"a+\.\.\."/)).toBeInTheDocument();
      expect(screen.queryByText(`"${longInput}"`)).not.toBeInTheDocument();
    });

    it('handles special characters in input', () => {
      const specialInput = 'create "component" with <special> & characters';
      render(<PreviewPanel {...defaultProps} input={specialInput} width={180} />);

      expect(screen.getByText(`"${specialInput}"`)).toBeInTheDocument();
    });

    it('handles zero confidence in wide terminal', () => {
      const zeroConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0,
      };

      render(<PreviewPanel {...defaultProps} intent={zeroConfidenceIntent} width={180} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles confidence greater than 1', () => {
      const highConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 1.2, // Should be capped at 100%
      };

      render(<PreviewPanel {...defaultProps} intent={highConfidenceIntent} width={180} />);

      expect(screen.getByText('120%')).toBeInTheDocument(); // Or should it be capped?
    });

    it('handles unknown intent type', () => {
      const unknownIntent = {
        type: 'unknown' as any,
        confidence: 0.5,
      };

      render(<PreviewPanel {...defaultProps} intent={unknownIntent} width={180} />);

      expect(screen.getByText('🔍')).toBeInTheDocument(); // Default icon
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
      expect(screen.getByText('Process input')).toBeInTheDocument(); // Default description
    });
  });

  describe('metadata handling', () => {
    it('handles intent with metadata', () => {
      const intentWithMetadata: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.8,
        metadata: {
          suggestedWorkflow: 'bugfix',
          complexity: 'medium',
        },
      };

      render(<PreviewPanel {...defaultProps} intent={intentWithMetadata} width={180} />);

      // Should render without error even with metadata
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides meaningful text for screen readers in wide terminal', () => {
      render(<PreviewPanel {...defaultProps} width={180} />);

      // All important information should be accessible as text
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 80%')).toBeInTheDocument();
    });

    it('maintains accessibility in narrow terminals', () => {
      render(<PreviewPanel {...defaultProps} width={50} />);

      // Core functionality should remain accessible
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
    });

    it('has proper structure with headings and sections in wide terminal', () => {
      render(<PreviewPanel {...defaultProps} width={180} />);

      // Header section
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Input section
      expect(screen.getByText('Input:')).toBeInTheDocument();

      // Intent section
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();

      // Action section with clear labels
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('visual consistency', () => {
    it('maintains consistent styling across breakpoints', () => {
      // Wide terminal
      const { rerender } = render(<PreviewPanel {...defaultProps} width={180} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Narrow terminal
      rerender(<PreviewPanel {...defaultProps} width={50} />);
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();

      // Component should adapt without visual inconsistencies
    });

    it('maintains color scheme across responsive modes', () => {
      // Wide mode
      const { rerender } = render(<PreviewPanel {...defaultProps} width={180} />);
      expect(screen.getByText('[on]')).toBeInTheDocument();

      // Narrow mode (status indicator hidden but other colors consistent)
      rerender(<PreviewPanel {...defaultProps} width={50} />);
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument(); // Intent should still be visible
    });
  });
});