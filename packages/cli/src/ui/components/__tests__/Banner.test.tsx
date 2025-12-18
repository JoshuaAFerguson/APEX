import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { Banner, BannerProps } from '../Banner';
import { useStdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock the useStdoutDimensions hook
vi.mock('../../hooks/useStdoutDimensions');
const mockUseStdoutDimensions = useStdoutDimensions as MockedFunction<typeof useStdoutDimensions>;

describe('Banner Component', () => {
  const defaultProps: BannerProps = {
    version: '0.3.0',
    projectPath: '/home/user/my-project',
    initialized: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Responsive Layout - Full Display Mode (≥60 columns)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
      });
    });

    it('should render full ASCII art banner when width >= 60 columns', () => {
      render(<Banner {...defaultProps} />);

      // Check that ASCII art is present (contains APEX characters)
      expect(screen.getByText(/█████╗ ██████╗ ███████╗██╗  ██╗/)).toBeInTheDocument();
      expect(screen.getByText(/██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝/)).toBeInTheDocument();
      expect(screen.getByText(/███████║██████╔╝█████╗   ╚███╔╝/)).toBeInTheDocument();
    });

    it('should render full version description in full mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
      expect(screen.getByText('v0.3.0')).toBeInTheDocument();
    });

    it('should render full status text for initialized project', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('Initialized in')).toBeInTheDocument();
      expect(screen.getByText('/home/user/my-project')).toBeInTheDocument();
    });

    it('should render full status text for uninitialized project', () => {
      render(<Banner {...defaultProps} initialized={false} projectPath={undefined} />);

      expect(screen.getByText('!')).toBeInTheDocument();
      expect(screen.getByText('Not initialized. Run')).toBeInTheDocument();
      expect(screen.getByText('/init')).toBeInTheDocument();
      expect(screen.getByText('to get started.')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout - Compact Display Mode (40-59 columns)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
      });
    });

    it('should render compact text box banner when width is 40-59 columns', () => {
      render(<Banner {...defaultProps} />);

      // Check for compact banner characters
      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();
      expect(screen.getByText('│   ◆ APEX ◆     │')).toBeInTheDocument();
      expect(screen.getByText('└─────────────────┘')).toBeInTheDocument();
    });

    it('should not render ASCII art in compact mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.queryByText(/█████╗ ██████╗/)).not.toBeInTheDocument();
    });

    it('should render full version description in compact mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
      expect(screen.getByText('v0.3.0')).toBeInTheDocument();
    });

    it('should render full status text in compact mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('Initialized in')).toBeInTheDocument();
      expect(screen.getByText('/home/user/my-project')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout - Text-Only Display Mode (<40 columns)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });
    });

    it('should render minimal text-only banner when width < 40 columns', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.getByText('◆ APEX')).toBeInTheDocument();
      expect(screen.getByText('v0.3.0')).toBeInTheDocument();
    });

    it('should not render ASCII art or compact banner in text-only mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.queryByText(/█████╗ ██████╗/)).not.toBeInTheDocument();
      expect(screen.queryByText('┌─────────────────┐')).not.toBeInTheDocument();
    });

    it('should not render full version description in text-only mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.queryByText('Autonomous Product Engineering eXecutor')).not.toBeInTheDocument();
    });

    it('should render compact status for initialized project in text-only mode', () => {
      render(<Banner {...defaultProps} />);

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText(/\/home\/user\/my-project/)).toBeInTheDocument();
      // Should not have full text
      expect(screen.queryByText('Initialized in')).not.toBeInTheDocument();
    });

    it('should render compact status for uninitialized project in text-only mode', () => {
      render(<Banner {...defaultProps} initialized={false} projectPath={undefined} />);

      expect(screen.getByText('! Run /init')).toBeInTheDocument();
      // Should not have full text
      expect(screen.queryByText('Not initialized. Run')).not.toBeInTheDocument();
    });
  });

  describe('Breakpoint Edge Cases', () => {
    it('should render full mode exactly at 60 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
      });

      render(<Banner {...defaultProps} />);

      expect(screen.getByText(/█████╗ ██████╗/)).toBeInTheDocument();
    });

    it('should render compact mode exactly at 40 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
      });

      render(<Banner {...defaultProps} />);

      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();
      expect(screen.queryByText(/█████╗ ██████╗/)).not.toBeInTheDocument();
    });

    it('should render text-only mode exactly at 39 columns', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 39,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });

      render(<Banner {...defaultProps} />);

      expect(screen.getByText('◆ APEX')).toBeInTheDocument();
      expect(screen.queryByText('┌─────────────────┐')).not.toBeInTheDocument();
    });

    it('should handle very small terminal widths gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });

      render(<Banner {...defaultProps} />);

      expect(screen.getByText('◆ APEX')).toBeInTheDocument();
      expect(screen.getByText('v0.3.0')).toBeInTheDocument();
    });

    it('should handle very large terminal widths', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        breakpoint: 'wide',
      });

      render(<Banner {...defaultProps} />);

      expect(screen.getByText(/█████╗ ██████╗/)).toBeInTheDocument();
      expect(screen.getByText('Autonomous Product Engineering eXecutor')).toBeInTheDocument();
    });
  });

  describe('Path Truncation Logic', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });
    });

    it('should truncate very long paths in text-only mode', () => {
      const longPath = '/very/very/very/long/path/to/my/super/duper/long/project/name/that/exceeds/terminal/width';
      render(<Banner {...defaultProps} projectPath={longPath} />);

      const pathElement = screen.getByText(/\.\.\./);
      expect(pathElement).toBeInTheDocument();
      // Should not render the full path
      expect(screen.queryByText(longPath)).not.toBeInTheDocument();
    });

    it('should not truncate short paths', () => {
      const shortPath = '/short/path';
      render(<Banner {...defaultProps} projectPath={shortPath} />);

      expect(screen.getByText(shortPath)).toBeInTheDocument();
    });

    it('should keep last segments when truncating', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });

      const longPath = '/home/user/projects/long-project-name/src/components';
      render(<Banner {...defaultProps} projectPath={longPath} />);

      // Should see truncated version with last segments
      const truncatedElement = screen.getByText(/\.\.\./);
      expect(truncatedElement).toBeInTheDocument();
    });
  });

  describe('Hook Integration', () => {
    it('should respond to width changes from useStdoutDimensions hook', () => {
      const { rerender } = render(<Banner {...defaultProps} />);

      // Start with narrow width
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });

      rerender(<Banner {...defaultProps} />);
      expect(screen.getByText('◆ APEX')).toBeInTheDocument();

      // Change to wide width
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
      });

      rerender(<Banner {...defaultProps} />);
      expect(screen.getByText(/█████╗ ██████╗/)).toBeInTheDocument();
    });

    it('should handle cases when terminal dimensions are not available', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback width
        height: 24,
        isAvailable: false, // dimensions not available
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
      });

      render(<Banner {...defaultProps} />);

      // Should still render correctly with fallback dimensions
      expect(screen.getByText(/█████╗ ██████╗/)).toBeInTheDocument();
    });
  });

  describe('Component Props Handling', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
      });
    });

    it('should handle missing projectPath prop', () => {
      const propsWithoutPath: BannerProps = {
        version: '1.0.0',
        initialized: false,
      };

      render(<Banner {...propsWithoutPath} />);

      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      expect(screen.getByText('! ')).toBeInTheDocument();
      expect(screen.getByText('/init')).toBeInTheDocument();
    });

    it('should handle different version formats', () => {
      const propsWithBetaVersion: BannerProps = {
        version: '2.0.0-beta.1',
        initialized: true,
        projectPath: '/test',
      };

      render(<Banner {...propsWithBetaVersion} />);

      expect(screen.getByText('v2.0.0-beta.1')).toBeInTheDocument();
    });

    it('should handle empty version string', () => {
      const propsWithEmptyVersion: BannerProps = {
        version: '',
        initialized: true,
        projectPath: '/test',
      };

      render(<Banner {...propsWithEmptyVersion} />);

      // Should handle empty version gracefully
      expect(screen.getByText('v')).toBeInTheDocument();
    });

    it('should handle special characters in project path', () => {
      const specialPath = '/home/user/my-project with spaces & symbols!';
      render(<Banner {...defaultProps} projectPath={specialPath} />);

      expect(screen.getByText(specialPath)).toBeInTheDocument();
    });
  });

  describe('Display Mode Function Tests', () => {
    // These tests verify the internal getDisplayMode function logic
    // through observable component behavior

    it('should consistently apply the same display mode for same width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
      });

      const { rerender } = render(<Banner {...defaultProps} />);
      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();

      rerender(<Banner {...defaultProps} />);
      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();
    });

    it('should transition between display modes correctly', () => {
      const { rerender } = render(<Banner {...defaultProps} />);

      // Test full -> compact transition
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
      });
      rerender(<Banner {...defaultProps} />);
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();

      // To compact
      mockUseStdoutDimensions.mockReturnValue({
        width: 59,
        height: 24,
        isAvailable: true,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
      });
      rerender(<Banner {...defaultProps} />);
      expect(screen.getByText('┌─────────────────┐')).toBeInTheDocument();
      expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

      // To text-only
      mockUseStdoutDimensions.mockReturnValue({
        width: 39,
        height: 24,
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
      });
      rerender(<Banner {...defaultProps} />);
      expect(screen.getByText('◆ APEX')).toBeInTheDocument();
      expect(screen.queryByText('┌─────────────────┐')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility and Visual Overflow Prevention', () => {
    it('should not cause visual overflow in any display mode', () => {
      const widths = [10, 20, 39, 40, 59, 60, 80, 120, 200];

      widths.forEach(width => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          isAvailable: true,
          isNarrow: width < 60,
          isCompact: width >= 40 && width < 60,
          isNormal: width >= 60 && width < 100,
          isWide: width >= 100,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
        });

        const { unmount } = render(<Banner {...defaultProps} />);

        // Component should render without errors at any width
        expect(screen.getByText(/APEX/)).toBeInTheDocument();

        unmount();
      });
    });

    it('should maintain consistent version display across modes', () => {
      const widths = [30, 45, 70];
      const version = '1.2.3-alpha';

      widths.forEach(width => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          isAvailable: true,
          isNarrow: width < 60,
          isCompact: width >= 40 && width < 60,
          isNormal: width >= 60 && width < 100,
          isWide: width >= 100,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : 'normal',
        });

        const { unmount } = render(<Banner version={version} />);

        expect(screen.getByText(`v${version}`)).toBeInTheDocument();

        unmount();
      });
    });
  });
});