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

describe('StatusBar - Display Modes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/display-modes',
    tokens: { input: 1000, output: 500 },
    cost: 0.0234,
    sessionCost: 1.5678,
    model: 'claude-3-sonnet',
    agent: 'developer',
    workflowStage: 'implementation',
    apiUrl: 'http://localhost:4000',
    webUrl: 'http://localhost:3000',
    sessionStartTime: new Date(Date.now() - 120000), // 2 minutes ago
    subtaskProgress: { completed: 3, total: 5 },
    sessionName: 'Test Session',
  };

  describe('Normal Mode (Default)', () => {
    it('should show all available information in normal mode', () => {
      render(<StatusBar {...baseProps} displayMode="normal" />);

      // Should show all the detailed information
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument(); // Git branch
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Agent icon
      expect(screen.getByText('developer')).toBeInTheDocument(); // Agent name
      expect(screen.getByText('▶')).toBeInTheDocument(); // Workflow stage icon
      expect(screen.getByText('implementation')).toBeInTheDocument(); // Workflow stage
      expect(screen.getByText('📋')).toBeInTheDocument(); // Progress icon
      expect(screen.getByText('[3/5]')).toBeInTheDocument(); // Subtask progress
      expect(screen.getByText('💾')).toBeInTheDocument(); // Session icon
      expect(screen.getByText('Test Session')).toBeInTheDocument(); // Session name
      expect(screen.getByText(/api:/)).toBeInTheDocument(); // API label
      expect(screen.getByText('4000')).toBeInTheDocument(); // API port
      expect(screen.getByText(/web:/)).toBeInTheDocument(); // Web label
      expect(screen.getByText('3000')).toBeInTheDocument(); // Web port
      expect(screen.getByText(/02:00/)).toBeInTheDocument(); // Timer
      expect(screen.getByText(/tokens:/)).toBeInTheDocument(); // Tokens label
      expect(screen.getByText('1.5k')).toBeInTheDocument(); // Token count
      expect(screen.getByText(/cost:/)).toBeInTheDocument(); // Cost label
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument(); // Cost value
      expect(screen.getByText(/model:/)).toBeInTheDocument(); // Model label
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument(); // Model name
    });

    it('should show complete layout in normal mode with wide terminal', () => {
      // Mock wide terminal
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: { columns: 200 }
      });

      render(<StatusBar {...baseProps} displayMode="normal" />);

      // All elements should be visible in wide terminal
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('Test Session')).toBeInTheDocument();
      expect(screen.getByText('4000')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should show minimal information in compact mode', () => {
      render(<StatusBar {...baseProps} displayMode="compact" />);

      // Should show only essential information
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText('developer')).toBeInTheDocument(); // Agent name (essential)
      expect(screen.getByText(/02:00/)).toBeInTheDocument(); // Timer (essential)

      // Should not show detailed labels or less essential information
      expect(screen.queryByText('⚡')).not.toBeInTheDocument(); // Agent icon hidden
      expect(screen.queryByText('feature/display-modes')).not.toBeInTheDocument(); // Git branch hidden
      expect(screen.queryByText('▶')).not.toBeInTheDocument(); // Stage icon hidden
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // Stage hidden
      expect(screen.queryByText('📋')).not.toBeInTheDocument(); // Progress icon hidden
      expect(screen.queryByText('[3/5]')).not.toBeInTheDocument(); // Progress hidden
      expect(screen.queryByText('💾')).not.toBeInTheDocument(); // Session icon hidden
      expect(screen.queryByText('Test Session')).not.toBeInTheDocument(); // Session name hidden
      expect(screen.queryByText(/api:/)).not.toBeInTheDocument(); // API info hidden
      expect(screen.queryByText(/web:/)).not.toBeInTheDocument(); // Web info hidden
      expect(screen.queryByText(/tokens:/)).not.toBeInTheDocument(); // Token info hidden
      expect(screen.queryByText(/cost:/)).not.toBeInTheDocument(); // Cost info hidden
      expect(screen.queryByText(/model:/)).not.toBeInTheDocument(); // Model info hidden
    });

    it('should handle compact mode with no agent', () => {
      const propsWithoutAgent = { ...baseProps, agent: undefined };
      render(<StatusBar {...propsWithoutAgent} displayMode="compact" />);

      // Should show minimal info even without agent
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText(/02:00/)).toBeInTheDocument(); // Timer

      // Agent name should not be present
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
    });

    it('should prioritize connection and timer in compact mode', () => {
      const minimalProps: StatusBarProps = {
        isConnected: false, // Disconnected
        displayMode: 'compact',
      };

      render(<StatusBar {...minimalProps} />);

      // Should show connection status even when disconnected
      expect(screen.getByText('○')).toBeInTheDocument(); // Disconnected status
      expect(screen.getByText('00:00')).toBeInTheDocument(); // Timer (no start time)
    });

    it('should handle compact mode in narrow terminal', () => {
      // Mock narrow terminal
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: { columns: 40 }
      });

      render(<StatusBar {...baseProps} displayMode="compact" />);

      // Should still show essential info even in narrow terminal
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/02:00/)).toBeInTheDocument();
    });
  });

  describe('Verbose Mode', () => {
    it('should show all available information in verbose mode', () => {
      render(<StatusBar {...baseProps} displayMode="verbose" />);

      // Should show everything, similar to normal but potentially more detailed
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument(); // Git branch
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Agent icon
      expect(screen.getByText('developer')).toBeInTheDocument(); // Agent name
      expect(screen.getByText('▶')).toBeInTheDocument(); // Workflow stage icon
      expect(screen.getByText('implementation')).toBeInTheDocument(); // Workflow stage
      expect(screen.getByText('📋')).toBeInTheDocument(); // Progress icon
      expect(screen.getByText('[3/5]')).toBeInTheDocument(); // Subtask progress
      expect(screen.getByText('💾')).toBeInTheDocument(); // Session icon
      expect(screen.getByText('Test Session')).toBeInTheDocument(); // Session name
      expect(screen.getByText(/api:/)).toBeInTheDocument(); // API label
      expect(screen.getByText('4000')).toBeInTheDocument(); // API port
      expect(screen.getByText(/web:/)).toBeInTheDocument(); // Web label
      expect(screen.getByText('3000')).toBeInTheDocument(); // Web port
      expect(screen.getByText(/02:00/)).toBeInTheDocument(); // Timer
      expect(screen.getByText(/tokens:/)).toBeInTheDocument(); // Tokens label
      expect(screen.getByText('1.5k')).toBeInTheDocument(); // Token count
      expect(screen.getByText(/cost:/)).toBeInTheDocument(); // Cost label
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument(); // Cost value
      expect(screen.getByText(/model:/)).toBeInTheDocument(); // Model label
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument(); // Model name
    });

    it('should ignore terminal width constraints in verbose mode', () => {
      // Mock very narrow terminal
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: { columns: 30 }
      });

      render(<StatusBar {...baseProps} displayMode="verbose" />);

      // In verbose mode, should show all info regardless of terminal width
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('Test Session')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument();
    });

    it('should show verbose information even with missing data', () => {
      const partialProps: StatusBarProps = {
        isConnected: true,
        agent: 'tester',
        tokens: { input: 100, output: 50 },
        displayMode: 'verbose',
        // Missing: gitBranch, model, stage, etc.
      };

      render(<StatusBar {...partialProps} />);

      // Should show available information without crashing
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total tokens

      // Missing information should not cause errors
      expect(screen.queryByText(/model:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/git/)).not.toBeInTheDocument();
    });
  });

  describe('Mode Transitions', () => {
    it('should smoothly transition from normal to compact mode', () => {
      const { rerender } = render(<StatusBar {...baseProps} displayMode="normal" />);

      // Initially shows detailed info
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();

      // Switch to compact mode
      rerender(<StatusBar {...baseProps} displayMode="compact" />);

      // Should now show minimal info
      expect(screen.queryByText('feature/display-modes')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument(); // Essential info remains
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection remains
    });

    it('should smoothly transition from compact to verbose mode', () => {
      const { rerender } = render(<StatusBar {...baseProps} displayMode="compact" />);

      // Initially shows minimal info
      expect(screen.queryByText('feature/display-modes')).not.toBeInTheDocument();
      expect(screen.queryByText('claude-3-sonnet')).not.toBeInTheDocument();

      // Switch to verbose mode
      rerender(<StatusBar {...baseProps} displayMode="verbose" />);

      // Should now show all info
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should handle rapid mode switching', () => {
      const { rerender } = render(<StatusBar {...baseProps} displayMode="normal" />);

      const modes: Array<'normal' | 'compact' | 'verbose'> = ['compact', 'verbose', 'normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        rerender(<StatusBar {...baseProps} displayMode={mode} />);

        // Essential elements should always be present
        expect(screen.getByText('●')).toBeInTheDocument(); // Connection

        if (mode === 'compact') {
          expect(screen.queryByText('feature/display-modes')).not.toBeInTheDocument();
        } else {
          expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined displayMode gracefully', () => {
      const propsWithoutMode = { ...baseProps };
      delete (propsWithoutMode as any).displayMode;

      render(<StatusBar {...propsWithoutMode} />);

      // Should default to normal mode behavior
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should handle invalid displayMode gracefully', () => {
      const propsWithInvalidMode = { ...baseProps, displayMode: 'invalid' as any };

      render(<StatusBar {...propsWithInvalidMode} />);

      // Should fallback to normal mode behavior
      expect(screen.getByText('feature/display-modes')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('should handle missing terminal width in all modes', () => {
      vi.mocked(require('ink').useStdout).mockReturnValue({
        stdout: undefined
      });

      ['normal', 'compact', 'verbose'].forEach(mode => {
        render(<StatusBar {...baseProps} displayMode={mode as any} />);

        // Should not crash and show basic elements
        expect(screen.getByText('●')).toBeInTheDocument();
        // Clean up for next iteration
        screen.queryAllByText('●').forEach(el => el.remove?.());
      });
    });

    it('should handle all props missing except connection status', () => {
      const minimalProps: StatusBarProps = {
        isConnected: true,
        displayMode: 'verbose', // Even in verbose mode with minimal data
      };

      render(<StatusBar {...minimalProps} />);

      // Should show what's available without crashing
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('00:00')).toBeInTheDocument(); // Default timer
    });

    it('should handle long session names in different modes', () => {
      const longSessionName = 'Very Long Session Name That Should Be Truncated Appropriately';
      const propsWithLongName = { ...baseProps, sessionName: longSessionName };

      // Test in different modes
      ['normal', 'compact', 'verbose'].forEach(mode => {
        const { rerender } = render(<StatusBar {...propsWithLongName} displayMode={mode as any} />);

        if (mode === 'compact') {
          // Session name should not be shown in compact mode
          expect(screen.queryByText(/Very Long/)).not.toBeInTheDocument();
        } else {
          // In normal/verbose modes, should handle long names (possibly truncated)
          const sessionElements = screen.queryAllByText(/Very Long/);
          // Either not shown due to width constraints or properly truncated
        }

        // Clean up
        rerender(<StatusBar isConnected={true} displayMode={mode as any} />);
      });
    });

    it('should maintain timer accuracy across mode changes', () => {
      const startTime = new Date(Date.now() - 65000); // 1 minute 5 seconds ago
      vi.setSystemTime(new Date());

      const { rerender } = render(
        <StatusBar {...baseProps} sessionStartTime={startTime} displayMode="normal" />
      );

      expect(screen.getByText('01:05')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <StatusBar {...baseProps} sessionStartTime={startTime} displayMode="compact" />
      );

      // Timer should still be accurate
      expect(screen.getByText('01:05')).toBeInTheDocument();

      // Switch to verbose mode
      rerender(
        <StatusBar {...baseProps} sessionStartTime={startTime} displayMode="verbose" />
      );

      // Timer should still be accurate
      expect(screen.getByText('01:05')).toBeInTheDocument();
    });
  });
});