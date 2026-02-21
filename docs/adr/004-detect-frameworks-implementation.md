# ADR-004: detectFrameworks() Implementation

## Status

Accepted

## Context

The APEX platform requires a method to detect frameworks and technologies used in a project to provide context for AI agents. The `ProjectContextAnalyzer` class in `packages/core/src/project-context-analyzer.ts` has a `detectFrameworks()` method that needs to reliably detect major frameworks with confidence scores.

### Requirements from Acceptance Criteria

The `detectFrameworks()` method must:
1. **Detect major frameworks**: React, Vue, Angular, Next.js, Express, Fastify, NestJS, Django, Flask, FastAPI, Rails, Spring Boot
2. **Return confidence scores**: high, medium, low based on detection method reliability
3. **Achieve >80% test coverage**: Unit tests must pass with comprehensive coverage

### Current State Analysis

The existing implementation provides a solid foundation with three detection strategies:

1. **Package.json Analysis** (`analyzePackageJson`)
   - Detects JavaScript/TypeScript frameworks via dependencies
   - Returns `high` confidence when explicitly declared
   - Already supports: React, Vue, Angular, Next.js, Express, Fastify, NestJS, Django*, FastAPI*, Flask*

2. **Configuration File Detection** (`detectConfigBasedFrameworks`)
   - Detects frameworks by presence of config files
   - Returns `medium` confidence
   - Examples: `next.config.js`, `angular.json`, `vue.config.js`

3. **Pattern-Based Detection** (`detectPatternBasedFrameworks`)
   - Detects frameworks by file patterns and directory structures
   - Returns `low` to `high` confidence based on pattern specificity
   - Currently supports: Django, Ruby on Rails via directory patterns

*Note: Django, FastAPI, Flask are in the package.json rules but need enhancement for Python projects without package.json.

## Decision

### 1. Detection Strategy Architecture

The architecture follows a multi-layered detection approach with confidence scoring:

```
detectFrameworks()
├── detectPackageManager() → npm/yarn/pnpm/pip/poetry/bundler
├── analyzePackageJson(path) → Node.js frameworks (high confidence)
├── analyzePythonDependencies() → Python frameworks from requirements.txt/Pipfile
├── analyzeGemfile() → Ruby frameworks from Gemfile
├── analyzeJavaDependencies() → Java/Spring Boot from pom.xml/build.gradle
├── detectConfigBasedFrameworks() → Config file presence (medium confidence)
├── detectPatternBasedFrameworks() → Directory/file patterns (low-high confidence)
├── deduplicateFrameworks() → Merge duplicates, prefer higher confidence
└── setPrimaryFramework() → Highest confidence framework as primary
```

### 2. Framework Detection Rules

#### Required Frameworks (Acceptance Criteria)

| Framework | Category | Detection Method | Confidence | Key Indicators |
|-----------|----------|------------------|------------|----------------|
| **React** | frontend | package.json | high | `react` dependency |
| **Vue** | frontend | package.json | high | `vue` dependency |
| **Angular** | frontend | package.json/config | high | `@angular/core` or `angular.json` |
| **Next.js** | fullstack | package.json/config | high | `next` dependency or `next.config.*` |
| **Express** | backend | package.json | high | `express` dependency |
| **Fastify** | backend | package.json | high | `fastify` dependency |
| **NestJS** | backend | package.json | high | `@nestjs/core` dependency |
| **Django** | backend | requirements.txt/patterns | high | `django` in deps or `manage.py` |
| **Flask** | backend | requirements.txt | high | `flask` in requirements.txt |
| **FastAPI** | backend | requirements.txt | high | `fastapi` in requirements.txt |
| **Rails** | backend | Gemfile/patterns | high | `rails` gem or Rails directory structure |
| **Spring Boot** | backend | pom.xml/gradle | high | `spring-boot-starter` dependency |

### 3. Confidence Score System

