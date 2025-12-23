# ADR: Event Emission for Detector Findings in IdleProcessor

## Status
Proposed

## Context

The `IdleProcessor` class in `packages/orchestrator/src/idle-processor.ts` currently emits high-level events for analysis lifecycle (`analysis:started`, `analysis:completed`, `tasks:generated`, `task:suggested`). However, when detectors find issues (outdated documentation, version mismatches, stale comments, code smells, etc.), there is no way for consumers to react to individual findings as they occur.

This limits the ability of:
- UIs to display real-time progress as issues are discovered
- Event-driven workflows that need to react to specific types of findings
- Logging and monitoring systems that need granular insight into detection results

## Decision

### 1. Event Naming Convention

We will extend the `IdleProcessorEvents` interface with granular detector finding events using the following naming convention:

```
detector:<detector-type>:found
```

This provides a consistent, hierarchical naming pattern that:
- Groups all detector events under `detector:` prefix
- Identifies the specific detector type
- Uses `:found` suffix to indicate issues were discovered

### 2. New Event Types

Add the following event types to `IdleProcessorEvents`:

```typescript
export interface DetectorFinding {
  /** Type of detector that found the issue */
  detectorType: DetectorType;
  /** Severity level of the finding */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** File where the issue was found */
  file: string;
  /** Line number (if applicable) */
  line?: number;
  /** Human-readable description */
  description: string;
  /** Additional metadata specific to the detector type */
  metadata?: Record<string, unknown>;
}

export type DetectorType =
  | 'outdated-docs'
  | 'version-mismatch'
  | 'stale-comment'
  | 'code-smell'
  | 'complexity-hotspot'
  | 'duplicate-code'
  | 'undocumented-export'
  | 'missing-readme-section'
  | 'security-vulnerability'
  | 'deprecated-dependency';

export interface IdleProcessorEvents {
  // Existing events
  'analysis:started': () => void;
  'analysis:completed': (analysis: ProjectAnalysis) => void;
  'tasks:generated': (tasks: IdleTask[]) => void;
  'task:suggested': (task: IdleTask) => void;

  // New detector finding events
  'detector:finding': (finding: DetectorFinding) => void;
  'detector:outdated-docs:found': (findings: OutdatedDocumentation[]) => void;
  'detector:version-mismatch:found': (findings: VersionMismatchFinding[]) => void;
  'detector:stale-comment:found': (findings: StaleCommentFinding[]) => void;
  'detector:code-smell:found': (findings: CodeSmell[]) => void;
  'detector:complexity-hotspot:found': (findings: ComplexityHotspot[]) => void;
  'detector:duplicate-code:found': (findings: DuplicatePattern[]) => void;
  'detector:undocumented-export:found': (findings: UndocumentedExport[]) => void;
  'detector:missing-readme-section:found': (findings: MissingReadmeSection[]) => void;
  'detector:security-vulnerability:found': (findings: SecurityVulnerability[]) => void;
  'detector:deprecated-dependency:found': (findings: DeprecatedPackage[]) => void;
}
```

### 3. Event Metadata Structure

Each detector-specific event will include:
1. **Array of findings** - All findings from that detector run
2. **Existing type interfaces** - Reuse existing types (`OutdatedDocumentation`, `CodeSmell`, etc.)

Additionally, a unified `detector:finding` event will be emitted for each individual finding for consumers who want granular, real-time updates.

### 4. Integration Points

Events will be emitted from these locations in `IdleProcessor`:

| Method | Event(s) Emitted |
|--------|------------------|
| `analyzeDocumentation()` | `detector:outdated-docs:found`, `detector:undocumented-export:found`, `detector:missing-readme-section:found` |
| `findVersionMismatches()` | `detector:version-mismatch:found` |
| `findStaleComments()` | `detector:stale-comment:found` |
| `analyzeCodeQuality()` | `detector:code-smell:found`, `detector:complexity-hotspot:found`, `detector:duplicate-code:found` |
| `analyzeDependencies()` | `detector:security-vulnerability:found`, `detector:deprecated-dependency:found` |

### 5. Event Emission Strategy

