# ADR-061: README Section Completeness Analyzer

## Status

Proposed

## Date

2025-01-06

## Context

The APEX project needs to implement README section completeness analysis to help maintain high-quality documentation. The feature should analyze README.md files for standard sections (Installation, Usage, API, Contributing, License) and report which are missing. The analysis should be configurable for project-specific required sections.

### Current State Analysis

The codebase already has substantial infrastructure for documentation analysis:

1. **Type definitions** in `packages/core/src/types.ts`:
   - `ReadmeSection` type with standard sections (title, description, installation, usage, api, examples, contributing, license, changelog, troubleshooting, faq, dependencies, testing, deployment)
   - `MissingReadmeSection` interface with section, priority, and description fields
   - `EnhancedDocumentationAnalysis` interface which includes `missingReadmeSections` array

2. **Existing README analysis** in `packages/orchestrator/src/idle-processor.ts`:
   - `findMissingReadmeSections()` method that performs basic README section detection
   - Event emission for `detector:missing-readme-section:found`
   - Integration with `EnhancedDocumentationAnalysis`

3. **Docs Analyzer** in `packages/orchestrator/src/analyzers/docs-analyzer.ts`:
   - `DocsAnalyzer` class that generates task candidates for documentation improvements
   - Integrates with `missingReadmeSections` from project analysis

4. **Configuration system** in `packages/core/src/types.ts`:
   - `DocumentationAnalysisConfigSchema` which can be extended
   - `OutdatedDocsConfigSchema` for related documentation detection

## Decision

### Architecture Overview

We will enhance the existing README section detection with a dedicated, configurable `ReadmeSectionAnalyzer` class that provides:

1. **Configurable section requirements** per project type
2. **Pattern-based section detection** with multiple indicators per section
3. **Severity-based prioritization** (required, recommended, optional)
4. **Integration with existing idle processing and documentation analysis**

### Component Design

#### 1. Configuration Schema Extension

```typescript
// In packages/core/src/types.ts

/**
 * Configuration for a single README section requirement
 */
export interface ReadmeSectionRequirement {
  /** The section type */
  section: ReadmeSection;
  /** Patterns/keywords that indicate this section is present */
  indicators: string[];
  /** Priority of this section */
  priority: 'required' | 'recommended' | 'optional';
  /** Human-readable description of what this section should contain */
  description: string;
}

/**
 * Configuration for README section analysis
 */
export const ReadmeSectionAnalysisConfigSchema = z.object({
  /** Enable README section analysis */
  enabled: z.boolean().optional().default(true),

  /** Project type preset: 'library', 'application', 'cli', 'api', 'custom' */
  projectType: z.enum(['library', 'application', 'cli', 'api', 'custom']).optional().default('library'),

  /** Custom section requirements (overrides preset) */
  customSections: z.array(z.object({
    section: z.string(),
    indicators: z.array(z.string()),
    priority: z.enum(['required', 'recommended', 'optional']),
    description: z.string()
  })).optional(),

  /** Additional sections to require beyond the preset */
  additionalRequiredSections: z.array(z.string()).optional(),

  /** Sections to exclude from analysis */
  excludeSections: z.array(z.string()).optional(),

  /** Case-insensitive matching (default: true) */
  caseInsensitive: z.boolean().optional().default(true)
});

export type ReadmeSectionAnalysisConfig = z.infer<typeof ReadmeSectionAnalysisConfigSchema>;
```

#### 2. ReadmeSectionAnalyzer Class

Location: `packages/orchestrator/src/analyzers/readme-section-analyzer.ts`

