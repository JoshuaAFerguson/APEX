# ADR-063: TODO/FIXME/HACK Comment Detection Architecture

## Status
Proposed

## Context

The APEX platform needs to detect and categorize TODO/FIXME/HACK comments from `ProjectAnalysis` data, calculate age-based severity, and output findings to the `TechnicalDebtAnalysis.categories` array under the `'documentation'` category.

### Current State Analysis

1. **StaleCommentDetector** (`packages/orchestrator/src/stale-comment-detector.ts`):
   - Already detects TODO/FIXME/HACK comments using regex patterns
   - Uses git blame to determine comment age
   - Calculates severity based on age thresholds (1x/2x/3x threshold days)
   - Outputs `OutdatedDocumentation[]` with type `'stale-reference'`

2. **TechnicalDebtAnalyzer** (`packages/orchestrator/src/analyzers/technical-debt-analyzer.ts`):
   - Has `buildDebtCategories()` method that creates `TechnicalDebtAnalysis.categories`
   - Currently uses lint issues as a "proxy" for TODO comments (see `analyzeLintIssues()`)
   - Does NOT directly consume `documentation.outdatedDocs` from `ProjectAnalysis`

3. **ProjectAnalysis** (`packages/orchestrator/src/idle-processor.ts`):
   - Has `documentation: EnhancedDocumentationAnalysis` field
   - `EnhancedDocumentationAnalysis.outdatedDocs` contains stale comments (from `StaleCommentDetector`)
   - `OutdatedDocumentation` has `type: 'stale-reference'` for TODO comments

4. **TechnicalDebtAnalysis** schema (`packages/core/src/types.ts`):
   - `categories` array supports `'documentation'` as a valid category type
   - Each category has: `category`, `count`, `severity`, `examples[]`, `estimatedEffort`

### Gap Analysis

The current implementation has a disconnect:
- `StaleCommentDetector` outputs to `ProjectAnalysis.documentation.outdatedDocs`
- `TechnicalDebtAnalyzer` does NOT read from `documentation.outdatedDocs`
- Instead, it uses `lintIssues` as a proxy (which is inaccurate)
- No `'documentation'` category is being created from actual TODO/FIXME/HACK findings

## Decision

### Solution Overview

Enhance `TechnicalDebtAnalyzer` to:
1. Extract TODO/FIXME/HACK comments from `ProjectAnalysis.documentation.outdatedDocs`
2. Categorize comments by type (TODO, FIXME, HACK)
3. Calculate severity based on existing age data
4. Output to `TechnicalDebtAnalysis.categories` with `category: 'documentation'`

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Data Flow                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌───────────────────────────┐                      │
│  │ StaleComment     │    │ ProjectAnalysis           │                      │
│  │ Detector         │───▶│   documentation:          │                      │
│  │                  │    │     outdatedDocs[]        │                      │
│  └──────────────────┘    │       type: 'stale-       │                      │
│                          │             reference'    │                      │
│                          └───────────────────────────┘                      │
│                                      │                                       │
│                                      ▼                                       │
│                          ┌───────────────────────────┐                      │
│                          │ TechnicalDebtAnalyzer     │                      │
│                          │   analyzeTodoComments()   │◀── NEW METHOD        │
│                          │   buildDebtCategories()   │                      │
│                          └───────────────────────────┘                      │
│                                      │                                       │
│                                      ▼                                       │
│                          ┌───────────────────────────┐                      │
│                          │ TechnicalDebtAnalysis     │                      │
│                          │   categories: [           │                      │
│                          │     {                     │                      │
│                          │       category:           │                      │
│                          │         'documentation',  │◀── OUTPUT            │
│                          │       count: N,           │                      │
│                          │       severity: X,        │                      │
│                          │       examples: [...]     │                      │
│                          │     }                     │                      │
│                          │   ]                       │                      │
│                          └───────────────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Details

#### 1. New Method: `analyzeTodoComments()`

Add to `TechnicalDebtAnalyzer.analyze()`:

```typescript
// In analyze() method, add:
// 9. Analyze TODO/FIXME/HACK comments from documentation.outdatedDocs
this.analyzeTodoComments(analysis, candidates);
```

New private method:

