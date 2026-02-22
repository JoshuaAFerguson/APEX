# ADR: TechnicalDebtAnalyzer Comprehensive Test Architecture

**Status**: Proposed
**Date**: 2025-02-22
**Author**: Architect Agent

## Context

APEX requires comprehensive tests for the TechnicalDebtAnalyzer class. The analyzer is responsible for detecting and categorizing various types of technical debt in a codebase, including:

1. **TODO/FIXME Comments** - with categorization
2. **Deprecated Code Usage** - packages and APIs
3. **Outdated Dependencies** - version analysis
4. **Code Complexity Hotspots** - integration with RefactoringAnalyzer data
5. **Missing Test Coverage** - coverage gap detection
6. **Security Vulnerabilities** - CVE-based detection
7. **Code Duplication** - similarity pattern analysis
8. **Code Smells** - various anti-patterns

## Current State Analysis

### Missing Implementation
- `packages/orchestrator/src/analyzers/technical-debt-analyzer.ts` does NOT exist
- The existing `technical-debt-analyzer-comprehensive.test.ts` imports from a non-existent module
- `index.ts` exports `TechnicalDebtAnalyzer` expecting it to exist

### Existing Test File Analysis
The comprehensive test file (`technical-debt-analyzer-comprehensive.test.ts`) already contains:
- Real-world scenario testing
- Schema compliance validation
- Edge case validation
- Performance and scalability tests
- Integration with RefactoringAnalyzer
- Severity scoring validation
- Remediation suggestions validation
- Error recovery and robustness tests

### Dependencies
- `ProjectAnalysis` interface from `../idle-processor`
- `TechnicalDebtAnalysisSchema` from `@apexcli/core`
- `BaseAnalyzer`, `TaskCandidate`, `RemediationSuggestion` from `./base-analyzer`
- Types: `ComplexityHotspot`, `CodeSmell`, `DuplicatePattern`, `EnhancedDocumentationAnalysis` from `@apexcli/core`
- Types: `OutdatedDependency`, `SecurityVulnerability`, `DeprecatedPackage` from `../idle-processor`

## Design Decisions

### 1. Implementation-First Approach

Before the tests can pass, the `TechnicalDebtAnalyzer` class must be implemented. The implementation must:

```typescript
export class TechnicalDebtAnalyzer extends BaseAnalyzer {
  readonly type = 'technical-debt' as const;

  /**
   * Analyze ProjectAnalysis and return task candidates for technical debt
   */
  analyze(analysis: ProjectAnalysis): TaskCandidate[];

  /**
   * Create a TechnicalDebtAnalysis object from ProjectAnalysis data
   */
  createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis;
}
```

### 2. Test Architecture Structure

```
packages/orchestrator/src/analyzers/
├── technical-debt-analyzer.ts                    # Implementation (MUST BE CREATED)
├── technical-debt-analyzer.test.ts               # Core unit tests (MUST BE CREATED)
├── technical-debt-analyzer-comprehensive.test.ts # Real-world scenarios (EXISTS)
├── __tests__/
│   ├── technical-debt-analyzer-patterns.test.ts  # Pattern detection tests
│   ├── technical-debt-analyzer-schema.test.ts    # Schema compliance tests
│   └── technical-debt-analyzer-integration.test.ts # Integration tests
```

### 3. Test Categories Required

#### 3.1 Detection Type Tests
Each detection type requires dedicated tests:

| Detection Type | Test Focus |
|---------------|-----------|
| TODO/FIXME Comments | Multi-format detection, categorization, priority |
| Deprecated Code | Package identification, replacement suggestions |
| Outdated Dependencies | Version analysis, update type classification |
| Complexity Hotspots | Threshold-based detection, RefactoringAnalyzer integration |
| Test Coverage Gaps | Coverage percentage, gap prioritization |
| Security Vulnerabilities | CVE detection, severity classification |
| Code Duplication | Similarity scoring, location tracking |
| Code Smells | Type categorization, severity assessment |

#### 3.2 Edge Case Tests
- Empty/null analysis data
- Corrupted/malformed input
- Missing nested properties
- Extreme values (large counts, 0% coverage, 100% coverage)
- Empty arrays vs undefined arrays

#### 3.3 Severity Calculation Tests
```typescript
// Priority mapping validation
Score >= 0.8 → 'critical' or 'urgent'
Score >= 0.6 → 'high'
Score >= 0.4 → 'normal'
Score < 0.4 → 'low'
```

