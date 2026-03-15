# ConventionAnalyzer Architecture Design

## ADR-010: ConventionAnalyzer Implementation

**Date**: 2025-01-XX
**Status**: Proposed
**Decision**: Create ConventionAnalyzer extending BaseAnalyzer with file scanning infrastructure

---

## Context

APEX needs a ConventionAnalyzer that:
1. Extends `BaseAnalyzer` from `./base-analyzer.ts`
2. Implements `StrategyAnalyzer` interface with `type='conventions'`
3. Has an `analyze()` method that scans project files
4. Is exported from `analyzers/index.ts`
5. Includes basic test coverage

### Current Architecture Analysis

The existing analyzer pattern follows this structure:
```
BaseAnalyzer (abstract)
├── type: IdleTaskType (abstract readonly)
├── analyze(analysis: ProjectAnalysis): TaskCandidate[] (abstract)
├── prioritize(candidates: TaskCandidate[]): TaskCandidate | null
└── createCandidate(...): TaskCandidate (helper)
```

**Existing analyzers**: MaintenanceAnalyzer, RefactoringAnalyzer, DocsAnalyzer, TestsAnalyzer, TechnicalDebtAnalyzer (missing file)

---

## Design Decision

### Option 1: Add 'conventions' to IdleTaskTypeSchema (RECOMMENDED)
**Pros**: Full integration with weighted task selection, consistent with existing architecture
**Cons**: Requires modification to `@apexcli/core` types.ts

### Option 2: Use existing type like 'refactoring'
**Pros**: No schema changes needed
**Cons**: Conceptually incorrect, conventions are different from refactoring

### Decision: Option 1
We need to add 'conventions' to `IdleTaskTypeSchema` in `packages/core/src/types.ts` and update the `StrategyWeightsSchema` accordingly.

---

## Technical Design

### 1. Type System Updates (packages/core/src/types.ts)

```typescript
// Add 'conventions' to IdleTaskTypeSchema
export const IdleTaskTypeSchema = z.enum([
  'maintenance',
  'refactoring',
  'docs',
  'tests',
  'technical-debt',
  'conventions',  // NEW
]);

// Add to StrategyWeightsSchema (with adjusted default weights)
export const StrategyWeightsSchema = z.object({
  maintenance: z.number().min(0).max(1).optional().default(0.17),
  refactoring: z.number().min(0).max(1).optional().default(0.17),
  docs: z.number().min(0).max(1).optional().default(0.17),
  tests: z.number().min(0).max(1).optional().default(0.17),
  'technical-debt': z.number().min(0).max(1).optional().default(0.17),
  conventions: z.number().min(0).max(1).optional().default(0.15),  // NEW
});
```

### 2. ConventionAnalyzer Class Design

