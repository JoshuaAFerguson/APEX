/**
 * Utilities for generating unified diff format for file changes
 */

import * as fs from 'fs';

/**
 * Options for generating a diff
 */
export interface DiffOptions {
  /** Path to the file being modified */
  filePath: string;
  /** Original content of the file (before change) */
  originalContent: string;
  /** New content of the file (after change) */
  newContent: string;
  /** Number of lines of context to include around changes (default: 3) */
  contextLines?: number;
}

/**
 * Result of diff generation
 */
export interface DiffResult {
  /** Whether there are any differences */
  hasDifferences: boolean;
  /** The unified diff string */
  diff: string;
  /** Number of added lines */
  addedLines: number;
  /** Number of removed lines */
  removedLines: number;
  /** Number of modified lines (treated as additions + deletions) */
  modifiedLines: number;
}

/**
 * Generates a unified diff between two strings
 *
 * @param options - Configuration for diff generation
 * @returns DiffResult containing the diff and statistics
 */
export function generateDiff(options: DiffOptions): DiffResult {
  const { filePath, originalContent, newContent, contextLines = 3 } = options;

  // Split content into lines for comparison
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  // If content is identical, return no diff
  if (originalContent === newContent) {
    return {
      hasDifferences: false,
      diff: '',
      addedLines: 0,
      removedLines: 0,
      modifiedLines: 0,
    };
  }

  // Generate the diff using a simplified LCS-based algorithm
  const diffData = computeDiff(originalLines, newLines);
  const unifiedDiff = formatUnifiedDiff(filePath, originalLines, newLines, diffData, contextLines);

  return {
    hasDifferences: true,
    diff: unifiedDiff,
    addedLines: diffData.addedLines,
    removedLines: diffData.removedLines,
    modifiedLines: diffData.addedLines + diffData.removedLines,
  };
}

/**
 * Generates a diff for a file edit operation, reading the original content from disk
 *
 * @param filePath - Path to the file being edited
 * @param newContent - The new content that will be written
 * @returns DiffResult containing the diff and statistics
 */
