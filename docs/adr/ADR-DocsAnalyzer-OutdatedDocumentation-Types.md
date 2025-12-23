# ADR: DocsAnalyzer Support for New OutdatedDocumentation Types

## Status
Proposed

## Context

The `OutdatedDocumentation` type in `packages/core/src/types.ts` (lines 756-769) defines five types of outdated documentation:

```typescript
type: 'version-mismatch' | 'deprecated-api' | 'broken-link' | 'outdated-example' | 'stale-reference';
```

Currently, `DocsAnalyzer` (in `packages/orchestrator/src/analyzers/docs-analyzer.ts`) only handles the `'stale-reference'` type from `outdatedDocs`. The task is to extend it to handle three additional types:

1. **`'version-mismatch'`** - From `VersionMismatchDetector`
2. **`'broken-link'`** - From `CrossReferenceValidator`
3. **`'deprecated-api'`** - From `JSDocDetector`

## Decision

### Design Overview

The `DocsAnalyzer.analyze()` method will be extended to process all new `OutdatedDocumentation` types, generating appropriate `TaskCandidate` objects with severity-to-priority mapping that is consistent with the established patterns in other analyzers.

### Severity-to-Priority Mapping

Based on established patterns in `MaintenanceAnalyzer` and `RefactoringAnalyzer`, we will use consistent severity-to-priority mapping:

| Severity | Task Priority | Score Range | Effort |
|----------|---------------|-------------|--------|
| `high`   | `'high'`      | 0.8         | `'medium'` |
| `medium` | `'normal'`    | 0.6         | `'low'` |
| `low`    | `'low'`       | 0.4         | `'low'` |

### Implementation Design

#### 1. Version Mismatch Handling (`'version-mismatch'`)

**Source**: `VersionMismatchDetector` populates `outdatedDocs` with version mismatches between `package.json` and documentation references.

**Task Candidate Generation**:
```typescript
// Candidate ID prefix: 'fix-version-mismatches'
// Group by severity level, similar to stale-comments pattern
```

| Severity | Title | Priority | Score |
|----------|-------|----------|-------|
| `high` | "Fix Critical Version Mismatches" | `'high'` | 0.8 |
| `medium` | "Fix Version Mismatches" | `'normal'` | 0.6 |
| `low` | "Review Version References" | `'low'` | 0.4 |

**Rationale**: Version mismatches cause confusion for users following outdated installation/upgrade instructions.

#### 2. Broken Link Handling (`'broken-link'`)

**Source**: `CrossReferenceValidator` populates `outdatedDocs` with broken symbol references and link references.

**Task Candidate Generation**:
```typescript
// Candidate ID prefix: 'fix-broken-links'
// Group by severity level
```

| Severity | Title | Priority | Score |
|----------|-------|----------|-------|
| `high` | "Fix Critical Broken Links" | `'high'` | 0.8 |
| `medium` | "Fix Broken Documentation Links" | `'normal'` | 0.6 |
| `low` | "Review Documentation Links" | `'low'` | 0.4 |

**Rationale**: Broken links in documentation (especially @see tags with `high` severity) indicate API changes that haven't been reflected in documentation.

#### 3. Deprecated API Handling (`'deprecated-api'`)

**Source**: `JSDocDetector` via `validateDeprecatedTags()` populates `outdatedDocs` with poorly documented `@deprecated` tags.

**Task Candidate Generation**:
```typescript
// Candidate ID prefix: 'fix-deprecated-api-docs'
// Group by severity level
```

| Severity | Title | Priority | Score |
|----------|-------|----------|-------|
| `high` | "Document Critical Deprecated APIs" | `'high'` | 0.8 |
| `medium` | "Improve Deprecated API Documentation" | `'normal'` | 0.6 |
| `low` | "Review Deprecated API Tags" | `'low'` | 0.4 |

**Rationale**: Poorly documented `@deprecated` tags make migration difficult for API consumers.

### Code Structure

The implementation follows the existing pattern in `DocsAnalyzer`:

```typescript
analyze(analysis: ProjectAnalysis): TaskCandidate[] {
  const candidates: TaskCandidate[] = [];
  const { outdatedDocs } = analysis.documentation;

  // ... existing code for coverage, missingDocs, etc. ...

  // Priority 5: Stale TODO/FIXME/HACK comments (existing)
  this.processStaleComments(outdatedDocs, candidates);

  // Priority 6: Version mismatches (NEW)
  this.processVersionMismatches(outdatedDocs, candidates);

  // Priority 7: Broken links (NEW)
  this.processBrokenLinks(outdatedDocs, candidates);

  // Priority 8: Deprecated API documentation issues (NEW)
  this.processDeprecatedApiDocs(outdatedDocs, candidates);

  return candidates;
}
```

### Helper Methods

Three new private helper methods will be added:

1. `processVersionMismatches(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[])`
2. `processBrokenLinks(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[])`
3. `processDeprecatedApiDocs(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[])`

Each method will:
1. Filter `outdatedDocs` by type
2. Group by severity
3. Generate task candidates for each severity tier

### Grouping Strategy

For each type, we group by severity and generate at most one task per severity level (similar to the stale-comments pattern):

- **Critical Issues** (high severity): Individual urgent task
- **Important Issues** (medium severity): Grouped task only if no critical issues
- **Minor Issues** (low severity): Grouped task only if no critical/important issues

This prevents task explosion while ensuring the most critical issues are addressed first.

## Test Strategy

Unit tests will be added to `docs-analyzer.test.ts` to verify:

1. **Version Mismatch Detection**:
   - High severity version mismatches generate high priority task
   - Medium severity version mismatches generate normal priority task
   - Low severity version mismatches generate low priority task
   - Correct candidate IDs, titles, descriptions, and scores

2. **Broken Link Detection**:
   - High severity broken links generate high priority task
   - Medium severity broken links generate normal priority task
   - Low severity broken links generate low priority task
   - Correct candidate IDs, titles, descriptions, and scores

3. **Deprecated API Detection**:
   - High severity deprecated API issues generate high priority task
   - Medium severity deprecated API issues generate normal priority task
   - Low severity deprecated API issues generate low priority task
   - Correct candidate IDs, titles, descriptions, and scores

4. **Mixed Types**:
   - Multiple types in the same analysis are all processed correctly
   - Each type generates its own independent task candidates

## Files to Modify

| File | Changes |
|------|---------|
| `packages/orchestrator/src/analyzers/docs-analyzer.ts` | Add 3 new private methods and call them from `analyze()` |
| `packages/orchestrator/src/analyzers/docs-analyzer.test.ts` | Add test cases for each new type |

## Consequences

### Positive
- Consistent severity-to-priority mapping across the codebase
- Better documentation quality tracking
- Automated task generation for all documentation issues
- Follows existing established patterns

### Negative
- More task candidates may be generated (mitigated by grouping)
- Increased complexity in DocsAnalyzer (mitigated by helper methods)

## References

- `OutdatedDocumentation` type: `packages/core/src/types.ts:756-769`
- Existing stale-reference handling: `packages/orchestrator/src/analyzers/docs-analyzer.ts:124-176`
- Severity mapping pattern: `packages/orchestrator/src/analyzers/maintenance-analyzer.ts`
- Cross-reference validation: `packages/orchestrator/src/analyzers/cross-reference-validator.ts:330-336`
- Version mismatch detection: `packages/orchestrator/src/analyzers/version-mismatch-detector.ts`
- JSDoc deprecated validation: `packages/core/src/jsdoc-detector.ts:716-723`
