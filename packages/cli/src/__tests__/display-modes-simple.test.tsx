/**
 * Simple display modes test to verify basic functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBar } from '../ui/components/StatusBar';
import { ThemeProvider } from '../ui/context/ThemeContext';

describe('Display Modes Simple Test', () => {
  it('should render StatusBar with compact mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="compact"
          gitBranch="test-branch"
          cost={0.01}
        />
      </ThemeProvider>
    );

    // Should show connection indicator (always present)
    expect(screen.getByText('●')).toBeInTheDocument();
    // Should show git branch in compact mode
    expect(screen.getByText('test-branch')).toBeInTheDocument();
  });

  it('should render StatusBar with normal mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="normal"
          gitBranch="test-branch"
          agent="developer"
          tokens={{ input: 100, output: 50 }}
          cost={0.01}
        />
      </ThemeProvider>
    );

    // Should show connection indicator
    expect(screen.getByText('●')).toBeInTheDocument();
    // Should show agent in normal mode
    expect(screen.getByText('developer')).toBeInTheDocument();
  });

  it('should render StatusBar with verbose mode', () => {
    render(
      <ThemeProvider>
        <StatusBar
          displayMode="verbose"
          gitBranch="test-branch"
          agent="architect"
          workflowStage="planning"
          tokens={{ input: 200, output: 100 }}
          cost={0.02}
        />
      </ThemeProvider>
    );

    // Should show all information in verbose mode
    expect(screen.getByText('●')).toBeInTheDocument();
    expect(screen.getByText('architect')).toBeInTheDocument();
    expect(screen.getByText('planning')).toBeInTheDocument();
  });
});