```
                    ┌─────────────────────┐
                    │  analysis:started   │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │ analyzeCode  │   │ analyzeDocs  │   │ analyzeDeps  │
    │   Quality    │   │              │   │              │
    └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
           │                   │                   │
           ▼                   ▼                   ▼
    detector:code-smell:    detector:outdated-   detector:security-
          found            docs:found          vulnerability:found
    detector:complexity-   detector:undoc-      detector:deprecated-
     hotspot:found         export:found          dependency:found
    detector:duplicate-    detector:missing-
       code:found          readme-section:found
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ analysis:completed  │
                    └─────────────────────┘
```

### 6. Finding Type Interfaces

Reuse existing types where possible, add new ones where needed:

```typescript
// Existing types to reuse (from @apexcli/core)
// - OutdatedDocumentation
// - UndocumentedExport
// - MissingReadmeSection
// - CodeSmell
// - ComplexityHotspot
// - DuplicatePattern
// - SecurityVulnerability (from idle-processor.ts)
// - DeprecatedPackage (from idle-processor.ts)

// New types to add
export interface VersionMismatchFinding {
  file: string;
  line: number;
  foundVersion: string;
  expectedVersion: string;
  lineContent: string;
}

export interface StaleCommentFinding {
  file: string;
  line: number;
  text: string;
  type: 'TODO' | 'FIXME' | 'HACK';
  author?: string;
  date?: Date;
  daysSinceAdded: number;
}
```

## Implementation Plan

### Phase 1: Type Definitions
1. Add `DetectorType` and `DetectorFinding` types to `@apexcli/core` types.ts
2. Add `VersionMismatchFinding` and `StaleCommentFinding` types
3. Extend `IdleProcessorEvents` interface with new event signatures

### Phase 2: Event Emission
1. Update `analyzeDocumentation()` to emit:
   - `detector:outdated-docs:found`
   - `detector:undocumented-export:found`
   - `detector:missing-readme-section:found`
2. Update `findVersionMismatches()` to emit `detector:version-mismatch:found`
3. Update `findStaleComments()` to emit `detector:stale-comment:found`
4. Update `analyzeCodeQuality()` to emit:
   - `detector:code-smell:found`
   - `detector:complexity-hotspot:found`
   - `detector:duplicate-code:found`
5. Update `analyzeDependencies()` to emit:
   - `detector:security-vulnerability:found`
   - `detector:deprecated-dependency:found`

### Phase 3: Unit Tests
1. Add tests verifying each detector event is emitted
2. Test event payload contains correct metadata
3. Test events are only emitted when findings exist
4. Test event ordering (detector events before analysis:completed)

## Files to Modify

1. **`packages/core/src/types.ts`**
   - Add `DetectorType` type
   - Add `DetectorFinding` interface
   - Add `VersionMismatchFinding` interface
   - Add `StaleCommentFinding` interface

2. **`packages/orchestrator/src/idle-processor.ts`**
   - Extend `IdleProcessorEvents` interface
   - Add event emissions in analysis methods
   - Export new types for consumers

3. **`packages/orchestrator/src/idle-processor.test.ts`**
   - Add unit tests for new event emissions

## Consequences

### Positive
- Enables real-time UI updates during analysis
- Supports event-driven architectures
- Provides granular observability into detection results
- Backward compatible - existing events unchanged
- Follows existing EventEmitter3 patterns

### Negative
- Slightly increased memory usage from additional event emissions
- More events to handle for consumers (though optional)
- Additional test surface area

### Neutral
- Requires consumers to update if they want new functionality
- May require documentation updates

## Alternatives Considered

### 1. Single Aggregated Event
Emit a single `detector:findings` event with all results after analysis completes.

**Rejected because**: Doesn't support real-time streaming updates.

### 2. Callback-based Approach
Pass callback functions to analysis methods.

**Rejected because**: Breaks existing EventEmitter pattern used throughout the codebase.

### 3. Observable Pattern
Use RxJS observables for streaming.

**Rejected because**: Adds new dependency and changes existing architectural patterns.

## References

- Existing event pattern: `IdleProcessorEvents` interface
- Detector implementations: `StaleCommentDetector`, `VersionMismatchDetector`
- Core types: `@apexcli/core` types.ts
