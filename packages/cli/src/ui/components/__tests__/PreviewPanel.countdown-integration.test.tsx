import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

// Mock the hook
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 30,
    breakpoint: 'normal' as const,
  }),
}));

describe('PreviewPanel Countdown Integration Tests', () => {
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

  describe('Countdown with Different Intent Types', () => {
    it('should display countdown with command intent', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        intent: {
          type: 'command' as const,
          confidence: 0.95,
          command: 'status',
          args: ['--verbose'],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(/Command Intent/)).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/status --verbose/)).toBeInTheDocument();
    });

    it('should display countdown with question intent', () => {
      const props = {
        ...baseProps,
        remainingMs: 4500,
        intent: {
          type: 'question' as const,
          confidence: 0.85,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
      expect(screen.getByText(/Question Intent/)).toBeInTheDocument();
      expect(screen.getByText(/Answer question/)).toBeInTheDocument();
    });

    it('should display countdown with clarification intent', () => {
      const props = {
        ...baseProps,
        remainingMs: 2700,
        intent: {
          type: 'clarification' as const,
          confidence: 0.75,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(/Clarification Intent/)).toBeInTheDocument();
      expect(screen.getByText(/Provide clarification/)).toBeInTheDocument();
    });
  });

  describe('Countdown with Different Workflows', () => {
    it('should display countdown with bugfix workflow', () => {
      const props = {
        ...baseProps,
        remainingMs: 5000,
        workflow: 'bugfix',
        intent: {
          type: 'task' as const,
          confidence: 0.9,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
      expect(screen.getByText(/bugfix workflow/)).toBeInTheDocument();
      expect(screen.getByText(/planner → architect → developer → tester/)).toBeInTheDocument();
    });

    it('should display countdown with feature workflow', () => {
      const props = {
        ...baseProps,
        remainingMs: 6000,
        workflow: 'feature',
        intent: {
          type: 'task' as const,
          confidence: 0.88,
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/6s/)).toBeInTheDocument();
      expect(screen.getByText(/feature workflow/)).toBeInTheDocument();
      expect(screen.getByText(/planner → architect → developer → tester/)).toBeInTheDocument();
    });

    it('should display countdown without workflow details for non-task intents', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        workflow: 'feature',
        intent: {
          type: 'command' as const,
          confidence: 0.9,
          command: 'help',
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.queryByText(/feature workflow/)).not.toBeInTheDocument();
      expect(screen.queryByText(/planner → architect → developer → tester/)).not.toBeInTheDocument();
    });
  });

  describe('Countdown with Different Confidence Levels', () => {
    it('should display countdown with high confidence (green)', () => {
      const props = {
        ...baseProps,
        remainingMs: 8000, // > 5s should be green
        intent: {
          type: 'task' as const,
          confidence: 0.95, // High confidence
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/8s/)).toBeInTheDocument();
      expect(screen.getByText(/95%/)).toBeInTheDocument();
    });

    it('should display countdown with medium confidence (yellow)', () => {
      const props = {
        ...baseProps,
        remainingMs: 4000, // 3-5s should be yellow
        intent: {
          type: 'task' as const,
          confidence: 0.75, // Medium confidence
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/4s/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('should display countdown with low confidence (red)', () => {
      const props = {
        ...baseProps,
        remainingMs: 1500, // <= 2s should be red
        intent: {
          type: 'task' as const,
          confidence: 0.55, // Low confidence
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/2s/)).toBeInTheDocument();
      expect(screen.getByText(/55%/)).toBeInTheDocument();
    });
  });

  describe('Countdown in Responsive Layouts', () => {
    it('should display countdown in narrow layout', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        width: 50, // Narrow width
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();

      // In narrow mode, should show simplified preview
      expect(screen.getByText(/📋 Preview/)).toBeInTheDocument();
      expect(screen.queryByText(/📋 Input Preview/)).not.toBeInTheDocument();
    });

    it('should display countdown in compact layout', () => {
      const props = {
        ...baseProps,
        remainingMs: 4000,
        width: 80, // Compact width
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/4s/)).toBeInTheDocument();
      expect(screen.getByText(/📋 Input Preview/)).toBeInTheDocument();
    });

    it('should display countdown in wide layout', () => {
      const props = {
        ...baseProps,
        remainingMs: 5000,
        width: 200, // Wide width
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
      expect(screen.getByText(/📋 Input Preview/)).toBeInTheDocument();
    });
  });

  describe('Countdown with Complex Input Scenarios', () => {
    it('should display countdown with very long input', () => {
      const longInput = 'This is a very long input that should be truncated in narrow mode but displayed fully in wider modes. '.repeat(5);
      const props = {
        ...baseProps,
        remainingMs: 3000,
        input: longInput,
        width: 120,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(longInput.substring(0, 50)))).toBeInTheDocument();
    });

    it('should display countdown with special characters in input', () => {
      const props = {
        ...baseProps,
        remainingMs: 2500,
        input: 'Input with émojis 🚀 and spéçial çhars!',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(/Input with émojis 🚀 and spéçial çhars!/)).toBeInTheDocument();
    });

    it('should display countdown with empty input', () => {
      const props = {
        ...baseProps,
        remainingMs: 1800,
        input: '',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/2s/)).toBeInTheDocument();
      expect(screen.getByText(/Input:/)).toBeInTheDocument();
    });
  });

  describe('Countdown with Command Arguments', () => {
    it('should display countdown with command with multiple arguments', () => {
      const props = {
        ...baseProps,
        remainingMs: 3500,
        intent: {
          type: 'command' as const,
          confidence: 0.92,
          command: 'git',
          args: ['commit', '-m', 'Test commit'],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/4s/)).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/git commit -m Test commit/)).toBeInTheDocument();
    });

    it('should display countdown with command without arguments', () => {
      const props = {
        ...baseProps,
        remainingMs: 2200,
        intent: {
          type: 'command' as const,
          confidence: 0.88,
          command: 'status',
          args: [],
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/status/)).toBeInTheDocument();
    });

    it('should display countdown with command with undefined arguments', () => {
      const props = {
        ...baseProps,
        remainingMs: 4200,
        intent: {
          type: 'command' as const,
          confidence: 0.85,
          command: 'help',
          // args is undefined
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/help/)).toBeInTheDocument();
    });
  });

  describe('Countdown State Management', () => {
    it('should maintain countdown state during re-renders', () => {
      const props = {
        ...baseProps,
        remainingMs: 5000,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      expect(screen.getByText(/5s/)).toBeInTheDocument();

      // Re-render with updated countdown
      rerender(<PreviewPanel {...props} remainingMs={3000} />);

      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.queryByText(/5s/)).not.toBeInTheDocument();
    });

    it('should handle countdown removal during re-renders', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
      };

      const { rerender } = render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();

      // Re-render without countdown
      rerender(<PreviewPanel {...props} remainingMs={undefined} />);

      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
      expect(screen.queryByText(/3s/)).not.toBeInTheDocument();
    });

    it('should handle countdown addition during re-renders', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} />);

      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();

      // Re-render with countdown
      rerender(<PreviewPanel {...baseProps} remainingMs={4000} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/4s/)).toBeInTheDocument();
    });
  });

  describe('Countdown Accessibility', () => {
    it('should provide accessible text for screen readers', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
      };

      render(<PreviewPanel {...props} />);

      // The countdown text should be readable by screen readers
      const countdownText = screen.getByText(/Auto-execute in/);
      expect(countdownText).toBeInTheDocument();

      const timeText = screen.getByText(/3s/);
      expect(timeText).toBeInTheDocument();
    });

    it('should maintain accessibility with other UI elements', () => {
      const props = {
        ...baseProps,
        remainingMs: 2000,
        intent: {
          type: 'task' as const,
          confidence: 0.9,
        },
      };

      render(<PreviewPanel {...props} />);

      // All important elements should be accessible
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/2s/)).toBeInTheDocument();
      expect(screen.getByText(/Detected Intent:/)).toBeInTheDocument();
      expect(screen.getByText(/Task Intent/)).toBeInTheDocument();
      expect(screen.getByText(/\[Enter\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[Esc\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[e\]/)).toBeInTheDocument();
    });
  });
});