# ADR-058: Enhanced Context Summary for Session Resume

## Status
Proposed

## Context

The `createContextSummary` function in `/packages/orchestrator/src/context.ts` currently provides basic context extraction:
- Tools used
- Files read and edited
- User requests (last 3, truncated to 100 chars)
- Message count

However, for effective session resumption (particularly after context window limits are hit), the summary lacks critical information:
1. **Key decisions** made by the assistant during execution
2. **Progress tracking** - which stages completed, current stage
3. **Detailed file modification tracking** with action types (created, modified, deleted)
4. **Structured output** suitable for injection into resumed sessions

The `SessionManager.summarizeContext()` method already extracts some key decisions, but this logic is duplicated and uses a different approach than `createContextSummary`.

## Decision

### 1. Enhanced Return Type

Replace the string return type with a structured interface:

```typescript
export interface ContextSummary {
  /** Basic statistics */
  stats: {
    messageCount: number;
    toolCallCount: number;
    estimatedTokens: number;
  };

  /** Key decisions extracted from assistant messages */
  keyDecisions: KeyDecision[];

  /** Progress tracking */
  progress: ProgressInfo;

  /** File modifications with action types */
  fileModifications: FileModification[];

  /** Tools used during the conversation */
  toolsUsed: string[];

  /** User requests summary */
  userRequests: string[];

  /** Formatted string summary (for backward compatibility) */
  formatted: string;
}

export interface KeyDecision {
  /** The decision text, extracted from assistant message */
  text: string;
  /** Decision type/category */
  type: 'implementation' | 'architecture' | 'approach' | 'fix' | 'other';
  /** Confidence score (0-1) based on keyword matching */
  confidence: number;
  /** Message index where decision was made */
  messageIndex: number;
}

export interface ProgressInfo {
  /** Stages that have been completed */
  completedStages: string[];
  /** Current active stage (if identifiable) */
  currentStage?: string;
  /** Overall progress percentage (0-100, estimated) */
  progressPercentage: number;
  /** Key milestones reached */
  milestones: string[];
}

export interface FileModification {
  /** File path */
  path: string;
  /** Type of modification */
  action: 'read' | 'created' | 'modified' | 'deleted';
  /** Number of times this file was touched */
  touchCount: number;
  /** Tools used on this file */
  tools: string[];
}
```

### 2. Key Decision Extraction

Implement pattern-based extraction with confidence scoring:

```typescript
const DECISION_PATTERNS = [
  // High confidence - explicit decisions
  { pattern: /\bI will\s+(.{10,100})/i, type: 'implementation', confidence: 0.9 },
  { pattern: /\bdecided to\s+(.{10,100})/i, type: 'implementation', confidence: 0.95 },
  { pattern: /\bchoosing\s+(.{10,80})/i, type: 'approach', confidence: 0.85 },
  { pattern: /\bwe should\s+(.{10,100})/i, type: 'approach', confidence: 0.8 },
  { pattern: /\bthe approach\s+(.{10,80})/i, type: 'architecture', confidence: 0.75 },

  // Medium confidence - implementation statements
  { pattern: /\bimplementing\s+(.{10,80})/i, type: 'implementation', confidence: 0.7 },
  { pattern: /\bcreating\s+(.{10,60})/i, type: 'implementation', confidence: 0.65 },
  { pattern: /\bmodifying\s+(.{10,60})/i, type: 'implementation', confidence: 0.65 },

  // Architecture/design decisions
  { pattern: /\busing\s+(the\s+)?(\w+)\s+(pattern|approach|strategy)/i, type: 'architecture', confidence: 0.8 },
  { pattern: /\barchitecture:\s*(.{10,100})/i, type: 'architecture', confidence: 0.9 },

  // Bug fixes
  { pattern: /\bfixing\s+(.{10,80})/i, type: 'fix', confidence: 0.75 },
  { pattern: /\bthe bug\s+(.{10,80})/i, type: 'fix', confidence: 0.7 },
];
```

### 3. Progress Detection

Track progress through:
- Stage markers in system/user messages (e.g., "Stage: planning", "Current stage: implementation")
- Completion keywords (e.g., "completed", "finished", "done with")
- Tool usage patterns (e.g., tests running = testing stage)

```typescript
const STAGE_PATTERNS = [
  /(?:current\s+)?stage:\s*(\w+)/i,
  /\b(planning|architecture|implementation|testing|review|deployment)\s+(?:stage\s+)?(?:completed|done|finished)/i,
  /\bmoving\s+to\s+(\w+)\s+stage/i,
];

const MILESTONE_PATTERNS = [
  /tests?\s+(?:all\s+)?pass(?:ing|ed)?/i,
  /build\s+(?:succeeded|successful)/i,
  /code\s+review\s+(?:approved|passed)/i,
  /deployed\s+to\s+(\w+)/i,
];
```

