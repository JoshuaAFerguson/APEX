# ADR-0020: v0.6.0 Brownfield Codebase Analysis Architecture

**Status**: Accepted
**Date**: 2024-12-19
**Authors**: Architect Agent
**Context**: v0.6.0 Brownfield Codebase Analysis Feature Implementation

## Executive Summary

This ADR documents the technical architecture for implementing and fixing the v0.6.0 Brownfield Codebase Analysis features. The implementation addresses 7 core features that require completion to enable the `apex map-codebase` command to function correctly with parallel agent spawning and comprehensive analysis capabilities.

## Context

### Current State Analysis

The v0.6.0 Brownfield Codebase Analysis system has the following architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLI Layer (packages/cli)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  /map-codebase command → handleMapCodebase() → CodebaseIndexer              │
│  Options: --output-dir, --parallel, --output-format, --include-debt, etc.   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Orchestrator Layer (packages/orchestrator)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────┐ │
│  │    CodebaseMapper       │    │   CodebaseAnalysisOrchestrator          │ │
│  │  - Parallel agents      │───▶│   - Phase coordination                  │ │
│  │  - Progress tracking    │    │   - Error handling                      │ │
│  │  - Event emission       │    │   - Result aggregation                  │ │
│  └─────────────────────────┘    └─────────────────────────────────────────┘ │
│                                               │                              │
│                                               ▼                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Analysis Phases (enum)                           ││
│  │  ┌──────────────┐ ┌────────────────┐ ┌─────────────────┐                ││
│  │  │    STACK     │ │  ARCHITECTURE  │ │  CONVENTIONS ✓  │                ││
│  │  │ (unimpl)     │ │   (unimpl)     │ │  (implemented)  │                ││
│  │  └──────────────┘ └────────────────┘ └─────────────────┘                ││
│  │  ┌──────────────┐ ┌────────────────┐                                    ││
│  │  │TECHNICAL_DEBT│ │ DOCUMENTATION  │                                    ││
│  │  │ (unimpl)     │ │   (unimpl)     │                                    ││
│  │  └──────────────┘ └────────────────┘                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                   CodebaseIntelligence Module                           ││
│  │  - CodebaseIndexer (tree-sitter parsing)                                ││
│  │  - Symbol resolution                                                     ││
│  │  - Import graph analysis                                                 ││
│  │  - Type awareness                                                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Core Layer (packages/core)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  - Type definitions (Zod schemas)                                            │
│  - npm-registry-utils (queryNpmRegistry)                                     │
│  - doctor-utils                                                              │
│  - Common utilities                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Identified Issues

| # | Feature | Status | Root Cause |
|---|---------|--------|------------|
| 1 | `apex map-codebase` parallel agent spawning | FAILING | Only CONVENTIONS phase implemented; CodebaseMapper initializes agents but orchestrator only runs 1 phase |
| 2 | Stack documentation | NOT IMPL | Missing StackAnalyzer; needs npm registry integration |
| 3 | Architecture documentation | NOT IMPL | Missing ArchitectureAnalyzer; needs import graph analysis |
| 4 | Coding convention extraction | WORKING | ConventionAnalyzer fully implemented |
| 5 | Testing patterns | NOT IMPL | Missing TestingPatternAnalyzer |
| 6 | Third-party integration mapping | NOT IMPL | Missing IntegrationAnalyzer; npm audit fallback broken |
| 7 | Technical debt identification | NOT IMPL | Missing TechnicalDebtAnalyzer |

### Key Existing Infrastructure

1. **Schemas defined in @apexcli/core** (packages/core/src/types.ts):
   - `StackAnalysisSchema` (lines 11080-11133)
   - `ArchitectureAnalysisSchema` (lines 11135-11190)
   - `ConventionAnalysisSchema` (lines 11192-11269)
   - `TechnicalDebtAnalysisSchema` (lines 11271-11338)
   - `CodebaseAnalysisSchema` (lines 11340-11401) - main output type

