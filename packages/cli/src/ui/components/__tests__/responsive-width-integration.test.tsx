import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLog, LogEntry } from '../ActivityLog';
import { ErrorDisplay, ErrorSummary } from '../ErrorDisplay';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('Responsive Width Integration Tests', () => {
  const testLogEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2023-01-01T10:00:00.123Z'),
      level: 'info',
      message: 'Starting task with detailed configuration parameters and initialization steps',
      agent: 'developer',
      category: 'initialization',
      duration: 1500,
    },
    {
      id: '2',
      timestamp: new Date('2023-01-01T10:01:30.456Z'),
      level: 'error',
      message: 'Failed to connect to database with timeout error - connection string validation failed due to invalid credentials',
      agent: 'orchestrator',
      data: {
        errorCode: 'DB_CONNECTION_FAILED',
        details: 'Connection timeout after 30 seconds with detailed stack trace information',
        attemptNumber: 3,
      },
    },
    {
      id: '3',
      timestamp: new Date('2023-01-01T10:02:15.789Z'),
      level: 'warn',
      message: 'Performance degradation detected in component rendering - consider optimization strategies for better user experience',
      agent: 'tester',
      category: 'performance',
    },
  ];

  const testErrors = [
    {
      id: 'err1',
      message: 'Authentication failed due to invalid credentials provided in the configuration file - please verify API key',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      severity: 'error' as const,
      resolved: false,
    },
    {
      id: 'err2',
      message: 'Network connectivity issues detected - intermittent timeouts affecting data synchronization processes',
      timestamp: new Date('2023-01-01T10:01:00Z'),
      severity: 'warning' as const,
      resolved: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Consistent behavior across breakpoints', () => {
    const breakpoints = [
      {
        name: 'wide',
        width: 120,
        height: 40,
        breakpoint: 'wide' as const,
        expectations: {
          timestampFormat: /\d{2}:\d{2}:\d{2}\.\d{3}/, // Full with milliseconds in verbose
          messageLength: 'long', // Minimal truncation
          showIcons: true,
          abbreviateTimestamp: false,
        },
      },
      {
        name: 'normal',
        width: 80,
        height: 24,
        breakpoint: 'normal' as const,
        expectations: {
          timestampFormat: /\d{2}:\d{2}:\d{2}/, // Standard format
          messageLength: 'medium', // Some truncation
          showIcons: true,
          abbreviateTimestamp: false,
        },
      },
      {
        name: 'compact',
        width: 60,
        height: 20,
        breakpoint: 'compact' as const,
        expectations: {
          timestampFormat: /\d{2}:\d{2}:\d{2}/, // Standard format
          messageLength: 'short', // More truncation
          showIcons: true,
          abbreviateTimestamp: false,
        },
      },
      {
        name: 'narrow',
        width: 45,
        height: 20,
        breakpoint: 'narrow' as const,
        expectations: {
          timestampFormat: /\d{2}:\d{2}/, // Abbreviated format
          messageLength: 'very-short', // Heavy truncation
          showIcons: true,
          abbreviateTimestamp: true,
        },
      },
      {
        name: 'extremely-narrow',
        width: 35,
        height: 15,
        breakpoint: 'narrow' as const,
        expectations: {
          timestampFormat: /\d{2}:\d{2}/, // Abbreviated format
          messageLength: 'minimal', // Severe truncation
          showIcons: false,
          abbreviateTimestamp: true,
        },
      },
    ];

    breakpoints.forEach(({ name, width, height, breakpoint, expectations }) => {
      describe(`${name} breakpoint (${width}x${height})`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height,
            breakpoint,
            isNarrow: breakpoint === 'narrow',
            isCompact: breakpoint === 'compact',
            isNormal: breakpoint === 'normal',
            isWide: breakpoint === 'wide',
            isAvailable: true,
          });
        });

        it('should consistently format timestamps across ActivityLog and ErrorSummary', () => {
          render(
            <>
              <ActivityLog
                entries={testLogEntries}
                showTimestamps={true}
                displayMode="verbose"
              />
              <ErrorSummary
                errors={testErrors}
                showTimestamps={true}
              />
            </>
          );

          if (expectations.abbreviateTimestamp) {
            // Both components should use abbreviated timestamps
            expect(screen.getAllByText(/\[10:\d{2}\]/).length).toBeGreaterThan(0);
          } else {
            // Both components should use standard timestamps
            if (name === 'wide') {
              // Verbose mode in wide terminals shows milliseconds
              expect(screen.getAllByText(/\[10:\d{2}:\d{2}\.\d{3}\]/).length).toBeGreaterThan(0);
            } else {
              expect(screen.getAllByText(/\[10:\d{2}:\d{2}\]/).length).toBeGreaterThan(0);
            }
          }
        });

        it('should consistently truncate long messages across components', () => {
          render(
            <>
              <ActivityLog entries={testLogEntries} />
              <ErrorSummary errors={testErrors} />
              <ErrorDisplay error="This is a very long error message that should be truncated consistently across all error display components based on the current terminal width" />
            </>
          );

          const longMessageRegex = /Starting task with detailed configuration|Authentication failed due to invalid credentials|This is a very long error message/;
          const messageElements = screen.getAllByText(longMessageRegex);

          if (expectations.messageLength === 'minimal' || expectations.messageLength === 'very-short') {
            // Should be heavily truncated
            expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
          }

          // All components should render without errors
          expect(messageElements.length).toBeGreaterThan(0);
        });

        it('should handle icon display consistently', () => {
          render(
            <>
              <ActivityLog entries={testLogEntries} />
              <ErrorDisplay error="Test error" />
            </>
          );

          const iconRegex = /[ℹ️❌⚠️✅🔍]/;

          if (expectations.showIcons) {
            expect(screen.getAllByText(iconRegex).length).toBeGreaterThan(0);
          } else {
            // In extremely narrow terminals, icons should be hidden
            expect(screen.queryAllByText(iconRegex).length).toBe(0);
          }
        });

        it('should maintain component functionality regardless of width', () => {
          render(
            <>
              <ActivityLog
                entries={testLogEntries}
                showTimestamps={true}
                showAgents={true}
              />
              <ErrorSummary
                errors={testErrors}
                showTimestamps={true}
              />
            </>
          );

          // Essential content should always be visible
          expect(screen.getByText(/Starting task/)).toBeInTheDocument();
          expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
          expect(screen.getByText('[developer]')).toBeInTheDocument();
          expect(screen.getByText('[orchestrator]')).toBeInTheDocument();
        });
      });
    });
  });

  describe('Real-time responsive adaptation', () => {
    it('should adapt both components when terminal width changes', () => {
      // Start with wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      const { rerender } = render(
        <>
          <ActivityLog
            entries={testLogEntries}
            showTimestamps={true}
            displayMode="verbose"
          />
          <ErrorSummary
            errors={testErrors}
            showTimestamps={true}
          />
        </>
      );

      // Should show full timestamps with milliseconds
      expect(screen.getByText(/\[10:00:00\.123\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[10:00:00\]/)).toBeInTheDocument();

      // Change to narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      rerender(
        <>
          <ActivityLog
            entries={testLogEntries}
            showTimestamps={true}
            displayMode="normal" // Changed from verbose to test abbreviation
          />
          <ErrorSummary
            errors={testErrors}
            showTimestamps={true}
          />
        </>
      );

      // Should now show abbreviated timestamps
      expect(screen.getByText('[10:00]')).toBeInTheDocument();
      expect(screen.getByText('[10:01]')).toBeInTheDocument();
    });

    it('should maintain data integrity during width transitions', () => {
      const widthSequence = [120, 80, 45, 35, 60, 100];

      widthSequence.forEach((width) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: width >= 80 ? 'normal' : width >= 60 ? 'compact' : 'narrow',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 80,
          isNormal: width >= 80 && width < 120,
          isWide: width >= 120,
          isAvailable: true,
        });

        const { container } = render(
          <>
            <ActivityLog entries={testLogEntries} />
            <ErrorSummary errors={testErrors} />
            <ErrorDisplay error="Test error message" />
          </>
        );

        // Should always render without errors
        expect(container).toBeInTheDocument();

        // Essential content should always be present
        expect(screen.getByText(/Starting task/)).toBeInTheDocument();
        expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
        expect(screen.getByText('Test error message')).toBeInTheDocument();

        // Clean up for next iteration
        render(<></>);
      });
    });
  });

  describe('Mixed explicit and responsive widths', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should respect explicit widths while defaulting to responsive for others', () => {
      render(
        <>
          <ActivityLog entries={testLogEntries} /> {/* Uses responsive width */}
          <ErrorSummary errors={testErrors} width={80} showTimestamps={true} /> {/* Uses explicit width */}
          <ErrorDisplay error="Test error" width={100} /> {/* Uses explicit width */}
        </>
      );

      // ActivityLog should use narrow responsive behavior (abbreviated timestamps)
      // ErrorSummary and ErrorDisplay should use their explicit widths (full timestamps)
      expect(screen.getByText('[10:00]')).toBeInTheDocument(); // Abbreviated from ActivityLog
      expect(screen.getByText(/\[10:00:00\]/)).toBeInTheDocument(); // Full from ErrorSummary
    });
  });

  describe('Edge case scenarios', () => {
    it('should handle components with no content gracefully across all widths', () => {
      const widths = [35, 45, 60, 80, 120];

      widths.forEach((width) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 20,
          breakpoint: width >= 80 ? 'normal' : width >= 60 ? 'compact' : 'narrow',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 80,
          isNormal: width >= 80 && width < 120,
          isWide: width >= 120,
          isAvailable: true,
        });

        const { container } = render(
          <>
            <ActivityLog entries={[]} />
            <ErrorSummary errors={[]} />
          </>
        );

        expect(container).toBeInTheDocument();
        render(<></>); // Clean up
      });
    });

    it('should handle extremely long single words without breaking', () => {
      const extremelyLongWord = 'a'.repeat(200);
      const longWordEntry: LogEntry = {
        id: '1',
        timestamp: new Date(),
        level: 'error',
        message: extremelyLongWord,
        agent: 'test',
      };

      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { container } = render(
        <>
          <ActivityLog entries={[longWordEntry]} />
          <ErrorDisplay error={extremelyLongWord} />
        </>
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle unavailable terminal dimensions gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false, // Dimensions not available
      });

      const { container } = render(
        <>
          <ActivityLog entries={testLogEntries} />
          <ErrorSummary errors={testErrors} />
          <ErrorDisplay error="Test error" />
        </>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Performance considerations', () => {
    it('should handle rapid re-renders efficiently', () => {
      const renderCount = 10;

      for (let i = 0; i < renderCount; i++) {
        const width = 40 + (i * 10); // Vary width from 40 to 130

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: width >= 80 ? 'normal' : 'narrow',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 80,
          isNormal: width >= 80 && width < 120,
          isWide: width >= 120,
          isAvailable: true,
        });

        const { container } = render(
          <>
            <ActivityLog entries={testLogEntries.slice(0, 2)} />
            <ErrorDisplay error="Performance test error" />
          </>
        );

        expect(container).toBeInTheDocument();

        // Clean up for next iteration
        render(<></>);
      }
    });
  });
});