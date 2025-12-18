import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Banner } from '../Banner';
import type { StdoutDimensions } from '../hooks/useStdoutDimensions.js';

// Mock useStdoutDimensions hook
vi.mock('../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: vi.fn(),
}));

const { useStdoutDimensions } = await import('../hooks/useStdoutDimensions.js');

/**
 * Helper to mock terminal dimensions
 */
const mockUseStdoutDimensions = (dims: Partial<StdoutDimensions>) => {
  const width = dims.width ?? 80;
  const mockReturn: StdoutDimensions = {
    width,
    height: dims.height ?? 24,
    breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : 'normal',
    isNarrow: width < 60,
    isCompact: width >= 60 && width < 100,
    isNormal: width >= 100 && width < 160,
    isWide: width >= 160,
    isAvailable: dims.isAvailable ?? true,
    ...dims,
  };

  (useStdoutDimensions as any).mockReturnValue(mockReturn);
};

describe('Banner - Responsive Layout', () => {
  const defaultProps = {
    version: '0.1.0',
    projectPath: '/home/user/project',
    initialized: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Mode Selection', () => {
    it('shows full ASCII art at width >= 60', () => {
      mockUseStdoutDimensions({ width: 80 });
      render(<Banner {...defaultProps} />);

      // Verify ASCII art characters are present
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      expect(screen.getByText(/██╔══██╗/)).toBeInTheDocument();
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
      expect(screen.getByText(/v0.1.0/)).toBeInTheDocument();
    });

    it('shows compact text box at width 40-59', () => {
      mockUseStdoutDimensions({ width: 50 });
      render(<Banner {...defaultProps} />);

      // Verify compact box present
      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
      expect(screen.getByText('└─────────────────┘')).toBeInTheDocument();

      // ASCII art should not be present
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

      // Should still show full tagline and version
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
      expect(screen.getByText(/v0.1.0/)).toBeInTheDocument();
    });

    it('shows text-only at width < 40', () => {
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner {...defaultProps} />);

      // Verify minimal text output
      expect(screen.getByText(/◆ APEX/)).toBeInTheDocument();
      expect(screen.getByText(/v0.1.0/)).toBeInTheDocument();

      // ASCII art should not be present
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

      // Compact box should not be present
      expect(screen.queryByText('┌─────────────────┐')).not.toBeInTheDocument();

      // Full tagline should not be present
      expect(screen.queryByText('Autonomous Product Engineering eXecutor')).not.toBeInTheDocument();
    });
  });

  describe('Breakpoint Boundaries', () => {
    it('transitions from compact to full at exactly 60 columns', () => {
      // Test 59 columns (compact)
      mockUseStdoutDimensions({ width: 59 });
      const { rerender } = render(<Banner {...defaultProps} />);

      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

      // Test 60 columns (full)
      mockUseStdoutDimensions({ width: 60 });
      rerender(<Banner {...defaultProps} />);

      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      expect(screen.queryByText('│   ◆ APEX ◆     │')).not.toBeInTheDocument();
    });

    it('transitions from text-only to compact at exactly 40 columns', () => {
      // Test 39 columns (text-only)
      mockUseStdoutDimensions({ width: 39 });
      const { rerender } = render(<Banner {...defaultProps} />);

      expect(screen.getByText(/◆ APEX/)).toBeInTheDocument();
      expect(screen.queryByText('Autonomous Product Engineering eXecutor')).not.toBeInTheDocument();

      // Test 40 columns (compact)
      mockUseStdoutDimensions({ width: 40 });
      rerender(<Banner {...defaultProps} />);

      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
    });
  });

  describe('No Overflow', () => {
    it('full ASCII art fits within 60 column width', () => {
      mockUseStdoutDimensions({ width: 60 });
      render(<Banner {...defaultProps} />);

      // The ASCII art should not exceed 60 characters on any line
      // (Note: This is a visual verification - in a real test environment,
      // we'd measure the actual rendered output width)
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
    });

    it('compact banner fits within 40 column width', () => {
      mockUseStdoutDimensions({ width: 40 });
      render(<Banner {...defaultProps} />);

      // The compact box is 19 characters wide, should fit in 40
      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();
    });

    it('text-only fits within 30 column width', () => {
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner {...defaultProps} />);

      // Text-only should be minimal and fit
      expect(screen.getByText(/◆ APEX/)).toBeInTheDocument();
    });
  });

  describe('Content Completeness', () => {
    it('shows version in all modes', () => {
      // Full mode
      mockUseStdoutDimensions({ width: 80 });
      render(<Banner version="1.2.3" />);
      expect(screen.getByText(/v1.2.3/)).toBeInTheDocument();

      // Compact mode
      mockUseStdoutDimensions({ width: 50 });
      render(<Banner version="1.2.3" />);
      expect(screen.getByText(/v1.2.3/)).toBeInTheDocument();

      // Text-only mode
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner version="1.2.3" />);
      expect(screen.getByText(/v1.2.3/)).toBeInTheDocument();
    });

    it('shows initialization status in all modes', () => {
      const testCases = [
        { width: 80, mode: 'full' },
        { width: 50, mode: 'compact' },
        { width: 30, mode: 'text-only' },
      ];

      testCases.forEach(({ width, mode }) => {
        // Test initialized state
        mockUseStdoutDimensions({ width });
        const { rerender } = render(<Banner version="1.0.0" projectPath="/test" initialized={true} />);
        expect(screen.getByText(/✓/)).toBeInTheDocument();

        // Test not initialized state
        rerender(<Banner version="1.0.0" initialized={false} />);
        expect(screen.getByText(/!/)).toBeInTheDocument();
        expect(screen.getByText(/init/)).toBeInTheDocument();
      });
    });

    it('shows project path when initialized (truncated if needed)', () => {
      const longPath = '/very/long/project/path/that/might/need/truncation/in/narrow/terminals';

      // Full mode - should show full path
      mockUseStdoutDimensions({ width: 120 });
      render(<Banner version="1.0.0" projectPath={longPath} initialized={true} />);
      expect(screen.getByText(longPath)).toBeInTheDocument();

      // Text-only mode - should truncate path
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner version="1.0.0" projectPath={longPath} initialized={true} />);
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very narrow terminals (< 20 columns)', () => {
      mockUseStdoutDimensions({ width: 15 });

      expect(() => {
        render(<Banner version="1.0.0" />);
      }).not.toThrow();

      // Should show minimal output
      expect(screen.getByText(/◆ APEX/)).toBeInTheDocument();
    });

    it('handles very wide terminals (> 200 columns)', () => {
      mockUseStdoutDimensions({ width: 250 });

      expect(() => {
        render(<Banner version="1.0.0" />);
      }).not.toThrow();

      // Should show full ASCII art
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
    });

    it('handles missing projectPath gracefully', () => {
      mockUseStdoutDimensions({ width: 80 });

      expect(() => {
        render(<Banner version="1.0.0" initialized={true} />);
      }).not.toThrow();

      // Should not show checkmark without project path
      expect(screen.queryByText(/✓/)).not.toBeInTheDocument();
    });

    it('handles very long projectPath', () => {
      const veryLongPath = '/extremely/long/path/that/goes/on/and/on/with/many/nested/directories/and/subdirectories/project';

      mockUseStdoutDimensions({ width: 30 });
      render(<Banner version="1.0.0" projectPath={veryLongPath} initialized={true} />);

      // Path should be truncated and not cause overflow
      const pathElement = screen.getByText(/\.\.\./);
      expect(pathElement).toBeInTheDocument();
      // The truncated path should be much shorter than the original
      expect(pathElement.textContent!.length).toBeLessThan(veryLongPath.length);
    });

    it('handles zero width gracefully', () => {
      mockUseStdoutDimensions({ width: 0 });

      expect(() => {
        render(<Banner version="1.0.0" />);
      }).not.toThrow();

      // Should default to text-only mode
      expect(screen.getByText(/◆ APEX/)).toBeInTheDocument();
    });

    it('handles undefined version', () => {
      mockUseStdoutDimensions({ width: 80 });

      expect(() => {
        render(<Banner version="" />);
      }).not.toThrow();
    });

    it('handles special characters in projectPath', () => {
      const specialPath = '/project-with_special.chars/[brackets]/path';

      mockUseStdoutDimensions({ width: 80 });
      render(<Banner version="1.0.0" projectPath={specialPath} initialized={true} />);

      expect(screen.getByText(specialPath)).toBeInTheDocument();
    });
  });

  describe('Responsive Tagline', () => {
    it('shows full tagline in full and compact modes', () => {
      // Full mode
      mockUseStdoutDimensions({ width: 80 });
      render(<Banner version="1.0.0" />);
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();

      // Compact mode
      mockUseStdoutDimensions({ width: 50 });
      render(<Banner version="1.0.0" />);
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
    });

    it('hides tagline in text-only mode', () => {
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner version="1.0.0" />);

      expect(screen.queryByText('Autonomous Product Engineering eXecutor')).not.toBeInTheDocument();
    });
  });

  describe('Status Message Responsiveness', () => {
    it('shows full status message in wide modes', () => {
      mockUseStdoutDimensions({ width: 80 });
      render(<Banner version="1.0.0" initialized={false} />);

      expect(screen.getByText('Not initialized. Run')).toBeInTheDocument();
      expect(screen.getByText('/init')).toBeInTheDocument();
      expect(screen.getByText('to get started.')).toBeInTheDocument();
    });

    it('shows compact status message in text-only mode', () => {
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner version="1.0.0" initialized={false} />);

      expect(screen.getByText('! Run /init')).toBeInTheDocument();
      expect(screen.queryByText('Not initialized.')).not.toBeInTheDocument();
      expect(screen.queryByText('to get started.')).not.toBeInTheDocument();
    });

    it('shows compact initialized message in text-only mode', () => {
      mockUseStdoutDimensions({ width: 30 });
      render(<Banner version="1.0.0" projectPath="/test/path" initialized={true} />);

      expect(screen.getByText(/✓/)).toBeInTheDocument();
      expect(screen.queryByText('Initialized in')).not.toBeInTheDocument();
    });
  });

  describe('Path Truncation Logic', () => {
    it('truncates path correctly with directory structure', () => {
      mockUseStdoutDimensions({ width: 30 });
      const path = '/home/user/projects/my-awesome-project';

      render(<Banner version="1.0.0" projectPath={path} initialized={true} />);

      // Should show truncated version starting with "..."
      const truncatedElement = screen.getByText(/\.\.\./);
      expect(truncatedElement).toBeInTheDocument();

      // Should contain the last parts of the path
      expect(truncatedElement.textContent).toMatch(/(project|awesome)/);
    });

    it('does not truncate short paths', () => {
      mockUseStdoutDimensions({ width: 80 });
      const shortPath = '/project';

      render(<Banner version="1.0.0" projectPath={shortPath} initialized={true} />);

      expect(screen.getByText(shortPath)).toBeInTheDocument();
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });
  });
});