export function generateFileDiff(filePath: string, newContent: string): DiffResult {
  // Read original content from disk, or use empty string if file doesn't exist
  let originalContent = '';
  try {
    if (fs.existsSync(filePath)) {
      originalContent = fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    // If we can't read the file, treat it as a new file
    originalContent = '';
  }

  return generateDiff({
    filePath,
    originalContent,
    newContent,
  });
}

/**
 * Internal structure for tracking diff operations
 */
interface DiffData {
  operations: Array<{
    type: 'equal' | 'delete' | 'insert';
    oldStart: number;
    oldLength: number;
    newStart: number;
    newLength: number;
  }>;
  addedLines: number;
  removedLines: number;
}

/**
 * Compute the diff operations using a simplified algorithm
 * This is a basic implementation - for production use, consider using a library like 'diff'
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffData {
  const operations: DiffData['operations'] = [];
  let addedLines = 0;
  let removedLines = 0;

  // Simple line-by-line comparison
  // This is a basic implementation - a full LCS algorithm would be more accurate
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      // Only new lines remaining
      const insertLength = newLines.length - newIndex;
      operations.push({
        type: 'insert',
        oldStart: oldIndex,
        oldLength: 0,
        newStart: newIndex,
        newLength: insertLength,
      });
      addedLines += insertLength;
      break;
    } else if (newIndex >= newLines.length) {
      // Only old lines remaining
      const deleteLength = oldLines.length - oldIndex;
      operations.push({
        type: 'delete',
        oldStart: oldIndex,
        oldLength: deleteLength,
        newStart: newIndex,
        newLength: 0,
      });
      removedLines += deleteLength;
      break;
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      // Lines are equal
      let equalStart = oldIndex;
      let equalLength = 0;
      while (
        oldIndex < oldLines.length &&
        newIndex < newLines.length &&
        oldLines[oldIndex] === newLines[newIndex]
      ) {
        oldIndex++;
        newIndex++;
        equalLength++;
      }
      operations.push({
        type: 'equal',
        oldStart: equalStart,
        oldLength: equalLength,
        newStart: equalStart,
        newLength: equalLength,
      });
    } else {
      // Lines differ - find the next matching point
      let found = false;

      // Look ahead to find matching lines
      for (let i = 1; i <= Math.min(10, Math.max(oldLines.length - oldIndex, newLines.length - newIndex)); i++) {
        if (oldIndex + i < oldLines.length && newIndex + i < newLines.length) {
          if (oldLines[oldIndex + i] === newLines[newIndex + i]) {
            // Found a match - treat previous lines as replacements
            operations.push({
              type: 'delete',
              oldStart: oldIndex,
              oldLength: i,
              newStart: newIndex,
              newLength: 0,
            });
            operations.push({
              type: 'insert',
              oldStart: oldIndex + i,
              oldLength: 0,
              newStart: newIndex,
              newLength: i,
            });
            removedLines += i;
            addedLines += i;
            oldIndex += i;
            newIndex += i;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // No match found nearby, treat as single line change
        operations.push({
          type: 'delete',
          oldStart: oldIndex,
          oldLength: 1,
          newStart: newIndex,
          newLength: 0,
        });
        operations.push({
          type: 'insert',
          oldStart: oldIndex + 1,
          oldLength: 0,
          newStart: newIndex,
          newLength: 1,
        });
        removedLines++;
        addedLines++;
        oldIndex++;
        newIndex++;
      }
    }
  }

  return { operations, addedLines, removedLines };
}

/**
 * Format the diff operations as a unified diff
 */
function formatUnifiedDiff(
  filePath: string,
  oldLines: string[],
  newLines: string[],
  diffData: DiffData,
  contextLines: number
): string {
  const result: string[] = [];

  // Add header
  const normalizedPath = filePath.replace(/\\/g, '/');
  result.push(`--- a/${normalizedPath}`);
  result.push(`+++ b/${normalizedPath}`);

  // Group operations into hunks with context
  const hunks = groupOperationsIntoHunks(diffData.operations, contextLines);

  for (const hunk of hunks) {
    // Add hunk header
    const oldStart = hunk.oldStart + 1; // 1-based line numbers in diff format
    const oldLength = hunk.oldLength;
    const newStart = hunk.newStart + 1;
    const newLength = hunk.newLength;

    result.push(`@@ -${oldStart},${oldLength} +${newStart},${newLength} @@`);

    // Add hunk content
    for (const op of hunk.operations) {
      switch (op.type) {
        case 'equal':
          for (let i = 0; i < op.oldLength; i++) {
            result.push(` ${oldLines[op.oldStart + i]}`);
          }
          break;
        case 'delete':
          for (let i = 0; i < op.oldLength; i++) {
            result.push(`-${oldLines[op.oldStart + i]}`);
          }
          break;
        case 'insert':
          for (let i = 0; i < op.newLength; i++) {
            result.push(`+${newLines[op.newStart + i]}`);
          }
          break;
      }
    }
  }

  return result.join('\n');
}

/**
 * Group operations into hunks with appropriate context
 */
function groupOperationsIntoHunks(
  operations: DiffData['operations'],
  contextLines: number
): Array<{
  oldStart: number;
  oldLength: number;
  newStart: number;
  newLength: number;
  operations: DiffData['operations'];
}> {
  const hunks: Array<{
    oldStart: number;
    oldLength: number;
    newStart: number;
    newLength: number;
    operations: DiffData['operations'];
  }> = [];

  let currentHunk: typeof hunks[0] | null = null;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (op.type === 'equal') {
      // For equal sections, we may need to include as context or split hunks
      if (currentHunk === null) {
        // No current hunk, skip this equal section unless next op needs it
        continue;
      }

      if (op.oldLength <= contextLines * 2) {
        // Small equal section - include in current hunk
        currentHunk.operations.push(op);
        currentHunk.oldLength += op.oldLength;
        currentHunk.newLength += op.newLength;
      } else {
        // Large equal section - end current hunk with context and start new one
        const contextOp = {
          ...op,
          oldLength: Math.min(contextLines, op.oldLength),
          newLength: Math.min(contextLines, op.newLength),
        };
        currentHunk.operations.push(contextOp);
        currentHunk.oldLength += contextOp.oldLength;
        currentHunk.newLength += contextOp.newLength;

        hunks.push(currentHunk);
        currentHunk = null;

        // If there are more operations after this, start a new hunk with leading context
        if (i < operations.length - 1) {
          const leadingContextLines = Math.min(contextLines, op.oldLength);
          currentHunk = {
            oldStart: op.oldStart + op.oldLength - leadingContextLines,
            oldLength: leadingContextLines,
            newStart: op.newStart + op.newLength - leadingContextLines,
            newLength: leadingContextLines,
            operations: [{
              type: 'equal',
              oldStart: op.oldStart + op.oldLength - leadingContextLines,
              oldLength: leadingContextLines,
              newStart: op.newStart + op.newLength - leadingContextLines,
              newLength: leadingContextLines,
            }],
          };
        }
      }
    } else {
      // Delete or insert operation
      if (currentHunk === null) {
        // Start a new hunk
        currentHunk = {
          oldStart: Math.max(0, op.oldStart - contextLines),
          oldLength: 0,
          newStart: Math.max(0, op.newStart - contextLines),
          newLength: 0,
          operations: [],
        };

        // Add leading context if available
        const leadingContextLines = Math.min(contextLines, op.oldStart);
        if (leadingContextLines > 0) {
          currentHunk.operations.push({
            type: 'equal',
            oldStart: op.oldStart - leadingContextLines,
            oldLength: leadingContextLines,
            newStart: op.newStart - leadingContextLines,
            newLength: leadingContextLines,
          });
          currentHunk.oldLength += leadingContextLines;
          currentHunk.newLength += leadingContextLines;
        }
      }

      currentHunk.operations.push(op);
      currentHunk.oldLength += op.oldLength;
      currentHunk.newLength += op.newLength;
    }
  }

  // Finalize the last hunk
  if (currentHunk !== null) {
    hunks.push(currentHunk);
  }

  return hunks;
}