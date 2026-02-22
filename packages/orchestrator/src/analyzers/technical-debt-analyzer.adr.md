# ADR-001: Technical Debt Analyzer - Severity Scoring System Design

## Status
Accepted

## Context

The APEX project needs a `TechnicalDebtAnalyzer` class that:
1. Extends `BaseAnalyzer` to integrate with the existing analyzer framework
2. Calculates `totalScore` (0-100) based on weighted category severities
3. Populates the `metrics` object with `codeComplexity`, `testCoverage`, `duplicatedLinesPercent`, and `maintainabilityIndex`
4. Outputs valid `TechnicalDebtAnalysis` schema per `@apexcli/core` types
5. Generates `TaskCandidate` objects for actionable debt remediation

The existing test file (`technical-debt-analyzer-comprehensive.test.ts`) provides clear expectations for the implementation.

## Decision

### Architecture Overview

```
TechnicalDebtAnalyzer
├── extends BaseAnalyzer (type = 'technical-debt')
├── analyze(analysis: ProjectAnalysis): TaskCandidate[]
├── createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis
└── Internal scoring/categorization methods
```

### 1. Severity Scoring Algorithm

The `totalScore` (0-100) will be calculated using a **weighted category contribution model**:

```typescript
totalScore = Σ (categoryWeight × categoryScore × severityMultiplier)
```

**Category Weights** (must sum to 1.0):
| Category | Weight | Rationale |
|----------|--------|-----------|
| security-vulnerability | 0.25 | Highest business risk |
| complexity | 0.15 | Affects maintainability |
| testability | 0.12 | Test coverage impacts reliability |
| code-smell | 0.12 | Code quality indicators |
| duplication | 0.10 | DRY violations |
| outdated-dependency | 0.08 | Maintenance burden |
| maintainability | 0.08 | Long-term health |
| documentation | 0.05 | Knowledge preservation |
| performance | 0.03 | Runtime concerns |
| dead-code | 0.02 | Codebase clarity |

**Severity Multipliers** (normalize impact across severities):
| Severity | Multiplier |
|----------|------------|
| critical | 1.0 |
| high | 0.75 |
| medium | 0.5 |
| low | 0.25 |

**Category Scores** (0-100 based on issue count/threshold):
- Use logarithmic scaling to prevent extreme counts from skewing results
- `categoryScore = min(100, count × scaleFactor × log2(count + 1))`

### 2. Metrics Calculation

**codeComplexity** (0-100+):
- Aggregate average cyclomatic complexity from `complexityHotspots`
- Formula: `Σ cyclomaticComplexity / hotspotCount`
- Falls back to 0 if no hotspots

**testCoverage** (0-100):
- Direct from `analysis.testCoverage.percentage`
- Defaults to 0 if unavailable

**duplicatedLinesPercent** (0-100):
- Calculate from `duplicatedCode` patterns
- Formula: `Σ (pattern.locations.length × pattern.similarity × estimatedLinesPerPattern) / totalLines × 100`
- Estimate 50 lines per pattern if no line count available

**maintainabilityIndex** (0-100):
- Composite metric based on inverse of debt indicators
- Formula: `100 - (complexityPenalty + coveragePenalty + duplicationPenalty + smellPenalty) / 4`
- Each penalty is 0-100 based on thresholds

### 3. Category Generation

Map `ProjectAnalysis` data to `TechnicalDebtAnalysisSchema.categories`:

| Analysis Source | Category | Mapping Logic |
|----------------|----------|---------------|
| `dependencies.securityIssues` | security-vulnerability | Group by severity, count issues |
| `codeQuality.complexityHotspots` | complexity | Severity from thresholds |
| `testCoverage.percentage` | testability | <80%=low, <60%=medium, <40%=high, <20%=critical |
| `codeQuality.codeSmells` | code-smell | Aggregate by smell severity |
| `codeQuality.duplicatedCode` | duplication | Based on similarity and count |
| `dependencies.outdatedPackages` | outdated-dependency | Major=high, Minor=medium, Patch=low |
| `codeQuality.lintIssues` | maintainability | Count thresholds |
| `documentation.coveragePercentage` | documentation | Inverse of coverage |
| `performance.bottlenecks` | performance | Count-based |
| `codeSmells` (dead-code type) | dead-code | From code smell analysis |

