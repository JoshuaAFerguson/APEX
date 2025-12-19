/**
 * Tests for ActivityLog displayMode prop acceptance and validation
 * Ensures the component properly accepts and handles the displayMode prop
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLog, type LogEntry, type ActivityLogProps } from '../ActivityLog';

// Mock Ink components for testing
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
    useInput: vi.fn(),
  };
});

// Mock useStdoutDimensions hook
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 40,
    breakpoint: 'wide',
  }),
}));

describe('ActivityLog DisplayMode Prop Validation', () => {
  let testEntries: LogEntry[];

  beforeEach(() => {
    vi.clearAllMocks();

    testEntries = [
      {
        id: 'test-1',
        timestamp: new Date('2024-01-01T10:00:00.123Z'),
        level: 'debug',
        message: 'Debug message',
        data: { key: 'value' },
      },
      {
        id: 'test-2',
        timestamp: new Date('2024-01-01T10:01:00.456Z'),
        level: 'info',
        message: 'Info message that is long enough to test truncation behavior in different modes',
      },
      {
        id: 'test-3',
        timestamp: new Date('2024-01-01T10:02:00.789Z'),
        level: 'error',
        message: 'Error message',
        data: { error: 'test error' },
        collapsed: true,
      },
    ];
  });

  describe('DisplayMode Prop Acceptance', () => {
    it('should accept displayMode="normal" prop', () => {
      expect(() => {
        render(
          <ActivityLog
            entries={testEntries}
            displayMode="normal"
          />
        );
      }).not.toThrow();

      // Should show info and error entries but not debug (default filter)
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
      expect(screen.getByText('Info message that is long enough')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();
    });

    it('should accept displayMode="compact" prop', () => {
      expect(() => {
        render(
          <ActivityLog
            entries={testEntries}
            displayMode="compact"
          />
        );
      }).not.toThrow();

      // In compact mode, still filters by level, but should be different behavior
      // Component should render without errors
      expect(screen.getByText(/Info message|Error message/)).toBeInTheDocument();
    });

    it('should accept displayMode="verbose" prop', () => {
      expect(() => {
        render(
          <ActivityLog
            entries={testEntries}
            displayMode="verbose"
          />
        );
      }).not.toThrow();

      // Should show debug message with auto-debug filter
      expect(screen.getByText('Debug message')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should accept displayMode prop with TypeScript type checking', () => {
      // This test ensures TypeScript types are correct
      const validProps: ActivityLogProps = {
        entries: testEntries,
        displayMode: 'verbose',
      };

      expect(() => {
        render(<ActivityLog {...validProps} />);
      }).not.toThrow();

      // Test all valid values
      const normalProps: ActivityLogProps = { entries: testEntries, displayMode: 'normal' };
      const compactProps: ActivityLogProps = { entries: testEntries, displayMode: 'compact' };
      const verboseProps: ActivityLogProps = { entries: testEntries, displayMode: 'verbose' };

      expect(() => render(<ActivityLog {...normalProps} />)).not.toThrow();
      expect(() => render(<ActivityLog {...compactProps} />)).not.toThrow();
      expect(() => render(<ActivityLog {...verboseProps} />)).not.toThrow();
    });
  });

  describe('DisplayMode Default Behavior', () => {
    it('should default to "normal" when displayMode prop is not provided', () => {
      render(
        <ActivityLog
          entries={testEntries}
          showTimestamps={true}
        />
      );

      // Should behave like normal mode - debug hidden, no milliseconds
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();

      // Should not show milliseconds (normal mode behavior)
      expect(screen.getByText('[10:01:00]')).toBeInTheDocument();
      expect(screen.queryByText('[10:01:00.456]')).not.toBeInTheDocument();
    });

    it('should handle undefined displayMode gracefully', () => {
      const props = {
        entries: testEntries,
        displayMode: undefined as any,
      };

      expect(() => {
        render(<ActivityLog {...props} />);
      }).not.toThrow();

      // Should fall back to normal mode behavior
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();
    });
  });

  describe('DisplayMode Prop Changes', () => {
    it('should handle displayMode prop changes dynamically', () => {
      const { rerender } = render(
        <ActivityLog
          entries={testEntries}
          displayMode="normal"
          showTimestamps={true}
        />
      );

      // Initial state - normal mode
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();
      expect(screen.getByText('[10:01:00]')).toBeInTheDocument(); // No milliseconds

      // Change to verbose mode
      rerender(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should now show debug and verbose features
      expect(screen.getByText('Debug message')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
      expect(screen.getByText('[10:01:00.456]')).toBeInTheDocument(); // With milliseconds

      // Change to compact mode
      rerender(
        <ActivityLog
          entries={testEntries}
          displayMode="compact"
          showTimestamps={true}
        />
      );

      // Should hide debug again and revert to normal filter behavior
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();
    });

    it('should maintain state consistency during rapid mode switches', () => {
      const { rerender } = render(
        <ActivityLog
          entries={testEntries}
          displayMode="normal"
        />
      );

      // Rapid mode switching
      const modes: ('normal' | 'verbose' | 'compact')[] = ['verbose', 'normal', 'compact', 'verbose', 'normal', 'verbose'];

      modes.forEach((mode, index) => {
        expect(() => {
          rerender(
            <ActivityLog
              entries={testEntries}
              displayMode={mode}
            />
          );
        }).not.toThrow();

        // Verify consistent behavior for each mode
        if (mode === 'verbose') {
          expect(screen.getByText('Debug message')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('DisplayMode with Other Props', () => {
    it('should work with all other props in verbose mode', () => {
      const fullProps: ActivityLogProps = {
        entries: testEntries,
        displayMode: 'verbose',
        maxEntries: 10,
        showTimestamps: true,
        showAgents: true,
        allowCollapse: true,
        filterLevel: undefined, // Test auto-debug behavior
        width: 100,
        height: 30,
        title: 'Test Verbose Log',
        autoScroll: true,
      };

      expect(() => {
        render(<ActivityLog {...fullProps} />);
      }).not.toThrow();

      // Verify verbose mode features work with all props
      expect(screen.getByText('Test Verbose Log')).toBeInTheDocument();
      expect(screen.getByText('Debug message')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument(); // Milliseconds
    });

    it('should respect explicit filterLevel in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          filterLevel="error"
          showTimestamps={true}
        />
      );

      // Should respect explicit filter even in verbose mode
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
      expect(screen.queryByText('Info message')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByText('Level: error+')).toBeInTheDocument();
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();

      // But should still show verbose timestamp format
      expect(screen.getByText('[10:02:00.789]')).toBeInTheDocument();
    });
  });

  describe('DisplayMode Error Handling', () => {
    it('should handle invalid displayMode values gracefully', () => {
      const invalidProps = {
        entries: testEntries,
        displayMode: 'invalid' as any,
      };

      // Component should not crash with invalid mode
      expect(() => {
        render(<ActivityLog {...invalidProps} />);
      }).not.toThrow();

      // Should fall back to normal mode behavior
      expect(screen.queryByText('Debug message')).not.toBeInTheDocument();
    });

    it('should handle displayMode with empty entries array', () => {
      expect(() => {
        render(
          <ActivityLog
            entries={[]}
            displayMode="verbose"
          />
        );
      }).not.toThrow();

      expect(screen.getByText('No log entries to display')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should handle displayMode with malformed entry data', () => {
      const malformedEntries: LogEntry[] = [
        {
          id: 'malformed',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          level: 'info',
          message: 'Test message',
          data: {
            // Potentially problematic data
            circularRef: undefined,
            deepNesting: { a: { b: { c: { d: 'deep' } } } },
            nullValue: null,
            undefinedValue: undefined,
          },
        },
      ];

      expect(() => {
        render(
          <ActivityLog
            entries={malformedEntries}
            displayMode="verbose"
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('DisplayMode Performance', () => {
    it('should handle displayMode prop changes efficiently', () => {
      const startTime = performance.now();

      const { rerender } = render(
        <ActivityLog
          entries={testEntries}
          displayMode="normal"
        />
      );

      // Multiple re-renders with mode changes
      for (let i = 0; i < 10; i++) {
        const mode = ['normal', 'verbose', 'compact'][i % 3] as 'normal' | 'verbose' | 'compact';
        rerender(
          <ActivityLog
            entries={testEntries}
            displayMode={mode}
          />
        );
      }

      const endTime = performance.now();

      // Should complete all re-renders quickly (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle large entry sets with displayMode prop efficiently', () => {
      const largeEntrySet: LogEntry[] = Array.from({ length: 500 }, (_, i) => ({
        id: `entry-${i}`,
        timestamp: new Date(`2024-01-01T10:${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.${(i % 1000).toString().padStart(3, '0')}Z`),
        level: (i % 4 === 0 ? 'debug' : i % 3 === 0 ? 'error' : 'info') as 'debug' | 'info' | 'error',
        message: `Message ${i}`,
        data: { index: i },
      }));

      const startTime = performance.now();

      render(
        <ActivityLog
          entries={largeEntrySet}
          displayMode="verbose"
          maxEntries={100}
        />
      );

      const endTime = performance.now();

      // Should render large sets efficiently (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should still function correctly
      expect(screen.getByText('100 entries')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });
  });
});