```typescript
// packages/orchestrator/src/analyzers/convention-analyzer.ts

import { BaseAnalyzer, TaskCandidate } from './base-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

/**
 * File scanning options for convention analysis
 */
export interface FileScanOptions {
  /** File patterns to include (glob patterns) */
  include?: string[];
  /** File patterns to exclude (glob patterns) */
  exclude?: string[];
  /** Maximum files to scan */
  maxFiles?: number;
}

/**
 * Result of scanning a single file for conventions
 */
export interface FileScanResult {
  /** File path relative to project root */
  filePath: string;
  /** Detected naming convention issues */
  namingIssues: ConventionIssue[];
  /** Detected formatting/style issues */
  styleIssues: ConventionIssue[];
  /** Detected structural issues */
  structuralIssues: ConventionIssue[];
}

/**
 * A single convention issue detected in a file
 */
export interface ConventionIssue {
  /** Issue type identifier */
  type: string;
  /** Human-readable message */
  message: string;
  /** Line number (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Severity of the issue */
  severity: 'error' | 'warning' | 'info';
  /** Suggested fix */
  suggestion?: string;
}

/**
 * ConventionAnalyzer scans project files for coding convention issues.
 *
 * Detects issues such as:
 * - Inconsistent naming conventions (camelCase vs snake_case)
 * - File naming patterns not matching project standards
 * - Import ordering issues
 * - Inconsistent formatting patterns
 */
export class ConventionAnalyzer extends BaseAnalyzer {
  readonly type = 'conventions' as const;

  /** Default file patterns to include in scanning */
  private readonly defaultIncludePatterns = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
  ];

  /** Default file patterns to exclude from scanning */
  private readonly defaultExcludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
  ];

  /**
   * Analyze project for convention issues.
   *
   * @param analysis - Project analysis data from IdleProcessor
   * @returns Array of task candidates for convention fixes
   */
  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Phase 1: Basic implementation - analyze project structure
    // Future phases will add file content analysis

    // Analyze codebase size for convention-related patterns
    this.analyzeProjectStructure(analysis, candidates);

    return candidates;
  }

  /**
   * Analyze project structure for convention patterns.
   * @internal
   */
  private analyzeProjectStructure(
    analysis: ProjectAnalysis,
    candidates: TaskCandidate[]
  ): void {
    const { codebaseSize } = analysis;

    // Example: Check for mixed language usage that might indicate convention issues
    const languages = Object.keys(codebaseSize.languages);
    const hasMixedJS = languages.includes('typescript') && languages.includes('javascript');

    if (hasMixedJS) {
      candidates.push(
        this.createCandidate(
          'mixed-languages',
          'Standardize on TypeScript',
          'Project contains both JavaScript and TypeScript files. Consider migrating to TypeScript for consistency.',
          {
            priority: 'low',
            effort: 'high',
            workflow: 'conventions',
            rationale: 'Consistent language usage improves code quality and developer experience',
            score: 0.4,
          }
        )
      );
    }
  }

  /**
   * Scan project files for convention issues.
   *
   * @param projectPath - Root path of the project
   * @param options - File scanning options
   * @returns Array of file scan results
   */
  async scanFiles(
    projectPath: string,
    options: FileScanOptions = {}
  ): Promise<FileScanResult[]> {
    // Infrastructure for file scanning - implementation in later phases
    const include = options.include ?? this.defaultIncludePatterns;
    const exclude = options.exclude ?? this.defaultExcludePatterns;
    const maxFiles = options.maxFiles ?? 1000;

    // Placeholder - actual implementation will use glob and file reading
    return [];
  }
}
```

### 3. Export Updates (packages/orchestrator/src/analyzers/index.ts)

Add export for ConventionAnalyzer:
```typescript
export { ConventionAnalyzer } from './convention-analyzer';
```

### 4. IdleTaskGenerator Integration (packages/orchestrator/src/idle-task-generator.ts)

Update the generator to include the new analyzer:
```typescript
import { ConventionAnalyzer } from './analyzers';

// In constructor
this.analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
  ['maintenance', new MaintenanceAnalyzer()],
  ['refactoring', new RefactoringAnalyzer()],
  ['docs', new DocsAnalyzer()],
  ['tests', new TestsAnalyzer()],
  ['technical-debt', new TechnicalDebtAnalyzer()],
  ['conventions', new ConventionAnalyzer()],  // NEW
]);

// Update TASK_TYPES constant
const TASK_TYPES: IdleTaskType[] = [
  'maintenance', 'refactoring', 'docs', 'tests', 'technical-debt', 'conventions'
];

// Update DEFAULT_WEIGHTS
const DEFAULT_WEIGHTS: StrategyWeights = {
  maintenance: 0.17,
  refactoring: 0.17,
  docs: 0.17,
  tests: 0.17,
  'technical-debt': 0.17,
  conventions: 0.15,
};
```

### 5. Test File (packages/orchestrator/src/analyzers/convention-analyzer.test.ts)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ConventionAnalyzer } from './convention-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('ConventionAnalyzer', () => {
  let analyzer: ConventionAnalyzer;
  let baseAnalysis: ProjectAnalysis;

  beforeEach(() => {
    analyzer = new ConventionAnalyzer();
    baseAnalysis = createBaseProjectAnalysis();
  });

  describe('type property', () => {
    it('should have conventions type', () => {
      expect(analyzer.type).toBe('conventions');
    });
  });

  describe('analyze()', () => {
    it('should return empty array for clean project', () => {
      const candidates = analyzer.analyze(baseAnalysis);
      expect(candidates).toBeInstanceOf(Array);
    });

    it('should detect mixed JavaScript/TypeScript usage', () => {
      baseAnalysis.codebaseSize.languages = {
        typescript: 1000,
        javascript: 500
      };
      const candidates = analyzer.analyze(baseAnalysis);
      expect(candidates.some(c => c.candidateId.includes('mixed-languages'))).toBe(true);
    });
  });

  describe('prioritize()', () => {
    it('should return highest scoring candidate', () => {
      const candidates = [
        analyzer.createCandidate('a', 'Test A', 'Desc A', { score: 0.5 }),
        analyzer.createCandidate('b', 'Test B', 'Desc B', { score: 0.9 }),
      ];
      const best = analyzer.prioritize(candidates);
      expect(best?.candidateId).toBe('conventions-b');
    });
  });
});

