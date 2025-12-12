import { vi } from 'vitest';

// Mock Ink rendering for testing
vi.mock('ink', () => ({
  Box: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  useInput: vi.fn(),
  useStdout: vi.fn(() => ({ stdout: { columns: 80 } })),
  render: vi.fn(),
}));

// Mock React for testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn(),
    useEffect: vi.fn(),
    useCallback: vi.fn(),
  };
});

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