# ADR-003: Rich Diff Viewer Component Architecture

## Status
**Proposed**

## Date
2025-03-16

## Context

We need to implement a `DiffViewer` component for the APEX web-ui that provides:
1. **Syntax highlighting** for common programming languages
2. **Multiple view modes**: unified, split, and inline
3. **Line numbers** for easy code reference
4. **Copy functionality** for individual lines or entire diffs

### Requirements Analysis

**Functional Requirements:**
- Display file diffs with added/removed/modified line indicators
- Support unified view (single column, +/- prefixes)
- Support split view (side-by-side old/new files)
- Support inline view (mixed within single file context)
- Syntax highlighting for: JavaScript, TypeScript, Python, Go, Rust, JSON, YAML, Markdown, Shell
- Line numbers (clickable for selection)
- Copy button for selected lines or entire diff content
- Support large diffs with virtualization (future consideration)

**Non-Functional Requirements:**
- Accessible (WCAG 2.1 AA compliant)
- Responsive (works on mobile, tablet, desktop)
- Performant with diffs up to 10,000 lines
- Follows existing codebase patterns
- Dark/light theme support via CSS variables

### Existing Patterns Analysis

From the codebase analysis:
- Components use `'use client'` directive for client-side React
- Tailwind CSS with `cn()` utility for class composition
- CSS variables for theming (`--background`, `--foreground`, etc.)
- `forwardRef` pattern for component composition
- Lucide React for icons
- Vitest for testing with React Testing Library
- Index files for exports in component folders

### Syntax Highlighting Library Decision

**Options Considered:**

1. **Prism.js** (via `prismjs` or `react-prism`)
   - Pros: Lightweight (~10KB), many themes, extensible
   - Cons: Manual integration, separate CSS bundle needed

2. **Shiki** (via `shiki`)
   - Pros: VS Code-quality highlighting, accurate parsing, WASM-based
   - Cons: Larger bundle size (~800KB WASM), async loading required

3. **highlight.js** (via `highlight.js`)
   - Pros: Mature, good language support, ~30KB core
   - Cons: Less accurate than Shiki, limited theme control

4. **Custom CSS-based** (minimal, pattern-matching)
   - Pros: Zero dependencies, tiny bundle, full control
   - Cons: Less accurate highlighting, more maintenance

**Decision**: Use a **progressive approach** with custom CSS-based highlighting for MVP, with architecture allowing Prism.js upgrade in future releases.

**Rationale**:
- Current project has zero syntax highlighting dependencies
- Custom approach allows incremental enhancement
- Provides immediate value without large bundle impact
- Architecture will support future Prism.js integration via `highlighter` prop

## Decision

### 1. Component Structure

```
packages/web-ui/src/components/diff/
├── DiffViewer.tsx              # Main public component
├── DiffViewerUnified.tsx       # Unified view mode renderer
├── DiffViewerSplit.tsx         # Split view mode renderer
├── DiffViewerInline.tsx        # Inline view mode renderer
├── DiffLine.tsx                # Single line renderer with highlighting
├── DiffLineNumber.tsx          # Line number component
├── DiffCopyButton.tsx          # Copy functionality component
├── DiffModeSelector.tsx        # View mode toggle component
├── DiffHeader.tsx              # File header with metadata
├── hooks/
│   └── useDiffParser.ts        # Diff parsing and processing hook
├── utils/
│   ├── diff-parser.ts          # Diff parsing utilities
│   ├── syntax-highlighter.ts   # Syntax highlighting logic
│   └── language-detector.ts    # File extension to language mapping
├── types.ts                    # TypeScript type definitions
├── index.ts                    # Public exports
├── constants.ts                # Constants and default configs
└── __tests__/
    ├── DiffViewer.test.tsx
    ├── DiffViewer.integration.test.tsx
    ├── DiffViewer.accessibility.test.tsx
    ├── diff-parser.test.ts
    └── syntax-highlighter.test.ts
```

### 2. Core Type Definitions