```typescript
/**
 * Analyzes README files for section completeness
 *
 * Features:
 * - Configurable section requirements per project type
 * - Pattern-based detection with multiple indicators
 * - Priority-based severity classification
 * - Integration with EnhancedDocumentationAnalysis
 */
export class ReadmeSectionAnalyzer {
  private config: ReadmeSectionAnalysisConfig;
  private sectionRequirements: ReadmeSectionRequirement[];

  constructor(config?: Partial<ReadmeSectionAnalysisConfig>) {
    this.config = this.mergeWithDefaults(config);
    this.sectionRequirements = this.buildSectionRequirements();
  }

  /**
   * Analyze a README file for missing sections
   */
  analyze(content: string): MissingReadmeSection[];

  /**
   * Analyze README from file path
   */
  analyzeFile(filePath: string): Promise<MissingReadmeSection[]>;

  /**
   * Get preset section requirements for a project type
   */
  static getPresetForProjectType(type: string): ReadmeSectionRequirement[];

  /**
   * Check if a section is present in content
   */
  private hasSection(content: string, requirement: ReadmeSectionRequirement): boolean;
}
```

#### 3. Project Type Presets

```typescript
const SECTION_PRESETS: Record<string, ReadmeSectionRequirement[]> = {
  library: [
    { section: 'title', indicators: ['#'], priority: 'required', description: 'Project title' },
    { section: 'description', indicators: ['##\\s*about', '##\\s*description', '##\\s*overview'], priority: 'required', description: 'Project description' },
    { section: 'installation', indicators: ['install', 'setup', 'getting started', 'npm install', 'yarn add'], priority: 'required', description: 'Installation instructions' },
    { section: 'usage', indicators: ['usage', 'how to use', 'example', 'quick start'], priority: 'required', description: 'Usage examples' },
    { section: 'api', indicators: ['api', 'reference', 'methods', 'functions', 'interface'], priority: 'recommended', description: 'API documentation' },
    { section: 'contributing', indicators: ['contribut', 'develop', 'pull request'], priority: 'recommended', description: 'Contribution guidelines' },
    { section: 'license', indicators: ['license', 'mit', 'apache', 'copyright'], priority: 'recommended', description: 'License information' }
  ],

  application: [
    { section: 'title', indicators: ['#'], priority: 'required', description: 'Application name' },
    { section: 'description', indicators: ['##\\s*about', '##\\s*description'], priority: 'required', description: 'Application description' },
    { section: 'installation', indicators: ['install', 'setup', 'requirements'], priority: 'required', description: 'Installation steps' },
    { section: 'usage', indicators: ['usage', 'running', 'how to'], priority: 'required', description: 'How to run the application' },
    { section: 'deployment', indicators: ['deploy', 'production', 'hosting'], priority: 'recommended', description: 'Deployment instructions' },
    { section: 'contributing', indicators: ['contribut'], priority: 'optional', description: 'Contribution guidelines' },
    { section: 'license', indicators: ['license'], priority: 'recommended', description: 'License information' }
  ],

  cli: [
    { section: 'title', indicators: ['#'], priority: 'required', description: 'CLI tool name' },
    { section: 'description', indicators: ['##\\s*about', '##\\s*description'], priority: 'required', description: 'Tool description' },
    { section: 'installation', indicators: ['install', 'npm install -g', 'brew install'], priority: 'required', description: 'Installation instructions' },
    { section: 'usage', indicators: ['usage', 'command', 'synopsis', 'options', 'flags'], priority: 'required', description: 'Command usage and options' },
    { section: 'examples', indicators: ['example', 'demo', 'tutorial'], priority: 'recommended', description: 'Usage examples' },
    { section: 'contributing', indicators: ['contribut'], priority: 'optional', description: 'Contribution guidelines' },
    { section: 'license', indicators: ['license'], priority: 'recommended', description: 'License information' }
  ],

  api: [
    { section: 'title', indicators: ['#'], priority: 'required', description: 'API name' },
    { section: 'description', indicators: ['##\\s*about', '##\\s*description', '##\\s*overview'], priority: 'required', description: 'API description' },
    { section: 'installation', indicators: ['install', 'setup', 'requirements'], priority: 'required', description: 'Setup instructions' },
    { section: 'api', indicators: ['endpoint', 'route', 'api reference', 'swagger', 'openapi'], priority: 'required', description: 'API endpoint documentation' },
    { section: 'usage', indicators: ['usage', 'authentication', 'getting started'], priority: 'required', description: 'API usage guide' },
    { section: 'examples', indicators: ['example', 'curl', 'request', 'response'], priority: 'recommended', description: 'Request/response examples' },
    { section: 'license', indicators: ['license'], priority: 'recommended', description: 'License information' }
  ]
};
```

