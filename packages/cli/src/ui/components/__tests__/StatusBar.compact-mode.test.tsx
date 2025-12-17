import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StatusBar, StatusBarProps } from '../StatusBar';

// Mock useStdoutDimensions hook
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 120,
    height: 30,
    breakpoint: 'wide' as const,
  })),
}));

// Mock ink
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({ stdout: { columns: 120 } }),
  };
});

describe('StatusBar - Compact Mode Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fullProps: StatusBarProps = {
    isConnected: true,
    gitBranch: 'feature/compact-mode',
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
    previewMode: true,
    showThoughts: true,
  };

  describe('Compact Mode Essential Elements', () => {
    it('should show only status icon, git branch, and cost in compact mode', () => {
      render(<StatusBar {...fullProps} displayMode="compact" />);

      // Should show essential elements only
      expect(screen.getByText('●')).toBeInTheDocument(); // Connection status icon
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument(); // Git branch
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument(); // Cost value

      // Should NOT show detailed information
      expect(screen.queryByText('developer')).not.toBeInTheDocument(); // Agent name
      expect(screen.queryByText('⚡')).not.toBeInTheDocument(); // Agent icon
      expect(screen.queryByText('implementation')).not.toBeInTheDocument(); // Workflow stage
      expect(screen.queryByText('▶')).not.toBeInTheDocument(); // Stage icon
      expect(screen.queryByText('[3/5]')).not.toBeInTheDocument(); // Subtask progress
      expect(screen.queryByText('📋')).not.toBeInTheDocument(); // Progress icon
      expect(screen.queryByText('Test Session')).not.toBeInTheDocument(); // Session name
      expect(screen.queryByText('💾')).not.toBeInTheDocument(); // Session icon
      expect(screen.queryByText('02:00')).not.toBeInTheDocument(); // Timer
      expect(screen.queryByText(/api:/)).not.toBeInTheDocument(); // API info
      expect(screen.queryByText(/web:/)).not.toBeInTheDocument(); // Web info
      expect(screen.queryByText(/tokens:/)).not.toBeInTheDocument(); // Token label
      expect(screen.queryByText(/model:/)).not.toBeInTheDocument(); // Model label
      expect(screen.queryByText('claude-3-sonnet')).not.toBeInTheDocument(); // Model value
      expect(screen.queryByText(/cost:/)).not.toBeInTheDocument(); // Cost label (value shown without label)
      expect(screen.queryByText('📋 PREVIEW')).not.toBeInTheDocument(); // Preview mode
      expect(screen.queryByText('💭 THOUGHTS')).not.toBeInTheDocument(); // Thoughts mode
    });

    it('should show connection status icon correctly in compact mode', () => {
      // Test connected state
      render(<StatusBar {...fullProps} displayMode="compact" isConnected={true} />);
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('●')).toHaveProperty('color', 'green');

      // Test disconnected state
      render(<StatusBar {...fullProps} displayMode="compact" isConnected={false} />);
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('○')).toHaveProperty('color', 'red');
    });

    it('should handle missing git branch in compact mode gracefully', () => {
      const propsWithoutBranch = { ...fullProps, gitBranch: undefined };
      render(<StatusBar {...propsWithoutBranch} displayMode="compact" />);

      // Should show status and cost, but no git branch
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument();
      expect(screen.queryByText('feature/compact-mode')).not.toBeInTheDocument();
    });

    it('should handle missing cost in compact mode gracefully', () => {
      const propsWithoutCost = { ...fullProps, cost: undefined };
      render(<StatusBar {...propsWithoutCost} displayMode="compact" />);

      // Should show status and branch, but no cost
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode Layout Tests', () => {
    it('should maintain compact layout in narrow terminal', () => {
      const useStdoutDimensionsMock = vi.mocked(require('../../hooks/useStdoutDimensions').useStdoutDimensions);
      useStdoutDimensionsMock.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow' as const,
      });

      render(<StatusBar {...fullProps} displayMode="compact" />);

      // Essential elements should still be present in narrow terminal
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument();
    });

    it('should maintain compact layout in wide terminal', () => {
      const useStdoutDimensionsMock = vi.mocked(require('../../hooks/useStdoutDimensions').useStdoutDimensions);
      useStdoutDimensionsMock.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide' as const,
      });

      render(<StatusBar {...fullProps} displayMode="compact" />);

      // Should still show only compact elements even in wide terminal
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument();

      // Should still hide detailed info even with available space
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode Edge Cases', () => {
    it('should handle minimal props in compact mode', () => {
      const minimalProps: StatusBarProps = {
        isConnected: true,
        displayMode: 'compact',
      };

      render(<StatusBar {...minimalProps} />);

      // Should only show connection status
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.queryByText(/feature/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it('should handle very long git branch name in compact mode', () => {
      const longBranchProps = {
        ...fullProps,
        gitBranch: 'feature/very-long-branch-name-that-should-be-handled-gracefully-in-compact-mode',
        displayMode: 'compact' as const,
      };

      render(<StatusBar {...longBranchProps} />);

      // Should show the full branch name (compact mode doesn't truncate)
      expect(screen.getByText('feature/very-long-branch-name-that-should-be-handled-gracefully-in-compact-mode')).toBeInTheDocument();
    });

    it('should format cost values correctly in compact mode', () => {
      // Test various cost values
      const testCases = [
        { cost: 0.0001, expected: '$0.0001' },
        { cost: 0.1234, expected: '$0.1234' },
        { cost: 1.5678, expected: '$1.5678' },
        { cost: 10.0, expected: '$10.0000' },
      ];

      testCases.forEach(({ cost, expected }) => {
        const { rerender } = render(<StatusBar {...fullProps} cost={cost} displayMode="compact" />);
        expect(screen.getByText(expected)).toBeInTheDocument();

        // Clean up for next test
        rerender(<StatusBar isConnected={true} displayMode="compact" />);
      });
    });
  });

  describe('Compact Mode vs Other Modes', () => {
    it('should show different information than normal mode', () => {
      const { rerender } = render(<StatusBar {...fullProps} displayMode="normal" />);

      // Normal mode should show detailed info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText(/02:00/)).toBeInTheDocument();

      // Switch to compact mode
      rerender(<StatusBar {...fullProps} displayMode="compact" />);

      // Compact mode should hide detailed info
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/02:00/)).not.toBeInTheDocument();

      // But show essential info
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText(/\$0\.0234/)).toBeInTheDocument();
    });

    it('should show different information than verbose mode', () => {
      const { rerender } = render(<StatusBar {...fullProps} displayMode="verbose" />);

      // Verbose mode should show everything
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText(/02:00/)).toBeInTheDocument();
      expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument();

      // Switch to compact mode
      rerender(<StatusBar {...fullProps} displayMode="compact" />);

      // Compact mode should show minimal info
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
      expect(screen.queryByText('implementation')).not.toBeInTheDocument();
      expect(screen.queryByText(/02:00/)).not.toBeInTheDocument();
      expect(screen.queryByText('claude-3-sonnet')).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode Props Validation', () => {
    it('should treat undefined displayMode as normal mode', () => {
      const propsWithoutDisplayMode = { ...fullProps };
      delete (propsWithoutDisplayMode as any).displayMode;

      render(<StatusBar {...propsWithoutDisplayMode} />);

      // Should behave like normal mode
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument(); // Detailed info shown
    });

    it('should ignore invalid displayMode and default to normal', () => {
      const propsWithInvalidMode = { ...fullProps, displayMode: 'invalid' as any };

      render(<StatusBar {...propsWithInvalidMode} />);

      // Should behave like normal mode
      expect(screen.getByText('feature/compact-mode')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument(); // Detailed info shown
    });
  });
});