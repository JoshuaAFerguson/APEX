# ADR: Doctor Health Check Types and Utility Functions

## Status
Proposed

## Context

APEX needs a `doctor` command that diagnoses the health of the development environment, checking for:
- Required toolchain presence (Node.js, npm, git, etc.)
- Version compatibility
- Environment configuration correctness
- Package registry accessibility

This requires new types and utility functions in `@apexcli/core` that can be consumed by CLI, API, and potentially web-ui packages.

## Decision

### Type Design

We will add the following types to `packages/core/src/types.ts`:

#### 1. CheckSeverity (enum)

```typescript
export const CheckSeveritySchema = z.enum(['error', 'warning', 'info']);
export type CheckSeverity = z.infer<typeof CheckSeveritySchema>;
```

Severity levels for health check results:
- `error`: Critical issue preventing APEX operation
- `warning`: Non-critical issue that may cause problems
- `info`: Informational notice

#### 2. CheckStatus (enum)

```typescript
export const CheckStatusSchema = z.enum(['pass', 'fail', 'skip', 'unknown']);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;
```

Result status for individual checks:
- `pass`: Check passed successfully
- `fail`: Check failed
- `skip`: Check was skipped (e.g., optional dependency)
- `unknown`: Check could not be completed

#### 3. ToolchainCheck (interface)

```typescript
export const ToolchainCheckSchema = z.object({
  /** Name of the tool being checked (e.g., 'node', 'npm', 'git') */
  name: z.string(),
  /** Current installed version, or null if not installed */
  currentVersion: z.string().nullable(),
  /** Minimum required version */
  requiredVersion: z.string().optional(),
  /** Whether this tool is required or optional */
  required: z.boolean(),
  /** Path to the tool binary */
  path: z.string().optional(),
  /** Additional metadata about the tool */
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ToolchainCheck = z.infer<typeof ToolchainCheckSchema>;
```

Captures information about a specific tool in the development toolchain.

#### 4. DoctorCheckResult (interface)

```typescript
export const DoctorCheckResultSchema = z.object({
  /** Unique identifier for this check */
  id: z.string(),
  /** Human-readable name of the check */
  name: z.string(),
  /** Detailed description of what this check validates */
  description: z.string(),
  /** Category of the check (e.g., 'toolchain', 'config', 'network') */
  category: z.enum(['toolchain', 'config', 'network', 'permissions', 'environment']),
  /** Result status of the check */
  status: CheckStatusSchema,
  /** Severity if the check failed */
  severity: CheckSeveritySchema,
  /** Human-readable message explaining the result */
  message: z.string(),
  /** Suggested fix if the check failed */
  suggestion: z.string().optional(),
  /** Toolchain information if this is a toolchain check */
  toolchain: ToolchainCheckSchema.optional(),
  /** Timestamp when the check was performed */
  timestamp: z.date(),
  /** Duration of the check in milliseconds */
  durationMs: z.number(),
  /** Additional details for debugging */
  details: z.record(z.string(), z.unknown()).optional(),
});
export type DoctorCheckResult = z.infer<typeof DoctorCheckResultSchema>;
```

Represents the result of a single diagnostic check.

#### 5. HealthReport (interface)

```typescript
export const HealthReportSchema = z.object({
  /** Unique identifier for this report */
  id: z.string(),
  /** Timestamp when the report was generated */
  timestamp: z.date(),
  /** Overall health status */
  overallStatus: CheckStatusSchema,
  /** Summary counts */
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    warnings: z.number(),
    skipped: z.number(),
  }),
  /** Individual check results */
  checks: z.array(DoctorCheckResultSchema),
  /** System information */
  system: z.object({
    platform: z.string(),
    arch: z.string(),
    nodeVersion: z.string(),
    cwd: z.string(),
  }),
  /** Total duration of all checks in milliseconds */
  durationMs: z.number(),
  /** APEX version that generated this report */
  apexVersion: z.string(),
});
export type HealthReport = z.infer<typeof HealthReportSchema>;
```

Aggregated health report containing all check results.

### Utility Functions Design

We will create a new file `packages/core/src/doctor-utils.ts` with:

