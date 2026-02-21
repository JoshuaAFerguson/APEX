# ADR-001: Import Auto-Fixer Service Architecture

## Status
Proposed

## Context
APEX needs an `ImportAutoFixer` service class that can automatically detect and fix missing imports in TypeScript/JavaScript files. This service will:
1. Detect missing imports using ESLint rules (like `import/no-unresolved`) or custom AST analysis
2. Add the necessary import statements to fix issues
3. Return a list of imports added
4. Respect configuration settings
5. Include comprehensive unit tests

## Decision

### Architecture Overview

The `ImportAutoFixer` will be implemented as a standalone service class in `@apex/orchestrator` that integrates with the existing linter infrastructure but operates independently for import-specific auto-fixing.

```
packages/orchestrator/src/
├── import-auto-fixer/
│   ├── index.ts                    # Main exports
│   ├── import-auto-fixer.ts        # ImportAutoFixer class
│   ├── import-auto-fixer.test.ts   # Unit tests
│   ├── detectors/
│   │   ├── index.ts                # Detector exports
│   │   ├── base-detector.ts        # Base interface/abstract class
│   │   ├── eslint-detector.ts      # ESLint-based detection
│   │   └── typescript-detector.ts  # TypeScript compiler-based detection
│   ├── resolvers/
│   │   ├── index.ts                # Resolver exports
│   │   ├── base-resolver.ts        # Base interface/abstract class
│   │   ├── package-resolver.ts     # Resolves from node_modules
│   │   ├── local-resolver.ts       # Resolves local project files
│   │   └── alias-resolver.ts       # Handles path aliases (tsconfig paths)
│   └── types.ts                    # TypeScript interfaces and types
```

### Core Components

#### 1. ImportAutoFixer Class (Main Service)

```typescript
interface ImportAutoFixerOptions {
  projectPath: string;
  detector?: 'eslint' | 'typescript' | 'auto';
  resolvers?: ImportResolverConfig;
  dryRun?: boolean;
  preferredImportStyle?: 'named' | 'default' | 'namespace';
  organizeImports?: boolean;
  respectExistingStyle?: boolean;
}

interface ImportFixResult {
  success: boolean;
  filePath: string;
  importsAdded: AddedImport[];
  errors: ImportFixError[];
  modifiedContent?: string;
}

interface AddedImport {
  specifier: string;           // e.g., "React", "{ useState }"
  source: string;              // e.g., "react", "./utils"
  importType: 'named' | 'default' | 'namespace' | 'side-effect';
  line: number;                // Line where import was added
  isTypeOnly?: boolean;        // For TypeScript type-only imports
}

class ImportAutoFixer extends EventEmitter<ImportAutoFixerEvents> {
  constructor(options: ImportAutoFixerOptions);

  // Core methods
  async analyze(files: string[]): Promise<MissingImportAnalysis[]>;
  async fix(files: string[]): Promise<ImportFixResult[]>;
  async fixFile(filePath: string): Promise<ImportFixResult>;

  // Configuration
  configure(config: Partial<ImportAutoFixerConfig>): void;
  getConfig(): ImportAutoFixerConfig;

  // Utility
  async isAvailable(): Promise<boolean>;
}
```

#### 2. Import Detectors (Strategy Pattern)

Detectors are responsible for identifying missing imports in source files.

```typescript
interface IImportDetector {
  readonly id: string;
  readonly name: string;

  detect(filePath: string, content: string): Promise<MissingImport[]>;
  isAvailable(): Promise<boolean>;
}

interface MissingImport {
  identifier: string;          // The symbol that's missing
  line: number;                // Where it's used
  column: number;
  context?: string;            // Usage context (helps with resolution)
  suggestedSources?: string[]; // Potential import sources
}
```

**Detector Implementations:**

1. **ESLintDetector**: Uses ESLint with `import/no-unresolved`, `import/no-undefined`, and `@typescript-eslint/no-unused-vars` rules
2. **TypeScriptDetector**: Uses TypeScript compiler API for more accurate detection with full type information

#### 3. Import Resolvers (Chain of Responsibility Pattern)

Resolvers determine where to import missing symbols from.

```typescript
interface IImportResolver {
  readonly id: string;
  readonly priority: number;

  canResolve(identifier: string, context: ResolverContext): Promise<boolean>;
  resolve(identifier: string, context: ResolverContext): Promise<ImportResolution | null>;
}

interface ImportResolution {
  source: string;              // Import path
  importType: 'named' | 'default' | 'namespace';
  isTypeOnly: boolean;
  confidence: number;          // 0-1, how confident we are
}

interface ResolverContext {
  filePath: string;
  projectPath: string;
  tsConfig?: TsConfigInfo;
  packageJson?: PackageJsonInfo;
  existingImports: ExistingImport[];
}
```

**Resolver Implementations (in priority order):**

1. **LocalResolver** (priority: 1): Searches project source files for exports
2. **AliasResolver** (priority: 2): Handles TypeScript path aliases from tsconfig.json
3. **PackageResolver** (priority: 3): Searches node_modules and package.json dependencies

### Configuration Schema