2. **npm-registry-utils** (packages/core/src/npm-registry-utils.ts):
   - `checkPackageVersion()` - version comparison with caching
   - Uses `queryNpmRegistry()` from doctor-utils

3. **ConventionAnalyzer** (reference implementation):
   - Full implementation at packages/orchestrator/src/codebase-analyzer/analyzers/convention-analyzer.ts
   - Pattern: implements `CodebaseAnalyzer<ConventionAnalysis>`
   - Uses regex patterns + file walking

## Decision

### 1. Implement Missing Analyzers

Create 5 new analyzers following the ConventionAnalyzer pattern:

```typescript
// packages/orchestrator/src/codebase-analyzer/analyzers/

stack-analyzer.ts        → implements CodebaseAnalyzer<StackAnalysis>
architecture-analyzer.ts → implements CodebaseAnalyzer<ArchitectureAnalysis>
testing-analyzer.ts      → implements CodebaseAnalyzer<TestingPatternAnalysis>
integration-analyzer.ts  → implements CodebaseAnalyzer<IntegrationAnalysis>
debt-analyzer.ts         → implements CodebaseAnalyzer<TechnicalDebtAnalysis>
```

### 2. Extend Orchestrator to Support All Phases

**File**: `packages/orchestrator/src/codebase-analyzer/orchestrator.ts`

```typescript
// Current (line 87-96):
getSupportedPhases(): AnalysisPhase[] {
  return [
    AnalysisPhase.CONVENTIONS,
    // TODO: Enable these as they are implemented
  ];
}

// Target:
getSupportedPhases(): AnalysisPhase[] {
  return [
    AnalysisPhase.STACK,
    AnalysisPhase.ARCHITECTURE,
    AnalysisPhase.CONVENTIONS,
    AnalysisPhase.TECHNICAL_DEBT,
    AnalysisPhase.DOCUMENTATION, // For testing patterns
  ];
}
```

### 3. Add Missing Analysis Phases to Types

**File**: `packages/orchestrator/src/codebase-analyzer/types.ts`

```typescript
// Extend AnalysisPhase enum:
export enum AnalysisPhase {
  STACK = 'stack',
  ARCHITECTURE = 'architecture',
  CONVENTIONS = 'conventions',
  TECHNICAL_DEBT = 'technical-debt',
  DOCUMENTATION = 'documentation',
  // NEW PHASES:
  TESTING_PATTERNS = 'testing-patterns',      // For testing pattern analysis
  INTEGRATIONS = 'integrations',               // For third-party mapping
}
```

### 4. Create New Schema Types (if missing)

**File**: `packages/core/src/types.ts`

Add missing schemas if not present:
- `TestingPatternAnalysisSchema`
- `IntegrationMappingSchema`

### 5. Fix npm Integration

**File**: `packages/orchestrator/src/idle-processor.ts`

Replace fallback npm audit with proper npm registry queries:

```typescript
// Instead of:
const { stdout } = await this.execAsync('npm audit --json 2>/dev/null || echo "{}"');

// Use:
import { queryNpmRegistry } from '@apexcli/core';

async analyzePackageVersions(dependencies: Record<string, string>): Promise<OutdatedDependency[]> {
  const results: OutdatedDependency[] = [];

  for (const [name, version] of Object.entries(dependencies)) {
    try {
      const npmInfo = await queryNpmRegistry(name);
      if (npmInfo && !npmInfo.error) {
        const isOutdated = compareVersions(version, npmInfo.latestVersion) < 0;
        if (isOutdated) {
          results.push({
            name,
            currentVersion: version,
            latestVersion: npmInfo.latestVersion,
            type: 'dependency'
          });
        }
      }
    } catch (error) {
      // Continue on individual package failures
    }
  }

  return results;
}
```

## Technical Design

### 1. Stack Analyzer Design