```typescript
// types.ts

/**
 * View mode for diff display
 */
export type DiffViewMode = 'unified' | 'split' | 'inline'

/**
 * Type of change for a diff line
 */
export type DiffLineType = 'added' | 'removed' | 'unchanged' | 'header' | 'context'

/**
 * Programming language for syntax highlighting
 */
export type SupportedLanguage =
  | 'javascript' | 'typescript' | 'jsx' | 'tsx'
  | 'python' | 'go' | 'rust' | 'java'
  | 'json' | 'yaml' | 'markdown' | 'shell'
  | 'css' | 'html' | 'sql'
  | 'text' | 'unknown'

/**
 * Represents a single line in a diff
 */
export interface DiffLine {
  /** Line number in the old file (null for added lines) */
  oldLineNumber: number | null
  /** Line number in the new file (null for removed lines) */
  newLineNumber: number | null
  /** Type of change */
  type: DiffLineType
  /** Raw content of the line (without +/- prefix) */
  content: string
  /** Whether this line is selected */
  isSelected?: boolean
}

/**
 * Represents a chunk/hunk in a diff
 */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number
  /** Number of lines in old file section */
  oldLines: number
  /** Starting line in new file */
  newStart: number
  /** Number of lines in new file section */
  newLines: number
  /** Header text (e.g., @@ -1,4 +1,6 @@) */
  header: string
  /** Lines in this hunk */
  lines: DiffLine[]
}

/**
 * Represents a complete file diff
 */
export interface FileDiff {
  /** Original file path */
  oldPath: string
  /** New file path (may differ for renames) */
  newPath: string
  /** Whether this is a new file */
  isNew: boolean
  /** Whether this is a deleted file */
  isDeleted: boolean
  /** Whether this is a renamed file */
  isRenamed: boolean
  /** Whether this is a binary file */
  isBinary: boolean
  /** Detected language for highlighting */
  language: SupportedLanguage
  /** Hunks containing the actual changes */
  hunks: DiffHunk[]
}

/**
 * Configuration for syntax highlighting
 */
export interface HighlightConfig {
  /** Enable/disable highlighting */
  enabled: boolean
  /** Custom highlighter function (for future Prism.js integration) */
  highlighter?: (code: string, language: SupportedLanguage) => string
  /** Theme name (affects CSS class prefix) */
  theme?: 'dark' | 'light' | 'auto'
}

/**
 * Props for DiffViewer component
 */
export interface DiffViewerProps {
  /** Raw diff content (unified diff format) */
  diff: string
  /** File path(s) for language detection */
  filePath?: string
  /** Display mode */
  mode?: DiffViewMode
  /** Allow mode switching via UI */
  showModeSelector?: boolean
  /** Show line numbers */
  showLineNumbers?: boolean
  /** Enable syntax highlighting */
  highlighting?: boolean | HighlightConfig
  /** Show copy button */
  showCopyButton?: boolean
  /** Maximum height before scrolling */
  maxHeight?: number | string
  /** Callback when line is clicked */
  onLineClick?: (line: DiffLine, index: number) => void
  /** Callback when lines are selected */
  onSelectionChange?: (selectedLines: DiffLine[]) => void
  /** Callback when copy is triggered */
  onCopy?: (content: string) => void
  /** Additional class name */
  className?: string
  /** Loading state */
  loading?: boolean
  /** Error state */
  error?: string | null
  /** Custom empty state message */
  emptyMessage?: string
  /** File header visibility */
  showFileHeader?: boolean
  /** Expand/collapse hunks */
  collapsible?: boolean
  /** Initially collapsed */
  defaultCollapsed?: boolean
}

/**
 * Props for DiffLine component
 */
export interface DiffLineProps {
  line: DiffLine
  index: number
  language: SupportedLanguage
  showLineNumbers: boolean
  highlighting: boolean
  onClick?: (line: DiffLine, index: number) => void
  isSelected?: boolean
  className?: string
}

/**
 * Copy button props
 */
export interface DiffCopyButtonProps {
  content: string
  onCopy?: (content: string) => void
  className?: string
  variant?: 'icon' | 'text' | 'icon-text'
}
```

### 3. Main Component Architecture

