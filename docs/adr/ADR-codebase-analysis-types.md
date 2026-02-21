# ADR: CodebaseAnalysis Types and Schemas

**Status**: Proposed
**Date**: 2025-02-21
**Author**: Architect Agent

## Context

APEX requires a comprehensive type system for codebase analysis to support intelligent task planning, automatic context injection, and project understanding. This includes:

1. **StackAnalysis** - Language and framework detection
2. **ArchitectureAnalysis** - Component and layer mapping
3. **ConventionAnalysis** - Coding patterns and styles
4. **TechnicalDebtAnalysis** - Debt categorization and severity
5. **CodebaseAnalysis** - Main output combining all analyses

## Design Decisions

### 1. Schema Organization Pattern

Following the established patterns in `types.ts`:
- Define Zod schemas with `*Schema` suffix
- Export TypeScript types using `z.infer<>`
- Use JSDoc comments for documentation
- Group related schemas under section headers
- Use enums for categorical values with clear documentation

### 2. Schema Hierarchy

```
CodebaseAnalysis (main output)
├── StackAnalysis
│   ├── LanguageInfo (detected languages)
│   └── FrameworkInfo (detected frameworks - uses existing type)
├── ArchitectureAnalysis
│   ├── ComponentInfo (discovered components)
│   ├── LayerInfo (architectural layers)
│   └── DependencyInfo (dependencies between components)
├── ConventionAnalysis
│   ├── NamingConvention (naming patterns)
│   ├── FileOrganization (file/folder patterns)
│   └── CodeStyle (formatting/style patterns)
└── TechnicalDebtAnalysis
    └── TechnicalDebtItem (individual debt items)
```

### 3. Type Design Details

#### StackAnalysis
Detects programming languages and frameworks used in the project.

```typescript
// Language detection with confidence scoring
LanguageInfoSchema = z.object({
  name: z.string(),                    // e.g., "TypeScript", "Python"
  percentage: z.number().min(0).max(100), // % of codebase
  fileCount: z.number().int().min(0),  // number of files
  lineCount: z.number().int().min(0),  // lines of code
  extensions: z.array(z.string()),     // file extensions
});

StackAnalysisSchema = z.object({
  primaryLanguage: z.string(),         // dominant language
  languages: z.array(LanguageInfoSchema),
  frameworks: z.array(FrameworkInfoSchema), // reuse existing type
  buildTools: z.array(z.string()),     // npm, gradle, cargo, etc.
  packageManagers: z.array(z.string()), // npm, yarn, pnpm, pip, etc.
  runtimeVersions: z.record(z.string(), z.string()), // e.g., { node: "18.x" }
  monorepo: z.boolean(),               // detected monorepo structure
  monorepoTool: z.string().optional(), // turborepo, nx, lerna, etc.
});
```

#### ArchitectureAnalysis
Maps the architectural structure of the codebase.

```typescript
// Architectural layer types
ArchitecturalLayerSchema = z.enum([
  'presentation',  // UI, views, components
  'application',   // Use cases, application services
  'domain',        // Business logic, entities
  'infrastructure', // External services, DB, APIs
  'shared',        // Utilities, common code
]);

ComponentInfoSchema = z.object({
  name: z.string(),
  path: z.string(),                    // relative path
  type: z.enum(['module', 'package', 'service', 'library', 'component']),
  layer: ArchitecturalLayerSchema.optional(),
  entryPoints: z.array(z.string()),    // main exports/entry files
  description: z.string().optional(),  // inferred description
});

DependencyInfoSchema = z.object({
  from: z.string(),                    // component name
  to: z.string(),                      // component name
  type: z.enum(['imports', 'extends', 'implements', 'uses']),
  count: z.number().int().min(1),      // number of references
});

ArchitecturePatternSchema = z.enum([
  'monolith',
  'microservices',
  'modular-monolith',
  'layered',
  'hexagonal',
  'clean-architecture',
  'mvc',
  'mvvm',
  'event-driven',
  'unknown',
]);

ArchitectureAnalysisSchema = z.object({
  pattern: ArchitecturePatternSchema,
  confidence: z.number().min(0).max(1), // confidence in pattern detection
  components: z.array(ComponentInfoSchema),
  layers: z.array(z.object({
    name: ArchitecturalLayerSchema,
    paths: z.array(z.string()),
    componentCount: z.number().int().min(0),
  })),
  dependencies: z.array(DependencyInfoSchema),
  entryPoints: z.array(z.string()),    // main entry points (index, main, etc.)
  boundaries: z.array(z.object({       // module boundaries
    name: z.string(),
    publicApi: z.array(z.string()),    // public exports
    internalModules: z.array(z.string()),
  })).optional(),
});
```