```typescript
type DetectionConfidence = 'high' | 'medium' | 'low';

// Confidence mapping:
// high   (3): Explicit declaration in manifest (package.json, requirements.txt, Gemfile, pom.xml)
// medium (2): Configuration file presence (next.config.js, angular.json)
// low    (1): File pattern matching (*.jsx files, directory structure)
```

**Confidence Determination Rules:**
- `high`: Framework explicitly listed as a dependency in manifest file
- `medium`: Framework-specific configuration file exists
- `low`: Framework inferred from file extensions or directory patterns only

### 4. Python Framework Detection Enhancement

Since Python projects don't use package.json, add dedicated analysis:

```typescript
private async analyzePythonDependencies(): Promise<FrameworkInfo[]> {
  // Check requirements.txt
  // Check Pipfile
  // Check pyproject.toml (Poetry/PEP-517)
  // Detect: Django, Flask, FastAPI
}
```

**Detection Rules:**
```typescript
const pythonFrameworkRules = [
  { name: 'Django', packages: ['django', 'Django'], category: 'backend' },
  { name: 'Flask', packages: ['flask', 'Flask'], category: 'backend' },
  { name: 'FastAPI', packages: ['fastapi', 'FastAPI'], category: 'backend' },
];
```

### 5. Ruby Framework Detection Enhancement

```typescript
private async analyzeGemfile(): Promise<FrameworkInfo[]> {
  // Parse Gemfile for gem declarations
  // Detect: Ruby on Rails, Sinatra
}
```

**Detection Rules:**
```typescript
const rubyFrameworkRules = [
  { name: 'Ruby on Rails', packages: ['rails'], category: 'backend' },
  { name: 'Sinatra', packages: ['sinatra'], category: 'backend' },
];
```

### 6. Java/Spring Boot Detection

```typescript
private async analyzeJavaDependencies(): Promise<FrameworkInfo[]> {
  // Check pom.xml for Maven dependencies
  // Check build.gradle for Gradle dependencies
  // Detect: Spring Boot
}
```

**Detection Rules:**
```typescript
const javaFrameworkRules = [
  {
    name: 'Spring Boot',
    packages: ['spring-boot-starter', 'org.springframework.boot'],
    configFiles: ['application.properties', 'application.yml'],
    category: 'backend'
  },
];
```