```typescript
// packages/orchestrator/src/codebase-analyzer/analyzers/stack-analyzer.ts

import { promises as fs } from 'fs';
import { join } from 'path';
import type { StackAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';
import { queryNpmRegistry } from '@apexcli/core';

export class StackAnalyzer implements CodebaseAnalyzer<StackAnalysis> {
  async analyze(projectPath: string): Promise<StackAnalysis> {
    // 1. Detect languages from file extensions
    const languages = await this.detectLanguages(projectPath);

    // 2. Parse package.json for frameworks
    const frameworks = await this.detectFrameworks(projectPath);

    // 3. Detect build tools from config files
    const buildTools = await this.detectBuildTools(projectPath);

    // 4. Detect runtime from package.json engines or config
    const runtimes = await this.detectRuntimes(projectPath);

    // 5. Detect package managers
    const packageManagers = this.detectPackageManagers(projectPath);

    return {
      primaryLanguage: languages[0]?.name || 'Unknown',
      languages,
      frameworks,
      buildTools,
      runtimes,
      packageManagers,
    };
  }

  private async detectFrameworks(projectPath: string): Promise<StackAnalysis['frameworks']> {
    const packageJsonPath = join(projectPath, 'package.json');
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    const frameworkPatterns = [
      { pattern: /^react$/, name: 'React', category: 'frontend' },
      { pattern: /^next$/, name: 'Next.js', category: 'fullstack' },
      { pattern: /^vue$/, name: 'Vue', category: 'frontend' },
      { pattern: /^express$/, name: 'Express', category: 'backend' },
      { pattern: /^fastify$/, name: 'Fastify', category: 'backend' },
      { pattern: /^@nestjs\/core$/, name: 'NestJS', category: 'backend' },
      // ... more patterns
    ];

    const detected: StackAnalysis['frameworks'] = [];

    for (const [depName, version] of Object.entries(allDeps)) {
      for (const fw of frameworkPatterns) {
        if (fw.pattern.test(depName)) {
          detected.push({
            name: fw.name,
            version: String(version).replace(/^[\^~]/, ''),
            category: fw.category as any,
          });
        }
      }
    }

    return detected;
  }

  // ... other detection methods
}
```

### 2. Architecture Analyzer Design

```typescript
// packages/orchestrator/src/codebase-analyzer/analyzers/architecture-analyzer.ts

import type { ArchitectureAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';
import { CodebaseIndexer } from '../../codebase-intelligence/indexer.js';

export class ArchitectureAnalyzer implements CodebaseAnalyzer<ArchitectureAnalysis> {
  async analyze(projectPath: string): Promise<ArchitectureAnalysis> {
    const indexer = CodebaseIndexer.getInstance();

    // 1. Index the codebase for symbol information
    const repositoryMap = await indexer.indexDirectory(projectPath);

    // 2. Detect architectural pattern from directory structure
    const pattern = await this.detectArchitecturalPattern(projectPath, repositoryMap);

    // 3. Identify components from indexed symbols
    const components = this.identifyComponents(repositoryMap);

    // 4. Identify architectural layers
    const layers = this.identifyLayers(projectPath, repositoryMap);

    // 5. Analyze dependencies
    const dependencies = await this.analyzeDependencies(projectPath, repositoryMap);

    // 6. Find entry points
    const entryPoints = this.findEntryPoints(projectPath, repositoryMap);

    return {
      pattern,
      components,
      layers,
      dependencies,
      entryPoints,
    };
  }

  private async detectArchitecturalPattern(projectPath: string, repoMap: any): Promise<ArchitectureAnalysis['pattern']> {
    // Check for common patterns:
    // - monorepo (packages/, apps/, libs/)
    // - layered (controllers/, services/, models/)
    // - mvc (models/, views/, controllers/)
    // - component-based (components/, hooks/, pages/)
    // - hexagonal (domain/, adapters/, ports/)

    const dirPatterns = {
      'microservices': /packages\/|apps\/|services\//,
      'layered': /controllers\/|services\/|repositories\//,
      'mvc': /models\/|views\/|controllers\//,
      'component-based': /components\/|hooks\/|pages\//,
      'hexagonal': /domain\/|adapters\/|ports\//,
      'onion': /core\/|infrastructure\/|application\//,
      'clean': /entities\/|use-cases\/|interfaces\//,
    };

    // Analyze directory structure and return best match
    // ...
  }
}
```

