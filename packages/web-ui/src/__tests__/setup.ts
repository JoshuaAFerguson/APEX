import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock lucide-react icons globally using Proxy to auto-generate stubs for any icon
// This prevents "No X export is defined on the lucide-react mock" errors
// when new icons are added to components without updating the mock
vi.mock('lucide-react', () => {
  const createIconMock = (name: string) => {
    const testId = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '-icon';
    const component = (props: any) => React.createElement('div', { 'data-testid': testId, ...props }, name);
    component.displayName = name;
    return component;
  };

  return new Proxy({}, {
    get: (_target, prop: string) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return {};
      return createIconMock(prop);
    },
  });
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Add any global setup here
});