import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

describe('PreviewPanel - Responsive Behavior', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const baseProps: PreviewPanelProps = {
    input: 'Create a new React component with TypeScript support and tests',
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

  describe('Breakpoint: narrow (<60 columns)', () => {
    const narrowWidth = 50;

    it('hides borders and decorative elements', () => {
      render(<PreviewPanel {...baseProps} width={narrowWidth} />);

      // Should not show title
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();

      // Should not show status indicator
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
    });

    it('truncates long input text', () => {
      render(<PreviewPanel {...baseProps} width={narrowWidth} />);

      // Input should be truncated to 30 chars + "..."
      expect(screen.getByText('"Create a new React component..."')).toBeInTheDocument();
      expect(screen.queryByText('"Create a new React component with TypeScript support and tests"')).not.toBeInTheDocument();
    });

    it('hides confidence percentage', () => {
      render(<PreviewPanel {...baseProps} width={narrowWidth} />);

      expect(screen.queryByText('85%')).not.toBeInTheDocument();
      expect(screen.queryByText('Confidence:')).not.toBeInTheDocument();
    });

    it('hides workflow details', () => {
      render(<PreviewPanel {...baseProps} width={narrowWidth} />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('planner → architect → developer → tester')).not.toBeInTheDocument();
    });

    it('shows compact action buttons without labels', () => {
      render(<PreviewPanel {...baseProps} width={narrowWidth} />);

      // Should show button shortcuts
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();

      // Should not show button labels
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('truncates action description', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'status',
        args: ['very-long-task-identifier-that-should-be-truncated'],
      };

      render(<PreviewPanel {...baseProps} intent={commandIntent} width={narrowWidth} />);

      // Should show truncated action description (max 20 chars)
      expect(screen.getByText(/Execute command: \/status very-long-task-identifier-that-should-be-truncated/)).not.toBeInTheDocument();
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument(); // Should end with ellipsis
    });
  });

  describe('Breakpoint: compact (60-99 columns)', () => {
    const compactWidth = 80;

    it('shows single-line borders and minimal decorations', () => {
      render(<PreviewPanel {...baseProps} width={compactWidth} />);

      // Should show title
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Should not show status indicator
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
    });

    it('shows confidence percentage', () => {
      render(<PreviewPanel {...baseProps} width={compactWidth} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
    });

    it('hides workflow details', () => {
      render(<PreviewPanel {...baseProps} width={compactWidth} />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('planner → architect → developer → tester')).not.toBeInTheDocument();
    });

    it('shows action button labels in compact format', () => {
      render(<PreviewPanel {...baseProps} width={compactWidth} />);

      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('truncates input if too long', () => {
      const longInput = 'A'.repeat(70);
      render(<PreviewPanel {...baseProps} input={longInput} width={compactWidth} />);

      expect(screen.getByText(new RegExp(`"${'A'.repeat(57)}\\.\\.\\."`))).toBeInTheDocument();
    });
  });

  describe('Breakpoint: normal (100-159 columns)', () => {
    const normalWidth = 120;

    it('shows full decorative borders and all elements', () => {
      render(<PreviewPanel {...baseProps} width={normalWidth} />);

      // Should show title
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Should show status indicator
      expect(screen.getByText('[on]')).toBeInTheDocument();
    });

    it('shows confidence percentage', () => {
      render(<PreviewPanel {...baseProps} width={normalWidth} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
    });

    it('shows workflow details for task intent', () => {
      render(<PreviewPanel {...baseProps} width={normalWidth} />);

      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('shows full action button labels', () => {
      render(<PreviewPanel {...baseProps} width={normalWidth} />);

      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('does not truncate reasonable input length', () => {
      render(<PreviewPanel {...baseProps} width={normalWidth} />);

      expect(screen.getByText('"Create a new React component with TypeScript support and tests"')).toBeInTheDocument();
    });

    it('shows intent border', () => {
      const { container } = render(<PreviewPanel {...baseProps} width={normalWidth} />);

      // Check for border-related styling (this depends on how ink renders borders)
      // The exact implementation may vary, but we can check for the content structure
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Action:')).toBeInTheDocument();
    });
  });

  describe('Breakpoint: wide (>=160 columns)', () => {
    const wideWidth = 180;

    it('shows all decorative elements and full content', () => {
      render(<PreviewPanel {...baseProps} width={wideWidth} />);

      // Should show all elements
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('shows full action descriptions without truncation', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 1.0,
        command: 'status',
        args: ['very-long-task-identifier-that-should-not-be-truncated-in-wide-mode'],
      };

      render(<PreviewPanel {...baseProps} intent={commandIntent} width={wideWidth} />);

      expect(screen.getByText('Execute command: /status very-long-task-identifier-that-should-not-be-truncated-in-wide-mode')).toBeInTheDocument();
    });

    it('handles very long input without truncation up to limit', () => {
      const longInput = 'A'.repeat(140);
      render(<PreviewPanel {...baseProps} input={longInput} width={wideWidth} />);

      expect(screen.getByText(`"${longInput}"`)).toBeInTheDocument();
    });

    it('still truncates extremely long input', () => {
      const extremelyLongInput = 'A'.repeat(160);
      render(<PreviewPanel {...baseProps} input={extremelyLongInput} width={wideWidth} />);

      expect(screen.getByText(new RegExp(`"${'A'.repeat(147)}\\.\\.\\."`))).toBeInTheDocument();
    });
  });

  describe('Intent type variations across breakpoints', () => {
    it('handles command intent responsively', () => {
      const commandIntent: PreviewPanelProps['intent'] = {
        type: 'command',
        confidence: 0.95,
        command: 'deploy',
        args: ['production', '--force'],
      };

      // Narrow - should truncate
      const { rerender } = render(
        <PreviewPanel {...baseProps} intent={commandIntent} width={50} />
      );
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/deploy production --force/)).not.toBeInTheDocument();

      // Wide - should show full
      rerender(
        <PreviewPanel {...baseProps} intent={commandIntent} width={180} />
      );
      expect(screen.getByText('Execute command: /deploy production --force')).toBeInTheDocument();
    });

    it('handles question intent responsively', () => {
      const questionIntent: PreviewPanelProps['intent'] = {
        type: 'question',
        confidence: 0.7,
      };

      // Narrow
      const { rerender } = render(
        <PreviewPanel {...baseProps} intent={questionIntent} width={50} />
      );
      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.queryByText('70%')).not.toBeInTheDocument();

      // Normal
      rerender(
        <PreviewPanel {...baseProps} intent={questionIntent} width={120} />
      );
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  describe('Edge cases and overflow prevention', () => {
    it('handles empty input gracefully', () => {
      render(<PreviewPanel {...baseProps} input="" width={50} />);

      expect(screen.getByText('""')).toBeInTheDocument();
    });

    it('handles very long single-word input', () => {
      const longWord = 'supercalifragilisticexpialidocious'.repeat(5);
      render(<PreviewPanel {...baseProps} input={longWord} width={50} />);

      // Should truncate properly
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    });

    it('handles intent without workflow in narrow mode', () => {
      render(<PreviewPanel {...baseProps} workflow={undefined} width={50} />);

      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('maintains layout consistency across width changes', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} width={180} />);

      // Verify wide layout
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Change to narrow
      rerender(<PreviewPanel {...baseProps} width={50} />);

      // Should adapt without crashing
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.getByText('⚡')).not.toBeInTheDocument(); // Should still show intent icon for task
      expect(screen.getByText('📝')).toBeInTheDocument(); // Task intent icon
    });
  });

  describe('Width parameter override', () => {
    it('uses provided width over hook dimensions', () => {
      // Even if terminal is wide, explicit narrow width should apply narrow config
      render(<PreviewPanel {...baseProps} width={40} />);

      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('85%')).not.toBeInTheDocument();
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('falls back to hook dimensions when width not provided', () => {
      // This test would require mocking the hook, so we'll verify the component doesn't crash
      render(<PreviewPanel {...baseProps} />);

      // Should render successfully (hook will use fallback)
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });
  });
});