# ADR-050: Input Experience Documentation Enhancement Architecture

## Status
Proposed

## Context

The APEX v0.3.0 release includes a complete Input Experience feature set with 6 core capabilities marked as complete in ROADMAP.md:

1. **Tab completion** ✅ - CompletionEngine.ts + AdvancedInput.tsx
2. **History navigation** ✅ - Up/down arrows in AdvancedInput.tsx
3. **History search (Ctrl+R)** ✅ - ShortcutManager.ts + AdvancedInput.tsx
4. **Multi-line input (Shift+Enter)** ✅ - AdvancedInput.tsx multiline support
5. **Inline editing** ✅ - Cursor-based editing in AdvancedInput.tsx
6. **Input preview** ✅ - Full documentation at docs/user-guide/input-preview.md

**Problem**: The Input Experience section in `docs/features/v030-features.md` (Section 7, lines 1259-1304) is currently incomplete:
- Only covers 3 of 6 features with minimal examples
- Missing comprehensive documentation for History Search (Ctrl+R)
- Missing detailed Multi-line Input (Shift+Enter) documentation
- Missing Inline Editing documentation
- Keyboard shortcuts scattered across documents

**Task**: Enhance the Input Experience section to document all 6 input features with keyboard shortcuts according to acceptance criteria.

## Analysis of Existing Implementation

### 1. AdvancedInput Component (`packages/cli/src/ui/components/AdvancedInput.tsx`)

The AdvancedInput component is the core input handler with the following capabilities:

```typescript
export interface AdvancedInputProps {
  placeholder?: string;
  prompt?: string;
  value?: string;
  onSubmit?: (input: string) => void;
  onChange?: (input: string) => void;
  onCancel?: () => void;
  history?: string[];           // Command history array
  suggestions?: Suggestion[];   // Static suggestions
  multiline?: boolean;          // Enable multi-line mode
  showSuggestions?: boolean;
  autoComplete?: boolean;       // Tab completion
  searchHistory?: boolean;      // Ctrl+R search
  completionEngine?: CompletionEngine;
  debounceMs?: number;          // Completion debounce
}
```

**Implemented Features:**

| Feature | Implementation | Keyboard Trigger |
|---------|----------------|------------------|
| Tab completion | `CompletionEngine.getCompletions()` + fuzzy search | `Tab` |
| History navigation | `historyIndex` state, up/down handlers | `↑`/`↓` |
| History search | `isHistoryMode` state, `historyFuse.search()` | `Ctrl+R` |
| Multi-line input | `isMultilineMode` state, line management | `Shift+Enter` |
| Inline editing | `cursorPosition` state, left/right handlers | `←`/`→`, `Backspace` |
| Line clearing | Reset handlers | `Ctrl+L`, `Ctrl+U` |
| Word deletion | Delete word handler | `Ctrl+W` |

### 2. ShortcutManager (`packages/cli/src/services/ShortcutManager.ts`)

The ShortcutManager defines all keyboard shortcuts with context awareness:

```typescript
// Input context shortcuts
{id: 'historySearch', keys: {key: 'r', ctrl: true}, context: 'input'},
{id: 'previousHistory', keys: {key: 'p', ctrl: true}, context: 'input'},
{id: 'nextHistory', keys: {key: 'n', ctrl: true}, context: 'input'},
{id: 'complete', keys: {key: 'Tab'}, context: 'input'},
{id: 'newline', keys: {key: 'Enter', shift: true}, context: 'input'},
{id: 'clearLine', keys: {key: 'u', ctrl: true}, context: 'input'},
{id: 'deleteWord', keys: {key: 'w', ctrl: true}, context: 'input'},
{id: 'beginningOfLine', keys: {key: 'a', ctrl: true}, context: 'input'},
{id: 'endOfLine', keys: {key: 'e', ctrl: true}, context: 'input'},
```

### 3. CompletionEngine (`packages/cli/src/services/CompletionEngine.ts`)

Provides intelligent completion with:
- Command completion (`/status`, `/help`, etc.)
- File path completion (glob-based)
- Agent name completion
- Workflow name completion
- Fuzzy search using Fuse.js

## Decision

### Documentation Structure

The enhanced Input Experience documentation will be structured as follows:

```markdown
### 7. Enhanced Input Experience

#### Overview
Brief introduction to the input system capabilities

#### 7.1 Tab Completion
- Visual examples of command, file, agent, workflow completion
- Fuzzy search demonstration
- CompletionEngine integration details

#### 7.2 History Navigation
- Up/down arrow navigation
- Ctrl+P/Ctrl+N alternatives
- History persistence across sessions

#### 7.3 History Search (Ctrl+R)
- Reverse incremental search mode
- Visual search indicator
- Fuzzy matching in history
- Navigation within results

#### 7.4 Multi-line Input (Shift+Enter)
- Enabling multi-line mode
- Line continuation behavior
- Visual mode indicator
- Submitting multi-line content

#### 7.5 Inline Editing
- Cursor movement (←/→)
- Word-based navigation (Ctrl+A/E)
- Deletion operations (Backspace, Ctrl+W, Ctrl+U)
- Insert vs replace behavior

#### 7.6 Input Preview
- Reference to docs/user-guide/input-preview.md
- Brief summary of preview mode

#### Input Keyboard Shortcuts Summary Table
Comprehensive table of all 15+ input shortcuts
```

