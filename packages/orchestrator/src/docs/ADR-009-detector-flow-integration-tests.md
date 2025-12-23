# ADR-009: End-to-End Detector Flow Integration Tests

## Status

Proposed

## Context

The APEX idle processing system uses multiple detectors to analyze projects:
- **StaleCommentDetector**: Finds old TODO/FIXME/HACK comments
- **VersionMismatchDetector**: Detects version mismatches between package.json and documentation
- **CrossReferenceValidator**: Validates documentation cross-references
- **DocsAnalyzer**: Processes OutdatedDocumentation findings into TaskCandidates

We need comprehensive integration tests to verify:
1. IdleProcessor correctly calls all detectors
2. DocsAnalyzer processes all OutdatedDocumentation types
3. Events are emitted correctly through the detection pipeline

## Decision

### Test File Architecture

We will create **one new integration test file**:

```
packages/orchestrator/src/__tests__/detector-flow-e2e.integration.test.ts
```

This file will contain three main test suites:
1. **IdleProcessor Detector Integration Tests**
2. **DocsAnalyzer OutdatedDocumentation Processing Tests**
3. **Event Emission Flow Tests**

### Test Design Patterns

Following existing patterns from `stale-comment-detector.idle-integration.test.ts`:

#### 1. Mock Setup Pattern
```typescript
// Mock before imports
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    close: vi.fn(),
    pragma: vi.fn(),
  };
  return { default: vi.fn(() => mockDb) };
});
```

#### 2. Detector Mock Pattern
```typescript
vi.mock('../stale-comment-detector', () => ({
  StaleCommentDetector: class MockStaleCommentDetector {
    constructor(projectPath: string, config: any) {}
    async findStaleComments(): Promise<OutdatedDocumentation[]> {
      return [/* mock findings */];
    }
  }
}));

vi.mock('../analyzers/version-mismatch-detector.js', () => ({
  VersionMismatchDetector: class MockVersionMismatchDetector {
    constructor(projectPath: string) {}
    async detectMismatches() {
      return [/* mock mismatches */];
    }
  }
}));
```

#### 3. Event Spy Pattern
```typescript
const outdatedDocsSpy = vi.fn();
const detectorFindingSpy = vi.fn();
const staleCommentSpy = vi.fn();
const versionMismatchSpy = vi.fn();

idleProcessor.on('detector:outdated-docs:found', outdatedDocsSpy);
idleProcessor.on('detector:finding', detectorFindingSpy);
idleProcessor.on('detector:stale-comment:found', staleCommentSpy);
idleProcessor.on('detector:version-mismatch:found', versionMismatchSpy);
```

### Test Suite 1: IdleProcessor Detector Integration

**Purpose**: Verify IdleProcessor correctly invokes all detectors and aggregates results.

**Test Cases**:
1. `should call StaleCommentDetector with correct configuration`
2. `should call VersionMismatchDetector during analysis`
3. `should call CrossReferenceValidator when enabled`
4. `should aggregate findings from all detectors into ProjectAnalysis`
5. `should continue analysis when one detector fails`
6. `should respect detector configuration settings`

**Mock Strategy**:
- Mock all three detectors to return predictable findings
- Verify each detector receives correct constructor arguments
- Verify findings are combined into the final `ProjectAnalysis.documentation.outdatedDocs` array

### Test Suite 2: DocsAnalyzer OutdatedDocumentation Processing

**Purpose**: Verify DocsAnalyzer correctly processes all OutdatedDocumentation types.

**Test Cases**:
1. `should process stale-reference type into task candidates`
2. `should process version-mismatch type into task candidates`
3. `should process broken-link type into task candidates`
4. `should process deprecated-api type into task candidates`
5. `should correctly group findings by severity (high, medium, low)`
6. `should prioritize high severity findings over medium/low`
7. `should generate correct task titles and descriptions per type`
8. `should handle mixed types in single analysis`

**Test Data Structure**:
```typescript
const testOutdatedDocs: OutdatedDocumentation[] = [
  {
    file: 'src/component.ts',
    type: 'stale-reference',
    description: 'TODO comment added 45 days ago',
    line: 10,
    severity: 'medium'
  },
  {
    file: 'README.md',
    type: 'version-mismatch',
    description: 'Found version 1.0.0 but expected 2.0.0',
    line: 5,
    severity: 'high',
    suggestion: 'Update to 2.0.0'
  },
  {
    file: 'src/api.ts',
    type: 'broken-link',
    description: 'Reference to deleted function processData',
    line: 25,
    severity: 'high'
  },
  {
    file: 'src/utils.ts',
    type: 'deprecated-api',
    description: '@deprecated tag missing migration guidance',
    line: 15,
    severity: 'medium'
  }
];
```

