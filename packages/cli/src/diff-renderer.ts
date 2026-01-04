import chalk from 'chalk';

/**
 * Colorizes unified diff output using chalk.
 *
 * @param diff - Raw unified diff string (e.g., git diff output)
 * @returns Colorized diff string with ANSI escape codes
 *
 * Color scheme:
 * - Green: Added lines (+)
 * - Red: Removed lines (-)
 * - Cyan: Hunk headers (@@ ... @@)
 * - Bold: File headers (--- and +++ lines, diff --git lines)
 * - Gray: Index lines
 * - Default: Context lines (no styling)
 */
export function renderColoredDiff(diff: string): string {
  // Handle empty or invalid input
  if (!diff || typeof diff !== 'string' || diff.trim() === '') {
    return '';
  }

  // Normalize line endings to \n for consistent processing
  const normalizedDiff = diff.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines and process each line
  const lines = normalizedDiff.split('\n');

  const colorizedLines = lines.map(line => {
    // Added lines (green)
    if (line.startsWith('+')) {
      return chalk.green(line);
    }

    // Removed lines (red)
    if (line.startsWith('-')) {
      return chalk.red(line);
    }

    // Hunk headers (cyan)
    if (line.startsWith('@@') && line.includes('@@')) {
      return chalk.cyan(line);
    }

    // File headers (bold)
    if (line.startsWith('diff --git')) {
      return chalk.bold(line);
    }

    if (line.startsWith('---') || line.startsWith('+++')) {
      return chalk.bold(line);
    }

    // Index lines (gray)
    if (line.startsWith('index ')) {
      return chalk.gray(line);
    }

    // Context lines - no styling (return as-is)
    return line;
  });

  // Join lines back together with original line endings
  return colorizedLines.join('\n');
}