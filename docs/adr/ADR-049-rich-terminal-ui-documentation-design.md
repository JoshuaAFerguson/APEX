# ADR-049: Rich Terminal UI Documentation - Technical Design

## Status
Proposed (Architecture Stage)

## Date
2024-12-19

## Context

This document provides the **technical architecture design** for documenting the Rich Terminal UI section in `getting-started.md`. The task is to add comprehensive documentation covering all 8 UI framework features that power APEX's terminal interface.

## Executive Summary

The APEX CLI uses a sophisticated terminal UI framework built on Ink (React for CLIs) with 8 core features that enhance developer experience. This ADR defines the structure, content, and placement of documentation for these features.

## The 8 UI Framework Features

Based on codebase analysis, here are the 8 features requiring documentation:

| # | Feature | Primary Components | Key Files |
|---|---------|-------------------|-----------|
| 1 | Ink-based Rendering | React components, Box, Text | `packages/cli/src/ui/App.tsx`, all components |
| 2 | Streaming Text | StreamingText, StreamingResponse, TypewriterText | `StreamingText.tsx` |
| 3 | Markdown Rendering | MarkdownRenderer, SimpleMarkdownRenderer | `MarkdownRenderer.tsx` |
| 4 | Syntax Highlighting | SyntaxHighlighter, SimpleSyntaxHighlighter | `SyntaxHighlighter.tsx` |
| 5 | Diff Views | DiffViewer (unified, split, inline modes) | `DiffViewer.tsx` |
| 6 | Responsive Layouts | useStdoutDimensions, 4-tier breakpoints | `useStdoutDimensions.ts` |
| 7 | Theme Support | ThemeProvider, dark/light themes, agent colors | `themes/`, `ThemeContext.tsx` |
| 8 | Progress Indicators | ProgressBar, CircularProgress, Spinner, StepProgress | `ProgressIndicators.tsx` |

---

## Technical Design: Documentation Structure

### 1. Section Placement in getting-started.md

The Rich Terminal UI section should be placed **after the "Terminal Interface (v0.3.0)" section** and **before "Session Management Basics"** to maintain logical flow:

```
## Terminal Interface (v0.3.0)        ← Existing section (lines 126-220)
    ### Progress Indicators
    ### Display Modes ✨ NEW
    ### Input Preview ✨ NEW
    ### Interactive Controls
    ### Color-coded Output

## Rich Terminal UI Framework        ← NEW SECTION (insert here)
    ### Ink-based Rendering
    ### Streaming & Real-time Updates
    ### Markdown Rendering
    ### Syntax Highlighting
    ### Diff Views
    ### Responsive Layouts
    ### Theme Support
    ### Progress Indicators

## Session Management Basics          ← Existing section (lines 222+)
```

### 2. Section Content Architecture

#### 2.1 Section Header

```markdown
## Rich Terminal UI Framework

APEX's terminal interface is built on a modern React-based framework designed for exceptional developer experience. This section covers the 8 core UI capabilities that power the interactive CLI.
```

#### 2.2 Feature 1: Ink-based Rendering

**Content Requirements:**
- Explain Ink as "React for CLIs"
- Highlight component-based architecture
- Mention key components (Box, Text, useInput)

**Example to Include:**
```
Components render as a tree, just like React DOM:
┌─ App ─────────────────────────────────┐
│ ├─ Banner                             │
│ ├─ StatusBar                          │
│ ├─ TaskProgress                       │
│ ├─ AgentPanel                         │
│ └─ InputPrompt                        │
└───────────────────────────────────────┘
```

#### 2.3 Feature 2: Streaming & Real-time Updates

**Content Requirements:**
- Explain character-by-character streaming
- Cursor effects and typewriter animation
- Real-time response display

**Example to Include:**
```
Streaming output with live cursor:
┌──────────────────────────────────────┐
│ The agent is analyzing your code...▊ │
└──────────────────────────────────────┘
```

#### 2.4 Feature 3: Markdown Rendering

**Content Requirements:**
- Headers with color formatting
- Lists (bullet and numbered)
- Code blocks and inline code
- Blockquotes

**Example to Include:**
```
Markdown renders with full formatting:
# Header 1                    (cyan, bold)
## Header 2                   (blue, bold)
• Bullet points              (yellow bullets)
1. Numbered lists            (yellow numbers)
> Blockquotes               (gray with │ prefix)
`inline code`               (highlighted background)
```

#### 2.5 Feature 4: Syntax Highlighting

**Content Requirements:**
- Supported languages (TypeScript, JavaScript, Python, Rust, Go)
- Keyword, string, comment highlighting
- Line numbers
- Line wrapping for narrow terminals

