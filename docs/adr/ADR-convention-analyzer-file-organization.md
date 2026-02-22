# ADR: ConventionAnalyzer File Organization Pattern Detection

**Status**: Proposed
**Date**: 2026-02-22
**Author**: Architect Agent
**Task**: Implement file organization pattern detection for ConventionAnalyzer

## Context

The APEX codebase analysis feature requires detecting file organization patterns to help developers understand and maintain consistent project structures. This ADR defines the technical architecture for detecting:

1. **Test file location patterns** - Whether tests are colocated with source files or in separate `__tests__` directories
2. **Test naming conventions** - Patterns like `*.test.ts`, `*.spec.ts`, `*.test.tsx`, etc.
3. **Source directory structure** - How source code is organized (flat, feature-based, layer-based, etc.)

This feature extends the existing `ConventionAnalysis` type and integrates with the `ProjectAnalysis` interface used by the IdleProcessor and strategy analyzers.

## Design Decisions

### 1. Extend ConventionAnalysis Type

Add a new `fileOrganization` field to the existing `ConventionAnalysisSchema` in `packages/core/src/types.ts`:

```typescript
export const FileOrganizationSchema = z.object({
  /** Test file placement strategy */
  testLocation: z.enum([
    'colocated',           // Tests next to source files (e.g., src/foo.ts, src/foo.test.ts)
    'separate-__tests__',  // Tests in __tests__ directories (e.g., src/__tests__/foo.test.ts)
    'separate-tests',      // Tests in top-level tests/ directory
    'separate-spec',       // Tests in spec/ directory (common in Ruby-influenced projects)
    'mixed',               // Multiple patterns detected
    'none'                 // No test files found
  ]),

  /** Test file naming convention */
  testNaming: z.object({
    pattern: z.enum([
      'dot-test',      // *.test.ts, *.test.js
      'dot-spec',      // *.spec.ts, *.spec.js
      'underscore-test', // *_test.ts, *_test.js
      'suffix-Test',   // *Test.ts, *Test.js (Java-style)
      'mixed',         // Multiple patterns
      'none'           // No test files found
    ]),
    extensions: z.array(z.string()).default([]),  // Detected extensions like ['ts', 'tsx', 'js']
    examples: z.array(z.string()).default([]),    // Example test file paths
  }),

  /** Source directory structure pattern */
  sourceStructure: z.enum([
    'flat',                // All files in src/
    'feature-based',       // Organized by feature (src/users/, src/orders/)
    'layer-based',         // Organized by layer (src/controllers/, src/services/)
    'domain-driven',       // DDD-style (src/domain/, src/application/)
    'component-based',     // UI components (src/components/)
    'hybrid',              // Combination of patterns
    'monorepo',            // packages/ structure
    'unstructured'         // No clear pattern
  ]),

  /** Additional structural patterns */
  patterns: z.object({
    /** Has dedicated fixtures/test-data directory */
    hasFixturesDir: z.boolean().default(false),
    /** Has dedicated mocks directory */
    hasMocksDir: z.boolean().default(false),
    /** Barrel exports pattern (index.ts in directories) */
    usesBarrelExports: z.boolean().default(false),
    /** Kebab-case directory naming */
    kebabCaseDirectories: z.boolean().default(false),
    /** PascalCase directory naming (common in React) */
    pascalCaseDirectories: z.boolean().default(false),
    /** Max directory depth observed */
    maxDepth: z.number().int().min(0).default(0),
  }).optional(),

  /** Confidence score for the analysis (0-1) */
  confidence: z.number().min(0).max(1).default(1),
});

export type FileOrganization = z.infer<typeof FileOrganizationSchema>;
```

### 2. Create ConventionAnalyzer Class

Implement the analyzer in `packages/orchestrator/src/analyzers/convention-analyzer.ts`:

