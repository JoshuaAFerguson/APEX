import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

describe('PreviewPanel Intent Detection Edge Cases', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    input: 'test input',
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
  };

  describe('extreme confidence values', () => {
    it('should handle confidence of 0', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('should handle confidence greater than 1', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 1.5 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('150%')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('should handle negative confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: -0.2 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('-20%')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('should handle very small confidence values', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.001 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('0%')).toBeInTheDocument(); // Rounded to 0%
    });

    it('should handle confidence with many decimal places', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.876543 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('88%')).toBeInTheDocument(); // Rounded to nearest percent
    });

    it('should handle NaN confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: NaN },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('NaN%')).toBeInTheDocument();
    });

    it('should handle Infinity confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: Infinity },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Infinity%')).toBeInTheDocument();
    });
  });

  describe('malformed intent objects', () => {
    it('should handle intent with missing type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { confidence: 0.8 } as any,
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle intent with missing confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task' } as any,
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle intent with null type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: null as any, confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      // Should show default unknown intent
      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
    });

    it('should handle intent with undefined confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: undefined as any },
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle completely malformed intent', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: null as any,
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle intent as string instead of object', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: 'task' as any,
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle intent with extra properties', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.8,
          extraProperty: 'unexpected',
          anotherExtra: 123,
          nested: { object: 'value' },
        } as any,
      };

      render(<PreviewPanel {...props} />);

      // Should render normally, ignoring extra properties
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('unknown intent types', () => {
    it('should handle completely unknown intent type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'completely-unknown' as any, confidence: 0.7 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
      expect(screen.getByText('Process input')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('should handle numeric intent type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 123 as any, confidence: 0.6 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
    });

    it('should handle boolean intent type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: true as any, confidence: 0.9 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
    });

    it('should handle object as intent type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: { nested: 'object' } as any, confidence: 0.5 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
    });

    it('should handle array as intent type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: ['array', 'type'] as any, confidence: 0.4 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
    });

    it('should handle empty string intent type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: '' as any, confidence: 0.3 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
    });
  });

  describe('command intent edge cases', () => {
    it('should handle command intent with empty command', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: '',
          args: [],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /')).toBeInTheDocument();
    });

    it('should handle command intent with missing command property', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          args: ['arg1', 'arg2'],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /undefined arg1 arg2')).toBeInTheDocument();
    });

    it('should handle command intent with null command', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: null as any,
          args: ['test'],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /null test')).toBeInTheDocument();
    });

    it('should handle command intent with missing args', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: 'test',
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /test')).toBeInTheDocument();
    });

    it('should handle command intent with null args', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: 'test',
          args: null as any,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /test')).toBeInTheDocument();
    });

    it('should handle command intent with non-array args', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: 'test',
          args: 'not an array' as any,
        },
      };

      render(<PreviewPanel {...props} />);

      // Should handle gracefully, probably showing the string as-is
      expect(() => screen.getByText(/Execute command:/)).not.toThrow();
    });

    it('should handle command intent with args containing special characters', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: 'test',
          args: ['arg with spaces', 'arg"with"quotes', 'arg\nwith\nnewlines', 'arg\ttab'],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /test arg with spaces arg"with"quotes arg\nwith\nnewlines arg\ttab')).toBeInTheDocument();
    });

    it('should handle command intent with very long command and args', () => {
      const longCommand = 'a'.repeat(100);
      const longArgs = ['x'.repeat(200), 'y'.repeat(300), 'z'.repeat(400)];

      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: longCommand,
          args: longArgs,
        },
      };

      render(<PreviewPanel {...props} />);

      // Should render without crashing, though might be truncated in display
      expect(screen.getByText(/Execute command:/)).toBeInTheDocument();
    });

    it('should handle command intent with numeric args', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: 'test',
          args: [123, 456.789, -10] as any,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Execute command: /test 123 456.789 -10')).toBeInTheDocument();
    });

    it('should handle command intent with mixed type args', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'command',
          confidence: 0.9,
          command: 'test',
          args: ['string', 123, true, null, undefined, { object: 'value' }] as any,
        },
      };

      render(<PreviewPanel {...props} />);

      // Should handle mixed types by converting to strings
      expect(screen.getByText(/Execute command: \/test/)).toBeInTheDocument();
    });
  });

  describe('metadata edge cases', () => {
    it('should handle intent with complex metadata', () => {
      const complexMetadata = {
        suggestedWorkflow: 'feature',
        complexity: 'high',
        estimatedTime: '2h',
        tags: ['frontend', 'react', 'ui'],
        nested: {
          deep: {
            object: 'value',
            array: [1, 2, 3],
          },
        },
        circular: null as any,
      };
      // Create circular reference
      complexMetadata.circular = complexMetadata;

      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.8,
          metadata: complexMetadata,
        },
      };

      render(<PreviewPanel {...props} />);

      // Should render without errors despite complex metadata
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('should handle intent with null metadata', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.8,
          metadata: null as any,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('should handle intent with undefined metadata', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.8,
          metadata: undefined,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('should handle intent with metadata as non-object', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.8,
          metadata: 'not an object' as any,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });

    it('should handle intent with metadata containing functions', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.8,
          metadata: {
            callback: () => console.log('test'),
            asyncCallback: async () => 'async result',
          },
        },
      };

      render(<PreviewPanel {...props} />);

      // Should render without executing the functions
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
    });
  });

  describe('extreme input scenarios', () => {
    it('should handle extremely long input text', () => {
      const longInput = 'a'.repeat(10000);

      const props: PreviewPanelProps = {
        ...baseProps,
        input: longInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      // Should display the long input, possibly truncated
    });

    it('should handle input with special characters and emojis', () => {
      const specialInput = 'Test input with special chars: ñáéíóú 中文 🎉🚀💻 \n\t\r\0';

      const props: PreviewPanelProps = {
        ...baseProps,
        input: specialInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    it('should handle input with HTML-like content', () => {
      const htmlInput = '<script>alert("xss")</script><div class="test">HTML content</div>';

      const props: PreviewPanelProps = {
        ...baseProps,
        input: htmlInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      // Should display as plain text, not execute as HTML
      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    it('should handle input with SQL injection attempts', () => {
      const sqlInput = "'; DROP TABLE users; --";

      const props: PreviewPanelProps = {
        ...baseProps,
        input: sqlInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      // Should display safely as text
      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    it('should handle input with regex special characters', () => {
      const regexInput = '.*+?^${}()|[]\\';

      const props: PreviewPanelProps = {
        ...baseProps,
        input: regexInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    it('should handle input with control characters', () => {
      const controlInput = 'text\x00\x01\x02\x03\x1F\x7F more text';

      const props: PreviewPanelProps = {
        ...baseProps,
        input: controlInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    it('should handle input with only whitespace', () => {
      const whitespaceInput = '   \n\t\r   ';

      const props: PreviewPanelProps = {
        ...baseProps,
        input: whitespaceInput,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
    });
  });

  describe('workflow edge cases', () => {
    it('should handle workflow with special characters', () => {
      const specialWorkflow = 'workflow-with-dashes_and_underscores.and.dots';

      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: specialWorkflow,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`Create task (${specialWorkflow} workflow)`)).toBeInTheDocument();
    });

    it('should handle very long workflow name', () => {
      const longWorkflow = 'very-long-workflow-name-that-exceeds-normal-length-expectations-and-might-cause-display-issues';

      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: longWorkflow,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Create task \(/)).toBeInTheDocument();
    });

    it('should handle workflow with non-string type', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: 123 as any,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task (123 workflow)')).toBeInTheDocument();
    });

    it('should handle null workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: null as any,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('should handle undefined workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: undefined,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('should handle empty string workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: '',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task ( workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });
  });

  describe('callback function edge cases', () => {
    it('should handle async callback functions', async () => {
      const asyncOnConfirm = vi.fn().mockResolvedValue('success');
      const asyncOnCancel = vi.fn().mockRejectedValue(new Error('cancel error'));
      const asyncOnEdit = vi.fn().mockResolvedValue(undefined);

      const props: PreviewPanelProps = {
        ...baseProps,
        onConfirm: asyncOnConfirm,
        onCancel: asyncOnCancel,
        onEdit: asyncOnEdit,
        intent: { type: 'task', confidence: 0.8 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // The component itself should render regardless of async callback behavior
    });

    it('should handle callback functions that throw errors', () => {
      const errorOnConfirm = vi.fn().mockImplementation(() => {
        throw new Error('Confirm error');
      });
      const errorOnCancel = vi.fn().mockImplementation(() => {
        throw new Error('Cancel error');
      });
      const errorOnEdit = vi.fn().mockImplementation(() => {
        throw new Error('Edit error');
      });

      const props: PreviewPanelProps = {
        ...baseProps,
        onConfirm: errorOnConfirm,
        onCancel: errorOnCancel,
        onEdit: errorOnEdit,
        intent: { type: 'task', confidence: 0.8 },
      };

      // Component should render without errors even with error-throwing callbacks
      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle undefined callback functions', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        onConfirm: undefined as any,
        onCancel: undefined as any,
        onEdit: undefined as any,
        intent: { type: 'task', confidence: 0.8 },
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });

    it('should handle non-function callback values', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        onConfirm: 'not a function' as any,
        onCancel: 123 as any,
        onEdit: { not: 'a function' } as any,
        intent: { type: 'task', confidence: 0.8 },
      };

      expect(() => render(<PreviewPanel {...props} />)).not.toThrow();
    });
  });
});