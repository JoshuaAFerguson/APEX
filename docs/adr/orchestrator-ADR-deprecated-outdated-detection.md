# ADR: Deprecated Code and Outdated Dependency Detection

## Status
**Accepted** - Architecture stage complete

## Context

APEX needs the ability to detect deprecated code and outdated dependencies and integrate these findings into the technical debt analysis system. The acceptance criteria specifies:

- Analyzer processes `outdatedPackages` and `deprecatedPackages` from `ProjectAnalysis.dependencies`
- Analyzer processes `outdatedDocs` from documentation analysis
- Maps findings to `TechnicalDebtAnalysis` categories with `'outdated-dependency'` category and hotspots

## Decision

After analyzing the existing codebase, I found that **the architecture already supports all the required functionality**. The implementation is distributed across multiple analyzers following the Strategy pattern:

### Existing Architecture Components

#### 1. Data Sources (`idle-processor.ts`)

The `ProjectAnalysis` interface already provides the required data:

```typescript
export interface ProjectAnalysis {
  dependencies: {
    outdated: string[];                    // Legacy (deprecated)
    security: string[];                    // Legacy (deprecated)
    outdatedPackages?: OutdatedDependency[];       // ✅ Rich outdated info
    securityIssues?: SecurityVulnerability[];      // Rich security info
    deprecatedPackages?: DeprecatedPackage[];      // ✅ Deprecated packages
  };
  documentation: EnhancedDocumentationAnalysis;  // Contains outdatedDocs
}
```

The `EnhancedDocumentationAnalysis` includes:
```typescript
interface EnhancedDocumentationAnalysis {
  // ...
  outdatedDocs: OutdatedDocumentation[];  // ✅ Outdated documentation
}
```

#### 2. MaintenanceAnalyzer (`maintenance-analyzer.ts`)

Handles dependency maintenance tasks:

| Method | Input | Output |
|--------|-------|--------|
| `processOutdatedPackagesWithScoring()` | `outdatedPackages` | TaskCandidates grouped by updateType (major/minor/patch) |
| `createDeprecatedPackageTask()` | `deprecatedPackages` | TaskCandidates with replacement info |
| `buildOutdatedDependencyRemediation()` | Individual package | Remediation suggestions (npm_update, migration_guide) |

#### 3. TechnicalDebtAnalyzer (`technical-debt-analyzer.ts`)

Consolidates all findings into `TechnicalDebtAnalysis`:

| Method | Input | Maps To |
|--------|-------|---------|
| `analyzeDeprecatedPackages()` | `deprecatedPackages` | TaskCandidates + debt category |
| `analyzeOutdatedDependencies()` | `outdatedPackages` | TaskCandidates + debt category |
| `analyzeOutdatedDocumentation()` | `outdatedDocs` | TaskCandidates + debt category |
| `buildDebtCategories()` | All analysis | `TechnicalDebtAnalysis.categories` |
| `buildDebtHotspots()` | All analysis | `TechnicalDebtAnalysis.hotspots` |

### Category Mapping

The `TechnicalDebtAnalysisSchema` already includes the `'outdated-dependency'` category:

```typescript
categories: z.array(z.object({
  category: z.enum([
    'code-smell',
    'duplication',
    'complexity',
    'outdated-dependency',    // ✅ Exists
    'security-vulnerability',
    'performance',
    'maintainability',
    'testability',
    'documentation',          // ✅ Handles outdatedDocs
    'dead-code',
    'technical-design',
    'other'
  ]),
  // ...
}))
```

### Hotspot Generation

The `buildDebtHotspots()` method creates hotspots from various sources:

1. **Complexity hotspots** - from `complexityHotspots`
2. **Code smell hotspots** - from `codeSmells` grouped by file
3. **Duplication hotspots** - from `duplicatedCode`
4. **Test coverage hotspots** - from `testAnalysis`
5. **Documentation hotspots** - from `outdatedDocs` via `createDocumentationHotspots()`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IdleProcessor                                 │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ analyzeProject() → ProjectAnalysis                            │  │
│   │  ├── analyzeDependencies() → outdatedPackages, deprecatedPkgs│  │
│   │  └── analyzeDocumentation() → outdatedDocs                   │  │
│   └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ ProjectAnalysis
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Strategy Analyzers                              │
│  ┌────────────────────┐    ┌─────────────────────────────────────┐  │
│  │ MaintenanceAnalyzer│    │ TechnicalDebtAnalyzer               │  │
│  │ ─────────────────  │    │ ─────────────────────────────────── │  │
│  │ • outdatedPackages │    │ • analyzeDeprecatedPackages()       │  │
│  │ • deprecatedPkgs   │    │ • analyzeOutdatedDependencies()     │  │
│  │                    │    │ • analyzeOutdatedDocumentation()    │  │
│  │ → TaskCandidates   │    │ • buildDebtCategories()             │  │
│  └────────────────────┘    │ • buildDebtHotspots()               │  │
│                            │                                      │  │
│                            │ → TechnicalDebtAnalysis              │  │
│                            └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   TechnicalDebtAnalysis Output                       │
│  {                                                                   │
│    totalScore: 42,                                                  │
│    categories: [                                                    │
│      { category: 'outdated-dependency', count: 5, severity: 'high' }│
│      { category: 'documentation', count: 3, severity: 'medium' }   │
│    ],                                                               │
│    hotspots: [                                                      │
│      { path: 'src/api.ts', score: 85, issues: [...] }              │
│    ]                                                                │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Scoring Weights (from calculateTotalDebtScore)

| Category | Weight |
|----------|--------|
| security-vulnerability | 0.25 |
| complexity | 0.15 |
| testability | 0.12 |
| code-smell | 0.12 |
| duplication | 0.10 |
| **outdated-dependency** | **0.08** |
| maintainability | 0.08 |
| documentation | 0.05 |
| performance | 0.03 |
| dead-code | 0.02 |

### Severity Multipliers

| Severity | Multiplier |
|----------|------------|
| critical | 1.0 |
| high | 0.75 |
| medium | 0.5 |
| low | 0.25 |

### UpdateType Priority Mapping

For `outdatedPackages`:

| UpdateType | Priority | Base Score |
|------------|----------|------------|
| major | high | 0.8 |
| minor | normal | 0.6 |
| patch | low | 0.4 |

### Documentation Hotspot Scoring

```typescript
// For each file with outdated documentation:
let score = docs.length * 5;           // Base per issue
score += criticalDocs.length * 15;     // High severity penalty
score += mediumDocs.length * 8;        // Medium penalty
score += lowDocs.length * 3;           // Low penalty
score = Math.min(100, score);
```

## Testing Considerations

Key test scenarios to verify:

1. **OutdatedPackages Processing**
   - Major version updates generate high priority tasks
   - Minor/patch updates grouped when count > threshold
   - Remediation suggestions include migration guides for major updates

2. **DeprecatedPackages Processing**
   - Packages with replacements have lower priority than those without
   - Remediation includes package_replacement action type
   - Migration guides generated when replacement available

3. **OutdatedDocs Processing**
   - Grouped by severity (high/medium/low)
   - Documentation hotspots generated from file groupings
   - Different doc types handled (version-mismatch, deprecated-api, stale-reference)

4. **TechnicalDebtAnalysis Integration**
   - `outdated-dependency` category populated from outdatedPackages
   - `documentation` category includes outdatedDocs counts
   - Hotspots include documentation issues with correct scoring

## Consequences

### Positive
- Unified debt scoring across all issue types
- Consistent remediation suggestion format
- Integration with existing analyzer ecosystem
- Backwards compatibility with legacy `outdated`/`security` arrays

### Negative
- Documentation hotspot scoring uses simple heuristics (may need refinement)
- Trend analysis is currently estimated (no historical data)

## Related Files

- `packages/orchestrator/src/analyzers/technical-debt-analyzer.ts`
- `packages/orchestrator/src/analyzers/maintenance-analyzer.ts`
- `packages/orchestrator/src/analyzers/base-analyzer.ts`
- `packages/orchestrator/src/idle-processor.ts`
- `packages/core/src/types.ts` (TechnicalDebtAnalysisSchema)

## References

- [TechnicalDebtAnalysisSchema](/packages/core/src/types.ts#L11117)
- [MaintenanceAnalyzer](/packages/orchestrator/src/analyzers/maintenance-analyzer.ts)
- [TechnicalDebtAnalyzer](/packages/orchestrator/src/analyzers/technical-debt-analyzer.ts)
- [ProjectAnalysis interface](/packages/orchestrator/src/idle-processor.ts#L108)
