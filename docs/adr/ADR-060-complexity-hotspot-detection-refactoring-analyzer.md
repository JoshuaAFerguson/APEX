# ADR-060: Complexity Hotspot Detection in RefactoringAnalyzer

## Status
Proposed

## Date
2024-12-20

## Context

The `RefactoringAnalyzer` is responsible for analyzing code quality metrics and generating refactoring task candidates. Currently, it has a basic implementation that:

1. Handles complexity hotspots in a limited way - treating `complexityHotspots` as simple file paths (legacy) or `ComplexityHotspot` objects
2. Does not fully utilize the `cyclomaticComplexity` and `cognitiveComplexity` fields in `ComplexityHotspot`
3. Generates generic task descriptions without specific complexity scores
4. Does not differentiate refactoring actions based on the type of complexity (cyclomatic vs cognitive)

The types are already defined in `@apex/core` (types.ts):

```typescript
export interface ComplexityHotspot {
  file: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  lineCount: number;
}
```

And `ProjectAnalysis.codeQuality` already uses these structured types:

```typescript
codeQuality: {
  lintIssues: number;
  duplicatedCode: DuplicatePattern[];
  complexityHotspots: ComplexityHotspot[];
  codeSmells: CodeSmell[];
};
```

The task requires enhancing `RefactoringAnalyzer.analyze()` to:
1. Generate candidates with specific complexity scores
2. Include file information in candidates
3. Prioritize based on both cyclomatic and cognitive complexity
4. Suggest appropriate refactoring actions based on complexity type

## Decision

### 1. Architectural Approach

We will enhance the `RefactoringAnalyzer` to be a **complexity-aware analyzer** that generates differentiated refactoring candidates based on complexity type and severity.

#### 1.1 Complexity Classification System

Define thresholds for complexity severity:

| Complexity Type | Low | Medium | High | Critical |
|----------------|-----|--------|------|----------|
| Cyclomatic | 1-10 | 11-20 | 21-30 | 31+ |
| Cognitive | 1-15 | 16-25 | 26-40 | 41+ |
| Line Count | 1-200 | 201-500 | 501-1000 | 1001+ |

#### 1.2 Complexity-Specific Refactoring Actions

Different complexity types warrant different refactoring strategies:

| Complexity Type | Primary Issue | Suggested Actions |
|----------------|---------------|-------------------|
| **High Cyclomatic** | Too many branches/paths | Extract methods, replace conditionals with polymorphism, simplify nested conditions |
| **High Cognitive** | Hard to understand | Flatten control flow, extract helpers, improve naming, add explanatory variables |
| **High Both** | Complex and unreadable | Major refactoring: split into modules, apply design patterns |
| **Large File** | Too many responsibilities | Split into multiple modules, apply Single Responsibility Principle |

### 2. Enhanced TaskCandidate Structure

Extend the candidate creation to include complexity metadata in the description and rationale:

```typescript
interface ComplexityCandidate extends TaskCandidate {
  // Inherited fields:
  // - candidateId: string
  // - title: string
  // - description: string
  // - priority: TaskPriority
  // - estimatedEffort: 'low' | 'medium' | 'high'
  // - suggestedWorkflow: string
  // - rationale: string
  // - score: number

  // Complexity data embedded in description/rationale:
  // - Cyclomatic complexity score
  // - Cognitive complexity score
  // - Line count
  // - Specific refactoring recommendations
}
```

### 3. Prioritization Algorithm

The prioritization score will be computed using a weighted formula:

```
Score = (W_cyc * normalized_cyclomatic) +
        (W_cog * normalized_cognitive) +
        (W_loc * normalized_lines) +
        (bonus for combined high complexity)

Where:
  W_cyc = 0.40 (cyclomatic weight)
  W_cog = 0.35 (cognitive weight - slightly less as it's more subjective)
  W_loc = 0.25 (line count weight)

  bonus = 0.15 if both cyclomatic AND cognitive are in "high" or "critical" range
```

Normalization formula:
```
normalized_value = min(1.0, actual_value / critical_threshold)
```

### 4. Implementation Design

#### 4.1 New Constants in RefactoringAnalyzer

