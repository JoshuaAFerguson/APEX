/**
 * Acceptance tests for ActivityLog displayMode="verbose" implementation
 * Tests the exact acceptance criteria specified in the task requirements
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

describe('ActivityLog Acceptance Criteria Tests', () => {
  let testEntries: LogEntry[];

  beforeEach(() => {
    vi.clearAllMocks();

    testEntries = [
      {
        id: 'debug-entry-1',
        timestamp: new Date('2024-01-01T10:00:00.123Z'),
        level: 'debug',
        message: 'Debug level message that should be visible in verbose mode',
        agent: 'developer',
        category: 'debugging',
        data: {
          debugInfo: 'detailed debug information',
          variables: { x: 10, y: 20, z: 30 },
          trace: 'function call trace information',
        },
      },
      {
        id: 'info-entry-1',
        timestamp: new Date('2024-01-01T10:01:15.456Z'),
        level: 'info',
        message: 'Information message with moderately long content to test message display behavior',
        agent: 'orchestrator',
        category: 'task-management',
        data: {
          taskId: 'task-12345',
          status: 'in-progress',
          assignee: 'developer-team',
          metadata: {
            priority: 'high',
            estimatedDuration: '2 hours',
            tags: ['feature', 'backend'],
          },
        },
        duration: 1250,
      },
      {
        id: 'warn-entry-1',
        timestamp: new Date('2024-01-01T10:02:30.789Z'),
        level: 'warn',
        message: 'Warning message about potential issue that needs attention',
        agent: 'reviewer',
        data: {
          warning: 'Deprecated API usage detected',
          suggestions: ['Use new API endpoint', 'Update to latest version'],
          impact: 'medium',
        },
      },
      {
        id: 'collapsed-entry-1',
        timestamp: new Date('2024-01-01T10:03:45.999Z'),
        level: 'error',
        message: 'Error entry that is normally collapsed',
        agent: 'tester',
        data: {
          errorCode: 'ERR_001',
          errorMessage: 'Connection timeout occurred',
          stackTrace: 'at processRequest (handler.js:45)\n  at executeTask (worker.js:123)',
          context: {
            requestId: 'req-789',
            userId: 'user-456',
            timestamp: '2024-01-01T10:03:45.999Z',
          },
        },
        collapsed: true,
      },
    ];
  });

  describe('Acceptance Criteria: ActivityLog accepts displayMode prop', () => {
    it('should accept displayMode prop without errors', () => {
      // Test that the component accepts the displayMode prop
      expect(() => {
        render(
          <ActivityLog
            entries={testEntries}
            displayMode="verbose"
          />
        );
      }).not.toThrow();

      // Verify the component renders
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
    });

    it('should accept all valid displayMode values', () => {
      const validModes: Array<'normal' | 'compact' | 'verbose'> = ['normal', 'compact', 'verbose'];

      validModes.forEach(mode => {
        expect(() => {
          render(
            <ActivityLog
              entries={testEntries}
              displayMode={mode}
            />
          );
        }).not.toThrow();
      });
    });
  });

  describe('Acceptance Criteria: In verbose mode - filterLevel defaults to debug', () => {
    it('should automatically set filterLevel to debug when displayMode is verbose and no explicit filterLevel is provided', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          // No filterLevel prop provided
        />
      );

      // Should show debug entries
      expect(screen.getByText('Debug level message that should be visible in verbose mode')).toBeInTheDocument();

      // Should display the auto-debug indicator
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // Should show all entries including debug level
      expect(screen.getByText('4 entries')).toBeInTheDocument();
    });

    it('should respect explicit filterLevel even in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          filterLevel="warn"
        />
      );

      // Should NOT show debug entries when explicit filter is set
      expect(screen.queryByText('Debug level message that should be visible in verbose mode')).not.toBeInTheDocument();

      // Should NOT show auto-debug indicator
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();
      expect(screen.getByText('Level: warn+')).toBeInTheDocument();

      // Should only show warn and error entries
      expect(screen.getByText('Warning message about potential issue')).toBeInTheDocument();
      expect(screen.getByText('Error entry that is normally collapsed')).toBeInTheDocument();
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });

    it('should not apply auto-debug behavior in other display modes', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="normal"
          // No filterLevel prop provided
        />
      );

      // Should NOT show debug entries in normal mode
      expect(screen.queryByText('Debug level message that should be visible in verbose mode')).not.toBeInTheDocument();

      // Should default to info level in normal mode
      expect(screen.getByText('Level: info+')).toBeInTheDocument();
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();

      // Should show 3 entries (info, warn, error - no debug)
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: In verbose mode - log entries auto-expand', () => {
    it('should always show metadata for all entries in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
        />
      );

      // All entries with data should show their metadata
      expect(screen.getByText(/debugInfo: detailed debug information/)).toBeInTheDocument();
      expect(screen.getByText(/taskId: task-12345/)).toBeInTheDocument();
      expect(screen.getByText(/warning: Deprecated API usage detected/)).toBeInTheDocument();
      expect(screen.getByText(/errorCode: ERR_001/)).toBeInTheDocument();
    });

    it('should show metadata even for collapsed entries in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
        />
      );

      // Collapsed entry should still show its metadata in verbose mode
      expect(screen.getByText(/errorCode: ERR_001/)).toBeInTheDocument();
      expect(screen.getByText(/errorMessage: Connection timeout occurred/)).toBeInTheDocument();
      expect(screen.getByText(/stackTrace:/)).toBeInTheDocument();
      expect(screen.getByText(/requestId: req-789/)).toBeInTheDocument();
    });

    it('should not auto-expand metadata in normal mode for collapsed entries', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="normal"
        />
      );

      // Collapsed entry should NOT show metadata in normal mode
      // Note: The collapsed entry has collapsed: true, so its data should be hidden in normal mode
      expect(screen.queryByText(/errorCode: ERR_001/)).not.toBeInTheDocument();
      expect(screen.queryByText(/stackTrace:/)).not.toBeInTheDocument();
    });

    it('should show nested metadata structures in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
        />
      );

      // Should show nested object properties
      expect(screen.getByText(/metadata:/)).toBeInTheDocument();
      expect(screen.getByText(/priority.*high/)).toBeInTheDocument();
      expect(screen.getByText(/estimatedDuration.*2 hours/)).toBeInTheDocument();
      expect(screen.getByText(/context:/)).toBeInTheDocument();
      expect(screen.getByText(/userId.*user-456/)).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: In verbose mode - full timestamps with milliseconds shown', () => {
    it('should display timestamps with milliseconds in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // All timestamps should include milliseconds
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
      expect(screen.getByText('[10:01:15.456]')).toBeInTheDocument();
      expect(screen.getByText('[10:02:30.789]')).toBeInTheDocument();
      expect(screen.getByText('[10:03:45.999]')).toBeInTheDocument();
    });

    it('should not show milliseconds in normal mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="normal"
          showTimestamps={true}
        />
      );

      // Timestamps should NOT include milliseconds in normal mode
      expect(screen.queryByText('[10:01:15.456]')).not.toBeInTheDocument();
      expect(screen.getByText('[10:01:15]')).toBeInTheDocument();

      expect(screen.queryByText('[10:02:30.789]')).not.toBeInTheDocument();
      expect(screen.getByText('[10:02:30]')).toBeInTheDocument();
    });

    it('should format milliseconds with proper padding in verbose mode', () => {
      const millisecondsTestEntries: LogEntry[] = [
        {
          id: 'ms-test-1',
          timestamp: new Date('2024-01-01T10:00:00.001Z'), // 1ms
          level: 'info',
          message: 'Test 1ms',
        },
        {
          id: 'ms-test-2',
          timestamp: new Date('2024-01-01T10:00:00.010Z'), // 10ms
          level: 'info',
          message: 'Test 10ms',
        },
        {
          id: 'ms-test-3',
          timestamp: new Date('2024-01-01T10:00:00.100Z'), // 100ms
          level: 'info',
          message: 'Test 100ms',
        },
      ];

      render(
        <ActivityLog
          entries={millisecondsTestEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should properly pad milliseconds to 3 digits
      expect(screen.getByText('[10:00:00.001]')).toBeInTheDocument();
      expect(screen.getByText('[10:00:00.010]')).toBeInTheDocument();
      expect(screen.getByText('[10:00:00.100]')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: In verbose mode - metadata not truncated', () => {
    it('should not truncate messages in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          width={80} // Narrow width to test truncation
        />
      );

      // Long messages should be displayed in full
      expect(screen.getByText('Information message with moderately long content to test message display behavior')).toBeInTheDocument();
      expect(screen.getByText('Warning message about potential issue that needs attention')).toBeInTheDocument();
    });

    it('should not truncate metadata in verbose mode', () => {
      const longMetadataEntry: LogEntry[] = [
        {
          id: 'long-metadata',
          timestamp: new Date('2024-01-01T10:00:00.000Z'),
          level: 'info',
          message: 'Entry with very long metadata',
          data: {
            veryLongDescription: 'This is an extremely long description that would normally be truncated in other display modes but should be shown in full in verbose mode without any ellipsis or cutting off',
            detailedInfo: {
              step1: 'First step with detailed explanation of what happens',
              step2: 'Second step with even more detailed explanation of the process',
              step3: 'Third step that continues with extensive information',
            },
          },
        },
      ];

      render(
        <ActivityLog
          entries={longMetadataEntry}
          displayMode="verbose"
        />
      );

      // Long metadata should be displayed without truncation
      expect(screen.getByText(/veryLongDescription: This is an extremely long description.*without any ellipsis/)).toBeInTheDocument();
      expect(screen.getByText(/step1: First step with detailed explanation/)).toBeInTheDocument();
      expect(screen.getByText(/step2: Second step with even more detailed/)).toBeInTheDocument();
      expect(screen.getByText(/step3: Third step that continues with extensive/)).toBeInTheDocument();
    });

    it('should truncate messages in normal mode for comparison', () => {
      const longMessageEntry: LogEntry[] = [
        {
          id: 'long-message',
          timestamp: new Date(),
          level: 'info',
          message: 'This is a very long message that should be truncated in normal mode but displayed fully in verbose mode without any cutting off or ellipsis characters at the end',
        },
      ];

      render(
        <ActivityLog
          entries={longMessageEntry}
          displayMode="normal"
          width={80} // Force truncation in normal mode
        />
      );

      // Message should be truncated in normal mode
      expect(screen.queryByText('This is a very long message that should be truncated in normal mode but displayed fully in verbose mode without any cutting off or ellipsis characters at the end')).not.toBeInTheDocument();
      expect(screen.getByText(/This is a very long message/)).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria: Complete Integration Test', () => {
    it('should satisfy all acceptance criteria simultaneously in verbose mode', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          showTimestamps={true}
          showAgents={true}
          // No explicit filterLevel to test auto-debug
        />
      );

      // 1. ActivityLog accepts displayMode prop
      expect(screen.getByText('Activity Log')).toBeInTheDocument();

      // 2. In verbose mode: filterLevel defaults to 'debug'
      expect(screen.getByText('Debug level message that should be visible in verbose mode')).toBeInTheDocument();
      expect(screen.getByText('Level: debug+ (auto: verbose)')).toBeInTheDocument();

      // 3. In verbose mode: log entries auto-expand
      expect(screen.getByText(/debugInfo: detailed debug information/)).toBeInTheDocument();
      expect(screen.getByText(/errorCode: ERR_001/)).toBeInTheDocument(); // Even for collapsed entry

      // 4. In verbose mode: full timestamps with milliseconds shown
      expect(screen.getByText('[10:00:00.123]')).toBeInTheDocument();
      expect(screen.getByText('[10:01:15.456]')).toBeInTheDocument();
      expect(screen.getByText('[10:02:30.789]')).toBeInTheDocument();
      expect(screen.getByText('[10:03:45.999]')).toBeInTheDocument();

      // 5. In verbose mode: metadata not truncated
      expect(screen.getByText('Information message with moderately long content to test message display behavior')).toBeInTheDocument();
      expect(screen.getByText(/stackTrace: at processRequest/)).toBeInTheDocument();

      // Should show all entries (4 total)
      expect(screen.getByText('4 entries')).toBeInTheDocument();

      // Should show agent information
      expect(screen.getByText('[developer]')).toBeInTheDocument();
      expect(screen.getByText('[orchestrator]')).toBeInTheDocument();
      expect(screen.getByText('[reviewer]')).toBeInTheDocument();
      expect(screen.getByText('[tester]')).toBeInTheDocument();
    });

    it('should work correctly with explicit filterLevel while maintaining other verbose features', () => {
      render(
        <ActivityLog
          entries={testEntries}
          displayMode="verbose"
          filterLevel="info" // Explicit filter
          showTimestamps={true}
        />
      );

      // Should respect explicit filter (no debug entries)
      expect(screen.queryByText('Debug level message that should be visible in verbose mode')).not.toBeInTheDocument();
      expect(screen.queryByText('(auto: verbose)')).not.toBeInTheDocument();
      expect(screen.getByText('Level: info+')).toBeInTheDocument();

      // But should still maintain other verbose features
      expect(screen.getByText('[10:01:15.456]')).toBeInTheDocument(); // Milliseconds
      expect(screen.getByText('Information message with moderately long content to test message display behavior')).toBeInTheDocument(); // No truncation
      expect(screen.getByText(/taskId: task-12345/)).toBeInTheDocument(); // Expanded metadata

      // Should show 3 entries (info, warn, error - no debug)
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });
  });
});