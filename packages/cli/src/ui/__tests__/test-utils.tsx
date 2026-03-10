/**
 * @fileoverview Test utilities for CLI UI component testing
 *
 * Re-exports testing utilities from @testing-library/react with
 * any necessary CLI-specific wrappers or configurations.
 */

import React from 'react';
import {
  render as rtlRender,
  screen,
  fireEvent,
  waitFor,
  act,
  RenderOptions,
  RenderResult,
} from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext.js';

// Import jest-dom matchers for toBeInTheDocument, etc.
import '@testing-library/jest-dom';

// Mock useInput from ink for testing
const mockUseInput = vi.fn();

/**
 * Test wrapper component that provides theme context
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
}

/**
 * Custom render function with theme provider
 * Wraps components in ThemeProvider for testing StatusBar and other themed components
 */
function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'queries'>
): RenderResult {
  return rtlRender(ui, {
    wrapper: TestWrapper,
    ...options,
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render with custom render
export { render, screen, fireEvent, waitFor, act, mockUseInput };
