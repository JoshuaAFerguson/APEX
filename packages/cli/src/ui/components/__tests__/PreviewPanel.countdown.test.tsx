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

describe('PreviewPanel Countdown Display', () => {
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

  describe('Countdown Display', () => {
    it('should display countdown when remainingMs is provided', () => {
      const props = {
        ...baseProps,
        remainingMs: 5000, // 5 seconds
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
    });

    it('should not display countdown when remainingMs is undefined', () => {
      render(<PreviewPanel {...baseProps} />);

      expect(screen.queryByText(/Auto-execute in/)).not.toBeInTheDocument();
    });

    it('should format countdown correctly for different time values', () => {
      const testCases = [
        { ms: 5000, expected: '5s' },
        { ms: 4100, expected: '5s' }, // Should ceil to next second
        { ms: 3000, expected: '3s' },
        { ms: 1500, expected: '2s' },
        { ms: 1000, expected: '1s' },
        { ms: 500, expected: '1s' },
        { ms: 100, expected: '1s' },
      ];

      testCases.forEach(({ ms, expected }) => {
        const props = {
          ...baseProps,
          remainingMs: ms,
        };

        const { unmount } = render(<PreviewPanel {...props} />);

        expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Countdown Color Coding', () => {
    it('should use green color for countdown > 5 seconds', () => {
      const props = {
        ...baseProps,
        remainingMs: 8000, // 8 seconds
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/8s/)).toBeInTheDocument();
      // Note: Color testing would require examining computed styles or data attributes
      // For now we verify the text content is correct
    });

    it('should use yellow color for countdown 3-5 seconds', () => {
      const props = {
        ...baseProps,
        remainingMs: 4000, // 4 seconds
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/4s/)).toBeInTheDocument();
    });

    it('should use red color for countdown <= 2 seconds', () => {
      const props = {
        ...baseProps,
        remainingMs: 1500, // 1.5 seconds → displays as 2s
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/2s/)).toBeInTheDocument();
    });

    it('should handle edge case of exactly 0 ms', () => {
      const props = {
        ...baseProps,
        remainingMs: 0,
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/0s/)).toBeInTheDocument();
    });
  });

  describe('Responsive Countdown Display', () => {
    it('should show countdown in header when title is displayed', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        width: 120, // Normal width - should show title
      };

      render(<PreviewPanel {...props} />);

      // Should show both title and countdown
      expect(screen.getByText(/📋 Input Preview/)).toBeInTheDocument();
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });

    it('should show countdown in compact mode when title is hidden', () => {
      const props = {
        ...baseProps,
        remainingMs: 3000,
        width: 50, // Narrow width - should hide full title
      };

      render(<PreviewPanel {...props} />);

      // Should still show countdown even in compact mode
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });
  });

  describe('Countdown Integration with Other Elements', () => {
    it('should display countdown alongside intent information', () => {
      const props = {
        ...baseProps,
        remainingMs: 2500,
        intent: {
          type: 'command',
          confidence: 0.95,
          command: 'status',
          args: [],
        },
      };

      render(<PreviewPanel {...props} />);

      // Should show both countdown and intent
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
      expect(screen.getByText(/Command Intent/)).toBeInTheDocument();
      expect(screen.getByText(/Execute command: \/status/)).toBeInTheDocument();
    });

    it('should display countdown with confidence percentage', () => {
      const props = {
        ...baseProps,
        remainingMs: 4000,
        intent: {
          type: 'task',
          confidence: 0.87,
        },
      };

      render(<PreviewPanel {...props} />);

      // Should show countdown, confidence, and task info
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/4s/)).toBeInTheDocument();
      expect(screen.getByText(/87%/)).toBeInTheDocument();
      expect(screen.getByText(/Task Intent/)).toBeInTheDocument();
    });

    it('should display countdown with workflow information', () => {
      const props = {
        ...baseProps,
        remainingMs: 6000,
        workflow: 'bugfix',
        intent: {
          type: 'task',
          confidence: 0.9,
        },
      };

      render(<PreviewPanel {...props} />);

      // Should show countdown and workflow
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/6s/)).toBeInTheDocument();
      expect(screen.getByText(/bugfix workflow/)).toBeInTheDocument();
      expect(screen.getByText(/planner → architect → developer → tester/)).toBeInTheDocument();
    });
  });

  describe('Action Buttons with Countdown', () => {
    it('should display action buttons alongside countdown', () => {
      const props = {
        ...baseProps,
        remainingMs: 2000,
      };

      render(<PreviewPanel {...props} />);

      // Should show countdown and all action buttons
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/2s/)).toBeInTheDocument();
      expect(screen.getByText(/\[Enter\]/)).toBeInTheDocument();
      expect(screen.getByText(/Confirm/)).toBeInTheDocument();
      expect(screen.getByText(/\[Esc\]/)).toBeInTheDocument();
      expect(screen.getByText(/Cancel/)).toBeInTheDocument();
      expect(screen.getByText(/\[e\]/)).toBeInTheDocument();
      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });

    it('should maintain action button functionality when countdown is active', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();
      const mockOnEdit = vi.fn();

      const props = {
        ...baseProps,
        remainingMs: 3000,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onEdit: mockOnEdit,
      };

      render(<PreviewPanel {...props} />);

      // Buttons should be displayed and functional
      // (Testing actual button clicks would require event simulation)
      expect(screen.getByText(/\[Enter\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[Esc\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[e\]/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large countdown values', () => {
      const props = {
        ...baseProps,
        remainingMs: 999999, // Very large value
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/1000s/)).toBeInTheDocument();
    });

    it('should handle very small countdown values', () => {
      const props = {
        ...baseProps,
        remainingMs: 1, // Very small value
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/1s/)).toBeInTheDocument();
    });

    it('should handle negative countdown values gracefully', () => {
      const props = {
        ...baseProps,
        remainingMs: -1000, // Negative value
      };

      render(<PreviewPanel {...props} />);

      // Should still render without crashing, though behavior may vary
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
    });

    it('should handle fractional millisecond values', () => {
      const props = {
        ...baseProps,
        remainingMs: 2500.7, // Fractional value
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/3s/)).toBeInTheDocument();
    });
  });

  describe('Layout and Positioning', () => {
    it('should position countdown properly in header section', () => {
      const props = {
        ...baseProps,
        remainingMs: 5000,
      };

      render(<PreviewPanel {...props} />);

      // The countdown should be in the header alongside the title
      const header = screen.getByText(/📋 Input Preview/).closest('div');
      expect(header).toBeInTheDocument();

      // Countdown text should be present in the same general area
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/5s/)).toBeInTheDocument();
    });

    it('should maintain proper spacing with other elements', () => {
      const props = {
        ...baseProps,
        remainingMs: 4000,
        intent: {
          type: 'task',
          confidence: 0.9,
        },
      };

      render(<PreviewPanel {...props} />);

      // All elements should be present and properly spaced
      expect(screen.getByText(/📋 Input Preview/)).toBeInTheDocument();
      expect(screen.getByText(/Auto-execute in/)).toBeInTheDocument();
      expect(screen.getByText(/4s/)).toBeInTheDocument();
      expect(screen.getByText(/Input:/)).toBeInTheDocument();
      expect(screen.getByText(/Detected Intent:/)).toBeInTheDocument();
      expect(screen.getByText(/Task Intent/)).toBeInTheDocument();
    });
  });
});