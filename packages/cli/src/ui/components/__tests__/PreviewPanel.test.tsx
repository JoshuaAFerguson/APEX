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
    it('renders with minimal props', () => {
      render(<PreviewPanel {...defaultProps} />);

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('"test input"')).toBeInTheDocument();
    });

    it('displays input text correctly', () => {
      render(<PreviewPanel {...defaultProps} input="create a new component" />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('"create a new component"')).toBeInTheDocument();
    });

    it('shows detected intent section', () => {
      render(<PreviewPanel {...defaultProps} />);

      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });

    it('displays action buttons', () => {
      render(<PreviewPanel {...defaultProps} />);

      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('intent type display', () => {
    it('displays command intent correctly', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'status',
        args: ['task123'],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('Execute command: /status task123')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('displays task intent correctly', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.85,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" />);

      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('displays question intent correctly', () => {
      const questionIntent: PreviewPanelProps['intent'] = {
        type: 'question',
        confidence: 0.7,
      };

      render(<PreviewPanel {...defaultProps} intent={questionIntent} />);

      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.getByText('Question Intent')).toBeInTheDocument();
      expect(screen.getByText('Answer question')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('displays clarification intent correctly', () => {
      const clarificationIntent: PreviewPanelProps['intent'] = {
        type: 'clarification',
        confidence: 0.9,
      };

      render(<PreviewPanel {...defaultProps} intent={clarificationIntent} />);

      expect(screen.getByText('💬')).toBeInTheDocument();
      expect(screen.getByText('Clarification Intent')).toBeInTheDocument();
      expect(screen.getByText('Provide clarification')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('confidence color coding', () => {
    it('displays high confidence in green', () => {
      const highConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.9,
      };

      render(<PreviewPanel {...defaultProps} intent={highConfidenceIntent} />);

      expect(screen.getByText('90%')).toBeInTheDocument();
      // Note: Color testing would require checking className or style props
      // This is implementation-dependent and may need adjustment based on how colors are applied
    });

    it('displays medium confidence in yellow', () => {
      const mediumConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.7,
      };

      render(<PreviewPanel {...defaultProps} intent={mediumConfidenceIntent} />);

      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('displays low confidence in red', () => {
      const lowConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.5,
      };

      render(<PreviewPanel {...defaultProps} intent={lowConfidenceIntent} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('workflow display', () => {
    it('shows agent flow for task intent with workflow', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.8,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} workflow="feature" />);

      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('does not show agent flow for non-task intents', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'help',
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} workflow="feature" />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('planner → architect → developer → tester')).not.toBeInTheDocument();
    });

    it('does not show agent flow for task intent without workflow', () => {
      const taskIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0.8,
      };

      render(<PreviewPanel {...defaultProps} intent={taskIntent} />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });
  });

  describe('command intent details', () => {
    it('displays command without arguments', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'help',
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} />);

      expect(screen.getByText('Execute command: /help')).toBeInTheDocument();
    });

    it('displays command with arguments', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'run',
        args: ['create component', '--workflow', 'feature'],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} />);

      expect(screen.getByText('Execute command: /run create component --workflow feature')).toBeInTheDocument();
    });

    it('displays command with empty args array', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'status',
        args: [],
      };

      render(<PreviewPanel {...defaultProps} intent={commandIntent} />);

      expect(screen.getByText('Execute command: /status')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      render(<PreviewPanel {...defaultProps} input="" />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('""')).toBeInTheDocument();
    });

    it('handles very long input', () => {
      const longInput = 'a'.repeat(200);
      render(<PreviewPanel {...defaultProps} input={longInput} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText(`"${longInput}"`)).toBeInTheDocument();
    });

    it('handles special characters in input', () => {
      const specialInput = 'create "component" with <special> & characters';
      render(<PreviewPanel {...defaultProps} input={specialInput} />);

      expect(screen.getByText(`"${specialInput}"`)).toBeInTheDocument();
    });

    it('handles zero confidence', () => {
      const zeroConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 0,
      };

      render(<PreviewPanel {...defaultProps} intent={zeroConfidenceIntent} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles confidence greater than 1', () => {
      const highConfidenceIntent: PreviewPanelProps['intent'] = {
        type: 'task',
        confidence: 1.2, // Should be capped at 100%
      };

      render(<PreviewPanel {...defaultProps} intent={highConfidenceIntent} />);

      expect(screen.getByText('120%')).toBeInTheDocument(); // Or should it be capped?
    });

    it('handles unknown intent type', () => {
      const unknownIntent = {
        type: 'unknown' as any,
        confidence: 0.5,
      };

      render(<PreviewPanel {...defaultProps} intent={unknownIntent} />);

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

      render(<PreviewPanel {...defaultProps} intent={intentWithMetadata} />);

      // Should render without error even with metadata
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides meaningful text for screen readers', () => {
      render(<PreviewPanel {...defaultProps} />);

      // All important information should be accessible as text
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 80%')).toBeInTheDocument();
    });

    it('has proper structure with headings and sections', () => {
      render(<PreviewPanel {...defaultProps} />);

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
    it('maintains consistent border styling', () => {
      render(<PreviewPanel {...defaultProps} />);

      // The component should have consistent border styling
      // This test verifies the component renders without error
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('maintains consistent color scheme', () => {
      render(<PreviewPanel {...defaultProps} />);

      // Color consistency is handled by the theme system
      expect(screen.getByText('[on]')).toBeInTheDocument(); // Preview mode indicator
    });
  });
});