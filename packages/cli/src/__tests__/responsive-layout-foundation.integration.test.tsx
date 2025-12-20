import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, RenderResult } from '@testing-library/react';
import type { StdoutDimensions, Breakpoint } from '../ui/hooks/useStdoutDimensions';
import { mockTheme, ThemeProvider } from './test-utils';

// =============================================================================
// SECTION 1: Terminal Width Mock Helper
// =============================================================================

/**
 * Standard terminal widths for responsive testing
 * Maps to breakpoints: 40→narrow, 60→compact, 80→compact, 120→normal, 160→wide
 */
export type TerminalWidth = 40 | 60 | 80 | 120 | 160;

/**
 * Terminal width to breakpoint mapping with full dimension context
 */
const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = {
  40: {
    width: 40,
    height: 24,
    breakpoint: 'narrow',
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  60: {
    width: 60,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  80: {
    width: 80,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  120: {
    width: 120,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true
  },
  160: {
    width: 160,
    height: 40,
    breakpoint: 'wide',
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true
  },
};

// Global mock reference for the hook
let mockUseStdoutDimensions: Mock;

/**
 * Sets up responsive mocks for testing
 * Must be called before importing components that use useStdoutDimensions
 */
export function setupResponsiveMocks(): void {
  // Mock ink components that are commonly used in responsive components
  vi.mock('ink', async () => {
    const actual = await vi.importActual('ink');
    return {
      ...actual,
      Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
      Text: ({ children, color, bold, dimColor, ...props }: any) => (
        <span
          style={{
            color,
            fontWeight: bold ? 'bold' : 'normal',
            opacity: dimColor ? 0.7 : 1
          }}
          data-testid="text"
          {...props}
        >
          {children}
        </span>
      ),
    };
  });

  // Mock ink-spinner
  vi.mock('ink-spinner', () => ({
    default: ({ type }: { type: string }) => <span data-testid="spinner">{type === 'dots' ? '⋯' : '○'}</span>,
  }));

  // Mock the useStdoutDimensions hook with default 80-column terminal
  vi.mock('../ui/hooks/index', () => ({
    useStdoutDimensions: vi.fn(() => TERMINAL_CONFIGS[80]),
  }));
}

/**
 * Helper to mock terminal width for responsive testing
 *
 * @param cols - Terminal width in columns (40, 60, 80, 120, or 160)
 * @param overrides - Optional overrides for specific dimension properties
 * @returns The mock return value for verification
 *
 * @example
 * beforeEach(() => {
 *   mockTerminalWidth(80); // Sets up compact breakpoint
 * });
 *
 * it('adapts to narrow terminals', () => {
 *   mockTerminalWidth(40); // Switch to narrow
 *   // ... test narrow behavior
 * });
 */
export function mockTerminalWidth(
  cols: TerminalWidth,
  overrides?: Partial<StdoutDimensions>
): StdoutDimensions {
  // Import the hook mock (must be done after setupResponsiveMocks)
  if (!mockUseStdoutDimensions) {
    const hookModule = require('../ui/hooks/index');
    mockUseStdoutDimensions = hookModule.useStdoutDimensions as Mock;
  }

  const config = { ...TERMINAL_CONFIGS[cols], ...overrides };
  mockUseStdoutDimensions.mockReturnValue(config);
  return config;
}

// =============================================================================
// SECTION 2: Component Composition Wrapper
// =============================================================================

/**
 * Configuration for responsive test wrapper
 */
export interface ResponsiveTestWrapperProps {
  children: React.ReactNode;
  /** Initial terminal width (default: 80) */
  initialWidth?: TerminalWidth;
  /** Theme overrides */
  theme?: Partial<typeof mockTheme>;
}

/**
 * Wrapper component providing consistent test context for responsive components
 *
 * Features:
 * - ThemeProvider with test theme
 * - Consistent Ink component mocking
 * - Pre-configured terminal dimensions
 */
export const ResponsiveTestWrapper: React.FC<ResponsiveTestWrapperProps> = ({
  children,
  initialWidth = 80,
  theme = mockTheme,
}) => {
  // Set up initial terminal width when component mounts
  React.useEffect(() => {
    mockTerminalWidth(initialWidth);
  }, [initialWidth]);

  return <ThemeProvider>{children}</ThemeProvider>;
};

/**
 * Enhanced render result with responsive helpers
 */
export interface EnhancedRenderResult extends RenderResult {
  /** Change terminal width and rerender component */
  setWidth: (width: TerminalWidth) => void;
}

/**
 * Custom render function for responsive component testing
 *
 * @param ui - React element to render
 * @param options - Render options including terminal width
 * @returns Enhanced render result with responsive helpers
 *
 * @example
 * const { rerender, setWidth } = renderResponsive(
 *   <TaskProgress {...props} />,
 *   { width: 80 }
 * );
 *
 * // Test at different widths
 * setWidth(40);
 * rerender(<TaskProgress {...props} />);
 */
export function renderResponsive(
  ui: React.ReactElement,
  options?: {
    width?: TerminalWidth;
    theme?: Partial<typeof mockTheme>;
  }
): EnhancedRenderResult {
  const width = options?.width ?? 80;
  const theme = options?.theme ?? mockTheme;

  // Set initial terminal width
  mockTerminalWidth(width);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ResponsiveTestWrapper initialWidth={width} theme={theme}>
      {children}
    </ResponsiveTestWrapper>
  );

  const renderResult = render(ui, { wrapper: Wrapper });

  const setWidth = (newWidth: TerminalWidth) => {
    mockTerminalWidth(newWidth);
    renderResult.rerender(ui);
  };

  return {
    ...renderResult,
    setWidth,
  };
}

// =============================================================================
// SECTION 3: Responsive Assertion Helpers
// =============================================================================

/**
 * Assert that text content does not overflow the specified width
 *
 * @param element - DOM element to check
 * @param maxWidth - Maximum allowed character width
 * @throws AssertionError if content exceeds maxWidth
 *
 * @example
 * expectNoOverflow(screen.getByTestId('description'), 80);
 */
export function expectNoOverflow(
  element: HTMLElement,
  maxWidth: number
): void {
  const textContent = element.textContent || '';
  const textLength = textContent.length;

  expect(textLength).toBeLessThanOrEqual(maxWidth);
}

/**
 * Assert that text has been truncated (contains "..." or is shorter than original)
 *
 * @param element - DOM element containing potentially truncated text
 * @param originalText - The full untruncated text
 *
 * @example
 * const longDescription = 'This is a very long description...';
 * expectTruncated(screen.getByTestId('desc'), longDescription);
 */
export function expectTruncated(
  element: HTMLElement,
  originalText: string
): void {
  const displayedText = element.textContent || '';

  // Text should either be shorter than original or contain ellipsis
  const isShorter = displayedText.length < originalText.length;
  const hasEllipsis = displayedText.includes('...');

  expect(isShorter || hasEllipsis).toBe(true);

  // If it contains ellipsis, verify it's actually truncated
  if (hasEllipsis) {
    expect(displayedText.length).toBeLessThan(originalText.length);
  }
}

/**
 * Assert that text is NOT truncated
 *
 * @param element - DOM element that should contain full text
 * @param originalText - The expected full text
 */
export function expectNotTruncated(
  element: HTMLElement,
  originalText: string
): void {
  const displayedText = element.textContent || '';

  // Text should contain the full original text or be the same length
  // (allowing for minor formatting differences)
  expect(displayedText).toContain(originalText);
  expect(displayedText).not.toMatch(/\.\.\.$/); // Should not end with ellipsis
}

/**
 * Configuration for breakpoint behavior testing
 */
export interface BreakpointBehaviorConfig {
  component: React.ReactElement;
  /** Elements expected to be visible at each breakpoint */
  visible?: {
    narrow?: string[];
    compact?: string[];
    normal?: string[];
    wide?: string[];
  };
  /** Elements expected to be hidden at each breakpoint */
  hidden?: {
    narrow?: string[];
    compact?: string[];
    normal?: string[];
    wide?: string[];
  };
  /** Custom render options */
  renderOptions?: {
    theme?: Partial<typeof mockTheme>;
  };
}

/**
 * Comprehensively test component behavior across all breakpoints
 *
 * @param config - Breakpoint behavior configuration
 *
 * @example
 * expectBreakpointBehavior({
 *   component: <Banner version="1.0.0" />,
 *   visible: {
 *     wide: ['ASCII art', 'Full tagline'],
 *     normal: ['ASCII art', 'Full tagline'],
 *     compact: ['Compact box', 'Full tagline'],
 *     narrow: ['APEX', 'Version'],
 *   },
 *   hidden: {
 *     narrow: ['ASCII art', 'Compact box'],
 *     compact: ['ASCII art'],
 *   }
 * });
 */
export function expectBreakpointBehavior(
  config: BreakpointBehaviorConfig
): void {
  const breakpoints: Array<{ name: Breakpoint; width: TerminalWidth }> = [
    { name: 'narrow', width: 40 },
    { name: 'compact', width: 80 },
    { name: 'normal', width: 120 },
    { name: 'wide', width: 160 },
  ];

  for (const { name, width } of breakpoints) {
    const { container } = renderResponsive(config.component, {
      width,
      ...config.renderOptions,
    });

    // Check elements that should be visible
    const visibleElements = config.visible?.[name] ?? [];
    for (const elementText of visibleElements) {
      expect(container).toHaveTextContent(elementText);
    }

    // Check elements that should be hidden
    const hiddenElements = config.hidden?.[name] ?? [];
    for (const elementText of hiddenElements) {
      expect(container).not.toHaveTextContent(elementText);
    }

    // Clean up for next iteration
    vi.clearAllMocks();
  }
}

// =============================================================================
// SECTION 4: Integration Tests - Foundation Validation
// =============================================================================

// Setup mocks before running any tests
setupResponsiveMocks();

describe('Responsive Layout Integration Test Foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default 80-column terminal
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mockTerminalWidth helper', () => {
    it('should correctly set terminal width and breakpoint for narrow (40 cols)', () => {
      const result = mockTerminalWidth(40);

      expect(result).toEqual({
        width: 40,
        height: 24,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should correctly set terminal width and breakpoint for compact (60 cols)', () => {
      const result = mockTerminalWidth(60);

      expect(result).toEqual({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should correctly set terminal width and breakpoint for compact (80 cols)', () => {
      const result = mockTerminalWidth(80);

      expect(result).toEqual({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should correctly set terminal width and breakpoint for normal (120 cols)', () => {
      const result = mockTerminalWidth(120);

      expect(result).toEqual({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should correctly set terminal width and breakpoint for wide (160 cols)', () => {
      const result = mockTerminalWidth(160);

      expect(result).toEqual({
        width: 160,
        height: 40,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });
    });

    it('should support overrides for custom dimension properties', () => {
      const result = mockTerminalWidth(80, {
        height: 50,
        isAvailable: false,
      });

      expect(result).toEqual({
        width: 80,
        height: 50, // overridden
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: false, // overridden
      });
    });

    it('should update the useStdoutDimensions mock correctly', () => {
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const mockHook = useStdoutDimensions as Mock;

      mockTerminalWidth(40);
      expect(mockHook).toHaveBeenCalled();
      expect(mockHook.mock.results[mockHook.mock.results.length - 1].value.width).toBe(40);

      mockTerminalWidth(160);
      expect(mockHook.mock.results[mockHook.mock.results.length - 1].value.width).toBe(160);
    });
  });

  describe('ResponsiveTestWrapper', () => {
    it('should provide theme context for child components', () => {
      render(
        <ResponsiveTestWrapper>
          <div data-testid="test-child">Test Content</div>
        </ResponsiveTestWrapper>
      );

      expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    it('should set initial terminal width correctly', () => {
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const mockHook = useStdoutDimensions as Mock;

      render(
        <ResponsiveTestWrapper initialWidth={40}>
          <div data-testid="test-child">Test Content</div>
        </ResponsiveTestWrapper>
      );

      // Should have called mockTerminalWidth with 40
      expect(mockHook.mock.results[mockHook.mock.results.length - 1].value.width).toBe(40);
    });

    it('should use default 80-column width when initialWidth not provided', () => {
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const mockHook = useStdoutDimensions as Mock;

      render(
        <ResponsiveTestWrapper>
          <div data-testid="test-child">Test Content</div>
        </ResponsiveTestWrapper>
      );

      expect(mockHook.mock.results[mockHook.mock.results.length - 1].value.width).toBe(80);
    });
  });

  describe('renderResponsive function', () => {
    const TestComponent: React.FC<{ text: string }> = ({ text }) => {
      // Import and use the hook to demonstrate it works
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const { width, breakpoint } = useStdoutDimensions();

      return (
        <div data-testid="test-component">
          <span data-testid="text">{text}</span>
          <span data-testid="width">{width}</span>
          <span data-testid="breakpoint">{breakpoint}</span>
        </div>
      );
    };

    it('should render component with default 80-column width', () => {
      const { container } = renderResponsive(<TestComponent text="Hello World" />);

      expect(screen.getByTestId('text')).toHaveTextContent('Hello World');
      expect(screen.getByTestId('width')).toHaveTextContent('80');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('compact');
    });

    it('should render component with specified width', () => {
      renderResponsive(<TestComponent text="Hello World" />, { width: 40 });

      expect(screen.getByTestId('width')).toHaveTextContent('40');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('narrow');
    });

    it('should provide setWidth helper for changing terminal width', () => {
      const { setWidth } = renderResponsive(<TestComponent text="Hello World" />);

      // Initially 80 columns
      expect(screen.getByTestId('width')).toHaveTextContent('80');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('compact');

      // Change to narrow
      setWidth(40);
      expect(screen.getByTestId('width')).toHaveTextContent('40');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('narrow');

      // Change to wide
      setWidth(160);
      expect(screen.getByTestId('width')).toHaveTextContent('160');
      expect(screen.getByTestId('breakpoint')).toHaveTextContent('wide');
    });
  });

  describe('Responsive assertion helpers', () => {
    describe('expectNoOverflow', () => {
      it('should pass when text fits within width limit', () => {
        render(<div data-testid="text">Short text</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNoOverflow(element, 20)).not.toThrow();
      });

      it('should fail when text exceeds width limit', () => {
        render(<div data-testid="text">This is a very long text that exceeds the limit</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNoOverflow(element, 20)).toThrow();
      });
    });

    describe('expectTruncated', () => {
      it('should pass when text is shorter than original', () => {
        render(<div data-testid="text">Short</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'This is the original long text')).not.toThrow();
      });

      it('should pass when text contains ellipsis', () => {
        render(<div data-testid="text">Truncated text...</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'Truncated text that is much longer')).not.toThrow();
      });

      it('should fail when text is not truncated', () => {
        render(<div data-testid="text">Full original text</div>);
        const element = screen.getByTestId('text');

        expect(() => expectTruncated(element, 'Full original text')).toThrow();
      });
    });

    describe('expectNotTruncated', () => {
      it('should pass when text contains the full original text', () => {
        render(<div data-testid="text">Full original text</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNotTruncated(element, 'Full original text')).not.toThrow();
      });

      it('should fail when text ends with ellipsis', () => {
        render(<div data-testid="text">Truncated...</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNotTruncated(element, 'Truncated full text')).toThrow();
      });

      it('should fail when text does not contain original', () => {
        render(<div data-testid="text">Different text</div>);
        const element = screen.getByTestId('text');

        expect(() => expectNotTruncated(element, 'Original text')).toThrow();
      });
    });

    describe('expectBreakpointBehavior', () => {
      const SimpleResponsiveComponent: React.FC = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { breakpoint } = useStdoutDimensions();

        return (
          <div>
            {breakpoint === 'narrow' && <span>Narrow Mode</span>}
            {breakpoint === 'compact' && <span>Compact Mode</span>}
            {breakpoint === 'normal' && <span>Normal Mode</span>}
            {breakpoint === 'wide' && <span>Wide Mode</span>}
            {(breakpoint === 'normal' || breakpoint === 'wide') && <span>Full Features</span>}
          </div>
        );
      };

      it('should validate component behavior across all breakpoints', () => {
        expect(() => {
          expectBreakpointBehavior({
            component: <SimpleResponsiveComponent />,
            visible: {
              narrow: ['Narrow Mode'],
              compact: ['Compact Mode'],
              normal: ['Normal Mode', 'Full Features'],
              wide: ['Wide Mode', 'Full Features'],
            },
            hidden: {
              narrow: ['Compact Mode', 'Normal Mode', 'Wide Mode', 'Full Features'],
              compact: ['Narrow Mode', 'Normal Mode', 'Wide Mode', 'Full Features'],
              normal: ['Narrow Mode', 'Compact Mode', 'Wide Mode'],
              wide: ['Narrow Mode', 'Compact Mode', 'Normal Mode'],
            },
          });
        }).not.toThrow();
      });

      it('should fail when expected visible elements are not found', () => {
        expect(() => {
          expectBreakpointBehavior({
            component: <SimpleResponsiveComponent />,
            visible: {
              narrow: ['Non-existent Element'],
            },
          });
        }).toThrow();
      });

      it('should fail when expected hidden elements are found', () => {
        expect(() => {
          expectBreakpointBehavior({
            component: <SimpleResponsiveComponent />,
            hidden: {
              narrow: ['Narrow Mode'], // This will be visible in narrow mode
            },
          });
        }).toThrow();
      });
    });
  });

  describe('Integration examples', () => {
    const ExampleCard: React.FC<{ title: string; description: string }> = ({
      title,
      description
    }) => {
      const { useStdoutDimensions } = require('../ui/hooks/index');
      const { width, breakpoint } = useStdoutDimensions();

      // Calculate truncation based on available width
      const titleLimit = breakpoint === 'narrow' ? 15 : breakpoint === 'compact' ? 25 : 40;
      const descLimit = width - 20; // Reserve space for padding/borders

      const truncateText = (text: string, limit: number) =>
        text.length > limit ? text.slice(0, limit - 3) + '...' : text;

      return (
        <div data-testid="card">
          <h3 data-testid="title">{truncateText(title, titleLimit)}</h3>
          <p data-testid="description">{truncateText(description, descLimit)}</p>
          {breakpoint !== 'narrow' && (
            <div data-testid="metadata">
              Width: {width} | Breakpoint: {breakpoint}
            </div>
          )}
        </div>
      );
    };

    it('should demonstrate complete responsive testing workflow', () => {
      const longTitle = 'This is a very long title that should be truncated';
      const longDescription = 'This is a very long description that should be truncated based on the available terminal width and responsive breakpoint';

      const { setWidth } = renderResponsive(
        <ExampleCard title={longTitle} description={longDescription} />
      );

      // Test at narrow width (40 columns)
      setWidth(40);
      const titleElement = screen.getByTestId('title');
      const descElement = screen.getByTestId('description');

      expectTruncated(titleElement, longTitle);
      expectTruncated(descElement, longDescription);
      expectNoOverflow(descElement, 20); // 40 - 20 reserved space
      expect(screen.queryByTestId('metadata')).not.toBeInTheDocument();

      // Test at wide width (160 columns)
      setWidth(160);
      expectNotTruncated(titleElement, longTitle);
      expectNoOverflow(descElement, 140); // 160 - 20 reserved space
      expect(screen.getByTestId('metadata')).toBeInTheDocument();
      expect(screen.getByText('Width: 160 | Breakpoint: wide')).toBeInTheDocument();
    });

    it('should demonstrate breakpoint behavior validation', () => {
      expectBreakpointBehavior({
        component: (
          <ExampleCard
            title="Test Title"
            description="Test description for responsive behavior"
          />
        ),
        visible: {
          narrow: ['Test Title'],
          compact: ['Test Title', 'Width: 80 | Breakpoint: compact'],
          normal: ['Test Title', 'Width: 120 | Breakpoint: normal'],
          wide: ['Test Title', 'Width: 160 | Breakpoint: wide'],
        },
        hidden: {
          narrow: ['Width:', 'Breakpoint:'],
        },
      });
    });
  });
});