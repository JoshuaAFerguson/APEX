# ADR-059: Enhanced Complexity Metrics for ProjectAnalysis

## Status
Proposed

## Date
2024-12-20

## Context

The `ProjectAnalysis` interface in `packages/orchestrator/src/idle-processor.ts` currently uses simple `string[]` types for complexity-related fields:

```typescript
codeQuality: {
  lintIssues: number;
  duplicatedCode: string[];      // Just file paths
  complexityHotspots: string[];  // Just file paths
};
```

This limits the ability of analyzers (like `RefactoringAnalyzer`) to make informed prioritization decisions. For example:
- **Complexity Hotspots**: Currently only stores file paths, missing cyclomatic complexity, cognitive complexity, and line counts
- **Duplicated Code**: Only stores file paths without pattern details, locations, or similarity percentages
- **Code Smells**: Not tracked at all (would enable detection of anti-patterns like long methods, large classes)

The task requires extending `ProjectAnalysis.codeQuality` with enhanced structured types to enable better task generation and prioritization.

## Decision

### 1. Define New Types in `idle-processor.ts`

Create three new types to replace simple string arrays with structured data:

```typescript
/**
 * Represents a file with high complexity that may need refactoring
 */
export interface ComplexityHotspot {
  /** Path to the file */
  file: string;
  /** McCabe cyclomatic complexity score */
  cyclomaticComplexity: number;
  /** Cognitive complexity score (Sonar-style) */
  cognitiveComplexity: number;
  /** Total lines of code in the file */
  lineCount: number;
}

/**
 * Represents a detected code smell or anti-pattern
 */
export interface CodeSmell {
  /** Path to the file containing the smell */
  file: string;
  /** Type of code smell (e.g., 'long-method', 'large-class', 'god-object') */
  type: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Additional details about the smell */
  details: string;
}

/**
 * Represents a detected code duplication pattern
 */
export interface DuplicatePattern {
  /** Description of the duplicated pattern/code */
  pattern: string;
  /** File locations where duplication occurs */
  locations: string[];
  /** Similarity percentage (0-100) */
  similarity: number;
}
```

### 2. Update ProjectAnalysis Interface

Modify the `codeQuality` field to use the new structured types:

```typescript
export interface ProjectAnalysis {
  codebaseSize: {
    files: number;
    lines: number;
    languages: Record<string, number>;
  };
  testCoverage?: {
    percentage: number;
    uncoveredFiles: string[];
  };
  dependencies: {
    outdated: string[];
    security: string[];
  };
  codeQuality: {
    lintIssues: number;
    complexityHotspots: ComplexityHotspot[];  // Updated: string[] -> ComplexityHotspot[]
    duplicatedCode: DuplicatePattern[];       // Updated: string[] -> DuplicatePattern[]
    codeSmells: CodeSmell[];                  // NEW field
  };
  documentation: {
    coverage: number;
    missingDocs: string[];
  };
  performance: {
    bundleSize?: number;
    slowTests: string[];
    bottlenecks: string[];
  };
}
```

### 3. Files Requiring Updates

| File | Changes Required |
|------|-----------------|
| `packages/orchestrator/src/idle-processor.ts` | Add new types, update interface, update `analyzeCodeQuality()` method |
| `packages/orchestrator/src/analyzers/refactoring-analyzer.ts` | Update to consume new structured types for better prioritization |
| `packages/orchestrator/src/test-helpers.ts` | Update test factories to use new types |
| `packages/orchestrator/src/idle-processor.test.ts` | Update test assertions for new structure |
| `packages/orchestrator/src/idle-task-generator.test.ts` | Update mock data to use new types |
| `packages/orchestrator/src/idle-task-generator.integration.test.ts` | Update integration test fixtures |

### 4. Type Location Decision

**Decision**: Keep new types in `idle-processor.ts` rather than `@apex/core`

**Rationale**:
- `ProjectAnalysis` is already defined in `idle-processor.ts`
- These types are tightly coupled to idle processing functionality
- No other packages currently need these types
- Keeps `@apex/core` focused on cross-cutting concerns (tasks, workflows, config)
- If future need arises, types can be migrated to `@apex/core` with re-exports

### 5. Backward Compatibility Strategy

The change from `string[]` to structured types is **breaking** for consumers. Migration approach:

1. **Update `analyzeCodeQuality()` method** in `IdleProcessor` to populate new structure:
   - Parse file analysis to extract complexity metrics
   - Build `ComplexityHotspot` objects with available metrics (default to 0 for unavailable metrics)
   - Build `DuplicatePattern` objects (pattern defaults to file path, similarity defaults to 100)
   - Initialize empty `codeSmells` array (future enhancement)

2. **Update `RefactoringAnalyzer`** to leverage new data:
   - Sort hotspots by complexity metrics for better prioritization
   - Include complexity scores in task descriptions
   - Use similarity percentage for duplicate code severity

3. **Update Test Helpers** to provide properly typed fixtures

### 6. Implementation Details

#### 6.1 Type Definitions (idle-processor.ts)

```typescript
// Add after line 25 (after IdleTask interface)

export interface ComplexityHotspot {
  file: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  lineCount: number;
}

export interface CodeSmell {
  file: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
}

export interface DuplicatePattern {
  pattern: string;
  locations: string[];
  similarity: number;
}
```

#### 6.2 Updated ProjectAnalysis (idle-processor.ts)

```typescript
export interface ProjectAnalysis {
  // ... existing fields unchanged ...
  codeQuality: {
    lintIssues: number;
    complexityHotspots: ComplexityHotspot[];
    duplicatedCode: DuplicatePattern[];
    codeSmells: CodeSmell[];
  };
  // ... remaining fields unchanged ...
}
```

#### 6.3 Updated analyzeCodeQuality Method

```typescript
private async analyzeCodeQuality(): Promise<ProjectAnalysis['codeQuality']> {
  let lintIssues = 0;
  const duplicatedCode: DuplicatePattern[] = [];
  const complexityHotspots: ComplexityHotspot[] = [];
  const codeSmells: CodeSmell[] = [];

  try {
    // ESLint analysis (unchanged)
    try {
      const { stdout } = await this.execAsync('npx eslint . --format=json 2>/dev/null || echo "[]"');
      const results = JSON.parse(stdout);
      lintIssues = results.reduce((total: number, file: any) => total + file.errorCount + file.warningCount, 0);
    } catch {
      // ESLint not available or failed
    }

    // Enhanced complexity analysis
    const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | xargs wc -l | sort -nr | head -5');
    const largeFiles = stdout.split('\n')
      .filter(line => line.trim() && !line.includes('total'))
      .map(line => {
        const parts = line.trim().split(/\s+/);
        const lineCount = parseInt(parts[0]);
        const filename = parts[1];
        if (lineCount > 500) {
          return {
            file: filename,
            cyclomaticComplexity: 0,  // Would require additional tooling
            cognitiveComplexity: 0,   // Would require additional tooling
            lineCount,
          };
        }
        return null;
      })
      .filter((h): h is ComplexityHotspot => h !== null);

    complexityHotspots.push(...largeFiles);
  } catch {
    // Ignore errors in code quality analysis
  }

  return {
    lintIssues,
    duplicatedCode,
    complexityHotspots,
    codeSmells,
  };
}
```

#### 6.4 Updated RefactoringAnalyzer

Key changes to `refactoring-analyzer.ts`:

```typescript
analyze(analysis: ProjectAnalysis): TaskCandidate[] {
  const candidates: TaskCandidate[] = [];

  // Priority 1: Duplicated code (now with pattern details)
  if (analysis.codeQuality.duplicatedCode.length > 0) {
    const duplicates = analysis.codeQuality.duplicatedCode;
    const duplicateCount = duplicates.length;
    const highSimilarityCount = duplicates.filter(d => d.similarity >= 90).length;

    candidates.push(
      this.createCandidate(
        'duplicated-code',
        'Eliminate Duplicated Code',
        `Refactor ${duplicateCount} ${duplicateCount === 1 ? 'pattern' : 'patterns'} of duplicated code` +
        (highSimilarityCount > 0 ? ` (${highSimilarityCount} with 90%+ similarity)` : ''),
        {
          priority: 'high',
          effort: 'high',
          workflow: 'refactoring',
          rationale: 'Duplicated code increases maintenance burden and bug risk',
          score: 0.9,
        }
      )
    );
  }

  // Priority 2: Complexity hotspots (now with metrics)
  if (analysis.codeQuality.complexityHotspots.length > 0) {
    const hotspots = analysis.codeQuality.complexityHotspots;

    // Sort by complexity (highest first)
    const sortedHotspots = [...hotspots].sort((a, b) =>
      (b.cyclomaticComplexity + b.cognitiveComplexity) - (a.cyclomaticComplexity + a.cognitiveComplexity)
    );

    for (let i = 0; i < Math.min(3, sortedHotspots.length); i++) {
      const hotspot = sortedHotspots[i];
      const fileName = hotspot.file.split('/').pop() || hotspot.file;

      candidates.push(
        this.createCandidate(
          `complexity-${i}`,
          `Simplify ${fileName}`,
          `Reduce complexity in ${hotspot.file} (${hotspot.lineCount} lines` +
          (hotspot.cyclomaticComplexity > 0 ? `, cyclomatic: ${hotspot.cyclomaticComplexity}` : '') +
          (hotspot.cognitiveComplexity > 0 ? `, cognitive: ${hotspot.cognitiveComplexity}` : '') + ')',
          {
            priority: 'normal',
            effort: 'high',
            workflow: 'refactoring',
            rationale: 'Large, complex files are harder to understand, test, and maintain',
            score: 0.7 - i * 0.1,
          }
        )
      );
    }
  }

  // Priority 3: Code smells (NEW)
  if (analysis.codeQuality.codeSmells.length > 0) {
    const highSeveritySmells = analysis.codeQuality.codeSmells.filter(s => s.severity === 'high');
    if (highSeveritySmells.length > 0) {
      candidates.push(
        this.createCandidate(
          'code-smells',
          'Address Code Smells',
          `Fix ${highSeveritySmells.length} high-severity code smell${highSeveritySmells.length === 1 ? '' : 's'}`,
          {
            priority: 'normal',
            effort: 'medium',
            workflow: 'refactoring',
            rationale: 'Code smells indicate design issues that reduce maintainability',
            score: 0.65,
          }
        )
      );
    }
  }

  // Priority 4: Lint issues (unchanged)
  // ...existing lint issue handling...

  return candidates;
}
```

#### 6.5 Updated Test Helpers

```typescript
// test-helpers.ts
export function createMinimalAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
    testCoverage: { percentage: 50, uncoveredFiles: [] },
    dependencies: { outdated: [], security: [] },
    codeQuality: {
      lintIssues: 0,
      duplicatedCode: [],
      complexityHotspots: [],
      codeSmells: [],
    },
    documentation: { coverage: 50, missingDocs: [] },
    performance: { slowTests: [], bottlenecks: [] },
  };
}

export function createAnalysisWithIssues(issueType: 'maintenance' | 'refactoring' | 'docs' | 'tests'): ProjectAnalysis {
  const base = createMinimalAnalysis();

  switch (issueType) {
    case 'refactoring':
      return {
        ...base,
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: [
            { pattern: 'repeated validation logic', locations: ['src/api.ts', 'src/client.ts'], similarity: 95 }
          ],
          complexityHotspots: [
            { file: 'src/complex.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 800 }
          ],
          codeSmells: [
            { file: 'src/god-object.ts', type: 'god-object', severity: 'high', details: 'Class has 50+ methods' }
          ],
        },
      };
    // ... other cases unchanged ...
  }
}
```

## Consequences

### Positive
- **Richer Analysis Data**: Enables more informed task prioritization based on actual complexity metrics
- **Better Task Descriptions**: Generated tasks can include specific metrics (e.g., "800 lines, cyclomatic: 25")
- **Extensibility**: `CodeSmell` type enables future detection of anti-patterns
- **Consistency**: All code quality fields now follow structured patterns

### Negative
- **Breaking Change**: Existing code consuming `ProjectAnalysis.codeQuality` will fail to compile
- **Increased Complexity**: More types to maintain and understand
- **Metric Gaps**: Initial implementation may have 0 values for cyclomatic/cognitive complexity until tooling is integrated

### Neutral
- **Test Updates Required**: All tests using mock `ProjectAnalysis` objects need updates
- **Future Work**: Full complexity metric population requires integrating tools like `eslint-plugin-complexity` or `plato`

## Implementation Order

1. Add new type definitions to `idle-processor.ts`
2. Update `ProjectAnalysis` interface
3. Update `analyzeCodeQuality()` method to return new structure
4. Update `test-helpers.ts` factory functions
5. Update `RefactoringAnalyzer` to use new structure
6. Update all test files with new mock structures
7. Run type checking and tests
8. Create follow-up task for full complexity metric integration

## Related

- `packages/orchestrator/src/idle-processor.ts` - Main file to modify
- `packages/orchestrator/src/analyzers/refactoring-analyzer.ts` - Consumer of complexity data
- `docs/adr/004-idle-task-generator.md` - Related architecture for task generation
