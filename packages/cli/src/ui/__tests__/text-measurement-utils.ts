/**
 * Utility functions for measuring text content in tests
 * This is a simple implementation for terminal-based text measurement
 */

/**
 * Measures the display width of text in a terminal context
 * For testing purposes, we assume each character takes 1 column
 * In a real terminal, this would account for wide characters, emojis, etc.
 *
 * @param text - The text to measure
 * @returns The width in terminal columns
 */
export function measureTextWidth(text: string): number {
  // Simple implementation for testing
  // In production, you might use libraries like string-width

  // Remove ANSI color codes for accurate measurement
  const cleanText = text.replace(/\u001b\[[0-9;]*m/g, '');

  // Count characters (simplified - doesn't handle wide chars or emojis)
  return cleanText.length;
}

/**
 * Checks if text would overflow a given terminal width
 *
 * @param text - The text to check
 * @param maxWidth - Maximum terminal width
 * @returns True if text would overflow
 */
export function wouldOverflow(text: string, maxWidth: number): boolean {
  return measureTextWidth(text) > maxWidth;
}

/**
 * Truncates text to fit within a specified width
 *
 * @param text - The text to truncate
 * @param maxWidth - Maximum width
 * @param ellipsis - String to append when truncating (default: '...')
 * @returns Truncated text
 */
export function truncateToFit(text: string, maxWidth: number, ellipsis: string = '...'): string {
  if (measureTextWidth(text) <= maxWidth) {
    return text;
  }

  const ellipsisWidth = measureTextWidth(ellipsis);
  const maxContentWidth = maxWidth - ellipsisWidth;

  if (maxContentWidth <= 0) {
    return ellipsis.substring(0, maxWidth);
  }

  return text.substring(0, maxContentWidth) + ellipsis;
}

/**
 * Validates that content fits within terminal boundaries
 * Used in tests to ensure responsive components don't overflow
 *
 * @param content - Content to validate (can be multi-line)
 * @param terminalWidth - Terminal width constraint
 * @returns Array of lines that would overflow
 */
export function validateTerminalFit(content: string, terminalWidth: number): string[] {
  const lines = content.split('\n');
  const overflowingLines: string[] = [];

  lines.forEach((line, index) => {
    if (wouldOverflow(line, terminalWidth)) {
      overflowingLines.push(`Line ${index + 1}: "${line}" (width: ${measureTextWidth(line)})`);
    }
  });

  return overflowingLines;
}

/**
 * Mock measurement function that simulates terminal width constraints
 * Useful for testing responsive behavior without actual terminal interaction
 *
 * @param element - DOM element or text content
 * @param terminalWidth - Simulated terminal width
 * @returns Measurement result with overflow detection
 */
type TextContentElement = { textContent?: string | null };

export function mockTerminalMeasurement(
  element: TextContentElement | string,
  terminalWidth: number
): {
  fits: boolean;
  actualWidth: number;
  overflowAmount: number;
  suggestedTruncation: string;
} {
  const text = typeof element === 'string' ? element : element.textContent || '';
  const actualWidth = measureTextWidth(text);
  const fits = actualWidth <= terminalWidth;
  const overflowAmount = Math.max(0, actualWidth - terminalWidth);
  const suggestedTruncation = truncateToFit(text, terminalWidth);

  return {
    fits,
    actualWidth,
    overflowAmount,
    suggestedTruncation,
  };
}