```typescript
/**
 * ConventionAnalyzer - Analyzes file organization patterns and coding conventions
 *
 * Detects:
 * - Test file location patterns (colocated vs __tests__ directories)
 * - Test naming conventions (*.test.ts, *.spec.ts, etc.)
 * - Source directory structure (flat, feature-based, layer-based)
 * - Additional organizational patterns (fixtures, mocks, barrel exports)
 */
export class ConventionAnalyzer {
  private projectPath: string;
  private fileCache: Map<string, string[]> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Main analysis entry point
   */
  async analyze(): Promise<FileOrganization> {
    // 1. Scan for test files
    const testFiles = await this.findTestFiles();

    // 2. Scan for source files
    const sourceFiles = await this.findSourceFiles();

    // 3. Detect test location pattern
    const testLocation = this.detectTestLocation(testFiles, sourceFiles);

    // 4. Detect test naming convention
    const testNaming = this.detectTestNaming(testFiles);

    // 5. Detect source structure
    const sourceStructure = this.detectSourceStructure(sourceFiles);

    // 6. Detect additional patterns
    const patterns = await this.detectAdditionalPatterns();

    // 7. Calculate confidence
    const confidence = this.calculateConfidence(testFiles, sourceFiles);

    return {
      testLocation,
      testNaming,
      sourceStructure,
      patterns,
      confidence,
    };
  }

  // ... implementation methods
}
```

### 3. Detection Algorithms

#### Test Location Detection

```typescript
private detectTestLocation(
  testFiles: string[],
  sourceFiles: string[]
): FileOrganization['testLocation'] {
  if (testFiles.length === 0) return 'none';

  const patterns = {
    colocated: 0,
    __tests__: 0,
    topLevelTests: 0,
    spec: 0,
  };

  for (const testFile of testFiles) {
    if (testFile.includes('/__tests__/')) {
      patterns.__tests__++;
    } else if (testFile.startsWith('tests/') || testFile.startsWith('./tests/')) {
      patterns.topLevelTests++;
    } else if (testFile.startsWith('spec/') || testFile.startsWith('./spec/')) {
      patterns.spec++;
    } else {
      // Check if source file exists next to test
      const sourceFile = this.getCorrespondingSourceFile(testFile);
      if (sourceFiles.includes(sourceFile)) {
        patterns.colocated++;
      }
    }
  }

  // Determine dominant pattern
  const total = testFiles.length;
  const threshold = 0.7; // 70% threshold for primary pattern

  if (patterns.colocated / total >= threshold) return 'colocated';
  if (patterns.__tests__ / total >= threshold) return 'separate-__tests__';
  if (patterns.topLevelTests / total >= threshold) return 'separate-tests';
  if (patterns.spec / total >= threshold) return 'separate-spec';

  return 'mixed';
}
```

#### Test Naming Detection

```typescript
private detectTestNaming(testFiles: string[]): FileOrganization['testNaming'] {
  if (testFiles.length === 0) {
    return { pattern: 'none', extensions: [], examples: [] };
  }

  const patterns = {
    dotTest: 0,   // .test.ts
    dotSpec: 0,   // .spec.ts
    underscoreTest: 0,  // _test.ts
    suffixTest: 0,  // Test.ts
  };
  const extensions = new Set<string>();
  const examples: string[] = [];

  for (const file of testFiles) {
    const basename = path.basename(file);

    if (basename.includes('.test.')) patterns.dotTest++;
    else if (basename.includes('.spec.')) patterns.dotSpec++;
    else if (basename.includes('_test.')) patterns.underscoreTest++;
    else if (basename.match(/Test\.(ts|js|tsx|jsx)$/)) patterns.suffixTest++;

    // Extract extension
    const ext = path.extname(file).slice(1);
    if (ext) extensions.add(ext);

    // Collect examples (limit to 5)
    if (examples.length < 5) examples.push(file);
  }

  // Determine dominant pattern
  const total = testFiles.length;
  let pattern: FileOrganization['testNaming']['pattern'] = 'mixed';

  if (patterns.dotTest / total >= 0.7) pattern = 'dot-test';
  else if (patterns.dotSpec / total >= 0.7) pattern = 'dot-spec';
  else if (patterns.underscoreTest / total >= 0.7) pattern = 'underscore-test';
  else if (patterns.suffixTest / total >= 0.7) pattern = 'suffix-Test';

  return {
    pattern,
    extensions: Array.from(extensions),
    examples,
  };
}
```

#### Source Structure Detection

