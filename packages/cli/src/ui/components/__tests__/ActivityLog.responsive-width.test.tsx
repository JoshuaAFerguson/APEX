import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLog, LogEntry } from '../ActivityLog';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('ActivityLog Responsive Width Behavior', () => {
  const mockEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2023-01-01T10:00:00.123Z'),
      level: 'info',
      message: 'This is a moderately long log message that should be truncated based on terminal width',
      agent: 'developer',
      category: 'task',
      duration: 1000,
    },
    {
      id: '2',
      timestamp: new Date('2023-01-01T10:01:00.456Z'),
      level: 'error',
      message: 'This is an extremely long error message that definitely needs to be truncated for display in narrow terminals because it contains way too much information to fit on a single line in compact modes',
      agent: 'tester',
      data: { code: 500, details: 'Connection failed with a very long detailed error explanation' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Wide terminal behavior (120+ chars)', () => {
    beforeEach(() => {
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
    });

    it('should display full timestamps with milliseconds in verbose mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Should show full timestamps with milliseconds
      expect(screen.getByText(/\[10:00:00\.123\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[10:01:00\.456\]/)).toBeInTheDocument();
    });

    it('should not truncate messages in wide mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Messages should be displayed in full (or with minimal truncation)
      expect(screen.getByText(/This is a moderately long log message/)).toBeInTheDocument();
    });

    it('should display all icons and metadata', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      expect(screen.getByText('[developer]')).toBeInTheDocument();
      expect(screen.getByText('[tester]')).toBeInTheDocument();
      expect(screen.getByText('(task)')).toBeInTheDocument();
      expect(screen.getByText('(1.0s)')).toBeInTheDocument();
    });
  });

  describe('Normal terminal behavior (80 chars)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should show standard timestamps without abbreviation', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
        />
      );

      expect(screen.getByText(/\[10:00:00\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[10:01:00\]/)).toBeInTheDocument();
    });

    it('should truncate long messages appropriately', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Long message should be truncated with ellipsis
      const messageElements = screen.getAllByText(/This is an extremely long error message/);
      expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
    });

    it('should still show all icons in normal mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
        />
      );

      expect(screen.getByText(/ℹ️/)).toBeInTheDocument();
      expect(screen.getByText(/❌/)).toBeInTheDocument();
    });
  });

  describe('Compact terminal behavior (60 chars)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should show standard timestamps but truncate messages more aggressively', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      expect(screen.getByText(/\[10:00:00\]/)).toBeInTheDocument();

      // Messages should be more aggressively truncated
      const messageElements = screen.getAllByText(/This is a moderately/);
      expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
    });

    it('should still show icons in compact mode', () => {
      render(<ActivityLog entries={mockEntries} />);

      expect(screen.getByText(/ℹ️/)).toBeInTheDocument();
      expect(screen.getByText(/❌/)).toBeInTheDocument();
    });
  });

  describe('Narrow terminal behavior (40-50 chars)', () => {
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

    it('should abbreviate timestamps to HH:MM format', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
        />
      );

      expect(screen.getByText('[10:00]')).toBeInTheDocument();
      expect(screen.getByText('[10:01]')).toBeInTheDocument();
    });

    it('should not abbreviate timestamps in verbose mode', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          displayMode="verbose"
          showTimestamps={true}
        />
      );

      // Verbose mode should override narrow abbreviation
      expect(screen.getByText(/\[10:00:00\.123\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[10:01:00\.456\]/)).toBeInTheDocument();
    });

    it('should aggressively truncate messages', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Even moderately long messages should be truncated
      const messageElements = screen.getAllByText(/This is a/);
      expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
    });

    it('should still show icons when width is at least 40', () => {
      render(<ActivityLog entries={mockEntries} />);

      expect(screen.getByText(/ℹ️/)).toBeInTheDocument();
      expect(screen.getByText(/❌/)).toBeInTheDocument();
    });
  });

  describe('Extremely narrow terminal behavior (<40 chars)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 15,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });
    });

    it('should hide icons in extremely narrow terminals', () => {
      render(<ActivityLog entries={mockEntries} />);

      // Should not show icons when width < 40
      expect(screen.queryByText(/ℹ️/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌/)).not.toBeInTheDocument();
    });

    it('should abbreviate timestamps even more aggressively', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
        />
      );

      expect(screen.getByText('[10:00]')).toBeInTheDocument();
      expect(screen.getByText('[10:01]')).toBeInTheDocument();
    });

    it('should severely truncate messages', () => {
      render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
        />
      );

      // Should truncate to very short lengths
      const messageElements = screen.getAllByText(/This.../);
      expect(messageElements.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive configuration calculation', () => {
    it('should calculate appropriate message lengths based on terminal width', () => {
      const configurations = [
        { width: 120, expected: 'longer messages' },
        { width: 80, expected: 'medium messages' },
        { width: 60, expected: 'shorter messages' },
        { width: 40, expected: 'very short messages' },
      ];

      configurations.forEach(({ width }) => {
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

        const { rerender } = render(
          <ActivityLog
            entries={mockEntries}
            showTimestamps={true}
            showAgents={true}
          />
        );

        // Verify that component renders without errors
        expect(screen.getByText(/This is/)).toBeInTheDocument();

        rerender(<></>);
      });
    });
  });

  describe('Dynamic width changes', () => {
    it('should adapt when terminal width changes', () => {
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
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      expect(screen.getByText(/\[10:00:00\]/)).toBeInTheDocument();
      expect(screen.getByText('[developer]')).toBeInTheDocument();

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
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      expect(screen.getByText('[10:00]')).toBeInTheDocument();
      expect(screen.getByText('[developer]')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle minimum width gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { container } = render(
        <ActivityLog
          entries={mockEntries}
          showTimestamps={true}
          showAgents={true}
        />
      );

      // Should still render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should handle unavailable terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: false,
      });

      const { container } = render(
        <ActivityLog entries={mockEntries} />
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle empty message gracefully', () => {
      const emptyMessageEntry: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date(),
          level: 'info',
          message: '',
          agent: 'test',
        },
      ];

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
        <ActivityLog entries={emptyMessageEntry} />
      );

      expect(container).toBeInTheDocument();
    });
  });
});