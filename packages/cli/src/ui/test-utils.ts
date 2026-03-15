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

// Import jest-dom matchers for toBeInTheDocument, etc.
import '@testing-library/jest-dom';

/**
 * Custom render function that can be extended with providers
 * For now, it's a simple passthrough to RTL render
 */
function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'queries'>
): RenderResult {
  return rtlRender(ui, options);
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render with custom render
export { render, screen, fireEvent, waitFor, act };