```typescript
private detectSourceStructure(sourceFiles: string[]): FileOrganization['sourceStructure'] {
  if (sourceFiles.length === 0) return 'unstructured';

  // Check for monorepo structure
  if (sourceFiles.some(f => f.startsWith('packages/'))) {
    return 'monorepo';
  }

  // Analyze directory patterns
  const topLevelDirs = new Set<string>();
  const layerPatterns = ['controllers', 'services', 'models', 'repositories', 'handlers'];
  const componentPatterns = ['components', 'views', 'pages', 'layouts'];
  const domainPatterns = ['domain', 'application', 'infrastructure', 'interfaces'];

  for (const file of sourceFiles) {
    const parts = file.split('/').filter(Boolean);
    if (parts.length > 1 && parts[0] === 'src') {
      topLevelDirs.add(parts[1]);
    }
  }

  const dirs = Array.from(topLevelDirs).map(d => d.toLowerCase());

  // Check for layer-based
  const layerMatches = dirs.filter(d => layerPatterns.includes(d)).length;
  if (layerMatches >= 2) return 'layer-based';

  // Check for component-based
  const componentMatches = dirs.filter(d => componentPatterns.includes(d)).length;
  if (componentMatches >= 1 && dirs.includes('components')) return 'component-based';

  // Check for domain-driven
  const domainMatches = dirs.filter(d => domainPatterns.includes(d)).length;
  if (domainMatches >= 2) return 'domain-driven';

  // Check for feature-based (directories that look like feature names)
  if (topLevelDirs.size > 3 && !dirs.some(d => layerPatterns.includes(d))) {
    return 'feature-based';
  }

  // Check for flat structure
  if (topLevelDirs.size <= 2) return 'flat';

  return 'hybrid';
}
```

### 4. Integration with ProjectAnalysis

Extend the `ProjectAnalysis` interface in `packages/orchestrator/src/idle-processor.ts`:

```typescript
export interface ProjectAnalysis {
  // ... existing fields ...

  /** File organization and convention patterns */
  fileOrganization?: FileOrganization;
}
```

Add the analysis call in `analyzeProject()`:

```typescript
private async analyzeProject(): Promise<ProjectAnalysis> {
  const conventionAnalyzer = new ConventionAnalyzer(this.projectPath);

  const analysis: ProjectAnalysis = {
    codebaseSize: await this.analyzeCodebaseSize(),
    testCoverage: await this.analyzeTestCoverage(),
    dependencies: await this.analyzeDependencies(),
    codeQuality: await this.analyzeCodeQuality(),
    documentation: await this.analyzeDocumentation(),
    performance: await this.analyzePerformance(),
    testAnalysis: await this.analyzeTestAnalysis(),
    fileOrganization: await conventionAnalyzer.analyze(), // NEW
  };

  return analysis;
}
```

### 5. Test Strategy

Create comprehensive tests in `packages/orchestrator/src/analyzers/__tests__/convention-analyzer.test.ts`:

```typescript
describe('ConventionAnalyzer', () => {
  describe('Test Location Detection', () => {
    it('should detect colocated test pattern', async () => {
      // Setup: Create mock file structure with tests next to source
      // Assert: testLocation === 'colocated'
    });

    it('should detect __tests__ directory pattern', async () => {
      // Setup: Create mock file structure with __tests__ directories
      // Assert: testLocation === 'separate-__tests__'
    });

    it('should detect mixed patterns', async () => {
      // Setup: Create mock file structure with both patterns
      // Assert: testLocation === 'mixed'
    });
  });

  describe('Test Naming Detection', () => {
    it('should detect .test.ts pattern', async () => {
      // Files: foo.test.ts, bar.test.ts
      // Assert: testNaming.pattern === 'dot-test'
    });

    it('should detect .spec.ts pattern', async () => {
      // Files: foo.spec.ts, bar.spec.ts
      // Assert: testNaming.pattern === 'dot-spec'
    });
  });

  describe('Source Structure Detection', () => {
    it('should detect monorepo structure', async () => {
      // Files: packages/core/src/index.ts
      // Assert: sourceStructure === 'monorepo'
    });

    it('should detect layer-based structure', async () => {
      // Files: src/controllers/..., src/services/...
      // Assert: sourceStructure === 'layer-based'
    });

    it('should detect component-based structure', async () => {
      // Files: src/components/Button/...
      // Assert: sourceStructure === 'component-based'
    });
  });

  describe('Integration with ProjectAnalysis', () => {
    it('should include fileOrganization in ProjectAnalysis output', async () => {
      // Run full analysis
      // Assert: analysis.fileOrganization is defined
      // Assert: FileOrganizationSchema.parse succeeds
    });
  });
});
```