**Example to Include:**
```
┌─ typescript ────────── 5 lines ──┐
│  1 │ const greeting = "Hello";   │
│  2 │ function sayHello() {       │
│  3 │   // This is a comment      │
│  4 │   console.log(greeting);    │
│  5 │ }                           │
└──────────────────────────────────┘
```

#### 2.6 Feature 5: Diff Views

**Content Requirements:**
- Three modes: unified, split, inline
- Auto mode adapts to terminal width
- Color-coded additions/deletions
- Line numbers and hunk headers

**Example to Include:**
```
Unified diff view:
--- src/api.ts
+++ src/api.ts
@@ -1,3 +1,4 @@
   import express from 'express';
+  import cors from 'cors';        ← added (green)
   const app = express();
-  app.listen(3000);               ← removed (red)
+  app.listen(process.env.PORT);   ← added (green)
```

#### 2.7 Feature 6: Responsive Layouts

**Content Requirements:**
- 4-tier breakpoint system
- Width thresholds (60, 100, 160 columns)
- Component adaptation behavior
- useStdoutDimensions hook

**Example to Include:**
```
Breakpoint System:
┌────────────────────────────────────────────────────────────┐
│  Narrow   │  Compact  │   Normal   │        Wide          │
│  < 60     │  60-99    │  100-159   │       160+           │
│  cols     │  cols     │   cols     │       cols           │
├───────────┼───────────┼────────────┼──────────────────────┤
│ Minimal   │ Condensed │ Standard   │ Full with extras     │
│ UI only   │ display   │ display    │ split diffs, etc.    │
└────────────────────────────────────────────────────────────┘
```

#### 2.8 Feature 7: Theme Support

**Content Requirements:**
- Dark/light theme options
- Agent-specific colors
- Syntax highlighting colors
- Color scheme table

**Example to Include:**
```
Agent Colors (Dark Theme):
  🟡 planner    - Yellow
  🔵 architect  - Blue
  🟢 developer  - Green
  🟣 reviewer   - Magenta
  🔵 tester     - Cyan
  🔴 devops     - Red
```

#### 2.9 Feature 8: Progress Indicators

**Content Requirements:**
- Progress bars with animation
- Circular progress and spinners
- Step progress for workflows
- Multi-task progress views

**Example to Include:**
```
Progress indicators:
[■■■■■■■░░░] 70%            ← Progress bar
◐ Loading...                 ← Spinner
Step 2 of 4: implementation  ← Step progress
```

---

## Implementation Details

### 3.1 Target Line Position

Insert after line 220 (end of "Color-coded Output" section) in `getting-started.md`.

### 3.2 Estimated Section Length

Approximately 120-150 lines of markdown, including:
- Main section header and intro: ~5 lines
- Each of 8 features: ~12-15 lines each (description + example)
- Total: ~100-130 lines of content

### 3.3 Cross-References to Add

The section should include links to:
- Component source files for developers
- Related ADRs for implementation details
- v0.3.0 features documentation

### 3.4 Markdown Formatting Guidelines

- Use `###` for feature subsections
- Include visual ASCII examples in fenced code blocks
- Use tables for structured information
- Keep descriptions concise (2-3 sentences per feature)

---

## Acceptance Criteria Verification

The documentation must cover all 8 features with:

| Feature | Requirement | Verification |
|---------|-------------|--------------|
| Ink-based Rendering | Description + component tree example | ☐ |
| Streaming Text | Cursor/typewriter description + example | ☐ |
| Markdown Rendering | Format types + visual example | ☐ |
| Syntax Highlighting | Language support + code example | ☐ |
| Diff Views | 3 modes + unified diff example | ☐ |
| Responsive Layouts | 4-tier breakpoints + table | ☐ |
| Theme Support | Dark/light + agent colors | ☐ |
| Progress Indicators | Types + visual examples | ☐ |

---

## File Changes Required

| File | Change | Priority |
|------|--------|----------|
| `docs/getting-started.md` | Add Rich Terminal UI section after line 220 | High |

---

## Notes for Developer Stage

1. **Insert Location**: After line 220 (Color-coded Output section), before line 222 (Session Management Basics)

2. **Section ID**: Use `## Rich Terminal UI Framework` as the main heading

3. **ASCII Examples**: All visual examples should work in monospace terminals and be wrapped in triple backtick code blocks

4. **Keep Consistent Style**: Match the existing documentation style in getting-started.md (emoji usage, heading levels, code block formatting)

5. **Avoid Over-Documentation**: This is a getting-started guide, not API reference - keep examples brief and focused on user value

---

## References

- Ink documentation: https://github.com/vadimdemedes/ink
- `packages/cli/src/ui/components/` - All UI components
- `packages/cli/src/ui/hooks/useStdoutDimensions.ts` - Responsive system
- `packages/cli/src/ui/themes/` - Theme definitions
- ADR-030, ADR-031 - v0.3.0 feature architecture