```typescript
// DiffViewer.tsx
'use client'

import React, { useMemo, useCallback, useState, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useDiffParser } from './hooks/useDiffParser'
import { DiffViewerUnified } from './DiffViewerUnified'
import { DiffViewerSplit } from './DiffViewerSplit'
import { DiffViewerInline } from './DiffViewerInline'
import { DiffModeSelector } from './DiffModeSelector'
import { DiffCopyButton } from './DiffCopyButton'
import { DiffHeader } from './DiffHeader'
import { Spinner } from '@/components/ui/Spinner'
import type { DiffViewerProps, DiffViewMode, DiffLine } from './types'

export const DiffViewer = forwardRef<HTMLDivElement, DiffViewerProps>(
  ({
    diff,
    filePath,
    mode: initialMode = 'unified',
    showModeSelector = true,
    showLineNumbers = true,
    highlighting = true,
    showCopyButton = true,
    maxHeight = 600,
    onLineClick,
    onSelectionChange,
    onCopy,
    className,
    loading = false,
    error = null,
    emptyMessage = 'No changes to display',
    showFileHeader = true,
    collapsible = false,
    defaultCollapsed = false,
  }, ref) => {
    const [mode, setMode] = useState<DiffViewMode>(initialMode)
    const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())

    // Parse diff content
    const { fileDiff, parseError } = useDiffParser(diff, filePath)

    // Handle line selection
    const handleLineClick = useCallback((line: DiffLine, index: number) => {
      setSelectedLines(prev => {
        const next = new Set(prev)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
      onLineClick?.(line, index)
    }, [onLineClick])

    // Get selected lines content for copy
    const selectedContent = useMemo(() => {
      if (!fileDiff) return ''
      const lines = fileDiff.hunks.flatMap(h => h.lines)
      return Array.from(selectedLines)
        .sort((a, b) => a - b)
        .map(idx => lines[idx]?.content ?? '')
        .join('\n')
    }, [fileDiff, selectedLines])

    // Render appropriate view mode
    const ViewComponent = useMemo(() => {
      switch (mode) {
        case 'split': return DiffViewerSplit
        case 'inline': return DiffViewerInline
        default: return DiffViewerUnified
      }
    }, [mode])

    // Loading state
    if (loading) {
      return (
        <div className={cn('flex items-center justify-center p-8', className)}>
          <Spinner size="lg" />
        </div>
      )
    }

    // Error state
    if (error || parseError) {
      return (
        <div className={cn(
          'p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500',
          className
        )}>
          <p className="text-sm font-medium">Error loading diff</p>
          <p className="text-xs mt-1">{error || parseError}</p>
        </div>
      )
    }

    // Empty state
    if (!fileDiff || fileDiff.hunks.length === 0) {
      return (
        <div className={cn(
          'p-8 text-center text-foreground-secondary',
          className
        )}>
          <p>{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-border bg-background-secondary overflow-hidden',
          className
        )}
      >
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background-tertiary">
          {showFileHeader && (
            <DiffHeader
              oldPath={fileDiff.oldPath}
              newPath={fileDiff.newPath}
              isNew={fileDiff.isNew}
              isDeleted={fileDiff.isDeleted}
              isRenamed={fileDiff.isRenamed}
            />
          )}
          <div className="flex items-center gap-2">
            {showCopyButton && (
              <DiffCopyButton
                content={selectedLines.size > 0 ? selectedContent : diff}
                onCopy={onCopy}
                variant="icon"
              />
            )}
            {showModeSelector && (
              <DiffModeSelector
                value={mode}
                onChange={setMode}
              />
            )}
          </div>
        </div>

        {/* Diff content */}
        <div
          className="overflow-auto font-mono text-sm"
          style={{ maxHeight }}
        >
          <ViewComponent
            fileDiff={fileDiff}
            showLineNumbers={showLineNumbers}
            highlighting={typeof highlighting === 'boolean' ? highlighting : highlighting.enabled}
            highlightConfig={typeof highlighting === 'object' ? highlighting : undefined}
            selectedLines={selectedLines}
            onLineClick={handleLineClick}
            collapsible={collapsible}
            defaultCollapsed={defaultCollapsed}
          />
        </div>
      </div>
    )
  }
)

DiffViewer.displayName = 'DiffViewer'
```

### 4. Unified View Mode Implementation

```typescript
// DiffViewerUnified.tsx
'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { DiffLine } from './DiffLine'
import type { FileDiff, DiffLine as DiffLineType, HighlightConfig } from './types'

interface DiffViewerUnifiedProps {
  fileDiff: FileDiff
  showLineNumbers: boolean
  highlighting: boolean
  highlightConfig?: HighlightConfig
  selectedLines: Set<number>
  onLineClick: (line: DiffLineType, index: number) => void
  collapsible: boolean
  defaultCollapsed: boolean
}

export function DiffViewerUnified({
  fileDiff,
  showLineNumbers,
  highlighting,
  highlightConfig,
  selectedLines,
  onLineClick,
}: DiffViewerUnifiedProps) {
  let globalIndex = 0

  return (
    <div className="divide-y divide-border/50">
      {fileDiff.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk header */}
          <div className="px-4 py-1 bg-apex-500/10 text-apex-400 text-xs font-medium">
            {hunk.header}
          </div>

          {/* Lines */}
          <div>
            {hunk.lines.map((line, lineIndex) => {
              const index = globalIndex++
              return (
                <DiffLine
                  key={`${hunkIndex}-${lineIndex}`}
                  line={line}
                  index={index}
                  language={fileDiff.language}
                  showLineNumbers={showLineNumbers}
                  highlighting={highlighting}
                  onClick={onLineClick}
                  isSelected={selectedLines.has(index)}
                  mode="unified"
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 5. Split View Mode Implementation

```typescript
// DiffViewerSplit.tsx
'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { DiffLine } from './DiffLine'
import type { FileDiff, DiffLine as DiffLineType, HighlightConfig } from './types'

interface DiffViewerSplitProps {
  fileDiff: FileDiff
  showLineNumbers: boolean
  highlighting: boolean
  highlightConfig?: HighlightConfig
  selectedLines: Set<number>
  onLineClick: (line: DiffLineType, index: number) => void
  collapsible: boolean
  defaultCollapsed: boolean
}