```typescript
/**
 * Analyze TODO/FIXME/HACK comments from documentation analysis
 */
private analyzeTodoComments(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
  const outdatedDocs = analysis.documentation?.outdatedDocs ?? [];

  // Filter for stale-reference type (TODO/FIXME/HACK comments)
  const staleComments = outdatedDocs.filter(doc => doc.type === 'stale-reference');

  if (staleComments.length === 0) {
    return;
  }

  // Categorize by comment type (extracted from description)
  const todoComments = staleComments.filter(c => c.description.includes('TODO'));
  const fixmeComments = staleComments.filter(c => c.description.includes('FIXME'));
  const hackComments = staleComments.filter(c => c.description.includes('HACK'));

  // Determine overall severity based on highest individual severity
  const criticalCount = staleComments.filter(c => c.severity === 'high').length;
  const mediumCount = staleComments.filter(c => c.severity === 'medium').length;

  const remediationSuggestions: RemediationSuggestion[] = [];

  // Add FIXME-specific remediation (highest priority)
  if (fixmeComments.length > 0) {
    remediationSuggestions.push({
      type: 'manual_review',
      description: `Address ${fixmeComments.length} FIXME comments - these indicate known bugs or broken functionality`,
      priority: 'critical',
      expectedOutcome: 'Resolved bugs and improved code stability',
    });
  }

  // Add HACK-specific remediation
  if (hackComments.length > 0) {
    remediationSuggestions.push({
      type: 'refactoring',
      description: `Refactor ${hackComments.length} HACK comments - these indicate technical shortcuts that need proper implementation`,
      priority: 'high',
      expectedOutcome: 'Cleaner, more maintainable code',
    });
  }

  // Add TODO-specific remediation
  if (todoComments.length > 0) {
    remediationSuggestions.push({
      type: 'manual_review',
      description: `Review ${todoComments.length} TODO comments and create tasks for unfinished work`,
      priority: 'medium',
      expectedOutcome: 'Completed features and reduced technical debt',
    });
  }

  candidates.push(this.createCandidate(
    'stale-comments',
    'Address Stale TODO/FIXME/HACK Comments',
    `Found ${staleComments.length} stale comments (${todoComments.length} TODO, ${fixmeComments.length} FIXME, ${hackComments.length} HACK). ${criticalCount} are high severity (>90 days old).`,
    {
      priority: criticalCount > 0 ? 'high' : mediumCount > 0 ? 'normal' : 'low',
      effort: staleComments.length > 20 ? 'high' : staleComments.length > 10 ? 'medium' : 'low',
      workflow: 'maintenance',
      rationale: 'Stale TODO/FIXME/HACK comments represent accumulated technical debt and unfinished work',
      score: 0.5 + Math.min(0.4, staleComments.length * 0.02) + (criticalCount * 0.05),
      remediationSuggestions,
    }
  ));
}
```

#### 2. Update `buildDebtCategories()` for Documentation Category

Add documentation category creation:

```typescript
private buildDebtCategories(analysis: ProjectAnalysis): TechnicalDebtAnalysis['categories'] {
  const categories: TechnicalDebtAnalysis['categories'] = [];

  // ... existing category building code ...

  // Documentation category (TODO/FIXME/HACK comments)
  const documentationCategory = this.createDocumentationCategory(analysis);
  if (documentationCategory) {
    categories.push(documentationCategory);
  }

  return categories;
}
```

New helper method:

```typescript
/**
 * Create documentation category from TODO/FIXME/HACK comments and doc coverage
 */
private createDocumentationCategory(analysis: ProjectAnalysis): TechnicalDebtAnalysis['categories'][number] | null {
  const outdatedDocs = analysis.documentation?.outdatedDocs ?? [];
  const staleComments = outdatedDocs.filter(doc => doc.type === 'stale-reference');
  const docCoverage = analysis.documentation?.coverage ?? 100;

  // Count issues
  let totalIssues = staleComments.length;

  // Add undocumented exports as a factor
  const undocumentedExports = analysis.documentation?.undocumentedExports?.length ?? 0;
  totalIssues += Math.floor(undocumentedExports / 5); // Group undocumented exports

  if (totalIssues === 0 && docCoverage >= 80) {
    return null;
  }

  // Calculate severity
  const highSeverityCount = staleComments.filter(c => c.severity === 'high').length;
  const mediumSeverityCount = staleComments.filter(c => c.severity === 'medium').length;

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (highSeverityCount > 5 || (highSeverityCount > 0 && staleComments.length > 20)) {
    severity = 'critical';
  } else if (highSeverityCount > 0 || mediumSeverityCount > 5) {
    severity = 'high';
  } else if (mediumSeverityCount > 0 || staleComments.length > 10) {
    severity = 'medium';
  }

  // Build examples
  const examples: string[] = [];

  // Add comment examples by type
  const todoComments = staleComments.filter(c => c.description.includes('TODO'));
  const fixmeComments = staleComments.filter(c => c.description.includes('FIXME'));
  const hackComments = staleComments.filter(c => c.description.includes('HACK'));

  if (fixmeComments.length > 0) {
    examples.push(`${fixmeComments.length} FIXME comments (bugs/broken code)`);
  }
  if (hackComments.length > 0) {
    examples.push(`${hackComments.length} HACK comments (technical shortcuts)`);
  }
  if (todoComments.length > 0) {
    examples.push(`${todoComments.length} TODO comments (unfinished work)`);
  }
  if (docCoverage < 80) {
    examples.push(`${docCoverage}% documentation coverage`);
  }

  // Estimate effort
  let estimatedEffort: string;
  if (totalIssues > 30) {
    estimatedEffort = '1-2 weeks';
  } else if (totalIssues > 15) {
    estimatedEffort = '3-5 days';
  } else if (totalIssues > 5) {
    estimatedEffort = '1-2 days';
  } else {
    estimatedEffort = '2-4 hours';
  }

  return {
    category: 'documentation',
    count: totalIssues,
    severity,
    examples: examples.slice(0, 3),
    estimatedEffort,
  };
}
```

