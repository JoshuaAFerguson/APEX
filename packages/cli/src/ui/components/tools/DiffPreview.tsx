import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';

export interface DiffPreviewProps {
  /** Original content */
  originalContent: string;
  /** Modified content */
  modifiedContent: string;
  /** File path for context */
  filePath?: string;
  /** Tool name that will perform the operation */
  toolName?: string;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Maximum lines to show in preview */
  maxLines?: number;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to show context around changes */
  showContext?: boolean;
  /** Number of context lines to show around changes */
  contextLines?: number;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber: number;
}

/**
 * Parse content into lines and generate diff information
 */
function generateDiff(
  originalContent: string,
  modifiedContent: string,
  showContext: boolean = true,
  contextLines: number = 3
): DiffLine[] {
  const originalLines = originalContent.split('\n');
  const modifiedLines = modifiedContent.split('\n');

  // Simple diff algorithm - this could be enhanced with a proper diff library
  const diff: DiffLine[] = [];
  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  let originalIndex = 0;
  let modifiedIndex = 0;

  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[originalIndex] || '';
    const modifiedLine = modifiedLines[modifiedIndex] || '';

    if (originalLine === modifiedLine) {
      // Lines are identical
      diff.push({
        type: 'unchanged',
        content: originalLine,
        lineNumber: originalIndex + 1,
      });
      originalIndex++;
      modifiedIndex++;
    } else {
      // Lines differ - handle removals and additions
      if (originalIndex < originalLines.length) {
        diff.push({
          type: 'removed',
          content: originalLine,
          lineNumber: originalIndex + 1,
        });
        originalIndex++;
      }

      if (modifiedIndex < modifiedLines.length) {
        diff.push({
          type: 'added',
          content: modifiedLine,
          lineNumber: modifiedIndex + 1,
        });
        modifiedIndex++;
      }
    }
  }

  // If context is disabled, only show changed lines
  if (!showContext) {
    return diff.filter(line => line.type !== 'unchanged');
  }

  // Include context lines around changes
  const contextDiff: DiffLine[] = [];
  const changedIndices = new Set<number>();

  // Mark all changed lines
  diff.forEach((line, index) => {
    if (line.type !== 'unchanged') {
      // Include context around this change
      for (let j = Math.max(0, index - contextLines); j <= Math.min(diff.length - 1, index + contextLines); j++) {
        changedIndices.add(j);
      }
    }
  });

  // Build final diff with context
  let lastIncludedIndex = -1;
  changedIndices.forEach(index => {
    // Add separator for gaps
    if (index > lastIncludedIndex + 1 && contextDiff.length > 0) {
      contextDiff.push({
        type: 'unchanged',
        content: '...',
        lineNumber: -1,
      });
    }
    contextDiff.push(diff[index]);
    lastIncludedIndex = index;
  });

  return contextDiff;
}

/**
 * Get color for diff line based on type
 */
function getDiffLineColor(type: DiffLine['type']): string {
  switch (type) {
    case 'added':
      return 'green';
    case 'removed':
      return 'red';
    case 'unchanged':
      return 'gray';
  }
}

/**
 * Get prefix for diff line based on type
 */
function getDiffLinePrefix(type: DiffLine['type']): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'unchanged':
      return ' ';
  }
}

/**
 * DiffPreview component for showing file changes before they're applied
 */
