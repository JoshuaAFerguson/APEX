import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityLog, LogStream, CompactLog, LogEntry } from '../ActivityLog';

// Mock useInput hook
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

describe('ActivityLog', () => {
  const mockEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      level: 'info',
      message: 'Task started',
      agent: 'developer',
      category: 'task',
      duration: 1000,
    },
    {
      id: '2',
      timestamp: new Date('2023-01-01T10:01:00Z'),
      level: 'error',
      message: 'An error occurred',
      agent: 'tester',
      data: { code: 500, details: 'Connection failed' },
    },
    {
      id: '3',
      timestamp: new Date('2023-01-01T10:02:00Z'),
      level: 'success',
      message: 'Task completed successfully',
      agent: 'developer',
      duration: 2500,
    },
    {
      id: '4',
      timestamp: new Date('2023-01-01T10:03:00Z'),
      level: 'warn',
      message: 'Warning about potential issue',
      category: 'validation',
    },
    {
      id: '5',
      timestamp: new Date('2023-01-01T10:04:00Z'),
      level: 'debug',
      message: 'Debug information',
      data: { step: 1, value: 'test' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render activity log with title and entries', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        title="Test Activity Log"
      />
    );

    expect(screen.getByText('Test Activity Log')).toBeInTheDocument();
    expect(screen.getByText('Task started')).toBeInTheDocument();
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
    expect(screen.getByText('Task completed successfully')).toBeInTheDocument();
  });

  it('should show timestamps when enabled', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        showTimestamps={true}
      />
    );

    expect(screen.getByText(/\[10:00:00\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[10:01:00\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[10:02:00\]/)).toBeInTheDocument();
  });

  it('should hide timestamps when disabled', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        showTimestamps={false}
      />
    );

    expect(screen.queryByText(/\[\d{2}:\d{2}:\d{2}\]/)).not.toBeInTheDocument();
  });

  it('should show agent names when enabled', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        showAgents={true}
      />
    );

    expect(screen.getByText('[developer]')).toBeInTheDocument();
    expect(screen.getByText('[tester]')).toBeInTheDocument();
  });

  it('should hide agent names when disabled', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        showAgents={false}
      />
    );

    expect(screen.queryByText('[developer]')).not.toBeInTheDocument();
    expect(screen.queryByText('[tester]')).not.toBeInTheDocument();
  });

  it('should display level icons correctly', () => {
    render(
      <ActivityLog entries={mockEntries} />
    );

    // Icons should be present for different levels
    expect(screen.getByText(/ℹ️|❌|✅|⚠️|🔍/)).toBeInTheDocument();
  });

  it('should show categories when present', () => {
    render(
      <ActivityLog entries={mockEntries} />
    );

    expect(screen.getByText('(task)')).toBeInTheDocument();
    expect(screen.getByText('(validation)')).toBeInTheDocument();
  });

  it('should format durations correctly', () => {
    render(
      <ActivityLog entries={mockEntries} />
    );

    expect(screen.getByText('(1.0s)')).toBeInTheDocument();
    expect(screen.getByText('(2.5s)')).toBeInTheDocument();
  });

  it('should filter entries by level', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        filterLevel="warn"
      />
    );

    // Should show warn, error, and success (but not info or debug)
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
    expect(screen.getByText('Task completed successfully')).toBeInTheDocument();
    expect(screen.getByText('Warning about potential issue')).toBeInTheDocument();
    expect(screen.queryByText('Task started')).not.toBeInTheDocument(); // info level
    expect(screen.queryByText('Debug information')).not.toBeInTheDocument(); // debug level
  });

  it('should limit entries to maxEntries', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        maxEntries={3}
      />
    );

    // Should show only the last 3 entries
    expect(screen.getByText('Task completed successfully')).toBeInTheDocument();
    expect(screen.getByText('Warning about potential issue')).toBeInTheDocument();
    expect(screen.getByText('Debug information')).toBeInTheDocument();
    expect(screen.queryByText('Task started')).not.toBeInTheDocument();
    expect(screen.queryByText('An error occurred')).not.toBeInTheDocument();
  });

  it('should show entry count', () => {
    render(
      <ActivityLog entries={mockEntries} />
    );

    expect(screen.getByText('5 entries')).toBeInTheDocument();
  });

  it('should show empty state when no entries', () => {
    render(
      <ActivityLog entries={[]} />
    );

    expect(screen.getByText('No log entries to display')).toBeInTheDocument();
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });

  it('should show collapse instructions when allow collapse is enabled', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        allowCollapse={true}
      />
    );

    expect(screen.getByText("Press 'c' to collapse")).toBeInTheDocument();
    expect(screen.getByText('↑↓: Navigate | Enter: Toggle details | c: Collapse panel')).toBeInTheDocument();
  });

  it('should not show collapse instructions when disabled', () => {
    render(
      <ActivityLog
        entries={mockEntries}
        allowCollapse={false}
      />
    );

    expect(screen.queryByText("Press 'c' to collapse")).not.toBeInTheDocument();
    expect(screen.queryByText('↑↓: Navigate | Enter: Toggle details | c: Collapse panel')).not.toBeInTheDocument();
  });

  it('should show data when entry has additional data', () => {
    render(
      <ActivityLog entries={mockEntries} />
    );

    // Entry with data should show the data
    expect(screen.getByText('code: 500')).toBeInTheDocument();
    expect(screen.getByText('details: Connection failed')).toBeInTheDocument();
    expect(screen.getByText('step: 1')).toBeInTheDocument();
    expect(screen.getByText('value: test')).toBeInTheDocument();
  });
});