#### 3. Update `calculateTotalDebtScore()` for Documentation

The existing documentation weight handling already exists:

```typescript
// Documentation (existing code at line 692-697)
const documentation = analysis.documentation;
if (documentation && documentation.coveragePercentage < 80) {
  // ... existing logic
}
```

Enhance to include stale comments:

```typescript
// Documentation (includes stale comments)
const documentation = analysis.documentation;
const staleComments = documentation?.outdatedDocs?.filter(d => d.type === 'stale-reference') ?? [];

if (staleComments.length > 0 || (documentation && documentation.coverage < 80)) {
  // Calculate documentation debt score
  let categoryScore = 0;

  // Stale comments contribute to score
  if (staleComments.length > 0) {
    categoryScore += Math.min(50, staleComments.length * 3 * Math.log2(staleComments.length + 1));
  }

  // Low coverage contributes to score
  if (documentation && documentation.coverage < 80) {
    categoryScore += Math.min(50, (80 - documentation.coverage) * 1.25);
  }

  categoryScore = Math.min(100, categoryScore);

  // Calculate average severity from stale comments
  const avgSeverity = staleComments.length > 0
    ? this.getAverageSeverityMultiplier(
        staleComments.map(c => c.severity as 'low' | 'medium' | 'high'),
        severityMultipliers
      )
    : (documentation && documentation.coverage < 50) ? 0.75 : 0.5;

  totalScore += categoryWeights['documentation'] * categoryScore * avgSeverity;
}
```

### Severity Calculation

| Comment Age | Severity | Multiplier |
|-------------|----------|------------|
| 30-59 days  | low      | 0.25       |
| 60-89 days  | medium   | 0.50       |
| 90+ days    | high     | 0.75       |

| Comment Type | Priority Weight |
|--------------|-----------------|
| FIXME        | critical (1.0)  |
| HACK         | high (0.75)     |
| TODO         | medium (0.50)   |

### Comment Type Categorization

The type is extracted from the `description` field which follows the format:
`"{TYPE} comment added {N} days ago by {author}"`

```typescript
const commentType = description.includes('FIXME') ? 'FIXME'
                  : description.includes('HACK') ? 'HACK'
                  : 'TODO';
```

## Consequences

### Positive

1. **Accurate Detection**: Uses actual comment data instead of lint issues proxy
2. **Type Categorization**: Distinguishes between TODO/FIXME/HACK with appropriate priorities
3. **Age-Based Severity**: Leverages existing StaleCommentDetector's git blame data
4. **Documentation Category**: Properly outputs to the `'documentation'` category as required
5. **Unified Scoring**: Integrates with existing debt scoring system

### Negative

1. **Dependency on Git**: Age-based severity requires git history (graceful fallback exists)
2. **Regex Parsing**: Comment type extraction relies on description format

### Neutral

1. **No Schema Changes**: Uses existing `TechnicalDebtAnalysis` schema
2. **Backward Compatible**: Existing lint issues analysis remains (can be deprecated later)

## Implementation Plan

### Phase 1: Core Implementation
1. Add `analyzeTodoComments()` method to `TechnicalDebtAnalyzer`
2. Add `createDocumentationCategory()` helper method
3. Update `buildDebtCategories()` to include documentation category
4. Update `calculateTotalDebtScore()` for stale comments

### Phase 2: Testing
1. Unit tests for `analyzeTodoComments()`
2. Unit tests for `createDocumentationCategory()`
3. Integration test verifying end-to-end flow
4. Edge case tests (no comments, mixed types, etc.)

### Phase 3: Cleanup
1. Deprecate/remove lint issues proxy in `analyzeLintIssues()`
2. Update documentation

## Files to Modify

| File | Changes |
|------|---------|
| `packages/orchestrator/src/analyzers/technical-debt-analyzer.ts` | Add new methods, update existing methods |
| `packages/orchestrator/src/analyzers/technical-debt-analyzer.test.ts` | Add unit tests |

## Acceptance Criteria Verification

- [x] Analyzer detects TODO/FIXME/HACK comments from ProjectAnalysis
- [x] Comments categorized by type (TODO, FIXME, HACK)
- [x] Age-based severity calculated (uses StaleCommentDetector data)
- [x] Output to TechnicalDebtAnalysis.categories with `'documentation'` category

## References

- `StaleCommentDetector` implementation
- `TechnicalDebtAnalysis` schema
- `OutdatedDocumentation` interface
- Existing analyzer patterns (BaseAnalyzer, TaskCandidate)
