# ADR-002: IdleProcessor Unit Test Coverage Enhancement

## Status
Proposed

## Date
2024-12-27

## Context

The `IdleProcessor` class is a core component of the APEX orchestrator that analyzes projects during idle time and generates improvement tasks. It contains ~3467 lines of complex functionality including:

1. **Project Analysis** - Codebase size, test coverage, dependencies, code quality, documentation, performance
2. **Task Generation** - Weighted strategy selection via `IdleTaskGenerator`
3. **Detector Events** - 11 different detector event types for findings
4. **Branch Coverage Analysis** - Advanced branch coverage detection
5. **Integration Test Gap Detection** - Critical path identification and coverage checking
6. **Anti-Pattern Detection** - Testing anti-patterns in test files

### Current Test State

The existing test file `idle-processor.test.ts` (~1663 lines) provides good coverage for:
- Basic lifecycle (start, processIdleTime)
- Event emissions
- Project analysis basics
- Task generation flows
- Branch coverage analysis helper methods
- Anti-pattern detection

However, several areas require enhanced coverage to meet the 90%+ target:

### Coverage Gaps Identified

1. **Strategy Configuration** - `IdleTaskGenerator` weighted strategy selection not fully tested
2. **Documentation Analysis Utilities** - `getDefaultIndicators`, `getDefaultDescription`, `calculateMismatchSeverity`
3. **Integration Test Analysis** - `identifyCriticalPaths`, `checkIntegrationTestCoverage`, `buildMissingTestReports`
4. **Duplicate Code Detection** - `detectDuplicateFunctions`, `detectDuplicateImports`, `detectDuplicateUtilities`
5. **Cross-Reference Validation** - Integration with `CrossReferenceValidator`
6. **Version Mismatch Detection** - `findVersionMismatches`, `convertVersionMismatchesToOutdatedDocs`
7. **Stale Comment Detection** - Integration with `StaleCommentDetector`
8. **Edge Cases** - Error handling paths, empty/null inputs, malformed data

## Decision

### 1. Architecture Overview

Enhance the test suite with the following structure:

```
packages/orchestrator/src/
├── idle-processor.ts                              # Main implementation
├── idle-processor.test.ts                         # Core unit tests (existing)
├── idle-processor-strategy.test.ts                # NEW: Strategy configuration tests
├── idle-processor-integration-analysis.test.ts    # NEW: Integration test analysis
├── idle-processor-duplicate-detection.test.ts     # NEW: Duplicate code detection
├── idle-processor-docs.test.ts                    # Enhanced documentation tests (existing)
├── idle-processor-task-store.integration.test.ts  # Integration tests (existing)
└── idle-task-generator.test.ts                    # Generator tests (existing)
```

### 2. Test Categories and Coverage Targets

#### Category A: Project Analysis Methods (~25% of coverage)

| Method | Current Coverage | Target | Priority |
|--------|------------------|--------|----------|
| `analyzeCodebaseSize` | Partial | 100% | Medium |
| `analyzeTestCoverage` | Partial | 100% | High |
| `analyzeDependencies` | Good | 95% | Low |
| `analyzeCodeQuality` | Partial | 100% | High |
| `analyzeDocumentation` | Good | 95% | Medium |
| `analyzePerformance` | Basic | 90% | Low |
| `analyzeTestAnalysis` | Partial | 100% | High |

#### Category B: Task Generation (~20% of coverage)

| Method | Current Coverage | Target | Priority |
|--------|------------------|--------|----------|
| `generateTasksFromAnalysis` | Good | 95% | Medium |
| `generateImprovementTasks` | Basic | 90% | Medium |
| `IdleTaskGenerator.selectTaskType` | Existing tests | 100% | High |
| `IdleTaskGenerator.generateTask` | Existing tests | 95% | Medium |

#### Category C: Detection Methods (~30% of coverage)

