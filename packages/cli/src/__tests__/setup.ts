import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock Ink rendering for testing
vi.mock('ink', () => ({
  Box: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement('div', rest, children),
  Text: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement('span', rest, children),
  useInput: vi.fn(),
  useStdout: vi.fn(() => ({ stdout: { columns: 80 } })),
  render: vi.fn(),
}));

// Mock Fuse.js for search functionality
vi.mock('fuse.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockReturnValue([]),
  })),
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
