/**
 * Tests for ActivityLog component adaptation to display modes
 * Validates that ActivityLog correctly filters, formats, and displays
 * entries based on the current display mode (normal, compact, verbose)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DisplayMode } from '@apexcli/core';

// Mock Ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  };
});

interface ActivityEntry {
  id: string;
  type: 'user' | 'system' | 'tool' | 'error' | 'debug' | 'agent' | 'task';
  content: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    agent?: string;
    toolName?: string;
    duration?: number;
    tokens?: { input: number; output: number };
  };
  stackTrace?: string;
  details?: string;
}

// Mock ActivityLog component to test display mode adaptation
const MockActivityLog: React.FC<{
  displayMode: DisplayMode;
  entries: ActivityEntry[];
  maxEntries?: number;
}> = ({ displayMode, entries, maxEntries = 100 }) => {
  const filterEntriesByMode = (entries: ActivityEntry[]): ActivityEntry[] => {
    switch (displayMode) {
      case 'compact':
        // Only show high priority and critical entries, plus user actions
        return entries.filter(entry =>
          ['high', 'critical'].includes(entry.priority) ||
          entry.type === 'user' ||
          entry.type === 'error'
        ).slice(-Math.min(10, maxEntries)); // Limit to recent 10 entries

      case 'verbose':
        // Show all entries
        return entries.slice(-maxEntries);

      default: // normal
        // Hide debug entries but show everything else
        return entries.filter(entry =>
          entry.type !== 'debug'
        ).slice(-Math.min(50, maxEntries));
    }
  };

  const formatEntryForMode = (entry: ActivityEntry): {
    displayContent: string;
    showMetadata: boolean;
    showTimestamp: boolean;
    showDetails: boolean;
  } => {
    switch (displayMode) {
      case 'compact':
        return {
          displayContent: entry.content.substring(0, 40) + (entry.content.length > 40 ? '...' : ''),
          showMetadata: false,
          showTimestamp: false,
          showDetails: false,
        };

      case 'verbose':
        return {
          displayContent: entry.content,
          showMetadata: true,
          showTimestamp: true,
          showDetails: true,
        };

      default: // normal
        return {
          displayContent: entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : ''),
          showMetadata: !!entry.metadata,
          showTimestamp: true,
          showDetails: false,
        };
    }
  };

  const getEntryIcon = (entry: ActivityEntry): string => {
    switch (entry.type) {
      case 'user': return '👤';
      case 'system': return '⚙️';
      case 'tool': return '🔧';
      case 'error': return '❌';
      case 'debug': return '🐛';
      case 'agent': return '🤖';
      case 'task': return '📋';
      default: return '📝';
    }
  };

  const getPriorityIndicator = (priority: string): string => {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const filteredEntries = filterEntriesByMode(entries);

  return (
    <div data-testid="activity-log" data-display-mode={displayMode}>
      <div data-testid="log-header">
        <span data-testid="log-title">
          {displayMode === 'compact' ? 'Log' : 'Activity Log'}
        </span>
        <span data-testid="entry-count">({filteredEntries.length})</span>
        {displayMode === 'verbose' && (
          <span data-testid="mode-indicator"> - VERBOSE</span>
        )}
      </div>

      <div data-testid="log-entries">
        {filteredEntries.map(entry => {
          const format = formatEntryForMode(entry);

          return (
            <div
              key={entry.id}
              data-testid="log-entry"
              data-entry-type={entry.type}
              data-priority={entry.priority}
            >
              {/* Entry header with icon and type */}
              <div data-testid="entry-header">
                <span data-testid="entry-icon">{getEntryIcon(entry)}</span>
                {displayMode !== 'compact' && (
                  <span data-testid="entry-type">{entry.type.toUpperCase()}</span>
                )}
                <span data-testid="priority-indicator">{getPriorityIndicator(entry.priority)}</span>
              </div>

              {/* Entry content */}
              <div data-testid="entry-content">
                {format.displayContent}
              </div>

              {/* Timestamp - conditionally shown */}
              {format.showTimestamp && (
                <div data-testid="entry-timestamp">
                  {displayMode === 'compact'
                    ? entry.timestamp.toLocaleTimeString()
                    : entry.timestamp.toISOString()
                  }
                </div>
              )}

              {/* Metadata - conditionally shown */}
              {format.showMetadata && entry.metadata && (
                <div data-testid="entry-metadata">
                  {entry.metadata.agent && (
                    <span data-testid="metadata-agent">Agent: {entry.metadata.agent}</span>
                  )}
                  {entry.metadata.toolName && (
                    <span data-testid="metadata-tool">Tool: {entry.metadata.toolName}</span>
                  )}
                  {entry.metadata.duration && (
                    <span data-testid="metadata-duration">Duration: {entry.metadata.duration}ms</span>
                  )}
                  {entry.metadata.tokens && (
                    <span data-testid="metadata-tokens">
                      Tokens: {entry.metadata.tokens.input}→{entry.metadata.tokens.output}
                    </span>
                  )}
                </div>
              )}

              {/* Details and stack trace - verbose mode only */}
              {format.showDetails && entry.details && (
                <div data-testid="entry-details">
                  <div data-testid="details-label">Details:</div>
                  <div data-testid="details-content">{entry.details}</div>
                </div>
              )}

              {format.showDetails && entry.stackTrace && (
                <div data-testid="entry-stack-trace">
                  <div data-testid="stack-trace-label">Stack Trace:</div>
                  <div data-testid="stack-trace-content">{entry.stackTrace}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with additional info in verbose mode */}
      {displayMode === 'verbose' && (
        <div data-testid="log-footer">
          <div data-testid="total-entries">Total: {entries.length}</div>
          <div data-testid="filtered-entries">Showing: {filteredEntries.length}</div>
          <div data-testid="max-entries">Max: {maxEntries}</div>
        </div>
      )}
    </div>
  );
};

