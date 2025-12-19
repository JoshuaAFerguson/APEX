import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  mockTerminalWidth,
  setupResponsiveMocks,
  renderResponsive,
  expectNoOverflow,
  expectTruncated,
  expectNotTruncated,
  expectBreakpointBehavior,
  ResponsiveTestWrapper,
  type TerminalWidth,
} from './responsive-layout-foundation.integration.test';

// =============================================================================
// Documentation Tests - Usage Examples and Best Practices
// =============================================================================

setupResponsiveMocks();

describe('Responsive Layout Foundation - Documentation & Usage Examples', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('📖 Getting Started Examples', () => {
    it('Example 1: Basic responsive component with boolean helpers', () => {
      /**
       * This example demonstrates the most common usage pattern:
       * Using boolean helpers for responsive behavior
       */
      const BasicExample = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, isNarrow, isCompact, isNormal, isWide } = useStdoutDimensions();

        return (
          <div data-testid="basic-example">
            <div data-testid="title">
              {isNarrow ? 'APEX' : 'APEX Development Platform'}
            </div>

            <div data-testid="content">
              {isNarrow && <div>Minimal view for narrow terminals ({width} cols)</div>}
              {isCompact && <div>Compact view for medium terminals ({width} cols)</div>}
              {isNormal && <div>Standard view for normal terminals ({width} cols)</div>}
              {isWide && <div>Enhanced view for wide terminals ({width} cols)</div>}
            </div>

            {/* Show different features based on terminal width */}
            {!isNarrow && (
              <div data-testid="features">
                <div>🔧 Project Management</div>
                {!isCompact && <div>📊 Analytics Dashboard</div>}
                {isWide && <div>🤖 AI Agent Monitoring</div>}
              </div>
            )}
          </div>
        );
      };

      // Test the component at different breakpoints
      expectBreakpointBehavior({
        component: <BasicExample />,
        visible: {
          narrow: ['APEX', 'Minimal view for narrow terminals (40 cols)'],
          compact: ['APEX Development Platform', 'Compact view for medium terminals (80 cols)', '🔧 Project Management'],
          normal: ['APEX Development Platform', 'Standard view for normal terminals (120 cols)', '🔧 Project Management', '📊 Analytics Dashboard'],
          wide: ['APEX Development Platform', 'Enhanced view for wide terminals (160 cols)', '🔧 Project Management', '📊 Analytics Dashboard', '🤖 AI Agent Monitoring'],
        },
      });
    });

    it('Example 2: Using breakpoint switch pattern', () => {
      /**
       * This example shows using the breakpoint enum for cleaner switch statements
       */
      const SwitchExample = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { breakpoint, width } = useStdoutDimensions();

        const getLayout = () => {
          switch (breakpoint) {
            case 'narrow':
              return { columns: 1, showSidebar: false, showDetails: false };
            case 'compact':
              return { columns: 2, showSidebar: false, showDetails: false };
            case 'normal':
              return { columns: 2, showSidebar: true, showDetails: false };
            case 'wide':
              return { columns: 3, showSidebar: true, showDetails: true };
            default:
              return { columns: 2, showSidebar: false, showDetails: false };
          }
        };

        const layout = getLayout();

        return (
          <div data-testid="switch-example">
            <div data-testid="header">Terminal: {width} cols ({breakpoint})</div>
            <div data-testid="grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}>
              {layout.showSidebar && <div data-testid="sidebar">Sidebar</div>}
              <div data-testid="main">Main Content</div>
              {layout.showDetails && <div data-testid="details">Detail Panel</div>}
            </div>
          </div>
        );
      };

      const { setWidth } = renderResponsive(<SwitchExample />);

      // Test narrow
      setWidth(40);
      expect(screen.getByTestId('header')).toHaveTextContent('Terminal: 40 cols (narrow)');
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('details')).not.toBeInTheDocument();

      // Test wide
      setWidth(160);
      expect(screen.getByTestId('header')).toHaveTextContent('Terminal: 160 cols (wide)');
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('details')).toBeInTheDocument();
    });
  });

  describe('🧪 Testing Patterns Examples', () => {
    it('Example 3: Using renderResponsive for component testing', () => {
      /**
       * This example demonstrates best practices for testing responsive components
       */
      const ComponentUnderTest = ({ title }: { title: string }) => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, isNarrow } = useStdoutDimensions();

        const maxTitleLength = isNarrow ? 10 : 30;
        const displayTitle = title.length > maxTitleLength
          ? title.slice(0, maxTitleLength - 3) + '...'
          : title;

        return (
          <div data-testid="component">
            <h1 data-testid="title">{displayTitle}</h1>
            <div data-testid="info">Terminal width: {width}</div>
          </div>
        );
      };

      const longTitle = 'This is a very long title that should be truncated in narrow mode';

      // Use renderResponsive for easy width testing
      const { setWidth } = renderResponsive(
        <ComponentUnderTest title={longTitle} />,
        { width: 80 } // Start at compact width
      );

      // Test at compact width - title should not be truncated
      expect(screen.getByTestId('title')).toHaveTextContent(longTitle);
      expectNotTruncated(screen.getByTestId('title'), longTitle);

      // Change to narrow width - title should be truncated
      setWidth(40);
      expect(screen.getByTestId('info')).toHaveTextContent('Terminal width: 40');
      expectTruncated(screen.getByTestId('title'), longTitle);
      expectNoOverflow(screen.getByTestId('title'), 10);
    });

    it('Example 4: Using expectBreakpointBehavior for comprehensive testing', () => {
      /**
       * This example shows how to use expectBreakpointBehavior for complete responsive testing
       */
      const StatusIndicator = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { isNarrow, isCompact } = useStdoutDimensions();

        return (
          <div data-testid="status">
            {isNarrow ? (
              <span>✓</span>
            ) : isCompact ? (
              <span>✓ OK</span>
            ) : (
              <span>✓ System Operational</span>
            )}
          </div>
        );
      };

      // Test all breakpoints in one assertion
      expectBreakpointBehavior({
        component: <StatusIndicator />,
        visible: {
          narrow: ['✓'],
          compact: ['✓ OK'],
          normal: ['✓ System Operational'],
          wide: ['✓ System Operational'],
        },
        hidden: {
          narrow: ['OK', 'System Operational'],
          compact: ['System Operational'],
        },
      });
    });

    it('Example 5: Using ResponsiveTestWrapper for custom test setups', () => {
      /**
       * This example shows how to use ResponsiveTestWrapper for custom test environments
       */
      const ComponentWithContext = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width } = useStdoutDimensions();

        return (
          <div data-testid="context-component">
            Width from context: {width}
          </div>
        );
      };

      // Use ResponsiveTestWrapper directly for more control
      render(
        <ResponsiveTestWrapper initialWidth={120}>
          <ComponentWithContext />
        </ResponsiveTestWrapper>
      );

      expect(screen.getByTestId('context-component')).toHaveTextContent('Width from context: 120');
    });
  });

  describe('🎨 Advanced Patterns Examples', () => {
    it('Example 6: Responsive text truncation patterns', () => {
      /**
       * This example demonstrates different text truncation strategies
       */
      const TextTruncationExample = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, breakpoint } = useStdoutDimensions();

        const longDescription = 'This is a very long description that demonstrates various truncation strategies based on terminal width and responsive breakpoints.';

        // Different truncation strategies by breakpoint
        const getTruncatedText = () => {
          switch (breakpoint) {
            case 'narrow':
              return longDescription.slice(0, 20) + '...';
            case 'compact':
              return longDescription.slice(0, 40) + '...';
            case 'normal':
              return longDescription.slice(0, 60) + '...';
            case 'wide':
              return longDescription; // Full text
          }
        };

        // Character-based truncation for precise control
        const getCharBasedText = () => {
          const availableChars = width - 10; // Reserve 10 chars for padding
          return longDescription.length > availableChars
            ? longDescription.slice(0, availableChars - 3) + '...'
            : longDescription;
        };

        return (
          <div data-testid="truncation-example">
            <div data-testid="breakpoint-based">{getTruncatedText()}</div>
            <div data-testid="character-based">{getCharBasedText()}</div>
            <div data-testid="width-info">Available: {width} chars</div>
          </div>
        );
      };

      const { setWidth } = renderResponsive(<TextTruncationExample />);

      // Test narrow mode
      setWidth(40);
      const breakpointBased = screen.getByTestId('breakpoint-based');
      const characterBased = screen.getByTestId('character-based');

      expectTruncated(breakpointBased, 'This is a very long description that demonstrates various truncation strategies based on terminal width and responsive breakpoints.');
      expectTruncated(characterBased, 'This is a very long description that demonstrates various truncation strategies based on terminal width and responsive breakpoints.');
      expectNoOverflow(characterBased, 30); // 40 - 10 reserved

      // Test wide mode
      setWidth(160);
      const wideBreakpointBased = screen.getByTestId('breakpoint-based');
      expectNotTruncated(wideBreakpointBased, 'This is a very long description that demonstrates various truncation strategies based on terminal width and responsive breakpoints.');
    });

    it('Example 7: Progressive enhancement pattern', () => {
      /**
       * This example shows progressive enhancement based on available width
       */
      const ProgressiveEnhancementExample = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, isNarrow, isCompact, isNormal, isWide } = useStdoutDimensions();

        const features = {
          core: true, // Always available
          icons: !isNarrow, // Available from compact up
          descriptions: isNormal || isWide, // Available from normal up
          animations: isWide, // Only in wide mode
          detailedStats: width >= 140, // Custom width threshold
        };

        return (
          <div data-testid="progressive-example">
            <div data-testid="core">Core Feature</div>

            {features.icons && (
              <div data-testid="icons">🚀 With Icons</div>
            )}

            {features.descriptions && (
              <div data-testid="descriptions">
                Detailed descriptions available in normal and wide modes
              </div>
            )}

            {features.animations && (
              <div data-testid="animations">✨ Animated Elements</div>
            )}

            {features.detailedStats && (
              <div data-testid="detailed-stats">
                📊 Detailed Statistics (140+ cols)
              </div>
            )}

            <div data-testid="feature-summary">
              Features: {Object.values(features).filter(Boolean).length}/5
            </div>
          </div>
        );
      };

      expectBreakpointBehavior({
        component: <ProgressiveEnhancementExample />,
        visible: {
          narrow: ['Core Feature', 'Features: 1/5'],
          compact: ['Core Feature', '🚀 With Icons', 'Features: 2/5'],
          normal: ['Core Feature', '🚀 With Icons', 'Detailed descriptions', 'Features: 3/5'],
          wide: ['Core Feature', '🚀 With Icons', 'Detailed descriptions', '✨ Animated Elements', '📊 Detailed Statistics', 'Features: 5/5'],
        },
        hidden: {
          narrow: ['🚀 With Icons', 'Detailed descriptions', '✨ Animated Elements', '📊 Detailed Statistics'],
          compact: ['Detailed descriptions', '✨ Animated Elements', '📊 Detailed Statistics'],
          normal: ['✨ Animated Elements'],
        },
      });
    });

    it('Example 8: Responsive layout composition', () => {
      /**
       * This example demonstrates composing different layout strategies
       */
      const ResponsiveLayoutExample = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { isNarrow, isCompact, isWide } = useStdoutDimensions();

        // Different layout strategies
        const getLayoutStyle = () => {
          if (isNarrow) {
            return { display: 'flex', flexDirection: 'column' as const };
          }
          if (isCompact) {
            return { display: 'grid', gridTemplateColumns: '1fr 1fr' };
          }
          return { display: 'grid', gridTemplateColumns: isWide ? '1fr 2fr 1fr' : '1fr 2fr' };
        };

        const components = [
          { id: 'nav', content: 'Navigation', priority: 1 },
          { id: 'main', content: 'Main Content', priority: 1 },
          { id: 'sidebar', content: 'Sidebar', priority: 2 },
          { id: 'ads', content: 'Advertisements', priority: 3 },
        ];

        // Filter components based on available space
        const visibleComponents = components.filter(comp => {
          if (isNarrow) return comp.priority === 1;
          if (isCompact) return comp.priority <= 2;
          return true; // Show all in normal/wide
        });

        return (
          <div data-testid="layout-example" style={getLayoutStyle()}>
            {visibleComponents.map(comp => (
              <div key={comp.id} data-testid={comp.id}>
                {comp.content}
              </div>
            ))}
          </div>
        );
      };

      expectBreakpointBehavior({
        component: <ResponsiveLayoutExample />,
        visible: {
          narrow: ['Navigation', 'Main Content'],
          compact: ['Navigation', 'Main Content', 'Sidebar'],
          normal: ['Navigation', 'Main Content', 'Sidebar', 'Advertisements'],
          wide: ['Navigation', 'Main Content', 'Sidebar', 'Advertisements'],
        },
        hidden: {
          narrow: ['Sidebar', 'Advertisements'],
          compact: ['Advertisements'],
        },
      });
    });
  });

  describe('🏗️ Architecture Examples', () => {
    it('Example 9: Custom hook pattern for responsive behavior', () => {
      /**
       * This example shows how to create custom hooks for reusable responsive logic
       */
      const useResponsiveContent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, isNarrow, isCompact } = useStdoutDimensions();

        return {
          maxItems: isNarrow ? 3 : isCompact ? 6 : 10,
          showThumbnails: !isNarrow,
          showDescriptions: width >= 100,
          itemsPerRow: isNarrow ? 1 : isCompact ? 2 : 3,
        };
      };

      const CustomHookExample = () => {
        const config = useResponsiveContent();
        const items = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          title: `Item ${i + 1}`,
          description: `Description for item ${i + 1}`,
        }));

        const visibleItems = items.slice(0, config.maxItems);

        return (
          <div data-testid="custom-hook-example">
            <div data-testid="config-info">
              Showing {config.maxItems} items, {config.itemsPerRow} per row
            </div>

            <div
              data-testid="items-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${config.itemsPerRow}, 1fr)`,
                gap: '5px'
              }}
            >
              {visibleItems.map(item => (
                <div key={item.id} data-testid={`item-${item.id}`}>
                  {config.showThumbnails && <div data-testid={`thumb-${item.id}`}>🖼️</div>}
                  <div data-testid={`title-${item.id}`}>{item.title}</div>
                  {config.showDescriptions && (
                    <div data-testid={`desc-${item.id}`}>{item.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      };

      const { setWidth } = renderResponsive(<CustomHookExample />);

      // Test narrow configuration
      setWidth(40);
      expect(screen.getByTestId('config-info')).toHaveTextContent('Showing 3 items, 1 per row');
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-3')).toBeInTheDocument();
      expect(screen.queryByTestId('item-4')).not.toBeInTheDocument();
      expect(screen.queryByTestId('thumb-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('desc-1')).not.toBeInTheDocument();

      // Test wide configuration
      setWidth(160);
      expect(screen.getByTestId('config-info')).toHaveTextContent('Showing 10 items, 3 per row');
      expect(screen.getByTestId('item-10')).toBeInTheDocument();
      expect(screen.getByTestId('thumb-1')).toBeInTheDocument();
      expect(screen.getByTestId('desc-1')).toBeInTheDocument();
    });

    it('Example 10: Testing responsive components with mocked dependencies', () => {
      /**
       * This example shows how to test components that depend on external responsive logic
       */
      interface MockService {
        getVisibleColumns: (width: number) => string[];
        getMaxRows: (breakpoint: string) => number;
      }

      const mockService: MockService = {
        getVisibleColumns: (width: number) => {
          if (width < 60) return ['name'];
          if (width < 100) return ['name', 'status'];
          if (width < 140) return ['name', 'status', 'date'];
          return ['name', 'status', 'date', 'actions'];
        },
        getMaxRows: (breakpoint: string) => {
          switch (breakpoint) {
            case 'narrow': return 5;
            case 'compact': return 10;
            case 'normal': return 15;
            case 'wide': return 20;
            default: return 10;
          }
        }
      };

      const ServiceDependentComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, breakpoint } = useStdoutDimensions();

        const visibleColumns = mockService.getVisibleColumns(width);
        const maxRows = mockService.getMaxRows(breakpoint);

        return (
          <div data-testid="service-component">
            <div data-testid="columns">Columns: {visibleColumns.join(', ')}</div>
            <div data-testid="max-rows">Max rows: {maxRows}</div>
            <div data-testid="layout-info">{width} cols, {breakpoint} mode</div>
          </div>
        );
      };

      expectBreakpointBehavior({
        component: <ServiceDependentComponent />,
        visible: {
          narrow: ['Columns: name', 'Max rows: 5', '40 cols, narrow mode'],
          compact: ['Columns: name, status', 'Max rows: 10', '80 cols, compact mode'],
          normal: ['Columns: name, status, date', 'Max rows: 15', '120 cols, normal mode'],
          wide: ['Columns: name, status, date, actions', 'Max rows: 20', '160 cols, wide mode'],
        },
      });
    });
  });
});