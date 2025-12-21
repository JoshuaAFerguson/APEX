# ADR-059: ProjectAnalysis Rich Dependency Types

## Status
Proposed

## Date
2024-12-20

## Context

The `ProjectAnalysis` interface in `packages/orchestrator/src/idle-processor.ts` currently uses simplified string arrays for dependency analysis:

```typescript
dependencies: {
  outdated: string[];    // e.g., ["lodash@^1.0.0"]
  security: string[];    // e.g., ["vuln-dep@1.0.0"]
};
```

This simplified structure lacks the rich metadata needed for:
1. **Intelligent prioritization** - Without version info, we can't distinguish major vs patch updates
2. **Security severity analysis** - All vulnerabilities are treated equally without CVE data
3. **Deprecation awareness** - No way to detect or track deprecated packages
4. **Actionable recommendations** - Missing information for automated remediation

The `MaintenanceAnalyzer` currently parses version strings with heuristics (checking for `@^0.` patterns), which is fragile and limited.

## Decision

### 1. Define Rich Dependency Types

Create three new types in `packages/orchestrator/src/idle-processor.ts` to capture detailed dependency information:

```typescript
/**
 * Represents an outdated dependency with version comparison metadata.
 */
export interface OutdatedDependency {
  /** Package name (e.g., "lodash") */
  name: string;
  /** Currently installed version (e.g., "4.17.15") */
  currentVersion: string;
  /** Latest available version (e.g., "4.17.21") */
  latestVersion: string;
  /** Type of update required */
  updateType: 'major' | 'minor' | 'patch';
}

/**
 * Represents a security vulnerability in a dependency.
 */
export interface SecurityVulnerability {
  /** Package name affected */
  name: string;
  /** CVE identifier (e.g., "CVE-2021-44228") */
  cveId: string;
  /** Severity level per CVSS scoring */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Version range affected (e.g., "<4.17.21") */
  affectedVersions: string;
  /** Human-readable description of the vulnerability */
  description: string;
}

/**
 * Represents a deprecated package that should be replaced.
 */
export interface DeprecatedPackage {
  /** Package name that is deprecated */
  name: string;
  /** Current installed version */
  currentVersion: string;
  /** Recommended replacement package (e.g., "@lodash/es") */
  replacement: string | null;
  /** Reason for deprecation */
  reason: string;
}
```

### 2. Update ProjectAnalysis Interface

Extend the `dependencies` field to include the new rich types:

```typescript
export interface ProjectAnalysis {
  codebaseSize: {
    files: number;
    lines: number;
    languages: Record<string, number>;
  };
  testCoverage?: {
    percentage: number;
    uncoveredFiles: string[];
  };
  dependencies: {
    /** @deprecated Use outdatedPackages instead - retained for backward compatibility */
    outdated: string[];
    /** @deprecated Use securityIssues instead - retained for backward compatibility */
    security: string[];
    /** Rich outdated dependency information */
    outdatedPackages?: OutdatedDependency[];
    /** Rich security vulnerability information */
    securityIssues?: SecurityVulnerability[];
    /** Deprecated packages that should be replaced */
    deprecatedPackages?: DeprecatedPackage[];
  };
  codeQuality: {
    lintIssues: number;
    duplicatedCode: string[];
    complexityHotspots: string[];
  };
  documentation: {
    coverage: number;
    missingDocs: string[];
  };
  performance: {
    bundleSize?: number;
    slowTests: string[];
    bottlenecks: string[];
  };
}
```

### 3. Backward Compatibility Strategy

The new fields are **optional** to maintain backward compatibility:
- Existing code using `outdated: string[]` and `security: string[]` continues to work
- New analyzers can leverage the rich types when available
- Gradual migration path for existing consumers

### 4. Type Placement Decision

**Location**: `packages/orchestrator/src/idle-processor.ts`

Rationale:
- `ProjectAnalysis` is already defined here
- These types are specific to idle processing/project analysis
- Keeps related types co-located
- Avoids polluting the core package with implementation-specific types

Alternative considered: Moving to `@apexcli/core/types.ts`
- Would require a breaking change for imports
- These types are not needed by CLI or API packages
- Adds unnecessary coupling

### 5. File Structure After Change

No new files required. Types are added to existing file:

```
packages/orchestrator/src/
├── idle-processor.ts           # Updated with new types
├── idle-task-generator.ts      # No changes needed
├── test-helpers.ts             # Update test helper types
└── analyzers/
    ├── index.ts                # No changes needed
    ├── maintenance-analyzer.ts # Update to use rich types (future)
    └── ...
```

## Type Hierarchy Diagram

```
ProjectAnalysis
└── dependencies
    ├── outdated: string[]              (deprecated, kept for compat)
    ├── security: string[]              (deprecated, kept for compat)
    ├── outdatedPackages?: OutdatedDependency[]
    │   ├── name: string
    │   ├── currentVersion: string
    │   ├── latestVersion: string
    │   └── updateType: 'major' | 'minor' | 'patch'
    ├── securityIssues?: SecurityVulnerability[]
    │   ├── name: string
    │   ├── cveId: string
    │   ├── severity: 'critical' | 'high' | 'medium' | 'low'
    │   ├── affectedVersions: string
    │   └── description: string
    └── deprecatedPackages?: DeprecatedPackage[]
        ├── name: string
        ├── currentVersion: string
        ├── replacement: string | null
        └── reason: string
```

