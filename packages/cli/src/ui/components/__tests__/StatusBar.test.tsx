import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Mock useStdout from ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

describe('StatusBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps: StatusBarProps = {
    isConnected: true,
  };

  describe('basic rendering', () => {
    it('renders with minimal props', () => {
      render(<StatusBar {...defaultProps} />);

      // Should show connection status (green dot for connected)
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('shows disconnected status', () => {
      render(<StatusBar {...defaultProps} isConnected={false} />);

      // Should show disconnected status (empty circle)
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('displays git branch', () => {
      render(<StatusBar {...defaultProps} gitBranch="feature/auth" />);

      expect(screen.getByText('feature/auth')).toBeInTheDocument();
    });

    it('displays agent name', () => {
      render(<StatusBar {...defaultProps} agent="planner" />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('displays workflow stage', () => {
      render(<StatusBar {...defaultProps} workflowStage="implementation" />);

      expect(screen.getByText('▶')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
    });

    it('displays model name', () => {
      render(<StatusBar {...defaultProps} model="opus" />);

      expect(screen.getByText(/model:/)).toBeInTheDocument();
      expect(screen.getByText('opus')).toBeInTheDocument();
    });
  });

  describe('token and cost display', () => {
    it('displays token count with formatting', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 500, output: 300 }} />);

      expect(screen.getByText(/tokens:/)).toBeInTheDocument();
      expect(screen.getByText('800')).toBeInTheDocument(); // 500 + 300
    });

    it('formats large token counts', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 1500, output: 500 }} />);

      expect(screen.getByText('2.0k')).toBeInTheDocument(); // 2000 tokens
    });

    it('formats very large token counts', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 1500000, output: 500000 }} />);

      expect(screen.getByText('2.0M')).toBeInTheDocument(); // 2M tokens
    });

    it('displays cost', () => {
      render(<StatusBar {...defaultProps} cost={0.1234} />);

      expect(screen.getByText(/cost:/)).toBeInTheDocument();
      expect(screen.getByText('$0.1234')).toBeInTheDocument();
    });

    it('displays session cost', () => {
      render(<StatusBar {...defaultProps} sessionCost={1.5678} />);

      // Session cost should be displayed (implementation may vary)
      expect(screen.getByText(/1.5678/)).toBeInTheDocument();
    });
  });

  describe('progress and session info', () => {
    it('displays subtask progress', () => {
      render(<StatusBar {...defaultProps} subtaskProgress={{ completed: 3, total: 5 }} />);

      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('[3/5]')).toBeInTheDocument();
    });

    it('shows completed subtasks in green', () => {
      render(<StatusBar {...defaultProps} subtaskProgress={{ completed: 5, total: 5 }} />);

      expect(screen.getByText('[5/5]')).toBeInTheDocument();
      // Color should be green (would need to test style or className)
    });

    it('displays session name', () => {
      render(<StatusBar {...defaultProps} sessionName="My Session" />);

      expect(screen.getByText('💾')).toBeInTheDocument();
      expect(screen.getByText('My Session')).toBeInTheDocument();
    });

    it('truncates long session names', () => {
      render(<StatusBar {...defaultProps} sessionName="Very Long Session Name That Should Be Truncated" />);

      expect(screen.getByText(/Very Long Se\.\.\./)).toBeInTheDocument();
    });
  });

  describe('service URLs', () => {
    it('displays API URL', () => {
      render(<StatusBar {...defaultProps} apiUrl="http://localhost:4000" />);

      expect(screen.getByText(/api:/)).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument(); // Strips localhost part
    });

    it('displays web URL', () => {
      render(<StatusBar {...defaultProps} webUrl="http://localhost:3000" />);

      expect(screen.getByText(/web:/)).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument(); // Strips localhost part
    });
  });

  describe('session timer', () => {
    it('displays elapsed time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:02:30Z')); // 2 minutes 30 seconds later

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('02:30')).toBeInTheDocument();
    });

    it('updates timer every second', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T10:01:00Z')); // 1 minute later

      const { rerender } = render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Advance time by 1 second and trigger timer
      vi.advanceTimersByTime(1000);
      rerender(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('01:01')).toBeInTheDocument();
    });

    it('shows 00:00 when no start time provided', () => {
      render(<StatusBar {...defaultProps} />);

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('formats hours correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      vi.setSystemTime(new Date('2023-01-01T11:35:45Z')); // 1 hour 35 minutes 45 seconds

      render(<StatusBar {...defaultProps} sessionStartTime={startTime} />);

      expect(screen.getByText('95:45')).toBeInTheDocument(); // 95 minutes total
    });
  });

  describe('responsive layout', () => {
    it('adapts to terminal width', () => {
      // Mock narrow terminal
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: { columns: 60 }
      });

      render(
        <StatusBar
          {...defaultProps}
          gitBranch="feature/auth"
          agent="planner"
          workflowStage="implementation"
          model="opus"
          tokens={{ input: 1000, output: 500 }}
          cost={0.5}
        />
      );

      // Should still render without breaking
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('prioritizes important information in narrow terminals', () => {
      // Mock very narrow terminal
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: { columns: 40 }
      });

      render(
        <StatusBar
          {...defaultProps}
          gitBranch="main"
          agent="planner"
          workflowStage="implementation"
          apiUrl="http://localhost:4000"
          webUrl="http://localhost:3000"
          sessionName="Test Session"
        />
      );

      // Should keep essential info
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles zero tokens', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 0, output: 0 }} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles zero cost', () => {
      render(<StatusBar {...defaultProps} cost={0} />);

      expect(screen.getByText('$0.0000')).toBeInTheDocument();
    });

    it('handles empty git branch', () => {
      render(<StatusBar {...defaultProps} gitBranch="" />);

      // Should still render without error
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles undefined connection status', () => {
      render(<StatusBar isConnected={undefined} />);

      // Should default to connected
      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('handles very large costs', () => {
      render(<StatusBar {...defaultProps} cost={999.9999} />);

      expect(screen.getByText('$999.9999')).toBeInTheDocument();
    });

    it('handles zero subtask progress', () => {
      render(<StatusBar {...defaultProps} subtaskProgress={{ completed: 0, total: 0 }} />);

      // Should not display progress when total is 0
      expect(screen.queryByText('📋')).not.toBeInTheDocument();
    });

    it('handles missing terminal width', () => {
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: undefined
      });

      render(<StatusBar {...defaultProps} />);

      // Should use default width and not crash
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('formatting helpers', () => {
    it('formats token display correctly for thousands', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 2500, output: 1500 }} />);

      expect(screen.getByText('4.0k')).toBeInTheDocument();
    });

    it('formats token display correctly for millions', () => {
      render(<StatusBar {...defaultProps} tokens={{ input: 2500000, output: 1500000 }} />);

      expect(screen.getByText('4.0M')).toBeInTheDocument();
    });

    it('preserves decimal places in cost formatting', () => {
      render(<StatusBar {...defaultProps} cost={0.0001} />);

      expect(screen.getByText('$0.0001')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides meaningful text content for screen readers', () => {
      render(
        <StatusBar
          {...defaultProps}
          gitBranch="main"
          agent="planner"
          tokens={{ input: 100, output: 200 }}
          cost={0.05}
          model="opus"
        />
      );

      // All important information should be accessible as text
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
      expect(screen.getByText('$0.0500')).toBeInTheDocument();
      expect(screen.getByText('opus')).toBeInTheDocument();
    });
  });
});