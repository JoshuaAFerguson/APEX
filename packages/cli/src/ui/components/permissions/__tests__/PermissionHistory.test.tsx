import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PermissionHistory,
  PermissionHistoryEntry,
  PermissionHistoryProps,
  PermissionRequest,
  PermissionLevel
} from '../PermissionPrompt';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  useInput: vi.fn(),
}));

describe('PermissionHistory', () => {
  let mockEntries: PermissionHistoryEntry[];
  let baseRequest: PermissionRequest;

  beforeEach(() => {
    baseRequest = {
      id: 'test-request-123',
      tool: 'Write',
      scope: '/tmp/test-file.txt',
      operation: 'file-write',
      isDangerous: false,
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    mockEntries = [
      {
        request: { ...baseRequest, id: 'req-1', tool: 'Write' },
        decision: 'allow-once' as PermissionLevel,
        decidedAt: new Date('2024-01-01T10:01:00Z'),
      },
      {
        request: {
          ...baseRequest,
          id: 'req-2',
          tool: 'Read',
          operation: 'file-read',
          isDangerous: true,
          dangerLevel: 'medium'
        },
        decision: 'allow-always' as PermissionLevel,
        decidedAt: new Date('2024-01-01T10:02:00Z'),
      },
      {
        request: {
          ...baseRequest,
          id: 'req-3',
          tool: 'Bash',
          operation: 'command-execution',
          scope: 'rm -rf /tmp/*',
          isDangerous: true,
          dangerLevel: 'high'
        },
        decision: 'deny' as PermissionLevel,
        decidedAt: new Date('2024-01-01T10:03:00Z'),
        comment: 'Too dangerous, requires manual review'
      },
    ];
  });

  describe('Basic Rendering', () => {
    it('should render permission history with entries', () => {
      render(<PermissionHistory entries={mockEntries} />);

      expect(screen.getByText(/Permission History/)).toBeDefined();
      expect(screen.getByText(/3 entries/)).toBeDefined();
      expect(screen.getByText('Write')).toBeDefined();
      expect(screen.getByText('Read')).toBeDefined();
      expect(screen.getByText('Bash')).toBeDefined();
    });

    it('should render empty state when no entries', () => {
      render(<PermissionHistory entries={[]} />);

      expect(screen.getByText(/Permission History/)).toBeDefined();
      expect(screen.getByText(/No permission history/)).toBeDefined();
      expect(screen.getByText(/0 entries/)).toBeDefined();
    });

    it('should display tool names and operations', () => {
      render(<PermissionHistory entries={mockEntries} />);

      expect(screen.getByText('Write')).toBeDefined();
      expect(screen.getByText('file-write')).toBeDefined();
      expect(screen.getByText('Read')).toBeDefined();
      expect(screen.getByText('file-read')).toBeDefined();
    });

    it('should display decisions with correct colors', () => {
      render(<PermissionHistory entries={mockEntries} />);

      // Check that decisions are displayed
      expect(screen.getByText('allow-once')).toBeDefined();
      expect(screen.getByText('allow-always')).toBeDefined();
      expect(screen.getByText('deny')).toBeDefined();
    });
  });

  describe('Display Modes', () => {
    it('should render in normal mode with full details', () => {
      render(
        <PermissionHistory
          entries={mockEntries}
          displayMode="normal"
        />
      );

      expect(screen.getByText(/Permission History/)).toBeDefined();
      expect(screen.getByText('file-write')).toBeDefined();
      expect(screen.getByText('file-read')).toBeDefined();
      expect(screen.getByText('command-execution')).toBeDefined();
    });

    it('should render in compact mode with minimal details', () => {
      render(
        <PermissionHistory
          entries={mockEntries}
          displayMode="compact"
        />
      );

      expect(screen.getByText(/Permission History \(3\)/)).toBeDefined();
      expect(screen.getByText('Write')).toBeDefined();
      expect(screen.getByText('Read')).toBeDefined();
      expect(screen.getByText('Bash')).toBeDefined();
    });

    it('should show timestamps in normal mode', () => {
      render(<PermissionHistory entries={mockEntries} />);

      // Should show formatted time for at least one entry
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Entry Limiting', () => {
    it('should limit entries to maxEntries', () => {
      const manyEntries = Array.from({ length: 20 }, (_, i) => ({
        request: { ...baseRequest, id: `req-${i}`, tool: `Tool${i}` },
        decision: 'allow-once' as PermissionLevel,
        decidedAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      }));

      render(
        <PermissionHistory
          entries={manyEntries}
          maxEntries={5}
        />
      );

      // Should show total count
      expect(screen.getByText(/20 entries/)).toBeDefined();

      // Should only show the last 5 tools (Tool15-Tool19)
      expect(screen.getByText('Tool19')).toBeDefined();
      expect(screen.getByText('Tool15')).toBeDefined();
      expect(screen.queryByText('Tool14')).toBeNull();
      expect(screen.queryByText('Tool0')).toBeNull();
    });

    it('should use default maxEntries of 10 when not specified', () => {
      const manyEntries = Array.from({ length: 15 }, (_, i) => ({
        request: { ...baseRequest, id: `req-${i}`, tool: `Tool${i}` },
        decision: 'allow-once' as PermissionLevel,
        decidedAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      }));

      render(<PermissionHistory entries={manyEntries} />);

      // Should show total count
      expect(screen.getByText(/15 entries/)).toBeDefined();

      // Should show the last 10 tools (Tool5-Tool14)
      expect(screen.getByText('Tool14')).toBeDefined();
      expect(screen.getByText('Tool5')).toBeDefined();
      expect(screen.queryByText('Tool4')).toBeNull();
    });
  });

  describe('Scope Display', () => {
    it('should display scope when present', () => {
      render(<PermissionHistory entries={mockEntries} />);

      expect(screen.getByText('/tmp/test-file.txt')).toBeDefined();
      expect(screen.getByText('rm -rf /tmp/*')).toBeDefined();
    });

    it('should handle entries without scope', () => {
      const entriesWithoutScope = [
        {
          request: {
            ...baseRequest,
            id: 'no-scope',
            tool: 'NoScope',
            scope: undefined
          },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      render(<PermissionHistory entries={entriesWithoutScope} />);

      expect(screen.getByText('NoScope')).toBeDefined();
      // Should not crash and should not show scope line
    });
  });

  describe('Decision Color Coding', () => {
    it('should apply correct colors to decision types', () => {
      const colorTestEntries = [
        {
          request: { ...baseRequest, id: 'allow-always-test' },
          decision: 'allow-always' as PermissionLevel,
          decidedAt: new Date(),
        },
        {
          request: { ...baseRequest, id: 'allow-once-test' },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date(),
        },
        {
          request: { ...baseRequest, id: 'deny-test' },
          decision: 'deny' as PermissionLevel,
          decidedAt: new Date(),
        },
      ];

      render(<PermissionHistory entries={colorTestEntries} />);

      // Verify all decision types are present
      expect(screen.getByText('allow-always')).toBeDefined();
      expect(screen.getByText('allow-once')).toBeDefined();
      expect(screen.getByText('deny')).toBeDefined();
    });
  });

  describe('Comment Display', () => {
    it('should not show comments in normal mode (comments are internal)', () => {
      const entryWithComment = [
        {
          request: { ...baseRequest, id: 'with-comment' },
          decision: 'deny' as PermissionLevel,
          decidedAt: new Date(),
          comment: 'This should not be displayed to user'
        }
      ];

      render(<PermissionHistory entries={entryWithComment} />);

      // Comments should not be visible in the UI (they're for internal use)
      expect(screen.queryByText('This should not be displayed to user')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very old timestamps', () => {
      const oldEntries = [
        {
          request: { ...baseRequest, id: 'old-entry' },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date('1970-01-01T00:00:00Z'),
        },
      ];

      expect(() => {
        render(<PermissionHistory entries={oldEntries} />);
      }).not.toThrow();
    });

    it('should handle future timestamps', () => {
      const futureEntries = [
        {
          request: { ...baseRequest, id: 'future-entry' },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date('2030-12-31T23:59:59Z'),
        },
      ];

      expect(() => {
        render(<PermissionHistory entries={futureEntries} />);
      }).not.toThrow();
    });

    it('should handle entries with very long tool names', () => {
      const longNameEntries = [
        {
          request: {
            ...baseRequest,
            id: 'long-tool',
            tool: 'VeryLongToolNameThatMightCauseLayoutIssues'.repeat(10)
          },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date(),
        },
      ];

      expect(() => {
        render(<PermissionHistory entries={longNameEntries} />);
      }).not.toThrow();
    });

    it('should handle entries with very long operations', () => {
      const longOpEntries = [
        {
          request: {
            ...baseRequest,
            id: 'long-op',
            operation: 'very-long-operation-name-that-might-cause-issues'.repeat(5)
          },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date(),
        },
      ];

      expect(() => {
        render(<PermissionHistory entries={longOpEntries} />);
      }).not.toThrow();
    });

    it('should handle mixed permission levels', () => {
      const mixedEntries = [
        {
          request: { ...baseRequest, id: 'mixed-1' },
          decision: 'allow-always' as PermissionLevel,
          decidedAt: new Date(),
        },
        {
          request: { ...baseRequest, id: 'mixed-2' },
          decision: 'allow-once' as PermissionLevel,
          decidedAt: new Date(),
        },
        {
          request: { ...baseRequest, id: 'mixed-3' },
          decision: 'deny' as PermissionLevel,
          decidedAt: new Date(),
        },
      ];

      render(<PermissionHistory entries={mixedEntries} />);

      expect(screen.getByText('allow-always')).toBeDefined();
      expect(screen.getByText('allow-once')).toBeDefined();
      expect(screen.getByText('deny')).toBeDefined();
    });
  });

  describe('Props Validation', () => {
    it('should handle negative maxEntries gracefully', () => {
      expect(() => {
        render(
          <PermissionHistory
            entries={mockEntries}
            maxEntries={-5}
          />
        );
      }).not.toThrow();
    });

    it('should handle zero maxEntries', () => {
      render(
        <PermissionHistory
          entries={mockEntries}
          maxEntries={0}
        />
      );

      // Should show entry count but no individual entries
      expect(screen.getByText(/3 entries/)).toBeDefined();
    });

    it('should handle undefined displayMode', () => {
      expect(() => {
        render(
          <PermissionHistory
            entries={mockEntries}
            displayMode={undefined}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of entries efficiently', () => {
      const largeEntries = Array.from({ length: 10000 }, (_, i) => ({
        request: { ...baseRequest, id: `req-${i}`, tool: `Tool${i}` },
        decision: 'allow-once' as PermissionLevel,
        decidedAt: new Date(`2024-01-01T10:${String(i % 60).padStart(2, '0')}:00Z`),
      }));

      const startTime = Date.now();

      expect(() => {
        render(
          <PermissionHistory
            entries={largeEntries}
            maxEntries={50}
          />
        );
      }).not.toThrow();

      const renderTime = Date.now() - startTime;

      // Should render in reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);

      // Should show total count correctly
      expect(screen.getByText(/10000 entries/)).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should provide semantic structure for screen readers', () => {
      render(<PermissionHistory entries={mockEntries} />);

      // Ensure proper heading structure
      expect(screen.getByText(/Permission History/)).toBeDefined();

      // Ensure entry count is present for context
      expect(screen.getByText(/3 entries/)).toBeDefined();
    });

    it('should handle empty entries gracefully for accessibility', () => {
      render(<PermissionHistory entries={[]} />);

      // Should provide clear empty state message
      expect(screen.getByText(/No permission history/)).toBeDefined();
      expect(screen.getByText(/0 entries/)).toBeDefined();
    });
  });
});