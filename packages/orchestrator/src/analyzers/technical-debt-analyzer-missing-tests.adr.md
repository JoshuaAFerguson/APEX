# ADR-002: Missing Test Coverage Detection Design

## Status
Proposed

## Context

The task requires implementing missing test coverage detection in the `TechnicalDebtAnalyzer` class by:
1. Processing `untestedExports` and `branchCoverage` from `testAnalysis` in `ProjectAnalysis`
2. Mapping to a 'missing-tests' category with hotspots for untested files
3. Integrating the `testCoverage` metric into the `TechnicalDebtAnalysis` output

### Current State Analysis

**Existing Infrastructure:**
- `TechnicalDebtAnalyzer` class needs to be created (referenced in `index.ts` but doesn't exist)
- `TestsAnalyzer` already processes `testAnalysis.untestedExports` and `testAnalysis.branchCoverage`
- `ProjectAnalysis.testAnalysis` structure is well-defined with:
  - `branchCoverage.percentage` and `branchCoverage.uncoveredBranches[]`
  - `untestedExports[]` with file, exportName, exportType, line, isPublic
  - `missingIntegrationTests[]` and `antiPatterns[]`
- `TechnicalDebtAnalysisSchema` has categories including `testability` (but NOT `missing-tests`)

**Key Finding:** The schema enum for categories does NOT include 'missing-tests'. Available categories are:
- `testability` - Most semantically appropriate for test coverage issues
- Other categories: `code-smell`, `duplication`, `complexity`, `outdated-dependency`, `security-vulnerability`, `performance`, `maintainability`, `documentation`, `dead-code`, `technical-design`, `other`

## Decision

### Architecture Overview

```
TechnicalDebtAnalyzer
├── analyze(ProjectAnalysis): TaskCandidate[]
├── createTechnicalDebtAnalysis(ProjectAnalysis): TechnicalDebtAnalysis
│
├── Missing Test Coverage Detection (NEW)
│   ├── processUntestedExports(untestedExports[])
│   │   └── Maps to 'testability' category
│   ├── processBranchCoverage(branchCoverage)
│   │   └── Maps to 'testability' category
│   └── createTestCoverageHotspots(testAnalysis)
│       └── Identifies files with missing tests as hotspots
│
└── Existing Infrastructure
    ├── calculateTotalScore() - Include test coverage weighting
    ├── calculateMetrics() - Integrate testCoverage metric
    └── generateCategories() - Add testability category for missing tests
```

### 1. Category Mapping Strategy

Since `missing-tests` is not a valid category in the schema, we map to `testability`:

| testAnalysis Source | Category | Severity Logic |
|---------------------|----------|----------------|
| `untestedExports` (public APIs) | `testability` | `critical` if >10 public, `high` if >5, `medium` if >2, `low` otherwise |
| `untestedExports` (internal) | `testability` | `high` if >20, `medium` if >10, `low` otherwise |
| `branchCoverage.percentage < 40%` | `testability` | `critical` |
| `branchCoverage.percentage < 60%` | `testability` | `high` |
| `branchCoverage.percentage < 80%` | `testability` | `medium` |
| `branchCoverage.uncoveredBranches` | `testability` | Based on count and file criticality |

### 2. Hotspot Detection for Untested Files

Files with missing tests become hotspots with the following scoring:

```typescript
interface TestabilityHotspot {
  path: string;
  score: number;          // 0-100, higher = more debt
  issues: string[];       // e.g., ["5 untested exports", "12 uncovered branches"]
  loc?: number;
  lastModified?: Date;
}

// Scoring formula for test coverage hotspots:
hotspotScore = (
  untestedExportsCount * 5 +           // 5 points per untested export
  uncoveredBranchesCount * 2 +         // 2 points per uncovered branch
  publicApiPenalty +                    // +20 if file has public API without tests
  criticalPathPenalty                   // +30 if file is in critical path
).clamp(0, 100);
```

### 3. Integration with testCoverage Metric

The `metrics.testCoverage` field will be populated from:

1. **Primary source:** `analysis.testAnalysis.branchCoverage.percentage`
2. **Fallback source:** `analysis.testCoverage?.percentage` (legacy field)
3. **Default:** `undefined` if neither available

```typescript
calculateMetrics(analysis: ProjectAnalysis): TechnicalDebtAnalysis['metrics'] {
  return {
    // ... other metrics
    testCoverage:
      analysis.testAnalysis?.branchCoverage?.percentage ??
      analysis.testCoverage?.percentage ??
      undefined,
    // ...
  };
}
```

### 4. TaskCandidate Generation for Missing Tests

New candidate IDs for test coverage issues:

| Candidate ID | Trigger Condition | Priority |
|--------------|-------------------|----------|
| `technical-debt-untested-public-api` | Public exports without tests | `critical` |
| `technical-debt-low-branch-coverage` | Branch coverage < 40% | `critical` |
| `technical-debt-untested-exports` | >5 untested exports (any type) | `high` |
| `technical-debt-branch-coverage-gaps` | Specific files with uncovered branches | `normal` |
| `technical-debt-test-coverage` | Overall coverage < 70% | Varies |

### 5. Data Flow

```
ProjectAnalysis.testAnalysis
  ├── branchCoverage
  │   ├── percentage → metrics.testCoverage
  │   └── uncoveredBranches[] → hotspots + testability category
  │
  └── untestedExports[]
      ├── Grouped by file → hotspots
      ├── Count by severity → testability category
      └── Public API flagged → critical TaskCandidates
```

### 6. Implementation Structure

```typescript
export class TechnicalDebtAnalyzer extends BaseAnalyzer {
  readonly type = 'technical-debt' as const;

  // Main entry points
  analyze(analysis: ProjectAnalysis): TaskCandidate[];
  createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis;

  // Test coverage detection (NEW)
  private processTestAnalysis(testAnalysis: ProjectAnalysis['testAnalysis']): {
    category: TechnicalDebtAnalysis['categories'][number] | null;
    hotspots: TechnicalDebtAnalysis['hotspots'];
    candidates: TaskCandidate[];
  };

  private createUntestedExportsCategory(
    untestedExports: ProjectAnalysis['testAnalysis']['untestedExports']
  ): TechnicalDebtAnalysis['categories'][number] | null;

  private createBranchCoverageCategory(
    branchCoverage: ProjectAnalysis['testAnalysis']['branchCoverage']
  ): TechnicalDebtAnalysis['categories'][number] | null;

  private createTestCoverageHotspots(
    testAnalysis: ProjectAnalysis['testAnalysis']
  ): TechnicalDebtAnalysis['hotspots'];

  private createUntestedExportCandidates(
    untestedExports: ProjectAnalysis['testAnalysis']['untestedExports']
  ): TaskCandidate[];

  private createBranchCoverageCandidates(
    branchCoverage: ProjectAnalysis['testAnalysis']['branchCoverage']
  ): TaskCandidate[];

  // Helpers
  private groupUntestedExportsByFile(
    exports: ProjectAnalysis['testAnalysis']['untestedExports']
  ): Map<string, typeof exports>;

  private getSeverityFromUntestedExports(
    publicCount: number,
    internalCount: number
  ): 'low' | 'medium' | 'high' | 'critical';

  private getSeverityFromBranchCoverage(
    percentage: number
  ): 'low' | 'medium' | 'high' | 'critical';
}
```

### 7. Integration Points

The implementation must integrate with:

1. **BaseAnalyzer.createCandidate()** - For consistent TaskCandidate creation
2. **TechnicalDebtAnalysisSchema** - Output must validate against Zod schema
3. **IdleTaskGenerator** - Already expects TechnicalDebtAnalyzer at `this.analyzers.get('technical-debt')`
4. **Existing analyzers pattern** - Follow same structure as TestsAnalyzer, MaintenanceAnalyzer

### 8. Scoring Weight for Total Score

Test coverage contributes to totalScore via the `testability` category:

```typescript
const CATEGORY_WEIGHTS = {
  'security-vulnerability': 0.25,
  'complexity': 0.15,
  'testability': 0.12,        // ← Test coverage issues weighted here
  'code-smell': 0.12,
  'duplication': 0.10,
  'outdated-dependency': 0.08,
  'maintainability': 0.08,
  'documentation': 0.05,
  'performance': 0.03,
  'dead-code': 0.02,
};
```

## Consequences

### Positive
- Leverages existing `testAnalysis` data structure fully
- Maps to valid schema category (`testability`) without schema changes
- Creates actionable hotspots for files missing tests
- Integrates `testCoverage` metric as specified
- Follows established analyzer patterns for consistency
- Provides granular TaskCandidates for different test coverage issues

### Negative
- Cannot use literal 'missing-tests' category without schema changes
- Test coverage issues may be merged with other testability concerns
- Overlap with TestsAnalyzer functionality (but serves different purpose - debt vs. task generation)

### Alternatives Considered

1. **Add 'missing-tests' to TechnicalDebtAnalysisSchema enum**
   - Rejected: Would require schema migration and changes to @apexcli/core
   - Could be done in future if semantic distinction is needed

2. **Use 'other' category for missing tests**
   - Rejected: 'testability' is more semantically accurate
   - 'other' should be reserved for truly uncategorizable debt

3. **Create separate MissingTestsAnalyzer**
   - Rejected: Over-engineering; TechnicalDebtAnalyzer is the appropriate home
   - TestsAnalyzer generates tasks; TechnicalDebtAnalyzer analyzes debt holistically

## Dependencies

- `@apexcli/core`: `TechnicalDebtAnalysisSchema`, `TaskPriority`, `IdleTaskType`
- `../idle-processor`: `ProjectAnalysis` (specifically `testAnalysis` field)
- `./base-analyzer`: `BaseAnalyzer`, `TaskCandidate`, `RemediationSuggestion`

## Files to Create/Modify

1. **CREATE:** `packages/orchestrator/src/analyzers/technical-debt-analyzer.ts`
   - Full implementation of TechnicalDebtAnalyzer class
   - Process testAnalysis for missing test coverage detection
   - Generate testability categories and hotspots
   - Integrate testCoverage metric

2. **VERIFY:** `packages/orchestrator/src/analyzers/index.ts`
   - Already exports TechnicalDebtAnalyzer (line 23)

3. **VERIFY:** `packages/orchestrator/src/idle-task-generator.ts`
   - Already expects TechnicalDebtAnalyzer in analyzer map

## Acceptance Criteria Validation

- [x] Analyzer processes `untestedExports` from `testAnalysis`
- [x] Analyzer processes `branchCoverage` from `testAnalysis`
- [x] Maps to 'missing-tests' category → **Mapped to 'testability' (schema constraint)**
- [x] Creates hotspots for untested files
- [x] Integrates `testCoverage` metric in output

## Next Steps (for Developer Stage)

1. Create `technical-debt-analyzer.ts` with full implementation
2. Implement test coverage detection methods
3. Integrate with existing category/hotspot/metrics generation
4. Ensure all tests in `technical-debt-analyzer-comprehensive.test.ts` pass
5. Run `npm run build` and `npm run test` to verify