| Method | Current Coverage | Target | Priority |
|--------|------------------|--------|----------|
| `detectDeepNesting` | Partial | 100% | High |
| `detectLongMethods` | Partial | 95% | High |
| `detectDuplicateCodePatterns` | Low | 90% | Critical |
| `detectDuplicateFunctions` | None | 90% | Critical |
| `detectDuplicateImports` | None | 90% | Critical |
| `detectDuplicateUtilities` | None | 90% | Critical |
| `detectDuplicateTodos` | Basic | 85% | Low |
| `findStaleComments` | None | 85% | Medium |
| `findVersionMismatches` | None | 85% | Medium |

#### Category D: Integration Test Analysis (~15% of coverage)

| Method | Current Coverage | Target | Priority |
|--------|------------------|--------|----------|
| `identifyCriticalPaths` | None | 90% | Critical |
| `checkIntegrationTestCoverage` | None | 90% | Critical |
| `detectUncoveredComponentInteractions` | None | 85% | High |
| `buildMissingTestReports` | None | 90% | High |
| `analyzeMissingIntegrationTests` | Low | 90% | High |

#### Category E: Utility Methods (~10% of coverage)

| Method | Current Coverage | Target | Priority |
|--------|------------------|--------|----------|
| `getDefaultIndicators` | None | 100% | Medium |
| `getDefaultDescription` | None | 100% | Medium |
| `calculateMismatchSeverity` | None | 100% | Medium |
| `normalizeExportType` | None | 100% | Low |
| `isExportPublic` | None | 95% | Low |
| `escapeRegex` | None | 100% | Low |
| `execAsync` | Implicit | 90% | Low |

### 3. Test Implementation Plan

#### Phase 1: Critical Path Tests (Priority: Critical)

Create `idle-processor-duplicate-detection.test.ts`:
```typescript
describe('Duplicate Code Detection', () => {
  describe('detectDuplicateFunctions', () => {
    it('should detect duplicate function signatures across files');
    it('should normalize function patterns before comparison');
    it('should handle files with no functions');
    it('should limit results for performance');
    it('should calculate similarity correctly');
  });

  describe('detectDuplicateImports', () => {
    it('should detect common utility imports (lodash, moment, etc.)');
    it('should ignore unique imports');
    it('should handle empty files');
  });

  describe('detectDuplicateUtilities', () => {
    it('should detect validation logic patterns');
    it('should detect error handling patterns');
    it('should detect logging patterns');
  });
});
```

Create `idle-processor-integration-analysis.test.ts`:
```typescript
describe('Integration Test Analysis', () => {
  describe('identifyCriticalPaths', () => {
    it('should identify authentication-related files as critical');
    it('should identify payment-related files as critical');
    it('should identify API endpoints with high priority');
    it('should identify database operations');
    it('should identify external service calls');
    it('should assign correct criticality levels');
  });

  describe('checkIntegrationTestCoverage', () => {
    it('should detect existing integration test files');
    it('should match test files by keyword content');
    it('should return coverage map for all critical paths');
  });

  describe('buildMissingTestReports', () => {
    it('should generate reports for uncovered paths');
    it('should sort by priority (critical > high > medium > low)');
    it('should include appropriate descriptions for each type');
  });
});
```

#### Phase 2: Strategy Configuration Tests (Priority: High)

Enhance `idle-processor-strategy.test.ts`:
```typescript
describe('Strategy Configuration', () => {
  describe('IdleTaskGenerator integration', () => {
    it('should use strategy weights from config');
    it('should fallback to default weights when config missing');
    it('should reset generator between cycles');
    it('should limit tasks to maxIdleTasks');
  });

  describe('weighted selection', () => {
    it('should select types according to weights');
    it('should handle zero weights gracefully');
    it('should handle all-zero weights with uniform selection');
  });
});
```

#### Phase 3: Utility Method Tests (Priority: Medium)