### 4. Hotspot Detection

Populate `hotspots` array with highest-debt file locations:
- Source: `complexityHotspots` + files from `codeSmells` + `duplicatedCode` locations
- Score calculation: Sum of all issues affecting each file
- Sort by score descending, return top 10
- Include: path, score (0-100), issues array, loc, lastModified (optional)

### 5. Trend Analysis

For `trends` object:
- `improving`: Compare current score to historical (default false for first run)
- `changeRate`: 0 for initial analysis
- `timeframe`: "current analysis" or "last 30 days"

### 6. TaskCandidate Generation

Generate candidates using the `BaseAnalyzer.createCandidate()` pattern with these IDs:

| Candidate ID | Trigger Condition |
|--------------|-------------------|
| `technical-debt-critical-complexity` | Any hotspot with cyclomatic > 50 |
| `technical-debt-high-complexity` | Any hotspot with cyclomatic 31-50 |
| `technical-debt-security-vulnerabilities` | Any critical/high security issues |
| `technical-debt-test-coverage` | Coverage < 70% |
| `technical-debt-code-duplication` | >3 duplicate patterns |
| `technical-debt-deprecated-dependencies` | Any deprecated packages |
| `technical-debt-major-version-updates` | Any major outdated deps |
| `technical-debt-outdated-dependencies` | Any minor/patch outdated deps |
| `technical-debt-critical-code-smells` | Critical code smells present |
| `technical-debt-todo-comments` | High lint issues (inferred) |

### 7. Error Handling

- All array accesses wrapped with null/undefined checks
- Graceful degradation for corrupted/incomplete data
- Return empty arrays/default values rather than throwing
- Log warnings for malformed input (if logger available)

### 8. Performance Considerations

- Early exit if `ProjectAnalysis` is empty
- Limit hotspot analysis to top 200 files
- Cache intermediate calculations where reused
- Target <500ms for large codebases (5000+ files)

## Implementation Structure

```typescript
export class TechnicalDebtAnalyzer extends BaseAnalyzer {
  readonly type = 'technical-debt' as const;

  // Main analysis method for TaskCandidate generation
  analyze(analysis: ProjectAnalysis): TaskCandidate[];

  // Schema-compliant TechnicalDebtAnalysis creation
  createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis;

  // Internal helpers
  private calculateTotalScore(analysis: ProjectAnalysis): number;
  private calculateMetrics(analysis: ProjectAnalysis): TechnicalDebtAnalysis['metrics'];
  private generateCategories(analysis: ProjectAnalysis): TechnicalDebtAnalysis['categories'];
  private detectHotspots(analysis: ProjectAnalysis): TechnicalDebtAnalysis['hotspots'];
  private calculateTrends(analysis: ProjectAnalysis): TechnicalDebtAnalysis['trends'];

  // Severity classification helpers
  private getSeverityFromCoverage(percentage: number): 'low' | 'medium' | 'high' | 'critical';
  private getSeverityFromComplexity(cyclomatic: number): 'low' | 'medium' | 'high' | 'critical';
  private estimateDuplicationPercentage(patterns: DuplicatePattern[], totalLines: number): number;
}
```

## Consequences

### Positive
- Clear, testable scoring algorithm with documented weights
- Consistent with existing analyzer patterns (BaseAnalyzer, TaskCandidate)
- Schema-validated output via Zod's `TechnicalDebtAnalysisSchema`
- Comprehensive coverage of all debt categories
- Graceful handling of partial/corrupted data

### Negative
- Weights are somewhat arbitrary; may need tuning based on user feedback
- Historical trend analysis requires persistence layer (not in scope)
- Maintainability index is a composite metric that may be hard to explain

### Risks Mitigated
- Test file expectations are clear; design aligns with test assertions
- Reuses proven patterns from RefactoringAnalyzer and MaintenanceAnalyzer

## Dependencies

- `@apexcli/core`: `TechnicalDebtAnalysisSchema`, `ComplexityHotspot`, `CodeSmell`, `DuplicatePattern`
- `../idle-processor`: `ProjectAnalysis`, `SecurityVulnerability`, `OutdatedDependency`, `DeprecatedPackage`
- `./base-analyzer`: `BaseAnalyzer`, `TaskCandidate`, `RemediationSuggestion`