### 4. File Modification Tracking

Enhanced file tracking with action detection:

```typescript
function determineFileAction(
  toolName: string,
  toolInput: Record<string, unknown>,
  existingFiles: Set<string>
): 'read' | 'created' | 'modified' | 'deleted' {
  switch (toolName) {
    case 'Read':
      return 'read';
    case 'Write':
      // If file was previously read, it's modified; otherwise created
      const path = toolInput.file_path as string;
      return existingFiles.has(path) ? 'modified' : 'created';
    case 'Edit':
      return 'modified';
    case 'Bash':
      // Check for rm commands
      const command = toolInput.command as string;
      if (/\brm\s+/.test(command)) return 'deleted';
      return 'modified';
    default:
      return 'modified';
  }
}
```

### 5. Backward Compatibility

Maintain backward compatibility by:
1. Keeping the `formatted` property that contains the original string format
2. Adding a helper function `formatContextSummary(summary: ContextSummary): string`
3. Optionally: overloaded function that can return either format

```typescript
// Option A: Always return structured, use .formatted for string
export function createContextSummary(messages: AgentMessage[]): ContextSummary;

// Option B: Overloaded (more complex but smoother migration)
export function createContextSummary(messages: AgentMessage[], format: 'structured'): ContextSummary;
export function createContextSummary(messages: AgentMessage[], format?: 'string'): string;
```

**Recommendation**: Option A with `formatted` property is cleaner and more maintainable.

### 6. Integration with SessionManager

Update `SessionManager.summarizeContext()` to use the new `createContextSummary`:

```typescript
async summarizeContext(conversationHistory: AgentMessage[]): Promise<SessionSummary> {
  const summary = createContextSummary(conversationHistory);

  return {
    conversationLength: summary.stats.messageCount,
    keyDecisions: summary.keyDecisions.map(d => d.text),
    currentContext: summary.formatted,
    progressSummary: this.formatProgressSummary(summary.progress),
  };
}
```

## Implementation Plan

### Files to Modify

1. **`/packages/orchestrator/src/context.ts`**
   - Add new interfaces: `ContextSummary`, `KeyDecision`, `ProgressInfo`, `FileModification`
   - Implement `extractKeyDecisions(messages: AgentMessage[]): KeyDecision[]`
   - Implement `extractProgress(messages: AgentMessage[]): ProgressInfo`
   - Implement `trackFileModifications(messages: AgentMessage[]): FileModification[]`
   - Update `createContextSummary()` to return `ContextSummary`
   - Add helper `formatContextSummary(summary: ContextSummary): string`

2. **`/packages/orchestrator/src/context.test.ts`**
   - Add tests for key decision extraction (various patterns)
   - Add tests for progress detection
   - Add tests for file modification tracking
   - Update existing `createContextSummary` tests

3. **`/packages/orchestrator/src/session-manager.ts`**
   - Update `summarizeContext()` to use new `createContextSummary`
   - Remove duplicated decision extraction logic

4. **`/packages/orchestrator/src/index.ts`**
   - Export new types from context.ts

5. **`/packages/core/src/types.ts`** (if needed)
   - Consider adding `ContextSummary` types here if they need to be shared across packages

### Stage Dependencies
- **No external dependencies** - all changes are within the orchestrator package
- **Core package unchanged** - keeps the change footprint minimal

## Consequences

### Positive
- Richer context for session resume improves agent continuity
- Structured data enables programmatic use (UI, analytics)
- Deduplication of logic between `createContextSummary` and `SessionManager.summarizeContext`
- Better file tracking helps agents understand what changed
- Decision extraction helps maintain context across session boundaries

### Negative
- Slightly more complex return type (mitigated by `formatted` property)
- Pattern matching may not catch all decision types (can iterate on patterns)
- Performance impact on large conversations (mitigated by lazy evaluation if needed)

### Neutral
- Need to update consumers of `createContextSummary` (minimal - mostly internal use)

## Metrics

Track effectiveness by:
- Decision detection rate (manual sampling)
- Stage detection accuracy
- Session resume success rate (before/after)

## Notes for Implementation Stage

1. Start with type definitions and skeleton functions
2. Implement file modification tracking first (simplest, most concrete)
3. Implement key decision extraction with initial patterns
4. Implement progress detection
5. Wire together in `createContextSummary`
6. Update tests thoroughly
7. Update SessionManager integration
