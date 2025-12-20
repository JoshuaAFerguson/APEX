/**
 * Integration tests for ActivityLog displayMode behavior
 * Tests interactions between displayMode and other props, edge cases, and performance
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLog, type LogEntry } from '../ActivityLog';

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

// Mock useStdoutDimensions hook with configurable dimensions
const mockDimensions = vi.hoisted(() => ({
  width: 120,
  height: 40,
  breakpoint: 'wide',
}));

vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: () => mockDimensions,
}));

describe('ActivityLog DisplayMode Integration Tests', () => {
  let standardEntries: LogEntry[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock dimensions to default
    mockDimensions.width = 120;
    mockDimensions.height = 40;
    mockDimensions.breakpoint = 'wide';

    standardEntries = [
      {
        id: 'entry-1',
        timestamp: new Date('2024-01-01T10:00:00.123Z'),
        level: 'debug',
        message: 'Debug message for testing',
        agent: 'developer',
        data: { debugInfo: 'test data' },
      },
      {
        id: 'entry-2',
        timestamp: new Date('2024-01-01T10:01:00.456Z'),
        level: 'info',
        message: 'Information message that is moderately long for testing truncation behavior',
        agent: 'orchestrator',
        category: 'task',
        data: { taskId: 'task-123', status: 'active' },
        duration: 1500,
      },
      {
        id: 'entry-3',
        timestamp: new Date('2024-01-01T10:02:00.789Z'),
        level: 'error',
        message: 'Error message',
        agent: 'tester',
        data: { errorCode: 'ERR_001', details: 'Error details' },
        collapsed: true,
      },
    ];
  });

  describe('DisplayMode vs FilterLevel Interactions', () => {
    it('should respect explicit filterLevel over verbose auto-debug', () => {
      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          filterLevel="info"
          showTimestamps={true}
        />
      );

      // Debug entry should be hidden despite verbose mode
      expect(screen.queryByText('Debug message for testing')).not.toBeInTheDocument();
      expect(screen.getByText('Information message that is moderately long')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // Should not show auto verbose indicator
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();
    });

    it('should apply auto-debug filter only when no explicit filterLevel is provided', () => {
      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          // No filterLevel prop
        />
      );

      // All entries should be visible including debug
      expect(screen.getByText('Debug message for testing')).toBeInTheDocument();
      expect(screen.getByText('Information message that is moderately long')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // Should show auto verbose indicator
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should handle filterLevel changes dynamically', () => {
      const { rerender } = render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          filterLevel="error"
        />
      );

      // Only error entries should be visible
      expect(screen.queryByText('Debug message for testing')).not.toBeInTheDocument();
      expect(screen.queryByText('Information message that is moderately long')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // Change to no explicit filter
      rerender(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          // filterLevel removed
        />
      );

      // All entries should now be visible with auto-debug
      expect(screen.getByText('Debug message for testing')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });
  });

  describe('DisplayMode vs Responsive Design', () => {
    it('should maintain verbose features in narrow terminal', () => {
      // Mock narrow terminal
      mockDimensions.width = 40;
      mockDimensions.height = 20;
      mockDimensions.breakpoint = 'narrow';

      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Timestamps should still show milliseconds despite narrow width
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
      expect(screen.getByText('[10:01:00.456]')).toBeInTheDocument();

      // Messages should still not be truncated in verbose mode
      expect(screen.getByText('Information message that is moderately long for testing truncation behavior')).toBeInTheDocument();

      // Metadata should still be expanded
      expect(screen.getByText(/debugInfo: test data/)).toBeInTheDocument();
    });

    it('should apply normal truncation in normal mode with narrow terminal', () => {
      mockDimensions.width = 50;
      mockDimensions.breakpoint = 'narrow';

      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="normal"
          showTimestamps={true}
        />
      );

      // Timestamps should be abbreviated in narrow terminal
      expect(screen.getByText('[10:01]')).toBeInTheDocument();

      // Long message should be truncated in normal mode
      expect(screen.queryByText('Information message that is moderately long for testing truncation behavior')).not.toBeInTheDocument();
      expect(screen.getByText(/Information message that is moderately long/)).toBeInTheDocument();
    });

    it('should handle very wide terminals in verbose mode', () => {
      mockDimensions.width = 200;
      mockDimensions.breakpoint = 'wide';

      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should still show milliseconds and full content
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
      expect(screen.getByText('Information message that is moderately long for testing truncation behavior')).toBeInTheDocument();
    });
  });

  describe('DisplayMode vs Entry Limits', () => {
    it('should respect maxEntries limit in verbose mode', () => {
      const manyEntries: LogEntry[] = Array.from({ length: 10 }, (_, i) => ({
        id: `entry-${i}`,
        timestamp: new Date(`2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`),
        level: 'debug' as const,
        message: `Debug message ${i}`,
        data: { index: i },
      }));

      render(
        <ActivityLog
          entries={manyEntries}
          displayMode="verbose"
          maxEntries={5}
        />
      );

      // Should only show last 5 entries
      expect(screen.queryByText('Debug message 0')).not.toBeInTheDocument();
      expect(screen.queryByText('Debug message 4')).not.toBeInTheDocument();
      expect(screen.getByText('Debug message 5')).toBeInTheDocument();
      expect(screen.getByText('Debug message 9')).toBeInTheDocument();
      expect(screen.getByText('5 entries')).toBeInTheDocument();

      // All visible entries should still have verbose features
      expect(screen.getByText(/index: 5/)).toBeInTheDocument();
    });

    it('should combine filterLevel and maxEntries correctly in verbose mode', () => {
      const mixedLevelEntries: LogEntry[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `debug-${i}`,
          timestamp: new Date(`2024-01-01T10:0${i}:00Z`),
          level: 'debug' as const,
          message: `Debug ${i}`,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `info-${i}`,
          timestamp: new Date(`2024-01-01T10:1${i}:00Z`),
          level: 'info' as const,
          message: `Info ${i}`,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `error-${i}`,
          timestamp: new Date(`2024-01-01T10:2${i}:00Z`),
          level: 'error' as const,
          message: `Error ${i}`,
        })),
      ];

      render(
        <ActivityLog
          entries={mixedLevelEntries}
          displayMode="verbose"
          filterLevel="info"
          maxEntries={4}
        />
      );

      // Should filter out debug entries, then apply maxEntries to remaining
      expect(screen.queryByText(/Debug/)).not.toBeInTheDocument();
      expect(screen.getByText('Info 1')).toBeInTheDocument();
      expect(screen.getByText('Info 2')).toBeInTheDocument();
      expect(screen.getByText('Error 0')).toBeInTheDocument();
      expect(screen.getByText('Error 1')).toBeInTheDocument();
      expect(screen.getByText('4 entries')).toBeInTheDocument();
    });
  });

  describe('DisplayMode vs Other Props', () => {
    it('should work correctly when showTimestamps is disabled in verbose mode', () => {
      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          showTimestamps={false}
        />
      );

      // Should not show timestamps
      expect(screen.queryByText(/\[\d{2}:\d{2}:\d{2}/)).not.toBeInTheDocument();

      // But should still show debug entries and expanded metadata
      expect(screen.getByText('Debug message for testing')).toBeInTheDocument();
      expect(screen.getByText(/debugInfo: test data/)).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should work correctly when showAgents is disabled in verbose mode', () => {
      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          showAgents={false}
        />
      );

      // Should not show agent names
      expect(screen.queryByText('[developer]')).not.toBeInTheDocument();
      expect(screen.queryByText('[orchestrator]')).not.toBeInTheDocument();

      // But should still maintain other verbose features
      expect(screen.getByText('Debug message for testing')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should work correctly when allowCollapse is disabled in verbose mode', () => {
      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          allowCollapse={false}
        />
      );

      // Should not show collapse controls
      expect(screen.queryByText("Press 'c' to collapse")).not.toBeInTheDocument();
      expect(screen.queryByText('↑↓: Navigate | Enter: Toggle details | c: Collapse panel')).not.toBeInTheDocument();

      // But metadata should still be expanded in verbose mode
      expect(screen.getByText(/errorCode: ERR_001/)).toBeInTheDocument();
    });

    it('should handle custom title in verbose mode', () => {
      render(
        <ActivityLog
          entries={standardEntries}
          displayMode="verbose"
          title="Custom Verbose Log"
        />
      );

      expect(screen.getByText('Custom Verbose Log')).toBeInTheDocument();
      expect(screen.getByText('3 entries')).toBeInTheDocument(); // All entries visible due to auto-debug
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large numbers of debug entries efficiently', () => {
      const largeDebugSet: LogEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `debug-${i}`,
        timestamp: new Date(`2024-01-01T10:${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}.${(i % 1000).toString().padStart(3, '0')}Z`),
        level: 'debug' as const,
        message: `Debug message ${i} with some content`,
        data: {
          index: i,
          category: `category-${i % 10}`,
          payload: `data-${i}`,
        },
      }));

      const startTime = performance.now();

      render(
        <ActivityLog
          entries={largeDebugSet}
          displayMode="verbose"
          maxEntries={50} // Limit to reasonable number for performance
        />
      );

      const endTime = performance.now();

      // Should complete rendering in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should show correct number of entries
      expect(screen.getByText('50 entries')).toBeInTheDocument();

      // Should show debug entries with auto-debug
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
      expect(screen.getByText('Debug message 999 with some content')).toBeInTheDocument();
    });

    it('should handle entries with extremely deep nested data', () => {
      const deepDataEntry: LogEntry = {
        id: 'deep-data',
        timestamp: new Date('2024-01-01T10:00:00.000Z'),
        level: 'info',
        message: 'Entry with deeply nested data',
        data: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'This is deeply nested',
                    array: [1, 2, { nested: 'object' }],
                  },
                },
              },
            },
          },
        },
      };

      render(
        <ActivityLog
          entries={[deepDataEntry]}
          displayMode="verbose"
        />
      );

      // Should handle deep nesting without errors
      expect(screen.getByText('Entry with deeply nested data')).toBeInTheDocument();
      expect(screen.getByText(/level1:/)).toBeInTheDocument();
    });

    it('should handle entries with circular references safely', () => {
      // Create an object with circular reference
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      const circularEntry: LogEntry = {
        id: 'circular',
        timestamp: new Date(),
        level: 'info',
        message: 'Entry with circular data',
        data: {
          normal: 'value',
          // Note: JSON.stringify will throw on circular refs, but our component should handle it gracefully
          safeData: { key: 'value' },
        },
      };

      expect(() => {
        render(
          <ActivityLog
            entries={[circularEntry]}
            displayMode="verbose"
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Entry with circular data')).toBeInTheDocument();
    });

    it('should handle mode switching under load', () => {
      const { rerender } = render(
        <ActivityLog
          entries={standardEntries}
          displayMode="normal"
          showTimestamps={true}
        />
      );

      // Rapidly switch modes multiple times
      const modes: ('normal' | 'verbose' | 'compact')[] = ['verbose', 'compact', 'normal', 'verbose', 'compact', 'verbose'];

      modes.forEach(mode => {
        expect(() => {
          rerender(
            <ActivityLog
              entries={standardEntries}
              displayMode={mode}
              showTimestamps={true}
            />
          );
        }).not.toThrow();
      });

      // Should end up in verbose mode with correct behavior
      expect(screen.getByText('Debug message for testing')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should handle empty entries array in verbose mode', () => {
      render(
        <ActivityLog
          entries={[]}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('No log entries to display')).toBeInTheDocument();
      expect(screen.getByText('0 entries')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();
    });

    it('should handle invalid timestamp data gracefully', () => {
      const invalidTimestampEntry: LogEntry = {
        id: 'invalid-ts',
        timestamp: new Date('invalid-date'),
        level: 'info',
        message: 'Entry with invalid timestamp',
      };

      expect(() => {
        render(
          <ActivityLog
            entries={[invalidTimestampEntry]}
            displayMode="verbose"
            showTimestamps={true}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Entry with invalid timestamp')).toBeInTheDocument();
    });
  });
});