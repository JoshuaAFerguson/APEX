import React from 'react';
import { Box, Text } from 'ink';
import { diffLines, diffChars, type Change } from 'diff';
import fastDiff from 'fast-diff';

export interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  filename?: string;
  mode?: 'unified' | 'split' | 'inline';
  context?: number;
  showLineNumbers?: boolean;
  width?: number;
  maxLines?: number;
}

/**
 * Comprehensive diff viewer with multiple display modes
 */
export function DiffViewer({
  oldContent,
  newContent,
  filename,
  mode = 'unified',
  context = 3,
  showLineNumbers = true,
  width = 120,
  maxLines,
}: DiffViewerProps): React.ReactElement {
  switch (mode) {
    case 'split':
      return (
        <SplitDiffViewer
          oldContent={oldContent}
          newContent={newContent}
          filename={filename}
          context={context}
          showLineNumbers={showLineNumbers}
          width={width}
          maxLines={maxLines}
        />
      );
    case 'inline':
      return (
        <InlineDiffViewer
          oldContent={oldContent}
          newContent={newContent}
          filename={filename}
          context={context}
          showLineNumbers={showLineNumbers}
          width={width}
          maxLines={maxLines}
        />
      );
    default:
      return (
        <UnifiedDiffViewer
          oldContent={oldContent}
          newContent={newContent}
          filename={filename}
          context={context}
          showLineNumbers={showLineNumbers}
          width={width}
          maxLines={maxLines}
        />
      );
  }
}

/**
 * Unified diff view (traditional git diff style)
 */