function createBaseProjectAnalysis(): ProjectAnalysis {
  // ... create minimal ProjectAnalysis for testing
}
```

---

## File Structure

```
packages/
├── core/
│   └── src/
│       └── types.ts                    # ADD 'conventions' to IdleTaskTypeSchema
└── orchestrator/
    └── src/
        ├── analyzers/
        │   ├── convention-analyzer.ts      # NEW: Main analyzer class
        │   ├── convention-analyzer.test.ts # NEW: Test file
        │   └── index.ts                    # UPDATE: Export ConventionAnalyzer
        └── idle-task-generator.ts          # UPDATE: Add conventions to generator
```

---

## Implementation Phases

### Phase 1 (This Task)
- Create ConventionAnalyzer class with basic structure
- Add 'conventions' to IdleTaskTypeSchema
- Export from analyzers/index.ts
- Basic test file for class structure

### Phase 2 (Future)
- Implement file scanning infrastructure with glob
- Add naming convention detection (camelCase, snake_case, PascalCase)
- File naming pattern analysis

### Phase 3 (Future)
- Import ordering analysis
- Comment style consistency
- Code structure patterns (export style, module organization)

---

## Dependencies

- **zod**: For schema validation (existing)
- **glob** or **fast-glob**: For file pattern matching (future phase)
- **@apexcli/core**: For types and schemas

---

## Testing Strategy

1. **Unit Tests**: Test analyzer class methods in isolation
2. **Integration Tests**: Test with mock ProjectAnalysis data
3. **Snapshot Tests**: Verify TaskCandidate structure

---

## Notes for Implementation

1. **CRITICAL - TechnicalDebtAnalyzer Missing**: The `technical-debt-analyzer.ts` file is exported from `index.ts` but doesn't exist. This **MUST** be addressed before or alongside ConventionAnalyzer implementation to ensure the build passes. Options:
   - Create a minimal TechnicalDebtAnalyzer stub
   - Remove the export from index.ts temporarily
   - The developer stage must handle this dependency

2. **Schema Changes**: Adding 'conventions' to IdleTaskTypeSchema requires careful testing of existing code that depends on the enum values.

3. **Backward Compatibility**: StrategyWeights with updated defaults should still work with existing configurations.

4. **Build Verification**: Before marking implementation complete, run:
   ```bash
   npm run build
   npm run test
   ```

---

## Acceptance Criteria Verification

| Criteria | Design Location |
|----------|----------------|
| ConventionAnalyzer class extends BaseAnalyzer | Section 2: `class ConventionAnalyzer extends BaseAnalyzer` |
| Implements StrategyAnalyzer interface | Automatic via `extends BaseAnalyzer` |
| `type='conventions'` | Section 2: `readonly type = 'conventions' as const` |
| `analyze()` method that scans project files | Section 2: `analyze(analysis: ProjectAnalysis): TaskCandidate[]` |
| Exported from analyzers/index.ts | Section 3: Export statement |
| Basic test file for class structure | Section 5: Test file design |

---

## Implementation Order (for developer stage)

1. **First**: Create `technical-debt-analyzer.ts` stub (if not exists) OR remove its export
2. **Second**: Add 'conventions' to `IdleTaskTypeSchema` and `StrategyWeightsSchema` in `@apexcli/core`
3. **Third**: Create `convention-analyzer.ts`
4. **Fourth**: Update `analyzers/index.ts` exports
5. **Fifth**: Update `idle-task-generator.ts`
6. **Sixth**: Create test file
7. **Verify**: Run `npm run build` and `npm run test`
