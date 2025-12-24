# ADR-062: Enhanced DocsAnalyzer Task Candidate Generation

## Status
Proposed

## Context

The `DocsAnalyzer` in `packages/orchestrator/src/analyzers/docs-analyzer.ts` currently generates task candidates from `ProjectAnalysis.documentation` data, but it does not utilize all the available enhanced documentation analysis fields introduced in v0.4.0.

### Current State

The analyzer currently processes:
- `coverage` - Documentation coverage percentage
- `missingDocs` - Array of files without documentation
- `outdatedDocs` - Array of `OutdatedDocumentation` (version-mismatch, stale-reference, broken-link, deprecated-api)

### Missing Processing

The following fields from `EnhancedDocumentationAnalysis` are available but **not** used for task generation:
1. `undocumentedExports: UndocumentedExport[]` - Exports missing JSDoc documentation
2. `missingReadmeSections: MissingReadmeSection[]` - README sections that should be added
3. `apiCompleteness: APICompleteness` - API documentation completeness details

### Requirements (Acceptance Criteria)

DocsAnalyzer.analyze() must generate specific task candidates for:
1. **Undocumented exports** - High priority for public APIs
2. **Outdated docs** - Version mismatches as high, stale comments as low (already implemented)
3. **Missing README sections** - Based on priority (required/recommended/optional)
4. **Incomplete API documentation** - Based on apiCompleteness data

## Decision

### Architecture Overview

Extend `DocsAnalyzer.analyze()` with three new processing methods that follow the established patterns for severity-based task grouping:

```
DocsAnalyzer.analyze()
├── Existing processors:
│   ├── processStaleComments()       - Priority 5
│   ├── processVersionMismatches()   - Priority 6
│   ├── processBrokenLinks()         - Priority 7
│   └── processDeprecatedApiDocs()   - Priority 8
└── NEW processors:
    ├── processUndocumentedExports() - Priority 9  (High priority for public APIs)
    ├── processMissingReadmeSections() - Priority 10
    └── processIncompleteApiDocs()   - Priority 11
```

### Detailed Design

#### 1. Undocumented Exports Processing

**Data Source**: `analysis.documentation.undocumentedExports: UndocumentedExport[]`

**Data Structure**:
```typescript
interface UndocumentedExport {
  file: string;       // File path
  name: string;       // Export name
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
  line: number;       // Line number
  isPublic: boolean;  // Public API indicator
}
```

**Task Generation Strategy**:

| Condition | Priority | Score | Candidate ID | Title |
|-----------|----------|-------|--------------|-------|
| Public API exports (isPublic: true) > 0 | `'high'` | 0.85 | `undocumented-public-exports` | "Document Public API Exports" |
| Non-public exports with critical types (class, interface) | `'normal'` | 0.65 | `undocumented-critical-types` | "Document Core Type Exports" |
| Other undocumented exports > 5 | `'low'` | 0.45 | `undocumented-exports` | "Add JSDoc to Undocumented Exports" |

**Rationale**: Public APIs are user-facing and require documentation for usability. Classes and interfaces define contracts and require clear documentation.

**Effort Estimation**:
- 1-5 exports: `'low'`
- 6-15 exports: `'medium'`
- 16+ exports: `'high'`

#### 2. Missing README Sections Processing

**Data Source**: `analysis.documentation.missingReadmeSections: MissingReadmeSection[]`

**Data Structure**:
```typescript
interface MissingReadmeSection {
  section: ReadmeSection;  // 'title' | 'description' | 'installation' | 'usage' | etc.
  priority: 'required' | 'recommended' | 'optional';
  description: string;
}
```

**Task Generation Strategy**:

| Condition | Priority | Score | Candidate ID | Title |
|-----------|----------|-------|--------------|-------|
| Missing required sections > 0 | `'high'` | 0.8 | `readme-required-sections` | "Add Required README Sections" |
| Missing recommended sections > 0 (no required) | `'normal'` | 0.55 | `readme-recommended-sections` | "Add Recommended README Sections" |
| Missing optional sections > 2 (no required/recommended) | `'low'` | 0.35 | `readme-optional-sections` | "Enhance README with Additional Sections" |

**Rationale**: Required sections are essential for project usability. Recommended sections improve the developer experience. Optional sections provide polish.

**Effort Estimation**:
- 1-2 sections: `'low'`
- 3-4 sections: `'medium'`
- 5+ sections: `'high'`

#### 3. Incomplete API Documentation Processing

**Data Source**: `analysis.documentation.apiCompleteness: APICompleteness`

**Data Structure**:
```typescript
interface APICompleteness {
  percentage: number;  // 0-100
  details: {
    totalEndpoints: number;
    documentedEndpoints: number;
    undocumentedItems: Array<{
      name: string;
      file: string;
      type: 'endpoint' | 'method' | 'function' | 'class';
      line?: number;
    }>;
    wellDocumentedExamples: string[];
    commonIssues: string[];
  };
}
```

**Task Generation Strategy**:

| Condition | Priority | Score | Candidate ID | Title |
|-----------|----------|-------|--------------|-------|
| API coverage < 30% | `'high'` | 0.75 | `api-docs-critical` | "Document Critical API Surface" |
| API coverage 30-60% | `'normal'` | 0.55 | `api-docs-improvement` | "Improve API Documentation Coverage" |
| API coverage 60-80% with undocumented items | `'low'` | 0.4 | `api-docs-completion` | "Complete API Documentation" |
| Has commonIssues (even with good coverage) | `'low'` | 0.3 | `api-docs-quality` | "Address API Documentation Quality Issues" |