### 3. Testing Pattern Analyzer Design

```typescript
// packages/orchestrator/src/codebase-analyzer/analyzers/testing-analyzer.ts

export interface TestingPatternAnalysis {
  framework: string;
  testCount: number;
  coveragePercent?: number;
  patterns: {
    unitTests: { count: number; locations: string[] };
    integrationTests: { count: number; locations: string[] };
    e2eTests: { count: number; locations: string[] };
  };
  conventions: {
    testFileNaming: string; // e.g., "*.test.ts", "*.spec.ts"
    testLocation: string;   // e.g., "__tests__", "colocated"
  };
  antiPatterns: TestingAntiPattern[];
  recommendations: string[];
}

export class TestingPatternAnalyzer implements CodebaseAnalyzer<TestingPatternAnalysis> {
  async analyze(projectPath: string): Promise<TestingPatternAnalysis> {
    // 1. Detect test framework from package.json
    const framework = await this.detectTestFramework(projectPath);

    // 2. Find all test files
    const testFiles = await this.findTestFiles(projectPath);

    // 3. Categorize tests (unit, integration, e2e)
    const patterns = await this.categorizeTests(testFiles);

    // 4. Extract test conventions
    const conventions = this.extractTestConventions(testFiles);

    // 5. Detect anti-patterns
    const antiPatterns = await this.detectAntiPatterns(testFiles);

    // 6. Generate recommendations
    const recommendations = this.generateRecommendations(patterns, antiPatterns);

    return {
      framework,
      testCount: testFiles.length,
      patterns,
      conventions,
      antiPatterns,
      recommendations,
    };
  }
}
```

### 4. Integration Analyzer Design

```typescript
// packages/orchestrator/src/codebase-analyzer/analyzers/integration-analyzer.ts

export interface IntegrationAnalysis {
  dependencies: {
    production: PackageInfo[];
    development: PackageInfo[];
    outdated: OutdatedDependency[];
    security: SecurityVulnerability[];
  };
  apis: {
    consumed: ExternalAPI[];  // APIs this project calls
    exposed: ExposedEndpoint[]; // APIs this project exposes
  };
  services: {
    databases: string[];
    caches: string[];
    queues: string[];
    cloud: string[];
  };
}

export class IntegrationAnalyzer implements CodebaseAnalyzer<IntegrationAnalysis> {
  async analyze(projectPath: string): Promise<IntegrationAnalysis> {
    // 1. Parse package.json dependencies
    const dependencies = await this.analyzeDependencies(projectPath);

    // 2. Check for outdated packages using npm registry
    const outdated = await this.checkOutdatedPackages(dependencies);

    // 3. Check for security vulnerabilities (using local patterns, not npm audit)
    const security = await this.checkSecurityIssues(dependencies);

    // 4. Detect consumed APIs (fetch calls, axios, etc.)
    const consumedApis = await this.detectConsumedApis(projectPath);

    // 5. Detect exposed endpoints (express routes, etc.)
    const exposedApis = await this.detectExposedEndpoints(projectPath);

    // 6. Detect service integrations (databases, caches, etc.)
    const services = await this.detectServiceIntegrations(projectPath);

    return {
      dependencies: {
        production: dependencies.production,
        development: dependencies.development,
        outdated,
        security,
      },
      apis: {
        consumed: consumedApis,
        exposed: exposedApis,
      },
      services,
    };
  }

  private async checkOutdatedPackages(deps: any): Promise<OutdatedDependency[]> {
    // Use queryNpmRegistry from @apexcli/core
    // This avoids the npm audit failure issue
    const results: OutdatedDependency[] = [];

    for (const [name, version] of Object.entries(deps.production)) {
      const info = await queryNpmRegistry(name);
      if (info && !info.error) {
        // Compare versions
      }
    }

    return results;
  }
}
```

### 5. Technical Debt Analyzer Design