### Integration Points

#### 1. IdleProcessor Enhancement

The existing `findMissingReadmeSections()` method in `idle-processor.ts` will be refactored to use the new `ReadmeSectionAnalyzer`:

```typescript
private async findMissingReadmeSections(): Promise<MissingReadmeSection[]> {
  const config = this.config.documentation?.readmeSections;
  const analyzer = new ReadmeSectionAnalyzer(config);

  // Find README files
  const readmeFiles = await this.findReadmeFiles();

  if (readmeFiles.length === 0) {
    // Return default required sections when no README exists
    return analyzer.getRequiredSectionsForMissingReadme();
  }

  // Analyze each README file
  const allMissingSections: MissingReadmeSection[] = [];
  for (const file of readmeFiles) {
    const missing = await analyzer.analyzeFile(file);
    allMissingSections.push(...missing);
  }

  return this.deduplicateMissingSections(allMissingSections);
}
```

#### 2. DocsAnalyzer Integration

The `DocsAnalyzer` already processes `missingReadmeSections` and can generate task candidates. We'll enhance it to leverage severity levels:

```typescript
// In docs-analyzer.ts, add method:
private processReadmeSectionGaps(
  missingReadmeSections: MissingReadmeSection[],
  candidates: TaskCandidate[]
): void {
  const requiredMissing = missingReadmeSections.filter(s => s.priority === 'required');
  const recommendedMissing = missingReadmeSections.filter(s => s.priority === 'recommended');

  if (requiredMissing.length > 0) {
    candidates.push(
      this.createCandidate(
        'missing-required-readme-sections',
        'Add Required README Sections',
        `Add ${requiredMissing.length} required section${requiredMissing.length === 1 ? '' : 's'}: ${requiredMissing.map(s => s.section).join(', ')}`,
        {
          priority: 'high',
          effort: 'medium',
          workflow: 'documentation',
          rationale: 'Required README sections are essential for project documentation',
          score: 0.85,
        }
      )
    );
  }

  if (recommendedMissing.length > 0) {
    candidates.push(
      this.createCandidate(
        'missing-recommended-readme-sections',
        'Add Recommended README Sections',
        `Consider adding ${recommendedMissing.length} recommended section${recommendedMissing.length === 1 ? '' : 's'}: ${recommendedMissing.map(s => s.section).join(', ')}`,
        {
          priority: 'normal',
          effort: 'low',
          workflow: 'documentation',
          rationale: 'Recommended README sections improve project documentation quality',
          score: 0.6,
        }
      )
    );
  }
}
```

#### 3. Configuration Integration

The `DocumentationAnalysisConfigSchema` in `types.ts` will be extended:

```typescript
export const DocumentationAnalysisConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  outdatedDocs: OutdatedDocsConfigSchema.optional(),
  jsdocAnalysis: z.object({
    enabled: z.boolean().optional().default(true),
    requirePublicExports: z.boolean().optional().default(true),
    checkReturnTypes: z.boolean().optional().default(true),
    checkParameterTypes: z.boolean().optional().default(true),
  }).optional(),
  // NEW: README section analysis configuration
  readmeSections: ReadmeSectionAnalysisConfigSchema.optional(),
});
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Configuration                                  │
│  .apex/config.yaml -> documentation.readmeSections                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ReadmeSectionAnalyzer                              │
│  - Loads configuration                                               │
│  - Applies project type preset                                       │
│  - Merges custom sections                                            │
│  - Performs pattern-based detection                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      IdleProcessor                                   │
│  - findMissingReadmeSections() uses ReadmeSectionAnalyzer           │
│  - Emits 'detector:missing-readme-section:found' events             │
│  - Populates EnhancedDocumentationAnalysis.missingReadmeSections    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DocsAnalyzer                                  │
│  - processReadmeSectionGaps() generates TaskCandidates              │
│  - Priority-based candidate scoring                                  │
│  - Workflow suggestions for documentation tasks                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      IdleTaskGenerator                               │
│  - Selects best documentation improvement task                       │
│  - Creates IdleTask for user review                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/types.ts` | Modify | Add `ReadmeSectionAnalysisConfigSchema` and `ReadmeSectionRequirement` |
| `packages/orchestrator/src/analyzers/readme-section-analyzer.ts` | New | Main analyzer class with pattern detection |
| `packages/orchestrator/src/analyzers/index.ts` | Modify | Export new analyzer |
| `packages/orchestrator/src/idle-processor.ts` | Modify | Use new analyzer in `findMissingReadmeSections()` |
| `packages/orchestrator/src/analyzers/docs-analyzer.ts` | Modify | Add `processReadmeSectionGaps()` method |
| `packages/orchestrator/src/analyzers/readme-section-analyzer.test.ts` | New | Unit tests |

## Consequences

### Positive

1. **Configurable per project**: Different project types have different documentation needs
2. **Extensible**: Custom sections can be added without code changes
3. **Priority-based**: Clear distinction between required and optional sections
4. **Pattern-based detection**: More robust than simple string matching
5. **Integration with existing infrastructure**: Leverages existing types and event system
6. **Backward compatible**: Default behavior matches current implementation

### Negative

1. **Additional configuration complexity**: Users need to understand project type presets
2. **Pattern maintenance**: Indicator patterns may need updates as documentation conventions evolve

### Risks

1. **False positives**: Patterns may match unintended content
2. **Performance**: Large README files with complex regex patterns could be slow

### Mitigations

1. Use efficient regex compilation and caching
2. Provide clear documentation for custom section configuration
3. Include comprehensive test coverage for edge cases

## Implementation Plan

### Phase 1: Core Infrastructure (Developer Stage)
1. Add configuration schema to `types.ts`
2. Create `ReadmeSectionAnalyzer` class
3. Implement preset section requirements
4. Add unit tests

### Phase 2: Integration (Developer Stage)
1. Refactor `findMissingReadmeSections()` in IdleProcessor
2. Enhance DocsAnalyzer with severity-based processing
3. Update analyzer exports
4. Add integration tests

### Phase 3: Testing (Tester Stage)
1. Validate configuration loading
2. Test project type presets
3. Test custom section configuration
4. Test edge cases (missing README, empty README, etc.)

## Alternatives Considered

### 1. AST-based Markdown Parsing
Use a Markdown AST parser to analyze document structure rather than regex patterns.

**Pros**: More accurate structure detection
**Cons**: Additional dependency, more complex implementation

**Decision**: Rejected - Regex patterns are sufficient and avoid dependency overhead

### 2. External README Linter Integration
Integrate with existing README linting tools like `remark-lint`.

**Pros**: Mature tooling, community support
**Cons**: External dependency, less control over APEX-specific requirements

**Decision**: Rejected - Custom implementation provides better integration with APEX workflow

### 3. Machine Learning Classification
Use ML to classify README sections based on content.

**Pros**: More intelligent content understanding
**Cons**: Significant complexity, training data requirements

**Decision**: Rejected - Over-engineered for the current requirements

## References

- [Existing types.ts documentation types](../packages/core/src/types.ts)
- [IdleProcessor implementation](../packages/orchestrator/src/idle-processor.ts)
- [DocsAnalyzer implementation](../packages/orchestrator/src/analyzers/docs-analyzer.ts)
- [ADR-060 JSDoc/TSDoc Detection](./ADR-060-jsdoc-tsdoc-detection.md)