#### 3.4 Schema Compliance Tests
- `TechnicalDebtAnalysis` output validates against `TechnicalDebtAnalysisSchema`
- Required fields: `totalScore`, `categories`, `hotspots`, `metrics`, `trends`
- Score bounds: `0 <= totalScore <= 100`
- Categories structure validation
- Hotspots structure validation

#### 3.5 Integration Tests
- Integration with `ProjectAnalysis` data flow
- Integration with `RefactoringAnalyzer` complexity data
- TaskCandidate generation with proper candidateId prefixing

### 4. Implementation Requirements for TechnicalDebtAnalyzer

The implementation must satisfy the following acceptance criteria:

```typescript
interface TechnicalDebtAnalyzerContract {
  // Must analyze all ProjectAnalysis fields for debt indicators
  analyze(analysis: ProjectAnalysis): TaskCandidate[];

  // Must create schema-compliant TechnicalDebtAnalysis
  createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis;
}
```

#### Required Methods and Behaviors:

1. **`analyze()`** must detect and create candidates for:
   - `technical-debt-critical-complexity` - for critical complexity hotspots
   - `technical-debt-high-complexity` - for high complexity (non-critical)
   - `technical-debt-deprecated-dependencies` - for deprecated packages
   - `technical-debt-major-version-updates` - for major dependency updates
   - `technical-debt-outdated-dependencies` - for minor/patch updates
   - `technical-debt-test-coverage` - for coverage < 80%
   - `technical-debt-critical-code-smells` - for critical code smells
   - `technical-debt-code-duplication` - for duplicated code
   - `technical-debt-security-vulnerabilities` - for security issues
   - `technical-debt-todo-comments` - for TODO/FIXME accumulation

2. **`createTechnicalDebtAnalysis()`** must produce:
   - `totalScore` (0-100, higher = more debt)
   - `categories[]` with count, severity, examples, estimatedEffort
   - `hotspots[]` with path, score, issues, loc
   - `metrics` with codeComplexity, testCoverage, duplicatedLinesPercent, maintainabilityIndex
   - `trends` with improving, changeRate, timeframe

### 5. Test Data Factories

Create reusable test data factories:

```typescript
// Base analysis factory
function createBaseAnalysis(): ProjectAnalysis;

// Specific scenario factories
function createLegacyCodebaseAnalysis(): ProjectAnalysis;
function createModernCodebaseAnalysis(): ProjectAnalysis;
function createMicroserviceAnalysis(): ProjectAnalysis;
function createExtremeDebtAnalysis(): ProjectAnalysis;
function createEmptyAnalysis(): ProjectAnalysis;
```

### 6. Expected Test Count

Based on acceptance criteria and existing patterns:

| Test Category | Estimated Count |
|--------------|----------------|
| Detection Type Tests | 40-50 |
| Edge Case Tests | 20-30 |
| Severity Calculation | 10-15 |
| Schema Compliance | 10-15 |
| Integration Tests | 15-20 |
| Performance Tests | 5-10 |
| **Total** | **100-140** |

## Implementation Plan

### Phase 1: Create TechnicalDebtAnalyzer Implementation
1. Create `technical-debt-analyzer.ts` with class extending `BaseAnalyzer`
2. Implement `analyze()` method for all debt detection types
3. Implement `createTechnicalDebtAnalysis()` for schema-compliant output
4. Add private helper methods for scoring and categorization

### Phase 2: Create Core Unit Tests
1. Create `technical-debt-analyzer.test.ts` with basic functionality tests
2. Cover all detection types individually
3. Test priority and score calculations
4. Test remediation suggestion generation

### Phase 3: Validate Comprehensive Tests
1. Ensure existing `technical-debt-analyzer-comprehensive.test.ts` passes
2. Add any missing edge case tests
3. Verify schema compliance tests work

### Phase 4: Create Additional Test Files
1. Pattern detection tests
2. Integration tests with full ProjectAnalysis flow
3. Performance benchmarking tests

## Technical Design for TechnicalDebtAnalyzer

### Class Structure