export function DiffViewerSplit({
  fileDiff,
  showLineNumbers,
  highlighting,
  selectedLines,
  onLineClick,
}: DiffViewerSplitProps) {
  // Transform hunks into side-by-side pairs
  const pairs = React.useMemo(() => {
    const result: Array<{ left: DiffLineType | null; right: DiffLineType | null; leftIndex: number; rightIndex: number }> = []
    let leftIndex = 0
    let rightIndex = 0

    for (const hunk of fileDiff.hunks) {
      // Add hunk header as special pair
      result.push({
        left: { ...hunk.lines[0], type: 'header', content: hunk.header, oldLineNumber: null, newLineNumber: null },
        right: null,
        leftIndex: -1,
        rightIndex: -1,
      })

      for (const line of hunk.lines) {
        if (line.type === 'removed') {
          result.push({ left: line, right: null, leftIndex: leftIndex++, rightIndex: -1 })
        } else if (line.type === 'added') {
          // Try to pair with previous removed line
          const lastPair = result[result.length - 1]
          if (lastPair && lastPair.left && lastPair.right === null && lastPair.left.type === 'removed') {
            lastPair.right = line
            lastPair.rightIndex = rightIndex++
          } else {
            result.push({ left: null, right: line, leftIndex: -1, rightIndex: rightIndex++ })
          }
        } else {
          result.push({ left: line, right: line, leftIndex: leftIndex++, rightIndex: rightIndex++ })
        }
      }
    }

    return result
  }, [fileDiff.hunks])

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      {/* Left side (old) */}
      <div className="min-w-0">
        <div className="sticky top-0 px-2 py-1 bg-background-tertiary border-b border-border text-xs text-foreground-secondary">
          {fileDiff.oldPath}
        </div>
        <div>
          {pairs.map((pair, index) => (
            pair.left ? (
              <DiffLine
                key={`left-${index}`}
                line={pair.left}
                index={pair.leftIndex}
                language={fileDiff.language}
                showLineNumbers={showLineNumbers}
                highlighting={highlighting}
                onClick={pair.leftIndex >= 0 ? onLineClick : undefined}
                isSelected={pair.leftIndex >= 0 && selectedLines.has(pair.leftIndex)}
                mode="split-left"
              />
            ) : (
              <div key={`left-${index}`} className="h-6 bg-background-tertiary/50" />
            )
          ))}
        </div>
      </div>

      {/* Right side (new) */}
      <div className="min-w-0">
        <div className="sticky top-0 px-2 py-1 bg-background-tertiary border-b border-border text-xs text-foreground-secondary">
          {fileDiff.newPath}
        </div>
        <div>
          {pairs.map((pair, index) => (
            pair.right ? (
              <DiffLine
                key={`right-${index}`}
                line={pair.right}
                index={pair.rightIndex}
                language={fileDiff.language}
                showLineNumbers={showLineNumbers}
                highlighting={highlighting}
                onClick={pair.rightIndex >= 0 ? onLineClick : undefined}
                isSelected={pair.rightIndex >= 0 && selectedLines.has(pair.rightIndex)}
                mode="split-right"
              />
            ) : (
              <div key={`right-${index}`} className="h-6 bg-background-tertiary/50" />
            )
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 6. Single Line Component

```typescript
// DiffLine.tsx
'use client'

import React, { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { DiffLineNumber } from './DiffLineNumber'
import { highlightLine } from './utils/syntax-highlighter'
import type { DiffLineProps, DiffLineType } from './types'

const lineTypeStyles: Record<DiffLineType, string> = {
  added: 'bg-green-500/10 hover:bg-green-500/15',
  removed: 'bg-red-500/10 hover:bg-red-500/15',
  unchanged: 'bg-transparent hover:bg-background-tertiary/50',
  header: 'bg-apex-500/10 text-apex-400',
  context: 'bg-transparent hover:bg-background-tertiary/50',
}

const lineTypeIndicator: Record<DiffLineType, string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
  header: '@',
  context: ' ',
}

const lineTypeIndicatorColor: Record<DiffLineType, string> = {
  added: 'text-green-500',
  removed: 'text-red-500',
  unchanged: 'text-foreground-tertiary',
  header: 'text-apex-400',
  context: 'text-foreground-tertiary',
}

type DiffLineMode = 'unified' | 'split-left' | 'split-right' | 'inline'

export function DiffLine({
  line,
  index,
  language,
  showLineNumbers,
  highlighting,
  onClick,
  isSelected,
  className,
  mode = 'unified',
}: DiffLineProps & { mode?: DiffLineMode }) {
  const handleClick = useCallback(() => {
    onClick?.(line, index)
  }, [onClick, line, index])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  // Highlight content if enabled
  const highlightedContent = React.useMemo(() => {
    if (!highlighting || line.type === 'header') {
      return line.content
    }
    return highlightLine(line.content, language)
  }, [highlighting, line.content, line.type, language])

  return (
    <div
      role="row"
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={cn(
        'flex items-stretch text-sm leading-6 group',
        lineTypeStyles[line.type],
        isSelected && 'ring-2 ring-inset ring-apex-500',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Line numbers */}
      {showLineNumbers && mode !== 'split-left' && mode !== 'split-right' && (
        <>
          <DiffLineNumber
            number={line.oldLineNumber}
            type={line.type === 'added' ? 'empty' : 'normal'}
          />
          <DiffLineNumber
            number={line.newLineNumber}
            type={line.type === 'removed' ? 'empty' : 'normal'}
          />
        </>
      )}

      {/* Single line number for split view */}
      {showLineNumbers && (mode === 'split-left' || mode === 'split-right') && (
        <DiffLineNumber
          number={mode === 'split-left' ? line.oldLineNumber : line.newLineNumber}
          type="normal"
        />
      )}

      {/* Change indicator */}
      {mode === 'unified' && (
        <span className={cn(
          'w-5 flex-shrink-0 text-center select-none',
          lineTypeIndicatorColor[line.type]
        )}>
          {lineTypeIndicator[line.type]}
        </span>
      )}

      {/* Content */}
      <code
        className={cn(
          'flex-1 px-2 whitespace-pre overflow-x-auto',
          line.type === 'added' && 'text-green-300',
          line.type === 'removed' && 'text-red-300',
        )}
        dangerouslySetInnerHTML={
          highlighting && typeof highlightedContent === 'string' && highlightedContent !== line.content
            ? { __html: highlightedContent }
            : undefined
        }
      >
        {!(highlighting && typeof highlightedContent === 'string' && highlightedContent !== line.content) && line.content}
      </code>
    </div>
  )
}
```

### 7. Syntax Highlighting Strategy

```typescript
// utils/syntax-highlighter.ts

import type { SupportedLanguage } from '../types'

/**
 * Simple token-based syntax highlighter
 * Uses CSS classes for theming compatibility
 */

// Token patterns for common constructs
const TOKEN_PATTERNS: Array<{
  pattern: RegExp
  className: string
  languages?: SupportedLanguage[]
}> = [
  // Strings (double and single quoted)
  { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, className: 'diff-string' },

  // Comments (single line)
  { pattern: /\/\/.*$|#.*$/gm, className: 'diff-comment' },

  // Numbers
  { pattern: /\b\d+\.?\d*\b/g, className: 'diff-number' },

  // Keywords (JS/TS)
  {
    pattern: /\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|new|this|true|false|null|undefined|try|catch|throw)\b/g,
    className: 'diff-keyword',
    languages: ['javascript', 'typescript', 'jsx', 'tsx']
  },

  // Keywords (Python)
  {
    pattern: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|raise|with|as|True|False|None|and|or|not|in|is|lambda|yield|async|await)\b/g,
    className: 'diff-keyword',
    languages: ['python']
  },

  // Keywords (Go)
  {
    pattern: /\b(func|package|import|return|if|else|for|range|switch|case|type|struct|interface|var|const|go|defer|chan|select|make|new|true|false|nil)\b/g,
    className: 'diff-keyword',
    languages: ['go']
  },

  // Keywords (Rust)
  {
    pattern: /\b(fn|let|mut|const|pub|mod|use|struct|enum|impl|trait|match|if|else|for|while|loop|return|async|await|move|self|Self|true|false|None|Some)\b/g,
    className: 'diff-keyword',
    languages: ['rust']
  },

  // JSON keys
  {
    pattern: /"([^"]+)"(?=\s*:)/g,
    className: 'diff-property',
    languages: ['json']
  },

  // Function calls
  { pattern: /\b([a-zA-Z_]\w*)\s*\(/g, className: 'diff-function' },

  // Types (capitalized words in certain contexts)
  { pattern: /\b[A-Z][a-zA-Z0-9_]*\b/g, className: 'diff-type' },
]

/**
 * Apply syntax highlighting to a line of code
 */
export function highlightLine(content: string, language: SupportedLanguage): string {
  if (!content.trim() || language === 'text' || language === 'unknown') {
    return escapeHtml(content)
  }

  // Create token map for non-overlapping highlights
  const tokens: Array<{ start: number; end: number; className: string }> = []

  for (const { pattern, className, languages } of TOKEN_PATTERNS) {
    // Skip if pattern doesn't apply to this language
    if (languages && !languages.includes(language)) continue

    // Reset pattern state
    pattern.lastIndex = 0

    let match
    while ((match = pattern.exec(content)) !== null) {
      const start = match.index
      const end = start + match[0].length

      // Check for overlap with existing tokens
      const hasOverlap = tokens.some(
        t => (start >= t.start && start < t.end) || (end > t.start && end <= t.end)
      )

      if (!hasOverlap) {
        tokens.push({ start, end, className })
      }
    }
  }

  // Sort tokens by start position
  tokens.sort((a, b) => a.start - b.start)

  // Build highlighted string
  let result = ''
  let lastEnd = 0

  for (const token of tokens) {
    // Add unhighlighted content before this token
    if (token.start > lastEnd) {
      result += escapeHtml(content.slice(lastEnd, token.start))
    }

    // Add highlighted token
    result += `<span class="${token.className}">${escapeHtml(content.slice(token.start, token.end))}</span>`
    lastEnd = token.end
  }

  // Add remaining content
  if (lastEnd < content.length) {
    result += escapeHtml(content.slice(lastEnd))
  }

  return result
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

### 8. CSS Styles for Syntax Highlighting

```css
/* Add to globals.css */

/* Diff Viewer Syntax Highlighting */
.diff-keyword { color: #c792ea; }  /* Purple for keywords */
.diff-string { color: #c3e88d; }   /* Green for strings */
.diff-number { color: #f78c6c; }   /* Orange for numbers */
.diff-comment { color: #546e7a; }  /* Gray for comments */
.diff-function { color: #82aaff; } /* Blue for functions */
.diff-type { color: #ffcb6b; }     /* Yellow for types */
.diff-property { color: #89ddff; } /* Cyan for properties */

/* Light theme overrides */
.light .diff-keyword { color: #7c3aed; }
.light .diff-string { color: #16a34a; }
.light .diff-number { color: #ea580c; }
.light .diff-comment { color: #6b7280; }
.light .diff-function { color: #2563eb; }
.light .diff-type { color: #ca8a04; }
.light .diff-property { color: #0891b2; }
```

### 9. Diff Parser Hook

```typescript
// hooks/useDiffParser.ts
'use client'

import { useMemo } from 'react'
import { parseDiff } from '../utils/diff-parser'
import { detectLanguage } from '../utils/language-detector'
import type { FileDiff } from '../types'

interface UseDiffParserResult {
  fileDiff: FileDiff | null
  parseError: string | null
}

export function useDiffParser(diff: string, filePath?: string): UseDiffParserResult {
  return useMemo(() => {
    if (!diff || !diff.trim()) {
      return { fileDiff: null, parseError: null }
    }

    try {
      const parsed = parseDiff(diff)

      // Detect language from file path or diff header
      const path = filePath || parsed.newPath || parsed.oldPath
      const language = detectLanguage(path)

      return {
        fileDiff: { ...parsed, language },
        parseError: null,
      }
    } catch (error) {
      return {
        fileDiff: null,
        parseError: error instanceof Error ? error.message : 'Failed to parse diff',
      }
    }
  }, [diff, filePath])
}
```

### 10. Language Detection Utility

```typescript
// utils/language-detector.ts

import type { SupportedLanguage } from '../types'

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  // JavaScript/TypeScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',

  // Go
  '.go': 'go',

  // Rust
  '.rs': 'rust',

  // Java
  '.java': 'java',

  // Data formats
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',

  // Markup
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',

  // Styles
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',

  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',

  // SQL
  '.sql': 'sql',

  // Plain text
  '.txt': 'text',
}

/**
 * Detect programming language from file path
 */
export function detectLanguage(filePath?: string): SupportedLanguage {
  if (!filePath) return 'unknown'

  // Get file extension
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) return 'unknown'

  const ext = filePath.slice(lastDot).toLowerCase()
  return EXTENSION_MAP[ext] || 'unknown'
}
```

### 11. Diff Parser Utility

```typescript
// utils/diff-parser.ts

import type { FileDiff, DiffHunk, DiffLine, DiffLineType } from '../types'

/**
 * Parse unified diff format into structured FileDiff
 */
export function parseDiff(diff: string): Omit<FileDiff, 'language'> {
  const lines = diff.split('\n')

  let oldPath = ''
  let newPath = ''
  let isNew = false
  let isDeleted = false
  let isRenamed = false
  let isBinary = false
  const hunks: DiffHunk[] = []

  let currentHunk: DiffHunk | null = null
  let i = 0

  // Parse header
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('--- ')) {
      oldPath = line.slice(4).replace(/^a\//, '')
      if (oldPath === '/dev/null') isNew = true
    } else if (line.startsWith('+++ ')) {
      newPath = line.slice(4).replace(/^b\//, '')
      if (newPath === '/dev/null') isDeleted = true
    } else if (line.startsWith('rename from ')) {
      isRenamed = true
    } else if (line.startsWith('Binary files')) {
      isBinary = true
    } else if (line.startsWith('@@ ')) {
      // Start of hunk, break to hunk parsing
      break
    }

    i++
  }

  // Parse hunks
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('@@ ')) {
      // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (match) {
        // Save previous hunk
        if (currentHunk) {
          hunks.push(currentHunk)
        }

        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldLines: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newLines: parseInt(match[4] || '1', 10),
          header: line,
          lines: [],
        }
      }
    } else if (currentHunk) {
      // Parse diff line
      const type = getLineType(line)
      const content = type === 'unchanged' || type === 'context' ? line.slice(1) : line.slice(1)

      // Calculate line numbers
      let oldLineNumber: number | null = null
      let newLineNumber: number | null = null

      const lineCount = currentHunk.lines.length
      const unchangedBefore = currentHunk.lines.filter(l => l.type === 'unchanged' || l.type === 'context').length
      const removedBefore = currentHunk.lines.filter(l => l.type === 'removed').length
      const addedBefore = currentHunk.lines.filter(l => l.type === 'added').length

      if (type === 'removed' || type === 'unchanged' || type === 'context') {
        oldLineNumber = currentHunk.oldStart + unchangedBefore + removedBefore
      }
      if (type === 'added' || type === 'unchanged' || type === 'context') {
        newLineNumber = currentHunk.newStart + unchangedBefore + addedBefore
      }

      currentHunk.lines.push({
        oldLineNumber,
        newLineNumber,
        type,
        content,
      })
    }

    i++
  }

  // Save last hunk
  if (currentHunk) {
    hunks.push(currentHunk)
  }

  return {
    oldPath: oldPath || 'unknown',
    newPath: newPath || 'unknown',
    isNew,
    isDeleted,
    isRenamed,
    isBinary,
    hunks,
  }
}

function getLineType(line: string): DiffLineType {
  if (line.startsWith('+')) return 'added'
  if (line.startsWith('-')) return 'removed'
  if (line.startsWith(' ')) return 'unchanged'
  if (line.startsWith('@@')) return 'header'
  return 'context'
}
```

### 12. Copy Button Component

```typescript
// DiffCopyButton.tsx
'use client'

import React, { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffCopyButtonProps } from './types'

export function DiffCopyButton({
  content,
  onCopy,
  className,
  variant = 'icon',
}: DiffCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      onCopy?.(content)

      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [content, onCopy])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm',
        'text-foreground-secondary hover:text-foreground',
        'hover:bg-background-tertiary transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-apex-500',
        className
      )}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-500" />
          {variant !== 'icon' && <span>Copied!</span>}
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          {variant !== 'icon' && <span>Copy</span>}
        </>
      )}
    </button>
  )
}
```

### 13. Mode Selector Component

```typescript
// DiffModeSelector.tsx
'use client'

import React from 'react'
import { AlignLeft, Columns2, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffViewMode } from './types'

interface DiffModeSelectorProps {
  value: DiffViewMode
  onChange: (mode: DiffViewMode) => void
  className?: string
}

const modes: Array<{ value: DiffViewMode; icon: typeof AlignLeft; label: string }> = [
  { value: 'unified', icon: AlignLeft, label: 'Unified' },
  { value: 'split', icon: Columns2, label: 'Split' },
  { value: 'inline', icon: Rows3, label: 'Inline' },
]

export function DiffModeSelector({ value, onChange, className }: DiffModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Diff view mode"
      className={cn(
        'inline-flex rounded-md border border-border overflow-hidden',
        className
      )}
    >
      {modes.map(({ value: mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'px-2 py-1 text-xs flex items-center gap-1 transition-colors',
            'border-r border-border last:border-r-0',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-apex-500',
            value === mode
              ? 'bg-apex-600 text-white'
              : 'bg-background-tertiary hover:bg-background-secondary text-foreground-secondary'
          )}
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
```

### 14. Index File (Public API)

```typescript
// index.ts

export { DiffViewer } from './DiffViewer'
export { DiffCopyButton } from './DiffCopyButton'
export { DiffModeSelector } from './DiffModeSelector'
export { DiffHeader } from './DiffHeader'

// Hooks
export { useDiffParser } from './hooks/useDiffParser'

// Utilities
export { parseDiff } from './utils/diff-parser'
export { detectLanguage } from './utils/language-detector'
export { highlightLine } from './utils/syntax-highlighter'

// Types
export type {
  DiffViewMode,
  DiffLineType,
  SupportedLanguage,
  DiffLine,
  DiffHunk,
  FileDiff,
  HighlightConfig,
  DiffViewerProps,
  DiffLineProps,
  DiffCopyButtonProps,
} from './types'
```

## Consequences

### Positive

1. **Zero new dependencies** for MVP - custom syntax highlighting keeps bundle small
2. **Flexible architecture** - supports future Prism.js integration via `highlighter` prop
3. **Consistent with codebase** - follows established patterns (forwardRef, cn, Tailwind)
4. **Accessible** - ARIA attributes, keyboard navigation, proper roles
5. **Theme-aware** - uses CSS variables for dark/light mode
6. **Type-safe** - comprehensive TypeScript definitions
7. **Testable** - clear separation of concerns, isolated utilities

### Negative

1. **Custom highlighter limitations** - not as accurate as Prism/Shiki
2. **Maintenance burden** - syntax patterns need manual updates for new languages
3. **Split view complexity** - pairing algorithm may have edge cases

### Risks

1. **Performance with large diffs** - no virtualization in MVP
   - Mitigation: Add `maxHeight` prop with overflow scroll; virtualization in v2

2. **Regex-based highlighting issues** - may highlight incorrectly in edge cases
   - Mitigation: Architecture allows swapping in Prism.js via `highlighter` prop

3. **Binary file handling** - currently shows empty/error state
   - Mitigation: Show "Binary file changed" message; future image diff support

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `/components/diff/` directory structure
- [ ] Implement `types.ts` with all type definitions
- [ ] Implement `constants.ts` with defaults
- [ ] Implement `utils/language-detector.ts`
- [ ] Implement `utils/diff-parser.ts`
- [ ] Implement `utils/syntax-highlighter.ts`
- [ ] Write tests for utilities

### Phase 2: Core Components
- [ ] Implement `DiffLineNumber.tsx`
- [ ] Implement `DiffLine.tsx`
- [ ] Implement `DiffCopyButton.tsx`
- [ ] Implement `DiffModeSelector.tsx`
- [ ] Implement `DiffHeader.tsx`
- [ ] Implement `hooks/useDiffParser.ts`
- [ ] Write component tests

### Phase 3: View Modes
- [ ] Implement `DiffViewerUnified.tsx`
- [ ] Implement `DiffViewerSplit.tsx`
- [ ] Implement `DiffViewerInline.tsx`
- [ ] Implement main `DiffViewer.tsx`
- [ ] Write integration tests

### Phase 4: Styling & Polish
- [ ] Add CSS for syntax highlighting to `globals.css`
- [ ] Add responsive breakpoint handling
- [ ] Test dark/light themes
- [ ] Accessibility audit
- [ ] Write accessibility tests

### Phase 5: Export & Documentation
- [ ] Create `index.ts` with public exports
- [ ] Update `@/components/ui/index.ts` or create new entry
- [ ] Write usage documentation
- [ ] Create example component

## Testing Strategy

```typescript
// __tests__/DiffViewer.test.tsx

describe('DiffViewer', () => {
  describe('Rendering', () => {
    it('renders empty state when no diff provided')
    it('renders loading state when loading prop is true')
    it('renders error state when error prop is set')
    it('renders parse error when diff is invalid')
    it('renders unified view by default')
  })

  describe('View Modes', () => {
    it('switches to split view when mode selector clicked')
    it('switches to inline view when mode selector clicked')
    it('preserves selection when switching modes')
  })

  describe('Line Selection', () => {
    it('selects line on click')
    it('deselects line on second click')
    it('calls onLineClick callback')
    it('calls onSelectionChange with selected lines')
  })

  describe('Copy Functionality', () => {
    it('copies entire diff when no lines selected')
    it('copies selected lines when lines selected')
    it('calls onCopy callback')
    it('shows success feedback')
  })

  describe('Syntax Highlighting', () => {
    it('highlights JavaScript keywords')
    it('highlights strings')
    it('highlights comments')
    it('applies correct language from file path')
    it('disables highlighting when prop is false')
  })
})

describe('diff-parser', () => {
  it('parses standard unified diff')
  it('parses new file diff')
  it('parses deleted file diff')
  it('parses renamed file diff')
  it('handles binary files')
  it('calculates correct line numbers')
})

describe('syntax-highlighter', () => {
  it('escapes HTML in content')
  it('highlights keywords for each language')
  it('does not create overlapping spans')
  it('returns plain text for unknown language')
})
```

## Performance Considerations

| Scenario | Lines | Target Render | Strategy |
|----------|-------|---------------|----------|
| Small diff | < 100 | < 16ms | Direct render |
| Medium diff | 100-1000 | < 50ms | Memoized parsing |
| Large diff | 1000-5000 | < 200ms | Chunked rendering |
| Very large | > 5000 | < 500ms | Virtualization (v2) |

## Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| Mobile (< 640px) | Unified mode only, hide mode selector, compact line numbers |
| Tablet (640-1024px) | All modes, mode selector icons only |
| Desktop (> 1024px) | Full layout with labels |

## Future Enhancements (v2)

1. **Virtualization** - react-window for very large diffs
2. **Prism.js integration** - via `highlighter` prop
3. **Word-level diff** - highlight changed characters within lines
4. **Image diff** - support for image file comparisons
5. **Collapsible hunks** - expand/collapse individual sections
6. **Persistent preferences** - remember user's preferred view mode
7. **Keyboard navigation** - j/k to move between hunks
8. **Search within diff** - find and highlight matches

## References

- Existing patterns: `ThoughtDisplay.tsx`, `LogViewer.tsx`, `Button.tsx`
- Type definitions reference: `types/agent-utilization.ts`
- Testing patterns: `__tests__/ThoughtDisplay.test.tsx`
- Styling guide: `tailwind.config.js`, `globals.css`