### Test Suite 3: Event Emission Flow

**Purpose**: Verify correct event emission throughout the detector flow.

**Test Cases**:
1. `should emit detector:outdated-docs:found with combined findings`
2. `should emit detector:stale-comment:found for stale references`
3. `should emit detector:version-mismatch:found for version mismatches`
4. `should emit detector:finding for each individual finding`
5. `should include correct metadata in detector:finding events`
6. `should emit events in correct order (specific before generic)`
7. `should not emit events when no findings exist`
8. `should handle partial failures gracefully`

**Event Verification Pattern**:
```typescript
await idleProcessor.processIdleTime();

// Verify specific event was emitted with correct structure
expect(staleCommentSpy).toHaveBeenCalledWith(
  expect.arrayContaining([
    expect.objectContaining({
      file: expect.any(String),
      line: expect.any(Number),
      text: expect.any(String),
      type: expect.stringMatching(/TODO|FIXME|HACK/),
      daysSinceAdded: expect.any(Number)
    })
  ])
);

// Verify generic detector:finding events
const staleFindings = detectorFindingSpy.mock.calls.filter(
  call => call[0].detectorType === 'stale-comment'
);
expect(staleFindings.length).toBeGreaterThan(0);
```

### Critical Test Scenarios

#### Scenario A: Full Flow with All Detectors
```typescript
it('should execute complete detector flow with all detectors enabled', async () => {
  // Setup: Mock all detectors to return findings
  // Execute: Call processIdleTime()
  // Verify:
  //   1. All detector events emitted
  //   2. DocsAnalyzer generates correct TaskCandidates
  //   3. analysis:completed event contains all findings
});
```

#### Scenario B: Mixed Severity Processing
```typescript
it('should correctly prioritize mixed severity findings', async () => {
  // Setup: Provide findings with high, medium, low severity for each type
  // Execute: Run analysis
  // Verify: High severity generates critical tasks, not duplicated with medium
});
```

#### Scenario C: Error Resilience
```typescript
it('should continue processing when one detector fails', async () => {
  // Setup: Mock one detector to throw error
  // Execute: Run analysis
  // Verify: Other detectors still process, no crash
});
```

## Implementation Considerations

### File Location
- `packages/orchestrator/src/__tests__/detector-flow-e2e.integration.test.ts`

### Dependencies
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor, ProjectAnalysis } from '../idle-processor';
import { DocsAnalyzer } from '../analyzers/docs-analyzer';
import { TaskStore } from '../store';
import {
  DaemonConfig,
  DetectorFinding,
  OutdatedDocumentation,
  VersionMismatchFinding,
  StaleCommentFinding,
} from '@apexcli/core';
import { promises as fs } from 'fs';
```

### Test Configuration
```typescript
const mockConfig: DaemonConfig = {
  enabled: true,
  maxConcurrentTasks: 2,
  intervalMinutes: 60,
  analysisDepth: 'medium',
  autoCreateTasks: true,
  taskLimits: { maxTasksPerType: 5, maxPendingTasks: 10 },
  documentation: {
    outdatedDocs: {
      todoAgeThresholdDays: 30,
      versionCheckPatterns: [],
      deprecationRequiresMigration: true,
      crossReferenceEnabled: true,
    },
  },
};
```

## Consequences

### Positive
- Comprehensive test coverage for detector flow
- Follows established testing patterns in the codebase
- Tests integration between IdleProcessor, detectors, and analyzers
- Validates event emission contract

### Negative
- Requires mocking multiple detectors
- Tests may become fragile if detector interfaces change
- Some tests overlap with existing unit tests

### Mitigations
- Use typed mock interfaces to catch breaking changes
- Keep mock structures aligned with actual implementations
- Document mock update requirements in test file

## Related

- `stale-comment-detector.idle-integration.test.ts` - Reference test patterns
- `idle-processor-detector-events.test.ts` - Event emission patterns
- `docs-analyzer.test.ts` - DocsAnalyzer unit tests
- ADR-007 (if exists) - Previous documentation decisions