```typescript
// packages/orchestrator/src/codebase-analyzer/analyzers/debt-analyzer.ts

export class TechnicalDebtAnalyzer implements CodebaseAnalyzer<TechnicalDebtAnalysis> {
  async analyze(projectPath: string): Promise<TechnicalDebtAnalysis> {
    // 1. Calculate complexity metrics
    const complexityHotspots = await this.analyzeComplexity(projectPath);

    // 2. Detect code duplication
    const duplication = await this.detectDuplication(projectPath);

    // 3. Find TODO/FIXME comments
    const todoItems = await this.findTodoComments(projectPath);

    // 4. Detect deprecated patterns
    const deprecatedUsage = await this.findDeprecatedUsage(projectPath);

    // 5. Calculate maintainability metrics
    const metrics = await this.calculateMetrics(projectPath);

    // 6. Aggregate into categories
    const categories = this.categorizeDebt([
      ...complexityHotspots,
      ...duplication,
      ...todoItems,
      ...deprecatedUsage,
    ]);

    // 7. Calculate total score
    const totalScore = this.calculateDebtScore(categories);

    return {
      totalScore,
      categories,
      hotspots: complexityHotspots.slice(0, 10),
      metrics,
    };
  }
}
```

### 6. Orchestrator Integration

**Updated analyze() method**:

```typescript
// packages/orchestrator/src/codebase-analyzer/orchestrator.ts

async analyze(projectPath: string, options?: AnalysisOptions): Promise<DomainAnalysisResult[]> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const results: DomainAnalysisResult[] = [];

  try {
    // Phase 1: Stack Analysis
    await this.executePhase(
      AnalysisPhase.STACK,
      async () => {
        const analyzer = new StackAnalyzer();
        const data = await analyzer.analyze(projectPath);
        return { phase: AnalysisPhase.STACK, success: true, data, executionTime: Date.now() - startTime };
      },
      results
    );

    // Phase 2: Architecture Analysis
    await this.executePhase(
      AnalysisPhase.ARCHITECTURE,
      async () => {
        const analyzer = new ArchitectureAnalyzer();
        const data = await analyzer.analyze(projectPath);
        return { phase: AnalysisPhase.ARCHITECTURE, success: true, data, executionTime: Date.now() - startTime };
      },
      results
    );

    // Phase 3: Convention Analysis (existing)
    await this.executePhase(
      AnalysisPhase.CONVENTIONS,
      async () => {
        const analyzer = new ConventionAnalyzer();
        const data = await analyzer.analyze(projectPath);
        return { phase: AnalysisPhase.CONVENTIONS, success: true, data, executionTime: Date.now() - startTime };
      },
      results
    );

    // Phase 4: Testing Patterns
    await this.executePhase(
      AnalysisPhase.TESTING_PATTERNS,
      async () => {
        const analyzer = new TestingPatternAnalyzer();
        const data = await analyzer.analyze(projectPath);
        return { phase: AnalysisPhase.TESTING_PATTERNS, success: true, data, executionTime: Date.now() - startTime };
      },
      results
    );

    // Phase 5: Integrations
    await this.executePhase(
      AnalysisPhase.INTEGRATIONS,
      async () => {
        const analyzer = new IntegrationAnalyzer();
        const data = await analyzer.analyze(projectPath);
        return { phase: AnalysisPhase.INTEGRATIONS, success: true, data, executionTime: Date.now() - startTime };
      },
      results
    );

    // Phase 6: Technical Debt
    await this.executePhase(
      AnalysisPhase.TECHNICAL_DEBT,
      async () => {
        const analyzer = new TechnicalDebtAnalyzer();
        const data = await analyzer.analyze(projectPath);
        return { phase: AnalysisPhase.TECHNICAL_DEBT, success: true, data, executionTime: Date.now() - startTime };
      },
      results
    );

    return results;
  } catch (error) {
    // Error handling
  }
}
```

### 7. Parallel Execution (CodebaseMapper)

The CodebaseMapper already supports parallel execution through event-driven architecture. The fix involves:

1. Ensuring all phases are enabled in `getSupportedPhases()`
2. Agents are created dynamically from supported phases
3. Results are aggregated into `CodebaseAnalysis`