#### ConventionAnalysis
Detects coding patterns and style conventions.

```typescript
NamingConventionStyleSchema = z.enum([
  'camelCase',
  'PascalCase',
  'snake_case',
  'kebab-case',
  'SCREAMING_SNAKE_CASE',
  'mixed',
]);

NamingConventionSchema = z.object({
  files: NamingConventionStyleSchema,
  directories: NamingConventionStyleSchema,
  variables: NamingConventionStyleSchema,
  functions: NamingConventionStyleSchema,
  classes: NamingConventionStyleSchema,
  constants: NamingConventionStyleSchema,
  interfaces: z.object({
    style: NamingConventionStyleSchema,
    prefix: z.string().optional(),     // e.g., "I" for IUserService
  }).optional(),
  types: z.object({
    style: NamingConventionStyleSchema,
    suffix: z.string().optional(),     // e.g., "Type" for UserType
  }).optional(),
});

FileOrganizationSchema = z.object({
  style: z.enum(['flat', 'nested', 'feature-based', 'type-based', 'hybrid']),
  srcDirectory: z.string().optional(), // main source directory
  testLocation: z.enum(['colocated', 'separate', 'both']),
  testDirectory: z.string().optional(),
  testFileSuffix: z.string().optional(), // .test.ts, .spec.ts, _test.go
  configLocation: z.enum(['root', 'config-dir', 'distributed']),
});

CodeStyleSchema = z.object({
  indentation: z.enum(['tabs', 'spaces-2', 'spaces-4']),
  quotes: z.enum(['single', 'double', 'mixed']),
  semicolons: z.enum(['always', 'never', 'mixed']),
  trailingCommas: z.enum(['all', 'es5', 'none', 'mixed']),
  maxLineLength: z.number().int().min(0).optional(),
  importStyle: z.enum(['named', 'default', 'mixed']),
  exportStyle: z.enum(['named', 'default', 'barrel', 'mixed']),
  asyncStyle: z.enum(['async-await', 'promises', 'callbacks', 'mixed']),
});

ConventionAnalysisSchema = z.object({
  naming: NamingConventionSchema,
  fileOrganization: FileOrganizationSchema,
  codeStyle: CodeStyleSchema,
  documentationStyle: z.enum(['jsdoc', 'tsdoc', 'docstrings', 'comments', 'minimal', 'none']),
  errorHandling: z.enum(['try-catch', 'result-types', 'error-callbacks', 'mixed']),
  configFormat: z.enum(['json', 'yaml', 'toml', 'env', 'js', 'mixed']),
  patterns: z.array(z.object({        // detected design patterns
    name: z.string(),                  // e.g., "Repository Pattern"
    locations: z.array(z.string()),    // file paths where used
    confidence: z.number().min(0).max(1),
  })).optional(),
});
```

#### TechnicalDebtAnalysis
Categorizes and prioritizes technical debt.

```typescript
TechnicalDebtCategorySchema = z.enum([
  'code-smell',        // Poor code quality
  'complexity',        // High cyclomatic/cognitive complexity
  'duplication',       // Code duplication
  'outdated-deps',     // Outdated dependencies
  'security',          // Security vulnerabilities
  'test-coverage',     // Missing tests
  'documentation',     // Missing/outdated docs
  'architecture',      // Architectural issues
  'performance',       // Performance issues
  'accessibility',     // Accessibility issues
  'maintainability',   // Hard to maintain code
  'deprecated',        // Using deprecated APIs
]);

TechnicalDebtSeveritySchema = z.enum([
  'critical',   // Must fix immediately
  'high',       // Should fix soon
  'medium',     // Should fix when possible
  'low',        // Nice to fix
  'info',       // Informational only
]);

TechnicalDebtItemSchema = z.object({
  id: z.string(),                      // Unique identifier
  category: TechnicalDebtCategorySchema,
  severity: TechnicalDebtSeveritySchema,
  title: z.string(),                   // Short description
  description: z.string(),             // Detailed description
  location: z.object({
    file: z.string(),
    startLine: z.number().int().min(1).optional(),
    endLine: z.number().int().min(1).optional(),
  }).optional(),
  effort: z.enum(['trivial', 'minor', 'moderate', 'major', 'epic']),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  tags: z.array(z.string()).optional(),
  suggestedFix: z.string().optional(),
  relatedItems: z.array(z.string()).optional(), // IDs of related debt items
  detectedAt: z.date().optional(),
  source: z.string().optional(),       // Tool that detected it
});

TechnicalDebtAnalysisSchema = z.object({
  items: z.array(TechnicalDebtItemSchema),
  summary: z.object({
    totalItems: z.number().int().min(0),
    bySeverity: z.record(TechnicalDebtSeveritySchema, z.number().int().min(0)),
    byCategory: z.record(TechnicalDebtCategorySchema, z.number().int().min(0)),
    estimatedEffort: z.object({       // Total estimated effort
      trivial: z.number().int().min(0),
      minor: z.number().int().min(0),
      moderate: z.number().int().min(0),
      major: z.number().int().min(0),
      epic: z.number().int().min(0),
    }),
  }),
  healthScore: z.number().min(0).max(100), // Overall codebase health
  trends: z.object({                   // Optional trend data
    improving: z.boolean(),
    changeFromLastAnalysis: z.number().optional(),
  }).optional(),
});
```