describe('LogStream', () => {
  const streamEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      level: 'info',
      message: 'Stream entry 1',
      agent: 'stream-agent',
    },
    {
      id: '2',
      timestamp: new Date('2023-01-01T10:00:05Z'),
      level: 'success',
      message: 'Stream entry 2',
    },
  ];

  it('should render log stream with header', () => {
    render(<LogStream entries={streamEntries} />);

    expect(screen.getByText('Live Log Stream')).toBeInTheDocument();
    expect(screen.getByText('Stream entry 1')).toBeInTheDocument();
    expect(screen.getByText('Stream entry 2')).toBeInTheDocument();
  });

  it('should show stream controls', () => {
    render(<LogStream entries={streamEntries} />);

    expect(screen.getByText('Space: pause | s: scroll')).toBeInTheDocument();
  });

  it('should show entry count in footer', () => {
    render(<LogStream entries={streamEntries} />);

    expect(screen.getByText(/Showing \d+ of \d+ entries/)).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('should show static mode when not real-time', () => {
    render(<LogStream entries={streamEntries} realTime={false} />);

    expect(screen.getByText('STATIC')).toBeInTheDocument();
  });

  it('should show agent names in stream', () => {
    render(<LogStream entries={streamEntries} />);

    expect(screen.getByText('[stream-agent]')).toBeInTheDocument();
  });

  it('should call onNewEntry when new entries are added', () => {
    const mockOnNewEntry = vi.fn();
    const { rerender } = render(
      <LogStream
        entries={streamEntries}
        onNewEntry={mockOnNewEntry}
      />
    );

    const newEntries = [
      ...streamEntries,
      {
        id: '3',
        timestamp: new Date(),
        level: 'info' as const,
        message: 'New entry',
      },
    ];

    rerender(
      <LogStream
        entries={newEntries}
        onNewEntry={mockOnNewEntry}
      />
    );

    // onNewEntry should be called with the latest entry
    expect(mockOnNewEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '3',
        message: 'New entry',
      })
    );
  });
});

