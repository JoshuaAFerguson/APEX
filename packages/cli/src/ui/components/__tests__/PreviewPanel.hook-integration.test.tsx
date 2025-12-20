import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';

// Mock the useStdoutDimensions hook to test integration
const mockUseStdoutDimensions = vi.fn();

vi.mock('../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: (options: any) => mockUseStdoutDimensions(options),
}));

describe('PreviewPanel - Hook Integration Tests', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  const baseProps: PreviewPanelProps = {
    input: 'Integration test input',
    intent: {
      type: 'task',
      confidence: 0.8,
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
    mockUseStdoutDimensions.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook fallback behavior', () => {
    it('uses hook dimensions when no explicit width provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<PreviewPanel {...baseProps} />);

      // Hook should be called with default fallback
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 80,
      });

      // Should use normal breakpoint behavior
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('overrides hook breakpoint when explicit width provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120, // Hook thinks it's normal
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      // But we explicitly set narrow width
      render(<PreviewPanel {...baseProps} width={50} />);

      // Should use narrow configuration despite hook returning normal
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('80%')).not.toBeInTheDocument();
    });

    it('handles hook returning unavailable dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // Fallback width
        height: 24, // Fallback height
        breakpoint: 'compact',
        isAvailable: false, // Dimensions not available
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<PreviewPanel {...baseProps} />);

      // Should still render with fallback dimensions
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.queryByText('[on]')).not.toBeInTheDocument(); // Compact mode
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument(); // Compact shows confidence
    });
  });

  describe('Breakpoint classification integration', () => {
    it('correctly applies narrow breakpoint from hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      render(<PreviewPanel {...baseProps} />);

      // Should apply narrow configuration
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('80%')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();

      // But core elements should be present
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('correctly applies compact breakpoint from hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 75,
        height: 25,
        breakpoint: 'compact',
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<PreviewPanel {...baseProps} />);

      // Should apply compact configuration
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.queryByText('[on]')).not.toBeInTheDocument(); // No status indicator
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument(); // No workflow details
      expect(screen.getByText('80%')).toBeInTheDocument(); // Shows confidence
      expect(screen.getByText('Confirm')).toBeInTheDocument(); // Shows button labels
    });

    it('correctly applies normal breakpoint from hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 130,
        height: 35,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<PreviewPanel {...baseProps} />);

      // Should apply normal configuration
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument(); // Status indicator
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument(); // Workflow details
      expect(screen.getByText('80%')).toBeInTheDocument(); // Confidence
      expect(screen.getByText('Confirm')).toBeInTheDocument(); // Button labels
    });

    it('correctly applies wide breakpoint from hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      render(<PreviewPanel {...baseProps} />);

      // Should apply wide configuration (similar to normal but with higher limits)
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument(); // Status indicator
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument(); // Workflow details
      expect(screen.getByText('80%')).toBeInTheDocument(); // Confidence
      expect(screen.getByText('Confirm')).toBeInTheDocument(); // Button labels
    });
  });

  describe('Width override vs hook interaction', () => {
    it('ignores hook breakpoint when explicit width forces different classification', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200, // Hook says wide
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      // But explicit width forces narrow
      render(<PreviewPanel {...baseProps} width={45} />);

      // Should use narrow configuration despite hook returning wide
      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('[on]')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('80%')).not.toBeInTheDocument();
    });

    it('uses hook breakpoint when explicit width aligns', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      // Explicit width also maps to normal (100-159)
      render(<PreviewPanel {...baseProps} width={120} />);

      // Should use normal configuration
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Hook configuration integration', () => {
    it('passes correct fallback configuration to hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: false,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });

      render(<PreviewPanel {...baseProps} />);

      // Verify hook was called with expected fallback
      expect(mockUseStdoutDimensions).toHaveBeenCalledWith({
        fallbackWidth: 80,
      });
    });

    it('handles hook configuration errors gracefully', () => {
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook configuration error');
      });

      // Should not crash even if hook throws
      expect(() => {
        render(<PreviewPanel {...baseProps} width={120} />);
      }).not.toThrow();
    });

    it('handles hook returning undefined/null gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue(null);

      expect(() => {
        render(<PreviewPanel {...baseProps} width={120} />);
      }).not.toThrow();

      // Should still render with explicit width
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });
  });

  describe('Dynamic breakpoint changes', () => {
    it('handles hook returning different breakpoints on re-render', () => {
      // Start with narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const { rerender } = render(<PreviewPanel {...baseProps} />);

      expect(screen.queryByText('📋 Input Preview')).not.toBeInTheDocument();

      // Hook returns wide on re-render
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      rerender(<PreviewPanel {...baseProps} />);

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });

    it('maintains component stability during breakpoint transitions', () => {
      const breakpointSequence = [
        { breakpoint: 'narrow', width: 50 },
        { breakpoint: 'compact', width: 80 },
        { breakpoint: 'normal', width: 120 },
        { breakpoint: 'wide', width: 180 },
      ];

      const { rerender } = render(<PreviewPanel {...baseProps} />);

      breakpointSequence.forEach(({ breakpoint, width }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: breakpoint as any,
          isAvailable: true,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
        });

        rerender(<PreviewPanel {...baseProps} />);

        // Core elements should always be present
        expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
        expect(screen.getByText('[Enter]')).toBeInTheDocument();
        expect(screen.getByText('[Esc]')).toBeInTheDocument();
        expect(screen.getByText('[e]')).toBeInTheDocument();
      });
    });
  });

  describe('Hook memoization integration', () => {
    it('respects hook memoization when width stays the same', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const { rerender } = render(<PreviewPanel {...baseProps} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<PreviewPanel {...baseProps} />);

      // Hook should be called again since it's on each render
      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(2);

      // But the component should render consistently
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
    });

    it('handles hook returning different objects with same values', () => {
      // First render
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const { rerender } = render(<PreviewPanel {...baseProps} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Second render with new object but same values
      mockUseStdoutDimensions.mockReturnValue({
        width: 120, // Same values
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      rerender(<PreviewPanel {...baseProps} />);

      // Should render consistently
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
    });
  });
});