```typescript
interface ImportAutoFixerConfig {
  // Detection settings
  detector: 'eslint' | 'typescript' | 'auto';

  // Resolution settings
  resolvers: {
    local: {
      enabled: boolean;
      searchPaths: string[];      // Additional search paths
      excludePatterns: string[];  // Patterns to exclude
    };
    alias: {
      enabled: boolean;
      // Automatically reads from tsconfig.json
    };
    package: {
      enabled: boolean;
      preferredPackages: Record<string, string>;  // identifier -> package mapping
      excludePackages: string[];  // Packages to never suggest
    };
  };

  // Import style settings
  style: {
    preferredImportStyle: 'named' | 'default' | 'auto';
    useTypeImports: boolean;      // Use `import type` when possible
    organizeImports: boolean;     // Sort and group imports
    respectExistingStyle: boolean; // Match existing import style in file
    quoteStyle: 'single' | 'double' | 'auto';
    semicolons: boolean;
  };

  // Behavior settings
  behavior: {
    dryRun: boolean;
    interactive: boolean;         // Prompt for ambiguous resolutions
    autoInstallPackages: boolean; // npm install if package missing
    maxSuggestionsPerImport: number;
  };
}
```

### Event System

```typescript
interface ImportAutoFixerEvents {
  'analysis:started': (event: { files: string[] }) => void;
  'analysis:completed': (event: { results: MissingImportAnalysis[] }) => void;
  'fix:started': (event: { filePath: string }) => void;
  'fix:import-added': (event: { filePath: string; import: AddedImport }) => void;
  'fix:completed': (event: { result: ImportFixResult }) => void;
  'fix:error': (event: { filePath: string; error: Error }) => void;
  'resolution:ambiguous': (event: { identifier: string; options: ImportResolution[] }) => void;
}
```

### Integration with Existing Systems

#### 1. LinterService Integration

The ImportAutoFixer can be used as a post-processor after linting:

```typescript
// In ApexOrchestrator or as standalone usage
const linterResult = await linterService.execute({ files, fix: false });
const importIssues = linterResult.issues.filter(
  i => i.ruleId.includes('import/') || i.ruleId.includes('no-undef')
);

if (importIssues.length > 0) {
  const fixer = new ImportAutoFixer({ projectPath });
  const fixResults = await fixer.fix(affectedFiles);
}
```

#### 2. Configuration Loading

Respects existing APEX configuration patterns:

```yaml
# .apex/config.yaml
importAutoFixer:
  enabled: true
  detector: auto
  style:
    useTypeImports: true
    organizeImports: true
  resolvers:
    package:
      preferredPackages:
        React: react
        useState: react
```

### Error Handling

```typescript
interface ImportFixError {
  type: 'detection' | 'resolution' | 'application' | 'io';
  identifier?: string;
  message: string;
  recoverable: boolean;
  suggestion?: string;
}
```

### Testing Strategy

1. **Unit Tests** (`import-auto-fixer.test.ts`):
   - Detection accuracy for various missing import scenarios
   - Resolution correctness for different import types
   - Configuration respect
   - Edge cases (circular imports, conflicting names, etc.)

2. **Integration Tests**:
   - Full pipeline from detection to fix application
   - Integration with actual ESLint and TypeScript
   - File system operations

3. **Test Fixtures**:
   - Sample TypeScript/JavaScript files with known missing imports
   - Mock node_modules for resolver testing

## Alternatives Considered

### Alternative 1: Extend ESLintPlugin
Extending the existing ESLintPlugin to handle import fixes was considered but rejected because:
- Import resolution is complex and deserves dedicated logic
- ESLint's auto-fix for imports is limited
- We need TypeScript-aware resolution

### Alternative 2: Use ts-morph for everything
Using ts-morph for both detection and manipulation was considered but:
- Adds significant dependency size
- ESLint detection provides broader rule coverage
- Hybrid approach gives best of both worlds

### Alternative 3: Simple regex-based detection
Using regex patterns for detection was considered but rejected because:
- Too error-prone for complex TypeScript code
- Can't handle scoped variables properly
- No type awareness

## Consequences

### Positive
- Clean separation of concerns (detection vs. resolution vs. application)
- Extensible architecture for new detectors/resolvers
- Consistent with existing APEX patterns
- Full TypeScript type safety
- Comprehensive testing approach

### Negative
- Additional complexity in the codebase
- Dependency on ESLint/TypeScript being available
- May require manual intervention for ambiguous cases

### Neutral
- New directory structure in orchestrator package
- Configuration schema extension

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create directory structure and types
2. Implement base detector interface
3. Implement base resolver interface
4. Create ImportAutoFixer skeleton

### Phase 2: Detection
1. Implement ESLintDetector
2. Implement TypeScriptDetector (optional, can use ESLint primarily)
3. Add detection tests

### Phase 3: Resolution
1. Implement LocalResolver
2. Implement AliasResolver
3. Implement PackageResolver
4. Add resolution tests

### Phase 4: Integration
1. Complete ImportAutoFixer implementation
2. Add file manipulation logic
3. Integration tests
4. Configuration integration

### Phase 5: Polish
1. Edge case handling
2. Performance optimization
3. Documentation
4. Full test coverage

## References

- Existing LinterService: `packages/orchestrator/src/linter/service.ts`
- ESLint Plugin: `packages/orchestrator/src/linter/plugins/eslint.ts`
- Plugin Base Class: `packages/orchestrator/src/linter/plugin.ts`
- Core Types: `packages/core/src/types.ts`