describe('CompactLog', () => {
  const compactEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      level: 'info',
      message: 'Compact entry 1',
    },
    {
      id: '2',
      timestamp: new Date('2023-01-01T10:01:00Z'),
      level: 'error',
      message: 'Compact entry 2 with a very long message that should be truncated when displayed',
    },
    {
      id: '3',
      timestamp: new Date('2023-01-01T10:02:00Z'),
      level: 'success',
      message: 'Compact entry 3',
    },
  ];

  it('should render compact log entries', () => {
    render(<CompactLog entries={compactEntries} />);

    expect(screen.getByText('Compact entry 1')).toBeInTheDocument();
    expect(screen.getByText('Compact entry 3')).toBeInTheDocument();
  });

  it('should truncate long messages', () => {
    render(<CompactLog entries={compactEntries} />);

    expect(screen.getByText(/Compact entry 2 with a very long message that should be.../)).toBeInTheDocument();
  });

  it('should limit to maxLines', () => {
    render(<CompactLog entries={compactEntries} maxLines={2} />);

    expect(screen.getByText('Compact entry 2')).toBeInTheDocument();
    expect(screen.getByText('Compact entry 3')).toBeInTheDocument();
    expect(screen.queryByText('Compact entry 1')).not.toBeInTheDocument();
    expect(screen.getByText('... and 1 more entries')).toBeInTheDocument();
  });

  it('should show icons when enabled', () => {
    render(<CompactLog entries={compactEntries} showIcons={true} />);

    // Should contain level icons
    expect(screen.getByText(/ℹ️|❌|✅/)).toBeInTheDocument();
  });

  it('should hide icons when disabled', () => {
    render(<CompactLog entries={compactEntries} showIcons={false} />);

    // Should not contain level icons in the text content
    const entries = screen.getAllByText(/Compact entry/);
    entries.forEach(entry => {
      expect(entry.textContent).not.toMatch(/[ℹ️❌✅⚠️🔍]/);
    });
  });

  it('should show timestamps when enabled', () => {
    render(<CompactLog entries={compactEntries} showTimestamps={true} />);

    expect(screen.getByText('10:00:00')).toBeInTheDocument();
    expect(screen.getByText('10:01:00')).toBeInTheDocument();
    expect(screen.getByText('10:02:00')).toBeInTheDocument();
  });

  it('should hide timestamps when disabled', () => {
    render(<CompactLog entries={compactEntries} showTimestamps={false} />);

    expect(screen.queryByText(/\d{2}:\d{2}:\d{2}/)).not.toBeInTheDocument();
  });

  it('should handle empty entries array', () => {
    const { container } = render(<CompactLog entries={[]} />);

    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('should not show overflow message when entries fit in maxLines', () => {
    render(<CompactLog entries={compactEntries} maxLines={5} />);

    expect(screen.queryByText(/... and \d+ more entries/)).not.toBeInTheDocument();
  });
});

describe('Log Utilities', () => {
  it('should format timestamps correctly', () => {
    const entry: LogEntry = {
      id: '1',
      timestamp: new Date('2023-01-01T15:30:45Z'),
      level: 'info',
      message: 'Test message',
    };

    render(<ActivityLog entries={[entry]} showTimestamps={true} />);

    // Should show 24-hour format
    expect(screen.getByText(/\[15:30:45\]/)).toBeInTheDocument();
  });

  it('should format durations correctly', () => {
    const entries: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(),
        level: 'info',
        message: 'Short task',
        duration: 500, // 500ms
      },
      {
        id: '2',
        timestamp: new Date(),
        level: 'info',
        message: 'Medium task',
        duration: 1500, // 1.5s
      },
      {
        id: '3',
        timestamp: new Date(),
        level: 'info',
        message: 'Long task',
        duration: 65000, // 1m 5s
      },
    ];

    render(<ActivityLog entries={entries} />);

    expect(screen.getByText('(500ms)')).toBeInTheDocument();
    expect(screen.getByText('(1.5s)')).toBeInTheDocument();
    expect(screen.getByText('(1m 5s)')).toBeInTheDocument();
  });

  it('should handle complex data objects', () => {
    const entry: LogEntry = {
      id: '1',
      timestamp: new Date(),
      level: 'info',
      message: 'Complex data',
      data: {
        nested: { value: 42 },
        array: [1, 2, 3],
        string: 'test',
      },
    };

    render(<ActivityLog entries={[entry]} />);

    expect(screen.getByText(/nested:/)).toBeInTheDocument();
    expect(screen.getByText(/array:/)).toBeInTheDocument();
    expect(screen.getByText(/string: test/)).toBeInTheDocument();
  });
});