```typescript
// CodebaseMapper.analyze() - aggregation fix

const analysis: CodebaseAnalysis = {
  timestamp: new Date(),
  projectPath: this.config.projectPath,
};

for (const result of results) {
  if (result.success && result.data) {
    switch (result.phase) {
      case AnalysisPhase.STACK:
        analysis.stack = result.data;
        break;
      case AnalysisPhase.ARCHITECTURE:
        analysis.architecture = result.data;
        break;
      case AnalysisPhase.CONVENTIONS:
        analysis.conventions = result.data;
        break;
      case AnalysisPhase.TESTING_PATTERNS:
        analysis.testingPatterns = result.data;
        break;
      case AnalysisPhase.INTEGRATIONS:
        analysis.integrations = result.data;
        break;
      case AnalysisPhase.TECHNICAL_DEBT:
        analysis.technicalDebt = result.data;
        break;
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)
1. Add new AnalysisPhase enum values to types.ts
2. Add missing Zod schemas to @apexcli/core types.ts (if needed)
3. Update orchestrator to enable all phases

### Phase 2: Analyzer Implementation (Day 2-3)
1. Implement StackAnalyzer
2. Implement ArchitectureAnalyzer
3. Implement TestingPatternAnalyzer
4. Implement IntegrationAnalyzer
5. Implement TechnicalDebtAnalyzer

### Phase 3: npm Integration Fix (Day 3)
1. Replace npm audit calls with queryNpmRegistry
2. Add proper error handling for registry queries
3. Implement version comparison logic

### Phase 4: CodebaseMapper Integration (Day 4)
1. Update result aggregation
2. Fix parallel agent spawning
3. Add proper event emission for all phases

### Phase 5: Testing & Validation (Day 5)
1. Add unit tests for each analyzer
2. Add integration tests for full analysis flow
3. Update v0.6.0 roadmap status

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/orchestrator/src/codebase-analyzer/types.ts` | MODIFY | Add TESTING_PATTERNS, INTEGRATIONS phases |
| `packages/orchestrator/src/codebase-analyzer/orchestrator.ts` | MODIFY | Enable all phases, add analyzer calls |
| `packages/orchestrator/src/codebase-analyzer/analyzers/stack-analyzer.ts` | CREATE | Stack/technology detection |
| `packages/orchestrator/src/codebase-analyzer/analyzers/architecture-analyzer.ts` | CREATE | Architecture pattern detection |
| `packages/orchestrator/src/codebase-analyzer/analyzers/testing-analyzer.ts` | CREATE | Testing pattern analysis |
| `packages/orchestrator/src/codebase-analyzer/analyzers/integration-analyzer.ts` | CREATE | Third-party integration mapping |
| `packages/orchestrator/src/codebase-analyzer/analyzers/debt-analyzer.ts` | CREATE | Technical debt identification |
| `packages/orchestrator/src/codebase-analyzer/index.ts` | MODIFY | Export new analyzers |
| `packages/orchestrator/src/codebase-mapper.ts` | MODIFY | Fix result aggregation |
| `packages/core/src/types.ts` | MODIFY (if needed) | Add TestingPatternAnalysis, IntegrationAnalysis schemas |
| `ROADMAP.md` | MODIFY | Update v0.6.0 feature status |

## Consequences

### Positive
- All 7 brownfield analysis features will be functional
- npm integration will be more reliable (no shell command dependency)
- Parallel agent spawning will work correctly
- Comprehensive codebase analysis capability

### Negative
- Additional analyzer code increases package size
- npm registry queries add network latency (mitigated by caching)

### Risks
- npm registry may be unreachable (mitigated by graceful fallback)
- Complex codebases may have long analysis times (mitigated by quick mode)

## References

- ROADMAP.md lines 489-498 (v0.6.0 features)
- ConventionAnalyzer implementation (reference pattern)
- @apexcli/core types.ts (schema definitions)
- npm-registry-utils.ts (queryNpmRegistry)
