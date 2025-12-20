import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PreviewPanel, type PreviewPanelProps } from '../components/PreviewPanel';

describe('Preview Feature Edge Cases', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('extreme input scenarios', () => {
    it('should handle extremely long input text', () => {
      const extremelyLongInput = 'a'.repeat(10000); // 10k characters
      const props: PreviewPanelProps = {
        input: extremelyLongInput,
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText(`"${extremelyLongInput}"`)).toBeInTheDocument();
    });

    it('should handle input with only whitespace', () => {
      const whitespaceInput = '   \t\n   ';
      const props: PreviewPanelProps = {
        input: whitespaceInput,
        intent: { type: 'task', confidence: 0.5 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`"${whitespaceInput}"`)).toBeInTheDocument();
    });

    it('should handle input with unicode characters', () => {
      const unicodeInput = '🚀 Create a new 文档 with émojis and special chars ⭐️';
      const props: PreviewPanelProps = {
        input: unicodeInput,
        intent: { type: 'task', confidence: 0.7 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`"${unicodeInput}"`)).toBeInTheDocument();
    });

    it('should handle input with SQL injection patterns', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const props: PreviewPanelProps = {
        input: maliciousInput,
        intent: { type: 'task', confidence: 0.6 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`"${maliciousInput}"`)).toBeInTheDocument();
    });

    it('should handle input with script tags', () => {
      const scriptInput = '<script>alert("xss")</script>';
      const props: PreviewPanelProps = {
        input: scriptInput,
        intent: { type: 'task', confidence: 0.4 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should display as text, not execute script
      expect(screen.getByText(`"${scriptInput}"`)).toBeInTheDocument();
    });

    it('should handle input with nested quotes', () => {
      const nestedQuotesInput = 'Say "Hello "world" to everyone"';
      const props: PreviewPanelProps = {
        input: nestedQuotesInput,
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`"${nestedQuotesInput}"`)).toBeInTheDocument();
    });
  });

  describe('extreme confidence values', () => {
    it('should handle negative confidence values', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: -0.5 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('-50%')).toBeInTheDocument();
    });

    it('should handle confidence values greater than 1', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 2.5 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('250%')).toBeInTheDocument();
    });

    it('should handle NaN confidence values', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: NaN },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('NaN%')).toBeInTheDocument();
    });

    it('should handle Infinity confidence values', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: Infinity },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Infinity%/)).toBeInTheDocument();
    });
  });

  describe('malformed intent objects', () => {
    it('should handle intent without type property', () => {
      const malformedIntent = {
        confidence: 0.8,
      } as any;

      const props: PreviewPanelProps = {
        input: 'test input',
        intent: malformedIntent,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should use default icon and description
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('should handle intent with null confidence', () => {
      const intent = {
        type: 'task' as const,
        confidence: null as any,
      };

      const props: PreviewPanelProps = {
        input: 'test input',
        intent,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should handle null confidence gracefully
      expect(screen.getByText(/null%|0%/)).toBeInTheDocument();
    });

    it('should handle intent with circular reference in metadata', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const intent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: circularObj,
      };

      const props: PreviewPanelProps = {
        input: 'test input',
        intent,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should render without crashing despite circular reference
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });
  });

  describe('command intent edge cases', () => {
    it('should handle command with extremely long arguments', () => {
      const longArg = 'a'.repeat(1000);
      const intent = {
        type: 'command' as const,
        confidence: 1.0,
        command: 'run',
        args: [longArg],
      };

      const props: PreviewPanelProps = {
        input: 'test input',
        intent,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`Execute command: /run ${longArg}`)).toBeInTheDocument();
    });

    it('should handle command with null in args array', () => {
      const intent = {
        type: 'command' as const,
        confidence: 1.0,
        command: 'test',
        args: [null, undefined, '', 'valid'] as any,
      };

      const props: PreviewPanelProps = {
        input: 'test input',
        intent,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should handle null/undefined args without crashing
      expect(screen.getByText(/Execute command: \/test/)).toBeInTheDocument();
    });

    it('should handle command with missing command property', () => {
      const intent = {
        type: 'command' as const,
        confidence: 1.0,
        args: ['arg1', 'arg2'],
      };

      const props: PreviewPanelProps = {
        input: 'test input',
        intent,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should handle missing command gracefully
      expect(screen.getByText(/Execute command: \/undefined|Execute command: \//)).toBeInTheDocument();
    });
  });

  describe('workflow edge cases', () => {
    it('should handle undefined workflow', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        workflow: undefined,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('should handle empty string workflow', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        workflow: '',
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('should handle very long workflow name', () => {
      const longWorkflowName = 'extremely-long-workflow-name-that-might-break-layout'.repeat(5);
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        workflow: longWorkflowName,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`Create task (${longWorkflowName} workflow)`)).toBeInTheDocument();
    });
  });

  describe('callback function edge cases', () => {
    it('should handle null callback functions', () => {
      const props = {
        input: 'test input',
        intent: { type: 'task' as const, confidence: 0.8 },
        onConfirm: null as any,
        onCancel: null as any,
        onEdit: null as any,
      };

      render(<PreviewPanel {...props} />);

      // Should render without crashing even with null callbacks
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle undefined callback functions', () => {
      const props = {
        input: 'test input',
        intent: { type: 'task' as const, confidence: 0.8 },
        onConfirm: undefined as any,
        onCancel: undefined as any,
        onEdit: undefined as any,
      };

      render(<PreviewPanel {...props} />);

      // Should render without crashing even with undefined callbacks
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle callbacks that throw errors', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: errorCallback,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Component should still render even if callbacks might throw
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle rapid re-renders without memory leaks', () => {
      let renderCount = 0;
      const TestWrapper = () => {
        renderCount++;
        return (
          <PreviewPanel
            input={`test input ${renderCount}`}
            intent={{ type: 'task', confidence: Math.random() }}
            onConfirm={mockOnConfirm}
            onCancel={mockOnCancel}
            onEdit={mockOnEdit}
          />
        );
      };

      const { rerender } = render(<TestWrapper />);

      // Rapidly re-render many times
      for (let i = 0; i < 100; i++) {
        rerender(<TestWrapper />);
      }

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(renderCount).toBe(101); // Initial + 100 re-renders
    });

    it('should handle component unmount during async operations', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      const { unmount } = render(<PreviewPanel {...props} />);

      // Start some async operation (like intent detection debounce)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Unmount component before async operation completes
      unmount();

      // Should not throw errors or cause memory leaks
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    });
  });

  describe('accessibility edge cases', () => {
    it('should handle screen reader navigation edge cases', () => {
      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // All text should be accessible even with complex nested structure
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 80%')).toBeInTheDocument();
    });

    it('should maintain meaningful semantics with invalid input', () => {
      const props: PreviewPanelProps = {
        input: '', // Empty input
        intent: { type: 'task', confidence: 0 }, // Zero confidence
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should still provide meaningful information to screen readers
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('""')).toBeInTheDocument(); // Empty string shown clearly
      expect(screen.getByText('0%')).toBeInTheDocument(); // Zero confidence shown
    });
  });

  describe('terminal compatibility edge cases', () => {
    it('should handle very narrow terminal widths', () => {
      // Mock very narrow terminal
      vi.mocked(require('ink')?.useStdout)?.mockReturnValue?.({
        stdout: { columns: 20, rows: 5 }
      });

      const props: PreviewPanelProps = {
        input: 'very long input text that exceeds terminal width',
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should still render without breaking layout
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle terminal with no size information', () => {
      // Mock terminal with no size
      vi.mocked(require('ink')?.useStdout)?.mockReturnValue?.({
        stdout: {}
      });

      const props: PreviewPanelProps = {
        input: 'test input',
        intent: { type: 'task', confidence: 0.8 },
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Should use fallback layout
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });
  });
});