### Visual Examples Design

Each feature should include ASCII-art visual examples showing:
1. Initial state
2. User action
3. Resulting state

Example format:
```
┌─ History Search Mode ────────────────────────────────────────────────────────┐
│ (reverse-i-search)`auth`: Add user authentication to my React app           │
│                                                                              │
│ Matches: 5 commands containing "auth"                                        │
│ ↑↓: Navigate matches • Enter: Accept • Escape: Cancel • Continue typing     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts Table

The complete table should document:

| Category | Shortcut | Action | Context |
|----------|----------|--------|---------|
| **Navigation** | | | |
| | `↑` or `Ctrl+P` | Previous history item | input |
| | `↓` or `Ctrl+N` | Next history item | input |
| | `Ctrl+R` | Search history (reverse) | input |
| | `←` | Move cursor left | input |
| | `→` | Move cursor right | input |
| | `Ctrl+A` | Move to line start | input |
| | `Ctrl+E` | Move to line end | input |
| **Editing** | | | |
| | `Backspace` | Delete character before cursor | input |
| | `Delete` | Delete character at cursor | input |
| | `Ctrl+U` | Clear entire line | input |
| | `Ctrl+W` | Delete previous word | input |
| | `Ctrl+L` | Clear screen (preserve input) | global |
| **Completion** | | | |
| | `Tab` | Accept/cycle completion | input |
| | `Escape` | Dismiss suggestions | suggestions |
| **Multi-line** | | | |
| | `Shift+Enter` | Insert newline | input |
| | `Enter` | Submit (single-line) or continue (multi-line) | input |
| **Control** | | | |
| | `Ctrl+C` | Cancel current operation | processing |
| | `Ctrl+D` | Exit APEX | global |

## Technical Design

### File Modifications Required

1. **Primary Target**: `docs/features/v030-features.md`
   - Expand Section 7 from ~45 lines to ~200 lines
   - Add subsections for each of the 6 features
   - Add comprehensive keyboard shortcuts table
   - Include visual examples for each feature

2. **Cross-Reference Updates** (if needed):
   - `docs/getting-started.md` - Ensure shortcuts section is consistent
   - `docs/cli-guide.md` - Reference the new detailed documentation

### Content Requirements

Each feature subsection must include:

1. **Feature Description** (2-3 sentences)
2. **How to Trigger** (keyboard shortcut + any alternatives)
3. **Visual Example** (ASCII box showing the UI state)
4. **Behavior Details** (bullet points of specific behaviors)
5. **Tips/Best Practices** (optional, 1-2 tips)

### Documentation Size Estimate

| Section | Current Lines | Target Lines |
|---------|--------------|--------------|
| 7. Enhanced Input Experience | 45 | 200 |
| 7.1 Tab Completion | 15 | 35 |
| 7.2 History Navigation | 0 | 25 |
| 7.3 History Search (Ctrl+R) | 8 | 35 |
| 7.4 Multi-line Input | 0 | 30 |
| 7.5 Inline Editing | 0 | 30 |
| 7.6 Input Preview | 0 | 10 (reference) |
| Keyboard Shortcuts Table | 0 | 35 |

## Implementation Plan

### Phase 1: Content Creation (developer stage)
1. Write Tab Completion expanded documentation
2. Write History Navigation documentation
3. Write History Search (Ctrl+R) documentation
4. Write Multi-line Input (Shift+Enter) documentation
5. Write Inline Editing documentation
6. Create comprehensive keyboard shortcuts table
7. Add Input Preview reference

### Phase 2: Visual Examples
1. Create ASCII-art examples for each feature
2. Ensure consistent box/border styling
3. Add step-by-step visual progressions

### Phase 3: Integration
1. Replace existing Section 7 content
2. Update cross-references if needed
3. Verify documentation renders correctly

## Acceptance Criteria Verification

**Requirement**: "Input Experience section documents all 6 input features with keyboard shortcuts"

| Feature | Documented | Keyboard Shortcut Documented |
|---------|------------|------------------------------|
| Tab completion | ✅ Will add expanded | ✅ Tab |
| History navigation | ✅ Will add | ✅ ↑/↓, Ctrl+P/N |
| History search (Ctrl+R) | ✅ Will add expanded | ✅ Ctrl+R |
| Multi-line input (Shift+Enter) | ✅ Will add | ✅ Shift+Enter |
| Inline editing | ✅ Will add | ✅ ←/→, Ctrl+A/E, Backspace, etc. |
| Input preview | ✅ Will reference | ✅ /preview command |

## Consequences

### Positive
- Complete documentation for all 6 Input Experience features
- Single source of truth for input keyboard shortcuts
- Visual examples improve user understanding
- Consistent with existing v030-features.md style

### Negative
- Increases documentation file size
- Requires maintenance when input features change

### Neutral
- Follows existing documentation patterns in the codebase
- Mirrors detail level of other v0.3.0 feature sections

## Related Documents

- `docs/user-guide/input-preview.md` - Detailed input preview guide
- `docs/cli-guide.md` - CLI command reference
- `docs/getting-started.md` - Quick start guide
- `packages/cli/src/ui/components/AdvancedInput.tsx` - Implementation
- `packages/cli/src/services/ShortcutManager.ts` - Shortcut definitions
- `packages/cli/src/services/CompletionEngine.ts` - Completion system
