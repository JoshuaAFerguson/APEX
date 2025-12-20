/**
 * Comprehensive tests for ActivityLog displayMode="verbose" behavior
 * Tests the auto debug level behavior, expanded metadata, millisecond timestamps, and more
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

// Mock useStdoutDimensions hook
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: () => ({
    width: 120,
    height: 40,
    breakpoint: 'wide',
  }),
}));

describe('ActivityLog Verbose Mode', () => {
  let mockEntries: LogEntry[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockEntries = [
      {
        id: 'debug-entry',
        timestamp: new Date('2024-01-01T10:00:00.123Z'),
        level: 'debug',
        message: 'Debug level entry that should be visible in verbose mode',
        agent: 'developer',
        category: 'debugging',
        data: {
          step: 1,
          variables: { x: 10, y: 20 },
          trace: 'function processData()',
        },
      },
      {
        id: 'info-entry',
        timestamp: new Date('2024-01-01T10:01:30.456Z'),
        level: 'info',
        message: 'This is a very long information message that would normally be truncated in normal mode but should display fully in verbose mode without any truncation',
        agent: 'orchestrator',
        category: 'task-management',
        data: {
          taskId: 'task-123',
          status: 'in_progress',
          metadata: {
            assignedTo: 'developer',
            priority: 'high',
            estimatedDuration: '2h',
          },
        },
        duration: 1500,
      },
      {
        id: 'error-entry',
        timestamp: new Date('2024-01-01T10:02:15.789Z'),
        level: 'error',
        message: 'Error occurred during processing',
        agent: 'tester',
        data: {
          errorCode: 'ERR_001',
          details: 'Detailed error information',
          stackTrace: 'at function1\n  at function2\n  at main',
        },
      },
      {
        id: 'collapsed-entry',
        timestamp: new Date('2024-01-01T10:03:00.999Z'),
        level: 'warn',
        message: 'Warning with collapsed data',
        agent: 'reviewer',
        data: {
          warnings: ['Issue 1', 'Issue 2'],
          suggestions: 'Review the implementation',
        },
        collapsed: true,
      },
    ];
  });

  describe('Auto Debug Level Behavior', () => {
    it('should automatically set filter level to debug in verbose mode when no explicit level is provided', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Debug entry should be visible
      expect(screen.getByText('Debug level entry that should be visible in verbose mode')).toBeInTheDocument();

      // Should show auto verbose indicator in filter display
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // All entries should be visible (including debug)
      const logEntries = screen.getAllByText(/Debug level entry|This is a very long|Error occurred|Warning with collapsed/);
      expect(logEntries).toHaveLength(4);
    });

    it('should respect explicit filter level even in verbose mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          filterLevel="warn"
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Debug and info entries should NOT be visible with warn filter
      expect(screen.queryByText('Debug level entry that should be visible in verbose mode')).not.toBeInTheDocument();
      expect(screen.queryByText(/This is a very long information message/)).not.toBeInTheDocument();

      // Only warn and error entries should be visible
      expect(screen.getByText('Error occurred during processing')).toBeInTheDocument();
      expect(screen.getByText('Warning with collapsed data')).toBeInTheDocument();

      // Should NOT show auto verbose indicator when explicit level is set
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();
      expect(screen.getByText('Level: warn+')).toBeInTheDocument();
    });

    it('should show all debug entries when auto debug level is active', () => {
      const debugOnlyEntries: LogEntry[] = [
        {
          id: 'debug-1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          level: 'debug',
          message: 'First debug message',
          agent: 'developer',
        },
        {
          id: 'debug-2',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          level: 'debug',
          message: 'Second debug message',
          agent: 'tester',
        },
        {
          id: 'info-1',
          timestamp: new Date('2024-01-01T10:02:00Z'),
          level: 'info',
          message: 'Info message for comparison',
          agent: 'orchestrator',
        },
      ];

      render(
        <ActivityLog
          entries={debugOnlyEntries}
          displayMode="verbose"
        />
      );

      // All entries should be visible
      expect(screen.getByText('First debug message')).toBeInTheDocument();
      expect(screen.getByText('Second debug message')).toBeInTheDocument();
      expect(screen.getByText('Info message for comparison')).toBeInTheDocument();
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });
  });

  describe('Full Timestamps with Milliseconds', () => {
    it('should display full timestamps with milliseconds in verbose mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should show full timestamps with milliseconds
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
      expect(screen.getByText('[10:01:30.456]')).toBeInTheDocument();
      expect(screen.getByText('[10:02:15.789]')).toBeInTheDocument();
      expect(screen.getByText('[10:03:00.999]')).toBeInTheDocument();
    });

    it('should not abbreviate timestamps in verbose mode even with narrow terminal', () => {
      // Mock narrow terminal
      vi.doMock('../hooks/index.js', () => ({
        useStdoutDimensions: () => ({
          width: 40,
          height: 20,
          breakpoint: 'narrow',
        }),
      }));

      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should still show full timestamps with milliseconds even in narrow terminal
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
      expect(screen.getByText('[10:01:30.456]')).toBeInTheDocument();
    });

    it('should format milliseconds correctly for various timestamp values', () => {
      const timestampVariations: LogEntry[] = [
        {
          id: 'ms-0',
          timestamp: new Date('2024-01-01T10:00:00.000Z'),
          level: 'info',
          message: 'Zero milliseconds',
        },
        {
          id: 'ms-5',
          timestamp: new Date('2024-01-01T10:00:01.005Z'),
          level: 'info',
          message: 'Single digit milliseconds',
        },
        {
          id: 'ms-50',
          timestamp: new Date('2024-01-01T10:00:02.050Z'),
          level: 'info',
          message: 'Double digit milliseconds',
        },
        {
          id: 'ms-500',
          timestamp: new Date('2024-01-01T10:00:03.500Z'),
          level: 'info',
          message: 'Triple digit milliseconds',
        },
      ];

      render(
        <ActivityLog
          entries={timestampVariations}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should properly pad milliseconds
      expect(screen.getByText('[10:00:00.000]')).toBeInTheDocument();
      expect(screen.getByText('[10:00:01.005]')).toBeInTheDocument();
      expect(screen.getByText('[10:00:02.050]')).toBeInTheDocument();
      expect(screen.getByText('[10:00:03.500]')).toBeInTheDocument();
    });
  });

  describe('Auto-Expand Behavior', () => {
    it('should always show metadata in verbose mode even for collapsed entries', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
        />
      );

      // Metadata from collapsed entry should be visible in verbose mode
      expect(screen.getByText(/warnings:/)).toBeInTheDocument();
      expect(screen.getByText(/suggestions: Review the implementation/)).toBeInTheDocument();

      // All entries with data should show their metadata
      expect(screen.getByText(/step: 1/)).toBeInTheDocument();
      expect(screen.getByText(/errorCode: ERR_001/)).toBeInTheDocument();
      expect(screen.getByText(/taskId: task-123/)).toBeInTheDocument();
    });

    it('should show complex nested metadata in verbose mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
        />
      );

      // Complex nested objects should be displayed
      expect(screen.getByText(/variables:/)).toBeInTheDocument();
      expect(screen.getByText(/metadata:/)).toBeInTheDocument();

      // Should format complex objects properly
      expect(screen.getByText(/assignedTo/)).toBeInTheDocument();
      expect(screen.getByText(/priority/)).toBeInTheDocument();
      expect(screen.getByText(/estimatedDuration/)).toBeInTheDocument();
    });

    it('should handle entries without metadata gracefully', () => {
      const entriesWithoutData: LogEntry[] = [
        {
          id: 'no-data-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Entry without metadata',
          agent: 'developer',
        },
        {
          id: 'with-data-1',
          timestamp: new Date(),
          level: 'info',
          message: 'Entry with metadata',
          agent: 'tester',
          data: { key: 'value' },
        },
      ];

      render(
        <ActivityLog
          entries={entriesWithoutData}
          displayMode="verbose"
        />
      );

      // Should render both entries without errors
      expect(screen.getByText('Entry without metadata')).toBeInTheDocument();
      expect(screen.getByText('Entry with metadata')).toBeInTheDocument();
      expect(screen.getByText('key: value')).toBeInTheDocument();
    });
  });

  describe('Message Display - No Truncation', () => {
    it('should display full messages without truncation in verbose mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          width={80} // Small width to test truncation behavior
        />
      );

      // Long message should be displayed in full without truncation
      const longMessage = 'This is a very long information message that would normally be truncated in normal mode but should display fully in verbose mode without any truncation';
      expect(screen.getByText(longMessage)).toBeInTheDocument();

      // Should not contain truncation indicator
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });

    it('should truncate messages in normal mode for comparison', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="normal"
          width={80} // Small width to force truncation
        />
      );

      // Long message should be truncated in normal mode
      const longMessage = 'This is a very long information message that would normally be truncated in normal mode but should display fully in verbose mode without any truncation';
      expect(screen.queryByText(longMessage)).not.toBeInTheDocument();

      // Should show beginning of message
      expect(screen.getByText(/This is a very long information message/)).toBeInTheDocument();
    });

    it('should handle extremely long messages in verbose mode', () => {
      const extremelyLongEntry: LogEntry[] = [
        {
          id: 'long-message',
          timestamp: new Date(),
          level: 'info',
          message: 'A'.repeat(500) + ' - This message is extremely long and tests the verbose mode handling of very long content without truncation',
          agent: 'developer',
        },
      ];

      render(
        <ActivityLog
          entries={extremelyLongEntry}
          displayMode="verbose"
          width={60} // Small width
        />
      );

      // Should display full message even if extremely long
      expect(screen.getByText(/AAAAAAAAAA.*This message is extremely long/)).toBeInTheDocument();
    });
  });

  describe('Metadata Display - Not Truncated', () => {
    it('should display all metadata without truncation in verbose mode', () => {
      const entryWithLongMetadata: LogEntry[] = [
        {
          id: 'long-metadata',
          timestamp: new Date(),
          level: 'info',
          message: 'Entry with extensive metadata',
          data: {
            longDescription: 'This is an extremely long description that would normally be truncated in other modes but should be displayed in full in verbose mode without any truncation or abbreviation',
            complexObject: {
              nestedProperty: 'value with a very long description that should not be truncated',
              anotherLevel: {
                deepProperty: 'deep value that should be fully visible',
              },
            },
            arrayData: ['item1', 'item2', 'item3', 'item4 with very long description'],
          },
        },
      ];

      render(
        <ActivityLog
          entries={entryWithLongMetadata}
          displayMode="verbose"
        />
      );

      // All metadata should be visible without truncation
      expect(screen.getByText(/longDescription:/)).toBeInTheDocument();
      expect(screen.getByText(/This is an extremely long description.*without any truncation/)).toBeInTheDocument();
      expect(screen.getByText(/complexObject:/)).toBeInTheDocument();
      expect(screen.getByText(/arrayData:/)).toBeInTheDocument();
      expect(screen.getByText(/item4 with very long description/)).toBeInTheDocument();
    });

    it('should format JSON objects properly in verbose mode', () => {
      const entryWithJsonData: LogEntry[] = [
        {
          id: 'json-data',
          timestamp: new Date(),
          level: 'info',
          message: 'Entry with JSON data',
          data: {
            config: {
              enabled: true,
              settings: {
                timeout: 5000,
                retries: 3,
              },
            },
            results: [1, 2, 3],
          },
        },
      ];

      render(
        <ActivityLog
          entries={entryWithJsonData}
          displayMode="verbose"
        />
      );

      // JSON should be properly formatted (JSON.stringify with indentation)
      expect(screen.getByText(/config:/)).toBeInTheDocument();
      expect(screen.getByText(/enabled.*true/)).toBeInTheDocument();
      expect(screen.getByText(/timeout.*5000/)).toBeInTheDocument();
      expect(screen.getByText(/results:/)).toBeInTheDocument();
    });
  });

  describe('Verbose Mode Integration', () => {
    it('should combine all verbose features correctly', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
          showAgents={true}
          allowCollapse={true}
        />
      );

      // Should show debug entries (auto debug level)
      expect(screen.getByText('Debug level entry that should be visible in verbose mode')).toBeInTheDocument();

      // Should show milliseconds in timestamps
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();

      // Should show full messages without truncation
      expect(screen.getByText(/This is a very long information message.*without any truncation/)).toBeInTheDocument();

      // Should show metadata even for collapsed entries
      expect(screen.getByText(/warnings:/)).toBeInTheDocument();

      // Should show verbose mode indicator
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // Should show all agent names
      expect(screen.getByText('[developer]')).toBeInTheDocument();
      expect(screen.getByText('[orchestrator]')).toBeInTheDocument();
      expect(screen.getByText('[tester]')).toBeInTheDocument();
      expect(screen.getByText('[reviewer]')).toBeInTheDocument();
    });

    it('should maintain verbose behavior with different prop combinations', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={false}
          showAgents={false}
          allowCollapse={false}
        />
      );

      // Debug level should still auto-default
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // Messages should still not be truncated
      expect(screen.getByText(/This is a very long information message.*without any truncation/)).toBeInTheDocument();

      // Metadata should still be expanded
      expect(screen.getByText(/step: 1/)).toBeInTheDocument();
    });

    it('should handle mode switching from normal to verbose', () => {
      const { rerender } = render(
        <ActivityLog
          entries={mockEntries}
          displayMode="normal"
          showTimestamps={true}
        />
      );

      // In normal mode, debug should be hidden
      expect(screen.queryByText('Debug level entry that should be visible in verbose mode')).not.toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Debug entry should now be visible
      expect(screen.getByText('Debug level entry that should be visible in verbose mode')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // Timestamps should now show milliseconds
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data objects in verbose mode', () => {
      const emptyDataEntry: LogEntry[] = [
        {
          id: 'empty-data',
          timestamp: new Date(),
          level: 'info',
          message: 'Entry with empty data',
          data: {},
        },
      ];

      render(
        <ActivityLog
          entries={emptyDataEntry}
          displayMode="verbose"
        />
      );

      // Should not show empty data section
      expect(screen.getByText('Entry with empty data')).toBeInTheDocument();
      expect(screen.queryByText(/:/)).not.toBeInTheDocument(); // No key-value pairs
    });

    it('should handle null/undefined data values in verbose mode', () => {
      const nullDataEntry: LogEntry[] = [
        {
          id: 'null-data',
          timestamp: new Date(),
          level: 'info',
          message: 'Entry with null/undefined values',
          data: {
            nullValue: null,
            undefinedValue: undefined,
            emptyString: '',
            zeroValue: 0,
            falseValue: false,
          },
        },
      ];

      render(
        <ActivityLog
          entries={nullDataEntry}
          displayMode="verbose"
        />
      );

      // Should handle various data types appropriately
      expect(screen.getByText(/nullValue: null/)).toBeInTheDocument();
      expect(screen.getByText(/emptyString:/)).toBeInTheDocument();
      expect(screen.getByText(/zeroValue: 0/)).toBeInTheDocument();
      expect(screen.getByText(/falseValue: false/)).toBeInTheDocument();
    });

    it('should handle very large datasets in verbose mode', () => {
      const largeDataEntry: LogEntry[] = [
        {
          id: 'large-data',
          timestamp: new Date('2024-01-01T10:00:00.001Z'),
          level: 'info',
          message: 'Entry with large dataset',
          data: {
            largeArray: Array.from({ length: 100 }, (_, i) => `item-${i}`),
            largeObject: Object.fromEntries(
              Array.from({ length: 50 }, (_, i) => [`key${i}`, `value${i}`])
            ),
          },
        },
      ];

      render(
        <ActivityLog
          entries={largeDataEntry}
          displayMode="verbose"
        />
      );

      // Should handle large datasets without errors
      expect(screen.getByText('Entry with large dataset')).toBeInTheDocument();
      expect(screen.getByText(/largeArray:/)).toBeInTheDocument();
      expect(screen.getByText(/largeObject:/)).toBeInTheDocument();
    });
  });
});