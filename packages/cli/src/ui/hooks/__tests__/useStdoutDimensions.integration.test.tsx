/**
 * Integration tests for useStdoutDimensions hook
 *
 * Tests the hook's behavior when integrated with React components
 * to ensure proper responsive behavior and UI adaptation.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Text, Box } from 'ink';
import { useStdoutDimensions } from '../useStdoutDimensions.js';

// Mock ink-use-stdout-dimensions
vi.mock('ink-use-stdout-dimensions', () => {
  const mockHook = vi.fn();
  return {
    default: mockHook,
  };
});

import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

// Test components using the hook
function ResponsiveComponent() {
  const { width, breakpoint, isAvailable } = useStdoutDimensions();

  return (
    <Box>
      <Text>Width: {width}</Text>
      <Text>Breakpoint: {breakpoint}</Text>
      <Text>Available: {isAvailable ? 'Yes' : 'No'}</Text>
      {breakpoint === 'narrow' && <Text>Narrow layout</Text>}
      {breakpoint === 'normal' && <Text>Normal layout</Text>}
      {breakpoint === 'wide' && <Text>Wide layout</Text>}
    </Box>
  );
}

function CustomThresholdComponent() {
  const { breakpoint, width } = useStdoutDimensions({
    narrowThreshold: 90,
    wideThreshold: 150,
    fallbackWidth: 100
  });

  return (
    <Box>
      <Text>Custom: {width}x{breakpoint}</Text>
    </Box>
  );
}

function FallbackComponent() {
  const { width, height, isAvailable } = useStdoutDimensions({
    fallbackWidth: 120,
    fallbackHeight: 40
  });

  return (
    <Box>
      <Text>Size: {width}x{height}</Text>
      <Text>Mode: {isAvailable ? 'live' : 'fallback'}</Text>
    </Box>
  );
}

describe('useStdoutDimensions - Integration Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('component integration', () => {
    it('should provide responsive data to React components', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      const { getByText } = render(<ResponsiveComponent />);

      expect(getByText('Width: 100')).toBeDefined();
      expect(getByText('Breakpoint: normal')).toBeDefined();
      expect(getByText('Available: Yes')).toBeDefined();
      expect(getByText('Normal layout')).toBeDefined();
    });

    it('should handle narrow terminal layout', () => {
      mockBaseHook.mockReturnValue([50, 20]);

      const { getByText, queryByText } = render(<ResponsiveComponent />);

      expect(getByText('Width: 50')).toBeDefined();
      expect(getByText('Breakpoint: narrow')).toBeDefined();
      expect(getByText('Narrow layout')).toBeDefined();
      expect(queryByText('Normal layout')).toBeNull();
      expect(queryByText('Wide layout')).toBeNull();
    });

    it('should handle wide terminal layout', () => {
      mockBaseHook.mockReturnValue([160, 40]);

      const { getByText, queryByText } = render(<ResponsiveComponent />);

      expect(getByText('Width: 160')).toBeDefined();
      expect(getByText('Breakpoint: wide')).toBeDefined();
      expect(getByText('Wide layout')).toBeDefined();
      expect(queryByText('Narrow layout')).toBeNull();
      expect(queryByText('Normal layout')).toBeNull();
    });

    it('should work with custom thresholds in components', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      const { getByText } = render(<CustomThresholdComponent />);

      // With narrowThreshold=90, wideThreshold=150, width=100 should be normal
      expect(getByText('Custom: 100xnormal')).toBeDefined();
    });

    it('should handle fallback mode in components', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { getByText } = render(<FallbackComponent />);

      expect(getByText('Size: 120x40')).toBeDefined();
      expect(getByText('Mode: fallback')).toBeDefined();
    });
  });

  describe('component re-rendering behavior', () => {
    it('should trigger re-renders when dimensions change', () => {
      let renderCount = 0;

      function CountingComponent() {
        renderCount++;
        const { width, breakpoint } = useStdoutDimensions();
        return (
          <Box>
            <Text>Width: {width} ({breakpoint})</Text>
            <Text>Renders: {renderCount}</Text>
          </Box>
        );
      }

      mockBaseHook.mockReturnValue([80, 24]);
      const { rerender, getByText } = render(<CountingComponent />);

      expect(getByText('Width: 80 (normal)')).toBeDefined();
      expect(getByText('Renders: 1')).toBeDefined();

      // Change dimensions
      mockBaseHook.mockReturnValue([50, 20]);
      rerender(<CountingComponent />);

      expect(getByText('Width: 50 (narrow)')).toBeDefined();
      expect(getByText('Renders: 2')).toBeDefined();
    });

    it('should handle multiple components using the hook simultaneously', () => {
      function MultiComponentApp() {
        return (
          <Box flexDirection="column">
            <ResponsiveComponent />
            <CustomThresholdComponent />
            <FallbackComponent />
          </Box>
        );
      }

      mockBaseHook.mockReturnValue([100, 30]);

      const { getByText } = render(<MultiComponentApp />);

      // Each component should work independently
      expect(getByText('Width: 100')).toBeDefined();
      expect(getByText('Breakpoint: normal')).toBeDefined();
      expect(getByText('Custom: 100xnormal')).toBeDefined();
      expect(getByText('Size: 100x30')).toBeDefined();
      expect(getByText('Mode: live')).toBeDefined();
    });
  });

  describe('edge case integration', () => {
    it('should handle component mounting with unavailable dimensions', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { getByText } = render(<ResponsiveComponent />);

      expect(getByText('Width: 80')).toBeDefined(); // fallback
      expect(getByText('Breakpoint: normal')).toBeDefined(); // 80 is normal
      expect(getByText('Available: No')).toBeDefined();
    });

    it('should handle zero dimensions gracefully in components', () => {
      mockBaseHook.mockReturnValue([0, 0]);

      const { getByText } = render(<ResponsiveComponent />);

      expect(getByText('Width: 0')).toBeDefined();
      expect(getByText('Breakpoint: narrow')).toBeDefined(); // 0 < 60
      expect(getByText('Available: Yes')).toBeDefined();
    });

    it('should handle very large dimensions in components', () => {
      mockBaseHook.mockReturnValue([5000, 1000]);

      const { getByText } = render(<ResponsiveComponent />);

      expect(getByText('Width: 5000')).toBeDefined();
      expect(getByText('Breakpoint: wide')).toBeDefined();
      expect(getByText('Available: Yes')).toBeDefined();
    });
  });

  describe('real-world scenarios', () => {
    it('should provide consistent responsive behavior for progress bars', () => {
      function ProgressBarComponent({ progress }: { progress: number }) {
        const { width, breakpoint } = useStdoutDimensions();

        const barWidth = Math.max(10, width - 10);
        const filled = Math.floor((progress / 100) * barWidth);

        return (
          <Box>
            <Text>Progress: {progress}% | Bar width: {barWidth} | Breakpoint: {breakpoint}</Text>
          </Box>
        );
      }

      mockBaseHook.mockReturnValue([80, 24]);
      const { getByText, rerender } = render(<ProgressBarComponent progress={50} />);

      expect(getByText('Progress: 50% | Bar width: 70 | Breakpoint: normal')).toBeDefined();

      // Test with narrow terminal
      mockBaseHook.mockReturnValue([40, 20]);
      rerender(<ProgressBarComponent progress={50} />);

      expect(getByText('Progress: 50% | Bar width: 30 | Breakpoint: narrow')).toBeDefined();
    });

    it('should support adaptive table layouts', () => {
      function TableComponent() {
        const { breakpoint, width } = useStdoutDimensions();

        const showId = breakpoint !== 'narrow';
        const showDetails = breakpoint === 'wide';

        return (
          <Box>
            <Text>Width: {width} | Show ID: {showId ? 'Yes' : 'No'} | Show Details: {showDetails ? 'Yes' : 'No'}</Text>
          </Box>
        );
      }

      // Test narrow
      mockBaseHook.mockReturnValue([50, 20]);
      const { getByText, rerender } = render(<TableComponent />);
      expect(getByText('Width: 50 | Show ID: No | Show Details: No')).toBeDefined();

      // Test normal
      mockBaseHook.mockReturnValue([80, 24]);
      rerender(<TableComponent />);
      expect(getByText('Width: 80 | Show ID: Yes | Show Details: No')).toBeDefined();

      // Test wide
      mockBaseHook.mockReturnValue([150, 30]);
      rerender(<TableComponent />);
      expect(getByText('Width: 150 | Show ID: Yes | Show Details: Yes')).toBeDefined();
    });

    it('should handle component cleanup and remounting', () => {
      function ConditionalComponent({ show }: { show: boolean }) {
        return show ? <ResponsiveComponent /> : <Text>Hidden</Text>;
      }

      mockBaseHook.mockReturnValue([100, 30]);
      const { getByText, rerender } = render(<ConditionalComponent show={true} />);

      expect(getByText('Width: 100')).toBeDefined();

      // Hide component
      rerender(<ConditionalComponent show={false} />);
      expect(getByText('Hidden')).toBeDefined();

      // Show again
      rerender(<ConditionalComponent show={true} />);
      expect(getByText('Width: 100')).toBeDefined();
      expect(mockBaseHook).toHaveBeenCalled();
    });
  });

  describe('performance characteristics', () => {
    it('should not cause excessive re-renders with stable dimensions', () => {
      let renderCount = 0;

      function PerformanceTestComponent() {
        renderCount++;
        const { width, breakpoint } = useStdoutDimensions();
        return <Text>{width}x{breakpoint} (render #{renderCount})</Text>;
      }

      mockBaseHook.mockReturnValue([100, 30]);
      const { getByText, rerender } = render(<PerformanceTestComponent />);

      expect(getByText('100xnormal (render #1)')).toBeDefined();

      // Multiple re-renders with same dimensions
      rerender(<PerformanceTestComponent />);
      rerender(<PerformanceTestComponent />);
      rerender(<PerformanceTestComponent />);

      // Should have re-rendered but breakpoint calculation should be memoized
      expect(getByText('100xnormal (render #4)')).toBeDefined();
    });
  });
});