```typescript
// Complexity thresholds
const CYCLOMATIC_THRESHOLDS = {
  low: 10,
  medium: 20,
  high: 30,
  critical: 50,
};

const COGNITIVE_THRESHOLDS = {
  low: 15,
  medium: 25,
  high: 40,
  critical: 60,
};

const LINE_COUNT_THRESHOLDS = {
  low: 200,
  medium: 500,
  high: 1000,
  critical: 2000,
};

// Prioritization weights
const PRIORITY_WEIGHTS = {
  cyclomatic: 0.40,
  cognitive: 0.35,
  lineCount: 0.25,
};

const COMBINED_HIGH_COMPLEXITY_BONUS = 0.15;
```

#### 4.2 New Helper Methods

```typescript
class RefactoringAnalyzer extends BaseAnalyzer {
  /**
   * Calculate complexity severity for a hotspot
   */
  private calculateSeverity(hotspot: ComplexityHotspot): {
    cyclomaticSeverity: 'low' | 'medium' | 'high' | 'critical';
    cognitiveSeverity: 'low' | 'medium' | 'high' | 'critical';
    lineSeverity: 'low' | 'medium' | 'high' | 'critical';
    overallSeverity: 'low' | 'medium' | 'high' | 'critical';
  };

  /**
   * Calculate prioritization score for a hotspot
   */
  private calculatePriorityScore(hotspot: ComplexityHotspot): number;

  /**
   * Get refactoring recommendations based on complexity profile
   */
  private getRefactoringRecommendations(hotspot: ComplexityHotspot): string[];

  /**
   * Map severity to task priority
   */
  private severityToTaskPriority(
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): TaskPriority;

  /**
   * Generate detailed description with complexity scores
   */
  private generateHotspotDescription(hotspot: ComplexityHotspot): string;
}
```

#### 4.3 Enhanced analyze() Method

```typescript
analyze(analysis: ProjectAnalysis): TaskCandidate[] {
  const candidates: TaskCandidate[] = [];

  // Priority 1: Duplicated code (unchanged - high priority architectural issue)
  // ... existing duplication handling ...

  // Priority 2: Enhanced Complexity Hotspots Analysis
  if (analysis.codeQuality.complexityHotspots.length > 0) {
    const hotspots = analysis.codeQuality.complexityHotspots;

    // Calculate priority scores and sort
    const scoredHotspots = hotspots
      .map(h => ({ hotspot: h, score: this.calculatePriorityScore(h) }))
      .sort((a, b) => b.score - a.score);

    // Generate candidates for top hotspots
    for (let i = 0; i < Math.min(3, scoredHotspots.length); i++) {
      const { hotspot, score } = scoredHotspots[i];
      const severity = this.calculateSeverity(hotspot);
      const fileName = hotspot.file.split('/').pop() || hotspot.file;
      const recommendations = this.getRefactoringRecommendations(hotspot);

      candidates.push(
        this.createCandidate(
          `complexity-hotspot-${i}`,
          `Refactor ${fileName}`,
          this.generateHotspotDescription(hotspot),
          {
            priority: this.severityToTaskPriority(severity.overallSeverity),
            effort: severity.overallSeverity === 'critical' ? 'high' :
                    severity.overallSeverity === 'high' ? 'high' : 'medium',
            workflow: 'refactoring',
            rationale: `Complexity Analysis:\n` +
              `- Cyclomatic: ${hotspot.cyclomaticComplexity} (${severity.cyclomaticSeverity})\n` +
              `- Cognitive: ${hotspot.cognitiveComplexity} (${severity.cognitiveSeverity})\n` +
              `- Lines: ${hotspot.lineCount}\n\n` +
              `Recommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`,
            score: Math.min(0.95, 0.6 + score * 0.35), // Base 0.6, max 0.95
          }
        )
      );
    }

    // Aggregate task for many hotspots
    if (scoredHotspots.length > 3) {
      const criticalCount = scoredHotspots.filter(
        ({ hotspot }) => this.calculateSeverity(hotspot).overallSeverity === 'critical'
      ).length;

      candidates.push(
        this.createCandidate(
          'complexity-sweep',
          'Address Codebase Complexity',
          `Systematic refactoring of ${scoredHotspots.length} complexity hotspots` +
          (criticalCount > 0 ? ` (${criticalCount} critical)` : ''),
          {
            priority: criticalCount > 0 ? 'high' : 'normal',
            effort: 'high',
            workflow: 'refactoring',
            rationale: 'Multiple complexity hotspots indicate systemic code quality issues',
            score: 0.55,
          }
        )
      );
    }
  }

  // Priority 3: Code smells (unchanged)
  // ... existing code smell handling ...

  // Priority 4: Lint issues (unchanged)
  // ... existing lint issue handling ...

  return candidates;
}
```