#### 1. Version Comparison Utilities

```typescript
/**
 * Check if a version satisfies a minimum version requirement
 * @param current - Current version string (e.g., "18.17.0")
 * @param required - Required minimum version (e.g., "16.0.0")
 * @returns true if current >= required
 */
export function satisfiesVersion(current: string, required: string): boolean;

/**
 * Compare two version strings
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersionStrings(a: string, b: string): -1 | 0 | 1;

/**
 * Parse version from command output (e.g., "v18.17.0" -> "18.17.0")
 */
export function parseVersionOutput(output: string): string | null;
```

These leverage the existing `parseSemver` and `compareVersions` functions in `utils.ts` but provide higher-level APIs for doctor checks.

#### 2. NPM Registry Query Utilities

```typescript
/**
 * Result of an npm registry package query
 */
export interface NpmPackageInfo {
  name: string;
  version: string;
  latestVersion: string;
  versions: string[];
  deprecated?: string;
  homepage?: string;
  repository?: string;
  error?: string;
}

/**
 * Query npm registry for package information
 * @param packageName - Name of the package to query
 * @param options - Query options
 */
export async function queryNpmRegistry(
  packageName: string,
  options?: {
    registry?: string;
    timeout?: number;
  }
): Promise<NpmPackageInfo | null>;

/**
 * Check if a package version is available on npm
 */
export async function isPackageVersionAvailable(
  packageName: string,
  version: string,
  options?: { registry?: string; timeout?: number }
): Promise<boolean>;

/**
 * Get the latest version of a package from npm
 */
export async function getLatestPackageVersion(
  packageName: string,
  options?: { registry?: string; timeout?: number }
): Promise<string | null>;
```

#### 3. Health Check Factory

```typescript
/**
 * Create a DoctorCheckResult with default values
 */
export function createDoctorCheckResult(
  partial: Partial<DoctorCheckResult> & Pick<DoctorCheckResult, 'id' | 'name' | 'category'>
): DoctorCheckResult;

/**
 * Create a HealthReport from check results
 */
export function createHealthReport(
  checks: DoctorCheckResult[],
  options?: { apexVersion?: string }
): HealthReport;
```

### File Structure

```
packages/core/src/
├── types.ts           # Add new types: CheckSeverity, CheckStatus, ToolchainCheck,
│                      # DoctorCheckResult, HealthReport (with Zod schemas)
├── doctor-utils.ts    # New file: Version comparison, npm registry queries, factories
├── index.ts           # Export doctor-utils
└── __tests__/
    └── doctor-utils.test.ts  # Unit tests for utility functions
```

### Design Rationale

1. **Zod Schemas**: All types have corresponding Zod schemas for runtime validation, consistent with existing patterns in `types.ts`.

2. **Category Enum**: Using a category enum for checks enables filtering and grouping in CLI/UI displays.

3. **Separation of Concerns**: Types in `types.ts`, utilities in dedicated `doctor-utils.ts` file.

4. **Reuse Existing Utilities**: The version comparison builds on existing `parseSemver` and `compareVersions` in `utils.ts`.

5. **Proper Error Handling**: NPM registry queries include timeout options and return `null` on failure rather than throwing, enabling graceful degradation.

6. **Factory Functions**: Provide convenient creation of complex types with sensible defaults.

### Integration Points

- **CLI Package**: Will use these types for `apex doctor` command output
- **API Package**: Can expose health endpoints using `HealthReport` type
- **Orchestrator**: Can perform health checks before task execution

## Consequences

### Positive
- Type-safe health check infrastructure
- Consistent patterns with existing codebase
- Reusable across all APEX packages
- Good separation between types and utility functions

### Negative
- Additional network dependency for npm registry queries
- Need to maintain version comparison edge cases

### Neutral
- New test file required for doctor-utils
- Documentation needed for new exported types

## References

- Existing `HealthMetrics` types in `types.ts` (lines 2966-2981)
- SemVer utilities in `utils.ts` (lines 306-585)
- `connection-health.ts` for health check patterns
- ADR: 0004-health-monitor-design.md
