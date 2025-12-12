import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock theme context for tests
export const mockTheme = {
  name: 'dark',
  colors: {
    primary: '#007acc',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    muted: '#6c757d',
    border: '#dee2e6',
    syntax: {
      keyword: '#569cd6',
      string: '#ce9178',
      number: '#b5cea8',
      comment: '#6a9955',
      function: '#dcdcaa',
    },
    agents: {
      planner: '#007acc',
      architect: '#ff6b35',
      developer: '#28a745',
      tester: '#ffc107',
      reviewer: '#dc3545',
      devops: '#17a2b8',
    },
  },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'theme-provider' }, children);
};

// Custom render function that includes providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <ThemeProvider>{children}</ThemeProvider>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
};

// Mock Ink hooks
export const mockUseInput = vi.fn();
export const mockUseStdout = vi.fn(() => ({ stdout: { columns: 80 } }));

// Mock timer utilities for streaming tests
export const advanceTimers = (time: number) => {
  vi.advanceTimersByTime(time);
};

export const waitFor = (callback: () => void | Promise<void>, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = async () => {
      try {
        await callback();
        resolve(true);
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          reject(error);
        } else {
          setTimeout(check, 10);
        }
      }
    };

    check();
  });
};

export * from '@testing-library/react';
export { customRender as render };