**Rationale**: Low API coverage indicates major gaps affecting usability. Medium coverage suggests ongoing work. High coverage with issues needs polish.

**Effort Estimation**:
- Based on `undocumentedItems.length`:
  - 1-10 items: `'low'`
  - 11-25 items: `'medium'`
  - 26+ items: `'high'`

### Integration Points

#### Method Signature (unchanged)
```typescript
analyze(analysis: ProjectAnalysis): TaskCandidate[];
```

#### Processing Order
The new methods are added after existing ones to maintain backward compatibility:

```typescript
analyze(analysis: ProjectAnalysis): TaskCandidate[] {
  const candidates: TaskCandidate[] = [];
  const { coverage, missingDocs, outdatedDocs, undocumentedExports, missingReadmeSections, apiCompleteness } = analysis.documentation;

  // Priority 1-4: Existing coverage and missing docs processing
  // ...

  // Priority 5-8: Existing outdated docs processing
  this.processStaleComments(outdatedDocs, candidates);
  this.processVersionMismatches(outdatedDocs, candidates);
  this.processBrokenLinks(outdatedDocs, candidates);
  this.processDeprecatedApiDocs(outdatedDocs, candidates);

  // Priority 9-11: NEW enhanced processing
  this.processUndocumentedExports(undocumentedExports, candidates);
  this.processMissingReadmeSections(missingReadmeSections, candidates);
  this.processIncompleteApiDocs(apiCompleteness, candidates);

  return candidates;
}
```

### Scoring and Prioritization

All task candidates use the existing `BaseAnalyzer.prioritize()` method which selects the highest-scoring candidate. The score values are designed to:

1. **Undocumented public exports** (0.85) - Higher than most other doc tasks
2. **Missing required README sections** (0.8) - Same as critical outdated docs
3. **Critical API docs** (0.75) - Below public exports but high priority
4. **Undocumented critical types** (0.65) - Normal priority
5. **API docs improvement** (0.55) - Normal priority
6. **Recommended README sections** (0.55) - Normal priority
7. **Other undocumented exports** (0.45) - Low priority
8. **API docs completion** (0.4) - Low priority
9. **Optional README sections** (0.35) - Lowest priority
10. **API docs quality** (0.3) - Lowest priority (polish work)

### Edge Cases

1. **Empty arrays**: Methods gracefully handle empty inputs with no task generation
2. **Already well-documented projects**: API coverage >= 80% with no issues generates no tasks
3. **No README file**: Results in all sections being "missing" (handled by missingReadmeSections)
4. **Conflicting priorities**: Higher-scored tasks take precedence via `prioritize()`

## Test Strategy

### Unit Tests to Add

1. **Undocumented Exports Tests**:
   - Task generation for public API exports (high priority)
   - Task generation for class/interface exports (normal priority)
   - Task generation for many undocumented exports (low priority)
   - No task when no undocumented exports
   - Correct effort estimation based on count

2. **Missing README Sections Tests**:
   - Task generation for required sections (high priority)
   - Task generation for recommended sections only (normal priority)
   - Task generation for optional sections only (low priority)
   - Severity precedence (required > recommended > optional)
   - Correct section listing in description

3. **Incomplete API Documentation Tests**:
   - Task generation for < 30% coverage (high priority)
   - Task generation for 30-60% coverage (normal priority)
   - Task generation for 60-80% coverage with issues (low priority)
   - Quality issues task for well-documented APIs with commonIssues
   - No task for 80%+ coverage with no issues

4. **Integration Tests**:
   - All three new processors work together
   - Integration with existing processors
   - Correct prioritization across all task types

## Files to Modify

| File | Changes |
|------|---------|
| `packages/orchestrator/src/analyzers/docs-analyzer.ts` | Add 3 new private methods and integrate into `analyze()` |
| `packages/orchestrator/src/analyzers/docs-analyzer.test.ts` | Add test suites for each new processor |

## Consequences

### Positive
- Complete utilization of EnhancedDocumentationAnalysis data
- Specific, actionable task candidates for all documentation issues
- Consistent scoring and prioritization across all task types
- Public API documentation gets appropriate priority
- README section gaps are explicitly identified

### Negative
- More task candidates may be generated per analysis cycle
- Increased complexity in DocsAnalyzer (mitigated by modular methods)
- Additional tests to maintain

### Risks
- **Task explosion**: Mitigated by severity-based grouping (one task per tier)
- **Performance**: Arrays are pre-filtered in IdleProcessor, should be reasonable size

## Implementation Notes

1. The implementation should use the existing `createCandidate()` helper method
2. All candidate IDs should use the `docs-` prefix (handled by BaseAnalyzer)
3. Effort estimation should be consistent with existing patterns
4. Descriptions should include specific counts and examples where helpful

## References

- `EnhancedDocumentationAnalysis` type: `packages/core/src/types.ts:919-932`
- `UndocumentedExport` type: `packages/core/src/types.ts:823-834`
- `MissingReadmeSection` type: `packages/core/src/types.ts:876-883`
- `APICompleteness` type: `packages/core/src/types.ts:905-914`
- Existing stale-reference handling: `packages/orchestrator/src/analyzers/docs-analyzer.ts:142-196`
- IdleProcessor documentation analysis: `packages/orchestrator/src/idle-processor.ts:774-904`