Add to `idle-processor.test.ts`:
```typescript
describe('Utility Methods', () => {
  describe('getDefaultIndicators', () => {
    it('should return correct indicators for standard sections');
    it('should fallback to section name for unknown sections');
  });

  describe('getDefaultDescription', () => {
    it('should return correct descriptions for standard sections');
    it('should generate fallback for unknown sections');
  });

  describe('calculateMismatchSeverity', () => {
    it('should return high for major version differences');
    it('should return medium for minor version differences');
    it('should return low for patch version differences');
    it('should handle non-semver versions');
  });

  describe('normalizeExportType', () => {
    it('should normalize let/var to variable');
    it('should preserve standard types');
    it('should fallback to function for unknown types');
  });

  describe('isExportPublic', () => {
    it('should detect internal paths as private');
    it('should detect underscore prefixes as private');
    it('should detect .d.ts files as private');
    it('should mark standard exports as public');
  });

  describe('escapeRegex', () => {
    it('should escape special regex characters');
    it('should handle empty strings');
  });
});
```

#### Phase 4: Edge Cases and Error Handling (Priority: Medium)

```typescript
describe('Error Handling', () => {
  describe('exec command failures', () => {
    it('should handle find command failures');
    it('should handle grep command failures');
    it('should return defaults on file system errors');
  });

  describe('malformed data', () => {
    it('should handle malformed package.json');
    it('should handle empty source files');
    it('should handle binary files gracefully');
  });

  describe('performance limits', () => {
    it('should limit file analysis to configured maximum');
    it('should limit results for each analysis type');
    it('should timeout long-running operations');
  });
});
```

### 4. Mock Strategies

For consistent testing, use these mock patterns:

```typescript
// File system mock
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockImplementation((path: string) => {
      // Return different content based on path patterns
    }),
  },
}));

// Child process mock for exec commands
vi.mock('child_process', () => ({
  exec: vi.fn().mockImplementation((cmd: string, opts: any, callback: Function) => {
    // Return different results based on command patterns
  }),
}));

// Dynamic imports mock
vi.mock('./stale-comment-detector.js', () => ({
  StaleCommentDetector: vi.fn().mockImplementation(() => ({
    findStaleComments: vi.fn().mockResolvedValue([]),
  })),
}));
```

### 5. Coverage Verification

After implementation, run:
```bash
npm run test -- --coverage --testPathPattern="idle-processor"
```

Target metrics:
- **Line Coverage**: 90%+
- **Branch Coverage**: 85%+
- **Function Coverage**: 90%+
- **Statement Coverage**: 90%+

## Consequences

### Positive
1. **Improved Reliability** - Comprehensive tests catch edge cases and regressions
2. **Better Documentation** - Tests serve as executable documentation
3. **Safer Refactoring** - High coverage enables confident code changes
4. **Quality Metrics** - Coverage tracking enables CI/CD gates

### Negative
1. **Maintenance Overhead** - More tests require ongoing maintenance
2. **Test Execution Time** - Additional tests increase CI/CD time
3. **Complexity** - Mock setup can become complex for integration scenarios

### Risks
1. **Over-mocking** - Excessive mocking may miss real integration issues
2. **Brittle Tests** - Tests tied to implementation details may break on refactoring

## Implementation Notes

### File Creation Order
1. `idle-processor-duplicate-detection.test.ts` (Critical priority)
2. `idle-processor-integration-analysis.test.ts` (Critical priority)
3. `idle-processor-strategy.test.ts` (High priority)
4. Enhance `idle-processor.test.ts` with utility method tests (Medium priority)

### Dependencies
- vitest for test framework
- vi.mock for mocking
- Child process mocking for shell commands
- File system mocking for file operations

### Verification Steps
1. Run `npm run build` - ensure no TypeScript errors
2. Run `npm run test` - ensure all tests pass
3. Run `npm run test -- --coverage` - verify coverage targets met
4. Run `npm run lint` - ensure code style compliance

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- ADR-001: Security Vulnerability Detection
- Existing test files in `packages/orchestrator/src/`
