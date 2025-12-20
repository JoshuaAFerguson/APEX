# ADR-050: StatusBar Documentation Architecture

## Status
Proposed

## Context

The StatusBar component (`packages/cli/src/ui/components/StatusBar.tsx`) is a sophisticated responsive component with 9+ display elements. The current documentation in `cli-guide.md`, `getting-started.md`, and `user-guide/display-modes.md` provides functional descriptions but lacks:

1. Complete enumeration of all display elements
2. Visual examples for each element
3. Technical details on responsive behavior
4. Priority-based segment visibility rules

This ADR defines the architecture for comprehensive StatusBar documentation that fully documents all display elements with visual examples.

## Decision

### StatusBar Display Elements Inventory

Based on analysis of `StatusBar.tsx`, the component displays **14 potential segments** organized into **4 priority tiers**:

#### Priority Tiers

| Tier | Priority Level | Visibility |
|------|---------------|------------|
| **CRITICAL** | Always shown | All display widths, all modes |
| **HIGH** | Essential | Narrow (<60), Normal (60-160), Wide (>160) |
| **MEDIUM** | Standard | Normal (60-160), Wide (>160) |
| **LOW** | Extended | Wide (>160) only |

#### Complete Display Element Catalog

| # | Element ID | Side | Priority | Icon | Label (Full) | Label (Abbrev) | Description |
|---|-----------|------|----------|------|--------------|----------------|-------------|
| 1 | `connection` | Left | CRITICAL | ●/○ | - | - | Connection status (green=connected, red=disconnected) |
| 2 | `sessionTimer` | Right | CRITICAL | - | - | - | Session elapsed time (MM:SS format) |
| 3 | `gitBranch` | Left | HIGH |  | - | - | Current git branch name |
| 4 | `agent` | Left | HIGH | ⚡ | - | - | Active agent name |
| 5 | `cost` | Right | HIGH | - | cost: | (empty) | Current task cost ($0.0000 format) |
| 6 | `model` | Right | HIGH | - | model: | m: | Active AI model |
| 7 | `workflowStage` | Left | MEDIUM | ▶ | - | - | Current workflow stage |
| 8 | `tokens` | Right | MEDIUM | - | tokens: | tk: | Token count (formatted: 1.2k, 1.5M) |
| 9 | `subtaskProgress` | Left | MEDIUM | 📋 | - | - | Subtask completion [X/Y] |
| 10 | `sessionName` | Left | LOW | 💾 | - | - | Named session identifier |
| 11 | `apiUrl` | Left | LOW | - | api: | → | API server URL |
| 12 | `webUrl` | Left | LOW | - | web: | ↗ | Web UI URL |
| 13 | `previewMode` | Right | LOW | 📋 | - | - | "PREVIEW" when preview mode enabled |
| 14 | `showThoughts` | Right | LOW | 💭 | - | - | "THOUGHTS" when thought display enabled |

#### Verbose-Mode-Only Elements

| # | Element ID | Side | Priority | Label (Full) | Label (Abbrev) | Description |
|---|-----------|------|----------|--------------|----------------|-------------|
| 15 | `verboseMode` | Right | LOW | - | - | "🔍 VERBOSE" indicator |
| 16 | `tokensBreakdown` | Right | MEDIUM | tokens: | tk: | Input→output breakdown (1.5k→800) |
| 17 | `tokensTotal` | Right | MEDIUM | total: | ∑: | Total tokens (verbose shows both breakdown + total) |
| 18 | `sessionCost` | Right | LOW | session: | sess: | Session cumulative cost |
| 19 | `activeTime` | Right | MEDIUM | active: | a: | Active processing time |
| 20 | `idleTime` | Right | MEDIUM | idle: | i: | Idle/waiting time |
| 21 | `stageTime` | Right | MEDIUM | stage: | s: | Current stage elapsed time |

### Documentation Structure

The StatusBar section should be added to `docs/cli-guide.md` (primary) and cross-referenced from `docs/user-guide/display-modes.md` and `docs/features/v030-features.md`.

#### Section Structure

```markdown
## StatusBar Component

The StatusBar displays real-time session and task information at the bottom of the APEX interface.

### Visual Example

[ASCII diagram showing full StatusBar layout]

### Display Elements

#### 1. Connection Status (●)
[Description, visual example, behavior]

#### 2. Session Timer
[Description, visual example, behavior]

...

### Responsive Behavior

[Width-based visibility table]

### Display Mode Variations

[Normal vs Compact vs Verbose comparison]
```

### Visual Examples Architecture

Each element documentation should include:

1. **Icon/Symbol**: The actual character(s) displayed
2. **Location**: Left or right side of StatusBar
3. **Color Coding**: What colors indicate
4. **Format**: How values are formatted
5. **Visibility Rules**: When it appears/disappears
6. **Display Mode Behavior**: How it changes across modes

#### Example Visual Diagrams

