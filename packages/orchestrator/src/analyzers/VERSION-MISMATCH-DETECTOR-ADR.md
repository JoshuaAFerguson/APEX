# Architecture Decision Record: Version Mismatch Detector

## Status
Proposed

## Context
The APEX project needs the ability to detect version reference mismatches between `package.json` and documentation files. This helps ensure documentation stays in sync with the actual project version.

## Decision

### Component Overview
Create a `VersionMismatchDetector` class in `packages/orchestrator/src/analyzers/` that:
1. Parses the `package.json` version field
2. Scans documentation files (`.md`, JSDoc in `.ts/.js`) for version references
3. Reports mismatches where documentation version differs from `package.json` version

### Architecture Integration

The detector follows the **existing analyzer pattern** established in the codebase:
- Extends `BaseAnalyzer` from `./index.ts`
- Implements the `StrategyAnalyzer` interface
- Integrates with `ProjectAnalysis` data structure
- Returns `TaskCandidate[]` for the idle task system

```
packages/orchestrator/src/analyzers/
├── index.ts                    # BaseAnalyzer, TaskCandidate, StrategyAnalyzer interface
├── docs-analyzer.ts            # Existing documentation analyzer
├── maintenance-analyzer.ts     # Existing maintenance analyzer (security, deps)
├── refactoring-analyzer.ts     # Existing code quality analyzer
├── tests-analyzer.ts           # Existing test coverage analyzer
└── version-mismatch-detector.ts  # NEW: Version reference analyzer (standalone utility)
└── version-mismatch-detector.test.ts # NEW: Unit tests
```

### Design Rationale

**Why a Standalone Class (Not an Analyzer)**

After analyzing the existing architecture, the VersionMismatchDetector should be a **standalone utility class**, not a StrategyAnalyzer, because:

1. **Different Purpose**: StrategyAnalyzers generate idle task candidates from `ProjectAnalysis` data. The version detector is a focused scanning tool that needs file system access.

2. **Usage Pattern**: The version detector will likely be called directly by:
   - The DocsAnalyzer (to enhance `outdatedDocs` detection)
   - CLI commands for version validation
   - Pre-commit hooks or CI pipelines

3. **Testability**: A standalone class with dependency injection is easier to unit test with file system mocks.

### Class Design

```typescript
// version-mismatch-detector.ts

export interface VersionMismatch {
  file: string;           // File path where mismatch found
  line: number;           // Line number
  foundVersion: string;   // Version found in doc (e.g., "1.2.3")
  expectedVersion: string; // Version from package.json
  context: string;        // Surrounding text for context
  type: 'exact' | 'semver-prefix' | 'partial'; // Type of match
}

export interface VersionDetectorResult {
  packageVersion: string;  // The package.json version
  mismatches: VersionMismatch[];
  scannedFiles: number;
  matchedReferences: number; // Total version refs found
}

export interface VersionDetectorOptions {
  /** File extensions to scan (default: ['.md', '.ts', '.js', '.tsx', '.jsx']) */
  extensions?: string[];
  /** Directories to exclude (default: ['node_modules', 'dist', '.git']) */
  excludeDirs?: string[];
  /** Include JSDoc comments in TypeScript/JavaScript files */
  includeJSDoc?: boolean;
  /** Custom version patterns (regex strings) */
  customPatterns?: string[];
}

export class VersionMismatchDetector {
  constructor(
    private projectRoot: string,
    private options: VersionDetectorOptions = {}
  );

  /**
   * Analyze project for version mismatches
   */
  async analyze(): Promise<VersionDetectorResult>;

  /**
   * Parse package.json version
   */
  async getPackageVersion(): Promise<string>;

  /**
   * Scan a single file for version references
   */
  scanFile(filePath: string, content: string, packageVersion: string): VersionMismatch[];
}
```

### Version Pattern Detection

The detector identifies version references using these patterns:

```typescript
const VERSION_PATTERNS = [
  // Exact semver: v1.2.3, v1.2.3-beta.1
  /v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/gi,

  // "version X.Y.Z" text
  /version\s+v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/gi,

  // JSDoc @version tag
  /@version\s+v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/gi,

  // "since vX.Y.Z" annotations
  /@since\s+v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/gi,

  // Changelog/release notes patterns
  /\[?(\d+\.\d+\.\d+)\]?\s*[-–—]\s*\d{4}/gi,  // [1.2.3] - 2024
];
```

### Mismatch Classification

Mismatches are classified by severity:

1. **Critical (high)**: Major version mismatch (e.g., doc says v1.x, package is v2.x)
2. **Normal**: Minor version mismatch
3. **Low**: Patch version mismatch

### Integration with DocsAnalyzer

The `DocsAnalyzer` can optionally use `VersionMismatchDetector` to enhance its `outdatedDocs` detection:

```typescript
// In DocsAnalyzer.analyze() - future enhancement
if (analysis.documentation.outdatedDocs) {
  const versionMismatches = analysis.documentation.outdatedDocs.filter(
    doc => doc.type === 'version-mismatch'
  );
  // Generate task candidates based on mismatches
}
```

### File Scanning Strategy

1. **Markdown Files (`.md`)**:
   - Scan entire content
   - Focus on frontmatter, badges, installation sections

2. **TypeScript/JavaScript Files (`.ts`, `.js`, `.tsx`, `.jsx`)**:
   - Extract JSDoc comments only (not code)
   - Look for `@version`, `@since` tags
   - Check module-level documentation

### Configuration

The detector supports configuration via:
- Constructor options (programmatic)
- `.apex/config.yaml` (future integration)

### Error Handling

- Missing `package.json`: Throw descriptive error
- Invalid version format: Log warning, continue
- File read errors: Log warning, skip file

## Alternatives Considered

### Alternative 1: Extend DocsAnalyzer
- **Rejected**: DocsAnalyzer works with `ProjectAnalysis` data structure, not file system. Would require major refactoring.

### Alternative 2: Create new StrategyAnalyzer type
- **Rejected**: StrategyAnalyzers are for idle task generation. Version detection is a utility function.

### Alternative 3: External npm package
- **Rejected**: Tight integration needed with APEX ecosystem. Custom patterns required.

## Consequences

### Positive
- Clean separation of concerns
- Easy to test in isolation
- Can be reused by multiple consumers (DocsAnalyzer, CLI, CI)
- Follows existing patterns in the codebase

### Negative
- Additional file to maintain
- May need future integration work with ProjectAnalysis

## Implementation Plan

1. Create `version-mismatch-detector.ts` with core class
2. Implement version pattern matching
3. Add file scanning logic with glob patterns
4. Create comprehensive unit tests
5. Export from `analyzers/index.ts`

## Test Coverage Requirements

Unit tests must cover:
1. Exact version matches (e.g., `v1.2.3` matches `1.2.3`)
2. Semver patterns (`^1.2.3`, `~1.2.3`, `>=1.2.3`)
3. Multiple version references per file
4. JSDoc `@version` and `@since` tags
5. Markdown badge patterns
6. Version in changelog format
7. Edge cases: no package.json, empty files, binary files
8. Mismatch classification (major/minor/patch)

## Technical Notes

### Semver Comparison
Use native string comparison after normalizing versions:
- Strip leading 'v' prefix
- Handle prerelease tags correctly

### Performance Considerations
- Use streaming file reads for large files
- Implement early exit on binary file detection
- Cache package.json version across scans