function UnifiedDiffViewer({
  oldContent,
  newContent,
  filename,
  context,
  showLineNumbers,
  width,
  maxLines,
}: Omit<DiffViewerProps, 'mode'>): React.ReactElement {
  const diff = diffLines(oldContent, newContent);
  const hunks = createHunks(diff, context!);

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="white" bold>
          {filename ? `--- ${filename}` : '--- a/file'}
        </Text>
      </Box>
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="white" bold>
          {filename ? `+++ ${filename}` : '+++ b/file'}
        </Text>
      </Box>

      {/* Hunks */}
      {hunks.map((hunk, hunkIndex) => (
        <Box key={hunkIndex} flexDirection="column">
          {/* Hunk header */}
          <Text color="cyan" bold>
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
          </Text>

          {/* Hunk content */}
          {hunk.lines.map((line, lineIndex) => {
            if (maxLines && hunkIndex * 100 + lineIndex >= maxLines) return null;

            return (
              <Box key={lineIndex}>
                {showLineNumbers && (
                  <Box width={8} justifyContent="flex-end" marginRight={1}>
                    <Text color="gray" dimColor>
                      {line.oldLineNumber !== undefined
                        ? line.oldLineNumber.toString().padStart(3, ' ')
                        : '   '}
                    </Text>
                    <Text color="gray" dimColor>
                      {line.newLineNumber !== undefined
                        ? line.newLineNumber.toString().padStart(3, ' ')
                        : '   '}
                    </Text>
                  </Box>
                )}

                <Text
                  color={
                    line.type === 'added'
                      ? 'green'
                      : line.type === 'removed'
                      ? 'red'
                      : 'white'
                  }
                  backgroundColor={
                    line.type === 'added'
                      ? 'greenBright'
                      : line.type === 'removed'
                      ? 'redBright'
                      : undefined
                  }
                >
                  {line.type === 'added'
                    ? '+'
                    : line.type === 'removed'
                    ? '-'
                    : ' '}
                  {line.content}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {maxLines && getTotalLines(hunks) > maxLines && (
        <Text color="gray" italic>
          ... {getTotalLines(hunks) - maxLines} more lines
        </Text>
      )}
    </Box>
  );
}

/**
 * Split diff view (side-by-side)
 */
function SplitDiffViewer({
  oldContent,
  newContent,
  filename,
  context,
  showLineNumbers,
  width,
  maxLines,
}: Omit<DiffViewerProps, 'mode'>): React.ReactElement {
  const diff = diffLines(oldContent, newContent);
  const hunks = createHunks(diff, context!);
  const halfWidth = Math.floor((width! - 4) / 2);

  return (
    <Box flexDirection="column" width={width}>
      {/* Headers */}
      <Box>
        <Box width={halfWidth} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="red" bold>
            {filename ? `--- ${filename}` : '--- a/file'}
          </Text>
        </Box>
        <Box width={2} />
        <Box width={halfWidth} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="green" bold>
            {filename ? `+++ ${filename}` : '+++ b/file'}
          </Text>
        </Box>
      </Box>

      {/* Content */}
      {hunks.map((hunk, hunkIndex) => (
        <Box key={hunkIndex} flexDirection="column">
          {/* Hunk header */}
          <Text color="cyan" bold>
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
          </Text>

          {/* Split content */}
          {hunk.lines.map((line, lineIndex) => {
            if (maxLines && hunkIndex * 100 + lineIndex >= maxLines) return null;

            return (
              <Box key={lineIndex}>
                {/* Old content */}
                <Box width={halfWidth}>
                  {showLineNumbers && (
                    <Text color="gray" dimColor>
                      {line.oldLineNumber !== undefined
                        ? line.oldLineNumber.toString().padStart(3, ' ')
                        : '   '} │
                    </Text>
                  )}
                  <Text
                    color={line.type === 'removed' ? 'red' : 'white'}
                    backgroundColor={line.type === 'removed' ? 'redBright' : undefined}
                  >
                    {line.type !== 'added' ? line.content : ''}
                  </Text>
                </Box>

                <Box width={2} />

                {/* New content */}
                <Box width={halfWidth}>
                  {showLineNumbers && (
                    <Text color="gray" dimColor>
                      {line.newLineNumber !== undefined
                        ? line.newLineNumber.toString().padStart(3, ' ')
                        : '   '} │
                    </Text>
                  )}
                  <Text
                    color={line.type === 'added' ? 'green' : 'white'}
                    backgroundColor={line.type === 'added' ? 'greenBright' : undefined}
                  >
                    {line.type !== 'removed' ? line.content : ''}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Inline diff view with character-level highlighting
 */
function InlineDiffViewer({
  oldContent,
  newContent,
  filename,
  showLineNumbers,
  width,
  maxLines,
}: Omit<DiffViewerProps, 'mode'>): React.ReactElement {
  const charDiff = diffChars(oldContent, newContent);

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      {filename && (
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="white" bold>
            {filename}
          </Text>
        </Box>
      )}

      {/* Character-level diff */}
      <Box flexWrap="wrap">
        {charDiff.map((part, index) => {
          if (maxLines && index >= maxLines) return null;

          return (
            <Text
              key={index}
              color={
                part.added ? 'green' : part.removed ? 'red' : 'white'
              }
              backgroundColor={
                part.added ? 'greenBright' : part.removed ? 'redBright' : undefined
              }
            >
              {part.value}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

// Helper types and functions
interface HunkLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: HunkLine[];
}

function createHunks(diff: Change[], context: number): Hunk[] {
  const hunks: Hunk[] = [];
  const lines: HunkLine[] = [];

  let oldLineNumber = 1;
  let newLineNumber = 1;

  // Convert diff to lines with line numbers
  diff.forEach(change => {
    const content = change.value.replace(/\n$/, ''); // Remove trailing newline
    const changeLines = content.split('\n');

    changeLines.forEach(line => {
      if (change.added) {
        lines.push({
          type: 'added',
          content: line,
          newLineNumber: newLineNumber++,
        });
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: line,
          oldLineNumber: oldLineNumber++,
        });
      } else {
        lines.push({
          type: 'context',
          content: line,
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++,
        });
      }
    });
  });

  // Group lines into hunks
  let currentHunk: HunkLine[] = [];
  let hunkOldStart = 1;
  let hunkNewStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.type !== 'context' || currentHunk.length > 0) {
      if (currentHunk.length === 0) {
        hunkOldStart = line.oldLineNumber || 1;
        hunkNewStart = line.newLineNumber || 1;
      }
      currentHunk.push(line);
    }

    // Check if we should end the hunk
    if (line.type === 'context' && currentHunk.length > 0) {
      let contextAfter = 0;
      for (let j = i + 1; j < lines.length && j < i + context + 1; j++) {
        if (lines[j].type === 'context') {
          contextAfter++;
        } else {
          break;
        }
      }

      if (contextAfter >= context) {
        // End the hunk
        hunks.push({
          oldStart: hunkOldStart,
          newStart: hunkNewStart,
          oldCount: currentHunk.filter(l => l.oldLineNumber !== undefined).length,
          newCount: currentHunk.filter(l => l.newLineNumber !== undefined).length,
          lines: currentHunk,
        });
        currentHunk = [];
      }
    }
  }

  // Add the last hunk if it exists
  if (currentHunk.length > 0) {
    hunks.push({
      oldStart: hunkOldStart,
      newStart: hunkNewStart,
      oldCount: currentHunk.filter(l => l.oldLineNumber !== undefined).length,
      newCount: currentHunk.filter(l => l.newLineNumber !== undefined).length,
      lines: currentHunk,
    });
  }

  return hunks;
}

function getTotalLines(hunks: Hunk[]): number {
  return hunks.reduce((total, hunk) => total + hunk.lines.length, 0);
}

export default DiffViewer;