### 5. File Changes Required

| File | Changes |
|------|---------|
| `packages/orchestrator/src/analyzers/refactoring-analyzer.ts` | Add complexity thresholds, helper methods, enhanced analyze() |
| `packages/orchestrator/src/analyzers/refactoring-analyzer.test.ts` | Add tests for new functionality |
| `packages/orchestrator/src/idle-task-generator.test.ts` | Update test fixtures with proper complexity values |

### 6. Integration with Existing Types

The solution leverages existing types from `@apex/core`:
- `ComplexityHotspot` - already has all required fields
- `CodeSmell` - used for complementary detection
- `TaskCandidate` - extended via createCandidate helper

No changes to `@apex/core` are required.

### 7. Example Output

Given a hotspot:
```typescript
{
  file: 'src/services/payment-processor.ts',
  cyclomaticComplexity: 35,
  cognitiveComplexity: 42,
  lineCount: 850
}
```

The analyzer would generate:

```typescript
{
  candidateId: 'refactoring-complexity-hotspot-0',
  title: 'Refactor payment-processor.ts',
  description: 'Reduce complexity in src/services/payment-processor.ts:\n' +
    '• Cyclomatic Complexity: 35 (critical - many execution paths)\n' +
    '• Cognitive Complexity: 42 (critical - hard to understand)\n' +
    '• Lines: 850 (high - consider splitting)\n\n' +
    'This file has critically high complexity in both dimensions, ' +
    'indicating a major refactoring is needed.',
  priority: 'high',
  estimatedEffort: 'high',
  suggestedWorkflow: 'refactoring',
  rationale: 'Complexity Analysis:\n' +
    '- Cyclomatic: 35 (critical)\n' +
    '- Cognitive: 42 (critical)\n' +
    '- Lines: 850\n\n' +
    'Recommended actions:\n' +
    '• Split into multiple modules applying Single Responsibility Principle\n' +
    '• Extract complex conditional logic into strategy pattern\n' +
    '• Replace nested conditionals with early returns\n' +
    '• Add explanatory intermediate variables',
  score: 0.92
}
```

## Consequences

### Positive

1. **Actionable Recommendations**: Tasks include specific refactoring strategies based on complexity type
2. **Prioritized Backlog**: Hotspots are ranked by impact, helping teams tackle worst offenders first
3. **Transparent Scoring**: Complexity scores visible in task descriptions for informed decisions
4. **Type Safety**: Full use of existing `ComplexityHotspot` interface
5. **Extensibility**: Threshold constants can be made configurable in future

### Negative

1. **Increased Complexity**: More helper methods and scoring logic to maintain
2. **Threshold Tuning**: Default thresholds may need adjustment based on codebase characteristics
3. **Score Normalization**: Normalization formula may need tuning for edge cases

### Neutral

1. **Test Updates**: Existing tests need updates to verify new behavior
2. **Documentation**: Need to document threshold meanings and scoring algorithm

## Implementation Order

1. Add complexity threshold constants to `RefactoringAnalyzer`
2. Implement `calculateSeverity()` helper
3. Implement `calculatePriorityScore()` helper
4. Implement `getRefactoringRecommendations()` helper
5. Implement `generateHotspotDescription()` helper
6. Implement `severityToTaskPriority()` helper
7. Update `analyze()` method to use new helpers
8. Add unit tests for each helper method
9. Add integration tests for full analyze() flow
10. Update existing test fixtures

## Related

- `ADR-059`: Enhanced Complexity Metrics for ProjectAnalysis (defines types used here)
- `packages/orchestrator/src/analyzers/index.ts`: Base analyzer interface
- `packages/core/src/types.ts`: ComplexityHotspot type definition