export function DiffPreview({
  originalContent,
  modifiedContent,
  filePath,
  toolName = 'Edit',
  displayMode = 'normal',
  maxLines = 20,
  showLineNumbers = true,
  showContext = true,
  contextLines = 3,
}: DiffPreviewProps): React.ReactElement {
  const diffLines = useMemo(() => {
    const diff = generateDiff(originalContent, modifiedContent, showContext, contextLines);
    return diff.slice(0, maxLines);
  }, [originalContent, modifiedContent, showContext, contextLines, maxLines]);

  const stats = useMemo(() => {
    const added = diffLines.filter(line => line.type === 'added').length;
    const removed = diffLines.filter(line => line.type === 'removed').length;
    const totalLines = originalContent.split('\n').length;
    return { added, removed, totalLines };
  }, [diffLines, originalContent]);

  // Compact mode: just show summary
  if (displayMode === 'compact') {
    return (
      <Box gap={1} paddingX={1}>
        <Text color="yellow">📝</Text>
        <Text color="gray">
          {filePath ? `${filePath}:` : ''} {stats.added > 0 && `+${stats.added}`} {stats.removed > 0 && `-${stats.removed}`}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow">
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
        <Text bold color="yellow">
          📝 {toolName} Preview {filePath && `• ${filePath}`}
        </Text>
        <Text color="gray">
          +{stats.added} -{stats.removed}
        </Text>
      </Box>

      {/* Diff content */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {diffLines.length === 0 ? (
          <Text color="gray" dimColor>
            No changes detected
          </Text>
        ) : (
          diffLines.map((line, index) => {
            const color = getDiffLineColor(line.type);
            const prefix = getDiffLinePrefix(line.type);

            return (
              <Box key={index}>
                {showLineNumbers && line.lineNumber > 0 && (
                  <Text color="gray" dimColor>
                    {line.lineNumber.toString().padStart(4, ' ')}
                  </Text>
                )}
                <Text color={color}>
                  {prefix} {line.content}
                </Text>
              </Box>
            );
          })
        )}

        {diffLines.length >= maxLines && (
          <Text color="gray" dimColor marginTop={1}>
            ... (showing first {maxLines} lines)
          </Text>
        )}
      </Box>

      {/* Footer */}
      <Box paddingX={1} borderTop={true}>
        <Text color="gray" dimColor>
          Preview • Changes will be applied when confirmed
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Simple diff summary for inline display
 */
export interface DiffSummaryProps {
  /** Number of lines added */
  added: number;
  /** Number of lines removed */
  removed: number;
  /** Total lines in file */
  totalLines?: number;
  /** Display mode */
  displayMode?: DisplayMode;
}

export function DiffSummary({
  added,
  removed,
  totalLines,
  displayMode = 'normal',
}: DiffSummaryProps): React.ReactElement {
  const netChange = added - removed;
  const changePercentage = totalLines && totalLines > 0
    ? ((Math.abs(netChange) / totalLines) * 100).toFixed(1)
    : null;

  if (displayMode === 'compact') {
    return (
      <Box gap={1}>
        <Text color="yellow">📝</Text>
        {added > 0 && <Text color="green">+{added}</Text>}
        {removed > 0 && <Text color="red">-{removed}</Text>}
      </Box>
    );
  }

  return (
    <Box gap={2}>
      <Text color="yellow">📝 Changes:</Text>
      {added > 0 && (
        <Text color="green">+{added} added</Text>
      )}
      {removed > 0 && (
        <Text color="red">-{removed} removed</Text>
      )}
      {netChange !== 0 && (
        <Text color="gray">
          (net {netChange > 0 ? '+' : ''}{netChange})
        </Text>
      )}
      {changePercentage && (
        <Text color="gray">
          {changePercentage}% of file
        </Text>
      )}
    </Box>
  );
}

/**
 * File change preview for multiple files
 */
export interface FileChangePreviewProps {
  /** File changes to preview */
  changes: Array<{
    filePath: string;
    originalContent: string;
    modifiedContent: string;
    operation: 'create' | 'modify' | 'delete';
  }>;
  /** Tool performing the changes */
  toolName?: string;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Maximum number of files to show */
  maxFiles?: number;
}

export function FileChangePreview({
  changes,
  toolName = 'MultiEdit',
  displayMode = 'normal',
  maxFiles = 5,
}: FileChangePreviewProps): React.ReactElement {
  const displayChanges = changes.slice(0, maxFiles);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow">
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
        <Text bold color="yellow">
          📝 {toolName} Preview • {changes.length} files
        </Text>
      </Box>

      {/* File changes */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {displayChanges.map((change, index) => {
          const icon = change.operation === 'create' ? '➕' :
                      change.operation === 'delete' ? '🗑️' : '📝';
          const color = change.operation === 'create' ? 'green' :
                       change.operation === 'delete' ? 'red' : 'yellow';

          if (displayMode === 'compact') {
            return (
              <Box key={index} gap={1}>
                <Text color={color}>{icon}</Text>
                <Text color="white">{change.filePath}</Text>
                <Text color="gray">({change.operation})</Text>
              </Box>
            );
          }

          const diff = generateDiff(change.originalContent, change.modifiedContent, false);
          const added = diff.filter(line => line.type === 'added').length;
          const removed = diff.filter(line => line.type === 'removed').length;

          return (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Box gap={2}>
                <Text color={color}>{icon}</Text>
                <Text color="white" bold>{change.filePath}</Text>
                <Text color="gray">({change.operation})</Text>
                {added > 0 && <Text color="green">+{added}</Text>}
                {removed > 0 && <Text color="red">-{removed}</Text>}
              </Box>
            </Box>
          );
        })}

        {changes.length > maxFiles && (
          <Text color="gray" dimColor>
            ... and {changes.length - maxFiles} more files
          </Text>
        )}
      </Box>
    </Box>
  );
}

export default DiffPreview;