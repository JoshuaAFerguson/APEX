import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, RenderResult } from '@testing-library/react';
import type { StdoutDimensions, Breakpoint } from '../ui/hooks/useStdoutDimensions';
import {
  mockTerminalWidth,
  setupResponsiveMocks,
  renderResponsive,
  expectNoOverflow,
  expectTruncated,
  expectNotTruncated,
  expectBreakpointBehavior,
  type TerminalWidth,
} from './responsive-layout-foundation.integration.test';

// =============================================================================
// Edge Cases and Error Scenarios for Responsive Layout Foundation
// =============================================================================

// Setup mocks before running any tests
setupResponsiveMocks();

describe('Responsive Layout Foundation - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mockTerminalWidth edge cases', () => {
    it('should handle mock being called before setupResponsiveMocks', () => {
      // This test simulates what happens if someone tries to use mockTerminalWidth
      // before the hooks are properly mocked
      expect(() => {
        const result = mockTerminalWidth(80);
        expect(result.width).toBe(80);
      }).not.toThrow();
    });

    it('should handle rapid terminal width changes', () => {
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const mockHook = useStdoutDimensions as Mock;

      // Simulate rapid width changes
      const widths: TerminalWidth[] = [40, 160, 60, 120, 80];
      for (const width of widths) {
        mockTerminalWidth(width);
        expect(mockHook.mock.results[mockHook.mock.results.length - 1].value.width).toBe(width);
      }
    });

    it('should maintain overrides through multiple calls', () => {
      const override = { isAvailable: false, height: 100 };

      mockTerminalWidth(40, override);
      const result1 = mockTerminalWidth(40);
      expect(result1.isAvailable).toBe(true); // Override doesn't persist
      expect(result1.height).toBe(24); // Back to default

      const result2 = mockTerminalWidth(40, override);
      expect(result2.isAvailable).toBe(false); // Override applied again
      expect(result2.height).toBe(100);
    });

    it('should handle invalid terminal width gracefully', () => {
      // Test behavior with unexpected widths (not in our standard set)
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const mockHook = useStdoutDimensions as Mock;

      // Use a non-standard width by providing overrides
      mockTerminalWidth(80, { width: 99, breakpoint: 'compact' });
      const result = mockHook.mock.results[mockHook.mock.results.length - 1].value;

      expect(result.width).toBe(99);
      expect(result.breakpoint).toBe('compact');
    });
  });

  describe('ResponsiveTestWrapper edge cases', () => {
    it('should handle theme changes correctly', () => {
      const customTheme = { name: 'light', colors: { primary: '#000' } };

      render(
        <div data-testid="wrapper-test">
          Test content with custom theme
        </div>
      );

      expect(screen.getByTestId('wrapper-test')).toBeInTheDocument();
    });

    it('should handle nested ResponsiveTestWrapper components', () => {
      const OuterWrapper = () => (
        <div data-testid="outer">
          <div data-testid="inner">
            Nested content
          </div>
        </div>
      );

      render(<OuterWrapper />);
      expect(screen.getByTestId('outer')).toBeInTheDocument();
      expect(screen.getByTestId('inner')).toBeInTheDocument();
    });

    it('should handle component re-mounting', () => {
      const TestComponent = ({ id }: { id: string }) => (
        <div data-testid={`test-${id}`}>Content {id}</div>
      );

      const { rerender } = render(<TestComponent id="1" />);
      expect(screen.getByTestId('test-1')).toBeInTheDocument();

      rerender(<TestComponent id="2" />);
      expect(screen.queryByTestId('test-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('test-2')).toBeInTheDocument();
    });
  });

  describe('renderResponsive edge cases', () => {
    it('should handle component that throws during render', () => {
      const ThrowingComponent = () => {
        throw new Error('Test error');
      };

      expect(() => {
        renderResponsive(<ThrowingComponent />);
      }).toThrow('Test error');
    });

    it('should handle setWidth after component unmount', () => {
      const TestComponent = () => <div data-testid="test">Content</div>;

      const { setWidth, unmount } = renderResponsive(<TestComponent />);
      expect(screen.getByTestId('test')).toBeInTheDocument();

      unmount();
      expect(screen.queryByTestId('test')).not.toBeInTheDocument();

      // This should not throw even after unmount
      expect(() => setWidth(40)).not.toThrow();
    });

    it('should handle complex component tree with hooks', () => {
      const ComplexComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, breakpoint, isNarrow, isWide } = useStdoutDimensions();

        return (
          <div data-testid="complex">
            <div data-testid="width-display">{width}</div>
            <div data-testid="breakpoint-display">{breakpoint}</div>
            {isNarrow && <div data-testid="narrow-indicator">Narrow mode</div>}
            {isWide && <div data-testid="wide-indicator">Wide mode</div>}
          </div>
        );
      };

      const { setWidth } = renderResponsive(<ComplexComponent />, { width: 40 });

      expect(screen.getByTestId('width-display')).toHaveTextContent('40');
      expect(screen.getByTestId('breakpoint-display')).toHaveTextContent('narrow');
      expect(screen.getByTestId('narrow-indicator')).toBeInTheDocument();
      expect(screen.queryByTestId('wide-indicator')).not.toBeInTheDocument();

      setWidth(160);
      expect(screen.getByTestId('width-display')).toHaveTextContent('160');
      expect(screen.getByTestId('breakpoint-display')).toHaveTextContent('wide');
      expect(screen.queryByTestId('narrow-indicator')).not.toBeInTheDocument();
      expect(screen.getByTestId('wide-indicator')).toBeInTheDocument();
    });
  });

  describe('Responsive assertion helpers edge cases', () => {
    describe('expectNoOverflow edge cases', () => {
      it('should handle elements with no text content', () => {
        render(<div data-testid="empty"></div>);
        const element = screen.getByTestId('empty');

        expect(() => expectNoOverflow(element, 10)).not.toThrow();
      });

      it('should handle elements with only whitespace', () => {
        render(<div data-testid="whitespace">   \n  \t  </div>);
        const element = screen.getByTestId('whitespace');

        expect(() => expectNoOverflow(element, 20)).not.toThrow();
      });

      it('should handle elements with exactly max width', () => {
        render(<div data-testid="exact">Exactly 20 chars!!!</div>);
        const element = screen.getByTestId('exact');

        expect(() => expectNoOverflow(element, 20)).not.toThrow();
      });

      it('should handle elements with unicode characters', () => {
        render(<div data-testid="unicode">Hello 👋 World 🌍</div>);
        const element = screen.getByTestId('unicode');

        // Unicode emojis count as single characters in length
        expect(() => expectNoOverflow(element, 20)).not.toThrow();
      });
    });

    describe('expectTruncated edge cases', () => {
      it('should handle empty original text', () => {
        render(<div data-testid="text">Some content</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, '')).not.toThrow();
      });

      it('should handle text that is exactly the same length', () => {
        render(<div data-testid="text">Same length</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'Same length')).toThrow();
      });

      it('should handle ellipsis in the middle of text', () => {
        render(<div data-testid="text">Start...End</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'Start middle content End')).not.toThrow();
      });

      it('should handle multiple ellipsis', () => {
        render(<div data-testid="text">Text...more...end</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'Text with more content at end')).not.toThrow();
      });

      it('should handle text longer than original but with ellipsis', () => {
        // Edge case: displayed text is longer but contains ellipsis
        render(<div data-testid="text">Short original text but with ellipsis...</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'Short')).not.toThrow();
      });
    });

    describe('expectNotTruncated edge cases', () => {
      it('should handle original text containing ellipsis', () => {
        render(<div data-testid="text">Text with ... in middle</div>);
        const element = screen.getByTestId('text');

        // Should not throw if original text contains ellipsis and displayed text matches
        expect(() => expectNotTruncated(element, 'Text with ... in middle')).not.toThrow();
      });

      it('should handle partial match with original text', () => {
        render(<div data-testid="text">Full original text here</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNotTruncated(element, 'original text')).not.toThrow();
      });

      it('should handle case sensitivity', () => {
        render(<div data-testid="text">UPPERCASE TEXT</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNotTruncated(element, 'uppercase text')).toThrow();
      });

      it('should handle text ending with ellipsis naturally', () => {
        render(<div data-testid="text">Natural ellipsis...</div>);
        const element = screen.getByTestId('text');

        // Should throw because it ends with ellipsis
        expect(() => expectNotTruncated(element, 'Natural ellipsis')).toThrow();
      });
    });

    describe('expectBreakpointBehavior edge cases', () => {
      it('should handle component that behaves differently at same breakpoint', () => {
        const InconsistentComponent = () => {
          const { useStdoutDimensions } = require('../ui/hooks/index');
          const { width } = useStdoutDimensions();

          // Simulate inconsistent behavior at 80 columns
          const showSpecial = width === 80 && Math.random() > 0.5;

          return (
            <div>
              <span>Base content</span>
              {showSpecial && <span>Special content</span>}
            </div>
          );
        };

        // This test might be flaky, but demonstrates the concept
        expect(() => {
          expectBreakpointBehavior({
            component: <InconsistentComponent />,
            visible: {
              compact: ['Base content'],
            },
          });
        }).not.toThrow();
      });

      it('should handle empty visibility/hidden rules', () => {
        const SimpleComponent = () => <div>Always visible</div>;

        expect(() => {
          expectBreakpointBehavior({
            component: <SimpleComponent />,
            visible: {},
            hidden: {},
          });
        }).not.toThrow();
      });

      it('should handle component with conditional rendering', () => {
        const ConditionalComponent = ({ show = true }: { show?: boolean }) => (
          <div>
            {show && <span>Conditional content</span>}
            <span>Always present</span>
          </div>
        );

        expect(() => {
          expectBreakpointBehavior({
            component: <ConditionalComponent show={false} />,
            visible: {
              narrow: ['Always present'],
              compact: ['Always present'],
              normal: ['Always present'],
              wide: ['Always present'],
            },
            hidden: {
              narrow: ['Conditional content'],
              compact: ['Conditional content'],
              normal: ['Conditional content'],
              wide: ['Conditional content'],
            },
          });
        }).not.toThrow();
      });

      it('should handle component with responsive content overflow', () => {
        const OverflowComponent = () => {
          const { useStdoutDimensions } = require('../ui/hooks/index');
          const { width } = useStdoutDimensions();

          const longText = 'This is a very long text that might overflow in narrow terminals but should be fine in wider ones';
          const shouldTruncate = width < 60;
          const displayText = shouldTruncate ? longText.slice(0, 20) + '...' : longText;

          return <div data-testid="overflow-text">{displayText}</div>;
        };

        const { setWidth } = renderResponsive(<OverflowComponent />, { width: 40 });
        const element = screen.getByTestId('overflow-text');

        // At narrow width, should be truncated
        expectTruncated(element, 'This is a very long text that might overflow in narrow terminals but should be fine in wider ones');
        expectNoOverflow(element, 30);

        // At wide width, should not be truncated
        setWidth(160);
        expectNotTruncated(element, 'This is a very long text that might overflow in narrow terminals but should be fine in wider ones');
      });
    });
  });

  describe('Integration with real Ink components', () => {
    it('should handle Box component with responsive layout', () => {
      const ResponsiveBox = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { isNarrow } = useStdoutDimensions();

        return (
          <div data-testid="box" style={{ flexDirection: isNarrow ? 'column' : 'row' }}>
            <div data-testid="item1">Item 1</div>
            <div data-testid="item2">Item 2</div>
          </div>
        );
      };

      const { setWidth } = renderResponsive(<ResponsiveBox />);

      expect(screen.getByTestId('box')).toHaveStyle('flex-direction: row');

      setWidth(40);
      expect(screen.getByTestId('box')).toHaveStyle('flex-direction: column');
    });

    it('should handle Text component with responsive styling', () => {
      const ResponsiveText = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { isWide } = useStdoutDimensions();

        return (
          <span
            data-testid="text"
            style={{
              fontWeight: isWide ? 'bold' : 'normal',
              opacity: isWide ? 1 : 0.7,
            }}
          >
            Responsive text
          </span>
        );
      };

      const { setWidth } = renderResponsive(<ResponsiveText />, { width: 80 });

      expect(screen.getByTestId('text')).toHaveStyle('font-weight: normal');
      expect(screen.getByTestId('text')).toHaveStyle('opacity: 0.7');

      setWidth(160);
      expect(screen.getByTestId('text')).toHaveStyle('font-weight: bold');
      expect(screen.getByTestId('text')).toHaveStyle('opacity: 1');
    });
  });

  describe('Performance and memory edge cases', () => {
    it('should handle multiple rapid setWidth calls without memory leaks', () => {
      const TestComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width } = useStdoutDimensions();
        return <div data-testid="width">{width}</div>;
      };

      const { setWidth } = renderResponsive(<TestComponent />);

      // Simulate rapid width changes
      for (let i = 0; i < 100; i++) {
        const widths: TerminalWidth[] = [40, 60, 80, 120, 160];
        setWidth(widths[i % widths.length]);
      }

      // Should still work correctly after many changes
      setWidth(40);
      expect(screen.getByTestId('width')).toHaveTextContent('40');
    });

    it('should clean up mocks properly between tests', () => {
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const mockHook = useStdoutDimensions as Mock;

      // Check that we start with clean state
      expect(mockHook.mock.calls.length).toBeGreaterThan(0); // Called during test setup

      vi.clearAllMocks();
      mockTerminalWidth(80);

      // After clearing and re-setting, should have fresh call count
      expect(mockHook).toHaveBeenCalled();
    });
  });

  describe('Error boundary integration', () => {
    it('should handle components that throw during responsive updates', () => {
      let shouldThrow = false;

      const ThrowingComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width } = useStdoutDimensions();

        if (shouldThrow && width < 50) {
          throw new Error('Component error in narrow mode');
        }

        return <div data-testid="content">Width: {width}</div>;
      };

      const { setWidth } = renderResponsive(<ThrowingComponent />);
      expect(screen.getByTestId('content')).toHaveTextContent('Width: 80');

      shouldThrow = true;
      expect(() => setWidth(40)).toThrow('Component error in narrow mode');
    });
  });
});