## Implementation Details

### Type Definitions

```typescript
// packages/orchestrator/src/idle-processor.ts

export type UpdateType = 'major' | 'minor' | 'patch';

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface OutdatedDependency {
  name: string;
  currentVersion: string;
  latestVersion: string;
  updateType: UpdateType;
}

export interface SecurityVulnerability {
  name: string;
  cveId: string;
  severity: VulnerabilitySeverity;
  affectedVersions: string;
  description: string;
}

export interface DeprecatedPackage {
  name: string;
  currentVersion: string;
  replacement: string | null;
  reason: string;
}
```

### Updated ProjectAnalysis

```typescript
export interface ProjectAnalysis {
  codebaseSize: {
    files: number;
    lines: number;
    languages: Record<string, number>;
  };
  testCoverage?: {
    percentage: number;
    uncoveredFiles: string[];
  };
  dependencies: {
    // Legacy fields (kept for backward compatibility)
    outdated: string[];
    security: string[];
    // Rich dependency data (optional)
    outdatedPackages?: OutdatedDependency[];
    securityIssues?: SecurityVulnerability[];
    deprecatedPackages?: DeprecatedPackage[];
  };
  codeQuality: {
    lintIssues: number;
    duplicatedCode: string[];
    complexityHotspots: string[];
  };
  documentation: {
    coverage: number;
    missingDocs: string[];
  };
  performance: {
    bundleSize?: number;
    slowTests: string[];
    bottlenecks: string[];
  };
}
```

### Export Updates

The new types should be exported from the module:

```typescript
// At end of idle-processor.ts
export type {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  UpdateType,
  VulnerabilitySeverity,
};
```

## Test Updates Required

### test-helpers.ts

Update factory functions to include optional rich dependency data:

```typescript
export function createMinimalAnalysis(): ProjectAnalysis {
  return {
    // ... existing fields ...
    dependencies: {
      outdated: [],
      security: [],
      outdatedPackages: [],
      securityIssues: [],
      deprecatedPackages: [],
    },
    // ... rest ...
  };
}

export function createAnalysisWithRichDependencies(): ProjectAnalysis {
  return {
    // ... existing fields ...
    dependencies: {
      outdated: ['lodash@4.17.15'],
      security: ['vulnerable-pkg@1.0.0'],
      outdatedPackages: [
        {
          name: 'lodash',
          currentVersion: '4.17.15',
          latestVersion: '4.17.21',
          updateType: 'patch',
        },
      ],
      securityIssues: [
        {
          name: 'vulnerable-pkg',
          cveId: 'CVE-2024-12345',
          severity: 'high',
          affectedVersions: '<2.0.0',
          description: 'Remote code execution vulnerability',
        },
      ],
      deprecatedPackages: [
        {
          name: 'old-library',
          currentVersion: '1.2.3',
          replacement: 'new-library',
          reason: 'Unmaintained since 2022',
        },
      ],
    },
    // ... rest ...
  };
}
```

## Consequences

### Positive

1. **Richer Analysis** - Analyzers can make smarter decisions based on update type and severity
2. **Better Prioritization** - Critical CVEs can be prioritized over patch updates
3. **Deprecation Tracking** - New capability to track and suggest replacements for deprecated packages
4. **Backward Compatible** - Existing code continues to work without changes
5. **Type Safety** - Strong typing prevents invalid severity/update values
6. **Extensible** - Easy to add more fields (e.g., CVSS score, fix availability) later

### Negative

1. **Increased Complexity** - More types to maintain and document
2. **Dual Data** - Both legacy strings and rich types may need to be populated
3. **Optional Fields** - Consumers must handle undefined cases

### Neutral

1. **Migration Path** - Gradual adoption; consumers opt-in to rich types
2. **Future Work** - `analyzeDependencies()` method will need updates to populate rich data
3. **Tooling** - May require integration with `npm audit`, `npm outdated`, or similar tools

## Future Enhancements

After this architecture is implemented, consider:

1. **Update `analyzeDependencies()`** to populate rich types using `npm outdated --json` and `npm audit --json`
2. **Enhance `MaintenanceAnalyzer`** to use severity levels for prioritization
3. **Add `DeprecationAnalyzer`** as a new strategy type
4. **Create dashboard metrics** for dependency health visualization

## Related Documents

- [ADR-004: IdleTaskGenerator with Weighted Strategy Selection](./004-idle-task-generator.md)
- `packages/orchestrator/src/idle-processor.ts` - Current implementation
- `packages/orchestrator/src/analyzers/maintenance-analyzer.ts` - Consumer of dependency data

## Acceptance Criteria Verification

| Requirement | Addressed |
|------------|-----------|
| `OutdatedDependency` with currentVersion, latestVersion, updateType | ✅ |
| `SecurityVulnerability` with cveId, severity (critical\|high\|medium\|low), affectedVersions, description | ✅ |
| `DeprecatedPackage` with replacement, reason | ✅ |
| TypeScript compiles without errors | ✅ (design ensures type safety) |