```typescript
import { BaseAnalyzer, TaskCandidate, RemediationSuggestion } from './base-analyzer';
import type { ProjectAnalysis, SecurityVulnerability, DeprecatedPackage, OutdatedDependency } from '../idle-processor';
import type { TechnicalDebtAnalysis, ComplexityHotspot, CodeSmell, DuplicatePattern } from '@apexcli/core';

export class TechnicalDebtAnalyzer extends BaseAnalyzer {
  readonly type = 'technical-debt' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // 1. Analyze complexity hotspots
    this.analyzeComplexityHotspots(analysis, candidates);

    // 2. Analyze code smells
    this.analyzeCodeSmells(analysis, candidates);

    // 3. Analyze code duplication
    this.analyzeCodeDuplication(analysis, candidates);

    // 4. Analyze test coverage
    this.analyzeTestCoverage(analysis, candidates);

    // 5. Analyze security vulnerabilities
    this.analyzeSecurityVulnerabilities(analysis, candidates);

    // 6. Analyze deprecated packages
    this.analyzeDeprecatedPackages(analysis, candidates);

    // 7. Analyze outdated dependencies
    this.analyzeOutdatedDependencies(analysis, candidates);

    // 8. Analyze lint issues (TODO/FIXME proxy)
    this.analyzeLintIssues(analysis, candidates);

    return candidates;
  }

  createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis {
    return {
      totalScore: this.calculateTotalDebtScore(analysis),
      categories: this.buildDebtCategories(analysis),
      hotspots: this.buildDebtHotspots(analysis),
      metrics: this.buildDebtMetrics(analysis),
      trends: this.buildDebtTrends(analysis),
    };
  }

  // Private helper methods...
}
```

### Scoring Algorithm

```typescript
// Total debt score calculation (0-100)
private calculateTotalDebtScore(analysis: ProjectAnalysis): number {
  let score = 0;

  // Complexity contribution (max 25 points)
  const complexityHotspots = analysis.codeQuality?.complexityHotspots ?? [];
  const criticalComplexity = complexityHotspots.filter(h => h.cyclomaticComplexity > 50).length;
  score += Math.min(25, criticalComplexity * 5 + complexityHotspots.length * 2);

  // Test coverage contribution (max 25 points)
  const coverage = analysis.testCoverage?.percentage ?? 0;
  score += Math.max(0, 25 - (coverage / 4));

  // Security contribution (max 20 points)
  const securityIssues = analysis.dependencies?.securityIssues ?? [];
  const criticalSecurity = securityIssues.filter(v => v.severity === 'critical').length;
  score += Math.min(20, criticalSecurity * 10 + securityIssues.length * 2);

  // Dependencies contribution (max 15 points)
  const deprecated = analysis.dependencies?.deprecatedPackages ?? [];
  const outdated = analysis.dependencies?.outdatedPackages ?? [];
  score += Math.min(15, deprecated.length * 3 + outdated.length);

  // Code quality contribution (max 15 points)
  const codeSmells = analysis.codeQuality?.codeSmells ?? [];
  const duplicates = analysis.codeQuality?.duplicatedCode ?? [];
  score += Math.min(15, codeSmells.length * 2 + duplicates.length * 3);

  return Math.min(100, score);
}
```

## Consequences

### Positive
- Comprehensive test coverage ensures reliability
- Clear separation of concerns in test structure
- Reusable test data factories
- Schema compliance guarantees output consistency
- Integration tests ensure proper data flow

### Negative
- Implementation must be created before tests pass
- Large number of tests may increase CI time
- Test maintenance overhead for complex scenarios

## Files to Create/Modify

### Required Files (In Order):
1. **CREATE**: `packages/orchestrator/src/analyzers/technical-debt-analyzer.ts` - Implementation
2. **CREATE**: `packages/orchestrator/src/analyzers/technical-debt-analyzer.test.ts` - Core unit tests
3. **VERIFY**: `packages/orchestrator/src/analyzers/technical-debt-analyzer-comprehensive.test.ts` - Already exists
4. **VERIFY**: `packages/orchestrator/src/analyzers/index.ts` - Already exports TechnicalDebtAnalyzer

### Developer Stage Tasks:
1. Implement TechnicalDebtAnalyzer class per this design
2. Create core unit test file
3. Ensure all existing comprehensive tests pass
4. Run `npm run build` and `npm run test` to verify

## Verification Checklist

