import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStdoutDimensions } from '../useStdoutDimensions.js';

// Mock ink-use-stdout-dimensions
vi.mock('ink-use-stdout-dimensions', () => {
  const mockHook = vi.fn();
  return {
    default: mockHook,
  };
});

import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

// Test components to verify hook integration
function ResponsiveComponent() {
  const { width, height, breakpoint, isAvailable } = useStdoutDimensions();

  return (
    <div>
      <div data-testid="width">{width}</div>
      <div data-testid="height">{height}</div>
      <div data-testid="breakpoint">{breakpoint}</div>
      <div data-testid="available">{isAvailable.toString()}</div>
    </div>
  );
}

function CustomThresholdComponent() {
  const { breakpoint } = useStdoutDimensions({
    narrowThreshold: 70,
    wideThreshold: 140
  });

  return (
    <div data-testid="custom-breakpoint">{breakpoint}</div>
  );
}

function FallbackComponent() {
  const { width, height, isAvailable } = useStdoutDimensions({
    fallbackWidth: 120,
    fallbackHeight: 35
  });

  return (
    <div>
      <div data-testid="fallback-width">{width}</div>
      <div data-testid="fallback-height">{height}</div>
      <div data-testid="fallback-available">{isAvailable.toString()}</div>
    </div>
  );
}

function ConditionalRenderComponent() {
  const { breakpoint } = useStdoutDimensions();

  if (breakpoint === 'narrow') {
    return <div data-testid="narrow-view">Mobile View</div>;
  }

  if (breakpoint === 'wide') {
    return <div data-testid="wide-view">Desktop View with Extras</div>;
  }

  return <div data-testid="normal-view">Standard Desktop View</div>;
}