## File Structure

```
packages/
├── core/
│   └── src/
│       └── types.ts                          # Add FileOrganizationSchema
├── orchestrator/
│   └── src/
│       ├── analyzers/
│       │   ├── convention-analyzer.ts        # NEW: ConventionAnalyzer class
│       │   ├── index.ts                      # Export ConventionAnalyzer
│       │   └── __tests__/
│       │       └── convention-analyzer.test.ts  # NEW: Tests
│       └── idle-processor.ts                 # Integration point
```

## Implementation Plan

### Phase 1: Type Definitions (Core Package)
1. Add `FileOrganizationSchema` to `packages/core/src/types.ts`
2. Export the new type from `packages/core/src/index.ts`
3. Add JSDoc documentation with examples

### Phase 2: ConventionAnalyzer Implementation (Orchestrator Package)
1. Create `packages/orchestrator/src/analyzers/convention-analyzer.ts`
2. Implement file scanning utilities
3. Implement test location detection algorithm
4. Implement test naming convention detection
5. Implement source structure detection
6. Implement additional pattern detection (fixtures, mocks, barrel exports)
7. Add confidence scoring

### Phase 3: Integration
1. Extend `ProjectAnalysis` interface with `fileOrganization` field
2. Integrate `ConventionAnalyzer` into `IdleProcessor.analyzeProject()`
3. Export from `packages/orchestrator/src/analyzers/index.ts`

### Phase 4: Testing
1. Create unit tests for each detection algorithm
2. Create integration tests with mock file structures
3. Validate schema compliance
4. Performance testing with large codebases

## API Design

### Public Interface

```typescript
// Usage in IdleProcessor
const analyzer = new ConventionAnalyzer('/path/to/project');
const fileOrganization = await analyzer.analyze();

// Type-safe output
console.log(fileOrganization.testLocation);  // 'colocated' | 'separate-__tests__' | ...
console.log(fileOrganization.testNaming.pattern);  // 'dot-test' | 'dot-spec' | ...
console.log(fileOrganization.sourceStructure);  // 'monorepo' | 'layer-based' | ...
```

### Error Handling

- File system errors are caught and result in partial analysis
- Empty projects return default values with low confidence
- Binary files and node_modules are automatically excluded

## Acceptance Criteria Alignment

| Criterion | Implementation |
|-----------|----------------|
| ConventionAnalyzer detects test file location patterns | `detectTestLocation()` method with 5 pattern types |
| Detects test naming conventions | `detectTestNaming()` with pattern, extensions, examples |
| Detects source directory structure | `detectSourceStructure()` with 8 structure types |
| Integrates with existing ProjectAnalysis | `fileOrganization` field added to `ProjectAnalysis` |
| Tests validate organization pattern detection | Unit + integration tests in `convention-analyzer.test.ts` |

## Performance Considerations

1. **File Caching**: Cache file listings to avoid repeated file system scans
2. **Lazy Loading**: Only scan directories as needed
3. **Parallel Processing**: Use Promise.all for independent analysis tasks
4. **Size Limits**: Skip analysis for projects with >10,000 files (configurable)
5. **Exclusions**: Always exclude `node_modules`, `dist`, `.git`, etc.

## Dependencies

### Required
- `fs/promises` (Node.js built-in)
- `path` (Node.js built-in)
- `glob` or manual directory traversal

### Optional
- No new external dependencies required

## Consequences

### Positive
- Enables automated understanding of project organization
- Helps maintain consistency in new file placement
- Supports onboarding by documenting project conventions
- Integrates seamlessly with existing analysis pipeline

### Negative
- Adds computational overhead during idle analysis
- Detection heuristics may misclassify edge cases
- Mixed patterns may reduce analysis usefulness

## Related Documents

- `docs/adr/ADR-convention-analyzer-integration-tests.md` - Integration test architecture
- `packages/core/src/types.ts` - Type definitions
- `packages/orchestrator/src/idle-processor.ts` - Integration point