- [ ] `technical-debt-analyzer.ts` implements BaseAnalyzer
- [ ] `analyze()` returns TaskCandidate[] for all debt types
- [ ] `createTechnicalDebtAnalysis()` returns schema-compliant output
- [ ] All candidateIds are prefixed with `technical-debt-`
- [ ] Remediation suggestions have proper structure
- [ ] Edge cases handle null/undefined gracefully
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm run test`

---

## Technical Design Summary

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TechnicalDebtAnalyzer                        │
├─────────────────────────────────────────────────────────────────┤
│  extends BaseAnalyzer                                           │
│  type = 'technical-debt'                                        │
├─────────────────────────────────────────────────────────────────┤
│  Public Methods:                                                │
│  ├── analyze(analysis: ProjectAnalysis): TaskCandidate[]       │
│  └── createTechnicalDebtAnalysis(analysis): TechnicalDebtAnalysis│
├─────────────────────────────────────────────────────────────────┤
│  Private Analysis Methods:                                      │
│  ├── analyzeComplexityHotspots()                               │
│  ├── analyzeCodeSmells()                                        │
│  ├── analyzeCodeDuplication()                                   │
│  ├── analyzeTestCoverage()                                      │
│  ├── analyzeSecurityVulnerabilities()                          │
│  ├── analyzeDeprecatedPackages()                               │
│  ├── analyzeOutdatedDependencies()                             │
│  └── analyzeLintIssues()                                       │
├─────────────────────────────────────────────────────────────────┤
│  Private Helper Methods:                                        │
│  ├── calculateTotalDebtScore()                                 │
│  ├── buildDebtCategories()                                     │
│  ├── buildDebtHotspots()                                       │
│  ├── buildDebtMetrics()                                        │
│  └── buildDebtTrends()                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
ProjectAnalysis
       │
       ▼
┌─────────────────────┐
│ TechnicalDebtAnalyzer│
│                     │
│ ┌─────────────────┐ │
│ │  analyze()      │ │───▶ TaskCandidate[]
│ └─────────────────┘ │       (for idle task generation)
│                     │
│ ┌─────────────────┐ │
│ │createTechnical  │ │───▶ TechnicalDebtAnalysis
│ │DebtAnalysis()   │ │       (schema-compliant output)
│ └─────────────────┘ │
└─────────────────────┘
```

### Test File Organization

```
packages/orchestrator/src/analyzers/
├── technical-debt-analyzer.ts                    # Implementation
│
├── technical-debt-analyzer.test.ts               # Core unit tests
│   ├── Constructor/initialization
│   ├── analyze() basic functionality
│   ├── createTechnicalDebtAnalysis() basic functionality
│   ├── Each detection type individually
│   └── Priority/score calculation
│
├── technical-debt-analyzer-comprehensive.test.ts # Real-world scenarios
│   ├── Legacy codebase simulation
│   ├── Modern codebase validation
│   ├── Microservice scenarios
│   ├── Extreme debt edge cases
│   └── Error recovery robustness
│
└── __tests__/
    ├── technical-debt-schema.test.ts             # Schema validation
    │   ├── TechnicalDebtAnalysisSchema compliance
    │   ├── All required fields present
    │   ├── Category enum validation
    │   └── Bounds checking
    │
    └── technical-debt-integration.test.ts        # Integration tests
        ├── RefactoringAnalyzer data integration
        ├── Full ProjectAnalysis flow
        └── TaskCandidate generation
```

### TechnicalDebtAnalysisSchema Alignment

The implementation must produce output matching this schema:

```typescript
{
  totalScore: number;           // 0-100, higher = more debt
  categories: Array<{
    category: 'code-smell' | 'duplication' | 'complexity' |
              'outdated-dependency' | 'security-vulnerability' |
              'performance' | 'maintainability' | 'testability' |
              'documentation' | 'dead-code' | 'technical-design' | 'other';
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    examples?: string[];
    estimatedEffort?: string;   // e.g., "2 hours", "1 day"
  }>;
  hotspots: Array<{
    path: string;
    score: number;              // 0-100
    issues: string[];
    loc?: number;
    lastModified?: Date;
  }>;
  metrics?: {
    codeComplexity?: number;
    testCoverage?: number;       // 0-100
    duplicatedLinesPercent?: number; // 0-100
    maintainabilityIndex?: number;   // 0-100
  };
  trends?: {
    improving: boolean;
    changeRate: number;
    timeframe?: string;          // default: 'last 30 days'
  };
}
```

### Acceptance Criteria Mapping

| Acceptance Criteria | Test Coverage | Implementation Method |
|---------------------|---------------|----------------------|
| All detection types | Unit tests per type | analyzeX() methods |
| Edge cases for empty data | Comprehensive tests | null/undefined guards |
| Severity calculation | Scoring tests | calculateTotalDebtScore() |
| Schema compliance | Schema validation tests | createTechnicalDebtAnalysis() |
| Integration with ProjectAnalysis | Integration tests | analyze() method |
| All tests pass | Test suite | Full test execution |

---

**Next Stage**: Developer implements `technical-debt-analyzer.ts` and `technical-debt-analyzer.test.ts` per this design.