describe('useStdoutDimensions E2E Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('component integration', () => {
    it('should work with basic React component', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      render(<ResponsiveComponent />);

      expect(screen.getByTestId('width')).toHaveTextContent('100');
      expect(screen.getByTestId('height')).toHaveTextContent('30');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('normal');
      expect(screen.getByTestId('available')).toHaveTextContent('true');
    });

    it('should support custom thresholds in components', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      render(<CustomThresholdComponent />);

      // With custom thresholds (narrow: 70, wide: 140), 80 should be 'normal'
      expect(screen.getByTestId('custom-breakpoint')).toHaveTextContent('normal');
    });

    it('should handle fallback scenarios in components', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      render(<FallbackComponent />);

      expect(screen.getByTestId('fallback-width')).toHaveTextContent('120');
      expect(screen.getByTestId('fallback-height')).toHaveTextContent('35');
      expect(screen.getByTestId('fallback-available')).toHaveTextContent('false');
    });

    it('should enable responsive conditional rendering', () => {
      // Test narrow view
      mockBaseHook.mockReturnValue([40, 20]);
      const { rerender } = render(<ConditionalRenderComponent />);
      expect(screen.getByTestId('narrow-view')).toHaveTextContent('Mobile View');

      // Test normal view
      mockBaseHook.mockReturnValue([80, 24]);
      rerender(<ConditionalRenderComponent />);
      expect(screen.getByTestId('normal-view')).toHaveTextContent('Standard Desktop View');

      // Test wide view
      mockBaseHook.mockReturnValue([150, 40]);
      rerender(<ConditionalRenderComponent />);
      expect(screen.getByTestId('wide-view')).toHaveTextContent('Desktop View with Extras');
    });
  });

  describe('multiple hook instances', () => {
    function MultiHookComponent() {
      const defaultDims = useStdoutDimensions();
      const customDims = useStdoutDimensions({
        narrowThreshold: 70,
        wideThreshold: 130
      });
      const fallbackDims = useStdoutDimensions({
        fallbackWidth: 200,
        fallbackHeight: 50
      });

      return (
        <div>
          <div data-testid="default-breakpoint">{defaultDims.breakpoint}</div>
          <div data-testid="custom-breakpoint">{customDims.breakpoint}</div>
          <div data-testid="fallback-width">{fallbackDims.width}</div>
        </div>
      );
    }

    it('should handle multiple hook instances with different configs', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      render(<MultiHookComponent />);

      // Default: narrow=60, wide=120, so 80 = 'normal'
      expect(screen.getByTestId('default-breakpoint')).toHaveTextContent('normal');

      // Custom: narrow=70, wide=130, so 80 = 'normal'
      expect(screen.getByTestId('custom-breakpoint')).toHaveTextContent('normal');

      // Fallback width should be actual width (80) when available
      expect(screen.getByTestId('fallback-width')).toHaveTextContent('80');
    });

    it('should handle mixed availability states correctly', () => {
      // Simulate partial availability
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      render(<MultiHookComponent />);

      // All should use fallbacks when unavailable
      expect(screen.getByTestId('default-breakpoint')).toHaveTextContent('normal'); // 80 fallback
      expect(screen.getByTestId('custom-breakpoint')).toHaveTextContent('normal'); // 80 fallback
      expect(screen.getByTestId('fallback-width')).toHaveTextContent('200'); // custom fallback
    });
  });

  describe('real-world usage patterns', () => {
    function LayoutComponent() {
      const { width, breakpoint } = useStdoutDimensions();

      const columns = breakpoint === 'narrow' ? 1 :
                    breakpoint === 'normal' ? 2 : 3;

      const sidebar = breakpoint !== 'narrow';

      return (
        <div>
          <div data-testid="columns">{columns}</div>
          <div data-testid="sidebar">{sidebar.toString()}</div>
          <div data-testid="effective-width">{Math.floor(width / columns)}</div>
        </div>
      );
    }

    function StatusComponent() {
      const { width, height, isAvailable } = useStdoutDimensions({
        fallbackWidth: 80,
        fallbackHeight: 24
      });

      const status = isAvailable ? 'connected' : 'fallback';
      const area = width * height;

      return (
        <div>
          <div data-testid="status">{status}</div>
          <div data-testid="area">{area}</div>
        </div>
      );
    }

    it('should support complex layout calculations', () => {
      // Test narrow layout
      mockBaseHook.mockReturnValue([50, 20]);
      const { rerender } = render(<LayoutComponent />);

      expect(screen.getByTestId('columns')).toHaveTextContent('1');
      expect(screen.getByTestId('sidebar')).toHaveTextContent('false');
      expect(screen.getByTestId('effective-width')).toHaveTextContent('50'); // 50/1

      // Test normal layout
      mockBaseHook.mockReturnValue([100, 30]);
      rerender(<LayoutComponent />);

      expect(screen.getByTestId('columns')).toHaveTextContent('2');
      expect(screen.getByTestId('sidebar')).toHaveTextContent('true');
      expect(screen.getByTestId('effective-width')).toHaveTextContent('50'); // 100/2

      // Test wide layout
      mockBaseHook.mockReturnValue([180, 40]);
      rerender(<LayoutComponent />);

      expect(screen.getByTestId('columns')).toHaveTextContent('3');
      expect(screen.getByTestId('sidebar')).toHaveTextContent('true');
      expect(screen.getByTestId('effective-width')).toHaveTextContent('60'); // 180/3
    });

    it('should handle status and calculations correctly', () => {
      // Test with available dimensions
      mockBaseHook.mockReturnValue([120, 35]);
      const { rerender } = render(<StatusComponent />);

      expect(screen.getByTestId('status')).toHaveTextContent('connected');
      expect(screen.getByTestId('area')).toHaveTextContent('4200'); // 120 * 35

      // Test with fallback dimensions
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);
      rerender(<StatusComponent />);

      expect(screen.getByTestId('status')).toHaveTextContent('fallback');
      expect(screen.getByTestId('area')).toHaveTextContent('1920'); // 80 * 24
    });
  });

  describe('error boundaries and edge cases', () => {
    function ErrorProneComponent() {
      const dimensions = useStdoutDimensions();

      // Component that might trigger edge cases
      const safeWidth = Math.max(0, dimensions.width);
      const aspectRatio = dimensions.height > 0 ?
        (dimensions.width / dimensions.height).toFixed(2) : 'N/A';

      return (
        <div>
          <div data-testid="safe-width">{safeWidth}</div>
          <div data-testid="aspect-ratio">{aspectRatio}</div>
        </div>
      );
    }

    it('should handle zero and negative dimensions gracefully', () => {
      mockBaseHook.mockReturnValue([0, 0]);
      render(<ErrorProneComponent />);

      expect(screen.getByTestId('safe-width')).toHaveTextContent('0');
      expect(screen.getByTestId('aspect-ratio')).toHaveTextContent('N/A');
    });

    it('should handle negative dimensions gracefully', () => {
      mockBaseHook.mockReturnValue([-10, -5]);
      render(<ErrorProneComponent />);

      expect(screen.getByTestId('safe-width')).toHaveTextContent('0'); // Math.max(0, -10)
      expect(screen.getByTestId('aspect-ratio')).toHaveTextContent('2.00'); // -10 / -5
    });

    it('should handle extreme dimensions gracefully', () => {
      mockBaseHook.mockReturnValue([10000, 5000]);
      render(<ErrorProneComponent />);

      expect(screen.getByTestId('safe-width')).toHaveTextContent('10000');
      expect(screen.getByTestId('aspect-ratio')).toHaveTextContent('2.00'); // 10000 / 5000
    });
  });

  describe('React strict mode compatibility', () => {
    it('should work correctly in React strict mode', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      render(
        <React.StrictMode>
          <ResponsiveComponent />
        </React.StrictMode>
      );

      expect(screen.getByTestId('width')).toHaveTextContent('100');
      expect(screen.getByTestId('height')).toHaveTextContent('30');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('normal');
      expect(screen.getByTestId('available')).toHaveTextContent('true');
    });

    it('should handle double rendering in strict mode', () => {
      let renderCount = 0;

      function CountingComponent() {
        renderCount++;
        const { width } = useStdoutDimensions();
        return <div data-testid="width">{width}</div>;
      }

      mockBaseHook.mockReturnValue([80, 24]);

      render(
        <React.StrictMode>
          <CountingComponent />
        </React.StrictMode>
      );

      expect(screen.getByTestId('width')).toHaveTextContent('80');

      // In strict mode, components may render twice in development
      // This is expected behavior and our hook should handle it gracefully
      expect(renderCount).toBeGreaterThan(0);
    });
  });
});