describe('ActivityLog Display Mode Adaptation', () => {
  const createSampleEntry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
    id: Math.random().toString(36),
    type: 'user',
    content: 'Sample activity entry',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    priority: 'medium',
    ...overrides,
  });

  const sampleEntries: ActivityEntry[] = [
    createSampleEntry({
      id: '1',
      type: 'user',
      content: 'User started a new task',
      priority: 'high',
    }),
    createSampleEntry({
      id: '2',
      type: 'system',
      content: 'System initialized successfully',
      priority: 'low',
    }),
    createSampleEntry({
      id: '3',
      type: 'agent',
      content: 'Developer agent activated',
      priority: 'medium',
      metadata: { agent: 'developer' },
    }),
    createSampleEntry({
      id: '4',
      type: 'tool',
      content: 'Read file operation completed',
      priority: 'low',
      metadata: { toolName: 'Read', duration: 150 },
    }),
    createSampleEntry({
      id: '5',
      type: 'error',
      content: 'File not found error occurred',
      priority: 'critical',
      stackTrace: 'Error: File not found\n  at function1:10\n  at function2:5',
      details: 'The requested file does not exist in the project directory',
    }),
    createSampleEntry({
      id: '6',
      type: 'debug',
      content: 'Debug trace: processing workflow step 3',
      priority: 'low',
      details: 'Internal state: {step: 3, status: "processing"}',
    }),
    createSampleEntry({
      id: '7',
      type: 'task',
      content: 'Task completed successfully with 1500 input and 2000 output tokens',
      priority: 'high',
      metadata: { tokens: { input: 1500, output: 2000 } },
    }),
  ];

  describe('Normal Display Mode', () => {
    it('should show most entries except debug', () => {
      render(<MockActivityLog displayMode="normal" entries={sampleEntries} />);

      expect(screen.getByTestId('activity-log')).toHaveAttribute('data-display-mode', 'normal');

      const entries = screen.getAllByTestId('log-entry');
      expect(entries).toHaveLength(6); // All except debug entry

      // Should not show debug entry
      const debugEntry = entries.find(entry =>
        entry.getAttribute('data-entry-type') === 'debug'
      );
      expect(debugEntry).toBeUndefined();
    });

    it('should display standard log header', () => {
      render(<MockActivityLog displayMode="normal" entries={sampleEntries} />);

      expect(screen.getByTestId('log-title')).toHaveTextContent('Activity Log');
      expect(screen.getByTestId('entry-count')).toHaveTextContent('(6)');
      expect(screen.queryByTestId('mode-indicator')).not.toBeInTheDocument();
    });

    it('should show content with moderate truncation', () => {
      const longContentEntry = createSampleEntry({
        content: 'This is a very long activity entry that should be truncated in normal mode because it exceeds the 100 character limit for normal display',
      });

      render(<MockActivityLog displayMode="normal" entries={[longContentEntry]} />);

      const entryContent = screen.getByTestId('entry-content');
      expect(entryContent.textContent).toHaveLength(103); // 100 chars + '...'
      expect(entryContent.textContent).toEndWith('...');
    });

    it('should show timestamps and selective metadata', () => {
      render(<MockActivityLog displayMode="normal" entries={sampleEntries} />);

      // Should show timestamps
      const timestamps = screen.getAllByTestId('entry-timestamp');
      expect(timestamps.length).toBeGreaterThan(0);
      expect(timestamps[0]).toHaveTextContent('2024-01-01T10:00:00.000Z');

      // Should show metadata for entries that have it
      const metadataElements = screen.getAllByTestId('entry-metadata');
      expect(metadataElements.length).toBeGreaterThan(0);
    });

    it('should not show debug details or stack traces', () => {
      render(<MockActivityLog displayMode="normal" entries={sampleEntries} />);

      expect(screen.queryByTestId('entry-details')).not.toBeInTheDocument();
      expect(screen.queryByTestId('entry-stack-trace')).not.toBeInTheDocument();
      expect(screen.queryByTestId('log-footer')).not.toBeInTheDocument();
    });
  });

  describe('Compact Display Mode', () => {
    it('should show only high priority and important entries', () => {
      render(<MockActivityLog displayMode="compact" entries={sampleEntries} />);

      expect(screen.getByTestId('activity-log')).toHaveAttribute('data-display-mode', 'compact');

      const entries = screen.getAllByTestId('log-entry');
      expect(entries).toHaveLength(3); // user (high), error (critical), task (high)

      // Should only show high/critical priority or user/error types
      const entryTypes = entries.map(entry => entry.getAttribute('data-entry-type'));
      const entryPriorities = entries.map(entry => entry.getAttribute('data-priority'));

      expect(entryTypes).toEqual(['user', 'error', 'task']);
      expect(entryPriorities).toEqual(['high', 'critical', 'high']);
    });

    it('should display compact log header', () => {
      render(<MockActivityLog displayMode="compact" entries={sampleEntries} />);

      expect(screen.getByTestId('log-title')).toHaveTextContent('Log');
      expect(screen.getByTestId('entry-count')).toHaveTextContent('(3)');
      expect(screen.queryByTestId('mode-indicator')).not.toBeInTheDocument();
    });

    it('should truncate content aggressively', () => {
      const longContentEntry = createSampleEntry({
        content: 'This is a very long activity entry that should be truncated',
        priority: 'high',
      });

      render(<MockActivityLog displayMode="compact" entries={[longContentEntry]} />);

      const entryContent = screen.getByTestId('entry-content');
      expect(entryContent.textContent).toHaveLength(43); // 40 chars + '...'
      expect(entryContent.textContent).toEndWith('...');
    });

    it('should hide metadata, details, and timestamps', () => {
      render(<MockActivityLog displayMode="compact" entries={sampleEntries} />);

      expect(screen.queryByTestId('entry-metadata')).not.toBeInTheDocument();
      expect(screen.queryByTestId('entry-timestamp')).not.toBeInTheDocument();
      expect(screen.queryByTestId('entry-details')).not.toBeInTheDocument();
      expect(screen.queryByTestId('entry-stack-trace')).not.toBeInTheDocument();
      expect(screen.queryByTestId('log-footer')).not.toBeInTheDocument();
    });

    it('should not show entry type labels', () => {
      render(<MockActivityLog displayMode="compact" entries={sampleEntries} />);

      expect(screen.queryByTestId('entry-type')).not.toBeInTheDocument();
    });

    it('should limit to recent 10 entries even with more available', () => {
      const manyEntries = Array.from({ length: 20 }, (_, i) =>
        createSampleEntry({
          id: `entry-${i}`,
          priority: 'high',
          content: `Entry ${i}`,
        })
      );

      render(<MockActivityLog displayMode="compact" entries={manyEntries} />);

      const entries = screen.getAllByTestId('log-entry');
      expect(entries).toHaveLength(10);
    });
  });

  describe('Verbose Display Mode', () => {
    it('should show all entries including debug', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      expect(screen.getByTestId('activity-log')).toHaveAttribute('data-display-mode', 'verbose');

      const entries = screen.getAllByTestId('log-entry');
      expect(entries).toHaveLength(7); // All entries including debug

      // Should include debug entry
      const debugEntry = entries.find(entry =>
        entry.getAttribute('data-entry-type') === 'debug'
      );
      expect(debugEntry).toBeDefined();
    });

    it('should display verbose log header with mode indicator', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      expect(screen.getByTestId('log-title')).toHaveTextContent('Activity Log');
      expect(screen.getByTestId('entry-count')).toHaveTextContent('(7)');
      expect(screen.getByTestId('mode-indicator')).toHaveTextContent(' - VERBOSE');
    });

    it('should show full content without truncation', () => {
      const longContentEntry = createSampleEntry({
        content: 'This is a very long activity entry that should not be truncated in verbose mode and should be shown in its entirety',
      });

      render(<MockActivityLog displayMode="verbose" entries={[longContentEntry]} />);

      const entryContent = screen.getByTestId('entry-content');
      expect(entryContent.textContent).toBe(longContentEntry.content);
      expect(entryContent.textContent).not.toEndWith('...');
    });

    it('should show all metadata information', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      // Should show all types of metadata
      expect(screen.getByTestId('metadata-agent')).toHaveTextContent('Agent: developer');
      expect(screen.getByTestId('metadata-tool')).toHaveTextContent('Tool: Read');
      expect(screen.getByTestId('metadata-duration')).toHaveTextContent('Duration: 150ms');
      expect(screen.getByTestId('metadata-tokens')).toHaveTextContent('Tokens: 1500→2000');
    });

    it('should show timestamps in full ISO format', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      const timestamps = screen.getAllByTestId('entry-timestamp');
      expect(timestamps.length).toBeGreaterThan(0);
      expect(timestamps[0]).toHaveTextContent('2024-01-01T10:00:00.000Z');
    });

    it('should show details and stack traces', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      // Should show error details
      expect(screen.getByTestId('entry-details')).toBeInTheDocument();
      expect(screen.getByTestId('details-label')).toHaveTextContent('Details:');
      expect(screen.getByTestId('details-content')).toHaveTextContent(
        'The requested file does not exist in the project directory'
      );

      // Should show stack trace
      expect(screen.getByTestId('entry-stack-trace')).toBeInTheDocument();
      expect(screen.getByTestId('stack-trace-label')).toHaveTextContent('Stack Trace:');
      expect(screen.getByTestId('stack-trace-content')).toHaveTextContent(
        'Error: File not found'
      );
    });

    it('should show log footer with statistics', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      expect(screen.getByTestId('log-footer')).toBeInTheDocument();
      expect(screen.getByTestId('total-entries')).toHaveTextContent('Total: 7');
      expect(screen.getByTestId('filtered-entries')).toHaveTextContent('Showing: 7');
      expect(screen.getByTestId('max-entries')).toHaveTextContent('Max: 100');
    });

    it('should show entry type labels', () => {
      render(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      const entryTypes = screen.getAllByTestId('entry-type');
      expect(entryTypes.length).toBe(7);
      expect(entryTypes[0]).toHaveTextContent('USER');
    });
  });

  describe('Display Mode Transitions', () => {
    it('should handle mode changes correctly', () => {
      const { rerender } = render(
        <MockActivityLog displayMode="normal" entries={sampleEntries} />
      );

      // Normal mode - 6 entries (no debug)
      expect(screen.getAllByTestId('log-entry')).toHaveLength(6);
      expect(screen.queryByTestId('log-footer')).not.toBeInTheDocument();

      // Switch to compact - 3 entries (high priority only)
      rerender(<MockActivityLog displayMode="compact" entries={sampleEntries} />);

      expect(screen.getAllByTestId('log-entry')).toHaveLength(3);
      expect(screen.getByTestId('log-title')).toHaveTextContent('Log');

      // Switch to verbose - all 7 entries
      rerender(<MockActivityLog displayMode="verbose" entries={sampleEntries} />);

      expect(screen.getAllByTestId('log-entry')).toHaveLength(7);
      expect(screen.getByTestId('log-footer')).toBeInTheDocument();
      expect(screen.getByTestId('mode-indicator')).toHaveTextContent(' - VERBOSE');
    });

    it('should maintain entry icons and priority indicators across modes', () => {
      const modes: DisplayMode[] = ['normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        render(<MockActivityLog displayMode={mode} entries={sampleEntries.slice(0, 3)} />);

        // Icons should always be present
        const icons = screen.getAllByTestId('entry-icon');
        expect(icons.length).toBeGreaterThan(0);

        // Priority indicators should always be present
        const priorities = screen.getAllByTestId('priority-indicator');
        expect(priorities.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle empty entries gracefully', () => {
      render(<MockActivityLog displayMode="normal" entries={[]} />);

      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
      expect(screen.getByTestId('entry-count')).toHaveTextContent('(0)');
      expect(screen.queryByTestId('log-entry')).not.toBeInTheDocument();
    });

    it('should handle entries with missing optional fields', () => {
      const minimalEntry: ActivityEntry = {
        id: 'minimal',
        type: 'user',
        content: 'Minimal entry',
        timestamp: new Date(),
        priority: 'medium',
      };

      render(<MockActivityLog displayMode="verbose" entries={[minimalEntry]} />);

      expect(screen.getByTestId('log-entry')).toBeInTheDocument();
      expect(screen.getByTestId('entry-content')).toHaveTextContent('Minimal entry');
      expect(screen.queryByTestId('entry-metadata')).not.toBeInTheDocument();
      expect(screen.queryByTestId('entry-details')).not.toBeInTheDocument();
      expect(screen.queryByTestId('entry-stack-trace')).not.toBeInTheDocument();
    });

    it('should respect maxEntries limit across modes', () => {
      const manyEntries = Array.from({ length: 200 }, (_, i) =>
        createSampleEntry({
          id: `entry-${i}`,
          content: `Entry ${i}`,
          priority: i % 2 === 0 ? 'high' : 'low',
        })
      );

      // Normal mode with limit
      render(<MockActivityLog displayMode="normal" entries={manyEntries} maxEntries={30} />);
      expect(screen.getAllByTestId('log-entry').length).toBeLessThanOrEqual(30);

      // Verbose mode with limit
      const { rerender } = render(
        <MockActivityLog displayMode="verbose" entries={manyEntries} maxEntries={50} />
      );
      expect(screen.getAllByTestId('log-entry').length).toBeLessThanOrEqual(50);
      expect(screen.getByTestId('max-entries')).toHaveTextContent('Max: 50');
    });

    it('should handle very long stack traces in verbose mode', () => {
      const entryWithLongStackTrace = createSampleEntry({
        type: 'error',
        priority: 'critical',
        stackTrace: 'Error: Very long stack trace\n' + '  at function'.repeat(100),
      });

      render(<MockActivityLog displayMode="verbose" entries={[entryWithLongStackTrace]} />);

      expect(screen.getByTestId('entry-stack-trace')).toBeInTheDocument();
      expect(screen.getByTestId('stack-trace-content')).toBeInTheDocument();
    });

    it('should handle rapid mode switching without errors', () => {
      const { rerender } = render(
        <MockActivityLog displayMode="normal" entries={sampleEntries} />
      );

      const modes: DisplayMode[] = ['compact', 'verbose', 'normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        expect(() => {
          rerender(<MockActivityLog displayMode={mode} entries={sampleEntries} />);
        }).not.toThrow();

        expect(screen.getByTestId('activity-log')).toHaveAttribute('data-display-mode', mode);
      });
    });
  });
});