### 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           detectFrameworks()                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐       │
│  │  Package Manager │   │  Manifest Files  │   │   Config Files    │       │
│  │   Detection      │   │     Analysis     │   │    Detection      │       │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘       │
│           │                      │                      │                  │
│           ▼                      ▼                      ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Framework Detection Pipeline                       │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │ │
│  │  │ Node.js     │  │  Python     │  │    Ruby     │  │    Java     │ │ │
│  │  │ (pkg.json)  │  │ (req.txt)   │  │  (Gemfile)  │  │  (pom.xml)  │ │ │
│  │  │   HIGH      │  │    HIGH     │  │    HIGH     │  │    HIGH     │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │              Config File Detection (MEDIUM)                     │ │ │
│  │  │  next.config.js, angular.json, vue.config.js, etc.             │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │           Pattern-Based Detection (LOW-HIGH)                    │ │ │
│  │  │  *.jsx, manage.py, Gemfile structure, app/controllers/*.rb    │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Deduplication & Ranking                            │ │
│  │  - Merge duplicate frameworks                                         │ │
│  │  - Prefer higher confidence                                           │ │
│  │  - Aggregate detection reasons                                        │ │
│  │  - Set primary framework                                              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    FrameworkDetection Result                          │ │
│  │  {                                                                    │ │
│  │    primary: FrameworkInfo,                                            │ │
│  │    frameworks: FrameworkInfo[],                                       │ │
│  │    languages: LanguageInfo[],                                         │ │
│  │    runtime: 'node' | 'browser' | 'python' | 'ruby' | 'jvm',          │ │
│  │    packageManager: string                                             │ │
│  │  }                                                                    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8. FrameworkInfo Schema

The existing `FrameworkInfoSchema` in `types.ts` already supports all required fields:

```typescript
export const FrameworkInfoSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  category: FrameworkCategorySchema,
  confidence: DetectionConfidenceSchema.optional().default('medium'),
  detectedVia: z.string().optional(),
  detectionReasons: z.array(z.string()).optional().default([]),
  language: z.string().optional(),
  configFiles: z.array(z.string()).optional().default([]),
  isDevDependency: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

### 9. Runtime Detection Enhancement

Map detected frameworks to runtime environments:

| Framework | Runtime |
|-----------|---------|
| Next.js, Express, Fastify, NestJS | `node` |
| React, Vue, Angular | `browser` |
| Django, Flask, FastAPI | `python` |
| Rails | `ruby` |
| Spring Boot | `jvm` |

### 10. Performance Considerations

1. **Parallel Manifest Analysis**: Run package.json, requirements.txt, Gemfile, pom.xml analysis in parallel
2. **Lazy Pattern Matching**: Only run expensive glob patterns if manifest analysis yields few results
3. **Caching**: Consider caching results for the same project path
4. **Depth Limiting**: Use `options.maxDepth` for pattern-based detection

```typescript
async detectFrameworks(): Promise<FrameworkDetection> {
  // Run all manifest analyses in parallel
  const [nodeFrameworks, pythonFrameworks, rubyFrameworks, javaFrameworks] =
    await Promise.all([
      this.analyzePackageJson(packageJsonPath),
      this.analyzePythonDependencies(),
      this.analyzeGemfile(),
      this.analyzeJavaDependencies(),
    ]);

  // Continue with config and pattern detection...
}
```

### 11. Test Coverage Strategy

To achieve >80% test coverage:

1. **Unit Tests per Framework** (12 required frameworks × 2-3 test scenarios = ~30 tests)
   - React, Vue, Angular, Next.js
   - Express, Fastify, NestJS
   - Django, Flask, FastAPI
   - Rails
   - Spring Boot

2. **Detection Method Tests**
   - `analyzePackageJson()` edge cases
   - `analyzePythonDependencies()` parsing
   - `analyzeGemfile()` parsing
   - `analyzeJavaDependencies()` parsing
   - `detectConfigBasedFrameworks()` scenarios
   - `detectPatternBasedFrameworks()` scenarios

3. **Integration Tests**
   - Multi-framework project detection
   - Monorepo with mixed technologies
   - Confidence score aggregation

4. **Edge Case Tests**
   - Empty project
   - Malformed manifest files
   - Missing dependencies
   - Conflicting detection signals

## Implementation Files

| File | Purpose |
|------|---------|
| `packages/core/src/project-context-analyzer.ts` | Main implementation |
| `packages/core/src/types.ts` | Type definitions (already complete) |
| `packages/core/src/__tests__/detect-frameworks-comprehensive.test.ts` | Comprehensive test suite |
| `packages/core/src/__tests__/detect-frameworks-edge-cases.test.ts` | Edge case tests |

## Alternatives Considered

### 1. External Detection Library
Could use libraries like `linguist` or `detect-installed` but adds dependencies and may not cover all required frameworks.

**Decision**: Build custom detection for full control over confidence scoring.

### 2. AST-Based Detection
Parse actual source files to detect framework usage patterns (import statements, decorators).

**Decision**: Too expensive for initial implementation. Pattern-based detection is sufficient for MVP. Can add AST analysis as enhancement.

### 3. Single Detection Pass
Combine all detection logic into one method.

**Decision**: Separate methods for testability and maintainability. Each detection strategy can be tested and extended independently.

## Consequences

### Positive
- Clear confidence scoring enables AI agents to weight framework context appropriately
- Multi-language support (Node.js, Python, Ruby, Java) covers most common stacks
- Extensible architecture for adding new frameworks
- High test coverage ensures reliability

### Negative
- Requires maintaining detection rules as frameworks evolve
- Pattern-based detection may have false positives
- No AST-level verification (could add later)

## Related ADRs

- ADR-003: analyzeProjectStructure() Implementation
- Types defined in `packages/core/src/types.ts` (FrameworkInfoSchema, FrameworkDetectionSchema)