#### CodebaseAnalysis (Main Output)
Combines all analysis results into a comprehensive output.

```typescript
CodebaseAnalysisSchema = z.object({
  // Metadata
  projectPath: z.string(),
  analyzedAt: z.date(),
  version: z.string().default('1.0.0'), // Schema version

  // Core analyses
  stack: StackAnalysisSchema,
  architecture: ArchitectureAnalysisSchema,
  conventions: ConventionAnalysisSchema,
  technicalDebt: TechnicalDebtAnalysisSchema,

  // Summary metrics
  metrics: z.object({
    totalFiles: z.number().int().min(0),
    totalLines: z.number().int().min(0),
    totalComponents: z.number().int().min(0),
    healthScore: z.number().min(0).max(100),
  }),

  // Analysis configuration used
  config: z.object({
    excludedPaths: z.array(z.string()),
    maxDepth: z.number().int().min(1),
    analyzedLanguages: z.array(z.string()),
  }).optional(),

  // Any errors during analysis
  errors: z.array(z.object({
    phase: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
  })).optional(),
});
```

### 4. Implementation Location

Add schemas to `packages/core/src/types.ts` in a new section:

```typescript
// ============================================================================
// Codebase Analysis Types (v0.6.0)
// ============================================================================
```

### 5. Export Strategy

All schemas and types will be exported from `types.ts` and re-exported through `index.ts`:
- `LanguageInfoSchema`, `LanguageInfo`
- `StackAnalysisSchema`, `StackAnalysis`
- `ArchitecturalLayerSchema`, `ArchitecturalLayer`
- `ComponentInfoSchema`, `ComponentInfo`
- `DependencyInfoSchema`, `DependencyInfo`
- `ArchitecturePatternSchema`, `ArchitecturePattern`
- `ArchitectureAnalysisSchema`, `ArchitectureAnalysis`
- `NamingConventionStyleSchema`, `NamingConventionStyle`
- `NamingConventionSchema`, `NamingConvention`
- `FileOrganizationSchema`, `FileOrganization`
- `CodeStyleSchema`, `CodeStyle`
- `ConventionAnalysisSchema`, `ConventionAnalysis`
- `TechnicalDebtCategorySchema`, `TechnicalDebtCategory`
- `TechnicalDebtSeveritySchema`, `TechnicalDebtSeverity`
- `TechnicalDebtItemSchema`, `TechnicalDebtItem`
- `TechnicalDebtAnalysisSchema`, `TechnicalDebtAnalysis`
- `CodebaseAnalysisSchema`, `CodebaseAnalysis`

## Testing Strategy

Tests should validate:
1. Schema constraint enforcement (min/max values, enums, required fields)
2. Optional field handling
3. Default value application
4. Type inference correctness
5. Schema composition (nested objects)
6. Discriminated unions work correctly
7. Cross-schema references (reusing FrameworkInfoSchema)

Test file: `packages/core/src/__tests__/codebase-analysis-types.test.ts`

## Consequences

### Positive
- Comprehensive type safety for codebase analysis
- Reuses existing patterns for consistency
- Extensible design allows future enhancements
- Clear categorization enables intelligent task planning
- Health scores enable progress tracking

### Negative
- Large number of new types adds to bundle size
- Complex nested structures may require careful validation
- Some fields may need refinement based on real-world usage

## Implementation Notes for Developer

1. Add schemas after the existing `// Test Analysis Types (v0.4.0)` section
2. Follow the JSDoc documentation pattern used in existing schemas
3. Ensure all enums have clear comments explaining each value
4. Use `.optional()` and `.default()` appropriately for optional fields
5. Add `.strict()` to object schemas where appropriate to catch extra fields
6. Write comprehensive tests covering edge cases
7. Verify build and test pass before marking complete
