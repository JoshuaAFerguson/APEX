/**
 * Integration test for showThoughts state integration with StatusBar component
 * Validates that showThoughts state is properly passed to StatusBar and displayed
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBar } from '../ui/components/StatusBar';
import { ThemeProvider } from '../ui/context/ThemeContext';

// Mock ink components
vi.mock('ink', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, color }: { children: React.ReactNode; color?: string }) =>
    <span style={{ color }}>{children}</span>,
  useStdout: vi.fn(() => ({ stdout: { columns: 80 } })),
}));

// Mock other dependencies
vi.mock('../ui/hooks/useElapsedTime', () => ({
  useElapsedTime: vi.fn(() => '5m 30s'),
}));

describe('StatusBar showThoughts Integration', () => {
  const defaultProps = {
    sessionData: {
      startTime: new Date('2023-01-01T10:00:00Z'),
      tokenUsage: { input: 1500, output: 800 },
      cost: 0.05,
      model: 'claude-3-sonnet' as const,
    },
    gitBranch: 'feature/thoughts',
    activeAgent: 'developer' as const,
    currentStage: 'implementation' as const,
    displayMode: 'normal' as const,
    previewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display showThoughts as false by default', () => {
    render(
      <ThemeProvider>
        <StatusBar {...defaultProps} />
      </ThemeProvider>
    );

    // Should not show thoughts indicator when showThoughts is undefined/false
    expect(screen.queryByText(/thoughts.*enabled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/🧠/)).not.toBeInTheDocument();
  });

  it('should display showThoughts when enabled', () => {
    render(
      <ThemeProvider>
        <StatusBar {...defaultProps} showThoughts={true} />
      </ThemeProvider>
    );

    // Should show thoughts indicator when enabled
    expect(screen.getByText(/thoughts.*enabled/i)).toBeInTheDocument();
  });

  it('should not display showThoughts when explicitly disabled', () => {
    render(
      <ThemeProvider>
        <StatusBar {...defaultProps} showThoughts={false} />
      </ThemeProvider>
    );

    // Should not show thoughts indicator when explicitly disabled
    expect(screen.queryByText(/thoughts.*enabled/i)).not.toBeInTheDocument();
  });

  it('should display alongside other status information', () => {
    render(
      <ThemeProvider>
        <StatusBar {...defaultProps} showThoughts={true} />
      </ThemeProvider>
    );

    // Should display all status information including thoughts
    expect(screen.getByText(/5m 30s/)).toBeInTheDocument(); // Timer
    expect(screen.getByText(/2.3K/)).toBeInTheDocument(); // Tokens
    expect(screen.getByText(/\$0\.05/)).toBeInTheDocument(); // Cost
    expect(screen.getByText(/feature\/thoughts/)).toBeInTheDocument(); // Git branch
    expect(screen.getByText(/developer/)).toBeInTheDocument(); // Active agent
    expect(screen.getByText(/thoughts.*enabled/i)).toBeInTheDocument(); // Thoughts status
  });

  it('should handle different display modes with showThoughts', () => {
    const { rerender } = render(
      <ThemeProvider>
        <StatusBar {...defaultProps} displayMode="compact" showThoughts={true} />
      </ThemeProvider>
    );

    // Should work in compact mode
    expect(screen.getByText(/thoughts.*enabled/i)).toBeInTheDocument();

    // Should work in verbose mode
    rerender(
      <ThemeProvider>
        <StatusBar {...defaultProps} displayMode="verbose" showThoughts={true} />
      </ThemeProvider>
    );
    expect(screen.getByText(/thoughts.*enabled/i)).toBeInTheDocument();
  });

  it('should handle theme changes with showThoughts', () => {
    const { rerender } = render(
      <ThemeProvider theme="dark">
        <StatusBar {...defaultProps} showThoughts={true} />
      </ThemeProvider>
    );

    // Should display in dark theme
    expect(screen.getByText(/thoughts.*enabled/i)).toBeInTheDocument();

    rerender(
      <ThemeProvider theme="light">
        <StatusBar {...defaultProps} showThoughts={true} />
      </ThemeProvider>
    );

    // Should display in light theme
    expect(screen.getByText(/thoughts.*enabled/i)).toBeInTheDocument();
  });
});