**Full StatusBar (Wide Terminal, Normal Mode):**
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5]                                                tokens: 45.2k | cost: $0.1523 | model: sonnet | 05:23 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 ↑   ↑       ↑             ↑                  ↑                                                       ↑               ↑              ↑            ↑
 │   │       │             │                  │                                                       │               │              │            │
 │   │       │             │                  └─ Subtask Progress                                     │               │              │            └─ Session Timer
 │   │       │             └─ Workflow Stage                                                          │               │              └─ Model Indicator
 │   │       └─ Agent Indicator                                                                       │               └─ Cost Display
 │   └─ Git Branch                                                                                    └─ Token Count
 └─ Connection Status
```

**Compact Mode:**
```
┌─────────────────────────────────────────────┐
│ ● main | $0.1523                            │
└─────────────────────────────────────────────┘
```

**Verbose Mode (Additional Elements):**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● main | ⚡dev | ▶impl | 📋 [2/5] | 💾 my-session | api:3000 | web:3001     tokens: 12.5k→8.2k | total: 20.7k | cost: $0.15 | session: $1.25 | model: sonnet | active: 3m42s | idle: 1m18s | stage: 45s | 🔍 VERBOSE │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Element Detail Templates

Each element should follow this documentation template:

```markdown
#### N. Element Name

**Visual Example:**
\`\`\`
[element]value
\`\`\`

**Location:** Left/Right side
**Priority:** CRITICAL/HIGH/MEDIUM/LOW
**Icon/Label:** Description of icon/label used

**Description:**
What this element shows and why it's important.

**Format:**
- Format specification
- Examples of different values

**Color Coding:**
| State | Color | Meaning |
|-------|-------|---------|
| ... | ... | ... |

**Visibility:**
| Width | Compact | Normal | Verbose |
|-------|---------|--------|---------|
| ... | ... | ... | ... |
```

### Cross-Reference Architecture

#### Primary Documentation Location
- `docs/cli-guide.md` → New section: "## StatusBar Reference"

#### Cross-References To Add
1. `docs/user-guide/display-modes.md` → Link to StatusBar Reference for detailed element info
2. `docs/features/v030-features.md` → Brief mention with link to full reference
3. `docs/getting-started.md` → Quick overview with link to full reference

### Implementation Files

| File | Changes Required |
|------|-----------------|
| `docs/cli-guide.md` | Add comprehensive StatusBar Reference section after Display Modes section |
| `docs/user-guide/display-modes.md` | Update StatusBar table with "See StatusBar Reference for details" links |
| `docs/features/v030-features.md` | Add StatusBar component section if not present |

## File Changes Summary

### docs/cli-guide.md

Add new section after line ~575 (after Display Modes section):

```markdown
---

## StatusBar Reference

The StatusBar component provides real-time session and task information...

[Full element documentation as specified above]
```

**Estimated addition:** ~400-500 lines covering:
- Overview and visual example
- All 9+ core elements with detailed documentation
- Responsive behavior explanation
- Display mode comparison
- Color coding reference
- Troubleshooting tips

### docs/user-guide/display-modes.md

Update the "StatusBar" table (lines 123-134) to include:
- More detailed element names
- Cross-reference: "See [StatusBar Reference](../cli-guide.md#statusbar-reference) for complete element documentation"

### docs/features/v030-features.md

Ensure StatusBar is documented in the component overview section with:
- Brief description
- Link to full reference

## Testing Requirements

The documentation should be validated by:

1. **Visual Verification**: Screenshots/terminal captures matching documented examples
2. **Element Count Verification**: All 9+ elements documented and visible in actual component
3. **Display Mode Accuracy**: Verify compact/normal/verbose descriptions match implementation
4. **Responsive Accuracy**: Verify width-based visibility matches actual behavior

## Consequences

### Positive
- Users will have complete reference for all StatusBar elements
- Visual examples make documentation self-explanatory
- Display mode differences clearly documented
- Responsive behavior documented for all terminal widths

### Negative
- Increased documentation maintenance burden
- Documentation must be updated when StatusBar changes
- Visual examples may become outdated

### Risks
- **Documentation drift**: StatusBar implementation may change without updating docs
  - Mitigation: Include documentation update in StatusBar component PRs

- **Visual example accuracy**: ASCII diagrams may not render correctly in all contexts
  - Mitigation: Use consistent monospace formatting, test in multiple viewers

## Related Documents

- `ADR-028-statusbar-abbreviated-labels.md` - Abbreviated label system design
- `ADR-020-display-modes-compact-verbose.md` - Display mode system
- `packages/cli/src/ui/components/StatusBar.tsx` - Implementation source

## Notes for Implementation Stage

The developer implementing this should:

1. Start with `cli-guide.md` StatusBar Reference section
2. Document all 9+ core elements with visual examples
3. Include responsive behavior table
4. Add cross-references to related docs
5. Validate against actual StatusBar component output
